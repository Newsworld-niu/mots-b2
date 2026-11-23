/**
 * Pure-BYOK Multi-Tier Oral Engine (fr-FR):
 *  - Tier 1 (Azure AI Speech): 16 kHz WAV chunks of ≤55 s uploaded with bounded concurrency = 3 (+1 retry on
 *    transient error) and sample-accurate chunk start `offsetMs` so word timestamps never reset every 55 s.
 *  - Tier 2 (OpenAI / custom Whisper `verbose_json` OR Gemini / OpenRouter native multimodal audio): verbatim
 *    disfluency-preserving transcription + word-level timestamps / acoustic WPM & pause diagnostics.
 *  - Tier 3 (Pure text model or no speech key): explicit notice that pronunciation cannot be measured from audio.
 */
import { isNative } from "../lib/native";
import { aggregate, assessmentHeader, parseAssessment, parseWhisperVerbose, type PronResult } from "../lib/pronunciation";
import { decodeSpeech } from "../lib/recorder";
import { encodeWav, isSilent, splitSegments, SPEECH_RATE } from "../lib/wav";
import { canTranscribeMultimodalAudio, transcribeViaMultimodalAudio } from "./clients";
import { getAiConfig, ready, type AiConfig } from "./config";
import { AiError, aiFetch, directUrl, errorFrom, fetchWithTimeout, proxyAvailable, proxyUrl, resolveOpenAiEndpoint } from "./proxy";
import { recordAiUsage } from "./usage";

/** Tier-1 IPA pronunciation assessment needs the Azure key and region (not the 朗读 switch). */
export const canAssess = (c: AiConfig = getAiConfig()) => !!c.keys.azure && !!c.azureRegion;

/** True when Tier-1 Azure Speech, Tier-2 Whisper STT, or Tier-2 Multimodal Audio STT is configured. */
export const canAssessOrTranscribe = (c: AiConfig = getAiConfig()) =>
  canAssess(c) || ready.stt(c) || canTranscribeMultimodalAudio(c);

export interface OralCapabilityNotice {
  tier: 1 | 2 | 3;
  label: string;
  detail: string;
}

/**
 * Explicit 3-tier oral capability classification for transparent BYOK guidance:
 *  - Tier 1: Azure `fr-FR` IPA phoneme accuracy + obligatory/forbidden liaisons + word-level prosody
 *  - Tier 2: Whisper `verbose_json` OR Gemini / OpenRouter multimodal verbatim audio transcription + WPM/pause telemetry
 *  - Tier 3: Pure-text LLM (e.g. DeepSeek) or unconfigured speech — warns clearly that pronunciation cannot be measured
 */
export function oralCapabilityTier(cfg: AiConfig = getAiConfig()): OralCapabilityNotice {
  if (canAssess(cfg)) {
    return {
      tier: 1,
      label: "Tier 1 · Azure fr-FR 音素与连诵精评",
      detail:
        "已启用 Azure fr-FR 语音评测：支持逐词 IPA 音素准确度、必读/禁忌连诵检测、词级韵律评分与高保真原话覆盖转写。",
    };
  }
  if (ready.stt(cfg) || canTranscribeMultimodalAudio(cfg)) {
    const viaWhisper = ready.stt(cfg);
    return {
      tier: 2,
      label: viaWhisper
        ? "Tier 2 · Whisper verbose_json 原话逐字转写 + 语速停顿诊断"
        : "Tier 2 · Gemini / 多模态原生听音逐字转写 + 语速停顿诊断",
      detail:
        "已启用高保真原话逐字转写（保留 euh 等犹豫词且不自动修正语法错误）及语速/停顿诊断。提示：配入 Azure Speech Key + 区域可额外解锁 IPA 音素与必/禁连诵细评。",
    };
  }
  return {
    tier: 3,
    label: ready.text(cfg)
      ? "Tier 3 · 纯文本模型模式（无法实测发音）"
      : "Tier 3 · 未配置语音接口（无法实测发音）",
    detail:
      "当前仅配纯文本模型（如 DeepSeek）或未配语音接口，无法从音频实测发音与连诵，浏览器自带听写仅作实时字幕预览；建议前往「我的 → AI 接口」配入 Azure Speech Key、Whisper STT 或 Gemini / OpenRouter 多模态语音模型。",
  };
}

export const AZURE_UPLOAD_CONCURRENCY = 3;
export const WHISPER_VERBATIM_PROMPT =
  "Transcris mot à mot avec les hésitations (euh) sans corriger la grammaire.";

const PATH = "/speech/recognition/conversation/cognitiveservices/v1?language=fr-FR&format=detailed";

function extFromMime(mime: string): string {
  const t = mime.toLowerCase();
  if (t.includes("mp4") || t.includes("m4a")) return "mp4";
  if (t.includes("ogg")) return "ogg";
  if (t.includes("wav")) return "wav";
  if (t.includes("mpeg") || t.includes("mp3")) return "mp3";
  return "webm";
}

function isTransientError(err: unknown, status?: number): boolean {
  if (status !== undefined) {
    return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
  }
  if (err instanceof DOMException && err.name === "AbortError") return false;
  if (err instanceof AiError) {
    return /超时|429|500|502|503|504/.test(err.message);
  }
  return err instanceof TypeError;
}

function sleepAbortable(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new DOMException("The operation was aborted.", "AbortError"));
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(id);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    };
    const id = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function assessPiece(
  wav: Uint8Array,
  signal: AbortSignal | undefined,
  referenceText: string,
  offsetMs: number,
  fetcher?: typeof fetch,
): Promise<PronResult | null> {
  const c = getAiConfig();
  const useFetch = fetcher ?? (isNative() ? fetch : aiFetch);
  const url = isNative()
    ? directUrl("azurestt", `/${c.azureRegion}${PATH}`)
    : proxyUrl("azurestt", `/${c.azureRegion}${PATH}`);

  for (let attempt = 0; attempt < 2; attempt++) {
    const init: RequestInit = {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": c.keys.azure,
        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        Accept: "application/json",
        "Pronunciation-Assessment": assessmentHeader(referenceText),
      },
      body: wav as BodyInit,
      signal,
    };
    try {
      const r = await fetchWithTimeout(url, init, 60_000, "Azure 语音评测", useFetch);
      if (!r.ok) {
        if (attempt === 0 && isTransientError(null, r.status) && !signal?.aborted) {
          await sleepAbortable(350, signal);
          continue;
        }
        throw await errorFrom(r, "Azure 语音评测");
      }
      return parseAssessment(await r.json(), { offsetMs, referenceText });
    } catch (err) {
      if (attempt === 0 && isTransientError(err) && !signal?.aborted) {
        await sleepAbortable(350, signal);
        continue;
      }
      throw err;
    }
  }
  return null;
}

/**
 * Assess a recording (mono samples at 16 kHz) with bounded concurrency = 3 (+1 retry per chunk).
 * `onProgress(done, total)` fires as each piece finishes; results are reassembled in strict chronological order.
 */
export async function assessPronunciation(
  samples: Float32Array,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
  referenceText = "",
  fetcher?: typeof fetch,
): Promise<PronResult | null> {
  const c = getAiConfig();
  if (!c.keys.azure) throw new AiError("还没有填 Azure 语音服务的 Key（在「我的 → AI 接口」里填）");
  if (!c.azureRegion) throw new AiError("还没有填 Azure 语音服务的区域");
  if (isSilent(samples)) throw new AiError("录音里几乎没有声音：麦克风可能被占用或静音了。");
  if (!fetcher) await proxyAvailable();

  const pieces = splitSegments(samples, SPEECH_RATE);
  const ordered: (PronResult | null)[] = new Array(pieces.length).fill(null);
  let nextIdx = 0;
  let completed = 0;

  const workerCount = Math.min(AZURE_UPLOAD_CONCURRENCY, pieces.length);
  const worker = async () => {
    while (nextIdx < pieces.length) {
      if (signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
      const idx = nextIdx++;
      const [startSample, endSample] = pieces[idx];
      const piece = samples.subarray(startSample, endSample);
      const offsetMs = Math.round((startSample / SPEECH_RATE) * 1000);
      if (!isSilent(piece)) {
        const ref = pieces.length === 1 ? referenceText : "";
        ordered[idx] = await assessPiece(encodeWav(piece, SPEECH_RATE), signal, ref, offsetMs, fetcher);
      }
      completed++;
      onProgress?.(completed, pieces.length);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return aggregate(ordered.filter((r): r is PronResult => r !== null));
}

/**
 * Tier-2 Whisper `verbose_json` word-timestamp fallback (`response_format: "verbose_json"` +
 * `timestamp_granularities[]: "word"`), falling back cleanly to `json` if a custom endpoint rejects `verbose_json`.
 */
export async function assessViaWhisperVerbose(
  blob: Blob,
  signal?: AbortSignal,
  opts?: { fallbackSeconds?: number; fetcher?: typeof fetch },
): Promise<PronResult | null> {
  if (!opts?.fetcher) await proxyAvailable();
  const c = getAiConfig();
  let url: string;
  let apiKey: string;
  const model = c.stt.model || "whisper-1";
  if (c.stt.provider === "openai") {
    apiKey = c.keys.openai;
    if (!apiKey) throw new AiError("还没有填 OpenAI 的 Key（在「我的 → AI 接口」里填）");
    url = resolveOpenAiEndpoint(c.openaiBaseUrl, "/audio/transcriptions");
  } else if (c.stt.provider === "custom") {
    if (!c.stt.baseUrl) throw new AiError("还没有填 Whisper 接口地址");
    if (!c.stt.apiKey) throw new AiError("还没有填 Whisper 接口 Key");
    apiKey = c.stt.apiKey;
    url = resolveOpenAiEndpoint(c.stt.baseUrl, "/audio/transcriptions");
  } else {
    throw new AiError("还没有开启 Whisper 语音转写服务（在「我的 → AI 接口」里设置）");
  }

  const useFetch = opts?.fetcher ?? aiFetch;
  const buildForm = (verbose: boolean) => {
    const fd = new FormData();
    fd.append("file", blob, `recording.${extFromMime(blob.type)}`);
    fd.append("model", model);
    fd.append("language", "fr");
    fd.append("prompt", WHISPER_VERBATIM_PROMPT);
    if (verbose) {
      fd.append("response_format", "verbose_json");
      fd.append("timestamp_granularities[]", "word");
    } else {
      fd.append("response_format", "json");
    }
    return fd;
  };

  let r = await fetchWithTimeout(
    url,
    { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: buildForm(true), signal },
    90_000,
    "Whisper 语音转写",
    useFetch,
  );

  if (!r.ok && (r.status === 400 || r.status === 415 || r.status === 422 || r.status === 501)) {
    r = await fetchWithTimeout(
      url,
      { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: buildForm(false), signal },
      90_000,
      "Whisper 语音转写",
      useFetch,
    );
  }
  if (!r.ok) throw await errorFrom(r, "Whisper 语音转写");
  const json = await r.json();
  recordAiUsage({ provider: "whisper", model });
  return parseWhisperVerbose(json, opts?.fallbackSeconds ?? 0);
}

/**
 * Assess a recording as made by the recorder (WebM, MP4…):
 *  - Tier 1 (`canAssess()`): decoded to 16 kHz mono WAV and assessed via Azure AI Speech.
 *  - Tier 2a (`!canAssess() && ready.stt()`): evaluated via Whisper `verbose_json` word-timestamp fallback.
 *  - Tier 2b (`canTranscribeMultimodalAudio()`): evaluated via Gemini / OpenRouter native multimodal audio verbatim STT.
 */
export async function assessRecording(
  blob: Blob,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
  referenceText = "",
): Promise<PronResult | null> {
  if (canAssess()) {
    return assessPronunciation(await decodeSpeech(blob), onProgress, signal, referenceText);
  }
  if (ready.stt()) {
    let fallbackSeconds = 0;
    try {
      const samples = await decodeSpeech(blob);
      if (isSilent(samples)) throw new AiError("录音里几乎没有声音：麦克风可能被占用或静音了。");
      fallbackSeconds = samples.length / SPEECH_RATE;
    } catch (e) {
      if (e instanceof AiError) throw e;
      /* proceed with raw blob upload if Web Audio decode is unavailable */
    }
    onProgress?.(0, 1);
    const res = await assessViaWhisperVerbose(blob, signal, { fallbackSeconds });
    onProgress?.(1, 1);
    return res;
  }
  if (canTranscribeMultimodalAudio()) {
    let fallbackSeconds = 0;
    let uploadBlob = blob;
    try {
      const samples = await decodeSpeech(blob);
      if (isSilent(samples)) throw new AiError("录音里几乎没有声音：麦克风可能被占用或静音了。");
      fallbackSeconds = samples.length / SPEECH_RATE;
      const wavBytes = encodeWav(samples, SPEECH_RATE);
      uploadBlob = new Blob([wavBytes.buffer as ArrayBuffer], { type: "audio/wav" });
    } catch (e) {
      if (e instanceof AiError) throw e;
      /* proceed with original blob if Web Audio decode is unavailable */
    }
    onProgress?.(0, 1);
    const mm = await transcribeViaMultimodalAudio(uploadBlob, signal, { durationSec: fallbackSeconds });
    onProgress?.(1, 1);
    return parseWhisperVerbose(
      {
        text: mm.text,
        duration: fallbackSeconds,
        words: mm.words.map((w) => ({ word: w.word, start: w.startSec, end: w.endSec })),
      },
      fallbackSeconds,
    );
  }
  return assessPronunciation(await decodeSpeech(blob), onProgress, signal, referenceText);
}
