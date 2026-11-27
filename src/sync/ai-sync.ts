/**
 * Cross-device sync of the AI settings inside the end-to-end encrypted cloud sync payload.
 *
 * The payload is a top-level `aiConfig` in the backup JSON that engine.ts encrypts (AES-GCM, key derived from the
 * sync code) before upload; it is never written into manual JSON backups. Three things are synced independently:
 *  - the policy (sync the config at all? include the API keys?), ordered by `policyRev` (switching off wins ties),
 *  - the non-sensitive config (services, models, custom base URLs, Azure voices, Whisper mode), ordered by `configRev`,
 *  - the 7 credential slots (only when the account opted in), each ordered by its own `keyRevs[slot]`.
 *
 * This module imports src/ai/config.ts; config.ts never imports anything under src/sync.
 */
import { useSyncExternalStore } from "react";
import {
  CREDENTIAL_SLOTS,
  applySyncedAiConfig,
  credentialOf,
  defaultAiConfig,
  extractSyncedKeys,
  getAiConfig,
  getUnconfirmedBaseUrls,
  nonSensitiveAiConfigEquals,
  onLocalAiMutation,
  sanitizeCredential,
  sanitizeNonSensitiveAiConfig,
  setUnconfirmedBaseUrls,
  toNonSensitiveAiConfig,
  withCredential,
  withNonSensitiveAiConfig,
  TEXT_PROVIDERS,
  UNCONFIRMED_ENDPOINT_KINDS,
  type AiConfig,
  type CredentialSlot,
  type NonSensitiveAiConfig,
  type SyncedAiKeys,
  type TextProvider,
  type UnconfirmedEndpointKind,
} from "../ai/config";
import { getSyncState } from "./state";

export const AI_SYNC_STORAGE_KEY = "word-atlas:ai-sync:v1";

export type SyncTogglePolicy = "unset" | "enabled" | "disabled";
export type KeyRevs = Partial<Record<CredentialSlot, number>>;

export interface AiSyncPrefs {
  /** Fingerprint of the sync code these prefs belong to (a one-way hash, never the code itself). */
  accountFp: string | null;
  /** Non-sensitive config sync: "unset" and "enabled" both mean on (the default); "disabled" was switched off. */
  configPolicy: SyncTogglePolicy;
  /** API key sync: "unset" (off, never chosen), "enabled", or "disabled" (switched off, cloud keys removed). */
  keyPolicy: SyncTogglePolicy;
  /** Revision of the policy: bumped on every switch, or set to the remote one when a newer remote policy is adopted. */
  policyRev: number;
  /** Revision of the non-sensitive config (a private key edit never bumps it). */
  configRev: number;
  /** Revision of each credential slot (single-slot updates and explicit clears never overwrite each other). */
  keyRevs: KeyRevs;
  /**
   * The account shares keys (another device opted in) but this device keeps its own private keys and never opted in:
   * the shared encrypted keys are carried through untouched on upload, so that neither this device's private keys
   * are uploaded nor the account's shared keys erased by an ordinary progress push.
   */
  passthroughKeys: { keys: SyncedAiKeys; keyRevs: KeyRevs } | null;
  /** The policyRev known to be in the cloud (for the "waiting to update the cloud" hint). */
  syncedPolicyRev: number;
  /** Direction of the latest local switch change not yet confirmed by the cloud ("on" or "off"). */
  lastSwitchAction?: "on" | "off";
}

export interface AiSyncDisabledPayload {
  version: 1;
  enabled: false;
  includeKeys: false;
  policyRev: number;
}

export interface AiSyncConfigPayload {
  version: 1;
  enabled: true;
  includeKeys: boolean;
  policyRev: number;
  configRev: number;
  config: NonSensitiveAiConfig;
  keys?: SyncedAiKeys;
  keyRevs?: KeyRevs;
}

export type AiSyncPayload = AiSyncDisabledPayload | AiSyncConfigPayload;

export type AiApplyMode = "fast-forward" | "merge" | "adopt-remote";

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const MAX_REV = 1_000_000_000;
const rev = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(MAX_REV, Math.floor(v)) : 0);

export const defaultAiSyncPrefs = (): AiSyncPrefs => ({
  accountFp: null,
  configPolicy: "unset",
  keyPolicy: "unset",
  policyRev: 0,
  configRev: 0,
  keyRevs: {},
  passthroughKeys: null,
  syncedPolicyRev: 0,
});

function sanitizeKeyRevs(v: unknown): KeyRevs {
  const out: KeyRevs = {};
  if (!isObj(v)) return out;
  for (const slot of CREDENTIAL_SLOTS) {
    const r = rev(v[slot]);
    if (r > 0) out[slot] = r;
  }
  return out;
}

function sanitizeKeys(v: unknown): SyncedAiKeys {
  const o = isObj(v) ? v : {};
  const out = {} as SyncedAiKeys;
  for (const slot of CREDENTIAL_SLOTS) out[slot] = sanitizeCredential(o[slot]);
  return out;
}

const policy = (v: unknown): SyncTogglePolicy => (v === "enabled" || v === "disabled" ? v : "unset");

function sanitizePrefs(raw: unknown): AiSyncPrefs {
  const d = defaultAiSyncPrefs();
  if (!isObj(raw)) return d;
  const pt = isObj(raw.passthroughKeys) ? { keys: sanitizeKeys(raw.passthroughKeys.keys), keyRevs: sanitizeKeyRevs(raw.passthroughKeys.keyRevs) } : null;
  const configPolicy = policy(raw.configPolicy);
  const keyPolicy = configPolicy === "disabled" ? "disabled" : policy(raw.keyPolicy);
  const policyRev = rev(raw.policyRev);
  const syncedPolicyRev = rev(raw.syncedPolicyRev);
  const lastSwitchAction =
    policyRev > syncedPolicyRev && (raw.lastSwitchAction === "on" || raw.lastSwitchAction === "off") ? raw.lastSwitchAction : undefined;
  return {
    accountFp: typeof raw.accountFp === "string" && /^[0-9a-f]{8,64}$/.test(raw.accountFp) ? raw.accountFp : null,
    configPolicy,
    keyPolicy,
    policyRev,
    configRev: rev(raw.configRev),
    keyRevs: sanitizeKeyRevs(raw.keyRevs),
    passthroughKeys: keyPolicy === "unset" ? pt : null,
    syncedPolicyRev,
    ...(lastSwitchAction ? { lastSwitchAction } : {}),
  };
}

function readPrefs(): AiSyncPrefs {
  if (typeof localStorage === "undefined") return defaultAiSyncPrefs();
  try {
    return sanitizePrefs(JSON.parse(localStorage.getItem(AI_SYNC_STORAGE_KEY) || "null"));
  } catch {
    return defaultAiSyncPrefs();
  }
}

let prefs: AiSyncPrefs = readPrefs();
const listeners = new Set<() => void>();
const emit = () =>
  listeners.forEach((f) => {
    try {
      f();
    } catch {
      /* ignore */
    }
  });

function commit(next: AiSyncPrefs): void {
  const clean = sanitizePrefs(next);
  if (JSON.stringify(clean) === JSON.stringify(prefs)) return;
  prefs = clean;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(AI_SYNC_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    /* ignore quota / private mode */
  }
  emit();
}

export const getAiSyncPrefs = (): AiSyncPrefs => prefs;

export function subscribeAiSyncPrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAiSyncPrefs(): AiSyncPrefs {
  return useSyncExternalStore(subscribeAiSyncPrefs, getAiSyncPrefs, getAiSyncPrefs);
}

/** Read the prefs again from localStorage (another tab, or a test that swapped localStorage). */
export function reloadAiSyncPrefs(): AiSyncPrefs {
  prefs = readPrefs();
  emit();
  return prefs;
}

/** What the sync payload depends on (engine uses it to skip prefs updates that change nothing for the cloud). */
export function aiSyncPrefsSignature(p: AiSyncPrefs = prefs): string {
  return JSON.stringify([p.configPolicy, p.keyPolicy, p.policyRev, p.configRev, p.keyRevs, p.passthroughKeys]);
}

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("storage", (e: StorageEvent) => {
    if (e.key !== AI_SYNC_STORAGE_KEY && e.key !== null) return;
    prefs = readPrefs();
    emit();
  });
}

/* ---------- local edits advance the revisions ---------- */

onLocalAiMutation((prev, next) => {
  const p = prefs;
  let configRev = p.configRev;
  const prevNs = toNonSensitiveAiConfig(prev);
  const nextNs = toNonSensitiveAiConfig(next);
  // Editing a private key in AiSettings clears lastGoodModel[provider] as a local cache side effect: when keys are not
  // shared, that cache clear alone must never count as a non-sensitive config edit or break pristine state.
  if (p.keyPolicy !== "enabled") {
    const adjustedLastGood = { ...prevNs.lastGoodModel };
    for (const prov of TEXT_PROVIDERS) {
      if ((prev.keys[prov] ?? "") !== (next.keys[prov] ?? "") && !(prov in nextNs.lastGoodModel)) {
        delete adjustedLastGood[prov];
      }
    }
    prevNs.lastGoodModel = adjustedLastGood;
  }
  if (!nonSensitiveAiConfigEquals(prevNs, nextNs)) configRev = Math.min(MAX_REV, configRev + 1);
  const keyRevs: KeyRevs = { ...p.keyRevs };
  if (p.keyPolicy === "enabled") {
    for (const slot of CREDENTIAL_SLOTS) {
      if (credentialOf(prev, slot) !== credentialOf(next, slot)) keyRevs[slot] = Math.min(MAX_REV, (keyRevs[slot] ?? 0) + 1);
    }
  }
  commit({ ...p, configRev, keyRevs });
});

/* ---------- switches ---------- */

export const isConfigSyncOn = (p: AiSyncPrefs = prefs) => p.configPolicy !== "disabled";
export const isKeySyncOn = (p: AiSyncPrefs = prefs) => p.configPolicy !== "disabled" && p.keyPolicy === "enabled";

/** Whether the next upload carries API keys (this device's own, or the account's shared keys carried through). */
export function shouldIncludeKeysInUpload(p: AiSyncPrefs = prefs): boolean {
  if (p.configPolicy === "disabled") return false;
  return p.keyPolicy === "enabled" || (p.keyPolicy === "unset" && !!p.passthroughKeys);
}

const policyChangeListeners = new Set<() => void>();

/** Be told whenever the learner flips an AI sync switch (on or off) so engine can push without post-apply delay. */
export function onAiSyncPolicyChanged(listener: () => void): () => void {
  policyChangeListeners.add(listener);
  return () => {
    policyChangeListeners.delete(listener);
  };
}

export const onAiSyncPolicyDisabled = onAiSyncPolicyChanged;

const emitPolicyChanged = () =>
  policyChangeListeners.forEach((f) => {
    try {
      f();
    } catch {
      /* ignore */
    }
  });

/** If the learner flips a switch while unpaired after leaving a previous account, start a clean preset for the next account. */
function basePrefsForUserSwitch(): AiSyncPrefs {
  if (!getSyncState().code && prefs.accountFp !== null) return defaultAiSyncPrefs();
  return prefs;
}

/** 将 API Key 一并纳入端到端加密同步 (turning it on also turns config sync on). Local keys are never cleared. */
export function setSyncKeysEnabled(on: boolean): void {
  const p = basePrefsForUserSwitch();
  const policyRev = Math.min(MAX_REV, p.policyRev + 1);
  if (on) {
    if (isKeySyncOn(prefs) && p === prefs) return;
    const cfg = getAiConfig();
    const pt = p.passthroughKeys;
    const keyRevs: KeyRevs = { ...p.keyRevs };
    for (const slot of CREDENTIAL_SLOTS) {
      const v = credentialOf(cfg, slot);
      const shared = pt?.keys[slot] ?? "";
      let r = Math.max(keyRevs[slot] ?? 0, pt?.keyRevs[slot] ?? 0);
      // what this device holds now supersedes the shared value it differs from
      if (pt && shared && shared !== v) r += 1;
      else if (v) r = Math.max(r, 1);
      if (r > 0) keyRevs[slot] = Math.min(MAX_REV, r);
    }
    commit({ ...p, configPolicy: "enabled", keyPolicy: "enabled", policyRev, keyRevs, passthroughKeys: null, lastSwitchAction: "on" });
    emitPolicyChanged();
    return;
  }
  if ((p.keyPolicy === "disabled" || p.configPolicy === "disabled") && p === prefs) return;
  commit({ ...p, keyPolicy: "disabled", policyRev, passthroughKeys: null, lastSwitchAction: "off" });
  emitPolicyChanged();
}

/** 同步 AI 接口配置 (turning it off also turns key sync off). Local settings and keys are never cleared. */
export function setSyncConfigEnabled(on: boolean): void {
  const p = basePrefsForUserSwitch();
  const policyRev = Math.min(MAX_REV, p.policyRev + 1);
  if (on) {
    if (prefs.configPolicy !== "disabled" && p === prefs) return;
    commit({ ...p, configPolicy: "enabled", policyRev, lastSwitchAction: "on" });
    emitPolicyChanged();
    return;
  }
  if (prefs.configPolicy === "disabled" && p === prefs) return;
  commit({ ...p, configPolicy: "disabled", keyPolicy: "disabled", policyRev, passthroughKeys: null, lastSwitchAction: "off" });
  emitPolicyChanged();
}

/**
 * Record that the cloud now holds up to `uploadedPolicyRev` for `accountFp`. Never marks a newer local switch change
 * synced if the learner flipped a switch again while the upload was in flight, or if the account changed.
 */
export function markAiPolicySynced(uploadedPolicyRev?: number, accountFp?: string | null): void {
  if (accountFp && prefs.accountFp && prefs.accountFp !== accountFp) return;
  const target = uploadedPolicyRev !== undefined ? Math.min(prefs.policyRev, Math.max(prefs.syncedPolicyRev, uploadedPolicyRev)) : prefs.policyRev;
  const clearedAction = target >= prefs.policyRev ? undefined : prefs.lastSwitchAction;
  if (prefs.syncedPolicyRev !== target || prefs.lastSwitchAction !== clearedAction) {
    commit({ ...prefs, syncedPolicyRev: target, lastSwitchAction: clearedAction });
  }
}

/** Drop carried-through shared keys when an account is found to use legacy non-zero-knowledge auth. */
export function dropLegacyPassthroughKeys(): void {
  if (prefs.passthroughKeys) commit({ ...prefs, passthroughKeys: null });
}

/* ---------- account isolation ---------- */

/** A one-way fingerprint of a sync code (SHA-256, truncated): which account the prefs belong to. */
export async function aiSyncAccountFingerprint(code: string): Promise<string> {
  const bytes = new TextEncoder().encode(`word-atlas:ai-sync-account:v1:${code.trim()}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

/** Whether uploads to the account `fp` would carry API keys (a different account never inherits the opt-in). */
export function wouldIncludeKeysForAccount(fp: string): boolean {
  if (prefs.accountFp !== null && prefs.accountFp !== fp) return false;
  return shouldIncludeKeysInUpload(prefs);
}

/**
 * Bind the prefs to the account being paired: a choice made before the first pairing is kept, but switching to a
 * different account never carries the previous account's key upload consent or revisions over.
 */
export function bindAiSyncAccount(fp: string): void {
  const p = prefs;
  if (p.accountFp === fp) return;
  if (p.accountFp === null) {
    commit({ ...p, accountFp: fp });
    return;
  }
  commit({
    ...defaultAiSyncPrefs(),
    accountFp: fp,
  });
}

/** 退出同步（仅本机）: drop the carried-through shared keys; the choices stay with this account. */
export function clearAiSyncOnUnpair(): void {
  if (prefs.passthroughKeys) commit({ ...prefs, passthroughKeys: null });
}

/** 删除云端数据: the account is gone, so is its key upload consent. */
export function resetAiSyncOnWipe(): void {
  const p = prefs;
  commit({
    ...defaultAiSyncPrefs(),
    configPolicy: p.configPolicy === "disabled" ? "disabled" : "unset",
    keyPolicy: p.configPolicy === "disabled" ? "disabled" : "unset",
  });
}

/* ---------- the payload ---------- */

function orderedKeyRevs(r: KeyRevs): KeyRevs {
  const out: KeyRevs = {};
  for (const slot of CREDENTIAL_SLOTS) if ((r[slot] ?? 0) > 0) out[slot] = r[slot];
  return out;
}

function orderedKeys(k: SyncedAiKeys): SyncedAiKeys {
  const out = {} as SyncedAiKeys;
  for (const slot of CREDENTIAL_SLOTS) out[slot] = k[slot] ?? "";
  return out;
}

/** Nothing was ever chosen or changed: no `aiConfig` at all, exactly like an archive from before this feature. */
function isPristine(p: AiSyncPrefs, cfg: AiConfig): boolean {
  return (
    p.configPolicy === "unset" &&
    p.keyPolicy === "unset" &&
    p.policyRev === 0 &&
    p.configRev === 0 &&
    !p.passthroughKeys &&
    nonSensitiveAiConfigEquals(toNonSensitiveAiConfig(cfg), toNonSensitiveAiConfig(defaultAiConfig()))
  );
}

/**
 * The `aiConfig` this device uploads (null: none). Deterministic: the same prefs and settings always give the same
 * value (no time, no randomness), so unchanged data never looks changed.
 */
export function buildAiSyncPayload(p: AiSyncPrefs = prefs, cfg: AiConfig = getAiConfig()): AiSyncPayload | null {
  if (isPristine(p, cfg)) return null;
  if (p.configPolicy === "disabled") return { version: 1, enabled: false, includeKeys: false, policyRev: p.policyRev };
  const config = toNonSensitiveAiConfig(cfg);
  if (p.keyPolicy === "enabled") {
    return { version: 1, enabled: true, includeKeys: true, policyRev: p.policyRev, configRev: p.configRev, config, keys: extractSyncedKeys(cfg), keyRevs: orderedKeyRevs(p.keyRevs) };
  }
  if (p.keyPolicy === "unset" && p.passthroughKeys) {
    return {
      version: 1,
      enabled: true,
      includeKeys: true,
      policyRev: p.policyRev,
      configRev: p.configRev,
      config,
      keys: orderedKeys(p.passthroughKeys.keys),
      keyRevs: orderedKeyRevs(p.passthroughKeys.keyRevs),
    };
  }
  return { version: 1, enabled: true, includeKeys: false, policyRev: p.policyRev, configRev: p.configRev, config };
}

/**
 * Parse an untrusted `aiConfig` (from a decrypted payload). Null for anything not understood (an unknown future
 * version included). `keys` are read only when `includeKeys === true`; otherwise anything smuggled in is dropped.
 */
export function parseAiSyncPayload(raw: unknown): AiSyncPayload | null {
  if (!isObj(raw) || raw.version !== 1) return null;
  const policyRev = rev(raw.policyRev);
  if (raw.enabled === false) return { version: 1, enabled: false, includeKeys: false, policyRev };
  if (raw.enabled !== true || !isObj(raw.config)) return null;
  const config = sanitizeNonSensitiveAiConfig(raw.config);
  const configRev = rev(raw.configRev);
  if (raw.includeKeys === true) {
    return { version: 1, enabled: true, includeKeys: true, policyRev, configRev, config, keys: sanitizeKeys(raw.keys), keyRevs: sanitizeKeyRevs(raw.keyRevs) };
  }
  return { version: 1, enabled: true, includeKeys: false, policyRev, configRev, config };
}

/** The `aiConfig` of a backup JSON: whether there is one, the raw value, and its parsed form (null when unknown). */
export function readAiConfigField(json: string): { present: boolean; raw: unknown; payload: AiSyncPayload | null } {
  try {
    const data = JSON.parse(json) as unknown;
    if (!isObj(data) || !("aiConfig" in data)) return { present: false, raw: undefined, payload: null };
    return { present: true, raw: data.aiConfig, payload: parseAiSyncPayload(data.aiConfig) };
  } catch {
    return { present: false, raw: undefined, payload: null };
  }
}

/** Put `payload` as the top-level `aiConfig` of a backup JSON (or leave it without one when null). */
export function attachAiSyncPayload(backupJson: string, payload: AiSyncPayload | null): string {
  let data: unknown;
  try {
    data = JSON.parse(backupJson);
  } catch {
    return backupJson;
  }
  if (!isObj(data)) return backupJson;
  const { aiConfig: _drop, ...rest } = data;
  void _drop;
  return JSON.stringify(payload ? { ...rest, aiConfig: payload } : rest, null, 1);
}

/** The same JSON without its `aiConfig` (an untrusted plaintext archive, a history snapshot's learning part). */
export function stripAiConfigFromJson(json: string): string {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return json;
  }
  if (!isObj(data) || !("aiConfig" in data)) return json;
  const { aiConfig: _drop, ...rest } = data;
  void _drop;
  return JSON.stringify(rest, null, 1);
}

/** Whether an upload of `json` would carry API keys. */
export function payloadCarriesKeys(json: string): boolean {
  const { raw } = readAiConfigField(json);
  return isObj(raw) && (raw.includeKeys === true || "keys" in raw);
}

/**
 * Whether the AI part of what this device would upload differs from the cloud's (an unknown future `aiConfig` in the
 * cloud never forces an upload by itself).
 */
export function aiPayloadDiffers(localJson: string, remoteJson: string): boolean {
  const l = readAiConfigField(localJson);
  const r = readAiConfigField(remoteJson);
  if (r.present && !r.payload) return false;
  if (r.present && isObj(r.raw) && r.raw.includeKeys !== true && "keys" in r.raw) return true;
  return JSON.stringify(l.payload) !== JSON.stringify(r.payload);
}

/* ---------- merging two payloads (mergeBackups) ---------- */

/** 0: config sync off, 1: keys off, 2: keys on. On a policyRev tie the lower one (switching off) wins. */
const payloadRank = (p: AiSyncPayload) => (!p.enabled ? 0 : !p.includeKeys ? 1 : 2);

function remotePolicyWins(l: AiSyncPayload, r: AiSyncPayload): boolean {
  if (l.policyRev !== r.policyRev) return r.policyRev > l.policyRev;
  return payloadRank(r) <= payloadRank(l);
}

function orderedLastGood(m: Partial<Record<TextProvider, string>>): Partial<Record<TextProvider, string>> {
  const out: Partial<Record<TextProvider, string>> = {};
  for (const p of TEXT_PROVIDERS) if (m[p]) out[p] = m[p];
  return out;
}

/** Per slot, the higher revision wins (even when it is an explicit clear ""); on a tie a non-empty value wins. */
function mergeKeySets(
  local: { keys: SyncedAiKeys; keyRevs: KeyRevs },
  remote: { keys: SyncedAiKeys; keyRevs: KeyRevs },
): { keys: SyncedAiKeys; keyRevs: KeyRevs } {
  const keys = {} as SyncedAiKeys;
  const keyRevs: KeyRevs = {};
  for (const slot of CREDENTIAL_SLOTS) {
    const lr = local.keyRevs[slot] ?? 0;
    const rr = remote.keyRevs[slot] ?? 0;
    const lv = local.keys[slot] ?? "";
    const rv = remote.keys[slot] ?? "";
    keys[slot] = rr > lr ? rv : lr > rr ? lv : rv || lv;
    const m = Math.max(lr, rr);
    if (m > 0) keyRevs[slot] = m;
  }
  return { keys, keyRevs };
}

/** Merge the `aiConfig` of two backups: policy by policyRev, config by configRev, keys slot by slot. */
export function mergeAiSyncPayloads(local: AiSyncPayload | null, remote: AiSyncPayload | null): AiSyncPayload | null {
  if (!remote) return local;
  if (!local) return remote;
  const winner = remotePolicyWins(local, remote) ? remote : local;
  if (!winner.enabled) return { version: 1, enabled: false, includeKeys: false, policyRev: winner.policyRev };
  const lc = local.enabled ? local : null;
  const rc = remote.enabled ? remote : null;
  let config: NonSensitiveAiConfig;
  let configRev: number;
  if (lc && rc) {
    const takeLocal = lc.configRev > rc.configRev;
    const chosen = takeLocal ? lc : rc;
    const other = takeLocal ? rc : lc;
    config = { ...chosen.config, lastGoodModel: orderedLastGood({ ...other.config.lastGoodModel, ...chosen.config.lastGoodModel }) };
    configRev = Math.max(lc.configRev, rc.configRev);
  } else {
    const only = (lc ?? rc)!;
    config = only.config;
    configRev = only.configRev;
  }
  if (!winner.includeKeys) {
    return { version: 1, enabled: true, includeKeys: false, policyRev: winner.policyRev, configRev, config };
  }
  const sides = [local, remote].filter((x): x is AiSyncConfigPayload => x.enabled && x.includeKeys && !!x.keys);
  const ks = (x: AiSyncConfigPayload) => ({ keys: orderedKeys(x.keys!), keyRevs: x.keyRevs ?? {} });
  const merged = sides.length === 2 ? mergeKeySets(ks(sides[0]), ks(sides[1])) : sides.length === 1 ? ks(sides[0]) : { keys: orderedKeys({} as SyncedAiKeys), keyRevs: {} };
  return { version: 1, enabled: true, includeKeys: true, policyRev: winner.policyRev, configRev, config, keys: merged.keys, keyRevs: orderedKeyRevs(merged.keyRevs) };
}

/* ---------- applying a received payload to this device ---------- */

const GUARD_SLOT: Record<UnconfirmedEndpointKind, CredentialSlot> = { openai: "openai", gemini: "gemini", stt: "stt" };
const guardBase = (c: AiConfig, kind: UnconfirmedEndpointKind) => (kind === "openai" ? c.openaiBaseUrl : kind === "gemini" ? c.geminiBaseUrl : c.stt.baseUrl);

/**
 * A custom base URL changed by sync while this device keeps its own key for it (not one delivered together with the
 * URL) must be confirmed before that key is sent there.
 */
function updateEndpointGuards(before: AiConfig, after: AiConfig, deliveredKeys: SyncedAiKeys | null): void {
  const cur = { ...getUnconfirmedBaseUrls() };
  for (const kind of UNCONFIRMED_ENDPOINT_KINDS) {
    const slot = GUARD_SLOT[kind];
    const prevBase = guardBase(before, kind);
    const nextBase = guardBase(after, kind);
    const prevKey = credentialOf(before, slot);
    const nextKey = credentialOf(after, slot);
    const keyDelivered = !!nextKey && !!deliveredKeys && deliveredKeys[slot] === nextKey;
    if (nextBase !== prevBase) {
      if (nextBase && nextKey && !keyDelivered) cur[kind] = nextBase;
      else delete cur[kind];
    } else if (keyDelivered && nextKey !== prevKey) {
      delete cur[kind];
    }
  }
  setUnconfirmedBaseUrls(cur);
}

/** Apply the non-sensitive config of `incoming` when it is not older than this device's (or unconditionally on adopt-remote). */
function applyConfigPart(cfg: AiConfig, incoming: AiSyncConfigPayload, next: AiSyncPrefs, mode: AiApplyMode): AiConfig {
  const l = next.configRev;
  const r = incoming.configRev;
  if (mode !== "adopt-remote" && r < l) return cfg;
  const ns: NonSensitiveAiConfig =
    mode === "merge"
      ? { ...incoming.config, lastGoodModel: orderedLastGood({ ...toNonSensitiveAiConfig(cfg).lastGoodModel, ...incoming.config.lastGoodModel }) }
      : incoming.config;
  next.configRev = mode === "adopt-remote" ? r : Math.max(l, r);
  return withNonSensitiveAiConfig(cfg, ns);
}

/** Apply the credential slots of `incoming` slot by slot (see mergeKeySets; fast-forward and adopt-remote take the remote on ties). */
function applyKeysPart(cfg: AiConfig, localRevs: KeyRevs, incoming: AiSyncConfigPayload, mode: AiApplyMode): { cfg: AiConfig; keyRevs: KeyRevs } {
  const rk = incoming.keys ?? orderedKeys({} as SyncedAiKeys);
  const rr = incoming.keyRevs ?? {};
  let out = cfg;
  const keyRevs: KeyRevs = { ...localRevs };
  for (const slot of CREDENTIAL_SLOTS) {
    const lRev = localRevs[slot] ?? 0;
    const rRev = rr[slot] ?? 0;
    const lv = credentialOf(out, slot);
    const rv = rk[slot] ?? "";
    let v = lv;
    if (mode === "adopt-remote" || rRev > lRev) v = rv;
    else if (rRev === lRev) v = mode === "fast-forward" ? rv : rv || lv;
    if (v !== lv) out = withCredential(out, slot, v);
    const m = mode === "adopt-remote" ? rRev : Math.max(lRev, rRev);
    if (m > 0) keyRevs[slot] = m;
    else delete keyRevs[slot];
  }
  return { cfg: out, keyRevs };
}

function isCurrentSyncLegacyAuth(): boolean {
  const s = getSyncState();
  return !!s.code && (!!s.legacyAuth || s.authVersion === 1);
}

/**
 * Apply a received (decrypted, verified) `aiConfig` to this device: settings, keys and prefs. `fast-forward` is used
 * when this device changed nothing since the last sync; `merge` for a first pairing or a merged payload; `adopt-remote`
 * when the learner explicitly chose 仅用云端 in the conflict sheet.
 * With `policyOnly`, only a newer remote "switch off" is adopted (history restore).
 * Local keys are never cleared by a remote that does not share keys.
 */
export function applyIncomingAiSync(incoming: AiSyncPayload | null, mode: AiApplyMode, opts?: { policyOnly?: boolean }): void {
  const p = prefs;
  const before = getAiConfig();
  if (!incoming) {
    if (mode === "adopt-remote") {
      const cfg = withNonSensitiveAiConfig(before, toNonSensitiveAiConfig(defaultAiConfig()));
      updateEndpointGuards(before, cfg, null);
      if (JSON.stringify(cfg) !== JSON.stringify(before)) applySyncedAiConfig(cfg);
      commit({ ...defaultAiSyncPrefs(), accountFp: p.accountFp });
    }
    return;
  }
  const localRank = p.configPolicy === "disabled" ? 0 : p.keyPolicy === "disabled" ? 1 : p.keyPolicy === "enabled" ? 2 : null;
  const remoteWins =
    mode === "adopt-remote" ||
    incoming.policyRev > p.policyRev ||
    (incoming.policyRev === p.policyRev && (localRank === null || payloadRank(incoming) <= localRank));
  // a history restore only catches up with a newer "switch off"; it never switches anything on
  if (opts?.policyOnly && (!remoteWins || (incoming.enabled && (incoming.includeKeys || p.configPolicy === "disabled")))) return;

  const next: AiSyncPrefs = { ...p, keyRevs: { ...p.keyRevs } };
  let cfg = before;
  let delivered: SyncedAiKeys | null = null;
  const legacy = isCurrentSyncLegacyAuth();

  if (remoteWins) {
    next.policyRev = mode === "adopt-remote" ? incoming.policyRev : Math.max(p.policyRev, incoming.policyRev);
    next.syncedPolicyRev = mode === "adopt-remote" ? incoming.policyRev : Math.max(p.syncedPolicyRev, incoming.policyRev);
    next.lastSwitchAction = undefined;
    if (!incoming.enabled) {
      next.configPolicy = "disabled";
      next.keyPolicy = "disabled";
      next.passthroughKeys = null;
      commit(next);
      return;
    }
    if (p.configPolicy === "disabled" || mode === "adopt-remote") {
      next.configPolicy = "enabled";
      if (next.keyPolicy === "disabled" && incoming.includeKeys) next.keyPolicy = "unset";
    }
    if (!incoming.includeKeys) {
      if (p.keyPolicy === "enabled" || p.passthroughKeys || mode === "adopt-remote") {
        next.keyPolicy = incoming.policyRev > 0 ? "disabled" : mode === "adopt-remote" ? "unset" : p.keyPolicy;
        next.passthroughKeys = null;
      }
      if (!opts?.policyOnly) cfg = applyConfigPart(cfg, incoming, next, mode);
    } else {
      cfg = applyConfigPart(cfg, incoming, next, mode);
      const rk = incoming.keys ?? orderedKeys({} as SyncedAiKeys);
      const hasPrivate =
        p.keyPolicy !== "enabled" &&
        CREDENTIAL_SLOTS.some((slot) => {
          const v = credentialOf(before, slot);
          return v !== "" && v !== rk[slot] && v !== (p.passthroughKeys?.keys[slot] ?? "");
        });
      if (legacy) {
        // never auto-enable or carry passthrough keys on a legacy non-zero-knowledge account
        next.keyPolicy = p.keyPolicy === "enabled" ? "enabled" : "unset";
        next.passthroughKeys = null;
        for (const slot of CREDENTIAL_SLOTS) {
          if (!credentialOf(cfg, slot) && rk[slot]) cfg = withCredential(cfg, slot, rk[slot]);
        }
      } else if (!hasPrivate) {
        next.configPolicy = "enabled";
        next.keyPolicy = "enabled";
        next.passthroughKeys = null;
        const applied = applyKeysPart(cfg, p.keyRevs, incoming, mode);
        cfg = applied.cfg;
        next.keyRevs = applied.keyRevs;
      } else {
        // never mark this device's private keys as shared: keep them, use the shared ones only where empty
        next.keyPolicy = "unset";
        next.passthroughKeys = { keys: orderedKeys(rk), keyRevs: orderedKeyRevs(incoming.keyRevs ?? {}) };
        for (const slot of CREDENTIAL_SLOTS) {
          if (!credentialOf(cfg, slot) && rk[slot]) cfg = withCredential(cfg, slot, rk[slot]);
        }
      }
      delivered = rk;
    }
  } else {
    // this device's policy is newer: the remote config may still be newer, its keys count only where this device shares
    if (p.configPolicy === "disabled" || !incoming.enabled || opts?.policyOnly) return;
    cfg = applyConfigPart(cfg, incoming, next, mode);
    if (incoming.includeKeys && incoming.keys) {
      if (p.keyPolicy === "enabled" && !legacy) {
        const applied = applyKeysPart(cfg, p.keyRevs, incoming, mode);
        cfg = applied.cfg;
        next.keyRevs = applied.keyRevs;
        delivered = incoming.keys;
      } else if (p.keyPolicy === "unset" && p.passthroughKeys && !legacy) {
        const merged = mergeKeySets(p.passthroughKeys, { keys: incoming.keys, keyRevs: incoming.keyRevs ?? {} });
        next.passthroughKeys = { keys: merged.keys, keyRevs: orderedKeyRevs(merged.keyRevs) };
        for (const slot of CREDENTIAL_SLOTS) {
          if (!credentialOf(cfg, slot) && merged.keys[slot]) cfg = withCredential(cfg, slot, merged.keys[slot]);
        }
        delivered = merged.keys;
      }
    }
  }

  updateEndpointGuards(before, cfg, delivered);
  if (JSON.stringify(cfg) !== JSON.stringify(before)) applySyncedAiConfig(cfg);
  commit(next);
}

/**
 * Before a history restore uploads over `latest`: adopt any newer "switch off" in `latest`, and when this device carries
 * the account's shared keys through (`passthroughKeys`), refresh them from `latest` so rotated or cleared shared slots
 * are never rolled back to an older cached copy.
 */
export function refreshAiPolicyAndPassthroughFromLatest(latest: AiSyncPayload | null): void {
  applyIncomingAiSync(latest, "fast-forward", { policyOnly: true });
  const p = prefs;
  if (p.configPolicy === "disabled" || p.keyPolicy !== "unset" || !latest || !latest.enabled || !latest.includeKeys) return;
  if (isCurrentSyncLegacyAuth()) {
    if (p.passthroughKeys) commit({ ...p, passthroughKeys: null });
    return;
  }
  if (p.passthroughKeys) {
    commit({
      ...p,
      policyRev: Math.max(p.policyRev, latest.policyRev),
      syncedPolicyRev: Math.max(p.syncedPolicyRev, latest.policyRev),
      passthroughKeys: {
        keys: orderedKeys(latest.keys ?? ({} as SyncedAiKeys)),
        keyRevs: orderedKeyRevs(latest.keyRevs ?? {}),
      },
    });
  }
}

/**
 * Restore the AI settings of a history snapshot under the policy in force now: nothing when config sync is off;
 * the non-sensitive config otherwise (this device's keys kept); keys only when key sync is on, and then only the
 * slots the snapshot has a value for. The restore counts as a new edit, newer than `latest` (the cloud's current one).
 */
export function restoreAiConfigFromHistory(hist: AiSyncPayload | null, latest: AiSyncPayload | null): void {
  const p = prefs;
  if (p.configPolicy === "disabled" || !hist || !hist.enabled) return;
  const before = getAiConfig();
  const next: AiSyncPrefs = { ...p, keyRevs: { ...p.keyRevs } };
  let cfg = withNonSensitiveAiConfig(before, hist.config);
  const latestConfigRev = latest?.enabled ? latest.configRev : 0;
  if (!nonSensitiveAiConfigEquals(toNonSensitiveAiConfig(cfg), toNonSensitiveAiConfig(before)) || latestConfigRev > p.configRev) {
    next.configRev = Math.min(MAX_REV, Math.max(p.configRev, latestConfigRev) + 1);
  }
  let delivered: SyncedAiKeys | null = null;
  if (p.keyPolicy === "enabled" && hist.includeKeys && hist.keys) {
    const latestRevs = latest?.enabled && latest.includeKeys ? (latest.keyRevs ?? {}) : {};
    for (const slot of CREDENTIAL_SLOTS) {
      const v = hist.keys[slot];
      if (!v || v === credentialOf(cfg, slot)) continue;
      cfg = withCredential(cfg, slot, v);
      next.keyRevs[slot] = Math.min(MAX_REV, Math.max(p.keyRevs[slot] ?? 0, latestRevs[slot] ?? 0) + 1);
    }
    delivered = hist.keys;
  }
  updateEndpointGuards(before, cfg, delivered);
  if (JSON.stringify(cfg) !== JSON.stringify(before)) applySyncedAiConfig(cfg);
  commit(next);
}

/**
 * Whether a payload's AI part alone is worth an upload / counts as "progress" (lets a device with no words yet but a
 * configured AI create the first cloud archive): a switched-off policy, shared keys, or a changed config.
 */
export function aiPayloadCountsAsProgress(raw: unknown): boolean {
  const p = parseAiSyncPayload(raw);
  if (!p) return false;
  if (!p.enabled) return p.policyRev > 0;
  if (p.includeKeys && (p.policyRev > 0 || CREDENTIAL_SLOTS.some((s) => !!p.keys?.[s]))) return true;
  return p.configRev > 0 || !nonSensitiveAiConfigEquals(p.config, toNonSensitiveAiConfig(defaultAiConfig()));
}

/** Test helper: replace the prefs (persisted like a real change). */
export function setAiSyncPrefsForTest(patch: Partial<AiSyncPrefs>): void {
  commit({ ...prefs, ...patch });
}
