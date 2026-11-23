import assert from "node:assert/strict";
import { test } from "node:test";
import { ESSAY_TASKS } from "./essay";
import { ESSAY_MODELS, modelEssayFor } from "./essay-models";

const norm = (s: string) => s.replace(/[’‘]/g, "'").toLowerCase();

test("ESSAY_MODELS cover valid tasks >=250w and every pattern fragment appears verbatim in its essay", () => {
  const known = new Set(ESSAY_TASKS.map((t) => t.id));
  assert.ok(ESSAY_MODELS.length >= 9);
  for (const m of ESSAY_MODELS) {
    assert.ok(known.has(m.taskId), m.taskId);
    assert.equal(modelEssayFor(m.taskId), m);
    assert.ok(m.wordCount >= 250, `${m.taskId} wordCount=${m.wordCount}`);
    const body = norm(m.text);
    for (const p of m.patterns) {
      const parts = norm(p.fr)
        .split("…")
        .map((s) => s.trim())
        .filter(Boolean);
      assert.ok(parts.length > 0, `${m.taskId}: empty pattern`);
      for (const part of parts) {
        assert.ok(body.includes(part), `${m.taskId} missing fragment "${part}" from pattern "${p.fr}"`);
      }
    }
  }
});
