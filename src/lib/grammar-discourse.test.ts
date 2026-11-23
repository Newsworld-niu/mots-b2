import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { checkTyped, tagsOf, type GrammarData, type GrammarMeta } from "./grammar.ts";
import { DISCOURSE_EXERCISES } from "./grammar-discourse.ts";
import { applyDiscourseResult, tagKey } from "../store/grammar.ts";
import { dayKey, emptyProgress, sanitizeProgress } from "../store/store.ts";

const grammarMeta = JSON.parse(
  fs.readFileSync(new URL("../../public/atlas/grammar-meta.json", import.meta.url), "utf8"),
) as GrammarMeta;
const grammarFull = JSON.parse(
  fs.readFileSync(new URL("../../public/atlas/grammar.json", import.meta.url), "utf8"),
) as GrammarData;

test("M23-C: DISCOURSE_EXERCISES has exactly 40 well-formed B1/B2 passages with 100% valid grammar-meta points and sub-rule tags", () => {
  assert.equal(DISCOURSE_EXERCISES.length, 40);

  const metaPointIds = new Set(grammarMeta.points.map((p) => p.id));
  const fullPointById = new Map(grammarFull.points.map((p) => [p.id, p]));
  const seenExerciseIds = new Set<string>();
  const seenSlotIds = new Set<string>();

  for (const ex of DISCOURSE_EXERCISES) {
    assert.ok(!seenExerciseIds.has(ex.id), `duplicate exercise id: ${ex.id}`);
    seenExerciseIds.add(ex.id);
    assert.ok(ex.title.trim().length > 0 && ex.subtitle.trim().length > 0, `${ex.id}: empty title/subtitle`);
    assert.ok(ex.slots.length >= 4, `${ex.id}: expected >= 4 slots, got ${ex.slots.length}`);

    // Verify exact {{0}}..{{n-1}} placeholders and no stray placeholders
    const placeholders = [...ex.text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(
      placeholders,
      ex.slots.map((_, idx) => idx),
      `${ex.id}: placeholders must be sequential {{0}}..{{${ex.slots.length - 1}}}`,
    );

    for (const slot of ex.slots) {
      assert.ok(!seenSlotIds.has(slot.id), `${ex.id}: duplicate slot id ${slot.id}`);
      seenSlotIds.add(slot.id);
      assert.ok(slot.hint.trim().length > 0, `${ex.id}/${slot.id}: empty hint`);
      assert.ok(slot.why.trim().length > 0, `${ex.id}/${slot.id}: empty Chinese explanation`);
      assert.ok(slot.answer.length >= 1 && slot.answer[0].trim().length > 0, `${ex.id}/${slot.id}: empty answer`);
      assert.equal(slot.options.length, 4, `${ex.id}/${slot.id}: expected 4 options`);
      assert.equal(
        new Set(slot.options.map((o) => o.trim().toLowerCase())).size,
        4,
        `${ex.id}/${slot.id}: options must be 4 distinct strings (${slot.options.join(" | ")})`,
      );
      assert.ok(
        slot.options.includes(slot.answer[0]),
        `${ex.id}/${slot.id}: canonical answer "${slot.answer[0]}" missing from options`,
      );
      assert.equal(
        checkTyped(slot.answer[0], [...slot.answer]),
        "right",
        `${ex.id}/${slot.id}: canonical answer fails checkTyped`,
      );

      if (ex.kind === "fix") {
        assert.ok(slot.shown && slot.shown.trim().length > 0, `${ex.id}/${slot.id}: fix slot requires shown`);
        assert.notEqual(
          slot.shown.trim().toLowerCase(),
          slot.answer[0].trim().toLowerCase(),
          `${ex.id}/${slot.id}: shown "${slot.shown}" must differ from correction "${slot.answer[0]}"`,
        );
      }

      assert.ok(metaPointIds.has(slot.point), `${ex.id}/${slot.id}: unknown point "${slot.point}" in grammar-meta.json`);
      const fullPt = fullPointById.get(slot.point);
      assert.ok(fullPt, `${ex.id}/${slot.id}: unknown point "${slot.point}" in grammar.json`);
      if (slot.tag) {
        const validTags = new Set(tagsOf(fullPt));
        assert.ok(validTags.has(slot.tag), `${ex.id}/${slot.id}: invalid sub-rule tag "${slot.tag}" for ${slot.point}`);
      }
    }
  }
});

test("M23-C: applyDiscourseResult updates FSRS cards, gramDays, discourse tag, and persistent sub-rule gramTags", () => {
  const now = 1_730_000_000_000;
  const p0 = emptyProgress("test");
  const p1 = applyDiscourseResult(
    p0,
    [
      { point: "accord-pp", tag: "t0", ok: false },
      { point: "participe-present", tag: "r1", ok: true },
      { point: "participe-present", tag: "t1", ok: true, accent: true },
    ],
    now,
    0.9,
  );

  assert.ok(p1.gram?.["accord-pp"]);
  assert.ok(p1.gram?.["participe-present"]);
  assert.ok(p1.gram["participe-present"].due > p1.gram["accord-pp"].due);
  assert.deepEqual(p1.gramDays?.[dayKey(new Date(now))], { n: 2, r: 3, c: 2 });
  assert.deepEqual(p1.gramTags?.[tagKey("accord-pp", "t0")], { n: 1, w: 1 });
  assert.deepEqual(p1.gramTags?.[tagKey("participe-present", "r1")], { n: 1, w: 0 });
  assert.deepEqual(p1.gramTags?.[tagKey("participe-present", "t1")], { n: 1, w: 0 });

  // Sub-rule tags ("r1", "t0", "t1") survive Progress sanitization
  const sanitized = sanitizeProgress(p1, "test");
  assert.deepEqual(sanitized.gramTags?.[tagKey("accord-pp", "t0")], { n: 1, w: 1 });
  assert.deepEqual(sanitized.gramTags?.[tagKey("participe-present", "r1")], { n: 1, w: 0 });
});
