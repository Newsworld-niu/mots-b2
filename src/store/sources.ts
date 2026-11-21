/** 真实材料精听: the learner's recordings on other sites, kept with the progress (and so in backups). */
import { MAX_SOURCES, MAX_TRANSCRIPT, type RealSource } from "../lib/listening";
import { store } from "./store";

const rid = () => `s-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function addSource(input: Pick<RealSource, "title" | "url" | "start" | "end"> & { transcript?: string }): string {
  const id = rid();
  const transcript = input.transcript?.replace(/\r/g, "").trim().slice(0, MAX_TRANSCRIPT);
  const s: RealSource = { id, title: input.title.trim().slice(0, 120) || input.url.slice(0, 120), url: input.url.trim(), start: input.start, end: Math.max(input.start, input.end), created: Date.now(), ...(transcript ? { transcript } : {}) };
  store.progress((p) => ({ ...p, listenSources: [s, ...(p.listenSources ?? [])].slice(0, MAX_SOURCES) }));
  return id;
}

export function patchSource(id: string, patch: Partial<Pick<RealSource, "title" | "transcript" | "notes" | "done" | "start" | "end">>) {
  store.progress((p) => ({
    ...p,
    listenSources: (p.listenSources ?? []).map((s) => (s.id === id ? { ...s, ...patch, ...(patch.transcript !== undefined ? { transcript: patch.transcript.slice(0, MAX_TRANSCRIPT) || undefined } : {}) } : s)),
  }));
}

export function deleteSource(id: string) {
  store.progress((p) => {
    const listenSources = (p.listenSources ?? []).filter((s) => s.id !== id);
    const { listenSources: _old, ...rest } = p;
    return listenSources.length ? { ...rest, listenSources } : rest;
  });
}
