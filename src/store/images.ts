/**
 * Pictures the learner adds to a word (their own words or atlas words), shown instead of the text plate
 * and used by the picture question. Persisted in IndexedDB (`word-atlas-images`) while keeping an
 * LRU-bounded in-memory cache (`MAX_MEM_IMAGES`) so large collections never bloat RAM.
 * Backups read all dataset images directly from IndexedDB (`readAllImagesIdb()`).
 */
import { useSyncExternalStore } from "react";
import { createIdb } from "../lib/idb";
import { LruCache } from "../lib/lru";

const DB = "word-atlas-images";
const STORE = "images";
/** Longest side of a stored picture, in pixels; the app shows pictures at most about this size. */
export const IMAGE_SIDE = 480;
/** Maximum number of image data URLs kept hot in RAM at once per active session. */
export const MAX_MEM_IMAGES = 120;

const memCache = new LruCache<string, string>(MAX_MEM_IMAGES);
const knownIds = new Set<string>();
let images: Record<string, string> = {};
let dataset = "";
let loadPromise: Promise<void> | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

function syncSnapshot() {
  const next: Record<string, string> = {};
  for (const [k, v] of memCache.entries()) next[k] = v;
  images = next;
}

export function subscribeImages(f: () => void): () => void {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

export function waitImagesLoaded(): Promise<void> {
  return loadPromise ?? Promise.resolve();
}

const imgIdb = createIdb(DB, 1, (d) => {
  if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
});

const tx = <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) =>
  imgIdb.tx(STORE, mode, fn);

const dbKey = (id: string) => `${dataset}:${id}`;

/** Read dataset images from IndexedDB into the bounded LRU cache. */
export async function loadImages(datasetId: string) {
  dataset = datasetId;
  const task = (async () => {
    const keys = ((await tx("readonly", (s) => s.getAllKeys())) ?? []) as string[];
    const values = ((await tx("readonly", (s) => s.getAll())) ?? []) as string[];
    memCache.clear();
    knownIds.clear();
    const entries: Array<[string, string]> = [];
    const prefix = `${datasetId}:`;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const v = values[i];
      if (typeof k === "string" && k.startsWith(prefix) && typeof v === "string") {
        const id = k.slice(prefix.length);
        knownIds.add(id);
        entries.push([id, v]);
      }
    }
    const start = Math.max(0, entries.length - MAX_MEM_IMAGES);
    for (let i = start; i < entries.length; i++) {
      memCache.set(entries[i][0], entries[i][1]);
    }
    syncSnapshot();
    emit();
  })();
  loadPromise = task;
  return task;
}

/** Snapshot of hot images in RAM (LRU-bounded to MAX_MEM_IMAGES). */
export const getImages = () => images;

/** Read a single hot image and refresh its LRU position. */
export function getImage(id: string): string | undefined {
  return memCache.get(id);
}

/** True when this word id has a picture in memory or IndexedDB. */
export function hasImage(id: string): boolean {
  return memCache.has(id) || knownIds.has(id);
}

/** Load an LRU-evicted image back into RAM from IndexedDB on demand. */
export async function ensureImageLoaded(id: string): Promise<string | null> {
  const hot = memCache.get(id);
  if (hot) return hot;
  if (!dataset || typeof indexedDB === "undefined") return null;
  const val = await tx("readonly", (s) => s.get(dbKey(id)));
  if (typeof val !== "string") return null;
  knownIds.add(id);
  memCache.set(id, val);
  syncSnapshot();
  emit();
  return val;
}

/** Read EVERY picture for the active dataset from IndexedDB (for full backup/sync). */
export async function readAllImagesIdb(): Promise<Record<string, string>> {
  await waitImagesLoaded();
  if (!dataset || typeof indexedDB === "undefined") return { ...images };
  const keys = ((await tx("readonly", (s) => s.getAllKeys())) ?? []) as string[];
  const values = ((await tx("readonly", (s) => s.getAll())) ?? []) as string[];
  if (!keys.length && Object.keys(images).length) return { ...images };
  const out: Record<string, string> = {};
  const prefix = `${dataset}:`;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const v = values[i];
    if (typeof k === "string" && k.startsWith(prefix) && typeof v === "string") {
      out[k.slice(prefix.length)] = v;
    }
  }
  return out;
}

export function useImages() {
  return useSyncExternalStore(
    subscribeImages,
    () => images,
    () => images,
  );
}

export async function setImage(id: string, dataUrl: string | null) {
  if (dataUrl) {
    await tx("readwrite", (s) => s.put(dataUrl, dbKey(id)));
    knownIds.add(id);
    memCache.set(id, dataUrl);
  } else {
    await tx("readwrite", (s) => s.delete(dbKey(id)));
    knownIds.delete(id);
    memCache.delete(id);
  }
  syncSnapshot();
  emit();
}

/** Replace all pictures (restoring a backup). */
export async function replaceImages(all: Record<string, string>) {
  const toDelete = new Set<string>([...knownIds, ...Object.keys(images)]);
  if (dataset && typeof indexedDB !== "undefined") {
    const keys = ((await tx("readonly", (s) => s.getAllKeys())) ?? []) as string[];
    const prefix = `${dataset}:`;
    for (const k of keys) {
      if (typeof k === "string" && k.startsWith(prefix)) toDelete.add(k.slice(prefix.length));
    }
  }
  for (const id of toDelete) await tx("readwrite", (s) => s.delete(dbKey(id)));
  memCache.clear();
  knownIds.clear();
  const entries = Object.entries(all);
  for (const [id, url] of entries) {
    await tx("readwrite", (s) => s.put(url, dbKey(id)));
    knownIds.add(id);
  }
  const start = Math.max(0, entries.length - MAX_MEM_IMAGES);
  for (let i = start; i < entries.length; i++) {
    memCache.set(entries[i][0], entries[i][1]);
  }
  syncSnapshot();
  emit();
}

/** Reset IndexedDB connection & in-memory cache (for isolated tests). */
export function resetImagesForTest(): void {
  imgIdb.reset();
  memCache.clear();
  knownIds.clear();
  images = {};
  dataset = "";
  loadPromise = null;
}

/** Only small JPEG / PNG / WebP data URLs are accepted from a backup. */
export const isImageDataUrl = (v: unknown): v is string => typeof v === "string" && v.length < 600_000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v);

/** Shrink a picture file to IMAGE_SIDE and encode it as JPEG. */
export async function fileToImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("请选择一张图片");
  if (file.size > 20 * 1024 * 1024) throw new Error("图片太大（超过 20 MB）");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}
