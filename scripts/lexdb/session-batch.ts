#!/usr/bin/env node
/**
 * In-session batch tooling for LexDB enrichment: agents in this conversation write entries instead of the API.
 *
 *   tsx scripts/lexdb/session-batch.ts claim --phase gen|review --tier top15k|longtail --size 40 --worker <tag>
 *   tsx scripts/lexdb/session-batch.ts apply --batch <id> [--model session]
 *   tsx scripts/lexdb/session-batch.ts release [--stale-minutes 60]
 *   tsx scripts/lexdb/session-batch.ts status
 *
 * Batch files live in data/lexdb/session/<phase>/<id>.input.json and <id>.output.json (gitignored).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  SYSTEM_REVIEW,
  SYSTEM_TOP15K,
  SYSTEM_LONGTAIL,
  VALID_POS,
  applyGenResult,
  applyReviewResult,
  buildGenPayload,
  buildReviewPayload,
  extractJson,
} from "./ai-core.ts";

export type Phase = "gen" | "review";
export type Tier = "top15k" | "longtail";

const ROOT = resolve(import.meta.dirname, "../..");
const DEFAULT_DB = resolve(ROOT, "data/lexdb/lexdb.sqlite");
const SESSION_DIR = resolve(ROOT, "data/lexdb/session");
const TRAD_SIMP = resolve(ROOT, "references/wiktionary/trad-simp.json");
const REG_OK = new Set(["书", "俗", "旧", "转", "技", "省"]);
const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/;

export function openDb(path = DEFAULT_DB): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA busy_timeout = 60000");
  if (path !== ":memory:") {
    try {
      db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL");
    } catch {
      /* ignore if switching journal mode races */
    }
  }
  ensureBatchTable(db);
  return db;
}

export function ensureBatchTable(db: DatabaseSync) {
  const hasBatch = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='session_batch'").get();
  if (!hasBatch) {
    db.exec(`CREATE TABLE IF NOT EXISTS session_batch (
      id TEXT PRIMARY KEY,
      phase TEXT NOT NULL,
      tier TEXT NOT NULL,
      worker TEXT,
      lemma_ids TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      applied_at TEXT,
      summary TEXT
    )`);
  }
  const hasGlossIdx = db.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_gloss_sense'").get();
  if (!hasGlossIdx) {
    try {
      db.exec("CREATE INDEX IF NOT EXISTS idx_gloss_sense ON gloss(sense_id)");
    } catch {
      /* gloss table may not exist in minimal unit test fixtures */
    }
  }
}

const sleepSync = (ms: number) => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

function withWriteTx<T>(db: DatabaseSync, fn: () => T): T {
  let delay = 200;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      db.exec("BEGIN IMMEDIATE");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (attempt < 5 && /database is locked|SQLITE_BUSY/i.test(msg)) {
        sleepSync(delay + Math.floor(Math.random() * 150));
        delay = Math.min(3200, delay * 2);
        continue;
      }
      throw e;
    }
    try {
      const res = fn();
      db.exec("COMMIT");
      return res;
    } catch (e) {
      try {
        db.exec("ROLLBACK");
      } catch {
        /* ignore */
      }
      const msg = e instanceof Error ? e.message : String(e);
      if (attempt < 5 && /database is locked|SQLITE_BUSY/i.test(msg)) {
        sleepSync(delay + Math.floor(Math.random() * 150));
        delay = Math.min(3200, delay * 2);
        continue;
      }
      throw e;
    }
  }
  throw new Error("Unreachable");
}

const tierSql = (tier: Tier) => (tier === "top15k" ? "l.rank <= 15000" : "(l.rank IS NULL OR l.rank > 15000)");

const BAD_TRAD_KEYS = new Set(["类", "强", "转", "层", "喜", "甚", "著", "乾", "徵"]);
let tradMap: Record<string, string> | null = null;
export function setTradMap(m: Record<string, string> | null) {
  tradMap = m;
}
function loadTrad(): Record<string, string> {
  if (tradMap) return tradMap;
  const raw = existsSync(TRAD_SIMP) ? (JSON.parse(readFileSync(TRAD_SIMP, "utf8")) as Record<string, string>) : {};
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (BAD_TRAD_KEYS.has(k) || raw[v] === k) continue;
    clean[k] = k === "鷄" ? "鸡" : v;
  }
  tradMap = clean;
  return tradMap;
}
export function toSimp(s: string): string {
  const m = loadTrad();
  let out = "";
  for (const ch of s) out += m[ch] ?? ch;
  return out;
}

function stamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function batchPaths(phase: Phase, id: string, dir = SESSION_DIR) {
  const base = resolve(dir, phase);
  return { dir: base, inputPath: resolve(base, `${id}.input.json`), outputPath: resolve(base, `${id}.output.json`) };
}

export interface ClaimResult {
  batchId: string | null;
  inputPath?: string;
  outputPath?: string;
  count: number;
}

export function claim(
  db: DatabaseSync,
  opts: { phase: Phase; tier: Tier; size: number; worker: string; dir?: string },
): ClaimResult {
  const { phase, tier, worker } = opts;
  const size = Math.max(1, Math.min(200, Math.floor(opts.size)));
  return withWriteTx(db, () => {
    const ids: string[] = [];
    const payloads: unknown[] = [];
    if (phase === "gen") {
      const rows = db
        .prepare(
          `SELECT j.lemma_id AS id FROM ai_job j JOIN lemma l ON l.id = j.lemma_id
           WHERE j.gen_status = 'pending' AND ${tierSql(tier)}
           ORDER BY (l.rank IS NULL), l.rank ASC, j.id ASC LIMIT ?`,
        )
        .all(size) as { id: string }[];
      for (const r of rows) {
        ids.push(r.id);
        payloads.push(buildGenPayload(db, r.id, tier));
      }
    } else {
      const rows = db
        .prepare(
          `SELECT j.lemma_id AS id FROM ai_job j JOIN lemma l ON l.id = j.lemma_id
           WHERE j.review_status = 'pending' AND j.gen_status NOT IN ('pending', 'claimed') AND ${tierSql(tier)}
           ORDER BY (l.rank IS NULL), l.rank ASC, j.id ASC`,
        )
        .iterate() as Iterable<{ id: string }>;
      const skip = db.prepare("UPDATE ai_job SET review_status = 'skipped', updated_at = ? WHERE lemma_id = ?");
      const now = new Date().toISOString();
      const toSkip: string[] = [];
      for (const r of rows) {
        if (ids.length >= size) break;
        const p = buildReviewPayload(db, r.id);
        if (p) {
          ids.push(r.id);
          payloads.push(p);
        } else toSkip.push(r.id);
      }
      for (const id of toSkip) skip.run(now, id);
    }
    if (!ids.length) {
      return { batchId: null, count: 0 };
    }
    const batchId = `${phase}-${stamp()}-${randomBytes(2).toString("hex")}`;
    const col = phase === "gen" ? "gen_status" : "review_status";
    const mark = db.prepare(`UPDATE ai_job SET ${col} = 'claimed', updated_at = ? WHERE lemma_id = ?`);
    const now = new Date().toISOString();
    for (const id of ids) mark.run(now, id);
    db.prepare(
      "INSERT INTO session_batch(id, phase, tier, worker, lemma_ids, status, created_at) VALUES (?, ?, ?, ?, ?, 'claimed', ?)",
    ).run(batchId, phase, tier, worker, JSON.stringify(ids), now);
    const paths = batchPaths(phase, batchId, opts.dir);
    mkdirSync(paths.dir, { recursive: true });
    const instructions = phase === "review" ? SYSTEM_REVIEW : tier === "top15k" ? SYSTEM_TOP15K : SYSTEM_LONGTAIL;
    writeFileSync(paths.inputPath, JSON.stringify({ batchId, phase, tier, instructions, entries: payloads }, null, 2));
    return { batchId, inputPath: paths.inputPath, outputPath: paths.outputPath, count: ids.length };
  });
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const zhOk = (s: unknown) => typeof s === "string" && s.trim().length > 0 && s.length <= 300 && CJK_RE.test(s);
const VERDICTS = new Set(["ok", "fix", "reject"]);

/** Validate a parsed output object against the batch; returns error messages (empty = valid). */
export function validateOutput(phase: Phase, parsed: unknown, batchIds: readonly string[]): string[] {
  const errs: string[] = [];
  const allowed = new Set(batchIds);
  if (!isObj(parsed)) return ["output must be a JSON object"];
  const key = phase === "gen" ? "entries" : "reviews";
  const list = parsed[key];
  if (!Array.isArray(list)) return [`top-level "${key}" must be an array`];
  const seen = new Set<string>();
  list.forEach((item, i) => {
    const at = `${key}[${i}]`;
    if (!isObj(item)) return void errs.push(`${at} must be an object`);
    const id = String(item.id ?? "");
    if (!allowed.has(id)) errs.push(`${at}.id "${id}" is not in this batch`);
    if (seen.has(id)) errs.push(`${at}.id "${id}" appears twice`);
    seen.add(id);
    if (phase === "gen") {
      for (const [j, s] of ((item.senses as unknown[]) ?? []).entries()) {
        if (!isObj(s)) { errs.push(`${at}.senses[${j}] must be an object`); continue; }
        if (typeof s.p !== "string" || !s.p.trim()) errs.push(`${at}.senses[${j}].p must be a non-empty string`);
        else if (!VALID_POS.has(s.p)) errs.push(`${at}.senses[${j}].p "${s.p}" is not one of ${[...VALID_POS].join(" ")}`);
        if (!zhOk(s.zh)) errs.push(`${at}.senses[${j}].zh must be non-empty Chinese (<= 300 chars)`);
        if (s.reg !== undefined && s.reg !== "" && s.reg !== null && !REG_OK.has(String(s.reg))) errs.push(`${at}.senses[${j}].reg must be one of 书|俗|旧|转|技|省 or omitted`);
      }
      if (item.senses !== undefined && !Array.isArray(item.senses)) errs.push(`${at}.senses must be an array`);
      for (const [j, ex] of ((item.examples as unknown[]) ?? []).entries()) {
        if (!isObj(ex)) { errs.push(`${at}.examples[${j}] must be an object`); continue; }
        if (!Number.isInteger(Number(ex.exId)) || ex.exId === null || ex.exId === "") errs.push(`${at}.examples[${j}].exId must be an integer`);
        if (!zhOk(ex.zh)) errs.push(`${at}.examples[${j}].zh must be non-empty Chinese`);
      }
      for (const [j, ph] of ((item.phrases as unknown[]) ?? []).entries()) {
        if (!isObj(ph)) { errs.push(`${at}.phrases[${j}] must be an object`); continue; }
        if (typeof ph.fr !== "string" || !ph.fr.trim()) errs.push(`${at}.phrases[${j}].fr must be non-empty`);
        if (!zhOk(ph.zh)) errs.push(`${at}.phrases[${j}].zh must be non-empty Chinese`);
      }
    } else {
      const check = (arr: unknown, name: string, idKey: string) => {
        if (arr === undefined) return;
        if (!Array.isArray(arr)) return void errs.push(`${at}.${name} must be an array`);
        arr.forEach((r, j) => {
          if (!isObj(r)) return void errs.push(`${at}.${name}[${j}] must be an object`);
          if (!Number.isInteger(Number(r[idKey])) || r[idKey] === null || r[idKey] === "") errs.push(`${at}.${name}[${j}].${idKey} must be an integer`);
          const v = String(r.verdict ?? "").toLowerCase();
          if (!VERDICTS.has(v)) errs.push(`${at}.${name}[${j}].verdict must be ok|fix|reject`);
          if (v === "fix" && !zhOk(r.fixedZh)) errs.push(`${at}.${name}[${j}] verdict fix needs Chinese fixedZh`);
        });
      };
      check(item.senseReviews, "senseReviews", "senseId");
      check(item.exampleReviews, "exampleReviews", "exId");
      check(item.phraseReviews, "phraseReviews", "phraseId");
      if (item.conflictReview !== undefined && item.conflictReview !== null) {
        const c = item.conflictReview;
        if (!isObj(c)) errs.push(`${at}.conflictReview must be an object`);
        else {
          const v = String(c.verdict ?? "").toLowerCase();
          if (!VERDICTS.has(v)) errs.push(`${at}.conflictReview.verdict must be ok|fix|reject`);
          if (v === "fix" && !zhOk(c.fixedZh)) errs.push(`${at}.conflictReview verdict fix needs Chinese fixedZh`);
        }
      }
    }
  });
  return errs;
}

/** Simplify every Chinese string field in place. */
function simplifyDeep<T>(v: T): T {
  if (typeof v === "string") return toSimp(v) as unknown as T;
  if (Array.isArray(v)) return v.map(simplifyDeep) as unknown as T;
  if (isObj(v)) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = k === "fr" || k === "id" ? x : simplifyDeep(x);
    return out as T;
  }
  return v;
}

export interface ApplyResult {
  batchId: string;
  applied: number;
  missing: number;
  rejectedItems: number;
  errors: string[];
}

export function applyBatch(db: DatabaseSync, opts: { batchId: string; model: string; dir?: string; parsed?: unknown }): ApplyResult {
  const row = db.prepare("SELECT * FROM session_batch WHERE id = ?").get(opts.batchId) as
    | { id: string; phase: Phase; tier: Tier; lemma_ids: string; status: string }
    | undefined;
  if (!row) throw new Error(`Unknown batch ${opts.batchId}`);
  if (row.status !== "claimed") throw new Error(`Batch ${opts.batchId} is ${row.status}, not claimed`);
  const ids = JSON.parse(row.lemma_ids) as string[];
  let parsed = opts.parsed;
  if (parsed === undefined) {
    const { outputPath } = batchPaths(row.phase, row.id, opts.dir);
    if (!existsSync(outputPath)) throw new Error(`Output file not found: ${outputPath}`);
    parsed = extractJson(readFileSync(outputPath, "utf8"));
  }
  const errs = validateOutput(row.phase, parsed, ids);
  if (errs.length) {
    const err = new Error(`Validation failed (${errs.length}):\n- ${errs.slice(0, 40).join("\n- ")}`);
    (err as Error & { validation?: string[] }).validation = errs;
    throw err;
  }
  const clean = simplifyDeep(parsed) as Record<string, unknown[]>;
  const list = (row.phase === "gen" ? clean.entries : clean.reviews) as Record<string, unknown>[];
  const byId = new Map(list.map((x) => [String(x.id), x]));
  const label = `session:${opts.model}`;
  const col = row.phase === "gen" ? "gen_status" : "review_status";
  let applied = 0;
  let rejectedItems = 0;
  withWriteTx(db, () => {
    const back = db.prepare(`UPDATE ai_job SET ${col} = 'pending', updated_at = ? WHERE lemma_id = ? AND ${col} = 'claimed'`);
    const now = new Date().toISOString();
    for (const id of ids) {
      const item = byId.get(id);
      if (!item) {
        back.run(now, id);
        continue;
      }
      if (row.phase === "gen") {
        const entry = { ...item };
        if (Array.isArray(entry.senses)) {
          entry.senses = (entry.senses as Record<string, unknown>[]).map((s) => (s.reg && !REG_OK.has(String(s.reg)) ? { ...s, reg: undefined } : s));
        }
        applyGenResult(db, id, label, entry);
      } else {
        const stats = applyReviewResult(db, id, item, label);
        rejectedItems += stats.rejectCount;
      }
      applied++;
    }
    const missing = ids.length - applied;
    const summary = { applied, missing, rejectedItems };
    db.prepare("UPDATE session_batch SET status = 'applied', applied_at = ?, summary = ? WHERE id = ?").run(now, JSON.stringify(summary), row.id);
  });
  return { batchId: row.id, applied, missing: ids.length - applied, rejectedItems, errors: [] };
}

export function release(db: DatabaseSync, staleMinutes: number): { released: string[] } {
  const cutoff = new Date(Date.now() - staleMinutes * 60_000).toISOString();
  return withWriteTx(db, () => {
    const rows = db.prepare("SELECT id, phase, lemma_ids FROM session_batch WHERE status = 'claimed' AND created_at <= ?").all(cutoff) as {
      id: string;
      phase: Phase;
      lemma_ids: string;
    }[];
    const now = new Date().toISOString();
    for (const r of rows) {
      const col = r.phase === "gen" ? "gen_status" : "review_status";
      const back = db.prepare(`UPDATE ai_job SET ${col} = 'pending', updated_at = ? WHERE lemma_id = ? AND ${col} = 'claimed'`);
      for (const id of JSON.parse(r.lemma_ids) as string[]) back.run(now, id);
      db.prepare("UPDATE session_batch SET status = 'released', applied_at = ? WHERE id = ?").run(now, r.id);
    }
    return { released: rows.map((r) => r.id) };
  });
}

export function status(db: DatabaseSync) {
  const jobs = db
    .prepare(
      `SELECT CASE WHEN l.rank <= 15000 THEN 'top15k' ELSE 'longtail' END AS tier, j.gen_status AS gen, j.review_status AS review, count(*) AS n
       FROM ai_job j JOIN lemma l ON l.id = j.lemma_id GROUP BY 1, 2, 3 ORDER BY 1, 2, 3`,
    )
    .all();
  const batches = db.prepare("SELECT phase, status, count(*) AS n FROM session_batch GROUP BY 1, 2 ORDER BY 1, 2").all();
  return { jobs, batches };
}

function arg(args: string[], name: string, fallback?: string) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
}

function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const dbPath = arg(args, "--db") ? resolve(ROOT, arg(args, "--db")!) : DEFAULT_DB;
  if (!existsSync(dbPath)) {
    console.error(`SQLite DB not found: ${dbPath}`);
    process.exit(1);
  }
  const db = openDb(dbPath);
  try {
    if (cmd === "claim") {
      const phase = arg(args, "--phase") as Phase;
      const tier = (arg(args, "--tier", "top15k") as Tier) ?? "top15k";
      if (phase !== "gen" && phase !== "review") throw new Error("--phase must be gen or review");
      if (tier !== "top15k" && tier !== "longtail") throw new Error("--tier must be top15k or longtail");
      const res = claim(db, { phase, tier, size: Number(arg(args, "--size", "40")), worker: arg(args, "--worker", "cli")! });
      console.log(JSON.stringify(res));
    } else if (cmd === "apply") {
      const batchId = arg(args, "--batch");
      if (!batchId) throw new Error("--batch is required");
      const res = applyBatch(db, { batchId, model: arg(args, "--model", "session")! });
      console.log(JSON.stringify(res));
    } else if (cmd === "release") {
      console.log(JSON.stringify(release(db, Number(arg(args, "--stale-minutes", "60")))));
    } else if (cmd === "status") {
      console.log(JSON.stringify(status(db), null, 2));
    } else {
      console.error("Usage: session-batch.ts claim|apply|release|status ...");
      process.exit(1);
    }
  } catch (e) {
    console.error(`[session-batch] ERROR: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 2;
  } finally {
    db.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) main();
