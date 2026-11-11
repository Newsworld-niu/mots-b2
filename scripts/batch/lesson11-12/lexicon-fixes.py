#!/usr/bin/env python3
"""Targeted lexicon fixes for lessons 11–12 (round 2). Logs to output/lesson11-12/lexicon-fixes.log.
- bouf → alias of boeuf (bœuf), old id kept; provenance sources copied to boeuf.
- electronique- (待核实): remove the sense '电子的' that duplicated the adjective entry (added by fill-zh.py).
- Provence: proper noun (地名) recorded in tip and sense; pos stays n.f. (la Provence)."""
import json, os, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
LEX = os.path.join(ROOT, "data/lexicon.json")
LOG = os.path.join(ROOT, "output/lesson11-12/lexicon-fixes.log")
lex = json.load(open(LEX, encoding="utf-8"))
E = {e["id"]: e for e in lex["entries"]}
log = []

bouf, boeuf = E["bouf"], E.get("boeuf")
assert boeuf and boeuf["lemma"] == "bœuf" and boeuf["pos"] == "n.m.", boeuf
assert not bouf.get("aliasOf")
key = lambda s: (s.get("book"), s.get("printedPage"), s.get("pdfPage"), s.get("kind"))
have = {key(s) for s in boeuf["sources"]}
added = [s for s in bouf["sources"] if key(s) not in have]
boeuf["sources"].extend(added)
bouf["aliasOf"] = "boeuf"
bouf["note"] = "别名：指向 boeuf（bœuf，n.m.）。原词表拼写 bouf 为误拼，已对照第 66 页图像（le bœuf）确认。旧 ID 保留，学习记录由别名迁移处理。"
log.append(f"bouf → aliasOf boeuf; sources copied={len(added)}")

ee = E["electronique-"]
before = len(ee["senses"])
ee["senses"] = [s for s in ee["senses"] if not (s["zh"] == "电子的" and s["origin"] == "supplement")]
log.append(f"electronique- senses {before} → {len(ee['senses'])} (removed duplicate adjective sense)")

pv = E["provence"]
for s in pv["senses"]:
    if s["zh"].startswith("普罗旺斯（herbes de Provence"):
        s["zh"] = "普罗旺斯（法国东南部地区名，专名）"
pv["tip"] = ("专名（地名，la Provence，阴性）。依据：第 68 页图注「des herbes de Provence (thym, romarin, lavande...)」"
             "中的地名用法（香草名）。词库无专名标记字段，故保留 pos n.f. 并在此备注。")
log.append("provence: sense relabelled as 专名（地名）; tip records proper-noun evidence")

json.dump(lex, open(LEX, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
open(LEX, "a", encoding="utf-8").write("\n")
os.makedirs(os.path.dirname(LOG), exist_ok=True)
open(LOG, "w", encoding="utf-8").write("\n".join(log) + "\n")
print("\n".join(log))
