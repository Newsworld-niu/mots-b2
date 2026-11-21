import { duck, stopListeningNoise } from "./sound";
import { TARGET_LANG } from "../config";
import { otherVoice, speakerVoices, ttsOn, ttsUrl } from "../ai/tts";
import { getAiConfig } from "../ai/config";
import { isNative, speakNative, stopSpeakingNative } from "./native";

let current: HTMLAudioElement | null = null;
let token = 0;

export function stopAudio() {
  token++;
  current?.pause();
  current = null;
  stopListeningNoise();
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  stopSpeakingNative();
}

/** Play a recording, falling back to the device voice. Resolves when playback ends. */
/** `second`: read with another speaker voice (boolean for 2nd speaker, or 0-based speaker index for 3+ speakers). */
export async function play(url: string | null | undefined, text: string, accent: "uk" | "us" = "uk", rate = 1, second: boolean | number = false) {
  duck(true);
  try {
    return await speak(url, text, accent, rate, second);
  } finally {
    duck(false);
  }
}

const DEVICE_PITCHES = [1, 0.78, 1.15, 0.88] as const;
const DEVICE_RATES = [1, 0.98, 1.03, 0.96] as const;

async function speak(url: string | null | undefined, text: string, accent: "uk" | "us", rate: number, second: boolean | number) {
  stopAudio();
  const mine = ++token;
  const who = typeof second === "number" ? Math.max(0, Math.floor(second)) : second ? 1 : 0;
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
      const base = accent === "us" ? c.azureVoiceMale : c.azureVoice;
      const altBase = accent === "us" ? c.azureVoice : c.azureVoiceMale;
      const voice =
        who === 0
          ? accent
          : who === 1
            ? otherVoice(base)
            : speakerVoices(base, altBase)[who % 4];
      const src = await ttsUrl(text, voice);
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
  u.rate = rate * 0.95 * DEVICE_RATES[who % DEVICE_RATES.length];
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.replace("_", "-").startsWith(TARGET_LANG.slice(0, 2)));
  const best = voices.find((v) => /premium|enhanced|natural|google/i.test(v.name)) || voices[0];
  const ordered = best ? [best, ...voices.filter((v) => v !== best)] : voices;
  const picked = who === 0 ? best : ordered.length > who ? ordered[who] : ordered[who % Math.max(1, ordered.length)];
  if (picked) u.voice = picked;
  // Distinguish 3+ speakers by pitch when the device does not have enough distinct French voices
  if (who > 0 && ordered.length <= who) u.pitch = DEVICE_PITCHES[who % DEVICE_PITCHES.length];
  await new Promise<void>((r) => {
    u.onend = () => r();
    u.onerror = () => r();
    speechSynthesis.speak(u);
  });
  return "device" as const;
}
