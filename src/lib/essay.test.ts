import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { applyEssayGridCaps, applyEssayLengthCaps, buildTask, CONNECTORS, countWords, CRITERIA, essayLevelOf, ESSAY_TASKS, hasFormalRegisterViolation, levelLabel, maxScore, sanitizeAiTasks, sanitizeEssayFeedback, sanitizeEssays, sanitizeNotes, splitEssaysByLevel, tooShort, toLevel, totalScore, wordsFor } from "./essay";

test("countWords counts elided and hyphenated words once", () => {
  assert.equal(countWords("L'ami de Paul est arrivé."), 5);
  assert.equal(countWords("C'est-à-dire : 3 jours, peut-être !"), 4);
  assert.equal(countWords("  "), 0);
});

test("every task has a plan, points, phrases and a sane word range", () => {
  const ids = new Set<string>();
  for (const t of ESSAY_TASKS) {
    assert.ok(!ids.has(t.id), t.id);
    ids.add(t.id);
    assert.ok(t.title && t.situation && t.consigne, t.id);
    assert.ok(t.points.length >= 2 && t.plan.length >= 3 && t.phrases.length >= 3, t.id);
    assert.ok(t.words[0] >= 80 && t.words[1] > t.words[0] && t.words[1] <= 400, t.id);
  }
  assert.ok(CONNECTORS.every((g) => g.zh && g.fr.length >= 2));
});

test("sanitizeEssayFeedback snaps scores to the grid's levels and keeps only known grammar points", () => {
  const fb = sanitizeEssayFeedback(
    {
      scores: { task: 9, coherence: 3.3, socio: 2, lexique: "x", morpho: -2 },
      comment: " 不错 ",
      strengths: ["结构清楚", 3, ""],
      todo: ["a", "b", "c", "d", "e"],
      corrections: [
        { wrong: "je suis allé", right: "je suis allée", type: "agreement", why: "配合", point: "accord-pp" },
        { wrong: "x", right: "x", type: "tense", why: "", point: "" },
        { wrong: "bien que il est", right: "bien qu'il soit", type: "nope", why: "虚拟式", point: "made-up" },
      ],
      rewrite: "Texte.",
    },
    new Set(["accord-pp"]),
  );
  assert.deepEqual(fb.scores, { task: 5, coherence: 3, socio: 1, lexique: 0, morpho: 0 });
  assert.equal(totalScore(fb), 9);
  assert.equal(maxScore(fb), 25);
  assert.equal(fb.comment, "不错");
  assert.deepEqual(fb.strengths, ["结构清楚"]);
  assert.equal(fb.todo.length, 4);
  assert.equal(fb.corrections.length, 2);
  assert.equal(fb.corrections[0].point, "accord-pp");
  assert.deepEqual([fb.corrections[1].type, fb.corrections[1].point], ["other", ""]);
  const empty = sanitizeEssayFeedback(null, new Set());
  assert.ok(CRITERIA.every((c) => empty.scores[c] === 0) && empty.corrections.length === 0);
  // markings saved before the official grid
  const old = sanitizeEssayFeedback({ scores: { task: 4, structure: 3.5, grammar: 5, vocabulary: 1 } }, new Set());
  assert.deepEqual(old.scores, { task: 3, coherence: 3, socio: 0, lexique: 1, morpho: 5 });
  assert.deepEqual([0, 0.9, 1, 2.9, 3, 4.9, 5, 7].map(toLevel), [0, 0, 1, 1, 3, 3, 5, 5]);
  assert.equal(tooShort("un deux trois", 250), true);
  assert.equal(tooShort(new Array(125).fill("mot").join(" "), 250), false);
});

test("sanitizeEssays drops broken rows and unknown tasks", () => {
  const task = ESSAY_TASKS[0].id;
  const out = sanitizeEssays([{ id: "e-1", task, text: "Bonjour", created: 1 }, { id: "e-2", task: "gone", text: "x", created: 1 }, { id: "e-3", task, text: " ", created: 1 }, 7]);
  assert.deepEqual(out, [{ id: "e-1", task, text: "Bonjour", created: 1 }]);
  assert.equal(sanitizeEssays("x"), undefined);
  assert.equal(sanitizeEssays([]), undefined);
});

test("grammar ids the marker may link exist in the built grammar data", () => {
  const g = JSON.parse(readFileSync(new URL("../../public/atlas/grammar.json", import.meta.url), "utf8")) as { points: { id: string }[] };
  assert.ok(g.points.length >= 60);
  assert.ok(g.points.every((p) => /^[a-z0-9-]{2,40}$/.test(p.id)));
});

test("an AI task is built only when it is complete, with the exam's word range for its level", () => {
  const good = {
    level: "B2",
    genre: "courrier",
    title: "自行车道要不要扩建",
    situation: "本地报纸报道市政府想扩建自行车道。",
    consigne: "Vous écrivez au journal pour donner votre opinion.",
    points: ["表明立场", "两个论据"],
    plan: [
      { zh: "引出话题", fr: "J'ai lu votre article…" },
      { zh: "论据", fr: "D'abord,…" },
      { zh: "结论", fr: "C'est pourquoi…" },
    ],
    phrases: [{ fr: "Certes, mais…", zh: "固然……但是" }],
    doc: "",
    topic: "transports",
  };
  const t = buildTask(good, "ai-abc")!;
  assert.ok(t);
  assert.deepEqual(t.words, [250, 350]);
  assert.deepEqual(wordsFor("B2", "essai"), [250, 350]);
  assert.equal(t.doc, undefined, "an empty document is dropped");
  assert.deepEqual(buildTask({ ...good, level: "B1", genre: "mail" }, "ai-abd")!.words, [120, 160]);
  assert.equal(buildTask({ ...good, plan: good.plan.slice(0, 2) }, "ai-x"), null, "a plan of two steps is not a plan");
  assert.equal(buildTask({ ...good, points: ["一个"] }, "ai-x"), null);
  assert.equal(buildTask({ ...good, genre: "poème" }, "ai-x"), null);
  assert.equal(buildTask(good, ""), null);
  // what is stored (phrases as [fr, zh]) reads back the same
  const again = sanitizeAiTasks(JSON.parse(JSON.stringify([t])));
  assert.deepEqual(again, [t]);
  assert.deepEqual(t.phrases, [["Certes, mais…", "固然……但是"]]);
  assert.deepEqual(sanitizeAiTasks([{ ...good, id: "ai-ok" }, { ...good, id: "mail-invitation" }])?.map((x) => x.id), ["ai-ok"], "only ids starting with ai- are accepted from storage");
});

test("saved essays keep AI tasks, a second draft and a model text; unknown tasks are dropped", () => {
  const fb = { scores: { task: 3, coherence: 3, socio: 1, lexique: 3, morpho: 1 }, comment: "ok", strengths: [], todo: [], corrections: [], rewrite: "" };
  const out = sanitizeEssays([
    { id: "e1", task: "ai-zz1", text: "Bonjour", created: 5, fb, rev: { text: "Bonjour à tous", at: 9, fb }, model: { text: "Madame, Monsieur,", patterns: [{ fr: "Certes", zh: "让步" }, { fr: "", zh: "空" }] } },
    { id: "e2", task: "inconnu", text: "x", created: 1 },
    { id: "e3", task: "mail-invitation", text: "Salut", created: 2, rev: { text: "   ", at: 3 } },
  ]);
  assert.deepEqual(out?.map((e) => e.id), ["e1", "e3"]);
  assert.equal(out![0].rev?.text, "Bonjour à tous");
  assert.equal(out![0].rev?.fb?.scores.task, 3);
  assert.deepEqual(out![0].model?.patterns, [{ fr: "Certes", zh: "让步" }]);
  assert.equal(out![1].rev, undefined, "an empty second draft is dropped");
});

test("kept mistakes are cleaned and bounded", () => {
  const out = sanitizeNotes([
    { id: "n1", wrong: "je suis allé", right: "je suis allée", type: "agreement", why: "性数配合", point: "accord-pp", at: 1, from: "投诉信" },
    { id: "n2", wrong: "pareil", right: "pareil", type: "spelling", why: "", point: "", at: 2, from: "" },
    { id: "n3", wrong: "a", right: "b", type: "nonsense", point: "Bad Id!", at: 3, from: "x" },
  ]);
  assert.deepEqual(out?.map((n) => n.id), ["n1", "n3"], "a note whose wrong and right are the same is dropped");
  assert.equal(out![1].type, "other");
  assert.equal(out![1].point, "");
});

test("applyEssayLengthCaps enforces DELF tolerance thresholds (<125 zero, <175 task/coh<=1 & max<=3, <225 task<=1)", () => {
  const full = sanitizeEssayFeedback({ scores: { task: 5, coherence: 5, socio: 5, lexique: 5, morpho: 5 }, comment: "好。" }, new Set());
  const words = (n: number) => new Array(n).fill("mot").join(" ");
  const s124 = applyEssayLengthCaps(full, words(124), 250);
  assert.equal(totalScore(s124), 0);
  const s145 = applyEssayLengthCaps(full, words(145), 250);
  assert.equal(s145.scores.task, 1);
  assert.equal(s145.scores.coherence, 1);
  assert.ok(totalScore(s145) <= 11);
  const s180 = applyEssayLengthCaps(full, words(180), 250);
  assert.equal(s180.scores.task, 1);
  assert.equal(s180.scores.coherence, 5);
  assert.equal(totalScore(s180), 21);
  const s225 = applyEssayLengthCaps(full, words(225), 250);
  assert.equal(totalScore(s225), 25);
  const s360 = applyEssayLengthCaps(full, words(360), 250);
  assert.equal(totalScore(s360), 25);
});

test("PE-2 flags and formal register rules enforce FEI 2022 caps", () => {
  const high = { scores: { task: 5, coherence: 5, socio: 5, lexique: 5, morpho: 5 }, comment: "ok" };
  const partial = sanitizeEssayFeedback({ ...high, offTopic: "partial" }, new Set());
  assert.deepEqual(partial.scores, { task: 3, coherence: 5, socio: 5, lexique: 3, morpho: 5 });
  assert.equal(partial.flags?.offTopic, "partial");

  const total = sanitizeEssayFeedback({ ...high, offTopic: "total", wrongGenre: true, registerViolation: true }, new Set());
  assert.deepEqual(total.scores, { task: 0, coherence: 0, socio: 0, lexique: 3, morpho: 5 });

  const genreBad = sanitizeEssayFeedback({ ...high, wrongGenre: true }, new Set());
  assert.deepEqual(genreBad.scores, { task: 1, coherence: 1, socio: 5, lexique: 5, morpho: 5 });

  const regBad = sanitizeEssayFeedback({ ...high, registerViolation: true }, new Set());
  assert.deepEqual(regBad.scores, { task: 5, coherence: 5, socio: 1, lexique: 5, morpho: 5 });

  // Formal register detector: catches Bonjour/Merci, missing salutation/closing, and unquoted tu; ignores quoted tu
  const filler = new Array(250).fill("mot").join(" ");
  assert.equal(hasFormalRegisterViolation(`Bonjour Monsieur,\n${filler}\nMerci beaucoup.`), true);
  assert.equal(hasFormalRegisterViolation(`Madame, Monsieur,\nQuand tu veux réussir.\nJe vous prie d'agréer, Madame, Monsieur, mes salutations distinguées.`), true);
  assert.equal(hasFormalRegisterViolation(`Madame, Monsieur,\nUn passant a crié « tu exagères ».\n${filler}\nJe vous prie d'agréer, Madame, Monsieur, mes salutations distinguées.`), false);

  const capped = applyEssayGridCaps(
    sanitizeEssayFeedback(high, new Set()),
    { genre: "courrier", text: `Bonjour Monsieur,\n${filler}\nMerci beaucoup.`, minWords: 250 },
  );
  assert.equal(capped.scores.socio, 1);
  assert.equal(capped.flags?.registerViolation, true);
  // Flags survive backup round-trip without duplicating notes
  const round = sanitizeEssays([{ id: "e-cap", task: "courrier-voitures", text: "Madame, Monsieur, ...", created: 1, fb: capped }]);
  assert.deepEqual(round?.[0].fb?.flags, { registerViolation: true });
});

test("PE-4 isolates B1 and B2 level labels and trend partitions", () => {
  assert.equal(levelLabel(1, "B1"), "低于 B1");
  assert.equal(levelLabel(3, "B1"), "B1");
  assert.equal(levelLabel(5, "B1"), "B1+");
  assert.equal(levelLabel(3, "B2"), "B2");
  assert.equal(levelLabel(5, "B2"), "B2+");

  const fb = sanitizeEssayFeedback({ scores: { task: 3, coherence: 3, socio: 3, lexique: 3, morpho: 3 } }, new Set());
  const aiB1 = buildTask(
    {
      level: "B1",
      genre: "forum",
      title: "AI B1 题",
      situation: "s",
      consigne: "c",
      points: ["a", "b"],
      plan: [
        { zh: "1", fr: "1" },
        { zh: "2", fr: "2" },
        { zh: "3", fr: "3" },
      ],
      phrases: [{ fr: "x", zh: "y" }],
    },
    "ai-b1",
  )!;
  const { b1, b2 } = splitEssaysByLevel(
    [
      { id: "e1", task: "mail-invitation", text: "a", created: 20, fb },
      { id: "e2", task: "courrier-voitures", text: "b", created: 10, fb },
      { id: "e3", task: "ai-b1", text: "c", created: 30, fb },
      { id: "e4", task: "essai-ecrans", text: "d", created: 5 },
    ],
    [...ESSAY_TASKS, aiB1],
  );
  assert.deepEqual(b1.map((e) => e.id), ["e1", "e3"]);
  assert.deepEqual(b2.map((e) => e.id), ["e2"]);
  assert.equal(essayLevelOf(b1[1], [...ESSAY_TASKS, aiB1]), "B1");
});
