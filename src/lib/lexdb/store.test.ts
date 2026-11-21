import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { MAX_DICT_HISTORY, exportBackup, importBackup, resetProgress, sanitizeProgress, store } from "../../store/store.ts";
import {
  addDictReport,
  clearDictHistory,
  exportDictReportsJson,
  getDictStore,
  isDictFav,
  recordDictHistory,
  setDictNote,
  toggleDictFav,
} from "./store.ts";

function makeMemoryStorage() {
  const map = new Map<string, string>();
  return {
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

const origLocalStorage = (globalThis as Record<string, unknown>).localStorage;
const origWindow = (globalThis as Record<string, unknown>).window;

beforeEach(() => {
  (globalThis as Record<string, unknown>).localStorage = makeMemoryStorage();
  (globalThis as Record<string, unknown>).window = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    addEventListener: () => undefined,
  };
  store.useDataset("lexdb-store-test");
  resetProgress();
});

afterEach(() => {
  (globalThis as Record<string, unknown>).localStorage = origLocalStorage;
  (globalThis as Record<string, unknown>).window = origWindow;
});

test("recordDictHistory deduplicates, keeps newest first, and caps at MAX_DICT_HISTORY", () => {
  recordDictHistory("accueil");
  recordDictHistory("prendre");
  recordDictHistory("beau");
  recordDictHistory("accueil");
  recordDictHistory("   ");

  assert.deepEqual(getDictStore().history, ["accueil", "beau", "prendre"]);

  for (let i = 0; i < MAX_DICT_HISTORY + 25; i++) {
    recordDictHistory(`mot-${i}`);
  }
  const hist = getDictStore().history;
  assert.equal(hist.length, MAX_DICT_HISTORY);
  assert.equal(hist[0], `mot-${MAX_DICT_HISTORY + 24}`);

  clearDictHistory();
  assert.deepEqual(getDictStore().history, []);
  assert.equal(store.get().progress.dictHistory, undefined);
});

test("toggleDictFav and setDictNote mutate state cleanly and omit empty fields", () => {
  assert.equal(isDictFav("beau"), false);
  assert.equal(toggleDictFav("beau"), true);
  assert.equal(isDictFav("beau"), true);
  assert.equal(toggleDictFav("prendre"), true);
  assert.deepEqual(getDictStore().favs, ["prendre", "beau"]);

  assert.equal(toggleDictFav("beau"), false);
  assert.equal(toggleDictFav("prendre"), false);
  assert.equal(store.get().progress.dictFavs, undefined);

  setDictNote("accueil", "  常用于正式接待场景  ");
  assert.equal(getDictStore().notes.accueil, "常用于正式接待场景");
  setDictNote("accueil", "   ");
  assert.equal(getDictStore().notes.accueil, undefined);
  assert.equal(store.get().progress.dictNotes, undefined);
});

test("addDictReport and exportDictReportsJson store and serialize error reports", () => {
  assert.equal(addDictReport({ entryId: "", detail: "missing" }), null);
  assert.equal(addDictReport({ entryId: "beau", detail: "   " }), null);

  const r1 = addDictReport({
    entryId: "beau",
    w: "beau",
    kind: "gloss",
    detail: "缺少常见搭配义项",
  });
  assert.ok(r1);
  assert.equal(r1.entryId, "beau");
  assert.equal(getDictStore().reports.length, 1);

  const exported = JSON.parse(exportDictReportsJson()) as {
    app: string;
    kind: string;
    count: number;
    reports: Array<{ id: string; entryId: string; detail: string }>;
  };
  assert.equal(exported.app, "word-atlas");
  assert.equal(exported.kind, "lexdb-reports");
  assert.equal(exported.count, 1);
  assert.equal(exported.reports[0].entryId, "beau");
  assert.equal(exported.reports[0].detail, "缺少常见搭配义项");
});

test("sanitizeProgress and backup export/import roundtrip LexDB fields cleanly", () => {
  recordDictHistory("accueil");
  recordDictHistory("prendre");
  toggleDictFav("beau");
  setDictNote("prendre", "固定搭配 prendre le temps");
  const report = addDictReport({ entryId: "accueil", w: "accueil", kind: "example", detail: "例句标点有误" });
  assert.ok(report);

  const backupJson = exportBackup();
  resetProgress();
  assert.deepEqual(getDictStore().history, []);
  assert.deepEqual(getDictStore().favs, []);

  const res = importBackup(backupJson);
  assert.equal(res.ok, true);
  assert.deepEqual(getDictStore().history, ["prendre", "accueil"]);
  assert.deepEqual(getDictStore().favs, ["beau"]);
  assert.equal(getDictStore().notes.prendre, "固定搭配 prendre le temps");
  assert.equal(getDictStore().reports[0].id, report.id);

  // Untrusted input sanitization drops invalid items and keeps valid ones
  const sanitized = sanitizeProgress(
    {
      version: 2,
      cards: {},
      dictHistory: ["accueil", "", 42, "bad\nid", "accueil", ...Array.from({ length: 220 }, (_, i) => `w-${i}`)],
      dictFavs: ["beau", "beau", null],
      dictNotes: { prendre: "  note ok  ", empty: "   ", "bad\u0001key": "x" },
      dictReports: [
        { id: "r1", entryId: "beau", w: "beau", kind: "ipa", detail: "音标确认", at: 1000 },
        { id: "r1", entryId: "beau", detail: "duplicate id", at: 1001 },
        { id: "r2", entryId: "", detail: "missing entry", at: 1002 },
        { id: "r3", entryId: "beau", detail: "bad ts", at: -5 },
      ],
    },
    "lexdb-store-test",
  );
  assert.equal(sanitized.dictHistory?.length, MAX_DICT_HISTORY);
  assert.equal(sanitized.dictHistory?.[0], "accueil");
  assert.deepEqual(sanitized.dictFavs, ["beau"]);
  assert.deepEqual(sanitized.dictNotes, { prendre: "note ok" });
  assert.equal(sanitized.dictReports?.length, 1);
  assert.equal(sanitized.dictReports?.[0].id, "r1");

  // Progress without LexDB fields leaves them undefined
  const plain = sanitizeProgress({ version: 2, cards: {} }, "lexdb-store-test");
  assert.equal(plain.dictHistory, undefined);
  assert.equal(plain.dictFavs, undefined);
  assert.equal(plain.dictNotes, undefined);
  assert.equal(plain.dictReports, undefined);
});
