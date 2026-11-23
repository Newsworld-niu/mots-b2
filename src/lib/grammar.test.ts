import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { duePoints, ESSAY_TAG, essayErrors, mineDrills, nextPoint, pickDrills, roundGrade, tagKey, untouchedWithErrors } from "../store/grammar.ts";
import { Rating, type CardState } from "../store/srs.ts";
import { emptyProgress as blankProgress } from "../store/store.ts";
import { answerOf, checkTyped, fixedOf, orderRight, shuffled, tagLabel, tagsOf, type GrammarData, type GrammarPoint, type OrderDrill } from "./grammar.ts";

const data: GrammarData = JSON.parse(readFileSync(new URL("../../public/atlas/grammar.json", import.meta.url), "utf8"));
const emptyProgress = () => blankProgress("test");

const card = (due: number, last: number): CardState => ({
  due,
  s: 5,
  d: 5,
  el: 0,
  sd: 5,
  ls: 0,
  reps: 1,
  lapses: 0,
  st: 2,
  last,
  seen: last,
});

test("every point has an explanation and enough drills for a round", () => {
  assert.ok(data.points.length >= 10);
  for (const p of data.points) {
    assert.ok(p.title && p.intro && p.rules.length, p.id);
    assert.ok(p.drills.length >= 8, `${p.id} has ${p.drills.length} drills`);
  }
});

test("choice, typed, fix and transform drills are well-formed", () => {
  for (const p of data.points) {
    const validTags = new Set(tagsOf(p));
    for (const d of p.drills) {
      if (d.g) assert.ok(validTags.has(d.g), `${p.id}: unknown tag ${d.g}`);
      if (d.k === "c") {
        const a = answerOf(d);
        assert.ok(a.trim(), `${p.id}: empty blank in ${d.s}`);
        assert.ok(d.o.includes(a), `${p.id}: ${a} not in ${d.o} (${d.s})`);
        assert.equal(new Set(d.o.map((o) => o.toLowerCase())).size, d.o.length, `${p.id}: repeated option in ${d.o}`);
      } else if (d.k === "t") {
        const a = answerOf(d);
        assert.ok(a.trim() && d.a.includes(a) && d.h.trim(), `${p.id}: bad typed drill ${d.s}`);
      } else if (d.k === "f") {
        const seg = d.s.slice(d.b[0], d.b[1]);
        assert.ok(seg.trim(), `${p.id}: empty fix span in ${d.s}`);
        assert.ok(d.r.every((x) => x.trim() && x.trim() !== seg.trim()), `${p.id}: bad fix correction in ${d.s}`);
        assert.ok(fixedOf(d).length > 0);
      } else if (d.k === "x") {
        assert.ok(d.q.trim() && d.h.trim() && d.a.length > 0 && d.a[0] === d.s, `${p.id}: bad transform drill`);
      }
    }
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

test("typed answers distinguish exact, lexical accent-only, contrastive diacritic/cedilla wrong, 1990 variants, and cloze elisions", () => {
  assert.equal(checkTyped("  Il m’a dit qu'il viendrait. ", ["Il m'a dit qu'il viendrait"]), "right");
  assert.equal(checkTyped("ecrites", ["écrites"]), "accent");
  assert.equal(checkTyped("soeur", ["sœur"]), "accent");
  assert.equal(checkTyped("ecrit", ["écrites"]), "wrong");
  assert.equal(checkTyped("", ["écrites"]), "wrong");
  // Contrastive morphosyntax / phonological errors are strictly wrong, never excused as accent-only
  assert.equal(checkTyped("parle", ["parlé"]), "wrong");
  assert.equal(checkTyped("entree", ["entrée"]), "wrong");
  assert.equal(checkTyped("commenca", ["commença"]), "wrong");
  assert.equal(checkTyped("remplacant", ["remplaçant"]), "wrong");
  assert.equal(checkTyped("ou", ["où"]), "wrong");
  assert.equal(checkTyped("a", ["à"]), "wrong");
  assert.equal(checkTyped("du", ["dû"]), "wrong");
  // 1990 spelling reforms accepted as right
  assert.equal(checkTyped("évènement", ["événement"]), "right");
  assert.equal(checkTyped("cèderai", ["céderai"]), "right");
  // Boundary elision assembly
  assert.equal(checkTyped("qu'il", ["il"], { before: "Je pense que ", after: " viendra." }), "right");
  assert.equal(checkTyped("il", ["qu'il"], { before: "Je pense qu'", after: " viendra." }), "right");
});

test("a round is graded by its slips", () => {
  assert.equal(roundGrade(0, 8), Rating.Good);
  assert.equal(roundGrade(1, 8), Rating.Hard);
  assert.equal(roundGrade(3, 8), Rating.Again);
  assert.equal(roundGrade(1, 4), Rating.Hard);
  assert.equal(roundGrade(2, 4), Rating.Again);
});

test("pickDrills spreads across tags, varies kinds, favours weak tags and folds in essay mistakes", () => {
  const pt = data.points.find((p) => p.id === "subj-indicatif")!;
  assert.ok(pt.drills.some((d) => d.k === "f") && pt.drills.some((d) => d.k === "t"));
  const p = emptyProgress();
  const mine = mineDrills([{ wrong: "Bien qu'il est tard", right: "Bien qu'il soit tard", why: "bien que + 虚拟式", at: 10 }]);
  const picked = pickDrills(pt, p, 8, 42, mine);
  assert.equal(picked.length, 8);
  assert.ok(picked.some((d) => d.g === ESSAY_TAG), "includes the learner's essay mistake");
  assert.ok(new Set(picked.map((d) => d.k)).size >= 3, "mixes drill kinds");
  assert.ok(new Set(picked.map((d) => d.g)).size >= 5, "spreads over tags");

  // make r2 weak and all other tags strong: r2 should come up much more often across seeds
  const weakP = emptyProgress();
  weakP.gramTags = Object.fromEntries(tagsOf(pt).map((t) => [tagKey(pt.id, t), t === "r2" ? { n: 10, w: 9 } : { n: 10, w: 0 }]));
  let r2 = 0;
  let r0 = 0;
  for (let s = 1; s <= 40; s++) {
    for (const d of pickDrills(pt, weakP, 8, s)) {
      if (d.g === "r2") r2++;
      if (d.g === "r0") r0++;
    }
  }
  assert.ok(r2 > r0 * 1.5, `expected weak tag r2 (${r2}) >> strong tag r0 (${r0})`);
  assert.ok(tagLabel(pt, "r0").length > 0 && tagLabel(pt, "t0").length > 0);
});

test("essay mistakes make a practised point due and flag unstarted points; nextPoint respects prereq", () => {
  const mini: GrammarData = {
    v: 1,
    points: [
      { id: "a", level: "A1", title: "A", fr: "A", intro: "A", rules: [], traps: [], prereq: ["b"], drills: [] },
      { id: "b", level: "A1", title: "B", fr: "B", intro: "B", rules: [], traps: [], drills: [] },
    ] as GrammarPoint[],
  };
  const now = 1_000_000;
  const p = emptyProgress();
  assert.equal(nextPoint(mini, p)?.id, "b");
  p.gram = { b: card(now + 86_400_000, now - 10_000) };
  assert.equal(nextPoint(mini, p)?.id, "a");
  assert.deepEqual(duePoints(mini, p, now), []);
  p.essayNotes = [
    { id: "n1", wrong: "Je suis allé à France", right: "Je suis allé en France", type: "preposition", why: "阴性国名用 en", point: "b", at: now - 1_000, from: "test" },
    { id: "n2", wrong: "Bien qu'il est là", right: "Bien qu'il soit là", type: "tense", why: "bien que + 虚拟式", point: "a", at: now - 1_000, from: "test" },
  ];
  assert.equal(essayErrors(p).get("b")?.length, 1);
  assert.deepEqual(duePoints(mini, p, now), ["b"], "newer essay error brings b back for review");
  assert.deepEqual(
    untouchedWithErrors(mini, p).map((x) => x.point.id),
    ["a"],
  );
});
