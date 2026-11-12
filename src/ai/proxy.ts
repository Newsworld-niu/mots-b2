/**
 * How the AI services are reached.
 *  - In a browser under npm run dev / preview: through the local forwarder (ai-proxy.ts).
 *  - In a browser on a static deployment (GitHub Pages), where no forwarder exists: straight to the service.
 *    All of them accept cross-origin requests from a browser.
 *  - In the Android app: straight to the service through the system's HTTP stack (CapacitorHttp), which has no
 *    such restriction. Keys still live on the device only and go out in the request headers.
 */
import { CapacitorHttp } from "@capacitor/core";
import { isNative } from "../lib/native";

const BASE = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : "/").replace(/\/$/, "");

/** The same fixed upstreams as ai-proxy.ts. */
const UPSTREAM: Record<string, string> = {
  openai: "https://api.openai.com",
  deepseek: "https://api.deepseek.com",
  anthropic: "https://api.anthropic.com",
  openrouter: "https://openrouter.ai",
};

export class AiError extends Error {}

/** The service's own address, for the app. Azure paths start with the region: /<region>/<path>. */
export function directUrl(service: string, path = "") {
  if (service === "azure") {
    const m = path.match(/^\/([a-z0-9]{2,30})(\/.*)?$/);
    if (!m) throw new AiError("Azure 语音服务的区域不对");
    return `https://${m[1]}.tts.speech.microsoft.com${m[2] ?? ""}`;
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
export const proxyUrl = (service: string, path = "") => (isNative() || direct ? directUrl(service, path) : forwarderUrl(service, path));

let ping: Promise<boolean> | null = null;
/**
 * Whether the local forwarder answers (checked once per visit; never asked in the app, which has none).
 * Without it requests go straight to the services.
 */
export function proxyAvailable() {
  if (isNative()) return Promise.resolve(false);
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
 * A CapacitorHttp answer as a fetch Response. With responseType "arraybuffer" the body comes back as: JSON already
 * parsed, an error body as text, anything else as base64.
 */
export function toResponse(res: NativeResponse): Response {
  const out = new Headers();
  let type = "";
  for (const [k, v] of Object.entries(res.headers ?? {})) {
    // Android reports the status line under a null key
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

/**
 * fetch() over the system's HTTP stack. The whole answer arrives at once (no streaming), and a request cannot be
 * cancelled on the wire: an abort only stops waiting for it.
 */
async function nativeFetch(url: string, init?: RequestInit): Promise<Response> {
  const signal = init?.signal ?? undefined;
  if (signal?.aborted) throw aborted();
  const body = init?.body;
  if (body != null && typeof body !== "string") throw new AiError("应用里的请求只支持文本内容");
  const headers: Record<string, string> = {};
  // CapacitorHttp decides how to write the body from the "Content-Type" header, spelled this way
  new Headers(init?.headers).forEach((v, k) => (headers[k === "content-type" ? "Content-Type" : k] = v));
  const request = CapacitorHttp.request({
    url,
    method: init?.method ?? "GET",
    headers,
    data: body ?? undefined,
    responseType: "arraybuffer",
    connectTimeout: 30_000,
    readTimeout: 600_000,
  });
  const res = await (signal
    ? Promise.race([request, new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(aborted()), { once: true }))])
    : request);
  return toResponse(res);
}

/** fetch for the AI services: the browser's own in a browser, the system's in the app. */
export const aiFetch: typeof fetch = (input, init) => (isNative() ? nativeFetch(input instanceof Request ? input.url : String(input), init) : fetch(input, init));

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
