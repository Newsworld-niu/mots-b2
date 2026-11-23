import assert from "node:assert/strict";
import { test } from "node:test";
import { countWords } from "./essay";
import { sanitizeQuiz } from "./reader";
import { READ_PRESETS, readPresetById } from "./read-presets";

test("READ_PRESETS provides >= 10 curated B2 articles with aligned translations and balanced QCMs", () => {
  assert.ok(READ_PRESETS.length >= 10);
  const ids = new Set<string>();
  const answerDist = [0, 0, 0];
  let totalQ = 0;

  for (const p of READ_PRESETS) {
    assert.match(p.id, /^p-[a-z0-9-]+$/);
    assert.ok(!ids.has(p.id), p.id);
    ids.add(p.id);
    assert.equal(p.level, "B2");
    assert.equal(readPresetById(p.id), p);

    const wc = countWords(p.text);
    assert.ok(wc >= 240 && wc <= 500, `${p.id} wordCount=${wc}`);
    const frParas = p.text.split(/\n+/).filter(Boolean);
    const zhParas = p.zh.split(/\n+/).filter(Boolean);
    assert.equal(zhParas.length, frParas.length, `${p.id} zh paragraph mismatch`);

    const cleanQuiz = sanitizeQuiz(p.quiz);
    assert.equal(cleanQuiz.length, 3, `${p.id} quiz validation`);
    for (const q of cleanQuiz) {
      assert.equal(q.options.length, 3, p.id);
      assert.ok(q.why.trim().length > 8, p.id);
      answerDist[q.answer]++;
      totalQ++;
    }
  }

  for (const count of answerDist) {
    assert.ok(count <= Math.ceil(totalQ * 0.55), `answer distribution skewed: ${JSON.stringify(answerDist)}`);
  }
});
