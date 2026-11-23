/**
 * 精选 DELF B2 报刊议论读物库（免 AI Key 即开即读即查词）：
 * 10 篇约 260–340 词的 B2 级别原生话题短文，配逐段中文译文与 3 道法语理解题。
 */
import type { QuizItem } from "./reader";

export interface ReadPreset {
  id: string;
  title: string;
  topic: string;
  topicZh: string;
  level: "B2";
  sourceNote: string;
  text: string;
  zh: string;
  quiz: QuizItem[];
}

export const READ_PRESETS: readonly ReadPreset[] = [
  {
    id: "p-teletravail",
    title: "Télétravail hybride : comment éviter l'isolement des jeunes salariés ?",
    topic: "travail",
    topicZh: "工作与职业",
    level: "B2",
    sourceNote: "社会职场观察 · 自编分级 B2",
    text: `Depuis la généralisation du travail hybride, deux ou trois jours passés à domicile chaque semaine sont devenus la norme dans de nombreuses entreprises tertiaires. Si cette souplesse facilite indéniablement l'équilibre entre vie professionnelle et obligations familiales, plusieurs études récentes attirent l'attention sur un angle mort préoccupant : l'intégration des jeunes diplômés.

En effet, lorsqu'on débute une carrière, l'apprentissage ne passe pas uniquement par les consignes formelles données en réunion. Une grande partie des savoir-faire se transmet de manière informelle, en observant un collègue plus expérimenté traiter un dossier délicat ou en posant une question spontanée entre deux portes. À distance, ces occasions disparaissent presque entièrement, laissant parfois les recrues hésiter pendant des heures devant un obstacle mineur de peur de déranger par message.

Dans une enquête menée l'an dernier auprès de trois cents jeunes ingénieurs et analystes financiers embauchés en région parisienne et à Lyon, près de deux tiers des répondants déclaraient se sentir « spectateurs » de la culture de leur entreprise pendant les six premiers mois. Beaucoup regrettaient notamment l'absence de retours rapides après une présentation orale ou un courriel difficile à rédiger. Parallèlement, plusieurs managers reconnaissent qu'il est beaucoup plus délicat de repérer à l'écran les premiers signes de découragement ou de surcharge mentale chez un salarié peu expérimenté, ce qui retarde parfois les ajustements nécessaires avant qu'une difficulté passagère ne se transforme en démission.

Face à ce constat, plusieurs employeurs révisent leur organisation sans pour autant renoncer à la flexibilité. Certains instaurent des journées de présence commune obligatoires pour l'ensemble d'un service, tandis que d'autres mettent en place un système de parrainage structuré durant les six premiers mois. L'enjeu n'est plus de choisir entre tout présentiel et tout distanciel, mais d'organiser consciemment les moments de transmission collective.`,
    zh: `自从混合办公模式普及以来，每周居家办公两三天已成为许多服务业企业的常态。虽然这种灵活性无疑有助于平衡职业生活与家庭事务，但近期多项研究指出了一个令人担忧的盲区：应届毕业生的职场融入问题。

事实上，初入职场时，学习并不仅仅依赖会议中下达的正式指令。大量实务经验都是通过非正式渠道传递的——例如观察资深同事如何处理棘手文件，或在茶水间顺口请教一个问题。一旦改为远程办公，这些契机几乎完全消失，导致部分新人面对小问题也不敢轻易发消息打扰他人，独自犹豫数小时。

去年针对巴黎大区和里昂三百名新入职工程师及金融分析师的一项调查显示，近三分之二的受访者坦言在入职前半年觉得自己像企业文化的「旁观者」。不少人尤其怀念口头汇报或撰写棘手邮件后同事给出的即时反馈。与此同时，多名管理者也承认，隔着屏幕很难敏锐察觉职场新人早期的沮丧情绪或精神超负荷迹象，往往容易错过及时调整工作的窗口期，导致原本暂时的困难演变成主动离职。

面对这一现状，多家雇主在不放弃办公灵活性的前提下开始调整制度。有些企业规定同一部门必须在固定日期全员到岗，另一些则在前六个月推行结构化的导师结对制度。当下的关键已不再是在全线下与全远程之间二选一，而是有意识地规划好团队经验传承的时间节点。`,
    quiz: [
      {
        q: "Quel problème particulier le travail hybride pose-t-il selon l'article ?",
        options: [
          "Il réduit la productivité des cadres supérieurs.",
          "Il complique l'apprentissage informel des nouveaux arrivants.",
          "Il oblige les entreprises à fermer leurs locaux.",
        ],
        answer: 1,
        why: "第二段指出新人原本依靠观察资深同事和随时提问来积累非正式经验，远程办公后这些机会大幅减少。",
      },
      {
        q: "Pourquoi certaines jeunes recrues perdent-elles du temps chez elles ?",
        options: [
          "Elles disposent d'un matériel informatique dépassé.",
          "Elles reçoivent trop de tâches administratives.",
          "Elles n'osent pas interrompre leurs collègues à distance.",
        ],
        answer: 2,
        why: "第二段明确提到新人因担心发消息打扰别人，常对着小障碍犹豫很久（de peur de déranger par message）。",
      },
      {
        q: "Quelle orientation privilégient les employeurs évoqués en fin d'article ?",
        options: [
          "Combiner flexibilité et temps collectifs encadrés.",
          "Supprimer totalement le télétravail dès l'embauche.",
          "Confier la formation uniquement à des prestataires externes.",
        ],
        answer: 0,
        why: "末段指出关键在于不放弃灵活性的同时，通过共同到岗日与导师制来保证集体经验传递。",
      },
    ],
  },
  {
    id: "p-ia-ecole",
    title: "L'école face aux algorithmes d'écriture : repenser l'évaluation",
    topic: "education",
    topicZh: "教育与数字",
    level: "B2",
    sourceNote: "教育专题评论 · 自编分级 B2",
    text: `L'irruption des outils d'intelligence artificielle capables de rédiger une synthèse structurée en quelques secondes bouleverse les habitudes scolaires et universitaires. Devant la difficulté de distinguer avec certitude un travail personnel d'un texte généré par une machine, certains établissements tentent de revenir exclusivement aux devoirs surveillés sur table.

Pourtant, de nombreux pédagogues estiment qu'une stratégie fondée sur la seule surveillance reste insuffisante. À l'extérieur de la classe, les élèves utilisent déjà ces assistants pour résumer des documents ou chercher des idées. Dès lors, plutôt que de feindre d'ignorer leur existence, il conviendrait d'enseigner l'esprit critique face aux réponses automatiques, souvent séduisantes sur la forme mais parfois approximatives ou biaisées sur le fond.

En cours de lettres comme en histoire, des enseignants proposent désormais des exercices comparatifs originaux : les élèves analysent ensemble deux copies rédigées sur le même sujet, l'une par une intelligence artificielle, l'autre par un auteur ou un chercheur reconnu. Cet atelier met rapidement en évidence les formules creuses, les généralités prudentes et les citations inventées que produisent encore fréquemment les modèles statistiques. Aux yeux de ces professeurs, l'objectif n'est pas de transformer les lycéens en ingénieurs informatiques, mais de leur rappeler qu'écrire consiste d'abord à penser par soi-même et à assumer une nuance personnelle qu'aucune machine ne sait véritablement éprouver.

Plusieurs universités expérimentent déjà de nouvelles modalités d'examen qui déplacent l'attention du produit final vers la démarche intellectuelle. On demande ainsi aux étudiants de défendre leur argumentation à l'oral, d'analyser les limites d'un texte généré par ordinateur ou de documenter les étapes successives de leur recherche. Apprendre à vérifier et à dépasser ce que propose l'outil devient une compétence à part entière.`,
    zh: `能在几秒内写出结构完整综述的人工智能工具突然闯入校园，颠覆了中学和大学的传统教学方式。鉴于目前很难百分百区分学生原创与机器生成文本，一些学校试图完全退回考场纸笔闭卷测试。

然而，许多教育研究者认为仅靠严防死守的策略远远不够。离开教室后，学生早已在用这些助手总结文献或寻找灵感。与其假装工具不存在，不如教会他们对自动生成的内容保持批判态度——这些回答往往表面流畅，但实质内容可能含糊甚至带有偏见。

在语文和历史课上，不少教师如今设计了别具一格的对比练习：让全班共同剖析两篇同题文本，一篇由人工智能生成，另一篇出自知名作家或学者。通过对比，学生很快就能识破统计模型常出现的空洞套话、圆滑泛论甚至虚构引文。在这些老师看来，教学目的并非把高中生培养成算法工程师，而是让他们明白写作的本质是独立思考，并承担起机器永远无法真正体会的个人微妙立场。

多所高校已开始试行新的考核办法，将评价重心从「最终成品」转向「思维过程」。例如要求学生通过口头答辩捍卫自己的论点、点评算法生成文本的缺陷，或提交逐步检索与修改的留痕过程。学会核查并超越机器给出的初稿，本身正成为一项核心能力。`,
    quiz: [
      {
        q: "Pourquoi certains pédagogues jugent-ils le retour exclusif aux devoirs sur table insuffisant ?",
        options: [
          "Il coûte trop cher en papier et en surveillance.",
          "Il n'apprend pas aux jeunes à évaluer de façon critique les outils qu'ils utilisent hors classe.",
          "Il favorise les étudiants les plus rapides en écriture manuscrite.",
        ],
        answer: 1,
        why: "第二段说明学生在课外已普遍使用 AI，单纯监考无法培养他们识别算法偏差的批判能力。",
      },
      {
        q: "Quelle critique l'auteur formule-t-il envers les textes produits par l'IA ?",
        options: [
          "Ils contiennent trop de fautes d'orthographe.",
          "Ils sont trop courts pour servir de brouillon.",
          "Leur apparence soignée peut masquer des imprécisions ou des biais.",
        ],
        answer: 2,
        why: "文中用 « souvent séduisantes sur la forme mais parfois approximatives ou biaisées sur le fond » 说明AI文本金玉其外。",
      },
      {
        q: "Sur quoi portent les nouvelles formes d'évaluation expérimentées à l'université ?",
        options: [
          "Sur le raisonnement, la vérification et la justification orale.",
          "Sur la mémorisation de définitions techniques.",
          "Sur la rédaction collective de longs mémoires anonymes.",
        ],
        answer: 0,
        why: "第三段举例口头答辩、分析机器文本局限与留痕研究步骤，旨在评估思维与核查过程。",
      },
    ],
  },
  {
    id: "p-zfe-mobilite",
    title: "Zones à faibles émissions : concilier qualité de l'air et justice sociale",
    topic: "environnement",
    topicZh: "环境与出行",
    level: "B2",
    sourceNote: "城市治理讨论 · 自编分级 B2",
    text: `Destinées à interdire progressivement les véhicules les plus anciens dans les grandes agglomérations, les zones à faibles émissions poursuivent un objectif sanitaire difficilement contestable. Chaque année, la pollution atmosphérique liée au trafic routier demeure responsable de milliers de maladies respiratoires et cardiovasculaires, en particulier le long des grands axes urbains.

Néanmoins, la mise en œuvre de ces restrictions suscite une vive incompréhension chez une partie des habitants de la périphérie. Faute de transports collectifs rapides reliant les zones rurales ou les banlieues éloignées aux bassins d'emploi, la voiture reste souvent indispensable pour se rendre au travail. Or les ménages modestes n'ont généralement pas les moyens d'acheter un véhicule récent, même d'occasion.

La situation est particulièrement sensible pour les artisans du bâtiment, les infirmières à domicile et les employés travaillant en horaires décalés, tôt le matin ou tard le soir. Pour ces professions essentielles au fonctionnement quotidien de la métropole, renoncer à l'automobile individuelle paraît irréaliste tant que le réseau ferré régional souffre de retards répétés ou d'une fréquence insuffisante après vingt heures. Plusieurs observatoires urbains soulignent d'ailleurs que les véhicules les plus polluants appartiennent majoritairement aux foyers les plus modestes, créant un paradoxe politique : sans aide ciblée, la restriction écologique risque d'aggraver les inégalités territoriales déjà marquées entre centres aisés et couronnes populaires.

Pour éviter que la transition écologique ne soit perçue comme une sanction sociale, plusieurs élus et associations proposent d'ajuster le calendrier et d'amplifier les dispositifs d'accompagnement. Parmi les pistes évoquées figurent le prêt à taux zéro garanti par l'État, le développement de lignes de cars express et l'ouverture de parkings relais gratuits en entrée de ville. L'acceptabilité d'une politique environnementale dépend largement des alternatives concrètes offertes aux usagers.`,
    zh: `旨在逐步禁止老旧机动车驶入大城市核心区的低排放区政策，有着难以质疑的公共健康目标。每年，道路交通引发的大气污染依然导致数以千计的呼吸系统和心血管疾病，尤其是在城市主干道沿线。

然而，这些限行举措在不少近郊与远郊居民中引发了强烈的不解。由于缺少连接偏远城镇与就业中心的快捷公共交通，私家车依然是许多人的刚性通勤工具。而低收入家庭往往无力购置新车，哪怕是较新的二手车。

这一矛盾对于建筑手工业者、上门护理的护士以及早晚倒班的职工而言尤为突出。只要区域铁路网在晚上八点后依然面临班次稀疏和频繁晚点的问题，让维持城市日常运转的这部分人群放弃私家车就不切实际。多个城市观察站也指出，排放标准最旧的车辆往往恰恰属于最不富裕的家庭，这就形成了一个治理悖论：如果缺乏精准财政补贴，环保限行很可能加剧富裕中心城区与工薪外围地带本已存在的地域不平等。

为避免绿色转型被民众视为「针对穷人的惩罚」，多名民选代表和协会建议调整执行节奏并加大配套扶持力度。讨论中的方案包括政府担保的无息购车贷款、增开快速城际大巴以及在入城口增设免费换乘停车场。环保政策能否获得公众接纳，很大程度上取决于是否为出行者提供了切实可行的替代方案。`,
    quiz: [
      {
        q: "Quel est l'objectif premier des zones à faibles émissions rappelé au début du texte ?",
        options: [
          "Protéger la santé publique contre la pollution routière.",
          "Réduire les embouteillages aux heures de pointe.",
          "Financer la construction de nouvelles autoroutes urbaines.",
        ],
        answer: 0,
        why: "第一段点明该政策的核心目标是改善空气质量，减少道路污染引发的呼吸道与心血管疾病（objectif sanitaire）。",
      },
      {
        q: "Pourquoi les habitants des zones périphériques se sentent-ils pénalisés ?",
        options: [
          "Les parkings du centre-ville sont réservés aux résidents.",
          "Ils dépendent de leur voiture faute de transports en commun adaptés et peinent à en changer.",
          "Les stations-service de banlieue ferment les unes après les autres.",
        ],
        answer: 1,
        why: "第二段指出郊区缺少快捷公交且低收入家庭难以负担更换低排放汽车。",
      },
      {
        q: "Selon l'article, de quoi dépend principalement la réussite de cette mesure ?",
        options: [
          "De l'augmentation du montant des contraventions.",
          "De la gratuité totale des voitures électriques pour les entreprises.",
          "De la qualité des solutions de remplacement proposées aux citoyens.",
        ],
        answer: 2,
        why: "末句总结环保政策的民众接受度主要取决于向使用者提供的切实替代方案（alternatives concrètes）。",
      },
    ],
  },
  {
    id: "p-alimentation",
    title: "Manger local en restauration collective : ambitions et réalités agricoles",
    topic: "environnement",
    topicZh: "生态与消费",
    level: "B2",
    sourceNote: "社会消费观察 · 自编分级 B2",
    text: `De nombreuses collectivités s'engagent aujourd'hui à servir davantage de produits biologiques et locaux dans les cantines scolaires et les restaurants administratifs. Cette orientation répond à une double attente : améliorer la qualité nutritionnelle des repas tout en garantissant des débouchés plus stables aux agriculteurs de la région.

Sur le terrain, passer de l'intention à la pratique se révèle pourtant complexe. Les cuisines centrales préparent parfois plusieurs milliers de couverts par jour et ont besoin de volumes réguliers, calibrés et faciles à transformer. Or une petite exploitation maraîchère locale ne dispose pas toujours des équipements nécessaires pour laver, éplucher et conditionner ses récoltes aux normes sanitaires exigées.

À cette difficulté technique s'ajoute souvent un obstacle administratif lié aux règles de la commande publique. Les appels d'offres rédigés par les collectivités privilégient parfois des lots trop importants pour qu'un seul producteur puisse y répondre, favorisant ainsi de grands grossistes nationaux. Certaines mairies ont donc commencé à découper leurs marchés en lots plus restreints, par exemple en séparant les pommes, les légumes racines et les produits laitiers. Elles encouragent également les agriculteurs voisins à se regrouper en coopératives afin de garantir la continuité des livraisons tout au long de l'année scolaire, malgré les aléas climatiques.

Pour surmonter ces blocages, certains territoires expérimentent la création de légumeries publiques mutualisées entre plusieurs communes ainsi que l'adaptation des menus aux récoltes réelles de chaque saison. Parallèlement, la formation des chefs cuisiniers à la cuisine brute à partir de produits frais permet de réduire le gaspillage alimentaire, dont les économies financent une partie du surcoût des matières premières.`,
    zh: `如今，许多地方政府承诺在学校食堂与机关餐厅中提高有机和本地食材的比例。这一方向回应了双重期待：既提升餐食的营养品质，又为本地区的农民提供更稳定的销售渠道。

然而在具体落地过程中，从意愿走向实践却并不简单。中心厨房有时每日需配餐数千份，依赖供应稳定、规格统一且易于加工的原料。但当地小型菜农往往缺乏清洗、去皮及按严格卫生标准预包装的配套设备。

除了技术门槛，公共采购法规带来的行政障碍同样常见。地方政府拟定的招标标段往往体量过大，单个农户无力独自承接，客观上反而让全国性的大型批发商占了优势。为此，部分市政府开始将采购项目拆分成更小的品类包，例如将苹果、根茎类蔬菜和乳制品分开招标，并鼓励周边农户联合组建合作社，以便在应对天气波动的同时保障整个学年食材的稳定供货。

为打通这些堵点，部分地区正在尝试由多个市镇联合建设共享净菜加工站，并根据各季节的实际收成动态调整菜单。与此同时，培训厨师直接使用新鲜原料现煮而非依赖半成品，有助于大幅减少食物浪费，节省下来的费用正好可以补贴部分优质食材的溢价成本。`,
    quiz: [
      {
        q: "Quel frein logistique complique l'approvisionnement local des grandes cantines ?",
        options: [
          "Les petits producteurs manquent souvent d'installations pour préparer et conditionner de gros volumes.",
          "Les élèves refusent les légumes de saison.",
          "La loi interdit aux mairies d'acheter directement aux fermes.",
        ],
        answer: 0,
        why: "第二段说明小农场常缺少满足集体食堂卫生和规格要求的清洗、去皮与分装设施。",
      },
      {
        q: "Comment certains territoires compensent-ils le prix plus élevé des produits frais ?",
        options: [
          "En diminuant les portions servies aux adultes.",
          "En réduisant le gaspillage grâce au savoir-faire des cuisiniers.",
          "En augmentant fortement le tarif payé par les familles.",
        ],
        answer: 1,
        why: "最后一句提到通过培训厨师现做减少食物浪费，节省的开支能分摊原料涨价成本。",
      },
      {
        q: "Quel outil collectif a été créé entre plusieurs communes pour faciliter ce modèle ?",
        options: [
          "Une plateforme de livraison à domicile par vélo.",
          "Des serres chauffées installées sur les toits des écoles.",
          "Des ateliers partagés de préparation des légumes.",
        ],
        answer: 2,
        why: "第三段明确提到 « légumeries publiques mutualisées »（多市镇共建共享的净菜处理站）。",
      },
    ],
  },
  {
    id: "p-logement",
    title: "Cohabitation intergénérationnelle : une réponse partielle à la crise du logement",
    topic: "societe",
    topicZh: "社会与住房",
    level: "B2",
    sourceNote: "社会住房议题 · 自编分级 B2",
    text: `Face à la flambée des loyers dans les villes universitaires, trouver un logement abordable devient chaque rentrée un parcours d'obstacles pour les étudiants. Parallèlement, de nombreuses personnes âgées vivent seules dans des appartements ou des maisons devenus trop vastes, tout en éprouvant parfois un sentiment de solitude ou d'inquiétude face aux coûts d'entretien.

De ce double constat est née la cohabitation intergénérationnelle solidaire, encadrée en France par un cadre légal précis. Un senior accepte de louer une chambre à un jeune pour un loyer modeste, voire symbolique, en échange d'une présence rassurante le soir et de petits services du quotidien tels que partager un dîner, porter les courses ou aider pour une démarche numérique.

Pour l'étudiant comme pour le propriétaire, l'avantage ne se limite pas à l'aspect matériel. Plusieurs universitaires étrangers installés en France pour une année soulignent que cette cohabitation leur offre une immersion linguistique précieuse et une compréhension intime des usages du pays, bien loin de l'isolement fréquent dans les studios individuels. De leur côté, de nombreux seniors expliquent retrouver un rythme de vie plus stimulant, le plaisir de transmettre une histoire familiale et la satisfaction concrète de contribuer à la réussite d'un jeune adulte. Des médiateurs associatifs assurent d'ailleurs un suivi trimestriel afin de résoudre rapidement les petits malentendus du quotidien avant qu'ils ne s'enveniment.

Bien que les associations locales saluent des histoires humaines très réussies, cette formule reste modeste par rapport à l'ampleur des besoins nationaux. La réussite de la cohabitation suppose une sélection minutieuse des profils, des attentes clarifiées par contrat et une tolérance mutuelle sur les rythmes de vie. Elle complète utilement les résidences étudiantes sans pouvoir s'y substituer.`,
    zh: `面对大学城房租飙升，每年开学季找到负担得起的住处对大学生而言都堪称重重闯关。与此同时，不少老年人独居在略显空旷的公寓或住宅中，既时常感到孤单，又要面对高昂的房屋维护开支。

基于这一双重需求，在法国有明确法律框架保障的「跨代互助合租」应运而生。长者愿意以低廉甚至象征性的租金把房间租给年轻人，作为回报，年轻人则提供晚间令人安心的陪伴以及日常小帮手，例如陪吃一顿晚饭、帮忙提重物买菜或协助处理线上政务手续。

无论是对学生还是房东来说，这种模式的收益都不仅停留在物质层面。多位赴法交流一年的外国留学生表示，与本地老人同住为他们提供了难得的语言沉浸环境，让他们真切理解当地人的生活习惯，避免了独居单间常见的孤独感。而许多老人也谈到，年轻人的到来重新激活了日常生活节奏，让他们体验到讲述家族记忆的乐趣以及实实在在托举年轻人成长的满足感。社团调解员还会每季度回访一次，及时化解琐碎磨合中的小误会。

尽管地方公益机构点赞了许多温暖感人的跨代情谊，但这种形式与全国庞大的住房缺口相比仍属有限补充。合租要长久融洽，离不开仔细的双向匹配、写入合同的明确边界以及彼此对作息习惯的包容。它能有效配合学生公寓建设，却无法完全取代后者。`,
    quiz: [
      {
        q: "Sur quel principe repose la cohabitation intergénérationnelle décrite dans l'article ?",
        options: [
          "La vente progressive du logement par le propriétaire âgé à l'étudiant.",
          "Un échange entre un loyer réduit et une présence accompagnée de menus services.",
          "Un hébergement gratuit financé entièrement par les universités.",
        ],
        answer: 1,
        why: "第二段说明长者提供低租金房间，年轻人则提供晚间陪伴及简单生活协助。",
      },
      {
        q: "Pourquoi cette solution ne suffit-elle pas à régler toute la crise du logement étudiant ?",
        options: [
          "Elle est interdite dans la majorité des villes moyennes.",
          "Les propriétaires âgés réclament des loyers supérieurs au marché.",
          "Son volume reste limité et exige une compatibilité précise entre les personnes.",
        ],
        answer: 2,
        why: "第三段点明其规模相对于全国需求仍然较小（reste modeste），且高度依赖双方匹配、明确协议和作息包容。",
      },
      {
        q: "Quelle attitude est présentée comme indispensable au bon déroulement de cette expérience ?",
        options: [
          "Une acceptation réciproque des habitudes de vie de chacun.",
          "Le partage obligatoire de tous les repas de la semaine.",
          "L'installation d'une entrée séparée dans l'appartement.",
        ],
        answer: 0,
        why: "第三段末尾明确提到 « une tolérance mutuelle sur les rythmes de vie »（对彼此生活节奏的相互包容）。",
      },
    ],
  },
  {
    id: "p-deconnexion",
    title: "Droit à la déconnexion : pourquoi la règle écrite ne suffit toujours pas",
    topic: "sante",
    topicZh: "健康与生活",
    level: "B2",
    sourceNote: "劳动健康观察 · 自编分级 B2",
    text: `Inscrit dans le code du travail français depuis plusieurs années, le droit à la déconnexion garantit en principe aux salariés de ne pas répondre aux messages professionnels en dehors de leurs horaires habituels. De nombreuses entreprises ont adopté des chartes internes ou affiché des rappels automatiques en bas des courriels envoyés tard le soir.

Dans la réalité quotidienne, pourtant, la frontière entre temps de travail et vie privée continue souvent de s'effacer. Avec les téléphones professionnels toujours à portée de main et la crainte diffuse de passer pour peu impliqué lors des évaluations annuelles, beaucoup de cadres consultent encore leur boîte de réception le week-end ou pendant leurs congés, même sans demande explicite de leur hiérarchie.

Le développement du travail international accentue encore cette dérive insidieuse. Lorsqu'une équipe collabore entre Paris, Montréal et Singapour, le décalage horaire invite à répondre à des sollicitations tardives sous prétexte de maintenir la fluidité des projets. Pour y remédier, certaines organisations informatiques ont testé des dispositifs techniques plus fermes, comme la mise en veille des serveurs de messagerie après dix-neuf heures ou la fonction d'envoi différé qui programme automatiquement la distribution au lendemain matin à huit heures. Toutefois, ces barrières numériques ne fonctionnent que si elles s'accompagnent d'un dialogue franc sur les priorités réelles de chaque service.

Les spécialistes de la santé au travail rappellent que ce maintien permanent en alerte nuit à la récupération mentale et nourrit l'épuisement professionnel à long terme. Selon eux, les textes restent lettre morte si les dirigeants eux-mêmes continuent d'envoyer des instructions à vingt-deux heures. Une véritable culture de la déconnexion passe d'abord par une répartition réaliste de la charge de travail et par l'exemplarité du management.`,
    zh: `写入法国《劳动法典》已有数年的「离线权」，原则上保障员工在常规工作时间之外有权不回复工作消息。不少公司也制定了内部公约，或在深夜发出的邮件末尾加上「非紧急无需立即回复」的自动提示。

然而在日常职场中，工作与私人生活的边界却往往继续模糊。办公手机始终触手可及，加上担心在年度考核时被认为不够敬业，许多职场人士即便没有收到上司明文要求，仍会在周末或休假期间习惯性刷新收件箱。

跨国协作的增加进一步放大了这种隐性加班。当团队横跨巴黎、蒙特利尔与新加坡时，时差往往会成为下班后继续处理沟通的理由。为此，部分信息企业开始测试更硬核的技术防线，例如晚上七点后让邮件服务器自动进入休眠，或者默认启用定时发送功能，把夜间写就的邮件统一推迟到次日清晨八点送达。但若不对各部门的真实工作优先级展开坦诚评估，技术拦截依然容易流于表面。

职业健康专家提醒，长期处于这种「待命警觉状态」会妨碍大脑真正休息，并在日积月累中诱发职业倦怠。在他们看来，只要管理层自己还在晚上十点发送工作指令，再好的条文也只能沦为一纸空文。真正的离线文化，首先要靠合理分配工作负荷以及管理者的以身作则。`,
    quiz: [
      {
        q: "Quelle limite des chartes d'entreprise l'article met-il en évidence ?",
        options: [
          "Elles sont inconnues des nouveaux employés.",
          "La pression implicite pousse quand même de nombreux salariés à consulter leurs messages hors horaires.",
          "Elles bloquent les serveurs informatiques dès dix-huit heures.",
        ],
        answer: 1,
        why: "第二段解释由于担心被视为不够投入的隐形压力以及设备随身携带，不少人仍自觉在休息时看邮件。",
      },
      {
        q: "Quel facteur rend les règles écrites inefficaces selon les experts ?",
        options: [
          "L'envoi persistant de courriels tardifs par les responsables.",
          "Le coût élevé des abonnements téléphoniques professionnels.",
          "L'absence de sanctions financières prévues par les syndicats.",
        ],
        answer: 0,
        why: "第三段点出若管理者本人仍在晚上十点发指令，书面条文就会沦为一纸空文（lettre morte）。",
      },
      {
        q: "Que faudrait-il privilégier pour rendre le droit à la déconnexion effectif ?",
        options: [
          "Interdire le travail le vendredi après-midi.",
          "Supprimer totalement la messagerie électronique interne.",
          "Ajuster la charge réelle de travail et faire montrer l'exemple par les managers.",
        ],
        answer: 2,
        why: "末句给出两条治本措施：合理分配工作负荷（répartition réaliste de la charge de travail）与管理层示范（exemplarité du management）。",
      },
    ],
  },
  {
    id: "p-culture-musees",
    title: "Gratuité des musées : démocratisation réelle ou effet d'aubaine ?",
    topic: "culture",
    topicZh: "文化政策",
    level: "B2",
    sourceNote: "文化公共政策 · 自编分级 B2",
    text: `Faut-il rendre l'entrée des musées nationaux entièrement gratuite pour tout le monde, à l'image de certaines institutions britanniques ? Les défenseurs d'une telle réforme estiment que la culture constitue un bien commun et que supprimer le prix du billet lève un obstacle psychologique autant que financier pour les familles populaires.

Pourtant, plusieurs enquêtes de fréquentation invitent à nuancer cet enthousiasme. En France, les jeunes de moins de vingt-six ans et les demandeurs d'emploi bénéficient déjà d'un accès gratuit aux collections permanentes publiques. Or les statistiques montrent que l'élargissement des publics dépend moins de quelques euros économisés à l'entrée que de la familiarité acquise à l'école et des habitudes culturelles familiales.

Par ailleurs, la gratuité généralisée profite surtout aux touristes étrangers et aux catégories déjà très diplômées qui fréquentaient de toute façon les expositions, ce que certains économistes qualifient d'effet d'aubaine. Lorsque l'accès est libre chaque jour, les visiteurs peuvent en outre ressentir moins d'urgence à s'inscrire aux visites guidées, parfois décisives pour comprendre des œuvres exigeantes. Dans plusieurs grandes villes de province comme Lille ou Marseille, des directeurs d'établissements ont constaté qu'ouvrir gratuitement un soir par semaine avec des concerts, des rencontres d'artistes et une atmosphère détendue attirait bien davantage de jeunes actifs et de familles du quartier qu'une simple suppression de tarif.

À l'inverse, une gratuité sans condition réduit fortement les recettes propres des musées, alors même que la conservation des œuvres et la médiation culturelle coûtent de plus en plus cher. De nombreux conservateurs préfèrent donc maintenir une tarification ciblée : gratuité élargie pour les publics prioritaires et maintien d'un billet payant pour les touristes internationaux aisés, afin de financer des ateliers de quartier.`,
    zh: `是否应当像部分英国机构那样，向所有人完全免费开放国立博物馆？支持这项改革的人认为，文化属于公共财富，免除门票价格能在经济与心理上同时消除普通工薪家庭走进展馆的门槛。

然而，多项参观人数调查却提醒人们审慎看待这一设想。在法国，26 岁以下青年及求职者早已享受公立博物馆常设展免费政策。而统计数据显示，观众群体的真正多元化并不主要取决于省下几欧元的门票，而更多受学校艺术启蒙与家庭文化氛围的影响。

此外，全面免票主要惠及原本就会逛展的高学历人群与外国游客，这被部分经济学家称为「意外搭便车效应」。在里尔或马赛等省会城市，多位馆长在实践中发现：比起单纯取消门票，每周开放一个结合小型音乐会、艺术家对谈和轻松氛围的夜间免费专场，反而更能吸引平时很少踏入展厅的年轻上班族与周边社区家庭。

相反，不加筛选地全员免费会大幅削弱博物馆的自筹经费能力，而文物保护与公共导览的成本却在不断攀升。因此，许多馆长更倾向于维持「精准阶梯票价」：对重点人群保持免票，同时向高消费力的国际游客保留合理收费，再用这笔收入补贴深入社区的文化工作坊。`,
    quiz: [
      {
        q: "Que révèlent les statistiques sur la fréquentation des musées évoquées dans le texte ?",
        options: [
          "L'éducation artistique et les habitudes familiales comptent plus que la gratuité seule.",
          "La baisse du tarif suffit à attirer immédiatement de nouveaux publics.",
          "Les jeunes de moins de vingt-six ans boudent les collections permanentes.",
        ],
        answer: 0,
        why: "第二段指出观众来源更受学校启蒙与家庭文化习惯影响，而非单纯免除几欧元门票。",
      },
      {
        q: "Quel risque financier la gratuité universelle ferait-elle peser sur les musées ?",
        options: [
          "Elle empêcherait d'embaucher des gardiens de salle.",
          "Elle obligerait à vendre certaines œuvres aux enchères.",
          "Elle réduirait les ressources nécessaires à l'entretien et aux actions culturelles.",
        ],
        answer: 2,
        why: "第三段提到无条件免费会削减自筹收入，影响文物养护（conservation）与公众教育活动经费。",
      },
      {
        q: "Quelle politique tarifaire de nombreux responsables préfèrent-ils conserver ?",
        options: [
          "Une entrée payante unique sans aucune réduction.",
          "Des exonérations ciblées financées en partie par les visiteurs payants.",
          "Un abonnement annuel obligatoire pour tous les habitants.",
        ],
        answer: 1,
        why: "末句说明保留对优先群体免票，同时向经济宽裕游客售票反哺社区工坊。",
      },
    ],
  },
  {
    id: "p-demographie",
    title: "Vieillissement démographique : repenser la place des seniors dans la cité",
    topic: "societe",
    topicZh: "人口与社会",
    level: "B2",
    sourceNote: "人口结构变迁 · 自编分级 B2",
    text: `Avec l'allongement de l'espérance de vie et l'arrivée à la retraite de générations nombreuses, la part des plus de soixante-cinq ans progresse rapidement dans la population européenne. Trop souvent, le débat public aborde cette évolution uniquement sous l'angle comptable des dépenses de retraite et du financement de la dépendance.

Sans nier l'importance de l'équilibre budgétaire, plusieurs sociologues rappellent que les seniors représentent aussi une ressource essentielle pour le tissu social. Dans les communes rurales comme dans les quartiers urbains, des millions de retraités assurent le fonctionnement quotidien des associations caritatives, du soutien scolaire ou encore la garde ponctuelle de leurs petits-enfants, permettant aux parents de concilier travail et vie familiale.

Cette contribution invisible représente pourtant un pilier économique et humain considérable, régulièrement sous-estimé dans les statistiques officielles. Lorsque l'âge légal de départ ou l'organisation du travail évolue, ce sont aussi ces solidarités de proximité qui risquent de s'effriter, obligeant parfois les municipalités à créer de nouveaux services payants de garde périscolaire. Parallèlement, les maisons de quartier qui proposent des ateliers informatiques animés par des jeunes bénévoles pour des seniors constatent que l'échange profite aux deux générations : chacun y gagne une écoute attentive, brisant à la fois la fracture numérique et le cloisonnement social entre les âges.

Adapter les villes au vieillissement ne consiste donc pas seulement à construire des établissements médicalisés. Cela suppose d'aménager des trottoirs accessibles, de multiplier les bancs publics, de préserver des guichets humains dans les services administratifs face au tout-numérique et d'encourager les projets mêlant plusieurs générations. Une ville conçue pour les plus âgés profite en réalité à tous les habitants.`,
    zh: `随着预期寿命延长以及战后婴儿潮世代步入退休期，65 岁以上人口在欧洲总人口中的比重正迅速上升。然而公共讨论往往过于单一地聚焦于养老金账本与失能照护财政支出。

多位社会学家在承认财政平衡重要性的同时指出，老年群体本身也是社会网络中不可或缺的重要支撑。无论在乡村市镇还是城市街区，数以百万计的退休人员默默维系着公益社团、课业辅导的日常运转，并分担隔代照看任务，让年轻父母得以兼顾工作与家庭。

这种看似隐形的付出，实际上构成了官方统计中常被低估的社会经济支柱。一旦退休年龄或用工节奏发生变化，这类邻里与亲情互助网络也可能随之松动，有时甚至迫使市政当局新设收费的课后托管服务。与此同时，由青年志愿者在社区中心为长者开设的电脑培训班也证明了双向受益的价值：两代人在耐心倾听中同时跨越了数字鸿沟与年龄隔阂。

因此，让城市适应老龄化绝不仅仅是增建医养院舍。这还需要修缮无障碍人行道、增设公共座椅、在政务全面电子化的同时保留人工服务窗口，并鼓励跨代共融项目。一座对老年人友好的城市，实际上让所有年龄段的居民都能从中受益。`,
    quiz: [
      {
        q: "Que reproche l'auteur à la manière habituelle de traiter le vieillissement ?",
        options: [
          "De le réduire principalement à une question de coûts financiers.",
          "D'ignorer totalement l'augmentation de l'espérance de vie.",
          "De surestimer le nombre de retraités vivant à la campagne.",
        ],
        answer: 0,
        why: "第一段指出公共讨论过于频繁地仅从养老支出账目（angle comptable）看待老龄化。",
      },
      {
        q: "Comment les retraités contribuent-ils concrètement à la vie collective ?",
        options: [
          "En finançant directement les transports scolaires.",
          "Par leur engagement associatif et leur aide familiale quotidienne.",
          "En remplaçant les fonctionnaires dans les mairies.",
        ],
        answer: 1,
        why: "第二段说明退休老人活跃于公益社团、课业帮扶及帮子女照看孩子，维系着社会纽带。",
      },
      {
        q: "Parmi les aménagements proposés, quel maintien précis l'article réclame-t-il ?",
        options: [
          "La suppression des bornes informatiques dans les gares.",
          "La limitation de la hauteur des nouveaux immeubles.",
          "Des accueils avec des agents humains dans les administrations.",
        ],
        answer: 2,
        why: "第三段提到面对全面数字化，必须保留行政公共服务中的人工窗口（guichets humains）。",
      },
    ],
  },
  {
    id: "p-mode-circulaire",
    title: "Seconde main : vraie sobriété vestimentaire ou alibi de surconsommation ?",
    topic: "economie",
    topicZh: "经济与消费",
    level: "B2",
    sourceNote: "消费趋势观察 · 自编分级 B2",
    text: `En quelques années, les plateformes d'achat et de revente de vêtements d'occasion ont connu un essor fulgurant, particulièrement chez les jeunes adultes. Souvent présentée comme une alternative écologique à l'industrie textile très polluante, la mode circulaire permet à la fois de préserver son pouvoir d'achat et de prolonger la durée de vie d'habits encore en parfait état.

Pour autant, des observateurs de la transition écologique émettent une réserve de taille. Loin de remplacer systématiquement l'achat neuf, la facilité de revendre un article quelques semaines après l'avoir acquis encourage parfois les consommateurs à acheter davantage, persuadés qu'ils pourront récupérer une partie de leur mise à tout moment. De plus, la multiplication des petits colis expédiés individuellement d'un bout à l'autre du pays alourdit le bilan carbone du secteur.

Autre tendance observée par les chercheurs en consommation : certaines grandes enseignes de prêt-à-porter rapide ont elles-mêmes intégré des espaces consacrés à la seconde main dans leurs propres magasins ou sur leurs sites, tout en continuant de renouveler leurs collections neuves chaque semaine à bas prix. Aux yeux des ONG environnementales, ce modèle entretient une ambiguïté trompeuse : le consommateur a le sentiment d'accomplir un geste vertueux lorsqu'il dépose un sac de vieux vêtements contre un bon d'achat de cinq euros, alors que ce coupon l'incite immédiatement à racheter un vêtement neuf dont il n'avait pas réellement besoin.

Selon les associations de consommateurs responsables, l'économie circulaire ne tiendra ses promesses que si elle s'accompagne d'une réduction globale du volume acheté. Réparer un manteau abîmé, louer une tenue portée une seule fois ou privilégier les échanges locaux sans transport postal restent bien plus efficaces pour diminuer notre empreinte environnementale.`,
    zh: `短短几年间，二手服饰交易平台在年轻成年群体中迎来了爆发式增长。循环时尚常被宣传为高污染纺织业的绿色替代品，既能帮助民众守住购买力，又能延长完好衣物的使用寿命。

然而，绿色转型观察人士也提出了不可忽视的保留意见。二手转卖的便捷性并不总能替代新品购买——相反，知道随时能脱手回血，反而有时会纵容消费者毫无顾忌地买得更多。此外，一件件单独跨省寄送的小包裹快递，也无形中推高了该行业的碳排放账单。

消费研究学者还注意到一个耐人寻味的现象：一些快时尚大牌纷纷在自家门店或网站上辟出二手回收专区，与此同时却仍保持每周高频率上新低价成衣的节奏。在环保非政府组织看来，这种做法制造了一种极具迷惑性的环保错觉：顾客拿一袋旧衣换取五欧元代金券时误以为自己行了环保之举，而这张代金券随即又刺激他去买一件本来并不需要的新衣。

在倡导理性消费的协会看来，只有当人们购买衣物的总件数真正降下来时，循环经济才算兑现环保承诺。相比频繁买进卖出，修补一件受损的外套、租赁仅穿一次的礼服，或者开展无需物流寄递的同城置换，才能更有效地降低环境足迹。`,
    quiz: [
      {
        q: "Quel effet pervers les observateurs associent-ils à la facilité de revente ?",
        options: [
          "Les magasins traditionnels baissent trop rapidement leurs prix.",
          "La qualité des tissus neufs s'améliore trop lentement.",
          "Les acheteurs achètent parfois plus, pensant amortir facilement leurs dépenses.",
        ],
        answer: 2,
        why: "第二段指出容易回血转卖的心态反而促使部分人购买更多衣物。",
      },
      {
        q: "Quel impact négatif supplémentaire l'article signale-t-il ?",
        options: [
          "Le coût écologique lié à l'envoi postal de multiples petits colis.",
          "La disparition totale des friperies de quartier.",
          "L'interdiction d'échanger des vêtements entre amis.",
        ],
        answer: 0,
        why: "文中提到全国各地零散邮寄大量小包裹会加重碳排放负担（alourdit le bilan carbone）。",
      },
      {
        q: "Quelle condition est jugée décisive pour une mode réellement plus sobre ?",
        options: [
          "Changer de garde-robe à chaque saison via des applications.",
          "Réduire la quantité totale d'achats, réparer et favoriser le local.",
          "Taxer uniquement les vêtements fabriqués hors d'Europe.",
        ],
        answer: 1,
        why: "最后一段强调前提是减少总购买量，同时推广修补、租赁与同城免快递交换。",
      },
    ],
  },
  {
    id: "p-langues",
    title: "Apprendre plusieurs langues vivantes à l'ère de la traduction instantanée",
    topic: "culture",
    topicZh: "语言与文化",
    level: "B2",
    sourceNote: "语言教育思考 · 自编分级 B2",
    text: `Alors que les traducteurs automatiques intégrés aux téléphones permettent désormais de commander un repas ou de suivre une conversation basique presque sans effort, certains s'interrogent sur l'utilité de consacrer des années à l'étude des langues étrangères. Pourquoi mémoriser des conjugaisons complexes si un algorithme répond en une seconde ?

Les linguistes soulignent toutefois que communiquer ne se réduit jamais à un simple échange d'informations littérales. Comprendre l'humour d'un interlocuteur, percevoir une hésitation diplomatique dans une négociation ou saisir les sous-entendus culturels d'une presse étrangère exige une maîtrise directe de la langue. Un logiciel peut traduire les mots d'un contrat, mais il peine encore à établir une relation de confiance durable entre deux personnes.

Dans le monde professionnel comme dans la recherche universitaire, la maîtrise d'une langue étrangère reste d'ailleurs un marqueur fort d'engagement et de crédibilité. Les diplomates et les dirigeants d'entreprise savent combien il est apprécié d'échanger directement sans interprète lors des moments informels qui précèdent ou suivent une réunion officielle. De même, apprendre la langue du pays d'accueil permet aux étudiants internationaux de sortir du cercle fermé des campus anglophones, de comprendre les débats politiques locaux et de tisser de véritables amitiés dans la durée, au lieu de rester simples observateurs de passage.

Au-delà de l'aspect pratique, l'apprentissage linguistique transforme aussi la manière de penser. Passer régulièrement d'un système grammatical à un autre développe la souplesse intellectuelle et aide à relativiser sa propre vision du monde. À l'heure où l'information circule instantanément, lire directement les sources originales en version étrangère demeure l'un des meilleurs remparts contre les malentendus et les clichés.`,
    zh: `如今手机内置的即时翻译工具几乎能让人毫不费力地完成点餐甚至进行基本对话，于是有人开始质疑花费数年苦学外语的价值：既然算法一秒就能翻译，何必还要背诵繁琐的动词变位？

但语言学家指出，人与人之间的交流绝不仅仅是字面信息的机械对译。想要听懂对方的幽默、察觉谈判桌上一闪而过的微妙迟疑，或是读懂外媒字里行间的文化潜台词，都离不开对语言的直接掌握。软件或许能译出合同文本，却难以在两个人之间建立起稳固的信任纽带。

无论在职场还是大学研究领域，掌握一门外语依然体现着诚意与专业可信度。外交官和企业管理者深知，在正式会议前后的寒暄时刻不用翻译软件直接交谈，往往能拉近彼此距离。同样，学习东道国语言能让留学生走出纯英语校园的小圈子，真正读懂当地的公共讨论并建立起长久的真挚友谊，而不只是匆匆过客。

除了实用层面，学习外语还会重塑人的思维方式。在两套不同的语法与表达体系间频繁切换，能够锻炼大脑的思维弹性，帮助我们跳出单一视角的局限。在信息瞬间传遍全球的今天，直接阅读外语一手信源依然是打破误解与刻板印象最可靠的防线之一。`,
    quiz: [
      {
        q: "Selon les linguistes, qu'est-ce qu'un traducteur automatique ne parvient pas à remplacer ?",
        options: [
          "La rapidité de recherche dans un dictionnaire papier.",
          "La nuance culturelle et la création d'un lien humain de confiance.",
          "La prononciation exacte des chiffres techniques.",
        ],
        answer: 1,
        why: "第二段指出感知幽默、谈判试探、文化潜台词以及建立长期人与人之间的信任都无法由翻译软件代劳。",
      },
      {
        q: "Quel bénéfice cognitif l'apprentissage de plusieurs langues apporte-t-il ?",
        options: [
          "Il renforce la flexibilité mentale et la prise de recul culturel.",
          "Il accélère uniquement l'apprentissage des mathématiques.",
          "Il dispense de lire la presse écrite.",
        ],
        answer: 0,
        why: "第三段写明 « développe la souplesse intellectuelle et aide à relativiser sa propre vision du monde »。",
      },
      {
        q: "Pourquoi l'auteur conseille-t-il de lire directement des sources en version originale ?",
        options: [
          "Pour éviter les abonnements coûteux aux médias locaux.",
          "Pour retenir plus facilement les règles de conjugaison rarement utilisées.",
          "Pour limiter les idées reçues et les erreurs d'interprétation.",
        ],
        answer: 2,
        why: "末句提到直接阅读外语一手信源是抵御误解（malentendus）与刻板印象（clichés）的最佳防线之一。",
      },
    ],
  },
];

export const readPresetById = (id?: string): ReadPreset | undefined => READ_PRESETS.find((p) => p.id === id);
