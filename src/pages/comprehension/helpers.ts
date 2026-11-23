import { REAL_WPM } from "../../lib/exam";
import { LISTENING_NOISE, type ListeningNoiseId } from "../../lib/sound";
import { topicOf, type CompForm } from "../../lib/exam";
import { type VoiceMode } from "../../lib/listening";
import { type BankPaper } from "../../store/exam-bank";

export const day = (ms: number) => new Date(ms).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
export const num = (n: number) => String(n);

/** The voice's own pace (words per minute at normal speed), measured while it reads and kept on this device. */
export const PACE_KEY = "fb2.listen.wpm";
export const readPace = () => {
  try {
    const n = Number(localStorage.getItem(PACE_KEY));
    return n > 80 && n < 320 ? n : 0;
  } catch {
    return 0;
  }
};

/** How much to speed the voice up or slow it down to reach the pace of the official recordings. */
export const rateFor = (wpm: number, slow: boolean) => Math.min(1.4, Math.max(0.8, wpm ? REAL_WPM / wpm : 1)) * (slow ? 0.85 : 1);

/** Listening choices kept on this device: which voices read, how the people speak, and ambient noise bed. */
export const VOICE_KEY = "fb2.listen.voices";
export const STYLE_KEY = "fb2.listen.style";
export const NOISE_KEY = "fb2.listen.noise";
export const CONTINUOUS_KEY = "fb2.listen.continuous";
export const NOISE_IDS = LISTENING_NOISE.map((n) => n.id) as readonly ListeningNoiseId[];

export const readKey = <T extends string>(key: string, ok: readonly T[], d: T): T => {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && ok.includes(v) ? v : d;
  } catch {
    return d;
  }
};

export const writeKey = (key: string, v: string) => {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* not remembered */
  }
};

export const VOICE_MODES: [VoiceMode, string][] = [
  ["mixed", "多口音（法、加、比、瑞）"],
  ["france", "法国口音，多换几个声音"],
  ["fixed", "只用我设置的两个声音"],
];

export const paperTopics = (p: Pick<BankPaper, "exs">) => [...new Set(p.exs.map((x) => topicOf(x.topic)?.zh ?? x.title))].join("、");

export type Phase = "setup" | "making" | "work" | "done";
export type What = CompForm | "paper";
