import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { applyBatch, claim, ensureBatchTable, release, setTradMap, status, toSimp, validateOutput } from "./session-batch.ts";

function makeTestDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE lemma (
      id TEXT PRIMARY KEY,
      w TEXT NOT NULL,
      folded TEXT NOT NULL,
      ipa TEXT,
      level TEXT,
      rank INTEGER,
      freq REAL DEFAULT 0,
      atlas_id TEXT,
      conj INTEGER NOT NULL DEFAULT 0,
      family TEXT,
      is_phrase INTEGER NOT NULL DEFAULT 0,
      sources_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE pos_block (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lemma_id TEXT NOT NULL REFERENCES lemma(id) ON DELETE CASCADE,
      p TEXT NOT NULL,
      g TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(lemma_id, p)
    );
    CREATE TABLE sense (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pos_block_id INTEGER NOT NULL REFERENCES pos_block(id) ON DELETE CASCADE,
      lemma_id TEXT NOT NULL REFERENCES lemma(id) ON DELETE CASCADE,
      fr TEXT,
      reg TEXT,
      zh_merged TEXT NOT NULL DEFAULT '',
      src_json TEXT NOT NULL DEFAULT '[]',
      conf INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE gloss (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sense_id INTEGER REFERENCES sense(id) ON DELETE SET NULL,
      lemma_id TEXT NOT NULL REFERENCES lemma(id) ON DELETE CASCADE,
      pos TEXT NOT NULL,
      zh TEXT NOT NULL,
      zh_norm TEXT NOT NULL,
      fr_label TEXT,
      src TEXT NOT NULL,
      conf INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE example (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lemma_id TEXT NOT NULL REFERENCES lemma(id) ON DELETE CASCADE,
      sense_id INTEGER REFERENCES sense(id) ON DELETE SET NULL,
      pos TEXT,
      fr TEXT NOT NULL,
      zh TEXT NOT NULL DEFAULT '',
      hl_start INTEGER,
      hl_end INTEGER,
      src TEXT NOT NULL,
      ref TEXT
    );
    CREATE TABLE phrase (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lemma_id TEXT NOT NULL REFERENCES lemma(id) ON DELETE CASCADE,
      fr TEXT NOT NULL,
      zh TEXT NOT NULL DEFAULT '',
      src TEXT NOT NULL,
      conf INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE fr_def (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lemma_id TEXT NOT NULL REFERENCES lemma(id) ON DELETE CASCADE,
      p TEXT NOT NULL,
      gloss TEXT NOT NULL,
      ex TEXT,
      reg TEXT,
      src TEXT NOT NULL DEFAULT 'wikt-fr'
    );
    CREATE TABLE ai_job (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lemma_id TEXT NOT NULL UNIQUE REFERENCES lemma(id) ON DELETE CASCADE,
      tier TEXT NOT NULL,
      needs TEXT NOT NULL DEFAULT '',
      gen_status TEXT NOT NULL DEFAULT 'pending',
      review_status TEXT NOT NULL DEFAULT 'pending',
      gen_model TEXT,
      review_model TEXT,
      result_json TEXT,
      review_json TEXT,
      updated_at TEXT
    );
    CREATE TABLE review_flag (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lemma_id TEXT NOT NULL REFERENCES lemma(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      detail TEXT NOT NULL,
      resolved INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE report (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  ensureBatchTable(db);
  for (const [id, w, rank, p] of [
    ["acheter", "acheter", 120, "v."],
    ["vendre", "vendre", 180, "v."],
    ["donner", "donner", 220, "v."],
  ] as const) {
    db.prepare("INSERT INTO lemma(id, w, folded, rank, sources_json) VALUES (?, ?, ?, ?, '[\"lexique\"]')").run(id, w, id, rank);
    db.prepare("INSERT INTO pos_block(lemma_id, p, sort_order) VALUES (?, ?, 0)").run(id, p);
    db.prepare("INSERT INTO fr_def(lemma_id, p, gloss) VALUES (?, ?, ?)").run(id, p, `sens de ${w}`);
    db.prepare("INSERT INTO ai_job(lemma_id, tier, gen_status, review_status) VALUES (?, 'top15k', 'pending', 'pending')").run(id);
  }
  return db;
}

test("validateOutput checks gen and review payloads strictly", () => {
  assert.deepEqual(
    validateOutput("gen", { entries: [{ id: "acheter", senses: [{ p: "v.", zh: "买；购买" }] }] }, ["acheter"]),
    [],
  );
  const badPos = validateOutput("gen", { entries: [{ id: "acheter", senses: [{ p: "verb", zh: "买" }] }] }, ["acheter"]);
  assert.ok(badPos.some((e) => e.includes(".p")));

  const noCjk = validateOutput("gen", { entries: [{ id: "acheter", senses: [{ p: "v.", zh: "buy" }] }] }, ["acheter"]);
  assert.ok(noCjk.some((e) => e.includes(".zh")));

  const badId = validateOutput("gen", { entries: [{ id: "inconnu", senses: [{ p: "v.", zh: "未知" }] }] }, ["acheter"]);
  assert.ok(badId.some((e) => e.includes("not in this batch")));

  const badFix = validateOutput("review", { reviews: [{ id: "acheter", senseReviews: [{ senseId: 1, verdict: "fix", fixedZh: "abc" }] }] }, ["acheter"]);
  assert.ok(badFix.some((e) => e.includes("fixedZh")));
});

test("session-batch claim, apply (with trad->simp & missing reset), review, and release", () => {
  const db = makeTestDb();
  const dir = mkdtempSync(join(tmpdir(), "lexdb-session-test-"));
  setTradMap({ 買: "买" });
  try {
    // 1) Claim 2 gen jobs
    const c1 = claim(db, { phase: "gen", tier: "top15k", size: 2, worker: "w1", dir });
    assert.equal(c1.count, 2);
    assert.ok(c1.batchId && c1.inputPath && existsSync(c1.inputPath));
    const input = JSON.parse(readFileSync(c1.inputPath, "utf8"));
    assert.equal(input.entries.length, 2);

    const claimedJobs = db.prepare("SELECT lemma_id, gen_status FROM ai_job ORDER BY lemma_id").all() as { lemma_id: string; gen_status: string }[];
    assert.deepEqual(
      claimedJobs.map((r) => [r.lemma_id, r.gen_status]),
      [
        ["acheter", "claimed"],
        ["donner", "pending"],
        ["vendre", "claimed"],
      ],
    );

    // 2) Apply only 1 of 2 (acheter with traditional 買 -> 买), vendre missing -> returns to pending
    const a1 = applyBatch(db, {
      batchId: c1.batchId!,
      model: "opus-test",
      dir,
      parsed: {
        entries: [
          {
            id: "acheter",
            senses: [{ p: "v.", fr: "sens de acheter", zh: "買；购买" }],
            phrases: [{ fr: "acheter en ligne", zh: "網購買东西" }],
          },
        ],
      },
    });
    assert.equal(a1.applied, 1);
    assert.equal(a1.missing, 1);

    const acheterJob = db.prepare("SELECT gen_status, review_status, gen_model FROM ai_job WHERE lemma_id = 'acheter'").get() as Record<string, string>;
    assert.equal(acheterJob.gen_status, "done");
    assert.equal(acheterJob.review_status, "pending");
    assert.equal(acheterJob.gen_model, "session:opus-test");

    const acheterSense = db.prepare("SELECT id, zh_merged, src_json, conf FROM sense WHERE lemma_id = 'acheter'").get() as {
      id: number;
      zh_merged: string;
      src_json: string;
      conf: number;
    };
    assert.equal(acheterSense.zh_merged, "买；购买");
    assert.equal(acheterSense.src_json, '["ai"]');
    assert.equal(acheterSense.conf, 0);

    const vendreJob = db.prepare("SELECT gen_status FROM ai_job WHERE lemma_id = 'vendre'").get() as { gen_status: string };
    assert.equal(vendreJob.gen_status, "pending");

    // 3) Claim review -> apply verdict ok -> ai-reviewed conf 1
    const rc = claim(db, { phase: "review", tier: "top15k", size: 5, worker: "rev1", dir });
    assert.equal(rc.count, 1);
    const revInput = JSON.parse(readFileSync(rc.inputPath!, "utf8"));
    assert.equal(revInput.entries[0].id, "acheter");

    const acheterPhrase = db.prepare("SELECT id FROM phrase WHERE lemma_id = 'acheter'").get() as { id: number };
    const ra = applyBatch(db, {
      batchId: rc.batchId!,
      model: "opus-rev",
      dir,
      parsed: {
        reviews: [
          {
            id: "acheter",
            senseReviews: [{ senseId: acheterSense.id, verdict: "ok" }],
            phraseReviews: [{ phraseId: acheterPhrase.id, verdict: "ok" }],
          },
        ],
      },
    });
    assert.equal(ra.applied, 1);

    const reviewedSense = db.prepare("SELECT src_json, conf FROM sense WHERE id = ?").get(acheterSense.id) as { src_json: string; conf: number };
    assert.equal(reviewedSense.src_json, '["ai-reviewed"]');
    assert.equal(reviewedSense.conf, 1);
    const revJob = db.prepare("SELECT review_status, review_model FROM ai_job WHERE lemma_id = 'acheter'").get() as Record<string, string>;
    assert.equal(revJob.review_status, "ok");
    assert.equal(revJob.review_model, "session:opus-rev");

    // 4) Claim remaining and release(db, 0) resets claimed -> pending
    const c2 = claim(db, { phase: "gen", tier: "top15k", size: 5, worker: "w2", dir });
    assert.equal(c2.count, 2);
    const rel = release(db, 0);
    assert.deepEqual(rel.released, [c2.batchId]);
    const st = status(db);
    assert.ok(Array.isArray(st.jobs) && Array.isArray(st.batches));
    const afterVend = db.prepare("SELECT gen_status FROM ai_job WHERE lemma_id = 'vendre'").get() as { gen_status: string };
    assert.equal(afterVend.gen_status, "pending");
  } finally {
    setTradMap(null);
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("toSimp converts traditional characters without corrupting common simplified chars", () => {
  setTradMap(null);
  try {
    assert.equal(toSimp("喜欢甚至著名显著转层类强傳統"), "喜欢甚至著名显著转层类强传统");
  } finally {
    setTradMap(null);
  }
});

test("mid25k claim ignores OMW-only senses and caps examples at 2; review enforces all item IDs", () => {
  const db = makeTestDb();
  const dir = mkdtempSync(join(tmpdir(), "lexdb-mid25k-test-"));
  try {
    db.prepare("INSERT INTO lemma(id, w, folded, rank, is_phrase, sources_json) VALUES ('ecueil', 'écueil', 'ecueil', 15003, 0, '[\"omw\"]')").run();
    const pbRes = db.prepare("INSERT INTO pos_block(lemma_id, p, sort_order) VALUES ('ecueil', 'n.m.', 0)").run();
    db.prepare("INSERT INTO sense(pos_block_id, lemma_id, zh_merged, src_json, conf, sort_order) VALUES (?, 'ecueil', '收帆；缩帆', '[\"omw\"]', 1, 0)").run(Number(pbRes.lastInsertRowid));
    db.prepare("INSERT INTO fr_def(lemma_id, p, gloss) VALUES ('ecueil', 'n.m.', 'Rocher à fleur d''eau.')").run();
    for (let i = 1; i <= 3; i++) {
      db.prepare("INSERT INTO example(lemma_id, fr, zh, src) VALUES ('ecueil', ?, '', 'wikt-fr')").run(`Exemple ${i} sur un écueil.`);
    }
    db.prepare("INSERT INTO ai_job(lemma_id, tier, gen_status, review_status) VALUES ('ecueil', 'longtail', 'pending', 'pending')").run();

    const c1 = claim(db, { phase: "gen", tier: "mid25k", size: 5, worker: "m1", dir });
    assert.equal(c1.count, 1);
    const inp = JSON.parse(readFileSync(c1.inputPath!, "utf8"));
    assert.equal(inp.tier, "mid25k");
    assert.equal(inp.entries[0].existingSenses.length, 0);
    assert.equal(inp.entries[0].untranslatedExamples.length, 2);

    const a1 = applyBatch(db, {
      batchId: c1.batchId!,
      model: "m-gen",
      dir,
      parsed: {
        entries: [{ id: "ecueil", senses: [{ p: "n.m.", zh: "暗礁；障碍" }] }],
      },
    });
    assert.equal(a1.applied, 1);

    const rc = claim(db, { phase: "review", tier: "mid25k", size: 5, worker: "m2", dir });
    assert.equal(rc.count, 1);
    const revInp = JSON.parse(readFileSync(rc.inputPath!, "utf8"));
    assert.equal(revInp.entries[0].openSenses.length, 0);
    const sid = revInp.entries[0].aiSenses[0].senseId;

    assert.throws(
      () =>
        applyBatch(db, {
          batchId: rc.batchId!,
          model: "m-rev",
          dir,
          parsed: { reviews: [{ id: "ecueil", senseReviews: [] }] },
        }),
      /missing senseId/,
    );

    const revErrs = validateOutput(
      "review",
      { reviews: [{ id: "ecueil", senseReviews: [{ senseId: sid, verdict: "ok" }], exampleReviews: [], phraseReviews: [] }] },
      ["ecueil"],
      new Map([["ecueil", { senseIds: [sid], exIds: [99], phraseIds: [88] }]]),
    );
    assert.ok(revErrs.some((e) => e.includes("missing exId 99")));
    assert.ok(revErrs.some((e) => e.includes("missing phraseId 88")));
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
