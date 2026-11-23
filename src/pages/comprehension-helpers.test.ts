import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { acceptComprehensionExercise, buildComprehensionSpec } from "../ai/tasks";
import { countWords } from "../lib/essay";
import { examReadiness, exercisePoints, gradeCompQuestion, isValidComprehension, PAPER, sanitizeExamLog, sanitizeExercise, type CompQuestion } from "../lib/exam";
import { PRESET_PAPERS } from "../lib/exam-presets";
import { qualityIssues } from "../lib/listening";
import { sanitizePaper } from "../store/exam-bank";
import { defaultCompFormat, effectiveCompFormat, normalizeCompQuestionForKind, shouldShowCitationInput, shouldShowCompFormatPicker } from "./comprehension-helpers";

test("L1: both listening and reading default to post-2020 3-option QCM; legacy parallel stays reading-only", () => {
  assert.equal(defaultCompFormat("listen"), "qcm");
  assert.equal(defaultCompFormat("read"), "qcm");

  assert.equal(effectiveCompFormat("listen", "parallel"), "qcm");
  assert.equal(effectiveCompFormat("listen", "qcm"), "qcm");
  assert.equal(effectiveCompFormat("read", "parallel"), "parallel");
  assert.equal(effectiveCompFormat("read", "qcm"), "qcm");

  assert.equal(shouldShowCompFormatPicker("listen", "paper"), false);
  assert.equal(shouldShowCompFormatPicker("listen", "long"), false);
  assert.equal(shouldShowCompFormatPicker("listen", "short"), false);
  assert.equal(shouldShowCompFormatPicker("read", "paper"), true);
  assert.equal(shouldShowCompFormatPicker("read", "long"), true);
  assert.equal(shouldShowCompFormatPicker("read", "opinions"), false);

  const vfQ: CompQuestion = {
    q: "Le maire soutient le projet.",
    qType: "vf",
    options: ["Vrai", "Faux"],
    answer: 0,
    quote: "Le maire affirme soutenir pleinement ce projet.",
    why: "解析",
    pts: 1,
    doc: 0,
  };
  assert.equal(shouldShowCitationInput(vfQ, "read"), true);
  assert.equal(shouldShowCitationInput(vfQ, "listen"), false);

  const normalizedListen = normalizeCompQuestionForKind(vfQ, "listen");
  assert.equal(normalizedListen.qType, "qcm");
  assert.equal(normalizedListen.quote, undefined);
  assert.equal(shouldShowCitationInput(normalizedListen, "listen"), false);
  assert.equal(gradeCompQuestion(normalizedListen, 0, "", "Le maire affirme soutenir pleinement ce projet.").correct, true);

  const normalizedRead = normalizeCompQuestionForKind(vfQ, "read");
  assert.equal(normalizedRead.qType, "vf");
  assert.equal(normalizedRead.quote, vfQ.quote);
});

test("L1: AI makeComprehension spec, French word-count floor, and option-length giveaway gate", () => {
  const listenAttemptParallel = buildComprehensionSpec({ kind: "listen", form: "long", level: "B2", format: "parallel" });
  assert.equal(listenAttemptParallel.parallel, false);
  assert.equal(listenAttemptParallel.schemaName, "comprehension");
  assert.ok(!listenAttemptParallel.system.includes("LEGACY SUPPLEMENTARY FORMAT"));

  const readParallel = buildComprehensionSpec({ kind: "read", form: "long", level: "B2", format: "parallel" });
  assert.equal(readParallel.parallel, true);
  assert.equal(readParallel.schemaName, "comprehension_parallel");
  assert.ok(readParallel.system.includes('LEGACY SUPPLEMENTARY FORMAT ("parallel")'));
  assert.ok(readParallel.system.includes('ONLY for reading ("kind": "read")'));
  assert.ok(readParallel.system.includes('NEVER for "listen"'));

  const longDoc = `${"Les collectivités locales débattent activement de la transition énergétique dans les transports quotidiens. ".repeat(26)}`;
  const mkQ = (k: number, extra: Record<string, unknown> = {}) => ({
    doc: 0,
    q: `Question ${k} ?`,
    options: ["Une première piste crédible", "Une deuxième piste crédible", "Une troisième piste crédible"],
    answer: k % 3,
    why: "解析",
    difficulty: (k % 5) + 1,
    skill: "detail",
    ...extra,
  });

  const qcmOnlyEx = sanitizeExercise({ title: "Énergie", docs: [{ text: longDoc, zh: "中文" }], questions: [0, 1, 2, 3, 4, 5, 6].map((k) => mkQ(k)) }, "long", "environnement");
  assert.equal(acceptComprehensionExercise(qcmOnlyEx, "listen", "long"), true);

  // Too-short French doc (< 300 words even if > 200 chars) is rejected
  const shortDoc = `${"Les collectivités locales débattent de la transition énergétique. ".repeat(8)}`;
  const underWordEx = sanitizeExercise({ title: "Court", docs: [{ text: shortDoc, zh: "中文" }], questions: [0, 1, 2, 3, 4, 5, 6].map((k) => mkQ(k)) }, "long", "environnement");
  assert.equal(isValidComprehension(underWordEx, "long"), false);

  // Extreme option-length giveaway (maxOptionWords > minOptionWords * 3.5 + 4) is rejected
  const giveawayEx = sanitizeExercise(
    {
      title: "Giveaway",
      docs: [{ text: longDoc, zh: "中文" }],
      questions: [
        mkQ(0, {
          options: [
            "Non",
            "Oui",
            "Une explication extrêmement détaillée comportant douze mots bien trop visibles pour le candidat",
          ],
        }),
        ...[1, 2, 3, 4, 5, 6].map((k) => mkQ(k)),
      ],
    },
    "long",
    "environnement",
  );
  assert.equal(isValidComprehension(giveawayEx, "long"), false);

  const parallelEx = sanitizeExercise(
    {
      title: "Énergie",
      docs: [{ text: longDoc, zh: "中文" }],
      questions: [
        mkQ(0),
        mkQ(1, { qType: "vf", options: ["Vrai", "Faux"], answer: 0, quote: "Les collectivités locales débattent activement de la transition énergétique" }),
        mkQ(2),
        mkQ(3, { qType: "short", options: [], answer: 0, accepted: ["transition énergétique"] }),
        mkQ(4),
        mkQ(5),
        mkQ(6),
      ],
    },
    "long",
    "environnement",
  );
  assert.equal(acceptComprehensionExercise(parallelEx, "listen", "long"), false);
  assert.equal(acceptComprehensionExercise(parallelEx, "read", "long"), true);
});

test("Shared contracts: gradeCompQuestion preserves negation polarity and examReadiness separates unverified scores", () => {
  const negShort: CompQuestion = {
    q: "Quelle condition l'auteur pose-t-il ?",
    qType: "short",
    options: [],
    answer: 0,
    accepted: ["sans aucune subvention publique", "ne dépend plus des aides publiques"],
    why: "解析",
    pts: 1.5,
    doc: 0,
  };
  assert.equal(gradeCompQuestion(negShort, 0, "avec une subvention publique").correct, false);
  assert.equal(gradeCompQuestion(negShort, 0, "dépend des aides publiques").correct, false);
  assert.equal(gradeCompQuestion(negShort, 0, "sans subvention publique").correct, true);
  assert.equal(gradeCompQuestion(negShort, 0, "n'a plus besoin des aides publiques").correct, true);

  const posShort: CompQuestion = {
    q: "Que constate le rapport ?",
    qType: "short",
    options: [],
    answer: 0,
    accepted: ["une hausse régulière des inscriptions"],
    why: "解析",
    pts: 1,
    doc: 0,
  };
  assert.equal(gradeCompQuestion(posShort, 0, "pas de hausse régulière des inscriptions").correct, false);
  assert.equal(gradeCompQuestion(posShort, 0, "aucune hausse régulière des inscriptions").correct, false);
  assert.equal(gradeCompQuestion(posShort, 0, "hausse régulière des inscriptions").correct, true);

  const log = sanitizeExamLog([
    { at: 100, part: "listen", what: "paper", score: 18, total: 25, scope: "full" },
    { at: 200, part: "read", what: "paper", score: 19, total: 25, scope: "full" },
    { at: 300, part: "essay", what: "argument", score: 16, total: 25, scope: "full" },
    { at: 400, part: "speak", what: "monologue", score: 20, total: 25, scope: "full", unverified: true },
  ]);
  assert.equal(log?.length, 4);
  assert.equal(log?.[3].unverified, true);
  const readiness = examReadiness(log);
  assert.equal(readiness.completed, 3);
  assert.equal(readiness.parts.find((p) => p.part === "speak")?.score25, null);
  assert.equal(readiness.unverifiedLatest?.speak?.score, 20);
  assert.equal(readiness.exact100, null);
  assert.equal(readiness.passed, null);
});

test("10 paired preset papers (5 CO + 5 CE) are 100% post-2020 3-option QCMs with valid word counts and verbatim CE evidence", () => {
  const listenPresets = PRESET_PAPERS.filter((p) => p.kind === "listen");
  const readPresets = PRESET_PAPERS.filter((p) => p.kind === "read");
  assert.equal(listenPresets.length, 5);
  assert.equal(readPresets.length, 5);

  for (const paper of PRESET_PAPERS) {
    assert.deepEqual(paper.exs.map((e) => e.form), PAPER[paper.kind], paper.id);
    assert.equal(paper.exs.reduce((n, e) => n + exercisePoints(e), 0), 25, paper.id);
    assert.deepEqual(sanitizePaper(paper)?.exs, paper.exs, `${paper.id} sanitizePaper idempotence`);
    for (const ex of paper.exs) {
      assert.equal(isValidComprehension(ex, ex.form), true, `${paper.id} ${ex.title} failed isValidComprehension`);
      assert.deepEqual(qualityIssues(ex), [], `${paper.id} ${ex.title} qualityIssues`);
      for (const d of ex.docs) {
        const wc = countWords(d.text);
        if (paper.kind === "read" && ex.form === "long") assert.ok(wc >= 450 && wc <= 600, `${paper.id} ${ex.title}: ${wc}w`);
        if (paper.kind === "read" && ex.form === "opinions") assert.ok(wc >= 390 && wc <= 480, `${paper.id} ${ex.title}: ${wc}w`);
      }
      for (const q of ex.questions) {
        assert.ok(!q.qType || q.qType === "qcm", `${paper.id} has unexpected qType=${q.qType}`);
        assert.equal(q.options.length, 3, `${paper.id} ${q.q} options.length`);
        assert.equal(q.quote, undefined, `${paper.id} has unexpected quote`);
        assert.equal(q.accepted, undefined, `${paper.id} has unexpected accepted`);
        if (paper.kind === "read") {
          assert.ok(q.evidence && ex.docs[q.doc ?? 0].text.includes(q.evidence), `${paper.id} evidence not verbatim in doc: ${q.evidence}`);
          assert.equal(q.trapTypes?.length, 3, `${paper.id} trapTypes length`);
        }
      }
    }
  }

  const src = [
    "src/pages/Comprehension.tsx",
    "src/pages/comprehension/CompSetupView.tsx",
    "src/pages/comprehension/CompExerciseBody.tsx",
  ]
    .map((p) => fs.readFileSync(path.resolve(p), "utf8"))
    .join("\n");
  assert.ok(src.includes("defaultCompFormat(kind)"));
  assert.ok(src.includes("effectiveCompFormat(kind, qFormat)"));
  assert.ok(src.includes("shouldShowCompFormatPicker(kind, what)"));
  assert.ok(src.includes("shouldShowCitationInput("));
  assert.ok(src.includes("旧版考纲附加训练（含引证与简答）"));
  assert.ok(src.includes("点选原文寻证"));
});
