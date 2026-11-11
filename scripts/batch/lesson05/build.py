"""Builds data/imports/debutant-lesson05.csv from items.py."""
import csv, json, re, unicodedata
exec(open("scripts/batch/lesson05/items.py", encoding="utf-8").read())
BOOK = "法语词汇渐进初级 Vocabulaire Progressif Du Français Debutant (Claire Miquel).pdf"
CHAP = "LA COMMUNICATION（第 5 课）"

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
    if ex.strip() and norm(ex) not in norm(OCR[pg]):
        parts = [p.strip() for p in ex.split(".") if len(p.strip()) > 10]
        if not any(norm(p) in norm(OCR[pg]) for p in parts):
            failed.append((lemma, f"example not verbatim on p.{pg}"))
    rows.append({
        "lemma": lemma, "pos": pos, "level": "unverified",
        "level_basis": "推定 A1（教材定位：封面「A1 DÉBUTANT」；前言「niveau faux-débutant」）",
        "topic": "media", "zh": zh, "zh_origin": "supplement", "zh_status": "补充翻译·待核对",
        "fr_def": "", "example_fr": ex, "example_zh": exzh,
        "col": "", "fam": "", "syn": "", "ant": "", "tip": "",
        "note": "；".join(notes + ["例句译文为补充翻译·待核对"]) if notes else "例句译文为补充翻译·待核对",
        "origin": "book", "book": BOOK, "kind": "lesson", "chapter": CHAP,
        "printed_page": pg, "pdf_page": pg, "review": "unreviewed",
    })

with open("data/imports/debutant-lesson05.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader(); w.writerows(rows)
print("lesson 5 rows:", len(rows))
print("verbatim/structure failures:", len(failed), failed[:10])
