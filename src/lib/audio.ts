import { duck } from "./sound";
import { TARGET_LANG } from "../config";
import { otherVoice, ttsOn, ttsUrl } from "../ai/tts";
import { getAiConfig } from "../ai/config";
import { isNative, speakNative, stopSpeakingNative } from "./native";

let current: HTMLAudioElement | null = null;
let token = 0;

export function stopAudio() {
  token++;
  current?.pause();
  current = null;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  stopSpeakingNative();
}

/** Play a recording, falling back to the device voice. Resolves when playback ends. */
/** `second`: read with the other voice (the second speaker of a dialogue). */
export async function play(url: string | null | undefined, text: string, accent: "uk" | "us" = "uk", rate = 1, second = false) {
  duck(true);
  try {
    return await speak(url, text, accent, rate, second);
  } finally {
    duck(false);
  }
}

async function speak(url: string | null | undefined, text: string, accent: "uk" | "us", rate: number, second: boolean) {
  stopAudio();
  const mine = ++token;
  if (url) {
    const a = new Audio(url);
    a.playbackRate = rate;
    current = a;
    try {
      await a.play();
      await new Promise<void>((r) => {
        a.onended = () => r();
        a.onpause = () => r();
      });
      return "recorded" as const;
    } catch {
      if (mine !== token) return "stopped" as const;
      current = null;
    }
  }
  // no recording: the Azure voice when it is set up (cached per text), the device voice otherwise
  if (ttsOn() && text.trim()) {
    try {
      const c = getAiConfig();
      const src = await ttsUrl(text, second ? otherVoice(accent === "us" ? c.azureVoiceMale : c.azureVoice) : accent);
      if (mine !== token) return "stopped" as const;
      const a = new Audio(src);
      a.playbackRate = rate;
      current = a;
      await a.play();
      await new Promise<void>((r) => {
        a.onended = () => r();
        a.onpause = () => r();
      });
      return "recorded" as const;
    } catch {
      if (mine !== token) return "stopped" as const;
      current = null;
    }
  }
  if (isNative()) {
    if (!text.trim()) return "unsupported" as const;
    const ok = await speakNative(text, TARGET_LANG, rate * 0.95);
    if (mine !== token) return "stopped" as const;
    return ok ? ("device" as const) : ("unsupported" as const);
  }
  if (!("speechSynthesis" in window)) return "unsupported" as const;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = TARGET_LANG;
  u.rate = rate * 0.95;
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.replace("_", "-").startsWith(TARGET_LANG.slice(0, 2)));
  const best = voices.find((v) => /premium|enhanced|natural|google/i.test(v.name)) || voices[0];
  // the second speaker: another French voice of the device when it has one, a lower pitch otherwise
  const alt = second ? voices.find((v) => v !== best && v !== voices[0]) : undefined;
  if (alt) u.voice = alt;
  else if (best) u.voice = best;
  if (second && !alt) u.pitch = 0.7;
  await new Promise<void>((r) => {
    u.onend = () => r();
    u.onerror = () => r();
    speechSynthesis.speak(u);
  });
  return "device" as const;
}
