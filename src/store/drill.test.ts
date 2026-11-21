import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeProgress } from "./store";

test("progress keeps 一分钟口语 days (and so backups do), dropping bad entries", () => {
  const p = sanitizeProgress({ version: 2, cards: {}, drillDays: { "2026-10-25": 2, nope: 1, "2026-10-26": -1 } }, "word-atlas-open");
  assert.deepEqual(p.drillDays, { "2026-10-25": 2 });
  assert.equal(sanitizeProgress({ version: 2, cards: {} }, "word-atlas-open").drillDays, undefined);
});
