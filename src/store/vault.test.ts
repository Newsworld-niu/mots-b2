import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  collectEssayDrafts,
  DRAFT_PREFIX,
  getHeavy,
  mergeHeavy,
  openVault,
  putHeavy,
  resetVaultConnection,
  restoreEssayDrafts,
} from "./vault.ts";

function makeFakeIndexedDb(opts?: { failOpens?: number; failWrites?: boolean }) {
  let opensLeftToFail = opts?.failOpens ?? 0;
  let openCalls = 0;
  const stores = new Map<string, Map<string, unknown>>([
    ["heavy", new Map()],
    ["snapshots", new Map()],
  ]);

  const factory: any = {
    open() {
      openCalls++;
      const req: any = { result: undefined, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
      queueMicrotask(() => {
        if (opensLeftToFail > 0) {
          opensLeftToFail--;
          req.error = new Error("IDB open failed");
          req.onerror?.();
          return;
        }
        const db: any = {
          objectStoreNames: { contains: (n: string) => stores.has(n) },
          createObjectStore: (n: string) => {
            if (!stores.has(n)) stores.set(n, new Map());
          },
          close: () => {},
          onclose: null,
          onversionchange: null,
          transaction(name: string) {
            const map = stores.get(name)!;
            const tx: any = { oncomplete: null, onerror: null, onabort: null };
            let pending = 0;
            let failed = false;
            const wrap = <T,>(fn: () => T) => {
              pending++;
              const req: any = { result: undefined, error: null, onsuccess: null, onerror: null };
              queueMicrotask(() => {
                try {
                  if (opts?.failWrites) throw new Error("write error");
                  req.result = fn();
                  req.onsuccess?.();
                } catch (err) {
                  failed = true;
                  req.error = err;
                  req.onerror?.();
                } finally {
                  pending--;
                  if (pending === 0) {
                    if (failed || opts?.failWrites) tx.onerror?.();
                    else tx.oncomplete?.();
                  }
                }
              });
              return req;
            };
            tx.objectStore = () => ({
              get: (key: string) => wrap(() => map.get(key)),
              put: (val: unknown, key: string) => wrap(() => (map.set(key, structuredClone(val)), key)),
              delete: (key: string) => wrap(() => (map.delete(key), undefined)),
            });
            return tx;
          },
        };
        req.result = db;
        req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  };

  return {
    factory,
    stores,
    getOpenCalls: () => openCalls,
  };
}

const origIndexedDb = (globalThis as Record<string, unknown>).indexedDB;

afterEach(() => {
  resetVaultConnection();
  (globalThis as Record<string, unknown>).indexedDB = origIndexedDb;
});

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

test("SYS-5: openVault retries after initial open failure instead of caching null permanently", async () => {
  const idb = makeFakeIndexedDb({ failOpens: 1 });
  (globalThis as Record<string, unknown>).indexedDB = idb.factory;

  const first = await openVault();
  assert.equal(first, null);
  assert.equal(idb.getOpenCalls(), 1);

  const second = await openVault();
  assert.ok(second);
  assert.equal(idb.getOpenCalls(), 2);
});

test("SYS-5: putHeavy never deletes existing records when heavy fields are omitted unless clear is explicit", async () => {
  const idb = makeFakeIndexedDb();
  (globalThis as Record<string, unknown>).indexedDB = idb.factory;

  const t1 = { id: "t-test1", title: "Texte 1", text: "Bonjour tout le monde.", created: 100, src: "paste" as const };
  const t2 = { id: "t-test2", title: "Texte 2", text: "Deuxième texte.", created: 200, src: "paste" as const };
  const e1 = { id: "e-test1", task: "courrier-voitures", text: "Madame, Monsieur...", created: 100 };

  assert.equal(await putHeavy("ds1", { texts: [t1], essays: [e1] }), true);

  // Calling putHeavy with empty/missing heavy fields must NOT wipe existing IDB record
  assert.equal(await putHeavy("ds1", {}), true);
  let stored = await getHeavy("ds1");
  assert.equal(stored?.texts?.length, 1);
  assert.equal(stored?.essays?.length, 1);

  // Calling putHeavy with only texts must preserve existing essays
  assert.equal(await putHeavy("ds1", { texts: [t2] }), true);
  stored = await getHeavy("ds1");
  assert.deepEqual(stored?.texts?.map((x) => x.id), ["t-test2"]);
  assert.deepEqual(stored?.essays?.map((x) => x.id), ["e-test1"]);

  // Explicit clear removes the record
  assert.equal(await putHeavy("ds1", {}, { clear: true }), true);
  stored = await getHeavy("ds1");
  assert.equal(stored, null);
});

test("SYS-5: putHeavy returns false when IndexedDB write fails", async () => {
  const idb = makeFakeIndexedDb({ failWrites: true });
  (globalThis as Record<string, unknown>).indexedDB = idb.factory;

  const ok = await putHeavy("ds1", {
    texts: [{ id: "t-fail1", title: "Texte", text: "Bonjour.", created: 100, src: "paste" }],
  });
  assert.equal(ok, false);
});
