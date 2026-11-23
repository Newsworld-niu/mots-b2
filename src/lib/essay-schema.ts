import { ERROR_TYPES, type ErrorType } from "./writing";

export type Genre = "mail" | "recit" | "lettre" | "motivation" | "courrier" | "article" | "essai" | "forum";

export const GENRE_LABEL: Record<Genre, string> = {
  mail: "给朋友的邮件",
  recit: "叙事",
  lettre: "正式信件",
  motivation: "求职信",
  courrier: "读者来信",
  article: "评论文章",
  essai: "议论文",
  forum: "论坛发帖",
};

export interface EssayTask {
  id: string;
  level: "B1" | "B2";
  genre: Genre;
  title: string;
  /** The situation, in Chinese. */
  situation: string;
  /** The instruction as an exam would put it, in French. */
  consigne: string;
  words: [number, number];
  /** A short French document the text reacts to, when the task has one. */
  doc?: string;
  /** Exam topic whose vocabulary helps here. */
  topic?: string;
  /** What the text must contain, in Chinese. */
  points: string[];
  /** A plan to follow: what each part does, with a French opening to borrow. */
  plan: { zh: string; fr: string }[];
  /** Phrases that fit this task, French | Chinese. */
  phrases: [string, string][];
}

export const B1_ESSAY_IDS: ReadonlySet<string> = new Set([
  "mail-invitation",
  "recit-voyage",
  "forum-teletravail",
]);

export const ESSAY_TASK_IDS: ReadonlySet<string> = new Set([
  "mail-invitation",
  "recit-voyage",
  "forum-teletravail",
  "lettre-reclamation",
  "lettre-motivation",
  "courrier-voitures",
  "essai-ecrans",
  "essai-etranger",
  "doc-livraison",
  "doc-musees",
  "doc-sommeil",
  "doc-mediatheque",
  "courrier-emballages",
  "essai-intergeneration",
  "lettre-budget-participatif",
  "article-ia-recherche",
  "essai-infox-ecole",
  "lettre-loyers",
  "courrier-pouvoir-achat",
  "article-arts-vivants",
]);

export const FORMAL_GENRES: Genre[] = ["lettre", "motivation", "courrier"];

/** The five criteria of the official writing grid (grille d'évaluation de la production écrite). */
export const CRITERIA = ["task", "coherence", "socio", "lexique", "morpho"] as const;
export type Criterion = (typeof CRITERIA)[number];

/** Every criterion of the writing and speaking grids, by key. */
export const CRITERION_LABEL: Record<string, string> = {
  task: "完成任务",
  coherence: "连贯和衔接",
  socio: "语体得体",
  lexique: "词汇",
  morpho: "语法",
  monologue: "独白：论证观点",
  interaction: "互动：辩论",
  phono: "发音和语调",
};

/** The eleven 0.5-pt levels on the official FEI Sept-2022 0–5 DELF grid. */
export const LEVELS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;
export const LEVEL_LABEL: Record<number, string> = {
  0: "未作答或不足",
  0.5: "远低于 B2（初阶）",
  1: "低于 B2",
  1.5: "B1 中段（明显欠缺）",
  2: "B1+（接近 B2）",
  2.5: "B2 临界（尚不稳定）",
  3: "稳健 B2",
  3.5: "良好 B2",
  4: "强 B2",
  4.5: "强 B2+（接近 C1）",
  5: "B2+/C1",
};
export const LEVEL_LABELS: Record<"B1" | "B2", Record<number, string>> = {
  B1: {
    0: "未作答或不足",
    0.5: "远低于 B1（A1）",
    1: "低于 B1",
    1.5: "A2 中段（明显欠缺）",
    2: "A2+（接近 B1）",
    2.5: "B1 临界（尚不稳定）",
    3: "稳健 B1",
    3.5: "良好 B1",
    4: "强 B1",
    4.5: "强 B1+（接近 B2）",
    5: "B1+/B2",
  },
  B2: LEVEL_LABEL,
};
/** Snap a raw numeric mark onto the discrete 0.5-pt [0..5] grid. */
export const toLevel = (n: number) => (!Number.isFinite(n) || n <= 0 ? 0 : Math.min(5, Math.round(n * 2) / 2));
export const levelLabel = (score: number, level: "B1" | "B2" = "B2"): string => LEVEL_LABELS[level][toLevel(score)] ?? "";

export interface EssayCorrection {
  wrong: string;
  right: string;
  type: ErrorType;
  why: string;
  /** Id of the grammar point to practise, or "". */
  point: string;
}

export interface EssayFlags {
  offTopic?: "none" | "partial" | "total";
  wrongGenre?: boolean;
  registerViolation?: boolean;
  pastedFromDoc?: boolean;
  cursoryDebate?: boolean;
  hasSystematicB1Errors?: boolean;
  repetitiveBasicLexis?: boolean;
  mechanicalB1Structure?: boolean;
  informalTu?: boolean;
  readAloud?: boolean;
  rambleOvertime?: boolean;
}

export interface ScoreCap {
  criterion: string;
  before: number;
  after: number;
  reason: string;
}

export interface EssayFeedback {
  /** 0–5 per criterion of the grid used. */
  scores: Record<string, number>;
  comment: string;
  strengths: string[];
  todo: string[];
  corrections: EssayCorrection[];
  /** The learner's text with its errors fixed, keeping their ideas and wording where acceptable. */
  rewrite: string;
  /** Structured compliance flags from the grid check, when any anomaly is present. */
  flags?: EssayFlags;
  /** Exact score reductions applied by deterministic rules (preserved for Marking breakdown). */
  caps?: ScoreCap[];
}

/** The learner's second draft after reading the marking, and how it was marked. */
export interface Revision {
  text: string;
  at: number;
  fb?: EssayFeedback;
}

/** A model text for the task, written after the marking, with the patterns worth borrowing from it. */
export interface ModelEssay {
  text: string;
  /** Phrases or constructions of the model text, with what they do (Chinese). */
  patterns: { fr: string; zh: string }[];
}

export interface SavedEssay {
  id: string;
  task: string;
  text: string;
  created: number;
  fb?: EssayFeedback;
  rev?: Revision;
  model?: ModelEssay;
}

/** A mistake the learner kept from a marking, to look at again. */
export interface SavedNote {
  id: string;
  wrong: string;
  right: string;
  type: ErrorType;
  why: string;
  /** Id of the grammar point to practise, or "". */
  point: string;
  at: number;
  /** Title of the task it came from. */
  from: string;
}

export const MAX_ESSAY_LENGTH = 4000;
export const MAX_SPEAKING_MONOLOGUE_LENGTH = MAX_ESSAY_LENGTH + 2000;
export const MAX_ESSAYS = 40;
export const MAX_NOTES = 150;
export const MAX_AI_TASKS = 24;

/** A task the AI wrote has an id starting with this. */
export const isAiTask = (id: string) => id.startsWith("ai-");

/** How many words a task of this kind asks for, as on the exam. B2 has no upper penalty (250–350 recommended). */
export const wordsFor = (level: "B1" | "B2", genre: Genre): [number, number] => (level === "B2" ? [250, 350] : genre === "mail" ? [120, 160] : [160, 200]);

/** Genres the AI can write a task for. */
export const GENRES = Object.keys(GENRE_LABEL) as Genre[];

/** Authentic DELF B2 genres (excludes B1-only mail and récit). */
export const B2_GENRES: Genre[] = GENRES.filter((g) => g !== "mail" && g !== "recit");

export const genresFor = (level: "B1" | "B2"): Genre[] => (level === "B2" ? B2_GENRES : GENRES);

export const totalScore = (fb: EssayFeedback) => Math.round(Object.values(fb.scores).reduce((n, v) => n + v, 0) * 10) / 10;
export const maxScore = (fb: EssayFeedback) => Object.keys(fb.scores).length * 5;

/** Words as an examiner counts them: runs of letters; l'ami and c'est-à-dire count once. */
export function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}

const str = (v: unknown, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown, max: number) =>
  (Array.isArray(v) ? v : [])
    .map((x) => str(x, 300))
    .filter(Boolean)
    .slice(0, max);

const OLD_KEYS: Record<string, string> = { structure: "coherence", grammar: "morpho", vocabulary: "lexique" };

function parseFlags(r: Record<string, unknown>): EssayFlags | undefined {
  const f = (r.flags && typeof r.flags === "object" ? r.flags : r) as Record<string, unknown>;
  const audit = (r.taskAudit && typeof r.taskAudit === "object" ? r.taskAudit : f) as Record<string, unknown>;
  const prof = (r.profile && typeof r.profile === "object" ? r.profile : f) as Record<string, unknown>;
  const rawOff = audit.offTopic ?? f.offTopic;
  const offTopic = rawOff === "partial" || rawOff === "total" ? rawOff : "none";
  const wrongGenre = audit.wrongGenre === true || f.wrongGenre === true;
  const registerViolation = audit.registerViolation === true || f.registerViolation === true;
  const pastedFromDoc = f.pastedFromDoc === true;
  const cursoryDebate = f.cursoryDebate === true;
  const hasSystematicB1Errors = prof.hasSystematicB1Errors === true;
  const repetitiveBasicLexis = prof.repetitiveBasicLexis === true;
  const mechanicalB1Structure = prof.mechanicalB1Structure === true;
  const informalTu = f.informalTu === true;
  const readAloud = f.readAloud === true;
  const rambleOvertime = f.rambleOvertime === true;
  if (
    offTopic === "none" &&
    !wrongGenre &&
    !registerViolation &&
    !pastedFromDoc &&
    !cursoryDebate &&
    !hasSystematicB1Errors &&
    !repetitiveBasicLexis &&
    !mechanicalB1Structure &&
    !informalTu &&
    !readAloud &&
    !rambleOvertime
  ) {
    return undefined;
  }
  return {
    ...(offTopic !== "none" ? { offTopic } : {}),
    ...(wrongGenre ? { wrongGenre } : {}),
    ...(registerViolation ? { registerViolation } : {}),
    ...(pastedFromDoc ? { pastedFromDoc } : {}),
    ...(cursoryDebate ? { cursoryDebate } : {}),
    ...(hasSystematicB1Errors ? { hasSystematicB1Errors } : {}),
    ...(repetitiveBasicLexis ? { repetitiveBasicLexis } : {}),
    ...(mechanicalB1Structure ? { mechanicalB1Structure } : {}),
    ...(informalTu ? { informalTu } : {}),
    ...(readAloud ? { readAloud } : {}),
    ...(rambleOvertime ? { rambleOvertime } : {}),
  };
}

export function pushCap(caps: ScoreCap[], criterion: string, before: number, after: number, reason: string) {
  if (!(after < before)) return;
  const existing = caps.find((c) => c.criterion === criterion);
  if (existing) {
    existing.after = Math.min(existing.after, after);
    if (!existing.reason.includes(reason)) existing.reason = `${existing.reason}；${reason}`.slice(0, 120);
  } else {
    caps.push({ criterion, before, after, reason: reason.slice(0, 120) });
  }
}

export function capScoresByFlags(
  scores: Record<string, number>,
  flags?: EssayFlags,
  level: "B1" | "B2" = "B2",
  caps: ScoreCap[] = [],
): { scores: Record<string, number>; caps: ScoreCap[] } {
  const s = { ...scores };
  const nextCaps = caps.map((c) => ({ ...c }));
  const cap = (k: string, maxVal: number, reason: string) => {
    if (!(k in s) || s[k] <= maxVal) return;
    pushCap(nextCaps, k, s[k], maxVal, reason);
    s[k] = maxVal;
  };
  if (!flags) return { scores: s, caps: nextCaps };
  if (flags.offTopic === "partial") {
    cap("task", 3, "部分偏题");
    cap("monologue", 3, "部分偏题");
    cap("lexique", 3, "部分偏题");
  } else if (flags.offTopic === "total") {
    for (const k of Object.keys(s)) cap(k, 0, "严重偏题");
    return { scores: s, caps: nextCaps };
  }
  if (flags.wrongGenre) {
    cap("task", 1, "文体错位");
    cap("coherence", 1, "文体错位");
  }
  if (flags.registerViolation) {
    cap("socio", 1, "语域/格式不符");
  }
  if (level === "B2") {
    if (flags.hasSystematicB1Errors) cap("morpho", 1, "系统性 B1 语法错误");
    if (flags.repetitiveBasicLexis) cap("lexique", 1, "基础词重复/直译");
    if (flags.mechanicalB1Structure) {
      cap("coherence", 1, "机械 B1 结构");
      cap("task", 3, "机械 B1 结构");
      cap("monologue", 3, "机械 B1 结构");
    }
    if (flags.hasSystematicB1Errors || flags.repetitiveBasicLexis) {
      const why = flags.hasSystematicB1Errors && flags.repetitiveBasicLexis ? "B1 语法及词汇连带封顶" : flags.hasSystematicB1Errors ? "系统性 B1 语法连带封顶" : "基础词重复连带封顶";
      for (const k of ["task", "coherence", "socio", "monologue", "interaction"]) cap(k, 3, why);
    }
  }
  if (flags.pastedFromDoc) {
    cap("monologue", 1, "照抄材料/高频重复");
    cap("lexique", 1, "照抄材料/高频重复");
  }
  if (flags.cursoryDebate) {
    cap("interaction", 1, "辩论敷衍");
  }
  return { scores: s, caps: nextCaps };
}

/** Make an AI marking safe to show. `points` are the grammar point ids that may be linked. */
export function sanitizeEssayFeedback(raw: unknown, points: ReadonlySet<string>, criteria: readonly string[] = CRITERIA, level: "B1" | "B2" = "B2"): EssayFeedback {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const given = (r.scores && typeof r.scores === "object" ? r.scores : {}) as Record<string, unknown>;
  const s: Record<string, unknown> = { ...given };
  for (const [old, now] of Object.entries(OLD_KEYS)) if (s[now] === undefined && given[old] !== undefined) s[now] = given[old];
  const rawScores: Record<string, number> = {};
  for (const c of criteria) rawScores[c] = toLevel(typeof s[c] === "number" && Number.isFinite(s[c]) ? (s[c] as number) : 0);
  const flags = parseFlags(r);
  const incomingCaps: ScoreCap[] = (Array.isArray(r.caps) ? r.caps : [])
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({
      criterion: str(c.criterion, 30),
      before: typeof c.before === "number" && Number.isFinite(c.before) ? toLevel(c.before) : 0,
      after: typeof c.after === "number" && Number.isFinite(c.after) ? toLevel(c.after) : 0,
      reason: str(c.reason, 120),
    }))
    .filter((c) => c.criterion && c.reason && c.after < c.before);
  const { scores, caps } = capScoresByFlags(rawScores, flags, level, incomingCaps);
  const corrections: EssayCorrection[] = (Array.isArray(r.corrections) ? r.corrections : [])
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => ({
      wrong: str(e.wrong, 200),
      right: str(e.right, 200),
      type: (ERROR_TYPES as readonly string[]).includes(e.type as string) ? (e.type as ErrorType) : ("other" as ErrorType),
      why: str(e.why, 300),
      point: typeof e.point === "string" && points.has(e.point) ? e.point : "",
    }))
    .filter((e) => (e.wrong || e.right) && e.wrong !== e.right)
    .slice(0, 25);
  return {
    scores,
    comment: str(r.comment, 800),
    strengths: list(r.strengths, 4),
    todo: list(r.todo, 4),
    corrections,
    rewrite: str(r.rewrite, MAX_ESSAY_LENGTH + 1000),
    ...(flags ? { flags } : {}),
    ...(caps.length ? { caps } : {}),
  };
}

export function applyEssayLengthCaps(fb: EssayFeedback, text: string, minWords: number): EssayFeedback {
  const wc = countWords(text);
  const scores = { ...fb.scores };
  const caps = (fb.caps ?? []).map((c) => ({ ...c }));
  const cap = (k: string, maxVal: number, reason: string) => {
    if (!(k in scores) || scores[k] <= maxVal) return;
    pushCap(caps, k, scores[k], maxVal, reason);
    scores[k] = maxVal;
  };
  let note = "";
  if (wc < minWords / 2) {
    const why = `字数不到一半（${wc}/${minWords} 词）`;
    for (const c of CRITERIA) cap(c, 0, why);
    note = `不到要求字数的一半（实测 ${wc} 词，要求至少 ${minWords} 词），按官方评分表各项记 0 分。`;
  } else if (wc < Math.round(minWords * 0.7)) {
    const why = `字数严重不足（${wc}/${minWords} 词）`;
    cap("task", 1, why);
    cap("coherence", 1, why);
    cap("socio", 3, why);
    cap("lexique", 3, why);
    cap("morpho", 3, why);
    note = `字数严重不足（实测 ${wc} 词，要求至少 ${minWords} 词，低于 ${Math.round(minWords * 0.7)} 词），完成任务与连贯衔接封顶 1 分，其余项最高 3 分。`;
  } else if (wc < Math.round(minWords * 0.9)) {
    const deduct = wc < Math.round(minWords * 0.8) ? 1 : 0.5;
    if ("task" in scores && scores.task > 0) {
      const nextTask = toLevel(Math.max(0, scores.task - deduct));
      pushCap(caps, "task", scores.task, nextTask, `字数低于容忍下限（${wc}/${minWords} 词，扣 ${deduct} 分）`);
      scores.task = nextTask;
    }
    note = `字数低于容忍下限（实测 ${wc} 词，低于 ${Math.round(minWords * 0.9)} 词），按 FEI 2022 平滑扣分规则完成任务扣 ${deduct} 分。`;
  }
  return note ? { ...fb, scores, ...(caps.length ? { caps } : {}), comment: `${note}${fb.comment}` } : fb;
}

const anyPoint = { has: (id: string) => /^[a-z0-9-]{2,40}$/.test(id) } as ReadonlySet<string>;

export function sanitizeModel(m: Record<string, unknown>): ModelEssay {
  const patterns = (Array.isArray(m.patterns) ? m.patterns : [])
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map((p) => ({ fr: str(p.fr, 200), zh: str(p.zh, 200) }))
    .filter((p) => p.fr)
    .slice(0, 10);
  return { text: str(m.text, MAX_ESSAY_LENGTH + 1000), patterns };
}

export function sanitizeEssays(v: unknown): SavedEssay[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: SavedEssay[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const e = x as Record<string, unknown>;
    if (typeof e.id !== "string" || typeof e.task !== "string" || !(ESSAY_TASK_IDS.has(e.task) || (isAiTask(e.task) && e.task.length <= 40)) || typeof e.text !== "string" || !e.text.trim() || typeof e.created !== "number") continue;
    const essay: SavedEssay = { id: e.id.slice(0, 40), task: e.task, text: e.text.slice(0, MAX_ESSAY_LENGTH), created: e.created };
    const lv = B1_ESSAY_IDS.has(e.task) ? "B1" : "B2";
    if (e.fb && typeof e.fb === "object") essay.fb = sanitizeEssayFeedback(e.fb, anyPoint, CRITERIA, lv);
    const r = e.rev as Record<string, unknown> | undefined;
    if (r && typeof r === "object" && typeof r.text === "string" && r.text.trim() && typeof r.at === "number") {
      essay.rev = { text: r.text.slice(0, MAX_ESSAY_LENGTH), at: r.at, ...(r.fb && typeof r.fb === "object" ? { fb: sanitizeEssayFeedback(r.fb, anyPoint, CRITERIA, lv) } : {}) };
    }
    const m = e.model as Record<string, unknown> | undefined;
    if (m && typeof m === "object" && typeof m.text === "string" && m.text.trim()) essay.model = sanitizeModel(m);
    out.push(essay);
  }
  return out.length ? out.slice(0, MAX_ESSAYS) : undefined;
}

export function sanitizeNotes(v: unknown): SavedNote[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: SavedNote[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const n = x as Record<string, unknown>;
    if (typeof n.id !== "string" || typeof n.at !== "number") continue;
    const wrong = str(n.wrong, 200);
    const right = str(n.right, 200);
    if (!(wrong || right) || wrong === right) continue;
    out.push({
      id: n.id.slice(0, 40),
      wrong,
      right,
      type: (ERROR_TYPES as readonly string[]).includes(n.type as string) ? (n.type as ErrorType) : "other",
      why: str(n.why, 300),
      point: typeof n.point === "string" && /^[a-z0-9-]{2,40}$/.test(n.point) ? n.point : "",
      at: n.at,
      from: str(n.from, 80),
    });
  }
  return out.length ? out.slice(0, MAX_NOTES) : undefined;
}

export function buildTask(raw: unknown, id: string): EssayTask | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const level = r.level === "B1" || r.level === "B2" ? r.level : null;
  const genre = (GENRES as readonly string[]).includes(r.genre as string) ? (r.genre as Genre) : null;
  if (!level || !genre || !id) return null;
  const pairs = (v: unknown, a: string, b: string, n: number) =>
    (Array.isArray(v) ? v : [])
      .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
      .map((p) => [str(p[a], 300), str(p[b], 300)] as [string, string])
      .filter(([x, y]) => x && y)
      .slice(0, n);
  const plan = pairs(r.plan, "zh", "fr", 6).map(([zh, fr]) => ({ zh, fr }));
  const phrases = pairs((Array.isArray(r.phrases) ? r.phrases : []).map((p) => (Array.isArray(p) ? { fr: p[0], zh: p[1] } : p)), "fr", "zh", 10);
  const points = list(r.points, 6);
  const title = str(r.title, 60);
  const situation = str(r.situation, 300);
  const consigne = str(r.consigne, 500);
  if (!title || !situation || !consigne || points.length < 2 || plan.length < 3) return null;
  const doc = str(r.doc, 1200);
  const topic = typeof r.topic === "string" && r.topic ? r.topic.slice(0, 30) : undefined;
  return { id: id.slice(0, 40), level, genre, title, situation, consigne, words: wordsFor(level, genre), points, plan, phrases, ...(doc ? { doc } : {}), ...(topic ? { topic } : {}) };
}

export function sanitizeAiTasks(v: unknown): EssayTask[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: EssayTask[] = [];
  for (const x of v) {
    const t = buildTask(x, typeof (x as Record<string, unknown>)?.id === "string" ? ((x as Record<string, unknown>).id as string) : "");
    if (t && isAiTask(t.id)) out.push(t);
  }
  return out.length ? out.slice(0, MAX_AI_TASKS) : undefined;
}
