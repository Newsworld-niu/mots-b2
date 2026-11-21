import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeWav, isSilent, mixToMono, resample, splitSegments, SPEECH_RATE } from "./wav.ts";

test("encodeWav writes a 16 kHz mono 16-bit PCM RIFF header and clipped samples", () => {
  const wav = encodeWav(new Float32Array([0, 1, -1, 2, -0.5]));
  const v = new DataView(wav.buffer);
  const text = (at: number, n: number) => String.fromCharCode(...wav.subarray(at, at + n));
  assert.equal(wav.length, 44 + 5 * 2);
  assert.equal(text(0, 4), "RIFF");
  assert.equal(v.getUint32(4, true), 36 + 10);
  assert.equal(text(8, 4), "WAVE");
  assert.equal(text(12, 4), "fmt ");
  assert.equal(v.getUint16(20, true), 1);
  assert.equal(v.getUint16(22, true), 1);
  assert.equal(v.getUint32(24, true), SPEECH_RATE);
  assert.equal(v.getUint32(28, true), SPEECH_RATE * 2);
  assert.equal(v.getUint16(32, true), 2);
  assert.equal(v.getUint16(34, true), 16);
  assert.equal(text(36, 4), "data");
  assert.equal(v.getUint32(40, true), 10);
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => v.getInt16(44 + i * 2, true)), [0, 32767, -32768, 32767, -16384]);
});

test("resample keeps duration and shape, down by averaging and up by interpolation", () => {
  const sec = 0.5;
  const from = 48000;
  const sine = new Float32Array(from * sec).map((_, i) => Math.sin((2 * Math.PI * 200 * i) / from));
  const down = resample(sine, from, SPEECH_RATE);
  assert.equal(down.length, SPEECH_RATE * sec);
  // a 200 Hz tone survives: compare with the tone sampled at 16 kHz
  for (const i of [10, 400, 4000, 7999]) assert.ok(Math.abs(down[i] - Math.sin((2 * Math.PI * 200 * (i * 3 + 1)) / from)) < 0.02, `sample ${i}`);
  assert.deepEqual([...resample(new Float32Array([0, 1, 2, 3]), 8000, 16000)], [0, 0.5, 1, 1.5, 2, 2.5, 3, 3]);
  const same = new Float32Array([1, 2]);
  assert.equal(resample(same, 16000, 16000), same);
  // 44.1 kHz does not divide evenly
  assert.equal(resample(new Float32Array(44100), 44100, 16000).length, 16000);
});

test("mixToMono averages channels", () => {
  assert.deepEqual([...mixToMono([new Float32Array([1, 0.5]), new Float32Array([0, 0.5])])], [0.5, 0.5]);
  assert.equal(mixToMono([]).length, 0);
});

test("isSilent tells an empty microphone from speech", () => {
  assert.ok(isSilent(new Float32Array(1600)));
  assert.ok(!isSilent(new Float32Array(1600).map((_, i) => 0.2 * Math.sin(i / 3))));
});

test("splitSegments cuts long recordings into pieces of at most 55 s, at a quiet spot", () => {
  const rate = 1000;
  assert.deepEqual(splitSegments(new Float32Array(30 * rate), rate), [[0, 30 * rate]]);
  assert.deepEqual(splitSegments(new Float32Array(0), rate), []);
  // loud everywhere except a pause around 52 s
  const s = new Float32Array(130 * rate).fill(0.3);
  s.fill(0, 52 * rate, 52 * rate + 200);
  const parts = splitSegments(s, rate);
  assert.ok(parts.length === 3, JSON.stringify(parts));
  assert.equal(parts[0][0], 0);
  assert.ok(parts[0][1] >= 52 * rate && parts[0][1] <= 52 * rate + 200, `cut in the pause: ${parts[0][1]}`);
  for (let i = 1; i < parts.length; i++) assert.equal(parts[i][0], parts[i - 1][1]);
  assert.equal(parts.at(-1)![1], s.length);
  for (const [a, b] of parts) assert.ok(b - a <= 55 * rate);
  // exactly at the limit: one piece
  assert.equal(splitSegments(new Float32Array(55 * rate), rate).length, 1);
});
