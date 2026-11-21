import { ArrowLeft, ArrowRight, Check, Mic, Shuffle, Sparkles, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ready, useAiConfig } from "../ai/config";
import { canAssess as canAssessNow } from "../ai/pronunciation";
import { drillFeedback, type DrillFeedback } from "../ai/speaking-drill";
import { stopAudio } from "../lib/audio";
import { DRILL_PLAN, DRILL_TIMES, drawQuestion, type DrillQuestion } from "../lib/drill";
import { topicOf } from "../lib/exam";
import { href } from "../lib/router";
import type { Take } from "../lib/recorder";
import { canDictate, dictate } from "../lib/speech";
import { useTimer } from "../lib/timer";
import { logDrill, useDrillsToday } from "../store/drill";
import { keepRecording, listRecordings, type KeptRecording } from "../store/recordings";
import { AssessHint, AssessStatus, PronReport, TakePlayer, useAssess, useRecorder } from "../ui/Recording";
import { toast } from "../ui/Toast";

type Phase = "pick" | "think" | "speak" | "done";

/**
 * 每日一分钟口语: draw a question, 15 seconds to think, one minute to give an opinion and two reasons. The minute is
 * recorded (played back, assessed by Azure when it is set up) and, with a text AI, commented on.
 */
export function DrillStudio({ onExit, exitLabel = "返回练习" }: { onExit: () => void; exitLabel?: string }) {
  const ai = useAiConfig();
  const doneToday = useDrillsToday();
  const [asked, setAsked] = useState<string[]>([]);
  const [q, setQ] = useState<DrillQuestion>(() => drawQuestion());
  const [phase, setPhase] = useState<Phase>("pick");
  const [said, setSaid] = useState("");
  const [interim, setInterim] = useState("");
  const [take, setTake] = useState<Take | null>(null);
  const [fb, setFb] = useState<DrillFeedback | null>(null);
  const [coaching, setCoaching] = useState(false);
  const [kept, setKept] = useState<{ rec: KeptRecording; url: string }[]>([]);
  const stopDictation = useRef<(() => void) | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const think = useTimer();
  const speak = useTimer();
  const recorder = useRecorder();
  const assess = useAssess();
  const dictation = canDictate();
  const hasAi = ready.text(ai);

  // recordings kept from earlier visits, as object URLs revoked when replaced or on leaving
  const keptUrls = useRef<string[]>([]);
  const alive = useRef(true);
  const loadKept = () =>
    void listRecordings().then((all) => {
      if (!alive.current) return;
      keptUrls.current.forEach((u) => URL.revokeObjectURL(u));
      const next = all.map((rec) => ({ rec, url: URL.createObjectURL(rec.blob) }));
      keptUrls.current = next.map((k) => k.url);
      setKept(next);
    });
  useEffect(() => {
    alive.current = true;
    loadKept();
    return () => {
      alive.current = false;
      stopDictation.current?.();
      ctrl.current?.abort();
      stopAudio();
      keptUrls.current.forEach((u) => URL.revokeObjectURL(u));
      keptUrls.current = [];
    };
  }, []);
  /** True while the minute is being spoken (the recogniser must not start after it ended). */
  const speaking = useRef(false);

  const redraw = () => {
    const next = drawQuestion([...asked, q.id]);
    setAsked((a) => [...a, q.id].slice(-12));
    setQ(next);
  };

  const begin = () => {
    setSaid("");
    setInterim("");
    setTake(null);
    setFb(null);
    assess.reset();
    setPhase("think");
    think.start(DRILL_TIMES.think);
  };

  const startSpeaking = async () => {
    think.stop();
    stopAudio();
    setPhase("speak");
    speaking.current = true;
    speak.start(DRILL_TIMES.speak);
    // the recording first: it asks for the microphone; the recogniser then listens alongside
    if (recorder.supported) await recorder.start();
    if (dictation && speaking.current)
      stopDictation.current = dictate(
        (final, guess) => {
          setSaid(final);
          setInterim(guess);
        },
        (error) => {
          setInterim("");
          if (error) toast(`${error}${recorder.supported ? " 录音照常进行。" : ""}`, "warn");
        },
      );
  };

  const finish = async () => {
    speaking.current = false;
    speak.stop();
    stopDictation.current?.();
    stopDictation.current = null;
    setInterim("");
    setPhase("done");
    logDrill();
    const t = await recorder.stop();
    setTake(t);
    if (!t) return;
    void keepRecording({ label: q.fr, seconds: t.seconds, blob: t.blob }).then(loadKept);
    if (assess.available) {
      const r = await assess.run(t.blob);
      // no recogniser in this browser (Safari on iOS, the app): Azure's transcript stands in
      if (r?.text) setSaid((s) => (s.trim() ? s : r.text));
    }
  };

  // the clocks move the drill on by themselves
  useEffect(() => {
    if (phase === "think" && !think.running && think.sec === 0) void startSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, think.running, think.sec]);
  useEffect(() => {
    if (phase === "speak" && !speak.running && speak.sec === 0) void finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, speak.running, speak.sec]);

  const coach = async () => {
    const c = new AbortController();
    ctrl.current = c;
    setCoaching(true);
    try {
      const r = await drillFeedback({ question: q.fr, transcript: said }, c.signal);
      if (!c.signal.aborted) setFb(r);
    } catch (e) {
      if (!c.signal.aborted) toast((e as Error).message || "点评失败", "warn");
    } finally {
      if (!c.signal.aborted) setCoaching(false);
    }
  };

  const topic = topicOf(q.topic);

  return (
    <div className="page practice">
      <header className="page-head">
        <button className="link deck-back" onClick={onExit}>
          <ArrowLeft size={16} /> {exitLabel}
        </button>
        <p className="eyebrow">每日一分钟口语 · Une minute pour convaincre</p>
        {phase === "pick" && (
          <>
            <h1 className="display">一个问题，一分钟。</h1>
            <p className="lede">抽一个问题，想 15 秒，然后用 60 秒说出你的看法和两个理由。每天一次，练的是开口的速度和连贯。</p>
            <p className="muted">
              {doneToday ? `今天已经说了 ${doneToday} 次。` : "今天还没说。"}
              {recorder.supported ? "会录下你说的话，可以回放。" : "这个浏览器不能录音，只能计时说。"}
              {dictation ? "说的同时浏览器会转成文字。" : ""}
            </p>
            {!assess.available && <AssessHint />}
          </>
        )}
      </header>

      <section className="essay-stage">
        <div className="writing-actions">
          {topic && <span className="chip">{topic.zh}</span>}
          {phase === "think" && <span className="drill-clock">{think.sec}</span>}
          {phase === "speak" && (
            <span className={`drill-clock ${speak.sec <= 10 ? "is-over" : ""}`}>
              {recorder.on && <i className="rec-dot" aria-label="正在录音" />}
              {speak.sec}
            </span>
          )}
        </div>
        <p className="drill-question" lang="fr">
          {q.fr}
        </p>
        <p className="muted">{q.zh}</p>

        {phase === "pick" && (
          <div className="writing-actions">
            <button className="btn btn-ghost" onClick={redraw}>
              <Shuffle size={16} /> 换一题
            </button>
            <button className="btn btn-primary btn-xl" onClick={begin}>
              <Mic size={18} /> 开始（先想 15 秒）
            </button>
          </div>
        )}

        {phase === "think" && (
          <>
            <ol className="essay-plan">
              {DRILL_PLAN.map((p, k) => (
                <li key={k}>
                  <b>{p.zh}</b>
                  <span lang="fr">{p.fr}</span>
                </li>
              ))}
            </ol>
            <div className="writing-actions">
              <button className="btn btn-primary" onClick={() => void startSpeaking()}>
                想好了，开始说
              </button>
            </div>
          </>
        )}

        {phase === "speak" && (
          <>
            {dictation ? (
              <div className="exam-live is-on" aria-live="polite">
                <p className="essay-text" lang="fr">
                  {said}
                  <i>{interim}</i>
                  {!said && !interim && <span className="muted">开口说法语……</span>}
                </p>
              </div>
            ) : (
              <p className="muted">{recorder.on ? "正在录音，开口说。" : "对着计时说。"}说完点下面的按钮，时间到也会自动结束。</p>
            )}
            <div className="writing-actions">
              <button className="btn btn-primary btn-xl" onClick={() => void finish()}>
                <Square size={16} /> 说完了
              </button>
            </div>
          </>
        )}

        {phase === "done" && (
          <>
            <p className="muted">
              <Check size={14} /> 今天的一分钟口语已记下。
            </p>
            <TakePlayer take={take} />
            {take && (assess.available ? <AssessStatus a={assess} /> : <AssessHint />)}
            {assess.state === "done" && assess.result && <PronReport result={assess.result} />}
            <textarea className="writing-input essay-notes" lang="fr" rows={4} value={said} onChange={(e) => setSaid(e.target.value)} placeholder={dictation || assess.available ? "你说的内容（识别有错可以改回来）" : "把你说的内容打出来，AI 可以点评"} spellCheck={false} aria-label="你说的内容" />
            {hasAi ? (
              <div className="writing-actions">
                <button className="btn btn-ghost" onClick={() => void coach()} disabled={coaching || !said.trim()}>
                  <Sparkles size={16} /> {coaching ? "AI 点评中…" : "AI 点评"}
                </button>
              </div>
            ) : (
              <p className="muted small">
                设置 AI 接口后可以让 AI 点评结构和用词：<a className="link" href={href({ page: "me" })}>我的 → AI 接口</a>。
              </p>
            )}
            {fb && (
              <div className="essay-box">
                <p className="eyebrow">
                  AI 点评 · {fb.opinion ? "观点明确" : "观点不够明确"} · {fb.reasons} 个理由
                </p>
                {fb.comment && <p className="essay-comment">{fb.comment}</p>}
                {fb.fixes.length > 0 && (
                  <ul className="writing-errors">
                    {fb.fixes.map((f, k) => (
                      <li key={k}>
                        <span lang="fr">
                          <del>{f.wrong}</del> <ins>{f.right}</ins>
                        </span>
                        {f.why && <small>{f.why}</small>}
                      </li>
                    ))}
                  </ul>
                )}
                {fb.better && (
                  <>
                    <p className="eyebrow">可以这样说</p>
                    <p className="essay-text" lang="fr">
                      {fb.better}
                    </p>
                  </>
                )}
              </div>
            )}
            <div className="writing-actions">
              <button className="btn btn-ghost" onClick={begin}>
                同一题再说一遍
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  redraw();
                  setPhase("pick");
                }}
              >
                换一题
              </button>
            </div>
          </>
        )}

        {phase === "pick" && kept.length > 0 && (
          <section className="essay-level">
            <h3 className="eyebrow">最近的录音（只存在这台设备上）</h3>
            <ul className="essay-history">
              {kept.map(({ rec, url }) => (
                <li key={rec.id}>
                  <span lang="fr">{rec.label}</span>
                  <audio controls preload="none" src={url} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>
    </div>
  );
}

/** The day's 一分钟口语 as a task on 今日: done or not, and the way in. */
export function DrillTeaser({ onOpen }: { onOpen: () => void }) {
  const done = useDrillsToday();
  const ai = useAiConfig();
  return (
    <section className={`panel drill-teaser ${done ? "is-done" : ""}`} onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen()} aria-label="今日一分钟口语">
      <p className="eyebrow">今日一分钟口语</p>
      <h3>想 15 秒，说 60 秒：一个观点，两个理由。</h3>
      <p>录下来回放{canAssessNow(ai) ? "，Azure 给发音打分" : ""}。每天开口一次，比一周练一次长的更管用。</p>
      <span className="drill-teaser-go">{done ? <><Check size={16} /> 今天已完成{done > 1 ? ` ${done} 次` : ""} · 再来一次</> : <>开始 <ArrowRight size={16} /></>}</span>
    </section>
  );
}
