/** French accents: spelling check that tells "wrong letter" from "right letters, wrong accent", and caret insertion for the accent keys. */

/** Letters offered by the on-screen accent keys, lower case. */
export const ACCENT_KEYS = ["é", "è", "ê", "ë", "à", "â", "ù", "û", "ü", "î", "ï", "ô", "ç", "œ", "æ"] as const;

/** Remove accents and expand ligatures: "Élève" → "eleve", "cœur" → "coeur". */
export function foldAccents(s: string) {
  return s
    .normalize("NFKC")
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

const tidy = (s: string) =>
  s
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/[‐‑–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/**
 * "exact": same spelling. "accent": only accents/ligatures differ (écoute / ecoute, coeur / cœur).
 * "wrong": anything else.
 */
export function spellingVerdict(typed: string, target: string): "exact" | "accent" | "wrong" {
  const a = tidy(typed);
  const b = tidy(target);
  if (a === b) return "exact";
  return foldAccents(a) === foldAccents(b) ? "accent" : "wrong";
}

/** Insert `ch` at the selection of `value`; returns the new text and where the caret goes. */
export function insertAt(value: string, start: number, end: number, ch: string) {
  const s = Math.max(0, Math.min(start, value.length));
  const e = Math.max(s, Math.min(end, value.length));
  return { value: value.slice(0, s) + ch + value.slice(e), caret: s + ch.length };
}

/**
 * Like spellingVerdict, for a target that starts with its article ("une maison").
 * "article": the noun is spelled right (accents aside) but the article is wrong or missing.
 */
export function articleVerdict(typed: string, target: string): "exact" | "accent" | "article" | "wrong" {
  const plain = spellingVerdict(typed, target);
  if (plain !== "wrong") return plain;
  const m = /^(un|une) (.+)$/.exec(tidy(target));
  if (!m) return "wrong";
  const t = tidy(typed);
  // longest article first, and a space after it ("une homme" must not read as "un" + "e homme")
  const am = /^(?:une|un|les|le|la)\s+(.+)$/.exec(t) ?? /^l'\s*(.+)$/.exec(t);
  const noun = am ? am[1] : t;
  return spellingVerdict(noun, m[2]) === "wrong" ? "wrong" : "article";
}
