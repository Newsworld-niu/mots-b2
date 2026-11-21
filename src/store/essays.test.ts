import assert from "node:assert/strict";
import { test } from "node:test";
import { applyPatchEssay, applySaveEssay } from "./essays";
import { emptyProgress, sanitizeProgress } from "./store";

test("applySaveEssay and applyPatchEssay record essay scores into examLog and survive sanitizeProgress", () => {
  const fb1 = { scores: { task: 3, coherence: 3, socio: 3, lexique: 3, morpho: 3 }, comment: "ok", strengths: [], todo: [], corrections: [], rewrite: "" };
  const fb2 = { scores: { task: 5, coherence: 3, socio: 5, lexique: 3, morpho: 3 }, comment: "mieux", strengths: [], todo: [], corrections: [], rewrite: "" };
  const p0 = emptyProgress("word-atlas-open");
  const { progress: p1, id } = applySaveEssay(p0, { task: "courrier-voitures", text: "Texte de test.", fb: fb1 }, 100);
  const p2 = applyPatchEssay(p1, id, { rev: { text: "Texte amélioré.", at: 200, fb: fb2 } }, 200);
  const log = p2.examLog ?? [];
  assert.equal(log.length, 2);
  assert.deepEqual(log[0], { part: "essay", what: "courrier-voitures", score: 19, total: 25, at: 200 });
  assert.deepEqual(log[1], { part: "essay", what: "courrier-voitures", score: 15, total: 25, at: 100 });

  const roundTrip = sanitizeProgress({ version: 2, cards: {}, examLog: log }, "word-atlas-open");
  assert.deepEqual(roundTrip.examLog, log);
});
