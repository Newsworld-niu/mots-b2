import type { Seed } from "../lookup";
import {
  MAX_COLLOCATIONS,
  MAX_EXAMPLES,
  MAX_OWN_SENSES,
  MAX_RELATED,
  MAX_TIP,
  type OwnSense,
  type UserExample,
} from "../../store/store";
import {
  getEntriesByLemma,
  getEntryById,
  getLexdbFixtures,
  loadEntryShard,
  loadFormsShard,
  loadMeta,
  loadSuggest,
  loadZhShard,
} from "./load";
import { lexdbFold, lexdbKey, zhBucket, type LexEntry, type LexSuggestRow } from "./types";

export interface ResolveResult {
  entries: LexEntry[];
  matchedVia: "exact" | "form" | "phrase" | "none";
  formTarget?: string;
}

export interface ZhHit {
  id: string;
  rank: number;
  term: string;
  w?: string;
  shortZh?: string;
}

export interface SearchDictOptions {
  suggestLimit?: number;
  zhLimit?: number;
  dymLimit?: number;
}

export interface SearchDictResult {
  query: string;
  isCjk: boolean;
  matchedVia: ResolveResult["matchedVia"];
  formTarget?: string;
  entries: LexEntry[];
  suggestions: LexSuggestRow[];
  didYouMean: LexSuggestRow[];
  zhHits: ZhHit[];
}

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const UNRANKED = 99999;

/** Detect whether a query contains CJK characters (routed to Chinese reverse lookup). */
export function isCjkQuery(q: string): boolean {
  return CJK_RE.test(q);
}

const cleanQuery = (q: string) => q.trim().replace(/[’‘]/g, "'").replace(/\s+/g, " ");
const rankOf = (e: { rank?: number }) => (typeof e.rank === "number" ? e.rank : UNRANKED);

/** Prefix-first, then substring suggestions over suggest.json sorted by rank ascending. */
export async function suggest(q: string, limit = 20): Promise<LexSuggestRow[]> {
  const raw = cleanQuery(q);
  const f = lexdbFold(raw);
  if (!f || limit <= 0) return [];
  const rows = await loadSuggest();
  if (!rows?.length) return [];

  const typedLower = raw.toLowerCase();
  const exact: LexSuggestRow[] = [];
  const prefix: LexSuggestRow[] = [];
  const sub: LexSuggestRow[] = [];

  for (const row of rows) {
    const rf = row[0];
    if (rf === f) {
      exact.push(row);
    } else if (rf.startsWith(f)) {
      prefix.push(row);
    } else if (rf.includes(f)) {
      sub.push(row);
    }
  }

  exact.sort(
    (a, b) =>
      (a[1].toLowerCase() === typedLower ? 0 : 1) - (b[1].toLowerCase() === typedLower ? 0 : 1) ||
      a[2] - b[2] ||
      a[0].localeCompare(b[0]),
  );
  const byRank = (a: LexSuggestRow, b: LexSuggestRow) => a[2] - b[2] || a[0].localeCompare(b[0]);
  prefix.sort(byRank);
  sub.sort(byRank);

  return [...exact, ...prefix, ...sub].slice(0, limit);
}

async function resolveFormLemmas(folded: string, splits?: readonly string[]): Promise<LexEntry[]> {
  const formsShard = await loadFormsShard(lexdbKey(folded, splits));
  const targetIds = formsShard?.[folded];
  if (!targetIds?.length) return [];

  const uniqueIds = [...new Set(targetIds)];
  const fetched = await Promise.all(
    uniqueIds.map((id) => (id.includes("#") ? getEntryById(id).then((e) => (e ? [e] : [])) : getEntriesByLemma(id))),
  );
  const out: LexEntry[] = [];
  const seen = new Set<string>();
  for (const list of fetched) {
    for (const e of list) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        out.push(e);
      }
    }
  }
  out.sort((a, b) => rankOf(a) - rankOf(b));
  return out;
}

async function resolvePhraseEntries(folded: string, splits?: readonly string[]): Promise<LexEntry[]> {
  const rawTokens = folded
    .split(/[\s'-]+/)
    .map((t) => t.replace(/[^a-z]/g, ""))
    .filter(Boolean);
  const tokens = [...new Set(rawTokens)]
    .sort((a, b) => b.length - a.length)
    .slice(0, 6);

  const shardKeys = [...new Set(tokens.map((t) => lexdbKey(t, splits)))];
  const [entryShards, formsShards] = await Promise.all([
    Promise.all(shardKeys.map((k) => loadEntryShard(k))),
    Promise.all(shardKeys.map((k) => loadFormsShard(k))),
  ]);

  const candidates = new Map<string, LexEntry>();
  for (const shard of entryShards) {
    if (!shard) continue;
    for (const entry of Object.values(shard)) {
      if (entry.phrases?.length) candidates.set(entry.id, entry);
    }
  }

  const formTargets = new Set<string>();
  for (let i = 0; i < shardKeys.length; i++) {
    const fShard = formsShards[i];
    if (!fShard) continue;
    for (const tok of tokens) {
      if (lexdbKey(tok, splits) !== shardKeys[i]) continue;
      for (const target of fShard[tok] ?? []) formTargets.add(target);
    }
  }
  if (formTargets.size) {
    const resolved = await Promise.all(
      [...formTargets].map((id) =>
        id.includes("#") ? getEntryById(id).then((e) => (e ? [e] : [])) : getEntriesByLemma(id),
      ),
    );
    for (const list of resolved) {
      for (const entry of list) {
        if (entry.phrases?.length) candidates.set(entry.id, entry);
      }
    }
  }

  for (const entry of getLexdbFixtures()) {
    if (entry.phrases?.length) candidates.set(entry.id, entry);
  }

  const exactMatches: LexEntry[] = [];
  const partialMatches: LexEntry[] = [];
  const isMultiWord = rawTokens.length >= 2;

  for (const entry of candidates.values()) {
    const phrases = entry.phrases ?? [];
    if (phrases.some((p) => lexdbFold(p.fr) === folded)) {
      exactMatches.push(entry);
    } else if (isMultiWord && phrases.some((p) => lexdbFold(p.fr).includes(folded))) {
      partialMatches.push(entry);
    }
  }

  if (exactMatches.length) {
    exactMatches.sort((a, b) => rankOf(a) - rankOf(b));
    return exactMatches;
  }
  if (partialMatches.length) {
    partialMatches.sort((a, b) => rankOf(a) - rankOf(b));
    return partialMatches;
  }

  // Fallback: standalone phrase row present in suggest.json without a shard entry
  const suggestRows = await loadSuggest();
  const row = suggestRows?.find((r) => r[0] === folded && r[3]);
  if (row) {
    return [
      {
        id: row[0],
        w: row[1],
        rank: row[2],
        pos: [{ p: "loc.", senses: [{ zh: row[3], src: ["wikt-fr"], conf: 1 }] }],
        sources: ["wikt-fr"],
      },
    ];
  }

  return [];
}

function dedupeEntries(lists: readonly (readonly LexEntry[])[]): LexEntry[] {
  const out: LexEntry[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const entry of list) {
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        out.push(entry);
      }
    }
  }
  return out;
}

/** Resolve a French word, inflected form, or multi-word phrase into LexEntry results. */
export async function resolve(q: string): Promise<ResolveResult> {
  const raw = cleanQuery(q);
  const folded = lexdbFold(raw);
  if (!folded || folded.length > 80) return { entries: [], matchedVia: "none" };

  const meta = await loadMeta();
  const splits = meta?.splits;
  const typed = raw.toLowerCase();
  const hasAccentTyped = typed !== folded;

  const [direct, viaForm] = await Promise.all([getEntriesByLemma(folded), resolveFormLemmas(folded, splits)]);
  direct.sort((a, b) => rankOf(a) - rankOf(b));
  const accentExact = direct.filter((e) => e.w.toLowerCase() === typed);
  const loose = direct.filter((e) => e.w.toLowerCase() !== typed);

  const isStandalonePhrase =
    /\s/.test(folded) && direct.length > 0 && direct.every((e) => e.pos.some((p) => p.p.startsWith("loc")));

  if (accentExact.length > 0) {
    return {
      entries: dedupeEntries([accentExact, viaForm, loose]),
      matchedVia: isStandalonePhrase ? "phrase" : "exact",
    };
  }

  if (viaForm.length > 0 && (loose.length === 0 || hasAccentTyped)) {
    return {
      entries: dedupeEntries([viaForm, loose]),
      matchedVia: "form",
      formTarget: viaForm[0].w,
    };
  }

  if (loose.length > 0) {
    return {
      entries: dedupeEntries([accentExact, viaForm, loose]),
      matchedVia: isStandalonePhrase ? "phrase" : "exact",
    };
  }

  if (/[\s'-]/.test(folded)) {
    const phraseEntries = await resolvePhraseEntries(folded, splits);
    if (phraseEntries.length > 0) {
      return { entries: phraseEntries, matchedVia: "phrase" };
    }
  }

  return { entries: [], matchedVia: "none" };
}

interface SuggestIndex {
  byId: Map<string, LexSuggestRow>;
  byLen: Map<number, LexSuggestRow[]>;
  byFirstLen: Map<string, Map<number, LexSuggestRow[]>>;
}

const suggestIndexCache = new WeakMap<LexSuggestRow[], SuggestIndex>();

function getSuggestIndex(rows: LexSuggestRow[]): SuggestIndex {
  const cached = suggestIndexCache.get(rows);
  if (cached) return cached;

  const byId = new Map<string, LexSuggestRow>();
  const byLen = new Map<number, LexSuggestRow[]>();
  const byFirstLen = new Map<string, Map<number, LexSuggestRow[]>>();

  for (const row of rows) {
    const f = row[0];
    const existing = byId.get(f);
    if (!existing || row[2] < existing[2]) byId.set(f, row);

    let lenList = byLen.get(f.length);
    if (!lenList) {
      lenList = [];
      byLen.set(f.length, lenList);
    }
    lenList.push(row);

    const first = f[0] ?? "";
    let firstMap = byFirstLen.get(first);
    if (!firstMap) {
      firstMap = new Map();
      byFirstLen.set(first, firstMap);
    }
    let bucket = firstMap.get(f.length);
    if (!bucket) {
      bucket = [];
      firstMap.set(f.length, bucket);
    }
    bucket.push(row);
  }

  const index = { byId, byLen, byFirstLen };
  suggestIndexCache.set(rows, index);
  return index;
}

/** Chinese reverse lookup via zh/<bucket>.json, falling back to suggest.json shortZh when shard misses. */
export async function zhLookup(q: string, limit = 30): Promise<ZhHit[]> {
  const term = q.trim();
  if (!term || limit <= 0) return [];

  const [shard, suggestRows] = await Promise.all([loadZhShard(zhBucket(term)), loadSuggest()]);
  const byId = suggestRows?.length ? getSuggestIndex(suggestRows).byId : null;

  const toHit = (id: string, rank: number, matchedTerm: string): ZhHit => {
    const row = byId?.get(id) ?? byId?.get(id.replace(/#\d+$/, ""));
    return {
      id,
      rank,
      term: matchedTerm,
      ...(row ? { w: row[1], shortZh: row[3] } : {}),
    };
  };

  const hits: ZhHit[] = [];
  const seen = new Set<string>();
  const pushHit = (hit: ZhHit) => {
    if (seen.has(hit.id)) return;
    seen.add(hit.id);
    hits.push(hit);
  };

  const exactShardRows = shard?.[term];
  if (shard) {
    if (exactShardRows?.length) {
      const sorted = [...exactShardRows].sort((a, b) => a[1] - b[1]);
      for (const [id, rank] of sorted) pushHit(toHit(id, rank, term));
    }

    const prefixEntries: { id: string; rank: number; k: string }[] = [];
    const subEntries: { id: string; rank: number; k: string }[] = [];
    for (const [k, pairs] of Object.entries(shard)) {
      if (k === term) continue;
      if (k.startsWith(term)) {
        for (const [id, rank] of pairs) prefixEntries.push({ id, rank, k });
      } else if (k.includes(term)) {
        for (const [id, rank] of pairs) subEntries.push({ id, rank, k });
      }
    }
    prefixEntries.sort((a, b) => a.rank - b.rank);
    subEntries.sort((a, b) => a.rank - b.rank);
    for (const item of prefixEntries) pushHit(toHit(item.id, item.rank, item.k));
    for (const item of subEntries) pushHit(toHit(item.id, item.rank, item.k));
  }

  if (!exactShardRows?.length && suggestRows?.length && hits.length < limit) {
    const segExact: ZhHit[] = [];
    const segPrefix: ZhHit[] = [];
    const segSub: ZhHit[] = [];

    for (const row of suggestRows) {
      const [id, w, rank, shortZh] = row;
      if (!shortZh || seen.has(id) || !shortZh.includes(term)) continue;
      const segs = shortZh
        .split(/[；;，,、/（）()]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (shortZh === term || segs.includes(term)) {
        segExact.push({ id, rank, term, w, shortZh });
      } else if (segs.some((s) => s.startsWith(term))) {
        segPrefix.push({ id, rank, term, w, shortZh });
      } else {
        segSub.push({ id, rank, term, w, shortZh });
      }
    }

    const byRank = (a: ZhHit, b: ZhHit) => a.rank - b.rank;
    segExact.sort(byRank);
    segPrefix.sort(byRank);
    segSub.sort(byRank);

    for (const h of segExact) pushHit(h);
    for (const h of segPrefix) pushHit(h);
    for (const h of segSub) pushHit(h);
  }

  return hits.slice(0, limit);
}

const DL_SCRATCH_CAP = 64;
const dlScratch = new Int32Array(DL_SCRATCH_CAP * DL_SCRATCH_CAP);

/** True Damerau-Levenshtein distance with early length cutoff above `maxDist`. */
export function damerauLevenshtein(a: string, b: string, maxDist = 2): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > maxDist) return maxDist + 1;
  if (m === 0) return n <= maxDist ? n : maxDist + 1;
  if (n === 0) return m <= maxDist ? m : maxDist + 1;

  const cols = n + 2;
  const needed = (m + 2) * cols;
  const d = m + 2 <= DL_SCRATCH_CAP && cols <= DL_SCRATCH_CAP ? dlScratch : new Int32Array(needed);
  const maxCost = m + n;

  d[0] = maxCost;
  for (let i = 0; i <= m; i++) {
    d[(i + 1) * cols] = maxCost;
    d[(i + 1) * cols + 1] = i;
  }
  for (let j = 0; j <= n; j++) {
    d[j + 1] = maxCost;
    d[cols + j + 1] = j;
  }

  const da = new Map<number, number>();
  for (let i = 1; i <= m; i++) {
    let db = 0;
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const bj = b.charCodeAt(j - 1);
      const i1 = da.get(bj) ?? 0;
      const j1 = db;
      let cost = 1;
      if (ai === bj) {
        cost = 0;
        db = j;
      }
      const idx = (i + 1) * cols + (j + 1);
      const sub = d[i * cols + j] + cost;
      const ins = d[(i + 1) * cols + j] + 1;
      const del = d[i * cols + (j + 1)] + 1;
      const trans = d[i1 * cols + j1] + (i - i1 - 1) + 1 + (j - j1 - 1);
      d[idx] = Math.min(sub, ins, del, trans);
    }
    da.set(ai, i);
  }

  const res = d[(m + 1) * cols + (n + 1)];
  return res <= maxDist ? res : maxDist + 1;
}

/** Suggest close spellings (Damerau-Levenshtein <= 2) sorted by edit distance then rank. */
export async function didYouMean(q: string, limit = 5): Promise<LexSuggestRow[]> {
  const f = lexdbFold(q);
  if (f.length < 2 || limit <= 0) return [];
  const rows = await loadSuggest();
  if (!rows?.length) return [];

  const index = getSuggestIndex(rows);
  const minLen = Math.max(1, f.length - 2);
  const maxLen = f.length + 2;

  const hits: { row: LexSuggestRow; dist: number }[] = [];
  const seen = new Set<string>();

  const testRow = (row: LexSuggestRow) => {
    const cf = row[0];
    if (cf === f) return;
    const key = `${cf}|${row[1]}`;
    if (seen.has(key)) return;
    if (f.length >= 3 && cf.length >= 3) {
      const f0 = f[0],
        f1 = f[1],
        f2 = f[2];
      const c0 = cf[0],
        c1 = cf[1],
        c2 = cf[2];
      if (c0 !== f0 && c0 !== f1 && c0 !== f2 && c1 !== f0 && c1 !== f1 && c1 !== f2 && c2 !== f0 && c2 !== f1 && c2 !== f2) {
        return;
      }
    }
    const dist = damerauLevenshtein(f, cf, 2);
    if (dist > 0 && dist <= 2) {
      seen.add(key);
      hits.push({ row, dist });
    }
  };

  if (f.length <= 8) {
    for (let len = minLen; len <= maxLen; len++) {
      for (const row of index.byLen.get(len) ?? []) testRow(row);
    }
  } else {
    const firstMap = index.byFirstLen.get(f[0]);
    if (firstMap) {
      for (let len = minLen; len <= maxLen; len++) {
        for (const row of firstMap.get(len) ?? []) testRow(row);
      }
    }
    if (!hits.length && f[1]) {
      const secondMap = index.byFirstLen.get(f[1]);
      if (secondMap) {
        for (let len = minLen; len <= maxLen; len++) {
          for (const row of secondMap.get(len) ?? []) testRow(row);
        }
      }
    }
  }

  hits.sort((a, b) => a.dist - b.dist || a.row[2] - b.row[2] || a.row[0].localeCompare(b.row[0]));
  return hits.slice(0, limit).map((h) => h.row);
}

/** Unified dictionary search: CJK routes to zhLookup, French runs resolve + suggest (+ didYouMean on miss). */
export async function searchDict(q: string, options?: SearchDictOptions): Promise<SearchDictResult> {
  const query = cleanQuery(q);
  if (!query) {
    return {
      query: "",
      isCjk: false,
      matchedVia: "none",
      entries: [],
      suggestions: [],
      didYouMean: [],
      zhHits: [],
    };
  }

  if (isCjkQuery(query)) {
    const zhHits = await zhLookup(query, options?.zhLimit);
    return {
      query,
      isCjk: true,
      matchedVia: "none",
      entries: [],
      suggestions: [],
      didYouMean: [],
      zhHits,
    };
  }

  const [resolved, suggestions] = await Promise.all([resolve(query), suggest(query, options?.suggestLimit)]);
  const dym = resolved.entries.length === 0 ? await didYouMean(query, options?.dymLimit) : [];
  return {
    query,
    isCjk: false,
    matchedVia: resolved.matchedVia,
    ...(resolved.formTarget ? { formTarget: resolved.formTarget } : {}),
    entries: resolved.entries,
    suggestions,
    didYouMean: dym,
    zhHits: [],
  };
}

/** Convert a LexEntry into a WordForm / addToDeck compatible Seed. */
export function entryToSeed(entry: LexEntry, options?: { customGloss?: string }): Seed {
  const flatSenses = entry.pos.flatMap((blk) =>
    blk.senses.map((s) => ({
      pos: blk.p.trim().slice(0, 16),
      zh: s.zh.trim().slice(0, 300),
      ex: s.ex ?? [],
    })),
  );

  const custom = options?.customGloss?.trim().slice(0, 300);
  let pos = (entry.pos[0]?.p ?? "").trim().slice(0, 16);
  let zh = "";
  let senses: OwnSense[] = [];

  if (custom) {
    zh = custom;
    const matched = flatSenses.find((s) => s.zh === custom);
    if (matched?.pos) pos = matched.pos;
    senses = flatSenses
      .filter((s) => s.zh && s.zh !== custom)
      .slice(0, MAX_OWN_SENSES)
      .map((s) => ({ pos: s.pos, zh: s.zh }));
  } else {
    const firstIdx = flatSenses.findIndex((s) => s.zh);
    const first = firstIdx >= 0 ? flatSenses[firstIdx] : flatSenses[0];
    if (first) {
      if (first.pos) pos = first.pos;
      zh = first.zh;
      senses = flatSenses
        .slice(firstIdx >= 0 ? firstIdx + 1 : 1)
        .filter((s) => s.zh)
        .slice(0, MAX_OWN_SENSES)
        .map((s) => ({ pos: s.pos, zh: s.zh }));
    }
  }

  const seenEx = new Set<string>();
  const ex: UserExample[] = [];
  for (const s of flatSenses) {
    for (const item of s.ex) {
      const fr = item.fr.trim().slice(0, 400);
      if (!fr || seenEx.has(fr)) continue;
      seenEx.add(fr);
      const outEx: UserExample = { fr, zh: item.zh.trim().slice(0, 400) };
      if (item.src === "tatoeba") outEx.src = "tatoeba";
      if (
        item.hl &&
        Number.isInteger(item.hl[0]) &&
        Number.isInteger(item.hl[1]) &&
        item.hl[0] >= 0 &&
        item.hl[0] < item.hl[1] &&
        item.hl[1] <= fr.length
      ) {
        outEx.hl = [item.hl[0], item.hl[1]];
      }
      ex.push(outEx);
      if (ex.length >= MAX_EXAMPLES) break;
    }
    if (ex.length >= MAX_EXAMPLES) break;
  }

  const colSeen = new Set<string>();
  const col: string[] = [];
  for (const p of entry.phrases ?? []) {
    const f = p.fr.trim().slice(0, 100);
    if (!f) continue;
    const z = p.zh.trim().slice(0, 50);
    const pair = z ? `${f}｜${z}` : f;
    if (colSeen.has(pair)) continue;
    colSeen.add(pair);
    col.push(pair);
    if (col.length >= MAX_COLLOCATIONS) break;
  }

  const dedupeList = (items: readonly string[] | undefined, maxLen: number, cap: number): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const rawItem of items ?? []) {
      const clean = rawItem.trim().slice(0, maxLen);
      if (!clean || seen.has(clean)) continue;
      seen.add(clean);
      out.push(clean);
      if (out.length >= cap) break;
    }
    return out;
  };

  return {
    w: entry.w.trim().slice(0, 80),
    pos,
    zh,
    ipa: entry.ipa?.trim().slice(0, 80) ?? "",
    senses,
    ex,
    col,
    fam: dedupeList(entry.derived, 80, MAX_RELATED),
    syn: dedupeList(entry.syn, 120, MAX_RELATED),
    ant: dedupeList(entry.ant, 120, MAX_RELATED),
    note: entry.etym ? entry.etym.trim().slice(0, MAX_TIP) : "",
  };
}
