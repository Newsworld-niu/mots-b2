#!/usr/bin/env python3
"""Round 2 for lessons 11–12 (no change to the bulk source CSV).

1. 23 lesson-11 list words whose examples were blocked by OCR column interleaving:
   examples now come from the rendered page image (data/lessons/lesson11-image-captions.txt).
2. électronique as ADJECTIVE (p.58 "courriers électroniques"); the 待核实 row is not merged.
3. bœuf (p.66 image confirms "le bœuf"); the OCR-typed "bouf" becomes an alias (done in lexicon step).
4. Words taught on lesson 11 pages (images p.58/60/62) but missing from the bulk CSV.

Output: data/imports/debutant-lesson11-12-fix.csv ; log: output/lesson11-12/fix.log
Every example_fr must appear verbatim (whitespace-normalised) in the image transcript or OCR text.
"""
import csv, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
FILL = os.path.join(ROOT, "data/imports/debutant-lesson11-12-fill.csv")
OUT = os.path.join(ROOT, "data/imports/debutant-lesson11-12-fix.csv")
LOG = os.path.join(ROOT, "output/lesson11-12/fix.log")
TEXTS = [os.path.join(ROOT, "data/lessons/lesson11-image-captions.txt"),
         os.path.join(ROOT, "data/lessons/lesson11-source-pages.txt"),
         os.path.join(ROOT, "data/lessons/lesson12-source-pages.txt")]
L11 = "LES ACTIVITÉS QUOTIDIENNES（第 11 课）"
L12 = "LES PRODUITS ALIMENTAIRES - LES COMMERCES（第 12 课）"

# lemma -> (example_fr, example_zh)  for existing L11 rows
EXISTING_EX = {
    "repasser": ("Jean fait du repassage: il repasse un pantalon.", "Jean 做熨烫：他熨一条裤子。"),
    "repassage": ("Jean fait du repassage: il repasse un pantalon.", "Jean 做熨烫：他熨一条裤子。"),
    "ranger": ("Il le range dans les placards.", "他把衣服收进壁橱里。"),
    "travail": ("Léa part de la maison, elle part au travail.", "Léa 离开家去上班。"),
    "école": ("Jean accompagne les enfants à l'école.", "Jean 送孩子们去学校。"),
    "accompagner": ("Jean accompagne les enfants à l'école.", "Jean 送孩子们去学校。"),
    "aller chercher": ("Léa va chercher les enfants à l'école.", "Léa 去学校接孩子们。"),
    "cantine": ("Les enfants déjeunent à la cantine l'école.", "孩子们在食堂吃午饭（图注末尾原样为 l'école，疑为排版错误）。"),
    "déjeuner": ("Les enfants déjeunent à la cantine l'école.", "孩子们在食堂吃午饭（图注末尾原样为 l'école，疑为排版错误）。"),
    "raser": ("Jean se rase avec un rasoir et de la mousse à raser.", "Jean 用剃须刀和剃须泡沫刮胡子。"),
    "rasoir": ("Jean se rase avec un rasoir et de la mousse à raser.", "Jean 用剃须刀和剃须泡沫刮胡子。"),
    "mousse": ("Jean se rase avec un rasoir et de la mousse à raser.", "Jean 用剃须刀和剃须泡沫刮胡子。"),
    "laver": ("Elle lave à la main certains vêtements.", "她手洗一些衣服。"),
    "vaisselle": ("Léa fait la vaisselle, car elle n'a pas de lave-vaisselle.", "Léa 洗碗，因为她没有洗碗机。"),
    "lessive": ("Elle fait la lessive: elle met le linge à laver dans le lave-linge (= la machine à laver).", "她洗衣服：把要洗的衣物放进洗衣机（＝洗衣机）。"),
    "sécher": ("elle se sèche les cheveux avec un sèche-cheveux", "她用吹风机吹干头发。"),
    "sèche-cheveux": ("elle se sèche les cheveux avec un sèche-cheveux", "她用吹风机吹干头发。"),
    "shampooing": ("elle se lave les cheveux avec du shampooing", "她用洗发水洗头发。"),
    "dentifrice": ("elle se brosse (= se lave) les dents avec du dentifrice et une brosse à dents.", "她用牙膏和牙刷刷牙。"),
    "bus": ("des tickets de bus ou de métro", "公交车票或地铁票。"),
    "ticket": ("des tickets de bus ou de métro", "公交车票或地铁票。"),
    "métro": ("des tickets de bus ou de métro", "公交车票或地铁票。"),
    "paquet": ("un paquet de mouchoirs en papier", "一包纸巾。"),
    "ampoule": ("une ampoule électrique", "一个电灯泡。"),
    "électrique": ("une ampoule électrique", "一个电灯泡。"),
}

# new rows: lemma, pos, zh, example(fr, zh) or None, printed page, chapter, note
NEW = [
    ("électronique", "adj.", "电子的", ("je regarde/lis mes mails (= courriers électroniques)", "我看/读我的邮件（＝电子邮件）。"), 58, L11, "adj. 用法：courriers électroniques（原页 58）；与名词 électronique 待核实条目分开"),
    ("bœuf", "n.m.", "牛肉", None, 66, L12, "原词表 OCR 误作 bouf；已对照第 66 页图像（le bœuf）"),
    ("clé", "n.f.", "钥匙", None, 62, L11, "教材图注：des clés（第 62 页）"),
    ("parapluie", "n.m.", "雨伞", ("un petit parapluie", "一把小雨伞。"), 62, L11, "教材图注（第 62 页）"),
    ("briquet", "n.m.", "打火机", ("une boîte d'allumettes et un briquet", "一盒火柴和一个打火机。"), 62, L11, "教材图注（第 62 页）"),
    ("lunettes de soleil", "loc.", "太阳镜", None, 62, L11, "教材图注：des lunettes de soleil（第 62 页）"),
    ("mouchoir", "n.m.", "手帕；纸巾", ("un paquet de mouchoirs en papier", "一包纸巾。"), 62, L11, "教材图注（第 62 页）"),
    ("boîte", "n.f.", "盒；罐", None, 62, L11, "教材图注：une boîte（第 62 页）"),
    ("lampe", "n.f.", "灯；台灯", ("Léa allume la lampe.", "Léa 开灯。"), 58, L11, "教材图注（第 58 页）"),
    ("réveil", "n.m.", "闹钟", ("Le réveil sonne à 7 heures.", "闹钟七点响。"), 58, L11, "教材图注（第 58 页）"),
    ("douche", "n.f.", "淋浴", ("elle prend une douche ou un bain", "她淋浴或泡澡。"), 60, L11, "教材正文（第 60 页）"),
    ("savon", "n.m.", "肥皂", ("elle se lave avec du savon", "她用肥皂洗。"), 60, L11, "教材正文（第 60 页）"),
    ("toilette", "n.f.", "梳洗；洗漱（faire sa toilette 梳洗）", ("Elle fait sa toilette", "她梳洗。"), 60, L11, "教材正文（第 60 页）"),
    ("lave-linge", "n.m.", "洗衣机", ("dans le lave-linge", "放进洗衣机里。"), 60, L11, "教材正文：le lave-linge（= la machine à laver）（第 60 页）"),
    ("lave-vaisselle", "n.m.", "洗碗机", ("Léa fait la vaisselle, car elle n'a pas de lave-vaisselle.", "Léa 洗碗，因为她没有洗碗机。"), 60, L11, "教材正文（第 60 页）"),
    ("placard", "n.m.", "壁橱；柜子", ("Il le range dans les placards.", "他把衣服收进壁橱里。"), 60, L11, "教材正文（第 60 页）"),
    ("dîner", "v.", "吃晚饭", ("La famille dîne.", "一家人吃晚饭。"), 58, L11, "教材正文（第 58 页）"),
    ("maison", "n.f.", "房子；家（à la maison 在家）", ("Jean rentre à la maison, il rentre du travail.", "Jean 回到家，他下班回来。"), 58, L11, "教材正文（第 58 页）"),
    ("bébé", "n.m.", "婴儿", None, 62, L11, "教材图注：des photos de bébé（第 62 页）"),
    ("sac à main", "n.m.", "手提包", ("Il y a beaucoup de choses dans le sac à main de Lise!", "Lise 的手提包里有很多东西！"), 62, L11, "教材正文（第 62 页）"),
    ("sac", "n.m.", "袋子（sac en plastique 塑料袋）", None, 62, L11, "教材图注：un sac en plastique（第 62 页）"),
    ("téléphone", "n.m.", "电话；电话机（téléphone mobile 手机）", ("un téléphone mobile = un portable", "手机＝portable（口语）。"), 62, L11, "教材图注（第 62 页）"),
]

def norm(s):
    s = re.sub(r"===[^\n]*===", " ", s)
    s = s.replace("•", " ")
    return re.sub(r"\s+", " ", s)

def main():
    corpus = norm("\n".join(open(p, encoding="utf-8").read() for p in TEXTS))
    fill = list(csv.DictReader(open(FILL, encoding="utf-8")))
    by_lemma = {r["lemma"]: r for r in fill}
    out, log, problems = [], [], []

    for lemma, (fr, zh) in EXISTING_EX.items():
        base = by_lemma.get(lemma)
        if base is None:
            problems.append(f"词条不在 fill CSV：{lemma}")
            continue
        if fr not in corpus:
            problems.append(f"例句未在图注/原文逐字找到：{lemma} → {fr}")
            continue
        r = dict(base)
        r["example_fr"], r["example_zh"] = fr, zh + "（补充翻译·待核对）"
        r["note"] = "例句：教材原页图注，已对照渲染图像逐字核对；释义为补充翻译·待核对"
        out.append(r)

    for lemma, pos, zh, ex, page, chapter, note in NEW:
        tmpl = by_lemma["accompagner"] if chapter == L11 else by_lemma["fruit"]
        r = dict(tmpl)
        r.update({
            "lemma": lemma, "pos": pos, "zh": zh, "zh_origin": "supplement",
            "zh_status": "补充翻译·待核对", "fr_def": "", "example_fr": "", "example_zh": "",
            "col": "", "fam": "", "syn": "", "ant": "", "tip": "",
            "note": note, "origin": "book", "kind": "lesson", "chapter": chapter,
            "printed_page": str(page), "pdf_page": str(page), "review": "unreviewed",
            "topic": tmpl["topic"],
        })
        if ex:
            fr, zh_ex = ex
            if fr not in corpus:
                problems.append(f"例句未在图注/原文逐字找到：{lemma} → {fr}")
            r["example_fr"], r["example_zh"] = fr, zh_ex + "（补充翻译·待核对）"
        out.append(r)

    if problems:
        print("PROBLEMS:", len(problems))
    ok_ex = sum(1 for r in out if r["example_fr"])
    log.append(f"rows={len(out)} examples={ok_ex} problems={len(problems)}")
    log += problems
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0].keys()))
        w.writeheader()
        w.writerows(out)
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    open(LOG, "w", encoding="utf-8").write("\n".join(log) + "\n")
    print(f"rows={len(out)} examples={ok_ex} problems={len(problems)}")
    print(f"fix_csv={os.path.relpath(OUT, ROOT)} log={os.path.relpath(LOG, ROOT)}")
    return 1 if problems else 0

if __name__ == "__main__":
    sys.exit(main())
