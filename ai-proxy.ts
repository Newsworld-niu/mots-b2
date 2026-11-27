/**
 * Local forwarder for the AI features (npm run dev / npm run preview only; a static build has none).
 * The browser cannot call most AI services directly (CORS), so it calls /ai-proxy/<service>/<path> on this
 * server, which forwards the request to a fixed upstream. Keys stay in the browser and pass through in the
 * request headers; nothing is stored or logged here. Only the services below can be reached (no open proxy),
 * and only pages served by this same server may use it.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

const UPSTREAM: Record<string, (rest: string) => string | null> = {
  openai: (rest) => `https://api.openai.com/${rest}`,
  deepseek: (rest) => `https://api.deepseek.com/${rest}`,
  anthropic: (rest) => `https://api.anthropic.com/${rest}`,
  openrouter: (rest) => `https://openrouter.ai/${rest}`,
  // /ai-proxy/gemini/v1beta/models/<model>:streamGenerateContent?alt=sse (the key travels in x-goog-api-key)
  gemini: (rest) => `https://generativelanguage.googleapis.com/${rest}`,
  // /ai-proxy/azure/<region>/<path> → https://<region>.tts.speech.microsoft.com/<path>
  azure: (rest) => {
    const m = rest.match(/^([a-z0-9]{2,30})\/(.*)$/);
    return m ? `https://${m[1]}.tts.speech.microsoft.com/${m[2]}` : null;
  },
  // /ai-proxy/azurestt/<region>/<path> → https://<region>.stt.speech.microsoft.com/<path> (pronunciation assessment)
  azurestt: (rest) => {
    const m = rest.match(/^([a-z0-9]{2,30})\/(.*)$/);
    return m ? `https://${m[1]}.stt.speech.microsoft.com/${m[2]}` : null;
  },
};

/** Request headers that describe this hop, not the upstream request. */
const DROP_REQ = new Set(["host", "origin", "referer", "cookie", "connection", "content-length", "accept-encoding", "sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest", "sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform", "priority"]);
/** Response headers that fetch has already handled (decompression, chunking) or that belong to the upstream origin. */
const DROP_RES = new Set(["content-encoding", "content-length", "transfer-encoding", "connection", "set-cookie", "access-control-allow-origin", "access-control-allow-credentials", "strict-transport-security"]);

const MAX_BODY = 40 * 1024 * 1024;

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** A page of this server: no Origin header (same-origin GET) or an Origin whose host is this server's host. */
function sameOrigin(req: IncomingMessage) {
  const origin = req.headers.origin;
  if (!origin) return req.headers["sec-fetch-site"] !== "cross-site";
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

export async function aiProxy(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = req.url || "";
  if (!url.startsWith("/ai-proxy/")) return next();
  if (!sameOrigin(req)) {
    res.statusCode = 403;
    res.end("forbidden");
    return;
  }
  const rest = url.slice("/ai-proxy/".length);
  if (rest === "ping") {
    res.setHeader("Content-Type", "application/json");
    res.end('{"ok":true}');
    return;
  }
  const slash = rest.indexOf("/");
  const service = slash < 0 ? rest : rest.slice(0, slash);
  const target = UPSTREAM[service]?.(slash < 0 ? "" : rest.slice(slash + 1));
  if (!target) {
    res.statusCode = 404;
    res.end("unknown service");
    return;
  }
  try {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) if (!DROP_REQ.has(k) && typeof v === "string") headers[k] = v;
    const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
    const ctrl = new AbortController();
    res.on("close", () => !res.writableEnded && ctrl.abort());
    const up = await fetch(target, { method: req.method, headers, body: body ? new Uint8Array(body) : undefined, signal: ctrl.signal, redirect: "error" });
    res.statusCode = up.status;
    up.headers.forEach((v, k) => !DROP_RES.has(k) && res.setHeader(k, v));
    res.setHeader("Cache-Control", "no-store");
    if (!up.body) return res.end();
    const reader = up.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (e) {
    // a stream cut off midway must not look like a complete 200 answer: drop the socket without emitting an unhandled 'error' event
    if (res.headersSent) {
      if (!res.destroyed) res.destroy();
      return;
    }
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: { message: `转发失败：${(e as Error).message}` } }));
  }
}
