/* Grammar points and their drills → public/atlas/grammar.json
 *
 *   data/grammar/points.json   explanations (written for this site, 待核对)
 *   data/grammar/drills.json   hand-written drills for points that rules cannot find (待核对)
 *   data/lexicon.json          example sentences of every entry (and their Chinese)
 *   data/highlights.json       where each entry's headword sits in its examples
 *   public/atlas/conj.json     checked conjugation tables (npm run lexicon:conj)
 *   data/nouns.json, data/forms.json  noun genders, irregular adjective forms
 *
 * Drills are found in the atlas's own sentences by rules, never invented: a blank is made only where the
 * answer is certain from the sentence (one tense and one person for a verb form, the gender of a known noun,
 * a contraction that is spelled out). Distractors are other real forms of the same word. Points without
 * enough sentences get template drills (city and country prepositions).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Drill, GrammarData, GrammarPoint, OrderDrill } from "../src/lib/grammar.ts";

const ROOT = resolve(import.meta.dirname, "..");
const read = (p: string) => JSON.parse(readFileSync(resolve(ROOT, p), "utf8"));

interface LexEntry {
  id: string;
  lemma: string;
  pos: string;
  examples?: { fr: string; zh: string }[];
}
interface Verb {
  i: string;
  p?: 1;
  a: "a" | "e" | "ae";
  pp: string;
  f: Record<string, string[]>;
}

const points: Omit<GrammarPoint, "drills">[] = read("data/grammar/points.json").points;
const lexicon: LexEntry[] = read("data/lexicon.json").entries;
const highlights: Record<string, ([number, number] | null)[]> = read("data/highlights.json").entries;
const verbs: Record<string, Verb> = read("public/atlas/conj.json").verbs;
const nouns: Record<string, { g: string }> = read("data/nouns.json").entries;
const forms: Record<string, { fem?: string; pl?: string }> = read("data/forms.json").entries;

const MAX_DRILLS = 300;
const MAX_SENTENCE = 130;
/** At most this many drills per source word (and per verb or noun asked), so a point is not all one word. */
const PER_WORD = 3;

/* ---------- sentences and tokens ---------- */

interface Sentence {
  fr: string;
  zh: string;
  w: string;
  /** Owner entry's headword span (when known). */
  hl?: [number, number] | null;
  pos: string;
  lemma: string;
}
const sentences: Sentence[] = [];
for (const e of lexicon)
  (e.examples ?? []).forEach((x, i) => {
    if (!x.fr || x.fr.length > MAX_SENTENCE || !x.zh) return;
    // headings scanned with the example (DANS UN GRAND SUPERMARCHÉ, LA CONTINUITÉ Le village …)
    if (/\p{Lu}{2,}\s+\p{Lu}{2,}|^\p{Lu}{3,}/u.test(x.fr)) return;
    sentences.push({ fr: x.fr, zh: x.zh, w: e.id, hl: highlights[e.id]?.[i], pos: e.pos, lemma: e.lemma });
  });

interface Tok {
  t: string;
  low: string;
  s: number;
  e: number;
}
/** Words with their offsets; an elided word (l', n', qu') is its own token. */
function tokens(s: string): Tok[] {
  const out: Tok[] = [];
  for (const m of s.matchAll(/\p{L}+(?:-\p{L}+)*['’]?/gu)) out.push({ t: m[0], low: m[0].toLowerCase().replace("’", "'"), s: m.index!, e: m.index! + m[0].length });
  return out;
}
/** Two tokens separated by one space only (a blank over both stays one piece of text). */
const adjacent = (a: Tok, b: Tok, s: string) => s.slice(a.e, b.s) === " ";
const capital = (opt: string, like: string) => (/^\p{Lu}/u.test(like) ? opt.charAt(0).toUpperCase() + opt.slice(1) : opt);

/* ---------- drill collection ---------- */

const collected = new Map<string, { drills: Drill[]; per: Map<string, number>; seen: Set<string> }>();
for (const p of points) collected.set(p.id, { drills: [], per: new Map(), seen: new Set() });

function add(point: string, d: Drill, ...keys: string[]) {
  const c = collected.get(point)!;
  const sig = `${d.s}|${d.k === "c" ? d.b.join(",") : ""}`;
  if (c.seen.has(sig)) return;
  if (keys.some((k) => (c.per.get(k) ?? 0) >= PER_WORD)) return;
  if (d.k === "c") {
    const answer = d.s.slice(d.b[0], d.b[1]);
    const opts = new Set(d.o.map((o) => o.toLowerCase()));
    if (!d.o.includes(answer) || opts.size !== d.o.length || d.o.length < 2) throw new Error(`bad drill in ${point}: ${JSON.stringify(d)}`);
  }
  c.seen.add(sig);
  keys.forEach((k) => c.per.set(k, (c.per.get(k) ?? 0) + 1));
  c.drills.push(d);
}

const uniq = <T,>(xs: T[]) => [...new Set(xs)];

/** je before a consonant, j' before a vowel or mute h: "j'ai raté", "je suis parti". */
const withJe = (form: string, like: string) => {
  const je = /^[aeiouyéèêâîôûh]/i.test(form) ? "j'" : "je ";
  return (/^J/.test(like) ? je.toUpperCase().slice(0, 1) + je.slice(1) : je) + form;
};
/**
 * When the verb follows je / j' directly, the blank takes the subject too, so that every option is spelled
 * right (j'irai / je vais) and the elision does not give the answer away.
 */
function blankWithSubject(toks: Tok[], i: number, s: string): Tok | null {
  const prev = toks[i - 1];
  if (!prev || !(prev.low === "j'" || prev.low === "je")) return null;
  return prev.low === "j'" ? (prev.e === toks[i].s ? prev : null) : adjacent(prev, toks[i], s) ? prev : null;
}

/* ---------- verbs: present, imparfait, futur, conditionnel, subjonctif ---------- */

const PERSON_OF: Record<string, number[]> = { je: [0], "j'": [0], tu: [1], il: [2], elle: [2], on: [2], ce: [2], "c'": [2], nous: [3], vous: [4], ils: [5], elles: [5] };
const DETERMINERS = new Set(["le", "la", "les", "l'", "un", "une", "des", "du", "de", "d'", "au", "aux", "ce", "cet", "cette", "ces", "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "notre", "nos", "votre", "vos", "leur", "leurs", "quel", "quelle", "quels", "quelles", "que", "qu'", "à", "en", "par", "pour", "sans", "avec", "et", "ou"]);
const CLITICS = new Set(["ne", "n'", "me", "m'", "te", "t'", "se", "s'", "le", "la", "les", "l'", "lui", "leur", "y", "en", "nous", "vous"]);
const TENSE_POINT: Record<string, string> = { pres: "present", imp: "imparfait", fut: "futur", cond: "conditionnel", subj: "subjonctif" };
const TENSE_ZH: Record<string, string> = { pres: "现在时", imp: "未完成过去时", fut: "简单将来时", cond: "条件式现在时", subj: "虚拟式现在时" };
/**
 * Distractors: the same person in other tenses that cannot be right in the sentence's place, then other
 * persons of the same tense. The présent is asked against other persons only (a futur or imparfait can often
 * be right too: je reviens / je reviendrai demain), and is never a distractor for the futur.
 */
const DISTRACT: Record<string, string[]> = { pres: [], imp: ["cond", "fut"], fut: ["cond", "imp"], cond: ["fut", "imp"], subj: ["fut", "imp"] };
const PERSON_ZH = ["je", "tu", "il / elle", "nous", "vous", "ils / elles"];

/** form → every (verb, tense, person) it can be. */
const analyses = new Map<string, { v: string; t: string; p: number }[]>();
for (const [v, verb] of Object.entries(verbs))
  for (const [t, list] of Object.entries(verb.f))
    list.forEach((f, p) => {
      if (!f) return;
      const k = f.toLowerCase();
      analyses.set(k, [...(analyses.get(k) ?? []), { v, t, p }]);
    });

/** The subject pronoun before a verb (only clitics in between): its persons, or null. */
function subjectBefore(toks: Tok[], i: number): number[] | null {
  for (let j = i - 1, steps = 0; j >= 0 && steps < 4; j--, steps++) {
    const w = toks[j].low;
    if (PERSON_OF[w] && !(w === "nous" || w === "vous") ) return PERSON_OF[w];
    if (w === "nous" || w === "vous") {
      // "nous" right before a verb is the subject unless another subject comes before it (il nous parle)
      const before = j > 0 ? toks[j - 1].low : "";
      if (PERSON_OF[before] && before !== "nous" && before !== "vous") return PERSON_OF[before];
      return PERSON_OF[w];
    }
    if (!CLITICS.has(w)) return null;
  }
  return null;
}

const AUX: Record<string, { aux: "a" | "e"; p: number }> = {};
verbs.avoir.f.pres.forEach((f, p) => (AUX[f] = { aux: "a", p }));
verbs.etre.f.pres.forEach((f, p) => (AUX[f] = { aux: "e", p }));
// past participle forms (with agreement endings) → verbs
const ppIndex = new Map<string, string[]>();
for (const [v, verb] of Object.entries(verbs))
  for (const f of uniq([verb.pp, verb.pp + "e", verb.pp.endsWith("s") ? verb.pp : verb.pp + "s", verb.pp + "es"])) ppIndex.set(f, uniq([...(ppIndex.get(f) ?? []), v]));

for (const sen of sentences) {
  const toks = tokens(sen.fr);
  toks.forEach((tok, i) => {
    if (tok.t.includes("-")) return; // inverted questions (vas-tu)
    const next = toks[i + 1];
    // a présent form of avoir / être followed by a participle belongs to a passé composé
    if (AUX[tok.low] && next && ppIndex.has(next.low)) return;
    const all = analyses.get(tok.low);
    if (!all) return;
    let persons = subjectBefore(toks, i);
    // ce is a subject only before être (c'est, ce sera); before a noun it is a determiner (ce produit)
    if (persons && ["ce", "c'"].includes(toks[i - 1]?.low ?? "") && !all.some((a) => a.v === "etre")) return;
    // no subject pronoun: a noun subject (third person) is assumed only for tenses whose endings tell it
    if (!persons) {
      const prev = toks[i - 1]?.low ?? "";
      const third = uniq(all.filter((a) => (a.p === 2 || a.p === 5) && a.t !== "pres" && a.t !== "subj").map((a) => a.p));
      if (third.length !== 1 || !prev || CLITICS.has(prev) || DETERMINERS.has(prev) || /^\p{Lu}/u.test(tok.t)) return;
      persons = third;
    }
    const subj = persons;
    const fit = all.filter((a) => subj.includes(a.p));
    const vs = uniq(fit.map((a) => a.v));
    const ts = uniq(fit.map((a) => a.t));
    if (vs.length !== 1 || ts.length !== 1) return;
    const { v, t, p } = fit[0];
    const verb = verbs[v];
    const inf = (verb.p ? (/^[aeiouéèêh]/.test(verb.i) ? "s'" : "se ") : "") + verb.i;
    const others = [p ^ 1, (p + 3) % 6, (p + 2) % 6, (p + 4) % 6].map((q) => verb.f[t]?.[q]);
    const forms4 = uniq([tok.low, ...DISTRACT[t].map((x) => verb.f[x]?.[p]), ...others].filter((x): x is string => !!x)).slice(0, 4);
    if (forms4.length < 3) return;
    // the présent keeps the subject outside the blank: its options are other persons (je … vais / allons / vont)
    const je = t === "pres" ? null : blankWithSubject(toks, i, sen.fr);
    if (!je && toks[i - 1]?.low.endsWith("'") && toks[i - 1].e === tok.s && !["s'", "m'", "t'", "n'", "l'", "c'"].includes(toks[i - 1].low)) return;
    // after an elided pronoun (s', m', n', l') every option must start with a vowel too
    if (!je && toks[i - 1]?.e === tok.s && forms4.some((f) => !/^[aeiouyéèêâîôûh]/.test(f))) return;
    const options = je ? forms4.map((f) => withJe(f, je.t)) : forms4.map((o) => capital(o, tok.t));
    add(
      TENSE_POINT[t],
      { k: "c", s: sen.fr, z: sen.zh, b: [je ? je.s : tok.s, tok.e], o: options, h: `${inf} · ${TENSE_ZH[t]}`, y: `主语是 ${PERSON_ZH[p]}，${inf} 的${TENSE_ZH[t]}：${tok.low}`, w: sen.w },
      sen.w,
      v,
    );
  });
}

/* ---------- passé composé: auxiliary and agreement ---------- */

for (const sen of sentences) {
  const toks = tokens(sen.fr);
  toks.forEach((tok, i) => {
    const aux = AUX[tok.low];
    const next = toks[i + 1];
    if (!aux || !next || !adjacent(tok, next, sen.fr)) return;
    // être + a verb conjugated with avoir is a passive or an adjective (il est fatigué): not a passé composé
    const cands = (ppIndex.get(next.low) ?? []).filter((v) => {
      const verb = verbs[v];
      return aux.aux === "a" ? verb.a !== "e" && !verb.p : verb.a === "e" || verb.a === "ae" || !!verb.p;
    });
    if (cands.length !== 1) return;
    const v = cands[0];
    const verb = verbs[v];
    // reflexive verbs need their pronoun before the auxiliary
    if (verb.p && !(i > 0 && ["me", "m'", "te", "t'", "se", "s'", "nous", "vous"].includes(toks[i - 1].low))) return;
    if (!verb.p && aux.aux === "e" && i > 0 && ["se", "s'"].includes(toks[i - 1].low)) return;
    const p = aux.p;
    const inf = (verb.p ? "se " : "") + verb.i;
    const answer = `${tok.low} ${next.low}`;
    const other = aux.aux === "a" ? verbs.etre.f.pres[p] : verbs.avoir.f.pres[p];
    const agree = aux.aux === "e" ? uniq([verb.pp, verb.pp + "e", verb.pp.endsWith("s") ? verb.pp : verb.pp + "s", verb.pp + "es"]).filter((f) => f !== next.low) : [];
    const plain = uniq([answer, `${other} ${verb.pp}`, ...agree.slice(0, 2).map((f) => `${tok.low} ${f}`), verb.f.imp?.[p] ?? ""])
      .filter(Boolean)
      .slice(0, 4);
    if (plain.length < 3) return;
    const je = blankWithSubject(toks, i, sen.fr);
    // after s', m', t', n' the options would not fit the elision: skip
    if (!je && toks[i - 1]?.e === tok.s) return;
    const options = je ? plain.map((o) => withJe(o, je.t)) : plain.map((o) => capital(o, tok.t));
    const start = je ? je.s : tok.s;
    const why =
      aux.aux === "e"
        ? `${inf} 用 être 作助动词，过去分词和主语配合：${next.low}`
        : `${inf} 用 avoir 作助动词，过去分词不和主语配合：${next.low}`;
    add("passe-compose", { k: "c", s: sen.fr, z: sen.zh, b: [start, next.e], o: options, h: `${inf} · 复合过去时`, y: why, w: sen.w }, sen.w, v);
  });
}

/* ---------- nouns: un / une, le / la ---------- */

const nounGender = new Map<string, "m" | "f" | "x">();
for (const e of lexicon) {
  const g = nouns[e.id]?.g;
  if (!/^n\./.test(e.pos) || (g !== "m" && g !== "f") || /[\s(]/.test(e.lemma)) continue;
  const k = e.lemma.toLowerCase();
  const had = nounGender.get(k);
  nounGender.set(k, had && had !== g ? "x" : g);
}
const SUBJECTS = new Set([...Object.keys(PERSON_OF), "ne", "n'", "me", "m'", "te", "t'", "se", "s'"]);
for (const sen of sentences) {
  const toks = tokens(sen.fr);
  toks.forEach((tok, i) => {
    const next = toks[i + 1];
    if (!next || !["un", "une", "le", "la"].includes(tok.low) || !adjacent(tok, next, sen.fr)) return;
    // la / le right after a pronoun is an object pronoun (je la vois)
    if (i > 0 && SUBJECTS.has(toks[i - 1].low)) return;
    const g = nounGender.get(next.low);
    if (g !== "m" && g !== "f") return;
    const def = tok.low === "le" || tok.low === "la";
    const want = def ? (g === "m" ? "le" : "la") : g === "m" ? "un" : "une";
    if (want !== tok.low) return; // the sentence disagrees with the noun list: skip it
    const options = (def ? ["le", "la"] : ["un", "une"]).map((o) => capital(o, tok.t));
    add("art-gender", { k: "c", s: sen.fr, z: sen.zh, b: [tok.s, tok.e], o: options, h: `${next.low} 的冠词`, y: `${next.low} 是${g === "m" ? "阳" : "阴"}性名词 → ${want}`, w: sen.w }, sen.w, next.low);
  });
}

/* ---------- contractions: au, aux, du, à la, de la ---------- */

const CONTRACT: Record<string, { set: string[]; why: string }> = {
  au: { set: ["au", "à la", "à l'", "aux"], why: "à + le → au（后面是阳性单数名词）" },
  aux: { set: ["au", "à la", "à l'", "aux"], why: "à + les → aux（后面是复数名词）" },
  "à la": { set: ["au", "à la", "à l'", "aux"], why: "à + la 不缩合（后面是阴性单数名词）" },
  du: { set: ["du", "de la", "de l'", "des"], why: "de + le → du（后面是阳性单数名词）" },
  "de la": { set: ["du", "de la", "de l'", "des"], why: "de + la 不缩合（后面是阴性单数名词）" },
};
for (const sen of sentences) {
  const toks = tokens(sen.fr);
  toks.forEach((tok, i) => {
    let key = tok.low;
    let end = tok.e;
    const next = toks[i + 1];
    if ((tok.low === "à" || tok.low === "de") && next?.low === "la" && adjacent(tok, next, sen.fr)) {
      key = `${tok.low} la`;
      end = next.e;
    }
    const c = CONTRACT[key];
    const after = toks[key.includes(" ") ? i + 2 : i + 1];
    if (!c || !after || /^[aeiouéèêâîôûh]/i.test(after.low)) return;
    // the noun's gender must agree with the contraction when the noun is known
    const g = nounGender.get(after.low);
    if ((key === "au" || key === "du") && g === "f") return;
    if (key.endsWith("la") && g === "m") return;
    // "de la" after a verb of saying etc. is still de + la: fine; skip "la" as a pronoun (de la voir)
    if (key.endsWith("la") && analyses.has(after.low)) return;
    add("contraction", { k: "c", s: sen.fr, z: sen.zh, b: [tok.s, end], o: c.set.map((o) => capital(o, tok.t)), h: key.startsWith("à") || key.startsWith("au") ? "à + 定冠词" : "de + 定冠词", y: c.why, w: sen.w }, sen.w, `${key}:${after.low}`);
  });
}

/* ---------- adjectives: agreement ---------- */

const fold = (x: string) => x.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
/** [masc. sing., fem. sing., masc. plural, fem. plural] (regular rules unless data/forms.json says otherwise). */
function adjForms(lemma: string): string[] {
  const l = lemma.toLowerCase();
  const fem = forms[fold(l)]?.fem ?? (l.endsWith("e") ? l : l + "e");
  const mpl = /[sx]$/.test(l) ? l : l.endsWith("al") ? l.slice(0, -2) + "aux" : l.endsWith("eau") ? l + "x" : l + "s";
  const fpl = fem.endsWith("s") ? fem : fem + "s";
  return [l, fem, mpl, fpl];
}
const SLOT = ["阳性单数", "阴性单数", "阳性复数", "阴性复数"];
for (const sen of sentences) {
  if (sen.pos !== "adj." || !sen.hl || /\s/.test(sen.lemma)) continue;
  // with je / tu / nous / vous the gender of the person is unknown: both forms could be right
  if (tokens(sen.fr).some((t) => ["je", "j'", "tu", "nous", "vous", "me", "m'", "te", "t'", "moi", "toi", "on"].includes(t.low))) continue;
  const form = sen.fr.slice(sen.hl[0], sen.hl[1]);
  if (/\s|-/.test(form)) continue;
  const named = adjForms(sen.lemma);
  const options = uniq(named);
  // the sentence's form must be one of the forms the rules give (else the adjective is irregular in a way we do not know)
  if (!options.includes(form.toLowerCase()) || options.length < 2) continue;
  const slot = named.map((x, j) => (x === form.toLowerCase() ? SLOT[j] : "")).filter(Boolean);
  add(
    "adj-agree",
    { k: "c", s: sen.fr, z: sen.zh, b: [sen.hl[0], sen.hl[1]], o: options.map((o) => capital(o, form)), h: `（${sen.lemma}）`, y: `这里要用${slot.join("或")}：${form.toLowerCase()}`, w: sen.w },
    sen.w,
  );
}

/* ---------- negation: word order ---------- */

const NEG = new Set(["pas", "jamais", "plus", "rien", "personne"]);
const LOWER_FIRST = new Set(["je", "j'", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles", "ce", "c'", "ça", "ne", "n'", "le", "la", "les", "l'", "un", "une", "mon", "ma", "mes", "ton", "ta", "ses", "son", "sa", "cette", "ce", "il"]);
for (const sen of sentences) {
  if (sen.fr.length > 70 || /[,;:«»"()]/.test(sen.fr)) continue;
  const toks = tokens(sen.fr);
  if (toks.length < 4 || toks.length > 9) continue;
  const lows = toks.map((t) => t.low);
  if (!lows.some((w) => w === "ne" || w === "n'") || !lows.some((w) => NEG.has(w))) continue;
  // the sentence is the tokens and spaces only, ending with one punctuation mark
  const rebuilt = toks.map((t, i) => (i > 0 && !toks[i - 1].t.endsWith("'") ? " " : "") + t.t).join("");
  // the final mark keeps its French space (« Attention ! »)
  const tail = sen.fr.slice(toks[toks.length - 1].e);
  if (rebuilt !== sen.fr.slice(0, toks[toks.length - 1].e) || !/^\s?[.!?]?$/.test(tail)) continue;
  const words = toks.map((t, i) => (i === 0 && LOWER_FIRST.has(t.low) ? t.low : t.t));
  const d: OrderDrill = { k: "o", s: sen.fr, z: sen.zh, t: words, p: tail, h: "排出正确的语序", y: "ne（n'）在变位动词前，pas / jamais / plus / rien 在变位动词后；复合时态夹住助动词。", w: sen.w };
  add("negation", d, sen.w);
}

/* ---------- city and country prepositions (templates) ---------- */

const PLACES: [string, string, "city" | "f" | "m" | "mv" | "pl"][] = [
  ["Paris", "巴黎", "city"], ["Lyon", "里昂", "city"], ["Marseille", "马赛", "city"], ["Londres", "伦敦", "city"], ["Tokyo", "东京", "city"], ["Pékin", "北京", "city"], ["Shanghai", "上海", "city"], ["Montréal", "蒙特利尔", "city"], ["Rome", "罗马", "city"], ["Berlin", "柏林", "city"], ["Amsterdam", "阿姆斯特丹", "city"], ["Athènes", "雅典", "city"],
  ["France", "法国", "f"], ["Chine", "中国", "f"], ["Italie", "意大利", "f"], ["Espagne", "西班牙", "f"], ["Allemagne", "德国", "f"], ["Belgique", "比利时", "f"], ["Suisse", "瑞士", "f"], ["Angleterre", "英格兰", "f"], ["Russie", "俄罗斯", "f"], ["Inde", "印度", "f"], ["Australie", "澳大利亚", "f"], ["Grèce", "希腊", "f"], ["Égypte", "埃及", "f"], ["Algérie", "阿尔及利亚", "f"], ["Corée", "韩国", "f"], ["Tunisie", "突尼斯", "f"],
  ["Japon", "日本", "m"], ["Canada", "加拿大", "m"], ["Brésil", "巴西", "m"], ["Portugal", "葡萄牙", "m"], ["Maroc", "摩洛哥", "m"], ["Mexique", "墨西哥", "m"], ["Sénégal", "塞内加尔", "m"], ["Danemark", "丹麦", "m"], ["Chili", "智利", "m"], ["Vietnam", "越南", "m"], ["Cambodge", "柬埔寨", "m"],
  ["Iran", "伊朗", "mv"], ["Irak", "伊拉克", "mv"],
  ["États-Unis", "美国", "pl"], ["Pays-Bas", "荷兰", "pl"], ["Philippines", "菲律宾", "pl"],
];
const vowel = (s: string) => /^[AEIOUÉÈÊ]/.test(s);
const IN: [string, string][] = [
  ["J'habite ___ {X}.", "我住在{Z}。"],
  ["Elle part ___ {X} demain.", "她明天去{Z}。"],
  ["Nous passons nos vacances ___ {X}.", "我们在{Z}度假。"],
  ["Il travaille ___ {X} depuis deux ans.", "他在{Z}工作两年了。"],
];
const FROM: [string, string][] = [
  ["Je viens ___ {X}.", "我来自{Z}。"],
  ["Elle rentre ___ {X} ce soir.", "她今晚从{Z}回来。"],
  ["Ils arrivent ___ {X} lundi.", "他们周一从{Z}到。"],
];
PLACES.forEach(([x, z, kind], n) => {
  const inAns = kind === "city" ? "à" : kind === "f" || kind === "mv" ? "en" : kind === "m" ? "au" : "aux";
  const fromAns = kind === "pl" ? "des" : kind === "m" ? "du" : vowel(x) ? "d'" : "de";
  const inWhy = { city: "城市前用 à", f: `${x} 是阴性国家 → en`, mv: `${x} 是元音开头的阳性国家 → en`, m: `${x} 是阳性国家 → au`, pl: `${x} 是复数 → aux` }[kind];
  const fromWhy = { city: "城市前用 de（元音前 d'）", f: `${x} 是阴性国家 → de（元音前 d'）`, mv: `${x} 是元音开头的阳性国家 → d'`, m: `${x} 是阳性国家 → du`, pl: `${x} 是复数 → des` }[kind];
  for (const [tpl, ztpl, ans, opts, why] of [
    [...IN[n % IN.length], inAns, ["à", "en", "au", "aux"], inWhy],
    [...FROM[n % FROM.length], fromAns, ["de", "d'", "du", "des"], fromWhy],
  ] as [string, string, string, string[], string][]) {
    const at = tpl.indexOf("___");
    const glue = ans.endsWith("'") ? "" : " ";
    const s = tpl.slice(0, at) + ans + glue + tpl.slice(at + 4).replace("{X}", x);
    add("place-prep", { k: "c", s, z: ztpl.replace("{Z}", z), b: [at, at + ans.length], o: opts, h: `${x}`, y: why });
  }
});

/* ---------- subjonctif and conditionnel (templates) ---------- */

const SUBJECTS_T: [string, string, number][] = [["tu", "你", 1], ["vous", "您", 4], ["il", "他", 2], ["nous", "我们", 3], ["elles", "她们", 5]];
const que = (s: string) => (/^[aeiouéh]/.test(s) ? "qu'" : "que ");
const ACTIONS: [string, string, string][] = [
  ["etre", "à l'heure", "准时"],
  ["avoir", "de la patience", "有耐心"],
  ["aller", "chez le médecin", "去看医生"],
  ["faire", "attention", "注意"],
  ["pouvoir", "venir demain", "明天能来"],
  ["savoir", "la vérité", "知道真相"],
  ["venir", "avec nous", "和我们一起来"],
  ["prendre", "le train de huit heures", "坐八点的火车"],
  ["finir", "ce travail ce soir", "今晚完成这项工作"],
  ["parler", "plus lentement", "说得慢一点"],
];
const TRIGGERS: [string, (s: string, v: string) => string][] = [
  ["Il faut ", (s, v) => `${s}必须${v}。`],
  ["Je voudrais ", (s, v) => `我希望${s}${v}。`],
  ["Il est important ", (s, v) => `${s}${v}很重要。`],
];
ACTIONS.forEach(([v, rest, vz], n) => {
  const verb = verbs[v];
  if (!verb) return;
  for (let k = 0; k < 2; k++) {
    const [subj, sz, p] = SUBJECTS_T[(n + k * 2) % SUBJECTS_T.length];
    const [trig, zh] = TRIGGERS[(n + k) % TRIGGERS.length];
    const ans = verb.f.subj[p];
    const head = `${trig}${que(subj)}${subj} `;
    const s = `${head}${ans} ${rest}.`;
    const options = uniq([ans, verb.f.pres[p], verb.f.fut[p], verb.f.imp[p]]).slice(0, 4);
    if (options.length < 3) continue;
    add("subjonctif", { k: "c", s, z: zh(sz, vz), b: [head.length, head.length + ans.length], o: options, h: `${verb.i} · 虚拟式现在时`, y: `${trig.trim()} que 后面用虚拟式：${ans}` }, `t:${v}`);
  }
});

const WISHES: [string, string, string][] = [
  ["voyager", "plus souvent", "更常旅行"],
  ["apprendre", "le piano", "学钢琴"],
  ["aller", "au cinéma", "去看电影"],
  ["faire", "du sport", "做运动"],
  ["lire", "davantage", "多读书"],
  ["sortir", "avec des amis", "和朋友出去"],
];
const SUBJ_ALL: [string, string, number][] = [["je", "我", 0], ["tu", "你", 1], ["il", "他", 2], ["nous", "我们", 3], ["vous", "你们", 4], ["ils", "他们", 5]];
WISHES.forEach(([v, rest, vz], n) => {
  const verb = verbs[v];
  if (!verb) return;
  for (let k = 0; k < 3; k++) {
    const [subj, sz, p] = SUBJ_ALL[(n + k * 2) % SUBJ_ALL.length];
    const had = verbs.avoir.f.imp[p];
    const si = subj === "il" || subj === "ils" ? "S'" : "Si ";
    const s1 = subj === "je" ? "j'" : `${subj} `;
    const head = `${si}${s1}${had} plus de temps, ${subj === "je" ? "je" : subj} `;
    const ans = verb.f.cond[p];
    const s = `${head}${ans} ${rest}.`;
    const options = uniq([ans, verb.f.fut[p], verb.f.imp[p], verb.f.pres[p]]).slice(0, 4);
    if (options.length < 3) continue;
    add("conditionnel", { k: "c", s, z: `如果${sz}有更多时间，${sz}会${vz}。`, b: [head.length, head.length + ans.length], o: options, h: `${verb.i} · 条件式现在时`, y: `si + 未完成过去时（${had}），主句用条件式：${ans}` }, `t:${v}`);
  }
});

/* ---------- hand-written drills (data/grammar/drills.json) ---------- */

/**
 * Points whose answer cannot be told from a sentence by rule (relative pronouns, reported speech, connectors …)
 * have drills written for this site: "s" marks the answer with [ ], "x" lists the distractors.
 */
interface Written {
  s: string;
  z: string;
  x: string[];
  y: string;
  h?: string;
}
const written: Record<string, Written[]> = read("data/grammar/drills.json").drills;
for (const [point, list] of Object.entries(written)) {
  if (!collected.has(point)) throw new Error(`drills.json: no grammar point "${point}"`);
  for (const w of list) {
    const m = /^([^[\]]*)\[([^[\]]+)\]([^[\]]*)$/.exec(w.s);
    if (!m || !w.z?.trim() || !w.y?.trim() || !Array.isArray(w.x) || !w.x.length) throw new Error(`drills.json: bad drill in ${point}: ${w.s}`);
    const [, before, answer, after] = m;
    add(point, { k: "c", s: before + answer + after, z: w.z, b: [before.length, before.length + answer.length], o: [answer, ...w.x], h: w.h ?? "", y: w.y });
  }
}

/* ---------- output ---------- */

/** Stable order: shorter sentences first, then a fixed shuffle so a point does not start with one word. */
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
const out: GrammarData = {
  v: 1,
  points: points.map((p) => {
    const drills = collected.get(p.id)!.drills;
    const picked = [...drills].sort((a, b) => (a.s.length > 90 ? 1 : 0) - (b.s.length > 90 ? 1 : 0) || hash(a.s) - hash(b.s)).slice(0, MAX_DRILLS);
    return { ...p, drills: picked };
  }),
};
mkdirSync(resolve(ROOT, "public/atlas"), { recursive: true });
writeFileSync(resolve(ROOT, "public/atlas/grammar.json"), JSON.stringify(out));
for (const p of out.points) console.log(`${p.id.padEnd(14)} ${String(collected.get(p.id)!.drills.length).padStart(5)} found, ${p.drills.length} kept`);
