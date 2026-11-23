import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDialogueSsmlBatches, buildVoiceSsml, prosodyText, xmlEscape } from "./ssml";

test("xmlEscape escapes special SSML characters", () => {
  assert.equal(xmlEscape(`L'école & <"test">`), "L&apos;école &amp; &lt;&quot;test&quot;&gt;");
});

test("prosodyText inserts natural <break> cues for pauses and oral fillers", () => {
  const radio = prosodyText("Première phrase. Deuxième phrase ! Et encore...", "radio");
  assert.ok(radio.includes('<break time="340ms"/>'));
  assert.ok(radio.includes('…<break time="200ms"/>'));

  const natural = prosodyText("Alors, euh, on a… enfin, voilà une idée.", "natural");
  assert.ok(natural.includes('<break time="140ms"/>'));
  assert.ok(natural.includes('<break time="260ms"/>'));
});

test("buildVoiceSsml wraps <prosody> and handles multilingual non-fr voices", () => {
  const fr = buildVoiceSsml("Bonjour à tous.", "fr-FR-DeniseNeural", { style: "natural", ratePct: 4 });
  assert.ok(fr.includes('<voice name="fr-FR-DeniseNeural"><prosody rate="+4%" pitch="+0%">'));
  assert.ok(!fr.includes("<lang "));

  const multi = buildVoiceSsml("Bonjour à tous.", "en-US-AndrewMultilingualNeural");
  assert.ok(multi.includes('<lang xml:lang="fr-FR"><prosody '));
});

test("buildDialogueSsmlBatches assigns 3+ voices, interruption breaks, and splits over maxVoices", () => {
  const turns = [
    { who: 0, t: "Bienvenue dans l'émission." },
    { who: 1, t: "Merci beaucoup." },
    { who: 2, t: "Pardon, mais je ne suis pas d'accord !" },
    { who: 3, t: "Moi non plus." },
  ];
  const voices = ["fr-FR-DeniseNeural", "fr-FR-HenriNeural", "fr-CA-SylvieNeural", "fr-BE-GerardNeural"];
  const batches = buildDialogueSsmlBatches(turns, voices, { style: "natural" });
  assert.equal(batches.length, 1);
  for (const v of voices) assert.ok(batches[0].includes(`<voice name="${v}">`), v);
  assert.ok(batches[0].includes('<break time="80ms"/>'));
  assert.ok(batches[0].includes('<break time="240ms"/>'));
  assert.ok(!/<\/voice><break/.test(batches[0]));
  assert.ok(batches[0].includes("<prosody "));

  const split = buildDialogueSsmlBatches(turns, voices, { style: "radio" }, 2);
  assert.equal(split.length, 2);
});
