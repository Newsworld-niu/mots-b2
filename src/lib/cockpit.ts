/**
 * Lightweight DELF B2 analytics & cockpit computations for Today dashboard.
 * NEVER import heavy datasets (`exam.ts`, `essay.ts`, `exam-presets.ts`, `real-presets.ts`) here
 * so the main `/` entry bundle remains compact (< 350 KB).
 */
import { unifiedWeek } from "./activity";
import {
  B2_TOPICS_META,
  EXAM_PARTS,
  isOfficialB2Exam,
  PART_LABEL,
  realScore25,
  type B2TopicId,
  type ExamPart,
  type ExamResult,
} from "./exam-schema";
import type { Progress } from "../store/store";

const TOPIC_ID_SET = new Set<string>(B2_TOPICS_META.map((t) => t.id));

const EXAM_WHAT_TOPIC_HINTS: Record<string, B2TopicId> = {
  "courrier-voitures": "transports-mobilite",
  "essai-ecrans": "numerique",
  "essai-etranger": "culture",
  "lettre-reclamation": "consommation",
  "lettre-motivation": "travail",
  "doc-livraison": "consommation",
  "doc-musees": "culture",
  "doc-sommeil": "sante",
  "doc-mediatheque": "culture",
  "courrier-emballages": "environnement",
  "essai-intergeneration": "societe",
  "lettre-budget-participatif": "politique-justice",
  "article-ia-recherche": "sciences-ethique",
  "essai-infox-ecole": "medias-presse",
  "lettre-loyers": "logement-urbanisme",
  "courrier-pouvoir-achat": "economie-finances",
  "article-arts-vivants": "arts-francophonie",
  "preset-listen-1": "travail",
  "mock-preset-listen-1": "travail",
  "preset-listen-2": "environnement",
  "mock-preset-listen-2": "environnement",
  "preset-listen-3": "numerique",
  "mock-preset-listen-3": "numerique",
  "preset-listen-4": "education",
  "mock-preset-listen-4": "education",
  "preset-listen-5": "sante",
  "mock-preset-listen-5": "sante",
  "preset-read-1": "societe",
  "mock-preset-read-1": "societe",
  "preset-read-2": "environnement",
  "mock-preset-read-2": "environnement",
  "preset-read-3": "sciences-ethique",
  "mock-preset-read-3": "sciences-ethique",
};

export interface SkillTrendPoint {
  at: number;
  score25: number;
}

export interface SkillTrend {
  part: ExamPart;
  label: string;
  points: SkillTrendPoint[];
  latest: number | null;
  delta: number | null;
}

/** Compute chronological /25 DELF B2 official trend series per exam part. */
export function fourSkillTrends(log: ExamResult[] | undefined, maxPoints = 10): Record<ExamPart, SkillTrend> {
  const rows = [...(log ?? [])].filter((r) => isOfficialB2Exam(r)).sort((a, b) => a.at - b.at);
  const out = {} as Record<ExamPart, SkillTrend>;
  for (const part of EXAM_PARTS) {
    const mine = rows
      .filter((r) => r.part === part)
      .slice(-maxPoints)
      .map((r) => ({ at: r.at, score25: realScore25(r)! }));
    const latest = mine.length ? mine[mine.length - 1].score25 : null;
    const delta = mine.length >= 2 ? Math.round((mine[mine.length - 1].score25 - mine[0].score25) * 10) / 10 : null;
    out[part] = { part, label: PART_LABEL[part], points: mine, latest, delta };
  }
  return out;
}

export type TopicStatus = "covered" | "touched" | "blind";

export interface TopicCoverageItem {
  id: B2TopicId;
  zh: string;
  fr: string;
  count: number;
  status: TopicStatus;
}

function resolveTopicHint(key: string | undefined, taskTopicMap: Map<string, string>): B2TopicId | null {
  if (!key) return null;
  const k = key.trim().toLowerCase();
  if (TOPIC_ID_SET.has(k)) return k as B2TopicId;
  const customTopic = taskTopicMap.get(k);
  if (customTopic && TOPIC_ID_SET.has(customTopic)) return customTopic as B2TopicId;
  if (k in EXAM_WHAT_TOPIC_HINTS) return EXAM_WHAT_TOPIC_HINTS[k];
  for (const meta of B2_TOPICS_META) {
    if (k.includes(meta.id)) return meta.id;
  }
  return null;
}

/** Measure training coverage across all 15 official DELF B2 exam themes. */
export function topicCoverageMatrix(
  p: Pick<Progress, "speakingSessions" | "examLog" | "essays" | "essayTasks">,
): {
  items: TopicCoverageItem[];
  coveredCount: number;
  touchedCount: number;
  blindCount: number;
} {
  const counts = new Map<B2TopicId, number>();
  for (const meta of B2_TOPICS_META) counts.set(meta.id, 0);
  const taskTopicMap = new Map<string, string>();
  for (const t of p.essayTasks ?? []) if (t.topic) taskTopicMap.set(t.id.toLowerCase(), t.topic);

  const bump = (tid: B2TopicId | null) => {
    if (tid) counts.set(tid, (counts.get(tid) ?? 0) + 1);
  };
  for (const s of p.speakingSessions ?? []) bump(resolveTopicHint(s.topic, taskTopicMap) ?? resolveTopicHint(s.subjectId, taskTopicMap));
  for (const e of p.essays ?? []) bump(resolveTopicHint(e.task, taskTopicMap));
  for (const r of p.examLog ?? []) bump(resolveTopicHint(r.what, taskTopicMap));

  const items: TopicCoverageItem[] = B2_TOPICS_META.map((meta) => {
    const count = counts.get(meta.id) ?? 0;
    const status: TopicStatus = count >= 2 ? "covered" : count === 1 ? "touched" : "blind";
    return { id: meta.id, zh: meta.zh, fr: meta.fr, count, status };
  });
  return {
    items,
    coveredCount: items.filter((x) => x.status === "covered").length,
    touchedCount: items.filter((x) => x.status === "touched").length,
    blindCount: items.filter((x) => x.status === "blind").length,
  };
}

export interface WeeklyReport {
  activeDays: number;
  weekActions: number;
  examRuns: number;
  speakingRuns: number;
  essayRuns: number;
  topImproveLabel: string | null;
}

/** Summarize last 7 days of multi-module study and DELF progress. */
export function weeklyReportSummary(
  p: Pick<
    Progress,
    "days" | "gramDays" | "conjDays" | "drillDays" | "examLog" | "essays" | "listenSources" | "texts" | "speakingSessions"
  >,
  now = new Date(),
): WeeklyReport {
  const week = unifiedWeek(p, now);
  const activeDays = week.filter((d) => d.v > 0).length;
  const weekActions = week.reduce((n, d) => n + d.v, 0);
  const cutoff = now.getTime() - 7 * 86_400_000;
  const examRuns = (p.examLog ?? []).filter((e) => e.at >= cutoff).length;
  const speakingRuns = (p.speakingSessions ?? []).filter((s) => s.at >= cutoff).length;
  const essayRuns = (p.essays ?? []).filter((e) => e.created >= cutoff || (e.rev?.at ?? 0) >= cutoff).length;

  const trends = fourSkillTrends(p.examLog);
  const gains = EXAM_PARTS.map((part) => trends[part])
    .filter((t) => t.delta !== null && t.delta > 0)
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));

  return {
    activeDays,
    weekActions,
    examRuns,
    speakingRuns,
    essayRuns,
    topImproveLabel: gains[0] ? `${gains[0].label} (+${gains[0].delta})` : null,
  };
}