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
 *   tsx scripts/lexdb/ai-run.ts --full [--budget 60]
 */
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

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

const VALID_POS = new Set([
  "n.m.", "n.f.", "n.m./f.", "n.", "v.", "adj.", "adv.", "prép.", "conj.", "pron.", "interj.", "loc.",
]);

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

function normalizeZh(s: string): string {
  return s
    .normalize("NFC")
    .trim()
    .replace(/;/g, "；")
    .replace(/,/g, "，")
    .replace(/\s*；\s*/g, "；")
    .replace(/\s+/g, " ")
    .replace(/^[；，\s]+|[；，\s]+$/g, "");
}

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const a = cleaned.indexOf("{");
    const b = cleaned.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(cleaned.slice(a, b + 1));
    throw new Error(`Invalid JSON from model: ${cleaned.slice(0, 200)}`);
  }
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

const SYSTEM_TOP15K = `You are a meticulous French-to-Simplified-Chinese lexicographer writing entries in the style of 法语助手 (frdic):
- Group senses by part of speech (valid p: n.m., n.f., n., v., adj., adv., prép., conj., pron., interj., loc.).
- Each Chinese gloss must be concise, accurate Simplified Chinese, with multiple synonyms separated by "；" (fullwidth semicolon).
- Preserve all existing open senses: DO NOT repeat or translate senses whose Chinese meaning is already covered in existingSenses (even if existingSenses has no fr field).
- Only generate Chinese glosses for genuinely missing French senses given in frDefs (or core senses if frDefs is empty and existingSenses is empty). If existingSenses is empty, ALWAYS return at least 1 core sense in "senses" (for elided forms/contractions like d' or c', explain e.g. "de 的省音形式；……的；从"). Do NOT invent obscure or speculative senses.
- Translate every item in untranslatedExamples faithfully into natural Simplified Chinese.
- If needPhrases is true, supply 2 to 4 genuinely high-frequency everyday French collocations/phrases for this headword with concise Chinese glosses.

Respond with ONE JSON object strictly matching:
{
  "entries": [
    {
      "id": "<lemma_id>",
      "senses": [{ "p": "<pos>", "fr": "<matching French sense or short gloss>", "reg": "<optional: 书|俗|旧|转|技|省>", "zh": "<中文义项1；中文义项2>" }],
      "examples": [{ "exId": 123, "zh": "<中文例句译文>" }],
      "phrases": [{ "fr": "<法语常用搭配>", "zh": "<中文释义>" }]
    }
  ]
}`;

const SYSTEM_LONGTAIL = `You are a concise French-to-Simplified-Chinese dictionary editor (frdic style).
For each French word lacking Chinese glosses, provide 1 to 3 core Simplified Chinese glosses grouped by POS (valid p: n.m., n.f., n., v., adj., adv., prép., conj., pron., interj., loc.), separated by "；". Use frDefs when provided; do not invent rare senses.

Respond with ONE JSON object strictly matching:
{
  "entries": [
    {
      "id": "<lemma_id>",
      "senses": [{ "p": "<pos>", "zh": "<中文义项1；中文义项2>" }]
    }
  ]
}`;

const SYSTEM_REVIEW = `You are an independent French-Chinese dictionary reviewer auditing AI-generated entries and multi-source conflicts against French definitions.
For each word:
1. Check each AI sense (aiSenses), AI example translation (aiExamples), and AI phrase (aiPhrases).
   - "ok": accurate, concise Simplified Chinese matching the French sense/example and not duplicating openSenses.
   - "fix": minor wording/punctuation/accuracy issue — provide "fixedZh" in concise frdic Simplified Chinese ("；" separated).
   - "reject": hallucinated, off-meaning, redundant duplicate of openSenses, or unusable — omit/remove.
2. If "conflicts" are present (open sources disagreed), decide if one interpretation is valid ("ok"), needs unified/corrected gloss ("fix" + "fixedZh" + "p"), or should stay flagged ("reject").

Respond with ONE JSON object strictly matching:
{
  "reviews": [
    {
      "id": "<lemma_id>",
      "senseReviews": [{ "senseId": 123, "verdict": "ok|fix|reject", "fixedZh": "<if fix>", "reason": "<brief>" }],
      "exampleReviews": [{ "exId": 456, "verdict": "ok|fix|reject", "fixedZh": "<if fix>" }],
      "phraseReviews": [{ "phraseId": 789, "verdict": "ok|fix|reject", "fixedZh": "<if fix>" }],
      "conflictReview": { "verdict": "ok|fix|reject", "p": "<pos>", "fixedZh": "<if fix>", "reason": "<brief>" }
    }
  ]
}`;

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

function buildGenPayload(db: DatabaseSync, lemmaId: string, tier: "top15k" | "longtail") {
  const lemma = db.prepare("SELECT id, w, rank FROM lemma WHERE id = ?").get(lemmaId) as { id: string; w: string; rank: number };
  const posRows = db.prepare("SELECT id, p, g FROM pos_block WHERE lemma_id = ? ORDER BY sort_order").all(lemmaId) as {
    id: number;
    p: string;
    g: string | null;
  }[];
  const existingSenses = db
    .prepare(
      `SELECT pb.p, s.fr, s.zh_merged, s.src_json
       FROM sense s JOIN pos_block pb ON pb.id = s.pos_block_id
       WHERE s.lemma_id = ? ORDER BY pb.sort_order, s.sort_order`,
    )
    .all(lemmaId) as { p: string; fr: string | null; zh_merged: string; src_json: string }[];
  const frDefs = db
    .prepare("SELECT p, gloss, reg FROM fr_def WHERE lemma_id = ? ORDER BY id LIMIT 6")
    .all(lemmaId) as { p: string; gloss: string; reg: string | null }[];

  if (tier === "longtail") {
    return {
      id: lemma.id,
      w: lemma.w,
      pos: posRows.map((r) => r.p),
      frDefs: frDefs.slice(0, 3),
    };
  }

  const untranslatedEx = db
    .prepare("SELECT id AS exId, pos, fr FROM example WHERE lemma_id = ? AND zh = '' AND src = 'wikt-fr' ORDER BY id LIMIT 3")
    .all(lemmaId) as { exId: number; pos: string | null; fr: string }[];
  const phrCnt = (db.prepare("SELECT count(*) AS c FROM phrase WHERE lemma_id = ?").get(lemmaId) as { c: number }).c;

  return {
    id: lemma.id,
    w: lemma.w,
    pos: posRows.map((r) => r.p),
    existingSenses: existingSenses.map((s) => ({ p: s.p, fr: s.fr ?? undefined, zh: s.zh_merged })),
    frDefs,
    untranslatedExamples: untranslatedEx,
    needPhrases: phrCnt < 3,
  };
}

function applyGenResult(db: DatabaseSync, lemmaId: string, model: string, entry: any) {
  const posBlocks = db
    .prepare("SELECT id, p FROM pos_block WHERE lemma_id = ? ORDER BY sort_order")
    .all(lemmaId) as { id: number; p: string }[];
  const pbByP = new Map(posBlocks.map((r) => [r.p, r.id]));
  const primaryP = posBlocks[0]?.p ?? "n.";
  const primaryPbId = posBlocks[0]?.id;

  const ensurePosBlock = (pRaw: string): { pbId: number; p: string } => {
    const p = VALID_POS.has(pRaw) ? pRaw : primaryP;
    const existing = pbByP.get(p);
    if (existing) return { pbId: existing, p };
    if (p === "n.") {
      const nounAlt = posBlocks.find((x) => x.p.startsWith("n."));
      if (nounAlt) return { pbId: nounAlt.id, p: nounAlt.p };
    }
    const res = db
      .prepare("INSERT INTO pos_block(lemma_id, p, g, sort_order) VALUES (?, ?, ?, ?)")
      .run(lemmaId, p, p === "n.m." ? "m" : p === "n.f." ? "f" : null, posBlocks.length);
    const pbId = Number(res.lastInsertRowid);
    pbByP.set(p, pbId);
    posBlocks.push({ id: pbId, p });
    return { pbId, p };
  };

  // Existing zh tokens to prevent duplicate AI senses
  const existingZhs = new Set(
    (db.prepare("SELECT zh_merged FROM sense WHERE lemma_id = ?").all(lemmaId) as { zh_merged: string }[]).map((r) =>
      normalizeZh(r.zh_merged),
    ),
  );

  for (const s of entry?.senses ?? []) {
    const zh = normalizeZh(String(s?.zh ?? ""));
    if (!zh || existingZhs.has(zh)) continue;
    const { pbId, p } = ensurePosBlock(String(s?.p ?? primaryP));
    const fr = String(s?.fr ?? "").trim().slice(0, 180) || null;
    const reg = ["书", "俗", "旧", "转", "技", "省"].includes(String(s?.reg ?? "")) ? String(s.reg) : null;
    const maxOrder = (
      db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM sense WHERE pos_block_id = ?").get(pbId) as { m: number }
    ).m;
    const ins = db
      .prepare(
        "INSERT INTO sense(pos_block_id, lemma_id, fr, reg, zh_merged, src_json, conf, sort_order) VALUES (?, ?, ?, ?, ?, '[\"ai\"]', 0, ?)",
      )
      .run(pbId, lemmaId, fr, reg, zh, maxOrder + 1);
    db.prepare(
      "INSERT INTO gloss(sense_id, lemma_id, pos, zh, zh_norm, fr_label, src, conf) VALUES (?, ?, ?, ?, ?, ?, 'ai', 0)",
    ).run(Number(ins.lastInsertRowid), lemmaId, p, zh, zh, fr);
    existingZhs.add(zh);
  }

  for (const ex of entry?.examples ?? []) {
    const exId = Number(ex?.exId);
    const zh = normalizeZh(String(ex?.zh ?? ""));
    if (!Number.isInteger(exId) || !zh) continue;
    db.prepare("UPDATE example SET zh = ?, src = 'ai' WHERE id = ? AND lemma_id = ? AND zh = ''").run(zh, exId, lemmaId);
  }

  const seenPhr = new Set(
    (db.prepare("SELECT LOWER(fr) AS fr FROM phrase WHERE lemma_id = ?").all(lemmaId) as { fr: string }[]).map((r) => r.fr),
  );
  for (const ph of entry?.phrases ?? []) {
    const fr = String(ph?.fr ?? "").trim();
    const zh = normalizeZh(String(ph?.zh ?? ""));
    if (!fr || !zh || seenPhr.has(fr.toLowerCase()) || seenPhr.size >= 6) continue;
    seenPhr.add(fr.toLowerCase());
    db.prepare("INSERT INTO phrase(lemma_id, fr, zh, src, conf) VALUES (?, ?, ?, 'ai', 0)").run(lemmaId, fr, zh);
  }

  // Ensure lemma.sources_json includes "ai" if anything inserted
  const lemmaRow = db.prepare("SELECT sources_json FROM lemma WHERE id = ?").get(lemmaId) as { sources_json: string };
  const srcs = new Set<string>(JSON.parse(lemmaRow.sources_json));
  srcs.add("ai");
  db.prepare("UPDATE lemma SET sources_json = ? WHERE id = ?").run(JSON.stringify([...srcs].sort()), lemmaId);

  db.prepare(
    "UPDATE ai_job SET gen_status = 'done', review_status = 'pending', gen_model = ?, result_json = ?, updated_at = ? WHERE lemma_id = ?",
  ).run(model, JSON.stringify(entry), new Date().toISOString(), lemmaId);

  void primaryPbId;
}

function buildReviewPayload(db: DatabaseSync, lemmaId: string) {
  const lemma = db.prepare("SELECT id, w FROM lemma WHERE id = ?").get(lemmaId) as { id: string; w: string };
  const frDefs = db
    .prepare("SELECT p, gloss FROM fr_def WHERE lemma_id = ? ORDER BY id LIMIT 6")
    .all(lemmaId) as { p: string; gloss: string }[];
  const openSenses = db
    .prepare(
      `SELECT pb.p, s.zh_merged AS zh, s.src_json AS src
       FROM sense s JOIN pos_block pb ON pb.id = s.pos_block_id
       WHERE s.lemma_id = ? AND s.src_json NOT LIKE '%"ai"%' ORDER BY pb.sort_order, s.sort_order`,
    )
    .all(lemmaId) as { p: string; zh: string; src: string }[];
  const aiSenses = db
    .prepare(
      `SELECT s.id AS senseId, pb.p, s.fr, s.zh_merged AS zh
       FROM sense s JOIN pos_block pb ON pb.id = s.pos_block_id
       WHERE s.lemma_id = ? AND s.src_json LIKE '%"ai"%' ORDER BY s.id`,
    )
    .all(lemmaId) as { senseId: number; p: string; fr: string | null; zh: string }[];
  const aiExamples = db
    .prepare("SELECT id AS exId, fr, zh FROM example WHERE lemma_id = ? AND src = 'ai' ORDER BY id")
    .all(lemmaId) as { exId: number; fr: string; zh: string }[];
  const aiPhrases = db
    .prepare("SELECT id AS phraseId, fr, zh FROM phrase WHERE lemma_id = ? AND src = 'ai' ORDER BY id")
    .all(lemmaId) as { phraseId: number; fr: string; zh: string }[];
  const conflicts = db
    .prepare("SELECT id, detail FROM review_flag WHERE lemma_id = ? AND kind = 'gloss_conflict' AND resolved = 0")
    .all(lemmaId) as { id: number; detail: string }[];

  if (!aiSenses.length && !aiExamples.length && !aiPhrases.length && !conflicts.length) return null;

  return {
    id: lemma.id,
    w: lemma.w,
    frDefs,
    openSenses,
    aiSenses,
    aiExamples,
    aiPhrases,
    conflicts: conflicts.map((c) => JSON.parse(c.detail)),
  };
}

function applyReviewResult(db: DatabaseSync, lemmaId: string, rev: any) {
  let okCount = 0;
  let fixCount = 0;
  let rejectCount = 0;

  for (const sr of rev?.senseReviews ?? []) {
    const sid = Number(sr?.senseId);
    const v = String(sr?.verdict ?? "").toLowerCase();
    if (!Number.isInteger(sid)) continue;
    if (v === "ok") {
      db.prepare("UPDATE sense SET src_json = '[\"ai-reviewed\"]', conf = 1 WHERE id = ? AND lemma_id = ?").run(sid, lemmaId);
      db.prepare("UPDATE gloss SET src = 'ai-reviewed', conf = 1 WHERE sense_id = ? AND src = 'ai'").run(sid);
      okCount++;
    } else if (v === "fix" && sr?.fixedZh) {
      const fz = normalizeZh(String(sr.fixedZh));
      db.prepare("UPDATE sense SET zh_merged = ?, src_json = '[\"ai-reviewed\"]', conf = 1 WHERE id = ? AND lemma_id = ?").run(fz, sid, lemmaId);
      db.prepare("UPDATE gloss SET zh = ?, zh_norm = ?, src = 'ai-reviewed', conf = 1 WHERE sense_id = ? AND src = 'ai'").run(fz, fz, sid);
      fixCount++;
    } else if (v === "reject") {
      db.prepare("DELETE FROM gloss WHERE sense_id = ? AND src = 'ai'").run(sid);
      db.prepare("DELETE FROM sense WHERE id = ? AND lemma_id = ?").run(sid, lemmaId);
      db.prepare("INSERT INTO review_flag(lemma_id, kind, detail) VALUES (?, 'ai_reject', ?)").run(
        lemmaId,
        JSON.stringify({ senseId: sid, reason: sr?.reason ?? "rejected" }),
      );
      rejectCount++;
    }
  }

  for (const er of rev?.exampleReviews ?? []) {
    const exId = Number(er?.exId);
    const v = String(er?.verdict ?? "").toLowerCase();
    if (!Number.isInteger(exId)) continue;
    if (v === "ok") {
      db.prepare("UPDATE example SET src = 'ai-reviewed' WHERE id = ? AND lemma_id = ? AND src = 'ai'").run(exId, lemmaId);
      okCount++;
    } else if (v === "fix" && er?.fixedZh) {
      db.prepare("UPDATE example SET zh = ?, src = 'ai-reviewed' WHERE id = ? AND lemma_id = ?").run(
        normalizeZh(String(er.fixedZh)),
        exId,
        lemmaId,
      );
      fixCount++;
    } else if (v === "reject") {
      db.prepare("UPDATE example SET zh = '', src = 'wikt-fr' WHERE id = ? AND lemma_id = ? AND src = 'ai'").run(exId, lemmaId);
      rejectCount++;
    }
  }

  for (const pr of rev?.phraseReviews ?? []) {
    const pid = Number(pr?.phraseId);
    const v = String(pr?.verdict ?? "").toLowerCase();
    if (!Number.isInteger(pid)) continue;
    if (v === "ok") {
      db.prepare("UPDATE phrase SET src = 'ai-reviewed', conf = 1 WHERE id = ? AND lemma_id = ? AND src = 'ai'").run(pid, lemmaId);
      okCount++;
    } else if (v === "fix" && pr?.fixedZh) {
      db.prepare("UPDATE phrase SET zh = ?, src = 'ai-reviewed', conf = 1 WHERE id = ? AND lemma_id = ?").run(
        normalizeZh(String(pr.fixedZh)),
        pid,
        lemmaId,
      );
      fixCount++;
    } else if (v === "reject") {
      db.prepare("DELETE FROM phrase WHERE id = ? AND lemma_id = ? AND src = 'ai'").run(pid, lemmaId);
      rejectCount++;
    }
  }

  if (rev?.conflictReview) {
    const cr = rev.conflictReview;
    const v = String(cr.verdict ?? "").toLowerCase();
    if (v === "ok" || v === "fix") {
      db.prepare("UPDATE review_flag SET resolved = 1 WHERE lemma_id = ? AND kind = 'gloss_conflict'").run(lemmaId);
      if (v === "ok") okCount++;
      if (v === "fix" && cr.fixedZh) {
        fixCount++;
        const p = VALID_POS.has(cr.p) ? cr.p : undefined;
        const pb = p
          ? (db.prepare("SELECT id FROM pos_block WHERE lemma_id = ? AND p = ?").get(lemmaId, p) as { id: number } | undefined)
          : (db.prepare("SELECT id FROM pos_block WHERE lemma_id = ? ORDER BY sort_order LIMIT 1").get(lemmaId) as { id: number } | undefined);
        if (pb) {
          const fz = normalizeZh(String(cr.fixedZh));
          const hasAtlas = db
            .prepare("SELECT 1 FROM sense WHERE lemma_id = ? AND src_json LIKE '%\"atlas\"%' LIMIT 1")
            .get(lemmaId);
          if (!hasAtlas) {
            db.prepare(
              "UPDATE sense SET zh_merged = ?, src_json = '[\"ai-reviewed\"]', conf = 1 WHERE pos_block_id = ? AND sort_order = 0",
            ).run(fz, pb.id);
          }
        }
      }
    }
  }

  // Update lemma.sources_json
  const lemmaRow = db.prepare("SELECT sources_json FROM lemma WHERE id = ?").get(lemmaId) as { sources_json: string };
  const srcs = new Set<string>(JSON.parse(lemmaRow.sources_json));
  srcs.add("ai-reviewed");
  const stillHasUnreviewed =
    db.prepare("SELECT 1 FROM sense WHERE lemma_id = ? AND src_json = '[\"ai\"]' LIMIT 1").get(lemmaId) ||
    db.prepare("SELECT 1 FROM phrase WHERE lemma_id = ? AND src = 'ai' LIMIT 1").get(lemmaId) ||
    db.prepare("SELECT 1 FROM example WHERE lemma_id = ? AND src = 'ai' LIMIT 1").get(lemmaId);
  if (!stillHasUnreviewed) srcs.delete("ai");
  db.prepare("UPDATE lemma SET sources_json = ? WHERE id = ?").run(JSON.stringify([...srcs].sort()), lemmaId);

  const summary = rejectCount > 0 && okCount === 0 && fixCount === 0 ? "reject" : fixCount > 0 ? "fix" : "ok";
  db.prepare(
    "UPDATE ai_job SET review_status = ?, review_model = ?, review_json = ?, updated_at = ? WHERE lemma_id = ?",
  ).run(summary, MODEL_REVIEW, JSON.stringify(rev), new Date().toISOString(), lemmaId);

  return { okCount, fixCount, rejectCount };
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
      db.prepare("SELECT lemma_id FROM ai_job WHERE gen_status = 'pending' OR review_status = 'pending' ORDER BY id").all() as {
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
        db.exec("BEGIN");
        for (const id of chunk) {
          applyGenResult(db, id, model, byId.get(id) ?? { id, senses: [], examples: [], phrases: [] });
          runStats.genWords++;
        }
        db.exec("COMMIT");
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
      db.exec("BEGIN");
      for (const id of ids) {
        const stats = applyReviewResult(db, id, byId.get(id) ?? { id, senseReviews: [], exampleReviews: [], phraseReviews: [] });
        runStats.revWords++;
        runStats.ok += stats.okCount;
        runStats.fix += stats.fixCount;
        runStats.reject += stats.rejectCount;
      }
      db.exec("COMMIT");
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
