/**
 * Compact [pos, shortZh] hints for related-word chips (派生 / 近义 / 反义), resolved without loading full e/*.json
 * shards: first from whatever is already in memory (atlas, fixtures), then from the 1-letter hints/<bucket>.json
 * shards — only for the buckets the visible words need, and only when meta.hintsShards says they exist.
 */
import { loadHintsShard, loadMeta } from "./load";
import { hintBucket, lexdbFold, type LexHintTuple, type LexHintsShard, type LexMeta } from "./types";

/** Lower-cased NFC key used by hints/<bucket>.json. */
export const hintKey = (w: string) => w.normalize("NFC").trim().toLowerCase();

const foldedIndex = new WeakMap<LexHintsShard, Map<string, string | null>>();

/** folded spelling -> the one shard key with that folding (null when two keys fold the same: ambiguous). */
function foldIndex(shard: LexHintsShard): Map<string, string | null> {
  let idx = foldedIndex.get(shard);
  if (!idx) {
    idx = new Map();
    for (const k of Object.keys(shard)) {
      const f = lexdbFold(k);
      idx.set(f, idx.has(f) ? null : k);
    }
    foldedIndex.set(shard, idx);
  }
  return idx;
}

/** Exact (lower-cased NFC) lookup, else an accent-folded match when exactly one key in the shard folds the same. */
export function findHint(shard: LexHintsShard, w: string): LexHintTuple | null {
  const exact = shard[hintKey(w)];
  if (exact) return exact;
  const k = foldIndex(shard).get(lexdbFold(w));
  return k ? shard[k] ?? null : null;
}

export interface HintSources {
  /** Synchronous in-memory lookup (atlas, fixtures). */
  local?: (w: string) => LexHintTuple | null;
  /** Meta already loaded by the page; when undefined it is loaded (cached) only if some word is still missing. */
  meta?: LexMeta | null;
  loadShard?: (bucket: string) => Promise<LexHintsShard | null>;
  loadMetaFn?: () => Promise<LexMeta | null>;
}

/** Hints available right away from memory. */
export function localHints(words: readonly string[], local?: HintSources["local"]): Map<string, LexHintTuple> {
  const out = new Map<string, LexHintTuple>();
  if (!local) return out;
  for (const w of words) {
    if (out.has(w)) continue;
    const h = local(w);
    if (h && (h[0] || h[1])) out.set(w, h);
  }
  return out;
}

/** All hints for `words`: memory first, then the needed hints shards (never throws; missing words are simply absent). */
export async function resolveHints(words: readonly string[], src: HintSources = {}): Promise<Map<string, LexHintTuple>> {
  const out = localHints(words, src.local);
  const missing = [...new Set(words)].filter((w) => w.trim() && !out.has(w));
  if (!missing.length) return out;
  let meta = src.meta;
  if (meta === undefined) meta = await (src.loadMetaFn ?? loadMeta)().catch(() => null);
  if (!meta?.hintsShards) return out;
  const load = src.loadShard ?? loadHintsShard;
  const buckets = [...new Set(missing.map(hintBucket))];
  const shards = new Map<string, LexHintsShard | null>();
  await Promise.all(
    buckets.map(async (b) => {
      shards.set(b, await load(b).catch(() => null));
    }),
  );
  for (const w of missing) {
    const shard = shards.get(hintBucket(w));
    const h = shard ? findHint(shard, w) : null;
    if (h && (h[0] || h[1])) out.set(w, h);
  }
  return out;
}
