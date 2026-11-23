/**
 * 篇章写作: the writing tasks (by genre), the scaffolding shown while writing (plan, connectors, letter formulas),
 * the fixed marking grid, and what a marked text looks like. The tasks and phrases are written for this site (待核对).
 */
import type { ErrorType } from "./writing";
import {
  applyEssayLengthCaps,
  capScoresByFlags,
  countWords,
  FORMAL_GENRES,
  genresFor,
  pushCap,
  toLevel,
  type EssayCorrection,
  type EssayFeedback,
  type EssayFlags,
  type EssayTask,
  type Genre,
  type ModelEssay,
  type SavedEssay,
} from "./essay-schema";
export * from "./essay-schema";

export const ESSAY_TASKS: EssayTask[] = [
  {
    id: "mail-invitation",
    level: "B1",
    genre: "mail",
    title: "回复朋友的邀请",
    situation: "法国朋友 Camille 邀请你下个月去她家乡过周末，但那个周末你去不了。",
    consigne: "Vous répondez à Camille : vous la remerciez, vous expliquez pourquoi vous ne pouvez pas venir et vous proposez une autre date.",
    words: [120, 160],
    points: ["感谢邀请", "说明不能去的原因", "提出另一个时间，并说说到时想做什么"],
    plan: [
      { zh: "称呼和感谢", fr: "Chère Camille, merci beaucoup pour ton invitation…" },
      { zh: "遗憾和原因", fr: "Malheureusement, je ne pourrai pas venir ce week-end-là, parce que…" },
      { zh: "提议", fr: "Est-ce qu'on pourrait se voir plutôt… ? On pourrait…" },
      { zh: "结尾", fr: "J'espère que ça te convient. Je t'embrasse." },
    ],
    phrases: [
      ["Ça me fait très plaisir que tu aies pensé à moi.", "你能想到我，我很高兴。"],
      ["Je suis vraiment désolé(e), mais…", "真的很抱歉，但是……"],
      ["Ça te dirait de… ?", "你想不想……？"],
      ["Tiens-moi au courant.", "有消息告诉我。"],
    ],
  },
  {
    id: "recit-voyage",
    level: "B1",
    genre: "recit",
    title: "一次难忘的旅行",
    situation: "一个法语学习网站征集读者的旅行故事。",
    consigne: "Racontez un voyage qui vous a marqué(e) : où, quand, avec qui, ce qui s'est passé et pourquoi vous vous en souvenez encore.",
    words: [160, 200],
    points: ["交代时间、地点、同行的人", "讲一件具体发生的事", "说出当时的感受和现在的想法"],
    plan: [
      { zh: "背景（未完成过去时）", fr: "C'était il y a deux ans. Nous étions…, il faisait…" },
      { zh: "事件（复合过去时）", fr: "Un jour, nous avons décidé de… Soudain,…" },
      { zh: "结果", fr: "Finalement,…" },
      { zh: "感受", fr: "Ce voyage m'a appris que… Je n'oublierai jamais…" },
    ],
    phrases: [
      ["À ce moment-là, je ne savais pas encore que…", "那时候我还不知道……"],
      ["Tout à coup, … / Peu après, … / Le lendemain, …", "突然……／不久之后……／第二天……"],
      ["J'ai été surpris(e) de voir que…", "看到……我很吃惊。"],
      ["Avec le recul, je me rends compte que…", "现在回头看，我意识到……"],
    ],
  },
  {
    id: "forum-teletravail",
    topic: "travail",
    level: "B1",
    genre: "forum",
    title: "在家办公好不好",
    situation: "论坛上有人问：在家办公是不是比去办公室好？",
    consigne: "Vous donnez votre avis sur le télétravail sur un forum : avantages, inconvénients et votre expérience personnelle.",
    words: [160, 200],
    points: ["表明自己的看法", "各说至少一个好处和坏处", "举一个自己或身边人的例子"],
    plan: [
      { zh: "表态", fr: "Personnellement, je trouve que…" },
      { zh: "好处", fr: "D'un côté, le télétravail permet de…" },
      { zh: "坏处", fr: "D'un autre côté, il est parfois difficile de…" },
      { zh: "例子和结论", fr: "Dans mon cas,… C'est pourquoi je pense que…" },
    ],
    phrases: [
      ["À mon avis, … / Selon moi, …", "在我看来……"],
      ["Ce qui me plaît, c'est (de)…", "我喜欢的是……"],
      ["Le problème, c'est que…", "问题在于……"],
      ["Tout dépend de…", "这完全取决于……"],
    ],
  },
  {
    id: "lettre-reclamation",
    topic: "consommation",
    level: "B2",
    genre: "lettre",
    title: "投诉信",
    situation: "你在网上订了一台洗衣机，送来晚了两个星期，而且门上有划痕。客服电话一直打不通。",
    consigne: "Vous écrivez au service clientèle du magasin pour exposer le problème, exprimer votre mécontentement et demander une solution précise.",
    words: [250, 350],
    points: ["说明订单和发生的问题（时间、事实）", "表达不满，但保持礼貌", "提出明确的要求（换货、退款或补偿）和期限"],
    plan: [
      { zh: "事由", fr: "Objet : réclamation concernant la commande n°…" },
      { zh: "陈述事实", fr: "J'ai commandé le… un lave-linge qui devait être livré le… Or,…" },
      { zh: "表达不满", fr: "Je tiens à vous faire part de mon mécontentement :…" },
      { zh: "提出要求", fr: "Je vous demande donc de bien vouloir… dans un délai de…" },
      { zh: "结尾套语", fr: "Dans l'attente de votre réponse, je vous prie d'agréer, Madame, Monsieur, mes salutations distinguées." },
    ],
    phrases: [
      ["Je me permets de vous écrire au sujet de…", "我冒昧来信是关于……"],
      ["Contrairement à ce qui était annoncé, …", "和事先说的相反……"],
      ["Malgré plusieurs appels, je n'ai pas pu joindre votre service.", "我打了好几次电话，都没能联系上贵部门。"],
      ["Sans réponse de votre part, je me verrai dans l'obligation de…", "若得不到答复，我将不得不……"],
    ],
  },
  {
    id: "lettre-motivation",
    topic: "travail",
    level: "B2",
    genre: "motivation",
    title: "求职信",
    situation: "里昂的一家旅行社招一名会中文的接待和咨询人员，合同六个月。",
    consigne: "Vous posez votre candidature : présentez-vous, montrez que votre profil correspond au poste et demandez un entretien.",
    words: [250, 350],
    points: ["说明应聘的职位和信息来源", "介绍和职位相关的学历、经历、能力", "说明自己能给公司带来什么，并请求面试"],
    plan: [
      { zh: "事由", fr: "Objet : candidature au poste de conseiller(ère) voyages" },
      { zh: "为什么写信", fr: "Votre annonce parue sur… a retenu toute mon attention." },
      { zh: "我是谁、做过什么", fr: "Titulaire d'un diplôme de…, j'ai travaillé pendant… en tant que…" },
      { zh: "我能带来什么", fr: "Ma connaissance du chinois et du français me permettrait de…" },
      { zh: "请求面试和结尾", fr: "Je me tiens à votre disposition pour un entretien. Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées." },
    ],
    phrases: [
      ["Je souhaite vous proposer ma candidature pour…", "我想应聘……"],
      ["Cette expérience m'a permis de développer…", "这段经历让我培养了……"],
      ["Rigoureux(se) et à l'aise avec le public, je…", "我做事严谨，善于和人打交道……"],
      ["Je serais heureux(se) de vous rencontrer afin de…", "我很希望能和您见面，以便……"],
    ],
  },
  {
    id: "courrier-voitures",
    topic: "transports-mobilite",
    level: "B2",
    genre: "courrier",
    title: "市中心禁止汽车通行",
    situation: "本地报纸报道，市政府打算禁止私家车进入市中心。报纸请读者来信发表意见。",
    consigne: "Vous écrivez au courrier des lecteurs du journal pour donner votre opinion sur ce projet, en l'appuyant sur des arguments et des exemples.",
    words: [250, 350],
    points: ["提到那篇报道，表明立场", "两到三个论据，各带例子", "承认对方的一个理由再反驳", "提出建议或呼吁"],
    plan: [
      { zh: "引出话题和立场", fr: "J'ai lu avec intérêt votre article sur… et je souhaite réagir." },
      { zh: "论据一", fr: "Tout d'abord,…" },
      { zh: "论据二", fr: "De plus,… Par exemple,…" },
      { zh: "让步和反驳", fr: "Certes,… mais…" },
      { zh: "结论和建议", fr: "C'est pourquoi il me semble indispensable de…" },
    ],
    phrases: [
      ["En tant qu'habitant(e) du centre-ville, je…", "作为市中心的居民，我……"],
      ["Il est vrai que… ; il n'en reste pas moins que…", "的确……；但仍然……"],
      ["On ne peut pas nier que…", "不能否认……"],
      ["Il serait préférable que la mairie + 虚拟式", "市政府最好……"],
    ],
  },
  {
    id: "essai-ecrans",
    topic: "numerique",
    level: "B2",
    genre: "essai",
    title: "该不该限制孩子用屏幕",
    situation: "学校的家长通讯征稿：是否应该限制孩子使用手机和平板的时间？",
    consigne: "« Faut-il limiter le temps que les enfants passent devant les écrans ? » Vous exposez votre point de vue dans un texte argumenté.",
    words: [250, 350],
    points: ["开头点出问题", "两到三个有例子的论据", "考虑相反的观点", "明确的结论"],
    plan: [
      { zh: "引入和问题", fr: "De nos jours, les écrans font partie du quotidien des enfants. Faut-il pour autant… ?" },
      { zh: "论据一", fr: "En premier lieu,…" },
      { zh: "论据二", fr: "Par ailleurs,… Ainsi,…" },
      { zh: "相反的观点", fr: "On pourrait objecter que… Toutefois,…" },
      { zh: "结论", fr: "En définitive, il me paraît nécessaire de…, à condition de…" },
    ],
    phrases: [
      ["Il ne fait aucun doute que…", "毫无疑问……"],
      ["Cela s'explique par le fait que…", "这是因为……"],
      ["Il ne s'agit pas d'interdire, mais de…", "问题不是禁止，而是……"],
      ["Bien que les écrans soient utiles, …", "尽管屏幕有用……"],
    ],
  },
  {
    id: "essai-etranger",
    topic: "education",
    level: "B2",
    genre: "essai",
    title: "年轻人该不该出国待一年",
    situation: "一份学生杂志的专题：每个年轻人都应该在国外生活一年吗？",
    consigne: "« Tous les jeunes devraient passer une année à l'étranger. » Qu'en pensez-vous ? Vous développez votre opinion dans un texte argumenté.",
    words: [250, 350],
    points: ["对这句话表态（同意、不同意或部分同意）", "论据和例子", "一个让步", "结论"],
    plan: [
      { zh: "引入和立场", fr: "On entend souvent dire que… Je partage en partie cet avis." },
      { zh: "好处", fr: "D'une part, vivre à l'étranger permet de…" },
      { zh: "限制", fr: "D'autre part, tout le monde n'a pas les moyens de…" },
      { zh: "让步", fr: "Même si cette expérience est enrichissante, elle ne…" },
      { zh: "结论", fr: "Pour conclure, plutôt que de l'imposer à tous, il vaudrait mieux…" },
    ],
    phrases: [
      ["Rien ne remplace…", "什么都代替不了……"],
      ["Cela dit, …", "话虽如此……"],
      ["Encore faut-il que + 虚拟式", "还得……才行"],
      ["Il en va de même pour…", "……也是一样。"],
    ],
  },
  {
    id: "doc-livraison",
    topic: "consommation",
    level: "B2",
    genre: "forum",
    title: "材料题：一小时送达",
    situation: "你在一个消费者论坛上读到下面这段话，决定回帖表达自己的看法。",
    doc: "« Se faire livrer ses courses en moins d'une heure, c'est pratique. Mais derrière chaque commande, il y a un livreur mal payé qui roule sous la pluie et des camionnettes de plus dans nos rues. Sommes-nous vraiment si pressés ? »",
    consigne: "Vous réagissez à ce message sur le forum : vous donnez votre opinion sur la livraison ultra-rapide, en vous appuyant sur des arguments et des exemples précis.",
    words: [250, 350],
    points: ["先简要回应材料里的观点（不要照抄）", "表明自己的立场", "两到三个有例子的论据", "一个让步或折中的建议"],
    plan: [
      { zh: "回应材料", fr: "Je viens de lire votre message et il soulève une vraie question :…" },
      { zh: "立场", fr: "Pour ma part, je pense que…" },
      { zh: "论据和例子", fr: "D'abord,… Ensuite,… Dans mon quartier, par exemple,…" },
      { zh: "让步", fr: "Bien sûr, ce service rend service à… Mais…" },
      { zh: "建议和结尾", fr: "Plutôt que d'y renoncer complètement, on pourrait…" },
    ],
    phrases: [
      ["Vous avez raison de souligner que…", "您指出……是对的。"],
      ["Je ne partage pas tout à fait votre point de vue.", "我不完全同意您的看法。"],
      ["On oublie trop souvent que…", "人们常常忘了……"],
      ["Tout est une question de mesure.", "关键在于适度。"],
    ],
  },
  {
    id: "doc-musees",
    topic: "culture",
    level: "B2",
    genre: "courrier",
    title: "材料题：博物馆该不该免费",
    situation: "本地报纸刊登了下面这条消息，并请读者来信发表意见。",
    doc: "La mairie envisage de rendre l'entrée des musées municipaux gratuite toute l'année. Coût estimé : deux millions d'euros par an. Selon l'adjointe à la culture, « la culture doit être accessible à tous » ; l'opposition parle d'« un cadeau fait aux touristes avec l'argent des habitants ».",
    consigne: "Vous écrivez au journal pour dire si vous êtes favorable ou non à ce projet et pourquoi.",
    words: [250, 350],
    points: ["提到这条消息，表明赞成或反对", "论据：谁受益、钱从哪儿来", "回应材料里另一方的说法", "提出自己的建议"],
    plan: [
      { zh: "引出消息和立场", fr: "Votre article du… sur la gratuité des musées m'a fait réagir." },
      { zh: "论据一", fr: "En premier lieu,…" },
      { zh: "论据二", fr: "Par ailleurs,…" },
      { zh: "回应另一方", fr: "On nous dit que… Or,…" },
      { zh: "建议", fr: "Une solution serait de… (par exemple, la gratuité pour les moins de 26 ans)." },
    ],
    phrases: [
      ["Je suis tout à fait favorable à… / fermement opposé(e) à…", "我完全赞成……／坚决反对……"],
      ["Reste à savoir qui paiera.", "问题是由谁来出钱。"],
      ["Cet argument ne tient pas, car…", "这个理由站不住脚，因为……"],
      ["Ce serait un moyen de…", "这会是……的一个办法。"],
    ],
  },
  {
    id: "doc-sommeil",
    topic: "sante",
    level: "B2",
    genre: "article",
    title: "材料题：学校晚一点上课",
    situation: "学生报的编辑部请你就下面这项研究写一篇评论文章。",
    doc: "D'après une étude récente, les lycéens dorment en moyenne moins de sept heures par nuit en semaine. Des chercheurs proposent de faire commencer les cours à 9 heures au lieu de 8 heures : selon eux, les élèves seraient plus attentifs et moins souvent absents.",
    consigne: "Vous rédigez un article pour le journal du lycée : vous présentez brièvement cette proposition et vous donnez votre avis de façon argumentée.",
    words: [250, 350],
    points: ["用自己的话概括研究和建议", "分析好处", "指出实行起来的困难", "明确的结论"],
    plan: [
      { zh: "标题与导语：概括研究", fr: "[Titre accrocheur] — Selon une étude récente,… Des chercheurs suggèrent donc de…" },
      { zh: "好处", fr: "Cette mesure aurait plusieurs avantages :…" },
      { zh: "困难", fr: "Cependant, elle poserait des problèmes d'organisation :…" },
      { zh: "结论", fr: "Tout bien considéré, il me semble que…" },
    ],
    phrases: [
      ["Il ressort de cette étude que…", "这项研究表明……"],
      ["Cela permettrait aux élèves de…", "这能让学生……"],
      ["Il ne suffit pas de… ; encore faut-il…", "光……是不够的，还得……"],
      ["À condition que les transports suivent, …", "只要交通跟得上……"],
    ],
  },
  {
    id: "doc-mediatheque",
    topic: "culture",
    level: "B2",
    genre: "lettre",
    title: "材料题：缩减市立图书馆开放时间",
    situation: "市政厅发布公告，拟削减市立多媒体图书馆的周末及晚间开放时段，你代表常住读者致信市长反对并提出替代方案。",
    doc: "Avis municipal : Afin de réduire les dépenses énergétiques de la commune, la médiathèque centrale fermera désormais à 18 heures en semaine et restera fermée le dimanche à compter du mois prochain. La municipalité invite les usagers à privilégier l'emprunt de livres numériques.",
    consigne: "Au nom d'un collectif de lecteurs, vous écrivez au maire de votre ville pour exprimer votre désaccord face à cette décision, expliquer les conséquences pour les différents publics et proposer des solutions réalistes.",
    words: [250, 350],
    points: ["用自己的话转述公告并代表读者表明立场", "说明缩短开放时间对上班族、学生或老人的影响", "反驳仅靠电子书替代的理由", "提出可行折中方案并用正式落款收尾"],
    plan: [
      { zh: "信头与主题", fr: "Objet : Protestation contre la réduction des horaires de la médiathèque centrale" },
      { zh: "称呼与去信缘由", fr: "Monsieur le Maire, Au nom de nombreux usagers, je me permets de vous écrire suite à l'avis annonçant…" },
      { zh: "具体影响与反驳", fr: "Cette fermeture anticipée pénaliserait d'abord… De plus, le livre numérique ne saurait remplacer…" },
      { zh: "折中建议", fr: "Afin de concilier sobriété énergétique et service public, il serait envisageable de…" },
      { zh: "礼貌结尾与落款", fr: "Dans l'attente de votre réponse, je vous prie d'agréer, Monsieur le Maire, mes salutations respectueuses." },
    ],
    phrases: [
      ["Je me permets d'attirer votre attention sur…", "请允许我提请您注意……"],
      ["Cette mesure priverait de nombreux citoyens de…", "这一举措会使许多市民失去……"],
      ["Loin d'être un luxe, ce service public constitue…", "这项公共服务绝非奢侈，而是……"],
      ["Il conviendrait plutôt d'envisager…", "不如考虑采取……"],
    ],
  },
  {
    id: "courrier-emballages",
    topic: "environnement",
    level: "B2",
    genre: "courrier",
    title: "材料题：超市全面推行散装零包装购物",
    situation: "地区报纸刊登了一份关于强制大型超市设立 30% 散装无包装专区（rayon vrac）的草案，邀请市民来信讨论可行性与社会公平。",
    doc: "Projet d'arrêté régional : Pour réduire les déchets ménagers, toutes les grandes surfaces devront consacrer d'ici deux ans au moins 30 % de leurs rayons alimentaires à la vente en vrac sans emballage plastique. Les associations écologistes saluent une avancée concrète, tandis que certaines fédérations de consommateurs redoutent une hausse des prix et une complication logistique pour les familles nombreuses.",
    consigne: "Vous écrivez au courrier des lecteurs du journal pour exposer votre point de vue sur cette obligation de vente en vrac, en l'appuyant sur des arguments précis.",
    words: [250, 350],
    points: ["点明草案背景与自身立场", "说明减塑对环境与消费习惯的意义", "分析物流、卫生及低收入群体成本上的局限", "提出务实配套建议"],
    plan: [
      { zh: "引出话题与立场", fr: "Votre article consacré à l'obligation de vente en vrac appelle selon moi une analyse nuancée." },
      { zh: "环境收益", fr: "D'une part, la suppression des emballages à usage unique permet de…" },
      { zh: "现实障碍", fr: "Toutefois, imposer un seuil uniforme sans accompagnement risque de…" },
      { zh: "建议收束", fr: "Pour que cette transition reste accessible à tous, il faudrait…" },
    ],
    phrases: [
      ["La réduction des déchets à la source s'impose aujourd'hui comme une priorité.", "从源头减少垃圾如今已是当务之急。"],
      ["Encore faut-il veiller à ce que cette mesure ne pénalise pas…", "还得留意这项举措不要伤及……"],
      ["Plutôt que d'imposer brutalement…, mieux vaudrait…", "与其生硬强行规定……，不如……"],
      ["C'est à cette condition que les citoyens adhéreront à…", "只有满足这一条件，市民才会认同……"],
    ],
  },
  {
    id: "essai-intergeneration",
    topic: "societe",
    level: "B2",
    genre: "essai",
    title: "青年与老人代际合租值得政府大规模资助吗？",
    situation: "一项城市社会调查引发热议：市政部门是否应出资推广学生与独居老人的代际合租（cohabitation intergénérationnelle）？",
    consigne: "« Les collectivités locales devraient financer et généraliser les logements partagés entre étudiants et seniors isolés. » Vous rédigez un essai argumenté pour exprimer votre avis.",
    words: [250, 350],
    points: ["指出高房租与老年人孤独的双重背景", "分析代际合租的社会价值", "思考隐私边界与机构监管风险", "提出平衡公共扶持的结论"],
    plan: [
      { zh: "引言破题", fr: "Face au double défi de la solitude des aînés et de la pénurie de logements étudiants, la cohabitation intergénérationnelle suscite un intérêt croissant." },
      { zh: "社会互惠论据", fr: "D'un côté, ce modèle favorise la solidarité concrète et réduit le coût du loyer." },
      { zh: "边界与条件限制", fr: "D'un autre côté, partager son quotidien exige un cadre clair afin d'éviter…" },
      { zh: "综合结论", fr: "Il serait donc judicieux d'encourager ces initiatives par un encadrement associatif, sans remplacer…" },
    ],
    phrases: [
      ["Ce dispositif présente un double avantage social et économique.", "这一机制兼备社会与经济双重益处。"],
      ["Il ne saurait toutefois se substituer à une politique ambitieuse de…", "然而它并不能取代积极的……政策。"],
      ["Afin de prévenir tout malentendu, il est essentiel que + 虚拟式", "为避免任何误解，……至关重要。"],
      ["Au-delà de l'aspect financier, le lien humain reste…", "除经济层面外，人际联结依然是……"],
    ],
  },
  {
    id: "lettre-budget-participatif",
    topic: "politique-justice",
    level: "B2",
    genre: "lettre",
    title: "材料题：参与式预算透明度与投票率改善建议",
    situation: "你所在城市连续两年推行「参与式预算」，但投票率不足 5% 且资金多流向市中心商圈，你代表街区委员会写信给市长。",
    doc: "Bilan municipal du budget participatif : Sur les deux millions d'euros ouverts au vote citoyen cette année, seuls 4,2 % des habitants inscrits ont participé au scrutin en ligne. Huit projets retenus sur dix concernent des aménagements dans les quartiers centraux, suscitant la déception des secteurs périphériques.",
    consigne: "Au nom de votre conseil de quartier, vous écrivez au maire pour analyser les causes de cette faible participation et proposer des réformes concrètes.",
    words: [250, 350],
    points: ["用正式信函格式说明去信事由与数据背景", "分析低投票率与地区失衡的原因（数字门槛、宣传不足）", "提出线下投票点与按街区分配配额的方案", "礼貌期待回函并致敬落款"],
    plan: [
      { zh: "信头与主题", fr: "Objet : Propositions pour améliorer l'équité et la participation au budget participatif" },
      { zh: "肯定初衷与指出问题", fr: "Monsieur le Maire, si la création d'un budget participatif constitue une avancée démocratique, le bilan récent révèle…" },
      { zh: "原因剖析", fr: "Cette abstention s'explique notamment par la dématérialisation exclusive du vote et…" },
      { zh: "改进措施", fr: "C'est pourquoi nous vous proposons d'instaurer des urnes physiques et une répartition territoriale…" },
      { zh: "正式落款", fr: "Dans l'attente de votre réponse, je vous prie d'agréer, Monsieur le Maire, l'expression de ma haute considération." },
    ],
    phrases: [
      ["Force est de constater que la démocratie locale peine encore à mobiliser…", "不得不承认，基层民主在动员……方面仍步履维艰。"],
      ["Ce déséquilibre nourrit un sentiment d'abandon chez les habitants de…", "这种失衡加剧了……居民的被忽视感。"],
      ["Nous souhaiterions attirer votre bienveillante attention sur la nécessité de…", "我们谨提请您关注推行……的必要性。"],
      ["Une telle réforme renforcerait la légitimité des projets retenus.", "此类改革将增强入选项目的公信力。"],
    ],
  },
  {
    id: "article-ia-recherche",
    topic: "sciences-ethique",
    level: "B2",
    genre: "article",
    title: "材料题：公共医疗与科研该用 AI 决策吗？",
    situation: "一份面向公众的科技伦理月刊就医院试点 AI 辅助分诊与科研评审系统征集深度评论。",
    doc: "Expérimentation hospitalière : Un hôpital universitaire teste un algorithme d'intelligence artificielle pour pré-trier les dossiers de patients et orienter l'attribution de bourses de recherche médicale. L'outil réduit de 40 % les délais administratifs, mais plusieurs chercheurs alertent sur l'opacité des critères de sélection et le risque de biais statistiques.",
    consigne: "Vous rédigez un article d'opinion pour cette revue afin d'évaluer l'usage de l'IA dans les décisions scientifiques et médicales, en posant des garde-fous éthiques.",
    words: [250, 350],
    points: ["拟定吸睛小标题并用自己的话引出试点争议", "剖析算法提效与科学数据挖掘的优势", "指出黑箱偏见与人类责任弱化的隐忧", "总结提出可解释性与人类终审原则"],
    plan: [
      { zh: "标题与导语", fr: "[L'IA à l'hôpital : outil précieux ou arbitre opaque ?] — L'expérimentation récente d'un algorithme de tri relance…" },
      { zh: "效率与科研增益", fr: "Certes, l'automatisation des tâches répétitives libère un temps précieux pour…" },
      { zh: "伦理红线", fr: "Toutefois, déléguer un choix humain à une boîte noire pose deux problèmes majeurs :…" },
      { zh: "结语准则", fr: "En somme, l'algorithme doit demeurer un assistant transparent sous responsabilité humaine." },
    ],
    phrases: [
      ["Le gain d'efficacité ne doit jamais primer sur la transparence éthique.", "效率提升绝不能凌驾于伦理透明度之上。"],
      ["Rien ne garantit que les données d'entraînement soient exemptes de biais.", "没有任何保障能说明训练数据完全不存在偏见。"],
      ["Il importe que la décision finale relève toujours du jugement humain.", "最终裁决必须始终掌握在人类判断手中。"],
      ["À défaut de contrôle indépendant, la confiance des patients s'éroderait rapidement.", "若缺少独立监督，患者的信任将迅速流失。"],
    ],
  },
  {
    id: "essai-infox-ecole",
    topic: "medias-presse",
    level: "B2",
    genre: "essai",
    title: "信息核查课应成为高中正式评估科目吗？",
    situation: "教育部讨论是否将「媒体教育与虚假信息核查」设为高中统考评估模块，你撰文表达观点。",
    consigne: "« L'éducation aux médias et la vérification de l'information devraient devenir une matière obligatoire et notée au lycée. » Qu'en pensez-vous ? Développez votre opinion de manière structurée.",
    words: [250, 350],
    points: ["点明青少年高频接触社交信息流却缺乏核查习惯的现状", "论证开设系统信息素养课的价值", "讨论「打分考试」是否会让批判性思维僵化", "得出融合跨学科实践与教师培训的结论"],
    plan: [
      { zh: "引入与立场", fr: "Alors que la majorité des lycéens s'informent via des vidéos courtes en ligne, faut-il enseigner l'esprit critique comme une discipline à part entière ?" },
      { zh: "必修课价值", fr: "D'une part, savoir vérifier une source et repérer les biais algorithmiques constitue aujourd'hui…" },
      { zh: "应试化风险与对策", fr: "D'autre part, réduire cette formation à une note chiffrée risquerait de…" },
      { zh: "平衡结语", fr: "Plutôt qu'une épreuve académique classique, il conviendrait d'intégrer des ateliers pratiques dans…" },
    ],
    phrases: [
      ["Confondre rapidité d'accès à l'information et compréhension critique constitue un piège fréquent.", "将获取信息的速度等同于批判性理解是常见误区。"],
      ["L'école a pour mission de former des citoyens capables de recouper leurs sources.", "学校肩负着培养能够交叉核验信源的公民的职责。"],
      ["Cependant, évaluer la réflexion civique par un simple examen soulève des réserves.", "然而，仅仅用一场考试来评判公民思辨能力令人有所保留。"],
      ["Sans formation continue des enseignants, toute réforme resterait lettre morte.", "若缺少教师持续培训，任何改革都将沦为一纸空文。"],
    ],
  },
  {
    id: "lettre-loyers",
    topic: "logement-urbanisme",
    level: "B2",
    genre: "lettre",
    title: "材料题：致市区长要求规制核心区短租与空置房",
    situation: "你所在历史街区短租房激增导致常住工薪与学生买不起房、租不到房，本地租赁学校协会委托你致信区长。",
    doc: "Étude locale sur l'habitat : En cinq ans, le nombre de meublés touristiques de courte durée a triplé dans le centre historique, entraînant une hausse de 28 % des loyers résidentiels et la fermeture de deux classes à l'école du quartier faute de familles résidentes.",
    consigne: "En tant que représentant(e) d'une association de riverains, vous écrivez au maire d'arrondissement pour alerter sur cette évolution et demander des mesures de régulation.",
    words: [250, 350],
    points: ["采用规范法语信函格式，简述本地调查中的学校减班与房租涨幅", "说明过度旅游短租对社区生活、商铺与学校的影响", "回应房东出租收益或旅游经济顾虑", "提出上限天数限制与空置税等可操作措施"],
    plan: [
      { zh: "事由与称呼", fr: "Objet : Demande de régulation des meublés touristiques dans le centre historique / Monsieur le Maire," },
      { zh: "转述现状与冲击", fr: "L'étude récemment publiée sur notre quartier confirme une inquiétude grandissante :…" },
      { zh: "回应另一方", fr: "Nous sommes conscients de l'apport économique du tourisme, néanmoins…" },
      { zh: "提出具体诉求与落款", fr: "Nous demandons donc le plafonnement strict des nuits louées et un soutien à la location durable. Je vous prie d'agréer…" },
    ],
    phrases: [
      ["Un quartier ne peut survivre sans ses habitants permanents ni ses commerces de proximité.", "没有常住居民和社区小店，一个街区就无法维系活力。"],
      ["La fermeture annoncée de classes illustre concrètement la dévitalisation du centre.", "学校计划撤并班级具体印证了中心城区的空心化。"],
      ["Il ne s'agit nullement de refuser les visiteurs, mais de préserver un équilibre.", "这绝不是拒绝游客，而是为了守住一种平衡。"],
      ["Nous restons à votre disposition pour évoquer ces pistes lors d'une rencontre.", "我们随时愿意通过面谈进一步探讨这些方案。"],
    ],
  },
  {
    id: "courrier-pouvoir-achat",
    topic: "economie-finances",
    level: "B2",
    genre: "courrier",
    title: "材料题：环保征税该提高还是改用收入返还补贴？",
    situation: "《经济周刊》探讨政府拟上调燃油与碳排税以弥补环保补贴缺口，请读者投书讨论购买力与财税公平。",
    doc: "Note économique : Pour financer la rénovation thermique et les transports propres, un projet fiscal prévoit d'augmenter les taxes sur les carburants fossiles. Plusieurs économistes avertissent toutefois qu'une hausse uniforme frappe proportionnellement plus fort les ménages modestes, faute d'un mécanisme automatique de redistribution.",
    consigne: "Vous écrivez au courrier des lecteurs pour donner votre opinion sur la fiscalité écologique et les moyens de concilier transition climatique et justice budgétaire.",
    words: [250, 350],
    points: ["简明点明材料里的两难（筹资转绿 vs 低收入群体压力）", "论证为何生态政策须有资金来源与价格信号", "指出均匀加税的累退性（injustice fiscale）弊端", "建议碳红利定向返还（chèque transition）并抑制浪费"],
    plan: [
      { zh: "破题", fr: "Le débat sur la fiscalité écologique touche à une question décisive : comment financer la transition sans fragiliser le pouvoir d'achat ?" },
      { zh: "价格信号必要性", fr: "Certes, taxer les énergies carbonées envoie un signal économique nécessaire et…" },
      { zh: "税负不公剖析", fr: "En revanche, sans redistribution ciblée, cette fiscalité devient socialement injuste car…" },
      { zh: "折中结论", fr: "C'est pourquoi chaque euro prélevé devrait être reversé en priorité aux foyers vulnérables pour…" },
    ],
    phrases: [
      ["Toute fiscalité environnementale privée d'accompagnement social est vouée à l'échec.", "缺少社会兜底配套的任何环境税都注定难以成功。"],
      ["Les ménages modestes consacrent déjà une part plus élevée de leurs revenus à l'énergie.", "中低收入家庭本就将更高比例的收入用于日常能源支出。"],
      ["Rendre la transition économiquement avantageuse constitue le levier le plus sûr.", "让绿色转型在经济上划算，才是最稳妥的激励杠杆。"],
      ["La sobriété budgétaire impose par ailleurs d'évaluer l'efficacité réelle de chaque subvention.", "财政审慎也要求评估每一笔补贴的真实效益。"],
    ],
  },
  {
    id: "article-arts-vivants",
    topic: "arts-francophonie",
    level: "B2",
    genre: "article",
    title: "材料题：文化节补贴该削减还是向社区美育倾斜？",
    situation: "一份地方文化杂志因市长拟削减 20% 国际戏剧艺术节与多语出版补贴引发争论，请你撰写评论文章。",
    doc: "Débat culturel municipal : Confrontée à la hausse des coûts de l'énergie, la municipalité propose de réduire de 20 % ses subventions aux grands festivals et à l'édition francophone locale pour financer le fonctionnement courant des gymnases. Les compagnies artistiques craignent la disparition de dizaines d'ateliers gratuits dans les quartiers.",
    consigne: "Vous rédigez un article argumenté pour cette revue afin d'analyser ce choix budgétaire et de défendre une politique culturelle équilibrée.",
    words: [250, 350],
    points: ["设计小标题并概述市府缩减文化补贴的理由", "辩护文化与多语文学节对社区教育及地方经济的意义", "提出优化大活动开支以保全基层美育的平衡方案", "有力结尾呼吁文化不是可删减的奢侈品"],
    plan: [
      { zh: "标题与引子", fr: "[La culture, variable d'ajustement ou ciment citoyen ?] — La décision de réduire de 20 % le budget culturel municipal interpelle…" },
      { zh: "反驳纯粹实用主义", fr: "Opposer le sport et la culture revient à ignorer que les ateliers artistiques participent directement à…" },
      { zh: "务实节流空间", fr: "Pour autant, une gestion rigoureuse impose parfois de mutualiser les moyens logistiques entre…" },
      { zh: "结尾号召", fr: "Préserver les ateliers de proximité, c'est investir à long terme dans l'ouverture linguistique et le vivre-ensemble." },
    ],
    phrases: [
      ["Réduire la culture à un simple poste de dépense superflu révèle une vision à court terme.", "将文化简化为可有可无的开支反映出短视视角。"],
      ["Un festival ouvert sur la francophonie irrigue aussi le commerce, l'hôtellerie et la jeunesse locale.", "面向法语世界的多元艺术节同样滋养着地方商贸、旅业与青年群体。"],
      ["Mutualiser les scènes et encourager le mécénat permettrait de limiter les coûts sans sacrifier l'accès.", "共享舞台资源与鼓励社会赞助可在不牺牲民众参与的前提下压减开支。"],
      ["Loin d'être un luxe réservé aux élites, l'éveil artistique forge l'esprit critique.", "艺术启蒙绝非少数精英的奢侈品，它锤炼人的思辨精神。"],
    ],
  },
];

/** Linking words by what they do in the text. */
export const CONNECTORS: { zh: string; fr: string[] }[] = [
  { zh: "开头", fr: ["tout d'abord", "en premier lieu", "pour commencer"] },
  { zh: "补充", fr: ["de plus", "par ailleurs", "en outre", "ensuite", "d'une part… d'autre part"] },
  { zh: "举例", fr: ["par exemple", "ainsi", "notamment", "c'est le cas de"] },
  { zh: "原因", fr: ["car", "en effet", "puisque", "étant donné que", "grâce à", "à cause de"] },
  { zh: "结果", fr: ["donc", "c'est pourquoi", "par conséquent", "si bien que", "d'où"] },
  { zh: "对比", fr: ["en revanche", "au contraire", "alors que", "tandis que"] },
  { zh: "让步", fr: ["certes… mais", "pourtant", "cependant", "néanmoins", "bien que + 虚拟式", "même si"] },
  { zh: "强调", fr: ["en particulier", "surtout", "il faut souligner que"] },
  { zh: "换个说法", fr: ["autrement dit", "c'est-à-dire", "en d'autres termes"] },
  { zh: "结尾", fr: ["en conclusion", "pour conclure", "en définitive", "finalement"] },
];

/** Reusable argument structures learners can toggle between on B2 tasks. */
export type PlanKind = "task" | "dialectique" | "analytique";

export const ESSAY_PLANS: Record<Exclude<PlanKind, "task">, { label: string; desc: string; steps: { zh: string; fr: string }[] }> = {
  dialectique: {
    label: "Plan dialectique",
    desc: "适合“利弊权衡 / 是否赞成”议题：正方论据 + 反方让步 + 综合立场。",
    steps: [
      {
        zh: "引言（Accroche + Problématique + Annonce du plan）",
        fr: "De nos jours, la question de… suscite de vifs débats. Dans quelle mesure… ? Pour y répondre, nous examinerons d'abord…, puis nous analyserons…, avant de proposer…",
      },
      {
        zh: "正方（Thèse）：核心论点与具体例证",
        fr: "D'une part, il convient de souligner que… En effet,… À titre d'exemple,…",
      },
      {
        zh: "反方（Antithèse）：对立顾虑与边界条件",
        fr: "D'autre part, certains estiment toutefois que… Certes,… Néanmoins, cet argument mérite d'être nuancé car…",
      },
      {
        zh: "综合结论（Synthèse + Ouverture）",
        fr: "Tout bien considéré, la solution réside dans un équilibre entre… En définitive,…",
      },
    ],
  },
  analytique: {
    label: "Plan analytique",
    desc: "适合“社会现象 / 成因—影响—对策”议题：现状剖析 + 多维后果 + 可行措施。",
    steps: [
      {
        zh: "引言（Constat + Problématique + Annonce du plan）",
        fr: "Force est de constater que… Dès lors, comment expliquer ce phénomène et quelles solutions envisager ? Nous verrons d'abord les causes…, puis les conséquences…, enfin les pistes d'action…",
      },
      {
        zh: "成因（Causes）：体制、经济或习惯原因",
        fr: "Cette évolution s'explique en premier lieu par… Par ailleurs,…",
      },
      {
        zh: "影响（Conséquences）：对个人或社会的影响",
        fr: "Une telle situation entraîne plusieurs conséquences majeures, notamment… Si rien n'est fait,…",
      },
      {
        zh: "对策与结语（Solutions + Conclusion）",
        fr: "Pour remédier à ce problème, il serait souhaitable de… En conclusion,…",
      },
    ],
  },
};

/** Full DELF B2 formal letter layout template (sender, recipient, date/place, objet, closing). */
export const LETTER_TEMPLATE: { part: string; fr: string; tip?: string }[] = [
  { part: "寄信人（左上）", fr: "Prénom Nom / Adresse / Courriel", tip: "考试用虚构姓名（如 Camille Martin），勿写真实隐私" },
  { part: "收信人（右上）", fr: "À l'attention de Monsieur le Maire / Madame la Directrice, Service / Organisme" },
  { part: "时间地点（右上）", fr: "Lyon, le 15 mai 2026" },
  { part: "事由（Objet）", fr: "Objet : Demande de… / Protestation concernant…", tip: "简短名词短语，不加句号" },
  { part: "称呼（Appellation）", fr: "Madame, Monsieur,（或 Monsieur le Maire,）", tip: "后接逗号，另起一行首字母大写" },
  { part: "正文结尾与落款（Formule de politesse）", fr: "Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.", tip: "正式信件忌用 Cordialement / Bien à vous" },
  { part: "署名（右下）", fr: "Prénom Nom" },
];

/** Formulas of a formal letter (Cordialement removed with explicit warning). */
export const LETTER_FORMULAS: { zh: string; fr: string[] }[] = [
  { zh: "称呼", fr: ["Madame, Monsieur,", "Madame la Directrice,", "Monsieur le Maire,"] },
  { zh: "开头", fr: ["Je me permets de vous écrire afin de…", "Suite à votre annonce du…,", "Je vous écris au sujet de…"] },
  { zh: "请求", fr: ["Je vous serais reconnaissant(e) de bien vouloir…", "Pourriez-vous m'indiquer… ?", "Je vous prie de…"] },
  { zh: "结尾", fr: ["Dans l'attente de votre réponse,", "Je vous remercie par avance de…", "Je reste à votre disposition pour…"] },
  { zh: "落款套语", fr: ["Je vous prie d'agréer, Madame, Monsieur, mes salutations distinguées.", "Veuillez agréer, Madame, l'expression de mes sentiments respectueux.", "Veuillez agréer, Monsieur le Maire, l'assurance de ma haute considération."] },
  { zh: "禁忌警告", fr: ["勿用 Cordialement / Bien à vous（属日常或半正式邮件套语，DELF B2 正式信函会扣语域分）"] },
];

/** What the candidate checks, per criterion (after the official descriptors, in the site's own words). */
export const CRITERION_CHECK: Record<string, string> = {
  task: "体裁和话题符合题目吗？至少 250 词了吗？有没有表明立场、展开论证、举出具体例子、说到利弊？",
  coherence: "有引言、正文、结论的分段吗？用衔接语把想法连起来了吗？标点和格式符合这种文体吗？",
  socio: "称呼和礼貌用语对吗？语气和正式程度从头到尾都合适吗？",
  lexique: "用的是这个话题的 B2 词汇吗？有没有用同义词避免重复？拼写对吗？",
  morpho: "简单句和复合句交替使用了吗？过去时、条件式、虚拟式用对了吗？性数配合对吗？",
  monologue: "指出了材料的主题并提出问题吗？宣布提纲了吗？观点有论据和具体例子吗？有引言、展开、结论和衔接语吗？",
  interaction: "能确认、细化自己的观点吗？能让步（cependant、néanmoins）、表示同意或不同意、回答并反驳考官吗？",
  phono: "发音清楚吗？语速适中吗？语调有变化吗？说错了能自己纠正吗？",
};

export type DocMode = "random" | "doc" | "none";

/** Resolve the genre and document setting for an AI-generated essay prompt. */
export function pickAiTaskOptions(
  level: "B1" | "B2",
  chosen: Genre | "random",
  docMode: DocMode = "random",
  rand: () => number = Math.random,
): { genre: Genre; withDocument: boolean } {
  const pool = genresFor(level);
  const idx = Math.floor(Math.max(0, Math.min(0.999999, rand())) * pool.length);
  const genre = chosen !== "random" && pool.includes(chosen) ? chosen : pool[idx];
  const withDocument = docMode === "random" ? rand() < 0.5 : docMode === "doc";
  return { genre, withDocument };
}

/** Resolve the CEFR level ("B1" | "B2") of a saved essay from its task definition (defaulting to "B2"). */
export function essayLevelOf(essay: SavedEssay, tasks: readonly EssayTask[] = ESSAY_TASKS): "B1" | "B2" {
  return tasks.find((t) => t.id === essay.task)?.level ?? "B2";
}

/** Partition marked essays into isolated B1 and B2 lists sorted chronologically (never mixed in trend charts). */
export function splitEssaysByLevel(essays: readonly SavedEssay[], tasks: readonly EssayTask[] = ESSAY_TASKS): { b1: SavedEssay[]; b2: SavedEssay[] } {
  const marked = essays.filter((e) => e.fb).sort((a, b) => a.created - b.created);
  const b1: SavedEssay[] = [];
  const b2: SavedEssay[] = [];
  for (const e of marked) (essayLevelOf(e, tasks) === "B1" ? b1 : b2).push(e);
  return { b1, b2 };
}

/**
 * The grid's rule for a text with too little to assess: under half the expected words, every criterion is 0.
 */
export function tooShort(text: string, minWords: number) {
  return countWords(text) < minWords / 2;
}

const stripQuotedText = (text: string): string => text.replace(/«[^»]*»|"[^"]*"|“[^”]*”/g, " ");

const hasInformalPronoun = (unquoted: string): boolean =>
  /(?:^|[.!?;:\n]\s*|\b(?:si|quand|lorsque|que|où|comme|mais|et|donc|car|or|puisque|parce\s+que)\s+)tu\b|\btoi\b/i.test(unquoted);

const CLOSING_FORMULA_LINE = /\b(?:je\s+vous\s+prie\s+(?:d'agréer|de\s+croire)|veuillez\s+(?:agréer|recevoir))\b[^\n]*/gi;

/**
 * Deterministic formal-register check for FORMAL_GENRES (lettre, motivation, courrier):
 * flags informal `tu`/`toi` outside quotes, casual openings (`Bonjour`/`Salut`), or missing formal salutation/closing.
 */
export function hasFormalRegisterViolation(text: string): boolean {
  const unquoted = stripQuotedText(text);
  if (hasInformalPronoun(unquoted)) return true;
  const trimmed = unquoted.trim();
  if (!trimmed) return true;
  const head = trimmed.slice(0, 600);
  const tail = trimmed.slice(-500);
  if (/(?:^|\n)\s*(?:bonjour|salut|coucou|hello)\b/i.test(head)) return true;
  const headWithoutClosing = head.replace(CLOSING_FORMULA_LINE, " ");
  const hasSalutation = /\b(?:madame|monsieur|mesdames|messieurs|mme|rédact(?:eur|rice)|direct(?:eur|rice)|maire|rédaction|service)\b/i.test(headWithoutClosing);
  const hasClosing = /(?:\bagréer\b|\bsalutations\b|\b(?:sentiments|considération|hommages)\s+(?:distingué\w*|respectueu\w*|dévoué\w*|meilleur\w*)|\b(?:distingué\w*|respectueu\w*|dévoué\w*)\s+(?:salutations|sentiments|considération|hommages)\b|\b(?:expression|assurance)\s+de\s+(?:ma|mes)\s+(?:considération|sentiments|hommages)\b|\brespectueusement\b)/i.test(tail);
  return !hasSalutation || !hasClosing;
}

/**
 * Deterministic register check for B2 essai/article prompts:
 * flags unquoted spoken/informal markers (`tu`/`toi`, `moi je`, standalone `ça` instead of `cela`/`ceci`)
 * so `socio` stays consistently capped at 1 rather than oscillating 1↔3 across runs.
 */
export function hasInformalEssayRegisterViolation(text: string): boolean {
  const unquoted = stripQuotedText(text);
  if (hasInformalPronoun(unquoted)) return true;
  return /(?<![\p{L}\p{N}_])(?:ça|moi\s+je)(?![\p{L}\p{N}_])/iu.test(unquoted);
}

const BASIC_GRAMMAR_ERROR_TYPES = new Set<ErrorType>(["article", "gender", "conjugation", "tense", "agreement", "preposition"]);

function isElementaryCorrection(c: EssayCorrection): boolean {
  const w = c.wrong.toLowerCase();
  const r = c.right.toLowerCase();
  if ((/\bde\s+les\b/.test(w) && /\bdes\b/.test(r)) || (/\bde\s+le\b/.test(w) && /\bdu\b/.test(r)) || (/\bà\s+les\b/.test(w) && /\baux\b/.test(r)) || (/\bà\s+le\b/.test(w) && /\bau\b/.test(r))) {
    return true;
  }
  if (/\b(?:beaucoup|trop|peu|plus|moins|assez)\s+des\b/.test(w) && /\bde\b|\bd'/.test(r)) return true;
  if (/\b(?:plus|moins)\s+bon(?:ne|s|nes)?\b|\bplus\s+bien\b|\btrès\s+d'accord\b|\bsur\s+le\s+journal\b/.test(w)) return true;
  if (/\b(?:il\s+faut|bien|pour|avant|sans)\s+qu[e']/.test(w) && (c.type === "conjugation" || c.type === "tense" || c.type === "other")) return true;
  if (/\b(?:difficile|facile|possible|impossible|utile|important)\s+pour\b/.test(w) && /\b(?:de|d'|à)\b/.test(r)) return true;
  return false;
}

const DE_VERB_PREFIX =
  /\b(?:parl\w*|occup\w*|dépend\w*|profit\w*|souffr\w*|souci\w*|inqui[eéè]t\w*|plai[gn]\w*|m[eé]fi\w*|trait\w*|discut\w*|manqu\w*|abus\w*|besoin|peur|envie|r[eê]v\w*|moqu\w*|serv\w*)$/i;

function hasQuantifierDesError(text: string): boolean {
  for (const m of text.matchAll(/\b(?:beaucoup|trop|peu|assez)\s+des\b/gi)) {
    const prev = text.slice(0, m.index ?? 0).trimEnd().split(/\s+/).pop() ?? "";
    if (!DE_VERB_PREFIX.test(prev)) return true;
  }
  return false;
}

/** Deterministic B1-level guard on B2 tasks when the model detects elementary errors yet skips profile booleans. */
export function detectB1ProfileFallback(
  text: string,
  corrections: readonly EssayCorrection[],
  opts?: { oral?: boolean },
): Pick<EssayFlags, "hasSystematicB1Errors" | "repetitiveBasicLexis" | "mechanicalB1Structure"> {
  const elementaryFixes = corrections.filter(isElementaryCorrection).length;
  const basicGrammarCount = corrections.filter((c) => BASIC_GRAMMAR_ERROR_TYPES.has(c.type)).length;
  const textCalques =
    [
      /\b(?:est|sont|soit|être|paraît|semble|devient|deviennent|reste|restent|pas|encore|bien|beaucoup)\s+(?:plus|moins)\s+bon(?:ne|s|nes)?\b|\bmoins\s+bon\b/i,
      /\bà\s+la\s+place\s+de\s+l(?:e|es)\b|\b(?:de|à)\s+les\s+(?!(?:y|en|lui|leur)\b|[a-zàâäéèêëïîôùûüç]+(?:er|ir|re|oir)\b)[a-zàâäéèêëïîôùûüç]{2,}\b|\b(?:de|à)\s+le\s+(?!(?:lui|leur|y|en|bien|mal|mieux)\b|[a-zàâäéèêëïîôùûüç]+(?:er|ir|re|oir)\b)[a-zàâäéèêëïîôùûüç]{2,}\b/i,
      /\btrès\s+d'accord\b/i,
      /\bsur\s+le\s+journal\b/i,
      /\b(?:difficile|facile|possible)\s+pour\s+[a-zàâäéèêëïîôùûüç]+(?:er|ir|re)\b/i,
      /\bil\s+faut\s+qu(?:e\s+(?:tout\s+le\s+monde|(?:(?:l'|d'|un|une|le|la|les|des|ces|ce|cet|cette|mon|ma|mes|ton|ta|tes|son|sa|ses|notre|nos|votre|vos|leur|leurs|chaque|quelques|plusieurs)\s+)?(?!(?:qui|que|dont|où|ne|se|me|te|le|la|les|lui|leur|y|en)\b)[a-zàâäéèêëïîôùûüç-]+)|'(?:on|il|elle|ils|elles))(?:\s+y)?\s+(?:fait|font|va|vont|peut|peuvent|doit|est|sont|a|ont|sait|savent|veut|veulent|prend|vient|dit|met)\b/i,
    ].filter((re) => re.test(text)).length + (hasQuantifierDesError(text) ? 1 : 0);

  const wc = Math.max(1, countWords(text));
  const grammarDensityLimit = Math.max(6, Math.ceil(wc / 45));
  const hasSystematicB1Errors = Math.max(elementaryFixes, textCalques) >= 2 || elementaryFixes + textCalques >= 3 || basicGrammarCount >= grammarDensityLimit;

  const tresHits = (text.match(/\btrès\s+[a-zàâäéèêëïîôùûüç]+/gi) ?? []).length;
  const beaucoupHits = (text.match(/\bbeaucoup\b/gi) ?? []).length;
  const gensHits = (text.match(/\bles\s+gens\b/gi) ?? []).length;
  const chosesHits = (text.match(/\b(?:des?|les)\s+choses?\b|\bquelque\s+chose\b/gi) ?? []).length;
  const spokenHits = (text.match(opts?.oral ? /\bmoi\s+je\b/gi : /\b(?:ça|moi\s+je)\b/gi) ?? []).length;
  const simpleAdjHits = [...text.matchAll(/\b(?:c'est|est|sont)\s+(?:très\s+)?(?:bon|bonne|bons|bonnes|bien|mauvais|mauvaise|joli|jolie|facile|difficile|utile|intéressant)\b/gi)]
    .filter((m) => !/\bil\s+$/i.test(text.slice(Math.max(0, (m.index ?? 0) - 6), m.index ?? 0)))
    .length;
  const buckets = [tresHits >= 2, beaucoupHits >= 2, gensHits >= 1, chosesHits >= 1, spokenHits >= 1, simpleAdjHits >= 2].filter(Boolean).length;
  const totalBasicLex = tresHits + beaucoupHits + gensHits + chosesHits + spokenHits + simpleAdjHits;
  const hasLexicalCalque =
    corrections.some((c) => /\b(?:plus|moins)\s+bon(?:ne|s|nes)?\b|\bplus\s+bien\b|\btrès\s+d'accord\b|\bsur\s+le\s+journal\b/i.test(c.wrong)) ||
    /\b(?:est|sont|soit|être|pas|encore|bien)\s+(?:plus|moins)\s+bon(?:ne|s|nes)?\b|\bmoins\s+bon\b/i.test(text);

  const repetitiveBasicLexis =
    tresHits >= 5 ||
    (tresHits >= 4 && totalBasicLex >= 6) ||
    (buckets >= 4 && totalBasicLex >= 9) ||
    (hasSystematicB1Errors && (hasLexicalCalque || (buckets >= 3 && totalBasicLex >= 6)));

  const mechCount = (text.match(/(?:^|[.!?\n]\s*)(?:D'abord|Ensuite|Et\s+puis|Mais|Pour\s+finir)\b/g) ?? []).length;
  const b2ConnectorCount = [
    /\bEn premier lieu\b/i,
    /\bPar ailleurs\b/i,
    /\bDe surcroît\b/i,
    /\bToutefois\b/i,
    /\bNéanmoins\b/i,
    /\bEn revanche\b/i,
    /\bForce est de constater\b/i,
    /\bBien que\b/i,
    /\bCertes\b/i,
    /\bCependant\b/i,
    /\bEn définitive\b/i,
    /\bD'une part\b/i,
    /\bD'autre part\b/i,
    /\bPour autant\b/i,
    /\bEncore faut-il\b/i,
    /\bC'est pourquoi\b/i,
    /\bEn somme\b/i,
    /\bEn outre\b/i,
  ].filter((re) => re.test(text)).length;
  const mechanicalB1Structure = (mechCount >= 3 && b2ConnectorCount === 0) || (mechCount >= 4 && b2ConnectorCount < 2);

  const out: Pick<EssayFlags, "hasSystematicB1Errors" | "repetitiveBasicLexis" | "mechanicalB1Structure"> = {};
  if (hasSystematicB1Errors) out.hasSystematicB1Errors = true;
  if (repetitiveBasicLexis) out.repetitiveBasicLexis = true;
  if (mechanicalB1Structure) out.mechanicalB1Structure = true;
  return out;
}

/** Apply FEI 2022 essay grid caps (off-topic, wrong genre, register/format, and word count). */
export function applyEssayGridCaps(fb: EssayFeedback, opts: { genre: Genre; text: string; minWords: number; level?: "B1" | "B2" }): EssayFeedback {
  const level = opts.level ?? "B2";
  let flags = fb.flags ? { ...fb.flags } : undefined;
  if (FORMAL_GENRES.includes(opts.genre) && hasFormalRegisterViolation(opts.text)) {
    flags = { ...flags, registerViolation: true };
  } else if (level === "B2" && (opts.genre === "essai" || opts.genre === "article") && hasInformalEssayRegisterViolation(opts.text)) {
    flags = { ...flags, registerViolation: true };
  }
  if (level === "B2") {
    const b1Fallback = detectB1ProfileFallback(opts.text, fb.corrections);
    if (b1Fallback.hasSystematicB1Errors || b1Fallback.repetitiveBasicLexis || b1Fallback.mechanicalB1Structure) {
      flags = { ...flags, ...b1Fallback };
    }
  }
  const { scores: cappedScores, caps } = capScoresByFlags(fb.scores, flags, level, fb.caps);
  const notes: string[] = [];
  if (flags?.offTopic === "total") notes.push("【严重偏题：按规则全卷记 0 分】");
  else if (flags?.offTopic === "partial") notes.push("【部分偏题：完成任务与词汇封顶 3 分】");
  if (flags?.wrongGenre) notes.push("【文体错位：完成任务与连贯衔接封顶 1 分】");
  if (flags?.registerViolation) notes.push("【语域/格式不符：语体得体封顶 1 分】");
  if (level === "B2") {
    if (flags?.hasSystematicB1Errors) notes.push("【检测到系统性 B1 基础语法错误：语法准确封顶 1 分，任务/连贯/语体最高 3 分】");
    if (flags?.repetitiveBasicLexis) notes.push("【基础词重复或直译偏多：词汇丰富度封顶 1 分，任务/连贯/语体最高 3 分】");
    if (flags?.mechanicalB1Structure) notes.push("【机械 B1 串联结构：连贯衔接封顶 1 分，完成任务最高 3 分】");
  }
  const withGridCaps: EssayFeedback = {
    ...fb,
    scores: cappedScores,
    ...(flags ? { flags } : {}),
    ...(caps.length ? { caps } : {}),
    comment: notes.length ? `${notes.join("")}${fb.comment}` : fb.comment,
  };
  return applyEssayLengthCaps(withGridCaps, opts.text, opts.minWords);
}

const wordTokens = (s: string): string[] => (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);

function ngrams(tokens: string[], size: number): string[] {
  if (tokens.length < size) return [];
  const out: string[] = [];
  for (let i = 0; i <= tokens.length - size; i++) out.push(tokens.slice(i, i + size).join(" "));
  return out;
}

/**
 * Measure verbatim 5-gram copying from the prompt document and internal 4-gram repetition in a speaking transcript.
 */
export function speakingPasteStats(transcript: string, doc: string): { copyRatio: number; originalWords: number; unique4GramRatio: number; total4Grams: number } {
  const talk = wordTokens(transcript);
  const src = new Set(ngrams(wordTokens(doc), 5));
  const covered = new Set<number>();
  if (src.size > 0 && talk.length >= 5) {
    for (let i = 0; i <= talk.length - 5; i++) {
      if (src.has(talk.slice(i, i + 5).join(" "))) {
        for (let k = i; k < i + 5; k++) covered.add(k);
      }
    }
  }
  const g4 = ngrams(talk, 4);
  return {
    copyRatio: talk.length ? covered.size / talk.length : 0,
    originalWords: talk.length - covered.size,
    unique4GramRatio: g4.length ? new Set(g4).size / g4.length : 1,
    total4Grams: g4.length,
  };
}

export interface SpeakingAcoustics {
  speechRateWpm?: number;
  articulationRateWpm?: number;
  pauseRatio?: number;
  longFreezeCount?: number;
  midConstituentBreaks?: number;
  likelyReadAloud?: boolean;
  obligatoryLiaisonsMissed?: number;
  forbiddenLiaisonsMade?: number;
  phonemeAlerts?: string[];
}

function normClauseText(s: string): string {
  return s.normalize("NFC").toLowerCase().replace(/[’‘`\u02bc]/g, "'").replace(/\s+/g, " ").trim();
}

function splitEssayClauses(text: string): string[] {
  return text
    .split(/(?:[.!?;:\n]+|,\s+)/g)
    .map((c) => normClauseText(c))
    .filter(Boolean);
}

function countPhraseOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startBoundary = /^[\p{L}\p{N}]/u.test(needle) ? "(?<![\\p{L}\\p{N}_'])" : "";
  const endBoundary = /[\p{L}\p{N}]$/u.test(needle) ? "(?![\\p{L}\\p{N}_])" : "";
  const re = new RegExp(`${startBoundary}${escaped}${endBoundary}`, "gu");
  return (haystack.match(re) ?? []).length;
}

function clauseSimilarity(a: string, b: string): number {
  const ta = wordTokens(a);
  const tb = wordTokens(b);
  if (!ta.length || !tb.length) return 0;
  const counts = new Map<string, number>();
  for (const w of tb) counts.set(w, (counts.get(w) ?? 0) + 1);
  let inter = 0;
  for (const w of ta) {
    const c = counts.get(w) ?? 0;
    if (c > 0) {
      inter++;
      counts.set(w, c - 1);
    }
  }
  return (2 * inter) / (ta.length + tb.length);
}

/**
 * Clause-level 2nd-draft diff: determines which first-draft corrections were genuinely fixed
 * in `revText` without being fooled by identical short words surviving in unrelated clauses.
 */
export function diffSecondDraftCorrections(
  firstText: string,
  revText: string,
  corrections: readonly EssayCorrection[],
): { fixed: EssayCorrection[]; still: EssayCorrection[] } {
  const firstNorm = normClauseText(firstText);
  const revNorm = normClauseText(revText);
  const firstClauses = splitEssayClauses(firstText);
  const revClauses = splitEssayClauses(revText);
  const fixed: EssayCorrection[] = [];
  const still: EssayCorrection[] = [];

  for (const c of corrections) {
    const w = normClauseText(c.wrong);
    if (!w) continue;
    const r = normClauseText(c.right);
    const srcMatches = firstClauses.filter((cl) => countPhraseOccurrences(cl, w) > 0);

    let isFixed: boolean;
    if (srcMatches.length > 0 && revClauses.length > 0) {
      let resolvedCount = 0;
      for (const src of srcMatches) {
        let bestClause = "";
        let bestSim = -1;
        for (const cand of revClauses) {
          const sim = clauseSimilarity(src, cand);
          if (sim > bestSim) {
            bestSim = sim;
            bestClause = cand;
          }
        }
        if (bestSim >= 0.35) {
          const beforeCount = countPhraseOccurrences(src, w);
          const afterCount = countPhraseOccurrences(bestClause, w);
          const rightAdded = !!r && countPhraseOccurrences(bestClause, r) > countPhraseOccurrences(src, r);
          if (afterCount < beforeCount || (afterCount === 0 && beforeCount > 0) || rightAdded) {
            resolvedCount++;
          }
        } else if (countPhraseOccurrences(revNorm, w) < countPhraseOccurrences(firstNorm, w)) {
          resolvedCount++;
        }
      }
      isFixed = resolvedCount >= srcMatches.length;
    } else {
      const beforeTotal = countPhraseOccurrences(firstNorm, w);
      const afterTotal = countPhraseOccurrences(revNorm, w);
      isFixed = beforeTotal > 0 ? afterTotal < beforeTotal : !revNorm.includes(w);
    }

    if (isFixed) fixed.push(c);
    else still.push(c);
  }

  return { fixed, still };
}

/** Deterministic DELF B2 speaking caps (0.5-pt scale, speech-rate/duration, >8m ramble, B1 fallback, informal tu, read-aloud, copy-paste, cursory debate). */
export function applySpeakingCaps(
  fb: EssayFeedback,
  opts: {
    transcript: string;
    doc: string;
    turns: { q: string; a: string }[];
    monologueWords?: number;
    monologueSec?: number;
    debateSec?: number;
    typed?: boolean;
    acoustics?: SpeakingAcoustics;
  },
): EssayFeedback {
  const monologueWords = opts.monologueWords ?? countWords(opts.transcript);
  const answered = opts.turns.filter((t) => t.a.trim());
  const debateWords = answered.reduce((n, t) => n + countWords(t.a), 0);
  const paste = speakingPasteStats(opts.transcript, opts.doc);
  const highCopyPaste = (monologueWords >= 40 && paste.copyRatio >= 0.35) || (monologueWords >= 120 && paste.originalWords < Math.min(120, monologueWords * 0.65));
  const highRepetition = paste.total4Grams >= 40 && paste.unique4GramRatio < 0.55;
  const oralCombined = [opts.transcript, ...answered.map((t) => t.a)].filter(Boolean).join("\n");
  const oralB1 = detectB1ProfileFallback(oralCombined, fb.corrections, { oral: true });
  const informalTuInTalk = hasInformalPronoun(stripQuotedText(opts.transcript));
  const informalTuInDebate = answered.some((t) => hasInformalPronoun(stripQuotedText(t.a)));
  const hasInformalTu = informalTuInTalk || informalTuInDebate;

  let flags = fb.flags ? { ...fb.flags } : undefined;
  if (highCopyPaste || highRepetition) flags = { ...flags, pastedFromDoc: true };
  const shortDebate = answered.length > 0 && (answered.length <= 2 || debateWords < 80 || debateWords / answered.length < 12 || (opts.debateSec !== undefined && opts.debateSec < 90 && debateWords < 120));
  if (shortDebate) flags = { ...flags, cursoryDebate: true };
  if (oralB1.hasSystematicB1Errors || oralB1.repetitiveBasicLexis || oralB1.mechanicalB1Structure) {
    flags = { ...flags, ...oralB1 };
  }
  if (hasInformalTu) flags = { ...flags, informalTu: true };
  if (opts.acoustics?.likelyReadAloud) flags = { ...flags, readAloud: true };
  if (!opts.typed && opts.monologueSec !== undefined && opts.monologueSec > 480) {
    flags = { ...flags, rambleOvertime: true };
  }

  const { scores, caps } = capScoresByFlags(fb.scores, flags, "B2", fb.caps);
  const cap = (k: string, maxVal: number, reason: string) => {
    if (!(k in scores) || scores[k] <= maxVal) return;
    pushCap(caps, k, scores[k], maxVal, reason);
    scores[k] = maxVal;
  };
  const notes: string[] = [];

  const sec = !opts.typed ? opts.monologueSec : undefined;
  const tooShortSecHard = sec !== undefined && sec < 120;
  const tooShortSecMid = sec !== undefined && sec < 150;
  const slightlyShortSec = sec !== undefined && sec < 200;

  if (monologueWords < 80) {
    const why = `独白过短（${monologueWords} 词）`;
    cap("monologue", 0, why);
    cap("lexique", 1, why);
    cap("morpho", 1, why);
    notes.push(`【独白过短（${monologueWords} 词），独白记 0 分且语言封顶 1 分】`);
  } else if (monologueWords < 200 || tooShortSecHard) {
    cap("monologue", 1, tooShortSecHard && monologueWords >= 200 ? `独白时长不足（${sec}s）` : `独白不足 250 词（${monologueWords} 词）`);
    notes.push(
      tooShortSecHard && monologueWords >= 200
        ? `【独白时长不足（${sec} 秒，远短于 5–7 分钟），独白封顶 1 分】`
        : `【独白不足 250 词（实测 ${monologueWords} 词），独白封顶 1 分】`,
    );
  } else if (monologueWords < 250 || tooShortSecMid) {
    cap("monologue", 1.5, tooShortSecMid && monologueWords >= 250 ? `独白时长偏短（${sec}s）` : `独白不足 250 词（${monologueWords} 词）`);
    notes.push(
      tooShortSecMid && monologueWords >= 250
        ? `【独白时长不足（${sec} 秒，短于 5–7 分钟要求），独白封顶 1.5 分】`
        : `【独白不足 250 词（实测 ${monologueWords} 词），独白封顶 1.5 分】`,
    );
  } else if (slightlyShortSec) {
    cap("monologue", 2.5, `独白时长未满 3 分半（${sec}s）`);
    notes.push(`【独白时长偏短（${sec} 秒，建议 5–7 分钟），独白封顶 2.5 分】`);
  } else if (opts.typed && monologueWords < 350) {
    cap("monologue", 3.5, `打字独白篇幅偏短（${monologueWords} 词）`);
  } else if (sec !== undefined && sec > 480) {
    const deduct = sec > 540 ? 1 : 0.5;
    const maxRamble = sec > 540 ? 3 : 3.5;
    if ("monologue" in scores && scores.monologue > 0) {
      const target = Math.min(maxRamble, toLevel(Math.max(0, scores.monologue - deduct)));
      if (target < scores.monologue) {
        pushCap(caps, "monologue", scores.monologue, target, `独白超时冗长（${sec}s > 8 分钟）`);
        scores.monologue = target;
      }
    }
    notes.push(`【独白超时冗长（${Math.round((sec / 60) * 10) / 10} 分钟，超出考场 5–7 分钟上限），独白扣 ${deduct} 分】`);
  }

  if (opts.acoustics?.likelyReadAloud) {
    cap("monologue", 2, "疑似照念逐字稿");
    notes.push("【声学韵律检测疑似照念逐字稿（违反 DELF 口语脱稿陈述要求），独白封顶 2 分】");
  }

  if (!opts.typed && opts.acoustics) {
    const wpm = opts.acoustics.speechRateWpm ?? (sec && sec >= 30 ? (monologueWords / sec) * 60 : undefined);
    if ((wpm !== undefined && wpm < 75) || (opts.acoustics.pauseRatio !== undefined && opts.acoustics.pauseRatio >= 0.45) || (opts.acoustics.longFreezeCount ?? 0) >= 4) {
      cap("monologue", 2.5, "语速过慢或长卡顿频繁");
      notes.push("【语速偏慢或长停顿过多，独白流利度封顶 2.5 分】");
    } else if ((opts.acoustics.midConstituentBreaks ?? 0) >= 5) {
      cap("monologue", 3.5, "意群内部频繁断裂");
    }
  }

  if (hasInformalTu) {
    if (informalTuInTalk) cap("monologue", 2.5, "正式考场误用非正式称呼 tu");
    if (answered.length > 0) cap("interaction", 2, "正式考场对考官误用 tu");
    notes.push("【口语正式考场误用非正式称呼 tu（应全程用 vous），互动与语体受限】");
  }

  if (oralB1.hasSystematicB1Errors) notes.push("【检测到系统性 B1 基础语法错误：语法封顶 1 分，独白/互动最高 3 分】");
  if (oralB1.repetitiveBasicLexis) notes.push("【口语基础词重复或中式直译偏多：词汇封顶 1 分，独白/互动最高 3 分】");

  if (flags?.pastedFromDoc) {
    cap("monologue", 1, "照抄材料/高频重复");
    cap("lexique", 1, "照抄材料/高频重复");
    if (highRepetition) cap("morpho", 1, "高频重复凑字");
    notes.push("【检测到高比例照抄材料或重复凑字，独白与词汇封顶 1 分】");
  }

  if (answered.length === 0) {
    cap("interaction", 0, "未完成辩论");
  } else if (flags?.cursoryDebate) {
    const debateCap = answered.length === 1 || debateWords < 45 ? 1 : 1.5;
    cap("interaction", debateCap, "辩论内容/轮次偏少");
    notes.push(`【辩论轮次或有效作答偏少/偏敷衍，互动封顶 ${debateCap} 分】`);
  }

  if (flags?.offTopic === "total") notes.push("【严重偏题：按规则记 0 分】");
  else if (flags?.offTopic === "partial") notes.push("【部分偏题：独白与词汇封顶 3 分】");
  if (opts.typed) notes.push("（本次为打字替代口语输入，无法核验口语即时反应与流利度。）");

  return {
    ...fb,
    scores,
    ...(flags ? { flags } : {}),
    ...(caps.length ? { caps } : {}),
    comment: notes.length ? `${notes.join("")}${fb.comment}` : fb.comment,
  };
}

/** Whether a generated model answer fell below the task minimum word floor and warrants a retry. */
export function needsModelLengthRetry(model: ModelEssay, minWords: number): boolean {
  return !model.text || countWords(model.text) < minWords;
}

/** Pick whichever model candidate meets the minimum word target (or has more words). */
export function pickBetterModel(first: ModelEssay, retry: ModelEssay, minWords: number): ModelEssay {
  const w1 = countWords(first.text);
  const w2 = countWords(retry.text);
  if (w2 >= minWords && w1 < minWords) return retry;
  return w2 > w1 ? retry : first;
}
