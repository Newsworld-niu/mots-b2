/**
 * Serves offloaded audio/video (`/media/<key>` and legacy `/atlas/audio/<key>`) and dictionary shards (`/lexdb/<key>`)
 * from the MEDIA_BUCKET R2 binding, with ETag revalidation, single byte-range requests and Cloudflare's edge cache.
 */

/** Only heavy media under these prefixes and dictionary shards under lexdb/ are served; everything else 404s before R2. */
export const MEDIA_KEY_RE =
  /^(?:atlas\/audio\/|materials\/)(?!.*\.\.)[^\0]+\.(?:mp3|m4a|aac|ogg|oga|wav|mp4|webm|m4v)$/i;
export const LEXDB_KEY_RE =
  /^lexdb\/(?:(?:meta|suggest)\.json|(?:e|forms|hints|suggest|zh)\/[^\0/\\]+\.json)$/i;
/** Objects up to this size are kept whole in the edge cache; larger ones always stream from R2. */
export const MEDIA_EDGE_CACHE_MAX_BYTES = 2 * 1024 * 1024;
const MEDIA_CACHE_CONTROL = "public, max-age=2592000";
const LEXDB_CACHE_CONTROL = "public, max-age=86400";
const ALLOW = "GET, HEAD, OPTIONS";

const CONTENT_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  wav: "audio/wav",
  mp4: "video/mp4",
  webm: "video/webm",
  m4v: "video/x-m4v",
  json: "application/json; charset=utf-8",
};

interface WaitUntil {
  waitUntil(promise: Promise<unknown>): void;
}

/** Map a request pathname to an allowlisted R2 key, or null (malformed escapes, traversal, other files). */
export function mediaKeyFromPath(pathname: string): string | null {
  let raw: string;
  if (pathname.startsWith("/media/")) raw = pathname.slice("/media/".length);
  else if (pathname.startsWith("/atlas/audio/") || pathname.startsWith("/lexdb/")) raw = pathname.slice(1);
  else return null;
  let key: string;
  try {
    key = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (key.includes("\\") || key.split("/").some((seg) => seg === "" || seg === "." || seg === "..")) return null;
  return MEDIA_KEY_RE.test(key) || LEXDB_KEY_RE.test(key) ? key : null;
}

export type ByteRange = { start: number; end: number };

/**
 * Parse a single RFC 9110 byte range against a representation of `total` bytes.
 * Returns null when the header should be ignored (absent, other unit, multiple ranges, unparsable) and
 * "unsatisfiable" when it must be answered with 416.
 */
export function parseRangeHeader(header: string | null, total: number): ByteRange | "unsatisfiable" | null {
  if (!header) return null;
  const unit = /^\s*bytes\s*=\s*(.*)$/i.exec(header);
  if (!unit) return null;
  const spec = unit[1].trim();
  if (spec.includes(",")) return null;
  const m = /^(\d*)\s*-\s*(\d*)$/.exec(spec);
  if (!m || (!m[1] && !m[2])) return null;
  if (!m[1]) {
    const suffix = Number(m[2]);
    if (!(suffix > 0) || total <= 0) return "unsatisfiable";
    return { start: Math.max(0, total - suffix), end: total - 1 };
  }
  const start = Number(m[1]);
  const last = m[2] ? Number(m[2]) : Number.POSITIVE_INFINITY;
  if (last < start || start >= total) return "unsatisfiable";
  return { start, end: Math.min(last, total - 1) };
}

function stripWeak(tag: string): string {
  return tag.trim().replace(/^W\//, "");
}

/** Weak comparison as used by If-None-Match (RFC 9110 §13.1.2). */
export function etagMatches(header: string, etag: string): boolean {
  if (!etag) return false;
  if (header.trim() === "*") return true;
  const target = stripWeak(etag);
  return header.split(",").some((t) => stripWeak(t) === target);
}

function effectiveRange(request: Request, etag: string, total: number): ByteRange | "unsatisfiable" | null {
  const ifRange = request.headers.get("If-Range");
  // If-Range with a different (or weak/date) validator means "send the whole thing".
  if (ifRange && (ifRange.trim().startsWith("W/") || ifRange.trim() !== etag)) return null;
  return parseRangeHeader(request.headers.get("Range"), total);
}

function contentTypeFor(key: string, stored?: string): string {
  const ext = key.slice(key.lastIndexOf(".") + 1).toLowerCase();
  return CONTENT_TYPES[ext] ?? stored ?? "application/octet-stream";
}

function mediaHeaders(key: string, etag: string, storedType?: string): Headers {
  return new Headers({
    "Content-Type": contentTypeFor(key, storedType),
    "Accept-Ranges": "bytes",
    ETag: etag,
    "Cache-Control": key.startsWith("lexdb/") ? LEXDB_CACHE_CONTROL : MEDIA_CACHE_CONTROL,
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "Accept-Ranges, Content-Length, Content-Range, ETag",
  });
}

function plain(status: number, text: string, extra?: Record<string, string>): Response {
  return new Response(text, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  });
}

function notModified(headers: Headers): Response {
  return new Response(null, { status: 304, headers });
}

function rangeNotSatisfiable(headers: Headers, total: number): Response {
  const h = new Headers(headers);
  h.set("Content-Range", `bytes */${total}`);
  h.delete("Content-Type");
  h.delete("Content-Length");
  return new Response(null, { status: 416, headers: h });
}

function edgeCache(): Cache | null {
  const store = (globalThis as { caches?: { default?: Cache } }).caches;
  return store?.default ?? null;
}

/**
 * Release a body we will not send. Not awaited: cancelling one branch of a tee'd stream (a cloned cache entry)
 * only settles once every branch is cancelled.
 */
function discard(res: Response): void {
  res.body?.cancel().catch(() => undefined);
}

/** Answer from a canonical full 200 copy held in the edge cache. */
async function fromCached(request: Request, hit: Response, isHead: boolean): Promise<Response> {
  const headers = new Headers(hit.headers);
  const etag = headers.get("ETag") ?? "";
  const inm = request.headers.get("If-None-Match");
  if (inm && etagMatches(inm, etag)) {
    discard(hit);
    headers.delete("Content-Length");
    return notModified(headers);
  }
  const lengthHeader = Number(headers.get("Content-Length"));
  const wantsRange = request.headers.has("Range");
  if (!wantsRange) {
    if (isHead) {
      discard(hit);
      return new Response(null, { status: 200, headers });
    }
    return new Response(hit.body, { status: 200, headers });
  }
  if (isHead && Number.isFinite(lengthHeader) && lengthHeader >= 0) {
    discard(hit);
    const range = effectiveRange(request, etag, lengthHeader);
    if (range === "unsatisfiable") return rangeNotSatisfiable(headers, lengthHeader);
    if (!range) {
      headers.set("Content-Length", String(lengthHeader));
      return new Response(null, { status: 200, headers });
    }
    const length = range.end - range.start + 1;
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${lengthHeader}`);
    headers.set("Content-Length", String(length));
    return new Response(null, { status: 206, headers });
  }
  const buf = await hit.arrayBuffer();
  const total = Number.isFinite(lengthHeader) && lengthHeader === buf.byteLength ? lengthHeader : buf.byteLength;
  const range = effectiveRange(request, etag, total);
  if (range === "unsatisfiable") return rangeNotSatisfiable(headers, total);
  if (!range) {
    headers.set("Content-Length", String(total));
    return new Response(isHead ? null : buf, { status: 200, headers });
  }
  const length = range.end - range.start + 1;
  headers.set("Content-Range", `bytes ${range.start}-${range.end}/${total}`);
  headers.set("Content-Length", String(length));
  return new Response(isHead ? null : new Uint8Array(buf, range.start, length), { status: 206, headers });
}

/** Fill the edge cache with the canonical full object in the background (never a 206). */
function warmEdgeCache(cache: Cache, cacheKey: Request, bucket: R2Bucket, key: string, ctx?: WaitUntil): void {
  if (!ctx) return;
  const task = (async () => {
    const full = await bucket.get(key);
    if (!full || !("body" in full) || !full.body) return;
    if (full.size > MEDIA_EDGE_CACHE_MAX_BYTES) {
      full.body.cancel().catch(() => undefined);
      return;
    }
    const headers = mediaHeaders(key, full.httpEtag, full.httpMetadata?.contentType);
    headers.set("Content-Length", String(full.size));
    await cache.put(cacheKey, new Response(full.body, { status: 200, headers }));
  })().catch(() => undefined);
  ctx.waitUntil(task);
}

export async function handleMediaRequest(request: Request, bucket: R2Bucket, ctx?: WaitUntil): Promise<Response> {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        Allow: ALLOW,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": ALLOW,
        "Access-Control-Allow-Headers": "Range, If-None-Match, If-Range",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  if (method !== "GET" && method !== "HEAD") {
    return plain(405, "Method Not Allowed", { Allow: ALLOW });
  }
  const isHead = method === "HEAD";
  const url = new URL(request.url);
  const key = mediaKeyFromPath(url.pathname);
  if (!key) return plain(404, "Not Found");

  const cache = edgeCache();
  // One canonical cache entry per object: same origin + path, no query, no Range, GET.
  const cacheKey = new Request(`${url.origin}${url.pathname}`, { method: "GET" });
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit && hit.status === 200) return fromCached(request, hit, isHead);
  }

  const inm = request.headers.get("If-None-Match");
  const rangeHeader = request.headers.get("Range");

  if (isHead || rangeHeader) {
    const head = await bucket.head(key);
    if (!head) return plain(404, "Not Found");
    const headers = mediaHeaders(key, head.httpEtag, head.httpMetadata?.contentType);
    if (inm && etagMatches(inm, head.httpEtag)) return notModified(headers);
    const range = rangeHeader ? effectiveRange(request, head.httpEtag, head.size) : null;
    if (range === "unsatisfiable") return rangeNotSatisfiable(headers, head.size);
    if (range) {
      const length = range.end - range.start + 1;
      headers.set("Content-Range", `bytes ${range.start}-${range.end}/${head.size}`);
      headers.set("Content-Length", String(length));
      if (isHead) return new Response(null, { status: 206, headers });
      const part = await bucket.get(key, {
        range: { offset: range.start, length },
        onlyIf: new Headers({ "If-Match": head.httpEtag }),
      });
      if (!part) return plain(404, "Not Found");
      if ("body" in part && part.body) {
        // A media element's first request is usually `bytes=0-`: warm the cache so later seeks are edge hits.
        if (cache && range.start === 0 && head.size <= MEDIA_EDGE_CACHE_MAX_BYTES) {
          warmEdgeCache(cache, cacheKey, bucket, key, ctx);
        }
        return new Response(part.body, { status: 206, headers });
      }
      // If the object changed between head() and get(), fall through to serve a consistent full representation.
    }
    if (isHead) {
      headers.set("Content-Length", String(head.size));
      return new Response(null, { status: 200, headers });
    }
  }

  const obj = await bucket.get(key, inm ? { onlyIf: new Headers({ "If-None-Match": inm }) } : undefined);
  if (!obj) return plain(404, "Not Found");
  const headers = mediaHeaders(key, obj.httpEtag, obj.httpMetadata?.contentType);
  if (!("body" in obj) || !obj.body) return notModified(headers);
  headers.set("Content-Length", String(obj.size));
  // Stream this response straight from R2 (keeps a known length) and fill the cache with a separate read.
  if (cache && obj.size <= MEDIA_EDGE_CACHE_MAX_BYTES) warmEdgeCache(cache, cacheKey, bucket, key, ctx);
  return new Response(obj.body, { status: 200, headers });
}
