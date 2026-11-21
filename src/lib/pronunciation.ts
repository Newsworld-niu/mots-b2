/**
 * Azure pronunciation assessment (fr-FR, unscripted: no reference text): the request header, reading the answer
 * of one recognition request, and putting the pieces of a long recording together. Pure functions.
 */

export interface PronWord {
  word: string;
  /** 0–100 */
  accuracy: number;
  /** Azure's ErrorType: None, Mispronunciation, UnexpectedBreak, MissingBreak, Monotone, … */
  error: string;
}

export interface PronScores {
  /** Overall pronunciation score, 0–100. */
  pron: number | null;
  accuracy: number | null;
  fluency: number | null;
  prosody: number | null;
  completeness: number | null;
}

export interface PronResult extends PronScores {
  /** What the service heard (DisplayText). */
  text: string;
  /** Seconds of speech that were assessed. */
  seconds: number;
  words: PronWord[];
}

export const SCORE_KEYS = ["accuracy", "fluency", "prosody", "completeness"] as const;
export const SCORE_LABEL: Record<keyof PronScores, string> = { pron: "总分", accuracy: "准确度", fluency: "流利度", prosody: "韵律（语调重音）", completeness: "完整度" };
export const SCORE_HINT: Record<keyof PronScores, string> = {
  pron: "几项的综合",
  accuracy: "每个音发得像不像母语者",
  fluency: "停顿是否自然、语速是否连贯",
  prosody: "语调、重音、节奏",
  completeness: "说出的词有多少能被识别",
};
export const ERROR_LABEL: Record<string, string> = {
  Mispronunciation: "发音不准",
  Omission: "漏读",
  Insertion: "多读",
  UnexpectedBreak: "不该停的地方停了",
  MissingBreak: "该停的地方没停",
  Monotone: "语调太平",
};

/** Words below this accuracy are listed as to practise. */
export const WEAK_WORD = 60;

/** The value of the Pronunciation-Assessment header: base64 of its JSON settings. */
export function assessmentHeader(referenceText = "") {
  const json = JSON.stringify({ ReferenceText: referenceText, GradingSystem: "HundredMark", Granularity: "Word", Dimension: "Comprehensive", EnableMiscue: false, EnableProsodyAssessment: true });
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

const score = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : null);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * One answer of the recognition endpoint (format=detailed). The scores sit either on the best hypothesis itself
 * or under its PronunciationAssessment, depending on the service version; both are read. Null when nothing was
 * recognised (silence, noise).
 */
export function parseAssessment(raw: unknown): PronResult | null {
  if (!isObj(raw) || raw.RecognitionStatus !== "Success") return null;
  const best = Array.isArray(raw.NBest) && isObj(raw.NBest[0]) ? raw.NBest[0] : null;
  if (!best) return null;
  const pa = isObj(best.PronunciationAssessment) ? best.PronunciationAssessment : best;
  const words: PronWord[] = [];
  for (const w of Array.isArray(best.Words) ? best.Words : []) {
    if (!isObj(w) || typeof w.Word !== "string") continue;
    const wpa = isObj(w.PronunciationAssessment) ? w.PronunciationAssessment : w;
    const accuracy = score(wpa.AccuracyScore);
    if (accuracy === null) continue;
    words.push({ word: w.Word.slice(0, 60), accuracy, error: typeof wpa.ErrorType === "string" ? wpa.ErrorType : "None" });
  }
  const text = typeof raw.DisplayText === "string" ? raw.DisplayText : typeof best.Display === "string" ? best.Display : "";
  // Duration is in units of 100 ns
  const ticks = Number(raw.Duration);
  return {
    pron: score(pa.PronScore),
    accuracy: score(pa.AccuracyScore),
    fluency: score(pa.FluencyScore),
    prosody: score(pa.ProsodyScore),
    completeness: score(pa.CompletenessScore),
    text: text.trim(),
    seconds: Number.isFinite(ticks) && ticks > 0 ? ticks / 1e7 : 0,
    words,
  };
}

/**
 * The pieces of one recording as one result: each score is the mean of the pieces weighted by their length
 * (pieces that lack a score do not count for it), the texts joined, the words kept in order.
 */
export function aggregate(parts: PronResult[]): PronResult | null {
  if (!parts.length) return null;
  const mean = (k: keyof PronScores) => {
    let sum = 0;
    let weight = 0;
    for (const p of parts) {
      const v = p[k];
      if (v === null) continue;
      // a piece without a duration still counts, as one second
      const w = p.seconds > 0 ? p.seconds : 1;
      sum += v * w;
      weight += w;
    }
    return weight ? Math.round((sum / weight) * 10) / 10 : null;
  };
  return {
    pron: mean("pron"),
    accuracy: mean("accuracy"),
    fluency: mean("fluency"),
    prosody: mean("prosody"),
    completeness: mean("completeness"),
    text: parts
      .map((p) => p.text)
      .filter(Boolean)
      .join(" "),
    seconds: parts.reduce((n, p) => n + p.seconds, 0),
    words: parts.flatMap((p) => p.words),
  };
}

/** Overall score: the service's own, or the mean of the parts it has. */
export function overall(r: PronScores): number | null {
  if (r.pron !== null) return r.pron;
  const have = SCORE_KEYS.map((k) => r[k]).filter((v): v is number => v !== null);
  return have.length ? Math.round((have.reduce((a, b) => a + b, 0) / have.length) * 10) / 10 : null;
}

/** The words to practise: low accuracy or a reported error, worst first, each word once. */
export function weakWords(words: PronWord[], limit = 20): PronWord[] {
  const seen = new Map<string, PronWord>();
  for (const w of words) {
    if (w.accuracy >= WEAK_WORD && (w.error === "None" || !w.error)) continue;
    const k = w.word.toLowerCase();
    const had = seen.get(k);
    if (!had || w.accuracy < had.accuracy) seen.set(k, w);
  }
  return [...seen.values()].sort((a, b) => a.accuracy - b.accuracy).slice(0, limit);
}

/**
 * The grid's fifth criterion (phonologie, 0/1/3/5) estimated from the overall score: 85 and above reads as B2+,
 * 70 as B2, anything audible below that as below B2. An estimate: the examiners judge by ear.
 */
export function phonoLevel(r: PronScores | null): number | null {
  const v = r ? overall(r) : null;
  if (v === null) return null;
  return v >= 85 ? 5 : v >= 70 ? 3 : v >= 30 ? 1 : 0;
}
