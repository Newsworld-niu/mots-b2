import assert from "node:assert/strict";
import { test } from "node:test";
import { examinerVoicePool, FRENCH_EXAMINER_VOICES, pickBrowserFrenchVoice, pickExaminerVoice, shouldFallbackToAzureStt } from "./speech.ts";

test("examinerVoicePool keeps fr-FR defaults first without duplicates and rotates across turns", () => {
  assert.ok(FRENCH_EXAMINER_VOICES.length >= 8);
  assert.ok(FRENCH_EXAMINER_VOICES.every((v) => v.startsWith("fr-FR-")));
  const pool = examinerVoicePool("fr-FR-EloiseNeural", "fr-CA-JeanNeural");
  // non-fr-FR voice is excluded from the French examiner pool; fr-FR preference leads without duplicates
  assert.equal(pool[0], "fr-FR-EloiseNeural");
  assert.ok(!pool.includes("fr-CA-JeanNeural"));
  assert.equal(new Set(pool).size, pool.length);

  const turns = [0, 1, 2, 3].map((i) => pickExaminerVoice(i, 0));
  assert.equal(new Set(turns).size, 4);
  assert.notEqual(pickExaminerVoice(0, 0), pickExaminerVoice(0, 1));
});

test("pickBrowserFrenchVoice cycles French voices and varies pitch when fewer than two exist", () => {
  const multi = [
    { lang: "en-US", name: "Samantha" },
    { lang: "fr-CA", name: "Amélie" },
    { lang: "fr-FR", name: "Thomas" },
    { lang: "fr_FR", name: "Audrey" },
  ];
  const v0 = pickBrowserFrenchVoice(multi, 0);
  const v1 = pickBrowserFrenchVoice(multi, 1);
  const v2 = pickBrowserFrenchVoice(multi, 2);
  assert.equal(v0.voice?.name, "Thomas");
  assert.equal(v1.voice?.name, "Audrey");
  assert.equal(v2.voice?.name, "Amélie");
  assert.equal(v0.pitch, 1);
  assert.equal(v1.pitch, 1);

  const single = [{ lang: "fr-FR", name: "Thomas" }];
  const s0 = pickBrowserFrenchVoice(single, 0);
  const s1 = pickBrowserFrenchVoice(single, 1);
  assert.equal(s0.voice?.name, "Thomas");
  assert.equal(s1.voice?.name, "Thomas");
  assert.notEqual(s0.pitch, s1.pitch);

  const none = [{ lang: "en-US", name: "Alex" }];
  assert.equal(pickBrowserFrenchVoice(none, 0).voice, undefined);
});

test("shouldFallbackToAzureStt triggers when dictation is unsupported, errored, or empty and Azure is configured", () => {
  assert.equal(shouldFallbackToAzureStt({ dictationSupported: false, speechFailed: false, transcript: "", azureAvailable: true }), true);
  assert.equal(shouldFallbackToAzureStt({ dictationSupported: true, speechFailed: true, transcript: "bonjour", azureAvailable: true }), true);
  assert.equal(shouldFallbackToAzureStt({ dictationSupported: true, speechFailed: false, transcript: "  ", azureAvailable: true }), true);
  assert.equal(shouldFallbackToAzureStt({ dictationSupported: true, speechFailed: false, transcript: "bonjour", azureAvailable: true }), false);
  assert.equal(shouldFallbackToAzureStt({ dictationSupported: false, speechFailed: true, transcript: "", azureAvailable: false }), false);
});
