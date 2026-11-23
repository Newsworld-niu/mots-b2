export type DictionaryNode = string | { tag: string; children: DictionaryNode[]; src?: string; className?: string };
/**
 * One thing a learner can pick from the page for a card. 法语助手 draws many Chinese characters as pictures, so
 * their text is not there to copy: each missing character is written GAP (□) and the item is a "gap" item.
 */
export type FrdicKind = "sense" | "example" | "phrase" | "family" | "syn" | "ant" | "note";
export interface FrdicItem { kind: FrdicKind; fr: string; zh: string; pos: string }
export interface FrdicResult { word: string; source: string; sections: { title: string; nodes: DictionaryNode[] }[]; items: FrdicItem[] }
export const GAP = "□";
export const LOGIN_MESSAGE = "法语助手把这次查询转到了登录页：匿名查询有次数限制（短时间查得太多，或词条没有收录时都会这样）。稍等一会儿再试；查过的词会存在本机，不会再占次数。也可以打开原文登录后查看。";
export function canAutoFetchFrdic(): boolean {
  if (typeof window === "undefined") return false;
  return /^(?:localhost|127\.0\.0\.1|\[::1\])$/i.test(window.location.hostname);
}
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

const kids = (n: Node) => Array.from(n.childNodes);
const tagOf = (n: Node) => (n.nodeType === 1 ? (n as Element).tagName.toLowerCase() : "");
const classesOf = (n: Node) => ((n as Element).getAttribute?.("class") ?? "").split(/\s+/).filter(Boolean);
const isPicture = (n: Node) => !!dictionaryImage((n as Element).getAttribute?.("src") ?? "");
/** Text of a node; every picture character becomes GAP. */
function plainText(n: Node): string {
  if (n.nodeType === 3) return n.nodeValue ?? "";
  if (n.nodeType !== 1) return "";
  const tag = tagOf(n);
  if (dropped.has(tag)) return "";
  if (tag === "img") return isPicture(n) ? GAP : "";
  if (tag === "br") return " ";
  return kids(n).map(plainText).join("");
}
const squash = (t: string) => t.replace(/\s+/g, " ").trim();
const CJK = /[\u3400-\u9fff□]/;
const LATIN = /[A-Za-zÀ-ÿŒœ]/;
const OPEN = /[[（(【〈《<]/;
/** French first, then Chinese: cut at the first Chinese character (or GAP), keeping an opening bracket with the Chinese. */
export function splitFrZh(text: string): [string, string] {
  const at = text.search(CJK);
  if (at < 0) return [text.trim(), ""];
  let i = at;
  while (i > 0 && OPEN.test(text[i - 1])) i--;
  return [text.slice(0, i).trim(), text.slice(i).trim()];
}
export function normPos(raw: string): string {
  const t = raw.toLowerCase().replace(/[\s.]/g, "");
  if (/^n(m|\.?m)$|^nm/.test(t)) return "n.m.";
  if (/^nf/.test(t)) return "n.f.";
  if (/^n/.test(t)) return "n.";
  if (/^v/.test(t)) return "v.";
  if (/^adj/.test(t)) return "adj.";
  if (/^ad/.test(t)) return "adv.";
  if (/^prép|^prep/.test(t)) return "prép.";
  if (/^conj/.test(t)) return "conj.";
  if (/^pron/.test(t)) return "pron.";
  if (/^interj/.test(t)) return "interj.";
  return "";
}
const isSentence = (fr: string) => /[.!?…»"]$/.test(fr) || fr.split(/\s+/).length >= 6;
const stripNumber = (t: string) => t.replace(/^(?:\d+\s*[.．、]|[（(]\d+[)）]|[①-⑳])\s*/, "").replace(/[：:]\s*$/, "").trim();

/** The 释义与用法 block as lines tagged by their innermost role (cara = part of speech, exp = meaning, eg = example). */
function lineItems(root: Node): FrdicItem[] {
  const lines: { cls: string; text: string }[] = [];
  let cur = { cls: "", text: "" };
  const flush = () => {
    const text = squash(cur.text);
    if (text) lines.push({ cls: cur.cls, text });
    cur = { cls: "", text: "" };
  };
  const walk = (n: Node, cls: string) => {
    if (n.nodeType === 3) {
      const v = n.nodeValue ?? "";
      if (v.trim() && !cur.cls) cur.cls = cls;
      cur.text += v;
      return;
    }
    if (n.nodeType !== 1) return;
    const tag = tagOf(n);
    if (dropped.has(tag) || tag === "a") return;
    if (tag === "br") return flush();
    if (tag === "img") {
      if (isPicture(n)) { if (!cur.cls) cur.cls = cls; cur.text += GAP; }
      return;
    }
    const own = ["cara", "exp", "eg"].find((k) => classesOf(n).includes(k)) ?? cls;
    for (const k of kids(n)) walk(k, own);
  };
  walk(root, "");
  flush();
  const out: FrdicItem[] = [];
  let pos = "";
  let lead = "";
  let last: FrdicItem | undefined;
  for (const { cls, text } of lines) {
    if (cls === "cara") { pos = normPos(text); lead = ""; last = undefined; continue; }
    if (cls === "exp") {
      if (/^[一二三四五六七八九十]+[．.、]/.test(text)) continue;
      const sub = /^[（(]\d+[)）]/.test(text);
      const body = stripNumber(text);
      if (!body) continue;
      if (LATIN.test(body) && !CJK.test(body)) { lead = body; last = undefined; continue; }
      last = undefined;
      if (sub && lead) out.push({ kind: "phrase", fr: lead, zh: body, pos });
      else { lead = ""; out.push({ kind: "sense", fr: "", zh: body, pos }); }
      continue;
    }
    if (cls === "eg") {
      if (!LATIN.test(text) && last && !last.zh) { last.zh = text; continue; }
      const [head, zh] = splitFrZh(text);
      const fr = head.replace(/^[（(]\d+[)）]\s*/, "");
      if (!fr || !LATIN.test(fr)) continue;
      last = { kind: isSentence(fr) ? "example" : "phrase", fr, zh, pos };
      out.push(last);
    }
  }
  return out;
}

const HEAD = (n: Node) => squash(plainText(n)).replace(/[：:\s]/g, "");
/** 近义、反义与派生: related words, usage patterns and the mnemonic. */
function relatedItems(root: Node): FrdicItem[] {
  const out: FrdicItem[] = [];
  let label = "";
  const walk = (n: Node) => {
    if (n.nodeType !== 1) return;
    const tag = tagOf(n);
    if (dropped.has(tag) || classesOf(n).includes("eudic_wordtype_cont")) return;
    if (tag === "h5") { label = HEAD(n); return; }
    if (tag === "div") {
      const h = kids(n).find((k) => tagOf(k) === "h5");
      const own = h ? HEAD(h) : "";
      if (/助记|词根/.test(own)) {
        const body = squash(kids(n).filter((k) => k !== h).map(plainText).join(""));
        if (body) out.push({ kind: "note", fr: "", zh: `${own}：${body}`, pos: "" });
        return;
      }
    }
    if (tag === "li") {
      const text = squash(plainText(n));
      if (/用法/.test(label)) {
        const [fr, zh] = splitFrZh(text);
        if (fr) out.push({ kind: "phrase", fr, zh, pos: "" });
      } else if (/派生|变化|同根|衍生/.test(label)) {
        const link = kids(n).find((k) => tagOf(k) === "a");
        const fr = link ? squash(plainText(link)) : splitFrZh(text)[0];
        if (fr) out.push({ kind: "family", fr, zh: squash(text.replace(fr, "")), pos: "" });
      }
      return;
    }
    if (tag === "a" && ((n as Element).getAttribute("href") ?? "").startsWith("/dicts/fr/")) {
      const fr = squash(plainText(n));
      const kind: FrdicKind | "" = /近义/.test(label) ? "syn" : /反义/.test(label) ? "ant" : /派生|变化|同根|衍生/.test(label) ? "family" : "";
      if (fr && kind) out.push({ kind, fr, zh: "", pos: "" });
      return;
    }
    for (const k of kids(n)) walk(k);
  };
  walk(root);
  return out;
}

/** 法语例句库: sentence pairs. */
function corpusItems(root: Node): FrdicItem[] {
  const out: FrdicItem[] = [];
  const walk = (n: Node) => {
    if (n.nodeType !== 1) return;
    if (classesOf(n).includes("lj_item")) {
      let fr = "", zh = "";
      const find = (m: Node) => {
        if (m.nodeType !== 1) return;
        const c = classesOf(m);
        if (tagOf(m) === "p" && c.includes("line")) fr = squash(plainText(m));
        else if (tagOf(m) === "p" && c.includes("exp")) zh = squash(plainText(m));
        else kids(m).forEach(find);
      };
      find(n);
      if (fr) out.push({ kind: "example", fr, zh, pos: "" });
      return;
    }
    kids(n).forEach(walk);
  };
  walk(root);
  return out;
}

/** What can be picked from a page, without repeats and without the headword itself among its relatives. */
export function frdicItems(doc: Document, word: string): FrdicItem[] {
  const parts = [
    [doc.getElementById("ExpFCchild"), lineItems],
    [doc.getElementById("ExpSYNchild"), relatedItems],
    [doc.getElementById("ExpLJchild"), corpusItems],
  ] as const;
  const seen = new Set<string>();
  const head = word.trim().toLowerCase();
  const out: FrdicItem[] = [];
  const count: Partial<Record<FrdicKind, number>> = {};
  const MAX: Record<FrdicKind, number> = { sense: 40, example: 40, phrase: 40, family: 24, syn: 30, ant: 20, note: 4 };
  for (const [el, read] of parts) {
    if (!el) continue;
    for (const item of read(el)) {
      if ((count[item.kind] ?? 0) >= MAX[item.kind]) continue;
      if ((item.kind === "family" || item.kind === "syn" || item.kind === "ant") && item.fr.toLowerCase() === head) continue;
      const key = `${item.kind}|${item.fr}|${item.zh}`;
      if (seen.has(key)) continue;
      seen.add(key);
      count[item.kind] = (count[item.kind] ?? 0) + 1;
      out.push(item);
    }
  }
  return out;
}

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
  if (!sections.length) {
    if (/<title>[^<]*登录/.test(html)) throw new Error(LOGIN_MESSAGE);
    throw new Error("暂未找到可显示的词条，或词典页面结构已变化。请尝试原形，或打开法语助手原文查看。");
  }
  return { word, source: frdicUrl(word), sections, items: frdicItems(doc, word) };
}
const cache = new Map<string, { at: number; data: FrdicResult }>();
// Looked-up pages are kept on this device: 法语助手 limits anonymous lookups, so a word seen once is never asked twice.
const STORE_KEY = "frdic-pages-v2";
const KEEP = 60;
const KEEP_MS = 30 * 86400000;
type Saved = Record<string, { at: number; data: FrdicResult }>;
function savedPages(): Saved {
  try {
    if (typeof window === "undefined") return {};
    return JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "{}") as Saved;
  } catch { return {}; }
}
function savePage(term: string, data: FrdicResult) {
  try {
    if (typeof window === "undefined") return;
    const all = savedPages();
    all[term] = { at: Date.now(), data };
    const newest = Object.entries(all).filter(([, v]) => Date.now() - v.at < KEEP_MS).sort((a, b) => b[1].at - a[1].at).slice(0, KEEP);
    for (let n = newest.length; n > 0; n = Math.floor(n / 2)) {
      try { window.localStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(newest.slice(0, n)))); return; } catch { /* too big: keep fewer pages */ }
    }
  } catch { /* storage full or unavailable: the memory cache still works */ }
}
export async function loadFrdic(word: string, signal: AbortSignal): Promise<FrdicResult> {
  const term = word.trim().normalize("NFC");
  if (!term || term.length > 80) throw new Error("请输入 1–80 个字符的单词或短语。");
  signal.throwIfAborted();
  const hit = cache.get(term);
  if (hit && Date.now() - hit.at < 600000) return hit.data;
  const saved = savedPages()[term];
  if (saved?.data?.items && Date.now() - saved.at < KEEP_MS) return saved.data;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 20000);
  try {
    let html: string;
    const base = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : "/").replace(/\/?$/, "/");
    const r = await fetch(`${base}dictionary-proxy?q=${encodeURIComponent(term)}`, { signal: controller.signal, credentials: "omit", cache: "no-store" });
    if (r.status === 404 || (r.ok && r.headers.get("content-type")?.includes("text/html"))) {
      // Static hosting has no local forwarder. Keep direct access as a best-effort fallback.
      const direct = await fetch(frdicUrl(term), { signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer", redirect: "manual" });
      if (direct.type === "opaqueredirect") throw new Error(LOGIN_MESSAGE);
      if (!direct.ok) throw new Error(`法语助手拒绝了网页直连请求（${direct.status}）。请使用本地服务启动页面，或打开原文查看。`);
      html = await direct.text();
    } else {
      const data = await r.json().catch(() => null) as { html?: unknown; error?: unknown } | null;
      if (!r.ok) throw new Error(typeof data?.error === "string" ? data.error : `词典查询服务暂时无法访问（${r.status}），可打开原文查看。`);
      if (typeof data?.html !== "string") throw new Error("词典查询服务未返回有效内容，请打开原文查看。");
      html = data.html;
    }
    signal.throwIfAborted();
    controller.signal.throwIfAborted();
    const data = parseFrdic(html, term);
    if (cache.size >= 30) cache.delete(cache.keys().next().value!);
    cache.set(term, { at: Date.now(), data });
    savePage(term, data);
    return data;
  } catch (error) {
    if (signal.aborted) throw error;
    if (controller.signal.aborted) throw new Error("查询超时，请稍后重试。", { cause: error });
    if (error instanceof TypeError) throw new Error("无法连接法语助手，请检查网络后重试，或打开原文查看。", { cause: error });
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}
