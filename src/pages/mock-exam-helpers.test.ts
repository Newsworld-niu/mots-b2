import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { PRESET_PAPERS } from "../lib/exam-presets";
import { getMockPaperPair, mockPaperOptions, resolveMockPoTyped, scoreComp, shouldShowDebateTurn1Recovery } from "./mock-exam-helpers";

test("M1: scoreComp scores preset-read-3 Vrai/Faux citations and short answers via ceTyped (including timeout)", () => {
  const r3 = PRESET_PAPERS.find((p) => p.id === "preset-read-3");
  assert.ok(r3);

  // Locate a VF question and a short question in preset-read-3
  const ex0 = r3.exs[0];
  const vfIdx = ex0.questions.findIndex((q) => q.qType === "vf");
  const shortIdx = ex0.questions.findIndex((q) => q.qType === "short");
  assert.ok(vfIdx >= 0 && shortIdx >= 0);

  const vfQ = ex0.questions[vfIdx];
  const shortQ = ex0.questions[shortIdx];

  const picked = { [`0-${vfIdx}`]: vfQ.answer };
  const ceTyped = {
    [`0-${vfIdx}`]: vfQ.quote ?? "",
    [`0-${shortIdx}`]: shortQ.accepted?.[0] ?? "",
  };

  // Without ceTyped (the old timeout bug), VF + short score 0
  assert.equal(scoreComp(r3.exs, picked), 0);
  // With ceTyped (fixed timeout + manual finish), both VF citation and short answer award points
  const expected = Math.round((vfQ.pts + shortQ.pts) * 10) / 10;
  assert.equal(scoreComp(r3.exs, picked, ceTyped), expected);
});

test("M1: mockPaperOptions dynamically exposes all readPapers including preset-read-3", () => {
  const listenPapers = PRESET_PAPERS.filter((p) => p.kind === "listen");
  const readPapers = PRESET_PAPERS.filter((p) => p.kind === "read");
  assert.ok(readPapers.length >= 3);

  const options = mockPaperOptions(listenPapers, readPapers);
  assert.equal(options.length, readPapers.length);
  assert.deepEqual(
    options.map((o) => o.readPaper.id),
    readPapers.map((p) => p.id),
  );
  assert.ok(options.some((o) => o.readPaper.id === "preset-read-3" && o.hasParallelRead));

  // Index 2 pairs preset-read-3 with a valid listening paper
  const pair2 = getMockPaperPair(listenPapers, readPapers, 2);
  assert.equal(pair2.readPaper.id, "preset-read-3");
  assert.equal(pair2.listenPaper.id, listenPapers[2 % listenPapers.length].id);
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

  const src = fs.readFileSync(path.resolve("src/pages/MockExam.tsx"), "utf8");
  assert.ok(src.includes("scoreComp(rp.exs, m.cePicked, m.ceTyped ?? {})"));
  assert.ok(!src.includes("scoreComp(rp.exs, m.cePicked);"));
  assert.ok(!src.includes("[0, 1].map"));
  assert.ok(src.includes("paperOptions.map("));
  assert.ok(src.includes("resolveMockPoTyped("));
  assert.ok(src.includes("重试提问"));
  assert.ok(src.includes("跳过辩论，直接批改独白"));
});
