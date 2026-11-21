import { ArrowLeft, ArrowRight, Mic, Shuffle, Sparkles, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ready, useAiConfig, type AiConfig } from "../ai/config";
import { debateQuestion, gradeSpeaking, makeSubject } from "../ai/tasks";
import { ttsOn, ttsUrl } from "../ai/tts";
import { useGrammar } from "../atlas/grammar";
import { TARGET_LANG } from "../config";
import { play, stopAudio } from "../lib/audio";
import { CONNECTORS, countWords, CRITERION_CHECK, CRITERION_LABEL, LEVEL_LABEL, LEVELS, totalScore } from "../lib/essay";
import { assessDebateEscalation, clock, outOf25, PO_STANDARD_CONSIGNE, SPEAK_TIMES, SPEAKING_SUBJECTS, TALK_PLAN, TOPICS, topicOf, type DebateTurn, type SpeakingFeedback, type SpeakingSubject } from "../lib/exam";
import { isNative } from "../lib/native";
import { href } from "../lib/router";
import { duck } from "../lib/sound";
import { canDictate, dictate, pickBrowserFrenchVoice, pickExaminerVoice } from "../lib/speech";
import { useTimer } from "../lib/timer";
import { logExam } from "../store/essays";
import { useStore } from "../store/store";
import { Marking } from "../ui/Marking";
import { phonoLevel } from "../lib/pronunciation";
import type { Take } from "../lib/recorder";
import { AssessHint, AssessStatus, PronReport, TakePlayer, useAssess, useRecorder } from "../ui/Recording";
import { toast } from "../ui/Toast";

const day = (ms: number) => new Date(ms).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
const two = <T,>(xs: T[]) => [...xs].sort(() => Math.random() - 0.5).slice(0, 2);

/** Read an examiner turn aloud, rotating among multiple French voices (Azure fr-FR or browser French voices). */
async function speakExaminer(text: string, turnIndex: number, offset: number, aiConfig: AiConfig, signal?: AbortSignal): Promise<"recorded" | "device" | "stopped" | "unsupported"> {
  if (signal?.aborted) return "stopped";
  const second = turnIndex % 2 === 1;
  if (ttsOn()) {
    const voice = pickExaminerVoice(turnIndex, offset, { female: aiConfig.azureVoice, male: aiConfig.azureVoiceMale });
    const src = await ttsUrl(text, voice).catch(() => null);
    if (signal?.aborted) return "stopped";
    return play(src, text, second ? "us" : "uk", 1, second);
  }
  if (!isNative() && typeof window !== "undefined" && "speechSynthesis" in window) {
    stopAudio();
    duck(true);
    try {
      const u = new SpeechSynthesisUtterance(text);
      const { voice, pitch } = pickBrowserFrenchVoice(window.speechSynthesis.getVoices(), turnIndex, offset);
      u.lang = TARGET_LANG;
      u.rate = 0.95;
      u.pitch = pitch;
      if (voice) u.voice = voice;
      return await new Promise<"device" | "stopped">((resolve) => {
        let settled = false;
        const finish = (res: "device" | "stopped") => {
          if (settled) return;
          settled = true;
          signal?.removeEventListener("abort", onAbort);
          resolve(res);
        };
        const onAbort = () => {
          stopAudio();
          finish("stopped");
        };
        signal?.addEventListener("abort", onAbort, { once: true });
        u.onend = () => finish(signal?.aborted ? "stopped" : "device");
        u.onerror = (e) => {
          const err = (e as SpeechSynthesisErrorEvent).error;
          finish(signal?.aborted || err === "interrupted" || err === "canceled" ? "stopped" : "device");
        };
        window.speechSynthesis.speak(u);
      });
    } finally {
      duck(false);
    }
  }
  return play(null, text, second ? "us" : "uk", 1, second);
}

type Phase = "pick" | "drawing" | "choose" | "prep" | "talk" | "review" | "debate" | "grading" | "result";

/**
 * 口语, in the form of the exam: draw two subjects and keep one, 30 minutes to prepare, a talk of 5 to 7 minutes
 * defending a point of view, then a debate in which the AI plays the examiner. The browser turns speech into
 * text and the talk is recorded (kept in memory for playback); the AI marks the transcripts on four criteria of
 * the official grid. The fifth, pronunciation, comes from Azure's pronunciation assessment of the recording when
 * it is set up; otherwise the learner rates it against the grid's descriptors.
 */
export function SpeakingStudio({ onExit }: { onExit: () => void }) {
  const ai = useAiConfig();
  const { data: grammar } = useGrammar();
  const log = (useStore((s) => s.progress.examLog) ?? []).filter((r) => r.part === "speak");
  const [phase, setPhase] = useState<Phase>("pick");
  const [drawn, setDrawn] = useState<SpeakingSubject[]>([]);
  const [subject, setSubject] = useState<SpeakingSubject | null>(null);
  const [notes, setNotes] = useState("");
  const [said, setSaid] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [spoke, setSpoke] = useState(0);
  const [turns, setTurns] = useState<DebateTurn[]>([]);
  const [asking, setAsking] = useState(false);
  const [fb, setFb] = useState<SpeakingFeedback | null>(null);
  const [phono, setPhono] = useState<number | null>(null);
  const [talkTake, setTalkTake] = useState<Take | null>(null);
  const [strictMode, setStrictMode] = useState(false);
  const [voiceOffset, setVoiceOffset] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [prepExpired, setPrepExpired] = useState(false);
  const recorder = useRecorder();
  const pron = useAssess();
  const stopRec = useRef<(() => void) | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const prep = useTimer();
  const talk = useTimer();
  const debate = useTimer();
  const MAX_TURNS = 20;
  const dictation = canDictate();
  const hasAi = ready.text(ai);
  const pointTitle = useMemo(() => new Map((grammar?.points ?? []).map((p) => [p.id, p.title])), [grammar]);
  const points = () => (grammar?.points ?? []).map((p) => ({ id: p.id, title: p.title }));

  const quiet = () => {
    stopRec.current?.();
    stopRec.current = null;
    stopAudio();
  };
  useEffect(
    () => () => {
      stopRec.current?.();
      ctrl.current?.abort();
      stopAudio();
    },
    [],
  );
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [phase]);
  useEffect(() => {
    if (phase === "prep" && prep.sec === 0 && !prep.running) setPrepExpired(true);
  }, [phase, prep.sec, prep.running]);

  /** Turn speech into text, appended to what `into` already holds. */
  const hear = (into: (text: string) => void, start = "") => {
    setListening(true);
    stopRec.current = dictate(
      (final, guess) => {
        into(start + final);
        setInterim(guess);
      },
      (error) => {
        setListening(false);
        setInterim("");
        if (error) toast(error, "warn");
      },
    );
  };

  const draw = async (fromAi: boolean) => {
    if (!fromAi) {
      setDrawn(two(SPEAKING_SUBJECTS));
      return setPhase("choose");
    }
    const c = new AbortController();
    ctrl.current = c;
    setPhase("drawing");
    try {
      const made = await Promise.all(two(TOPICS).map((t) => makeSubject(t, c.signal)));
      if (c.signal.aborted) return;
      setDrawn(made);
      setPhase("choose");
    } catch (err) {
      if (c.signal.aborted) return;
      toast((err as Error).message || "出题失败", "warn");
      setPhase("pick");
    }
  };

  const choose = (s: SpeakingSubject) => {
    setSubject(s);
    setNotes("");
    setSaid("");
    setInterim("");
    setTurns([]);
    setFb(null);
    setPhono(null);
    setTalkTake(null);
    setVoiceOffset(Math.floor(Math.random() * 12));
    setShowHint(false);
    setPrepExpired(false);
    pron.reset();
    setSpoke(0);
    setPhase("prep");
    prep.start(SPEAK_TIMES.prep);
  };

  const startTalk = async () => {
    prep.stop();
    setPhase("talk");
    // the recording first (it asks for the microphone), then start the stopwatch unconditionally and the recogniser alongside it
    if (recorder.supported) await recorder.start();
    talk.start();
    if (!dictation) return;
    hear(setSaid);
  };

  const endTalk = async () => {
    quiet();
    talk.stop();
    setSpoke(talk.sec);
    setPhase("review");
    const t = await recorder.stop();
    setTalkTake(t);
    if (!t || !pron.available) return;
    const r = await pron.run(t.blob);
    // no recogniser in this browser (Safari on iOS, the app): Azure's transcript stands in for the AI marking
    if (r?.text) setSaid((s) => (s.trim() ? s : r.text));
  };

  /** Ask the examiner's next question and read it aloud. */
  const ask = async (so: DebateTurn[]) => {
    if (!subject) return;
    const c = new AbortController();
    ctrl.current = c;
    setAsking(true);
    try {
      const q = await debateQuestion({ subject, monologue: said, turns: so, minutes: Math.floor(debate.sec / 60), strict: strictMode }, c.signal);
      if (c.signal.aborted) return;
      setTurns([...so, { q, a: "" }]);
      setAsking(false);
      const r = await speakExaminer(q, so.length, voiceOffset, ai, c.signal);
      // as in the room: the examiner stops, the candidate answers
      if (r !== "stopped" && dictation && !stopRec.current && !c.signal.aborted) hear(setAnswer);
    } catch (err) {
      if (c.signal.aborted) return;
      setAsking(false);
      toast((err as Error).message || "考官没有接上话", "warn");
    }
  };

  const startDebate = () => {
    setPhase("debate");
    debate.start();
    void ask([]);
  };

  const setAnswer = (a: string) => setTurns((ts) => ts.map((t, k) => (k === ts.length - 1 ? { ...t, a } : t)));

  const assess = async (so: DebateTurn[]) => {
    if (!subject || !said.trim()) return;
    quiet();
    debate.stop();
    const c = new AbortController();
    ctrl.current = c;
    setPhase("grading");
    try {
      const r = await gradeSpeaking({ subject, transcript: said, turns: so.filter((t) => t.a.trim()), points: points() }, c.signal);
      if (c.signal.aborted) return;
      setFb(r);
      logExam({ part: "speak", what: subject.id.startsWith("ai-") ? subject.topic : subject.id, score: totalScore(r), total: 20 });
      setPhase("result");
    } catch (err) {
      if (c.signal.aborted) return;
      toast((err as Error).message || "批改失败", "warn");
      setPhase(so.length ? "debate" : "review");
    }
  };

  const leave = () => {
    quiet();
    void recorder.stop();
    pron.reset();
    ctrl.current?.abort();
    prep.stop();
    talk.stop();
    debate.stop();
    setAsking(false);
    setPhase("pick");
  };

  if (phase === "pick" || phase === "drawing" || phase === "choose" || !subject) {
    return (
      <div className="page practice">
        <header className="page-head">
          <button className="link deck-back" onClick={onExit}>
            <ArrowLeft size={16} /> 返回练习
          </button>
          <p className="eyebrow">口语 · Production orale</p>
          <h1 className="display">想清楚，再开口。</h1>
          <p className="lede">和考试一样：抽两个题选一个，准备 30 分钟，先连续说 5–7 分钟（指出材料提出的问题，表明并论证自己的看法），再和考官辩论 10–13 分钟。这里由 AI 扮考官：它把问题说出来，你开口回答，它接着你的话追问，直到你结束。</p>
          <p className="muted">
            批改用官方评分表：独白、互动、词汇、语法由 AI 根据文字打分（每项 0／1／3／5）；第五项发音从文字里看不出来，由你对照标准自评。
            {dictation ? "语音识别在浏览器里完成，需要联网和麦克风权限。" : "这个浏览器不支持语音识别：可以对着计时说，然后把说的内容打出来（设置了 Azure 语音会用它听出的文字）；用 Chrome、Edge 或 Safari 可以自动转文字。"}
            {recorder.supported ? "独白会录音，只留在这次练习里，可以回放；设置了 Azure 语音还能给发音、流利度和语调打分，代替自评。" : ""}
          </p>
          {!hasAi && (
            <p className="muted">
              还没有设置 AI 接口：可以照常抽题、准备和开口，但没有辩论和批改。到 <a className="link" href={href({ page: "me" })}>我的 → AI 接口</a> 设置。
            </p>
          )}
        </header>
        {phase === "choose" ? (
          <>
            <h3 className="eyebrow">抽到这两个题，选一个</h3>
            <div className="essay-tasks exam-draw">
              {drawn.map((s) => (
                <button key={s.id} className="essay-task" onClick={() => choose(s)}>
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
              <button className="btn btn-ghost" onClick={() => setPhase("pick")}>
                重新抽
              </button>
            </div>
          </>
        ) : (
          <div className="writing-actions exam-draw-actions">
            {phase === "drawing" ? (
              <>
                <p className="muted">AI 出题中（约 20–40 秒）…</p>
                <button className="btn btn-ghost" onClick={leave}>
                  取消
                </button>
              </>
            ) : (
              <>
                <label className="field toggle" style={{ width: "100%" }}>
                  <div>
                    <b>严格模考模式</b>
                    <small>禁止跳过辩论；辩论须满 10 分钟或完成 ≥6 轮有效回答，考官会连续追问施压。</small>
                  </div>
                  <input type="checkbox" role="switch" checked={strictMode} onChange={(e) => setStrictMode(e.target.checked)} />
                  <span className="switch" aria-hidden="true" />
                </label>
                {hasAi ? (
                  <>
                    <button className="btn btn-primary btn-xl" onClick={() => void draw(true)}>
                      <Sparkles size={18} /> 抽两个新题（AI 按真题长度出题）
                    </button>
                    <button className="btn btn-ghost" onClick={() => void draw(false)}>
                      <Shuffle size={16} /> 抽内置题库（{SPEAKING_SUBJECTS.length} 题，真题长度）
                    </button>
                  </>
                ) : (
                  <button className="btn btn-primary btn-xl" onClick={() => void draw(false)}>
                    <Shuffle size={18} /> 抽两个题（内置 {SPEAKING_SUBJECTS.length} 题）
                  </button>
                )}
              </>
            )}
          </div>
        )}
        {log.length > 0 && phase === "pick" && (
          <section className="essay-level">
            <h3 className="eyebrow">最近的成绩（AI 评的四项，满分 20）</h3>
            <ul className="essay-history">
              {log.slice(0, 8).map((r, k) => (
                <li key={k}>
                  <span>
                    {day(r.at)} · {SPEAKING_SUBJECTS.find((s) => s.id === r.what)?.title ?? topicOf(r.what)?.zh ?? r.what}
                  </span>
                  <span className="muted">
                    {r.score}/{r.total} · 折合 {outOf25(r)}/25
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  const topic = topicOf(subject.topic);
  const words = countWords(said);
  const turn = turns[turns.length - 1];
  const answeredTurns = turns.filter((t) => t.a.trim()).length;
  const canEndDebate = !strictMode || debate.sec >= SPEAK_TIMES.debate[0] || answeredTurns >= 6;
  const escalation = assessDebateEscalation(turns, Math.floor(debate.sec / 60), strictMode);
  const [min, max] = SPEAK_TIMES.monologue;
  /** The fifth criterion from Azure's assessment, when there is one; else the learner's own rating. */
  const azurePhono = pron.state === "done" ? phonoLevel(pron.result) : null;

  return (
    <div className="page practice">
      <section className="essay-stage">
        <header className="exam-top">
          <button className="btn btn-ghost" onClick={leave}>
            {phase === "result" ? "再抽一次" : "放弃这题"}
          </button>
          <span className="eyebrow">
            口语 · {topic?.zh}
            {strictMode ? " · 严格模考" : ""}
          </span>
          {phase === "prep" && <span className={`exam-clock ${prep.sec === 0 ? "is-over" : ""}`}>{prep.sec === 0 ? "准备时间到" : `准备 ${clock(prep.sec)}`}</span>}
          {phase === "talk" && <span className={`exam-clock ${talk.sec > max ? "is-over" : talk.sec >= min ? "is-ok" : ""}`}>{clock(talk.sec)} · 目标 5–7 分钟</span>}
          {phase === "debate" && <span className={`exam-clock ${debate.sec > SPEAK_TIMES.debate[1] ? "is-over" : debate.sec >= SPEAK_TIMES.debate[0] ? "is-ok" : ""}`}>辩论 {clock(debate.sec)} · 考试是 10–13 分钟</span>}
        </header>
        <h2 className="essay-title" lang="fr">
          {subject.title}
        </h2>
        <p className="essay-consigne" lang="fr">
          {subject.doc}
        </p>
        {subject.source && (
          <p className="muted small" lang="fr">
            {subject.source}
          </p>
        )}
        <p className="essay-situation" lang="fr">
          {PO_STANDARD_CONSIGNE}
        </p>
        {showHint || prepExpired ? (
          <p className="muted small">
            <strong>思路提示：</strong>
            {subject.ask}
          </p>
        ) : (
          ((phase === "prep" && !strictMode) || phase === "result") && (
            <div className="writing-actions">
              <button className="link" type="button" onClick={() => setShowHint(true)}>
                思路提示（查看中文要点）
              </button>
            </div>
          )
        )}

        {phase === "prep" && (
          <>
            <div className="essay-help">
              <details open>
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
              {topic && (
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
            </div>
            <textarea className="writing-input essay-notes" lang="fr" rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="准备时记关键词和提纲（考试时可以看笔记，但不能念稿）" spellCheck={false} aria-label="准备笔记" />
            <div className="writing-actions">
              <button className="btn btn-primary btn-xl" onClick={() => void startTalk()}>
                <Mic size={18} /> 准备好了，开始说
              </button>
            </div>
          </>
        )}

        {phase === "talk" && (
          <>
            {notes.trim() && (
              <div className="essay-box">
                <p className="eyebrow">你的笔记</p>
                <p className="essay-text">{notes}</p>
              </div>
            )}
            {dictation ? (
              <div className={`exam-live ${listening ? "is-on" : ""}`} aria-live="polite">
                <p className="eyebrow">{listening ? "正在听……" : "识别已停止"}</p>
                <p className="essay-text" lang="fr">
                  {said}
                  <i>{interim}</i>
                  {!said && !interim && <span className="muted">开口说法语，这里会出现文字。</span>}
                </p>
              </div>
            ) : (
              <p className="muted">对着计时说 5–7 分钟，说完点下面的按钮，再把说的内容打出来。</p>
            )}
            <div className="writing-actions">
              <span className="essay-count">{words} 词</span>
              {recorder.on && (
                <span className="muted small">
                  <i className="rec-dot" aria-hidden="true" />
                  录音中
                </span>
              )}
              <button className="btn btn-primary btn-xl" onClick={() => void endTalk()}>
                <Square size={16} /> 说完了
              </button>
            </div>
          </>
        )}

        {phase === "review" && (
          <>
            <p className="muted">
              {spoke > 0 ? `说了 ${clock(spoke)}。` : ""}
              {dictation ? "识别难免有错：把听错的词改回你实际说的话，但不要趁机改语法，否则批改就不准了。" : "请把刚才说的独白内容完整打出来，供 AI 批改与辩论追问。"}
            </p>
            <TakePlayer take={talkTake} label="听自己的独白" />
            {talkTake && (pron.available ? <AssessStatus a={pron} /> : <AssessHint />)}
            {pron.state === "done" && pron.result && <PronReport result={pron.result} />}
            <textarea className="writing-input essay-input" lang="fr" rows={10} value={said} onChange={(e) => setSaid(e.target.value)} placeholder="你说的内容" spellCheck={false} aria-label="你说的内容" />
            <div className="writing-actions">
              <span className={`essay-count ${words >= 450 ? "is-ok" : ""}`}>{words} 词 · 5 分钟大约 450 词以上</span>
              {hasAi ? (
                <>
                  {!strictMode ? (
                    <button className="btn btn-ghost" onClick={() => void assess([])} disabled={!said.trim()}>
                      跳过辩论，直接批改
                    </button>
                  ) : (
                    <span className="muted small">严格模考中不可跳过辩论</span>
                  )}
                  <button className="btn btn-primary btn-xl" onClick={startDebate} disabled={!said.trim()}>
                    进入辩论 <ArrowRight size={18} />
                  </button>
                </>
              ) : (
                <span className="muted">没有设置 AI 接口，没有辩论和批改。对照准备时的评分要点自己检查。</span>
              )}
            </div>
          </>
        )}

        {phase === "debate" && (
          <>
            <ol className="exam-debate">
              {turns.slice(0, -1).map((t, k) => (
                <li key={k}>
                  <p className="exam-q" lang="fr">
                    {t.q}
                  </p>
                  <p className="essay-text" lang="fr">
                    {t.a || "（没有回答）"}
                  </p>
                </li>
              ))}
            </ol>
            {asking && <p className="muted">考官在想下一个问题…</p>}
            {turn && !asking && (
              <div className={`exam-live ${listening ? "is-on" : ""}`} aria-live="polite">
                <p className="eyebrow">
                  考官 {((Math.max(0, turns.length - 1) + voiceOffset) % 2) + 1} 问
                  {escalation.level >= 2 ? ` · 追问升级 L${escalation.level}` : ""}
                </p>
                <p className="exam-q" lang="fr">
                  {turn.q}
                </p>
                <textarea className="writing-input essay-notes" lang="fr" rows={4} value={turn.a + (listening ? interim : "")} readOnly={listening} onChange={(e) => setAnswer(e.target.value)} placeholder={dictation ? "点「开口回答」，或直接打字" : "把你的回答打出来"} spellCheck={false} aria-label="你的回答" />
                <div className="writing-actions">
                  <button
                    className="link"
                    onClick={() => {
                      quiet();
                      void speakExaminer(turn.q, Math.max(0, turns.length - 1), voiceOffset, ai);
                    }}
                  >
                    再听一遍问题
                  </button>
                  {dictation && !listening && (
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
                        stopAudio();
                        hear(setAnswer, turn.a ? `${turn.a.trim()} ` : "");
                      }}
                    >
                      <Mic size={16} /> {turn.a ? "接着说" : "开口回答"}
                    </button>
                  )}
                  {debate.sec < SPEAK_TIMES.debate[1] && turns.length < MAX_TURNS ? (
                    <button
                      className="btn btn-primary"
                      disabled={!turn.a.trim() && !interim}
                      onClick={() => {
                        quiet();
                        void ask(turns);
                      }}
                    >
                      答完了，下一个问题 <ArrowRight size={16} />
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={() => void assess(turns)}>
                      时间到，结束辩论并批改 <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              </div>
            )}
            {!asking && turns.length > 0 && debate.sec < SPEAK_TIMES.debate[1] && (
              <div className="writing-actions">
                <span className="muted small">
                  {!canEndDebate
                    ? `严格模考：需满 10:00 或完成至少 6 轮有效回答才可交卷（已答 ${answeredTurns}/6 轮）`
                    : debate.sec < SPEAK_TIMES.debate[0]
                      ? "考官会一直追问到你结束为止；考试里这一段有 10–13 分钟，尽量撑到 10 分钟。"
                      : "已经到 10 分钟，可以结束了。"}
                </span>
                <button className="link" disabled={!canEndDebate} onClick={() => void assess(turns)}>
                  结束辩论，批改
                </button>
              </div>
            )}
          </>
        )}

        {phase === "grading" && (
          <div className="writing-actions">
            <p className="muted">AI 批改中（约 20–60 秒）…</p>
            <button
              className="btn btn-ghost"
              onClick={() => {
                ctrl.current?.abort();
                setPhase(turns.length ? "debate" : "review");
              }}
            >
              取消
            </button>
          </div>
        )}

        {phase === "result" && fb && (
          <>
            <Marking fb={fb} pointTitle={pointTitle} extra={{ key: "phono", score: azurePhono ?? phono }} />
            {pron.state === "done" && pron.result && <PronReport result={pron.result} title="发音和语调（第五项，Azure 评测）" />}
            {azurePhono === null && (
              <div className="essay-box">
                <p className="eyebrow">发音和语调：自己评（第五项，AI 听不到）</p>
                <p className="muted small">{CRITERION_CHECK.phono} 官方标准：低于 B2 是「大体听得懂，语调和重音还有不自然」；B2 是「语调、重音、发音清楚，偶尔的问题不影响交流」；B2+ 是「能变化语调来表达意思，能自己纠正」。</p>
                <div className="segmented">
                  {LEVELS.map((v) => (
                    <button key={v} className={phono === v ? "is-on" : ""} onClick={() => setPhono(v)} aria-pressed={phono === v}>
                      {v} · {LEVEL_LABEL[v]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <TakePlayer take={talkTake} label="听自己的独白" />
            {turns.some((t) => t.a.trim()) && (
              <div className="essay-box">
                <p className="eyebrow">辩论</p>
                <ol className="exam-debate">
                  {turns.map((t, k) => (
                    <li key={k}>
                      <p className="exam-q" lang="fr">
                        {t.q}
                      </p>
                      <p className="essay-text" lang="fr">
                        {t.a || "（没有回答）"}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <div className="essay-cols">
              <div className="essay-box">
                <p className="eyebrow">你的独白（{words} 词）</p>
                <p className="essay-text" lang="fr">
                  {said}
                </p>
              </div>
              {fb.rewrite && (
                <div className="essay-box">
                  <p className="eyebrow">可以这样说</p>
                  <p className="essay-text" lang="fr">
                    {fb.rewrite}
                  </p>
                </div>
              )}
            </div>
            <p className="muted small">AI 只看文字，它的分数可能有偏差；真正的考试由两位考官现场评分。</p>
            <div className="writing-actions">
              <button className="btn btn-primary" onClick={() => choose(subject)}>
                同一题再说一遍
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
