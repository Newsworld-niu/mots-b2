import assert from "node:assert/strict";
import { test } from "node:test";
import type { WordRef } from "../atlas/types.ts";
import { searchAtlas } from "./search.ts";

const w = (id: string, word: string, zh: string, order: number): WordRef => ({ id, word, zh, ipa: "", cefr: 0, topic: 0, media: 0, order });
const atlas = { words: [w("tre", "très", "很", 0), w("etre", "être", "是；存在", 1), w("ete", "été", "夏天", 2), w("etat", "état", "状态", 3), w("ecole", "école", "学校", 4)] };
const ids = (q: string) => searchAtlas(atlas, q).map((x) => x.id);

test("accents are optional when searching", () => {
  assert.deepEqual(ids("etre").slice(0, 1), ["etre"]);
  assert.deepEqual(ids("ecole"), ["ecole"]);
  assert.equal(ids("tres")[0], "tre");
});

test("exact spelling beats the unaccented match, which beats prefixes", () => {
  assert.equal(ids("été")[0], "ete");
  assert.equal(ids("ete")[0], "ete");
  assert.deepEqual(ids("et"), ["ete", "etre", "etat"], "unaccented prefix: shorter words first, then path order");
});

test("Chinese search matches the gloss; empty and unknown queries return nothing", () => {
  assert.deepEqual(ids("夏"), ["ete"]);
  assert.deepEqual(ids("  "), []);
  assert.deepEqual(ids("zzz"), []);
});
