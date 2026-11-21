/**
 * The learner's last few recordings (口语、每日一分钟), kept in their own IndexedDB database so that they can be
 * played again after the page is closed. Never in localStorage or backups; the oldest beyond MAX_KEPT are removed.
 */

const DB = "word-atlas-recordings";
const STORE = "recordings";
export const MAX_KEPT = 6;

export interface KeptRecording {
  id: string;
  at: number;
  /** What was said: the question or subject. */
  label: string;
  seconds: number;
  blob: Blob;
}

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

function run<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Newest first. */
export async function listRecordings(): Promise<KeptRecording[]> {
  const db = await open();
  if (!db) return [];
  const all = ((await run(db, "readonly", (s) => s.getAll())) ?? []) as KeptRecording[];
  return all.filter((r) => r && r.blob instanceof Blob).sort((a, b) => b.at - a.at);
}

/** Keep a recording; drops the oldest beyond MAX_KEPT. Fails quietly (private mode, no space). */
export async function keepRecording(r: Omit<KeptRecording, "id" | "at">): Promise<void> {
  const db = await open();
  if (!db) return;
  const at = Date.now();
  await run(db, "readwrite", (s) => s.put({ ...r, id: `r-${at.toString(36)}${Math.random().toString(36).slice(2, 6)}`, at }));
  const all = await listRecordings();
  for (const old of all.slice(MAX_KEPT)) await run(db, "readwrite", (s) => s.delete(old.id));
}

export async function deleteRecording(id: string): Promise<void> {
  const db = await open();
  if (db) await run(db, "readwrite", (s) => s.delete(id));
}
