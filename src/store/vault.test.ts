import assert from "node:assert/strict";
import { test } from "node:test";
import { collectEssayDrafts, DRAFT_PREFIX, mergeHeavy, restoreEssayDrafts } from "./vault.ts";

test("SYS-5: essay drafts are collected and restored safely", () => {
  const mem = new Map<string, string>([
    [`${DRAFT_PREFIX}courrier-voitures`, "Madame, Monsieur, ..."],
    ["other-key", "ignored"],
    [`${DRAFT_PREFIX}empty`, "   "],
  ]);
  const storage = {
    get length() {
      return mem.size;
    },
    key: (i: number) => [...mem.keys()][i] ?? null,
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };

  const collected = collectEssayDrafts(storage);
  assert.deepEqual(collected, { [`${DRAFT_PREFIX}courrier-voitures`]: "Madame, Monsieur, ..." });

  mem.set(`${DRAFT_PREFIX}stale`, "old draft");
  restoreEssayDrafts(
    {
      [`${DRAFT_PREFIX}new-task`]: "Nouveau texte",
      "evil-key": "should-not-write",
    },
    storage,
  );
  assert.equal(mem.has(`${DRAFT_PREFIX}stale`), false);
  assert.equal(mem.get(`${DRAFT_PREFIX}new-task`), "Nouveau texte");
  assert.equal(mem.get("other-key"), "ignored");
  assert.equal(mem.has("evil-key"), false);
});

test("SYS-5: mergeHeavy merges memory and IndexedDB items without duplicates or loss", () => {
  const merged = mergeHeavy(
    [{ id: "t2", v: "mem" }, { id: "t1", v: "mem-new" }],
    [{ id: "t1", v: "idb-old" }, { id: "t0", v: "idb" }],
    10,
  );
  assert.deepEqual(
    merged?.map((x) => `${x.id}:${x.v}`).sort(),
    ["t0:idb", "t1:mem-new", "t2:mem"],
  );
});
