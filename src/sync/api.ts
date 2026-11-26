import { SYNC_API_URL } from "../config";

const DEFAULT_TIMEOUT_MS = 20_000;

export class SyncAuthError extends Error {
  constructor(message = "同步码无效，请重新配对") {
    super(message);
    this.name = "SyncAuthError";
  }
}

export class SyncConflictError extends Error {
  constructor(message = "云端数据已更新") {
    super(message);
    this.name = "SyncConflictError";
  }
}

export class SyncNetworkError extends Error {
  override cause?: unknown;
  constructor(message = "网络不可用，稍后自动重试", cause?: unknown) {
    super(message);
    this.name = "SyncNetworkError";
    this.cause = cause;
  }
}

export class SyncApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, code?: string, message?: string) {
    super(message || `同步服务异常（${status}）`);
    this.name = "SyncApiError";
    this.status = status;
    this.code = code;
  }
}

export interface SyncHistoryItem {
  id: string;
  at: string | number;
  size: number;
}

export type PullResult =
  | { status: "ok"; body: string; etag: string }
  | { status: "not-modified" }
  | { status: "missing" };

export function normalizeBaseUrl(baseUrl = SYNC_API_URL): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function isSyncConfigured(baseUrl = SYNC_API_URL): boolean {
  return normalizeBaseUrl(baseUrl).length > 0;
}

async function readErrorBody(res: Response): Promise<{ error?: string } | null> {
  try {
    const text = await res.text();
    if (!text) return null;
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as { error?: string }) : null;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // Sync responses carry ETags for conditional requests; never let the HTTP cache or the service worker answer.
    return await fetch(url, { cache: "no-store", ...init, signal: ctrl.signal });
  } catch (err) {
    throw new SyncNetworkError("网络不可用，稍后自动重试", err);
  } finally {
    clearTimeout(timer);
  }
}

function requireBase(baseUrl: string): string {
  const base = normalizeBaseUrl(baseUrl);
  if (!base) throw new SyncApiError(0, "unconfigured", "未配置云同步服务器地址");
  return base;
}

export async function registerInvite(
  inviteCode: string,
  baseUrl = SYNC_API_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  authToken?: string,
): Promise<{ syncCode?: string; authVersion?: 1 | 2 }> {
  const base = requireBase(baseUrl);
  const payload = authToken ? { inviteCode: inviteCode.trim(), authToken } : { inviteCode: inviteCode.trim() };
  const res = await fetchWithTimeout(
    `${base}/api/register`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    timeoutMs,
  );
  if (res.status === 403) {
    const body = await readErrorBody(res);
    throw new SyncApiError(403, body?.error ?? "invalid_invite", "邀请码无效或已被使用");
  }
  if (!res.ok) {
    const body = await readErrorBody(res);
    throw new SyncApiError(res.status, body?.error, `注册失败（${res.status}）`);
  }
  const data = (await res.json()) as { syncCode?: unknown; authVersion?: unknown };
  if (authToken && data.authVersion === 2) {
    return { authVersion: 2 };
  }
  if (typeof data.syncCode !== "string" || !data.syncCode) {
    throw new SyncApiError(res.status, "invalid_response", "服务器未返回有效的同步码");
  }
  return { syncCode: data.syncCode };
}

export async function upgradeSyncAuth(
  legacySyncCode: string,
  newAuthToken: string,
  baseUrl = SYNC_API_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<boolean> {
  const base = requireBase(baseUrl);
  const res = await fetchWithTimeout(
    `${base}/api/auth/upgrade`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${legacySyncCode}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ newAuthToken }),
    },
    timeoutMs,
  );
  if (res.status === 401) throw new SyncAuthError();
  if (res.status === 404 || res.status === 405) return false;
  if (!res.ok) {
    const err = await readErrorBody(res);
    throw new SyncApiError(res.status, err?.error, `升级云端认证失败（${res.status}）`);
  }
  return true;
}

export async function pullSync(
  code: string,
  datasetId: string,
  ifNoneMatch?: string | null,
  baseUrl = SYNC_API_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<PullResult> {
  const base = requireBase(baseUrl);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${code}`,
  };
  if (ifNoneMatch) headers["If-None-Match"] = ifNoneMatch;
  const res = await fetchWithTimeout(
    `${base}/api/sync/${encodeURIComponent(datasetId)}`,
    { method: "GET", headers },
    timeoutMs,
  );
  if (res.status === 401) throw new SyncAuthError();
  if (res.status === 304) return { status: "not-modified" };
  if (res.status === 404) return { status: "missing" };
  if (!res.ok) {
    const body = await readErrorBody(res);
    throw new SyncApiError(res.status, body?.error, `拉取失败（${res.status}）`);
  }
  const body = await res.text();
  const etag = res.headers.get("ETag") ?? res.headers.get("etag") ?? "";
  return { status: "ok", body, etag };
}

export async function pushSync(
  code: string,
  datasetId: string,
  body: string,
  cond: { ifMatch: string } | { ifNoneMatchStar: true },
  baseUrl = SYNC_API_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ etag: string }> {
  const base = requireBase(baseUrl);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${code}`,
    "Content-Type": "application/json",
  };
  if ("ifMatch" in cond) headers["If-Match"] = cond.ifMatch;
  else headers["If-None-Match"] = "*";
  const res = await fetchWithTimeout(
    `${base}/api/sync/${encodeURIComponent(datasetId)}`,
    { method: "PUT", headers, body },
    timeoutMs,
  );
  if (res.status === 401) throw new SyncAuthError();
  if (res.status === 412) throw new SyncConflictError();
  if (!res.ok) {
    const err = await readErrorBody(res);
    throw new SyncApiError(res.status, err?.error, `上传失败（${res.status}）`);
  }
  const headerEtag = res.headers.get("ETag") ?? res.headers.get("etag") ?? "";
  let bodyEtag = "";
  try {
    const data = (await res.json()) as { etag?: unknown };
    if (typeof data?.etag === "string") bodyEtag = data.etag;
  } catch {
    /* header ETag suffices */
  }
  const etag = headerEtag || bodyEtag;
  return { etag };
}

export async function listHistory(
  code: string,
  datasetId: string,
  baseUrl = SYNC_API_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SyncHistoryItem[]> {
  const base = requireBase(baseUrl);
  const res = await fetchWithTimeout(
    `${base}/api/sync/${encodeURIComponent(datasetId)}/history`,
    { method: "GET", headers: { Authorization: `Bearer ${code}` } },
    timeoutMs,
  );
  if (res.status === 401) throw new SyncAuthError();
  if (res.status === 404) return [];
  if (!res.ok) {
    const err = await readErrorBody(res);
    throw new SyncApiError(res.status, err?.error, `获取历史版本失败（${res.status}）`);
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data.filter(
    (x): x is SyncHistoryItem =>
      !!x &&
      typeof x === "object" &&
      typeof (x as SyncHistoryItem).id === "string" &&
      ((typeof (x as SyncHistoryItem).at === "string" || typeof (x as SyncHistoryItem).at === "number")) &&
      typeof (x as SyncHistoryItem).size === "number",
  );
}

export async function getHistoryVersion(
  code: string,
  datasetId: string,
  id: string,
  baseUrl = SYNC_API_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  const base = requireBase(baseUrl);
  const res = await fetchWithTimeout(
    `${base}/api/sync/${encodeURIComponent(datasetId)}/history/${encodeURIComponent(id)}`,
    { method: "GET", headers: { Authorization: `Bearer ${code}` } },
    timeoutMs,
  );
  if (res.status === 401) throw new SyncAuthError();
  if (res.status === 404) throw new SyncApiError(404, "not_found", "该历史版本不存在");
  if (!res.ok) {
    const err = await readErrorBody(res);
    throw new SyncApiError(res.status, err?.error, `读取历史版本失败（${res.status}）`);
  }
  return await res.text();
}

export async function deleteAccount(
  code: string,
  baseUrl = SYNC_API_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  const base = requireBase(baseUrl);
  const res = await fetchWithTimeout(
    `${base}/api/account`,
    { method: "DELETE", headers: { Authorization: `Bearer ${code}` } },
    timeoutMs,
  );
  if (res.status === 401) throw new SyncAuthError();
  if (!res.ok) {
    const err = await readErrorBody(res);
    throw new SyncApiError(res.status, err?.error, `删除云端数据失败（${res.status}）`);
  }
}
