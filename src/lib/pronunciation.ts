/**
 * Azure pronunciation assessment (fr-FR, unscripted or scripted) & Whisper Tier-2 word-timestamp fallback:
 * the request header (Phoneme granularity + IPA + NBestPhonemeCount=5), parsing per-word timestamps & IPA
 * candidates, IPA + acoustic liaison verification, deterministic prosody/rate/pause/freeze analysis,
 * 0.5-point DELF B2 phonologie gating, and combining monologue + debate recordings. Pure functions.
 */
import {
  classifyWordBoundaryLiaison,
  type ForbiddenLiaisonReason,
  type LiaisonConsonant,
} from "./liaison";

export interface NBestPhoneme {
  phoneme: string;
  /** 0–100 */
  score: number;
}

export interface PhonemeScore {
  phoneme: string;
  /** 0–100 */
  accuracy: number;
  /** Top-N decoded IPA phoneme candidates when NBestPhonemeCount is enabled. */
  nBest?: NBestPhoneme[];
}

export interface PronWord {
  word: string;
  /** 0–100 */
  accuracy: number;
  /** Azure's ErrorType: None, Mispronunciation, UnexpectedBreak, MissingBreak, Monotone, … */
  error: string;
  /** Global start offset from the beginning of the recording in milliseconds. */
  offsetMs?: number;
  /** Word duration in milliseconds. */
  durationMs?: number;
  /** Phoneme-level scores when Granularity === "Phoneme". */
  phonemes?: PhonemeScore[];
  /** Per-phoneme N-best candidate arrays aligned with `phonemes`. */
  nBestPhonemes?: NBestPhoneme[][];
  /** Internal marker set when stitching separate takes so inter-take gaps are not counted as freezes. */
  segmentStart?: boolean;
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
  /** What the service heard (DisplayText / Display). */
  text: string;
  /** Unpunctuated verbatim recognition (Azure `best.Lexical` or Whisper verbatim prompt output). */
  lexicalText?: string;
  /** True when IPA phoneme & accuracy assessment is supported (Azure Tier-1); false for Whisper Tier-2. */
  phonemeSupported?: boolean;
  /** Seconds of speech that were assessed. */
  seconds: number;
  words: PronWord[];
}

export interface ParseAssessmentOptions {
  /** Chunk start offset in milliseconds so multi-chunk recordings keep global word timestamps. */
  offsetMs?: number;
  /** Scripted reference text; when empty/omitted, unscripted `completeness` is forced to `null`. */
  referenceText?: string;
}

export interface SpeakingAcoustics {
  speechRateWpm?: number;
  articulationRateWpm?: number;
  pauseRatio?: number;
  longFreezeCount?: number;
  midConstituentBreaks?: number;
  likelyReadAloud?: boolean;
  obligatoryLiaisonsMissed?: number;
  forbiddenLiaisonsMade?: number;
  phonemeAlerts?: string[];
}

export interface WordBoundaryDiag {
  /** Index `i` between `words[i]` and `words[i + 1]`. */
  afterIndex: number;
  gapMs?: number;
  /** Pause duration in seconds when `gapMs >= 1000` (rendered as `⏸` badge). */
  pauseBadgeSec?: number;
  isPause?: boolean;
  isLongFreeze?: boolean;
  midConstituentBreak?: boolean;
  liaison?: {
    kind: "obligatory" | "forbidden";
    consonant: LiaisonConsonant;
    reason?: ForbiddenLiaisonReason;
    status: "ok" | "missed" | "violated";
    score: number;
  };
}

export const SCORE_KEYS = ["accuracy", "fluency", "prosody", "completeness"] as const;
export const SCORE_LABEL: Record<keyof PronScores, string> = { pron: "总分", accuracy: "准确度", fluency: "流利度", prosody: "韵律（语调重音）", completeness: "完整度" };
export const SCORE_HINT: Record<keyof PronScores, string> = {
  pron: "几项的综合",
  accuracy: "每个音发得像不像母语者",
  fluency: "停顿是否自然、语速是否连贯",
  prosody: "语调、重音、节奏",
  completeness: "跟读原句读出了多少词（自由独白不计此项）",
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
    NBestPhonemeCount: 5,
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
const snapHalf = (n: number) => Math.round(Math.max(0, Math.min(5, n)) * 2) / 2;

/**
 * One answer of the recognition endpoint (format=detailed). Captures `lexicalText` (`best.Lexical`),
 * shifts per-word `Offset` by `opts.offsetMs`, preserves `Phonemes` + `NBestPhonemes`, and sets
 * `completeness` to `null` for unscripted speech (`!opts?.referenceText`).
 */
export function parseAssessment(raw: unknown, opts?: ParseAssessmentOptions): PronResult | null {
  if (!isObj(raw) || raw.RecognitionStatus !== "Success") return null;
  const best = Array.isArray(raw.NBest) && isObj(raw.NBest[0]) ? raw.NBest[0] : null;
  if (!best) return null;
  const chunkOffsetMs =
    typeof opts?.offsetMs === "number" && Number.isFinite(opts.offsetMs) && opts.offsetMs > 0
      ? Math.round(opts.offsetMs)
      : 0;
  const hasReference = typeof opts?.referenceText === "string" && opts.referenceText.trim().length > 0;
  const pa = isObj(best.PronunciationAssessment) ? best.PronunciationAssessment : best;
  const words: PronWord[] = [];
  for (const w of Array.isArray(best.Words) ? best.Words : []) {
    if (!isObj(w) || typeof w.Word !== "string") continue;
    const wpa = isObj(w.PronunciationAssessment) ? w.PronunciationAssessment : w;
    const accuracy = score(wpa.AccuracyScore);
    if (accuracy === null) continue;
    const phonemes: PhonemeScore[] = [];
    const wordNBest: NBestPhoneme[][] = [];
    let hasAnyNBest = false;
    for (const p of Array.isArray(w.Phonemes) ? w.Phonemes : []) {
      if (!isObj(p) || typeof p.Phoneme !== "string") continue;
      const ppa = isObj(p.PronunciationAssessment) ? p.PronunciationAssessment : p;
      const pAcc = score(ppa.AccuracyScore);
      const sym = p.Phoneme.trim().slice(0, 16);
      if (pAcc === null || !sym) continue;
      const rawNBest = Array.isArray(ppa.NBestPhonemes)
        ? ppa.NBestPhonemes
        : Array.isArray(p.NBestPhonemes)
          ? p.NBestPhonemes
          : [];
      const nBest: NBestPhoneme[] = [];
      for (const cand of rawNBest) {
        if (!isObj(cand) || typeof cand.Phoneme !== "string") continue;
        const cSym = cand.Phoneme.trim().slice(0, 16);
        const cScore = score(cand.Score);
        if (cSym && cScore !== null) nBest.push({ phoneme: cSym, score: cScore });
      }
      if (nBest.length > 0) hasAnyNBest = true;
      wordNBest.push(nBest);
      phonemes.push({
        phoneme: sym,
        accuracy: pAcc,
        ...(nBest.length ? { nBest } : {}),
      });
    }
    const offsetMs =
      typeof w.Offset === "number" && Number.isFinite(w.Offset) && w.Offset >= 0
        ? Math.round(w.Offset / 10_000) + chunkOffsetMs
        : undefined;
    const durationMs =
      typeof w.Duration === "number" && Number.isFinite(w.Duration) && w.Duration >= 0
        ? Math.round(w.Duration / 10_000)
        : undefined;
    words.push({
      word: w.Word.slice(0, 60),
      accuracy,
      error: typeof wpa.ErrorType === "string" ? wpa.ErrorType : "None",
      ...(offsetMs !== undefined ? { offsetMs } : {}),
      ...(durationMs !== undefined ? { durationMs } : {}),
      ...(phonemes.length ? { phonemes } : {}),
      ...(hasAnyNBest ? { nBestPhonemes: wordNBest } : {}),
    });
  }
  const text = typeof raw.DisplayText === "string" ? raw.DisplayText : typeof best.Display === "string" ? best.Display : "";
  const lexical = typeof best.Lexical === "string" && best.Lexical.trim() ? best.Lexical.trim() : undefined;
  // Duration is in units of 100 ns
  const ticks = Number(raw.Duration);
  return {
    pron: score(pa.PronScore),
    accuracy: score(pa.AccuracyScore),
    fluency: score(pa.FluencyScore),
    prosody: score(pa.ProsodyScore),
    completeness: hasReference ? score(pa.CompletenessScore) : null,
    text: text.trim(),
    ...(lexical ? { lexicalText: lexical } : {}),
    phonemeSupported: true,
    seconds: Number.isFinite(ticks) && ticks > 0 ? ticks / 1e7 : 0,
    words,
  };
}

/**
 * Parse an OpenAI / Whisper `verbose_json` (or fallback `json`) transcription payload into a Tier-2 `PronResult`
 * with verbatim text + word-level timestamps (`phonemeSupported: false`, `accuracy: null`).
 */
export function parseWhisperVerbose(raw: unknown, fallbackSeconds = 0): PronResult | null {
  if (!isObj(raw)) return null;
  const text = typeof raw.text === "string" ? raw.text.trim() : "";
  const rawWords = Array.isArray(raw.words) ? raw.words : [];
  const words: PronWord[] = [];
  let maxEndSec = 0;
  for (const w of rawWords) {
    if (!isObj(w) || typeof w.word !== "string") continue;
    const clean = w.word.trim().slice(0, 60);
    if (!clean) continue;
    const startSec = typeof w.start === "number" && Number.isFinite(w.start) && w.start >= 0 ? w.start : undefined;
    const endSec = typeof w.end === "number" && Number.isFinite(w.end) && w.end >= 0 ? w.end : undefined;
    if (endSec !== undefined && endSec > maxEndSec) maxEndSec = endSec;
    const offsetMs = startSec !== undefined ? Math.round(startSec * 1000) : undefined;
    const durationMs =
      startSec !== undefined && endSec !== undefined && endSec >= startSec
        ? Math.round((endSec - startSec) * 1000)
        : undefined;
    words.push({
      word: clean,
      accuracy: 100,
      error: "None",
      ...(offsetMs !== undefined ? { offsetMs } : {}),
      ...(durationMs !== undefined ? { durationMs } : {}),
    });
  }
  const reconstructed = text || words.map((w) => w.word).join(" ");
  if (!reconstructed) return null;
  const durField = typeof raw.duration === "number" && Number.isFinite(raw.duration) && raw.duration > 0 ? raw.duration : 0;
  const seconds = durField || maxEndSec || Math.max(0, fallbackSeconds);
  return {
    pron: null,
    accuracy: null,
    fluency: null,
    prosody: null,
    completeness: null,
    text: reconstructed,
    lexicalText: reconstructed,
    phonemeSupported: false,
    seconds: Math.round(seconds * 100) / 100,
    words,
  };
}

function mergeWordsWithOffsets(parts: readonly PronResult[], separateSegments = false): PronWord[] {
  const merged: PronWord[] = [];
  let runningEndMs = 0;
  let runningSecMs = 0;
  for (let pIdx = 0; pIdx < parts.length; pIdx++) {
    const p = parts[pIdx];
    if (!p.words.length) {
      runningSecMs += Math.max(0, Math.round(p.seconds * 1000));
      continue;
    }
    const firstOff = p.words[0].offsetMs;
    const needsShift =
      pIdx > 0 &&
      firstOff !== undefined &&
      (separateSegments || firstOff < runningEndMs);
    const shiftMs = needsShift ? Math.max(runningEndMs + 250, runningSecMs) : 0;
    p.words.forEach((w, wIdx) => {
      const nextOff = w.offsetMs !== undefined ? w.offsetMs + shiftMs : undefined;
      const end = nextOff !== undefined ? nextOff + (w.durationMs ?? 0) : undefined;
      if (end !== undefined && end > runningEndMs) runningEndMs = end;
      merged.push({
        ...w,
        ...(nextOff !== undefined ? { offsetMs: nextOff } : {}),
        ...(pIdx > 0 && wIdx === 0 && (separateSegments || needsShift) ? { segmentStart: true } : {}),
      });
    });
    runningSecMs += Math.max(0, Math.round(p.seconds * 1000));
  }
  return merged;
}

/**
 * The pieces of one recording as one result: each score is the mean of the pieces weighted by their length
 * (pieces that lack a score do not count for it), the texts joined, the words kept in order with global offsets.
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
  const anyLexical = parts.some((p) => !!p.lexicalText);
  const lexicalJoined = anyLexical
    ? parts
        .map((p) => p.lexicalText || p.text)
        .filter(Boolean)
        .join(" ")
    : undefined;
  const hasExplicitSupport = parts.some((p) => p.phonemeSupported !== undefined);
  const phonemeSupported = hasExplicitSupport ? parts.some((p) => p.phonemeSupported !== false) : undefined;
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
    ...(lexicalJoined ? { lexicalText: lexicalJoined } : {}),
    ...(phonemeSupported !== undefined ? { phonemeSupported } : {}),
    seconds: parts.reduce((n, p) => n + p.seconds, 0),
    words: mergeWordsWithOffsets(parts, false),
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

/* ---------- Syntactic Constituent & IPA Liaison Verification ---------- */

const PREPOSITIONS = new Set([
  "à", "de", "dans", "en", "sur", "sous", "pour", "par", "avec", "sans", "chez", "vers",
  "entre", "contre", "devant", "derrière", "avant", "après", "pendant", "depuis", "selon",
  "malgré", "envers", "parmi", "hors", "dès",
]);

const DETERMINERS_NP = new Set([
  "le", "la", "les", "un", "une", "des", "du", "au", "aux", "ce", "cet", "cette", "ces",
  "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "notre", "nos", "votre", "vos",
  "leur", "leurs", "chaque", "quelque", "quelques", "plusieurs", "aucun", "aucune",
  "certains", "certaines", "quel", "quelle", "quels", "quelles",
]);

const SUBJ_PRONOUNS = new Set(["je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles"]);

const NON_COMPLEMENT_WORDS = new Set([
  "euh", "heu", "hum", "ben", "bah", "et", "ou", "mais", "donc", "or", "ni", "car",
  "cependant", "toutefois", "néanmoins", "pourtant", "qui", "que", "quoi",
]);

const normToken = (s: string) =>
  s
    .toLowerCase()
    .replace(/^[«"“([{#]+/, "")
    .replace(/[^a-zà-ÿœæ'’-]+$/, "");

/** True when `(leftWord, rightWord)` sits inside a tight `Det+Noun`, `SubjPron+Verb`, or `Prep+Det` constituent. */
function isTightConstituentPair(leftRaw: string, rightRaw: string): boolean {
  const leftFull = normToken(leftRaw);
  const rightFull = normToken(rightRaw);
  if (!leftFull || !rightFull) return false;
  const rightBare = rightFull.replace(/^.*['’]/, "");
  if (!rightBare || NON_COMPLEMENT_WORDS.has(rightBare)) return false;

  const leftUnelided = leftFull.replace(/^(?:qu|parce\s*qu|puisqu|lorsqu)['’]/, "");
  // Prep + Det (including elided l' / d')
  if (PREPOSITIONS.has(leftFull)) {
    if (DETERMINERS_NP.has(rightFull) || /^(?:l|d)['’]/.test(rightFull)) return true;
  }
  // SubjPron + Verb (or preverbal clitic)
  if (SUBJ_PRONOUNS.has(leftUnelided) && !leftUnelided.includes("-")) {
    return true;
  }
  // Det + Noun / prenominal Adj
  if (DETERMINERS_NP.has(leftFull)) {
    if (!PREPOSITIONS.has(rightFull)) return true;
  }
  return false;
}

function matchesObligatoryConsonant(sym: string, expected: LiaisonConsonant): boolean {
  const s = sym.trim();
  if (expected === "z") return s === "z";
  if (expected === "n") return s === "n" || s === "ɲ";
  if (expected === "t") return s === "t";
  if (expected === "ʁ") return /^(?:ʁ|r|ʀ|ɣ)$/i.test(s);
  if (expected === "v") return s === "v";
  return false;
}

function matchesForbiddenConsonant(sym: string, forbidden: LiaisonConsonant): boolean {
  const s = sym.trim();
  if (forbidden === "z") return s === "z" || s === "s";
  if (forbidden === "n") return s === "n" || s === "ɲ";
  if (forbidden === "t") return s === "t" || s === "d";
  if (forbidden === "ʁ") return /^(?:ʁ|r|ʀ|ɣ)$/i.test(s);
  if (forbidden === "v") return s === "v" || s === "f";
  return false;
}

function findBoundaryConsonantScore(
  a: PronWord,
  b: PronWord,
  matcher: (sym: string) => boolean,
  minPrimaryAcc: number,
  minNBestScore: number,
): number | null {
  const checkSlot = (p: PhonemeScore | undefined, nbList: NBestPhoneme[] | undefined): number | null => {
    if (p && matcher(p.phoneme) && p.accuracy >= minPrimaryAcc) return p.accuracy;
    const cands = nbList ?? p?.nBest ?? [];
    for (const c of cands) {
      if (matcher(c.phoneme) && c.score >= minNBestScore) return c.score;
    }
    return null;
  };
  const lastIdx = (a.phonemes?.length ?? 0) - 1;
  if (lastIdx >= 0) {
    const hitA = checkSlot(a.phonemes?.[lastIdx], a.nBestPhonemes?.[lastIdx]);
    if (hitA !== null) return hitA;
  }
  if ((b.phonemes?.length ?? 0) > 0) {
    const hitB = checkSlot(b.phonemes?.[0], b.nBestPhonemes?.[0]);
    if (hitB !== null) return hitB;
  }
  return null;
}

/**
 * Evaluate acoustic pauses, syntactic constituent breaks, and IPA-verified obligatory / forbidden liaisons
 * across every adjacent word boundary in `words`.
 */
export function evaluateWordBoundaries(words: readonly PronWord[], phonemeSupported = true): WordBoundaryDiag[] {
  const out: WordBoundaryDiag[] = [];
  for (let i = 0; i + 1 < words.length; i++) {
    const a = words[i];
    const b = words[i + 1];
    if (b.segmentStart) continue;

    const hasTiming = a.offsetMs !== undefined && b.offsetMs !== undefined;
    const gapMs = hasTiming ? Math.max(0, b.offsetMs! - (a.offsetMs! + (a.durationMs ?? 0))) : undefined;
    const isPause = gapMs !== undefined && gapMs >= 400;
    const isLongFreeze = gapMs !== undefined && gapMs >= 2000;
    const pauseBadgeSec = gapMs !== undefined && gapMs >= 1000 ? Math.round(gapMs / 100) / 10 : undefined;
    const midConstituentBreak = gapMs !== undefined && gapMs > 300 && isTightConstituentPair(a.word, b.word);

    const prevWord = i > 0 && !a.segmentStart ? words[i - 1].word : undefined;
    const site = classifyWordBoundaryLiaison(a.word, b.word, prevWord);
    let liaison: WordBoundaryDiag["liaison"];

    if (site && phonemeSupported) {
      const hasBoundaryIpa = Boolean((a.phonemes && a.phonemes.length > 0) || (b.phonemes && b.phonemes.length > 0));
      const breakFlag = a.error === "UnexpectedBreak" || b.error === "UnexpectedBreak";

      if (site.kind === "obligatory") {
        const gapOk = !breakFlag && (gapMs === undefined || gapMs <= 140);
        const consonantScore = hasBoundaryIpa
          ? findBoundaryConsonantScore(a, b, (sym) => matchesObligatoryConsonant(sym, site.consonant), 40, 20)
          : null;
        const realized = gapOk && (!hasBoundaryIpa || consonantScore !== null);
        const s = realized
          ? Math.round(consonantScore ?? (a.accuracy + b.accuracy) / 2)
          : Math.min(a.accuracy, b.accuracy, 38);
        liaison = {
          kind: "obligatory",
          consonant: site.consonant,
          status: realized ? "ok" : "missed",
          score: s,
        };
      } else {
        // Forbidden liaison (*liaison interdite* / *h aspiré*): check if false consonant surfaced across narrow boundary
        const linkedEnough = !breakFlag && (gapMs === undefined || gapMs <= 180);
        const intrudingScore =
          linkedEnough && hasBoundaryIpa
            ? findBoundaryConsonantScore(a, b, (sym) => matchesForbiddenConsonant(sym, site.consonant), 45, 35)
            : null;
        const violated = intrudingScore !== null;
        liaison = {
          kind: "forbidden",
          consonant: site.consonant,
          reason: site.reason,
          status: violated ? "violated" : "ok",
          score: violated ? 25 : 95,
        };
      }
    }

    if (gapMs !== undefined || liaison) {
      out.push({
        afterIndex: i,
        ...(gapMs !== undefined ? { gapMs } : {}),
        ...(pauseBadgeSec !== undefined ? { pauseBadgeSec } : {}),
        ...(isPause ? { isPause: true } : {}),
        ...(isLongFreeze ? { isLongFreeze: true } : {}),
        ...(midConstituentBreak ? { midConstituentBreak: true } : {}),
        ...(liaison ? { liaison } : {}),
      });
    }
  }
  return out;
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
 * Aggregate high-error French sound categories for Chinese learners from phoneme-level scores and
 * IPA + acoustic boundary verification (obligatory liaisons missed + forbidden / *h aspiré* liaisons made).
 */
export function phonemeInsights(words: readonly PronWord[]): PhonemeInsight[] {
  const buckets: Record<PhonemeCategoryId, { label: string; tip: string; scores: number[]; examples: Set<string> }> = {
    yu: { label: "/y/ 与 /u/ 区分", tip: "发 u (/y/) 时双唇撮圆前伸、舌位靠前；发 ou (/u/) 时舌位后缩，避免 tu/tout 混淆。", scores: [], examples: new Set() },
    nasal: { label: "鼻化元音", tip: "发 an/en/in/on/un 时软腭下垂鼻腔共鸣，收尾不要带出明显 /n/ 或 /ŋ/ 尾音。", scores: [], examples: new Set() },
    r: { label: "小舌音 /ʁ/", tip: "舌根轻贴小舌产生温和摩擦，避免发成英语卷舌 r 或汉语 h。", scores: [], examples: new Set() },
    liaison: { label: "联诵与禁忌联诵", tip: "必须联诵处（les‿amis）须紧接且发出辅音；et 后、单数名词后及嘘音 h（les | héros）严禁联诵。", scores: [], examples: new Set() },
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
  const boundaries = evaluateWordBoundaries(words, true);
  for (const b of boundaries) {
    if (!b.liaison) continue;
    const left = words[b.afterIndex];
    const right = words[b.afterIndex + 1];
    if (b.liaison.kind === "obligatory") {
      buckets.liaison.scores.push(b.liaison.score);
      if (b.liaison.status === "missed" || b.liaison.score < WEAK_PHONEME) {
        buckets.liaison.examples.add(`${left.word}‿${right.word} (${Math.round(b.liaison.score)})`);
      }
    } else if (b.liaison.status === "violated") {
      buckets.liaison.scores.push(b.liaison.score);
      buckets.liaison.examples.add(`${left.word}×${right.word} (禁联诵)`);
    }
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

/* ---------- Deterministic Prosody & Acoustic Summary ---------- */

const tokenizeForNgrams = (s: string): string[] =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9]+/g) ?? [];

/** Ratio (0..1) of 4-grams in `transcript` that appear verbatim in `notes`. */
export function fourGramOverlapRatio(transcript: string, notes: string): number {
  const tTokens = tokenizeForNgrams(transcript);
  const nTokens = tokenizeForNgrams(notes);
  if (tTokens.length < 4 || nTokens.length < 4) return 0;
  const note4 = new Set<string>();
  for (let i = 0; i + 4 <= nTokens.length; i++) {
    note4.add(`${nTokens[i]} ${nTokens[i + 1]} ${nTokens[i + 2]} ${nTokens[i + 3]}`);
  }
  const total = tTokens.length - 3;
  let hits = 0;
  for (let i = 0; i < total; i++) {
    if (note4.has(`${tTokens[i]} ${tTokens[i + 1]} ${tTokens[i + 2]} ${tTokens[i + 3]}`)) hits++;
  }
  return hits / total;
}

function stdDev(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((s, x) => s + (x - mean) * (x - mean), 0) / xs.length;
  return Math.sqrt(variance);
}

/**
 * Compute deterministic oral prosody, fluency, read-aloud, and liaison telemetry from a `PronResult`
 * (works for both Tier-1 Azure Speech and Tier-2 Whisper `verbose_json`).
 */
export function summarizeAcoustics(r: PronResult | null, notes?: string): SpeakingAcoustics | null {
  if (!r) return null;
  const textSource = (r.lexicalText || r.text || "").trim();
  const textWordCount = (textSource.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
  const wordCount = r.words.length > 0 ? r.words.length : textWordCount;
  if (wordCount === 0 && r.seconds <= 0) return null;

  const phonoSupported = r.phonemeSupported !== false;
  const boundaries = evaluateWordBoundaries(r.words, phonoSupported);

  // Sum active span across contiguous timed word segments
  let segSpanMs = 0;
  let timedWords = 0;
  let segFirst: number | null = null;
  let segLastEnd = 0;
  for (const w of r.words) {
    if (w.offsetMs === undefined) continue;
    timedWords++;
    if (w.segmentStart || segFirst === null) {
      if (segFirst !== null && segLastEnd > segFirst) segSpanMs += segLastEnd - segFirst;
      segFirst = w.offsetMs;
      segLastEnd = w.offsetMs + (w.durationMs ?? 0);
    } else {
      segLastEnd = Math.max(segLastEnd, w.offsetMs + (w.durationMs ?? 0));
    }
  }
  if (segFirst !== null && segLastEnd > segFirst) segSpanMs += segLastEnd - segFirst;

  const totalMs = Math.max(segSpanMs, Math.round(r.seconds * 1000));
  const speechRateWpm = totalMs >= 1000 && wordCount > 0 ? Math.round((wordCount / (totalMs / 1000)) * 60) : undefined;

  const timedGaps = boundaries.map((b) => b.gapMs).filter((g): g is number => g !== undefined);
  let pauseRatio: number | undefined;
  let articulationRateWpm: number | undefined;
  let longFreezeCount: number | undefined;
  let midConstituentBreaks: number | undefined;

  if (timedGaps.length > 0 && segSpanMs > 0) {
    const pauseMs = timedGaps.filter((g) => g >= 400).reduce((a, b) => a + b, 0);
    const denomMs = Math.max(segSpanMs, totalMs);
    pauseRatio = Math.round(Math.min(1, pauseMs / denomMs) * 1000) / 1000;
    const phonationMs = Math.max(500, denomMs - pauseMs);
    articulationRateWpm = Math.round(((timedWords || wordCount) / (phonationMs / 1000)) * 60);
    longFreezeCount = boundaries.filter((b) => b.isLongFreeze).length;
    midConstituentBreaks = boundaries.filter((b) => b.midConstituentBreak).length;
  }

  const gapStd = stdDev(timedGaps);
  const clausePauses = timedGaps.filter((g) => g >= 250);
  const pauseStd = stdDev(clausePauses);
  const lowPauseVariance =
    timedGaps.length >= 6 &&
    (longFreezeCount ?? 0) === 0 &&
    (gapStd <= 150 || (clausePauses.length <= 1 && (pauseRatio ?? 0) < 0.06) || (clausePauses.length >= 2 && pauseStd < 120 && (pauseRatio ?? 0) < 0.15));
  const fastMonotoneReadAloud = speechRateWpm !== undefined && speechRateWpm > 155 && wordCount >= 12 && lowPauseVariance;
  const notesOverlapReadAloud = !!(notes && notes.trim() && fourGramOverlapRatio(textSource, notes) >= 0.45);
  const likelyReadAloud = fastMonotoneReadAloud || notesOverlapReadAloud;

  let obligatoryLiaisonsMissed: number | undefined;
  let forbiddenLiaisonsMade: number | undefined;
  let phonemeAlerts: string[] | undefined;

  if (phonoSupported && r.words.length > 0) {
    obligatoryLiaisonsMissed = boundaries.filter((b) => b.liaison?.kind === "obligatory" && b.liaison.status === "missed").length;
    forbiddenLiaisonsMade = boundaries.filter((b) => b.liaison?.kind === "forbidden" && b.liaison.status === "violated").length;
    const alerts = phonemeInsights(r.words)
      .filter((ins) => ins.weakCount > 0 || ins.avg < WEAK_PHONEME)
      .map((ins) => `${ins.label} ${ins.avg}/100${ins.examples.length ? ` (${ins.examples.slice(0, 2).join(", ")})` : ""}`)
      .slice(0, 6);
    if (alerts.length > 0) phonemeAlerts = alerts;
  }

  return {
    ...(speechRateWpm !== undefined ? { speechRateWpm } : {}),
    ...(articulationRateWpm !== undefined ? { articulationRateWpm } : {}),
    ...(pauseRatio !== undefined ? { pauseRatio } : {}),
    ...(longFreezeCount !== undefined ? { longFreezeCount } : {}),
    ...(midConstituentBreaks !== undefined ? { midConstituentBreaks } : {}),
    likelyReadAloud,
    ...(obligatoryLiaisonsMissed !== undefined ? { obligatoryLiaisonsMissed } : {}),
    ...(forbiddenLiaisonsMade !== undefined ? { forbiddenLiaisonsMade } : {}),
    ...(phonemeAlerts ? { phonemeAlerts } : {}),
  };
}

/* ---------- 0.5-Point DELF B2 Phonologie Grid & Gating ---------- */

/** Calibrated phonoLevel & prosody gating thresholds on the 0.5-step [0..5] DELF B2 scale. */
export const PHONO_THRESHOLDS = {
  b2PlusOverall: 88,
  b2HighOverall: 84,
  strongB2Overall: 80,
  b2MidOverall: 75,
  b2Overall: 70,
  b1HighOverall: 62,
  b1PlusOverall: 55,
  b1MidOverall: 45,
  b1Overall: 35,
  a2Overall: 20,
  b2PlusProsody: 80,
  b2HighProsody: 76,
  strongB2Prosody: 72,
  b2MidProsody: 68,
  b2Prosody: 65,
  b1HighProsody: 58,
  b1PlusProsody: 50,
  b2PlusAccuracy: 80,
  b2PlusFluency: 78,
} as const;

export interface PhonoGateInfo {
  level: number | null;
  rawLevel: number | null;
  gatedBy: "prosody" | "accuracy_or_fluency" | "acoustics" | null;
}

function isFullPronResult(r: PronScores): r is PronResult {
  return "words" in r && Array.isArray((r as PronResult).words);
}

/**
 * Evaluate criterion 5 (phonologie: 0–5 in 0.5 increments) with standalone prosody gating
 * and deterministic acoustic rate/pause/freeze gating whenever `r.prosody === null`.
 */
export function phonoGateInfo(r: PronScores | null): PhonoGateInfo {
  if (!r) return { level: null, rawLevel: null, gatedBy: null };
  if (isFullPronResult(r) && r.phonemeSupported === false) {
    return { level: null, rawLevel: null, gatedBy: null };
  }
  const v = overall(r);
  if (v === null) return { level: null, rawLevel: null, gatedBy: null };
  const rawLevel =
    v >= PHONO_THRESHOLDS.b2PlusOverall
      ? 5
      : v >= PHONO_THRESHOLDS.b2HighOverall
        ? 4.5
        : v >= PHONO_THRESHOLDS.strongB2Overall
          ? 4
          : v >= PHONO_THRESHOLDS.b2MidOverall
            ? 3.5
            : v >= PHONO_THRESHOLDS.b2Overall
              ? 3
              : v >= PHONO_THRESHOLDS.b1HighOverall
                ? 2.5
                : v >= PHONO_THRESHOLDS.b1PlusOverall
                  ? 2
                  : v >= PHONO_THRESHOLDS.b1MidOverall
                    ? 1.5
                    : v >= PHONO_THRESHOLDS.b1Overall
                      ? 1
                      : v >= PHONO_THRESHOLDS.a2Overall
                        ? 0.5
                        : 0;
  let level = rawLevel;
  let gatedBy: PhonoGateInfo["gatedBy"] = null;

  if (r.prosody !== null) {
    if (level >= 4.5 && r.prosody < PHONO_THRESHOLDS.b2PlusProsody) {
      const cap =
        r.prosody >= PHONO_THRESHOLDS.b2HighProsody
          ? 4.5
          : r.prosody >= PHONO_THRESHOLDS.strongB2Prosody
            ? 4
            : r.prosody >= PHONO_THRESHOLDS.b2MidProsody
              ? 3.5
              : 3;
      if (cap < level) {
        level = cap;
        gatedBy = "prosody";
      }
    }
    if (level >= 3.5 && r.prosody < PHONO_THRESHOLDS.strongB2Prosody) {
      const cap = r.prosody >= PHONO_THRESHOLDS.b2MidProsody ? 3.5 : 3;
      if (cap < level) {
        level = cap;
        if (!gatedBy) gatedBy = "prosody";
      }
    }
    if (level >= 3 && r.prosody < PHONO_THRESHOLDS.b2Prosody) {
      const cap =
        r.prosody >= PHONO_THRESHOLDS.b1HighProsody
          ? 2.5
          : r.prosody >= PHONO_THRESHOLDS.b1PlusProsody
            ? 2
            : r.prosody >= 40
              ? 1.5
              : 1;
      if (cap < level) {
        level = cap;
        if (!gatedBy) gatedBy = "prosody";
      }
    }
  } else {
    // Deterministic prosody fallback when Azure ProsodyScore is absent/null
    const ac = isFullPronResult(r) && r.words.length >= 2 ? summarizeAcoustics(r) : null;
    if (ac) {
      let cap = level;
      if (
        (ac.pauseRatio !== undefined && ac.pauseRatio >= 0.42) ||
        (ac.longFreezeCount ?? 0) >= 3 ||
        (ac.speechRateWpm !== undefined && ac.speechRateWpm < 75)
      ) {
        cap = Math.min(cap, 2);
      } else if (
        (ac.pauseRatio !== undefined && ac.pauseRatio >= 0.28) ||
        (ac.longFreezeCount ?? 0) >= 2 ||
        (ac.speechRateWpm !== undefined && ac.speechRateWpm < 95) ||
        (ac.midConstituentBreaks ?? 0) >= 3
      ) {
        cap = Math.min(cap, 3);
      } else if (ac.likelyReadAloud) {
        cap = Math.min(cap, 3.5);
      } else if (
        (ac.pauseRatio !== undefined && ac.pauseRatio >= 0.2) ||
        (ac.longFreezeCount ?? 0) >= 1 ||
        (ac.speechRateWpm !== undefined && ac.speechRateWpm < 110)
      ) {
        cap = Math.min(cap, 4);
      }
      if (cap < level) {
        level = cap;
        gatedBy = "acoustics";
      }
    } else if (r.fluency !== null) {
      const cap = r.fluency < 50 ? 2 : r.fluency < 62 ? 2.5 : r.fluency < 70 ? 3.5 : r.fluency < 76 ? 4 : level;
      if (cap < level) {
        level = cap;
        gatedBy = "acoustics";
      }
    }
  }

  if (
    level >= 4.5 &&
    ((r.accuracy !== null && r.accuracy < PHONO_THRESHOLDS.b2PlusAccuracy) ||
      (r.fluency !== null && r.fluency < PHONO_THRESHOLDS.b2PlusFluency))
  ) {
    const cap =
      (r.accuracy === null || r.accuracy >= 76) && (r.fluency === null || r.fluency >= 74) ? 4.5 : 4;
    if (cap < level) {
      level = cap;
      if (!gatedBy) gatedBy = "accuracy_or_fluency";
    }
  }

  return { level: snapHalf(level), rawLevel: snapHalf(rawLevel), gatedBy };
}

/**
 * The grid's fifth criterion (phonologie, 0–5 in 0.5 increments) with prosody & deterministic acoustic gating.
 */
export function phonoLevel(r: PronScores | null): number | null {
  return phonoGateInfo(r).level;
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

/** Pick up to `maxCount` answered debate recordings that have not yet been assessed. */
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
  const debate = debateParts.length ? { ...aggregate(debateParts)!, words: mergeWordsWithOffsets(debateParts, true) } : null;
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
  const anyLexical = !!(monologue.lexicalText || debate.lexicalText);
  const phonemeSupported =
    monologue.phonemeSupported !== undefined || debate.phonemeSupported !== undefined
      ? monologue.phonemeSupported !== false || debate.phonemeSupported !== false
      : undefined;
  return {
    pron: blend("pron"),
    accuracy: blend("accuracy"),
    fluency: blend("fluency"),
    prosody: blend("prosody"),
    completeness: blend("completeness"),
    text: [monologue.text, debate.text].filter(Boolean).join(" "),
    ...(anyLexical
      ? {
          lexicalText: [monologue.lexicalText || monologue.text, debate.lexicalText || debate.text]
            .filter(Boolean)
            .join(" "),
        }
      : {}),
    ...(phonemeSupported !== undefined ? { phonemeSupported } : {}),
    seconds: monologue.seconds + debate.seconds,
    words: mergeWordsWithOffsets([monologue, debate], true),
  };
}
