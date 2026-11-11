#!/usr/bin/env python3
"""Débutant lessons 16 (L'ÉCOLE) and 17 (LES PROFESSIONS): zh glosses + verbatim examples.

Output: data/imports/debutant-lesson16-17-fill.csv   (rows keyed lemma+pos; existing entries are merged)
Check : each example_fr must appear whitespace-normalised in OCR of pages 86–92 or the image transcript.
        Where OCR is wrong and the image shows otherwise, the image text is used and the OCR text is recorded
        in data/lessons/errata-16-17.md (not used as a standard answer).
Log   : output/lesson16-17/fill.log
"""
import csv, json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SRC = os.path.join(ROOT, "data/imports/debutant-lesson11-15-bulk.csv")
OUT = os.path.join(ROOT, "data/imports/debutant-lesson16-17-fill.csv")
LOG = os.path.join(ROOT, "output/lesson16-17/fill.log")
OCR = os.path.join(ROOT, "references/extracted/debutant_ocr.json")
TRANSCRIPT = os.path.join(ROOT, "data/lessons/lesson13-15-image-transcript.txt")

L16 = "L'ÉCOLE - L'ENSEIGNEMENT（第 16 课）"
L17 = "LES PROFESSIONS（第 17 课）"
T_EDU, T_WORK = "education", "work"

# (lemma, pos, zh, example_fr or '', example_zh, printed_page, chapter, topic, tip)
R = [
    # ---------------- Lesson 16 — p.86 / p.88
    ("maternelle", "n.f.", "幼儿园（学前教育，3 至 6 岁，非义务）", "L'école maternelle = la maternelle* (de 3 à 6 ans) : elle n'est pas obligatoire.", "幼儿园（maternelle）3 至 6 岁，不是义务教育。", 86, L16, T_EDU, ""),
    ("primaire", "adj.", "小学的（école primaire 小学）", "L'école primaire (de 6 à 10 ans) : elle est obligatoire.", "小学（6 至 10 岁）是义务教育。", 86, L16, T_EDU, ""),
    ("collège", "n.m.", "初中（11 至 14 岁，六年级至三年级）", "Le collège (de 11 à 14 ans) : de la 6° à la 3°.", "初中（11 至 14 岁），从六年级到三年级。", 86, L16, T_EDU, ""),
    ("lycée", "n.m.", "高中（15 至 17 岁）", "Le lycée (de 15 à 17 ans) : de la seconde à la terminale.", "高中（15 至 17 岁），从高二到高三。", 86, L16, T_EDU, ""),
    ("lycée technique", "n.m.", "职业高中（学习理发、电工等职业）", "Le lycée technique (pour apprendre un métier tel que coiffeur, électricien...).", "职业高中（学习理发师、电工等职业）。", 86, L16, T_EDU, ""),
    ("bac", "n.m.", "中学毕业会考（baccalauréat，简称 bac）", "les élèves passent un examen, le bac[calauréat].", "学生参加毕业考试，即 bac。", 86, L16, T_EDU, "原书方括号写法 bac[calauréat]"),
    ("examen", "n.m.", "考试；（学校）考试", "les élèves passent un examen", "学生参加考试。", 86, L16, T_EDU, ""),
    ("université", "n.f.", "大学", "L'université comprend plusieurs facultés", "大学包括多个学院。", 86, L16, T_EDU, ""),
    ("faculté", "n.f.", "学院；系（大学的院系）", "L'université comprend plusieurs facultés", "大学包括多个学院。", 86, L16, T_EDU, ""),
    ("fac", "n.f.", "大学院系；大学（口语）", "les étudiants vont à la fac* de médecine", "学生去医学院（fac）。", 86, L16, T_EDU, "原书星号 fac* 为脚注标记，原样保留"),
    ("médecine", "n.f.", "医学", "les étudiants vont à la fac* de médecine", "学生去医学院。", 86, L16, T_EDU, ""),
    ("lettres", "n.f.", "文学；人文学科（faculté de lettres 文学院）", "de médecine, de lettres, de sciences...", "医学、文学、理科……", 86, L16, T_EDU, "复数名词（pl.）"),
    ("sciences", "n.f.", "理科；科学（faculté des sciences 理学院）", "de médecine, de lettres, de sciences...", "医学、文学、理科……", 86, L16, T_EDU, "复数名词（pl.）"),
    ("grande école", "n.f.", "大学校（法国精英高等院校）", "Les « grandes écoles » (Polytechnique, École normale supérieure, École des mines...) sont plus difficiles que l'université.", "“大学校”（综合理工学院、高等师范学院、矿业学院等）比大学更难考。", 86, L16, T_EDU, ""),
    ("rentrée", "n.f.", "开学；（新学年/新季节的）开始", "« La rentrée » de septembre est donc spectaculaire", "九月的开学（rentrée）因此十分引人注目。", 86, L16, T_EDU, ""),
    ("vacances", "n.f.", "假期（复数，les vacances）", "Il y a bien sûr des vacances", "当然有假期。", 86, L16, T_EDU, "复数名词（pl.）"),
    ("année scolaire", "n.f.", "学年", "L'année scolaire commence en septembre et finit en juin.", "学年九月开始，六月结束。", 86, L16, T_EDU, ""),
    ("scolaire", "adj.", "学校的；学业的（année scolaire 学年）", "L'année scolaire commence en septembre et finit en juin.", "学年九月开始，六月结束。", 86, L16, T_EDU, ""),
    ("public", "adj.", "公立的（système public 公立体系）", "Écoles, lycées, universités du système public sont gratuits.", "公立学校、高中和大学都是免费的。", 86, L16, T_EDU, ""),
    ("gratuit", "adj.", "免费的", "Écoles, lycées, universités du système public sont gratuits.", "公立学校、高中和大学都是免费的。", 86, L16, T_EDU, ""),
    ("payant", "adj.", "收费的", "Écoles et lycées privés sont payants.", "私立学校和高中是收费的。", 86, L16, T_EDU, ""),
    ("privé", "adj.", "私立的；私人的", "Écoles et lycées privés sont payants.", "私立学校和高中是收费的。", 86, L16, T_EDU, ""),
    ("obligatoire", "adj.", "义务的；强制的", "elle n'est pas obligatoire.", "（幼儿园）不是义务教育。", 86, L16, T_EDU, ""),
    ("redoubler", "v.", "留级；重读（一年）", "il devra redoubler sa terminale (= recommencer l'année).", "他必须重读高三（＝重新读一年）。", 86, L16, T_EDU, ""),
    ("rater", "v.", "没通过（考试）；失败", "s'il rate* (= s'il est recalé à) son bac", "如果他没通过（＝没考上）bac。", 86, L16, T_EDU, "原书星号 rate* 为脚注标记"),
    ("recaler", "v.", "（考试）不及格，未通过", "s'il est recalé à) son bac", "（没）通过 bac 考试。", 86, L16, T_EDU, ""),
    ("reçu", "adj.", "考试及格的；考上的（être reçu à 通过……）", "s'il est reçu à son bac", "考上 bac。", 86, L16, T_EDU, ""),
    ("terminale", "n.f.", "高三（中学最后一年）", "redoubler sa terminale", "重读高三。", 86, L16, T_EDU, ""),
    ("seconde", "n.f.", "高二（高中第二年）", "de la seconde à la terminale", "从高二到高三。", 86, L16, T_EDU, ""),
    ("entrer", "v.", "进入（entrer à l'université 进入大学）", "aller / entrer à l'université", "上大学。", 86, L16, T_EDU, ""),
    ("bourse", "n.f.", "奖学金；助学金（bourse d'études）", "a une bourse d'études", "有一笔助学金。", 88, L16, T_EDU, ""),
    ("école de commerce", "n.f.", "商学院", "Adila fait* une école de commerce.", "Adila 在读商学院。", 88, L16, T_EDU, "原书星号 fait* 为脚注标记"),
    ("stage", "n.m.", "实习", "elle doit faire un stage dans une entreprise", "她必须在一家公司实习。", 88, L16, T_EDU, ""),
    ("entreprise", "n.f.", "公司；企业", "un stage dans une entreprise", "在一家公司实习。", 88, L16, T_EDU, ""),
    ("diplôme", "n.m.", "文凭；学位", "elle aura (= obtiendra) un diplôme.", "她将获得（＝取得）一个文凭。", 88, L16, T_EDU, ""),
    ("salle", "n.f.", "房间；教室（salle de classe 教室）", "Dans une salle de classe, il y a", "在教室里，有……", 88, L16, T_EDU, ""),
    ("classe", "n.f.", "班级；课堂", "une classe (composée de tous les élèves)", "一个班级（由全体学生组成）。", 88, L16, T_EDU, ""),
    ("élève", "n.", "学生（un/une élève）", "Clément est un bon élève, il a de bonnes notes.", "Clément 是个好学生，成绩好。", 88, L16, T_EDU, "阴阳同形：un/une élève"),
    ("professeur", "n.m.", "教师（professeur 永远是阳性）", "« Professeur » est toujours masculin", "“professeur”永远是阳性。", 88, L16, T_EDU, ""),
    ("prof", "n.", "教师（口语，prof）", "(un prof*)", "（一位老师）。", 88, L16, T_EDU, "原书星号 prof* 为脚注标记"),
    ("leçon", "n.f.", "课；课文；功课", "il n'apprend jamais sa leçon", "他从来不背课文。", 88, L16, T_EDU, ""),
    ("apprendre", "v.", "学习；背诵", "apprend, étudie... sa leçon", "学习、研究……功课。", 88, L16, T_EDU, ""),
    ("étudier", "v.", "学习；研究", "J'étudie l'histoire de l'Europe au XVIIe siècle.", "我学习十七世纪的欧洲历史。", 88, L16, T_EDU, "原 OCR 为 xvir；原图为 XVIIᵉ（上标 e），已修正，见 errata"),
    ("histoire", "n.f.", "历史；历史课", "J'étudie l'histoire de l'Europe", "我学习欧洲历史。", 88, L16, T_EDU, ""),
    ("cours", "n.m.", "课；课程", "a un cours de... français", "上一门法语课。", 88, L16, T_EDU, ""),
    ("français", "n.m.", "法语", "J'aime bien le français, l'histoire et l'anglais.", "我很喜欢法语、历史和英语。", 88, L16, T_EDU, "语言名词（区别于形容词 français）"),
    ("anglais", "n.m.", "英语", "J'aime bien le français, l'histoire et l'anglais.", "我很喜欢法语、历史和英语。", 88, L16, T_EDU, "语言名词（区别于形容词 anglais）"),
    ("allemand", "n.m.", "德语", "prend des cours (de) d'... allemand", "学德语课。", 88, L16, T_EDU, "语言名词（区别于形容词 allemand）"),
    ("philosophie", "n.f.", "哲学", "suit des cours (d') de... philosophie", "上哲学课。", 88, L16, T_EDU, ""),
    ("géographie", "n.f.", "地理", "assiste à un cours (d') de... géographie", "参加地理课。", 88, L16, T_EDU, ""),
    ("maths", "n.f.", "数学（口语）", "fait un exercice (d') de... maths", "做一道数学练习。", 88, L16, T_EDU, ""),
    ("mathématiques", "n.f.", "数学", "je suis mauvais en mathématiques", "我数学不好。", 88, L16, T_EDU, "复数名词（pl.）"),
    ("exercice", "n.m.", "练习；习题", "fait un exercice (d') de... maths", "做一道数学练习。", 88, L16, T_EDU, ""),
    ("devoir", "n.m.", "作业（pl. devoirs）", "fait... des devoirs", "做作业。", 88, L16, T_EDU, "阳性名词，复数 devoirs"),
    ("copie", "n.f.", "试卷；作业卷", "corrige des copies", "批改试卷。", 88, L16, T_EDU, ""),
    ("corriger", "v.", "批改；改正", "corrige des copies", "批改试卷。", 88, L16, T_EDU, ""),
    ("note", "n.f.", "成绩；分数", "il a eu une mauvaise note en géographie", "他地理成绩不好。", 88, L16, T_EDU, ""),
    ("bon", "adj.", "好的；擅长的（bon en 擅长）", "Clément est un bon élève", "Clément 是个好学生。", 88, L16, T_EDU, ""),
    ("mauvais", "adj.", "坏的；差的（mauvais en 不擅长）", "Quentin est un mauvais élève", "Quentin 是个差学生。", 88, L16, T_EDU, ""),
    ("matière", "n.f.", "学科；科目", "Quelles matières est-ce que tu préfères", "你喜欢哪些学科？", 88, L16, T_EDU, ""),
    ("assister", "v.", "出席；参加（assister à 参加）", "assiste à un cours", "参加一门课。", 88, L16, T_EDU, ""),
    ("suivre", "v.", "上（课）；跟随（suivre des cours 上课）", "suit des cours", "上课。", 88, L16, T_EDU, ""),
    ("donner", "v.", "给；授课（donner des cours 授课）", "donne des cours", "授课。", 88, L16, T_EDU, ""),
    ("passer", "v.", "参加（考试）；经过（passer un examen 参加考试）", "passe... un examen", "参加考试。", 88, L16, T_EDU, ""),
    ("enseigner", "v.", "教授；讲授", "enseigne... (le/la) l'histoire", "教历史。", 88, L16, T_EDU, ""),
    ("étudiant", "n.", "大学生（un/une étudiant(e)）", "Benoît, qui est étudiant (à l'université)", "Benoît 是大学生。", 88, L16, T_EDU, ""),
    # ---------------- Lesson 17 — p.90 / p.92
    ("ouvrier", "n.m.", "工人（ouvrier/ouvrière）", "Un(e) ouvrier (-ière) travaille dans une usine", "工人在工厂工作。", 90, L17, T_WORK, "词库原 ouvrier 为 v.（误），已在此行用名词词性对应 ouvrier-m"),
    ("usine", "n.f.", "工厂", "Un(e) ouvrier (-ière) travaille dans une usine", "工人在工厂工作。", 90, L17, T_WORK, ""),
    ("employé", "n.", "雇员；职员（un/une employé(e)）", "un(e) employé(e) travaille dans un bureau", "职员在办公室工作。", 90, L17, T_WORK, ""),
    ("bureau", "n.m.", "办公室；办事处", "un(e) employé(e) travaille dans un bureau", "职员在办公室工作。", 90, L17, T_WORK, ""),
    ("commerçant", "n.", "商人；店主", "chez un commerçant (boulanger, boucher...)", "在某个商人（面包师、屠夫……）那里。", 90, L17, T_WORK, ""),
    ("femme de ménage", "n.f.", "家政女工；清洁女工", "une femme de ménage fait le ménage", "家政女工做家务。", 90, L17, T_WORK, ""),
    ("nounou", "n.f.", "保姆（照看孩子）", "une nounou s'occupe des enfants", "保姆照顾孩子。", 90, L17, T_WORK, ""),
    ("standardiste", "n.", "接线员；话务员", "un(e) standardiste (qui répond au téléphone)", "接线员（接电话的人）。", 90, L17, T_WORK, ""),
    ("assistant", "n.", "助理", "un(e) assistant(e)", "助理。", 90, L17, T_WORK, ""),
    ("comptable", "n.", "会计", "un(e) comptable", "会计。", 90, L17, T_WORK, ""),
    ("commercial", "n.", "销售人员（un(e) commercial(e)）", "", "", 90, L17, T_WORK, "教材为「un(e) « commercial(e) »」，无完整句，未录例句"),
    ("technicien", "n.", "技术员；技师", "un(e) technicien(ne)", "技术员。", 90, L17, T_WORK, ""),
    ("informaticien", "n.", "信息技术人员", "un(e) informaticien(ne) (= un(e) ingénieur en informatique)", "信息技术人员（＝信息工程师）。", 90, L17, T_WORK, ""),
    ("ingénieur", "n.", "工程师", "un(e) ingénieur en informatique", "信息技术工程师。", 90, L17, T_WORK, ""),
    ("chef", "n.m.", "主管；领导", "travaillent pour leur chef / responsable", "为他们的领导／负责人工作。", 90, L17, T_WORK, ""),
    ("responsable", "n.", "负责人；主管", "travaillent pour leur chef / responsable", "为他们的领导／负责人工作。", 90, L17, T_WORK, "名词用法（区别于形容词 responsable）"),
    ("architecte", "n.", "建筑师", "il faut un(e) architecte", "需要一位建筑师。", 90, L17, T_WORK, ""),
    ("artisan", "n.m.", "手工业者；工匠", "des artisans ou des entrepreneurs", "手工业者或承包商。", 90, L17, T_WORK, ""),
    ("entrepreneur", "n.m.", "承包商；企业家", "des artisans ou des entrepreneurs", "手工业者或承包商。", 90, L17, T_WORK, ""),
    ("plombier", "n.m.", "水暖工", "(un plombier, un électricien, un maçon, un peintre...)", "（水暖工、电工、泥瓦工、油漆工……）", 90, L17, T_WORK, ""),
    ("électricien", "n.m.", "电工", "(un plombier, un électricien, un maçon, un peintre...)", "（水暖工、电工、泥瓦工、油漆工……）", 90, L17, T_WORK, ""),
    ("maçon", "n.m.", "泥瓦工", "(un plombier, un électricien, un maçon, un peintre...)", "（水暖工、电工、泥瓦工、油漆工……）", 90, L17, T_WORK, ""),
    ("peintre", "n.m.", "油漆工；画家", "(un plombier, un électricien, un maçon, un peintre...)", "（水暖工、电工、泥瓦工、油漆工……）", 90, L17, T_WORK, "教材此处指房屋油漆工（画家另见 artiste）"),
    ("enseignant", "n.", "教师（教育工作者）", "Les enseignants (professeurs) travaillent dans les écoles", "教师（教授）在学校工作。", 90, L17, T_WORK, ""),
    ("serveur", "n.", "服务员（餐厅）", "un serveur ou une serveuse servent les clients à table", "服务员（男或女）在餐桌旁为顾客服务。", 90, L17, T_WORK, ""),
    ("vendeur", "n.", "售货员；店员", "un(e) vendeur (-euse)", "售货员。", 90, L17, T_WORK, ""),
    ("caissier", "n.", "收银员", "un(e) caissier (-ière)", "收银员。", 90, L17, T_WORK, ""),
    ("avocat", "n.", "律师", "Un(e) avocat(e) défend un accusé au tribunal.", "律师在法庭上为被告辩护。", 90, L17, T_WORK, ""),
    ("accusé", "n.", "被告；被告人", "défend un accusé au tribunal", "为被告在法庭上辩护。", 90, L17, T_WORK, ""),
    ("tribunal", "n.m.", "法院；法庭", "défend un accusé au tribunal", "为被告在法庭上辩护。", 90, L17, T_WORK, ""),
    ("hôpital", "n.m.", "医院", "Dans un hôpital, le médecin et les infirmiers", "在医院里，医生和护士。", 90, L17, T_WORK, ""),
    ("médecin", "n.m.", "医生", "Dans un hôpital, le médecin et les infirmiers", "在医院里，医生和护士。", 90, L17, T_WORK, ""),
    ("infirmier", "n.", "护士", "les infirmiers (-ières)", "护士（男、女）。", 90, L17, T_WORK, ""),
    ("patient", "n.", "病人（les patients 病人们）", "travaillent avec les patients", "与病人一起工作。", 90, L17, T_WORK, "名词用法（区别于形容词 patient）"),
    ("chirurgien", "n.m.", "外科医生", "le chirurgien fait les opérations chirurgicales", "外科医生做外科手术。", 90, L17, T_WORK, ""),
    ("artiste", "n.", "艺术家；演员", "Un(e) artiste peut être acteur (actrice), musicien(ne)", "艺术家可以是演员、音乐家……", 90, L17, T_WORK, ""),
    ("acteur", "n.", "演员", "acteur (actrice)", "演员（男、女）。", 90, L17, T_WORK, ""),
    ("actrice", "n.f.", "女演员", "acteur (actrice)", "演员（女）。", 90, L17, T_WORK, "acteur 的阴性形式"),
    ("musicien", "n.", "音乐家", "musicien(ne)", "音乐家（男、女）。", 90, L17, T_WORK, ""),
    ("photographe", "n.", "摄影师", "photographe, sculpteur (-trice)", "摄影师、雕塑家。", 90, L17, T_WORK, ""),
    ("sculpteur", "n.", "雕塑家", "photographe, sculpteur (-trice)", "摄影师、雕塑家。", 90, L17, T_WORK, ""),
    ("danseur", "n.", "舞者", "danseur(-euse)", "舞者（男、女）。", 90, L17, T_WORK, ""),
    ("journaliste", "n.", "记者", "Un(e) journaliste travaille pour les médias.", "记者为媒体工作。", 90, L17, T_WORK, ""),
    ("média", "n.m.", "媒体（pl. médias）", "Un(e) journaliste travaille pour les médias.", "记者为媒体工作。", 90, L17, T_WORK, ""),
    ("pilote", "n.m.", "飞行员；驾驶员", "Un pilote, une hôtesse de l'air travaillent dans un avion.", "飞行员、空乘人员在飞机上工作。", 90, L17, T_WORK, ""),
    ("hôtesse de l'air", "n.f.", "空乘人员（空姐）", "Un pilote, une hôtesse de l'air travaillent dans un avion.", "飞行员、空乘人员在飞机上工作。", 90, L17, T_WORK, ""),
    ("mécanicien", "n.m.", "机械师；修车工", "La voiture est réparée par un mécanicien (un garagiste).", "汽车由机械师（修车工）修理。", 90, L17, T_WORK, ""),
    ("garagiste", "n.m.", "汽车修理工；修车厂老板", "(un garagiste)", "（修车工）。", 90, L17, T_WORK, ""),
    ("chauffeur", "n.m.", "司机", "Un chauffeur de taxi conduit ses clients à destination.", "出租车司机把乘客送到目的地。", 90, L17, T_WORK, ""),
    ("taxi", "n.m.", "出租车", "Un chauffeur de taxi conduit ses clients à destination.", "出租车司机把乘客送到目的地。", 90, L17, T_WORK, ""),
    ("client", "n.", "顾客；客户", "conduit ses clients à destination", "把乘客送到目的地。", 90, L17, T_WORK, ""),
    ("destination", "n.f.", "目的地", "conduit ses clients à destination", "把乘客送到目的地。", 90, L17, T_WORK, ""),
    ("chômeur", "n.", "失业者", "Le pauvre Denis est chômeur", "可怜的 Denis 失业了。", 92, L17, T_WORK, ""),
    ("chômage", "n.m.", "失业（au chômage 失业中）", "il est au chômage", "他失业了。", 92, L17, T_WORK, ""),
    ("stagiaire", "n.", "实习生", "Fabrice est stagiaire dans une entreprise", "Fabrice 在一家公司实习。", 92, L17, T_WORK, ""),
    ("retraité", "n.", "退休人员", "Georges est retraité", "Georges 已退休。", 92, L17, T_WORK, ""),
    ("retraite", "n.f.", "退休；养老金（en retraite 退休中）", "il est en retraite", "他已退休。", 92, L17, T_WORK, ""),
    ("dentiste", "n.m.", "牙医", "Je suis dentiste", "我是牙医。", 92, L17, T_WORK, ""),
    ("programmeur", "n.m.", "程序员", "je suis programmeur", "我是程序员。", 92, L17, T_WORK, ""),
    ("informatique", "n.f.", "信息技术；计算机行业", "Je travaille dans l'informatique", "我在信息技术行业工作。", 92, L17, T_WORK, "原词库 pos 待核实；本例为名词（阴性）"),
    ("télécommunications", "n.f.", "电信（复数，les télécommunications）", "Je travaille dans les télécommunications", "我在电信行业工作。", 92, L17, T_WORK, "复数名词（pl.）"),
    ("emploi", "n.m.", "工作；职位", "cherche un nouvel emploi", "寻找新的工作。", 92, L17, T_WORK, ""),
    ("travail", "n.m.", "工作；职业", "il a perdu son travail", "他失去了工作。", 92, L17, T_WORK, ""),
    ("profession", "n.f.", "职业；工作", "Quelle est votre profession ?", "您的职业是什么？", 92, L17, T_WORK, ""),
    ("domaine", "n.m.", "领域；行业", "Vous travaillez dans quel domaine ?", "您在哪个领域工作？", 92, L17, T_WORK, ""),
    ("expérience", "n.f.", "经验；经历", "pour avoir une expérience professionnelle", "为了获得职业经验。", 92, L17, T_WORK, ""),
    ("assurance", "n.f.", "保险", "elle travaille dans un bureau d'assurances", "她在一家保险公司工作。", 92, L17, T_WORK, "复数形式 assurances 出现在原文"),
    ("travailler", "v.", "工作；劳动", "Je travaille dans l'informatique", "我在信息技术行业工作。", 92, L17, T_WORK, ""),
]

# Errata: OCR text kept here for the record; corrected text is the one used in the example.
ERRATA_HINT = {"étudier": "xvir siècle (OCR) → XVIIᵉ siècle（原图 p.88）"}

def norm(s):
    s = re.sub(r"===[^\n]*===", " ", s)
    s = s.replace("•", " ").replace("’", "'")
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\s+([:;?!»])", r"\1", s)   # typographic spacing before punctuation
    return s.replace("« ", "«")

def corpus():
    ocr = json.load(open(OCR, encoding="utf-8"))
    txt = "\n".join(p["text"] for p in ocr if 86 <= p["pdf_page"] <= 92)
    txt += "\n" + open(TRANSCRIPT, encoding="utf-8").read()
    return norm(txt)

def main():
    cp = corpus()
    rows = list(csv.DictReader(open(SRC, encoding="utf-8")))
    tmpl = next(r for r in rows if r["lemma"] == "achat")
    problems, n_ex, fail = [], 0, 0
    out = []
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
