import { foldAccents } from "../accent";

export type SourceId =
  | "atlas"
  | "wikt-fr"
  | "wikt-zh"
  | "cfdict"
  | "omw"
  | "tatoeba"
  | "lexique"
  | "morphynet"
  | "cnrtl"
  | "frdic"
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
  /** True when suggest rows are sharded under suggest/<bucket>.json + suggest/top.json. */
  suggestShards?: boolean;
  /** 1-letter suggest prefixes split into 2-letter shards under suggest/. */
  suggestSplits?: string[];
  /** True when compact related-word hints are published under hints/<bucket>.json (see hintBucket). */
  hintsShards?: boolean;
  counts: {
    lemmas: number;
    withZh: number;
    top15kComplete?: number;
    pilot?: number;
    phrases?: number;
    withDerived?: number;
    withSyn?: number;
    withAnt?: number;
    conf?: Record<string, number>;
  };
}

/** Folded spelling, matching src/lib/dict.ts normalization. */
export const lexdbFold = (s: string) =>
  foldAccents(s.trim().replace(/[’‘]/g, "'").replace(/\s+/g, " "));

/** Base 2-letter shard key for a folded word or lemma. */
export function lexdbBaseKey(folded: string): string {
  const letters = folded.replace(/[^a-z]/g, "");
  if (!letters || !/^\p{L}/u.test(folded)) return "__";
  return (letters + "_").slice(0, 2);
}

/** Resolve actual shard key taking 2->3->4-letter prefix splits from meta.json into account. */
export function lexdbKey(folded: string, splits?: ReadonlySet<string> | readonly string[]): string {
  let key = lexdbBaseKey(folded);
  if (key === "__") return key;
  const splitSet = splits instanceof Set ? splits : splits ? new Set(splits) : null;
  if (!splitSet) return key;
  const letters = folded.replace(/[^a-z]/g, "");
  while (key.length < 4 && splitSet.has(key)) {
    key = (letters + "___").slice(0, key.length + 1);
  }
  return key;
}

/** [pos, shortZh] compact hint for a related word chip. */
export type LexHintTuple = [pos: string, shortZh: string];
/** hints/<bucket>.json: lower-cased NFC headword -> [pos, shortZh]. */
export type LexHintsShard = Record<string, LexHintTuple>;

/** 1-letter bucket for hints/<bucket>.json ("_" when the word does not start with a letter). */
export function hintBucket(word: string): string {
  const folded = lexdbFold(word);
  const letters = folded.replace(/[^a-z]/g, "");
  if (!letters || !/^\p{L}/u.test(folded)) return "_";
  return letters[0];
}

/** Shard bucket (0..63) for Chinese reverse lookup terms. */
export function zhBucket(term: string): number {
  const cp = term.trim().codePointAt(0);
  return cp === undefined ? 0 : cp % 64;
}
