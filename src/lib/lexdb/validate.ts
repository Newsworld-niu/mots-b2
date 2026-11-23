import type {
  LexEntry,
  LexFormsShard,
  LexMeta,
  LexPos,
  LexSense,
  LexShard,
  LexSuggestRow,
  LexZhShard,
} from "./types";

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

const isStr = (v: unknown): v is string => typeof v === "string";
const isNonEmptyStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isFiniteNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function isValidSense(v: unknown): v is LexSense {
  if (!isObj(v) || !isStr(v.zh)) return false;
  if (v.fr !== undefined && !isStr(v.fr)) return false;
  if (v.reg !== undefined && !isStr(v.reg)) return false;
  if (v.ex !== undefined && !Array.isArray(v.ex)) return false;
  if (v.src !== undefined && (!Array.isArray(v.src) || !v.src.every(isNonEmptyStr))) return false;
  if (v.conf !== undefined && !isFiniteNum(v.conf)) return false;
  return true;
}

function isValidPos(v: unknown): v is LexPos {
  if (!isObj(v) || !isStr(v.p) || !Array.isArray(v.senses)) return false;
  if (v.g !== undefined && v.g !== "m" && v.g !== "f" && v.g !== "mf") return false;
  return v.senses.every(isValidSense);
}

/** Validate a fetched `/lexdb/meta.json` payload at runtime. */
export function validateLexMeta(x: unknown): LexMeta | null {
  if (!isObj(x)) return null;
  if (!isFiniteNum(x.version) || !isNonEmptyStr(x.generated)) return null;
  if (!isObj(x.sources)) return null;
  if (!Array.isArray(x.licenses) || !x.licenses.every(isStr)) return null;
  if (!Array.isArray(x.splits) || !x.splits.every(isStr)) return null;
  if (!isObj(x.counts) || !isFiniteNum(x.counts.lemmas) || !isFiniteNum(x.counts.withZh)) return null;
  if (x.suggestShards !== undefined && typeof x.suggestShards !== "boolean") return null;
  if (x.suggestSplits !== undefined && (!Array.isArray(x.suggestSplits) || !x.suggestSplits.every(isStr))) return null;
  return x as unknown as LexMeta;
}

/** Validate suggest index arrays (`[folded, word, rank, zh?]`), rejecting wholly corrupt arrays. */
export function validateSuggestRows(x: unknown): LexSuggestRow[] | null {
  if (!Array.isArray(x)) return null;
  const out: LexSuggestRow[] = [];
  for (const row of x) {
    if (!Array.isArray(row) || row.length < 3) continue;
    if (!isNonEmptyStr(row[0]) || !isNonEmptyStr(row[1]) || !isFiniteNum(row[2])) continue;
    const zh = isStr(row[3]) ? row[3] : "";
    out.push([row[0], row[1], row[2], zh]);
  }
  if (x.length > 0 && out.length === 0) return null;
  return out;
}

/** Validate a single LexEntry object. */
export function validateLexEntry(x: unknown): LexEntry | null {
  if (!isObj(x)) return null;
  if (!isNonEmptyStr(x.id) || !isNonEmptyStr(x.w)) return null;
  if (!Array.isArray(x.pos) || !x.pos.every(isValidPos)) return null;
  if (!Array.isArray(x.sources) || !x.sources.every(isNonEmptyStr)) return null;
  if (x.rank !== undefined && !isFiniteNum(x.rank)) return null;
  if (x.ipa !== undefined && !isStr(x.ipa)) return null;
  if (x.phrases !== undefined && !Array.isArray(x.phrases)) return null;
  return x as unknown as LexEntry;
}

/** Validate a lexdb entry shard (`e/<key>.json`), dropping malformed entries cleanly. */
export function validateLexShard(x: unknown): LexShard | null {
  if (!isObj(x)) return null;
  const keys = Object.keys(x);
  const out: LexShard = {};
  let kept = 0;
  for (const k of keys) {
    if (!k) continue;
    const valid = validateLexEntry(x[k]);
    if (valid) {
      out[k] = valid;
      kept++;
    }
  }
  if (keys.length > 0 && kept === 0) return null;
  return out;
}

/** Validate a lexdb inflected-forms shard (`forms/<key>.json`). */
export function validateFormsShard(x: unknown): LexFormsShard | null {
  if (!isObj(x)) return null;
  const keys = Object.keys(x);
  const out: LexFormsShard = {};
  let kept = 0;
  for (const k of keys) {
    if (!k) continue;
    const raw = x[k];
    if (!Array.isArray(raw)) continue;
    const lemmas = raw.filter(isNonEmptyStr);
    if (!lemmas.length) continue;
    out[k] = lemmas;
    kept++;
  }
  if (keys.length > 0 && kept === 0) return null;
  return out;
}

/** Validate a lexdb reverse Chinese index shard (`zh/<bucket>.json`). */
export function validateZhShard(x: unknown): LexZhShard | null {
  if (!isObj(x)) return null;
  const keys = Object.keys(x);
  const out: LexZhShard = {};
  let kept = 0;
  for (const k of keys) {
    if (!k) continue;
    const raw = x[k];
    if (!Array.isArray(raw)) continue;
    const pairs: [string, number][] = [];
    for (const item of raw) {
      if (Array.isArray(item) && item.length >= 2 && isNonEmptyStr(item[0]) && isFiniteNum(item[1])) {
        pairs.push([item[0], item[1]]);
      }
    }
    if (!pairs.length) continue;
    out[k] = pairs;
    kept++;
  }
  if (keys.length > 0 && kept === 0) return null;
  return out;
}
