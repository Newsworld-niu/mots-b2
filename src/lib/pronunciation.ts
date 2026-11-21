/**
 * Azure pronunciation assessment (fr-FR, unscripted or scripted): the request header (Phoneme granularity + IPA),
 * reading the answer of one recognition request, Chinese-learner high-error phoneme aggregation, prosody gating,
 * and combining monologue + debate recordings. Pure functions.
 */
import { liaisonPoints } from "./liaison";

export interface PhonemeScore {
  phoneme: string;
  /** 0–100 */
  accuracy: number;
}

export interface PronWord {
  word: string;
  /** 0–100 */
  accuracy: number;
  /** Azure's ErrorType: None, Mispronunciation, UnexpectedBreak, MissingBreak, Monotone, … */
  error: string;
  /** Phoneme-level scores when Granularity === "Phoneme". */
  phonemes?: PhonemeScore[];
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
  const json = JSON.stringify({
    ReferenceText: referenceText,
    GradingSystem: "HundredMark",
    Granularity: "Phoneme",
    Dimension: "Comprehensive",
    PhonemeAlphabet: "IPA",
    EnableMiscue: !!referenceText,
    EnableProsodyAssessment: true,
  });
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
    const phonemes: PhonemeScore[] = [];
    for (const p of Array.isArray(w.Phonemes) ? w.Phonemes : []) {
      if (!isObj(p) || typeof p.Phoneme !== "string") continue;
      const ppa = isObj(p.PronunciationAssessment) ? p.PronunciationAssessment : p;
      const pAcc = score(ppa.AccuracyScore);
      const sym = p.Phoneme.trim().slice(0, 16);
      if (pAcc !== null && sym) phonemes.push({ phoneme: sym, accuracy: pAcc });
    }
    words.push({
      word: w.Word.slice(0, 60),
      accuracy,
      error: typeof wpa.ErrorType === "string" ? wpa.ErrorType : "None",
      ...(phonemes.length ? { phonemes } : {}),
    });
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

/** Tightened phonoLevel & standalone prosody gating thresholds. */
export const PHONO_THRESHOLDS = {
  b2PlusOverall: 88,
  b2Overall: 75,
  b1Overall: 35,
  b2PlusProsody: 80,
  b2Prosody: 65,
  b2PlusAccuracy: 80,
  b2PlusFluency: 78,
} as const;

export interface PhonoGateInfo {
  level: number | null;
  rawLevel: number | null;
  gatedBy: "prosody" | "accuracy_or_fluency" | null;
}

/** Evaluate criterion 5 (phonologie: 0/1/3/5) with tightened thresholds and standalone prosody gating. */
export function phonoGateInfo(r: PronScores | null): PhonoGateInfo {
  const v = r ? overall(r) : null;
  if (v === null) return { level: null, rawLevel: null, gatedBy: null };
  const rawLevel = v >= PHONO_THRESHOLDS.b2PlusOverall ? 5 : v >= PHONO_THRESHOLDS.b2Overall ? 3 : v >= PHONO_THRESHOLDS.b1Overall ? 1 : 0;
  let level = rawLevel;
  let gatedBy: PhonoGateInfo["gatedBy"] = null;
  if (r && r.prosody !== null) {
    if (level === 5 && r.prosody < PHONO_THRESHOLDS.b2PlusProsody) {
      level = 3;
      gatedBy = "prosody";
    }
    if (level === 3 && r.prosody < PHONO_THRESHOLDS.b2Prosody) {
      level = 1;
      gatedBy = "prosody";
    }
  }
  if (r && level === 5 && ((r.accuracy !== null && r.accuracy < PHONO_THRESHOLDS.b2PlusAccuracy) || (r.fluency !== null && r.fluency < PHONO_THRESHOLDS.b2PlusFluency))) {
    level = 3;
    if (!gatedBy) gatedBy = "accuracy_or_fluency";
  }
  return { level, rawLevel, gatedBy };
}

/**
 * The grid's fifth criterion (phonologie, 0/1/3/5) with tightened thresholds and standalone prosody gating.
 */
export function phonoLevel(r: PronScores | null): number | null {
  return phonoGateInfo(r).level;
}

export type PhonemeCategoryId = "yu" | "nasal" | "r" | "liaison";

export interface PhonemeInsight {
  id: PhonemeCategoryId;
  label: string;
  tip: string;
  avg: number;
  count: number;
  weakCount: number;
  examples: string[];
}

const YU_PHONEME_RE = /^(y|ɥ|u|ʏ|ʉ)$/i;
const NASAL_PHONEME_RE = /\u0303|^(a~|aa~|an|e~|eh~|en|in|o~|ao~|on|oe~|un|ɑ̃|ɛ̃|ɔ̃|œ̃|ã|ẽ|õ)$/i;
const R_PHONEME_RE = /^(ʁ|r|ʀ|ɣ)$/i;
const WEAK_PHONEME = 70;

/**
 * Aggregate high-error French sound categories for Chinese learners from phoneme-level scores and obligatory
 * liaisons: /y/-/u/ distinction, nasal vowels, uvular /ʁ/, and liaison breaks/misses.
 */
export function phonemeInsights(words: readonly PronWord[]): PhonemeInsight[] {
  const buckets: Record<PhonemeCategoryId, { label: string; tip: string; scores: number[]; examples: Set<string> }> = {
    yu: { label: "/y/ 与 /u/ 区分", tip: "发 u (/y/) 时双唇撮圆前伸、舌位靠前；发 ou (/u/) 时舌位后缩，避免 tu/tout 混淆。", scores: [], examples: new Set() },
    nasal: { label: "鼻化元音", tip: "发 an/en/in/on/un 时软腭下垂鼻腔共鸣，收尾不要带出明显 /n/ 或 /ŋ/ 尾音。", scores: [], examples: new Set() },
    r: { label: "小舌音 /ʁ/", tip: "舌根轻贴小舌产生温和摩擦，避免发成英语卷舌 r 或汉语 h。", scores: [], examples: new Set() },
    liaison: { label: "联诵与连音", tip: "必须联诵处（如 les‿amis、nous‿avons）不要无故停顿，将尾辅音自然连到下一词首元音。", scores: [], examples: new Set() },
  };
  for (const w of words) {
    for (const p of w.phonemes ?? []) {
      const sym = p.phoneme.trim();
      const cat: PhonemeCategoryId | null = YU_PHONEME_RE.test(sym) ? "yu" : NASAL_PHONEME_RE.test(sym) ? "nasal" : R_PHONEME_RE.test(sym) ? "r" : null;
      if (!cat) continue;
      buckets[cat].scores.push(p.accuracy);
      if (p.accuracy < WEAK_PHONEME) buckets[cat].examples.add(`${w.word} (${Math.round(p.accuracy)})`);
    }
  }
  for (let i = 0; i + 1 < words.length; i++) {
    const a = words[i];
    const b = words[i + 1];
    if (!liaisonPoints(`${a.word} ${b.word}`).length) continue;
    const broken = a.error === "UnexpectedBreak" || b.error === "UnexpectedBreak";
    const s = broken ? Math.min(a.accuracy, b.accuracy, 45) : Math.round((a.accuracy + b.accuracy) / 2);
    buckets.liaison.scores.push(s);
    if (broken || s < WEAK_PHONEME) buckets.liaison.examples.add(`${a.word}‿${b.word} (${Math.round(s)})`);
  }
  return (Object.keys(buckets) as PhonemeCategoryId[])
    .filter((id) => buckets[id].scores.length > 0)
    .map((id) => {
      const b = buckets[id];
      const avg = Math.round(b.scores.reduce((sum, x) => sum + x, 0) / b.scores.length);
      const weakCount = b.scores.filter((x) => x < WEAK_PHONEME).length;
      return { id, label: b.label, tip: b.tip, avg, count: b.scores.length, weakCount, examples: [...b.examples].slice(0, 4) };
    })
    .sort((a, b) => a.avg - b.avg);
}

/** Select up to `maxCount` representative debate turns (first, last, and longest middle turns). */
export function sampleDebateTakes<T extends { seconds: number }>(items: [number, T][], maxCount = 4): [number, T][] {
  const valid = items.filter(([, t]) => t.seconds >= 2);
  if (valid.length <= maxCount) return valid;
  const chosen = new Map<number, [number, T]>();
  chosen.set(valid[0][0], valid[0]);
  chosen.set(valid[valid.length - 1][0], valid[valid.length - 1]);
  const middle = valid.slice(1, -1).sort((a, b) => b[1].seconds - a[1].seconds);
  for (const item of middle) {
    if (chosen.size >= maxCount) break;
    chosen.set(item[0], item);
  }
  return [...chosen.values()].sort((a, b) => a[0] - b[0]);
}

/** Pick up to `maxCount` answered debate recordings that have not yet been assessed by Azure. */
export function pendingDebateSamples<T extends { seconds: number }>(
  turns: readonly { a: string }[],
  takes: Record<number, T>,
  assessed: Record<number, PronResult>,
  maxCount = 4,
): [number, T][] {
  const candidates = Object.entries(takes)
    .map(([k, t]) => [Number(k), t] as [number, T])
    .filter(([k]) => !!turns[k]?.a.trim() && !assessed[k]);
  return sampleDebateTakes(candidates, maxCount);
}

/**
 * Combine monologue and debate pronunciation results with balanced weighting (debate weighted 40%–60% when
 * both parts exist so spontaneous interaction always contributes meaningfully alongside the prepared monologue).
 */
export function combineSpeakingProns(monologue: PronResult | null, debateParts: PronResult[]): PronResult | null {
  const debate = aggregate(debateParts);
  if (!monologue) return debate;
  if (!debate) return monologue;
  const monoSec = Math.max(1, monologue.seconds);
  const debSec = Math.max(1, debate.seconds);
  const wDebate = Math.min(0.6, Math.max(0.4, debSec / (monoSec + debSec)));
  const wMono = 1 - wDebate;
  const blend = (k: keyof PronScores) => {
    const a = monologue[k];
    const b = debate[k];
    if (a === null && b === null) return null;
    if (a === null) return b;
    if (b === null) return a;
    return Math.round((a * wMono + b * wDebate) * 10) / 10;
  };
  return {
    pron: blend("pron"),
    accuracy: blend("accuracy"),
    fluency: blend("fluency"),
    prosody: blend("prosody"),
    completeness: blend("completeness"),
    text: [monologue.text, debate.text].filter(Boolean).join(" "),
    seconds: monologue.seconds + debate.seconds,
    words: [...monologue.words, ...debate.words],
  };
}
