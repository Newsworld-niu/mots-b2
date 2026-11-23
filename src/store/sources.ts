/** 真实材料精听: recordings on external sites, bundled RFI broadcasts, or locally imported MP3/PDF files. */
import { MAX_SOURCES, MAX_TRANSCRIPT, SOURCE_ID, type RealSource } from "../lib/listening";
import { appendExamLog } from "./essays";
import { deleteRealMediaForSource } from "./real-media";
import { clearTombstone, markTombstone, store } from "./store";

export const newSourceId = () => `s-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function addSource(
  input: Pick<RealSource, "title" | "url" | "start" | "end"> & { id?: string; transcript?: string; pdfUrl?: string; presetId?: string },
): string {
  const id = input.id && SOURCE_ID.test(input.id) ? input.id : newSourceId();
  const transcript = input.transcript?.replace(/\r/g, "").trim().slice(0, MAX_TRANSCRIPT);
  const s: RealSource = {
    id,
    title: input.title.trim().slice(0, 120) || input.url.slice(0, 120),
    url: input.url.trim(),
    ...(input.pdfUrl ? { pdfUrl: input.pdfUrl.trim() } : {}),
    ...(input.presetId ? { presetId: input.presetId } : {}),
    start: input.start,
    end: Math.max(input.start, input.end),
    created: Date.now(),
    ...(transcript ? { transcript } : {}),
  };
  store.progress((p) => clearTombstone({ ...p, listenSources: [s, ...(p.listenSources ?? []).filter((x) => x.id !== id)].slice(0, MAX_SOURCES) }, `source:${id}`));
  return id;
}

/** Open or add a bundled RFI / official preset into the learner's list without discarding existing notes/progress. */
export function ensurePresetSource(preset: RealSource): string {
  const existing = (store.get().progress.listenSources ?? []).find((s) => s.presetId === preset.presetId || s.id === preset.id);
  if (existing) return existing.id;
  return addSource({
    id: preset.id,
    title: preset.title,
    url: preset.url,
    pdfUrl: preset.pdfUrl,
    presetId: preset.presetId,
    start: preset.start,
    end: preset.end,
    transcript: preset.transcript,
  });
}

export function patchSource(id: string, patch: Partial<Pick<RealSource, "title" | "transcript" | "notes" | "done" | "start" | "end" | "pdfUrl">>) {
  store.progress((p) => ({
    ...p,
    listenSources: (p.listenSources ?? []).map((s) =>
      s.id === id ? { ...s, ...patch, ...(patch.transcript !== undefined ? { transcript: patch.transcript.slice(0, MAX_TRANSCRIPT) || undefined } : {}) } : s,
    ),
  }));
}

export function recordRealListenScore(what: string, score: number, total: number) {
  if (total <= 0) return;
  store.progress((p) => appendExamLog(p, { part: "listen", what, score, total, scope: "real" }));
}

export function deleteSource(id: string) {
  store.progress((p) => {
    const listenSources = (p.listenSources ?? []).filter((s) => s.id !== id);
    const { listenSources: _old, ...rest } = p;
    return markTombstone(listenSources.length ? { ...rest, listenSources } : rest, `source:${id}`);
  });
  void deleteRealMediaForSource(id);
}
