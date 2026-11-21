import assert from "node:assert/strict";
import { test } from "node:test";

import type { Atlas, WordRef } from "../atlas/types";
import { CORE_PATH, coreSet, deriveCore, isCore, topicHeadwords } from "./core-words.ts";
import type { Topic } from "./exam.ts";

const topics: Topic[] = [{ id: "t", zh: "话题", fr: "Thème", vocab: [["gaspiller / le gaspillage", "浪费"], ["un CDI (contrat)", "无固定期限合同"]] }] as Topic[];
const ref = (id: string, order: number, cefr: number, word = id): WordRef => ({ id, word, zh: id, ipa: "", cefr, topic: 0, media: 0, order });

test("topic headwords: whole phrases and content words, articles and brackets dropped", () => {
  const h = topicHeadwords(topics);
  for (const w of ["gaspiller", "le gaspillage", "gaspillage", "un cdi", "cdi"]) assert.ok(h.has(w), w);
  for (const w of ["le", "un", "contrat"]) assert.ok(!h.has(w), w);
});

test("core: the start of the path up to B2, plus topic words further down; never above B2", () => {
  const words = [ref("maison", 0, 0), ref("early-c1", 3, 4), ref("last", CORE_PATH - 1, 3), ref("late", CORE_PATH, 2), ref("gaspillage", 5000, 3, "Gaspillage"), ref("cdi", 6000, 4)];
  assert.deepEqual([...deriveCore(words, topics)], ["maison", "last", "gaspillage"]);
});

test("isCore: cached per atlas; a word the learner created counts as core", () => {
  const words = [ref("maison", 0, 0), ref("rare", 9000, 3)];
  const own = { ...ref("mon-mot", -1, -1), custom: true as const };
  const atlas = { words, byId: new Map([...words, own].map((w) => [w.id, w])) } as unknown as Atlas;
  assert.equal(coreSet(atlas), coreSet(atlas));
  assert.equal(isCore(atlas, "maison"), true);
  assert.equal(isCore(atlas, "rare"), false);
  assert.equal(isCore(atlas, "mon-mot"), true);
  assert.equal(isCore(atlas, "unknown"), false);
});
