/** Speech-to-text with the browser's own recogniser (Chrome, Edge, Safari). Nothing is recorded or kept. */

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
