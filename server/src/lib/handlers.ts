import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
// Import the SDK-free store contract (not ./store.js) so the Cloudflare Worker never bundles @azure/storage-blob.
import { PreconditionFailedError, type ObjStore } from "./store-types.js";

export interface HttpRequestInput {
  method: string;
  path: string;
  headers?: Record<string, string | undefined> | Headers;
  /** Platform-verified client IP injected by the hosting adapter (e.g. Cloudflare CF-Connecting-IP). */
  clientIp?: string;
  body?: string | Buffer | Uint8Array | null;
  /** Optional lazy reader used in Azure Functions so bodies are read only after auth & rate-limit checks. */
  readBody?: (maxBytes: number) => Promise<{ ok: true; body: Uint8Array } | { ok: false; status: 413 }>;
}

export interface HttpResponseOutput {
  status: number;
  headers: Record<string, string>;
  body?: string;
}

export interface HandlerEnv {
  ADMIN_KEY?: string;
  ALLOWED_ORIGINS?: string;
  RATE_LIMIT_DISABLED?: string;
  /**
   * The deployment's own origin (e.g. https://mots-b2.motb2.workers.dev), set by the Cloudflare Worker from the
   * request URL. Allowed for CORS in addition to ALLOWED_ORIGINS so same-origin pages always work.
   */
  SELF_ORIGIN?: string;
}

export const MAX_SYNC_BYTES = 30 * 1024 * 1024;
export const MAX_CONTROL_BYTES = 64 * 1024;
export const MAX_RATE_BUCKETS = 4096;
const MAX_HISTORY_ITEMS = 20;
const SYNC_CODE_RE = /^mb2_[A-Za-z0-9_-]{43}$/;
const AUTH_TOKEN_RE = /^mb2a_[A-Za-z0-9_-]{32,128}$/;
const DATASET_ID_RE = /^[a-z0-9-]{1,64}$/;
const HISTORY_ID_RE = /^[A-Za-z0-9TZ._-]+$/;
export const DEFAULT_ALLOWED_ORIGINS =
  "https://newsworld-niu.github.io,http://127.0.0.1:5190,http://localhost:5190,http://127.0.0.1:5191,http://localhost:5191,http://127.0.0.1:5188,http://localhost:5188,https://localhost,capacitor://localhost";

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function resetRateLimits(): void {
  rateBuckets.clear();
}

export function rateBucketCountForTest(): number {
  return rateBuckets.size;
}

function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): { ok: true } | { ok: false; retryAfterSec: number } {
  if (rateBuckets.size >= MAX_RATE_BUCKETS) {
    for (const [k, b] of rateBuckets) {
      if (b.resetAt <= now) rateBuckets.delete(k);
    }
    while (rateBuckets.size >= MAX_RATE_BUCKETS) {
      const oldest = rateBuckets.keys().next().value;
      if (oldest === undefined) break;
      rateBuckets.delete(oldest);
    }
  }
  const cur = rateBuckets.get(key);
  if (!cur || cur.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (cur.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)) };
  }
  cur.count++;
  return { ok: true };
}

export function clientIpKey(req: Pick<HttpRequestInput, "headers" | "clientIp">): string {
  const direct = req.clientIp?.trim();
  if (direct) return direct;
  const azureIp = getHeader(req.headers, "x-azure-clientip")?.trim();
  if (azureIp) return azureIp;
  const xff = getHeader(req.headers, "x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return getHeader(req.headers, "x-real-ip")?.trim() || getHeader(req.headers, "x-client-ip")?.trim() || "unknown";
}

let lastHistoryMs = 0;

function nextIsoTimestamp(): string {
  const now = Date.now();
  lastHistoryMs = now > lastHistoryMs ? now : lastHistoryMs + 1;
  return new Date(lastHistoryMs).toISOString();
}

function sha256hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function getHeader(
  headers: HttpRequestInput["headers"],
  name: string,
): string | undefined {
  if (!headers) return undefined;
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name) ?? undefined;
  }
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers as Record<string, string | undefined>)) {
    if (k.toLowerCase() === target) return v;
  }
  return undefined;
}

function normalizePath(rawPath: string): string {
  let pathname = rawPath;
  if (pathname.startsWith("http://") || pathname.startsWith("https://")) {
    try {
      pathname = new URL(pathname).pathname;
    } catch {
      pathname = rawPath.split(/[?#]/)[0] ?? "/";
    }
  } else {
    pathname = pathname.split(/[?#]/)[0] ?? "/";
  }
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;
  if (pathname.length > 1) pathname = pathname.replace(/\/+$/, "") || "/";
  if (pathname === "/api") return "/";
  if (pathname.startsWith("/api/")) return pathname.slice(4);
  return pathname;
}

export function buildBaseHeaders(
  req: Pick<HttpRequestInput, "headers">,
  env: HandlerEnv,
): Record<string, string> {
  const rawOrigins = env.ALLOWED_ORIGINS?.trim()
    ? env.ALLOWED_ORIGINS
    : DEFAULT_ALLOWED_ORIGINS;
  const allowed = new Set(
    rawOrigins
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const selfOrigin = env.SELF_ORIGIN?.trim();
  if (selfOrigin) allowed.add(selfOrigin);
  const origin = getHeader(req.headers, "origin")?.trim();
  const headers: Record<string, string> = {
    Vary: "Origin",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, If-Match, If-None-Match, x-admin-key",
    "Access-Control-Allow-Methods": "GET,PUT,POST,DELETE,OPTIONS",
    "Access-Control-Expose-Headers": "ETag",
    "Access-Control-Max-Age": "600",
  };
  if (origin && allowed.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function jsonResponse(
  baseHeaders: Record<string, string>,
  status: number,
  data: unknown,
  extraHeaders?: Record<string, string>,
): HttpResponseOutput {
  return {
    status,
    headers: {
      ...baseHeaders,
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
    body: JSON.stringify(data),
  };
}

const utf8Decoder = new TextDecoder("utf-8");

function readBodyBytes(body: HttpRequestInput["body"], maxBytes: number): {
  bytes: number;
  text: string;
} {
  if (body === null || body === undefined) {
    return { bytes: 0, text: "" };
  }
  if (typeof body === "string") {
    const bytes = Buffer.byteLength(body, "utf8");
    return bytes > maxBytes ? { bytes, text: "" } : { bytes, text: body };
  }
  if (body.byteLength > maxBytes) {
    return { bytes: body.byteLength, text: "" };
  }
  return {
    bytes: body.byteLength,
    text: utf8Decoder.decode(body),
  };
}

async function loadRequestBody(
  req: HttpRequestInput,
  maxBytes: number,
): Promise<{ ok: true; bytes: number; text: string } | { ok: false; status: 413 }> {
  if (req.readBody) {
    const res = await req.readBody(maxBytes);
    if (!res.ok) return { ok: false, status: 413 };
    return {
      ok: true,
      bytes: res.body.byteLength,
      text: utf8Decoder.decode(res.body),
    };
  }
  const { bytes, text } = readBodyBytes(req.body, maxBytes);
  if (bytes > maxBytes) return { ok: false, status: 413 };
  return { ok: true, bytes, text };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTimestampFromId(id: string, fallback: Date): string {
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2})(\d{2})(\d{2})(\d{3}Z)-/.exec(id);
  if (m) {
    const iso = `${m[1]}:${m[2]}:${m[3]}.${m[4]}`;
    if (!Number.isNaN(Date.parse(iso))) return iso;
  }
  return fallback.toISOString();
}

async function authenticate(
  req: HttpRequestInput,
  store: ObjStore,
): Promise<{ ns: string; tokenHash: string } | null> {
  const auth = getHeader(req.headers, "authorization");
  if (!auth) return null;
  const spaceIdx = auth.indexOf(" ");
  if (spaceIdx === -1) return null;
  const scheme = auth.slice(0, spaceIdx);
  const token = auth.slice(spaceIdx + 1).trim();
  if (scheme.toLowerCase() !== "bearer" || (!SYNC_CODE_RE.test(token) && !AUTH_TOKEN_RE.test(token))) {
    return null;
  }
  const tokenHash = sha256hex(token);
  if (await store.exists(`users/${tokenHash}/meta.json`)) {
    return { ns: tokenHash, tokenHash };
  }
  const aliasObj = await store.get(`aliases/${tokenHash}.json`);
  if (aliasObj && aliasObj !== "not-modified") {
    try {
      const alias = JSON.parse(aliasObj.body) as unknown;
      if (isRecord(alias) && typeof alias.ns === "string" && /^[a-f0-9]{64}$/.test(alias.ns)) {
        if (await store.exists(`users/${alias.ns}/meta.json`)) {
          return { ns: alias.ns, tokenHash };
        }
      }
    } catch {
      /* corrupt alias */
    }
  }
  return null;
}

async function handleRegister(
  req: HttpRequestInput,
  store: ObjStore,
  baseHeaders: Record<string, string>,
): Promise<HttpResponseOutput> {
  const bodyRes = await loadRequestBody(req, MAX_CONTROL_BYTES);
  if (!bodyRes.ok) {
    return jsonResponse(baseHeaders, 413, { error: "payload_too_large" });
  }
  let parsed: unknown = {};
  if (bodyRes.text.trim().length > 0) {
    try {
      parsed = JSON.parse(bodyRes.text);
    } catch {
      return jsonResponse(baseHeaders, 400, { error: "invalid_json" });
    }
  }
  if (!isRecord(parsed) || typeof parsed.inviteCode !== "string") {
    return jsonResponse(baseHeaders, 403, { error: "invalid_invite" });
  }
  const inviteCode = parsed.inviteCode.trim();
  if (!inviteCode) {
    return jsonResponse(baseHeaders, 403, { error: "invalid_invite" });
  }

  let suppliedAuthToken: string | null = null;
  if (parsed.authToken !== undefined) {
    if (typeof parsed.authToken !== "string" || !AUTH_TOKEN_RE.test(parsed.authToken.trim())) {
      return jsonResponse(baseHeaders, 400, { error: "invalid_auth_token" });
    }
    suppliedAuthToken = parsed.authToken.trim();
  }

  // The namespace is fixed before the invite is touched so the claim records who redeemed it.
  const syncCode = suppliedAuthToken ? null : "mb2_" + randomBytes(32).toString("base64url");
  const ns = sha256hex(suppliedAuthToken ?? (syncCode as string));
  const inviteKey = `invites/${sha256hex(inviteCode)}`;

  // Redeem with a conditional (ETag) transition instead of head()+delete(): object stores such as R2 report
  // success for deleting a missing key, so only a compare-and-swap guarantees a single winner.
  const inv = await store.get(inviteKey);
  if (inv === null || inv === "not-modified") {
    return jsonResponse(baseHeaders, 403, { error: "invalid_invite" });
  }
  let invite: { created?: string; status?: string; claimedBy?: string; claimedAt?: string };
  try {
    const raw = JSON.parse(inv.body) as unknown;
    if (!isRecord(raw)) throw new Error("invite is not an object");
    invite = raw as typeof invite;
  } catch {
    return jsonResponse(baseHeaders, 403, { error: "invalid_invite" });
  }

  if (invite.status === "claimed") {
    // Recovery: the same v2 client retrying within 10 minutes after its claim landed but meta.json or response failed.
    const claimedMs = invite.claimedAt ? Date.parse(invite.claimedAt) : Number.NaN;
    const withinWindow = Number.isFinite(claimedMs) && Date.now() - claimedMs <= 10 * 60 * 1000;
    if (suppliedAuthToken && invite.claimedBy === ns && withinWindow) {
      await createUserMeta(store, ns, true, inviteKey);
      return jsonResponse(baseHeaders, 201, { authVersion: 2 });
    }
    return jsonResponse(baseHeaders, 403, { error: "invalid_invite" });
  }

  try {
    await store.put(
      inviteKey,
      JSON.stringify({ ...invite, status: "claimed", claimedBy: ns, claimedAt: new Date().toISOString() }),
      { ifMatch: inv.etag },
    );
  } catch (err) {
    if (err instanceof PreconditionFailedError) {
      return jsonResponse(baseHeaders, 403, { error: "invalid_invite" });
    }
    throw err;
  }

  if (suppliedAuthToken) {
    await createUserMeta(store, ns, true, inviteKey);
    return jsonResponse(baseHeaders, 201, { authVersion: 2 });
  }
  await createUserMeta(store, ns, false, inviteKey);
  return jsonResponse(baseHeaders, 201, { syncCode });
}

/** Create users/<ns>/meta.json once; for v2 auth tokens an existing meta.json means a retried registration. */
async function createUserMeta(store: ObjStore, ns: string, authV2: boolean, inviteKey?: string): Promise<void> {
  const meta = {
    created: new Date().toISOString(),
    ...(authV2 ? { authVersion: 2 } : {}),
    ...(inviteKey ? { inviteKey } : {}),
  };
  try {
    await store.put(`users/${ns}/meta.json`, JSON.stringify(meta), { ifNoneMatchStar: true });
  } catch (err) {
    if (authV2 && err instanceof PreconditionFailedError) return;
    throw err;
  }
}

async function handleAuthUpgrade(
  req: HttpRequestInput,
  store: ObjStore,
  ns: string,
  baseHeaders: Record<string, string>,
): Promise<HttpResponseOutput> {
  const bodyRes = await loadRequestBody(req, MAX_CONTROL_BYTES);
  if (!bodyRes.ok) {
    return jsonResponse(baseHeaders, 413, { error: "payload_too_large" });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyRes.text);
  } catch {
    return jsonResponse(baseHeaders, 400, { error: "invalid_json" });
  }
  if (!isRecord(parsed) || typeof parsed.newAuthToken !== "string" || !AUTH_TOKEN_RE.test(parsed.newAuthToken.trim())) {
    return jsonResponse(baseHeaders, 400, { error: "invalid_auth_token" });
  }
  const newToken = parsed.newAuthToken.trim();
  const aliasHash = sha256hex(newToken);
  await store.put(
    `aliases/${aliasHash}.json`,
    JSON.stringify({ ns, upgradedAt: new Date().toISOString() }),
  );
  return jsonResponse(baseHeaders, 200, { ok: true, authVersion: 2 });
}

async function handleAdminInvites(
  req: HttpRequestInput,
  store: ObjStore,
  env: HandlerEnv,
  baseHeaders: Record<string, string>,
): Promise<HttpResponseOutput> {
  const configuredKey = env.ADMIN_KEY;
  const providedKey = getHeader(req.headers, "x-admin-key");
  if (
    !configuredKey ||
    !providedKey ||
    !constantTimeEqual(providedKey, configuredKey)
  ) {
    return jsonResponse(baseHeaders, 401, { error: "unauthorized" });
  }

  const bodyRes = await loadRequestBody(req, MAX_CONTROL_BYTES);
  if (!bodyRes.ok) {
    return jsonResponse(baseHeaders, 413, { error: "payload_too_large" });
  }
  const { text } = bodyRes;
  let count = 1;
  if (text.trim().length > 0) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return jsonResponse(baseHeaders, 400, { error: "invalid_json" });
    }
    if (!isRecord(parsed)) {
      return jsonResponse(baseHeaders, 400, { error: "invalid_payload" });
    }
    if (parsed.count !== undefined) {
      if (
        typeof parsed.count !== "number" ||
        !Number.isInteger(parsed.count) ||
        parsed.count < 1 ||
        parsed.count > 20
      ) {
        return jsonResponse(baseHeaders, 400, { error: "invalid_count" });
      }
      count = parsed.count;
    }
  }

  const invites: string[] = [];
  const created = new Date().toISOString();
  for (let i = 0; i < count; i++) {
    const code = "inv_" + randomBytes(12).toString("base64url");
    await store.put(
      `invites/${sha256hex(code)}`,
      JSON.stringify({ created }),
    );
    invites.push(code);
  }

  return jsonResponse(baseHeaders, 201, { invites });
}

async function handleGetSync(
  req: HttpRequestInput,
  store: ObjStore,
  ns: string,
  datasetId: string,
  baseHeaders: Record<string, string>,
): Promise<HttpResponseOutput> {
  const ifNoneMatch = getHeader(req.headers, "if-none-match")?.trim() || undefined;
  const res = await store.get(
    `users/${ns}/${datasetId}/latest.json`,
    ifNoneMatch === "*" ? undefined : ifNoneMatch,
  );
  if (res === "not-modified") {
    const headers: Record<string, string> = { ...baseHeaders };
    if (ifNoneMatch && ifNoneMatch !== "*") {
      headers.ETag = ifNoneMatch;
    }
    return { status: 304, headers };
  }
  if (res === null) {
    return jsonResponse(baseHeaders, 404, { error: "not_found" });
  }
  if (ifNoneMatch === "*") {
    return { status: 304, headers: { ...baseHeaders, ETag: res.etag } };
  }
  return {
    status: 200,
    headers: {
      ...baseHeaders,
      "Content-Type": "application/json; charset=utf-8",
      ETag: res.etag,
    },
    body: res.body,
  };
}

async function handlePutSync(
  req: HttpRequestInput,
  store: ObjStore,
  ns: string,
  datasetId: string,
  baseHeaders: Record<string, string>,
): Promise<HttpResponseOutput> {
  const bodyRes = await loadRequestBody(req, MAX_SYNC_BYTES);
  if (!bodyRes.ok) {
    return jsonResponse(baseHeaders, 413, { error: "payload_too_large" });
  }
  const { text } = bodyRes;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return jsonResponse(baseHeaders, 400, { error: "invalid_payload" });
  }
  const validLegacy =
    isRecord(parsed) &&
    parsed.app === "word-atlas" &&
    parsed.version === 2 &&
    isRecord(parsed.progress) &&
    parsed.progress.datasetId === datasetId;
  const validE2ee =
    isRecord(parsed) &&
    parsed.app === "word-atlas" &&
    parsed.version === 2 &&
    parsed.enc === "aes-gcm-v1" &&
    parsed.datasetId === datasetId &&
    typeof parsed.iv === "string" &&
    parsed.iv.length >= 12 &&
    parsed.iv.length <= 64 &&
    typeof parsed.ct === "string" &&
    parsed.ct.length >= 16;
  if (!validLegacy && !validE2ee) {
    return jsonResponse(baseHeaders, 400, { error: "invalid_payload" });
  }

  const ifMatch = getHeader(req.headers, "if-match")?.trim() || "";
  const ifNoneMatch = getHeader(req.headers, "if-none-match")?.trim() || "";
  if (!ifMatch && ifNoneMatch !== "*") {
    return jsonResponse(baseHeaders, 428, { error: "precondition_required" });
  }
  if (ifMatch && ifNoneMatch === "*") {
    return jsonResponse(baseHeaders, 412, { error: "conflict" });
  }

  const latestKey = `users/${ns}/${datasetId}/latest.json`;
  const current = await store.get(latestKey);

  if (ifNoneMatch === "*") {
    if (current !== null) {
      return jsonResponse(baseHeaders, 412, { error: "conflict" });
    }
    try {
      const etag = await store.put(latestKey, text, { ifNoneMatchStar: true });
      return jsonResponse(baseHeaders, 200, { etag }, { ETag: etag });
    } catch (err) {
      if (err instanceof PreconditionFailedError) {
        return jsonResponse(baseHeaders, 412, { error: "conflict" });
      }
      throw err;
    }
  }

  if (current === null || current === "not-modified" || current.etag !== ifMatch) {
    return jsonResponse(baseHeaders, 412, { error: "conflict" });
  }

  const historyPrefix = `users/${ns}/${datasetId}/history/`;
  const ts = nextIsoTimestamp().replace(/[:.]/g, "");
  const etagShort = current.etag.replace(/[^A-Za-z0-9]/g, "").slice(-8) || "0";
  // The random suffix keeps two isolates racing on the same revision in the same millisecond from sharing a key,
  // so the loser's 412 cleanup can never delete the winner's snapshot.
  const histKey = `${historyPrefix}${ts}-${etagShort}-${randomBytes(4).toString("hex")}.json`;

  // Write history snapshot first so an overwritten state is never lost.
  await store.put(histKey, current.body);

  let newEtag: string;
  try {
    newEtag = await store.put(latestKey, text, { ifMatch });
  } catch (err) {
    if (err instanceof PreconditionFailedError) {
      await store.delete(histKey).catch(() => undefined);
      return jsonResponse(baseHeaders, 412, { error: "conflict" });
    }
    throw err;
  }

  const historyItems = await store.list(historyPrefix);
  historyItems.sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
  if (historyItems.length > MAX_HISTORY_ITEMS) {
    await Promise.all(
      historyItems.slice(MAX_HISTORY_ITEMS).map((item) => store.delete(item.key)),
    );
  }

  return jsonResponse(baseHeaders, 200, { etag: newEtag }, { ETag: newEtag });
}

async function handleListHistory(
  store: ObjStore,
  ns: string,
  datasetId: string,
  baseHeaders: Record<string, string>,
): Promise<HttpResponseOutput> {
  const historyPrefix = `users/${ns}/${datasetId}/history/`;
  const items = await store.list(historyPrefix);
  const mapped = items
    .filter((item) => item.key.endsWith(".json"))
    .map((item) => {
      const id = item.key.slice(historyPrefix.length, -5);
      return {
        id,
        at: parseTimestampFromId(id, item.lastModified),
        size: item.size,
      };
    })
    .sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));

  return jsonResponse(baseHeaders, 200, mapped);
}

async function handleGetHistoryItem(
  store: ObjStore,
  ns: string,
  datasetId: string,
  id: string,
  baseHeaders: Record<string, string>,
): Promise<HttpResponseOutput> {
  if (!HISTORY_ID_RE.test(id) || id === "." || id === ".." || id.includes("..")) {
    return jsonResponse(baseHeaders, 400, { error: "invalid_history_id" });
  }
  const res = await store.get(`users/${ns}/${datasetId}/history/${id}.json`);
  if (res === null || res === "not-modified") {
    return jsonResponse(baseHeaders, 404, { error: "not_found" });
  }
  return {
    status: 200,
    headers: {
      ...baseHeaders,
      "Content-Type": "application/json; charset=utf-8",
      ETag: res.etag,
    },
    body: res.body,
  };
}

export async function handleRequest(
  req: HttpRequestInput,
  store: ObjStore,
  env: HandlerEnv,
): Promise<HttpResponseOutput> {
  const baseHeaders = buildBaseHeaders(req, env);
  const method = req.method.toUpperCase();

  if (method === "OPTIONS") {
    return { status: 204, headers: baseHeaders };
  }

  const path = normalizePath(req.path);

  if (path === "/health") {
    if (method !== "GET") {
      return jsonResponse(baseHeaders, 405, { error: "method_not_allowed" });
    }
    return jsonResponse(baseHeaders, 200, { ok: true });
  }

  if (env.RATE_LIMIT_DISABLED !== "1") {
    let limitKey = "";
    let maxReq = 120;
    if (path === "/register") {
      limitKey = `reg:${clientIpKey(req)}`;
      maxReq = 10;
    } else if (path === "/invites") {
      limitKey = `inv:${clientIpKey(req)}`;
      maxReq = 20;
    } else if (path === "/auth/upgrade") {
      limitKey = `up:${clientIpKey(req)}`;
      maxReq = 20;
    } else if (path === "/account" || path.startsWith("/sync")) {
      const auth = getHeader(req.headers, "authorization") ?? clientIpKey(req);
      limitKey = `sync:${sha256hex(auth).slice(0, 16)}`;
      maxReq = 120;
    }
    if (limitKey) {
      const rl = checkRateLimit(limitKey, maxReq, 60_000);
      if (!rl.ok) {
        return jsonResponse(baseHeaders, 429, { error: "rate_limited" }, { "Retry-After": String(rl.retryAfterSec) });
      }
    }
  }

  if (path === "/register") {
    if (method !== "POST") {
      return jsonResponse(baseHeaders, 405, { error: "method_not_allowed" });
    }
    return handleRegister(req, store, baseHeaders);
  }

  if (path === "/invites") {
    if (method !== "POST") {
      return jsonResponse(baseHeaders, 405, { error: "method_not_allowed" });
    }
    return handleAdminInvites(req, store, env, baseHeaders);
  }

  if (path === "/auth/upgrade") {
    if (method !== "POST") {
      return jsonResponse(baseHeaders, 405, { error: "method_not_allowed" });
    }
    const auth = await authenticate(req, store);
    if (!auth) {
      return jsonResponse(baseHeaders, 401, { error: "unauthorized" });
    }
    return handleAuthUpgrade(req, store, auth.ns, baseHeaders);
  }

  if (path === "/account") {
    if (method !== "DELETE") {
      return jsonResponse(baseHeaders, 405, { error: "method_not_allowed" });
    }
    const auth = await authenticate(req, store);
    if (!auth) {
      return jsonResponse(baseHeaders, 401, { error: "unauthorized" });
    }
    const metaObj = await store.get(`users/${auth.ns}/meta.json`);
    let claimedInviteKey: string | null = null;
    if (metaObj && metaObj !== "not-modified") {
      try {
        const meta = JSON.parse(metaObj.body) as unknown;
        if (isRecord(meta) && typeof meta.inviteKey === "string" && /^invites\/[a-f0-9]{64}$/.test(meta.inviteKey)) {
          claimedInviteKey = meta.inviteKey;
        }
      } catch {
        /* ignore malformed meta */
      }
    }
    const items = await store.list(`users/${auth.ns}/`);
    await Promise.all(items.map((item) => store.delete(item.key)));
    await store.delete(`users/${auth.ns}/meta.json`);
    if (claimedInviteKey) {
      await store.delete(claimedInviteKey);
    }
    if (auth.tokenHash !== auth.ns) {
      await store.delete(`aliases/${auth.tokenHash}.json`);
    }
    return { status: 204, headers: baseHeaders };
  }

  const syncHistoryItemMatch = /^\/sync\/([^/]+)\/history\/([^/]+)$/.exec(path);
  if (syncHistoryItemMatch) {
    if (method !== "GET") {
      return jsonResponse(baseHeaders, 405, { error: "method_not_allowed" });
    }
    const auth = await authenticate(req, store);
    if (!auth) {
      return jsonResponse(baseHeaders, 401, { error: "unauthorized" });
    }
    const [, datasetId, historyId] = syncHistoryItemMatch;
    if (!DATASET_ID_RE.test(datasetId)) {
      return jsonResponse(baseHeaders, 400, { error: "invalid_dataset_id" });
    }
    return handleGetHistoryItem(store, auth.ns, datasetId, historyId, baseHeaders);
  }

  const syncHistoryMatch = /^\/sync\/([^/]+)\/history$/.exec(path);
  if (syncHistoryMatch) {
    if (method !== "GET") {
      return jsonResponse(baseHeaders, 405, { error: "method_not_allowed" });
    }
    const auth = await authenticate(req, store);
    if (!auth) {
      return jsonResponse(baseHeaders, 401, { error: "unauthorized" });
    }
    const [, datasetId] = syncHistoryMatch;
    if (!DATASET_ID_RE.test(datasetId)) {
      return jsonResponse(baseHeaders, 400, { error: "invalid_dataset_id" });
    }
    return handleListHistory(store, auth.ns, datasetId, baseHeaders);
  }

  const syncMatch = /^\/sync\/([^/]+)$/.exec(path);
  if (syncMatch) {
    if (method !== "GET" && method !== "PUT") {
      return jsonResponse(baseHeaders, 405, { error: "method_not_allowed" });
    }
    const auth = await authenticate(req, store);
    if (!auth) {
      return jsonResponse(baseHeaders, 401, { error: "unauthorized" });
    }
    const [, datasetId] = syncMatch;
    if (!DATASET_ID_RE.test(datasetId)) {
      return jsonResponse(baseHeaders, 400, { error: "invalid_dataset_id" });
    }
    if (method === "GET") {
      return handleGetSync(req, store, auth.ns, datasetId, baseHeaders);
    }
    return handlePutSync(req, store, auth.ns, datasetId, baseHeaders);
  }

  return jsonResponse(baseHeaders, 404, { error: "not_found" });
}
