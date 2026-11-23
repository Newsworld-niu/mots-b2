/**
 * Daily DELF B2 exam preparation scheduler (今日备考调度).
 * Balances CO (listen), CE (read), PE (essay), PO (speak), grammar, and vocabulary
 * based on exam countdown and weakest skills from `examLog`, essays, and placement.
 * When the exam is under 6 months away, vocabulary time share is capped at <= 25%.
 */
import { B1_ESSAY_IDS, totalScore } from "./essay-schema";
import { isOfficialB2Exam, outOf25 } from "./exam-schema";
import { CAUSE_LABEL, missStats } from "./listening";
import { dayKey, type Progress, type Settings } from "../store/store";

export type ExamSkill = "listen" | "read" | "essay" | "speak";
export type PrepKind = ExamSkill | "grammar" | "vocab";
export type PrepPhase = "urgent" | "sprint" | "steady";

export interface SkillStatus {
  part: ExamSkill;
  label: string;
  code: string;
  score25: number | null;
  count: number;
  source: "exam" | "placement" | "none";
}

export interface PrepTask {
  kind: PrepKind;
  title: string;
  minutes: number;
  sharePct: number;
  reason: string;
  cta: string;
}

export interface PrepSchedule {
  daysLeft: number | null;
  phase: PrepPhase;
  targetScore: number;
  targetPerPart: number;
  skills: Record<ExamSkill, SkillStatus>;
  weakest: ExamSkill;
  weakReason: string;
  totalMinutes: number;
  vocabCapPct: number;
  vocabCapMinutes: number;
  vocabRawMinutes: number;
  vocabSharePct: number;
  vocabOverCap: boolean;
  suggestedDailyNew: number;
  weakGramTagsCount: number;
  tasks: PrepTask[];
}

export const SKILL_META: Record<ExamSkill, { label: string; code: string; taskTitle: string; cta: string }> = {
  listen: { label: "听力", code: "CO", taskTitle: "听力理解与精听训练", cta: "去练听力" },
  read: { label: "阅读", code: "CE", taskTitle: "应试阅读与同义改写", cta: "去练阅读" },
  essay: { label: "写作", code: "PE", taskTitle: "篇章写作（250+词）", cta: "去写作文" },
  speak: { label: "口语", code: "PO", taskTitle: "口语独白与辩论演练", cta: "去练口语" },
};

const SKILL_ORDER: ExamSkill[] = ["listen", "read", "essay", "speak"];

/** Calendar days from `now` until `examDate` ("YYYY-MM-DD"); null when unset or invalid. */
export function daysUntilExam(examDate: string | null | undefined, now = new Date()): number | null {
  if (!examDate || !/^\d{4}-\d{2}-\d{2}$/.test(examDate)) return null;
  const [y, m, d] = examDate.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  if (target.getFullYear() !== y || target.getMonth() !== m - 1 || target.getDate() !== d) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

/** Add `months` calendar months to `now` and return YYYY-MM-DD. */
export function addMonthsDate(months: number, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() + months, now.getDate());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const avg = (nums: number[]) => (nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null);

/** Compute per-skill recent /25 averages from examLog, essays, and placement fallback. */
export function analyzePrepSkills(p: Pick<Progress, "examLog" | "essays" | "placement"> & { essayTasks?: Progress["essayTasks"] }): Record<ExamSkill, SkillStatus> {
  const log = p.examLog ?? [];
  const collectLog = (part: string) =>
    log
      .filter((r) => (r.part as string) === part && isOfficialB2Exam(r))
      .slice(0, 3)
      .map((r) => outOf25(r));

  const listenScores = collectLog("listen");
  const readScores = collectLog("read");
  const speakScores = collectLog("speak");
  const essayLogScores = collectLog("essay");
  const aiB1 = new Set((p.essayTasks ?? []).filter((t) => t.level === "B1").map((t) => t.id));
  const essayDraftScores = (p.essays ?? [])
    .filter((e) => e.fb && !B1_ESSAY_IDS.has(e.task) && !aiB1.has(e.task))
    .slice(0, 3)
    .map((e) => Math.round(totalScore(e.rev?.fb ?? e.fb!) * 10) / 10);
  const essayScores = essayLogScores.length ? essayLogScores : essayDraftScores;

  const placement = p.placement;
  const make = (part: ExamSkill, scores: number[]): SkillStatus => {
    const meta = SKILL_META[part];
    if (scores.length) {
      return { part, label: meta.label, code: meta.code, score25: avg(scores), count: scores.length, source: "exam" };
    }
    const pScore =
      part === "listen" && placement?.sections.listen != null
        ? Math.round((placement.sections.listen / 100) * 250) / 10
        : part === "read" && placement
          ? Math.round((placement.sections.read / 100) * 250) / 10
          : null;
    return {
      part,
      label: meta.label,
      code: meta.code,
      score25: pScore,
      count: 0,
      source: pScore !== null ? "placement" : "none",
    };
  };

  return {
    listen: make("listen", listenScores),
    read: make("read", readScores),
    essay: make("essay", essayScores),
    speak: make("speak", speakScores),
  };
}

export interface PrepInput {
  progress: Pick<Progress, "examLog" | "essays" | "placement" | "gram" | "gramTags" | "compMisses"> & { essayTasks?: Progress["essayTasks"] };
  settings: Pick<Settings, "examDate" | "targetScore" | "dailyNew" | "startLevel" | "dailyMinutes">;
  vocabMinutes: number;
  dueCount: number;
  freshCount: number;
  grammarDueCount?: number;
  grammarUntouchedErrors?: number;
  now?: Date;
}

export function buildPrepSchedule(input: PrepInput): PrepSchedule {
  const now = input.now ?? new Date();
  const daysLeft = daysUntilExam(input.settings.examDate, now);
  const underSixMonths = daysLeft !== null && daysLeft < 183;
  const phase: PrepPhase = daysLeft !== null && daysLeft <= 30 ? "urgent" : underSixMonths ? "sprint" : "steady";
  const targetScore = Math.max(50, Math.min(100, Math.round(input.settings.targetScore || 75)));
  const targetPerPart = Math.round((targetScore / 4) * 10) / 10;

  const skills = analyzePrepSkills(input.progress);
  const list = SKILL_ORDER.map((k) => skills[k]);
  const tested = list.filter((s) => s.source === "exam");
  const untested = list.filter((s) => s.source !== "exam");
  const dayIndex = Math.floor(now.getTime() / 86400000);

  let weakest: ExamSkill;
  let weakReason: string;

  const compMisses = input.progress.compMisses ?? [];
  const listenMisses = compMisses.filter((m) => m.part === "listen");
  const readMisses = compMisses.filter((m) => m.part === "read");
  const listenTopMiss = missStats(compMisses, "listen")[0];
  const readTopMiss = missStats(compMisses, "read")[0];
  const missSuffixFor = (part: ExamSkill) => {
    const top = part === "listen" ? listenTopMiss : part === "read" ? readTopMiss : undefined;
    return top ? ` · 近错多为「${CAUSE_LABEL[top.cause]}」（${top.n} 题）` : "";
  };

  if (tested.length) {
    const lowestTested = [...tested].sort((a, b) => (a.score25 ?? 25) - (b.score25 ?? 25))[0];
    if ((lowestTested.score25 ?? 25) < targetPerPart || !untested.length) {
      weakest = lowestTested.part;
      weakReason =
        lowestTested.score25! < 5
          ? `近期均分 ${lowestTested.score25}/25（低于 5 分淘汰线，急需补救）`
          : `近期均分 ${lowestTested.score25}/25（四科最低，目标 ${targetPerPart}/25）`;
    } else {
      // Tested skills already meet target, rotate in an untested skill so no exam part is neglected.
      weakest = untested[0].part;
      weakReason = "其余科目已达标，该项尚无模拟记录，今天优先补齐";
    }
  } else if (input.progress.placement) {
    const pWeak = input.progress.placement.weak.find((w): w is "listen" | "read" => w === "listen" || w === "read");
    if (pWeak) {
      weakest = pWeak;
      weakReason = `摸底定级显示${SKILL_META[pWeak].label}较弱（${input.progress.placement.sections[pWeak]}%）`;
    } else {
      weakest = input.progress.placement.weak.includes("grammar") ? "essay" : SKILL_ORDER[dayIndex % SKILL_ORDER.length];
      weakReason = "摸底显示语法/输出待加强，建议通过写作/口语输出巩固";
    }
  } else if (listenMisses.length >= 2 || readMisses.length >= 2) {
    weakest = listenMisses.length >= readMisses.length ? "listen" : "read";
    const top = weakest === "listen" ? listenTopMiss : readTopMiss;
    weakReason = `近期听读错题集中于${SKILL_META[weakest].label}${top ? `（「${CAUSE_LABEL[top.cause]}」${top.n} 次）` : ""}，优先专项纠错`;
  } else {
    weakest = SKILL_ORDER[dayIndex % SKILL_ORDER.length];
    weakReason = "尚未完成模考或定级，建议先按四科轮换练起并建立基线";
  }

  // Pick a second exam skill distinct from `weakest` (preferring lowest score or untested).
  const others = list.filter((s) => s.part !== weakest);
  others.sort((a, b) => {
    const sa = a.score25 ?? (a.source === "none" ? targetPerPart - 2 : 25);
    const sb = b.score25 ?? (b.source === "none" ? targetPerPart - 2 : 25);
    return sa - sb;
  });
  const secondary = others[0];

  // Time budget: user override (20..180 min) or automatic (urgent <=30d = 75 min/day, sprint <6 mo = 60 min/day, steady = 45 min/day).
  const isUrgent = phase === "urgent";
  const customMin = typeof input.settings.dailyMinutes === "number" && input.settings.dailyMinutes >= 20 && input.settings.dailyMinutes <= 180 ? Math.round(input.settings.dailyMinutes) : null;
  const totalMinutes = customMin ?? (isUrgent ? 75 : underSixMonths ? 60 : 45);
  const vocabCapPct = isUrgent ? 15 : underSixMonths ? 25 : 33;
  const vocabCapMinutes = Math.floor((totalMinutes * vocabCapPct) / 100);
  const nonVocabMinutes = totalMinutes - vocabCapMinutes;

  const rawVocab = input.dueCount + input.freshCount > 0 ? Math.max(0, input.vocabMinutes) : 0;
  const effectiveTotal = rawVocab + nonVocabMinutes;
  const vocabSharePct = effectiveTotal > 0 ? Math.round((rawVocab / effectiveTotal) * 100) : 0;
  const vocabOverCap = underSixMonths && vocabSharePct > vocabCapPct;

  // Max new words per day that fits inside `vocabCapMinutes` alongside today's due reviews.
  const dueCost = input.dueCount * 0.25;
  const suggestedDailyNew = Math.max(0, Math.min(isUrgent ? 5 : 15, Math.floor(Math.max(0, vocabCapMinutes - dueCost) / 0.9)));

  const plannedVocabMinutes = Math.min(rawVocab, vocabCapMinutes);
  const remaining = totalMinutes - plannedVocabMinutes;

  const weakGramTags = Object.entries(input.progress.gramTags ?? {}).filter(([, t]) => t.n >= 2 && t.w / t.n >= 0.35);
  const weakGramTagsCount = weakGramTags.length;
  const weakGramPointsCount = new Set(weakGramTags.map(([k]) => k.split("|")[0])).size;
  const gDue = input.grammarDueCount ?? 0;
  const gErr = input.grammarUntouchedErrors ?? 0;
  const grammarBoost = weakGramTagsCount >= 3 || gErr > 0 ? 0.05 : 0;

  const primaryMin = isUrgent ? Math.round(remaining * (0.6 - grammarBoost / 2)) : underSixMonths ? Math.round(remaining * (0.56 - grammarBoost / 2)) : Math.round(remaining * (0.45 - grammarBoost / 2));
  const secondaryMin = isUrgent ? Math.round(remaining * (0.28 - grammarBoost / 2)) : underSixMonths ? Math.round(remaining * (0.27 - grammarBoost / 2)) : Math.round(remaining * (0.3 - grammarBoost / 2));
  const grammarMin = Math.max(5, remaining - primaryMin - secondaryMin);

  const weakTagSuffix = weakGramTagsCount > 0 ? ` · ${weakGramTagsCount} 项语法细则失分偏高（${weakGramPointsCount} 个语法点）` : "";
  const grammarReason =
    gErr > 0
      ? `有 ${gErr} 个作文错句关联语法点未练${weakTagSuffix}`
      : gDue > 0
        ? `${gDue} 个语法点到期需复习${weakTagSuffix}`
        : weakGramTagsCount > 0
          ? `检测到 ${weakGramTagsCount} 个高频失分语法细项，建议专项巩固`
          : input.progress.placement?.weak.includes("grammar")
            ? "摸底显示语法薄弱，重点巩固复合时态与虚拟式"
            : "强化 B1/B2 语法点、动词变位与论证表达";

  const vocabReason = isUrgent
    ? `考前 ${daysLeft} 天冲刺：背词严控 ≤${vocabCapPct}%（上限 ${vocabCapMinutes} 分钟，新词建议 ≤5 个）；全力投入真题限时输出与复盘`
    : underSixMonths
      ? `距考不足 6 个月，背词严控 ≤${vocabCapPct}%（上限 ${vocabCapMinutes} 分钟）；建议聚焦 B1/B2 高频词`
      : input.dueCount + input.freshCount > 0
        ? `今日复习 ${input.dueCount} · 新词 ${input.freshCount}（控制节奏，留足时间练听说读写）`
        : "今日词汇已完成，可专注真题输入输出";

  const pctOf = (m: number) => Math.round((m / totalMinutes) * 100);

  const tasks: PrepTask[] = [
    {
      kind: weakest,
      title: `主攻${SKILL_META[weakest].label}（${SKILL_META[weakest].code}）：${SKILL_META[weakest].taskTitle}`,
      minutes: primaryMin,
      sharePct: pctOf(primaryMin),
      reason: `${weakReason}${tested.length || input.progress.placement ? missSuffixFor(weakest) : ""}`,
      cta: SKILL_META[weakest].cta,
    },
    {
      kind: secondary.part,
      title: `搭配${SKILL_META[secondary.part].label}（${SKILL_META[secondary.part].code}）：${SKILL_META[secondary.part].taskTitle}`,
      minutes: secondaryMin,
      sharePct: pctOf(secondaryMin),
      reason: `${secondary.score25 !== null ? `当前参考 ${secondary.score25}/25，保持四科均衡` : "尚无测试记录，轮换保持题感"}${missSuffixFor(secondary.part)}`,
      cta: SKILL_META[secondary.part].cta,
    },
    {
      kind: "grammar",
      title: "语法与表达巩固",
      minutes: grammarMin,
      sharePct: pctOf(grammarMin),
      reason: grammarReason,
      cta: "去练语法",
    },
    {
      kind: "vocab",
      title: underSixMonths ? `词汇复习（限 ≤${vocabCapPct}%）` : "词汇 FSRS 复习",
      minutes: plannedVocabMinutes,
      sharePct: pctOf(plannedVocabMinutes),
      reason: vocabReason,
      cta: input.dueCount + input.freshCount > 0 ? "去背词" : "词汇自选",
    },
  ];

  return {
    daysLeft,
    phase,
    targetScore,
    targetPerPart,
    skills,
    weakest,
    weakReason,
    totalMinutes,
    vocabCapPct,
    vocabCapMinutes,
    vocabRawMinutes: rawVocab,
    vocabSharePct,
    vocabOverCap,
    suggestedDailyNew,
    weakGramTagsCount,
    tasks,
  };
}

/** Reconcile today's actual activity across all modules against each generated PrepTask kind. */
export function reconcileDailyTasks(
  tasks: readonly PrepTask[],
  p: Pick<Progress, "days" | "gramDays" | "conjDays" | "expr" | "drillDays" | "examLog" | "listenSources" | "texts" | "essays" | "speakingSessions">,
  now = new Date(),
): Record<PrepKind, { done: boolean; detail: string }> {
  const dk = dayKey(now);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const vocabR = p.days[dk]?.r ?? 0;
  const vocabN = p.days[dk]?.n ?? 0;
  const gramR = (p.gramDays?.[dk]?.r ?? 0) + (p.conjDays?.[dk]?.r ?? 0);
  const exprDone = Object.values(p.expr ?? {}).some((c) => (c.last ?? 0) >= dayStart);
  const drillToday = p.drillDays?.[dk] ?? 0;
  const listenDone =
    (p.examLog ?? []).some((e) => e.part === "listen" && e.at >= dayStart) ||
    (p.listenSources ?? []).some((s) => (s.done ?? 0) >= dayStart);
  const readDone =
    (p.examLog ?? []).some((e) => e.part === "read" && e.at >= dayStart) ||
    (p.texts ?? []).some((t) => (t.read ?? 0) >= dayStart);
  const essayDone =
    (p.examLog ?? []).some((e) => e.part === "essay" && e.at >= dayStart) ||
    (p.essays ?? []).some((e) => e.created >= dayStart || (e.rev?.at ?? 0) >= dayStart) ||
    drillToday > 0;
  const speakDone =
    (p.examLog ?? []).some((e) => e.part === "speak" && e.at >= dayStart) ||
    (p.speakingSessions ?? []).some((s) => s.at >= dayStart) ||
    drillToday > 0;

  const out: Record<PrepKind, { done: boolean; detail: string }> = {
    listen: { done: listenDone, detail: listenDone ? "今日已完成听力或精听训练" : "今日待练" },
    read: { done: readDone, detail: readDone ? "今日已完成阅读或精读记录" : "今日待练" },
    essay: { done: essayDone, detail: essayDone ? "今日已写入/精修作文或微练习" : "今日待练" },
    speak: { done: speakDone, detail: speakDone ? "今日已完成口语练说或评分" : "今日待练" },
    grammar: { done: gramR > 0 || exprDone, detail: gramR > 0 || exprDone ? `今日已练语法/表达` : "今日待练" },
    vocab: {
      done: vocabR > 0 || vocabN > 0,
      detail: vocabR > 0 || vocabN > 0 ? `今日已复习 ${vocabR} · 新词 ${vocabN}` : "今日待开始",
    },
  };
  for (const t of tasks) {
    if (!out[t.kind]) out[t.kind] = { done: false, detail: "今日待练" };
  }
  return out;
}
