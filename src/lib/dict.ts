/**
 * Offline dictionary for words the atlas does not have (public/dict, built by scripts/build-dict.py from
 * Lexique 3.83, French Wiktionary and Tatoeba). Files are split by the first two letters of the folded word and
 * fetched only when the learner adds a word.
 */
import { foldAccents } from "./accent";

/** [chinese, French label of the Wiktionary sense it translates]. */
export type DictGloss = [string, string];
/** [French sentence, Chinese, start, end of the word in the sentence (UTF-16)]. */
export type DictExample = [string, string, number, number];

export interface DictEntry {
  w: string;
  /** Part of speech in the atlas notation (n.m., n.f., v., adj. …). */
  p: string;
  ipa?: string;
  zh?: DictGloss[];
  ex?: DictExample[];
}

export interface DictHit extends DictEntry {
  /** The typed word is an inflected form of this lemma (voulons → vouloir). */
  form?: string;
}

interface DictFile {
  f: Record<string, string[]>;
  l: Record<string, DictEntry[]>;
}

const BASE = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : "/").replace(/\/$/, "");

/** Folded spelling, as the build folds it. */
export const dictFold = (s: string) => foldAccents(s.trim().replace(/[’‘]/g, "'").replace(/\s+/g, " "));

/** File key: the first two a–z letters ("a_" for a one-letter word), "__" when the word does not start with a letter. */
export function dictKey(folded: string) {
  const letters = folded.replace(/[^a-z]/g, "");
  if (!letters || !/^\p{L}/u.test(folded)) return "__";
  return (letters + "_").slice(0, 2);
}

const files = new Map<string, Promise<DictFile | null>>();
let fetcher: (url: string) => Promise<DictFile | null> = async (url) => {
  const r = await fetch(url);
  return r.ok ? ((await r.json()) as DictFile) : null;
};
/** Tests replace the network. */
export const setDictFetcher = (f: typeof fetcher) => {
  fetcher = f;
  files.clear();
};

function load(k: string) {
  let p = files.get(k);
  if (!p) {
    p = fetcher(`${BASE}/dict/${k}.json`).catch(() => null);
    p.then((x) => x === null && files.delete(k));
    files.set(k, p);
  }
  return p;
}

/** Entries for a typed word: the word itself as a lemma first, then the lemmas it is a form of. */
export async function lookupDict(word: string): Promise<DictHit[]> {
  const f = dictFold(word);
  if (!f || f.length > 60) return [];
  const file = await load(dictKey(f));
  if (!file) return [];
  const direct: DictHit[] = file.l[f] ?? [];
  const viaForm: DictHit[] = [];
  for (const lemma of file.f[f] ?? []) {
    const other = lemma === f ? file : await load(dictKey(lemma));
    for (const e of other?.l[lemma] ?? []) viaForm.push({ ...e, form: word.trim() });
  }
  // the lemma spelled exactly as typed (accents included) first; a lemma that only matches without accents
  // goes after the forms (bâille is a form of bâiller before it is the noun baille)
  const typed = word.trim().toLowerCase();
  const exact = direct.filter((e) => e.w.toLowerCase() === typed);
  const loose = direct.filter((e) => e.w.toLowerCase() !== typed);
  return [...exact, ...viaForm, ...loose];
}

/** The glosses joined as the form's Chinese field: "迎接；接待". */
export const joinGlosses = (zh: DictGloss[], n = 3) => [...new Set(zh.map((g) => g[0]))].slice(0, n).join("；");

/**
 * Dictionary lemmas spelled close to `word` (for scanning errors): only the file of the word's first two
 * letters is searched, so a misread first letter is not found here (the atlas search covers that).
 */
export async function nearDict(word: string, close: (a: string, b: string) => number, max = 1): Promise<{ entry: DictEntry; dist: number }[]> {
  const f = dictFold(word);
  if (f.length < 3 || f.length > 40) return [];
  const file = await load(dictKey(f));
  if (!file) return [];
  const out: { entry: DictEntry; dist: number }[] = [];
  for (const [k, list] of Object.entries(file.l)) {
    if (Math.abs(k.length - f.length) > max) continue;
    const d = close(f, k);
    if (d > 0 && d <= max) for (const e of list) out.push({ entry: e, dist: d });
  }
  return out.sort((a, b) => a.dist - b.dist).slice(0, 8);
}
