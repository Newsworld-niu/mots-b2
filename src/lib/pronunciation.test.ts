import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultAiConfig, setAiConfig } from "../ai/config.ts";
import {
  assessPronunciation,
  assessViaWhisperVerbose,
  AZURE_UPLOAD_CONCURRENCY,
  WHISPER_VERBATIM_PROMPT,
} from "../ai/pronunciation.ts";
import { SPEECH_RATE } from "./wav.ts";
import {
  aggregate,
  assessmentHeader,
  combineSpeakingProns,
  evaluateWordBoundaries,
  fourGramOverlapRatio,
  overall,
  parseAssessment,
  parseWhisperVerbose,
  pendingDebateSamples,
  phonemeInsights,
  phonoGateInfo,
  phonoLevel,
  sampleDebateTakes,
  summarizeAcoustics,
  weakWords,
  type PronResult,
} from "./pronunciation.ts";

const answer = {
  RecognitionStatus: "Success",
  Offset: 500000,
  Duration: 120000000,
  DisplayText: "Je pense que les amis travaillent.",
  NBest: [
    {
      Confidence: 0.9,
      Lexical: "je pense que euh les amis travaillent",
      Display: "Je pense que les amis travaillent.",
      PronunciationAssessment: { AccuracyScore: 82, FluencyScore: 74, ProsodyScore: 68.5, CompletenessScore: 100, PronScore: 78.2 },
      Words: [
        {
          Word: "je",
          Offset: 5_000_000,
          Duration: 2_000_000,
          PronunciationAssessment: { AccuracyScore: 95, ErrorType: "None" },
          Phonemes: [
            {
              Phoneme: "ʒ",
              PronunciationAssessment: {
                AccuracyScore: 96,
                NBestPhonemes: [{ Phoneme: "ʒ", Score: 96 }, { Phoneme: "ʃ", Score: 12 }],
              },
            },
          ],
        },
        { Word: "les", Offset: 8_000_000, Duration: 2_000_000, PronunciationAssessment: { AccuracyScore: 88, ErrorType: "None" } },
        {
          Word: "amis",
          Offset: 14_000_000,
          Duration: 3_500_000,
          PronunciationAssessment: { AccuracyScore: 52, ErrorType: "UnexpectedBreak" },
          Phonemes: [{ Phoneme: "a", PronunciationAssessment: { AccuracyScore: 52 } }],
        },
        {
          Word: "travaillent",
          Offset: 19_000_000,
          Duration: 5_000_000,
          PronunciationAssessment: { AccuracyScore: 41, ErrorType: "Mispronunciation" },
          Phonemes: [{ Phoneme: "ʁ", PronunciationAssessment: { AccuracyScore: 40 } }],
        },
      ],
    },
  ],
};

test("assessmentHeader is base64 JSON with Phoneme granularity, IPA, prosody and NBestPhonemeCount=5", () => {
  const json = JSON.parse(Buffer.from(assessmentHeader(), "base64").toString("utf8"));
  assert.equal(json.ReferenceText, "");
  assert.equal(json.GradingSystem, "HundredMark");
  assert.equal(json.Granularity, "Phoneme");
  assert.equal(json.PhonemeAlphabet, "IPA");
  assert.equal(json.NBestPhonemeCount, 5);
  assert.equal(json.EnableMiscue, false);
  assert.equal(json.EnableProsodyAssessment, true);
  // non-ASCII reference text survives and enables miscue check for scripted shadowing
  const scripted = JSON.parse(Buffer.from(assessmentHeader("Ça été"), "base64").toString("utf8"));
  assert.equal(scripted.ReferenceText, "Ça été");
  assert.equal(scripted.EnableMiscue, true);
  assert.equal(scripted.NBestPhonemeCount, 5);
});

test("parseAssessment captures lexicalText, word offsets/durations, nBestPhonemes, and nulls unscripted completeness", () => {
  const unscripted = parseAssessment(answer, { offsetMs: 55_000 })!;
  assert.equal(unscripted.accuracy, 82);
  assert.equal(unscripted.fluency, 74);
  assert.equal(unscripted.prosody, 68.5);
  assert.equal(unscripted.completeness, null, "unscripted assessment must not show fake 100 completeness");
  assert.equal(unscripted.pron, 78.2);
  assert.equal(unscripted.seconds, 12);
  assert.equal(unscripted.text, answer.DisplayText);
  assert.equal(unscripted.lexicalText, "je pense que euh les amis travaillent");
  assert.equal(unscripted.phonemeSupported, true);
  // 5_000_000 ticks = 500ms + 55_000ms chunk offset = 55_500ms
  assert.equal(unscripted.words[0].offsetMs, 55_500);
  assert.equal(unscripted.words[0].durationMs, 200);
  assert.deepEqual(unscripted.words[0].nBestPhonemes, [[{ phoneme: "ʒ", score: 96 }, { phoneme: "ʃ", score: 12 }]]);
  assert.deepEqual(unscripted.words[3], {
    word: "travaillent",
    accuracy: 41,
    error: "Mispronunciation",
    offsetMs: 56_900,
    durationMs: 500,
    phonemes: [{ phoneme: "ʁ", accuracy: 40 }],
  });

  // Scripted shadowing preserves numeric CompletenessScore
  const scripted = parseAssessment(answer, { referenceText: "Je pense que les amis travaillent." })!;
  assert.equal(scripted.completeness, 100);
});

test("parseAssessment also reads scores flat on the hypothesis, and refuses failures", () => {
  const flat = {
    RecognitionStatus: "Success",
    Duration: 0,
    NBest: [{ Display: "Bonjour", AccuracyScore: 70, FluencyScore: 60, CompletenessScore: 90, PronScore: 72, Words: [{ Word: "bonjour", AccuracyScore: 70, ErrorType: "None" }] }],
  };
  const r = parseAssessment(flat)!;
  assert.equal(r.accuracy, 70);
  assert.equal(r.prosody, null);
  assert.equal(r.completeness, null);
  assert.equal(r.text, "Bonjour");
  assert.equal(r.seconds, 0);
  assert.equal(parseAssessment({ RecognitionStatus: "NoMatch" }), null);
  assert.equal(parseAssessment({ RecognitionStatus: "Success", NBest: [] }), null);
  assert.equal(parseAssessment("nope"), null);
  assert.equal(parseAssessment({ RecognitionStatus: "Success", NBest: [{ AccuracyScore: 300 }] })!.accuracy, 100);
});

const part = (seconds: number, v: Partial<PronResult>): PronResult => ({
  pron: null,
  accuracy: null,
  fluency: null,
  prosody: null,
  completeness: null,
  text: "",
  words: [],
  seconds,
  ...v,
});

test("aggregate weights each score by piece length and preserves monotonic multi-chunk word offsets", () => {
  const r = aggregate([
    part(50, { accuracy: 80, fluency: 60, text: "a", lexicalText: "euh a", words: [{ word: "x", accuracy: 80, error: "None", offsetMs: 1200, durationMs: 300 }] }),
    part(10, { accuracy: 20, fluency: null, prosody: 50, text: "b", lexicalText: "b", words: [{ word: "y", accuracy: 60, error: "None", offsetMs: 55_400, durationMs: 400 }] }),
  ])!;
  assert.equal(r.accuracy, 70);
  assert.equal(r.fluency, 60);
  assert.equal(r.prosody, 50);
  assert.equal(r.completeness, null);
  assert.equal(r.seconds, 60);
  assert.equal(r.text, "a b");
  assert.equal(r.lexicalText, "euh a b");
  assert.deepEqual(r.words.map((w) => w.offsetMs), [1200, 55_400]);
  assert.equal(aggregate([]), null);
  assert.equal(aggregate([part(0, { accuracy: 40 }), part(0, { accuracy: 60 })])!.accuracy, 50);
});

test("0.5-point phonoLevel & phonoGateInfo, deterministic acoustic gating when prosody is null, and Tier-2 Whisper null level", () => {
  assert.equal(overall(part(1, { pron: 77 })), 77);
  assert.equal(overall(part(1, { accuracy: 80, fluency: 60 })), 70);
  assert.equal(overall(part(1, {})), null);

  // Full 0.5-point steps across [0 .. 5]
  assert.equal(phonoLevel(part(1, { pron: 90, prosody: 85, accuracy: 88, fluency: 85 })), 5);
  assert.equal(phonoLevel(part(1, { pron: 85, prosody: 85, accuracy: 82, fluency: 80 })), 4.5);
  assert.equal(phonoLevel(part(1, { pron: 81, prosody: 80 })), 4);
  assert.equal(phonoLevel(part(1, { pron: 76, prosody: 74 })), 3.5);
  assert.equal(phonoLevel(part(1, { pron: 72, prosody: 70 })), 3);
  assert.equal(phonoLevel(part(1, { pron: 65, prosody: 60 })), 2.5);
  assert.equal(phonoLevel(part(1, { pron: 58, prosody: 55 })), 2);
  assert.equal(phonoLevel(part(1, { pron: 48, prosody: 50 })), 1.5);
  assert.equal(phonoLevel(part(1, { pron: 40, prosody: 50 })), 1);
  assert.equal(phonoLevel(part(1, { pron: 25, prosody: 50 })), 0.5);
  assert.equal(phonoLevel(part(1, { pron: 10 })), 0);
  assert.equal(phonoLevel(null), null);

  // Prosody gate on 0.5 scale
  assert.equal(phonoLevel(part(1, { pron: 90, prosody: 77, accuracy: 88, fluency: 85 })), 4.5);
  assert.equal(phonoGateInfo(part(1, { pron: 90, prosody: 74 })).level, 4);
  assert.equal(phonoGateInfo(part(1, { pron: 90, prosody: 74 })).gatedBy, "prosody");
  assert.equal(phonoGateInfo(part(1, { pron: 90, prosody: 85, accuracy: 70, fluency: 85 })).gatedBy, "accuracy_or_fluency");
  assert.equal(phonoLevel(part(1, { pron: 78, prosody: 60 })), 2.5);

  // Deterministic acoustic gating when prosody === null:
  // 1) Severe breakdown (36 WPM + 45% pause ratio) caps 4.5 -> 2
  const severeFreezeResult = part(10, {
    pron: 86,
    accuracy: 88,
    fluency: 82,
    prosody: null,
    text: "je pense que cela pose problème",
    words: [
      { word: "je", accuracy: 90, error: "None", offsetMs: 0, durationMs: 300 },
      { word: "pense", accuracy: 90, error: "None", offsetMs: 2500, durationMs: 400 },
      { word: "que", accuracy: 90, error: "None", offsetMs: 3000, durationMs: 300 },
      { word: "cela", accuracy: 90, error: "None", offsetMs: 5600, durationMs: 400 },
      { word: "pose", accuracy: 90, error: "None", offsetMs: 6200, durationMs: 400 },
      { word: "problème", accuracy: 90, error: "None", offsetMs: 6800, durationMs: 500 },
    ],
  });
  const severeGate = phonoGateInfo(severeFreezeResult);
  assert.equal(severeGate.rawLevel, 4.5);
  assert.equal(severeGate.level, 2);
  assert.equal(severeGate.gatedBy, "acoustics");

  // 2) Moderate pauses (~31% pause ratio, ~105 WPM) caps 4.5 -> 3
  const moderatePauseResult = part(8, {
    pron: 86,
    accuracy: 88,
    fluency: 82,
    prosody: null,
    text: "je pense vraiment que cette mesure reste très utile aujourd'hui en france maintenant oui",
    words: Array.from({ length: 14 }, (_, i) => ({
      word: `mot${i}`,
      accuracy: 90,
      error: "None",
      offsetMs: i * 350 + (i >= 7 ? 2500 : 0),
      durationMs: 300,
    })),
  });
  const modGate = phonoGateInfo(moderatePauseResult);
  assert.equal(modGate.rawLevel, 4.5);
  assert.equal(modGate.level, 3);
  assert.equal(modGate.gatedBy, "acoustics");

  // Whisper Tier-2 (`phonemeSupported: false`) never produces a fake phonoLevel
  const whisperRes = parseWhisperVerbose({
    text: "euh je crois que oui",
    duration: 4.2,
    words: [
      { word: "euh", start: 0.1, end: 0.4 },
      { word: "je", start: 0.5, end: 0.7 },
      { word: "crois", start: 0.8, end: 1.2 },
    ],
  })!;
  assert.equal(whisperRes.phonemeSupported, false);
  assert.equal(whisperRes.accuracy, null);
  assert.equal(phonoLevel(whisperRes), null);
});

test("IPA + acoustic liaison verification (obligatory realized vs missed, forbidden / h aspiré intrusion)", () => {
  const words = [
    // 1. Realized obligatory liaison (`les‿amis`: gap 40ms + /z/ in boundary phonemes)
    { word: "les", accuracy: 92, error: "None", offsetMs: 0, durationMs: 220, phonemes: [{ phoneme: "l", accuracy: 95 }, { phoneme: "e", accuracy: 90 }, { phoneme: "z", accuracy: 88 }] },
    { word: "amis", accuracy: 90, error: "None", offsetMs: 260, durationMs: 350, phonemes: [{ phoneme: "a", accuracy: 91 }, { phoneme: "m", accuracy: 90 }, { phoneme: "i", accuracy: 89 }] },
    // 2. Missed obligatory liaison (`nous | avons`: 260ms gap > 140ms and no /z/)
    { word: "nous", accuracy: 88, error: "None", offsetMs: 800, durationMs: 250, phonemes: [{ phoneme: "n", accuracy: 90 }, { phoneme: "u", accuracy: 86 }] },
    { word: "avons", accuracy: 84, error: "None", offsetMs: 1310, durationMs: 350, phonemes: [{ phoneme: "a", accuracy: 85 }, { phoneme: "v", accuracy: 84 }, { phoneme: "ɔ̃", accuracy: 62 }] },
    // 3. Forbidden liaison before *h aspiré* (`les × héros`: speaker pronounced /z/ across 30ms boundary!)
    {
      word: "les",
      accuracy: 85,
      error: "None",
      offsetMs: 1800,
      durationMs: 220,
      phonemes: [{ phoneme: "l", accuracy: 90 }, { phoneme: "e", accuracy: 85 }],
      nBestPhonemes: [[{ phoneme: "l", score: 90 }], [{ phoneme: "z", score: 62 }]],
    },
    { word: "héros", accuracy: 80, error: "None", offsetMs: 2050, durationMs: 400, phonemes: [{ phoneme: "e", accuracy: 82 }, { phoneme: "ʁ", accuracy: 55 }, { phoneme: "o", accuracy: 84 }] },
    { word: "tu", accuracy: 55, error: "None", offsetMs: 2600, durationMs: 250, phonemes: [{ phoneme: "t", accuracy: 80 }, { phoneme: "y", accuracy: 42 }] },
  ];

  const boundaries = evaluateWordBoundaries(words, true);
  assert.equal(boundaries.find((b) => b.afterIndex === 0)?.liaison?.status, "ok");
  assert.equal(boundaries.find((b) => b.afterIndex === 2)?.liaison?.status, "missed");
  assert.equal(boundaries.find((b) => b.afterIndex === 4)?.liaison?.status, "violated");

  const ins = phonemeInsights(words);
  assert.deepEqual(new Set(ins.map((x) => x.id)), new Set(["yu", "nasal", "r", "liaison"]));
  const liaisonIns = ins.find((x) => x.id === "liaison")!;
  assert.ok(liaisonIns.examples.some((e) => e.includes("nous‿avons")));
  assert.ok(liaisonIns.examples.some((e) => e.includes("les×héros")));
});

test("summarizeAcoustics computes WPM, pauseRatio, longFreezeCount, midConstituentBreaks, and likelyReadAloud", () => {
  const words = [
    { word: "le", accuracy: 90, error: "None", offsetMs: 0, durationMs: 200 },
    // 500ms break inside Det + Noun (`le` + `gouvernement`) -> pause + midConstituentBreak
    { word: "gouvernement", accuracy: 88, error: "None", offsetMs: 700, durationMs: 600 },
    // 2300ms freeze -> pause + longFreeze
    { word: "doit", accuracy: 85, error: "None", offsetMs: 3600, durationMs: 350 },
    { word: "agir", accuracy: 86, error: "None", offsetMs: 4050, durationMs: 400 },
    { word: "dans", accuracy: 90, error: "None", offsetMs: 4550, durationMs: 200 },
    // 450ms break inside Prep + Det (`dans` + `les`) -> pause + midConstituentBreak
    { word: "les", accuracy: 90, error: "None", offsetMs: 5200, durationMs: 200 },
    { word: "écoles", accuracy: 88, error: "None", offsetMs: 5500, durationMs: 500 },
  ];
  const r = part(6, {
    pron: 84,
    accuracy: 88,
    fluency: 70,
    text: "Le gouvernement doit agir dans les écoles.",
    phonemeSupported: true,
    words,
  });
  const ac = summarizeAcoustics(r, "Le gouvernement doit agir dans les écoles publiques dès maintenant.")!;
  assert.equal(ac.speechRateWpm, 70);
  assert.ok((ac.articulationRateWpm ?? 0) > (ac.speechRateWpm ?? 0));
  assert.equal(ac.longFreezeCount, 1);
  assert.equal(ac.midConstituentBreaks, 2);
  assert.ok((ac.pauseRatio ?? 0) > 0.45);
  assert.equal(ac.likelyReadAloud, true, "high 4-gram overlap with notes flags likelyReadAloud");
  assert.ok(fourGramOverlapRatio("Le gouvernement doit agir dans les écoles", "Le gouvernement doit agir dans les écoles") >= 0.99);

  // Fast monotone (>155 WPM, very low pause variance) flags likelyReadAloud even without notes
  const fastWords = Array.from({ length: 18 }, (_, i) => ({
    word: i % 2 === 0 ? "nous" : "voyons",
    accuracy: 92,
    error: "None",
    offsetMs: i * 320,
    durationMs: 280,
  }));
  const fastAc = summarizeAcoustics(part(5.8, { text: fastWords.map((w) => w.word).join(" "), words: fastWords }))!;
  assert.ok((fastAc.speechRateWpm ?? 0) > 155);
  assert.equal(fastAc.likelyReadAloud, true);
});

test("3-way concurrent assessPronunciation with +1 transient retry and non-resetting chunk offsetMs", async () => {
  const prev = defaultAiConfig();
  setAiConfig({ keys: { ...prev.keys, azure: "test-azure-key" }, azureRegion: "francecentral" });

  // Synthesize ~205 seconds (4 chunks of ≤55s) of non-silent 16 kHz audio
  const totalSamples = SPEECH_RATE * 205;
  const samples = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    samples[i] = Math.sin(i * 0.1) * 0.25;
  }

  let inFlight = 0;
  let maxInFlight = 0;
  let callCount = 0;
  let retriedFirst = false;

  const mockFetcher: typeof fetch = async () => {
    const myCall = callCount++;
    inFlight++;
    if (inFlight > maxInFlight) maxInFlight = inFlight;
    await new Promise((r) => setTimeout(r, 25));
    inFlight--;

    if (myCall === 1 && !retriedFirst) {
      retriedFirst = true;
      return new Response("Service Unavailable", { status: 503 });
    }
    return new Response(
      JSON.stringify({
        RecognitionStatus: "Success",
        Duration: 50_000_0000, // 50s in 100ns ticks
        DisplayText: `chunk-${myCall}`,
        NBest: [
          {
            Lexical: `mot${myCall}`,
            Display: `chunk-${myCall}`,
            PronunciationAssessment: { AccuracyScore: 84, FluencyScore: 80, ProsodyScore: 78, CompletenessScore: 100, PronScore: 82 },
            Words: [
              {
                Word: `mot${myCall}`,
                Offset: 10_000_000, // 1.0s relative to chunk start
                Duration: 3_000_000,
                PronunciationAssessment: { AccuracyScore: 84, ErrorType: "None" },
              },
            ],
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  try {
    const res = await assessPronunciation(samples, undefined, undefined, "", mockFetcher);
    assert.ok(res);
    assert.equal(retriedFirst, true, "transient 503 retried once");
    assert.ok(maxInFlight <= AZURE_UPLOAD_CONCURRENCY, `concurrency ${maxInFlight} must not exceed 3`);
    assert.ok(maxInFlight >= 2, "uploads ran concurrently");
    assert.equal(res.words.length, 4);
    // Word timestamps monotonically increase across 55s chunks rather than resetting to 1000ms
    for (let i = 1; i < res.words.length; i++) {
      assert.ok(
        (res.words[i].offsetMs ?? 0) > (res.words[i - 1].offsetMs ?? 0) + 30_000,
        `expected monotonic chunk offset: ${res.words[i - 1].offsetMs} -> ${res.words[i].offsetMs}`,
      );
    }
  } finally {
    setAiConfig(prev);
  }
});

test("assessViaWhisperVerbose requests verbose_json word timestamps and falls back cleanly to json on 400", async () => {
  const prev = defaultAiConfig();
  setAiConfig({
    keys: { ...prev.keys, openai: "sk-test" },
    stt: { provider: "openai", baseUrl: "", apiKey: "", model: "whisper-1" },
  });

  try {
    const seenFormats: string[] = [];
    let seenPrompt = "";
    const verboseFetcher: typeof fetch = async (_input, init) => {
      const fd = init?.body as FormData;
      seenFormats.push(String(fd.get("response_format")));
      seenPrompt = String(fd.get("prompt"));
      assert.equal(fd.get("timestamp_granularities[]"), "word");
      return new Response(
        JSON.stringify({
          text: "euh je pense que oui",
          duration: 3.5,
          words: [
            { word: "euh", start: 0.1, end: 0.4 },
            { word: "je", start: 0.5, end: 0.7 },
            { word: "pense", start: 0.8, end: 1.3 },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const r1 = await assessViaWhisperVerbose(new Blob(["audio"], { type: "audio/webm" }), undefined, { fetcher: verboseFetcher });
    assert.equal(seenPrompt, WHISPER_VERBATIM_PROMPT);
    assert.deepEqual(seenFormats, ["verbose_json"]);
    assert.equal(r1?.phonemeSupported, false);
    assert.equal(r1?.accuracy, null);
    assert.equal(r1?.words[0].offsetMs, 100);
    assert.equal(r1?.words[2].offsetMs, 800);

    // Fallback when custom endpoint rejects verbose_json with 400
    const fallbackFormats: string[] = [];
    const fallbackFetcher: typeof fetch = async (_input, init) => {
      const fd = init?.body as FormData;
      const fmt = String(fd.get("response_format"));
      fallbackFormats.push(fmt);
      if (fmt === "verbose_json") {
        return new Response(JSON.stringify({ error: { message: "verbose_json unsupported" } }), { status: 400 });
      }
      return new Response(JSON.stringify({ text: "euh oui tout à fait" }), { status: 200 });
    };

    const r2 = await assessViaWhisperVerbose(new Blob(["audio"], { type: "audio/webm" }), undefined, {
      fallbackSeconds: 4.5,
      fetcher: fallbackFetcher,
    });
    assert.deepEqual(fallbackFormats, ["verbose_json", "json"]);
    assert.equal(r2?.text, "euh oui tout à fait");
    assert.equal(r2?.seconds, 4.5);
    assert.equal(r2?.phonemeSupported, false);
  } finally {
    setAiConfig(prev);
  }
});

test("sampling, combining speaking prons, and weakWords deduplication", () => {
  const sampled = sampleDebateTakes([[0, { seconds: 10 }], [1, { seconds: 1 }], [2, { seconds: 25 }], [3, { seconds: 8 }], [4, { seconds: 30 }], [5, { seconds: 12 }]], 4);
  assert.deepEqual(sampled.map(([i]) => i), [0, 2, 4, 5]);

  const pending1 = pendingDebateSamples([{ a: "Je suis d'accord avec cette mesure." }], { 0: { seconds: 14 } }, {});
  assert.deepEqual(pending1, [[0, { seconds: 14 }]]);
  const pending2 = pendingDebateSamples(
    [{ a: "Un" }, { a: "   " }, { a: "Deux" }, { a: "Trois" }],
    { 0: { seconds: 10 }, 1: { seconds: 10 }, 2: { seconds: 1 }, 3: { seconds: 12 } },
    { 0: part(10, { pron: 80 }) },
  );
  assert.deepEqual(pending2, [[3, { seconds: 12 }]]);

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
