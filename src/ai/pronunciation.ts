/**
 * Azure AI Speech pronunciation assessment of a recording (fr-FR, unscripted), over the short-audio REST endpoint:
 * the recording is cut into pieces of at most 55 s, each piece assessed in its own request, the results put
 * together weighted by length.
 */
import { isNative } from "../lib/native";
import { aggregate, assessmentHeader, parseAssessment, type PronResult } from "../lib/pronunciation";
import { decodeSpeech } from "../lib/recorder";
import { encodeWav, isSilent, splitSegments, SPEECH_RATE } from "../lib/wav";
import { getAiConfig, type AiConfig } from "./config";
import { AiError, aiFetch, directUrl, errorFrom, proxyAvailable, proxyUrl } from "./proxy";

/** Assessment needs only the Azure key and region (not the 朗读 switch). */
export const canAssess = (c: AiConfig = getAiConfig()) => !!c.keys.azure && !!c.azureRegion;

const PATH = "/speech/recognition/conversation/cognitiveservices/v1?language=fr-FR&format=detailed";

async function assessPiece(wav: Uint8Array, signal?: AbortSignal): Promise<PronResult | null> {
  const c = getAiConfig();
  const init: RequestInit = {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": c.keys.azure,
      "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
      Accept: "application/json",
      "Pronunciation-Assessment": assessmentHeader(),
    },
    body: wav as BodyInit,
    signal,
  };
  // the app's system HTTP bridge only sends text bodies: the audio goes through the web view's own fetch
  const r = isNative() ? await fetch(directUrl("azurestt", `/${c.azureRegion}${PATH}`), init) : await aiFetch(proxyUrl("azurestt", `/${c.azureRegion}${PATH}`), init);
  if (!r.ok) throw await errorFrom(r, "Azure 语音评测");
  return parseAssessment(await r.json());
}

/**
 * Assess a recording (mono samples at 16 kHz). `onProgress(done, total)` after each piece. Null when nothing
 * could be recognised.
 */
export async function assessPronunciation(samples: Float32Array, onProgress?: (done: number, total: number) => void, signal?: AbortSignal): Promise<PronResult | null> {
  const c = getAiConfig();
  if (!c.keys.azure) throw new AiError("还没有填 Azure 语音服务的 Key（在「我的 → AI 接口」里填）");
  if (!c.azureRegion) throw new AiError("还没有填 Azure 语音服务的区域");
  if (isSilent(samples)) throw new AiError("录音里几乎没有声音：麦克风可能被占用或静音了。");
  await proxyAvailable();
  const pieces = splitSegments(samples, SPEECH_RATE);
  const results: PronResult[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const [a, b] = pieces[i];
    const piece = samples.subarray(a, b);
    // a silent piece (a long pause) has nothing to assess
    if (!isSilent(piece)) {
      const r = await assessPiece(encodeWav(piece, SPEECH_RATE), signal);
      if (r) results.push(r);
    }
    onProgress?.(i + 1, pieces.length);
  }
  return aggregate(results);
}

/** Assess a recording as made by the recorder (WebM, MP4…): decoded to 16 kHz first. */
export async function assessRecording(blob: Blob, onProgress?: (done: number, total: number) => void, signal?: AbortSignal): Promise<PronResult | null> {
  return assessPronunciation(await decodeSpeech(blob), onProgress, signal);
}
