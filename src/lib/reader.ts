/**
 * 阅读: a saved text (pasted, imported, or written by the AI around the learner's words), cut into paragraphs,
 * sentences and words, each word matched to the atlas or the offline dictionary and given a status
 * (没学过 / 在学 / 已掌握 …) so the page can colour it and open it on a click.
 */
import type { Atlas, WordRef } from "../atlas/types";
import { foldAccents } from "./accent";
import type { DictHit } from "./dict";
import { FUNCTION_WORDS, headwordIndex, splitSentences, tokenize } from "./extract";

/* ---------- saved texts ---------- */

export interface QuizItem {
  /** Question and options in Chinese: they check understanding, not the reading of the question. */
  q: string;
  options: string[];
  /** Index of the right option. */
  answer: number;
  why: string;
}

export interface SavedText {
  id: string;
  title: string;
  text: string;
  created: number;
  /** paste: typed or pasted; file: a file, photo or scan; ai: written by the AI for the learner's words. */
  src: "paste" | "file" | "ai";
  /** AI texts: the level asked for (A1 … B2), the Chinese translation, the questions and the word ids it was written around. */
  level?: string;
  zh?: string;
  quiz?: QuizItem[];
  targets?: string[];
  /** When the learner marked it read. */
  read?: number;
}

export const MAX_TEXTS = 60;
export const MAX_TEXT_LENGTH = 12000;
export const TEXT_ID = /^t-[a-z0-9]{4,24}$/;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function sanitizeQuiz(v: unknown): QuizItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(isObj)
    .map((x) => {
      const options = Array.isArray(x.options) ? x.options.map((o) => str(o, 200)).filter(Boolean).slice(0, 4) : [];
      return { q: str(x.q, 300), options, answer: typeof x.answer === "number" ? Math.round(x.answer) : -1, why: str(x.why, 400) };
    })
    .filter((x) => x.q && x.options.length >= 2 && new Set(x.options).size === x.options.length && x.answer >= 0 && x.answer < x.options.length)
    .slice(0, 5);
}

/** Saved texts from stored data or a backup (untrusted): newest first, at most MAX_TEXTS. */
export function sanitizeTexts(v: unknown): SavedText[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const seen = new Set<string>();
  const out: SavedText[] = [];
  for (const x of v) {
    if (!isObj(x) || typeof x.id !== "string" || !TEXT_ID.test(x.id) || seen.has(x.id)) continue;
    const text = typeof x.text === "string" ? x.text.replace(/\r/g, "").trim().slice(0, MAX_TEXT_LENGTH) : "";
    if (!text) continue;
    seen.add(x.id);
    const t: SavedText = {
      id: x.id,
      title: str(x.title, 80) || titleOf(text),
      text,
      created: typeof x.created === "number" && Number.isFinite(x.created) && x.created > 0 ? x.created : 0,
      src: x.src === "ai" || x.src === "file" ? x.src : "paste",
    };
    if (/^[ABC][12]$/.test(x.level as string)) t.level = x.level as string;
    const zh = typeof x.zh === "string" ? x.zh.trim().slice(0, MAX_TEXT_LENGTH) : "";
    if (zh) t.zh = zh;
    const quiz = sanitizeQuiz(x.quiz);
    if (quiz.length) t.quiz = quiz;
    if (Array.isArray(x.targets)) {
      const ids = x.targets.filter((i): i is string => typeof i === "string" && i.length <= 80).slice(0, 20);
      if (ids.length) t.targets = ids;
    }
    if (typeof x.read === "number" && Number.isFinite(x.read) && x.read > 0) t.read = x.read;
    out.push(t);
    if (out.length >= MAX_TEXTS) break;
  }
  return out.length ? out : undefined;
}

/** A title for a text that has none: its first line, cut at a word. */
export function titleOf(text: string, max = 40) {
  const line = text.trim().split("\n")[0].trim();
  if (line.length <= max) return line;
  const cut = line.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${(at > max / 2 ? cut.slice(0, at) : cut).replace(/[\s,;:«"(]+$/, "")}…`;
}

/* ---------- words of a text ---------- */

/**
 * new: in the atlas or the dictionary, not learned yet; learning: has a card; known: card mastered;
 * unknown: found nowhere; function: a function word (never coloured); name: a proper name (not a word to learn).
 */
export type WordStatus = "new" | "learning" | "known" | "unknown" | "function" | "name";

export interface ReadToken {
  /** As written, [s, e) in its sentence. */
  t: string;
  s: number;
  e: number;
  status: WordStatus;
  /** Atlas or own word. */
  id?: string;
  /** Offline dictionary entry, for a word the atlas does not have. */
  hit?: DictHit;
}

export interface ReadSentence {
  text: string;
  tokens: ReadToken[];
}

const fold = (s: string) => foldAccents(s.replace(/[’‘]/g, "'"));
const CLITIC = /(?:-t)?-(?:je|tu|il|elle|on|nous|vous|ils|elles|ce|ci|là|moi|toi|lui|leur|le|la|les|y|en)$/i;

/**
 * Paragraphs → sentences → words. `statusOf` says how well an atlas word is known; words the atlas lacks go
 * through the dictionary (`lookup`), where an inflected form leads to its lemma (voulons → vouloir).
 * The matching follows 从文章取词 (extract.ts): the headword spelled as written wins, a capitalised word that
 * only matches without accents is a name.
 */
export async function annotate(
  text: string,
  atlas: Pick<Atlas, "words" | "custom">,
  statusOf: (id: string) => "new" | "learning" | "known",
  lookup: (word: string) => Promise<DictHit[]>,
): Promise<ReadSentence[][]> {
  const index = headwordIndex(atlas);
  const paragraphs = text
    .replace(/\r/g, "")
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => splitSentences(p).map((s): ReadSentence => ({ text: s, tokens: [] })));
  const pending: { tok: ReadToken; first: boolean }[] = [];
  const isFunction = (t: string) => FUNCTION_WORDS.has(fold(t)) || FUNCTION_WORDS.has(t.toLowerCase());
  const settle = (tok: ReadToken, w: WordRef) => {
    tok.id = w.id;
    tok.status = isFunction(tok.t) ? "function" : statusOf(w.id);
  };

  for (const para of paragraphs)
    for (const sentence of para)
      for (const raw of tokenize(sentence.text)) {
        const whole = index.get(fold(raw.whole));
        let direct = whole ?? index.get(fold(raw.t));
        // an inverted or attached pronoun is not part of the word: dit-il → dit, a-t-elle → a, celui-ci → celui
        let t = raw.t;
        if (!direct) {
          for (let m = CLITIC.exec(t); m && m.index > 0; m = CLITIC.exec(t)) t = t.slice(0, m.index);
          if (t !== raw.t) direct = index.get(fold(t));
        }
        const tok: ReadToken = whole
          ? { t: raw.whole, s: raw.e - raw.whole.length, e: raw.e, status: "unknown" }
          : { t, s: raw.s, e: raw.s + t.length, status: "unknown" };
        sentence.tokens.push(tok);
        if (direct) {
          const lower = t.toLowerCase();
          const exact = direct.find((w) => w.word.toLowerCase() === lower || w.word.toLowerCase() === raw.whole.toLowerCase());
          if (!exact && /^\p{Lu}/u.test(raw.t)) tok.status = "name";
          else settle(tok, exact ?? direct[0]);
          continue;
        }
        pending.push({ tok, first: raw.first });
      }

  const uniq = [...new Set(pending.map((p) => p.tok.t.toLowerCase()))];
  const results = new Map(await Promise.all(uniq.map(async (t) => [t, await lookup(t).catch(() => [] as DictHit[])] as const)));
  for (const { tok, first } of pending) {
    const hits = results.get(tok.t.toLowerCase()) ?? [];
    const viaAtlas = hits.map((h) => index.get(fold(h.w))?.[0]).find((w): w is WordRef => !!w);
    if (viaAtlas) {
      settle(tok, viaAtlas);
      continue;
    }
    const hit = hits.find((h) => h.zh?.length) ?? hits[0];
    if (hit) {
      tok.hit = hit;
      tok.status = isFunction(tok.t) || FUNCTION_WORDS.has(fold(hit.w)) ? "function" : "new";
      continue;
    }
    const f = fold(tok.t);
    const sing = /[sx]$/.test(f) ? index.get(f.slice(0, -1)) : undefined;
    if (sing) settle(tok, sing[0]);
    else if (isFunction(tok.t) || f.length < 2) tok.status = "function";
    else if (!first && /^\p{Lu}/u.test(tok.t)) tok.status = "name";
  }
  return paragraphs;
}

export interface ReadStats {
  /** Distinct words by status (function words and names left out). */
  new: number;
  learning: number;
  known: number;
  unknown: number;
}

/** How hard the text is for this learner: distinct words by status. */
export function readStats(paragraphs: ReadSentence[][]): ReadStats {
  const seen = new Map<string, WordStatus>();
  for (const p of paragraphs)
    for (const s of p)
      for (const t of s.tokens) {
        if (t.status === "function" || t.status === "name") continue;
        seen.set(t.id ?? (t.hit ? `dict:${fold(t.hit.w)}` : `?:${fold(t.t)}`), t.status);
      }
  const out: ReadStats = { new: 0, learning: 0, known: 0, unknown: 0 };
  for (const st of seen.values()) if (st !== "function" && st !== "name") out[st]++;
  return out;
}

/** Which of the words a text was written around are really in it. */
export function coverage(paragraphs: ReadSentence[][], targets: string[]) {
  const present = new Set<string>();
  for (const p of paragraphs) for (const s of p) for (const t of s.tokens) if (t.id) present.add(t.id);
  return { used: targets.filter((id) => present.has(id)), missing: targets.filter((id) => !present.has(id)) };
}

/** Share of the words (function words and names aside) that neither the atlas nor the dictionary knows. */
export function unknownShare(paragraphs: ReadSentence[][]) {
  let all = 0;
  let unknown = 0;
  for (const p of paragraphs)
    for (const s of p)
      for (const t of s.tokens) {
        if (t.status === "function" || t.status === "name") continue;
        all++;
        if (t.status === "unknown") unknown++;
      }
  return all ? unknown / all : 0;
}

/**
 * Words for the AI to write a text around: recent mistakes first, then cards that are due (most overdue first),
 * then the cards seen last. Single words and expressions alike, at most `n`.
 */
export function pickTargets(cards: Record<string, { due: number; last?: number }>, mistakes: string[], usable: (id: string) => boolean, now: number, n = 10): string[] {
  const out: string[] = [];
  const add = (id: string) => {
    if (out.length < n && cards[id] && usable(id) && !out.includes(id)) out.push(id);
  };
  mistakes.forEach(add);
  const ids = Object.keys(cards);
  ids.filter((id) => cards[id].due <= now).sort((a, b) => cards[a].due - cards[b].due).forEach(add);
  ids.sort((a, b) => (cards[b].last ?? 0) - (cards[a].last ?? 0)).forEach(add);
  return out;
}
