import { gradeCompQuestion, type CompExercise } from "../lib/exam";
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

/** Build selectable full-mock paper sets dynamically from all available preset reading papers. */
export function mockPaperOptions(listenPapers: BankPaper[], readPapers: BankPaper[]): MockPaperOption[] {
  return readPapers.map((readPaper, idx) => {
    const listenPaper = listenPapers[idx % listenPapers.length];
    const hasParallelRead = readPaper.exs.some((ex) => ex.questions.some((q) => q.qType === "vf" || q.qType === "short"));
    const listenTag = listenPaper?.style === "natural" ? "口语化自然语流" : "电台播音语流";
    const readTag = hasParallelRead ? "阅读并行引证" : "阅读 QCM";
    return {
      idx,
      listenPaper,
      readPaper,
      hasParallelRead,
      label: `全真套卷 ${idx + 1}（${listenTag} · ${readTag}）`,
    };
  });
}

const wordTokens = (text: string): string[] =>
  text
    .toLowerCase()
    .match(/[a-zà-öø-ÿœç0-9]+/gi) ?? [];

/**
 * Determine whether the final submitted monologue text actually came from keyboard typing
 * rather than speech recognition transcription (non-sticky: recomputed from final vs voice text).
 */
export function resolveMockPoTyped(opts: { finalSaid: string; voiceSaid: string }): boolean {
  const voiceTokens = wordTokens(opts.voiceSaid);
  if (voiceTokens.length === 0) return true;
  const finalTokens = wordTokens(opts.finalSaid);
  if (finalTokens.length === 0) return true;
  const allowedEdits = Math.max(40, Math.round(voiceTokens.length * 0.4));
  if (finalTokens.length > voiceTokens.length + allowedEdits) return true;
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
  return kept / voiceTokens.length < 0.5;
}

/** Show retry + skip-to-monologue-grading recovery UI when examiner Turn 1 failed before any turn arrived. */
export const shouldShowDebateTurn1Recovery = (turnsCount: number, asking: boolean): boolean => turnsCount === 0 && !asking;
