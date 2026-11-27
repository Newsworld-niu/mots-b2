import { ArrowRight, Mic, Square } from "lucide-react";
import { useRef } from "react";
import { play } from "../../lib/audio";
import { CRITERION_CHECK, CRITERION_LABEL, LEVELS } from "../../lib/essay";
import { clock, SPEAK_CRITERIA, SPEAKING_SUBJECTS, topicOf, type DebateTurn, type SpeakingSubject } from "../../lib/exam";
import { phonoLevel } from "../../lib/pronunciation";
import type { Take } from "../../lib/recorder";
import type { speakingPresetOf } from "../../lib/speaking-presets";
import { AccentKeys } from "../../ui/AccentKeys";
import { Marking } from "../../ui/Marking";
import { AssessHint, AssessStatus, PronReport, sttName, TakePlayer, type useAssess, type useRecorder } from "../../ui/Recording";
import { resolveMockPoTyped, rubricComplete, rubricSum, shouldShowDebateTurn1Recovery } from "../mock-exam-helpers";
import { toStrictCueCards } from "../speaking/helpers";
import type { MockState } from "./state";

export interface MockSpeakingProps {
  m: MockState;
  poSubject: SpeakingSubject;
  poPreset: ReturnType<typeof speakingPresetOf>;
  sectionTimerSec: number;
  dictation: boolean;
  sttReady: boolean;
  hasAi: boolean;
  poDictating: boolean;
  poInterim: string;
  poTranscribing: boolean;
  poAsking: boolean;
  poAskError: string | null;
  poBusy: boolean;
  poDebateSpeechFailed: boolean;
  poTalkTake: Take | null;
  poTurnTakes: Record<number, Take>;
  recorder: ReturnType<typeof useRecorder>;
  pron: ReturnType<typeof useAssess>;
  pointTitle: Map<string, string>;
  update: (patch: Partial<MockState> | ((cur: MockState) => Partial<MockState>)) => void;
  onChooseSubject: (s: SpeakingSubject) => void;
  onStartPoTalk: () => void;
  onEndPoTalk: () => void;
  onRedictatePoReview: () => void;
  onStartPoDebate: () => void;
  onAskNextExaminer: (so: DebateTurn[]) => void;
  onFinishPoDebate: (so: DebateTurn[]) => void;
  onBeginDebateTurn: (turnIdx: number) => void;
  onStopDebateTurn: (turnIdx: number) => void;
  onConfirmPoScore: () => void;
}

export function MockSpeaking({
  m,
  poSubject,
  poPreset,
  sectionTimerSec,
  dictation,
  sttReady,
  hasAi,
  poDictating,
  poInterim,
  poTranscribing,
  poAsking,
  poAskError,
  poBusy,
  poDebateSpeechFailed,
  poTalkTake,
  poTurnTakes,
  recorder,
  pron,
  pointTitle,
  update,
  onChooseSubject,
  onStartPoTalk,
  onEndPoTalk,
  onRedictatePoReview,
  onStartPoDebate,
  onAskNextExaminer,
  onFinishPoDebate,
  onBeginDebateTurn,
  onStopDebateTurn,
  onConfirmPoScore,
}: MockSpeakingProps) {
  const poNotesRef = useRef<HTMLTextAreaElement>(null);
  const poSaidRef = useRef<HTMLTextAreaElement>(null);
  const poDebateRef = useRef<HTMLTextAreaElement>(null);

  if (m.stage === "po_choose") {
    return (
      <>
        <h2 className="essay-title">PO 口语：二选一</h2>
        <div className="essay-tasks exam-draw">
          {m.poDrawnIds.map((id) => {
            const s = SPEAKING_SUBJECTS.find((x) => x.id === id);
            if (!s) return null;
            return (
              <button key={s.id} className="essay-task" onClick={() => onChooseSubject(s)}>
                <span className="chip">{topicOf(s.topic)?.zh}</span>
                <b lang="fr">{s.title}</b>
                <small lang="fr">{s.doc}</small>
              </button>
            );
          })}
        </div>
      </>
    );
  }

  if (m.stage === "po_prep") {
    return (
      <>
        <div className="panel-head">
          <h2 className="essay-title" lang="fr">
            {poSubject.title}
          </h2>
          <span className={`exam-clock ${sectionTimerSec === 0 ? "is-over" : ""}`}>准备 {clock(sectionTimerSec)}</span>
        </div>
        <p className="essay-consigne" lang="fr">
          {poSubject.doc}
        </p>
        <p className="muted small" lang="fr">
          Vous devez dégager la problématique de ce document et présenter votre point de vue de façon structurée et argumentée pendant 5 à 7 minutes.
        </p>
        {!m.strict && poPreset && (
          <details className="essay-help">
            <summary>查看参考提纲（非严格模式）</summary>
            <p className="muted small" lang="fr">
              Problématique possible : {poPreset.problematique}
            </p>
            <ol className="essay-plan">
              {poPreset.outline.map((o, i) => (
                <li key={i}>
                  <b>{o.zh}</b>
                  <span lang="fr">{o.fr}</span>
                </li>
              ))}
            </ol>
          </details>
        )}
        <textarea ref={poNotesRef} className="writing-input essay-notes" rows={6} lang="fr" value={m.poNotes} onChange={(e) => update({ poNotes: e.target.value })} placeholder="准备提纲关键词（避免写成逐字稿）…" />
        <AccentKeys input={poNotesRef} value={m.poNotes} onChange={(v) => update({ poNotes: v })} />
        <div className="writing-actions">
          <button className="btn btn-primary btn-xl" onClick={onStartPoTalk}>
            <Mic size={18} /> 开始独白陈述（5–7 分钟） <ArrowRight size={18} />
          </button>
        </div>
      </>
    );
  }

  if (m.stage === "po_talk") {
    return (
      <>
        <div className="panel-head">
          <h2 className="essay-title">第 1 部分：独白陈述（目标 5–7 分钟）</h2>
          <span className="exam-clock">{clock(sectionTimerSec)}</span>
        </div>
        {m.poNotes.trim() && (
          <div className="essay-box">
            <p className="eyebrow">{m.strict ? "考场关键词提示卡（严格模式限 ≤8×3 词）" : "准备笔记"}</p>
            {m.strict ? (
              <div className="chips" lang="fr">
                {toStrictCueCards(m.poNotes).map((cue, idx) => (
                  <span key={idx} className="chip">
                    {cue}
                  </span>
                ))}
              </div>
            ) : (
              <p className="essay-text">{m.poNotes}</p>
            )}
          </div>
        )}
        {dictation ? (
          <div className={`exam-live ${poDictating ? "is-on" : ""}`}>
            <p className="eyebrow">{poDictating ? "语音识别记录中…" : "语音识别已停"}</p>
            <p className="essay-text" lang="fr">
              {m.poSaid}
              <i>{poInterim}</i>
            </p>
          </div>
        ) : (
          <p className="muted">当前浏览器不支持语音识别：请对着计时说 5–7 分钟，说完后在下一步补充转写或自评。</p>
        )}
        <div className="writing-actions">
          {recorder.on && (
            <span className="muted small">
              <i className="rec-dot" aria-hidden="true" />
              录音中
            </span>
          )}
          <button className="btn btn-primary btn-xl" onClick={onEndPoTalk}>
            <Square size={16} /> 独白结束，进入辩论 <ArrowRight size={18} />
          </button>
        </div>
      </>
    );
  }

  if (m.stage === "po_review") {
    return (
      <>
        <h2 className="essay-title">检查独白记录并进入辩论</h2>
        <TakePlayer take={poTalkTake} label="听自己的独白" />
        {poTalkTake && (pron.available ? <AssessStatus a={pron} /> : <AssessHint />)}
        {pron.state === "done" && pron.result && <PronReport result={pron.result} />}
        <textarea
          ref={poSaidRef}
          className="writing-input essay-input"
          rows={8}
          lang="fr"
          value={m.poSaid}
          onChange={(e) => {
            const nextSaid = e.target.value;
            const voiceSaid = m.poVoiceSaid ?? (m.poTyped ? "" : m.poSaid);
            update({ poSaid: nextSaid, poVoiceSaid: voiceSaid, poTyped: resolveMockPoTyped({ finalSaid: nextSaid, voiceSaid }) });
          }}
          placeholder="如有遗漏可补充你刚说过的法语要点…"
        />
        <AccentKeys
          input={poSaidRef}
          value={m.poSaid}
          onChange={(nextSaid) => {
            const voiceSaid = m.poVoiceSaid ?? (m.poTyped ? "" : m.poSaid);
            update({ poSaid: nextSaid, poVoiceSaid: voiceSaid, poTyped: resolveMockPoTyped({ finalSaid: nextSaid, voiceSaid }) });
          }}
        />
        {poDictating && <p className="muted small">正在重新语音识别：{poInterim || "请开口说法语…"}</p>}
        {poTranscribing && <p className="muted small">正在调用 Whisper 语音转写独白…</p>}
        <div className="writing-actions">
          {dictation && (
            <button className="btn btn-ghost" type="button" onClick={onRedictatePoReview}>
              {poDictating ? (
                <>
                  <Square size={16} /> 停止语音录入
                </>
              ) : (
                <>
                  <Mic size={16} /> 清空重录语音
                </>
              )}
            </button>
          )}
          <button className="btn btn-primary btn-xl" disabled={!m.poSaid.trim() && hasAi} onClick={onStartPoDebate}>
            进入考官辩论（10–13 分钟） <ArrowRight size={18} />
          </button>
        </div>
      </>
    );
  }

  if (m.stage === "po_debate") {
    return (
      <>
        <div className="panel-head">
          <h2 className="essay-title">第 2 部分：考官追问辩论（{hasAi ? "AI 考官" : "离线预设考官 TTS"}）</h2>
          <span className="exam-clock">{clock(sectionTimerSec)}</span>
        </div>
        <ol className="exam-debate">
          {m.poTurns.slice(0, -1).map((t, idx) => (
            <li key={idx}>
              <p className="exam-q" lang="fr">
                {t.q}
              </p>
              <p className="essay-text" lang="fr">
                {t.a || "（已口头回答）"}
              </p>
              <TakePlayer take={poTurnTakes[idx]} label={`听第 ${idx + 1} 轮回答`} />
            </li>
          ))}
        </ol>
        {poAsking && <p className="muted">考官正在提问…</p>}
        {shouldShowDebateTurn1Recovery(m.poTurns.length, poAsking) && (
          <div className="exam-live">
            <p className="eyebrow">考官首问未能发出</p>
            <p className="muted">
              {poAskError ? `请求失败：${poAskError}。` : "考官暂未接上话。"}
              你可以重试提问，或直接跳过辩论批改独白。
            </p>
            <div className="writing-actions">
              <button className="btn btn-primary" disabled={poBusy} onClick={() => onAskNextExaminer(m.poTurns)}>
                重试提问
              </button>
              <button className="btn btn-ghost" disabled={poBusy} onClick={() => onFinishPoDebate(m.poTurns)}>
                {poBusy ? "正在批改独白…" : "跳过辩论，直接批改独白"}
              </button>
            </div>
          </div>
        )}
        {m.poTurns.length > 0 && !poAsking && (() => {
          const turnIdx = m.poTurns.length - 1;
          return (
            <div className={`exam-live ${poDictating || recorder.on ? "is-on" : ""}`}>
              <p className="eyebrow">考官问题 {m.poTurns.length}</p>
              <p className="exam-q" lang="fr">
                {m.poTurns[turnIdx].q}
              </p>
              {(!dictation || poDebateSpeechFailed) && (
                <p className="muted small">
                  {pron.available || sttReady
                    ? `当前使用麦克风录音 + ${pron.azureAvailable ? "Azure" : sttName()} 自动转写；点停止或下一问后自动填入。`
                    : "当前浏览器不支持语音识别：已启用本地录音，停止后可回放录音并手动补充文字。"}
                </p>
              )}
              <textarea
                ref={poDebateRef}
                className="writing-input essay-notes"
                rows={3}
                lang="fr"
                disabled={poTranscribing}
                value={m.poTurns[turnIdx].a + (poDictating ? poInterim : "")}
                onChange={(e) => update((cur) => ({ poTurns: cur.poTurns.map((t, k) => (k === cur.poTurns.length - 1 ? { ...t, a: e.target.value } : t)) }))}
                placeholder={dictation ? "开口回答或补充要点…" : "对着提问口头回答，可在此简记要点…"}
              />
              {!poTranscribing && (
                <AccentKeys
                  input={poDebateRef}
                  value={m.poTurns[turnIdx].a}
                  onChange={(v) => update((cur) => ({ poTurns: cur.poTurns.map((t, k) => (k === cur.poTurns.length - 1 ? { ...t, a: v } : t)) }))}
                />
              )}
              {poTranscribing && <p className="muted small">正在语音转写本轮回答…</p>}
              <TakePlayer take={poTurnTakes[turnIdx]} label="听这一轮录音" />
              {poAskError && <p className="muted small">追问请求失败：{poAskError}（可点击下一个考官追问重试，或直接结束辩论）</p>}
              <div className="writing-actions">
                <button className="link" onClick={() => void play(null, m.poTurns[turnIdx].q)}>
                  再听一遍问题
                </button>
                {(poDictating || recorder.on) ? (
                  <>
                    <span className="muted small">
                      <i className="rec-dot" aria-hidden="true" />
                      {poDictating ? "听写并录音中" : "录音中"}
                    </span>
                    <button className="btn btn-ghost" type="button" disabled={poTranscribing} onClick={() => onStopDebateTurn(turnIdx)}>
                      停止本轮录音
                    </button>
                  </>
                ) : (
                  recorder.supported && (
                    <button className="btn btn-ghost" type="button" disabled={poBusy || poTranscribing} onClick={() => onBeginDebateTurn(turnIdx)}>
                      <Mic size={16} /> 录音回答本轮
                    </button>
                  )
                )}
                <button className="btn btn-primary" disabled={poBusy || poTranscribing} onClick={() => onAskNextExaminer(m.poTurns)}>
                  下一个考官追问 <ArrowRight size={16} />
                </button>
                <button className="btn btn-ghost" disabled={poBusy || poTranscribing} onClick={() => onFinishPoDebate(m.poTurns)}>
                  {poBusy ? "正在批改独白…" : "结束辩论并进入评分"}
                </button>
              </div>
            </div>
          );
        })()}
      </>
    );
  }

  if (m.stage === "po_grade") {
    return (
      <>
        <h2 className="essay-title">PO 口语评分（满分 25）</h2>
        <TakePlayer take={poTalkTake} label="听自己的独白" />
        {pron.state === "done" && pron.result && <PronReport result={pron.result} />}
        {m.poFb ? (
          <>
            <Marking fb={m.poFb} pointTitle={pointTitle} extra={{ key: "phono", score: m.poPhono }} />
            <div className="essay-box">
              <p className="eyebrow">
                第五项：发音和语调（{pron.state === "done" && pron.result && phonoLevel(pron.result) !== null ? "已由声学语音评测锁定" : "未运行音素评测，请选择 0–5 档计入 /25 总分"}）
              </p>
              <div className="segmented">
                {LEVELS.map((v) => {
                  const lockedByVoice = pron.state === "done" && pron.result !== null && phonoLevel(pron.result) !== null;
                  return (
                    <button key={v} disabled={lockedByVoice} className={m.poPhono === v ? "is-on" : ""} onClick={() => !lockedByVoice && update({ poPhono: v })}>
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            {poPreset && (
              <div className="essay-box">
                <p className="eyebrow">参考核心问题与纲要（待核对）</p>
                <p lang="fr">
                  <b>Problématique :</b> {poPreset.problematique}
                </p>
                <ol className="essay-plan">
                  {poPreset.outline.map((o, i) => (
                    <li key={i}>
                      <b>{o.zh}</b>
                      <span lang="fr">{o.fr}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <div className="essay-box">
              <p className="eyebrow">
                官方五项口语自评（{rubricComplete(m.poSelf, [...SPEAK_CRITERIA, "phono"]) ? `当前合计：${rubricSum(m.poSelf, [...SPEAK_CRITERIA, "phono"])}/25` : "请先逐项选择 0–5"}）
              </p>
              {[...SPEAK_CRITERIA, "phono"].map((c) => (
                <div key={c} className="mock-rubric-row">
                  <div>
                    <b>{CRITERION_LABEL[c]}</b>
                    <p className="muted small">{CRITERION_CHECK[c]}</p>
                  </div>
                  <div className="segmented">
                    {LEVELS.map((v) => (
                      <button key={v} className={m.poSelf[c] === v ? "is-on" : ""} onClick={() => update({ poSelf: { ...m.poSelf, [c]: v } })}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="writing-actions">
          <button
            className="btn btn-primary btn-xl"
            disabled={m.poFb ? m.poPhono === null : !rubricComplete(m.poSelf, [...SPEAK_CRITERIA, "phono"])}
            onClick={onConfirmPoScore}
          >
            完成口语并查看四项 /100 总成绩单 <ArrowRight size={18} />
          </button>
        </div>
      </>
    );
  }

  return null;
}
