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

  // 2. Post-2020 DELF B2 reading format: all preset reading papers use 100% 3-option QCMs with verbatim evidence & trapTypes
  const readPapers = PRESET_PAPERS.filter((p) => p.kind === "read");
  assert.equal(readPapers.length, 5);
  const listenPapers = PRESET_PAPERS.filter((p) => p.kind === "listen");
  assert.equal(listenPapers.length, 5);
  for (const paper of [...readPapers, ...listenPapers]) {
    assert.equal(paper.exs.reduce((n, ex) => n + exercisePoints(ex), 0), 25, paper.id);
    for (const ex of paper.exs) {
      assert.equal(isValidComprehension(ex, ex.form), true, `${paper.id}:${ex.title}`);
      assert.deepEqual(qualityIssues(ex), [], `${paper.id}:${ex.title}`);
    }
  }
  for (const paper of readPapers) {
    for (const ex of paper.exs) {
      for (const q of ex.questions) {
        assert.ok(!q.qType || q.qType === "qcm", `${paper.id}: unexpected legacy qType ${q.qType}`);
        assert.equal(q.options.length, 3, `${paper.id}: ${q.q}`);
        assert.equal(gradeCompQuestion(q, q.answer, undefined, ex.docs[q.doc].text).correct, true, `${paper.id}: ${q.q}`);
      }
    }
  }

  // 3. R3_LONG_2 Q2 avoids narrowing to "à Paris" and carries verbatim evidence + 3 trap annotations
  const q2 = r3.exs[1].questions[1];
  assert.ok(!q2.q.includes("à Paris"));
  assert.ok(q2.evidence && r3.exs[1].docs[0].text.includes(q2.evidence));
  assert.equal(q2.trapTypes?.length, 3);
  assert.equal(gradeCompQuestion(q2, q2.answer, undefined, r3.exs[1].docs[0].text).correct, true);

  // 4. R3_LONG_2 Q6 (INSEE 2% income drop) carries verbatim evidence inside doc text
  const q6 = r3.exs[1].questions[5];
  assert.ok(q6.evidence?.includes("2%"));
  assert.ok(q6.evidence && r3.exs[1].docs[0].text.includes(q6.evidence));

  // 5. R3_OPINIONS Q4 uniquely points to Sophie (éducation civique dès le plus jeune âge)
  const q4Op = r3.exs[2].questions[3];
  assert.equal(q4Op.answer, 2);
  assert.equal(q4Op.options[2], "Sophie");
  assert.ok(!q4Op.q.includes("fausser les résultats"));
  assert.ok(q4Op.q.includes("éducation civique"));

  // 6. 待核对 annotation preserved in source
  const presetsSrc = fs.readFileSync(path.resolve("src/lib/exam-presets.ts"), "utf8");
  assert.ok(presetsSrc.includes("待核对"));
});
