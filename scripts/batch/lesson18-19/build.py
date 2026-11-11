#!/usr/bin/env python3
"""Débutant lessons 18 (LA TECHNOLOGIE – LES MÉDIAS, pp.94–97) and 19 (L'ARGENT – LA BANQUE, pp.98–103).

Output: data/imports/debutant-lesson18-19-fill.csv
Check : each example_fr must appear (whitespace/punctuation-normalised) in OCR of pp.94–102 or the image
        transcript (data/lessons/lesson13-15-image-transcript.txt). Examples are not invented; empty when absent.
        p.102 cheque text is garbled in OCR and is NOT used.
Log   : output/lesson18-19/fill.log
"""
import csv, json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SRC = os.path.join(ROOT, "data/imports/debutant-lesson11-15-bulk.csv")
OUT = os.path.join(ROOT, "data/imports/debutant-lesson18-19-fill.csv")
LOG = os.path.join(ROOT, "output/lesson18-19/fill.log")
OCR = os.path.join(ROOT, "references/extracted/debutant_ocr.json")
TRANSCRIPT = os.path.join(ROOT, "data/lessons/lesson13-15-image-transcript.txt")

L18 = "LA TECHNOLOGIE - LES MÉDIAS（第 18 课）"
L19 = "L'ARGENT - LA BANQUE（第 19 课）"
T18, T19 = "media", "economy"

# (lemma, pos, zh, example_fr, example_zh, printed_page, chapter, topic, tip)
R = [
    # ---------------- Lesson 18 — p.94 (informatique, téléphone), p.96 (multimédia, presse)
    ("informatique", "n.f.", "信息技术；计算机（l'informatique）", "« L'informatique » désigne tout ce qui est en relation avec l'ordinateur.", "“信息技术”指所有与计算机相关的事物。", 94, L18, T18, ""),
    ("informaticien", "n.", "信息技术人员（专业人员）", "Sami n'est pas informaticien", "Sami 不是信息技术专业人员。", 94, L18, T18, ""),
    ("équipement", "n.m.", "设备；装备（équipement informatique 信息设备）", "il a un équipement informatique", "他有一套信息设备。", 94, L18, T18, ""),
    ("logiciel", "n.m.", "软件", "avec des logiciels (= un programme informatique)", "使用软件（＝一个计算机程序）。", 94, L18, T18, ""),
    ("programme", "n.m.", "计算机程序（= un programme informatique）", "(= un programme informatique)", "（＝一个计算机程序）。", 94, L18, T18, "教材仅此义；「节目」义已删除（非教材义）"),
    ("connexion", "n.f.", "连接（connexion Internet 网络连接）", "une connexion Internet", "一个网络连接。", 94, L18, T18, ""),
    ("adresse", "n.f.", "地址（adresse électronique 电子邮箱地址）", "Il a une adresse électronique", "他有一个电子邮箱地址。", 94, L18, T18, ""),
    ("électronique", "adj.", "电子的", "Il a une adresse électronique", "他有一个电子邮箱地址。", 94, L18, T18, "adj.（区别于名词 électronique 待核实条目）"),
    ("messagerie", "n.f.", "信息箱；邮件系统（messagerie électronique 电子邮件）", "il consulte souvent sa messagerie (= ses courriers électroniques)", "他经常查看他的电子邮件（＝他的电子信件）。", 94, L18, T18, ""),
    ("blog", "n.m.", "博客", "un blog professionnel", "一个职业博客。", 94, L18, T18, ""),
    ("site", "n.m.", "网站（site Internet 网站）", "un site Internet", "一个网站。", 94, L18, T18, ""),
    ("système", "n.m.", "系统（système informatique 信息系统）", "son système informatique", "他的信息系统。", 94, L18, T18, ""),
    ("ordinateur", "n.m.", "电脑", "Un ordinateur ne marche pas = il est en panne.", "电脑坏了（＝它出故障了）。", 94, L18, T18, ""),
    ("panne", "n.f.", "故障；抛锚（être en panne 出故障）", "il est en panne", "它出故障了。", 94, L18, T18, ""),
    ("technicien", "n.", "技术员；技师", "Nora doit appeler un technicien", "Nora 必须叫一名技术员。", 94, L18, T18, ""),
    ("réparer", "v.", "修理；修复", "pour réparer la machine", "为了修理机器。", 94, L18, T18, ""),
    ("machine", "n.f.", "机器；机械", "pour réparer la machine", "为了修理机器。", 94, L18, T18, ""),
    ("envoyer", "v.", "发送；寄", "elle doit envoyer des photos et des documents", "她必须发送照片和文件。", 94, L18, T18, ""),
    ("photo", "n.f.", "照片", "envoyer des photos et des documents", "发送照片和文件。", 94, L18, T18, ""),
    ("document", "n.m.", "文件；文档", "des photos et des documents par mail", "通过邮件发送的照片和文件。", 94, L18, T18, ""),
    ("mail", "n.m.", "电子邮件", "par mail (= e-mail)", "通过电子邮件（＝e-mail）。", 94, L18, T18, ""),
    ("unité", "n.f.", "单元；部件（unité centrale 主机）", "une unité centrale", "一台主机。", 94, L18, T18, ""),
    ("touche", "n.f.", "键（键盘上的按键）", "une touche", "一个按键。", 94, L18, T18, ""),
    ("écran", "n.m.", "屏幕", "un écran", "一块屏幕。", 94, L18, T18, ""),
    ("imprimante", "n.f.", "打印机", "une imprimante", "一台打印机。", 94, L18, T18, ""),
    ("souris", "n.f.", "鼠标", "une souris", "一个鼠标。", 94, L18, T18, ""),
    ("clavier", "n.m.", "键盘", "un clavier", "一个键盘。", 94, L18, T18, ""),
    ("clé", "n.f.", "钥匙；U 盘（clé USB）", "une clé USB", "一个 USB 闪存盘。", 94, L18, T18, "与 L11「钥匙」为同形不同义，clé USB 为 U 盘"),
    ("portable", "n.m.", "手机（口语）", "Est-ce que tu as un [téléphone] mobile / un portable ?", "你有手机吗？", 94, L18, T18, ""),
    ("téléphone", "n.m.", "电话；电话机（téléphone fixe 固定电话）", "un téléphone fixe à la maison", "家里的一部固定电话。", 94, L18, T18, ""),
    ("fixe", "adj.", "固定的", "un téléphone fixe à la maison", "家里的一部固定电话。", 94, L18, T18, ""),
    ("répondeur", "n.m.", "电话答录机", "avec un répondeur", "带答录机。", 94, L18, T18, ""),
    ("message", "n.m.", "消息；留言", "Alors, je te laisse un message sur ton répondeur ?", "那么，我在你的答录机上给你留言？", 94, L18, T18, ""),
    ("joindre", "v.", "联系；联络（joindre = contacter）", "me joindre (= contacter) sur mon portable", "在我的手机上联系我（＝联络）。", 94, L18, T18, ""),
    ("allumé", "adj.", "亮着的；打开的", "Est-ce qu'il est toujours allumé ?", "它一直开着吗？", 94, L18, T18, ""),
    ("éteint", "adj.", "关掉的；熄灭的", "Non, il est souvent éteint", "不，它经常是关着的。", 94, L18, T18, ""),
    ("sonner", "v.", "响（铃）", "je ne veux pas qu'il sonne", "我不想让它响。", 94, L18, T18, ""),
    ("texto", "n.m.", "短信（口语，= un SMS）", "je peux t'envoyer un texto (= un SMS)", "我可以给你发短信（＝一条 SMS）。", 94, L18, T18, ""),
    ("sms", "n.m.", "短信", "je peux t'envoyer un texto (= un SMS)", "我可以给你发短信（＝一条 SMS）。", 94, L18, T18, ""),
    ("concert", "n.m.", "音乐会", "avant le début du concert", "在音乐会开始之前。", 94, L18, T18, ""),
    ("téléviseur", "n.m.", "电视机", "un beau téléviseur à écran plat", "一台漂亮的平板电视机。", 96, L18, T18, ""),
    ("lecteur", "n.m.", "播放机；读取器（lecteur de DVD）", "un lecteur/graveur de DVD", "一台 DVD 播放／刻录机。", 96, L18, T18, ""),
    ("graveur", "n.m.", "刻录机", "un lecteur/graveur de DVD", "一台 DVD 播放／刻录机。", 96, L18, T18, ""),
    ("caméscope", "n.m.", "摄像机", "Avec son caméscope, il peut faire des films lui-même.", "用他的摄像机。", 96, L18, T18, ""),
    ("disque", "n.m.", "唱片；光盘", "des disques compacts (des CD)", "光盘（CD）。", 96, L18, T18, ""),
    ("compact", "adj.", "紧凑的（disque compact 光盘）", "des disques compacts (des CD)", "光盘（CD）。", 96, L18, T18, ""),
    ("CD", "n.m.", "CD 光盘", "des disques compacts (des CD)", "光盘（CD）。", 96, L18, T18, ""),
    ("hi-fi", "n.f.", "高保真音响", "La vidéo et la hi-fi", "视频和高保真音响。", 96, L18, T18, ""),
    ("vidéo", "n.f.", "录像；视频", "La vidéo et la hi-fi", "视频和高保真音响。", 96, L18, T18, ""),
    ("multimédia", "n.m.", "多媒体", "LE MULTIMÉDIA", "多媒体。", 96, L18, T18, ""),
    ("télé", "n.f.", "电视（口语，télévision 的简称）", "Frédéric allume la télé[vision] quand il rentre à la maison", "Frédéric 回家时打开电视。", 96, L18, T18, "原书方括号 télé[vision]"),
    ("télévision", "n.f.", "电视；电视业", "Frédéric allume la télé[vision] quand il rentre à la maison", "Frédéric 回家时打开电视。", 96, L18, T18, ""),
    ("télévisé", "adj.", "电视的；电视播放的（journal télévisé 电视新闻）", "le journal télévisé tous les soirs à 20 heures", "每晚 20 点的电视新闻。", 96, L18, T18, ""),
    ("documentaire", "n.m.", "纪录片", "un documentaire (= un reportage)", "一部纪录片（＝一部专题报道）。", 96, L18, T18, ""),
    ("reportage", "n.m.", "专题报道；采访报道", "un documentaire (= un reportage)", "一部纪录片（＝一部专题报道）。", 96, L18, T18, ""),
    ("téléfilm", "n.m.", "电视电影", "un téléfilm", "一部电视电影。", 96, L18, T18, ""),
    ("émission", "n.f.", "节目（广播、电视）", "des émissions sur Internet", "网络上的节目。", 96, L18, T18, ""),
    ("match", "n.m.", "比赛（体育）", "je regarde souvent un match", "我经常看一场比赛。", 96, L18, T18, ""),
    ("jeu", "n.m.", "游戏；节目（jeux télévisés 电视游戏节目）", "un bon film ou des jeux télévisés", "一部好电影或电视游戏节目。", 96, L18, T18, ""),
    ("publicité", "n.f.", "广告", "Il y a trop de publicités", "广告太多了。", 96, L18, T18, ""),
    ("sujet", "n.m.", "话题；题目", "elle écoute des émissions sur différents sujets", "她收听关于各种话题的节目。", 96, L18, T18, ""),
    ("radio", "n.f.", "广播；收音机", "Judith préfère la radio", "Judith 更喜欢广播。", 96, L18, T18, ""),
    ("météo", "n.f.", "天气预报", "les informations (= les nouvelles) et la météo", "新闻（＝消息）和天气预报。", 96, L18, T18, ""),
    ("information", "n.f.", "信息；新闻（pl. informations）", "les informations (= les nouvelles)", "新闻（＝消息）。", 96, L18, T18, ""),
    ("station", "n.f.", "电台；站（station de radio 广播电台）", "des stations de radio publiques", "公共广播电台。", 96, L18, T18, ""),
    ("public", "adj.", "公共的；公立的", "des stations de radio publiques", "公共广播电台。", 96, L18, T18, ""),
    ("privé", "adj.", "私立的；私营的", "des radios privées", "私营广播电台。", 96, L18, T18, ""),
    ("presse", "n.f.", "新闻出版；报刊（presse écrite 纸质报刊）", "La presse écrite", "纸质报刊。", 96, L18, T18, ""),
    ("écrit", "adj.", "书面的；写下的（presse écrite 纸质报刊）", "La presse écrite", "纸质报刊。", 96, L18, T18, ""),
    ("kiosque", "n.m.", "报亭（kiosque à journaux 报刊亭）", "au kiosque à journaux", "在报刊亭。", 96, L18, T18, ""),
    ("article", "n.m.", "文章；条款", "Il lit surtout les articles sur l'économie et la politique.", "他主要读经济和政治方面的文章。", 96, L18, T18, ""),
    ("économie", "n.f.", "经济", "les articles sur l'économie et la politique", "关于经济和政治的文章。", 96, L18, T18, ""),
    ("magazine", "n.m.", "杂志", "un magazine féminin", "一本女性杂志。", 96, L18, T18, ""),
    ("revue", "n.f.", "期刊；杂志（学术）", "une revue de géographie", "一本地理期刊。", 96, L18, T18, ""),
    ("abonnement", "n.m.", "订阅；订购", "Elle a un abonnement pour un an.", "她订了一年的刊物。", 96, L18, T18, ""),
    ("abonné", "adj.", "订阅的；订购的（être abonné à 订阅）", "Lucie est abonnée à une revue de géographie", "Lucie 订阅了一本地理期刊。", 96, L18, T18, ""),
    # ---------------- Lesson 19 — p.98 (monnaie), p.100 (guichet, banque), p.102 (opérations)
    ("monnaie", "n.f.", "货币；零钱", "« La monnaie », ce sont aussi les petites pièces.", "“monnaie”也指小硬币（零钱）。", 98, L19, T19, "货币与零钱两个义项"),
    ("euro", "n.m.", "欧元", "la monnaie est l'euro (€)", "货币是欧元。", 98, L19, T19, ""),
    ("franc", "n.m.", "法郎（franc suisse 瑞士法郎）", "La Suisse emploie le franc suisse.", "瑞士使用瑞士法郎。", 98, L19, T19, ""),
    ("pièce", "n.f.", "硬币；零件（pièce de 1 € 一欧元硬币）", "une pièce de 1 €", "一枚 1 欧元硬币。", 98, L19, T19, ""),
    ("centime", "n.m.", "欧分（centime d'euro）", "des pièces de 1, 2, 5, 10, 20 et 50 centimes d'euro", "1、2、5、10、20 和 50 欧分的硬币。", 98, L19, T19, ""),
    ("billet", "n.m.", "纸币；票（billet de 10 € 十欧纸币）", "un billet de 10 €", "一张 10 欧元纸币。", 98, L19, T19, ""),
    ("porte-monnaie", "n.m.", "零钱包；钱包", "On met les pièces dans un porte-monnaie", "硬币放在零钱包里。", 98, L19, T19, ""),
    ("portefeuille", "n.m.", "皮夹；钱包", "les billets dans un portefeuille", "纸币放在皮夹里。", 98, L19, T19, ""),
    ("baguette", "n.f.", "法棍面包", "Une baguette, s'il vous plaît.", "请给我一根法棍。", 98, L19, T19, ""),
    ("argent", "n.m.", "钱；银（金属）", "Étienne a beaucoup d'argent, il est riche", "Étienne 有很多钱，他很富有。", 98, L19, T19, "义项：钱；金属银（L19 Remarque 2）"),
    ("riche", "adj.", "富有的", "il est riche", "他很富有。", 98, L19, T19, ""),
    ("gagner", "v.", "赚（钱）；赢得", "Combien est-ce qu'il gagne ?", "他挣多少钱？", 98, L19, T19, "gagner sa vie 谋生"),
    ("rendre", "v.", "找还（零钱）；归还", "La vendeuse rend la monnaie", "售货员找零。", 98, L19, T19, ""),
    ("millionnaire", "n.", "百万富翁", "Il est millionnaire, il a beaucoup d'argent", "他是百万富翁，有很多钱。", 98, L19, T19, ""),
    ("métal", "n.m.", "金属", "L'argent est aussi le nom d'un métal.", "银也是一种金属的名称。", 98, L19, T19, ""),
    ("bijou", "n.m.", "首饰；珠宝", "un bijou en argent", "一件银首饰。", 98, L19, T19, ""),
    ("guichet", "n.m.", "窗口；柜台（guichet automatique 自动取款机）", "au guichet automatique", "在自动取款机（自动柜台）。", 100, L19, T19, ""),
    ("automatique", "adj.", "自动的", "au guichet automatique", "在自动取款机（自动柜台）。", 100, L19, T19, ""),
    ("distributeur", "n.m.", "自动售货机；取款机（distributeur de billets 自动取款机）", "je vais au distributeur de billets", "我去自动取款机。", 100, L19, T19, ""),
    ("carte", "n.f.", "卡（carte bancaire 银行卡）", "j'utilise ma carte bancaire", "我使用我的银行卡。", 100, L19, T19, "口语：la carte bleue（蓝卡）"),
    ("bancaire", "adj.", "银行的（carte bancaire 银行卡）", "j'utilise ma carte bancaire", "我使用我的银行卡。", 100, L19, T19, ""),
    ("retirer", "v.", "取（钱）；撤回", "Pour retirer = prendre de l'argent de mon compte", "取钱（＝从我的账户拿钱）。", 100, L19, T19, ""),
    ("retrait", "n.m.", "取款", "« retrait d'argent »", "“取款”。", 100, L19, T19, ""),
    ("introduire", "v.", "插入；放入", "introduisez votre carte", "请插入您的卡。", 100, L19, T19, ""),
    ("composer", "v.", "输入（号码、密码）", "composez (= tapez) votre code secret", "输入（＝敲入）您的密码。", 100, L19, T19, ""),
    ("taper", "v.", "敲；键入", "composez (= tapez) votre code secret", "输入（＝敲入）您的密码。", 100, L19, T19, ""),
    ("code", "n.m.", "代码；密码（code secret 密码）", "votre code secret", "您的密码。", 100, L19, T19, ""),
    ("valider", "v.", "确认", "puis validez", "然后确认。", 100, L19, T19, ""),
    ("montant", "n.m.", "金额", "choisissez un montant (20 € ? 30 € ?)", "选择一个金额（20 欧？30 欧？）。", 100, L19, T19, ""),
    ("patienter", "v.", "耐心等待", "veuillez patienter", "请稍等。", 100, L19, T19, ""),
    ("reçu", "n.m.", "收据；回执", "désirez-vous un ticket / un reçu ?", "您需要票据或收据吗？", 100, L19, T19, "阳性名词（区别于形容词 reçu）"),
    ("perte", "n.f.", "丢失；损失", "en cas de perte ou de vol...", "如果丢失或被盗……", 100, L19, T19, ""),
    ("vol", "n.m.", "偷窃；盗窃", "en cas de perte ou de vol...", "如果丢失或被盗……", 100, L19, T19, ""),
    ("banque", "n.f.", "银行", "Dans une banque, on peut avoir, ouvrir (* fermer) un compte courant.", "在银行可以开立活期账户。", 100, L19, T19, ""),
    ("compte", "n.m.", "账户（compte courant 活期账户）", "ouvrir (* fermer) un compte courant", "开立一个活期账户。", 100, L19, T19, ""),
    ("numéro", "n.m.", "号码（numéro de compte 账号）", "Quel est votre numéro de compte ?", "您的账号是多少？", 100, L19, T19, ""),
    ("découvert", "n.m.", "透支（à découvert 透支）", "le compte est à découvert", "账户透支。", 100, L19, T19, ""),
    ("débiteur", "adj.", "欠债的；借方的（compte débiteur 透支账户）", "le compte est en rouge*, il est débiteur", "账户红字，是透支（借方）账户。", 100, L19, T19, "原书星号 rouge* 为脚注标记"),
    ("créditeur", "adj.", "有余额的；贷方的（compte créditeur 有余额账户）", "il est débiteur (* créditeur)", "（反义：有余额、贷方）。", 100, L19, T19, "反义说明，例句为原文括注"),
    ("rouge", "adj.", "红色的；（账户）透支的（être en rouge 透支）", "le compte est en rouge*", "账户透支（红字）。", 100, L19, T19, "原书星号 rouge* 为脚注标记"),
    ("dépenser", "v.", "花费", "Si on a trop dépensé", "如果花得太多。", 100, L19, T19, ""),
    ("économiser", "v.", "节省；储蓄", "il doit économiser de l'argent", "他必须存钱。", 100, L19, T19, ""),
    ("économie", "n.f.", "经济；节约（faire des économies 攒钱）", "Il doit faire des économies", "他必须攒钱。", 100, L19, T19, "义项：经济；节约（pl. économies 积蓄）"),
    ("épargne", "n.f.", "储蓄；积蓄（compte d'épargne 储蓄账户）", "sur un compte d'épargne", "在储蓄账户上。", 100, L19, T19, ""),
    ("côté", "n.m.", "一旁；旁边（mettre de côté 存起来）", "mettre de l'argent de côté", "把钱存起来。", 100, L19, T19, ""),
    ("moto", "n.f.", "摩托车", "acheter une moto", "买一辆摩托车。", 100, L19, T19, ""),
    ("voyage", "n.m.", "旅行", "tu pourras t'offrir ce voyage", "你就能请自己去这次旅行。", 100, L19, T19, ""),
    ("déposer", "v.", "存（钱）；放下", "Pour déposer (= verser) de l'argent sur un compte", "往账户里存钱（＝缴入）。", 102, L19, T19, ""),
    ("verser", "v.", "缴入；支付（存款）", "Pour déposer (= verser) de l'argent sur un compte", "往账户里存钱（＝缴入）。", 102, L19, T19, ""),
    ("versement", "n.m.", "存款；缴款", "Un versement de 300 €.", "一笔 300 欧的存款。", 102, L19, T19, ""),
    ("formulaire", "n.m.", "表格；表单", "remplir un formulaire (= un papier)", "填写一份表格（＝一张纸）。", 102, L19, T19, ""),
    ("remplir", "v.", "填写；装满", "remplir un formulaire (= un papier)", "填写一份表格（＝一张纸）。", 102, L19, T19, ""),
    ("emprunter", "v.", "借（钱）；借入", "on peut emprunter de l'argent à la banque", "可以向银行借钱。", 102, L19, T19, ""),
    ("emprunt", "n.m.", "贷款；借款", "j'ai fait un emprunt", "我办了一笔贷款。", 102, L19, T19, ""),
    ("prêter", "v.", "借给；出借", "Est-ce que tu peux me prêter 200 € ?", "你能借给我 200 欧吗？", 102, L19, T19, ""),
    ("prêt", "n.m.", "贷款；借贷", "un crédit = un prêt à 3,9%", "一笔信贷＝年利率 3.9% 的贷款。", 102, L19, T19, "原书写作 3,9%"),
    ("crédit", "n.m.", "信贷；赊购", "un crédit = un prêt à 3,9%", "一笔信贷＝年利率 3.9% 的贷款。", 102, L19, T19, ""),
    ("rembourser", "v.", "偿还；还款", "je dois rembourser mon emprunt", "我必须还我的贷款。", 102, L19, T19, ""),
    ("remboursement", "n.m.", "偿还；还款", "Le remboursement sera fini dans deux ans.", "还款两年后结束。", 102, L19, T19, ""),
    ("régler", "v.", "支付；结算（régler une facture 结清账单）", "On peut payer (= régler) les factures", "可以支付（＝结算）账单。", 102, L19, T19, ""),
    ("facture", "n.f.", "账单；发票", "On peut payer (= régler) les factures par prélèvement automatique.", "账单可以通过自动扣款支付。", 102, L19, T19, ""),
    ("prélever", "v.", "（自动）扣款；提取", "EDF (= Électricité de France) prélève (= prend) une somme de mon compte tous les mois.", "法国电力公司每个月从我的账户扣款。", 102, L19, T19, ""),
    ("prélèvement", "n.m.", "（自动）扣款；划拨", "par prélèvement automatique", "通过自动扣款。", 102, L19, T19, ""),
    ("chèque", "n.m.", "支票", "On peut aussi payer par chèque", "也可以用支票付款。", 102, L19, T19, ""),
    ("chéquier", "n.m.", "支票本", "j'ai oublié mon chéquier (= mon carnet de chèques)", "我忘了带我的支票本（＝支票册）。", 102, L19, T19, ""),
    ("espèce", "n.f.", "现金（en espèces 用现金）", "Vous payez comment ? Par chèque, par carte bleue ou en espèces (= en liquide*) ?", "您怎么付款？支票、蓝卡还是现金？", 102, L19, T19, "原书星号 liquide* 为脚注标记"),
    ("liquide", "n.m.", "现金（en liquide 用现金，口语）", "en espèces (= en liquide*)", "现金（＝口语：现金）。", 102, L19, T19, "原书星号 liquide* 为脚注标记"),
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
    txt = "\n".join(p["text"] for p in ocr if 94 <= p["pdf_page"] <= 102)
    txt += "\n" + open(TRANSCRIPT, encoding="utf-8").read()
    return norm(txt)

def main():
    cp = corpus()
    rows = list(csv.DictReader(open(SRC, encoding="utf-8")))
    tmpl = next(r for r in rows if r["lemma"] == "achat")
    out, problems, n_ex, fail = [], [], 0, 0
    for lemma, pos, zh, ex, exz, page, chapter, topic, tip in R:
        r = dict(tmpl)
        r.update({"lemma": lemma, "pos": pos, "topic": topic, "level": "unverified",
                  "level_basis": "推定 A1（教材定位：封面「A1 DÉBUTANT」；前言「niveau faux-débutant」）",
                  "zh": zh, "zh_origin": "supplement", "zh_status": "补充翻译·待核对",
                  "fr_def": "", "example_fr": "", "example_zh": "", "col": "", "fam": "", "syn": "", "ant": "",
                  "tip": tip, "origin": "book", "kind": "lesson", "chapter": chapter,
                  "printed_page": str(page), "pdf_page": str(page), "review": "unreviewed"})
        if ex:
            n_ex += 1
            if norm(ex) not in cp:
                fail += 1; problems.append(f"not verbatim: {lemma} → {ex}")
            r["example_fr"], r["example_zh"] = ex, exz + "（补充翻译·待核对）"
            r["note"] = "例句：教材原页（OCR 或图像转写）逐字可见；释义为补充翻译·待核对"
        else:
            r["note"] = "教材原页无完整例句（列表或标题）；释义为补充翻译·待核对"
        out.append(r)
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0].keys())); w.writeheader(); w.writerows(out)
    log = [f"rows={len(out)} zh={sum(1 for r in out if r['zh'])} examples={n_ex} verbatim_fail={fail} problems={len(problems)}"] + problems
    open(LOG, "w", encoding="utf-8").write("\n".join(log) + "\n")
    print(log[0]); print(f"fill_csv={os.path.relpath(OUT, ROOT)} log={os.path.relpath(LOG, ROOT)}")
    return 1 if problems else 0

if __name__ == "__main__":
    sys.exit(main())
