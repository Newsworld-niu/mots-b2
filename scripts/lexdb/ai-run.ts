#!/usr/bin/env node
/**
 * OpenRouter AI enrichment & cross-model review for LexDB.
 *
 * - Generation:
 *     rank <= 15,000 -> google/gemini-2.5-flash (missing senses aligned to frDefs, example translations, phrases)
 *     rank >  15,000 -> google/gemini-2.5-flash-lite (zh glosses only)
 *   Reasoning disabled ({ enabled: false }) with temperature=0 and json_object output.
 * - Cross-model review:
 *     openai/gpt-5-mini (temperature omitted) checks AI items + conflicting sources -> ok / fix / reject.
 * - Cost ledger & SHA-256 cache:
 *     data/lexdb/cost-ledger.jsonl and data/lexdb/ai-cache/
 *     Hard stop when cumulative cost >= --budget (default $3 for --pilot, $60 for full).
 *
 * Usage:
 *   tsx scripts/lexdb/ai-run.ts --pilot [--budget 3] [--test-call]
 *   tsx scripts/lexdb/ai-run.ts --full [--budget 60] [--tier top15k|longtail|all]
 */
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  SYSTEM_LONGTAIL,
  SYSTEM_REVIEW,
  SYSTEM_TOP15K,
  applyGenResult,
  applyReviewResult,
  buildGenPayload,
  buildReviewPayload,
  extractJson,
} from "./ai-core.ts";

const ROOT = resolve(import.meta.dirname, "../..");
const DEFAULT_DB = resolve(ROOT, "data/lexdb/lexdb.sqlite");
const CACHE_DIR = resolve(ROOT, "data/lexdb/ai-cache");
const LEDGER_PATH = resolve(ROOT, "data/lexdb/cost-ledger.jsonl");

const MODEL_GEN_TOP = "google/gemini-2.5-flash";
const MODEL_GEN_LITE = "google/gemini-2.5-flash-lite";
const MODEL_REVIEW = "openai/gpt-5-mini";

const REQUIRED_PILOT_WORDS = [
  "prendre",
  "faire",
  "mettre",
  "tenir",
  "passer",
  "beau",
  "accueil",
  "temps",
  "coup",
  "fois",
];


function resolveMainRoot(): string {
  try {
    const common = execSync("git rev-parse --git-common-dir", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] })
      .toString("utf8")
      .trim();
    const p = common.startsWith("/") ? common : resolve(ROOT, common);
    if (p.endsWith("/.git")) return p.slice(0, -5);
  } catch {
    /* ignore */
  }
  return ROOT;
}

/** Read OPENROUTER_API_KEY from env or .env.local (never log or persist the key). */
function loadOpenRouterKey(): string {
  const fromEnv = process.env.OPENROUTER_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  const candidates = [resolve(ROOT, ".env.local"), resolve(resolveMainRoot(), ".env.local")];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const m = /^OPENROUTER_API_KEY\s*=\s*(.+)$/.exec(line);
      if (m) {
        let val = m[1].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (val) return val;
      }
    }
  }
  throw new Error("OPENROUTER_API_KEY not found in environment or .env.local");
}

function readCumulativeCost(): number {
  if (!existsSync(LEDGER_PATH)) return 0;
  let total = 0;
  for (const line of readFileSync(LEDGER_PATH, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (typeof row.cost === "number" && Number.isFinite(row.cost)) total += row.cost;
    } catch {
      /* ignore malformed line */
    }
  }
  return total;
}


interface CallUsage {
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  cost: number;
}

function estimateFallbackCost(model: string, promptTokens: number, completionTokens: number): number {
  // Conservative fallback USD/1M estimates if upstream omits usage.cost
  const rates: Record<string, [number, number]> = {
    [MODEL_GEN_TOP]: [0.3, 2.5],
    [MODEL_GEN_LITE]: [0.1, 0.4],
    [MODEL_REVIEW]: [0.25, 2.0],
  };
  const [inR, outR] = rates[model] ?? [0.5, 2.0];
  return (promptTokens * inR + completionTokens * outR) / 1_000_000;
}

async function callOpenRouter(opts: {
  apiKey: string;
  model: string;
  phase: string;
  system: string;
  userPayload: unknown;
  ids: string[];
  disableReasoning: boolean;
  allowTemperature: boolean;
}): Promise<{ parsed: any; usage: CallUsage; cached: boolean }> {
  mkdirSync(CACHE_DIR, { recursive: true });
  mkdirSync(resolve(ROOT, "data/lexdb"), { recursive: true });

  const inputHash = createHash("sha256")
    .update(JSON.stringify({ model: opts.model, phase: opts.phase, system: opts.system, payload: opts.userPayload }))
    .digest("hex");
  const cacheFile = resolve(CACHE_DIR, `${inputHash}.json`);

  if (existsSync(cacheFile)) {
    const cached = JSON.parse(readFileSync(cacheFile, "utf8"));
    return { parsed: cached.output, usage: cached.usage, cached: true };
  }

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: JSON.stringify(opts.userPayload) },
    ],
    response_format: { type: "json_object" },
    usage: { include: true },
    max_tokens: 6000,
  };
  if (opts.allowTemperature) body.temperature = 0;
  if (opts.disableReasoning) body.reasoning = { enabled: false };
  else body.reasoning = { effort: "minimal" };

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${opts.apiKey}`,
          "HTTP-Referer": "https://github.com/Newsworld-niu/mots-b2",
          "X-Title": "Mots B2 LexDB",
        },
        body: JSON.stringify(body),
      });
      const json = (await resp.json()) as any;
      if (!resp.ok || json.error) {
        const msg = json?.error?.message ?? `HTTP ${resp.status}`;
        // If a model rejects reasoning.effort/enabled on first attempt, retry without reasoning param
        if (resp.status === 400 && attempt === 0 && /reasoning/i.test(String(msg))) {
          delete body.reasoning;
          continue;
        }
        throw new Error(`OpenRouter error (${resp.status}): ${String(msg).slice(0, 300)}`);
      }
      const choice = json.choices?.[0];
      if (choice?.error) throw new Error(`OpenRouter upstream error: ${JSON.stringify(choice.error).slice(0, 200)}`);
      const content = choice?.message?.content ?? "";
      const parsed = extractJson(content);

      const u = json.usage ?? {};
      const promptTokens = Number(u.prompt_tokens ?? 0);
      const completionTokens = Number(u.completion_tokens ?? 0);
      const reasoningTokens = Number(u.completion_tokens_details?.reasoning_tokens ?? 0);
      const totalTokens = Number(u.total_tokens ?? promptTokens + completionTokens);
      const cost =
        typeof u.cost === "number" && Number.isFinite(u.cost)
          ? u.cost
          : estimateFallbackCost(opts.model, promptTokens, completionTokens);
      const usage: CallUsage = { promptTokens, completionTokens, reasoningTokens, totalTokens, cost };

      writeFileSync(
        cacheFile,
        JSON.stringify({ hash: inputHash, model: opts.model, phase: opts.phase, createdAt: new Date().toISOString(), usage, input: opts.userPayload, output: parsed }, null, 2),
      );
      appendFileSync(
        LEDGER_PATH,
        JSON.stringify({
          ts: new Date().toISOString(),
          phase: opts.phase,
          model: opts.model,
          batchSize: opts.ids.length,
          ...usage,
          ids: opts.ids,
        }) + "\n",
      );
      return { parsed, usage, cached: false };
    } catch (e) {
      lastErr = e;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr;
}


function selectPilotIds(db: DatabaseSync): string[] {
  // Check if already chosen & saved in report table for deterministic resume
  const existing = db.prepare("SELECT value FROM report WHERE key = 'pilot_ids'").get() as { value: string } | undefined;
  if (existing?.value) {
    const arr = JSON.parse(existing.value) as string[];
    if (Array.isArray(arr) && arr.length === 200) return arr;
  }

  const chosen: string[] = [];
  const seen = new Set<string>();
  const addId = (id: string) => {
    if (!seen.has(id)) {
      seen.add(id);
      chosen.push(id);
    }
  };

  // 1) Mandatory 10 words in core bucket
  for (const w of REQUIRED_PILOT_WORDS) {
    const row = db
      .prepare("SELECT id FROM lemma WHERE w = ? AND is_phrase = 0 ORDER BY rank ASC LIMIT 1")
      .get(w) as { id: string } | undefined;
    if (!row) throw new Error(`Required pilot word missing from DB: ${w}`);
    addId(row.id);
  }

  // Fill Bucket A up to 100 from rank 1..2000 (prioritizing words with pending AI jobs or open gaps, then rank spread)
  const bucketACand = db
    .prepare(
      `SELECT l.id FROM lemma l
       JOIN ai_job j ON j.lemma_id = l.id
       WHERE l.is_phrase = 0 AND l.rank BETWEEN 1 AND 2000
       ORDER BY (CASE WHEN j.gen_status = 'pending' THEN 0 ELSE 1 END), l.rank ASC`,
    )
    .all() as { id: string }[];
  for (const r of bucketACand) {
    if (chosen.length >= 100) break;
    addId(r.id);
  }

  // Bucket B: 50 words from rank 2001..15000 (prefer pending AI jobs)
  const bucketBCand = db
    .prepare(
      `SELECT l.id FROM lemma l
       JOIN ai_job j ON j.lemma_id = l.id
       WHERE l.is_phrase = 0 AND l.rank BETWEEN 2001 AND 15000
       ORDER BY (CASE WHEN j.gen_status = 'pending' THEN 0 ELSE 1 END), l.rank ASC`,
    )
    .all() as { id: string }[];
  let bCount = 0;
  for (const r of bucketBCand) {
    if (bCount >= 50) break;
    if (!seen.has(r.id)) {
      addId(r.id);
      bCount++;
    }
  }

  // Bucket C: 50 words from rank > 15000 (prefer pending longtail glosses)
  const bucketCCand = db
    .prepare(
      `SELECT l.id FROM lemma l
       JOIN ai_job j ON j.lemma_id = l.id
       WHERE l.is_phrase = 0 AND l.rank > 15000
       ORDER BY (CASE WHEN j.gen_status = 'pending' THEN 0 ELSE 1 END), l.rank ASC`,
    )
    .all() as { id: string }[];
  let cCount = 0;
  for (const r of bucketCCand) {
    if (cCount >= 50) break;
    if (!seen.has(r.id)) {
      addId(r.id);
      cCount++;
    }
  }

  if (chosen.length !== 200) {
    throw new Error(`Expected 200 pilot lemmas, selected ${chosen.length}`);
  }

  db.prepare("INSERT OR REPLACE INTO report(key, value, updated_at) VALUES ('pilot_ids', ?, ?)").run(
    JSON.stringify(chosen),
    new Date().toISOString(),
  );
  return chosen;
}


async function main() {
  const args = process.argv.slice(2);
  const isPilot = args.includes("--pilot");
  const isFull = args.includes("--full");
  const isTestCall = args.includes("--test-call");
  const phaseIdx = args.indexOf("--phase");
  const phase = phaseIdx >= 0 ? args[phaseIdx + 1] : "all";
  const dbIdx = args.indexOf("--db");
  const dbPath = dbIdx >= 0 ? resolve(ROOT, args[dbIdx + 1]) : DEFAULT_DB;
  const budgetIdx = args.indexOf("--budget");
  const budget = budgetIdx >= 0 ? Number(args[budgetIdx + 1]) : isPilot ? 3 : 60;
  const batchIdx = args.indexOf("--batch-size");
  const tierIdx = args.indexOf("--tier");
  const tier = tierIdx >= 0 ? String(args[tierIdx + 1]) : "all";
  if (!["top15k", "longtail", "all"].includes(tier)) {
    console.error(`Invalid --tier ${tier}; expected top15k, longtail or all.`);
    process.exit(1);
  }
  const tierSql =
    tier === "top15k" ? " AND l.rank <= 15000" : tier === "longtail" ? " AND (l.rank IS NULL OR l.rank > 15000)" : "";
  const batchSize = batchIdx >= 0 ? Math.max(1, Math.min(12, Number(args[batchIdx + 1]))) : 9;

  if (!isPilot && !isFull && !isTestCall) {
    console.error("Specify --pilot (200-word pilot), --full, or --test-call.");
    process.exit(1);
  }
  if (!existsSync(dbPath)) {
    console.error(`SQLite DB not found: ${dbPath}. Run npm run lexdb:build first.`);
    process.exit(1);
  }

  const apiKey = loadOpenRouterKey();
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA busy_timeout = 30000");
  try {
    db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL");
  } catch {
    /* keep existing journal_mode if another connection prevented switching */
  }
  let cumulativeCost = readCumulativeCost();
  console.log(`[ai-run] mode=${isTestCall ? "test-call" : isPilot ? "pilot" : "full"} budget=$${budget.toFixed(2)} startingCost=$${cumulativeCost.toFixed(4)} batchSize=${batchSize}`);

  const checkBudget = (): boolean => {
    if (cumulativeCost >= budget) {
      console.warn(`[ai-run] HARD BUDGET STOP: cumulative cost $${cumulativeCost.toFixed(4)} >= $${budget.toFixed(2)}`);
      return false;
    }
    return true;
  };

  if (isTestCall) {
    if (!checkBudget()) process.exit(0);
    const payload = [buildGenPayload(db, "accueil", "top15k")];
    const res = await callOpenRouter({
      apiKey,
      model: MODEL_GEN_TOP,
      phase: "test-gen",
      system: SYSTEM_TOP15K,
      userPayload: { entries: payload },
      ids: ["accueil"],
      disableReasoning: true,
      allowTemperature: true,
    });
    console.log("[test-call] gen usage:", res.usage, "cached:", res.cached);
    if (res.usage.reasoningTokens > 20) {
      console.warn("[test-call] WARNING: reasoning tokens not ~0:", res.usage.reasoningTokens);
    }
    db.close();
    return;
  }

  let targetIds: string[];
  if (isPilot) {
    targetIds = selectPilotIds(db);
    console.log(`[pilot] 200 words selected (mandatory 10 verified)`);
  } else {
    targetIds = (
      db.prepare(
        `SELECT j.lemma_id FROM ai_job j JOIN lemma l ON l.id = j.lemma_id
         WHERE (j.gen_status = 'pending' OR j.review_status = 'pending')${tierSql} ORDER BY j.id`,
      ).all() as {
        lemma_id: string;
      }[]
    ).map((r) => r.lemma_id);
    console.log(`[full] ${targetIds.length} pending lemmas queued`);
  }

  const runStats = { genBatches: 0, revBatches: 0, genWords: 0, revWords: 0, ok: 0, fix: 0, reject: 0, cachedCalls: 0, newCost: 0 };

  // Phase 1: Generation
  if (phase === "all" || phase === "gen") {
    const placeholders = targetIds.map(() => "?").join(",");
    const pendingRows = db
      .prepare(
        `SELECT l.id, l.rank, j.tier FROM lemma l JOIN ai_job j ON j.lemma_id = l.id
         WHERE l.id IN (${placeholders}) AND j.gen_status = 'pending'
         ORDER BY l.rank ASC`,
      )
      .all(...targetIds) as { id: string; rank: number; tier: string }[];

    const topQueue = pendingRows.filter((r) => r.rank <= 15000).map((r) => r.id);
    const liteQueue = pendingRows.filter((r) => r.rank > 15000).map((r) => r.id);
    console.log(`[gen] pending: top15k=${topQueue.length}, longtail=${liteQueue.length}`);

    for (const [tier, queue, model, system] of [
      ["top15k", topQueue, MODEL_GEN_TOP, SYSTEM_TOP15K] as const,
      ["longtail", liteQueue, MODEL_GEN_LITE, SYSTEM_LONGTAIL] as const,
    ]) {
      for (let i = 0; i < queue.length; i += batchSize) {
        if (!checkBudget()) break;
        const chunk = queue.slice(i, i + batchSize);
        const entries = chunk.map((id) => buildGenPayload(db, id, tier));
        const res = await callOpenRouter({
          apiKey,
          model,
          phase: `gen-${tier}`,
          system,
          userPayload: { entries },
          ids: chunk,
          disableReasoning: true,
          allowTemperature: true,
        });
        if (res.cached) runStats.cachedCalls++;
        else {
          cumulativeCost += res.usage.cost;
          runStats.newCost += res.usage.cost;
        }
        runStats.genBatches++;
        const byId = new Map<string, any>();
        for (const out of res.parsed?.entries ?? []) {
          if (out?.id) byId.set(String(out.id), out);
        }
        db.exec("BEGIN IMMEDIATE");
        try {
          for (const id of chunk) {
            applyGenResult(db, id, model, byId.get(id) ?? { id, senses: [], examples: [], phrases: [] });
            runStats.genWords++;
          }
          db.exec("COMMIT");
        } catch (e) {
          try { db.exec("ROLLBACK"); } catch { /* ignore */ }
          throw e;
        }
        console.log(
          `[gen-${tier}] batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(queue.length / batchSize)}: ${chunk.length} words | reasoningTok=${res.usage.reasoningTokens} | cost=$${res.usage.cost.toFixed(5)} | cum=$${cumulativeCost.toFixed(4)}${res.cached ? " (cached)" : ""}`,
        );
      }
      if (cumulativeCost >= budget) break;
    }
  }

  // Phase 2: Cross-model review (openai/gpt-5-mini, temperature omitted)
  if ((phase === "all" || phase === "review") && checkBudget()) {
    const revPayloads: any[] = [];
    for (const id of targetIds) {
      const job = db.prepare("SELECT review_status FROM ai_job WHERE lemma_id = ?").get(id) as { review_status: string } | undefined;
      if (!job || (job.review_status !== "pending" && !isPilot)) continue;
      // In pilot, skip already reviewed items unless re-needed
      if (job.review_status !== "pending") continue;
      const p = buildReviewPayload(db, id);
      if (p) revPayloads.push(p);
      else {
        db.prepare("UPDATE ai_job SET review_status = 'skipped', updated_at = ? WHERE lemma_id = ?").run(
          new Date().toISOString(),
          id,
        );
      }
    }
    console.log(`[review] pending: ${revPayloads.length} words`);
    for (let i = 0; i < revPayloads.length; i += batchSize) {
      if (!checkBudget()) break;
      const chunk = revPayloads.slice(i, i + batchSize);
      const ids = chunk.map((c) => c.id);
      const res = await callOpenRouter({
        apiKey,
        model: MODEL_REVIEW,
        phase: "review",
        system: SYSTEM_REVIEW,
        userPayload: { entries: chunk },
        ids,
        disableReasoning: false,
        allowTemperature: false, // gpt-5* must omit temperature
      });
      if (res.cached) runStats.cachedCalls++;
      else {
        cumulativeCost += res.usage.cost;
        runStats.newCost += res.usage.cost;
      }
      runStats.revBatches++;
      const byId = new Map<string, any>();
      for (const r of res.parsed?.reviews ?? []) {
        if (r?.id) byId.set(String(r.id), r);
      }
      db.exec("BEGIN IMMEDIATE");
      try {
        for (const id of ids) {
          const stats = applyReviewResult(db, id, byId.get(id) ?? { id, senseReviews: [], exampleReviews: [], phraseReviews: [] }, MODEL_REVIEW);
          runStats.revWords++;
          runStats.ok += stats.okCount;
          runStats.fix += stats.fixCount;
          runStats.reject += stats.rejectCount;
        }
        db.exec("COMMIT");
      } catch (e) {
        try { db.exec("ROLLBACK"); } catch { /* ignore */ }
        throw e;
      }
      console.log(
        `[review] batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(revPayloads.length / batchSize)}: ${ids.length} words | reasoningTok=${res.usage.reasoningTokens} | cost=$${res.usage.cost.toFixed(5)} | cum=$${cumulativeCost.toFixed(4)}${res.cached ? " (cached)" : ""}`,
      );
    }
  }

  // Record pilot/AI stats into report table
  const now = new Date().toISOString();
  db.prepare("INSERT OR REPLACE INTO report(key, value, updated_at) VALUES ('last_ai_run', ?, ?)").run(
    JSON.stringify({ mode: isPilot ? "pilot" : "full", cumulativeCost, ...runStats }),
    now,
  );
  db.close();
  console.log(`[ai-run] DONE:`, { cumulativeCost: Number(cumulativeCost.toFixed(4)), ...runStats });
}

main().catch((err) => {
  console.error("[ai-run] ERROR:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
