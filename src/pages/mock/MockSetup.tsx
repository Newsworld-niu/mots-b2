import { ArrowLeft, ArrowRight, CalendarCheck, PlayCircle, Printer } from "lucide-react";
import { PART_LABEL } from "../../lib/exam";
import type { ExamResult, MockRecord, WeeklyRemediationPlan } from "../../lib/exam-schema";
import type { BankPaper } from "../../store/exam-bank";
import type { MockState } from "./state";

export interface MockSetupProps {
  paperOptions: { idx: number; label: string; readPaper: BankPaper }[];
  setIdx: number;
  setSetIdx: (i: number) => void;
  strict: boolean;
  setStrict: (v: boolean) => void;
  saved: MockState | null;
  lastSummary: MockState | null;
  mockRecords: MockRecord[];
  examLog: ExamResult[] | undefined;
  weeklyPlan: WeeklyRemediationPlan | undefined;
  onExit: () => void;
  onResumeSaved: () => void;
  onViewLastSummary: (summary: MockState) => void;
  onStartNew: () => void;
  onGenerateWeeklyPlan: () => void;
  onExportDiagnostic: (rec: MockRecord) => void;
}

export function MockSetup({
  paperOptions,
  setIdx,
  setSetIdx,
  strict,
  setStrict,
  saved,
  lastSummary,
  mockRecords,
  examLog,
  weeklyPlan,
  onExit,
  onResumeSaved,
  onViewLastSummary,
  onStartNew,
  onGenerateWeeklyPlan,
  onExportDiagnostic,
}: MockSetupProps) {
  return (
    <div className="page practice">
      <header className="page-head">
        <button className="link deck-back" onClick={onExit}>
          <ArrowLeft size={16} /> 返回练习
        </button>
        <p className="eyebrow">四项全真模考 · DELF B2 Examen blanc</p>
        <h1 className="display">2 小时 30 分笔试连考 + 口语。</h1>
        <p className="lede">完整还原考场节奏：CO 听力（~30 分钟）→ CE 阅读 + PE 写作（共享 120 分钟合计时，各建议 60 分钟）不间断连续笔试，随后进入 PO 口语（30 分钟准备 + 20 分钟陈述辩论）。有或无 AI Key 均可全程完成并计入仪表盘。</p>
      </header>

      <section className="panel exam-setup">
        <h3 className="eyebrow">选择固定套卷（套卷 1–5 · 四科全确定性配题）</h3>
        <div className="segmented segmented-wide">
          {paperOptions.map((opt) => (
            <button key={opt.idx} className={setIdx === opt.idx ? "is-on" : ""} onClick={() => setSetIdx(opt.idx)} aria-pressed={setIdx === opt.idx}>
              {opt.label}
            </button>
          ))}
        </div>

        <h3 className="eyebrow">考场模式</h3>
        <div className="segmented segmented-wide">
          <button className={strict ? "is-on" : ""} onClick={() => setStrict(true)} aria-pressed={strict}>
            严格考场模式（建议）
          </button>
          <button className={!strict ? "is-on" : ""} onClick={() => setStrict(false)} aria-pressed={!strict}>
            自由练习节奏
          </button>
        </div>
        <p className="muted small">
          {strict
            ? "严格考场模式：CE 阅读与 PE 写作共享 120 分钟总倒计时（阅读满 60 分钟提醒分配时间，120 分钟归零自动锁卷交卷）；听力不提供跳过等待按钮；写作与口语准备隐藏参考提纲。"
            : "自由练习节奏：保留完整四项流程与 2h30 总计时，但允许跳过听力读题等待并查看写作/口语参考提纲。"}
        </p>

        <div className="exam-notice" role="note">
          <p>
            <b>TTS 音频仅用于熟悉题型，考前须搭配真实电台脱敏。</b>
            <span className="muted small">口语与写作在无 AI Key 时提供静态 B2+ 范文对照与预设追问 TTS 播报，按官方五项量表计入 /100 成绩。</span>
          </p>
        </div>

        <div className="writing-actions">
          {saved && saved.stage !== "summary" && (
            <button className="btn btn-ghost" onClick={onResumeSaved}>
              继续上次未完成模考（当前：{PART_LABEL[saved.stage.startsWith("po") ? "speak" : saved.stage === "pe_grade" ? "essay" : saved.stage === "break_po" ? "speak" : (saved.stage as "listen" | "read" | "essay")] ?? saved.stage}）
            </button>
          )}
          {lastSummary && lastSummary.stage === "summary" && (
            <button className="btn btn-ghost" onClick={() => onViewLastSummary(lastSummary)}>
              查看最近一次模考复盘
            </button>
          )}
          <button className="btn btn-primary btn-xl" onClick={onStartNew}>
            <PlayCircle size={18} /> 开始四项全真模考 <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {(mockRecords.length > 0 || (examLog?.length ?? 0) > 0) && (
        <section className="panel mock-archive" aria-label="历史全真模考档案">
          <div className="panel-head">
            <div>
              <p className="eyebrow">模考档案与一键提分</p>
              <span className="muted small">支持导出 A4 PDF 诊断单，并将短板一键生成 7 天备考任务同步回首页。</span>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onGenerateWeeklyPlan}>
              <CalendarCheck size={15} /> {weeklyPlan ? "重新生成本周 7 天提分计划" : "生成本周 7 天提分计划"}
            </button>
          </div>
          {weeklyPlan && (
            <p className="small muted">
              当前本周计划已生成（主攻 {PART_LABEL[weeklyPlan.focusPart]} · 已完成 {weeklyPlan.tasks.filter((t) => t.doneAt).length}/7）— <a className="link" href="#/">前往今日看板执行 →</a>
            </p>
          )}
          {mockRecords.length > 0 && (
            <ul className="mock-archive-list">
              {mockRecords.map((rec) => (
                <li key={rec.id} className="mock-archive-row">
                  <div>
                    <b>{rec.label}</b> · <span className="muted small">{new Date(rec.at).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })} · {rec.strict ? "严格" : "自由"}</span>
                    <div className="mock-score-chips">
                      <span className="chip">CO {rec.co ?? "—"}</span>
                      <span className="chip">CE {rec.ce ?? "—"}</span>
                      <span className="chip">PE {rec.pe ?? "—"}</span>
                      <span className="chip">PO {rec.po ?? "—"}</span>
                      <b>{rec.total100 !== null ? `${rec.total100}/100` : "部分未评"}</b>
                    </div>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onExportDiagnostic(rec)}>
                    <Printer size={14} /> 导出 A4 诊断单
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
