#!/usr/bin/env python3
"""Pre-import lexicon fixes for lessons 13–15 (IDs never change; log: output/lesson13-15/lexicon-fixes.log).
Each fix is backed by a page image or OCR line noted in the log."""
import json, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
LEX = os.path.join(ROOT, "data/lexicon.json")
LOG = os.path.join(ROOT, "output/lesson13-15/lexicon-fixes.log")
lex = json.load(open(LEX, encoding="utf-8"))
E = {e["id"]: e for e in lex["entries"]}
log = []

def setpos(i, new, why):
    old = E[i]["pos"]; E[i]["pos"] = new; log.append(f"{i}: pos {old} → {new} ({why})")

def setlemma(i, new, why):
    old = E[i]["lemma"]; E[i]["lemma"] = new; log.append(f"{i}: lemma {old!r} → {new!r} ({why})")

# 1. miel: OCR bullet in lemma; duplicate of miel-m (same lemma/pos, miel-m is the earlier, correct entry)
prim, dup = E["miel-m"], E["miel"]
assert prim["lemma"] == "miel" and prim["pos"] == "n.m." and dup["lemma"] == "•miel"
have = {(s["book"], s.get("printedPage"), s.get("pdfPage"), s.get("kind")) for s in prim["sources"]}
moved = [s for s in dup["sources"] if (s["book"], s.get("printedPage"), s.get("pdfPage"), s.get("kind")) not in have]
prim["sources"].extend(moved)
dup["aliasOf"] = "miel-m"
dup["note"] = "别名：指向 miel-m（miel, n.m.）。原词表带 OCR 项目符号「•miel」，已去除；与 miel-m 为同一词。旧 ID 保留。"
log.append(f"miel: lemma '•miel' is a bullet OCR artefact; alias → miel-m; sources copied={len(moved)}")

# 2. goûter: accent missing in lemma (p.78 «l'heure du goûter»); noun, masculine
setpos("gouter", "n.m.", "p.78「l'heure du goûter」，名词阳性")
# 3. ceci / quoi: pronoun (p.74 «Et avec ceci ?»; p.78 «C'est quoi*»)
setpos("ceci", "pron.", "p.74「Et avec ceci ?」")
setpos("quoi", "pron.", "p.78「C'est quoi*, la salade gourmande ?」")
# 4. minuit: masculine (p.82 table; «minuit» is le minuit)
setpos("minuit", "n.m.", "名词阳性（minuit, le minuit）")

json.dump(lex, open(LEX, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
open(LEX, "a", encoding="utf-8").write("\n")
os.makedirs(os.path.dirname(LOG), exist_ok=True)
open(LOG, "w", encoding="utf-8").write("\n".join(log) + "\n")
print("\n".join(log))
