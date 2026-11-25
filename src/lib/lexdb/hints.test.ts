import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { findHint, hintKey, resolveHints } from "./hints.ts";
import { loadHintsShard, loadMeta, setLexdbFetcher } from "./load.ts";
import { hintBucket, type LexMeta } from "./types.ts";
import { validateHintsShard, validateLexEntry, validateLexMeta } from "./validate.ts";
import { memoryHint } from "../../pages/dict/helpers.ts";
import type { Atlas, WordRef } from "../../atlas/types.ts";

afterEach(() => {
  setLexdbFetcher(null);
});

const META: LexMeta = {
  version: 1,
  generated: "2026-11-25",
  sources: { atlas: "atlas" },
  licenses: [],
  splits: [],
  hintsShards: true,
  counts: { lemmas: 3, withZh: 3, withDerived: 1, withSyn: 1, withAnt: 1 },
};

test("hintBucket: first folded letter, '_' for anything not starting with a letter", () => {
  assert.equal(hintBucket("Bonheur"), "b");
  assert.equal(hintBucket("été"), "e");
  assert.equal(hintBucket("Œil"), "o");
  assert.equal(hintBucket("à"), "a");
  assert.equal(hintBucket("  l'heure"), "l");
  assert.equal(hintBucket("1er"), "_");
  assert.equal(hintBucket("-ment"), "_");
  assert.equal(hintBucket(""), "_");
});

test("validateHintsShard keeps [pos, shortZh] tuples and drops malformed rows", () => {
  assert.deepEqual(validateHintsShard({ bonheur: ["n.m.", "幸福"], bad: "x", worse: [1, 2], ok: ["", "好"] }), {
    bonheur: ["n.m.", "幸福"],
    ok: ["", "好"],
  });
  assert.equal(validateHintsShard({ bad: 1 }), null);
  assert.equal(validateHintsShard([]), null);
  assert.deepEqual(validateHintsShard({}), {});
});

test("validateLexMeta accepts hintsShards booleans and rejects other types", () => {
  assert.equal(validateLexMeta(META)?.hintsShards, true);
  assert.equal(validateLexMeta({ ...META, hintsShards: "yes" }), null);
  const { hintsShards: _omit, ...rest } = META;
  assert.ok(validateLexMeta(rest));
});

test("validateLexEntry sanitizes syn / ant / derived so renderers never see non-strings", () => {
  const base = { id: "heureux", w: "heureux", pos: [], sources: ["atlas"] };
  const clean = { ...base, syn: ["content"], ant: ["malheureux"], derived: ["bonheur"] };
  assert.equal(validateLexEntry(clean), clean, "clean entries pass through untouched");
  const dirty = validateLexEntry({ ...base, syn: ["content", 3, "", " joyeux ", "content"], ant: "triste", derived: [null] });
  assert.ok(dirty);
  assert.deepEqual(dirty.syn, ["content", "joyeux"]);
  assert.equal("ant" in dirty, false);
  assert.equal("derived" in dirty, false);
});

test("loadHintsShard fetches hints/<bucket>.json once, validates it, and rejects bad buckets", async () => {
  const asked: string[] = [];
  setLexdbFetcher(async (url) => {
    asked.push(url);
    return url === "/lexdb/hints/b.json" ? { bonheur: ["n.m.", "幸福"] } : null;
  });
  const [a, b] = await Promise.all([loadHintsShard("b"), loadHintsShard("b")]);
  assert.deepEqual(a, { bonheur: ["n.m.", "幸福"] });
  assert.equal(a, b);
  assert.equal(await loadHintsShard("../x"), null);
  assert.equal(await loadHintsShard("ab"), null);
  assert.equal(await loadHintsShard("z"), null);
  assert.deepEqual(asked, ["/lexdb/hints/b.json", "/lexdb/hints/z.json"]);
  // a null result is not cached: the next call asks again
  await loadHintsShard("z");
  assert.equal(asked.filter((u) => u.endsWith("/z.json")).length, 2);
});

test("findHint: exact lower-cased NFC match, folded fallback only when unambiguous", () => {
  const shard = { "bonheur": ["n.m.", "幸福"], "été": ["n.m.", "夏天"], "ete": ["", "（缩写）"], "élan": ["n.m.", "冲劲"] } as Record<
    string,
    [string, string]
  >;
  assert.deepEqual(findHint(shard, "Bonheur"), ["n.m.", "幸福"]);
  assert.deepEqual(findHint(shard, "été"), ["n.m.", "夏天"], "NFD input is normalized");
  assert.deepEqual(findHint(shard, "elan"), ["n.m.", "冲劲"], "unique folded match");
  assert.equal(findHint(shard, "etè"), null, "été / ete fold the same: ambiguous");
  assert.equal(findHint(shard, "inconnu"), null);
});

test("resolveHints uses memory first and loads only the buckets still needed", async () => {
  const asked: string[] = [];
  setLexdbFetcher(async (url) => {
    asked.push(url);
    if (url === "/lexdb/meta.json") return META;
    if (url === "/lexdb/hints/h.json") return { heureusement: ["adv.", "幸运地"] };
    if (url === "/lexdb/hints/m.json") return { malheureux: ["adj.", "不幸的"] };
    return null;
  });
  const local = (w: string) => (w === "bonheur" ? (["n.m.", "幸福"] as [string, string]) : null);
  const hints = await resolveHints(["bonheur", "heureusement", "malheureux", "inconnu"], { local });
  assert.deepEqual(Object.fromEntries(hints), {
    bonheur: ["n.m.", "幸福"],
    heureusement: ["adv.", "幸运地"],
    malheureux: ["adj.", "不幸的"],
  });
  assert.deepEqual(asked.sort(), ["/lexdb/hints/h.json", "/lexdb/hints/i.json", "/lexdb/hints/m.json", "/lexdb/meta.json"]);
});

test("resolveHints never fetches shards when memory covers every word, or when meta has no hintsShards", async () => {
  const asked: string[] = [];
  setLexdbFetcher(async (url) => {
    asked.push(url);
    return url === "/lexdb/meta.json" ? { ...META, hintsShards: undefined } : { x: ["", "y"] };
  });
  const all = await resolveHints(["bonheur"], { local: () => ["n.m.", "幸福"] });
  assert.equal(all.size, 1);
  assert.deepEqual(asked, []);

  const none = await resolveHints(["heureusement"], {});
  assert.equal(none.size, 0);
  assert.deepEqual(asked, ["/lexdb/meta.json"]);

  // offline: meta fails, nothing throws
  setLexdbFetcher(async () => {
    throw new TypeError("offline");
  });
  assert.equal(await loadMeta(), null);
  assert.equal((await resolveHints(["heureusement"])).size, 0);
});

test("memoryHint requires exact French accents so mûr/tâche/sûr never steal mur/tache/sur glosses", async () => {
  assert.equal(hintKey("  L’École  du   Soir "), "l'école du soir");

  const mkRef = (id: string, word: string, zh: string, pos: string[]): WordRef => ({
    id,
    word,
    zh,
    ipa: "",
    cefr: 1,
    topic: 0,
    media: 0,
    order: 0,
    pos,
  });
  const words = [
    mkRef("mur", "mur", "墙", ["n.m."]),
    mkRef("tache", "tache", "斑点；污渍", ["n.f."]),
    mkRef("sur-prep", "sur", "在…上面", ["prép."]),
    mkRef("sur-adj", "sûr", "肯定的；可靠的", ["adj."]),
  ];
  const atlas: Atlas = {
    id: "test",
    name: "test",
    kind: "open",
    count: words.length,
    examples: 0,
    illustrated: 0,
    topics: [],
    cefr: [],
    words,
    byId: new Map(words.map((w) => [w.id, w])),
    entry: () => Promise.reject(new Error("unused")),
    peek: () => undefined,
    img: () => null,
    audio: () => null,
  };

  // Exact match hits the right accented entry even when unaccented 'sur' appears earlier in atlas.words
  assert.deepEqual(memoryHint(atlas, "sûr"), ["adj.", "肯定的；可靠的"]);
  assert.deepEqual(memoryHint(atlas, "sur"), ["prép.", "在…上面"]);

  // Accented words absent from Atlas return null so hints/<bucket>.json can supply the true gloss
  assert.equal(memoryHint(atlas, "mûr"), null);
  assert.equal(memoryHint(atlas, "tâche"), null);

  setLexdbFetcher(async (url) => {
    if (url === "/lexdb/meta.json") return META;
    if (url === "/lexdb/hints/m.json") return { "mûr": ["adj.", "成熟的"], mur: ["n.m.", "墙"] };
    if (url === "/lexdb/hints/t.json") return { "tâche": ["n.f.", "任务"], tache: ["n.f.", "斑点"] };
    return null;
  });
  const resolved = await resolveHints(["mûr", "tâche", "sûr"], { local: (w) => memoryHint(atlas, w) });
  assert.deepEqual(resolved.get("mûr"), ["adj.", "成熟的"]);
  assert.deepEqual(resolved.get("tâche"), ["n.f.", "任务"]);
  assert.deepEqual(resolved.get("sûr"), ["adj.", "肯定的；可靠的"]);
});
