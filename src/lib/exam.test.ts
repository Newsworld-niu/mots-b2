import assert from "node:assert/strict";
import { test } from "node:test";
import { countWords, ESSAY_TASKS } from "./essay";
import { assessDebateEscalation, clock, exercisePoints, FORM_SPEC, outOf25, PAPER, PO_STANDARD_CONSIGNE, sanitizeExamLog, sanitizeExercise, sanitizeSpeakingFeedback, sanitizeSubject, speakerIndex, speechChunks, speechTurns, SPEAKING_SUBJECTS, TOPICS, topicOf, weigh } from "./exam";

test("topics, subjects and essay tasks refer to topics that exist", () => {
  assert.equal(new Set(TOPICS.map((t) => t.id)).size, TOPICS.length);
  assert.ok(TOPICS.every((t) => t.vocab.length >= 8 && t.vocab.every(([fr, zh]) => fr && zh)));
  assert.equal(new Set(SPEAKING_SUBJECTS.map((s) => s.id)).size, SPEAKING_SUBJECTS.length);
  assert.equal(SPEAKING_SUBJECTS.length, 12);
  assert.ok(
    SPEAKING_SUBJECTS.every((s) => {
      const wc = countWords(s.doc);
      return topicOf(s.topic) && wc >= 120 && wc <= 160 && s.source && !/[\u4e00-\u9fff]/.test(s.title + s.doc) && !!s.ask;
    }),
  );
  assert.ok(PO_STANDARD_CONSIGNE.length > 40 && !/[\u4e00-\u9fff]/.test(PO_STANDARD_CONSIGNE));
  assert.ok(ESSAY_TASKS.every((t) => !t.topic || topicOf(t.topic)));
  assert.ok(ESSAY_TASKS.filter((t) => t.doc).length >= 3);
});

test("speechChunks drops speaker labels, distinguishes 3+ speakers, resolves first names, and keeps pieces under the limit", () => {
  const text = `Julie : Bonjour et bienvenue. Aujourd'hui, nous parlons du télétravail !\nMarc Durand : Merci. C'est un sujet important.\nJulie : Alors, commençons.\n\n${"Une phrase assez longue pour remplir, ".repeat(20)}fin.`;
  const chunks = speechChunks(text, 120);
  assert.deepEqual(chunks.slice(0, 3), [
    { t: "Bonjour et bienvenue. Aujourd'hui, nous parlons du télétravail !", who: 0 },
    { t: "Merci. C'est un sujet important.", who: 1 },
    { t: "Alors, commençons.", who: 0 },
  ]);
  assert.ok(chunks.length > 5 && chunks.every((c) => c.t.length <= 120 && c.t.trim() === c.t && c.t));
  assert.ok(!chunks.some((c) => c.t.includes("Julie :")));
  assert.deepEqual(speechChunks("Il est 8 h : tout le monde dort."), [{ t: "Il est 8 h : tout le monde dort.", who: 0 }]);
  assert.deepEqual(speechChunks("  \n "), []);

  // 3+ distinct speakers & first-name follow-up mapping
  const panel = `Hélène Martin : Bonjour.\nJulien Ferrand : Salut.\nClaire Moreau : Enchantée.\nHélène : Commençons.\nPaul : Un mot.`;
  assert.deepEqual(
    speechChunks(panel).map((c) => c.who),
    [0, 1, 2, 0, 3],
  );
  const turns = speechTurns("A : Un.\nA : Deux.\nB : Trois.");
  assert.deepEqual(turns, [
    { t: "Un. Deux.", who: 0 },
    { t: "Trois.", who: 1 },
  ]);
  const s: string[] = [];
  assert.equal(speakerIndex(s, "Marie Curie"), 0);
  assert.equal(speakerIndex(s, "Marie"), 0);
  assert.equal(speakerIndex(s, "Pierre"), 1);
});

test("weigh shares the points of an exercise as the official paper does", () => {
  const long = weigh([3, 1, 5, 4, 1, 5, 2], FORM_SPEC.long.points);
  assert.deepEqual(long, [1, 0.5, 2, 1.5, 0.5, 2.5, 1]);
  assert.equal(long.reduce((a, b) => a + b, 0), 9);
  const short = weigh([3, 3, 3, 3, 3, 3], FORM_SPEC.short.points);
  assert.deepEqual(short, [0.5, 0.5, 1, 1.5, 1.5, 2]);
  assert.equal(short.reduce((a, b) => a + b, 0), 7);
  // an incomplete exercise: one point each
  assert.deepEqual(weigh([1, 5, 3], 3), [1, 1, 1]);
  assert.deepEqual(PAPER.listen.map((f) => FORM_SPEC[f].points), [9, 9, 7]);
  assert.deepEqual(PAPER.read.map((f) => FORM_SPEC[f].points), [9, 9, 7]);
});

test("sanitizeExercise keeps three-option questions and weighs them", () => {
  const q = (k: number, doc = 0) => ({ doc, q: `Q${k} ?`, options: ["a", "b", "c"], answer: k % 3, why: "因为", difficulty: k + 1 });
  const ex = sanitizeExercise({ intro: "Vous écoutez…", title: " « Le titre » ", docs: [{ text: "Un.", zh: "一" }, { text: "Deux.", zh: "二" }, { text: "Trois.", zh: "三" }], questions: [q(0, 2), q(1, 0), q(2, 1), q(3, 0), q(4, 1), q(5, 2), { ...q(6), options: ["a", "a", "c"] }] }, "short", "travail");
  assert.equal(ex.title, "Le titre");
  assert.equal(ex.docs.length, 3);
  assert.deepEqual(ex.questions.map((x) => x.doc), [0, 0, 1, 1, 2, 2]);
  assert.equal(exercisePoints(ex), 7);
  const long = sanitizeExercise({ docs: [{ text: "Texte.", zh: "" }, { text: "Autre.", zh: "" }], questions: [q(0), { ...q(1), options: ["a", "b", "c", "d"] }, { ...q(2), answer: 3 }] }, "long", "sante");
  assert.equal(long.docs.length, 1);
  assert.equal(long.questions.length, 2);
  assert.deepEqual(sanitizeExercise(null, "long", "x").questions, []);
});

test("sanitizeSpeakingFeedback uses the four criteria an AI can mark, at the grid's levels", () => {
  const fb = sanitizeSpeakingFeedback({ scores: { monologue: 4, interaction: 2, lexique: 5, morpho: 0.4, phono: 5 } }, new Set());
  assert.deepEqual(fb.scores, { monologue: 3, interaction: 1, lexique: 5, morpho: 0 });
  assert.equal(sanitizeSubject({ title: "T ?", doc: "x".repeat(320), ask: "" }, "travail")?.topic, "travail");
  assert.equal(sanitizeSubject({ title: "T ?", doc: "court" }, "travail"), null);
});

test("sanitizeExamLog, outOf25 and clock", () => {
  const ok = { part: "listen", what: "travail", score: 4, total: 6, at: 1 };
  assert.deepEqual(sanitizeExamLog([ok, { ...ok, part: "x" }, { ...ok, score: 9 }, { ...ok, total: 0 }, null]), [ok]);
  assert.equal(sanitizeExamLog([]), undefined);
  assert.equal(outOf25({ score: 4, total: 6 }), 16.7);
  assert.equal(outOf25({ score: 13.5, total: 20 }), 16.9);
  assert.equal(clock(245), "4:05");
  assert.equal(clock(-3), "0:00");
});

test("assessDebateEscalation detects short, evasive, unjustified, repetitive replies and strict mode", () => {
  assert.equal(assessDebateEscalation([], 0, false).level, 1);
  const shortEvasive = assessDebateEscalation([{ q: "Pourquoi ?", a: "Je ne sais pas, peut-être." }], 1, false);
  assert.equal(shortEvasive.level, 2);
  assert.ok(shortEvasive.reasons.includes("short_answer"));
  assert.ok(shortEvasive.reasons.includes("evasive"));

  const noJustify = assessDebateEscalation([{ q: "Votre avis ?", a: "Les entreprises préfèrent garder leurs employés dans les grands bureaux modernes toute la semaine." }], 4, false);
  assert.ok(noJustify.reasons.includes("no_justification"));
  assert.equal(noJustify.level, 3);

  const rep = assessDebateEscalation(
    [
      { q: "Q1", a: "Le télétravail permet aux salariés de gagner du temps et réduit le stress quotidien dans les transports parce que les trajets sont longs." },
      { q: "Q2", a: "En effet, le télétravail permet aux salariés de gagner du temps et réduit le stress quotidien dans les transports." },
    ],
    4,
    true,
  );
  assert.ok(rep.reasons.includes("repetitive"));
  assert.ok(rep.reasons.includes("strict_mode"));
  assert.equal(rep.level, 3);
});
