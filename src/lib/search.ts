import type { Atlas, WordRef } from "../atlas/types";
import { foldAccents } from "./accent";

/**
 * Search the word list by French spelling (accents optional: "etre" finds "être") or by Chinese gloss.
 * Exact spelling ranks first, then the same word without accents, then prefixes, then substrings.
 */
export function searchAtlas(atlas: Pick<Atlas, "words" | "custom">, raw: string, limit = 40): WordRef[] {
  const q = raw.trim().toLowerCase();
  if (!q) return [];
  const f = foldAccents(q);
  const zh = /[一-鿿]/.test(q);
  const hits: [number, WordRef][] = [];
  for (const w of atlas.custom ? [...atlas.custom, ...atlas.words] : atlas.words) {
    let score = 0;
    if (zh) {
      const i = w.zh.indexOf(q);
      if (i >= 0) score = 60 - Math.min(40, i) - w.zh.length * 0.2;
    } else {
      const word = w.word.toLowerCase();
      const wf = foldAccents(word);
      if (word === q) score = 1000;
      else if (wf === f) score = 900;
      else if (word.startsWith(q)) score = 600 - word.length;
      else if (wf.startsWith(f)) score = 500 - word.length;
      else if (wf.includes(f)) score = 200 - wf.indexOf(f) - word.length;
    }
    if (score > 0) hits.push([score, w]);
  }
  hits.sort((a, b) => b[0] - a[0] || a[1].order - b[1].order);
  return hits.slice(0, limit).map((h) => h[1]);
}
