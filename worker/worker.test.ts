import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";
import { PreconditionFailedError } from "../server/src/lib/store-types.js";
import { resetRateLimits } from "../server/src/lib/handlers.js";
import { handleDictionaryProxy, resetDictionaryRateLimits, DICTIONARY_RATE_LIMIT } from "./dictionary.js";
import { handleFetch, isSpaRoute, type Env } from "./index.js";
import { handleMediaRequest, mediaKeyFromPath, parseRangeHeader } from "./media.js";
import { R2ObjStore } from "./r2-store.js";

// ---------------------------------------------------------------------------------------------------------------
// In-memory R2 bucket with the precondition semantics the Worker relies on. `onlyIf` must be a Headers instance:
// the object form is rejected so a regression to `{ etagDoesNotMatch: "*" }` fails loudly.
// ---------------------------------------------------------------------------------------------------------------

interface StoredObject {
  key: string;
  bytes: Uint8Array;
  etag: string;
  uploaded: Date;
  contentType?: string;
}

function meta(o: StoredObject) {
  return {
    key: o.key,
    size: o.bytes.byteLength,
    etag: o.etag,
    httpEtag: `"${o.etag}"`,
    uploaded: o.uploaded,
    httpMetadata: o.contentType ? { contentType: o.contentType } : {},
    customMetadata: {},
  };
}

function withBody(o: StoredObject, bytes: Uint8Array) {
  return {
    ...meta(o),
    body: new Response(bytes.slice()).body,
    text: async () => new TextDecoder().decode(bytes),
    arrayBuffer: async () => bytes.slice().buffer,
  };
}

function assertHeadersCondition(onlyIf: unknown): Headers | undefined {
  if (onlyIf === undefined) return undefined;
  if (!(onlyIf instanceof Headers)) throw new TypeError("onlyIf must be passed as Headers");
  return onlyIf;
}

class MemoryR2Bucket {
  readonly items = new Map<string, StoredObject>();
  calls: string[] = [];
  listPageSize = 2;

  private tick = () => new Promise<void>((r) => setImmediate(r));

  private failsConditions(cond: Headers | undefined, existing: StoredObject | undefined): boolean {
    if (!cond) return false;
    const inm = cond.get("If-None-Match");
    const im = cond.get("If-Match");
    if (inm !== null) {
      if (existing && (inm === "*" || inm === `"${existing.etag}"`)) return true;
    }
    if (im !== null) {
      if (!existing || (im !== "*" && im !== `"${existing.etag}"`)) return true;
    }
    return false;
  }

  seed(key: string, bytes: Uint8Array, contentType?: string): StoredObject {
    const o = { key, bytes, etag: randomBytes(8).toString("hex"), uploaded: new Date(), contentType };
    this.items.set(key, o);
    return o;
  }

  async head(key: string) {
    this.calls.push(`head:${key}`);
    await this.tick();
    const o = this.items.get(key);
    return o ? meta(o) : null;
  }

  async get(key: string, options?: { onlyIf?: unknown; range?: { offset: number; length: number } }) {
    this.calls.push(`get:${key}${options?.range ? `@${options.range.offset}+${options.range.length}` : ""}`);
    const cond = assertHeadersCondition(options?.onlyIf);
    await this.tick();
    const o = this.items.get(key);
    if (!o) return null;
    if (this.failsConditions(cond, o)) return meta(o);
    if (options?.range) {
      const { offset, length } = options.range;
      return { ...withBody(o, o.bytes.slice(offset, offset + length)), range: { offset, length } };
    }
    return withBody(o, o.bytes);
  }

  async put(key: string, value: string | Uint8Array, options?: { onlyIf?: unknown; httpMetadata?: { contentType?: string } }) {
    this.calls.push(`put:${key}`);
    const cond = assertHeadersCondition(options?.onlyIf);
    await this.tick();
    // Check-and-set happens synchronously after the await, like R2's atomic conditional write.
    const existing = this.items.get(key);
    if (this.failsConditions(cond, existing)) return null;
    const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
    const o = this.seed(key, bytes, options?.httpMetadata?.contentType);
    return meta(o);
  }

  async delete(key: string) {
    this.calls.push(`delete:${key}`);
    await this.tick();
    this.items.delete(key);
  }

  async list(options: { prefix?: string; cursor?: string }) {
    this.calls.push(`list:${options.prefix ?? ""}:${options.cursor ?? ""}`);
    await this.tick();
    const keys = [...this.items.keys()].filter((k) => k.startsWith(options.prefix ?? "")).sort();
    const start = options.cursor ? Number(options.cursor) : 0;
    const page = keys.slice(start, start + this.listPageSize);
    const truncated = start + this.listPageSize < keys.length;
    return {
      objects: page.map((k) => meta(this.items.get(k)!)),
      truncated,
      ...(truncated ? { cursor: String(start + this.listPageSize) } : {}),
      delimitedPrefixes: [],
    };
  }
}

const asBucket = (b: MemoryR2Bucket) => b as unknown as R2Bucket;

// Edge cache stand-in for caches.default that refuses partial responses, like Cloudflare's Cache API.
class MemoryEdgeCache {
  readonly entries = new Map<string, Response>();
  puts: number[] = [];
  async match(req: Request) {
    const hit = this.entries.get(req.url);
    return hit ? hit.clone() : undefined;
  }
  async put(req: Request, res: Response) {
    this.puts.push(res.status);
    if (res.status === 206) throw new TypeError("Cannot cache a 206 response");
    this.entries.set(req.url, new Response(await res.arrayBuffer(), { status: res.status, headers: res.headers }));
  }
  async delete(req: Request) {
    return this.entries.delete(req.url);
  }
}

const INDEX_HTML = '<!doctype html><html><head><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>';

function makeAssets() {
  const seen: string[] = [];
  const fetcher = {
    seen,
    async fetch(input: Request | string) {
      const req = typeof input === "string" ? new Request(input) : input;
      const { pathname } = new URL(req.url);
      seen.push(pathname);
      const head = req.method === "HEAD";
      if (pathname === "/" || pathname === "/index.html") {
        return new Response(head ? null : INDEX_HTML, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", ETag: '"shell"' } });
      }
      if (pathname === "/assets/app.js") {
        return new Response(head ? null : "console.log(1)", { status: 200, headers: { "Content-Type": "text/javascript", "Cache-Control": "public, max-age=31536000, immutable" } });
      }
      if (pathname === "/atlas/index.json") {
        return new Response('{"ok":true}', { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response("Not Found", { status: 404 });
    },
  };
  return fetcher;
}

function makeEnv(overrides: Partial<Env> = {}) {
  const sync = new MemoryR2Bucket();
  const media = new MemoryR2Bucket();
  const assets = makeAssets();
  const env: Env = {
    ASSETS: assets as unknown as Fetcher,
    SYNC_BUCKET: asBucket(sync),
    MEDIA_BUCKET: asBucket(media),
    ADMIN_KEY: "worker-test-admin",
    RATE_LIMIT_DISABLED: "1",
    ...overrides,
  };
  return { env, sync, media, assets };
}

function makeCtx() {
  const tasks: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (p: Promise<unknown>) => void tasks.push(p),
    passThroughOnException: () => undefined,
    props: {},
  } as unknown as ExecutionContext;
  return { ctx, settle: () => Promise.all(tasks.splice(0)) };
}

const ORIGIN = "https://mots-b2.motb2.workers.dev";
const DATASET = "francais-b2-lexicon";

function backup(n: number): string {
  return JSON.stringify({ app: "word-atlas", version: 2, progress: { version: 2, datasetId: DATASET, cards: { [`w${n}`]: { reps: n } } } });
}

type GlobalWithCaches = typeof globalThis & { caches?: unknown };

// ---------------------------------------------------------------------------------------------------------------

describe("R2ObjStore", () => {
  it("passes Headers preconditions, maps null puts to PreconditionFailedError, and reports not-modified", async () => {
    const bucket = new MemoryR2Bucket();
    const store = new R2ObjStore(asBucket(bucket));

    const etag1 = await store.put("users/a/meta.json", "{}", { ifNoneMatchStar: true });
    assert.match(etag1, /^"[0-9a-f]+"$/);
    await assert.rejects(store.put("users/a/meta.json", "{}", { ifNoneMatchStar: true }), PreconditionFailedError);

    const got = await store.get("users/a/meta.json");
    assert.deepEqual(got, { body: "{}", etag: etag1 });
    assert.equal(await store.get("users/a/meta.json", etag1), "not-modified");
    assert.equal(await store.get("users/missing.json"), null);

    const etag2 = await store.put("users/a/meta.json", '{"v":2}', { ifMatch: etag1 });
    assert.notEqual(etag2, etag1);
    await assert.rejects(store.put("users/a/meta.json", '{"v":3}', { ifMatch: etag1 }), PreconditionFailedError);
    await assert.rejects(store.put("users/none.json", "{}", { ifMatch: etag1 }), PreconditionFailedError);
    assert.equal(bucket.items.get("users/a/meta.json")?.contentType, "application/json; charset=utf-8");
  });

  it("follows list cursors across pages and reports delete/exists accurately", async () => {
    const bucket = new MemoryR2Bucket();
    const store = new R2ObjStore(asBucket(bucket));
    for (let i = 0; i < 5; i++) await store.put(`users/x/history/${i}.json`, String(i));
    await store.put("users/y/other.json", "y");
    const items = await store.list("users/x/");
    assert.deepEqual(items.map((i) => i.key), [0, 1, 2, 3, 4].map((i) => `users/x/history/${i}.json`));
    assert.ok(items.every((i) => i.lastModified instanceof Date && i.size === 1));
    assert.equal(bucket.calls.filter((c) => c.startsWith("list:users/x/")).length, 3);

    assert.equal(await store.exists("users/y/other.json"), true);
    assert.equal(await store.delete("users/y/other.json"), true);
    assert.equal(await store.delete("users/y/other.json"), false);
    assert.equal(await store.exists("users/y/other.json"), false);
  });
});

describe("worker /api on R2", () => {
  beforeEach(() => resetRateLimits());

  async function api(env: Env, method: string, path: string, init: { headers?: Record<string, string>; body?: string } = {}) {
    const res = await handleFetch(new Request(`${ORIGIN}${path}`, { method, headers: init.headers, body: init.body }), env);
    const text = res.status === 204 || res.status === 304 ? "" : await res.text();
    return { res, text, json: () => JSON.parse(text) as Record<string, unknown> };
  }

  async function invite(env: Env): Promise<string> {
    const r = await api(env, "POST", "/api/invites", { headers: { "x-admin-key": "worker-test-admin" }, body: '{"count":1}' });
    assert.equal(r.res.status, 201);
    return (r.json().invites as string[])[0];
  }

  it("redeems an invite exactly once under concurrency", async () => {
    const { env, sync } = makeEnv();
    const code = await invite(env);
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        api(env, "POST", "/api/register", {
          body: JSON.stringify(i % 2 ? { inviteCode: code, authToken: `mb2a_${"abcdef"[i].repeat(40)}` } : { inviteCode: code }),
        }),
      ),
    );
    assert.deepEqual(results.map((r) => r.res.status).sort(), [201, 403, 403, 403, 403, 403]);
    const metas = [...sync.items.keys()].filter((k) => k.endsWith("/meta.json"));
    assert.equal(metas.length, 1);

    const nonexistent = await api(env, "POST", "/api/register", { body: '{"inviteCode":"inv_nope"}' });
    assert.equal(nonexistent.res.status, 403);
  });

  it("runs the sync lifecycle: create, 304, update with history, 412, history fetch, account delete", async () => {
    const { env, sync } = makeEnv();
    const code = await invite(env);
    const reg = await api(env, "POST", "/api/register", { body: JSON.stringify({ inviteCode: code }) });
    assert.equal(reg.res.status, 201);
    const syncCode = reg.json().syncCode as string;
    const auth = { Authorization: `Bearer ${syncCode}`, Origin: ORIGIN };
    const ns = createHash("sha256").update(syncCode).digest("hex");

    const missing = await api(env, "GET", `/api/sync/${DATASET}`, { headers: auth });
    assert.equal(missing.res.status, 404);

    const created = await api(env, "PUT", `/api/sync/${DATASET}`, { headers: { ...auth, "If-None-Match": "*", "Content-Type": "application/json" }, body: backup(1) });
    assert.equal(created.res.status, 200);
    const etag1 = created.res.headers.get("ETag")!;
    assert.match(etag1, /^"[0-9a-f]+"$/);
    // Same-origin page: SELF_ORIGIN makes CORS echo the Worker's own origin; ETag is exposed.
    assert.equal(created.res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
    assert.equal(created.res.headers.get("Access-Control-Expose-Headers"), "ETag");
    assert.equal(created.res.headers.get("X-Content-Type-Options"), "nosniff");

    const again = await api(env, "PUT", `/api/sync/${DATASET}`, { headers: { ...auth, "If-None-Match": "*" }, body: backup(1) });
    assert.equal(again.res.status, 412);

    const notModified = await api(env, "GET", `/api/sync/${DATASET}`, { headers: { ...auth, "If-None-Match": etag1 } });
    assert.equal(notModified.res.status, 304);
    assert.equal(notModified.res.body, null);
    assert.equal(notModified.res.headers.get("ETag"), etag1);

    const updated = await api(env, "PUT", `/api/sync/${DATASET}`, { headers: { ...auth, "If-Match": etag1 }, body: backup(2) });
    assert.equal(updated.res.status, 200);
    const etag2 = updated.res.headers.get("ETag")!;

    const stale = await api(env, "PUT", `/api/sync/${DATASET}`, { headers: { ...auth, "If-Match": etag1 }, body: backup(3) });
    assert.equal(stale.res.status, 412);

    const latest = await api(env, "GET", `/api/sync/${DATASET}`, { headers: auth });
    assert.equal(latest.res.status, 200);
    assert.equal(latest.text, backup(2));
    assert.equal(latest.res.headers.get("ETag"), etag2);

    const history = await api(env, "GET", `/api/sync/${DATASET}/history`, { headers: auth });
    const items = JSON.parse(history.text) as { id: string }[];
    assert.equal(items.length, 1);
    const snap = await api(env, "GET", `/api/sync/${DATASET}/history/${items[0].id}`, { headers: auth });
    assert.equal(snap.text, backup(1));

    // Preflight from the Worker's own origin.
    const pre = await handleFetch(new Request(`${ORIGIN}/api/sync/${DATASET}`, { method: "OPTIONS", headers: { Origin: ORIGIN } }), env);
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get("Access-Control-Allow-Origin"), ORIGIN);

    const del = await api(env, "DELETE", "/api/account", { headers: auth });
    assert.equal(del.res.status, 204);
    assert.equal(del.res.body, null);
    assert.equal([...sync.items.keys()].filter((k) => k.startsWith(`users/${ns}/`)).length, 0);
    const after = await api(env, "GET", `/api/sync/${DATASET}`, { headers: auth });
    assert.equal(after.res.status, 401);
  });

  it("returns 500 JSON with CORS headers when storage throws", async () => {
    const { env } = makeEnv();
    const broken = { ...env, SYNC_BUCKET: { head: async () => { throw new Error("r2 down"); } } as unknown as R2Bucket };
    const original = console.error;
    console.error = () => undefined;
    try {
      const res = await handleFetch(
        new Request(`${ORIGIN}/api/sync/${DATASET}`, { headers: { Authorization: `Bearer mb2_${"A".repeat(43)}`, Origin: ORIGIN } }),
        broken,
      );
      assert.equal(res.status, 500);
      assert.deepEqual(await res.json(), { error: "internal_error" });
      assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
    } finally {
      console.error = original;
    }
  });
});

describe("media from R2", () => {
  const bytes = Uint8Array.from({ length: 100 }, (_, i) => i);
  let cache: MemoryEdgeCache | null = null;

  afterEach(() => {
    delete (globalThis as GlobalWithCaches).caches;
    cache = null;
  });

  function useEdgeCache() {
    cache = new MemoryEdgeCache();
    (globalThis as GlobalWithCaches).caches = { default: cache };
    return cache;
  }

  it("normalizes and allowlists keys", () => {
    assert.equal(mediaKeyFromPath("/atlas/audio/f/rue.mp3"), "atlas/audio/f/rue.mp3");
    assert.equal(mediaKeyFromPath("/media/atlas/audio/f/rue.mp3"), "atlas/audio/f/rue.mp3");
    assert.equal(mediaKeyFromPath("/lexdb/e/ab.json"), "lexdb/e/ab.json");
    assert.equal(mediaKeyFromPath("/lexdb/meta.json"), "lexdb/meta.json");
    assert.equal(mediaKeyFromPath("/lexdb/evil/ab.json"), null);
    assert.equal(mediaKeyFromPath("/media/materials/co/%C3%A9t%C3%A9%201.m4a"), "materials/co/été 1.m4a");
    assert.equal(mediaKeyFromPath("/media/materials/..%2Fsecret.mp3"), null);
    assert.equal(mediaKeyFromPath("/media/materials/%E0%A4%A.mp3"), null);
    assert.equal(mediaKeyFromPath("/media/materials/rfi/notes.json"), null);
    assert.equal(mediaKeyFromPath("/media/users/abc/latest.mp3"), null);
    assert.equal(mediaKeyFromPath("/media/materials//x.mp3"), null);
    assert.equal(mediaKeyFromPath("/media/materials/a%00b.mp3"), null);
  });

  it("parses single byte ranges per RFC 9110", () => {
    assert.deepEqual(parseRangeHeader("bytes=0-9", 100), { start: 0, end: 9 });
    assert.deepEqual(parseRangeHeader("bytes=90-", 100), { start: 90, end: 99 });
    assert.deepEqual(parseRangeHeader("bytes=-5", 100), { start: 95, end: 99 });
    assert.deepEqual(parseRangeHeader("bytes=-500", 100), { start: 0, end: 99 });
    assert.deepEqual(parseRangeHeader("bytes=50-5000", 100), { start: 50, end: 99 });
    assert.equal(parseRangeHeader("bytes=100-", 100), "unsatisfiable");
    assert.equal(parseRangeHeader("bytes=9-3", 100), "unsatisfiable");
    assert.equal(parseRangeHeader("bytes=-0", 100), "unsatisfiable");
    assert.equal(parseRangeHeader("bytes=0-", 0), "unsatisfiable");
    assert.equal(parseRangeHeader("items=0-5", 100), null);
    assert.equal(parseRangeHeader("bytes=0-1,4-5", 100), null);
    assert.equal(parseRangeHeader("bytes=abc", 100), null);
    assert.equal(parseRangeHeader(null, 100), null);
  });

  it("serves GET, HEAD, ranges, suffix ranges, 304 and 416 straight from R2", async () => {
    const { env, media } = makeEnv();
    const obj = media.seed("atlas/audio/f/rue.mp3", bytes);
    media.seed("materials/rfi/ep.mp3", bytes);
    const etag = `"${obj.etag}"`;

    const full = await handleFetch(new Request(`${ORIGIN}/atlas/audio/f/rue.mp3`), env);
    assert.equal(full.status, 200);
    assert.equal(full.headers.get("Content-Type"), "audio/mpeg");
    assert.equal(full.headers.get("Accept-Ranges"), "bytes");
    assert.equal(full.headers.get("ETag"), etag);
    assert.equal(full.headers.get("Cache-Control"), "public, max-age=2592000");
    assert.equal(full.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(full.headers.get("Content-Length"), "100");
    assert.deepEqual(new Uint8Array(await full.arrayBuffer()), bytes);

    const head = await handleFetch(new Request(`${ORIGIN}/atlas/audio/f/rue.mp3`, { method: "HEAD" }), env);
    assert.equal(head.status, 200);
    assert.equal(head.headers.get("Content-Length"), "100");
    assert.equal(head.body, null);

    const part = await handleFetch(new Request(`${ORIGIN}/media/materials/rfi/ep.mp3`, { headers: { Range: "bytes=10-19" } }), env);
    assert.equal(part.status, 206);
    assert.equal(part.headers.get("Content-Range"), "bytes 10-19/100");
    assert.equal(part.headers.get("Content-Length"), "10");
    assert.deepEqual(new Uint8Array(await part.arrayBuffer()), bytes.slice(10, 20));
    assert.ok(media.calls.includes("get:materials/rfi/ep.mp3@10+10"));

    const suffix = await handleFetch(new Request(`${ORIGIN}/media/materials/rfi/ep.mp3`, { headers: { Range: "bytes=-5" } }), env);
    assert.equal(suffix.status, 206);
    assert.equal(suffix.headers.get("Content-Range"), "bytes 95-99/100");
    assert.deepEqual(new Uint8Array(await suffix.arrayBuffer()), bytes.slice(95));

    for (const range of ["bytes=100-", "bytes=9-3"]) {
      const bad = await handleFetch(new Request(`${ORIGIN}/media/materials/rfi/ep.mp3`, { headers: { Range: range } }), env);
      assert.equal(bad.status, 416, range);
      assert.equal(bad.headers.get("Content-Range"), "bytes */100");
    }

    const cond = await handleFetch(new Request(`${ORIGIN}/atlas/audio/f/rue.mp3`, { headers: { "If-None-Match": etag } }), env);
    assert.equal(cond.status, 304);
    assert.equal(cond.headers.get("ETag"), etag);
    const condRange = await handleFetch(new Request(`${ORIGIN}/atlas/audio/f/rue.mp3`, { headers: { "If-None-Match": etag, Range: "bytes=0-1" } }), env);
    assert.equal(condRange.status, 304);

    // If-Range with a stale validator falls back to the full representation.
    const ifRange = await handleFetch(new Request(`${ORIGIN}/atlas/audio/f/rue.mp3`, { headers: { Range: "bytes=0-1", "If-Range": '"old"' } }), env);
    assert.equal(ifRange.status, 200);
    assert.equal((await ifRange.arrayBuffer()).byteLength, 100);
  });

  it("rejects traversal, malformed escapes, other extensions and unsupported methods", async () => {
    const { env, media } = makeEnv();
    media.seed("materials/rfi/ep.mp3", bytes);
    for (const path of [
      "/media/materials/..%2Frfi%2Fep.mp3",
      "/media/materials/%E0%A4%A.mp3",
      "/media/materials/rfi/ep.json",
      "/media/secret/ep.mp3",
      "/atlas/audio/../materials/rfi/ep.mp3x",
      "/media/materials/missing.mp3",
    ]) {
      const res = await handleFetch(new Request(`${ORIGIN}${path}`), env);
      assert.equal(res.status, 404, path);
    }
    assert.deepEqual(media.calls, ["get:materials/missing.mp3"]);

    const post = await handleMediaRequest(new Request(`${ORIGIN}/media/materials/rfi/ep.mp3`, { method: "POST" }), asBucket(media));
    assert.equal(post.status, 405);
    assert.equal(post.headers.get("Allow"), "GET, HEAD, OPTIONS");
    const options = await handleMediaRequest(new Request(`${ORIGIN}/media/materials/rfi/ep.mp3`, { method: "OPTIONS" }), asBucket(media));
    assert.equal(options.status, 204);
  });

  it("caches only full 200 copies and slices ranges from a warm edge cache without touching R2", async () => {
    const { env, media } = makeEnv();
    media.seed("atlas/audio/f/rue.mp3", bytes);
    const edge = useEdgeCache();
    const { ctx, settle } = makeCtx();

    // Cold `bytes=0-` (a media element's first request) streams from R2 and warms the cache in the background.
    const cold = await handleFetch(new Request(`${ORIGIN}/atlas/audio/f/rue.mp3`, { headers: { Range: "bytes=0-" } }), env, ctx);
    assert.equal(cold.status, 206);
    assert.equal(cold.headers.get("Content-Range"), "bytes 0-99/100");
    await cold.arrayBuffer();
    await settle();
    assert.deepEqual(edge.puts, [200]);
    assert.equal(edge.entries.size, 1);

    media.calls = [];
    const warm = await handleFetch(new Request(`${ORIGIN}/atlas/audio/f/rue.mp3`, { headers: { Range: "bytes=20-29" } }), env, ctx);
    assert.equal(warm.status, 206);
    assert.equal(warm.headers.get("Content-Range"), "bytes 20-29/100");
    assert.deepEqual(new Uint8Array(await warm.arrayBuffer()), bytes.slice(20, 30));
    const warmFull = await handleFetch(new Request(`${ORIGIN}/atlas/audio/f/rue.mp3`), env, ctx);
    assert.equal(warmFull.status, 200);
    assert.deepEqual(new Uint8Array(await warmFull.arrayBuffer()), bytes);
    const warmHead = await handleFetch(new Request(`${ORIGIN}/atlas/audio/f/rue.mp3`, { method: "HEAD" }), env, ctx);
    assert.equal(warmHead.status, 200);
    assert.equal(warmHead.body, null);
    const warm416 = await handleFetch(new Request(`${ORIGIN}/atlas/audio/f/rue.mp3`, { headers: { Range: "bytes=500-" } }), env, ctx);
    assert.equal(warm416.status, 416);
    assert.equal(warm416.headers.get("Content-Range"), "bytes */100");
    assert.equal(warm416.headers.get("Content-Length"), null);
    const warmHeadRange = await handleFetch(new Request(`${ORIGIN}/atlas/audio/f/rue.mp3`, { method: "HEAD", headers: { Range: "bytes=10-19" } }), env, ctx);
    assert.equal(warmHeadRange.status, 206);
    assert.equal(warmHeadRange.headers.get("Content-Length"), "10");
    assert.equal(warmHeadRange.body, null);
    const etag = warmFull.headers.get("ETag")!;
    const warm304 = await handleFetch(new Request(`${ORIGIN}/atlas/audio/f/rue.mp3`, { headers: { "If-None-Match": etag } }), env, ctx);
    assert.equal(warm304.status, 304);
    // The same object via /media/ is a separate canonical URL; /atlas/audio/ requests never reached R2 again.
    assert.deepEqual(media.calls, []);

    // A cold full GET also warms the cache, and no 206 ever reaches cache.put().
    media.seed("materials/co/a.mp3", bytes);
    const coldFull = await handleFetch(new Request(`${ORIGIN}/media/materials/co/a.mp3`), env, ctx);
    assert.equal(coldFull.status, 200);
    await coldFull.arrayBuffer();
    await settle();
    assert.deepEqual(edge.puts, [200, 200]);
    assert.ok(!edge.puts.includes(206));
  });

  it("does not cache objects larger than 2 MiB", async () => {
    const { env, media } = makeEnv();
    media.seed("materials/big.mp4", new Uint8Array(2 * 1024 * 1024 + 1));
    const edge = useEdgeCache();
    const { ctx, settle } = makeCtx();
    const res = await handleFetch(new Request(`${ORIGIN}/media/materials/big.mp4`, { headers: { Range: "bytes=0-1023" } }), env, ctx);
    assert.equal(res.status, 206);
    assert.equal(res.headers.get("Content-Type"), "video/mp4");
    await res.arrayBuffer();
    await settle();
    assert.equal(edge.entries.size, 0);
  });
});

describe("dictionary proxy", () => {
  beforeEach(() => resetDictionaryRateLimits());

  const page = "<html><body><div id='ExpFCChild'>prendre — 拿，取</div></body></html>";
  const ok = (async () => new Response(page, { status: 200, headers: { "Content-Type": "text/html" } })) as unknown as typeof fetch;

  it("answers same-origin GETs with {html} JSON and forwards only a fixed upstream URL", async () => {
    let upstreamUrl = "";
    let upstreamInit: RequestInit | undefined;
    const fetchImpl = (async (input: string, init?: RequestInit) => {
      upstreamUrl = input;
      upstreamInit = init;
      return new Response(page, { status: 200 });
    }) as unknown as typeof fetch;
    const res = await handleDictionaryProxy(
      new Request(`${ORIGIN}/dictionary-proxy?q=${encodeURIComponent("prendre")}`, { headers: { "Sec-Fetch-Site": "same-origin", Origin: ORIGIN, Cookie: "sid=1" } }),
      { fetchImpl },
    );
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { html: page });
    assert.equal(res.headers.get("Cache-Control"), "no-store");
    assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(upstreamUrl, "https://www.frdic.com/dicts/fr/prendre");
    assert.equal(upstreamInit?.redirect, "manual");
    assert.equal(JSON.stringify(upstreamInit?.headers).includes("sid=1"), false);
  });

  it("rejects cross-site callers, other methods and bad queries", async () => {
    const cross = await handleDictionaryProxy(new Request(`${ORIGIN}/dictionary-proxy?q=a`, { headers: { "Sec-Fetch-Site": "cross-site" } }), { fetchImpl: ok });
    assert.equal(cross.status, 403);
    const sameSite = await handleDictionaryProxy(new Request(`${ORIGIN}/dictionary-proxy?q=a`, { headers: { "Sec-Fetch-Site": "same-site" } }), { fetchImpl: ok });
    assert.equal(sameSite.status, 403);
    const otherOrigin = await handleDictionaryProxy(new Request(`${ORIGIN}/dictionary-proxy?q=a`, { headers: { Origin: "https://evil.example" } }), { fetchImpl: ok });
    assert.equal(otherOrigin.status, 403);
    const post = await handleDictionaryProxy(new Request(`${ORIGIN}/dictionary-proxy?q=a`, { method: "POST" }), { fetchImpl: ok });
    assert.equal(post.status, 405);
    assert.equal(post.headers.get("Allow"), "GET");
    const empty = await handleDictionaryProxy(new Request(`${ORIGIN}/dictionary-proxy?q=%20`), { fetchImpl: ok });
    assert.equal(empty.status, 400);
    const long = await handleDictionaryProxy(new Request(`${ORIGIN}/dictionary-proxy?q=${"a".repeat(81)}`), { fetchImpl: ok });
    assert.equal(long.status, 400);
  });

  it("maps a login redirect to 429, other redirects to 502, and caps the body", async () => {
    const login = (async () => new Response(null, { status: 302, headers: { Location: "https://www.frdic.com/account/login?ret=x" } })) as unknown as typeof fetch;
    const r1 = await handleDictionaryProxy(new Request(`${ORIGIN}/dictionary-proxy?q=zzz`), { fetchImpl: login });
    assert.equal(r1.status, 429);
    const elsewhere = (async () => new Response(null, { status: 301, headers: { Location: "https://www.frdic.com/other" } })) as unknown as typeof fetch;
    const r2 = await handleDictionaryProxy(new Request(`${ORIGIN}/dictionary-proxy?q=zzz`), { fetchImpl: elsewhere });
    assert.equal(r2.status, 502);
    const huge = (async () => new Response(new Uint8Array(2_000_001))) as unknown as typeof fetch;
    const r3 = await handleDictionaryProxy(new Request(`${ORIGIN}/dictionary-proxy?q=zzz`), { fetchImpl: huge });
    assert.equal(r3.status, 502);
    const hang = ((_: string, init?: RequestInit) =>
      new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))))) as unknown as typeof fetch;
    const r4 = await handleDictionaryProxy(new Request(`${ORIGIN}/dictionary-proxy?q=zzz`), { fetchImpl: hang, timeoutMs: 10 });
    assert.equal(r4.status, 504);
  });

  it("rate limits per CF-Connecting-IP", async () => {
    const req = (ip: string) => new Request(`${ORIGIN}/dictionary-proxy?q=a`, { headers: { "CF-Connecting-IP": ip } });
    for (let i = 0; i < DICTIONARY_RATE_LIMIT; i++) {
      assert.equal((await handleDictionaryProxy(req("203.0.113.1"), { fetchImpl: ok })).status, 200);
    }
    const limited = await handleDictionaryProxy(req("203.0.113.1"), { fetchImpl: ok });
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get("Retry-After")) >= 1);
    assert.equal((await handleDictionaryProxy(req("203.0.113.2"), { fetchImpl: ok })).status, 200);
  });

  it("is routed by the Worker with security headers", async () => {
    const { env } = makeEnv();
    const original = globalThis.fetch;
    globalThis.fetch = ok;
    try {
      const res = await handleFetch(new Request(`${ORIGIN}/dictionary-proxy?q=prendre`, { headers: { "Sec-Fetch-Site": "same-origin" } }), env);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { html: page });
      assert.equal(res.headers.get("X-Frame-Options"), "DENY");
      const blocked = await handleFetch(new Request(`${ORIGIN}/dictionary-proxy?q=prendre`, { headers: { "Sec-Fetch-Site": "cross-site" } }), env);
      assert.equal(blocked.status, 403);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("worker routing", () => {
  it("answers /ai-proxy with an uncached 404 so the app calls AI services directly", async () => {
    const { env, assets } = makeEnv();
    for (const path of ["/ai-proxy/ping", "/ai-proxy", "/ai-proxy/openai/v1/chat/completions"]) {
      const res = await handleFetch(new Request(`${ORIGIN}${path}`), env);
      assert.equal(res.status, 404, path);
      assert.deepEqual(await res.json(), { error: "not_found" });
      assert.equal(res.headers.get("Cache-Control"), "no-store");
    }
    assert.deepEqual(assets.seen, []);
  });

  it("serves the app shell for SPA deep links and 404s for missing static files", async () => {
    const { env } = makeEnv();
    for (const path of ["/grammar/causatif", "/dict/prendre", "/atlas", "/grammar", "/me", "/w/prendre", "/dict/%C3%A9t%C3%A9"]) {
      const res = await handleFetch(new Request(`${ORIGIN}${path}?x=1`), env);
      assert.equal(res.status, 200, path);
      assert.match(res.headers.get("Content-Type") ?? "", /text\/html/);
      assert.equal(res.headers.get("Cache-Control"), "no-cache");
      assert.equal(res.headers.get("X-Frame-Options"), "DENY");
      assert.equal(res.headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
      assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
      assert.equal(await res.text(), INDEX_HTML);
    }
    const head = await handleFetch(new Request(`${ORIGIN}/grammar/causatif`, { method: "HEAD" }), env);
    assert.equal(head.status, 200);

    for (const path of ["/atlas/missing.json", "/dict/missing.json", "/grammar/x/y", "/nope"]) {
      const res = await handleFetch(new Request(`${ORIGIN}${path}`), env);
      assert.equal(res.status, 404, path);
    }

    const asset = await handleFetch(new Request(`${ORIGIN}/assets/app.js`), env);
    assert.equal(asset.status, 200);
    assert.equal(asset.headers.get("Cache-Control"), "public, max-age=31536000, immutable");
    assert.equal(asset.headers.get("X-Content-Type-Options"), "nosniff");
    const json = await handleFetch(new Request(`${ORIGIN}/atlas/index.json`), env);
    assert.equal(json.status, 200);
  });

  it("classifies SPA routes", () => {
    assert.equal(isSpaRoute("/grammar/causatif"), true);
    assert.equal(isSpaRoute("/lounge"), true);
    assert.equal(isSpaRoute("/w"), false);
    assert.equal(isSpaRoute("/atlas/entries"), false);
    assert.equal(isSpaRoute("/assets/app.js"), false);
    assert.equal(isSpaRoute("/"), false);
  });
});
