/* Import CSV or JSON rows into data/lexicon.json.
 * Usage: npm run lexicon:import -- data/imports/<file>.csv [--dry-run] [--force]
 * Re-importing an identical file is detected by SHA-256 and skipped unless --force is given. */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { checkLexicon, emptyLexicon, parseCSV, upsertRows } from "./lexicon/core.ts";
import type { ImportRow, Lexicon } from "./lexicon/types.ts";

const ROOT = resolve(import.meta.dirname, "..");
const LEX = resolve(ROOT, "data/lexicon.json");
const LOG = resolve(ROOT, "data/import-log.jsonl");

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const force = args.includes("--force");
const files = args.filter((a) => !a.startsWith("--"));
if (!files.length) {
  console.error("usage: npm run lexicon:import -- <file.csv|file.json> [--dry-run] [--force]");
  process.exit(2);
}

const lex: Lexicon = existsSync(LEX) ? JSON.parse(readFileSync(LEX, "utf8")) : emptyLexicon();
const log: { file: string; sha256: string; at: string; added: number; updated: number; conflicts: number; errors: number }[] = existsSync(LOG)
  ? readFileSync(LOG, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
  : [];

let totalErrors = 0;
for (const file of files) {
  const abs = resolve(process.cwd(), file);
  const buf = readFileSync(abs);
  const sha = createHash("sha256").update(buf).digest("hex");
  if (!force && log.some((l) => l.sha256 === sha)) {
    console.log(`SKIP  ${file}  （内容哈希已导入过，未重复建词条；需要强制重跑请加 --force）`);
    continue;
  }
  const text = buf.toString("utf8");
  const rows: ImportRow[] = file.endsWith(".json")
    ? ((parsed: ImportRow[] | { rows: ImportRow[] }) => (Array.isArray(parsed) ? parsed : parsed.rows))(JSON.parse(text))
    : (parseCSV(text) as unknown as ImportRow[]);
  const before = structuredClone(lex);
  const report = upsertRows(lex, rows);
  const errors = report.issues.filter((i) => i.severity === "error");
  totalErrors += errors.length;
  console.log(`\n== ${file}`);
  console.log(`rows=${rows.length} added=${report.added} updated=${report.updated} duplicatesSkipped=${report.duplicatesSkipped} conflicts=${report.conflicts.length} errors=${errors.length} warnings=${report.issues.length - errors.length}`);
  for (const i of report.issues) console.log(`  [${i.severity}] 第${i.line}行 ${i.lemma}: ${i.message}`);
  for (const c of report.conflicts) console.log(`  [conflict] 第${c.line}行 ${c.lemma}: ${c.message}`);
  if (errors.length) {
    // An import with errors is rejected as a whole, so the lexicon never holds half a batch.
    console.log("  → 含错误，整批未写入。");
    lex.entries = before.entries;
    continue;
  }
  const problems = checkLexicon(lex);
  if (problems.length) {
    console.log("  → 词库完整性检查失败：\n    " + problems.join("\n    "));
    lex.entries = before.entries;
    totalErrors++;
    continue;
  }
  if (!dry) {
    log.push({ file, sha256: sha, at: new Date().toISOString(), added: report.added, updated: report.updated, conflicts: report.conflicts.length, errors: 0 });
    mkdirSync(dirname(LOG), { recursive: true });
    appendFileSync(LOG, JSON.stringify(log[log.length - 1]) + "\n");
  }
}

if (!dry) {
  mkdirSync(dirname(LEX), { recursive: true });
  writeFileSync(LEX, JSON.stringify(lex, null, 2) + "\n");
  console.log(`\nlexicon.json: ${lex.entries.length} entries`);
} else console.log("\n(dry run: nothing written)");
process.exitCode = totalErrors ? 1 : 0;
