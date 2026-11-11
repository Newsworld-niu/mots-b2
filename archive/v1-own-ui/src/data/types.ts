export type TopicKey =
  | "travail"
  | "environnement"
  | "societe"
  | "sante"
  | "education"
  | "economie"
  | "medias"
  | "voyage"
  | "emotions";

export interface Topic {
  key: TopicKey;
  name: string;
  /** Chinese label shown in the UI. */
  zh: string;
  /** One-line French teaser, shown on station cards. */
  tagline: string;
  /** Palette token from app.css, used for the topic's art. */
  tone: "terra" | "sage" | "sky" | "ochre" | "plum";
}

export interface Sense {
  /** Part of speech, e.g. "n.m.", "n.f.", "v.", "adj.". */
  pos: string;
  /** Chinese gloss. */
  zh: string;
  /** Short French definition, written for B2 learners. */
  fr: string;
}

export interface Example {
  fr: string;
  zh: string;
}

export interface WordEntry {
  /** URL-safe, ASCII-only identifier. */
  id: string;
  /** Headword as it is written in French (with accents). */
  w: string;
  cefr: "B2";
  topic: TopicKey;
  senses: Sense[];
  /** Two examples: ex[0] everyday, ex[1] longer, exam-style context. */
  ex: Example[];
  /** Collocations, format "fr｜zh". */
  col: string[];
  /** Word family, format "word (pos)". */
  fam: string[];
  syn: string[];
  ant: string[];
  /** One usage or false-friend hint in Chinese. */
  tip: string;
  note?: string;
}
