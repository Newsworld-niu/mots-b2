import { LruCache } from "../lru";
import {
  lexdbFold,
  lexdbKey,
  type LexEntry,
  type LexFormsShard,
  type LexMeta,
  type LexShard,
  type LexSuggestRow,
  type LexZhShard,
} from "./types";
import {
  validateFormsShard,
  validateLexMeta,
  validateLexShard,
  validateSuggestRows,
  validateZhShard,
} from "./validate";

export type LexdbFetcher = (url: string) => Promise<unknown>;

const BASE = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : "/").replace(
  /\/$/,
  "",
);

const isValidShardKey = (key: string) => /^[a-z_]{2,4}$/.test(key);
const isValidSuggestBucket = (bucket: string) => bucket === "top" || /^[a-z_]{1,3}$/.test(bucket);

export const LEXDB_ENTRY_CACHE_MAX = 24;
export const LEXDB_FORMS_CACHE_MAX = 24;
export const LEXDB_ZH_CACHE_MAX = 16;
export const LEXDB_SUGGEST_CACHE_MAX = 16;

/** Compute the suggest/<bucket>.json shard name for a folded French query (1 -> 2 -> 3 char splits). */
export function suggestBucket(folded: string, suggestSplits?: readonly string[]): string {
  const ch0 = folded[0];
  let bucket = ch0 && ch0 >= "a" && ch0 <= "z" ? ch0 : "_";
  if (!suggestSplits?.length || bucket === "_") return bucket;
  const splitSet = new Set(suggestSplits);
  while (bucket.length < 3 && splitSet.has(bucket)) {
    const ch = folded[bucket.length];
    const next = ch && ch >= "a" && ch <= "z" ? ch : "_";
    bucket = `${bucket}${next}`;
  }
  return bucket;
}

const defaultFetcher: LexdbFetcher = async (url) => {
  const r = await fetch(url);
  return r.ok ? await r.json() : null;
};

let fetcher: LexdbFetcher = defaultFetcher;
let hasCustomFetcher = false;
let metaPromise: Promise<LexMeta | null> | null = null;
let suggestPromise: Promise<LexSuggestRow[] | null> | null = null;
const entryShards = new LruCache<string, Promise<LexShard | null>>(LEXDB_ENTRY_CACHE_MAX);
const formsShards = new LruCache<string, Promise<LexFormsShard | null>>(LEXDB_FORMS_CACHE_MAX);
const zhShards = new LruCache<number, Promise<LexZhShard | null>>(LEXDB_ZH_CACHE_MAX);
const suggestShards = new LruCache<string, Promise<LexSuggestRow[] | null>>(LEXDB_SUGGEST_CACHE_MAX);
const fixtureEntries = new Map<string, LexEntry>();

/** Replace the network fetcher for deterministic tests and clear all internal caches. */
export function setLexdbFetcher(f: LexdbFetcher | null): void {
  fetcher = f ?? defaultFetcher;
  hasCustomFetcher = f !== null;
  metaPromise = null;
  suggestPromise = null;
  entryShards.clear();
  formsShards.clear();
  zhShards.clear();
  suggestShards.clear();
  fixtureEntries.clear();
}

/** Inject fallback fixture entries for tests when shards are not mocked. */
export function setLexdbFixtures(entries: readonly LexEntry[] | Record<string, LexEntry> | null): void {
  fixtureEntries.clear();
  if (!entries) return;
  const list = Array.isArray(entries) ? entries : Object.values(entries);
  for (const e of list) {
    fixtureEntries.set(e.id, e);
  }
}

export function loadMeta(): Promise<LexMeta | null> {
  if (!metaPromise) {
    const req = fetcher(`${BASE}/lexdb/meta.json`)
      .then((x) => validateLexMeta(x))
      .catch(() => null);
    req.then((x) => {
      if (x === null && metaPromise === req) metaPromise = null;
    });
    metaPromise = req;
  }
  return metaPromise;
}

export function loadSuggest(): Promise<LexSuggestRow[] | null> {
  if (!suggestPromise) {
    const req = fetcher(`${BASE}/lexdb/suggest.json`)
      .then((x) => validateSuggestRows(x))
      .catch(() => null);
    req.then((x) => {
      if (x === null && suggestPromise === req) suggestPromise = null;
    });
    suggestPromise = req;
  }
  return suggestPromise;
}

export function loadSuggestShard(bucket: string): Promise<LexSuggestRow[] | null> {
  if (!isValidSuggestBucket(bucket)) return Promise.resolve(null);
  return loadCached(suggestShards, bucket, `${BASE}/lexdb/suggest/${bucket}.json`, validateSuggestRows);
}

function loadCached<K, V>(
  cache: LruCache<K, Promise<V | null>>,
  key: K,
  url: string,
  validate: (raw: unknown) => V | null,
): Promise<V | null> {
  let p = cache.get(key);
  if (!p) {
    const req = fetcher(url)
      .then((x) => validate(x))
      .catch(() => null);
    req.then((x) => {
      if (x === null && cache.peek(key) === req) cache.delete(key);
    });
    p = req;
    cache.set(key, p);
  }
  return p;
}

export function loadEntryShard(key: string): Promise<LexShard | null> {
  if (!isValidShardKey(key)) return Promise.resolve(null);
  return loadCached(entryShards, key, `${BASE}/lexdb/e/${key}.json`, validateLexShard);
}

export function loadFormsShard(key: string): Promise<LexFormsShard | null> {
  if (!isValidShardKey(key)) return Promise.resolve(null);
  return loadCached(formsShards, key, `${BASE}/lexdb/forms/${key}.json`, validateFormsShard);
}

export function loadZhShard(bucket: number): Promise<LexZhShard | null> {
  if (!Number.isInteger(bucket) || bucket < 0 || bucket > 63) return Promise.resolve(null);
  return loadCached(zhShards, bucket, `${BASE}/lexdb/zh/${bucket}.json`, validateZhShard);
}

function fixtureMatchesForLemma(foldedLemma: string): LexEntry[] {
  if (!fixtureEntries.size) return [];
  const prefix = `${foldedLemma}#`;
  const out: LexEntry[] = [];
  for (const [k, entry] of fixtureEntries) {
    if (k === foldedLemma || (k.startsWith(prefix) && /^\d+$/.test(k.slice(prefix.length)))) {
      out.push(entry);
    }
  }
  return out;
}

/** Load a single LexEntry by its id (e.g. "accueil" or homograph "tour#2"). */
export async function getEntryById(id: string): Promise<LexEntry | null> {
  const raw = id.trim();
  if (!raw) return null;
  const base = raw.replace(/#\d+$/, "");
  const folded = lexdbFold(base);
  if (!folded) return null;
  const suffix = raw.slice(base.length);
  const foldedId = `${folded}${suffix}`;

  if (!hasCustomFetcher && fixtureEntries.size > 0) {
    const fix = fixtureEntries.get(raw) ?? fixtureEntries.get(foldedId);
    if (fix) return fix;
  }

  const meta = await loadMeta();
  const key = lexdbKey(folded, meta?.splits);
  const shard = await loadEntryShard(key);
  if (shard) {
    const hit = shard[raw] ?? shard[foldedId] ?? (suffix ? undefined : shard[folded]);
    if (hit) return hit;
  }
  return fixtureEntries.get(raw) ?? fixtureEntries.get(foldedId) ?? null;
}

/** Load all LexEntry homographs matching a folded lemma (id and id#2, id#3...). */
export async function getEntriesByLemma(lemma: string): Promise<LexEntry[]> {
  const folded = lexdbFold(lemma);
  if (!folded) return [];
  if (!hasCustomFetcher && fixtureEntries.size > 0) {
    const fix = fixtureMatchesForLemma(folded);
    if (fix.length) return fix;
  }
  const meta = await loadMeta();
  const key = lexdbKey(folded, meta?.splits);
  const shard = await loadEntryShard(key);
  const out: LexEntry[] = [];
  const seen = new Set<string>();
  if (shard) {
    const prefix = `${folded}#`;
    for (const [k, entry] of Object.entries(shard)) {
      if (k === folded || (k.startsWith(prefix) && /^\d+$/.test(k.slice(prefix.length)))) {
        if (!seen.has(entry.id)) {
          out.push(entry);
          seen.add(entry.id);
        }
      }
    }
  }
  if (!out.length) return fixtureMatchesForLemma(folded);
  return out;
}

/** Return injected fallback fixture entries (empty unless setLexdbFixtures was called). */
export function getLexdbFixtures(): LexEntry[] {
  return [...fixtureEntries.values()];
}
