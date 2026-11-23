/**
 * Azure speech for words and sentences without a recording, cached in IndexedDB (one MP3 per voice and text)
 * so each text is paid for once. Not part of backups: lost audio is simply made again.
 */
import { createIdb } from "../lib/idb";
import { getAiConfig, ready } from "./config";

const DB = "word-atlas-tts";
const STORE = "audio";
const MAX_TEXT = 400;

const ttsIdb = createIdb(DB, 1, (d) => {
  if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
});

const run = <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) =>
  ttsIdb.tx(STORE, mode, fn);

const cacheKey = (voice: string, text: string) => `${voice}\n${text}`;
const urls = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

/** Whether Azure reads texts that have no recording. */
export const ttsOn = () => ready.tts();

/**
 * An object URL of the text spoken by Azure (from the cache, or made now): "uk" is the chosen female voice,
 * "us" the chosen male voice; any other value is a voice name.
 */
export function ttsUrl(text: string, accentOrVoice: string = "uk"): Promise<string> {
  const clean = text.trim().slice(0, MAX_TEXT);
  const c = getAiConfig();
  const voice = accentOrVoice === "us" ? c.azureVoiceMale : accentOrVoice === "uk" ? c.azureVoice : accentOrVoice;
  const k = cacheKey(voice, clean);
  const p = getOrFetch(k, async () => (await import("./clients")).azureSpeak(clean, voice));
  return p;
}

function hashTag(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

function getOrFetch(k: string, synth: () => Promise<Blob>): Promise<string> {
  const have = urls.get(k);
  if (have) return Promise.resolve(have);
  let p = pending.get(k);
  if (!p) {
    p = (async () => {
      let blob = (await run<Blob>("readonly", (s) => s.get(k))) ?? undefined;
      if (!(blob instanceof Blob)) {
        blob = await synth();
        await run("readwrite", (s) => s.put(blob!, k));
      }
      const u = URL.createObjectURL(blob);
      urls.set(k, u);
      return u;
    })().finally(() => pending.delete(k));
    pending.set(k, p);
  }
  return p;
}

/** Cacheable object URL for a full SSML passage (including multi-speaker dialogues). */
export function ttsSsmlUrl(ssml: string): Promise<string> {
  return getOrFetch(`ssml\n${hashTag(ssml)}\n${ssml.length}`, async () => (await import("./clients")).azureSpeakSsml(ssml));
}

export async function ttsCacheSize() {
  return (await run<number>("readonly", (s) => s.count())) ?? 0;
}

export async function clearTtsCache() {
  await run("readwrite", (s) => s.clear());
  urls.forEach((u) => URL.revokeObjectURL(u));
  urls.clear();
}

/** A second French voice for the other speaker of a dialogue: of the other sex than the chosen one when that can be told. */
export function otherVoice(voice = getAiConfig().azureVoice) {
  return /Henri|Alain|Claude|Jerome|Maurice|Yves|Remy|Lucien|Fabrice|Gerard|Thierry|Sylvie.*Male/i.test(voice) ? "fr-FR-DeniseNeural" : "fr-FR-HenriNeural";
}

const FIXED_FALLBACK_VOICES = [
  "fr-FR-DeniseNeural",
  "fr-FR-HenriNeural",
  "fr-FR-BrigitteNeural",
  "fr-FR-AlainNeural",
  "fr-FR-CelesteNeural",
  "fr-FR-ClaudeNeural",
];

/** At least 4 distinct French Azure voice names starting with the user's primary and secondary voices. */
export function speakerVoices(primary = getAiConfig().azureVoice, secondary = getAiConfig().azureVoiceMale): string[] {
  const second = secondary && secondary !== primary ? secondary : otherVoice(primary);
  const out = [primary, second];
  for (const v of FIXED_FALLBACK_VOICES) {
    if (!out.includes(v)) out.push(v);
    if (out.length >= 4) break;
  }
  return out;
}
