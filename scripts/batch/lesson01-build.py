"""Builds data/imports/debutant-lesson01.csv and data/lessons/lesson01.md from the lesson items,
the body-article evidence and the Larousse records. Gender is set only from evidence:
  body article/possessive quoted from the lesson, and/or Larousse 'nom masculin|féminin'.
Everything else stays n. (gender not given) and is listed as pending."""
import csv, json, re, os
exec(open("scripts/batch/lesson01-items.py", encoding="utf-8").read())
LAR = json.load(open("data/dictionary/larousse-lesson01.json", encoding="utf-8"))
BOOK = "法语词汇渐进初级 Vocabulaire Progressif Du Français Debutant (Claire Miquel).pdf"
# body evidence: quoted article/possessive from the lesson, with printed page
BODY = {
 "prénom":("m","le prénom",6), "ami":("mf","un(e) ami(e)",6), "personne":("f","la personne",6), "enfant":("m","un enfant",6),
 "rue":("f","dans la rue",6), "contexte":("m","un contexte",6), "copine":("f","ma copine",8), "main":("f","la main",8),
 "joue":("f","la joue",8), "bise":("f","une bise",8), "bisou":("m","un bisou",8), "région":("f","une région",8),
 "réussite":("f","une réussite",10), "promotion":("f","une promotion",10), "travail":("m","un nouveau travail",10),
 "naissance":("f","la naissance",10), "bébé":("m","d'un bébé",10), "mariage":("m","un mariage",10),
 "nouvelle":("f","une mauvaise nouvelle",10), "dame":("f","une dame",12), "place":("f","sa place",12),
 "porte":("f","la porte",12), "priorité":("f","la priorité",12), "bus":("m","le bus",12), "cadeau":("m","un petit cadeau",12),
 "bouquet":("m","un bouquet",12), "boîte":("f","une boîte",12), "bouteille":("f","une bouteille",12),
 "facteur":("m","au facteur (= à le)",12), "anniversaire":("m","pour un anniversaire",12), "examen":("m","un examen",12),
 "voyage":("m","un voyage",12),
}
SUPPL = {  # supplement sentences (NOT from the lesson): each contains the headword; marked in the note
 "accueillir": ("Nous vous accueillons avec plaisir.", "我们很高兴接待您。"),
 "demander": ("Je peux vous demander l'heure ?", "我可以问您现在几点吗？"),
 "féliciter": ("Je vous félicite pour votre promotion !", "恭喜您升职！"),
 "plaindre": ("Je te plains, c'est vraiment difficile.", "我同情你，这真的很难。"),
 "souhaiter": ("Je vous souhaite une bonne journée.", "我祝您有美好的一天。"),
 "usage": ("C'est un usage très répandu en France.", "这在法国是非常普遍的习俗。"),
}
CAT_POS = {"interjection":"interj.","adjectif":"adj.","adverbe":"adv.","verbe":"v.","pronom":"pron.","locution":"loc."}
def clean(lemma):
    """headword, plus a note for the form written in the lesson"""
    m = re.match(r"^(.*?)\s*\((s'|se)\)$", lemma)
    if m: return m.group(1), f"代词式（{m.group(2)}）：{lemma}"
    m = re.match(r"^(.*?)\((e|ne)\)$", lemma)
    if m: return m.group(1), f"形式：{lemma}"
    return lemma, ""
rows, md = [], []
pending = []
for lemma, kind, gbody, zh, ex, exzh, page in ITEMS:
    head, form_note = clean(lemma)
    if head in SUPPL:
        ex, exzh = SUPPL[head]
    key_lar = LAR.get(lemma, {})
    lar_cat = key_lar.get("category"); lar_g = key_lar.get("gender")
    notes = [n for n in [form_note] if n]
    if head in SUPPL: notes.append("例句为补充例句（非教材原句），含目标词")
    pos = None
    if kind.startswith("n") or kind == "n.m./f.":
        # noun: gender only from evidence
        b = BODY.get(head.lower()) or BODY.get(head)
        body_g = b[0] if b else None
        if body_g == "mf":
            # both genders written in the lesson (e.g. "un(e) ami(e)"): common-gender noun, never forced to one
            pos = "n.m./f."
            notes.append(f"阴阳性：正文「{b[1]}」(p.{b[2]})，阴阳两性均可")
        elif body_g and lar_g and body_g == lar_g:
            g = body_g if body_g != "mf" else lar_g
            pos = {"m":"n.m.","f":"n.f.","mf":"n.m./f."}[g]
            notes.append(f"阴阳性：正文「{b[1]}」(p.{b[2]}) + Larousse nom {'masculin' if g=='m' else 'féminin' if g=='f' else 'masculin et féminin'}")
        elif body_g and not lar_g:
            pos = {"m":"n.m.","f":"n.f.","mf":"n.m./f."}[body_g]
            notes.append(f"阴阳性：正文「{b[1]}」(p.{b[2]})；词典未取得")
        elif lar_g and not body_g and lar_g in ("m","f"):
            pos = {"m":"n.m.","f":"n.f."}[lar_g]
            notes.append(f"阴阳性：Larousse nom {'masculin' if lar_g=='m' else 'féminin'}（正文未见冠词）")
        else:
            pos = "n."
            pending.append(lemma)
            why = "正文无冠词，词典未确定" if lar_cat is None else "词典与正文不足以确定"
            notes.append(f"阴阳性待核实（{why}）；暂记 n.")
    else:
        pos = {"interj.":"interj.","adj.":"adj.","adv.":"adv.","v.":"v.","pron.":"pron.","loc.":"loc.","loc. adv.":"loc. adv."}.get(kind, kind)
        fam = CAT_POS.get(lar_cat or "", None)
        if lar_cat is None:
            notes.append("词性：词典未取得")
        elif fam and fam != pos and not (pos == "adv." and fam == "adj.") :
            notes.append(f"词性：Larousse 首义为 {lar_cat}，本课用法为 {pos}（{ex[:20]}…）")
        elif fam == pos:
            notes.append(f"词性：Larousse {lar_cat}，与本课一致")
        else:
            notes.append(f"词性：本课用法为 {pos}；Larousse 首义为 {lar_cat}，待核对")
        if pos == "adv." and fam == "adj.":
            notes.append("本课用法为副词（如 Ça va bien）；Larousse 首义为形容词")
    if key_lar.get("queried") and not key_lar.get("headword_seen"):
        notes.append("词典：Larousse 未取得该词条（已查询）")
    if key_lar.get("url"): notes.append(f"Larousse: {key_lar['url']}")
    notes.append("例句译文与释义为补充翻译，待核对")
    if head == "vœu":
        # Académie française 9e éd. (2024), entry VŒU: "nom masculin"; plural vœux
        pos = "n.m."
        notes.append("词性依据：Académie française 9e éd.「VŒU nom masculin」（https://www.dictionnaire-academie.fr/article/A9V1073）；复数 vœux")
    row = {
      "lemma": head, "pos": pos, "level": "unverified",
      "level_basis": "推定 A1（教材定位：封面「A1 DÉBUTANT」；前言「niveau faux-débutant」）",
      "topic": "society", "zh": zh, "zh_origin": "supplement", "zh_status": "补充翻译·待核对",
      "fr_def": "", "example_fr": ex, "example_zh": exzh,
      "col": "", "fam": "", "syn": "", "ant": "", "tip": "", "note": "；".join(notes),
      "origin": "book", "book": BOOK, "kind": "lesson", "chapter": "LES USAGES - LA POLITESSE（第 1 课）",
      "printed_page": page, "pdf_page": page, "review": "unreviewed",
    }
    rows.append(row)
    md.append(f"| {head} | {pos} | {zh} | {ex} | {exzh} | p.{page} | {'；'.join(notes)} |")
os.makedirs("data/imports", exist_ok=True); os.makedirs("data/lessons", exist_ok=True)
with open("data/imports/debutant-lesson01.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
head = ("# 初级教材 第 1 课「LES USAGES - LA POLITESSE」词条\n\n"
        "来源：法语词汇渐进初级（Claire Miquel，CLE）第 6–13 页，正文印刷页码与 PDF 页一致。\n"
        "释义与例句译文为**补充翻译·待核对**（依据正文译写；Larousse 释义抓取结果不可靠，未采用）。\n"
        "阴阳性只按正文冠词/所有格或 Larousse 标注确定；其余名词写作 `n.`。\n\n"
        "| 词条 | 词性 | 释义（补充翻译） | 正文例句 | 例句译文（补充翻译） | 页码 | 核对记录 |\n|---|---|---|---|---|---|---|\n")
open("data/lessons/lesson01.md", "w", encoding="utf-8").write(head + "\n".join(md) + "\n")
print("rows:", len(rows), "| nouns pending gender (n.):", len(pending), pending)
