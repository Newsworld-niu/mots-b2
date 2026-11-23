import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  compactProgressForLocalStorage,
  emptyProgress,
  exportBackup,
  flush,
  handleStorageEvent,
  importBackup,
  importBackupAsync,
  needsBackupReminder,
  resetProgress,
  sanitizeProgress,
  sanitizeSession,
  sanitizeSettings,
  shallowEqual,
  store,
} from "./store";
import { DRAFT_PREFIX, getHeavy, putHeavy, resetVaultConnection } from "./vault";

function makeMemoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => {
      map.clear();
    },
  };
}

function makeFakeMultiDbIndexedDb() {
  const dbs = new Map<string, Map<string, Map<string, unknown>>>();
  let failVaultWrites = false;
  let failVaultOpens = 0;

  const getStoreMap = (dbName: string, storeName: string) => {
    let dbMap = dbs.get(dbName);
    if (!dbMap) {
      dbMap = new Map();
      dbs.set(dbName, dbMap);
    }
    let sMap = dbMap.get(storeName);
    if (!sMap) {
      sMap = new Map();
      dbMap.set(storeName, sMap);
    }
    return sMap;
  };

  const makeReq = <T,>(run: () => T) => {
    const req: any = { result: undefined, error: null, onsuccess: null, onerror: null };
    queueMicrotask(() => {
      try {
        req.result = run();
        req.onsuccess?.();
      } catch (err) {
        req.error = err;
        req.onerror?.();
      }
    });
    return req;
  };

  const factory: any = {
    open(dbName: string) {
      const req: any = { result: undefined, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
      queueMicrotask(() => {
        if (dbName === "fb2-vault" && failVaultOpens > 0) {
          failVaultOpens--;
          req.error = new Error("open failed");
          req.onerror?.();
          return;
        }
        let dbMap = dbs.get(dbName);
        if (!dbMap) {
          dbMap = new Map();
          dbs.set(dbName, dbMap);
        }
        const db: any = {
          objectStoreNames: { contains: (n: string) => dbMap!.has(n) },
          createObjectStore: (n: string) => getStoreMap(dbName, n),
          close: () => {},
          onclose: null,
          onversionchange: null,
          transaction(storeNames: string | string[]) {
            const names = Array.isArray(storeNames) ? storeNames : [storeNames];
            const tx: any = { oncomplete: null, onerror: null, onabort: null };
            let pending = 0;
            let failed = false;
            const finishOne = (err?: boolean) => {
              if (err) failed = true;
              pending--;
              if (pending === 0) {
                if (failed || (dbName === "fb2-vault" && failVaultWrites)) tx.onerror?.();
                else tx.oncomplete?.();
              }
            };
            const wrap = <T,>(fn: () => T) => {
              pending++;
              const r = makeReq(fn);
              const origOk = r.onsuccess;
              const origErr = r.onerror;
              queueMicrotask(() => {
                void origOk;
                void origErr;
              });
              const r2: any = { result: undefined, error: null, onsuccess: null, onerror: null };
              queueMicrotask(() => {
                try {
                  if (dbName === "fb2-vault" && failVaultWrites) throw new Error("vault write failed");
                  r2.result = fn();
                  r2.onsuccess?.();
                  finishOne(false);
                } catch (e) {
                  r2.error = e;
                  r2.onerror?.();
                  finishOne(true);
                }
              });
              return r2;
            };
            tx.objectStore = (name: string) => {
              if (!names.includes(name)) throw new Error(`store ${name} not in tx`);
              const map = getStoreMap(dbName, name);
              return {
                get: (k: string) => wrap(() => map.get(k)),
                getAll: () => wrap(() => [...map.values()]),
                getAllKeys: () => wrap(() => [...map.keys()]),
                put: (val: unknown, key?: string) =>
                  wrap(() => {
                    const k = key ?? (val as { id: string }).id;
                    map.set(k, structuredClone(val));
                    return k;
                  }),
                delete: (k: string) => wrap(() => map.delete(k)),
                clear: () => wrap(() => map.clear()),
              };
            };
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
    getStoreMap,
    setFailVaultWrites: (v: boolean) => {
      failVaultWrites = v;
    },
    setFailVaultOpens: (n: number) => {
      failVaultOpens = n;
    },
  };
}

const origLocalStorage = (globalThis as Record<string, unknown>).localStorage;
const origWindow = (globalThis as Record<string, unknown>).window;
const origIndexedDb = (globalThis as Record<string, unknown>).indexedDB;

afterEach(() => {
  resetVaultConnection();
  (globalThis as Record<string, unknown>).localStorage = origLocalStorage;
  (globalThis as Record<string, unknown>).window = origWindow;
  (globalThis as Record<string, unknown>).indexedDB = origIndexedDb;
});

const card = { due: 1, s: 2, d: 5, el: 0, sd: 1, ls: 0, reps: 1, lapses: 0, st: 2, seen: 1 };

test("keeps valid progress and drops malformed records", () => {
  const p = sanitizeProgress(
    {
      version: 2,
      cards: { ok: card, bad: { ...card, d: 99 }, worse: "x" },
      bookmarks: ["ok", 3],
      days: { "2026-10-25": { n: 1, r: 2, c: 1, t: 30 }, nope: { n: 1, r: 1, c: 1, t: 1 } },
      typing: [{ at: 1, mode: "word", items: 10, wpm: 40, accuracy: 98 }, { at: 1, mode: "hack", items: 1, wpm: 1, accuracy: 1 }],
    },
    "word-atlas-open",
  );
  assert.deepEqual(Object.keys(p.cards), ["ok"]);
  assert.deepEqual(p.bookmarks, ["ok"]);
  assert.deepEqual(Object.keys(p.days), ["2026-10-25"]);
  assert.equal(p.typing.length, 1);
});

test("rejects other versions and unknown settings", () => {
  assert.deepEqual(sanitizeProgress({ version: 1, cards: { ok: card } }, "x").cards, {});
  const s = sanitizeSettings({ accent: "fr", dailyNew: 1e9, theme: "dark", retention: 0.5 });
  assert.equal(s.accent, "uk");
  assert.equal(s.dailyNew, 10);
  assert.equal(s.theme, "dark");
  assert.equal(s.retention, 0.9);
  assert.equal(s.examDate, null);
  assert.equal(s.targetScore, 75);
});

test("SYS-2: examDate, targetScore and placement survive sanitization cleanly", () => {
  const s = sanitizeSettings({ examDate: "2027-03-15", targetScore: 82 });
  assert.equal(s.examDate, "2027-03-15");
  assert.equal(s.targetScore, 82);
  assert.equal(sanitizeSettings({ examDate: "2027-02-30", targetScore: 120 }).examDate, null);
  assert.equal(sanitizeSettings({ targetScore: 30 }).targetScore, 75);

  const p = sanitizeProgress(
    {
      version: 2,
      cards: {},
      placement: { at: 100, level: 2, score: 66, sections: { vocab: 75, grammar: 60, read: 65, listen: null }, weak: ["grammar", "read"] },
    },
    "word-atlas-open",
  );
  assert.equal(p.placement?.level, 2);
  assert.equal(p.placement?.sections.listen, null);
});

test("SYS-5: compactProgress strips heavy blobs, backup reminder checks 7-day threshold, and export/import keeps drafts & examBank", () => {
  const full = {
    ...emptyProgress("word-atlas-open"),
    cards: { chat: card as never },
    texts: [{ id: "t1", title: "Test", text: "Bonjour le monde.", created: 100, src: "paste" as const }],
    essays: [{ id: "e1", task: "courrier-voitures", text: "Madame...", created: 100 }],
  };
  const compact = compactProgressForLocalStorage(full);
  assert.equal(compact.texts, undefined);
  assert.equal(compact.essays, undefined);
  assert.ok(compact.cards.chat);

  const now = Date.UTC(2026, 10, 21);
  assert.equal(needsBackupReminder(emptyProgress("x"), null, now).remind, false);
  const oldProgress = { ...full, days: { "2026-11-10": { n: 1, r: 2, c: 2, t: 30 } } };
  assert.equal(needsBackupReminder(oldProgress, null, now).remind, true);
  assert.equal(needsBackupReminder(oldProgress, now - 8 * 86400000, now).remind, true);
  assert.equal(needsBackupReminder(oldProgress, now - 3 * 86400000, now).remind, false);

  assert.equal(sanitizeSettings({ lastBackupAt: 123456 }).lastBackupAt, 123456);

  // Verify exportBackup includes essayDrafts and examBank payload cleanly
  (globalThis as any).window ??= { setTimeout: () => 0, clearTimeout: () => undefined };
  const payload = JSON.parse(
    exportBackup({
      essayDrafts: { "fb2.essay.draft.t1": "Mon brouillon" },
      examBank: { papers: [], attempts: { p1: [{ at: 1, picked: { "0-0": 1 }, score: 1, total: 1 }] } },
    }),
  );
  assert.deepEqual(payload.essayDrafts, { "fb2.essay.draft.t1": "Mon brouillon" });
  assert.ok(payload.examBank?.attempts?.p1);
  const res = importBackup(JSON.stringify(payload));
  assert.equal(res.ok, true);
});

test("SYS-5: cross-tab storage event keeps in-memory heavy texts/essays and never deletes IDB vault", async () => {
  const storage = makeMemoryStorage();
  const idb = makeFakeMultiDbIndexedDb();
  (globalThis as Record<string, unknown>).localStorage = storage;
  (globalThis as Record<string, unknown>).indexedDB = idb.factory;
  (globalThis as Record<string, unknown>).window = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    addEventListener: () => undefined,
  };

  const ds = "tab-sync-ds";
  store.useDataset(ds);
  resetProgress();
  await new Promise((r) => setTimeout(r, 20));

  const t1 = { id: "t-sync1", title: "Article", text: "Texte long en français.", created: 100, src: "paste" as const };
  const e1 = { id: "e-sync1", task: "courrier-voitures", text: "Madame, Monsieur...", created: 100 };
  store.progress((p) => ({ ...p, texts: [t1], essays: [e1] }));
  flush();
  await new Promise((r) => setTimeout(r, 20));

  // Verify heavy data is in IDB
  const before = await getHeavy(ds);
  assert.equal(before?.texts?.length, 1);
  assert.equal(before?.essays?.length, 1);

  // Another tab writes a compact progress payload (without texts/essays) to localStorage
  const otherTab = compactProgressForLocalStorage({
    ...emptyProgress(ds),
    cards: { bonjour: card as never },
    texts: [t1],
    essays: [e1],
  });
  assert.equal(otherTab.texts, undefined);
  assert.equal(otherTab.essays, undefined);

  handleStorageEvent({ key: `word-atlas:v2:${ds}`, newValue: JSON.stringify(otherTab) });
  await new Promise((r) => setTimeout(r, 20));

  // Tab A must adopt bonjour AND preserve texts/essays in memory and IDB
  const cur = store.get().progress;
  assert.ok(cur.cards.bonjour);
  assert.deepEqual(cur.texts?.map((x) => x.id), ["t-sync1"]);
  assert.deepEqual(cur.essays?.map((x) => x.id), ["e-sync1"]);

  // Subsequent edit + flush must NOT wipe IDB vault
  store.progress((p) => ({ ...p, cards: { ...p.cards, merci: card as never } }));
  flush();
  await new Promise((r) => setTimeout(r, 20));
  const after = await getHeavy(ds);
  assert.deepEqual(after?.texts?.map((x) => x.id), ["t-sync1"]);
  assert.deepEqual(after?.essays?.map((x) => x.id), ["e-sync1"]);
});

test("SYS-5: IDB write failure surfaces saveError and clears when a later write succeeds", async () => {
  const storage = makeMemoryStorage();
  const idb = makeFakeMultiDbIndexedDb();
  (globalThis as Record<string, unknown>).localStorage = storage;
  (globalThis as Record<string, unknown>).indexedDB = idb.factory;
  (globalThis as Record<string, unknown>).window = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    addEventListener: () => undefined,
  };

  const ds = "save-err-ds";
  store.useDataset(ds);
  resetProgress();
  await new Promise((r) => setTimeout(r, 20));

  idb.setFailVaultWrites(true);
  store.progress((p) => ({
    ...p,
    essays: [{ id: "e-err", task: "courrier-voitures", text: "Mon essai...", created: 100 }],
  }));
  flush();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(store.get().saveError, true);

  // Recover on subsequent write
  idb.setFailVaultWrites(false);
  store.progress((p) => ({ ...p, cards: { salut: card as never } }));
  flush();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(store.get().saveError, false);
});

test("SYS-5: importBackupAsync clears stale examBank and essayDrafts when omitted and awaits IDB writes", async () => {
  const storage = makeMemoryStorage();
  const idb = makeFakeMultiDbIndexedDb();
  (globalThis as Record<string, unknown>).localStorage = storage;
  (globalThis as Record<string, unknown>).indexedDB = idb.factory;
  (globalThis as Record<string, unknown>).window = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    addEventListener: () => undefined,
  };

  const ds = "import-clean-ds";
  store.useDataset(ds);
  resetProgress();
  await new Promise((r) => setTimeout(r, 20));

  // Seed stale essay draft, stale examBank records, and stale heavy vault data
  storage.setItem(`${DRAFT_PREFIX}old-task`, "Brouillon obsolète");
  idb.getStoreMap("fb2-exam-bank", "papers").set("old-p", {
    id: "old-p",
    kind: "read",
    level: "B2",
    created: 1,
    src: "ai",
    exs: [{ form: "long", topic: "work", docs: [{ text: "Doc" }], questions: [{ q: "Q", options: ["A", "B", "C"], answer: 0 }] }],
  });
  idb.getStoreMap("fb2-exam-bank", "attempts").set("old-p", [{ at: 1, picked: { "0-0": 0 }, score: 1, total: 1 }]);
  await putHeavy(ds, { essays: [{ id: "stale-e", task: "courrier-voitures", text: "stale", created: 1 }] });

  // Import minimal backup WITHOUT examBank and WITHOUT essayDrafts (and with new heavy essay)
  const backup = {
    app: "word-atlas",
    version: 2,
    exported: new Date().toISOString(),
    progress: {
      ...emptyProgress(ds),
      cards: { maison: card },
      essays: [{ id: "new-e", task: "courrier-voitures", text: "Nouvel essai", created: 200 }],
    },
    settings: sanitizeSettings({ onboarded: true }),
  };

  const res = await importBackupAsync(JSON.stringify(backup));
  assert.equal(res.ok, true);

  // Immediately after await importBackupAsync (no extra sleep), stale drafts, examBank, and old heavy data must already be updated
  assert.equal(storage.getItem(`${DRAFT_PREFIX}old-task`), null);
  assert.equal(idb.getStoreMap("fb2-exam-bank", "papers").size, 0);
  assert.equal(idb.getStoreMap("fb2-exam-bank", "attempts").size, 0);
  const heavy = await getHeavy(ds);
  assert.deepEqual(heavy?.essays?.map((x) => x.id), ["new-e"]);
});

test("sanitizeSession validates steps, grades, pending, and index strictly", () => {
  assert.equal(sanitizeSession(null), null);
  assert.equal(sanitizeSession({ id: "s1", started: 100, steps: [{ id: "bonjour", kind: "bogus" }], index: 0, graded: {} }), null);
  assert.equal(sanitizeSession({ id: "s1", started: 100, steps: [{ id: "bonjour", kind: "meaning" }], index: -1, graded: {} }), null);
  assert.equal(sanitizeSession({ id: "s1", started: 100, steps: [{ id: "bonjour", kind: "meaning" }], index: 0.5, graded: {} }), null);

  const sanitized = sanitizeSession({
    id: "s-valid",
    started: 1234,
    steps: [
      { id: "bonjour", kind: "intro", sense: 0 },
      { id: "bad word", kind: "meaning" },
      { id: "merci", kind: "pairing", ids: ["only-one"] },
      { id: "salut", kind: "pairing", ids: ["salut", "merci", "bonjour"] },
      { id: "bonjour", kind: "collocation", options: ["bonjour", "salut"] },
    ],
    index: 99,
    graded: { bonjour: 3, merci: 99, "bad word": 2 },
    newIds: ["bonjour", "bad word"],
    reviewIds: ["merci"],
    pending: { correct: true, value: "bonjour", grade: 3, accentOnly: true, articleWrong: "nope" },
    finished: 5000,
  });
  assert.ok(sanitized);
  assert.equal(sanitized.steps.length, 3);
  assert.equal(sanitized.index, 3);
  assert.deepEqual(sanitized.graded, { bonjour: 3 });
  assert.deepEqual(sanitized.newIds, ["bonjour"]);
  assert.deepEqual(sanitized.pending, { correct: true, value: "bonjour", grade: 3, accentOnly: true });
  assert.equal(sanitized.finished, 5000);

  // Corrupt pending is stripped without crashing the whole session
  const withBadPending = sanitizeSession({
    id: "s-p",
    started: 10,
    steps: [{ id: "bonjour", kind: "listen" }],
    index: 0,
    graded: {},
    pending: { correct: "yes", value: 123 },
  });
  assert.ok(withBadPending);
  assert.equal(withBadPending.pending, undefined);
});

test("shallowEqual compares objects and arrays accurately", () => {
  const obj = { a: 1 };
  assert.equal(shallowEqual({ a: obj, b: 2 }, { a: obj, b: 2 }), true);
  assert.equal(shallowEqual({ a: obj, b: 2 }, { a: obj, b: 3 }), false);
  assert.equal(shallowEqual({ a: 1 }, { a: 1, b: undefined }), false);
  assert.equal(shallowEqual([1, "x"], [1, "x"]), true);
  assert.equal(shallowEqual([1, "x"], [1, "y"]), false);
});

test("settings-only updates flush settings without re-serializing full progress", () => {
  const base = makeMemoryStorage();
  let progressWrites = 0;
  let settingsWrites = 0;
  (globalThis as Record<string, unknown>).localStorage = {
    ...base,
    getItem: (k: string) => base.getItem(k),
    setItem: (k: string, v: string) => {
      if (k.startsWith("word-atlas:v2:")) progressWrites++;
      if (k === "word-atlas:settings") settingsWrites++;
      base.setItem(k, v);
    },
    removeItem: (k: string) => base.removeItem(k),
  };
  (globalThis as Record<string, unknown>).window = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    addEventListener: () => undefined,
  };

  store.useDataset("settings-only-ds");
  resetProgress();
  const pBefore = progressWrites;
  const sBefore = settingsWrites;

  store.settings({ dailyNew: 25 });
  flush();
  assert.equal(settingsWrites, sBefore + 1);
  assert.equal(progressWrites, pBefore);
});
