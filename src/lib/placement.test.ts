import assert from "node:assert/strict";
import { test } from "node:test";
import { PLACEMENT_QUESTIONS, sanitizePlacement, scorePlacement } from "./placement.ts";

test("placement scoring maps low, A2, B1 and B2 accuracy to start levels 0..3 and flags weak sections", () => {
  const allRight = Object.fromEntries(PLACEMENT_QUESTIONS.map((q) => [q.id, q.answer]));
  const b2 = scorePlacement(allRight, false, 1000);
  assert.equal(b2.level, 3);
  assert.equal(b2.score, 100);
  assert.deepEqual(b2.weak, []);

  // Only A1/A2 items and half of B1 items right -> around B1/A2 boundary
  const b1Answers: Record<string, number> = {};
  for (const q of PLACEMENT_QUESTIONS) {
    if (q.section === "vocab" || q.section === "read") b1Answers[q.id] = q.answer;
    else if (q.section === "grammar" && q.level !== "B2") b1Answers[q.id] = q.answer;
    else b1Answers[q.id] = (q.answer + 1) % q.options.length;
  }
  const b1 = scorePlacement(b1Answers, false, 2000);
  assert.equal(b1.level, 2);
  assert.ok(b1.weak.includes("listen"));
  assert.equal(b1.weak[0], "listen");

  // Skip listening works without breaking scoring
  const skipped = scorePlacement(b1Answers, true, 3000);
  assert.equal(skipped.sections.listen, null);
  assert.ok(!skipped.weak.includes("listen"));
  assert.ok(skipped.score >= 55);

  const zero = scorePlacement({}, false, 4000);
  assert.equal(zero.level, 0);
  assert.equal(zero.score, 0);
  assert.equal(zero.weak.length, 4);
});

test("sanitizePlacement keeps valid diagnostic results and rejects malformed ones", () => {
  const valid = sanitizePlacement({
    at: 12345,
    level: 2,
    score: 68,
    sections: { vocab: 80, grammar: 60, read: 75, listen: 40 },
    weak: ["listen", "grammar", "bogus"],
  });
  assert.deepEqual(valid, {
    at: 12345,
    level: 2,
    score: 68,
    sections: { vocab: 80, grammar: 60, read: 75, listen: 40 },
    weak: ["listen", "grammar"],
  });
  assert.equal(sanitizePlacement({ at: 1, level: 9, score: 50, sections: { vocab: 50, grammar: 50, read: 50, listen: null } }), undefined);
  assert.equal(sanitizePlacement(null), undefined);
});
