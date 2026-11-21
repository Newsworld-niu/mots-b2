/**
 * AI service settings: keys and which service and model does each job. Kept in this browser only
 * (localStorage, its own key), never written into backups.
 */
import { useSyncExternalStore } from "react";

export type TextProvider = "openai" | "deepseek" | "anthropic" | "openrouter";
export type VisionProvider = "openai" | "anthropic" | "openrouter";
export const TEXT_PROVIDERS: TextProvider[] = ["deepseek", "openai", "anthropic", "openrouter"];
export const VISION_PROVIDERS: VisionProvider[] = ["openai", "anthropic", "openrouter"];
export type ImageProvider = "openai" | "openrouter";
export const IMAGE_PROVIDERS: ImageProvider[] = ["openai", "openrouter"];

export interface AiConfig {
  keys: { openai: string; deepseek: string; anthropic: string; openrouter: string; azure: string };
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
  // OpenRouter names models <maker>/<model>; multimodal + calibrated best for DELF B2 grading
  openrouter: "google/gemini-2.5-flash",
};

/** Recommended models surfaced in AI settings for DELF B2 grading consistency. */
export const GRADING_RECOMMENDED_MODELS = {
  openrouter: ["google/gemini-2.5-flash", "deepseek/deepseek-chat"],
  deepseek: ["deepseek-chat"],
} as const;
export const DEFAULT_IMAGE_MODELS: Record<ImageProvider, string> = { openai: "gpt-image-1", openrouter: "openai/gpt-image-1-mini" };

export const defaultAiConfig = (): AiConfig => ({
  keys: { openai: "", deepseek: "", anthropic: "", openrouter: "", azure: "" },
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
  return {
    keys: { openai: str(keys.openai), deepseek: str(keys.deepseek), anthropic: str(keys.anthropic), openrouter: str(keys.openrouter), azure: str(keys.azure) },
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
};
