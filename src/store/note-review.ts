/**
 * FSRS spaced-repetition reflow for non-grammar essay notes (word-choice, collocation, register, spelling)
 * and comprehension mistakes (`compMisses`).
 */
import type { SavedNote } from "../lib/essay-schema";
import type { GrammarMeta } from "../lib/grammar";
import type { CompMiss } from "../lib/listening";
import { hashSeed } from "../lib/text";
import { duePoints, untouchedWithErrors } from "./grammar";
import { review, type CardState, type Grade } from "./srs";
import { bumpDay, store, type Progress } from "./store";

export type ReflowItem =
  | { key: string; kind: "essay"; note: SavedNote; card?: CardState }
  | { key: string; kind: "comp"; miss: CompMiss; card?: CardState };

export const essayNoteReflowKey = (n: Pick<SavedNote, "id">) => `note:${n.id.replace(/[^a-zA-Z0-9._:-]/g, "_").slice(0, 74)}`;

export const compMissReflowKey = (m: Pick<CompMiss, "at" | "part" | "q" | "skill">) =>
  `miss:${m.at}_${m.part}_${(m.q ?? m.skill ?? "q").replace(/[^a-zA-Z0-9._:-]/g, "_")}_${hashSeed(`${m.part}:${m.q ?? ""}:${m.skill ?? ""}`).toString(36)}`.slice(0, 84);

export function allReflowItems(p: Pick<Progress, "noteCards" | "essayNotes" | "compMisses">): ReflowItem[] {
  const cards = p.noteCards ?? {};
  const seen = new Set<string>();
  const out: ReflowItem[] = [];

  for (const note of p.essayNotes ?? []) {
    if (note.point) continue; // Grammar-linked notes belong to Grammar studio reflow.
    const key = essayNoteReflowKey(note);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, kind: "essay", note, card: cards[key] });
  }

  for (const miss of p.compMisses ?? []) {
    const key = compMissReflowKey(miss);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, kind: "comp", miss, card: cards[key] });
  }

  return out;
}

export function dueReflowItems(p: Pick<Progress, "noteCards" | "essayNotes" | "compMisses">, now = Date.now()): ReflowItem[] {
  return allReflowItems(p)
    .filter((item) => !item.card || item.card.due <= now)
    .sort((a, b) => (a.card?.due ?? 0) - (b.card?.due ?? 0));
}

export function reflowSummary(p: Pick<Progress, "noteCards" | "essayNotes" | "compMisses">, now = Date.now()) {
  const all = allReflowItems(p);
  const due = dueReflowItems(p, now);
  return {
    total: all.length,
    due: due.length,
    essayDue: due.filter((x) => x.kind === "essay").length,
    compDue: due.filter((x) => x.kind === "comp").length,
    items: due,
  };
}

export function applyGradeReflow(p: Progress, key: string, grade: Grade, retention = 0.9, now = Date.now()): Progress {
  const nextCard = review(p.noteCards?.[key], grade, now, retention);
  const next: Progress = {
    ...p,
    noteCards: { ...(p.noteCards ?? {}), [key]: nextCard },
  };
  return bumpDay(next, { r: 1, c: grade === 1 ? 0 : 1 });
}

export function gradeReflow(key: string, grade: Grade) {
  const { settings } = store.get();
  store.progress((p) => applyGradeReflow(p, key, grade, settings.retention));
}

export interface UnifiedMistakeCounts {
  words: number;
  grammarDue: number;
  grammarUntouched: number;
  grammarTotal: number;
  essayDue: number;
  speakCount: number;
  sentencesTotal: number;
  compDue: number;
  total: number;
}

/** Unified counter across all 4 mistake categories: vocabulary, grammar, writing/speaking sentences, and CO/CE traps. */
export function unifiedMistakeCounts(
  p: Pick<Progress, "mistakes" | "gram" | "essayNotes" | "essays" | "speakCorrections" | "noteCards" | "compMisses">,
  grammarMeta?: GrammarMeta | null,
  now = Date.now(),
): UnifiedMistakeCounts {
  const words = p.mistakes.length;
  const grammarDue = grammarMeta ? duePoints(grammarMeta, p, now).length : 0;
  const grammarUntouched = grammarMeta ? untouchedWithErrors(grammarMeta, p).length : 0;
  const grammarTotal = grammarDue + grammarUntouched;
  const summary = reflowSummary(p, now);
  const speakCount = (p.speakCorrections ?? []).reduce((n, s) => n + s.corrections.length, 0);
  const sentencesTotal = summary.essayDue + speakCount;
  const compDue = summary.compDue;
  return {
    words,
    grammarDue,
    grammarUntouched,
    grammarTotal,
    essayDue: summary.essayDue,
    speakCount,
    sentencesTotal,
    compDue,
    total: words + grammarTotal + sentencesTotal + compDue,
  };
}

export function applyRemoveWordMistake(p: Progress, id: string): Progress {
  if (!p.mistakes.includes(id)) return p;
  return { ...p, mistakes: p.mistakes.filter((m) => m !== id) };
}

export function removeWordMistake(id: string) {
  store.progress((p) => applyRemoveWordMistake(p, id));
}

export function applyDeleteSpeakingCorrection(p: Progress, entryId: string, index: number): Progress {
  const cur = p.speakCorrections ?? [];
  const next = cur
    .map((e) => (e.id === entryId ? { ...e, corrections: e.corrections.filter((_, i) => i !== index) } : e))
    .filter((e) => e.corrections.length > 0);
  if (next.length === cur.length && next.every((e, i) => e === cur[i])) return p;
  const { speakCorrections: _drop, ...rest } = p;
  return next.length ? { ...rest, speakCorrections: next } : rest;
}

export function deleteSpeakingCorrection(entryId: string, index: number) {
  store.progress((p) => applyDeleteSpeakingCorrection(p, entryId, index));
}
