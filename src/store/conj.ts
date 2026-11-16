/* Scheduling for the 变位 section: one FSRS card per verb × tense × person, separate from word cards.
 * Defaults to learned verbs; an explicit source may include unlearned verbs with checked tables.
 * Tenses follow the learner's level unless chosen by hand. */
import type { Atlas } from "../atlas/types";
import type { ConjData } from "../atlas/conj";
import { persons, TENSES, tensesForLevel, type ConjTense } from "../lib/conjugation";
import { review, Rating, type Grade } from "./srs";
import { dayKey, store, type Progress, type Settings } from "./store";

export const conjKey = (verbId: string, tense: ConjTense, person: number) => `${verbId}|${tense}|${person}`;
/** Legacy keys are retained for backup compatibility, but cannot prove any person's mastery. */
export const splitKey = (key: string) => {
  const match = key.match(/^(.*)\|(pres|pc|imp|fut|cond|subj)(?:\|([0-5]))?$/);
  return { verbId: match?.[1] ?? "", tense: match?.[2] as ConjTense, person: match?.[3] === undefined ? undefined : Number(match[3]) };
};

function validForm(key: string, data: ConjData) {
  const { verbId, tense, person } = splitKey(key);
  const v = data.verbs[verbId];
  return !!v && person !== undefined && persons(v).includes(person) && (tense === "pc" ? !!v.pp : !!v.f[tense]?.[person]);
}

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
    .filter(([k, c]) => c.due <= now && validForm(k, data) && tenses.includes(splitKey(k).tense))
    .sort((a, b) => a[1].due - b[1].due)
    .map(([k]) => k);
}

/** The daily limit counts distinct newly introduced verbs, not forms. */
export const conjNewToday = (p: Progress) => p.conjDays?.[dayKey()]?.verbs?.length ?? 0;
export const startedConjVerbs = (p: Progress) => new Set(Object.keys(p.conj ?? {}).filter(k => splitKey(k).person !== undefined).map(k => splitKey(k).verbId));

/** Select verb cards first, then cover every selected tense and valid person. */
export function newConj(atlas: Atlas, p: Progress, s: Settings, data: ConjData, count: number, verbIds?: readonly string[]) {
  const verbs = [...new Set(verbIds ?? unlockedVerbs(atlas, p, data))].filter(id => atlas.byId.has(id) && data.verbs[id]);
  const started = startedConjVerbs(p);
  const tenses = activeTenses(s);
  let added = 0;
  return verbs.flatMap(id => {
    // Alternate tenses within each person so all selected tenses appear early.
    const missing = persons(data.verbs[id]).flatMap(person => tenses.map(t => conjKey(id, t, person)))
      .filter(k => validForm(k, data) && !p.conj?.[k]);
    if (!missing.length) return [];
    // A partially practised verb can always be completed, even with a zero limit.
    if (!started.has(id) && added++ >= Math.max(0, count)) return [];
    return missing;
  });
}

export function conjPlan(atlas: Atlas, p: Progress, s: Settings, data: ConjData, verbIds?: readonly string[]) {
  const tenses = activeTenses(s);
  const verbs = new Set((verbIds ?? unlockedVerbs(atlas, p, data)).filter(id => atlas.byId.has(id) && data.verbs[id]));
  const due = dueConj(p, data, tenses).filter(key => verbs.has(splitKey(key).verbId));
  const fresh = newConj(atlas, p, s, data, Math.max(0, s.conjNew - conjNewToday(p)), [...verbs]);
  const started = startedConjVerbs(p);
  const newVerbs = new Set(fresh.map(k => splitKey(k).verbId).filter(id => !started.has(id))).size;
  const dueVerbs = new Set(due.map(k => splitKey(k).verbId)).size;
  const sessionVerbs = new Set([...due, ...fresh].map(k => splitKey(k).verbId)).size;
  return { due, fresh, verbs: verbs.size, tenses, newVerbs, dueVerbs, sessionVerbs };
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

/** A form always tests the same person, by recall from the first encounter. */
export function stepFor(key: string, p: Progress, data: ConjData): ConjStep {
  const { verbId, tense, person } = splitKey(key);
  if (!validForm(key, data) || person === undefined) throw new Error("Invalid conjugation form: " + key);
  return { key, verbId, tense, person, kind: "type", isNew: !p.conj?.[key] };
}

/** Repeated errors stay in the queue until a typed answer succeeds. */
export function repeatConj(steps: ConjStep[], index: number, step: ConjStep, retry = true) {
  const next = [...steps];
  next.splice(Math.min(next.length, index + 4), 0, { ...step, kind: "type", retry });
  return next;
}

export function buildConjSession(atlas: Atlas, p: Progress, s: Settings, data: ConjData, verbIds?: readonly string[]) {
  const plan = conjPlan(atlas, p, s, data, verbIds);
  return [...plan.due, ...plan.fresh].map(k => stepFor(k, p, data));
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
  if (step.retry || step.kind !== "type") return;
  const { settings } = store.get();
  store.progress((p) => {
    const day = dayKey();
    const d = p.conjDays?.[day] ?? { n: 0, r: 0, c: 0 };
    const introduced = d.verbs ?? [];
    const newVerb = !startedConjVerbs(p).has(step.verbId);
    const verbs = newVerb && !introduced.includes(step.verbId) ? [...introduced, step.verbId] : introduced;
    return {
      ...p,
      conj: { ...(p.conj ?? {}), [step.key]: review(p.conj?.[step.key], grade, Date.now(), settings.retention) },
      conjDays: { ...(p.conjDays ?? {}), [day]: { verbs, n: d.n + (!p.conj?.[step.key] ? 1 : 0), r: d.r + 1, c: d.c + (grade === Rating.Again ? 0 : 1) } },
    };
  });
}
