import assert from "node:assert/strict";
import { test } from "node:test";
import type { Atlas, WordRef } from "../atlas/types.ts";
import { customRef, withUserData } from "../atlas/merge.ts";
import { deckWords } from "../store/decks.ts";
import { CORE_DECK, emptyProgress } from "../store/store.ts";
import { searchAtlas } from "../lib/search.ts";
import { layoutGalaxy } from "./layout.ts";

test("deck browsing and search isolate membership, including custom and hidden words", () => {
  const words: WordRef[] = ["chat", "chien"].map((id, order) => ({
    id, word: id, zh: id === "chat" ? "猫" : "狗", ipa: "", cefr: 0, topic: 0, media: 0, order,
  }));
  const base = { words, byId: new Map(words.map((w) => [w.id, w])), topics: [["animals", "动物"]] } as Atlas;
  const custom = { w: "baguette", pos: "n.f.", zh: "长棍面包", created: 1 };
  const atlas = withUserData(base, { "u-bread1": custom }, undefined);
  const progress = {
    ...emptyProgress("test"),
    hidden: ["chien"],
    decks: [
      { id: "d-food1", name: "食物", words: ["u-bread1", "chien", "missing"], created: 1 },
      { id: "d-empty1", name: "空卡组", words: [], created: 1 },
    ],
  };
  assert.deepEqual(deckWords(atlas, progress, CORE_DECK), ["chat"]);
  const scoped = deckWords(atlas, progress, "d-food1").map((id) => atlas.byId.get(id)!);
  assert.deepEqual(scoped.map((w) => w.id), ["u-bread1", "chien"]);
  assert.deepEqual(searchAtlas({ words: scoped }, "chat"), []);
  assert.deepEqual(searchAtlas({ words: scoped }, "面包").map((w) => w.id), ["u-bread1"]);
  assert.deepEqual(deckWords(atlas, progress, "d-empty1"), []);

  const layout = layoutGalaxy(atlas, scoped);
  assert.deepEqual(layout.ids, ["u-bread1", "chien"]);
  assert.equal(layout.n, 2);
  assert.ok([...layout.positions, ...layout.colors, ...layout.seeds].every(Number.isFinite));
  assert.deepEqual(layout.topics.at(-1), ["custom", "自建词"]);
  assert.deepEqual(layout.topicCounts, [1, 1]);
  const customOnly = layoutGalaxy(atlas, [customRef("u-bread1", custom)]);
  assert.ok([...customOnly.positions].every(Number.isFinite));
  assert.deepEqual(customOnly.topicCounts, [0, 1]);
  assert.equal(layoutGalaxy(atlas, []).n, 0);
});
