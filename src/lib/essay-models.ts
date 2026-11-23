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
      { fr: "À défaut d'une réponse rapide et satisfaisante, je me verrais contraint(e) de saisir…", zh: "若未获快速令人满意的答复，我将不得不诉诸……" },
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
      { fr: "Titulaire d'une licence en… et fort(e) d'une première expérience de…", zh: "拥有……学士学位并具备……初次经验（B2 求职信核心高分句式）" },
      { fr: "Rejoindre votre agence lyonnaise représenterait pour moi une formidable opportunité d'…", zh: "加入贵公司对我而言将是……的宝贵机会" },
      { fr: "Je reste à votre disposition pour tout entretien que vous jugerez utile, au cours duquel…", zh: "我随时配合贵司认为必要的面试安排，届时我将能……" },
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
      { fr: "C'est avec un vif intérêt que j'ai lu votre article consacré au…", zh: "我饶有兴致地阅读了贵报关于……的文章" },
      { fr: "permettrait non seulement de…, mais aussi de…", zh: "不仅有助于……，还能……" },
      { fr: "il me semblerait maladroit d'appliquer cette mesure du jour au lendemain sans alternative crédible", zh: "在没有可靠替代方案的情况下仓促推行此措施似乎并不妥当" },
      { fr: "Pour que ce projet soit accepté par tous, il faudrait donc l'accompagner d'…", zh: "为使该项目获得各方接受，还须配套……（Pour que + 虚拟式）" },
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
      { fr: "Encore faut-il, bien entendu, que les adultes montrent eux-mêmes l'exemple", zh: "但前提当然是成年人自己也得做出表率（Encore faut-il que + 虚拟式）" },
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
      { fr: "Il est indéniable qu'un séjour prolongé… offre des bénéfices considérables.", zh: "不可否认，长期海外居留能带来可观的益处。" },
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
      { fr: "met très justement le doigt sur l'envers du décor", zh: "一针见血地指出了光鲜背后的另一面" },
      { fr: "cette course à l'instantanéité repose souvent sur une grande précarité", zh: "这种对即时性的追逐往往建立在极度的不稳定之上" },
      { fr: "ce besoin réel ne justifie pas l'exigence d'…", zh: "这一真实需求并不能成为要求……的正当理由" },
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
      { fr: "Dans un contexte budgétaire tendu, une telle somme risque soit d'…, soit de…", zh: "在预算紧张的背景下，这笔款项要么会……，要么会……" },
      { fr: "instaurer une gratuité ciblée… tout en maintenant un billet modéré pour…", zh: "实行定向免费……同时对……维持适度票价" },
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
      { fr: "provoque une dette de sommeil chronique", zh: "造成长期睡眠不足/睡眠债" },
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

  make(
    "courrier-emballages",
    "材料题：超市全面推行散装零包装购物",
    "读者来信",
    [
      {
        fr: "Objet : Réaction au projet d'arrêté sur la vente en vrac dans les grandes surfaces\n\nMadame, Monsieur,\n\nLa lecture de votre récent article consacré à l'obligation future de réserver trente pour cent des rayons alimentaires à la vente en vrac appelle selon moi une analyse nuancée. Si l'ambition écologique qui inspire ce projet mérite d'être saluée face à l'accumulation préoccupante des déchets plastiques, ses modalités d'application soulèvent plusieurs interrogations concrètes pour les foyers du quotidien.",
        technique: "正式读者来信开头与辩证立意（先肯定减塑初衷，再提出落地疑虑）",
        zhNote: "标准报刊读者来信抬头与称呼，开篇避免简单站队，先用礼貌而凝练的表达确立辩证分析立场。",
      },
      {
        fr: "En premier lieu, il est indéniable que le recours systématique aux emballages à usage unique constitue un gaspillage écologique majeur. Encourager les consommateurs à apporter leurs propres bocaux réutilisables et réduire le suremballage industriel permettrait de diminuer durablement le volume des ordures ménagères. À cet égard, la loi anti-gaspillage ouvre la voie à une consommation plus sobre et plus responsable dont chacun finira par bénéficier.",
        technique: "论据一：从源头减废角度论证散装专区的长期生态收益",
        zhNote: "正面肯定散装模式对减少一次性包装和工业过度包装的实际作用，顺带呼应法国反浪费法方向。",
      },
      {
        fr: "Toutefois, imposer brutalement un seuil uniforme de trente pour cent risque de pénaliser certains publics et commerçants. D'une part, les familles nombreuses ou les travailleurs aux horaires contraints manquent parfois de temps pour gérer les contenants et peser chaque denrée. D'autre part, les règles d'hygiène strictes et le nettoyage des distributeurs entraînent des coûts logistiques supplémentaires qui ne doivent pas être répercutés sur les ménages modestes.",
        technique: "让步与局限剖析：关注多子女家庭时间成本、卫生监管与物价转嫁风险",
        zhNote: "切中法国现实辩论中的社会公平痛点：减塑不应以隐性涨价或增加基层市民负担为代价。",
      },
      {
        fr: "C'est pourquoi il conviendrait d'accompagner cette transition de manière progressive, en garantissant d'abord la gratuité de contenants consignés à l'entrée des magasins et en maintenant un écart de prix favorable au vrac. C'est à cette double condition que les citoyens adhéreront durablement à ce nouveau mode d'achat.\n\nJe vous prie d'agréer, Madame, Monsieur, l'expression de ma considération distinguée.",
        technique: "建设性条件收束 + 正式读者来信落款",
        zhNote: "用押金循环容器和散装优惠价提出可操作条件，最后以完整正式敬语结束全文。",
      },
    ],
    [
      { fr: "appelle selon moi une analyse nuancée", zh: "在我看来需要辩证细致地剖析" },
      { fr: "le recours systématique aux emballages à usage unique", zh: "习惯性使用一次性包装" },
      { fr: "être répercutés sur les ménages modestes", zh: "转嫁到中低收入家庭身上" },
      { fr: "C'est à cette double condition que…", zh: "唯有满足这两重条件，……才……" },
    ],
  ),

  make(
    "essai-intergeneration",
    "青年与老人代际合租值得政府大规模资助吗？",
    "议论文",
    [
      {
        fr: "Dans de nombreuses métropoles françaises, deux difficultés sociales se croisent de façon paradoxale : d'une part, des milliers d'étudiants peinent à se loger à un tarif abordable ; d'autre part, de nombreuses personnes âgées souffrent d'un profond isolement dans des appartements devenus trop grands. Face à ce constat, certains élus proposent que les collectivités financent massivement la cohabitation intergénérationnelle. Une telle politique doit-elle pour autant devenir une priorité publique ?",
        technique: "对比反差引入现象 + 自然导出核心问题",
        zhNote: "首段将学生租房难与老年人孤独这两大社会痛点并置，引出公共财政是否应大规模资助代际合租的讨论。",
      },
      {
        fr: "D'un côté, ce modèle d'habitat partagé présente des bénéfices humains et financiers indéniables. En accueillant un jeune contre un loyer modique, le senior retrouve une présence rassurante au quotidien, ce qui prévient le sentiment de solitude et retarde parfois le recours aux maisons de retraite médicalisées. Réciproquement, l'étudiant bénéficie d'un logement calme et décent à proximité de son université sans s'endetter lourdement.",
        technique: "正面立论：双向互惠（老年人情感陪伴 + 青年减轻租房经济重负）",
        zhNote: "用 « Réciproquement » 体现双赢视角，语言书面精准，句式长短交错。",
      },
      {
        fr: "D'un autre côté, il serait illusoire de voir dans la cohabitation intergénérationnelle un remède universel à la crise du logement. Vivre sous le même toit suppose une entente personnelle délicate autour des horaires, du bruit et du respect de l'intimité. Sans médiation associative sérieuse et sans charte juridique claire, des malentendus risquent de surgir rapidement. De plus, cette entraide citoyenne ne doit jamais servir de prétexte aux pouvoirs publics pour réduire la construction de résidences universitaires ou le recrutement d'aides à domicile professionnelles.",
        technique: "反方深入反思：隐私边界、专业介导需求与「不可替代公共责任」",
        zhNote: "高级 B2 写法：先分析合租现实摩擦，再从公共政策角度指出私人互助不应成为政府逃避建造学生公寓的借口。",
      },
      {
        fr: "En définitive, il me paraît judicieux que les mairies subventionnent l'encadrement associatif chargé de mettre en relation les binômes volontaires et de garantir leur suivi. Toutefois, ces aides doivent venir en complément, et non en remplacement, d'une véritable politique ambitieuse du logement social et du grand âge.",
        technique: "客观折中结语：支持社区协会介导补贴，守住公共保障底线",
        zhNote: "用 « en complément, et non en remplacement » 精准收尾，观点成熟平衡。",
      },
    ],
    [
      { fr: "deux difficultés sociales se croisent de façon paradoxale", zh: "两大社会难题以充满悖论的方式交织" },
      { fr: "il serait illusoire de voir dans… un remède universel", zh: "把……视作万能解药未免不切实际" },
      { fr: "ne doit jamais servir de prétexte… pour réduire", zh: "绝不能成为削减……的借口" },
      { fr: "en complément, et non en remplacement, d'une…", zh: "作为……的补充，而非替代" },
    ],
  ),

  make(
    "lettre-budget-participatif",
    "材料题：参与式预算透明度与投票率改善建议",
    "正式信件",
    [
      {
        fr: "Objet : Propositions pour renforcer la participation citoyenne et l'équité du budget participatif\n\nMonsieur le Maire,\n\nAu nom du conseil de quartier des Lilas, je me permets de vous faire part de notre analyse suite à la publication du bilan annuel du budget participatif municipal. Bien que la mise en place de cet outil constitue une avancée démocratique appréciable, le taux de participation limité à 4,2 pour cent ainsi que la forte concentration des projets retenus au centre-ville méritent toute votre attention.",
        technique: "官方机构信函标准开头：单位代表身份 + 数据背景转述 + 礼貌切入诉求",
        zhNote: "使用 « Objet : ... / Monsieur le Maire, »，并引用数据同时保持尊重建设性的语气。",
      },
      {
        fr: "À notre sens, cette faible mobilisation s'explique avant tout par un défaut d'accessibilité. En réservant le scrutin exclusivement aux plateformes numériques, la municipalité écarte de fait de nombreux résidents âgés ou peu familiers des outils informatiques. Par ailleurs, la communication autour du calendrier des votes demeure trop discrète dans nos secteurs périphériques, ce qui laisse croire à certains habitants que les décisions sont prises à l'avance.",
        technique: "原因剖析：数字投票单一门槛与外围街区宣传缺位导致信任流失",
        zhNote: "从渠道排斥（illectronisme 隐含痛点）和宣传不均两个维度清晰拆解仅 4.2% 投票率的原因。",
      },
      {
        fr: "Concernant la répartition géographique des crédits, la règle actuelle favorise mécaniquement les quartiers centraux, plus denses et mieux organisés pour mobiliser leurs réseaux associatifs en ligne. Or, huit projets sur dix concentrés dans le cœur de ville risquent d'accentuer un sentiment d'abandon chez les habitants de la périphérie, alors même que nos écoles et espaces verts ont besoin d'équipements de proximité.",
        technique: "地理失衡批判：指出单纯按绝对票数分配在结构上偏向核心区",
        zhNote: "深入指出投票规则背后的结构性偏差，语言克制却富有说服力。",
      },
      {
        fr: "Afin de remédier à cette situation, nous vous proposons deux mesures concrètes : installer des urnes physiques dans les mairies annexes et les médiathèques, et garantir une enveloppe minimale dédiée à chaque quartier selon sa population. Nous restons à votre entière disposition pour en débattre lors d'une prochaine réunion publique.\n\nJe vous prie d'agréer, Monsieur le Maire, l'expression de ma considération distinguée.",
        technique: "具体双轨改进方案（物理票箱 + 分区最低预算池）与标准官方落款",
        zhNote: "两条建议可操作性强，结尾严格使用与市长身份对应的正式致敬套语。",
      },
    ],
    [
      { fr: "je me permets de vous faire part de notre analyse", zh: "谨向您呈报我们的分析意见" },
      { fr: "écarte de fait de nombreux résidents", zh: "在事实上排除了众多居民" },
      { fr: "accentuer un sentiment d'abandon", zh: "加剧被忽视与边缘化感受" },
      { fr: "afin de remédier à cette situation", zh: "为纠正这一状况" },
    ],
  ),

  make(
    "article-ia-recherche",
    "材料题：公共医疗与科研该用 AI 决策吗？",
    "评论文章",
    [
      {
        fr: "L'intelligence artificielle à l'hôpital : outil précieux ou arbitre opaque ?\n\nL'expérimentation menée récemment par un centre hospitalier universitaire, qui confie à un algorithme le pré-tri des dossiers médicaux et l'orientation de bourses scientifiques, marque un tournant décisif. Si l'outil affiche une baisse spectaculaire de quarante pour cent des délais administratifs, la réserve exprimée par de nombreux chercheurs rappelle qu'en matière de santé et de science, la rapidité ne peut tenir lieu de boussole éthique.",
        technique: "新闻评论吸睛双问小标题 + 转述试点事实与核心价值冲突",
        zhNote: "文章体裁开篇配提问式标题，将「省时 40%」与「伦理透明度疑虑」对比引出下文深度评论。",
      },
      {
        fr: "Il serait cependant réducteur de rejeter par principe ces avancées technologiques. Dans des hôpitaux souvent saturés, automatiser l'analyse documentaire ou le classement préliminaire de dossiers volumineux libère un temps précieux pour les équipes soignantes, qui peuvent alors se consacrer davantage à l'écoute des patients. Dans le champ scientifique, l'intelligence artificielle permet aussi de repérer des corrélations prometteuses au sein de bases de données colossales.",
        technique: "辩证肯定：区分工具辅助提效价值与核心裁量权外包风险",
        zhNote: "体现成熟立论：不妖魔化技术，而是肯定其在减少文书积压与大数据筛查方面的积极贡献。",
      },
      {
        fr: "Toutefois, déléguer l'évaluation humaine à une boîte noire pose deux écueils majeurs. D'abord, aucun jeu de données historiques n'est exempt de biais statistiques : un modèle entraîné sur le passé risque de reproduire des inégalités d'accès aux soins ou de défavoriser des recherches innovantes jugées atypiques. Ensuite, l'opacité des critères algorithmiques affaiblit la responsabilité juridique et médicale en cas d'erreur grave.",
        technique: "核心驳论：历史数据偏见继承 + 黑箱导致的医疗科研问责模糊",
        zhNote: "两点技术伦理切中要害，用词如 « boîte noire », « biais statistiques », « responsabilité » 契合 DELF B2 科学伦理主题。",
      },
      {
        fr: "En somme, l'algorithme doit demeurer un simple assistant technique et non un décideur souverain. Pour préserver la confiance du public comme l'équité scientifique, il importe que les critères soient audités de manière indépendante, que chaque patient puisse solliciter un réexamen et que la décision finale relève toujours d'un jugement humain explicable et motivé.",
        technique: "有力收尾：确立「可审计 + 人类最终可解释裁决」双重原则",
        zhNote: "用 « il importe que + 虚拟式 » 与精准对比结束全文，逻辑严密。",
      },
    ],
    [
      { fr: "la rapidité ne peut tenir lieu de boussole éthique", zh: "速度不能取代伦理指南针" },
      { fr: "il serait cependant réducteur de rejeter par principe…", zh: "一味原则性排斥未免以偏概全" },
      { fr: "aucun jeu de données historiques n'est exempt de biais", zh: "没有任何数据集能完全免于偏见" },
      { fr: "demeurer un simple assistant… et non un décideur souverain", zh: "始终充当辅助工具，而非最终裁决者" },
    ],
  ),

  make(
    "essai-infox-ecole",
    "信息核查课应成为高中正式评估科目吗？",
    "议论文",
    [
      {
        fr: "À l'ère des algorithmes de recommandation et des vidéos courtes virales, la majorité des lycéens s'informent désormais sur les réseaux sociaux plutôt que par la presse écrite. Face à la multiplication des rumeurs manipulées et des images truquées par intelligence artificielle, certains responsables éducatifs proposent de transformer l'éducation aux médias en une discipline obligatoire sanctionnée par une note au baccalauréat. Cette formalisation scolaire est-elle la bonne réponse ?",
        technique: "现象引入：青少年信源渠道迁移 + 紧扣题干提出审慎质疑",
        zhNote: "首段准确概括当代中学生的信息环境与题干改革提案。",
      },
      {
        fr: "D'un côté, intégrer pleinement l'apprentissage de la vérification des sources dans les emplois du temps répond à une urgence civique évidente. Savoir distinguer un fait vérifié d'une opinion partisane, recouper une information avant de la relayer ou identifier l'intérêt commercial derrière un contenu sponsorisé ne va pas de soi. L'école a précisément pour mission de doter chaque futur citoyen d'un esprit critique solide, indépendamment de son milieu familial.",
        technique: "论证必要性：跨社会阶层普及媒介批判性思辨属学校公民教育职责",
        zhNote: "将媒介核查提升至教育公平与公民素养的高度展开论证，论点饱满。",
      },
      {
        fr: "D'un autre côté, évaluer cette compétence par un examen classique noté sur vingt suscite de sérieuses réserves. Le risque principal réside dans une dérive scolaire vers le bachotage : les élèves pourraient mémoriser des recettes mécaniques pour obtenir la moyenne sans exercer réellement leur doute méthodique hors de la classe. Par ailleurs, la liberté de conscience exige de ne pas noter les convictions politiques ou personnelles d'un adolescent lors d'un débat sur l'actualité.",
        technique: "让步与反转：指出应试化（bachotage）及打分侵犯观点自由的两大隐患",
        zhNote: "直击题干核心限制词 « obligatoire et notée »，展现极佳的审题深度。",
      },
      {
        fr: "Pour conclure, plutôt que de créer une nouvelle matière académique sanctionnée par un contrôle chiffré, il vaudrait mieux inscrire des ateliers pratiques d'enquête journalistique au cœur des enseignements existants d'histoire, de sciences et de français, tout en formant continuellement les professeurs aux nouveaux outils numériques.",
        technique: "建设性结论：以跨学科实操工作坊与师资培训替代传统笔试打分",
        zhNote: "以清晰的对比偏好句式 « plutôt que de…, il vaudrait mieux… » 収束全文。",
      },
    ],
    [
      { fr: "distinguer un fait vérifié d'une opinion partisane", zh: "区分经核实的事实与带立场的观点" },
      { fr: "recouper une information avant de la relayer", zh: "在转发前交叉核实信息" },
      { fr: "une dérive scolaire vers le bachotage", zh: "滑向应试突击刷题的偏向" },
      { fr: "inscrire des ateliers pratiques d'enquête journalistique au cœur des enseignements", zh: "将实操工作坊融入现有学科教学核心" },
    ],
  ),

  make(
    "lettre-loyers",
    "材料题：致市区长要求规制核心区短租与空置房",
    "正式信件",
    [
      {
        fr: "Objet : Demande de régulation urgente des meublés touristiques dans notre arrondissement\n\nMonsieur le Maire,\n\nReprésentant l'association des riverains du quartier Saint-Pierre, je me permets d'attirer votre attention sur les conclusions alarmantes de la récente étude consacrée au logement dans notre centre historique. Le triplement des locations touristiques de courte durée en cinq ans, accompagné d'une hausse de vingt-huit pour cent des loyers résidentiels, menace désormais directement l'équilibre social de notre secteur.",
        technique: "标准市政致信抬头与核心数据转述（不照抄原句）",
        zhNote: "信函格式完全规范，开篇准确消化材料中「短租翻三倍」「房租涨 28%」的核心事实并点明居民诉求。",
      },
      {
        fr: "Les conséquences de cette spéculation immobilière sont déjà visibles dans notre quotidien. La fermeture annoncée de deux classes à l'école primaire du quartier démontre que les jeunes familles, tout comme les enseignants ou les infirmiers, n'ont plus les moyens de s'installer durablement ici. Peu à peu, les commerces de proximité ferment ou cèdent la place à des boutiques de souvenirs destinées aux seuls visiteurs de passage.",
        technique: "社会后果论证：学校撤班、基层公职人员流失与街区商业空心化",
        zhNote: "将冰冷的租金数据转化为看得见的教育与社区衰退图景，极富说服力。",
      },
      {
        fr: "Nous sommes pleinement conscients que le rayonnement touristique contribue au dynamisme économique de la commune et ne demandons nullement d'interdire l'accueil des voyageurs. Néanmoins, la vocation première d'un immeuble d'habitation reste de loger les habitants permanents avant de servir de résidence hôtelière déguisée échappant souvent aux contraintes des professionnels de l'hôtellerie.",
        technique: "理性回应旅游收益关切，明确区分常住住宅功能与隐形酒店化套利",
        zhNote: "先承认旅游经济贡献（先让步再界定原则），显出成熟市民代表的克制与条理。",
      },
      {
        fr: "C'est pourquoi notre collectif vous demande d'abaisser le plafond annuel de location touristique pour les résidences principales, d'instaurer une autorisation stricte de changement d'usage et de majorer la taxe sur les logements durablement vacants, tout en soutenant la création de logements abordables pour les familles. En espérant qu'une rencontre puisse être organisée prochainement avec les services municipaux, je vous prie d'agréer, Monsieur le Maire, l'expression de ma considération distinguée.",
        technique: "三项可操作市政诉求 + 标准官方礼貌敬语",
        zhNote: "建议切合法国实际城市立法工具（天数年限、用途变更许可、空置税），落款严谨。",
      },
    ],
    [
      { fr: "menace désormais directement l'équilibre social", zh: "如今已直接威胁社会结构平衡" },
      { fr: "cèdent la place à…", zh: "被……所取代／让位于……" },
      { fr: "ne demandons nullement d'interdire…", zh: "绝非要求……" },
      { fr: "instaurer une autorisation stricte de changement d'usage", zh: "建立严格的房屋用途变更审批制" },
    ],
  ),

  make(
    "courrier-pouvoir-achat",
    "材料题：环保征税该提高还是改用收入返还补贴？",
    "读者来信",
    [
      {
        fr: "Objet : Fiscalité écologique et justice sociale : pour une transition équitable\n\nMadame, Monsieur,\n\nVotre note économique consacrée au relèvement éventuel des taxes sur les carburants fossiles touche au cœur d'un dilemme majeur de notre époque : comment financer la transition énergétique sans fragiliser davantage le pouvoir d'achat des foyers ? Si l'urgence climatique impose des choix budgétaires courageux, la méthode fiscale proposée suscite une vive inquiétude légitime.",
        technique: "读者来信抬头 + 高度概括经济材料中的财政与民生两难",
        zhNote: "开篇点明气候预算需求与工薪阶层生活压力的张力，自然展开读者评论。",
      },
      {
        fr: "Certes, le principe du pollueur-payeur repose sur une logique économique cohérente. Envoyer un signal-prix clair aux consommateurs comme aux industriels encourage progressivement l'abandon des véhicules les plus gourmands et incite à investir dans l'isolation thermique des logements. Par ailleurs, ces recettes fiscales pourraient abonder utilement le développement des transports collectifs de proximité.",
        technique: "肯认生态价格信号与公共筹资逻辑",
        zhNote: "使用 « pollueur-payeur » 与 « signal-prix » 等经济专栏高频术语。",
      },
      {
        fr: "Cependant, comme le soulignent justement plusieurs économistes cités dans vos colonnes, une hausse uniforme de la taxe frappe de façon profondément inégalitaire les ménages modestes. Ceux-ci consacrent déjà une part bien supérieure de leurs revenus à l'énergie et habitent souvent en zone rurale ou périurbaine sans alternative ferroviaire pour se rendre au travail. Une écologie perçue comme punitive risque ainsi de provoquer un rejet social durable.",
        technique: "痛点拆解：均匀加税的累退本质（城乡公共交通落差与低收入占比失衡）",
        zhNote: "精准指出相同税率对不同群体造成截然不同的负担，为下文返还方案铺垫。",
      },
      {
        fr: "Il me semble donc indispensable que chaque euro perçu au titre de la taxe carbone soit automatiquement redistribué aux foyers les moins aisés sous forme de chèque transition ou de prime à la conversion majorée, tout en ciblant prioritairement les produits de luxe très émetteurs. C'est ainsi que la fiscalité verte deviendra un levier accepté et juste.\n\nJe vous prie d'agréer, Madame, Monsieur, l'expression de ma considération distinguée.",
        technique: "碳红利自动返还（chèque transition）与结构性差异征税建议 + 正式结尾",
        zhNote: "以可落地的再分配机制破解材料两难，落款完整规范。",
      },
    ],
    [
      { fr: "touche au cœur d'un dilemme majeur", zh: "直击重大两难命题的核心" },
      { fr: "le principe du pollueur-payeur", zh: "污染者付费原则" },
      { fr: "frappe de façon profondément inégalitaire", zh: "以极为不平等的方式冲击" },
      { fr: "une écologie perçue comme punitive", zh: "被视作惩罚性的环保政策" },
    ],
  ),

  make(
    "article-arts-vivants",
    "材料题：文化节补贴该削减还是向社区美育倾斜？",
    "评论文章",
    [
      {
        fr: "La culture municipale, variable d'ajustement budgétaire ou ciment citoyen ?\n\nConfrontée à la flambée des factures énergétiques, la municipalité envisage de réduire de vingt pour cent ses subventions aux grands festivals et à l'édition francophone locale afin d'équilibrer le budget des équipements sportifs. Si l'impératif de rigueur budgétaire dans les communes se comprend aisément, ce projet d'arbitrage soulève de vives interrogations quant à sa pertinence à moyen terme.",
        technique: "专栏评论双选标题 + 理性理解财政承压再质疑削减文化支出的合理性",
        zhNote: "先对市政府能源账单压力表示理解，再引出文化不该沦为裁减「调整项」的观点。",
      },
      {
        fr: "Opposer le financement des gymnases à celui de la création artistique revient selon moi à négliger un point essentiel : la culture constitue un véritable levier de cohésion sociale et d'émancipation. Derrière l'étiquette parfois jugée élitiste d'un festival se cachent en réalité des dizaines d'ateliers gratuits dans les écoles et les quartiers populaires, permettant à des jeunes de découvrir le théâtre, la lecture francophone et l'expression orale.",
        technique: "深度反驳「体育 vs 文化」二元对立，揭示节庆背靠的基层美育公益网",
        zhNote: "用具体事例拆解「大活动只是精英娱乐」的刻板印象，凸显社区美育触达功能。",
      },
      {
        fr: "De plus, d'un point de vue strictement économique et territorial, couper brutalement dans la vitalité culturelle d'une ville se révèle souvent contre-productif. Un festival attractif et ouvert sur la diversité linguistique et artistique irrigue directement l'hôtellerie, la restauration et les librairies indépendantes, tout en renforçant le rayonnement régional, l'attractivité touristique et le lien précieux entre les générations.",
        technique: "从地方商贸反哺视角说明文化支出其实具备长期经济外部性",
        zhNote: "借助 « irrigue directement... » 与客观预算视角增强文章厚重感。",
      },
      {
        fr: "Plutôt que de sacrifier ces aides, il conviendrait de mutualiser les moyens logistiques entre plusieurs événements, d'encourager un mécénat transparent auprès des entreprises locales et de conditionner les subventions publiques aux actions gratuites en direction des jeunes et des établissements scolaires. Préserver la création vivante, c'est investir durablement dans l'intelligence collective, le dialogue entre cultures et le vivre-ensemble au cœur de chaque quartier.",
        technique: "兼顾开源节流的务实建议（后勤共享+合规赞助+免费社区KPI）+ 有力收束",
        zhNote: "结语干练有力，兼具预算务实性与人文格局。",
      },
    ],
    [
      { fr: "variable d'ajustement budgétaire", zh: "预算裁减时的首当其冲调整项" },
      { fr: "ce projet d'arbitrage soulève de vives interrogations", zh: "这项预算取舍方案引发了广泛质疑" },
      { fr: "irrigue directement l'hôtellerie, la restauration et les librairies indépendantes", zh: "直接滋养酒店与本地商贸生态" },
      { fr: "conditionner les subventions publiques aux…", zh: "将公共补贴与……挂钩" },
    ],
  ),
];

export const modelEssayFor = (taskId: string): StaticEssayModel | undefined =>
  ESSAY_MODELS.find((m) => m.taskId === taskId);
