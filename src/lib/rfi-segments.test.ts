import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { checkDictation, paragraphsFromUnits, sentencesOf } from "./listening";
import { PREBUILT_REAL_SOURCES } from "./real-presets";
import { parseRfiSegments, type RfiSegmentsFile, type TimedSegment } from "./rfi-segments";

test("parseRfiSegments validates schema, monotonic timestamps, and rejects corrupted data", () => {
  assert.equal(parseRfiSegments(null), null);
  assert.equal(parseRfiSegments({ id: "x", audio: "a.mp3", duration: 0, method: "azure-fast-stt", segments: [] }), null);
  assert.equal(
    parseRfiSegments({
      id: "x",
      audio: "a.mp3",
      duration: 60,
      method: "azure-fast-stt",
      segments: [
        { idx: 0, start: 10, end: 15, text: "Un." },
        { idx: 1, start: 9, end: 18, text: "Deux." }, // non-monotonic
      ],
    }),
    null,
  );
  const ok = parseRfiSegments({
    id: "x",
    audio: "a.mp3",
    duration: 60,
    method: "ffmpeg-silence-align",
    segments: [
      { idx: 0, start: 1.5, end: 5.2, text: "Première phrase.", who: "Diane" },
      { idx: 1, start: 5.4, end: 11.1, text: "Deuxième phrase.", who: "Diane" },
    ],
  });
  assert.ok(ok);
  assert.equal(ok.segments.length, 2);
});

test("paragraphsFromUnits merges same-speaker units while preserving [start, end] range", () => {
  const merged = paragraphsFromUnits(
    [
      { text: "Un deux trois quatre.", who: "A", start: 2, end: 6 },
      { text: "Cinq six sept huit.", who: "A", start: 6.2, end: 11 },
      { text: "Autre tour.", who: "B", start: 12, end: 16 },
    ],
    45,
  );
  assert.equal(merged.length, 2);
  assert.equal(merged[0].start, 2);
  assert.equal(merged[0].end, 11);
  assert.equal(merged[1].start, 12);
  assert.equal(merged[1].end, 16);
});

test("All 6 bundled RFI episodes ship sentence-level *.segments.json aligned 1:1 with sentencesOf(transcript)", () => {
  for (const src of PREBUILT_REAL_SOURCES) {
    const segId = src.presetId ?? src.id;
    const p = path.resolve("public", "materials", "rfi", `${segId}.segments.json`);
    assert.ok(existsSync(p), `missing ${p}`);
    const parsed: RfiSegmentsFile | null = parseRfiSegments(JSON.parse(readFileSync(p, "utf8")));
    if (!parsed) throw new Error(`invalid JSON schema in ${p}`);
    const expected = sentencesOf(src.transcript ?? "");
    assert.equal(parsed.segments.length, expected.length, `${segId} sentence count mismatch`);
    for (let i = 0; i < parsed.segments.length; i++) {
      const s: TimedSegment = parsed.segments[i];
      assert.equal(s.idx, i);
      assert.ok(s.start >= 0 && s.end > s.start && s.end <= parsed.duration + 0.5, `${segId}[${i}] bounds ${s.start}-${s.end}/${parsed.duration}`);
      if (i > 0) assert.ok(s.start >= parsed.segments[i - 1].start, `${segId}[${i}] non-monotonic`);
      assert.equal(s.text, expected[i].text);
      assert.ok(/[\p{L}\p{N}]/u.test(s.text), `${segId}[${i}] lone punctuation: ${s.text}`);
      assert.ok(!/^\s*\[[^\]]+\]\s*$/.test(s.text), `${segId}[${i}] stage tag leaked: ${s.text}`);
      assert.ok(!/\bfrancaisfacile\.rfi\.fr\b/i.test(s.text), `${segId}[${i}] domain leaked: ${s.text}`);
      assert.ok(!/^Poursuivez votre lecture\b/i.test(s.text), `${segId}[${i}] web footer leaked: ${s.text}`);
    }
  }
});

test("sentencesOf strips lone guillemets, stage tags, and promo URLs; checkDictation equates French numerals and classifies phonetic errors", () => {
  const units = sentencesOf(
    `Journaliste : « Il pleut très fort aujourd'hui sur la côte bretonne. »\n[extrait d'un chant lyrique]\nInvité : Nous avons compté trois cents participants motivés. Rendez-vous sur francaisfacile.rfi.fr.\nPoursuivez votre lecture sur les mêmes thèmes :`,
  );
  assert.equal(units.length, 2);
  assert.equal(units[0].text, "« Il pleut très fort aujourd'hui sur la côte bretonne. »");
  assert.equal(units[1].text, "Nous avons compté trois cents participants motivés.");

  // Numeral equivalence ("300" <-> "trois cents", "20 %" <-> "vingt pour cent")
  const numDigitsToWords = checkDictation("nous avons compte 300 participants motives", "Nous avons compté trois cents participants motivés.");
  assert.equal(numDigitsToWords.words[3].mark, "ok");
  assert.equal(numDigitsToWords.words[4].mark, "ok");
  assert.equal(numDigitsToWords.diagnostics.accent, 2);

  const numWordsToDigits = checkDictation("il reste trois cents places et vingt pour cent de reduction", "Il reste 300 places et 20 % de réduction.");
  assert.equal(numWordsToDigits.words[2].mark, "ok");
  assert.equal(numWordsToDigits.words[5].mark, "ok");
  assert.equal(numWordsToDigits.words[6].mark, "ok");

  // 4-category phonetic diagnostic classification
  const diag = checkDictation("on sait pas vraiment ses enfants on parler", "On ne sait pas vraiment ces enfants ont parlé.");
  assert.equal(diag.diagnostics.liaison_elision, 1); // missing "ne"
  assert.ok(diag.diagnostics.homophone_gram >= 3); // ses/ces, on/ont, parler/parlé
});
