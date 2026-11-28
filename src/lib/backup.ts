/**
 * Shared backup download and 7-day reminder snooze helpers used across App, Today and Me.
 */
import { isNative, shareFileNative } from "./native";
import { dayKey, exportBackupAsync, markBackupExported } from "../store/store";
import type { SyncState } from "../sync/state";
import { toast } from "../ui/Toast";

const SNOOZE_KEY = "fb2.backup.snooze";
const SEVEN_DAYS_MS = 7 * 86_400_000;

export function cloudSyncHealthy(sync: Pick<SyncState, "code" | "lastOkAt">, now = Date.now()): boolean {
  return !!sync.code && typeof sync.lastOkAt === "number" && Number.isFinite(sync.lastOkAt) && now - sync.lastOkAt < SEVEN_DAYS_MS;
}

export function isBackupSnoozedToday(): boolean {
  try {
    return localStorage.getItem(SNOOZE_KEY) === dayKey();
  } catch {
    return false;
  }
}

export function snoozeBackupToday(): void {
  try {
    localStorage.setItem(SNOOZE_KEY, dayKey());
  } catch {
    /* ignore */
  }
}

/**
 * Make a JSON text safe to save as a file: a top-level `aiConfig` (the cloud sync payload, which may carry API keys)
 * is removed. Arrays (e.g. the dictionary reports export) and objects without it pass through as they are. Text
 * that mentions `aiConfig` but cannot be parsed is refused (null) rather than written out unchecked.
 */
export function sanitizeBackupJsonForDownload(json: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return json.includes("aiConfig") ? null : json;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !("aiConfig" in parsed)) return json;
  const { aiConfig: _drop, ...rest } = parsed as Record<string, unknown>;
  void _drop;
  return JSON.stringify(rest, null, 1);
}

export async function downloadRawBackupFile(json: string, name: string, successToast = "已导出备份文件"): Promise<void> {
  const safe = sanitizeBackupJsonForDownload(json);
  if (safe === null) {
    toast("这份数据格式异常，为保护 API Key 已取消导出", "warn");
    return;
  }
  const blob = new Blob([safe], { type: "application/json" });
  if (isNative()) {
    try {
      await shareFileNative(blob, name, "学习备份");
    } catch {
      toast("备份导出失败，请稍后再试", "warn");
    }
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  toast(successToast, "ok");
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function downloadBackupFile(): Promise<void> {
  const json = await exportBackupAsync();
  const blob = new Blob([json], { type: "application/json" });
  const name = `atlas-du-francais-backup-${dayKey()}.json`;
  if (isNative()) {
    try {
      await shareFileNative(blob, name, "学习备份");
      markBackupExported();
    } catch {
      toast("备份导出失败，请稍后再试", "warn");
    }
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  markBackupExported();
  toast("已导出完整备份（含词汇、作文、阅读、题库与草稿）", "ok");
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
