import assert from "node:assert/strict";
import { test } from "node:test";

import { answersOf, checkExpr, EXPR_BY_ID, EXPR_GROUPS, EXPR_ID, EXPRESSIONS, filledEx, gapOf, maskOf, type Expression } from "./expressions.ts";
import { TOPICS } from "./exam.ts";
import { COLLOCATIONS } from "./expressions-more.ts";

const card = (id: string) => {
  const e = EXPR_BY_ID.get(id);
  assert.ok(e, id);
  return e;
};

test("every card is well formed: unique valid id, one gap, Chinese, known group", () => {
  assert.equal(EXPR_BY_ID.size, EXPRESSIONS.length, "ids are unique");
  for (const e of EXPRESSIONS) {
    assert.match(e.id, EXPR_ID, e.id);
    assert.equal(e.ex.match(/\[[^\]]+\]/g)?.length, 1, `${e.id}: one gap`);
    assert.ok(e.zh && e.exZh && e.fn, e.id);
    assert.ok(EXPR_GROUPS.some(([g]) => g === e.group), e.id);
  }
  for (const [g] of EXPR_GROUPS) assert.ok(EXPRESSIONS.some((e) => e.group === g), `group ${g} has cards`);
});

test("collocations take their Chinese from the exam topic vocabulary, none is dropped", () => {
  const cols = EXPRESSIONS.filter((e) => e.group === "col");
  assert.equal(cols.length, COLLOCATIONS.flatMap(([, list]) => list).length);
  for (const e of cols) assert.equal(TOPICS.find((t) => t.id === e.topic)?.vocab.find(([fr]) => fr === e.fr)?.[1], e.zh, e.id);
});

test("gap: split, filled, masked", () => {
  assert.deepEqual(gapOf("Il pleut ; [cependant], je sors."), { before: "Il pleut ; ", answer: "cependant", after: ", je sors." });
  assert.equal(filledEx("Il pleut ; [cependant], je sors."), "Il pleut ; cependant, je sors.");
  assert.equal(maskOf("en revanche"), "e_ r_______");
  assert.equal(maskOf("d'ailleurs"), "d'a_______");
});

test("answers: case, accents, punctuation and elision", () => {
  const cep = card("conn-cependant");
  assert.equal(checkExpr("Cependant,", cep).verdict, "exact");
  assert.equal(checkExpr("  cependant ", cep).verdict, "exact");
  assert.equal(checkExpr("", cep).verdict, "wrong");
  assert.equal(checkExpr("cepandant", cep).verdict, "wrong");
  assert.equal(checkExpr("malgre", card("conn-malgre")).verdict, "accent");
  assert.equal(checkExpr("Malgré", card("conn-malgre")).verdict, "exact");
  // the gap of "ce n'est pas parce que… que" is elided: the full form is accepted too
  const parce = card("arg-ce-n-est-pas-parce-que-que");
  assert.ok(answersOf(parce).includes("Ce n'est pas parce que"));
  assert.equal(checkExpr("ce n'est pas parce que", parce).verdict, "exact");
  // alternatives
  assert.equal(checkExpr("suite à", card("lettre-a-la-suite-de")).verdict, "exact");
});

test("another connector of the same function is a near miss, not a different function", () => {
  const cep = card("conn-cependant");
  const got = checkExpr("pourtant", cep);
  assert.equal(got.verdict, "synonym");
  assert.equal(got.other?.id, "conn-pourtant");
  assert.equal(checkExpr("par conséquent", cep).verdict, "wrong");
  // only connectors and frames have interchangeable cards
  const fake: Expression[] = [
    { id: "reg-a", group: "reg", fn: "x", fr: "a", zh: "a", ex: "[a]", exZh: "a" },
    { id: "reg-b", group: "reg", fn: "x", fr: "b", zh: "b", ex: "[b]", exZh: "b" },
  ];
  assert.equal(checkExpr("b", fake[0], fake).verdict, "wrong");
});
