/**
 * Persistent IndexedDB store for user-imported local `.mp3` / `.pdf` study materials.
 * Uses separate object-URL loading on demand so localStorage remains compact.
 */

const DB = "word-atlas-real-media";
const STORE = "files";

export interface StoredMediaFile {
  blob: Blob;
  name: string;
  mime: string;
  created: number;
}

export const hasMediaIdb = (): boolean => typeof indexedDB !== "undefined";

function openDb(): Promise<IDBDatabase | null> {
  if (!hasMediaIdb()) return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

export const audioMediaKey = (sourceId: string) => `audio:${sourceId}`;
export const pdfMediaKey = (sourceId: string) => `pdf:${sourceId}`;

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
