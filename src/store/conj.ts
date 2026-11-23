/* Scheduling for the 变位 section: one FSRS card per verb × tense × person, separate from word cards.
 * Defaults to learned verbs; an explicit source may include unlearned verbs with checked tables.
 * Tenses follow the learner's level unless chosen by hand. */
import type { Atlas } from "../atlas/types";
import type { ConjData } from "../atlas/conj";
import { imperatifForm, isCompoundTense, participePresentForm, personsFor, TENSES, tensesForLevel, type ConjTense } from "../lib/conjugation";
import { review, Rating, type Grade } from "./srs";
import { dayKey, store, type Progress, type Settings } from "./store";

export const conjKey = (verbId: string, tense: ConjTense, person: number) => `${verbId}|${tense}|${person}`;
/** Legacy keys are retained for backup compatibility, but cannot prove any person's mastery. */
export const splitKey = (key: string) => {
  const match = key.match(/^(.*)\|(pres|pc|imp|fut|cond|subj|pqp|fa|condp|subjp|ppres|imper)(?:\|([0-5]))?$/);
  return { verbId: match?.[1] ?? "", tense: match?.[2] as ConjTense, person: match?.[3] === undefined ? undefined : Number(match[3]) };
};

function validForm(key: string, data: ConjData) {
  const { verbId, tense, person } = splitKey(key);
  const v = data.verbs[verbId];
  if (!v || person === undefined || !personsFor(v, tense).includes(person)) return false;
  if (tense === "ppres") return participePresentForm(v) !== null;
  if (tense === "imper") return imperatifForm(v, person) !== null;
  return isCompoundTense(tense) ? !!v.pp : !!v.f[tense]?.[person];
}

export function activeTenses(s: Settings): ConjTense[] {
  const chosen = s.conjTenses?.filter((t): t is ConjTense => (TENSES as string[]).includes(t));
  return chosen?.length ? TENSES.filter((t) => chosen.includes(t)) : tensesForLevel(s.startLevel);
}

/** Core high-frequency French irregular verbs automatically pre-unlocked when startLevel >= B2 (3). */
export const B2_CORE_IRREGULAR_VERBS: ReadonlySet<string> = new Set([
  "être", "avoir", "aller", "faire", "pouvoir", "vouloir", "devoir", "savoir",
  "venir", "devenir", "revenir", "parvenir", "intervenir", "prévenir",
  "tenir", "maintenir", "obtenir", "soutenir", "appartenir",
  "prendre", "apprendre", "comprendre", "entreprendre", "reprendre", "surprendre",
  "mettre", "admettre", "permettre", "promettre", "remettre", "soumettre", "transmettre",
  "dire", "interdire", "prédire", "lire", "élire", "écrire", "décrire", "inscrire",
  "voir", "prévoir", "revoir", "croire", "boire",
  "connaître", "reconnaître", "paraître", "apparaître", "disparaître",
  "vivre", "survivre", "suivre", "poursuivre", "courir", "parcourir",
  "mourir", "naître", "ouvrir", "couvrir", "découvrir", "offrir", "souffrir",
  "partir", "sortir", "servir", "dormir", "sentir", "mentir",
  "recevoir", "apercevoir", "concevoir", "décevoir", "valoir", "falloir", "pleuvoir",
  "conduire", "construire", "détruire", "produire", "réduire", "traduire",
  "craindre", "plaindre", "atteindre", "peindre", "rejoindre", "résoudre", "acquérir",
  "battre", "combattre", "convaincre", "vaincre", "conclure", "rire", "sourire",
  "suffire", "plaire", "taire", "asseoir", "envoyer", "fuir",
]);

/** Learned verbs (plus core B2 irregulars when startLevel >= 3) that have a checked table, in learning-path order. */
export function unlockedVerbs(atlas: Atlas, p: Pick<Progress, "cards">, data: ConjData, startLevel = 0) {
  return atlas.words
    .filter((w) => {
      const v = data.verbs[w.id];
      if (!v) return false;
      return Boolean(p.cards[w.id]) || (startLevel >= 3 && B2_CORE_IRREGULAR_VERBS.has(v.i));
    })
    .map((w) => w.id);
}

export function dueConj(p: Pick<Progress, "conj">, data: ConjData, tenses: ConjTense[], now = Date.now()) {
  return Object.entries(p.conj ?? {})
    .filter(([k, c]) => c.due <= now && validForm(k, data) && tenses.includes(splitKey(k).tense))
    .sort((a, b) => a[1].due - b[1].due)
    .map(([k]) => k);
}

/** The daily limit counts distinct newly introduced verbs, not forms. */
export const conjNewToday = (p: Pick<Progress, "conjDays">) => p.conjDays?.[dayKey()]?.verbs?.length ?? 0;
export const startedConjVerbs = (p: Pick<Progress, "conj">) => new Set(Object.keys(p.conj ?? {}).filter(k => splitKey(k).person !== undefined).map(k => splitKey(k).verbId));

/** Select verb cards first, then cover every selected tense and valid person. */
export function newConj(atlas: Atlas, p: Pick<Progress, "cards" | "conj">, s: Settings, data: ConjData, count: number, verbIds?: readonly string[]) {
  const verbs = [...new Set(verbIds ?? unlockedVerbs(atlas, p, data, s.startLevel))].filter(id => atlas.byId.has(id) && data.verbs[id]);
  const started = startedConjVerbs(p);
  const tenses = activeTenses(s);
  let added = 0;
  return verbs.flatMap(id => {
    // Alternate tenses within each person so all selected tenses appear early.
    const missing = [0, 1, 2, 3, 4, 5].flatMap(person => tenses.filter(t => personsFor(data.verbs[id], t).includes(person)).map(t => conjKey(id, t, person)))
      .filter(k => validForm(k, data) && !p.conj?.[k]);
    if (!missing.length) return [];
    // A partially practised verb can always be completed, even with a zero limit.
    if (!started.has(id) && added++ >= Math.max(0, count)) return [];
    return missing;
  });
}

export function conjPlan(atlas: Atlas, p: Pick<Progress, "cards" | "conj" | "conjDays">, s: Settings, data: ConjData, verbIds?: readonly string[]) {
  const tenses = activeTenses(s);
  const verbs = new Set((verbIds ?? unlockedVerbs(atlas, p, data, s.startLevel)).filter(id => atlas.byId.has(id) && data.verbs[id]));
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
export function stepFor(key: string, p: Pick<Progress, "conj">, data: ConjData): ConjStep {
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

export function buildConjSession(atlas: Atlas, p: Pick<Progress, "cards" | "conj" | "conjDays">, s: Settings, data: ConjData, verbIds?: readonly string[]) {
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

/** Resolve an infinitive string (including reflexive `"se lever"` / `"s'asseoir"`) to a checked `verbId` in `ConjData`. */
export function resolveConjVerbId(data: ConjData, infinitive: string, atlas?: Pick<Atlas, "byId">): string | null {
  const raw = infinitive.normalize("NFC").trim().toLowerCase().replace(/[’‘`\u02bc]/g, "'");
  if (!raw) return null;
  const isRefl = /^(?:se\s+|s')/i.test(raw);
  const bare = raw.replace(/^(?:se\s+|s')/i, "").trim();
  if (!bare) return null;

  let fallbackId: string | null = null;
  for (const [id, v] of Object.entries(data.verbs)) {
    if (atlas && !atlas.byId.has(id)) continue;
    const vi = v.i.normalize("NFC").trim().toLowerCase();
    if (vi !== bare) continue;
    if (Boolean(v.p) === isRefl) return id;
    if (fallbackId === null) fallbackId = id;
  }
  return fallbackId;
}

/** Pure state update for one context-sentence conjugation attempt: advances FSRS `conj` card & `conjDays` when matched. */
export function applyContextConjAttempt(
  p: Progress,
  data: ConjData,
  attempt: {
    verb?: string;
    infinitive?: string;
    tense: ConjTense;
    person?: number;
    tenseOk: boolean;
    formOk: boolean;
    accentOnly?: boolean;
  },
  now = Date.now(),
  retention = 0.9,
  atlas?: Pick<Atlas, "byId">,
): Progress {
  const inf = attempt.infinitive ?? attempt.verb ?? "";
  const verbId = resolveConjVerbId(data, inf, atlas);
  if (!verbId) return p;
  const v = data.verbs[verbId];
  const validPersons = personsFor(v, attempt.tense);
  if (!validPersons.length) return p;
  const person = attempt.person !== undefined && validPersons.includes(attempt.person) ? attempt.person : validPersons[0];
  const key = conjKey(verbId, attempt.tense, person);
  if (!validForm(key, data)) return p;

  const grade: Grade =
    !attempt.tenseOk || (!attempt.formOk && !attempt.accentOnly)
      ? Rating.Again
      : attempt.accentOnly
        ? Rating.Hard
        : Rating.Good;

  const day = dayKey(new Date(now));
  const d = p.conjDays?.[day] ?? { n: 0, r: 0, c: 0 };
  const introduced = d.verbs ?? [];
  const newVerb = !startedConjVerbs(p).has(verbId);
  const verbs = newVerb && !introduced.includes(verbId) ? [...introduced, verbId] : introduced;

  return {
    ...p,
    conj: { ...(p.conj ?? {}), [key]: review(p.conj?.[key], grade, now, retention) },
    conjDays: {
      ...(p.conjDays ?? {}),
      [day]: {
        verbs,
        n: d.n + (!p.conj?.[key] ? 1 : 0),
        r: d.r + 1,
        c: d.c + (grade === Rating.Again ? 0 : 1),
      },
    },
  };
}

/** Stateful wrapper recording a context-sentence conjugation attempt into Progress. */
export function recordContextConjAttempt(
  data: ConjData,
  attempt: {
    verb?: string;
    infinitive?: string;
    tense: ConjTense;
    person?: number;
    tenseOk: boolean;
    formOk: boolean;
    accentOnly?: boolean;
  },
  atlas?: Pick<Atlas, "byId">,
) {
  const { settings } = store.get();
  store.progress((p) => applyContextConjAttempt(p, data, attempt, Date.now(), settings.retention, atlas));
}
