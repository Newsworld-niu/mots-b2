import assert from "node:assert/strict";
import { test } from "node:test";

import { articleTone, genderOfArticle, isArticleCorrect } from "./gender.ts";

test("un / une map to masculine / feminine and are checked against the noun's gender", () => {
  assert.equal(genderOfArticle("un"), "m");
  assert.equal(genderOfArticle("une"), "f");
  assert.equal(genderOfArticle("le"), null);
  assert.equal(isArticleCorrect("une", "f"), true);
  assert.equal(isArticleCorrect("un", "f"), false);
  assert.equal(isArticleCorrect("un", undefined), false, "a noun without a quiz gender is never marked correct");
});

test("article chips get a tone per gender, both genders and plural headwords", () => {
  assert.equal(articleTone("un"), "art-m");
  assert.equal(articleTone("une"), "art-f");
  assert.equal(articleTone("un/une"), "art-mf");
  assert.equal(articleTone("des"), "art-pl");
  assert.equal(articleTone(undefined), "");
});
