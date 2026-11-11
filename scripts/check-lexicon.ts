/* Integrity report for data/lexicon.json: counts by level/origin/review, plus the structural checks.
 * Usage: npm run lexicon:check   (exit 1 on any problem) */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkLexicon } from "./lexicon/core.ts";
import { LEVELS, type Lexicon } from "./lexicon/types.ts";

const lex: Lexicon = JSON.parse(readFileSync(resolve(import.meta.dirname, "../data/lexicon.json"), "utf8"));
const count = <T extends string>(xs: T[]) => xs.reduce<Record<string, number>>((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {});
const byLevel = count(lex.entries.map((e) => e.level));
const byReview = count(lex.entries.map((e) => e.review));
const byOrigin = count(lex.entries.map((e) => (e.senses.every((s) => s.origin === "book") ? "book" : e.senses.some((s) => s.origin === "book") ? "mixed" : "supplement")));
console.log(`entries=${lex.entries.length}`);
console.log("by level:", LEVELS.map((l) => `${l}=${byLevel[l] ?? 0}`).join("  "));
console.log("by origin:", JSON.stringify(byOrigin));
console.log("by review:", JSON.stringify(byReview));
const problems = checkLexicon(lex);
if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`FAIL: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log("OK: lexicon integrity checks passed");
