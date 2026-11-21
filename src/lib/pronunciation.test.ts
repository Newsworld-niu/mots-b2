import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregate, assessmentHeader, combineSpeakingProns, overall, parseAssessment, phonemeInsights, phonoGateInfo, phonoLevel, sampleDebateTakes, weakWords, type PronResult } from "./pronunciation.ts";

const answer = {
  RecognitionStatus: "Success",
  Offset: 500000,
  Duration: 120000000,
  DisplayText: "Je pense que les amis travaillent.",
  NBest: [
    {
      Confidence: 0.9,
      Display: "Je pense que les amis travaillent.",
      PronunciationAssessment: { AccuracyScore: 82, FluencyScore: 74, ProsodyScore: 68.5, CompletenessScore: 100, PronScore: 78.2 },
      Words: [
        { Word: "je", PronunciationAssessment: { AccuracyScore: 95, ErrorType: "None" }, Phonemes: [{ Phoneme: "ʒ", PronunciationAssessment: { AccuracyScore: 96 } }] },
        { Word: "les", PronunciationAssessment: { AccuracyScore: 88, ErrorType: "None" } },
        {
          Word: "amis",
          PronunciationAssessment: { AccuracyScore: 52, ErrorType: "UnexpectedBreak" },
          Phonemes: [{ Phoneme: "a", PronunciationAssessment: { AccuracyScore: 52 } }],
        },
        {
          Word: "travaillent",
          PronunciationAssessment: { AccuracyScore: 41, ErrorType: "Mispronunciation" },
          Phonemes: [{ Phoneme: "ʁ", PronunciationAssessment: { AccuracyScore: 40 } }],
        },
      ],
    },
  ],
};

test("assessmentHeader is base64 JSON of Phoneme-granularity IPA prosody-enabled assessment", () => {
  const json = JSON.parse(Buffer.from(assessmentHeader(), "base64").toString("utf8"));
  assert.equal(json.ReferenceText, "");
  assert.equal(json.GradingSystem, "HundredMark");
  assert.equal(json.Granularity, "Phoneme");
  assert.equal(json.PhonemeAlphabet, "IPA");
  assert.equal(json.EnableMiscue, false);
  assert.equal(json.EnableProsodyAssessment, true);
  // non-ASCII reference text survives and enables miscue check for scripted shadowing
  const scripted = JSON.parse(Buffer.from(assessmentHeader("Ça été"), "base64").toString("utf8"));
  assert.equal(scripted.ReferenceText, "Ça été");
  assert.equal(scripted.EnableMiscue, true);
});

test("parseAssessment reads scores, words, phonemes and duration of a detailed answer", () => {
  const r = parseAssessment(answer)!;
  assert.equal(r.accuracy, 82);
  assert.equal(r.fluency, 74);
  assert.equal(r.prosody, 68.5);
  assert.equal(r.completeness, 100);
  assert.equal(r.pron, 78.2);
  assert.equal(r.seconds, 12);
  assert.equal(r.text, answer.DisplayText);
  assert.deepEqual(r.words[3], { word: "travaillent", accuracy: 41, error: "Mispronunciation", phonemes: [{ phoneme: "ʁ", accuracy: 40 }] });
});

test("parseAssessment also reads scores flat on the hypothesis, and refuses failures", () => {
  const flat = { RecognitionStatus: "Success", Duration: 0, NBest: [{ Display: "Bonjour", AccuracyScore: 70, FluencyScore: 60, CompletenessScore: 90, PronScore: 72, Words: [{ Word: "bonjour", AccuracyScore: 70, ErrorType: "None" }] }] };
  const r = parseAssessment(flat)!;
  assert.equal(r.accuracy, 70);
  assert.equal(r.prosody, null);
  assert.equal(r.text, "Bonjour");
  assert.equal(r.seconds, 0);
  assert.equal(parseAssessment({ RecognitionStatus: "NoMatch" }), null);
  assert.equal(parseAssessment({ RecognitionStatus: "Success", NBest: [] }), null);
  assert.equal(parseAssessment("nope"), null);
  assert.equal(parseAssessment({ RecognitionStatus: "Success", NBest: [{ AccuracyScore: 300 }] })!.accuracy, 100);
});

const part = (seconds: number, v: Partial<PronResult>): PronResult => ({ pron: null, accuracy: null, fluency: null, prosody: null, completeness: null, text: "", words: [], seconds, ...v });

test("aggregate weights each score by the length of its piece", () => {
  const r = aggregate([part(50, { accuracy: 80, fluency: 60, text: "a", words: [{ word: "x", accuracy: 1, error: "None" }] }), part(10, { accuracy: 20, fluency: null, prosody: 50, text: "b" })])!;
  assert.equal(r.accuracy, 70);
  // a missing score does not count as zero
  assert.equal(r.fluency, 60);
  assert.equal(r.prosody, 50);
  assert.equal(r.completeness, null);
  assert.equal(r.seconds, 60);
  assert.equal(r.text, "a b");
  assert.equal(r.words.length, 1);
  assert.equal(aggregate([]), null);
  // pieces without a duration count equally
  assert.equal(aggregate([part(0, { accuracy: 40 }), part(0, { accuracy: 60 })])!.accuracy, 50);
});

test("overall, tightened phonoLevel with prosody gate, phonemeInsights, sampling and combining", () => {
  assert.equal(overall(part(1, { pron: 77 })), 77);
  assert.equal(overall(part(1, { accuracy: 80, fluency: 60 })), 70);
  assert.equal(overall(part(1, {})), null);
  assert.equal(phonoLevel(part(1, { pron: 90, prosody: 85, accuracy: 88, fluency: 85 })), 5);
  // tightened overall threshold: 85 is now 3, not 5
  assert.equal(phonoLevel(part(1, { pron: 85, prosody: 85 })), 3);
  // standalone prosody gate drops 90/100 with prosody 72 from 5 -> 3
  assert.equal(phonoLevel(part(1, { pron: 90, prosody: 72 })), 3);
  assert.equal(phonoGateInfo(part(1, { pron: 90, prosody: 72 })).gatedBy, "prosody");
  // standalone prosody gate drops 78/100 with prosody 60 from 3 -> 1
  assert.equal(phonoLevel(part(1, { pron: 78, prosody: 60 })), 1);
  assert.equal(phonoLevel(part(1, { pron: 50 })), 1);
  assert.equal(phonoLevel(part(1, { pron: 10 })), 0);
  assert.equal(phonoLevel(null), null);

  const ins = phonemeInsights([
    { word: "tu", accuracy: 55, error: "None", phonemes: [{ phoneme: "y", accuracy: 42 }] },
    { word: "bon", accuracy: 65, error: "None", phonemes: [{ phoneme: "ɔ̃", accuracy: 58 }] },
    { word: "rue", accuracy: 60, error: "None", phonemes: [{ phoneme: "ʁ", accuracy: 48 }, { phoneme: "y", accuracy: 62 }] },
    { word: "les", accuracy: 90, error: "None" },
    { word: "amis", accuracy: 70, error: "UnexpectedBreak" },
  ]);
  assert.deepEqual(new Set(ins.map((x) => x.id)), new Set(["yu", "nasal", "r", "liaison"]));
  assert.ok(ins.find((x) => x.id === "liaison")!.examples.some((e) => e.includes("les‿amis")));

  const sampled = sampleDebateTakes([[0, { seconds: 10 }], [1, { seconds: 1 }], [2, { seconds: 25 }], [3, { seconds: 8 }], [4, { seconds: 30 }], [5, { seconds: 12 }]], 4);
  assert.deepEqual(sampled.map(([i]) => i), [0, 2, 4, 5]);

  const combined = combineSpeakingProns(part(300, { pron: 80, prosody: 80, text: "mono" }), [part(30, { pron: 60, prosody: 60, text: "deb" })])!;
  assert.equal(combined.pron, 72);
  assert.equal(combined.seconds, 330);

  const weak = weakWords([
    { word: "Bon", accuracy: 95, error: "None" },
    { word: "rue", accuracy: 50, error: "Mispronunciation" },
    { word: "Rue", accuracy: 30, error: "Mispronunciation" },
    { word: "mais", accuracy: 88, error: "UnexpectedBreak" },
  ]);
  assert.deepEqual(
    weak.map((w) => [w.word, w.accuracy]),
    [["Rue", 30], ["mais", 88]],
  );
});
