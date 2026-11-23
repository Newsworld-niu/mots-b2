/* Conjugation display and answer checking for the 变位 section. Tables come from public/atlas/conj.json
 * (scripts/build-conjugations.ts); compound tenses are built here from the auxiliary and the participle. */

import { TENSES, type CompoundTense, type ConjTense, type SimpleTense } from "./conj-schema";
export * from "./conj-schema";

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
  imper: "impératif présent",
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
  imper: "命令式",
};
/** Core 11 DELF B2 tenses enabled by default (including fa, condp, subjp, and ppres). */
export const B2_HIGH_FREQ_TENSES: ConjTense[] = ["pres", "pc", "imp", "fut", "cond", "subj", "pqp", "fa", "condp", "subjp", "ppres"];

/** Tenses unlocked by the learner's start level (0 = A1 … 3 = B2 and above). */
export function tensesForLevel(level: number): ConjTense[] {
  if (level <= 0) return ["pres", "pc"];
  if (level === 1) return ["pres", "pc", "imp", "fut", "imper"];
  if (level === 2) return ["pres", "pc", "imp", "fut", "cond", "subj", "pqp", "imper"];
  return [...B2_HIGH_FREQ_TENSES];
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

/** Words and verbs whose initial h is aspirated (h aspiré): no elision or liaison (je hais, le héros, au hasard). */
export const H_ASPIRE: ReadonlySet<string> = new Set([
  "haïr", "hais", "hait", "haïssons", "haïssez", "haïssent", "haï", "haine", "haineux", "haineuse",
  "hurler", "hurle", "hurles", "hurlent", "hurlement",
  "hausser", "hausse", "hausses", "haussent", "haut", "haute", "hauts", "hautes", "hauteur", "hauteurs", "hautain",
  "heurter", "heurte", "heurtes", "heurtent", "heurt", "heurts",
  "hacher", "hache", "haches", "hachent",
  "harceler", "harcèle", "harcèles", "harcèlent", "harcèlement",
  "hâter", "hâte", "hâtes", "hâtent", "hâtif", "hâtive",
  "hanter", "hante", "hantes", "hantent", "hantise",
  "hasarder", "hasarde", "hasard", "hasards", "hasardeux", "hasardeuse",
  "hisser", "hisse", "hisses", "hissent",
  "huer", "hue", "hues", "huent", "huée", "huées",
  "hocher", "hoche", "hoches", "hochent",
  "hennir", "hennit", "hennissement",
  "harasser", "harasse", "harassé", "harassée",
  "harponner", "harponne", "harpon",
  "haleter", "halète", "haletant",
  "hérisser", "hérisse", "hérisson",
  "héros", "héron", "héraut",
  "honte", "honteux", "honteuse", "hors",
  "handicap", "handicaps", "handicaper", "handicapé", "handicapée", "handicapés", "handicapées",
  "hardi", "hardie", "haricot", "haricots", "harpe", "haie", "haies",
  "hall", "halls", "halte", "hamac", "hamburger", "hameau", "hanche", "hangar", "hareng",
  "hibou", "hiboux", "hideux", "hideuse", "hiérarchie", "hiérarchies", "hiérarchique", "hiérarchiques",
  "hollandais", "hollandaise", "hollande", "hongrie", "hongrois", "hongroise",
  "homard", "hooligan", "hoquet", "horde", "houle", "housse", "hublot",
  "huit", "huitième", "hutte",
]);

const H_ASPIRE_STEM_RE = /^(?:haïss|hurl|hauss|heurt|hach|harcel|harcèl|hât|hasard|hiss|harass|harponn|halet|halèt|hériss|handicap|hiérarch)/i;

/** True when `word` (or its `lemma`) begins with a French aspirated h (blocking elision: le héros, se heurter, que huit). */
export function isAspiratedH(word: string, lemma?: string): boolean {
  const clean = word.normalize("NFC").trim().toLowerCase().replace(/^[^a-zà-ÿœæ]+/i, "").split(/[\s'-]/)[0] ?? "";
  if (!/^h/i.test(clean)) return false;
  if (lemma && H_ASPIRE.has(lemma.normalize("NFC").trim().toLowerCase())) return true;
  if (H_ASPIRE.has(clean)) return true;
  return H_ASPIRE_STEM_RE.test(clean);
}

/** True when `word` begins with a French vowel or mute h (triggers elision: j'aime, l'heure, s'habiller). */
export function startsWithFrenchVowel(word: string, lemma?: string): boolean {
  const clean = word.normalize("NFC").trim().replace(/^[^a-zA-ZÀ-ÿŒœÆæ]+/, "");
  if (!clean) return false;
  if (/^[aeiouyàâäéèêëîïôöûùüœæ]/i.test(clean)) return true;
  return /^h/i.test(clean) && !isAspiratedH(clean, lemma);
}

const startsWithVowel = (word: string, inf: string) => startsWithFrenchVowel(word, inf);

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

const IMPER_PERSONS = [1, 3, 4] as const;
const IMPER_SUBJECT: Record<number, string> = { 1: "(tu)", 3: "(nous)", 4: "(vous)" };
const IMPER_IRREG: Record<string, Record<number, string>> = {
  être: { 1: "sois", 3: "soyons", 4: "soyez" },
  avoir: { 1: "aie", 3: "ayons", 4: "ayez" },
  savoir: { 1: "sache", 3: "sachons", 4: "sachez" },
  vouloir: { 1: "veuille", 3: "veuillons", 4: "veuillez" },
};
const IMPER_DEFECTIVE = new Set(["falloir", "pleuvoir", "pouvoir", "devoir"]);

/** Derive French impératif présent (tu / nous / vous) from présent or irregular stems. */
export function imperatifForm(v: ConjVerb, person: number): string | null {
  if (v.imp || IMPER_DEFECTIVE.has(v.i)) return null;
  if (person !== 1 && person !== 3 && person !== 4) return null;
  let base = IMPER_IRREG[v.i]?.[person] ?? "";
  if (!base) {
    if (v.i === "aller" && person === 1) base = "va";
    else {
      const pres = v.f.pres?.[person];
      if (!pres) return null;
      // In -er verbs (and ouvrir/offrir/souffrir/couvrir/cueillir), 2sg drops trailing -s.
      base = person === 1 && pres.endsWith("es") ? pres.slice(0, -1) : pres;
    }
  }
  if (!base) return null;
  if (!v.p) return base;
  return base + (person === 1 ? "-toi" : person === 3 ? "-nous" : "-vous");
}

/** Valid person indices for one verb & tense (`ppres` uses slot 0; `imper` uses tu/nous/vous [1,3,4]). */
export function personsFor(v: ConjVerb, tense: ConjTense): number[] {
  if (tense === "ppres") return participePresentForm(v) ? [0] : [];
  if (tense === "imper") return IMPER_PERSONS.filter((p) => imperatifForm(v, p) !== null);
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
  let words: string[];
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
  if (tense === "imper") {
    const form = imperatifForm(v, person) ?? "";
    const before = IMPER_SUBJECT[person] ?? "";
    return { before, shown: form, accepted: form ? [norm(form)] : [] };
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

export const norm = (s: string) =>
  s
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/[’‘'`\u02bc]/g, "'")
    .replace(/\s+/g, " ");
const fold = (s: string) =>
  norm(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae");

/** Contrastive French diacritic homophone pairs where missing/wrong accents change POS, lemma, or tense. */
const CONTRASTIVE_HOMOPHONES: ReadonlyMap<string, string> = new Map([
  ["a|à", "à（介词）与 a（动词 avoir 变位）词性与语法功能不同。"],
  ["ou|où", "où（关系代词/疑问副词“哪里/……之时”）与 ou（连词“或者”）语法功能不同。"],
  ["du|dû", "dû（devoir 阳性单数过去分词）与 du（缩合/部分冠词 de + le）语法功能不同。"],
  ["des|dès", "dès（介词“自……起/一……就”）与 des（不定冠词复数/缩合冠词）语法功能不同。"],
  ["de|dé", "dé（名词“骰子/顶针”）与 de（介词）词义与发音不同。"],
  ["des|dés", "dés（名词复数）与 des（冠词）词义与发音不同。"],
  ["sur|sûr", "sûr（形容词“确定的/可靠的”）与 sur（介词“在……上”）词性与词义不同。"],
  ["sure|sûre", "sûre（形容词“确定的/安全的”）与 sure（形容词“酸的”）词义不同。"],
  ["surs|sûrs", "sûrs（形容词“确定的”）与 surs（形容词“酸的”）词义不同。"],
  ["sures|sûres", "sûres（形容词“确定的”）与 sures（形容词“酸的”）词义不同。"],
  ["mur|mûr", "mûr（形容词“成熟的”）与 mur（名词“墙”）词性与词义不同。"],
  ["mure|mûre", "mûre（形容词“成熟的”/名词“黑莓”）与 mure（动词 murer 变位）不同。"],
  ["murs|mûrs", "mûrs（形容词“成熟的”）与 murs（名词“墙”）词性与词义不同。"],
  ["mures|mûres", "mûres（形容词“成熟的”）与 mures（动词 murer 变位）不同。"],
  ["croit|croît", "croît（croître“增长”变位）须带 ^ 以区分 croit（croire“相信”变位）。"],
  ["crois|croîs", "croîs（croître“增长”变位）须带 ^ 以区分 crois（croire“相信”变位）。"],
  ["cru|crû", "crû（croître“增长”过去分词）须带 ^ 以区分 cru（croire“相信”过去分词）。"],
  ["tache|tâche", "tâche（任务/职责）与 tache（污渍）词义不同。"],
  ["taches|tâches", "tâches（任务/职责）与 taches（污渍）词义不同。"],
  ["la|là", "là（地点/强调副词）与 la（阴性定冠词/宾语代词）语法功能不同。"],
  ["ca|ça", "在 a 前必须写软音符 ç（ça = cela），漏写写成 ca 会改变发音。"],
  ["ça|çà", "çà（副词，如 çà et là）与 ça（指示代词 cela）用法不同。"],
  ["jeune|jeûne", "jeûne（斋戒/禁食）与 jeune（年轻的/青年）词义不同。"],
  ["jeunes|jeûnes", "jeûnes（斋戒/禁食）与 jeunes（年轻的/青年）词义不同。"],
  ["pecher|pêcher", "pêcher（捕鱼/钓鱼）与 pécher/pecher 词义与发音不同。"],
  ["pécher|pêcher", "pêcher（捕鱼/钓鱼）与 pécher（犯错/犯罪）词义不同。"],
  ["pecheur|pêcheur", "pêcheur（渔夫）与 pécheur（罪人）词义不同。"],
  ["pécheur|pêcheur", "pêcheur（渔夫）与 pécheur（罪人）词义不同。"],
  ["cote|côte", "côte（海岸/山坡）与 cote（评级/报价）词义与发音不同。"],
  ["cotes|côtes", "côtes（海岸/山坡）与 cotes（评级/报价）词义与发音不同。"],
  ["pate|pâte", "pâte（面团/意面）与 pate 词义与发音不同。"],
  ["pates|pâtes", "pâtes（意面/面团）与 pates 词义与发音不同。"],
]);

const CONTRASTIVE_CIRCUMFLEX_WORDS = new Set([
  "dû", "du", "mû", "crû", "cru", "crûs", "crus", "crûe", "crue", "crûes", "crues",
  "sûr", "sur", "sûre", "sure", "sûrs", "surs", "sûres", "sures",
  "mûr", "mur", "mûre", "mure", "mûrs", "murs", "mûres", "mures",
  "croîs", "crois", "croît", "croit", "jeûne", "jeune", "jeûnes", "jeunes",
]);

function orthographyTokens(s: string): string[] {
  return norm(s).match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]+/gu) ?? [];
}

/** Canonicalize official 1990 French orthography variants (é/è before mute-e syllable; non-contrastive î/û). */
function canon1990Word(w: string): string {
  if (CONTRASTIVE_CIRCUMFLEX_WORDS.has(w)) return w;
  let out = w.replace(/[éè](?=(?:ch|ph|th|gn|[bcdfgptv][lr]|[bcdfghjklmnpqrstvwxz])e[a-zà-ÿœ]+)/g, "è");
  // Exclude literary passé simple / subjonctif imparfait endings (-îmes, -îtes, -ûmes, -ûtes, -ît except -aît, -ût)
  if (!/(?:îmes|îtes|ûmes|ûtes|(?<!a)ît|ût)$/.test(out)) {
    out = out.replace(/î/g, "i").replace(/û/g, "u");
  }
  return out;
}

/** True when `typed` and `expected` differ ONLY by official 1990 Rectifications Orthographiques variants. */
export function are1990OrthographyVariants(typed: string, expected: string): boolean {
  const ta = orthographyTokens(typed);
  const eb = orthographyTokens(expected);
  if (ta.length !== eb.length || ta.length === 0) return false;
  for (let i = 0; i < ta.length; i++) {
    const tw = ta[i];
    const ew = eb[i];
    if (tw === ew) continue;
    if (fold(tw) !== fold(ew)) return false;
    if (explainWordOrthographyError(tw, ew) !== null) return false;
    if (canon1990Word(tw) !== canon1990Word(ew)) return false;
  }
  return true;
}

function hasCedillaMismatchBeforeBackVowel(tw: string, ew: string): boolean {
  const tNfc = tw.normalize("NFC");
  const eNfc = ew.normalize("NFC");
  // Compare aligned characters when base letters match: c vs ç before a/o/u changes /k/ <-> /s/
  const stripMarks = (ch: string) => ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (tNfc.length === eNfc.length) {
    for (let i = 0; i < eNfc.length; i++) {
      const tc = tNfc[i];
      const ec = eNfc[i];
      if (tc === ec) continue;
      if ((tc === "c" && ec === "ç") || (tc === "ç" && ec === "c")) {
        const nextBase = stripMarks(eNfc[i + 1] ?? "");
        if (/^[aou]$/i.test(nextBase)) return true;
        if (tc === "ç" && /^[eiy]$/i.test(nextBase)) return true;
      }
    }
  }
  return (
    (/ç[aàâäoôöuùûü]/i.test(eNfc) && !/ç[aàâäoôöuùûü]/i.test(tNfc) && /c[aàâäoôöuùûü]/i.test(tNfc)) ||
    (/ç[aàâäoôöuùûü]/i.test(tNfc) && !/ç[aàâäoôöuùûü]/i.test(eNfc) && /c[aàâäoôöuùûü]/i.test(eNfc)) ||
    /ç[eéèêëiîïy]/i.test(tNfc)
  );
}

function hasContrastiveFinalParticipleMismatch(tw: string, ew: string): boolean {
  const acuteRe = /é(e?s?)$/i;
  const plainRe = /(?:^|[^éèêë])e(e?s?)$/i;
  const tAcute = tw.match(acuteRe);
  const eAcute = ew.match(acuteRe);
  if (eAcute && !tAcute && plainRe.test(tw)) return true;
  if (tAcute && !eAcute && plainRe.test(ew)) return true;
  return false;
}

function explainWordOrthographyError(tw: string, ew: string): string | null {
  if (tw === ew || fold(tw) !== fold(ew)) return null;
  const pairKey = [tw, ew].sort().join("|");
  const homophoneWhy = CONTRASTIVE_HOMOPHONES.get(pairKey);
  if (homophoneWhy) return homophoneWhy;
  if (hasCedillaMismatchBeforeBackVowel(tw, ew)) {
    return `在 a / o / u 前必须写软音符 ç 才发 /s/ 音，写成 c 会变成 /k/ 音（「${tw}」≠「${ew}」）。`;
  }
  if (hasContrastiveFinalParticipleMismatch(tw, ew)) {
    return `词尾 -é(e)(s) 与 -e(s) 区分过去分词/名词与变位词尾及发音（/e/ ≠ 哑音 e，「${tw}」≠「${ew}」）。`;
  }
  return null;
}

/**
 * Return a Chinese morphosyntactic/phonological diagnostic when a diacritic or cedilla mismatch
 * between `typed` and `expected` changes French grammar, POS, or consonant/vowel phonology;
 * return `null` when there is no contrastive diacritic/cedilla error.
 */
export function explainOrthographyError(typed: string, expected: string | readonly string[]): string | null {
  const a = norm(typed);
  if (!a) return null;
  const list = typeof expected === "string" ? [expected] : expected;
  const ta = orthographyTokens(a);
  if (!ta.length) return null;

  let firstReason: string | null = null;
  for (const cand of list) {
    const b = norm(cand);
    if (!b) continue;
    if (a === b || are1990OrthographyVariants(a, b)) return null;
    if (fold(a) !== fold(b)) continue;
    const eb = orthographyTokens(b);
    if (ta.length !== eb.length) continue;
    let candReason: string | null = null;
    for (let i = 0; i < ta.length; i++) {
      const r = explainWordOrthographyError(ta[i], eb[i]);
      if (r) {
        candReason = r;
        break;
      }
    }
    // If at least one accepted variant has only a non-contrastive lexical accent difference, it's not a morphosyntax error.
    if (candReason === null) return null;
    if (firstReason === null) firstReason = candReason;
  }
  return firstReason;
}

/** "right" (exact or 1990 variant), "accent" (pure lexical accent slip), or "wrong" (including contrastive diacritics/cedillas). */
export function checkAnswer(input: string, accepted: string[]): "right" | "accent" | "wrong" {
  const a = norm(input);
  if (!a) return "wrong";
  if (accepted.some((x) => norm(x) === a || are1990OrthographyVariants(a, x))) return "right";
  const foldMatches = accepted.filter((x) => fold(x) === fold(a));
  if (foldMatches.length > 0 && explainOrthographyError(a, foldMatches) === null) return "accent";
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
  } else if (tense === "imper") {
    const pres = v.f.pres?.[person];
    if (pres) traps.push(v.p ? `${pres}${person === 1 ? "-toi" : person === 3 ? "-nous" : "-vous"}` : pres);
    const subj = v.f.subj?.[person];
    if (subj) traps.push(subj);
    if (person === 1 && v.p && v.f.pres?.[1]) traps.push(`te ${v.f.pres[1]}`);
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
