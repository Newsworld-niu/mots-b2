/** Canonical lexicon model. data/lexicon.json is the single source of truth; public/atlas is generated from it. */

/** A1–C2 are CEFR bands. "unverified" means the level has not been checked for this entry. */
export const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "unverified"] as const;
export type Level = (typeof LEVELS)[number];

/** Parts of speech accepted by the importer. Nouns keep gender because it is part of identity. */
/** "n." = noun whose gender the source does not give; "待核实" = part of speech not yet determined. */
export const POS = ["n.m.", "n.f.", "n.m./f.", "n.", "v.", "adj.", "adv.", "loc.", "loc. adv.", "prép.", "conj.", "pron.", "interj.", "待核实"] as const;
export type Pos = (typeof POS)[number];

/** "book": text taken from a source file. "supplement": written for this site, not in a source file. */
export type Origin = "book" | "supplement";

export interface Sense {
  zh: string;
  /** Short French definition; may be empty when the source has none. */
  fr: string;
  /** Where the Chinese gloss comes from: "book" (text of the source) or "supplement" (written for this site). */
  origin: Origin;
  /** e.g. "补充翻译·待对照"; shown next to the gloss. */
  status?: string;
  /** Part of speech of this sense when it differs from the card's (the card lists every meaning of its spelling). */
  pos?: Pos;
}

export interface Example {
  fr: string;
  zh: string;
  origin: Origin;
}

export interface Source {
  /** File name under references/books/, or "author-supplement". */
  book: string;
  kind: "index" | "theme-list" | "lesson" | "author-supplement";
  chapter?: string;
  /** Page number printed on the page itself. */
  printedPage?: number;
  /** 1-based PDF page index. */
  pdfPage?: number;
}

export interface LexEntry {
  id: string;
  lemma: string;
  pos: Pos;
  level: Level;
  /** Why this level was assigned, e.g. the source book's stated target level. */
  levelBasis: string;
  topic: string;
  senses: Sense[];
  examples: Example[];
  col: string[];
  fam: string[];
  syn: string[];
  ant: string[];
  tip: string;
  register?: "soutenu" | "courant" | "familier";
  note?: string;
  sources: Source[];
  /** "unreviewed": content not yet checked by a person against its source. */
  review: "unreviewed" | "checked";
  /** Alias: this id is a duplicate of the entry named here. Kept (never deleted) so learning records stay reachable; not shown in the atlas. */
  aliasOf?: string;
  /** Masculine / feminine forms of a pair (ami / amie). Display only; pair words get no article-dependent quiz. */
  forms?: { m: string; f: string; mPl: string; fPl: string };
}

export interface Lexicon {
  version: 1;
  entries: LexEntry[];
}

/** One row of an import file, flattened (CSV) or as written in JSON. Lists use "|" in CSV. */
export interface ImportRow {
  id?: string;
  lemma: string;
  pos: string;
  level: string;
  level_basis?: string;
  topic: string;
  zh: string;
  fr_def?: string;
  example_fr?: string;
  example_zh?: string;
  col?: string | string[];
  fam?: string | string[];
  syn?: string | string[];
  ant?: string | string[];
  tip?: string;
  note?: string;
  origin: string;
  /** Origin of the Chinese gloss when it differs from the row origin (e.g. a book example with a supplement translation). */
  zh_origin?: string;
  zh_status?: string;
  book: string;
  kind?: string;
  chapter?: string;
  printed_page?: string | number;
  pdf_page?: string | number;
  review?: string;
}
