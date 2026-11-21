import { AlertTriangle, ArrowRight, Award, PlayCircle } from "lucide-react";
import { examReadiness, PART_LABEL } from "../lib/exam";
import { useStore } from "../store/store";
import "../styles/listening.css";

const num = (n: number) => String(n).replace(".", ",");

/**
 * DELF B2 四项冲刺仪表盘（SYS-3）：
 * 展示 CO/CE/PE/PO 最新 /25 分、/100 总分预估、距 75+ 目标差距以及单项 <5/25 淘汰红线预警。
 * 可在 Practice 直接渲染，也可直接嵌入 Today / Me 预留插槽。
 */
export function ExamDashboard({ onStartMock, compact = false }: { onStartMock?: () => void; compact?: boolean }) {
  const examLog = useStore((s) => s.progress.examLog);
  const settings = useStore((s) => s.settings) as { targetScore?: number };
  const target = typeof settings.targetScore === "number" && settings.targetScore >= 50 ? settings.targetScore : 75;
  const r = examReadiness(examLog, target);

  return (
    <section className={`panel exam-dashboard ${compact ? "is-compact" : ""}`} aria-label="DELF B2 四项总分与底线预警">
      <div className="panel-head">
        <div>
          <p className="eyebrow">DELF B2 冲刺总览</p>
          <h3 className="exam-dash-title">
            {r.exact100 !== null ? (
              <>
                <b>{num(r.exact100)}</b>
                <small>/100（四科实测）</small>
              </>
            ) : r.estimated100 !== null ? (
              <>
                预估 <b>{num(r.estimated100)}</b>
                <small>/100（已测 {r.completed}/4 科）</small>
              </>
            ) : (
              <span>尚未完成完整模考</span>
            )}
          </h3>
        </div>
        <div className="exam-dash-badges">
          {r.exact100 !== null && (
            <span className={`chip ${r.passed ? "is-pass" : "is-danger"}`}>
              {r.passed ? "已过及格线" : r.eliminated.length ? "单项淘汰未过" : "总分未达 50"}
            </span>
          )}
          {r.gapToTarget !== null && (
            <span className="chip">
              <Award size={13} />{" "}
              {r.gapToTarget === 0 ? `已达 ${r.target}+ 目标` : `距 ${r.target}+ 还差 ${num(r.gapToTarget)} 分`}
            </span>
          )}
        </div>
      </div>

      {r.eliminated.length > 0 && (
        <div className="exam-alert" role="alert">
          <AlertTriangle size={16} />
          <span>
            <b>淘汰红线预警（&lt;5/25）：</b>
            DELF B2 规定任一单项低于 5/25 即总分达 50 分也判不及格。当前风险科目：
            {r.eliminated.map((p) => `${p.label} ${num(p.score25!)}/25`).join("、")}。
          </span>
        </div>
      )}

      <div className="exam-four-grid">
        {r.parts.map((p) => (
          <div key={p.part} className={`exam-four-cell ${p.eliminatory ? "is-danger" : p.score25 !== null && p.score25 >= 18.75 ? "is-strong" : ""}`}>
            <span className="eyebrow">{PART_LABEL[p.part]}</span>
            <strong className="exam-four-score">
              {p.score25 !== null ? (
                <>
                  {num(p.score25)}
                  <small>/25</small>
                </>
              ) : p.incompleteSpeak ? (
                <small className="muted">
                  {p.latestRaw?.typed ? "打字场次不计" : `${num(p.latestRaw?.score ?? 0)}/20（缺发音分）`}
                </small>
              ) : (
                <small className="muted">待测</small>
              )}
            </strong>
            <span className="muted small">
              {p.eliminatory ? "低于 5 分红线" : p.score25 !== null ? (p.score25 >= 18.75 ? "达到 75+ 均值" : "及格（≥5）") : "完成一套计入"}
            </span>
          </div>
        ))}
      </div>

      <div className="exam-dash-foot">
        <p className="muted small">
          及格标准：总分 ≥50/100 且四项均 ≥5/25；冲刺 {r.target}+ 需四科平均 ≥{num(Math.round((r.target / 4) * 10) / 10)}/25。
          {r.weakest && r.completed >= 2 ? ` 当前最弱项：${r.weakest.label}（${num(r.weakest.score25!)}/25）。` : ""}
        </p>
        {onStartMock && (
          <button className="btn btn-primary" onClick={onStartMock}>
            <PlayCircle size={16} /> 四项全真模考（2h30 笔试 + 口语） <ArrowRight size={15} />
          </button>
        )}
      </div>
    </section>
  );
}
