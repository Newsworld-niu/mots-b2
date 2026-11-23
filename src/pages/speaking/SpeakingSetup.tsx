import { ArrowLeft, RotateCcw, Shuffle, Sparkles, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { OralCapabilityNotice } from "../../ai/pronunciation";
import { SAMPLE_SPEAKING_PREVIEW } from "../../lib/ai-samples";
import { clock, realScore25, SPEAKING_SUBJECTS, topicOf, type SpeakingSubject } from "../../lib/exam";
import type { ExamResult, SpeakingSession } from "../../lib/exam-schema";
import type { ExamTrack } from "../../lib/exam-tracks";
import { href } from "../../lib/router";
import { getRecording } from "../../store/recordings";
import { Marking } from "../../ui/Marking";
import { toast } from "../../ui/Toast";
import { day, type Phase } from "./helpers";

export interface SpeakingSetupProps {
  phase: Phase;
  examTrack: ExamTrack;
  onSwitchTrack: (t: ExamTrack) => void;
  oralTier: OralCapabilityNotice;
  hasAi: boolean;
  neuralSttReady: boolean;
  azureReady: boolean;
  whisperReady: boolean;
  dictation: boolean;
  recorderSupported: boolean;
  drawn: SpeakingSubject[];
  strictMode: boolean;
  setStrictMode: (v: boolean) => void;
  noAuxMode: boolean;
  setNoAuxMode: (v: boolean) => void;
  pointTitle: Map<string, string>;
  sessions: SpeakingSession[];
  log: ExamResult[];
  onExit: () => void;
  onLeave: () => void;
  onDraw: (fromAi: boolean) => void;
  onChoose: (s: SpeakingSubject) => void;
  onResetPhasePick: () => void;
  onStartRetell: (sess: SpeakingSession) => void;
}

export function SpeakingSetup({
  phase,
  examTrack,
  onSwitchTrack,
  oralTier,
  hasAi,
  neuralSttReady,
  azureReady,
  whisperReady,
  dictation,
  recorderSupported,
  drawn,
  strictMode,
  setStrictMode,
  noAuxMode,
  setNoAuxMode,
  pointTitle,
  sessions,
  log,
  onExit,
  onLeave,
  onDraw,
  onChoose,
  onResetPhasePick,
  onStartRetell,
}: SpeakingSetupProps) {
  const [sampleOpen, setSampleOpen] = useState(false);
  const [archiveAudio, setArchiveAudio] = useState<{ id: string; url: string } | null>(null);
  const archiveAudioRef = useRef<{ id: string; url: string } | null>(null);
  archiveAudioRef.current = archiveAudio;

  useEffect(
    () => () => {
      if (archiveAudioRef.current) URL.revokeObjectURL(archiveAudioRef.current.url);
    },
    [],
  );

  const toggleArchiveAudio = async (sess: SpeakingSession) => {
    if (!sess.takeId) return;
    if (archiveAudio?.id === sess.takeId) {
      URL.revokeObjectURL(archiveAudio.url);
      setArchiveAudio(null);
      return;
    }
    const rec = await getRecording(sess.takeId);
    if (!rec) {
      toast("该条本地原声录音已过期清理或不存在", "warn");
      return;
    }
    if (archiveAudio) URL.revokeObjectURL(archiveAudio.url);
    const url = URL.createObjectURL(rec.blob);
    setArchiveAudio({ id: sess.takeId, url });
  };

  return (
    <div className="page practice">
      <header className="page-head">
        <button className="link deck-back" onClick={onExit}>
          <ArrowLeft size={16} /> 返回练习
        </button>
        {phase === "pick" && (
          <div className="writing-actions">
            <div className="segmented" role="group" aria-label="切换口语考试体系">
              {(["delf", "tcf", "tef"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={examTrack === t ? "is-on" : ""}
                  aria-pressed={examTrack === t}
                  onClick={() => onSwitchTrack(t)}
                >
                  {t === "delf" ? "DELF B2" : t === "tcf" ? "TCF EO（12m · /20）" : "TEF EO（15m · /699）"}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="eyebrow">口语 · Production orale</p>
        <h1 className="display">想清楚，再开口。</h1>
        <p className="lede">和考试一样：抽两个题选一个，准备 30 分钟，先连续说 5–7 分钟（指出材料提出的问题，表明并论证自己的看法），再和考官辩论 10–13 分钟。这里由 AI 扮考官：它把问题说出来，你开口回答，它接着你的话追问，直到你结束。</p>
        <p className="muted">
          批改用官方评分表：独白、互动、词汇、语法由 AI 根据真实口语转写打分（每项 0–5 分，含 0.5 分档，共 20 分）；第五项发音由 Azure 语音评测（0.5 分精度）或你对照标准自评（5 分）。未评第五项时仅显示「不含发音 20 分制」，不会按比例折算 25 分；纯键盘输入不计入 25 分口语曲线。
          {azureReady
            ? "已启用 Tier-1 Azure 语音评测：录音将以高保真原话覆盖浏览器粗略字幕，并提供逐词 IPA 音素、联诵与韵律分析。"
            : whisperReady || neuralSttReady
              ? "已启用 Tier-2 原话逐字转写：录音将自动覆盖浏览器粗略字幕，并提供语速、停顿与卡壳诊断。"
              : dictation
                ? "当前仅使用浏览器内置语音字幕。"
                : "当前浏览器不支持实时语音识别。"}
          {recorderSupported ? "独白与辩论均在本地录音，可随时逐词点击回放。" : ""}
        </p>
        <div className={oralTier.tier === 1 ? "essay-box" : "speak-mode-banner"} role="note">
          <p>
            <b>{oralTier.label}：</b>
            {oralTier.detail}
          </p>
          {oralTier.tier !== 1 && (
            <p className="small">
              前往 <a className="link" href={href({ page: "me" })}>我的 → AI 接口</a> 填入 <b>Azure 语音 Key + 区域</b>（Tier 1：完整 IPA 音素、必/禁连诵与 0.5 分发音评测），或配置 <b>Whisper STT / Gemini / OpenRouter 多模态语音模型</b>（Tier 2：原话逐字转写 + 语速停顿诊断）。
            </p>
          )}
        </div>
        {!hasAi && (
          <div className="ai-sample-banner">
            <p className="muted">
              还没有设置 AI 接口：内置 {SPEAKING_SUBJECTS.length} 题仍可完整抽题、准备、录音，并由语音播报预设考官追问、核对参考提纲与五项量表自评（配置 Azure 语音后还可自动评第 5 项发音）。到 <a className="link" href={href({ page: "me" })}>我的 → AI 接口</a> 贴入 1 个 Key 即可启用 AI 考官与逐句批改。
            </p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSampleOpen((v) => !v)} aria-expanded={sampleOpen}>
              <Sparkles size={15} /> {sampleOpen ? "收起口语批改样张" : "预览 B2 口语批改样张（免 Key）"}
            </button>
          </div>
        )}
      </header>
      {!hasAi && sampleOpen && (
        <section className="panel ai-sample-box" aria-label="DELF B2 口语批改样张">
          <div className="panel-head">
            <div>
              <p className="eyebrow">免 Key 交互样张 · {SAMPLE_SPEAKING_PREVIEW.title}</p>
              <span className="muted small" lang="fr">Problématique: {SAMPLE_SPEAKING_PREVIEW.problematic}</span>
            </div>
            <button type="button" className="link small" onClick={() => setSampleOpen(false)}>
              收起样张
            </button>
          </div>
          <details className="essay-fold" open>
            <summary>查看独白节选与考官辩论实录</summary>
            <p className="essay-text" lang="fr">{SAMPLE_SPEAKING_PREVIEW.monologueExcerpt}</p>
            <ul className="exam-debate">
              {SAMPLE_SPEAKING_PREVIEW.debateExcerpt.map((d, idx) => (
                <li key={idx}>
                  <p lang="fr"><b>考官：</b>{d.q}</p>
                  <p lang="fr"><b>考生：</b>{d.a}</p>
                </li>
              ))}
            </ul>
          </details>
          <Marking
            fb={SAMPLE_SPEAKING_PREVIEW.fb}
            pointTitle={pointTitle}
            from={SAMPLE_SPEAKING_PREVIEW.title}
            extra={{ key: "phono", score: SAMPLE_SPEAKING_PREVIEW.phonoScore }}
          />
        </section>
      )}
      {phase === "choose" ? (
        <>
          <h2 className="eyebrow">抽到这两个题，选一个</h2>
          <div className="essay-tasks exam-draw">
            {drawn.map((s) => (
              <button key={s.id} className="essay-task" onClick={() => onChoose(s)}>
                <span className="chip">{topicOf(s.topic)?.zh}</span>
                <b lang="fr">{s.title}</b>
                <small lang="fr">{s.doc}</small>
                {s.source && (
                  <small className="muted" lang="fr">
                    {s.source}
                  </small>
                )}
              </button>
            ))}
          </div>
          <div className="writing-actions">
            <button className="btn btn-ghost" onClick={onResetPhasePick}>
              重新抽
            </button>
          </div>
        </>
      ) : (
        <div className="writing-actions exam-draw-actions">
          {phase === "drawing" ? (
            <>
              <p className="muted">AI 出题中（约 20–40 秒）…</p>
              <button className="btn btn-ghost" onClick={onLeave}>
                取消
              </button>
            </>
          ) : (
            <>
              <div className="speak-mode-cards" role="radiogroup" aria-label="口语练习模式选择">
                <button
                  type="button"
                  role="radio"
                  aria-checked={!strictMode}
                  className={`speak-mode-card ${!strictMode ? "is-active" : ""}`}
                  onClick={() => setStrictMode(false)}
                >
                  <b>教练陪练模式</b>
                  <small>
                    保留审题微训、衔接词与辩论话术抽屉；独白结束后先进入回放复盘页核对文字，再自主开启考官辩论。
                  </small>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={strictMode}
                  className={`speak-mode-card ${strictMode ? "is-active" : ""}`}
                  onClick={() => setStrictMode(true)}
                >
                  <b>全真考场模式（Strict PO）</b>
                  <small>
                    独白结束无缝直入辩论（跳过中场复盘）；锁定语音转写禁键盘改稿；发言期仅限 ≤8×3 词提纲卡；6:30 黄灯提醒、7:15 考官礼貌打断切入辩论；辩论须满 10:00 或 ≥6 轮。
                  </small>
                </button>
              </div>
              <label className="field toggle is-full">
                <div>
                  <b>考场脱稿无辅助模式</b>
                  <small>
                    {strictMode
                      ? "全真考场模式已自动启用 ≤8×3 关键词卡与转写防篡改；开启此项将连同准备期的结构模板与话题词汇一并隐藏。"
                      : "在陪练模式下隐藏准备期模板/词汇，发言期仅保留 ≤8×3 词提纲卡并锁定原始语音转写。"}
                  </small>
                </div>
                <input type="checkbox" role="switch" checked={noAuxMode} onChange={(e) => setNoAuxMode(e.target.checked)} />
                <span className="switch" aria-hidden="true" />
              </label>
              {hasAi ? (
                <>
                  <button className="btn btn-primary btn-xl" onClick={() => onDraw(true)}>
                    <Sparkles size={18} /> 抽两个新题（AI 按真题长度出题）
                  </button>
                  <button className="btn btn-ghost" onClick={() => onDraw(false)}>
                    <Shuffle size={16} /> 抽内置题库（{SPEAKING_SUBJECTS.length} 题，真题长度）
                  </button>
                </>
              ) : (
                <button className="btn btn-primary btn-xl" onClick={() => onDraw(false)}>
                  <Shuffle size={18} /> 抽两个题（内置 {SPEAKING_SUBJECTS.length} 题）
                </button>
              )}
            </>
          )}
        </div>
      )}
      {(sessions.length > 0 || log.length > 0) && phase === "pick" && (() => {
        const realScores = log.map(realScore25).filter((x): x is number => x !== null);
        const avg25 = realScores.length ? (realScores.reduce((a, b) => a + b, 0) / realScores.length).toFixed(1) : null;
        const chrono = sessions.slice(0, 12).reverse();
        const hasPronPoints = chrono.some((s) => s.pron?.accuracy != null || s.pron?.fluency != null || s.pron?.prosody != null);
        const polyPts = (vals: (number | null | undefined)[]) =>
          vals
            .map((v, idx) => {
              if (typeof v !== "number") return null;
              const x = chrono.length <= 1 ? 160 : 18 + (idx * 284) / (chrono.length - 1);
              const y = 98 - (Math.max(0, Math.min(100, v)) / 100) * 86;
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .filter((s): s is string => !!s)
            .join(" ");
        return (
          <section className="essay-level speak-archive" aria-label="PO 口语成长档案">
            <h2 className="eyebrow">
              PO 口语成长档案与声学曲线{avg25 !== null ? `（真实 25 分制均分 ${avg25}/25）` : "（不含发音 20 分与打字记录不计入 25 分制）"}
            </h2>
            {chrono.length >= 2 && (
              <div className="speak-chart-wrap">
                <svg viewBox="0 0 320 110" className="speak-svg-chart" role="img" aria-label="PO 口语声学与得分趋势图">
                  <line x1="16" y1="38" x2="304" y2="38" className="chart-guide" />
                  <polyline points={polyPts(chrono.map((s) => (s.total25 !== null ? s.total25 * 4 : null)))} className="chart-line is-total" fill="none" />
                  {hasPronPoints && (
                    <>
                      <polyline points={polyPts(chrono.map((s) => s.pron?.accuracy))} className="chart-line is-acc" fill="none" />
                      <polyline points={polyPts(chrono.map((s) => s.pron?.fluency))} className="chart-line is-flu" fill="none" />
                      <polyline points={polyPts(chrono.map((s) => s.pron?.prosody))} className="chart-line is-pro" fill="none" />
                    </>
                  )}
                </svg>
                <p className="muted small speak-chart-legend">
                  <span>虚线：折算得分%</span>
                  {hasPronPoints && (
                    <>
                      <span>· 准确度</span>
                      <span>· 流利度</span>
                      <span>· 韵律重音</span>
                    </>
                  )}
                  <span>（参考线 70）</span>
                </p>
              </div>
            )}
            {sessions.length > 0 ? (
              <ul className="essay-history speak-archive-list">
                {sessions.slice(0, 12).map((sess) => (
                  <li key={sess.id} className="speak-archive-row">
                    <div className="speak-archive-head">
                      <span>
                        {day(sess.at)} · <b lang="fr">{sess.title}</b>
                        {(sess.draft ?? 1) > 1 && <em className="chip">第 {sess.draft} 稿</em>}
                      </span>
                      <span className="muted">
                        {sess.total25 !== null ? `${sess.total25}/25` : sess.typed ? "打字记录" : "待补发音"} · {sess.monologueWords} 词 · {clock(sess.monologueSec)}
                      </span>
                    </div>
                    {sess.pron && (
                      <p className="muted small">
                        声学四维：准确 {sess.pron.accuracy ?? "—"} · 流利 {sess.pron.fluency ?? "—"} · 韵律 {sess.pron.prosody ?? "—"} · 完整 {sess.pron.completeness ?? "—"}
                      </p>
                    )}
                    <div className="speak-archive-actions">
                      {sess.takeId && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void toggleArchiveAudio(sess)}>
                          <Volume2 size={14} /> {archiveAudio?.id === sess.takeId ? "收起录音" : "播放原声"}
                        </button>
                      )}
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onStartRetell(sess)}>
                        <RotateCcw size={14} /> 同题二稿重说对比
                      </button>
                    </div>
                    {archiveAudio && archiveAudio.id === sess.takeId && (
                      <audio controls autoPlay src={archiveAudio.url} className="speak-archive-audio" />
                    )}
                    {(sess.transcript || sess.turns?.length) && (
                      <details className="essay-help">
                        <summary>查看独白与辩论文字存档</summary>
                        {sess.transcript && (
                          <p className="essay-text small" lang="fr">
                            {sess.transcript}
                          </p>
                        )}
                        {sess.turns?.map((t, ti) => (
                          <p key={ti} className="small muted" lang="fr">
                            <b>Q{ti + 1}:</b> {t.q} <b>→</b> {t.a}
                          </p>
                        ))}
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="essay-history">
                {log.slice(0, 8).map((r, k) => {
                  const s25 = realScore25(r);
                  return (
                    <li key={k}>
                      <span>
                        {day(r.at)} · {SPEAKING_SUBJECTS.find((s) => s.id === r.what)?.title ?? topicOf(r.what)?.zh ?? r.what}
                      </span>
                      <span className="muted">
                        {s25 !== null ? `${s25}/25` : r.typed ? `${r.score}/${r.total} · 打字（不计入 25 分制）` : `${r.score}/20 · 不含发音 20 分制`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })()}
    </div>
  );
}
