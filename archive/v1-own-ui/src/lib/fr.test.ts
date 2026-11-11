import { test } from "node:test";
import assert from "node:assert/strict";
import { accuracyOf, clozeOf, diagnose, fold, levenshtein, shuffle } from "./fr.ts";

test("fold strips accents and lowercases", () => {
  assert.equal(fold("Vérifier Élève œuvre"), "verifier eleve oeuvre");
});

test("diagnose distinguishes exact, accent-only and wrong answers", () => {
  assert.equal(diagnose("vérifier", "vérifier"), "exact");
  assert.equal(diagnose("Vérifier ", "vérifier"), "exact");
  assert.equal(diagnose("verifier", "vérifier"), "accent");
  assert.equal(diagnose("verifer", "vérifier"), "wrong");
  assert.equal(diagnose("l'inégalité", "l’inégalité"), "exact");
});

test("levenshtein and dictation accuracy", () => {
  assert.equal(levenshtein("kitten", "sitting"), 3);
  assert.equal(accuracyOf("Bonjour !", "bonjour"), 100);
  assert.equal(accuracyOf("bonjor", "bonjour"), 86);
  assert.equal(accuracyOf("", "abc"), 0);
});

test("clozeOf blanks the exact headword or an inflected form", () => {
  const exact = clozeOf("Il possède un diplôme d'ingénieur.", "diplôme");
  assert.deepEqual(exact, { before: "Il possède un ", answer: "diplôme", after: " d'ingénieur." });
  const inflected = clozeOf("Les enseignants ont organisé une grève.", "enseignant");
  assert.equal(inflected?.answer, "enseignants");
  assert.equal(clozeOf("Rien à voir ici.", "diplôme"), null);
});

test("shuffle is deterministic for a seed and keeps all items", () => {
  const a = shuffle([1, 2, 3, 4, 5], 42);
  assert.deepEqual(a, shuffle([1, 2, 3, 4, 5], 42));
  assert.deepEqual([...a].sort(), [1, 2, 3, 4, 5]);
});
