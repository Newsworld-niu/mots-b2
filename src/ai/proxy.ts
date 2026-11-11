/** The local forwarder (ai-proxy.ts) exists only under npm run dev / preview. */
const BASE = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : "/").replace(/\/$/, "");

export const proxyUrl = (service: string, path = "") => `${typeof location === "undefined" ? "" : location.origin}${BASE}/ai-proxy/${service}${path}`;

let ping: Promise<boolean> | null = null;
/** Whether the forwarder answers (checked once per visit). */
export function proxyAvailable() {
  ping ??= fetch(proxyUrl("ping"))
    .then((r) => r.ok)
    .catch(() => false);
  return ping;
}

export class AiError extends Error {}

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
