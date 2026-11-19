/* Move generated grammar content into the data files:
 *   data/grammar/gen/<point>.json  →  data/grammar/points.json (decide, motto, pairs, walk, prereq, related)
 *                                    data/grammar/drills.json (the point's written drills, replaced)
 *
 *   npx tsx scripts/grammar/merge-gen.ts [point …]     (no argument: every file in gen/ that passes the check)
 *
 * A file is merged only when scripts/grammar/check-gen.ts passes on it. Then run npm run lexicon:grammar.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const GEN = resolve(ROOT, "data/grammar/gen");
const POINTS = resolve(ROOT, "data/grammar/points.json");
const DRILLS = resolve(ROOT, "data/grammar/drills.json");

const ids = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(GEN).filter((f) => f.endsWith(".json") && !f.startsWith("_")).map((f) => f.slice(0, -5));
const points = JSON.parse(readFileSync(POINTS, "utf8"));
const drills = JSON.parse(readFileSync(DRILLS, "utf8"));
const FIELDS = ["decide", "motto", "pairs", "walk", "prereq", "related"] as const;

let merged = 0;
for (const id of ids) {
  const file = resolve(GEN, `${id}.json`);
  if (!existsSync(file)) {
    console.log(`- ${id}: no file`);
    continue;
  }
  try {
    execFileSync("npx", ["tsx", resolve(ROOT, "scripts/grammar/check-gen.ts"), id], { stdio: "pipe" });
  } catch (e) {
    console.log(`✗ ${id}: does not pass the check, not merged\n${String((e as { stdout?: Buffer }).stdout ?? "")}`);
    continue;
  }
  const g = JSON.parse(readFileSync(file, "utf8"));
  const p = points.points.find((x: { id: string }) => x.id === id);
  for (const f of FIELDS) {
    const v = g[f];
    if (Array.isArray(v) ? v.length : v) p[f] = v;
    else delete p[f];
  }
  drills.drills[id] = g.drills;
  merged++;
  console.log(`✓ ${id}: ${g.drills.length} drills`);
}

writeFileSync(POINTS, JSON.stringify(points, null, 1) + "\n");
// one drill per line, spaced as the file was written by hand: { "s": "…", "x": ["a", "b"] }
const flat = (v: unknown): string =>
  Array.isArray(v) ? `[${v.map(flat).join(", ")}]` : v && typeof v === "object" ? `{ ${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${flat(x)}`).join(", ")} }` : JSON.stringify(v);
const lines = Object.entries(drills.drills as Record<string, unknown[]>).map(([k, list]) => `  ${JSON.stringify(k)}: [\n${list.map((d) => `   ${flat(d)}`).join(",\n")}\n  ]`);
writeFileSync(DRILLS, `{\n "note": ${JSON.stringify(drills.note)},\n "drills": {\n${lines.join(",\n")}\n }\n}\n`);
console.log(`${merged} point(s) merged. Next: npm run lexicon:grammar`);
