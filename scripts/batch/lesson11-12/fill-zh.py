#!/usr/bin/env python3
"""Fill zh glosses and verbatim examples for Débutant lesson 11 and 12 list words.

Input : data/imports/debutant-lesson11-15-bulk.csv  (source rows, NOT modified)
Output: data/imports/debutant-lesson11-12-fill.csv  (same rows with zh / example filled)
Check : every example_fr must appear verbatim in the lesson source text
        (data/lessons/lesson11-source-pages.txt, lesson12-source-pages.txt).
Log   : output/lesson11-12/fill.log  (details; console prints only a summary)

All glosses are supplementary translations: zh_status = 补充翻译·待核对.
"""
import csv, json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SRC = os.path.join(ROOT, "data/imports/debutant-lesson11-15-bulk.csv")
OUT = os.path.join(ROOT, "data/imports/debutant-lesson11-12-fill.csv")
LOG = os.path.join(ROOT, "output/lesson11-12/fill.log")
TEXTS = [os.path.join(ROOT, "data/lessons/lesson11-source-pages.txt"),
         os.path.join(ROOT, "data/lessons/lesson12-source-pages.txt")]

# ---------------------------------------------------------------- glosses
ZH = {
    # ---- Lesson 11 LES ACTIVITÉS QUOTIDIENNES
    "accompagner": "陪同；送（某人去某处）",
    "agenda": "记事本；日程本",
    "aller chercher": "去接；去取",
    "allumette": "火柴",
    "ampoule": "灯泡",
    "aspirateur": "吸尘器",
    "bain": "洗澡；浴缸",
    "bougie": "蜡烛",
    "brosse": "刷子；牙刷（brosse à dents）",
    "brosser": "刷；梳理",
    "bus": "公共汽车",
    "cantine": "食堂；学校餐厅",
    "carnet": "小本子；笔记本",
    "chéquier": "支票本",
    "ciseaux": "剪刀",
    "consulter": "查阅；查看",
    "coucher": "使躺下；（se coucher）上床睡觉",
    "coup de fil": "电话（口语，passer un coup de fil 打电话）",
    "courses": "购物；采购（faire les courses 买东西）",
    "crayon": "铅笔",
    "dentifrice": "牙膏",
    "déjeuner": "吃午饭",
    "enveloppe": "信封",
    "gomme": "橡皮",
    "information": "信息；消息",
    "Internet": "互联网",
    "journal": "报纸；日记",
    "laver": "洗",
    "lessive": "洗衣；洗衣粉（faire la lessive 洗衣服）",
    "linge": "衣物；布草",
    "lire": "读；阅读",
    "machine": "机器（machine à laver 洗衣机）",
    "mail": "电子邮件",
    "maquillage": "化妆；化妆品",
    "maquiller": "化妆（se maquiller 化妆）",
    "matin": "早上；上午",
    "mousse": "泡沫（mousse à raser 剃须泡沫）",
    "ménage": "家务（faire le ménage 做家务）",
    "métro": "地铁",
    "nettoyer": "清洁；打扫",
    "nouvelle": "消息；新闻（多用复数 les nouvelles）",
    "objet": "物品；东西",
    "ordinateur": "电脑",
    "paire": "一双；一副；一对",
    "papier": "纸",
    "paquet": "包；包裹",
    "partir": "离开；出发",
    "peigne": "梳子",
    "photo": "照片",
    "plier": "折叠",
    "portable": "手机（口语）；便携的",
    "porte-monnaie": "零钱包；钱包",
    "portefeuille": "皮夹；钱包",
    "préparer": "准备（se préparer 做好准备）",
    "prêt": "准备好的；就绪的",
    "quotidien": "日常的；每天的",
    "radio": "收音机；广播",
    "ranger": "收拾；整理",
    "raser": "剃（须）（se raser 刮胡子）",
    "rasoir": "剃须刀",
    "recyclé": "回收的；再生的",
    "regarder": "看；注视",
    "repassage": "熨烫",
    "repasser": "熨烫",
    "shampooing": "洗发水；洗发",
    "soir": "晚上",
    "stylo": "钢笔；圆珠笔",
    "sèche-cheveux": "吹风机",
    "sécher": "弄干；（se sécher）擦干身体",
    "taille-crayon": "卷笔刀",
    "temps": "时间；时光",
    "ticket": "票；车票",
    "travail": "工作；劳动",
    "trousse": "文具盒；小包（trousse de maquillage 化妆包）",
    "téléphoner": "打电话",
    "utile": "有用的；有益的",
    "vaisselle": "餐具；待洗的碗碟（faire la vaisselle 洗碗）",
    "vitre": "玻璃窗",
    "école": "学校",
    "électrique": "用电的；电动的",
    "électronique": "电子的",
    # ---- Lesson 12 LES PRODUITS ALIMENTAIRES - LES COMMERCES
    "abricot": "杏",
    "ail": "大蒜",
    "alimentaire": "食品的；饮食的",
    "ananas": "菠萝",
    "assiette": "盘子；一盘（assiette de 一盘……）",
    "aubergine": "茄子",
    "banane": "香蕉",
    "carotte": "胡萝卜",
    "cerise": "樱桃",
    "champignon": "蘑菇",
    "chou-fleur": "花椰菜",
    "citron": "柠檬",
    "commerce": "商店；商业",
    "concombre": "黄瓜",
    "courgette": "西葫芦",
    "cru": "生的",
    "crudité": "生蔬菜（拼盘）",
    "cuit": "煮熟的；烤熟的",
    "fraise": "草莓",
    "framboise": "覆盆子；树莓",
    "fruit": "水果",
    "haricot": "豆角（haricot vert 四季豆）",
    "kiwi": "猕猴桃",
    "légume": "蔬菜",
    "marchand": "商贩；店主（marchand de fruits 水果商）",
    "melon": "甜瓜",
    "mûr": "成熟的",
    "oignon": "洋葱",
    "pamplemousse": "葡萄柚",
    "poire": "梨",
    "poireau": "韭葱",
    "poivron": "甜椒",
    "pomme": "苹果",
    "pomme de terre": "土豆",
    "produit": "产品；商品",
    "pêche": "桃子",
    "radis": "萝卜（小红萝卜）",
    "raisin": "葡萄",
    "salade": "生菜；沙拉",
    "tomate": "番茄",
    "épinards": "菠菜",
    "éplucher": "削皮；剥皮",
    "agneau": "羊肉；羔羊",
    "aile": "翅膀；（禽类的）翅",
    "apéritif": "餐前开胃酒",
    "armagnac": "雅文邑白兰地",
    "arête": "鱼刺",
    "baguette": "法棍面包",
    "base": "基础；主要成分（à base de 以……为主料）",
    "basilic": "罗勒",
    "beurre": "黄油",
    "biologique": "有机的；生态的",
    "bière": "啤酒",
    "boisson": "饮料",
    "bonbon": "糖果",
    "boucherie": "肉店；肉铺",
    "bouf": "牛肉（bœuf 的误拼，待与 bœuf 合并）",
    "boulangerie": "面包店",
    "brie": "布里干酪",
    "café": "咖啡",
    "camembert": "卡芒贝尔干酪",
    "camomille": "洋甘菊",
    "campagne": "乡村；田野（pain de campagne 乡村面包）",
    "canard": "鸭；鸭肉",
    "champagne": "香槟",
    "charcuterie": "熟食；熟肉制品；熟食店",
    "chaud": "热的",
    "chocolat": "巧克力",
    "chèvre": "山羊（fromage de chèvre 山羊奶酪）",
    "cidre": "苹果酒",
    "cognac": "科涅克白兰地",
    "condiment": "调味品",
    "confiture": "果酱",
    "conserve": "罐头",
    "coquillage": "贝类",
    "coquille Saint-Jacques": "扇贝",
    "cornichon": "小酸黄瓜",
    "crabe": "螃蟹",
    "crevette": "虾",
    "croissant": "羊角面包",
    "crème": "奶油；乳脂",
    "crèmerie": "奶制品店",
    "cuisse": "腿（禽类大腿）",
    "côtelette": "排骨；肋排",
    "digestif": "餐后酒",
    "dinde": "火鸡",
    "eau": "水",
    "entrecôte": "肋骨牛排",
    "escalope": "薄肉片（猪排、牛排等）",
    "estragon": "龙蒿",
    "farine": "面粉",
    "filet": "里脊；鱼片",
    "fin": "细的；薄的",
    "fromage": "奶酪",
    "fromagerie": "奶酪店",
    "fruit de mer": "海鲜（贝类等）",
    "gazeux": "含气的；有气泡的",
    "gigot": "羊腿",
    "glace": "冰淇淋；冰",
    "gâteau": "蛋糕",
    "herbe": "草本植物；香草",
    "huile": "油",
    "huître": "生蚝",
    "infusion": "花草茶；草药茶",
    "jambon": "火腿",
    "jus": "果汁",
    "lait": "牛奶",
    "lavande": "薰衣草",
    "macaroni": "通心粉",
    "mayonnaise": "蛋黄酱",
    "menthe": "薄荷",
    "millefeuille": "千层酥（拿破仑蛋糕）",
    "minéral": "矿物的（eau minérale 矿泉水）",
    "morceau": "块；小段",
    "moule": "贻贝；淡菜",
    "moutarde": "芥末",
    "muscat": "麝香葡萄酒",
    "olive": "橄榄",
    "pain": "面包",
    "pastis": "茴香酒（皮斯提）",
    "persil": "欧芹",
    "pois chiche": "鹰嘴豆",
    "poisson": "鱼",
    "poissonnerie": "鱼店",
    "poivre": "胡椒",
    "porc": "猪肉",
    "porto": "波特酒",
    "poudre": "粉末",
    "poulet": "鸡肉",
    "Provence": "普罗旺斯（herbes de Provence 普罗旺斯混合香草）",
    "pâte": "面团；面食（pâtes 意面）",
    "pâtisserie": "糕点；糕点店",
    "pâté": "肉酱；肉馅",
    "pétillant": "起泡的；带气的",
    "riz": "大米",
    "romarin": "迷迭香",
    "roquefort": "洛克福蓝纹奶酪",
    "rosé": "桃红葡萄酒",
    "rôti": "烤肉",
    "sardine": "沙丁鱼",
    "sauce": "酱汁",
    "saucisse": "香肠",
    "saucisson": "干香肠",
    "saumon": "三文鱼",
    "sel": "盐",
    "sole": "鳎鱼",
    "sorbet": "果子冰",
    "spaghetti": "意大利面",
    "sucre": "糖",
    "sucrerie": "甜食；糖果",
    "supermarché": "超市",
    "tarte": "挞",
    "thon": "金枪鱼",
    "thym": "百里香",
    "thé": "茶",
    "tournesol": "向日葵（huile de tournesol 葵花籽油）",
    "tranche": "薄片；片",
    "vanille": "香草",
    "veau": "小牛肉",
    "vegétarien": "素食的；素食者",
    "verveine": "马鞭草（草本茶）",
    "viande": "肉",
    "vin": "葡萄酒",
    "vinaigre": "醋",
    "vinaigrette": "油醋汁",
    "volaille": "家禽；禽肉",
    "whisky": "威士忌",
    "yaourt": "酸奶",
    "éclair": "泡芙（éclair 长条泡芙）",
    "épicerie": "杂货店",
    "œuf": "鸡蛋；蛋",
}

# ---------------------------------------------------------------- examples
# lemma -> (fr, zh). fr must be verbatim (whitespace-normalised) in the lesson source.
EX = {
    # Lesson 11
    "nettoyer": ("Elle nettoie la salle de bains.", "她打扫浴室。"),
    "aspirateur": ("Jean passe l'aspirateur.", "Jean 用吸尘器打扫。"),
    "plier": ("Il plie le linge.", "他叠衣服。"),
    "linge": ("Il plie le linge.", "他叠衣服。"),
    "ménage": ("Qui fait le ménage à la maison, vous ou Léa ?", "家里谁做家务，您还是 Léa？"),
    "courses": ("Quand est-ce que vous faites les courses ?", "您什么时候买东西？"),
    "journal": ("Je lis les journaux sur Internet", "我在网上看报纸。"),
    "lire": ("Je lis les journaux sur Internet", "我在网上看报纸。"),
    "Internet": ("Je lis les journaux sur Internet", "我在网上看报纸。"),
    "mail": ("je regarde/lis mes mails", "我看/读我的电子邮件。"),
    "regarder": ("je regarde/lis mes mails", "我看/读我的电子邮件。"),
    "ordinateur": ("je passe du temps sur mon ordinateur !", "我花时间在电脑上。"),
    "temps": ("je passe du temps sur mon ordinateur !", "我花时间在电脑上。"),
    "consulter": ("Bien sûr, je consulte mon répondeur", "当然，我查看我的电话留言。"),
    "coup de fil": ("je passe quelques coups de fil", "我打几个电话。"),
    "téléphoner": ("je téléphone à des personnes", "给一些人打电话。"),
    "radio": ("Est-ce que vous écoutez la radio le matin ?", "您早上听广播吗？"),
    "matin": ("Est-ce que vous écoutez la radio le matin ?", "您早上听广播吗？"),
    "information": ("pour écouter les informations / les nouvelles", "为了听新闻。"),
    "nouvelle": ("pour écouter les informations / les nouvelles", "为了听新闻。"),
    "allumette": ("une boîte d'allumettes", "一盒火柴"),
    "trousse": ("une trousse de maquillage", "一个化妆包"),
    "maquillage": ("une trousse de maquillage", "一个化妆包"),
    "coucher": ("Jean et Léa se couchent.", "Jean 和 Léa 上床睡觉。"),
    "maquiller": ("Ensuite, elle se maquille.", "然后她化妆。"),
    "brosser": ("je me brosse les dents", "我刷牙。"),
    "préparer": ("Le matin, Léa se prépare.", "早上，Léa 梳洗打扮。"),
    "prêt": ("Maintenant, elle est prête.", "她现在准备好了。"),
    "vitre": ("Léa fait les vitres.", "Léa 擦玻璃窗。"),
    "bain": ("elle prend une douche ou un bain", "她淋浴或泡澡。"),
    "portable": ("un téléphone mobile = un portable", "手机（mobile phone）＝ 手机（portable）。"),
    "recyclé": ("du papier recyclé", "再生纸。"),
    "papier": ("du papier recyclé", "再生纸。"),
    # Lesson 12
    "légume": ("On peut acheter des légumes et des fruits frais chez le marchand de fruits et légumes.", "可以在水果蔬菜商那里买到新鲜的蔬菜和水果。"),
    "fruit": ("On peut acheter des légumes et des fruits frais chez le marchand de fruits et légumes.", "可以在水果蔬菜商那里买到新鲜的蔬菜和水果。"),
    "marchand": ("On peut acheter des légumes et des fruits frais chez le marchand de fruits et légumes.", "可以在水果蔬菜商那里买到新鲜的蔬菜和水果。"),
    "cru": ("On mange les légumes crus (comme par exemple les radis, les concombres...)", "人们生吃蔬菜（比如萝卜、黄瓜……）。"),
    "radis": ("On mange les légumes crus (comme par exemple les radis, les concombres...)", "人们生吃蔬菜（比如萝卜、黄瓜……）。"),
    "concombre": ("On mange les légumes crus (comme par exemple les radis, les concombres...)", "人们生吃蔬菜（比如萝卜、黄瓜……）。"),
    "crudité": ("une assiette de crudités", "一盘生蔬菜拼盘。"),
    "assiette": ("une assiette de crudités", "一盘生蔬菜拼盘。"),
    "éplucher": ("Anne épluche un fruit.", "Anne 削一个水果的皮。"),
    "viande": ("On achète la viande chez le boucher (= à la boucherie)", "肉在肉店（屠夫）那里买。"),
    "boucherie": ("On achète la viande chez le boucher (= à la boucherie)", "肉在肉店（屠夫）那里买。"),
    "poisson": ("On achète le poisson et les fruits de mer chez le poissonnier (= à la poissonnerie).", "鱼和海鲜在鱼贩那里买（＝在鱼店）。"),
    "poissonnerie": ("On achète le poisson et les fruits de mer chez le poissonnier (= à la poissonnerie).", "鱼和海鲜在鱼贩那里买（＝在鱼店）。"),
    "fruit de mer": ("On achète le poisson et les fruits de mer chez le poissonnier (= à la poissonnerie).", "鱼和海鲜在鱼贩那里买（＝在鱼店）。"),
    "arête": ("Oui, madame. J'enlève la tête et les arêtes?", "好的，女士。我去掉鱼头和鱼刺？"),
    "charcuterie": ("Dans un bistrot, on peut commander une « assiette de charcuterie ».", "在小酒馆里可以点一盘熟食拼盘。"),
    "fromage": ("On dit qu'il y a 365 sortes de fromages en France!", "据说法国有 365 种奶酪！"),
    "fromagerie": ("On achète du bon fromage chez un fromager (= à la fromagerie).", "好的奶酪在奶酪商那里买（＝在奶酪店）。"),
    "biologique": ("Les Français apprécient de plus en plus les produits « biologiques » (= naturels).", "法国人越来越喜欢有机（即天然）产品。"),
    "épicerie": ("On peut acheter ces produits dans une épicerie = un petit supermarché.", "这些产品可以在杂货店（即小超市）买到。"),
    "supermarché": ("On peut acheter du vin et des alcools dans un supermarché,", "葡萄酒和烈酒可以在超市买到。"),
    "vin": ("On peut acheter du vin et des alcools dans un supermarché,", "葡萄酒和烈酒可以在超市买到。"),
    "vinaigrette": ("Si on mélange de l'huile, du vinaigre, du sel et du poivre,", "如果把油、醋、盐和胡椒混合，就得到油醋汁。"),
    "vinaigre": ("Si on mélange de l'huile, du vinaigre, du sel et du poivre,", "如果把油、醋、盐和胡椒混合，就得到油醋汁。"),
    "pain": ("Pour acheter du pain, on va chez le boulanger (= à la boulangerie), et pour", "买面包去面包师那里（＝面包店）；买蛋糕去糕点师那里。"),
    "boulangerie": ("Attention à la préposition! «Je vais à la boulangerie » = « Je vais chez le boulanger ».", "注意介词！「Je vais à la boulangerie」＝「Je vais chez le boulanger」。"),
    "cidre": ("le cidre (boisson pétillante à base de pomme, légèrement alcoolisée)", "苹果酒（用苹果酿造的起泡饮料，酒精度较低）。"),
    "herbe": ("On peut aussi ajouter des fines herbes (basilic, estragon, persil...)", "也可以加入细香草（罗勒、龙蒿、欧芹……）。"),
    "Provence": ("ou des herbes de Provence (thym, romarin, lavande...)", "或普罗旺斯香草（百里香、迷迭香、薰衣草……）。"),
}

# Sentences exist in the page but OCR interleaves the two columns, so they could not be
# verified verbatim. They are NOT entered as examples (see note); check against the page image later.
INTERLEAVED = {"repasser", "repassage", "ranger", "travail", "école", "accompagner", "aller chercher",
               "cantine", "déjeuner", "raser", "rasoir", "mousse", "laver", "vaisselle", "lessive",
               "sécher", "sèche-cheveux", "shampooing", "dentifrice", "bus", "ticket", "métro", "paquet"}

# ------------------------------------------------------------ helpers
def norm_text(s):
    s = re.sub(r"===[^\n]*===", " ", s)
    s = s.replace("•", " ")
    return re.sub(r"\s+", " ", s)

def main():
    src_text = norm_text("\n".join(open(p, encoding="utf-8").read() for p in TEXTS))
    rows = list(csv.DictReader(open(SRC, encoding="utf-8")))
    sel = [r for r in rows if r["chapter"].startswith(("LES ACTIVITÉS", "LES PRODUITS"))]
    assert len(sel) == 252, len(sel)

    log = []
    problems = []
    missing_zh = []
    for r in sel:
        if r["lemma"] not in ZH:
            missing_zh.append(r["lemma"])
    for ex_lemma in EX:
        if ex_lemma not in {r["lemma"] for r in sel}:
            problems.append(f"示例对应的词条不在第 11–12 课 CSV 中：{ex_lemma}")

    checked = failed = 0
    for lemma, (fr, zh) in EX.items():
        checked += 1
        if fr not in src_text:
            failed += 1
            problems.append(f"例句未在原文逐字找到：{lemma} → {fr}")
    log.append(f"examples checked={checked} verbatim_fail={failed}")

    out_rows = []
    n_zh = n_ex = 0
    for r in sel:
        nr = dict(r)
        nr["zh"] = ZH.get(r["lemma"], "")
        nr["zh_origin"] = "supplement"
        nr["zh_status"] = "补充翻译·待核对"
        if r["lemma"] in EX:
            fr, zh_ex = EX[r["lemma"]]
            nr["example_fr"] = fr
            nr["example_zh"] = zh_ex + "（补充翻译·待核对）"
            nr["note"] = "例句逐字可见于教材原页（已核对）；释义为补充翻译·待核对"
            n_ex += 1
        elif r["lemma"] in INTERLEAVED:
            nr["note"] = "教材正文有相关句子但版面两栏错行（OCR 断句交错），未能逐字核对，暂未录入例句；释义为补充翻译·待核对"
        else:
            nr["note"] = "教材正文为词汇列表，无独立例句；释义为补充翻译·待核对"
        if nr["zh"]:
            n_zh += 1
        if r["lemma"] == "bouf":
            nr["tip"] = "拼写 bouf 疑为 bœuf 误拼；与 bœuf 的合并待处理（见 data/SCOPE-AND-GAPS.md）"
        if r["lemma"] == "Provence":
            nr["tip"] = "原词表为 Provence（herbes de Provence）；词性 n.f. 待核实"
        if r["lemma"] == "électronique" and r["pos"] == "待核实":
            nr["tip"] = "原词表词性待核实；已有 adj. 条目"
        out_rows.append(nr)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()))
        w.writeheader()
        w.writerows(out_rows)

    log.append(f"rows={len(out_rows)} zh_filled={n_zh} example_rows={n_ex}")
    log.append(f"missing_zh={missing_zh}")
    log.extend(problems)
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    with open(LOG, "w", encoding="utf-8") as f:
        f.write("\n".join(log) + "\n")

    print(f"rows={len(out_rows)} zh={n_zh}/{len(out_rows)} examples={n_ex} verbatim_fail={failed} missing_zh={len(missing_zh)} problems={len(problems)}")
    print(f"fill_csv={os.path.relpath(OUT, ROOT)} log={os.path.relpath(LOG, ROOT)}")
    return 1 if (missing_zh or problems) else 0

if __name__ == "__main__":
    sys.exit(main())
