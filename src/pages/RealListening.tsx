/**
 * 真实材料精听: a few minutes of a real programme (RFI, TV5Monde, France Culture…) worked through in four steps:
 * blind listening, questions, dictation sentence by sentence, shadowing. Only the link and the timestamps are
 * kept (and the transcript the learner pastes from the site, on this device); the audio stays on its site.
 */
import { ArrowLeft, ArrowRight, Check, ExternalLink, Plus, Rewind, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ready, useAiConfig } from "../ai/config";
import { questionsForTranscript } from "../ai/tasks";
import { clock, type CompExercise } from "../lib/exam";
import { parseClock, playerFor, REAL_SITES, type RealSource } from "../lib/listening";
import { href } from "../lib/router";
import { addSource, deleteSource, patchSource } from "../store/sources";
import { useStore } from "../store/store";
import { toast } from "../ui/Toast";
import { TranscriptWords } from "../ui/TranscriptWords";
import { IntensiveDoc } from "./Intensive";
import "../styles/listening.css";

const STEPS = ["盲听", "答题", "逐句听写", "跟读"] as const;
const day = (ms: number) => new Date(ms).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });

export function RealListening({ onExit }: { onExit: () => void }) {
  const sources = useStore((s) => s.progress.listenSources) ?? [];
  const [open, setOpen] = useState<string | null>(null);
  const cur = sources.find((s) => s.id === open);
  if (cur) return <Flow key={cur.id} src={cur} onBack={() => setOpen(null)} />;
  return (
    <div className="page practice">
      <header className="page-head">
        <button className="link deck-back" onClick={onExit}>
          <ArrowLeft size={16} /> 返回听力理解
        </button>
        <p className="eyebrow">真实材料精听</p>
        <h1 className="display">听真人说话。</h1>
        <p className="lede">从下面的网站挑一段 3–5 分钟的节目，把链接和起止时间存进来，再按「盲听 → 答题 → 逐句听写 → 跟读」走一遍。音频留在原网站，应用只存链接和时间点；原文由你从网站复制过来，只存在这台设备上。</p>
      </header>
      <section className="panel">
        <h3 className="eyebrow">去哪里找</h3>
        <ul className="essay-box-list">
          {REAL_SITES.map((s) => (
            <li key={s.url}>
              <a className="link" href={s.url} target="_blank" rel="noreferrer">
                {s.name} <ExternalLink size={12} />
              </a>{" "}
              <span className="muted small">{s.zh}</span>
            </li>
          ))}
        </ul>
        <p className="muted small">YouTube 链接和直接的音频/视频文件链接（.mp3、.mp4 等）可以在应用里按时间段播放；其他网页会在新窗口打开，按时间点自己拖进度。</p>
      </section>
      <AddSource onAdded={setOpen} />
      {sources.length > 0 && (
        <section className="essay-level">
          <h3 className="eyebrow">我的材料</h3>
          <ul className="bank-list">
            {sources.map((s) => (
              <li key={s.id}>
                <span>
                  {s.title} <span className="muted small">· {clock(s.start)}–{clock(s.end)}{s.transcript ? " · 有原文" : ""}{s.done ? ` · ${day(s.done)} 练过` : ""}</span>
                </span>
                <span className="exam-doc-actions">
                  <button className="link" onClick={() => setOpen(s.id)}>
                    开始 <ArrowRight size={14} />
                  </button>
                  <button className="link" onClick={() => confirm("删除这条材料？") && deleteSource(s.id)} title="删除">
                    <Trash2 size={14} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function AddSource({ onAdded }: { onAdded: (id: string) => void }) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("0:00");
  const [end, setEnd] = useState("4:00");
  const [transcript, setTranscript] = useState("");
  const add = () => {
    const a = parseClock(start);
    const b = parseClock(end);
    if (!/^https?:\/\//i.test(url.trim())) return toast("请填 http(s) 开头的链接", "warn");
    if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return toast("起止时间写成 分:秒，例如 1:30 到 5:00", "warn");
    onAdded(addSource({ url: url.trim(), title, start: a, end: b, transcript }));
  };
  return (
    <section className="panel real-flow">
      <h3 className="eyebrow">加一段材料</h3>
      <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="节目页面或音频链接 https://…" aria-label="链接" />
      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题（可不填）" aria-label="标题" />
      <div className="exam-doc-actions">
        <label>
          从 <input type="text" inputMode="numeric" size={6} value={start} onChange={(e) => setStart(e.target.value)} aria-label="开始时间" />
        </label>
        <label>
          到 <input type="text" inputMode="numeric" size={6} value={end} onChange={(e) => setEnd(e.target.value)} aria-label="结束时间" />
        </label>
      </div>
      <textarea className="essay-notes" rows={4} lang="fr" value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="原文（可选，之后也能补）：从网站复制这一段的文字稿，用于出题和听写" />
      <button className="btn btn-primary" onClick={add} disabled={!url.trim()}>
        <Plus size={16} /> 存下并开始
      </button>
    </section>
  );
}

/** The player of a source: in the app when it can be, else a link to the page at the right time. */
function Player({ src }: { src: RealSource }) {
  const p = playerFor(src.url, src.start, src.end);
  const media = useRef<HTMLMediaElement | null>(null);
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => () => void (local && URL.revokeObjectURL(local)), [local]);
  const back = (sec: number) => {
    const m = media.current;
    if (m) m.currentTime = Math.max(src.start, m.currentTime - sec);
  };
  const fromStart = () => {
    const m = media.current;
    if (!m) return;
    m.currentTime = src.start;
    void m.play();
  };
  // stop at the end of the part
  const onTime = () => {
    const m = media.current;
    if (m && src.end > src.start && m.currentTime >= src.end) m.pause();
  };
  const mediaSrc = local ? `${local}#t=${src.start},${src.end}` : p.kind === "media" ? p.src : null;
  return (
    <div className="exam-player real-flow">
      {p.kind === "youtube" && <iframe className="real-embed" src={p.src} title={src.title} allow="encrypted-media; picture-in-picture" allowFullScreen />}
      {mediaSrc &&
        (p.kind === "media" && p.video && !local ? (
          <video ref={(el) => void (media.current = el)} src={mediaSrc} controls preload="metadata" onTimeUpdate={onTime} style={{ width: "100%" }} />
        ) : (
          <audio ref={(el) => void (media.current = el)} src={mediaSrc} controls preload="metadata" onTimeUpdate={onTime} className="intensive-audio" />
        ))}
      {mediaSrc && (
        <div className="exam-doc-actions">
          <button className="btn btn-ghost" onClick={fromStart}>
            从 {clock(src.start)} 播放
          </button>
          <button className="btn btn-ghost" onClick={() => back(5)}>
            <Rewind size={16} /> 退 5 秒
          </button>
        </div>
      )}
      {p.kind === "page" && !local && (
        <p>
          <a className="btn btn-ghost" href={src.url} target="_blank" rel="noreferrer">
            <ExternalLink size={16} /> 打开原网页
          </a>{" "}
          <span className="muted small">
            从 {clock(src.start)} 听到 {clock(src.end)}。下载了音频的话，也可以选本地文件在这里播放（不会保存）：
          </span>
          <input type="file" accept="audio/*,video/*" onChange={(e) => e.target.files?.[0] && setLocal(URL.createObjectURL(e.target.files[0]))} aria-label="本地音频文件" />
        </p>
      )}
    </div>
  );
}

const GUIDE = ["Qui parle, et dans quel cadre (émission, reportage, interview) ?", "De quoi parle-t-on ? Quel est le problème posé ?", "Quels faits, chiffres ou exemples sont donnés ?", "Quelle est la position de chaque personne ? Y a-t-il un désaccord ?", "Quelle conclusion, ou quelle question reste ouverte ?"];

function Flow({ src, onBack }: { src: RealSource; onBack: () => void }) {
  const ai = useAiConfig();
  const [step, setStep] = useState(0);
  const [notes, setNotes] = useState(src.notes ?? "");
  const [draft, setDraft] = useState(src.transcript ?? "");
  const [quiz, setQuiz] = useState<CompExercise | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState(false);
  const [words, setWords] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => ctrl.current?.abort(), []);
  const text = src.transcript ?? "";

  const saveText = () => {
    patchSource(src.id, { transcript: draft });
    toast("原文已保存在这台设备上");
  };
  const makeQuiz = async () => {
    const c = new AbortController();
    ctrl.current = c;
    setBusy(true);
    try {
      setQuiz(await questionsForTranscript(text, c.signal));
      setPicked({});
      setChecked(false);
    } catch (e) {
      if (!c.signal.aborted) toast((e as Error).message || "出题失败", "warn");
    } finally {
      setBusy(false);
    }
  };
  const needText = (
    <div className="real-flow">
      <p className="muted">这一步需要原文：从节目网站复制文字稿贴在这里（RFI 和 TV5Monde 的很多练习都有）。</p>
      <textarea className="essay-notes" rows={6} lang="fr" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="粘贴原文" />
      <button className="btn btn-ghost" onClick={saveText} disabled={!draft.trim()}>
        保存原文
      </button>
    </div>
  );

  return (
    <div className="page practice">
      <section className="essay-stage">
        <header className="exam-top">
          <button className="btn btn-ghost" onClick={onBack}>
            <ArrowLeft size={16} /> 材料列表
          </button>
          <span className="eyebrow">{src.title}</span>
        </header>
        <div className="segmented segmented-wide">
          {STEPS.map((s, k) => (
            <button key={s} className={step === k ? "is-on" : ""} onClick={() => setStep(k)} aria-pressed={step === k}>
              {k + 1}. {s}
            </button>
          ))}
        </div>
        <Player src={src} />

        {step === 0 && (
          <div className="real-flow">
            <p className="muted">不看原文，听两遍。像考试一样，用法语或中文记下听懂的要点，可以参考这几个问题：</p>
            <ol className="essay-box-list" lang="fr">
              {GUIDE.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ol>
            <textarea className="essay-notes" rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => patchSource(src.id, { notes })} placeholder="我听懂的内容…" />
          </div>
        )}

        {step === 1 &&
          (!text ? (
            needText
          ) : quiz ? (
            <div className="real-flow">
              <ol className="exam-questions">
                {quiz.questions.map((q, k) => (
                  <li key={k}>
                    <p className="exam-q" lang="fr">
                      {q.q}
                    </p>
                    <div className="exam-options" role="radiogroup">
                      {q.options.map((o, j) => {
                        const on = picked[k] === j;
                        const state = checked ? (j === q.answer ? "is-right" : on ? "is-wrong" : "") : on ? "is-on" : "";
                        return (
                          <button key={j} role="radio" aria-checked={on} className={`exam-option ${state}`} disabled={checked} lang="fr" onClick={() => setPicked((p) => ({ ...p, [k]: j }))}>
                            <span>{"ABC"[j]}</span>
                            {o}
                            {checked && j === q.answer && <Check size={16} />}
                            {checked && on && j !== q.answer && <X size={16} />}
                          </button>
                        );
                      })}
                    </div>
                    {checked && q.why && <p className="exam-why">{q.why}</p>}
                  </li>
                ))}
              </ol>
              {!checked ? (
                <button className="btn btn-primary" onClick={() => setChecked(true)}>
                  核对
                </button>
              ) : (
                <p>
                  对了 {quiz.questions.filter((q, k) => picked[k] === q.answer).length}/{quiz.questions.length} 题。
                  <span className="muted small"> 题目由 AI 根据原文出，未经人工核对。</span>
                </p>
              )}
            </div>
          ) : ready.text(ai) ? (
            <div className="real-flow">
              <p className="muted">AI 根据原文按考试题型出 7 道选择题（只看题，不看原文，可以再听一遍再答）。</p>
              <button className="btn btn-primary" onClick={() => void makeQuiz()} disabled={busy}>
                {busy ? "出题中…" : "出题"}
              </button>
            </div>
          ) : (
            <div className="real-flow">
              <p className="muted">
                没有设置 AI（<a className="link" href={href({ page: "me" })}>我的 → AI 接口</a>），那就对照第 1 步的问题和自己的笔记读原文，看漏了什么：
              </p>
              <p className="essay-text" lang="fr">
                {text}
              </p>
            </div>
          ))}

        {(step === 2 || step === 3) && (!text ? needText : <IntensiveDoc key={step} text={text} initial={step === 2 ? "sentence" : "shadow"} />)}

        {text && (
          <div className="exam-doc-actions">
            <button className="link" onClick={() => setWords((v) => !v)}>
              原文生词入库
            </button>
          </div>
        )}
        {words && text && <TranscriptWords text={text} onClose={() => setWords(false)} />}

        <div className="writing-actions">
          {step < 3 ? (
            <button className="btn btn-primary" onClick={() => setStep(step + 1)}>
              下一步：{STEPS[step + 1]} <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => {
                patchSource(src.id, { done: Date.now(), notes });
                toast("这段材料练完了");
                onBack();
              }}
            >
              <Check size={16} /> 练完了
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
