/**
 * Picking from lookups (the home page search): what can go on a card from the offline dictionary and 法语助手,
 * what the card can hold, and the form's starting content made from the picks.
 */
import { GAP, type FrdicItem, type FrdicKind } from "./frdic";
import type { DictHit } from "./dict";
import { MAX_COLLOCATIONS, MAX_EXAMPLES, MAX_OWN_SENSES, MAX_RELATED, type OwnSense, type UserExample } from "../store/store";

export interface Pick {
  key: string;
  origin: "dict" | "frdic";
  kind: FrdicKind;
  fr: string;
  zh: string;
  pos: string;
  /** Offline dictionary examples: where the headword sits, and that the sentence is Tatoeba's. */
  hl?: [number, number];
  tatoeba?: boolean;
}

/** The kinds a card holds, and how many of each (the first meaning is the card's own gloss, the rest are 其他意思). */
export const CAPACITY: Record<FrdicKind, number> = {
  sense: 1 + MAX_OWN_SENSES,
  example: MAX_EXAMPLES,
  phrase: MAX_COLLOCATIONS,
  family: MAX_RELATED,
  syn: MAX_RELATED,
  ant: MAX_RELATED,
  note: 3,
};
export const KIND_LABEL: Record<FrdicKind, string> = { sense: "释义", example: "例句", phrase: "搭配与短语", family: "派生词（词族）", syn: "近义词", ant: "反义词", note: "助记与词根" };
export const KINDS: FrdicKind[] = ["sense", "example", "phrase", "family", "syn", "ant", "note"];

export const hasGap = (p: Pick) => p.zh.includes(GAP);

/**
 * Why a pick cannot go on a card as it is: the card stores a meaning up to 300 characters, an example 400,
 * a collocation 100 + 50, a related word 80 + 38. Longer text is never cut silently; the pick is refused instead.
 */
export function tooLong(p: Pick): string {
  const over = (n: number, max: number, what: string) => (n > max ? `${what}超过卡片的 ${max} 字` : "");
  switch (p.kind) {
    case "sense": return over(p.zh.length, 300, "释义");
    case "example": return over(p.fr.length, 400, "法语句子") || over(p.zh.length, 400, "中文");
    case "phrase": return over(p.fr.length, 100, "法语") || over(p.zh.length, 50, "中文");
    case "family": return over(p.fr.length, 80, "法语") || over(p.zh.length, 38, "中文");
    case "syn":
    case "ant": return over(p.fr.length, 120, "词");
    case "note": return over(p.zh.length, 300, "内容");
  }
}

/** The offline dictionary's glosses and examples, one pick each (every gloss, not only the first few). */
export function dictPicks(hits: DictHit[]): Pick[] {
  const out: Pick[] = [];
  const seen = new Set<string>();
  hits.forEach((h, i) => {
    for (const [zh, label] of h.zh ?? []) {
      const key = `dict|${i}|sense|${zh}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, origin: "dict", kind: "sense", fr: label || "", zh, pos: h.p });
    }
    for (const [fr, zh, a, b] of h.ex ?? []) out.push({ key: `dict|${i}|example|${fr}`, origin: "dict", kind: "example", fr, zh, pos: h.p, hl: [a, b], tatoeba: true });
  });
  return out;
}

export const frdicPicks = (items: FrdicItem[]): Pick[] => items.map((x, i) => ({ key: `frdic|${i}`, origin: "frdic", kind: x.kind, fr: x.fr, zh: x.zh, pos: x.pos }));

export interface Seed {
  w: string;
  pos: string;
  zh: string;
  ipa: string;
  senses: OwnSense[];
  ex: UserExample[];
  col: string[];
  fam: string[];
  syn: string[];
  ant: string[];
  note: string;
}

/** The form's starting content from what was picked (in the order they were picked). */
export function buildSeed(word: string, picks: Pick[], hit?: DictHit): Seed {
  const of = (k: FrdicKind) => picks.filter((p) => p.kind === k);
  const [first, ...rest] = of("sense");
  const pair = (p: Pick) => (p.zh.trim() ? `${p.fr}｜${p.zh}` : p.fr);
  return {
    w: hit?.w ?? word,
    pos: first?.pos || hit?.p || "",
    zh: first?.zh ?? "",
    ipa: hit?.ipa ?? "",
    senses: rest.map((p) => ({ pos: p.pos, zh: p.zh })),
    ex: of("example").map((p) => ({ fr: p.fr, zh: p.zh, ...(p.tatoeba ? { src: "tatoeba" as const } : {}), ...(p.hl ? { hl: p.hl } : {}) })),
    col: of("phrase").map(pair),
    fam: of("family").map(pair),
    syn: of("syn").map((p) => p.fr),
    ant: of("ant").map((p) => p.fr),
    note: of("note").map((p) => p.zh).join("\n"),
  };
}

/** A pick whose Chinese the AI completed (see ai/tasks completeGaps). */
export const withZh = (p: Pick, zh: string): Pick => ({ ...p, zh });
