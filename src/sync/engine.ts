import { SYNC_API_URL } from "../config";
import { subscribeExamBankChanges } from "../store/exam-bank";
import { subscribeImages } from "../store/images";
import { exportBackupAsync, importBackupAsync, store } from "../store/store";
import { toast } from "../ui/Toast";
import {
  SyncApiError,
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
  upgradeSyncAuth,
  type PullResult,
  type SyncHistoryItem,
} from "./api";
import { decryptSyncPayload, deriveSyncAuthToken, encryptSyncPayload, generateSyncCode } from "./crypto";
import {
  canonicalHash,
  decidePull,
  hasBackupProgress,
  summarizeBackup,
  type PullDecision,
  type RemotePull,
} from "./decide";
import { mergeBackups } from "./merge";
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
let upgradeUnsupportedForBase: string | null = null;

export function setSyncBaseUrlForTest(url: string): void {
  apiBaseUrl = url;
  upgradeUnsupportedForBase = null;
}

/**
 * Resolve the bearer token sent to the sync server:
 * - v2 accounts always send HKDF(`mb2a_...`) derived locally so raw `syncCode` never leaves the device.
 * - Legacy v1 accounts silently upgrade via `POST /api/auth/upgrade` on first sync, falling back to `code`
 *   only when the target server does not yet implement v2 upgrade.
 */
async function resolveBearer(code: string): Promise<string> {
  const s = getSyncState();
  const derived = await deriveSyncAuthToken(code);
  if (s.authVersion === 2) return derived;
  if (upgradeUnsupportedForBase === apiBaseUrl) return code;
  try {
    const ok = await upgradeSyncAuth(code, derived, apiBaseUrl);
    if (ok) {
      setSyncState({ authVersion: 2 });
      return derived;
    }
    upgradeUnsupportedForBase = apiBaseUrl;
    return code;
  } catch (err) {
    if (err instanceof SyncAuthError || err instanceof SyncNetworkError) throw err;
    return code;
  }
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

async function pushEncrypted(
  code: string,
  datasetId: string,
  plaintextJson: string,
  cond: { ifMatch: string } | { ifNoneMatchStar: true },
  bearer?: string,
): Promise<{ etag: string }> {
  const token = bearer ?? (await resolveBearer(code));
  const wireBody = await encryptSyncPayload(plaintextJson, code, datasetId);
  return await pushSync(token, datasetId, wireBody, cond, apiBaseUrl);
}

async function applyRemoteAndPushMerge(
  code: string,
  datasetId: string,
  localJson: string,
  remotePlain: string,
  remoteEtag: string,
  cond: { ifMatch: string } | { ifNoneMatchStar: true },
  bearer?: string,
): Promise<{ ok: true; etag: string; mergedHash: string } | { ok: false }> {
  const merged = mergeBackups(localJson, remotePlain);
  if (!merged.ok) return { ok: false };
  const { afterJson, afterHash } = await applyRemoteBackup(merged.json, remoteEtag, { skipStateUpdate: true });
  const { etag } = await pushEncrypted(code, datasetId, afterJson, cond, bearer);
  setSyncState({
    baseEtag: etag,
    lastSyncedHash: afterHash,
    lastOkAt: Date.now(),
    lastError: null,
    conflict: null,
  });
  return { ok: true, etag, mergedHash: afterHash };
}

async function pullAndReconcile(
  code: string,
  datasetId: string,
  prefetched?: PullResult,
  forceFresh = false,
  opts?: { manualConflict?: boolean },
): Promise<PullDecision> {
  const bearer = await resolveBearer(code);
  const s = getSyncState();
  const localJson = await exportBackupAsync();
  const localHash = await canonicalHash(localJson);
  const localHasProgress = hasBackupProgress(localJson);

  lastPullAt = Date.now();
  const pullRes =
    prefetched ??
    (await pullSync(bearer, datasetId, !forceFresh && s.baseEtag && s.lastSyncedHash ? s.baseEtag : null, apiBaseUrl));

  let remotePlain: string | null = null;
  let remote: RemotePull;
  if (pullRes.status === "missing") {
    remote = null;
  } else if (pullRes.status === "not-modified") {
    remote = "not-modified";
  } else {
    remotePlain = await decryptSyncPayload(pullRes.body, code, datasetId);
    remote = { hash: await canonicalHash(remotePlain) };
  }

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
    if (pullRes.status !== "ok" || remotePlain === null) return "noop";
    await applyRemoteBackup(remotePlain, pullRes.etag);
    return "apply-remote";
  }

  if (decision === "push-create" || decision === "push") {
    const cond: { ifMatch: string } | { ifNoneMatchStar: true } =
      decision === "push-create"
        ? { ifNoneMatchStar: true }
        : { ifMatch: pullRes.status === "ok" ? pullRes.etag : (s.baseEtag ?? "") };
    try {
      const { etag } = await pushEncrypted(code, datasetId, localJson, cond, bearer);
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
        return await pullAndReconcile(code, datasetId, undefined, true, opts);
      }
      throw err;
    }
  }

  if (pullRes.status === "ok" && remotePlain !== null) {
    if (!opts?.manualConflict) {
      try {
        const res = await applyRemoteAndPushMerge(
          code,
          datasetId,
          localJson,
          remotePlain,
          pullRes.etag,
          { ifMatch: pullRes.etag },
          bearer,
        );
        if (res.ok) return "merged";
      } catch (err) {
        if (err instanceof SyncConflictError && !forceFresh) {
          return await pullAndReconcile(code, datasetId, undefined, true, opts);
        }
        /* fall back to explicit conflict sheet */
      }
    }
    setConflictState(localJson, remotePlain, pullRes.etag);
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
        const { etag } = await pushEncrypted(s.code, datasetId, localJson, { ifMatch: s.baseEtag });
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

export async function resolveConflict(choice: "merge" | "remote" | "local"): Promise<boolean> {
  const pre = getSyncState();
  if (!pre.code || !pre.conflict) return false;
  return runExclusive(async () => {
    const s = getSyncState();
    if (!s.code || !s.conflict) return false;
    const datasetId = store.get().progress.datasetId;
    const conflict = s.conflict;
    try {
      if (choice === "merge") {
        const cond: { ifMatch: string } | { ifNoneMatchStar: true } = conflict.remoteEtag
          ? { ifMatch: conflict.remoteEtag }
          : { ifNoneMatchStar: true };
        const res = await applyRemoteAndPushMerge(
          s.code,
          datasetId,
          conflict.localJson,
          conflict.remoteJson,
          conflict.remoteEtag,
          cond,
        );
        if (!res.ok) throw new Error("无法合并这两份数据");
        notifyToast("已智能合并两端学习进度", "ok");
        return true;
      }
      if (choice === "remote") {
        await applyRemoteBackup(conflict.remoteJson, conflict.remoteEtag);
        notifyToast("已采用云端数据恢复本机", "ok");
        return true;
      }
      const localJson = await exportBackupAsync();
      const localHash = await canonicalHash(localJson);
      try {
        const { etag } = await pushEncrypted(
          s.code,
          datasetId,
          localJson,
          conflict.remoteEtag ? { ifMatch: conflict.remoteEtag } : { ifNoneMatchStar: true },
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
          await pullAndReconcile(s.code, datasetId, undefined, true, { manualConflict: true });
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
    const bearer = await resolveBearer(s.code);
    return await listHistory(bearer, datasetId, apiBaseUrl);
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
      const bearer = await resolveBearer(s.code);
      const rawHist = await getHistoryVersion(bearer, datasetId, id, apiBaseUrl);
      const histJson = await decryptSyncPayload(rawHist, s.code, datasetId);
      const latest = await pullSync(bearer, datasetId, null, apiBaseUrl);
      const { afterJson, afterHash } = await applyRemoteBackup(
        histJson,
        latest.status === "ok" ? latest.etag : "",
        { skipStateUpdate: true },
      );
      const cond: { ifMatch: string } | { ifNoneMatchStar: true } =
        latest.status === "ok" ? { ifMatch: latest.etag } : { ifNoneMatchStar: true };
      const { etag } = await pushEncrypted(s.code, datasetId, afterJson, cond, bearer);
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

const PENDING_INVITE_KEY = "word-atlas:sync:pending-invite";
const PENDING_INVITE_TTL_MS = 10 * 60_000;

function loadPendingInviteCode(invite: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(PENDING_INVITE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { invite?: unknown; code?: unknown; at?: unknown };
    if (
      parsed.invite === invite &&
      typeof parsed.code === "string" &&
      SYNC_CODE_RE.test(parsed.code) &&
      typeof parsed.at === "number" &&
      Date.now() - parsed.at <= PENDING_INVITE_TTL_MS
    ) {
      return parsed.code;
    }
  } catch {
    /* ignore storage errors */
  }
  return null;
}

function savePendingInviteCode(invite: string, code: string): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(PENDING_INVITE_KEY, JSON.stringify({ invite, code, at: Date.now() }));
    }
  } catch {
    /* ignore storage errors */
  }
}

function clearPendingInviteCode(): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    /* ignore storage errors */
  }
}

export async function registerWithInvite(inviteCode: string): Promise<string> {
  const trimmed = inviteCode.trim();
  if (!trimmed) throw new Error("请输入邀请码");
  return runExclusive(async () => {
    const localCode = loadPendingInviteCode(trimmed) ?? generateSyncCode();
    savePendingInviteCode(trimmed, localCode);
    const authToken = await deriveSyncAuthToken(localCode);
    let res: { syncCode?: string; authVersion?: 1 | 2 };
    try {
      res = await registerInvite(trimmed, apiBaseUrl, undefined, authToken);
    } catch (err) {
      if (err instanceof SyncApiError && err.status === 403) clearPendingInviteCode();
      throw err;
    }
    clearPendingInviteCode();
    const syncCode = res.syncCode ?? localCode;
    const authVersion: 1 | 2 = res.authVersion === 2 ? 2 : 1;
    setSyncState({
      code: syncCode,
      authVersion,
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
    const authToken = await deriveSyncAuthToken(trimmed);
    let prefetched: PullResult;
    let authVersion: 1 | 2 = 2;
    try {
      prefetched = await pullSync(authToken, datasetId, null, apiBaseUrl);
    } catch (err) {
      if (!(err instanceof SyncAuthError)) throw err;
      prefetched = await pullSync(trimmed, datasetId, null, apiBaseUrl);
      let upgraded = false;
      try {
        upgraded = await upgradeSyncAuth(trimmed, authToken, apiBaseUrl);
      } catch (upErr) {
        if (upErr instanceof SyncAuthError) throw upErr;
      }
      authVersion = upgraded ? 2 : 1;
      if (!upgraded) upgradeUnsupportedForBase = apiBaseUrl;
    }
    setSyncState({
      code: trimmed,
      authVersion,
      baseEtag: null,
      lastSyncedHash: null,
      lastOkAt: null,
      lastError: null,
      conflict: null,
    });
    try {
      return await pullAndReconcile(trimmed, datasetId, prefetched, false, { manualConflict: true });
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
      const bearer = await resolveBearer(s.code);
      await deleteAccount(bearer, apiBaseUrl);
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
  subscribeExamBankChanges(scheduleDebouncedPush);

  if (typeof window !== "undefined") {
    window.addEventListener("fb2:draft-changed", scheduleDebouncedPush);
    window.addEventListener("online", () => {
      if (getSyncState().code) void syncNow();
    });
  }

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

  setInterval(() => {
    if (typeof document === "undefined" || document.visibilityState === "visible") {
      void pushIfChanged();
    }
  }, 5 * 60_000);

  if (getSyncState().code) {
    void syncNow();
  }
}
