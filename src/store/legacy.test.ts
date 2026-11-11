import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeProgress, sanitizeSettings } from "./store";
import { convertLegacy, migrateLegacy } from "./legacy";

// Shape written by the first French prototype (mots-b2:v1).
const v1 = {
  progress: {
    version: 1,
    cards: {
      entretien: { due: Date.UTC(2030, 0, 1), s: 12, d: 4.2, el: 3, sd: 10, ls: 0, reps: 5, lapses: 1, st: 2, seen: Date.UTC(2029, 0, 1), last: Date.UTC(2029, 11, 1) },
      pollution: { due: Date.UTC(2025, 0, 1), s: 0.4, d: 6, el: 0, sd: 0, ls: 2, reps: 1, lapses: 0, st: 1, seen: Date.UTC(2025, 0, 1) },
    },
    bookmarks: ["entretien"],
    days: { "2025-01-02": { n: 3, r: 5, c: 4, t: 120 } },
    typing: [{ at: 1, mode: "dictee", items: 1, wpm: 40, accuracy: 90 }, { at: 2, mode: "traduction", items: 1, wpm: 30, accuracy: 70 }],
    session: { id: "x", steps: [] },
    mistakes: ["pollution"],
  },
  settings: { dailyNew: 16, retention: 0.93, rate: 1.1, autoplay: false, spell: true, theme: "light" },
};

test("v1 progress converts to the v2 shape and every card survives sanitisation", () => {
  const out = convertLegacy(JSON.stringify(v1), "francais-b2-lexicon");
  assert.ok(out, "conversion must succeed");
  assert.equal(out.cards, 2);
  const clean = sanitizeProgress(out.progress, "francais-b2-lexicon");
  assert.equal(Object.keys(clean.cards).length, 2, "no card may be dropped by the v2 validator");
  assert.equal(clean.cards.entretien.reps, 5);
  assert.equal(clean.cards.entretien.s, 12);
  assert.deepEqual(clean.bookmarks, ["entretien"]);
  assert.deepEqual(clean.mistakes, ["pollution"]);
  assert.equal(clean.days["2025-01-02"].r, 5);
  assert.equal(clean.session, null, "unfinished prototype sessions are dropped");
});

test("typing modes are renamed to the v2 vocabulary", () => {
  const out = convertLegacy(JSON.stringify(v1), "francais-b2-lexicon")!;
  const clean = sanitizeProgress(out.progress, "francais-b2-lexicon");
  assert.deepEqual(clean.typing.map((t) => t.mode), ["dictation", "sentence"]);
});

test("settings carry over where names match; unknown values fall back to defaults", () => {
  const out = convertLegacy(JSON.stringify(v1), "francais-b2-lexicon")!;
  const s = sanitizeSettings(out.settings);
  assert.equal(s.autoplay, false);
  assert.equal(s.retention, 0.93);
  assert.equal(s.theme, "light");
});

test("migration runs once and never overwrites an existing v2 record", () => {
  const mem = new Map<string, string>();
  const storage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
  } as unknown as Storage;
  mem.set("mots-b2:v1", JSON.stringify(v1));
  const key = (id: string) => `word-atlas:v2:${id}`;
  const first = migrateLegacy(storage, "francais-b2-lexicon", "word-atlas:settings", key);
  assert.equal(first.ran, true);
  assert.equal(first.cards, 2);
  const written = JSON.parse(mem.get("word-atlas:v2:francais-b2-lexicon")!);
  assert.equal(Object.keys(written.cards).length, 2);
  // second run is a no-op
  assert.equal(migrateLegacy(storage, "francais-b2-lexicon", "word-atlas:settings", key).ran, false);
});

test("a v2 record that already exists is kept (no overwrite)", () => {
  const mem = new Map<string, string>([
    ["mots-b2:v1", JSON.stringify(v1)],
    ["word-atlas:v2:francais-b2-lexicon", JSON.stringify({ version: 2, datasetId: "francais-b2-lexicon", cards: {} })],
  ]);
  const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) } as unknown as Storage;
  migrateLegacy(storage, "francais-b2-lexicon", "word-atlas:settings", (id) => `word-atlas:v2:${id}`);
  assert.equal(Object.keys(JSON.parse(mem.get("word-atlas:v2:francais-b2-lexicon")!).cards).length, 0);
});

test("corrupt or foreign payloads are ignored", () => {
  assert.equal(convertLegacy("not json", "x"), null);
  assert.equal(convertLegacy(JSON.stringify({ progress: { version: 2 } }), "x"), null);
  assert.equal(convertLegacy(null, "x"), null);
});
