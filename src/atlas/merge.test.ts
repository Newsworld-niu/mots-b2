import assert from "node:assert/strict";
import { test } from "node:test";
import { editedEntry } from "./merge.ts";
import { MEDIA, type Entry } from "./types.ts";

const entry = (): Entry =>
  ({
    id: "maison",
    w: "maison",
    senses: [
      { pos: "n.f.", zh: "房子", en: "" },
      { pos: "n.f.", zh: "公司", en: "" },
    ],
    ex: [
      { en: "La maison est grande.", zh: "房子很大。" },
      { en: "Une maison d'édition.", zh: "一家出版社。" },
      { en: "Il rentre à la maison.", zh: "他回家。" },
    ],
    col: [],
    tip: "",
    m: MEDIA.ex | MEDIA.exM | MEDIA.ex2 | MEDIA.uk,
  }) as unknown as Entry;

test("an edit can change any sense, drop atlas examples and add own ones", () => {
  const e = entry();
  const out = editedEntry(e, { zhMore: ["商行；公司"], hideEx: [1], ex: [{ fr: "Ma maison est petite.", zh: "我的房子很小。" }] });
  assert.deepEqual(out.senses.map((s) => s.zh), ["房子", "商行；公司"]);
  assert.deepEqual(out.ex.map((x) => x.en), ["Ma maison est petite.", "La maison est grande.", "Il rentre à la maison."]);
  assert.equal(out.ex[0].origin, "mine");
  // the atlas's own text is kept for editing and restoring
  assert.deepEqual(out.orig?.senses, ["房子", "公司"]);
  assert.equal(out.orig?.ex.length, 3);
});

test("recordings are kept only for the example they were made for", () => {
  const e = entry();
  // nothing moved: both recordings stay
  assert.equal(editedEntry(e, { zh: "住宅" }).m, e.m);
  // the second example taken out: the third takes its place and has no recording
  const second = editedEntry(e, { hideEx: [1] }).m;
  assert.ok(second & MEDIA.ex && !(second & MEDIA.ex2) && second & MEDIA.uk);
  // an own example first: neither place holds the sentence that was recorded
  const first = editedEntry(e, { ex: [{ fr: "Ma maison.", zh: "" }] }).m;
  assert.ok(!(first & (MEDIA.ex | MEDIA.exM | MEDIA.ex2)) && first & MEDIA.uk);
});
