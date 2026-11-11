import assert from "node:assert/strict";
import { test } from "node:test";

import { liaisonPoints } from "./liaison.ts";

/** The sentence with ‿ at every liaison point, for readable assertions. */
const mark = (s: string) => {
  const pts = new Set(liaisonPoints(s));
  return [...s].map((c, i) => (pts.has(i) ? "‿" : c)).join("");
};

test("determiners and pronouns link to a following vowel", () => {
  assert.equal(mark("Les enfants ont des amis."), "Les‿enfants ont des‿amis.");
  assert.equal(mark("Nous avons un ami."), "Nous‿avons un‿ami.");
  assert.equal(mark("Ils habitent en Italie."), "Ils‿habitent en‿Italie.");
  assert.equal(mark("Elle a deux heures et six ans."), "Elle a deux‿heures et six‿ans.");
  assert.equal(mark("Qu'ils y aillent."), "Qu'ils‿y aillent.");
});

test("no mark where liaison is wrong or uncertain", () => {
  assert.equal(mark("Les héros sont là."), "Les héros sont là.", "h aspiré");
  assert.equal(mark("Vous et moi."), "Vous et moi.");
  assert.equal(mark("L'un et l'autre."), "L'un et l'autre.");
  assert.equal(mark("Vous, avez-vous un stylo ?"), "Vous, avez-vous un stylo ?");
  assert.equal(mark("Ont-ils une voiture ?"), "Ont-ils une voiture ?");
  assert.equal(mark("Les onze joueurs."), "Les onze joueurs.");
  assert.equal(mark("Vous aussi."), "Vous aussi.");
  assert.equal(mark("Quelqu'un est venu."), "Quelqu'un est venu.");
});
