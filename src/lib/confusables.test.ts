import assert from "node:assert/strict";
import { test } from "node:test";
import { blankOf, blankOut, checkGroups, pickQuestions, questionsOf, type CfGroup } from "./confusables.ts";

const g = (id: string, items: CfGroup["items"]): CfGroup => ({ id, kind: "homophone", title: id, zh: "区别", items });
const it = (w: string, fr: string, extra: object = {}) => ({ w, zh: "义", rule: "规则", ex: { fr, zh: "译" }, ...extra });

test("blankOut finds whole words only, ignores case and apostrophe style, and keeps accents distinct", () => {
  assert.deepEqual(blankOut("Il a faim.", "a"), { before: "Il ", hidden: "a", after: " faim." });
  assert.equal(blankOut("Je vais à Paris.", "a"), null);
  assert.equal(blankOut("Je vais à Paris.", "à")?.hidden, "à");
  assert.equal(blankOut("C’est vrai.", "c'est")?.hidden, "C’est");
  assert.equal(blankOut("Les heures passent.", "heure"), null);
  assert.equal(blankOut("Quant à moi, je reste.", "quant à")?.after, " moi, je reste.");
});

test("an item may blank an inflected form instead of its headword", () => {
  const voir = it("voir", "Je vois un oiseau.", { form: "vois" });
  assert.equal(blankOf(voir), "vois");
  assert.equal(blankOut(voir.ex.fr, blankOf(voir))?.hidden, "vois");
});

test("checkGroups reports a missing blank, duplicate ids, too few items", () => {
  const good = g("ou-ou", [it("ou", "Thé ou café ?"), it("où", "Où vas-tu ?")]);
  assert.deepEqual(checkGroups([good]), []);
  const bad = g("x", [it("ou", "Thé et café ?"), it("où", "Où vas-tu ?")]);
  assert.match(checkGroups([bad])[0], /not found/);
  assert.match(checkGroups([good, good]).join("\n"), /duplicate group id/);
  assert.match(checkGroups([g("y", [it("ou", "Thé ou café ?")])]).join("\n"), /needs 2–4 items/);
});

test("one question per item; a quiz takes at most two per group", () => {
  const groups = [
    g("a", [it("ou", "Thé ou café ?"), it("où", "Où vas-tu ?")]),
    g("b", [it("et", "Toi et moi."), it("est", "Il est là."), it("ai", "J'ai faim.")]),
  ];
  const all = questionsOf(groups);
  assert.equal(all.length, 5);
  let n = 0;
  const rand = () => ((n = (n * 9301 + 49297) % 233280), n / 233280);
  const picked = pickQuestions(all, 10, rand, 2);
  assert.equal(picked.length, 4);
  assert.equal(picked.filter((q) => q.group.id === "b").length, 2);
});
