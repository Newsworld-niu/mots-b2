import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { dictFold, dictKey, joinGlosses, lexEntryToDictHits, lookupDict, nearDict, setDictFetcher } from "./dict.ts";
import type { LexEntry } from "./lexdb/types.ts";

afterEach(() => {
  setDictFetcher(null);
});

test("file keys match LexDB prefix buckets: two folded letters, a_ for one letter, __ for no leading letter", () => {
  assert.equal(dictKey(dictFold("Œil")), "oe");
  assert.equal(dictKey(dictFold("à")), "a_");
  assert.equal(dictKey(dictFold("être")), "et");
  assert.equal(dictKey(dictFold("1er")), "__");
  assert.equal(dictKey(dictFold("l'eau")), "le");
});

test("lookupDict resolves exact lemmas, inflected forms across LexDB shards, and accent priority", async () => {
  const files: Record<string, unknown> = {
    "/lexdb/meta.json": {
      version: 1,
      generated: "2026-11-22",
      sources: { lexique: "Lexique" },
      licenses: [],
      splits: [],
      counts: { lemmas: 4, withZh: 3 },
    },
    "/lexdb/forms/ye.json": { yeux: ["oeil"] },
    "/lexdb/e/oe.json": {
      oeil: {
        id: "oeil",
        w: "œil",
        ipa: "œj",
        pos: [
          {
            p: "n.m.",
            senses: [
              {
                zh: "眼睛",
                fr: "Organe de la vue",
                src: ["lexique"],
                conf: 3,
                ex: [{ fr: "Il a mal à l'œil droit.", zh: "他右眼疼。", src: "tatoeba", hl: [13, 17] }],
              },
            ],
          },
        ],
        sources: ["lexique"],
      },
    },
    "/lexdb/forms/vo.json": { voulons: ["vouloir"] },
    "/lexdb/e/vo.json": {
      vouloir: {
        id: "vouloir",
        w: "vouloir",
        pos: [{ p: "v.", senses: [{ zh: "想要", src: ["lexique"], conf: 3 }] }],
        sources: ["lexique"],
      },
    },
    "/lexdb/forms/ba.json": { baille: ["bailler"] },
    "/lexdb/e/ba.json": {
      baille: {
        id: "baille",
        w: "baille",
        pos: [{ p: "n.f.", senses: [{ zh: "木桶", src: ["lexique"], conf: 2 }] }],
        sources: ["lexique"],
      },
      bailler: {
        id: "bailler",
        w: "bâiller",
        pos: [{ p: "v.", senses: [{ zh: "打哈欠", src: ["lexique"], conf: 3 }] }],
        sources: ["lexique"],
      },
    },
  };

  const asked: string[] = [];
  setDictFetcher(async (url) => {
    asked.push(url);
    return files[url] ?? null;
  });

  const yeux = await lookupDict("Yeux");
  assert.equal(yeux.length, 1);
  assert.equal(yeux[0].w, "œil");
  assert.equal(yeux[0].ipa, "œj");
  assert.equal(yeux[0].form, "Yeux");
  assert.deepEqual(yeux[0].ex, [["Il a mal à l'œil droit.", "他右眼疼。", 13, 17]]);

  const v = await lookupDict("voulons");
  assert.deepEqual(v.map((h) => h.w), ["vouloir"]);
  assert.deepEqual(await lookupDict("zzz"), []);

  assert.deepEqual((await lookupDict("bâille")).map((h) => h.w), ["bâiller", "baille"]);
  assert.deepEqual((await lookupDict("baille")).map((h) => h.w), ["baille", "bâiller"]);

  await lookupDict("vouloir");
  assert.equal(asked.filter((u) => u === "/lexdb/e/vo.json").length, 1, "LexDB shard is cached and fetched once");

  const near = await nearDict("voulour", (a, b) => (a === b ? 0 : Math.abs(a.length - b.length) <= 1 ? 1 : 9), 1);
  assert.equal(near[0]?.entry.w, "vouloir");
});

test("glosses join without repeats", () => {
  assert.equal(joinGlosses([["迎接", "a"], ["接待", "a"], ["迎接", "b"], ["柜台", ""], ["前台", ""]]), "迎接；接待；柜台");
});

const multiPos: LexEntry = {
  id: "beau",
  w: "beau",
  forms: { f: "belle", pl: "beaux", fpl: "belles" },
  pos: [
    { p: "adj.", senses: [{ zh: "美丽的", src: ["atlas"], conf: 3 }] },
    { p: "n.m.", g: "m", senses: [{ zh: "美", src: ["wikt-fr"], conf: 1 }] },
  ],
  phrases: [{ fr: "avoir beau", zh: "徒然", src: "wikt-fr", conf: 1 }],
  derived: ["beauté", " embellir ", "beauté", ""],
  syn: ["joli"],
  ant: ["laid"],
  conj: false,
  sources: ["atlas", "wikt-fr"],
};

test("lexEntryToDictHits carries gender per POS and lemma-wide fields on the first hit only", () => {
  const hits = lexEntryToDictHits(multiPos);
  assert.equal(hits.length, 2);
  assert.equal(hits[0].g, undefined);
  assert.equal(hits[1].g, "m");
  assert.deepEqual(hits[0].forms, { f: "belle", pl: "beaux", fpl: "belles" });
  assert.deepEqual(hits[0].phrases, [["avoir beau", "徒然"]]);
  assert.deepEqual(hits[0].derived, [["beauté", ""], ["embellir", ""]]);
  assert.deepEqual(hits[0].syn, ["joli"]);
  assert.deepEqual(hits[0].ant, ["laid"]);
  assert.equal(hits[0].conj, undefined);
  for (const k of ["forms", "phrases", "derived", "syn", "ant", "conj"] as const) assert.equal(hits[1][k], undefined, k);

  const verb = lexEntryToDictHits({ id: "prendre", w: "prendre", conj: true, pos: [{ p: "v.", senses: [] }], sources: [] });
  assert.equal(verb[0].conj, true);
  // legacy fields stay intact and nothing new appears on a bare entry
  assert.deepEqual(lexEntryToDictHits({ id: "x", w: "x", pos: [{ p: "n.f.", senses: [{ zh: "某物", src: [], conf: 1 }] }], sources: [] }), [
    { w: "x", p: "n.f.", zh: [["某物", ""]] },
  ]);
});
