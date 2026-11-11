import type { Atlas, WordRef } from "../atlas/types";
import { MEDIA } from "../atlas/types";
import { hashSeed, normalize, shuffle } from "../lib/text";
import { isMastered, review, Rating, type Grade } from "./srs";
import { bumpDay, dayKey, store, type ActiveSession, type Progress, type QuizKind, type Settings, type Step } from "./store";
import { deckIndex, inRange, senseFor, studyRange, type DeckIndex, type StudyRange } from "./decks";

export function dueIds(p: Progress, now = Date.now()) {
  return Object.entries(p.cards)
    .filter(([, c]) => c.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id);
}

export function newToday(p: Progress) {
  return p.days[dayKey()]?.n ?? 0;
}

/**
 * Words whose Chinese gloss is not yet written are browsable but never taught or quizzed:
 * an empty or placeholder gloss would give a meaningless question and a wrong answer key.
 */
export const isTaughtReady = (w: { zh: string }) => w.zh !== "释义待补充" && w.zh.trim() !== "";

/** In each group of five new words, these places go to a noun, so a group is never all function words (être, et, avoir, tu…). */
const NOUN_SLOTS = new Set([1, 3]);

/**
 * Next unseen words: first the learner's own decks in range (in the order added), then the learning path
 * of the initial deck when it is in range, starting at the learner's level and limited to the focus topic
 * when one is chosen. Along the path, order is kept within nouns and within other words; the two are
 * interleaved so two of every five are nouns while both last.
 */
export function nextNew(atlas: Atlas, p: Progress, settings: Settings, count: number, ctx = rangeOf(atlas, p, settings)) {
  if (count <= 0) return [];
  const { idx, range } = ctx;
  const out: string[] = [];
  const taken = new Set<string>();
  for (const d of range.decks)
    for (const id of d.words) {
      if (out.length >= count) return out;
      const w = atlas.byId.get(id);
      if (!w || taken.has(id) || p.cards[id] || !isTaughtReady(w)) continue;
      taken.add(id);
      out.push(id);
    }
  if (!range.core) return out;
  const want = count - out.length;
  const topic = settings.focusTopic ? atlas.topics.findIndex((t) => t[0] === settings.focusTopic) : -1;
  // nouns and other words are gathered separately, up to `want` each: the path's first words are nearly all function words
  const nouns: WordRef[] = [];
  const rest: WordRef[] = [];
  const pass = (from: number) => {
    for (const w of atlas.words) {
      if (nouns.length >= want && rest.length >= want) return;
      if (!isTaughtReady(w) || w.cefr < from || p.cards[w.id] || taken.has(w.id) || idx.hidden.has(w.id)) continue;
      if (topic >= 0 && w.topic !== topic) continue;
      const list = w.g ? nouns : rest;
      if (list.length >= want) continue;
      taken.add(w.id);
      list.push(w);
    }
  };
  pass(settings.startLevel);
  if (nouns.length + rest.length < want) pass(0);
  for (let i = 0; out.length < count && (nouns.length || rest.length); i++) {
    const preferNoun = NOUN_SLOTS.has(i % 5);
    const w = (preferNoun ? nouns.shift() ?? rest.shift() : rest.shift() ?? nouns.shift())!;
    out.push(w.id);
  }
  return out;
}

export const rangeOf = (atlas: Atlas, p: Progress, s: Settings): { idx: DeckIndex; range: StudyRange } => ({ idx: deckIndex(atlas, p), range: studyRange(p, s) });

/**
 * Today's reviews and new words, from the decks in range. Words in no deck (paused) are never due;
 * `otherDue` counts due words in decks outside the range, so they are not forgotten.
 */
export function todayPlan(atlas: Atlas, p: Progress, s: Settings) {
  const ctx = rangeOf(atlas, p, s);
  const due: string[] = [];
  let otherDue = 0;
  for (const id of dueIds(p)) {
    if (!atlas.byId.has(id) || !ctx.idx.isActive(id)) continue;
    if (inRange(ctx.idx, ctx.range, id)) due.push(id);
    else otherDue++;
  }
  const newLeft = Math.max(0, s.dailyNew - newToday(p));
  const fresh = nextNew(atlas, p, s, newLeft, ctx);
  return { due, fresh, otherDue, range: ctx.range, minutes: Math.max(1, Math.round(due.length * 0.25 + fresh.length * 0.9)) };
}

/**
 * Question type by stage, as DuoCards does with its fixed card directions (duocards-research/REPORT.md §4):
 * every word is met in a set order (recognise, place in context, recall and type, recognise by ear) so it is
 * practised both ways, instead of leaving it to chance. FSRS still decides when; this only decides how.
 * The stage is the card's FSRS review count. A card being relearned after a lapse goes back to recognition.
 */
export function stagePlan(noun: boolean, spell: boolean, inContext: QuizKind): { first: QuizKind[]; cycle: QuizKind[] } {
  const recall: QuizKind = spell ? "spell" : inContext;
  const ear: QuizKind = spell ? "dictation" : "listen";
  return noun
    ? { first: ["meaning", "gender", inContext, recall, ear], cycle: [recall, "gender", ear, inContext] }
    : { first: ["meaning", inContext, recall, ear], cycle: [recall, ear, inContext, "listen"] };
}

export function quizKind(ref: WordRef, p: Progress, s: Settings): QuizKind {
  const c = p.cards[ref.id];
  const inContext: QuizKind = ref.media & MEDIA.img ? "picture" : "cloze";
  if (c && c.st === 3) return "meaning"; // relearning: back to recognition, like DuoCards after a miss
  const { first, cycle } = stagePlan(!!ref.g, s.spell, inContext);
  const r = c?.reps ?? 0;
  return r < first.length ? first[r] : cycle[(r - first.length) % cycle.length];
}

/** Kinds answered by typing the word (graded on a slower clock). */
export const isTyped = (k: QuizKind) => k === "spell" || k === "dictation";

/** Every meaning of a word, reduced to its first gloss ("面试；会谈" → "面试"): a wrong option must not share one with the answer. */
const senseCores = (w: WordRef) =>
  [w.zh.replace(/^[a-z.]+\s*/, ""), ...(w.more ?? [])].map((g) => g.split(/[；;，,]/)[0].replace(/[（(].*$/, "").trim()).filter((c) => c.length > 0);
/** True when two words can both be the right answer to "what does this mean?" (they share a sense). */
export const sharesSense = (a: WordRef, b: WordRef) => {
  const ca = senseCores(a);
  const cb = senseCores(b);
  const gloss = (w: WordRef) => [w.zh, ...(w.more ?? [])];
  return ca.some((x) => gloss(b).some((g) => g.includes(x))) || cb.some((x) => gloss(a).some((g) => g.includes(x)));
};

/** Distractors that look plausible: same level, similar spelling or length, different meaning. */
export function distractors(atlas: Atlas, ref: WordRef, kind: QuizKind, seed: number) {
  const target = normalize(ref.word);
  const scored: [number, WordRef][] = [];
  const pool = atlas.words.filter(isTaughtReady);
  // a word the learner created has no place on the path: compare it with a stretch of the path chosen by its id
  const at = ref.order >= 0 ? ref.order : pool.length ? hashSeed(ref.id) % pool.length : 0;
  const start = Math.max(0, at - 400);
  for (let i = start; i < Math.min(pool.length, at + 400); i++) {
    const w = pool[i];
    if (w.id === ref.id || normalize(w.word) === target) continue;
    // a French option that contains the answer (être → être à jour) or sits inside it gives the answer away
    if (kind !== "meaning" && (normalize(w.word).includes(target) || target.includes(normalize(w.word)))) continue;
    if (sharesSense(ref, w)) continue;
    let score = hashSeed(w.id + seed) % 100;
    if (kind !== "meaning") {
      if (w.word[0]?.toLowerCase() === target[0]) score += 120;
      score += Math.max(0, 60 - Math.abs(w.word.length - target.length) * 20);
    } else {
      if (w.cefr === ref.cefr) score += 40;
      if (w.zh.split(" ")[0] === ref.zh.split(" ")[0]) score += 60; // same part of speech
    }
    scored.push([score, w]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  const seen = new Set<string>();
  const picks: string[] = [];
  for (const [, w] of scored) {
    const key = kind === "meaning" ? w.zh : normalize(w.word);
    if (seen.has(key)) continue;
    seen.add(key);
    picks.push(w.id);
    if (picks.length === 3) break;
  }
  return shuffle([ref.id, ...picks], seed);
}

export function buildSession(atlas: Atlas, p: Progress, s: Settings, opts?: { ids?: string[]; reviewOnly?: boolean }): ActiveSession {
  const seed = Date.now();
  const plan = todayPlan(atlas, p, s);
  const ids = opts?.ids?.filter((id) => atlas.byId.has(id));
  const reviewIds = ids ? ids.filter((id) => p.cards[id]) : plan.due.slice(0, 120);
  const newIds = ids ? ids.filter((id) => !p.cards[id]) : opts?.reviewOnly ? [] : plan.fresh;
  const steps: Step[] = [];
  const range = studyRange(p, s);
  const sense = (id: string) => {
    const n = senseFor(range, id);
    return n ? { sense: n } : {};
  };
  const quiz = (id: string, salt: number): Step => {
    const ref = atlas.byId.get(id)!;
    // a masculine/feminine pair (ami / amie) gets meaning questions only: no cloze, listening or spelling that could need an article
    const pair = atlas.pairs?.has(id) ?? false;
    const kind: QuizKind = pair ? "meaning" : quizKind(ref, p, s);
    return { id, kind, options: isTyped(kind) || kind === "gender" ? undefined : distractors(atlas, ref, kind, seed + salt), ...(pair ? { pair: true } : {}), ...sense(id) };
  };
  // Reviews first while attention is fresh, then new words in small groups:
  // meet five, then recall those five in a different order.
  reviewIds.forEach((id, i) => steps.push(quiz(id, i)));
  for (let g = 0; g < newIds.length; g += 5) {
    const group = newIds.slice(g, g + 5);
    group.forEach((id) => steps.push({ id, kind: "intro", ...sense(id) }));
    shuffle(group, seed + g).forEach((id, i) => steps.push(quiz(id, 1000 + g + i)));
  }
  return { id: `s${seed}`, started: seed, steps: withPairing(atlas, p, steps, seed), index: 0, graded: {}, newIds, reviewIds };
}

/** A pairing round after every this many questions (DuoCards' default "balanced" frequency is 10). */
export const PAIR_EVERY = 10;
const PAIR_SIZE = 5;

/**
 * Insert a pairing round after every PAIR_EVERY questions, built from words already asked in this session.
 * Like DuoCards' pairing it prefers words still early in learning and those missed most (REPORT.md §5),
 * and it is extra practice only: it never changes a card's schedule.
 */
export function withPairing(atlas: Atlas, p: Progress, steps: Step[], seed: number): Step[] {
  const out: Step[] = [];
  const asked: string[] = [];
  let since = 0;
  for (const st of steps) {
    out.push(st);
    if (st.kind === "intro" || st.kind === "pairing") continue;
    if (!asked.includes(st.id)) asked.push(st.id);
    if (++since < PAIR_EVERY) continue;
    const ids = pickPairing(atlas, p, asked, seed + out.length);
    if (ids) {
      out.push({ id: ids[0], kind: "pairing", ids });
      since = 0;
    }
  }
  return out;
}

/** Five words to pair: fewest reviews and most lapses first, no two sharing a meaning (both would fit one gloss). */
export function pickPairing(atlas: Atlas, p: Progress, pool: string[], seed: number): string[] | null {
  const rank = (id: string) => {
    const c = p.cards[id];
    return (c?.reps ?? 0) * 10 - (c?.lapses ?? 0) * 25 + (hashSeed(id + seed) % 10);
  };
  const picked: WordRef[] = [];
  for (const id of [...pool].sort((a, b) => rank(a) - rank(b))) {
    const w = atlas.byId.get(id);
    if (!w || !isTaughtReady(w)) continue;
    if (picked.some((x) => sharesSense(x, w) || normalize(x.word) === normalize(w.word))) continue;
    picked.push(w);
    if (picked.length === PAIR_SIZE) return picked.map((x) => x.id);
  }
  return null;
}

export function gradeFor(kind: QuizKind, correct: boolean, ms: number, hinted: boolean): Grade {
  if (!correct) return Rating.Again;
  if (hinted) return Rating.Hard;
  const slow = isTyped(kind) ? 20000 : 9000;
  const fast = isTyped(kind) ? 6000 : 2500;
  if (ms > slow) return Rating.Hard;
  if (ms < fast && isTyped(kind)) return Rating.Easy;
  return Rating.Good;
}

/** The mistakes list with `id` moved to the front (no duplicates), capped at 300. */
export const withMistake = (mistakes: string[], id: string) => [id, ...mistakes.filter((x) => x !== id)].slice(0, 300);

/** Add a word to the mistakes book without touching its memory schedule (used by practice that is not graded). */
export function recordMistake(id: string) {
  store.progress((p) => (p.mistakes[0] === id ? p : { ...p, mistakes: withMistake(p.mistakes, id) }));
}

/** Apply an answer. Only the first attempt for a word in a session updates memory and stats. */
export function answer(atlas: Atlas, step: Step & { kind: QuizKind }, correct: boolean, grade: Grade, value: string, accentOnly = false, articleWrong = false) {
  const { settings } = store.get();
  store.progress((p) => {
    const sess = p.session;
    if (!sess) return p;
    let next: Progress = { ...p, session: { ...sess, pending: { correct, value, ...(accentOnly ? { accentOnly } : {}), ...(articleWrong ? { articleWrong } : {}) } } };
    const first = !(step.id in sess.graded) && !step.retry;
    if (first) {
      next = {
        ...next,
        cards: { ...next.cards, [step.id]: review(p.cards[step.id], grade, Date.now(), settings.retention) },
        session: { ...next.session!, graded: { ...sess.graded, [step.id]: grade } },
        mistakes: correct ? next.mistakes : withMistake(next.mistakes, step.id),
      };
      next = bumpDay(next, { r: 1, c: correct ? 1 : 0, n: sess.newIds.includes(step.id) ? 1 : 0 });
    }
    if (!correct) {
      // Practise it again a few steps later in another format; never re-graded.
      const steps = [...next.session!.steps];
      const retries = steps.filter((x) => x.id === step.id && "retry" in x && x.retry).length;
      if (retries < 2) {
        const ref = atlas.byId.get(step.id)!;
        // A wrong article (asked, or typed in a spelling) is practised again as an article; other mistakes switch format.
        const kind: QuizKind = step.pair ? "meaning" : step.kind === "gender" || (articleWrong && ref.g) ? "gender" : step.kind === "meaning" ? (ref.media & MEDIA.img ? "picture" : "cloze") : "meaning";
        const at = Math.min(steps.length, sess.index + 4);
        steps.splice(at, 0, { id: step.id, kind, retry: true, options: kind === "gender" ? undefined : distractors(atlas, ref, kind, Date.now()), ...(step.pair ? { pair: true } : {}), ...(step.sense ? { sense: step.sense } : {}) });
        next = { ...next, session: { ...next.session!, steps } };
      }
    }
    return next;
  });
}

/** Move to the next step; `seconds` is time spent on this step, capped so idle tabs don't inflate stats. */
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
