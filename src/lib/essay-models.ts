/**
 * 静态 B2+ 范文库：为全部 9 道内置 B2 篇章写作题提供无需 AI Key 即可对照自学的 B2+ 范文与逐段中文点评。
 * 本文库内容为站点自编示例，尚未经认证考官人工终审（待核对）。
 */
import { countWords } from "./essay";

export interface EssayModelParagraph {
  fr: string;
  zhNote: string;
  technique?: string;
}

export interface StaticEssayModel {
  taskId: string;
  title: string;
  genreLabel: string;
  level: "B2+";
  paragraphs: EssayModelParagraph[];
  text: string;
  wordCount: number;
  patterns: { fr: string; zh: string }[];
  unverified: true;
}

const make = (
  taskId: string,
  title: string,
  genreLabel: string,
  paragraphs: EssayModelParagraph[],
  patterns: { fr: string; zh: string }[],
): StaticEssayModel => {
  const text = paragraphs.map((p) => p.fr).join("\n\n");
  return {
    taskId,
    title,
    genreLabel,
    level: "B2+",
    paragraphs,
    text,
    wordCount: countWords(text),
    patterns,
    unverified: true,
  };
};

export const ESSAY_MODELS: StaticEssayModel[] = [
  make(
    "lettre-reclamation",
    "投诉信",
    "正式信件",
    [
      {
        fr: "Lyon, le 14 octobre 2025\nÀ l'attention du service clientèle de la société ÉlectroPlus\nObjet : Réclamation relative à la commande n° EP-48291 (lave-linge endommagé et retard de livraison)",
        technique: "完整正式信函版式（地点日期 + 收件部门 + 事由）",
        zhNote: "DELF B2 正式投诉信必须写清地点日期、收信部门和精确的 Objet（含订单号）。缺信头或事由会在「语体得体」与「连贯」被扣分。",
      },
      {
        fr: "Madame, Monsieur,",
        technique: "标准正式称呼",
        zhNote: "不知道收信人性别时固定用 Madame, Monsieur,，切忌在正式投诉信中使用 Bonjour 或 Salut。",
      },
      {
        fr: "Je me permets de vous écrire afin de vous faire part de mon vif mécontentement concernant ma commande n° EP-48291, passée sur votre site le 15 septembre dernier. Lors de l'achat, votre plateforme s'engageait formellement à livrer ce lave-linge sous cinq jours ouvrés, soit au plus tard le 22 septembre.",
        technique: "引言交代背景与合同承诺",
        zhNote: "用 Je me permets de vous écrire 礼貌切入，并用精确日期和 « s'engageait formellement à » 确立客观事实基础。",
      },
      {
        fr: "Or, l'appareil ne m'a été remis que le 6 octobre, avec deux semaines de retard, sans qu'aucun message d'explication ne me soit adressé. Qui plus est, lorsque le livreur a retiré l'emballage en ma présence, nous avons constaté une rayure profonde de près de quinze centimètres sur le hublot frontal. Bien que j'aie tenté de joindre votre assistance téléphonique à quatre reprises entre le 7 et le 11 octobre, je n'ai obtenu aucune réponse après plus de vingt minutes d'attente à chaque appel.",
        technique: "事实对比（Or / Qui plus est）+ 虚拟式让步（Bien que j'aie tenté）",
        zhNote: "以客观时间线与数字（两周延迟、15 厘米划痕、4 次拨打、每次等待 20 分钟）增强说服力；« sans qu'aucun… ne + 虚拟式 » 与 « Bien que + 过去虚拟式 » 是典型 B2+ 加分语法。",
      },
      {
        fr: "Cette situation étant particulièrement préjudiciable à mon organisation familiale, je vous demande de bien vouloir procéder, à vos frais, au remplacement de l'appareil par un modèle neuf et intact, ou, à défaut, au remboursement intégral de la somme versée, soit 549 euros, dans un délai de dix jours à compter de la réception de la présente lettre. Vous trouverez ci-joint la copie de la facture ainsi que des photographies attestant du défaut constaté. À défaut d'une réponse rapide et satisfaisante, je me verrais contraint(e) de saisir une association de consommateurs.",
        technique: "明确诉求 + 合理期限 + 礼貌保留维权（条件式）",
        zhNote: "提出具体、可执行的方案（免费换新或 10 天内全额退款），并用条件式 « je me verrais contraint(e) de » 温和而坚定地表达后续维权保留。",
      },
      {
        fr: "Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.\n\nCamille Laurent",
        technique: "正式落款（禁用 Cordialement）",
        zhNote: "将维权声明留在正文中，结尾段单独使用完整正式落款套语，版式更地道。",
      },
    ],
    [
      { fr: "Je me permets de vous écrire afin de vous faire part de mon vif mécontentement concernant…", zh: "我冒昧致信，就……向贵方表达强烈不满" },
      { fr: "sans qu'aucun message d'explication ne me soit adressé", zh: "在未向我发送任何解释说明的情况下（sans que + 虚拟式）" },
      { fr: "Bien que j'aie tenté de joindre… à quatre reprises", zh: "尽管我曾四次尝试联系……（Bien que + 过去虚拟式）" },
      { fr: "dans un délai de dix jours à compter de la réception de la présente lettre", zh: "自收到本函之日起十日内" },
      { fr: "sans laquelle je me verrais contraint(e) de saisir…", zh: "若未获回应，我将不得不诉诸……" },
    ],
  ),

  make(
    "lettre-motivation",
    "求职信",
    "求职信",
    [
      {
        fr: "Lyon, le 14 octobre 2025\nÀ l'attention de la Direction des ressources humaines – Agence Horizon Voyages\nObjet : Candidature au poste de conseiller(ère) en voyages et accueil bilingue (CDD 6 mois)",
        technique: "标准求职信信头与精准事由",
        zhNote: "清晰标明目标机构、职位名称和合同类型（CDD 6 mois），展现职业素养。",
      },
      {
        fr: "Madame, Monsieur,",
        technique: "正式称呼",
        zhNote: "统一使用正式称呼。",
      },
      {
        fr: "Votre offre d'emploi publiée récemment sur le site France Travail, concernant le recrutement d'un(e) conseiller(ère) en voyages parlant couramment le chinois pour une durée de six mois, a retenu toute mon attention. Passionné(e) par le secteur touristique et désireux(se) de mettre mes compétences linguistiques au service d'une clientèle internationale, je souhaite vous proposer ma candidature.",
        technique: "Vous（来信缘由 + 岗位匹配动机）",
        zhNote: "先回应对方需求（会中文、六个月合同），再点明自身意愿，体现法式求职信常见的 « Vous – Moi – Nous » 经典结构的第一步。",
      },
      {
        fr: "Titulaire d'une licence en langues étrangères appliquées et fort(e) d'une première expérience de huit mois en tant que chargé(e) d'accueil dans un office de tourisme, j'ai acquis une solide maîtrise de la relation client. Au cours de cette mission, j'ai notamment conçu des itinéraires culturels sur mesure pour des visiteurs asiatiques et géré les réservations ainsi que les imprévus avec réactivité. Par ailleurs, la pratique quotidienne des logiciels de billetterie m'a permis de gagner en rigueur et en efficacité.",
        technique: "Moi（学历 + 量化经历 + 具体成果）",
        zhNote: "用分词短语 « Titulaire d'une licence… et fort(e) d'une expérience de… » 压缩篇幅并提升句法高级感，强调可迁移的具体工作成果。",
      },
      {
        fr: "Rejoindre votre agence lyonnaise représenterait pour moi une formidable opportunité d'accompagner le développement de votre clientèle sinophone tout en m'investissant pleinement dans une équipe dynamique. Ma parfaite connaissance des attentes culturelles des voyageurs chinois, alliée à mon niveau avancé en français, constitue à mes yeux un véritable atout pour faciliter les échanges et fidéliser vos clients.",
        technique: "Nous（我能为贵司创造的价值）",
        zhNote: "用条件式 « représenterait » 体现谦逊与期待，突出中法双语与跨文化沟通能力对旅行社业务的具体价值。",
      },
      {
        fr: "Je reste à votre disposition pour tout entretien que vous jugerez utile, au cours duquel je pourrai vous exposer plus en détail mes motivations. Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.\n\nLin Wei",
        technique: "请求面试 + 完整敬语落款",
        zhNote: "用 « tout entretien que vous jugerez utile » 与关系从句 « au cours duquel » 优雅衔接面试邀约，保持全篇尊称 « vous » 与最高级正式敬语。",
      },
    ],
    [
      { fr: "Votre offre d'emploi publiée récemment… a retenu toute mon attention.", zh: "贵司近期发布的招聘启事引起了我的高度关注。" },
      { fr: "Titulaire d'une licence en… et fort(e) d'une expérience de…", zh: "拥有……学士学位并具备……经验（B2 求职信核心高分句式）" },
      { fr: "Rejoindre votre agence représenterait pour moi une formidable opportunité de…", zh: "加入贵机构对我而言将是……的宝贵机会" },
      { fr: "Je me tiens dès à présent à votre entière disposition pour un entretien, au cours duquel…", zh: "我随时静候面试安排，届时我将能……" },
    ],
  ),

  make(
    "courrier-voitures",
    "市中心禁止汽车通行",
    "读者来信",
    [
      {
        fr: "Madame la Rédactrice en chef,\nObjet : Réaction à votre dossier sur l'interdiction des voitures individuelles en centre-ville",
        technique: "致报社主编的读者来信格式",
        zhNote: "读者来信既属正式文体又带个人观点的报刊互动性；对主编可称呼 Madame la Rédactrice en chef 或 Madame, Monsieur,。",
      },
      {
        fr: "C'est avec un vif intérêt que j'ai lu votre article consacré au projet de la municipalité visant à interdire la circulation des voitures particulières dans le cœur de notre ville. Habitant moi-même le quartier Saint-Jean depuis six ans, je souhaite réagir à cette proposition qui suscite, à juste titre, de vifs débats.",
        technique: "强调句引入（C'est avec… que）+ 身份定位",
        zhNote: "交代自己是当地居民，立刻赋予论述贴近现实的可信度。",
      },
      {
        fr: "À titre personnel, je suis plutôt favorable à une réduction drastique du trafic automobile. En premier lieu, la qualité de l'air s'est nettement dégradée ces dernières années aux abords des écoles et des places commerçantes. Limiter la place de la voiture permettrait non seulement de diminuer les émissions polluantes et les nuisances sonores, mais aussi de rendre les rues plus sûres pour les piétons et les cyclistes. D'ailleurs, dans plusieurs villes européennes comme Gand ou Pontevedra, la piétonnisation a redynamisé le commerce de proximité au lieu de l'asphyxier.",
        technique: "论据一：环保安全 + 欧洲城市实证",
        zhNote: "给出健康、噪音与行人的双重好处，并引用欧洲其他城市步行化的实际效果作为例证，避免空洞说教。",
      },
      {
        fr: "Cependant, je comprends parfaitement l'inquiétude exprimée par certains commerçants et par les habitants des communes voisines. En effet, une interdiction brutale pénaliserait les personnes âgées, les familles avec de jeunes enfants ou encore les artisans qui ont besoin de transporter du matériel lourd. Par conséquent, il me semblerait maladroit d'appliquer cette mesure du jour au lendemain sans alternative crédible.",
        technique: "正反让步分析（Cependant / En effet / Par conséquent）",
        zhNote: "充分体察对立方的合理顾虑（老年人、带娃家庭、手工业者运输需求），体现 B2 辩证思维。",
      },
      {
        fr: "Pour que ce projet soit accepté par tous, il faudrait donc l'accompagner d'un renforcement des transports en commun en soirée, de parkings relais gratuits en périphérie et de dérogations ciblées pour les livraisons et les riverains. À ces conditions, notre centre-ville deviendra plus agréable sans exclure personne.\n\nVeuillez agréer, Madame, l'expression de ma considération distinguée.\n\nMarc Delacroix",
        technique: "折中可行性建议（Pour que + 虚拟式）+ 正式落款",
        zhNote: "提出三条具体配套举措（夜间公交、郊区免费换乘停车场、特许通行证），以 « À ces conditions » 与标准敬语收尾。",
      },
    ],
    [
      { fr: "C'est avec un vif intérêt que j'ai lu votre article consacré à…", zh: "我饶有兴致地阅读了贵报关于……的文章" },
      { fr: "la mesure permettrait non seulement de…, mais aussi de…", zh: "该举措不仅有助于……，还能……" },
      { fr: "il me semblerait maladroit d'appliquer cette mesure sans alternative crédible", zh: "在没有可靠替代方案的情况下推行此措施似乎并不妥当" },
      { fr: "Pour que ce projet soit accepté par tous, il faudrait donc l'accompagner de…", zh: "为使该项目获得各方接受，还须配套……（Pour que + 虚拟式）" },
    ],
  ),

  make(
    "essai-ecrans",
    "该不该限制孩子用屏幕",
    "议论文",
    [
      {
        fr: "Omniprésents dans nos foyers, les téléphones portables et les tablettes occupent aujourd'hui une place centrale dans le quotidien des enfants et des adolescents. Face à l'inquiétude croissante des parents et des enseignants, une question s'impose : faut-il imposer des limites strictes au temps passé devant les écrans ?",
        technique: "现象引入 + 明确提出核心问题（problématique）",
        zhNote: "议论文开头忌空泛背模板，用分词 « Omniprésents » 开篇，直指家庭与学校的真实焦虑并引出中心论题。",
      },
      {
        fr: "D'un côté, encadrer l'usage des écrans apparaît indispensable pour préserver la santé physique et psychologique des plus jeunes. De nombreuses études pédiatriques montrent qu'une exposition excessive, surtout le soir, nuit gravement à la qualité du sommeil, favorise la sédentarité et réduit la capacité de concentration en classe. Par exemple, un élève qui passe deux heures sur des vidéos courtes avant de dormir peine davantage à retenir ses leçons le lendemain. De plus, sans surveillance parentale, les enfants risquent d'être confrontés à des contenus choquants ou au cyberharcèlement sur les réseaux sociaux.",
        technique: "Thèse（必须限制的医学与学业依据 + 具体日常例子）",
        zhNote: "围绕睡眠、久坐、专注力及网络风险展开，并用具体中学生日常场景举例落地。",
      },
      {
        fr: "D'un autre côté, il serait illusoire et contre-productif de diaboliser le numérique. Tout d'abord, bien utilisés, ces outils constituent un formidable levier d'apprentissage : ils permettent d'écouter des langues étrangères, de vérifier une information ou de développer la créativité par le montage vidéo et le codage. Ensuite, des interdictions trop rigides provoquent souvent l'effet inverse chez les jeunes, en rendant l'écran d'autant plus désirable qu'il est défendu. L'enjeu n'est donc pas d'exclure les écrans, mais d'apprendre à en faire un usage raisonné et réfléchi.",
        technique: "Antithèse（反向反思：一味禁止适得其反 + 区分用途）",
        zhNote: "使用 « il serait illusoire de… » 等 B2 高级评判表达，提出「并非所有屏幕活动等价」和「禁令反弹效应」两层深意。",
      },
      {
        fr: "En définitive, plutôt que de miser sur la seule contrainte horaire, il convient d'instaurer un cadre clair et progressif. Fixer des moments sans téléphone, notamment pendant les repas et dans la chambre à coucher, tout en proposant des activités sportives ou culturelles attrayantes, reste la voie la plus équilibrée. Encore faut-il, bien entendu, que les adultes montrent eux-mêmes l'exemple au quotidien.",
        technique: "Synthèse（超越单一限时：场景规则 + 父母榜样，Encore faut-il que + 虚拟式）",
        zhNote: "结尾不简单重复前文，而是把问题升华至「场景管理 + 替代活动 + 家长示范」，用 « Encore faut-il que + 虚拟式 » 漂亮收束。",
      },
    ],
    [
      { fr: "il serait illusoire et contre-productif de diaboliser…", zh: "将……妖魔化既不现实也会适得其反" },
      { fr: "un formidable levier d'apprentissage", zh: "强有力的学习杠杆" },
      { fr: "rendant l'écran d'autant plus désirable qu'il est défendu", zh: "越是被禁止，屏幕就越让人渴望（d'autant plus … que）" },
      { fr: "Encore faut-il que les adultes montrent eux-mêmes l'exemple", zh: "但前提是成年人自己也得做出表率（Encore faut-il que + 虚拟式）" },
    ],
  ),

  make(
    "essai-etranger",
    "年轻人该不该出国待一年",
    "议论文",
    [
      {
        fr: "À l'heure de la mondialisation des études et du marché du travail, l'idée selon laquelle tous les jeunes devraient vivre au moins une année à l'étranger gagne en popularité. Si cette expérience est souvent présentée comme un passeport pour la réussite, mérite-t-elle vraiment d'être généralisée à l'ensemble d'une génération ?",
        technique: "让步式破题（Si cette expérience…, mérite-t-elle…）+ 宣布审慎立场",
        zhNote: "用 « Si + 让步陈述, 疑问反问 » 高效建立辩证框架，避免上来就绝对肯定或绝对否定。",
      },
      {
        fr: "Il est indéniable qu'un séjour prolongé hors de son pays d'origine offre des bénéfices considérables. Sur le plan linguistique, l'immersion quotidienne reste le moyen le plus rapide de maîtriser une langue vivante et d'oser s'exprimer sans crainte. Sur le plan personnel, devoir gérer seul un logement, des démarches administratives ou un budget dans un environnement inconnu forge l'autonomie et la confiance en soi. Par ailleurs, la confrontation à d'autres modes de vie développe l'ouverture d'esprit et aide à relativiser ses propres préjugés culturels, un atout de plus en plus recherché par les recruteurs.",
        technique: "论点分组（Sur le plan linguistique / personnel）",
        zhNote: "分语言能力、独立生活能力、跨文化视野三个维度论证，衔接紧密，动词搭配精准（forger l'autonomie, relativiser ses préjugés）。",
      },
      {
        fr: "Néanmoins, transformer cette opportunité en obligation pour tous poserait de sérieux problèmes d'équité et de pertinence. Tout d'abord, partir un an représente un coût financier important, que de nombreuses familles modestes ne peuvent assumer sans bourses publiques suffisantes. Ensuite, tous les projets professionnels ne nécessitent pas une mobilité internationale : un jeune qui se forme à un métier artisanal local ou qui doit soutenir un membre de sa famille âgé peut tout à fait s'épanouir sans quitter sa région. Enfin, certains étudiants souffrent d'un isolement profond loin de leurs repères, ce qui nuit parfois à leur parcours.",
        technique: "深度反论（经济门槛、职业差异、心理孤立）",
        zhNote: "不仅谈钱，还谈职业路径差异和心理适应成本，体现 B2 对社会公平性的深度思考。",
      },
      {
        fr: "Pour conclure, passer une année à l'étranger est une richesse précieuse lorsqu'elle correspond à un choix mûrement réfléchi, mais elle ne saurait devenir une norme universelle. Il serait donc préférable que les universités et les pouvoirs publics multiplient les aides financières pour rendre ce départ accessible à ceux qui le souhaitent, sans pour autant dévaloriser les parcours menés sur place.",
        technique: "合题收尾（保留选择权 + 公共财政托底，Il serait préférable que + 虚拟式）",
        zhNote: "结论既肯定流动价值又反对「一刀切」，用 « ne saurait devenir »（高阶条件式）与 « Il serait préférable que + 虚拟式 » 稳稳收官。",
      },
    ],
    [
      { fr: "Il est indéniable qu'un séjour prolongé offre des bénéfices considérables.", zh: "不可否认，长期海外居留能带来可观的益处。" },
      { fr: "Sur le plan linguistique… Sur le plan personnel…", zh: "在语言层面……在个人成长层面……（清晰的维度切分）" },
      { fr: "elle ne saurait devenir une norme universelle", zh: "它不能/不应成为一项普遍标准（高级否定书面语）" },
      { fr: "sans pour autant dévaloriser les parcours menés sur place", zh: "同时又不致贬低在本地完成的发展路径" },
    ],
  ),

  make(
    "doc-livraison",
    "材料题：一小时送达",
    "论坛发帖",
    [
      {
        fr: "Bonjour à tous,\nJe viens de lire avec attention le message précédent, qui met très justement le doigt sur l'envers du décor de la livraison en moins d'une heure. Si ce service séduit par sa rapidité apparente, il soulève selon moi de graves questions sociales et écologiques qu'on ne peut plus ignorer.",
        technique: "论坛得体开场 + 用自己的话概括材料争议（避免照抄原文）",
        zhNote: "论坛发帖语气自然而不失严谨。注意不要直接抄写材料中的 « livreur mal payé qui roule sous la pluie »，而是改写为 « l'envers du décor »、« questions sociales et écologiques »。",
      },
      {
        fr: "D'une part, cette course à l'instantanéité repose souvent sur une grande précarité humaine. Pour garantir des délais toujours plus courts, les plateformes imposent aux livreurs un rythme soutenu et une rémunération à la tâche qui les poussent à prendre des risques sur la route, y compris par mauvais temps. Dans ma ville, j'observe chaque soir des dizaines de jeunes à vélo attendre devant les restaurants sans véritable protection sociale ni pause digne de ce nom.",
        technique: "社会层面论证 + 身边观察实例",
        zhNote: "将材料线索拓展为平台算法计酬、零工经济缺乏社保的现实观察。",
      },
      {
        fr: "D'autre part, le bilan environnemental de ces commandes fractionnées est préoccupant. Multiplier les trajets individuels pour un simple repas ou trois articles d'épicerie augmente inutilement le trafic urbain, les émissions de gaz à effet de serre ainsi que la masse d'emballages jetables. En encourageant l'achat impulsif à toute heure, ce modèle nous éloigne des commerces de quartier où l'on se rendait autrefois à pied.",
        technique: "环境与社区影响（高频连接词 En encourageant）",
        zhNote: "从单次小额配送的碳排放、一次性包装以及对社区小店的冲击切入，论据饱满。",
      },
      {
        fr: "Certes, je reconnais volontiers que la livraison à domicile rend un précieux service aux personnes âgées, à mobilité réduite ou malades, qui peinent à porter des sacs lourds. Toutefois, ce besoin réel ne justifie pas l'exigence d'être servi en trente ou quarante minutes pour un simple caprice de confort.",
        technique: "合理让步（Certes… Toutefois…）区分刚需与即时消费冲动",
        zhNote: "先肯定特殊人群的真实配送需求，再精准反驳「30–40 分钟极速送达」只是过度便利。",
      },
      {
        fr: "À mon avis, la solution passe par davantage de modération et d'encadrement : regrouper les livraisons sur des créneaux de deux heures, imposer un tarif minimum respectueux du travail des livreurs et réapprendre à anticiper nos courses. Il s'agit, en définitive, d'une question de responsabilité collective.",
        technique: "具体折中方案 + 凝练总结",
        zhNote: "给出「2 小时拼单窗口 + 最低配送酬劳标准 + 提前规划采购」三条切实可行的建议，以书面感的 « responsabilité collective » 收束。",
      },
    ],
    [
      { fr: "mettre le doigt sur l'envers du décor", zh: "一针见血地指出光鲜背后的另一面" },
      { fr: "cette course à l'instantanéité repose sur une grande précarité", zh: "这种对即时性的追逐往往建立在极度的不稳定之上" },
      { fr: "ce besoin réel ne justifie pas l'exigence de…", zh: "这一真实需求并不能成为要求……的正当理由" },
      { fr: "regrouper les livraisons sur des créneaux de…", zh: "将配送集中到……的时间段内" },
    ],
  ),

  make(
    "doc-musees",
    "材料题：博物馆该不该免费",
    "读者来信",
    [
      {
        fr: "Madame, Monsieur,\nObjet : À propos du projet de gratuité des musées municipaux",
        technique: "读者来信标准信头",
        zhNote: "回应报刊新闻时先点明来信事由。",
      },
      {
        fr: "Suite à la parution de votre article concernant l'éventuelle gratuité permanente des musées municipaux, je me permets de vous écrire pour partager mon point de vue de contribuable et d'amateur de culture. Bien que l'intention affichée par la mairie soit généreuse, ce projet me paraît financièrement risqué s'il est appliqué sans distinction.",
        technique: "概括材料 + 明确折中偏审慎立场（Bien que + 虚拟式）",
        zhNote: "表明自己的双重身份（纳税人兼文化爱好者），在立场上既有态度又留有平衡空间。",
      },
      {
        fr: "Certes, l'argument selon lequel la culture doit rester accessible à tous est tout à fait légitime. Pour une famille modeste comptant trois enfants, le prix des billets d'entrée constitue parfois un frein réel à la découverte du patrimoine local. Supprimer cette barrière tarifaire permettrait sans doute d'attirer des publics qui n'osent pas pousser la porte d'un musée.",
        technique: "肯定材料正方观点（家庭负担），并用自己的话转述",
        zhNote: "避免照抄材料中 « la culture doit être accessible à tous » 原句太久，通过三口之家购票负担具体化。",
      },
      {
        fr: "Néanmoins, l'opposition n'a pas tort de souligner le coût élevé de cette mesure, estimé à deux millions d'euros par an. Dans un contexte budgétaire tendu, une telle somme risque soit d'alourdir les impôts locaux, soit de réduire les moyens consacrés aux écoles, aux bibliothèques ou à l'entretien des bâtiments publics. De plus, la gratuité totale profiterait largement aux touristes de passage, qui disposent déjà d'un budget pour leur séjour et accepteraient volontiers de payer un tarif raisonnable. Enfin, des études sociologiques montrent que la gratuité seule ne suffit pas à diversifier les visiteurs : ce sont surtout les habitudes culturelles et l'éducation artistique à l'école qui comptent.",
        technique: "深挖预算机会成本 + 回应游客搭便车 + 社会学反直觉洞察",
        zhNote: "三层递进反驳「一刀切全免费」：财政挤占风险、游客红利外溢、以及仅仅免费并不能解决文化参与鸿沟。",
      },
      {
        fr: "C'est pourquoi il serait plus juste d'instaurer une gratuité ciblée, réservée aux habitants de la commune, aux jeunes de moins de vingt-six ans, aux étudiants et aux demandeurs d'emploi, tout en maintenant un billet modéré pour les visiteurs extérieurs. On concilierait ainsi justice sociale et responsabilité budgétaire.\n\nVeuillez agréer, Madame, Monsieur, l'expression de mes salutations respectueuses.\n\nSophie Mercier",
        technique: "精准分级定价方案 + 双赢结论 + 正式落款",
        zhNote: "提出对本地居民、26 岁以下青年、学生和求职者定向免费，对外地游客保留适度票价，兼顾社会公平与财政可持续性。",
      },
    ],
    [
      { fr: "ce projet me paraît financièrement risqué s'il est appliqué sans distinction", zh: "若不加区分地推行，该项目在财政上似乎风险过高" },
      { fr: "un frein réel à la découverte du patrimoine", zh: "了解本地文化遗产的真实障碍" },
      { fr: "Dans un contexte budgétaire tendu, une telle somme risque soit de…, soit de…", zh: "在预算紧张的背景下，这笔款项要么会……，要么会……" },
      { fr: "instaurer une gratuité ciblée… tout en maintenant un tarif modéré pour…", zh: "实行定向免费……同时对……维持适度票价" },
    ],
  ),

  make(
    "doc-sommeil",
    "材料题：学校晚一点上课",
    "报刊评论文章",
    [
      {
        fr: "Selon une récente enquête sur le rythme biologique des adolescents, la majorité des lycéens dorment moins de sept heures par nuit durant la semaine. Face à ce constat alarmant, plusieurs chercheurs recommandent de décaler le début des cours à neuf heures au lieu de huit heures. Si cette proposition suscite l'enthousiasme de nombreux élèves, elle mérite d'être examinée dans toutes ses dimensions.",
        technique: "校园报刊文章风格（概括研究背景 + 承上启下引出正反分析）",
        zhNote: "题干要求给学生报写评论文章，开篇简明复述研究发现与建议，再用 « mérite d'être examinée dans toutes ses dimensions » 自然进入分析。",
      },
      {
        fr: "Il faut reconnaître que ce changement présenterait des avantages indéniables sur le plan de la santé et de la réussite scolaire. Les spécialistes rappellent que l'horloge biologique des jeunes se décale naturellement à l'adolescence : se lever à six heures trente provoque une dette de sommeil chronique, source de fatigue, d'irritabilité et de décrochage. En commençant une heure plus tard, les élèves arriveraient plus reposés, suivraient plus attentivement les cours du matin et seraient moins souvent en retard ou absents, comme l'ont déjà constaté certains lycées pilotes à l'étranger.",
        technique: "Plan analytique 第一步：科学依据（青春期生物钟后移）与教学收益",
        zhNote: "准确解释生理机制（horloge biologique se décale、dette de sommeil chronique），说明为何推迟一小时能提高专注度并减少迟到缺勤。",
      },
      {
        fr: "Toutefois, la mise en œuvre d'un tel horaire soulèverait d'importantes difficultés d'organisation. D'une part, décaler la rentrée du matin obligerait soit à terminer la journée plus tard, au détriment des activités sportives, artistiques et des devoirs du soir, soit à raccourcir la pause déjeuner. D'autre part, dans les zones rurales notamment, les transports scolaires sont coordonnés entre collèges et lycées ; modifier les horaires d'un seul établissement perturberait l'ensemble du réseau de bus ainsi que l'organisation professionnelle de nombreux parents.",
        technique: "Plan analytique 第二步：执行阻力（放学变晚、校车联动、农村交通与家长接送）",
        zhNote: "紧扣法国高中真实运作细节（校车与初中联动、乡村地区交通、课外活动与午餐时间压缩），展现极强的现实论证力。",
      },
      {
        fr: "En somme, reculer l'heure d'entrée à neuf heures constitue une piste prometteuse, à condition qu'elle ne se traduise pas par une surcharge en fin d'après-midi. Avant toute généralisation, il conviendrait de lancer une expérimentation sur une année dans plusieurs lycées volontaires et d'éduquer en parallèle les jeunes à limiter les écrans tard le soir, sans quoi l'heure gagnée le matin serait vite perdue.",
        technique: "条件式综合结论（à condition que + 虚拟式 + 配套教育建议）",
        zhNote: "非常精彩的结尾洞察：先试点再推广，同时提醒必须配合减少睡前看屏幕，否则推迟一小时只会被熬夜抵消。",
      },
    ],
    [
      { fr: "Face à ce constat alarmant, plusieurs chercheurs recommandent de…", zh: "面对这一令人担忧的现状，多位研究者建议……" },
      { fr: "provoquer une dette de sommeil chronique", zh: "造成长期睡眠不足/睡眠债" },
      { fr: "la mise en œuvre d'un tel horaire soulèverait d'importantes difficultés", zh: "实施这一作息安排将引发重大的组织困难" },
      { fr: "à condition qu'elle ne se traduise pas par une surcharge", zh: "只要它不导致……的负担加重（à condition que + 虚拟式）" },
      { fr: "sans quoi l'heure gagnée le matin serait vite perdue", zh: "否则早上多睡的那一小时很快就会白费" },
    ],
  ),

  make(
    "doc-mediatheque",
    "材料题：缩减市立图书馆开放时间",
    "正式信件",
    [
      {
        fr: "Objet : Réaction à la réduction des horaires d'ouverture de la médiathèque centrale\n\nMonsieur le Maire,\n\nAu nom du collectif « Lecteurs Unis », je me permets d'attirer votre attention sur la récente décision municipale visant à limiter l'accès à la médiathèque centrale, qui fermera désormais à 18 heures en semaine et restera inaccessible le dimanche. Cette mesure, prise dans le but de réduire les dépenses énergétiques, suscite notre profonde inquiétude.",
        technique: "正式信件抬头（Objet + Monsieur le Maire）与转述公告立场",
        zhNote: "开篇明确标出信件主题（Objet）和正式称呼（Monsieur le Maire），用自己的话转述市政府公告并代表读者集体表明关切。",
      },
      {
        fr: "Cette restriction aura des conséquences notables pour de nombreux usagers. Les salariés et actifs, dont la majorité termine leur journée de travail à 18 heures, se verront privés d'accès à la médiathèque en semaine. Les étudiants, qui bénéficient d'un environnement propice au travail et à la recherche, perdront un lieu essentiel à leur réussite académique. Quant aux personnes âgées, souvent isolées, elles risquent de voir se réduire un espace de socialisation et d'épanouissement culturel.",
        technique: "分层论证对上班族、学生与老年群体三类受众的影响",
        zhNote: "按不同群体（Les salariés… / Les étudiants… / Quant aux personnes âgées…）逐层展开负面后果，兼顾实用学习功能与社会联结价值。",
      },
      {
        fr: "Par ailleurs, il nous semble réducteur de considérer que le prêt de livres numériques peut compenser la fermeture anticipée. Nombre d'usagers rencontrent des difficultés d'accès au numérique, soit par manque d'équipement, soit par méconnaissance des outils. De plus, la lecture prolongée sur écran entraîne une fatigue visuelle non négligeable. Enfin, la médiathèque ne se limite pas à l'emprunt d'ouvrages : elle constitue un lieu de rencontre, d'échanges et d'études irremplaçable pour le lien social.",
        technique: "驳论段：直击电子书替代论的三大漏洞（数字鸿沟、用眼疲劳、公共空间缺失）",
        zhNote: "用 « il nous semble réducteur de considérer que… » 委婉反驳官方建议，从数字鸿沟、用眼健康和公共社交纽带三点拆解“仅靠电子书”方案的不合理性。",
      },
      {
        fr: "Conscients de la nécessité de réaliser des économies d'énergie, nous proposons d'étudier des alternatives réalistes : regrouper les activités en soirée dans une seule salle chauffée, ouvrir la médiathèque en nocturne deux jours par semaine, ou encore ajuster l'éclairage et la température selon la fréquentation. Ces compromis permettraient de concilier sobriété énergétique et maintien d'un service public essentiel.\n\nDans l'attente de votre réponse, je vous prie d'agréer, Monsieur le Maire, l'expression de ma considération distinguée.",
        technique: "建设性折中方案 + 标准官方致敬落款（无 Cordialement）",
        zhNote: "最后先肯定节能初衷，再提出分区供暖、每周两次夜间延后闭馆等具体可行折中办法，并以正式向市长致敬的标准套语收尾。",
      },
    ],
    [
      { fr: "je me permets d'attirer votre attention sur…", zh: "谨冒昧提请您关注……（正式信件高频开头）" },
      { fr: "un environnement propice au travail et à la recherche", zh: "有利于学习与研究的环境" },
      { fr: "il nous semble réducteur de considérer que…", zh: "认为……未免有失偏颇（礼貌而有力地反驳）" },
      { fr: "concilier sobriété énergétique et maintien d'un service public", zh: "兼顾能源节约与公共服务维持" },
      { fr: "je vous prie d'agréer, Monsieur le Maire, l'expression de ma considération distinguée.", zh: "向市长/公职人员致信的标准正式结尾敬语" },
    ],
  ),
];

export const modelEssayFor = (taskId: string): StaticEssayModel | undefined =>
  ESSAY_MODELS.find((m) => m.taskId === taskId);
