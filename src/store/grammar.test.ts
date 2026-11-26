import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import type { Drill, GrammarData, GrammarPoint } from "../lib/grammar.ts";
import { DISCOURSE_EXERCISES } from "../lib/grammar-discourse.ts";
import { recordSpeakingCorrections } from "./essays.ts";
import {
  applyDiscourseResult,
  applyPointRound,
  countMatchingDrills,
  duePoints,
  ESSAY_TAG,
  essayErrors,
  mineDrills,
  nextPoint,
  pickDrills,
  roundGrade,
  shouldAmendRewrite,
  tagKey,
  untouchedWithErrors,
} from "./grammar.ts";
import { review, Rating } from "./srs.ts";
import { dayKey, emptyProgress, sanitizeProgress } from "./store.ts";

const grammar = JSON.parse(fs.readFileSync("public/atlas/grammar.json", "utf8")) as GrammarData;

test("PE-7: nextPoint follows startLevel and prioritizes B1/B2 exam syllabus points", () => {
  const empty = emptyProgress("t");
  assert.equal(nextPoint(grammar, empty, 0)?.id, "art-gender");

  const b1First = nextPoint(grammar, empty, 2);
  assert.equal(b1First?.id, "subjonctif");

  const b2First = nextPoint(grammar, empty, 3);
  assert.equal(b2First?.id, "subj-indicatif");

  // Once all B1/B2 points are started, falls back to remaining lower-level points
  const allB1B2Done = emptyProgress("t");
  allB1B2Done.gram = Object.fromEntries(
    grammar.points.filter((g) => g.level === "B1" || g.level === "B2").map((g) => [g.id, review(undefined, Rating.Good, 0)]),
  );
  assert.equal(nextPoint(grammar, allB1B2Done, 2)?.id, "art-gender");
});

test("PE-7 & M3B: 46 discourse exercises cover B1/B2 multi-clause grammar with valid grammar-meta point links and sync mastery", () => {
  const ids = new Set(grammar.points.map((p) => p.id));
  const meta = JSON.parse(fs.readFileSync("public/atlas/grammar-meta.json", "utf8")) as { points: { id: string }[] };
  const metaIds = new Set(meta.points.map((m) => m.id));
  assert.equal(DISCOURSE_EXERCISES.length, 46);
  const seenIds = new Set<string>();
  for (const ex of DISCOURSE_EXERCISES) {
    assert.ok(!seenIds.has(ex.id), `duplicate discourse id: ${ex.id}`);
    seenIds.add(ex.id);
    assert.ok(ex.slots.length >= 4);
    for (let i = 0; i < ex.slots.length; i++) {
      assert.ok(ex.text.includes(`{{${i}}}`), `${ex.id} must include {{${i}}}`);
      const slot = ex.slots[i];
      assert.ok(ids.has(slot.point), `${slot.point} must exist in grammar.json`);
      assert.ok(metaIds.has(slot.point), `${slot.point} must exist in grammar-meta.json`);
      assert.ok(slot.options.includes(slot.answer[0]), `${ex.id} slot ${slot.id} options missing canonical answer`);
    }
  }

  const now = 1_710_000_000_000;
  const p0 = emptyProgress("t");
  const p1 = applyDiscourseResult(
    p0,
    [
      { point: "subjonctif", ok: true },
      { point: "relatifs-composes", ok: false },
      { point: "subjonctif", ok: true },
    ],
    now,
    0.9,
  );
  assert.ok(p1.gram?.subjonctif);
  assert.ok(p1.gram?.["relatifs-composes"]);
  assert.ok(p1.gram.subjonctif.due > p1.gram["relatifs-composes"].due);
  assert.deepEqual(p1.gramDays?.[dayKey(new Date(now))], { n: 2, r: 3, c: 2 });
  assert.deepEqual(p1.gramTags?.[tagKey("relatifs-composes", "discourse")], { n: 1, w: 1 });
  assert.deepEqual(p1.gramTags?.[tagKey("subjonctif", "discourse")], { n: 2, w: 0 });
});

test("PE-8: only exact 'correct' rewrite verdict amends answer; 'almost' retains error weight for SRS", () => {
  assert.equal(shouldAmendRewrite("correct"), true);
  assert.equal(shouldAmendRewrite("almost"), false);
  assert.equal(shouldAmendRewrite("wrong"), false);

  // Keeping 1 error in a 4-drill review prevents Rating.Good interval inflation
  assert.equal(roundGrade(0, 4), Rating.Good);
  assert.equal(roundGrade(1, 4), Rating.Hard);
  assert.equal(roundGrade(2, 4), Rating.Again);
});

test("SYS-7: speaking corrections survive sanitization and feed into essayErrors/mineDrills/duePoints loop", () => {
  const now = 1_700_000_000_000;
  let p = emptyProgress("t");
  assert.equal(recordSpeakingCorrections(p, "   ", [{ wrong: "a", right: "b", type: "other", why: "", point: "subjonctif" }]), null);
  assert.equal(recordSpeakingCorrections(p, "Télétravail", [{ wrong: "same", right: "same", type: "other", why: "", point: "subjonctif" }]), null);

  const recorded = recordSpeakingCorrections(
    p,
    "Le télétravail",
    [
      { wrong: "Il faut que tu fais", right: "Il faut que tu fasses", type: "conjugation", why: "falloir + subjonctif", point: "subjonctif" },
      { wrong: "sans change", right: "sans change", type: "other", why: "noop", point: "subjonctif" },
    ],
    "sp-1",
    now,
  );
  assert.ok(recorded);
  p = recorded.next;

  // Add a kept note marked from Speaking ("口语 · ...")
  p.essayNotes = [
    { id: "n1", wrong: "Bien qu'il a raison", right: "Bien qu'il ait raison", type: "tense", why: "bien que + 虚拟式", point: "opposition-concession", at: now - 500, from: "口语 · 远程办公" },
  ];

  // Ensure Progress sanitization preserves valid speakCorrections and drops bad entries
  const roundtrip = sanitizeProgress(
    {
      ...p,
      speakCorrections: [
        ...(p.speakCorrections ?? []),
        { id: "bad-no-subject", subject: "", at: now, corrections: [{ wrong: "x", right: "y", type: "other", why: "", point: "subjonctif" }] },
        { id: "bad-no-diff", subject: "ok", at: now, corrections: [{ wrong: "x", right: "x", type: "other", why: "", point: "subjonctif" }] },
      ],
    },
    "t",
  );
  assert.equal(roundtrip.speakCorrections?.length, 1);

  // Mark subjonctif as reviewed *earlier* than the speaking correction, and unrelated point later
  const futureCard = { ...review(undefined, Rating.Good, now - 10_000), due: now + 86_400_000, last: now - 10_000 };
  roundtrip.gram = { subjonctif: futureCard };

  const errs = essayErrors(roundtrip);
  assert.equal(errs.get("subjonctif")?.[0]?.source, "speak");
  assert.equal(errs.get("opposition-concession")?.[0]?.source, "speak");

  const drills = mineDrills(errs.get("subjonctif"));
  assert.equal(drills[0]?.h, "你在口语里说过");
  assert.equal(drills[0]?.s.slice(drills[0].b[0], drills[0].b[1]), "fais");
  assert.deepEqual(drills[0]?.r, ["fasses"]);

  assert.ok(duePoints(grammar, roundtrip, now).includes("subjonctif"), "newer speaking error brings grammar point back for review");
  assert.ok(untouchedWithErrors(grammar, roundtrip).some((x) => x.point.id === "opposition-concession"));
});

/* ---------- focused / retry rounds and drill filters ---------- */

const drill = (k: Drill["k"], g: string, n: number): Drill =>
  k === "c"
    ? { k, s: `Phrase ${g} ${n}.`, z: "", h: "", y: "", g, b: [0, 6], o: ["Phrase", "Autre"] }
    : k === "t"
      ? { k, s: `Mot ${g} ${n}.`, z: "", h: "h", y: "", g, b: [0, 3], a: ["Mot"] }
      : k === "o"
        ? { k, s: `Je pars ${g}${n}.`, z: "", h: "", y: "", g, t: ["je", "pars", `${g}${n}`], p: ".", strict: true }
        : k === "f"
          ? { k, s: `Il sont ${g} ${n}.`, z: "", h: "", y: "", g, b: [3, 7], r: ["est"] }
          : { k, q: `Q ${g} ${n}.`, s: `A ${g} ${n}.`, a: [`A ${g} ${n}.`], z: "", h: "h", y: "", g };

const fakePoint: GrammarPoint = {
  id: "fake",
  level: "B1",
  title: "Fake",
  fr: "Fake",
  intro: "",
  rules: [
    { h: "r0", text: "", ex: [] },
    { h: "r1", text: "", ex: [] },
  ],
  traps: ["t0"],
  drills: [
    ...[0, 1, 2, 3].map((n) => drill("c", "r0", n)),
    ...[0, 1, 2].map((n) => drill("t", "r0", n)),
    ...[0, 1, 2, 3, 4].map((n) => drill("o", "r1", n)),
    ...[0, 1].map((n) => drill("f", "t0", n)),
    ...[0, 1].map((n) => drill("x", "r1", n)),
  ],
};

test("pickDrills filters by tag and kind on both the pool and the learner's own mistakes", () => {
  const p = emptyProgress("t");
  const mine = mineDrills([{ wrong: "Il faut que tu fais", right: "Il faut que tu fasses", why: "", at: 1 }]);
  const r0 = pickDrills(fakePoint, p, 8, 7, mine, { tag: "r0" });
  assert.equal(r0.length, 7, "only 7 r0 drills exist: returns what there is");
  assert.ok(r0.every((d) => d.g === "r0"));
  const orders = pickDrills(fakePoint, p, 8, 7, mine, { kind: "o" });
  assert.equal(orders.length, 5);
  assert.ok(orders.every((d) => d.k === "o"));
  const fixes = pickDrills(fakePoint, p, 8, 7, mine, { kind: "f" });
  assert.ok(fixes.every((d) => d.k === "f"));
  assert.ok(fixes.some((d) => d.g === ESSAY_TAG), "kind f keeps the learner's own fix drills");
  assert.equal(fixes.length, 3);
  const both = pickDrills(fakePoint, p, 8, 7, mine, { tag: "r1", kind: "x" });
  assert.deepEqual(new Set(both.map((d) => `${d.g}${d.k}`)), new Set(["r1x"]));
  assert.equal(pickDrills(fakePoint, p, 8, 7, mine, { tag: "t0", kind: "o" }).length, 0);

  assert.equal(countMatchingDrills(fakePoint, p, mine), fakePoint.drills.length + 1);
  assert.equal(countMatchingDrills(fakePoint, p, mine, { tag: "r0" }), 7);
  assert.equal(countMatchingDrills(fakePoint, p, mine, { kind: "f" }), 3);
  assert.equal(countMatchingDrills(fakePoint, p, mine, { tag: ESSAY_TAG }), 1);
  assert.equal(countMatchingDrills(fakePoint, p, mine, { tag: "t0", kind: "c" }), 0);
});

test("a round schedules the point; accent slips count as Hard", () => {
  const now = 1_720_000_000_000;
  const p0 = emptyProgress("t");
  const p1 = applyPointRound(p0, "fake", [{ g: "r0", ok: true }, { g: "r1", ok: true, accent: true }], "round", now);
  assert.ok(p1.gram?.fake);
  const clean = applyPointRound(p0, "fake", [{ g: "r0", ok: true }, { g: "r1", ok: true }], "round", now);
  assert.ok(clean.gram!.fake.due > p1.gram!.fake.due, "accent slip gives a shorter interval than a clean round");
  assert.deepEqual(p1.gramDays?.[dayKey(new Date(now))], { n: 1, r: 2, c: 2 });
  assert.deepEqual(p1.gramTags?.[tagKey("fake", "r1")], { n: 1, w: 0 });
});

test("a focused round keeps a not-yet-due card where it was when all right, and still counts tags and the day", () => {
  const now = 1_720_000_000_000;
  const p0 = emptyProgress("t");
  const card = { ...review(undefined, Rating.Good, now - 86_400_000), due: now + 5 * 86_400_000 };
  p0.gram = { fake: card };
  const p1 = applyPointRound(p0, "fake", [{ g: "r1", ok: true }, { g: "r1", ok: true }], "focused", now);
  assert.equal(p1.gram?.fake, card, "card untouched");
  assert.deepEqual(p1.gramTags?.[tagKey("fake", "r1")], { n: 2, w: 0 });
  assert.deepEqual(p1.gramDays?.[dayKey(new Date(now))], { n: 0, r: 2, c: 2 });

  // mistakes on a card not due yet bring it closer
  const p2 = applyPointRound(p0, "fake", [{ g: "r1", ok: false }, { g: "r1", ok: true }], "focused", now);
  assert.ok(p2.gram!.fake.due < card.due, "a slip in focused practice brings the point back sooner");

  // a focused round on a new point creates its card
  const fresh = applyPointRound(emptyProgress("t"), "fake", [{ g: "t0", ok: true }], "focused", now);
  assert.ok(fresh.gram?.fake);
  assert.equal(fresh.gramDays?.[dayKey(new Date(now))]?.n, 1);

  // a due card is not pushed further by a clean focused round
  const dueCard = { ...card, due: now - 1000 };
  const p3 = applyPointRound({ ...p0, gram: { fake: dueCard } }, "fake", [{ g: "r0", ok: true }], "focused", now);
  assert.equal(p3.gram?.fake, dueCard);
});

test("a retry round records nothing", () => {
  const now = 1_720_000_000_000;
  const p0 = emptyProgress("t");
  const p1 = applyPointRound(p0, "fake", [{ g: "r1", ok: false }, { g: "r0", ok: true }], "retry", now);
  assert.equal(p1, p0);
  assert.equal(p1.gram?.fake, undefined);
  assert.equal(p1.gramTags?.[tagKey("fake", "r1")], undefined);
  assert.equal(p1.gramDays?.[dayKey(new Date(now))], undefined);
});
