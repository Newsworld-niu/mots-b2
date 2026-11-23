import { gradeCompQuestion, type CompExercise, type CompKind } from "../lib/exam";
import { buildCompMissSnapshot, type CompMiss } from "../lib/listening";
import type { BankPaper } from "../store/exam-bank";

export interface MockPaperPair {
  listenPaper: BankPaper;
  readPaper: BankPaper;
}

export interface MockPaperOption extends MockPaperPair {
  idx: number;
  hasParallelRead: boolean;
  label: string;
}

/** Score a listening or reading paper including typed VF citations and short answers. */
export function scoreComp(exs: CompExercise[], picked: Record<string, number>, typed: Record<string, string> = {}): number {
  let s = 0;
  exs.forEach((ex, e) =>
    ex.questions.forEach((q, k) => {
      const key = `${e}-${k}`;
      if (gradeCompQuestion(q, picked[key], typed[key], ex.docs[q.doc]?.text).correct) s += q.pts;
    }),
  );
  return Math.round(s * 10) / 10;
}

/** Resolve aligned listening and reading preset papers for a mock exam set index. */
export function getMockPaperPair(listenPapers: BankPaper[], readPapers: BankPaper[], setIdx: number): MockPaperPair {
  const safeIdx = Number.isFinite(setIdx) && setIdx >= 0 ? Math.floor(setIdx) : 0;
  return {
    listenPaper: listenPapers[safeIdx % listenPapers.length],
    readPaper: readPapers[safeIdx % readPapers.length],
  };
}

/** Build selectable deterministic full-mock paper sets (套卷 1..5) across listening and reading banks. */
export function mockPaperOptions(listenPapers: BankPaper[], readPapers: BankPaper[]): MockPaperOption[] {
  if (!listenPapers.length || !readPapers.length) return [];
  const count = Math.max(listenPapers.length, readPapers.length);
  return Array.from({ length: count }, (_, idx) => {
    const { listenPaper, readPaper } = getMockPaperPair(listenPapers, readPapers, idx);
    const listenIdx = idx % listenPapers.length;
    const readIdx = idx % readPapers.length;
    const hasParallelRead = readPaper.exs.some((ex) => ex.questions.some((q) => q.qType === "vf" || q.qType === "short"));
    const listenTag = listenPaper?.style === "natural" ? "口语化自然语流" : "电台播音语流";
    const listenReuse = idx >= listenPapers.length ? ` · 听力复用卷 ${listenIdx + 1}` : "";
    const readReuse = idx >= readPapers.length ? ` · 阅读复用卷 ${readIdx + 1}` : "";
    const readTag = hasParallelRead ? "阅读并行引证" : "阅读 QCM";
    return {
      idx,
      listenPaper,
      readPaper,
      hasParallelRead,
      label: `全真套卷 ${idx + 1}（${listenTag}${listenReuse} · ${readTag}${readReuse}）`,
    };
  });
}

const wordTokens = (text: string): string[] =>
  text
    .toLowerCase()
    .match(/[a-zà-öø-ÿœç0-9]+/gi) ?? [];

/**
 * Determine whether the final submitted monologue text actually came from keyboard typing
 * rather than speech recognition transcription (non-sticky: allows <=10% minor ASR fixes, max 15 words).
 */
export function resolveMockPoTyped(opts: { finalSaid: string; voiceSaid: string }): boolean {
  const voiceTokens = wordTokens(opts.voiceSaid);
  if (voiceTokens.length === 0) return true;
  const finalTokens = wordTokens(opts.finalSaid);
  if (finalTokens.length === 0) return true;
  const allowedEdits = Math.min(15, Math.round(voiceTokens.length * 0.1));
  if (Math.abs(finalTokens.length - voiceTokens.length) > allowedEdits) return true;
  const finalCounts = new Map<string, number>();
  for (const w of finalTokens) finalCounts.set(w, (finalCounts.get(w) ?? 0) + 1);
  let kept = 0;
  for (const w of voiceTokens) {
    const left = finalCounts.get(w) ?? 0;
    if (left > 0) {
      kept++;
      finalCounts.set(w, left - 1);
    }
  }
  const edits = Math.max(voiceTokens.length - kept, finalTokens.length - kept);
  return edits > allowedEdits;
}

/** Show retry + skip-to-monologue-grading recovery UI when examiner Turn 1 failed before any turn arrived. */
export const shouldShowDebateTurn1Recovery = (turnsCount: number, asking: boolean): boolean => turnsCount === 0 && !asking;

/** Initialize all rubric criterion scores as unselected (null) instead of pre-filling a passing 3/5. */
export const emptyRubric = (keys: readonly string[]): Record<string, number | null> =>
  Object.fromEntries(keys.map((k) => [k, null]));

/** True only once every rubric criterion has an explicit score. */
export const rubricComplete = (m: Record<string, number | null | undefined>, keys: readonly string[]): boolean =>
  keys.every((k) => typeof m[k] === "number");

/** Sum selected rubric criterion scores (unselected criteria count as 0). */
export const rubricSum = (m: Record<string, number | null | undefined>, keys: readonly string[]): number =>
  keys.reduce((n, k) => n + (typeof m[k] === "number" ? m[k] : 0), 0);

/** Collect wrong CO/CE answers from a mock section so they feed into compMisses diagnostics. */
export function collectCompMisses(
  exs: CompExercise[],
  part: CompKind,
  picked: Record<string, number>,
  typed: Record<string, string> = {},
  at = Date.now(),
): CompMiss[] {
  const missed: CompMiss[] = [];
  exs.forEach((ex, e) =>
    ex.questions.forEach((q, k) => {
      const key = `${e}-${k}`;
      if (!gradeCompQuestion(q, picked[key], typed[key], ex.docs[q.doc]?.text).correct) {
        missed.push(buildCompMissSnapshot(q, ex, part, key, at));
      }
    }),
  );
  return missed;
}

/**
 * Determine whether mock PO should be flagged `typed: true` when logged to examLog:
 * offline self-assessed oral sessions (no AI transcript grading) count toward /100 readiness,
 * whereas AI-graded sessions still enforce voice vs keyboard detection via `resolveMockPoTyped`.
 */
export function isMockPoTyped(opts: {
  hasAiFb: boolean;
  finalSaid: string;
  voiceSaid: string;
  recordedVoice?: boolean;
  answeredTurns?: number;
  debateVoice?: boolean;
}): boolean {
  if (!opts.hasAiFb) return false;
  if (opts.answeredTurns && opts.answeredTurns > 0 && opts.debateVoice === false) return true;
  if (opts.recordedVoice && !opts.voiceSaid.trim() && !opts.finalSaid.trim()) return false;
  return resolveMockPoTyped({ finalSaid: opts.finalSaid, voiceSaid: opts.voiceSaid });
}
