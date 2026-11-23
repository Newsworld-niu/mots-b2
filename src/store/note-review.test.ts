import assert from "node:assert/strict";
import { test } from "node:test";
import type { GrammarMeta } from "../lib/grammar.ts";
import { MISS_CAUSES } from "../lib/listening.ts";
import { review, Rating } from "./srs.ts";
import { emptyProgress } from "./store.ts";
import {
  applyDeleteSpeakingCorrection,
  applyGradeReflow,
  applyRemoveWordMistake,
  compMissReflowKey,
  essayNoteReflowKey,
  unifiedMistakeCounts,
} from "./note-review.ts";

test("unifiedMistakeCounts aggregates words, grammar meta, essay notes, speaking corrections, and comp misses", () => {
  const now = 1_750_000_000_000;
  const meta: GrammarMeta = {
    v: 1,
    points: [
      { id: "subjonctif", level: "B1", title: "虚拟式", fr: "Le subjonctif" },
      { id: "relatifs", level: "B2", title: "复合关系代词", fr: "Les pronoms relatifs" },
    ],
  };
  let p = emptyProgress("test");
  p.mistakes = ["abandonner", "pallier"];
  p.gram = { subjonctif: review(undefined, Rating.Again, now - 86_400_000) };
  const note1 = { id: "n1", wrong: "a", right: "b", type: "word-choice" as const, why: "col", point: "", at: now - 5000, from: "Essay 1" };
  const note2 = { id: "n2", wrong: "c", right: "d", type: "agreement" as const, why: "rel", point: "relatifs", at: now - 4000, from: "Essay 2" };
  p.essayNotes = [note1, note2];
  p.speakCorrections = [
    {
      id: "sp1",
      subject: "Télétravail",
      at: now - 3000,
      corrections: [{ wrong: "il faut faire", right: "il convient de", type: "word-choice", why: "语域", point: "" }],
    },
  ];
  const miss1 = { part: "listen" as const, skill: "inference" as const, cause: MISS_CAUSES[0], at: now - 2000, q: "Q1" };
  p.compMisses = [miss1];

  const counts = unifiedMistakeCounts(p, meta, now);
  assert.equal(counts.words, 2);
  assert.equal(counts.grammarDue, 1);
  assert.equal(counts.grammarUntouched, 1);
  assert.equal(counts.grammarTotal, 2);
  assert.equal(counts.essayDue, 1);
  assert.equal(counts.speakCount, 1);
  assert.equal(counts.sentencesTotal, 2);
  assert.equal(counts.compDue, 1);
  assert.equal(counts.total, 7);

  p = applyRemoveWordMistake(p, "abandonner");
  assert.deepEqual(p.mistakes, ["pallier"]);

  p = applyDeleteSpeakingCorrection(p, "sp1", 0);
  assert.equal(p.speakCorrections, undefined);

  const noteKey = essayNoteReflowKey(note1);
  const rated = applyGradeReflow(p, noteKey, Rating.Good, 0.9, now);
  assert.ok((rated.noteCards?.[noteKey]?.due ?? 0) > now);
  assert.notEqual(compMissReflowKey(miss1), noteKey);
});
