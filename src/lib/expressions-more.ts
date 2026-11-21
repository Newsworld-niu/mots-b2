/* 表达 data: topic collocations, register pairs (语域) and formal-letter formulas (written for this site, 待核对).
 * Format: see expressions.ts. A collocation names a TOPICS vocabulary line (exam.ts) and takes its Chinese from there. */
import type { RawExpr } from "./expressions";

/** By TOPICS id: [vocabulary line as in TOPICS, example with gap, Chinese of the example]. */
export const COLLOCATIONS: [topic: string, [fr: string, ex: string, exZh: string][]][] = [
  ["environnement", [
    ["réduire les émissions de gaz à effet de serre", "Chaque pays doit [réduire les émissions de gaz à effet de serre].", "每个国家都必须减少温室气体排放。"],
    ["les énergies renouvelables", "La région investit dans [les énergies renouvelables].", "这个地区投资可再生能源。"],
    ["le tri des déchets", "[Le tri des déchets] est obligatoire dans notre immeuble.", "我们楼里垃圾分类是强制的。"],
    ["préserver la biodiversité", "Ces zones protégées servent à [préserver la biodiversité].", "这些保护区用来保护生物多样性。"],
    ["prendre conscience de", "Il faut [prendre conscience de] l'urgence climatique.", "必须意识到气候问题的紧迫。"],
  ]],
  ["travail", [
    ["concilier vie professionnelle et vie privée", "Il n'est pas facile de [concilier vie professionnelle et vie privée].", "兼顾工作和生活并不容易。"],
    ["postuler à un emploi", "Pour [postuler à un emploi], il faut un CV à jour.", "应聘一份工作需要一份最新的简历。"],
    ["les conditions de travail", "Les infirmières réclament de meilleures [conditions de travail].", "护士们要求更好的工作条件。"],
    ["se reconvertir", "À quarante ans, elle a décidé de [se reconvertir] dans l'enseignement.", "四十岁时，她决定转行去教书。"],
  ]],
  ["education", [
    ["l'égalité des chances", "L'école publique doit garantir [l'égalité des chances].", "公立学校应保障机会均等。"],
    ["acquérir des compétences", "Un stage permet d'[acquérir des compétences] concrètes.", "实习能让人获得实际的能力。"],
    ["l'esprit critique", "Il faut développer [l'esprit critique] des élèves.", "必须培养学生的批判性思维。"],
    ["apprendre tout au long de la vie", "Aujourd'hui, il faut [apprendre tout au long de la vie].", "如今，人需要终身学习。"],
  ]],
  ["numerique", [
    ["les réseaux sociaux", "Les adolescents passent des heures sur [les réseaux sociaux].", "青少年在社交网络上花好几个小时。"],
    ["protéger ses données personnelles", "Il est important de [protéger ses données personnelles] en ligne.", "在网上保护个人数据很重要。"],
    ["vérifier ses sources", "Un bon journaliste doit toujours [vérifier ses sources].", "一个好记者必须总是核实信息来源。"],
    ["la fracture numérique", "Les personnes âgées sont souvent victimes de [la fracture numérique].", "老年人常常是数字鸿沟的受害者。"],
  ]],
  ["sante", [
    ["une alimentation équilibrée", "Les médecins conseillent [une alimentation équilibrée].", "医生建议均衡饮食。"],
    ["pratiquer une activité physique", "Il est recommandé de [pratiquer une activité physique] chaque jour.", "建议每天进行体育活动。"],
    ["la santé mentale", "Le confinement a eu des effets sur [la santé mentale] des étudiants.", "封控对学生的心理健康产生了影响。"],
    ["l'accès aux soins", "Dans les campagnes, [l'accès aux soins] devient difficile.", "在乡村，看病越来越难。"],
  ]],
  ["societe", [
    ["le vieillissement de la population", "[Le vieillissement de la population] pose la question des retraites.", "人口老龄化带来了养老金问题。"],
    ["les inégalités sociales", "La crise a aggravé [les inégalités sociales].", "危机加剧了社会不平等。"],
    ["le pouvoir d'achat", "La hausse des prix réduit [le pouvoir d'achat] des ménages.", "物价上涨降低了家庭的购买力。"],
    ["la solidarité entre les générations", "Ce projet de logement favorise [la solidarité entre les générations].", "这个住房项目促进代际互助。"],
  ]],
  ["consommation", [
    ["acheter d'occasion", "De plus en plus de gens préfèrent [acheter d'occasion].", "越来越多的人更愿意买二手货。"],
    ["un achat impulsif", "Ce sac était [un achat impulsif] : je ne l'ai jamais porté.", "这个包是冲动消费：我从来没背过。"],
    ["l'obsolescence programmée", "[L'obsolescence programmée] nous oblige à remplacer nos appareils trop souvent.", "计划性报废迫使我们过于频繁地更换设备。"],
    ["le commerce équitable", "Ce café est issu du [commerce équitable].", "这种咖啡来自公平贸易。"],
  ]],
  ["culture", [
    ["le tourisme de masse", "Venise souffre du [tourisme de masse].", "威尼斯饱受大众旅游之苦。"],
    ["le patrimoine", "La commune restaure [le patrimoine] de la région.", "市镇在修复当地的文化遗产。"],
    ["s'ouvrir à d'autres cultures", "Voyager permet de [s'ouvrir à d'autres cultures].", "旅行让人向其他文化开放。"],
    ["la qualité de vie", "Les espaces verts améliorent [la qualité de vie] en ville.", "绿地提高了城市的生活质量。"],
  ]],
];

/** Register: the cue is the familiar or everyday wording, the gap wants the one for formal writing. */
export const REGISTERS: [fn: string, RawExpr[]][] = [
  ["语域 · 词汇", [
    ["travailler", "工作（动词）", "Mon père [travaille] dans une grande entreprise.", "我父亲在一家大公司工作。", { reg: { familier: "bosser", courant: "travailler", soutenu: "œuvrer" } }],
    ["un emploi", "工作、职位", "Mon fils cherche [un emploi] depuis six mois.", "我儿子找工作找了六个月。", { alt: ["un travail"], reg: { familier: "un boulot", courant: "un travail", soutenu: "un emploi" } }],
    ["un véhicule", "车辆", "Votre [véhicule] est mal stationné.", "您的车停得不对。", { alt: ["voiture"], reg: { familier: "une bagnole", courant: "une voiture", soutenu: "un véhicule" } }],
    ["un ouvrage", "书、著作", "Cet [ouvrage] retrace l'histoire de la ville.", "这本书追溯了这座城市的历史。", { reg: { familier: "un bouquin", courant: "un livre", soutenu: "un ouvrage" } }],
    ["l'alimentation", "饮食", "[L'alimentation] des enfants doit être équilibrée.", "孩子的饮食必须均衡。", { alt: ["la nourriture"], reg: { familier: "la bouffe", courant: "la nourriture", soutenu: "l'alimentation" } }],
    ["fastidieux", "枯燥乏味的", "Cette tâche est longue et [fastidieuse].", "这项任务又长又枯燥。", { alt: ["ennuyeuse"], note: "这里是阴性：fastidieuse", reg: { familier: "barbant", courant: "ennuyeux", soutenu: "fastidieux" } }],
    ["dérober", "偷", "On lui a [dérobé] son portefeuille dans le métro.", "有人在地铁里偷了他的钱包。", { alt: ["volé"], reg: { familier: "piquer", courant: "voler", soutenu: "dérober" } }],
    ["comprendre", "理解", "Je ne [comprends] pas les raisons de votre refus.", "我不理解您拒绝的理由。", { alt: ["saisis"], reg: { familier: "piger", courant: "comprendre", soutenu: "saisir" } }],
    ["un élément", "（一个）因素、事情", "Plusieurs [éléments] montrent que la situation s'améliore.", "好几个因素表明情况在好转。", { reg: { familier: "un truc", courant: "une chose", soutenu: "un élément" } }],
    ["échouer", "失败、没通过", "Il a [échoué] à son examen de conduite.", "他驾照考试没通过。", { reg: { familier: "se planter", courant: "rater", soutenu: "échouer" } }],
  ]],
  ["语域 · 说法", [
    ["un grand nombre de", "许多", "[Un grand nombre de] citoyens ont signé la pétition.", "许多公民在请愿书上签了名。", { alt: ["beaucoup de"], reg: { familier: "plein de", courant: "beaucoup de", soutenu: "un grand nombre de" } }],
    ["il existe", "有、存在", "[Il existe] plusieurs moyens de réduire sa consommation d'énergie.", "有好几种办法减少能源消耗。", { alt: ["il y a"], reg: { familier: "y a", courant: "il y a", soutenu: "il existe" } }],
    ["en avoir assez", "受够了", "Les habitants [en ont assez] du bruit des travaux.", "居民们受够了施工的噪音。", { alt: ["sont las"], reg: { familier: "en avoir marre", courant: "en avoir assez", soutenu: "être las de" } }],
    ["craindre", "担心、害怕", "Nous [craignons] que le projet soit abandonné.", "我们担心项目会被放弃。", { alt: ["avons peur"], note: "+ que + 虚拟式", reg: { familier: "avoir la trouille", courant: "avoir peur", soutenu: "craindre" } }],
  ]],
  ["语域 · 语法", [
    ["Pourriez-vous", "能否请您（倒装问句）", "[Pourriez-vous] m'envoyer le formulaire d'inscription ?", "能否请您把报名表发给我？", { alt: ["pouvez-vous"], reg: { familier: "Tu peux… ?", courant: "Est-ce que vous pouvez… ?", soutenu: "Pourriez-vous… ?" } }],
    ["ne … pas", "否定要写 ne", "Je [ne sais pas] encore si je pourrai venir.", "我还不知道能不能来。", { reg: { familier: "je sais pas", courant: "je ne sais pas", soutenu: "j'ignore" } }],
    ["cela", "这、那（代词）", "[Cela] me semble injuste.", "这在我看来不公平。", { reg: { familier: "ça", soutenu: "cela" } }],
    ["nous", "我们（主语）", "[Nous] vous remercions de votre réponse rapide.", "我们感谢您的及时回复。", { reg: { familier: "on", soutenu: "nous" } }],
  ]],
];

/** Formal letters, in the order of a letter: salutation, opening, body, closing. */
export const LETTER: [fn: string, RawExpr[]][] = [
  ["称呼", [
    ["Madame, Monsieur,", "女士、先生（不知收信人时）", "[Madame, Monsieur], je me permets de vous écrire au sujet de votre annonce.", "女士/先生：我冒昧写信给您，是关于您的广告。", { alt: ["Madame Monsieur"] }],
    ["Monsieur le Directeur,", "主任/校长先生（知道职位）", "[Monsieur le Directeur], j'ai l'honneur de solliciter un entretien.", "主任先生：我谨请求一次面谈。", { note: "女性：Madame la Directrice" }],
  ]],
  ["开头", [
    ["je me permets de vous écrire", "冒昧给您写信", "[Je me permets de vous écrire] au sujet de la facture du mois de mars.", "我冒昧写信给您，是关于三月份的账单。"],
    ["à la suite de", "继……之后", "[À la suite de] notre conversation téléphonique, je vous envoie mon dossier.", "继我们的电话交谈之后，我把材料发给您。", { alt: ["suite à"], note: "suite à 很常见，但 à la suite de 更规范" }],
    ["j'ai pris connaissance de", "我已获悉", "[J'ai pris connaissance de] votre offre d'emploi sur votre site.", "我在贵网站上看到了贵公司的招聘启事。"],
    ["en réponse à", "回复", "[En réponse à] votre courrier du 3 mai, je vous informe que le dossier est complet.", "回复您 5 月 3 日的来信：我通知您材料已齐全。"],
  ]],
  ["请求", [
    ["je vous serais reconnaissant de bien vouloir", "如蒙……不胜感激", "[Je vous serais reconnaissant de bien vouloir] me renvoyer le formulaire signé.", "如蒙寄回签好字的表格，不胜感激。", { note: "+ 不定式；女性写 reconnaissante", alt: ["je vous serais reconnaissante de bien vouloir"] }],
    ["je vous prie de bien vouloir", "请您", "[Je vous prie de bien vouloir] m'envoyer une confirmation écrite.", "请您给我发一份书面确认。", { note: "+ 不定式" }],
    ["je souhaiterais obtenir", "我希望得到", "[Je souhaiterais obtenir] des renseignements sur vos cours du soir.", "我希望了解贵校夜校课程的信息。"],
  ]],
  ["投诉", [
    ["je tiens à vous faire part de mon mécontentement", "我想向您表达我的不满", "[Je tiens à vous faire part de mon mécontentement] concernant votre service de livraison.", "我想就贵公司的送货服务向您表达我的不满。"],
    ["procéder au remboursement", "办理退款", "Je vous demande de [procéder au remboursement] de cet article défectueux.", "我要求您为这件有缺陷的商品办理退款。"],
    ["sans réponse de votre part", "若您不予回复", "[Sans réponse de votre part] sous quinze jours, je contacterai une association de consommateurs.", "若您十五天内不予回复，我将联系消费者协会。"],
  ]],
  ["申请", [
    ["poser ma candidature", "提出申请、应聘", "Je souhaite [poser ma candidature] au poste d'assistant commercial.", "我想应聘商务助理一职。", { alt: ["présenter ma candidature"] }],
    ["vous trouverez ci-joint", "随信附上", "[Vous trouverez ci-joint] mon curriculum vitae.", "随信附上我的简历。"],
    ["je reste à votre disposition", "我随时听候您的安排", "[Je reste à votre disposition] pour un éventuel entretien.", "如需面试，我随时听候您的安排。"],
  ]],
  ["结尾", [
    ["dans l'attente de votre réponse", "期待您的回复", "[Dans l'attente de votre réponse], je vous prie d'agréer mes salutations distinguées.", "期待您的回复，此致敬礼。"],
    ["en vous remerciant par avance", "预先感谢", "[En vous remerciant par avance] de votre aide, je vous adresse mes salutations distinguées.", "预先感谢您的帮助，此致敬礼。", { alt: ["en vous remerciant d'avance"] }],
    ["veuillez agréer", "请接受（结尾敬语）", "[Veuillez agréer], Madame, Monsieur, l'expression de mes salutations distinguées.", "女士/先生，请接受我诚挚的敬意。"],
    ["l'expression de mes salutations distinguées", "（我的）敬意", "Je vous prie d'agréer, Madame, Monsieur, [l'expression de mes salutations distinguées].", "女士/先生，请接受我诚挚的敬意。", { note: "正式信函结尾的固定写法" }],
    ["cordialement", "顺致问候（邮件）", "Merci pour votre retour rapide. [Cordialement], Léa Martin", "感谢您的及时回复。顺致问候，莱娅·马丁", { note: "邮件、半正式" }],
  ]],
];
