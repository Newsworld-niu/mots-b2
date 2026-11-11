/**
 * AI service settings: keys and which service and model does each job. Kept in this browser only
 * (localStorage, its own key), never written into backups.
 */
import { useSyncExternalStore } from "react";

export type TextProvider = "openai" | "deepseek" | "anthropic";
export type VisionProvider = "openai" | "anthropic";

export interface AiConfig {
  keys: { openai: string; deepseek: string; anthropic: string; azure: string };
  azureRegion: string;
  /** Azure neural voice name, e.g. fr-FR-DeniseNeural. */
  azureVoice: string;
  /** Read words and sentences with Azure when they have no recording (device voice otherwise). */
  tts: boolean;
  vision: { provider: VisionProvider; model: string };
  text: { provider: TextProvider; model: string };
  image: { model: string };
}

/** Defaults; every model can be changed in the settings. */
export const DEFAULT_MODELS: Record<TextProvider, string> = {
  openai: "gpt-5-mini",
  deepseek: "deepseek-chat",
  anthropic: "claude-opus-5-5",
};
export const DEFAULT_IMAGE_MODEL = "gpt-image-1";

export const defaultAiConfig = (): AiConfig => ({
  keys: { openai: "", deepseek: "", anthropic: "", azure: "" },
  azureRegion: "",
  azureVoice: "fr-FR-DeniseNeural",
  tts: false,
  vision: { provider: "openai", model: DEFAULT_MODELS.openai },
  text: { provider: "deepseek", model: DEFAULT_MODELS.deepseek },
  image: { model: DEFAULT_IMAGE_MODEL },
});

const KEY = "word-atlas:ai:v1";
const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function sanitizeAiConfig(v: unknown): AiConfig {
  const d = defaultAiConfig();
  if (!v || typeof v !== "object") return d;
  const o = v as Record<string, any>;
  const keys = o.keys ?? {};
  const vp = o.vision?.provider === "anthropic" ? "anthropic" : "openai";
  const tp: TextProvider = ["openai", "deepseek", "anthropic"].includes(o.text?.provider) ? o.text.provider : d.text.provider;
  return {
    keys: { openai: str(keys.openai), deepseek: str(keys.deepseek), anthropic: str(keys.anthropic), azure: str(keys.azure) },
    azureRegion: str(o.azureRegion, 40).toLowerCase().replace(/[^a-z0-9]/g, ""),
    azureVoice: str(o.azureVoice, 80) || d.azureVoice,
    tts: o.tts === true,
    vision: { provider: vp, model: str(o.vision?.model, 80) || DEFAULT_MODELS[vp] },
    text: { provider: tp, model: str(o.text?.model, 80) || DEFAULT_MODELS[tp] },
    image: { model: str(o.image?.model, 80) || DEFAULT_IMAGE_MODEL },
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
  image: (c = config) => !!c.keys.openai,
  tts: (c = config) => c.tts && !!c.keys.azure && !!c.azureRegion,
};
