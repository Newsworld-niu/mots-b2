/**
 * Small IndexedDB store for AI answers (word explanations), so a word is explained once and reopened for free.
 * Kept on this device only, not in backups (it can be generated again).
 */
const DB = "word-atlas-ai";
const STORE = "answers";

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

export const cacheGet = <T,>(key: string) => run<T>("readonly", (s) => s.get(key) as IDBRequest<T>);
export const cachePut = (key: string, value: unknown) => run("readwrite", (s) => s.put(value, key));
export const cacheDelete = (key: string) => run("readwrite", (s) => s.delete(key));
