/* Verifies that every id in the snapshot still exists with the same lemma.
 * Learning progress is keyed by id, so a changed or deleted id would orphan a learner's cards.
 * Usage: npm run lexicon:ids -- --snapshot   (write data/id-snapshot.json)
 *        npm run lexicon:ids                  (check against it) */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Lexicon } from "./lexicon/types.ts";

const root = resolve(import.meta.dirname, "..");
const lex: Lexicon = JSON.parse(readFileSync(resolve(root, "data/lexicon.json"), "utf8"));
const snapPath = resolve(root, "data/id-snapshot.json");
const current = Object.fromEntries(lex.entries.map((e) => [e.id, e.lemma]));
if (process.argv.includes("--snapshot")) {
  writeFileSync(snapPath, JSON.stringify({ taken: new Date().toISOString(), count: lex.entries.length, ids: current }, null, 1));
  console.log(`snapshot written: ${lex.entries.length} ids`);
  process.exit(0);
}
if (!existsSync(snapPath)) { console.error("no snapshot; run with --snapshot first"); process.exit(2); }
const snap = JSON.parse(readFileSync(snapPath, "utf8"));
const missing = Object.keys(snap.ids).filter((id) => !(id in current));
const changed = Object.keys(snap.ids).filter((id) => id in current && current[id] !== snap.ids[id]);
console.log(`snapshot ${snap.taken}: ${Object.keys(snap.ids).length} ids; now ${lex.entries.length}; missing=${missing.length}; lemma changed=${changed.length}`);
if (missing.length || changed.length) { console.error(JSON.stringify({ missing: missing.slice(0, 20), changed: changed.slice(0, 20) }, null, 1)); process.exit(1); }
console.log("OK: every snapshot id is still present with the same lemma");
