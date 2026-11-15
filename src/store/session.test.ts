import assert from "node:assert/strict";
import { test } from "node:test";

import { isTaughtReady, sharesSense } from "./session.ts";

test("untranslated words are not taught (no gloss, no question, no distractor)", () => {
  assert.equal(isTaughtReady({ zh: "释义待补充" }), false);
  assert.equal(isTaughtReady({ zh: "" }), false);
  assert.equal(isTaughtReady({ zh: "面试；会谈" }), true);
});

import type { Atlas, WordRef } from "../atlas/types";
import { buildSession, quizKind } from "./session.ts";
import { emptyProgress, type Progress, type Settings } from "./store.ts";
import { review, Rating } from "./srs.ts";

const ref = (id: string, word: string, order: number, g?: "m" | "f"): WordRef => ({ id, word, zh: `释义${order}`, ipa: "", cefr: 0, topic: 0, media: 0, order, ...(g ? { g } : {}) });
const settings = { spell: true, dailyNew: 10, startLevel: 0, retention: 0.9 } as Settings;
const seen = (ids: string[]): Progress => {
  const p = emptyProgress("t");
  const t = Date.now() - 3 * 86400000;
  for (const id of ids) p.cards[id] = { ...review(undefined, Rating.Good, t), due: t };
  return p;
};

test("question types follow a fixed order by stage, both ways, with un/une for nouns", () => {
  const maison = ref("maison", "maison", 0, "f");
  const parler = ref("parler", "parler", 1);
  const at = (r: WordRef, reps: number, st = 2) => {
    const p = emptyProgress("t");
    if (reps > 0) p.cards[r.id] = { ...review(undefined, Rating.Good, Date.now()), reps, st: st as 0 | 1 | 2 | 3 };
    return quizKind(r, p, settings);
  };
  assert.deepEqual([0, 1, 2, 3, 4].map((n) => at(maison, n)), ["meaning", "gender", "cloze", "spell", "dictation"]);
  assert.deepEqual([0, 1, 2, 3].map((n) => at(parler, n)), ["meaning", "cloze", "spell", "dictation"]);
  assert.ok(!Array.from({ length: 20 }, (_, n) => at(parler, n)).includes("gender"), "a word without gender is never asked un/une");
  assert.equal(at(maison, 7, 3), "meaning", "a card relearned after a lapse goes back to recognition");
  const noSpell = { ...settings, spell: false };
  const kindsNoSpell = Array.from({ length: 20 }, (_, n) => {
    const p = emptyProgress("t");
    if (n > 0) p.cards.parler = { ...review(undefined, Rating.Good, Date.now()), reps: n, st: 2 };
    return quizKind(parler, p, noSpell);
  });
  assert.ok(!kindsNoSpell.some((k) => k === "spell" || k === "dictation"), "with spelling off nothing is typed");
});

test("after the first pass, question types are random: no repeats, recall at least once in three", () => {
  const at = (r: WordRef, reps: number) => {
    const p = emptyProgress("t");
    p.cards[r.id] = { ...review(undefined, Rating.Good, Date.now()), reps, st: 2 };
    return quizKind(r, p, settings);
  };
  const words = Array.from({ length: 12 }, (_, i) => ref(`w${i}`, `mot${i}`, i, i % 2 ? "m" : undefined));
  const runs = words.map((w) => Array.from({ length: 30 }, (_, n) => at(w, (w.g ? 5 : 4) + n)));
  for (const run of runs) {
    run.forEach((k, n) => n > 0 && assert.notEqual(k, run[n - 1], "never the same type twice in a row"));
    for (let n = 2; n < run.length; n++) assert.ok(run.slice(n - 2, n + 1).includes("spell"), "recall at least once in any three");
  }
  // not one fixed rotation: words of the same kind get different sequences
  const nouns = runs.filter((_, i) => i % 2).map((r) => r.join());
  assert.ok(new Set(nouns).size > 1);
});

test("gender steps carry no options list; the two articles are fixed", () => {
  const words = Array.from({ length: 40 }, (_, i) => ref(`n${i}`, `nom${i}`, i, i % 2 ? "m" : "f"));
  const atlas = { words, byId: new Map(words.map((w) => [w.id, w])), pairs: new Set<string>() } as unknown as Atlas;
  const s = buildSession(atlas, seen(words.map((w) => w.id)), settings);
  const gender = s.steps.filter((x) => x.kind === "gender");
  assert.ok(gender.length > 0);
  assert.ok(gender.every((x) => !("options" in x) || x.options === undefined));
});

test("a wrong option never shares a meaning with the answer, including its second sense", () => {
  const w = (zh: string, more?: string[]) => ({ id: zh, word: zh, zh, ipa: "", cefr: 0, topic: 0, media: 0, order: 0, ...(more ? { more } : {}) });
  const entretien = w("面试；会谈", ["维护；保养"]);
  assert.equal(sharesSense(entretien, w("保养")), true);
  assert.equal(sharesSense(entretien, w("维护；修理")), true);
  assert.equal(sharesSense(entretien, w("桌子")), false);
});

import { withMistake } from "./session.ts";

test("a mistake moves to the front once and the list stays capped", () => {
  assert.deepEqual(withMistake(["b", "a"], "a"), ["a", "b"]);
  assert.deepEqual(withMistake([], "x"), ["x"]);
  const long = Array.from({ length: 300 }, (_, i) => `w${i}`);
  const next = withMistake(long, "new");
  assert.equal(next.length, 300);
  assert.equal(next[0], "new");
  assert.equal(next.includes("w299"), false);
});

import { nextNew } from "./session.ts";

test("new words mix two nouns into every five, keeping path order within each kind", () => {
  const words = Array.from({ length: 30 }, (_, i) => ({ ...ref(`w${i}`, `w${i}`, i, i >= 20 ? "f" : undefined), topic: i % 2 }));
  const atlas = { words, byId: new Map(words.map((w) => [w.id, w])), topics: [["a", "A"], ["b", "B"]] } as unknown as Atlas;
  const ids = nextNew(atlas, emptyProgress("t"), settings, 10);
  assert.deepEqual(ids.slice(0, 5), ["w0", "w20", "w1", "w21", "w2"]);
  assert.equal(new Set(ids).size, 10);
});

test("a focus topic limits new words to that topic", () => {
  const words = Array.from({ length: 30 }, (_, i) => ({ ...ref(`w${i}`, `w${i}`, i), topic: i % 3 === 0 ? 1 : 0 }));
  const atlas = { words, byId: new Map(words.map((w) => [w.id, w])), topics: [["a", "A"], ["b", "B"]] } as unknown as Atlas;
  const ids = nextNew(atlas, emptyProgress("t"), { ...settings, focusTopic: "b" }, 5);
  assert.deepEqual(ids, ["w0", "w3", "w6", "w9", "w12"]);
});

import { distractors } from "./session.ts";

test("a French option never contains the answer or sits inside it", () => {
  const words = ["être", "être à jour", "peut-être", "tout", "cela", "avoir", "faire", "dire", "aller", "voir"].map((w, i) => ({ ...ref(`w${i}`, w, i), zh: `义${i}` }));
  const atlas = { words, byId: new Map(words.map((w) => [w.id, w])) } as unknown as Atlas;
  for (let seed = 1; seed < 30; seed++) {
    const opts = distractors(atlas, words[0], "cloze", seed).map((id) => atlas.byId.get(id)!.word);
    assert.ok(!opts.includes("être à jour") && !opts.includes("peut-être"), opts.join(", "));
  }
});

import { pickPairing, withPairing, PAIR_EVERY } from "./session.ts";
import type { Step } from "./store.ts";

const pairAtlas = (n: number) => {
  const words = Array.from({ length: n }, (_, i) => ({ ...ref(`w${i}`, `mot${i}`, i), zh: `义${i}` }));
  return { words, byId: new Map(words.map((w) => [w.id, w])), pairs: new Set<string>() } as unknown as Atlas;
};

test("a pairing round follows every ten questions and uses words already asked", () => {
  const atlas = pairAtlas(30);
  const steps: Step[] = Array.from({ length: 25 }, (_, i) => ({ id: `w${i}`, kind: "meaning" as const }));
  const out = withPairing(atlas, emptyProgress("t"), steps, 1);
  const at = out.map((s, i) => (s.kind === "pairing" ? i : -1)).filter((i) => i >= 0);
  assert.deepEqual(at, [PAIR_EVERY, PAIR_EVERY * 2 + 1], "after the 10th and 20th question");
  const first = out[at[0]] as Extract<Step, { kind: "pairing" }>;
  assert.equal(first.ids.length, 5);
  assert.ok(first.ids.every((id) => Number(id.slice(1)) < PAIR_EVERY), "only words asked before the round");
});

test("pairing prefers words missed most and early in learning; no two share a meaning", () => {
  const atlas = pairAtlas(8);
  (atlas.byId.get("w1") as { zh: string }).zh = "义0";
  const p = emptyProgress("t");
  for (let i = 0; i < 8; i++) p.cards[`w${i}`] = { ...review(undefined, Rating.Good, Date.now()), reps: 5, lapses: 0 };
  p.cards.w7 = { ...p.cards.w7, lapses: 3 };
  const ids = pickPairing(atlas, p, atlas.words.map((w) => w.id), 1)!;
  assert.equal(ids[0], "w7", "the most-missed word comes first");
  assert.ok(!(ids.includes("w0") && ids.includes("w1")), "two words with the same meaning are never paired together");
  assert.equal(pickPairing(atlas, p, ["w0", "w1", "w2"], 1), null, "fewer than five usable words: no round");
});

import { applyIntro } from "./session.ts";

test("applyIntro: 认识 changes nothing, 不认识 is noted, 完全认识 grades Easy and drops the word's questions", () => {
  const steps: Step[] = [
    { id: "a", kind: "intro" },
    { id: "b", kind: "intro" },
    { id: "b", kind: "meaning", options: ["b", "x", "y", "z"] },
    { id: "a", kind: "meaning", options: ["a", "x", "y", "z"] },
    { id: "a", kind: "cloze", options: ["a", "x", "y", "z"] },
  ];
  const base: Progress = { ...emptyProgress("t"), session: { id: "s", started: 0, steps, index: 0, graded: {}, newIds: ["a", "b"], reviewIds: [] } };
  assert.equal(applyIntro(base, "a", "known", 0.9), base);

  const unknown = applyIntro(base, "a", "unknown", 0.9);
  assert.deepEqual(unknown.session?.unknown, ["a"]);
  assert.equal(unknown.cards.a, undefined);
  assert.equal(unknown.session?.steps.length, 5);
  assert.equal(applyIntro(unknown, "a", "unknown", 0.9), unknown);

  const now = Date.UTC(2026, 0, 1);
  const done = applyIntro(base, "a", "mastered", 0.9, now);
  assert.equal(done.session?.graded.a, Rating.Easy);
  assert.deepEqual(done.session?.steps.map((x) => `${x.kind}:${"id" in x ? x.id : ""}`), ["intro:a", "intro:b", "meaning:b"]);
  // straight to long-term review, days away, where 认识 + a right answer would be minutes away
  assert.equal(done.cards.a.st, 2);
  assert.ok(done.cards.a.due - now > 3 * 86400000);
  assert.ok(review(undefined, Rating.Good, now).due - now < 86400000);
  // only once per word
  assert.equal(applyIntro(done, "a", "mastered", 0.9, now), done);
});
