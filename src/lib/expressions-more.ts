/* 表达 data: topic collocations, register pairs (语域), formal-letter formulas and reformulations (written for this
 * site). Format: see expressions.ts. A collocation names a TOPICS vocabulary line (exam.ts) and takes its Chinese from
 * there. In a reformulation card, the plainer wording of `reformFrom` is never an accepted answer: the gap asks for
 * the upgrade. */
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
    ["s'ouvrir à d'autres cultures", "Voyager permet de [s'ouvrir à d'autres cultures].", "旅行让人向其他文化敞开心扉。"],
    ["la qualité de vie", "Les espaces verts améliorent [la qualité de vie] en ville.", "绿地提高了城市的生活质量。"],
  ]],
  ["politique-justice", [
    ["l'État de droit", "Une justice indépendante est le pilier de [l'État de droit].", "独立的司法是法治国家的支柱。"],
    ["la démocratie participative", "Le budget citoyen renforce [la démocratie participative] au niveau local.", "公民预算加强了地方层面的参与式民主。"],
  ]],
  ["sciences-ethique", [
    ["encadrer l'intelligence artificielle", "La loi doit [encadrer l'intelligence artificielle] pour éviter les dérives.", "法律必须规范人工智能以防失范。"],
    ["le principe de précaution", "En matière de santé publique, il convient d'appliquer [le principe de précaution].", "在公共卫生领域应当遵循预防原则。"],
  ]],
  ["medias-presse", [
    ["le pluralisme des médias", "Une presse libre repose sur [le pluralisme des médias].", "新闻自由建立在媒体多元化的基础之上。"],
    ["lutter contre la manipulation de l'information", "Les rédactions investissent pour [lutter contre la manipulation de l'information].", "各大编辑部投入资源打击信息操纵。"],
  ]],
  ["logement-urbanisme", [
    ["encadrer les loyers", "Plusieurs métropoles choisissent d'[encadrer les loyers] face à la crise.", "多个大都市在危机面前选择限制房租。"],
    ["la rénovation thermique des bâtiments", "L'État subventionne [la rénovation thermique des bâtiments] anciens.", "国家资助老旧建筑的节能保温改造。"],
  ]],
  ["economie-finances", [
    ["maîtriser l'inflation", "La banque centrale cherche à [maîtriser l'inflation] sans freiner l'emploi.", "央行力图在不拖累就业的情况下控制通胀。"],
    ["préserver l'État-providence", "Ce débat porte sur les moyens de [préserver l'État-providence].", "这场辩论围绕如何维护福利国家制度展开。"],
  ]],
  ["transports-mobilite", [
    ["les mobilités douces", "La mairie aménage des voies réservées pour encourager [les mobilités douces].", "市政府修建专用车道以鼓励慢行交通。"],
    ["désenclaver les zones rurales", "La réouverture de petites gares permet de [désenclaver les zones rurales].", "重开小型火车站有助于打破农村偏远地区的孤立。"],
  ]],
  ["arts-francophonie", [
    ["la diversité culturelle et linguistique", "L'UNESCO défend [la diversité culturelle et linguistique] face à l'uniformisation.", "联合国教科文组织在同质化浪潮下捍卫文化与语言多样性。"],
    ["l'exception culturelle", "La France défend depuis longtemps le principe de [l'exception culturelle].", "法国长期以来坚持“文化例外”原则。"],
  ]],
];

/**
 * Register: the cue is the familiar or everyday wording, the gap wants the one for formal writing. A correct
 * everyday (courant) wording is a near miss (`syn`), a formal one an accepted answer (`alt`).
 */
export const REGISTERS: [fn: string, RawExpr[]][] = [
  ["语域 · 词汇", [
    ["travailler", "工作（动词）", "Mon père [travaille] dans une grande entreprise.", "我父亲在一家大公司工作。", { reg: { familier: "bosser", courant: "travailler", soutenu: "œuvrer" } }],
    ["un emploi", "工作、职位", "Mon fils cherche [un emploi] depuis six mois.", "我儿子找工作找了六个月。", { syn: ["un travail"], reg: { familier: "un boulot", courant: "un travail", soutenu: "un emploi" } }],
    ["un véhicule", "车辆", "Votre [véhicule] est mal stationné.", "您的车停得不对。", { note: "voiture 是阴性，填它整句要改成 Votre voiture est mal stationnée", reg: { familier: "une bagnole", courant: "une voiture", soutenu: "un véhicule" } }],
    ["un ouvrage", "书、著作", "Cet [ouvrage] retrace l'histoire de la ville.", "这本书追溯了这座城市的历史。", { reg: { familier: "un bouquin", courant: "un livre", soutenu: "un ouvrage" } }],
    ["l'alimentation", "饮食", "[L'alimentation] des enfants doit être équilibrée.", "孩子的饮食必须均衡。", { syn: ["la nourriture"], reg: { familier: "la bouffe", courant: "la nourriture", soutenu: "l'alimentation" } }],
    ["fastidieux", "枯燥乏味的", "Cette tâche est longue et [fastidieuse].", "这项任务又长又枯燥。", { syn: ["ennuyeuse"], note: "这里是阴性：fastidieuse", reg: { familier: "barbant", courant: "ennuyeux", soutenu: "fastidieux" } }],
    ["dérober", "偷", "On lui a [dérobé] son portefeuille dans le métro.", "有人在地铁里偷了他的钱包。", { syn: ["volé"], reg: { familier: "piquer", courant: "voler", soutenu: "dérober" } }],
    ["comprendre", "理解", "Je ne [comprends] pas les raisons de votre refus.", "我不理解您拒绝的理由。", { alt: ["saisis"], reg: { familier: "piger", courant: "comprendre", soutenu: "saisir" } }],
    ["un élément", "（一个）因素、事情", "Plusieurs [éléments] montrent que la situation s'améliore.", "好几个因素表明情况在好转。", { reg: { familier: "un truc", courant: "une chose", soutenu: "un élément" } }],
    ["échouer", "失败、没通过", "Il a [échoué] à son examen de conduite.", "他驾照考试没通过。", { reg: { familier: "se planter", courant: "rater", soutenu: "échouer" } }],
  ]],
  ["语域 · 说法", [
    ["un grand nombre de", "许多", "[Un grand nombre de] citoyens ont signé la pétition.", "许多公民在请愿书上签了名。", { syn: ["beaucoup de"], reg: { familier: "plein de", courant: "beaucoup de", soutenu: "un grand nombre de" } }],
    ["il existe", "有、存在", "[Il existe] plusieurs moyens de réduire sa consommation d'énergie.", "有好几种办法减少能源消耗。", { syn: ["il y a"], reg: { familier: "y a", courant: "il y a", soutenu: "il existe" } }],
    ["en avoir assez", "受够了", "Les habitants [en ont assez] du bruit des travaux.", "居民们受够了施工的噪音。", { alt: ["sont las"], reg: { familier: "en avoir marre", courant: "en avoir assez", soutenu: "être las de" } }],
    ["craindre", "担心、害怕", "Nous [craignons] que le projet soit abandonné.", "我们担心项目会被放弃。", { syn: ["avons peur"], note: "+ que + 虚拟式", reg: { familier: "avoir la trouille", courant: "avoir peur", soutenu: "craindre" } }],
  ]],
  ["语域 · 语法", [
    ["Pourriez-vous", "能否请您（倒装问句）", "[Pourriez-vous] m'envoyer le formulaire d'inscription ?", "能否请您把报名表发给我？", { syn: ["pouvez-vous"], reg: { familier: "Tu peux… ?", courant: "Est-ce que vous pouvez… ?", soutenu: "Pourriez-vous… ?" } }],
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
    ["l'expression de mes salutations distinguées", "（我的）敬意", "Je vous prie d'agréer, Madame, Monsieur, [l'expression de mes salutations distinguées].", "女士/先生，请接受我诚挚的敬意。", { note: "正式信函结尾的固定写法；正式信函勿用 Cordialement" }],
  ]],
];

/** Reformulation cards (同义改写): turn A2/B1 phrasing into concise, idiomatic B2 French. */
export const REFORMULATIONS: [fn: string, RawExpr[]][] = [
  ["因果转写", [
    ["en raison de", "由于、因为（正式名词短语）", "Le train est supprimé [en raison d']un incident technique.", "由于技术故障，这趟列车取消了。", { note: "替换口语 à cause de（多用于中性或负面客观原因）；元音前省音：en raison d'un incident", syn: ["du fait d'"], reformFrom: "Le train est supprimé à cause d'un incident technique.", frDef: "Locution prépositive soutenue remplaçant « à cause de » + nom." }],
    ["étant donné que", "鉴于（句首从句连词）", "[Étant donné que] les ressources diminuent, il faut changer nos habitudes.", "鉴于资源正在减少，我们必须改变习惯。", { syn: ["puisque", "comme", "vu que"], note: "比 parce que 更书面，多置于句首", reformFrom: "Parce que les ressources diminuent, il faut changer nos habitudes.", frDef: "Conjonction formelle équivalente à « comme / puisque » en tête de phrase." }],
    ["c'est la raison pour laquelle", "正因如此", "Le loyer a doublé ; [c'est la raison pour laquelle] beaucoup quittent le centre.", "房租翻了一倍；正因如此，很多人搬离了市中心。", { syn: ["c'est pourquoi", "voilà pourquoi"], note: "替换单一的 donc，连接因果逻辑更自然", reformFrom: "Le loyer a doublé, donc beaucoup quittent le centre.", frDef: "Connecteur de conséquence élégant remplaçant « donc »." }],
    ["engendrer", "引发、造成（后果）", "Une urbanisation mal maîtrisée risque d'[engendrer] de fortes tensions sociales.", "失控的城市化可能会引发严重的社会矛盾。", { syn: ["provoquer", "entraîner", "susciter"], note: "比 créer / donner 更准确的 B2 动词", reformFrom: "Une urbanisation mal maîtrisée risque de créer de fortes tensions sociales.", frDef: "Verbe formel signifiant « provoquer, faire naître des conséquences »." }],
  ]],
  ["让步与对比", [
    ["bien que", "尽管（+ 虚拟式）", "[Bien que] cette mesure soit coûteuse, elle reste indispensable.", "尽管这项措施成本高昂，但它仍然不可或缺。", { alt: ["quoique"], note: "+ 虚拟式（soit / ait / fasse），替换 même si", reformFrom: "Même si cette mesure est coûteuse, elle reste indispensable.", frDef: "Conjonction de concession suivie du subjonctif (équivalent soutenu de « même si »)." }],
    ["à l'encontre de", "违背、与……相反", "Cette décision va [à l'encontre des] engagements climatiques du pays.", "这项决定违背了该国的气候承诺。", { note: "比 aller contre 更书面准确；de + les 缩合为 des：à l'encontre des engagements", reformFrom: "Cette décision va contre les engagements climatiques du pays.", frDef: "Locution prépositive formelle signifiant « en opposition directe avec »." }],
    ["en dépit de", "不顾、尽管（+ 名词）", "[En dépit de] ses promesses, la direction n'a pas réduit les horaires.", "尽管作出了承诺，管理层仍未缩短工时。", { note: "比 malgré 更正式，可直接 + 名词短语", reformFrom: "Malgré ses promesses, la direction n'a pas réduit les horaires.", frDef: "Préposition formelle synonyme de « malgré » (+ nom)." }],
    ["quant à", "至于（切换比较对象）", "Les jeunes privilégient le train ; [quant aux] entreprises, elles attendent des aides.", "年轻人更偏爱火车；至于企业，它们在等待补贴。", { note: "注意缩合：quant à + les → quant aux（quant au / quant à la / quant aux）", reformFrom: "Les jeunes privilégient le train, et pour les entreprises, elles attendent des aides.", frDef: "Préposition permettant d'introduire un contraste avec un second sujet." }],
  ]],
  ["限定与精确表述", [
    ["à moins que", "除非（+ ne 赘词 + 虚拟式）", "La réforme échouera, [à moins qu']on ne consulte les enseignants.", "除非征求教师意见，否则改革将失败。", { note: "替换 sauf si，后面须跟虚拟式（书面常加赘词 ne）；元音前省音：à moins qu'on", reformFrom: "La réforme échouera, sauf si on consulte les enseignants.", frDef: "Exprime une condition restrictive (+ subjonctif), équivalent formel de « sauf si »." }],
    ["autrement dit", "换言之、也就是说", "Le taux de participation a baissé ; [autrement dit], un électeur sur deux s'abstient.", "投票率下降了；换言之，每两名选民中就有一人弃权。", { syn: ["en d'autres termes"], note: "文章中解释前一句核心含义的高频表达（c'est-à-dire 后通常接 que 从句）", reformFrom: "Le taux de participation a baissé ; cela veut dire qu'un électeur sur deux s'abstient.", frDef: "Introduit une reformulation plus claire ou plus précise de l'idée précédente." }],
    ["ne … guère", "几乎不、并不怎么", "Cette campagne n'a [guère] modifié les habitudes des consommateurs.", "这场宣传活动几乎没有改变消费者的习惯。", { note: "书面语中替代 pas beaucoup / presque pas；ne 已在 n'a 里，空里只填 guère", reformFrom: "Cette campagne n'a pas beaucoup modifié les habitudes des consommateurs.", frDef: "Adverbe littéraire ou soutenu équivalant à « presque pas, très peu »." }],
    ["davantage", "更多、进一步（不接 que）", "Les pouvoirs publics devraient investir [davantage] dans la prévention.", "公共部门应当在预防领域投入更多。", { note: "替换口语里的 plus，后不直接跟 que 比较从句", reformFrom: "Les pouvoirs publics devraient investir plus dans la prévention.", frDef: "Adverbe de quantité soutenu synonyme de « plus » en fin de proposition." }],
  ]],
  ["B2 书面动词与句架升级", [
    ["pallier", "弥补、缓解（直接及物）", "Des cours gratuits permettent de [pallier] les lacunes de certains élèves.", "免费课程有助于弥补部分学生的知识缺口。", { syn: ["combler", "compenser"], note: "直接加宾语（绝不加 à）", reformFrom: "Des cours gratuits permettent de corriger un peu les manques de certains élèves.", frDef: "Verbe transitif direct signifiant « compenser un manque ou atténuer un défaut »." }],
    ["il s'avère indispensable de", "事实证明……必不可少", "[Il s'avère indispensable de] réguler l'usage des données biométriques.", "事实证明，规范生物识别数据的使用必不可少。", { syn: ["il est indispensable de", "il apparaît indispensable de"], note: "替代干瘪的 il faut，显著提升语域", reformFrom: "Il faut vraiment réguler l'usage des données biométriques.", frDef: "Tournure impersonnelle soutenue remplaçant « il faut absolument »." }],
    ["force est de constater que", "不得不承认／显而易见", "[Force est de constater que] le télétravail modifie durablement l'immobilier de bureau.", "不得不承认，远程办公正持久地改变写字楼市场。", { syn: ["on ne peut que constater que", "il faut bien reconnaître que"], note: "引出客观事实作论据的黄金开头", reformFrom: "Tout le monde voit bien que le télétravail modifie durablement l'immobilier de bureau.", frDef: "Expression formelle pour souligner un fait évident et incontestable." }],
    ["mettre en évidence", "凸显、揭示", "L'enquête permet de [mettre en évidence] le lien entre sommeil et réussite.", "该调查揭示了睡眠与学业成功之间的联系。", { syn: ["souligner", "mettre en lumière", "faire apparaître"], note: "报告与议论文高频转述动词", reformFrom: "L'enquête permet de montrer clairement le lien entre sommeil et réussite.", frDef: "Locution verbale signifiant « révéler ou faire apparaître clairement un fait »." }],
    ["en somme", "简而言之、总而言之", "[En somme], l'outil numérique n'est bénéfique que s'il reste maîtrisé.", "总而言之，数字工具只有处于可控之下才是有益的。", { syn: ["en résumé", "en définitive"], note: "比 bref 更适合 DELF B2 书面结尾段", reformFrom: "Pour résumer en bref, l'outil numérique n'est bénéfique que s'il reste maîtrisé.", frDef: "Connecteur de synthèse soutenu pour conclure un développement." }],
    ["à titre d'exemple", "举例而言", "[À titre d'exemple], plusieurs villes ont rendu les bus gratuits le week-end.", "举例而言，多个城市已推行周末公交免费。", { syn: ["à titre d'illustration"], note: "比反复写 par exemple 更高级", reformFrom: "Par exemple, plusieurs villes ont rendu les bus gratuits le week-end.", frDef: "Introduit un cas concret illustrant un argument (variante formelle de « par exemple »)." }],
  ]],
];
