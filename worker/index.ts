/**
 * Cloudflare Worker for mots-b2: the cloud-sync API (/api/*) on R2, R2-backed media, the dictionary forwarder and
 * history-style deep links for the hash-routed SPA. Everything else is served by the static assets binding.
 */
import { readBodyWithLimit } from "../server/src/lib/body-limit.js";
import { buildBaseHeaders, handleRequest, type HandlerEnv } from "../server/src/lib/handlers.js";
import { handleDictionaryProxy } from "./dictionary.js";
import { handleMediaRequest } from "./media.js";
import { R2ObjStore } from "./r2-store.js";

export interface Env {
  ASSETS: Fetcher;
  SYNC_BUCKET: R2Bucket;
  MEDIA_BUCKET: R2Bucket;
  /** Worker secret (wrangler secret put ADMIN_KEY); enables POST /api/invites. */
  ADMIN_KEY?: string;
  ALLOWED_ORIGINS?: string;
  RATE_LIMIT_DISABLED?: string;
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
};

/** First path segments the SPA understands (see resolvePathnameToHash in src/lib/router.ts). */
const SPA_PAGES = new Set([
  "atlas",
  "dict",
  "learn",
  "practice",
  "mock",
  "speak",
  "listen",
  "examread",
  "essay",
  "real",
  "drill",
  "expr",
  "reflow",
  "read",
  "conj",
  "grammar",
  "compare",
  "me",
  "about",
  "decks",
  "lounge",
  "w",
]);
/** Pages that take a second path segment (/grammar/<id>, /dict/<word>, /w/<word>). */
const SPA_DEEP_PAGES = new Set(["dict", "grammar", "w"]);

export const STATIC_EXT_RE =
  /\.(?:js|mjs|css|json|png|jpg|jpeg|webp|svg|ico|mp3|m4a|aac|ogg|oga|wav|mp4|webm|m4v|webmanifest|txt|vtt|map|woff2?)$/i;

export function isSpaRoute(pathname: string): boolean {
  const seg = pathname.split("/").filter(Boolean);
  if (seg.length === 0 || !SPA_PAGES.has(seg[0])) return false;
  if (seg[0] === "w") return seg.length === 2;
  if (seg.length === 1) return true;
  return SPA_DEEP_PAGES.has(seg[0]) && seg.length === 2;
}

function withSecurityHeaders(res: Response, extra?: Record<string, string>): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
  if (extra) for (const [k, v] of Object.entries(extra)) out.headers.set(k, v);
  return out;
}

function jsonError(status: number, error: string, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const handlerEnv: HandlerEnv = {
    ADMIN_KEY: env.ADMIN_KEY,
    ALLOWED_ORIGINS: env.ALLOWED_ORIGINS,
    RATE_LIMIT_DISABLED: env.RATE_LIMIT_DISABLED,
    SELF_ORIGIN: url.origin,
  };
  try {
    const res = await handleRequest(
      {
        method: request.method,
        path: url.pathname,
        headers: request.headers,
        clientIp: request.headers.get("CF-Connecting-IP")?.trim() || undefined,
        readBody: (max) => readBodyWithLimit(request, max),
      },
      new R2ObjStore(env.SYNC_BUCKET),
      handlerEnv,
    );
    const nullBody = res.status === 204 || res.status === 304;
    return new Response(nullBody ? null : (res.body ?? null), { status: res.status, headers: res.headers });
  } catch (err) {
    console.error(`sync API error (${request.method} ${url.pathname}): ${err instanceof Error ? err.message : "unknown"}`);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...buildBaseHeaders({ headers: request.headers }, handlerEnv), "Content-Type": "application/json; charset=utf-8" },
    });
  }
}

/** Serve index.html for a history-style deep link; the router rewrites it to the matching #/ route on load. */
async function serveAppShell(request: Request, env: Env): Promise<Response> {
  const shell = await env.ASSETS.fetch(new Request(new URL("/", request.url), { method: request.method }));
  const type = shell.headers.get("Content-Type") ?? "";
  if (shell.status !== 200 || !/text\/html/i.test(type)) {
    shell.body?.cancel().catch(() => undefined);
    return withSecurityHeaders(
      new Response("Not Found", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      }),
    );
  }
  return withSecurityHeaders(shell, { "Cache-Control": "no-cache" });
}

export async function handleFetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (path === "/api" || path.startsWith("/api/")) {
    return withSecurityHeaders(await handleApi(request, env, url));
  }
  if (path === "/ai-proxy" || path.startsWith("/ai-proxy/")) {
    // No public AI relay in production: the app sees a non-OK ping and calls the AI services directly.
    return withSecurityHeaders(jsonError(404, "not_found"));
  }
  if (path === "/dictionary-proxy") {
    return withSecurityHeaders(await handleDictionaryProxy(request));
  }
  if (path.startsWith("/media/") || path.startsWith("/atlas/audio/") || path.startsWith("/lexdb/")) {
    return withSecurityHeaders(await handleMediaRequest(request, env.MEDIA_BUCKET, ctx));
  }
  if ((method === "GET" || method === "HEAD") && isSpaRoute(path)) {
    if (STATIC_EXT_RE.test(path)) return withSecurityHeaders(await env.ASSETS.fetch(request));
    return serveAppShell(request, env);
  }
  return withSecurityHeaders(await env.ASSETS.fetch(request));
}

export default {
  fetch: (request, env, ctx) => handleFetch(request, env, ctx),
} satisfies ExportedHandler<Env>;
