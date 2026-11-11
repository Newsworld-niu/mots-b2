import assert from "node:assert/strict";
import { test } from "node:test";

import type { WordRef } from "../atlas/types.ts";
import type { DictHit } from "./dict.ts";
import { annotate, coverage, pickTargets, readStats, sanitizeTexts, titleOf, unknownShare } from "./reader.ts";

const ref = (id: string, word: string): WordRef => ({ id, word, zh: id, ipa: "", cefr: 0, topic: 0, media: 0, order: 0 });
const atlas = { words: [ref("vouloir", "vouloir"), ref("marche", "marché"), ref("homme", "homme"), ref("avec", "avec"), ref("aujourdhui", "aujourd'hui"), ref("ami", "ami"), ref("marie", "marié")], custom: [] };
const dict: Record<string, DictHit[]> = {
  voulons: [{ w: "vouloir", p: "v.", form: "voulons" }],
  pain: [{ w: "pain", p: "n.m.", zh: [["面包", ""]] }],
};
const lookup = async (w: string) => dict[w] ?? [];
const status = (id: string) => (id === "homme" ? "known" : id === "vouloir" ? "learning" : "new") as "new" | "learning" | "known";

test("words are matched to the atlas, through the dictionary, or left as names and unknowns", async () => {
  const paras = await annotate("Aujourd'hui, nous voulons du pain avec l'homme.\nMarie va au marché avec Zorglub et des amis xyzzy.", atlas, status, lookup);
  assert.equal(paras.length, 2);
  const all = paras.flat().flatMap((s) => s.tokens);
  const by = (t: string) => all.find((x) => x.t === t)!;
  assert.equal(by("Aujourd'hui").id, "aujourdhui", "a word spelled with an apostrophe is one token");
  assert.deepEqual([by("voulons").id, by("voulons").status], ["vouloir", "learning"], "an inflected form leads to its lemma");
  assert.deepEqual([by("pain").status, by("pain").hit?.w], ["new", "pain"], "a dictionary word the atlas lacks");
  assert.deepEqual([by("homme").t, by("homme").status], ["homme", "known"], "the elided article is not part of the word");
  assert.deepEqual([by("avec").id, by("avec").status], ["avec", "function"], "a function word opens its entry but is never coloured");
  assert.equal(by("Marie").status, "name", "Marie is not marié");
  assert.equal(by("Zorglub").status, "name");
  assert.equal(by("amis").id, "ami", "a plural the dictionary does not list");
  assert.equal(by("xyzzy").status, "unknown");
  const inv = (await annotate("Que veut-il ? Vouloir, a-t-elle dit.", { words: [ref("vouloir", "vouloir")], custom: [] }, status, async (w) => (w === "veut" ? dict.voulons : []))).flat().flatMap((s) => s.tokens);
  assert.deepEqual(inv.map((x) => x.t), ["Que", "veut", "Vouloir", "a", "dit"], "an inverted pronoun is not part of the word");
  assert.equal(inv[1].id, "vouloir");
  for (const s of paras.flat()) for (const t of s.tokens) assert.equal(s.text.slice(t.s, t.e), t.t, "spans point at the word as written");
});

test("stats count distinct words; coverage and the unknown share check an AI text", async () => {
  const paras = await annotate("Nous voulons du pain. Nous voulons un homme xyzzy.", atlas, status, lookup);
  assert.deepEqual(readStats(paras), { new: 1, learning: 1, known: 1, unknown: 1 });
  assert.deepEqual(coverage(paras, ["vouloir", "ami"]), { used: ["vouloir"], missing: ["ami"] });
  assert.equal(unknownShare(paras), 1 / 5);
});

test("targets: mistakes, then the most overdue, then the last seen", () => {
  const cards = { a: { due: 50, last: 1 }, b: { due: 10, last: 2 }, c: { due: 999, last: 9 }, d: { due: 999, last: 3 }, gone: { due: 1 } };
  assert.deepEqual(pickTargets(cards, ["d", "nocard"], (id) => id !== "gone", 100, 10), ["d", "b", "a", "c"]);
  assert.deepEqual(pickTargets(cards, [], () => true, 100, 2), ["gone", "b"]);
});

test("saved texts from a backup are cleaned, and a broken quiz is dropped", () => {
  const out = sanitizeTexts([
    { id: "t-abc123", title: "", text: "Bonjour tout le monde.\nSuite.", created: 5, src: "ai", level: "B1", zh: "大家好。", targets: ["a", 3], quiz: [{ q: "问", options: ["甲", "乙"], answer: 1, why: "" }, { q: "坏", options: ["甲"], answer: 0 }, { q: "越界", options: ["甲", "乙"], answer: 2 }] },
    { id: "t-abc123", text: "duplicate" },
    { id: "nope", text: "x" },
    { id: "t-empty1", text: "  " },
  ])!;
  assert.equal(out.length, 1);
  assert.equal(out[0].title, "Bonjour tout le monde.");
  assert.deepEqual(out[0].targets, ["a"]);
  assert.equal(out[0].quiz?.length, 1);
  assert.equal(sanitizeTexts("x"), undefined);
  assert.equal(titleOf("Un très long titre qui n'en finit pas de continuer encore et encore"), "Un très long titre qui n'en finit pas…");
});
