/**
 * Scheduling for 语法: one FSRS card per grammar point, separate from word and conjugation cards.
 * A point starts when the learner first practises it. A round of a point is a few drills; the round is
 * graded once (all right → Good, one slip → Hard, more → Again), so a weak point comes back sooner.
 *
 * Inside a point, drills are picked across what they train (their tag: a rule or a trap of the point), so
 * that a round touches every part of the point, and the parts the learner gets wrong come up more often.
 */
import { drillId, type Drill, type FixDrill, type GrammarData, type GrammarPoint } from "../lib/grammar";
import { review, Rating, type Grade } from "./srs";
import { dayKey, store, type Progress } from "./store";

/** Drills in one round of a point (practice from the point page), and per point in a review of due points. */
export const ROUND = 8;
export const REVIEW_ROUND = 4;
/** Tag of the drills made from the learner's own essay mistakes. */
export const ESSAY_TAG = "essay";
/** At most this many of the learner's own mistakes in a round. */
const MINE_PER_ROUND = 2;

/** One mistake from an essay or speaking marking, for a grammar point. */
export interface EssayError {
  wrong: string;
  right: string;
  why: string;
  at: number;
  source?: "essay" | "speak";
}

/** Mistakes from essay and speaking markings (kept ones in 错句本 and those of every marking), by grammar point. */
export function essayErrors(p: Pick<Progress, "essayNotes" | "essays" | "speakCorrections">): Map<string, EssayError[]> {
  const out = new Map<string, EssayError[]>();
  const seen = new Set<string>();
  const put = (point: string, e: EssayError) => {
    const wrong = e.wrong.trim();
    const right = e.right.trim();
    if (!point || !wrong || !right || wrong === right) return;
    const key = `${point}|${wrong}|${right}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.set(point, [...(out.get(point) ?? []), { ...e, wrong, right }]);
  };
  for (const n of p.essayNotes ?? [])
    put(n.point, {
      wrong: n.wrong,
      right: n.right,
      why: n.why,
      at: n.at,
      source: n.from.startsWith("口语") ? "speak" : "essay",
    });
  for (const essay of p.essays ?? [])
    for (const [fb, at] of [
      [essay.fb, essay.created],
      [essay.rev?.fb, essay.rev?.at ?? essay.created],
    ] as const)
      for (const c of fb?.corrections ?? []) put(c.point, { wrong: c.wrong, right: c.right, why: c.why, at, source: "essay" });
  for (const sp of p.speakCorrections ?? [])
    for (const c of sp.corrections) put(c.point, { wrong: c.wrong, right: c.right, why: c.why, at: sp.at, source: "speak" });
  for (const list of out.values()) list.sort((a, b) => b.at - a.at);
  return out;
}

/** Compute the minimal whole-word diff span `[b0, b1]` in `wrong` and corresponding replacement in `right`. */
export function minimalFixSpan(wrong: string, right: string): { b: [number, number]; r: string } {
  if (!wrong || wrong === right) return { b: [0, wrong.length], r: right };
  const isSep = (ch: string | undefined) => !ch || /\s/.test(ch);
  let p = 0;
  let lastWordBoundary = 0;
  const minLen = Math.min(wrong.length, right.length);
  while (p < minLen && wrong[p] === right[p]) {
    if (/\s/.test(wrong[p])) lastWordBoundary = p + 1;
    p++;
  }
  if (p === minLen && isSep(wrong[p]) && isSep(right[p])) lastWordBoundary = p;
  const b0 = lastWordBoundary;

  let ws = wrong.length;
  let rs = right.length;
  let b1 = wrong.length;
  let r1 = right.length;
  while (ws > b0 && rs > b0 && wrong[ws - 1] === right[rs - 1]) {
    ws--;
    rs--;
    if (/\s/.test(wrong[ws])) {
      b1 = ws;
      r1 = rs;
    }
  }
  if (ws === b0 && isSep(wrong[ws - 1]) && isSep(right[rs - 1])) {
    b1 = ws;
    r1 = rs;
  }

  // Pure insertion between spaces: include one adjacent word so the underlined span is non-empty.
  if (b0 >= b1) {
    if (b1 < wrong.length) {
      let nextSpace = b1;
      if (/\s/.test(wrong[nextSpace])) nextSpace++;
      while (nextSpace < wrong.length && !/\s/.test(wrong[nextSpace])) nextSpace++;
      const tailLen = wrong.length - nextSpace;
      return { b: [b0, nextSpace], r: right.slice(b0, right.length - tailLen).trim() };
    }
    let prevSpace = Math.max(0, b0 - 1);
    while (prevSpace > 0 && /\s/.test(wrong[prevSpace - 1])) prevSpace--;
    while (prevSpace > 0 && !/\s/.test(wrong[prevSpace - 1])) prevSpace--;
    return { b: [prevSpace, wrong.length], r: right.slice(prevSpace).trim() };
  }

  return { b: [b0, b1], r: right.slice(b0, r1) };
}

/** The learner's own mistakes as fix drills: only the minimal differing word/phrase span is underlined. */
export function mineDrills(errors: EssayError[] | undefined): FixDrill[] {
  return (errors ?? []).map((e) => {
    const span = minimalFixSpan(e.wrong, e.right);
    return {
      k: "f",
      s: e.wrong,
      z: "",
      b: span.b,
      r: [span.r],
      h: e.source === "speak" ? "你在口语里说过" : "你在作文里写过",
      y: e.why || `应为：${e.right}`,
      g: ESSAY_TAG,
    };
  });
}

/**
 * Points due for review: their card is due, or an essay marking found a mistake on them after their
 * last practice.
 */
export function duePoints(
  data: { points: Pick<GrammarPoint, "id">[] },
  p: Pick<Progress, "gram" | "essayNotes" | "essays" | "speakCorrections">,
  now = Date.now(),
) {
  const errors = essayErrors(p);
  return data.points
    .filter((g) => {
      const c = p.gram?.[g.id];
      if (!c) return false;
      return c.due <= now || (errors.get(g.id) ?? []).some((e) => e.at > (c.last ?? c.seen));
    })
    .map((g) => g.id);
}

/** Points with essay mistakes that the learner has not started. */
export function untouchedWithErrors<P extends Pick<GrammarPoint, "id">>(
  data: { points: P[] },
  p: Pick<Progress, "gram" | "essayNotes" | "essays" | "speakCorrections">,
) {
  const errors = essayErrors(p);
  return data.points.filter((g) => !p.gram?.[g.id] && errors.has(g.id)).map((g) => ({ point: g, n: errors.get(g.id)!.length }));
}

/** Prerequisites of a point that the learner has not started yet. */
export function missingPrereqs(data: GrammarData, point: GrammarPoint, p: Pick<Progress, "gram">) {
  return (point.prereq ?? []).map((id) => data.points.find((x) => x.id === id)).filter((x): x is GrammarPoint => !!x && !p.gram?.[x.id]);
}

const LEVEL_RANK: Record<GrammarPoint["level"], number> = { A1: 0, A2: 1, B1: 2, B2: 3 };

/** High-frequency DELF B1/B2 exam syllabus points prioritized when startLevel >= B1. */
export const EXAM_GRAMMAR_PRIORITY = [
  "subjonctif",
  "subj-indicatif",
  "connecteurs",
  "opposition-concession",
  "cause-consequence",
  "but",
  "conditionnel",
  "cond-passe",
  "plus-que-parfait",
  "pc-imparfait",
  "discours-indirect",
  "relatifs",
  "relatifs-composes",
  "nominalisation",
  "gerondif",
  "participe-present",
  "accord-pp",
  "futur-anterieur",
  "subj-passe",
  "passif",
  "hypothese-systeme",
  "causatif",
  "registre-inversion",
] as const;

const EXAM_RANK = new Map<string, number>(EXAM_GRAMMAR_PRIORITY.map((id, i) => [id, i]));

/** The next point to learn: follows `startLevel`, prioritizing B1/B2 exam syllabus points when starting at B1+. */
export function nextPoint(data: GrammarData, p: Pick<Progress, "gram">, startLevel = store.get().settings.startLevel) {
  const fresh = data.points.filter((g) => !p.gram?.[g.id]);
  if (!fresh.length) return undefined;
  const above = fresh.filter((g) => LEVEL_RANK[g.level] >= startLevel);
  const pool = above.length ? above : fresh;
  const ordered =
    startLevel >= 2
      ? [...pool].sort((a, b) => (EXAM_RANK.get(a.id) ?? 999) - (EXAM_RANK.get(b.id) ?? 999))
      : pool;
  return ordered.find((g) => !missingPrereqs(data, g, p).some((pre) => LEVEL_RANK[pre.level] >= startLevel)) ?? ordered[0];
}

/** How the learner did on one tag of a point: answered and wrong. */
export const tagKey = (point: string, tag: string) => `${point}|${tag}`;

/**
 * How a finished round counts:
 *  - round: a whole-point round or a review of due points; it schedules the point.
 *  - focused: one rule, one trap or one kind of drill; it counts for the tags and the day, and moves the
 *    point's card only when the point is new or the round had mistakes (a clean focused round must not
 *    push the whole point further away).
 *  - retry: the round's mistakes again, right away; nothing is recorded.
 */
export type SessionMode = "round" | "focused" | "retry";

/** Only drills of one tag (rule or trap) and/or one kind. */
export interface DrillFilter {
  tag?: string;
  kind?: Drill["k"];
}

const matchesFilter = (d: Drill, filter?: DrillFilter) =>
  (!filter?.tag || d.g === filter.tag) && (!filter?.kind || d.k === filter.kind);

/** The drills a round with this filter can draw from: the point's (minus skipped ones) and the learner's own. */
function filteredPool(point: GrammarPoint, p: Pick<Progress, "gramSkip">, mine: FixDrill[], filter?: DrillFilter) {
  const skip = new Set(p.gramSkip ?? []);
  return {
    pool: point.drills.filter((d) => !skip.has(drillId(point.id, d)) && matchesFilter(d, filter)),
    mine: mine.filter((d) => matchesFilter(d, filter)),
  };
}

/** How many drills a filter leaves (shown before starting). */
export function countMatchingDrills(point: GrammarPoint, p: Pick<Progress, "gramSkip">, mine: FixDrill[] = [], filter?: DrillFilter) {
  const f = filteredPool(point, p, mine, filter);
  return f.pool.length + f.mine.length;
}

/** Pick drills for a round: spread over the point's tags, weak tags more often, varied kinds. */
export function pickDrills(
  point: GrammarPoint,
  p: Pick<Progress, "cards" | "gramSkip" | "gramTags">,
  n: number,
  seed = Date.now(),
  mineAll: FixDrill[] = [],
  filter?: DrillFilter,
): Drill[] {
  let x = (seed ^ 0x9e3779b9) >>> 0;
  const rnd = () => {
    x = (Math.imul(x ^ (x >>> 15), 2246822519) + 0x6d2b79f5) >>> 0;
    return x / 4294967296;
  };
  const { pool, mine } = filteredPool(point, p, mineAll, filter);
  const byTag = new Map<string, Drill[]>();
  for (const d of pool) byTag.set(d.g ?? "", [...(byTag.get(d.g ?? "") ?? []), d]);
  // within a tag: written drills and learned-word auto drills come first, shuffled
  for (const list of byTag.values()) {
    const k = new Map(list.map((d) => [d, (!d.w ? 0.15 : p.cards[d.w] ? 0.3 : 1.0) + rnd() * 1.5]));
    list.sort((a, b) => k.get(a)! - k.get(b)!);
  }
  const weight = (tag: string) => {
    const s = p.gramTags?.[tagKey(point.id, tag)];
    if (!s || !s.n) return 1.6; // never practised: bring it in
    return 0.6 + (2 * (s.w + 1)) / (s.n + 2);
  };
  const out: Drill[] = [];
  // the learner's own mistakes: at most two in a mixed round; a round of only fix drills may take more
  const ownCap = filter?.tag === ESSAY_TAG ? n : pool.length ? Math.min(MINE_PER_ROUND, Math.max(0, n - 2)) : n;
  const own = [...mine].sort(() => rnd() - 0.5).slice(0, ownCap);
  const kinds = new Map<string, number>();
  let last = "";
  while (out.length < n - own.length) {
    const tags = [...byTag].filter(([, l]) => l.length).map(([t]) => t);
    if (!tags.length) break;
    const choice = tags.length > 1 ? tags.filter((t) => t !== last) : tags;
    const total = choice.reduce((s, t) => s + weight(t), 0);
    let r = rnd() * total;
    let tag = choice[choice.length - 1];
    for (const t of choice) {
      r -= weight(t);
      if (r <= 0) {
        tag = t;
        break;
      }
    }
    const list = byTag.get(tag)!;
    // the highest-ranked candidate whose kind has been used fewest times so far
    let best = list[0];
    let minK = kinds.get(best.k) ?? 0;
    for (let j = 1; j < list.length && minK > 0; j++) {
      const c = kinds.get(list[j].k) ?? 0;
      if (c < minK) {
        best = list[j];
        minK = c;
      }
    }
    list.splice(list.indexOf(best), 1);
    kinds.set(best.k, (kinds.get(best.k) ?? 0) + 1);
    out.push(best);
    last = tag;
  }
  // the learner's own mistakes go somewhere in the middle
  for (const d of own) out.splice(1 + Math.floor(rnd() * Math.max(1, out.length - 1)), 0, d);
  return out;
}

export function roundGrade(wrong: number, total: number, accentSlips = 0): Grade {
  if (wrong === 0) return accentSlips > 0 ? Rating.Hard : Rating.Good;
  if (wrong <= Math.max(1, Math.floor(total / 5))) return Rating.Hard;
  return Rating.Again;
}

/** Only `"correct"` amends a failed rewrite as error-free for SRS; `"almost"` retains error weight. */
export const shouldAmendRewrite = (verdict: "correct" | "almost" | "wrong") => verdict === "correct";

/** 这题有问题: never ask this drill again. */
export function skipDrill(point: string, d: Drill) {
  const id = drillId(point, d);
  store.progress((p) => (p.gramSkip?.includes(id) ? p : { ...p, gramSkip: [...(p.gramSkip ?? []), id] }));
}

function bumpTagStat(gramTags: Record<string, { n: number; w: number }>, pointId: string, tag: string, ok: boolean) {
  const k = tagKey(pointId, tag);
  const s = gramTags[k] ?? { n: 0, w: 0 };
  // a rolling count: old answers fade so that a tag the learner has since mastered calms down
  const n = Math.min(s.n, 19);
  const w = s.n ? (s.w * n) / s.n : 0;
  gramTags[k] = { n: n + 1, w: Math.round((w + (ok ? 0 : 1)) * 100) / 100 };
}

export const DISCOURSE_DONE_KEY = "fb2.gram.discourse.done.v1";

/** Read practiced discourse passage IDs from localStorage (safe no-op in non-browser tests). */
export function readDoneDiscourseIds(): Set<string> {
  try {
    if (typeof localStorage === "undefined") return new Set();
    const raw = localStorage.getItem(DISCOURSE_DONE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((x): x is string => typeof x === "string" && x.length > 0)) : new Set();
  } catch {
    return new Set();
  }
}

/** Persist a completed discourse passage ID into localStorage. */
export function markDiscourseDone(exerciseId: string): void {
  if (!exerciseId) return;
  try {
    if (typeof localStorage === "undefined") return;
    const set = readDoneDiscourseIds();
    set.add(exerciseId);
    localStorage.setItem(DISCOURSE_DONE_KEY, JSON.stringify([...set].slice(-200)));
  } catch {
    /* ignore storage quota or SSR */
  }
}

/** Pure state update for submitting a discourse passage: updates gram FSRS cards, gramDays, and sub-rule + discourse tag mastery. */
export function applyDiscourseResult(
  p: Progress,
  slots: { point: string; tag?: string; ok: boolean; accent?: boolean }[],
  now = Date.now(),
  retention = 0.9,
): Progress {
  if (!slots.length) return p;
  const day = dayKey(new Date(now));
  const d = p.gramDays?.[day] ?? { n: 0, r: 0, c: 0 };
  const gram = { ...(p.gram ?? {}) };
  const gramTags = { ...(p.gramTags ?? {}) };
  const byPoint = new Map<string, { ok: boolean; accent?: boolean }[]>();
  let newPoints = 0;

  for (const s of slots) {
    if (!s.point) continue;
    const list = byPoint.get(s.point) ?? [];
    list.push({ ok: s.ok, accent: s.accent });
    byPoint.set(s.point, list);
    bumpTagStat(gramTags, s.point, "discourse", s.ok);
    if (s.tag && /^[rt]\d{1,2}$/.test(s.tag)) {
      bumpTagStat(gramTags, s.point, s.tag, s.ok);
    }
  }

  for (const [pt, outcomes] of byPoint) {
    if (!gram[pt]) newPoints++;
    const wrong = outcomes.filter((o) => !o.ok).length;
    const accentSlips = outcomes.filter((o) => o.ok && o.accent).length;
    const total = outcomes.length;
    const grade = total <= 2 && wrong === total ? Rating.Again : roundGrade(wrong, total, accentSlips);
    gram[pt] = review(gram[pt], grade, now, retention);
  }

  const totalRight = slots.filter((s) => s.ok).length;
  return {
    ...p,
    gram,
    gramDays: {
      ...(p.gramDays ?? {}),
      [day]: { n: d.n + newPoints, r: d.r + slots.length, c: d.c + totalRight },
    },
    gramTags,
  };
}

/** Record a submitted discourse passage into Progress using current user retention. */
export function recordDiscourseResult(
  slots: { point: string; tag?: string; ok: boolean; accent?: boolean }[],
  exerciseId?: string,
) {
  if (exerciseId) markDiscourseDone(exerciseId);
  if (!slots.length) return;
  const { settings } = store.get();
  store.progress((p) => applyDiscourseResult(p, slots, Date.now(), settings.retention));
}

/**
 * Pure state update for a timed TCF/TEF Structure sprint:
 * every missed question schedules its target `point` with `Rating.Again` for immediate FSRS reflow,
 * while error-free points advance with `Rating.Good`, updating `gramDays` and sub-rule `gramTags`.
 */
export function applySprintResult(
  p: Progress,
  items: { point: string; tag?: string; ok: boolean }[],
  now = Date.now(),
  retention = 0.9,
): Progress {
  const valid = items.filter((it) => Boolean(it.point));
  if (!valid.length) return p;
  const day = dayKey(new Date(now));
  const d = p.gramDays?.[day] ?? { n: 0, r: 0, c: 0 };
  const gram = { ...(p.gram ?? {}) };
  const gramTags = { ...(p.gramTags ?? {}) };
  const byPoint = new Map<string, boolean[]>();
  let newPoints = 0;

  for (const it of valid) {
    const list = byPoint.get(it.point) ?? [];
    list.push(it.ok);
    byPoint.set(it.point, list);
    if (it.tag && /^[rt]\d{1,2}$/.test(it.tag)) {
      bumpTagStat(gramTags, it.point, it.tag, it.ok);
    }
  }

  for (const [pt, outcomes] of byPoint) {
    if (!gram[pt]) newPoints++;
    const hasMiss = outcomes.some((ok) => !ok);
    gram[pt] = review(gram[pt], hasMiss ? Rating.Again : Rating.Good, now, retention);
  }

  const totalRight = valid.filter((it) => it.ok).length;
  return {
    ...p,
    gram,
    gramDays: {
      ...(p.gramDays ?? {}),
      [day]: { n: d.n + newPoints, r: d.r + valid.length, c: d.c + totalRight },
    },
    gramTags,
  };
}

/** Record a submitted TCF/TEF timed grammar sprint into Progress for automatic FSRS reflow. */
export function recordSprintResult(items: { point: string; tag?: string; ok: boolean }[]) {
  if (!items.length) return;
  const { settings } = store.get();
  store.progress((p) => applySprintResult(p, items, Date.now(), settings.retention));
}

export interface RoundAnswer {
  g?: string;
  ok: boolean;
  accent?: boolean;
}

/**
 * Pure state update for a finished round of one point (see SessionMode). Returns the progress unchanged for a
 * retry round.
 */
export function applyPointRound(
  p: Progress,
  pointId: string,
  answers: RoundAnswer[],
  mode: SessionMode = "round",
  now = Date.now(),
  retention = 0.9,
): Progress {
  if (mode === "retry" || !answers.length) return p;
  const total = answers.length;
  const wrong = answers.filter((a) => !a.ok).length;
  const accentSlips = answers.filter((a) => a.ok && a.accent).length;
  const grade = roundGrade(wrong, total, accentSlips);
  const day = dayKey(new Date(now));
  const d = p.gramDays?.[day] ?? { n: 0, r: 0, c: 0 };
  const card = p.gram?.[pointId];
  const isNew = !card;
  const gramTags = { ...(p.gramTags ?? {}) };
  for (const a of answers) {
    if (!a.g || a.g === ESSAY_TAG) continue;
    bumpTagStat(gramTags, pointId, a.g, a.ok);
  }
  // a focused round moves the card only for a new point, or for mistakes on a card that is not due yet
  const moveCard = mode === "round" || isNew || (wrong > 0 && card.due > now);
  return {
    ...p,
    gram: moveCard ? { ...(p.gram ?? {}), [pointId]: review(card, grade, now, retention) } : p.gram,
    gramDays: { ...(p.gramDays ?? {}), [day]: { n: d.n + (isNew ? 1 : 0), r: d.r + total, c: d.c + total - wrong } },
    gramTags,
  };
}

/** Record a finished round of a point: its card, the day's numbers, and how each tag went. */
export function gradePoint(pointId: string, answers: RoundAnswer[], mode: SessionMode = "round") {
  const { settings } = store.get();
  const total = answers.length;
  const wrong = answers.filter((a) => !a.ok).length;
  const accentSlips = answers.filter((a) => a.ok && a.accent).length;
  const grade = roundGrade(wrong, total, accentSlips);
  if (mode !== "retry") store.progress((p) => applyPointRound(p, pointId, answers, mode, Date.now(), settings.retention));
  return grade;
}
