/**
 * Same-origin forwarder for 法语助手 (frdic.com) lookups, ported from dictionary-proxy.ts (the Vite dev middleware)
 * to the Fetch API. Remote HTML is returned inside JSON, never served as a document of this origin.
 */

export const DICTIONARY_MAX_BYTES = 2_000_000;
export const DICTIONARY_TIMEOUT_MS = 15_000;
export const DICTIONARY_RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;
const MAX_RATE_BUCKETS = 4096;

const buckets = new Map<string, { count: number; resetAt: number }>();

export function resetDictionaryRateLimits(): void {
  buckets.clear();
}

function rateLimited(ip: string, now = Date.now()): number | null {
  if (buckets.size >= MAX_RATE_BUCKETS) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    while (buckets.size >= MAX_RATE_BUCKETS) {
      const oldest = buckets.keys().next().value;
      if (oldest === undefined) break;
      buckets.delete(oldest);
    }
  }
  const cur = buckets.get(ip);
  if (!cur || cur.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return null;
  }
  if (cur.count >= DICTIONARY_RATE_LIMIT) return Math.max(1, Math.ceil((cur.resetAt - now) / 1000));
  cur.count++;
  return null;
}

function json(status: number, data: unknown, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  });
}

const fail = (status: number, error: string, extra?: Record<string, string>) => json(status, { error }, extra);

function isSameOrigin(request: Request, url: URL): boolean {
  const site = request.headers.get("Sec-Fetch-Site");
  if (site !== null && site !== "same-origin" && site !== "none") return false;
  const origin = request.headers.get("Origin");
  if (origin === null) return true;
  try {
    return new URL(origin).origin === url.origin;
  } catch {
    return false;
  }
}

export interface DictionaryProxyOptions {
  /** Upstream fetch (tests inject a stub). */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export async function handleDictionaryProxy(request: Request, options: DictionaryProxyOptions = {}): Promise<Response> {
  const url = new URL(request.url);
  if (!isSameOrigin(request, url)) return fail(403, "不允许其他网站调用词典服务。");
  if (request.method.toUpperCase() !== "GET") {
    return fail(405, "词典查询只支持 GET 请求。", { Allow: "GET" });
  }
  const ip = request.headers.get("CF-Connecting-IP")?.trim() || "unknown";
  const retryAfter = rateLimited(ip);
  if (retryAfter !== null) {
    return fail(429, "查询太频繁了，请稍等一会儿再试。", { "Retry-After": String(retryAfter) });
  }
  const word = (url.searchParams.get("q") || "").trim().normalize("NFC");
  if (!word || word.length > 80) return fail(400, "请输入 1–80 个字符的单词或短语。");

  const doFetch = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DICTIONARY_TIMEOUT_MS);
  try {
    // Fixed host and path; browser cookies, Origin and Referer are never forwarded.
    const ua = request.headers.get("User-Agent");
    const upstream = await doFetch(`https://www.frdic.com/dicts/fr/${encodeURIComponent(word)}`, {
      headers: { Accept: "text/html", ...(ua ? { "User-Agent": ua } : {}) },
      signal: controller.signal,
      redirect: "manual",
    });
    // 法语助手 sends a lookup to its login page once the anonymous quota is used up, and for words it does not hold.
    if (upstream.status >= 300 && upstream.status < 400) {
      await upstream.body?.cancel();
      const to = upstream.headers.get("location") ?? "";
      return /login/i.test(to)
        ? fail(429, "法语助手把这次查询转到了登录页：匿名查询有次数限制（短时间查得太多，或词条没有收录时都会这样）。稍等一会儿再试；查过的词会存在本机，不会再占次数。也可以打开原文登录后查看。")
        : fail(502, "法语助手返回了跳转地址，查询服务未跟随跳转，请打开原文查看。");
    }
    if (!upstream.ok) {
      await upstream.body?.cancel();
      return fail(502, `法语助手返回错误（${upstream.status}），可打开原文查看或稍后重试。`);
    }
    if (!upstream.body) return fail(502, "法语助手未返回词典内容。");
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let html = "";
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > DICTIONARY_MAX_BYTES) {
        await reader.cancel();
        return fail(502, "词典返回内容过大，请打开原文查看。");
      }
      html += decoder.decode(value, { stream: true });
    }
    html += decoder.decode();
    return json(200, { html });
  } catch {
    return controller.signal.aborted
      ? fail(504, "连接法语助手超时，请稍后重试。")
      : fail(502, "无法连接法语助手，请检查网络或打开原文查看。");
  } finally {
    clearTimeout(timer);
  }
}
