import assert from "node:assert/strict";
import { test } from "node:test";
import { CORE_DECK, emptyProgress, hasAnyProgress } from "../store/store";
import { canonicalHash, decidePull, hasBackupProgress, summarizeBackup } from "./decide";

const sampleCard = { due: 100, s: 2, d: 5, el: 0, sd: 1, ls: 0, reps: 1, lapses: 0, st: 2, seen: 1 };

test("canonicalHash strips exported timestamp and stays deterministic", async () => {
  const base = {
    app: "word-atlas",
    version: 2,
    exported: "2026-11-22T00:00:00.000Z",
    progress: { ...emptyProgress("francais-b2-lexicon"), cards: { chat: sampleCard } },
    settings: { theme: "dark" },
  };
  const a = JSON.stringify(base, null, 1);
  const b = JSON.stringify({ ...base, exported: "2026-11-25T12:34:56.789Z" });
  const c = JSON.stringify({
    ...base,
    exported: "2026-11-22T00:00:00.000Z",
    progress: { ...base.progress, cards: { chat: { ...sampleCard, reps: 2 } } },
  });

  const ha = await canonicalHash(a);
  const hb = await canonicalHash(b);
  const hc = await canonicalHash(c);

  assert.match(ha, /^[0-9a-f]{64}$/);
  assert.equal(ha, hb);
  assert.notEqual(ha, hc);
});

test("canonicalHash does not corrupt essays containing the word exported", async () => {
  const a = JSON.stringify({
    app: "word-atlas",
    version: 2,
    exported: "2026-11-22T00:00:00.000Z",
    progress: {
      ...emptyProgress("francais-b2-lexicon"),
      essays: [{ id: "e1", task: "t", text: 'He said "exported": "keep me"', created: 1 }],
    },
  });
  const b = JSON.stringify({
    app: "word-atlas",
    version: 2,
    exported: "2026-11-22T01:00:00.000Z",
    progress: {
      ...emptyProgress("francais-b2-lexicon"),
      essays: [{ id: "e1", task: "t", text: 'He said "exported": "changed"', created: 1 }],
    },
  });
  assert.notEqual(await canonicalHash(a), await canonicalHash(b));
});

test("summarizeBackup extracts exported, counts, and latest study day", () => {
  const json = JSON.stringify({
    app: "word-atlas",
    version: 2,
    exported: "2026-11-22T08:30:00.000Z",
    progress: {
      ...emptyProgress("francais-b2-lexicon"),
      cards: { a: sampleCard, b: sampleCard },
      essays: [{ id: "e1" }],
      texts: [{ id: "t1" }, { id: "t2" }, { id: "t3" }],
      days: {
        "2026-11-18": { n: 2, r: 4, c: 3, t: 60 },
        "2026-11-20": { n: 1, r: 5, c: 5, t: 90 },
      },
      conjDays: {
        "2026-11-21": { n: 1, r: 2, c: 2 },
      },
    },
  });

  assert.deepEqual(summarizeBackup(json), {
    exported: "2026-11-22T08:30:00.000Z",
    cards: 2,
    essays: 1,
    texts: 3,
    lastDay: "2026-11-21",
  });

  assert.deepEqual(summarizeBackup("{not-json"), {
    exported: null,
    cards: 0,
    essays: 0,
    texts: 0,
    lastDay: null,
  });
});

test("hasBackupProgress and hasAnyProgress detect real user data cleanly", () => {
  const freshWithCore = {
    ...emptyProgress("francais-b2-lexicon"),
    coreMigrated: true,
    decks: [{ id: CORE_DECK, name: "初始词本", created: 0, words: ["w1", "w2"] }],
  };
  assert.equal(hasAnyProgress(freshWithCore), false);
  assert.equal(hasBackupProgress(JSON.stringify({ app: "word-atlas", version: 2, progress: freshWithCore })), false);

  assert.equal(
    hasBackupProgress(
      JSON.stringify({
        app: "word-atlas",
        version: 2,
        progress: { ...freshWithCore, cards: { w1: sampleCard } },
      }),
    ),
    true,
  );
  assert.equal(
    hasBackupProgress(
      JSON.stringify({
        app: "word-atlas",
        version: 2,
        progress: { ...freshWithCore, essays: [{ id: "e1", task: "t", text: "bonjour", created: 1 }] },
      }),
    ),
    true,
  );
  assert.equal(
    hasBackupProgress(
      JSON.stringify({
        app: "word-atlas",
        version: 2,
        progress: { ...freshWithCore, bookmarks: ["w1"] },
      }),
    ),
    true,
  );
  assert.equal(hasBackupProgress("not json"), false);
  assert.equal(hasBackupProgress(JSON.stringify({ app: "word-atlas" })), false);
});

test("decidePull handles every pull/push/conflict/noop branch", () => {
  // 1. Remote 404 (null)
  assert.equal(
    decidePull({ localHash: "H1", lastSyncedHash: null, localHasProgress: false, remote: null }),
    "noop",
  );
  assert.equal(
    decidePull({ localHash: "H1", lastSyncedHash: null, localHasProgress: true, remote: null }),
    "push-create",
  );

  // 2. Remote 304 (not-modified)
  assert.equal(
    decidePull({ localHash: "H1", lastSyncedHash: "H1", localHasProgress: true, remote: "not-modified" }),
    "noop",
  );
  assert.equal(
    decidePull({ localHash: "H2", lastSyncedHash: "H1", localHasProgress: true, remote: "not-modified" }),
    "push",
  );

  // 3. Remote 200 matching localHash directly
  assert.equal(
    decidePull({ localHash: "H1", lastSyncedHash: null, localHasProgress: true, remote: { hash: "H1" } }),
    "noop",
  );
  assert.equal(
    decidePull({ localHash: "H1", lastSyncedHash: "H0", localHasProgress: true, remote: { hash: "H1" } }),
    "noop",
  );

  // 4. First pair (lastSyncedHash === null) with differing remote
  assert.equal(
    decidePull({ localHash: "H_empty", lastSyncedHash: null, localHasProgress: false, remote: { hash: "H_remote" } }),
    "apply-remote",
  );
  assert.equal(
    decidePull({ localHash: "H_local", lastSyncedHash: null, localHasProgress: true, remote: { hash: "H_remote" } }),
    "conflict",
  );

  // 5. Three-way comparison when lastSyncedHash is known
  assert.equal(
    decidePull({ localHash: "H1", lastSyncedHash: "H1", localHasProgress: true, remote: { hash: "H2" } }),
    "apply-remote",
  );
  assert.equal(
    decidePull({ localHash: "H2", lastSyncedHash: "H1", localHasProgress: true, remote: { hash: "H1" } }),
    "push",
  );
  assert.equal(
    decidePull({ localHash: "H2", lastSyncedHash: "H1", localHasProgress: true, remote: { hash: "H3" } }),
    "conflict",
  );
});
