#!/usr/bin/env python3
"""Generic batch builder for a textbook lesson.

usage: build.py <batch-name> <chapter-label> <topic> <pdf-page-min> <pdf-page-max> [transcript ...]

Input : data/batches/<batch-name>.tsv   columns: lemma|pos|zh|example_fr|example_zh|page   (no header, '|' separated;
        empty example_fr = no example)
Output: data/imports/<batch-name>-fill.csv ; log: output/<batch-name>/fill.log
Rules : lemma is resolved to the exact lexicon lemma when a non-alias entry with the same folded lemma and pos exists
        (so the importer merges). Every example must appear (normalised) in OCR of the page range or in a
        transcript file; failures are reported and the example is DROPPED (never guessed).
        Glosses are always marked 补充翻译·待核对.
"""
import csv, json, os, re, sys, unicodedata

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SRC = os.path.join(ROOT, "data/imports/debutant-lesson11-15-bulk.csv")
LEX = os.path.join(ROOT, "data/lexicon.json")
# The textbook OCR source MUST be given explicitly: no silent default to another book.
_ocr_env = os.environ.get("OCR_FILE")
if not _ocr_env:
    raise SystemExit("OCR_FILE is required (e.g. OCR_FILE=references/extracted/avance_ocr.json). Refusing to default to another book's OCR.")
OCR = os.path.join(ROOT, _ocr_env)

# The textbook identity MUST be given explicitly as well; the template row only supplies field *structure*.
BOOK = os.environ.get("BOOK")
if not BOOK:
    raise SystemExit("BOOK is required (exact source book string, e.g. BOOK='Vocabulaire DELF B2 3000 mots.pdf'). Refusing to inherit another book from the template row.")
KIND = os.environ.get("KIND", "lesson")
# Cross-check: BOOK and OCR_FILE must belong to the same book (avoid mixing sources).
_BOOK_KEY = os.environ.get("BOOK_KEY")  # debutant|a2b1|avance|delf
if not _BOOK_KEY:
    raise SystemExit("BOOK_KEY is required (debutant|a2b1|avance|delf) to cross-check BOOK and OCR_FILE.")
_TOKENS = {"debutant": "Debutant", "a2b1": "A2-B1", "avance": "avanc", "delf": "DELF"}
_tok = _TOKENS.get(_BOOK_KEY)
if _tok is None:
    raise SystemExit(f"unknown BOOK_KEY {_BOOK_KEY!r}")
if _tok.lower() not in os.path.basename(OCR).lower():
    raise SystemExit(f"OCR_FILE {os.path.basename(OCR)!r} does not match BOOK_KEY={_BOOK_KEY!r}.")
if _tok.lower() not in BOOK.lower():
    raise SystemExit(f"BOOK {BOOK!r} does not match BOOK_KEY={_BOOK_KEY!r}.")
LEVEL_BASIS = os.environ.get("LEVEL_BASIS", "未核实：书籍为教材，逐词等级未确认")
if not os.path.exists(OCR):
    raise SystemExit(f"OCR_FILE not found: {OCR}")

def fold(s):
    s = unicodedata.normalize("NFD", s); s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.lower().replace("'", "").replace("-", " ").strip()

def norm(s):
    s = re.sub(r"===[^\n]*===", " ", s)
    s = s.replace("•", " ").replace("’", "'")
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\s+([:;?!»])", r"\1", s)
    s = s.replace("« ", "«").replace("( = ", "(= ").replace("/ ", "/")
    return s.strip()

OFFSET = int(os.environ.get("PDF_OFFSET", "0"))  # pdf_page = printed page + OFFSET (A2-B1: +2, avancé: +1)

def auto_example(word, text, sent_re):
    """first clean sentence (teaching pages, OCR text) containing the headword or a plural/feminine form."""
    if not word: return "", ""
    pat = re.compile(r"(?<![\wà-ÿ])" + re.escape(word) + r"(s|x|e|es|ne|nes)?(?![\wà-ÿ])", re.I)
    for m in sent_re.finditer(text):
        sent = m.group(0).strip()
        if not (25 <= len(sent) <= 150): continue
        if re.search(r"[/•=\*]{1}|\d{3,}|\s[A-Z]{3,}\s", sent): continue
        if sent[0].islower() and not sent[0] in "«": continue
        if pat.search(sent):
            return sent, ""   # translation left empty → row keeps no example translation (gloss only)
    return "", ""

def main():
    if len(sys.argv) < 6:
        print(__doc__); return 2
    name, chapter, topic, pmin, pmax = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])  # pmin/pmax are PDF pages
    extra = sys.argv[6:]
    tsv = os.path.join(ROOT, "data/batches", name + ".tsv")
    out = os.path.join(ROOT, "data/imports", name + "-fill.csv")
    log_path = os.path.join(ROOT, "output", name, "fill.log")
    os.makedirs(os.path.dirname(log_path), exist_ok=True)

    ocr = json.load(open(OCR, encoding="utf-8"))
    teach = [p for p in ocr if pmin <= p["pdf_page"] <= pmax and not re.search(r"EXERCI|Tests\s", "\n".join(p["text"].split("\n")[:3]), re.I)]
    corpus = norm("\n".join(p["text"] for p in ocr if pmin <= p["pdf_page"] <= pmax))
    teach_text = norm("\n".join(p["text"] for p in teach))
    SENT = re.compile(r"[A-ZÀÂÇÉÈÊËÎÏÔÙÛÜŒa-zàâçéèêëîïôùûüœ'’ ,;:()\-«»\.!?…0-9]+?[.!?]")
    for e in extra:
        corpus += " " + norm(open(os.path.join(ROOT, e), encoding="utf-8").read())

    lexl = [e for e in json.load(open(LEX, encoding="utf-8"))["entries"] if not e.get("aliasOf")]
    def resolve(word, pos):
        for e in lexl:
            if fold(e["lemma"]) == fold(word) and e["pos"] == pos:
                return e["lemma"]
        return word

    rows = list(csv.DictReader(open(SRC, encoding="utf-8")))
    tmpl = next(r for r in rows if r["lemma"] == "achat")
    out_rows, log, seen = [], [], set()
    n_ex = n_drop = n_res = 0
    for ln, line in enumerate(open(tsv, encoding="utf-8"), 1):
        line = line.rstrip("\n")
        if not line.strip() or line.startswith("#"):
            continue
        parts = line.split("|")
        if len(parts) != 6:
            log.append(f"line {ln}: expected 6 fields, got {len(parts)}: {line[:80]}"); continue
        word, pos, zh, ex, exz, page = [p.strip() for p in parts]
        if not zh:
            log.append(f"line {ln}: empty zh for {word}"); continue
        lemma = resolve(word, pos)
        if lemma != word: n_res += 1
        key = (fold(lemma), pos)
        if key in seen:
            log.append(f"line {ln}: duplicate in batch {word}/{pos} (kept first)"); continue
        seen.add(key)
        r = {k: "" for k in tmpl}  # structure only: never inherit book/chapter/page/status/content
        r.update({"lemma": lemma, "pos": pos, "topic": topic, "level": "unverified",
                  "level_basis": LEVEL_BASIS,
                  "book": BOOK, "kind": KIND,
                  "zh": zh, "zh_origin": "supplement", "zh_status": "补充翻译·待核对",
                  "fr_def": "", "example_fr": "", "example_zh": "", "col": "", "fam": "", "syn": "", "ant": "",
                  "tip": "", "origin": "book", "kind": "lesson", "chapter": chapter,
                  "printed_page": page or str(pmin), "pdf_page": str(int(page or pmin) + OFFSET), "review": "unreviewed"})
        if ex == "AUTO":
            ex, exz = auto_example(word, teach_text, SENT)
        if ex:
            if norm(ex) in corpus:
                r["example_fr"] = ex
                r["example_zh"] = (exz + "（补充翻译·待核对）") if exz else ""
                r["note"] = ("例句：教材原页 OCR 自动抽取，逐字可见；" + ("译文为补充翻译·待核对" if exz else "例句未译")) + "；释义为补充翻译·待核对"
                n_ex += 1
            else:
                n_drop += 1
                log.append(f"line {ln}: example not verbatim, dropped: {word} → {ex}")
                r["note"] = "教材原页无可核对例句；释义为补充翻译·待核对"
        else:
            r["note"] = "教材原页无完整例句（列表、图示或标题）；释义为补充翻译·待核对"
        out_rows.append(r)

    if not out_rows:
        print("no rows"); return 1
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys())); w.writeheader(); w.writerows(out_rows)
    summary = f"rows={len(out_rows)} zh={sum(1 for r in out_rows if r['zh'])} examples={n_ex} dropped_examples={n_drop} lemma_resolved={n_res} notes={len(log)}"
    open(log_path, "w", encoding="utf-8").write(summary + "\n" + "\n".join(log) + "\n")
    print(summary)
    print(f"fill_csv={os.path.relpath(out, ROOT)} log={os.path.relpath(log_path, ROOT)}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
