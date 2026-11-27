/**
 * AI service settings: keys and which service and model does each job. Kept in this browser (localStorage, its own
 * key) and never written into the manual JSON backups. Cross-device sync lives in src/sync/ai-sync.ts, which imports
 * this module (never the other way round, so the sync engine stays out of the early chunks).
 */
import { useSyncExternalStore } from "react";
import { AiError } from "./errors";

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
  /**
   * The model each service last answered with for real (测试连接, the 1 步 wizard, or a runtime self-heal after a
   * retired-model 404). Switching a job back to that service starts from it instead of the built-in default.
   */
  lastGoodModel?: Partial<Record<TextProvider, string>>;
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
/**
 * Text models offered before the key's own list is read. `gemini-2.5-*` still answers on existing projects but is
 * closed to newly created ones (HTTP 404 "no longer available to new users"), so the newer generation is listed too;
 * requests on the 2.5 defaults heal themselves to an available model (see gemini.ts).
 */
export const GEMINI_PRESET_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite",
  "gemini-3-flash-preview",
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-2.0-flash",
] as const;
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
  lastGoodModel: {},
});

const KEY = "word-atlas:ai:v1";
const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function sanitizeAiConfig(v: unknown): AiConfig {
  const d = defaultAiConfig();
  if (!v || typeof v !== "object") return d;
  const o = v as Record<string, unknown>;
  const obj = (x: unknown): Record<string, unknown> => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {});
  const keys = obj(o.keys);
  const vision = obj(o.vision);
  const text = obj(o.text);
  const image = obj(o.image);
  const vp: VisionProvider = VISION_PROVIDERS.includes(vision.provider as VisionProvider) ? (vision.provider as VisionProvider) : d.vision.provider;
  const tp: TextProvider = TEXT_PROVIDERS.includes(text.provider as TextProvider) ? (text.provider as TextProvider) : d.text.provider;
  const ip: ImageProvider = IMAGE_PROVIDERS.includes(image.provider as ImageProvider) ? (image.provider as ImageProvider) : d.image.provider;
  const sttRaw = obj(o.stt);
  const sp: SttProvider = STT_PROVIDERS.includes(sttRaw.provider as SttProvider) ? (sttRaw.provider as SttProvider) : d.stt.provider;
  const goodRaw = obj(o.lastGoodModel);
  const lastGoodModel: Partial<Record<TextProvider, string>> = {};
  for (const p of TEXT_PROVIDERS) {
    const m = str(goodRaw[p], 80);
    if (m) lastGoodModel[p] = m;
  }
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
    vision: { provider: vp, model: str(vision.model, 80) || DEFAULT_MODELS[vp] },
    text: { provider: tp, model: str(text.model, 80) || DEFAULT_MODELS[tp] },
    image: { provider: ip, model: str(image.model, 80) || DEFAULT_IMAGE_MODELS[ip] },
    lastGoodModel,
  };
}

/* ---------- credentials and the non-sensitive part (cross-device sync) ---------- */

/** The 7 credential slots: the 6 service keys (`keys.*`) and the Whisper-compatible key (`stt.apiKey`). */
export const CREDENTIAL_SLOTS = ["openai", "deepseek", "anthropic", "gemini", "openrouter", "azure", "stt"] as const;
export type CredentialSlot = (typeof CREDENTIAL_SLOTS)[number];
/** One value per credential slot ("" when empty). */
export type SyncedAiKeys = Record<CredentialSlot, string>;

/** Everything in AiConfig except the credentials: what can be synced without the API keys. */
export interface NonSensitiveAiConfig {
  openaiBaseUrl: string;
  geminiBaseUrl: string;
  stt: { provider: SttProvider; baseUrl: string; model: string };
  azureRegion: string;
  azureVoice: string;
  azureVoiceMale: string;
  tts: boolean;
  vision: { provider: VisionProvider; model: string };
  text: { provider: TextProvider; model: string };
  image: { provider: ImageProvider; model: string };
  lastGoodModel: Partial<Record<TextProvider, string>>;
}

/** A credential as it is stored (trimmed, bounded). */
export const sanitizeCredential = (v: unknown) => str(v);

/** The value of one credential slot. */
export function credentialOf(c: AiConfig, slot: CredentialSlot): string {
  return slot === "stt" ? (c.stt?.apiKey ?? "") : (c.keys?.[slot] ?? "");
}

/** `c` with one credential slot replaced (sanitized). */
export function withCredential(c: AiConfig, slot: CredentialSlot, value: string): AiConfig {
  const v = sanitizeCredential(value);
  return slot === "stt" ? { ...c, stt: { ...c.stt, apiKey: v } } : { ...c, keys: { ...c.keys, [slot]: v } };
}

/** All 7 credential slots of `c`, in CREDENTIAL_SLOTS order. */
export function extractSyncedKeys(c: AiConfig): SyncedAiKeys {
  const out = {} as SyncedAiKeys;
  for (const slot of CREDENTIAL_SLOTS) out[slot] = credentialOf(c, slot);
  return out;
}

/** The non-sensitive part of `c`, built field by field: it never carries `keys` or `stt.apiKey`. */
export function toNonSensitiveAiConfig(c: AiConfig): NonSensitiveAiConfig {
  const lastGoodModel: Partial<Record<TextProvider, string>> = {};
  for (const p of TEXT_PROVIDERS) {
    const m = c.lastGoodModel?.[p];
    if (m) lastGoodModel[p] = m;
  }
  return {
    openaiBaseUrl: c.openaiBaseUrl,
    geminiBaseUrl: c.geminiBaseUrl,
    stt: { provider: c.stt.provider, baseUrl: c.stt.baseUrl, model: c.stt.model },
    azureRegion: c.azureRegion,
    azureVoice: c.azureVoice,
    azureVoiceMale: c.azureVoiceMale,
    tts: c.tts,
    vision: { provider: c.vision.provider, model: c.vision.model },
    text: { provider: c.text.provider, model: c.text.model },
    image: { provider: c.image.provider, model: c.image.model },
    lastGoodModel,
  };
}

/** Sanitize an untrusted non-sensitive config (any credential it carries is dropped). */
export function sanitizeNonSensitiveAiConfig(v: unknown): NonSensitiveAiConfig {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const stt = o.stt && typeof o.stt === "object" && !Array.isArray(o.stt) ? { ...(o.stt as Record<string, unknown>), apiKey: "" } : undefined;
  return toNonSensitiveAiConfig(sanitizeAiConfig({ ...o, keys: undefined, stt }));
}

export function nonSensitiveAiConfigEquals(a: NonSensitiveAiConfig, b: NonSensitiveAiConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** `c` with its non-sensitive part replaced by `ns`; the 7 credential slots of `c` are kept as they are. */
export function withNonSensitiveAiConfig(c: AiConfig, ns: NonSensitiveAiConfig): AiConfig {
  return sanitizeAiConfig({
    ...ns,
    keys: { ...c.keys },
    stt: { ...ns.stt, apiKey: c.stt.apiKey },
    lastGoodModel: { ...ns.lastGoodModel },
  });
}

/* ---------- state ---------- */

function read(): AiConfig {
  try {
    return sanitizeAiConfig(JSON.parse(localStorage.getItem(KEY) || "null"));
  } catch {
    return defaultAiConfig();
  }
}

const hasStorage = () => typeof localStorage !== "undefined";

let config: AiConfig = hasStorage() ? read() : defaultAiConfig();
const subs = new Set<() => void>();
const notify = () =>
  subs.forEach((f) => {
    try {
      f();
    } catch {
      /* a broken listener never blocks the others */
    }
  });

export const getAiConfig = () => config;

function persist(c: AiConfig) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* private mode: settings last for this visit */
  }
}

/** Called after a local edit (UI or a runtime self-heal), never for a config written back by cloud sync. */
export type AiMutationListener = (prev: AiConfig, next: AiConfig) => void;
const mutationListeners = new Set<AiMutationListener>();
/** The config before the first edit made while no listener was registered yet (handed to the first one). */
let bufferedPrev: AiConfig | null = null;

/** Be told about local edits of the AI settings (ai-sync uses it to advance its revisions). */
export function onLocalAiMutation(listener: AiMutationListener): () => void {
  mutationListeners.add(listener);
  if (bufferedPrev) {
    const prev = bufferedPrev;
    bufferedPrev = null;
    if (JSON.stringify(prev) !== JSON.stringify(config)) {
      try {
        listener(prev, config);
      } catch {
        /* ignore */
      }
    }
  }
  return () => {
    mutationListeners.delete(listener);
  };
}

/** A local edit of the settings (UI, wizard, runtime self-heal). */
export function setAiConfig(patch: Partial<AiConfig> | ((c: AiConfig) => AiConfig)) {
  const prev = config;
  config = sanitizeAiConfig(typeof patch === "function" ? patch(config) : { ...config, ...patch });
  persist(config);
  if (JSON.stringify(prev) !== JSON.stringify(config)) {
    clearGuardsEditedLocally(prev, config);
    if (mutationListeners.size) {
      mutationListeners.forEach((f) => {
        try {
          f(prev, config);
        } catch {
          /* ignore */
        }
      });
    } else {
      bufferedPrev ??= prev;
    }
  }
  notify();
}

/** Write a config received from cloud sync: refreshes the UI but is not recorded as a local edit. */
export function applySyncedAiConfig(next: AiConfig) {
  config = sanitizeAiConfig(next);
  persist(config);
  notify();
}

export function subscribeAiConfig(listener: () => void): () => void {
  subs.add(listener);
  return () => {
    subs.delete(listener);
  };
}

/** Read the settings again from localStorage (another tab, or a test that swapped localStorage). */
export function reloadAiConfig(): AiConfig {
  config = hasStorage() ? read() : defaultAiConfig();
  unconfirmed = hasStorage() ? readGuard() : {};
  bufferedPrev = null;
  notify();
  return config;
}

export function useAiConfig() {
  return useSyncExternalStore(subscribeAiConfig, () => config, () => config);
}

/* ---------- custom endpoints changed by cloud sync (protects the keys of this device) ---------- */

export type UnconfirmedEndpointKind = "openai" | "gemini" | "stt";
export const UNCONFIRMED_ENDPOINT_KINDS: readonly UnconfirmedEndpointKind[] = ["openai", "gemini", "stt"];
const GUARD_KEY = "word-atlas:ai-endpoint-guard:v1";
const KIND_LABEL: Record<UnconfirmedEndpointKind, string> = { openai: "OpenAI 兼容", gemini: "Gemini", stt: "Whisper 语音转写" };

function sanitizeGuard(v: unknown): Partial<Record<UnconfirmedEndpointKind, string>> {
  const out: Partial<Record<UnconfirmedEndpointKind, string>> = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const k of UNCONFIRMED_ENDPOINT_KINDS) {
    const u = sanitizeBaseUrl((v as Record<string, unknown>)[k]);
    if (u) out[k] = u;
  }
  return out;
}

function readGuard(): Partial<Record<UnconfirmedEndpointKind, string>> {
  try {
    return sanitizeGuard(JSON.parse(localStorage.getItem(GUARD_KEY) || "null"));
  } catch {
    return {};
  }
}

let unconfirmed: Partial<Record<UnconfirmedEndpointKind, string>> = hasStorage() ? readGuard() : {};

/** Custom base URLs that cloud sync changed while this device keeps its own key for them, not yet confirmed. */
export function getUnconfirmedBaseUrls(): Partial<Record<UnconfirmedEndpointKind, string>> {
  return unconfirmed;
}

export function setUnconfirmedBaseUrls(next: Partial<Record<UnconfirmedEndpointKind, string>>) {
  const clean = sanitizeGuard(next);
  if (JSON.stringify(clean) === JSON.stringify(unconfirmed)) return;
  unconfirmed = clean;
  try {
    if (Object.keys(clean).length) localStorage.setItem(GUARD_KEY, JSON.stringify(clean));
    else localStorage.removeItem(GUARD_KEY);
  } catch {
    /* ignore */
  }
  notify();
}

/**
 * The learner trusts the synced address (信任并启用, 测试连接): requests may go there with the local key.
 * When `expectedBaseUrl` is given, only clears the guard if it matches that exact sanitized address.
 */
export function confirmSyncedBaseUrl(kind: UnconfirmedEndpointKind, expectedBaseUrl?: string) {
  const cur = unconfirmed[kind];
  if (!cur) return;
  if (expectedBaseUrl !== undefined && cur !== sanitizeBaseUrl(expectedBaseUrl)) return;
  const next = { ...unconfirmed };
  delete next[kind];
  setUnconfirmedBaseUrls(next);
}

export function useUnconfirmedBaseUrls() {
  return useSyncExternalStore(subscribeAiConfig, () => unconfirmed, () => unconfirmed);
}

const guardBase = (c: AiConfig, kind: UnconfirmedEndpointKind) => (kind === "openai" ? c.openaiBaseUrl : kind === "gemini" ? c.geminiBaseUrl : c.stt.baseUrl);
const guardKey = (c: AiConfig, kind: UnconfirmedEndpointKind) => (kind === "openai" ? c.keys.openai : kind === "gemini" ? c.keys.gemini : c.stt.apiKey);

/** A local edit of a base URL or its key means the learner has seen it: the mark goes. */
function clearGuardsEditedLocally(prev: AiConfig, next: AiConfig) {
  let changed = false;
  const out = { ...unconfirmed };
  for (const k of UNCONFIRMED_ENDPOINT_KINDS) {
    if (out[k] && (guardBase(prev, k) !== guardBase(next, k) || guardKey(prev, k) !== guardKey(next, k))) {
      delete out[k];
      changed = true;
    }
  }
  if (changed) setUnconfirmedBaseUrls(out);
}

/**
 * Throw before any request that would send this device's own key to a custom address that cloud sync changed and
 * the learner has not confirmed yet, so that the key never reaches it.
 */
export function assertEndpointTrustedForLocalKey(kind: UnconfirmedEndpointKind, currentBaseUrl: string | undefined, hasKey: boolean) {
  const u = unconfirmed[kind];
  if (!u || !hasKey) return;
  if (u !== sanitizeBaseUrl(currentBaseUrl ?? "")) return;
  throw new AiError(
    `云同步更新了${KIND_LABEL[kind]}自定义接口地址（${u}）。为保护本机原有的 API Key，确认前不会向该地址发送请求：请前往「我的 → AI 接口」确认启用该地址，或点击「测试连接」。`,
  );
}

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("storage", (e: StorageEvent) => {
    if (e.key !== KEY && e.key !== GUARD_KEY && e.key !== null) return;
    if (e.key === KEY || e.key === null) config = read();
    if (e.key === GUARD_KEY || e.key === null) unconfirmed = readGuard();
    notify();
  });
}

/** What is set up: each job needs its service's key (and Azure its region). */
export const ready = {
  vision: (c = config) => !!c.keys[c.vision.provider],
  text: (c = config) => !!c.keys[c.text.provider],
  image: (c = config) => !!c.keys[c.image.provider],
  tts: (c = config) => c.tts && !!c.keys.azure && !!c.azureRegion,
  stt: (c = config) => (c.stt.provider === "openai" && !!c.keys.openai) || (c.stt.provider === "custom" && !!c.stt.apiKey && !!c.stt.baseUrl),
};
