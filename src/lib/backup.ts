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

export async function downloadRawBackupFile(json: string, name: string, successToast = "已导出备份文件"): Promise<void> {
  const blob = new Blob([json], { type: "application/json" });
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
