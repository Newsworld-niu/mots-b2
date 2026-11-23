/**
 * 听力理解 closer to the exam: voices with other French accents, the 精听 steps after a paper (dictation
 * sentence by sentence or paragraph by paragraph, then shadowing), and why the learner got a question wrong
 * (错因), counted so the weakest kind of question shows.
 */
import { foldAccents } from "./accent";
import { MEDIA_BASE_URL } from "../config";
import { clean } from "./typing";
import { QSKILL_LABEL, type CompKind, type QSkill } from "./exam-schema";
import type { CompExercise } from "./exam";
import { resolveMediaUrl } from "./media";

/* ---------- accents ---------- */

export type AccentId = "fr-FR" | "fr-CA" | "fr-BE" | "fr-CH";
export interface AccentVoices {
  id: AccentId;
  zh: string;
  /** Azure neural voices: female, male. */
  f: string[];
  m: string[];
}

/** Azure neural voices by accent (adults only). */
export const ACCENTS: AccentVoices[] = [
  { id: "fr-FR", zh: "法国", f: ["fr-FR-DeniseNeural", "fr-FR-BrigitteNeural", "fr-FR-CelesteNeural", "fr-FR-CoralieNeural", "fr-FR-JosephineNeural", "fr-FR-YvetteNeural"], m: ["fr-FR-HenriNeural", "fr-FR-AlainNeural", "fr-FR-ClaudeNeural", "fr-FR-JeromeNeural", "fr-FR-MauriceNeural", "fr-FR-YvesNeural"] },
  { id: "fr-CA", zh: "加拿大（魁北克）", f: ["fr-CA-SylvieNeural"], m: ["fr-CA-JeanNeural", "fr-CA-AntoineNeural", "fr-CA-ThierryNeural"] },
  { id: "fr-BE", zh: "比利时", f: ["fr-BE-CharlineNeural"], m: ["fr-BE-GerardNeural"] },
  { id: "fr-CH", zh: "瑞士", f: ["fr-CH-ArianeNeural"], m: ["fr-CH-FabriceNeural"] },
];

export const accentOf = (voice: string) => ACCENTS.find((a) => voice.startsWith(a.id));

/** "fixed": the voices set in 我的 → AI 接口; "france": varied voices of France; "mixed": any accent. */
export type VoiceMode = "fixed" | "france" | "mixed";

/** The voices of one document: at least 3–4 distinct voices (first two of different sexes). */
export interface DocVoices {
  voices: string[];
  accents: AccentId[];
}

/**
 * Voices for one document. In "mixed" mode about half the documents are read in another accent than
 * France's, and the speakers of an interview or panel may come from different countries, as on the radio.
 */
export function pickVoices(mode: Exclude<VoiceMode, "fixed">, rnd: () => number = Math.random): DocVoices {
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length) % a.length];
  const france = ACCENTS[0];
  const other = () => (mode === "mixed" && rnd() < 0.5 ? pick(ACCENTS.slice(1)) : france);
  const female = rnd() < 0.5;
  const a1 = other();
  const a2 = mode === "mixed" && rnd() < 0.4 ? pick(ACCENTS) : a1;
  const v1 = pick(female ? a1.f : a1.m);
  const v2 = pick(female ? a2.m : a2.f);
  const sameAccentPool = [...new Set([...a1.f, ...a1.m, ...a2.f, ...a2.m])].filter((v) => v !== v1 && v !== v2);
  const extraAccents: AccentId[] = [];
  const voices = [v1, v2];
  while (voices.length < 4) {
    if (sameAccentPool.length) {
      const idx = Math.floor(rnd() * sameAccentPool.length) % sameAccentPool.length;
      voices.push(sameAccentPool.splice(idx, 1)[0]);
    } else {
      const fallbackPool = [...france.f, ...france.m].filter((v) => !voices.includes(v));
      if (!fallbackPool.length) break;
      voices.push(pick(fallbackPool));
      extraAccents.push(france.id);
    }
  }
  return { voices, accents: [...new Set([a1.id, a2.id, ...extraAccents])] };
}

export const accentNames = (ids: AccentId[]) => ids.map((id) => ACCENTS.find((a) => a.id === id)?.zh ?? id).join("、");

/* ---------- 精听: dictation and shadowing ---------- */

export interface DictUnit {
  /** What the learner writes: the words spoken, without the speaker's name. */
  text: string;
  /** Who says it, when the document is an interview. */
  who?: string;
  /** Optional native audio segment start/end in seconds. */
  start?: number;
  end?: number;
}

const SPEAKER = /^\s*([\p{Lu}][\p{L} .'’-]{0,24})\s:\s*/u;
const STAGE_TAG_LINE = /^\s*\[[^\]]+\]\s*$/;
const INLINE_STAGE_TAG = /\[(?:\s*(?:\.\.\.|…)\s*|(?:extrait|musique|jingle|applaudissements|rires?|bruit|sonnerie|chant)[^\]]*)\]/giu;
const BOILERPLATE_SENTENCE = /^(?:Poursuivez votre lecture\b|https?:\/\/\S+$|www\.\S+$|[\w-]+\.(?:fr|com|org|net)\.?$)/i;
const PROMO_DOMAIN = /\bfrancaisfacile\.rfi\.fr\b/i;
const DOMAIN_DOT_PLACEHOLDER = "\uE000";

/** Sentences of a document, without speaker labels; very short ones are joined to the next. */
export function sentencesOf(text: string): DictUnit[] {
  const out: DictUnit[] = [];
  for (const rawLine of text.split(/\n+/)) {
    if (STAGE_TAG_LINE.test(rawLine)) continue;
    const m = rawLine.match(SPEAKER);
    const cleanedLine = (m ? rawLine.slice(m[0].length) : rawLine).replace(INLINE_STAGE_TAG, " ").replace(/\s+/g, " ").trim();
    if (!cleanedLine || STAGE_TAG_LINE.test(cleanedLine) || /^Poursuivez votre lecture\b/i.test(cleanedLine)) continue;
    const who = m?.[1].trim();
    const protectedLine = cleanedLine.replace(/(?<=[\p{L}\p{N}-])\.(?=[\p{L}\p{N}-])/gu, DOMAIN_DOT_PLACEHOLDER);
    const rawParts =
      protectedLine.match(/[^.!?…]+(?:[.!?…]+[\s\u00A0]*["»”)]*)+(?:\s+|$)|[^.!?…]+$/g) ?? [protectedLine];
    const parts = rawParts
      .map((p) => p.replaceAll(DOMAIN_DOT_PLACEHOLDER, ".").trim())
      .filter((p) => p && !BOILERPLATE_SENTENCE.test(p) && !PROMO_DOMAIN.test(p));
    let carry = "";
    parts.forEach((p, k) => {
      if (!/[\p{L}\p{N}]/u.test(p)) {
        if (carry) carry = `${carry.trimEnd()} ${p} `;
        else if (out.length > 0 && out[out.length - 1].who === who) out[out.length - 1].text = `${out[out.length - 1].text} ${p}`.replace(/\s+/g, " ").trim();
        return;
      }
      const s = (carry + p).replace(/\s+/g, " ").trim();
      // "Bon." "Oui." alone are too short to be worth a dictation item
      if (s.split(/\s+/).length < 4 && k < parts.length - 1) {
        carry = `${s} `;
        return;
      }
      carry = "";
      if (s && /[\p{L}\p{N}]/u.test(s)) out.push(who ? { text: s, who } : { text: s });
    });
    const tail = carry.replace(/\s+/g, " ").trim();
    if (tail && /[\p{L}\p{N}]/u.test(tail)) out.push(who ? { text: tail, who } : { text: tail });
  }
  return out;
}

/** Group sentence units into paragraph-sized dictation units, preserving native audio `[start, end]` spans. */
export function paragraphsFromUnits(units: DictUnit[], max = 45): DictUnit[] {
  const out: DictUnit[] = [];
  let cur: DictUnit | null = null;
  const words = (t: string) => t.split(/\s+/).length;
  for (const s of units) {
    if (cur && cur.who === s.who && words(cur.text) + words(s.text) <= max) {
      cur.text += ` ${s.text}`;
      if (typeof s.end === "number") cur.end = typeof cur.end === "number" ? Math.max(cur.end, s.end) : s.end;
    } else {
      if (cur) out.push(cur);
      cur = { ...s };
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Groups of sentences for paragraph dictation: one speaker's turn, cut into pieces of about `max` words. */
export function paragraphsOf(text: string, max = 45): DictUnit[] {
  return paragraphsFromUnits(sentencesOf(text), max);
}

const wordsOf = (s: string) =>
  clean(s)
    .toLowerCase()
    .replace(/(\d)\s*%/g, "$1 %")
    .replace(/[«»"“”()[\]]/g, " ")
    .replace(/'/g, "' ")
    .replace(/[.,;:!?…]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

export type DictMark = "ok" | "accent" | "wrong" | "missing";
export type DictDiag = "accent" | "homophone_gram" | "liaison_elision" | "lexical";

export interface DictResult {
  /** The words of the reference, each marked (with phonetic diagnostic category when not "ok"). */
  words: { w: string; mark: DictMark; diag?: DictDiag }[];
  /** Words the learner wrote that are not in the reference. */
  extra: string[];
  /** Share of reference words written right (accents aside count half), 0–100. */
  score: number;
  /** Counts of mismatch types across reference words for targeted phonetic feedback. */
  diagnostics: Record<DictDiag, number>;
}

const FR_UNITS = [
  "zero",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize",
  "dix-sept",
  "dix-huit",
  "dix-neuf",
];
const FR_TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

function frenchBelow100(n: number): string[] {
  if (n < 20) return FR_UNITS[n].split("-");
  if (n < 70) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return [FR_TENS[t]];
    if (u === 1) return [FR_TENS[t], "et", "un"];
    return [FR_TENS[t], ...FR_UNITS[u].split("-")];
  }
  if (n < 80) {
    const u = n - 60;
    if (u === 11) return ["soixante", "et", "onze"];
    return ["soixante", ...FR_UNITS[u].split("-")];
  }
  const u = n - 80;
  if (u === 0) return ["quatre", "vingts"];
  return ["quatre", "vingt", ...FR_UNITS[u].split("-")];
}

function frenchBelow1000(n: number): string[] {
  if (n < 100) return frenchBelow100(n);
  const h = Math.floor(n / 100);
  const r = n % 100;
  const head = h === 1 ? ["cent"] : [...frenchBelow100(h), r === 0 ? "cents" : "cent"];
  return r === 0 ? head : [...head, ...frenchBelow100(r)];
}

/** Convert an integer 0..999_999 into folded French cardinal word tokens. */
export function frenchCardinalTokens(n: number): string[] {
  if (!Number.isInteger(n) || n < 0 || n >= 1_000_000) return [String(n)];
  if (n < 1000) return frenchBelow1000(n);
  const th = Math.floor(n / 1000);
  const r = n % 1000;
  const head = th === 1 ? ["mille"] : [...frenchBelow1000(th).map((w) => (w === "cents" ? "cent" : w === "vingts" ? "vingt" : w)), "mille"];
  return r === 0 ? head : [...head, ...frenchBelow1000(r)];
}

const FR_WORD_VAL: Record<string, number> = {
  zero: 0,
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  seize: 16,
  vingt: 20,
  vingts: 20,
  trente: 30,
  quarante: 40,
  cinquante: 50,
  soixante: 60,
  cent: 100,
  cents: 100,
  mille: 1000,
};

function expandHyphenNumTokens(tokens: string[]): { tok: string; origIdx: number }[] {
  const out: { tok: string; origIdx: number }[] = [];
  tokens.forEach((raw, origIdx) => {
    const f = foldAccents(raw);
    if (f.includes("-") && f.split("-").every((p) => p in FR_WORD_VAL || p === "et")) {
      for (const p of f.split("-")) out.push({ tok: p, origIdx });
    } else {
      out.push({ tok: f, origIdx });
    }
  });
  return out;
}

interface NumSpan {
  start: number;
  end: number; // exclusive in original token array
  value: number;
  isDigits: boolean;
}

function findNumberSpans(tokens: string[]): NumSpan[] {
  const spans: NumSpan[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (/^\d+$/.test(tokens[i])) {
      let end = i + 1;
      let digits = tokens[i];
      while (end < tokens.length && /^\d{3}$/.test(tokens[end]) && digits.length <= 3) {
        digits += tokens[end];
        end++;
      }
      const val = Number(digits);
      if (Number.isSafeInteger(val) && val < 1_000_000) spans.push({ start: i, end, value: val, isDigits: true });
      i = end;
      continue;
    }
    const exp = expandHyphenNumTokens(tokens.slice(i));
    let k = 0;
    let total = 0;
    let current = 0;
    let consumed = 0;
    while (k < exp.length) {
      const w = exp[k].tok;
      if (w === "et" && consumed > 0 && k + 1 < exp.length && (exp[k + 1].tok === "un" || exp[k + 1].tok === "une" || exp[k + 1].tok === "onze")) {
        k++;
        continue;
      }
      if (!(w in FR_WORD_VAL)) break;
      const v = FR_WORD_VAL[w];
      if (w === "quatre" && k + 1 < exp.length && (exp[k + 1].tok === "vingt" || exp[k + 1].tok === "vingts")) {
        current += 80;
        consumed += 2;
        k += 2;
        continue;
      }
      if (v === 100) {
        current = (current || 1) * 100;
      } else if (v === 1000) {
        total += (current || 1) * 1000;
        current = 0;
      } else {
        current += v;
      }
      consumed++;
      k++;
    }
    if (consumed > 0) {
      const lastOrig = i + exp[k - 1].origIdx + 1;
      spans.push({ start: i, end: lastOrig, value: total + current, isDigits: false });
      i = lastOrig;
      continue;
    }
    i++;
  }
  return spans;
}

const ORDINAL_ABBR: Record<string, string> = {
  "1er": "premier",
  "1ᵉʳ": "premier",
  "1re": "première",
  "1ʳᵉ": "première",
  "2nd": "second",
  "2nde": "seconde",
};

function alignNumeralsToRef(gotRaw: string[], ref: string[]): string[] {
  if (!gotRaw.length || !ref.length) return gotRaw;
  // Normalize "%" <-> "pour cent" and ordinal abbreviations ("1er" <-> "premier") first
  let got = [...gotRaw];
  const refHasPctSym = ref.includes("%");
  const refHasPourCent = ref.some((w, idx) => w === "pour" && foldAccents(ref[idx + 1] ?? "") === "cent");
  if (refHasPctSym) {
    const next: string[] = [];
    for (let i = 0; i < got.length; i++) {
      if (got[i] === "pour" && foldAccents(got[i + 1] ?? "") === "cent") {
        next.push("%");
        i++;
      } else next.push(got[i]);
    }
    got = next;
  } else if (refHasPourCent) {
    got = got.flatMap((w) => (w === "%" ? ["pour", "cent"] : [w]));
  }

  got = got.map((w) => {
    if (w in ORDINAL_ABBR && ref.some((rw) => foldAccents(rw) === foldAccents(ORDINAL_ABBR[w]))) return ORDINAL_ABBR[w];
    for (const [abbr, full] of Object.entries(ORDINAL_ABBR)) {
      if (foldAccents(w) === foldAccents(full) && ref.includes(abbr)) return abbr;
    }
    return w;
  });

  const refSpans = findNumberSpans(ref);
  const gotSpans = findNumberSpans(got);
  if (!refSpans.length || !gotSpans.length) return got;

  const usedRef = new Set<number>();
  const replacements = new Map<number, { end: number; tokens: string[] }>();
  for (const gs of gotSpans) {
    const matchIdx = refSpans.findIndex((rs, idx) => !usedRef.has(idx) && rs.value === gs.value && rs.isDigits !== gs.isDigits);
    if (matchIdx >= 0) {
      usedRef.add(matchIdx);
      const rs = refSpans[matchIdx];
      replacements.set(gs.start, { end: gs.end, tokens: ref.slice(rs.start, rs.end) });
    }
  }
  if (!replacements.size) return got;
  const aligned: string[] = [];
  for (let i = 0; i < got.length; ) {
    const rep = replacements.get(i);
    if (rep) {
      aligned.push(...rep.tokens);
      i = rep.end;
    } else {
      aligned.push(got[i]);
      i++;
    }
  }
  return aligned;
}

const HOMOPHONE_GROUPS: string[][] = [
  ["a", "as"],
  ["est", "es", "et", "ai", "ait", "aie", "aient"],
  ["son", "sont"],
  ["on", "ont"],
  ["ce", "se"],
  ["ces", "ses", "sait", "sais"],
  ["ou", "ou"],
  ["la", "la"],
  ["leur", "leurs"],
  ["peu", "peux", "peut"],
  ["sans", "cent", "cents", "sang"],
  ["fois", "foi", "foie"],
  ["voie", "voix", "vois", "voit"],
  ["compte", "comte", "conte", "comptent"],
  ["tout", "tous", "toute"],
  ["quel", "quelle", "quels", "quelles"],
];

const ELISION_CLITICS = new Set(["ne", "n'", "l'", "d'", "qu'", "j'", "c'", "s'", "m'", "t'", "y", "en", "que", "de", "le", "la", "ce", "se", "je", "tu", "me", "te"]);

const stripSilentMorph = (f: string) =>
  f
    .replace(/(?:aient|ais|ait|er|ez|ees|ee|es|e|ent)$/, "")
    .replace(/[sxtd]$/, "");

function classifyDictMismatch(refWord: string, typedWord?: string): DictDiag {
  const rf = foldAccents(refWord);
  const tf = typedWord ? foldAccents(typedWord) : "";
  if (!typedWord) {
    if (rf.endsWith("'") || ELISION_CLITICS.has(rf)) return "liaison_elision";
    return "lexical";
  }
  if (rf.endsWith("'") || tf.endsWith("'") || (ELISION_CLITICS.has(rf) && ELISION_CLITICS.has(tf))) {
    return "liaison_elision";
  }
  if ((/^[sztn]/.test(tf) && tf.slice(1) === rf) || (/^[sztn]/.test(rf) && rf.slice(1) === tf)) {
    return "liaison_elision";
  }
  if (HOMOPHONE_GROUPS.some((g) => g.includes(rf) && g.includes(tf))) {
    return "homophone_gram";
  }
  const rStem = stripSilentMorph(rf);
  const tStem = stripSilentMorph(tf);
  if (rStem.length >= 3 && rStem === tStem) {
    return "homophone_gram";
  }
  return "lexical";
}

/**
 * Compare a dictation with the reference word by word (alignment by longest common subsequence, accents
 * folded), equating French numerals ("300" <-> "trois cents") and classifying phonetic error types.
 */
export function checkDictation(typed: string, reference: string): DictResult {
  const ref = wordsOf(reference);
  const got = alignNumeralsToRef(wordsOf(typed), ref);
  const a = ref.map(foldAccents);
  const b = got.map(foldAccents);
  const n = a.length;
  const m = b.length;
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const words: DictResult["words"] = [];
  const extra: string[] = [];
  const diagnostics: Record<DictDiag, number> = { accent: 0, homophone_gram: 0, liaison_elision: 0, lexical: 0 };
  let i = 0;
  let j = 0;
  // unmatched typed words between two matches stand for the reference words there (a misspelling)
  let pendingTyped: string[] = [];
  let pendingRef: number[] = [];
  const flush = () => {
    pendingRef.forEach((k, x) => {
      const tw = x < pendingTyped.length ? pendingTyped[x] : undefined;
      const mark: DictMark = tw !== undefined ? "wrong" : "missing";
      const diag = classifyDictMismatch(ref[k], tw);
      diagnostics[diag]++;
      words.push({ w: ref[k], mark, diag });
    });
    extra.push(...pendingTyped.slice(pendingRef.length));
    pendingTyped = [];
    pendingRef = [];
  };
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      flush();
      if (ref[i] === got[j]) {
        words.push({ w: ref[i], mark: "ok" });
      } else {
        diagnostics.accent++;
        words.push({ w: ref[i], mark: "accent", diag: "accent" });
      }
      i++;
      j++;
    } else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) pendingTyped.push(got[j++]);
    else pendingRef.push(i++);
  }
  flush();
  const ok = words.reduce((s, w) => s + (w.mark === "ok" ? 1 : w.mark === "accent" ? 0.5 : 0), 0);
  return { words, extra, score: n ? Math.round((ok / n) * 100) : 100, diagnostics };
}

/* ---------- 错因 ---------- */

/** Why a question went wrong, as the learner sees it. */
export type MissCause = "paraphrase" | "negation" | "gist" | "inference" | "vocab" | "heard" | "time" | "careless";
export const MISS_CAUSES: MissCause[] = ["paraphrase", "negation", "gist", "inference", "vocab", "heard", "time", "careless"];
export const CAUSE_LABEL: Record<MissCause, string> = {
  paraphrase: "没认出同义改写",
  negation: "否定 / 限定陷阱",
  gist: "细节和主旨混淆",
  inference: "观点、推断判断错",
  vocab: "有生词",
  heard: "没听清 / 没找到出处",
  time: "时间不够",
  careless: "粗心",
};
export const CAUSE_TIP: Record<MissCause, string> = {
  paraphrase: "正确选项几乎从不照抄原文。做完题回到原文，把每个正确选项和原文那句话并排写下来，记住「换了什么说法」。",
  negation: "圈出 ne…que、ne…plus、sauf、seulement、à peine、pas encore 这类词；选项里的 toujours / jamais / tous 往往是陷阱。",
  gist: "先问自己：这句话回答的是「整体在讲什么」还是「某个具体信息」？主旨题别被原文里出现过的细节词带偏。",
  inference: "态度题看评价词和语气（regretter、se réjouir、certes… mais）；推断题的答案原文没写，但必须能从原文推出来。",
  vocab: "把原文里的生词加进卡组复习；B2 话题词（环境、工作、教育……）要能听懂。",
  heard: "做「精听」：逐句听写，把没听出的地方标出来，再跟读几遍。",
  time: "读题时间里先划关键词，预测答案方向；阅读先看题再读文章。",
  careless: "交卷前用 1 分钟核对每题是否答了、选项字母是否点对。",
};

/** The cause a wrong answer is put down to before the learner says otherwise: from what the question tests. */
export function causeFromSkill(skill: QSkill | undefined): MissCause | undefined {
  if (!skill) return undefined;
  return skill === "paraphrase" ? "paraphrase" : skill === "negation" ? "negation" : skill === "opinion" || skill === "inference" ? "inference" : "gist";
}

export interface CompMiss {
  at: number;
  part: CompKind;
  skill?: QSkill;
  cause: MissCause;
  /** Which question of the paper ("exercise-question"). */
  q?: string;
  /** Self-contained snapshot for interactive real-question re-attempt in MistakeReflow. */
  qType?: "qcm" | "vf" | "short";
  stem?: string;
  options?: string[];
  answer?: number;
  quote?: string;
  accepted?: string[];
  why?: string;
  excerpt?: string;
  title?: string;
}

export const MAX_MISSES = 400;

export function sanitizeMisses(v: unknown): CompMiss[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const trimStr = (s: unknown, max: number) => (typeof s === "string" ? s.trim().slice(0, max) : "");
  const out: CompMiss[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const e = x as Record<string, unknown>;
    if ((e.part !== "listen" && e.part !== "read") || typeof e.at !== "number" || !MISS_CAUSES.includes(e.cause as MissCause)) continue;
    const skill = typeof e.skill === "string" && e.skill in QSKILL_LABEL ? (e.skill as QSkill) : undefined;
    const q = typeof e.q === "string" && /^(\d+-\d+|micro:[a-z0-9-]+:[a-z0-9-]+|real:[a-z0-9-]+:\d+)$/i.test(e.q) ? e.q : undefined;
    const qType = e.qType === "qcm" || e.qType === "vf" || e.qType === "short" ? e.qType : undefined;
    const stem = trimStr(e.stem, 240);
    const options = Array.isArray(e.options)
      ? e.options.map((o) => trimStr(o, 220)).filter(Boolean).slice(0, 3)
      : undefined;
    const validOpts = options && options.length >= 2 ? options : undefined;
    const answer = typeof e.answer === "number" && Number.isInteger(e.answer) && e.answer >= 0 && e.answer <= 2 ? e.answer : undefined;
    const quote = trimStr(e.quote, 240);
    const accepted = Array.isArray(e.accepted)
      ? e.accepted.map((a) => trimStr(a, 160)).filter(Boolean).slice(0, 6)
      : undefined;
    const why = trimStr(e.why, 360);
    const excerpt = trimStr(e.excerpt, 520);
    const title = trimStr(e.title, 100);
    out.push({
      at: e.at,
      part: e.part,
      cause: e.cause as MissCause,
      ...(skill ? { skill } : {}),
      ...(q ? { q } : {}),
      ...(qType ? { qType } : {}),
      ...(stem ? { stem } : {}),
      ...(validOpts ? { options: validOpts } : {}),
      ...(answer !== undefined ? { answer } : {}),
      ...(quote ? { quote } : {}),
      ...(accepted?.length ? { accepted } : {}),
      ...(why ? { why } : {}),
      ...(excerpt ? { excerpt } : {}),
      ...(title ? { title } : {}),
    });
  }
  return out.length ? out.slice(0, MAX_MISSES) : undefined;
}

function pickMissExcerpt(docText: string, needles: string[], maxLen = 500): string {
  const clean = docText.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= maxLen) return clean;
  const lower = clean.toLowerCase();
  for (const rawNeedle of needles) {
    const n = rawNeedle.replace(/\s+/g, " ").trim().toLowerCase();
    if (n.length < 4) continue;
    const probe = n.slice(0, Math.min(28, n.length));
    const idx = lower.indexOf(probe);
    if (idx >= 0) {
      const start = Math.max(0, idx - 140);
      const end = Math.min(clean.length, start + maxLen - 6);
      const slice = clean.slice(start, end).trim();
      return `${start > 0 ? "… " : ""}${slice}${end < clean.length ? " …" : ""}`;
    }
  }
  return `${clean.slice(0, maxLen - 2).trim()} …`;
}

/** Build a CompMiss record with compact question/excerpt snapshot for interactive review in MistakeReflow. */
export function buildCompMissSnapshot(
  q: {
    q: string;
    qType?: "qcm" | "vf" | "short";
    options: string[];
    answer: number;
    quote?: string;
    accepted?: string[];
    why: string;
    doc: number;
    skill?: QSkill;
  },
  ex: { title?: string; docs: { text: string }[] },
  part: CompKind,
  key: string,
  at: number,
): CompMiss {
  const docText = ex.docs[q.doc]?.text ?? "";
  const excerpt = pickMissExcerpt(docText, [q.quote ?? "", ...(q.accepted ?? [])]);
  const qType = q.qType === "vf" || q.qType === "short" ? q.qType : "qcm";
  const options = q.options.map((o) => o.trim().slice(0, 220)).filter(Boolean).slice(0, 3);
  const stem = q.q.trim().slice(0, 240);
  const why = q.why.trim().slice(0, 360);
  const quote = q.quote?.trim().slice(0, 240);
  const accepted = q.accepted?.map((a) => a.trim().slice(0, 160)).filter(Boolean).slice(0, 6);
  const title = ex.title?.trim().slice(0, 100);
  return {
    at,
    part,
    q: key,
    cause: causeFromSkill(q.skill) ?? (part === "listen" ? "heard" : "paraphrase"),
    ...(q.skill ? { skill: q.skill } : {}),
    qType,
    ...(stem ? { stem } : {}),
    ...(options.length >= 2 ? { options } : {}),
    ...(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 2 ? { answer: q.answer } : {}),
    ...(quote ? { quote } : {}),
    ...(accepted?.length ? { accepted } : {}),
    ...(why ? { why } : {}),
    ...(excerpt ? { excerpt } : {}),
    ...(title ? { title } : {}),
  };
}

/** How often each cause came up, most frequent first (only causes that came up). */
export function missStats(misses: CompMiss[], part?: CompMiss["part"]): { cause: MissCause; n: number; share: number }[] {
  const list = part ? misses.filter((m) => m.part === part) : misses;
  const count = new Map<MissCause, number>();
  for (const m of list) count.set(m.cause, (count.get(m.cause) ?? 0) + 1);
  return [...count.entries()].map(([cause, n]) => ({ cause, n, share: Math.round((n / list.length) * 100) })).sort((a, b) => b.n - a.n || MISS_CAUSES.indexOf(a.cause) - MISS_CAUSES.indexOf(b.cause));
}

/** Right / asked by kind of question, over the given answered questions. */
export function skillStats(rows: { skill?: QSkill; right: boolean }[]) {
  const out = new Map<QSkill, { n: number; right: number }>();
  for (const r of rows) {
    if (!r.skill) continue;
    const s = out.get(r.skill) ?? { n: 0, right: 0 };
    s.n++;
    if (r.right) s.right++;
    out.set(r.skill, s);
  }
  return out;
}

/* ---------- quality of a generated exercise ---------- */

/**
 * Things in a generated exercise that the exam never does, so it can be made again: right answers that copy
 * a run of 5+ words of the document, or every right answer at the same position.
 */
export function qualityIssues(ex: CompExercise): string[] {
  const issues: string[] = [];
  const norm = (t: string) => foldAccents(t.replace(/’/g, "'")).replace(/[^\p{L}\p{N}']+/gu, " ").trim();
  const doc = ` ${ex.docs.map((d) => norm(d.text)).join(" ")} `;
  const qcm = ex.questions.filter((q) => !q.qType || q.qType === "qcm");
  const echoes =
    ex.form === "opinions"
      ? 0
      : qcm.filter((q) => {
          const w = norm(q.options[q.answer] ?? "").split(" ").filter(Boolean);
          for (let k = 0; k + 5 <= w.length; k++) if (doc.includes(` ${w.slice(k, k + 5).join(" ")} `)) return true;
          return false;
        }).length;
  if (echoes >= 2) issues.push(`${echoes} 个正确选项照抄原文`);
  if (ex.form !== "opinions" && qcm.length >= 4 && new Set(qcm.map((q) => q.answer)).size === 1) issues.push("正确答案都在同一个位置");
  return issues;
}

/* ---------- 真实材料: links and timestamps ---------- */

export interface RealSource {
  id: string;
  title: string;
  /** Either an HTTP(S) URL, a bundled `materials/...` path, or an `idb:<key>` stored in IndexedDB. */
  url: string;
  /** Optional companion PDF / official sheet / transcript path (`https://...`, `materials/...`, or `idb:...`). */
  pdfUrl?: string;
  /** Optional preset key linking offline exam questions (`PREBUILT_REAL_QUIZZES`). */
  presetId?: string;
  /** The part to work on, in seconds from the start of the recording. */
  start: number;
  end: number;
  created: number;
  /** The learner's own copy of the transcript (from the site), kept on this device for dictation. */
  transcript?: string;
  /** What the learner understood on the blind listening. */
  notes?: string;
  /** When the four steps were last gone through. */
  done?: number;
}

export const MAX_SOURCES = 40;
export const MAX_TRANSCRIPT = 12000;
export const SOURCE_ID = /^(?:s|rfi)-[a-z0-9-]{4,32}$/;
export const VALID_SOURCE_URL = /^(?:https?:\/\/|materials\/|idb:)/i;

/** Sites with French radio and video for learners (and natives), with transcripts for some. */
export const REAL_SITES: { name: string; url: string; zh: string }[] = [
  { name: "FEI 官方 DELF B2 样题（MP3 / PDF）", url: "https://www.france-education-international.fr/diplome/delf-tout-public/niveau-b2/exemples-sujets", zh: "官方有 Proof-of-Work 人机验证；在浏览器下载 MP3/PDF 后可用下方「导入本地文件」离线练。" },
  { name: "RFI 法语学习（Journal en français facile）", url: "https://francaisfacile.rfi.fr/fr/podcasts/journal-en-fran%C3%A7ais-facile/", zh: "已内置 6 期真实广播与文字稿，也可自行添加更多最新期数。" },
  { name: "TV5Monde Apprendre", url: "https://apprendre.tv5monde.com/fr", zh: "按 A1–C1 分级的短视频，带练习和原文；选 B2。" },
  { name: "France Culture", url: "https://www.radiofrance.fr/franceculture", zh: "真实的访谈和辩论节目，选 3–5 分钟的一段，难度高于考试。" },
];

/** Resolve a `materials/...` relative path against Vite BASE_URL or Azure Blob media base while preserving external or `idb:` URLs. */
export function resolveMaterialUrl(url: string, base = "/", mediaBase = MEDIA_BASE_URL): string {
  if (/^materials\//i.test(url)) return resolveMediaUrl(url, base, mediaBase);
  return url;
}

/** "1:05" → 65, "65" → 65; NaN when it is not a time. */
export function parseClock(s: string): number {
  const t = s.trim();
  const m = t.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/) ?? t.match(/^()(\d+):(\d{2})$/);
  if (m) return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return /^\d+$/.test(t) ? Number(t) : NaN;
}

export function sanitizeSources(v: unknown): RealSource[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: RealSource[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    if (typeof r.id !== "string" || !SOURCE_ID.test(r.id) || typeof r.url !== "string" || !VALID_SOURCE_URL.test(r.url) || typeof r.created !== "number") continue;
    const sec = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.round(n) : 0);
    const start = sec(r.start);
    const end = Math.max(start, sec(r.end));
    const text = (k: string, max: number) => (typeof r[k] === "string" && (r[k] as string).trim() ? (r[k] as string).slice(0, max) : undefined);
    const transcript = text("transcript", MAX_TRANSCRIPT);
    const notes = text("notes", 2000);
    const rawPdf = text("pdfUrl", 600);
    const pdfUrl = rawPdf && VALID_SOURCE_URL.test(rawPdf) ? rawPdf : undefined;
    const presetId = text("presetId", 48);
    out.push({
      id: r.id,
      title: (text("title", 120) ?? "").trim() || r.url.slice(0, 120),
      url: r.url.slice(0, 600),
      ...(pdfUrl ? { pdfUrl } : {}),
      ...(presetId ? { presetId } : {}),
      start,
      end,
      created: r.created,
      ...(transcript ? { transcript } : {}),
      ...(notes ? { notes } : {}),
      ...(typeof r.done === "number" ? { done: r.done } : {}),
    });
    if (out.length >= MAX_SOURCES) break;
  }
  return out.length ? out : undefined;
}

/** How to play a source in the app: IndexedDB blob, YouTube embed, an audio/video file, or only a link to the page. */
export function playerFor(
  url: string,
  start: number,
  end: number,
  base = "/",
): { kind: "idb"; key: string; start: number; end: number } | { kind: "youtube"; src: string } | { kind: "media"; src: string; video: boolean } | { kind: "page" } {
  if (/^idb:/i.test(url)) return { kind: "idb", key: url.slice(4), start, end };
  const resolved = resolveMaterialUrl(url, base);
  const fragment = `#t=${start}${end > start ? `,${end}` : ""}`;
  if (/^materials\//i.test(url)) {
    const ext = url.toLowerCase().match(/\.(mp3|m4a|aac|ogg|oga|wav|mp4|webm|m4v)$/)?.[1];
    if (ext) return { kind: "media", src: `${resolved.split("#")[0]}${fragment}`, video: ["mp4", "webm", "m4v"].includes(ext) };
  }
  let u: URL;
  try {
    u = new URL(resolved);
  } catch {
    return { kind: "page" };
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  const yt = host === "youtu.be" ? u.pathname.slice(1) : host === "youtube.com" ? (u.searchParams.get("v") ?? u.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)/)?.[1] ?? "") : "";
  if (yt && /^[\w-]{6,20}$/.test(yt)) return { kind: "youtube", src: `https://www.youtube-nocookie.com/embed/${yt}?start=${start}${end > start ? `&end=${end}` : ""}&rel=0` };
  const ext = u.pathname.toLowerCase().match(/\.(mp3|m4a|aac|ogg|oga|wav|mp4|webm|m4v)$/)?.[1];
  if (ext) return { kind: "media", src: `${resolved.split("#")[0]}${fragment}`, video: ["mp4", "webm", "m4v"].includes(ext) };
  return { kind: "page" };
}
