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
  loadZhShard,
  setLexdbFetcher,
  setLexdbFixtures,
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
