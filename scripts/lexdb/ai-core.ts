/**
 * Shared LexDB AI enrichment core: prompts, payload builders and DB appliers used by
 * scripts/lexdb/ai-run.ts (OpenRouter) and scripts/lexdb/session-batch.ts (in-session batches).
 */
import type { DatabaseSync } from "node:sqlite";

export const VALID_POS = new Set([
  "n.m.", "n.f.", "n.m./f.", "n.", "v.", "adj.", "adv.", "prép.", "conj.", "pron.", "interj.", "loc.",
]);

export function normalizeZh(s: string): string {
  return s
    .normalize("NFC")
    .trim()
    .replace(/;/g, "；")
    .replace(/,/g, "，")
    .replace(/\s*；\s*/g, "；")
    .replace(/\s+/g, " ")
    .replace(/^[；，\s]+|[；，\s]+$/g, "");
}

export function extractJson(text: string): unknown {
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

export const SYSTEM_TOP15K = `You are a meticulous French-to-Simplified-Chinese lexicographer writing entries in the style of 法语助手 (frdic):
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

export const SYSTEM_LONGTAIL = `You are a concise French-to-Simplified-Chinese dictionary editor (frdic style).
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

export const SYSTEM_REVIEW = `You are an independent French-Chinese dictionary reviewer auditing AI-generated entries and multi-source conflicts against French definitions.
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

export function buildGenPayload(db: DatabaseSync, lemmaId: string, tier: "top15k" | "mid25k" | "longtail") {
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
       WHERE s.lemma_id = ? AND s.src_json != '["omw"]' ORDER BY pb.sort_order, s.sort_order`,
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
      frDefs: frDefs.slice(0, 4),
    };
  }

  const untranslatedEx = db
    .prepare("SELECT id AS exId, pos, fr FROM example WHERE lemma_id = ? AND zh = '' AND src = 'wikt-fr' ORDER BY id LIMIT 3")
    .all(lemmaId) as { exId: number; pos: string | null; fr: string }[];
  const phrCnt = (db.prepare("SELECT count(*) AS c FROM phrase WHERE lemma_id = ?").get(lemmaId) as { c: number }).c;

  if (tier === "mid25k") {
    return {
      id: lemma.id,
      w: lemma.w,
      pos: posRows.map((r) => r.p),
      existingSenses: existingSenses.map((s) => ({ p: s.p, fr: s.fr ?? undefined, zh: s.zh_merged })),
      frDefs: frDefs.slice(0, 4),
      untranslatedExamples: untranslatedEx.slice(0, 2),
      needPhrases: phrCnt < 3,
    };
  }

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

export function applyGenResult(db: DatabaseSync, lemmaId: string, model: string, entry: any) {
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

  // Existing non-OMW-only zh tokens to prevent duplicate AI senses
  const existingZhs = new Set(
    (db.prepare("SELECT zh_merged FROM sense WHERE lemma_id = ? AND src_json != '[\"omw\"]'").all(lemmaId) as { zh_merged: string }[]).map((r) =>
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

export function buildReviewPayload(db: DatabaseSync, lemmaId: string) {
  const lemma = db.prepare("SELECT id, w FROM lemma WHERE id = ?").get(lemmaId) as { id: string; w: string };
  const frDefs = db
    .prepare("SELECT p, gloss FROM fr_def WHERE lemma_id = ? ORDER BY id LIMIT 6")
    .all(lemmaId) as { p: string; gloss: string }[];
  const openSenses = db
    .prepare(
      `SELECT pb.p, s.zh_merged AS zh, s.src_json AS src
       FROM sense s JOIN pos_block pb ON pb.id = s.pos_block_id
       WHERE s.lemma_id = ? AND s.src_json NOT LIKE '%"ai"%' AND s.src_json != '["omw"]' ORDER BY pb.sort_order, s.sort_order`,
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

export function applyReviewResult(db: DatabaseSync, lemmaId: string, rev: any, reviewModel: string) {
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
  ).run(summary, reviewModel, JSON.stringify(rev), new Date().toISOString(), lemmaId);

  return { okCount, fixCount, rejectCount };
}
