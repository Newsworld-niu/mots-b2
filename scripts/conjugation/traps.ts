/* Plausible wrong verb forms built by analogy (over-regularization, dropped accents/cedillas,
 * wrong double letters, wrong stem across tenses). Used as distractors in 动词变位 so that
 * multiple-choice questions test the real pitfalls (j'envoierai, nous appellons, il a pleuvu)
 * rather than only real forms of other persons and tenses.
 *
 * Every generated trap is checked by scripts/build-conjugations.ts against the verb's own forms,
 * accepted variants (alt), and every form attested for the verb in Lexique 3.83: a real form
 * is never emitted as a trap.
 */
import { SIMPLE_TENSES, type Conjugation } from "./engine.ts";

const PRES_ER = ["e", "es", "e", "ons", "ez", "ent"];
const PRES_IR = ["is", "is", "it", "issons", "issez", "issent"];
const PRES_RE = ["s", "s", "", "ons", "ez", "ent"];
const IMP = ["ais", "ais", "ait", "ions", "iez", "aient"];
const FUT = ["ai", "as", "a", "ons", "ez", "ont"];
const SUBJ = ["e", "es", "e", "ions", "iez", "ent"];
const lx = (s: string) => s.replace(/œ/g, "oe").toLowerCase();
const endsCons = (s: string) => /[bcdfghjklmnpqrstvwxzç]$/i.test(s);

/** Plausible non-existent forms keyed by "tense:person" (and "pp" for the past participle). */
export function trapsFor(c: Conjugation, attested: ReadonlySet<string>): Record<string, string[]> {
  const real = new Set<string>([c.inf, c.pp]);
  for (const t of SIMPLE_TENSES) for (const f of c.forms[t]) if (f) real.add(f);
  for (const list of Object.values(c.alt ?? {})) for (const f of list) real.add(f);
  for (const f of attested) real.add(f);

  const ok = (cand: string, right: string) => {
    if (!cand || cand === right) return false;
    if (/(.)\1\1/.test(cand)) return false; // no triple letters (courrrai, appelllons)
    if (real.has(cand) || real.has(lx(cand))) return false;
    return true;
  };

  const out: Record<string, string[]> = {};
  const put = (key: string, right: string, cands: string[]) => {
    const kept: string[] = [];
    const seen = new Set<string>();
    for (const raw of cands) {
      const w = raw.trim().toLowerCase();
      if (!ok(w, right) || seen.has(w)) continue;
      seen.add(w);
      kept.push(w);
      if (kept.length === 2) break;
    }
    if (kept.length) out[key] = kept;
  };

  const inf = c.inf;
  const er = inf.endsWith("er");
  const ir = inf.endsWith("ir") && !inf.endsWith("oir");
  const oir = inf.endsWith("oir");
  const re = inf.endsWith("re") && inf !== "être";
  const stem2 = inf.slice(0, -2);
  const pres = c.forms.pres;
  const futStem = c.forms.fut[2] ? c.forms.fut[2].replace(/a$/, "") : "";
  const ilsStem = pres[5]?.endsWith("ent") ? pres[5].slice(0, -3) : "";
  const nousStem = pres[3]?.endsWith("ons") ? pres[3].slice(0, -3) : "";

  for (const t of SIMPLE_TENSES) {
    for (let p = 0; p < 6; p++) {
      const right = c.forms[t][p];
      if (!right) continue;
      const cands: string[] = [];

      if (t === "pres") {
        // 1. Naive regular analogy
        if (er && inf !== "aller") cands.push(stem2 + PRES_ER[p]);
        if (ir) cands.push(stem2 + PRES_IR[p]);
        if (re && endsCons(stem2) && (p >= 3 || !/[vc]$/.test(stem2))) cands.push(stem2 + PRES_RE[p]);
        // 2. -eler / -eter confusion (double vs è, and over-doubling in nous/vous)
        if (/(el|et)er$/.test(inf)) {
          const last = stem2.slice(-1);
          const dbl = stem2 + last;
          const grave = stem2.slice(0, -2) + "è" + last;
          if (p === 3 || p === 4) {
            cands.push(dbl + PRES_ER[p], grave + PRES_ER[p]);
          } else {
            cands.push(grave + PRES_ER[p], dbl + PRES_ER[p], stem2 + PRES_ER[p]);
          }
        }
        // 3. -cer / -ger / -cevoir cedilla and soft-g mistakes
        if (right.includes("ç")) cands.push(right.replace("ç", "c"));
        if (/cevoir$/.test(inf) && (p === 3 || p === 4)) cands.push(right.replace("cev", "çev"));
        if (/cer$/.test(inf) && (p === 4 || p === 5)) cands.push(right.replace(/c(ez|ent)$/, "ç$1"));
        if (/ger$/.test(inf) && p === 3) cands.push(stem2 + "ons");
        // 4. -oyer / -uyer y ↔ i mistakes
        if (/[ou]yer$/.test(inf)) {
          if (p === 3 || p === 4) cands.push(stem2.slice(0, -1) + "i" + PRES_ER[p]);
          else cands.push(stem2 + PRES_ER[p]);
        }
        // 5. e/é → è omitted or carried into nous/vous
        if (er && right.includes("è")) cands.push(right.replace("è", "e"));
        if (er && (p === 3 || p === 4) && pres[0].includes("è")) cands.push(pres[0].slice(0, -1) + PRES_ER[p]);
        // 6. dire / faire vous over-regularized (disez, faisez)
        if (c.group === 3 && p === 4 && nousStem) cands.push(nousStem + "ez");
        // 7. double-n verbs (venir, tenir, prendre): single n in ils, double n in nous/vous
        if (p === 5 && right.endsWith("nnent")) cands.push(right.replace(/nnent$/, "nent"));
        if ((p === 3 || p === 4) && ilsStem.endsWith("nn")) cands.push(ilsStem + PRES_ER[p]);
        // 8. 3rd-group stem carried from nous into ils (buvent, devent, pouvent, faisent)
        if (c.group === 3 && p === 5 && nousStem) cands.push(nousStem + "ent");
      }

      if (t === "imp") {
        // 1. Naive stem from infinitive or ils instead of nous (je boivais, je prendais, je doivais, je peuvais)
        if (er && inf !== "aller") cands.push(stem2 + IMP[p]);
        if (re && endsCons(stem2)) cands.push(stem2 + IMP[p]);
        if (ilsStem && ilsStem !== nousStem) cands.push(ilsStem + IMP[p]);
        // 2. -eler / -eter over-doubling in imparfait (j'appellais)
        if (/(el|et)er$/.test(inf)) cands.push(stem2 + stem2.slice(-1) + IMP[p]);
        // 3. cedilla / soft-g omitted
        if (right.includes("ç")) cands.push(right.replace("ç", "c"));
        if (/ger$/.test(inf) && right.includes("gea")) cands.push(right.replace("gea", "ga"));
      }

      if (t === "fut" || t === "cond") {
        const end = t === "fut" ? FUT[p] : IMP[p];
        // 1. Classic -oyer/-uyer future stem (envoierai) and regular infinitive + ending
        if (er) {
          if (pres[0].endsWith("e") && pres[0].slice(0, -1) + "er" !== futStem) cands.push(pres[0].slice(0, -1) + "er" + end);
          cands.push(inf + end);
        }
        if (ir) cands.push(inf + end);
        if (oir) cands.push(inf + end);
        if (re) cands.push(inf.slice(0, -1) + end);
        // 2. Double-r future stem reduced to single r (verai, pourai, courai, mourai, enverai, acquerai)
        if (futStem.endsWith("rr")) cands.push(futStem.slice(0, -1) + end);
        // 3. -oir extra -e- before r (receverai, deverai, pleuvera, fallera, pouverai)
        if (oir) {
          if (nousStem && !nousStem.endsWith("y")) cands.push(nousStem + "er" + end);
          if (endsCons(inf.slice(0, -3))) cands.push(inf.slice(0, -3) + "er" + end);
        }
        // 4. -eler / -eter confusion in future
        if (/(el|et)er$/.test(inf)) {
          const last = stem2.slice(-1);
          cands.push(stem2.slice(0, -2) + "è" + last + "er" + end);
          cands.push(stem2 + last + "er" + end);
        }
        // 5. Dropped è in future (achetera, levera)
        if (er && futStem.includes("è")) cands.push(futStem.replace("è", "e") + end);
        // 6. Missing d in viendr-/tiendr- (venrai, tenrai)
        if (futStem.endsWith("ndr") && (c.model === "venir" || c.model === "tenir")) cands.push(futStem.replace(/iendr$/, "enr") + end);
      }

      if (t === "subj") {
        if (p === 3 || p === 4) {
          // soyions / ayions
          if (right.endsWith("yons") || right.endsWith("yez")) cands.push(right.replace(/y(ons|ez)$/, "yi$1"));
          // Two-stem confusion: ils/subj-sing stem carried into nous/vous (prennions, viennions, aillions, boivions, doivions)
          const s0 = c.forms.subj[0];
          if (s0?.endsWith("e") && !s0.endsWith("ie")) cands.push(s0.slice(0, -1) + SUBJ[p]);
          if (ilsStem && !ilsStem.endsWith("i")) cands.push(ilsStem + SUBJ[p]);
        } else {
          // Regular/nous stem carried into singular/ils (prene, vene, alle, faise, pouve, save, buve)
          if (c.group === 3 && nousStem) cands.push(nousStem + SUBJ[p]);
          if (er && inf !== "aller") cands.push(stem2 + SUBJ[p]);
          if (inf === "aller") cands.push("all" + SUBJ[p]);
          if (inf === "être" && p === 1) cands.push("soyes");
          if (inf === "savoir") cands.push("saich" + SUBJ[p]);
        }
        if (right.includes("è")) cands.push(right.replace("è", "e"));
      }

      put(`${t}:${p}`, right, cands);
    }
  }

  // Past participle traps (for passé composé distractors)
  const ppCands: string[] = [];
  if (ir) ppCands.push(stem2 + "i", stem2 + "u", stem2 + "é");
  if (oir) {
    if (nousStem && !nousStem.endsWith("y")) ppCands.push(nousStem + "u");
    if (endsCons(inf.slice(0, -3))) ppCands.push(inf.slice(0, -3) + "u");
    if (c.pp.includes("ç")) ppCands.push(c.pp.replace("ç", "c"));
    if (c.pp === "dû") ppCands.push("du");
    if (c.pp === "pu" || c.pp === "vu" || c.pp === "su" || c.pp === "plu") ppCands.push(c.pp.slice(0, -1) + "û");
  }
  if (re) {
    if (endsCons(stem2)) ppCands.push(stem2 + "u", stem2 + "é");
    if (nousStem) ppCands.push(nousStem + "u");
    if (c.pp.includes("tt")) ppCands.push(c.pp.replace("tt", "t"));
  }
  put("pp", c.pp, ppCands);

  return out;
}
