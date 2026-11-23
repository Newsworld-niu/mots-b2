/**
 * 正反论点与真实法国社会实例库（Banque d'arguments），完整覆盖 DELF B2 全部 15 大官方话题。
 * 供 PE 书面表达与 PO 口语备考阶段（非考场/非严格模考）随时检索立论角度与例证。
 */
import type { B2TopicId } from "./exam-schema";

export interface ArgumentSide {
  point: string;
  explanation: string;
}

export interface FrenchCaseExample {
  label: string;
  detailFr: string;
  detailZh: string;
}

export interface TopicArguments {
  topic: B2TopicId;
  tensionFr: string;
  pro: ArgumentSide[];
  con: ArgumentSide[];
  examples: FrenchCaseExample[];
}

export const ARGUMENTS_BANK: Record<B2TopicId, TopicArguments> = {
  environnement: {
    topic: "environnement",
    tensionFr: "Comment concilier impératif écologique et justice sociale pour les ménages modestes ?",
    pro: [
      {
        point: "优先治本与生态转型紧迫性",
        explanation: "La hausse des événements climatiques extrêmes impose des mesures contraignantes (sobriété, rénovation thermique) plutôt que de simples appels au civisme.",
      },
      {
        point: "长期经济收益高于短期适应成本",
        explanation: "Investir dans les énergies renouvelables et le réemploi réduit la dépendance énergétique et crée des emplois locaux non délocalisables.",
      },
    ],
    con: [
      {
        point: "避免「惩罚性生态」加剧阶层鸿沟",
        explanation: "Sans aides ciblées ni alternatives concrètes, les interdictions ou taxes pèsent d'abord sur les habitants des zones rurales contraints d'utiliser leur voiture.",
      },
      {
        point: "渐进配套比一刀切更具可行性",
        explanation: "Il convient d'accompagner les petites entreprises et les foyers vulnérables par des subventions avant d'appliquer des sanctions.",
      },
    ],
    examples: [
      {
        label: "Loi AGEC anti-gaspillage & zones à faibles émissions (ZFE)",
        detailFr: "Depuis 2023, la loi AGEC impose la vaisselle réutilisable dans la restauration rapide en France, tandis que les ZFE suscitent un débat sur le renouvellement du parc automobile des ménages modestes.",
        detailZh: "法国《反浪费与循环经济法》推行堂食可重复使用餐具，而低排放区（ZFE）政策也引发对低收入家庭换车补贴的讨论。",
      },
      {
        label: "Convention citoyenne pour le climat",
        detailFr: "Tirés au sort, 150 citoyens français ont formulé des propositions sur le logement, les transports et l'alimentation, illustrant l'intérêt de l'adhésion citoyenne pour réussir la transition.",
        detailZh: "法国气候公民大会由 150 名抽签市民参与提案，体现了社会共识对生态转型的关键作用。",
      },
    ],
  },
  travail: {
    topic: "travail",
    tensionFr: "Entre flexibilité productive et protection de la santé mentale, quel équilibre trouver au travail ?",
    pro: [
      {
        point: "灵活工时与远程办公提升自主性",
        explanation: "Réduire les trajets quotidiens diminue la fatigue, améliore la concentration sur les tâches complexes et facilite l'équilibre vie professionnelle-vie familiale.",
      },
      {
        point: "压缩无意义工时反而稳住长期留任率",
        explanation: "L'épuisement professionnel (burn-out) coûte cher aux entreprises en arrêts maladie et en rotation du personnel ; mieux organiser le travail fidélise les équipes.",
      },
    ],
    con: [
      {
        point: "警惕工时压缩带来的工作高强度",
        explanation: "La semaine de quatre jours ou le télétravail mal encadré peuvent intensifier la charge horaire et fragiliser le lien collectif ainsi que l'intégration des jeunes.",
      },
      {
        point: "行业属性决定了难以整齐划一",
        explanation: "Les secteurs du soin, de l'hôtellerie ou du commerce nécessitent une présence continue et supportent mal des schémas conçus pour le tertiaire.",
      },
    ],
    examples: [
      {
        label: "Droit à la déconnexion (loi Travail, 2017)",
        detailFr: "En France, les entreprises de plus de 50 salariés doivent négocier des règles garantissant le repos numérique hors des horaires de bureau.",
        detailZh: "法国自 2017 年起确立「离线权」，要求 50 人以上企业谈判制定非工作时间免打扰机制。",
      },
      {
        label: "Expérimentations publiques de la semaine de 4 jours à Lyon",
        detailFr: "Plusieurs collectivités françaises testent les 32 ou 35 heures sur quatre jours sur la base du volontariat, avec suivi de la continuité du service public.",
        detailZh: "里昂等多地市政与机构试点自愿制四天工作周，同时评估公共服务窗口接续能力。",
      },
    ],
  },
  education: {
    topic: "education",
    tensionFr: "Comment moderniser l'école et garantir l'égalité des chances sans sacrifier l'exigence académique ?",
    pro: [
      {
        point: "跳出应试分数与重视综合素养",
        explanation: "Une évaluation centrée sur la progression, l'oral et la créativité réduit l'anxiété scolaire et valorise les intelligences diverses.",
      },
      {
        point: "开放视野与实践体验塑造独立人格",
        explanation: "La mobilité internationale, l'alternance ou la régulation des outils numériques en classe préparent concrètement les jeunes à la vie citoyenne et professionnelle.",
      },
    ],
    con: [
      {
        point: "缺少统一标准可能拉大隐性家庭差异",
        explanation: "Sans repères chiffrés ni attentes nationales claires, la sélection finit souvent par reposer sur le capital culturel et le réseau familial.",
      },
      {
        point: "资源落差限制公平落地",
        explanation: "Une réforme ambitieuse exige d'abord des moyens humains (effectifs réduits, accompagnement des élèves en difficulté) plutôt que de simples injonctions.",
      },
    ],
    examples: [
      {
        label: "Programme Erasmus+ & apprentissage en alternance",
        detailFr: "Plus d'un million de jeunes Français ont bénéficié d'Erasmus+ ou de contrats d'alternance, mais l'accès reste inégal selon les filières professionnelles et géographiques.",
        detailZh: "Erasmus+ 交流与工读交替学徒制（alternance）帮助百万青年衔接职场，但在城乡与专业间仍待均衡。",
      },
      {
        label: "Loi sur l'interdiction du téléphone au collège (2018)",
        detailFr: "Depuis 2018, l'usage du portable est interdit dans les écoles et collèges en France pour restaurer le climat scolaire et limiter le cyberharcèlement.",
        detailZh: "法国自 2018 年立法禁止小学与初中校园使用手机，以改善课堂专注度与校园氛围。",
      },
    ],
  },
  numerique: {
    topic: "numerique",
    tensionFr: "Les outils numériques libèrent-ils l'individu ou accentuent-ils notre dépendance et les inégalités d'accès ?",
    pro: [
      {
        point: "合理引导优于全面禁令",
        explanation: "Interdire brutalement écrans ou réseaux coupe les jeunes de ressources éducatives essentielles ; il faut plutôt former à l'autorégulation et à l'hygiène numérique.",
      },
      {
        point: "平台透明与算法问责保障自主权",
        explanation: "Imposer des réglages par défaut protecteurs aux plateformes responsabilise les éditeurs plutôt que de faire peser toute la charge sur les usagers.",
      },
    ],
    con: [
      {
        point: "注意力经济本质上诱导成瘾",
        explanation: "Les notifications et le défilement infini (scroll infini) sont conçus pour capter le temps d'attention des mineurs et nuisent au sommeil comme à la concentration.",
      },
      {
        point: "公共服务全面数字化排斥弱势群体",
        explanation: "La dématérialisation totale des démarches isole les personnes âgées ou peu équipées (illectronisme) qui ont besoin de guichets humains.",
      },
    ],
    examples: [
      {
        label: "Rapport « Enfants et écrans » (France, 2024)",
        detailFr: "La commission d'experts remise à l'Élysée en 2024 recommande d'éviter tout écran avant trois ans et de repousser l'accès aux réseaux sociaux à quinze ans.",
        detailZh: "2024 年法国总统府儿童与屏幕专家委员会报告建议 3 岁前零屏幕、15 岁后再接触社交媒体。",
      },
      {
        label: "Maisons France Services contre l'illectronisme",
        detailFr: "Face aux difficultés des démarches en ligne, plus de 2 700 guichets France Services offrent un accompagnement physique dans les communes rurales.",
        detailZh: "为应对公共服务数字化导致的数字鸿沟，全法设立 2700 余个线下辅助窗口帮助居民办理事务。",
      },
    ],
  },
  sante: {
    topic: "sante",
    tensionFr: "Comment préserver l'accès universel aux soins et la santé préventive face aux pénuries médicales ?",
    pro: [
      {
        point: "预防优先可显著减轻医保长期负担",
        explanation: "Agir sur la nutrition (Nutri-Score), le sommeil scolaire ou l'activité physique évite des maladies chroniques coûteuses tout en améliorant la qualité de vie.",
      },
      {
        point: "跨学科协作与适度激励疏解医疗荒漠",
        explanation: "Développer les maisons de santé pluridisciplinaires et encadrer la téléconsultation garantit une continuité territoriale des soins.",
      },
    ],
    con: [
      {
        point: "强制措施易触及自由选择与结构瓶颈",
        explanation: "Contraindre l'installation des médecins ou supprimer des libertés individuelles risque de décourager les vocations et de masquer le manque de places de formation.",
      },
      {
        point: "社会经济条件决定健康习惯落地",
        explanation: "Prôner l'alimentation saine ou le sport reste vain si les produits frais coûtent plus cher que l'ultra-transformé et si les équipements municipaux manquent.",
      },
    ],
    examples: [
      {
        label: "Système d'étiquetage Nutri-Score en Europe",
        detailFr: "Mis au point en France, le logo nutritionnel à cinq couleurs aide les consommateurs à comparer les produits et pousse les industriels à réduire sucre et sel.",
        detailZh: "源于法国的 Nutri-Score 五色营养标签引导消费者辨别高糖高盐食品并倒逼配方改良。",
      },
      {
        label: "Maisons de santé pluriprofessionnelles dans les zones rurales",
        detailFr: "Pour lutter contre les déserts médicaux, plusieurs régions financent des maisons regroupant généralistes, infirmiers et kinésithérapeutes salariés.",
        detailZh: "法国多地在乡村共建多学科基层诊疗中心，以团队协作吸引医护人员扎根紧缺地区。",
      },
    ],
  },
  societe: {
    topic: "societe",
    tensionFr: "Comment renforcer le lien social et la solidarité intergénérationnelle sans imposer l'engagement citoyen ?",
    pro: [
      {
        point: "结构性互助机制兼顾养老与住房需求",
        explanation: "La cohabitation intergénérationnelle ou le Service Civique valorisé créent des solidarités concrètes entre générations tout en rompant l'isolement.",
      },
      {
        point: "维护公共场所与社团网络巩固「共同生活」",
        explanation: "Bibliothèques, associations sportives et espaces publics gratuits demeurent les derniers creusets de mixité sociale au quotidien.",
      },
    ],
    con: [
      {
        point: "强制性志愿服务自相矛盾且成本高昂",
        explanation: "Rendre un service citoyen obligatoire prive l'engagement de sa sincérité et risque de substituer une main-d'œuvre peu rémunérée à de vrais emplois publics.",
      },
      {
        point: "避免将国家公共责任转嫁给个人善意",
        explanation: "La solidarité citoyenne ne doit jamais servir de prétexte au désengagement budgétaire de l'État envers les hôpitaux ou les maisons de retraite.",
      },
    ],
    examples: [
      {
        label: "Le Service Civique volontaire (créé en 2010)",
        detailFr: "En France, des milliers de jeunes de 16 à 25 ans choisissent librement une mission d'intérêt général indemnisée de 6 à 12 mois, reconnue comme tremplin social.",
        detailZh: "法国自愿制公民服务（Service Civique）每年吸引数万青年参与 6–12 个月带津贴公益项目。",
      },
      {
        label: "Cohabitation intergénérationnelle (Loi Élan)",
        detailFr: "Encadrée par la loi Élan, la cohabitation permet à un senior disposant d'une chambre libre d'accueillir un étudiant contre un loyer modique et une présence bienveillante.",
        detailZh: "《住房发展法》（Loi Élan）规范了代际合租模式：独居老人以低价提供房间换取青年陪伴照应。",
      },
    ],
  },
  consommation: {
    topic: "consommation",
    tensionFr: "Peut-on passer à une consommation sobre et durable sans pénaliser le pouvoir d'achat des foyers ?",
    pro: [
      {
        point: "延长产品寿命对抗「计划性报废」",
        explanation: "Imposer la réparabilité, l'achat d'occasion ou les circuits courts réduit les déchets industriels et redonne du sens à l'acte d'achat.",
      },
      {
        point: "透明披露社会与环境外部性",
        explanation: "Derrière la livraison ultra-rapide ou les prix cassés se cachent souvent précarité des travailleurs et suremballage ; l'affichage du coût réel éclaire le consommateur.",
      },
    ],
    con: [
      {
        point: "「责任消费」常伴随着高溢价门槛",
        explanation: "Les produits locaux ou réparables restent souvent plus coûteux que l'offre industrielle de masse, créant une écologie à deux vitesses.",
      },
      {
        point: "便捷电商满足特定人群现实需要",
        explanation: "La livraison à domicile reste précieuse pour les personnes à mobilité réduite ou isolées ; il faut plutôt réguler le statut des livreurs et regrouper les tournées.",
      },
    ],
    examples: [
      {
        label: "Indice de réparabilité & Bonus réparation en France",
        detailFr: "Depuis 2021, une note sur 10 affichée sur l'électroménager informe sur la facilité de réparation, complétée par un bonus financier déduit directement chez le réparateur agréé.",
        detailZh: "法国推出家电可维修指数（10 分制）与维修补贴券，引导消费者「修而不扔」。",
      },
      {
        label: "Loi contre les dérives de la fast fashion",
        detailFr: "Le Parlement français examine la mise en place d'un malus environnemental et l'interdiction de la publicité pour la mode éphémère afin de freiner la surproduction textile.",
        detailZh: "法国议会推动立法对超快时尚征收生态惩罚金并限制广告，遏制纺织业过度消费。",
      },
    ],
  },
  culture: {
    topic: "culture",
    tensionFr: "Comment démocratiser l'accès à la culture et préserver les sites patrimoniaux face au tourisme de masse ?",
    pro: [
      {
        point: "公共文化免费或分龄优惠消除经济壁垒",
        explanation: "La culture est un bien commun : exonérer les jeunes, les étudiants ou les habitants garantit la démocratisation culturelle sans dépendre des moyens familiaux.",
      },
      {
        point: "配额与预约分流守护景区与居民生活品质",
        explanation: "Réguler les flux touristiques et les meublés saisonniers protège les monuments fragiles et évite que les centres historiques ne se vident de leurs résidents.",
      },
    ],
    con: [
      {
        point: "「全民全免」可能补贴外地游客且挤占创作预算",
        explanation: "Financer l'entrée gratuite pour tous prive les musées de recettes propres utiles à la restauration des œuvres ; une tarification sociale ciblée est plus juste.",
      },
      {
        point: "过度限流冲击地方旅游就业岗位",
        explanation: "De nombreuses communes littorales ou historiques dépendent des visiteurs pour maintenir commerces, transports et activités saisonnières.",
      },
    ],
    examples: [
      {
        label: "Gratuité des musées nationaux pour les moins de 26 ans (UE)",
        detailFr: "En France, les collections permanentes du Louvre ou d'Orsay sont gratuites pour tous les résidents européens de moins de 26 ans et le premier dimanche du mois.",
        detailZh: "卢浮宫与奥赛博物馆常设展向 26 岁以下欧洲青年常年免票，并设每月首个周日免费开放日。",
      },
      {
        label: "Jauges estivales au Parc national des Calanques & Pass Culture",
        detailFr: "Pour préserver son écosystème, les Calanques limitent les visites quotidiennes par réservation gratuite, tandis que le Pass Culture soutient les sorties culturelles des lycéens.",
        detailZh: "马赛峡湾国家公园通过免费预约限流保护生态，「文化通行证」则专项补贴青年文化消费。",
      },
    ],
  },
  "politique-justice": {
    topic: "politique-justice",
    tensionFr: "Comment revitaliser la participation démocratique et garantir une justice perçue comme équitable et efficace ?",
    pro: [
      {
        point: "参与式民主能拉近市民与公共决策距离",
        explanation: "Budgets participatifs, conventions citoyennes et transparence des élus donnent du poids concret aux citoyens entre deux élections et combattent le sentiment d'impuissance.",
      },
      {
        point: "预防与重返社会比单纯严刑更能降低再犯率",
        explanation: "Les peines alternatives (travail d'intérêt général, suivi éducatif) limitent la surpopulation carcérale et favorisent la réinsertion durable.",
      },
    ],
    con: [
      {
        point: "强制投票或形式化协商难改信任危机",
        explanation: "Obliger les citoyens à voter augmente les bulletins blancs sans traiter le sentiment d'abandon politique ; il faut d'abord renouveler l'offre et l'écoute publique.",
      },
      {
        point: "司法资源捉襟见肘削弱执法公信力",
        explanation: "Allonger les délais de jugement nourrit le sentiment d'impunité chez les victimes ; la justice manque avant tout de greffiers, de magistrats et de moyens.",
      },
    ],
    examples: [
      {
        label: "Budget participatif de la Ville de Paris",
        detailFr: "Chaque année, les Parisiens votent directement pour affecter plusieurs dizaines de millions d'euros à des projets locaux d'école, de sport ou de végétalisation.",
        detailZh: "巴黎市政府每年划拨数千万欧元「参与式预算」，由市民直接投票决定社区绿化与校园微更新项目。",
      },
      {
        label: "Le Défenseur des droits & les peines de Travail d'Intérêt Général (TIG)",
        detailFr: "Institution constitutionnelle indépendante, le Défenseur des droits veille aux libertés publiques, tandis que le TIG reste un levier reconnu de réinsertion judiciaire.",
        detailZh: "法国「权利捍卫者」独立机构监督公权力侵权，公益劳动刑罚则是减缓监狱拥堵与促进回归社会的重要手段。",
      },
    ],
  },
  "sciences-ethique": {
    topic: "sciences-ethique",
    tensionFr: "Jusqu'où encadrer la recherche scientifique et l'IA sans freiner l'innovation indispensable à la société ?",
    pro: [
      {
        point: "预防原则与「人类在环」防止技术失控",
        explanation: "Dans la justice, la santé ou la surveillance, une décision algorithmique doit toujours rester explicable, révocable et sous contrôle humain.",
      },
      {
        point: "公共基础科研保障知识开放与主权独立",
        explanation: "Financer la recherche fondamentale publique évite que les priorités scientifiques ne soient dictées uniquement par la rentabilité à court terme du secteur privé.",
      },
    ],
    con: [
      {
        point: "过度前置监管可能让本土创新落后",
        explanation: "Multiplier les interdictions unilatérales risque d'accentuer la fuite des cerveaux et de rendre l'Europe dépendante des technologies développées ailleurs.",
      },
      {
        point: "技术中立性取决于具体用途与治理制度",
        explanation: "Les avancées médicales assistées par IA (détection précoce des cancers, génomique) sauvent des vies ; il faut encadrer les usages abusifs plutôt que bannir l'outil.",
      },
    ],
    examples: [
      {
        label: "Règlement européen sur l'IA (AI Act) & avis de la CNIL",
        detailFr: "L'Union européenne classe les systèmes d'IA par niveau de risque et interdit la notation sociale, tandis que la CNIL protège les données biométriques des citoyens.",
        detailZh: "欧盟《人工智能法案》实行风险分级监管并禁止社会信用评分，法国信息与自由委员会（CNIL）严控生物识别数据采集。",
      },
      {
        label: "Comité Consultatif National d'Éthique (CCNE)",
        detailFr: "Créé dès 1983 en France, ce comité réunit chercheurs, juristes et philosophes pour éclairer les lois de bioéthique avant leur vote au Parlement.",
        detailZh: "1983 年成立的法国国家伦理咨询委员会由科研、法学与哲学专家构成，在生命科学立法前提供伦理审议。",
      },
    ],
  },
  "medias-presse": {
    topic: "medias-presse",
    tensionFr: "Comment lutter contre la désinformation en ligne sans porter atteinte à la liberté d'expression ?",
    pro: [
      {
        point: "媒体素养教育是最持久的免疫疫苗",
        explanation: "Apprendre dès le lycée à croiser les sources, distinguer fait et opinion et décoder les biais visuels forme des citoyens autonomes sans instaurer de censure.",
      },
      {
        point: "独立新闻资助与算法透明度巩固公共空间",
        explanation: "Obliger les plateformes à signaler les contenus générés par IA et soutenir une presse plurielle empêche les rumeurs virales de dominer l'espace public.",
      },
    ],
    con: [
      {
        point: "「假新闻判定权」交由国家或平台易生审查风险",
        explanation: "Confier à une autorité le pouvoir de censurer ce qui est jugé faux peut ouvrir la voie à des dérives politiques ou étouffer le débat légitime.",
      },
      {
        point: "快速信息节奏与注意力商业模式难靠罚款扭转",
        explanation: "Tant que les plateformes monétisent l'indignation et l'urgence, les démentis rigoureux arrivent toujours trop tard par rapport à la viralité initiale.",
      },
    ],
    examples: [
      {
        label: "Semaine de la presse et des médias dans l'école (CLEMI)",
        detailFr: "Chaque année en France, des milliers d'élèves analysent la fabrication de l'information avec des journalistes pour repérer rumeurs et montages trompeurs.",
        detailZh: "法国教育部每年举办「校园新闻与媒体周」，由记者走进中学带学生实操交叉核实信源与识别误导内容。",
      },
      {
        label: "Rapport de la commission Bronner « Les Lumières à l'ère numérique »",
        detailFr: "Remis en 2022, ce rapport propose de responsabiliser les algorithmes de recommandation et de renforcer l'esprit critique plutôt que d'interdire la parole en ligne.",
        detailZh: "2022 年《数字时代的启蒙》报告建议强化推荐算法问责与公民思辨训练，而非简单删帖。",
      },
    ],
  },
  "logement-urbanisme": {
    topic: "logement-urbanisme",
    tensionFr: "Comment garantir un logement digne et abordable en ville face à la flambée des loyers et à l'étalement urbain ?",
    pro: [
      {
        point: "规制租金上限与旅游短租保护本地常住人口",
        explanation: "Plafonner les loyers en zone tendue et limiter les meublés touristiques empêchent les quartiers populaires et les centres-villes de devenir inaccessibles aux travailleurs.",
      },
      {
        point: "社会保障住房配额与「15 分钟城市」提升宜居性",
        explanation: "Mélanger logements sociaux et privés à proximité des transports évite les ghettos territoriaux et réduit les déplacements contraints.",
      },
    ],
    con: [
      {
        point: "过度限价可能削弱供给与老房翻新意愿",
        explanation: "Si les propriétaires jugent la rentabilité trop faible, ils risquent de retirer des biens du marché locatif ou de reporter les travaux d'isolation thermique.",
      },
      {
        point: "城市高密度建设与居民绿地舒适度存在张力",
        explanation: "Pour limiter l'artificialisation des sols, densifier les villes doit s'accompagner de parcs, d'îlots de fraîcheur et d'isolation phonique.",
      },
    ],
    examples: [
      {
        label: "Encadrement des loyers à Paris et Lyon & Loi SRU (20–25 %)",
        detailFr: "La loi SRU impose aux grandes communes de disposer d'au moins 20 à 25 % de logements sociaux, complétée par l'encadrement des loyers et des quotas de jours sur Airbnb.",
        detailZh: "法国 SRU 法规定大城市须配备 20–25% 社会住房，巴黎、里昂等还实施房租上限及短租天数限制。",
      },
      {
        label: "Ville du quart d'heure & Zéro Artificialisation Nette (ZAN)",
        detailFr: "De nombreuses métropoles repensent les quartiers pour que services, écoles et commerces soient accessibles en quinze minutes à pied ou à vélo.",
        detailZh: "法国多座都会推行「15 分钟生活圈」与「零净土地人工化」原则，兼顾紧凑城市与生态留白。",
      },
    ],
  },
  "economie-finances": {
    topic: "economie-finances",
    tensionFr: "Comment financer des services publics solides et la transition verte sans fragiliser la compétitivité et le pouvoir d'achat ?",
    pro: [
      {
        point: "精准公共投资与税制公平重塑财政可持续性",
        explanation: "Soutenir l'éducation, les transports et la rénovation énergétique génère des externalités positives supérieures à des coupes budgétaires uniformes qui abîment la cohésion.",
      },
      {
        point: "将环保税收定向返还给低收入群体（生态红利）",
        explanation: "Lier fiscalité écologique et chèque transition protège le pouvoir d'achat des ménages modestes tout en incitant les acteurs les plus polluants à se transformer.",
      },
    ],
    con: [
      {
        point: "公共债务高企压缩未来世代的政策空间",
        explanation: "Multiplier dépenses et subventions sans évaluer leur efficacité alourdit la charge de la dette et fragilise la souveraineté budgétaire du pays.",
      },
      {
        point: "税负过重可能削弱中小企业投资与就业活力",
        explanation: "Une hausse indifférenciée des impôts locaux ou des charges pèse sur les artisans et risque de décourager l'embauche.",
      },
    ],
    examples: [
      {
        label: "Le chèque énergie & la prime à la conversion en France",
        detailFr: "Pour atténuer le coût de la transition, l'État verse un chèque énergie ciblé selon les revenus des foyers afin de payer factures ou travaux d'économie d'énergie.",
        detailZh: "法国针对中低收入家庭发放「能源支票」和绿色换车补贴，缓冲低碳转型的经济阵痛。",
      },
      {
        label: "Reindustrialisation verte & plan France 2030",
        detailFr: "Ce programme d'investissement public cible la décarbonation industrielle, les batteries et les transports propres pour concilier emploi local et climat.",
        detailZh: "「法国 2030」公共投资计划将资金倾斜向产业脱碳与清洁技术研发，兼顾就业主权与气候目标。",
      },
    ],
  },
  "transports-mobilite": {
    topic: "transports-mobilite",
    tensionFr: "Comment réduire la place de la voiture individuelle tout en garantissant la liberté de déplacement de tous les citoyens ?",
    pro: [
      {
        point: "优先路权与票价减免引导绿色出行",
        explanation: "Développer tramways, pistes cyclables sécurisées et tarification sociale désengorge les centres-villes, baisse la pollution de l'air et redonne l'espace aux piétons.",
      },
      {
        point: "短途禁飞与铁路加密树立可信替代方案",
        explanation: "Le report modal de l'avion ou de la voiture vers le train fonctionne dès que les liaisons ferroviaires sont fiables, ponctuelles et abordables.",
      },
    ],
    con: [
      {
        point: "「全面免费」未必首先提升郊区乘客满意度",
        explanation: "La gratuité totale prive les réseaux de recettes nécessaires pour augmenter la fréquence en périphérie ; les usagers réclament souvent fiabilité et sécurité avant la gratuité.",
      },
      {
        point: "乡村与三班倒人群缺乏实质替代品",
        explanation: "Pour les travailleurs de nuit ou les habitants sans gare, interdire la voiture sans développer de parcs relais ni de cars réguliers revient à les exclure de la ville.",
      },
    ],
    examples: [
      {
        label: "Gratuité des transports à Montpellier et Dunkerque",
        detailFr: "Depuis fin 2023, Montpellier offre les transports publics gratuits à tous ses résidents, relançant le débat sur l'équilibre entre hausse de fréquentation et financement local.",
        detailZh: "2023 年底起蒙彼利埃向全体居民免除公交与有轨电车票价，在全法引发对「免费与运力投资权衡」的讨论。",
      },
      {
        label: "Suppression des vols intérieurs courts (Loi Climat et Résilience)",
        detailFr: "La France limite les lignes aériennes intérieures lorsqu'une alternative ferroviaire existe en moins de 2 heures 30, mesure symbolique qui pousse à moderniser le réseau ferré.",
        detailZh: "《气候与韧性法》取消存在 2.5 小时内高铁替代方案的国内短途航线，推动公铁联运与铁路网投资。",
      },
    ],
  },
  "arts-francophonie": {
    topic: "arts-francophonie",
    tensionFr: "Comment défendre la création artistique locale et le rayonnement de la francophonie à l'ère des plateformes mondiales ?",
    pro: [
      {
        point: "「文化例外」与创作投资保障语言多样性",
        explanation: "Soutenir le cinéma, le spectacle vivant et les quotas d'œuvres francophones évite l'uniformisation culturelle dictée par quelques géants mondiaux du streaming.",
      },
      {
        point: "法语是多大陆活态交流与青年创作载体",
        explanation: "Avec la croissance démographique africaine et l'essor artistique québécois ou maghrébin, la francophonie favorise le dialogue interculturel bien au-delà de l'Hexagone.",
      },
    ],
    con: [
      {
        point: "警惕配额保护变成封闭守旧",
        explanation: "La promotion du français ne doit pas nourrir le purisme linguistique ni se couper des échanges anglophones et multilingues nécessaires à la recherche et aux arts.",
      },
      {
        point: "地方预算承压时须平衡高端与社区文化投入",
        explanation: "Financer de grands festivals prestigieux au détriment des conservatoires de quartier ou des petites troupes creuse les inégalités culturelles territoriales.",
      },
    ],
    examples: [
      {
        label: "L'exception culturelle française & obligations d'investissement des plateformes",
        detailFr: "En France, les plateformes internationales comme Netflix doivent consacrer une part de leur chiffre d'affaires local au financement d'œuvres audiovisuelles françaises et européennes.",
        detailZh: "法国依据「文化例外」原则要求国际流媒体平台将一定比例本土营收反哺法语及欧洲影视创作。",
      },
      {
        label: "Cité internationale de la langue française (Villers-Cotterêts) & OIF",
        detailFr: "Inaugurée en 2023, la Cité de Villers-Cotterêts célèbre la diversité des accents et littératures des cinq continents réunis au sein de l'Organisation internationale de la Francophonie.",
        detailZh: "2023 年启幕的维莱科特雷法语国际城及法语国家及地区国际组织（OIF）展现多大陆法语文学与艺术活力。",
      },
    ],
  },
};

export function argumentsFor(topic?: string): TopicArguments | undefined {
  if (!topic) return undefined;
  return ARGUMENTS_BANK[topic as B2TopicId];
}
