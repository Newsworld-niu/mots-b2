/**
 * Unified offline dictionary adapter backed by LexDB (public/lexdb/).
 * Preserves the legacy DictHit / DictEntry interface for Read, ExtractWords,
 * TranscriptWords, HomeDictionary, WordForm, and Near spelling recovery.
 */
import {
  loadEntryShard,
  loadMeta,
  setLexdbFetcher,
  type LexdbFetcher,
} from "./lexdb/load";
import { resolve } from "./lexdb/search";
import { lexdbFold, lexdbKey, type LexEntry } from "./lexdb/types";

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
  /** Grammatical gender of this part of speech (nouns). */
  g?: "m" | "f" | "mf";
  /** Lemma-wide fields below are only set on the first hit of a LexEntry, so multi-POS words never repeat them. */
  forms?: { f?: string; pl?: string; fpl?: string };
  /** The verb has a conjugation table (#/dict?w=…&tab=conj). */
  conj?: boolean;
  /** [French phrase, Chinese]. */
  phrases?: [string, string][];
  /** [French derived word, short hint or ""]. */
  derived?: [string, string][];
  syn?: string[];
  ant?: string[];
}

export interface DictHit extends DictEntry {
  /** The typed word is an inflected form of this lemma (voulons → vouloir). */
  form?: string;
}

/** Folded spelling matching LexDB shards. */
export const dictFold = (s: string) => lexdbFold(s);

/** File key: the first two a–z letters ("a_" for a one-letter word), "__" when the word does not start with a letter. */
export function dictKey(folded: string) {
  const letters = folded.replace(/[^a-z]/g, "");
  if (!letters || !/^\p{L}/u.test(folded)) return "__";
  return (letters + "_").slice(0, 2);
}

/** Tests replace the LexDB fetcher and clear shard caches. */
export const setDictFetcher = (f: ((url: string) => Promise<unknown>) | null) => {
  setLexdbFetcher(f as LexdbFetcher | null);
};

function findHighlightSpan(sentence: string, word: string): [number, number] {
  if (!sentence || !word) return [0, 0];
  try {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, "iu").exec(sentence);
    if (m) return [m.index, m.index + m[0].length];
  } catch {
    /* ignore regex errors on exotic headwords */
  }
  const idx = sentence.toLowerCase().indexOf(word.toLowerCase());
  return idx >= 0 ? [idx, idx + word.length] : [0, 0];
}

const words = (list: readonly unknown[] | undefined): string[] =>
  [...new Set((list ?? []).filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean))];

/** Fields that belong to the lemma rather than to one part of speech (attached to the first hit only). */
function lemmaFields(entry: LexEntry): Partial<DictEntry> {
  const out: Partial<DictEntry> = {};
  const forms = entry.forms;
  if (forms && (forms.f || forms.pl || forms.fpl)) {
    out.forms = {
      ...(forms.f ? { f: forms.f } : {}),
      ...(forms.pl ? { pl: forms.pl } : {}),
      ...(forms.fpl ? { fpl: forms.fpl } : {}),
    };
  }
  if (entry.conj) out.conj = true;
  const phrases = (entry.phrases ?? [])
    .filter((p) => p && typeof p.fr === "string" && p.fr.trim())
    .map((p): [string, string] => [p.fr.trim(), (p.zh ?? "").trim()]);
  if (phrases.length) out.phrases = phrases;
  const derived = words(entry.derived).map((w): [string, string] => [w, ""]);
  if (derived.length) out.derived = derived;
  const syn = words(entry.syn);
  if (syn.length) out.syn = syn;
  const ant = words(entry.ant);
  if (ant.length) out.ant = ant;
  return out;
}

export function lexEntryToDictHits(entry: LexEntry, form?: string): DictHit[] {
  const blocks = entry.pos.length ? entry.pos : [{ p: "", senses: [] }];
  const hits: DictHit[] = [];
  for (const pb of blocks) {
    const zh: DictGloss[] = [];
    const seenZh = new Set<string>();
    const ex: DictExample[] = [];
    const seenEx = new Set<string>();

    for (const s of pb.senses) {
      const gloss = s.zh?.trim();
      if (gloss && !seenZh.has(gloss)) {
        seenZh.add(gloss);
        zh.push([gloss, s.fr ?? ""]);
      }
      for (const item of s.ex ?? []) {
        if (!item.fr || seenEx.has(item.fr)) continue;
        seenEx.add(item.fr);
        const span =
          item.hl && item.hl.length === 2 && item.hl[0] >= 0 && item.hl[1] >= item.hl[0]
            ? item.hl
            : findHighlightSpan(item.fr, entry.w);
        ex.push([item.fr, item.zh ?? "", span[0], span[1]]);
      }
    }

    hits.push({
      w: entry.w,
      p: pb.p,
      ...(entry.ipa ? { ipa: entry.ipa } : {}),
      ...(zh.length ? { zh } : {}),
      ...(ex.length ? { ex } : {}),
      ...("g" in pb && pb.g ? { g: pb.g } : {}),
      ...(form ? { form } : {}),
      ...(hits.length === 0 ? lemmaFields(entry) : {}),
    });
  }
  return hits;
}

/** Entries for a typed word resolved via LexDB (exact match, inflected forms, or phrases). */
export async function lookupDict(word: string): Promise<DictHit[]> {
  const raw = word.trim();
  const f = dictFold(raw);
  if (!f || f.length > 80) return [];
  const res = await resolve(raw);
  if (!res.entries.length) return [];

  const out: DictHit[] = [];
  const seen = new Set<string>();
  for (const entry of res.entries) {
    const isFormMatch = dictFold(entry.w) !== f;
    const form = isFormMatch ? raw : undefined;
    for (const hit of lexEntryToDictHits(entry, form)) {
      const sig = `${hit.w}\0${hit.p}\0${hit.form ?? ""}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(hit);
    }
  }
  return out;
}

/** The glosses joined as the form's Chinese field: "迎接；接待". */
export const joinGlosses = (zh: DictGloss[], n = 3) =>
  [...new Set(zh.map((g) => g[0]))].slice(0, n).join("；");

/**
 * Dictionary lemmas spelled close to `word` (for scanning errors): searches the LexDB shard
 * corresponding to `word`'s prefix (first 2+ folded letters).
 */
export async function nearDict(
  word: string,
  close: (a: string, b: string) => number,
  max = 1,
): Promise<{ entry: DictEntry; dist: number }[]> {
  const f = dictFold(word);
  if (f.length < 3 || f.length > 40) return [];
  const meta = await loadMeta();
  const shard = await loadEntryShard(lexdbKey(f, meta?.splits));
  if (!shard) return [];

  const out: { entry: DictEntry; dist: number }[] = [];
  for (const e of Object.values(shard)) {
    const lf = dictFold(e.w);
    if (!lf || Math.abs(lf.length - f.length) > max) continue;
    const d = close(f, lf);
    if (d > 0 && d <= max) {
      const hit = lexEntryToDictHits(e)[0];
      if (hit) out.push({ entry: hit, dist: d });
    }
  }
  return out.sort((a, b) => a.dist - b.dist).slice(0, 8);
}
