import { ArrowLeft, ArrowRight, Check, Headphones, PenLine, Play, RotateCcw, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { play, stopAudio } from "../lib/audio";
import { countWords } from "../lib/essay-schema";
import { clock } from "../lib/exam";
import {
  PLACEMENT_AUDIO,
  PLACEMENT_ESTIMATE,
  PLACEMENT_PASSAGE,
  PLACEMENT_PRODUCTION_PROMPT,
  PLACEMENT_QUESTIONS,
  SECTION_META,
  placementToExamResults,
  scorePlacement,
  type PlacementResult,
  type PlacementSection,
} from "../lib/placement";
import { logExam } from "../store/essays";
import { AccentKeys } from "./AccentKeys";
import { useStore } from "../store/store";

const SECTIONS: PlacementSection[] = ["vocab", "grammar", "read", "listen"];
const LEVEL_NAMES = ["A1 入门", "A2 基础", "B1 进阶", "B2 中高"] as const;
const LEVEL_CODES = ["A1", "A2", "B1", "B2"] as const;

export interface PlacementTestProps {
  initial?: PlacementResult;
  onApply: (res: PlacementResult) => void;
  onCancel: () => void;
}

export function PlacementTest({ initial, onApply, onCancel }: PlacementTestProps) {
  const accent = useStore((s) => s.settings.accent);
  const [step, setStep] = useState<number>(0); // 0..3 = sections, 4 = report
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [skipListen, setSkipListen] = useState(false);
  const [plays, setPlays] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [writeStep, setWriteStep] = useState(false);
  const [prodText, setProdText] = useState("");
  const [prodSec, setProdSec] = useState(0);
  const [result, setResult] = useState<PlacementResult | null>(null);
  const prodRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (step >= SECTIONS.length && !writeStep) return;
    const id = window.setInterval(() => {
      setElapsed((t) => t + 1);
      if (writeStep) setProdSec((t) => Math.min(180, t + 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [step, writeStep]);

  useEffect(() => () => stopAudio(), []);

  const currentSection = SECTIONS[step];
  const sectionQuestions = currentSection ? PLACEMENT_QUESTIONS.filter((q) => q.section === currentSection) : [];
  const answeredInSection = sectionQuestions.filter((q) => answers[q.id] !== undefined).length;
  const totalAnswered = Object.keys(answers).length;

  const choose = (qid: string, idx: number) => setAnswers((prev) => ({ ...prev, [qid]: idx }));

  const togglePlay = async () => {
    if (playing) {
      stopAudio();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    setPlays((n) => n + 1);
    try {
      await play(null, PLACEMENT_AUDIO.script, accent);
    } finally {
      setPlaying(false);
    }
  };

  const finish = (skipped = false, withWriting = false) => {
    stopAudio();
    setPlaying(false);
    setSkipListen(skipped);
    setWriteStep(false);
    const res = scorePlacement(answers, skipped, Date.now(), withWriting ? prodText : undefined);
    setResult(res);
    setStep(SECTIONS.length);
  };

  const restart = () => {
    stopAudio();
    setPlaying(false);
    setAnswers({});
    setSkipListen(false);
    setWriteStep(false);
    setProdText("");
    setProdSec(0);
    setPlays(0);
    setElapsed(0);
    setResult(null);
    setStep(0);
  };

  if (writeStep) {
    const wc = countWords(prodText);
    const remain = Math.max(0, 180 - prodSec);
    return (
      <div className="placement">
        <div className="placement-top">
          <button type="button" className="link" onClick={() => setWriteStep(false)}>
            <ArrowLeft size={16} /> 返回听力题
          </button>
          <span className={`exam-clock ${remain === 0 ? "is-over" : ""}`}>
            建议剩余 {clock(remain)} · 当前 {wc} 词
          </span>
        </div>
        <div className="placement-prod-box">
          <p className="eyebrow">
            <PenLine size={14} /> {PLACEMENT_PRODUCTION_PROMPT.title}
          </p>
          <p className="essay-consigne" lang="fr">
            {PLACEMENT_PRODUCTION_PROMPT.questionFr}
          </p>
          <p className="muted small">{PLACEMENT_PRODUCTION_PROMPT.tipZh}</p>
          <textarea
            ref={prodRef}
            className="writing-input"
            lang="fr"
            rows={5}
            value={prodText}
            onChange={(e) => setProdText(e.target.value.slice(0, 1200))}
            placeholder="在这里写 60–90 词法语观点（选做）…"
            spellCheck={false}
            aria-label="3 分钟微写作诊断输入框"
          />
          <AccentKeys input={prodRef} value={prodText} onChange={setProdText} />
        </div>
        <div className="placement-nav">
          <button type="button" className="btn btn-ghost" onClick={() => finish(false, false)}>
            跳过微写作，直接生成报告
          </button>
          <button type="button" className="btn btn-primary" disabled={wc < 5} onClick={() => finish(false, true)}>
            提交微写作并生成报告（{wc} 词） <Check size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (step === SECTIONS.length && result) {
    const breakdown: { key: PlacementSection; label: string; score: number | null }[] = [
      { key: "vocab", label: SECTION_META.vocab.label, score: result.sections.vocab },
      { key: "grammar", label: SECTION_META.grammar.label, score: result.sections.grammar },
      { key: "read", label: SECTION_META.read.label, score: result.sections.read },
      { key: "listen", label: SECTION_META.listen.label, score: result.sections.listen },
    ];
    const missed = PLACEMENT_QUESTIONS.filter((q) => (!skipListen || q.section !== "listen") && answers[q.id] !== q.answer);

    return (
      <div className="placement">
        <div className="placement-head">
          <div>
            <p className="eyebrow">摸底定级报告 · 未核验初评估算</p>
            <h3>
              推荐起点：<span className={`chip chip-level lv-${LEVEL_CODES[result.level]}`}>{LEVEL_NAMES[result.level]}</span>
            </h3>
          </div>
          <span className="placement-score">
            <b>{result.score}</b>
            <small>/ 100 · 用时 {clock(elapsed)}</small>
          </span>
        </div>

        <p className="muted small">
          说明：定级小测属于离线快速摸底估算（标记为未核验参考），不会混入正式 DELF B2 四科实测总分。
        </p>

        <p className="muted">
          {result.weak.length
            ? `初步薄弱项：${result.weak.map((k) => SECTION_META[k].label).join("、")}。已为您同步到首页备考调度，建议优先补齐短板。`
            : "四项基础整体均衡，可直接从推荐级别开始并按真题模式刷套卷冲刺。"}
        </p>

        <ul className="placement-bars">
          {breakdown.map((b) => (
            <li key={b.key}>
              <div className="placement-bar-label">
                <span>{b.label}</span>
                <b>{b.score === null ? "已跳过" : `${b.score}%`}</b>
              </div>
              <div className="placement-track" aria-hidden="true">
                <i style={{ width: `${b.score ?? 0}%` }} className={b.score !== null && b.score < 65 ? "is-weak" : ""} />
              </div>
            </li>
          ))}
        </ul>

        {result.production && (
          <div className="placement-prod-report">
            <p className="eyebrow">
              选做微写作诊断 · 表达参考等级 <span className={`chip chip-level lv-${result.production.band}`}>{result.production.band}</span>（{result.production.score}/100 · {result.production.words} 词 · {result.production.connectors} 处连接词）
            </p>
            <p className="muted small">{result.production.notes.join(" ")}</p>
          </div>
        )}

        {missed.length > 0 && (
          <details className="placement-review">
            <summary>查看错题解析（{missed.length} 题）与听力原文</summary>
            <div className="placement-review-list">
              {!skipListen && (
                <blockquote className="placement-transcript" lang="fr">
                  <b>听力原文：</b>
                  {PLACEMENT_AUDIO.script}
                </blockquote>
              )}
              {missed.map((q) => (
                <div key={q.id} className="placement-miss">
                  <p lang="fr">
                    <span className="chip">{q.level}</span> {q.prompt}
                  </p>
                  <p className="small">
                    正确答案：<b lang="fr">{q.options[q.answer]}</b>
                    {answers[q.id] !== undefined ? `（你选了：${q.options[answers[q.id]]}）` : "（未作答）"}
                  </p>
                  <p className="muted small">{q.why}</p>
                </div>
              ))}
            </div>
          </details>
        )}

        <div className="placement-actions">
          <button
            className="btn btn-primary btn-xl"
            onClick={() => {
              for (const entry of placementToExamResults(result)) {
                logExam(entry);
              }
              onApply(result);
            }}
          >
            <Check size={18} /> 采纳推荐起点（{LEVEL_CODES[result.level]}）并保存
          </button>
          <div className="placement-sub-actions">
            <button className="btn btn-ghost" onClick={restart}>
              <RotateCcw size={16} /> 重测一次
            </button>
            <button className="btn btn-ghost" onClick={onCancel}>
              取消返回
            </button>
          </div>
        </div>
      </div>
    );
  }

  const meta = SECTION_META[currentSection];

  return (
    <div className="placement">
      <div className="placement-top">
        <button className="link" onClick={() => { stopAudio(); onCancel(); }}>
          <ArrowLeft size={16} /> 返回
        </button>
        <span className="muted small">
          摸底定级小测（{PLACEMENT_ESTIMATE}）· 已答 {totalAnswered}/{PLACEMENT_QUESTIONS.length} · {clock(elapsed)}
        </span>
      </div>

      {initial && step === 0 && totalAnswered === 0 && (
        <p className="muted small">上次定级：{LEVEL_NAMES[initial.level]}（{initial.score}%），重测将更新你的定级与薄弱项评估。</p>
      )}

      <div className="placement-steps" role="tablist" aria-label="定级板块">
        {SECTIONS.map((s, idx) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={idx === step}
            className={`placement-tab ${idx === step ? "is-on" : idx < step ? "is-done" : ""}`}
            onClick={() => {
              stopAudio();
              setPlaying(false);
              setStep(idx);
            }}
          >
            {idx + 1}. {SECTION_META[s].label}
          </button>
        ))}
      </div>

      <div className="placement-sec-head">
        <h3>
          第 {step + 1} / {SECTIONS.length} 部分：{meta.label}
        </h3>
        <span className="muted small" lang="fr">
          {meta.fr} · 建议 {meta.minutes}
        </span>
      </div>

      {currentSection === "read" && (
        <article className="placement-passage" lang="fr">
          <header>
            <b>{PLACEMENT_PASSAGE.title}</b>
            <small>{PLACEMENT_PASSAGE.source}</small>
          </header>
          {PLACEMENT_PASSAGE.text.split("\n\n").map((para, idx) => (
            <p key={idx}>{para}</p>
          ))}
        </article>
      )}

      {currentSection === "listen" && (
        <div className="placement-audio">
          <div className="placement-audio-row">
            <Headphones size={18} />
            <div>
              <b lang="fr">{PLACEMENT_AUDIO.title}</b>
              <small className="muted">建议先审题，再听 1–2 遍音频作答（已播放 {plays} 遍）。</small>
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={togglePlay}>
              {playing ? <Square size={14} /> : <Play size={14} />} {playing ? "停止" : "播放音频"}
            </button>
          </div>
          <button type="button" className="link small" onClick={() => finish(true)}>
            当前环境不方便听音？跳过听力直接生成定级报告 →
          </button>
        </div>
      )}

      <ol className="placement-qs">
        {sectionQuestions.map((q, qi) => (
          <li key={q.id} className="placement-q">
            <p className="placement-prompt" lang="fr">
              <span className="chip">{q.level}</span> {qi + 1}. {q.prompt}
            </p>
            <div className="placement-opts">
              {q.options.map((opt, oi) => {
                const picked = answers[q.id] === oi;
                return (
                  <button
                    key={oi}
                    type="button"
                    lang="fr"
                    className={`placement-opt ${picked ? "is-on" : ""}`}
                    aria-pressed={picked}
                    onClick={() => choose(q.id, oi)}
                  >
                    <span>{String.fromCharCode(65 + oi)}.</span> {opt}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      <div className="placement-nav">
        {step > 0 && (
          <button type="button" className="btn btn-ghost" onClick={() => { stopAudio(); setPlaying(false); setStep(step - 1); }}>
            <ArrowLeft size={16} /> 上一部分
          </button>
        )}
        {step < SECTIONS.length - 1 ? (
          <button type="button" className="btn btn-primary" onClick={() => setStep(step + 1)}>
            下一部分（{answeredInSection}/{sectionQuestions.length}） <ArrowRight size={16} />
          </button>
        ) : (
          <div className="writing-actions">
            <button type="button" className="btn btn-ghost" onClick={() => finish(false, false)}>
              直接生成定级报告（{answeredInSection}/{sectionQuestions.length}）
            </button>
            <button type="button" className="btn btn-primary" onClick={() => { stopAudio(); setPlaying(false); setWriteStep(true); }}>
              下一步：3 分钟微写作诊断（选做） <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
