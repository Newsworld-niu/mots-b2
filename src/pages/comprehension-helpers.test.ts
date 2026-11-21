import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { acceptComprehensionExercise, buildComprehensionSpec } from "../ai/tasks";
import { gradeCompQuestion, sanitizeExercise, type CompQuestion } from "../lib/exam";
import { PRESET_PAPERS } from "../lib/exam-presets";
import { defaultCompFormat, effectiveCompFormat, normalizeCompQuestionForKind, shouldShowCitationInput, shouldShowCompFormatPicker } from "./comprehension-helpers";

test("L1: listening format defaults to QCM, hides parallel toggle, and never renders quote citations", () => {
  assert.equal(defaultCompFormat("listen"), "qcm");
  assert.equal(defaultCompFormat("read"), "parallel");

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

test("L1: AI makeComprehension spec and gate restrict parallel vf+quote strictly to reading", () => {
  const listenAttemptParallel = buildComprehensionSpec({ kind: "listen", form: "long", level: "B2", format: "parallel" });
  assert.equal(listenAttemptParallel.parallel, false);
  assert.equal(listenAttemptParallel.schemaName, "comprehension");
  assert.ok(!listenAttemptParallel.system.includes("PARALLEL OFFICIAL FORMAT"));

  const readParallel = buildComprehensionSpec({ kind: "read", form: "long", level: "B2", format: "parallel" });
  assert.equal(readParallel.parallel, true);
  assert.equal(readParallel.schemaName, "comprehension_parallel");
  assert.ok(readParallel.system.includes("PARALLEL OFFICIAL FORMAT"));
  assert.ok(readParallel.system.includes('ONLY for reading ("kind": "read")'));
  assert.ok(readParallel.system.includes('NEVER for "listen"'));

  const longDoc = `${"Les collectivités locales débattent de la transition énergétique dans les transports quotidiens. ".repeat(5)}`;
  const mkQ = (k: number, extra: Record<string, unknown> = {}) => ({
    doc: 0,
    q: `Question ${k} ?`,
    options: ["Option A", "Option B", "Option C"],
    answer: k % 3,
    why: "解析",
    difficulty: (k % 5) + 1,
    skill: "detail",
    ...extra,
  });

  const qcmOnlyEx = sanitizeExercise({ title: "Énergie", docs: [{ text: longDoc, zh: "中文" }], questions: [0, 1, 2, 3, 4, 5, 6].map((k) => mkQ(k)) }, "long", "environnement");
  assert.equal(acceptComprehensionExercise(qcmOnlyEx, "listen", "long"), true);

  const parallelEx = sanitizeExercise(
    {
      title: "Énergie",
      docs: [{ text: longDoc, zh: "中文" }],
      questions: [
        mkQ(0),
        mkQ(1, { qType: "vf", options: ["Vrai", "Faux"], answer: 0, quote: "Les collectivités locales débattent de la transition énergétique" }),
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

test("L1: all preset listening papers contain zero vf/quote/short questions and Comprehension.tsx wires helpers", () => {
  const listenPresets = PRESET_PAPERS.filter((p) => p.kind === "listen");
  assert.ok(listenPresets.length >= 2);
  for (const paper of listenPresets) {
    for (const ex of paper.exs) {
      for (const q of ex.questions) {
        assert.ok(!q.qType || q.qType === "qcm", `${paper.id} has unexpected qType=${q.qType}`);
        assert.equal(q.quote, undefined, `${paper.id} has unexpected quote`);
        assert.equal(shouldShowCitationInput(q, "listen"), false);
      }
    }
  }

  const src = fs.readFileSync(path.resolve("src/pages/Comprehension.tsx"), "utf8");
  assert.ok(src.includes("defaultCompFormat(kind)"));
  assert.ok(src.includes("effectiveCompFormat(kind, qFormat)"));
  assert.ok(src.includes("shouldShowCompFormatPicker(kind, what)"));
  assert.ok(src.includes("shouldShowCitationInput("));
});
