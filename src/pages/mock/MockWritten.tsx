import { AlertTriangle, ArrowRight, FastForward, Play, Square, Volume2 } from "lucide-react";
import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { countWords, CRITERIA, CRITERION_CHECK, CRITERION_LABEL, GENRE_LABEL, LEVELS, type EssayTask } from "../../lib/essay";
import { clock, FORM_SPEC } from "../../lib/exam";
import { splitSentences } from "../../lib/extract";
import type { BankPaper } from "../../store/exam-bank";
import { AccentKeys } from "../../ui/AccentKeys";
import { Marking } from "../../ui/Marking";
import { StaticEssayModel } from "../../ui/StaticEssayModel";
import { rubricComplete, rubricSum } from "../mock-exam-helpers";
import { num, type MockState } from "./state";

export interface MockWrittenProps {
  m: MockState;
  lp: BankPaper;
  rp: BankPaper;
  peTask: EssayTask;
  coHeard: Record<number, boolean>;
  coPace: { e: number; label: string; left: number | null } | null;
  ceHl: Record<string, boolean>;
  setCeHl: Dispatch<SetStateAction<Record<string, boolean>>>;
  ceStruck: Record<string, boolean>;
  setCeStruck: Dispatch<SetStateAction<Record<string, boolean>>>;
  toggleCeStrike: (optKey: string) => void;
  sectionTimerSec: number;
  poBusy: boolean;
  hasAi: boolean;
  pointTitle: Map<string, string>;
  update: (patch: Partial<MockState> | ((cur: MockState) => Partial<MockState>)) => void;
  onSkipCoWait: () => void;
  onHaltAudio: () => void;
  onPlayCoPaper: (startFrom?: number) => void;
  onFinishCo: () => void;
  onFinishCe: () => void;
  onSubmitPe: (fromTimeout?: boolean) => void;
  onConfirmOfflinePe: (zeroBlank?: boolean) => void;
}

export function MockWritten({
  m,
  lp,
  rp,
  peTask,
  coHeard,
  coPace,
  ceHl,
  setCeHl,
  ceStruck,
  setCeStruck,
  toggleCeStrike,
  sectionTimerSec,
  poBusy,
  hasAi,
  pointTitle,
  update,
  onSkipCoWait,
  onHaltAudio,
  onPlayCoPaper,
  onFinishCo,
  onFinishCe,
  onSubmitPe,
  onConfirmOfflinePe,
}: MockWrittenProps) {
  const ceInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const activeCeRef = useRef<HTMLInputElement | null>(null);
  const [activeCeKey, setActiveCeKey] = useState<string | null>(null);
  const peInput = useRef<HTMLTextAreaElement>(null);

  if (m.stage === "co") {
    return (
      <>
        <p className="muted small">提示：TTS 音频仅用于熟悉题型，考前须搭配真实电台脱敏。套卷共三部分 25 分：两篇长录音各听两遍，三段短录音各听一遍。</p>
        <div className="exam-player">
          {coPace ? (
            <>
              <span className="exam-clock">
                {coPace.label}
                {coPace.left !== null ? ` ${clock(coPace.left)}` : "…"}
              </span>
              {!m.strict && coPace.left !== null && (
                <button className="btn btn-ghost" onClick={onSkipCoWait}>
                  <FastForward size={16} /> 跳过等待
                </button>
              )}
              <button className="btn btn-ghost" onClick={onHaltAudio}>
                <Square size={16} /> 停止播放
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => onPlayCoPaper(0)}>
              <Play size={16} /> 连续播放整套听力（练习 1 → 2 → 3）
            </button>
          )}
        </div>
        {lp.exs.map((ex, e) => (
          <section key={e} className="exam-exercise">
            <header className="exam-ex-head">
              <h3>
                EXERCICE {e + 1} <small>{FORM_SPEC[ex.form].points} points</small>
              </h3>
              <p className="muted" lang="fr">
                {ex.intro}
              </p>
              {!coHeard[e] && !coPace && (
                <button className="link" onClick={() => onPlayCoPaper(e)}>
                  <Volume2 size={14} /> 从练习 {e + 1} 开始连续放音
                </button>
              )}
            </header>
            <ol className="exam-questions">
              {ex.questions.map((q, k) => {
                const key = `${e}-${k}`;
                return (
                  <li key={k}>
                    <p className="exam-q" lang="fr">
                      {q.q} <small>{num(q.pts)} pt</small>
                    </p>
                    <div className="exam-options" role="radiogroup">
                      {q.options.map((o, j) => (
                        <button key={j} role="radio" aria-checked={m.coPicked[key] === j} className={`exam-option ${m.coPicked[key] === j ? "is-on" : ""}`} lang="fr" onClick={() => update({ coPicked: { ...m.coPicked, [key]: j } })}>
                          <span>{"ABC"[j]}</span>
                          {o}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
        <div className="writing-actions">
          <button className="btn btn-primary btn-xl" onClick={onFinishCo}>
            交卷 CO 并立即进入 CE 阅读（60 分钟） <ArrowRight size={18} />
          </button>
        </div>
      </>
    );
  }

  if (m.stage === "ce") {
    return (
      <>
        <p className="muted small">上一科 CO 听力已记录（{num(m.coScore ?? 0)}/25）。{m.strict ? "阅读限时 60 分钟，到时自动锁卷交卷。" : "自由练习节奏：限时为参考，超时不自动锁卷。"}</p>
        {rp.exs.map((ex, e) => (
          <section key={e} className="exam-exercise">
            <header className="exam-ex-head">
              <h3>
                EXERCICE {e + 1} <small>{FORM_SPEC[ex.form].points} points</small>
              </h3>
              <p className="muted" lang="fr">
                {ex.intro}
              </p>
            </header>
            {ex.docs.map((d, k) => {
              const docPrefix = `${e}-${k}-`;
              const docHlCount = Object.entries(ceHl).filter(([sk, on]) => on && sk.startsWith(docPrefix)).length;
              const toggleSent = (sk: string) => setCeHl((cur) => ({ ...cur, [sk]: !cur[sk] }));
              return (
                <article key={k} className="exam-doc">
                  <div className="exam-doc-head">
                    <h4 className="exam-doc-title" lang="fr">
                      {ex.docs.length > 1 ? `Document ${k + 1}` : ex.title}
                    </h4>
                    <span className="exam-hl-tools">
                      <small className="muted">点击句子可高亮证据{docHlCount > 0 ? `（已标 ${docHlCount}）` : ""}</small>
                      {docHlCount > 0 && (
                        <button
                          type="button"
                          className="link"
                          onClick={() =>
                            setCeHl((cur) => Object.fromEntries(Object.entries(cur).filter(([sk]) => !sk.startsWith(docPrefix))))
                          }
                        >
                          清除高亮
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="essay-text ce-doc-body" lang="fr">
                    {d.text.split(/\n+/).filter(Boolean).map((para, pi) => (
                      <p key={pi}>
                        {splitSentences(para).map((sent, si, arr) => {
                          const sk = `${e}-${k}-${pi}-${si}`;
                          const on = !!ceHl[sk];
                          return (
                            <span
                              key={sk}
                              role="button"
                              tabIndex={0}
                              aria-pressed={on}
                              className={`ce-sent ${on ? "is-hl" : ""}`}
                              onClick={() => toggleSent(sk)}
                              onKeyDown={(ev) => {
                                if (ev.key === "Enter" || ev.key === " ") {
                                  ev.preventDefault();
                                  toggleSent(sk);
                                }
                              }}
                            >
                              {sent}
                              {si < arr.length - 1 ? " " : ""}
                            </span>
                          );
                        })}
                      </p>
                    ))}
                  </div>
                </article>
              );
            })}
            <ol className="exam-questions">
              {ex.questions.map((q, k) => {
                const key = `${e}-${k}`;
                const qt = q.qType ?? "qcm";
                return (
                  <li key={k}>
                    <p className="exam-q" lang="fr">
                      {qt === "vf" && <span className="exam-q-badge">Vrai / Faux · 引证</span>}
                      {qt === "short" && <span className="exam-q-badge">简答题</span>}
                      {q.q} <small>{num(q.pts)} pt</small>
                    </p>
                    {qt !== "short" && (
                      <div className="exam-options" role="radiogroup">
                        {q.options.map((o, j) => {
                          const optKey = `${key}-${j}`;
                          const isStruck = !!ceStruck[optKey];
                          return (
                            <div key={j} className="exam-opt-row">
                              <button
                                type="button"
                                role="radio"
                                aria-checked={m.cePicked[key] === j}
                                className={`exam-option ${m.cePicked[key] === j ? "is-on" : ""} ${isStruck ? "is-struck" : ""}`}
                                lang="fr"
                                onClick={() => {
                                  update({ cePicked: { ...m.cePicked, [key]: j } });
                                  setCeStruck((s) => {
                                    if (!s[optKey]) return s;
                                    const next = { ...s };
                                    delete next[optKey];
                                    return next;
                                  });
                                }}
                                onContextMenu={(ev) => {
                                  ev.preventDefault();
                                  toggleCeStrike(optKey);
                                }}
                              >
                                <span>{qt === "vf" ? "VF"[j] : "ABC"[j]}</span>
                                {o}
                              </button>
                              <button
                                type="button"
                                className={`exam-strike-btn ${isStruck ? "is-on" : ""}`}
                                aria-pressed={isStruck}
                                title="右键选项或点此划线排除干扰项"
                                onClick={() => toggleCeStrike(optKey)}
                              >
                                {isStruck ? "已排除" : "排除"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {(qt === "vf" || qt === "short") && (
                      <div className="exam-cite-box">
                        <input
                          ref={(el) => {
                            ceInputs.current[key] = el;
                          }}
                          onFocus={() => {
                            activeCeRef.current = ceInputs.current[key];
                            setActiveCeKey(key);
                          }}
                          type="text"
                          className="exam-cite-input"
                          lang="fr"
                          value={m.ceTyped?.[key] ?? ""}
                          onChange={(ev) => update({ ceTyped: { ...(m.ceTyped ?? {}), [key]: ev.target.value } })}
                          placeholder={qt === "vf" ? "Justifiez par une citation du texte…" : "Réponse courte en français…"}
                        />
                        {activeCeKey === key && (
                          <AccentKeys
                            input={activeCeRef}
                            value={m.ceTyped?.[key] ?? ""}
                            onChange={(v) => update({ ceTyped: { ...(m.ceTyped ?? {}), [key]: v } })}
                          />
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
        <div className="writing-actions">
          <button className="btn btn-primary btn-xl" onClick={onFinishCe}>
            交卷 CE 并立即进入 PE 写作（60 分钟） <ArrowRight size={18} />
          </button>
        </div>
      </>
    );
  }

  if (m.stage === "pe") {
    return (
      <>
        <p className="muted small">上一科 CE 阅读已记录（{num(m.ceScore ?? 0)}/25）。写作限时 60 分钟，至少 250 词（推荐 250–350 词，到时自动锁卷）。</p>
        <p className="eyebrow">
          {GENRE_LABEL[peTask.genre]} · {peTask.level} · 至少 250 词
        </p>
        <h2 className="essay-title">{peTask.title}</h2>
        {!m.strict && <p className="essay-situation">{peTask.situation}</p>}
        {peTask.doc && (
          <blockquote className="essay-doc" lang="fr">
            {peTask.doc}
          </blockquote>
        )}
        <p className="essay-consigne" lang="fr">
          {peTask.consigne}
        </p>
        {!m.strict && (
          <details className="essay-help">
            <summary>查看写作提纲提示（非严格模式）</summary>
            <ol className="essay-plan">
              {peTask.plan.map((p, k) => (
                <li key={k}>
                  <b>{p.zh}</b>
                  <span lang="fr">{p.fr}</span>
                </li>
              ))}
            </ol>
          </details>
        )}
        <textarea
          ref={peInput}
          className="writing-input essay-input"
          lang="fr"
          rows={14}
          value={m.peText}
          readOnly={poBusy || (m.strict && sectionTimerSec === 0)}
          onChange={(ev) => update({ peText: ev.target.value })}
          placeholder="Rédigez votre texte en français (au moins 250 mots)…"
          spellCheck={false}
        />
        <AccentKeys input={peInput} value={m.peText} onChange={(v) => update({ peText: v })} />
        <div className="writing-actions">
          <span className={`essay-count ${countWords(m.peText) < 250 ? "is-short" : "is-ok"}`}>
            {countWords(m.peText)} 词 · 至少 250 词（推荐 250–350）
          </span>
          <button className="btn btn-primary btn-xl" disabled={poBusy || !m.peText.trim()} onClick={() => onSubmitPe(false)}>
            {poBusy ? "AI 批改中…" : hasAi ? "提交并由 AI 批改" : "提交并对照静态 B2+ 范文自评"} <ArrowRight size={18} />
          </button>
        </div>
      </>
    );
  }

  if (m.stage === "pe_grade") {
    return (
      <>
        <h2 className="essay-title">PE 写作对照自评（无 AI Key 离线评分）</h2>
        <div className="essay-box">
          <p className="eyebrow">你的作文（{countWords(m.peText)} 词）</p>
          <p className="essay-text" lang="fr">
            {m.peText || "（未写内容）"}
          </p>
        </div>
        {!m.peText.trim() && (
          <div className="exam-alert" role="alert">
            <AlertTriangle size={16} />
            <span>未检测到作文正文（0 词），按 DELF B2 考纲交白卷应记 0/25。</span>
            <button className="btn btn-ghost btn-sm" onClick={() => onConfirmOfflinePe(true)}>
              按白卷记 0 分并结束笔试
            </button>
          </div>
        )}
        <StaticEssayModel taskId={peTask.id} defaultOpen />
        <div className="essay-box">
          <p className="eyebrow">
            按 DELF B2 官方五项量表自评（{rubricComplete(m.peSelf, CRITERIA) ? `当前合计：${rubricSum(m.peSelf, CRITERIA)}/25` : "请先逐项选择 0–5"}）
          </p>
          {CRITERIA.map((c) => (
            <div key={c} className="mock-rubric-row">
              <div>
                <b>{CRITERION_LABEL[c]}</b>
                <p className="muted small">{CRITERION_CHECK[c]}</p>
              </div>
              <div className="segmented">
                {LEVELS.map((v) => (
                  <button key={v} className={m.peSelf[c] === v ? "is-on" : ""} onClick={() => update({ peSelf: { ...m.peSelf, [c]: v } })}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="writing-actions">
          <button className="btn btn-primary btn-xl" disabled={!rubricComplete(m.peSelf, CRITERIA)} onClick={() => onConfirmOfflinePe(false)}>
            确认写作得分（{rubricComplete(m.peSelf, CRITERIA) ? `${rubricSum(m.peSelf, CRITERIA)}/25` : "待选全"}）并结束笔试 <ArrowRight size={18} />
          </button>
        </div>
      </>
    );
  }

  if (m.stage === "break_po") {
    return (
      <div className="panel real-flow">
        <h2 className="essay-title">2h30 笔试部分已完成！</h2>
        <p className="lede">
          笔试三科小计：<b>{num((m.coScore ?? 0) + (m.ceScore ?? 0) + (m.peScore ?? 0))} / 75 分</b>（CO {num(m.coScore ?? 0)} · CE {num(m.ceScore ?? 0)} · PE {num(m.peScore ?? 0)}）。
        </p>
        {m.peFb && <Marking fb={m.peFb} pointTitle={pointTitle} from={peTask.title} />}
        <p className="muted">真实 DELF B2 中，口语（PO）通常在笔试后同一天下午或另行安排。准备好后进入第 4 科口语抽题。</p>
        <div className="writing-actions">
          <button className="btn btn-primary btn-xl" onClick={() => update({ stage: "po_choose" })}>
            进入第四项：PO 口语抽题 <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
