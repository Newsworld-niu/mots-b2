import { subscribeAiConfig } from "../ai/config";
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
  checkSyncAuthStatus,
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
import {
  aiPayloadDiffers,
  aiSyncAccountFingerprint,
  aiSyncPrefsSignature,
  applyIncomingAiSync,
  attachAiSyncPayload,
  bindAiSyncAccount,
  buildAiSyncPayload,
  clearAiSyncOnUnpair,
  dropLegacyPassthroughKeys,
  getAiSyncPrefs,
  isConfigSyncOn,
  markAiPolicySynced,
  onAiSyncPolicyChanged,
  payloadCarriesKeys,
  readAiConfigField,
  refreshAiPolicyAndPassthroughFromLatest,
  resetAiSyncOnWipe,
  restoreAiConfigFromHistory,
  shouldIncludeKeysInUpload,
  stripAiConfigFromJson,
  subscribeAiSyncPrefs,
  type AiApplyMode,
  type AiSyncPayload,
} from "./ai-sync";
import { decryptSyncPayloadVerified, deriveSyncAuthToken, encryptSyncPayload, generateSyncCode, isEncryptedSyncPayload } from "./crypto";
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
const checkedAuthCodes = new Set<string>();

export function setSyncBaseUrlForTest(url: string): void {
  apiBaseUrl = url;
  upgradeUnsupportedForBase = null;
  checkedAuthCodes.clear();
}

function markLegacyAuth(): void {
  if (!getSyncState().legacyAuth) setSyncState({ legacyAuth: true });
  dropLegacyPassthroughKeys();
}

function isActiveSession(code: string, datasetId: string): boolean {
  return getSyncState().code === code && store.get().progress.datasetId === datasetId;
}

/**
 * Resolve the bearer token sent to the sync server:
 * - v2 accounts always send HKDF(`mb2a_...`) derived locally so raw `syncCode` never leaves the device, and verify
 *   once per session via `/api/auth` whether the account was originally upgraded from a legacy v1 code.
 * - Legacy v1 accounts silently upgrade via `POST /api/auth/upgrade` on first sync, falling back to `code`
 *   only when the target server does not yet implement v2 upgrade.
 */
async function resolveBearer(code: string): Promise<string> {
  const s = getSyncState();
  const derived = await deriveSyncAuthToken(code);
  if (s.authVersion === 2) {
    if (!s.legacyAuth && !checkedAuthCodes.has(code)) {
      checkedAuthCodes.add(code);
      try {
        const status = await checkSyncAuthStatus(derived, apiBaseUrl);
        if (status?.legacyAuth && getSyncState().code === code) markLegacyAuth();
      } catch (err) {
        checkedAuthCodes.delete(code);
        if (err instanceof SyncAuthError) throw err;
      }
    }
    return derived;
  }
  // a v1 account: its raw code is known to the server (it is the legacy credential), so no API key is ever uploaded
  markLegacyAuth();
  if (upgradeUnsupportedForBase === apiBaseUrl) return code;
  try {
    const ok = await upgradeSyncAuth(code, derived, apiBaseUrl);
    if (ok) {
      checkedAuthCodes.add(code);
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

export const ZERO_KNOWLEDGE_REQUIRED_FOR_KEYS = "当前云同步服务未启用零知识认证，已拒绝上传 API Key";

/**
 * What this device uploads: the learning backup (the same as a manual JSON export, which never holds AI settings)
 * plus the `aiConfig` sync payload. Only ever sent encrypted (pushEncrypted).
 */
export async function exportSyncPayloadAsync(): Promise<string> {
  return attachAiSyncPayload(await exportBackupAsync(), buildAiSyncPayload());
}

/**
 * Decrypt a cloud payload. Its `aiConfig` is kept only when it really was end-to-end encrypted: from a plaintext
 * (legacy) archive only the learning progress is taken.
 */
async function openRemotePayload(raw: string, code: string, datasetId: string): Promise<string> {
  const verified = await decryptSyncPayloadVerified(raw, code, datasetId);
  return verified.encrypted ? verified.json : stripAiConfigFromJson(verified.json);
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
  opts: { aiMode: AiApplyMode | "none"; afterImport?: () => void },
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
    if (opts.aiMode !== "none") applyIncomingAiSync(readAiConfigField(remoteJson).payload, opts.aiMode);
    opts.afterImport?.();
  } finally {
    applying = false;
    applyingUntil = Date.now() + 1000;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  const afterJson = await exportSyncPayloadAsync();
  const afterHash = await canonicalHash(afterJson);
  return { afterJson, afterHash };
}

async function markSynced(
  code: string,
  datasetId: string,
  etag: string,
  hash: string,
  syncedJson: string,
  opts?: { clearConflict?: boolean },
): Promise<void> {
  if (!isActiveSession(code, datasetId)) return;
  setSyncState({
    baseEtag: etag,
    lastSyncedHash: hash,
    lastOkAt: Date.now(),
    lastError: null,
    ...(opts?.clearConflict === false ? {} : { conflict: null }),
  });
  const aiField = readAiConfigField(syncedJson);
  const uploadedPolicyRev = aiField.payload ? aiField.payload.policyRev : 0;
  const fp = await aiSyncAccountFingerprint(code);
  if (isActiveSession(code, datasetId)) markAiPolicySynced(uploadedPolicyRev, fp);
}

/**
 * After a remote payload was applied: when what this device would upload now matches the cloud (or differs only by
 * normalization of the learning data), it is in sync. When its AI part differs (a newer local policy or config, a
 * legacy archive without aiConfig), upload at once; until that upload succeeds, the cloud's real hash is recorded
 * so that pushIfChanged finishes the job later.
 */
async function settleAfterRemoteApply(
  code: string,
  datasetId: string,
  remote: { json: string; hash: string; etag: string },
  after: { json: string; hash: string },
  bearer: string | undefined,
  forceFresh: boolean,
  opts?: { rethrowOnError?: boolean },
): Promise<void> {
  if (!isActiveSession(code, datasetId)) return;
  if (after.hash === remote.hash || !aiPayloadDiffers(after.json, remote.json)) {
    await markSynced(code, datasetId, remote.etag, after.hash, after.json);
    return;
  }
  setSyncState({ baseEtag: remote.etag, lastSyncedHash: remote.hash, lastOkAt: Date.now(), lastError: null, conflict: null });
  try {
    const pushed = await pushEncrypted(code, datasetId, after.json, { ifMatch: remote.etag }, bearer);
    await markSynced(code, datasetId, pushed.etag, pushed.uploadedHash, pushed.uploadedJson);
  } catch (err) {
    if (err instanceof SyncConflictError && !forceFresh) {
      await pullAndReconcile(code, datasetId, undefined, true);
      return;
    }
    if (opts?.rethrowOnError) throw err;
    if (isActiveSession(code, datasetId)) setSyncState({ lastError: mapSyncError(err).message });
  }
}

/** Re-enforce any switch revocation that happened while a pull/merge was awaiting the network before encrypting. */
function enforceLiveRevocationBeforeEncrypt(plaintextJson: string): string {
  const prefs = getAiSyncPrefs();
  const field = readAiConfigField(plaintextJson);
  const needsStripConfig = !isConfigSyncOn(prefs) && field.payload?.enabled === true;
  const needsStripKeys = !shouldIncludeKeysInUpload(prefs) && payloadCarriesKeys(plaintextJson);
  if (!needsStripConfig && !needsStripKeys) return plaintextJson;
  return attachAiSyncPayload(plaintextJson, buildAiSyncPayload(prefs));
}

async function pushEncrypted(
  code: string,
  datasetId: string,
  plaintextJson: string,
  cond: { ifMatch: string } | { ifNoneMatchStar: true },
  bearer?: string,
): Promise<{ etag: string; uploadedJson: string; uploadedHash: string }> {
  if (!isActiveSession(code, datasetId)) {
    throw new Error("同步账号或词库已变更，已取消上传");
  }
  const token = bearer ?? (await resolveBearer(code));
  if (!isActiveSession(code, datasetId)) {
    throw new Error("同步账号或词库已变更，已取消上传");
  }
  const finalJson = enforceLiveRevocationBeforeEncrypt(plaintextJson);
  const s = getSyncState();
  // API keys only ever travel on a zero-knowledge connection: derived mb2a_ token, raw code never shown to the server
  if (payloadCarriesKeys(finalJson) && (token === code || s.legacyAuth || s.authVersion === 1)) {
    throw new Error(ZERO_KNOWLEDGE_REQUIRED_FOR_KEYS);
  }
  const wireBody = await encryptSyncPayload(finalJson, code, datasetId);
  if (!isEncryptedSyncPayload(wireBody, datasetId)) throw new Error("加密同步数据校验失败，已取消上传");
  if (!isActiveSession(code, datasetId)) {
    throw new Error("同步账号或词库已变更，已取消上传");
  }
  const res = await pushSync(token, datasetId, wireBody, cond, apiBaseUrl);
  if (res.legacyAuth && isActiveSession(code, datasetId)) markLegacyAuth();
  const uploadedHash = finalJson === plaintextJson ? await canonicalHash(finalJson) : await canonicalHash(finalJson);
  return { etag: res.etag, uploadedJson: finalJson, uploadedHash };
}

async function applyRemoteAndPushMerge(
  code: string,
  datasetId: string,
  localJson: string,
  remotePlain: string,
  cond: { ifMatch: string } | { ifNoneMatchStar: true },
  bearer?: string,
): Promise<{ ok: true; etag: string; mergedHash: string } | { ok: false }> {
  const merged = mergeBackups(localJson, remotePlain);
  if (!merged.ok) return { ok: false };
  const { afterJson } = await applyRemoteBackup(merged.json, { aiMode: "merge" });
  const pushed = await pushEncrypted(code, datasetId, afterJson, cond, bearer);
  await markSynced(code, datasetId, pushed.etag, pushed.uploadedHash, pushed.uploadedJson);
  return { ok: true, etag: pushed.etag, mergedHash: pushed.uploadedHash };
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
  const localJson = await exportSyncPayloadAsync();
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
    remotePlain = await openRemotePayload(pullRes.body, code, datasetId);
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
      await markSynced(code, datasetId, pullRes.etag, localHash, localJson);
    } else if (isActiveSession(code, datasetId)) {
      setSyncState({
        lastOkAt: Date.now(),
        lastError: null,
      });
      if (s.lastSyncedHash !== null && s.lastSyncedHash === localHash) {
        const rev = readAiConfigField(localJson).payload?.policyRev ?? 0;
        markAiPolicySynced(rev, await aiSyncAccountFingerprint(code));
      }
    }
    return "noop";
  }

  if (decision === "apply-remote") {
    if (pullRes.status !== "ok" || remotePlain === null) return "noop";
    if (!isActiveSession(code, datasetId)) return "noop";
    // a first pairing merges the AI settings slot by slot; an already-paired device fast-forwards
    const aiMode: AiApplyMode = s.lastSyncedHash === null ? "merge" : "fast-forward";
    const after = await applyRemoteBackup(remotePlain, { aiMode });
    await settleAfterRemoteApply(
      code,
      datasetId,
      { json: remotePlain, hash: remote !== null && remote !== "not-modified" ? remote.hash : "", etag: pullRes.etag },
      { json: after.afterJson, hash: after.afterHash },
      bearer,
      forceFresh,
    );
    return "apply-remote";
  }

  if (decision === "push-create" || decision === "push") {
    const cond: { ifMatch: string } | { ifNoneMatchStar: true } =
      decision === "push-create"
        ? { ifNoneMatchStar: true }
        : { ifMatch: pullRes.status === "ok" ? pullRes.etag : (s.baseEtag ?? "") };
    try {
      const pushed = await pushEncrypted(code, datasetId, localJson, cond, bearer);
      await markSynced(code, datasetId, pushed.etag, pushed.uploadedHash, pushed.uploadedJson);
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
        const res = await applyRemoteAndPushMerge(code, datasetId, localJson, remotePlain, { ifMatch: pullRes.etag }, bearer);
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
    const code = s.code;
    const datasetId = store.get().progress.datasetId;
    try {
      const localJson = await exportSyncPayloadAsync();
      const localHash = await canonicalHash(localJson);
      if (s.lastSyncedHash !== null && localHash === s.lastSyncedHash) {
        const rev = readAiConfigField(localJson).payload?.policyRev ?? 0;
        markAiPolicySynced(rev, await aiSyncAccountFingerprint(code));
        return;
      }
      const localHasProgress = hasBackupProgress(localJson);
      if (s.lastSyncedHash === null && !localHasProgress) return;

      if (!s.baseEtag) {
        await pullAndReconcile(code, datasetId);
        return;
      }

      try {
        const pushed = await pushEncrypted(code, datasetId, localJson, { ifMatch: s.baseEtag });
        await markSynced(code, datasetId, pushed.etag, pushed.uploadedHash, pushed.uploadedJson, { clearConflict: false });
      } catch (err) {
        if (err instanceof SyncConflictError) {
          await pullAndReconcile(code, datasetId, undefined, true);
          return;
        }
        throw err;
      }
    } catch (err) {
      if (isActiveSession(code, datasetId)) {
        const { message } = mapSyncError(err);
        setSyncState({ lastError: message });
      }
    }
  });
}

export async function resolveConflict(choice: "merge" | "remote" | "local"): Promise<boolean> {
  const pre = getSyncState();
  if (!pre.code || !pre.conflict) return false;
  return runExclusive(async () => {
    const s = getSyncState();
    if (!s.code || !s.conflict) return false;
    const code = s.code;
    const datasetId = store.get().progress.datasetId;
    const conflict = s.conflict;
    try {
      if (choice === "merge") {
        const cond: { ifMatch: string } | { ifNoneMatchStar: true } = conflict.remoteEtag
          ? { ifMatch: conflict.remoteEtag }
          : { ifNoneMatchStar: true };
        const res = await applyRemoteAndPushMerge(code, datasetId, conflict.localJson, conflict.remoteJson, cond);
        if (!res.ok) throw new Error("无法合并这两份数据");
        notifyToast("已智能合并两端学习进度", "ok");
        return true;
      }
      if (choice === "remote") {
        const after = await applyRemoteBackup(conflict.remoteJson, { aiMode: "adopt-remote" });
        if (conflict.remoteEtag) {
          await settleAfterRemoteApply(
            code,
            datasetId,
            { json: conflict.remoteJson, hash: await canonicalHash(conflict.remoteJson), etag: conflict.remoteEtag },
            { json: after.afterJson, hash: after.afterHash },
            undefined,
            false,
            { rethrowOnError: true },
          );
        } else {
          await markSynced(code, datasetId, conflict.remoteEtag, after.afterHash, after.afterJson);
        }
        notifyToast("已采用云端数据恢复本机", "ok");
        return true;
      }
      const localJson = await exportSyncPayloadAsync();
      try {
        const pushed = await pushEncrypted(
          code,
          datasetId,
          localJson,
          conflict.remoteEtag ? { ifMatch: conflict.remoteEtag } : { ifNoneMatchStar: true },
        );
        await markSynced(code, datasetId, pushed.etag, pushed.uploadedHash, pushed.uploadedJson);
        notifyToast("已用本机数据覆盖云端", "ok");
        return true;
      } catch (err) {
        if (err instanceof SyncConflictError) {
          await pullAndReconcile(code, datasetId, undefined, true, { manualConflict: true });
          return false;
        }
        throw err;
      }
    } catch (err) {
      const { message } = mapSyncError(err);
      if (isActiveSession(code, datasetId)) setSyncState({ lastError: message });
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

function validateBackupShape(json: string, datasetId: string): void {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("历史版本数据无效，已取消恢复");
  }
  const o = data as Record<string, unknown> | null;
  const progress = o && typeof o === "object" && !Array.isArray(o) ? (o.progress as Record<string, unknown> | undefined) : undefined;
  if (!o || o.app !== "word-atlas" || o.version !== 2 || !progress || typeof progress !== "object" || progress.datasetId !== datasetId) {
    throw new Error("历史版本数据无效或不属于当前词库，已取消恢复");
  }
}

/**
 * Restore a cloud history snapshot. The latest cloud version is read first (a newer "switch off" there is honoured);
 * the snapshot is decrypted and validated before anything local changes; its AI settings follow the policy in force
 * now (keys only when key sync is on, never revived otherwise); then the result is uploaded over the latest version
 * (one retry on a concurrent update), provided the pairing did not change meanwhile.
 */
export async function restoreHistoryVersion(id: string): Promise<boolean> {
  const pre = getSyncState();
  if (!pre.code) return false;
  return runExclusive(async () => {
    const s = getSyncState();
    if (!s.code) return false;
    const code = s.code;
    const datasetId = store.get().progress.datasetId;
    try {
      const bearer = await resolveBearer(code);
      const readLatest = async () => {
        const res = await pullSync(bearer, datasetId, null, apiBaseUrl);
        let ai: AiSyncPayload | null = null;
        if (res.status === "ok") {
          const v = await decryptSyncPayloadVerified(res.body, code, datasetId);
          if (v.encrypted) {
            ai = readAiConfigField(v.json).payload;
            refreshAiPolicyAndPassthroughFromLatest(ai);
          }
        }
        return { res, ai };
      };
      let latest = await readLatest();

      const rawHist = await getHistoryVersion(bearer, datasetId, id, apiBaseUrl);
      const hist = await decryptSyncPayloadVerified(rawHist, code, datasetId);
      validateBackupShape(hist.json, datasetId);
      const histAi = hist.encrypted ? readAiConfigField(hist.json).payload : null;

      let { afterJson } = await applyRemoteBackup(stripAiConfigFromJson(hist.json), {
        aiMode: "none",
        afterImport: () => restoreAiConfigFromHistory(histAi, latest.ai),
      });

      if (!isActiveSession(code, datasetId)) throw new Error("同步账号已变更，已取消上传恢复结果");
      const condOf = (r: PullResult): { ifMatch: string } | { ifNoneMatchStar: true } =>
        r.status === "ok" ? { ifMatch: r.etag } : { ifNoneMatchStar: true };
      let pushed: { etag: string; uploadedJson: string; uploadedHash: string } | null = null;
      try {
        pushed = await pushEncrypted(code, datasetId, afterJson, condOf(latest.res), bearer);
      } catch (err) {
        if (!(err instanceof SyncConflictError)) throw err;
      }
      if (pushed === null) {
        // the cloud moved meanwhile: read its newest version once more, raise revisions above it, and upload over it
        latest = await readLatest();
        restoreAiConfigFromHistory(histAi, latest.ai);
        afterJson = await exportSyncPayloadAsync();
        if (!isActiveSession(code, datasetId)) throw new Error("同步账号已变更，已取消上传恢复结果");
        pushed = await pushEncrypted(code, datasetId, afterJson, condOf(latest.res), bearer);
      }
      await markSynced(code, datasetId, pushed.etag, pushed.uploadedHash, pushed.uploadedJson);
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
    bindAiSyncAccount(await aiSyncAccountFingerprint(syncCode));
    setSyncState({
      code: syncCode,
      authVersion,
      // a code handed out by the server is known to it: never upload API keys on this account
      legacyAuth: res.syncCode ? true : undefined,
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
    const fp = await aiSyncAccountFingerprint(trimmed);
    // Zero-knowledge pairing: only the HKDF-derived mb2a_ token is ever sent on the wire. A 401 never triggers a
    // raw-code fallback, so a malicious or misconfigured server cannot trick a pairing device into revealing syncCode.
    const prefetched = await pullSync(authToken, datasetId, null, apiBaseUrl);
    let legacyAuth = false;
    try {
      const status = await checkSyncAuthStatus(authToken, apiBaseUrl);
      if (status !== null) {
        checkedAuthCodes.add(trimmed);
        legacyAuth = status.legacyAuth;
      }
    } catch (err) {
      if (err instanceof SyncAuthError) throw err;
    }
    bindAiSyncAccount(fp);
    setSyncState({
      code: trimmed,
      authVersion: 2,
      legacyAuth: legacyAuth ? true : undefined,
      baseEtag: null,
      lastSyncedHash: null,
      lastOkAt: null,
      lastError: null,
      conflict: null,
    });
    if (legacyAuth) dropLegacyPassthroughKeys();
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
  checkedAuthCodes.clear();
  clearAiSyncOnUnpair();
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
      checkedAuthCodes.clear();
      resetAiSyncOnWipe();
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
  subscribeAiConfig(scheduleDebouncedPush);
  let lastAiPrefsSig = aiSyncPrefsSignature();
  subscribeAiSyncPrefs(() => {
    const sig = aiSyncPrefsSignature();
    if (sig === lastAiPrefsSig) return;
    lastAiPrefsSig = sig;
    scheduleDebouncedPush();
  });
  // Flipping an AI sync switch (on or off) is the learner's own act, never an echo of applied remote data, so the
  // post-apply quiet period never holds it back (pushIfChanged still queues behind any sync in progress).
  onAiSyncPolicyChanged(() => {
    if (applying) return;
    const s = getSyncState();
    if (!s.code || s.conflict) return;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    void pushIfChanged();
  });

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
