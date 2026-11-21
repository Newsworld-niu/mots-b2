/**
 * Scheduling for 表达: one FSRS card per expression (src/lib/expressions.ts), separate from word, conjugation
 * and grammar cards. A card starts when the learner first answers it; a round is its due cards, then new ones
 * in teaching order.
 */
import { EXPR_BY_ID, EXPRESSIONS, type ExprGroup, type ExprVerdict } from "../lib/expressions";
import { review, Rating, type Grade } from "./srs";
import { store, type Progress } from "./store";

/** New cards in a round. */
export const EXPR_NEW = 8;
/** Due cards in a round at most (the rest wait for the next round). */
export const EXPR_DUE_MAX = 30;

const inGroup = (id: string, group?: ExprGroup | null) => {
  const e = EXPR_BY_ID.get(id);
  return !!e && (!group || e.group === group);
};

/** Started cards that are due, most overdue first. Cards no longer in the data are left out. */
export function dueExpr(p: Progress, now = Date.now(), group?: ExprGroup | null) {
  return Object.entries(p.expr ?? {})
    .filter(([id, c]) => c.due <= now && inGroup(id, group))
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id);
}

/** Cards not started yet, in teaching order. */
export function freshExpr(p: Progress, n: number, group?: ExprGroup | null) {
  return EXPRESSIONS.filter((e) => !p.expr?.[e.id] && (!group || e.group === group))
    .slice(0, Math.max(0, n))
    .map((e) => e.id);
}

export function exprRound(p: Progress, group?: ExprGroup | null, now = Date.now(), fresh = EXPR_NEW) {
  return [...dueExpr(p, now, group).slice(0, EXPR_DUE_MAX), ...freshExpr(p, fresh, group)];
}

/** Started and total cards, per group or all. */
export function exprCounts(p: Progress, group?: ExprGroup | null) {
  const all = EXPRESSIONS.filter((e) => !group || e.group === group);
  return { total: all.length, started: all.filter((e) => p.expr?.[e.id]).length };
}

/** Grade from the check: a slip of accent, another expression of the same function or a hint → Hard. */
export function exprGrade(verdict: ExprVerdict, hinted: boolean, ms: number): Grade {
  if (verdict === "wrong") return Rating.Again;
  if (verdict !== "exact" || hinted || ms > 20000) return Rating.Hard;
  return ms < 5000 ? Rating.Easy : Rating.Good;
}

export function answerExpr(id: string, grade: Grade, now = Date.now()) {
  if (!EXPR_BY_ID.has(id)) return;
  const { settings } = store.get();
  store.progress((p) => ({ ...p, expr: { ...(p.expr ?? {}), [id]: review(p.expr?.[id], grade, now, settings.retention) } }));
}
