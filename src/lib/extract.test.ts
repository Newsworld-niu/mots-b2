import assert from "node:assert/strict";
import { test } from "node:test";

import type { WordRef } from "../atlas/types";
import type { DictHit } from "./dict.ts";
import { extractWords, splitSentences, tokenize } from "./extract.ts";

const ref = (id: string, word: string, zh = id): WordRef => ({ id, word, zh, ipa: "", cefr: 0, topic: 0, media: 0, order: 0 });
const atlas = {
  words: [ref("homme", "homme", "男人"), ref("vouloir", "vouloir", "想要"), ref("aujourdhui", "aujourd'hui", "今天"), ref("besoin", "avoir besoin de", "需要"), ref("chat", "chat", "猫"), ref("marie", "marié", "已婚的")],
  custom: [{ ...ref("u-abcd1", "trottinette", "滑板车"), order: -1, custom: true as const }],
};
const dict: Record<string, DictHit[]> = {
  voulons: [{ w: "vouloir", p: "v.", form: "voulons" }],
  grimpent: [{ w: "grimper", p: "v.", zh: [["爬", ""], ["攀登", ""]], form: "grimpent" }],
};
const lookup = async (w: string) => dict[w.toLowerCase()] ?? [];

test("sentences split at end punctuation and line breaks; elisions are taken off words", () => {
  assert.deepEqual(splitSentences("Il pleut. Nous restons ici !\nÇa va ?"), ["Il pleut.", "Nous restons ici !", "Ça va ?"]);
  const t = tokenize("L'homme qu'il voit aujourd'hui");
  assert.deepEqual(t.map((x) => x.t), ["homme", "il", "voit", "aujourd'hui"]);
  assert.deepEqual([t[0].s, t[0].e], [2, 7]);
});

test("words are sorted into learning, atlas, dictionary and unknown; forms reduce to the lemma", async () => {
  const text = "Aujourd'hui, l'homme et le chat grimpent. Nous voulons une trottinette. Marie va avoir besoin de dormir. Les hommes zorglubent.";
  const out = await extractWords(text, atlas, { chat: {} }, lookup);
  const by = Object.fromEntries(out.map((c) => [c.word, c]));
  assert.equal(by["aujourd'hui"].kind, "atlas");
  assert.equal(by.homme.kind, "atlas");
  assert.equal(by.homme.count, 2, "hommes is counted under homme (plural ending)");
  assert.equal(by.chat.kind, "learning");
  assert.equal(by.vouloir.kind, "atlas", "voulons → vouloir, an atlas word");
  assert.deepEqual(by.vouloir.forms, ["voulons"]);
  assert.equal(by.grimper.kind, "dict");
  assert.equal(by.grimper.zh, "爬；攀登");
  assert.equal(by.trottinette.kind, "atlas", "a word the learner created counts as known");
  assert.equal(by["avoir besoin de"].kind, "atlas", "an atlas expression written as in the atlas is found in the sentence");
  assert.ok(!("Marie" in by), "a capitalised unknown word inside a sentence is a name");
  assert.ok(!("marié" in by), "Marie is not marié: a capitalised word matching only without accents is a name");
  assert.equal(by.zorglubent.kind, "unknown");
  assert.ok(!("le" in by) && !("et" in by), "function words are skipped");
  const s = by.grimper.sentence;
  assert.equal(s.slice(...by.grimper.span!), "grimpent");
});
