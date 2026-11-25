import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { hintBucket, lexdbBaseKey, lexdbFold, lexdbKey, zhBucket } from "../../src/lib/lexdb/types.ts";
import { hintKey } from "../../src/lib/lexdb/hints.ts";

const ROOT = resolve(import.meta.dirname, "../..");

test("Python common.py folding, shard key, hint keys, short_hint_zh, and zhBucket match TypeScript", () => {
  const samples = [
    "être",
    "État",
    "cœur",
    "œuf",
    "æquo",
    "à bientôt",
    "l'été",
    "L’école",
    "  s’il   vous plaît ",
    "a",
    "123",
    "âge",
    "age#2",
    "comprendre",
    "co",
    "construire",
    "con",
  ];
  const splits = ["co", "con", "de", "pr"];
  const zhTerms = ["接待", "迎接", "（口）拿", "计算机科学", "A"];
  const rawHints = [
    ["n.m. 活动板", "活动板"],
    ["adj. 震耳欲聋的；令人震惊的", "震耳欲聋的；令人震惊的"],
    ["n.m. 1.接弦战；2.碰撞", "接弦战；碰撞"],
    ["v.t. ①接受，同意；②接待", "接受；同意；接待"],
    ["n.m./f. （口）傻瓜", "傻瓜"],
    ["n.m.蓄电池；储压器n. 累积器", "蓄电池；储压器；累积器"],
    ["v.t.ind. 交替；轮流", "交替；轮流"],
    ["n.m.侄甥曾孙pl.~-~s-~x", "侄甥曾孙"],
  ] as const;

  const pyCode = `
import json, sys
sys.path.insert(0, "scripts/lexdb")
from common import lexdb_fold, lexdb_base_key, lexdb_key, zh_bucket, hint_bucket, hint_key, short_hint_zh
samples = json.loads(sys.argv[1])
splits = set(json.loads(sys.argv[2]))
zh_terms = json.loads(sys.argv[3])
raw_hints = json.loads(sys.argv[4])
out = {
  "samples": [
    {
      "s": s,
      "fold": lexdb_fold(s),
      "base": lexdb_base_key(lexdb_fold(s)),
      "key": lexdb_key(lexdb_fold(s), splits),
      "hb": hint_bucket(s),
      "hk": hint_key(s),
    }
    for s in samples
  ],
  "zh": [{"t": t, "b": zh_bucket(t)} for t in zh_terms],
  "hints": [short_hint_zh(src) for src, _ in raw_hints],
}
print(json.dumps(out, ensure_ascii=False))
`;

  const raw = execFileSync(
    "python3",
    ["-B", "-c", pyCode, JSON.stringify(samples), JSON.stringify(splits), JSON.stringify(zhTerms), JSON.stringify(rawHints)],
    { cwd: ROOT, encoding: "utf8" },
  );
  const py = JSON.parse(raw) as {
    samples: { s: string; fold: string; base: string; key: string; hb: string; hk: string }[];
    zh: { t: string; b: number }[];
    hints: string[];
  };

  for (const row of py.samples) {
    const f = lexdbFold(row.s);
    assert.equal(row.fold, f, `fold mismatch for ${row.s}`);
    assert.equal(row.base, lexdbBaseKey(f), `baseKey mismatch for ${row.s}`);
    assert.equal(row.key, lexdbKey(f, splits), `key mismatch for ${row.s}`);
    assert.equal(row.hb, hintBucket(row.s), `hintBucket mismatch for ${row.s}`);
    assert.equal(row.hk, hintKey(row.s), `hintKey mismatch for ${row.s}`);
  }
  for (const row of py.zh) {
    assert.equal(row.b, zhBucket(row.t), `zhBucket mismatch for ${row.t}`);
  }
  rawHints.forEach(([_src, expected], idx) => {
    assert.equal(py.hints[idx], expected, `short_hint_zh mismatch for ${_src}`);
  });
});
