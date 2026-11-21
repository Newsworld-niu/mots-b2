/**
 * IndexedDB vault (`fb2-vault`) for large user data that would otherwise exhaust
 * localStorage's ~5MB quota: reading texts (`texts`), written essays (`essays`),
 * and alias-migration snapshots. Also provides raw backup/restore helpers for
 * `fb2-exam-bank` and `fb2.essay.draft.*` drafts.
 */
import { MAX_ESSAY_LENGTH, MAX_ESSAYS, sanitizeEssays, type SavedEssay } from "../lib/essay";
import { MAX_TEXTS, sanitizeTexts, type SavedText } from "../lib/reader";
import { sanitizePaper, type Attempt, type BankPaper } from "./exam-bank";
import type { Progress } from "./store";

const DB = "fb2-vault";
const HEAVY = "heavy";
const SNAPSHOTS = "snapshots";

const BANK_DB = "fb2-exam-bank";
const BANK_PAPERS = "papers";
const BANK_ATTEMPTS = "attempts";

export const DRAFT_PREFIX = "fb2.essay.draft.";

export interface HeavyData {
  texts?: SavedText[];
  essays?: SavedEssay[];
}

export interface SnapshotRecord {
  key: string;
  datasetId: string;
  created: number;
  progress: Progress;
}

export interface ExamBankBackup {
  papers: BankPaper[];
  attempts: Record<string, Attempt[]>;
}

export interface PutHeavyOptions {
  clear?: boolean;
  clearTexts?: boolean;
  clearEssays?: boolean;
}

let vaultDb: Promise<IDBDatabase | null> | null = null;
export function openVault(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (!vaultDb) {
    vaultDb = new Promise<IDBDatabase | null>((resolve) => {
      try {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => {
          const d = req.result;
          if (!d.objectStoreNames.contains(HEAVY)) d.createObjectStore(HEAVY);
          if (!d.objectStoreNames.contains(SNAPSHOTS)) d.createObjectStore(SNAPSHOTS, { keyPath: "key" });
        };
        req.onsuccess = () => {
          const d = req.result;
          d.onclose = () => {
            vaultDb = null;
          };
          d.onversionchange = () => {
            d.close();
            vaultDb = null;
          };
          resolve(d);
        };
        req.onerror = () => {
          vaultDb = null;
          resolve(null);
        };
      } catch {
        vaultDb = null;
        resolve(null);
      }
    });
  }
  return vaultDb;
}

export function resetVaultConnection(): void {
  vaultDb = null;
}

function vtx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openVault().then(
    (d) =>
      new Promise((resolve) => {
        if (!d) return resolve(null);
        try {
          const req = fn(d.transaction(store, mode).objectStore(store));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

export async function getHeavy(datasetId: string): Promise<HeavyData | null> {
  const raw = await vtx<unknown>(HEAVY, "readonly", (s) => s.get(datasetId));
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const texts = sanitizeTexts(r.texts);
  const essays = sanitizeEssays(r.essays);
  return { ...(texts ? { texts } : {}), ...(essays ? { essays } : {}) };
}

export async function putHeavy(datasetId: string, data: HeavyData, opts?: PutHeavyOptions): Promise<boolean> {
  const db = await openVault();
  if (!db) return false;
  const hasTexts = Boolean(data.texts?.length);
  const hasEssays = Boolean(data.essays?.length);
  const clearAll = Boolean(opts?.clear);
  const clearTexts = clearAll || Boolean(opts?.clearTexts);
  const clearEssays = clearAll || Boolean(opts?.clearEssays);

  if (!hasTexts && !hasEssays && !clearTexts && !clearEssays) {
    return true;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(HEAVY, "readwrite");
      const store = tx.objectStore(HEAVY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);

      const writeMerged = (prev?: Record<string, unknown> | null) => {
        const nextTexts = hasTexts
          ? data.texts!.slice(0, MAX_TEXTS)
          : clearTexts
            ? undefined
            : prev
              ? sanitizeTexts(prev.texts)
              : undefined;
        const nextEssays = hasEssays
          ? data.essays!.slice(0, MAX_ESSAYS)
          : clearEssays
            ? undefined
            : prev
              ? sanitizeEssays(prev.essays)
              : undefined;
        if (nextTexts?.length || nextEssays?.length) {
          const payload: HeavyData = {};
          if (nextTexts?.length) payload.texts = nextTexts;
          if (nextEssays?.length) payload.essays = nextEssays;
          store.put(payload, datasetId);
        } else {
          store.delete(datasetId);
        }
      };

      if (clearAll || (hasTexts && hasEssays)) {
        writeMerged(null);
      } else {
        const req = store.get(datasetId);
        req.onsuccess = () => {
          const prev = req.result && typeof req.result === "object" ? (req.result as Record<string, unknown>) : null;
          writeMerged(prev);
        };
        req.onerror = () => resolve(false);
      }
    } catch {
      resolve(false);
    }
  });
}

export async function putSnapshotIdb(key: string, progress: Progress): Promise<boolean> {
  const db = await openVault();
  if (!db) return false;
  const rec: SnapshotRecord = { key, datasetId: progress.datasetId, created: Date.now(), progress };
  const ok = await new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(SNAPSHOTS, "readwrite");
      tx.objectStore(SNAPSHOTS).put(rec);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
  if (!ok) return false;
  // Prune to newest 5 snapshots per dataset
  const all = ((await vtx<SnapshotRecord[]>(SNAPSHOTS, "readonly", (s) => s.getAll())) ?? [])
    .filter((r) => r.datasetId === progress.datasetId)
    .sort((a, b) => a.key.localeCompare(b.key));
  for (const old of all.slice(0, Math.max(0, all.length - 5))) {
    await vtx(SNAPSHOTS, "readwrite", (s) => s.delete(old.key));
  }
  return true;
}

export async function listSnapshotsIdb(datasetId: string): Promise<string[]> {
  const all = (await vtx<SnapshotRecord[]>(SNAPSHOTS, "readonly", (s) => s.getAll())) ?? [];
  return all
    .filter((r) => r.datasetId === datasetId)
    .map((r) => r.key)
    .sort();
}

export async function getSnapshotIdb(key: string): Promise<Progress | null> {
  const rec = await vtx<SnapshotRecord>(SNAPSHOTS, "readonly", (s) => s.get(key));
  return rec?.progress ?? null;
}

/** Merge two id-keyed lists (memory + IndexedDB) without losing items on either side. */
export function mergeHeavy<T extends { id: string }>(primary: T[] | undefined, secondary: T[] | undefined, max: number): T[] | undefined {
  const map = new Map<string, T>();
  for (const x of secondary ?? []) map.set(x.id, x);
  for (const x of primary ?? []) map.set(x.id, x);
  const out = [...map.values()].slice(0, max);
  return out.length ? out : undefined;
}

/* ---------- Essay drafts (localStorage fb2.essay.draft.*) ---------- */

export function collectEssayDrafts(storage: Pick<Storage, "length" | "key" | "getItem"> | null = typeof localStorage !== "undefined" ? localStorage : null): Record<string, string> {
  if (!storage) return {};
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (!k || !k.startsWith(DRAFT_PREFIX)) continue;
      const v = storage.getItem(k);
      if (v && v.trim()) out[k] = v.slice(0, MAX_ESSAY_LENGTH);
    }
  } catch {
    /* storage unavailable */
  }
  return out;
}

export function restoreEssayDrafts(
  drafts: unknown,
  storage: Pick<Storage, "length" | "key" | "setItem" | "removeItem"> | null = typeof localStorage !== "undefined" ? localStorage : null,
): void {
  if (!storage || !drafts || typeof drafts !== "object" || Array.isArray(drafts)) return;
  try {
    const oldKeys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(DRAFT_PREFIX)) oldKeys.push(k);
    }
    for (const k of oldKeys) storage.removeItem(k);
    for (const [k, v] of Object.entries(drafts as Record<string, unknown>)) {
      if (typeof k === "string" && k.startsWith(DRAFT_PREFIX) && k.length <= 100 && typeof v === "string" && v.trim()) {
        storage.setItem(k, v.slice(0, MAX_ESSAY_LENGTH));
      }
    }
  } catch {
    /* storage unavailable */
  }
}

/* ---------- Exam bank (IndexedDB fb2-exam-bank) ---------- */

function openBankDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(BANK_DB, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(BANK_PAPERS)) d.createObjectStore(BANK_PAPERS, { keyPath: "id" });
        if (!d.objectStoreNames.contains(BANK_ATTEMPTS)) d.createObjectStore(BANK_ATTEMPTS);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function bankReq<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const req = fn(db.transaction(store, mode).objectStore(store));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function readExamBankBackup(): Promise<ExamBankBackup | null> {
  const db = await openBankDb();
  if (!db) return null;
  try {
    const rawPapers = (await bankReq<unknown[]>(db, BANK_PAPERS, "readonly", (s) => s.getAll())) ?? [];
    const papers = rawPapers.map(sanitizePaper).filter((p): p is BankPaper => !!p);
    const keys = ((await bankReq<IDBValidKey[]>(db, BANK_ATTEMPTS, "readonly", (s) => s.getAllKeys())) ?? []).filter((k): k is string => typeof k === "string");
    const vals = (await bankReq<unknown[]>(db, BANK_ATTEMPTS, "readonly", (s) => s.getAll())) ?? [];
    const attempts: Record<string, Attempt[]> = {};
    keys.forEach((k, i) => {
      if (Array.isArray(vals[i]) && vals[i].length) attempts[k] = vals[i] as Attempt[];
    });
    if (!papers.length && !Object.keys(attempts).length) return null;
    return { papers, attempts };
  } finally {
    db.close();
  }
}

export async function restoreExamBankBackup(raw: unknown): Promise<boolean> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const db = await openBankDb();
  if (!db) return false;
  const r = raw as Record<string, unknown>;
  const papers = Array.isArray(r.papers) ? r.papers.map(sanitizePaper).filter((p): p is BankPaper => !!p) : [];
  const attempts = r.attempts && typeof r.attempts === "object" && !Array.isArray(r.attempts) ? (r.attempts as Record<string, unknown>) : {};
  try {
    return await new Promise<boolean>((resolve) => {
      try {
        const tx = db.transaction([BANK_PAPERS, BANK_ATTEMPTS], "readwrite");
        const ps = tx.objectStore(BANK_PAPERS);
        const as = tx.objectStore(BANK_ATTEMPTS);
        ps.clear();
        as.clear();
        for (const p of papers) ps.put(p);
        for (const [k, v] of Object.entries(attempts)) {
          if (typeof k === "string" && Array.isArray(v)) as.put(v.slice(0, 20), k);
        }
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } finally {
    db.close();
  }
}
