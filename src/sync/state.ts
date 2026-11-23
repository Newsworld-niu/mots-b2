import { useSyncExternalStore } from "react";
import { clearSafetyCopyIdb, getSafetyCopyIdb, putSafetyCopyIdb } from "../store/vault";

export const SYNC_STORAGE_KEY = "fb2.sync";
export const LAST_LOCAL_KEY = "fb2.sync.lastLocal";

export interface BackupSummary {
  exported: string | null;
  cards: number;
  essays: number;
  texts: number;
  lastDay: string | null;
}

export interface SyncConflict {
  localJson: string;
  remoteJson: string;
  remoteEtag: string;
  localSummary: BackupSummary;
  remoteSummary: BackupSummary;
}

export interface PersistedSyncState {
  code: string | null;
  authVersion?: 1 | 2;
  baseEtag: string | null;
  lastSyncedHash: string | null;
  lastOkAt: number | null;
  lastError: string | null;
}

export interface SyncState extends PersistedSyncState {
  busy: boolean;
  conflict: SyncConflict | null;
}

export const defaultPersistedSyncState = (): PersistedSyncState => ({
  code: null,
  baseEtag: null,
  lastSyncedHash: null,
  lastOkAt: null,
  lastError: null,
});

function sanitizePersisted(raw: unknown): PersistedSyncState {
  const base = defaultPersistedSyncState();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  if (typeof o.code === "string" && o.code.trim()) {
    base.code = o.code.trim();
    base.authVersion = o.authVersion === 2 ? 2 : 1;
  }
  if (typeof o.baseEtag === "string" && o.baseEtag) base.baseEtag = o.baseEtag;
  if (typeof o.lastSyncedHash === "string" && o.lastSyncedHash) base.lastSyncedHash = o.lastSyncedHash;
  if (typeof o.lastOkAt === "number" && Number.isFinite(o.lastOkAt) && o.lastOkAt >= 0) base.lastOkAt = o.lastOkAt;
  if (typeof o.lastError === "string" && o.lastError) base.lastError = o.lastError;
  return base;
}

function readPersisted(): PersistedSyncState {
  if (typeof localStorage === "undefined") return defaultPersistedSyncState();
  try {
    const raw = localStorage.getItem(SYNC_STORAGE_KEY);
    return raw ? sanitizePersisted(JSON.parse(raw)) : defaultPersistedSyncState();
  } catch {
    return defaultPersistedSyncState();
  }
}

function writePersisted(s: PersistedSyncState): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (!s.code && !s.baseEtag && !s.lastSyncedHash && s.lastOkAt === null && !s.lastError) {
      localStorage.removeItem(SYNC_STORAGE_KEY);
      return;
    }
    const payload: PersistedSyncState = {
      code: s.code,
      ...(s.code ? { authVersion: s.authVersion === 2 ? 2 : 1 } : {}),
      baseEtag: s.baseEtag,
      lastSyncedHash: s.lastSyncedHash,
      lastOkAt: s.lastOkAt,
      lastError: s.lastError,
    };
    localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota or private mode storage errors */
  }
}

let state: SyncState = {
  ...readPersisted(),
  busy: false,
  conflict: null,
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export function getSyncState(): SyncState {
  return state;
}

export function setSyncState(patch: Partial<SyncState> | ((prev: SyncState) => SyncState)): SyncState {
  const prev = state;
  const nextRaw = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
  const persisted = sanitizePersisted(nextRaw);
  const next: SyncState = {
    ...persisted,
    busy: Boolean(nextRaw.busy),
    conflict: nextRaw.conflict ?? null,
  };
  const persistedChanged =
    prev.code !== next.code ||
    prev.authVersion !== next.authVersion ||
    prev.baseEtag !== next.baseEtag ||
    prev.lastSyncedHash !== next.lastSyncedHash ||
    prev.lastOkAt !== next.lastOkAt ||
    prev.lastError !== next.lastError;
  state = next;
  if (persistedChanged) writePersisted(persisted);
  emit();
  return state;
}

let safetyCopyCache: string | null = null;

export function resetSyncState(): SyncState {
  safetyCopyCache = null;
  void clearSafetyCopyIdb();
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(LAST_LOCAL_KEY);
    } catch {
      /* ignore */
    }
  }
  state = {
    ...defaultPersistedSyncState(),
    busy: false,
    conflict: null,
  };
  writePersisted(state);
  emit();
  return state;
}

export function reloadSyncState(): SyncState {
  state = {
    ...readPersisted(),
    busy: false,
    conflict: null,
  };
  emit();
  return state;
}

export function subscribeSyncState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribeSyncState, getSyncState, getSyncState);
}

function takeLegacySafetyCopy(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_LOCAL_KEY);
    if (raw && raw.trim()) {
      localStorage.removeItem(LAST_LOCAL_KEY);
      return raw;
    }
  } catch {
    /* ignore storage errors */
  }
  return null;
}

export function saveLocalSafetyCopy(json: string): void {
  safetyCopyCache = json;
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(LAST_LOCAL_KEY);
    } catch {
      /* ignore */
    }
  }
  void putSafetyCopyIdb(json);
}

export function getLocalSafetyCopy(): string | null {
  if (safetyCopyCache) return safetyCopyCache;
  const legacy = takeLegacySafetyCopy();
  if (legacy) {
    safetyCopyCache = legacy;
    void putSafetyCopyIdb(legacy);
    return legacy;
  }
  return null;
}

export async function loadLocalSafetyCopy(): Promise<string | null> {
  const fromIdb = await getSafetyCopyIdb();
  if (fromIdb && fromIdb.trim()) {
    safetyCopyCache = fromIdb;
    return fromIdb;
  }
  const legacy = takeLegacySafetyCopy();
  if (legacy) {
    safetyCopyCache = legacy;
    await putSafetyCopyIdb(legacy);
    return legacy;
  }
  return safetyCopyCache;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== SYNC_STORAGE_KEY) return;
    const persisted = e.newValue ? (() => {
      try {
        return sanitizePersisted(JSON.parse(e.newValue));
      } catch {
        return defaultPersistedSyncState();
      }
    })() : defaultPersistedSyncState();
    state = {
      ...persisted,
      busy: state.busy,
      conflict: persisted.code === state.code ? state.conflict : null,
    };
    emit();
  });
}
