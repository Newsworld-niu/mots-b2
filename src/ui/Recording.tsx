/**
 * Recording and pronunciation assessment pieces shared by 口语 and 每日一分钟口语: a recorder hook that keeps the
 * session's recordings as object URLs, a player, an assessment hook (Azure) and the report of its scores.
 */
import { Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { canAssess, assessRecording } from "../ai/pronunciation";
import { play } from "../lib/audio";
import { ERROR_LABEL, overall, phonoGateInfo, phonemeInsights, SCORE_HINT, SCORE_KEYS, SCORE_LABEL, weakWords, type PronResult } from "../lib/pronunciation";
import { canRecord, startRecording, type Recording, type Take } from "../lib/recorder";
import { LEVEL_LABEL } from "../lib/essay";
import { href } from "../lib/router";
import { toast } from "./Toast";
import "../styles/speech.css";

/**
 * Record the microphone. `start()` resolves false when recording could not begin (no permission, no microphone;
 * already told to the learner). Every take's object URL lives until the component unmounts.
 */
export function useRecorder() {
  const [on, setOn] = useState(false);
  const pending = useRef<Promise<Recording | null> | null>(null);
  const urls = useRef<string[]>([]);
  useEffect(
    () => () => {
      void pending.current?.then((r) => r?.cancel());
      urls.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );
  const start = useCallback(async () => {
    if (pending.current) return true;
    const p = startRecording().catch((e: Error) => {
      toast(e.message, "warn");
      return null;
    });
    pending.current = p;
    const r = await p;
    if (!r) {
      if (pending.current === p) pending.current = null;
      return false;
    }
    setOn(true);
    return true;
  }, []);
  const stop = useCallback(async (): Promise<Take | null> => {
    const p = pending.current;
    pending.current = null;
    setOn(false);
    const r = p ? await p : null;
    const take = r ? await r.stop() : null;
    if (take) urls.current.push(take.url);
    return take;
  }, []);
  return { supported: canRecord(), on, start, stop };
}

export type AssessState = { state: "idle" } | { state: "busy"; done: number; total: number } | { state: "done"; result: PronResult | null } | { state: "failed"; error: string };

/** Assess takes with Azure; one at a time per hook, cancelled on unmount. */
export function useAssess() {
  const [s, setS] = useState<AssessState>({ state: "idle" });
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => ctrl.current?.abort(), []);
  const run = useCallback(async (blob: Blob, referenceText?: string): Promise<PronResult | null> => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setS({ state: "busy", done: 0, total: 1 });
    try {
      const result = await assessRecording(blob, (done, total) => !c.signal.aborted && setS({ state: "busy", done, total }), c.signal, referenceText);
      if (c.signal.aborted) return null;
      setS({ state: "done", result });
      return result;
    } catch (e) {
      if (c.signal.aborted) return null;
      setS({ state: "failed", error: (e as Error).message || "评测失败" });
      return null;
    }
  }, []);
  const reset = useCallback(() => {
    ctrl.current?.abort();
    setS({ state: "idle" });
  }, []);
  return { ...s, run, reset, available: canAssess() };
}

export function TakePlayer({ take, label = "听自己的录音" }: { take: Take | null | undefined; label?: string }) {
  if (!take) return null;
  return (
    <div className="take">
      <span className="muted small">
        {label}（{take.seconds} 秒）
      </span>
      <audio controls preload="metadata" src={take.url} />
    </div>
  );
}

/** Why there is no assessment, or how to get one. */
export function AssessHint() {
  return (
    <p className="muted small">
      发音评测用 Azure 语音服务（准确度、流利度、韵律、完整度）：到 <a className="link" href={href({ page: "me" })}>我的 → AI 接口</a> 填 Azure 的 Key 和区域后可用。
    </p>
  );
}

/** Progress, error or result of an assessment. */
export function AssessStatus({ a }: { a: AssessState }) {
  if (a.state === "busy") return <p className="muted small">Azure 发音评测中{a.total > 1 ? `（第 ${Math.min(a.done + 1, a.total)}/${a.total} 段）` : ""}…</p>;
  if (a.state === "failed") return <p className="muted small">发音评测失败：{a.error}</p>;
  if (a.state === "done" && !a.result) return <p className="muted small">Azure 没有听出法语：录音太短、太轻或背景太吵。</p>;
  return null;
}

/** The scores of an assessment and the words to practise. */
export function PronReport({ result, title = "发音评测（Azure）" }: { result: PronResult; title?: string }) {
  const total = overall(result);
  const gate = phonoGateInfo(result);
  const level = gate.level;
  const weak = weakWords(result.words);
  const insights = phonemeInsights(result.words);
  return (
    <div className="essay-box pron-report">
      <p className="eyebrow">{title}</p>
      <div className="essay-marks">
        <p className="essay-total">
          {total === null ? "—" : Math.round(total)}
          <small>/100</small>
        </p>
        <dl className="essay-scores">
          {SCORE_KEYS.map((k) => {
            const v = result[k];
            return (
              <div key={k} title={SCORE_HINT[k]}>
                <dt>{SCORE_LABEL[k]}</dt>
                <dd>
                  <span className="essay-bar">
                    <span style={{ width: `${v ?? 0}%` }} />
                  </span>
                  {v === null ? "无" : Math.round(v)}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
      {level !== null && (
        <p className="muted small">
          折合评分表第五项（发音和语调）约 {level}/5 · {LEVEL_LABEL[level]}。
          {gate.gatedBy === "prosody"
            ? `（虽综合分达标，但韵律/语调重音 ${Math.round(result.prosody ?? 0)} 分未过门控线，已由 ${gate.rawLevel} 下调至 ${level}）`
            : gate.gatedBy === "accuracy_or_fluency"
              ? `（音准或流利度未达 B2+ 门控线，已由 ${gate.rawLevel} 下调至 ${level}）`
              : "这是按总分与韵律门控换算的估计，考试由考官凭听感评。"}
        </p>
      )}
      {insights.length > 0 && (
        <div className="essay-box">
          <p className="eyebrow">音素与联诵诊断（中文考生高频易错点）</p>
          <ul className="essay-check essay-box-list">
            {insights.map((ins) => (
              <li key={ins.id}>
                <b>
                  {ins.label}：{ins.avg}/100
                </b>{" "}
                {ins.examples.length > 0 ? `偏弱词例：${ins.examples.join("、")}。` : "总体稳定。"}
                <small className="muted">{ins.tip}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
      {weak.length > 0 ? (
        <>
          <p className="muted small">这些词发得不够准（分数越低越要练），点一下听标准读音：</p>
          <ul className="pron-words">
            {weak.map((w, k) => (
              <li key={k}>
                <button className="link" lang="fr" onClick={() => void play(null, w.word)} aria-label={`听 ${w.word}`}>
                  <Volume2 size={13} /> {w.word}
                </button>
                <small>
                  {Math.round(w.accuracy)}
                  {w.error && w.error !== "None" ? ` · ${ERROR_LABEL[w.error] ?? w.error}` : ""}
                </small>
              </li>
            ))}
          </ul>
        </>
      ) : (
        result.words.length > 0 && <p className="muted small">每个词的准确度都在 60 分以上。</p>
      )}
      {result.text && (
        <details className="essay-fold">
          <summary>Azure 听到的内容</summary>
          <p className="essay-text" lang="fr">
            {result.text}
          </p>
        </details>
      )}
    </div>
  );
}
