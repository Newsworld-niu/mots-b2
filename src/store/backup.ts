import { reloadBank } from "./exam-bank";
import { getImages, isImageDataUrl, readAllImagesIdb, replaceImages, waitImagesLoaded } from "./images";
import { isObj, sanitizeProgress, sanitizeSettings } from "./sanitize";
import { WORD_ID, type Progress, type Settings, type State } from "./types";
import {
  collectEssayDrafts,
  collectEssayDraftsAt,
  readExamBankBackup,
  restoreEssayDrafts,
  restoreExamBankBackup,
  type ExamBankBackup,
  type PutHeavyOptions,
} from "./vault";

export interface BackupHost {
  getState: () => State;
  setState: (next: State) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  flush: (opts?: { skipHeavy?: boolean }) => void;
  emit: () => void;
  markDirty: (kind?: "progress" | "settings" | "all") => void;
  hydrateVault: (datasetId: string) => Promise<void>;
  waitHeavyWrite: (datasetId: string) => Promise<boolean> | undefined;
  queueHeavySave: (p: Progress, opts?: PutHeavyOptions) => Promise<boolean>;
}

export function parseImportPayload(
  data: Record<string, unknown>,
  datasetId: string,
): { progress: Progress; settings: Settings; imgs: Record<string, string>; examBank: unknown } {
  const progress = sanitizeProgress({ ...((data.progress as Record<string, unknown>) ?? {}), session: null }, datasetId);
  const settings = { ...sanitizeSettings(data.settings), onboarded: true };
  const imgs: Record<string, string> = {};
  if (isObj(data.images)) {
    for (const [k, v] of Object.entries(data.images)) {
      if (WORD_ID.test(k) && isImageDataUrl(v)) imgs[k] = v;
    }
  }
  restoreEssayDrafts(isObj(data.essayDrafts) ? data.essayDrafts : {}, undefined, isObj(data.essayDraftsAt) ? data.essayDraftsAt : undefined);
  return { progress, settings, imgs, examBank: isObj(data.examBank) ? data.examBank : { papers: [], attempts: {} } };
}

export function createBackupActions(host: BackupHost) {
  function markBackupExported(now = Date.now()) {
    host.updateSettings({ lastBackupAt: now });
    host.flush();
  }

  function exportBackup(extra?: {
    examBank?: ExamBankBackup | null;
    essayDrafts?: Record<string, string>;
    essayDraftsAt?: Record<string, number>;
    images?: Record<string, string>;
  }) {
    host.flush();
    const { progress, settings } = host.getState();
    const images = extra?.images ?? getImages();
    const essayDrafts = extra?.essayDrafts ?? collectEssayDrafts();
    const essayDraftsAt = extra?.essayDraftsAt ?? (extra?.essayDrafts ? undefined : collectEssayDraftsAt());
    return JSON.stringify(
      {
        app: "word-atlas",
        version: 2,
        exported: new Date().toISOString(),
        progress: { ...progress, session: null },
        settings,
        ...(Object.keys(images).length ? { images } : {}),
        ...(Object.keys(essayDrafts).length ? { essayDrafts } : {}),
        ...(essayDraftsAt && Object.keys(essayDraftsAt).length ? { essayDraftsAt } : {}),
        ...(extra?.examBank ? { examBank: extra.examBank } : {}),
      },
      null,
      1,
    );
  }

  async function exportBackupAsync(): Promise<string> {
    const datasetId = host.getState().progress.datasetId;
    await Promise.all([host.hydrateVault(datasetId), waitImagesLoaded()]);
    const pending = host.waitHeavyWrite(datasetId);
    if (pending) await pending;
    const [examBank, images] = await Promise.all([readExamBankBackup(), readAllImagesIdb()]);
    return exportBackup({ examBank, essayDrafts: collectEssayDrafts(), essayDraftsAt: collectEssayDraftsAt(), images });
  }

  function validateBackupJson(text: string): { ok: true; data: Record<string, unknown>; datasetId: string } | { ok: false; error: string } {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, error: "文件不是有效的 JSON。" };
    }
    if (!isObj(data) || data.app !== "word-atlas" || data.version !== 2 || !isObj(data.progress)) {
      return { ok: false, error: "这不是法语词光的学习备份。" };
    }
    const id = host.getState().progress.datasetId;
    if (data.progress.datasetId !== id) {
      return { ok: false, error: "备份来自另一个词库，请先切换到对应词库。" };
    }
    return { ok: true, data, datasetId: id };
  }

  function importBackup(text: string): { ok: true; cards: number } | { ok: false; error: string } {
    const parsed = validateBackupJson(text);
    if (!parsed.ok) return parsed;
    const { progress, settings, imgs, examBank } = parseImportPayload(parsed.data, parsed.datasetId);
    host.setState({ ...host.getState(), progress, settings });
    void replaceImages(imgs);
    void restoreExamBankBackup(examBank).then((ok) => ok && void reloadBank());
    if (typeof indexedDB !== "undefined") void host.queueHeavySave(progress, { clear: true });
    host.emit();
    host.markDirty("all");
    host.flush({ skipHeavy: true });
    return { ok: true, cards: Object.keys(progress.cards).length };
  }

  async function importBackupAsync(text: string): Promise<{ ok: true; cards: number } | { ok: false; error: string }> {
    const parsed = validateBackupJson(text);
    if (!parsed.ok) return parsed;
    const { progress, settings, imgs, examBank } = parseImportPayload(parsed.data, parsed.datasetId);
    host.setState({ ...host.getState(), progress, settings });
    const ops: Promise<unknown>[] = [
      replaceImages(imgs),
      restoreExamBankBackup(examBank).then((ok) => (ok ? reloadBank() : undefined)),
    ];
    if (typeof indexedDB !== "undefined") ops.push(host.queueHeavySave(progress, { clear: true }));
    await Promise.all(ops);
    host.emit();
    host.markDirty("all");
    host.flush({ skipHeavy: true });
    return { ok: true, cards: Object.keys(progress.cards).length };
  }

  return {
    markBackupExported,
    exportBackup,
    exportBackupAsync,
    importBackup,
    importBackupAsync,
  };
}
