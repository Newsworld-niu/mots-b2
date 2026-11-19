import assert from "node:assert/strict";
import { test } from "node:test";

import { agree, checkAnswer, distractorsFor, promptFor, tableFor, tensesForLevel, type ConjVerb } from "./conjugation.ts";

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
  assert.equal(tensesForLevel(3).length, 6);
  const falloir: ConjVerb = { ...parler, i: "falloir", imp: 1, f: { ...parler.f, pres: ["", "", "faut", "", "", ""] } };
  assert.deepEqual(tableFor(falloir, "pres").map((r) => r.form), ["faut"]);
});
