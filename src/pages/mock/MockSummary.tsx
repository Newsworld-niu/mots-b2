import { AlertTriangle, CalendarCheck, Printer, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";
import { ready, useAiConfig } from "../../ai/config";
import { explainDistractor, type DistractorExplanation } from "../../ai/tasks";
import type { EssayTask } from "../../lib/essay";
import { gradeCompQuestion, type SpeakingSubject } from "../../lib/exam";
import type { BankPaper } from "../../store/exam-bank";
import { Marking } from "../../ui/Marking";
import { toast } from "../../ui/Toast";
import { num, type MockState } from "./state";

function CompReviewBlock({
  title,
  paper,
  picked,
  typed = {},
  isListen,
}: {
  title: string;
  paper: BankPaper;
  picked: Record<string, number>;
  typed?: Record<string, string>;
  isListen: boolean;
}) {
  const ai = useAiConfig();
  const hasAi = ready.text(ai);
  const [expls, setExpls] = useState<Record<string, DistractorExplanation>>({});
  const [explBusy, setExplBusy] = useState<string | null>(null);
  let wrongCount = 0;
  let totalCount = 0;
  paper.exs.forEach((ex, e) =>
    ex.questions.forEach((q, k) => {
      totalCount++;
      if (!gradeCompQuestion(q, picked[`${e}-${k}`], typed[`${e}-${k}`], ex.docs[q.doc]?.text).correct) wrongCount++;
    }),
  );

  const explainWrong = async (key: string, q: BankPaper["exs"][number]["questions"][number], pickedIdx: number, docText: string) => {
    setExplBusy(key);
    try {
      const res = await explainDistractor({
        kind: isListen ? "listen" : "read",
        question: q.q,
        options: q.options,
        pickedIdx,
        answerIdx: q.answer,
        docText,
        why: q.why,
      });
      setExpls((prev) => ({ ...prev, [key]: res }));
    } catch (err) {
      toast((err as Error).message || "干扰项解析失败，请稍后重试", "warn");
    } finally {
      setExplBusy((cur) => (cur === key ? null : cur));
    }
  };

  return (
    <details className="essay-fold" open={wrongCount > 0}>
      <summary>
        {title}（共 {totalCount} 题 · 错 {wrongCount} 题）
      </summary>
      {paper.exs.map((ex, e) => (
        <div key={e} className="essay-box">
          <p className="eyebrow">
            EXERCICE {e + 1} · {ex.title}
          </p>
          <details className="essay-help">
            <summary>{isListen ? "查看听力原文" : "查看阅读原文"}</summary>
            {ex.docs.map((d, di) => (
              <p key={di} className="essay-text" lang="fr">
                {d.text}
              </p>
            ))}
          </details>
          <ol className="exam-questions">
            {ex.questions.map((q, k) => {
              const key = `${e}-${k}`;
              const qt = q.qType ?? "qcm";
              const res = gradeCompQuestion(q, picked[key], typed[key], ex.docs[q.doc]?.text);
              const userChoice = qt === "short" ? typed[key] || "未作答" : picked[key] !== undefined ? `${qt === "vf" ? "VF"[picked[key]] : "ABC"[picked[key]]}. ${q.options[picked[key]] ?? ""}` : "未作答";
              const rightAns =
                qt === "short"
                  ? (q.accepted ?? []).join(" / ")
                  : qt === "vf"
                    ? `${"VF"[q.answer]}. ${q.options[q.answer] ?? ""}${q.quote ? `（原文引证：${q.quote}）` : ""}`
                    : `${"ABC"[q.answer]}. ${q.options[q.answer] ?? ""}`;
              return (
                <li key={k} className={res.correct ? "is-right" : "is-wrong"}>
                  <p className="exam-q" lang="fr">
                    <b>{res.correct ? `✓ +${num(q.pts)} pt` : "✗ 错"}</b> · {q.q}
                  </p>
                  {!res.correct && (
                    <p className="small muted">
                      你的作答：<span lang="fr">{userChoice}</span>
                      {qt === "vf" && typed[key] ? `（引证：${typed[key]}）` : ""} · 参考答案：<span lang="fr">{rightAns}</span>
                    </p>
                  )}
                  <p className="small muted">{q.why}</p>
                  {!res.correct && qt !== "short" && picked[key] !== undefined && hasAi && (
                    <div className="exam-expl-wrap">
                      {!expls[key] ? (
                        <button
                          type="button"
                          className="link"
                          disabled={explBusy === key}
                          onClick={() => void explainWrong(key, q, picked[key], ex.docs[q.doc]?.text ?? "")}
                        >
                          <Sparkles size={14} /> {explBusy === key ? "AI 分析干扰陷阱中…" : "问 AI：为什么我选的这项是陷阱？"}
                        </button>
                      ) : (
                        <div className="exam-expl-card">
                          {expls[key].evidence && (
                            <p>
                              <b>原文依据：</b>
                              <span lang="fr">{expls[key].evidence}</span>
                            </p>
                          )}
                          <p>
                            <b>陷阱解析：</b>
                            {expls[key].whyTrap}
                          </p>
                          <p>
                            <b>正确同义改写：</b>
                            {expls[key].whyRight}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </details>
  );
}

export function SummaryView({
  mock,
  lp,
  rp,
  peTask,
  poSubject,
  pointTitle,
  target,
  onExit,
  onAgain,
  onPrint,
  onBuildPlan,
}: {
  mock: MockState;
  lp: BankPaper;
  rp: BankPaper;
  peTask: EssayTask;
  poSubject: SpeakingSubject;
  pointTitle: Map<string, string>;
  target: number;
  onExit: () => void;
  onAgain: () => void;
  onPrint: () => void;
  onBuildPlan: () => void;
}) {
  const co = mock.coScore ?? 0;
  const ce = mock.ceScore ?? 0;
  const pe = mock.peScore ?? 0;
  const po = mock.poScore ?? 0;
  const total = Math.round((co + ce + pe + po) * 10) / 10;
  const rows = [
    { part: "listen", label: "CO 听力", score: co },
    { part: "read", label: "CE 阅读", score: ce },
    { part: "essay", label: "PE 写作", score: pe },
    { part: "speak", label: "PO 口语", score: po },
  ] as const;
  const eliminated = rows.filter((r) => r.score < 5);
  const passed = !mock.poTyped && total >= 50 && eliminated.length === 0;
  const gap = Math.round(Math.max(0, target - total) * 10) / 10;

  return (
    <div className="panel real-flow">
      <p className="eyebrow">四项全真模考成绩单</p>
      <p className="essay-total">
        {num(total)}
        <small>/100{mock.poTyped ? "（含打字口语，仅作参考）" : ""}</small>
      </p>
      {mock.poTyped && (
        <div className="exam-alert" role="note">
          <AlertTriangle size={16} />
          <span>本次 PO 口语主要通过键盘输入（非全程开口语音），PO 分数仅作论证内容参考，不计入正式 DELF B2 通过判定与首页总分板。</span>
        </div>
      )}
      <p className="lede">
        {mock.poTyped
          ? `笔试三科已实测 ${num(Math.round((co + ce + pe) * 10) / 10)}/75；请使用语音完成 PO 以获取有效 /100 总评。`
          : passed
            ? "达到及格线（≥50 且无 <5 单项）"
            : eliminated.length
              ? "未通过：触发单项 <5/25 淘汰线"
              : "未通过：总分低于 50/100"}
        {" · "}
        {gap === 0 ? `已达到 ${target}+ 目标！` : `距离 ${target}+ 目标还差 ${num(gap)} 分`}
      </p>
      {eliminated.length > 0 && (
        <div className="exam-alert" role="alert">
          <AlertTriangle size={16} />
          <span>
            淘汰红线提醒：{eliminated.map((e) => `${e.label} ${num(e.score)}/25`).join("、")} 低于 5 分底线，哪怕总分过 50 也会判不及格！
          </span>
        </div>
      )}
      <div className="exam-four-grid">
        {rows.map((r) => (
          <div key={r.part} className={`exam-four-cell ${r.score < 5 ? "is-danger" : r.score >= 18.75 ? "is-strong" : ""}`}>
            <span className="eyebrow">{r.label}</span>
            <strong className="exam-four-score">
              {num(r.score)}
              <small>/25</small>
            </strong>
            <span className="muted small">{r.score < 5 ? "低于 5 分淘汰线" : r.score >= 18.75 ? "达 75+ 均值" : "及格"}</span>
          </div>
        ))}
      </div>

      <CompReviewBlock title="CO 听力逐题复盘与原文" paper={lp} picked={mock.coPicked} isListen />
      <CompReviewBlock title="CE 阅读逐题复盘与原文" paper={rp} picked={mock.cePicked} typed={mock.ceTyped ?? {}} isListen={false} />

      {mock.peFb && (
        <details className="essay-fold">
          <summary>PE 写作 AI 批改详情（{peTask.title}）</summary>
          <Marking fb={mock.peFb} pointTitle={pointTitle} from={peTask.title} />
        </details>
      )}
      {mock.poFb && (
        <details className="essay-fold">
          <summary>PO 口语 AI 批改详情（{poSubject.title}）</summary>
          <Marking fb={mock.poFb} pointTitle={pointTitle} from={`口语 · ${poSubject.title}`} extra={{ key: "phono", score: mock.poPhono }} />
        </details>
      )}

      <div className="writing-actions">
        <button type="button" className="btn btn-ghost" onClick={onPrint}>
          <Printer size={16} /> 打印 / 导出 A4 诊断单
        </button>
        <button type="button" className="btn btn-ghost" onClick={onBuildPlan}>
          <CalendarCheck size={16} /> 生成本周 7 天提分计划
        </button>
        <button className="btn btn-ghost" onClick={onExit}>
          返回练习主页
        </button>
        <button className="btn btn-primary" onClick={onAgain}>
          <RotateCcw size={16} /> 再模考一套
        </button>
      </div>
    </div>
  );
}
