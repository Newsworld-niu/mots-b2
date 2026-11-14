import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CONNECTORS, countWords, CRITERIA, ESSAY_TASKS, maxScore, sanitizeEssayFeedback, sanitizeEssays, tooShort, toLevel, totalScore } from "./essay";

test("countWords counts elided and hyphenated words once", () => {
  assert.equal(countWords("L'ami de Paul est arrivé."), 5);
  assert.equal(countWords("C'est-à-dire : 3 jours, peut-être !"), 4);
  assert.equal(countWords("  "), 0);
});

test("every task has a plan, points, phrases and a sane word range", () => {
  const ids = new Set<string>();
  for (const t of ESSAY_TASKS) {
    assert.ok(!ids.has(t.id), t.id);
    ids.add(t.id);
    assert.ok(t.title && t.situation && t.consigne, t.id);
    assert.ok(t.points.length >= 2 && t.plan.length >= 3 && t.phrases.length >= 3, t.id);
    assert.ok(t.words[0] >= 80 && t.words[1] > t.words[0] && t.words[1] <= 400, t.id);
  }
  assert.ok(CONNECTORS.every((g) => g.zh && g.fr.length >= 2));
});

test("sanitizeEssayFeedback snaps scores to the grid's levels and keeps only known grammar points", () => {
  const fb = sanitizeEssayFeedback(
    {
      scores: { task: 9, coherence: 3.3, socio: 2, lexique: "x", morpho: -2 },
      comment: " 不错 ",
      strengths: ["结构清楚", 3, ""],
      todo: ["a", "b", "c", "d", "e"],
      corrections: [
        { wrong: "je suis allé", right: "je suis allée", type: "agreement", why: "配合", point: "accord-pp" },
        { wrong: "x", right: "x", type: "tense", why: "", point: "" },
        { wrong: "bien que il est", right: "bien qu'il soit", type: "nope", why: "虚拟式", point: "made-up" },
      ],
      rewrite: "Texte.",
    },
    new Set(["accord-pp"]),
  );
  assert.deepEqual(fb.scores, { task: 5, coherence: 3, socio: 1, lexique: 0, morpho: 0 });
  assert.equal(totalScore(fb), 9);
  assert.equal(maxScore(fb), 25);
  assert.equal(fb.comment, "不错");
  assert.deepEqual(fb.strengths, ["结构清楚"]);
  assert.equal(fb.todo.length, 4);
  assert.equal(fb.corrections.length, 2);
  assert.equal(fb.corrections[0].point, "accord-pp");
  assert.deepEqual([fb.corrections[1].type, fb.corrections[1].point], ["other", ""]);
  const empty = sanitizeEssayFeedback(null, new Set());
  assert.ok(CRITERIA.every((c) => empty.scores[c] === 0) && empty.corrections.length === 0);
  // markings saved before the official grid
  const old = sanitizeEssayFeedback({ scores: { task: 4, structure: 3.5, grammar: 5, vocabulary: 1 } }, new Set());
  assert.deepEqual(old.scores, { task: 3, coherence: 3, socio: 0, lexique: 1, morpho: 5 });
  assert.deepEqual([0, 0.9, 1, 2.9, 3, 4.9, 5, 7].map(toLevel), [0, 0, 1, 1, 3, 3, 5, 5]);
  assert.equal(tooShort("un deux trois", 250), true);
  assert.equal(tooShort(new Array(125).fill("mot").join(" "), 250), false);
});

test("sanitizeEssays drops broken rows and unknown tasks", () => {
  const task = ESSAY_TASKS[0].id;
  const out = sanitizeEssays([{ id: "e-1", task, text: "Bonjour", created: 1 }, { id: "e-2", task: "gone", text: "x", created: 1 }, { id: "e-3", task, text: " ", created: 1 }, 7]);
  assert.deepEqual(out, [{ id: "e-1", task, text: "Bonjour", created: 1 }]);
  assert.equal(sanitizeEssays("x"), undefined);
  assert.equal(sanitizeEssays([]), undefined);
});

test("grammar ids the marker may link exist in the built grammar data", () => {
  const g = JSON.parse(readFileSync(new URL("../../public/atlas/grammar.json", import.meta.url), "utf8")) as { points: { id: string }[] };
  assert.ok(g.points.length >= 60);
  assert.ok(g.points.every((p) => /^[a-z0-9-]{2,40}$/.test(p.id)));
});
