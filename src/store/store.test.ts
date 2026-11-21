import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeProgress, sanitizeSettings } from "./store";

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
