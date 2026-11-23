import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { parseCliAcousticEnv } from "../../scripts/build-co-audio";
import { reconcileBlindSolverItems, sanitizeTrackExercise } from "../ai/tasks/exam";
import { ACOUSTIC_ENVS, estimateEvidenceWindow, ffmpegFilterForEnv, isAcousticEnv } from "./audio-env";
import { countWords } from "./essay";
import { exercisePoints } from "./exam-schema";
import { scoreTcfReceptive, scoreTefItems699, trackReadiness } from "./exam-tracks";
import { buildCompMissSnapshot, qualityIssues } from "./listening";
import { PREBUILT_FAST_CHRONICLES, PREBUILT_REAL_SOURCES, realPresetQuiz } from "./real-presets";
import {
  presetPapersForTrack,
  TCF_CE_PAPER,
  TCF_CO_PAPER,
  TCF_TEF_PRESET_PAPERS,
  TEF_CE_PAPER,
  TEF_CO_PAPER,
} from "./tcf-tef-presets";
import { projectQuestionForMissSnapshot } from "../pages/comprehension-helpers";

test("TCF & TEF preset suites have 4 distinct options, verbatim evidence, balanced distractors, and zero quality issues", () => {
  assert.equal(TCF_TEF_PRESET_PAPERS.length, 4);
  assert.equal(TCF_CO_PAPER.exs.reduce((n, ex) => n + ex.questions.length, 0), 12);
  assert.equal(TCF_CE_PAPER.exs.reduce((n, ex) => n + ex.questions.length, 0), 12);
  assert.equal(TEF_CO_PAPER.exs.reduce((n, ex) => n + ex.questions.length, 0), 12);
  assert.equal(TEF_CE_PAPER.exs.reduce((n, ex) => n + ex.questions.length, 0), 15);

  assert.equal(presetPapersForTrack("tcf", "listen").length, 1);
  assert.equal(presetPapersForTrack("tcf", "read").length, 1);
  assert.equal(presetPapersForTrack("tef", "listen").length, 1);
  assert.equal(presetPapersForTrack("tef", "read").length, 1);

  const tefCeTaskTypes = new Set<number>();

  for (const paper of TCF_TEF_PRESET_PAPERS) {
    const answerPositions = new Set<number>();
    for (const ex of paper.exs) {
      assert.ok(ex.docs.length >= 1, `${paper.id} exercise must have docs`);
      const issues = qualityIssues(ex);
      assert.deepEqual(issues, [], `${paper.id} (${ex.title}) has quality issues: ${issues.join("; ")}`);
      for (const q of ex.questions) {
        assert.equal(q.options.length, 4, `${paper.id} question must have 4 options: ${q.q}`);
        assert.equal(new Set(q.options).size, 4, `${paper.id} options must be distinct: ${q.q}`);
        assert.ok(q.answer >= 0 && q.answer <= 3, `${paper.id} answer must be in 0..3`);
        answerPositions.add(q.answer);
        assert.ok(q.difficulty >= 1 && q.difficulty <= 6, `${paper.id} difficulty must be in 1..6`);
        assert.equal(q.trapTypes?.length, 4, `${paper.id} trapTypes must align with 4 options`);
        assert.ok(q.why.trim().length >= 8, `${paper.id} why explanation must be non-empty`);
        assert.ok(q.evidence && q.evidence.trim().length >= 12, `${paper.id} evidence must be present`);
        const docText = ex.docs[q.doc]?.text ?? "";
        assert.ok(
          docText.includes(q.evidence!),
          `${paper.id} evidence must appear verbatim in docs[${q.doc}].text: "${q.evidence}"`,
        );
        if (paper.id === "tef-preset-ce-1" && q.tefTaskType) {
          tefCeTaskTypes.add(q.tefTaskType);
        }
      }
    }
    assert.deepEqual([...answerPositions].sort(), [0, 1, 2, 3], `${paper.id} should use all 4 answer positions A/B/C/D`);
  }

  assert.deepEqual([...tefCeTaskTypes].sort(), [1, 2, 3, 4, 5], "TEF CE paper must cover all 5 post-Dec-2023 reading task types");
});

test("TCF & TEF scoring scales map preset items to 699 scale, CEFR, NCLC 7+, and trackReadiness", () => {
  const tcfItems = TCF_CO_PAPER.exs.flatMap((ex) =>
    ex.questions.map((q, idx) => ({ correct: idx < 10, difficulty: q.difficulty })),
  );
  const tcfScore = scoreTcfReceptive(tcfItems, "co");
  assert.ok(tcfScore.score699 >= 458 && tcfScore.score699 <= 699, `expected NCLC 7+ TCF CO score, got ${tcfScore.score699}`);
  assert.ok(tcfScore.nclc >= 7);

  const tefItems = TEF_CE_PAPER.exs.flatMap((ex) =>
    ex.questions.map((q, idx) => ({ correct: idx < 12, difficulty: q.difficulty })),
  );
  const tefScore = scoreTefItems699(tefItems, "ce");
  assert.ok(tefScore.score699 >= 434 && tefScore.score699 <= 699, `expected NCLC 7+ TEF CE score, got ${tefScore.score699}`);
  assert.ok(tefScore.nclc >= 7);

  const readiness = trackReadiness(
    [
      {
        part: "listen",
        what: "tcf-preset-co-1",
        score: tcfScore.correctCount,
        total: tcfScore.totalCount,
        at: Date.now(),
        track: "tcf",
        trackSection: "co",
        scaledScore: tcfScore.score699,
        nclc: tcfScore.nclc,
      },
    ],
    "tcf",
  );
  assert.equal(readiness.completedCount, 1);
  assert.equal(readiness.sections[0].nclc7Met, true);
});

test("4-option blind solver reconciliation, sanitizeTrackExercise, and 4-to-3 CompMiss projection work cleanly", () => {
  const sampleEx = sanitizeTrackExercise(
    {
      intro: "TCF CE",
      title: "Mobilité urbaine",
      docs: [{ text: "La municipalité réserve désormais la voie centrale aux bus électriques dès six heures du matin.", zh: "市政府将中央车道留给电动公交。" }],
      questions: [
        {
          doc: 0,
          q: "Quelle mesure la mairie a-t-elle prise ?",
          options: [
            "Fermer toutes les rues aux piétons",
            "Rendre le stationnement gratuit le soir",
            "Supprimer les bus électriques à l'aube",
            "Dédiant le couloir central aux navettes électriques matinales",
          ],
          answer: 1,
          difficulty: 4,
          evidence: "La municipalité réserve désormais la voie centrale aux bus électriques dès six heures du matin.",
          trapTypes: ["无中生有", "原标错误", "反向陷阱", "同义改写（正确项）"],
          why: "D项准确对应原文。",
          skill: "paraphrase",
        },
      ],
    },
    "tcf",
    "read",
    "transports-mobilite",
  );

  assert.equal(sampleEx.questions.length, 1);
  assert.equal(sampleEx.questions[0].options.length, 4);

  const reconciled = reconcileBlindSolverItems(sampleEx, [
    { index: 0, answer: 3, ambiguousDistractor: false, reason: "D项与中央车道专供电动公交一致。" },
  ]);
  assert.equal(reconciled.ok, false);
  assert.deepEqual(reconciled.disagreements, [0]);
  assert.deepEqual(reconciled.ambiguous, []);
  assert.equal(reconciled.repaired.questions[0].answer, 3);

  const projected = projectQuestionForMissSnapshot(reconciled.repaired.questions[0], 1);
  assert.equal(projected.options.length, 3);
  assert.equal(projected.options[projected.answer], "Dédiant le couloir central aux navettes électriques matinales");
  assert.ok(projected.options.includes("Rendre le stationnement gratuit le soir"));

  const snap = buildCompMissSnapshot(projected, sampleEx, "read", "0-0", Date.now());
  assert.equal(snap.options?.length, 3);
  assert.equal(snap.options?.[snap.answer ?? 0], "Dédiant le couloir central aux navettes électriques matinales");
});

test("Acoustic environments, CLI --env parser, and 10s evidence window estimator satisfy M2 audio contracts", () => {
  assert.equal(ACOUSTIC_ENVS.length, 4);
  for (const env of ["clean", "studio", "phone", "street"] as const) {
    assert.equal(isAcousticEnv(env), true);
    const filter = ffmpegFilterForEnv(env);
    assert.ok(filter.includes("loudnorm=I=-16:TP=-1.5:LRA=11"), `filter for ${env} must end with -16 LUFS loudnorm`);
  }
  assert.equal(parseCliAcousticEnv([]), "clean");
  assert.equal(parseCliAcousticEnv(["--force", "--env=phone"]), "phone");
  assert.equal(parseCliAcousticEnv(["--env", "street"]), "street");
  assert.throws(() => parseCliAcousticEnv(["--env=underwater"]));

  const doc = TCF_CO_PAPER.exs[1].docs[0].text;
  const ev = TCF_CO_PAPER.exs[1].questions[1].evidence!;
  const win = estimateEvidenceWindow(doc, ev, 90);
  assert.ok(win.startSec >= 0 && win.endSec <= 90);
  const span = win.endSec - win.startSec;
  assert.ok(span >= 10 && span <= 13.5, `expected ~10-13s slice window, got ${span}s`);
});

test("~170 WPM native-speed chronicles keep 480–540 words, CC BY 4.0 metadata, 9pt 7-QCM drills, and verbatim evidence", () => {
  assert.equal(PREBUILT_REAL_SOURCES.length, 6, "PREBUILT_REAL_SOURCES must remain the 6 authentic RFI episodes");
  assert.equal(PREBUILT_FAST_CHRONICLES.length, 4, "PREBUILT_FAST_CHRONICLES must provide 4 native-speed chronicles");

  for (const chron of PREBUILT_FAST_CHRONICLES) {
    assert.equal(chron.pace, "native170");
    assert.equal(chron.license, "CC BY 4.0");
    assert.match(chron.id, /^(?:s|rfi)-[a-z0-9-]{4,32}$/);
    assert.match(chron.url, /^tts-chronicle:[a-z0-9-]+$/);
    const wc = countWords(chron.transcript ?? "");
    assert.ok(wc >= 480 && wc <= 540, `${chron.id} word count must be in 480..540 (~3 min @ 170 WPM), got ${wc}`);
    assert.equal(chron.words, wc, `${chron.id} declared words must match countWords`);

    const quiz = realPresetQuiz(chron.presetId);
    assert.ok(quiz, `missing realPresetQuiz for ${chron.presetId}`);
    assert.equal(quiz!.questions.length, 7);
    assert.equal(exercisePoints(quiz!), 9);
    const issues = qualityIssues(quiz!);
    assert.deepEqual(issues, [], `${chron.id} quiz quality issues: ${issues.join("; ")}`);
    for (const q of quiz!.questions) {
      assert.ok(q.evidence && chron.transcript!.includes(q.evidence), `${chron.id} evidence must appear verbatim: ${q.evidence}`);
    }
  }
});

test("Lazy-load & speaking-safety invariants hold across Comprehension.tsx and exam.ts", () => {
  const root = process.cwd();
  const compSrc = readFileSync(join(root, "src/pages/Comprehension.tsx"), "utf8");
  assert.ok(compSrc.includes('import("../lib/tcf-tef-presets")'), "Comprehension.tsx must dynamically import tcf-tef-presets");
  assert.ok(!/^import\s+\{[^}]*\}\s+from\s+["']\.\.\/lib\/tcf-tef-presets["']/m.test(compSrc), "Comprehension.tsx must only type-import or dynamically import tcf-tef-presets");

  const examTaskSrc = readFileSync(join(root, "src/ai/tasks/exam.ts"), "utf8");
  assert.ok(examTaskSrc.includes("input.transcript.slice(0, MAX_SPEAKING_MONOLOGUE_LENGTH)"));
  assert.ok(examTaskSrc.includes("input.monologue.slice(0, MAX_SPEAKING_MONOLOGUE_LENGTH)"));
  assert.ok(examTaskSrc.includes("SPEAK_SCHEMA"));
  assert.ok(examTaskSrc.includes("SPEAK_SYSTEM"));
});
