import { AlertTriangle, BarChart3, CalendarCheck, Compass, Flame, ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useAtlas } from "../atlas/context";
import { fourSkillTrends, topicCoverageMatrix, weeklyReportSummary } from "../lib/cockpit";
import { EXAM_PARTS, PART_LABEL, type ExamPart } from "../lib/exam-schema";
import { buildWeeklyRemediation } from "../lib/remediation";
import { go } from "../lib/router";
import { saveWeeklyPlan, toggleWeeklyPlanTask } from "../store/essays";
import { buildSession, forgettingRiskCards } from "../store/session";
import { store, useStore, useStoreShallow } from "../store/store";
import { toast } from "./Toast";

type CockpitTab = "trends" | "topics" | "rescue";

const PART_COLORS: Record<ExamPart, string> = {
  listen: "var(--sky)",
  read: "var(--sage)",
  essay: "var(--terra)",
  speak: "var(--ink)",
};

/**
 * Lazy-loaded DELF B2 analytics & rescue cockpit for Today dashboard.
 * Kept isolated from initial main bundle; uses only lightweight `exam-schema` + `cockpit` helpers.
 */
export function CockpitInsights() {
  const atlas = useAtlas();
  const progress = useStoreShallow((s) => ({
    examLog: s.progress.examLog,
    speakingSessions: s.progress.speakingSessions,
    essays: s.progress.essays,
    essayTasks: s.progress.essayTasks,
    cards: s.progress.cards,
    decks: s.progress.decks,
    hidden: s.progress.hidden,
    coreMigrated: s.progress.coreMigrated,
    days: s.progress.days,
    conjDays: s.progress.conjDays,
    gramDays: s.progress.gramDays,
    drillDays: s.progress.drillDays,
    listenSources: s.progress.listenSources,
    texts: s.progress.texts,
    weeklyPlan: s.progress.weeklyPlan,
    suspendedLeeches: s.progress.suspendedLeeches,
    mockRecords: s.progress.mockRecords,
  }));
  const settings = useStore((s) => s.settings);
  const [tab, setTab] = useState<CockpitTab>("trends");
  const [expanded, setExpanded] = useState(false);
  const noExamData = !progress.examLog?.length && !progress.mockRecords?.length;

  const trends = useMemo(() => fourSkillTrends(progress.examLog), [progress.examLog]);
  const coverage = useMemo(
    () =>
      topicCoverageMatrix({
        speakingSessions: progress.speakingSessions,
        examLog: progress.examLog,
        essays: progress.essays,
        essayTasks: progress.essayTasks,
      }),
    [progress.speakingSessions, progress.examLog, progress.essays, progress.essayTasks],
  );
  const risks = useMemo(
    () => forgettingRiskCards(atlas, progress, settings.retention, 8),
    [atlas, progress, settings.retention],
  );
  const report = useMemo(() => weeklyReportSummary(progress), [progress]);
  const plan = progress.weeklyPlan;
  const target = settings.targetScore || 75;
  const hasTrendData = EXAM_PARTS.some((p) => trends[p].points.length > 0);

  const rescueWords = () => {
    if (!risks.length) return;
    const full = store.get().progress;
    if (full.session && !full.session.finished) {
      go({ page: "learn" });
      toast("当前已有进行中的复习旅程，先前往完成吧", "warn");
      return;
    }
    const sess = buildSession(atlas, full, settings, {
      ids: risks.map((r) => r.id),
      reviewOnly: true,
    });
    if (!sess.steps.length) return;
    store.progress((p) => ({ ...p, session: sess }));
    go({ page: "learn" });
  };

  const buildPlan = () => {
    const full = store.get().progress;
    const next = buildWeeklyRemediation({
      log: full.examLog,
      compMisses: full.compMisses,
      essayNotes: full.essayNotes,
      gramTags: full.gramTags,
      target,
    });
    saveWeeklyPlan(next);
    toast("已生成本周 7 天专项提分计划", "ok");
  };

  // No exam practice yet: one calm card instead of three tabs of empty charts and elimination lines.
  if (noExamData && !expanded) {
    const exam = settings.goal === "exam";
    return (
      <section className="panel cockpit-card is-empty" aria-label="B2 备考数据驾驶舱">
        <div className="cockpit-empty">
          <div className="cockpit-empty-copy">
            <p className="eyebrow">{exam ? "备考驾驶舱 · Tableau de bord" : "能力洞察 · 听说读写"}</p>
            <p className="small">
              {exam
                ? "还没有测评数据。做一次听力或阅读诊断练习，这里就会出现四科趋势、主题覆盖与提分周计划。"
                : "想知道自己听说读写到哪一步了？做一次 10 分钟的诊断练习，这里会画出你的能力曲线。"}
            </p>
            {risks.length > 0 && <p className="muted small">另有 {risks.length} 个已学词接近遗忘，可展开抢救复习。</p>}
          </div>
          <div className="cockpit-empty-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => go({ page: "listen" })}>
              开始诊断练习 <ArrowRight size={14} />
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpanded(true)} aria-expanded={false}>
              展开驾驶舱
            </button>
          </div>
        </div>
      </section>
    );
  }

  const targetLineY = Math.round(108 - ((target / 4) / 25) * 92);
  const elimLineY = Math.round(108 - (5 / 25) * 92);

  return (
    <section className="panel cockpit-card" aria-label="B2 备考数据驾驶舱">
      <div className="panel-head cockpit-head">
        <div>
          <p className="eyebrow">备考驾驶舱 · Tableau de bord B2</p>
          <p className="muted small">
            近 7 天活跃 {report.activeDays} 天（{report.weekActions} 次交互）· 主题覆盖 {coverage.coveredCount + coverage.touchedCount}/15 · 遗忘预警 {risks.length} 词
          </p>
        </div>
        <div className="segmented" role="tablist" aria-label="驾驶舱视图切换">
          <button type="button" role="tab" aria-selected={tab === "trends"} className={tab === "trends" ? "is-on" : ""} onClick={() => setTab("trends")}>
            <BarChart3 size={14} /> 四科趋势
          </button>
          <button type="button" role="tab" aria-selected={tab === "topics"} className={tab === "topics" ? "is-on" : ""} onClick={() => setTab("topics")}>
            <Compass size={14} /> 15 主题覆盖
          </button>
          <button type="button" role="tab" aria-selected={tab === "rescue"} className={tab === "rescue" ? "is-on" : ""} onClick={() => setTab("rescue")}>
            <Flame size={14} /> 救援与周报
          </button>
        </div>
      </div>

      {tab === "trends" && (
        <div className="cockpit-body">
          {hasTrendData ? (
            <>
              <svg viewBox="0 0 320 120" className="cockpit-svg" role="img" aria-label="DELF B2 四科成绩变化折线图">
                <line x1="16" y1={targetLineY} x2="304" y2={targetLineY} className="cockpit-guide is-target" />
                <line x1="16" y1={elimLineY} x2="304" y2={elimLineY} className="cockpit-guide is-elim" />
                {EXAM_PARTS.map((part) => {
                  const pts = trends[part].points;
                  if (!pts.length) return null;
                  const poly = pts
                    .map((pt, i) => {
                      const x = pts.length === 1 ? 160 : 20 + (i * 280) / (pts.length - 1);
                      const y = 108 - (Math.max(0, Math.min(25, pt.score25)) / 25) * 92;
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    })
                    .join(" ");
                  const lastPt = pts[pts.length - 1];
                  const lx = pts.length === 1 ? 160 : 300;
                  const ly = 108 - (Math.max(0, Math.min(25, lastPt.score25)) / 25) * 92;
                  return (
                    <g key={part}>
                      {pts.length >= 2 && (
                        <polyline points={poly} fill="none" stroke={PART_COLORS[part]} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      )}
                      <circle cx={lx} cy={ly} r="3.5" fill={PART_COLORS[part]} />
                    </g>
                  );
                })}
              </svg>
              <div className="cockpit-trend-pills">
                {EXAM_PARTS.map((part) => {
                  const t = trends[part];
                  return (
                    <div key={part} className="cockpit-trend-pill">
                      <span className="dot" style={{ background: PART_COLORS[part] }} />
                      <b>{t.label}</b>
                      <span>{t.latest !== null ? `${t.latest}/25` : "未测"}</span>
                      {t.delta !== null && t.delta !== 0 && (
                        <small className={t.delta > 0 ? "is-ok" : "warn"}>
                          {t.delta > 0 ? `+${t.delta}` : t.delta}
                        </small>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="muted small">
              完成任意 B2 听力 / 阅读 / 写作 / 语音口语完整测评或全真模考后，这里会生成 25 分制四科趋势折线（含 5 分淘汰线与目标均值虚线）。
            </p>
          )}
        </div>
      )}

      {tab === "topics" && (
        <div className="cockpit-body">
          <div className="cockpit-topic-head">
            <p className="small muted">
              DELF B2 官方 15 大社会高频议题：已深练 {coverage.coveredCount} 项 · 初探 {coverage.touchedCount} 项 · 盲区 {coverage.blindCount} 项
            </p>
            <div className="writing-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => go({ page: "speak" })}>
                练口语主题 →
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => go({ page: "essay" })}>
                写议论文 →
              </button>
            </div>
          </div>
          <ul className="cockpit-matrix">
            {coverage.items.map((item) => (
              <li key={item.id} className={`cockpit-topic is-${item.status}`}>
                <div className="cockpit-topic-top">
                  <b>{item.zh}</b>
                  <span className="chip">
                    {item.status === "covered" ? `已练 ${item.count}` : item.status === "touched" ? "初探 1" : "盲区"}
                  </span>
                </div>
                <small lang="fr" className="muted">
                  {item.fr}
                </small>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "rescue" && (
        <div className="cockpit-body">
          <div className="cockpit-weekly-box">
            <p className="eyebrow">本周学习周报（近 7 天）</p>
            <p className="small">
              活跃 <b>{report.activeDays}/7</b> 天 · 累计 <b>{report.weekActions}</b> 次练习 ·
              模考/真题 <b>{report.examRuns}</b> 场 · 写作 <b>{report.essayRuns}</b> 篇 · 口语 <b>{report.speakingRuns}</b> 场
              {report.topImproveLabel ? ` · 最明显进步：${report.topImproveLabel}` : ""}
            </p>
          </div>

          <div className="cockpit-rescue-box">
            <div className="panel-head">
              <div>
                <p className="eyebrow">高危遗忘预警词（FSRS 提取率 &lt;78%）</p>
                <span className="muted small">临近遗忘拐点的词先抢救复习，记忆性价比最高。</span>
              </div>
              {risks.length > 0 && (
                <button type="button" className="btn btn-primary btn-sm" onClick={rescueWords}>
                  立即抢救这 {risks.length} 个词 <ArrowRight size={14} />
                </button>
              )}
            </div>
            {risks.length > 0 ? (
              <ul className="cockpit-risk-list">
                {risks.map((r) => (
                  <li key={r.id} className="cockpit-risk-chip">
                    <AlertTriangle size={13} />
                    <b lang="fr">{r.word}</b>
                    <span className="muted">{r.zh}</span>
                    <small className="warn">{r.retrievabilityPct}%</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">当前已学词提取率均保持健康，暂无跌破 78% 警戒线的词。</p>
            )}
          </div>

          <div className="cockpit-plan-box">
            <div className="panel-head">
              <div>
                <p className="eyebrow">本周 7 天专项提分行动清单</p>
                {plan ? (
                  <span className="muted small">
                    主攻短板：{PART_LABEL[plan.focusPart]} · 已完成 {plan.tasks.filter((t) => t.doneAt).length}/7 项
                  </span>
                ) : (
                  <span className="muted small">尚未生成专项周计划，可根据近期成绩一键生成。</span>
                )}
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={buildPlan}>
                <CalendarCheck size={14} /> {plan ? "刷新本周计划" : "一键生成周计划"}
              </button>
            </div>
            {plan && (
              <ol className="cockpit-plan-list">
                {plan.tasks.map((t) => (
                  <li key={t.id} className={t.doneAt ? "is-done" : ""}>
                    <label>
                      <input type="checkbox" checked={Boolean(t.doneAt)} onChange={() => toggleWeeklyPlanTask(t.id)} />
                      <span>
                        <b>Day {t.day}</b> · {t.title} <small className="muted">({t.minutes}m)</small>
                      </span>
                    </label>
                    <a className="link small" href={t.route}>
                      去练 →
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
