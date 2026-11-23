import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  getEntriesByLemma,
  getEntryById,
  loadEntryShard,
  loadFormsShard,
  loadMeta,
  loadSuggest,
  loadSuggestShard,
  loadZhShard,
  setLexdbFetcher,
  setLexdbFixtures,
  suggestBucket,
} from "./load.ts";
import type { LexEntry, LexMeta, LexSuggestRow } from "./types.ts";

const dir = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): LexEntry =>
  JSON.parse(readFileSync(join(dir, "fixtures", `${name}.json`), "utf8")) as LexEntry;

const accueil = fixture("accueil");
const prendre = fixture("prendre");
const beau = fixture("beau");

afterEach(() => {
  setLexdbFetcher(null);
});

test("loadMeta, loadSuggest, loadEntryShard, loadFormsShard, loadZhShard cache promises and retry after null", async () => {
  const asked: string[] = [];
  const meta: LexMeta = {
    version: 1,
    generated: "2026-11-22",
    sources: { atlas: "atlas" },
    licenses: ["CC BY-SA 4.0"],
    splits: ["pr"],
    counts: { lemmas: 3, withZh: 3 },
  };
  const suggestRows: LexSuggestRow[] = [["accueil", "accueil", 1650, "接待；迎接"]];
  const files: Record<string, unknown> = {
    "/lexdb/meta.json": meta,
    "/lexdb/suggest.json": suggestRows,
    "/lexdb/e/ac.json": { accueil },
    "/lexdb/e/pre.json": { prendre },
    "/lexdb/forms/pri.json": { pris: ["prendre"] },
    "/lexdb/zh/10.json": { 接待: [["accueil", 1650]] },
  };

  setLexdbFetcher(async (url) => {
    asked.push(url);
    return files[url] ?? null;
  });

  // Concurrent calls share the same promise
  const [m1, m2, s1, s2] = await Promise.all([loadMeta(), loadMeta(), loadSuggest(), loadSuggest()]);
  assert.deepEqual(m1, meta);
  assert.equal(m1, m2);
  assert.deepEqual(s1, suggestRows);
  assert.equal(s1, s2);
  assert.equal(asked.filter((u) => u === "/lexdb/meta.json").length, 1);
  assert.equal(asked.filter((u) => u === "/lexdb/suggest.json").length, 1);

  assert.equal((await loadEntryShard("ac"))?.accueil.w, "accueil");
  assert.equal((await loadEntryShard("ac"))?.accueil.w, "accueil");
  assert.equal(asked.filter((u) => u === "/lexdb/e/ac.json").length, 1);

  assert.deepEqual(await loadFormsShard("pri"), { pris: ["prendre"] });
  assert.deepEqual(await loadZhShard(10), { 接待: [["accueil", 1650]] });

  // Null responses are not poisoned in cache
  assert.equal(await loadEntryShard("zz"), null);
  files["/lexdb/e/zz.json"] = { zzz: { id: "zzz", w: "zzz", pos: [], sources: ["lexique"] } };
  assert.equal((await loadEntryShard("zz"))?.zzz.w, "zzz");

  // Invalid shard keys and buckets do not trigger network fetches
  const countBefore = asked.length;
  assert.equal(await loadEntryShard(""), null);
  assert.equal(await loadEntryShard("../etc"), null);
  assert.equal(await loadFormsShard("ABCD"), null);
  assert.equal(await loadZhShard(-1), null);
  assert.equal(await loadZhShard(64), null);
  assert.equal(await loadZhShard(1.5), null);
  assert.equal(asked.length, countBefore);

  // setLexdbFetcher clears all internal caches
  setLexdbFetcher(async (url) => {
    asked.push(`second:${url}`);
    return null;
  });
  assert.equal(await loadMeta(), null);
  assert.ok(asked.includes("second:/lexdb/meta.json"));
});

test("getEntryById respects meta.splits, falls back gracefully when meta is absent, and handles homographs & fixtures", async () => {
  const tour2: LexEntry = {
    id: "tour#2",
    w: "tour",
    rank: 420,
    pos: [{ p: "n.f.", g: "f", senses: [{ zh: "塔", src: ["atlas"], conf: 3 }] }],
    sources: ["atlas"],
  };
  const tour1: LexEntry = {
    id: "tour",
    w: "tour",
    rank: 210,
    pos: [{ p: "n.m.", g: "m", senses: [{ zh: "圈；周游", src: ["atlas"], conf: 3 }] }],
    sources: ["atlas"],
  };

  const files: Record<string, unknown> = {
    "/lexdb/meta.json": {
      version: 1,
      generated: "2026-11-22",
      sources: {},
      licenses: [],
      splits: ["pr"],
      counts: { lemmas: 4, withZh: 4 },
    },
    "/lexdb/e/pre.json": { prendre },
    "/lexdb/e/ac.json": { accueil },
    "/lexdb/e/to.json": { tour: tour1, "tour#2": tour2 },
  };
  setLexdbFetcher(async (url) => files[url] ?? null);

  assert.equal((await getEntryById("prendre"))?.w, "prendre");
  assert.equal((await getEntryById("Accueil"))?.id, "accueil");
  assert.equal((await getEntryById("tour#2"))?.pos[0].p, "n.f.");
  assert.equal((await getEntriesByLemma("tour")).length, 2);
  assert.equal(await getEntryById("   "), null);

  // Graceful fallback to 2-letter base key when meta.json is missing
  setLexdbFetcher(async (url) => {
    if (url === "/lexdb/e/pr.json") return { prendre };
    return null;
  });
  assert.equal((await getEntryById("prendre"))?.w, "prendre");

  // Direct fixture injection for tests without mocked shards
  setLexdbFetcher(null);
  setLexdbFixtures([accueil, prendre, beau]);
  assert.equal((await getEntryById("beau"))?.ipa, "bo");
  assert.equal((await getEntryById("prendre"))?.conj, true);
  assert.equal((await getEntriesByLemma("accueil")).length, 1);

  // setLexdbFetcher clears injected fixtures too
  setLexdbFetcher(async () => null);
  assert.equal(await getEntryById("beau"), null);
});

test("getEntryById supports 4-letter prefix splits when a 3-letter shard exceeds 400 KB", async () => {
  const construire: LexEntry = {
    id: "construire",
    w: "construire",
    rank: 520,
    pos: [{ p: "v.", senses: [{ zh: "建造；构建", src: ["atlas"], conf: 3 }] }],
    sources: ["atlas"],
  };
  const files: Record<string, unknown> = {
    "/lexdb/meta.json": {
      version: 1,
      generated: "2026-11-22",
      sources: {},
      licenses: [],
      splits: ["co", "con"],
      counts: { lemmas: 1, withZh: 1 },
    },
    "/lexdb/e/cons.json": { construire },
  };
  setLexdbFetcher(async (url) => files[url] ?? null);
  assert.equal((await getEntryById("construire"))?.w, "construire");
});

test("suggestBucket and loadSuggestShard respect suggestSplits and cache per bucket", async () => {
  assert.equal(suggestBucket("accueil", ["c"]), "a");
  assert.equal(suggestBucket("commencer", ["c"]), "co");
  assert.equal(suggestBucket("c", ["c"]), "c_");
  assert.equal(suggestBucket("une fois", ["u", "un"]), "une");
  assert.equal(suggestBucket("un peu", ["u", "un"]), "un_");
  assert.equal(suggestBucket("1er"), "_");

  const asked: string[] = [];
  const files: Record<string, unknown> = {
    "/lexdb/suggest/top.json": [["accueil", "accueil", 1650, "接待"]],
    "/lexdb/suggest/co.json": [["commencer", "commencer", 120, "开始"]],
  };
  setLexdbFetcher(async (url) => {
    asked.push(url);
    return files[url] ?? null;
  });
  assert.equal((await loadSuggestShard("top"))?.[0][0], "accueil");
  assert.equal((await loadSuggestShard("top"))?.[0][0], "accueil");
  assert.equal((await loadSuggestShard("co"))?.[0][0], "commencer");
  assert.equal(await loadSuggestShard("../bad"), null);
  assert.equal(asked.filter((u) => u === "/lexdb/suggest/top.json").length, 1);
});

test("runtime validators reject corrupt lexdb payloads and drop malformed shard entries cleanly", async () => {
  const { validateLexMeta, validateSuggestRows, validateLexShard, validateFormsShard, validateZhShard } = await import("./validate.ts");
  assert.equal(validateLexMeta({ version: "1" }), null);
  assert.equal(validateLexMeta({ version: 1, generated: "", sources: {}, licenses: [], splits: [], counts: { lemmas: 1, withZh: 1 } }), null);
  assert.ok(validateLexMeta(JSON.parse(readFileSync(join(dir, "..", "..", "..", "public", "lexdb", "meta.json"), "utf8"))));

  // Real shard validation sanity check
  const realShard = JSON.parse(readFileSync(join(dir, "..", "..", "..", "public", "lexdb", "e", "ac.json"), "utf8"));
  const validatedReal = validateLexShard(realShard);
  assert.ok(validatedReal && Object.keys(validatedReal).length === Object.keys(realShard).length);

  assert.equal(validateSuggestRows("not-array"), null);
  assert.equal(validateSuggestRows([["", "x", 1], ["a", "a", Number.NaN]]), null);
  assert.deepEqual(validateSuggestRows([["bad"], ["bon", "bon", 12, "好的"]]), [["bon", "bon", 12, "好的"]]);

  assert.equal(validateLexShard({ bad: { w: "no-id", pos: [] } }), null);
  const partialShard = validateLexShard({ bad: { id: "", w: "x" }, accueil });
  assert.deepEqual(Object.keys(partialShard ?? {}), ["accueil"]);

  assert.equal(validateFormsShard({ bad: "not-array" }), null);
  assert.deepEqual(validateFormsShard({ bad: [123], bon: ["bon"] }), { bon: ["bon"] });

  assert.equal(validateZhShard({ bad: [["id", "NaN"]] }), null);
  assert.deepEqual(validateZhShard({ bad: [["x"]], 好: [["bon", 12]] }), { 好: [["bon", 12]] });

  // Corrupt fetcher answers are rejected and not cached as poison
  const asked: string[] = [];
  let badMeta = true;
  setLexdbFetcher(async (url) => {
    asked.push(url);
    if (url.endsWith("/meta.json")) {
      return badMeta ? { version: "oops" } : { version: 1, generated: "2026", sources: {}, licenses: [], splits: [], counts: { lemmas: 1, withZh: 1 } };
    }
    if (url.endsWith("/e/ab.json")) return { corrupt: { w: "missing" } };
    return null;
  });
  assert.equal(await loadMeta(), null);
  badMeta = false;
  assert.equal((await loadMeta())?.version, 1);
  assert.equal(await loadEntryShard("ab"), null);
});

test("entryShards LRU evicts oldest shards past LEXDB_ENTRY_CACHE_MAX and refetches on demand", async () => {
  const { LEXDB_ENTRY_CACHE_MAX } = await import("./load.ts");
  const fetched: string[] = [];
  setLexdbFetcher(async (url) => {
    fetched.push(url);
    const m = url.match(/\/e\/([a-z]{2})\.json$/);
    if (!m) return null;
    const k = m[1];
    return { [k]: { id: k, w: k, pos: [], sources: ["lexique"] } };
  });

  const keys: string[] = [];
  for (let i = 0; i < LEXDB_ENTRY_CACHE_MAX + 2; i++) {
    const k = String.fromCharCode(97 + Math.floor(i / 26)) + String.fromCharCode(97 + (i % 26));
    keys.push(k);
    await loadEntryShard(k);
  }
  const beforeRefetch = fetched.length;
  // Most recent key is still cached (no new fetch)
  await loadEntryShard(keys[keys.length - 1]);
  assert.equal(fetched.length, beforeRefetch);
  // Oldest key ("aa") was evicted and is refetched cleanly
  const first = await loadEntryShard(keys[0]);
  assert.equal(first?.[keys[0]]?.w, keys[0]);
  assert.equal(fetched.length, beforeRefetch + 1);
});
