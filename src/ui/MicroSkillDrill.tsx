import { ArrowLeft, ArrowRight, Check, Headphones, Play, RotateCcw, Square, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { play, stopAudio } from "../lib/audio";
import { clock } from "../lib/exam";
import { go } from "../lib/router";
import { useNavGuard } from "../lib/nav-guard";
import { useTimer } from "../lib/timer";
import { MICRO_SKILL_TRACKS, gradeMicroItem, microItemToMiss } from "../lib/micro-skills";
import { addMisses } from "../store/misses";
import type { CompMiss } from "../lib/listening";
import { useStore } from "../store/store";
import { toast } from "./Toast";

/** 5-minute CO/CE high-weight micro-skill drill pushing misses straight to MistakeReflow. */
export function MicroSkillDrill({ trackId, onExit }: { trackId: string; onExit: () => void }) {
  const normalizedId = trackId === "ce-quote" ? "ce-restrict" : trackId;
  const track = MICRO_SKILL_TRACKS.find((t) => t.id === normalizedId) ?? MICRO_SKILL_TRACKS[0];
  const accent = useStore((s) => s.settings.accent);
  const timer = useTimer();
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | undefined>(undefined);
  const [submitted, setSubmitted] = useState(false);
  const [verdict, setVerdict] = useState<{ correct: boolean; choiceOk?: boolean; quoteMatched?: boolean } | null>(null);
  const [misses, setMisses] = useState<CompMiss[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [savedMisses, setSavedMisses] = useState(false);

  useEffect(() => {
    timer.start(track.minutes * 60);
    return () => {
      timer.stop();
      stopAudio();
    };
  }, [track.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const item = track.items[idx];
  const done = idx >= track.items.length;
  useNavGuard(!done && (idx > 0 || picked !== undefined), "微技能 5 分钟专训尚未完成，确定离开？");

  const togglePlay = async (rate = 1) => {
    if (!item || track.part !== "listen") return;
    if (playing) {
      stopAudio();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    try {
      await play(null, item.text, accent, rate);
    } finally {
      setPlaying(false);
    }
  };

  const submit = () => {
    if (!item || submitted || picked === undefined) return;
    stopAudio();
    setPlaying(false);
    const res = gradeMicroItem(item, picked);
    setVerdict(res);
    setSubmitted(true);
    if (res.correct) {
      setCorrectCount((n) => n + 1);
    } else {
      setMisses((prev) => [...prev, microItemToMiss(track, item, Date.now())]);
    }
  };

  const next = () => {
    stopAudio();
    setPlaying(false);
    const nextIdx = idx + 1;
    if (nextIdx >= track.items.length && misses.length > 0 && !savedMisses) {
      addMisses(misses);
      setSavedMisses(true);
      toast(`已将 ${misses.length} 道错题写入错题中心（Tab 4），可随时重练`, "info");
    }
    if (nextIdx >= track.items.length) timer.stop();
    setPicked(undefined);
    setSubmitted(false);
    setVerdict(null);
    setIdx(nextIdx);
  };

  if (done) {
    return (
      <div className="page practice">
        <section className="panel typing-done micro-drill-card">
          <p className="eyebrow">微技能专训完成 · {track.badge}</p>
          <h1 className="display">
            {correctCount} / {track.items.length} <small>题精准命中</small>
          </h1>
          <p className="muted">
            {misses.length === 0
              ? "全对过关！这类高权重题型的定位与防干扰能力已稳。"
              : `错掉的 ${misses.length} 题已附带题干与原文摘要自动同步至错题中心（#/reflow 第 4 页签）。`}
          </p>
          <div className="summary-actions">
            {misses.length > 0 && (
              <button type="button" className="btn btn-primary" onClick={() => go({ page: "reflow" })}>
                前往错题中心重练 <ArrowRight size={16} />
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setIdx(0);
                setCorrectCount(0);
                setMisses([]);
                setSavedMisses(false);
                timer.start(track.minutes * 60);
              }}
            >
              <RotateCcw size={16} /> 再练一遍
            </button>
            <button type="button" className="btn btn-ghost" onClick={onExit}>
              返回练习首页
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page practice">
      <section className="panel micro-drill-card">
        <header className="exam-top">
          <button type="button" className="btn btn-ghost" onClick={onExit}>
            <ArrowLeft size={16} /> 返回
          </button>
          <span className="eyebrow">
            {track.title} · 第 {idx + 1}/{track.items.length} 题
          </span>
          <span className={`exam-clock ${timer.sec <= 30 ? "is-over" : ""}`}>{clock(timer.sec)}</span>
        </header>

        {track.part === "listen" ? (
          <div className="placement-audio">
            <div className="placement-audio-row">
              <Headphones size={18} />
              <div>
                <b>听音频作答（聚焦语气词、数字或同义改写）</b>
                <small className="muted">提交后才展开参考听力原文</small>
              </div>
              <div className="writing-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => void togglePlay(1)}>
                  {playing ? <Square size={14} /> : <Play size={14} />} {playing ? "停止" : "播放音频"}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void togglePlay(0.85)} disabled={playing}>
                  <Volume2 size={14} /> 0.85x 慢速
                </button>
              </div>
            </div>
            {submitted && (
              <blockquote className="placement-transcript" lang="fr">
                <b>听力原文：</b>
                {item.text}
              </blockquote>
            )}
          </div>
        ) : (
          <blockquote className="essay-doc micro-ce-passage" lang="fr">
            {item.text}
          </blockquote>
        )}

        <p className="placement-prompt" lang="fr">
          <span className="chip">QCM 三选一</span> {item.q}
        </p>

        <div className="placement-opts">
          {item.options.map((opt, oi) => {
            const on = picked === oi;
            const cls = submitted
              ? oi === item.answer
                ? "is-answer"
                : on
                  ? "is-chosen"
                  : ""
              : on
                ? "is-on"
                : "";
            return (
              <button
                key={oi}
                type="button"
                lang="fr"
                disabled={submitted}
                aria-pressed={on}
                className={`placement-opt ${cls}`}
                onClick={() => setPicked(oi)}
              >
                <span>{String.fromCharCode(65 + oi)}.</span> {opt}
                {submitted && item.trapTypes?.[oi] && (
                  <small className="muted" lang="zh-CN">
                    {" · "}
                    {item.trapTypes[oi]}
                  </small>
                )}
              </button>
            );
          })}
        </div>

        {!submitted ? (
          <button type="button" className="btn btn-primary btn-xl" disabled={picked === undefined} onClick={submit}>
            <Check size={16} /> 提交判定
          </button>
        ) : (
          verdict && (
            <div className={`conj-feedback is-${verdict.correct ? "right" : "wrong"}`} role="status">
              <p className="feedback-verdict">
                {verdict.correct ? "完全命中！" : `未命中 · 正确答案：${item.options[item.answer]}`}
              </p>
              {item.evidence && (
                <p className="muted small" lang="fr">
                  原文依据句：「{item.evidence}」
                </p>
              )}
              <p className="muted small">{item.why}</p>
              <button type="button" className="btn btn-primary" onClick={next}>
                {idx + 1 >= track.items.length ? "查看专训总结" : "下一题"} <ArrowRight size={16} />
              </button>
            </div>
          )
        )}
      </section>
    </div>
  );
}
