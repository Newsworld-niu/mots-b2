import assert from "node:assert/strict";
import { test } from "node:test";

import type { WordRef } from "../atlas/types.ts";
import { setDictFetcher } from "./dict.ts";
import { editDistance, nearWords, scanDistance } from "./near.ts";

const ref = (id: string, word: string, zh = id): WordRef => ({ id, word, zh, ipa: "", cefr: 0, topic: 0, media: 0, order: 0 });
const words = [ref("maison", "maison", "房子"), ref("chef", "chef", "厨师长"), ref("raison", "raison", "理由"), ref("homme", "homme", "男人"), ref("main", "main", "手")];

test("edit distance counts changes, gaps and swaps", () => {
  assert.equal(editDistance("maison", "maison"), 0);
  assert.equal(editDistance("maisan", "maison"), 1);
  assert.equal(editDistance("masion", "maison"), 1, "a swap is one edit");
  assert.equal(editDistance("mason", "maison"), 1);
});

test("typical scanning confusions count as one edit", () => {
  assert.equal(scanDistance("rnaison", "maison"), 1);
  assert.equal(scanDistance("clief", "chef"), 1, "li read for h");
  assert.equal(scanDistance("hornme", "homme"), 1);
});

test("near words come from the atlas and the dictionary, closest first", async () => {
  setDictFetcher(async (url) => (url.endsWith("/ma.json") ? { f: {}, l: { maisonnette: [{ w: "maisonnette", p: "n.f.", zh: [["小房子", ""]] }], maison: [{ w: "maison", p: "n.f.", zh: [["房子", ""]] }] } } : null));
  const got = await nearWords("maisan", words);
  assert.equal(got[0].word, "maison");
  assert.equal(got[0].id, "maison");
  assert.deepEqual((await nearWords("rnaison", words)).map((x) => x.word).slice(0, 2), ["maison", "raison"]);
  // too far: nothing rather than a wild guess
  assert.deepEqual(await nearWords("xyzzyq", words), []);
  // short words allow one edit only
  assert.ok(!(await nearWords("mian", words)).some((x) => x.word === "maison"));
});
