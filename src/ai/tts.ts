/**
 * Azure speech for words and sentences without a recording, cached in IndexedDB (one MP3 per voice and text)
 * so each text is paid for once. Not part of backups: lost audio is simply made again.
 */
import { azureSpeak } from "./clients";
import { getAiConfig, ready } from "./config";

const DB = "word-atlas-tts";
const STORE = "audio";
const MAX_TEXT = 400;

let db: Promise<IDBDatabase | null> | null = null;
function open() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  db ??= new Promise((resolve) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  return db;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return open().then(
    (d) =>
      new Promise((resolve) => {
        if (!d) return resolve(null);
        const req = fn(d.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      }),
  );
}

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
  const have = urls.get(k);
  if (have) return Promise.resolve(have);
  let p = pending.get(k);
  if (!p) {
    p = (async () => {
      let blob = (await run<Blob>("readonly", (s) => s.get(k))) ?? undefined;
      if (!(blob instanceof Blob)) {
        blob = await azureSpeak(clean, voice);
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
