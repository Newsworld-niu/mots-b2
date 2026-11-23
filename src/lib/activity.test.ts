import assert from "node:assert/strict";
import { test } from "node:test";
import { dayKey, emptyProgress } from "../store/store.ts";
import { dailyActivityMap, unifiedMinutes, unifiedStreakOf, unifiedWeek } from "./activity.ts";

test("dailyActivityMap, unifiedStreakOf, unifiedMinutes, and unifiedWeek aggregate non-vocab modules", () => {
  const now = new Date(2026, 10, 22, 12, 0, 0);
  const today = dayKey(now);
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = dayKey(yesterdayDate);
  const twoDaysAgoDate = new Date(now);
  twoDaysAgoDate.setDate(twoDaysAgoDate.getDate() - 2);
  const twoDaysAgo = dayKey(twoDaysAgoDate);

  const p = emptyProgress("word-atlas-open");
  // Zero vocabulary reviews today, only grammar/drill/exam/essay across 3 consecutive days
  p.gramDays = { [today]: { n: 2, r: 8, c: 7 } };
  p.conjDays = { [yesterday]: { n: 1, r: 6, c: 5 } };
  p.drillDays = { [yesterday]: 2 };
  p.examLog = [{ part: "read", what: "mock-r1", score: 20, total: 25, level: "B2", scope: "full", at: twoDaysAgoDate.getTime() }];
  p.essays = [{ id: "e1", task: "courrier-voitures", text: "Mon texte", created: today.length ? now.getTime() : 0 }];

  const map = dailyActivityMap(p);
  assert.equal(map[today].r, 9);
  assert.equal(map[yesterday].r, 8);
  assert.equal(map[twoDaysAgo].r, 1);

  assert.equal(unifiedStreakOf(p, now), 3);
  assert.ok(unifiedMinutes(p) >= 20);

  const week = unifiedWeek(p, now);
  assert.equal(week.length, 7);
  assert.equal(week[6].k, today);
  assert.equal(week[6].today, true);
  assert.equal(week[6].v, 9);
  assert.equal(week[5].v, 8);
  assert.equal(week[4].v, 1);
});

test("loungeDays counts toward dailyActivityMap, unifiedStreakOf, unifiedMinutes, and unifiedWeek without touching examLog or cards", () => {
  const now = new Date(2026, 10, 23, 18, 0, 0);
  const today = dayKey(now);
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = dayKey(yesterdayDate);

  const p = emptyProgress("word-atlas-open");
  p.loungeDays = { [yesterday]: 1, [today]: 2 };

  const map = dailyActivityMap(p);
  assert.deepEqual(map[yesterday], { r: 1, ms: 300_000 });
  assert.deepEqual(map[today], { r: 2, ms: 600_000 });
  assert.equal(unifiedStreakOf(p, now), 2);
  assert.equal(unifiedMinutes(p), 15);
  assert.equal(p.examLog, undefined);
  assert.deepEqual(p.cards, {});

  const week = unifiedWeek(p, now);
  assert.equal(week[6].v, 2);
  assert.equal(week[5].v, 1);
});
