/**
 * Recorded speech as Azure's short-audio recognition takes it: mono, 16 kHz, 16-bit PCM in a WAV file, at most
 * 60 seconds a request. Pure functions (no browser API), so they are tested on their own.
 */

export const SPEECH_RATE = 16000;
/** Longest piece sent in one request: the service takes 60 s, kept clear of it. */
export const MAX_SEGMENT_SEC = 55;

/** The channels averaged into one. */
export function mixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0];
  const n = Math.min(...channels.map((c) => c.length));
  const out = new Float32Array(n);
  for (const c of channels) for (let i = 0; i < n; i++) out[i] += c[i] / channels.length;
  return out;
}

/**
 * Change the sample rate. Going down, each output sample is the mean of the input samples it covers (a simple
 * low-pass against aliasing); going up, linear interpolation.
 */
export function resample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to || input.length === 0) return input;
  const ratio = from / to;
  const n = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(n);
  if (ratio > 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.floor(i * ratio);
      const b = Math.min(input.length, Math.max(a + 1, Math.floor((i + 1) * ratio)));
      let sum = 0;
      for (let j = a; j < b; j++) sum += input[j];
      out[i] = sum / (b - a);
    }
  } else {
    for (let i = 0; i < n; i++) {
      const x = i * ratio;
      const a = Math.floor(x);
      const b = Math.min(input.length - 1, a + 1);
      out[i] = input[a] + (input[b] - input[a]) * (x - a);
    }
  }
  return out;
}

/** A WAV file (RIFF, PCM 16-bit, mono) of the samples, clipped to [-1, 1]. */
export function encodeWav(samples: Float32Array, rate = SPEECH_RATE): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const v = new DataView(bytes.buffer);
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
  };
  text(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); // byte rate
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), true);
  }
  return bytes;
}

/** Root mean square of a stretch of samples. */
export function rms(samples: Float32Array, from = 0, to = samples.length) {
  if (to <= from) return 0;
  let sum = 0;
  for (let i = from; i < to; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / (to - from));
}

/** Nothing audible was recorded (a muted or busy microphone gives zeros or near-zeros). */
export const isSilent = (samples: Float32Array, threshold = 0.003) => rms(samples) < threshold;

/**
 * Cut a recording into pieces of at most `maxSec`, as [start, end) sample ranges. Each cut falls on the quietest
 * 50 ms in the last `searchSec` before the limit, so that a word is rarely cut in two.
 */
export function splitSegments(samples: Float32Array, rate = SPEECH_RATE, maxSec = MAX_SEGMENT_SEC, searchSec = 5): [number, number][] {
  const max = Math.floor(maxSec * rate);
  const frame = Math.max(1, Math.floor(rate * 0.05));
  const out: [number, number][] = [];
  let start = 0;
  while (samples.length - start > max) {
    const limit = start + max;
    let cut = limit;
    let quietest = Infinity;
    for (let at = Math.max(start + frame, limit - Math.floor(searchSec * rate)); at + frame <= limit; at += frame) {
      const e = rms(samples, at, at + frame);
      // later frames win ties: longer pieces, fewer requests
      if (e <= quietest) {
        quietest = e;
        cut = at + Math.floor(frame / 2);
      }
    }
    out.push([start, cut]);
    start = cut;
  }
  if (samples.length > start) out.push([start, samples.length]);
  return out;
}
