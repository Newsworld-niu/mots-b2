import assert from "node:assert/strict";
import { test } from "node:test";
import { countWords, ESSAY_TASKS } from "./essay";
import { ESSAY_MODELS, modelEssayFor } from "./essay-models";
import { assessDebateEscalation, checkProblematiqueDraft, clock, examReadiness, exercisePoints, FORM_SPEC, isSpeakingTyped, outOf25, PAPER, PO_STANDARD_CONSIGNE, PROBLEMATIQUE_TIPS, realScore25, sanitizeExamLog, sanitizeExercise, sanitizeSpeakingFeedback, sanitizeSubject, speakerIndex, speechChunks, speechTurns, SPEAKING_SUBJECTS, TALK_PLAN, TOPICS, topicOf, weigh } from "./exam";
import { SPEAKING_PRESETS, speakingFollowUpsOf, speakingPresetOf } from "./speaking-presets";

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

test("sanitizeExamLog, outOf25, realScore25, examReadiness, isSpeakingTyped and clock", () => {
  const ok = { part: "listen" as const, what: "travail", score: 4, total: 6, at: 1 };
  const essay = { part: "essay" as const, what: "courrier-voitures", score: 17, total: 25, at: 2 };
  const speakTyped = { part: "speak" as const, what: "s-ia", score: 15, total: 25, at: 3, typed: true };
  assert.deepEqual(sanitizeExamLog([ok, essay, speakTyped, { ...ok, part: "x" }, { ...ok, score: 9 }, { ...ok, total: 0 }, null]), [ok, essay, speakTyped]);
  assert.equal(sanitizeExamLog([]), undefined);
  assert.equal(outOf25({ score: 4, total: 6 }), 16.7);
  assert.equal(outOf25({ score: 13.5, total: 20 }), 16.9);
  assert.equal(realScore25({ part: "listen", score: 4, total: 6 }), 16.7);
  assert.equal(realScore25({ part: "speak", score: 14, total: 20 }), null);
  assert.equal(realScore25({ part: "speak", score: 18, total: 25, typed: true }), null);
  assert.equal(realScore25({ part: "speak", score: 18, total: 25 }), 18);
  assert.equal(realScore25({ part: "essay", score: 17, total: 25 }), 17);
  assert.equal(isSpeakingTyped({ monologueVoice: false, voiceMonologueWords: 0, totalMonologueWords: 300, answeredTurns: 0, debateVoice: false }), true);
  assert.equal(isSpeakingTyped({ monologueVoice: true, voiceMonologueWords: 280, totalMonologueWords: 300, answeredTurns: 3, debateVoice: false }), true);
  assert.equal(isSpeakingTyped({ monologueVoice: true, voiceMonologueWords: 50, totalMonologueWords: 300, answeredTurns: 0, debateVoice: false }), true);
  assert.equal(isSpeakingTyped({ monologueVoice: true, voiceMonologueWords: 280, totalMonologueWords: 300, answeredTurns: 3, debateVoice: true }), false);

  // Full 4-part readiness: total /100, gap to 75, and <5/25 elimination guard
  const r1 = examReadiness([
    { part: "listen", what: "p1", score: 20, total: 25, at: 10 },
    { part: "read", what: "p1", score: 18, total: 25, at: 11 },
    { part: "essay", what: "t1", score: 19, total: 25, at: 12 },
    { part: "speak", what: "s1", score: 4, total: 25, at: 13 },
  ]);
  assert.equal(r1.completed, 4);
  assert.equal(r1.exact100, 61);
  assert.equal(r1.gapToTarget, 14);
  assert.equal(r1.passed, false);
  assert.deepEqual(r1.eliminated.map((p) => p.part), ["speak"]);

  const r2 = examReadiness([
    { part: "listen", what: "p1", score: 20, total: 25, at: 10 },
    { part: "read", what: "p1", score: 19, total: 25, at: 11 },
    { part: "essay", what: "t1", score: 18, total: 25, at: 12 },
    { part: "speak", what: "s1", score: 19, total: 25, at: 13 },
  ]);
  assert.equal(r2.exact100, 76);
  assert.equal(r2.gapToTarget, 0);
  assert.equal(r2.passed, true);
  assert.equal(r2.eliminated.length, 0);
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

test("SYS-4: all 8 built-in B2 essay models (>=250 words) and 12 speaking preset follow-ups exist", () => {
  const b2Ids = ESSAY_TASKS.filter((t) => t.level === "B2").map((t) => t.id);
  assert.equal(b2Ids.length, 8);
  for (const id of b2Ids) {
    const m = modelEssayFor(id);
    assert.ok(m, id);
    assert.ok(m.wordCount >= 250, `${id} has ${m.wordCount} words`);
    assert.ok(m.paragraphs.length >= 4 && m.paragraphs.every((p) => p.fr && p.zhNote), id);
    assert.equal(m.unverified, true);
  }
  assert.equal(ESSAY_MODELS.length, 8);
  assert.equal(SPEAKING_PRESETS.length, SPEAKING_SUBJECTS.length);
  for (const s of SPEAKING_SUBJECTS) {
    const sp = speakingPresetOf(s.id);
    assert.ok(sp, s.id);
    assert.ok(sp.problematique && sp.outline.length >= 3, s.id);
    assert.ok(speakingFollowUpsOf(s.id).length >= 6, s.id);
    assert.equal(sp.unverified, true);
  }
});

test("TALK_PLAN, PROBLEMATIQUE_TIPS and checkProblematiqueDraft catch copy-paste or non-question drafts", () => {
  assert.ok(TALK_PLAN.length >= 6 && PROBLEMATIQUE_TIPS.length >= 4);
  const doc = SPEAKING_SUBJECTS[0].doc;
  const good = checkProblematiqueDraft("Dans quelle mesure les entreprises doivent-elles encadrer le travail à distance sans nuire à la cohésion des équipes ?", doc);
  assert.equal(good.ok, true);
  const badCopy = checkProblematiqueDraft("Plusieurs grands groupes français rappellent désormais leurs salariés au bureau.", doc);
  assert.equal(badCopy.ok, false);
  assert.ok(badCopy.notes.length >= 2);
});
