/**
 * Recording the learner's own voice (MediaRecorder on the microphone), kept in memory as an object URL for
 * playback, and decoded back to mono 16 kHz samples for pronunciation assessment.
 */
import { mixToMono, resample, SPEECH_RATE } from "./wav";

export interface Take {
  /** Object URL for an <audio> element; revoked when the page that made it goes. */
  url: string;
  blob: Blob;
  seconds: number;
}

export interface Recording {
  stop(): Promise<Take | null>;
  cancel(): void;
}

export const canRecord = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

/** Chrome and Firefox record WebM/Opus, Safari MP4/AAC; each decodes its own. */
const TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"];
const pickType = () => TYPES.find((t) => typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(t));

function micError(e: unknown) {
  const name = (e as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "没有麦克风权限：在浏览器设置里允许使用麦克风后再试。";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "找不到麦克风。";
  if (name === "NotReadableError") return "麦克风被别的程序占用了。";
  return `录音没能开始（${(e as Error)?.message || name || "未知原因"}）。`;
}

/** Start recording the microphone. Throws an Error with a readable message when it cannot. */
export async function startRecording(): Promise<Recording> {
  if (!canRecord()) throw new Error("这个浏览器不能录音。");
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
  } catch (e) {
    throw new Error(micError(e), { cause: e });
  }
  const type = pickType();
  let rec: MediaRecorder;
  try {
    rec = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error(micError(e), { cause: e });
  }
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const t0 = Date.now();
  // a timeslice, so that a long talk does not depend on one final buffer
  rec.start(1000);
  const release = () => stream.getTracks().forEach((t) => t.stop());
  return {
    stop: () =>
      new Promise<Take | null>((resolve) => {
        if (rec.state === "inactive") {
          release();
          return resolve(null);
        }
        rec.onstop = () => {
          release();
          const blob = new Blob(chunks, { type: rec.mimeType || type || "audio/webm" });
          resolve(blob.size ? { url: URL.createObjectURL(blob), blob, seconds: Math.round((Date.now() - t0) / 1000) } : null);
        };
        rec.stop();
      }),
    cancel: () => {
      rec.onstop = null;
      if (rec.state !== "inactive") rec.stop();
      release();
    },
  };
}

/** A recording as mono samples at 16 kHz. */
export async function decodeSpeech(blob: Blob): Promise<Float32Array> {
  const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) throw new Error("这个浏览器不能解码录音。");
  const ctx = new C();
  try {
    const bytes = await blob.arrayBuffer();
    // older Safari only has the callback form
    const audio = await new Promise<AudioBuffer>((resolve, reject) => {
      const p = ctx.decodeAudioData(bytes, resolve, reject) as Promise<AudioBuffer> | undefined;
      p?.then(resolve, reject);
    });
    const channels = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
    return resample(mixToMono(channels), audio.sampleRate, SPEECH_RATE);
  } catch {
    throw new Error("录音解码失败。");
  } finally {
    void ctx.close?.();
  }
}
