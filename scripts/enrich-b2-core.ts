/* Opt-in offline CLI to enrich B2 core vocabulary in data/lexicon.json with collocations (`col`),
 * usage notes (`tip`), and register (`register`). Defaults to --dry-run (0 network calls).
 *
 * Usage:
 *   npm run lexicon:enrich-b2 -- --dry-run
 *   OPENROUTER_API_KEY=... npm run lexicon:enrich-b2 -- --apply --limit 50
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { LexEntry, Lexicon } from "./lexicon/types.ts";

const ROOT = resolve(import.meta.dirname, "..");
const LEXICON_PATH = resolve(ROOT, "data/lexicon.json");
const INDEX_PATH = resolve(ROOT, "public/atlas/index.json");
const FREQ_PATH = resolve(ROOT, "data/frequency.json");
const CACHE_PATH = resolve(ROOT, "data/lexicon-enrich-b2.jsonl");

type Register = "soutenu" | "courant" | "familier";
const REGISTERS = new Set<Register>(["soutenu", "courant", "familier"]);

interface EnrichRow {
  id: string;
  col?: string[];
  tip?: string;
  register?: Register;
  syn?: string[];
}

function loadEnvLocal() {
  const envPath = resolve(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

function parseArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

function needsEnrichment(e: LexEntry): boolean {
  return !(e.col?.length) || !e.tip?.trim() || !e.register || !(e.syn?.length);
}

function validatePatch(raw: unknown): Omit<EnrichRow, "id"> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const out: Omit<EnrichRow, "id"> = {};
  if (Array.isArray(r.col)) {
    const cleanCol = r.col
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter((x) => /^.+｜.+$/.test(x) && x.length <= 160)
      .slice(0, 4);
    if (cleanCol.length) out.col = cleanCol;
  }
  if (typeof r.tip === "string" && r.tip.trim()) {
    out.tip = r.tip.trim().slice(0, 200);
  }
  if (typeof r.register === "string" && REGISTERS.has(r.register as Register)) {
    out.register = r.register as Register;
  }
  if (Array.isArray(r.syn)) {
    const cleanSyn = r.syn
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter((x) => x.length >= 2 && x.length <= 80)
      .slice(0, 3);
    if (cleanSyn.length) out.syn = cleanSyn;
  }
  return out.col || out.tip || out.register || out.syn ? out : null;
}

async function fetchBatch(
  batch: LexEntry[],
  apiKey: string,
  baseUrl: string,
  model: string,
): Promise<Map<string, Omit<EnrichRow, "id">>> {
  const promptItems = batch.map((e) => ({
    id: e.id,
    lemma: e.lemma,
    pos: e.pos,
    zh: e.senses.filter((s) => s.zh).slice(0, 3).map((s) => s.zh),
    needCol: !(e.col?.length),
    needTip: !e.tip?.trim(),
    needRegister: !e.register,
    needSyn: !(e.syn?.length),
  }));

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal: AbortSignal.timeout(45_000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                'You are a DELF B2 French lexicographer for Chinese learners. Return strict JSON {"items":[{"id":string,"col":["fr｜zh"],"tip":string,"register":"soutenu"|"courant"|"familier","syn":["mot (中文)"]}]} for every item. Rules: col has 2-4 natural B2 collocations in "French｜中文" format; tip is <=120 Chinese chars on preposition/register/false-friend traps; syn has 1-3 authentic French B1/B2 synonyms formatted "mot (中文)"; register matches standard French usage. Keep id verbatim.',
            },
            { role: "user", content: JSON.stringify({ items: promptItems }) },
          ],
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }
      const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = body.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(text) as { items?: Array<Record<string, unknown>> };
      const map = new Map<string, Omit<EnrichRow, "id">>();
      for (const row of parsed.items ?? []) {
        if (typeof row?.id !== "string") continue;
        const valid = validatePatch(row);
        if (valid) map.set(row.id, valid);
      }
      return map;
    } catch (err) {
      lastErr = err;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1200 * attempt));
    }
  }
  throw lastErr;
}

async function main() {
  loadEnvLocal();
  const apply = process.argv.includes("--apply") && !process.argv.includes("--dry-run");
  const limit = Math.max(1, Number(parseArg("--limit") ?? 50) || 50);
  const batchSize = Math.max(5, Math.min(40, Number(parseArg("--batch-size") ?? 25) || 25));
  const concurrency = Math.max(1, Math.min(24, Number(parseArg("--concurrency") ?? 16) || 16));

  const lex: Lexicon = JSON.parse(readFileSync(LEXICON_PATH, "utf8"));
  const index = existsSync(INDEX_PATH)
    ? (JSON.parse(readFileSync(INDEX_PATH, "utf8")) as { words: Array<[string, ...unknown[]]> })
    : null;
  const freq = existsSync(FREQ_PATH)
    ? (JSON.parse(readFileSync(FREQ_PATH, "utf8")) as { entries: Record<string, { f: number }> }).entries
    : {};

  // Index band 3 === B2 in public/atlas/index.json
  const b2Ids = new Set<string>(
    index ? index.words.filter((row) => row[4] === 3).map((row) => String(row[0])) : [],
  );
  const b2Entries = lex.entries.filter(
    (e) => !e.aliasOf && (e.level === "B2" || b2Ids.has(e.id)),
  );
  const missingCol = b2Entries.filter((e) => !(e.col?.length)).length;
  const missingTip = b2Entries.filter((e) => !e.tip?.trim()).length;
  const missingReg = b2Entries.filter((e) => !e.register).length;

  const candidates = b2Entries
    .filter(needsEnrichment)
    .sort((a, b) => (freq[b.id]?.f ?? 0) - (freq[a.id]?.f ?? 0));

  console.log(
    `[b2-enrich] total=${b2Entries.length} candidates=${candidates.length} missingCol=${missingCol} missingTip=${missingTip} missingRegister=${missingReg}`,
  );
  console.log(
    `[b2-enrich] top 10:`,
    candidates.slice(0, 10).map((e) => `${e.id}(f=${Math.round(freq[e.id]?.f ?? 0)})`).join(", "),
  );

  if (!apply) {
    console.log("[b2-enrich] dry-run mode (0 network calls). Pass --apply with OPENROUTER_API_KEY or OPENAI_API_KEY to enrich.");
    return;
  }

  const cached = new Map<string, Omit<EnrichRow, "id">>();
  if (existsSync(CACHE_PATH)) {
    for (const line of readFileSync(CACHE_PATH, "utf8").split("\n")) {
      if (!line.trim()) continue;
      const row = JSON.parse(line) as EnrichRow;
      if (row.id) cached.set(row.id, row);
    }
  }

  const todo = candidates.filter((e) => !cached.has(e.id)).slice(0, limit);
  if (todo.length > 0) {
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("FAIL: --apply requires OPENROUTER_API_KEY or OPENAI_API_KEY in environment.");
      process.exit(1);
    }
    const baseUrl =
      parseArg("--base-url") ||
      (process.env.OPENROUTER_API_KEY ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1");
    const model =
      parseArg("--model") || (process.env.OPENROUTER_API_KEY ? "openai/gpt-4.1-mini" : "gpt-4.1-mini");

    const chunks: LexEntry[][] = [];
    for (let i = 0; i < todo.length; i += batchSize) chunks.push(todo.slice(i, i + batchSize));
    let done = 0;
    let nextIdx = 0;
    const workers = Array.from({ length: Math.min(concurrency, chunks.length) }, async () => {
      while (nextIdx < chunks.length) {
        const chunk = chunks[nextIdx++];
        const patches = await fetchBatch(chunk, apiKey, baseUrl, model);
        for (const [id, patch] of patches) {
          cached.set(id, patch);
          appendFileSync(CACHE_PATH, JSON.stringify({ id, ...patch }) + "\n", "utf8");
        }
        done += chunk.length;
        console.log(`[b2-enrich] fetched ${done}/${todo.length} (${cached.size} total cached)`);
      }
    });
    await Promise.all(workers);
  }

  let updated = 0;
  for (const e of lex.entries) {
    if (e.aliasOf) continue;
    const patch = cached.get(e.id);
    if (!patch) continue;
    let touched = false;
    if (!(e.col?.length) && patch.col?.length) {
      e.col = patch.col;
      touched = true;
    }
    if (!e.tip?.trim() && patch.tip) {
      e.tip = patch.tip;
      touched = true;
    }
    if (!e.register && patch.register) {
      e.register = patch.register;
      touched = true;
    }
    if (!(e.syn?.length) && patch.syn?.length) {
      e.syn = patch.syn;
      touched = true;
    }
    if (touched) updated++;
  }
  writeFileSync(LEXICON_PATH, JSON.stringify(lex, null, 2) + "\n", "utf8");
  console.log(`[b2-enrich] applied updates to ${updated} entries in data/lexicon.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
