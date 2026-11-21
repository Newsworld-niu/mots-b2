import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { exercisePoints, gradeCompQuestion, isValidComprehension } from "./exam";
import { PRESET_PAPERS } from "./exam-presets";
import { qualityIssues } from "./listening";

test("P1: preset-read-3 fixes zh hallucinations, R3_LONG_2 Q2/Q5, R3_OPINIONS Q4, and preserves 25 pts + quality gate + 待核对", () => {
  const r3 = PRESET_PAPERS.find((p) => p.id === "preset-read-3");
  assert.ok(r3);
  assert.equal(r3.exs.length, 3);
  assert.equal(r3.exs.reduce((n, ex) => n + exercisePoints(ex), 0), 25);

  for (const ex of r3.exs) {
    assert.equal(isValidComprehension(ex, ex.form), true);
    assert.deepEqual(qualityIssues(ex), []);
  }

  // 1. R3_LONG_1 zh removes the 4 hallucinated sentences and aligns 5 paragraphs
  const zh1 = r3.exs[0].docs[0].zh;
  assert.equal(zh1.split("\n").length, r3.exs[0].docs[0].text.split("\n").length);
  for (const extra of [
    "微钙化灶",
    "目前医生对这些工具的培训还不够",
    "患者是否同意将其信息用于AI学习数据库",
    "还设立了伦理委员会",
  ]) {
    assert.ok(!zh1.includes(extra), `R3_LONG_1 zh still contains hallucinated text: ${extra}`);
  }

  // 2. R3_LONG_2 Q2 no longer narrows to "à Paris"
  const q2 = r3.exs[1].questions[1];
  assert.equal(q2.qType, "vf");
  assert.ok(!q2.q.includes("à Paris"));
  assert.equal(gradeCompQuestion(q2, 0, q2.quote, r3.exs[1].docs[0].text).correct, true);

  // 3. R3_LONG_2 Q5 accepted contains both "de 2%" and "de 2 %" and grades variants cleanly
  const q5 = r3.exs[1].questions[4];
  assert.equal(q5.qType, "short");
  assert.ok(q5.accepted?.includes("de 2%"));
  assert.ok(q5.accepted?.includes("de 2 %"));
  for (const ans of ["2%", "2 %", "de 2%", "de 2 %", "deux pour cent", "2 pour cent"]) {
    assert.equal(gradeCompQuestion(q5, undefined, ans, r3.exs[1].docs[0].text).correct, true, ans);
  }

  // 4. R3_OPINIONS Q4 uniquely points to Sophie (education civique dès le plus jeune âge)
  const q4Op = r3.exs[2].questions[3];
  assert.equal(q4Op.answer, 2);
  assert.equal(q4Op.options[2], "Sophie");
  assert.ok(!q4Op.q.includes("fausser les résultats"));
  assert.ok(q4Op.q.includes("éducation civique"));

  // 5. 待核对 annotation preserved in source
  const presetsSrc = fs.readFileSync(path.resolve("src/lib/exam-presets.ts"), "utf8");
  assert.ok(presetsSrc.includes("待核对"));
});
