/**
 * Recording, silence VAD, interactive word-seek transcript, and multi-tier pronunciation assessment UI
 * shared by 口语 (PO) and 每日一分钟口语:
 *  - Tier 1 (Azure AI Speech): IPA phoneme accuracy colors, `‿` obligatory liaison misses, `×` forbidden / *h aspiré*
 *    liaison alerts, `⏸` ≥1s pause badges, and click-to-seek (`audio.currentTime = offsetMs / 1000`).
 *  - Tier 2 (Whisper `verbose_json`): verbatim transcript + word-timestamp seek + WPM/pause/freeze metrics.
 */
import { Volume2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ready } from "../ai/config";
import { assessRecording, canAssess, canAssessOrTranscribe } from "../ai/pronunciation";
import { play } from "../lib/audio";
import { LEVEL_LABEL } from "../lib/essay";
import {
  ERROR_LABEL,
  evaluateWordBoundaries,
  overall,
  phonoGateInfo,
  phonemeInsights,
  SCORE_HINT,
  SCORE_KEYS,
  SCORE_LABEL,
  summarizeAcoustics,
  weakWords,
  type PronResult,
  type PronWord,
} from "../lib/pronunciation";
import { canRecord, startRecording, type Recording, type Take } from "../lib/recorder";
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

/**
 * Optional Voice Activity Detection (VAD) silence monitor for debate auto-turn-end:
 * waits until speech is detected (via Web Audio RMS energy or live caption growth), then triggers `onSilence`
 * once continuous silence reaches `silenceMs` (default 2200ms). Avoids opening a second mic stream on iOS
 * where dual `getUserMedia` streams can mute `MediaRecorder`.
 */
export function useSilenceVad({
  enabled,
  active,
  speechText,
  silenceMs = 2200,
  onSilence,
}: {
  enabled: boolean;
  active: boolean;
  speechText: string;
  silenceMs?: number;
  onSilence: () => void;
}) {
  const onSilenceRef = useRef(onSilence);
  onSilenceRef.current = onSilence;
  const hasSpokenRef = useRef(false);
  const lastVoiceAtRef = useRef(0);
  const initialTextRef = useRef("");
  const firedRef = useRef(false);

  useEffect(() => {
    if (enabled && active && speechText.trim() && speechText.trim() !== initialTextRef.current) {
      hasSpokenRef.current = true;
      lastVoiceAtRef.current = Date.now();
    }
  }, [enabled, active, speechText]);

  useEffect(() => {
    if (!enabled || !active) {
      hasSpokenRef.current = false;
      lastVoiceAtRef.current = 0;
      firedRef.current = false;
      return;
    }
    initialTextRef.current = speechText.trim();
    hasSpokenRef.current = false;
    lastVoiceAtRef.current = Date.now();
    firedRef.current = false;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let buf: Float32Array<ArrayBuffer> | null = null;
    let voiceFrames = 0;

    const isIos =
      typeof navigator !== "undefined" &&
      (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

    const AudioCtx =
      typeof window !== "undefined"
        ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;

    if (!isIos && AudioCtx && typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      void navigator.mediaDevices
        .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
        .then((s) => {
          if (cancelled) {
            s.getTracks().forEach((t) => t.stop());
            return;
          }
          stream = s;
          ctx = new AudioCtx();
          const src = ctx.createMediaStreamSource(s);
          analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          src.connect(analyser);
          buf = new Float32Array(analyser.fftSize);
        })
        .catch(() => {
          /* fall back cleanly to live-caption timing if second audio stream is declined */
        });
    }

    const timer = window.setInterval(() => {
      if (cancelled || firedRef.current) return;
      if (analyser && buf) {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        if (rms >= 0.016) {
          voiceFrames++;
          lastVoiceAtRef.current = Date.now();
          if (voiceFrames >= 2) hasSpokenRef.current = true;
        } else if (rms >= 0.011 && hasSpokenRef.current) {
          lastVoiceAtRef.current = Date.now();
        } else {
          voiceFrames = 0;
        }
      }
      if (hasSpokenRef.current && Date.now() - lastVoiceAtRef.current >= silenceMs) {
        firedRef.current = true;
        onSilenceRef.current();
      }
    }, 100);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
      if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, active, silenceMs]);
}

export type AssessState =
  | { state: "idle" }
  | { state: "busy"; done: number; total: number }
  | { state: "done"; result: PronResult | null }
  | { state: "failed"; error: string };

/** Assess takes with Tier-1 Azure Speech or Tier-2 Whisper `verbose_json`; one at a time per hook, cancelled on unmount. */
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
      const result = await assessRecording(
        blob,
        (done, total) => !c.signal.aborted && setS({ state: "busy", done, total }),
        c.signal,
        referenceText,
      );
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
  const azureAvailable = canAssess();
  const available = canAssessOrTranscribe();
  const tier: "azure" | "whisper" | "none" = azureAvailable ? "azure" : ready.stt() ? "whisper" : "none";
  return { ...s, run, reset, available, azureAvailable, tier };
}

export function TakePlayer({
  take,
  label = "听自己的录音",
  audioRef,
}: {
  take: Take | null | undefined;
  label?: string;
  audioRef?: RefObject<HTMLAudioElement | null>;
}) {
  if (!take) return null;
  return (
    <div className="take">
      <span className="muted small">
        {label}（{take.seconds} 秒）
      </span>
      <audio ref={audioRef} controls preload="metadata" src={take.url} />
    </div>
  );
}

/** Why there is no assessment, or how to get one. */
export function AssessHint() {
  return (
    <p className="muted small">
      语音评测与高保真转写：到 <a className="link" href={href({ page: "me" })}>我的 → AI 接口</a> 填 Azure 语音 Key + 区域（完整 IPA 音素、联诵与韵律评测）或开启 Whisper 语音转写（原话逐词时间戳与语速停顿分析）。
    </p>
  );
}

/** Progress, error or result of an assessment. */
export function AssessStatus({ a }: { a: AssessState }) {
  const usingAzure = canAssess();
  if (a.state === "busy") {
    return (
      <p className="muted small">
        {usingAzure
          ? `Azure 发音评测与逐词对齐中${a.total > 1 ? `（已完成 ${a.done}/${a.total} 段，3 路并发）` : ""}…`
          : "Whisper 逐词原话转写与停顿分析中…"}
      </p>
    );
  }
  if (a.state === "failed") return <p className="muted small">语音评测失败：{a.error}</p>;
  if (a.state === "done" && !a.result) return <p className="muted small">未听出有效法语语音：录音太短、太轻或背景太吵。</p>;
  return null;
}

function forbiddenReasonLabel(reason?: string): string {
  if (reason === "before_h_aspire") return "嘘音 h（h aspiré）前严禁联诵";
  if (reason === "after_et") return "连词 et 后严禁联诵";
  if (reason === "singular_noun") return "单数名词后严禁联诵";
  if (reason === "inverted_pronoun") return "倒装主语代词后严禁联诵";
  return "此处严禁联诵";
}

/**
 * Interactive word-level transcript: clicking any word seeks `audioRef.current.currentTime = offsetMs / 1000`
 * (or plays standard French TTS when no `audioRef` is bound), displaying inline phoneme accuracy colors,
 * `‿` missed obligatory liaisons, `×` forbidden / *h aspiré* liaison alerts, and `⏸` ≥1s pause badges.
 */
export function AssessedTranscript({
  result,
  audioRef,
  compact = false,
}: {
  result: PronResult;
  audioRef?: RefObject<HTMLAudioElement | null>;
  compact?: boolean;
}) {
  const phonoSupported = result.phonemeSupported !== false;
  const boundaries = useMemo(
    () => evaluateWordBoundaries(result.words, phonoSupported),
    [result.words, phonoSupported],
  );
  const boundaryMap = useMemo(() => new Map(boundaries.map((b) => [b.afterIndex, b])), [boundaries]);

  if (!result.words.length) {
    if (!result.text) return null;
    return (
      <p className="essay-text" lang="fr">
        {result.text}
      </p>
    );
  }

  const handleWordClick = (w: PronWord) => {
    if (w.offsetMs !== undefined && audioRef?.current) {
      const el = audioRef.current;
      el.currentTime = Math.max(0, w.offsetMs / 1000);
      void el.play().catch(() => {});
      return;
    }
    void play(null, w.word);
  };

  return (
    <div className="pron-transcript-box">
      {!compact && (
        <p className="pron-legend">
          <span>{audioRef ? "点击任意词定位原声回放" : "点击任意词听标准发音"}</span>
          {phonoSupported ? (
            <>
              <span>· 绿线 ≥80 清晰 · 黄底 60–79 偏弱 · 红底 &lt;60 需练</span>
              <span>· <b>‿</b> 漏读必须联诵</span>
              <span>· <b>×</b> 禁忌/嘘音 h 误联诵</span>
            </>
          ) : (
            <span>· Whisper 逐词时间戳模式</span>
          )}
          <span>· <b>⏸</b> ≥1s 停顿</span>
        </p>
      )}
      <p className={`pron-transcript ${compact ? "is-compact" : ""}`} lang="fr">
        {result.words.map((w, idx) => {
          const b = boundaryMap.get(idx);
          const colorClass = !phonoSupported
            ? "is-neutral"
            : w.accuracy < 60
              ? "is-weak"
              : w.accuracy < 80
                ? "is-mid"
                : "is-good";
          const secLabel = w.offsetMs !== undefined ? `${(w.offsetMs / 1000).toFixed(1)}s` : "";
          const ipaDetail =
            phonoSupported && w.phonemes?.length
              ? ` /${w.phonemes.map((p) => `${p.phoneme}:${Math.round(p.accuracy)}`).join(" ")}/`
              : "";
          const errDetail =
            phonoSupported && w.error && w.error !== "None"
              ? ` · ${ERROR_LABEL[w.error] ?? w.error}`
              : "";
          const title = phonoSupported
            ? `${w.word} · ${Math.round(w.accuracy)}/100${errDetail}${ipaDetail}${secLabel ? ` @ ${secLabel}` : ""}`
            : `${w.word}${secLabel ? ` @ ${secLabel}` : ""}`;

          return (
            <span key={idx}>
              <button
                type="button"
                className={`pron-word-btn ${colorClass}`}
                title={title}
                onClick={() => handleWordClick(w)}
              >
                {w.word}
              </button>
              {b?.liaison?.kind === "obligatory" && b.liaison.status === "missed" && (
                <span
                  className="pron-liaison-miss"
                  title={`漏读必须联诵：应连读出 /${b.liaison.consonant}/`}
                  aria-label="漏读必须联诵"
                >
                  ‿
                </span>
              )}
              {b?.liaison?.kind === "obligatory" && b.liaison.status === "ok" && (
                <span className="pron-liaison-ok" title={`已实现必须联诵 /${b.liaison.consonant}/`} aria-hidden="true">
                  ‿
                </span>
              )}
              {b?.liaison?.kind === "forbidden" && b.liaison.status === "violated" && (
                <span
                  className="pron-liaison-forbid"
                  title={`禁忌联诵误读（/${b.liaison.consonant}/）：${forbiddenReasonLabel(b.liaison.reason)}`}
                  aria-label="禁忌联诵误读"
                >
                  ×
                </span>
              )}
              {b?.pauseBadgeSec !== undefined && (
                <span
                  className={`pron-pause-badge ${b.isLongFreeze ? "is-freeze" : ""}`}
                  title={
                    b.midConstituentBreak
                      ? `句法成分内部断裂停顿 ${b.pauseBadgeSec} 秒`
                      : `停顿 ${b.pauseBadgeSec} 秒`
                  }
                >
                  ⏸ {b.pauseBadgeSec}s
                </span>
              )}
              {" "}
            </span>
          );
        })}
      </p>
    </div>
  );
}

/** The scores of an assessment, deterministic prosody telemetry, and interactive word-seek transcript. */
export function PronReport({
  result,
  title,
  audioRef,
  seekResult,
}: {
  result: PronResult;
  title?: string;
  audioRef?: RefObject<HTMLAudioElement | null>;
  seekResult?: PronResult | null;
}) {
  const phonoSupported = result.phonemeSupported !== false;
  const resolvedTitle =
    title ?? (phonoSupported ? "发音评测（Azure）" : "语音流利度与逐词时间戳（Whisper）");
  const total = phonoSupported ? overall(result) : null;
  const gate = phonoGateInfo(result);
  const level = gate.level;
  const levelLabel = level !== null ? (LEVEL_LABEL[level] ?? LEVEL_LABEL[Math.floor(level)] ?? "") : "";
  const weak = phonoSupported ? weakWords(result.words) : [];
  const insights = phonoSupported ? phonemeInsights(result.words) : [];
  const acoustics = useMemo(() => summarizeAcoustics(result), [result]);
  const transcriptTarget = seekResult ?? result;

  return (
    <div className="essay-box pron-report">
      <p className="eyebrow">{resolvedTitle}</p>
      {phonoSupported ? (
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
                    {v === null ? "—" : Math.round(v)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      ) : (
        <p className="muted small">
          当前为 Tier-2 Whisper 原话逐词转写模式（保留犹豫词 euh 与真实语法形态，提供逐词回放定位与语速/停顿诊断）；如需 IPA 音素准确度与联诵打分，可在 <a className="link" href={href({ page: "me" })}>我的 → AI 接口</a> 补充 Azure 语音服务。
        </p>
      )}
      {acoustics && (
        <ul className="pron-acoustics" aria-label="声学流利度指标">
          {acoustics.speechRateWpm !== undefined && <li>总语速 {acoustics.speechRateWpm} 词/分</li>}
          {acoustics.articulationRateWpm !== undefined && <li>净发音语速 {acoustics.articulationRateWpm} 词/分</li>}
          {acoustics.pauseRatio !== undefined && (
            <li className={acoustics.pauseRatio >= 0.28 ? "is-warn" : ""}>
              停顿占比 {Math.round(acoustics.pauseRatio * 100)}%
            </li>
          )}
          {acoustics.longFreezeCount !== undefined && (
            <li className={acoustics.longFreezeCount >= 2 ? "is-alert" : ""}>
              ≥2s 长卡壳 {acoustics.longFreezeCount} 次
            </li>
          )}
          {acoustics.midConstituentBreaks !== undefined && acoustics.midConstituentBreaks > 0 && (
            <li className="is-warn">句法成分内断裂 {acoustics.midConstituentBreaks} 处</li>
          )}
          {acoustics.obligatoryLiaisonsMissed !== undefined && acoustics.obligatoryLiaisonsMissed > 0 && (
            <li className="is-warn">漏联诵 {acoustics.obligatoryLiaisonsMissed} 处</li>
          )}
          {acoustics.forbiddenLiaisonsMade !== undefined && acoustics.forbiddenLiaisonsMade > 0 && (
            <li className="is-alert">禁忌联诵误读 {acoustics.forbiddenLiaisonsMade} 处</li>
          )}
          {acoustics.likelyReadAloud && <li className="is-alert">疑似照念文稿节奏</li>}
        </ul>
      )}
      {level !== null && (
        <p className="muted small">
          折合评分表第五项（发音和语调）约 {level}/5{levelLabel ? ` · ${levelLabel}` : ""}。
          {gate.gatedBy === "prosody"
            ? `（虽综合分达标，但韵律/语调重音 ${Math.round(result.prosody ?? 0)} 分未过门控线，已由 ${gate.rawLevel} 下调至 ${level}）`
            : gate.gatedBy === "acoustics"
              ? `（按语速、停顿占比或长卡壳确定性门控，已由 ${gate.rawLevel} 下调至 ${level}）`
              : gate.gatedBy === "accuracy_or_fluency"
                ? `（音准或流利度未达 B2+ 门控线，已由 ${gate.rawLevel} 下调至 ${level}）`
                : "这是按 0.5 分档位与韵律门控换算的估计，考试由考官凭听感评。"}
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
      {phonoSupported &&
        (weak.length > 0 ? (
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
        ))}
      {(transcriptTarget.words.length > 0 || transcriptTarget.text) && (
        <details className="essay-fold" open={transcriptTarget.words.length > 0}>
          <summary>
            {phonoSupported ? "逐词音素着色与原声定位回放" : "Whisper 原话逐词时间戳回放"}
          </summary>
          <AssessedTranscript result={transcriptTarget} audioRef={audioRef} />
        </details>
      )}
    </div>
  );
}
