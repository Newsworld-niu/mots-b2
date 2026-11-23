import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowedOfflineOrigin, isOffloadedMediaPath, resolveMediaUrl } from "./media";

const BLOB = "https://motsb2mediae12d4e.blob.core.windows.net/media";

test("resolveMediaUrl falls back to Vite base when mediaBase is empty and offloads audio when set", () => {
  assert.equal(resolveMediaUrl("atlas/audio/f/bonjour.mp3", "/", ""), "/atlas/audio/f/bonjour.mp3");
  assert.equal(resolveMediaUrl("atlas/audio/f/bonjour.mp3", "/francais-b2/", ""), "/francais-b2/atlas/audio/f/bonjour.mp3");
  assert.equal(resolveMediaUrl("atlas/audio/f/bonjour.mp3", "/francais-b2/", `${BLOB}/`), `${BLOB}/atlas/audio/f/bonjour.mp3`);
  assert.equal(resolveMediaUrl("/materials/rfi/rfi-jff-20261120.mp3", "/", BLOB), `${BLOB}/materials/rfi/rfi-jff-20261120.mp3`);
  assert.equal(resolveMediaUrl("materials/co/preset-listen-1-e1-d1.mp3", "/words/", BLOB), `${BLOB}/materials/co/preset-listen-1-e1-d1.mp3`);
});

test("resolveMediaUrl keeps transcripts, timestamps, and atlas JSON on app base even when mediaBase is set", () => {
  assert.equal(isOffloadedMediaPath("materials/rfi/rfi-jff-20261120.txt"), false);
  assert.equal(isOffloadedMediaPath("materials/rfi/rfi-jff-20261120.segments.json"), false);
  assert.equal(isOffloadedMediaPath("atlas/index.json"), false);
  assert.equal(resolveMediaUrl("materials/rfi/rfi-jff-20261120.txt", "/words/", BLOB), "/words/materials/rfi/rfi-jff-20261120.txt");
  assert.equal(resolveMediaUrl("materials/rfi/rfi-jff-20261120.segments.json", "/", BLOB), "/materials/rfi/rfi-jff-20261120.segments.json");
  assert.equal(resolveMediaUrl("atlas/index.json", "/", BLOB), "/atlas/index.json");
  assert.equal(resolveMediaUrl("idb:audio:s-1", "/", BLOB), "idb:audio:s-1");
  assert.equal(resolveMediaUrl("https://cdn.example/a.mp3", "/", BLOB), "https://cdn.example/a.mp3");
});

test("isAllowedOfflineOrigin permits same origin and configured media origin only", () => {
  const app = "https://newsworld-niu.github.io";
  assert.equal(isAllowedOfflineOrigin(new URL("https://newsworld-niu.github.io/words/a.mp3"), app, ""), true);
  assert.equal(isAllowedOfflineOrigin(new URL(`${BLOB}/materials/rfi/ep.mp3`), app, ""), false);
  assert.equal(isAllowedOfflineOrigin(new URL(`${BLOB}/materials/rfi/ep.mp3`), app, BLOB), true);
  assert.equal(isAllowedOfflineOrigin(new URL("https://evil.example/a.mp3"), app, BLOB), false);
});
