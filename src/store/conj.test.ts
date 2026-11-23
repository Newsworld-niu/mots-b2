import assert from "node:assert/strict";
import { test } from "node:test";

import type { Atlas, WordRef } from "../atlas/types";
import type { ConjData } from "../atlas/conj";
import type { ConjVerb } from "../lib/conjugation";
import { answerConj, activeTenses, applyContextConjAttempt, buildConjSession, conjGrade, conjNewToday, conjKey, conjPlan, repeatConj, newConj, resolveConjVerbId, splitKey, stepFor, unlockedVerbs } from "./conj.ts";
import { checkContextConjugation, CONTEXT_CONJ_ITEMS } from "../lib/conj-context.ts";
import { sourceWordIds } from "../lib/practice-source.ts";
import { review, Rating } from "./srs.ts";
import { dayKey, defaultSettings, emptyProgress, sanitizeProgress, sanitizeSettings, store } from "./store.ts";

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

test("tenses follow the start level unless chosen; new forms alternate tenses", () => {
  assert.deepEqual(activeTenses({ ...defaultSettings, startLevel: 0 }), ["pres", "pc"]);
  assert.deepEqual(activeTenses({ ...defaultSettings, conjTenses: ["subj", "pres"] }), ["pres", "subj"]);
  const p = emptyProgress("t");
  for (const id of ["etre", "parler", "finir"]) p.cards[id] = review(undefined, Rating.Good, Date.now());
  const forms = newConj(atlas, p, defaultSettings, data, 1);
  assert.equal(forms.length, 12);
  assert.ok(forms.every(k => splitKey(k).verbId === "etre"));
  assert.deepEqual(forms.slice(0, 4), ["etre|pres|0", "etre|pc|0", "etre|pres|1", "etre|pc|1"]);
});

test("daily plan respects the new-card limit and lists due cards", () => {
  const p = emptyProgress("t");
  for (const id of ["etre", "parler", "finir"]) p.cards[id] = review(undefined, Rating.Good, Date.now());
  p.conj = { [conjKey("parler", "pres", 0)]: { ...review(undefined, Rating.Good, Date.now() - 864e5 * 5), due: Date.now() - 1000 } };
  const plan = conjPlan(atlas, p, { ...defaultSettings, conjNew: 2 }, data);
  assert.deepEqual(plan.due, ["parler|pres|0"]);
  assert.equal(plan.fresh.length, 35);
  assert.equal(plan.newVerbs, 2);
  assert.ok(!plan.fresh.includes("parler|pres|0"));
});

test("word sources include unlearned favourites and deck words, deduplicate and exclude missing words", () => {
  const p = emptyProgress("t");
  p.cards.parler = { ...review(undefined, Rating.Good, 100), last: 100 };
  p.cards.etre = { ...review(undefined, Rating.Good, 200), last: 200 };
  p.bookmarks = ["finir", "maison", "missing"];
  p.mistakes = ["parler", "missing", "etre"];
  p.decks = [
    { id: "a", name: "A", created: 1, words: ["finir", "maison", "missing"] },
    { id: "b", name: "B", created: 2, words: ["finir", "parler"] },
  ];
  assert.deepEqual(sourceWordIds(atlas, p, "recent", 0), ["etre", "parler"]);
  assert.deepEqual(sourceWordIds(atlas, p, "mistakes", 0), ["parler", "etre"]);
  assert.deepEqual(sourceWordIds(atlas, p, "saved", 0), ["finir", "maison"]);
  assert.deepEqual(sourceWordIds(atlas, p, "decks", 0, ["a", "b"]), ["finir", "maison", "parler"]);
  assert.deepEqual(sourceWordIds(atlas, p, "decks", 0, []), []);
  assert.deepEqual(sourceWordIds(atlas, p, "decks", 0, ["deleted"]), []);
  const plan = conjPlan(atlas, p, defaultSettings, data, sourceWordIds(atlas, p, "saved", 0));
  assert.equal(plan.verbs, 1, "nouns are excluded even when favourited");
  assert.ok(plan.fresh.includes("finir|pres|0"), "unlearned favourite verbs can be practised");
});

test("learning-path source follows the start level and the same 400-word window as practice", () => {
  const pathWords = Array.from({ length: 405 }, (_, i) => ({ ...words[0], id: `w${i}`, cefr: i ? 1 : 0 }));
  const pathAtlas = { ...atlas, words: pathWords, byId: new Map(pathWords.map(w => [w.id, w])) };
  const ids = sourceWordIds(pathAtlas, emptyProgress("t"), "path", 1);
  assert.equal(ids.length, 400);
  assert.equal(ids[0], "w1");
  assert.equal(ids.at(-1), "w400");
});

test("source filters both due cards and session questions without unlocking word cards", () => {
  const p = emptyProgress("t");
  const due = { ...review(undefined, Rating.Good, Date.now() - 864e5 * 5), due: Date.now() - 1000 };
  p.conj = { "parler|pres|0": due, "finir|pres|0": due, "finir|pc|0": due };
  const s = { ...defaultSettings, conjTenses: ["pres"], conjNew: 2 };
  const before = JSON.stringify(p);
  const plan = conjPlan(atlas, p, s, data, ["finir", "etre", "etre", "maison", "missing"]);
  assert.equal(plan.verbs, 2);
  assert.deepEqual(plan.due, ["finir|pres|0"]);
  assert.equal(plan.fresh.length, 11);
  assert.equal(plan.newVerbs, 1);
  const session = buildConjSession(atlas, p, s, data, ["finir", "etre"]);
  assert.equal(session.length, 12);
  assert.ok(session.every(step => ["finir", "etre"].includes(step.verbId) && step.tense === "pres"));
  assert.equal(session[1].isNew, true);
  const empty = conjPlan(atlas, p, s, data, []);
  assert.equal(empty.verbs, 0);
  assert.deepEqual(empty.due, []);
  assert.deepEqual(empty.fresh, []);
  assert.deepEqual(buildConjSession(atlas, p, s, data, []), []);
  assert.equal(JSON.stringify(p), before, "selecting and planning never changes word or conjugation progress");
});

test("switching sources shares the daily conjugation limit and existing verb progress", () => {
  const p = emptyProgress("t");
  p.conjDays = { [dayKey()]: { n: 2, r: 2, c: 2, verbs: ["finir", "parler"] } };
  p.conj = { "finir|pres|0": { ...review(undefined, Rating.Good, Date.now()), due: Date.now() - 1000 } };
  const s = { ...defaultSettings, conjNew: 2 };
  assert.deepEqual(conjPlan(atlas, p, s, data, ["etre"]).fresh, []);
  const other = conjPlan(atlas, p, s, data, ["finir"]);
  assert.equal(other.fresh.length, 11, "an introduced verb can finish all selected tenses after the quota is used");
  assert.deepEqual(other.due, ["finir|pres|0"]);
});

test("new forms require typing; grading treats accent slips as Hard", () => {
  const p = emptyProgress("t");
  assert.equal(stepFor("parler|pres|0", p, data).kind, "type");
  assert.equal(stepFor("parler|pres|0", p, data).isNew, true);
  assert.deepEqual(splitKey("a|b|pc|0"), { verbId: "a|b", tense: "pc", person: 0 });
  assert.equal(conjGrade("wrong", 1000, "type"), Rating.Again);
  assert.equal(conjGrade("accent", 1000, "type"), Rating.Hard);
  assert.equal(conjGrade("right", 3000, "type"), Rating.Easy);
  assert.equal(conjGrade("right", 3000, "choice"), Rating.Good);
});

test("conjugation progress and settings survive the validator; junk is dropped", () => {
  const card = review(undefined, Rating.Good, Date.now());
  const p = sanitizeProgress({ ...emptyProgress("t"), conj: { "parler|pres|0": card, "parler|bogus": card, x: 1 }, conjDays: { "2026-11-05": { n: 1, r: 2, c: 1 }, bad: {} } }, "t");
  assert.deepEqual(Object.keys(p.conj ?? {}), ["parler|pres|0"]);
  assert.deepEqual(Object.keys(p.conjDays ?? {}), ["2026-11-05"]);
  const s = sanitizeSettings({ conjTenses: ["pres", "nope", "pres"], conjNew: 8 });
  assert.deepEqual(s.conjTenses, ["pres"]);
  assert.equal(s.conjNew, 8);
});


test("legacy records are preserved but do not mark untested persons as mastered", () => {
  const card = review(undefined, Rating.Good, 0);
  const p = sanitizeProgress({ ...emptyProgress("t"), conj: { "etre|pres": card, "etre|pres|0": card, "etre|pres|6": card } }, "t");
  assert.deepEqual(Object.keys(p.conj!), ["etre|pres", "etre|pres|0"]);
  const plan = conjPlan(atlas, p, { ...defaultSettings, conjTenses: ["pres"], conjNew: 10 }, data, ["etre"]);
  assert.deepEqual(plan.due, ["etre|pres|0"]);
  assert.equal(plan.fresh.length, 5);
  assert.equal(splitKey(plan.fresh[0]).person, 1);
});

test("small daily limits continue balancing tenses on subsequent days", () => {
  const p = emptyProgress("t");
  const settings = { ...defaultSettings, conjTenses: ["pres", "pc", "fut"] };
  const keys: string[] = [];
  for (let i = 0; i < 18; i++) {
    const key = newConj(atlas, p, settings, data, 1, ["etre"])[0];
    keys.push(key);
    p.conj = { ...p.conj, [key]: review(undefined, Rating.Good, Date.now()) };
  }
  assert.equal(new Set(keys).size, 18);
  assert.deepEqual(keys.slice(0, 3).map(k => splitKey(k).tense), ["pres", "pc", "fut"]);
  assert.deepEqual(newConj(atlas, p, settings, data, 1, ["etre"]), []);
});

test("impersonal verbs only generate il; unavailable forms are skipped", () => {
  const d = { ...data, verbs: { ...data.verbs, finir: { ...verb("falloir"), imp: 1 as const } } };
  const keys = newConj(atlas, emptyProgress("t"), defaultSettings, d, 100, ["finir"]);
  assert.equal(keys.length, 2);
  assert.ok(keys.every(k => splitKey(k).person === 2));
});

test("wrong answers return after three intervening questions, always typed, including repeat errors", () => {
  const p = emptyProgress("t");
  const session = buildConjSession(atlas, p, defaultSettings, data, ["etre"]);
  const next = repeatConj(session, 0, session[0]);
  assert.equal(next[4].key, session[0].key);
  assert.equal(next[4].kind, "type");
  assert.equal(next[4].retry, true);
  const again = repeatConj(next, 4, next[4]);
  assert.equal(again[8].key, session[0].key);
  assert.equal(again[8].retry, true);
  const assisted = repeatConj(session, 0, { ...session[0], kind: "choice" }, false);
  assert.equal(assisted[4].kind, "type");
  assert.equal(assisted[4].retry, false);
});


test("grading updates only the tested person; assistance and retries never advance memory or daily totals", () => {
  (globalThis as any).window ??= { setTimeout: () => 0, clearTimeout: () => undefined };
  const original = store.get().progress;
  try {
    store.progress(() => emptyProgress("t"));
    const step = stepFor("etre|pres|0", store.get().progress, data);
    answerConj({ ...step, kind: "choice" }, Rating.Good);
    assert.equal(Object.keys(store.get().progress.conj ?? {}).length, 0);
    answerConj(step, Rating.Again);
    const after = JSON.stringify(store.get().progress);
    answerConj({ ...step, retry: true }, Rating.Good);
    assert.equal(JSON.stringify(store.get().progress), after);
    assert.deepEqual(Object.keys(store.get().progress.conj!), ["etre|pres|0"]);
    assert.equal(store.get().progress.conjDays![dayKey()].n, 1);
    assert.equal(stepFor("etre|pres|1", store.get().progress, data).isNew, true);
    answerConj(stepFor("etre|pres|1", store.get().progress, data), Rating.Good);
    assert.equal(conjNewToday(store.get().progress), 1);
    const restored = sanitizeProgress(store.get().progress, "t");
    assert.equal(conjNewToday(restored), 1);
    assert.equal(conjPlan(atlas, restored, { ...defaultSettings, conjNew: 1 }, data, ["etre", "parler"]).newVerbs, 0);
  } finally {
    store.progress(() => original);
  }
});


test("changing tense selection expands an existing verb without consuming another card", () => {
  const p = emptyProgress("t");
  const settings = { ...defaultSettings, conjTenses: ["pres"] };
  const first = newConj(atlas, p, settings, data, 1, ["etre", "parler"]);
  assert.equal(first.length, 6);
  p.conj = Object.fromEntries(first.map(k => [k, review(undefined, Rating.Good, Date.now())]));
  const more = newConj(atlas, p, { ...settings, conjTenses: ["pres", "fut"] }, data, 0, ["etre", "parler"]);
  assert.equal(more.length, 6);
  assert.ok(more.every(k => splitKey(k).verbId === "etre" && splitKey(k).tense === "fut"));
});

test("PE-7: B1 default tenses include subj; compound B2 tenses and ppres schedule & sanitize cleanly", () => {
  const b1Tenses = activeTenses({ ...defaultSettings, startLevel: 2 });
  assert.ok(b1Tenses.includes("subj"));

  const parlerReal: ConjVerb = {
    i: "parler",
    a: "a",
    pp: "parlé",
    m: "er",
    f: {
      pres: ["parle", "parles", "parle", "parlons", "parlez", "parlent"],
      imp: six("parl"),
      fut: six("parl"),
      cond: six("parl"),
      subj: six("parl"),
    },
  };
  const d: ConjData = { v: 1, verbs: { parler: parlerReal } };
  const s = { ...defaultSettings, conjTenses: ["pqp", "fa", "condp", "subjp", "ppres"] };
  const keys = newConj(atlas, emptyProgress("t"), s, d, 1, ["parler"]);
  // 4 compound tenses * 6 persons + 1 invariable ppres card = 25
  assert.equal(keys.length, 25);
  assert.deepEqual(keys.filter((k) => splitKey(k).tense === "ppres"), ["parler|ppres|0"]);

  const card = review(undefined, Rating.Good, Date.now());
  const p = sanitizeProgress({ ...emptyProgress("t"), conj: Object.fromEntries(keys.map((k) => [k, card])) }, "t");
  assert.equal(Object.keys(p.conj ?? {}).length, 25);
  assert.deepEqual(sanitizeSettings({ conjTenses: ["pqp", "ppres", "bogus"] }).conjTenses, ["pqp", "ppres"]);
});

test("Phase3: B2 startLevel pre-unlocks core irregular verbs and impératif schedules & sanitizes cleanly", () => {
  const b2Atlas = {
    words: [
      { id: "etre", word: "etre", zh: "是", ipa: "", cefr: 0, topic: 0, media: 0, order: 0 },
      { id: "parler", word: "parler", zh: "说", ipa: "", cefr: 0, topic: 0, media: 0, order: 1 },
      { id: "prendre", word: "prendre", zh: "拿", ipa: "", cefr: 0, topic: 0, media: 0, order: 2 },
    ],
    byId: new Map(),
  } as unknown as Atlas;
  for (const w of b2Atlas.words) b2Atlas.byId.set(w.id, w);
  const d: ConjData = { v: 1, verbs: { etre: verb("être"), parler: verb("parler"), prendre: verb("prendre") } };
  const p = emptyProgress("t");
  // Nobody learned yet: A1 returns [], B2 (startLevel=3) pre-unlocks etre & prendre (core irregular) without parler (regular)
  assert.deepEqual(unlockedVerbs(b2Atlas, p, d, 0), []);
  assert.deepEqual(unlockedVerbs(b2Atlas, p, d, 3), ["etre", "prendre"]);

  const impSettings = { ...defaultSettings, conjTenses: ["imper"] };
  const keys = newConj(atlas, p, impSettings, data, 1, ["parler"]);
  assert.equal(keys.length, 3);
  assert.deepEqual(keys, ["parler|imper|1", "parler|imper|3", "parler|imper|4"]);
  const card = review(undefined, Rating.Good, Date.now());
  const clean = sanitizeProgress({ ...p, conj: Object.fromEntries(keys.map((k) => [k, card])) }, "t");
  assert.equal(Object.keys(clean.conj ?? {}).length, 3);
  assert.deepEqual(sanitizeSettings({ conjTenses: ["imper"] }).conjTenses, ["imper"]);
});

test("M23-C: CONTEXT_CONJ_ITEMS has >= 48 items including B2 compound tenses & agreements, and advances FSRS conj cards", () => {
  assert.ok(CONTEXT_CONJ_ITEMS.length >= 48, `expected >= 48 context conj items, got ${CONTEXT_CONJ_ITEMS.length}`);
  const agreementItems = CONTEXT_CONJ_ITEMS.filter((it) =>
    ["cc-b2-subjp-cod-prises", "cc-b2-pqp-cod-ecrites", "cc-b2-pc-cod-soumises", "cc-b2-subjp-refl-disputer"].includes(it.id),
  );
  assert.equal(agreementItems.length, 4);
  for (const it of agreementItems) {
    const check = checkContextConjugation(it, it.tense, it.answers[0]);
    assert.equal(check.tenseOk && check.formOk, true, `${it.id} canonical answer should pass`);
  }

  const reflVerb: ConjVerb = { ...verb("disputer"), p: 1 };
  const prendreVerb: ConjVerb = { ...verb("prendre"), pp: "pris" };
  const ctxData: ConjData = {
    v: 1,
    verbs: {
      "se-disputer": reflVerb,
      prendre: prendreVerb,
    },
  };
  const ctxWords: WordRef[] = ["se-disputer", "prendre"].map((id, order) => ({
    id,
    word: id,
    zh: id,
    ipa: "",
    cefr: 3,
    topic: 0,
    media: 0,
    order,
  }));
  const ctxAtlas = { words: ctxWords, byId: new Map(ctxWords.map((w) => [w.id, w])) } as unknown as Atlas;

  assert.equal(resolveConjVerbId(ctxData, "se disputer", ctxAtlas), "se-disputer");
  assert.equal(resolveConjVerbId(ctxData, "prendre", ctxAtlas), "prendre");
  assert.equal(resolveConjVerbId(ctxData, "verbe-inconnu", ctxAtlas), null);

  const now = 1_730_800_000_000;
  const day = dayKey(new Date(now));
  let p = emptyProgress("t");

  // 1. Exact tense + form -> Rating.Good
  p = applyContextConjAttempt(
    p,
    ctxData,
    { verb: "prendre", tense: "subjp", person: 2, tenseOk: true, formOk: true, accentOnly: false },
    now,
    0.9,
    ctxAtlas,
  );
  assert.ok(p.conj?.["prendre|subjp|2"]);
  assert.deepEqual(p.conjDays?.[day], { verbs: ["prendre"], n: 1, r: 1, c: 1 });

  // 2. Right tense + pure lexical accent slip -> Rating.Hard (still counts as correct review, shorter interval than Good)
  p = applyContextConjAttempt(
    p,
    ctxData,
    { verb: "se disputer", tense: "subjp", person: 5, tenseOk: true, formOk: false, accentOnly: true },
    now,
    0.9,
    ctxAtlas,
  );
  assert.ok(p.conj?.["se-disputer|subjp|5"]);
  assert.ok(p.conj["prendre|subjp|2"].due > p.conj["se-disputer|subjp|5"].due, "Good schedules further than Hard");
  assert.deepEqual(p.conjDays?.[day], { verbs: ["prendre", "se-disputer"], n: 2, r: 2, c: 2 });

  // 3. Wrong tense -> Rating.Again
  const prevGoodDue = p.conj["prendre|subjp|2"].due;
  p = applyContextConjAttempt(
    p,
    ctxData,
    { verb: "prendre", tense: "subjp", person: 2, tenseOk: false, formOk: true, accentOnly: false },
    now + 60_000,
    0.9,
    ctxAtlas,
  );
  assert.ok(p.conj!["prendre|subjp|2"].due < prevGoodDue, "wrong tense schedules Rating.Again sooner");
  assert.equal(p.conjDays?.[day].r, 3);
  assert.equal(p.conjDays?.[day].c, 2);
});
