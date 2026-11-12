/** Reading voice. The names come from the English atlas; in French "uk" is the female voice (Denise), "us" the male (Henri). */
export type Accent = "uk" | "us";

/** Compact row from atlas/index.json: [id, word, zh, ipa, cefr, topic, media, gender, other-sense glosses]. gender: "m" | "f" | "" (un/une quiz). */
export type IndexRow = [string, string, string, string, number, number, number, ("m" | "f" | "")?, string[]?];

export interface Sense {
  pos: string;
  zh: string;
  en: string;
  /** "supplement" marks text not taken from a source book. */
  origin?: "book" | "supplement";
  /** e.g. "补充翻译·待对照": verification state of the gloss. */
  status?: string;
  /** On a card the learner changed: which of the atlas's own senses this is (0 = the first). Absent on a sense they added. */
  n?: number;
}

export interface Example {
  en: string;
  zh: string;
  /** "mine": written by the learner; "tatoeba": from the offline dictionary (Tatoeba, CC BY 2.0 FR). */
  origin?: "book" | "supplement" | "mine" | "tatoeba";
  /** Where the headword (or its inflected form) sits in `en`: [start, end), from scripts/build-highlights.py. */
  hl?: [number, number];
}

/** Where an entry comes from: a file in references/books and a page (printed page and PDF index). */
export interface SourceRef {
  book: string;
  kind: "index" | "theme-list" | "lesson" | "author-supplement";
  chapter?: string;
  printedPage?: number;
  pdfPage?: number;
}

export interface Entry {
  id: string;
  w: string;
  uk: string;
  us: string;
  senses: Sense[];
  ex: Example[];
  col: string[];
  fam: string[];
  syn: string[];
  ant: string[];
  tip: string;
  cefr: string;
  topic: string;
  /** Usage caution (register, offensiveness, spelling), shown with the entry. */
  note?: string;
  /** Media bit flags, see MEDIA. */
  m: number;
  /** Sources the entry was taken from. */
  sources?: SourceRef[];
  /** "estimated": band inferred from the source books' stated level (推定), not checked per word. */
  levelStatus?: "estimated" | "unverified" | "verified";
  /** Why this level was assigned (or why it is not yet verified). */
  levelBasis?: string;
  /** Indefinite article shown before a noun: "un" | "une" | "un/une" | "des" (plural headword). */
  art?: string;
  /** Gender asked by the un/une quiz; absent when the noun is not quizzed (pairs, plurals, disputed gender). */
  g?: "m" | "f";
  /** Masculine / feminine forms of a pair (ami / amie), with plurals. */
  forms?: { m: string; f: string; mPl: string; fPl: string };
  /** Forms a learner cannot guess (scripts/build-forms.py): noun plural, adjective feminine / masculine plural, adjective place. */
  infl?: { pl?: string; fem?: string; mpl?: string; place?: string };
  /** "unreviewed": not yet checked line by line against its source. */
  review?: "unreviewed" | "checked";
  /** The learner chose 不要图片 for this word: the card shows no picture or text plate. */
  noImg?: boolean;
  /** Absolute media URLs for datasets that do not follow the atlas layout. */
  media?: { img?: string | null; uk?: string | null; us?: string | null; ex?: string | null; ex2?: string | null };
}

/**
 * Media bit flags. Recordings (scripts/build-audio.py → public/atlas/audio/<dir>/<id>.mp3):
 * uk / us = headword, female / male voice (dirs f / m); ex / ex2 = first / second example, female (ex-f / ex2-f);
 * exM / ex2M = the same examples, male (ex-m / ex2-m).
 */
export const MEDIA = { img: 1, uk: 2, us: 4, ex: 8, ex2: 16, exM: 32, ex2M: 64 } as const;

export interface WordRef {
  id: string;
  word: string;
  zh: string;
  ipa: string;
  cefr: number;
  topic: number;
  media: number;
  /** Position in the learning path. */
  order: number;
  /** Gender for the un/une quiz (nouns only). */
  g?: "m" | "f";
  /** Glosses of the other senses of a polysemous word (zh is the first sense). */
  more?: string[];
  /** A word the learner created (not in the atlas word list; order is -1, cefr and topic are -1). */
  custom?: true;
}

export interface Atlas {
  id: string;
  name: string;
  kind: "open" | "private";
  count: number;
  examples: number;
  illustrated: number;
  topics: [string, string][];
  cefr: string[];
  /** alias id → primary id (duplicate words). */
  aliases?: Record<string, string>;
  /** ids of entries that have a masculine / feminine pair (ami / amie). */
  pairs?: Set<string>;
  words: WordRef[];
  /** Words the learner created; in byId and search, not in the learning path (words). */
  custom?: WordRef[];
  byId: Map<string, WordRef>;
  /** Loads full entries; chunked for the open atlas, in-memory for private sets. */
  entry: (id: string) => Promise<Entry>;
  peek: (id: string) => Entry | undefined;
  img: (ref: WordRef | Entry, size?: "thumb" | "full") => string | null;
  /** Recording of the headword ("uk" / "us": female / male) or an example ("ex" / "ex2") in the given voice.
   * Falls back to the other voice's recording while one voice is not generated yet. */
  audio: (ref: WordRef | Entry, kind: "uk" | "us" | "ex" | "ex2", voice?: Accent) => string | null;
}
