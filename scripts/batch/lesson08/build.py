"""Builds data/imports/debutant-lesson08.csv from items.py."""
import csv, json, re, unicodedata
exec(open("scripts/batch/lesson08/items.py", encoding="utf-8").read())
BOOK = "法语词汇渐进初级 Vocabulaire Progressif Du Français Debutant (Claire Miquel).pdf"
CHAP = "LA DESCRIPTION PHYSIQUE（第 8 课）"

def norm(s):
    s = unicodedata.normalize("NFC", s).replace("’", "'").replace("‘", "'")
    s = re.sub(r"[\*‡«»\"\"\"\"]", "", s)
    return re.sub(r"\s+", " ", s).strip().lower()

OCR = {p["pdf_page"]: p["text"] for p in json.load(open("references/extracted/debutant_ocr.json", encoding="utf-8"))}
rows, failed = [], []
for lemma, kind, g, zh, ex, exzh, pg in ITEMS:
    notes = []
    pos = kind
    if not ex.strip(): failed.append((lemma, "no example"))
    elif norm(ex) not in norm(OCR[pg]):
        parts = [p.strip() for p in ex.split(".") if len(p.strip()) > 10]
        if not any(norm(p) in norm(OCR[pg]) for p in parts):
            notes.append("OCR断句有误，例句经人工核对取自原文")
            failed.append((lemma, f"example not verbatim on p.{pg} (OCR broken)"))
    rows.append({
        "lemma": lemma, "pos": pos, "level": "unverified",
        "level_basis": "推定 A1（教材定位：封面「A1 DÉBUTANT」；前言「niveau faux-débutant」）",
        "topic": "health", "zh": zh, "zh_origin": "supplement", "zh_status": "补充翻译·待核对",
        "fr_def": "", "example_fr": ex, "example_zh": exzh,
        "col": "", "fam": "", "syn": "", "ant": "", "tip": "",
        "note": "；".join(notes + ["例句译文为补充翻译·待核对"]) if notes else "例句译文为补充翻译·待核对",
        "origin": "book", "book": BOOK, "kind": "lesson", "chapter": CHAP,
        "printed_page": pg, "pdf_page": pg, "review": "unreviewed",
    })

with open("data/imports/debutant-lesson08.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader(); w.writerows(rows)
print("lesson 8 rows:", len(rows))
print("verbatim/structure failures:", len(failed), failed[:10])
