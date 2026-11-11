import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCSV, upsertRows, emptyLexicon } from "./core.ts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");

test("the shipped CSV and JSON templates both import cleanly and idempotently", () => {
  const csv = parseCSV(readFileSync(resolve(root, "data/imports/TEMPLATE.csv"), "utf8")) as never;
  const json = JSON.parse(readFileSync(resolve(root, "data/imports/TEMPLATE.json"), "utf8"));
  const lex = emptyLexicon();
  const r1 = upsertRows(lex, csv);
  const r2 = upsertRows(lex, json);
  assert.equal(r1.issues.filter((i) => i.severity === "error").length, 0);
  assert.equal(r2.issues.filter((i) => i.severity === "error").length, 0);
  assert.equal(lex.entries.length, 2);
  const again = upsertRows(lex, csv);
  assert.equal(again.added, 0, "re-importing a template must not create entries");
});
