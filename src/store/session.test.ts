import assert from "node:assert/strict";
import { test } from "node:test";

import { isSpellableHeadword } from "../lib/gender.ts";
import { isTaughtReady, sharesSense } from "./session.ts";

test("untranslated words are not taught (no gloss, no question, no distractor)", () => {
  assert.equal(isTaughtReady({ zh: "释义待补充" }), false);
  assert.equal(isTaughtReady({ zh: "" }), false);
  assert.equal(isTaughtReady({ zh: "面试；会谈" }), true);
});

import type { Atlas, WordRef } from "../atlas/types";
import { applySuspendLeech, answer, advance, buildSession, canRegradePending, canUndoStep, dueIds, forgettingRiskCards, introduce, leechIds, quizKind, regradePending, resetSessionUndo, todayPlan, undoLastStep } from "./session.ts";
import { emptyProgress, store, type Progress, type QuizKind, type Settings, type Step } from "./store.ts";
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

test("part-of-speech study filters new words and reviews across selected decks", async () => {
  const { todayPlan } = await import("./session.ts");
  const { defaultSettings, sanitizeSettings } = await import("./store.ts");
  const words = [
    { ...ref("chat", "chat", 0), pos: ["n.m."] },
    { ...ref("calme", "calme", 1), pos: ["n.m.", "adj."] },
    { ...ref("parler", "parler", 2), pos: ["v."] },
    { ...ref("u-custom1", "custom", 3), pos: ["adj."], custom: true as const },
  ];
  const atlas = { words: words.slice(0, 3), custom: words.slice(3), byId: new Map(words.map(w => [w.id, w])), topics: [["daily", "日常"]] } as unknown as Atlas;
  const p = emptyProgress("t");
  p.decks = [{ id: "d-test1", name: "test", created: 1, words: words.map(w => w.id) }];
  const s = { ...defaultSettings, studyDecks: ["d-test1"], studyPos: ["adjective"] };
  assert.deepEqual(todayPlan(atlas, p, s).fresh, ["calme", "u-custom1"]);
  p.cards.calme = { ...review(undefined, Rating.Good, Date.now()), due: 0 };
  p.cards.parler = { ...review(undefined, Rating.Good, Date.now()), due: 0 };
  assert.deepEqual(todayPlan(atlas, p, s).due, ["calme"]);
  assert.equal(todayPlan(atlas, p, s).otherDue, 1);
  assert.deepEqual(todayPlan(atlas, p, { ...s, studyPos: ["noun"] }).due, ["calme"]);
  assert.deepEqual(todayPlan(atlas, p, { ...s, studyPos: null }).due.sort(), ["calme", "parler"]);
  assert.deepEqual(sanitizeSettings(s).studyPos, ["adjective"]);
  assert.deepEqual(todayPlan(atlas, p, { ...s, studyPos: ["noun", "adjective"] }).due, ["calme"]);
  assert.deepEqual(todayPlan(atlas, p, { ...s, studyPos: ["adjective", "verb"] }).due.sort(), ["calme", "parler"]);
  assert.deepEqual(sanitizeSettings({ studyPos: "noun" }).studyPos, ["noun"]);
  assert.equal(sanitizeSettings({ studyPos: "invalid" }).studyPos, null);
});

test("SYS-1: after migrateCoreDeck (coreMigrated: true), nextNew honours startLevel, coreSet priority, focusTopic, noun slots and user deck precedence", async () => {
  const { CORE_DECK } = await import("./store.ts");
  const { CORE_NAME } = await import("./decks.ts");
  const mk = (id: string, word: string, cefr: number, topic: number, order: number, g?: "m" | "f"): WordRef => ({
    ...ref(id, word, order, g),
    cefr,
    topic,
  });
  const words: WordRef[] = [
    mk("a1-verb", "etre", 0, 0, 0),
    mk("a1-noun", "chat", 0, 0, 1, "m"),
    mk("a2-verb", "aller", 1, 0, 2),
    mk("a2-noun", "train", 1, 1, 3, "m"),
    mk("b1-core-v1", "agir", 2, 0, 4),
    mk("b1-core-v2", "reduire", 2, 0, 5),
    mk("b1-core-v3", "penser", 2, 0, 6),
    mk("b1-core-n1", "preuve", 2, 0, 7, "f"),
    mk("b2-core-n2", "enjeu", 3, 0, 8, "m"),
    mk("b2-topic-core", "gaspiller", 3, 1, 2001),
    mk("b1-noncore", "nuance", 2, 0, 2000),
    mk("b2-noncore-n", "bilan", 3, 1, 2002, "m"),
  ];
  const customWord: WordRef = { id: "u-custom1", word: "fauteuil", zh: "扶手椅", ipa: "", cefr: -1, topic: -1, media: 0, order: -1, g: "m", custom: true };
  const atlas = {
    words,
    custom: [customWord],
    byId: new Map([...words, customWord].map((w) => [w.id, w])),
    topics: [["a", "A"], ["b", "B"]],
  } as unknown as Atlas;

  const p: Progress = {
    ...emptyProgress("t"),
    coreMigrated: true,
    cards: { "b1-core-v1": review(undefined, Rating.Good, Date.now()) },
    decks: [
      { id: CORE_DECK, name: CORE_NAME, created: 0, words: words.filter((w) => w.id !== "b1-core-v3").map((w) => w.id) },
    ],
  };

  // B1 startLevel=2: skips A1/A2 and already-learned b1-core-v1 and removed b1-core-v3; picks coreSet B1/B2 words with noun slots [1, 3], then non-core B1/B2, then A1/A2 fallback
  const b1 = nextNew(atlas, p, { ...settings, startLevel: 2 }, 7);
  assert.deepEqual(b1, ["b1-core-v2", "b1-core-n1", "b2-topic-core", "b2-core-n2", "b1-noncore", "b2-noncore-n", "a1-verb"]);

  // focusTopic limits to topic 1 ("b"), still preferring >= startLevel and falling back to A2 within topic 1
  const topicOnly = nextNew(atlas, p, { ...settings, startLevel: 2, focusTopic: "b" }, 5);
  assert.deepEqual(topicOnly, ["b2-topic-core", "b2-noncore-n", "a2-noun"]);

  // User's own deck comes before CORE_DECK even if created after CORE_DECK in p.decks, and custom words inside CORE_DECK are reachable
  const withUserDeck: Progress = {
    ...p,
    decks: [
      { id: CORE_DECK, name: CORE_NAME, created: 0, words: [...p.decks![0].words, "u-custom1"] },
      { id: "d-trip1", name: "Trip", created: 1, words: ["a2-noun"] },
    ],
  };
  const mixed = nextNew(atlas, withUserDeck, { ...settings, startLevel: 2 }, 3);
  assert.equal(mixed[0], "a2-noun");
  assert.ok(mixed.includes("b1-core-v2") && mixed.includes("b1-core-n1"));
  assert.ok(nextNew(atlas, withUserDeck, { ...settings, startLevel: 2 }, 20).includes("u-custom1"));

  // Selecting only user's own deck ignores CORE_DECK
  assert.deepEqual(nextNew(atlas, withUserDeck, { ...settings, startLevel: 2, studyDecks: ["d-trip1"] }, 5), ["a2-noun"]);

  // Deleting CORE_DECK yields no core words
  const deletedCore: Progress = { ...emptyProgress("t"), coreMigrated: true, decks: [] };
  assert.deepEqual(nextNew(atlas, deletedCore, { ...settings, startLevel: 2 }, 5), []);
});

test("Phase3: regradePending overrides FSRS grade & mistakes/days.c accurately and undoLastStep restores pre-step state", () => {
  const words: WordRef[] = [ref("w1", "etre", 0), ref("w2", "avoir", 1)];
  const a = { words, byId: new Map(words.map((w) => [w.id, w])) } as unknown as Atlas;
  resetSessionUndo();
  store.settings(settings);
  const s = buildSession(a, emptyProgress("t"), settings, { ids: ["w1", "w2"] });
  store.progress(() => ({ ...emptyProgress("t"), session: s }));
  const step0 = s.steps.find((x): x is Extract<Step, { kind: QuizKind }> => x.kind !== "intro" && x.kind !== "pairing")!;
  const quizIdx = s.steps.indexOf(step0);
  store.progress((p) => (p.session ? { ...p, session: { ...p.session, index: quizIdx } } : p));

  answer(a, step0, false, Rating.Again, "wrong-opt");
  assert.equal(canRegradePending(s.id, quizIdx), true);
  assert.equal(canUndoStep(s.id), true);
  assert.ok(store.get().progress.mistakes.includes(step0.id));

  assert.equal(regradePending(Rating.Easy, a), true);
  let cur = store.get().progress;
  assert.equal(cur.session?.graded[step0.id], Rating.Easy);
  assert.equal(cur.session?.pending?.grade, Rating.Easy);
  assert.equal(cur.session?.pending?.correct, true);
  assert.ok(!cur.mistakes.includes(step0.id), "switching away from Again removes newly added mistake");

  advance(5);
  assert.equal(store.get().progress.session?.index, quizIdx + 1);
  assert.equal(undoLastStep(), true);
  cur = store.get().progress;
  assert.equal(cur.session?.index, quizIdx);
  assert.equal(cur.session?.pending, undefined);
  assert.equal(cur.cards[step0.id], undefined);
  assert.equal(canUndoStep(s.id), false);

  const introIdx = s.steps.findIndex((x) => x.kind === "intro");
  const introStep = s.steps[introIdx] as Extract<(typeof s.steps)[number], { kind: "intro" }>;
  store.progress((p) => (p.session ? { ...p, session: { ...p.session, index: introIdx } } : p));
  introduce(introStep.id, "mastered", 3);
  assert.equal(store.get().progress.session?.graded[introStep.id], Rating.Easy);
  assert.equal(undoLastStep(), true);
  assert.equal(store.get().progress.session?.index, introIdx);
  assert.equal(store.get().progress.cards[introStep.id], undefined);
});

test("isSpellableHeadword and quizKind exclude >4-word phrases and slashed variants from spelling", () => {
  assert.equal(isSpellableHeadword("entretien"), true);
  assert.equal(isSpellableHeadword("mise en œuvre"), true);
  assert.equal(isSpellableHeadword("avoir du mal à s'endormir"), false);
  assert.equal(isSpellableHeadword("généraliste / spécialiste"), false);
  assert.equal(isSpellableHeadword("économiser pour + inf"), false);

  const longPhrase = ref("avoir-du-mal-a-s-endormir", "avoir du mal à s'endormir", 0);
  const slashVariant = ref("generaliste-specialiste", "généraliste / spécialiste", 1);
  for (let reps = 0; reps < 10; reps++) {
    const pLong = emptyProgress("t");
    const pSlash = emptyProgress("t");
    if (reps > 0) {
      pLong.cards[longPhrase.id] = { ...review(undefined, Rating.Good, Date.now()), reps, st: 2 };
      pSlash.cards[slashVariant.id] = { ...review(undefined, Rating.Good, Date.now()), reps, st: 2 };
    }
    const kLong = quizKind(longPhrase, pLong, settings);
    const kSlash = quizKind(slashVariant, pSlash, settings);
    assert.ok(kLong !== "spell" && kLong !== "dictation", `unexpected ${kLong} at reps=${reps}`);
    assert.ok(kSlash !== "spell" && kSlash !== "dictation", `unexpected ${kSlash} at reps=${reps}`);
  }
});

test("Wave7.2: dailyReviewCap caps due & reports overflowDue; leech suspension excludes from dueIds; forgettingRiskCards sorts lowest first", () => {
  const words: WordRef[] = Array.from({ length: 16 }, (_, i) => ref(`w${i}`, `mot${i}`, i));
  const atlas = { words, byId: new Map(words.map((w) => [w.id, w])), pairs: new Set<string>() } as unknown as Atlas;
  const now = Date.now();
  let p = emptyProgress("t");
  for (const [idx, w] of words.entries()) {
    const c = review(undefined, Rating.Good, now - 10 * 86_400_000);
    p.cards[w.id] = {
      ...c,
      due: now - (idx + 1) * 60_000,
      s: idx === 0 ? 1 : 5,
      last: now - 10 * 86_400_000,
      lapses: idx === 15 ? 7 : 0,
    };
  }

  const capped = todayPlan(atlas, p, { ...settings, dailyReviewCap: 10 });
  assert.equal(capped.due.length, 10);
  assert.equal(capped.overflowDue, 6);

  assert.deepEqual(leechIds(p), ["w15"]);
  assert.ok(dueIds(p, now).includes("w15"));
  p = applySuspendLeech(p, "w15", true);
  assert.ok(!dueIds(p, now).includes("w15"));
  p = applySuspendLeech(p, "w15", false);
  assert.ok(dueIds(p, now).includes("w15"));

  const risks = forgettingRiskCards(atlas, p, 0.9, 5, now);
  assert.ok(risks.length >= 1);
  assert.equal(risks[0].id, "w0", "lowest stability with 10d elapsed is ranked first at highest forgetting risk");

  // Legacy cards missing `last` timestamp must not crash ts-fsrs get_retrievability
  p.cards.w1 = { due: now - 1000, s: 0.5, d: 6, el: 0, sd: 0, ls: 2, reps: 1, lapses: 1, st: 1, seen: now - 3 * 86_400_000 };
  const legacyRisks = forgettingRiskCards(atlas, p, 0.9, 16, now);
  assert.ok(legacyRisks.some((r) => r.id === "w1"));
});

test("Wave7.3: B2+ words unlock collocation and register quiz kinds from reps >= 5 while preserving A1-B1 first pass and relearning", () => {
  const b2Nouns: WordRef[] = Array.from({ length: 14 }, (_, i) => ({
    ...ref(`b2-${i}`, `concept${i}`, i, i % 2 ? "f" : undefined),
    cefr: 3,
  }));
  const at = (r: WordRef, reps: number, st = 2) => {
    const p = emptyProgress("t");
    if (reps > 0) p.cards[r.id] = { ...review(undefined, Rating.Good, Date.now()), reps, st: st as 0 | 1 | 2 | 3 };
    return quizKind(r, p, settings);
  };
  assert.deepEqual([0, 1, 2, 3, 4].map((n) => at(b2Nouns[1], n)), ["meaning", "gender", "cloze", "spell", "dictation"]);
  assert.deepEqual([0, 1, 2, 3].map((n) => at(b2Nouns[0], n)), ["meaning", "cloze", "spell", "dictation"]);
  assert.equal(at(b2Nouns[0], 10, 3), "meaning");

  const runs = b2Nouns.map((w) => Array.from({ length: 30 }, (_, n) => at(w, 5 + n)));
  const flat = runs.flat();
  assert.ok(flat.includes("collocation"), "B2+ cards unlock collocation questions");
  assert.ok(flat.includes("register"), "B2+ cards unlock register questions");
  for (const run of runs) {
    run.forEach((k, n) => n > 0 && assert.notEqual(k, run[n - 1], "never repeats twice in a row"));
    for (let n = 2; n < run.length; n++) assert.ok(run.slice(n - 2, n + 1).includes("spell"), "keeps recall cadence");
  }
});
