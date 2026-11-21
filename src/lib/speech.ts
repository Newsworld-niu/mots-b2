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

/** Decide whether a recorded debate clip should automatically fall back to Azure STT transcription. */
export function shouldFallbackToAzureStt(opts: {
  dictationSupported: boolean;
  speechFailed: boolean;
  transcript: string;
  azureAvailable: boolean;
}): boolean {
  return opts.azureAvailable && (!opts.dictationSupported || opts.speechFailed || !opts.transcript.trim());
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
  const rec = new C();
  rec.lang = "fr-FR";
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) final += `${r[0].transcript.trim()} `;
      else interim += r[0].transcript;
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
      try {
        rec.start();
        return;
      } catch {
        failed = "语音识别中断了。";
      }
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
    try {
      rec.stop();
    } catch {
      onStop(failed);
    }
  };
}
