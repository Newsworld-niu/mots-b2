/**
 * Grammar points (语法) and their drills: public/atlas/grammar.json, built by scripts/build-grammar.ts from
 * data/grammar/points.json (explanations) and the atlas's example sentences (drills).
 */
import { are1990OrthographyVariants, explainOrthographyError, startsWithFrenchVowel } from "./conjugation";
export { are1990OrthographyVariants, explainOrthographyError };

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

export type GrammarPointMeta = Pick<GrammarPoint, "id" | "title" | "level" | "fr">;

export interface GrammarMeta {
  v: 1;
  points: GrammarPointMeta[];
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

const normOrderWord = (w: string) => w.normalize("NFC").toLowerCase().replace(/[’‘'`\u02bc]/g, "'").trim();

const MOVABLE_SINGLE_ADJUNCTS = new Set([
  "hier", "aujourd'hui", "demain", "autrefois", "souvent", "parfois", "quelquefois",
  "actuellement", "maintenant", "bientôt", "récemment", "auparavant", "désormais", "dorénavant",
  "finalement", "heureusement", "malheureusement", "cependant", "toutefois", "néanmoins", "pourtant",
  "franchement", "évidemment", "probablement", "apparemment", "normalement", "généralement", "habituellement",
  "ici", "là-bas",
]);

const MOVABLE_PHRASE_ADJUNCTS = new Set([
  "en effet", "sans doute", "peut-être", "à mon avis", "selon moi", "d'après moi",
  "en général", "d'habitude", "de nos jours", "en ce moment", "tout à l'heure",
  "la veille", "le lendemain", "ce matin", "ce soir", "cet après-midi", "cette nuit",
  "cette semaine", "cette année", "l'an dernier", "l'année dernière", "l'an prochain", "l'année prochaine",
  "la semaine dernière", "la semaine prochaine", "le mois dernier", "le mois prochain",
  "tous les jours", "chaque jour", "chaque matin", "chaque soir", "chaque semaine", "chaque année",
]);

const MOVABLE_PREP_STARTERS = new Set(["depuis", "pendant", "durant", "avant", "après", "dès", "malgré", "selon", "dans", "en", "chez"]);
const OBLIGATORY_LOCATIVE_VERBS = new Set(["vais", "vas", "va", "allons", "allez", "vont", "allais", "allait", "irai", "ira", "aille", "habite", "habites", "habitons", "habitez", "habitent"]);

function isMovableAdjunct(span: string[], core: string[]): boolean {
  if (span.length === 0 || span.length > 4 || core.length < 2) return false;
  const joined = span.reduce((acc, w) => (acc === "" ? w : acc.endsWith("'") ? acc + w : `${acc} ${w}`), "");
  if (span.length === 1) return MOVABLE_SINGLE_ADJUNCTS.has(joined);
  if (MOVABLE_PHRASE_ADJUNCTS.has(joined)) return true;
  if (MOVABLE_PREP_STARTERS.has(span[0])) {
    const lastCore = core[core.length - 1];
    if ((span[0] === "dans" || span[0] === "en" || span[0] === "chez") && OBLIGATORY_LOCATIVE_VERBS.has(lastCore)) return false;
    return true;
  }
  if (span[0] === "à" && span.length >= 2 && !OBLIGATORY_LOCATIVE_VERBS.has(core[core.length - 1])) {
    return /^(?:paris|lyon|marseille|londres|rome|berlin|tokyo|pékin|shanghai|montréal|\d+|huit|neuf|dix|midi|minuit)$/.test(span[1]);
  }
  return false;
}

/** Order drill: right when words match reference order or relocate a movable clause-edge temporal/discourse adjunct. */
export function orderRight(d: OrderDrill, picked: string[]) {
  if (picked.length !== d.t.length) return false;
  const pNorm = picked.map(normOrderWord);
  const tNorm = d.t.map(normOrderWord);
  if (pNorm.every((w, i) => w === tNorm[i])) return true;

  for (let k = 1; k <= Math.min(4, tNorm.length - 2); k++) {
    const frontAdj = tNorm.slice(0, k);
    const frontCore = tNorm.slice(k);
    if (isMovableAdjunct(frontAdj, frontCore)) {
      const movedToEnd = [...frontCore, ...frontAdj];
      if (pNorm.every((w, i) => w === movedToEnd[i])) return true;
    }
    const endCore = tNorm.slice(0, tNorm.length - k);
    const endAdj = tNorm.slice(tNorm.length - k);
    if (isMovableAdjunct(endAdj, endCore)) {
      const movedToFront = [...endAdj, ...endCore];
      if (pNorm.every((w, i) => w === movedToFront[i])) return true;
    }
  }
  return false;
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
    .replace(/[’‘'`\u02bc]/g, "'")
    .replace(/\u00a0|\u202f/g, " ")
    .replace(/\s*([,;:!?.])\s*/g, "$1 ")
    .replace(/\s*'\s*/g, "'")
    .replace(/[«»"“”]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[\s.!?]+$/g, "")
    .trim();
const foldAnswer = (s: string) => normAnswer(s).normalize("NFD").replace(/\p{M}/gu, "").replace(/œ/g, "oe").replace(/æ/g, "ae");

const ELIDABLE_MAP: Record<string, string> = {
  que: "qu'",
  de: "d'",
  je: "j'",
  ne: "n'",
  me: "m'",
  te: "t'",
  se: "s'",
  le: "l'",
  la: "l'",
  ce: "c'",
  jusque: "jusqu'",
  lorsque: "lorsqu'",
  puisque: "puisqu'",
  quoique: "quoiqu'",
};

function matchCase(elided: string, original: string): string {
  if (!original) return elided;
  if (original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) {
    return elided[0].toUpperCase() + elided.slice(1);
  }
  return elided;
}

function firstTokenOf(s: string): string {
  const m = s.trimStart().match(/^[\p{L}\p{N}]+/u);
  return m ? m[0] : "";
}

function joinParts(left: string, right: string): string {
  if (!left) return right;
  if (!right) return left;
  if (left.endsWith("'")) return left + right.trimStart();
  if (/^\s/.test(left.slice(-1)) || /^\s/.test(right[0]) || /^[,.;:!?)]/.test(right)) return left + right;
  return `${left} ${right}`;
}

/**
 * Assemble `before` + `typed` + `after` for a French cloze blank, resolving boundary elisions
 * (`que/qu'`, `de/d'`, `je/j'`, `ne/n'`, `me/m'`, `te/t'`, `se/s'`, `le/la/l'`, `ce/c'`, `si/s'il(s)`)
 * while respecting aspirated-h words (`H_ASPIRE`) and Unicode apostrophes.
 */
export function assembleCloze(before: string, typed: string, after: string): string {
  const bRaw = before.normalize("NFC").replace(/[’‘'`\u02bc]/g, "'");
  let mid = typed.normalize("NFC").replace(/[’‘'`\u02bc]/g, "'").trim();
  const aRaw = after.normalize("NFC").replace(/[’‘'`\u02bc]/g, "'");
  if (!mid) return joinParts(bRaw, aRaw);

  let left = bRaw;

  // Deduplicate if `before` already ends with an elided clitic/conjunction and `typed` repeats it (e.g. before="qu'", typed="qu'il" or "que il")
  const leftElidedMatch = left.match(/(^|[^\p{L}])(qu|d|j|n|m|t|s|l|c|jusqu|lorsqu|puisqu|quoiqu)'\s*$/iu);
  if (leftElidedMatch) {
    const prefix = leftElidedMatch[2].toLowerCase();
    const dupElidedRe = new RegExp(`^${prefix}'\\s*`, "i");
    if (dupElidedRe.test(mid)) {
      mid = mid.replace(dupElidedRe, "");
    } else {
      const fullEntry = Object.entries(ELIDABLE_MAP).find(([, el]) => el === `${prefix}'`);
      if (fullEntry) {
        const dupFullRe = new RegExp(`^${fullEntry[0]}\\s+`, "i");
        if (dupFullRe.test(mid) && startsWithFrenchVowel(firstTokenOf(mid.replace(dupFullRe, "")))) {
          mid = mid.replace(dupFullRe, "");
        }
      } else if (prefix === "s" && /^si\s+(?:il|ils)\b/i.test(mid)) {
        mid = mid.replace(/^si\s+/i, "");
      }
    }
  } else {
    // Check if `before` ends with an unelided word that elides before `mid` (or if `mid` already supplied its elided form)
    const midFirst = firstTokenOf(mid);
    const leftWordMatch = left.match(/(^|[^\p{L}])(que|de|je|ne|me|te|se|le|la|ce|jusque|lorsque|puisque|quoique|si)\s+$/iu);
    if (leftWordMatch) {
      const lw = leftWordMatch[2].toLowerCase();
      const elided = lw === "si" ? "s'" : ELIDABLE_MAP[lw];
      const dupElidedMidRe = elided ? new RegExp(`^${elided.replace("'", "\\'")}\\s*`, "i") : null;
      if (lw === "si" && /^s'\s*(?:il|ils)\b/i.test(mid)) {
        const rest = mid.replace(/^s'\s*/i, "");
        left = left.slice(0, left.length - leftWordMatch[0].length) + leftWordMatch[1] + matchCase("s'", leftWordMatch[2]);
        mid = rest;
      } else if (elided && dupElidedMidRe && dupElidedMidRe.test(mid) && startsWithFrenchVowel(firstTokenOf(mid.replace(dupElidedMidRe, "")))) {
        const rest = mid.replace(dupElidedMidRe, "");
        left = left.slice(0, left.length - leftWordMatch[0].length) + leftWordMatch[1] + matchCase(elided, leftWordMatch[2]);
        mid = rest;
      } else if (midFirst) {
        if (lw === "si") {
          if (/^(?:il|ils)$/i.test(midFirst)) {
            left = left.slice(0, left.length - leftWordMatch[0].length) + leftWordMatch[1] + matchCase("s'", leftWordMatch[2]);
          }
        } else if (ELIDABLE_MAP[lw] && startsWithFrenchVowel(midFirst)) {
          left = left.slice(0, left.length - leftWordMatch[0].length) + leftWordMatch[1] + matchCase(ELIDABLE_MAP[lw], leftWordMatch[2]);
        }
      }
    }
  }

  // Right boundary (`mid` + `after`)
  const afterTrimmed = aRaw.trimStart();
  const afterFirst = firstTokenOf(afterTrimmed);
  if (afterFirst) {
    // Deduplicate if `after` starts with a token that `mid` already included at the tail? Keep strict unless elision applies.
    const midTailMatch = mid.match(/(^|[^\p{L}])(que|de|je|ne|me|te|se|le|la|ce|jusque|lorsque|puisque|quoique|si)$/iu);
    if (midTailMatch) {
      const rw = midTailMatch[2].toLowerCase();
      if (rw === "si") {
        if (/^(?:il|ils)$/i.test(afterFirst)) {
          mid = mid.slice(0, mid.length - midTailMatch[2].length) + matchCase("s'", midTailMatch[2]);
          return joinParts(left, mid + afterTrimmed);
        }
      } else if (ELIDABLE_MAP[rw] && startsWithFrenchVowel(afterFirst)) {
        mid = mid.slice(0, mid.length - midTailMatch[2].length) + matchCase(ELIDABLE_MAP[rw], midTailMatch[2]);
        return joinParts(left, mid + afterTrimmed);
      }
    }
  }

  return joinParts(joinParts(left, mid), aRaw);
}

function evalDirectTyped(input: string, accepted: readonly string[]): "right" | "accent" | "wrong" {
  const a = normAnswer(input);
  if (!a) return "wrong";
  if (accepted.some((x) => {
    const nx = normAnswer(x);
    return nx === a || are1990OrthographyVariants(a, nx);
  })) {
    return "right";
  }
  const foldMatches = accepted.map(normAnswer).filter((nx) => foldAnswer(nx) === foldAnswer(a));
  if (foldMatches.length > 0 && explainOrthographyError(a, foldMatches) === null) {
    return "accent";
  }
  return "wrong";
}

/** "right", "accent" (pure lexical accent slip), or "wrong" (including contrastive diacritic/cedilla errors). */
export function checkTyped(
  input: string,
  accepted: string[],
  context?: { before?: string; after?: string },
): "right" | "accent" | "wrong" {
  const direct = evalDirectTyped(input, accepted);
  if (direct === "right" || !input.trim()) return direct;
  if (context && (context.before !== undefined || context.after !== undefined)) {
    const before = context.before ?? "";
    const after = context.after ?? "";
    const assembledInput = assembleCloze(before, input, after);
    const assembledAccepted = accepted.map((acc) => assembleCloze(before, acc, after));
    const viaCloze = evalDirectTyped(assembledInput, assembledAccepted);
    if (viaCloze === "right") return "right";
    if (viaCloze === "accent" || direct === "accent") return "accent";
    return "wrong";
  }
  return direct;
}

/** Compute maximum multiset Dice token overlap [0..1] between `candidate` and `references` for pre-verdict AI equivalence gating. */
export function grammarTokenOverlap(candidate: string, references: readonly string[]): number {
  const tok = (s: string) => foldAnswer(s).match(/[\p{L}\p{N}]+/gu) ?? [];
  const candToks = tok(candidate);
  if (!candToks.length) return 0;
  let best = 0;
  for (const ref of references) {
    const refToks = tok(ref);
    if (!refToks.length) continue;
    const counts = new Map<string, number>();
    for (const w of refToks) counts.set(w, (counts.get(w) ?? 0) + 1);
    let inter = 0;
    for (const w of candToks) {
      const c = counts.get(w) ?? 0;
      if (c > 0) {
        inter++;
        counts.set(w, c - 1);
      }
    }
    const dice = (2 * inter) / (candToks.length + refToks.length);
    if (dice > best) best = dice;
  }
  return best;
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
