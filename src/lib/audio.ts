import { duck } from "./sound";
import { TARGET_LANG } from "../config";
import { ttsOn, ttsUrl } from "../ai/tts";
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
export async function play(url: string | null | undefined, text: string, accent: "uk" | "us" = "uk", rate = 1) {
  duck(true);
  try {
    return await speak(url, text, accent, rate);
  } finally {
    duck(false);
  }
}

async function speak(url: string | null | undefined, text: string, _accent: "uk" | "us", rate: number) {
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
      const src = await ttsUrl(text);
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
  if (best) u.voice = best;
  await new Promise<void>((r) => {
    u.onend = () => r();
    u.onerror = () => r();
    speechSynthesis.speak(u);
  });
  return "device" as const;
}
