import { resetTestDom } from "../../test-dom";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AtlasContext } from "../../atlas/context";
import { setConfusablesForTest } from "../../atlas/confusables";
import { setConjForTest, type ConjData } from "../../atlas/conj";
import type { Atlas, WordRef } from "../../atlas/types";
import type { ConjVerb } from "../../lib/conjugation";
import { setBaseFamiliesForTest } from "../../lib/families";
import { setLexdbFetcher } from "../../lib/lexdb/load";
import { href } from "../../lib/router";
import type { LexEntry, LexMeta } from "../../lib/lexdb/types";
import prendreFixture from "../../lib/lexdb/fixtures/prendre.json";
import { resetProgress, store } from "../../store/store";
import { DictEntryView } from "./DictEntryView";

const ref = (id: string, word: string, zh: string, pos: string[]): WordRef => ({
  id,
  word,
  zh,
  ipa: "",
  cefr: 1,
  topic: 0,
  media: 0,
  order: 0,
  pos,
});

function fakeAtlas(words: WordRef[]): Atlas {
  return {
    id: "test",
    name: "test",
    kind: "open",
    count: words.length,
    examples: 0,
    illustrated: 0,
    topics: [],
    cefr: [],
    words,
    byId: new Map(words.map((w) => [w.id, w])),
    entry: () => Promise.reject(new Error("not in test")),
    peek: () => undefined,
    img: () => null,
    audio: () => null,
  };
}

const ATLAS = fakeAtlas([ref("bonheur", "bonheur", "幸福；福气", ["n.m."])]);

const META: LexMeta = {
  version: 1,
  generated: "2026-11-25",
  sources: {},
  licenses: [],
  splits: [],
  hintsShards: true,
  counts: { lemmas: 1, withZh: 1 },
};

const PRENDRE_CONJ = {
  i: "prendre",
  a: "a",
  pp: "pris",
  m: "prendre",
  f: {
    pres: ["prends", "prends", "prend", "prenons", "prenez", "prennent"],
    imp: ["prenais", "prenais", "prenait", "prenions", "preniez", "prenaient"],
    fut: ["prendrai", "prendras", "prendra", "prendrons", "prendrez", "prendront"],
    cond: ["prendrais", "prendrais", "prendrait", "prendrions", "prendriez", "prendraient"],
    subj: ["prenne", "prennes", "prenne", "prenions", "preniez", "prennent"],
  },
} as unknown as ConjVerb;

const HEUREUX: LexEntry = {
  id: "heureux",
  w: "heureux",
  ipa: "œʁø",
  forms: { f: "heureuse", pl: "heureux", fpl: "heureuses" },
  pos: [
    {
      p: "adj.",
      senses: [
        {
          zh: "幸福的；幸运的",
          ex: [{ fr: "Je suis heureux de vous voir.", zh: "见到您我很高兴。", src: "tatoeba" }],
          src: ["wikt-zh"],
          conf: 2,
        },
      ],
    },
    { p: "n.m.", g: "m", senses: [{ zh: "幸福的人", src: ["wikt-fr"], conf: 1 }] },
  ],
  phrases: Array.from({ length: 7 }, (_, i) => ({ fr: `heureux ${i + 1}`, zh: `搭配${i + 1}`, src: "wikt-fr" as const, conf: 1 as const })),
  derived: ["bonheur", "heureusement"],
  syn: ["content", "joyeux"],
  ant: ["malheureux", "triste"],
  sources: ["wikt-zh", "wikt-fr"],
};

const BARE: LexEntry = {
  id: "quelconque",
  w: "quelconque",
  pos: [{ p: "adj.", senses: [{ zh: "任何的", src: ["wikt-zh"], conf: 1 }] }],
  sources: ["wikt-zh"],
};

let asked: string[] = [];
/** Let pending loaders (conj.json, confusables, hints) resolve and React flush their updates. */
const settle = () => act(() => new Promise<void>((r) => setTimeout(r, 30)));

beforeEach(() => {
  store.useDataset("francais-b2-lexicon");
  resetProgress();
  asked = [];
  setBaseFamiliesForTest([]);
  setConjForTest({ v: 1, verbs: {} });
  setConfusablesForTest({ v: 1, groups: [], byEntry: {} });
  setLexdbFetcher(async (url) => {
    asked.push(url);
    if (url === "/lexdb/meta.json") return META;
    if (url === "/lexdb/hints/h.json") return { heureusement: ["adv.", "幸运地"] };
    if (url === "/lexdb/hints/c.json") return { content: ["adj.", "满意的"] };
    if (url === "/lexdb/hints/m.json") return { malheureux: ["adj.", "不幸的"] };
    return null;
  });
});

afterEach(() => {
  cleanup();
  resetTestDom();
  setLexdbFetcher(null);
  setConjForTest(null);
  setConfusablesForTest(null);
});

const renderEntry = (entry: LexEntry, props: Partial<Parameters<typeof DictEntryView>[0]> = {}) =>
  render(
    <AtlasContext.Provider value={ATLAS}>
      <DictEntryView entry={entry} {...props} />
    </AtlasContext.Provider>,
  );

// role queries are very slow in happy-dom once a conjugation table is on the page: look tabs up in the tab bar directly
const tabEls = () => [...document.querySelectorAll<HTMLButtonElement>(".dict-tabs [role=tab]")];
const tabNames = () => tabEls().map((t) => t.textContent ?? "");
const tabBtn = (name: RegExp | string) =>
  tabEls().find((t) => (typeof name === "string" ? t.textContent === name : name.test(t.textContent ?? ""))) ?? null;
const chip = (w: string) => document.querySelector<HTMLAnchorElement>(`a.dict-rel-chip[href="${href({ page: "dict", w })}"]`);

test("relations, phrases, forms and gender render frdic-style with clickable chips and lazy hints", async () => {
  renderEntry(HEUREUX);

  const tabs = tabNames();
  assert.deepEqual(
    tabs.map((t) => t.replace(/\(\d+\)/, "").trim()),
    ["法汉释义", "派生·近反义", "短语搭配", "法语例句", "笔记"],
  );
  assert.ok(tabs[1].includes("(6)"), "relation count is the number of unique related words");

  // forms bar and gender badge
  assert.ok(document.querySelector(".dict-forms-bar")?.textContent?.includes("heureuse"));
  assert.ok(screen.getByText("阳性"));

  // relation panel: derived, then syn, then ant
  const panel = document.querySelector(".dict-panel-rel");
  assert.ok(panel);
  const headings = [...panel.querySelectorAll(".dict-rel-group h3")].map((h) => h.textContent);
  assert.deepEqual(headings, ["派生 / 同族词", "同义词 / 近义词", "反义词"]);

  // every chip is a dict link right away; bonheur's hint comes from the atlas already in memory
  for (const w of ["bonheur", "heureusement", "content", "joyeux", "malheureux", "triste"]) assert.ok(chip(w), w);
  assert.equal(chip("bonheur")?.querySelector("small")?.textContent, "n.m. 幸福；福气");

  // the rest come from the 1-letter hints shards, fetched lazily (only the needed buckets)
  await settle();
  assert.equal(chip("heureusement")?.querySelector("small")?.textContent, "adv. 幸运地");
  assert.equal(chip("content")?.querySelector("small")?.textContent, "满意的", "synonyms show the gloss without POS");
  assert.equal(chip("malheureux")?.querySelector("small")?.textContent, "不幸的");
  assert.equal(chip("triste")?.querySelector("small"), null, "a word without a hint is still a clean link");
  assert.deepEqual(
    [...new Set(asked)].sort(),
    ["/lexdb/hints/c.json", "/lexdb/hints/h.json", "/lexdb/hints/j.json", "/lexdb/hints/m.json", "/lexdb/hints/t.json", "/lexdb/meta.json"],
  );

  // phrases panel shows the first 6 and a jump to all of them
  const phrases = document.querySelector(".dict-panel-phrases");
  assert.ok(phrases?.querySelector("summary")?.textContent?.includes("常用搭配与固定表达（7）"));
  assert.equal(phrases?.querySelectorAll(".dict-phrase-item").length, 6);
  assert.equal(phrases?.querySelector(".dict-phrase-fr")?.getAttribute("href"), "#/dict?w=heureux+1");
  fireEvent.click(screen.getByRole("button", { name: "查看全部 7 条搭配 →" }));
  assert.equal(tabBtn(/短语搭配/)!.getAttribute("aria-selected"), "true");
  assert.equal(document.querySelectorAll(".dict-phrase-item").length, 7);

  fireEvent.click(tabBtn(/派生·近反义/)!);
  assert.ok(chip("bonheur"));
  assert.ok(!document.body.textContent?.includes("暂未收录"));
});

test("empty sections and tabs are hidden; confusable-only etym shows 易混词辨析 without an empty 词源", async () => {
  const { unmount } = renderEntry(BARE);
  assert.deepEqual(tabNames(), ["法汉释义", "笔记"]);
  assert.equal(document.querySelector(".dict-panel-rel"), null);
  assert.equal(document.querySelector(".dict-panel-phrases"), null);
  assert.equal(document.querySelector(".dict-panel-examples"), null);
  assert.ok(!document.body.textContent?.includes("暂未收录"));
  assert.ok(!document.body.textContent?.includes("派生词 · 同义词 · 反义词"));
  // nothing to hint: no hints shard is ever requested
  await settle();
  assert.ok(!asked.some((u) => u.includes("/hints/")));
  unmount();

  setConfusablesForTest({
    v: 1,
    groups: [
      {
        id: "quel-qu",
        kind: "meaning",
        title: "quelconque / quelque",
        zh: "任何的 vs 一些",
        items: [
          { w: "quelconque", zh: "任何的", rule: "放名词后", ex: { fr: "Un livre quelconque.", zh: "随便一本书。" } },
          { w: "quelque", zh: "一些", rule: "放名词前", ex: { fr: "Quelque chose.", zh: "某事。" } },
        ],
      },
    ],
    byEntry: { quelconque: ["quel-qu"] },
  });
  renderEntry(BARE);
  await settle();
  assert.ok(tabNames().includes("词源与辨析"));
  fireEvent.click(tabBtn("词源与辨析")!);
  assert.ok(screen.getByText("易混词辨析"));
  assert.equal(screen.queryByText("词源"), null);
  assert.ok(!document.body.textContent?.includes("暂未收录"));
});

test("initialTab=conj lands on the conjugation table; falls back to 法汉释义 when conj.json lacks the verb", async () => {
  const prendre = prendreFixture as LexEntry;
  setConjForTest({ v: 1, verbs: { prendre: PRENDRE_CONJ } } as ConjData);
  const { unmount } = renderEntry(prendre, { initialTab: "conj" });
  assert.equal(tabBtn("动词变位")!.getAttribute("aria-selected"), "true");
  await settle();
  assert.ok(document.querySelector(".conj-table"));
  assert.ok(/prends/.test(document.querySelector(".conj-table")?.textContent ?? ""));
  // its derived words are dict links too
  fireEvent.click(tabBtn(/法汉释义/)!);
  assert.ok(chip("comprendre"));
  assert.equal(document.querySelector(".dict-conj-bar button")?.textContent, "查看动词变位 →");
  unmount();

  setConjForTest({ v: 1, verbs: {} });
  renderEntry(prendre, { initialTab: "conj" });
  assert.equal(tabBtn("动词变位")!.getAttribute("aria-selected"), "true", "shown while conj.json loads");
  await settle();
  assert.equal(tabBtn("动词变位"), null);
  assert.equal(tabBtn(/法汉释义/)!.getAttribute("aria-selected"), "true");
});

test("an unavailable initialTab (e.g. relations on a bare entry) opens 法汉释义", () => {
  renderEntry(BARE, { initialTab: "relations" });
  assert.equal(tabBtn(/法汉释义/)!.getAttribute("aria-selected"), "true");
  assert.ok(tabBtn(/笔记/));
});
