#!/usr/bin/env python3
"""Débutant lessons 20 (LA POSTE – LES SERVICES – L'ADMINISTRATION, pp.104–107) and
21 (LA GÉOGRAPHIE – LA FRANCOPHONIE, pp.108–115).

Output: data/imports/debutant-lesson20-21-fill.csv
Lemmas are resolved to the exact lexicon lemma (accents, case) when an entry with the same folded lemma and
pos exists, so that the importer merges instead of creating duplicates. Otherwise the lemma is taken as printed.
Check : every example_fr must appear (normalised) in OCR of pp.104–114 or the image transcript.
Log   : output/lesson20-21/fill.log
"""
import csv, json, os, re, sys, unicodedata

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SRC = os.path.join(ROOT, "data/imports/debutant-lesson11-15-bulk.csv")
OUT = os.path.join(ROOT, "data/imports/debutant-lesson20-21-fill.csv")
LOG = os.path.join(ROOT, "output/lesson20-21/fill.log")
LEX = os.path.join(ROOT, "data/lexicon.json")
OCR = os.path.join(ROOT, "references/extracted/debutant_ocr.json")
TRANSCRIPT = os.path.join(ROOT, "data/lessons/lesson13-15-image-transcript.txt")

L20 = "LA POSTE - LES SERVICES - L'ADMINISTRATION（第 20 课）"
L21 = "LA GÉOGRAPHIE - LA FRANCOPHONIE（第 21 课）"

def fold(s):
    s = unicodedata.normalize("NFD", s); s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.lower().replace("'", "").replace("-", " ").strip()

LEXL = [e for e in json.load(open(LEX, encoding="utf-8"))["entries"] if not e.get("aliasOf")]
def resolve(word, pos):
    """exact lexicon lemma for the same folded word and pos; otherwise the printed word."""
    for e in LEXL:
        if fold(e["lemma"]) == fold(word) and e["pos"] == pos:
            return e["lemma"]
    return word

# (word, pos, zh, example_fr, example_zh, printed_page, chapter, topic)
R = [
    # ---------------- Lesson 20 — p.104 (La poste), p.106 (Les secours, La mairie, Impôts, Sécurité sociale)
    ("poste", "n.f.", "邮局（la poste）", "La poste a aussi un service bancaire.", "邮局也提供银行服务。", 104, L20, "society"),
    ("paquet", "n.m.", "包裹；小包", "je voudrais envoyer un paquet au Maroc", "我想寄一个包裹到摩洛哥。", 104, L20, "society"),
    ("prioritaire", "adj.", "优先的（en prioritaire 优先件）", "Prioritaire, s'il vous plaît.", "请寄优先件。", 104, L20, "society"),
    ("économique", "adj.", "经济的；普通的（en économique 普通件）", "en prioritaire ou en économique ?", "寄优先件还是普通件？", 104, L20, "society"),
    ("timbre", "n.m.", "邮票", "un carnet de timbres (= 10 timbres)", "一本邮票册（＝10 枚邮票）。", 104, L20, "society"),
    ("carnet", "n.m.", "小本子；（邮票）小册", "un carnet de timbres (= 10 timbres)", "一本邮票册（＝10 枚邮票）。", 104, L20, "society"),
    ("facteur", "n.m.", "邮递员", "est-ce que le facteur est passé ?", "邮递员来过了吗？", 104, L20, "society"),
    ("courrier", "n.m.", "信件；邮件", "Oui, le courrier est passé.", "是的，信件送来了。", 104, L20, "society"),
    ("lettre", "n.f.", "信；信件", "Une lettre d'Annie", "一封 Annie 的信。", 104, L20, "society"),
    ("carte postale", "n.f.", "明信片", "une carte postale de Brigitte", "Brigitte 寄来的一张明信片。", 104, L20, "society"),
    ("colis", "n.m.", "包裹（大件）", "le colis (= le paquet) de ma mère", "我母亲的包裹（＝小包）。", 104, L20, "society"),
    ("tampon", "n.m.", "邮戳；印章", "le tampon de la poste", "邮局的邮戳。", 104, L20, "society"),
    ("expéditeur", "n.m.", "寄件人；发件人", "l'adresse de l'expéditeur", "寄件人的地址。", 104, L20, "society"),
    ("destinataire", "n.m.", "收件人", "l'adresse du destinataire", "收件人的地址。", 104, L20, "society"),
    ("adresse", "n.f.", "地址", "l'adresse du destinataire", "收件人的地址。", 104, L20, "society"),
    ("code postal", "n.m.", "邮政编码", "le code postal", "邮政编码。", 104, L20, "society"),
    ("anniversaire", "n.m.", "生日；周年", "C'est l'anniversaire de Lise", "今天是 Lise 的生日。", 104, L20, "society"),
    ("carte", "n.f.", "卡片；卡", "une petite carte", "一张小卡片。", 104, L20, "society"),
    ("poster", "v.", "寄（信）；投递", "Je dois la poster (= mettre dans la boîte aux lettres)", "我必须把它投进信箱（＝寄出）。", 104, L20, "society"),
    ("boîte aux lettres", "n.f.", "信箱", "mettre dans la boîte aux lettres", "投进信箱。", 104, L20, "society"),
    ("arriver", "v.", "到达；到", "elle arrivera trop tard", "它会太晚才到。", 104, L20, "society"),
    ("sinon", "conj.", "否则；不然", "sinon elle arrivera trop tard", "否则它会太晚到。", 104, L20, "society"),
    ("annuaire", "n.m.", "电话簿；名录", "Je peux consulter l'annuaire", "我可以查电话簿。", 104, L20, "society"),
    ("pages jaunes", "n.f.", "黄页（商业电话号码簿）", "le site Internet des Pages jaunes", "黄页的网站。", 104, L20, "society"),
    ("numéro", "n.m.", "号码（numéro de téléphone 电话号码）", "le numéro de téléphone", "电话号码。", 106, L20, "society"),
    ("service", "n.m.", "服务；部门", "La poste a aussi un service bancaire.", "邮局也提供银行服务。", 104, L20, "society"),
    ("bancaire", "adj.", "银行的", "La poste a aussi un service bancaire.", "邮局也提供银行服务。", 104, L20, "society"),
    ("bureau de tabac", "n.m.", "烟草店（兼售邮票、车票等）", "Dans un bureau de tabac à Paris", "在巴黎的一家烟草店。", 104, L20, "society"),
    ("papeterie", "n.f.", "文具店", "une papeterie ou un supermarché", "一家文具店或超市。", 104, L20, "society"),
    ("enveloppe", "n.f.", "信封", "acheter des enveloppes", "买信封。", 104, L20, "society"),
    ("secours", "n.m.", "救援；急救（les secours 救援人员）", "", "", 106, L20, "society"),
    ("pompier", "n.m.", "消防员", "on appelle les pompiers (numéro de téléphone : 18)", "人们叫消防员（电话 18）。", 106, L20, "society"),
    ("feu", "n.m.", "火；火灾", "S'il y a un feu", "如果有火灾。", 106, L20, "society"),
    ("accident", "n.m.", "事故（accident de la route 交通事故）", "un accident de la route", "一起交通事故。", 106, L20, "society"),
    ("route", "n.f.", "公路；道路", "un accident de la route", "一起交通事故。", 106, L20, "society"),
    ("SAMU", "n.m.", "紧急医疗救护（SAMU）", "le SAMU, le service médical d'urgence", "SAMU，即紧急医疗服务。", 106, L20, "society"),
    ("urgence", "n.f.", "紧急（情况）；急诊", "le service médical d'urgence", "紧急医疗服务。", 106, L20, "society"),
    ("médical", "adj.", "医疗的；医学的", "un grave problème médical", "一个严重的医疗问题。", 106, L20, "society"),
    ("grave", "adj.", "严重的", "un grave problème médical", "一个严重的医疗问题。", 106, L20, "society"),
    ("problème", "n.m.", "问题", "un grave problème médical", "一个严重的医疗问题。", 106, L20, "society"),
    ("sécurité", "n.f.", "安全；治安", "Pour les problèmes de sécurité", "关于安全问题。", 106, L20, "society"),
    ("danger", "n.m.", "危险", "si on est en danger", "如果处于危险之中。", 106, L20, "society"),
    ("police", "n.f.", "警察；警方", "on appelle la police (le 17)", "人们叫警察（电话 17）。", 106, L20, "society"),
    ("voler", "v.", "偷；抢", "Pierre s'est fait voler son portefeuille.", "Pierre 的钱包被偷了。", 106, L20, "society"),
    ("voleur", "n.", "小偷；贼", "Le voleur s'est enfui", "小偷逃跑了。", 106, L20, "society"),
    ("victime", "n.f.", "受害者（阴性名词）", "Paul est une victime.", "Paul 是受害者。", 106, L20, "society"),
    ("commissariat", "n.m.", "警察局（commissariat de police）", "au commissariat de police", "去警察局。", 106, L20, "society"),
    ("déposition", "n.f.", "陈述；录口供（faire une déposition 做陈述）", "pour faire une déposition (= pour déclarer le vol)", "为了做陈述（＝为了报告失窃）。", 106, L20, "society"),
    ("déclarer", "v.", "申报；报告", "pour déclarer le vol", "报告失窃。", 106, L20, "society"),
    ("vol", "n.m.", "偷窃；失窃", "pour déclarer le vol", "报告失窃。", 106, L20, "society"),
    ("mairie", "n.f.", "市政厅；镇政府", "On va à la mairie pour déclarer une naissance", "人们去市政厅申报出生。", 106, L20, "society"),
    ("naissance", "n.f.", "出生", "déclarer une naissance (un bébé)", "申报一个出生（一个婴儿）。", 106, L20, "society"),
    ("bébé", "n.m.", "婴儿", "déclarer une naissance (un bébé)", "申报一个出生（一个婴儿）。", 106, L20, "society"),
    ("décès", "n.m.", "死亡", "un décès (†)", "一例死亡（†）。", 106, L20, "society"),
    ("marier", "v.", "结婚（se marier 结婚）", "pour se marier", "为了结婚。", 106, L20, "society"),
    ("renseignement", "n.m.", "信息；咨询（obtenir des renseignements 获取信息）", "obtenir des renseignements", "获取信息。", 106, L20, "society"),
    ("obtenir", "v.", "获得；取得", "obtenir des renseignements", "获取信息。", 106, L20, "society"),
    ("activité", "n.f.", "活动", "les activités sportives ou éducatives", "体育或教育活动。", 106, L20, "society"),
    ("sportif", "adj.", "体育的；爱运动的", "les activités sportives", "体育活动。", 106, L20, "society"),
    ("éducatif", "adj.", "教育的", "les activités sportives ou éducatives", "体育或教育活动。", 106, L20, "society"),
    ("aide", "n.f.", "帮助；补助（aide sociale 社会救助）", "sur les aides sociales", "关于社会救助。", 106, L20, "society"),
    ("social", "adj.", "社会的", "sur les aides sociales", "关于社会救助。", 106, L20, "society"),
    ("guichet", "n.m.", "窗口；柜台", "On doit trouver le bon guichet", "必须找到正确的窗口。", 106, L20, "society"),
    ("queue", "n.f.", "队伍（faire la queue 排队）", "faire la queue", "排队。", 106, L20, "society"),
    ("nécessaire", "adj.", "必要的", "les papiers nécessaires", "必要的文件。", 106, L20, "society"),
    ("photocopie", "n.f.", "复印件（faire des photocopies 复印）", "faire des photocopies de certains documents", "复印某些文件。", 106, L20, "society"),
    ("dossier", "n.m.", "档案；文件夹", "L'ensemble des documents constitue un dossier.", "全部文件构成一份档案。", 106, L20, "society"),
    ("impôt", "n.m.", "税（les impôts 税款）", "les impôts et les taxes", "税款和各种费用。", 106, L20, "society"),
    ("taxe", "n.f.", "税；费", "les impôts et les taxes", "税款和各种费用。", 106, L20, "society"),
    ("fisc", "n.m.", "税务局", "On doit payer au fisc les impôts", "人们必须向税务局交税。", 106, L20, "society"),
    ("déclaration", "n.f.", "申报（表）", "remplir une déclaration d'impôts sur le revenu", "填写所得税申报表。", 106, L20, "society"),
    ("revenu", "n.m.", "收入", "une déclaration d'impôts sur le revenu", "所得税申报表。", 106, L20, "society"),
    ("chaque", "adj.", "每一（个）", "Chaque année, en mars", "每年三月。", 106, L20, "society"),
    ("sécurité sociale", "n.f.", "社会保险；社会保障", "La Sécurité sociale rembourse les médicaments et les soins médicaux.", "社会保险报销药品和医疗护理费用。", 106, L20, "society"),
    ("rembourser", "v.", "报销；偿还", "La Sécurité sociale rembourse les médicaments", "社会保险报销药品。", 106, L20, "society"),
    ("médicament", "n.m.", "药；药品", "La Sécurité sociale rembourse les médicaments", "社会保险报销药品。", 106, L20, "society"),
    ("soin", "n.m.", "护理；治疗（soins médicaux 医疗护理）", "les soins médicaux", "医疗护理。", 106, L20, "society"),
    # ---------------- Lesson 21 — p.108 (La géographie), p.110 (Europe), p.112 (France), p.114 (DOM-COM, Francophonie)
    ("terre", "n.f.", "地球；陆地（la Terre 地球）", "", "", 108, L21, "society"),
    ("nord", "n.m.", "北；北方", "La Suède se trouve au nord de l'Europe.", "瑞典位于欧洲北部。", 108, L21, "society"),
    ("sud", "n.m.", "南；南方", "", "", 108, L21, "society"),
    ("est", "n.m.", "东；东方", "La Pologne se trouve à l'est de l'Europe.", "波兰位于欧洲东部。", 108, L21, "society"),
    ("ouest", "n.m.", "西；西方", "L'Occident (= l'Ouest) = l'Orient (= l'Est)", "西方（＝西面）＝东方（＝东面）。", 108, L21, "society"),
    ("océan", "n.m.", "大洋；海洋", "un océan (l'Atlantique, le Pacifique)", "一个大洋（大西洋、太平洋）。", 108, L21, "society"),
    ("mer", "n.f.", "海", "une mer (la Méditerranée)", "一个海（地中海）。", 108, L21, "society"),
    ("côte", "n.f.", "海岸；海滨", "", "", 108, L21, "society"),
    ("continent", "n.m.", "大陆；大洲", "", "", 108, L21, "society"),
    ("ciel", "n.m.", "天空", "", "", 108, L21, "society"),
    ("étoile", "n.f.", "星；星星", "", "", 108, L21, "society"),
    ("lune", "n.f.", "月亮", "", "", 108, L21, "society"),
    ("soleil", "n.m.", "太阳", "Il y a un beau coucher de soleil, ce soir.", "今晚的日落很美。", 108, L21, "society"),
    ("lever", "n.m.", "升起；日出（lever de soleil 日出）", "le lever de soleil", "日出。", 108, L21, "society"),
    ("coucher", "n.m.", "落下；日落（coucher de soleil 日落）", "Il y a un beau coucher de soleil, ce soir.", "今晚的日落很美。", 108, L21, "society"),
    ("Amérique", "n.f.", "美洲", "L'Amérique du Nord: les États-Unis, le Canada", "北美洲：美国、加拿大。", 108, L21, "society"),
    ("Océanie", "n.f.", "大洋洲", "L'Océanie : l'Australie, la Nouvelle-Zélande", "大洋洲：澳大利亚、新西兰。", 108, L21, "society"),
    ("Asie", "n.f.", "亚洲", "L'Asie : la Chine, le Japon, le Vietnam", "亚洲：中国、日本、越南。", 108, L21, "society"),
    ("Afrique", "n.f.", "非洲", "L'Afrique : le Maroc, l'Algérie", "非洲：摩洛哥、阿尔及利亚。", 108, L21, "society"),
    ("États-Unis", "n.m.", "美国（pl. les États-Unis）", "les États-Unis, le Canada", "美国、加拿大。", 108, L21, "society"),
    ("Canada", "n.m.", "加拿大", "les États-Unis, le Canada", "美国、加拿大。", 108, L21, "society"),
    ("américain", "adj.", "美国的；美国人", "« Mike est américain »", "“Mike 是美国人”。", 108, L21, "society"),
    ("canadien", "adj.", "加拿大的；加拿大人", "« Il est canadien, vénézuélien, bolivien... »", "“他是加拿大人、委内瑞拉人、玻利维亚人……”。", 108, L21, "society"),
    ("Europe", "n.f.", "欧洲", "La Suède se trouve au nord de l'Europe.", "瑞典位于欧洲北部。", 108, L21, "society"),
    # ---- Europe: countries, nationalities, languages (p.110 table)
    ("Allemagne", "n.f.", "德国", "", "", 110, L21, "society"),
    ("Autriche", "n.f.", "奥地利", "", "", 110, L21, "society"),
    ("Belgique", "n.f.", "比利时", "", "", 110, L21, "society"),
    ("Bulgarie", "n.f.", "保加利亚", "", "", 110, L21, "society"),
    ("Chypre", "n.f.", "塞浦路斯", "", "", 110, L21, "society"),
    ("Danemark", "n.m.", "丹麦", "", "", 110, L21, "society"),
    ("Espagne", "n.f.", "西班牙", "", "", 110, L21, "society"),
    ("Estonie", "n.f.", "爱沙尼亚", "", "", 110, L21, "society"),
    ("Finlande", "n.f.", "芬兰", "", "", 110, L21, "society"),
    ("France", "n.f.", "法国", "Jane habite en France, mais elle est étrangère, elle n'est pas française.", "Jane 住在法国，但她是外国人，不是法国人。", 110, L21, "society"),
    ("Grèce", "n.f.", "希腊", "", "", 110, L21, "society"),
    ("Hongrie", "n.f.", "匈牙利", "", "", 110, L21, "society"),
    ("Irlande", "n.f.", "爱尔兰", "", "", 110, L21, "society"),
    ("Italie", "n.f.", "意大利", "", "", 110, L21, "society"),
    ("Lettonie", "n.f.", "拉脱维亚", "", "", 110, L21, "society"),
    ("Lituanie", "n.f.", "立陶宛", "", "", 110, L21, "society"),
    ("Luxembourg", "n.m.", "卢森堡", "", "", 110, L21, "society"),
    ("Malte", "n.f.", "马耳他", "", "", 110, L21, "society"),
    ("Pays-Bas", "n.m.", "荷兰（复数，les Pays-Bas）", "", "", 110, L21, "society"),
    ("Pologne", "n.f.", "波兰", "La Pologne se trouve à l'est de l'Europe.", "波兰位于欧洲东部。", 108, L21, "society"),
    ("Portugal", "n.m.", "葡萄牙", "", "", 110, L21, "society"),
    ("République tchèque", "n.f.", "捷克共和国", "", "", 110, L21, "society"),
    ("Roumanie", "n.f.", "罗马尼亚", "", "", 110, L21, "society"),
    ("Royaume-Uni", "n.m.", "英国", "", "", 110, L21, "society"),
    ("Slovaquie", "n.f.", "斯洛伐克", "", "", 110, L21, "society"),
    ("Slovénie", "n.f.", "斯洛文尼亚", "", "", 110, L21, "society"),
    ("Suède", "n.f.", "瑞典", "La Suède se trouve au nord de l'Europe.", "瑞典位于欧洲北部。", 108, L21, "society"),
    ("allemand", "adj.", "德国的；德国人", "Hans est allemand", "Hans 是德国人。", 110, L21, "society"),
    ("autrichien", "adj.", "奥地利的；奥地利人", "Wolfgang est autrichien", "Wolfgang 是奥地利人。", 110, L21, "society"),
    ("belge", "adj.", "比利时的；比利时人", "Louis est belge", "Louis 是比利时人。", 110, L21, "society"),
    ("bulgare", "adj.", "保加利亚的；保加利亚人", "Tsvetan est bulgare", "Tsvetan 是保加利亚人。", 110, L21, "society"),
    ("chypriote", "adj.", "塞浦路斯的；塞浦路斯人", "Stelios est chypriote", "Stelios 是塞浦路斯人。", 110, L21, "society"),
    ("danois", "adj.", "丹麦的；丹麦人", "Jens est danois", "Jens 是丹麦人。", 110, L21, "society"),
    ("espagnol", "adj.", "西班牙的；西班牙人", "Juan est espagnol", "Juan 是西班牙人。", 110, L21, "society"),
    ("estonien", "adj.", "爱沙尼亚的；爱沙尼亚人", "Kalju est estonien", "Kalju 是爱沙尼亚人。", 110, L21, "society"),
    ("finlandais", "adj.", "芬兰的；芬兰人", "Markku est finlandais", "Markku 是芬兰人。", 110, L21, "society"),
    ("français", "adj.", "法国的；法国人", "Michel est français", "Michel 是法国人。", 110, L21, "society"),
    ("grec", "adj.", "希腊的；希腊人", "Iannis est grec", "Iannis 是希腊人。", 110, L21, "society"),
    ("hongrois", "adj.", "匈牙利的；匈牙利人", "Sándor est hongrois", "Sándor 是匈牙利人。", 110, L21, "society"),
    ("irlandais", "adj.", "爱尔兰的；爱尔兰人", "Brendan est irlandais", "Brendan 是爱尔兰人。", 110, L21, "society"),
    ("italien", "adj.", "意大利的；意大利人", "Giovanni est italien", "Giovanni 是意大利人。", 110, L21, "society"),
    ("letton", "adj.", "拉脱维亚的；拉脱维亚人", "Janis est letton", "Janis 是拉脱维亚人。", 110, L21, "society"),
    ("lituanien", "adj.", "立陶宛的；立陶宛人", "Mykolas est lituanien", "Mykolas 是立陶宛人。", 110, L21, "society"),
    ("luxembourgeois", "adj.", "卢森堡的；卢森堡人", "Pierre est luxembourgeois", "Pierre 是卢森堡人。", 110, L21, "society"),
    ("maltais", "adj.", "马耳他的；马耳他人", "Mario est maltais", "Mario 是马耳他人。", 110, L21, "society"),
    ("néerlandais", "adj.", "荷兰的；荷兰人", "Jan est néerlandais", "Jan 是荷兰人。", 110, L21, "society"),
    ("polonais", "adj.", "波兰的；波兰人", "Pawel est polonais", "Pawel 是波兰人。", 110, L21, "society"),
    ("portugais", "adj.", "葡萄牙的；葡萄牙人", "João est portugais", "João 是葡萄牙人。", 110, L21, "society"),
    ("tchèque", "adj.", "捷克的；捷克人", "Václav est tchèque", "Václav 是捷克人。", 110, L21, "society"),
    ("roumain", "adj.", "罗马尼亚的；罗马尼亚人", "Sergiu est roumain", "Sergiu 是罗马尼亚人。", 110, L21, "society"),
    ("britannique", "adj.", "英国的；英国人", "John est britannique", "John 是英国人。", 110, L21, "society"),
    ("slovaque", "adj.", "斯洛伐克的；斯洛伐克人", "Imrich est slovaque", "Imrich 是斯洛伐克人。", 110, L21, "society"),
    ("slovène", "adj.", "斯洛文尼亚的；斯洛文尼亚人", "Damir est slovène", "Damir 是斯洛文尼亚人。", 110, L21, "society"),
    ("suédois", "adj.", "瑞典的；瑞典人", "Bjorn est suédois", "Bjorn 是瑞典人。", 110, L21, "society"),
    ("finnois", "n.m.", "芬兰语", "il parle finnois.", "他说芬兰语。", 110, L21, "society"),
    ("néerlandais", "n.m.", "荷兰语", "il parle néerlandais.", "他说荷兰语。", 110, L21, "society"),
    ("bulgare", "n.m.", "保加利亚语", "il parle bulgare.", "他说保加利亚语。", 110, L21, "society"),
    ("grec", "n.m.", "希腊语", "il parle grec.", "他说希腊语。", 110, L21, "society"),
    ("danois", "n.m.", "丹麦语", "il parle danois.", "他说丹麦语。", 110, L21, "society"),
    ("espagnol", "n.m.", "西班牙语", "il parle espagnol.", "他说西班牙语。", 110, L21, "society"),
    ("estonien", "n.m.", "爱沙尼亚语", "il parle estonien.", "他说爱沙尼亚语。", 110, L21, "society"),
    ("hongrois", "n.m.", "匈牙利语", "il parle hongrois.", "他说匈牙利语。", 110, L21, "society"),
    ("italien", "n.m.", "意大利语", "il parle italien.", "他说意大利语。", 110, L21, "society"),
    ("letton", "n.m.", "拉脱维亚语", "il parle letton.", "他说拉脱维亚语。", 110, L21, "society"),
    ("lituanien", "n.m.", "立陶宛语", "il parle lituanien.", "他说立陶宛语。", 110, L21, "society"),
    ("maltais", "n.m.", "马耳他语", "il parle maltais et anglais.", "他说马耳他语和英语。", 110, L21, "society"),
    ("polonais", "n.m.", "波兰语", "il parle polonais.", "他说波兰语。", 110, L21, "society"),
    ("portugais", "n.m.", "葡萄牙语", "il parle portugais.", "他说葡萄牙语。", 110, L21, "society"),
    ("tchèque", "n.m.", "捷克语", "il parle tchèque.", "他说捷克语。", 110, L21, "society"),
    ("roumain", "n.m.", "罗马尼亚语", "il parle roumain.", "他说罗马尼亚语。", 110, L21, "society"),
    ("slovaque", "n.m.", "斯洛伐克语", "il parle slovaque.", "他说斯洛伐克语。", 110, L21, "society"),
    ("slovène", "n.m.", "斯洛文尼亚语", "il parle slovène.", "他说斯洛文尼亚语。", 110, L21, "society"),
    ("suédois", "n.m.", "瑞典语", "il parle suédois.", "他说瑞典语。", 110, L21, "society"),
    ("chinois", "n.m.", "汉语", "le danois, le portugais, le chinois", "丹麦语、葡萄牙语、汉语。", 110, L21, "society"),
    ("langue", "n.f.", "语言；语种", "Est-ce que vous parlez des langues étrangères ?", "您会说外语吗？", 110, L21, "society"),
    ("étranger", "adj.", "外国的；外国人（étrangère 阴性）", "Jane habite en France, mais elle est étrangère", "Jane 住在法国，但她是外国人。", 110, L21, "society"),
    ("journal", "n.m.", "报纸（journaux 复数）", "Est-ce que vous lisez des journaux étrangers ?", "您读外国报纸吗？", 110, L21, "society"),
    # ---- France (p.112) and DOM-COM, Francophonie (p.114)
    ("métropolitain", "adj.", "本土的（France métropolitaine 法国本土）", "On distingue la France métropolitaine et les DOM-COM", "区分法国本土和海外省、海外领地。", 112, L21, "society"),
    ("république", "n.f.", "共和国（république parlementaire 议会制共和国）", "La France est une république parlementaire.", "法国是议会制共和国。", 112, L21, "society"),
    ("parlementaire", "adj.", "议会的", "La France est une république parlementaire.", "法国是议会制共和国。", 112, L21, "society"),
    ("habitant", "n.m.", "居民；人口", "la France compte 65,4 millions d'habitants", "法国有 6540 万居民。", 112, L21, "society"),
    ("capitale", "n.f.", "首都", "Sa capitale est Paris.", "它的首都是巴黎。", 112, L21, "society"),
    ("frontière", "n.f.", "边界；国界", "La France a une frontière avec six pays", "法国与六个国家接壤。", 112, L21, "society"),
    ("montagne", "n.f.", "山；山脉（chaîne de montagnes 山脉）", "deux grandes chaînes de montagnes", "两大山脉。", 112, L21, "society"),
    ("chaîne", "n.f.", "山脉；链（chaîne de montagnes 山脉）", "deux grandes chaînes de montagnes", "两大山脉。", 112, L21, "society"),
    ("Alpes", "n.f.", "阿尔卑斯山脉", "les Alpes et les Pyrénées", "阿尔卑斯山脉和比利牛斯山脉。", 112, L21, "society"),
    ("Pyrénées", "n.f.", "比利牛斯山脉", "les Alpes et les Pyrénées", "阿尔卑斯山脉和比利牛斯山脉。", 112, L21, "society"),
    ("fleuve", "n.m.", "大河；河流", "six fleuves : la Seine, le Rhône, la Loire, la Garonne", "六条大河：塞纳河、罗讷河、卢瓦尔河、加龙河。", 112, L21, "society"),
    ("Seine", "n.f.", "塞纳河", "six fleuves : la Seine", "六条大河：塞纳河……", 112, L21, "society"),
    ("Rhône", "n.m.", "罗讷河", "six fleuves : la Seine, le Rhône", "六条大河：塞纳河、罗讷河……", 112, L21, "society"),
    ("Loire", "n.f.", "卢瓦尔河", "six fleuves : la Seine, le Rhône, la Loire", "六条大河：塞纳河、罗讷河、卢瓦尔河……", 112, L21, "society"),
    ("Garonne", "n.f.", "加龙河", "la Garonne", "加龙河。", 112, L21, "society"),
    ("Rhin", "n.m.", "莱茵河", "le Rhin et la Meuse", "莱茵河和默兹河。", 112, L21, "society"),
    ("Meuse", "n.f.", "默兹河", "le Rhin et la Meuse", "莱茵河和默兹河。", 112, L21, "society"),
    ("île", "n.f.", "岛；岛屿", "Elle comprend une grande île, la Corse.", "它包括一个大岛——科西嘉岛。", 112, L21, "society"),
    ("Corse", "n.f.", "科西嘉岛", "Elle comprend une grande île, la Corse.", "它包括一个大岛——科西嘉岛。", 112, L21, "society"),
    ("région", "n.f.", "大区（行政区划）", "divisée en régions (la Normandie, la Provence, l'Alsace, la Bretagne, etc.)", "划分为大区（诺曼底、普罗旺斯、阿尔萨斯、布列塔尼等）。", 112, L21, "society"),
    ("département", "n.m.", "省（行政区划）", "en départements, plus petits (la Dordogne, le Finistère, le Vaucluse....)", "划分为较小的省（多尔多涅、菲尼斯泰尔、沃克吕兹……）。", 112, L21, "society"),
    ("province", "n.f.", "外省（巴黎以外的地区）", "Adrienne habite dans une petite ville de province.", "Adrienne 住在外省的一个小城市。", 112, L21, "society"),
    ("provincial", "adj.", "外省的；外省人（provinciaux 复数）", "Ronan habite à Paris, mais il est d'origine provinciale", "Ronan 住在巴黎，但他出身外省。", 112, L21, "society"),
    ("parisien", "n.", "巴黎人（parisien/parisienne）", "Paris (et les Parisiens)", "巴黎（以及巴黎人）。", 112, L21, "society"),
    ("breton", "adj.", "布列塔尼的；布列塔尼人", "Ronan habite à Paris, mais il est d'origine provinciale, il est breton.", "Ronan 住在巴黎，但他出身外省，是布列塔尼人。", 112, L21, "society"),
    ("ville", "n.f.", "城市", "Adrienne habite dans une petite ville de province.", "Adrienne 住在外省的一个小城市。", 112, L21, "society"),
    ("plaque", "n.f.", "牌；（车）牌（plaque d'immatriculation 车牌）", "sur la plaque d'immatriculation des voitures", "在汽车的车牌上。", 112, L21, "society"),
    ("département d'outre-mer", "n.m.", "海外省（DOM）", "Les départements d'outre-Mer (les DOM) ont 1,9 million d'habitants.", "海外省有 190 万居民。", 114, L21, "society"),
    ("collectivité d'outre-mer", "n.f.", "海外领地（COM）", "Les collectivités d'outre-mer (les COM) ont 0,78 million d'habitants.", "海外领地有 78 万居民。", 114, L21, "society"),
    ("Antilles", "n.f.", "安的列斯群岛", "les Antilles françaises (les Antillais)", "法属安的列斯群岛（安的列斯人）。", 114, L21, "society"),
    ("Guadeloupe", "n.f.", "瓜德罗普岛", "la Guadeloupe (les Guadeloupéens)", "瓜德罗普岛（瓜德罗普人）。", 114, L21, "society"),
    ("Martinique", "n.f.", "马提尼克岛", "la Martinique (les Martiniquais)", "马提尼克岛（马提尼克人）。", 114, L21, "society"),
    ("Guyane", "n.f.", "圭亚那", "la Guyane française (les Guyanais)", "法属圭亚那（圭亚那人）。", 114, L21, "society"),
    ("Réunion", "n.f.", "留尼汪岛", "la Réunion (les Réunionnais)", "留尼汪岛（留尼汪人）。", 114, L21, "society"),
    ("Polynésie", "n.f.", "波利尼西亚", "la Polynésie française", "法属波利尼西亚。", 114, L21, "society"),
    ("Nouvelle-Calédonie", "n.f.", "新喀里多尼亚", "la Nouvelle-Calédonie", "新喀里多尼亚。", 114, L21, "society"),
    ("francophonie", "n.f.", "法语圈；法语国家（集合）", "Il existe une Organisation internationale de la Francophonie", "存在一个国际法语国家组织。", 114, L21, "society"),
    ("francophone", "adj.", "说法语的；法语区的", "« littérature francophone »", "法语文学。", 114, L21, "society"),
    ("officiel", "adj.", "官方的（langue officielle 官方语言）", "le français est la langue officielle", "法语是官方语言。", 114, L21, "society"),
    ("littérature", "n.f.", "文学", "La littérature francophone", "法语文学。", 114, L21, "society"),
    ("écrivain", "n.m.", "作家", "Ces écrivains sont très nombreux !", "这些作家非常多！", 114, L21, "society"),
    ("auteur", "n.m.", "作者", "des auteurs qui ne sont pas originaires de France métropolitaine", "不是出生于法国本土的作者。", 114, L21, "society"),
    ("originaire", "adj.", "出生于……的；来自……的", "des auteurs qui ne sont pas originaires de France métropolitaine", "不是出生于法国本土的作者。", 114, L21, "society"),
    ("prestigieux", "adj.", "享有盛名的", "Beaucoup d'entre eux ont reçu de prestigieux prix littéraires.", "他们中许多人获得了享有盛名的文学奖。", 114, L21, "society"),
    ("linguistique", "adj.", "语言的；语言学的", "une très grande richesse linguistique", "非常丰富的语言财富。", 114, L21, "society"),
    ("richesse", "n.f.", "财富；丰富", "une très grande richesse linguistique", "非常丰富的语言财富。", 114, L21, "society"),
]

def norm(s):
    s = re.sub(r"===[^\n]*===", " ", s)
    s = s.replace("•", " ").replace("’", "'")
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\s+([:;?!»])", r"\1", s)
    s = s.replace("« ", "«").replace("( = ", "(= ").replace("/ ", "/")
    return s.strip()

def corpus():
    ocr = json.load(open(OCR, encoding="utf-8"))
    txt = "\n".join(p["text"] for p in ocr if 104 <= p["pdf_page"] <= 114)
    txt += "\n" + open(TRANSCRIPT, encoding="utf-8").read()
    return norm(txt)

def main():
    cp = corpus()
    rows = list(csv.DictReader(open(SRC, encoding="utf-8")))
    tmpl = next(r for r in rows if r["lemma"] == "achat")
    out, problems, n_ex, fail, n_res = [], [], 0, 0, 0
    seen = set()
    for word, pos, zh, ex, exz, page, chapter, topic in R:
        lemma = resolve(word, pos)
        if lemma != word: n_res += 1
        key = (fold(lemma), pos, chapter)
        if key in seen:
            problems.append(f"duplicate row in batch: {word}/{pos}")
            continue
        seen.add(key)
        r = dict(tmpl)
        tip = ""
        if pos == "n.m." and word in ("Pays-Bas",): tip = "复数地名（les Pays-Bas）：复数信息保留在释义中"
        if word == "pages jaunes": tip = "复数名词（pl.）"
        if word == "États-Unis": tip = "复数地名（les États-Unis）"
        if word == "Pays-Bas": tip = "复数地名（les Pays-Bas）"
        if word == "décès": tip = "原书 OCR 为 (t)，原图为 (†)"
        if word == "Remarques": tip = ""
        r.update({"lemma": lemma, "pos": pos, "topic": topic, "level": "unverified",
                  "level_basis": "推定 A1（教材定位：封面「A1 DÉBUTANT」；前言「niveau faux-débutant」）",
                  "zh": zh, "zh_origin": "supplement", "zh_status": "补充翻译·待核对",
                  "fr_def": "", "example_fr": "", "example_zh": "", "col": "", "fam": "", "syn": "", "ant": "",
                  "tip": tip, "origin": "book", "kind": "lesson", "chapter": chapter,
                  "printed_page": str(page), "pdf_page": str(page), "review": "unreviewed"})
        if ex:
            n_ex += 1
            if norm(ex) not in cp:
                fail += 1; problems.append(f"not verbatim: {word} → {ex}")
            r["example_fr"], r["example_zh"] = ex, exz + "（补充翻译·待核对）"
            r["note"] = "例句：教材原页（OCR 或图像转写）逐字可见；释义为补充翻译·待核对"
        else:
            r["note"] = "教材原页无完整例句（列表、图示或标题）；释义为补充翻译·待核对"
        out.append(r)
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0].keys())); w.writeheader(); w.writerows(out)
    log = [f"rows={len(out)} zh={sum(1 for r in out if r['zh'])} examples={n_ex} verbatim_fail={fail} lemma_resolved_to_lexicon={n_res} problems={len(problems)}"] + problems
    open(LOG, "w", encoding="utf-8").write("\n".join(log) + "\n")
    print(log[0]); print(f"fill_csv={os.path.relpath(OUT, ROOT)} log={os.path.relpath(LOG, ROOT)}")
    return 1 if problems else 0

if __name__ == "__main__":
    sys.exit(main())
