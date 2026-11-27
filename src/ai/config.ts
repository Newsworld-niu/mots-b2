/**
 * AI service settings: keys and which service and model does each job. Kept in this browser only
 * (localStorage, its own key), never written into backups.
 */
import { useSyncExternalStore } from "react";

export type TextProvider = "openai" | "deepseek" | "anthropic" | "gemini" | "openrouter";
export type VisionProvider = "openai" | "anthropic" | "gemini" | "openrouter";
export const TEXT_PROVIDERS: TextProvider[] = ["deepseek", "gemini", "openai", "anthropic", "openrouter"];
export const VISION_PROVIDERS: VisionProvider[] = ["openai", "gemini", "anthropic", "openrouter"];
export type ImageProvider = "openai" | "gemini" | "openrouter";
export const IMAGE_PROVIDERS: ImageProvider[] = ["openai", "gemini", "openrouter"];

export type SttProvider = "none" | "openai" | "custom";
export const STT_PROVIDERS: SttProvider[] = ["none", "openai", "custom"];

export interface SttConfig {
  provider: SttProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AiConfig {
  keys: { openai: string; deepseek: string; anthropic: string; gemini: string; openrouter: string; azure: string };
  /** Optional custom OpenAI-compatible base URL (relay, Groq, local Ollama, etc.). */
  openaiBaseUrl: string;
  /** Optional custom Gemini base URL (relay, reverse proxy, Cloudflare AI Gateway). */
  geminiBaseUrl: string;
  /** Optional Whisper-compatible Speech-to-Text fallback configuration. */
  stt: SttConfig;
  azureRegion: string;
  /** Azure neural voice name, e.g. fr-FR-DeniseNeural. */
  azureVoice: string;
  /** The male voice, for the 男 button of words and sentences without a recording. */
  azureVoiceMale: string;
  /** Read words and sentences with Azure when they have no recording (device voice otherwise). */
  tts: boolean;
  vision: { provider: VisionProvider; model: string };
  text: { provider: TextProvider; model: string };
  image: { provider: ImageProvider; model: string };
}

/** Defaults; every model can be changed in the settings. */
export const DEFAULT_MODELS: Record<TextProvider, string> = {
  openai: "gpt-5-mini",
  deepseek: "deepseek-chat",
  anthropic: "claude-opus-5-5",
  gemini: "gemini-2.5-flash",
  // OpenRouter names models <maker>/<model>; multimodal + calibrated best for DELF B2 grading
  openrouter: "google/gemini-2.5-flash",
};

/** Recommended models surfaced in AI settings for DELF B2 grading consistency. */
export const GRADING_RECOMMENDED_MODELS = {
  openrouter: ["google/gemini-2.5-flash", "deepseek/deepseek-chat"],
  deepseek: ["deepseek-chat"],
  gemini: ["gemini-2.5-flash", "gemini-2.5-pro"],
} as const;
export const GEMINI_PRESET_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite", "gemini-3.5-flash-lite", "gemini-3.8-flash"] as const;
export const GEMINI_IMAGE_MODELS = ["gemini-2.5-flash-image", "gemini-3.1-flash-lite-image"] as const;
export const DEFAULT_IMAGE_MODELS: Record<ImageProvider, string> = { openai: "gpt-image-1", gemini: GEMINI_IMAGE_MODELS[0], openrouter: "openai/gpt-image-1-mini" };

/** Accept only HTTPS endpoints or localhost/127.0.0.1 HTTP for local models; strip trailing slashes. */
export function sanitizeBaseUrl(v: unknown): string {
  const s = typeof v === "string" ? v.trim().slice(0, 240).replace(/\/+$/, "") : "";
  if (!s) return "";
  try {
    const u = new URL(s);
    if (u.protocol === "https:") return `${u.origin}${u.pathname === "/" ? "" : u.pathname}`.replace(/\/+$/, "");
    if (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) {
      return `${u.origin}${u.pathname === "/" ? "" : u.pathname}`.replace(/\/+$/, "");
    }
    return "";
  } catch {
    return "";
  }
}

export const defaultAiConfig = (): AiConfig => ({
  keys: { openai: "", deepseek: "", anthropic: "", gemini: "", openrouter: "", azure: "" },
  openaiBaseUrl: "",
  geminiBaseUrl: "",
  stt: { provider: "none", baseUrl: "", apiKey: "", model: "whisper-1" },
  azureRegion: "",
  azureVoice: "fr-FR-DeniseNeural",
  azureVoiceMale: "fr-FR-HenriNeural",
  tts: false,
  vision: { provider: "openai", model: DEFAULT_MODELS.openai },
  text: { provider: "deepseek", model: DEFAULT_MODELS.deepseek },
  image: { provider: "openai", model: DEFAULT_IMAGE_MODELS.openai },
});

const KEY = "word-atlas:ai:v1";
const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function sanitizeAiConfig(v: unknown): AiConfig {
  const d = defaultAiConfig();
  if (!v || typeof v !== "object") return d;
  const o = v as Record<string, any>;
  const keys = o.keys ?? {};
  const vp: VisionProvider = VISION_PROVIDERS.includes(o.vision?.provider) ? o.vision.provider : d.vision.provider;
  const tp: TextProvider = TEXT_PROVIDERS.includes(o.text?.provider) ? o.text.provider : d.text.provider;
  const ip: ImageProvider = IMAGE_PROVIDERS.includes(o.image?.provider) ? o.image.provider : d.image.provider;
  const sttRaw = o.stt && typeof o.stt === "object" ? o.stt : {};
  const sp: SttProvider = STT_PROVIDERS.includes(sttRaw.provider) ? sttRaw.provider : d.stt.provider;
  return {
    keys: { openai: str(keys.openai), deepseek: str(keys.deepseek), anthropic: str(keys.anthropic), gemini: str(keys.gemini), openrouter: str(keys.openrouter), azure: str(keys.azure) },
    openaiBaseUrl: sanitizeBaseUrl(o.openaiBaseUrl),
    geminiBaseUrl: sanitizeBaseUrl(o.geminiBaseUrl),
    stt: {
      provider: sp,
      baseUrl: sanitizeBaseUrl(sttRaw.baseUrl),
      apiKey: str(sttRaw.apiKey),
      model: str(sttRaw.model, 80) || d.stt.model,
    },
    azureRegion: str(o.azureRegion, 40).toLowerCase().replace(/[^a-z0-9]/g, ""),
    azureVoice: str(o.azureVoice, 80) || d.azureVoice,
    azureVoiceMale: str(o.azureVoiceMale, 80) || d.azureVoiceMale,
    tts: o.tts === true,
    vision: { provider: vp, model: str(o.vision?.model, 80) || DEFAULT_MODELS[vp] },
    text: { provider: tp, model: str(o.text?.model, 80) || DEFAULT_MODELS[tp] },
    image: { provider: ip, model: str(o.image?.model, 80) || DEFAULT_IMAGE_MODELS[ip] },
  };
}

function read(): AiConfig {
  try {
    return sanitizeAiConfig(JSON.parse(localStorage.getItem(KEY) || "null"));
  } catch {
    return defaultAiConfig();
  }
}

let config: AiConfig = typeof localStorage === "undefined" ? defaultAiConfig() : read();
const subs = new Set<() => void>();

export const getAiConfig = () => config;

export function setAiConfig(patch: Partial<AiConfig> | ((c: AiConfig) => AiConfig)) {
  config = sanitizeAiConfig(typeof patch === "function" ? patch(config) : { ...config, ...patch });
  try {
    localStorage.setItem(KEY, JSON.stringify(config));
  } catch {
    /* private mode: settings last for this visit */
  }
  subs.forEach((f) => f());
}

export function useAiConfig() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => config,
    () => config,
  );
}

/** What is set up: each job needs its service's key (and Azure its region). */
export const ready = {
  vision: (c = config) => !!c.keys[c.vision.provider],
  text: (c = config) => !!c.keys[c.text.provider],
  image: (c = config) => !!c.keys[c.image.provider],
  tts: (c = config) => c.tts && !!c.keys.azure && !!c.azureRegion,
  stt: (c = config) => (c.stt.provider === "openai" && !!c.keys.openai) || (c.stt.provider === "custom" && !!c.stt.apiKey && !!c.stt.baseUrl),
};
