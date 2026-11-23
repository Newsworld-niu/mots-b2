/** 篇章写作: the learner's texts and their marking, kept with the progress (and so in backups), newest first. */
import { B1_ESSAY_IDS, MAX_AI_TASKS, MAX_ESSAY_LENGTH, MAX_ESSAYS, MAX_NOTES, maxScore, totalScore, type EssayCorrection, type EssayFeedback, type EssayTask, type ModelEssay, type Revision, type SavedEssay, type SavedNote } from "../lib/essay-schema";
import { MAX_EXAM_LOG, MAX_MOCK_RECORDS, MAX_SPEAKING_SESSIONS, sanitizeMockRecords, sanitizeSpeakingSessions, sanitizeWeeklyPlan, type ExamResult, type MockRecord, type SpeakingSession, type WeeklyRemediationPlan } from "../lib/exam-schema";
import { clearTombstone, markTombstone, MAX_SPEAK_CORRECTIONS, store, type Progress, type SavedSpeakingCorrection } from "./store";

const rid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function resolveEssayLevel(p: Progress, taskId: string, level?: "B1" | "B2"): "B1" | "B2" {
  if (level === "B1" || level === "B2") return level;
  if (B1_ESSAY_IDS.has(taskId)) return "B1";
  return p.essayTasks?.find((t) => t.id === taskId)?.level ?? "B2";
}

export function appendExamLog(p: Progress, r: Omit<ExamResult, "at">, at = Date.now()): Progress {
  return { ...p, examLog: [{ ...r, at }, ...(p.examLog ?? [])].slice(0, MAX_EXAM_LOG) };
}

const normPair = (wrong: string, right: string) =>
  `${wrong.trim().toLowerCase().replace(/\s+/g, " ")}=>${right.trim().toLowerCase().replace(/\s+/g, " ")}`;

/** Automatically collect non-grammar (no linked grammar `point`) corrections into `essayNotes` for FSRS review. */
export function harvestNonGrammarNotes(
  p: Progress,
  from: string,
  corrections: readonly EssayCorrection[] | undefined,
  now = Date.now(),
): Progress {
  if (!corrections?.length) return p;
  const cleanFrom = from.trim().slice(0, 80);
  if (!cleanFrom) return p;
  const existing = p.essayNotes ?? [];
  const seen = new Set(existing.map((n) => normPair(n.wrong, n.right)));
  const added: SavedNote[] = [];
  for (const c of corrections) {
    if (c.point?.trim()) continue;
    const wrong = c.wrong.trim().slice(0, 200);
    const right = c.right.trim().slice(0, 200);
    if (!(wrong || right) || wrong === right) continue;
    const key = normPair(wrong, right);
    if (seen.has(key)) continue;
    seen.add(key);
    added.push({
      id: `n-${rid()}`,
      wrong,
      right,
      type: c.type,
      why: c.why.trim().slice(0, 300),
      point: "",
      at: now,
      from: cleanFrom,
    });
  }
  if (!added.length) return p;
  let next: Progress = { ...p, essayNotes: [...added, ...existing].slice(0, MAX_NOTES) };
  for (const n of added) next = clearTombstone(next, `note:${n.id}`);
  return next;
}

export function applySaveEssay(p: Progress, input: { id?: string; task: string; text: string; fb?: EssayFeedback; level?: "B1" | "B2" }, now = Date.now()): { progress: Progress; id: string } {
  const id = input.id ?? `e-${rid()}`;
  const essay: SavedEssay = { id, task: input.task, text: input.text.replace(/\r/g, "").trim().slice(0, MAX_ESSAY_LENGTH), created: now, ...(input.fb ? { fb: input.fb } : {}) };
  let next: Progress = clearTombstone({ ...p, essays: [essay, ...(p.essays ?? []).filter((e) => e.id !== id)].slice(0, MAX_ESSAYS) }, `essay:${id}`);
  if (input.fb && maxScore(input.fb) > 0) {
    next = appendExamLog(next, { part: "essay", what: input.task, score: totalScore(input.fb), total: maxScore(input.fb), level: resolveEssayLevel(p, input.task, input.level), scope: "full" }, now);
  }
  if (input.fb?.corrections?.length) {
    next = harvestNonGrammarNotes(next, `写作 · ${input.task}`, input.fb.corrections, now);
  }
  return { progress: next, id };
}

export function applyPatchEssay(p: Progress, id: string, patch: { fb?: EssayFeedback; rev?: Revision; model?: ModelEssay; level?: "B1" | "B2" }, now = Date.now()): Progress {
  const existing = (p.essays ?? []).find((e) => e.id === id);
  const { level, ...storedPatch } = patch;
  let next: Progress = { ...p, essays: (p.essays ?? []).map((e) => (e.id === id ? { ...e, ...storedPatch } : e)) };
  const scoredFb = patch.rev?.fb ?? (!existing?.fb ? patch.fb : undefined);
  const taskId = existing?.task ?? id;
  if (scoredFb && maxScore(scoredFb) > 0) {
    next = appendExamLog(next, { part: "essay", what: taskId, score: totalScore(scoredFb), total: maxScore(scoredFb), level: resolveEssayLevel(p, taskId, level), scope: "full" }, now);
  }
  const harvestedFb = patch.rev?.fb ?? patch.fb;
  if (harvestedFb?.corrections?.length) {
    next = harvestNonGrammarNotes(next, `写作 · ${taskId}`, harvestedFb.corrections, now);
  }
  return next;
}

/** Save a text (or replace the one with this id); the oldest beyond MAX_ESSAYS are dropped. Returns its id. */
export function saveEssay(input: { id?: string; task: string; text: string; fb?: EssayFeedback; level?: "B1" | "B2" }): string {
  const id = input.id ?? `e-${rid()}`;
  store.progress((p) => applySaveEssay(p, { ...input, id }).progress);
  return id;
}

/** Add to a saved essay: self/AI feedback, its second draft, or a model text. */
export function patchEssay(id: string, patch: { fb?: EssayFeedback; rev?: Revision; model?: ModelEssay; level?: "B1" | "B2" }) {
  store.progress((p) => applyPatchEssay(p, id, patch));
}

/** Keep a task the AI wrote. */
export function saveAiTask(task: EssayTask) {
  store.progress((p) => clearTombstone({ ...p, essayTasks: [task, ...(p.essayTasks ?? []).filter((t) => t.id !== task.id)].slice(0, MAX_AI_TASKS) }, `task:${task.id}`));
}

/** Drop an AI task; the texts written for it stay in 写过的. */
export function deleteAiTask(id: string) {
  store.progress((p) => {
    const essayTasks = (p.essayTasks ?? []).filter((t) => t.id !== id);
    const { essayTasks: _old, ...rest } = p;
    void _old;
    return markTombstone(essayTasks.length ? { ...rest, essayTasks } : rest, `task:${id}`);
  });
}

/** Keep one mistake from a marking in the 错句本 (once: the same wrong and right wording is not added twice). */
export function saveNote(n: Omit<SavedNote, "id" | "at">): boolean {
  const have = store.get().progress.essayNotes ?? [];
  if (have.some((x) => x.wrong === n.wrong && x.right === n.right)) return false;
  const note: SavedNote = { ...n, id: `n-${rid()}`, at: Date.now() };
  store.progress((p) => clearTombstone({ ...p, essayNotes: [note, ...(p.essayNotes ?? [])].slice(0, MAX_NOTES) }, `note:${note.id}`));
  return true;
}

export function deleteNote(id: string) {
  store.progress((p) => {
    const essayNotes = (p.essayNotes ?? []).filter((n) => n.id !== id);
    const { essayNotes: _old, ...rest } = p;
    void _old;
    return markTombstone(essayNotes.length ? { ...rest, essayNotes } : rest, `note:${id}`);
  });
}

export function deleteEssay(id: string) {
  store.progress((p) => {
    const essays = (p.essays ?? []).filter((e) => e.id !== id);
    const { essays: _old, ...rest } = p;
    return markTombstone(essays.length ? { ...rest, essays } : rest, `essay:${id}`);
  });
}

/** Note a result of 听力理解、应试阅读、写作 or 口语. */
export function logExam(r: Omit<ExamResult, "at">) {
  store.progress((p) => appendExamLog(p, r));
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
  let next: Progress = { ...p, speakCorrections: [entry, ...(p.speakCorrections ?? [])].slice(0, MAX_SPEAK_CORRECTIONS) };
  next = harvestNonGrammarNotes(next, `口语 · ${cleanSubject}`, valid, at);
  return { next, id };
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

export function applySaveSpeakingSession(p: Progress, input: Omit<SpeakingSession, "id"> & { id?: string }): { next: Progress; id: string } {
  const id = input.id ?? `ss-${rid()}`;
  const clean = sanitizeSpeakingSessions([{ ...input, id }])?.[0];
  if (!clean) return { next: p, id };
  const nextList = [clean, ...(p.speakingSessions ?? []).filter((x) => x.id !== id)].slice(0, MAX_SPEAKING_SESSIONS);
  return { next: clearTombstone({ ...p, speakingSessions: nextList }, `speakSess:${id}`), id };
}

export function saveSpeakingSession(input: Omit<SpeakingSession, "id"> & { id?: string }): string {
  const id = input.id ?? `ss-${rid()}`;
  store.progress((p) => applySaveSpeakingSession(p, { ...input, id }).next);
  return id;
}

export function patchSpeakingSessionScore(id: string, total25: number | null) {
  store.progress((p) => {
    if (!p.speakingSessions?.some((x) => x.id === id)) return p;
    return {
      ...p,
      speakingSessions: p.speakingSessions.map((x) => (x.id === id ? { ...x, total25 } : x)),
    };
  });
}

export function applySaveMockRecord(p: Progress, input: Omit<MockRecord, "id"> & { id?: string }): { next: Progress; id: string } {
  const id = input.id ?? `mk-${rid()}`;
  const clean = sanitizeMockRecords([{ ...input, id }])?.[0];
  if (!clean) return { next: p, id };
  const nextList = [clean, ...(p.mockRecords ?? []).filter((x) => x.id !== id)].slice(0, MAX_MOCK_RECORDS);
  return { next: clearTombstone({ ...p, mockRecords: nextList }, `mock:${id}`), id };
}

export function saveMockRecord(input: Omit<MockRecord, "id"> & { id?: string }): string {
  const id = input.id ?? `mk-${rid()}`;
  store.progress((p) => applySaveMockRecord(p, { ...input, id }).next);
  return id;
}

export function applySaveWeeklyPlan(p: Progress, plan: WeeklyRemediationPlan): Progress {
  const clean = sanitizeWeeklyPlan(plan);
  if (!clean) return p;
  return { ...p, weeklyPlan: clean };
}

export function saveWeeklyPlan(plan: WeeklyRemediationPlan) {
  store.progress((p) => applySaveWeeklyPlan(p, plan));
}

export function applyToggleWeeklyPlanTask(p: Progress, taskId: string, done?: boolean, now = Date.now()): Progress {
  if (!p.weeklyPlan) return p;
  const tasks = p.weeklyPlan.tasks.map((t) => {
    if (t.id !== taskId) return t;
    const markDone = done ?? !t.doneAt;
    if (markDone) return { ...t, doneAt: t.doneAt ?? now };
    const { doneAt: _drop, ...rest } = t;
    void _drop;
    return rest;
  });
  return { ...p, weeklyPlan: { ...p.weeklyPlan, tasks } };
}

export function toggleWeeklyPlanTask(taskId: string, done?: boolean) {
  store.progress((p) => applyToggleWeeklyPlanTask(p, taskId, done));
}

export function clearWeeklyPlan() {
  store.progress((p) => {
    if (!p.weeklyPlan) return p;
    const { weeklyPlan: _drop, ...rest } = p;
    void _drop;
    return rest;
  });
}
