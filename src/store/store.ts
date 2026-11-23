import { useRef, useSyncExternalStore } from "react";
import { migrateAliases as migrateAliasesPure, type AliasMap } from "./aliases";
import { createBackupActions } from "./backup";
import { sanitizeProgress, sanitizeSettings } from "./sanitize";
import {
  SETTINGS_KEY,
  compactProgressForLocalStorage,
  emptyProgress,
  markTombstone,
  clearTombstone,
  progressKey,
  syncFavorites,
  type Progress,
  type Settings,
  type State,
} from "./types";
import {
  getHeavy,
  getSnapshotIdb,
  listSnapshotsIdb,
  mergeHeavy,
  putHeavy,
  putSnapshotIdb,
  type PutHeavyOptions,
} from "./vault";

export * from "./types";
export * from "./sanitize";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

let state: State = {
  progress: emptyProgress("word-atlas-open"),
  settings: sanitizeSettings(read(SETTINGS_KEY)),
  saveError: false,
};
const listeners = new Set<() => void>();
let saveTimer: number | undefined;
let maxSaveTimer: number | undefined;
let idleHandle: number | undefined;
/** Domain dirty flags: idle/settings-only updates never re-serialize full progress. */
let progressDirty = false;
let settingsDirty = false;
let heavyDirty = false;
/** Progress is written only after it has been read from storage for this dataset. */
let loadedId: string | null = null;
/** Datasets whose heavy fields (texts, essays) have been synced to IndexedDB fb2-vault. */
const vaultSynced = new Set<string>();
const vaultHydrating = new Map<string, Promise<void>>();
const vaultWriting = new Map<string, Promise<boolean>>();
const pendingClearAll = new Set<string>();
const pendingClearTexts = new Set<string>();
const pendingClearEssays = new Set<string>();
let storageSaveError = false;
let vaultSaveError = false;

const isDirty = () => progressDirty || settingsDirty || heavyDirty;

function markDirty(kind: "progress" | "settings" | "all" = "all") {
  if (kind === "settings") {
    settingsDirty = true;
    return;
  }
  if (kind === "progress") {
    progressDirty = true;
    return;
  }
  progressDirty = true;
  settingsDirty = true;
  heavyDirty = true;
}

function syncSaveError() {
  const next = storageSaveError || vaultSaveError;
  if (next !== state.saveError) {
    state = { ...state, saveError: next };
    emit();
  }
}

function queueHeavySave(p: Progress, opts?: PutHeavyOptions): Promise<boolean> {
  const prev = vaultWriting.get(p.datasetId) ?? Promise.resolve(true);
  const op = prev
    .catch(() => true)
    .then(() => putHeavy(p.datasetId, { texts: p.texts, essays: p.essays }, opts))
    .then((ok) => {
      if (ok) {
        vaultSynced.add(p.datasetId);
        vaultSaveError = false;
      } else {
        vaultSaveError = true;
      }
      syncSaveError();
      return ok;
    });
  vaultWriting.set(p.datasetId, op);
  return op;
}

async function hydrateVaultForDataset(datasetId: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const existing = vaultHydrating.get(datasetId);
  if (existing) return existing;
  const task = (async () => {
    try {
      for (const key of listSnapshots(datasetId)) {
        const snap = read<Progress>(key);
        if (snap && (await putSnapshotIdb(key, sanitizeProgress(snap, datasetId)))) {
          try {
            localStorage.removeItem(key);
          } catch {
            /* ignore */
          }
        }
      }
      const idb = await getHeavy(datasetId);
      const cur = state.progress.datasetId === datasetId ? state.progress : null;
      if (!cur) return;
      const texts = mergeHeavy(cur.texts, idb?.texts, 60);
      const essays = mergeHeavy(cur.essays, idb?.essays, 40);
      const ok = await queueHeavySave({ ...cur, texts, essays });
      if (!ok) return;
      if (state.progress.datasetId === datasetId) {
        const changed = (texts?.length ?? 0) !== (state.progress.texts?.length ?? 0) || (essays?.length ?? 0) !== (state.progress.essays?.length ?? 0);
        if (changed) {
          state = {
            ...state,
            progress: {
              ...state.progress,
              ...(texts ? { texts } : {}),
              ...(essays ? { essays } : {}),
            },
          };
          emit();
        }
        write(progressKey(datasetId), compactProgressForLocalStorage(state.progress));
      }
    } finally {
      vaultHydrating.delete(datasetId);
    }
  })();
  vaultHydrating.set(datasetId, task);
  return task;
}

function emit() {
  listeners.forEach((l) => l());
}

function cancelScheduledSave() {
  if (typeof window === "undefined") return;
  if (saveTimer !== undefined) {
    window.clearTimeout(saveTimer);
    saveTimer = undefined;
  }
  if (maxSaveTimer !== undefined) {
    window.clearTimeout(maxSaveTimer);
    maxSaveTimer = undefined;
  }
  if (idleHandle !== undefined) {
    const cancelIdle = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
    cancelIdle?.(idleHandle);
    idleHandle = undefined;
  }
}

function scheduleIdleFlush() {
  if (typeof window === "undefined") return;
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
  if (typeof ric === "function") {
    idleHandle = ric(() => {
      idleHandle = undefined;
      flush();
    }, { timeout: 100 });
  } else {
    flush();
  }
}

function scheduleSave(kind: "progress" | "settings") {
  if (kind === "settings") settingsDirty = true;
  else progressDirty = true;
  if (typeof window !== "undefined") {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = undefined;
      scheduleIdleFlush();
    }, 250);
    if (maxSaveTimer === undefined) {
      maxSaveTimer = window.setTimeout(() => {
        maxSaveTimer = undefined;
        flush();
      }, 1200);
    }
  }
}

export function flush(opts?: { skipHeavy?: boolean }) {
  cancelScheduledSave();
  if (!isDirty()) return;
  const writeProgress = progressDirty || heavyDirty;
  const writeSettings = settingsDirty;
  const writeHeavy = heavyDirty;
  progressDirty = false;
  settingsDirty = false;
  heavyDirty = false;

  let progressOk = true;
  if (writeProgress && loadedId === state.progress.datasetId) {
    const p = state.progress;
    const clearAll = pendingClearAll.delete(p.datasetId);
    const clearTexts = pendingClearTexts.delete(p.datasetId);
    const clearEssays = pendingClearEssays.delete(p.datasetId);
    const shouldWriteHeavy =
      !opts?.skipHeavy &&
      (writeHeavy || vaultSaveError || !vaultSynced.has(p.datasetId) || clearAll || clearTexts || clearEssays);
    if (typeof indexedDB !== "undefined") {
      if (vaultSynced.has(p.datasetId) || clearAll || clearTexts || clearEssays) {
        if (shouldWriteHeavy) void queueHeavySave(p, { clear: clearAll, clearTexts, clearEssays });
        progressOk = write(progressKey(p.datasetId), compactProgressForLocalStorage(p));
      } else {
        progressOk = write(progressKey(p.datasetId), p);
        if (!progressOk) {
          if (!opts?.skipHeavy) void queueHeavySave(p);
          progressOk = write(progressKey(p.datasetId), compactProgressForLocalStorage(p));
        }
      }
    } else {
      progressOk = write(progressKey(p.datasetId), p);
    }
  }
  const settingsOk = writeSettings ? write(SETTINGS_KEY, state.settings) : true;
  storageSaveError = !(progressOk && settingsOk);
  syncSaveError();
}

export function handleStorageEvent(e: { key: string | null; newValue: string | null }): void {
  if (!e.newValue) return;
  try {
    if (e.key === SETTINGS_KEY) {
      state = { ...state, settings: sanitizeSettings(JSON.parse(e.newValue)) };
    } else if (e.key === progressKey(state.progress.datasetId)) {
      const prev = state.progress;
      const incoming = sanitizeProgress(JSON.parse(e.newValue), prev.datasetId);
      const texts = incoming.texts?.length ? mergeHeavy(incoming.texts, prev.texts, 60) : prev.texts;
      const essays = incoming.essays?.length ? mergeHeavy(incoming.essays, prev.essays, 40) : prev.essays;
      state = {
        ...state,
        progress: syncFavorites({
          ...incoming,
          ...(texts?.length ? { texts } : {}),
          ...(essays?.length ? { essays } : {}),
        }),
      };
      emit();
      if (typeof indexedDB !== "undefined") void hydrateVaultForDataset(prev.datasetId);
      return;
    } else {
      return;
    }
    emit();
  } catch {
    /* ignore malformed writes */
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => flush());
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
  }
  window.addEventListener("storage", handleStorageEvent);
}

/* ---------- alias migration with snapshots ---------- */

export const listSnapshots = (datasetId: string) =>
  typeof localStorage === "undefined"
    ? []
    : Object.keys(localStorage)
        .filter((k) => k.startsWith(`word-atlas:snapshot:${datasetId}:`))
        .sort();

export async function listSnapshotsAsync(datasetId: string): Promise<string[]> {
  const idb = await listSnapshotsIdb(datasetId);
  return [...new Set([...listSnapshots(datasetId), ...idb])].sort();
}

/** Keep the five newest snapshots; write to IndexedDB when available to spare localStorage quota. */
function writeSnapshot(p: Progress): string {
  const key = `word-atlas:snapshot:${p.datasetId}:${Date.now()}`;
  if (typeof indexedDB !== "undefined") {
    void putSnapshotIdb(key, p);
    return key;
  }
  write(key, p);
  const keys = listSnapshots(p.datasetId);
  for (const k of keys.slice(0, Math.max(0, keys.length - 5))) localStorage.removeItem(k);
  return key;
}

export const store = {
  get: () => state,
  /** Move alias records onto their primary ids. Saves a snapshot first; changes nothing when already migrated. */
  migrateAliases(aliases: AliasMap) {
    const { progress, report } = migrateAliasesPure(state.progress, aliases);
    if (!report.changed) return { ...report, snapshot: null as string | null };
    const snapshot = writeSnapshot(state.progress);
    state = { ...state, progress: syncFavorites(progress) };
    markDirty("all");
    emit();
    flush();
    return { ...report, snapshot };
  },
  /** Replace the current progress with a snapshot taken earlier (keeps everything else). */
  restoreSnapshot(key: string): boolean {
    const raw = read<Progress>(key);
    if (!raw) return false;
    const restored = sanitizeProgress(raw, state.progress.datasetId);
    state = { ...state, progress: restored };
    markDirty("all");
    emit();
    flush();
    return true;
  },
  async restoreSnapshotAsync(key: string): Promise<boolean> {
    const raw = (await getSnapshotIdb(key)) ?? read<Progress>(key);
    if (!raw) return false;
    const restored = sanitizeProgress(raw, state.progress.datasetId);
    state = { ...state, progress: restored };
    markDirty("all");
    emit();
    flush();
    return true;
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  useDataset(datasetId: string) {
    flush();
    state = { ...state, progress: sanitizeProgress(read(progressKey(datasetId)), datasetId) };
    loadedId = datasetId;
    emit();
    void hydrateVaultForDataset(datasetId);
  },
  progress(fn: (p: Progress) => Progress) {
    const prev = state.progress;
    const next = syncFavorites(fn(prev));
    if (prev.texts !== next.texts || prev.essays !== next.essays) heavyDirty = true;
    if (prev.texts?.length && !next.texts?.length) {
      pendingClearTexts.add(next.datasetId);
      heavyDirty = true;
    }
    if (next.texts?.length) pendingClearTexts.delete(next.datasetId);
    if (prev.essays?.length && !next.essays?.length) {
      pendingClearEssays.add(next.datasetId);
      heavyDirty = true;
    }
    if (next.essays?.length) pendingClearEssays.delete(next.datasetId);
    state = { ...state, progress: next };
    emit();
    scheduleSave("progress");
  },
  settings(patch: Partial<Settings>) {
    state = { ...state, settings: { ...state.settings, ...patch } };
    emit();
    scheduleSave("settings");
  },
};

export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
    return true;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    const k = keysA[i];
    if (!Object.prototype.hasOwnProperty.call(b, k) || !Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) {
      return false;
    }
  }
  return true;
}

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(state), () => select(state));
}

/**
 * Subscribe to a derived slice object/tuple without re-rendering when unselected store branches change.
 * Caches the previous snapshot in a ref so React 19 useSyncExternalStore receives a referentially stable value.
 */
export function useStoreShallow<T>(select: (s: State) => T): T {
  const cacheRef = useRef<{ has: boolean; val: T }>({ has: false, val: undefined as T });
  const getSnapshot = () => {
    const next = select(state);
    if (cacheRef.current.has && shallowEqual(cacheRef.current.val, next)) {
      return cacheRef.current.val;
    }
    cacheRef.current = { has: true, val: next };
    return next;
  };
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

export function toggleBookmark(id: string) {
  store.progress((p) => {
    const removing = p.bookmarks.includes(id);
    const next: Progress = {
      ...p,
      bookmarks: removing ? p.bookmarks.filter((x) => x !== id) : [id, ...p.bookmarks],
    };
    return removing ? markTombstone(next, `bookmark:${id}`) : clearTombstone(next, `bookmark:${id}`);
  });
}

/* ---------- backup & reset ---------- */

const backupActions = createBackupActions({
  getState: () => state,
  setState: (next) => {
    state = next;
  },
  updateSettings: (patch) => store.settings(patch),
  flush,
  emit,
  markDirty,
  hydrateVault: hydrateVaultForDataset,
  waitHeavyWrite: (id) => vaultWriting.get(id),
  queueHeavySave,
});

export const markBackupExported = backupActions.markBackupExported;
export const exportBackup = backupActions.exportBackup;
export const exportBackupAsync = backupActions.exportBackupAsync;
export const importBackup = backupActions.importBackup;
export const importBackupAsync = backupActions.importBackupAsync;

export function resetProgress() {
  const id = state.progress.datasetId;
  state = { ...state, progress: emptyProgress(id) };
  pendingClearAll.add(id);
  if (typeof indexedDB !== "undefined") void queueHeavySave(state.progress, { clear: true });
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem("fb2.mock.v1");
      localStorage.removeItem("fb2.mock.last.v1");
    } catch {
      /* ignore quota or private mode storage errors */
    }
  }
  emit();
  markDirty("all");
  flush({ skipHeavy: true });
}
