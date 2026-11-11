"""Batch: a CLE 'Vocabulaire progressif' index (OCR text) -> importer CSV, with page coverage evidence.
Usage: python3 scripts/batch/textbook-index.py <key>   (key: debutant | a2b1)
Reads references/extracted/<key>_ocr.json; writes data/imports/<key>-index.csv and references/extracted/<key>-coverage.json."""
import csv, json, re, sys, collections, unicodedata

KEY = sys.argv[1]
CFG = {
  "debutant": dict(book="法语词汇渐进初级 Vocabulaire Progressif Du Français Debutant (Claire Miquel).pdf",
                   index=(164, 176), stated="A1", basis="封面「A1 DÉBUTANT」；前言「niveau faux-débutant」（PDF 第 3 页）"),
  "a2b1": dict(book="Vocabulaire progressif du français A2-B1 (Anne Goliot-Lété Claire Miquel).pdf",
               index=(190, 210), stated="B1", basis="封面「A2 B1 INTERMÉDIAIRE」；前言「niveau B1」（PDF 第 5 页）"),
}[KEY]
pages = json.load(open(f"references/extracted/{KEY}_ocr.json", encoding="utf-8"))
P = {p["pdf_page"]: p for p in pages}

# 1) page offset from footers "N •" in lesson pages (PDF page - printed page)
offs = collections.Counter()
for p in pages[8:CFG["index"][0] - 2]:
    m = re.findall(r"(?m)^\s*(\d{1,3})\s*•", p["text"])
    if m: offs[p["pdf_page"] - int(m[-1])] += 1
OFF = offs.most_common(1)[0][0]

# 2) chapter of each lesson page: a fully uppercase first line starts a chapter
def is_head(line):
    letters = [c for c in line if c.isalpha()]
    return len(letters) >= 6 and all(c == c.upper() for c in letters) and not re.search(r"\d", line)
chapters, cur = {}, None
for pdf in range(9, CFG["index"][0]):
    lines = [l.strip() for l in P[pdf]["text"].split("\n") if l.strip()]
    heads = [l for l in lines[:3] if is_head(l) and l not in ("SOMMAIRE", "AVANT-PROPOS")]
    if heads: cur = heads[0]
    chapters[pdf - OFF] = cur

# 3) index entries: "headword (pos) pages", page lists may wrap onto the next line
POS_RE = re.compile(r"\(([^()]*)\)\s*$")
entries, dropped = [], []
pos_map = {"n.m.": "n.m.", "n.f.": "n.f.", "n.": "n.", "v.": "v.", "adj.": "adj.", "adv.": "adv.", "loc.": "loc.",
           "loc. adv.": "loc. adv.", "prép.": "prép.", "pron.": "pron.", "pr.": "pron.", "p.p.": "adj.", "interj.": "interj.",
           "inter.": "interj.", "adj. et n.": "adj.", "adj. et n.m.": "adj.", "v. et n.m.": "v.", "adj. invar.": "adj.",
           "adj. poss.": "adj.", "adj. num.": "adj.", "p.pr.": "v.", "V.": "v.", "adj. et n": "adj."}
for pdf in range(CFG["index"][0], CFG["index"][1] + 1):
    for raw in P[pdf]["text"].split("\n"):
        line = raw.strip().lstrip("|").strip()
        if not line or line in ("INDEX",) or re.match(r"^\d+\s*•", line) or re.fullmatch(r"[A-ZÉÈ]", line):
            continue
        if re.fullmatch(r"[\d\s,\-–~]+", line):          # page list continuation
            if entries: entries[-1]["pages"] += [int(x) for x in re.findall(r"\d+", line)]
            continue
        # headword line may end with page numbers: "aller (v. et n.m.) 8, 54, 68"
        m = re.match(r"^(.*?\))\s+((?:\d+\s*,?\s*)+)$", line)
        inline = [int(x) for x in re.findall(r"\d+", m.group(2))] if m else []
        head = m.group(1) if m else line
        pm = POS_RE.search(head)
        if not pm:
            dropped.append(line); continue
        pos_raw = pm.group(1).strip()
        lemma = head[:pm.start()].strip()
        lemma = re.sub(r"\s*\[.*?\]", "", lemma)           # bac[calauréat] -> bac
        lemma = re.sub(r"\(s'\)|\(se\)", "", lemma).strip()
        lemma = re.sub(r"\(e\)|\(ne\)|\(le\)|\(-[a-z]+\)", "", lemma).strip()
        lemma = lemma.rstrip("*")
        if not lemma or re.search(r"[\d~()\[\]]", lemma):
            dropped.append(line); continue
        entries.append({"lemma": lemma, "pos_raw": pos_raw, "pages": inline, "pdf": pdf})
# 4) collapse repeated (lemma, pos) lines into one row with all printed pages
rows = {}
for e in entries:
    pos = pos_map.get(e["pos_raw"], "待核实")
    key = (e["lemma"], pos)
    r = rows.setdefault(key, {"lemma": e["lemma"], "pos": pos, "pages": set(), "pos_raw": e["pos_raw"]})
    r["pages"].update(e["pages"])

def topic_of(chapter):
    t = (chapter or "").lower()
    rules = [("santé", "health"), ("corps", "health"), ("cuisine", "economy"), ("aliment", "economy"), ("argent", "economy"), ("banque", "economy"),
             ("commerce", "economy"), ("vêtement", "emotion"), ("amour", "emotion"), ("caractère", "emotion"), ("émotion", "emotion"),
             ("travail", "work"), ("professionnel", "work"), ("enseign", "education"), ("technolog", "media"), ("communication", "media"),
             ("médias", "media"), ("voyage", "travel"), ("transport", "travel"), ("tourisme", "travel"), ("vacances", "travel"),
             ("environnement", "environment"), ("nature", "environment"), ("temps", "environment"), ("météo", "environment"), ("climat", "environment"),
             ("société", "society"), ("politique", "society"), ("débat", "society"), ("diversité", "society"), ("usages", "society"), ("loisirs", "travel")]
    for k, v in rules:
        if k in t: return v
    return "society"

out_rows = []
for (lemma, pos), r in sorted(rows.items(), key=lambda kv: kv[0][0].lower()):
    row_pages = sorted(r["pages"])
    first = row_pages[0] if row_pages else None
    chap = chapters.get(first, "") if first else ""
    notes = []
    if r["pos_raw"] != pos and pos != "待核实": pass
    if len(row_pages) > 1: notes.append("索引页码：" + ",".join(map(str, row_pages)))
    out_rows.append({
        "lemma": lemma, "pos": pos, "level": "unverified",
        "level_basis": f"教材定位（推定，逐词未核实）：{CFG['stated']}；依据 {CFG['basis']}",
        "topic": topic_of(chap), "zh": "", "fr_def": "", "example_fr": "", "example_zh": "",
        "col": "", "fam": "", "syn": "", "ant": "", "tip": "", "note": "；".join(notes),
        "origin": "book", "book": CFG["book"], "kind": "index", "chapter": chap.title() if chap else "",
        "printed_page": first or "", "pdf_page": (first + OFF) if first else "", "review": "unreviewed",
    })
path = f"data/imports/{KEY}-index.csv"
with open(path, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys())); w.writeheader(); w.writerows(out_rows)

# 5) coverage: does the lemma's first word appear on its cited page (or the next page)?
def fold(s):
    s = unicodedata.normalize("NFD", s); return "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
hit = miss = 0; misses = []
for r in rows.values():
    stem = fold(r["lemma"].split()[0])[:5]
    if len(stem) < 3 or not r["pages"]: continue
    cand = [P.get(p + OFF) for p in sorted(r["pages"])]  # noqa
    ok = any(c and stem in fold(c["text"]) for c in cand) or any(stem in fold(P[p + OFF + 1]["text"]) for p in sorted(r["pages"]) if (p + OFF + 1) in P)
    if ok: hit += 1
    else:
        miss += 1
        if len(misses) < 40: misses.append(r["lemma"])
# full list of headwords not found on their cited page (explicit gap list)
not_found_all = []
for r in rows.values():
    stem = fold(r["lemma"].split()[0])[:5]
    if len(stem) < 3 or not r["pages"]: continue
    ok = any(P.get(p + OFF) and stem in fold(P[p + OFF]["text"]) for p in sorted(r["pages"])) or any(stem in fold(P[p + OFF + 1]["text"]) for p in sorted(r["pages"]) if (p + OFF + 1) in P)
    if not ok: not_found_all.append(f'{r["lemma"]} ({r["pos_raw"]}) p.{",".join(map(str, sorted(r["pages"])))}')
open(f"references/extracted/{KEY}-not-found.txt", "w", encoding="utf-8").write("\n".join(sorted(not_found_all)) + "\n")
cov = {"book": CFG["book"], "stated_level": CFG["stated"], "pdf_pages": len(pages), "index_pdf_range": CFG["index"], "page_offset_pdf_minus_printed": OFF,
       "index_rows_raw": len(entries), "dropped_lines": len(dropped), "unique_headwords": len(rows), "csv_rows": len(out_rows),
       "coverage_check": {"checked": hit + miss, "lemma_found_on_cited_page_or_next": hit, "not_found": miss, "rate": round(hit / max(1, hit + miss), 3), "examples_not_found": misses},
       "topics": dict(collections.Counter(r["topic"] for r in out_rows)), "chapters_seen": len(set(chapters.values()))}
json.dump(cov, open(f"references/extracted/{KEY}-coverage.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(json.dumps({k: v for k, v in cov.items() if k != "book"}, ensure_ascii=False, indent=1)[:1500])
print("dropped sample:", dropped[:8])
