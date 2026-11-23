import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyProgress } from "../store/store.ts";
import { fourSkillTrends, topicCoverageMatrix, weeklyReportSummary } from "./cockpit.ts";

test("fourSkillTrends filters official B2 scores and computes chronological deltas", () => {
  const now = 1_750_000_000_000;
  const trends = fourSkillTrends([
    { part: "listen", what: "preset-listen-1", score: 18, total: 25, level: "B2", scope: "full", at: now - 1000 },
    { part: "listen", what: "preset-listen-2", score: 15, total: 25, level: "B2", scope: "full", at: now - 5000 },
    { part: "read", what: "rfi", score: 9, total: 9, level: "B2", scope: "real", at: now - 2000 },
    { part: "speak", what: "sub1", score: 17, total: 20, level: "B2", scope: "full", at: now - 1500 },
  ]);

  assert.equal(trends.listen.points.length, 2);
  assert.equal(trends.listen.latest, 18);
  assert.equal(trends.listen.delta, 3);
  assert.equal(trends.read.points.length, 0);
  assert.equal(trends.speak.latest, null);
});

test("topicCoverageMatrix measures coverage across all 15 DELF B2 themes", () => {
  const p = emptyProgress("t");
  p.speakingSessions = [
    { id: "s1", at: 100, subjectId: "sub-1", title: "T1", topic: "environnement", monologueWords: 200, monologueSec: 300, debateTurns: 4, debateSec: 400, total25: 17 },
    { id: "s2", at: 200, subjectId: "sub-2", title: "T2", topic: "environnement", monologueWords: 220, monologueSec: 320, debateTurns: 4, debateSec: 400, total25: 19 },
  ];
  p.essays = [{ id: "e1", task: "courrier-voitures", text: "Texte.", created: 300 }];

  const m = topicCoverageMatrix(p);
  assert.equal(m.items.length, 15);
  assert.equal(m.coveredCount, 1);
  assert.equal(m.touchedCount, 1);
  assert.equal(m.blindCount, 13);
});

test("weeklyReportSummary aggregates 7-day learning volume and highlights gains", () => {
  const now = new Date(2026, 10, 22, 12, 0, 0);
  const ts = now.getTime();
  const p = emptyProgress("t");
  p.days["2026-11-22"] = { n: 5, r: 20, c: 18, t: 300 };
  p.examLog = [
    { part: "read", what: "mock-preset-read-1", score: 14, total: 25, level: "B2", scope: "full", at: ts - 86_400_000 },
    { part: "read", what: "mock-preset-read-2", score: 17, total: 25, level: "B2", scope: "full", at: ts - 3600_000 },
  ];
  const rep = weeklyReportSummary(p, now);
  assert.ok(rep.activeDays >= 1);
  assert.equal(rep.examRuns, 2);
  assert.equal(rep.topImproveLabel, "阅读 (+3)");
});