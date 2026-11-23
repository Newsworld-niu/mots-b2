import assert from "node:assert/strict";
import { test } from "node:test";
import { canTranscribeMultimodalAudio, isMultimodalAudioModel, synthesizeProportionalWords, transcribeViaMultimodalAudio } from "../ai/clients.ts";
import { defaultAiConfig } from "../ai/config.ts";
import { canAssessOrTranscribe, oralCapabilityTier } from "../ai/pronunciation.ts";
import { INTERLOCUTOR_SYSTEM, TRACK_SPEAKING_SYSTEM } from "../ai/tasks/speaking-tracks.ts";
import { TRACK_WRITING_SYSTEM } from "../ai/tasks/writing-tracks.ts";
import { parseWhisperVerbose, summarizeAcoustics } from "./pronunciation.ts";
import {
  analyzeCandidateQuestions,
  analyzeRegisterConsistency,
  TCF_SPEAKING_SUITES,
  TEF_SPEAKING_SUITES,
} from "./speaking-tracks.ts";
import {
  evaluateTrackWordMeter,
  TCF_WRITING_SUITES,
  TEF_WRITING_SUITES,
} from "./writing-tracks.ts";

test("analyzeCandidateQuestions counts est-ce que, inversion, wh-words, intonation and ignores non-questions", () => {
  const turns = [
    "Bonjour Madame, je voudrais m'inscrire au club d'aviron.",
    "Est-ce que les débutants sont acceptés ?",
    "Pouvez-vous me préciser les horaires d'entraînement ?",
    "À quelle heure commence la séance du samedi ?",
    "Le matériel est compris dans le tarif annuel ?",
    "Oui, merci beaucoup.",
    "Je voudrais prendre rendez-vous demain.",
  ];
  const res = analyzeCandidateQuestions(turns);
  assert.equal(res.totalQuestions, 4);
  assert.equal(res.counts.estCeQue, 1);
  assert.equal(res.counts.inversion, 1);
  assert.equal(res.counts.whWord, 1);
  assert.equal(res.counts.intonation, 1);
  assert.equal(res.varietyScore3, 3);
  assert.equal(res.distinctStructures.length, 4);

  // Unpunctuated ASR utterances with est-ce que / clause-initial wh-word / inversion still count
  const asrTurns = [
    "combien coûte l'abonnement annuel",
    "y a t il une réduction pour les étudiants",
    "est-ce qu'il faut apporter un certificat médical",
  ];
  const asrRes = analyzeCandidateQuestions(asrTurns);
  assert.equal(asrRes.totalQuestions, 3);
  assert.equal(asrRes.varietyScore3, 3);
});

test("analyzeRegisterConsistency detects vous vs tu accurately without false positives on accented words or rendez-vous", () => {
  // Formal TEF Section A: clean vous
  const cleanFormal =
    "Bonjour Monsieur, pourriez-vous m'indiquer vos tarifs et votre adresse ? J'aimerais prendre rendez-vous samedi pour la fête.";
  const formalOk = analyzeRegisterConsistency(cleanFormal, "vous");
  assert.equal(formalOk.consistent, true);
  assert.equal(formalOk.usedTuInFormal, false);
  assert.equal(formalOk.hasTargetPronoun, true);
  assert.equal(formalOk.tuCount, 0);
  assert.equal(formalOk.vousCount, 3);

  // Formal TEF Section A: accidental tu / t' slip
  const formalSlip = "Bonjour, est-ce que tu peux me dire combien ça coûte et si t'as encore de la place ?";
  const formalBad = analyzeRegisterConsistency(formalSlip, "vous");
  assert.equal(formalBad.consistent, false);
  assert.equal(formalBad.usedTuInFormal, true);
  assert.equal(formalBad.tuCount, 2);

  // Informal TEF Section B: clean tu with rendez-vous noun and quoted formal ad
  const cleanInformal =
    "Franchement Camille, tu devrais venir avec moi ! L'annonce dit « réservez votre séance », on se donne rendez-vous à côté de la côte à midi, je t'assure que ton dos te dira merci.";
  const informalOk = analyzeRegisterConsistency(cleanInformal, "tu");
  assert.equal(informalOk.consistent, true);
  assert.equal(informalOk.usedVousInInformal, false);
  assert.equal(informalOk.hasTargetPronoun, true);
  assert.equal(informalOk.vousCount, 0);
  assert.ok(informalOk.tuCount >= 4);

  // Informal TEF Section B: stiff vous slip to close friend
  const informalSlip = "Salut Lucas, vous devriez vraiment venir réparer votre machine avec moi samedi.";
  const informalBad = analyzeRegisterConsistency(informalSlip, "tu");
  assert.equal(informalBad.consistent, false);
  assert.equal(informalBad.usedVousInInformal, true);
  assert.equal(informalBad.vousCount, 2);
});

test("TCF & TEF speaking and writing suites satisfy official timing, task count, and word-bound invariants", () => {
  assert.equal(TCF_SPEAKING_SUITES.length, 6);
  for (const s of TCF_SPEAKING_SUITES) {
    assert.ok(s.id.length <= 36);
    assert.equal(s.tache1.prepSec, 0);
    assert.equal(s.tache1.speakSec, 120);
    assert.equal(s.tache2.prepSec, 120);
    assert.equal(s.tache2.speakSec, 210);
    assert.equal(s.tache3.prepSec, 0);
    assert.equal(s.tache3.speakSec, 270);
    assert.ok(s.tache2.hiddenFactsFr.length >= 5);
  }

  assert.equal(TEF_SPEAKING_SUITES.length, 6);
  for (const s of TEF_SPEAKING_SUITES) {
    assert.ok(s.id.length <= 36);
    assert.equal(s.sectionA.prepSec, 60);
    assert.equal(s.sectionA.speakSec, 300);
    assert.equal(s.sectionA.expectedRegister, "vous");
    assert.equal(s.sectionA.targetQuestions, 10);
    assert.equal(s.sectionB.prepSec, 60);
    assert.equal(s.sectionB.speakSec, 600);
    assert.equal(s.sectionB.expectedRegister, "tu");
    assert.ok(s.sectionB.objectionsFr.length >= 4 && s.sectionB.objectionsFr.length <= 5);
  }

  assert.equal(TCF_WRITING_SUITES.length, 4);
  for (const w of TCF_WRITING_SUITES) {
    assert.equal(w.durationMinutes, 60);
    assert.deepEqual(
      w.tasks.map((t) => [t.minWords, t.maxWords]),
      [
        [60, 120],
        [120, 150],
        [120, 180],
      ],
    );
    assert.ok(w.tasks[2].docAFr && w.tasks[2].docBFr);
  }

  assert.equal(TEF_WRITING_SUITES.length, 4);
  for (const w of TEF_WRITING_SUITES) {
    assert.equal(w.durationMinutes, 60);
    assert.equal(w.sectionA.minWords, 80);
    assert.equal(w.sectionB.minWords, 200);
    assert.ok(w.sectionA.leadFr.length > 40);
    assert.ok(w.sectionB.claimFr.length > 20);
  }

  // Word-count meter checks
  const shortMeter = evaluateTrackWordMeter("Bonjour les voisins", { minWords: 60, maxWords: 120 });
  assert.equal(shortMeter.status, "under");
  const okMeter = evaluateTrackWordMeter(new Array(85).fill("mot").join(" "), { minWords: 60, maxWords: 120 });
  assert.equal(okMeter.status, "ok");
  const overMeter = evaluateTrackWordMeter(new Array(130).fill("mot").join(" "), { minWords: 60, maxWords: 120 });
  assert.equal(overMeter.status, "over");
  const tefOk = evaluateTrackWordMeter(new Array(220).fill("argument").join(" "), { minWords: 200, recommendedMaxWords: 280 });
  assert.equal(tefOk.status, "ok");
});

test("M2 Tier-2 multimodal audio oral fallback and oralCapabilityTier 3-tier classification", async () => {
  // Tier 3: DeepSeek pure-text only
  const deepseekOnly = {
    ...defaultAiConfig(),
    keys: { ...defaultAiConfig().keys, deepseek: "sk-ds" },
    text: { provider: "deepseek" as const, model: "deepseek-chat" },
  };
  assert.equal(canTranscribeMultimodalAudio(deepseekOnly), false);
  assert.equal(canAssessOrTranscribe(deepseekOnly), false);
  assert.equal(oralCapabilityTier(deepseekOnly).tier, 3);

  // Tier 2 via OpenRouter google/gemini-2.5-flash
  const openrouterGemini = {
    ...defaultAiConfig(),
    keys: { ...defaultAiConfig().keys, openrouter: "sk-or-test" },
    text: { provider: "openrouter" as const, model: "google/gemini-2.5-flash" },
  };
  assert.equal(isMultimodalAudioModel("google/gemini-2.5-flash"), true);
  assert.equal(isMultimodalAudioModel("openai/gpt-4o-audio-preview"), true);
  assert.equal(isMultimodalAudioModel("deepseek/deepseek-chat"), false);
  assert.equal(canTranscribeMultimodalAudio(openrouterGemini), true);
  assert.equal(canAssessOrTranscribe(openrouterGemini), true);
  assert.equal(oralCapabilityTier(openrouterGemini).tier, 2);

  // Tier 2 via direct Gemini key
  const directGemini = {
    ...defaultAiConfig(),
    keys: { ...defaultAiConfig().keys, gemini: "AIzaSyTest" } as ReturnType<typeof defaultAiConfig>["keys"],
  };
  assert.equal(canTranscribeMultimodalAudio(directGemini), true);
  assert.equal(oralCapabilityTier(directGemini).tier, 2);

  // Tier 1 via Azure Speech key + region
  const azureTier1 = {
    ...openrouterGemini,
    keys: { ...openrouterGemini.keys, azure: "az-key" },
    azureRegion: "westeurope",
  };
  assert.equal(oralCapabilityTier(azureTier1).tier, 1);

  // Proportional word timestamp synthesis feeds cleanly into parseWhisperVerbose + summarizeAcoustics WPM
  const synth = synthesizeProportionalWords("Euh bonjour je voudrais savoir combien ça coûte", 4.0);
  assert.equal(synth.length, 8);
  assert.equal(synth[0].startSec, 0);
  assert.ok(synth[7].endSec <= 4.01 && synth[7].endSec > 3.2);

  const mockBlob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/wav" });
  const mmOut = await transcribeViaMultimodalAudio(mockBlob, undefined, {
    durationSec: 6,
    cfg: openrouterGemini,
    fetcher: async (_url, init) => {
      const parsed = JSON.parse(String(init?.body ?? "{}")) as {
        temperature?: number;
        messages?: Array<{ role: string; content: unknown }>;
      };
      assert.equal(parsed.temperature, 0);
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"text":"Euh bonjour madame, quels sont les horaires d\'ouverture s\'il vous plaît ?"}' } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });
  assert.match(mmOut.text, /Euh bonjour madame/);
  assert.ok(mmOut.words.length >= 10);

  const pron = parseWhisperVerbose(
    {
      text: mmOut.text,
      duration: 6,
      words: mmOut.words.map((w) => ({ word: w.word, start: w.startSec, end: w.endSec })),
    },
    6,
  );
  assert.ok(pron);
  const ac = summarizeAcoustics(pron);
  assert.ok(ac && typeof ac.speechRateWpm === "number" && ac.speechRateWpm > 80);

  // Direct Gemini generateContent inlineData path at temperature: 0
  const geminiOut = await transcribeViaMultimodalAudio(mockBlob, undefined, {
    durationSec: 5,
    cfg: directGemini,
    fetcher: async (url, init) => {
      assert.match(String(url), /generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.5-flash:generateContent/);
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        generationConfig?: { temperature?: number };
        contents?: Array<{ parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> }>;
      };
      assert.equal(body.generationConfig?.temperature, 0);
      assert.equal(body.contents?.[0]?.parts?.[0]?.inlineData?.mimeType, "audio/wav");
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"text":"Euh je pense que il faut limiter les vols courts"}' }] } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });
  assert.equal(geminiOut.text, "Euh je pense que il faut limiter les vols courts");
  assert.equal(geminiOut.words.length, 10);

  // Track AI grading & interlocutor prompts enforce untrusted learner isolation and register rules
  assert.match(INTERLOCUTOR_SYSTEM, /UNTRUSTED DATA RULE/);
  assert.match(INTERLOCUTOR_SYSTEM, /tutoiement/);
  assert.match(TRACK_SPEAKING_SYSTEM, /UNTRUSTED DATA RULE/);
  assert.match(TRACK_SPEAKING_SYSTEM, /usedVousInInformal/);
  assert.match(TRACK_WRITING_SYSTEM, /UNTRUSTED DATA RULE/);
  assert.match(TRACK_WRITING_SYSTEM, /fait divers/i);
});
