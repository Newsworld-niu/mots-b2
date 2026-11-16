import { CapacitorHttp } from "@capacitor/core";
import { isNative } from "./native";

export type DictionaryNode = string | { tag: string; children: DictionaryNode[]; src?: string; className?: string };
export interface FrdicResult { word: string; source: string; sections: { title: string; nodes: DictionaryNode[] }[] }
export function frdicUrl(word: string) {
  return `https://www.frdic.com/dicts/fr/${encodeURIComponent(word.trim().normalize("NFC"))}`;
}
export function dictionaryImage(src: string): string | null {
  try {
    const url = new URL(src, "https://www.frdic.com");
    return url.protocol === "https:" && url.hostname === "www.frdic.com" && !url.username && !url.password && /^\/tmp\/wordimg\/[^/]+\.png$/.test(url.pathname) ? url.href : null;
  } catch { return null; }
}
const tags = new Set(["div", "p", "span", "br", "b", "strong", "em", "i", "ul", "ol", "li", "h3", "h4", "h5", "sup", "sub"]);
// Map only known presentation roles to local styles; never copy arbitrary remote classes.
const presentationClasses = new Set(["cara", "exp", "eg", "trans", "key", "lj_item", "line", "explain-word-info", "eudic_wordtype_cont"]);
const dropped = new Set(["script", "style", "iframe", "object", "embed", "svg", "form", "input", "button", "noscript", "audio", "video"]);
/** Build a display-only tree: no remote markup, event handlers, styles or scripts are mounted. */
export function parseFrdic(html: string, word: string, parse = (text: string) => new DOMParser().parseFromString(text, "text/html")): FrdicResult {
  if (html.length > 2_000_000) throw new Error("词典返回内容过大，请打开原文查看。");
  const doc = parse(html);
  let count = 0;
  const read = (node: Node, depth = 0): DictionaryNode[] => {
    if (++count > 12000 || depth > 40) throw new Error("词典内容过于复杂，请打开原文查看。");
    if (node.nodeType === 3) return [node.nodeValue ?? ""];
    if (node.nodeType !== 1) return [];
    const el = node as Element, tag = el.tagName.toLowerCase();
    if (dropped.has(tag)) return [];
    if (tag === "img") {
      const src = dictionaryImage(el.getAttribute("src") ?? "");
      return src ? [{ tag: "img", src, children: [] }] : [];
    }
    const children = Array.from(el.childNodes).flatMap(n => read(n, depth + 1));
    const className = (el.getAttribute("class") ?? "").split(/\s+/)
      .filter(name => presentationClasses.has(name)).map(name => `frdic-${name}`).join(" ");
    if (tag === "w") return [{ tag: "div", className: "frdic-related-word", children }];
    return tags.has(tag) ? [{ tag, children, ...(className ? { className } : {}) }] : children;
  };
  const sections = [["ExpFCchild", "释义与用法"], ["ExpSYNchild", "近义、反义与派生"], ["ExpLJchild", "例句"]].flatMap(([id, title]) => {
    const el = doc.getElementById(id);
    return el && (el.textContent?.trim() || el.getElementsByTagName("img").length) ? [{ title, nodes: read(el) }] : [];
  });
  if (!sections.length) throw new Error("暂未找到可显示的词条，或词典页面结构已变化。请尝试原形，或打开法语助手原文查看。");
  return { word, source: frdicUrl(word), sections };
}
const cache = new Map<string, { at: number; data: FrdicResult }>();
export async function loadFrdic(word: string, signal: AbortSignal): Promise<FrdicResult> {
  const term = word.trim().normalize("NFC");
  if (!term || term.length > 80) throw new Error("请输入 1–80 个字符的单词或短语。");
  signal.throwIfAborted();
  const hit = cache.get(term);
  if (hit && Date.now() - hit.at < 600000) return hit.data;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 20000);
  try {
    let html: string;
    if (isNative()) {
      const r = await CapacitorHttp.get({ url: frdicUrl(term), connectTimeout: 15000, readTimeout: 20000, responseType: "text" });
      if (r.status !== 200) throw new Error(`词典暂时无法访问（${r.status}），请稍后重试。`);
      html = String(r.data);
    } else {
      const r = await fetch(`/dictionary-proxy?q=${encodeURIComponent(term)}`, { signal: controller.signal, credentials: "omit" });
      if (r.status === 404 || (r.ok && r.headers.get("content-type")?.includes("text/html"))) {
        // Static hosting has no local forwarder. Keep direct access as a best-effort fallback.
        const direct = await fetch(frdicUrl(term), { signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer" });
        if (!direct.ok) throw new Error(`法语助手拒绝了网页直连请求（${direct.status}）。请使用本地服务启动页面，或打开原文查看。`);
        html = await direct.text();
      } else {
        const data = await r.json().catch(() => null) as { html?: unknown; error?: unknown } | null;
        if (!r.ok) throw new Error(typeof data?.error === "string" ? data.error : `词典查询服务暂时无法访问（${r.status}），可打开原文查看。`);
        if (typeof data?.html !== "string") throw new Error("词典查询服务未返回有效内容，请打开原文查看。");
        html = data.html;
      }
    }
    signal.throwIfAborted();
    controller.signal.throwIfAborted();
    const data = parseFrdic(html, term);
    if (cache.size >= 30) cache.delete(cache.keys().next().value!);
    cache.set(term, { at: Date.now(), data });
    return data;
  } catch (error) {
    if (signal.aborted) throw error;
    if (controller.signal.aborted) throw new Error("查询超时，请稍后重试。");
    if (error instanceof TypeError) throw new Error("无法连接法语助手，请检查网络后重试，或打开原文查看。");
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}
