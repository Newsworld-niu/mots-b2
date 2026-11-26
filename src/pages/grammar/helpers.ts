import { type Drill, type GrammarData } from "../../lib/grammar";
import { useKeys } from "../../lib/keys";
import { gradePoint, type SessionMode } from "../../store/grammar";

export type { SessionMode };

export const LEVELS = ["A1", "A2", "B1", "B2"] as const;

export interface Step {
  point: string;
  drill: Drill;
}

export interface Answered {
  step: Step;
  ok: boolean;
  value: string;
  /** The first answer was right but for an accent (kept even after retyping it right). */
  accent?: boolean;
}

export type Result = "right" | "accent" | "wrong";

export interface Pending {
  result: Result;
  value: string;
  aiNote?: string;
  orthographyHint?: string | null;
  accentCleared?: boolean;
}

export interface Graded {
  id: string;
  total: number;
  wrong: number;
  grade: number;
}

/** A round to run: its drills, how it counts, and how to draw another one like it. */
export interface RunSpec {
  steps: Step[];
  mode: SessionMode;
  /** What the round trains, shown above it (例：“规则 02 专项”). */
  label?: string;
  /** Original non-retry mode & label preserved across retry rounds so 再来一轮 restores it. */
  origin?: { mode: Exclude<SessionMode, "retry">; label?: string };
  /** Draw a fresh round with the same point and filters (再来一轮). */
  again?: () => Step[];
}

/** Start a round: a plain list of steps is a whole-point round. */
export type StartRound = (steps: Step[], opts?: Omit<RunSpec, "steps">) => void;

export const titleOf = (data: GrammarData, id: string) => data.points.find((p) => p.id === id)?.title ?? id;

export function status(card: { due: number } | undefined, now: number) {
  if (!card) return { label: "未开始", cls: "" };
  if (card.due <= now) return { label: "该复习了", cls: "is-due" };
  const days = Math.max(1, Math.round((card.due - now) / 86400000));
  return { label: `${days} 天后复习`, cls: "is-ok" };
}

/** Grade every point of a round from its answers (a retry round is graded but not recorded). */
export function gradeRound(log: Answered[], mode: SessionMode = "round"): Graded[] {
  const by = new Map<string, { g?: string; ok: boolean; accent?: boolean }[]>();
  for (const { step, ok, accent } of log) by.set(step.point, [...(by.get(step.point) ?? []), { g: step.drill.g, ok, accent }]);
  return [...by].map(([id, answers]) => ({ id, total: answers.length, wrong: answers.filter((a) => !a.ok).length, grade: gradePoint(id, answers, mode) }));
}

/** Rule (r) or trap (t) of a tag, with its number from 1: "规则 02", "易错 01". */
export function tagNumber(tag: string) {
  const n = Number(tag.slice(1)) + 1;
  return `${tag[0] === "t" ? "易错" : "规则"} ${String(n).padStart(2, "0")}`;
}

export const KIND_LABEL: Record<Drill["k"], string> = { c: "选择", t: "填空", f: "改错", x: "改写", o: "语序" };
export const KIND_ORDER: Drill["k"][] = ["c", "t", "f", "x", "o"];

/** Enter and space go on once answered (and once any required accent retype has been completed). */
export function useNextKeys(pending: Pending | null, onNext: () => void) {
  const keys: Record<string, () => void> = {};
  if (pending && (pending.result !== "accent" || pending.accentCleared)) {
    keys.Enter = onNext;
    keys[" "] = onNext;
  }
  useKeys(keys);
}

/** DOM ids a `section` deep link may name: a point's section (r1, traps), a matrix, or a cheat-sheet item. */
export function sectionIds(section: string) {
  const bare = section.replace(/^mat-/, "");
  return [`gram-sec-${section}`, `gram-mat-${section}`, `gram-mat-${bare}`, `gram-sheet-${section}`];
}

/**
 * Scroll smoothly to a section and flash it; false when there is no such section (the caller goes to the top).
 * A closed <details> on the way is opened.
 */
export function scrollToSection(section: string | undefined): boolean {
  if (!section || typeof document === "undefined") return false;
  const el = sectionIds(section)
    .map((id) => document.getElementById(id))
    .find((x): x is HTMLElement => !!x);
  if (!el) return false;
  if (el instanceof HTMLDetailsElement) el.open = true;
  const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  el.classList.remove("is-flash");
  void el.offsetWidth;
  el.classList.add("is-flash");
  window.setTimeout(() => el.classList.remove("is-flash"), 1800);
  return true;
}
