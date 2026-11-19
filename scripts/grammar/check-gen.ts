/* Check one or more generated grammar files: data/grammar/gen/<point>.json
 *
 *   npx tsx scripts/grammar/check-gen.ts subj-indicatif [accord-pp …]     (no argument: every file in gen/)
 *
 * A file holds everything written for one point (see data/grammar/GEN-SPEC.md):
 *   { id, decide, motto, pairs, walk, prereq, related, drills }
 * Exit code 1 when any file has a problem.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseWritten, type Problem } from "./written.ts";

const ROOT = resolve(import.meta.dirname, "../..");
const GEN = resolve(ROOT, "data/grammar/gen");
const points: { id: string; rules: unknown[]; traps: string[] }[] = JSON.parse(readFileSync(resolve(ROOT, "data/grammar/points.json"), "utf8")).points;
const byId = new Map(points.map((p) => [p.id, p]));
const oldDrills: Record<string, { s?: string; q?: string }[]> = JSON.parse(readFileSync(resolve(ROOT, "data/grammar/drills.json"), "utf8")).drills;

const ids = process.argv.slice(2).length ? process.argv.slice(2) : existsSync(GEN) ? readdirSync(GEN).filter((f) => f.endsWith(".json") && !f.startsWith("_")).map((f) => f.slice(0, -5)) : [];
let failed = 0;
const str = (v: unknown) => typeof v === "string" && v.trim().length > 0;

for (const id of ids) {
  const problems: Problem[] = [];
  const bad = (msg: string) => problems.push({ point: id, at: "", msg });
  const file = resolve(GEN, `${id}.json`);
  const p = byId.get(id);
  if (!p) {
    console.log(`✗ ${id}: no such grammar point`);
    failed++;
    continue;
  }
  if (!existsSync(file)) {
    console.log(`✗ ${id}: ${file} does not exist`);
    failed++;
    continue;
  }
  let g: Record<string, unknown>;
  try {
    g = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.log(`✗ ${id}: not valid JSON: ${(e as Error).message}`);
    failed++;
    continue;
  }
  if (g.id !== id) bad(`id should be "${id}"`);
  const decide = g.decide as unknown[];
  if (!Array.isArray(decide) || decide.length < 2 || decide.length > 6 || !decide.every(str)) bad("decide: 2–6 non-empty steps");
  if (!str(g.motto) || (g.motto as string).length > 60) bad("motto: one line, at most 60 characters");
  const pairs = g.pairs as { a?: unknown; b?: unknown; d?: unknown }[];
  if (!Array.isArray(pairs) || pairs.length < 2 || !pairs.every((x) => x && str(x.a) && str(x.b) && str(x.d) && x.a !== x.b)) bad("pairs: at least 2 of { a, b, d }, a ≠ b");
  const walk = g.walk as { s?: unknown; z?: unknown; steps?: unknown[] };
  if (!walk || !str(walk.s) || !str(walk.z) || !Array.isArray(walk.steps) || walk.steps.length < 2 || !walk.steps.every((st) => Array.isArray(st) && st.length === 2 && str(st[0]) && str(st[1]))) bad("walk: { s, z, steps: [[question, answer], …] } with at least 2 steps");
  for (const key of ["prereq", "related"] as const) {
    const list = g[key];
    if (!Array.isArray(list)) bad(`${key}: a list of point ids ([] if none)`);
    else for (const x of list) if (typeof x !== "string" || !byId.has(x) || x === id) bad(`${key}: unknown point id ${String(x)}`);
  }

  const raw = g.drills as unknown[];
  if (!Array.isArray(raw)) bad("drills: a list");
  const drills = Array.isArray(raw) ? parseWritten(id, raw, { rules: p.rules.length, traps: p.traps.length }, problems) : [];

  // every drill tagged; every choice distractor explained
  (raw ?? []).forEach((d, n) => {
    const w = d as { g?: string; k?: string; x?: unknown[]; s?: string; q?: string };
    const at = `#${n + 1} ${w?.s ?? w?.q ?? ""}`.slice(0, 120);
    if (!w?.g) problems.push({ point: id, at, msg: "no tag (g)" });
    if ((w?.k ?? "c") === "c" && Array.isArray(w.x)) {
      if (w.x.length < 2) problems.push({ point: id, at, msg: "a choice drill needs at least 2 distractors" });
      if (w.x.some((x) => !Array.isArray(x) || !str(x[1]))) problems.push({ point: id, at, msg: "every distractor needs its explanation: [form, why]" });
    }
  });
  const seen = new Set<string>();
  for (const d of drills) {
    const key = d.k === "x" ? `x|${d.q}` : `${d.k}|${d.s}`;
    if (seen.has(key)) bad(`duplicate drill: ${d.k === "x" ? d.q : d.s}`);
    seen.add(key);
  }

  // coverage: every rule and every trap, and a mix of kinds
  const tags = [...p.rules.map((_, i) => `r${i}`), ...p.traps.map((_, i) => `t${i}`)];
  const count = (f: (d: (typeof drills)[number]) => boolean) => drills.filter(f).length;
  for (const t of tags) {
    const n = count((d) => d.g === t);
    if (n < 3) bad(`tag ${t} has ${n} drills (at least 3)`);
  }
  const minTotal = Math.max(30, tags.length * 3);
  if (drills.length < minTotal) bad(`${drills.length} drills (at least ${minTotal})`);
  const fixes = drills.filter((d) => d.k === "f");
  if (fixes.length < 5) bad(`${fixes.length} fix drills (at least 5)`);
  if (fixes.filter((d) => d.k === "f" && !d.r.length).length < 2) bad("at least 2 fix drills whose underlined part is right (r: [])");
  if (fixes.filter((d) => d.k === "f" && d.r.length).length < 2) bad("at least 2 fix drills with a real mistake");
  if (count((d) => d.k === "t") < 4) bad(`${count((d) => d.k === "t")} typed drills (at least 4)`);
  if (count((d) => d.k === "c") < 10) bad(`${count((d) => d.k === "c")} choice drills (at least 10)`);

  // old drills dropped (allowed for wrong or duplicate ones; listed so it is a choice)
  const now = new Set((raw ?? []).map((d) => String((d as { s?: string; q?: string }).s ?? (d as { q?: string }).q ?? "").replace(/[[\]{}]/g, "")));
  const dropped = (oldDrills[id] ?? []).filter((d) => !now.has(String(d.s ?? d.q ?? "").replace(/[[\]{}]/g, "")));

  if (problems.length) {
    failed++;
    console.log(`✗ ${id}: ${problems.length} problem(s)`);
    for (const pr of problems) console.log(`   - ${pr.at ? pr.at + " — " : ""}${pr.msg}`);
  } else {
    const kinds = ["c", "t", "f", "x"].map((k) => `${k}:${count((d) => d.k === k)}`).join(" ");
    console.log(`✓ ${id}: ${drills.length} drills (${kinds}), ${tags.length} tags covered`);
  }
  if (dropped.length) console.log(`   (note) ${dropped.length} drill(s) of drills.json not kept as they were (rewritten or dropped): ${dropped.map((d) => d.s).slice(0, 5).join(" | ")}${dropped.length > 5 ? " …" : ""}`);
}
process.exit(failed ? 1 : 0);
