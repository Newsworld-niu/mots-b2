import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultSettings, emptyProgress } from "../store/store.ts";
import { addMonthsDate, buildPrepSchedule, daysUntilExam, reconcileDailyTasks } from "./study-plan.ts";

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

test("Phase3: buildPrepSchedule consumes dailyMinutes, compMisses causes and weak gramTags", () => {
  const now = new Date(2026, 10, 21, 10, 0, 0);
  const p = emptyProgress("t");
  p.compMisses = [
    { at: 1000, part: "listen", cause: "negation", q: "0-1" },
    { at: 2000, part: "listen", cause: "negation", q: "0-2" },
    { at: 3000, part: "listen", cause: "heard", q: "0-3" },
  ];
  p.gramTags = {
    "subjonctif|r2": { n: 5, w: 3 },
    "passif|r1": { n: 4, w: 2 },
  };
  const plan = buildPrepSchedule({
    progress: p,
    settings: { ...defaultSettings, dailyMinutes: 120, targetScore: 75 },
    vocabMinutes: 15,
    dueCount: 5,
    freshCount: 10,
    now,
  });

  assert.equal(plan.totalMinutes, 120);
  assert.equal(plan.weakest, "listen");
  assert.ok(plan.tasks[0].reason.includes("否定"));
  assert.equal(plan.weakGramTagsCount, 2);
  const grammarTask = plan.tasks.find((t) => t.kind === "grammar")!;
  assert.ok(grammarTask.reason.includes("2 个语法点") || grammarTask.reason.includes("2 个高频"));
});

test("Wave7.2: urgent phase (<=30d) activates 75m budget, 15% vocab cap, <=5 dailyNew; reconcileDailyTasks tracks completion", () => {
  const now = new Date(2026, 10, 21, 10, 0, 0);
  const p = emptyProgress("t");
  p.days["2026-11-21"] = { n: 2, r: 15, c: 12, t: 300 };
  p.gramDays = { "2026-11-21": { n: 1, r: 4, c: 3 } };
  p.examLog = [{ part: "listen", what: "mock-l1", score: 17, total: 25, level: "B2", scope: "full", at: now.getTime() - 1000 }];

  const urgent = buildPrepSchedule({
    progress: p,
    settings: { ...defaultSettings, examDate: "2026-12-10", targetScore: 75, dailyMinutes: null },
    vocabMinutes: 20,
    dueCount: 8,
    freshCount: 5,
    now,
  });
  assert.equal(urgent.phase, "urgent");
  assert.equal(urgent.totalMinutes, 75);
  assert.equal(urgent.vocabCapPct, 15);
  assert.ok(urgent.suggestedDailyNew <= 5);
  assert.equal(urgent.vocabOverCap, true);

  const rec = reconcileDailyTasks(urgent.tasks, p, now);
  assert.equal(rec.vocab.done, true);
  assert.equal(rec.grammar.done, true);
  assert.equal(rec.listen.done, true);
  assert.equal(rec.read.done, false);
});

test("analyzePrepSkills isolates B1 essays, real-audio runs, drill runs, and legacy <20pt logs", () => {
  const now = new Date(2026, 10, 22, 10, 0, 0);
  const p = emptyProgress("t");
  p.examLog = [
    { part: "listen", what: "real:r1", score: 25, total: 25, scope: "real", at: 1000 },
    { part: "read", what: "drill", score: 6, total: 6, scope: "drill", at: 1000 },
    { part: "essay", what: "mail-invitation", score: 23, total: 25, level: "B1", scope: "full", at: 1000 },
    { part: "listen", what: "short", score: 6, total: 6, at: 1000 },
  ];
  p.essays = [
    {
      id: "e1",
      task: "mail-invitation",
      text: "x",
      created: 1000,
      fb: { scores: { task: 5, coherence: 5, socio: 5, lexique: 5, morpho: 5 }, comment: "", strengths: [], todo: [], corrections: [], rewrite: "" },
    },
  ];
  const plan = buildPrepSchedule({
    progress: p,
    settings: defaultSettings,
    vocabMinutes: 10,
    dueCount: 4,
    freshCount: 10,
    now,
  });
  assert.equal(plan.skills.listen.score25, null);
  assert.equal(plan.skills.read.score25, null);
  assert.equal(plan.skills.essay.score25, null);
});
