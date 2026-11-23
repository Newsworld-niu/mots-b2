import assert from "node:assert/strict";
import { test } from "node:test";
import { examReadiness, sanitizeExamLog, type ExamResult } from "./exam-schema";
import {
  cefrFromScore699,
  scoreTcfProductive20,
  scoreTcfReceptive,
  scoreTefItems699,
  scoreTefSection699,
  tcfNclcFor,
  tefNclcFor,
  trackReadiness,
} from "./exam-tracks";

test("TCF 100–699 difficulty-weighted receptive scaling and 0–20 productive scaling match FEI / NCLC bands", () => {
  const zero = scoreTcfReceptive(
    Array.from({ length: 18 }, (_, i) => ({ correct: false, difficulty: (i % 6) + 1 })),
    "struct",
  );
  assert.equal(zero.score699, 100);
  assert.equal(zero.cefr, "A1");

  const full = scoreTcfReceptive(
    Array.from({ length: 18 }, (_, i) => ({ correct: true, difficulty: (i % 6) + 1 })),
    "co",
  );
  assert.equal(full.score699, 699);
  assert.equal(full.cefr, "C2");
  assert.equal(full.nclc, 10);

  // Harder items carry higher weight than easier items at identical raw count
  const easyHalf = scoreTcfReceptive(
    [
      { correct: true, difficulty: 1 },
      { correct: true, difficulty: 2 },
      { correct: false, difficulty: 5 },
      { correct: false, difficulty: 6 },
    ],
    "ce",
  );
  const hardHalf = scoreTcfReceptive(
    [
      { correct: false, difficulty: 1 },
      { correct: false, difficulty: 2 },
      { correct: true, difficulty: 5 },
      { correct: true, difficulty: 6 },
    ],
    "ce",
  );
  assert.ok(hardHalf.score699 > easyHalf.score699);

  // Official TCF Canada NCLC 7 boundaries
  assert.equal(tcfNclcFor("co", 457), 6);
  assert.equal(tcfNclcFor("co", 458), 7);
  assert.equal(tcfNclcFor("ce", 452), 6);
  assert.equal(tcfNclcFor("ce", 453), 7);

  const eo10 = scoreTcfProductive20(10, "eo");
  assert.equal(eo10.cefr, "B2");
  assert.equal(eo10.nclc, 7);
  assert.equal(eo10.b2Passed, true);

  const ee95 = scoreTcfProductive20(9.5, "ee");
  assert.equal(ee95.cefr, "B1");
  assert.equal(ee95.nclc, 6);
  assert.equal(ee95.b2Passed, false);
});

test("TEF post-Dec-2023 0–699 scaling and NCLC 7+ cutoffs work for receptive and productive sections", () => {
  assert.equal(tefNclcFor("co", 433), 6);
  assert.equal(tefNclcFor("co", 434), 7);
  assert.equal(tefNclcFor("ce", 434), 7);
  assert.equal(tefNclcFor("eo", 455), 6);
  assert.equal(tefNclcFor("eo", 456), 7);
  assert.equal(tefNclcFor("ee", 456), 7);

  const tefCe = scoreTefItems699(
    Array.from({ length: 40 }, (_, i) => ({ correct: i < 28, difficulty: Math.min(6, Math.floor(i / 7) + 1) })),
    "ce",
  );
  assert.ok(tefCe.score699 >= 400);
  assert.equal(cefrFromScore699(tefCe.score699, "tef"), tefCe.cefr);

  const tefEo = scoreTefSection699("eo", 14, 20);
  assert.equal(tefEo.score699, 489);
  assert.equal(tefEo.cefr, "B2");
  assert.equal(tefEo.nclc, 7);
  assert.equal(tefEo.nclc7Passed, true);
});

test("trackReadiness isolates TCF and TEF logs from DELF B2 examReadiness", () => {
  const rawLogs: ExamResult[] = [
    { part: "listen", what: "tcf-co-1", score: 22, total: 29, at: 100, track: "tcf", trackSection: "co", scaledScore: 472, nclc: 7 },
    { part: "read", what: "struct-tcf-1", score: 14, total: 18, at: 101, track: "tcf", trackSection: "struct", scaledScore: 485, nclc: 7 },
    { part: "read", what: "tcf-ce-1", score: 21, total: 29, at: 102, track: "tcf", trackSection: "ce", scaledScore: 465, nclc: 7 },
    { part: "essay", what: "tcf-ee-1", score: 11.5, total: 20, at: 103, track: "tcf", trackSection: "ee", nclc: 7 },
    { part: "speak", what: "tcf-eo-1", score: 12, total: 20, at: 104, track: "tcf", trackSection: "eo", nclc: 8 },
  ];
  const clean = sanitizeExamLog(rawLogs);
  assert.ok(clean);
  assert.equal(clean.length, 5);

  // DELF B2 /100 readiness must NOT count TCF logs
  const delf = examReadiness(clean);
  assert.equal(delf.completed, 0);
  assert.equal(delf.exact100, null);

  // TCF readiness sees all 5 sections and confirms B2 + NCLC 7+ pass
  const tcf = trackReadiness(clean, "tcf");
  assert.equal(tcf.completedCount, 5);
  assert.equal(tcf.allB2Met, true);
  assert.equal(tcf.allNclc7Met, true);
  assert.equal(tcf.minNclc, 7);
});
