import assert from "node:assert/strict";
import { test } from "node:test";
import { migrateAliases, resolveAlias } from "./aliases.ts";
import type { Progress } from "./store.ts";

const card = (over: Partial<Record<string, number>> = {}) => ({ due: 1000, s: 5, d: 5, el: 0, sd: 3, ls: 0, reps: 3, lapses: 0, st: 2 as const, seen: 1, ...over });
const base = (over: Partial<Progress> = {}): Progress => ({ version: 2, datasetId: "d", cards: {}, bookmarks: [], days: {}, typing: [], session: null, mistakes: [], ...over });
const ALIASES = { "ami-m": "ami-2", "voeu-m": "voeu-n", ami: "ami-2" };

test("resolveAlias follows links and stops on cycles", () => {
  assert.equal(resolveAlias("ami-m", ALIASES), "ami-2");
  assert.equal(resolveAlias("ami-2", ALIASES), "ami-2");
  const cyc = resolveAlias("x", { x: "y", y: "x" });
  assert.ok(cyc === "x" || cyc === "y", "a cycle stops at one of its members");
});

test("case 1 — only the alias has a record: it moves to the primary id", () => {
  const p = base({ cards: { "ami-m": card({ reps: 4 }) }, bookmarks: ["ami-m"], mistakes: ["ami-m"] });
  const { progress, report } = migrateAliases(p, ALIASES);
  assert.deepEqual(Object.keys(progress.cards), ["ami-2"]);
  assert.equal(progress.cards["ami-2"].reps, 4, "history is moved unchanged");
  assert.deepEqual(progress.bookmarks, ["ami-2"]);
  assert.deepEqual(progress.mistakes, ["ami-2"]);
  assert.deepEqual(report.moved, ["ami-m→ami-2"]);
  assert.equal(progress.aliasArchive, undefined, "nothing archived when there was no conflict");
});

test("case 2 — only the primary has a record: nothing changes", () => {
  const p = base({ cards: { "ami-2": card({ reps: 2 }) }, bookmarks: ["ami-2"] });
  const { progress, report } = migrateAliases(p, ALIASES);
  assert.equal(report.changed, false);
  assert.strictEqual(progress, p, "same object returned when nothing changes");
});

test("case 3 — both ids have records: the primary is kept as-is, the alias is archived, nothing is added up", () => {
  const primary = card({ reps: 3, s: 5, due: 2000 });
  const aliasCard = card({ reps: 9, s: 40, due: 9000 });
  const p = base({ cards: { "ami-2": primary, "ami-m": aliasCard } });
  const { progress, report } = migrateAliases(p, ALIASES);
  assert.deepEqual(progress.cards["ami-2"], primary, "primary schedule untouched: no reps added, no higher stability taken");
  assert.equal(progress.cards["ami-m"], undefined);
  assert.deepEqual(progress.aliasArchive?.["ami-m"], aliasCard, "alias record kept intact for recovery");
  assert.deepEqual(report.conflicts, [{ alias: "ami-m", primary: "ami-2" }]);
});

test("case 4 — running the migration again changes nothing (idempotent)", () => {
  const p = base({ cards: { "ami-m": card({ reps: 4 }) }, bookmarks: ["ami-m", "ami-2"] });
  const once = migrateAliases(p, ALIASES).progress;
  const twice = migrateAliases(once, ALIASES);
  assert.equal(twice.report.changed, false);
  assert.deepEqual(twice.progress.cards, once.cards);
  assert.deepEqual(twice.progress.bookmarks, once.bookmarks);
  assert.deepEqual(once.bookmarks, ["ami-2"], "bookmark de-duplicated");
});

test("an unfinished session is re-pointed to the primary id", () => {
  const p = base({ session: { id: "s1", started: 1, steps: [{ id: "ami-m", kind: "meaning" }], index: 0, graded: { "ami-m": 3 }, newIds: ["ami-m"], reviewIds: [] } as never });
  const { progress } = migrateAliases(p, ALIASES);
  assert.equal(progress.session?.steps[0].id, "ami-2");
  assert.equal(progress.session?.graded["ami-2"], 3);
  assert.equal(progress.session?.graded["ami-m"], undefined);
});
