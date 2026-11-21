import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { lexdbBaseKey, lexdbFold, lexdbKey, zhBucket } from "../../src/lib/lexdb/types.ts";

const ROOT = resolve(import.meta.dirname, "../..");

test("Python common.py folding, shard key, and zhBucket match src/lib/lexdb/types.ts", () => {
  const samples = [
    "être",
    "État",
    "cœur",
    "œuf",
    "æquo",
    "à bientôt",
    "l'été",
    "L’école",
    "a",
    "123",
    "âge",
    "age#2",
    "comprendre",
    "co",
  ];
  const splits = ["co", "de", "pr"];
  const zhTerms = ["接待", "迎接", "（口）拿", "计算机科学", "A"];

  const pyCode = `
import json, sys
sys.path.insert(0, "scripts/lexdb")
from common import lexdb_fold, lexdb_base_key, lexdb_key, zh_bucket
samples = json.loads(sys.argv[1])
splits = set(json.loads(sys.argv[2]))
zh_terms = json.loads(sys.argv[3])
out = {
  "samples": [
    {
      "s": s,
      "fold": lexdb_fold(s),
      "base": lexdb_base_key(lexdb_fold(s)),
      "key": lexdb_key(lexdb_fold(s), splits),
    }
    for s in samples
  ],
  "zh": [{"t": t, "b": zh_bucket(t)} for t in zh_terms],
}
print(json.dumps(out, ensure_ascii=False))
`;

  const raw = execFileSync(
    "python3",
    ["-B", "-c", pyCode, JSON.stringify(samples), JSON.stringify(splits), JSON.stringify(zhTerms)],
    { cwd: ROOT, encoding: "utf8" },
  );
  const py = JSON.parse(raw) as {
    samples: { s: string; fold: string; base: string; key: string }[];
    zh: { t: string; b: number }[];
  };

  for (const row of py.samples) {
    const f = lexdbFold(row.s);
    assert.equal(row.fold, f, `fold mismatch for ${row.s}`);
    assert.equal(row.base, lexdbBaseKey(f), `baseKey mismatch for ${row.s}`);
    assert.equal(row.key, lexdbKey(f, splits), `key mismatch for ${row.s}`);
  }
  for (const row of py.zh) {
    assert.equal(row.b, zhBucket(row.t), `zhBucket mismatch for ${row.t}`);
  }
});
