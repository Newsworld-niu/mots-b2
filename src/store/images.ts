/**
 * Pictures the learner adds to a word (their own words or atlas words), shown instead of the text plate
 * and used by the picture question. Stored in IndexedDB (localStorage is too small), one small JPEG data URL
 * per word id and dataset, all read into memory at start so the atlas can answer img() synchronously.
 * Backups carry them (exportBackup / importBackup).
 */
import { useSyncExternalStore } from "react";

const DB = "word-atlas-images";
const STORE = "images";
/** Longest side of a stored picture, in pixels; the app shows pictures at most about this size. */
export const IMAGE_SIDE = 480;

let images: Record<string, string> = {};
let dataset = "";
let loadPromise: Promise<void> | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function subscribeImages(f: () => void): () => void {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

export function waitImagesLoaded(): Promise<void> {
  return loadPromise ?? Promise.resolve();
}

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

const dbKey = (id: string) => `${dataset}:${id}`;

/** Read every picture of a dataset into memory (called when the dataset is chosen). */
export async function loadImages(datasetId: string) {
  dataset = datasetId;
  const task = (async () => {
    const keys = ((await tx("readonly", (s) => s.getAllKeys())) ?? []) as string[];
    const values = ((await tx("readonly", (s) => s.getAll())) ?? []) as string[];
    const next: Record<string, string> = {};
    keys.forEach((k, i) => {
      if (k.startsWith(`${datasetId}:`) && typeof values[i] === "string") next[k.slice(datasetId.length + 1)] = values[i];
    });
    images = next;
    emit();
  })();
  loadPromise = task;
  return task;
}

export const getImages = () => images;

export function useImages() {
  return useSyncExternalStore(
    subscribeImages,
    () => images,
    () => images,
  );
}

export async function setImage(id: string, dataUrl: string | null) {
  if (dataUrl) await tx("readwrite", (s) => s.put(dataUrl, dbKey(id)));
  else await tx("readwrite", (s) => s.delete(dbKey(id)));
  const next = { ...images };
  if (dataUrl) next[id] = dataUrl;
  else delete next[id];
  images = next;
  emit();
}

/** Replace all pictures (restoring a backup). */
export async function replaceImages(all: Record<string, string>) {
  for (const id of Object.keys(images)) await tx("readwrite", (s) => s.delete(dbKey(id)));
  for (const [id, url] of Object.entries(all)) await tx("readwrite", (s) => s.put(url, dbKey(id)));
  images = { ...all };
  emit();
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
