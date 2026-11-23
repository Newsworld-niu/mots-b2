/**
 * Small IndexedDB store for AI answers (word explanations), so a word is explained once and reopened for free.
 * Kept on this device only, not in backups (it can be generated again).
 */
import { createIdb } from "../lib/idb";

const DB = "word-atlas-ai";
const STORE = "answers";

const cacheIdb = createIdb(DB, 1, (d) => {
  if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
});

const run = <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) =>
  cacheIdb.tx(STORE, mode, fn);

export const cacheGet = <T,>(key: string) => run<T>("readonly", (s) => s.get(key) as IDBRequest<T>);
export const cachePut = (key: string, value: unknown) => run("readwrite", (s) => s.put(value, key));
export const cacheDelete = (key: string) => run("readwrite", (s) => s.delete(key));
