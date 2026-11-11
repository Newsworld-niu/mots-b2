/**
 * Level estimate ("推定") for a word, from the stated level of its source books.
 * The estimate is the LOWEST band named by any source (a word met in an A2–B1 book is at least B1-ish
 * for the learner's path). It is never reported as the word's official level.
 */
export const BANDS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type Band = (typeof BANDS)[number];

/** "B2/C1" → ["B2","C1"]; "A2 B1" / "A2–B1" → ["A2","B1"]; "B1" → ["B1"]; anything else → []. */
export function bandsIn(stated: string): Band[] {
  return (stated.match(/A1|A2|B1|B2|C1|C2/g) ?? []) as Band[];
}

export function estimateFromSources(stated: (string | undefined)[]): Band | null {
  const found = stated.flatMap((s) => bandsIn(s ?? ""));
  if (!found.length) return null;
  return found.reduce((lo, b) => (BANDS.indexOf(b) < BANDS.indexOf(lo) ? b : lo));
}

/* ---- Book span + corpus frequency --------------------------------------------------------------------------------
 * A book states one target level, but the learner's bands need more resolution: the A1 book runs into A2, the A2–B1
 * book spans two bands, and a frequent word is easier than the book that happens to list it. So:
 *   1. the word's span is the one of its source books that starts lowest (a word in the A1 book is A1–A2);
 *   2. a one-band span is that band; a two-band span is split by how common the word is in French (Lexique 3.83);
 *   3. a book band is then only ever lowered when the word is very common (FREQ_CAP).
 * The result is a 推定 (estimate), never an official level.
 */
export type Span = readonly [Band, Band];

/** Per million words (mean of the subtitle and book corpora). At or above the value the word takes the lower band of the span. */
export const SPLIT_AT: Record<string, number> = { "A1-A2": 20, "A2-B1": 30 };

/** At or above: the word is at most this band, whatever the book says. */
export const FREQ_CAP: [number, Band][] = [
  [300, "A1"],
  [100, "A2"],
  [30, "B1"],
];

const idx = (b: Band) => BANDS.indexOf(b);

/** The span of the lowest-starting book; falls back to the book's single stated band. */
export function spanOf(spans: (Span | undefined)[]): Span | null {
  const known = spans.filter((s): s is Span => !!s);
  if (!known.length) return null;
  return known.reduce((lo, s) => (idx(s[0]) < idx(lo[0]) ? s : lo));
}

export type LevelHow = "book" | "split-common" | "split-rare" | "split-unknown" | "freq-cap";
export interface LevelResult {
  band: Band;
  how: LevelHow;
  span: Span;
  /** band before the frequency cap lowered it */
  from?: Band;
}

/** `f`: corpus frequency per million, or null when it cannot be measured (expressions, unmatched words). */
export function estimateLevel(spans: (Span | undefined)[], f: number | null): LevelResult | null {
  const span = spanOf(spans);
  if (!span) return null;
  let band: Band = span[0];
  let how: LevelHow = "book";
  if (span[0] !== span[1]) {
    const at = SPLIT_AT[`${span[0]}-${span[1]}`] ?? Infinity;
    if (f === null) {
      // unmeasurable: a phrase in the lower book is as basic as the book; in the upper book as hard
      band = span[0] === "A1" ? span[0] : span[1];
      how = "split-unknown";
    } else if (f >= at) {
      band = span[0];
      how = "split-common";
    } else {
      band = span[1];
      how = "split-rare";
    }
  }
  if (f !== null) {
    const cap = FREQ_CAP.find(([min]) => f >= min)?.[1];
    if (cap && idx(band) > idx(cap)) return { band: cap, how: "freq-cap", span, from: band };
  }
  return { band, how, span };
}
