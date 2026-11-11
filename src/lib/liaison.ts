/**
 * Obligatory liaison (连诵) in a French sentence, conservatively: only the cases every textbook marks as required.
 * A missed liaison is harmless; a wrong mark teaches a mistake, so anything uncertain is left out
 * (adjective + noun, très / dans / chez, h aspiré, inversions).
 */

/** Determiners and numbers: liaison before the noun or adjective that follows. */
const DETERMINERS = new Set(["les", "des", "ces", "mes", "tes", "ses", "nos", "vos", "leurs", "aux", "un", "aucun", "deux", "trois", "six", "dix", "plusieurs", "quels", "quelles", "certains", "certaines"]);
/** Subject / object pronouns and "en": liaison before the verb or y / en that follows. */
const PRONOUNS = new Set(["nous", "vous", "ils", "elles", "on", "en"]);
/** After a pronoun these are not the verb: no required liaison (vous‿et is wrong, vous aussi is optional). */
const NOT_AFTER_PRONOUN = new Set(["et", "ou", "aussi", "à", "au", "aux", "avec", "alors", "après", "encore", "ici", "ainsi", "autant", "autrement", "un", "une"]);
/** Common words with a mute h (liaison made): les‿hommes. Other h-words are skipped, since many have h aspiré (les | héros). */
const MUTE_H = /^(hommes?|heures?|hôtels?|histoires?|hivers?|habitants?|habitudes?|hôpita(l|ux)|herbes?|huiles?|humains?|honneurs?|horaires?|habiter|habite|habitons|habitez|habitent|hésite[rz]?|hésitons|hésitent)$/;
/** Words starting with a vowel letter that never take liaison, and little words that never follow one (l'un‿et is wrong). */
const NO_LIAISON = new Set(["onze", "onzième", "oui", "ouate", "ouistiti", "yaourt", "yoga", "et", "ou", "à"]);

const VOWEL = /^[aeiouâàäéèêëîïôöûùüœæ]/;

const startsVowelSound = (w: string) => {
  if (NO_LIAISON.has(w)) return false;
  if (w === "y" || w === "yeux") return true;
  if (w.startsWith("h")) return MUTE_H.test(w);
  return VOWEL.test(w);
};

/** Indices of the spaces in `text` that carry an obligatory liaison. */
export function liaisonPoints(text: string): number[] {
  const out: number[] = [];
  const re = /\S+/g;
  const tokens: { s: string; start: number; end: number }[] = [];
  for (let m; (m = re.exec(text)); ) tokens.push({ s: m[0], start: m.index, end: m.index + m[0].length });
  for (let i = 0; i + 1 < tokens.length; i++) {
    const a = tokens[i];
    const b = tokens[i + 1];
    // exactly one plain space between, no punctuation on either side of it
    if (b.start !== a.end + 1 || text[a.end] !== " ") continue;
    if (!/[a-zà-ÿ]$/i.test(a.s)) continue;
    // "qu'ils" → "ils"; "-vous" (impératif, inversion) is never a liaison point here
    const left = a.s.toLowerCase().replace(/^.*['’]/, "");
    if (a.s.includes("-")) continue;
    const right = b.s.toLowerCase().replace(/^[«"“(]+/, "").replace(/[-'’].*$/, "").replace(/[^a-zà-ÿœæ]+$/, "");
    if (!right || !startsVowelSound(right)) continue;
    // after an apostrophe only a pronoun counts (qu'ils‿ont); quelqu'un est is not a determiner
    const elided = /['’]/.test(a.s);
    if ((DETERMINERS.has(left) && !elided) || (PRONOUNS.has(left) && !NOT_AFTER_PRONOUN.has(right))) out.push(a.end);
  }
  return out;
}
