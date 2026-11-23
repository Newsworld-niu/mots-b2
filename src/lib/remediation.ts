import {
  examReadiness,
  PART_LABEL,
  type ExamPart,
  type ExamReadiness,
  type ExamResult,
  type MockRecord,
  type WeeklyRemediationPlan,
  type WeeklyRemediationTask,
} from "./exam-schema";
import { CAUSE_LABEL, CAUSE_TIP, missStats, type CompMiss, type MissCause } from "./listening";
import type { SavedNote } from "./essay-schema";

export interface BuildRemediationInput {
  log?: ExamResult[];
  compMisses?: CompMiss[];
  essayNotes?: SavedNote[];
  gramTags?: Record<string, { n: number; w: number }>;
  target?: number;
  now?: number;
}

const PART_ACTIONS: Record<ExamPart, { main: string; secondary: string; routeMain: string; routeSec: string; minutes: number }> = {
  listen: {
    main: "RFI 真题精听与切片听辨（含高频数字与因果抓取）",
    secondary: "CO 听力真题整套限次模拟",
    routeMain: "#/real",
    routeSec: "#/listen",
    minutes: 35,
  },
  read: {
    main: "CE 论证阅读 + 题干同义替换精读定位",
    secondary: "阅读文本引证（Vrai/Faux + Citation）专项",
    routeMain: "#/examread",
    routeSec: "#/examread",
    minutes: 35,
  },
  essay: {
    main: "PE 250 词 B2 立场写作（含论证链与改写二稿）",
    secondary: "句型微技能训练（立场表达 / 连接词 / 让步）",
    routeMain: "#/essay",
    routeSec: "#/drill",
    minutes: 40,
  },
  speak: {
    main: "PO 5–7 分钟独白 + 考官对抗辩论录音训练",
    secondary: "同题二稿重说（优化流利度与 /y/ /u/ 鼻化音韵律）",
    routeMain: "#/speak",
    routeSec: "#/speak",
    minutes: 30,
  },
};

/** Generate a prioritized 7-day remedial plan synced from DELF B2 scores, misses, and grammar gaps. */
export function buildWeeklyRemediation({
  log,
  compMisses = [],
  essayNotes = [],
  gramTags = {},
  target = 75,
  now = Date.now(),
}: BuildRemediationInput): WeeklyRemediationPlan {
  const readiness = examReadiness(log, target);
  const scoredSorted = [...readiness.parts]
    .filter((p) => p.score25 !== null)
    .sort((a, b) => (a.score25 ?? 25) - (b.score25 ?? 25));
  const missingParts = readiness.parts.filter((p) => p.score25 === null);
  const priorityOrder: ExamPart[] = [
    ...scoredSorted.filter((p) => p.eliminatory).map((p) => p.part),
    ...scoredSorted.filter((p) => !p.eliminatory).map((p) => p.part),
    ...missingParts.map((p) => p.part),
  ];
  const focusPart: ExamPart = priorityOrder[0] ?? "listen";
  const secondPart: ExamPart = priorityOrder[1] ?? (focusPart === "read" ? "essay" : "read");
  const thirdPart: ExamPart = priorityOrder[2] ?? "speak";

  const topCause = missStats(compMisses)[0]?.cause;
  const weakGramCount = Object.values(gramTags).filter((t) => t.w > 0).length;
  const focusSpec = PART_ACTIONS[focusPart];
  const secSpec = PART_ACTIONS[secondPart];
  const thirdSpec = PART_ACTIONS[thirdPart];

  const tasks: WeeklyRemediationTask[] = [
    {
      id: "d1",
      day: 1,
      part: focusPart,
      title: `主攻短板 · ${PART_LABEL[focusPart]}：${focusSpec.main}`,
      route: focusSpec.routeMain,
      minutes: focusSpec.minutes,
    },
    {
      id: "d2",
      day: 2,
      part: focusPart,
      title: topCause
        ? `错题回炉：清空「${CAUSE_LABEL[topCause]}」陷阱 + FSRS 复习`
        : "错题回炉：统一错题中心 FSRS 错句与听读陷阱清空",
      route: "#/reflow",
      minutes: 25,
    },
    {
      id: "d3",
      day: 3,
      part: secondPart,
      title: `巩固第二薄弱项 · ${PART_LABEL[secondPart]}：${secSpec.main}`,
      route: secSpec.routeMain,
      minutes: secSpec.minutes,
    },
    {
      id: "d4",
      day: 4,
      part: "essay",
      title:
        weakGramCount > 0
          ? `薄弱语法靶向纠错（待修 ${weakGramCount} 项）+ ${essayNotes.length} 句错句改写迁移`
          : "B2 核心连接词与虚拟式/条件式高频语法加固",
      route: weakGramCount > 0 ? "#/grammar" : "#/reflow",
      minutes: 30,
    },
    {
      id: "d5",
      day: 5,
      part: focusPart,
      title: `${PART_LABEL[focusPart]}二次强化：${focusSpec.secondary}`,
      route: focusSpec.routeSec,
      minutes: focusSpec.minutes,
    },
    {
      id: "d6",
      day: 6,
      part: thirdPart,
      title: `平衡输出 · ${PART_LABEL[thirdPart]}：${thirdSpec.main}`,
      route: thirdSpec.routeMain,
      minutes: thirdSpec.minutes,
    },
    {
      id: "d7",
      day: 7,
      part: focusPart,
      title: "周末复检：四项全真模考或单科严格限时自测验证提分",
      route: "#/mock",
      minutes: 45,
    },
  ];

  return {
    id: `plan-${now.toString(36)}`,
    createdAt: now,
    focusPart,
    target,
    total100: readiness.exact100,
    tasks,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface DiagnosticReportInput {
  record: Pick<MockRecord, "at" | "label" | "strict" | "co" | "ce" | "pe" | "po" | "total100" | "typedPo">;
  target: number;
  readiness?: ExamReadiness;
  topCauses?: { cause: MissCause; n: number; share: number }[];
  weakGrammarTitles?: string[];
}

/** Build printable A4 HTML for a DELF B2 mock diagnostic report card. */
export function renderMockDiagnosticHtml({
  record,
  target,
  topCauses = [],
  weakGrammarTitles = [],
}: DiagnosticReportInput): string {
  const date = new Date(record.at).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" });
  const parts: { part: ExamPart; label: string; score: number | null }[] = [
    { part: "listen", label: "CO 听力理解", score: record.co },
    { part: "read", label: "CE 阅读理解", score: record.ce },
    { part: "essay", label: "PE 篇章写作", score: record.pe },
    { part: "speak", label: "PO 口语陈述与辩论", score: record.po },
  ];
  const eliminated = parts.filter((p) => p.score !== null && p.score < 5);
  const total = record.total100;
  const passed = !record.typedPo && total !== null && total >= 50 && eliminated.length === 0;
  const statusText = record.typedPo
    ? "含键盘输入口语（仅作内容参考，正式备考请使用语音模式）"
    : total === null
      ? "部分科目尚未评分"
      : eliminated.length > 0
        ? `未达标 · ${eliminated.map((e) => e.label).join("、")} 低于 5/25 淘汰线`
        : passed
          ? total >= target
            ? `达标并完成目标分（${total} / ${target}）`
            : `已达及格线（≥50），距目标 ${target} 分差 ${Math.round((target - total) * 10) / 10} 分`
          : `总分低于 50/100 及格线（差 ${Math.round((50 - total) * 10) / 10} 分）`;

  const rowsHtml = parts
    .map((p) => {
      const val = p.score !== null ? p.score.toFixed(1).replace(/\.0$/, "") : "—";
      const pct = p.score !== null ? Math.round((p.score / 25) * 100) : 0;
      const warn = p.score !== null && p.score < 5;
      return `<tr>
        <td><b>${escapeHtml(p.label)}</b></td>
        <td class="${warn ? "warn" : ""}">${val} / 25${warn ? "（淘汰线以下）" : ""}</td>
        <td><div class="bar"><div class="fill ${warn ? "fill-warn" : ""}" style="width:${pct}%"></div></div></td>
      </tr>`;
    })
    .join("");

  const causesHtml = topCauses.length
    ? `<ul>${topCauses
        .slice(0, 4)
        .map(
          (c) =>
            `<li><b>${escapeHtml(CAUSE_LABEL[c.cause])}</b>（${c.n} 次 · ${c.share}%）— ${escapeHtml(CAUSE_TIP[c.cause])}</li>`,
        )
        .join("")}</ul>`
    : "<p class='muted'>暂无听读高频错因累计。</p>";

  const gramHtml = weakGrammarTitles.length
    ? `<p>${weakGrammarTitles.slice(0, 6).map(escapeHtml).join(" · ")}</p>`
    : "<p class='muted'>暂无高错率语法点。</p>";

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>DELF B2 全真模考诊断报告单 - ${escapeHtml(record.label)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans SC", sans-serif; color: #16202a; margin: 0; padding: 18px 22px; line-height: 1.55; }
  h1, h2, p { margin: 0 0 8px; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #16202a; padding-bottom: 10px; margin-bottom: 14px; }
  .eyebrow { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #546474; }
  .score { font-size: 34px; font-weight: 800; color: #0b4f6c; }
  .score small { font-size: 15px; color: #546474; font-weight: 500; }
  .banner { background: #f4f7fa; border-left: 4px solid #0b4f6c; padding: 10px 12px; margin-bottom: 14px; font-size: 14px; }
  .banner.warn { border-left-color: #c43e22; background: #fdf3f1; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { border-bottom: 1px solid #d9e1e8; padding: 8px 6px; text-align: left; font-size: 13px; }
  .warn { color: #c43e22; font-weight: 700; }
  .bar { width: 100%; height: 10px; background: #e8edf2; border-radius: 999px; overflow: hidden; }
  .fill { height: 100%; background: #0b4f6c; border-radius: 999px; }
  .fill-warn { background: #c43e22; }
  .box { border: 1px solid #d9e1e8; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; }
  h2 { font-size: 14px; color: #0b4f6c; margin-bottom: 6px; }
  ul { margin: 0; padding-left: 18px; font-size: 13px; }
  li { margin-bottom: 4px; }
  .muted { color: #617182; font-size: 12px; }
  .foot { margin-top: 16px; font-size: 11px; color: #617182; border-top: 1px solid #e1e7ed; padding-top: 8px; }
</style>
</head>
<body>
  <div class="head">
    <div>
      <p class="eyebrow">法语词光 · Atlas du français · DELF B2 全真模考诊断单</p>
      <h1>${escapeHtml(record.label)}</h1>
      <p class="muted">${escapeHtml(date)} · ${record.strict ? "严格考场模式" : "自由练习节奏"} · 目标分 ${target}/100</p>
    </div>
    <div class="score">${total !== null ? total.toFixed(1).replace(/\.0$/, "") : "—"}<small> / 100</small></div>
  </div>
  <div class="banner ${eliminated.length > 0 || (total !== null && total < 50) ? "warn" : ""}">
    <b>总评判定：</b>${escapeHtml(statusText)}
  </div>
  <table>
    <thead><tr><th>科目（25 分制）</th><th>本次得分</th><th style="width:45%">掌握度条形图</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="box">
    <h2>听力 / 阅读高频错因统计</h2>
    ${causesHtml}
  </div>
  <div class="box">
    <h2>高错率薄弱语法点</h2>
    ${gramHtml}
  </div>
  <p class="foot">DELF B2 及格标准：四项总分 ≥ 50/100 且每项 ≥ 5/25。本诊断单由学习进度离线生成，可通过浏览器「打印 / 存储为 PDF」导出。</p>
</body>
</html>`;
}

/** Trigger browser A4 print / save-as-PDF via hidden iframe cleanly. */
export function openMockDiagnosticPrint(input: DiagnosticReportInput): boolean {
  if (typeof document === "undefined") return false;
  const html = renderMockDiagnosticHtml(input);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);
  const cleanup = () => {
    window.setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 600);
  };
  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    cleanup();
    return false;
  }
  doc.open();
  doc.write(html);
  doc.close();
  win.onafterprint = cleanup;
  window.setTimeout(() => {
    try {
      win.focus();
      win.print();
    } finally {
      cleanup();
    }
  }, 80);
  return true;
}