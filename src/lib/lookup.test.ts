import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSeed, CAPACITY, dictPicks, frdicPicks, tooLong, type Pick } from "./lookup.ts";

const sense = (zh: string, pos = "n.m."): Pick => ({ key: zh, origin: "frdic", kind: "sense", fr: "", zh, pos });

test("every dictionary gloss and example is offered, not only the first three", () => {
  const picks = dictPicks([{ w: "avocat", p: "n.m.", ipa: "avɔka", zh: [["牛油果", "fruit"], ["律师", "juriste"], ["辩护人", "défenseur"], ["说情人", "intercesseur"], ["牛油果树", "arbre"]], ex: [["L'avocat est mûr.", "牛油果熟了。", 2, 9]] }]);
  assert.equal(picks.filter((p) => p.kind === "sense").length, 5);
  assert.deepEqual(picks.find((p) => p.kind === "example")?.hl, [2, 9]);
});

test("the first picked meaning is the card's meaning, the rest are other meanings; sources keep their fields", () => {
  const picks: Pick[] = [
    sense("律师"), sense("牛油果", "n.m."),
    { key: "e", origin: "dict", kind: "example", fr: "Il est avocat.", zh: "他是律师。", pos: "n.m.", hl: [6, 12], tatoeba: true },
    { key: "p", origin: "frdic", kind: "phrase", fr: "avocat conseil", zh: "法律顾问", pos: "" },
    { key: "p2", origin: "frdic", kind: "phrase", fr: "avocat général", zh: "", pos: "" },
    { key: "f", origin: "frdic", kind: "family", fr: "avocate", zh: "女律师", pos: "" },
    { key: "s", origin: "frdic", kind: "syn", fr: "défenseur", zh: "", pos: "" },
    { key: "a", origin: "frdic", kind: "ant", fr: "juge", zh: "", pos: "" },
    { key: "n", origin: "frdic", kind: "note", fr: "", zh: "助记：a+voc", pos: "" },
  ];
  const seed = buildSeed("avocat", picks, { w: "avocat", p: "n.m.", ipa: "avɔka" });
  assert.deepEqual([seed.w, seed.pos, seed.zh, seed.ipa], ["avocat", "n.m.", "律师", "avɔka"]);
  assert.deepEqual(seed.senses, [{ pos: "n.m.", zh: "牛油果" }]);
  assert.deepEqual(seed.ex, [{ fr: "Il est avocat.", zh: "他是律师。", src: "tatoeba", hl: [6, 12] }]);
  assert.deepEqual(seed.col, ["avocat conseil｜法律顾问", "avocat général"]);
  assert.deepEqual([seed.fam, seed.syn, seed.ant, seed.note], [["avocate｜女律师"], ["défenseur"], ["juge"], "助记：a+voc"]);
});

test("text the card cannot hold is refused, never cut", () => {
  assert.equal(tooLong(sense("字".repeat(300))), "");
  assert.match(tooLong(sense("字".repeat(301))), /300/);
  assert.match(tooLong({ key: "k", origin: "frdic", kind: "phrase", fr: "a", zh: "字".repeat(51), pos: "" }), /50/);
  assert.match(tooLong({ key: "k", origin: "frdic", kind: "family", fr: "a", zh: "字".repeat(39), pos: "" }), /38/);
  assert.equal(CAPACITY.sense, 7);
});

test("dictionary items become picks in order", () => {
  const picks = frdicPicks([{ kind: "sense", fr: "", zh: "牛油果", pos: "n.m." }, { kind: "syn", fr: "x", zh: "", pos: "" }]);
  assert.deepEqual(picks.map((p) => p.key), ["frdic|0", "frdic|1"]);
});

test("dictionary phrases, derived, synonyms and antonyms become picks once, with stable keys", async () => {
  const { lexEntryToDictHits } = await import("./dict.ts");
  const hits = lexEntryToDictHits({
    id: "beau",
    w: "beau",
    pos: [
      { p: "adj.", senses: [{ zh: "美丽的", src: ["atlas"], conf: 3 }] },
      { p: "n.m.", g: "m", senses: [{ zh: "美", src: ["wikt-fr"], conf: 1 }] },
    ],
    phrases: [{ fr: "avoir beau", zh: "徒然", src: "wikt-fr", conf: 1 }],
    derived: ["beauté", "embellir"],
    syn: ["joli", "joli"],
    ant: ["laid"],
    sources: ["atlas"],
  });
  const picks = dictPicks(hits);
  const keys = picks.map((p) => p.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(
    picks.filter((p) => p.kind !== "sense").map((p) => [p.kind, p.key]),
    [
      ["phrase", "dict|0|phrase|avoir beau"],
      ["family", "dict|0|family|beauté"],
      ["family", "dict|0|family|embellir"],
      ["syn", "dict|0|syn|joli"],
      ["ant", "dict|0|ant|laid"],
    ],
  );
  assert.deepEqual(picks.find((p) => p.kind === "phrase")?.zh, "徒然");
  const seed = buildSeed("beau", picks.filter((p) => p.kind !== "sense"));
  assert.deepEqual([seed.col, seed.fam, seed.syn, seed.ant], [["avoir beau｜徒然"], ["beauté", "embellir"], ["joli"], ["laid"]]);
});
