import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { scoreTcfReceptive, scoreTefItems699 } from "./exam-tracks.ts";
import { tagsOf, type GrammarData, type GrammarMeta } from "./grammar.ts";
import { drawGrammarSprint, GRAMMAR_SPRINT_BANK } from "./grammar-sprint.ts";
import { applySprintResult, tagKey } from "../store/grammar.ts";
import { review, Rating } from "../store/srs.ts";
import { dayKey, emptyProgress } from "../store/store.ts";

const grammarMeta = JSON.parse(
  fs.readFileSync(new URL("../../public/atlas/grammar-meta.json", import.meta.url), "utf8"),
) as GrammarMeta;
const grammarFull = JSON.parse(
  fs.readFileSync(new URL("../../public/atlas/grammar.json", import.meta.url), "utf8"),
) as GrammarData;

test("M23-C: GRAMMAR_SPRINT_BANK has 84 curated 4-option items with 100% valid grammar-meta points", () => {
  assert.ok(GRAMMAR_SPRINT_BANK.length >= 80, `expected >= 80 items, got ${GRAMMAR_SPRINT_BANK.length}`);
  assert.equal(GRAMMAR_SPRINT_BANK.length, 84);

  const metaIds = new Set(grammarMeta.points.map((p) => p.id));
  const fullById = new Map(grammarFull.points.map((p) => [p.id, p]));
  const seenIds = new Set<string>();

  for (const item of GRAMMAR_SPRINT_BANK) {
    assert.ok(!seenIds.has(item.id), `duplicate sprint item id: ${item.id}`);
    seenIds.add(item.id);
    assert.ok(["structure", "lexique", "error"].includes(item.category), `${item.id}: bad category`);
    assert.ok([1, 2, 3, 4, 5, 6].includes(item.difficulty), `${item.id}: bad difficulty`);
    assert.ok(item.prompt.trim().length > 10, `${item.id}: prompt too short`);
    if (item.category === "error") {
      assert.ok(
        item.prompt.includes("[A]") && item.prompt.includes("[B]") && item.prompt.includes("[C]") && item.prompt.includes("[D]"),
        `${item.id}: error item must mark [A]..[D]`,
      );
    } else {
      assert.ok(item.prompt.includes("____"), `${item.id}: fill item must include ____ blank`);
    }
    assert.equal(item.options.length, 4, `${item.id}: expected 4 options`);
    assert.equal(
      new Set(item.options.map((o) => o.trim().toLowerCase())).size,
      4,
      `${item.id}: duplicate option in ${item.options.join(" | ")}`,
    );
    assert.ok([0, 1, 2, 3].includes(item.answer), `${item.id}: invalid answer index ${item.answer}`);
    assert.ok(item.why.trim().length > 5 && !item.why.includes("Wait"), `${item.id}: invalid why`);
    assert.ok(metaIds.has(item.point), `${item.id}: point "${item.point}" missing from grammar-meta.json`);
    const pt = fullById.get(item.point);
    assert.ok(pt, `${item.id}: point "${item.point}" missing from grammar.json`);
    if (item.tag) {
      assert.ok(new Set(tagsOf(pt)).has(item.tag), `${item.id}: invalid tag "${item.tag}" for ${item.point}`);
    }
  }
});

test("M23-C: drawGrammarSprint returns 18 sorted TCF items and 40 sorted stratified TEF items deterministically", () => {
  const tcfA = drawGrammarSprint("tcf", 2026);
  const tcfB = drawGrammarSprint("tcf", 2026);
  const tcfC = drawGrammarSprint("tcf", 9999);

  assert.equal(tcfA.length, 18);
  assert.deepEqual(
    tcfA.map((x) => x.id),
    tcfB.map((x) => x.id),
    "same seed produces identical TCF sprint",
  );
  assert.notDeepEqual(
    tcfA.map((x) => x.id),
    tcfC.map((x) => x.id),
    "different seeds vary TCF sprint selection",
  );
  assert.equal(new Set(tcfA.map((x) => x.id)).size, 18);
  assert.ok(tcfA.every((x) => x.category === "structure"), "TCF sprint uses structure items");
  for (let i = 1; i < tcfA.length; i++) {
    assert.ok(tcfA[i].difficulty >= tcfA[i - 1].difficulty, "TCF items sorted in ascending difficulty");
  }

  const tefA = drawGrammarSprint("tef", 2026);
  const tefB = drawGrammarSprint("tef", 2026);
  assert.equal(tefA.length, 40);
  assert.deepEqual(
    tefA.map((x) => x.id),
    tefB.map((x) => x.id),
    "same seed produces identical TEF sprint",
  );
  assert.equal(new Set(tefA.map((x) => x.id)).size, 40);
  const cats = new Set(tefA.map((x) => x.category));
  assert.ok(cats.has("structure") && cats.has("lexique") && cats.has("error"), "TEF sprint stratifies all 3 categories");
  for (let i = 1; i < tefA.length; i++) {
    assert.ok(tefA[i].difficulty >= tefA[i - 1].difficulty, "TEF items sorted in ascending difficulty");
  }

  // Verify TCF & TEF official 699 scoring integration
  const tcfScore = scoreTcfReceptive(
    tcfA.map((it, idx) => ({ correct: idx < 14, difficulty: it.difficulty })),
    "struct",
  );
  assert.ok(tcfScore.score699 >= 400 && tcfScore.score699 <= 699);
  assert.ok(tcfScore.nclc >= 6);

  const tefScore = scoreTefItems699(
    tefA.map((it, idx) => ({ correct: idx < 30, difficulty: it.difficulty })),
    "struct",
  );
  assert.ok(tefScore.score699 >= 400 && tefScore.score699 <= 699);
  assert.ok(tefScore.b2Passed);
});

test("M23-C: applySprintResult schedules missed points as Rating.Again even when mixed with correct items", () => {
  const now = 1_730_500_000_000;
  let p = emptyProgress("test");
  // Pre-seed accord-pp through learning steps into State.Review (st === 2)
  const step1 = review(undefined, Rating.Good, now - 86_400_000 * 15);
  const step2 = review(step1, Rating.Good, now - 86_400_000 * 14);
  const mature = review(step2, Rating.Good, now - 86_400_000 * 5);
  assert.equal(mature.st, 2);
  p.gram = { "accord-pp": mature };

  p = applySprintResult(
    p,
    [
      { point: "accord-pp", tag: "r1", ok: true },
      { point: "accord-pp", tag: "t0", ok: false }, // 1 miss forces Rating.Again (Relearning)
      { point: "cond-passe", tag: "r1", ok: false }, // new missed point -> Rating.Again (1m)
      { point: "futur-anterieur", tag: "r1", ok: true }, // new right point -> Rating.Good (10m)
    ],
    now,
    0.9,
  );

  assert.equal(p.gram!["accord-pp"].lapses, mature.lapses + 1, "missed mature sprint item triggers lapse (Rating.Again)");
  assert.equal(p.gram!["accord-pp"].st, 3, "missed mature card enters Relearning state");
  assert.ok(p.gram!["futur-anterieur"].due > p.gram!["cond-passe"].due, "Good schedules further than Again");
  assert.deepEqual(p.gramDays?.[dayKey(new Date(now))], { n: 2, r: 4, c: 2 });
  assert.deepEqual(p.gramTags?.[tagKey("accord-pp", "t0")], { n: 1, w: 1 });
});
