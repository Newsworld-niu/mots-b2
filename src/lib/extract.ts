/**
 * 从文章取词: find the words of a pasted French text, reduced to their dictionary form, and sort them into
 * words being learned already, atlas words not learned yet, words only the offline dictionary knows, and
 * words found nowhere. Each word keeps the first sentence it appears in, to be stored as an example.
 */
import type { Atlas, WordRef } from "../atlas/types";
import { foldAccents } from "./accent";
import type { DictHit } from "./dict";
import type { NearSuggestion } from "./near";
import type { UserExample } from "../store/store";

/** "new": not in the atlas, with a meaning from a word list or the AI (not the offline dictionary). */
export type CandidateKind = "learning" | "atlas" | "dict" | "new" | "unknown";

export interface Candidate {
  key: string;
  kind: CandidateKind;
  /** Atlas or custom word id (kinds learning / atlas). */
  id?: string;
  /** Dictionary entry (kind dict). */
  hit?: DictHit;
  /** Dictionary form shown and stored (vouloir for voulons). */
  word: string;
  zh: string;
  /** How many times the text uses it. */
  count: number;
  /** First sentence it appears in, and where (UTF-16 offsets into that sentence; absent when not known exactly). */
  sentence: string;
  span?: [number, number];
  /** Spellings met in the text. */
  forms: string[];
  /** Filled for words not in the atlas (word list, dictionary or AI). */
  pos?: string;
  ipa?: string;
  /** m / f, from the list's article or markers or the part of speech. */
  gender?: "m" | "f" | "";
  /** Examples printed in a word list or written by the AI (after the source sentence). */
  ex?: UserExample[];
  /** Atlas word: the sense the list's translation picked (stored as the deck's sense). */
  sense?: number;
  /** Atlas word: a translation from the list that matches none of its senses (stored as the deck's note). */
  deckNote?: string;
  /** Meaning printed in the list, as printed (possibly English): kept for the AI. */
  given?: string;
  /** Other notes from the list (f. heureuse …). */
  note?: string;
  /** An existing word spelled almost the same (accents) or with the other gender: maybe the same word. */
  near?: { id: string; word: string; zh: string; why: string };
  /** The AI thinks this is not a word to learn, or misspelled. */
  flag?: string;
  /** No atlas word, own word or dictionary entry confirms this spelling (maybe a scanning error). */
  unverified?: boolean;
  /** Real words spelled close to it (a scanning error: maisan → maison). */
  suggest?: NearSuggestion[];
  /** The page was hard to read here (said by the recognition). */
  unsure?: boolean;
  /** From the AI (when asked): collocations ("French｜中文") and a 注意点 for a new word. */
  col?: string[];
  fam?: string[];
  tip?: string;
  /** Where it came from. */
  src?: "text" | "list";
}

/** Function words a learner of this level knows: they would only crowd the list. */
export const FUNCTION_WORDS = new Set(
  (
    "le la les l un une des du de d au aux à a et ou mais donc or ni car que qu qui quoi dont où ce c cet cette ces " +
    "je j me m moi tu te t toi il ils elle elles on nous vous se s soi lui leur leurs y en ne n pas plus " +
    "mon ma mes ton ta tes son sa ses notre nos votre vos sur sous dans par pour avec sans chez vers entre " +
    "être est sont suis es sommes êtes était étaient été avoir ai as avons avez ont avait avaient eu " +
    "si très bien aussi comme tout tous toute toutes même autre autres quel quelle quels quelles selon"
  ).split(" "),
);

const fold = (s: string) => foldAccents(s.replace(/[’‘]/g, "'"));
const LETTERS = /[\p{L}]+(?:['’-][\p{L}]+)*/gu;
const ELISION = /^(?:l|d|j|m|t|s|n|c|qu|jusqu|lorsqu|puisqu|quoiqu)['’]/i;

/** Sentences of a text: split after . ! ? … and at line breaks; very long ones are kept whole. */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/\n+|(?<=[.!?…])\s+(?=[«"“A-ZÀ-ÖØ-Þ0-9])/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface Token {
  /** As written, without an elided article or pronoun (l'homme → homme). */
  t: string;
  /** Full token with its elision, for words spelled with an apostrophe (aujourd'hui). */
  whole: string;
  s: number;
  e: number;
  /** First word of its sentence (a capital there says nothing about a name). */
  first: boolean;
}

export function tokenize(sentence: string): Token[] {
  const out: Token[] = [];
  for (const m of sentence.matchAll(LETTERS)) {
    const whole = m[0];
    const el = ELISION.exec(whole);
    const t = el ? whole.slice(el[0].length) : whole;
    const s = m.index! + (el ? el[0].length : 0);
    if (t) out.push({ t, whole, s, e: s + t.length, first: out.length === 0 });
  }
  return out;
}

/** Atlas and custom words by folded headword (parenthesised notes removed: bande dessinée (BD) → bande dessinée). */
export function headwordIndex(atlas: Pick<Atlas, "words" | "custom">) {
  const map = new Map<string, WordRef[]>();
  for (const w of [...atlas.words, ...(atlas.custom ?? [])]) {
    const k = fold(w.word.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim());
    if (!k) continue;
    map.set(k, [...(map.get(k) ?? []), w]);
  }
  return map;
}

export async function extractWords(
  text: string,
  atlas: Pick<Atlas, "words" | "custom">,
  cards: Record<string, unknown>,
  lookup: (word: string) => Promise<DictHit[]>,
  opts: { skipFunctionWords?: boolean } = {},
): Promise<Candidate[]> {
  const skip = opts.skipFunctionWords ?? true;
  const index = headwordIndex(atlas);
  const phrases = [...index.entries()].filter(([k]) => k.includes(" ") && k.length >= 5 && !/qqn|qqch|etc/.test(k));
  const found = new Map<string, Candidate>();
  const order: string[] = [];
  const pending: { tok: Token; sentence: string }[] = [];

  const note = (key: string, make: () => Omit<Candidate, "count" | "forms" | "key">, form: string) => {
    const c = found.get(key);
    if (c) {
      c.count++;
      if (!c.forms.includes(form)) c.forms.push(form);
      return;
    }
    found.set(key, { key, count: 1, forms: [form], ...make() });
    order.push(key);
  };
  const atlasCandidate = (w: WordRef, sentence: string, span: [number, number] | undefined) => ({
    kind: (cards[w.id] ? "learning" : "atlas") as CandidateKind,
    id: w.id,
    word: w.word,
    zh: w.zh,
    sentence,
    span,
  });

  for (const sentence of splitSentences(text)) {
    const fs = fold(sentence);
    // expressions of the atlas (avoir besoin de) found in the sentence as written
    for (const [k, refs] of phrases) {
      const at = fs.indexOf(k);
      if (at < 0) continue;
      const before = fs[at - 1];
      const after = fs[at + k.length];
      if ((before && /\p{L}/u.test(before)) || (after && /\p{L}/u.test(after))) continue;
      // folding spells œ as oe: offsets are only exact when the folded sentence has the same length
      const span: [number, number] | undefined = fs.length === sentence.length ? [at, at + k.length] : undefined;
      note(refs[0].id, () => atlasCandidate(refs[0], sentence, span), span ? sentence.slice(...span) : k);
    }
    for (const tok of tokenize(sentence)) {
      const ft = fold(tok.t);
      if (ft.length < 2 || (skip && (FUNCTION_WORDS.has(ft) || FUNCTION_WORDS.has(tok.t.toLowerCase())))) continue;
      const direct = index.get(fold(tok.whole)) ?? index.get(ft);
      if (direct) {
        // the headword spelled exactly as written wins (marche, not marché); a capitalised word that only
        // matches without accents is a name (Marie, not marié), even first in its sentence: a real word keeps its accents
        const lower = tok.t.toLowerCase();
        const exact = direct.find((w) => w.word.toLowerCase() === lower || w.word.toLowerCase() === tok.whole.toLowerCase());
        if (!exact && /^\p{Lu}/u.test(tok.t)) continue;
        const w = exact ?? direct[0];
        const span: [number, number] = index.get(fold(tok.whole)) ? [tok.s - (tok.whole.length - tok.t.length), tok.e] : [tok.s, tok.e];
        note(w.id, () => atlasCandidate(w, sentence, span), tok.t);
        continue;
      }
      pending.push({ tok, sentence });
    }
  }

  // the rest go through the dictionary (inflected forms → lemma), in parallel
  const uniq = [...new Set(pending.map((p) => p.tok.t.toLowerCase()))];
  const results = new Map(await Promise.all(uniq.map(async (t) => [t, await lookup(t).catch(() => [])] as const)));
  for (const { tok, sentence } of pending) {
    const hits = results.get(tok.t.toLowerCase()) ?? [];
    const span: [number, number] = [tok.s, tok.e];
    // the lemma may be an atlas word (voulons → vouloir)
    const viaAtlas = hits.map((h) => index.get(fold(h.w))?.[0]).find((w): w is WordRef => !!w);
    if (viaAtlas) {
      note(viaAtlas.id, () => atlasCandidate(viaAtlas, sentence, span), tok.t);
      continue;
    }
    const hit = hits.find((h) => h.zh?.length) ?? hits[0];
    if (hit) {
      if (skip && FUNCTION_WORDS.has(fold(hit.w))) continue;
      note(`dict:${fold(hit.w)}`, () => ({ kind: "dict", hit, word: hit.w, zh: hit.zh?.map((g) => g[0]).slice(0, 3).join("；") ?? "", sentence, span }), tok.t);
      continue;
    }
    // a plural the dictionary does not list (hommes → homme), tried only after it: fois is not foi
    const sing = /[sx]$/.test(fold(tok.t)) ? index.get(fold(tok.t).slice(0, -1)) : undefined;
    if (sing) {
      note(sing[0].id, () => atlasCandidate(sing[0], sentence, span), tok.t);
      continue;
    }
    // a capitalised word the dictionary does not know, inside a sentence: a name (Marie, Lyon)
    if (!tok.first && /^\p{Lu}/u.test(tok.t)) continue;
    note(`unknown:${fold(tok.t)}`, () => ({ kind: "unknown", word: tok.t.toLowerCase() === tok.t || !tok.first ? tok.t : tok.t.toLowerCase(), zh: "", sentence, span }), tok.t);
  }
  return order.map((k) => found.get(k)!);
}
