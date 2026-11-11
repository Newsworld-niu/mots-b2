"""r40: writes data/confusables.json, the groups behind the 易混词辨析 page.

Hand-written; not checked by a native speaker (the whole lexicon is review=unreviewed). Each item is
(w, 中文, rule, example fr, example zh, form?, lemma?):
  form  = the text blanked in the example when it is not w itself (vois for voir)
  lemma = the headword the item belongs to when w is a form (est -> être), used to link it to an entry
`npm run lexicon:build` validates every example (the blanked text must occur as a whole word) and links entries.
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data/confusables.json")

H, M = "homophone", "meaning"
G = [
    # ---- sound-alike words -------------------------------------------------------------------------------------
    ("ou-ou", H, "ou / où", "ou 是“或者”，où 带重音，问地点。", [
        ("ou", "或者", "可以换成 ou bien", "Tu veux du thé ou du café ?", "你要茶还是咖啡？"),
        ("où", "哪里；在……的地方", "带重音，问地点或引出地点", "Où habitez-vous ?", "您住在哪里？")]),
    ("a-a", H, "a / à", "a 是 avoir 的变位（有），à 是介词（在、到）。", [
        ("a", "有（avoir 的变位）", "能换成 avait；à 不行", "Il a deux sœurs.", "他有两个姐妹。", None, "avoir"),
        ("à", "在；到；给", "介词，带重音，不能换成 avait", "Je vais à Paris.", "我去巴黎。")]),
    ("et-est", H, "et / est", "et 是“和”，est 是 être 的变位（是）。", [
        ("et", "和", "能换成 et puis，连接两个并列成分", "Pierre et Marie sont amis.", "皮埃尔和玛丽是朋友。"),
        ("est", "是（être 的变位）", "能换成 était", "Il est médecin.", "他是医生。", None, "être")]),
    ("son-sont", H, "son / sont", "son 是“他的”，后接名词；sont 是 être 的变位，后接形容词或名词。", [
        ("son", "他的；她的（阳性）", "后面接名词，能换成 mon", "Il aime son travail.", "他喜欢他的工作。"),
        ("sont", "是（être，复数）", "能换成 étaient", "Ils sont contents.", "他们很高兴。", None, "être")]),
    ("on-ont", H, "on / ont", "on 是“人们、我们”，ont 是 avoir 的变位。", [
        ("on", "人们；我们", "做主语，能换成 il", "On mange à midi.", "中午吃饭。"),
        ("ont", "有（avoir，他们）", "能换成 avaient", "Elles ont faim.", "她们饿了。", None, "avoir")]),
    ("ce-se", H, "ce / se", "ce 是“这个”，se 是反身代词，后面跟动词。", [
        ("ce", "这；这个", "后接名词或 est", "Ce livre est intéressant.", "这本书很有趣。"),
        ("se", "自己（反身代词）", "后接动词，能换成 me / te", "Il se lève à sept heures.", "他七点起床。")]),
    ("cest-sest", H, "c'est / s'est", "c'est 是“这是”，s'est 是反身动词的复合过去时。", [
        ("c'est", "这是", "能换成 cela est", "C'est un bon film.", "这是一部好电影。"),
        ("s'est", "（反身动词的助动词 + être）", "前面有 il / elle，后接过去分词", "Elle s'est trompée de route.", "她走错路了。")]),
    ("ces-ses", H, "ces / ses", "ces 是“这些”，ses 是“他的 / 她的”（复数）。", [
        ("ces", "这些", "ce 的复数，指示", "Ces fleurs sont belles.", "这些花很美。"),
        ("ses", "他的；她的（复数）", "son / sa 的复数，表示所属", "Elle a perdu ses clés.", "她丢了她的钥匙。")]),
    ("la-la", H, "la / là / l'a", "la 是阴性定冠词，là 是“那里”（带重音），l'a 是 le / la + a。", [
        ("la", "这（阴性定冠词）", "后接阴性名词", "La maison est grande.", "房子很大。"),
        ("là", "那里；这里", "指地点，带重音", "Mets le livre là.", "把书放在那儿。"),
        ("l'a", "（把它）有……", "代词 + avoir，能换成 l'avait", "Il l'a vu hier.", "他昨天看见他了。")]),
    ("mais-mes", H, "mais / mes", "mais 是转折“但是”，mes 是“我的”（复数）。", [
        ("mais", "但是", "连词，能换成 pourtant", "Il est petit mais fort.", "他个子小，但很强壮。"),
        ("mes", "我的（复数）", "后接复数名词", "Mes amis arrivent demain.", "我的朋友们明天到。")]),
    ("quand-quant", H, "quand / quant à", "quand 表时间，quant à 是“至于”。", [
        ("quand", "当……时；什么时候", "表示时间", "Quand arrives-tu ?", "你什么时候到？"),
        ("quant à", "至于", "固定搭配，后接名词或代词", "Quant à moi, je reste.", "至于我，我留下。")]),
    ("ni-ny", H, "ni / n'y", "ni 是“也不”，n'y 是 ne + y（不……那里）。", [
        ("ni", "也不；既不……也不", "成对出现，前面有 ne", "Il ne boit ni thé ni café.", "他茶和咖啡都不喝。"),
        ("n'y", "ne + y（不……那里）", "后接动词", "Je n'y vais jamais.", "我从不去那里。")]),
    ("peu-peut", H, "peu / peut", "peu 是“很少”，peut 是 pouvoir 的变位（能）。", [
        ("peu", "很少；一点点", "副词，能换成 beaucoup 的反义", "Il mange peu.", "他吃得很少。"),
        ("peut", "能；可以（pouvoir）", "动词，能换成 pouvait", "Elle peut venir demain.", "她明天可以来。", None, "pouvoir")]),
    ("sans-cent-sang", H, "sans / cent / sang", "三个词读音相近：没有、一百、血。", [
        ("sans", "没有", "介词，后接名词", "Je bois mon café sans sucre.", "我喝咖啡不加糖。"),
        ("cent", "一百", "数词", "Il y a cent personnes.", "有一百个人。"),
        ("sang", "血", "名词，阳性", "Le sang est rouge.", "血是红色的。")]),
    ("sur-sur", H, "sur / sûr", "sur 是“在……上”，sûr 带长音符，是“确定的”。", [
        ("sur", "在……上", "介词，没有长音符", "Le livre est sur la table.", "书在桌子上。"),
        ("sûr", "确定的；可靠的", "形容词，带长音符", "Je suis sûr de lui.", "我对他有把握。")]),
    ("du-du", H, "du / dû", "du 是“一些”，dû 带重音，是 devoir 的过去分词。", [
        ("du", "一些；……的（de + le）", "没有重音", "Je bois du lait.", "我喝牛奶。"),
        ("dû", "应该；不得不（devoir 的过去分词）", "带重音，只用于阳性单数", "Il a dû partir.", "他不得不走了。", None, "devoir")]),
    ("mur-mur", H, "mur / mûr", "mur 是“墙”，mûr 带长音符，是“成熟的”。", [
        ("mur", "墙", "名词，没有长音符", "Il y a une photo sur le mur.", "墙上有一张照片。"),
        ("mûr", "成熟的", "形容词，带长音符", "Ce fruit est mûr.", "这个水果熟了。")]),
    ("tache-tache", H, "tâche / tache", "tâche 带长音符，是“任务”；tache 是“污渍”。", [
        ("tâche", "任务", "带长音符", "Cette tâche est difficile.", "这个任务很难。"),
        ("tache", "污渍", "没有长音符", "J'ai une tache sur ma chemise.", "我衬衫上有污渍。")]),
    ("peche-peche", H, "pêche / péché", "pêche 是“桃子 / 钓鱼”，péché 是“罪”。", [
        ("pêche", "桃子；钓鱼", "e 带长音符", "Elle mange une pêche.", "她在吃一个桃子。"),
        ("péché", "罪", "é 带锐音符", "Le mensonge est un péché.", "说谎是一种罪过。")]),
    ("foi-foie-fois", H, "foi / foie / fois", "信仰、肝脏、次数，三个词读音完全一样。", [
        ("foi", "信仰；信任", "阴性名词", "Il a perdu la foi.", "他失去了信仰。"),
        ("foie", "肝脏", "身体器官", "Le foie gras est cher.", "鹅肝很贵。"),
        ("fois", "次", "表示次数", "Je viens une fois par mois.", "我每月来一次。")]),
    ("mer-mere-maire", H, "mer / mère / maire", "海、母亲、市长，读音一样。", [
        ("mer", "海", "阴性名词", "Nous allons à la mer.", "我们去海边。"),
        ("mère", "母亲", "带重音", "Ma mère est professeure.", "我妈妈是老师。"),
        ("maire", "市长", "与 mairie（市政厅）同源", "Le maire ouvre la fête.", "市长为节日揭幕。")]),
    ("vert-verre-ver", H, "vert / verre / ver", "绿色、杯子、虫子，读音一样。", [
        ("vert", "绿色的", "形容词", "Le feu est vert.", "绿灯亮了。"),
        ("verre", "杯子；玻璃", "双 r", "Je voudrais un verre d'eau.", "我想要一杯水。"),
        ("ver", "虫子", "名词，很短", "Il y a un ver dans la pomme.", "苹果里有条虫。")]),
    ("cou-coup-cout", H, "cou / coup / coût", "脖子、一击、成本，读音一样。", [
        ("cou", "脖子", "身体部位", "Elle porte une écharpe autour du cou.", "她脖子上围着围巾。"),
        ("coup", "一击；一下", "常见于 coup de + 名词", "Il a donné un coup de pied.", "他踢了一脚。"),
        ("coût", "成本", "带长音符，与 coûter（花费）同源", "Le coût de la vie augmente.", "生活成本在上涨。")]),
    ("plutot-plus-tot", H, "plutôt / plus tôt", "plutôt 是“相当、宁可”，plus tôt 是“更早”，分写。", [
        ("plutôt", "相当；宁可", "一个词", "Il fait plutôt froid ce matin.", "今天早上相当冷。"),
        ("plus tôt", "更早", "两个词，反义是 plus tard", "Je me lève plus tôt demain.", "我明天起得更早。")]),
    ("pret-pres", H, "prêt / près", "prêt 是“准备好的”，près 是“靠近”。", [
        ("prêt", "准备好的", "形容词，常接 à", "Es-tu prêt à partir ?", "你准备好出发了吗？"),
        ("près", "靠近", "副词，常接 de", "La gare est près d'ici.", "车站离这儿很近。")]),
    ("ca-sa", H, "ça / sa", "ça 是口语的“这、那”，sa 是“他的 / 她的”（阴性）。", [
        ("ça", "这；那（口语）", "能换成 cela", "Ça va bien ?", "还好吗？"),
        ("sa", "他的；她的（阴性）", "后接阴性名词", "Elle aime sa sœur.", "她爱她的姐妹。")]),
    ("cense-sense", H, "censé / sensé", "censé 是“理应”，sensé 是“明智的”。", [
        ("censé", "被认为应该……", "后接不定式", "Il est censé arriver à midi.", "他应该中午到。"),
        ("sensé", "明智的", "形容词，修饰名词", "C'est un conseil sensé.", "这是个明智的建议。")]),
    # ---- different words that are mixed up --------------------------------------------------------------------
    ("voir-regarder", M, "voir / regarder", "voir 是“看见”（自然入眼），regarder 是“看”（有意去看）。", [
        ("voir", "看见", "不一定有意", "Je vois un oiseau dans l'arbre.", "我看见树上有只鸟。", "vois"),
        ("regarder", "看；注视", "有意去看，集中注意力", "Je regarde un film.", "我在看电影。", "regarde")]),
    ("entendre-ecouter", M, "entendre / écouter", "entendre 是“听见”，écouter 是“专心听”。", [
        ("entendre", "听见", "声音自然进入耳朵", "J'entends du bruit.", "我听到有声音。", "entends"),
        ("écouter", "听；倾听", "有意去听", "J'écoute de la musique.", "我在听音乐。", "écoute")]),
    ("dire-parler", M, "dire / parler", "dire 后面接说的内容，parler 是“说话、说某种语言”。", [
        ("dire", "说；讲", "后接内容或从句", "Il dit la vérité.", "他说实话。", "dit"),
        ("parler", "说话；说（语言）", "后接语言或 de / à", "Elle parle trois langues.", "她会说三种语言。", "parle")]),
    ("savoir-connaitre", M, "savoir / connaître", "savoir 是“知道、会”，connaître 是“认识、熟悉”。", [
        ("savoir", "知道；会", "后接从句或不定式", "Je sais nager.", "我会游泳。", "sais"),
        ("connaître", "认识；熟悉", "后接人或地点", "Je connais Paris.", "我熟悉巴黎。", "connais")]),
    ("porter-mettre", M, "porter / mettre", "porter 是“穿着”的状态，mettre 是“穿上”的动作。", [
        ("porter", "穿着；携带", "表示状态", "Elle porte une robe rouge.", "她穿着一条红裙子。", "porte"),
        ("mettre", "穿上；放", "表示动作", "Je mets mon manteau.", "我穿上外套。", "mets")]),
    ("apporter-amener-emporter-emmener", M, "apporter / amener / emporter / emmener", "带来或带走，看对象是物还是人：物用 apporter / emporter，人用 amener / emmener。", [
        ("apporter", "带来（物）", "把物品带到这里", "Apporte du pain, s'il te plaît.", "请带点面包来。", "Apporte"),
        ("amener", "带来（人）", "把人带到这里", "J'amène mon frère à la fête.", "我带哥哥来参加聚会。", "amène"),
        ("emporter", "带走（物）", "把物品带离这里", "Emporte ton parapluie.", "带上你的伞。", "Emporte"),
        ("emmener", "带去（人）", "把人带离这里", "Il emmène les enfants à l'école.", "他送孩子们去学校。", "emmène")]),
    ("apprendre-etudier-enseigner", M, "apprendre / étudier / enseigner", "apprendre 是“学会”，étudier 是“研究、攻读”，enseigner 是“教”。", [
        ("apprendre", "学；学会", "强调掌握一项技能或知识", "J'apprends le français.", "我在学法语。", "apprends"),
        ("étudier", "学习；研究", "系统地钻研一个学科", "Il étudie la médecine.", "他学医。", "étudie"),
        ("enseigner", "教", "老师传授知识", "Elle enseigne les maths.", "她教数学。", "enseigne")]),
    ("emprunter-preter", M, "emprunter / prêter", "emprunter 是“借入”，prêter 是“借出”，中文都说“借”。", [
        ("emprunter", "借入（向别人借）", "我借来的", "J'emprunte un livre à la bibliothèque.", "我从图书馆借一本书。", "emprunte"),
        ("prêter", "借出（借给别人）", "我借出去的", "Je te prête mon vélo.", "我把自行车借给你。", "prête")]),
    ("retourner-rentrer-revenir", M, "retourner / rentrer / revenir", "retourner 是“回到去过的地方”，rentrer 是“回家”，revenir 是“回到说话人这里”。", [
        ("retourner", "回到（去过的地方）", "也有“翻转”的意思", "Il retourne à Lyon demain.", "他明天回里昂。", "retourne"),
        ("rentrer", "回家；回到住处", "回到出发点", "Je rentre à la maison à six heures.", "我六点回家。", "rentre"),
        ("revenir", "回来", "回到说话人所在处", "Reviens vite !", "快回来！", "Reviens")]),
    ("quitter-partir-laisser", M, "quitter / partir / laisser", "quitter 后接地点或人，partir 不带宾语，laisser 是“留下”。", [
        ("quitter", "离开；辞去", "必须有宾语", "Il quitte son travail.", "他辞去工作。", "quitte"),
        ("partir", "出发；离开", "不带宾语，常接 de / pour", "Nous partons demain matin.", "我们明天早上出发。", "partons"),
        ("laisser", "留下；让", "把东西留在某处", "Laisse ton sac ici.", "把包留在这儿。", "Laisse")]),
    ("fois-temps-heure", M, "fois / temps / heure", "fois 是“次”，temps 是“时间 / 天气”，heure 是“点钟 / 小时”。", [
        ("fois", "次", "数次数", "Je l'ai vu deux fois.", "我见过他两次。"),
        ("temps", "时间；天气", "一段时间，或指天气", "Je n'ai pas le temps.", "我没有时间。"),
        ("heure", "点钟；小时", "问几点用 Quelle heure", "Quelle heure est-il ?", "现在几点？")]),
    ("jour-journee", M, "jour / journée", "jour 是“天、日子”，journée 强调一整天的过程。", [
        ("jour", "天；日", "用来数天、说日期", "Quel jour sommes-nous ?", "今天星期几？"),
        ("journée", "一整天", "强调从早到晚的过程", "J'ai travaillé toute la journée.", "我工作了一整天。")]),
    ("an-annee", M, "an / année", "an 用来数年数，année 强调这一年的过程。", [
        ("an", "年（数量）", "前面常有数词", "Elle habite ici depuis un an.", "她在这儿住了一年。"),
        ("année", "年；年份", "强调这一年", "Bonne année !", "新年快乐！")]),
    ("bon-bien", M, "bon / bien", "bon 是形容词，修饰名词；bien 是副词，修饰动词。", [
        ("bon", "好的", "修饰名词", "C'est un bon livre.", "这是本好书。"),
        ("bien", "好；很好地", "修饰动词", "Il parle bien français.", "他法语说得好。")]),
    ("mal-mauvais", M, "mal / mauvais", "mauvais 是形容词（坏的），mal 是副词（不好地）。", [
        ("mauvais", "坏的；不好的", "修饰名词，il fait mauvais 说天气", "Il fait mauvais temps.", "天气不好。"),
        ("mal", "不好地；疼痛", "修饰动词", "Elle dort mal.", "她睡不好。")]),
    ("tres-beaucoup", M, "très / beaucoup", "très 修饰形容词和副词，beaucoup 修饰动词和名词。", [
        ("très", "很", "放在形容词前", "Il est très fatigué.", "他很累。"),
        ("beaucoup", "很多；非常", "修饰动词，或接 de + 名词", "Elle travaille beaucoup.", "她工作很多。")]),
    ("bibliotheque-librairie", M, "bibliothèque / librairie", "bibliothèque 是图书馆，librairie 是书店，别和英语 library 搞混。", [
        ("bibliothèque", "图书馆", "借书的地方", "Je lis à la bibliothèque.", "我在图书馆看书。"),
        ("librairie", "书店", "买书的地方", "J'achète un roman à la librairie.", "我在书店买小说。")]),
    ("actuellement-en-fait", M, "actuellement / en fait", "actuellement 是“目前”，不是英语 actually；“其实”是 en fait。", [
        ("actuellement", "目前；现在", "不是 actually", "Il habite actuellement à Lyon.", "他目前住在里昂。"),
        ("en fait", "其实；事实上", "相当于英语 actually", "En fait, je n'ai pas faim.", "其实我不饿。", "En fait")]),
    ("assister-aider", M, "assister / aider", "assister à 是“出席”，aider 才是“帮助”。", [
        ("assister", "出席；观看", "后接 à + 活动", "Je veux assister à ce concert.", "我想去听这场音乐会。"),
        ("aider", "帮助", "后接人", "Peux-tu m'aider ?", "你能帮我吗？")]),
]

G += [
    # ---- more sound-alike words ---------------------------------------------------------------------------------
    ("quel-quelle-quelle", H, "quel / quelle / qu'elle", "quel 配阳性名词，quelle 配阴性名词，qu'elle 是 que + elle。", [
        ("quel", "什么；哪个（阳性）", "疑问或感叹，修饰阳性名词", "Quel âge as-tu ?", "你多大了？"),
        ("quelle", "什么；哪个（阴性）", "修饰阴性名词", "Quelle heure est-il ?", "现在几点？"),
        ("qu'elle", "que + elle", "连词 que 后接 elle", "Je pense qu'elle viendra.", "我觉得她会来。")]),
    ("leur-leurs", H, "leur / leurs", "leur 后接单数名词，leurs 后接复数名词。", [
        ("leur", "他们的（单数名词）", "后面是一个东西", "Ils aiment leur maison.", "他们喜欢他们的房子。"),
        ("leurs", "他们的（复数名词）", "后面是多个东西", "Ils aiment leurs enfants.", "他们爱他们的孩子。")]),
    ("tout-tous", H, "tout / tous", "tout 用于阳性单数，tous 用于阳性复数。", [
        ("tout", "全部；所有（单数）", "后接单数名词", "Tout le monde est là.", "大家都在。"),
        ("tous", "所有（阳性复数）", "后接复数名词，s 在代词用法里要发音", "Tous les jours, il court.", "他每天都跑步。")]),
    ("tes-tes", H, "tes / t'es", "tes 是“你的”（复数），t'es 是口语里的 tu es。", [
        ("tes", "你的（复数）", "后接复数名词", "Où sont tes clés ?", "你的钥匙在哪儿？"),
        ("t'es", "你是（口语 tu es）", "只用于口语，书面要写 tu es", "T'es sûr ?", "你确定吗？")]),
    ("ma-ma", H, "ma / m'a", "ma 是“我的”（阴性），m'a 是 me + a（对我做了……）。", [
        ("ma", "我的（阴性）", "后接阴性名词", "Ma sœur habite à Lyon.", "我姐姐住在里昂。"),
        ("m'a", "me + a", "后接过去分词，能换成 m'avait", "Il m'a aidé hier.", "他昨天帮了我。")]),
    ("si-sy", H, "si / s'y", "si 是“如果”，s'y 是 se + y（在那里……）。", [
        ("si", "如果；是否", "引出条件", "Si tu veux, on sort.", "如果你愿意，我们出去。"),
        ("s'y", "se + y", "反身动词里的 y", "Il s'y habitue vite.", "他很快就习惯了。")]),
    ("dont-donc", H, "dont / donc", "dont 是关系代词（……的），donc 是“所以”。", [
        ("dont", "关系代词：……的；其中", "代替 de + 名词", "Voici le livre dont je parle.", "这就是我说的那本书。"),
        ("donc", "所以；因此", "表示结果，能换成 alors", "Il pleut, donc je reste.", "下雨了，所以我留下。")]),
    ("voix-voie-voit", H, "voix / voie / voit", "声音、道路、看见，读音一样。", [
        ("voix", "声音", "阴性名词，复数 voix", "Elle a une belle voix.", "她嗓音很美。"),
        ("voie", "道路；轨道", "阴性名词，如 voie ferrée", "Le train est sur la voie 3.", "火车在三号轨道。"),
        ("voit", "看见（voir 的变位）", "il / elle 做主语", "Il voit un chat.", "他看见一只猫。", None, "voir")]),
    ("pain-peint-pin", H, "pain / peint / pin", "面包、画过（peindre）、松树，读音一样。", [
        ("pain", "面包", "阳性名词", "Je mange du pain.", "我吃面包。"),
        ("peint", "画（peindre 的过去分词）", "动词形式", "Il a peint le mur.", "他粉刷了墙。", None, "peindre"),
        ("pin", "松树", "树名", "Le pin est un arbre.", "松树是一种树。")]),
    ("chair-cher", H, "chair / cher", "chair 是“肉”，cher 是“贵的、亲爱的”。", [
        ("chair", "肉；肌肤", "阴性名词", "J'ai la chair de poule.", "我起鸡皮疙瘩了。"),
        ("cher", "贵的；亲爱的", "形容词", "C'est trop cher.", "这太贵了。")]),
    ("saut-seau-sot", H, "saut / seau / sot", "跳跃、水桶、傻的，读音一样。", [
        ("saut", "跳；跳跃", "阳性名词", "Il fait un saut en hauteur.", "他跳高。"),
        ("seau", "水桶", "阳性名词，复数 seaux", "Un seau d'eau.", "一桶水。"),
        ("sot", "傻的；蠢的", "形容词", "Il n'est pas sot.", "他不傻。")]),
    ("mot-maux", H, "mot / maux", "mot 是“词”，maux 是 mal（疼痛）的复数。", [
        ("mot", "词；字", "阳性名词", "Quel est ce mot ?", "这是什么词？"),
        ("maux", "疼痛；弊病（mal 的复数）", "常见于 maux de tête", "Elle a des maux de tête.", "她经常头疼。")]),
    ("ancre-encre", H, "ancre / encre", "ancre 是“锚”，encre 是“墨水”。", [
        ("ancre", "锚", "船上用的", "L'ancre du bateau est lourde.", "船的锚很重。"),
        ("encre", "墨水", "写字用的", "L'encre est bleue.", "墨水是蓝色的。")]),
    ("cygne-signe", H, "cygne / signe", "cygne 是“天鹅”，signe 是“记号、示意”。", [
        ("cygne", "天鹅", "gn 前有 y", "Un cygne nage sur le lac.", "一只天鹅在湖上游。"),
        ("signe", "记号；手势", "faire signe：示意", "Il me fait signe.", "他向我示意。")]),
    ("temps-tant-tend", H, "temps / tant / tend", "时间或天气、那么多、伸出，读音一样。", [
        ("temps", "时间；天气", "阳性名词", "Quel temps fait-il ?", "天气怎么样？"),
        ("tant", "那么多；这么", "副词，后接 de", "Il y a tant de monde.", "人那么多。"),
        ("tend", "伸出（tendre 的变位）", "il / elle 做主语", "Il tend la main.", "他伸出手。", None, "tendre")]),
    ("pate-patte-pate", H, "pâte / patte / pâté", "面团、爪子、肉酱，拼写只差一点。", [
        ("pâte", "面团；糊", "带长音符，阴性", "La pâte est prête.", "面团好了。"),
        ("patte", "（动物的）爪子", "双 t", "Le chat a mal à la patte.", "猫的爪子疼。"),
        ("pâté", "肉酱；肉糜", "带长音符，é 结尾", "J'aime le pâté de campagne.", "我喜欢乡村肉酱。")]),
    ("cote-cote", H, "côté / côte", "côté 是“旁边”，côte 是“海岸、肋骨”。", [
        ("côté", "旁边；一侧", "à côté de：在……旁边", "Il habite à côté de la gare.", "他住在车站旁边。"),
        ("côte", "海岸；肋骨", "没有末尾的 é", "La côte bretonne est belle.", "布列塔尼海岸很美。")]),
    ("sale-salle", H, "sale / salle", "sale 是“脏的”，salle 是“房间、厅”，双 l。", [
        ("sale", "脏的", "形容词", "Ma chemise est sale.", "我的衬衫脏了。"),
        ("salle", "厅；房间", "阴性名词，如 salle de bains", "La salle est grande.", "这个厅很大。")]),
    ("fin-faim", H, "fin / faim", "fin 是“结束”，faim 是“饥饿”。", [
        ("fin", "结束；末尾", "阴性名词", "À la fin du film, elle pleure.", "电影结束时她哭了。"),
        ("faim", "饥饿", "avoir faim：饿", "J'ai très faim.", "我很饿。")]),
    ("peau-pot", H, "peau / pot", "peau 是“皮肤”，pot 是“罐子”。", [
        ("peau", "皮肤；皮", "阴性名词", "Elle a la peau douce.", "她皮肤柔滑。"),
        ("pot", "罐；壶", "阳性名词", "Un pot de confiture.", "一罐果酱。")]),
    ("lait-laid", H, "lait / laid", "lait 是“牛奶”，laid 是“丑的”。", [
        ("lait", "牛奶", "阳性名词", "Je bois du lait.", "我喝牛奶。"),
        ("laid", "丑的", "形容词，反义词 beau", "Ce tableau est laid.", "这幅画很丑。")]),
    ("doigt-doit", H, "doigt / doit", "doigt 是“手指”，doit 是 devoir 的变位。", [
        ("doigt", "手指", "阳性名词", "Elle a mal au doigt.", "她手指疼。"),
        ("doit", "应该；必须（devoir）", "il / elle 做主语", "Il doit partir tôt.", "他得早点走。", None, "devoir")]),
    ("conte-compte", H, "conte / compte", "conte 是“故事”，compte 是“账户、数”。", [
        ("conte", "故事；童话", "阳性名词", "Elle lit un conte de fées.", "她在读童话。"),
        ("compte", "账户；计数", "阳性名词", "Il a un compte en banque.", "他有一个银行账户。")]),
    ("parler-parle-parlez", H, "parler / parlé / parlez", "-er 是原形，-é 是过去分词，-ez 是 vous 的变位，读音相同。", [
        ("parler", "说话（原形）", "前面常是 pour、vouloir、aller 等", "Je veux parler à Paul.", "我想跟保罗说话。"),
        ("parlé", "说过（过去分词）", "前面有 avoir，能换成 fini", "Il a parlé hier.", "他昨天说过了。", None, "parler"),
        ("parlez", "你们说（vous 的变位）", "前面有 vous，能换成 prenez", "Vous parlez très vite.", "您说得很快。", None, "parler")]),
    ("manger-mange-mangez", H, "manger / mangé / mangez", "-er 是原形，-é 是过去分词，-ez 是命令式或 vous 的变位。", [
        ("manger", "吃（原形）", "前面是 aller、pouvoir 等", "Nous allons manger.", "我们要去吃饭了。"),
        ("mangé", "吃过（过去分词）", "前面有 avoir", "Il a mangé une pomme.", "他吃了一个苹果。", None, "manger"),
        ("mangez", "你们吃（命令式）", "对 vous 说话", "Mangez lentement.", "请慢慢吃。", None, "manger")]),
    # ---- more words that are mixed up ---------------------------------------------------------------------------
    ("rester-habiter-vivre", M, "rester / habiter / vivre", "rester 是“待着”，habiter 是“居住在某处”，vivre 是“生活、活着”。", [
        ("rester", "留；待着", "停留，不离开", "Je reste à la maison.", "我待在家里。", "reste"),
        ("habiter", "居住", "后接地点", "J'habite à Lyon.", "我住在里昂。", "habite"),
        ("vivre", "生活；活着", "强调生活状态，可接 de", "Elle vit à l'étranger.", "她生活在国外。", "vit")]),
    ("ouvrir-allumer", M, "ouvrir / allumer", "中文都说“开”：门窗用 ouvrir，灯和电器用 allumer。", [
        ("ouvrir", "打开（门、窗、盖子）", "有开口的东西", "Ouvre la fenêtre.", "把窗户打开。", "Ouvre"),
        ("allumer", "打开（灯、电器）；点燃", "通电或点火", "Allume la lumière.", "把灯打开。", "Allume")]),
    ("fermer-eteindre", M, "fermer / éteindre", "中文都说“关”：门窗用 fermer，灯和电器用 éteindre。", [
        ("fermer", "关上（门、窗）", "有开口的东西", "Ferme la porte.", "把门关上。", "Ferme"),
        ("éteindre", "关掉（灯、电器）；熄灭", "断电或灭火", "Éteins la télé.", "把电视关掉。", "Éteins")]),
    ("perdre-manquer-rater", M, "perdre / manquer / rater", "perdre 是“丢失”，manquer 是“想念、缺少”，rater 是“错过、没赶上”。", [
        ("perdre", "丢失；输", "东西不见了，或比赛输了", "J'ai perdu mes clés.", "我丢了钥匙。", "perdu"),
        ("manquer", "想念；缺少", "tu me manques：我想你", "Tu me manques.", "我想你。", "manques"),
        ("rater", "错过；没赶上；搞砸", "没赶上车、没考好", "J'ai raté le train.", "我没赶上火车。", "raté")]),
    ("penser-a-penser-de", M, "penser à / penser de", "penser à 是“想到、惦记”，penser de 是“对……的看法”。", [
        ("penser à", "想到；惦记", "想着某人或某事", "Je pense à toi.", "我想着你。", "pense à"),
        ("penser de", "对……有什么看法", "常用于问句", "Qu'est-ce que tu penses de ce film ?", "你觉得这部电影怎么样？", "penses de")]),
    ("aller-venir", M, "aller / venir", "aller 是离开说话人“去”，venir 是朝说话人“来”。", [
        ("aller", "去", "离开说话人所在处", "Je vais à Paris demain.", "我明天去巴黎。", "vais"),
        ("venir", "来", "朝说话人所在处", "Viens ici !", "到这儿来！", "Viens")]),
    ("attendre-entendre", M, "attendre / entendre", "attendre 是“等待”，entendre 是“听见”，拼写和发音都像。", [
        ("attendre", "等待", "等人或等车", "J'attends le bus.", "我在等公交。", "attends"),
        ("entendre", "听见", "声音入耳", "Je n'entends rien.", "我什么也听不见。", "entends")]),
    ("grand-gros-haut", M, "grand / gros / haut", "grand 是“大、高（个子）”，gros 是“粗、胖、厚”，haut 是“高（物体）”。", [
        ("grand", "大的；高的（人）", "人的个子，或大小", "Il est très grand.", "他个子很高。"),
        ("gros", "粗的；胖的；厚的", "体积大、厚实", "Un gros livre.", "一本厚书。"),
        ("haut", "高的（物体）", "建筑、墙、山的高度", "Un haut mur entoure le jardin.", "一堵高墙围着花园。")]),
    ("petit-court-bas", M, "petit / court / bas", "petit 是“小、矮”，court 是“短”，bas 是“低、矮（位置）”。", [
        ("petit", "小的；矮的", "大小，或个子", "Un petit chat dort.", "一只小猫在睡觉。"),
        ("court", "短的", "长度或时间短", "Le chemin le plus court passe par là.", "最短的路从那边走。"),
        ("bas", "低的；低声", "位置低，或声音小", "Parle plus bas, s'il te plaît.", "请小声一点。")]),
    ("vieux-ancien-age", M, "vieux / ancien / âgé", "vieux 是“旧、老”，ancien 是“从前的、古老的”，âgé 专指“年纪大”。", [
        ("vieux", "旧的；老的", "东西旧或人老", "Un vieux livre est sur la table.", "桌上有一本旧书。"),
        ("ancien", "从前的；古老的", "放在名词前常表示“前任”", "Mon ancien professeur est parti.", "我以前的老师走了。"),
        ("âgé", "年纪大的", "只用于人，比 vieux 委婉", "Mon grand-père est âgé.", "我爷爷年纪大了。")]),
    ("nouveau-neuf-recent", M, "nouveau / neuf / récent", "nouveau 是“新的（另一个）”，neuf 是“全新的”，récent 是“最近的”。", [
        ("nouveau", "新的（刚换的、另一个）", "放在名词前", "J'ai un nouveau téléphone.", "我换了新手机。"),
        ("neuf", "全新的（没用过）", "放在名词后", "Ce vélo est tout neuf.", "这辆自行车是全新的。"),
        ("récent", "最近的；近期的", "时间不久前", "C'est un film récent.", "这是一部近期的电影。")]),
    ("seul-seulement", M, "seul / seulement", "seul 是形容词（单独的），seulement 是副词（只有）。", [
        ("seul", "单独的；独自", "形容词，修饰人或名词", "Je vis seul.", "我独自生活。"),
        ("seulement", "只；仅仅", "副词，修饰数量", "Il y a seulement deux places.", "只有两个座位。")]),
    ("deja-encore-toujours", M, "déjà / encore / toujours", "déjà 是“已经”，encore 是“还、再”，toujours 是“总是、仍然”。", [
        ("déjà", "已经", "事情已发生", "Il est déjà parti.", "他已经走了。"),
        ("encore", "还；再", "pas encore：还没有", "Il n'est pas encore là.", "他还没来。"),
        ("toujours", "总是；仍然", "一直如此", "Il est toujours là.", "他一直在这儿。")]),
    ("depuis-pendant-il-y-a", M, "depuis / pendant / il y a", "depuis 是“自从”，pendant 是“持续了”，il y a 是“……以前”。", [
        ("depuis", "自……以来", "还在持续", "J'habite ici depuis deux ans.", "我在这儿住了两年了。"),
        ("pendant", "在……期间；持续", "已结束的一段时间", "J'ai travaillé pendant deux heures.", "我工作了两个小时。"),
        ("il y a", "……以前", "过去的时间点", "Il est parti il y a deux jours.", "他两天前走的。")]),
    ("avant-devant", M, "avant / devant", "avant 说时间“在……之前”，devant 说位置“在……前面”。", [
        ("avant", "在……之前（时间）", "时间先后", "Avant le dîner, je lis.", "晚饭前我看书。"),
        ("devant", "在……前面（位置）", "空间位置", "Il est devant la porte.", "他在门前。")]),
    ("dans-en", M, "dans / en", "dans 一小时 是“一小时以后”，en 一小时 是“用一小时完成”。", [
        ("dans", "在……之后；在……里面", "时间点：多久以后", "Je reviens dans une heure.", "我一小时后回来。"),
        ("en", "用（多长时间）；在", "完成所需时间", "Je fais ça en une heure.", "我一小时就做完这个。")]),
    ("peu-un-peu", M, "peu / un peu", "peu 是“几乎没有”，带否定意味；un peu 是“有一点”，带肯定意味。", [
        ("peu", "很少；几乎没有", "偏否定", "J'ai peu de temps.", "我几乎没时间。"),
        ("un peu", "一点；有些", "偏肯定", "J'ai un peu de temps.", "我有一点时间。")]),
    ("voyage-trajet-route", M, "voyage / trajet / route", "voyage 是“旅行”，trajet 是“一段路程”，route 是“道路”。", [
        ("voyage", "旅行", "整趟出行", "Bon voyage !", "旅途愉快！"),
        ("trajet", "路程；行程", "从甲地到乙地的一段", "Le trajet dure vingt minutes.", "路程要二十分钟。"),
        ("route", "道路；公路", "实体的路", "La route est longue.", "路很长。")]),
    ("travail-emploi-metier", M, "travail / emploi / métier", "travail 是“工作（活）”，emploi 是“岗位”，métier 是“职业、行当”。", [
        ("travail", "工作；劳动", "做的事，或工作本身", "Le travail commence à neuf heures.", "工作九点开始。"),
        ("emploi", "职位；岗位", "找工作、有工作", "Elle cherche un emploi.", "她在找工作。"),
        ("métier", "职业；行当", "问 Quel est ton métier ?", "Quel est ton métier ?", "你是做什么职业的？")]),
    ("sensible-raisonnable", M, "sensible / raisonnable", "sensible 是“敏感的”，不是英语 sensible；“理智的”是 raisonnable。", [
        ("sensible", "敏感的；易受影响的", "不是 sensible（明智）", "Il est très sensible.", "他非常敏感。"),
        ("raisonnable", "理智的；合理的", "相当于英语 sensible", "Sois raisonnable !", "要懂事点！")]),
    ("eventuellement-finalement", M, "éventuellement / finalement", "éventuellement 是“可能的话”，不是 eventually；“最终”是 finalement。", [
        ("éventuellement", "可能的话；或许", "不是 eventually", "Tu peux éventuellement venir demain.", "你可以的话明天来也行。"),
        ("finalement", "最后；终于", "相当于英语 eventually", "Finalement, il est parti.", "最后他还是走了。")]),
]


def main():
    groups = []
    for gid, kind, title, zh, items in G:
        its = []
        for t in items:
            w, zhw, rule, fr, zhe = t[:5]
            form = t[5] if len(t) > 5 else None
            lemma = t[6] if len(t) > 6 else None
            it = {"w": w, "zh": zhw, "rule": rule, "ex": {"fr": fr, "zh": zhe}}
            if form:
                it["form"] = form
            if lemma:
                it["lemma"] = lemma
            its.append(it)
        groups.append({"id": gid, "kind": kind, "title": title, "zh": zh, "items": its})
    json.dump({"version": 1, "groups": groups}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    open(OUT, "a").write("\n")
    print(f"{len(groups)} groups, {sum(len(g['items']) for g in groups)} items → data/confusables.json")


main()
