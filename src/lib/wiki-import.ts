import { CapacitorHttp } from "@capacitor/core";
import { isNative } from "./native";
export interface WikiItem {
  kind: "sense" | "example" | "family";
  fr: string;
  zh: string;
  pos: string;
}
export interface WikiImport {
  title: string;
  source: string;
  items: WikiItem[];
}
const plain = (s: string) =>
  s
    .replace(/<!--[^]*?-->/g, "")
    .replace(/<ref\b[^]*?<\/ref>|<ref[^>]*\/>/g, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, "$1")
    .replace(/\{\{([^{}]*)\}\}/g, (_, inside: string) => {
      const p = inside.split("|");
      if (["lien", "l", "lien-ancre"].includes(p[0])) return p[1] ?? "";
      if (["m", "f", "mf", "pluriel", "singulier"].includes(p[0])) return "";
      if (p[0] === "source") return ` (${p.slice(1).join(" ")})`;
      return "";
    })
    .replace(/''+/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
/** Only the French section, dictionary definitions, examples, and explicit derivational relations. */
export function parseWiki(
  text: string,
  title: string,
  revision: number,
): WikiImport {
  const items: WikiItem[] = [];
  let french = false,
    kind = "",
    pos = "";
  for (const line of text.split("\n")) {
    if (/^==[^=]/.test(line)) {
      french = /\{\{langue\|fr\}\}/.test(line);
      kind = "";
      continue;
    }
    if (!french) continue;
    const heading = line.match(/^={3,}\s*\{\{S\|([^|}]+)/);
    if (heading) {
      const h = heading[1];
      kind = /^(dérivés|apparentés)$/.test(h)
        ? "family"
        : /^(nom|verbe|adjectif|adverbe|préposition|pronom|conjonction|interjection)/.test(
              h,
            )
          ? "sense"
          : "";
      pos =
        (
          {
            nom: "n.",
            verbe: "v.",
            adjectif: "adj.",
            adverbe: "adv.",
            préposition: "prép.",
            pronom: "pron.",
            conjonction: "conj.",
            interjection: "interj.",
          } as Record<string, string>
        )[h] ?? "";
      continue;
    }
    let item: WikiItem | undefined;
    if (kind === "sense" && /^#(?![#*:])/.test(line))
      item = {
        kind: "sense",
        fr: plain(line.replace(/^#\s*/, "")),
        zh: "",
        pos,
      };
    else if (kind === "sense" && /^#\*(?![:*])/.test(line))
      item = {
        kind: "example",
        fr: plain(line.replace(/^#\*\s*/, "")),
        zh: "",
        pos,
      };
    else if (kind === "family" && /^\*/.test(line)) {
      const term = line.match(
        /\{\{(?:lien|l)\|([^|}]+)|\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/,
      );
      if (term)
        item = {
          kind: "family",
          fr: (term[1] ?? term[3] ?? term[2]).trim(),
          zh: "",
          pos: "",
        };
    }
    if (
      item?.fr &&
      !/[{}]/.test(item.fr) &&
      !items.some(
        (x) =>
          x.kind === item!.kind && x.pos === item!.pos && x.fr === item!.fr,
      )
    )
      items.push(item);
  }
  return {
    title,
    source: `https://fr.wiktionary.org/w/index.php?${new URLSearchParams({ title, oldid: String(revision) })}`,
    items: items.slice(0, 100),
  };
}
export async function loadWiki(
  word: string,
  signal: AbortSignal,
): Promise<WikiImport> {
  const params = new URLSearchParams({
    action: "parse",
    page: word.trim(),
    prop: "wikitext|revid",
    redirects: "1",
    format: "json",
    formatversion: "2",
    origin: "*",
  });
  const url = `https://fr.wiktionary.org/w/api.php?${params}`;
  let data;
  if (isNative()) {
    const r = await CapacitorHttp.get({
      url,
      connectTimeout: 15000,
      readTimeout: 20000,
    });
    if (r.status !== 200) throw new Error(`词典请求失败（${r.status}）`);
    data = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
  } else {
    const timeout = new AbortController();
    const abort = () => timeout.abort();
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    const timer = setTimeout(abort, 20000);
    try {
      const r = await fetch(url, { signal: timeout.signal });
      if (!r.ok) throw new Error(`词典请求失败（${r.status}）`);
      data = await r.json();
    } catch (e) {
      if (timeout.signal.aborted && !signal.aborted)
        throw new Error("词典请求超时，请稍后重试。");
      throw e;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    }
  }
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  if (
    data.error ||
    typeof data.parse?.wikitext !== "string" ||
    typeof data.parse.title !== "string" ||
    !Number.isSafeInteger(data.parse.revid) ||
    data.parse.revid <= 0
  )
    throw new Error("未找到可导入的词条，请试试词典原形或打开原文搜索。");
  const out = parseWiki(
    data.parse.wikitext,
    data.parse.title,
    data.parse.revid,
  );
  if (!out.items.length)
    throw new Error("未识别到可导入的法语内容，请打开词典原文查看。");
  return out;
}
