import assert from "node:assert/strict";
import { test } from "node:test";

import { dictFold, dictKey, joinGlosses, lookupDict, setDictFetcher } from "./dict.ts";

test("file keys match the build: two folded letters, a_ for one letter, __ for no leading letter", () => {
  assert.equal(dictKey(dictFold("Œil")), "oe");
  assert.equal(dictKey(dictFold("à")), "a_");
  assert.equal(dictKey(dictFold("être")), "et");
  assert.equal(dictKey(dictFold("1er")), "__");
  assert.equal(dictKey(dictFold("l'eau")), "le");
});

test("an inflected form finds its lemma in another file; the word itself comes first", async () => {
  const files: Record<string, unknown> = {
    "/dict/ye.json": { f: { yeux: ["oeil"] }, l: {} },
    "/dict/oe.json": { f: {}, l: { oeil: [{ w: "œil", p: "n.m.", ipa: "œj", zh: [["眼睛", "Organe de la vue"]] }] } },
    "/dict/vo.json": { f: { voulons: ["vouloir"] }, l: { vouloir: [{ w: "vouloir", p: "v.", zh: [["想要", ""]] }], voulons: [] } },
  };
  const asked: string[] = [];
  setDictFetcher(async (url) => {
    asked.push(url);
    return (files[url] as never) ?? null;
  });
  const yeux = await lookupDict("Yeux");
  assert.equal(yeux.length, 1);
  assert.equal(yeux[0].w, "œil");
  assert.equal(yeux[0].form, "Yeux");
  const v = await lookupDict("voulons");
  assert.deepEqual(v.map((h) => h.w), ["vouloir"]);
  assert.deepEqual(await lookupDict("zzz"), []);
  files["/dict/ba.json"] = { f: { baille: ["bailler"] }, l: { baille: [{ w: "baille", p: "n.f." }], bailler: [{ w: "bâiller", p: "v.", zh: [["打哈欠", ""]] }] } };
  assert.deepEqual((await lookupDict("bâille")).map((h) => h.w), ["bâiller", "baille"], "the verb form before the noun spelled without the accent");
  assert.deepEqual((await lookupDict("baille")).map((h) => h.w), ["baille", "bâiller"]);
  await lookupDict("vouloir");
  assert.equal(asked.filter((u) => u === "/dict/vo.json").length, 1, "a file is fetched once");
});

test("glosses join without repeats", () => {
  assert.equal(joinGlosses([["迎接", "a"], ["接待", "a"], ["迎接", "b"], ["柜台", ""], ["前台", ""]]), "迎接；接待；柜台");
});
