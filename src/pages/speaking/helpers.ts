import { type AiConfig } from "../../ai/config";
import { ttsOn, ttsUrl } from "../../ai/tts";
import { TARGET_LANG } from "../../config";
import { play, stopAudio } from "../../lib/audio";
import { outlineKeywords, SPEAK_CRITERIA } from "../../lib/exam";
import { isNative } from "../../lib/native";
import { duck } from "../../lib/sound";
import { pickBrowserFrenchVoice, pickExaminerVoice } from "../../lib/speech";

/** Amber warning at 6:30 (390s) during DELF B2 PO monologue. */
export const MONOLOGUE_WARN_SEC = 390;
/** Polite examiner cutoff at 7:15 (435s) in strict exam simulation mode. */
export const MONOLOGUE_CUTOFF_SEC = 435;
export const MONOLOGUE_CUTOFF_FR =
  "Merci, le temps du monologue est écoulé ; passons au débat.";
/** Optional debate silence auto-turn-end threshold (2.2s). */
export const VAD_SILENCE_MS = 2200;
export const MAX_STRICT_CUES = 8;
export const MAX_STRICT_CUE_WORDS = 3;

/**
 * Convert preparation notes into strict exam cue cards (`≤8` cards × `≤3` words each)
 * so strict exam simulation prevents reading full drafted sentences off the screen.
 */
export function toStrictCueCards(notes: string): string[] {
  const rawChunks = notes
    .split(/[\r\n;•·—|]+/)
    .map((line) => line.replace(/^\s*(?:[-*+]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
  const source = rawChunks.length > 0 ? rawChunks : outlineKeywords(notes);
  const cards: string[] = [];
  for (const chunk of source) {
    if (cards.length >= MAX_STRICT_CUES) break;
    const tokens = chunk.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
    if (!tokens.length) continue;
    cards.push(tokens.slice(0, MAX_STRICT_CUE_WORDS).join(" "));
  }
  return cards;
}

export const day = (ms: number) => new Date(ms).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
export const two = <T,>(xs: T[]) => [...xs].sort(() => Math.random() - 0.5).slice(0, 2);

/** Read an examiner turn aloud, rotating among multiple French voices (Azure fr-FR or browser French voices). */
export async function speakExaminer(
  text: string,
  turnIndex: number,
  offset: number,
  aiConfig: AiConfig,
  signal?: AbortSignal,
): Promise<"recorded" | "device" | "stopped" | "unsupported"> {
  if (signal?.aborted) return "stopped";
  const second = turnIndex % 2 === 1;
  if (ttsOn()) {
    const voice = pickExaminerVoice(turnIndex, offset, { female: aiConfig.azureVoice, male: aiConfig.azureVoiceMale });
    const src = await ttsUrl(text, voice).catch(() => null);
    if (signal?.aborted) return "stopped";
    return play(src, text, second ? "us" : "uk", 1, second);
  }
  if (!isNative() && typeof window !== "undefined" && "speechSynthesis" in window) {
    stopAudio();
    duck(true);
    try {
      const u = new SpeechSynthesisUtterance(text);
      const { voice, pitch } = pickBrowserFrenchVoice(window.speechSynthesis.getVoices(), turnIndex, offset);
      u.lang = TARGET_LANG;
      u.rate = 0.95;
      u.pitch = pitch;
      if (voice) u.voice = voice;
      return await new Promise<"device" | "stopped">((resolve) => {
        let settled = false;
        const finish = (res: "device" | "stopped") => {
          if (settled) return;
          settled = true;
          signal?.removeEventListener("abort", onAbort);
          resolve(res);
        };
        const onAbort = () => {
          stopAudio();
          finish("stopped");
        };
        signal?.addEventListener("abort", onAbort, { once: true });
        u.onend = () => finish(signal?.aborted ? "stopped" : "device");
        u.onerror = (e) => {
          const err = (e as SpeechSynthesisErrorEvent).error;
          finish(signal?.aborted || err === "interrupted" || err === "canceled" ? "stopped" : "device");
        };
        window.speechSynthesis.speak(u);
      });
    } finally {
      duck(false);
    }
  }
  return play(null, text, second ? "us" : "uk", 1, second);
}

export type Phase = "pick" | "drawing" | "choose" | "prep" | "talk" | "review" | "debate" | "grading" | "result";

export const emptyOfflineSelf = () =>
  Object.fromEntries([...SPEAK_CRITERIA, "phono"].map((k) => [k, null])) as Record<string, number | null>;
