/**
 * Generate sentence-level timestamps (`public/materials/rfi/<id>.segments.json`)
 * matching `sentencesOf(transcript)` 1:1 for all 6 bundled RFI episodes.
 *
 * Primary: Azure Speech Fast Transcription word-level alignment.
 * Fallback: ffmpeg silencedetect + proportional monotone alignment.
 *
 * Usage:
 *   npm run rfi:segments
 *   npm run rfi:segments -- --force
 */
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { foldAccents } from "../src/lib/accent";
import { sentencesOf } from "../src/lib/listening";
import { PREBUILT_REAL_SOURCES } from "../src/lib/real-presets";
import type { RfiSegmentsFile, TimedSegment } from "../src/lib/rfi-segments";

const execFileAsync = promisify(execFile);

interface SttWord {
  norm: string;
  startSec: number;
  endSec: number;
}

function loadDotEnvLocal() {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (k && !(k in process.env)) process.env[k] = v;
  }
}

const normWord = (w: string) => foldAccents(w.toLowerCase()).replace(/[^a-z0-9]/g, "");

function tokenizeSentence(s: string): string[] {
  return s
    .replace(/[’']/g, " ")
    .split(/\s+/)
    .map(normWord)
    .filter(Boolean);
}

async function ffprobeDuration(mp3Path: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    mp3Path,
  ]);
  const d = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(d) || d <= 0) throw new Error(`Invalid duration for ${mp3Path}: ${stdout}`);
  return Math.round(d * 100) / 100;
}

async function detectSilences(mp3Path: string): Promise<number[]> {
  const { stderr } = await execFileAsync(
    "ffmpeg",
    ["-hide_banner", "-i", mp3Path, "-af", "silencedetect=noise=-32dB:d=0.35", "-f", "null", "-"],
    { maxBuffer: 8 * 1024 * 1024 },
  );
  const pauses: number[] = [];
  let start: number | null = null;
  for (const line of stderr.split(/\r?\n/)) {
    const ms = line.match(/silence_start:\s*([0-9.]+)/);
    if (ms) start = Number.parseFloat(ms[1]);
    const me = line.match(/silence_end:\s*([0-9.]+)/);
    if (me && start !== null) {
      const end = Number.parseFloat(me[1]);
      pauses.push((start + end) / 2);
      start = null;
    }
  }
  return pauses;
}

function parseFastTranscriptionWords(json: Record<string, unknown>): SttWord[] {
  const words: SttWord[] = [];
  const phrases = Array.isArray(json.phrases) ? (json.phrases as Array<Record<string, unknown>>) : [];
  for (const p of phrases) {
    const pWords = Array.isArray(p.words) ? (p.words as Array<Record<string, unknown>>) : [];
    if (pWords.length > 0) {
      for (const w of pWords) {
        const text = typeof w.text === "string" ? w.text : "";
        const offMs = typeof w.offsetMilliseconds === "number" ? w.offsetMilliseconds : undefined;
        const durMs = typeof w.durationMilliseconds === "number" ? w.durationMilliseconds : undefined;
        if (offMs === undefined || durMs === undefined) continue;
        for (const tok of tokenizeSentence(text)) {
          words.push({ norm: tok, startSec: offMs / 1000, endSec: (offMs + Math.max(50, durMs)) / 1000 });
        }
      }
    } else if (typeof p.text === "string" && typeof p.offsetMilliseconds === "number" && typeof p.durationMilliseconds === "number") {
      const toks = tokenizeSentence(p.text);
      const offSec = p.offsetMilliseconds / 1000;
      const durSec = Math.max(0.2, p.durationMilliseconds / 1000);
      toks.forEach((tok, idx) => {
        words.push({
          norm: tok,
          startSec: offSec + (idx / Math.max(1, toks.length)) * durSec,
          endSec: offSec + ((idx + 1) / Math.max(1, toks.length)) * durSec,
        });
      });
    }
  }
  return words;
}

async function fetchAzureFastStt(mp3Path: string, key: string, region: string): Promise<SttWord[] | null> {
  const buf = await readFile(mp3Path);
  const form = new FormData();
  form.append("audio", new Blob([buf], { type: "audio/mpeg" }), "audio.mp3");
  form.append("definition", JSON.stringify({ locales: ["fr-FR"], profanityFilterMode: "None" }));
  const url = `https://${region}.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=2024-11-15`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": key },
    body: form,
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    console.warn(`[rfi:segments] Azure Fast STT HTTP ${res.status}: ${await res.text().catch(() => "")}`);
    return null;
  }
  const body = (await res.json()) as Record<string, unknown>;
  const words = parseFastTranscriptionWords(body);
  return words.length >= 20 ? words : null;
}

/**
 * Banded Needleman-Wunsch alignment mapping canonical tokens (`N`) to STT words (`M`).
 * Returns for each canonical token `i` the matched `sttIdx` (or `-1`).
 */
function alignCanonToStt(canonNorms: string[], stt: SttWord[]): number[] {
  const N = canonNorms.length;
  const M = stt.length;
  const mapping = new Array<number>(N).fill(-1);
  if (!N || !M) return mapping;

  const band = Math.max(240, Math.round(Math.max(N, M) * 0.22));
  const NEG = -1e9;
  // Backtrack encoding in Uint8Array: 1=diag, 2=up(skip canon), 3=left(skip stt)
  const stride = 2 * band + 1;
  const dir = new Uint8Array((N + 1) * stride);
  const centerOf = (i: number) => Math.round((i * M) / N);
  let prev = new Float64Array(stride).fill(NEG);
  let curr = new Float64Array(stride).fill(NEG);

  const c0 = 0;
  for (let off = -band; off <= band; off++) {
    const j = c0 + off;
    if (j >= 0 && j <= M) prev[off + band] = -j;
  }

  for (let i = 1; i <= N; i++) {
    curr.fill(NEG);
    const prevCenter = centerOf(i - 1);
    const curCenter = centerOf(i);
    const tok = canonNorms[i - 1];
    for (let off = -band; off <= band; off++) {
      const j = curCenter + off;
      if (j < 0 || j > M) continue;
      let best = NEG;
      let bestDir = 2;

      // Up: match prev row at same j
      const upOff = j - prevCenter;
      if (upOff >= -band && upOff <= band && prev[upOff + band] > NEG / 2) {
        const sc = prev[upOff + band] - 1;
        if (sc > best) {
          best = sc;
          bestDir = 2;
        }
      }

      // Left: prev col same row
      if (off > -band && curr[off - 1 + band] > NEG / 2) {
        const sc = curr[off - 1 + band] - 1;
        if (sc > best) {
          best = sc;
          bestDir = 3;
        }
      }

      // Diag
      if (j > 0) {
        const diagOff = j - 1 - prevCenter;
        if (diagOff >= -band && diagOff <= band && prev[diagOff + band] > NEG / 2) {
          const sNorm = stt[j - 1].norm;
          const match = tok === sNorm ? 3 : tok.length >= 4 && sNorm.startsWith(tok.slice(0, 4)) ? 1 : -1;
          const sc = prev[diagOff + band] + match;
          if (sc > best) {
            best = sc;
            bestDir = 1;
          }
        }
      }

      curr[off + band] = best;
      dir[i * stride + (off + band)] = bestDir;
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  // Pick best endpoint in row N
  let bestJ = M;
  let bestScore = NEG;
  const lastCenter = centerOf(N);
  for (let off = -band; off <= band; off++) {
    const j = lastCenter + off;
    if (j >= 0 && j <= M && prev[off + band] > bestScore) {
      bestScore = prev[off + band];
      bestJ = j;
    }
  }

  let i = N;
  let j = bestJ;
  while (i > 0 && j > 0) {
    const off = j - centerOf(i);
    if (off < -band || off > band) break;
    const d = dir[i * stride + (off + band)];
    if (d === 1) {
      if (canonNorms[i - 1] === stt[j - 1].norm) mapping[i - 1] = j - 1;
      i--;
      j--;
    } else if (d === 2) {
      i--;
    } else if (d === 3) {
      j--;
    } else {
      break;
    }
  }
  return mapping;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function normalizeSegments(raw: Array<{ start: number; end: number; text: string; who?: string }>, duration: number): TimedSegment[] {
  const n = raw.length;
  const starts = raw.map((s) => Math.max(0, Math.min(duration - 0.3, s.start)));
  const ends = raw.map((s) => Math.max(0.2, Math.min(duration, s.end)));

  for (let i = 0; i < n; i++) {
    if (i > 0 && starts[i] < starts[i - 1]) {
      starts[i] = Math.min(duration - 0.25, starts[i - 1] + 0.05);
    }
    if (ends[i] <= starts[i] + 0.15) {
      const next = i + 1 < n ? starts[i + 1] : duration;
      ends[i] = Math.min(duration, Math.max(starts[i] + 0.3, next));
    }
    if (ends[i] <= starts[i]) {
      starts[i] = Math.max(i > 0 ? starts[i - 1] : 0, duration - 0.25);
      ends[i] = duration;
    }
  }

  return raw.map((s, idx) => ({
    idx,
    start: r2(starts[idx]),
    end: r2(Math.max(starts[idx] + 0.1, ends[idx])),
    text: s.text,
    ...(s.who ? { who: s.who } : {}),
  }));
}

function alignWithStt(units: ReturnType<typeof sentencesOf>, stt: SttWord[], duration: number): TimedSegment[] | null {
  const canonNorms: string[] = [];
  const tokenRanges: Array<{ firstTok: number; lastTok: number }> = [];
  for (const u of units) {
    const toks = tokenizeSentence(u.text);
    const firstTok = canonNorms.length;
    canonNorms.push(...(toks.length ? toks : ["mot"]));
    tokenRanges.push({ firstTok, lastTok: canonNorms.length - 1 });
  }
  const mapping = alignCanonToStt(canonNorms, stt);

  // Interpolate unmatched canonical tokens linearly along anchor positions
  const anchorStart: Array<number | null> = canonNorms.map((_, k) => (mapping[k] >= 0 ? stt[mapping[k]].startSec : null));
  const anchorEnd: Array<number | null> = canonNorms.map((_, k) => (mapping[k] >= 0 ? stt[mapping[k]].endSec : null));

  const anchors: number[] = [];
  for (let k = 0; k < anchorStart.length; k++) if (anchorStart[k] !== null) anchors.push(k);
  if (anchors.length < Math.max(10, Math.round(canonNorms.length * 0.2))) return null;

  for (let a = 0; a <= anchors.length; a++) {
    const left = a === 0 ? -1 : anchors[a - 1];
    const right = a === anchors.length ? canonNorms.length : anchors[a];
    if (right - left <= 1) continue;
    const tL = left >= 0 ? anchorEnd[left]! : stt[0]?.startSec ?? 0;
    const tR = right < canonNorms.length ? anchorStart[right]! : stt[stt.length - 1]?.endSec ?? duration;
    const span = Math.max(0.2, tR - tL);
    const steps = right - left;
    for (let k = left + 1; k < right; k++) {
      const frac0 = (k - left - 0.5) / steps;
      const frac1 = (k - left + 0.5) / steps;
      anchorStart[k] = tL + frac0 * span;
      anchorEnd[k] = tL + frac1 * span;
    }
  }

  const raw = units.map((u, idx) => {
    const { firstTok, lastTok } = tokenRanges[idx];
    const start = anchorStart[firstTok] ?? 0;
    const end = anchorEnd[lastTok] ?? Math.min(duration, start + 2);
    return { start, end, text: u.text, who: u.who };
  });
  return normalizeSegments(raw, duration);
}

function alignWithSilence(units: ReturnType<typeof sentencesOf>, pauses: number[], duration: number): TimedSegment[] {
  const weights = units.map((u) => Math.max(8, u.text.length));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const speechStart = pauses.length && pauses[0] < 8 ? pauses[0] : 0;
  const speechSpan = Math.max(5, duration - speechStart);

  let cum = 0;
  const boundaries: number[] = [speechStart];
  for (let i = 0; i < units.length - 1; i++) {
    cum += weights[i];
    const est = speechStart + (cum / totalWeight) * speechSpan;
    const minPrev = boundaries[i] + 0.45;
    let chosen = est;
    let bestDist = 7.5;
    for (const p of pauses) {
      if (p < minPrev || p > duration - 0.5) continue;
      const d = Math.abs(p - est);
      if (d < bestDist) {
        bestDist = d;
        chosen = p;
      }
    }
    boundaries.push(Math.max(minPrev, Math.min(duration - 0.4, chosen)));
  }
  boundaries.push(duration);

  const raw = units.map((u, idx) => ({
    start: boundaries[idx],
    end: boundaries[idx + 1],
    text: u.text,
    who: u.who,
  }));
  return normalizeSegments(raw, duration);
}

async function main() {
  loadDotEnvLocal();
  const force = process.argv.includes("--force");
  const key = process.env.AZURE_SPEECH_KEY?.trim() ?? "";
  const region = process.env.AZURE_SPEECH_REGION?.trim() ?? "";

  for (const src of PREBUILT_REAL_SOURCES) {
    const presetId = src.presetId ?? src.id;
    const mp3Path = join(process.cwd(), "public", src.url);
    const outPath = join(process.cwd(), "public", "materials", "rfi", `${presetId}.segments.json`);
    if (!force && (await stat(outPath).catch(() => null))) {
      console.log(`[skip] ${presetId}.segments.json`);
      continue;
    }
    const transcript = src.transcript ?? "";
    const units = sentencesOf(transcript);
    const duration = await ffprobeDuration(mp3Path);

    let method: RfiSegmentsFile["method"] = "ffmpeg-silence-align";
    let segments: TimedSegment[] | null = null;

    if (key && region) {
      const sttWords = await fetchAzureFastStt(mp3Path, key, region).catch(() => null);
      if (sttWords) {
        segments = alignWithStt(units, sttWords, duration);
        if (segments) method = "azure-fast-stt";
      }
    }

    if (!segments) {
      const pauses = await detectSilences(mp3Path);
      segments = alignWithSilence(units, pauses, duration);
      method = "ffmpeg-silence-align";
    }

    const payload: RfiSegmentsFile = {
      id: presetId,
      audio: src.url,
      duration,
      method,
      segments,
    };
    await writeFile(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
    console.log(`[ok] ${presetId}.segments.json (${segments.length} sentences, ${duration}s, method=${method})`);
  }
}

void main();
