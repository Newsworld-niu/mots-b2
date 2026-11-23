import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeDictationSegment } from "./speech.ts";

test("mergeDictationSegment strips overlapping phrases on recognizer restart without losing repeated words in active stream", () => {
  assert.equal(mergeDictationSegment("", "Bonjour tout le monde"), "Bonjour tout le monde ");
  assert.equal(
    mergeDictationSegment("Je pense que le télétravail ", "le télétravail est utile", true),
    "Je pense que le télétravail est utile ",
  );
  assert.equal(mergeDictationSegment("Cependant ", "cependant il faut agir", true), "Cependant il faut agir ");
  assert.equal(mergeDictationSegment("C'est très ", "très important", false), "C'est très très important ");
  assert.equal(
    mergeDictationSegment("Selon moi il faut ", "moi il faut agir vite", false),
    "Selon moi il faut agir vite ",
  );
});
