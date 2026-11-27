import assert from "node:assert/strict";
import { test } from "node:test";

import { answersOf, checkExpr, DEBATE_PHRASE_FNS, debatePhrases, EXPR_BY_ID, EXPR_GROUPS, EXPR_ID, EXPRESSIONS, filledEx, gapOf, maskOf, synonymsOf, type Expression } from "./expressions.ts";
import { foldAccents } from "./accent.ts";
import { EXPRESSIONS_COUNT } from "./expr-schema.ts";
import { TOPICS } from "./exam.ts";
import { COLLOCATIONS } from "./expressions-more.ts";
import { CORE_FR_DEFS, frenchClueFor, readPureFr, writePureFr } from "./pure-fr.ts";

const card = (id: string) => {
  const e = EXPR_BY_ID.get(id);
  assert.ok(e, id);
  return e;
};

test("every card is well formed: unique valid id, one gap, Chinese, known group", () => {
  assert.equal(EXPR_BY_ID.size, EXPRESSIONS.length, "ids are unique");
  assert.equal(EXPRESSIONS_COUNT, EXPRESSIONS.length, "schema count matches expressions");
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

test("a slot-compatible synonym (syn) is a near miss and names its card; a different function is wrong", () => {
  const cep = card("conn-cependant");
  const got = checkExpr("pourtant", cep);
  assert.equal(got.verdict, "synonym");
  assert.equal(got.other?.id, "conn-pourtant");
  assert.equal(checkExpr("Toutefois,", cep).verdict, "synonym");
  assert.equal(checkExpr("néanmoins", cep).verdict, "synonym");
  assert.equal(checkExpr("par conséquent", cep).verdict, "wrong");
  // only connectors and frames have interchangeable cards
  const fake: Expression[] = [
    { id: "reg-a", group: "reg", fn: "x", fr: "a", zh: "a", ex: "[a]", exZh: "a" },
    { id: "reg-b", group: "reg", fn: "x", fr: "b", zh: "b", ex: "[b]", exZh: "b" },
  ];
  assert.equal(checkExpr("b", fake[0], fake).verdict, "wrong");
});

test("speaking problématique and debate phrases provide at least 25 valid cards", () => {
  const groups = debatePhrases();
  assert.equal(groups.length, DEBATE_PHRASE_FNS.length);
  const debateCount = groups.reduce((n, [, xs]) => n + xs.length, 0);
  const probCount = EXPRESSIONS.filter((e) => e.group === "arg" && e.fn.includes("problématique")).length;
  assert.ok(debateCount + probCount >= 28, `expected >= 28 oral/debate cards, got ${debateCount + probCount}`);
});

test("CE-2: reformulation cards carry French source + definition, pureFr defaults on, and frenchClueFor omits Chinese", () => {
  const reform = EXPRESSIONS.filter((e) => e.group === "reform");
  assert.ok(reform.length >= 15);
  assert.ok(reform.every((e) => e.reformFrom && e.frDef));
  assert.equal(checkExpr("bien que", card("reform-bien-que")).verdict, "exact");
  assert.equal(checkExpr("quoique", card("reform-bien-que")).verdict, "exact");
  // pureFr defaults to true when localStorage is empty or unavailable
  assert.equal(readPureFr(), true);
  assert.ok(Object.keys(CORE_FR_DEFS).length >= 50);
  const clue = frenchClueFor({
    w: "pallier",
    senses: [{ pos: "v.t.", zh: "弥补", en: "compensate" }] as never,
    col: ["pallier les lacunes｜弥补漏洞"],
    syn: ["compenser (弥补)"],
  });
  assert.ok(!/[\u4e00-\u9fff]/.test(clue), clue);
  const fallbackClue = frenchClueFor({
    w: "mot-rare",
    senses: [{ pos: "n.f.", zh: "罕见词", en: "rare word" }] as never,
    col: ["prendre une décision｜做决定"],
    syn: ["choix (选择)"],
  });
  assert.ok(!/[\u4e00-\u9fff]/.test(fallbackClue), fallbackClue);
  assert.ok(fallbackClue.includes("prendre une décision"));
  void writePureFr;
});

/* ---------- the gap decides: same function is not enough ---------- */

const wrongWith = (typed: string, id: string, otherId?: string) => {
  const got = checkExpr(typed, card(id));
  assert.equal(got.verdict, "wrong", `${typed} in ${id}`);
  if (otherId) assert.equal(got.other?.id, otherId, `${typed} in ${id}: names ${otherId}`);
  return got;
};

test("cards of the same function that do not fit the gap are graded wrong, naming the card", () => {
  // "Le vol est retardé [en raison de] la grève": thanks to / for lack of the strike
  wrongWith("grâce à", "conn-en-raison-de", "conn-grace-a");
  wrongWith("faute de", "conn-en-raison-de", "conn-faute-de");
  // "nous irons [donc] mardi": a conjunction cannot stand after the verb
  wrongWith("si bien que", "conn-donc", "conn-si-bien-que");
  wrongWith("c'est pourquoi", "conn-donc", "conn-c-est-pourquoi");
  // "[Au lieu de] jeter": contrairement à takes no infinitive
  wrongWith("contrairement à", "conn-au-lieu-de", "conn-contrairement-a");
  // "[En dépit de] nombreuses critiques": malgré would need "malgré de nombreuses"
  wrongWith("malgré", "conn-en-depit-de", "conn-malgre");
  wrongWith("malgre", "conn-en-depit-de", "conn-malgre");
  // contraction / negation: "[quant aux] entreprises", "n'a [guère] modifié"
  wrongWith("quant à", "reform-quant-a");
  wrongWith("ne guère", "reform-ne-guere");
  wrongWith("ne … guère", "reform-ne-guere");
  // "va [à l'encontre des] engagements": de + les must contract
  wrongWith("à l'encontre de", "reform-a-l-encontre-de");
  wrongWith("contre", "reform-a-l-encontre-de");
  // a reformulation never accepts the plainer wording it replaces
  wrongWith("à cause de", "reform-en-raison-de");
  wrongWith("plus", "reform-davantage");
  wrongWith("par exemple", "reform-a-titre-d-exemple");
  wrongWith("malgré", "reform-en-depit-de");
  // "[Comme] il pleuvait": puisque must elide; the elided and full forms are both understood
  assert.equal(checkExpr("puisqu'", card("conn-comme")).verdict, "synonym");
  assert.equal(checkExpr("puisque", card("conn-comme")).verdict, "synonym");
  // "Votre [véhicule] est mal stationné": voiture would need stationnée
  assert.equal(checkExpr("voiture", card("reg-un-vehicule")).verdict, "wrong");
});

test("right answers: exact, accents only, interchangeable synonyms, gender and elided forms", () => {
  assert.equal(checkExpr("en raison de", card("conn-en-raison-de")).verdict, "exact");
  assert.equal(checkExpr("en raison d'", card("reform-en-raison-de")).verdict, "exact");
  assert.equal(checkExpr("en raison de", card("reform-en-raison-de")).verdict, "exact");
  assert.equal(checkExpr("etant donne que", card("conn-etant-donne-que")).verdict, "accent");
  assert.equal(checkExpr("à cause de", card("conn-en-raison-de")).verdict, "synonym");
  assert.equal(checkExpr("quoique", card("conn-bien-que")).verdict, "synonym");
  assert.equal(checkExpr("en dépit de", card("conn-malgre")).verdict, "synonym");
  assert.equal(checkExpr("selon moi", card("arg-a-mon-avis")).verdict, "synonym");
  assert.equal(checkExpr("en somme", card("conn-en-conclusion")).verdict, "synonym");
  assert.equal(checkExpr("De plus,", card("conn-en-outre")).verdict, "synonym");
  assert.equal(checkExpr("si bien que", card("conn-si-bien-que")).verdict, "exact");
  assert.equal(checkExpr("de sorte que", card("conn-si-bien-que")).verdict, "synonym");
  assert.equal(checkExpr("je suis convaincue que", card("arg-je-suis-convaincu-que")).verdict, "exact");
  assert.equal(checkExpr("quant aux", card("reform-quant-a")).verdict, "exact");
  assert.equal(checkExpr("guère", card("reform-ne-guere")).verdict, "exact");
  assert.equal(checkExpr("à l'encontre des", card("reform-a-l-encontre-de")).verdict, "exact");
  assert.equal(checkExpr("telles que", card("conn-tel-que")).verdict, "exact");
  // agreement matters: "Les énergies renouvelables, [telles que]…"
  assert.notEqual(checkExpr("tel que", card("conn-tel-que")).verdict, "exact");
  // an everyday wording in a register card is a near miss, the formal one is right
  assert.equal(checkExpr("il y a", card("reg-il-existe")).verdict, "synonym");
  assert.equal(checkExpr("il existe", card("reg-il-existe")).verdict, "exact");
});

test("every card's data is clean: answers, alternatives and synonyms are distinct, bracket-free and never the gap itself", () => {
  const fold = (x: string) => foldAccents(x.trim().toLowerCase());
  for (const e of EXPRESSIONS) {
    const gap = gapOf(e.ex).answer.trim();
    assert.ok(gap, `${e.id}: non-empty gap`);
    assert.ok(e.zh.trim() && e.exZh.trim(), `${e.id}: Chinese`);
    assert.ok(!/待核对/.test(`${e.note ?? ""}${e.zh}${e.exZh}`), `${e.id}: no draft marker`);
    for (const list of [e.alt ?? [], e.syn ?? []]) {
      for (const a of list) {
        assert.ok(a.trim() && !/[[\]]/.test(a), `${e.id}: bad entry "${a}"`);
        assert.notEqual(fold(a), fold(gap), `${e.id}: "${a}" repeats the gap`);
      }
      assert.equal(new Set(list.map(fold)).size, list.length, `${e.id}: duplicate entries`);
    }
    // a synonym is never also an accepted answer
    const answers = new Set(answersOf(e).map(fold));
    for (const syn of synonymsOf(e)) assert.ok(!answers.has(fold(syn)), `${e.id}: "${syn}" is both an answer and a synonym`);
    // the plainer wording a reformulation replaces is never accepted
    if (e.reformFrom) {
      const from = fold(e.reformFrom);
      const filled = fold(filledEx(e.ex));
      for (const a of [...(e.alt ?? []), ...(e.syn ?? [])]) {
        const variant = fold(filledEx(e.ex.replace(/\[[^\]]+\]/, a)));
        assert.notEqual(variant, from, `${e.id}: "${a}" only copies the sentence to reformulate`);
      }
      assert.notEqual(filled, from, `${e.id}: the target differs from the source`);
    }
  }
});
