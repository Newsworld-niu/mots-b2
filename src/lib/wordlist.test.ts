import assert from "node:assert/strict";
import { test } from "node:test";

import type { WordRef } from "../atlas/types.ts";
import type { DictHit } from "./dict.ts";
import { extractWords, type Candidate } from "./extract.ts";
import { bestSense, cleanHeadword, listCandidates, mergeCandidates, parseListText } from "./wordlist.ts";

const ref = (id: string, word: string, zh = id, extra: Partial<WordRef> = {}): WordRef => ({ id, word, zh, ipa: "", cefr: 0, topic: 0, media: 0, order: 0, ...extra });
const atlas = {
  words: [
    ref("livre", "livre", "书", { g: "m" }),
    ref("marche", "marche", "行走；步伐", { g: "f" }),
    ref("marche-m", "marché", "市场；集市", { g: "m" }),
    ref("avocat", "avocat", "律师", { g: "m", more: ["牛油果"] }),
    ref("maison", "maison", "房子", { g: "f" }),
    ref("chat", "chat", "猫", { g: "m" }),
  ],
  custom: [{ ...ref("u-abcd1", "trottinette", "滑板车", { g: "f" }), order: -1, custom: true as const }],
};
const dict: Record<string, DictHit[]> = {
  pomme: [{ w: "pomme", p: "n.f.", zh: [["苹果", ""]], ipa: "pɔm" }],
};
const lookup = async (w: string) => dict[w.toLowerCase()] ?? [];

test("headwords lose their article and gender markers", () => {
  assert.deepEqual(cleanHeadword("la maison"), { word: "maison", article: "la", gender: "f" });
  assert.deepEqual(cleanHeadword("l’arbre (m.)"), { word: "arbre", article: "l'", gender: "m" });
  assert.deepEqual(cleanHeadword("chat, n.m."), { word: "chat", article: "", gender: "m" });
  assert.equal(cleanHeadword("se souvenir de").word, "se souvenir de");
  // an article alone is not stripped from itself
  assert.equal(cleanHeadword("la").word, "la");
});

test("a list's translation picks the sense of an atlas word, or becomes the deck note", () => {
  assert.equal(bestSense("牛油果", ["律师", "牛油果"]), 1);
  assert.equal(bestSense("鳄梨", ["律师", "牛油果"]), -1);
});

test("list rows link atlas words, keep near spellings apart and merge repeats", async () => {
  const out = await listCandidates(
    [
      { word: "le livre", translation: "书", translationLang: "zh" },
      { word: "un avocat", translation: "牛油果", translationLang: "zh" },
      { word: "maison", gender: "f", translation: "house", translationLang: "en" },
      { word: "la livre", translation: "磅（重量单位）", translationLang: "zh" },
      { word: "marché", translation: "市场", translationLang: "zh" },
      { word: "marche", translation: "市场", translationLang: "zh" },
      { word: "trotinette", translation: "滑板车", translationLang: "zh" },
      { word: "chât", translation: "猫", translationLang: "zh" },
      { word: "pomme", article: "la", translation: "", translationLang: "" },
      { word: "Pomme", translation: "苹果", translationLang: "zh" },
      { word: "trottinette", translation: "滑板车", translationLang: "zh" },
    ],
    atlas,
    { maison: {} },
    lookup,
  );
  const by = (w: string, g?: string) => out.find((c) => c.word.toLowerCase() === w && (g === undefined || c.gender === g))!;
  assert.equal(by("livre", "m").id, "livre");
  assert.equal(by("avocat").id, "avocat");
  assert.equal(by("avocat").sense, 1, "牛油果 is the second sense");
  assert.equal(by("maison").kind, "learning");
  assert.equal(by("maison").deckNote, undefined, "an English translation is not a deck note");
  assert.equal(by("maison").given, "house");
  // la livre (pound) is not le livre (book)
  const pound = by("livre", "f");
  assert.equal(pound.id, undefined);
  assert.equal(pound.kind, "new");
  assert.equal(pound.near?.id, "livre");
  assert.equal(pound.near?.why, "阴阳性不同");
  // marché is linked to marché, not to marche
  assert.equal(by("marché").id, "marche-m");
  // pomme twice: one row, the printed meaning wins over the dictionary, gender kept
  const apples = out.filter((c) => c.word.toLowerCase() === "pomme");
  assert.equal(apples.length, 1);
  assert.equal(apples[0].count, 2);
  assert.equal(apples[0].zh, "苹果");
  assert.equal(apples[0].gender, "f");
  // marche = 市场 is linked by spelling but points at marché, whose meaning it is
  const lost = by("marche");
  assert.equal(lost.id, "marche");
  assert.equal(lost.deckNote, "市场");
  assert.equal(lost.near?.id, "marche-m");
  // only the accents differ: not linked, offered as maybe the same word
  assert.equal(by("chât").id, undefined);
  assert.equal(by("chât").near?.id, "chat");
  assert.equal(by("chât").near?.why, "拼写或重音不同");
  // a misspelling of nothing in the atlas is a new word, not linked
  assert.equal(by("trotinette").id, undefined);
  // the learner's own word is linked, not created again
  assert.equal(by("trottinette").id, "u-abcd1");
});

test("a text and its vocabulary box merge into one list", async () => {
  const text = await extractWords("Le chat mange une pomme. Elle achète une trottinette.", atlas, {}, lookup);
  const list = await listCandidates([{ word: "une pomme", translation: "苹果", translationLang: "zh" }, { word: "le chat", translation: "猫", translationLang: "zh" }], atlas, {}, lookup);
  const all: Candidate[] = mergeCandidates([text, list]);
  const keys = all.map((c) => c.key);
  assert.equal(new Set(keys).size, keys.length, "no duplicate rows");
  const apple = all.find((c) => c.word === "pomme")!;
  assert.equal(apple.count, 2);
  assert.match(apple.sentence, /pomme/, "the source sentence is kept");
  assert.equal(all.filter((c) => c.id === "chat").length, 1);
});

test("two-column files are read as word lists, prose is not", () => {
  const rows = parseListText("mot;traduction\nla maison;房子\n\"un chat, noir\";黑猫\nmanger;吃");
  assert.deepEqual(rows?.map((r) => [r.word, r.translation]), [["la maison", "房子"], ["un chat, noir", "黑猫"], ["manger", "吃"]]);
  assert.deepEqual(parseListText("avoir\t有\nêtre\t是")?.map((r) => r.word), ["avoir", "être"]);
  assert.equal(parseListText("Il fait beau aujourd'hui, et nous allons à la plage.\nDemain, il pleuvra, dit la météo, encore une fois."), null);
});

test("Word tables become tab-separated rows, paragraphs lines", async () => {
  const { docxText } = await import("./files.ts");
  const xml = `<w:body><w:p><w:r><w:t>Vocabulaire</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>la maison</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>房子 &amp; 家</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>manger</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>吃</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body>`;
  assert.equal(docxText(xml), "Vocabulaire\nla maison\t房子 & 家\nmanger\t吃");
});

test("a misread word with a printed meaning is unverified and offered the real word", async () => {
  const { checkSpellings } = await import("./wordlist.ts");
  const list = await listCandidates([{ word: "rnaison", translation: "房子", translationLang: "zh" }, { word: "pomme", translation: "苹果", translationLang: "zh" }], atlas, {}, lookup);
  const out = await checkSpellings(list, [...atlas.words, ...atlas.custom]);
  const bad = out.find((c) => c.word === "rnaison")!;
  assert.equal(bad.unverified, true);
  assert.equal(bad.suggest?.[0].word, "maison", "the word whose meaning fits comes first");
  assert.equal(out.find((c) => c.word === "pomme")!.unverified, undefined, "a dictionary word is confirmed");
});
