import { hasAnyProgress, type Progress } from "../store/store";
import type { BackupSummary } from "./state";

export type PullDecision = "push-create" | "push" | "apply-remote" | "conflict" | "noop";

export type RemotePull =
  | null
  | "not-modified"
  | { hash: string };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Hash a backup JSON payload after stripping its volatile top-level "exported" timestamp. */
export async function canonicalHash(json: string): Promise<string> {
  let normalized = json;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const copy = { ...(parsed as Record<string, unknown>) };
      delete copy.exported;
      normalized = JSON.stringify(copy);
    }
  } catch {
    normalized = json.replace(/"exported"\s*:\s*"[^"]*"\s*,?/, "");
  }
  const bytes = new TextEncoder().encode(normalized);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function collectDayKeys(map: unknown, out: Set<string>): void {
  if (!map || typeof map !== "object" || Array.isArray(map)) return;
  for (const k of Object.keys(map as Record<string, unknown>)) {
    if (DAY_RE.test(k)) out.add(k);
  }
}

export function summarizeBackup(json: string): BackupSummary {
  const empty: BackupSummary = { exported: null, cards: 0, essays: 0, texts: 0, lastDay: null };
  try {
    const data = JSON.parse(json) as Record<string, unknown>;
    if (!data || typeof data !== "object" || Array.isArray(data)) return empty;
    const exported = typeof data.exported === "string" && data.exported ? data.exported : null;
    const progress = data.progress;
    if (!progress || typeof progress !== "object" || Array.isArray(progress)) {
      return { ...empty, exported };
    }
    const p = progress as Record<string, unknown>;
    const cards = p.cards && typeof p.cards === "object" && !Array.isArray(p.cards) ? Object.keys(p.cards).length : 0;
    const essays = Array.isArray(p.essays) ? p.essays.length : 0;
    const texts = Array.isArray(p.texts) ? p.texts.length : 0;
    const dayKeys = new Set<string>();
    collectDayKeys(p.days, dayKeys);
    collectDayKeys(p.conjDays, dayKeys);
    collectDayKeys(p.gramDays, dayKeys);
    collectDayKeys(p.drillDays, dayKeys);
    const lastDay = dayKeys.size ? [...dayKeys].sort().pop() ?? null : null;
    return { exported, cards, essays, texts, lastDay };
  } catch {
    return empty;
  }
}

export function hasBackupProgress(json: string): boolean {
  try {
    const data = JSON.parse(json) as Record<string, unknown>;
    if (!data || typeof data !== "object" || Array.isArray(data)) return false;
    if (!data.progress || typeof data.progress !== "object" || Array.isArray(data.progress)) return false;
    return hasAnyProgress(data.progress as Progress);
  } catch {
    return false;
  }
}

export function decidePull({
  localHash,
  lastSyncedHash,
  localHasProgress,
  remote,
}: {
  localHash: string;
  lastSyncedHash: string | null;
  localHasProgress: boolean;
  remote: RemotePull;
}): PullDecision {
  if (remote === null) {
    return localHasProgress ? "push-create" : "noop";
  }
  if (remote === "not-modified") {
    if (lastSyncedHash !== null && localHash === lastSyncedHash) return "noop";
    return localHasProgress || lastSyncedHash !== null ? "push" : "noop";
  }
  if (localHash === remote.hash) {
    return "noop";
  }
  if (lastSyncedHash === null) {
    return localHasProgress ? "conflict" : "apply-remote";
  }
  if (localHash === lastSyncedHash) {
    return "apply-remote";
  }
  if (remote.hash === lastSyncedHash) {
    return "push";
  }
  return "conflict";
}
