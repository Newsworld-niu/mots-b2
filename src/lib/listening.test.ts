import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";
import { countWords } from "./essay";
import { exercisePoints, FORM_SPEC, PAPER, sanitizeExercise, speechChunks, type CompExercise } from "./exam";
import { PRESET_PAPERS } from "./exam-presets";
import { ACCENTS, causeFromSkill, checkDictation, missStats, paragraphsOf, parseClock, pickVoices, playerFor, qualityIssues, resolveMaterialUrl, sanitizeMisses, sanitizeSources, sentencesOf, skillStats } from "./listening";
import { PREBUILT_REAL_SOURCES, realPresetQuiz } from "./real-presets";
import { newWordsOf } from "./transcript";
import type { ReadSentence, ReadToken } from "./reader";
import { sanitizePaper, wrongKeys } from "../store/exam-bank";

const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

test("pickVoices: >=3 distinct voices, first two of different sexes, france mode stays in France", () => {
  for (let k = 0; k < 50; k++) {
    const v = pickVoices("france");
    assert.deepEqual(v.accents, ["fr-FR"]);
    assert.ok(v.voices.length >= 3);
    assert.equal(new Set(v.voices).size, v.voices.length);
    const fr = ACCENTS[0];
    const sexes = v.voices.map((x) => (fr.f.includes(x) ? "f" : fr.m.includes(x) ? "m" : "?"));
    assert.ok(!sexes.includes("?"));
    assert.notEqual(sexes[0], sexes[1]);
  }
});

test("pickVoices: mixed mode can pick other accents, and lists them", () => {
  // other accent for the first speaker (0.1 < 0.5), Canada, female, same accent for the second (0.9 ≥ 0.4)
  const v = pickVoices("mixed", seq(0.1, 0, 0.1, 0.9, 0, 0));
  assert.deepEqual(v.accents, ["fr-CA"]);
  assert.ok(v.voices.every((x) => x.startsWith("fr-CA")));
  const seen = new Set<string>();
  for (let k = 0; k < 300; k++) pickVoices("mixed").accents.forEach((a) => seen.add(a));
  assert.ok(seen.size >= 3);
});

test("sentencesOf strips speaker labels and joins very short sentences", () => {
  const u = sentencesOf("Hélène Martin : Bonjour. Aujourd'hui on parle des tiers-lieux.\nJulien : Oui. C'est un vrai phénomène, euh, récent.");
  assert.deepEqual(u, [
    { text: "Bonjour. Aujourd'hui on parle des tiers-lieux.", who: "Hélène Martin" },
    { text: "Oui. C'est un vrai phénomène, euh, récent.", who: "Julien" },
  ]);
  assert.deepEqual(sentencesOf("Un texte sans locuteur ici. Deuxième phrase assez longue."), [{ text: "Un texte sans locuteur ici." }, { text: "Deuxième phrase assez longue." }]);
});

test("paragraphsOf groups one speaker's sentences up to the word limit", () => {
  const text = "A : Une phrase de cinq mots. Une autre phrase de cinq. Et encore une de cinq.\nB : Moi je réponds ici maintenant.";
  const p = paragraphsOf(text, 12);
  assert.equal(p.length, 3);
  assert.equal(p[0].who, "A");
  assert.equal(p[0].text, "Une phrase de cinq mots. Une autre phrase de cinq.");
  assert.equal(p[2].who, "B");
});

test("checkDictation aligns words: one missing word does not shift the rest", () => {
  const r = checkDictation("on sait pas vraiment", "On ne sait pas vraiment.");
  assert.deepEqual(
    r.words.map((w) => w.mark),
    ["ok", "missing", "ok", "ok", "ok"],
  );
  assert.equal(r.score, 80);
});

test("checkDictation: accents count half, misspellings are wrong, extra words listed", () => {
  const r = checkDictation("la societe change trs vite vite", "La société change très vite.");
  assert.deepEqual(
    r.words.map((w) => w.mark),
    ["ok", "accent", "ok", "wrong", "ok"],
  );
  assert.deepEqual(r.extra, ["vite"]);
  assert.equal(r.score, Math.round((3.5 / 5) * 100));
  assert.equal(checkDictation("", "").score, 100);
  assert.equal(checkDictation("Qu'est-ce qu'il dit ?", "qu'est-ce qu'il dit").score, 100);
});

test("sanitizeMisses keeps valid entries only", () => {
  assert.equal(sanitizeMisses("x"), undefined);
  assert.equal(sanitizeMisses([]), undefined);
  const out = sanitizeMisses([
    { at: 1, part: "listen", cause: "heard", skill: "detail", q: "0-3" },
    { at: 2, part: "speak", cause: "heard" },
    { at: 3, part: "read", cause: "nope" },
    { at: 4, part: "read", cause: "vocab", skill: "bogus", q: "x" },
  ]);
  assert.deepEqual(out, [
    { at: 1, part: "listen", cause: "heard", skill: "detail", q: "0-3" },
    { at: 4, part: "read", cause: "vocab" },
  ]);
});

test("missStats and skillStats count and sort", () => {
  const m = [
    { at: 1, part: "listen" as const, cause: "heard" as const },
    { at: 2, part: "listen" as const, cause: "paraphrase" as const },
    { at: 3, part: "listen" as const, cause: "paraphrase" as const },
    { at: 4, part: "read" as const, cause: "vocab" as const },
  ];
  assert.deepEqual(missStats(m, "listen"), [
    { cause: "paraphrase", n: 2, share: 67 },
    { cause: "heard", n: 1, share: 33 },
  ]);
  assert.equal(missStats(m).length, 3);
  const s = skillStats([{ skill: "detail", right: true }, { skill: "detail", right: false }, { right: false }]);
  assert.deepEqual([...s.entries()], [["detail", { n: 2, right: 1 }]]);
  assert.equal(causeFromSkill("opinion"), "inference");
  assert.equal(causeFromSkill("negation"), "negation");
  assert.equal(causeFromSkill(undefined), undefined);
});

const ex = (answers: number[], right: (k: number) => string, doc = "Le maire de la ville a décidé de fermer la piscine municipale pendant tout l'été."): CompExercise =>
  sanitizeExercise({ title: "t", docs: [{ text: doc, zh: "" }], questions: answers.map((a, k) => ({ q: `Question ${k} ?`, options: [0, 1, 2].map((j) => (j === a ? right(k) : `option ${k}-${j}`)), answer: a, why: "", difficulty: 3 })) }, "long", "x");

test("qualityIssues flags copied answers and one answer position", () => {
  assert.deepEqual(qualityIssues(ex([0, 1, 2, 0, 1, 2, 0], (k) => `réponse reformulée ${k}`)), []);
  assert.equal(qualityIssues(ex([0, 1, 2, 0, 1, 2, 0], (k) => (k < 2 ? "a décidé de fermer la piscine" : `réponse ${k}`))).length, 1);
  assert.equal(qualityIssues(ex([1, 1, 1, 1, 1, 1, 1], (k) => `réponse ${k}`)).length, 1);
});

test("preset papers are >=2 full 25-pt listening and >=3 full 25-pt reading papers (incl. parallel Vrai/Faux + short) meeting B2 word counts and quality gate", () => {
  const listen = PRESET_PAPERS.filter((p) => p.kind === "listen");
  const read = PRESET_PAPERS.filter((p) => p.kind === "read");
  assert.ok(listen.length >= 2);
  assert.ok(read.length >= 3);
  const parallel = PRESET_PAPERS.find((p) => p.id === "preset-read-3");
  assert.ok(parallel);
  assert.ok(parallel.exs.some((ex) => ex.questions.some((q) => q.qType === "vf" && Boolean(q.quote))));
  assert.ok(parallel.exs.some((ex) => ex.questions.some((q) => q.qType === "short" && Boolean(q.accepted?.length))));
  assert.equal(new Set(PRESET_PAPERS.map((p) => p.id)).size, PRESET_PAPERS.length);
  for (const p of PRESET_PAPERS) {
    assert.equal(p.src, "preset");
    assert.deepEqual(p.exs.map((e) => e.form), PAPER[p.kind], p.id);
    assert.equal(p.exs.reduce((n, e) => n + exercisePoints(e), 0), 25, p.id);
    for (const e of p.exs) {
      assert.equal(e.questions.length, FORM_SPEC[e.form].questions, p.id);
      assert.equal(exercisePoints(e), FORM_SPEC[e.form].points, p.id);
      assert.equal(e.docs.length, e.form === "short" ? 3 : 1, p.id);
      assert.ok(e.docs.every((d) => d.zh.trim().length > 50), p.id);
      for (const d of e.docs) {
        const wc = countWords(d.text);
        if (p.kind === "listen" && e.form === "long") assert.ok(wc >= 450 && wc <= 550, `${p.id} ${e.title}: ${wc} words`);
        if (p.kind === "listen" && e.form === "short") assert.ok(wc >= 175 && wc <= 225, `${p.id} ${e.title}: ${wc} words`);
        if (p.kind === "read" && e.form === "long") assert.ok(wc >= 450 && wc <= 600, `${p.id} ${e.title}: ${wc} words`);
        if (p.kind === "read" && e.form === "opinions") assert.ok(wc >= 390 && wc <= 480, `${p.id} ${e.title}: ${wc} words`);
      }
      assert.deepEqual(qualityIssues(e), [], p.id);
      assert.ok(e.questions.every((q) => q.skill), p.id);
      if (e.form === "short") assert.deepEqual(e.questions.map((q) => q.doc), [0, 0, 1, 1, 2, 2]);
      if (e.form === "opinions") for (const j of [0, 1, 2]) assert.equal(e.questions.filter((q) => q.answer === j).length, 2, p.id);
    }
    if (p.kind === "listen") assert.ok(p.exs.every((e) => e.docs.every((d) => speechChunks(d.text).length > 1)));
    assert.deepEqual(sanitizePaper(p)?.exs, p.exs);
  }
});

test("sanitizePaper rejects junk and keeps stored points; wrongKeys follows the questions asked", () => {
  assert.equal(sanitizePaper(null), null);
  assert.equal(sanitizePaper({ id: "a", kind: "speak", created: 1, exs: [] }), null);
  const e = ex([0, 1, 2, 0, 1, 2, 0], (k) => `réponse ${k}`);
  const p = sanitizePaper({ id: "p1", kind: "listen", level: "B9", created: 5, src: "evil", style: "loud", exs: [e], starred: "yes" });
  assert.ok(p);
  assert.equal(p.level, "B2");
  assert.equal(p.src, "ai");
  assert.equal(p.style, undefined);
  assert.equal(p.starred, undefined);
  assert.deepEqual(
    p.exs[0].questions.map((q) => q.pts),
    e.questions.map((q) => q.pts),
  );
  const picked = { "0-0": 0, "0-1": 0, "0-2": 2 };
  assert.deepEqual(wrongKeys(p, { at: 1, picked, score: 0, total: 9 }), ["0-1", "0-3", "0-4", "0-5", "0-6"]);
  assert.deepEqual(wrongKeys(p, { at: 1, picked, score: 0, total: 9, asked: ["0-1", "0-2"] }), ["0-1"]);
  assert.deepEqual(wrongKeys(p, undefined), []);
  // Parallel Vrai/Faux + citation wrongKeys check
  const pVf = sanitizePaper(PRESET_PAPERS.find((x) => x.id === "preset-read-3"));
  assert.ok(pVf);
  const vfIdx = pVf.exs[0].questions.findIndex((q) => q.qType === "vf");
  const vfQ = pVf.exs[0].questions[vfIdx];
  assert.ok(wrongKeys(pVf, { at: 1, picked: { [`0-${vfIdx}`]: vfQ.answer }, typed: {}, score: 0, total: 25 }).includes(`0-${vfIdx}`));
  assert.ok(!wrongKeys(pVf, { at: 1, picked: { [`0-${vfIdx}`]: vfQ.answer }, typed: { [`0-${vfIdx}`]: vfQ.quote ?? "" }, score: 0, total: 25 }).includes(`0-${vfIdx}`));
});

test("parseClock, sanitizeSources and playerFor", () => {
  assert.equal(parseClock("1:05"), 65);
  assert.equal(parseClock("1:02:03"), 3723);
  assert.equal(parseClock("90"), 90);
  assert.ok(Number.isNaN(parseClock("abc")));
  assert.equal(sanitizeSources([{ id: "bad", url: "https://x", created: 1 }]), undefined);
  const s = sanitizeSources([
    { id: "s-abcd12", url: "https://rfi.fr/x", created: 1, start: 30, end: 10, transcript: "  ", title: "" },
    { id: "rfi-20261120", url: "materials/rfi/rfi-jff-20261120.mp3", pdfUrl: "materials/rfi/rfi-jff-20261120.txt", presetId: "rfi-jff-20261120", created: 2, start: 0, end: 0 },
    { id: "s-local1", url: "idb:audio:s-local1", pdfUrl: "idb:pdf:s-local1", created: 3, start: 0, end: 120 },
    { id: "s-zz99zz", url: "javascript:alert(1)", created: 1 },
  ]);
  assert.deepEqual(s, [
    { id: "s-abcd12", title: "https://rfi.fr/x", url: "https://rfi.fr/x", start: 30, end: 30, created: 1 },
    { id: "rfi-20261120", title: "materials/rfi/rfi-jff-20261120.mp3", url: "materials/rfi/rfi-jff-20261120.mp3", pdfUrl: "materials/rfi/rfi-jff-20261120.txt", presetId: "rfi-jff-20261120", start: 0, end: 0, created: 2 },
    { id: "s-local1", title: "idb:audio:s-local1", url: "idb:audio:s-local1", pdfUrl: "idb:pdf:s-local1", start: 0, end: 120, created: 3 },
  ]);
  assert.deepEqual(playerFor("https://www.youtube.com/watch?v=abcDEF12345", 60, 120), { kind: "youtube", src: "https://www.youtube-nocookie.com/embed/abcDEF12345?start=60&end=120&rel=0" });
  assert.deepEqual(playerFor("https://x.org/a/file.mp3", 5, 0), { kind: "media", src: "https://x.org/a/file.mp3#t=5", video: false });
  assert.deepEqual(playerFor("materials/rfi/rfi-jff-20261120.mp3", 10, 90, "/words/"), { kind: "media", src: "/words/materials/rfi/rfi-jff-20261120.mp3#t=10,90", video: false });
  assert.deepEqual(playerFor("idb:audio:s-local1", 0, 120), { kind: "idb", key: "audio:s-local1", start: 0, end: 120 });
  assert.equal(resolveMaterialUrl("materials/rfi/a.txt", "/words/"), "/words/materials/rfi/a.txt");
  assert.deepEqual(playerFor("https://www.radiofrance.fr/franceculture/podcasts/x", 0, 60), { kind: "page" });
  assert.deepEqual(playerFor("not a url", 0, 0), { kind: "page" });
});

test("PREBUILT_REAL_SOURCES and realPresetQuiz ship 6 verified RFI episodes with public assets and 7-QCM quizzes", () => {
  assert.equal(PREBUILT_REAL_SOURCES.length, 6);
  for (const p of PREBUILT_REAL_SOURCES) {
    assert.ok(fs.existsSync(path.resolve("public", p.url)), `missing ${p.url}`);
    if (p.pdfUrl) assert.ok(fs.existsSync(path.resolve("public", p.pdfUrl)), `missing ${p.pdfUrl}`);
    assert.ok((p.transcript ?? "").length > 2000);
    const quiz = realPresetQuiz(p.presetId);
    assert.ok(quiz);
    assert.equal(quiz.questions.length, 7);
    assert.equal(quiz.questions.reduce((n, q) => n + (q.pts ?? 1), 0), 9);
    assert.deepEqual(qualityIssues(quiz), []);
  }
});

test("newWordsOf lists unlearned words once, with counts", () => {
  const tok = (t: string, status: ReadToken["status"], id?: string, w?: string): ReadToken => ({ t, s: 0, e: t.length, status, ...(id ? { id } : {}), ...(w ? { hit: { w } as ReadToken["hit"] } : {}) }) as ReadToken;
  const sent = (text: string, tokens: ReadToken[]): ReadSentence => ({ text, tokens }) as ReadSentence;
  const paras = [
    [sent("La subvention diminue.", [tok("La", "function"), tok("subvention", "new", "w1"), tok("diminue", "new", "w2")])],
    [sent("Une subvention, un bourg.", [tok("subvention", "new", "w1"), tok("bourg", "new", undefined, "bourg"), tok("Paris", "name")])],
  ];
  const out = newWordsOf(paras, (id) => id === "w2");
  assert.deepEqual(
    out.map((w) => [w.tok.t, w.n, w.atlas, w.sentence]),
    [
      ["subvention", 2, true, "La subvention diminue."],
      ["bourg", 1, false, "Une subvention, un bourg."],
    ],
  );
});
