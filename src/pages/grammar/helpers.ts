import { type Drill, type GrammarData } from "../../lib/grammar";
import { useKeys } from "../../lib/keys";
import { gradePoint } from "../../store/grammar";

export const LEVELS = ["A1", "A2", "B1", "B2"] as const;

export interface Step {
  point: string;
  drill: Drill;
}

export interface Answered {
  step: Step;
  ok: boolean;
  value: string;
}

export type Result = "right" | "accent" | "wrong";

export interface Pending {
  result: Result;
  value: string;
  aiNote?: string;
  orthographyHint?: string | null;
}

export interface Graded {
  id: string;
  total: number;
  wrong: number;
  grade: number;
}

export const titleOf = (data: GrammarData, id: string) => data.points.find((p) => p.id === id)?.title ?? id;

export function status(card: { due: number } | undefined, now: number) {
  if (!card) return { label: "未开始", cls: "" };
  if (card.due <= now) return { label: "该复习了", cls: "is-due" };
  const days = Math.max(1, Math.round((card.due - now) / 86400000));
  return { label: `${days} 天后复习`, cls: "is-ok" };
}

/** Grade every point of a round from its answers. */
export function gradeRound(log: Answered[]): Graded[] {
  const by = new Map<string, { g?: string; ok: boolean }[]>();
  for (const { step, ok } of log) by.set(step.point, [...(by.get(step.point) ?? []), { g: step.drill.g, ok }]);
  return [...by].map(([id, answers]) => ({ id, total: answers.length, wrong: answers.filter((a) => !a.ok).length, grade: gradePoint(id, answers) }));
}

/** Enter and space go on once answered (the text box is read-only by then). */
export function useNextKeys(pending: Pending | null, onNext: () => void) {
  const keys: Record<string, () => void> = {};
  if (pending) {
    keys.Enter = onNext;
    keys[" "] = onNext;
  }
  useKeys(keys);
}
