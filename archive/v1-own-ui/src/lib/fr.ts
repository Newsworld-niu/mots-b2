/** Small French text utilities: accent handling, cloze generation, dictation scoring. */

/** Lowercase and strip accents, for loose matching (e.g. "vérifier" → "verifier"). */
export function fold(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .toLowerCase();
}

/** Normalise a typed answer: unify apostrophes, drop punctuation, collapse spaces, keep accents. */
export function canonical(s: string) {
  return s
    .replace(/[’`´]/g, "'")
    .replace(/[^\p{L}\p{N}' -]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Compare a typed French word with the target.
 * - "exact": same letters, same accents (case and punctuation ignored)
 * - "accent": only accents differ (e.g. "verifier" for "vérifier") — counted as wrong, but explained
 * - "wrong": anything else
 */
export function diagnose(typed: string, target: string): "exact" | "accent" | "wrong" {
  const a = canonical(typed);
  const b = canonical(target);
  if (a === b) return "exact";
  if (fold(a) === fold(b)) return "accent";
  return "wrong";
}

export function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 0–100 accuracy of a dictation attempt, based on character edit distance. */
export function accuracyOf(typed: string, target: string) {
  const a = canonical(typed);
  const b = canonical(target);
  const denom = Math.max(a.length, b.length, 1);
  return Math.max(0, Math.round((1 - levenshtein(a, b) / denom) * 100));
}

/** Word tokens with their position in the sentence. */
export function tokens(s: string) {
  return [...s.matchAll(/\p{L}+/gu)].map((m) => ({ text: m[0], start: m.index!, end: m.index! + m[0].length }));
}

export interface Cloze {
  before: string;
  /** The exact form as it appears in the sentence (may be inflected). */
  answer: string;
  after: string;
}

/**
 * Blank out the headword (or its inflected form) in an example sentence.
 * Matches the exact headword first; otherwise the first token that shares the headword's stem.
 * Returns null when the sentence does not contain the word, so the caller can pick another example.
 */
export function clozeOf(sentence: string, headword: string): Cloze | null {
  const target = fold(headword);
  const stem = target.slice(0, Math.min(5, target.length));
  const toks = tokens(sentence);
  const hit = toks.find((t) => fold(t.text) === target) ?? toks.find((t) => fold(t.text).startsWith(stem));
  if (!hit) return null;
  return { before: sentence.slice(0, hit.start), answer: hit.text, after: sentence.slice(hit.end) };
}

/** Deterministic 32-bit hash, so the same seed always picks the same distractors and order. */
export function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function shuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let x = seed >>> 0 || 1;
  for (let i = out.length - 1; i > 0; i--) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    const j = (x >>> 0) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Split a "fr｜zh" pair used in collocations. */
export function splitPair(s: string): { fr: string; zh: string } {
  const [fr, zh = ""] = s.split("｜");
  return { fr: fr.trim(), zh: zh.trim() };
}

/** Wrap the headword inside a sentence for highlighting; returns [before, match, after] or null. */
export function highlightParts(sentence: string, headword: string): [string, string, string] | null {
  const c = clozeOf(sentence, headword);
  return c ? [c.before, c.answer, c.after] : null;
}
