#!/usr/bin/env node
/**
 * Upload offloaded media (public/atlas/audio/** and public/materials/**\/*.{mp3,m4a,...}) to the Cloudflare R2
 * bucket the Worker serves under /media/ and /atlas/audio/. Zero npm dependencies: S3 SigV4 is done with node:crypto.
 *
 *   node scripts/sync-media-r2.mjs [--dry-run] [--setup] [--only=audio|materials|lexdb|all] [--concurrency=24]
 *
 * Environment (never written to disk or logged):
 *   CLOUDFLARE_ACCOUNT_ID                    required for anything that talks to Cloudflare
 *   R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY  explicit R2 S3 credentials, or
 *   CLOUDFLARE_API_TOKEN                     an API token with R2 edit rights; S3 credentials are derived from it
 *                                            (access key = token id, secret = sha256(token)); also used by --setup
 *   R2_MEDIA_BUCKET                          optional override of the media bucket name (default mots-b2-media)
 *
 * The file selection mirrors stripOffloadedMedia() in vite.config.ts, so everything the Cloudflare build strips
 * from dist/ is uploaded here. Objects whose key and size already match are skipped.
 */
import { createHash, createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(ROOT, "public");
export const SYNC_BUCKET = "mots-b2-sync";
export const DEFAULT_MEDIA_BUCKET = "mots-b2-media";
const CACHE_CONTROL = "public, max-age=2592000";
const LEXDB_CACHE_CONTROL = "public, max-age=86400";
const CF_API = "https://api.cloudflare.com/client/v4";
export const HEAVY_MEDIA_RE = /\.(?:mp3|m4a|aac|ogg|oga|wav|mp4|webm|m4v)$/i;
const CONTENT_TYPES = {
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

// ---------------------------------------------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------------------------------------------

export function parseArgs(argv) {
  const opts = { dryRun: false, setup: false, only: "all", concurrency: 24 };
  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--setup") opts.setup = true;
    else if (arg.startsWith("--only=")) opts.only = arg.slice("--only=".length);
    else if (arg.startsWith("--concurrency=")) opts.concurrency = Number(arg.slice("--concurrency=".length));
    else if (arg === "-h" || arg === "--help") opts.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!["all", "audio", "materials", "lexdb"].includes(opts.only)) {
    throw new Error(`Invalid --only value: ${opts.only} (expected audio|materials|lexdb|all)`);
  }
  if (!Number.isInteger(opts.concurrency) || opts.concurrency < 1 || opts.concurrency > 128) {
    throw new Error(`Invalid --concurrency value (expected an integer 1..128)`);
  }
  return opts;
}

const USAGE = "Usage: node scripts/sync-media-r2.mjs [--dry-run] [--setup] [--only=audio|materials|lexdb|all] [--concurrency=24]";

// ---------------------------------------------------------------------------------------------------------------
// Local inventory (mirrors vite.config.ts stripOffloadedMedia)
// ---------------------------------------------------------------------------------------------------------------

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (ent.isFile()) out.push(full);
  }
  return out;
}

/** Files the Cloudflare build strips from dist/, as { key, file, size } with POSIX keys relative to public/. */
export function localInventory(only = "all", publicDir = PUBLIC_DIR) {
  const items = [];
  const add = (full) => {
    const key = path.relative(publicDir, full).split(path.sep).join("/");
    // OS metadata files (.DS_Store) are stripped from dist but are not media worth uploading.
    if (key.split("/").some((seg) => seg.startsWith("."))) return;
    items.push({ key, file: full, size: fs.statSync(full).size });
  };
  if (only === "all" || only === "audio") {
    for (const f of walk(path.join(publicDir, "atlas", "audio"))) add(f);
  }
  if (only === "all" || only === "materials") {
    for (const f of walk(path.join(publicDir, "materials"))) if (HEAVY_MEDIA_RE.test(f)) add(f);
  }
  if (only === "all" || only === "lexdb") {
    for (const f of walk(path.join(publicDir, "lexdb"))) if (/\.json$/i.test(f)) add(f);
  }
  items.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return items;
}

// ---------------------------------------------------------------------------------------------------------------
// S3 SigV4 for R2
// ---------------------------------------------------------------------------------------------------------------

/** RFC 3986 percent-encoding (encodeURIComponent leaves !'()* alone; SigV4 requires them encoded). */
export function rfc3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function encodeKeyPath(key) {
  return key.split("/").map(rfc3986).join("/");
}

const sha256hex = (data) => createHash("sha256").update(data).digest("hex");
const md5hex = (data) => createHash("md5").update(data).digest("hex");
const hmac = (key, data) => createHmac("sha256", key).update(data, "utf8").digest();

/**
 * Sign an S3 request (AWS Signature Version 4). `canonicalPath` must already be URI-encoded; every header given
 * is signed. Returns the headers to send, including Authorization.
 */
export function signV4({ method, host, canonicalPath, query = {}, headers = {}, payloadHash, accessKeyId, secretAccessKey, region = "auto", service = "s3", now = new Date() }) {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const all = { ...headers, host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
  const lower = Object.fromEntries(Object.entries(all).map(([k, v]) => [k.toLowerCase(), String(v).trim().replace(/\s+/g, " ")]));
  const names = Object.keys(lower).sort();
  const canonicalHeaders = names.map((n) => `${n}:${lower[n]}\n`).join("");
  const signedHeaders = names.join(";");
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(String(query[k]))}`)
    .join("&");
  const canonicalRequest = [method, canonicalPath, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256hex(canonicalRequest)].join("\n");
  const kSigning = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), service), "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");
  return {
    ...all,
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    canonicalQuery,
  };
}

function xmlUnescape(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

/** Parse one ListObjectsV2 page. */
export function parseListObjectsV2(xml) {
  const objects = [];
  for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    const key = /<Key>([\s\S]*?)<\/Key>/.exec(m[1])?.[1];
    const size = /<Size>(\d+)<\/Size>/.exec(m[1])?.[1];
    const etagRaw = /<ETag>([\s\S]*?)<\/ETag>/.exec(m[1])?.[1];
    const etag = etagRaw ? xmlUnescape(etagRaw).replace(/^"+|"+$/g, "") : undefined;
    if (key !== undefined) objects.push({ key: xmlUnescape(key), size: Number(size ?? 0), ...(etag ? { etag } : {}) });
  }
  const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
  const next = /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1];
  return { objects, truncated, nextToken: next ? xmlUnescape(next) : undefined };
}

/** Check whether a local item differs from its remote R2 metadata (comparing MD5 when single-part ETag is present). */
export function needsUpload(item, remoteMeta) {
  if (!remoteMeta || remoteMeta.size !== item.size) return true;
  if (remoteMeta.etag && /^[0-9a-f]{32}$/i.test(remoteMeta.etag)) {
    return md5hex(fs.readFileSync(item.file)) !== remoteMeta.etag.toLowerCase();
  }
  return false;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetries(label, fn, attempts = 5) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (err && err.retryable === false) break;
      if (i < attempts - 1) await sleep(Math.min(8000, 400 * 2 ** i) + Math.floor(Math.random() * 250));
    }
  }
  throw new Error(`${label}: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}

function httpError(status, text) {
  const err = new Error(`HTTP ${status}${text ? `: ${text.slice(0, 300).replace(/\s+/g, " ")}` : ""}`);
  err.retryable = status === 408 || status === 429 || status >= 500;
  return err;
}

class R2S3 {
  constructor({ accountId, accessKeyId, secretAccessKey }) {
    this.host = `${accountId}.r2.cloudflarestorage.com`;
    this.creds = { accessKeyId, secretAccessKey };
  }

  async request(method, bucket, key, { query = {}, headers = {}, body } = {}) {
    const canonicalPath = `/${rfc3986(bucket)}${key ? `/${encodeKeyPath(key)}` : ""}`;
    const payloadHash = sha256hex(body ?? "");
    const signed = signV4({ method, host: this.host, canonicalPath, query, headers, payloadHash, ...this.creds });
    const { canonicalQuery, host: _host, ...sendHeaders } = signed;
    const url = `https://${this.host}${canonicalPath}${canonicalQuery ? `?${canonicalQuery}` : ""}`;
    const res = await fetch(url, { method, headers: sendHeaders, body });
    if (!res.ok) throw httpError(res.status, await res.text().catch(() => ""));
    return res;
  }

  async listAll(bucket, prefix) {
    const out = new Map();
    let token;
    do {
      const query = { "list-type": "2", prefix, "max-keys": "1000", ...(token ? { "continuation-token": token } : {}) };
      const page = await withRetries(`list ${prefix}`, async () =>
        parseListObjectsV2(await (await this.request("GET", bucket, "", { query })).text()),
      );
      for (const o of page.objects) out.set(o.key, { size: o.size, etag: o.etag });
      token = page.truncated ? page.nextToken : undefined;
    } while (token);
    return out;
  }

  async upload(bucket, item) {
    const ext = item.key.slice(item.key.lastIndexOf(".") + 1).toLowerCase();
    const cc = item.key.startsWith("lexdb/") ? LEXDB_CACHE_CONTROL : CACHE_CONTROL;
    await withRetries(`upload ${item.key}`, async () => {
      const body = fs.readFileSync(item.file);
      await this.request("PUT", bucket, item.key, {
        body,
        headers: {
          "content-type": CONTENT_TYPES[ext] ?? "application/octet-stream",
          "cache-control": cc,
        },
      });
    });
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Cloudflare API (token verification and bucket setup)
// ---------------------------------------------------------------------------------------------------------------

async function cfApi(token, method, apiPath, body) {
  const res = await fetch(`${CF_API}${apiPath}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* not JSON */
  }
  return { status: res.status, ok: res.ok && json?.success !== false, json };
}

/** Derive R2 S3 credentials from an API token: access key id = token id, secret = sha256(token). */
async function deriveS3Credentials(token, accountId) {
  let verified = await cfApi(token, "GET", "/user/tokens/verify");
  if (!verified.ok || !verified.json?.result?.id) {
    // Account-owned tokens verify under the account instead of the user.
    verified = await cfApi(token, "GET", `/accounts/${encodeURIComponent(accountId)}/tokens/verify`);
  }
  const id = verified.json?.result?.id;
  if (!verified.ok || typeof id !== "string" || !id) {
    throw new Error(`CLOUDFLARE_API_TOKEN could not be verified (HTTP ${verified.status}); set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY instead.`);
  }
  return { accessKeyId: id, secretAccessKey: sha256hex(token) };
}

async function ensureBucket(token, accountId, name, dryRun) {
  const base = `/accounts/${encodeURIComponent(accountId)}/r2/buckets`;
  const existing = await cfApi(token, "GET", `${base}/${encodeURIComponent(name)}`);
  if (existing.ok) {
    console.log(`[r2] bucket ${name}: exists`);
    return;
  }
  if (existing.status !== 404) {
    throw new Error(`could not look up bucket ${name} (HTTP ${existing.status})`);
  }
  if (dryRun) {
    console.log(`[r2] bucket ${name}: missing — would create with location hint apac (--dry-run)`);
    return;
  }
  const created = await cfApi(token, "POST", base, { name, locationHint: "apac" });
  if (!created.ok) throw new Error(`could not create bucket ${name} (HTTP ${created.status})`);
  console.log(`[r2] bucket ${name}: created (location hint apac)`);
}

// ---------------------------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------------------------

const mb = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

function summarize(items) {
  const groups = new Map();
  for (const it of items) {
    const group = it.key.startsWith("atlas/audio/")
      ? "atlas/audio"
      : it.key.startsWith("lexdb/")
        ? "lexdb"
        : it.key.split("/").slice(0, 2).join("/");
    const g = groups.get(group) ?? { count: 0, bytes: 0 };
    g.count++;
    g.bytes += it.size;
    groups.set(group, g);
  }
  return [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
}

async function runPool(items, concurrency, fn) {
  let next = 0;
  let done = 0;
  const failures = [];
  const total = items.length;
  const progressEvery = Math.max(1, Math.floor(total / 20));
  await Promise.all(
    Array.from({ length: Math.min(concurrency, total) }, async () => {
      while (next < total) {
        const item = items[next++];
        try {
          await fn(item);
        } catch (err) {
          failures.push({ key: item.key, error: err instanceof Error ? err.message : String(err) });
        }
        done++;
        if (done % progressEvery === 0 || done === total) console.log(`[r2] uploaded ${done}/${total}`);
      }
    }),
  );
  return failures;
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    console.error(USAGE);
    return 1;
  }
  if (opts.help) {
    console.log(USAGE);
    return 0;
  }
  const bucket = env.R2_MEDIA_BUCKET?.trim() || DEFAULT_MEDIA_BUCKET;
  const items = localInventory(opts.only);
  const totalBytes = items.reduce((n, it) => n + it.size, 0);
  console.log(`[r2] media bucket: ${bucket}${opts.dryRun ? " (--dry-run: no changes will be made)" : ""}`);
  console.log(`[r2] local inventory (--only=${opts.only}): ${items.length} files, ${mb(totalBytes)}`);
  for (const [group, g] of summarize(items)) console.log(`  - public/${group}: ${g.count} files (${mb(g.bytes)})`);
  const largest = items.reduce((m, it) => (it.size > m.size ? it : m), { key: "", size: 0 });
  if (largest.key) console.log(`[r2] largest file: ${largest.key} (${mb(largest.size)})`);

  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = env.CLOUDFLARE_API_TOKEN?.trim();
  const explicitKey = env.R2_ACCESS_KEY_ID?.trim();
  const explicitSecret = env.R2_SECRET_ACCESS_KEY?.trim();
  const hasCreds = Boolean(accountId && ((explicitKey && explicitSecret) || apiToken));

  if (!hasCreds) {
    const missing = [
      !accountId && "CLOUDFLARE_ACCOUNT_ID",
      !(explicitKey && explicitSecret) && !apiToken && "CLOUDFLARE_API_TOKEN (or R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY)",
    ].filter(Boolean);
    if (opts.dryRun) {
      console.log(`[r2] no Cloudflare credentials (${missing.join(", ")}): skipping the remote comparison.`);
      if (opts.setup) console.log(`[r2] planned: ensure buckets ${SYNC_BUCKET} and ${bucket} exist (location hint apac)`);
      console.log(`[r2] planned: upload up to ${items.length} files (${mb(totalBytes)}) with Cache-Control: ${CACHE_CONTROL}, skipping objects whose size already matches`);
      return 0;
    }
    console.error(`[r2] missing ${missing.join(", ")}`);
    return 1;
  }

  try {
    if (opts.setup) {
      if (!apiToken) throw new Error("--setup needs CLOUDFLARE_API_TOKEN (bucket management uses the Cloudflare API)");
      for (const name of [SYNC_BUCKET, bucket]) await ensureBucket(apiToken, accountId, name, opts.dryRun);
    }
    const creds =
      explicitKey && explicitSecret
        ? { accessKeyId: explicitKey, secretAccessKey: explicitSecret }
        : await deriveS3Credentials(apiToken, accountId);
    const s3 = new R2S3({ accountId, ...creds });

    const prefixes =
      opts.only === "audio"
        ? ["atlas/audio/"]
        : opts.only === "materials"
          ? ["materials/"]
          : opts.only === "lexdb"
            ? ["lexdb/"]
            : ["atlas/audio/", "materials/", "lexdb/"];
    const remote = new Map();
    for (const prefix of prefixes) {
      try {
        for (const [k, v] of await s3.listAll(bucket, prefix)) remote.set(k, v);
      } catch (err) {
        if (opts.dryRun && /HTTP 404/.test(String(err))) {
          console.log(`[r2] bucket ${bucket} not found: everything would be uploaded`);
          break;
        }
        throw err;
      }
    }
    const todo = items.filter((it) => needsUpload(it, remote.get(it.key)));
    const todoBytes = todo.reduce((n, it) => n + it.size, 0);
    console.log(`[r2] remote objects under ${prefixes.join(", ")}: ${remote.size}`);
    console.log(`[r2] up to date: ${items.length - todo.length}; to upload: ${todo.length} (${mb(todoBytes)})`);
    if (opts.dryRun) {
      for (const it of todo.slice(0, 20)) console.log(`  would upload ${it.key} (${it.size} bytes)`);
      if (todo.length > 20) console.log(`  ... and ${todo.length - 20} more`);
      return 0;
    }
    if (todo.length === 0) return 0;
    const failures = await runPool(todo, opts.concurrency, (it) => s3.upload(bucket, it));
    if (failures.length) {
      console.error(`[r2] ${failures.length} uploads failed:`);
      for (const f of failures.slice(0, 20)) console.error(`  ${f.key}: ${f.error}`);
      return 1;
    }
    console.log(`[r2] done: ${todo.length} files uploaded (${mb(todoBytes)})`);
    return 0;
  } catch (err) {
    console.error(`[r2] ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await main();
}
