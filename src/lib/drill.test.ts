import assert from "node:assert/strict";
import { test } from "node:test";
import { addDrill, DRILL_QUESTIONS, drawQuestion, sanitizeDrillDays } from "./drill.ts";
import { DRILL_QUESTIONS_COUNT } from "./drill-schema.ts";
import { TOPICS } from "./exam.ts";

test("drill questions have unique ids and known topics", () => {
  assert.equal(new Set(DRILL_QUESTIONS.map((q) => q.id)).size, DRILL_QUESTIONS.length);
  assert.equal(DRILL_QUESTIONS_COUNT, DRILL_QUESTIONS.length);
  for (const q of DRILL_QUESTIONS) assert.ok(TOPICS.some((t) => t.id === q.topic), q.id);
});

test("drawQuestion avoids recent questions until all were asked", () => {
  const all = DRILL_QUESTIONS.map((q) => q.id);
  const q = drawQuestion(all.slice(1), () => 0.99);
  assert.equal(q.id, all[0]);
  assert.ok(all.includes(drawQuestion(all).id));
});

test("sanitizeDrillDays keeps positive counts on valid days", () => {
  assert.deepEqual(sanitizeDrillDays({ "2025-03-01": 2, "2025-03-02": 0, bad: 1, "2025-03-03": 1.5, "2025-03-04": "3", "2025-03-05": 1 }), { "2025-03-01": 2, "2025-03-05": 1 });
  assert.equal(sanitizeDrillDays({}), undefined);
  assert.equal(sanitizeDrillDays([1]), undefined);
  assert.equal(sanitizeDrillDays(null), undefined);
});

test("addDrill counts one more on the day", () => {
  assert.deepEqual(addDrill(undefined, "2025-03-01"), { "2025-03-01": 1 });
  assert.deepEqual(addDrill({ "2025-03-01": 1 }, "2025-03-01"), { "2025-03-01": 2 });
});
