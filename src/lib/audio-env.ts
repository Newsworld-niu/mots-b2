import { foldAccents } from "./accent";

export type AcousticEnv = "clean" | "studio" | "phone" | "street";

export const ACOUSTIC_ENVS: readonly { id: AcousticEnv; label: string; desc: string }[] = [
  { id: "clean", label: "纯净考场", desc: "无附加滤波，-16 LUFS 标准广播响度" },
  { id: "studio", label: "电台底噪", desc: "混入 -38 dB 演播室粉红底噪，还原真实电台声场" },
  { id: "phone", label: "电话滤波 (TCF·TEF)", desc: "300–3400 Hz 窄带滤波与动态压缩，模拟电话留言与热线连线" },
  { id: "street", label: "街头采访", desc: "混入 -30 dB 城市街道低频环境声，模拟 micro-trottoir 现场" },
] as const;

export function isAcousticEnv(v: unknown): v is AcousticEnv {
  return v === "clean" || v === "studio" || v === "phone" || v === "street";
}

/**
 * Build an `ffmpeg -af` audio filter chain for CO pre-rendering (`scripts/build-co-audio.ts`).
 * Always finishes with broadcast loudness normalization (`loudnorm=I=-16:TP=-1.5:LRA=11`).
 */
export function ffmpegFilterForEnv(env: AcousticEnv): string {
  switch (env) {
    case "phone":
      return "highpass=f=300,lowpass=f=3400,acompressor=threshold=-18dB:ratio=3,loudnorm=I=-16:TP=-1.5:LRA=11";
    case "studio":
      return "acopy[a];anoisesrc=color=pink,volume=-38dB[bg];[a][bg]amix=inputs=2:duration=first:dropout_transition=0,loudnorm=I=-16:TP=-1.5:LRA=11";
    case "street":
      return "acopy[a];anoisesrc=color=brown,volume=-30dB[bg];[a][bg]amix=inputs=2:duration=first:dropout_transition=0,loudnorm=I=-16:TP=-1.5:LRA=11";
    case "clean":
    default:
      return "loudnorm=I=-16:TP=-1.5:LRA=11";
  }
}

/* ---------- Lightweight Web Audio live acoustic bed (graceful no-op when unavailable) ---------- */

interface ActiveBed {
  ctx: AudioContext;
  src: AudioBufferSourceNode;
  gain: GainNode;
}

let activeBed: ActiveBed | null = null;

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  );
}

/** Stop any active live Web Audio acoustic environment bed. */
export function stopAcousticBed(): void {
  const cur = activeBed;
  activeBed = null;
  if (!cur) return;
  try {
    const t = cur.ctx.currentTime;
    cur.gain.gain.cancelScheduledValues(t);
    cur.gain.gain.setValueAtTime(cur.gain.gain.value, t);
    cur.gain.gain.linearRampToValueAtTime(0, t + 0.15);
    cur.src.stop(t + 0.18);
    setTimeout(() => {
      void cur.ctx.close().catch(() => {});
    }, 240);
  } catch {
    void cur.ctx.close().catch(() => {});
  }
}

/**
 * Start an optional subtle Web Audio ambient / telephone line texture during TTS or CO playback.
 * Returns an idempotent cleanup function; safely no-ops in Node/SSR or browsers without Web Audio.
 */
export function startAcousticBed(env: AcousticEnv): () => void {
  stopAcousticBed();
  if (env === "clean") return () => {};
  const Ctor = getAudioContextCtor();
  if (!Ctor) return () => {};
  try {
    const ctx = new Ctor();
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const sampleRate = ctx.sampleRate || 24000;
    const length = sampleRate * 2;
    const buf = ctx.createBuffer(1, length, sampleRate);
    const data = buf.getChannelData(0);
    // Paul Kellet pink/brown-leaning stochastic state so the texture is warm, never harsh white hiss
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    let targetGain = 0.018;
    if (env === "phone") {
      filter.type = "bandpass";
      filter.frequency.value = 1250;
      filter.Q.value = 0.95;
      targetGain = 0.026;
    } else if (env === "street") {
      filter.type = "lowpass";
      filter.frequency.value = 620;
      targetGain = 0.042;
    } else {
      filter.type = "lowpass";
      filter.frequency.value = 1600;
      targetGain = 0.016;
    }
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 0.22);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    const handle: ActiveBed = { ctx, src, gain };
    activeBed = handle;
    return () => {
      if (activeBed === handle) stopAcousticBed();
    };
  } catch {
    return () => {};
  }
}

/* ---------- 10s Audio Evidence Slice Helpers ---------- */

const durationCache = new Map<string, number>();

/** Load audio metadata once to determine duration in seconds (`null` if unavailable). */
export async function probeAudioDuration(url: string, timeoutMs = 2500): Promise<number | null> {
  if (!url) return null;
  const cached = durationCache.get(url);
  if (typeof cached === "number" && cached > 0) return cached;
  if (typeof Audio === "undefined") return null;
  return new Promise<number | null>((resolve) => {
    const a = new Audio();
    let settled = false;
    const finish = (dur: number | null) => {
      if (settled) return;
      settled = true;
      a.onloadedmetadata = null;
      a.onerror = null;
      if (dur && Number.isFinite(dur) && dur > 0) {
        durationCache.set(url, dur);
        resolve(dur);
      } else {
        resolve(null);
      }
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    a.preload = "metadata";
    a.onloadedmetadata = () => {
      clearTimeout(timer);
      finish(Number.isFinite(a.duration) && a.duration > 0 ? a.duration : null);
    };
    a.onerror = () => {
      clearTimeout(timer);
      finish(null);
    };
    a.src = url;
  });
}

/**
 * Estimate an ~11s `[startSec, endSec]` replay window (±2.5s padding around the character ratio
 * of `evidence` inside `docText`) for 10s original-audio proof replay.
 */
export function estimateEvidenceWindow(
  docText: string,
  evidence: string,
  durationSec: number,
  targetWindowSec = 11,
  padSec = 2.5,
): { startSec: number; endSec: number } {
  const dur = Math.max(1, durationSec);
  if (dur <= targetWindowSec) return { startSec: 0, endSec: dur };
  const cleanDoc = docText || "";
  const cleanEv = (evidence || "").trim();
  if (!cleanDoc || !cleanEv) {
    return { startSec: 0, endSec: Math.min(dur, targetWindowSec) };
  }

  let idx = cleanDoc.indexOf(cleanEv);
  let matchLen = cleanEv.length;
  if (idx < 0) {
    const foldedDoc = foldAccents(cleanDoc.replace(/[’‘]/g, "'")).toLowerCase();
    const foldedEv = foldAccents(cleanEv.replace(/[’‘]/g, "'")).toLowerCase();
    const probe = foldedEv.slice(0, Math.min(36, foldedEv.length));
    if (probe.length >= 6) {
      idx = foldedDoc.indexOf(probe);
      matchLen = Math.min(cleanDoc.length - Math.max(0, idx), foldedEv.length);
    }
  }
  if (idx < 0) {
    return { startSec: 0, endSec: Math.min(dur, targetWindowSec) };
  }

  const totalChars = Math.max(1, cleanDoc.length);
  const startRatio = idx / totalChars;
  const endRatio = Math.min(1, (idx + matchLen) / totalChars);
  let startSec = startRatio * dur - padSec;
  let endSec = endRatio * dur + padSec;
  const span = endSec - startSec;
  if (span < targetWindowSec) {
    const mid = (startSec + endSec) / 2;
    startSec = mid - targetWindowSec / 2;
    endSec = mid + targetWindowSec / 2;
  } else if (span > 13.5) {
    endSec = startSec + 12.5;
  }
  if (startSec < 0) {
    endSec = Math.min(dur, endSec - startSec);
    startSec = 0;
  }
  if (endSec > dur) {
    startSec = Math.max(0, startSec - (endSec - dur));
    endSec = dur;
  }
  return {
    startSec: Math.round(startSec * 10) / 10,
    endSec: Math.round(endSec * 10) / 10,
  };
}
