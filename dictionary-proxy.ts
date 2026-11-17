/** Local dictionary forwarder. Remote HTML is returned as JSON, never served as a local document. */
import type { IncomingMessage, ServerResponse } from "node:http";

const MAX_BYTES = 2_000_000;

export function dictionaryConnectionError(error: unknown): string {
  const cause = (error as { cause?: { code?: string; message?: string } })?.cause;
  const code = cause?.code;
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return `本地服务无法解析法语助手域名（${code}）。请检查本机 DNS 和代理连接，或打开原文查看。`;
  if (code === "UND_ERR_CONNECT_TIMEOUT" || code === "ETIMEDOUT") return "本地服务连接法语助手超时。浏览器与本地服务可能使用不同的代理，请检查服务端网络。";
  if (code === "ECONNRESET" || code === "UND_ERR_SOCKET") return "连接法语助手时连接被中断，请稍后重试或打开原文查看。";
  if (code?.includes("CERT") || code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") return "本地服务无法验证法语助手的 HTTPS 证书，请检查代理的证书配置。";
  if (cause?.message === "unexpected redirect") return "法语助手返回了跳转地址，本地查询服务未跟随跳转，请打开原文查看。";
  return "本地服务无法连接法语助手，请检查网络或打开原文查看。";
}

export async function dictionaryProxy(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname !== "/dictionary-proxy") return next();
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const fail = (status: number, error: string) => {
    res.statusCode = status;
    res.end(JSON.stringify({ error }));
  };
  const origin = req.headers.origin;
  let allowed = req.headers["sec-fetch-site"] !== "cross-site";
  if (origin) {
    try { allowed = allowed && new URL(origin).host === req.headers.host; }
    catch { allowed = false; }
  }
  if (!allowed) return fail(403, "不允许其他网站调用本地词典服务。");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return fail(405, "词典查询只支持 GET 请求。");
  }
  const word = (url.searchParams.get("q") || "").trim().normalize("NFC");
  if (!word || word.length > 80) return fail(400, "请输入 1–80 个字符的单词或短语。");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const disconnect = () => { if (!res.writableEnded) controller.abort(); };
  res.on("close", disconnect);
  try {
    // Fixed host and path; browser cookies, Origin and Referer are never forwarded.
    const upstream = await fetch(`https://www.frdic.com/dicts/fr/${encodeURIComponent(word)}`, {
      headers: { Accept: "text/html", ...(req.headers["user-agent"] ? { "User-Agent": req.headers["user-agent"] } : {}) },
      signal: controller.signal,
      redirect: "manual",
    });
    // 法语助手 sends a lookup to its login page once the anonymous quota is used up, and for words it does not hold
    if (upstream.status >= 300 && upstream.status < 400) {
      await upstream.body?.cancel();
      const to = upstream.headers.get("location") ?? "";
      return fail(/login/i.test(to) ? 429 : 502, /login/i.test(to)
        ? "法语助手把这次查询转到了登录页：匿名查询有次数限制（短时间查得太多，或词条没有收录时都会这样）。稍等一会儿再试；查过的词会存在本机，不会再占次数。也可以打开原文登录后查看。"
        : "法语助手返回了跳转地址，本地查询服务未跟随跳转，请打开原文查看。");
    }
    if (!upstream.ok) {
      await upstream.body?.cancel();
      return fail(502, `法语助手返回错误（${upstream.status}），可打开原文查看或稍后重试。`);
    }
    if (!upstream.body) return fail(502, "法语助手未返回词典内容。");
    const reader = upstream.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        return fail(502, "词典返回内容过大，请打开原文查看。");
      }
      chunks.push(value);
    }
    if (!res.destroyed) res.end(JSON.stringify({ html: Buffer.concat(chunks).toString("utf8") }));
  } catch (error) {
    if (!res.destroyed) fail(controller.signal.aborted ? 504 : 502,
      controller.signal.aborted ? "连接法语助手超时，请稍后重试。" : dictionaryConnectionError(error));
  } finally {
    clearTimeout(timer);
    res.off("close", disconnect);
  }
}
