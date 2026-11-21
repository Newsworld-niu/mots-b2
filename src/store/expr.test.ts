import assert from "node:assert/strict";
import { test } from "node:test";

import { EXPRESSIONS } from "../lib/expressions.ts";
import { answerExpr, dueExpr, EXPR_DUE_MAX, EXPR_NEW, exprCounts, exprGrade, exprRound, freshExpr } from "./expr.ts";
import { Rating, review } from "./srs.ts";
import { emptyProgress, sanitizeProgress, store } from "./store.ts";

const DAY = 86400000;

test("sanitize keeps valid expression cards only", () => {
  const card = review(undefined, Rating.Good, Date.now());
  const p = sanitizeProgress({ ...emptyProgress("t"), expr: { "conn-cependant": card, "../x": card, "conn-bad": { due: "no" }, "zzz-a": card } }, "t");
  assert.deepEqual(Object.keys(p.expr ?? {}), ["conn-cependant"]);
  assert.equal(sanitizeProgress({ ...emptyProgress("t"), expr: "nope" }, "t").expr, undefined);
  assert.equal(sanitizeProgress({ ...emptyProgress("t"), expr: {} }, "t").expr, undefined);
});

test("a round: due cards most overdue first, then new ones in teaching order", () => {
  const now = Date.now();
  const p = emptyProgress("t");
  const [a, b, c] = EXPRESSIONS;
  p.expr = {
    [a.id]: { ...review(undefined, Rating.Good, now - 10 * DAY), due: now - DAY },
    [b.id]: { ...review(undefined, Rating.Good, now - 10 * DAY), due: now - 5 * DAY },
    [c.id]: { ...review(undefined, Rating.Good, now), due: now + DAY },
    "conn-gone": { ...review(undefined, Rating.Good, now - 10 * DAY), due: now - DAY },
  };
  assert.deepEqual(dueExpr(p, now), [b.id, a.id]);
  const fresh = freshExpr(p, EXPR_NEW);
  assert.equal(fresh.length, EXPR_NEW);
  assert.ok(!fresh.includes(a.id) && !fresh.includes(c.id));
  assert.deepEqual(exprRound(p, null, now), [b.id, a.id, ...fresh]);
  assert.deepEqual(exprCounts(p), { total: EXPRESSIONS.length, started: 3 });
  // a group filter applies to both
  const lettre = exprRound(p, "lettre", now);
  assert.ok(lettre.length === EXPR_NEW && lettre.every((id) => id.startsWith("lettre-")));
  assert.ok(EXPR_DUE_MAX >= EXPR_NEW);
});

test("grades: wrong → Again; accent, near miss, hint or slow → Hard; quick → Easy", () => {
  assert.equal(exprGrade("wrong", false, 1000), Rating.Again);
  assert.equal(exprGrade("accent", false, 1000), Rating.Hard);
  assert.equal(exprGrade("synonym", false, 1000), Rating.Hard);
  assert.equal(exprGrade("exact", true, 1000), Rating.Hard);
  assert.equal(exprGrade("exact", false, 30000), Rating.Hard);
  assert.equal(exprGrade("exact", false, 8000), Rating.Good);
  assert.equal(exprGrade("exact", false, 2000), Rating.Easy);
});

test("answering schedules the card; unknown ids are ignored", () => {
  // the store saves through window timers
  (globalThis as { window?: unknown }).window ??= { setTimeout: () => 0, clearTimeout: () => undefined };
  const id = EXPRESSIONS[0].id;
  const now = Date.now();
  answerExpr(id, Rating.Good, now);
  answerExpr("conn-not-a-card", Rating.Good, now);
  const expr = store.get().progress.expr ?? {};
  assert.ok(expr[id] && expr[id].due > now);
  assert.equal(expr["conn-not-a-card"], undefined);
});
