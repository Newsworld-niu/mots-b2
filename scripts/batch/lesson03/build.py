"""Builds data/imports/debutant-lesson03.csv from items.py.
Gender only from evidence: a body article/possessive written in the item, or Larousse 'nom masculin/féminin'.
Otherwise the noun is written n. (pending). Book examples must be verbatim on their cited page."""
import csv, json, re, unicodedata
exec(open("scripts/batch/lesson03/items.py", encoding="utf-8").read())
LAR = json.load(open("data/dictionary/larousse-lesson02.json", encoding="utf-8"))
OCR = {p["pdf_page"]: p["text"] for p in json.load(open("references/extracted/debutant_ocr.json", encoding="utf-8"))}
BOOK = "法语词汇渐进初级 Vocabulaire Progressif Du Français Debutant (Claire Miquel).pdf"
CHAP = "L'AMOUR - LES ÉMOTIONS（第 3 课）"

def norm(s):
    s = unicodedata.normalize("NFC", s).replace("’", "'").replace("‘", "'")
    s = re.sub(r"[\*‡«»\"\"\"\"]", "", s)
    return re.sub(r"\s+", " ", s).strip().lower()

rows, pending, failed = [], [], []
for lemma, kind, g, zh, ex, exzh, pg in ITEMS:
    notes = []
    if kind == "n." and "n.m." not in lemma and "n.f." not in lemma:
        # Simple noun without explicit gender in kind
        pass
    if kind.startswith("n") and kind not in ("n.m.", "n.f.", "n.m./f.") and "loc." not in kind and "v." not in kind and "adj." not in kind:
        lar = LAR.get(lemma, {})
        if g:
            gg = g; notes.append(f"阴阳性：正文依据（p.{pg}）")
        elif lar.get("gender") in ("m", "f"):
            gg = lar["gender"]; notes.append(f"阴阳性：Larousse nom {'masculin' if gg=='m' else 'féminin'}（正文未见冠词）")
        else:
            gg = None
        if gg is None:
            pos = "n."; pending.append(lemma); notes.append("阴阳性待核实（正文无冠词，词典未确定）；暂记 n.")
        else:
            pos = {"m": "n.m.", "f": "n.f.", "mf": "n.m./f."}[gg]
    else:
        pos = kind
    if not ex.strip(): failed.append((lemma, "no example"))
    if ex.strip() and norm(ex) not in norm(OCR[pg]):
        # try partial match (OCR line breaks may split sentences)
        parts = [p.strip() for p in ex.split(".") if len(p.strip()) > 10]
        if not any(norm(p) in norm(OCR[pg]) for p in parts):
            failed.append((lemma, f"example not verbatim on p.{pg}"))
    rows.append({
        "lemma": lemma, "pos": pos, "level": "unverified",
        "level_basis": "推定 A1（教材定位：封面「A1 DÉBUTANT」；前言「niveau faux-débutant」）",
        "topic": "emotion", "zh": zh, "zh_origin": "supplement", "zh_status": "补充翻译·待核对",
        "fr_def": "", "example_fr": ex, "example_zh": exzh,
        "col": "", "fam": "", "syn": "", "ant": "", "tip": "",
        "note": "；".join(notes + ["例句译文为补充翻译·待核对"]) if notes else "例句译文为补充翻译·待核对",
        "origin": "book", "book": BOOK, "kind": "lesson", "chapter": CHAP,
        "printed_page": pg, "pdf_page": pg, "review": "unreviewed",
    })

with open("data/imports/debutant-lesson03.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader(); w.writerows(rows)
print("lesson 3 rows:", len(rows), "| nouns pending gender (n.):", len(pending), pending)
print("verbatim/structure failures:", len(failed), failed[:10])
