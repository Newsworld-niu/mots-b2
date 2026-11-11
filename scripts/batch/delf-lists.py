"""Batch: DELF B2 3000 mots, OCR text (references/extracted/delf_ocr.json), PDF pages 44-140.
One headword per line; gender in (m)/(f)/(m.)/(f.); multi-word lines are phrases (loc.).
Connectors (pages 34-43) are NOT included in this batch. Glosses are empty: the book gives none."""
import csv, json, re, unicodedata

OCR = "references/extracted/delf_ocr.json"
BOOK = "Vocabulaire DELF B2 3000 mots.pdf"
def fold(s):
    s = unicodedata.normalize("NFD", s); s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.lower()
# theme headings as printed in the book's contents (page 6) -> (chapter title, topic key)
THEMES = [
 ("l'éducation, le travail","L'éducation, le travail","work"),
 ("la santé","La santé","health"),
 ("la culture","La culture","education"),
 ("la consommation","La consommation","economy"),
 ("la famille, les relations personnelles","La famille, les relations personnelles","society"),
 ("l'environnement","L'environnement","environment"),
 ("les nouvelles technologies, internet et les médias","Les nouvelles technologies, Internet et les médias","media"),
 ("les transports","Les transports","travel"),
 ("les loisirs","Les loisirs","travel"),
 ("l'économie et la politique","L'économie et la politique","economy"),
 ("lexique indispensable pour le delf b2","Lexique indispensable pour le DELF B2","education"),
]
POS_MARK = {"m":"n.m.","f":"n.f."}
# Running-text sentences from the theme introductions (r29 cleanup).
# They are paragraphs, not headwords; the removed rows live in
# data/imports/delf-lists-removed.csv.
CONFIRMED_SENTENCES = {
    "Voici la liste de mots qui est triée par thème. Ce sont les",
    "mots que vous risquez de rencontrer dans les documents pour",
    "cela fait aussi partie de l'apprentissage de chercher le mot et de",
    "personnelle à travers les différentes techniques qui sont",
    "proposées au début de cet ouvrage. Je vous encourage bien sûr",
    "des phrases avec ces mots. Tout en lisant la presse durant votre",
    "vous reconnaissez dans cette liste. Quelques mots sont présents",
    "dans plusieurs catégories",
    "Le vocabulaire de l'éducation et du travail est assez",
    "confondent. Ce vocabulaire est aussi très utile à connaître pour",
    "La santé est un thème qui comprend les maladies",
    "C'est un thème qui comprend le cinéma",
    "C'est un thème qui comprend un nombre important de mots",
    "qui sont utilisés de manière quotidienne. Ils peuvent aussi",
    "apparaître de manière transversale dans des documents relatifs",
    "Ce thème contient des mots relatifs à la famille",
    "C'est un thème qui est de plus en plus présent dans l'actualité",
    "et donc dans les documents qui vous seront proposés pour",
    "l'examen. On pourra vous parler d'environnement à travers le",
    "Il s'agit là également d'un thème récurrent qui prend de",
    "l'importance étant donné le développement ininterrompu de la",
    "technologie. Cette liste inclus aussi le vocabulaire des médias",
    "Le vocabulaire des transports se trouve parfois dans le thème",
    "des loisirs . Il est également en lien avec celui de",
    "l'environnement. Vous entendrez régulièrement parler de",
    "Comme mentionné plus haut",
    "C'est un thème qui est très présent dans l'actualité. L'économie",
    "et la politique vont souvent de pair. L'économie est comme le",
}
# Narrow openers: only phrases that begin the theme introductions. Do NOT add
# generic words like "Des ", "Tout " or "Personne" — they would drop legitimate
# headwords such as "tout à fait" or "personne âgée".
SENTENCE_OPENERS = (
    "Voici la liste", "C'est un thème", "Le vocabulaire de ", "Il s'agit",
    "Ce thème contient", "Comme mentionné",
)
# Malformed notation rows are normalised instead of dropped.
CLEAN_LEMMA = {"remuer l'opinion publique to demonstrate in favour of =>": "remuer l'opinion publique"}
AS_ALIAS = {"partial ; unbiased : impartial": "partial", "douceur [doux ; douce]": "douceur"}
ocr = json.load(open(OCR, encoding="utf-8"))
rows, dropped, unknown_pos = [], [], 0
chapter, topic, note_extra = "L'éducation, le travail", "work", ""
for page in ocr:
    pdf = page["pdf_page"]
    if pdf < 44 or pdf > 140:
        continue
    for raw in page["text"].split("\n"):
        line = raw.strip()
        f = fold(line)
        hit = next((t for t in THEMES if f.startswith(t[0]) and len(f) <= len(t[0]) + 2), None)
        if hit:
            chapter, topic = hit[1], hit[2]
            note_extra = "主题未分组（Lexique 无主题）" if topic == "education" and hit[0].startswith("lexique") else ""
            continue
        if re.search(r"\d", line) or "DELF B2" in line or "définition" in line or not re.search(r"[A-Za-zÀ-ÿ]{2}", line) or re.search(r"832966172|NI#|JETE|itsfrench|©|@|contactez|Plus de ressources", line) or re.fullmatch(r"\d+", line):
            dropped.append(line); continue
        if len(line) > 70 or line.endswith("."):
            dropped.append(line); continue
        if line in CONFIRMED_SENTENCES:
            dropped.append(line); continue
        if any(line.startswith(o) for o in SENTENCE_OPENERS):
            dropped.append(line); continue
        # Sentence patterns from the introductions. Deliberately narrow: a broad
        # "contains qui/que" test would also drop valid collocations such as
        # "avoir la tête qui tourne" or "n'avoir que la peau sur les os".
        if re.search(r"( est un thème | qui comprend | sont utilisés de manière )", line, re.I):
            dropped.append(line); continue
        # OCR lines carry trailing punctuation/suffixes, so match by prefix.
        if re.match(r"^(dans plusieurs catégories|des loisirs \(voyages\)|technologie\. Cette liste)", line):
            dropped.append(line); continue
        clean_hit = next((k for k in CLEAN_LEMMA if line.startswith(k)), None)
        if clean_hit:
            line = CLEAN_LEMMA[clean_hit]
        if any(line.startswith(k) for k in AS_ALIAS):
            dropped.append(line); continue
        notes = [note_extra] if note_extra else []
        # gender marker
        g = re.search(r"\((m|f)\.?(?:\s*pl\.)?\)", line)
        if g and "pl." in g.group(0):
            notes.append("复数形式（pl.）")
        pos = None
        if g:
            pos = POS_MARK[g.group(1)]
            line2 = line[:g.start()] + line[g.end():]
        else:
            line2 = line
        # article/gender remnants: ", l'" ", la" ", les" ", 1'" ", I" ", l"
        line2 = re.sub(r",\s*(l'|1'|l|la|les|le|I)\s*$", "", line2).strip()
        if "(les)" in line2:
            notes.append("复数形式（les）"); line2 = line2.replace("(les)", "").strip()
        if re.search(r"\(\d\)", line2):
            notes.append("书内编号 " + re.search(r"\(\d\)", line2).group(0)); line2 = re.sub(r"\s*\(\d\)", "", line2).strip()
        # placeholders are kept as a note
        ph = re.findall(r"\bq[nc](?:/q[nc])?\b", line2)
        if ph:
            notes.append("结构：" + ", ".join(sorted(set(ph)))); line2 = re.sub(r"\s*\bq[nc](?:/q[nc])?\b", "", line2).strip()
        line2 = re.sub(r"\s*\(s'\)|\s*,\s*s'$", lambda m: (notes.append("代词式（s'）") or ""), line2).strip()
        line2 = line2.strip(" ,/")
        if not line2 or not re.search(r"[A-Za-zÀ-ÿ]", line2):
            dropped.append(line); continue
        if pos is None:
            if " " in line2:
                pos = "loc."
            elif re.search(r"(er|ir|re|oir)$", line2):
                pos = "v."
            else:
                pos = "待核实"; unknown_pos += 1
        # other parentheses (usually an expansion of an abbreviation) move to the note
        for par in re.findall(r"\([^()]*\)", line2):
            notes.append("书中注释：" + par.strip("()")); line2 = line2.replace(par, "").strip()
        line2 = re.sub(r"\s+", " ", line2).strip()
        if not line2 or not re.search(r"[A-Za-zÀ-ÿ]", line2):
            dropped.append(line); continue
        # "attentif, attentive" -> lemma + feminine note
        if "," in line2:
            head, *rest = [x.strip() for x in line2.split(",")]
            if not head:
                dropped.append(line); continue
            notes.append("书中写法：" + line2)
            line2 = head
        rows.append({
            "lemma": line2, "pos": pos, "level": "unverified",
            "level_basis": "未核实：书籍为 B2 教材，逐词等级未确认",
            "topic": topic, "zh": "", "fr_def": "", "example_fr": "", "example_zh": "",
            "col": "", "fam": "", "syn": "", "ant": "", "tip": "", "note": "；".join(notes),
            "origin": "book", "book": BOOK, "kind": "theme-list", "chapter": chapter,
            "printed_page": pdf, "pdf_page": pdf, "review": "unreviewed",
        })
out = "data/imports/delf-lists.csv"
with open(out, "w", newline="", encoding="utf-8") as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
print("rows", len(rows), "pos 待核实:", unknown_pos, "dropped lines:", len(dropped))
print("dropped sample:", dropped[:12])
