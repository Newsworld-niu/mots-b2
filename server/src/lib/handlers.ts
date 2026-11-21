import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { PreconditionFailedError, type ObjStore } from "./store.js";

export interface HttpRequestInput {
  method: string;
  path: string;
  headers?: Record<string, string | undefined> | Headers;
  body?: string | Buffer | Uint8Array | null;
}

export interface HttpResponseOutput {
  status: number;
  headers: Record<string, string>;
  body?: string;
}

export interface HandlerEnv {
  ADMIN_KEY?: string;
  ALLOWED_ORIGINS?: string;
}

const MAX_SYNC_BYTES = 30 * 1024 * 1024;
const MAX_HISTORY_ITEMS = 20;
const SYNC_CODE_RE = /^mb2_[A-Za-z0-9_-]{43}$/;
const DATASET_ID_RE = /^[a-z0-9-]{1,64}$/;
const HISTORY_ID_RE = /^[A-Za-z0-9TZ._-]+$/;

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
  const allowed = new Set(
    (env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
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

function readBodyBytes(body: HttpRequestInput["body"]): {
  bytes: number;
  text: string;
} {
  if (body === null || body === undefined) {
    return { bytes: 0, text: "" };
  }
  if (typeof body === "string") {
    return { bytes: Buffer.byteLength(body, "utf8"), text: body };
  }
  if (body.byteLength > MAX_SYNC_BYTES) {
    return { bytes: body.byteLength, text: "" };
  }
  return {
    bytes: body.byteLength,
    text: Buffer.from(body.buffer, body.byteOffset, body.byteLength).toString("utf8"),
  };
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
): Promise<string | null> {
  const auth = getHeader(req.headers, "authorization");
  if (!auth) return null;
  const spaceIdx = auth.indexOf(" ");
  if (spaceIdx === -1) return null;
  const scheme = auth.slice(0, spaceIdx);
  const token = auth.slice(spaceIdx + 1).trim();
  if (scheme.toLowerCase() !== "bearer" || !SYNC_CODE_RE.test(token)) {
    return null;
  }
  const ns = sha256hex(token);
  const exists = await store.exists(`users/${ns}/meta.json`);
  return exists ? ns : null;
}

async function handleRegister(
  req: HttpRequestInput,
  store: ObjStore,
  baseHeaders: Record<string, string>,
): Promise<HttpResponseOutput> {
  const { bytes, text } = readBodyBytes(req.body);
  if (bytes > 64 * 1024) {
    return jsonResponse(baseHeaders, 400, { error: "invalid_payload" });
  }
  let parsed: unknown = {};
  if (text.trim().length > 0) {
    try {
      parsed = JSON.parse(text);
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

  const inviteKey = `invites/${sha256hex(inviteCode)}`;
  if (!(await store.exists(inviteKey))) {
    return jsonResponse(baseHeaders, 403, { error: "invalid_invite" });
  }
  await store.delete(inviteKey);

  const syncCode = "mb2_" + randomBytes(32).toString("base64url");
  const ns = sha256hex(syncCode);
  await store.put(
    `users/${ns}/meta.json`,
    JSON.stringify({ created: new Date().toISOString() }),
    { ifNoneMatchStar: true },
  );

  return jsonResponse(baseHeaders, 201, { syncCode });
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

  const { bytes, text } = readBodyBytes(req.body);
  if (bytes > 64 * 1024) {
    return jsonResponse(baseHeaders, 400, { error: "invalid_payload" });
  }
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
    ifNoneMatch,
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
  const { bytes, text } = readBodyBytes(req.body);
  if (bytes > MAX_SYNC_BYTES) {
    return jsonResponse(baseHeaders, 413, { error: "payload_too_large" });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return jsonResponse(baseHeaders, 400, { error: "invalid_payload" });
  }
  if (
    !isRecord(parsed) ||
    parsed.app !== "word-atlas" ||
    parsed.version !== 2 ||
    !isRecord(parsed.progress) ||
    parsed.progress.datasetId !== datasetId
  ) {
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
  const histKey = `${historyPrefix}${ts}-${etagShort}.json`;

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

  if (path === "/register") {
    if (method !== "POST") {
      return jsonResponse(baseHeaders, 405, { error: "method_not_allowed" });
    }
    return handleRegister(req, store, baseHeaders);
  }

  if (path === "/admin/invites") {
    if (method !== "POST") {
      return jsonResponse(baseHeaders, 405, { error: "method_not_allowed" });
    }
    return handleAdminInvites(req, store, env, baseHeaders);
  }

  if (path === "/account") {
    if (method !== "DELETE") {
      return jsonResponse(baseHeaders, 405, { error: "method_not_allowed" });
    }
    const ns = await authenticate(req, store);
    if (!ns) {
      return jsonResponse(baseHeaders, 401, { error: "unauthorized" });
    }
    const items = await store.list(`users/${ns}/`);
    await Promise.all(items.map((item) => store.delete(item.key)));
    await store.delete(`users/${ns}/meta.json`);
    return { status: 204, headers: baseHeaders };
  }

  const syncHistoryItemMatch = /^\/sync\/([^/]+)\/history\/([^/]+)$/.exec(path);
  if (syncHistoryItemMatch) {
    if (method !== "GET") {
      return jsonResponse(baseHeaders, 405, { error: "method_not_allowed" });
    }
    const ns = await authenticate(req, store);
    if (!ns) {
      return jsonResponse(baseHeaders, 401, { error: "unauthorized" });
    }
    const [, datasetId, historyId] = syncHistoryItemMatch;
    if (!DATASET_ID_RE.test(datasetId)) {
      return jsonResponse(baseHeaders, 400, { error: "invalid_dataset_id" });
    }
    return handleGetHistoryItem(store, ns, datasetId, historyId, baseHeaders);
  }

  const syncHistoryMatch = /^\/sync\/([^/]+)\/history$/.exec(path);
  if (syncHistoryMatch) {
    if (method !== "GET") {
      return jsonResponse(baseHeaders, 405, { error: "method_not_allowed" });
    }
    const ns = await authenticate(req, store);
    if (!ns) {
      return jsonResponse(baseHeaders, 401, { error: "unauthorized" });
    }
    const [, datasetId] = syncHistoryMatch;
    if (!DATASET_ID_RE.test(datasetId)) {
      return jsonResponse(baseHeaders, 400, { error: "invalid_dataset_id" });
    }
    return handleListHistory(store, ns, datasetId, baseHeaders);
  }

  const syncMatch = /^\/sync\/([^/]+)$/.exec(path);
  if (syncMatch) {
    if (method !== "GET" && method !== "PUT") {
      return jsonResponse(baseHeaders, 405, { error: "method_not_allowed" });
    }
    const ns = await authenticate(req, store);
    if (!ns) {
      return jsonResponse(baseHeaders, 401, { error: "unauthorized" });
    }
    const [, datasetId] = syncMatch;
    if (!DATASET_ID_RE.test(datasetId)) {
      return jsonResponse(baseHeaders, 400, { error: "invalid_dataset_id" });
    }
    if (method === "GET") {
      return handleGetSync(req, store, ns, datasetId, baseHeaders);
    }
    return handlePutSync(req, store, ns, datasetId, baseHeaders);
  }

  return jsonResponse(baseHeaders, 404, { error: "not_found" });
}
