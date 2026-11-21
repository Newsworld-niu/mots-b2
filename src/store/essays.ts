/** 篇章写作: the learner's texts and their marking, kept with the progress (and so in backups), newest first. */
import { MAX_AI_TASKS, MAX_ESSAY_LENGTH, MAX_ESSAYS, MAX_NOTES, type EssayCorrection, type EssayFeedback, type EssayTask, type ModelEssay, type Revision, type SavedEssay, type SavedNote } from "../lib/essay";
import { MAX_SPEAK_CORRECTIONS, store, type Progress, type SavedSpeakingCorrection } from "./store";

const rid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Save a text (or replace the one with this id); the oldest beyond MAX_ESSAYS are dropped. Returns its id. */
export function saveEssay(input: { id?: string; task: string; text: string; fb?: EssayFeedback }): string {
  const id = input.id ?? `e-${rid()}`;
  const essay: SavedEssay = { id, task: input.task, text: input.text.replace(/\r/g, "").trim().slice(0, MAX_ESSAY_LENGTH), created: Date.now(), ...(input.fb ? { fb: input.fb } : {}) };
  store.progress((p) => ({ ...p, essays: [essay, ...(p.essays ?? []).filter((e) => e.id !== id)].slice(0, MAX_ESSAYS) }));
  return id;
}

/** Add to a saved essay: its second draft, or a model text. */
export function patchEssay(id: string, patch: { rev?: Revision; model?: ModelEssay }) {
  store.progress((p) => ({ ...p, essays: (p.essays ?? []).map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
}

/** Keep a task the AI wrote. */
export function saveAiTask(task: EssayTask) {
  store.progress((p) => ({ ...p, essayTasks: [task, ...(p.essayTasks ?? []).filter((t) => t.id !== task.id)].slice(0, MAX_AI_TASKS) }));
}

/** Drop an AI task; the texts written for it stay in 写过的. */
export function deleteAiTask(id: string) {
  store.progress((p) => {
    const essayTasks = (p.essayTasks ?? []).filter((t) => t.id !== id);
    const { essayTasks: _old, ...rest } = p;
    void _old;
    return essayTasks.length ? { ...rest, essayTasks } : rest;
  });
}

/** Keep one mistake from a marking in the 错句本 (once: the same wrong and right wording is not added twice). */
export function saveNote(n: Omit<SavedNote, "id" | "at">): boolean {
  const have = store.get().progress.essayNotes ?? [];
  if (have.some((x) => x.wrong === n.wrong && x.right === n.right)) return false;
  const note: SavedNote = { ...n, id: `n-${rid()}`, at: Date.now() };
  store.progress((p) => ({ ...p, essayNotes: [note, ...(p.essayNotes ?? [])].slice(0, MAX_NOTES) }));
  return true;
}

export function deleteNote(id: string) {
  store.progress((p) => {
    const essayNotes = (p.essayNotes ?? []).filter((n) => n.id !== id);
    const { essayNotes: _old, ...rest } = p;
    void _old;
    return essayNotes.length ? { ...rest, essayNotes } : rest;
  });
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

/** Pure helper to prepend valid speaking marking corrections into Progress. */
export function recordSpeakingCorrections(
  p: Progress,
  subject: string,
  corrections: EssayCorrection[],
  id = `sp-${rid()}`,
  at = Date.now(),
): { next: Progress; id: string } | null {
  const cleanSubject = subject.trim().slice(0, 80);
  const valid = corrections
    .map((c) => ({ ...c, wrong: c.wrong.trim().slice(0, 200), right: c.right.trim().slice(0, 200), why: c.why.trim().slice(0, 300) }))
    .filter((c) => (c.wrong || c.right) && c.wrong !== c.right)
    .slice(0, 25);
  if (!cleanSubject || !valid.length) return null;
  const entry: SavedSpeakingCorrection = { id, subject: cleanSubject, at, corrections: valid };
  return { next: { ...p, speakCorrections: [entry, ...(p.speakCorrections ?? [])].slice(0, MAX_SPEAK_CORRECTIONS) }, id };
}

/** Keep line-by-line corrections from a speaking marking so grammar practice cycles them back, newest first. */
export function saveSpeakingCorrections(subject: string, corrections: EssayCorrection[]): string | null {
  const cleanSubject = subject.trim().slice(0, 80);
  if (!cleanSubject || !corrections.some((c) => (c.wrong.trim() || c.right.trim()) && c.wrong.trim() !== c.right.trim())) return null;
  const id = `sp-${rid()}`;
  const at = Date.now();
  store.progress((p) => recordSpeakingCorrections(p, cleanSubject, corrections, id, at)?.next ?? p);
  return id;
}
