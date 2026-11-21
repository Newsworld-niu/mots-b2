import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";

import { sanitizeProgress } from "../../store/store.ts";
import { setLexdbFetcher } from "./load.ts";
import {
  damerauLevenshtein,
  didYouMean,
  entryToSeed,
  isCjkQuery,
  resolve,
  searchDict,
  suggest,
  zhLookup,
} from "./search.ts";
import { zhBucket, type LexEntry, type LexMeta, type LexSuggestRow } from "./types.ts";

const dir = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): LexEntry =>
  JSON.parse(readFileSync(join(dir, "fixtures", `${name}.json`), "utf8")) as LexEntry;

const accueil = fixture("accueil");
const prendre = fixture("prendre");
const beau = fixture("beau");

const vouloir: LexEntry = {
  id: "vouloir",
  w: "vouloir",
  ipa: "vulwaʁ",
  level: "A1",
  rank: 35,
  pos: [{ p: "v.", senses: [{ zh: "想要；愿意", src: ["atlas"], conf: 3 }] }],
  conj: true,
  sources: ["atlas", "lexique"],
};

const etre: LexEntry = {
  id: "etre",
  w: "être",
  ipa: "ɛtʁ",
  level: "A1",
  rank: 1,
  pos: [{ p: "v.", senses: [{ zh: "是；存在", src: ["atlas"], conf: 3 }] }],
  conj: true,
  sources: ["atlas", "lexique"],
};

const baille: LexEntry = {
  id: "baille",
  w: "baille",
  rank: 18000,
  pos: [{ p: "n.f.", g: "f", senses: [{ zh: "桶；木盆", src: ["wikt-fr"], conf: 1 }] }],
  sources: ["wikt-fr"],
};

const bailler: LexEntry = {
  id: "bailler",
  w: "bâiller",
  rank: 6500,
  pos: [{ p: "v.", senses: [{ zh: "打哈欠", src: ["wikt-zh"], conf: 1 }] }],
  sources: ["wikt-zh"],
};

const beaucoup: LexEntry = {
  id: "beaucoup",
  w: "beaucoup",
  rank: 70,
  pos: [{ p: "adv.", senses: [{ zh: "很多；非常", src: ["atlas"], conf: 3 }] }],
  sources: ["atlas"],
};

const accepter: LexEntry = {
  id: "accepter",
  w: "accepter",
  rank: 310,
  pos: [{ p: "v.", senses: [{ zh: "接受", src: ["atlas"], conf: 3 }] }],
  sources: ["atlas"],
};

const parler: LexEntry = {
  id: "parler",
  w: "parler",
  rank: 60,
  pos: [{ p: "v.", senses: [{ zh: "说话；讲", src: ["atlas"], conf: 3 }] }],
  sources: ["atlas"],
};

const entreprendre: LexEntry = {
  id: "entreprendre",
  w: "entreprendre",
  rank: 1400,
  pos: [{ p: "v.", senses: [{ zh: "着手；从事", src: ["atlas"], conf: 3 }] }],
  sources: ["atlas"],
};

const estNoun: LexEntry = {
  id: "est",
  w: "est",
  rank: 1200,
  pos: [{ p: "n.m.", g: "m", senses: [{ zh: "东；东方", src: ["atlas"], conf: 3 }] }],
  sources: ["atlas"],
};

const faire: LexEntry = {
  id: "faire",
  w: "faire",
  rank: 12,
  pos: [{ p: "v.", senses: [{ zh: "做；干", src: ["atlas"], conf: 3 }] }],
  conj: true,
  sources: ["atlas"],
};

const faitNoun: LexEntry = {
  id: "fait",
  w: "fait",
  rank: 280,
  pos: [{ p: "n.m.", g: "m", senses: [{ zh: "事实；事件", src: ["atlas"], conf: 3 }] }],
  sources: ["atlas"],
};

const eteNoun: LexEntry = {
  id: "ete",
  w: "été",
  rank: 350,
  pos: [{ p: "n.m.", g: "m", senses: [{ zh: "夏天；夏季", src: ["atlas"], conf: 3 }] }],
  sources: ["atlas"],
};

const avoir: LexEntry = {
  id: "avoir",
  w: "avoir",
  rank: 2,
  pos: [{ p: "v.", senses: [{ zh: "有", src: ["atlas"], conf: 3 }] }],
  conj: true,
  sources: ["atlas"],
};

const aPrep: LexEntry = {
  id: "a",
  w: "à",
  rank: 4,
  pos: [{ p: "prép.", senses: [{ zh: "在；向；到", src: ["atlas"], conf: 3 }] }],
  sources: ["atlas"],
};

function installMockLexdb(overrides?: Record<string, unknown>) {
  const meta: LexMeta = {
    version: 1,
    generated: "2026-11-22",
    sources: { atlas: "atlas" },
    licenses: ["CC BY-SA 4.0"],
    splits: ["pr"],
    counts: { lemmas: 10, withZh: 10 },
  };
  const suggestRows: LexSuggestRow[] = [
    ["etre", "être", 1, "是；存在"],
    ["vouloir", "vouloir", 35, "想要；愿意"],
    ["prendre", "prendre", 45, "拿；取；乘坐"],
    ["parler", "parler", 60, "说话；讲"],
    ["beaucoup", "beaucoup", 70, "很多；非常"],
    ["beau", "beau", 115, "美丽的；（天气）晴朗的"],
    ["accepter", "accepter", 310, "接受"],
    ["entreprendre", "entreprendre", 1400, "着手；从事"],
    ["accueil", "accueil", 1650, "接待；迎接；欢迎"],
    ["bailler", "bâiller", 6500, "打哈欠"],
    ["beau-frere", "beau-frère", 8200, "姐夫／妹夫"],
    ["prendre le temps", "prendre le temps", 10045, "花时间"],
    ["a cause de", "à cause de", 12000, "由于；因为"],
    ["baille", "baille", 18000, "桶；木盆"],
  ];

  const jieBucket = zhBucket("接待");
  const tianBucket = zhBucket("天气好");

  const files: Record<string, unknown> = {
    "/lexdb/meta.json": meta,
    "/lexdb/suggest.json": suggestRows,
    "/lexdb/e/ac.json": { accueil, accepter },
    "/lexdb/e/a_.json": { a: aPrep },
    "/lexdb/e/av.json": { avoir },
    "/lexdb/e/pre.json": { prendre },
    "/lexdb/e/be.json": { beau, beaucoup },
    "/lexdb/e/vo.json": { vouloir },
    "/lexdb/e/et.json": { etre, ete: eteNoun },
    "/lexdb/e/es.json": { est: estNoun },
    "/lexdb/e/fa.json": { faire, fait: faitNoun },
    "/lexdb/e/ba.json": { baille, bailler },
    "/lexdb/e/pa.json": { parler },
    "/lexdb/e/en.json": { entreprendre },
    "/lexdb/forms/a_.json": { a: ["avoir"] },
    "/lexdb/forms/vo.json": { voulons: ["vouloir"] },
    "/lexdb/forms/pri.json": { pris: ["prendre"] },
    "/lexdb/forms/be.json": { belle: ["beau"], belles: ["beau"], beaux: ["beau"] },
    "/lexdb/forms/ba.json": { baille: ["bailler"] },
    "/lexdb/forms/es.json": { est: ["etre"] },
    "/lexdb/forms/fa.json": { fait: ["faire"] },
    "/lexdb/forms/et.json": { ete: ["etre"] },
    [`/lexdb/zh/${jieBucket}.json`]: {
      接待: [
        ["accueil", 1650],
        ["accepter", 310],
      ],
      接待处: [["accueil", 1650]],
    },
    [`/lexdb/zh/${tianBucket}.json`]: {
      天气好: [["beau", 115]],
    },
    ...overrides,
  };

  setLexdbFetcher(async (url) => files[url] ?? null);
}

afterEach(() => {
  setLexdbFetcher(null);
});

test("isCjkQuery detects CJK vs French queries", () => {
  assert.equal(isCjkQuery("接待"), true);
  assert.equal(isCjkQuery("天气好"), true);
  assert.equal(isCjkQuery("法语 hello"), true);
  assert.equal(isCjkQuery("accueil"), false);
  assert.equal(isCjkQuery("être"), false);
  assert.equal(isCjkQuery(""), false);
});

test("suggest returns accent-folded prefix matches before substring matches, sorted by rank asc", async () => {
  installMockLexdb();

  // Prefix matches sorted by rank: accepter (310) before accueil (1650)
  const acc = await suggest("acc");
  assert.deepEqual(
    acc.map((r) => r[0]),
    ["accepter", "accueil"],
  );

  // Exact match ("beau") ranks before higher-frequency prefix ("beaucoup")
  const b = await suggest("beau");
  assert.equal(b[0][0], "beau");
  assert.deepEqual(
    b.map((r) => r[0]),
    ["beau", "beaucoup", "beau-frere"],
  );

  // Matches both lemmas and multi-word phrases; prefix before substring
  const pr = await suggest("prendre");
  assert.deepEqual(
    pr.map((r) => r[0]),
    ["prendre", "prendre le temps", "entreprendre"],
  );

  // Substring match hits multi-word phrases too
  const cause = await suggest("cause");
  assert.deepEqual(
    cause.map((r) => r[0]),
    ["a cause de"],
  );

  // Accent folding works in prefix search
  const et = await suggest("êtr");
  assert.deepEqual(
    et.map((r) => r[0]),
    ["etre"],
  );

  assert.deepEqual(await suggest("   "), []);
  assert.equal((await suggest("be", 2)).length, 2);
});

test("resolve handles exact, accent-insensitive, inflected forms, and multi-word phrases", async () => {
  installMockLexdb();

  // Accent-insensitive exact lemma
  const r1 = await resolve("etre");
  assert.equal(r1.matchedVia, "exact");
  assert.equal(r1.entries[0].w, "être");

  const r2 = await resolve("Accueil");
  assert.equal(r2.matchedVia, "exact");
  assert.equal(r2.entries[0].id, "accueil");

  // Accent-exact match vs accented verb form (dict.ts parity: bâille -> bâiller before baille, baille -> baille before bâiller)
  const baillePlain = await resolve("baille");
  assert.equal(baillePlain.matchedVia, "exact");
  assert.deepEqual(
    baillePlain.entries.map((e) => e.w),
    ["baille", "bâiller"],
  );

  const bailleAccented = await resolve("bâille");
  assert.equal(bailleAccented.matchedVia, "form");
  assert.equal(bailleAccented.formTarget, "bâiller");
  assert.deepEqual(
    bailleAccented.entries.map((e) => e.w),
    ["bâiller", "baille"],
  );

  // Lemma + conjugated form collisions (est/être, fait/faire, a/avoir/à, ete/été/être)
  const estRes = await resolve("est");
  assert.equal(estRes.matchedVia, "exact");
  assert.deepEqual(
    estRes.entries.map((e) => e.id),
    ["est", "etre"],
  );

  const faitRes = await resolve("fait");
  assert.equal(faitRes.matchedVia, "exact");
  assert.deepEqual(
    faitRes.entries.map((e) => e.id),
    ["fait", "faire"],
  );

  const aRes = await resolve("a");
  assert.equal(aRes.matchedVia, "exact");
  assert.deepEqual(
    aRes.entries.map((e) => e.id),
    ["avoir", "a"],
  );

  const eteFolded = await resolve("ete");
  assert.equal(eteFolded.matchedVia, "exact");
  assert.deepEqual(
    eteFolded.entries.map((e) => e.id),
    ["etre", "ete"],
  );

  const eteAccented = await resolve("été");
  assert.equal(eteAccented.matchedVia, "exact");
  assert.deepEqual(
    eteAccented.entries.map((e) => e.id),
    ["ete", "etre"],
  );

  // Inflected forms via forms/<key>.json (including 3-letter split forms/pri.json)
  const v = await resolve("voulons");
  assert.equal(v.matchedVia, "form");
  assert.equal(v.formTarget, "vouloir");
  assert.equal(v.entries[0].id, "vouloir");

  const p = await resolve("pris");
  assert.equal(p.matchedVia, "form");
  assert.equal(p.formTarget, "prendre");
  assert.equal(p.entries[0].id, "prendre");

  // Multi-word phrases stored inside lemma entries (direct & via inflected token)
  const p1 = await resolve("prendre le temps");
  assert.equal(p1.matchedVia, "phrase");
  assert.equal(p1.entries[0].id, "prendre");

  const p2 = await resolve("page d’accueil");
  assert.equal(p2.matchedVia, "phrase");
  assert.equal(p2.entries[0].id, "accueil");

  const p3 = await resolve("à la belle étoile");
  assert.equal(p3.matchedVia, "phrase");
  assert.equal(p3.entries[0].id, "beau");

  const p4 = await resolve("beau-frère");
  assert.equal(p4.matchedVia, "phrase");
  assert.equal(p4.entries[0].id, "beau");

  // Standalone phrase present in suggest.json fallback
  const p5 = await resolve("à cause de");
  assert.equal(p5.matchedVia, "phrase");
  assert.equal(p5.entries[0].w, "à cause de");

  // Unknown word
  const miss = await resolve("zzzzzz");
  assert.equal(miss.matchedVia, "none");
  assert.deepEqual(miss.entries, []);
});

test("zhLookup searches zh/<bucket>.json by rank and falls back to suggest.json shortZh when shard misses", async () => {
  installMockLexdb();

  // Exact shard match sorted by rank ascending + prefix match ("接待处") + enriched with w/shortZh
  const jie = await zhLookup("接待");
  assert.deepEqual(
    jie.map((h) => h.id),
    ["accepter", "accueil"],
  );
  assert.equal(jie[0].w, "accepter");
  assert.equal(jie[1].shortZh, "接待；迎接；欢迎");

  // Exact multi-char shard match
  const tian = await zhLookup("天气好");
  assert.equal(tian[0].id, "beau");

  // Shard term misses -> prefix/substring fallback in suggest.json shortZh
  const ying = await zhLookup("迎接");
  assert.equal(ying[0].id, "accueil");
  assert.equal(ying[0].w, "accueil");

  const qing = await zhLookup("晴朗");
  assert.equal(qing[0].id, "beau");
});

test("damerauLevenshtein and didYouMean correct transpositions, deletions, substitutions, and 1st-letter typos", async () => {
  installMockLexdb();

  assert.equal(damerauLevenshtein("accueil", "accueil"), 0);
  assert.equal(damerauLevenshtein("acceuil", "accueil"), 1);
  assert.equal(damerauLevenshtein("ca", "abc"), 2);
  assert.ok(damerauLevenshtein("abcdef", "uvwxyz", 2) > 2);

  // Transposition typo
  const d1 = await didYouMean("acceuil");
  assert.equal(d1[0][0], "accueil");

  // Missing letter typo
  const d2 = await didYouMean("aceuil");
  assert.equal(d2[0][0], "accueil");

  // 1st-letter typo for length <= 8
  const d3 = await didYouMean("qcceuil");
  assert.equal(d3[0][0], "accueil");

  const d4 = await didYouMean("teau");
  assert.equal(d4[0][0], "beau");

  // Distance 2 transposition + substitution on longer (>8) word
  const d5 = await didYouMean("entrperendre");
  assert.equal(d5[0][0], "entreprendre");

  // Respects limit = 5
  assert.ok((await didYouMean("beua", 5)).length <= 5);
});

test("searchDict auto-routes CJK vs French and provides didYouMean when French misses", async () => {
  installMockLexdb();

  const zhRes = await searchDict("接待");
  assert.equal(zhRes.isCjk, true);
  assert.equal(zhRes.zhHits[0].id, "accepter");
  assert.equal(zhRes.entries.length, 0);

  const frHit = await searchDict("pris");
  assert.equal(frHit.isCjk, false);
  assert.equal(frHit.matchedVia, "form");
  assert.equal(frHit.formTarget, "prendre");
  assert.equal(frHit.entries[0].id, "prendre");
  assert.deepEqual(frHit.didYouMean, []);

  const frMiss = await searchDict("acceuil");
  assert.equal(frMiss.isCjk, false);
  assert.equal(frMiss.matchedVia, "none");
  assert.equal(frMiss.entries.length, 0);
  assert.equal(frMiss.didYouMean[0][0], "accueil");

  const empty = await searchDict("   ");
  assert.equal(empty.query, "");
  assert.equal(empty.matchedVia, "none");
});

test("entryToSeed converts LexEntry fixtures into WordForm/createCustomWord compatible Seeds", () => {
  const seed = entryToSeed(beau);
  assert.equal(seed.w, "beau");
  assert.equal(seed.pos, "adj.");
  assert.equal(seed.zh, "英俊的；美丽的；漂亮的；好看的；优美的");
  assert.equal(seed.ipa, "bo");
  assert.equal(seed.senses.length, 5);
  assert.deepEqual(seed.senses[2], { pos: "n.m.", zh: "美；美好的事物" });
  assert.equal(seed.ex.length, 4);
  assert.equal(seed.ex[0].src, undefined); // "atlas" is not "tatoeba"
  assert.equal(seed.ex[1].src, "tatoeba");
  assert.deepEqual(seed.ex[1].hl, [34, 39]);
  assert.equal(seed.col[0], "il fait beau｜天气好");
  assert.ok(seed.fam.includes("beauté"));
  assert.ok(seed.syn.includes("joli"));
  assert.ok(seed.ant.includes("laid"));
  assert.match(seed.note, /bellus/);

  // Custom gloss option overrides primary zh and keeps other senses without duplicating custom gloss
  const customSeed = entryToSeed(accueil, { customGloss: "接待处；柜台；前台" });
  assert.equal(customSeed.zh, "接待处；柜台；前台");
  assert.equal(customSeed.pos, "n.m.");
  assert.equal(
    customSeed.senses.some((s) => s.zh === "接待处；柜台；前台"),
    false,
  );
  assert.equal(customSeed.senses.length, 3);

  // Roundtrip through sanitizeProgress (compatible with CustomWord & WordForm)
  const id = "u-lexdb1";
  const cleaned = sanitizeProgress({ version: 2, cards: {}, custom: { [id]: { ...seed, created: 100, auto: true } } }, "t");
  assert.equal(cleaned.custom?.[id]?.w, "beau");
  assert.equal(cleaned.custom?.[id]?.ex?.[1]?.src, "tatoeba");
});
