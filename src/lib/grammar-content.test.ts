/**
 * Content checks of the 66 grammar points as shipped (public/atlas/grammar.json, built by scripts/build-grammar.ts
 * from data/grammar/): every point is there and explained, every drill can be answered, and the first-screen index
 * (grammar-meta.json) says the same as the full file.
 */
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import type { Drill, GrammarData, GrammarMeta, GrammarPoint } from "./grammar.ts";

const ROOT = resolve(import.meta.dirname, "../..");
const read = <T,>(p: string): T => JSON.parse(readFileSync(resolve(ROOT, p), "utf8")) as T;

const data = read<GrammarData>("public/atlas/grammar.json");
const meta = read<GrammarMeta>("public/atlas/grammar-meta.json");
const sourcePoints = [
  ...read<{ points: Omit<GrammarPoint, "drills">[] }>("data/grammar/points.json").points,
  ...read<{ points: Omit<GrammarPoint, "drills">[] }>("data/grammar/new-points.json").points,
];
const LEVELS = new Set(["A1", "A2", "B1", "B2"]);
const where = (p: GrammarPoint, i: number, d: Drill) => `${p.id} #${i} (${d.k}) ${"s" in d ? d.s.slice(0, 60) : ""}`;

test("all 66 grammar points are built from the source files, once each, with a valid CEFR level", () => {
  assert.equal(data.v, 1);
  assert.equal(data.points.length, 66);
  const ids = data.points.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, "unique ids");
  assert.deepEqual([...ids].sort(), sourcePoints.map((p) => p.id).sort(), "every source point is built, nothing else");
  for (const p of data.points) assert.ok(LEVELS.has(p.level), `${p.id}: level ${p.level}`);
  for (const lv of LEVELS) assert.ok(data.points.some((p) => p.level === lv), `level ${lv} has points`);
});

test("every point is explained: title, French name, intro, rules with examples, and enough drills", () => {
  for (const p of data.points) {
    assert.ok(p.title.trim() && p.fr.trim() && p.intro.trim(), `${p.id}: title / fr / intro`);
    assert.ok(p.rules.length > 0, `${p.id}: rules`);
    for (const r of p.rules) assert.ok(JSON.stringify(r).length > 20, `${p.id}: empty rule`);
    assert.ok(p.drills.length >= 10, `${p.id}: only ${p.drills.length} drills`);
    for (const id of [...(p.related ?? []), ...(p.prereq ?? [])]) assert.ok(data.points.some((q) => q.id === id), `${p.id}: unknown linked point ${id}`);
  }
});

test("every drill can be answered: blanks inside the sentence, the answer among distinct options, accepted answers given", () => {
  let n = 0;
  for (const p of data.points) {
    p.drills.forEach((d, i) => {
      n++;
      const at = where(p, i, d);
      assert.ok(d.s.trim(), `${at}: sentence`);
      assert.ok(d.z.trim(), `${at}: Chinese`);
      assert.ok(d.y.trim(), `${at}: explanation`);
      if (d.k === "c" || d.k === "t" || d.k === "f") {
        const [a, b] = d.b;
        assert.ok(Number.isInteger(a) && Number.isInteger(b) && 0 <= a && a < b && b <= d.s.length, `${at}: blank ${d.b}`);
      }
      if (d.k === "c") {
        const answer = d.s.slice(d.b[0], d.b[1]);
        assert.ok(d.o.length >= 2, `${at}: options`);
        assert.ok(d.o.includes(answer), `${at}: answer "${answer}" not among ${JSON.stringify(d.o)}`);
        assert.equal(new Set(d.o).size, d.o.length, `${at}: duplicate options ${JSON.stringify(d.o)}`);
        assert.ok(d.o.every((o) => o.trim()), `${at}: empty option`);
      } else if (d.k === "t") {
        assert.ok(d.a.length > 0 && d.a.every((x) => x.trim()), `${at}: accepted answers`);
        assert.ok(d.a.includes(d.s.slice(d.b[0], d.b[1])), `${at}: the sentence's own answer is accepted`);
      } else if (d.k === "f") {
        assert.ok(d.r.every((x) => x.trim()), `${at}: empty correction`);
        assert.ok(!d.r.includes(d.s.slice(d.b[0], d.b[1])), `${at}: the mistake is listed as its own correction`);
      } else if (d.k === "x") {
        assert.ok(d.q.trim() && d.h.trim(), `${at}: given sentence and instruction`);
        assert.ok(d.a.length > 0 && d.a.every((x) => x.trim()), `${at}: accepted answers`);
      } else if (d.k === "o") {
        assert.ok(d.t.length >= 2 && d.t.every((x) => x.trim()), `${at}: words to order`);
      }
    });
  }
  assert.ok(n > 3000, `only ${n} drills`);
});

test("grammar-meta.json lists exactly the points of grammar.json, in order, and stays small", () => {
  assert.equal(meta.v, 1);
  assert.deepEqual(
    meta.points,
    data.points.map((p) => ({ id: p.id, title: p.title, level: p.level, fr: p.fr, category: p.category })),
  );
  assert.ok(statSync(resolve(ROOT, "public/atlas/grammar-meta.json")).size < 20 * 1024, "grammar-meta.json < 20 KB");
});

test("malgré que is taught with the nuance of usage, not as an absolute ban", () => {
  const text = JSON.stringify(data);
  assert.ok(!text.includes("规范语法不接受"), "no absolute wording");
  assert.match(text, /malgré qu'il en ait/);
});
