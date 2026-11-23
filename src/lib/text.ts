/** Highlight span of an example: [start, end) in the example text, found at build time (scripts/build-highlights.py). */
export type Span = [number, number];

/**
 * Fallback when an example has no precomputed span: the headword or expression spelled exactly (any case,
 * spaces and apostrophes flexible), optionally with a plural / feminine ending, as a whole word.
 * Inflected verb forms (veux for vouloir) are only found through the precomputed span.
 */
export function headwordPattern(word: string) {
  const w = word.trim().replace(/\([^)]*\)/g, " ").replace(/’/g, "'").replace(/\s+/g, " ").trim();
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const body = w
    .split(" ")
    .map((tok) => esc(tok).replace(/'/g, "['’]"))
    .join("\\s+");
  return new RegExp(`(?<![\\p{L}])(${body}(?:s|x|e|es)?)(?![\\p{L}])`, "iu");
}

export function splitHighlight(sentence: string, word: string, span?: Span | null): [string, string, string] | null {
  if (span && span[0] >= 0 && span[1] > span[0] && span[1] <= sentence.length) return [sentence.slice(0, span[0]), sentence.slice(span[0], span[1]), sentence.slice(span[1])];
  const m = headwordPattern(word).exec(sentence);
  if (!m) return null;
  return [sentence.slice(0, m.index), m[0], sentence.slice(m.index + m[0].length)];
}

/**
 * Where a learner-written example uses the headword, for words without a build-time span:
 * the spelling (plus a plural / feminine ending) first, then a word that starts with the headword's stem
 * (a verb without -er / -ir / -re: parler → parlons) and adds at most four letters. Stems under four letters are not tried.
 */
export function locateWord(sentence: string, word: string): Span | undefined {
  const m = headwordPattern(word).exec(sentence);
  if (m) return [m.index, m.index + m[0].length];
  const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const f = fold(word.trim());
  if (/\s/.test(f)) return undefined;
  const stem = /(er|ir|re)$/.test(f) && f.length > 4 ? f.slice(0, -2) : f;
  if (stem.length < 4) return undefined;
  for (const t of sentence.matchAll(/\p{L}+/gu)) {
    const ft = fold(t[0]);
    if (ft.startsWith(stem) && ft.length - stem.length <= 4) return [t.index!, t.index! + t[0].length];
  }
  return undefined;
}

export function gap(sentence: string, word: string, span?: Span | null) {
  const parts = splitHighlight(sentence, word, span);
  return parts ? { before: parts[0], hidden: parts[1], after: parts[2] } : null;
}

export const normalize = (s: string) =>
  s
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/[‐‑–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export function shuffle<T>(xs: T[], seed = Math.random() * 2 ** 31): T[] {
  const out = [...xs];
  let x = Math.floor(seed) || 1;
  for (let i = out.length - 1; i > 0; i--) {
    x = (Math.imul(1664525, x) + 1013904223) >>> 0;
    const j = x % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Collocations are stored as "english｜中文". */
export const splitPair = (s: string) => {
  const [en, zh] = s.split(/[｜|]/);
  return { en: (en || "").trim(), zh: (zh || "").trim() };
};

export const plural = (n: number) => n.toLocaleString("en-US");

export type WordRegister = "soutenu" | "courant" | "familier";

export const REGISTER_LABELS: Record<WordRegister, string> = {
  soutenu: "正式 soutenu",
  courant: "中性 courant",
  familier: "口语 familier",
};

export const REGISTER_CHOICES: { value: WordRegister; label: string; hint: string }[] = [
  { value: "soutenu", label: "soutenu", hint: "正式 / 书面语" },
  { value: "courant", label: "courant", hint: "中性 / 通用语" },
  { value: "familier", label: "familier", hint: "口语 / 非正式" },
];
