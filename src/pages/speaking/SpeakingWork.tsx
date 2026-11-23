import { ArrowRight, Mic, Square } from "lucide-react";
import { useMemo, useRef, type MutableRefObject } from "react";
import { canAssess } from "../../ai/pronunciation";
import { CONNECTORS, CRITERION_CHECK, CRITERION_LABEL, MAX_SPEAKING_MONOLOGUE_LENGTH } from "../../lib/essay";
import {
  assessDebateEscalation,
  checkProblematiqueDraft,
  clock,
  PROBLEMATIQUE_TIPS,
  SPEAK_TIMES,
  TALK_PLAN,
  type DebateTurn,
  type SpeakingSubject,
  type Topic,
} from "../../lib/exam";
import type { SpeakingSession } from "../../lib/exam-schema";
import { debatePhrases } from "../../lib/expressions";
import type { PronResult } from "../../lib/pronunciation";
import type { Take } from "../../lib/recorder";
import type { speakingPresetOf } from "../../lib/speaking-presets";
import type { useTimer } from "../../lib/timer";
import { AccentKeys } from "../../ui/AccentKeys";
import { ArgumentsDrawer } from "../../ui/ArgumentsDrawer";
import {
  AssessedTranscript,
  AssessHint,
  AssessStatus,
  PronReport,
  TakePlayer,
  type useAssess,
  type useRecorder,
} from "../../ui/Recording";
import {
  MAX_STRICT_CUE_WORDS,
  MAX_STRICT_CUES,
  MONOLOGUE_WARN_SEC,
  toStrictCueCards,
  type Phase,
} from "./helpers";

function PastDebateTurn({
  index,
  turn,
  take,
  pron,
}: {
  index: number;
  turn: DebateTurn;
  take?: Take;
  pron?: PronResult;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  return (
    <li>
      <p className="exam-q" lang="fr">
        {turn.q}
      </p>
      {pron && pron.words.length > 0 ? (
        <AssessedTranscript result={pron} audioRef={take ? audioRef : undefined} compact />
      ) : (
        <p className="essay-text" lang="fr">
          {turn.a || "（没有回答）"}
        </p>
      )}
      <TakePlayer take={take} label={`听第 ${index + 1} 轮回答`} audioRef={audioRef} />
    </li>
  );
}

export interface SpeakingWorkProps {
  phase: Phase;
  subject: SpeakingSubject;
  topic: Topic | undefined;
  preset: ReturnType<typeof speakingPresetOf>;
  strictMode: boolean;
  noAuxMode: boolean;
  hasAi: boolean;
  sttReady: boolean;
  dictation: boolean;
  listening: boolean;
  interim: string;
  speechFailed: boolean;
  transcribing: boolean;
  talkSec: number;
  cutoffNotice: string | null;
  vadAutoEnd: boolean;
  setVadAutoEnd: (v: boolean) => void;
  notes: string;
  setNotes: (v: string | ((prev: string) => string)) => void;
  notesRef: MutableRefObject<HTMLTextAreaElement | null>;
  retellBase: SpeakingSession | null;
  probDraft: string;
  setProbDraft: (v: string) => void;
  probChecked: { ok: boolean; notes: string[] } | null;
  setProbChecked: (v: { ok: boolean; notes: string[] } | null) => void;
  micro: ReturnType<typeof useTimer>;
  debate: ReturnType<typeof useTimer>;
  recorder: ReturnType<typeof useRecorder>;
  pron: ReturnType<typeof useAssess>;
  said: string;
  setSaid: (v: string) => void;
  saidRef: MutableRefObject<HTMLTextAreaElement | null>;
  words: number;
  spoke: number;
  talkTake: Take | null;
  rawMonologue: string;
  gradedLock: boolean;
  turns: DebateTurn[];
  turnTakes: Record<number, Take>;
  turnProns: Record<number, PronResult>;
  rawTurns: Record<number, string>;
  asking: boolean;
  askError: string | null;
  voiceOffset: number;
  debateInputRef: MutableRefObject<HTMLTextAreaElement | null>;
  canEndDebate: boolean;
  answeredTurns: number;
  allPresetAsked: boolean;
  maxTurns: number;
  onStartTalk: () => void;
  onEndTalk: () => void;
  onStartDebate: () => void;
  onEnterOfflineResult: () => void;
  onAssess: (turns: DebateTurn[]) => void;
  onAsk: (turns: DebateTurn[]) => void;
  onSetAnswer: (v: string) => void;
  onReplayQuestion: (q: string, turnIdx: number) => void;
  onBeginDebateAnswer: (turnIdx: number, existingText: string) => void;
  onStopDebateAnswer: (turnIdx: number) => Promise<DebateTurn[]>;
  onAdvanceDebateTurn: (turnIdx: number) => void;
  onFinishDebate: (turnIdx: number) => void;
  onCancelGrading: () => void;
}

export function SpeakingWork({
  phase,
  subject,
  topic,
  preset,
  strictMode,
  noAuxMode,
  hasAi,
  sttReady,
  dictation,
  listening,
  interim,
  speechFailed,
  transcribing,
  talkSec,
  cutoffNotice,
  vadAutoEnd,
  setVadAutoEnd,
  notes,
  setNotes,
  notesRef,
  retellBase,
  probDraft,
  setProbDraft,
  probChecked,
  setProbChecked,
  micro,
  debate,
  recorder,
  pron,
  said,
  setSaid,
  saidRef,
  words,
  spoke,
  talkTake,
  rawMonologue,
  gradedLock,
  turns,
  turnTakes,
  turnProns,
  rawTurns,
  asking,
  askError,
  voiceOffset,
  debateInputRef,
  canEndDebate,
  answeredTurns,
  allPresetAsked,
  maxTurns,
  onStartTalk,
  onEndTalk,
  onStartDebate,
  onEnterOfflineResult,
  onAssess,
  onAsk,
  onSetAnswer,
  onReplayQuestion,
  onBeginDebateAnswer,
  onStopDebateAnswer,
  onAdvanceDebateTurn,
  onFinishDebate,
  onCancelGrading,
}: SpeakingWorkProps) {
  const debatePhraseGroups = useMemo(() => debatePhrases(), []);
  const strictCues = useMemo(() => toStrictCueCards(notes), [notes]);
  const reviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentTurnAudioRef = useRef<HTMLAudioElement | null>(null);
  const turn = turns[turns.length - 1];
  const escalation = assessDebateEscalation(turns, Math.floor(debate.sec / 60), strictMode);
  const cueOnlyMode = strictMode || noAuxMode;

  if (phase === "prep") {
    return (
      <>
        {!strictMode && !noAuxMode && (
          <div className="essay-box">
            <p className="eyebrow">1 分钟审题微训 · 提炼 problématique（核心矛盾）</p>
            <ol className="essay-check">
              {PROBLEMATIQUE_TIPS.map((tip, k) => (
                <li key={k}>{tip}</li>
              ))}
            </ol>
            <div className="writing-actions">
              <button className="btn btn-ghost" type="button" onClick={() => micro.start(60)}>
                {micro.running ? `微训倒计时 ${clock(micro.sec)}` : micro.sec === 0 && probDraft ? "重新计时 1:00" : "开始 1 分钟提炼计时"}
              </button>
              {micro.running && <span className={`exam-clock ${micro.sec <= 10 ? "is-over" : ""}`}>{clock(micro.sec)}</span>}
            </div>
            <input
              className="writing-input"
              lang="fr"
              value={probDraft}
              onChange={(e) => {
                setProbDraft(e.target.value);
                setProbChecked(null);
              }}
              placeholder="试着不用原句，写出一句法语 problématique（例如：Comment concilier… ?）"
              spellCheck={false}
              aria-label="problématique 提炼"
            />
            <div className="writing-actions">
              <button className="btn btn-ghost" type="button" disabled={!probDraft.trim()} onClick={() => setProbChecked(checkProblematiqueDraft(probDraft, subject.doc))}>
                检查提炼是否合格
              </button>
              <button
                className="link"
                type="button"
                disabled={!probDraft.trim()}
                onClick={() => setNotes((n) => (n.trim() ? `${probDraft.trim()}\n\n${n}` : probDraft.trim()))}
              >
                填入准备笔记
              </button>
            </div>
            {probChecked && (
              <p className="muted small">
                {probChecked.ok ? "提炼清晰：包含了开放性问题且避免直接照抄原文。" : probChecked.notes.join(" ")}
              </p>
            )}
          </div>
        )}
        {!noAuxMode ? (
          <div className="essay-help">
            <details open={!strictMode}>
              <summary>怎么组织这段话</summary>
              <ol className="essay-plan">
                {TALK_PLAN.map((p, k) => (
                  <li key={k}>
                    <b>{p.zh}</b>
                    <span lang="fr">{p.fr}</span>
                  </li>
                ))}
              </ol>
            </details>
            <details>
              <summary>评分表看什么</summary>
              <ul className="essay-check essay-box-list">
                {["monologue", "interaction", "lexique", "morpho", "phono"].map((c) => (
                  <li key={c}>
                    <b>{CRITERION_LABEL[c]}</b> {CRITERION_CHECK[c]}
                  </li>
                ))}
              </ul>
            </details>
            {!strictMode && topic && (
              <details>
                <summary>话题词汇：{topic.zh}</summary>
                <ul className="essay-phrases">
                  {topic.vocab.map(([fr, zh], k) => (
                    <li key={k}>
                      <span lang="fr">{fr}</span>
                      <small>{zh}</small>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {!strictMode && (
              <details>
                <summary>衔接语</summary>
                <dl className="essay-links">
                  {CONNECTORS.map((g) => (
                    <div key={g.zh}>
                      <dt>{g.zh}</dt>
                      <dd lang="fr">{g.fr.join(" · ")}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
            {!strictMode && <ArgumentsDrawer topic={subject.topic} />}
          </div>
        ) : (
          <p className="muted small">脱稿无辅助模式已开启：准备期已隐藏模板、评分提示、话题词汇与衔接语，发言期仅保留 ≤8×3 词提纲卡。</p>
        )}
        <textarea
          ref={notesRef}
          className="writing-input essay-notes"
          lang="fr"
          rows={6}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={
            cueOnlyMode
              ? "每行写 1–3 个法语关键词（最多保留 8 行 × 每行 3 词作为发言提纲卡，严禁写整句念稿）"
              : "准备时记关键词和提纲（考试时可以看笔记，但不能念稿）"
          }
          spellCheck={false}
          aria-label="准备笔记"
        />
        {cueOnlyMode && notes.trim() && (
          <div className="essay-box">
            <p className="eyebrow">
              发言期可见提纲卡预览（已提取 {strictCues.length}/{MAX_STRICT_CUES} 张 · 每张最多 {MAX_STRICT_CUE_WORDS} 词）
            </p>
            <ul className="speak-cue-grid">
              {strictCues.map((cue, k) => (
                <li key={k} lang="fr">
                  {cue}
                </li>
              ))}
            </ul>
          </div>
        )}
        {retellBase && (
          <details className="essay-help">
            <summary>同题二稿对比底稿：查看上一稿（{retellBase.monologueWords} 词 · {clock(retellBase.monologueSec)} · {retellBase.total25 ?? "未评"}/25）</summary>
            {retellBase.transcript && <p className="essay-text small" lang="fr">{retellBase.transcript}</p>}
          </details>
        )}
        <AccentKeys input={notesRef} value={notes} onChange={setNotes} />
        <div className="writing-actions">
          <button className="btn btn-primary btn-xl" onClick={onStartTalk}>
            <Mic size={18} /> {strictMode ? "开始陈述（结束后直入辩论）" : "准备好了，开始说"}
          </button>
        </div>
      </>
    );
  }

  if (phase === "talk") {
    return (
      <>
        {talkSec >= MONOLOGUE_WARN_SEC && (
          <div className="speak-cutoff-banner" role="status">
            <p>
              <b>6:30 收束提醒：</b>
              {strictMode
                ? "请立即收尾总结并开启辩论引子；7:15 考官将按真实考场规则礼貌打断并直接进入辩论。"
                : "已满 6 分半钟，建议在 7:00 内自然收尾。"}
            </p>
          </div>
        )}
        {notes.trim() && (
          cueOnlyMode ? (
            <div className="essay-box">
              <p className="eyebrow">
                考场提纲卡（最多 {MAX_STRICT_CUES}×{MAX_STRICT_CUE_WORDS} 词 · 已隐藏完整草稿防念稿）
              </p>
              <ul className="speak-cue-grid">
                {strictCues.map((cue, k) => (
                  <li key={k} lang="fr">
                    {cue}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="essay-box">
              <p className="eyebrow">你的笔记（仅作提纲参考，请勿照念整句）</p>
              <p className="essay-text">{notes}</p>
            </div>
          )
        )}
        {dictation ? (
          <div className={`exam-live ${listening ? "is-on" : ""}`} aria-live="polite">
            <p className="eyebrow">
              {listening ? "实时参考字幕（录音结束后将由高保真语音转写覆盖）" : "实时字幕已暂停（录音仍在继续）"}
            </p>
            <p className="essay-text" lang="fr">
              {said}
              <i>{interim}</i>
              {!said && !interim && <span className="muted">开口说法语，这里会显示实时参考字幕。</span>}
            </p>
          </div>
        ) : (
          <p className="muted">
            {strictMode
              ? "对着麦克风连续陈述 5–7 分钟，说完立即无缝进入考官辩论。"
              : "对着计时说 5–7 分钟，说完点下面的按钮进入复盘或辩论。"}
          </p>
        )}
        <div className="writing-actions">
          <span className="essay-count">{words} 词</span>
          {recorder.on && (
            <span className="muted small">
              <i className="rec-dot" aria-hidden="true" />
              录音中
            </span>
          )}
          <button className="btn btn-primary btn-xl" onClick={onEndTalk}>
            <Square size={16} /> {strictMode ? "陈述完毕，直接进入辩论" : "说完了"}
          </button>
        </div>
      </>
    );
  }

  if (phase === "review") {
    const monoLocked = strictMode || (noAuxMode && (gradedLock || !!rawMonologue.trim()));
    return (
      <>
        <p className="muted">
          {spoke > 0 ? `说了 ${clock(spoke)}。` : ""}
          {monoLocked
            ? "当前模式已锁定原始语音转写：禁止在评审前通过键盘修改独白原文。"
            : dictation
              ? "已优先采用语音引擎原话转写；若有专有名词误听可微调，但不要润色语法，以免失真。"
              : "请把刚才说的独白内容完整打出来，或配置 Azure / Whisper 自动转写。"}
        </p>
        <TakePlayer take={talkTake} label="听自己的独白" audioRef={reviewAudioRef} />
        {transcribing && <p className="muted small">正在进行 Whisper 原话语音转写…</p>}
        {talkTake && (pron.available ? <AssessStatus a={pron} /> : <AssessHint />)}
        {pron.state === "done" && pron.result && (
          <PronReport result={pron.result} audioRef={talkTake ? reviewAudioRef : undefined} />
        )}
        <textarea
          ref={saidRef}
          className="writing-input essay-input"
          lang="fr"
          rows={10}
          maxLength={MAX_SPEAKING_MONOLOGUE_LENGTH}
          value={said}
          readOnly={monoLocked}
          onChange={(e) => {
            if (!monoLocked) setSaid(e.target.value.slice(0, MAX_SPEAKING_MONOLOGUE_LENGTH));
          }}
          placeholder="你说的内容"
          spellCheck={false}
          aria-label="你说的内容"
        />
        {!monoLocked && <AccentKeys input={saidRef} value={said} onChange={(v) => setSaid(v.slice(0, MAX_SPEAKING_MONOLOGUE_LENGTH))} />}
        <div className="writing-actions">
          <span className={`essay-count ${words >= 450 ? "is-ok" : ""}`}>
            {words} 词 · 5 分钟大约 450 词以上
            {said.length >= MAX_SPEAKING_MONOLOGUE_LENGTH ? ` · 已达 ${MAX_SPEAKING_MONOLOGUE_LENGTH} 字符上限` : ""}
          </span>
          {hasAi ? (
            <>
              {!strictMode && !noAuxMode ? (
                <button className="btn btn-ghost" onClick={() => onAssess([])} disabled={!said.trim() || gradedLock}>
                  跳过辩论，直接批改
                </button>
              ) : (
                <span className="muted small">{strictMode ? "全真考场模式不可跳过辩论" : "脱稿无辅助模式中请完整完成辩论"}</span>
              )}
              <button className="btn btn-primary btn-xl" onClick={onStartDebate} disabled={!said.trim()}>
                进入辩论 <ArrowRight size={18} />
              </button>
            </>
          ) : preset?.followUps.length ? (
            <>
              {!strictMode && !noAuxMode && (
                <button className="btn btn-ghost" onClick={onEnterOfflineResult}>
                  跳过辩论，直接参考纲要自评
                </button>
              )}
              <button className="btn btn-primary btn-xl" onClick={onStartDebate}>
                进入预设考官辩论（{preset.followUps.length} 问） <ArrowRight size={18} />
              </button>
            </>
          ) : (
            <button className="btn btn-primary btn-xl" onClick={onEnterOfflineResult}>
              查看参考纲要并五项自评 <ArrowRight size={18} />
            </button>
          )}
        </div>
      </>
    );
  }

  if (phase === "debate") {
    return (
      <>
        {cutoffNotice && (
          <div className="speak-cutoff-banner" role="status">
            <p lang="fr">
              <b>Examinateur :</b> « {cutoffNotice} »
            </p>
            <p className="muted small">独白已达 7:15 上限，考官已按真实 DELF B2 考场规程礼貌打断并切入辩论。</p>
          </div>
        )}
        {strictMode && pron.state === "busy" && (
          <p className="muted small">后台正在并发评估你的独白语音，不影响当前辩论对答…</p>
        )}
        <div className="writing-actions">
          <label className="vad-toggle-bar">
            <input
              type="checkbox"
              checked={vadAutoEnd}
              onChange={(e) => setVadAutoEnd(e.target.checked)}
            />
            <span>开口后停顿 2.2 秒自动切入考官下一问（VAD 免按键对答）</span>
          </label>
        </div>
        <ol className="exam-debate">
          {turns.slice(0, -1).map((t, k) => (
            <PastDebateTurn key={k} index={k} turn={t} take={turnTakes[k]} pron={turnProns[k]} />
          ))}
        </ol>
        {asking && <p className="muted">考官在想下一个问题…</p>}
        {!asking && turns.length === 0 && (
          <div className="essay-box">
            <p className="eyebrow">考官提问暂未成功</p>
            <p className="muted small">{askError || "考官第 1 问请求失败，你可以重试提问或跳过辩论直接批改独白。"}</p>
            <div className="writing-actions">
              <button className="btn btn-primary" onClick={() => onAsk([])}>
                重试提问
              </button>
              {!strictMode && (
                <button className="btn btn-ghost" disabled={!said.trim() || gradedLock} onClick={() => onAssess([])}>
                  跳过辩论，直接批改独白
                </button>
              )}
            </div>
          </div>
        )}
        {turn && !asking && (() => {
          const turnIdx = turns.length - 1;
          const curTake = turnTakes[turnIdx];
          const azureOn = canAssess();
          const turnLocked = strictMode || (noAuxMode && (gradedLock || !!rawTurns[turnIdx]?.trim()));
          return (
            <div className={`exam-live ${listening || recorder.on ? "is-on" : ""}`} aria-live="polite">
              <p className="eyebrow">
                {hasAi
                  ? `考官 ${((Math.max(0, turnIdx) + voiceOffset) % 2) + 1} 问`
                  : `预设考官追问 ${turnIdx + 1}/${preset?.followUps.length ?? turns.length}`}
                {escalation.level >= 2 ? ` · 追问升级 L${escalation.level}` : ""}
                {!hasAi && !strictMode && !noAuxMode && preset?.followUps[turnIdx] ? ` · ${preset.followUps[turnIdx].intentZh}` : ""}
              </p>
              <p className="exam-q" lang="fr">
                {turn.q}
              </p>
              {(!dictation || speechFailed) && (
                <p className="muted small">
                  {azureOn || sttReady
                    ? `当前使用麦克风录音 + ${azureOn ? "Azure" : "Whisper"} 原话自动转写；停止录音后将自动填入文字。`
                    : "当前浏览器离线或不支持语音识别：已启用本地录音兜底，停止后可回放录音并对照补全文字。"}
                </p>
              )}
              <textarea
                ref={debateInputRef}
                className="writing-input essay-notes"
                lang="fr"
                rows={4}
                value={turn.a + (listening ? interim : "")}
                readOnly={listening || transcribing || turnLocked}
                onChange={(e) => onSetAnswer(e.target.value)}
                placeholder={
                  strictMode
                    ? "全真考场模式：请直接开口回答（键盘输入已锁定）"
                    : dictation && !speechFailed
                      ? "点「开口回答」，或直接打字"
                      : recorder.supported
                        ? "用麦克风录音回答，或直接打字"
                        : "把你的回答打出来"
                }
                spellCheck={false}
                aria-label="你的回答"
              />
              {!listening && !transcribing && !turnLocked && <AccentKeys input={debateInputRef} value={turn.a} onChange={onSetAnswer} />}
              {turnLocked && (
                <p className="muted small">
                  {strictMode ? "全真考场模式已锁定键盘编辑，仅保留真实口语转写。" : "脱稿无辅助模式已锁定本轮原始语音转写。"}
                </p>
              )}
              {transcribing && <p className="muted small">正在进行高保真语音转写…</p>}
              {turnProns[turnIdx] && (
                <p className="muted small">
                  已通过 {turnProns[turnIdx].phonemeSupported === false ? "Whisper" : "Azure"} 完成本轮原话校准与声学分析。
                </p>
              )}
              <TakePlayer take={curTake} label="听这一轮录音" audioRef={currentTurnAudioRef} />
              {askError && <p className="warn-text">{askError}</p>}
              <div className="writing-actions">
                <button
                  className="link"
                  onClick={() => {
                    void onStopDebateAnswer(turnIdx);
                    onReplayQuestion(turn.q, Math.max(0, turnIdx));
                  }}
                >
                  再听一遍问题
                </button>
                {(listening || recorder.on) ? (
                  <>
                    <span className="muted small">
                      <i className="rec-dot" aria-hidden="true" />
                      {listening ? "正在录音并生成参考字幕" : "录音中"}
                      {vadAutoEnd ? " · VAD 自动切轮开启" : ""}
                    </span>
                    <button className="btn btn-ghost" onClick={() => void onStopDebateAnswer(turnIdx)} disabled={transcribing}>
                      <Square size={15} /> {(azureOn || sttReady) && (!dictation || speechFailed) ? "停止并转写" : "停止录音"}
                    </button>
                  </>
                ) : (
                  (dictation || recorder.supported) && (
                    <button
                      className="btn btn-ghost"
                      disabled={transcribing}
                      onClick={() => onBeginDebateAnswer(turnIdx, turn.a)}
                    >
                      <Mic size={16} /> {turn.a ? "接着说" : !dictation || speechFailed ? "录音回答" : "开口回答"}
                    </button>
                  )
                )}
                {debate.sec < SPEAK_TIMES.debate[1] && turns.length < maxTurns && !allPresetAsked ? (
                  <button
                    className="btn btn-primary"
                    disabled={transcribing || (hasAi && !turn.a.trim() && !interim && !recorder.on && !curTake)}
                    onClick={() => onAdvanceDebateTurn(turnIdx)}
                  >
                    答完了，下一个问题 <ArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    disabled={transcribing || gradedLock}
                    onClick={() => onFinishDebate(turnIdx)}
                  >
                    {hasAi ? (allPresetAsked ? "完成辩论并批改" : "时间到，结束辩论并批改") : "完成辩论，进入自评"} <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </div>
          );
        })()}
        {!asking && turns.length > 0 && debate.sec < SPEAK_TIMES.debate[1] && (
          <div className="writing-actions">
            <span className="muted small">
              {!canEndDebate
                ? `全真考场模式：需满 10:00 或完成至少 6 轮有效回答才可交卷（已答 ${answeredTurns}/6 轮）`
                : debate.sec < SPEAK_TIMES.debate[0]
                  ? "考官会一直追问到你结束为止；考试里这一段有 10–13 分钟，尽量撑到 10 分钟。"
                  : "已经到 10 分钟，可以结束了。"}
            </span>
            <button
              className="link"
              disabled={!canEndDebate || transcribing || gradedLock}
              onClick={() => onFinishDebate(turns.length - 1)}
            >
              {hasAi ? "结束辩论，批改" : "结束辩论，进入自评"}
            </button>
          </div>
        )}
        {!strictMode && !noAuxMode ? (
          <details className="essay-fold">
            <summary>辩论话术速查（反驳 / 让步 / 澄清 / 填充语，{debatePhraseGroups.reduce((n, [, xs]) => n + xs.length, 0)} 句）</summary>
            {debatePhraseGroups.map(([fn, xs]) => (
              <div key={fn} className="essay-box">
                <p className="eyebrow">{fn}</p>
                <ul className="essay-phrases">
                  {xs.map((e) => (
                    <li key={e.id}>
                      <span lang="fr">{e.fr}</span>
                      <small>{e.zh}</small>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </details>
        ) : (
          <p className="muted small">{strictMode ? "全真考场模式已隐藏辩论话术速查。" : "脱稿无辅助模式已隐藏辩论话术速查。"}</p>
        )}
      </>
    );
  }

  if (phase === "grading") {
    return (
      <div className="writing-actions">
        <p className="muted">AI 正在结合原话转写与声学指标批改（约 20–60 秒）…</p>
        <button className="btn btn-ghost" onClick={onCancelGrading}>
          取消
        </button>
      </div>
    );
  }

  return null;
}
