/* Conjugation display and answer checking for the 变位 section. Tables come from public/atlas/conj.json
 * (scripts/build-conjugations.ts); compound tenses are built here from the auxiliary and the participle. */

export type SimpleTense = "pres" | "imp" | "fut" | "cond" | "subj";
export type ConjTense = SimpleTense | "pc";

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
}

export const TENSES: ConjTense[] = ["pres", "pc", "imp", "fut", "cond", "subj"];
export const TENSE_FR: Record<ConjTense, string> = {
  pres: "présent",
  pc: "passé composé",
  imp: "imparfait",
  fut: "futur simple",
  cond: "conditionnel présent",
  subj: "subjonctif présent",
};
export const TENSE_ZH: Record<ConjTense, string> = {
  pres: "现在时",
  pc: "复合过去时",
  imp: "未完成过去时",
  fut: "简单将来时",
  cond: "条件式现在时",
  subj: "虚拟式现在时",
};
/** Tenses unlocked by the learner's start level (0 = A1 … 3 = B2 and above). */
export function tensesForLevel(level: number): ConjTense[] {
  if (level <= 0) return ["pres", "pc"];
  if (level === 1) return ["pres", "pc", "imp", "fut"];
  if (level === 2) return ["pres", "pc", "imp", "fut", "cond"];
  return [...TENSES];
}

export const PRONOUNS = ["je", "tu", "il", "nous", "vous", "ils"];
const REFLEXIVE = ["me", "te", "se", "nous", "vous", "se"];
const AVOIR = ["ai", "as", "a", "avons", "avez", "ont"];
const ETRE = ["suis", "es", "est", "sommes", "êtes", "sont"];

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
  let words: string[] = [];
  if (v.p) {
    const r = REFLEXIVE[person];
    words = [PRONOUNS[person], elide && (r === "me" || r === "te" || r === "se") ? r[0] + "'" : r];
  } else {
    words = [person === 0 && elide ? "j'" : PRONOUNS[person]];
  }
  if (tense === "subj") words.unshift(/^il/.test(words[0]) ? "qu'" : "que");
  return words.reduce((acc, w) => (acc === "" ? w : acc.endsWith("'") ? acc + w : acc + " " + w), "");
}

/** Prompt for one cell of the table. */
export function promptFor(v: ConjVerb, tense: ConjTense, person: number): Prompt {
  if (tense !== "pc") {
    const form = v.f[tense][person];
    const alts = v.alt?.[`${tense}:${person}`] ?? [];
    return { before: subjectFor(v, tense, person, form), shown: form, accepted: [form, ...alts].map(norm) };
  }
  const withEtre = v.p || v.a === "e" || v.a === "ae";
  const aux = withEtre ? ETRE[person] : AVOIR[person];
  const pps = withEtre ? AGREEMENTS[person].map(([f, pl]) => agree(v.pp, f, pl)) : [v.pp];
  const accepted = pps.map((pp) => `${aux} ${pp}`);
  if (v.a === "ae" && !v.p) accepted.push(`${AVOIR[person]} ${v.pp}`); // transitive use: j'ai sorti la poubelle
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

/** Plausible wrong answers for a multiple-choice question: the same person in other tenses, other persons in this tense. */
export function distractorsFor(v: ConjVerb, tense: ConjTense, person: number, seed: number) {
  const right = new Set(promptFor(v, tense, person).accepted);
  const pool: string[] = [];
  const others = TENSES.filter((t) => t !== tense);
  for (const t of others) pool.push(promptFor(v, t, person).shown);
  for (const p of persons(v)) if (p !== person) pool.push(promptFor(v, tense, p).shown);
  if (tense === "pc") {
    // the classic mistake: the wrong auxiliary
    const withEtre = v.p || v.a !== "a";
    pool.unshift(`${(withEtre ? AVOIR : ETRE)[person]} ${v.pp}`);
  }
  const wrongAux = tense === "pc" ? pool[0] : null;
  // seeded shuffle so the options do not move when the component re-renders
  let x = seed % 233280;
  const rnd = () => (x = (x * 9301 + 49297) % 233280) / 233280;
  const shuffled = pool.map((s) => ({ s, k: rnd() })).sort((a, b) => a.k - b.k).map((o) => o.s);
  if (wrongAux) shuffled.unshift(wrongAux);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of shuffled) {
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
  return persons(v).map((p) => {
    const pr = promptFor(v, tense, p);
    return { person: p, before: pr.before, form: pr.shown };
  });
}
