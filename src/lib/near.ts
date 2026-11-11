/**
 * Words spelled close to a misread one (a scanning error: maisan → maison, rnaison → maison, clief → chef).
 * The distance counts one edit for a changed, missing, extra or swapped letter, and also one for a typical
 * OCR confusion of letter groups (rn ↔ m, cl ↔ d, vv ↔ w, li ↔ h, 0 ↔ o, 1 ↔ l …). Accents are ignored here:
 * the accent-only case is handled separately (near with "拼写或重音不同").
 */
import type { WordRef } from "../atlas/types";
import { foldAccents } from "./accent";
import { nearDict, type DictEntry } from "./dict";

const OCR: [string, string][] = [
  ["rn", "m"],
  ["cl", "d"],
  ["vv", "w"],
  ["li", "h"],
  ["ii", "u"],
  ["0", "o"],
  ["1", "l"],
  ["5", "s"],
];

const fold = (s: string) => foldAccents(s.replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim());

/** Optimal string alignment distance (Levenshtein with adjacent swaps), stopping above `cap`. */
export function editDistance(a: string, b: string, cap = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let row = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      row = Math.min(row, d[i][j]);
    }
    if (row > cap) return cap + 1;
  }
  return d[a.length][b.length];
}

/** Every spelling one OCR confusion away (both directions), the word itself included. */
function ocrVariants(s: string): string[] {
  const out = new Set([s]);
  for (const [x, y] of OCR)
    for (const [from, to] of [
      [x, y],
      [y, x],
    ]) {
      let at = s.indexOf(from);
      while (at >= 0) {
        out.add(s.slice(0, at) + to + s.slice(at + from.length));
        at = s.indexOf(from, at + 1);
      }
    }
  return [...out];
}

/** Distance between a misread spelling and a real word, counting an OCR confusion as one edit. Both folded. */
export function scanDistance(read: string, real: string, variants = ocrVariants(read), cap = 3): number {
  let best = editDistance(read, real, cap);
  if (best <= 1) return best;
  for (const v of variants) if (v !== read) best = Math.min(best, 1 + editDistance(v, real, Math.max(0, best - 2)));
  return best;
}

/** How far a word may be from a real one and still be offered: 1 edit for short words, 2 from 7 letters. */
export const allowedDistance = (word: string) => (fold(word).length >= 7 ? 2 : 1);

export interface NearSuggestion {
  word: string;
  zh: string;
  /** Atlas or own word id; absent for a dictionary word. */
  id?: string;
  entry?: DictEntry;
  dist: number;
}

/** Up to `limit` real words close to a misread one, from the atlas and own words first, then the dictionary. */
export async function nearWords(word: string, refs: WordRef[], limit = 3): Promise<NearSuggestion[]> {
  const f = fold(word);
  if (f.length < 3) return [];
  const max = allowedDistance(word);
  const out: NearSuggestion[] = [];
  const variants = ocrVariants(f);
  for (const r of refs) {
    const k = fold(r.word.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim());
    if (k === f || Math.abs(k.length - f.length) > max + 1) continue;
    const d = scanDistance(f, k, variants, max);
    if (d <= max) out.push({ word: r.word, zh: r.zh, id: r.id, dist: d });
  }
  const have = new Set(out.map((x) => fold(x.word)));
  for (const { entry, dist } of await nearDict(word, (a, b) => scanDistance(a, b, variants, max), max).catch(() => [])) {
    const k = fold(entry.w);
    if (have.has(k) || !entry.zh?.length) continue;
    have.add(k);
    out.push({ word: entry.w, zh: [...new Set(entry.zh.map((g) => g[0]))].slice(0, 3).join("；"), entry, dist });
  }
  // closer first; at the same distance a word of the atlas (studied path) before the dictionary
  return out.sort((a, b) => a.dist - b.dist || (a.id ? 0 : 1) - (b.id ? 0 : 1)).slice(0, limit);
}
