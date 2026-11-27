/**
 * How the AI services are reached.
 *  - In a browser under npm run dev / preview: through the local forwarder (ai-proxy.ts).
 *  - In a browser on a static deployment (GitHub Pages), where no forwarder exists: straight to the service.
 *    All of them accept cross-origin requests from a browser.
 */
import { DEFAULT_MODELS, sanitizeBaseUrl } from "./config";

const BASE = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : "/").replace(/\/$/, "");

/** The same fixed upstreams as ai-proxy.ts. */
const UPSTREAM: Record<string, string> = {
  openai: "https://api.openai.com",
  deepseek: "https://api.deepseek.com",
  anthropic: "https://api.anthropic.com",
  openrouter: "https://openrouter.ai",
  gemini: "https://generativelanguage.googleapis.com",
};

export class AiError extends Error {}

/** The service's own address, for the app. Azure paths (azure: speech synthesis, azurestt: recognition) start with the region: /<region>/<path>. */
export function directUrl(service: string, path = "") {
  if (service === "azure") {
    const m = path.match(/^\/([a-z0-9]{2,30})(\/.*)?$/);
    if (!m) throw new AiError("Azure 语音服务的区域不对");
    return `https://${m[1]}.tts.speech.microsoft.com${m[2] ?? ""}`;
  }
  if (service === "azurestt") {
    const m = path.match(/^\/([a-z0-9]{2,30})(\/.*)?$/);
    if (!m) throw new AiError("Azure 语音服务的区域不对");
    return `https://${m[1]}.stt.speech.microsoft.com${m[2] ?? ""}`;
  }
  const host = UPSTREAM[service];
  if (!host) throw new AiError(`未知的服务：${service}`);
  return `${host}${path}`;
}

const forwarderUrl = (service: string, path = "") => `${typeof location === "undefined" ? "" : location.origin}${BASE}/ai-proxy/${service}${path}`;

/** Set once proxyAvailable() has found no forwarder: the browser then calls the services itself. */
let direct = false;

/**
 * Where a request for a service goes: the local forwarder in a browser that has one, otherwise the service itself.
 * Await proxyAvailable() first, so that the forwarder has been looked for.
 */
export const proxyUrl = (service: string, path = "") => (direct ? directUrl(service, path) : forwarderUrl(service, path));

/**
 * Resolve an OpenAI-compatible endpoint URL: uses a custom `baseUrl` directly (supporting bare origins
 * as well as `/v1` or `/compatible-mode/v1` prefixes without doubling `/v1`), or falls back to OpenAI proxy/direct.
 */
export function resolveOpenAiEndpoint(baseUrl: string, endpoint: "/chat/completions" | "/models" | "/images/generations" | "/audio/transcriptions"): string {
  const clean = baseUrl.trim().replace(/\/+$/, "");
  if (!clean) return proxyUrl("openai", `/v1${endpoint}`);
  try {
    const u = new URL(clean);
    const hasPath = u.pathname && u.pathname !== "/";
    return `${clean}${hasPath ? "" : "/v1"}${endpoint}`;
  } catch {
    return proxyUrl("openai", `/v1${endpoint}`);
  }
}

/**
 * Resolve a Gemini REST endpoint. `path` starts with `/` (e.g. `/models?pageSize=100`).
 *  - no custom base: the forwarder (or, with `forceDirect` / no forwarder, Google itself) under `/v1beta`
 *  - a custom base (relay, reverse proxy, Cloudflare AI Gateway `.../google-ai-studio`): `/v1beta` is appended
 *    unless the base already ends in `/v1beta` or `/v1`
 */
export function resolveGeminiEndpoint(baseUrl: string, path: string, opts?: { forceDirect?: boolean }): string {
  if (!baseUrl.trim()) return opts?.forceDirect ? directUrl("gemini", `/v1beta${path}`) : proxyUrl("gemini", `/v1beta${path}`);
  const clean = sanitizeBaseUrl(baseUrl);
  if (!clean) throw new AiError("Gemini 自定义接口地址须以 https:// 或本机 http://localhost / 127.0.0.1 开头");
  return /\/v1(?:beta)?$/i.test(new URL(clean).pathname) ? `${clean}${path}` : `${clean}/v1beta${path}`;
}

/** A Gemini model id for the REST path: no `models/` or `google/` prefix, no path characters; the default when empty. */
export function normalizeGeminiModel(model: string): string {
  const m = String(model ?? "")
    .trim()
    .replace(/^(?:models|google)\//i, "")
    .replace(/[^\w.-]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+/, "");
  return m || DEFAULT_MODELS.gemini;
}

/** Remove API keys a service may echo back (Google keys, sk-* keys, `key=` query parameters, or literal `secret`) from text shown to the learner. */
export function redactSecrets(s: string, secret?: string): string {
  let out = s
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, "AIza***")
    .replace(/sk-[0-9A-Za-z_-]{10,}/g, "sk-***")
    .replace(/key=[^&\s"']+/gi, "key=***");
  const trimmed = secret?.trim();
  if (trimmed && trimmed.length >= 6) out = out.split(trimmed).join("***");
  return out;
}

let ping: Promise<boolean> | null = null;
/**
 * Whether the local forwarder answers (checked once per visit; never asked in the app, which has none).
 * Without it requests go straight to the services.
 */
export function proxyAvailable() {
  ping ??= fetch(forwarderUrl("ping"))
    // a static host may answer any path with a page: only the forwarder's own JSON counts
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => j?.ok === true)
    .catch(() => false)
    .then((ok) => {
      direct = !ok;
      return ok;
    });
  return ping;
}

const aborted = () => new DOMException("The operation was aborted.", "AbortError");

function fromBase64(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Response headers that no longer describe the body once the system has read and decoded it. */
const DROP_RES = new Set(["content-encoding", "content-length", "transfer-encoding"]);

export interface NativeResponse {
  status: number;
  headers?: Record<string, unknown>;
  data?: unknown;
}

/**
 * Convert a buffered response structure into a standard Fetch API Response (retained for test compatibility).
 */
export function toResponse(res: NativeResponse): Response {
  const out = new Headers();
  let type = "";
  for (const [k, v] of Object.entries(res.headers ?? {})) {
    if (!k || k === "null" || DROP_RES.has(k.toLowerCase())) continue;
    if (k.toLowerCase() === "content-type") type = String(v);
    try {
      out.set(k, String(v));
    } catch {
      /* not a valid header for fetch: skip */
    }
  }
  const data = res.data;
  let payload: BodyInit | null;
  if (data == null || data === "" || [204, 205, 304].includes(res.status)) payload = null;
  else if (typeof data !== "string") payload = JSON.stringify(data);
  else if (res.status >= 400 || /json/i.test(type)) payload = data;
  else payload = fromBase64(data);
  return new Response(payload, { status: res.status, headers: out });
}

/** fetch for the AI services via the browser's native Fetch API. */
export const aiFetch: typeof fetch = (input, init) => fetch(input, init);

/** Execute `fetcher` with an explicit timeout composed with any caller AbortSignal. */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number,
  serviceLabel = "AI 服务",
  fetcher: typeof fetch = aiFetch,
): Promise<Response> {
  const caller = init?.signal;
  if (caller?.aborted) throw aborted();
  const ctrl = new AbortController();
  let timedOut = false;
  const onAbort = () => ctrl.abort();
  caller?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, timeoutMs);
  try {
    return await fetcher(input, { ...init, signal: ctrl.signal });
  } catch (err) {
    if (timedOut) {
      throw new AiError(`${serviceLabel} 请求超时（超过 ${Math.round(timeoutMs / 1000)} 秒未响应），请检查网络或切换接口`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
    caller?.removeEventListener("abort", onAbort);
  }
}

/**
 * One deadline for a whole request: the fetch and every later read of its body or stream. Once it times out or the
 * caller aborts, a pending `wrapRead` rejects at once (after running `onCancel`, e.g. `reader.cancel()`), with a
 * clear timeout AiError or an AbortError. Call `cleanup()` when done.
 */
export function createRequestDeadline(callerSignal: AbortSignal | undefined, timeoutMs: number, serviceLabel = "AI 服务") {
  const ctrl = new AbortController();
  let timedOut = false;
  const onAbort = () => ctrl.abort();
  if (callerSignal?.aborted) ctrl.abort();
  else callerSignal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, timeoutMs);
  const error = () =>
    timedOut ? new AiError(`${serviceLabel} 请求超时（超过 ${Math.round(timeoutMs / 1000)} 秒未完成），请检查网络或切换接口`) : aborted();
  function wrapRead<T>(promise: Promise<T>, onCancel?: () => void): Promise<T> {
    const cancel = () => {
      try {
        onCancel?.();
      } catch {
        /* already closed */
      }
    };
    if (ctrl.signal.aborted) {
      promise.catch(() => undefined);
      cancel();
      return Promise.reject(error());
    }
    return new Promise<T>((resolve, reject) => {
      const stop = () => {
        cancel();
        reject(error());
      };
      ctrl.signal.addEventListener("abort", stop, { once: true });
      promise.then(
        (v) => {
          ctrl.signal.removeEventListener("abort", stop);
          resolve(v);
        },
        (e) => {
          ctrl.signal.removeEventListener("abort", stop);
          reject(ctrl.signal.aborted ? error() : e);
        },
      );
    });
  }
  const cleanup = () => {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", onAbort);
  };
  return { signal: ctrl.signal, wrapRead, cleanup };
}

/** The JSON object in a model's answer (tolerates ``` fences and text around the object). */
export function parseJsonAnswer(text: string, service: string) {
  const t = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf("{");
    const b = t.lastIndexOf("}");
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(t.slice(a, b + 1));
      } catch {
        /* fall through */
      }
    }
    throw new AiError(`${service} 返回的不是有效的 JSON（可能输出太长被截断，试试少放一些内容）`);
  }
}

/** A readable message from an error response of any of the services. */
export async function errorFrom(r: Response, service: string) {
  let detail = "";
  try {
    const t = await r.text();
    try {
      const j = JSON.parse(t);
      detail = j?.error?.message || j?.message || j?.error || t;
    } catch {
      detail = t;
    }
  } catch {
    /* no body */
  }
  const hint = r.status === 401 || r.status === 403 ? "（Key 不对或没有权限）" : r.status === 429 ? "（请求太频繁或额度用完）" : r.status === 404 ? "（地址或模型名不对）" : "";
  return new AiError(`${service} 返回 ${r.status}${hint}${detail ? `：${String(detail).slice(0, 300)}` : ""}`);
}
