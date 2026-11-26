/** Bundled sample entries (accueil, prendre, beau): offline fallback for the dictionary and word popup, and test data. */
import accueilFixture from "./fixtures/accueil.json";
import beauFixture from "./fixtures/beau.json";
import prendreFixture from "./fixtures/prendre.json";
import type { LexEntry } from "./types";

export const LEXDB_FIXTURES: readonly LexEntry[] = [
  accueilFixture as LexEntry,
  prendreFixture as LexEntry,
  beauFixture as LexEntry,
];
