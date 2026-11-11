/**
 * One-time migration from the first French prototype (key "mots-b2:v1") to the word-atlas v2 storage.
 * Memory state (cards, bookmarks, daily stats, mistakes) carries over unchanged because the card format is the same.
 * An unfinished session is dropped: its step list refers to the old prototype's quiz formats.
 */
const LEGACY_KEY = "mots-b2:v1";
const MIGRATED_FLAG = "mots-b2:migrated-to-word-atlas-v2";

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export interface LegacyResult {
  progress: Record<string, unknown>;
  settings: Record<string, unknown>;
  /** Number of cards that were carried over. */
  cards: number;
}

/** Pure conversion, testable without a browser. Returns null when the legacy payload is not usable. */
export function convertLegacy(raw: string | null, datasetId: string): LegacyResult | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(data) || !isObj(data.progress) || data.progress.version !== 1 || !isObj(data.progress.cards)) return null;
  const p = data.progress;
  const modeMap: Record<string, string> = { dictee: "dictation", traduction: "sentence" };
  const typing = Array.isArray(p.typing)
    ? (p.typing as Record<string, unknown>[]).map((t) => ({ ...t, mode: modeMap[String(t.mode)] ?? "word" }))
    : [];
  const progress = {
    version: 2,
    datasetId,
    cards: p.cards,
    bookmarks: Array.isArray(p.bookmarks) ? p.bookmarks : [],
    days: isObj(p.days) ? p.days : {},
    typing,
    session: null,
    mistakes: Array.isArray(p.mistakes) ? p.mistakes : [],
  };
  const s = isObj(data.settings) ? data.settings : {};
  const settings: Record<string, unknown> = {};
  for (const k of ["dailyNew", "retention", "autoplay", "spell", "theme"] as const) if (s[k] !== undefined) settings[k] = s[k];
  return { progress, settings, cards: Object.keys(p.cards as object).length };
}

/**
 * Run before the app mounts. Writes the converted progress only if the v2 key is still empty,
 * so a second run (or a user who already started with v2) is never overwritten.
 */
export function migrateLegacy(storage: Storage, datasetId: string, settingsKey: string, progressKey: (id: string) => string) {
  if (storage.getItem(MIGRATED_FLAG)) return { ran: false as const };
  const result = convertLegacy(storage.getItem(LEGACY_KEY), datasetId);
  if (!result) return { ran: false as const };
  if (!storage.getItem(progressKey(datasetId))) storage.setItem(progressKey(datasetId), JSON.stringify(result.progress));
  if (!storage.getItem(settingsKey)) storage.setItem(settingsKey, JSON.stringify(result.settings));
  storage.setItem(MIGRATED_FLAG, new Date().toISOString());
  return { ran: true as const, cards: result.cards };
}
