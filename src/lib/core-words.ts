/**
 * 会用 / 认得: the words a B2 learner must be able to use in writing and speaking (core), and the rest, which only
 * need to be understood. Derived, never hand-labelled: the first CORE_PATH words of the learning path (the path is
 * ordered by corpus frequency, scripts/build-atlas.ts) up to B2, plus every atlas word found in the exam topic
 * vocabulary (TOPICS in exam.ts). Words the learner created count as core: they chose to learn them.
 */
import type { Atlas, WordRef } from "../atlas/types";
import { TOPICS, type Topic } from "./exam";

/** How many words of the frequency-ordered learning path are core. */
export const CORE_PATH = 1500;
/** Highest level index of a core word (atlas.cefr: A1 A2 B1 B2 …). */
const CORE_MAX_LEVEL = 3;

export const CORE_LABEL = "会用";
export const PASSIVE_LABEL = "认得";

const SKIP = new Set(["le", "la", "les", "l", "un", "une", "des", "de", "d", "du", "à", "au", "aux", "en", "et", "ou", "se", "s", "sa", "son", "ses", "que", "qu", "plutôt", "contre", "entre", "être", "avoir"]);

/** The phrases of a topic vocabulary line: "gaspiller / le gaspillage" → both; "(CDI)" and "(e)" dropped. */
const phrasesOf = (fr: string) =>
  fr
    .replace(/\([^)]*\)/g, "")
    .split("/")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

/** Lower-case headwords of the topic vocabulary: whole phrases and their content words. */
export function topicHeadwords(topics: readonly Topic[] = TOPICS): Set<string> {
  const out = new Set<string>();
  for (const t of topics)
    for (const [fr] of t.vocab)
      for (const phrase of phrasesOf(fr)) {
        out.add(phrase);
        for (const w of phrase.split(/[\s'’]+/)) if (w.length > 2 && !SKIP.has(w)) out.add(w);
      }
  return out;
}

/** Ids of the core words of an atlas, in learning-path order. */
export function deriveCore(words: readonly Pick<WordRef, "id" | "word" | "cefr" | "order">[], topics: readonly Topic[] = TOPICS): Set<string> {
  const heads = topicHeadwords(topics);
  const out = new Set<string>();
  for (const w of words) {
    if (w.cefr > CORE_MAX_LEVEL) continue;
    if (w.order < CORE_PATH || heads.has(w.word.toLowerCase())) out.add(w.id);
  }
  return out;
}

const cache = new WeakMap<Atlas, Set<string>>();
/** The core set of an atlas, derived once. */
export function coreSet(atlas: Atlas): Set<string> {
  let s = cache.get(atlas);
  if (!s) {
    s = deriveCore(atlas.words);
    cache.set(atlas, s);
  }
  return s;
}

/** A word to be able to use (会用), rather than only recognise (认得). */
export function isCore(atlas: Atlas, id: string): boolean {
  return !!atlas.byId.get(id)?.custom || coreSet(atlas).has(id);
}
