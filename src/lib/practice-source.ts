import type { Atlas } from "../atlas/types";
import { deckWords } from "../store/decks";
import type { Progress } from "../store/store";

export type PracticeSource = "recent" | "mistakes" | "saved" | "path" | "decks";
export const PRACTICE_SOURCES: [PracticeSource, string][] = [
  ["recent", "最近学过"],
  ["mistakes", "错词本"],
  ["saved", "收藏"],
  ["path", "学习路线"],
  ["decks", "选卡组"],
];

/** Candidate words before a particular exercise filters for supported words. */
export function sourceWordIds(atlas: Atlas, p: Progress, source: PracticeSource, startLevel: number, decks: readonly string[] = []) {
  const ids = source === "recent"
    ? Object.entries(p.cards).sort((a, b) => (b[1].last ?? 0) - (a[1].last ?? 0)).map(([id]) => id)
    : source === "mistakes" ? p.mistakes
    : source === "saved" ? p.bookmarks
    : source === "decks" ? decks.flatMap(id => deckWords(atlas, p, id))
    : atlas.words.filter(w => w.cefr >= startLevel).slice(0, 400).map(w => w.id);
  return [...new Set(ids)].filter(id => atlas.byId.has(id));
}
