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

export type LexdbFetcher = (url: string) => Promise<unknown>;

const BASE = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : "/").replace(
  /\/$/,
  "",
);

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isValidShardKey = (key: string) => /^[a-z_]{2,3}$/.test(key);

const defaultFetcher: LexdbFetcher = async (url) => {
  const r = await fetch(url);
  return r.ok ? await r.json() : null;
};

let fetcher: LexdbFetcher = defaultFetcher;
let hasCustomFetcher = false;
let metaPromise: Promise<LexMeta | null> | null = null;
let suggestPromise: Promise<LexSuggestRow[] | null> | null = null;
const entryShards = new Map<string, Promise<LexShard | null>>();
const formsShards = new Map<string, Promise<LexFormsShard | null>>();
const zhShards = new Map<number, Promise<LexZhShard | null>>();
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
    metaPromise = fetcher(`${BASE}/lexdb/meta.json`)
      .then((x) => (isObj(x) && typeof x.version === "number" ? (x as unknown as LexMeta) : null))
      .catch(() => null);
    metaPromise.then((x) => {
      if (x === null) metaPromise = null;
    });
  }
  return metaPromise;
}

export function loadSuggest(): Promise<LexSuggestRow[] | null> {
  if (!suggestPromise) {
    suggestPromise = fetcher(`${BASE}/lexdb/suggest.json`)
      .then((x) => (Array.isArray(x) ? (x as LexSuggestRow[]) : null))
      .catch(() => null);
    suggestPromise.then((x) => {
      if (x === null) suggestPromise = null;
    });
  }
  return suggestPromise;
}

function loadCachedObj<K, V extends Record<string, unknown>>(
  cache: Map<K, Promise<V | null>>,
  key: K,
  url: string,
): Promise<V | null> {
  let p = cache.get(key);
  if (!p) {
    p = fetcher(url)
      .then((x) => (isObj(x) ? (x as V) : null))
      .catch(() => null);
    p.then((x) => {
      if (x === null) cache.delete(key);
    });
    cache.set(key, p);
  }
  return p;
}

export function loadEntryShard(key: string): Promise<LexShard | null> {
  if (!isValidShardKey(key)) return Promise.resolve(null);
  return loadCachedObj(entryShards, key, `${BASE}/lexdb/e/${key}.json`);
}

export function loadFormsShard(key: string): Promise<LexFormsShard | null> {
  if (!isValidShardKey(key)) return Promise.resolve(null);
  return loadCachedObj(formsShards, key, `${BASE}/lexdb/forms/${key}.json`);
}

export function loadZhShard(bucket: number): Promise<LexZhShard | null> {
  if (!Number.isInteger(bucket) || bucket < 0 || bucket > 63) return Promise.resolve(null);
  return loadCachedObj(zhShards, bucket, `${BASE}/lexdb/zh/${bucket}.json`);
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
