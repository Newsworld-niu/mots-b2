import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultSettings, emptyProgress } from "../store/store.ts";
import { addMonthsDate, buildPrepSchedule, daysUntilExam } from "./study-plan.ts";

test("daysUntilExam computes local calendar days cleanly", () => {
  const now = new Date(2026, 10, 21, 20, 0, 0); // 2026-11-21
  assert.equal(daysUntilExam("2026-11-21", now), 0);
  assert.equal(daysUntilExam("2026-12-21", now), 30);
  assert.equal(daysUntilExam("2026-02-30", now), null);
  assert.equal(daysUntilExam(null, now), null);
  assert.equal(addMonthsDate(3, now), "2027-02-21");
});

test("buildPrepSchedule enforces <=25% vocab cap when exam is <6 months away and flags over-cap", () => {
  const now = new Date(2026, 10, 21, 10, 0, 0);
  const p = emptyProgress("t");
  p.examLog = [
    { part: "listen", what: "environment", score: 8, total: 25, at: 1000 },
    { part: "read", what: "work", score: 18, total: 25, at: 1000 },
    { part: "speak", what: "s-teletravail", score: 17, total: 25, at: 1000 },
  ];
  p.essays = [
    {
      id: "e1",
      task: "t1",
      text: "x",
      created: 1000,
      fb: { scores: { task: 3, coherence: 3, socio: 3, lexique: 3, morpho: 3 }, comment: "", strengths: [], todo: [], corrections: [], rewrite: "" },
    },
  ];
  const s = { ...defaultSettings, examDate: "2027-03-21", targetScore: 75, dailyNew: 40, startLevel: 2 }; // 120 days (<6 mo)
  const plan = buildPrepSchedule({
    progress: p,
    settings: s,
    vocabMinutes: 35,
    dueCount: 12,
    freshCount: 40,
    grammarDueCount: 2,
    now,
  });

  assert.equal(plan.daysLeft, 120);
  assert.equal(plan.phase, "sprint");
  assert.equal(plan.weakest, "listen");
  assert.equal(plan.vocabCapPct, 25);
  assert.equal(plan.vocabOverCap, true);
  assert.ok(plan.vocabSharePct > 25);
  assert.ok(plan.suggestedDailyNew <= 15);
  const vocabTask = plan.tasks.find((t) => t.kind === "vocab")!;
  assert.ok(vocabTask.sharePct <= 25, `planned vocab share must stay <=25%, got ${vocabTask.sharePct}%`);
  assert.equal(plan.tasks[0].kind, "listen");
  assert.ok(plan.tasks.some((t) => t.kind === "grammar"));
});

test("buildPrepSchedule falls back to placement weaknesses when examLog is empty and ignores typed/20-pt speak runs", () => {
  const now = new Date(2026, 10, 21, 10, 0, 0);
  const p = emptyProgress("t");
  p.examLog = [{ part: "speak", what: "s1", score: 16, total: 20, at: 1000 }]; // 20-pt run without phono
  p.placement = { at: 1000, level: 2, score: 62, sections: { vocab: 80, grammar: 65, read: 45, listen: 60 }, weak: ["read", "listen"] };
  const plan = buildPrepSchedule({
    progress: p,
    settings: { ...defaultSettings, examDate: null, targetScore: 75 },
    vocabMinutes: 10,
    dueCount: 4,
    freshCount: 10,
    now,
  });
  assert.equal(plan.daysLeft, null);
  assert.equal(plan.skills.speak.score25, null);
  assert.equal(plan.weakest, "read");
  assert.equal(plan.vocabOverCap, false);
});
