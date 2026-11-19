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

/** One mistake from an essay marking, for a grammar point. */
export interface EssayError {
  wrong: string;
  right: string;
  why: string;
  at: number;
}

/** Mistakes from essay markings (kept ones in 错句本 and those of every marking), by grammar point. */
export function essayErrors(p: Progress): Map<string, EssayError[]> {
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
  for (const n of p.essayNotes ?? []) put(n.point, n);
  for (const essay of p.essays ?? [])
    for (const [fb, at] of [
      [essay.fb, essay.created],
      [essay.rev?.fb, essay.rev?.at ?? essay.created],
    ] as const)
      for (const c of fb?.corrections ?? []) put(c.point, { wrong: c.wrong, right: c.right, why: c.why, at });
  for (const list of out.values()) list.sort((a, b) => b.at - a.at);
  return out;
}

/** The learner's own mistakes as fix drills: the whole wrong wording is underlined. */
export function mineDrills(errors: EssayError[] | undefined): FixDrill[] {
  return (errors ?? []).map((e) => ({ k: "f", s: e.wrong, z: "", b: [0, e.wrong.length], r: [e.right], h: "你在作文里写过", y: e.why || `应为：${e.right}`, g: ESSAY_TAG }));
}

/**
 * Points due for review: their card is due, or an essay marking found a mistake on them after their
 * last practice.
 */
export function duePoints(data: GrammarData, p: Progress, now = Date.now()) {
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
export function untouchedWithErrors(data: GrammarData, p: Progress) {
  const errors = essayErrors(p);
  return data.points.filter((g) => !p.gram?.[g.id] && errors.has(g.id)).map((g) => ({ point: g, n: errors.get(g.id)!.length }));
}

/** Prerequisites of a point that the learner has not started yet. */
export function missingPrereqs(data: GrammarData, point: GrammarPoint, p: Progress) {
  return (point.prereq ?? []).map((id) => data.points.find((x) => x.id === id)).filter((x): x is GrammarPoint => !!x && !p.gram?.[x.id]);
}

/** The next point to learn: the first not started whose prerequisites are started. */
export function nextPoint(data: GrammarData, p: Progress) {
  const fresh = data.points.filter((g) => !p.gram?.[g.id]);
  return fresh.find((g) => !missingPrereqs(data, g, p).length) ?? fresh[0];
}

/** How the learner did on one tag of a point: answered and wrong. */
export const tagKey = (point: string, tag: string) => `${point}|${tag}`;

/** Pick drills for a round: spread over the point's tags, weak tags more often, varied kinds. */
export function pickDrills(point: GrammarPoint, p: Progress, n: number, seed = Date.now(), mine: FixDrill[] = []): Drill[] {
  let x = (seed ^ 0x9e3779b9) >>> 0;
  const rnd = () => {
    x = (Math.imul(x ^ (x >>> 15), 2246822519) + 0x6d2b79f5) >>> 0;
    return x / 4294967296;
  };
  const skip = new Set(p.gramSkip ?? []);
  const pool = point.drills.filter((d) => !skip.has(drillId(point.id, d)));
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
  const own = [...mine].sort(() => rnd() - 0.5).slice(0, Math.min(MINE_PER_ROUND, Math.max(0, n - 2)));
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

/** Record a finished round of a point: its card, the day's numbers, and how each tag went. */
export function gradePoint(pointId: string, answers: { g?: string; ok: boolean }[]) {
  const { settings } = store.get();
  const total = answers.length;
  const wrong = answers.filter((a) => !a.ok).length;
  const grade = roundGrade(wrong, total);
  store.progress((p) => {
    const day = dayKey();
    const d = p.gramDays?.[day] ?? { n: 0, r: 0, c: 0 };
    const isNew = !p.gram?.[pointId];
    const gramTags = { ...(p.gramTags ?? {}) };
    for (const a of answers) {
      if (!a.g || a.g === ESSAY_TAG) continue;
      const k = tagKey(pointId, a.g);
      const s = gramTags[k] ?? { n: 0, w: 0 };
      // a rolling count: old answers fade so that a tag the learner has since mastered calms down
      const n = Math.min(s.n, 19);
      const w = s.n ? (s.w * n) / s.n : 0;
      gramTags[k] = { n: n + 1, w: Math.round((w + (a.ok ? 0 : 1)) * 100) / 100 };
    }
    return {
      ...p,
      gram: { ...(p.gram ?? {}), [pointId]: review(p.gram?.[pointId], grade, Date.now(), settings.retention) },
      gramDays: { ...(p.gramDays ?? {}), [day]: { n: d.n + (isNew ? 1 : 0), r: d.r + total, c: d.c + total - wrong } },
      gramTags,
    };
  });
  return grade;
}
