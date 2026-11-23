import assert from "node:assert/strict";
import { test } from "node:test";
import { applyPatchEssay, applySaveEssay, recordSpeakingCorrections } from "./essays";
import { emptyProgress, sanitizeProgress } from "./store";

test("applySaveEssay and applyPatchEssay record essay scores into examLog and survive sanitizeProgress", () => {
  const fb1 = { scores: { task: 3, coherence: 3, socio: 3, lexique: 3, morpho: 3 }, comment: "ok", strengths: [], todo: [], corrections: [], rewrite: "" };
  const fb2 = { scores: { task: 5, coherence: 3, socio: 5, lexique: 3, morpho: 3 }, comment: "mieux", strengths: [], todo: [], corrections: [], rewrite: "" };
  const p0 = emptyProgress("word-atlas-open");
  const { progress: p1, id } = applySaveEssay(p0, { task: "courrier-voitures", text: "Texte de test.", fb: fb1 }, 100);
  const p2 = applyPatchEssay(p1, id, { rev: { text: "Texte amélioré.", at: 200, fb: fb2 } }, 200);
  const log = p2.examLog ?? [];
  assert.equal(log.length, 2);
  assert.deepEqual(log[0], { part: "essay", what: "courrier-voitures", score: 19, total: 25, level: "B2", scope: "full", at: 200 });
  assert.deepEqual(log[1], { part: "essay", what: "courrier-voitures", score: 15, total: 25, level: "B2", scope: "full", at: 100 });

  const { progress: p3 } = applySaveEssay(p2, { task: "mail-invitation", text: "Coucou.", fb: fb1 }, 300);
  assert.deepEqual(p3.examLog?.[0], { part: "essay", what: "mail-invitation", score: 15, total: 25, level: "B1", scope: "full", at: 300 });

  const roundTrip = sanitizeProgress({ version: 2, cards: {}, examLog: p3.examLog }, "word-atlas-open");
  assert.deepEqual(roundTrip.examLog, p3.examLog);
});

test("Wave7.2: applySaveEssay, applyPatchEssay, and recordSpeakingCorrections auto-harvest non-grammar notes deduplicated", () => {
  const mkFb = (corrections: { wrong: string; right: string; type: "word-choice" | "tense"; why: string; point: string }[]) => ({
    scores: { task: 3, coherence: 3, socio: 3, lexique: 3, morpho: 3 },
    comment: "ok",
    strengths: [],
    todo: [],
    corrections,
    rewrite: "",
  });
  const p0 = emptyProgress("word-atlas-open");
  const fbEssay = mkFb([
    { wrong: "faire une décision", right: "prendre une décision", type: "word-choice", why: "固定搭配", point: "" },
    { wrong: "bien qu'il a", right: "bien qu'il ait", type: "tense", why: "虚拟式", point: "subjonctif" },
  ]);
  const { progress: p1, id } = applySaveEssay(p0, { task: "courrier-voitures", text: "Texte.", fb: fbEssay }, 100);
  // Only non-grammar (empty point) auto-harvested into essayNotes
  assert.equal(p1.essayNotes?.length, 1);
  assert.equal(p1.essayNotes?.[0].right, "prendre une décision");

  // Patching with a duplicate and one new non-grammar correction avoids duplicating existing
  const p2 = applyPatchEssay(
    p1,
    id,
    {
      rev: {
        text: "Rev.",
        at: 200,
        fb: mkFb([
          { wrong: "faire une décision", right: "prendre une décision", type: "word-choice", why: "固定搭配", point: "" },
          { wrong: "très beaucoup", right: "énormément", type: "word-choice", why: "副词搭配", point: "" },
        ]),
      },
    },
    200,
  );
  assert.equal(p2.essayNotes?.length, 2);

  // Speaking non-grammar correction also auto-harvests into essayNotes
  const sp = recordSpeakingCorrections(
    p2,
    "Le télétravail",
    [{ wrong: "il fait sens", right: "cela a du sens", type: "word-choice", why: "地道表达", point: "" }],
    "sp-h",
    300,
  );
  assert.ok(sp);
  assert.equal(sp.next.essayNotes?.length, 3);
  assert.equal(sp.next.essayNotes?.[0].from, "口语 · Le télétravail");
});
