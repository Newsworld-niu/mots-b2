"""Batch: Miquel index (references/extracted/miquel_index.json) -> data/imports/miquel-index.csv.
Rules: headword forms like accusé(e) are reduced to a lemma and the form is kept in note;
pronominal (s') and familiar (*) markers go to note; the chapter gives a coarse topic;
gloss stays empty (the book does not give Chinese glosses); level stays unverified."""
import csv, json, re, sys

IDX = "references/extracted/miquel_index.json"
BOOK = "Vocabulaire progressif du français (avancé B2 C1.1) (Claire Miquel).pdf"
# (first printed page, chapter title, topic key) — sommaire of the book, 28 chapters
CHAPTERS = [
 (6,"Les mesures et les quantités","economy"),(12,"Formes et matériaux","environment"),(16,"Lumière et couleurs","environment"),
 (22,"Le jardinage et le bricolage","environment"),(28,"La gastronomie","travel"),(32,"Mouvements, gestes et postures","health"),
 (40,"L'apparence physique","health"),(46,"Le sport","health"),(54,"La santé - la consultation médicale","health"),
 (62,"Caractère et personnalité","emotion"),(70,"La vie affective","emotion"),(76,"Les réactions émotionnelles","emotion"),
 (84,"La vie intellectuelle","education"),(92,"L'opinion et l'appréciation","society"),(96,"La volonté et l'action","work"),
 (102,"La communication","media"),(110,"Changements et progrès","society"),(114,"L'enseignement supérieur","education"),
 (118,"Le monde de l'entreprise","work"),(124,"L'économie et le commerce","economy"),(130,"Les médias - la presse","media"),
 (134,"Les crimes et les faits divers","society"),(138,"L'environnement","environment"),(142,"La politique et la société","society"),
 (148,"L'histoire","society"),(152,"Les arts visuels","education"),(158,"Théâtre - musique - cinéma","education"),
 (166,"Le livre et la littérature","education"),
]
POS = {"n.m.":"n.m.","n.f.":"n.f.","n.":"n.","v.":"v.","adj.":"adj.","adv.":"adv.","loc.":"loc.","loc. adv.":"loc. adv.",
       "prép.":"prép.","pr.":"pron.","p.p.":"adj.","p.pr.":"v.","adj. et n.m.":"adj.","adj. et n.":"adj.","p.p. et n.":"adj.",
       "n.m. et adj.":"n.m.","n.f. et adj.":"n.f.","pr.indéf. et n.m.":"pron.","v. et n.m.":"v.","conj.":"conj.","interj.":"interj.",
       "pron.":"pron."}

def chapter_of(p):
    cur = CHAPTERS[0]
    for c in CHAPTERS:
        if p >= c[0]: cur = c
    return cur

def clean(head):
    """Return (lemma, note_parts) for one index headword."""
    notes = []
    h = head.strip()
    # OCR of the text layer reads "î" as "1" inside words (cro1tre, ma1trise, reconna1tre)
    h = re.sub(r"(?<=[a-zéèêàùç])1(?=[a-zéèêàùç])", "î", h)
    if h.endswith("*"):
        notes.append("俗语/口语（索引标记 *）"); h = h.rstrip("*").strip()
    m = re.search(r"\(s'\)|\(se\)", h)
    if m:
        notes.append("代词式（索引写作 " + m.group(0) + "）"); h = h.replace(m.group(0), "").strip()
    form = re.search(r"\(([^()]*)\)", h)
    if form:
        notes.append("形式：" + form.group(0)); h = h[:form.start()].strip()
    return h, notes

rows = []
dropped = []
data = json.load(open(IDX, encoding="utf-8"))
seen_keys = set()
for e in data:
    head = e["headword"]
    lemma, notes = clean(head)
    # page-number lists that OCR put on a headword line (e.g. "122,152, 16~ 168") are not words
    if not re.search(r"\w", lemma) or re.search(r"[\d~]", lemma):
        dropped.append(head)
        continue
    pos_raw = e.get("pos_raw", "")
    pos = POS.get(pos_raw, "待核实")
    pages = sorted(set(e.get("pages") or []))
    first = pages[0] if pages else None
    if pages and len(pages) > 1:
        notes.append("索引页码：" + ",".join(map(str, pages)))
    if not pos_raw:
        notes.append("索引未标词性")
    ch = chapter_of(first)[1] if first else ""
    topic = chapter_of(first)[2] if first else "education"
    rows.append({
        "lemma": lemma, "pos": pos, "level": "unverified",
        "level_basis": "未核实：书籍为 B2/C1 教材，封面等级不套用到逐词",
        "topic": topic, "zh": "", "fr_def": "", "example_fr": "", "example_zh": "",
        "col": "", "fam": "", "syn": "", "ant": "", "tip": "", "note": "；".join(notes),
        "origin": "book", "book": BOOK, "kind": "index", "chapter": ch,
        "printed_page": first or "", "pdf_page": (first + 1) if first else "", "review": "unreviewed",
    })
out = "data/imports/miquel-index.csv"
with open(out, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader(); w.writerows(rows)
print("dropped (page lists, not words):", len(dropped), dropped[:5])
print("rows", len(rows), "pos unknown(待核实):", sum(1 for r in rows if r["pos"] == "待核实"), "-> " + out)
