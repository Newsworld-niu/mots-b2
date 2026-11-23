import type { ExamPart, ExamResult } from "./exam-schema";

export type ExamTrack = "delf" | "tcf" | "tef";
export const EXAM_TRACKS: readonly ExamTrack[] = ["delf", "tcf", "tef"] as const;

export type TrackSection = "co" | "ce" | "struct" | "ee" | "eo";
export type CefrBand = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface TrackMeta {
  id: ExamTrack;
  name: string;
  shortName: string;
  badge: string;
  organizer: string;
  scaleSummary: string;
  b2TargetLabel: string;
  listeningPlays: 1 | 2;
  qcmOptions: 3 | 4;
  hasStructureSection: boolean;
}

export const TRACK_META: Record<ExamTrack, TrackMeta> = {
  delf: {
    id: "delf",
    name: "DELF B2（Tout Public）",
    shortName: "DELF B2",
    badge: "FEI · 四科 /100",
    organizer: "France Éducation international",
    scaleSummary: "听 · 读 · 写 · 说各 25 分（总分 ≥ 50/100 及格，单科 < 5/25 淘汰；2022 版 0.5 分档量表）",
    b2TargetLabel: "总分 75+/100（单科 ≥ 5/25）",
    listeningPlays: 2,
    qcmOptions: 3,
    hasStructureSection: false,
  },
  tcf: {
    id: "tcf",
    name: "TCF（Tout Public / TCF Canada）",
    shortName: "TCF 全科",
    badge: "FEI · 100–699 & /20",
    organizer: "France Éducation international",
    scaleSummary: "听力 CO · 语言结构 · 阅读 CE 计 100–699 分（B2: 400–499）；写作 EE · 口语 EO 计 0–20 分（B2: 10–13/20）",
    b2TargetLabel: "B2 (400+ / 10+) · NCLC 7+ (CO≥458, CE≥453, EO/EE≥10)",
    listeningPlays: 1,
    qcmOptions: 4,
    hasStructureSection: true,
  },
  tef: {
    id: "tef",
    name: "TEF / TEF Canada（2023.12 新政）",
    shortName: "TEF 新政",
    badge: "CCI Paris · 0–699 & NCLC",
    organizer: "CCI Paris Île-de-France",
    scaleSummary: "听 40 题 · 读 40 题 · 词汇语法 40 题 · 口语双任务（vous/tu）· 写作双任务，统一 0–699 分与 NCLC 1–12",
    b2TargetLabel: "B2 (400+/699) · NCLC 7+ (听读≥434, 说写≥456)",
    listeningPlays: 1,
    qcmOptions: 4,
    hasStructureSection: true,
  },
};

export function isExamTrack(v: unknown): v is ExamTrack {
  return v === "delf" || v === "tcf" || v === "tef";
}

/** Map a 100–699 (TCF) or 0–699 (TEF) scaled score to its CEFR band. */
export function cefrFromScore699(score: number, track: "tcf" | "tef" = "tcf"): CefrBand {
  if (track === "tef") {
    if (score >= 600) return "C2";
    if (score >= 500) return "C1";
    if (score >= 400) return "B2";
    if (score >= 300) return "B1";
    if (score >= 200) return "A2";
    return "A1";
  }
  if (score >= 600) return "C2";
  if (score >= 500) return "C1";
  if (score >= 400) return "B2";
  if (score >= 300) return "B1";
  if (score >= 200) return "A2";
  return "A1";
}

/** Official IRCC TCF Canada NCLC (1–12, or 0 for < NCLC 4) lookup for receptive (100–699) and productive (0–20) sections. */
export function tcfNclcFor(section: TrackSection, score: number): number {
  if (section === "eo" || section === "ee") {
    const s = Math.round(score * 2) / 2;
    if (s >= 16) return 10;
    if (s >= 14) return 9;
    if (s >= 12) return 8;
    if (s >= 10) return 7;
    if (s >= 7) return 6;
    if (s >= 6) return 5;
    if (s >= 4) return 4;
    return Math.max(1, Math.floor(s));
  }
  if (section === "co") {
    if (score >= 549) return 10;
    if (score >= 523) return 9;
    if (score >= 503) return 8;
    if (score >= 458) return 7;
    if (score >= 398) return 6;
    if (score >= 369) return 5;
    if (score >= 331) return 4;
    return score >= 250 ? 3 : score >= 180 ? 2 : 1;
  }
  // CE & Structure de la langue
  if (score >= 549) return 10;
  if (score >= 524) return 9;
  if (score >= 499) return 8;
  if (score >= 453) return 7;
  if (score >= 406) return 6;
  if (score >= 375) return 5;
  if (score >= 342) return 4;
  return score >= 250 ? 3 : score >= 180 ? 2 : 1;
}

/** Official post-Dec-2023 CCI Paris / IRCC TEF Canada 0–699 -> NCLC (1–10+) lookup. */
export function tefNclcFor(section: TrackSection, score699: number): number {
  const s = Math.max(0, Math.min(699, Math.round(score699)));
  if (section === "eo" || section === "ee") {
    if (s >= 571) return 10;
    if (s >= 532) return 9;
    if (s >= 494) return 8;
    if (s >= 456) return 7;
    if (s >= 393) return 6;
    if (s >= 330) return 5;
    if (s >= 268) return 4;
    return s >= 180 ? 3 : s >= 100 ? 2 : 1;
  }
  // CO, CE, Lexique & structure (post-Dec 2023 unified 0–699 equivalence)
  if (s >= 546) return 10;
  if (s >= 503) return 9;
  if (s >= 469) return 8;
  if (s >= 434) return 7;
  if (s >= 393) return 6;
  if (s >= 352) return 5;
  if (s >= 306) return 4;
  return s >= 210 ? 3 : s >= 120 ? 2 : 1;
}

const TCF_DIFF_WEIGHT = [0, 1.0, 1.35, 1.75, 2.2, 2.7, 3.2];

/**
 * Score a TCF receptive test (`CO`, `Structure de la langue`, `CE`) onto the official FEI `100–699` scale
 * using progressive CEFR item weights (`difficulty` 1=A1 .. 6=C2).
 */
export function scoreTcfReceptive(
  items: readonly { correct: boolean; difficulty?: number }[],
  section: "co" | "ce" | "struct" = "ce",
): {
  score699: number;
  cefr: CefrBand;
  nclc: number;
  correctCount: number;
  totalCount: number;
  weightedEarned: number;
  weightedMax: number;
} {
  if (!items.length) {
    return { score699: 100, cefr: "A1", nclc: 1, correctCount: 0, totalCount: 0, weightedEarned: 0, weightedMax: 0 };
  }
  let weightedEarned = 0;
  let weightedMax = 0;
  let correctCount = 0;
  for (const it of items) {
    const d = Math.max(1, Math.min(6, Math.round(it.difficulty ?? 3)));
    const w = TCF_DIFF_WEIGHT[d] ?? 1.75;
    weightedMax += w;
    if (it.correct) {
      weightedEarned += w;
      correctCount++;
    }
  }
  const ratio = weightedMax > 0 ? weightedEarned / weightedMax : 0;
  const score699 = Math.max(100, Math.min(699, Math.round(100 + ratio * 599)));
  return {
    score699,
    cefr: cefrFromScore699(score699, "tcf"),
    nclc: tcfNclcFor(section, score699),
    correctCount,
    totalCount: items.length,
    weightedEarned: Math.round(weightedEarned * 100) / 100,
    weightedMax: Math.round(weightedMax * 100) / 100,
  };
}

/** Map a TCF productive (`EO` / `EE`) score on `0–20` to CEFR & NCLC. */
export function scoreTcfProductive20(
  rawScore20: number,
  section: "eo" | "ee" = "eo",
): { score20: number; cefr: CefrBand; nclc: number; b2Passed: boolean } {
  const score20 = Math.max(0, Math.min(20, Math.round(rawScore20 * 2) / 2));
  const cefr: CefrBand =
    score20 >= 16 ? "C2" : score20 >= 14 ? "C1" : score20 >= 10 ? "B2" : score20 >= 7 ? "B1" : score20 >= 4 ? "A2" : "A1";
  return {
    score20,
    cefr,
    nclc: tcfNclcFor(section, score20),
    b2Passed: score20 >= 10,
  };
}

/**
 * Score a TEF section (`CO`, `CE`, `Lexique & structure`, `EO`, `EE`) onto CCI Paris `0–699` + CEFR + NCLC.
 * Accepts either weighted items (`items`) or `(earned, max)`.
 */
export function scoreTefSection699(
  section: TrackSection,
  earned: number,
  max: number,
): { score699: number; cefr: CefrBand; nclc: number; b2Passed: boolean; nclc7Passed: boolean } {
  const ratio = max > 0 ? Math.max(0, Math.min(1, earned / max)) : 0;
  const score699 = Math.round(ratio * 699);
  const cefr = cefrFromScore699(score699, "tef");
  const nclc = tefNclcFor(section, score699);
  return {
    score699,
    cefr,
    nclc,
    b2Passed: score699 >= 400,
    nclc7Passed: nclc >= 7,
  };
}

const TEF_ANCHORS: readonly [number, number][] = [
  [0, 0],
  [0.25, 200],
  [0.45, 330],
  [0.575, 400],
  [0.625, 434],
  [0.7, 469],
  [0.8, 503],
  [0.875, 546],
  [0.95, 610],
  [1, 699],
];

function interpolateTef699(ratio: number): number {
  const r = Math.max(0, Math.min(1, ratio));
  for (let i = 1; i < TEF_ANCHORS.length; i++) {
    const [r0, s0] = TEF_ANCHORS[i - 1];
    const [r1, s1] = TEF_ANCHORS[i];
    if (r <= r1) {
      const t = r1 > r0 ? (r - r0) / (r1 - r0) : 0;
      return Math.round(s0 + t * (s1 - s0));
    }
  }
  return 699;
}

export function scoreTefItems699(
  items: readonly { correct: boolean; difficulty?: number }[],
  section: "co" | "ce" | "struct" = "ce",
): {
  score699: number;
  cefr: CefrBand;
  nclc: number;
  correctCount: number;
  totalCount: number;
  b2Passed: boolean;
  nclc7Passed: boolean;
} {
  if (!items.length) {
    return { score699: 0, cefr: "A1", nclc: 1, correctCount: 0, totalCount: 0, b2Passed: false, nclc7Passed: false };
  }
  let earned = 0;
  let max = 0;
  let correctCount = 0;
  for (const it of items) {
    const d = Math.max(1, Math.min(6, Math.round(it.difficulty ?? 3)));
    const w = 0.9 + d * 0.08;
    max += w;
    if (it.correct) {
      earned += w;
      correctCount++;
    }
  }
  const score699 = interpolateTef699(max > 0 ? earned / max : 0);
  const cefr = cefrFromScore699(score699, "tef");
  const nclc = tefNclcFor(section, score699);
  return {
    score699,
    cefr,
    nclc,
    correctCount,
    totalCount: items.length,
    b2Passed: score699 >= 400,
    nclc7Passed: nclc >= 7,
  };
}

export interface TrackSectionStatus {
  section: TrackSection;
  label: string;
  scaleMax: number;
  displayScore: string | null;
  rawNumeric: number | null;
  cefr: CefrBand | null;
  nclc: number | null;
  b2Met: boolean;
  nclc7Met: boolean;
  at: number | null;
}

export interface MultiTrackReadiness {
  track: "tcf" | "tef";
  sections: TrackSectionStatus[];
  completedCount: number;
  totalSections: number;
  allB2Met: boolean | null;
  allNclc7Met: boolean | null;
  minNclc: number | null;
}

const SECTION_LABELS: Record<"tcf" | "tef", { section: TrackSection; label: string }[]> = {
  tcf: [
    { section: "co", label: "听力理解 CO" },
    { section: "struct", label: "语言结构 Structure" },
    { section: "ce", label: "阅读理解 CE" },
    { section: "ee", label: "书面表达 EE" },
    { section: "eo", label: "口语表达 EO" },
  ],
  tef: [
    { section: "co", label: "听力理解 CO（40题）" },
    { section: "ce", label: "阅读理解 CE（40题）" },
    { section: "struct", label: "词汇与结构（40题）" },
    { section: "ee", label: "书面表达 EE（Sec A+B）" },
    { section: "eo", label: "口语表达 EO（vous+tu）" },
  ],
};

function inferSectionFromResult(r: ExamResult): TrackSection {
  if (r.trackSection) return r.trackSection;
  if (r.what.startsWith("struct-") || r.what.includes(":struct")) return "struct";
  if (r.part === "listen") return "co";
  if (r.part === "read") return "ce";
  if (r.part === "essay") return "ee";
  return "eo";
}

export function partForTrackSection(sec: TrackSection): ExamPart {
  if (sec === "co") return "listen";
  if (sec === "ce" || sec === "struct") return "read";
  if (sec === "ee") return "essay";
  return "speak";
}

/** Summarise verified TCF or TEF readiness across all 5 official sections (`CO`, `CE`, `Structure`, `EE`, `EO`). */
export function trackReadiness(log: ExamResult[] | undefined, track: "tcf" | "tef"): MultiTrackReadiness {
  const rows = [...(log ?? [])]
    .filter((r) => r.track === track && !r.unverified && !(r.part === "speak" && r.typed))
    .sort((a, b) => b.at - a.at);

  const defs = SECTION_LABELS[track];
  const sections: TrackSectionStatus[] = defs.map(({ section, label }) => {
    const latest = rows.find((r) => inferSectionFromResult(r) === section);
    if (!latest) {
      return {
        section,
        label,
        scaleMax: track === "tcf" && (section === "ee" || section === "eo") ? 20 : 699,
        displayScore: null,
        rawNumeric: null,
        cefr: null,
        nclc: null,
        b2Met: false,
        nclc7Met: false,
        at: null,
      };
    }
    if (track === "tcf") {
      if (section === "ee" || section === "eo") {
        const s20 = latest.total === 20 ? latest.score : (latest.score / latest.total) * 20;
        const p = scoreTcfProductive20(s20, section);
        return {
          section,
          label,
          scaleMax: 20,
          displayScore: `${p.score20}/20`,
          rawNumeric: p.score20,
          cefr: p.cefr,
          nclc: p.nclc,
          b2Met: p.b2Passed,
          nclc7Met: p.nclc >= 7,
          at: latest.at,
        };
      }
      const s699 =
        typeof latest.scaledScore === "number"
          ? Math.max(100, Math.min(699, Math.round(latest.scaledScore)))
          : Math.max(100, Math.min(699, Math.round(100 + (latest.score / latest.total) * 599)));
      const cefr = cefrFromScore699(s699, "tcf");
      const nclc = typeof latest.nclc === "number" ? latest.nclc : tcfNclcFor(section, s699);
      return {
        section,
        label,
        scaleMax: 699,
        displayScore: `${s699}/699`,
        rawNumeric: s699,
        cefr,
        nclc,
        b2Met: s699 >= 400,
        nclc7Met: nclc >= 7,
        at: latest.at,
      };
    }
    // TEF (0–699 across all sections)
    const s699 =
      typeof latest.scaledScore === "number"
        ? Math.max(0, Math.min(699, Math.round(latest.scaledScore)))
        : Math.round((latest.score / latest.total) * 699);
    const cefr = cefrFromScore699(s699, "tef");
    const nclc = typeof latest.nclc === "number" ? latest.nclc : tefNclcFor(section, s699);
    return {
      section,
      label,
      scaleMax: 699,
      displayScore: `${s699}/699`,
      rawNumeric: s699,
      cefr,
      nclc,
      b2Met: s699 >= 400,
      nclc7Met: nclc >= 7,
      at: latest.at,
    };
  });

  const done = sections.filter((s) => s.rawNumeric !== null);
  const coreFour = sections.filter((s) => s.section !== "struct");
  const coreDone = coreFour.every((s) => s.rawNumeric !== null);
  return {
    track,
    sections,
    completedCount: done.length,
    totalSections: defs.length,
    allB2Met: coreDone ? coreFour.every((s) => s.b2Met) : null,
    allNclc7Met: coreDone ? coreFour.every((s) => s.nclc7Met) : null,
    minNclc: done.length ? Math.min(...done.map((s) => s.nclc ?? 1)) : null,
  };
}
