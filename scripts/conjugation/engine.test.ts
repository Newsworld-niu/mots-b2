import assert from "node:assert/strict";
import { test } from "node:test";

import { conjugate, splitReflexive } from "./engine.ts";

const c = (v: string) => {
  const r = conjugate(v);
  assert.ok(r, `${v} conjugates`);
  return r!;
};

test("regular -er verbs and their spelling changes", () => {
  assert.deepEqual(c("parler").forms.pres, ["parle", "parles", "parle", "parlons", "parlez", "parlent"]);
  assert.equal(c("commencer").forms.pres[3], "commençons");
  assert.equal(c("commencer").forms.imp[0], "commençais");
  assert.equal(c("commencer").forms.imp[3], "commencions");
  assert.equal(c("manger").forms.imp[2], "mangeait");
  assert.deepEqual([c("lever").forms.pres[0], c("lever").forms.fut[0], c("lever").forms.pres[3]], ["lève", "lèverai", "levons"]);
  assert.deepEqual([c("appeler").forms.pres[0], c("appeler").forms.fut[0]], ["appelle", "appellerai"]);
  assert.deepEqual([c("jeter").forms.pres[5], c("acheter").forms.pres[5]], ["jettent", "achètent"]);
  assert.deepEqual([c("préférer").forms.pres[0], c("préférer").forms.fut[0]], ["préfère", "préférerai"]);
  assert.ok(c("préférer").alt?.["fut:0"]?.includes("préfèrerai"), "1990 spelling accepted");
  assert.deepEqual([c("inquiéter").forms.pres[0], c("sécher").forms.pres[0], c("régner").forms.pres[5]], ["inquiète", "sèche", "règnent"]);
  assert.deepEqual([c("nettoyer").forms.pres[0], c("nettoyer").forms.fut[0]], ["nettoie", "nettoierai"]);
  assert.ok(c("payer").alt?.["pres:0"]?.includes("paye"), "je paie / je paye");
  assert.equal(c("protéger").forms.pres[3], "protégeons");
  assert.equal(c("rire").forms.imp[3], "riions");
  assert.equal(c("parler").pp, "parlé");
});

test("second group and partir-type -ir verbs", () => {
  assert.deepEqual(c("finir").forms.pres, ["finis", "finis", "finit", "finissons", "finissez", "finissent"]);
  assert.equal(c("finir").forms.subj[0], "finisse");
  assert.deepEqual(c("dormir").forms.pres, ["dors", "dors", "dort", "dormons", "dormez", "dorment"]);
  assert.deepEqual([c("servir").forms.pres[2], c("partir").pp, c("sentir").forms.fut[0]], ["sert", "parti", "sentirai"]);
});

test("irregular models and derived verbs", () => {
  assert.deepEqual(c("être").forms.pres, ["suis", "es", "est", "sommes", "êtes", "sont"]);
  assert.deepEqual([c("être").forms.imp[0], c("être").forms.subj[3]], ["étais", "soyons"]);
  assert.deepEqual([c("avoir").forms.subj[0], c("aller").forms.fut[0], c("aller").forms.subj[0]], ["aie", "irai", "aille"]);
  assert.deepEqual([c("faire").forms.pres[4], c("dire").forms.pres[4], c("interdire").forms.pres[4]], ["faites", "dites", "interdisez"]);
  assert.deepEqual([c("comprendre").forms.pres[5], c("comprendre").pp], ["comprennent", "compris"]);
  assert.deepEqual([c("apercevoir").forms.pres[0], c("apercevoir").pp], ["aperçois", "aperçu"]);
  assert.deepEqual([c("devenir").forms.fut[0], c("obtenir").forms.subj[0]], ["deviendrai", "obtienne"]);
  assert.deepEqual([c("décrire").forms.pres[3], c("construire").pp, c("nuire").pp], ["décrivons", "construit", "nui"]);
  assert.deepEqual([c("connaître").forms.pres[2], c("paraître").pp, c("naître").pp], ["connaît", "paru", "né"]);
  assert.deepEqual([c("craindre").forms.pres[3], c("éteindre").pp, c("rejoindre").forms.pres[0]], ["craignons", "éteint", "rejoins"]);
  assert.deepEqual([c("vendre").forms.pres[2], c("répondre").pp, c("interrompre").forms.pres[2]], ["vend", "répondu", "interrompt"]);
  assert.deepEqual([c("ouvrir").forms.pres[0], c("offrir").pp, c("découvrir").pp], ["ouvre", "offert", "découvert"]);
  assert.deepEqual([c("pouvoir").forms.subj[0], c("vouloir").forms.subj[3], c("savoir").forms.subj[0]], ["puisse", "voulions", "sache"]);
  assert.deepEqual([c("voir").forms.fut[0], c("prévoir").forms.fut[0], c("devoir").pp], ["verrai", "prévoirai", "dû"]);
  assert.deepEqual([c("boire").forms.pres[3], c("croire").forms.pres[3], c("vivre").pp, c("survivre").pp], ["buvons", "croyons", "vécu", "survécu"]);
  assert.deepEqual([c("mourir").forms.pres[0], c("courir").forms.fut[0], c("acquérir").forms.pres[5]], ["meurs", "courrai", "acquièrent"]);
  assert.deepEqual([c("résoudre").pp, c("conclure").pp, c("inclure").pp], ["résolu", "conclu", "inclus"]);
  assert.equal(c("envoyer").forms.fut[0], "enverrai");
});

test("impersonal verbs have only the third person singular", () => {
  const f = c("falloir");
  assert.equal(f.impersonal, true);
  assert.deepEqual(f.forms.pres, ["", "", "faut", "", "", ""]);
  assert.deepEqual([f.forms.imp[2], f.forms.fut[2], f.forms.subj[2]], ["fallait", "faudra", "faille"]);
});

test("auxiliary and reflexive verbs", () => {
  assert.equal(c("aller").aux, "e");
  assert.equal(c("parler").aux, "a");
  assert.equal(c("sortir").aux, "ae", "il est sorti / il a sorti la poubelle");
  assert.deepEqual(splitReflexive("se lever"), { inf: "lever", pron: true });
  assert.deepEqual(splitReflexive("s'asseoir"), { inf: "asseoir", pron: true });
  const s = c("se lever");
  assert.equal(s.pron, true);
  assert.equal(s.aux, "e");
  assert.ok(c("s'asseoir").alt?.["pres:0"]?.includes("assois"));
});

test("headwords that are not conjugable verbs are refused", () => {
  assert.equal(conjugate("travai Iler"), null);
  assert.equal(conjugate("diminuer/baisser"), null);
  assert.equal(conjugate("maire"), null);
});
