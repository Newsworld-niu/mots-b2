/* Conjugation display and answer checking for the 变位 section. Tables come from public/atlas/conj.json
 * (scripts/build-conjugations.ts); compound tenses are built here from the auxiliary and the participle. */

export type SimpleTense = "pres" | "imp" | "fut" | "cond" | "subj";
export type CompoundTense = "pc" | "pqp" | "fa" | "condp" | "subjp";
export type ConjTense = SimpleTense | CompoundTense | "ppres";

export interface ConjVerb {
  /** infinitive without reflexive pronoun */
  i: string;
  /** reflexive (se lever) */
  p?: 1;
  /** auxiliary: avoir, être, or être intransitive / avoir transitive */
  a: "a" | "e" | "ae";
  pp: string;
  m: string;
  /** impersonal: only il (il faut) */
  imp?: 1;
  f: Record<SimpleTense, string[]>;
  alt?: Record<string, string[]>;
  /** Analogical non-existent forms keyed "tense:person" or "pp", checked against Lexique. */
  tr?: Record<string, string[]>;
}

export const TENSES: ConjTense[] = ["pres", "pc", "imp", "fut", "cond", "subj", "pqp", "fa", "condp", "subjp", "ppres"];
export const TENSE_FR: Record<ConjTense, string> = {
  pres: "présent",
  pc: "passé composé",
  imp: "imparfait",
  fut: "futur simple",
  cond: "conditionnel présent",
  subj: "subjonctif présent",
  pqp: "plus-que-parfait",
  fa: "futur antérieur",
  condp: "conditionnel passé",
  subjp: "subjonctif passé",
  ppres: "participe présent",
};
export const TENSE_ZH: Record<ConjTense, string> = {
  pres: "现在时",
  pc: "复合过去时",
  imp: "未完成过去时",
  fut: "简单将来时",
  cond: "条件式现在时",
  subj: "虚拟式现在时",
  pqp: "愈过去时",
  fa: "先将来时",
  condp: "条件式过去时",
  subjp: "虚拟式过去时",
  ppres: "现在分词",
};
/** Tenses unlocked by the learner's start level (0 = A1 … 3 = B2 and above). */
export function tensesForLevel(level: number): ConjTense[] {
  if (level <= 0) return ["pres", "pc"];
  if (level === 1) return ["pres", "pc", "imp", "fut"];
  if (level === 2) return ["pres", "pc", "imp", "fut", "cond", "subj", "pqp"];
  return [...TENSES];
}

export const PRONOUNS = ["je", "tu", "il", "nous", "vous", "ils"];
const REFLEXIVE = ["me", "te", "se", "nous", "vous", "se"];
const AUXILIARIES: Record<CompoundTense, { a: readonly string[]; e: readonly string[] }> = {
  pc: { a: ["ai", "as", "a", "avons", "avez", "ont"], e: ["suis", "es", "est", "sommes", "êtes", "sont"] },
  pqp: { a: ["avais", "avais", "avait", "avions", "aviez", "avaient"], e: ["étais", "étais", "était", "étions", "étiez", "étaient"] },
  fa: { a: ["aurai", "auras", "aura", "aurons", "aurez", "auront"], e: ["serai", "seras", "sera", "serons", "serez", "seront"] },
  condp: { a: ["aurais", "aurais", "aurait", "aurions", "auriez", "auraient"], e: ["serais", "serais", "serait", "serions", "seriez", "seraient"] },
  subjp: { a: ["aie", "aies", "ait", "ayons", "ayez", "aient"], e: ["sois", "sois", "soit", "soyons", "soyez", "soient"] },
};
export const isCompoundTense = (t: ConjTense): t is CompoundTense => t === "pc" || t === "pqp" || t === "fa" || t === "condp" || t === "subjp";

/** Verbs whose h is aspirated: no elision (je hais, je hurle). */
const H_ASPIRE = new Set(["haïr", "hurler", "hausser", "heurter", "hacher", "harceler", "hâter", "hanter", "hasarder", "hisser", "huer", "hocher", "hennir", "harasser", "harponner", "haleter", "hérisser", "heurter"]);
const startsWithVowel = (word: string, inf: string) => /^[aeiouyàâäéèêëîïôöûùüœæ]/i.test(word) || (/^h/i.test(word) && !H_ASPIRE.has(inf));

/** Past participle agreement: allé → allée, allés, allées; pris → prise, pris, prises. */
export function agree(pp: string, fem: boolean, plural: boolean) {
  let w = fem ? pp + "e" : pp;
  if (plural && !/[sx]$/.test(w)) w += "s";
  return w;
}

/** Which agreements are acceptable for each person with être: je/tu m or f, il m, nous/vous plural (vous also polite singular), ils m pl. */
const AGREEMENTS: [boolean, boolean][][] = [
  [[false, false], [true, false]],
  [[false, false], [true, false]],
  [[false, false]],
  [[false, true], [true, true]],
  [[false, false], [true, false], [false, true], [true, true]],
  [[false, true]],
];
const AGREE_LABEL = ["(e)", "(e)", "", "(e)s", "(e)(s)", "s"];

export function persons(v: ConjVerb) {
  return v.imp ? [2] : [0, 1, 2, 3, 4, 5];
}

/** Valid person indices for one verb & tense (`ppres` is invariable and uses slot 0, except defective falloir). */
export function personsFor(v: ConjVerb, tense: ConjTense): number[] {
  if (tense === "ppres") return participePresentForm(v) ? [0] : [];
  return persons(v);
}

/** Derive the French participe présent from the nous-présent stem (plus the 3 irregular verbs). */
export function participePresentForm(v: ConjVerb): string | null {
  if (v.i === "falloir") return null;
  if (v.i === "être") return "étant";
  if (v.i === "avoir") return "ayant";
  if (v.i === "savoir") return "sachant";
  const p3 = v.f.pres?.[3];
  if (p3 && p3.endsWith("ons")) return p3.slice(0, -3) + "ant";
  const imp2 = v.f.imp?.[2];
  if (v.imp && imp2 && imp2.endsWith("ait")) return imp2.slice(0, -3) + "ant";
  return null;
}

export interface Prompt {
  /** words before the blank: "que je", "nous", "tu t'", "il s'" */
  before: string;
  /** the answer as shown: "suis allé(e)" */
  shown: string;
  /** every accepted answer (lower case, single spaces) */
  accepted: string[];
}

/** The subject (and reflexive pronoun) in front of a verb form, with elision. */
export function subjectFor(v: ConjVerb, tense: ConjTense, person: number, firstWord: string) {
  const elide = startsWithVowel(firstWord, v.i);
  if (tense === "ppres") return v.p ? (elide ? "s'" : "se") : "";
  let words: string[] = [];
  if (v.p) {
    const r = REFLEXIVE[person];
    words = [PRONOUNS[person], elide && (r === "me" || r === "te" || r === "se") ? r[0] + "'" : r];
  } else {
    words = [person === 0 && elide ? "j'" : PRONOUNS[person]];
  }
  if (tense === "subj" || tense === "subjp") words.unshift(/^il/.test(words[0]) ? "qu'" : "que");
  return words.reduce((acc, w) => (acc === "" ? w : acc.endsWith("'") ? acc + w : acc + " " + w), "");
}

/** Prompt for one cell of the table. */
export function promptFor(v: ConjVerb, tense: ConjTense, person: number): Prompt {
  if (tense === "ppres") {
    const form = participePresentForm(v) ?? "";
    const altStems = (v.alt?.["pres:3"] ?? []).filter((s) => s.endsWith("ons")).map((s) => s.slice(0, -3) + "ant");
    const forms = [form, ...altStems].filter(Boolean);
    const before = subjectFor(v, tense, person, form);
    const accepted = [...forms, ...(v.p && form ? forms.map((f) => `${before}${before.endsWith("'") ? "" : " "}${f}`) : [])].map(norm);
    return { before, shown: form, accepted: [...new Set(accepted)] };
  }
  if (!isCompoundTense(tense)) {
    const form = v.f[tense][person];
    const alts = v.alt?.[`${tense}:${person}`] ?? [];
    return { before: subjectFor(v, tense, person, form), shown: form, accepted: [form, ...alts].map(norm) };
  }
  const withEtre = v.p || v.a === "e" || v.a === "ae";
  const bank = AUXILIARIES[tense];
  const aux = (withEtre ? bank.e : bank.a)[person];
  const pps = withEtre ? AGREEMENTS[person].map(([f, pl]) => agree(v.pp, f, pl)) : [v.pp];
  const accepted = pps.map((pp) => `${aux} ${pp}`);
  if (v.a === "ae" && !v.p) accepted.push(`${bank.a[person]} ${v.pp}`); // transitive use: j'ai sorti la poubelle
  const shown = withEtre && AGREE_LABEL[person] ? `${aux} ${v.pp}${AGREE_LABEL[person]}` : `${aux} ${v.pp}`;
  return { before: subjectFor(v, tense, person, aux), shown, accepted: accepted.map(norm) };
}

export const norm = (s: string) => s.normalize("NFC").trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");
const fold = (s: string) => norm(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe");

/** "right", "accent" (right letters, wrong or missing accents), or "wrong". */
export function checkAnswer(input: string, accepted: string[]): "right" | "accent" | "wrong" {
  const a = norm(input);
  if (!a) return "wrong";
  if (accepted.includes(a)) return "right";
  if (accepted.some((x) => fold(x) === fold(a))) return "accent";
  return "wrong";
}

/** Plausible wrong answers for a multiple-choice question: analogical traps first, then other tenses and persons. */
export function distractorsFor(v: ConjVerb, tense: ConjTense, person: number, seed: number) {
  const right = new Set(promptFor(v, tense, person).accepted);
  const traps: string[] = [];
  if (tense === "ppres") {
    const naive = v.i.replace(/(?:er|ir|re)$/, "ant");
    if (naive && naive !== v.i) traps.push(naive);
    if (v.i === "être") traps.push("êtant", "étu");
    if (v.i === "avoir") traps.push("avant", "ayé");
    if (v.i === "savoir") traps.push("savant");
    if (v.pp) traps.push(v.pp);
    for (const f of [v.f.pres?.[2], v.f.imp?.[0], v.f.subj?.[2]]) if (f) traps.push(f);
  } else if (isCompoundTense(tense)) {
    const withEtre = v.p || v.a === "e" || v.a === "ae";
    const bank = AUXILIARIES[tense];
    // the classic mistake: the wrong auxiliary
    traps.push(`${(withEtre ? bank.a : bank.e)[person]} ${v.pp}`);
    // then analogical fake past participles (ai recevu, a pleuvu, est mouri)
    const aux = (withEtre ? bank.e : bank.a)[person];
    const mark = withEtre ? AGREE_LABEL[person] : "";
    for (const pp of v.tr?.pp ?? []) traps.push(`${aux} ${pp}${mark}`);
  } else {
    for (const f of v.tr?.[`${tense}:${person}`] ?? []) traps.push(f);
  }
  const pool: string[] = [];
  const others = TENSES.filter((t) => t !== tense && personsFor(v, t).includes(person));
  for (const t of others) pool.push(promptFor(v, t, person).shown);
  for (const p of personsFor(v, tense)) if (p !== person) pool.push(promptFor(v, tense, p).shown);
  // seeded shuffle so the options do not move when the component re-renders
  let x = seed % 233280;
  const rnd = () => (x = (x * 9301 + 49297) % 233280) / 233280;
  const shuffled = pool.map((s) => ({ s, k: rnd() })).sort((a, b) => a.k - b.k).map((o) => o.s);
  const ordered = [...traps, ...shuffled];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of ordered) {
    const n = norm(s);
    if (!s || right.has(n) || seen.has(n)) continue;
    seen.add(n);
    out.push(s);
    if (out.length === 3) break;
  }
  return out;
}

/** Rows of a full table for one tense: [subject, form]. */
export function tableFor(v: ConjVerb, tense: ConjTense) {
  return personsFor(v, tense).map((p) => {
    const pr = promptFor(v, tense, p);
    return { person: p, before: pr.before, form: pr.shown };
  });
}
