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

interface DrillBase {
  s: string;
  z: string;
  /** Hint shown with the question (infinitive and tense, the noun, the instruction …). */
  h: string;
  /** Why this answer: shown after answering. */
  y: string;
  /** Entry the sentence comes from (none for written and template drills). */
  w?: string;
  /** What the drill trains: "r2" = the point's third rule, "t0" = its first trap. */
  g?: string;
}

/** Fill one blank: the answer is s.slice(b[0], b[1]) and is one of the options. */
export interface ChoiceDrill extends DrillBase {
  k: "c";
  b: [number, number];
  o: string[];
  /** Why a wrong option is wrong, by option. */
  e?: Record<string, string>;
}

/** Put the words in order. */
export interface OrderDrill extends DrillBase {
  k: "o";
  /** The words in the right order (the first one lower-cased when it is a common word). */
  t: string[];
  /** Final punctuation. */
  p: string;
}

/** Type the word(s) of one blank: s.slice(b[0], b[1]), or any of a. */
export interface TypeDrill extends DrillBase {
  k: "t";
  b: [number, number];
  /** Every accepted answer, the one in the sentence first. */
  a: string[];
}

/**
 * Is the underlined part s.slice(b[0], b[1]) right? r lists its corrections; none when it is right.
 * s is the sentence as shown (with the mistake).
 */
export interface FixDrill extends DrillBase {
  k: "f";
  b: [number, number];
  r: string[];
}

/** Rewrite a sentence: q is the sentence given, h the instruction, s the reference answer, a every accepted answer. */
export interface TransformDrill extends DrillBase {
  k: "x";
  q: string;
  a: string[];
}

export type Drill = ChoiceDrill | OrderDrill | TypeDrill | FixDrill | TransformDrill;

/** Two sentences that differ in one place, and what the difference does. */
export interface GrammarPair {
  a: string;
  b: string;
  d: string;
}

/** One sentence worked through step by step: [question, answer] per step. */
export interface GrammarWalk {
  s: string;
  z: string;
  steps: [string, string][];
}

export interface GrammarPoint {
  id: string;
  level: "A1" | "A2" | "B1" | "B2";
  title: string;
  fr: string;
  intro: string;
  rules: GrammarRule[];
  traps: string[];
  /** How to decide, step by step. */
  decide?: string[];
  /** The point in one line. */
  motto?: string;
  pairs?: GrammarPair[];
  walk?: GrammarWalk;
  /** Points to know first. */
  prereq?: string[];
  /** Points that are easily mixed up with this one or go with it. */
  related?: string[];
  drills: Drill[];
}

export interface GrammarData {
  v: 1;
  points: GrammarPoint[];
}

export const answerOf = (d: ChoiceDrill | TypeDrill) => d.s.slice(d.b[0], d.b[1]);

/** The sentence with the underlined part corrected (the sentence itself when it was right). */
export const fixedOf = (d: FixDrill) => (d.r.length ? d.s.slice(0, d.b[0]) + d.r[0] + d.s.slice(d.b[1]) : d.s);

/** The sentence to read out after answering. */
export const fullOf = (d: Drill) => (d.k === "f" ? fixedOf(d) : d.s);

/** A drill's id within its point: its sentence and blank, hashed (stable across rebuilds). */
export function drillId(point: string, d: Drill) {
  const key = d.k === "c" || d.k === "t" || d.k === "f" ? `${d.s}|${d.b[0]}|${d.b[1]}` : d.k === "x" ? `${d.q}|${d.s}` : d.s;
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

/* ---------- typed answers ---------- */

/** Lower case, one kind of apostrophe and space, no final punctuation. */
export const normAnswer = (s: string) =>
  s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\u00a0|\u202f/g, " ")
    .replace(/\s*([,;:!?.])\s*/g, "$1 ")
    .replace(/\s*'\s*/g, "'")
    .replace(/[«»"“”]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[\s.!?]+$/g, "")
    .trim();
const foldAnswer = (s: string) => normAnswer(s).normalize("NFD").replace(/\p{M}/gu, "").replace(/œ/g, "oe").replace(/æ/g, "ae");

/** "right", "accent" (right letters, wrong or missing accents), or "wrong". */
export function checkTyped(input: string, accepted: string[]): "right" | "accent" | "wrong" {
  const a = normAnswer(input);
  if (!a) return "wrong";
  if (accepted.some((x) => normAnswer(x) === a)) return "right";
  if (accepted.some((x) => foldAnswer(x) === foldAnswer(a))) return "accent";
  return "wrong";
}

/** Tags of a point in order: its rules, then its traps. */
export function tagsOf(p: Pick<GrammarPoint, "rules" | "traps">) {
  return [...p.rules.map((_, i) => `r${i}`), ...p.traps.map((_, i) => `t${i}`)];
}

/** What a tag trains, in a few words: the rule's heading, or the start of the trap. */
export function tagLabel(p: Pick<GrammarPoint, "rules" | "traps">, tag: string | undefined) {
  if (!tag) return "";
  const n = Number(tag.slice(1));
  if (tag[0] === "r") return p.rules[n]?.h ?? "";
  const t = p.traps[n] ?? "";
  const cut = t.search(/[：:；;，,。]/);
  const head = cut > 0 ? t.slice(0, cut) : t;
  return head.length > 28 ? head.slice(0, 27) + "…" : head;
}
