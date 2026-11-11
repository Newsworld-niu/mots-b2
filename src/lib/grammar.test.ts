import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { roundGrade } from "../store/grammar.ts";
import { Rating } from "../store/srs.ts";
import { answerOf, orderRight, shuffled, type GrammarData, type OrderDrill } from "./grammar.ts";

const data: GrammarData = JSON.parse(readFileSync(new URL("../../public/atlas/grammar.json", import.meta.url), "utf8"));

test("every point has an explanation and enough drills for a round", () => {
  assert.ok(data.points.length >= 10);
  for (const p of data.points) {
    assert.ok(p.title && p.intro && p.rules.length, p.id);
    assert.ok(p.drills.length >= 8, `${p.id} has ${p.drills.length} drills`);
  }
});

test("a choice drill's answer is in the sentence and among distinct options", () => {
  for (const p of data.points)
    for (const d of p.drills) {
      if (d.k !== "c") continue;
      const a = answerOf(d);
      assert.ok(a.trim(), `${p.id}: empty blank in ${d.s}`);
      assert.ok(d.o.includes(a), `${p.id}: ${a} not in ${d.o} (${d.s})`);
      assert.equal(new Set(d.o.map((o) => o.toLowerCase())).size, d.o.length, `${p.id}: repeated option in ${d.o}`);
    }
});

test("an order drill's words rebuild its sentence", () => {
  for (const p of data.points)
    for (const d of p.drills) {
      if (d.k !== "o") continue;
      const joined = d.t.map((w, i) => (i > 0 && !d.t[i - 1].endsWith("'") ? " " : "") + w).join("") + d.p;
      assert.equal(joined.toLowerCase(), d.s.toLowerCase(), p.id);
    }
});

test("order answers ignore case; shuffles are never already in order", () => {
  const d = { k: "o", s: "Je ne sais pas.", z: "", t: ["je", "ne", "sais", "pas"], p: ".", h: "", y: "" } as OrderDrill;
  assert.ok(orderRight(d, ["Je", "ne", "sais", "pas"]));
  assert.ok(!orderRight(d, ["je", "sais", "ne", "pas"]));
  for (let seed = 0; seed < 50; seed++) assert.notDeepEqual(shuffled(d.t, seed), d.t);
});

test("a round is graded by its slips", () => {
  assert.equal(roundGrade(0, 8), Rating.Good);
  assert.equal(roundGrade(1, 8), Rating.Hard);
  assert.equal(roundGrade(3, 8), Rating.Again);
  assert.equal(roundGrade(1, 4), Rating.Hard);
  assert.equal(roundGrade(2, 4), Rating.Again);
});
