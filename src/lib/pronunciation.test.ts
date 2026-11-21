import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregate, assessmentHeader, overall, parseAssessment, phonoLevel, weakWords, type PronResult } from "./pronunciation.ts";

const answer = {
  RecognitionStatus: "Success",
  Offset: 500000,
  Duration: 120000000,
  DisplayText: "Je pense que le télétravail est une bonne chose.",
  NBest: [
    {
      Confidence: 0.9,
      Display: "Je pense que le télétravail est une bonne chose.",
      PronunciationAssessment: { AccuracyScore: 82, FluencyScore: 74, ProsodyScore: 68.5, CompletenessScore: 100, PronScore: 78.2 },
      Words: [
        { Word: "je", PronunciationAssessment: { AccuracyScore: 95, ErrorType: "None" } },
        { Word: "télétravail", PronunciationAssessment: { AccuracyScore: 41, ErrorType: "Mispronunciation" } },
        { Word: "est", PronunciationAssessment: { AccuracyScore: 90, ErrorType: "UnexpectedBreak" } },
      ],
    },
  ],
};

test("assessmentHeader is base64 JSON of an unscripted, prosody-enabled, hundred-mark assessment", () => {
  const json = JSON.parse(Buffer.from(assessmentHeader(), "base64").toString("utf8"));
  assert.equal(json.ReferenceText, "");
  assert.equal(json.GradingSystem, "HundredMark");
  assert.equal(json.Granularity, "Word");
  assert.equal(json.EnableProsodyAssessment, true);
  // non-ASCII reference text survives
  assert.equal(JSON.parse(Buffer.from(assessmentHeader("Ça été"), "base64").toString("utf8")).ReferenceText, "Ça été");
});

test("parseAssessment reads scores, words and duration of a detailed answer", () => {
  const r = parseAssessment(answer)!;
  assert.equal(r.accuracy, 82);
  assert.equal(r.fluency, 74);
  assert.equal(r.prosody, 68.5);
  assert.equal(r.completeness, 100);
  assert.equal(r.pron, 78.2);
  assert.equal(r.seconds, 12);
  assert.equal(r.text, answer.DisplayText);
  assert.deepEqual(r.words[1], { word: "télétravail", accuracy: 41, error: "Mispronunciation" });
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

test("overall, phonoLevel and weakWords", () => {
  assert.equal(overall(part(1, { pron: 77 })), 77);
  assert.equal(overall(part(1, { accuracy: 80, fluency: 60 })), 70);
  assert.equal(overall(part(1, {})), null);
  assert.equal(phonoLevel(part(1, { pron: 90 })), 5);
  assert.equal(phonoLevel(part(1, { pron: 72 })), 3);
  assert.equal(phonoLevel(part(1, { pron: 50 })), 1);
  assert.equal(phonoLevel(part(1, { pron: 10 })), 0);
  assert.equal(phonoLevel(null), null);
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
