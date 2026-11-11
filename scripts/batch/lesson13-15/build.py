#!/usr/bin/env python3
"""Fill zh glosses and verbatim examples for Débutant lessons 13, 14, 15 (+ taught words missing from the CSV).

Input : data/imports/debutant-lesson11-15-bulk.csv (unchanged)
Output: data/imports/debutant-lesson13-15-fill.csv
Check : every example_fr must appear (whitespace-normalised) in the corpus:
        OCR of the teaching pages (references/extracted/debutant_ocr.json, pages 72–84)
        + image transcripts (data/lessons/lesson13-15-image-transcript.txt).
Log   : output/lesson13-15/fill.log
Rows whose CSV pos is 待核实 get a pos from the page evidence in POS_OVERRIDE.
"""
import csv, json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SRC = os.path.join(ROOT, "data/imports/debutant-lesson11-15-bulk.csv")
OUT = os.path.join(ROOT, "data/imports/debutant-lesson13-15-fill.csv")
LOG = os.path.join(ROOT, "output/lesson13-15/fill.log")
OCR = os.path.join(ROOT, "references/extracted/debutant_ocr.json")
TRANSCRIPT = os.path.join(ROOT, "data/lessons/lesson13-15-image-transcript.txt")

L13 = "FAIRE LES COURSES（第 13 课）"
L14 = "LA CUISINE - LES REPAS（第 14 课）"
L15 = "LE TEMPS QUI PASSE（第 15 课）"
L12 = "LES PRODUITS ALIMENTAIRES - LES COMMERCES（第 12 课）"

# ------------------------------------------------------------------ bulk rows: zh
ZH = {
    # ---- 13
    "achat": "购买；购物（pl. achats 购物）", "barquette": "（小）盒；托盘（une barquette de 一盒……）",
    "biscuit": "饼干", "bon marché": "便宜的", "bouteille": "瓶；一瓶", "caisse": "收银台；收款处",
    "ceci": "这个", "chariot": "购物车；手推车", "client": "顾客；客户", "comme": "（口语）像这样（comme ça）",
    "commenter": "评论；议论", "demi-litre": "半升", "demi-livre": "半磅（250 克）", "devoir": "欠（钱）；应当",
    "dizaine": "大约十个；一组（约十个）", "domicile": "住所；家（à domicile 上门）", "douzaine": "一打（十二个）",
    "gramme": "克", "halle": "有顶的市场大厅；集市", "liste": "清单；名单", "litre": "升", "livraison": "送货；配送",
    "livre": "磅（约 500 克）", "livrer": "送货；递送", "marché": "市场；集市", "moitié": "一半；半",
    "panier": "篮子；购物篮", "petits pois": "豌豆", "prix": "价格", "quantité": "数量；分量", "rayon": "货架；柜台区域（超市分区）",
    "surface": "大型商店（une grande surface 大型超市）", "tablette": "一块（tablette de chocolat 一块巧克力）",
    "tout": "全部；所有（pron.：这些全部）", "tube": "管；软管（un tube de 一管……）", "épais": "厚的（épaisse）",
    "•miel": "蜂蜜（已修正为 miel，别名到 miel-m）",
    # ---- 14
    "addition": "账单；结账", "blanquette": "白汁炖肉（blanquette de veau 白汁小牛肉）", "boire": "喝",
    "bol": "大碗；碗（un bol de 一大碗……）", "bouchon": "瓶塞", "bourguignon": "勃艮第式的（bœuf bourguignon 勃艮第牛肉）",
    "brouillé": "炒的（œufs brouillés 炒蛋）", "brûlé": "烤焦的；焦糖的（crème brûlée 焦糖布丁）",
    "béarnais": "贝亚恩式的（sauce béarnaise 贝亚恩酱）", "cafetière": "咖啡壶", "carafe": "玻璃水壶；一壶",
    "casserole": "炖锅；小锅", "cendrier": "烟灰缸", "chef": "主厨；厨师长", "choisir": "选择",
    "cocotte": "铸铁炖锅", "couteau": "刀", "couvercle": "盖子", "cuillère": "勺子", "dessert": "甜点",
    "délicieux": "美味的", "faim": "饥饿；饥饿感（avoir faim 饿）", "flambé": "用酒点燃烹制的（flambée 火焰烹制）",
    "fourchette": "叉子", "gourmand": "贪吃的；美食的（salade gourmande 美食沙拉）",
    "goûter": "下午茶点（n.m.）；（动词）品尝", "lapin": "兔子；兔肉", "livre": "书（un livre de cuisine 一本烹饪书）",
    "lorraine": "洛林式的（quiche lorraine 洛林咸派）", "manger": "吃", "menu": "套餐；（固定价格的）菜单",
    "moule": "模具（moule à tarte 派模）", "nappe": "桌布", "passoire": "滤网；漏勺（passoire à thé 茶滤）",
    "plateau": "托盘；拼盘（plateau de fromages 奶酪拼盘）", "poêle": "平底煎锅", "principal": "主要的（plat principal 主菜）",
    "pruneau": "西梅；李子干", "quiche": "咸派（quiche lorraine 洛林咸派）", "quoi": "什么（pron.）",
    "recette": "菜谱；食谱", "repas": "一餐；饭食", "restaurant": "餐厅", "saladier": "沙拉碗", "serveur": "服务员（餐厅）",
    "soif": "口渴（avoir soif 渴）", "soufflé": "舒芙蕾（蓬松烘焙料理）", "soupe": "汤", "tartine": "（抹了黄油或果酱的）面包片",
    "tasse": "杯子；一杯", "théière": "茶壶", "tire-bouchon": "开瓶器", "truffe": "松露", "ustensile": "用具；厨具",
    "verre": "玻璃杯；一杯（un verre d'eau 一杯水）",
    # ---- 15
    "août": "八月（夏季）", "automne": "秋天", "avance": "提前（en avance 提前到）", "avril": "四月（春季）",
    "bal": "舞会", "banlieue": "郊区", "cadeau": "礼物", "demi-heure": "半小时（une demi-heure）",
    "dimanche": "星期日", "durée": "持续时间；时长", "décembre": "十二月（冬季）", "défilé": "游行；阅兵",
    "emploi": "用法；（emploi du temps）日程表", "en haut": "在上面；在楼上", "falloir": "需要（il faut 需要）",
    "feu d'artifice": "烟花", "férié": "节假日的（jours fériés 法定假日）", "février": "二月（冬季）",
    "fête": "节日；节庆", "galette": "饼（galette des Rois 国王饼）", "heure": "小时；钟点（一个小时）",
    "hiver": "冬天", "huit": "八", "janvier": "一月（冬季）", "jeudi": "星期四", "jour": "天；日子",
    "juillet": "七月（夏季）", "juin": "六月（夏季）", "lundi": "星期一", "mai": "五月（春季）", "mardi": "星期二",
    "mars": "三月（春季）", "mercredi": "星期三", "midi": "中午十二点；中午", "militaire": "军事的；军人的",
    "minuit": "午夜（零点）", "mois": "月；月份", "muguet": "铃兰（五一赠送的花）", "novembre": "十一月（秋季）",
    "octobre": "十月（秋季）", "offrir": "赠送；送", "ouvrable": "工作日的（jours ouvrables 工作日）",
    "pendule": "座钟", "pressé": "赶时间的；匆忙的", "printemps": "春天", "Pâques": "复活节",
    "quart": "四分之一（un quart d'heure 一刻钟）", "quatorze": "十四", "rendez-vous": "约会",
    "retard": "迟到；晚点（en retard 迟到）", "roi": "国王", "saison": "季节", "samedi": "星期六",
    "sapin": "冷杉（sapin de Noël 圣诞树）", "semaine": "星期；周", "septembre": "九月（秋季）",
    "tradition": "传统", "trois": "三（trois quarts 四分之三）", "tôt": "早；早点", "vendredi": "星期五",
    "été": "夏天",
}

# pos fixes for rows whose CSV pos is 待核实 or conflicts with the page evidence (row-level only)
POS_OVERRIDE = {
    "comme": "adv.",      # p.74 «Ça va, comme ça ?» (adverb of manner)
    "tout": "pron.",      # p.74 «C'est tout, merci!»
    "trois": "adj.",      # p.82 «trois quarts d'heure» (numeral)
    "ceci": "pron.",      # p.74
    "quoi": "pron.",      # p.78
    "goûter": "n.m.",     # p.78
    "minuit": "n.m.",     # p.82 (le minuit); lexicon entry pos fixed beforehand
}

# ------------------------------------------------------------------ examples: lemma → (fr, zh)
EX = {
    # 13 (p.72 image transcript / p.74 OCR)
    "achat": ("Quand il a fait ses achats,", "他买完东西后，"),
    "barquette": ("une barquette de fraises", "一盒草莓"),
    "biscuit": ("un paquet de biscuits", "一包饼干"),
    "bon marché": ("Le kilo de cerises à 7 €, c'est un peu cher! ( = bon marché)", "一公斤樱桃 7 欧，有点贵！（＝便宜）"),
    "bouteille": ("une bouteille d'huile", "一瓶油"),
    "caisse": ("il va à la caisse pour payer.", "他去收银台付款。"),
    "ceci": ("Et avec ceci ?", "还要别的吗？"),
    "chariot": ("À l'entrée du magasin, le client prend un chariot ou un panier.", "顾客在商店入口拿一辆购物车或一个篮子。"),
    "client": ("À l'entrée du magasin, le client prend un chariot ou un panier.", "顾客在商店入口拿一辆购物车或一个篮子。"),
    "panier": ("À l'entrée du magasin, le client prend un chariot ou un panier.", "顾客在商店入口拿一辆购物车或一个篮子。"),
    "comme": ("Ça va, comme ça ?", "这样可以吗？"),
    "commenter": ("Le kilo de cerises à 7 €, c'est un peu cher!", "一公斤樱桃 7 欧，有点贵！"),
    "demi-litre": ("un demi-litre d'... huile", "半升油。"),
    "demi-livre": ("une demi-livre (= 250 grammes) de... beurre", "250 克黄油。"),
    "devoir": ("Je vous dois combien?", "我欠您多少钱？"),
    "dizaine": ("une dizaine (= environ 10) de... pommes", "大约十个苹果。"),
    "domicile": ("une livraison à domicile:", "上门送货。"),
    "douzaine": ("une douzaine d'œufs", "一打鸡蛋。"),
    "gramme": ("un kilo (= 1 000 grammes) de... carottes", "一公斤（1000 克）胡萝卜。"),
    "halle": ("à l'extérieur ou sous une halle.", "在户外或有顶的市场大厅里。"),
    "liste": ("On a la liste des courses à la main.", "我们手里拿着购物清单。"),
    "litre": ("un litre de... lait", "一升牛奶。"),
    "livraison": ("une livraison à domicile", "上门送货。"),
    "livre": ("une livre (= 500 grammes) de... haricots verts", "半公斤（500 克）四季豆。"),
    "livrer": ("pour lui livrer (= apporter) ses achats.", "把购物品送到他家（＝带来）。"),
    "marché": ("un joli marché,", "一个漂亮的集市。"),
    "moitié": ("la moitié (= ½) de... la tarte", "半个（馅饼）。"),
    "petits pois": ("une boîte de petits pois", "一盒豌豆。"),
    "prix": ("Quel est le prix de...?", "……的价格是多少？"),
    "rayon": ("le rayon boucherie,", "肉类柜台。"),
    "surface": ("DANS UNE GRANDE SURFACE", "大型商店（超市）。"),
    "tablette": ("une tablette de chocolat", "一块巧克力。"),
    "tout": ("C'est tout, merci!", "就这些，谢谢！"),
    "tube": ("un tube de mayonnaise", "一管蛋黄酱。"),
    "épais": ("une tranche de jambon (fine ≠ épaisse)", "一片火腿（薄片≠厚片）。"),
    "•miel": ("un pot de miel", "一罐蜂蜜。"),
    # 14 (p.76 OCR / p.78 image transcript)
    "addition": ("Un café et l'addition, s'il vous plaît !", "一杯咖啡，再结账，谢谢！"),
    "blanquette": ("blanquette de veau", "白汁小牛肉。"),
    "boire": ("quand on a soif, on boit un verre d'eau, de vin...", "渴了就喝一杯水、葡萄酒……"),
    "bol": ("un bol de café, de lait", "一大碗咖啡或牛奶。"),
    "bourguignon": ("bœuf bourguignon", "勃艮第牛肉。"),
    "brouillé": ("œufs brouillés aux truffes", "松露炒蛋。"),
    "brûlé": ("Comme dessert, je vais prendre la crème brûlée.", "甜点我要焦糖布丁。"),
    "béarnais": ("entrecôte sauce béarnaise", "贝亚恩酱肋骨牛排。"),
    "carafe": ("une carafe d'eau", "一壶水。"),
    "chef": ("il est chef dans un restaurant.", "他是餐厅的主厨。"),
    "choisir": ("Monsieur, vous avez choisi ?", "先生，您点好了吗？"),
    "dessert": ("un fromage ou un dessert.", "……或一道甜点。"),
    "délicieux": ("C'est délicieux !", "这太美味了！"),
    "faim": ("Quand on a faim, on mange", "饿了就吃。"),
    "flambé": ("tarte aux pommes flambée", "火焰苹果挞。"),
    "gourmand": ("salade gourmande", "美食沙拉。"),
    "goûter": ("c'est l'heure du goûter", "下午茶的时间。"),
    "lapin": ("lapin aux pruneaux", "西梅兔肉。"),
    "livre": ("un livre de cuisine", "一本烹饪书。"),
    "lorraine": ("quiche lorraine", "洛林咸派。"),
    "manger": ("Quand on a faim, on mange", "饿了就吃。"),
    "menu": ("un menu à 28 €", "28 欧元的套餐。"),
    "moule": ("un moule à tarte", "派模。"),
    "passoire": ("la passoire à thé", "茶滤网。"),
    "plateau": ("plateau de fromages", "奶酪拼盘。"),
    "principal": ("un plat principal", "主菜。"),
    "pruneau": ("lapin aux pruneaux", "西梅兔肉。"),
    "quiche": ("quiche lorraine", "洛林咸派。"),
    "quoi": ("C'est quoi*, la salade gourmande ?", "这是什么？美食沙拉是什么？"),
    "recette": ("Il cherche une recette dans un livre de cuisine.", "他在烹饪书里找菜谱。"),
    "repas": ("trois repas", "三餐。"),
    "restaurant": ("Un repas au restaurant est généralement composé d'une entrée", "在餐厅用餐通常包括一道前菜……"),
    "serveur": ("Le serveur : Monsieur, vous avez choisi ?", "服务员：先生，您点好了吗？"),
    "soif": ("quand on a soif, on boit un verre d'eau, de vin...", "渴了就喝一杯水、葡萄酒……"),
    "soufflé": ("soufflé au crabe", "蟹肉舒芙蕾。"),
    "soupe": ("soupe à l'oignon", "洋葱汤。"),
    "truffe": ("œufs brouillés aux truffes", "松露炒蛋。"),
    "verre": ("un verre d'eau", "一杯水。"),
    # 15 (p.80 / p.82 / p.84 OCR)
    "août": ("juin, juillet, août.", "六月、七月、八月。"),
    "automne": ("septembre, octobre, novembre.", "九月、十月、十一月。"),
    "avance": ("à 18 h 45, il est en avance.", "18 点 45 分，他提前到了。"),
    "avril": ("mars, avril, mai.", "三月、四月、五月。"),
    "bal": ("un feu d'artifice et un bal.", "烟花和舞会。"),
    "cadeau": ("on offre des cadeaux.", "送礼物。"),
    "demi-heure": ("une demi-heure (= 30 minutes)...", "半小时（＝30 分钟）……"),
    "dimanche": ("le week-end: samedi, dimanche.", "周末：周六、周日。"),
    "décembre": ("décembre, janvier, février.", "十二月、一月、二月。"),
    "défilé": ("il y a un défilé militaire,", "有一场军事游行。"),
    "emploi": ("L'emploi du temps: J'ai un rendez-vous mardi matin", "日程安排：周二上午我有个约会。"),
    "falloir": ("ça prend du temps = il faut", "……需要时间（＝需要）。"),
    "feu d'artifice": ("un feu d'artifice et un bal.", "烟花和舞会。"),
    "férié": ("Il y a beaucoup de jours fériés, en France", "法国有很多法定假日。"),
    "février": ("décembre, janvier, février.", "十二月、一月、二月。"),
    "fête": ("Le 14 juillet (la fête nationale)", "7 月 14 日（国庆节）。"),
    "galette": ("la galette des Rois", "国王饼。"),
    "heure": ("En été, il fait jour à 6 heures;", "夏天 6 点天就亮了。"),
    "hiver": ("en hiver, il fait nuit à 17 heures.", "冬天 17 点天就黑了。"),
    "huit": ("Il prend huit jours de vacances.", "他休八天假。"),
    "janvier": ("décembre, janvier, février.", "十二月、一月、二月。"),
    "jeudi": ("lundi, mardi, mercredi, jeudi, vendredi", "周一到周五是工作日。"),
    "jour": ("Il prend huit jours de vacances.", "他休八天假。"),
    "juillet": ("juin, juillet, août.", "六月、七月、八月。"),
    "juin": ("juin, juillet, août.", "六月、七月、八月。"),
    "lundi": ("lundi, mardi, mercredi, jeudi, vendredi", "周一到周五是工作日。"),
    "mai": ("Nous sommes samedi 29 mai 2010 (= 29/05/10)", "今天是 2010 年 5 月 29 日，星期六。"),
    "mardi": ("J'ai un rendez-vous mardi matin", "我周二上午有个约会。"),
    "mars": ("mars, avril, mai.", "三月、四月、五月。"),
    "mercredi": ("Nous sommes mercredi.", "今天是星期三。"),
    "midi": ("il est midi et demi.", "现在是十二点半。"),
    "militaire": ("il y a un défilé militaire,", "有一场军事游行。"),
    "muguet": ("on offre une fleur (du muguet).", "送一朵铃兰。"),
    "novembre": ("septembre, octobre, novembre.", "九月、十月、十一月。"),
    "octobre": ("Nous sommes le 31 octobre", "今天是 10 月 31 日。"),
    "offrir": ("on offre des œufs en chocolat", "送巧克力蛋。"),
    "pendule": ("une pendule", "座钟。"),
    "pressé": ("je suis pressé, j'ai un rendez-vous!", "我赶时间，我有个约会！"),
    "printemps": ("le printemps:", "春季："),
    "Pâques": ("À Pâques, on offre des œufs en chocolat;", "复活节时，人们送巧克力蛋。"),
    "quart": ("un quart d'heure (= 15 minutes)...", "一刻钟（＝15 分钟）……"),
    "quatorze": ("quatorze (14) jours dans deux semaines,", "两周有十四天。"),
    "rendez-vous": ("Benjamin a rendez-vous avec Virginie à 19 heures:", "Benjamin 19 点和 Virginie 有约。"),
    "retard": ("à 19 h 15, il est en retard.", "19 点 15 分，他迟到了。"),
    "roi": ("Le jour des Rois (le 6 janvier)", "国王节（1 月 6 日）。"),
    "samedi": ("je dîne avec Joël samedi soir.", "周六晚上我和 Joël 吃晚饭。"),
    "sapin": ("à Noël, on a un sapin de Noël", "圣诞节时，我们有一棵圣诞树。"),
    "semaine": ("Il y a sept (7) jours dans une semaine,", "一周有七天。"),
    "septembre": ("septembre, octobre, novembre.", "九月、十月、十一月。"),
    "trois": ("trois quarts d'heure (= 45 minutes)...", "四分之三小时（＝45 分钟）……"),
    "tôt": ("Ce matin, Véronique est partie tôt de chez elle,", "今天早上，Véronique 很早就离开了家。"),
    "vendredi": ("je ne travaille pas vendredi après-midi", "我周五下午不工作。"),
    "été": ("juin, juillet, août.", "六月、七月、八月。"),
}

# ------------------------------------------------------------------ taught words missing from the bulk CSV
# lemma, pos, zh, example(fr, zh) or None, printed page, chapter
EXTRA = [
    # 13 — p.72 / p.74
    ("kilo", "n.m.", "公斤（1 千克）", ("un kilo (= 1 000 grammes) de... carottes", "一公斤胡萝卜。"), 72, L13),
    ("cher", "adj.", "贵的；昂贵的", ("c'est un peu cher!", "有点贵！"), 74, L13),
    ("cantal", "n.m.", "坎塔尔奶酪（法国奶酪）", ("un beau morceau de cantal", "一大块坎塔尔奶酪。"), 74, L13),
    ("frais", "adj.", "新鲜的", ("On peut y acheter des produits frais.", "在那里可以买到新鲜的产品。"), 74, L13),
    ("rouge", "adj.", "红色的", ("deux poivrons rouges", "两个红甜椒。"), 74, L13),
    ("joli", "adj.", "漂亮的", ("un joli marché", "一个漂亮的集市。"), 74, L13),
    ("magasin", "n.m.", "商店", ("À l'entrée du magasin", "在商店入口。"), 74, L13),
    ("employé", "n.m.", "职员；雇员", ("un employé du supermarché", "一名超市职员。"), 74, L13),
    ("extérieur", "n.m.", "外面；户外", ("à l'extérieur", "在户外。"), 74, L13),
    ("botte", "n.f.", "一把；一束（botte de radis 一把萝卜）", ("une botte de radis", "一把萝卜。"), 72, L13),
    ("pot", "n.m.", "罐；一罐（pot de miel 一罐蜂蜜）", ("un pot de miel", "一罐蜂蜜。"), 72, L13),
    ("grand", "adj.", "大的（grand supermarché 大超市）", ("DANS UN GRAND SUPERMARCHÉ", "在一家大超市里。"), 74, L13),
    # 14 — p.76 / p.78
    ("entrée", "n.f.", "前菜；头盘", ("composé d'une entrée", "由一道前菜组成。"), 78, L14),
    ("plat", "n.m.", "菜；一道菜", ("un plat principal", "主菜。"), 78, L14),
    ("cuisine", "n.f.", "烹饪；厨房；菜肴", ("Pierre aime faire la cuisine", "Pierre 喜欢做饭。"), 76, L14),
    ("cuisinier", "n.m.", "厨师", ("c'est un très bon cuisinier.", "他是一位非常好的厨师。"), 76, L14),
    ("table", "n.f.", "桌子；餐桌（mettre la table 摆桌）", ("Avant de manger, Isabelle met la table.", "吃饭前，Isabelle 摆好餐桌。"), 76, L14),
    ("petit déjeuner", "n.m.", "早餐", ("le petit déjeuner", "早餐。"), 78, L14),
    ("déjeuner", "n.m.", "午餐", ("« le déjeuner »", "午餐。"), 78, L14),
    ("dîner", "n.m.", "晚餐", ("« le dîner »", "晚餐。"), 78, L14),
    ("serviette", "n.f.", "餐巾；毛巾", ("une serviette", "一条餐巾。"), 76, L14),
    ("foie gras", "n.m.", "鹅肝；鸭肝", ("du foie gras", "鹅肝。"), 78, L14),
    ("bon appétit", "interj.", "祝您胃口好", ("BON APPÉTIT!", "祝您胃口好！"), 78, L14),
    ("demi-bouteille", "n.f.", "半瓶（容量）", ("Une demi-bouteille de côtes-du-rhône rouge", "一小瓶罗讷河谷红葡萄酒。"), 78, L14),
    # 15 — p.80 / p.82 / p.84
    ("minute", "n.f.", "分钟", ("un quart d'heure (= 15 minutes)", "一刻钟（＝15 分钟）。"), 82, L15),
    ("an", "n.m.", "年（jour de l'An 元旦）", ("le jour de l'An", "元旦。"), 84, L15),
    ("soirée", "n.f.", "晚上；晚会", ("toute la soirée", "整个晚上。"), 82, L15),
    ("journée", "n.f.", "白天；一天", ("toute la journée", "整天。"), 82, L15),
    ("année", "n.f.", "年；一年", ("la bonne année", "新年快乐（祝您新年好）。"), 84, L15),
    ("montre", "n.f.", "手表", ("une montre", "一块手表。"), 82, L15),
    ("train", "n.m.", "火车", ("Le train part à 14h47.", "火车 14 点 47 分出发。"), 82, L15),
    ("avion", "n.m.", "飞机", ("Mon avion arrive à 20 h 25.", "我的飞机 20 点 25 分到达。"), 82, L15),
    ("vacances", "n.f.", "假期（复数，les vacances）", ("Il prend huit jours de vacances.", "他休八天假。"), 80, L15),
    ("voiture", "n.f.", "汽车", ("dix heures en voiture", "坐十个小时车。"), 84, L15),
    ("nuit", "n.f.", "夜晚", ("en hiver, il fait nuit à 17 heures.", "冬天 17 点天就黑了。"), 80, L15),
    ("après-midi", "n.m.", "下午", ("vendredi après-midi", "周五下午。"), 80, L15),
    ("fleur", "n.f.", "花", ("on offre une fleur (du muguet).", "送一朵铃兰。"), 84, L15),
    ("Noël", "n.m.", "圣诞节", ("à Noël, on a un sapin de Noël", "圣诞节时，我们有一棵圣诞树。"), 84, L15),
    ("week-end", "n.m.", "周末", ("le week-end: samedi, dimanche.", "周末：周六、周日。"), 80, L15),
    ("dix", "adj.", "十", ("dix heures en voiture", "坐十个小时车。"), 84, L15),
    ("sept", "adj.", "七", ("Il y a sept (7) jours dans une semaine,", "一周有七天。"), 80, L15),
    ("quinze", "adj.", "十五", ("Elle revient dans quinze jours.", "她两周后回来。"), 80, L15),
    ("carte", "n.f.", "卡片；明信片（carte de vœux 贺卡）", ("on envoie des cartes de vœux", "人们寄送新年贺卡。"), 84, L15),
    # 12 — occupations taught on p.66 / p.68 / p.70 (missing from CSV)
    ("boulanger", "n.m.", "面包师", ("on va chez le boulanger", "去面包师那里（买面包）。"), 70, L12),
    ("boucher", "n.m.", "屠夫；肉商", ("On achète la viande chez le boucher", "肉在屠夫那里买。"), 66, L12),
    ("pâtissier", "n.m.", "糕点师", ("on va chez le pâtissier", "去糕点师那里（买蛋糕）。"), 70, L12),
    ("fromager", "n.m.", "奶酪商", ("On achète du bon fromage chez un fromager", "好的奶酪在奶酪商那里买。"), 68, L12),
    ("poissonnier", "n.m.", "鱼贩", ("On achète le poisson et les fruits de mer chez le poissonnier", "鱼和海鲜在鱼贩那里买。"), 66, L12),
    ("charcutier", "n.m.", "熟食商", ("on va chez le charcutier", "去熟食商那里。"), 66, L12),
]

# ------------------------------------------------------------------ helpers
def norm(s):
    s = re.sub(r"===[^\n]*===", " ", s)
    s = s.replace("•", " ")
    return re.sub(r"\s+", " ", s)

def corpus():
    ocr = json.load(open(OCR, encoding="utf-8"))
    pages = [p for p in ocr if 66 <= p["pdf_page"] <= 84]
    txt = "\n".join(p["text"] for p in pages) + "\n" + open(TRANSCRIPT, encoding="utf-8").read()
    return norm(txt)

def main():
    cp = corpus()
    rows = list(csv.DictReader(open(SRC, encoding="utf-8")))
    sel = [r for r in rows if r["chapter"] in (L13, L14, L15)]
    assert len(sel) == 153, len(sel)
    template = {"13": next(r for r in sel if r["lemma"] == "achat"),
                "14": next(r for r in sel if r["lemma"] == "addition"),
                "15": next(r for r in sel if r["lemma"] == "août"),
                "12": next(r for r in rows if r["chapter"].startswith("LES PRODUITS") and r["lemma"] == "fruit")}
    problems, log = [], []
    missing_zh = [r["lemma"] for r in sel if r["lemma"] not in ZH]
    if missing_zh:
        problems.append(f"no zh for: {missing_zh}")
    keys = {r["lemma"] for r in sel}
    for k in EX:
        if k not in keys:
            problems.append(f"example key not in CSV rows: {k}")
    ex_checked = ex_fail = 0
    for k, (fr, _) in list(EX.items()) + [(e[0], e[3]) for e in []]:
        pass
    for k, (fr, zh) in EX.items():
        ex_checked += 1
        if norm(fr) not in cp:
            ex_fail += 1
            problems.append(f"example not verbatim: {k} → {fr}")
    for e in EXTRA:
        if e[3]:
            ex_checked += 1
            if norm(e[3][0]) not in cp:
                ex_fail += 1
                problems.append(f"extra example not verbatim: {e[0]} → {e[3][0]}")

    out = []
    for r in sel:
        nr = dict(r)
        nr["zh"] = ZH.get(r["lemma"], "")
        if r["lemma"] in POS_OVERRIDE:
            nr["pos"] = POS_OVERRIDE[r["lemma"]]
        if r["lemma"] == "•miel":
            nr["lemma"] = "miel"
        nr["zh_origin"], nr["zh_status"] = "supplement", "补充翻译·待核对"
        if r["lemma"] in EX:
            fr, zhx = EX[r["lemma"]]
            nr["example_fr"], nr["example_zh"] = fr, zhx + "（补充翻译·待核对）"
            nr["note"] = "例句：教材原页（OCR 或图像转写）逐字可见（已核对）；释义为补充翻译·待核对"
        else:
            nr["note"] = "教材正文为词汇列表或图示，无独立例句；释义为补充翻译·待核对"
        if r["lemma"] == "épais":
            nr["note"] += "；图注「fine ≠ épaisse」"
        out.append(nr)
    for lemma, pos, zh, ex, page, chapter in EXTRA:
        t = dict(template[{L13: "13", L14: "14", L15: "15", L12: "12"}[chapter]])
        t.update({"lemma": lemma, "pos": pos, "zh": zh, "zh_origin": "supplement",
                  "zh_status": "补充翻译·待核对", "fr_def": "", "example_fr": "", "example_zh": "",
                  "col": "", "fam": "", "syn": "", "ant": "", "tip": "",
                  "note": f"教材明确教授但批量 CSV 遗漏（第 {page} 页）；释义为补充翻译·待核对",
                  "origin": "book", "kind": "lesson", "chapter": chapter,
                  "printed_page": str(page), "pdf_page": str(page), "review": "unreviewed"})
        if ex:
            t["example_fr"], t["example_zh"] = ex[0], ex[1] + "（补充翻译·待核对）"
        out.append(t)

    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0].keys()))
        w.writeheader(); w.writerows(out)
    n_zh = sum(1 for r in out if r["zh"])
    n_ex = sum(1 for r in out if r["example_fr"])
    log += [f"bulk_rows={len(sel)} extra_rows={len(EXTRA)} total={len(out)}",
            f"zh_filled={n_zh}/{len(out)} examples={n_ex} examples_checked={ex_checked} verbatim_fail={ex_fail}",
            f"problems={len(problems)}"] + problems
    open(LOG, "w", encoding="utf-8").write("\n".join(log) + "\n")
    print(f"total={len(out)} zh={n_zh}/{len(out)} examples={n_ex} verbatim_fail={ex_fail} problems={len(problems)}")
    print(f"fill_csv={os.path.relpath(OUT, ROOT)} log={os.path.relpath(LOG, ROOT)}")
    return 1 if problems else 0

if __name__ == "__main__":
    sys.exit(main())
