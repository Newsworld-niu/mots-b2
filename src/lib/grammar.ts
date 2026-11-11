/**
 * Grammar points (语法) and their drills: public/atlas/grammar.json, built by scripts/build-grammar.ts from
 * data/grammar/points.json (explanations) and the atlas's example sentences (drills).
 */

export interface GrammarRule {
  h: string;
  text: string;
  /** [French, Chinese] */
  ex: [string, string][];
}

/** Fill one blank: the answer is s.slice(b[0], b[1]) and is one of the options. */
export interface ChoiceDrill {
  k: "c";
  s: string;
  z: string;
  b: [number, number];
  o: string[];
  /** Hint shown with the blank (infinitive and tense, the noun, the base form …). */
  h: string;
  /** Why this answer: shown after answering. */
  y: string;
  /** Entry the sentence comes from (none for template drills). */
  w?: string;
}

/** Put the words in order. */
export interface OrderDrill {
  k: "o";
  s: string;
  z: string;
  /** The words in the right order (the first one lower-cased when it is a common word). */
  t: string[];
  /** Final punctuation. */
  p: string;
  h: string;
  y: string;
  w?: string;
}

export type Drill = ChoiceDrill | OrderDrill;

export interface GrammarPoint {
  id: string;
  level: "A1" | "A2" | "B1" | "B2";
  title: string;
  fr: string;
  intro: string;
  rules: GrammarRule[];
  traps: string[];
  drills: Drill[];
}

export interface GrammarData {
  v: 1;
  points: GrammarPoint[];
}

export const answerOf = (d: ChoiceDrill) => d.s.slice(d.b[0], d.b[1]);

/** A drill's id within its point: its sentence and blank, hashed (stable across rebuilds). */
export function drillId(point: string, d: Drill) {
  const key = d.k === "c" ? `${d.s}|${d.b[0]}|${d.b[1]}` : d.s;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return `${point}:${(h >>> 0).toString(36)}`;
}

/** Order drill: right when the words read the same (case and apostrophes ignored). */
export function orderRight(d: OrderDrill, picked: string[]) {
  const norm = (w: string) => w.toLowerCase().replace("’", "'");
  return picked.length === d.t.length && picked.every((w, i) => norm(w) === norm(d.t[i]));
}

/** A sentence with words shuffled so that it is never already in order (when it can be). */
export function shuffled(words: string[], seed: number): string[] {
  const out = words.map((w, i) => ({ w, k: (Math.imul(seed + i * 2654435761, 2246822519) >>> 0) % 1000003 }));
  out.sort((a, b) => a.k - b.k);
  const list = out.map((x) => x.w);
  if (list.length > 1 && list.every((w, i) => w === words[i])) list.push(list.shift()!);
  return list;
}
