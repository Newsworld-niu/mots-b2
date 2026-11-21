import { foldAccents } from "../accent";

export type SourceId =
  | "atlas"
  | "wikt-fr"
  | "wikt-zh"
  | "cfdict"
  | "omw"
  | "tatoeba"
  | "lexique"
  | "ai"
  | "ai-reviewed"
  | "user";

/** 0 unreviewed AI, 1 single source / AI reviewed, 2 two sources agree, 3 atlas or >=3 agree. */
export type Conf = 0 | 1 | 2 | 3;

export interface LexExample {
  fr: string;
  zh: string;
  hl?: [number, number];
  src: SourceId;
  ref?: string;
}

export interface LexSense {
  zh: string;
  fr?: string;
  reg?: string;
  ex?: LexExample[];
  src: SourceId[];
  conf: Conf;
}

export interface LexPos {
  p: string;
  g?: "m" | "f" | "mf";
  senses: LexSense[];
}

export interface LexPhrase {
  fr: string;
  zh: string;
  src: SourceId;
  conf: Conf;
}

export interface LexEntry {
  /** Folded lemma, plus "#2" for homographs. */
  id: string;
  w: string;
  ipa?: string;
  level?: "A1" | "A2" | "B1" | "B2";
  rank?: number;
  atlasId?: string;
  forms?: { f?: string; pl?: string; fpl?: string };
  pos: LexPos[];
  phrases?: LexPhrase[];
  syn?: string[];
  ant?: string[];
  derived?: string[];
  family?: string;
  frDefs?: { p: string; gloss: string; ex?: string }[];
  etym?: string;
  conj?: boolean;
  confusable?: string[];
  sources: SourceId[];
}

export type LexShard = Record<string, LexEntry>;
export type LexFormsShard = Record<string, string[]>;
/** Chinese term -> list of [entryId, rank] sorted by rank ascending. */
export type LexZhShard = Record<string, [string, number][]>;
/** [folded, w, rank, shortZh] */
export type LexSuggestRow = [string, string, number, string];

export interface LexMeta {
  version: number;
  generated: string;
  sources: Record<string, string>;
  licenses: string[];
  /** 2-letter prefixes split into 3-letter shards under e/ and forms/. */
  splits: string[];
  counts: {
    lemmas: number;
    withZh: number;
    top15kComplete?: number;
    pilot?: number;
    phrases?: number;
    conf?: Record<string, number>;
  };
}

/** Folded spelling, matching scripts/build-dict.py and src/lib/dict.ts. */
export const lexdbFold = (s: string) =>
  foldAccents(s.trim().replace(/[’‘]/g, "'").replace(/\s+/g, " "));

/** Base 2-letter shard key for a folded word or lemma. */
export function lexdbBaseKey(folded: string): string {
  const letters = folded.replace(/[^a-z]/g, "");
  if (!letters || !/^\p{L}/u.test(folded)) return "__";
  return (letters + "_").slice(0, 2);
}

/** Resolve actual shard key taking 3-letter prefix splits from meta.json into account. */
export function lexdbKey(folded: string, splits?: ReadonlySet<string> | readonly string[]): string {
  const base = lexdbBaseKey(folded);
  const splitSet = splits instanceof Set ? splits : splits ? new Set(splits) : null;
  if (!splitSet || !splitSet.has(base)) return base;
  const letters = folded.replace(/[^a-z]/g, "");
  return (letters + "__").slice(0, 3);
}

/** Shard bucket (0..63) for Chinese reverse lookup terms. */
export function zhBucket(term: string): number {
  const cp = term.trim().codePointAt(0);
  return cp === undefined ? 0 : cp % 64;
}
