import assert from "node:assert/strict";
import { test } from "node:test";

import { foldAccents, insertAt, spellingVerdict } from "./accent.ts";

test("exact spelling ignores case, spacing and apostrophe style", () => {
  assert.equal(spellingVerdict("Élève", "élève"), "exact");
  assert.equal(spellingVerdict("  s’il  vous plaît ", "s'il vous plaît"), "exact");
});

test("missing or wrong accents are told apart from wrong letters", () => {
  assert.equal(spellingVerdict("eleve", "élève"), "accent");
  assert.equal(spellingVerdict("élevé", "élève"), "accent");
  assert.equal(spellingVerdict("coeur", "cœur"), "accent");
  assert.equal(spellingVerdict("elive", "élève"), "wrong");
  assert.equal(spellingVerdict("tache", "tâches"), "wrong");
});

test("foldAccents expands ligatures", () => {
  assert.equal(foldAccents("Œuvre"), "oeuvre");
  assert.equal(foldAccents("français"), "francais");
});

test("insertAt replaces the selection and moves the caret after the letter", () => {
  assert.deepEqual(insertAt("ele", 2, 2, "é"), { value: "elée", caret: 3 });
  assert.deepEqual(insertAt("abc", 1, 3, "ç"), { value: "aç", caret: 2 });
  assert.deepEqual(insertAt("ab", 99, 99, "à"), { value: "abà", caret: 3 });
});

import { articleVerdict } from "./accent.ts";
import { spellTarget } from "./gender.ts";

test("a quizzed noun is spelled with its article; other words alone", () => {
  assert.equal(spellTarget({ w: "maison", art: "une", g: "f" }), "une maison");
  assert.equal(spellTarget({ w: "ami", art: "un/une" }), "ami");
  assert.equal(spellTarget({ w: "parler" }), "parler");
});

test("a wrong or missing article is told apart from a wrong noun", () => {
  assert.equal(articleVerdict("une maison", "une maison"), "exact");
  assert.equal(articleVerdict("une ecole", "une école"), "accent");
  assert.equal(articleVerdict("un maison", "une maison"), "article");
  assert.equal(articleVerdict("une homme", "un homme"), "article");
  assert.equal(articleVerdict("l'homme", "un homme"), "article");
  assert.equal(articleVerdict("maison", "une maison"), "article");
  assert.equal(articleVerdict("la maison", "une maison"), "article");
  assert.equal(articleVerdict("une maisan", "une maison"), "wrong");
  assert.equal(articleVerdict("parle", "parler"), "wrong");
});
