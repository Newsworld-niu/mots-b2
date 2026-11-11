import assert from "node:assert/strict";
import { test } from "node:test";

import { diffWords, sameSentence, sanitizeFeedback, translatable } from "./writing.ts";

test("the same sentence, give or take capitals, final punctuation and French spacing", () => {
  assert.ok(sameSentence("il habite à Paris", "Il habite à Paris."));
  assert.ok(sameSentence("Tu viens ?", "tu viens?"));
  assert.ok(sameSentence("C’est l'heure", "C'est l’heure !"));
  assert.ok(!sameSentence("Il habite a Paris", "Il habite à Paris"), "accents count");
  assert.ok(!sameSentence("", ""));
});

test("a verdict of correct does not survive corrections", () => {
  const fb = sanitizeFeedback({ verdict: "correct", corrected: "Elle est allée au marché.", errors: [{ wrong: "allé", right: "allée", type: "agreement", why: "主语是阴性" }], comment: "", natural: "" }, "Elle est allé au marché");
  assert.equal(fb.verdict, "almost");
  assert.equal(fb.errors.length, 1);
  const ok = sanitizeFeedback({ verdict: "correct", corrected: "Je vais bien.", errors: [], comment: "很好", natural: "Je vais bien" }, "je vais bien");
  assert.equal(ok.verdict, "correct");
  assert.equal(ok.natural, "", "a natural version equal to the correction is dropped");
});

test("a broken AI answer still gives feedback that can be shown", () => {
  const fb = sanitizeFeedback({ verdict: "great", errors: [null, { wrong: "x", right: "x" }, { wrong: "a", right: "à", type: "nope" }] }, " Il va a Paris ");
  assert.equal(fb.verdict, "wrong");
  assert.equal(fb.corrected, "Il va a Paris");
  assert.deepEqual(fb.errors, [{ wrong: "a", right: "à", type: "other", why: "" }]);
  assert.equal(sanitizeFeedback(null, "x").verdict, "wrong");
});

test("word diff marks what was removed and what was put in", () => {
  const d = diffWords("Elle est allé à le marché", "Elle est allée au marché");
  assert.deepEqual(d.written.filter((t) => !t.ok).map((t) => t.t), ["allé", "à", "le"]);
  assert.deepEqual(d.corrected.filter((t) => !t.ok).map((t) => t.t), ["allée", "au"]);
  const punct = diffWords("très bon, merci", "Ça va bien, merci !");
  assert.deepEqual(punct.corrected.filter((t) => !t.ok).map((t) => t.t), ["Ça", "va", "bien,"], "capitals and a lone ! are not marked");
  const same = diffWords("Je vais bien", "Je vais bien");
  assert.ok(same.written.every((t) => t.ok) && same.corrected.every((t) => t.ok));
});

test("a translation item needs a Chinese translation and a sentence short enough to type", () => {
  const long = "x".repeat(200);
  assert.equal(translatable([{ en: long, zh: "长" }, { en: "Bonjour.", zh: "" }, { en: "Merci beaucoup.", zh: "非常感谢。" }])?.en, "Merci beaucoup.");
  assert.equal(translatable([{ en: "Bonjour.", zh: " " }]), undefined);
});
