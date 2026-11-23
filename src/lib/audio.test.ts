import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { play, playSlice, stopAudio } from "./audio";

const origWindow = (globalThis as Record<string, unknown>).window;
const origAudio = (globalThis as Record<string, unknown>).Audio;

afterEach(() => {
  stopAudio();
  (globalThis as Record<string, unknown>).window = origWindow;
  (globalThis as Record<string, unknown>).Audio = origAudio;
});

function installAudioMock() {
  const instances: Array<{
    paused: boolean;
    playbackRate: number;
    currentTime: number;
    onended: (() => void) | null;
    onpause: (() => void) | null;
    ontimeupdate: (() => void) | null;
    onloadedmetadata: (() => void) | null;
    onerror: (() => void) | null;
    play: () => Promise<void>;
    pause: () => void;
  }> = [];

  class FakeAudio {
    paused = false;
    playbackRate = 1;
    currentTime = 0;
    onended: (() => void) | null = null;
    onpause: (() => void) | null = null;
    ontimeupdate: (() => void) | null = null;
    onloadedmetadata: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(_url: string) {
      instances.push(this);
    }
    async play() {
      this.paused = false;
    }
    pause() {
      this.paused = true;
      this.onpause?.();
    }
  }

  (globalThis as Record<string, unknown>).window = {};
  (globalThis as Record<string, unknown>).Audio = FakeAudio;
  return instances;
}

test("play() returns 'stopped' when interrupted by stopAudio() instead of 'recorded'", async () => {
  const instances = installAudioMock();
  const p = play("/atlas/audio/f/bonjour.mp3", "bonjour");
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(instances.length, 1);

  stopAudio();
  assert.equal(await p, "stopped");
});

test("play() returns 'recorded' when playback completes naturally via onended", async () => {
  const instances = installAudioMock();
  const p = play("/atlas/audio/f/bonjour.mp3", "bonjour");
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(instances.length, 1);

  instances[0].onended?.();
  assert.equal(await p, "recorded");
});

test("playSlice seeks to start, stops automatically at endSec, and handles stopAudio interruption", async () => {
  const instances = installAudioMock();
  const p1 = playSlice("/materials/rfi/ep.mp3", 12, 16, 0.75);
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(instances.length, 1);
  assert.equal(instances[0].playbackRate, 0.75);
  assert.ok(Math.abs(instances[0].currentTime - 11.88) < 0.05);

  instances[0].currentTime = 16.2;
  instances[0].ontimeupdate?.();
  assert.equal(await p1, "recorded");
  assert.equal(instances[0].paused, true);

  const p2 = playSlice("/materials/rfi/ep.mp3", 20, 28, 1);
  await new Promise((r) => setTimeout(r, 15));
  stopAudio();
  assert.equal(await p2, "stopped");
});
