export type CompKind = "listen" | "read";
export const COMP_LABEL: Record<CompKind, string> = { listen: "听力理解", read: "应试阅读" };

export type QSkill = "gist" | "detail" | "paraphrase" | "opinion" | "inference" | "negation";
export const QSKILLS: QSkill[] = ["gist", "detail", "paraphrase", "opinion", "inference", "negation"];
export const QSKILL_LABEL: Record<QSkill, string> = {
  gist: "主旨",
  detail: "细节",
  paraphrase: "同义改写",
  opinion: "观点态度",
  inference: "推断",
  negation: "否定/限定",
};

export type ExamPart = CompKind | "essay" | "speak";
export const EXAM_PARTS: ExamPart[] = ["listen", "read", "essay", "speak"];
export const PART_LABEL: Record<ExamPart, string> = { listen: "听力", read: "阅读", essay: "写作", speak: "口语" };

export interface ExamResult {
  part: ExamPart;
  /** Topic id (comprehension), task id (essay), or subject id (speaking). */
  what: string;
  score: number;
  total: number;
  at: number;
  /** CEFR level of the prompt/paper ("B1" warmups are excluded from DELF B2 readiness). */
  level?: "B1" | "B2";
  /** Practice scope ("full" = complete DELF section; "drill" = single-exercise practice; "real" = RFI/PDF audio). */
  scope?: "full" | "drill" | "real";
  /** Speaking only: true when the candidate typed instead of speaking by voice (excluded from /25 curve). */
  typed?: boolean;
  /** True when the result comes from an unverified / self-reported run (excluded from verified /100 readiness). */
  unverified?: boolean;
  /** Exam track ("delf" default, "tcf", or "tef"); non-DELF logs are isolated from DELF /100 readiness. */
  track?: "delf" | "tcf" | "tef";
  /** Official TCF/TEF section key when track is "tcf" or "tef". */
  trackSection?: "co" | "ce" | "struct" | "ee" | "eo";
  /** Scaled 100–699 (TCF) or 0–699 (TEF) score when applicable. */
  scaledScore?: number;
  /** Official Canadian NCLC band (1–12) when applicable. */
  nclc?: number;
}

export const MAX_EXAM_LOG = 60;

export function sanitizeExamLog(v: unknown): ExamResult[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: ExamResult[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const e = x as Record<string, unknown>;
    if ((e.part !== "listen" && e.part !== "read" && e.part !== "essay" && e.part !== "speak") || typeof e.what !== "string" || typeof e.at !== "number") continue;
    if (typeof e.score !== "number" || typeof e.total !== "number" || !(e.total > 0) || e.score < 0 || e.score > e.total) continue;
    const track = e.track === "delf" || e.track === "tcf" || e.track === "tef" ? e.track : undefined;
    const trackSection =
      e.trackSection === "co" || e.trackSection === "ce" || e.trackSection === "struct" || e.trackSection === "ee" || e.trackSection === "eo"
        ? e.trackSection
        : undefined;
    const scaledScore =
      typeof e.scaledScore === "number" && Number.isFinite(e.scaledScore) && e.scaledScore >= 0 && e.scaledScore <= 699
        ? Math.round(e.scaledScore)
        : undefined;
    const nclc =
      typeof e.nclc === "number" && Number.isFinite(e.nclc) && e.nclc >= 1 && e.nclc <= 12
        ? Math.round(e.nclc)
        : undefined;
    out.push({
      part: e.part,
      what: e.what.slice(0, 40),
      score: e.score,
      total: e.total,
      at: e.at,
      ...(e.level === "B1" || e.level === "B2" ? { level: e.level } : {}),
      ...(e.scope === "full" || e.scope === "drill" || e.scope === "real" ? { scope: e.scope } : {}),
      ...(e.part === "speak" && e.typed === true ? { typed: true } : {}),
      ...(e.unverified === true ? { unverified: true } : {}),
      ...(track ? { track } : {}),
      ...(trackSection ? { trackSection } : {}),
      ...(scaledScore !== undefined ? { scaledScore } : {}),
      ...(nclc !== undefined ? { nclc } : {}),
    });
  }
  return out.length ? out.slice(0, MAX_EXAM_LOG) : undefined;
}

/** A result as the exam counts it: out of 25. */
export const outOf25 = (r: { score: number; total: number }) => Math.round((r.score / r.total) * 250) / 10;

/**
 * Real /25 exam score for curves and dashboards.
 * Speaking sessions without a 5th pronunciation criterion (total !== 25) or typed sessions are never linearly
 * scaled from /20 to /25 and return null.
 */
export function realScore25(r: Pick<ExamResult, "part" | "score" | "total" | "typed">): number | null {
  if (r.part === "speak" && (r.total !== 25 || r.typed === true)) return null;
  return outOf25(r);
}

const B1_ESSAY_IDS = new Set(["mail-invitation", "recit-voyage", "forum-teletravail"]);

/**
 * True when an examLog row counts toward DELF B2 readiness & skill balance:
 * excludes B1 warmups, single-exercise drills, RFI/real-audio quizzes, untagged short <20pt papers,
 * unverified runs, and /20 or typed speaking entries.
 */
export function isOfficialB2Exam(
  r: Pick<ExamResult, "part" | "what" | "score" | "total" | "typed" | "level" | "scope" | "unverified" | "track">,
): boolean {
  if (r.track === "tcf" || r.track === "tef") return false;
  if (r.unverified === true) return false;
  if (realScore25(r) === null) return false;
  if (r.level === "B1") return false;
  if (r.scope === "drill" || r.scope === "real") return false;
  if (!r.scope && (r.part === "listen" || r.part === "read") && r.total < 20) return false;
  if (!r.level && r.part === "essay" && B1_ESSAY_IDS.has(r.what)) return false;
  return true;
}

export interface PartReadiness {
  part: ExamPart;
  label: string;
  score25: number | null;
  at: number | null;
  eliminatory: boolean;
  /** Latest speaking log was /20 (no pronunciation) or typed, so not counted into /25. */
  incompleteSpeak?: boolean;
  latestRaw?: ExamResult;
}

export interface ExamReadiness {
  parts: PartReadiness[];
  completed: number;
  /** Exact sum /100 when all 4 parts have a valid DELF B2 score. */
  exact100: number | null;
  /** Equal to exact100 when all 4 parts are complete; never linearly extrapolated from <4 parts. */
  estimated100: number | null;
  /** Sum of scored DELF B2 parts so far (0..100). */
  scoredSum: number;
  /** Maximum possible points across the completed parts (completed * 25). */
  scoredMax: number;
  target: number;
  gapToTarget: number | null;
  eliminated: PartReadiness[];
  passed: boolean | null;
  weakest: PartReadiness | null;
  /** Latest unverified B2 result per section, surfaced separately without counting toward verified /100 pass readiness. */
  unverifiedLatest?: Partial<Record<ExamPart, ExamResult>>;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Summarise DELF B2 readiness across CO/CE/PE/PO without inflating partial (<4 part) runs to /100. */
export function examReadiness(log: ExamResult[] | undefined, target = 75): ExamReadiness {
  const rows = [...(log ?? [])].sort((a, b) => b.at - a.at);
  const unverifiedLatest: Partial<Record<ExamPart, ExamResult>> = {};
  const parts: PartReadiness[] = EXAM_PARTS.map((part) => {
    const mine = rows.filter(
      (r) =>
        r.track !== "tcf" &&
        r.track !== "tef" &&
        r.part === part &&
        r.level !== "B1" &&
        r.scope !== "drill" &&
        r.scope !== "real" &&
        !(!r.scope && (r.part === "listen" || r.part === "read") && r.total < 20) &&
        !(!r.level && r.part === "essay" && B1_ESSAY_IDS.has(r.what)),
    );
    const unverifiedRow = mine.find((r) => r.unverified === true);
    if (unverifiedRow) unverifiedLatest[part] = unverifiedRow;
    const valid = mine.find((r) => isOfficialB2Exam(r));
    const latest = mine[0];
    const score25 = valid ? realScore25(valid) : null;
    return {
      part,
      label: PART_LABEL[part],
      score25,
      at: valid?.at ?? null,
      eliminatory: score25 !== null && score25 < 5,
      incompleteSpeak: part === "speak" && !!latest && !latest.unverified && realScore25(latest) === null && !valid,
      ...(latest ? { latestRaw: latest } : {}),
    };
  });
  const scored = parts.filter((p) => p.score25 !== null);
  const completed = scored.length;
  const sum = scored.reduce((n, p) => n + (p.score25 ?? 0), 0);
  const scoredSum = round1(sum);
  const scoredMax = completed * 25;
  const exact100 = completed === 4 ? scoredSum : null;
  const estimated100 = exact100;
  const gapToTarget = exact100 !== null ? round1(Math.max(0, target - exact100)) : null;
  const eliminated = scored.filter((p) => p.eliminatory);
  const passed = exact100 !== null ? exact100 >= 50 && eliminated.length === 0 : null;
  const weakest = scored.length ? [...scored].sort((a, b) => (a.score25 ?? 0) - (b.score25 ?? 0))[0] : null;
  return {
    parts,
    completed,
    exact100,
    estimated100,
    scoredSum,
    scoredMax,
    target,
    gapToTarget,
    eliminated,
    passed,
    weakest,
    unverifiedLatest,
  };
}

export type CompForm = "long" | "short" | "opinions";
export const FORM_SPEC: Record<CompForm, { zh: string; questions: number; points: number; plays: number; read: number; answer: number }> = {
  long: { zh: "长篇（7 题，9 分）", questions: 7, points: 9, plays: 2, read: 60, answer: 60 },
  short: { zh: "三段短录音（各听一遍，7 分）", questions: 6, points: 7, plays: 1, read: 15, answer: 20 },
  opinions: { zh: "三人观点（这是谁的看法，7 分）", questions: 6, points: 7, plays: 0, read: 0, answer: 0 },
};
/** Pause between the two hearings of a long document, in seconds. */
export const BETWEEN_PLAYS = 30;
/** The exercises of a whole paper, in order: 9 + 9 + 7 = 25 points. */
export const PAPER: Record<CompKind, CompForm[]> = { listen: ["long", "long", "short"], read: ["long", "long", "opinions"] };
export const READ_MINUTES = { paper: 60, long: 20, opinions: 15 } as const;

export type CompQuestionType = "qcm" | "vf" | "short";

export interface CompQuestion {
  /** Question and options in French, as in the exam: 3 options ("qcm"), Vrai/Faux + citation ("vf"), or short written answer ("short"). */
  q: string;
  /** Question format; omitted for legacy 3-option QCM questions. */
  qType?: CompQuestionType;
  options: string[];
  answer: number;
  /** Exact French quote justifying a Vrai/Faux answer (justifier par une citation). */
  quote?: string;
  /** Accepted French short answers (sample answers / keyphrases) when qType === "short". */
  accepted?: string[];
  /** Verbatim or key French sentence/clause in the document proving the answer. */
  evidence?: string;
  /** Distractor trap labels per option (up to 3 items aligned with `options`). */
  trapTypes?: string[];
  /** Why, in Chinese. */
  why: string;
  /** Points, from 0.5 to 2.5, set by `weigh`. */
  pts: number;
  /** Which document of the exercise the question is about (short recordings). */
  doc: number;
  /** What the question tests, as the AI saw it (older exercises have none). */
  skill?: QSkill;
}

export interface CompExercise {
  form: CompForm;
  topic: string;
  /** The situation line of the exercise ("Vous écoutez une émission à la radio."). */
  intro: string;
  title: string;
  /** One document, or three for short recordings (optionally backed by a pre-rendered CO MP3). */
  docs: { text: string; zh: string; audioUrl?: string }[];
  questions: CompQuestion[];
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const VALID_CO_AUDIO = /^\/?materials\/co\/[a-z0-9/_-]+\.(?:mp3|ogg|m4a)$/i;

/**
 * The points of the questions of one exercise, as in the official sample paper: from 0.5 to 2.5, adding up
 * to 9 (seven questions) or 7 (six questions).
 */
const POINT_SETS: Record<number, number[]> = { 9: [0.5, 0.5, 1, 1, 1.5, 2, 2.5], 7: [0.5, 0.5, 1, 1.5, 1.5, 2] };

/**
 * Share the exercise's points among its questions by difficulty (1 easiest … 5 hardest): the hardest question
 * gets the most points; equal difficulties keep the order of the paper.
 */
export function weigh(difficulty: number[], points: number): number[] {
  const n = difficulty.length;
  const set = POINT_SETS[points];
  if (!set || set.length !== n) return new Array<number>(n).fill(1);
  const order = [...difficulty.keys()].sort((a, b) => difficulty[a] - difficulty[b] || a - b);
  const pts = new Array<number>(n).fill(1);
  order.forEach((k, rank) => (pts[k] = set[rank]));
  return pts;
}

/** The measured pace of the official recordings: words per minute over a whole document, pauses included. */
export const REAL_WPM = 177;

const normCite = (s: string) =>
  s
    .replace(/’/g, "'")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}']+/gu, " ")
    .trim();

const NEGATION_WORDS = new Set([
  "ne",
  "ni",
  "pas",
  "plus",
  "jamais",
  "sans",
  "aucun",
  "aucune",
  "aucuns",
  "aucunes",
  "guere",
  "rien",
]);

const STRICT_NEGATORS = new Set([
  "ne",
  "ni",
  "pas",
  "jamais",
  "sans",
  "aucun",
  "aucune",
  "aucuns",
  "aucunes",
  "guere",
  "rien",
]);

const expandShortTokens = (norm: string): string[] => {
  const out: string[] = [];
  for (const raw of norm.split(/\s+/).filter(Boolean)) {
    if (raw.startsWith("n'") && raw.length > 2 && !raw.startsWith("n'importe")) {
      out.push("ne", raw.slice(2));
    } else {
      out.push(raw);
    }
  }
  return out;
};

const citeWords = (s: string) => normCite(s).split(/\s+/).filter((w) => w.length >= 3);
const shortWords = (s: string) => expandShortTokens(normCite(s)).filter((w) => w.length >= 3 || NEGATION_WORDS.has(w));
const countCompWords = (s: string) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;

/** Grade one comprehension question: 3-option QCM, Vrai/Faux + citation justification, or short written answer. */
export function gradeCompQuestion(
  q: CompQuestion,
  picked?: number,
  typed?: string,
  docText?: string,
): { correct: boolean; choiceOk?: boolean; quoteMatched?: boolean } {
  const qt = q.qType ?? "qcm";
  if (qt === "vf") {
    const choiceOk = picked === q.answer;
    const tNorm = normCite(typed ?? "");
    const qNorm = normCite(q.quote ?? "");
    const dNorm = docText ? normCite(docText) : "";
    let quoteMatched = false;
    if (tNorm.length >= 12 && qNorm) {
      const targetWords = citeWords(q.quote ?? "");
      const typedSet = new Set(normCite(typed ?? "").split(/\s+/).filter(Boolean));
      const hits = targetWords.filter((w) => typedSet.has(w)).length;
      const ratio = targetWords.length ? hits / targetWords.length : 0;
      const inDoc = dNorm ? dNorm.includes(tNorm) : true;
      quoteMatched = (inDoc && ratio >= 0.55) || ratio >= 0.75;
    }
    return { correct: choiceOk && quoteMatched, choiceOk, quoteMatched };
  }
  if (qt === "short") {
    const tNorm = normCite(typed ?? "");
    const candidates = (q.accepted ?? []).filter(Boolean);
    if (!tNorm || !candidates.length) return { correct: false };
    const tTokens = expandShortTokens(tNorm);
    const tSet = new Set(tTokens);
    const tStrictNegs = tTokens.filter((w) => STRICT_NEGATORS.has(w));
    const ok = candidates.some((cand) => {
      const cNorm = normCite(cand);
      if (!cNorm) return false;
      const cTokens = expandShortTokens(cNorm);
      const cNegs = cTokens.filter((w) => NEGATION_WORDS.has(w));
      const cStrictNegs = cTokens.filter((w) => STRICT_NEGATORS.has(w));
      // Enforce negation polarity: never ignore `ne, ni, pas, plus, jamais, sans, aucun, guère, rien`.
      if (cStrictNegs.length > 0 && tStrictNegs.length === 0) return false;
      if (cNegs.length === 0 && tStrictNegs.length > 0) return false;
      if (cNegs.includes("plus") && !cStrictNegs.length && !tSet.has("plus")) return false;
      const allCandNegsPresent = cNegs.every((w) => tSet.has(w));
      if (
        allCandNegsPresent &&
        (tNorm.includes(cNorm) || (tNorm.length >= 4 && cNorm.includes(tNorm) && tNorm.length >= cNorm.length * 0.65))
      ) {
        return true;
      }
      const words = shortWords(cand);
      const pool = words.length ? words : cTokens;
      const contentPool = pool.filter((w) => !NEGATION_WORDS.has(w));
      const contentHits = contentPool.filter((w) => tSet.has(w)).length;
      if (contentPool.length > 0 && contentHits / contentPool.length < 0.5) return false;
      const hits = pool.filter((w) => tSet.has(w)).length;
      return pool.length > 0 && hits / pool.length >= 0.65;
    });
    return { correct: ok };
  }
  return { correct: picked === q.answer };
}

const MIN_DOC_WORDS: Record<CompForm, number> = {
  long: 300,
  opinions: 280,
  short: 110,
};

/** Strict DELF B2 structural validation used to gate AI-generated exercises and presets. */
export function isValidComprehension(ex: CompExercise, form: CompForm = ex.form): boolean {
  const spec = FORM_SPEC[form];
  if (ex.docs.length !== (form === "short" ? 3 : 1)) return false;
  const minWords = MIN_DOC_WORDS[form];
  if (!ex.docs.every((d) => countCompWords(d.text) >= minWords)) return false;
  if (ex.questions.length !== spec.questions) return false;
  if (exercisePoints(ex) !== spec.points) return false;
  if (form === "short" && ex.questions.map((q) => q.doc).join(",") !== "0,0,1,1,2,2") return false;
  if (form === "opinions" && ![0, 1, 2].every((j) => ex.questions.filter((q) => q.answer === j).length === 2)) return false;
  for (const q of ex.questions) {
    if (!q.qType || q.qType === "qcm") {
      if (q.options.length < 2) return false;
      const optWords = q.options.map(countCompWords);
      if (optWords.some((n) => n === 0)) return false;
      const minOpt = Math.min(...optWords);
      const maxOpt = Math.max(...optWords);
      if (maxOpt > minOpt * 3.5 + 4) return false;
    }
  }
  return true;
}

export function sanitizeExercise(raw: unknown, form: CompForm, topic: string): CompExercise {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const docs = (Array.isArray(r.docs) ? r.docs : [])
    .filter((d): d is Record<string, unknown> => !!d && typeof d === "object")
    .map((d) => {
      const rawUrl = typeof d.audioUrl === "string" ? d.audioUrl.trim() : "";
      const audioUrl = rawUrl && VALID_CO_AUDIO.test(rawUrl) ? rawUrl : undefined;
      return { text: str(d.text, 6000), zh: str(d.zh, 6000), ...(audioUrl ? { audioUrl } : {}) };
    })
    .filter((d) => d.text)
    .slice(0, form === "short" ? 3 : 1);
  const rows: (Omit<CompQuestion, "pts"> & { level: number })[] = [];
  for (const x of Array.isArray(r.questions) ? r.questions : []) {
    if (!x || typeof x !== "object") continue;
    const rec = x as Record<string, unknown>;
    const q = str(rec.q, 400);
    if (!q) continue;
    const docRaw = typeof rec.doc === "number" ? Math.round(rec.doc) : 0;
    const doc = docRaw >= 0 && docRaw < docs.length ? docRaw : 0;
    const level = typeof rec.difficulty === "number" && Number.isFinite(rec.difficulty) ? Math.min(5, Math.max(1, Math.round(rec.difficulty))) : 3;
    const skill = QSKILLS.includes(rec.skill as QSkill) ? (rec.skill as QSkill) : undefined;
    const why = str(rec.why, 500);
    const evidence = str(rec.evidence, 450);
    const rawTraps = Array.isArray(rec.trapTypes) ? rec.trapTypes.slice(0, 3).map((t) => str(t, 80)) : [];
    const trapTypes = rawTraps.some(Boolean) ? rawTraps : undefined;
    const qtRaw = rec.qType;
    const qType: CompQuestionType = qtRaw === "vf" || qtRaw === "short" ? qtRaw : "qcm";
    if (qType === "vf") {
      const answer = typeof rec.answer === "number" ? Math.round(rec.answer) : -1;
      const quote = str(rec.quote, 360);
      if ((answer !== 0 && answer !== 1) || !quote) continue;
      rows.push({
        q,
        qType: "vf",
        options: ["Vrai", "Faux"],
        answer,
        quote,
        why,
        level,
        doc,
        ...(evidence ? { evidence } : {}),
        ...(trapTypes ? { trapTypes } : {}),
        ...(skill ? { skill } : {}),
      });
    } else if (qType === "short") {
      const accepted = (Array.isArray(rec.accepted) ? rec.accepted : []).map((a) => str(a, 180)).filter(Boolean).slice(0, 4);
      if (!accepted.length) continue;
      rows.push({
        q,
        qType: "short",
        options: [],
        answer: 0,
        accepted,
        why,
        level,
        doc,
        ...(evidence ? { evidence } : {}),
        ...(skill ? { skill } : {}),
      });
    } else {
      const options = Array.isArray(rec.options) ? rec.options.map((o) => str(o, 240)).filter(Boolean).slice(0, 3) : [];
      const answer = typeof rec.answer === "number" ? Math.round(rec.answer) : -1;
      if (options.length !== 3 || new Set(options).size !== 3 || answer < 0 || answer >= 3) continue;
      rows.push({
        q,
        options,
        answer,
        why,
        level,
        doc,
        ...(evidence ? { evidence } : {}),
        ...(trapTypes ? { trapTypes } : {}),
        ...(skill ? { skill } : {}),
      });
    }
    if (rows.length >= FORM_SPEC[form].questions) break;
  }
  // points only add up to the exercise's total when every question came back
  const pts = weigh(rows.map((x) => x.level), rows.length === FORM_SPEC[form].questions ? FORM_SPEC[form].points : rows.length);
  const questions: CompQuestion[] = rows.map(({ level: _l, ...x }, k) => ({ ...x, pts: pts[k] })).sort((a, b) => a.doc - b.doc);
  return { form, topic, intro: str(r.intro, 240), title: str(r.title, 120).replace(/^["«\s]+|["»\s]+$/g, ""), docs, questions };
}

export const exercisePoints = (ex: CompExercise) => ex.questions.reduce((n, q) => n + q.pts, 0);

/** Lightweight metadata for the 15 official DELF B2 themes (avoids pulling full exam.ts into Today/Cockpit). */
export const B2_TOPICS_META = [
  { id: "environnement", zh: "环境与生态", fr: "l'environnement et la transition écologique" },
  { id: "travail", zh: "职场与劳动", fr: "le travail" },
  { id: "education", zh: "教育与校园", fr: "l'éducation" },
  { id: "numerique", zh: "数字生活与社交网络", fr: "le numérique" },
  { id: "sante", zh: "健康与医疗制度", fr: "la santé" },
  { id: "societe", zh: "社会与代际关系", fr: "la société et la famille" },
  { id: "consommation", zh: "消费方式与商业伦理", fr: "la consommation" },
  { id: "culture", zh: "文化旅游与生活方式", fr: "la culture et les voyages" },
  { id: "politique-justice", zh: "政治制度与法治公民", fr: "la politique, la citoyenneté et la justice" },
  { id: "sciences-ethique", zh: "科研创新与 AI 伦理", fr: "les sciences, la recherche et l'éthique" },
  { id: "medias-presse", zh: "新闻传媒与信息核查", fr: "les médias, la presse et l'information" },
  { id: "logement-urbanisme", zh: "住房政策与城市规划", fr: "le logement et l'urbanisme" },
  { id: "economie-finances", zh: "经济发展与公共财政", fr: "l'économie et les finances publiques" },
  { id: "transports-mobilite", zh: "交通运输与可持续出行", fr: "les transports et la mobilité" },
  { id: "arts-francophonie", zh: "文学艺术与法语世界", fr: "les arts, la langue et la francophonie" },
] as const;

export type B2TopicId = (typeof B2_TOPICS_META)[number]["id"];

export interface SpeakingPronSummary {
  pron: number | null;
  accuracy: number | null;
  fluency: number | null;
  prosody: number | null;
  completeness: number | null;
}

export interface SpeakingSession {
  id: string;
  at: number;
  subjectId: string;
  title: string;
  topic: string;
  monologueWords: number;
  monologueSec: number;
  debateTurns: number;
  debateSec: number;
  total25: number | null;
  typed?: boolean;
  draft?: number;
  pron?: SpeakingPronSummary;
  transcript?: string;
  turns?: { q: string; a: string }[];
  /** IndexedDB KeptRecording ID for monologue audio playback. */
  takeId?: string;
}

export const MAX_SPEAKING_SESSIONS = 30;

const score100OrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100 ? Math.round(v * 10) / 10 : null;

export function sanitizeSpeakingSessions(v: unknown): SpeakingSession[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: SpeakingSession[] = [];
  const seen = new Set<string>();
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    const id = str(e.id, 48);
    const subjectId = str(e.subjectId, 48);
    const title = str(e.title, 120);
    const topic = str(e.topic, 40);
    if (!id || seen.has(id) || !subjectId || !title || typeof e.at !== "number" || !Number.isFinite(e.at)) continue;
    seen.add(id);
    const total25 =
      typeof e.total25 === "number" && Number.isFinite(e.total25) && e.total25 >= 0 && e.total25 <= 25
        ? Math.round(e.total25 * 10) / 10
        : null;
    const pObj = e.pron && typeof e.pron === "object" ? (e.pron as Record<string, unknown>) : null;
    const pron: SpeakingPronSummary | undefined = pObj
      ? {
          pron: score100OrNull(pObj.pron),
          accuracy: score100OrNull(pObj.accuracy),
          fluency: score100OrNull(pObj.fluency),
          prosody: score100OrNull(pObj.prosody),
          completeness: score100OrNull(pObj.completeness),
        }
      : undefined;
    const turns = Array.isArray(e.turns)
      ? e.turns
          .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
          .map((t) => ({ q: str(t.q, 320), a: str(t.a, 800) }))
          .filter((t) => t.q)
          .slice(0, 12)
      : undefined;
    const transcript = str(e.transcript, 6000);
    const takeId = str(e.takeId, 48);
    out.push({
      id,
      at: e.at,
      subjectId,
      title,
      topic,
      monologueWords: typeof e.monologueWords === "number" && e.monologueWords >= 0 ? Math.min(3000, Math.round(e.monologueWords)) : 0,
      monologueSec: typeof e.monologueSec === "number" && e.monologueSec >= 0 ? Math.min(3600, Math.round(e.monologueSec)) : 0,
      debateTurns: typeof e.debateTurns === "number" && e.debateTurns >= 0 ? Math.min(30, Math.round(e.debateTurns)) : 0,
      debateSec: typeof e.debateSec === "number" && e.debateSec >= 0 ? Math.min(3600, Math.round(e.debateSec)) : 0,
      total25,
      ...(e.typed === true ? { typed: true } : {}),
      ...(typeof e.draft === "number" && e.draft >= 1 && e.draft <= 20 ? { draft: Math.round(e.draft) } : {}),
      ...(pron && Object.values(pron).some((n) => n !== null) ? { pron } : {}),
      ...(transcript ? { transcript } : {}),
      ...(turns?.length ? { turns } : {}),
      ...(takeId ? { takeId } : {}),
    });
    if (out.length >= MAX_SPEAKING_SESSIONS) break;
  }
  return out.length ? out : undefined;
}

export interface MockRecord {
  id: string;
  at: number;
  setIdx: number;
  label: string;
  strict: boolean;
  co: number | null;
  ce: number | null;
  pe: number | null;
  po: number | null;
  total100: number | null;
  peTaskId: string;
  poSubjectId: string;
  typedPo?: boolean;
}

export const MAX_MOCK_RECORDS = 24;

const partScore25 = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 25 ? Math.round(v * 10) / 10 : null;

export function sanitizeMockRecords(v: unknown): MockRecord[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: MockRecord[] = [];
  const seen = new Set<string>();
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    const id = str(e.id, 48);
    const label = str(e.label, 80);
    if (!id || seen.has(id) || !label || typeof e.at !== "number" || !Number.isFinite(e.at)) continue;
    seen.add(id);
    const co = partScore25(e.co);
    const ce = partScore25(e.ce);
    const pe = partScore25(e.pe);
    const po = partScore25(e.po);
    const total100 =
      typeof e.total100 === "number" && Number.isFinite(e.total100) && e.total100 >= 0 && e.total100 <= 100
        ? Math.round(e.total100 * 10) / 10
        : co !== null && ce !== null && pe !== null && po !== null
          ? Math.round((co + ce + pe + po) * 10) / 10
          : null;
    out.push({
      id,
      at: e.at,
      setIdx: typeof e.setIdx === "number" && e.setIdx >= 0 ? Math.round(e.setIdx) : 0,
      label,
      strict: Boolean(e.strict),
      co,
      ce,
      pe,
      po,
      total100,
      peTaskId: str(e.peTaskId, 48),
      poSubjectId: str(e.poSubjectId, 48),
      ...(e.typedPo === true ? { typedPo: true } : {}),
    });
    if (out.length >= MAX_MOCK_RECORDS) break;
  }
  return out.length ? out : undefined;
}

export interface WeeklyRemediationTask {
  id: string;
  day: number;
  part: ExamPart;
  title: string;
  route: string;
  minutes: number;
  doneAt?: number;
}

export interface WeeklyRemediationPlan {
  id: string;
  createdAt: number;
  focusPart: ExamPart;
  target: number;
  total100: number | null;
  tasks: WeeklyRemediationTask[];
}

export function sanitizeWeeklyPlan(v: unknown): WeeklyRemediationPlan | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const e = v as Record<string, unknown>;
  const id = str(e.id, 48);
  const focusPart = (EXAM_PARTS as readonly string[]).includes(e.focusPart as string) ? (e.focusPart as ExamPart) : null;
  if (!id || !focusPart || typeof e.createdAt !== "number" || !Number.isFinite(e.createdAt) || !Array.isArray(e.tasks)) {
    return undefined;
  }
  const tasks: WeeklyRemediationTask[] = [];
  const seen = new Set<string>();
  for (const raw of e.tasks) {
    if (!raw || typeof raw !== "object") continue;
    const t = raw as Record<string, unknown>;
    const tid = str(t.id, 24);
    const title = str(t.title, 140);
    const route = str(t.route, 80);
    const part = (EXAM_PARTS as readonly string[]).includes(t.part as string) ? (t.part as ExamPart) : null;
    if (!tid || seen.has(tid) || !title || !route || !part || typeof t.day !== "number") continue;
    seen.add(tid);
    tasks.push({
      id: tid,
      day: Math.max(1, Math.min(7, Math.round(t.day))),
      part,
      title,
      route,
      minutes: typeof t.minutes === "number" && Number.isFinite(t.minutes) ? Math.max(5, Math.min(180, Math.round(t.minutes))) : 30,
      ...(typeof t.doneAt === "number" && Number.isFinite(t.doneAt) && t.doneAt > 0 ? { doneAt: t.doneAt } : {}),
    });
    if (tasks.length >= 7) break;
  }
  if (!tasks.length) return undefined;
  const target = typeof e.target === "number" && e.target >= 50 && e.target <= 100 ? Math.round(e.target) : 75;
  const total100 =
    typeof e.total100 === "number" && Number.isFinite(e.total100) && e.total100 >= 0 && e.total100 <= 100
      ? Math.round(e.total100 * 10) / 10
      : null;
  return { id, createdAt: e.createdAt, focusPart, target, total100, tasks };
}
