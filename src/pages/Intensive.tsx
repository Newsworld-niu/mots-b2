/**
 * 精听: after a paper (or on a real recording), the document again piece by piece: dictation sentence by
 * sentence or paragraph by paragraph, then shadowing (hear a sentence, say it, compare with your recording).
 */
import { Check, Mic, Play, RotateCcw, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { checkDictation, paragraphsOf, sentencesOf, type DictResult, type DictUnit } from "../lib/listening";
import { play, stopAudio } from "../lib/audio";
import type { Take } from "../lib/recorder";
import { AssessHint, AssessStatus, PronReport, TakePlayer, useAssess, useRecorder } from "../ui/Recording";
import "../styles/listening.css";

/** Read a piece aloud at `rate`; resolves when done. Absent when the audio is played outside the app. */
export type Speak = (text: string, rate: number, who?: string) => Promise<void>;

type Tab = "sentence" | "paragraph" | "shadow";
const TABS: [Tab, string][] = [
  ["sentence", "逐句听写"],
  ["paragraph", "段落听写"],
  ["shadow", "跟读"],
];

export function IntensiveDoc({ text, speak, initial = "sentence" }: { text: string; speak?: Speak; initial?: Tab }) {
  const [tab, setTab] = useState<Tab>(initial);
  return (
    <div className="intensive">
      <div className="segmented">
        {TABS.map(([t, zh]) => (
          <button key={t} className={tab === t ? "is-on" : ""} onClick={() => setTab(t)} aria-pressed={tab === t}>
            {zh}
          </button>
        ))}
      </div>
      {tab === "shadow" ? <Shadowing key={text} units={sentencesOf(text)} speak={speak} /> : <Dictation key={`${tab}:${text}`} units={tab === "sentence" ? sentencesOf(text) : paragraphsOf(text)} speak={speak} />}
    </div>
  );
}

const MARK_CLASS: Record<string, string> = { ok: "dict-ok", accent: "dict-accent", wrong: "dict-wrong", missing: "dict-missing" };

export function DictResultView({ r }: { r: DictResult }) {
  return (
    <p className="dict-result" lang="fr">
      {r.words.map((w, k) => (
        <span key={k} className={MARK_CLASS[w.mark]} title={w.mark === "accent" ? "重音符号不对" : w.mark === "wrong" ? "拼错了" : w.mark === "missing" ? "漏写了" : undefined}>
          {w.w}{" "}
        </span>
      ))}
      {r.extra.length > 0 && <span className="dict-extra">多写了：{r.extra.join(" ")}</span>}
    </p>
  );
}

/** Dictation of the units in order: listen (as often as needed, slower if needed), write, check. */
function Dictation({ units, speak }: { units: DictUnit[]; speak?: Speak }) {
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState("");
  const [results, setResults] = useState<(DictResult | null)[]>(() => units.map(() => null));
  const [busy, setBusy] = useState(false);
  const unit = units[i];
  const res = results[i];
  useEffect(() => () => stopAudio(), []);
  if (!units.length) return <p className="muted">这段原文没有可以听写的句子。</p>;

  const listen = async (rate: number) => {
    if (!speak) return;
    setBusy(true);
    await speak(unit.text, rate, unit.who);
    setBusy(false);
  };
  const check = () => setResults((r) => r.map((x, k) => (k === i ? checkDictation(typed, unit.text) : x)));
  const next = () => {
    stopAudio();
    setTyped("");
    setI((k) => k + 1);
  };
  const doneAll = i >= units.length;
  const scored = results.filter((r): r is DictResult => !!r);
  const avg = scored.length ? Math.round(scored.reduce((n, r) => n + r.score, 0) / scored.length) : 0;

  if (doneAll)
    return (
      <div className="intensive-done">
        <p>
          听写完成：{scored.length} 段，平均正确率 <strong>{avg}%</strong>。
        </p>
        <p className="muted small">红色是漏听或听错的地方，最值得回头再听；正确率到 90% 以上再换下一篇。</p>
        <button
          className="btn btn-ghost"
          onClick={() => {
            setResults(units.map(() => null));
            setI(0);
          }}
        >
          <RotateCcw size={16} /> 再听写一遍
        </button>
      </div>
    );

  return (
    <div className="intensive-unit">
      <p className="eyebrow">
        第 {i + 1}/{units.length} 段{unit.who ? ` · ${unit.who}` : ""}
        {scored.length > 0 && ` · 目前平均 ${avg}%`}
      </p>
      {speak ? (
        <div className="exam-doc-actions">
          <button className="btn btn-ghost" onClick={() => void listen(1)} disabled={busy}>
            <Play size={16} /> 听
          </button>
          <button className="btn btn-ghost" onClick={() => void listen(0.75)} disabled={busy}>
            <Play size={16} /> 慢速听
          </button>
          {busy && (
            <button className="btn btn-ghost" onClick={() => stopAudio()}>
              <Square size={16} /> 停
            </button>
          )}
        </div>
      ) : (
        <p className="muted small">用上面的播放器反复听这一段，再写下来。</p>
      )}
      <textarea className="essay-notes" lang="fr" rows={unit.text.length > 160 ? 5 : 3} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="听到什么写什么，听不出的词空着" disabled={!!res} spellCheck={false} autoCapitalize="off" autoCorrect="off" />
      {res && (
        <>
          <p className="muted small">正确率 {res.score}%（重音错算半个）</p>
          <DictResultView r={res} />
        </>
      )}
      <div className="exam-doc-actions">
        {!res ? (
          <>
            <button className="btn btn-primary" onClick={check}>
              <Check size={16} /> 核对
            </button>
            <button className="link" onClick={next}>
              跳过
            </button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={next}>
            {i + 1 < units.length ? "下一段" : "完成"}
          </button>
        )}
      </div>
    </div>
  );
}

/** Shadowing: hear the sentence, say it right after, listen to yourself, and run pronunciation assessment. */
function Shadowing({ units, speak }: { units: DictUnit[]; speak?: Speak }) {
  const [i, setI] = useState(0);
  const [showText, setShowText] = useState(true);
  const [busy, setBusy] = useState(false);
  const [take, setTake] = useState<Take | null>(null);
  const recorder = useRecorder();
  const pron = useAssess();
  const unit = units[i];
  useEffect(() => () => stopAudio(), []);
  if (!unit) return <p className="muted">没有可以跟读的句子。</p>;
  const go = (k: number) => {
    stopAudio();
    if (recorder.on) void recorder.stop();
    setTake(null);
    pron.reset();
    setBusy(false);
    setI(Math.max(0, Math.min(units.length - 1, k)));
  };
  const listen = async (rate = 1) => {
    setBusy(true);
    try {
      if (speak) await speak(unit.text, rate, unit.who);
      else await play(null, unit.text, "uk", rate);
    } finally {
      setBusy(false);
    }
  };
  const toggleRecord = async () => {
    if (recorder.on) {
      const t = await recorder.stop();
      setTake(t);
      if (t && pron.available) void pron.run(t.blob, unit.text);
    } else {
      stopAudio();
      setTake(null);
      pron.reset();
      await recorder.start();
    }
  };
  return (
    <div className="intensive-unit">
      <p className="eyebrow">
        第 {i + 1}/{units.length} 句{unit.who ? ` · ${unit.who}` : ""}
      </p>
      <p className="muted small">
        {speak
          ? "先听一遍，然后不看原文、紧跟着说一遍；录下来和原声比一比语调、连读和停顿。"
          : "当前材料来自上方原声播放器：可用上方播放器反复听原音跟读，也可点下方「TTS 示范朗读」听单句发音。"}
      </p>
      {showText ? (
        <p className="essay-text" lang="fr">
          {unit.text}
        </p>
      ) : (
        <p className="muted">（原文已隐藏）</p>
      )}
      <div className="exam-doc-actions">
        <button className="btn btn-ghost" onClick={() => void listen(1)} disabled={busy}>
          <Play size={16} /> {speak ? "听原句" : "TTS 示范朗读"}
        </button>
        {busy && (
          <button
            className="btn btn-ghost"
            onClick={() => {
              stopAudio();
              setBusy(false);
            }}
          >
            <Square size={16} /> 停
          </button>
        )}
        {recorder.supported && (
          <button className={recorder.on ? "btn btn-primary" : "btn btn-ghost"} onClick={() => void toggleRecord()}>
            {recorder.on ? (
              <>
                <Square size={16} /> 停止录音
              </>
            ) : (
              <>
                <Mic size={16} /> {take ? "重录" : "录我的跟读"}
              </>
            )}
          </button>
        )}
        <button className="link" onClick={() => setShowText((v) => !v)}>
          {showText ? "隐藏原文" : "显示原文"}
        </button>
      </div>
      <TakePlayer take={take} label="听我的跟读" />
      {take && (pron.available ? <AssessStatus a={pron} /> : <AssessHint />)}
      {pron.state === "done" && pron.result && <PronReport result={pron.result} title="跟读发音评测（对照原句）" />}
      <div className="exam-doc-actions">
        <button className="link" onClick={() => go(i - 1)} disabled={i === 0}>
          上一句
        </button>
        <button className="btn btn-primary" onClick={() => go(i + 1)} disabled={i + 1 >= units.length}>
          下一句
        </button>
      </div>
    </div>
  );
}
