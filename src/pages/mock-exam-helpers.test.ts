import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { PRESET_PAPERS } from "../lib/exam-presets";
import {
  collectCompMisses,
  emptyRubric,
  getMockPaperPair,
  isMockPoTyped,
  mockPaperOptions,
  resolveMockPoTyped,
  rubricComplete,
  rubricSum,
  scoreComp,
  shouldShowDebateTurn1Recovery,
} from "./mock-exam-helpers";

test("M1: scoreComp scores legacy stored Vrai/Faux citations and short answers via ceTyped (including negation polarity)", () => {
  const syntheticEx = [
    {
      form: "long" as const,
      topic: "societe",
      intro: "",
      title: "Test",
      docs: [{ text: "La mairie a réduit le tarif mensuel de près de quarante minutes de stationnement gratuit.", zh: "" }],
      questions: [
        {
          doc: 0,
          q: "La mairie a modifié le stationnement.",
          qType: "vf" as const,
          options: ["Vrai", "Faux"],
          answer: 0,
          quote: "La mairie a réduit le tarif mensuel",
          why: "",
          pts: 1.5,
        },
        {
          doc: 0,
          q: "Combien de minutes ?",
          qType: "short" as const,
          options: [],
          answer: 0,
          accepted: ["près de quarante minutes"],
          why: "",
          pts: 1,
        },
      ],
    },
  ];

  const picked = { "0-0": 0 };
  const ceTyped = {
    "0-0": "La mairie a réduit le tarif mensuel",
    "0-1": "près de quarante minutes",
  };

  assert.equal(scoreComp(syntheticEx, picked), 0);
  assert.equal(scoreComp(syntheticEx, picked, ceTyped), 2.5);
  // Negated short answer does not false-positive pass
  assert.equal(scoreComp(syntheticEx, picked, { ...ceTyped, "0-1": "ne pas près de quarante minutes" }), 1.5);
});

test("M1: mockPaperOptions exposes 5 paired post-2020 100% QCM full-mock suites across all 5 listen and 5 read presets", () => {
  const listenPapers = PRESET_PAPERS.filter((p) => p.kind === "listen");
  const readPapers = PRESET_PAPERS.filter((p) => p.kind === "read");
  assert.equal(listenPapers.length, 5);
  assert.equal(readPapers.length, 5);

  const options = mockPaperOptions(listenPapers, readPapers);
  assert.equal(options.length, 5);
  assert.deepEqual(
    options.map((o) => o.readPaper.id),
    readPapers.map((p) => p.id),
  );
  assert.ok(options.every((o) => !o.hasParallelRead), "all 5 DELF B2 mock reading papers are post-2020 100% QCM");

  const pair4 = getMockPaperPair(listenPapers, readPapers, 4);
  assert.equal(pair4.readPaper.id, "preset-read-5");
  assert.equal(pair4.listenPaper.id, "preset-listen-5");
});

test("M1: resolveMockPoTyped is non-sticky and only true when final monologue comes from typing", () => {
  const voiceTranscript = Array.from({ length: 120 }, (_, i) => `mot${i}`).join(" ");

  // Untouched voice transcription -> false
  assert.equal(resolveMockPoTyped({ finalSaid: voiceTranscript, voiceSaid: voiceTranscript }), false);

  // Minor ASR typo edits on voice transcription -> still false (not sticky!)
  const minorEdit = voiceTranscript.replace("mot10", "mots10").replace("mot20", "motVingt");
  assert.equal(resolveMockPoTyped({ finalSaid: minorEdit, voiceSaid: voiceTranscript }), false);

  // Replaced with typed text after clearing voice -> true
  const typedText = Array.from({ length: 120 }, (_, i) => `autre${i}`).join(" ");
  assert.equal(resolveMockPoTyped({ finalSaid: typedText, voiceSaid: voiceTranscript }), true);

  // User cleared typed replacement and re-dictated voice -> non-sticky back to false
  const newVoice = Array.from({ length: 100 }, (_, i) => `vocal${i}`).join(" ");
  assert.equal(resolveMockPoTyped({ finalSaid: newVoice, voiceSaid: newVoice }), false);

  // No voice transcript at all, typed monologue -> true
  assert.equal(resolveMockPoTyped({ finalSaid: typedText, voiceSaid: "" }), true);
  assert.equal(resolveMockPoTyped({ finalSaid: "", voiceSaid: "" }), true);
});

test("M1: debate Turn 1 failure shows retry + skip-to-grade recovery and MockExam.tsx wires all M1 fixes", () => {
  assert.equal(shouldShowDebateTurn1Recovery(0, false), true);
  assert.equal(shouldShowDebateTurn1Recovery(0, true), false);
  assert.equal(shouldShowDebateTurn1Recovery(1, false), false);

  const src = [
    "src/pages/MockExam.tsx",
    "src/pages/mock/MockSetup.tsx",
    "src/pages/mock/MockWritten.tsx",
    "src/pages/mock/MockSpeaking.tsx",
    "src/pages/mock/MockSummary.tsx",
  ]
    .map((p) => fs.readFileSync(path.resolve(p), "utf8"))
    .join("\n");
  assert.ok(src.includes("scoreComp(rp.exs, m.cePicked, m.ceTyped ?? {})"));
  assert.ok(!src.includes("scoreComp(rp.exs, m.cePicked);"));
  assert.ok(!src.includes("[0, 1].map"));
  assert.ok(src.includes("paperOptions.map("));
  assert.ok(src.includes("resolveMockPoTyped("));
  assert.ok(src.includes("重试提问"));
  assert.ok(src.includes("跳过辩论，直接批改独白"));
  assert.ok(src.includes("saveSpeakingCorrections("));
  assert.ok(src.includes("addMisses(collectCompMisses("));
});

test("Phase1: emptyRubric defaults to unselected null and blocks completion until all criteria rated", () => {
  const keys = ["a", "b", "c"];
  const m = emptyRubric(keys);
  assert.deepEqual(m, { a: null, b: null, c: null });
  assert.equal(rubricComplete(m, keys), false);
  assert.equal(rubricSum(m, keys), 0);

  const filled: Record<string, number | null> = { ...m, a: 3, b: 3 };
  assert.equal(rubricComplete(filled, keys), false);
  filled.c = 5;
  assert.equal(rubricComplete(filled, keys), true);
  assert.equal(rubricSum(filled, keys), 11);
});

test("Phase1: collectCompMisses extracts wrong answers for CO/CE misses feedback", () => {
  const l1 = PRESET_PAPERS.find((p) => p.id === "preset-listen-1");
  assert.ok(l1);
  const firstQ = l1.exs[0].questions[0];
  const wrongPick = (firstQ.answer + 1) % firstQ.options.length;
  const misses = collectCompMisses(l1.exs, "listen", { "0-0": wrongPick }, {}, 12345);
  assert.ok(misses.length >= 1);
  assert.equal(misses[0].part, "listen");
  assert.equal(misses[0].q, "0-0");
  assert.equal(misses[0].at, 12345);
  assert.equal(misses[0].stem, firstQ.q);
  assert.equal(misses[0].answer, firstQ.answer);
  assert.ok((misses[0].options?.length ?? 0) >= 2);
});

test("Phase1: isMockPoTyped preserves offline oral self-assessment toward /100 readiness", () => {
  assert.equal(isMockPoTyped({ hasAiFb: false, finalSaid: "", voiceSaid: "" }), false);
  assert.equal(isMockPoTyped({ hasAiFb: true, finalSaid: "bonjour", voiceSaid: "" }), true);
  // Debate turns typed without voice mark session as typed even if monologue used voice
  const mono = Array.from({ length: 80 }, (_, i) => `mot${i}`).join(" ");
  assert.equal(
    isMockPoTyped({ hasAiFb: true, finalSaid: mono, voiceSaid: mono, answeredTurns: 2, debateVoice: false }),
    true,
  );
  assert.equal(
    isMockPoTyped({ hasAiFb: true, finalSaid: mono, voiceSaid: mono, answeredTurns: 2, debateVoice: true }),
    false,
  );
});
