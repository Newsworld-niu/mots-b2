import assert from "node:assert/strict";
import { test } from "node:test";

import type { Atlas, WordRef } from "../atlas/types";
import type { ConjData } from "../atlas/conj";
import type { ConjVerb } from "../lib/conjugation";
import { activeTenses, conjGrade, conjKey, conjPlan, newConj, splitKey, stepFor, unlockedVerbs } from "./conj.ts";
import { review, Rating } from "./srs.ts";
import { defaultSettings, emptyProgress, sanitizeProgress, sanitizeSettings } from "./store.ts";

const six = (s: string) => [s + "1", s + "2", s + "3", s + "4", s + "5", s + "6"];
const verb = (i: string): ConjVerb => ({ i, a: "a", pp: i + "é", m: "er", f: { pres: six(i), imp: six(i), fut: six(i), cond: six(i), subj: six(i) } });
const words: WordRef[] = ["etre", "maison", "parler", "finir"].map((id, order) => ({ id, word: id, zh: id, ipa: "", cefr: 0, topic: 0, media: 0, order }));
const atlas = { words, byId: new Map(words.map((w) => [w.id, w])) } as unknown as Atlas;
const data: ConjData = { v: 1, verbs: { etre: verb("etre"), parler: verb("parler"), finir: verb("finir") } };

test("only learned verbs with a checked table are unlocked, in path order", () => {
  const p = emptyProgress("t");
  p.cards.parler = review(undefined, Rating.Good, Date.now());
  p.cards.maison = review(undefined, Rating.Good, Date.now());
  p.cards.etre = review(undefined, Rating.Good, Date.now());
  assert.deepEqual(unlockedVerbs(atlas, p, data), ["etre", "parler"]);
});

test("tenses follow the start level unless chosen; new cards go tense by tense", () => {
  assert.deepEqual(activeTenses({ ...defaultSettings, startLevel: 0 }), ["pres", "pc"]);
  assert.deepEqual(activeTenses({ ...defaultSettings, conjTenses: ["subj", "pres"] }), ["pres", "subj"]);
  const p = emptyProgress("t");
  for (const id of ["etre", "parler", "finir"]) p.cards[id] = review(undefined, Rating.Good, Date.now());
  assert.deepEqual(newConj(atlas, p, defaultSettings, data, 4), ["etre|pres", "parler|pres", "finir|pres", "etre|pc"]);
});

test("daily plan respects the new-card limit and lists due cards", () => {
  const p = emptyProgress("t");
  for (const id of ["etre", "parler", "finir"]) p.cards[id] = review(undefined, Rating.Good, Date.now());
  p.conj = { [conjKey("parler", "pres")]: { ...review(undefined, Rating.Good, Date.now() - 864e5 * 5), due: Date.now() - 1000 } };
  const plan = conjPlan(atlas, p, { ...defaultSettings, conjNew: 2 }, data);
  assert.deepEqual(plan.due, ["parler|pres"]);
  assert.equal(plan.fresh.length, 2);
  assert.ok(!plan.fresh.includes("parler|pres"));
});

test("new cards are asked as choices; grading treats accent slips as Hard", () => {
  const p = emptyProgress("t");
  assert.equal(stepFor("parler|pres", p, data, 1).kind, "choice");
  assert.equal(stepFor("parler|pres", p, data, 1).isNew, true);
  assert.deepEqual(splitKey("a|b|pc"), { verbId: "a|b", tense: "pc" });
  assert.equal(conjGrade("wrong", 1000, "type"), Rating.Again);
  assert.equal(conjGrade("accent", 1000, "type"), Rating.Hard);
  assert.equal(conjGrade("right", 3000, "type"), Rating.Easy);
  assert.equal(conjGrade("right", 3000, "choice"), Rating.Good);
});

test("conjugation progress and settings survive the validator; junk is dropped", () => {
  const card = review(undefined, Rating.Good, Date.now());
  const p = sanitizeProgress({ ...emptyProgress("t"), conj: { "parler|pres": card, "parler|bogus": card, x: 1 }, conjDays: { "2026-11-05": { n: 1, r: 2, c: 1 }, bad: {} } }, "t");
  assert.deepEqual(Object.keys(p.conj ?? {}), ["parler|pres"]);
  assert.deepEqual(Object.keys(p.conjDays ?? {}), ["2026-11-05"]);
  const s = sanitizeSettings({ conjTenses: ["pres", "nope", "pres"], conjNew: 8 });
  assert.deepEqual(s.conjTenses, ["pres"]);
  assert.equal(s.conjNew, 8);
});
