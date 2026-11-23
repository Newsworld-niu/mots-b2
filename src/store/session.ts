import { coreSet } from "../lib/core-words";
import { familyWords, familiesFor } from "../lib/families";
import { matchesStudyPos } from "../lib/pos";
import type { Atlas, WordRef } from "../atlas/types";
import { MEDIA } from "../atlas/types";
import { hashSeed, normalize, shuffle } from "../lib/text";
import { isSpellableHeadword } from "../lib/gender";
import { isMastered, retrievability, review, Rating, type CardState, type Grade } from "./srs";
import { bumpDay, CORE_DECK, dayKey, store, type ActiveSession, type DayStat, type Progress, type QuizKind, type Settings, type Step } from "./store";
import { deckIndex, inRange, senseFor, studyRange, type DeckIndex, type StudyRange } from "./decks";

export const LEECH_DEFAULT_THRESHOLD = 6;

export function dueIds(p: Pick<Progress, "cards" | "suspendedLeeches">, now = Date.now()) {
  const suspended = new Set(p.suspendedLeeches ?? []);
  return Object.entries(p.cards)
    .filter(([id, c]) => !suspended.has(id) && c.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id);
}

/** Word IDs with repeated lapses (`>= threshold`), sorted worst-first for leech review or suspension. */
export function leechIds(p: Pick<Progress, "cards">, threshold = LEECH_DEFAULT_THRESHOLD): string[] {
  return Object.entries(p.cards)
    .filter(([, c]) => c.lapses >= threshold)
    .sort((a, b) => b[1].lapses - a[1].lapses || b[1].d - a[1].d)
    .map(([id]) => id);
}

export function applySuspendLeech(p: Progress, id: string, suspend: boolean): Progress {
  const cur = p.suspendedLeeches ?? [];
  const next = suspend ? (cur.includes(id) ? cur : [id, ...cur]) : cur.filter((x) => x !== id);
  if (next.length) return { ...p, suspendedLeeches: next };
  if (!p.suspendedLeeches) return p;
  const { suspendedLeeches: _drop, ...rest } = p;
  void _drop;
  return rest;
}

export function suspendLeech(id: string) {
  store.progress((p) => applySuspendLeech(p, id, true));
}

export function unsuspendLeech(id: string) {
  store.progress((p) => applySuspendLeech(p, id, false));
}

/** Active non-suspended cards whose FSRS retrievability dropped below `0.78`, lowest retention first. */
export function forgettingRiskCards(
  atlas: Atlas,
  p: Pick<Progress, "cards" | "decks" | "hidden" | "coreMigrated" | "suspendedLeeches">,
  retention: number,
  limit = 12,
  now = Date.now(),
): { id: string; word: string; zh: string; retrievabilityPct: number; lapses: number }[] {
  const ctx = deckIndex(atlas, p);
  const suspended = new Set(p.suspendedLeeches ?? []);
  const out: { id: string; word: string; zh: string; retrievability: number; retrievabilityPct: number; lapses: number }[] = [];
  for (const [id, c] of Object.entries(p.cards)) {
    if (suspended.has(id) || c.reps <= 0 || c.st === 0 || !ctx.isActive(id)) continue;
    const w = atlas.byId.get(id);
    if (!w || !isTaughtReady(w)) continue;
    const r = retrievability(c, now, retention);
    if (r >= 0.78) continue;
    out.push({ id, word: w.word, zh: w.zh, retrievability: r, retrievabilityPct: Math.round(r * 100), lapses: c.lapses });
  }
  return out
    .sort((a, b) => a.retrievability - b.retrievability || b.lapses - a.lapses)
    .slice(0, limit)
    .map(({ retrievability: _r, ...item }) => item);
}

export function newToday(p: Pick<Progress, "days">) {
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
export function nextNew(
  atlas: Atlas,
  p: Pick<Progress, "cards" | "decks" | "hidden" | "coreMigrated" | "custom" | "edits">,
  settings: Settings,
  count: number,
  ctx = rangeOf(atlas, p, settings),
) {
  if (count <= 0) return [];
  const { idx, range } = ctx;
  const family = familyWords(settings.studyFamilies, settings.studyFamilies?.length ? familiesFor(atlas, p) : []);
  const out: string[] = [];
  const taken = new Set<string>();
  const userDecks = range.decks.filter((d) => d.id !== CORE_DECK);
  const coreDeck = range.decks.find((d) => d.id === CORE_DECK);
  for (const d of userDecks)
    for (const id of d.words) {
      if (out.length >= count) return out;
      const w = atlas.byId.get(id);
      if (!w || (family && !family.has(id)) || !matchesStudyPos(w.pos, settings.studyPos) || taken.has(id) || p.cards[id] || !isTaughtReady(w)) continue;
      taken.add(id);
      out.push(id);
    }
  if (!coreDeck && !range.core) return out;
  const topic = settings.focusTopic ? (atlas.topics?.findIndex((t) => t[0] === settings.focusTopic) ?? -1) : -1;
  // After migrateCoreDeck, CORE_DECK lives in range.decks (with coreMigrated=true, range.core=false).
  // Use its actual word list so removals/additions survive, while restoring level, topic and noun interleaving.
  const coreWords: WordRef[] = coreDeck
    ? coreDeck.words.map((id) => atlas.byId.get(id)).filter((w): w is WordRef => !!w)
    : atlas.words.filter((w) => !idx.hidden.has(w.id));
  const core = settings.startLevel >= 2 ? coreSet(atlas) : null;
  const takeTier = (match: (w: WordRef) => boolean) => {
    const want = count - out.length;
    if (want <= 0) return;
    // nouns and other words are gathered separately, up to `want` each: the path's first words are nearly all function words
    const nouns: WordRef[] = [];
    const rest: WordRef[] = [];
    for (const w of coreWords) {
      if (nouns.length >= want && rest.length >= want) break;
      if ((family && !family.has(w.id)) || !matchesStudyPos(w.pos, settings.studyPos) || !isTaughtReady(w) || p.cards[w.id] || taken.has(w.id)) continue;
      if (topic >= 0 && w.topic !== topic) continue;
      if (!match(w)) continue;
      const list = w.g ? nouns : rest;
      if (list.length >= want) continue;
      taken.add(w.id);
      list.push(w);
    }
    for (let i = 0; out.length < count && (nouns.length || rest.length); i++) {
      const preferNoun = NOUN_SLOTS.has(i % 5);
      const w = (preferNoun ? nouns.shift() ?? rest.shift() : rest.shift() ?? nouns.shift())!;
      out.push(w.id);
    }
  };
  if (core) takeTier((w) => w.custom || (w.cefr >= settings.startLevel && core.has(w.id)));
  takeTier((w) => w.custom || w.cefr >= settings.startLevel);
  if (settings.startLevel > 0) takeTier(() => true);
  return out;
}

export const rangeOf = (
  atlas: Pick<Atlas, "byId">,
  p: Pick<Progress, "decks" | "hidden" | "coreMigrated">,
  s: Pick<Settings, "studyDecks">,
): { idx: DeckIndex; range: StudyRange } => ({ idx: deckIndex(atlas, p), range: studyRange(p, s) });

/**
 * Today's reviews and new words, from the decks in range. Words in no deck (paused) are never due;
 * `otherDue` counts due words in decks outside the range, so they are not forgotten.
 */
export function todayPlan(
  atlas: Atlas,
  p: Pick<Progress, "cards" | "days" | "decks" | "hidden" | "coreMigrated" | "custom" | "edits" | "suspendedLeeches">,
  s: Settings,
) {
  const ctx = rangeOf(atlas, p, s);
  const allDue: string[] = [];
  const family = familyWords(s.studyFamilies, s.studyFamilies?.length ? familiesFor(atlas,p) : []);
  let otherDue = 0;
  for (const id of dueIds(p)) {
    if (!atlas.byId.has(id) || !ctx.idx.isActive(id)) continue;
    if ((!family || family.has(id)) && inRange(ctx.idx, ctx.range, id) && matchesStudyPos(atlas.byId.get(id)?.pos, s.studyPos)) allDue.push(id);
    else otherDue++;
  }
  const cap = typeof s.dailyReviewCap === "number" && s.dailyReviewCap >= 10 ? Math.round(s.dailyReviewCap) : null;
  const due = cap !== null ? allDue.slice(0, cap) : allDue;
  const overflowDue = cap !== null ? Math.max(0, allDue.length - cap) : 0;
  const newLeft = Math.max(0, s.dailyNew - newToday(p));
  const fresh = nextNew(atlas, p, s, newLeft, ctx);
  return { due, overflowDue, fresh, otherDue, range: ctx.range, minutes: Math.max(1, Math.round(due.length * 0.25 + fresh.length * 0.9)) };
}

/**
 * Question type by stage. The first pass is fixed, as DuoCards does with its card directions
 * (duocards-research/REPORT.md §4): every word is met in a set order (recognise, place in context, recall and
 * type, recognise by ear) so it is practised both ways. After that the type is drawn at random from `cycle`
 * (see laterKind), so reviews do not settle into a pattern. FSRS still decides when; this only decides how.
 * The stage is the card's FSRS review count. A card being relearned after a lapse goes back to recognition.
 */
export function stagePlan(noun: boolean, spell: boolean, inContext: QuizKind): { first: QuizKind[]; cycle: QuizKind[] } {
  const recall: QuizKind = spell ? "spell" : inContext;
  const ear: QuizKind = spell ? "dictation" : "listen";
  return noun
    ? { first: ["meaning", "gender", inContext, recall, ear], cycle: [recall, "gender", ear, inContext] }
    : { first: ["meaning", inContext, recall, ear], cycle: [recall, ear, inContext, "listen"] };
}

export function quizKind(ref: WordRef, p: Pick<Progress, "cards">, s: Settings): QuizKind {
  const c = p.cards[ref.id];
  const inContext: QuizKind = ref.media & MEDIA.img ? "picture" : "cloze";
  if (c && c.st === 3) return "meaning"; // relearning: back to recognition, like DuoCards after a miss
  const allowSpell = s.spell && isSpellableHeadword(ref.word);
  const { first, cycle } = stagePlan(!!ref.g, allowSpell, inContext);
  const r = c?.reps ?? 0;
  if (r < first.length) return first[r];
  if (ref.cefr >= 3 && r >= 5) {
    const b2Cycle: QuizKind[] = [...cycle, "collocation", "register"];
    return laterKind(ref.id, r, first, cycle, 5, b2Cycle);
  }
  return laterKind(ref.id, r, first, cycle);
}

/**
 * After the fixed first pass: a random type for review `r` of word `id`, never the one asked the time before,
 * and recall (typing the word, or picking it in context when spelling is off) at least once in any three, so the
 * harder direction is not left out by chance. Random per word and review, the same on every device.
 */
export function laterKind(id: string, r: number, first: QuizKind[], cycle: QuizKind[], switchAt?: number, altCycle?: QuizKind[]): QuizKind {
  const recall = cycle[0];
  let prev2 = first[first.length - 2];
  let prev = first[first.length - 1];
  let k = prev;
  for (let i = first.length; i <= r; i++) {
    const active = switchAt !== undefined && i >= switchAt && altCycle ? altCycle : cycle;
    const kinds = [...new Set(active)];
    const open = kinds.filter((x) => x !== prev);
    k = prev !== recall && prev2 !== recall ? recall : open[hashSeed(`${id}:${i}`) % open.length];
    prev2 = prev;
    prev = k;
  }
  return k;
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

export function buildSession(
  atlas: Atlas,
  p: Pick<Progress, "cards" | "days" | "decks" | "hidden" | "coreMigrated" | "custom" | "edits" | "suspendedLeeches">,
  s: Settings,
  opts?: { ids?: string[]; reviewOnly?: boolean },
): ActiveSession {
  const seed = Date.now();
  const plan = todayPlan(atlas, p, s);
  const ids = opts?.ids?.filter((id) => atlas.byId.has(id));
  const reviewIds = ids ? ids.filter((id) => p.cards[id]) : plan.due.slice(0, s.dailyReviewCap ?? 120);
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
    return {
      id,
      kind,
      options: isTyped(kind) || kind === "gender" ? undefined : distractors(atlas, ref, kind === "register" ? "meaning" : kind, seed + salt),
      ...(pair ? { pair: true } : {}),
      ...sense(id),
    };
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
export function withPairing(atlas: Atlas, p: Pick<Progress, "cards">, steps: Step[], seed: number): Step[] {
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
export function pickPairing(atlas: Atlas, p: Pick<Progress, "cards">, pool: string[], seed: number): string[] | null {
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

interface UndoSnapshot {
  sessionId: string;
  wordId: string;
  stepIndex: number;
  kind: "quiz" | "intro";
  prevCard: CardState | undefined;
  prevMistakes: string[];
  prevDayKey: string;
  prevDay: DayStat | undefined;
  prevSession: ActiveSession;
  wasFirst: boolean;
  at: number;
}

let lastUndo: UndoSnapshot | null = null;

export function resetSessionUndo() {
  lastUndo = null;
}

export function canUndoStep(sessionId: string): boolean {
  return Boolean(lastUndo && lastUndo.sessionId === sessionId);
}

export function canRegradePending(sessionId: string, stepIndex: number): boolean {
  return Boolean(lastUndo && lastUndo.sessionId === sessionId && lastUndo.stepIndex === stepIndex && lastUndo.kind === "quiz" && lastUndo.wasFirst);
}

export function getPendingPrevCard(sessionId: string, stepIndex: number): CardState | undefined {
  return canRegradePending(sessionId, stepIndex) ? lastUndo?.prevCard : undefined;
}

function buildRetrySteps(atlas: Atlas | undefined, prevSteps: Step[], step: Step & { kind: QuizKind }, stepIndex: number): Step[] {
  if (!atlas) return prevSteps;
  const ref = atlas.byId.get(step.id);
  if (!ref) return prevSteps;
  const retries = prevSteps.filter((x) => x.id === step.id && "retry" in x && x.retry).length;
  if (retries >= 2) return prevSteps;
  const steps = [...prevSteps];
  const kind: QuizKind = step.pair ? "meaning" : step.kind === "gender" ? "gender" : step.kind === "meaning" ? (ref.media & MEDIA.img ? "picture" : "cloze") : "meaning";
  const at = Math.min(steps.length, stepIndex + 4);
  steps.splice(at, 0, {
    id: step.id,
    kind,
    retry: true,
    options: kind === "gender" ? undefined : distractors(atlas, ref, kind, Date.now()),
    ...(step.pair ? { pair: true } : {}),
    ...(step.sense ? { sense: step.sense } : {}),
  });
  return steps;
}

/** Apply an answer. Only the first attempt for a word in a session updates memory and stats. */
export function answer(atlas: Atlas, step: Step & { kind: QuizKind }, correct: boolean, grade: Grade, value: string, accentOnly = false, articleWrong = false) {
  const { settings } = store.get();
  const now = Date.now();
  const dk = dayKey(new Date(now));
  store.progress((p) => {
    const sess = p.session;
    if (!sess) return p;
    const first = !(step.id in sess.graded) && !step.retry;
    lastUndo = {
      sessionId: sess.id,
      wordId: step.id,
      stepIndex: sess.index,
      kind: "quiz",
      prevCard: p.cards[step.id],
      prevMistakes: p.mistakes,
      prevDayKey: dk,
      prevDay: p.days[dk],
      prevSession: sess,
      wasFirst: first,
      at: now,
    };
    const effectiveGrade: Grade = first && sess.unknown?.includes(step.id) ? Rating.Again : grade;
    let next: Progress = {
      ...p,
      session: {
        ...sess,
        pending: { correct, value, grade: effectiveGrade, ...(accentOnly ? { accentOnly } : {}), ...(articleWrong ? { articleWrong } : {}) },
      },
    };
    if (first) {
      next = {
        ...next,
        // a word met as 不认识: whatever the answer, initial memory is left at the very start (learner can still override manually in Feedback)
        cards: { ...next.cards, [step.id]: review(p.cards[step.id], effectiveGrade, now, settings.retention) },
        session: { ...next.session!, graded: { ...sess.graded, [step.id]: effectiveGrade } },
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
        steps.splice(at, 0, { id: step.id, kind, retry: true, options: kind === "gender" ? undefined : distractors(atlas, ref, kind, now), ...(step.pair ? { pair: true } : {}), ...(step.sense ? { sense: step.sense } : {}) });
        next = { ...next, session: { ...next.session!, steps } };
      }
    }
    return next;
  });
}

/** Override FSRS grade of the currently displayed first-attempt answer while Feedback is open. */
export function regradePending(nextGrade: Grade, atlas?: Atlas): boolean {
  const snap = lastUndo;
  if (!snap || snap.kind !== "quiz" || !snap.wasFirst) return false;
  let updated = false;
  const { settings } = store.get();
  store.progress((p) => {
    const sess = p.session;
    if (!sess?.pending || sess.id !== snap.sessionId || sess.index !== snap.stepIndex) return p;
    const prevGrade = sess.graded[snap.wordId];
    const nextCard = review(snap.prevCard, nextGrade, snap.at, settings.retention);
    const step = snap.prevSession.steps[snap.stepIndex];
    const nextSteps =
      nextGrade === Rating.Again && step && step.kind !== "intro" && step.kind !== "pairing"
        ? buildRetrySteps(atlas, snap.prevSession.steps, step, snap.stepIndex)
        : snap.prevSession.steps;
    const prevPass = prevGrade !== undefined && prevGrade !== Rating.Again ? 1 : 0;
    const nextPass = nextGrade !== Rating.Again ? 1 : 0;
    const deltaC = nextPass - prevPass;
    const dayEntry = p.days[snap.prevDayKey];
    const nextDays =
      dayEntry && deltaC !== 0
        ? { ...p.days, [snap.prevDayKey]: { ...dayEntry, c: Math.max(0, dayEntry.c + deltaC) } }
        : p.days;
    const nextCorrect = nextGrade !== Rating.Again;
    updated = true;
    return {
      ...p,
      cards: { ...p.cards, [snap.wordId]: nextCard },
      days: nextDays,
      mistakes: nextGrade === Rating.Again ? withMistake(snap.prevMistakes, snap.wordId) : snap.prevMistakes,
      session: {
        ...sess,
        steps: nextSteps,
        graded: { ...sess.graded, [snap.wordId]: nextGrade },
        pending: { ...sess.pending, grade: nextGrade, correct: nextCorrect },
      },
    };
  });
  return updated;
}

/** Roll back the most recent graded step (quiz or intro), restoring FSRS card, mistakes, daily count, and step index. */
export function undoLastStep(): boolean {
  const snap = lastUndo;
  if (!snap) return false;
  let restored = false;
  store.progress((p) => {
    const sess = p.session;
    if (!sess || sess.id !== snap.sessionId) return p;
    const cards = { ...p.cards };
    if (snap.prevCard) cards[snap.wordId] = snap.prevCard;
    else delete cards[snap.wordId];
    const days = { ...p.days };
    if (snap.prevDay) days[snap.prevDayKey] = snap.prevDay;
    else delete days[snap.prevDayKey];
    restored = true;
    return {
      ...p,
      cards,
      days,
      mistakes: snap.prevMistakes,
      session: { ...snap.prevSession, pending: undefined },
    };
  });
  if (restored) lastUndo = null;
  return restored;
}

/** What the learner says on first meeting a word. */
export type IntroVerdict = "unknown" | "known" | "mastered";

/**
 * The learner's verdict on a new word's card, applied to the progress (the caller then advances):
 * - known (认识): nothing here; the question that follows grades it as usual.
 * - unknown (不认识): the word is noted, so that its first answer in this session cannot raise familiarity.
 * - mastered (完全认识): graded Easy at once, which starts it at a long interval, and its questions are dropped
 *   from the rest of the session. Pairing rounds are left alone: they never change a schedule.
 */
export function applyIntro(p: Progress, id: string, verdict: IntroVerdict, retention: number, now = Date.now()): Progress {
  const sess = p.session;
  if (!sess || verdict === "known" || id in sess.graded) return p;
  if (verdict === "unknown") return sess.unknown?.includes(id) ? p : { ...p, session: { ...sess, unknown: [...(sess.unknown ?? []), id] } };
  const steps = sess.steps.filter((x, k) => k <= sess.index || x.kind === "pairing" || x.kind === "intro" || x.id !== id);
  const next: Progress = {
    ...p,
    cards: { ...p.cards, [id]: review(p.cards[id], Rating.Easy, now, retention) },
    session: { ...sess, steps, graded: { ...sess.graded, [id]: Rating.Easy } },
  };
  return bumpDay(next, { r: 1, c: 1, n: sess.newIds.includes(id) ? 1 : 0 });
}

/** Record the verdict on a new word's card and move on. */
export function introduce(id: string, verdict: IntroVerdict, seconds: number) {
  const { settings } = store.get();
  const now = Date.now();
  const dk = dayKey(new Date(now));
  store.progress((p) => {
    const sess = p.session;
    if (!sess) return p;
    lastUndo = {
      sessionId: sess.id,
      wordId: id,
      stepIndex: sess.index,
      kind: "intro",
      prevCard: p.cards[id],
      prevMistakes: p.mistakes,
      prevDayKey: dk,
      prevDay: p.days[dk],
      prevSession: sess,
      wasFirst: !(id in sess.graded),
      at: now,
    };
    return applyIntro(p, id, verdict, settings.retention, now);
  });
  advance(seconds);
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

export const masteredCount = (p: Pick<Progress, "cards">) => Object.values(p.cards).filter(isMastered).length;
