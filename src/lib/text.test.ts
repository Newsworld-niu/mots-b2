import assert from "node:assert/strict";
import { test } from "node:test";
import { gap, normalize, splitHighlight, splitPair } from "./text";

test("a precomputed span wins: inflected forms and expressions are highlighted where they are", () => {
  const s = "Je veux apprendre le français.";
  assert.deepEqual(splitHighlight(s, "vouloir", [3, 7]), ["Je ", "veux", " apprendre le français."]);
  const t = "J'ai besoin d'argent pour payer le loyer.";
  assert.equal(splitHighlight(t, "avoir besoin d'argent", [2, 20])?.[1], "ai besoin d'argent");
});

test("without a span, the headword is found by exact spelling with accents, case and apostrophes", () => {
  assert.equal(splitHighlight("Il a passé l'été à Lyon.", "été")?.[1], "été");
  assert.equal(splitHighlight("Élève attentif.", "élève")?.[1], "Élève");
  assert.equal(splitHighlight("S’il vous plaît, un café.", "s'il vous plaît")?.[1], "S’il vous plaît");
  assert.equal(splitHighlight("Les élèves sont là.", "élève")?.[1], "élèves");
  assert.equal(splitHighlight("Rien à signaler.", "sel"), null);
});

test("does not match inside longer words, accented letters count as letters", () => {
  assert.equal(splitHighlight("Les bébés dorment.", "bé"), null);
  assert.equal(splitHighlight("Il est étonné.", "tonné"), null);
  assert.equal(splitHighlight("Le chat mange.", "chat")?.[1], "chat");
  assert.equal(splitHighlight("Le chaton mange.", "chat"), null);
});

test("an out-of-range span is ignored and the exact spelling is used instead", () => {
  assert.equal(splitHighlight("Le chat dort.", "chat", [40, 50])?.[1], "chat");
});

test("gaps the sentence for cloze questions", () => {
  const g = gap("Un grand silence règne dans la bibliothèque.", "régner", [17, 22]);
  assert.deepEqual(g, { before: "Un grand silence ", hidden: "règne", after: " dans la bibliothèque." });
  assert.equal(gap("Pas de mot ici.", "salade"), null);
});

test("normalizes typography from mobile keyboards", () => {
  assert.equal(normalize("  S’il  vous plaît  "), "s'il vous plaît");
  assert.deepEqual(splitPair("avoir lieu｜举行"), { en: "avoir lieu", zh: "举行" });
});
