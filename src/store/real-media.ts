/**
 * Persistent IndexedDB store for user-imported local `.mp3` / `.pdf` study materials.
 * Uses separate object-URL loading on demand so localStorage remains compact.
 */

import { createIdb } from "../lib/idb";
import type { LocalLoungeVideoMeta } from "../lib/lounge-types";

const DB = "word-atlas-real-media";
const STORE = "files";

export interface StoredMediaFile {
  blob: Blob;
  name: string;
  mime: string;
  created: number;
}

export const hasMediaIdb = (): boolean => typeof indexedDB !== "undefined";

const mediaIdb = createIdb(DB, 1, (d) => {
  if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
});

const tx = <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) =>
  mediaIdb.tx(STORE, mode, fn);

export const audioMediaKey = (sourceId: string) => `audio:${sourceId}`;
export const pdfMediaKey = (sourceId: string) => `pdf:${sourceId}`;
export const videoMediaKey = (id: string) => `lounge-video:${id}`;
export const subMediaKey = (id: string) => `lounge-sub:${id}`;
export const ytSubMediaKey = (videoId: string) => `lounge-ytsub:${videoId}`;
export const videoMetaMediaKey = (id: string) => `lounge-vmeta:${id}`;

export const isLoungeMediaKey = (key: string): boolean =>
  key.startsWith("lounge-video:") ||
  key.startsWith("lounge-sub:") ||
  key.startsWith("lounge-ytsub:") ||
  key.startsWith("lounge-vmeta:");

/** Persist a user-selected audio or PDF File/Blob in IndexedDB under `key`. */
export async function saveRealMedia(key: string, file: File | Blob, name = "local-file", mime = file.type || "application/octet-stream"): Promise<boolean> {
  if (!hasMediaIdb()) return false;
  const rec: StoredMediaFile = { blob: file, name, mime, created: Date.now() };
  const ok = await tx("readwrite", (s) => s.put(rec, key));
  return ok !== null;
}

/** Read a previously saved media blob back from IndexedDB. */
export async function getRealMedia(key: string): Promise<StoredMediaFile | null> {
  if (!hasMediaIdb()) return null;
  const v = await tx("readonly", (s) => s.get(key));
  if (!v || typeof v !== "object" || !("blob" in v)) return null;
  return v as StoredMediaFile;
}

/** Delete a single saved key from IndexedDB. */
export async function deleteRealMedia(key: string): Promise<void> {
  if (!hasMediaIdb()) return;
  await tx("readwrite", (s) => s.delete(key));
}

/** Remove both audio and PDF blobs belonging to `sourceId`. */
export async function deleteRealMediaForSource(sourceId: string): Promise<void> {
  await Promise.all([deleteRealMedia(audioMediaKey(sourceId)), deleteRealMedia(pdfMediaKey(sourceId))]);
}

/** Save lightweight metadata for a local Lounge video without mixing with blob entries. */
export async function saveLoungeVideoMeta(meta: LocalLoungeVideoMeta): Promise<boolean> {
  if (!hasMediaIdb()) return false;
  const ok = await tx("readwrite", (s) => s.put(meta, videoMetaMediaKey(meta.id)));
  return ok !== null;
}

const isVideoMeta = (v: unknown): v is LocalLoungeVideoMeta =>
  !!v &&
  typeof v === "object" &&
  typeof (v as LocalLoungeVideoMeta).id === "string" &&
  typeof (v as LocalLoungeVideoMeta).title === "string" &&
  typeof (v as LocalLoungeVideoMeta).created === "number" &&
  typeof (v as LocalLoungeVideoMeta).videoBytes === "number";

/** List all saved local Lounge video metadata records (newest first) without loading video blobs. */
export async function listLoungeVideoMetas(): Promise<LocalLoungeVideoMeta[]> {
  if (!hasMediaIdb()) return [];
  const rawKeys = await tx("readonly", (s) => s.getAllKeys());
  if (!rawKeys?.length) return [];
  const metaKeys = rawKeys.map(String).filter((k) => k.startsWith("lounge-vmeta:"));
  if (!metaKeys.length) return [];
  const items = await Promise.all(metaKeys.map((k) => tx("readonly", (s) => s.get(k))));
  return items.filter(isVideoMeta).sort((a, b) => b.created - a.created);
}

/** Delete video blob, subtitle blob, and metadata for one local Lounge video. */
export async function deleteLoungeVideoRecords(id: string): Promise<void> {
  await Promise.all([
    deleteRealMedia(videoMediaKey(id)),
    deleteRealMedia(subMediaKey(id)),
    deleteRealMedia(videoMetaMediaKey(id)),
  ]);
}

/** Estimate total bytes and video count stored under Lounge media keys (ignoring audio:/pdf: RFI/FEI files). */
export async function inspectLoungeMedia(): Promise<{ videosBytes: number; videoCount: number }> {
  if (!hasMediaIdb()) return { videosBytes: 0, videoCount: 0 };
  const rawKeys = await tx("readonly", (s) => s.getAllKeys());
  if (!rawKeys?.length) return { videosBytes: 0, videoCount: 0 };
  const keys = rawKeys.map(String).filter(isLoungeMediaKey);
  if (!keys.length) return { videosBytes: 0, videoCount: 0 };

  let videosBytes = 0;
  const metaIds = new Set<string>();
  const metaKeys = keys.filter((k) => k.startsWith("lounge-vmeta:"));
  const metas = await Promise.all(metaKeys.map((k) => tx("readonly", (s) => s.get(k))));
  for (const m of metas) {
    if (isVideoMeta(m)) {
      metaIds.add(m.id);
      videosBytes += Math.max(0, m.videoBytes);
    }
  }

  for (const k of keys) {
    if (k.startsWith("lounge-vmeta:")) continue;
    if (k.startsWith("lounge-video:")) {
      const id = k.slice("lounge-video:".length);
      if (metaIds.has(id)) continue;
      const rec = await getRealMedia(k);
      if (rec) {
        metaIds.add(id);
        videosBytes += rec.blob.size;
      }
      continue;
    }
    const rec = await getRealMedia(k);
    if (rec) videosBytes += rec.blob.size;
  }

  return { videosBytes, videoCount: metaIds.size };
}

/** Clear all Lounge video/subtitle keys from IndexedDB while preserving audio:/pdf: RFI/FEI materials. */
export async function clearLoungeMedia(): Promise<void> {
  if (!hasMediaIdb()) return;
  const rawKeys = await tx("readonly", (s) => s.getAllKeys());
  if (!rawKeys?.length) return;
  const loungeKeys = rawKeys.map(String).filter(isLoungeMediaKey);
  await Promise.all(loungeKeys.map((k) => tx("readwrite", (s) => s.delete(k))));
}
