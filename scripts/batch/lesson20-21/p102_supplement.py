#!/usr/bin/env python3
"""Supplement for lesson 19 (p.102 image check): teaching words the OCR-based pass had missed.
somme / électricité / important. Each example is verified against OCR of p.102 (verbatim)."""
import csv, json, os, re, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SRC = os.path.join(ROOT, "data/imports/debutant-lesson11-15-bulk.csv")
OUT = os.path.join(ROOT, "data/imports/debutant-lesson19-p102-supplement.csv")
OCR = os.path.join(ROOT, "references/extracted/debutant_ocr.json")
L19 = "L'ARGENT - LA BANQUE（第 19 课）"
ROWS = [
    ("somme", "n.f.", "金额；一笔钱（une somme de 一笔……）", "prélève (= prend) une somme de mon compte tous les mois", "EDF 每月从我的账户扣一笔钱。"),
    ("électricité", "n.f.", "电；电力", "quand je paye ma facture d'électricité", "当我支付电费账单时。"),
    ("important", "adj.", "重要的；大量的（un achat important 大额购物）", "Si on veut faire un achat important", "如果想进行一项大额购物。"),
]
def norm(s):
    s = s.replace("•", " ").replace("’", "'")
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\s+([:;?!»])", r"\1", s)
    return s.replace("« ", "«").strip()
ocr = " ".join(norm(p["text"]) for p in json.load(open(OCR, encoding="utf-8")) if p["pdf_page"] == 102)
rows = list(csv.DictReader(open(SRC, encoding="utf-8")))
tmpl = next(r for r in rows if r["lemma"] == "achat")
out, bad = [], []
for lemma, pos, zh, ex, exz in ROWS:
    if norm(ex) not in ocr: bad.append(ex)
    r = dict(tmpl)
    r.update({"lemma": lemma, "pos": pos, "topic": "economy", "level": "unverified", "zh": zh,
              "zh_origin": "supplement", "zh_status": "补充翻译·待核对", "fr_def": "", "example_fr": ex,
              "example_zh": exz + "（补充翻译·待核对）", "col": "", "fam": "", "syn": "", "ant": "", "tip": "",
              "note": "第 102 页图像核对时补录（OCR 遗漏的教学词）；例句逐字可见；释义为补充翻译·待核对",
              "origin": "book", "kind": "lesson", "chapter": L19, "printed_page": "102", "pdf_page": "102", "review": "unreviewed"})
    out.append(r)
with open(OUT, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(out[0].keys())); w.writeheader(); w.writerows(out)
print(f"rows={len(out)} verbatim_fail={len(bad)}")
sys.exit(1 if bad else 0)
