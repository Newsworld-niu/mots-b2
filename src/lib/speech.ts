/** Speech-to-text with the browser's own recogniser (Chrome, Edge, Safari) and examiner voice rotation helpers. */
import { ACCENTS } from "./listening";

const french = ACCENTS[0];
/** Interleaved female/male French (fr-FR) Azure neural voices for multi-examiner rotation. */
export const FRENCH_EXAMINER_VOICES: string[] = Array.from({ length: Math.max(french.f.length, french.m.length) }, (_, i) => [french.f[i], french.m[i]]).flat().filter((v): v is string => !!v);

/**
 * Ordered pool of French examiner voices: configured fr-FR voices first (female/male),
 * followed by the remaining standard fr-FR voices without duplicates.
 */
export function examinerVoicePool(preferredFemale?: string, preferredMale?: string): string[] {
  const out: string[] = [];
  const add = (v?: string) => {
    const clean = v?.trim();
    if (clean && clean.startsWith("fr-FR") && !out.includes(clean)) out.push(clean);
  };
  add(preferredFemale);
  add(preferredMale);
  for (const v of FRENCH_EXAMINER_VOICES) add(v);
  return out;
}

/** Pick which French Azure voice speaks examiner turn `turnIndex` (with per-session `offset`). */
export function pickExaminerVoice(turnIndex: number, offset = 0, preferred?: { female?: string; male?: string }): string {
  const pool = examinerVoicePool(preferred?.female, preferred?.male);
  const idx = (Math.max(0, Math.floor(turnIndex)) + Math.max(0, Math.floor(offset))) % pool.length;
  return pool[idx];
}

const BROWSER_PITCHES = [1, 0.82, 1.08, 0.76];

/**
 * Pick a French browser `speechSynthesis` voice and pitch for examiner turn `turnIndex`.
 * Prioritizes fr-FR voices, rotating through all available French voices; varies pitch when fewer than 2 exist.
 */
export function pickBrowserFrenchVoice<T extends { lang: string; name: string }>(voices: readonly T[], turnIndex: number, offset = 0): { voice: T | undefined; pitch: number } {
  const fr = voices.filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith("fr"));
  const ordered = [
    ...fr.filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith("fr-fr")),
    ...fr.filter((v) => !v.lang.replace("_", "-").toLowerCase().startsWith("fr-fr")),
  ];
  const step = Math.max(0, Math.floor(turnIndex)) + Math.max(0, Math.floor(offset));
  if (!ordered.length) return { voice: undefined, pitch: BROWSER_PITCHES[step % BROWSER_PITCHES.length] };
  const voice = ordered[step % ordered.length];
  const pitch = ordered.length >= 2 ? 1 : BROWSER_PITCHES[step % BROWSER_PITCHES.length];
  return { voice, pitch };
}

/** Decide whether a recorded clip should automatically fall back to server/Azure STT transcription. */
export function shouldFallbackToStt(opts: {
  dictationSupported: boolean;
  speechFailed: boolean;
  transcript: string;
  sttAvailable: boolean;
}): boolean {
  return opts.sttAvailable && (!opts.dictationSupported || opts.speechFailed || !opts.transcript.trim());
}

/** Decide whether a recorded debate clip should automatically fall back to Azure STT transcription. */
export function shouldFallbackToAzureStt(opts: {
  dictationSupported: boolean;
  speechFailed: boolean;
  transcript: string;
  azureAvailable: boolean;
}): boolean {
  return shouldFallbackToStt({ ...opts, sttAvailable: opts.azureAvailable });
}

interface Recognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

const ctor = (): (new () => Recognizer) | undefined => {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

export const canDictate = () => !!ctor();

const ERRORS: Record<string, string> = {
  "not-allowed": "浏览器没有麦克风权限。在地址栏里允许使用麦克风后再试。",
  "service-not-allowed": "这个浏览器不允许语音识别。",
  "audio-capture": "找不到麦克风。",
  network: "语音识别需要联网，这次没有连上。",
  "language-not-supported": "这个浏览器不支持法语识别。",
};

/** Append a newly finalised recognition phrase, stripping duplicate tail/head overlap across restarts. */
export function mergeDictationSegment(existing: string, incoming: string, afterRestart = false): string {
  const clean = incoming.trim();
  if (!clean) return existing;
  if (!existing.trim()) return `${clean} `;
  const prevWords = existing.trim().split(/\s+/);
  const nextWords = clean.split(/\s+/);
  const maxOverlap = Math.min(8, prevWords.length, nextWords.length);
  const minOverlap = afterRestart ? 1 : 3;
  for (let len = maxOverlap; len >= minOverlap; len--) {
    let same = true;
    for (let i = 0; i < len; i++) {
      if (prevWords[prevWords.length - len + i].toLowerCase() !== nextWords[i].toLowerCase()) {
        same = false;
        break;
      }
    }
    if (same) {
      const rest = nextWords.slice(len).join(" ");
      return rest ? `${existing.trim()} ${rest} ` : `${existing.trim()} `;
    }
  }
  return `${existing.trim()} ${clean} `;
}

/**
 * Listen in French until stopped. `onText(final, interim)` gets everything recognised so far and the words
 * still being guessed. The recogniser ends by itself after a silence: it is started again until `stop()`.
 * Returns the stop function.
 */
export function dictate(onText: (final: string, interim: string) => void, onStop: (error?: string) => void): () => void {
  const C = ctor();
  if (!C) {
    onStop("这个浏览器不支持语音识别。");
    return () => {};
  }
  let final = "";
  let wanted = true;
  let failed: string | undefined;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  let afterRestart = false;
  let emptyRestarts = 0;
  let hadResultSinceStart = false;
  const rec = new C();
  rec.lang = "fr-FR";
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = (e) => {
    let interim = "";
    let changed = false;
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) {
        final = mergeDictationSegment(final, r[0].transcript, afterRestart);
        afterRestart = false;
        changed = true;
      } else {
        interim += r[0].transcript;
      }
    }
    if (changed || interim.trim()) {
      hadResultSinceStart = true;
      emptyRestarts = 0;
    }
    onText(final, interim);
  };
  rec.onerror = (e) => {
    // silence is not a failure: the recogniser is simply started again
    if (e.error === "no-speech" || e.error === "aborted") return;
    failed = ERRORS[e.error] ?? `语音识别出错（${e.error}）。`;
    wanted = false;
  };
  rec.onend = () => {
    if (wanted) {
      if (!hadResultSinceStart) emptyRestarts++;
      if (emptyRestarts > 5) {
        failed = "语音识别连续中断，请改用录音转写或手动输入。";
        wanted = false;
        onStop(failed);
        return;
      }
      restartTimer = setTimeout(() => {
        restartTimer = null;
        if (!wanted) return;
        afterRestart = true;
        hadResultSinceStart = false;
        try {
          rec.start();
        } catch {
          failed = "语音识别中断了。";
          wanted = false;
          onStop(failed);
        }
      }, 120);
      return;
    }
    onStop(failed);
  };
  try {
    rec.start();
  } catch {
    onStop("语音识别没能启动。");
  }
  return () => {
    wanted = false;
    if (restartTimer !== null) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
    try {
      rec.stop();
    } catch {
      onStop(failed);
    }
  };
}
