/* Conjugate every verb of the lexicon and check each form against Lexique 3.83.
 *
 *   data/conjugations.json               per verb: model, check status, mismatches (review)
 *   data/gaps/conjugation-mismatches.csv  every generated form that disagrees with Lexique
 *   public/atlas/conj.json                tables of the verbs that pass, loaded by the 变位 section
 *
 * Status
 *   verified    5 or more forms attested in Lexique, all equal to ours
 *   partial     1–4 forms attested, all equal
 *   unattested  Lexique has no form of this verb (mostly OCR-damaged headwords): not taught
 *   mismatch    at least one attested form differs: not taught until the model is fixed
 *   unsupported the headword is not something the engine conjugates (OCR noise, rare model)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { resolve } from "node:path";
import { conjugate, SIMPLE_TENSES, type Conjugation, type Tense } from "./conjugation/engine.ts";
import { trapsFor } from "./conjugation/traps.ts";
import type { Lexicon } from "./lexicon/types.ts";

const ROOT = resolve(import.meta.dirname, "..");
const lex: Lexicon = JSON.parse(readFileSync(resolve(ROOT, "data/lexicon.json"), "utf8"));

/* Lexique: verb forms by lemma and inflection tag ("ind:pre:1s"). The copy is Latin-1. */
const TAG: Record<Tense, string> = { pres: "ind:pre", imp: "ind:imp", fut: "ind:fut", cond: "cnd:pre", subj: "sub:pre" };
const PERSON = ["1s", "2s", "3s", "1p", "2p", "3p"];
const attested = new Map<string, Map<string, Set<string>>>();
{
  const text = gunzipSync(readFileSync(resolve(ROOT, "references/lexique/Lexique383.tsv.gz"))).toString("latin1");
  const lines = text.split("\n");
  const head = lines[0].split("\t").map((h) => h.split("_").slice(1).join("_"));
  const col = (n: string) => head.indexOf(n);
  const [cOrtho, cLemme, cCgram, cInfo] = [col("ortho"), col("lemme"), col("cgram"), col("infover")];
  for (let i = 1; i < lines.length; i++) {
    const r = lines[i].split("\t");
    if (r[cCgram] !== "VER" && r[cCgram] !== "AUX") continue;
    const lemme = r[cLemme].toLowerCase();
    let byTag = attested.get(lemme);
    if (!byTag) attested.set(lemme, (byTag = new Map()));
    for (const tag of r[cInfo].replace(/"/g, "").split(";").filter(Boolean)) {
      let set = byTag.get(tag);
      if (!set) byTag.set(tag, (set = new Set()));
      set.add(r[cOrtho].toLowerCase());
    }
  }
}
// Lexique writes œ as "oe"
const lx = (s: string) => s.replace(/œ/g, "oe");

/** Lexique tagging errors, checked by hand: the attested form for that slot is not a form of it. */
const LEXIQUE_ERRORS: Record<string, string> = {
  "laisser subj:1p": "Lexique tags « laisses » as subjunctive 1p; the form is laissions",
  "parier imp:1p": "Lexique tags « parions » (present) as imperfect 1p; the form is pariions",
};
/** past participle agreement forms (pacsé → pacsée, pacsés, pacsées) */
const agreeForms = (pp: string) => (/[sx]$/.test(pp) ? [pp, pp + "e", pp + "es"] : [pp, pp + "e", pp + "s", pp + "es"]);

type Status = "verified" | "partial" | "unattested" | "mismatch" | "unsupported";
interface Mismatch { tense: string; person: string; ours: string[]; lexique: string[] }

const SUPPLETIVE_MODELS = new Set([
  "être", "avoir", "aller", "faire", "pouvoir", "vouloir", "savoir", "valoir", "falloir",
  "devoir", "mouvoir", "mourir", "boire", "venir", "asseoir", "pleuvoir", "voir", "envoyer", "acquérir",
]);

function check(c: Conjugation) {
  const byTag = attested.get(lx(c.inf));
  const mismatches: Mismatch[] = [];
  let checked = 0;
  if (byTag) {
    for (const t of SIMPLE_TENSES)
      c.forms[t].forEach((form, i) => {
        if (!form) return;
        // the infinitive itself tagged as a finite form is noise in Lexique (fondre, accoupler);
        // byTag is already matched by c_lemme === lx(c.inf), so suppletive verbs (être/aller/avoir/…) keep all c_lemme forms.
        const set = new Set(
          [...(byTag.get(`${TAG[t]}:${PERSON[i]}`) ?? [])].filter(
            (f) => f !== lx(c.inf) && (SUPPLETIVE_MODELS.has(c.model) || f.slice(0, 2) === lx(c.inf).slice(0, 2)),
          ),
        );
        if (!set.size || LEXIQUE_ERRORS[`${c.inf} ${t}:${PERSON[i]}`]) return;
        checked++;
        const ours = [form, ...(c.alt?.[`${t}:${i}`] ?? [])];
        if (!ours.some((f) => set.has(lx(f)))) mismatches.push({ tense: t, person: PERSON[i], ours, lexique: [...set] });
      });
    const pp = byTag.get("par:pas");
    if (pp?.size) {
      checked++;
      if (!agreeForms(lx(c.pp)).some((f) => pp.has(f))) mismatches.push({ tense: "pp", person: "", ours: [c.pp], lexique: [...pp] });
    }
  }
  const status: Status = mismatches.length ? "mismatch" : checked >= 5 ? "verified" : checked > 0 ? "partial" : "unattested";
  return { status, checked, mismatches };
}

const entries: Record<string, { inf: string; model?: string; status: Status; checked?: number; mismatches?: Mismatch[] }> = {};
const taught: Record<string, unknown> = {};
const counts: Record<string, number> = {};
const rows: string[][] = [["id", "lemma", "model", "tense", "person", "ours", "lexique"]];

for (const e of lex.entries) {
  if (e.aliasOf || e.pos !== "v.") continue;
  const c = conjugate(e.lemma);
  if (!c) {
    entries[e.id] = { inf: e.lemma, status: "unsupported" };
    counts.unsupported = (counts.unsupported ?? 0) + 1;
    continue;
  }
  const { status, checked, mismatches } = check(c);
  entries[e.id] = { inf: c.inf, model: c.model, status, checked, ...(mismatches.length ? { mismatches } : {}) };
  counts[status] = (counts[status] ?? 0) + 1;
  for (const m of mismatches) rows.push([e.id, e.lemma, c.model, m.tense, m.person, m.ours.join("|"), m.lexique.join("|")]);
  // unattested headwords are mostly OCR damage (entrarner, eviter): not taught until spelled right
  const teach = status === "verified" || status === "partial";
  if (teach) {
    const allForms = new Set<string>();
    for (const set of attested.get(lx(c.inf))?.values() ?? []) for (const f of set) allForms.add(f);
    const tr = trapsFor(c, allForms);
    taught[e.id] = {
      i: c.inf,
      ...(c.pron ? { p: 1 } : {}),
      a: c.aux,
      pp: c.pp,
      m: c.model,
      ...(c.impersonal ? { imp: 1 } : {}),
      f: c.forms,
      ...(c.alt ? { alt: c.alt } : {}),
      ...(Object.keys(tr).length ? { tr } : {}),
      s: status,
    };
  }
}

const meta = {
  engine: "scripts/conjugation/engine.ts",
  check: "every simple-tense form and the past participle compared with Lexique 3.83 (CC BY-SA 4.0)",
  counts: Object.fromEntries(Object.entries(counts).sort()),
  taught: Object.keys(taught).length,
  generated: new Date().toISOString().slice(0, 10),
};
writeFileSync(resolve(ROOT, "data/conjugations.json"), JSON.stringify({ meta, entries }, null, 0) + "\n");
mkdirSync(resolve(ROOT, "data/gaps"), { recursive: true });
const csv = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
writeFileSync(resolve(ROOT, "data/gaps/conjugation-mismatches.csv"), rows.map((r) => r.map(csv).join(",")).join("\n") + "\n");
mkdirSync(resolve(ROOT, "public/atlas"), { recursive: true });
writeFileSync(resolve(ROOT, "public/atlas/conj.json"), JSON.stringify({ v: 1, verbs: taught }));
console.log(`conjugations: ${JSON.stringify(meta.counts)}; taught ${meta.taught}; mismatching forms ${rows.length - 1}`);
