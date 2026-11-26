import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { duePoints, ESSAY_TAG, essayErrors, mineDrills, nextPoint, pickDrills, roundGrade, tagKey, untouchedWithErrors } from "../store/grammar.ts";
import { Rating, type CardState } from "../store/srs.ts";
import { emptyProgress as blankProgress } from "../store/store.ts";
import {
  answerOf,
  checkTyped,
  fixedOf,
  joinOrderTokens,
  orderRight,
  parseGrammarMarks,
  sameTokenMultiset,
  shuffled,
  stripGrammarMarks,
  tagLabel,
  tagsOf,
  validateGrammarMarks,
  type GrammarData,
  type GrammarPoint,
  type OrderDrill,
} from "./grammar.ts";

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
      assert.equal(joinOrderTokens(d.t, d.p).toLowerCase(), d.s.toLowerCase(), p.id);
      for (const alt of d.alts ?? []) assert.ok(sameTokenMultiset(alt, d.t), `${p.id}: alt is not a reordering of t`);
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

test("joinOrderTokens glues elisions, hyphenated clitics and commas", () => {
  assert.equal(joinOrderTokens(["donne", "-le", "-moi"], " !"), "donne-le-moi !");
  assert.equal(joinOrderTokens(["quand", "viendra", "-t-il"], " ?"), "quand viendra-t-il ?");
  assert.equal(joinOrderTokens(["je", "ne", "l'", "ai", "pas", "vu"], "."), "je ne l'ai pas vu.");
  assert.equal(joinOrderTokens(["qu'", "il", "vienne"], ""), "qu'il vienne");
  assert.equal(joinOrderTokens(["j’", "y", "vais"], "."), "j’y vais.");
  assert.equal(joinOrderTokens(["hier", ",", "il", "pleuvait"], "."), "hier, il pleuvait.");
  assert.equal(joinOrderTokens(["vas", "-y"], " !"), "vas-y !");
  assert.equal(joinOrderTokens([], "."), ".");
});

test("strict order drills accept only t and alts; old drills keep the movable-adjunct rule", () => {
  const strict: OrderDrill = {
    k: "o",
    s: "Il parle en français.",
    z: "",
    h: "",
    y: "",
    t: ["il", "parle", "en", "français"],
    p: ".",
    strict: true,
  };
  assert.ok(orderRight(strict, ["Il", "parle", "en", "français"]));
  assert.ok(!orderRight(strict, ["en", "français", "il", "parle"]), "no heuristic moving of en … in strict mode");

  const withAlt: OrderDrill = {
    k: "o",
    s: "Hier, je suis allé au cinéma.",
    z: "",
    h: "",
    y: "",
    t: ["hier", ",", "je", "suis", "allé", "au", "cinéma"],
    p: ".",
    alts: [["je", "suis", "allé", "au", "cinéma", "hier", ","]],
    strict: true,
  };
  assert.equal(joinOrderTokens(withAlt.t, withAlt.p), "hier, je suis allé au cinéma.");
  assert.ok(orderRight(withAlt, ["Hier", ",", "je", "suis", "allé", "au", "cinéma"]));
  assert.ok(orderRight(withAlt, ["je", "suis", "allé", "au", "cinéma", "hier", ","]));
  assert.ok(!orderRight(withAlt, ["je", "suis", "allé", "hier", ",", "au", "cinéma"]));

  const imperative: OrderDrill = { k: "o", s: "Donne-le-moi !", z: "", h: "", y: "", t: ["donne", "-le", "-moi"], p: " !", strict: true };
  assert.ok(orderRight(imperative, ["donne", "-le", "-moi"]));
  assert.ok(!orderRight(imperative, ["donne", "-moi", "-le"]));
  const inv: OrderDrill = { k: "o", s: "Quand viendra-t-il ?", z: "", h: "", y: "", t: ["quand", "viendra", "-t-il"], p: " ?", strict: true };
  assert.ok(orderRight(inv, ["Quand", "viendra", "-t-il"]));
  assert.ok(orderRight(inv, ["quand", "viendra", "-t-il"]));
  assert.ok(!orderRight(inv, ["viendra", "-t-il", "quand"]));

  // a non-strict automatic drill still lets a time adverb move to the other end
  const auto: OrderDrill = { k: "o", s: "Demain je ne viens pas.", z: "", h: "", y: "", t: ["demain", "je", "ne", "viens", "pas"], p: "." };
  assert.ok(orderRight(auto, ["je", "ne", "viens", "pas", "demain"]));
  assert.ok(!orderRight({ ...auto, strict: true }, ["je", "ne", "viens", "pas", "demain"]));

  assert.ok(sameTokenMultiset(["a", "B", "l'"], ["l’", "b", "a"]));
  assert.ok(!sameTokenMultiset(["a", "b"], ["a", "a"]));
});

test("grammar marks: strip, parse (affix vs whole word) and validate", () => {
  const s = "Je parl{v:ais} {p:de} lui {k:bien que} elle soit achet{a:ées} ; l'{c:ai}";
  assert.equal(stripGrammarMarks(s), "Je parlais de lui bien que elle soit achetées ; l'ai");
  const segs = parseGrammarMarks(s);
  assert.deepEqual(segs.find((x) => x.text === "ais"), { text: "ais", mark: "v", affix: true });
  assert.deepEqual(segs.find((x) => x.text === "de"), { text: "de", mark: "p" });
  assert.deepEqual(segs.find((x) => x.text === "bien que"), { text: "bien que", mark: "k" });
  assert.deepEqual(segs.find((x) => x.text === "ées"), { text: "ées", mark: "a", affix: true });
  assert.deepEqual(segs.find((x) => x.text === "ai"), { text: "ai", mark: "c", affix: true });
  assert.equal(segs.map((x) => x.text).join(""), stripGrammarMarks(s));
  assert.deepEqual(parseGrammarMarks("plain"), [{ text: "plain" }]);
  assert.deepEqual(parseGrammarMarks("{c:le lui}"), [{ text: "le lui", mark: "c" }]);
  assert.deepEqual(parseGrammarMarks("{c:l'}ai")[0], { text: "l'", mark: "c", affix: true });
  assert.deepEqual(parseGrammarMarks("je {c:la} vois")[1], { text: "la", mark: "c" });

  assert.equal(validateGrammarMarks(s), null);
  assert.equal(validateGrammarMarks("no marks at all"), null);
  assert.match(validateGrammarMarks("un {v:ais") ?? "", /unclosed/);
  assert.match(validateGrammarMarks("un v:ais}") ?? "", /unmatched/);
  assert.match(validateGrammarMarks("{x:foo}") ?? "", /unknown/);
  assert.match(validateGrammarMarks("{v:}") ?? "", /empty/);
  assert.match(validateGrammarMarks("{v:  }") ?? "", /empty/);
  assert.match(validateGrammarMarks("{v:a{p:b}}") ?? "", /nested/);
  assert.match(validateGrammarMarks("{foo}") ?? "", /kind/);
});
