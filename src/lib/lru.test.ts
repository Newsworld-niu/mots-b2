import assert from "node:assert/strict";
import { test } from "node:test";
import { LruCache } from "./lru.ts";

test("LruCache evicts least recently used items and promotes on get", () => {
  const evicted: Array<[string, number]> = [];
  const cache = new LruCache<string, number>(3, (k, v) => evicted.push([k, v]));

  cache.set("a", 1).set("b", 2).set("c", 3);
  assert.equal(cache.size, 3);
  assert.deepEqual([...cache.keys()], ["a", "b", "c"]);

  // peek must not change LRU order
  assert.equal(cache.peek("a"), 1);
  assert.deepEqual([...cache.keys()], ["a", "b", "c"]);

  // get promotes "a" to MRU
  assert.equal(cache.get("a"), 1);
  assert.deepEqual([...cache.keys()], ["b", "c", "a"]);

  // updating existing key promotes without evicting
  cache.set("b", 20);
  assert.equal(cache.size, 3);
  assert.equal(evicted.length, 0);
  assert.deepEqual([...cache.keys()], ["c", "a", "b"]);

  // inserting 4th key evicts "c" (now oldest)
  cache.set("d", 4);
  assert.equal(cache.size, 3);
  assert.equal(cache.has("c"), false);
  assert.deepEqual(evicted, [["c", 3]]);
  assert.deepEqual([...cache.entries()], [["a", 1], ["b", 20], ["d", 4]]);

  assert.equal(cache.delete("a"), true);
  assert.equal(cache.size, 2);
  cache.clear();
  assert.equal(cache.size, 0);
});

test("LruCache handles zero capacity safely", () => {
  const cache = new LruCache<string, string>(0);
  cache.set("k", "v");
  assert.equal(cache.size, 0);
  assert.equal(cache.get("k"), undefined);
});
