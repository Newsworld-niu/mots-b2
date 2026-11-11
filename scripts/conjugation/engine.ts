/* French conjugation engine (written for this project, MIT like the rest of the code).
 *
 * Simple tenses are generated from rules: regular -er verbs with their spelling changes
 * (-cer, -ger, e→è, é→è, -eler/-eter, -yer), regular -ir verbs (finir), and a table of irregular
 * models in the style of the Bescherelle tables. Compound tenses are built at display time from
 * the auxiliary and the past participle (see src/lib/conjugation.ts).
 *
 * Every generated form is checked against the forms attested in Lexique 3.83 by
 * scripts/build-conjugations.ts; a verb with any disagreement is not taught until fixed.
 */

export type Tense = "pres" | "imp" | "fut" | "cond" | "subj";
export const SIMPLE_TENSES: Tense[] = ["pres", "imp", "fut", "cond", "subj"];
/** person index: 0 je, 1 tu, 2 il, 3 nous, 4 vous, 5 ils */
export type Six = [string, string, string, string, string, string];

export interface Conjugation {
  inf: string;
  /** reflexive verb (se lever): pronoun me/te/se… and auxiliary être */
  pron: boolean;
  /** model used: "er", "ir", or an irregular model key */
  model: string;
  group: 1 | 2 | 3;
  pp: string;
  /** auxiliary in compound tenses: avoir, être, or both (être intransitive / avoir transitive: sortir) */
  aux: "a" | "e" | "ae";
  /** only the 3rd person singular exists (il faut, il pleut) */
  impersonal?: boolean;
  forms: Record<Tense, Six>;
  /** accepted variants, keyed "tense:person" (paye / paie, préfèrerai / préférerai) */
  alt?: Record<string, string[]>;
}

const IMP = ["ais", "ais", "ait", "ions", "iez", "aient"];
const FUT = ["ai", "as", "a", "ons", "ez", "ont"];
const SUBJ = ["e", "es", "e", "ions", "iez", "ent"];
const six = (f: (i: number) => string) => [0, 1, 2, 3, 4, 5].map(f) as Six;

/* ------------------------------------------------------------------ auxiliary */

const ETRE_VERBS = new Set([
  "aller", "venir", "devenir", "revenir", "redevenir", "parvenir", "intervenir", "survenir", "arriver", "partir", "repartir",
  "entrer", "tomber", "retomber", "rester", "naître", "renaître", "mourir", "décéder", "apparaître", "éclore", "advenir",
]);
/** être when intransitive (il est sorti), avoir when transitive (il a sorti la poubelle) */
const ETRE_OR_AVOIR = new Set(["sortir", "ressortir", "monter", "remonter", "descendre", "redescendre", "rentrer", "retourner", "passer", "repasser"]);

/* ------------------------------------------------------------------ first group (-er) */

/** -eler / -eter verbs that take è instead of doubling the consonant */
const ELER_ETER_GRAVE = new Set([
  "acheter", "racheter", "geler", "dégeler", "congeler", "surgeler", "peler", "modeler", "remodeler", "harceler", "ciseler",
  "démanteler", "écarteler", "marteler", "crocheter", "fureter", "haleter", "corseter", "celer", "déceler", "receler",
]);
const VOWEL = "aeiouyàâäéèêëîïôöûùüœ";
const isVowel = (c: string | undefined) => !!c && VOWEL.includes(c);

function firstGroup(inf: string): Conjugation {
  const stem = inf.slice(0, -2);
  let silent = stem; // stem before a silent ending (je lève, ils lèvent)
  let fut = inf; // future / conditional stem
  const alt: Record<string, string[]> = {};

  if (/[ou]yer$/.test(inf)) {
    silent = stem.slice(0, -1) + "i";
    fut = silent + "er";
  } else if (/ayer$/.test(inf)) {
    silent = stem.slice(0, -1) + "i"; // je paie (also: je paye)
    fut = silent + "er";
  } else {
    // vowel of the last syllable of the stem, followed by one consonant or consonant + r/l
    const m = stem.match(/^(.*)([eé])([bcdfgjklmnpqrstvz]|[bcdfgkptv][rl]|qu|gu|gn|ch)$/);
    // a plain e after a vowel is part of a digraph (ei, eu…), not the vowel that changes
    if (m && (m[2] === "é" || !isVowel(m[1].slice(-1)))) {
      const [, before, vowel, cons] = m;
      if (vowel === "e") {
        if ((/(el|et)$/.test(stem) && !ELER_ETER_GRAVE.has(inf)) || inf === "appeler") {
          silent = stem + stem.slice(-1); // j'appelle, je jette
        } else {
          silent = before + "è" + cons; // je lève, j'achète
        }
        fut = silent + "er"; // je lèverai, j'appellerai
      } else {
        silent = before + "è" + cons; // je préfère
        // future keeps é traditionally (préférerai); è is accepted since the 1990 spelling reform
        const reform = silent + "er";
        for (let i = 0; i < 6; i++) {
          alt[`fut:${i}`] = [reform + FUT[i]];
          alt[`cond:${i}`] = [reform + IMP[i]];
        }
      }
    }
  }

  // -cer / -ger: keep the soft sound before a and o (nous commençons, nous mangeons)
  const join = (base: string, ending: string) => {
    if (/^[aoâ]/.test(ending)) {
      if (base.endsWith("c")) return base.slice(0, -1) + "ç" + ending;
      if (base.endsWith("g")) return base + "e" + ending;
    }
    return base + ending;
  };
  const SILENT = [true, true, true, false, false, true];
  const pres = six((i) => join(SILENT[i] ? silent : stem, ["e", "es", "e", "ons", "ez", "ent"][i]));
  const subj = six((i) => join(SILENT[i] ? silent : stem, SUBJ[i]));
  const forms: Record<Tense, Six> = {
    pres,
    imp: six((i) => join(stem, IMP[i])),
    fut: six((i) => fut + FUT[i]),
    cond: six((i) => fut + IMP[i]),
    subj,
  };
  if (/ayer$/.test(inf)) {
    // je paye, je payerai: both spellings are correct
    for (let i = 0; i < 6; i++) {
      if (SILENT[i]) alt[`pres:${i}`] = [stem + ["e", "es", "e", "ons", "ez", "ent"][i]];
      if (SILENT[i]) alt[`subj:${i}`] = [stem + SUBJ[i]];
      alt[`fut:${i}`] = [inf + FUT[i]];
      alt[`cond:${i}`] = [inf + IMP[i]];
    }
  }
  return { inf, pron: false, model: "er", group: 1, pp: stem + "é", aux: "a", forms, ...(Object.keys(alt).length ? { alt } : {}) };
}

/* ------------------------------------------------------------------ second group (finir) */

function secondGroup(inf: string): Conjugation {
  const s = inf.slice(0, -2);
  return build(inf, "ir", 2, {
    pres: [s + "is", s + "is", s + "it", s + "issons", s + "issez", s + "issent"],
    fut: inf,
    pp: s + "i",
    subj: [s + "iss", s + "iss"],
  });
}

/* ------------------------------------------------------------------ irregular models */

interface Parts {
  pres: string[];
  /** future / conditional stem */
  fut: string;
  pp: string;
  /** imperfect stem; default: the nous form of the present without -ons */
  imp?: string;
  /** subjunctive stems [je/tu/il/ils, nous/vous]; default: [ils form without -ent, imperfect stem] */
  subj?: [string, string];
  /** full subjunctive when it is not stem + endings (être, avoir) */
  subjForms?: string[];
  impersonal?: boolean;
}

function build(inf: string, model: string, group: 1 | 2 | 3, p: Parts): Conjugation {
  const imp = p.imp ?? p.pres[3].replace(/ons$/, "");
  const [s1, s2] = p.subj ?? [p.pres[5].replace(/ent$/, ""), imp];
  const forms: Record<Tense, Six> = {
    pres: p.pres as Six,
    imp: six((i) => imp + IMP[i]),
    fut: six((i) => p.fut + FUT[i]),
    cond: six((i) => p.fut + IMP[i]),
    subj: (p.subjForms as Six) ?? six((i) => (i === 3 || i === 4 ? s2 : s1) + SUBJ[i]),
  };
  if (p.impersonal) for (const t of SIMPLE_TENSES) forms[t] = six((i) => (i === 2 ? forms[t][2] : ""));
  return { inf, pron: false, model, group, pp: p.pp, aux: "a", forms, ...(p.impersonal ? { impersonal: true } : {}) };
}

/** A model is written for the part of the infinitive named `ending`; derived verbs keep their prefix
 *  (prendre → comprendre, cevoir → recevoir / apercevoir). `only` restricts it to listed verbs. */
interface Model {
  key: string;
  ending: string;
  only?: string[];
  group?: 2 | 3;
  parts: Parts;
}

const M = (key: string, ending: string, parts: Parts, only?: string[]): Model => ({ key, ending, parts, ...(only ? { only } : {}) });

const MODELS: Model[] = [
  M("être", "être", { pres: ["suis", "es", "est", "sommes", "êtes", "sont"], imp: "ét", fut: "ser", pp: "été", subjForms: ["sois", "sois", "soit", "soyons", "soyez", "soient"] }, ["être"]),
  M("avoir", "avoir", { pres: ["ai", "as", "a", "avons", "avez", "ont"], fut: "aur", pp: "eu", subjForms: ["aie", "aies", "ait", "ayons", "ayez", "aient"] }, ["avoir"]),
  M("aller", "aller", { pres: ["vais", "vas", "va", "allons", "allez", "vont"], fut: "ir", pp: "allé", subj: ["aill", "all"] }, ["aller"]),
  M("envoyer", "envoyer", { pres: ["envoie", "envoies", "envoie", "envoyons", "envoyez", "envoient"], fut: "enverr", pp: "envoyé", subj: ["envoi", "envoy"] }),
  M("haïr", "haïr", { pres: ["hais", "hais", "hait", "haïssons", "haïssez", "haïssent"], fut: "haïr", pp: "haï", subj: ["haïss", "haïss"] }, ["haïr"]),
  M("faire", "faire", { pres: ["fais", "fais", "fait", "faisons", "faites", "font"], fut: "fer", pp: "fait", subj: ["fass", "fass"] }),
  M("dire", "dire", { pres: ["dis", "dis", "dit", "disons", "dites", "disent"], fut: "dir", pp: "dit", subj: ["dis", "dis"] }, ["dire", "redire"]),
  M("interdire", "dire", { pres: ["dis", "dis", "dit", "disons", "disez", "disent"], fut: "dir", pp: "dit", subj: ["dis", "dis"] }, ["interdire", "contredire", "prédire", "médire", "dédire"]),
  M("maudire", "maudire", { pres: ["maudis", "maudis", "maudit", "maudissons", "maudissez", "maudissent"], fut: "maudir", pp: "maudit", subj: ["maudiss", "maudiss"] }),
  M("suffire", "suffire", { pres: ["suffis", "suffis", "suffit", "suffisons", "suffisez", "suffisent"], fut: "suffir", pp: "suffi", subj: ["suffis", "suffis"] }),
  M("prendre", "prendre", { pres: ["prends", "prends", "prend", "prenons", "prenez", "prennent"], fut: "prendr", pp: "pris", subj: ["prenn", "pren"] }),
  M("venir", "venir", { pres: ["viens", "viens", "vient", "venons", "venez", "viennent"], fut: "viendr", pp: "venu", subj: ["vienn", "ven"] }),
  M("tenir", "tenir", { pres: ["tiens", "tiens", "tient", "tenons", "tenez", "tiennent"], fut: "tiendr", pp: "tenu", subj: ["tienn", "ten"] }),
  M("mettre", "mettre", { pres: ["mets", "mets", "met", "mettons", "mettez", "mettent"], fut: "mettr", pp: "mis", subj: ["mett", "mett"] }),
  M("battre", "battre", { pres: ["bats", "bats", "bat", "battons", "battez", "battent"], fut: "battr", pp: "battu", subj: ["batt", "batt"] }),
  M("voir", "voir", { pres: ["vois", "vois", "voit", "voyons", "voyez", "voient"], fut: "verr", pp: "vu", subj: ["voi", "voy"] }, ["voir", "revoir", "entrevoir"]),
  M("prévoir", "prévoir", { pres: ["prévois", "prévois", "prévoit", "prévoyons", "prévoyez", "prévoient"], fut: "prévoir", pp: "prévu", subj: ["prévoi", "prévoy"] }, ["prévoir"]),
  M("devoir", "devoir", { pres: ["dois", "dois", "doit", "devons", "devez", "doivent"], fut: "devr", pp: "dû", subj: ["doiv", "dev"] }, ["devoir"]),
  M("recevoir", "cevoir", { pres: ["çois", "çois", "çoit", "cevons", "cevez", "çoivent"], fut: "cevr", pp: "çu", subj: ["çoiv", "cev"] }),
  M("pouvoir", "pouvoir", { pres: ["peux", "peux", "peut", "pouvons", "pouvez", "peuvent"], fut: "pourr", pp: "pu", subj: ["puiss", "puiss"] }, ["pouvoir"]),
  M("vouloir", "vouloir", { pres: ["veux", "veux", "veut", "voulons", "voulez", "veulent"], fut: "voudr", pp: "voulu", subj: ["veuill", "voul"] }, ["vouloir"]),
  M("savoir", "savoir", { pres: ["sais", "sais", "sait", "savons", "savez", "savent"], fut: "saur", pp: "su", subj: ["sach", "sach"] }, ["savoir"]),
  M("valoir", "valoir", { pres: ["vaux", "vaux", "vaut", "valons", "valez", "valent"], fut: "vaudr", pp: "valu", subj: ["vaill", "val"] }, ["valoir", "équivaloir"]),
  M("falloir", "falloir", { pres: ["", "", "faut", "", "", ""], imp: "fall", fut: "faudr", pp: "fallu", subj: ["faill", "faill"], impersonal: true }, ["falloir"]),
  M("pleuvoir", "pleuvoir", { pres: ["", "", "pleut", "", "", ""], imp: "pleuv", fut: "pleuvr", pp: "plu", subj: ["pleuv", "pleuv"], impersonal: true }, ["pleuvoir"]),
  M("écrire", "crire", { pres: ["cris", "cris", "crit", "crivons", "crivez", "crivent"], fut: "crir", pp: "crit", subj: ["criv", "criv"] }),
  M("lire", "lire", { pres: ["lis", "lis", "lit", "lisons", "lisez", "lisent"], fut: "lir", pp: "lu", subj: ["lis", "lis"] }, ["lire", "relire", "élire", "réélire"]),
  M("conduire", "uire", { pres: ["uis", "uis", "uit", "uisons", "uisez", "uisent"], fut: "uir", pp: "uit", subj: ["uis", "uis"] }),
  M("nuire", "uire", { pres: ["uis", "uis", "uit", "uisons", "uisez", "uisent"], fut: "uir", pp: "ui", subj: ["uis", "uis"] }, ["nuire", "luire", "reluire"]),
  M("connaître", "aître", { pres: ["ais", "ais", "aît", "aissons", "aissez", "aissent"], fut: "aîtr", pp: "u", subj: ["aiss", "aiss"] }),
  M("naître", "naître", { pres: ["nais", "nais", "naît", "naissons", "naissez", "naissent"], fut: "naîtr", pp: "né", subj: ["naiss", "naiss"] }, ["naître", "renaître"]),
  M("craindre", "aindre", { pres: ["ains", "ains", "aint", "aignons", "aignez", "aignent"], fut: "aindr", pp: "aint", subj: ["aign", "aign"] }),
  M("peindre", "eindre", { pres: ["eins", "eins", "eint", "eignons", "eignez", "eignent"], fut: "eindr", pp: "eint", subj: ["eign", "eign"] }),
  M("joindre", "oindre", { pres: ["oins", "oins", "oint", "oignons", "oignez", "oignent"], fut: "oindr", pp: "oint", subj: ["oign", "oign"] }),
  M("rendre", "dre", { pres: ["ds", "ds", "d", "dons", "dez", "dent"], fut: "dr", pp: "du", subj: ["d", "d"] }),
  M("rompre", "rompre", { pres: ["romps", "romps", "rompt", "rompons", "rompez", "rompent"], fut: "rompr", pp: "rompu", subj: ["romp", "romp"] }),
  M("vaincre", "vaincre", { pres: ["vaincs", "vaincs", "vainc", "vainquons", "vainquez", "vainquent"], fut: "vaincr", pp: "vaincu", subj: ["vainqu", "vainqu"] }),
  M("ouvrir", "vrir", { pres: ["vre", "vres", "vre", "vrons", "vrez", "vrent"], fut: "vrir", pp: "vert", subj: ["vr", "vr"] }),
  M("offrir", "frir", { pres: ["fre", "fres", "fre", "frons", "frez", "frent"], fut: "frir", pp: "fert", subj: ["fr", "fr"] }),
  M("courir", "courir", { pres: ["cours", "cours", "court", "courons", "courez", "courent"], fut: "courr", pp: "couru", subj: ["cour", "cour"] }),
  M("mourir", "mourir", { pres: ["meurs", "meurs", "meurt", "mourons", "mourez", "meurent"], fut: "mourr", pp: "mort", subj: ["meur", "mour"] }, ["mourir"]),
  M("cueillir", "cueillir", { pres: ["cueille", "cueilles", "cueille", "cueillons", "cueillez", "cueillent"], fut: "cueiller", pp: "cueilli", subj: ["cueill", "cueill"] }),
  M("assaillir", "aillir", { pres: ["aille", "ailles", "aille", "aillons", "aillez", "aillent"], fut: "aillir", pp: "ailli", subj: ["aill", "aill"] }, ["assaillir", "tressaillir", "défaillir"]),
  M("acquérir", "quérir", { pres: ["quiers", "quiers", "quiert", "quérons", "quérez", "quièrent"], fut: "querr", pp: "quis", subj: ["quièr", "quér"] }),
  M("fuir", "fuir", { pres: ["fuis", "fuis", "fuit", "fuyons", "fuyez", "fuient"], fut: "fuir", pp: "fui", subj: ["fui", "fuy"] }),
  M("vêtir", "vêtir", { pres: ["vêts", "vêts", "vêt", "vêtons", "vêtez", "vêtent"], fut: "vêtir", pp: "vêtu", subj: ["vêt", "vêt"] }),
  M("bouillir", "bouillir", { pres: ["bous", "bous", "bout", "bouillons", "bouillez", "bouillent"], fut: "bouillir", pp: "bouilli", subj: ["bouill", "bouill"] }),
  M("boire", "boire", { pres: ["bois", "bois", "boit", "buvons", "buvez", "boivent"], fut: "boir", pp: "bu", subj: ["boiv", "buv"] }, ["boire"]),
  M("croire", "croire", { pres: ["crois", "crois", "croit", "croyons", "croyez", "croient"], fut: "croir", pp: "cru", subj: ["croi", "croy"] }, ["croire"]),
  M("accroître", "croître", { pres: ["crois", "crois", "croît", "croissons", "croissez", "croissent"], fut: "croîtr", pp: "cru", subj: ["croiss", "croiss"] }, ["accroître", "décroître"]),
  M("croître", "croître", { pres: ["croîs", "croîs", "croît", "croissons", "croissez", "croissent"], fut: "croîtr", pp: "crû", subj: ["croiss", "croiss"] }, ["croître"]),
  M("vivre", "vivre", { pres: ["vis", "vis", "vit", "vivons", "vivez", "vivent"], fut: "vivr", pp: "vécu", subj: ["viv", "viv"] }),
  M("suivre", "suivre", { pres: ["suis", "suis", "suit", "suivons", "suivez", "suivent"], fut: "suivr", pp: "suivi", subj: ["suiv", "suiv"] }),
  M("plaire", "plaire", { pres: ["plais", "plais", "plaît", "plaisons", "plaisez", "plaisent"], fut: "plair", pp: "plu", subj: ["plais", "plais"] }),
  M("taire", "taire", { pres: ["tais", "tais", "tait", "taisons", "taisez", "taisent"], fut: "tair", pp: "tu", subj: ["tais", "tais"] }, ["taire"]),
  M("rire", "rire", { pres: ["ris", "ris", "rit", "rions", "riez", "rient"], fut: "rir", pp: "ri", subj: ["ri", "ri"] }, ["rire", "sourire"]),
  M("conclure", "clure", { pres: ["clus", "clus", "clut", "cluons", "cluez", "cluent"], fut: "clur", pp: "clu", subj: ["clu", "clu"] }),
  M("inclure", "clure", { pres: ["clus", "clus", "clut", "cluons", "cluez", "cluent"], fut: "clur", pp: "clus", subj: ["clu", "clu"] }, ["inclure", "occlure"]),
  M("résoudre", "soudre", { pres: ["sous", "sous", "sout", "solvons", "solvez", "solvent"], fut: "soudr", pp: "solu", subj: ["solv", "solv"] }, ["résoudre"]),
  M("dissoudre", "soudre", { pres: ["sous", "sous", "sout", "solvons", "solvez", "solvent"], fut: "soudr", pp: "sous", subj: ["solv", "solv"] }, ["dissoudre", "absoudre"]),
  M("coudre", "coudre", { pres: ["couds", "couds", "coud", "cousons", "cousez", "cousent"], fut: "coudr", pp: "cousu", subj: ["cous", "cous"] }),
  M("moudre", "moudre", { pres: ["mouds", "mouds", "moud", "moulons", "moulez", "moulent"], fut: "moudr", pp: "moulu", subj: ["moul", "moul"] }),
  M("traire", "traire", { pres: ["trais", "trais", "trait", "trayons", "trayez", "traient"], fut: "trair", pp: "trait", subj: ["trai", "tray"] }),
  M("émouvoir", "mouvoir", { pres: ["meus", "meus", "meut", "mouvons", "mouvez", "meuvent"], fut: "mouvr", pp: "mu", subj: ["meuv", "mouv"] }, ["émouvoir", "promouvoir"]),
  M("asseoir", "asseoir", { pres: ["assieds", "assieds", "assied", "asseyons", "asseyez", "asseyent"], fut: "assiér", pp: "assis", subj: ["assey", "assey"] }),
];

/** -ir verbs conjugated like partir: je pars, nous partons, parti (not finir-type) */
const PARTIR = new Set([
  "partir", "repartir", "sortir", "ressortir", "dormir", "endormir", "rendormir", "sentir", "ressentir", "consentir", "pressentir",
  "servir", "desservir", "resservir", "mentir", "démentir", "repentir",
]);

function partirType(inf: string): Conjugation {
  const plural = inf.slice(0, -2); // part
  const sing = inf.slice(0, -3); // par
  return build(inf, "partir", 3, {
    pres: [sing + "s", sing + "s", sing + "t", plural + "ons", plural + "ez", plural + "ent"],
    fut: inf,
    pp: plural + "i",
    subj: [plural, plural],
  });
}

/* ------------------------------------------------------------------ entry point */

const FIRST_GROUP_IRREGULAR = new Set(["aller", "envoyer", "renvoyer"]);
const VALID = /^[a-zàâäçéèêëîïôöûùüÿœ-]+$/;

/** Infinitive without reflexive pronoun, and whether the headword is reflexive (se lever, s'asseoir). */
export function splitReflexive(lemma: string): { inf: string; pron: boolean } {
  const s = lemma.normalize("NFC").trim().toLowerCase().replace(/’/g, "'");
  const m = s.match(/^(se\s+|s')(.+)$/);
  return m ? { inf: m[2], pron: true } : { inf: s, pron: false };
}

/** Conjugate an infinitive, or return null when it is not a verb this engine can conjugate. */
export function conjugate(lemma: string): Conjugation | null {
  const { inf, pron } = splitReflexive(lemma);
  if (!VALID.test(inf) || inf.length < 3) return null;
  let c: Conjugation | null = null;

  const candidates = MODELS.filter((m) => (m.only ? m.only.includes(inf) : inf.endsWith(m.ending)) && inf.endsWith(m.ending));
  candidates.sort((a, b) => Number(!!b.only) - Number(!!a.only) || b.ending.length - a.ending.length);
  const model = candidates[0];

  if (model) {
    const prefix = inf.slice(0, inf.length - model.ending.length);
    const p = model.parts;
    const add = (s: string) => (s ? prefix + s : "");
    c = build(inf, model.key, 3, {
      pres: p.pres.map(add),
      fut: prefix + p.fut,
      pp: prefix + p.pp,
      imp: p.imp !== undefined ? prefix + p.imp : undefined,
      subj: p.subj ? [prefix + p.subj[0], prefix + p.subj[1]] : undefined,
      subjForms: p.subjForms?.map(add),
      impersonal: p.impersonal,
    });
    if (model.key === "envoyer" || model.key === "aller") c.group = 1;
  } else if (PARTIR.has(inf)) {
    c = partirType(inf);
  } else if (inf.endsWith("er") && !FIRST_GROUP_IRREGULAR.has(inf)) {
    c = firstGroup(inf);
  } else if (inf.endsWith("ir") && !inf.endsWith("oir")) {
    c = secondGroup(inf);
  }
  if (!c) return null;

  if (c.model === "asseoir") {
    // j'assieds / j'assois: both conjugations are standard
    const pre = inf.slice(0, -"asseoir".length);
    const alt: Record<string, string[]> = {};
    ["assois", "assois", "assoit", "assoyons", "assoyez", "assoient"].forEach((f, i) => (alt[`pres:${i}`] = [pre + f]));
    for (let i = 0; i < 6; i++) {
      alt[`fut:${i}`] = [pre + "assoir" + FUT[i]];
      alt[`cond:${i}`] = [pre + "assoir" + IMP[i]];
      alt[`subj:${i}`] = [pre + (i === 3 || i === 4 ? "assoy" : "assoi") + SUBJ[i]];
      alt[`imp:${i}`] = [pre + "assoy" + IMP[i]];
    }
    c.alt = alt;
  }
  c.pron = pron;
  c.aux = pron || ETRE_VERBS.has(inf) ? "e" : ETRE_OR_AVOIR.has(inf) ? "ae" : "a";
  if (pron && c.aux === "e" && ETRE_OR_AVOIR.has(inf)) c.aux = "e";
  return c;
}
