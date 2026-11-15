import { ArrowLeft, ArrowRight, Check, FastForward, Play, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ready, useAiConfig } from "../ai/config";
import { makeComprehension } from "../ai/tasks";
import { otherVoice, ttsOn, ttsUrl } from "../ai/tts";
import { play, stopAudio } from "../lib/audio";
import { countWords } from "../lib/essay";
import { BETWEEN_PLAYS, clock, COMP_LABEL, exercisePoints, FORM_SPEC, outOf25, PAPER, READ_MINUTES, REAL_WPM, speechChunks, TOPICS, topicOf, type CompExercise, type CompForm, type CompKind } from "../lib/exam";
import { href } from "../lib/router";
import { useTimer } from "../lib/timer";
import { logExam } from "../store/essays";
import { useStore } from "../store/store";
import { toast } from "../ui/Toast";

const day = (ms: number) => new Date(ms).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
const num = (n: number) => String(n).replace(".", ",");

/** The voice's own pace (words per minute at normal speed), measured while it reads and kept on this device. */
const PACE_KEY = "fb2.listen.wpm";
const readPace = () => {
  try {
    const n = Number(localStorage.getItem(PACE_KEY));
    return n > 80 && n < 320 ? n : 0;
  } catch {
    return 0;
  }
};
/** How much to speed the voice up or slow it down to reach the pace of the official recordings. */
const rateFor = (wpm: number, slow: boolean) => Math.min(1.4, Math.max(0.8, wpm ? REAL_WPM / wpm : 1)) * (slow ? 0.85 : 1);

type Phase = "setup" | "making" | "work" | "done";
type What = CompForm | "paper";

/**
 * 听力理解 / 应试阅读, in the form of the exam (new format): a whole paper is three exercises worth 9 + 9 + 7 points,
 * every question has three options and is worth 1 or 1.5 points. Listening follows the exam's rhythm: time to
 * read the questions, the recording (twice for a long one, once for the short ones), time to answer. The
 * documents are written by the AI and read by a synthetic voice; the score is logged, memory state is not touched.
 */
export function ComprehensionStudio({ kind, onExit }: { kind: CompKind; onExit: () => void }) {
  const ai = useAiConfig();
  const log = (useStore((s) => s.progress.examLog) ?? []).filter((r) => r.part === kind);
  const listen = kind === "listen";
  const forms: What[] = ["paper", ...new Set(PAPER[kind])];
  const [topic, setTopic] = useState("random");
  const [level, setLevel] = useState<"B1" | "B2">("B2");
  const [what, setWhat] = useState<What>("paper");
  const [timed, setTimed] = useState(true);
  const [slow, setSlow] = useState(false);
  const [wpm, setWpm] = useState(readPace);
  const measured = useRef({ words: 0, sec: 0 });
  const [phase, setPhase] = useState<Phase>("setup");
  const [made, setMade] = useState(0);
  const [exs, setExs] = useState<CompExercise[]>([]);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [heard, setHeard] = useState<Record<number, boolean>>({});
  const [pace, setPace] = useState<{ e: number; label: string; left: number | null } | null>(null);
  const [showZh, setShowZh] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  const run = useRef(0);
  const skip = useRef<(() => void) | null>(null);
  const timer = useTimer();

  const halt = () => {
    run.current++;
    skip.current?.();
    stopAudio();
    setPace(null);
  };

  useEffect(
    () => () => {
      ctrl.current?.abort();
      run.current++;
      stopAudio();
    },
    [],
  );
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [phase]);

  const make = async () => {
    const list = what === "paper" ? PAPER[kind] : [what];
    const pool = [...TOPICS].sort(() => Math.random() - 0.5);
    const c = new AbortController();
    ctrl.current = c;
    setPhase("making");
    setMade(0);
    try {
      const out: CompExercise[] = [];
      for (const [k, form] of list.entries()) {
        const t = topic === "random" || k > 0 ? pool[k % pool.length] : topicOf(topic)!;
        out.push(await makeComprehension({ kind, form, topic: t, level }, c.signal));
        if (c.signal.aborted) return;
        setMade(k + 1);
      }
      setExs(out);
      setPicked({});
      setHeard({});
      setShowZh(false);
      setPhase("work");
      if (!listen && timed) timer.start((what === "paper" ? READ_MINUTES.paper : what === "opinions" ? READ_MINUTES.opinions : READ_MINUTES.long) * 60);
    } catch (err) {
      if (c.signal.aborted) return;
      toast((err as Error).message || "出题失败", "warn");
      setPhase("setup");
    }
  };

  /**
   * Read one document aloud at the pace of the official recordings, the second speaker with the other voice.
   * The audio of every piece is fetched first, so that there is no gap in the middle of a sentence; the voice's
   * own pace is measured as it reads and the speed adjusted for what follows. False when stopped.
   */
  const say = async (text: string, mine: number) => {
    const chunks = speechChunks(text);
    if (ttsOn()) {
      const other = otherVoice();
      await Promise.all(chunks.map((c) => (c.who === 1 ? ttsUrl(c.t, other) : ttsUrl(c.t)).catch(() => "")));
      if (run.current !== mine) return false;
    }
    for (const c of chunks) {
      const rate = rateFor(measured.current.sec > 20 ? (measured.current.words / measured.current.sec) * 60 : wpm, slow);
      const t0 = performance.now();
      const r = await play(null, c.t, "uk", rate, c.who === 1);
      if (run.current !== mine || r === "stopped" || r === "unsupported") return false;
      const words = countWords(c.t);
      // what the piece would have taken at normal speed; the device voice is slowed by 5% in `play`
      const sec = ((performance.now() - t0) / 1000) * rate * (r === "device" ? 0.95 : 1);
      if (words >= 12 && sec > 2) {
        measured.current.words += words;
        measured.current.sec += sec;
      }
    }
    if (measured.current.sec > 20) {
      const now = Math.round((measured.current.words / measured.current.sec) * 60);
      setWpm(now);
      try {
        localStorage.setItem(PACE_KEY, String(now));
      } catch {
        /* the pace is measured again next time */
      }
    }
    return true;
  };

  /** A pause of the exam (reading the questions, answering): counts down, and can be skipped. */
  const pause = (e: number, label: string, sec: number, mine: number) =>
    new Promise<void>((done) => {
      let left = sec;
      const end = () => {
        window.clearInterval(id);
        skip.current = null;
        done();
      };
      const id = window.setInterval(() => {
        if (run.current !== mine || --left <= 0) return end();
        setPace({ e, label, left });
      }, 1000);
      skip.current = end;
      setPace({ e, label, left });
    });

  /** One listening exercise at the exam's rhythm. */
  const perform = async (e: number) => {
    const ex = exs[e];
    const spec = FORM_SPEC[ex.form];
    const mine = ++run.current;
    const alive = () => run.current === mine;
    for (const [d, doc] of ex.docs.entries()) {
      const name = ex.docs.length > 1 ? `录音 ${d + 1}：` : "";
      await pause(e, `${name}读题`, spec.read, mine);
      for (let n = 1; n <= spec.plays && alive(); n++) {
        setPace({ e, label: `${name}${spec.plays > 1 ? `第 ${n} 遍` : "只放一遍"}`, left: null });
        if (!(await say(doc.text, mine))) break;
        if (n < spec.plays) await pause(e, `${name}两遍之间`, BETWEEN_PLAYS, mine);
      }
      if (!alive()) return;
      await pause(e, `${name}作答`, spec.answer, mine);
      if (!alive()) return;
    }
    setHeard((h) => ({ ...h, [e]: true }));
    setPace(null);
  };

  const replay = async (e: number, d: number) => {
    const mine = ++run.current;
    setPace({ e, label: "重听", left: null });
    await say(exs[e].docs[d].text, mine);
    if (run.current === mine) setPace(null);
  };

  const all = exs.flatMap((ex, e) => ex.questions.map((q, k) => ({ q, key: `${e}-${k}` })));
  const total = exs.reduce((n, ex) => n + exercisePoints(ex), 0);
  const score = all.reduce((n, { q, key }) => n + (picked[key] === q.answer ? q.pts : 0), 0);
  const answered = all.filter(({ key }) => picked[key] !== undefined).length;

  const finish = () => {
    halt();
    timer.stop();
    logExam({ part: kind, what: exs.length > 1 ? "paper" : exs[0].topic, score, total });
    setPhase("done");
  };

  if (phase === "setup" || phase === "making") {
    const making = phase === "making";
    const count = what === "paper" ? PAPER[kind].length : 1;
    return (
      <div className="page practice">
        <header className="page-head">
          <button className="link deck-back" onClick={onExit}>
            <ArrowLeft size={16} /> 返回练习
          </button>
          <p className="eyebrow">
            {COMP_LABEL[kind]} · {listen ? "Compréhension de l'oral" : "Compréhension des écrits"}
          </p>
          <h1 className="display">{listen ? "只听，不看。" : "读得快，也读得准。"}</h1>
          <p className="lede">
            {listen
              ? "和考试一样：一套三个练习共 25 分。两段长录音各听两遍，三段短录音各听一遍；每题三个选项，1 分或 1.5 分。先读题，再听，按考试的停顿时间作答。"
              : "和考试一样：一套三个练习共 25 分，限时 1 小时。两篇报刊文章各 7 题，再加一组「这是谁的观点」；每题三个选项，1 分或 1.5 分。"}
          </p>
        </header>
        <section className="panel exam-setup">
          <h3 className="eyebrow">练什么</h3>
          <div className="segmented segmented-wide">
            {forms.map((f) => (
              <button key={f} className={what === f ? "is-on" : ""} onClick={() => setWhat(f)} aria-pressed={what === f}>
                {f === "paper" ? "整套（25 分）" : FORM_SPEC[f].zh}
              </button>
            ))}
          </div>
          <h3 className="eyebrow">话题</h3>
          <div className="exam-chips">
            <button className={topic === "random" ? "is-on" : ""} onClick={() => setTopic("random")} aria-pressed={topic === "random"}>
              随机
            </button>
            {TOPICS.map((t) => (
              <button key={t.id} className={topic === t.id ? "is-on" : ""} onClick={() => setTopic(t.id)} aria-pressed={topic === t.id}>
                {t.zh}
              </button>
            ))}
          </div>
          {what === "paper" && topic !== "random" && <p className="muted small">整套题的第一个练习用所选话题，后两个换别的话题。</p>}
          <h3 className="eyebrow">难度</h3>
          <div className="segmented">
            {(["B1", "B2"] as const).map((l) => (
              <button key={l} className={level === l ? "is-on" : ""} onClick={() => setLevel(l)} aria-pressed={level === l}>
                {l}
              </button>
            ))}
          </div>
          {listen ? (
            <p className="muted">
              {ready.tts(ai) ? "用「我的 → AI 接口」里设置的 Azure 语音朗读，对话里的第二个人换另一个声音。" : "没有设置 Azure 语音，会用这台设备自带的法语语音朗读，音质和语速可能不理想。"}
              真题是多人真人录音，合成语音更清楚也更平。
            </p>
          ) : null}
          {listen ? (
            <>
              <h3 className="eyebrow">语速</h3>
              <div className="segmented">
                <button className={!slow ? "is-on" : ""} onClick={() => setSlow(false)} aria-pressed={!slow}>
                  真题语速
                </button>
                <button className={slow ? "is-on" : ""} onClick={() => setSlow(true)} aria-pressed={slow}>
                  慢 15%
                </button>
              </div>
              <p className="muted small">
                {wpm ? `这个声音实测约每分钟 ${wpm} 词，播放速度自动调成 ×${rateFor(wpm, slow).toFixed(2)}。` : "第一次朗读时会测出这个声音的语速，然后自动调到真题的速度。"}
              </p>
            </>
          ) : (
            <>
              <h3 className="eyebrow">限时</h3>
              <div className="segmented">
                <button className={timed ? "is-on" : ""} onClick={() => setTimed(true)} aria-pressed={timed}>
                  {what === "paper" ? READ_MINUTES.paper : what === "opinions" ? READ_MINUTES.opinions : READ_MINUTES.long} 分钟
                </button>
                <button className={!timed ? "is-on" : ""} onClick={() => setTimed(false)} aria-pressed={!timed}>
                  不限时
                </button>
              </div>
            </>
          )}
          {ready.text(ai) ? (
            <div className="writing-actions">
              {making && (
                <p className="muted">
                  AI 出题中：第 {Math.min(made + 1, count)}/{count} 个练习（每个约 20–60 秒）…
                </p>
              )}
              {making ? (
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    ctrl.current?.abort();
                    setPhase("setup");
                  }}
                >
                  取消
                </button>
              ) : (
                <button className="btn btn-primary btn-xl" onClick={() => void make()}>
                  {what === "paper" ? "出一整套" : "出一个练习"} <ArrowRight size={18} />
                </button>
              )}
            </div>
          ) : (
            <p className="muted">
              出题需要 AI：先到 <a className="link" href={href({ page: "me" })}>我的 → AI 接口</a> 设置生成卡片服务。
            </p>
          )}
        </section>
        {log.length > 0 && (
          <section className="essay-level">
            <h3 className="eyebrow">最近的成绩（折合 25 分制）</h3>
            <ul className="essay-history">
              {log.slice(0, 8).map((r, k) => (
                <li key={k}>
                  <span>
                    {day(r.at)} · {r.what === "paper" ? "整套" : (topicOf(r.what)?.zh ?? r.what)}
                  </span>
                  <span className="muted">
                    {num(r.score)}/{num(r.total)} 分{r.total === 25 ? "" : ` · 折合 ${num(outOf25(r))}/25`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  const done = phase === "done";

  return (
    <div className="page practice">
      <section className="essay-stage">
        <header className="exam-top">
          <button
            className="btn btn-ghost"
            onClick={() => {
              halt();
              timer.stop();
              setPhase("setup");
            }}
          >
            {done ? "再来一套" : "放弃"}
          </button>
          <span className="eyebrow">
            {COMP_LABEL[kind]} · {level} · {exs.length > 1 ? "整套" : topicOf(exs[0]?.topic)?.zh}
          </span>
          {!listen && !done && timed && <span className={`exam-clock ${timer.sec === 0 ? "is-over" : ""}`}>{timer.sec === 0 ? "时间到" : clock(timer.sec)}</span>}
        </header>

        {done && (
          <div className="essay-marks">
            <p className="essay-total">
              {num(score)}
              <small>/{num(total)}</small>
            </p>
            <p className="muted">
              {total === 25 ? "这就是考试的 25 分制。" : `折合考试的 25 分制约 ${num(outOf25({ score, total }))} 分。`}
              及格线是四个部分合计 50/100，每部分不低于 5 分。
            </p>
          </div>
        )}

        {exs.map((ex, e) => {
          const spec = FORM_SPEC[ex.form];
          const busy = pace?.e === e;
          const showText = !listen || done;
          return (
            <section key={e} className="exam-exercise">
              <header className="exam-ex-head">
                <h3>
                  {exs.length > 1 ? `EXERCICE ${e + 1}` : "EXERCICE"} <small>{num(exercisePoints(ex))} points</small>
                </h3>
                {ex.intro && (
                  <p className="muted" lang="fr">
                    {ex.intro}
                  </p>
                )}
              </header>

              {listen && !done && (
                <div className="exam-player">
                  {busy ? (
                    <>
                      <span className="exam-clock">
                        {pace.label}
                        {pace.left !== null ? ` ${clock(pace.left)}` : "…"}
                      </span>
                      {pace.left !== null && (
                        <button className="btn btn-ghost" onClick={() => skip.current?.()}>
                          <FastForward size={16} /> 跳过等待
                        </button>
                      )}
                      <button className="btn btn-ghost" onClick={halt}>
                        <Square size={16} /> 停止
                      </button>
                    </>
                  ) : heard[e] ? (
                    <span className="muted">这个练习的录音已经放完，凭记忆作答。</span>
                  ) : (
                    <>
                      <button className="btn btn-primary" onClick={() => void perform(e)} disabled={!!pace}>
                        <Play size={16} /> 开始这个练习
                      </button>
                      <span className="muted">
                        {ex.form === "short" ? `三段录音，各读题 ${spec.read} 秒、听一遍、作答 ${spec.answer} 秒。` : `读题 ${spec.read} 秒，听两遍（中间停 ${BETWEEN_PLAYS} 秒），再给 ${spec.answer} 秒作答。`}
                      </span>
                    </>
                  )}
                </div>
              )}

              {showText &&
                ex.docs.map((d, k) => (
                  <article key={k} className="exam-doc">
                    <h4 className="exam-doc-title" lang="fr">
                      {ex.docs.length > 1 ? `Document ${k + 1}` : ex.title}
                    </h4>
                    <p className="essay-text" lang="fr">
                      {d.text}
                    </p>
                    {done && (
                      <div className="exam-doc-actions">
                        {listen &&
                          (busy ? (
                            <button className="link" onClick={halt}>
                              停止
                            </button>
                          ) : (
                            <button className="link" onClick={() => void replay(e, k)}>
                              重听
                            </button>
                          ))}
                        {d.zh && (
                          <button className="link" onClick={() => setShowZh((v) => !v)}>
                            {showZh ? "收起译文" : "看中文译文"}
                          </button>
                        )}
                      </div>
                    )}
                    {done && showZh && d.zh && <p className="essay-text exam-zh">{d.zh}</p>}
                  </article>
                ))}

              {ex.form === "opinions" && (
                <p className="exam-q" lang="fr">
                  À quelle personne associez-vous chaque point de vue ?
                </p>
              )}
              <ol className="exam-questions">
                {ex.questions.map((q, k) => {
                  const key = `${e}-${k}`;
                  const first = ex.docs.length > 1 && (k === 0 || ex.questions[k - 1].doc !== q.doc);
                  return (
                    <li key={k}>
                      {first && <p className="eyebrow">Document {q.doc + 1}</p>}
                      <p className="exam-q" lang="fr">
                        {q.q} <small>{num(q.pts)} pt</small>
                      </p>
                      <div className="exam-options" role="radiogroup" aria-label={`第 ${k + 1} 题`}>
                        {q.options.map((o, j) => {
                          const on = picked[key] === j;
                          const state = done ? (j === q.answer ? "is-right" : on ? "is-wrong" : "") : on ? "is-on" : "";
                          return (
                            <button key={j} role="radio" aria-checked={on} className={`exam-option ${state}`} disabled={done} lang="fr" onClick={() => setPicked((p) => ({ ...p, [key]: j }))}>
                              <span>{"ABC"[j]}</span>
                              {o}
                              {done && j === q.answer && <Check size={16} />}
                              {done && on && j !== q.answer && <X size={16} />}
                            </button>
                          );
                        })}
                      </div>
                      {done && q.why && <p className="exam-why">{q.why}</p>}
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}

        {!done && (
          <div className="writing-actions">
            <span className="essay-count">
              已答 {answered}/{all.length}
            </span>
            <button className="btn btn-primary btn-xl" onClick={finish} disabled={answered === 0}>
              交卷 <ArrowRight size={18} />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
