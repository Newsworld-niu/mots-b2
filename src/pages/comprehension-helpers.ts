import type { CompForm, CompKind, CompQuestion } from "../lib/exam";

export type CompQFormat = "qcm" | "parallel";

/** Default question format: DELF B2 listening is strictly QCM; reading defaults to official parallel mix. */
export const defaultCompFormat = (kind: CompKind): CompQFormat => (kind === "listen" ? "qcm" : "parallel");

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
