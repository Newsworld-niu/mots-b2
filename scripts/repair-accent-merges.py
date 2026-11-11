"""One-off, targeted repair: undo accent-insensitive merges made by the first importer.
For each lexicon entry E (kept id) and each source row R whose lemma differs from E.lemma only by accents
(not by case), R becomes a NEW entry with a NEW id; sources that only R produced are moved from E to it.
Existing ids, senses, examples and any learning progress keyed by id are left untouched.
Each split is recorded in data/repairs/accent-splits.json for review."""
import csv, glob, json, re, unicodedata, datetime

LEX = "data/lexicon.json"
lex = json.load(open(LEX, encoding="utf-8"))
entries = lex["entries"]

def fold(s):
    s = unicodedata.normalize("NFD", s)
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower().replace("œ", "oe")

def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", fold(s)).strip("-")

def src_tuple(book, kind, printed, pdf):
    return (book, kind, str(printed or ""), str(pdf or ""))

# rows, in import order; templates are examples and are not part of the data
rows = []
for f in ["data/imports/miquel-index.csv", "data/imports/delf-lists.csv"]:
    for r in csv.DictReader(open(f, encoding="utf-8")):
        rows.append(r)

by_key = {}
for e in entries:
    by_key.setdefault((fold(e["lemma"]), e["pos"]), []).append(e)

splits = []
taken = {e["id"] for e in entries}

def alloc(base, pos):
    cand = base
    if cand in taken:
        cand = f"{base}-{'f' if pos.startswith('n.f') else 'm' if pos.startswith('n.m') else 'x'}"
    n = 2
    while cand in taken:
        cand = f"{base}-{n}"; n += 1
    return cand

# group rows by (fold, pos) and lemma
groups = {}
for r in rows:
    groups.setdefault((fold(r["lemma"]), r["pos"]), {}).setdefault(r["lemma"], []).append(r)

for key, variants in groups.items():
    if key not in by_key or len(by_key[key]) != 1:
        continue
    kept = by_key[key][0]
    kept_lemma = kept["lemma"]
    # variants that differ from the kept lemma by accents (not only case)
    for vlemma, vrows in variants.items():
        if vlemma.lower() == kept_lemma.lower():
            continue  # same word, different case: no split
        if fold(vlemma) != fold(kept_lemma):
            continue
        keep_tuples = {src_tuple(r["book"], r["kind"], r["printed_page"], r["pdf_page"]) for r in variants.get(kept_lemma, [])}
        var_tuples = {src_tuple(r["book"], r["kind"], r["printed_page"], r["pdf_page"]) for r in vrows}
        only_var = var_tuples - keep_tuples
        new_id = alloc(slug(vlemma), key[1])
        taken.add(new_id)
        moved = []
        kept["sources"] = [s for s in kept["sources"] if not (
            src_tuple(s["book"], s["kind"], s.get("printedPage"), s.get("pdfPage")) in only_var)]
        for s in list(only_var):
            moved.append({"book": s[0], "kind": s[1], "printedPage": int(s[2]) if s[2] else None, "pdfPage": int(s[3]) if s[3] else None})
        for m in moved:
            m.setdefault("chapter", None)
        for m in moved:
            m = {k: v for k, v in m.items() if v is not None}
        new_entry = {
            "id": new_id, "lemma": vlemma, "pos": key[1], "level": "unverified",
            "levelBasis": "未核实：书籍为教材，逐词等级未确认", "topic": vrows[0]["topic"],
            "senses": [{"zh": "", "fr": "", "origin": "book"}], "examples": [], "col": [], "fam": [], "syn": [], "ant": [], "tip": "",
            "note": f"与「{kept_lemma}」仅重音不同：待核实是否为不同词，或为 OCR 错误",
            "sources": [{"book": s[0], "kind": s[1], **({"printedPage": int(s[2])} if s[2] else {}), **({"pdfPage": int(s[3])} if s[3] else {})} for s in sorted(only_var)],
            "review": "unreviewed",
        }
        entries.append(new_entry)
        splits.append({"kept_id": kept["id"], "kept_lemma": kept_lemma, "new_id": new_id, "new_lemma": vlemma, "pos": key[1],
                       "moved_sources": len(only_var), "kept_sources_left": len(kept["sources"]), "row_count": len(vrows)})

lex["entries"] = entries
json.dump(lex, open(LEX, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
out = {"date": datetime.date.today().isoformat(), "rule": "accent-sensitive identity; case-only differences are not split", "splits": splits}
json.dump(out, open("data/repairs/accent-splits.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("splits:", len(splits))
for s in splits[:40]:
    print(f"  {s['kept_lemma']} (id {s['kept_id']})  ->  new {s['new_lemma']} (id {s['new_id']}, {s['pos']}), moved {s['moved_sources']} sources")
