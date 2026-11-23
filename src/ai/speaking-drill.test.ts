import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_DRILL_KEPT, MAX_EXAM_KEPT, selectEvictedRecordingIds } from "../store/recordings.ts";
import { canCompleteDrill, drillFeedback, MIN_DRILL_WORDS, sanitizeDrillFeedback } from "./speaking-drill.ts";

test("sanitizeDrillFeedback clamps counts and drops empty or unchanged fixes", () => {
  const r = sanitizeDrillFeedback({
    opinion: true,
    reasons: 9,
    comment: " ok ",
    fixes: [
      { wrong: "je suis d'accord avec", right: "je suis d'accord avec", why: "" },
      { wrong: "il faut que tu vas", right: "il faut que tu ailles", why: "subjonctif" },
      "x",
    ],
    better: "Bien.",
  });
  assert.equal(r.opinion, true);
  assert.equal(r.reasons, 5);
  assert.equal(r.comment, "ok");
  assert.deepEqual(r.fixes, [{ wrong: "il faut que tu vas", right: "il faut que tu ailles", why: "subjonctif" }]);
  assert.deepEqual(sanitizeDrillFeedback(null), { opinion: false, reasons: 0, comment: "", fixes: [], better: "" });
});

test("canCompleteDrill and drillFeedback guard against < 5 words", async () => {
  assert.equal(MIN_DRILL_WORDS, 5);
  assert.equal(canCompleteDrill(""), false);
  assert.equal(canCompleteDrill("   "), false);
  assert.equal(canCompleteDrill("Oui, je suis pour."), false); // 4 words
  assert.equal(canCompleteDrill("Je pense que c'est utile."), true); // >= 5 words

  await assert.rejects(
    () => drillFeedback({ question: "Pour ou contre ?", transcript: "Oui, bien sûr." }),
    /不足 5 个词/,
  );
});

test("recording quota partition isolates exam (12) and drill (8) buckets so drills never evict PO monologues", () => {
  assert.equal(MAX_EXAM_KEPT, 12);
  assert.equal(MAX_DRILL_KEPT, 8);

  const examItems = Array.from({ length: 12 }, (_, i) => ({
    id: `exam-${i}`,
    at: 1_000 + i,
    bucket: i % 2 === 0 ? ("exam" as const) : undefined, // legacy entries default to "exam"
  }));
  // Add 15 newer daily 1-min drills
  const drillItems = Array.from({ length: 15 }, (_, i) => ({
    id: `drill-${i}`,
    at: 5_000 + i,
    bucket: "drill" as const,
  }));

  const evicted = selectEvictedRecordingIds([...examItems, ...drillItems]);
  // Zero exam items evicted; oldest 7 drill items (drill-0 .. drill-6) evicted
  assert.equal(evicted.some((id) => id.startsWith("exam-")), false);
  assert.deepEqual(
    evicted.sort(),
    ["drill-0", "drill-1", "drill-2", "drill-3", "drill-4", "drill-5", "drill-6"],
  );

  // Adding a 13th exam item evicts only the oldest exam item (exam-0)
  const evictedWith13Exams = selectEvictedRecordingIds([
    ...examItems,
    { id: "exam-12", at: 9_999, bucket: "exam" as const },
    ...drillItems.slice(-8),
  ]);
  assert.deepEqual(evictedWith13Exams, ["exam-0"]);
});
