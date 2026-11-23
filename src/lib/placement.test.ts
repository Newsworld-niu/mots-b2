import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateMicroProduction, PLACEMENT_QUESTIONS, sanitizePlacement, scorePlacement } from "./placement.ts";

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

test("placement answers are balanced across option positions without streaks", () => {
  const counts = new Map<number, number>([[0, 0], [1, 0], [2, 0], [3, 0]]);
  let run = 1;
  for (let i = 0; i < PLACEMENT_QUESTIONS.length; i++) {
    const q = PLACEMENT_QUESTIONS[i];
    assert.ok(q.answer >= 0 && q.answer < q.options.length, `question ${q.id} answer out of bounds`);
    counts.set(q.answer, (counts.get(q.answer) ?? 0) + 1);
    if (i > 0 && PLACEMENT_QUESTIONS[i - 1].answer === q.answer) {
      run++;
      assert.ok(run < 3, `three consecutive questions share answer ${q.answer} at ${q.id}`);
    } else {
      run = 1;
    }
  }
  for (const idx of [0, 1, 2, 3]) {
    const c = counts.get(idx) ?? 0;
    assert.ok(c >= 1, `answer index ${idx} should be used`);
    assert.ok(c / PLACEMENT_QUESTIONS.length <= 0.4, `answer index ${idx} over-represented (${c}/${PLACEMENT_QUESTIONS.length})`);
  }
});

test("Wave7.3: optional 3-min micro-production scores A2/B1/B2 bands cleanly and survives placement sanitization", () => {
  const shortA2 = evaluateMicroProduction("J'aime le bus gratuit parce que c'est bien.");
  assert.equal(shortA2.band, "A2");
  assert.ok(shortA2.notes.length >= 1);

  const solidB2 = evaluateMicroProduction(
    "Certes, la gratuité totale des transports collectifs soutient le pouvoir d'achat et encourage les habitants à laisser leur voiture. Toutefois, cette réforme prive les municipalités de recettes nécessaires pour prolonger le réseau en banlieue. Par conséquent, il me semble préférable d'instaurer une tarification solidaire ciblée tout en renforçant la fréquence des lignes régionales afin que l'alternative ferroviaire reste attractive.",
  );
  assert.equal(solidB2.band, "B2");
  assert.ok(solidB2.score >= 70 && solidB2.connectors >= 2 && solidB2.words >= 55);

  const allRight = Object.fromEntries(PLACEMENT_QUESTIONS.map((q) => [q.id, q.answer]));
  const resWithProd = scorePlacement(allRight, false, 9999, "Cependant, il convient de nuancer cette décision qui demande des investissements durables afin que les banlieues profitent également des transports.");
  assert.ok(resWithProd.production);
  const round = sanitizePlacement(resWithProd);
  assert.deepEqual(round?.production, resWithProd.production);
});
