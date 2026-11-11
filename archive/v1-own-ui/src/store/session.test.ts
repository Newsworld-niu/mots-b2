import { test } from "node:test";
import assert from "node:assert/strict";
import { WORD_ORDER, WORD_BY_ID, TOPICS } from "../data/index.ts";
import { buildSession, distractors, gradeFor, todayPlan, sessionStats, nextNew } from "./session.ts";
import { review, Rating, type CardState } from "./srs.ts";
import { emptyProgress, defaultSettings } from "./store.ts";

test("learning path covers every word once, grouped by topic station", () => {
  assert.equal(WORD_ORDER.length, WORD_BY_ID.size);
  const stations = WORD_ORDER.map((w) => TOPICS.findIndex((t) => t.key === w.topic));
  assert.deepEqual(stations, [...stations].sort((a, b) => a - b));
});

test("new-word plan respects the daily limit", () => {
  const p = emptyProgress();
  assert.equal(nextNew(p, 5).length, 5);
  const plan = todayPlan(p, { ...defaultSettings, dailyNew: 3 });
  assert.equal(plan.fresh.length, 3);
  assert.equal(plan.due.length, 0);
});

test("distractors: four distinct options including the answer, no duplicate meanings", () => {
  const ref = WORD_ORDER[0];
  const opts = distractors(ref, 7);
  assert.equal(opts.length, 4);
  assert.ok(opts.includes(ref.id));
  const zh = opts.map((id) => WORD_BY_ID.get(id)!.senses[0].zh);
  assert.equal(new Set(zh).size, 4);
});

test("session: reviews come first, new words are introduced in groups of five before quizzes", () => {
  const p = emptyProgress();
  const s = buildSession(p, { ...defaultSettings, dailyNew: 6 });
  assert.equal(s.newIds.length, 6);
  const introIdx = s.steps.map((x, i) => (x.kind === "intro" ? i : -1)).filter((i) => i >= 0);
  assert.equal(introIdx.length, 6);
  // first five intros are contiguous, before any quiz of the group
  assert.equal(introIdx[4] - introIdx[0], 4);
  for (const st of s.steps) {
    if (st.kind !== "intro" && !("retry" in st)) assert.ok(st.options === undefined || st.options.length === 4 || st.kind === "spell");
  }
});

test("grading: wrong is Again, hinted is Hard, fast spelling is Easy", () => {
  assert.equal(gradeFor("meaning", false, 100, false), Rating.Again);
  assert.equal(gradeFor("spell", true, 100, true), Rating.Hard);
  assert.equal(gradeFor("spell", true, 3000, false), Rating.Easy);
  assert.equal(gradeFor("cloze", true, 1000, false), Rating.Good);
});

test("FSRS: consecutive Good reviews push the next due date further out each time", () => {
  const start = Date.UTC(2025, 0, 1);
  let c: CardState | undefined;
  let now = start;
  const intervals: number[] = [];
  for (let i = 0; i < 6; i++) {
    c = review(c, Rating.Good, now, 0.9);
    intervals.push(c.due - now);
    now = c.due; // review exactly when due
  }
  for (let i = 1; i < intervals.length; i++) assert.ok(intervals[i] > intervals[i - 1], `interval ${i} should grow`);
  const lapse = review(c, Rating.Again, now, 0.9);
  assert.ok(lapse.due - now < intervals[intervals.length - 1], "an Again rating should shorten the interval");
});

test("session stats: accuracy counts first-attempt non-Again grades", () => {
  const st = sessionStats({ id: "x", started: 0, steps: [], index: 0, newIds: [], reviewIds: [], graded: { a: Rating.Good, b: Rating.Again } });
  assert.equal(st.accuracy, 50);
  assert.equal(st.total, 2);
});
