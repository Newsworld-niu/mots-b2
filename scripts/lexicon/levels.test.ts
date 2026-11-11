import assert from "node:assert/strict";
import { test } from "node:test";
import { bandsIn, estimateFromSources } from "./levels.ts";

test("stated levels are parsed from book descriptions", () => {
  assert.deepEqual(bandsIn("B2/C1"), ["B2", "C1"]);
  assert.deepEqual(bandsIn("A2 B1"), ["A2", "B1"]);
  assert.deepEqual(bandsIn("B1"), ["B1"]);
  assert.deepEqual(bandsIn("unknown"), []);
});

test("a word's estimate is the lowest band among its source books; no source means no estimate", () => {
  assert.equal(estimateFromSources(["B2/C1", "B1"]), "B1");
  assert.equal(estimateFromSources(["B2/C1"]), "B2");
  assert.equal(estimateFromSources([undefined, ""]), null);
});

import { estimateLevel, spanOf, type Span } from "./levels.ts";

const A1_BOOK: Span = ["A1", "A2"];
const MID_BOOK: Span = ["A2", "B1"];
const ADV_BOOK: Span = ["B2", "B2"];

test("a word takes the span of its lowest-starting book", () => {
  assert.deepEqual(spanOf([ADV_BOOK, MID_BOOK]), MID_BOOK);
  assert.deepEqual(spanOf([MID_BOOK, A1_BOOK, ADV_BOOK]), A1_BOOK);
  assert.equal(spanOf([undefined]), null);
});

test("a two-band book is split by frequency", () => {
  assert.equal(estimateLevel([A1_BOOK], 50)?.band, "A1");
  assert.equal(estimateLevel([A1_BOOK], 5)?.band, "A2");
  assert.equal(estimateLevel([MID_BOOK], 40)?.band, "A2");
  assert.equal(estimateLevel([MID_BOOK], 8)?.band, "B1");
});

test("without a frequency, a phrase is as basic as the lower book or as hard as the upper one", () => {
  assert.equal(estimateLevel([A1_BOOK], null)?.band, "A1");
  assert.equal(estimateLevel([MID_BOOK], null)?.band, "B1");
  assert.equal(estimateLevel([ADV_BOOK], null)?.band, "B2");
});

test("very common words are lowered whatever the book says, and never raised", () => {
  const r = estimateLevel([ADV_BOOK], 400);
  assert.equal(r?.band, "A1");
  assert.equal(r?.how, "freq-cap");
  assert.equal(r?.from, "B2");
  assert.equal(estimateLevel([ADV_BOOK], 120)?.band, "A2");
  assert.equal(estimateLevel([ADV_BOOK], 35)?.band, "B1");
  assert.equal(estimateLevel([ADV_BOOK], 3)?.band, "B2");
  assert.equal(estimateLevel([A1_BOOK], 1)?.band, "A2");
});

test("no book span means no estimate", () => {
  assert.equal(estimateLevel([], 100), null);
});
