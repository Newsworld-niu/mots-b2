import type { CompForm, CompKind, CompQuestion } from "../lib/exam";

export type CompQFormat = "qcm" | "parallel";

/** Default question format: post-2020 DELF B2 listening and reading are both 100% 3-option QCM. */
export const defaultCompFormat = (_kind: CompKind): CompQFormat => "qcm";

/** Listening mode always resolves to QCM even if a previous format value was parallel. */
export const effectiveCompFormat = (kind: CompKind, selected: CompQFormat): CompQFormat => (kind === "listen" ? "qcm" : selected);

/** Only reading long/short exercises expose the parallel (Vrai/Faux + citation + short) toggle. */
export const shouldShowCompFormatPicker = (kind: CompKind, what: CompForm | "paper"): boolean => kind !== "listen" && what !== "opinions";

/** Strip quote-justification requirements from any listening question (including legacy saved papers). */
export function normalizeCompQuestionForKind(q: CompQuestion, kind: CompKind): CompQuestion {
  if (kind !== "listen") return q;
  if (q.qType === "vf") {
    const { quote: _quote, ...rest } = q;
    return { ...rest, qType: "qcm" };
  }
  return q;
}

/** Verbatim quote-citation inputs are only ever shown in reading mode for Vrai/Faux questions. */
export const shouldShowCitationInput = (q: CompQuestion, kind: CompKind): boolean => kind !== "listen" && (q.qType ?? "qcm") === "vf";

/**
 * Project a 4-option TCF/TEF QCM question down to 3 options (preserving the correct answer and the learner's picked
 * distractor) when recording a `CompMiss` snapshot, since `buildCompMissSnapshot` stores 3-option review cards.
 */
export function projectQuestionForMissSnapshot(q: CompQuestion, pickedIdx?: number): CompQuestion {
  const qt = q.qType ?? "qcm";
  if (qt !== "qcm" || q.options.length <= 3) return q;
  const mustKeep = new Set<number>([q.answer]);
  if (typeof pickedIdx === "number" && pickedIdx >= 0 && pickedIdx < q.options.length) {
    mustKeep.add(pickedIdx);
  }
  for (let i = 0; i < q.options.length && mustKeep.size < 3; i++) {
    mustKeep.add(i);
  }
  const kept = [...mustKeep].sort((a, b) => a - b).slice(0, 3);
  const newAnswer = kept.indexOf(q.answer);
  if (newAnswer < 0) return q;
  return {
    ...q,
    options: kept.map((i) => q.options[i]),
    answer: newAnswer,
    ...(q.trapTypes ? { trapTypes: kept.map((i) => q.trapTypes![i] ?? "") } : {}),
  };
}
