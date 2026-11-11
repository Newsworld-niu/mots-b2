import assert from "node:assert/strict";
import { test } from "node:test";

import { MEDIA, type Atlas, type Entry, type WordRef } from "../atlas/types.ts";
import { customRef, focusRef, focusSense, withUserData } from "../atlas/merge.ts";
import { locateWord } from "../lib/text.ts";
import { migrateAliases } from "./aliases.ts";
import { deckIndex, inRange, pausedIds, senseFor, studyRange } from "./decks.ts";
import { buildSession, nextNew, quizKind, todayPlan } from "./session.ts";
import { review, Rating } from "./srs.ts";
import { CORE_DECK, emptyProgress, sanitizeProgress, sanitizeSettings, type Deck, type Progress, type Settings } from "./store.ts";

const ref = (id: string, word: string, order: number, more?: string[]): WordRef => ({ id, word, zh: `释义${order}`, ipa: "", cefr: 0, topic: 0, media: 0, order, ...(more ? { more } : {}) });
const words = [ref("chat", "chat", 0), ref("chien", "chien", 1), ref("avocat", "avocat", 2, ["牛油果"]), ref("pain", "pain", 3), ref("lait", "lait", 4)];
const atlas = {
  id: "t",
  words,
  byId: new Map(words.map((w) => [w.id, w])),
  topics: [["daily", "日常"]],
  cefr: ["A1"],
  peek: () => undefined,
  entry: async (id: string) => ({ id, w: id, uk: "", us: "", senses: [{ pos: "n.m.", zh: "律师", en: "" }, { pos: "n.m.", zh: "牛油果", en: "" }], ex: [], col: [], fam: [], syn: [], ant: [], tip: "", cefr: "A1", topic: "daily", m: 0 }) as Entry,
} as unknown as Atlas;
const settings = { spell: true, dailyNew: 10, startLevel: 0, retention: 0.9, focusTopic: null, studyDecks: null } as Settings;
const deck = (id: string, ws: string[], extra: Partial<Deck> = {}): Deck => ({ id, name: id, created: 0, words: ws, ...extra });
const due = (p: Progress, ids: string[]) => {
  const t = Date.now() - 3 * 86400000;
  for (const id of ids) p.cards[id] = { ...review(undefined, Rating.Good, t), due: t };
  return p;
};

test("new words come from the learner's decks first, then the learning path", () => {
  const p = { ...emptyProgress("t"), decks: [deck("d-trip1", ["lait", "pain"])] };
  assert.deepEqual(nextNew(atlas, p, settings, 3), ["lait", "pain", "chat"]);
  // only the trip deck: the path is not used
  assert.deepEqual(nextNew(atlas, p, { ...settings, studyDecks: ["d-trip1"] }, 5), ["lait", "pain"]);
  // only the initial deck, with a hidden word
  assert.deepEqual(nextNew(atlas, { ...p, hidden: ["chat"] }, { ...settings, studyDecks: [CORE_DECK] }, 2), ["chien", "avocat"]);
});

test("a word in two decks is one card: learned once, never offered as new again", () => {
  const p = due({ ...emptyProgress("t"), decks: [deck("d-aaaa1", ["pain"]), deck("d-bbbb1", ["pain", "lait"])] }, ["pain"]);
  assert.deepEqual(nextNew(atlas, p, { ...settings, studyDecks: ["d-bbbb1"] }, 5), ["lait"]);
  const plan = todayPlan(atlas, p, { ...settings, studyDecks: ["d-aaaa1", "d-bbbb1"] });
  assert.equal(plan.due.filter((x) => x === "pain").length, 1);
});

test("reviews come from the decks in range; the rest are counted, words in no deck are paused", () => {
  const p = due({ ...emptyProgress("t"), decks: [deck("d-trip1", ["lait"])], hidden: ["chat", "lait"] }, ["chat", "chien", "lait"]);
  const all = todayPlan(atlas, p, settings);
  assert.deepEqual(all.due.sort(), ["chien", "lait"], "chat is hidden and in no deck: paused");
  assert.deepEqual(pausedIds(atlas, p), ["chat"]);
  const trip = todayPlan(atlas, p, { ...settings, studyDecks: ["d-trip1"] });
  assert.deepEqual(trip.due, ["lait"]);
  assert.equal(trip.otherDue, 1);
  const idx = deckIndex(atlas, p);
  assert.equal(inRange(idx, studyRange(p, { studyDecks: [CORE_DECK] }), "lait"), false, "hidden from the initial deck");
  assert.equal(inRange(idx, studyRange(p, { studyDecks: ["d-trip1"] }), "lait"), true, "still in the trip deck");
});

test("unknown deck ids in the study range fall back to every deck", () => {
  const r = studyRange({ decks: [] }, { studyDecks: ["d-gone1"] });
  assert.equal(r.all, true);
});

test("a deck's sense is carried by the steps and shown first", async () => {
  const p = { ...emptyProgress("t"), decks: [deck("d-food1", ["avocat"], { sense: { avocat: 1 } })] };
  const s = { ...settings, studyDecks: ["d-food1"] };
  assert.equal(senseFor(studyRange(p, s), "avocat"), 1);
  const sess = buildSession(atlas, p, s);
  assert.ok(sess.steps.filter((x) => x.id === "avocat" && x.kind !== "pairing").every((x) => "sense" in x && x.sense === 1));
  const e = focusSense(await atlas.entry("avocat"), 1);
  assert.equal(e.senses[0].zh, "牛油果");
  assert.equal(focusRef(atlas.byId.get("avocat")!, 1).zh, "牛油果");
  assert.equal(focusRef(atlas.byId.get("avocat")!, undefined).zh, "释义2");
});

test("custom words and edits join the atlas by id, outside the learning path", async () => {
  const merged = withUserData(atlas, { "u-abcd1": { w: "baguette", pos: "n.f.", zh: "长棍面包", ex: [{ fr: "J'achète deux baguettes.", zh: "我买两根长棍面包。" }], created: 1 } }, { chat: { zh: "猫咪" } });
  assert.equal(merged.words.length, atlas.words.length);
  assert.equal(merged.byId.get("u-abcd1")?.g, "f");
  assert.equal(merged.byId.get("chat")?.zh, "猫咪");
  const e = await merged.entry("u-abcd1");
  assert.equal(e.art, "une");
  assert.deepEqual(e.ex[0].hl, [14, 23]);
  assert.equal((await merged.entry("chat")).senses[0].zh, "猫咪");
  assert.equal(customRef("u-x0001", { w: "x", pos: "v.", zh: "y", ipa: "ʁ", created: 0 }).ipa, "/ʁ/");
});

test("不要图片: no picture, no picture question, and the choice survives a backup", async () => {
  const pics = { chat: "data:image/jpeg;base64,AAAA", "u-abcd1": "data:image/jpeg;base64,BBBB", chien: "data:image/jpeg;base64,CCCC" };
  const merged = withUserData(atlas, { "u-abcd1": { w: "baguette", pos: "n.f.", zh: "长棍面包", created: 1, noImg: true } }, { chat: { noImg: true } }, pics);
  // a picture the word had is ignored once 不要图片 is chosen
  assert.equal(merged.img(merged.byId.get("chat")!), null);
  assert.equal(merged.img(merged.byId.get("u-abcd1")!), null);
  assert.equal(merged.byId.get("chat")!.media & MEDIA.img, 0);
  assert.equal((await merged.entry("chat")).noImg, true);
  assert.equal((await merged.entry("u-abcd1")).noImg, true);
  // words without the choice keep their picture and get the picture question
  assert.equal(merged.img(merged.byId.get("chien")!), pics.chien);
  const s = { ...settings, spell: true } as Settings;
  const reps = (id: string, n: number): Progress => ({ ...emptyProgress("t"), cards: { [id]: { ...review(undefined, Rating.Good, 0), reps: n } } });
  const kinds = (id: string) => [0, 1, 2, 3, 4, 5, 6, 7].map((n) => quizKind(merged.byId.get(id)!, reps(id, n), s));
  assert.ok(!kinds("chat").includes("picture"));
  assert.ok(!kinds("u-abcd1").includes("picture"));
  assert.ok(kinds("chien").includes("picture"));
  const back = sanitizeProgress({ version: 2, cards: {}, custom: { "u-abcd1": { w: "baguette", pos: "n.f.", zh: "长棍面包", created: 1, noImg: true } }, edits: { chat: { noImg: true }, chien: { noImg: "yes" } } }, "t");
  assert.equal(back.custom?.["u-abcd1"].noImg, true);
  assert.deepEqual(back.edits, { chat: { noImg: true } });
});

test("examples written by the learner find the headword, inflected verbs included", () => {
  assert.deepEqual(locateWord("Nous parlons français.", "parler"), [5, 12]);
  assert.deepEqual(locateWord("Les chats dorment.", "chat"), [4, 9]);
  assert.equal(locateWord("Il fait beau.", "pleuvoir"), undefined);
});

test("decks, custom words and edits survive a backup round trip; bad data is dropped", () => {
  const raw = {
    version: 2,
    cards: {},
    decks: [deck("d-good1", ["chat", "chat", "u-abcd1"], { sense: { chat: 1, nope: 2 }, note: { chat: "p. 3" } }), { id: "bad", name: "x", words: [] }, deck("d-noname", [], { name: "" })],
    hidden: ["chien", 3],
    custom: { "u-abcd1": { w: "baguette", pos: "n.f.", zh: "长棍面包", created: 1 }, "u-bad!": { w: "x", zh: "y" }, "u-nozh1": { w: "x", zh: "" } },
    edits: { chat: { zh: "猫咪" }, chien: {} },
  };
  const p = sanitizeProgress(raw, "t");
  assert.deepEqual(p.decks?.map((d) => d.id), ["d-good1"]);
  assert.deepEqual(p.decks?.[0].words, ["chat", "u-abcd1"]);
  assert.deepEqual(p.decks?.[0].sense, { chat: 1 });
  assert.deepEqual(p.hidden, ["chien"]);
  assert.deepEqual(Object.keys(p.custom ?? {}), ["u-abcd1"]);
  assert.deepEqual(p.edits, { chat: { zh: "猫咪" } });
  assert.deepEqual(sanitizeSettings({ studyDecks: [CORE_DECK, "d-good1", "evil"] }).studyDecks, [CORE_DECK, "d-good1"]);
  assert.equal(sanitizeSettings({ studyDecks: [] }).studyDecks, null);
});

test("alias migration moves deck words, senses, notes, hidden words and edits to the primary id", () => {
  const p: Progress = { ...emptyProgress("t"), decks: [deck("d-aaaa1", ["old", "chat"], { sense: { old: 1 }, note: { old: "n" } })], hidden: ["old"], edits: { old: { zh: "x" } } };
  const { progress, report } = migrateAliases(p, { old: "chat" });
  assert.equal(report.changed, true);
  assert.deepEqual(progress.decks?.[0].words, ["chat"]);
  assert.deepEqual(progress.decks?.[0].sense, { chat: 1 });
  assert.deepEqual(progress.decks?.[0].note, { chat: "n" });
  assert.deepEqual(progress.hidden, ["chat"]);
  assert.deepEqual(progress.edits, { chat: { zh: "x" } });
  assert.equal(migrateAliases(progress, { old: "chat" }).report.changed, false, "idempotent");
});
