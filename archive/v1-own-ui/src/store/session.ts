import { WORD_BY_ID, WORD_ORDER, zhOf, type WordEntry } from "../data";
import { clozeOf, hashSeed, shuffle } from "../lib/fr";
import { isMastered, review, Rating, type Grade, type CardState } from "./srs";
import { bumpDay, dayKey, store, type ActiveSession, type Progress, type QuizKind, type Settings, type Step } from "./store";

export function dueIds(p: Progress, now = Date.now()) {
  return Object.entries(p.cards)
    .filter(([id, c]) => c.due <= now && WORD_BY_ID.has(id))
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id);
}

export const newToday = (p: Progress) => p.days[dayKey()]?.n ?? 0;

/** Next unseen words along the learning path. */
export function nextNew(p: Progress, count: number) {
  const out: string[] = [];
  for (const w of WORD_ORDER) {
    if (out.length >= count) break;
    if (!p.cards[w.id]) out.push(w.id);
  }
  return out;
}

export function todayPlan(p: Progress, s: Settings) {
  const due = dueIds(p);
  const newLeft = Math.max(0, s.dailyNew - newToday(p));
  const fresh = nextNew(p, newLeft);
  return { due, fresh, minutes: Math.max(1, Math.round(due.length * 0.25 + fresh.length * 0.9)) };
}

/** Which example sentences can host a cloze for this word (their index in `ex`). */
export function clozeable(w: WordEntry) {
  return w.ex.map((e, i) => (clozeOf(e.fr, w.w) ? i : -1)).filter((i) => i >= 0);
}

function quizKind(w: WordEntry, p: Progress, s: Settings, salt: number): QuizKind {
  const c = p.cards[w.id];
  const roll = hashSeed(w.id + salt) % 100;
  const canCloze = clozeable(w).length > 0;
  if (!c || c.s < 2) {
    if (roll < 40 || !canCloze) return "meaning";
    return roll < 75 ? "cloze" : "listen";
  }
  if (s.spell && (c.s >= 4 || roll < 30)) return roll < 70 ? "spell" : canCloze ? "cloze" : "meaning";
  if (roll < 40) return canCloze ? "cloze" : "meaning";
  return roll < 70 ? "listen" : "meaning";
}

/** Four options: the answer plus three plausible distractors (same topic first, distinct labels). */
export function distractors(ref: WordEntry, seed: number): string[] {
  const label = (w: WordEntry) => zhOf(w);
  const pool = WORD_ORDER.filter((w) => w.id !== ref.id);
  const scored = pool
    .map((w) => {
      let score = hashSeed(w.id + seed) % 100;
      if (w.topic === ref.topic) score += 100;
      if (w.senses[0].pos === ref.senses[0].pos) score += 30;
      return [score, w] as const;
    })
    .sort((a, b) => b[0] - a[0]);
  const seen = new Set<string>([label(ref)]);
  const picks: string[] = [];
  for (const [, w] of scored) {
    if (seen.has(label(w))) continue;
    seen.add(label(w));
    picks.push(w.id);
    if (picks.length === 3) break;
  }
  return shuffle([ref.id, ...picks], seed);
}

export function buildSession(p: Progress, s: Settings, opts?: { ids?: string[]; reviewOnly?: boolean }): ActiveSession {
  const seed = Date.now();
  const plan = todayPlan(p, s);
  const reviewIds = opts?.ids ? opts.ids.filter((id) => p.cards[id]) : plan.due.slice(0, 120);
  const newIds = opts?.ids ? opts.ids.filter((id) => !p.cards[id]) : opts?.reviewOnly ? [] : plan.fresh;
  const steps: Step[] = [];
  const quiz = (id: string, salt: number): Step => {
    const ref = WORD_BY_ID.get(id)!;
    const kind = quizKind(ref, p, s, seed + salt);
    return { id, kind, options: kind === "spell" ? undefined : distractors(ref, seed + salt) };
  };
  // Reviews first while attention is fresh, then new words in small groups:
  // meet five, then recall those five in a shuffled order.
  reviewIds.forEach((id, i) => steps.push(quiz(id, i)));
  for (let g = 0; g < newIds.length; g += 5) {
    const group = newIds.slice(g, g + 5);
    group.forEach((id) => steps.push({ id, kind: "intro" }));
    shuffle(group, seed + g).forEach((id, i) => steps.push(quiz(id, 1000 + g + i)));
  }
  return { id: `s${seed}`, started: seed, steps, index: 0, graded: {}, newIds, reviewIds };
}

export function gradeFor(kind: QuizKind, correct: boolean, ms: number, hinted: boolean): Grade {
  if (!correct) return Rating.Again;
  if (hinted) return Rating.Hard;
  const slow = kind === "spell" ? 20000 : 9000;
  const fast = kind === "spell" ? 6000 : 2500;
  if (ms > slow) return Rating.Hard;
  if (ms < fast && kind === "spell") return Rating.Easy;
  return Rating.Good;
}

/** Apply an answer. Only the first attempt for a word in a session updates memory and stats. */
export function answer(step: Step & { kind: QuizKind }, correct: boolean, grade: Grade, value: string) {
  const { settings } = store.get();
  store.progress((p) => {
    const sess = p.session;
    if (!sess) return p;
    let next: Progress = { ...p, session: { ...sess, pending: { correct, value } } };
    const first = !(step.id in sess.graded) && !step.retry;
    if (first) {
      next = {
        ...next,
        cards: { ...next.cards, [step.id]: review(p.cards[step.id] as CardState | undefined, grade, Date.now(), settings.retention) },
        session: { ...next.session!, graded: { ...sess.graded, [step.id]: grade } },
        mistakes: correct ? next.mistakes : [step.id, ...next.mistakes.filter((x) => x !== step.id)].slice(0, 200),
      };
      next = bumpDay(next, { r: 1, c: correct ? 1 : 0, n: sess.newIds.includes(step.id) ? 1 : 0 });
    }
    if (!correct) {
      // Practise it again a few steps later in another format; never re-graded.
      const steps = [...next.session!.steps];
      const retries = steps.filter((x) => x.id === step.id && "retry" in x && x.retry).length;
      if (retries < 2) {
        const ref = WORD_BY_ID.get(step.id)!;
        const kind: QuizKind = step.kind === "meaning" ? (clozeable(ref).length ? "cloze" : "listen") : "meaning";
        const at = Math.min(steps.length, sess.index + 4);
        steps.splice(at, 0, { id: step.id, kind, retry: true, options: distractors(ref, Date.now()) });
        next = { ...next, session: { ...next.session!, steps } };
      }
    }
    return next;
  });
}

/** Move to the next step; `seconds` is time spent, capped so idle tabs don't inflate stats. */
export function advance(seconds: number) {
  store.progress((p) => {
    const s = p.session;
    if (!s) return p;
    const index = s.index + 1;
    const finished = index >= s.steps.length ? Date.now() : undefined;
    const next = bumpDay(p, { t: Math.max(0, Math.min(90, Math.round(seconds))) });
    return { ...next, session: { ...s, index, pending: undefined, finished } };
  });
}

export function sessionStats(s: ActiveSession) {
  const graded = Object.values(s.graded);
  const correct = graded.filter((g) => g !== Rating.Again).length;
  return { total: graded.length, correct, accuracy: graded.length ? Math.round((correct / graded.length) * 100) : 0 };
}

export const masteredCount = (p: Progress) => Object.values(p.cards).filter(isMastered).length;
