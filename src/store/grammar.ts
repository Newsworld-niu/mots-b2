/**
 * Scheduling for 语法: one FSRS card per grammar point, separate from word and conjugation cards.
 * A point starts when the learner first practises it. A round of a point is a few drills; the round is
 * graded once (all right → Good, one slip → Hard, more → Again), so a weak point comes back sooner.
 */
import { drillId, type Drill, type GrammarData, type GrammarPoint } from "../lib/grammar";
import { review, Rating, type Grade } from "./srs";
import { dayKey, store, type Progress } from "./store";

/** Drills in one round of a point (practice from the point page), and per point in a review of due points. */
export const ROUND = 8;
export const REVIEW_ROUND = 4;

export function duePoints(data: GrammarData, p: Progress, now = Date.now()) {
  return data.points.filter((g) => p.gram?.[g.id] && p.gram[g.id].due <= now).map((g) => g.id);
}

/** Pick drills for a round: sentences whose source word the learner has learned first, then others, shuffled. */
export function pickDrills(point: GrammarPoint, p: Progress, n: number, seed = Date.now()): Drill[] {
  const rnd = (i: number) => (Math.imul(seed ^ (i * 2654435761), 1597334677) >>> 0) / 4294967296;
  const skip = new Set(p.gramSkip ?? []);
  const scored = point.drills.filter((d) => !skip.has(drillId(point.id, d))).map((d, i) => ({ d, k: (d.w && p.cards[d.w] ? 0 : 1) + rnd(i) * 1.5 }));
  scored.sort((a, b) => a.k - b.k);
  return scored.slice(0, n).map((x) => x.d);
}

export function roundGrade(wrong: number, total: number): Grade {
  if (wrong === 0) return Rating.Good;
  if (wrong <= Math.max(1, Math.floor(total / 5))) return Rating.Hard;
  return Rating.Again;
}

/** 这题有问题: never ask this drill again. */
export function skipDrill(point: string, d: Drill) {
  const id = drillId(point, d);
  store.progress((p) => (p.gramSkip?.includes(id) ? p : { ...p, gramSkip: [...(p.gramSkip ?? []), id] }));
}

/** Record a finished round of a point. */
export function gradePoint(pointId: string, wrong: number, total: number) {
  const { settings } = store.get();
  const grade = roundGrade(wrong, total);
  store.progress((p) => {
    const day = dayKey();
    const d = p.gramDays?.[day] ?? { n: 0, r: 0, c: 0 };
    const isNew = !p.gram?.[pointId];
    return {
      ...p,
      gram: { ...(p.gram ?? {}), [pointId]: review(p.gram?.[pointId], grade, Date.now(), settings.retention) },
      gramDays: { ...(p.gramDays ?? {}), [day]: { n: d.n + (isNew ? 1 : 0), r: d.r + total, c: d.c + total - wrong } },
    };
  });
  return grade;
}
