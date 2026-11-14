/** 篇章写作: the learner's texts and their marking, kept with the progress (and so in backups), newest first. */
import { MAX_ESSAY_LENGTH, MAX_ESSAYS, type EssayFeedback, type SavedEssay } from "../lib/essay";
import { store } from "./store";

const rid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Save a text (or replace the one with this id); the oldest beyond MAX_ESSAYS are dropped. Returns its id. */
export function saveEssay(input: { id?: string; task: string; text: string; fb?: EssayFeedback }): string {
  const id = input.id ?? `e-${rid()}`;
  const essay: SavedEssay = { id, task: input.task, text: input.text.replace(/\r/g, "").trim().slice(0, MAX_ESSAY_LENGTH), created: Date.now(), ...(input.fb ? { fb: input.fb } : {}) };
  store.progress((p) => ({ ...p, essays: [essay, ...(p.essays ?? []).filter((e) => e.id !== id)].slice(0, MAX_ESSAYS) }));
  return id;
}

export function deleteEssay(id: string) {
  store.progress((p) => {
    const essays = (p.essays ?? []).filter((e) => e.id !== id);
    const { essays: _old, ...rest } = p;
    return essays.length ? { ...rest, essays } : rest;
  });
}

/** Note a result of 听力理解、应试阅读 or 口语. */
export function logExam(r: Omit<import("../lib/exam").ExamResult, "at">) {
  store.progress((p) => ({ ...p, examLog: [{ ...r, at: Date.now() }, ...(p.examLog ?? [])].slice(0, 60) }));
}
