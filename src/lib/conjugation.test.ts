import assert from "node:assert/strict";
import { test } from "node:test";

import { agree, B2_HIGH_FREQ_TENSES, checkAnswer, distractorsFor, imperatifForm, participePresentForm, personsFor, promptFor, tableFor, tensesForLevel, type ConjVerb } from "./conjugation.ts";

const parler: ConjVerb = { i: "parler", a: "a", pp: "parlé", m: "er", f: { pres: ["parle", "parles", "parle", "parlons", "parlez", "parlent"], imp: ["parlais", "parlais", "parlait", "parlions", "parliez", "parlaient"], fut: ["parlerai", "parleras", "parlera", "parlerons", "parlerez", "parleront"], cond: ["parlerais", "parlerais", "parlerait", "parlerions", "parleriez", "parleraient"], subj: ["parle", "parles", "parle", "parlions", "parliez", "parlent"] } };
const aimer: ConjVerb = { ...parler, i: "aimer", pp: "aimé", f: { pres: ["aime", "aimes", "aime", "aimons", "aimez", "aiment"], imp: ["aimais", "aimais", "aimait", "aimions", "aimiez", "aimaient"], fut: ["aimerai", "aimeras", "aimera", "aimerons", "aimerez", "aimeront"], cond: ["aimerais", "aimerais", "aimerait", "aimerions", "aimeriez", "aimeraient"], subj: ["aime", "aimes", "aime", "aimions", "aimiez", "aiment"] } };
const aller: ConjVerb = { i: "aller", a: "e", pp: "allé", m: "aller", f: { pres: ["vais", "vas", "va", "allons", "allez", "vont"], imp: ["allais", "allais", "allait", "allions", "alliez", "allaient"], fut: ["irai", "iras", "ira", "irons", "irez", "iront"], cond: ["irais", "irais", "irait", "irions", "iriez", "iraient"], subj: ["aille", "ailles", "aille", "allions", "alliez", "aillent"] } };
const lever: ConjVerb = { i: "lever", p: 1, a: "e", pp: "levé", m: "er", f: { pres: ["lève", "lèves", "lève", "levons", "levez", "lèvent"], imp: ["levais", "levais", "levait", "levions", "leviez", "levaient"], fut: ["lèverai", "lèveras", "lèvera", "lèverons", "lèverez", "lèveront"], cond: ["lèverais", "lèverais", "lèverait", "lèverions", "lèveriez", "lèveraient"], subj: ["lève", "lèves", "lève", "levions", "leviez", "lèvent"] } };

test("subjects elide before vowels and take que / qu' in the subjunctive", () => {
  assert.equal(promptFor(parler, "pres", 0).before, "je");
  assert.equal(promptFor(aimer, "pres", 0).before, "j'");
  assert.equal(promptFor(aimer, "subj", 0).before, "que j'");
  assert.equal(promptFor(parler, "subj", 2).before, "qu'il");
  assert.equal(promptFor(parler, "subj", 5).before, "qu'ils");
  assert.equal(promptFor(parler, "pc", 0).before, "j'");
  assert.equal(promptFor(lever, "pres", 0).before, "je me");
  assert.equal(promptFor(lever, "pc", 1).before, "tu t'", "tu t'es levé(e)");
  assert.equal(promptFor(lever, "pc", 2).before, "il s'");
});

test("passé composé uses the right auxiliary and accepts the agreements", () => {
  assert.deepEqual(promptFor(parler, "pc", 3).accepted, ["avons parlé"]);
  const je = promptFor(aller, "pc", 0);
  assert.equal(je.shown, "suis allé(e)");
  assert.deepEqual(je.accepted.sort(), ["suis allé", "suis allée"]);
  assert.deepEqual(promptFor(aller, "pc", 2).accepted, ["est allé"]);
  assert.ok(promptFor(aller, "pc", 4).accepted.includes("êtes allées"));
  assert.deepEqual([agree("pris", true, true), agree("pris", false, true), agree("mort", true, false)], ["prises", "pris", "morte"]);
  const sortir: ConjVerb = { ...parler, i: "sortir", a: "ae", pp: "sorti" };
  assert.ok(promptFor(sortir, "pc", 0).accepted.includes("ai sorti"), "transitive sortir takes avoir");
});

test("answers: exact, accent-only mistakes, wrong", () => {
  const acc = promptFor(lever, "pres", 0).accepted;
  assert.equal(checkAnswer(" Lève ", acc), "right");
  assert.equal(checkAnswer("leve", acc), "accent");
  assert.equal(checkAnswer("levons", acc), "wrong");
  assert.equal(checkAnswer("", acc), "wrong");
});

test("multiple choice offers three distinct wrong forms; the wrong auxiliary and analogical traps come first", () => {
  const d = distractorsFor(parler, "pres", 3, 42);
  assert.equal(d.length, 3);
  assert.ok(!d.includes("parlons"));
  assert.equal(new Set(d).size, 3);
  assert.equal(distractorsFor(aller, "pc", 0, 7)[0], "ai allé");
  const envoyer: ConjVerb = { ...parler, i: "envoyer", pp: "envoyé", m: "envoyer", f: { ...parler.f, fut: ["enverrai", "enverras", "enverra", "enverrons", "enverrez", "enverront"] }, tr: { "fut:0": ["envoierai", "envoyerai"], pp: ["envoyu"] } };
  assert.deepEqual(distractorsFor(envoyer, "fut", 0, 1).slice(0, 2), ["envoierai", "envoyerai"]);
  const pc = distractorsFor(envoyer, "pc", 0, 1);
  assert.equal(pc[0], "suis envoyé");
  assert.equal(pc[1], "ai envoyu");
});

test("tables and level unlocking", () => {
  assert.deepEqual(tableFor(aller, "pres").map((r) => `${r.before} ${r.form}`), ["je vais", "tu vas", "il va", "nous allons", "vous allez", "ils vont"]);
  assert.deepEqual(tensesForLevel(0), ["pres", "pc"]);
  assert.ok(tensesForLevel(2).includes("subj"), "B1 start level enables subj by default");
  assert.deepEqual(tensesForLevel(3), B2_HIGH_FREQ_TENSES);
  assert.ok(["subjp", "condp", "fa", "ppres"].every((t) => tensesForLevel(3).includes(t as never)), "B2 unlocks compound/non-finite tenses");
  assert.equal(checkAnswer("ai parle", ["ai parlé"]), "wrong", "present-vs-participle -e/-é is wrong");
  assert.equal(checkAnswer("commenca", ["commença"]), "wrong", "missing cedilla before a/o/u is wrong");
  const falloir: ConjVerb = { ...parler, i: "falloir", imp: 1, f: { ...parler.f, pres: ["", "", "faut", "", "", ""] } };
  assert.deepEqual(tableFor(falloir, "pres").map((r) => r.form), ["faut"]);
  assert.deepEqual(personsFor(falloir, "ppres"), []);
});

test("PE-7: compound B2 tenses and participe présent compute auxiliaries, que/qu' and agreements", () => {
  const avoir: ConjVerb = { ...parler, i: "avoir", a: "a", pp: "eu" };
  const etre: ConjVerb = { ...parler, i: "être", a: "e", pp: "été" };
  const savoir: ConjVerb = { ...parler, i: "savoir", a: "a", pp: "su" };

  assert.equal(promptFor(parler, "pqp", 0).shown, "avais parlé");
  assert.equal(promptFor(aller, "pqp", 3).shown, "étions allé(e)s");
  assert.ok(promptFor(aller, "pqp", 3).accepted.includes("étions allées"));
  assert.equal(promptFor(parler, "fa", 2).shown, "aura parlé");
  assert.equal(promptFor(aller, "condp", 0).shown, "serais allé(e)");
  assert.equal(promptFor(parler, "subjp", 0).before, "que j'");
  assert.equal(promptFor(parler, "subjp", 0).shown, "aie parlé");
  assert.equal(promptFor(aller, "subjp", 2).before, "qu'il");
  assert.equal(promptFor(aller, "subjp", 2).shown, "soit allé");
  assert.equal(promptFor(lever, "subjp", 1).before, "que tu te");
  assert.equal(promptFor(lever, "subjp", 1).shown, "sois levé(e)");

  assert.equal(participePresentForm(parler), "parlant");
  assert.equal(participePresentForm(etre), "étant");
  assert.equal(participePresentForm(avoir), "ayant");
  assert.equal(participePresentForm(savoir), "sachant");
  assert.equal(promptFor(parler, "ppres", 0).before, "");
  assert.equal(promptFor(parler, "ppres", 0).shown, "parlant");
  assert.equal(promptFor(lever, "ppres", 0).before, "se");
  assert.ok(promptFor(lever, "ppres", 0).accepted.includes("se levant"));
});

test("Phase3: impératif présent derives regular drop-s, irregulars, reflexives, defective exclusions & traps", () => {
  const falloir: ConjVerb = { ...parler, i: "falloir", imp: 1, f: { ...parler.f, pres: ["", "", "faut", "", "", ""] } };
  const avoir: ConjVerb = { ...parler, i: "avoir", a: "a", pp: "eu", f: { ...parler.f, pres: ["ai", "as", "a", "avons", "avez", "ont"] } };
  const etre: ConjVerb = { ...parler, i: "être", a: "e", pp: "été", f: { ...parler.f, pres: ["suis", "es", "est", "sommes", "êtes", "sont"] } };
  const savoir: ConjVerb = { ...parler, i: "savoir", a: "a", pp: "su", f: { ...parler.f, pres: ["sais", "sais", "sait", "savons", "savez", "savent"] } };
  const vouloir: ConjVerb = { ...parler, i: "vouloir", a: "a", pp: "voulu", f: { ...parler.f, pres: ["veux", "veux", "veut", "voulons", "voulez", "veuillent"] } };

  assert.deepEqual(personsFor(parler, "imper"), [1, 3, 4]);
  assert.equal(imperatifForm(parler, 1), "parle");
  assert.equal(imperatifForm(aller, 1), "va");
  assert.equal(imperatifForm(etre, 4), "soyez");
  assert.equal(imperatifForm(avoir, 1), "aie");
  assert.equal(imperatifForm(savoir, 3), "sachons");
  assert.equal(imperatifForm(vouloir, 4), "veuillez");
  assert.equal(imperatifForm(lever, 1), "lève-toi");
  assert.equal(imperatifForm(lever, 3), "levons-nous");
  assert.deepEqual(personsFor(falloir, "imper"), []);
  assert.equal(promptFor(parler, "imper", 1).before, "(tu)");
  assert.equal(promptFor(lever, "imper", 1).shown, "lève-toi");
  assert.ok(distractorsFor(parler, "imper", 1, 7).includes("parles"));
  assert.ok(tensesForLevel(1).includes("imper"));
});
