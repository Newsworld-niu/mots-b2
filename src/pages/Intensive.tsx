/**
 * 精听: after a paper (or on a real recording), the document again piece by piece: dictation sentence by
 * sentence or paragraph by paragraph, then shadowing (hear a sentence, say it, compare with your recording).
 */
import { Check, Headphones, Mic, Play, RotateCcw, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { checkDictation, paragraphsFromUnits, paragraphsOf, sentencesOf, type DictDiag, type DictResult, type DictUnit } from "../lib/listening";
import { clock } from "../lib/exam";
import { play, stopAudio } from "../lib/audio";
import type { Take } from "../lib/recorder";
import { AccentKeys } from "../ui/AccentKeys";
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

/** Native audio slice player for pre-recorded broadcasts with sentence timestamps. */
export type SlicePlayer = (startSec: number, endSec: number, rate: number) => Promise<void>;

export function IntensiveDoc({
  text,
  speak,
  initial = "sentence",
  segments,
  playSlice,
}: {
  text: string;
  speak?: Speak;
  initial?: Tab;
  segments?: DictUnit[];
  playSlice?: SlicePlayer;
}) {
  const [tab, setTab] = useState<Tab>(initial);
  const sentUnits = useMemo(() => (segments?.length ? segments : sentencesOf(text)), [segments, text]);
  const paraUnits = useMemo(() => (segments?.length ? paragraphsFromUnits(segments) : paragraphsOf(text)), [segments, text]);
  return (
    <div className="intensive">
      <div className="segmented">
        {TABS.map(([t, zh]) => (
          <button key={t} className={tab === t ? "is-on" : ""} onClick={() => setTab(t)} aria-pressed={tab === t}>
            {zh}
          </button>
        ))}
      </div>
      {tab === "shadow" ? (
        <Shadowing key={text} units={sentUnits} speak={speak} playSlice={playSlice} />
      ) : (
        <Dictation key={`${tab}:${text}`} units={tab === "sentence" ? sentUnits : paraUnits} speak={speak} playSlice={playSlice} />
      )}
    </div>
  );
}

const MARK_CLASS: Record<string, string> = { ok: "dict-ok", accent: "dict-accent", wrong: "dict-wrong", missing: "dict-missing" };
const DIAG_LABEL: Record<DictDiag, string> = {
  accent: "重音符号",
  homophone_gram: "语法同音词（静音词尾 / 同音异形）",
  liaison_elision: "连诵 / 省音吞音（ne / l' / qu'）",
  lexical: "词汇漏听 / 实词拼写",
};
const DIAG_ORDER: DictDiag[] = ["liaison_elision", "homophone_gram", "accent", "lexical"];

export function DictResultView({ r }: { r: DictResult }) {
  const activeDiags = r.diagnostics ? DIAG_ORDER.filter((d) => (r.diagnostics[d] ?? 0) > 0) : [];
  return (
    <div className="intensive-unit">
      <p className="dict-result" lang="fr">
        {r.words.map((w, k) => {
          const baseHint = w.mark === "accent" ? "重音符号不对" : w.mark === "wrong" ? "拼写不一致" : w.mark === "missing" ? "漏写了" : undefined;
          const hint = w.diag && baseHint ? `${baseHint} · ${DIAG_LABEL[w.diag]}` : baseHint;
          return (
            <span key={k} className={MARK_CLASS[w.mark]} title={hint}>
              {w.w}{" "}
            </span>
          );
        })}
        {r.extra.length > 0 && <span className="dict-extra">多写了：{r.extra.join(" ")}</span>}
      </p>
      {activeDiags.length > 0 && (
        <div className="dict-diag-bar" aria-label="语音听写错因分类">
          {activeDiags.map((d) => (
            <span key={d} className={`dict-diag-chip is-${d}`}>
              {DIAG_LABEL[d]} ×{r.diagnostics[d]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Dictation of the units in order: listen (as often as needed, slower if needed), write, check. */
function Dictation({ units, speak, playSlice }: { units: DictUnit[]; speak?: Speak; playSlice?: SlicePlayer }) {
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState("");
  const [results, setResults] = useState<(DictResult | null)[]>(() => units.map(() => null));
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const unit = units[i];
  const res = results[i];
  useEffect(() => () => stopAudio(), []);
  if (!units.length) return <p className="muted">这段原文没有可以听写的句子。</p>;

  const hasSlice = Boolean(playSlice && unit && typeof unit.start === "number" && typeof unit.end === "number");
  const listen = async (rate: number) => {
    if (!speak && !hasSlice) return;
    setBusy(true);
    try {
      if (hasSlice && playSlice && unit) await playSlice(unit.start!, unit.end!, rate);
      else if (speak && unit) await speak(unit.text, rate, unit.who);
    } finally {
      setBusy(false);
    }
  };
  const jumpTo = (idx: number) => {
    stopAudio();
    setBusy(false);
    setTyped("");
    setI(Math.max(0, Math.min(units.length - 1, idx)));
  };
  const check = () => setResults((r) => r.map((x, k) => (k === i ? checkDictation(typed, unit.text) : x)));
  const next = () => {
    stopAudio();
    setBusy(false);
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
      <div className="intensive-head">
        <p className="eyebrow">
          第 {i + 1}/{units.length} 段{unit.who ? ` · ${unit.who}` : ""}
          {scored.length > 0 && ` · 目前平均 ${avg}%`}
        </p>
        {hasSlice && (
          <span className="chip intensive-chip">
            <Headphones size={13} /> {clock(Math.floor(unit.start!))}–{clock(Math.floor(unit.end!))} · 原声切片
          </span>
        )}
      </div>
      {units.length > 1 && (
        <label className="intensive-jump">
          <span className="muted small">定位句段：</span>
          <select aria-label="跳转到指定句子" value={i} onChange={(e) => jumpTo(Number(e.target.value))}>
            {units.map((u, idx) => (
              <option key={idx} value={idx}>
                {idx + 1}. {typeof u.start === "number" ? `[${clock(Math.floor(u.start))}] ` : ""}
                {u.text.length > 44 ? `${u.text.slice(0, 44)}…` : u.text}
              </option>
            ))}
          </select>
        </label>
      )}
      {hasSlice ? (
        <div className="exam-doc-actions">
          <button type="button" className="btn btn-ghost" onClick={() => void listen(1)} disabled={busy}>
            <Play size={16} /> 听原声切片
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void listen(0.75)} disabled={busy}>
            <Play size={16} /> 慢速原声 (0.75×)
          </button>
          {busy && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                stopAudio();
                setBusy(false);
              }}
            >
              <Square size={16} /> 停
            </button>
          )}
        </div>
      ) : speak ? (
        <div className="exam-doc-actions">
          <button type="button" className="btn btn-ghost" onClick={() => void listen(1)} disabled={busy}>
            <Play size={16} /> 听
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void listen(0.75)} disabled={busy}>
            <Play size={16} /> 慢速听
          </button>
          {busy && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                stopAudio();
                setBusy(false);
              }}
            >
              <Square size={16} /> 停
            </button>
          )}
        </div>
      ) : (
        <p className="muted small">用上面的播放器反复听这一段，再写下来。</p>
      )}
      <textarea ref={inputRef} className="essay-notes" lang="fr" rows={unit.text.length > 160 ? 5 : 3} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="听到什么写什么，听不出的词空着" disabled={!!res} spellCheck={false} autoCapitalize="off" autoCorrect="off" />
      {!res && <AccentKeys input={inputRef} value={typed} onChange={setTyped} />}
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
function Shadowing({ units, speak, playSlice }: { units: DictUnit[]; speak?: Speak; playSlice?: SlicePlayer }) {
  const [i, setI] = useState(0);
  const [showText, setShowText] = useState(true);
  const [busy, setBusy] = useState(false);
  const [take, setTake] = useState<Take | null>(null);
  const recorder = useRecorder();
  const pron = useAssess();
  const unit = units[i];
  useEffect(() => () => stopAudio(), []);
  if (!unit) return <p className="muted">没有可以跟读的句子。</p>;
  const hasSlice = Boolean(playSlice && typeof unit.start === "number" && typeof unit.end === "number");
  const go = (k: number) => {
    stopAudio();
    if (recorder.on) void recorder.stop();
    setTake(null);
    pron.reset();
    setBusy(false);
    setI(Math.max(0, Math.min(units.length - 1, k)));
  };
  const listenSlice = async (rate = 1) => {
    if (!hasSlice || !playSlice) return;
    setBusy(true);
    try {
      await playSlice(unit.start!, unit.end!, rate);
    } finally {
      setBusy(false);
    }
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
      <div className="intensive-head">
        <p className="eyebrow">
          第 {i + 1}/{units.length} 句{unit.who ? ` · ${unit.who}` : ""}
        </p>
        {hasSlice && (
          <span className="chip intensive-chip">
            <Headphones size={13} /> {clock(Math.floor(unit.start!))}–{clock(Math.floor(unit.end!))} · 原声切片
          </span>
        )}
      </div>
      {units.length > 1 && (
        <label className="intensive-jump">
          <span className="muted small">定位句段：</span>
          <select aria-label="跳转到指定句子" value={i} onChange={(e) => go(Number(e.target.value))}>
            {units.map((u, idx) => (
              <option key={idx} value={idx}>
                {idx + 1}. {typeof u.start === "number" ? `[${clock(Math.floor(u.start))}] ` : ""}
                {u.text.length > 44 ? `${u.text.slice(0, 44)}…` : u.text}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="muted small">
        {hasSlice
          ? "点击「听原声切片」直听电台原音对应这一句，随后不看原文紧跟着复述；录下来对照语调、连读与重音。"
          : speak
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
        {hasSlice && (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => void listenSlice(1)} disabled={busy}>
              <Play size={16} /> 听原声切片
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void listenSlice(0.8)} disabled={busy}>
              <Play size={16} /> 慢速原声 (0.8×)
            </button>
          </>
        )}
        <button type="button" className="btn btn-ghost" onClick={() => void listen(1)} disabled={busy}>
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
