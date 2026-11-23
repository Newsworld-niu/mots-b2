/** Upstream the interface is adapted from (MIT code, CC BY 4.0 content). */
export const REPO_URL = "https://github.com/designfuchen/word-atlas";

/** Language of the text being learned; used for the speech synthesis voice. */
export const TARGET_LANG = "fr-FR";

/** Dataset id: progress is stored under word-atlas:v2:<id>. Must match public/atlas/index.json. */
export const DATASET_ID = "francais-b2-lexicon";

/** Optional cloud sync server base URL (e.g. https://...azurewebsites.net). */
const envSyncUrl =
  typeof import.meta !== "undefined" && import.meta.env
    ? ((import.meta.env.VITE_SYNC_URL as string | undefined)?.trim() ||
      (import.meta.env.VITE_SYNC_API_URL as string | undefined)?.trim())
    : undefined;

export const SYNC_API_URL: string = envSyncUrl || "https://mots-b2-sync-e12d4e.azurewebsites.net";

/** Optional Azure Blob Storage media base URL (e.g. https://motsb2media....blob.core.windows.net/media). */
export const MEDIA_BASE_URL: string =
  (typeof import.meta !== "undefined" && import.meta.env
    ? (import.meta.env.VITE_MEDIA_BASE_URL as string | undefined)?.trim().replace(/\/+$/, "")
    : undefined) ?? "";
