import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import type { GrammarData } from "../lib/grammar.ts";
import { DISCOURSE_EXERCISES } from "../lib/grammar-discourse.ts";
import { nextPoint } from "./grammar.ts";
import { review, Rating } from "./srs.ts";
import { emptyProgress } from "./store.ts";

const grammar = JSON.parse(fs.readFileSync("public/atlas/grammar.json", "utf8")) as GrammarData;

test("PE-7: nextPoint follows startLevel and prioritizes B1/B2 exam syllabus points", () => {
  const empty = emptyProgress("t");
  assert.equal(nextPoint(grammar, empty, 0)?.id, "art-gender");

  const b1First = nextPoint(grammar, empty, 2);
  assert.equal(b1First?.id, "subjonctif");

  const b2First = nextPoint(grammar, empty, 3);
  assert.equal(b2First?.id, "subj-indicatif");

  // Once all B1/B2 points are started, falls back to remaining lower-level points
  const allB1B2Done = emptyProgress("t");
  allB1B2Done.gram = Object.fromEntries(
    grammar.points.filter((g) => g.level === "B1" || g.level === "B2").map((g) => [g.id, review(undefined, Rating.Good, 0)]),
  );
  assert.equal(nextPoint(grammar, allB1B2Done, 2)?.id, "art-gender");
});

test("PE-7: discourse exercises cover B1/B2 multi-clause grammar with valid point links", () => {
  const ids = new Set(grammar.points.map((p) => p.id));
  assert.ok(DISCOURSE_EXERCISES.length >= 6);
  for (const ex of DISCOURSE_EXERCISES) {
    assert.ok(ex.slots.length >= 4);
    for (let i = 0; i < ex.slots.length; i++) {
      assert.ok(ex.text.includes(`{{${i}}}`), `${ex.id} must include {{${i}}}`);
      const slot = ex.slots[i];
      assert.ok(ids.has(slot.point), `${slot.point} must exist in grammar.json`);
      assert.ok(slot.options.includes(slot.answer[0]));
    }
  }
});
