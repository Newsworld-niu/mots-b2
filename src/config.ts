/** Upstream the interface is adapted from (MIT code, CC BY 4.0 content). */
export const REPO_URL = "https://github.com/designfuchen/word-atlas";

/** Language of the text being learned; used for the speech synthesis voice. */
export const TARGET_LANG = "fr-FR";

/** Dataset id: progress is stored under word-atlas:v2:<id>. Must match public/atlas/index.json. */
export const DATASET_ID = "francais-b2-lexicon";

/** Cloud sync server base URL. Override with VITE_SYNC_URL (or VITE_SYNC_API_URL) for a separate sync host. */
const envSyncUrl =
  typeof import.meta !== "undefined" && import.meta.env
    ? ((import.meta.env.VITE_SYNC_URL as string | undefined)?.trim() ||
      (import.meta.env.VITE_SYNC_API_URL as string | undefined)?.trim())
    : undefined;

/**
 * Without an override the app talks to its own origin: the Cloudflare Worker serves /api/* next to the static
 * site. Outside a web page (Node unit tests, file://) there is no origin, so sync stays unconfigured.
 */
function sameOriginSyncUrl(): string {
  const loc = (globalThis as { location?: { origin?: string; protocol?: string } }).location;
  if (typeof loc !== "undefined" && loc && /^https?:$/i.test(loc.protocol ?? "") && loc.origin) return loc.origin;
  return "";
}

export const SYNC_API_URL: string = envSyncUrl || sameOriginSyncUrl();

/** Optional base for offloaded audio/video: `/media` on Cloudflare (R2 via the Worker), or an absolute CDN URL. */
export const MEDIA_BASE_URL: string =
  (typeof import.meta !== "undefined" && import.meta.env
    ? (import.meta.env.VITE_MEDIA_BASE_URL as string | undefined)?.trim().replace(/\/+$/, "")
    : undefined) ?? "";
