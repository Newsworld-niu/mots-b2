/* Scheduling for the 变位 section: one FSRS card per verb × tense, separate from word cards.
 * A verb is unlocked once its word card exists (learned in the daily journey); tenses follow the
 * learner's level unless chosen by hand. */
import type { Atlas } from "../atlas/types";
import type { ConjData } from "../atlas/conj";
import { persons, TENSES, tensesForLevel, type ConjTense } from "../lib/conjugation";
import { hashSeed } from "../lib/text";
import { review, Rating, type Grade } from "./srs";
import { dayKey, store, type Progress, type Settings } from "./store";

export const conjKey = (verbId: string, tense: ConjTense) => `${verbId}|${tense}`;
export const splitKey = (key: string) => {
  const i = key.lastIndexOf("|");
  return { verbId: key.slice(0, i), tense: key.slice(i + 1) as ConjTense };
};

export function activeTenses(s: Settings): ConjTense[] {
  const chosen = s.conjTenses?.filter((t): t is ConjTense => (TENSES as string[]).includes(t));
  return chosen?.length ? TENSES.filter((t) => chosen.includes(t)) : tensesForLevel(s.startLevel);
}

/** Learned verbs that have a checked table, in learning-path order. */
export function unlockedVerbs(atlas: Atlas, p: Progress, data: ConjData) {
  return atlas.words.filter((w) => data.verbs[w.id] && p.cards[w.id]).map((w) => w.id);
}

export function dueConj(p: Progress, data: ConjData, tenses: ConjTense[], now = Date.now()) {
  return Object.entries(p.conj ?? {})
    .filter(([k, c]) => c.due <= now && data.verbs[splitKey(k).verbId] && tenses.includes(splitKey(k).tense))
    .sort((a, b) => a[1].due - b[1].due)
    .map(([k]) => k);
}

export const conjNewToday = (p: Progress) => p.conjDays?.[dayKey()]?.n ?? 0;

/** New cards, tense by tense: all unlocked verbs in présent before the next tense. */
export function newConj(atlas: Atlas, p: Progress, s: Settings, data: ConjData, count: number) {
  const verbs = unlockedVerbs(atlas, p, data);
  const out: string[] = [];
  for (const t of activeTenses(s))
    for (const v of verbs) {
      if (out.length >= count) return out;
      const k = conjKey(v, t);
      if (!p.conj?.[k]) out.push(k);
    }
  return out;
}

export function conjPlan(atlas: Atlas, p: Progress, s: Settings, data: ConjData) {
  const tenses = activeTenses(s);
  const due = dueConj(p, data, tenses);
  const fresh = newConj(atlas, p, s, data, Math.max(0, s.conjNew - conjNewToday(p)));
  return { due, fresh, verbs: unlockedVerbs(atlas, p, data).length, tenses };
}

export type ConjKind = "choice" | "type";
export interface ConjStep {
  key: string;
  verbId: string;
  tense: ConjTense;
  person: number;
  kind: ConjKind;
  isNew: boolean;
  retry?: boolean;
}

/** New and shaky cards are recognised (4 choices); stable ones are typed. */
export function stepFor(key: string, p: Progress, data: ConjData, salt: number): ConjStep {
  const { verbId, tense } = splitKey(key);
  const c = p.conj?.[key];
  const ps = persons(data.verbs[verbId]);
  const person = ps[hashSeed(key + salt) % ps.length];
  const roll = hashSeed(key + "k" + salt) % 100;
  const kind: ConjKind = !c || c.s < 2 ? "choice" : c.s < 6 && roll < 40 ? "choice" : "type";
  return { key, verbId, tense, person, kind, isNew: !c };
}

export function buildConjSession(atlas: Atlas, p: Progress, s: Settings, data: ConjData) {
  const plan = conjPlan(atlas, p, s, data);
  const seed = Date.now();
  return [...plan.due.slice(0, 60), ...plan.fresh].map((k, i) => stepFor(k, p, data, seed + i));
}

export function conjGrade(result: "right" | "accent" | "wrong", ms: number, kind: ConjKind): Grade {
  if (result === "wrong") return Rating.Again;
  if (result === "accent") return Rating.Hard;
  if (ms > (kind === "type" ? 15000 : 8000)) return Rating.Hard;
  if (kind === "type" && ms < 5000) return Rating.Easy;
  return Rating.Good;
}

/** Record the first answer for a card (retries are practice only). */
export function answerConj(step: ConjStep, grade: Grade) {
  const { settings } = store.get();
  store.progress((p) => {
    const day = dayKey();
    const d = p.conjDays?.[day] ?? { n: 0, r: 0, c: 0 };
    return {
      ...p,
      conj: { ...(p.conj ?? {}), [step.key]: review(p.conj?.[step.key], grade, Date.now(), settings.retention) },
      conjDays: { ...(p.conjDays ?? {}), [day]: { n: d.n + (step.isNew ? 1 : 0), r: d.r + 1, c: d.c + (grade === Rating.Again ? 0 : 1) } },
    };
  });
}
