import { MEDIA_BASE_URL } from "../config";

const HEAVY_MEDIA_RE = /\.(?:mp3|m4a|aac|ogg|oga|wav|mp4|webm|m4v)(?:[?#].*)?$/i;

/** Whether a relative public asset path points to offloaded heavy audio/video media. */
export function isOffloadedMediaPath(relPath: string): boolean {
  const clean = relPath.replace(/^\/+/, "");
  return (clean.startsWith("atlas/audio/") || clean.startsWith("materials/")) && HEAVY_MEDIA_RE.test(clean);
}

/** Resolve a static asset path against local Vite BASE_URL or Azure Blob Storage (`VITE_MEDIA_BASE_URL`). */
export function resolveMediaUrl(relPath: string, base = "/", mediaBase = MEDIA_BASE_URL): string {
  if (/^(?:https?:\/\/|idb:|blob:|data:)/i.test(relPath)) return relPath;
  const clean = relPath.replace(/^\/+/, "");
  const cleanMedia = mediaBase.trim().replace(/\/+$/, "");
  if (cleanMedia && isOffloadedMediaPath(clean)) {
    return `${cleanMedia}/${clean}`;
  }
  return `${base.replace(/\/?$/, "/")}${clean}`;
}

/** Check whether a resolved URL belongs to the app origin or configured Azure Blob media origin. */
export function isAllowedOfflineOrigin(url: URL, appOrigin: string, mediaBase = MEDIA_BASE_URL): boolean {
  if (url.origin === appOrigin) return true;
  const cleanMedia = mediaBase.trim();
  if (!cleanMedia) return false;
  try {
    return new URL(cleanMedia).origin === url.origin;
  } catch {
    return false;
  }
}
