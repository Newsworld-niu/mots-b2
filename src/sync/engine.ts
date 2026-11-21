import { SYNC_API_URL } from "../config";
import { isNative } from "../lib/native";
import { subscribeImages } from "../store/images";
import { exportBackupAsync, importBackupAsync, store } from "../store/store";
import { toast } from "../ui/Toast";
import {
  SyncAuthError,
  SyncConflictError,
  SyncNetworkError,
  deleteAccount,
  getHistoryVersion,
  isSyncConfigured,
  listHistory,
  pullSync,
  pushSync,
  registerInvite,
  type PullResult,
  type SyncHistoryItem,
} from "./api";
import {
  canonicalHash,
  decidePull,
  hasBackupProgress,
  summarizeBackup,
  type PullDecision,
  type RemotePull,
} from "./decide";
import { getSyncState, resetSyncState, saveLocalSafetyCopy, setSyncState } from "./state";

const SYNC_CODE_RE = /^mb2_[A-Za-z0-9_-]{20,}$/;

let apiBaseUrl = SYNC_API_URL;
let queue: Promise<void> = Promise.resolve();
let busyDepth = 0;
let activeSyncNow: Promise<PullDecision | null> | null = null;
let applying = false;
let applyingUntil = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastPullAt = 0;
let started = false;

export function setSyncBaseUrlForTest(url: string): void {
  apiBaseUrl = url;
}

function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const prev = queue;
  let release!: () => void;
  queue = new Promise<void>((resolve) => {
    release = resolve;
  });
  return prev.then(async () => {
    busyDepth++;
    if (busyDepth === 1) setSyncState({ busy: true });
    try {
      return await fn();
    } finally {
      busyDepth--;
      if (busyDepth === 0) setSyncState({ busy: false });
      release();
    }
  });
}

function mapSyncError(err: unknown): { message: string; isNetwork: boolean } {
  if (err instanceof SyncAuthError) return { message: "同步码无效，请重新配对", isNetwork: false };
  if (err instanceof SyncNetworkError) return { message: "网络不可用，稍后自动重试", isNetwork: true };
  if (err instanceof Error) return { message: err.message || "同步失败", isNetwork: false };
  return { message: "同步失败", isNetwork: false };
}

function notifyToast(text: string, tone: "info" | "ok" | "warn" = "info"): void {
  if (typeof window !== "undefined") toast(text, tone);
}

function setConflictState(localJson: string, remoteJson: string, remoteEtag: string): void {
  setSyncState({
    conflict: {
      localJson,
      remoteJson,
      remoteEtag,
      localSummary: summarizeBackup(localJson),
      remoteSummary: summarizeBackup(remoteJson),
    },
    lastError: null,
  });
  notifyToast("云端与本机数据存在冲突，请选择保留哪一份", "warn");
}

async function applyRemoteBackup(
  remoteJson: string,
  etag: string,
  opts?: { skipStateUpdate?: boolean },
): Promise<{ afterJson: string; afterHash: string }> {
  const localBefore = await exportBackupAsync();
  saveLocalSafetyCopy(localBefore);

  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  applying = true;
  try {
    const res = await importBackupAsync(remoteJson);
    if (!res.ok) throw new Error(res.error);
  } finally {
    applying = false;
    applyingUntil = Date.now() + 1000;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  const afterJson = await exportBackupAsync();
  const afterHash = await canonicalHash(afterJson);
  if (!opts?.skipStateUpdate) {
    setSyncState({
      baseEtag: etag,
      lastSyncedHash: afterHash,
      lastOkAt: Date.now(),
      lastError: null,
      conflict: null,
    });
  }
  return { afterJson, afterHash };
}

async function pullAndReconcile(
  code: string,
  datasetId: string,
  prefetched?: PullResult,
  forceFresh = false,
): Promise<PullDecision> {
  const s = getSyncState();
  const localJson = await exportBackupAsync();
  const localHash = await canonicalHash(localJson);
  const localHasProgress = hasBackupProgress(localJson);

  lastPullAt = Date.now();
  const pullRes =
    prefetched ??
    (await pullSync(code, datasetId, !forceFresh && s.baseEtag && s.lastSyncedHash ? s.baseEtag : null, apiBaseUrl));

  let remote: RemotePull;
  if (pullRes.status === "missing") remote = null;
  else if (pullRes.status === "not-modified") remote = "not-modified";
  else remote = { hash: await canonicalHash(pullRes.body) };

  const decision = decidePull({
    localHash,
    lastSyncedHash: s.lastSyncedHash,
    localHasProgress,
    remote,
  });

  if (decision === "noop") {
    if (pullRes.status === "ok") {
      setSyncState({
        baseEtag: pullRes.etag,
        lastSyncedHash: localHash,
        lastOkAt: Date.now(),
        lastError: null,
        conflict: null,
      });
    } else {
      setSyncState({
        lastOkAt: Date.now(),
        lastError: null,
      });
    }
    return "noop";
  }

  if (decision === "apply-remote") {
    if (pullRes.status !== "ok") return "noop";
    await applyRemoteBackup(pullRes.body, pullRes.etag);
    return "apply-remote";
  }

  if (decision === "push-create" || decision === "push") {
    const cond: { ifMatch: string } | { ifNoneMatchStar: true } =
      decision === "push-create"
        ? { ifNoneMatchStar: true }
        : { ifMatch: pullRes.status === "ok" ? pullRes.etag : (s.baseEtag ?? "") };
    try {
      const { etag } = await pushSync(code, datasetId, localJson, cond, apiBaseUrl);
      setSyncState({
        baseEtag: etag,
        lastSyncedHash: localHash,
        lastOkAt: Date.now(),
        lastError: null,
        conflict: null,
      });
      return decision;
    } catch (err) {
      if (err instanceof SyncConflictError && !forceFresh) {
        return await pullAndReconcile(code, datasetId, undefined, true);
      }
      throw err;
    }
  }

  if (pullRes.status === "ok") {
    setConflictState(localJson, pullRes.body, pullRes.etag);
  }
  return "conflict";
}

export async function syncNow(): Promise<PullDecision | null> {
  if (!isSyncConfigured(apiBaseUrl)) return null;
  const pre = getSyncState();
  if (!pre.code || pre.conflict) return null;
  if (activeSyncNow) return activeSyncNow;

  const task = runExclusive(async () => {
    const s = getSyncState();
    if (!s.code || s.conflict) return null;
    const datasetId = store.get().progress.datasetId;
    try {
      return await pullAndReconcile(s.code, datasetId);
    } catch (err) {
      const { message } = mapSyncError(err);
      setSyncState({ lastError: message });
      return null;
    } finally {
      if (activeSyncNow === task) activeSyncNow = null;
    }
  });
  activeSyncNow = task;
  return task;
}

export async function pushIfChanged(): Promise<void> {
  if (!isSyncConfigured(apiBaseUrl)) return;
  const pre = getSyncState();
  if (!pre.code || pre.conflict) return;

  return runExclusive(async () => {
    const s = getSyncState();
    if (!s.code || s.conflict) return;
    const datasetId = store.get().progress.datasetId;
    try {
      const localJson = await exportBackupAsync();
      const localHash = await canonicalHash(localJson);
      if (s.lastSyncedHash !== null && localHash === s.lastSyncedHash) return;
      const localHasProgress = hasBackupProgress(localJson);
      if (s.lastSyncedHash === null && !localHasProgress) return;

      if (!s.baseEtag) {
        await pullAndReconcile(s.code, datasetId);
        return;
      }

      try {
        const { etag } = await pushSync(s.code, datasetId, localJson, { ifMatch: s.baseEtag }, apiBaseUrl);
        setSyncState({
          baseEtag: etag,
          lastSyncedHash: localHash,
          lastOkAt: Date.now(),
          lastError: null,
        });
      } catch (err) {
        if (err instanceof SyncConflictError) {
          await pullAndReconcile(s.code, datasetId, undefined, true);
          return;
        }
        throw err;
      }
    } catch (err) {
      const { message } = mapSyncError(err);
      setSyncState({ lastError: message });
    }
  });
}

export async function resolveConflict(choice: "remote" | "local"): Promise<boolean> {
  const pre = getSyncState();
  if (!pre.code || !pre.conflict) return false;
  return runExclusive(async () => {
    const s = getSyncState();
    if (!s.code || !s.conflict) return false;
    const datasetId = store.get().progress.datasetId;
    const conflict = s.conflict;
    try {
      if (choice === "remote") {
        await applyRemoteBackup(conflict.remoteJson, conflict.remoteEtag);
        notifyToast("已采用云端数据恢复本机", "ok");
        return true;
      }
      const localJson = await exportBackupAsync();
      const localHash = await canonicalHash(localJson);
      try {
        const { etag } = await pushSync(
          s.code,
          datasetId,
          localJson,
          conflict.remoteEtag ? { ifMatch: conflict.remoteEtag } : { ifNoneMatchStar: true },
          apiBaseUrl,
        );
        setSyncState({
          baseEtag: etag,
          lastSyncedHash: localHash,
          lastOkAt: Date.now(),
          lastError: null,
          conflict: null,
        });
        notifyToast("已用本机数据覆盖云端", "ok");
        return true;
      } catch (err) {
        if (err instanceof SyncConflictError) {
          await pullAndReconcile(s.code, datasetId, undefined, true);
          return false;
        }
        throw err;
      }
    } catch (err) {
      const { message } = mapSyncError(err);
      setSyncState({ lastError: message });
      notifyToast(message, "warn");
      return false;
    }
  });
}

export async function getSyncHistory(): Promise<SyncHistoryItem[]> {
  const s = getSyncState();
  if (!s.code) return [];
  try {
    const datasetId = store.get().progress.datasetId;
    return await listHistory(s.code, datasetId, apiBaseUrl);
  } catch (err) {
    const { message } = mapSyncError(err);
    setSyncState({ lastError: message });
    throw err instanceof Error ? err : new Error(message);
  }
}

export async function restoreHistoryVersion(id: string): Promise<boolean> {
  const pre = getSyncState();
  if (!pre.code) return false;
  return runExclusive(async () => {
    const s = getSyncState();
    if (!s.code) return false;
    const datasetId = store.get().progress.datasetId;
    try {
      const histJson = await getHistoryVersion(s.code, datasetId, id, apiBaseUrl);
      const latest = await pullSync(s.code, datasetId, null, apiBaseUrl);
      const { afterJson, afterHash } = await applyRemoteBackup(
        histJson,
        latest.status === "ok" ? latest.etag : "",
        { skipStateUpdate: true },
      );
      const cond: { ifMatch: string } | { ifNoneMatchStar: true } =
        latest.status === "ok" ? { ifMatch: latest.etag } : { ifNoneMatchStar: true };
      const { etag } = await pushSync(s.code, datasetId, afterJson, cond, apiBaseUrl);
      setSyncState({
        baseEtag: etag,
        lastSyncedHash: afterHash,
        lastOkAt: Date.now(),
        lastError: null,
        conflict: null,
      });
      return true;
    } catch (err) {
      const { message } = mapSyncError(err);
      setSyncState({ lastError: message });
      throw err instanceof Error ? err : new Error(message);
    }
  });
}

export async function registerWithInvite(inviteCode: string): Promise<string> {
  const trimmed = inviteCode.trim();
  if (!trimmed) throw new Error("请输入邀请码");
  return runExclusive(async () => {
    const { syncCode } = await registerInvite(trimmed, apiBaseUrl);
    setSyncState({
      code: syncCode,
      baseEtag: null,
      lastSyncedHash: null,
      lastOkAt: null,
      lastError: null,
      conflict: null,
    });
    const datasetId = store.get().progress.datasetId;
    try {
      await pullAndReconcile(syncCode, datasetId);
    } catch (err) {
      const { message } = mapSyncError(err);
      setSyncState({ lastError: message });
    }
    return syncCode;
  });
}

export async function pairWithCode(code: string): Promise<PullDecision> {
  const trimmed = code.trim();
  if (!trimmed) throw new Error("请输入同步码");
  if (!SYNC_CODE_RE.test(trimmed)) throw new Error("同步码格式不正确（应以 mb2_ 开头）");
  return runExclusive(async () => {
    const datasetId = store.get().progress.datasetId;
    const prefetched = await pullSync(trimmed, datasetId, null, apiBaseUrl);
    setSyncState({
      code: trimmed,
      baseEtag: null,
      lastSyncedHash: null,
      lastOkAt: null,
      lastError: null,
      conflict: null,
    });
    try {
      return await pullAndReconcile(trimmed, datasetId, prefetched);
    } catch (err) {
      const { message } = mapSyncError(err);
      setSyncState({ lastError: message });
      throw err instanceof Error ? err : new Error(message);
    }
  });
}

export function unpairLocal(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  resetSyncState();
}

export async function wipeCloudAccount(): Promise<void> {
  const pre = getSyncState();
  if (!pre.code) return;
  return runExclusive(async () => {
    const s = getSyncState();
    if (!s.code) return;
    try {
      await deleteAccount(s.code, apiBaseUrl);
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      resetSyncState();
    } catch (err) {
      const { message } = mapSyncError(err);
      setSyncState({ lastError: message });
      throw err instanceof Error ? err : new Error(message);
    }
  });
}

export function startSync(): void {
  if (started) return;
  started = true;
  if (!isSyncConfigured(apiBaseUrl)) return;

  const scheduleDebouncedPush = () => {
    if (applying || Date.now() < applyingUntil) return;
    const s = getSyncState();
    if (!s.code || s.conflict) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void pushIfChanged();
    }, 30_000);
  };

  const flushHiddenPush = () => {
    if (applying || Date.now() < applyingUntil) return;
    const s = getSyncState();
    if (!s.code || s.conflict) return;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    void pushIfChanged();
  };

  store.subscribe(scheduleDebouncedPush);
  subscribeImages(scheduleDebouncedPush);

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        flushHiddenPush();
      } else if (document.visibilityState === "visible") {
        if (Date.now() - lastPullAt >= 60_000) {
          void syncNow();
        }
      }
    });
  }

  if (isNative()) {
    void import("@capacitor/app").then(({ App }) =>
      App.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) {
          flushHiddenPush();
        } else if (Date.now() - lastPullAt >= 60_000) {
          void syncNow();
        }
      }),
    );
  }

  setInterval(() => {
    if (typeof document === "undefined" || document.visibilityState === "visible") {
      void pushIfChanged();
    }
  }, 5 * 60_000);

  if (getSyncState().code) {
    void syncNow();
  }
}
