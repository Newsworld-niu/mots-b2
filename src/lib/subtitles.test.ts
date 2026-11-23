import assert from "node:assert/strict";
import { test } from "node:test";
import { activeCueIndex, parseSubtitles } from "./subtitles";

test("parseSubtitles parses WebVTT with <c>, <i>, <v>, karaoke timestamps, NOTE/STYLE blocks, and bilingual CJK split", () => {
  const vtt = `\uFEFFWEBVTT
Kind: captions
Language: fr

NOTE Ceci est un commentaire ignoré

STYLE
::cue { color: yellow; }

00:01.200 --> 00:04.500 align:start position:0%
<v Marie><c.yellow>On ne voit bien</c> <00:02.000><i>qu'avec le c&oelig;ur.</i></v>
只有用心才能看清。

cue-2
00:04.500 --> 00:08.000
L'essentiel est invisible
pour les yeux.
本质用眼睛是看不见的。

00:09.000 --> 00:11.250
<i>Bonsoir &agrave; tous&nbsp;!</i>
`;

  const cues = parseSubtitles(vtt);
  assert.equal(cues.length, 3);
  assert.deepEqual(cues[0], {
    start: 1.2,
    end: 4.5,
    fr: "On ne voit bien qu'avec le cœur.",
    zh: "只有用心才能看清。",
  });
  assert.deepEqual(cues[1], {
    start: 4.5,
    end: 8,
    fr: "L'essentiel est invisible pour les yeux.",
    zh: "本质用眼睛是看不见的。",
  });
  assert.deepEqual(cues[2], {
    start: 9,
    end: 11.25,
    fr: "Bonsoir à tous !",
  });
});

test("parseSubtitles parses SRT comma timestamps and activeCueIndex resolves boundaries accurately", () => {
  const srt = `1
00:00:01,000 --> 00:00:03,500
{\\an8}<i>Il pleut doucement sur la ville.</i>
雨轻轻地落在城市上。

2
00:00:03,500 --> 00:00:06,000
Prenons un café chaud.
`;

  const cues = parseSubtitles(srt);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].fr, "Il pleut doucement sur la ville.");
  assert.equal(cues[0].zh, "雨轻轻地落在城市上。");
  assert.equal(cues[1].fr, "Prenons un café chaud.");
  assert.equal(cues[1].zh, undefined);

  assert.equal(activeCueIndex(cues, 0.5), -1);
  assert.equal(activeCueIndex(cues, 1.0), 0);
  assert.equal(activeCueIndex(cues, 2.4), 0);
  assert.equal(activeCueIndex(cues, 3.5), 1, "exact boundary transitions cleanly to next cue");
  assert.equal(activeCueIndex(cues, 6.0), -1);
});
