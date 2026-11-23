/**
 * TCF (Tout Public / TCF Canada) & TEF (Post-Dec-2023 CCI Paris / TEF Canada) 4-option QCM comprehension suites (待核对).
 *
 * Lazy-loaded exclusively inside `Comprehension.tsx` when `examTrack !== "delf"` so the main entry bundle stays lean.
 * Built directly with typed 4-option `TrackCompQuestion` items (`A / B / C / D`) without passing through DELF's 3-option `sanitizeExercise`.
 */
import type { CompExercise, CompQuestion } from "./exam-schema";
import type { BankPaper } from "../store/exam-bank";

export interface TrackCompQuestion extends CompQuestion {
  /** Progressive CEFR item weight: 1 (A1), 2 (A2), 3 (B1), 4 (B2), 5 (B2+/C1-), 6 (C1/C2). */
  difficulty: number;
  /** Post-Dec-2023 TEF reading section type (1..5) when applicable. */
  tefTaskType?: 1 | 2 | 3 | 4 | 5;
}

export interface TrackCompExercise extends Omit<CompExercise, "questions"> {
  questions: TrackCompQuestion[];
}

export interface TrackPaper extends Omit<BankPaper, "exs"> {
  track: "tcf" | "tef";
  section: "co" | "ce";
  titleZh: string;
  badge: string;
  durationMinutes: number;
  exs: TrackCompExercise[];
}

/* ============================================================================
 * 1. TCF CO Suite — 12 progressive single-play 4-option items across 3 exercises
 * ============================================================================ */

const TCF_CO_EX1: TrackCompExercise = {
  form: "short",
  topic: "transports-mobilite",
  intro: "TCF Compréhension orale · Palier A2–B1 (Écoute unique, 4 choix). Écoutez ces deux messages du quotidien.",
  title: "Annonces et échanges fonctionnels",
  docs: [
    {
      text: "Annonce en gare : Mesdames, messieurs, votre attention s'il vous plaît. En raison d'une intervention technique sur un aiguillage à hauteur de Mâcon, le train régional de dix-sept heures quarante-deux à destination de Chambéry partira exceptionnellement de la voie G au lieu de la voie C. Son départ est retardé de vingt minutes. Les voyageurs munis d'un billet avec correspondance à Ambérieu sont invités à se présenter dès maintenant auprès des agents en gilet rouge sur le parvis central.",
      zh: "车站广播：女士们、先生们请注意。由于马孔附近道岔正在进行技术抢修，原定17点42分开往尚贝里的区域列车将临时改由G站台发车，不再停靠C站台，发车时间推迟20分钟。持有在昂贝略中转车票的旅客，请立即前往中央广场寻找穿红背心的工作人员办理改签引导。",
    },
    {
      text: "Julie : Bonjour monsieur, je viens récupérer mon badge d'accès pour l'espace de travail partagé des Chartrons.\nRéceptionniste : Bonjour madame. Votre dossier est bien validé, mais depuis lundi, l'assurance responsabilité civile professionnelle doit être téléversée sur votre espace membre avant toute remise de carte magnétique.\nJulie : Ah mince, j'ai uniquement la version papier dans mon sac.\nRéceptionniste : Aucun souci, vous pouvez la scanner gratuitement sur la borne située à gauche de la cafétéria, puis revenir au comptoir.",
      zh: "朱莉：您好先生，我来领取沙尔特龙共享办公空间的门禁卡。\n前台：您好女士。您的申请材料已审核通过，但从本周一起，必须先在会员个人空间上传职业民事责任险证明，才能发放磁卡。\n朱莉：哎呀，我包里只有纸质版。\n前台：没关系，您可以用咖啡区左侧的自助终端免费扫描上传，然后再回到前台领卡。",
    },
  ],
  questions: [
    {
      doc: 0,
      q: "Que doivent faire les passagers ayant une correspondance à Ambérieu ?",
      options: [
        "Attendre l'arrivée d'un bus de remplacement devant la voie G",
        "S'adresser immédiatement au personnel identifiable sur le parvis",
        "Faire tamponner leur billet au guichet automatique du sous-sol",
        "Monter directement dans le train suivant sans changer de quai",
      ],
      answer: 1,
      evidence: "Les voyageurs munis d'un billet avec correspondance à Ambérieu sont invités à se présenter dès maintenant auprès des agents en gilet rouge sur le parvis central.",
      trapTypes: [
        "无中生有（未提代运大巴）",
        "同义改写（正确项）",
        "地点与方式编造",
        "与换站台通知矛盾",
      ],
      why: "广播明确请需在昂贝略中转的旅客立即去中央广场找穿红背心的工作人员（agents en gilet rouge），即B项。",
      pts: 1,
      difficulty: 2,
      skill: "detail",
    },
    {
      doc: 0,
      q: "Quel changement touche le train à destination de Chambéry ?",
      options: [
        "Il est définitivement supprimé à cause d'une grève régionale",
        "Il partira à l'heure prévue mais depuis une autre gare",
        "Il subit un changement de quai accompagné d'un léger retard",
        "Il effectuera un arrêt supplémentaire exceptionnel à Mâcon",
      ],
      answer: 2,
      evidence: "le train régional de dix-sept heures quarante-deux à destination de Chambéry partira exceptionnellement de la voie G au lieu de la voie C. Son départ est retardé de vingt minutes.",
      trapTypes: [
        "夸大后果（并非取消）",
        "时间与地点均错",
        "同义改写（正确项）",
        "张冠李戴（马孔是故障点而非加停站）",
      ],
      why: "列车由C道改至G道发车，且晚点20分钟，对应C项“更换站台并小幅延误”。",
      pts: 1,
      difficulty: 2,
      skill: "gist",
    },
    {
      doc: 1,
      q: "Pourquoi le réceptionniste ne remet-il pas immédiatement le badge à Julie ?",
      options: [
        "Sa cotisation mensuelle n'a pas encore été débitée par la banque",
        "Une pièce justificative numérique manque encore sur son profil en ligne",
        "Le stock de cartes magnétiques est temporairement épuisé depuis lundi",
        "Son inscription concerne un autre site du réseau de bureaux partagés",
      ],
      answer: 1,
      evidence: "depuis lundi, l'assurance responsabilité civile professionnelle doit être téléversée sur votre espace membre avant toute remise de carte magnétique.",
      trapTypes: [
        "无中生有（未提扣款失败）",
        "同义改写（正确项）",
        "偷换自周一以来的新规内容",
        "与档案已核验矛盾",
      ],
      why: "前台说明自周一起须先在线上传职业责任险电子证明才能领磁卡，因此缺少线上电子证明，选B。",
      pts: 1,
      difficulty: 3,
      skill: "detail",
    },
    {
      doc: 1,
      q: "Quelle solution le réceptionniste propose-t-il à Julie ?",
      options: [
        "Envoyer le document par courrier postal avant la fin de la semaine",
        "Demander un laissez-passer provisoire valable vingt-quatre heures",
        "Payer un supplément pour que l'accueil saisisse son contrat",
        "Numériser sur place son attestation papier grâce à un appareil en libre-service",
      ],
      answer: 3,
      evidence: "vous pouvez la scanner gratuitement sur la borne située à gauche de la cafétéria, puis revenir au comptoir.",
      trapTypes: [
        "方式错误（无需邮寄）",
        "无中生有（未提临时通行证）",
        "与gratuitement相反",
        "同义改写（正确项）",
      ],
      why: "前台建议她在咖啡区左侧的自助终端免费扫描纸质证明后再回柜台领卡，选D。",
      pts: 1,
      difficulty: 3,
      skill: "paraphrase",
    },
  ],
};

const TCF_CO_EX2: TrackCompExercise = {
  form: "long",
  topic: "travail",
  intro: "TCF Compréhension orale · Palier B2 (Écoute unique, 4 choix). Vous écoutez un entretien radio sur l'organisation du travail hybride.",
  title: "Les cadres de proximité face au travail hybride",
  docs: [
    {
      text: "Camille Laurent : Thomas Mercier, vous venez de diriger une enquête auprès de quarante entreprises françaises sur le télétravail. Trois ans après la signature des chartes hybrides, où se situe le principal point de friction ?\nThomas Mercier : Contrairement à ce qu'on lit souvent, ce ne sont ni les dirigeants ni les jeunes recrues qui souffrent le plus, mais bien les cadres intermédiaires. On leur demande de maintenir l'esprit d'équipe alors que leurs collaborateurs ne sont jamais présents les mêmes jours. Résultat : ils passent leurs journées en réunions de coordination à distance et repoussent leurs propres dossiers après dix-neuf heures.\nCamille Laurent : Certaines directions imposent pourtant deux jours fixes de présence commune par semaine. Est-ce efficace ?\nThomas Mercier : Seulement si ces journées servent réellement aux échanges informels et à l'entraide. Or, dans la moitié des cas observés, les salariés viennent au bureau pour s'isoler avec un casque devant des appels vidéo, faute de salles adaptées ou parce que leurs interlocuteurs travaillent depuis une autre ville.\nCamille Laurent : Que préconisez-vous alors pour éviter l'épuisement de ces responsables d'équipe ?\nThomas Mercier : D'abord, évaluer les managers sur la clarté des objectifs hebdomadaires plutôt que sur la surveillance horaire. Ensuite, instaurer des plages sans messagerie ni réunion d'au moins trois heures consécutives deux fois par semaine.",
      zh: "卡米耶·洛朗：托马·梅西耶，您刚完成一项针对40家法国企业远程办公状况的调查。混合办公章程签署三年后，主要摩擦点在哪里？\n托马·梅西耶：与常见说法相反，最受煎熬的既不是高管也不是新人，而是中层管理者。公司要求他们维系团队凝聚力，可下属到岗日期各不相同。结果他们整天都在开远程协调会，把自己的业务推迟到晚上7点以后处理。\n卡米耶·洛朗：但有些管理层强制规定每周固定两天全员到岗，这有效吗？\n托马·梅西耶：只有当这两天真正用于非正式交流与互助时才有效。然而在我们观察到的一半案例中，由于缺乏合适会议室或对接同事身处外地，员工赶到办公室却戴着耳机独自开视频会。\n卡米耶·洛朗：那您建议如何防止这些团队负责人职业倦怠？\n托马·梅西耶：首先，按每周目标清晰度而非工时监控来考核管理者；其次，每周至少设立两次连续三小时以上免消息、免会议的专注时段。",
    },
  ],
  questions: [
    {
      doc: 0,
      q: "D'après Thomas Mercier, quelle catégorie professionnelle subit la plus forte tension dans le modèle hybride ?",
      options: [
        "Les jeunes diplômés récemment intégrés dans les équipes",
        "Les responsables chargés d'encadrer directement les équipes au quotidien",
        "Les directeurs généraux confrontés aux coûts immobiliers",
        "Les techniciens informatiques assurant la maintenance à distance",
      ],
      answer: 1,
      evidence: "Contrairement à ce qu'on lit souvent, ce ne sont ni les dirigeants ni les jeunes recrues qui souffrent le plus, mais bien les cadres intermédiaires.",
      trapTypes: [
        "反向陷阱（明确排除jeunes recrues）",
        "同义改写（正确项）",
        "反向陷阱（明确排除dirigeants）",
        "无中生有",
      ],
      why: "受访社会学家明确排除高管与新员工，指出压力最大的是中层团队管理者（cadres intermédiaires），选B。",
      pts: 1,
      difficulty: 4,
      skill: "detail",
    },
    {
      doc: 0,
      q: "Pourquoi les cadres intermédiaires travaillent-ils souvent tard le soir selon l'enquête ?",
      options: [
        "Leurs journées sont absorbées par des réunions visant à synchroniser des équipes dispersées",
        "Ils doivent rédiger chaque soir un compte rendu individuel pour la direction",
        "Le décalage horaire avec les filiales étrangères impose des appels nocturnes",
        "Ils profitent volontairement du calme nocturne après avoir pris leur après-midi",
      ],
      answer: 0,
      evidence: "ils passent leurs journées en réunions de coordination à distance et repoussent leurs propres dossiers après dix-neuf heures.",
      trapTypes: [
        "同义改写（正确项）",
        "无中生有（未提每晚写个人汇报）",
        "过度推断（未提跨国时差）",
        "歪曲原意（并非主动下午休息）",
      ],
      why: "白天时间被协调分散团队的远程会议占满，只能把自身案头工作推到19点后，选A。",
      pts: 1,
      difficulty: 4,
      skill: "paraphrase",
    },
    {
      doc: 0,
      q: "Quel paradoxe le chercheur relève-t-il concernant les journées de présence obligatoire au bureau ?",
      options: [
        "Les locaux sont trop bruyants pour permettre le moindre échange convivial",
        "Les employés refusent catégoriquement de réserver leur poste à l'avance",
        "Nombre de salariés passent malgré tout ces journées en visioconférence solitaire",
        "Les transports saturés annulent tous les gains écologiques du télétravail",
      ],
      answer: 2,
      evidence: "dans la moitié des cas observés, les salariés viennent au bureau pour s'isoler avec un casque devant des appels vidéo",
      trapTypes: [
        "因果歪曲",
        "无中生有",
        "同义改写（正确项）",
        "话题偏离（未谈交通碳排）",
      ],
      why: "调查发现一半案例中员工虽到了办公室，却仍戴着耳机独自开视频会，失去了面对面协作的意义，选C。",
      pts: 1,
      difficulty: 5,
      skill: "inference",
    },
    {
      doc: 0,
      q: "Parmi les pistes avancées par Thomas Mercier, laquelle vise à protéger la concentration ?",
      options: [
        "Supprimer définitivement toutes les messageries instantanées internes",
        "Rémunérer en heures supplémentaires chaque courriel envoyé après dix-huit heures",
        "Réduire la semaine de travail à quatre jours pour l'encadrement",
        "Bloquer deux fois par semaine de longs créneaux affranchis de toute sollicitation",
      ],
      answer: 3,
      evidence: "instaurer des plages sans messagerie ni réunion d'au moins trois heures consécutives deux fois par semaine.",
      trapTypes: [
        "绝对化陷阱（并非永久取消即时通讯）",
        "无中生有",
        "无中生有",
        "同义改写（正确项）",
      ],
      why: "专家建议每周两次设立至少连续三小时无消息、无会议的免打扰时段，选D。",
      pts: 1,
      difficulty: 5,
      skill: "negation",
    },
  ],
};

const TCF_CO_EX3: TrackCompExercise = {
  form: "long",
  topic: "sciences-ethique",
  intro: "TCF Compréhension orale · Palier B2+/C1 (Écoute unique, 4 choix). Vous écoutez une chronique économique sur l'empreinte des centres de données.",
  title: "Centres de données et illusion de la sobriété",
  docs: [
    {
      text: "Nadia Benali : On célèbre volontiers les centres de données de nouvelle génération qui récupèrent la chaleur fatale de leurs serveurs pour chauffer les piscines municipales ou les réseaux urbains. Sur le papier, la promesse paraît irréprochable. Pourtant, à y regarder de près, cet argument écologique sert trop souvent de laisser-passer pour implanter des infrastructures surdimensionnées en périphérie des métropoles. Car le véritable angle mort des collectivités demeure l'effet rebond : chaque gain d'efficacité énergétique par calcul est aussitôt englouti par la multiplication exponentielle des modèles prédictifs et du stockage redondant. Autrement dit, chauffer un quartier l'hiver ne justifie guère de faire tourner à plein régime, en plein mois d'août, des milliers de processeurs énergivores qui sollicitent les nappes phréatiques pour leur refroidissement. Si les élus locaux veulent peser réellement, ils ne peuvent plus se contenter d'exiger un raccordement thermique ; ils doivent conditionner l'octroi du foncier à un plafonnement strict de la puissance électrique souscrite et à une transparence annuelle sur les volumes d'eau prélevés.",
      zh: "娜迪亚·贝纳利：人们乐于赞美新一代数据中心回收服务器余热来为市政泳池或城市供暖网供热。纸面上看，这一承诺似乎无可挑剔。然而细究起来，这种环保说辞往往成了在大都市外围兴建超大规模设施的通行证。因为地方政府真正的盲点在于“回弹效应”：单次算力能效的每一分提升，转瞬就被指数级膨胀的预测模型和冗余存储吞没。换言之，冬天为一个街区供暖，绝不足以证明八月酷暑时让成千上万高耗能处理器满负荷运转并抽取地下水冷却是合理的。地方民选官员若想真正发挥约束力，不能再满足于要求接入供热管网，而必须将批地与严格限制签约电力容量及每年公开取水量挂钩。",
    },
  ],
  questions: [
    {
      doc: 0,
      q: "Quelle réserve Nadia Benali formule-t-elle à l'égard de la récupération de chaleur des serveurs ?",
      options: [
        "Ce procédé technique est encore trop coûteux pour chauffer les équipements publics",
        "Elle sert fréquemment d'alibi vert pour faire accepter des installations démesurées",
        "La chaleur produite est insuffisante durant les vagues de froid hivernales",
        "Les habitants refusent d'être raccordés à des réseaux alimentés par le privé",
      ],
      answer: 1,
      evidence: "cet argument écologique sert trop souvent de laisser-passer pour implanter des infrastructures surdimensionnées en périphérie des métropoles.",
      trapTypes: [
        "无中生有（未称技术成本过高）",
        "同义改写（正确项）",
        "与原文重点无关",
        "无中生有（未提居民拒绝接入）",
      ],
      why: "评论员指出余热回收这一环保理由常沦为获准在城市外围建设超大规模数据中心的“绿色通行证/借口”，选B。",
      pts: 1,
      difficulty: 5,
      skill: "opinion",
    },
    {
      doc: 0,
      q: "Comment la chroniqueuse explique-t-elle le phénomène d'« effet rebond » dans le secteur numérique ?",
      options: [
        "Les économies unitaires d'énergie sont annulées par l'explosion globale des usages",
        "Les pannes estivales obligent à doubler les générateurs de secours au fioul",
        "Les entreprises délocalisent leurs serveurs dès que la fiscalité locale augmente",
        "Le recyclage des composants électroniques consomme plus d'eau que leur fabrication",
      ],
      answer: 0,
      evidence: "chaque gain d'efficacité énergétique par calcul est aussitôt englouti par la multiplication exponentielle des modèles prédictifs et du stockage redondant.",
      trapTypes: [
        "同义改写（正确项）",
        "无中生有（未提燃油备用发电机）",
        "话题偷换",
        "无中生有（未谈电子元件回收耗水）",
      ],
      why: "单次计算的能效提升立即被预测模型和冗余存储的指数级激增所吞噬，即单位节能被总量暴涨抵消，选A。",
      pts: 1,
      difficulty: 5,
      skill: "paraphrase",
    },
    {
      doc: 0,
      q: "Quel problème saisonnier met en évidence la limite écologique de ces infrastructures ?",
      options: [
        "La baisse de production solaire en hiver oblige à importer de l'électricité",
        "Les canalisations urbaines perdent l'essentiel de la chaleur transportée au printemps",
        "En été, la chaleur récupérée devient inutile tandis que le refroidissement puise dans l'eau souterraine",
        "Les pics d'achats en ligne de décembre saturent les réseaux électriques ruraux",
      ],
      answer: 2,
      evidence: "chauffer un quartier l'hiver ne justifie guère de faire tourner à plein régime, en plein mois d'août, des milliers de processeurs énergivores qui sollicitent les nappes phréatiques pour leur refroidissement.",
      trapTypes: [
        "无中生有",
        "无中生有",
        "隐含推断与同义改写（正确项）",
        "无中生有",
      ],
      why: "冬季供暖并不能合理化八月盛夏满负荷运转且抽取地下水降温的消耗，揭示了夏季余热无用却耗水巨大的矛盾，选C。",
      pts: 1,
      difficulty: 6,
      skill: "inference",
    },
    {
      doc: 0,
      q: "Que devraient exiger les collectivités locales avant d'accorder un terrain à un opérateur ?",
      options: [
        "La gratuité totale du chauffage fourni aux écoles et piscines voisines",
        "L'embauche prioritaire d'ingénieurs résidant dans l'agglomération",
        "Un plafond de consommation électrique et la publication des prélèvements hydriques",
        "Le transfert intégral des serveurs hors des zones périurbaines d'ici cinq ans",
      ],
      answer: 2,
      evidence: "ils doivent conditionner l'octroi du foncier à un plafonnement strict de la puissance électrique souscrite et à une transparence annuelle sur les volumes d'eau prélevés.",
      trapTypes: [
        "无中生有",
        "无中生有",
        "同义改写（正确项）",
        "歪曲立场（主张有条件批地而非五年内全部迁出）",
      ],
      why: "评论员主张把批地与严格设定电力容量上限及每年公开取水量挂钩，选C。",
      pts: 1,
      difficulty: 6,
      skill: "detail",
    },
  ],
};

export const TCF_CO_PAPER: TrackPaper = {
  id: "tcf-preset-co-1",
  track: "tcf",
  section: "co",
  kind: "listen",
  level: "B2",
  created: 1763800000000,
  src: "preset",
  style: "natural",
  titleZh: "TCF 听力理解阶梯套题（A2→C1 · 12 题单遍四选一）",
  badge: "FEI 100–699 · NCLC",
  durationMinutes: 20,
  exs: [TCF_CO_EX1, TCF_CO_EX2, TCF_CO_EX3],
};

/* ============================================================================
 * 2. TCF CE Suite — 12 progressive 4-option reading items across 3 exercises
 * ============================================================================ */

const TCF_CE_EX1: TrackCompExercise = {
  form: "short",
  topic: "logement-urbanisme",
  intro: "TCF Compréhension écrite · Palier A2–B1 (4 choix). Lisez ces deux documents pratiques.",
  title: "Avis municipal et note interne de mobilité",
  docs: [
    {
      text: "Mairie de Saint-malo — Avis aux résidents du secteur Intra-Muros.\nEn raison de la réfection des conduites d'eau potable rue de Dinan, la collecte en porte-à-porte des bacs jaunes est suspendue du 4 au 18 novembre inclus. Durant ces deux semaines, les habitants sont priés de déposer leurs emballages recyclables dans les conteneurs enterrés de la porte Saint-Vincent, accessibles vingt-quatre heures sur vingt-quatre sans carte d'accès. Le ramassage des ordures ménagères résiduelles du mardi soir est en revanche maintenu aux horaires habituels.",
      zh: "圣马洛市政府——致城墙内街区居民通知。\n因迪南街饮用水管道翻修，11月4日至18日（含）暂停黄桶上门清运。在此两周期间，请居民将可回收包装投入圣文森门地下收集箱，该收集箱全天24小时免卡开放。周二晚间的日常剩余生活垃圾清运则照常按原时间进行。",
    },
    {
      text: "Objet : Forfait mobilités durables — Campagne annuelle de remboursement.\nChers collègues, pour bénéficier cette année de la prime annuelle de quatre cents euros au titre du vélo ou du covoiturage régulier, votre déclaration sur l'honneur accompagnée du relevé d'itinéraires doit parvenir au service paie au plus tard le 15 décembre. Attention : cet avantage est cumulable avec la prise en charge partielle d'un abonnement de train régional, dans la limite globale de six cents euros par an, mais exclut toute place de stationnement automobile financée par l'employeur.",
      zh: "主题：可持续出行补贴——年度报销申报。\n各位同事，如需申领今年骑行或规律拼车的400欧元年度补贴，请最迟于12月15日前将诚信声明及行程记录提交薪酬部门。注意：该福利可与区域火车月票部分报销叠加（全年总额上限600欧元），但凡享受雇主资助汽车车位者均不得申领。",
    },
  ],
  questions: [
    {
      doc: 0,
      q: "Que modifie temporairement la mairie de Saint-Malo pendant les travaux ?",
      options: [
        "La distribution de l'eau potable est coupée chaque nuit dans tout le quartier",
        "Les habitants doivent apporter eux-mêmes leurs emballages recyclables à un point dédié",
        "Le ramassage du mardi soir pour les déchets ménagers est reporté au jeudi",
        "Un badge magnétique devient indispensable pour ouvrir les conteneurs enterrés",
      ],
      answer: 1,
      evidence: "Durant ces deux semaines, les habitants sont priés de déposer leurs emballages recyclables dans les conteneurs enterrés de la porte Saint-Vincent, accessibles vingt-quatre heures sur vingt-quatre sans carte d'accès.",
      trapTypes: [
        "过度推断（修水管未说每晚停水）",
        "同义改写（正确项）",
        "反向陷阱（周二清运照常维持）",
        "反向陷阱（原文明确sans carte d'accès）",
      ],
      why: "施工两周内黄桶暂停上门收集，居民需自行把可回收包装投放到圣文森门地下收集箱，选B。",
      pts: 1,
      difficulty: 2,
      skill: "detail",
    },
    {
      doc: 0,
      q: "Quelle prestation municipale reste inchangée entre le 4 et le 18 novembre ?",
      options: [
        "La tournée hebdomadaire consacrée aux déchets non recyclables du mardi soir",
        "La collecte à domicile des cartons et bouteilles en plastique",
        "Le stationnement gratuit le long de la rue de Dinan",
        "La permanence d'information des services techniques à la porte Saint-Vincent",
      ],
      answer: 0,
      evidence: "Le ramassage des ordures ménagères résiduelles du mardi soir est en revanche maintenu aux horaires habituels.",
      trapTypes: [
        "同义改写（正确项）",
        "反向陷阱（黄桶可回收物暂停上门）",
        "无中生有",
        "无中生有",
      ],
      why: "通知末句明确周二晚间日常剩余垃圾（ordures ménagères résiduelles）按原时间照常清运，选A。",
      pts: 1,
      difficulty: 2,
      skill: "negation",
    },
    {
      doc: 1,
      q: "Dans quel cas un salarié est-il privé du forfait mobilités durables ?",
      options: [
        "S'il possède déjà un abonnement mensuel à un train régional",
        "S'il alterne entre le vélo personnel et le covoiturage au cours du mois",
        "S'il dispose d'un emplacement de parking payé par son entreprise",
        "S'il transmet ses justificatifs au service paie début décembre",
      ],
      answer: 2,
      evidence: "cet avantage est cumulable avec la prise en charge partielle d'un abonnement de train régional, dans la limite globale de six cents euros par an, mais exclut toute place de stationnement automobile financée par l'employeur.",
      trapTypes: [
        "反向陷阱（可与区域火车票叠加）",
        "无中生有",
        "同义改写（正确项）",
        "时间误读（12月初早于12月15日截止日）",
      ],
      why: "通知明确排除任何由雇主出资提供汽车停车位的情形（exclut toute place de stationnement automobile financée par l'employeur），选C。",
      pts: 1,
      difficulty: 3,
      skill: "negation",
    },
    {
      doc: 1,
      q: "Que précise la note au sujet du cumul des aides de transport ?",
      options: [
        "Le cumul avec un abonnement ferroviaire est autorisé jusqu'à un plafond annuel fixé",
        "La prime de quatre cents euros s'ajoute intégralement sans aucune limite annuelle",
        "Seuls les salariés habitant à plus de trente kilomètres peuvent cumuler deux aides",
        "Le remboursement du train remplace automatiquement la prime vélo dès janvier",
      ],
      answer: 0,
      evidence: "cet avantage est cumulable avec la prise en charge partielle d'un abonnement de train régional, dans la limite globale de six cents euros par an",
      trapTypes: [
        "同义改写（正确项）",
        "与600欧元上限矛盾",
        "无中生有（未设30公里门槛）",
        "歪曲叠加规则",
      ],
      why: "可持续出行补贴可与区域火车月票补贴叠加，但全年合计上限为600欧元，选A。",
      pts: 1,
      difficulty: 3,
      skill: "detail",
    },
  ],
};

const TCF_CE_EX2: TrackCompExercise = {
  form: "long",
  topic: "consommation",
  intro: "TCF Compréhension écrite · Palier B2 (4 choix). Vous lisez un article d'enquête dans un magazine économique.",
  title: "Le retour tâtonnant de la consigne en grande surface",
  docs: [
    {
      text: "Depuis dix-huit mois, une soixantaine d'hypermarchés de l'Ouest français expérimentent le réemploi à grande échelle des bocaux de compote, soupes et boissons locales. Le principe paraît limpide : le client avance cinquante centimes par contenant en verre, qu'il récupère sous forme de bon d'achat en glissant le flacon vide dans un automate à l'entrée du magasin. Selon le bilan intermédiaire publié par l'agence régionale de l'environnement, le taux de retour atteint déjà soixante-huit pour cent dans les communes périurbaines équipées, mais plafonne à trente-neuf pour cent en hypercentre.\n\nCet écart géographique tient moins à la sensibilité écologique des citadins qu'à la logistique domestique : conserver chez soi une dizaine de bouteilles intactes sans les casser puis les transporter à pied ou en métro décourage rapidement les ménages sans voiture. Du côté des industriels, un autre obstacle freine la rentabilité du dispositif. Pendant des décennies, chaque marque a conçu une forme de bouteille singulière afin de se distinguer en rayon. Or, laver et redistribuer efficacement des millions d'emballages suppose au contraire d'adopter trois ou quatre formats standards partagés par l'ensemble de la filière.\n\nPlusieurs PME agroalimentaires craignent dès lors d'y perdre leur identité visuelle face aux marques de distributeurs, même si la mutualisation des centres de lavage situés à moins de cent kilomètres réduit déjà de moitié leur facture verrière face à la flambée du prix de l'énergie.",
      zh: "十八个月以来，法国西部约六十家大型超市正在大规模试点果泥罐、汤瓶和本地饮料瓶的重复使用。原理看似简单明了：顾客为每个玻璃容器预付50欧分押金，将空瓶投入门店入口的回收机即可领取代金券。据大区环保署发布的中期评估，配备设施的城郊市镇回收率已达68%，但在市中心却停滞在39%。\n\n这一地域差距与其说源于市民环保意识不同，不如说受制于家庭日常搬运条件：在家完好存放十来个空瓶不打碎，再步行或乘地铁拎回超市，很快就让无车家庭望而却步。在生产商一侧，另一重障碍制约着体系盈利。数十年来，各品牌为在货架上脱颖而出，纷纷设计独特的瓶型；然而高效清洗并循环调配数百万包装，恰恰要求全行业共用三四种标准瓶型。\n\n因此，多家中小食品企业担心在零售商自有品牌面前丧失视觉辨识度，尽管在能源价格飙升背景下，共享百公里以内的清洗中心已使其玻璃包装成本减半。",
    },
  ],
  questions: [
    {
      doc: 0,
      q: "Comment l'article explique-t-il le faible taux de retour des contenants en centre-ville ?",
      options: [
        "Les automates installés dans les petits commerces urbains tombent régulièrement en panne",
        "Les habitants des centres-villes sont moins sensibilisés au tri que les périurbains",
        "Les contraintes de stockage à domicile et de transport sans voiture freinent les usagers",
        "Le remboursement sous forme de bon d'achat est refusé par les caisses du centre-ville",
      ],
      answer: 2,
      evidence: "Cet écart géographique tient moins à la sensibilité écologique des citadins qu'à la logistique domestique : conserver chez soi une dizaine de bouteilles intactes sans les casser puis les transporter à pied ou en métro décourage rapidement les ménages sans voiture.",
      trapTypes: [
        "无中生有（未提机器常故障）",
        "反向陷阱（明确否定源于环保意识差异）",
        "同义改写（正确项）",
        "无中生有",
      ],
      why: "文章明确指出差距并非源于环保意识，而是家庭存放空瓶及步行/地铁搬运的不便劝退了无车家庭，选C。",
      pts: 1,
      difficulty: 4,
      skill: "paraphrase",
    },
    {
      doc: 0,
      q: "Quelle condition technique est indispensable pour rendre le lavage industriel viable ?",
      options: [
        "L'harmonisation des contenants autour d'un petit nombre de modèles communs",
        "L'ouverture d'une unité de lavage dédiée à l'intérieur de chaque supermarché",
        "Le remplacement progressif du verre épais par un plastique biodégradable",
        "L'augmentation de la consigne unitaire à deux euros par bouteille",
      ],
      answer: 0,
      evidence: "laver et redistribuer efficacement des millions d'emballages suppose au contraire d'adopter trois ou quatre formats standards partagés par l'ensemble de la filière.",
      trapTypes: [
        "同义改写（正确项）",
        "歪曲原文（是百公里内共享清洗中心而非每店自建）",
        "无中生有",
        "数字编造（押金为50欧分）",
      ],
      why: "高效清洗与再分配数百万包装的前提是全行业采用三四种共享的标准瓶型，选A。",
      pts: 1,
      difficulty: 4,
      skill: "detail",
    },
    {
      doc: 0,
      q: "Quelle réticence expriment certaines petites et moyennes entreprises agroalimentaires ?",
      options: [
        "Elles jugent les normes sanitaires de lavage impossibles à respecter pour les soupes",
        "Elles redoutent que l'uniformisation des flacons ne banalise l'image de leurs produits",
        "Elles estiment que le coût du verre neuf reste inférieur à celui du réemploi",
        "Elles reprochent à l'agence régionale de subventionner uniquement les multinationales",
      ],
      answer: 1,
      evidence: "Plusieurs PME agroalimentaires craignent dès lors d'y perdre leur identité visuelle face aux marques de distributeurs",
      trapTypes: [
        "无中生有",
        "同义改写（正确项）",
        "反向陷阱（末句指出包装成本已减半）",
        "无中生有",
      ],
      why: "中小食品企业担心统一标准瓶型后，在商超自有品牌面前丧失自身产品的视觉辨识度，选B。",
      pts: 1,
      difficulty: 5,
      skill: "opinion",
    },
    {
      doc: 0,
      q: "Quel avantage économique concret la mutualisation locale du lavage procure-t-elle déjà aux producteurs ?",
      options: [
        "Une exonération complète des taxes régionales sur la grande distribution",
        "Une hausse immédiate de soixante-huit pour cent de leurs ventes en rayon",
        "Une garantie d'exclusivité commerciale dans soixante hypermarchés de l'Ouest",
        "Un allègement de cinquante pour cent de leurs dépenses liées aux emballages en verre",
      ],
      answer: 3,
      evidence: "la mutualisation des centres de lavage situés à moins de cent kilomètres réduit déjà de moitié leur facture verrière face à la flambée du prix de l'énergie.",
      trapTypes: [
        "无中生有",
        "张冠李戴（68%是城郊回收率而非销量增长）",
        "歪曲60家试点超市含义",
        "同义改写（正确项）",
      ],
      why: "共享百公里内清洗中心已将其玻璃包装账单削减一半（réduit déjà de moitié leur facture verrière），选D。",
      pts: 1,
      difficulty: 5,
      skill: "detail",
    },
  ],
};

const TCF_CE_EX3: TrackCompExercise = {
  form: "long",
  topic: "politique-justice",
  intro: "TCF Compréhension écrite · Palier C1 (4 choix). Vous lisez une tribune publiée dans une revue d'urbanisme.",
  title: "L'urbanisme prédictif ou la tentation du pilotage sans débat",
  docs: [
    {
      text: "Il ne se passe plus un salon des maires sans qu'un prestataire ne vante son « jumeau numérique » capable d'anticiper l'engorgement d'un carrefour, le remplissage des corbeilles publiques ou la fraîcheur d'un îlot arboré. Que l'outil informatique éclaire la gestion courante de la voirie, nul ne songerait sérieusement à s'en plaindre. Le glissement commence lorsque la modélisation prétend se substituer à l'arbitrage politique en parant d'une neutralité mathématique des choix qui demeurent profondément distributifs.\n\nOptimiser un flux automobile à l'échelle d'une rocade peut fort bien aggraver le bruit sous les fenêtres d'un quartier populaire ; maximiser la rotation du stationnement marchand favorise le chaland pressé au détriment du riverain âgé. Or, les tableaux de bord livrés clés en main aux municipalités ne rendent visibles que ce qui se prête aisément à la mesure instantanée, reléguant hors champ l'hospitalité d'une place, la flânerie non marchande ou l'entraide de voisinage.\n\nPlus préoccupant encore, la dépendance contractuelle envers des logiciels propriétaires finit par déposséder les services techniques municipaux de leur propre expertise territoriale. À force de déléguer le diagnostic à des boîtes noires dont les paramètres restent couverts par le secret industriel, l'élu risque de ne plus délibérer sur ce que la ville doit devenir, mais d'entériner docilement ce que le capteur sait compter.",
      zh: "如今每逢市长展会，总有供应商吹嘘其“数字孪生”系统能预判路口拥堵、公共垃圾桶满溢或绿荫街岛降温效果。让信息化工具辅助日常市政道路管理，固然无人会认真反对。真正的滑坡始于建模系统披着数学中立的外衣，企图取代政治权衡，而这些抉择本质上始终关乎利益分配。\n\n在环城路尺度上优化车流，完全可能加剧平民街区窗下的噪音；最大化商业车位周转率，讨好了匆忙购物的顾客，却牺牲了年长街坊的便利。然而，交付给市政厅的一站式数据看板只呈现便于即时量化的指标，却将广场的亲和力、非商业性的闲庭信步或邻里互助统统排斥在视野之外。\n\n更令人忧虑的是，对专有商业软件的合同依赖最终会剥夺市政技术部门自身的属地专业判断力。一旦长期把诊断权让渡给参数受商业机密保护的黑箱，民选官员恐将不再就城市应当成为什么样展开思辨，而是顺从地追认传感器所能计数的结果。",
    },
  ],
  questions: [
    {
      doc: 0,
      q: "Quelle est la thèse centrale défendue par l'auteur de cette tribune ?",
      options: [
        "Les capteurs urbains tombent trop souvent en panne pour guider utilement la voirie",
        "La gestion algorithmique déguise en évidence technique des arbitrages qui restent politiques",
        "Les petites communes devraient mutualiser leurs budgets pour acquérir des jumeaux numériques",
        "La protection des données personnelles interdit toute mesure des flux de circulation",
      ],
      answer: 1,
      evidence: "Le glissement commence lorsque la modélisation prétend se substituer à l'arbitrage politique en parant d'une neutralité mathématique des choix qui demeurent profondément distributifs.",
      trapTypes: [
        "无中生有（首段承认日常市政辅助有用）",
        "核心立场同义改写（正确项）",
        "与作者批判立场相反",
        "偷换议题（未谈个人隐私法规禁令）",
      ],
      why: "作者肯定日常技术辅助，但批判建模系统用“数学中立”掩盖实质上涉及利益分配的政治抉择，选B。",
      pts: 1,
      difficulty: 5,
      skill: "gist",
    },
    {
      doc: 0,
      q: "Pourquoi l'auteur évoque-t-il la flânerie ou l'entraide entre voisins au deuxième paragraphe ?",
      options: [
        "Pour illustrer des dimensions essentielles de la vie urbaine qu'échappent aux indicateurs chiffrés",
        "Pour prouver que les centres-villes piétonniers génèrent davantage de recettes fiscales",
        "Pour déplorer le manque de civisme des automobilistes dans les quartiers populaires",
        "Pour inviter les ingénieurs à concevoir des capteurs capables d'évaluer la convivialité",
      ],
      answer: 0,
      evidence: "les tableaux de bord livrés clés en main aux municipalités ne rendent visibles que ce qui se prête aisément à la mesure instantanée, reléguant hors champ l'hospitalité d'une place, la flânerie non marchande ou l'entraide de voisinage.",
      trapTypes: [
        "同义改写（正确项）",
        "与non marchande相反",
        "张冠李戴",
        "曲解修辞意图（作者批判唯量化论而非呼吁装更多传感器）",
      ],
      why: "作者列举闲逛、邻里互助等非功利城市体验，是为了揭示数据看板只看可即时量化指标、遮蔽深层城市价值的局限，选A。",
      pts: 1,
      difficulty: 6,
      skill: "inference",
    },
    {
      doc: 0,
      q: "Quel risque institutionnel fait courir le recours prolongé à des logiciels privés fermés ?",
      options: [
        "Une hausse brutale de la fiscalité locale dès la première année d'abonnement",
        "Une divulgation accidentelle des plans d'urbanisme à des entreprises concurrentes",
        "Un affaiblissement du savoir-faire interne des administrations municipales",
        "Une multiplication des recours juridiques déposés par les commerçants du centre",
      ],
      answer: 2,
      evidence: "la dépendance contractuelle envers des logiciels propriétaires finit par déposséder les services techniques municipaux de leur propre expertise territoriale.",
      trapTypes: [
        "无中生有",
        "偷换secret industriel概念",
        "同义改写（正确项）",
        "无中生有",
      ],
      why: "对专有软件的长期合同依赖会使市政技术部门丧失自身的本土专业判断力（déposséder… de leur propre expertise territoriale），选C。",
      pts: 1,
      difficulty: 6,
      skill: "paraphrase",
    },
    {
      doc: 0,
      q: "Que suggère la formule finale opposant « délibérer » et « entériner docilement » ?",
      options: [
        "Les élus gagnent un temps précieux en validant sans délai les rapports automatisés",
        "Les citoyens préfèrent désormais voter en ligne plutôt qu'assister aux conseils municipaux",
        "Les services techniques refusent d'appliquer les consignes votées par le conseil municipal",
        "La démocratie locale s'atrophie quand l'outil de mesure dicte implicitement les priorités",
      ],
      answer: 3,
      evidence: "À force de déléguer le diagnostic à des boîtes noires dont les paramètres restent couverts par le secret industriel, l'élu risque de ne plus délibérer sur ce que la ville doit devenir, mais d'entériner docilement ce que le capteur sait compter.",
      trapTypes: [
        "反讽误读为赞同",
        "无中生有",
        "主语张冠李戴",
        "隐含推断（正确项）",
      ],
      why: "尾句通过“思辨城市未来”与“顺从追认传感器计数”的对比，警示技术黑箱反客为主将掏空地方民主决策，选D。",
      pts: 1,
      difficulty: 6,
      skill: "opinion",
    },
  ],
};

export const TCF_CE_PAPER: TrackPaper = {
  id: "tcf-preset-ce-1",
  track: "tcf",
  section: "ce",
  kind: "read",
  level: "B2",
  created: 1763800100000,
  src: "preset",
  titleZh: "TCF 阅读理解阶梯套题（A2→C1 · 12 题四选一）",
  badge: "FEI 100–699 · NCLC",
  durationMinutes: 25,
  exs: [TCF_CE_EX1, TCF_CE_EX2, TCF_CE_EX3],
};

/* ============================================================================
 * 3. TEF Post-Dec-2023 CO Suite — 12 single-play 4-option items across 4 genres
 *    (Voicemails · Public/Radio Announcements · Micro-trottoir · Analytical Interview)
 * ============================================================================ */

const TEF_CO_EX1: TrackCompExercise = {
  form: "short",
  topic: "societe",
  intro: "TEF Compréhension orale (format post-déc. 2023) · Section A : Messages sur répondeur téléphonique (écoute unique).",
  title: "Section A · Messages vocaux du quotidien",
  docs: [
    {
      text: "Message 1 : Bonjour monsieur Renaud, ici l'entreprise Thermi-Services. Notre chauffagiste devait passer chez vous jeudi matin pour l'entretien annuel de la chaudière. Suite à une urgence dans une école maternelle, nous devons décaler ce rendez-vous à vendredi entre treize heures trente et quinze heures. Si ce créneau ne vous convient pas, rappelez notre secrétariat avant ce soir dix-huit heures, sinon votre créneau sera confirmé automatiquement.",
      zh: "留言1：雷诺先生您好，这里是Thermi-Services供暖公司。我们的技师原定周四上午登门做锅炉年度保养。因一所幼儿园突发紧急抢修，我们需将预约改至周五13点30分至15点之间。若该时段不便，请于今晚18点前回电秘书处，否则系统将自动确认该时段。",
    },
    {
      text: "Message 2 : Salut Léa, c'est Farid du service des stages de l'université. J'ai bien reçu ta convention signée par le cabinet d'architecture de Lyon, mais le tampon de ton enseignant référent manque à la page trois. Sans cette validation pédagogique d'ici mercredi midi, le doyen ne pourra pas autoriser ton départ lundi prochain. Passe à mon bureau demain matin avec l'exemplaire original.",
      zh: "留言2：嗨蕾雅，我是大学实习办公室的法里德。我已收到里昂建筑事务所签字的实习三方协议，但第三页缺少你指导教师的签章。如果周三中午之前没有这项教学审批，院长将无法批准你下周一出发。明天上午请带原件来我办公室一趟。",
    },
    {
      text: "Message 3 : Bonjour madame Garnier, médiathèque Jean-Moulin à l'appareil. Le roman que vous aviez réservé vient de nous être rapporté. Nous le mettons de côté à l'accueil jusqu'à samedi dix-sept heures. Profitez-en pour apporter un justificatif de domicile récent, car votre abonnement annuel arrive à échéance à la fin du mois et le tarif résident nécessite une mise à jour.",
      zh: "留言3：加尼耶女士您好，这里是让·穆兰多媒体图书馆。您预约的小说刚刚归还，我们将在前台为您保留至周六17点。来取书时请顺便带一份近期住址证明，因为您的年度借阅证月底到期，续享本地居民优惠价需要更新住址材料。",
    },
  ],
  questions: [
    {
      doc: 0,
      q: "Que se passera-t-il si monsieur Renaud ne rappelle pas l'entreprise avant dix-huit heures ?",
      options: [
        "Sa visite d'entretien sera reportée au mois suivant avec des frais",
        "Le passage du technicien le vendredi après-midi sera considéré comme accepté",
        "Le chauffagiste se présentera malgré tout le jeudi matin à la première heure",
        "Son contrat de maintenance annuel sera suspendu par le secrétariat",
      ],
      answer: 1,
      evidence: "Si ce créneau ne vous convient pas, rappelez notre secrétariat avant ce soir dix-huit heures, sinon votre créneau sera confirmé automatiquement.",
      trapTypes: [
        "无中生有（未提推迟至下月及收费）",
        "同义改写（正确项）",
        "与改期原因矛盾",
        "夸大后果",
      ],
      why: "留言明确说明若18点前不回电调整，周五下午的新时段将自动确认，选B。",
      pts: 1,
      difficulty: 2,
      skill: "detail",
    },
    {
      doc: 1,
      q: "Pour quelle raison Farid contacte-t-il Léa en urgence ?",
      options: [
        "L'entreprise d'accueil à Lyon a finalement annulé son offre de stage",
        "Les dates du stage dépassent la durée légale autorisée par l'université",
        "Il manque le visa d'un professeur responsable sur son dossier papier",
        "Elle a oublié de joindre son attestation de sécurité sociale étudiante",
      ],
      answer: 2,
      evidence: "le tampon de ton enseignant référent manque à la page trois. Sans cette validation pédagogique d'ici mercredi midi, le doyen ne pourra pas autoriser ton départ lundi prochain.",
      trapTypes: [
        "反向陷阱（建筑事务所已签字）",
        "无中生有",
        "同义改写（正确项）",
        "偷换缺失材料名称",
      ],
      why: "协议第三页缺少指导教师签章（tampon de ton enseignant référent），需补齐教学审批，选C。",
      pts: 1,
      difficulty: 3,
      skill: "detail",
    },
    {
      doc: 2,
      q: "Pourquoi la bibliothécaire demande-t-elle un justificatif de domicile à madame Garnier ?",
      options: [
        "Pour lui expédier directement à domicile l'ouvrage qu'elle avait commandé",
        "Pour annuler une pénalité de retard enregistrée à une ancienne adresse",
        "Pour l'inscrire au club de lecture réservé aux nouveaux arrivants",
        "Pour renouveler prochainement sa carte au tarif préférentiel des habitants",
      ],
      answer: 3,
      evidence: "votre abonnement annuel arrive à échéance à la fin du mois et le tarif résident nécessite une mise à jour.",
      trapTypes: [
        "无中生有（需到前台自取）",
        "无中生有",
        "无中生有",
        "同义改写（正确项）",
      ],
      why: "她的年度借书证月底到期，继续享受居民优惠价需更新近期住址证明，选D。",
      pts: 1,
      difficulty: 3,
      skill: "paraphrase",
    },
  ],
};

const TEF_CO_EX2: TrackCompExercise = {
  form: "short",
  topic: "environnement",
  intro: "TEF Compréhension orale · Section B : Annonces publiques et flashs radio (écoute unique).",
  title: "Section B · Annonces publiques et alertes radio",
  docs: [
    {
      text: "Annonce aéroportuaire : Dernier appel pour les passagers du vol AF 7420 à destination de Bordeaux. En raison du brouillard persistant sur la piste sud, l'embarquement s'effectue désormais par navette depuis la porte B14 au niveau inférieur. Les bagages cabines rigides excédant quarante centimètres seront placés gratuitement en soute au pied de l'appareil.",
      zh: "机场广播：乘坐AF 7420次航班前往波尔多的旅客请注意末次登机广播。因南跑道大雾持续，登机现改在下层B14登机口乘摆渡车进行。超过40厘米的硬壳登机箱将在机坪登机梯旁免费托运入舱。",
    },
    {
      text: "Flash info montagne : La préfecture de Haute-Savoie maintient jusqu'à demain midi l'interdiction d'emprunter les sentiers pédestres situés au-dessus de deux mille cent mètres dans le massif des Aravis, suite aux fortes pluies qui ont fragilisé plusieurs passerelles en bois. Les refuges de moyenne altitude restent toutefois ouverts et joignables par téléphone satellite.",
      zh: "山地快讯：因强降雨导致多处木栈桥受损松动，上萨瓦省省政府维持禁令至明日中午，禁止通行阿拉维山脉海拔2100米以上的徒步山径。但中低海拔山屋仍正常开放，并可通过卫星电话联系。",
    },
    {
      text: "Chronique consommation : Attention au démarchage abusif sur l'isolation thermique. Aucun organisme ministériel ne téléphone jamais aux particuliers pour imposer un audit énergétique immédiat sous peine d'amende. Avant de signer le moindre devis, vérifiez systématiquement le label de l'artisan sur l'annuaire public France Rénov' et respectez le délai légal de réflexion de quatorze jours.",
      zh: "消费广播提醒：警惕外墙保温欺诈推销。任何政府部委机构都绝不会致电个人强制要求立即做能效审计并以罚款相威胁。签署任何报价单前，请务必在France Rénov'公共名录核实施工方资质，并严格保留14天法定冷静期。",
    },
  ],
  questions: [
    {
      doc: 0,
      q: "Qu'annonce la compagnie aérienne au sujet des valises cabines rigides les plus volumineuses ?",
      options: [
        "Elles sont refusées à l'embarquement à cause du changement d'avion",
        "Elles seront enregistrées en soute sans frais supplémentaires avant de monter à bord",
        "Leurs propriétaires doivent acquitter une taxe au comptoir de la porte B14",
        "Elles peuvent être conservées sous le siège si le passager voyage sans sac à main",
      ],
      answer: 1,
      evidence: "Les bagages cabines rigides excédant quarante centimètres seront placés gratuitement en soute au pied de l'appareil.",
      trapTypes: [
        "夸大限制（并非拒载）",
        "同义改写（正确项）",
        "与gratuitement相反",
        "无中生有",
      ],
      why: "超过40厘米的硬壳随身箱将在登机梯下免费转入货舱托运，选B。",
      pts: 1,
      difficulty: 3,
      skill: "detail",
    },
    {
      doc: 1,
      q: "Quelle mesure la préfecture de Haute-Savoie a-t-elle prise ?",
      options: [
        "Elle a ordonné la fermeture complète de tous les refuges du massif",
        "Elle a coupé les communications téléphoniques dans les vallées alpines",
        "Elle a suspendu l'accès aux chemins de randonnée de haute altitude",
        "Elle a rendu obligatoire l'accompagnement par un guide professionnel partout",
      ],
      answer: 2,
      evidence: "La préfecture de Haute-Savoie maintient jusqu'à demain midi l'interdiction d'emprunter les sentiers pédestres situés au-dessus de deux mille cent mètres dans le massif des Aravis",
      trapTypes: [
        "反向陷阱（中海拔山屋仍开放）",
        "歪曲卫星电话信息",
        "同义改写（正确项）",
        "无中生有",
      ],
      why: "省政府禁止通行2100米以上的高海拔徒步山径，选C。",
      pts: 1,
      difficulty: 4,
      skill: "gist",
    },
    {
      doc: 2,
      q: "Quel indice permet de repérer immédiatement une fraude téléphonique à la rénovation ?",
      options: [
        "L'interlocuteur prétend agir au nom de l'État en menaçant d'une sanction financière",
        "L'entreprise propose un délai de réflexion supérieur à deux semaines",
        "L'artisan figure déjà dans l'annuaire officiel France Rénov'",
        "Le devis mentionne des travaux d'isolation extérieure sur deux étages",
      ],
      answer: 0,
      evidence: "Aucun organisme ministériel ne téléphone jamais aux particuliers pour imposer un audit énergétique immédiat sous peine d'amende.",
      trapTypes: [
        "逆向推理正确项（正确项）",
        "与正规14天冷静期混淆",
        "反向陷阱（官方名录是防骗核验渠道）",
        "无中生有",
      ],
      why: "广播指出政府机构绝不会打电话强迫立即做能效审计并威胁罚款，凡如此声称者即为诈骗，选A。",
      pts: 1,
      difficulty: 4,
      skill: "inference",
    },
  ],
};

const TEF_CO_EX3: TrackCompExercise = {
  form: "long",
  topic: "economie-finances",
  intro: "TEF Compréhension orale · Section C : Micro-trottoir (écoute unique). Trois passants réagissent à la multiplication des commerces « zéro espèces ».",
  title: "Section C · Micro-trottoir : Faut-il accepter les boutiques sans argent liquide ?",
  docs: [
    {
      text: "Journaliste : De plus en plus de boulangeries et de cafés affichent « paiement par carte uniquement ». Qu'en pensez-vous ?\nKarim : En tant que gérant d'un salon de thé, je comprends parfaitement mes confrères. Compter la caisse le soir, transporter les rouleaux de monnaie à la banque et craindre les braquages, c'est une charge mentale énorme. Cela dit, refuser un billet de cinq euros est illégal en France, donc personnellement je garde un petit fond de caisse pour dépanner.\nMartine : Moi, ça me révolte ! Ce n'est pas seulement une question de personnes âgées peu à l'aise avec le sans-contact. Quand je retire soixante euros le lundi pour mon marché, je vois concrètement ce qu'il me reste le vendredi. Avec le paiement dématérialisé permanent, on anesthésie la perception des petites dépenses quotidiennes.\nSébastien : Sur le plan pratique, je paie tout avec ma montre depuis deux ans et je gagne un temps fou à la pause déjeuner. Mais ce qui m'inquiète, c'est qu'en cas de panne réseau ou de blocage bancaire, plus personne ne peut acheter une simple baguette, sans parler du traçage intégral de nos habitudes.",
      zh: "记者：越来越多面包店和咖啡馆贴出“仅限刷卡支付”。您怎么看？\n卡里姆：作为茶室经营者，我完全理解同行。晚上盘点现金、往银行运硬币卷、提防抢劫，心理负担极大。话虽如此，在法国拒收5欧元纸币是违法的，所以我个人仍保留少量备用零钱应急。\n玛蒂娜：这让我很气愤！这不只是不太习惯非接触支付的老年人的问题。我周一取60欧元买菜，周五还剩多少一目了然；一旦变成全天候无现金支付，人们对日常小额开销的痛感就被麻痹了。\n塞巴斯蒂安：从便利角度讲，我两年来全靠手表支付，午休省下大量排队时间。但我担心一旦遇到网络瘫痪或银行卡冻结，谁都买不了一根法棍，更别提我们的消费习惯会被全程追踪。",
    },
  ],
  questions: [
    {
      doc: 0,
      q: "Quelle est la pratique adoptée par Karim dans son propre commerce ?",
      options: [
        "Il refuse désormais toute pièce ou billet afin d'éviter les vols en soirée",
        "Il applique une majoration de cinquante centimes sur les paiements par carte",
        "Il continue d'accepter les espèces par respect de la loi malgré sa sympathie pour le sans-espèces",
        "Il réserve l'usage des espèces aux achats dépassant vingt euros",
      ],
      answer: 2,
      evidence: "Cela dit, refuser un billet de cinq euros est illégal en France, donc personnellement je garde un petit fond de caisse pour dépanner.",
      trapTypes: [
        "张冠李戴（他理解同行但自己并未拒收现金）",
        "无中生有",
        "同义改写（正确项）",
        "数字与规则编造",
      ],
      why: "卡里姆虽理解同行的苦衷，但因法国法律禁止拒收现金，自己仍保留备用零钱收现，选C。",
      pts: 1,
      difficulty: 4,
      skill: "opinion",
    },
    {
      doc: 0,
      q: "Quel reproche principal Martine adresse-t-elle au paiement dématérialisé ?",
      options: [
        "Il fait perdre aux consommateurs la conscience réelle du rythme de leurs dépenses",
        "Il exclut exclusivement les retraités qui n'ont pas de téléphone multifonction",
        "Il oblige les banques à augmenter les frais de tenue de compte mensuels",
        "Il ralentit les files d'attente sur les marchés de plein air le week-end",
      ],
      answer: 0,
      evidence: "Avec le paiement dématérialisé permanent, on anesthésie la perception des petites dépenses quotidiennes.",
      trapTypes: [
        "同义改写（正确项）",
        "反向陷阱（明确说ce n'est pas seulement une question de personnes âgées）",
        "无中生有",
        "无中生有",
      ],
      why: "玛蒂娜指出无现金支付会麻痹人们对日常零碎支出的直观感知，不利于控制预算，选A。",
      pts: 1,
      difficulty: 4,
      skill: "paraphrase",
    },
    {
      doc: 0,
      q: "Quelle position nuancée exprime Sébastien ?",
      options: [
        "Il a renoncé au paiement mobile après avoir été victime d'un piratage",
        "Il apprécie la rapidité de l'outil tout en redoutant la vulnérabilité technique et la surveillance",
        "Il souhaite que l'État impose aux banques une monnaie numérique anonyme",
        "Il estime que les pannes informatiques restent trop rares pour justifier le maintien des billets",
      ],
      answer: 1,
      evidence: "je paie tout avec ma montre depuis deux ans et je gagne un temps fou à la pause déjeuner. Mais ce qui m'inquiète, c'est qu'en cas de panne réseau ou de blocage bancaire, plus personne ne peut acheter une simple baguette, sans parler du traçage intégral de nos habitudes.",
      trapTypes: [
        "与仍用手表支付矛盾",
        "同义改写（正确项）",
        "无中生有",
        "反向陷阱（他恰恰担忧断网风险）",
      ],
      why: "塞巴斯蒂安既肯定手表支付省时高效，又担忧网络故障断供与消费隐私追踪，选B。",
      pts: 1,
      difficulty: 5,
      skill: "opinion",
    },
  ],
};

const TEF_CO_EX4: TrackCompExercise = {
  form: "long",
  topic: "sante",
  intro: "TEF Compréhension orale · Section D : Entretien analytique (écoute unique). Vous écoutez la chercheuse en santé publique Hélène Courtois.",
  title: "Section D · Déserts médicaux : au-delà de la coercition",
  docs: [
    {
      text: "Animateur : Docteure Hélène Courtois, faut-il restreindre la liberté d'installation des jeunes médecins pour résorber les déserts médicaux ruraux ?\nHélène Courtois : La mesure paraît séduisante politiquement, mais elle se heurte à une réalité démographique implacable : aujourd'hui, la pénurie touche près de quatre-vingts pour cent du territoire, y compris la grande couronne parisienne. Tant que le nombre global de praticiens formés stagnera d'ici 2030, flécher autoritairement les jeunes diplômés reviendrait surtout à déshabiller une banlieue sous-dotée pour habiller un canton rural, au risque de pousser une fraction d'entre eux vers l'exercice salarié non clinique ou la médecine esthétique.\nAnimateur : Faut-il alors se résigner aux cabines de téléconsultation dans les mairies ?\nHélène Courtois : Surtout pas comme substitut durable ! La télémédecine dépanne pour un renouvellement d'ordonnance, mais elle laisse de côté l'examen clinique des patients âgés polypathologiques. Ce qui fonctionne réellement sur le terrain, ce sont les maisons de santé pluriprofessionnelles où la commune salarie un secrétariat partagé et délègue certains actes de suivi aux infirmiers en pratique avancée, libérant ainsi près d'un tiers du temps médical.",
      zh: "主持人：埃莱娜·库尔图瓦博士，是否应当限制青年医生的自由执业选址权，以消除农村医疗荒漠？\n埃莱娜·库尔图瓦：这项举措在政治上看似诱人，却撞上了冷酷的人口现实：如今全国近80%的地区都面临医生短缺，连大巴黎远郊也不例外。只要2030年前培养出的执业医生总数停滞不前，行政强制分流年轻毕业生无异于拆医疗匮乏郊区的东墙补农村县乡的西墙，甚至可能把一部分人推向非临床受薪岗位或医美行业。\n主持人：那只能无奈接受在市政厅装远程问诊舱吗？\n埃莱娜·库尔图瓦：绝不能把它当长期替代品！远程医疗在续开处方时能应急，却无法为身患多种慢性病的高龄患者做体格检查。真正行之有效的是多专业联合健康中心：由市镇雇佣共享行政秘书，并将部分慢病随访工作授权给高阶执业护士，从而释放近三分之一的医生诊疗时间。",
    },
  ],
  questions: [
    {
      doc: 0,
      q: "Pourquoi Hélène Courtois juge-t-elle contre-productive une obligation stricte d'installation ?",
      options: [
        "Les zones côtières concentrent à elles seules la quasi-totalité des médecins généralistes",
        "En situation de manque quasi généralisé, elle déplacerait la pénurie tout en provoquant des fuites hors du soin courant",
        "La Constitution interdit formellement aux communes d'accueillir de nouveaux cabinets",
        "Le nombre de diplômés augmentera fortement dès l'an prochain grâce à la réforme universitaire",
      ],
      answer: 1,
      evidence: "flécher autoritairement les jeunes diplômés reviendrait surtout à déshabiller une banlieue sous-dotée pour habiller un canton rural, au risque de pousser une fraction d'entre eux vers l'exercice salarié non clinique ou la médecine esthétique.",
      trapTypes: [
        "歪曲80%缺医地域事实",
        "同义改写（正确项）",
        "无中生有",
        "时间与趋势相反（2030年前仍停滞）",
      ],
      why: "在普遍缺医背景下，强制分流只会拆东墙补西墙，还可能迫使部分医生转投非临床岗位或医美，选B。",
      pts: 1,
      difficulty: 5,
      skill: "inference",
    },
    {
      doc: 0,
      q: "Quel regard la chercheuse porte-t-elle sur les cabines de téléconsultation ?",
      options: [
        "Elles constituent la solution d'avenir idéale pour suivre les personnes très âgées",
        "Elles devraient être interdites car elles favorisent la surconsommation de médicaments",
        "Elles rendent service ponctuellement mais demeurent inadaptées aux diagnostics complexes nécessitant d'ausculter",
        "Elles libèrent à elles seules un tiers du temps de travail des médecins ruraux",
      ],
      answer: 2,
      evidence: "La télémédecine dépanne pour un renouvellement d'ordonnance, mais elle laisse de côté l'examen clinique des patients âgés polypathologiques.",
      trapTypes: [
        "反向陷阱（恰恰不适合多病高龄老人查体）",
        "极端化无中生有",
        "同义改写（正确项）",
        "张冠李戴（释放三分之一时间的是多专业健康中心）",
      ],
      why: "远程问诊仅能应急续方，无法替代对多病老年患者的临床体格检查，选C。",
      pts: 1,
      difficulty: 6,
      skill: "opinion",
    },
    {
      doc: 0,
      q: "Quel levier organisationnel permet concrètement de dégager du temps médical selon l'invitée ?",
      options: [
        "La prise en charge administrative mutualisée alliée au partage d'actes avec des infirmiers qualifiés",
        "Le raccourcissement réglementaire de chaque consultation à dix minutes maximum",
        "Le remplacement des généralistes libéraux par des internes en dernière année",
        "La fusion obligatoire de tous les hôpitaux départementaux dans un rayon de cinquante kilomètres",
      ],
      answer: 0,
      evidence: "ce sont les maisons de santé pluriprofessionnelles où la commune salarie un secrétariat partagé et délègue certains actes de suivi aux infirmiers en pratique avancée, libérant ainsi près d'un tiers du temps médical.",
      trapTypes: [
        "同义改写（正确项）",
        "无中生有",
        "无中生有",
        "无中生有",
      ],
      why: "由市镇提供共享秘书并向高阶执业护士下放部分随访工作，可释放近三分之一的医生时间，选A。",
      pts: 1,
      difficulty: 6,
      skill: "detail",
    },
  ],
};

export const TEF_CO_PAPER: TrackPaper = {
  id: "tef-preset-co-1",
  track: "tef",
  section: "co",
  kind: "listen",
  level: "B2",
  created: 1763800200000,
  src: "preset",
  style: "natural",
  titleZh: "TEF 2023.12 新政听力套题（留言·广播·街访·访谈 · 12 题单遍四选一）",
  badge: "CCI 0–699 · NCLC",
  durationMinutes: 20,
  exs: [TEF_CO_EX1, TEF_CO_EX2, TEF_CO_EX3, TEF_CO_EX4],
};

/* ============================================================================
 * 4. TEF Post-Dec-2023 CE Suite — 15 items across all 5 official task types
 *    ① Documents du quotidien · ② Phrases lacunaires · ③ Lecture rapide multi-annonces
 *    ④ Article de presse · ⑤ Équivalence sémantique de phrases
 * ============================================================================ */

const TEF_CE_EX1: TrackCompExercise = {
  form: "short",
  topic: "sante",
  intro: "TEF Compréhension écrite (format post-déc. 2023) · Section 1 : Documents fonctionnels de la vie quotidienne.",
  title: "Section 1 · Documents fonctionnels du quotidien",
  docs: [
    {
      text: "Laboratoire BioVal — Compte rendu et consignes pré-analytiques.\nPour votre bilan lipidique et glycémique prescrit par le docteur Moreau, un jeûne strict de douze heures est impératif : ne consommez aucun aliment solide ni boisson sucrée après vingt heures la veille. L'eau plate en quantité modérée reste permise, ainsi que vos traitements cardiologiques habituels, sauf mention contraire écrite du médecin. Les prélèvements sans rendez-vous s'arrêtent à dix heures trente précises.",
      zh: "BioVal医学检验中心——采血前须知。\n针对莫罗医生为您开具的血脂血糖检查，必须严格空腹12小时：前一日晚20点后请勿摄入任何固体食物或含糖饮料。适量白水仍可饮用，常规心脏科药物亦可照常服用（除非医嘱书面另有说明）。免预约采血于上午10点30分准时截止。",
    },
    {
      text: "Syndic Horizon — Convocation à l'assemblée générale ordinaire de la résidence Les Tilleuls.\nLes copropriétaires sont convoqués jeudi 28 novembre à dix-huit heures trente, salle municipale Pasteur. À l'ordre du jour : vote à la majorité absolue du ravalement de la façade nord et remplacement de l'interphone. Tout copropriétaire empêché peut confier un pouvoir signé à un mandataire de son choix, qu'il soit résident ou non, à condition que ce dernier ne détienne pas plus de trois délégations.",
      zh: "Horizon物业管理处——椴树公寓业主大会召集通知。\n兹定于11月28日周四18点30分在巴斯德市政厅会议室召开业主大会。议程包括：以绝对多数表决北立面翻新工程及更换门禁对讲系统。无法出席的业主可将签字委托书交由任意受托人代投（无论受托人是否本楼住户），但同一受托人所持委托不得超过三份。",
    },
    {
      text: "Pass Mobilité Métropole — Conditions de suspension temporaire.\nVotre abonnement annuel à prélèvement automatique peut être gelé gratuitement une seule fois par année civile, pour une durée comprise entre un et trois mois entiers, en cas de stage hors région, congé maternité ou arrêt maladie supérieur à trente jours. La demande doit être enregistrée sur votre espace client avant le vingt du mois précédant la suspension souhaitée.",
      zh: "大都会出行通票——临时停卡条款。\n在赴外地实习、产假或病假超过30天的情况下，您的自动扣款年度月票每个自然年可免费申请冻结一次，期限为1至3个整月。申请须在拟停卡月份前一个月的20日之前在客户空间提交。",
    },
  ],
  questions: [
    {
      doc: 0,
      tefTaskType: 1,
      q: "Qu'est-il autorisé de prendre le matin même avant la prise de sang ?",
      options: [
        "Un café léger sans lait à condition de le boire avant huit heures",
        "Un peu d'eau non gazeuse et ses médicaments cardiaques courants",
        "Un jus de fruits pressés accompagné de son traitement habituel",
        "Absolument aucun liquide ni comprimé durant douze heures",
      ],
      answer: 1,
      evidence: "L'eau plate en quantité modérée reste permise, ainsi que vos traitements cardiologiques habituels, sauf mention contraire écrite du médecin.",
      trapTypes: [
        "无中生有（未允许喝咖啡）",
        "同义改写（正确项）",
        "违反禁含糖饮品规定",
        "绝对化陷阱（白水与常规心脏药允许）",
      ],
      why: "检验须知明确允许适量饮用白水并照常服用常规心脏科药物，选B。",
      pts: 1,
      difficulty: 2,
      skill: "negation",
    },
    {
      doc: 1,
      tefTaskType: 1,
      q: "Quelle règle encadre la représentation d'un copropriétaire absent lors du vote ?",
      options: [
        "Le représentant désigné doit obligatoirement habiter dans l'immeuble Les Tilleuls",
        "Le pouvoir doit être envoyé par lettre recommandée au maire de la commune",
        "Une même personne peut représenter au maximum trois copropriétaires absents",
        "Le vote par procuration est interdit lorsqu'il s'agit de travaux de façade",
      ],
      answer: 2,
      evidence: "Tout copropriétaire empêché peut confier un pouvoir signé à un mandataire de son choix, qu'il soit résident ou non, à condition que ce dernier ne détienne pas plus de trois délégations.",
      trapTypes: [
        "反向陷阱（明确说qu'il soit résident ou non）",
        "无中生有",
        "同义改写（正确项）",
        "与议程矛盾",
      ],
      why: "受托人无需是本楼住户，但每人最多只能持有不超过三份代理委托（pas plus de trois délégations），选C。",
      pts: 1,
      difficulty: 3,
      skill: "detail",
    },
    {
      doc: 2,
      tefTaskType: 1,
      q: "À quelle condition un abonné peut-il suspendre son Pass Mobilité pour le mois de mars ?",
      options: [
        "En déposant sa demande en ligne avant le vingt février pour un motif prévu au contrat",
        "En réglant cinq euros de frais de dossier au guichet central avant le premier mars",
        "En partant quinze jours en vacances scolaires à l'étranger",
        "En ayant déjà utilisé une première pause gratuite au mois de janvier de la même année",
      ],
      answer: 0,
      evidence: "La demande doit être enregistrée sur votre espace client avant le vingt du mois précédant la suspension souhaitée.",
      trapTypes: [
        "同义改写与应用推理（正确项）",
        "与gratuitement及截止日矛盾",
        "不符合指定事由且不足整月",
        "与每年仅限一次矛盾",
      ],
      why: "需符合合同事由，且在拟停卡月份（3月）前一个月的20日（即2月20日）前在线提交，选A。",
      pts: 1,
      difficulty: 3,
      skill: "inference",
    },
  ],
};

const TEF_CE_EX2: TrackCompExercise = {
  form: "short",
  topic: "travail",
  intro: "TEF Compréhension écrite · Section 2 : Phrases lacunaires (cohésion logique et précision lexicale en contexte).",
  title: "Section 2 · Phrases lacunaires en contexte",
  docs: [
    {
      text: "Extrait 1 : La coopérative menuisière a maintenu l'intégralité de ses effectifs cet hiver [______] un recul marqué des commandes dans la construction neuve. Elle a en effet réorienté ses ateliers vers la rénovation thermique des bâtiments scolaires anciens.",
      zh: "语段1：尽管新建住宅订单显著下滑，这家木工合作社今冬仍保住了全部员工岗位。事实上，它将车间产能转向了老旧校舍的节能改造。",
    },
    {
      text: "Extrait 2 : Le médiateur académique a présenté un calendrier de compromis afin de [______] les craintes des parents d'élèves quant à la fermeture annoncée de deux classes bilingues. Une commission paritaire réexaminera les effectifs réels dès la rentrée de septembre.",
      zh: "语段2：学区调解员提出了一份折中时间表，旨在平息学生家长对拟关闭两个双语班的担忧。劳资对等委员会将在九月开学时重新核查实际生源。",
    },
    {
      text: "Extrait 3 : La municipalité se montre [______] encline à subventionner ce festival privé que les organisateurs ont refusé l'an dernier d'offrir des tarifs réduits aux jeunes du territoire.",
      zh: "语段3：市政府之所以愈发不愿资助这个私人音乐节，是因为主办方去年拒绝为本地青年提供优惠票价。",
    },
  ],
  questions: [
    {
      doc: 0,
      tefTaskType: 2,
      q: "Quel connecteur complète correctement la lacune de l'Extrait 1 ?",
      options: [
        "faute d'",
        "en dépit d'",
        "à force d'",
        "de crainte d'",
      ],
      answer: 1,
      evidence: "La coopérative menuisière a maintenu l'intégralité de ses effectifs cet hiver [______] un recul marqué des commandes dans la construction neuve.",
      trapTypes: [
        "因果逻辑相反（faute de表由于缺乏）",
        "让步关系准确搭配名词（正确项）",
        "表凭借反复努力，语义不合",
        "表唯恐，逻辑不通",
      ],
      why: "前句“保住全部员工”与后接名词短语“新房订单明显下滑”构成让步转折关系，en dépit d'（尽管）语法与逻辑完全契合，选B。",
      pts: 1,
      difficulty: 3,
      skill: "paraphrase",
    },
    {
      doc: 1,
      tefTaskType: 2,
      q: "Quel verbe complète avec justesse la lacune de l'Extrait 2 ?",
      options: [
        "attiser",
        "entériner",
        "dissiper",
        "exiger",
      ],
      answer: 2,
      evidence: "Le médiateur académique a présenté un calendrier de compromis afin de [______] les craintes des parents d'élèves quant à la fermeture annoncée de deux classes bilingues.",
      trapTypes: [
        "反义陷阱（attiser les craintes意为激化担忧）",
        "搭配不当（entériner意为正式批准）",
        "精准动宾搭配dissiper les craintes消除顾虑（正确项）",
        "语义与调解折中矛盾",
      ],
      why: "调解员拿出折中方案是为了“消除/化解”家长顾虑，dissiper les craintes为地道B2/C1固定搭配，选C。",
      pts: 1,
      difficulty: 4,
      skill: "paraphrase",
    },
    {
      doc: 2,
      tefTaskType: 2,
      q: "Quelle locution corrélative complète grammaticalement et logiquement l'Extrait 3 ?",
      options: [
        "d'autant moins",
        "pour autant",
        "bien davantage",
        "quoique très",
      ],
      answer: 0,
      evidence: "La municipalité se montre [______] encline à subventionner ce festival privé que les organisateurs ont refusé l'an dernier d'offrir des tarifs réduits aux jeunes du territoire.",
      trapTypes: [
        "d'autant moins … que 愈发不…因为…（正确项）",
        "不可与后文因果que构成比较关联",
        "与后文主办方拒绝优惠的负面原因矛盾",
        "语法结构错误",
      ],
      why: "后半句que引导原因（主办方拒绝给本地青年优惠），构成d'autant moins encline à… que…（愈发不愿……因为……）经典高阶关联结构，选A。",
      pts: 1,
      difficulty: 5,
      skill: "negation",
    },
  ],
};

const TEF_CE_EX3: TrackCompExercise = {
  form: "long",
  topic: "education",
  intro: "TEF Compréhension écrite · Section 3 : Lecture rapide et comparaison de quatre annonces.",
  title: "Section 3 · Comparatif d'ateliers de formation continue",
  docs: [
    {
      text: "Annonce A — Atelier « Prise de parole publique » (Institut Rhétorique, Lyon 3e).\nCours du soir les mardis et jeudis de dix-neuf heures à vingt et une heures, en présentiel uniquement. Groupe limité à dix participants. Tarif : trois cent quatre-vingts euros pour huit semaines, éligible au compte personnel de formation (CPF). Certificat délivré sur épreuve orale finale.\n\nAnnonce B — Parcours « Rédaction administrative claire » (Centre Agora, distanciel intégral).\nSéances en direct le samedi matin de neuf heures à midi, avec rediffusion vidéo pendant trente jours. Tarif : deux cent quatre-vingt-dix euros, non éligible au CPF mais finançable par l'employeur. Aucun prérequis de diplôme.\n\nAnnonce C — Stage intensif « Médiation et gestion des conflits » (Association Passerelles, Villeurbanne).\nCinq journées consécutives du lundi au vendredi (neuf heures - dix-sept heures). Tarif solidaire de cent quatre-vingts euros pour les demandeurs d'emploi, quatre cent cinquante euros plein tarif, éligible au CPF. Accès de plain-pied adapté aux personnes à mobilité réduite.\n\nAnnonce D — Module « Anglais et français de négociation » (École Mercure, Lyon Part-Dieu).\nFormule hybride : un soir par semaine sur place le mercredi (dix-huit heures trente - vingt heures trente) et plateforme en ligne libre. Tarif : cinq cent vingt euros, éligible au CPF. Niveau B2 préalable exigé dans les deux langues.",
      zh: "公告A——“公众演讲工作坊”（修辞学院，里昂三区）。\n周二、周四晚19点至21点夜校，仅限线下授课。限10人小班。学费：八周380欧元，可使用个人培训账户（CPF）抵扣。期末口试合格颁发证书。\n\n公告B——“清晰行政公文写作”（阿戈拉中心，全程远程）。\n周六上午9点至12点直播授课，附30天视频回放。学费：290欧元，不可使用CPF，但可由雇主报销。无学历门槛。\n\n公告C——“调解与冲突管理密集班”（桥梁协会，维勒班）。\n周一至周五连续五个全天（9点至17点）。求职者公益价180欧元，全价450欧元，可使用CPF。无障碍平层通道适合行动不便人士。\n\n公告D——“英法双语商务谈判模块”（水星学院，里昂帕尔迪约）。\n混合制：每周三晚线下一次（18点30分至20点30分）加线上自由学习平台。学费：520欧元，可使用CPF。须具备英法双语B2前置水平。",
    },
  ],
  questions: [
    {
      doc: 0,
      tefTaskType: 3,
      q: "Salariée à plein temps du lundi au vendredi jusqu'à dix-huit heures, Nadia veut mobiliser son CPF avec un budget plafonné à quatre cents euros, sans condition de niveau en langue étrangère. Quelle formule correspond à tous ses critères ?",
      options: [
        "L'Annonce A uniquement",
        "L'Annonce B uniquement",
        "L'Annonce C uniquement",
        "L'Annonce D uniquement",
      ],
      answer: 0,
      evidence: "Cours du soir les mardis et jeudis de dix-neuf heures à vingt et une heures, en présentiel uniquement. Groupe limité à dix participants. Tarif : trois cent quatre-vingts euros pour huit semaines, éligible au compte personnel de formation (CPF).",
      trapTypes: [
        "四项条件全满足（19h夜校+CPF+380€≤400€+无外语门槛）（正确项）",
        "排除项（B不可用CPF）",
        "排除项（C为周一至周五白天全天且全价450€）",
        "排除项（D学费520€超预算且要求双语B2）",
      ],
      why: "娜迪亚工作日18点下班、要用CPF、预算≤400欧元且无外语门槛：B不支持CPF，C占工作日白天且全价450欧元，D需520欧元且要求英语B2，唯独A完全符合，选A。",
      pts: 1,
      difficulty: 4,
      skill: "detail",
    },
    {
      doc: 0,
      tefTaskType: 3,
      q: "Quel point distingue l'Annonce B des trois autres formations présentées ?",
      options: [
        "Elle est la seule à délivrer un diplôme d'État reconnu à l'international",
        "Elle ne nécessite aucun déplacement physique et n'accepte pas le financement CPF",
        "Elle impose un test de sélection écrit avant toute inscription définitive",
        "Elle offre le tarif plein le plus élevé du comparatif",
      ],
      answer: 1,
      evidence: "Séances en direct le samedi matin de neuf heures à midi, avec rediffusion vidéo pendant trente jours. Tarif : deux cent quatre-vingt-dix euros, non éligible au CPF mais finançable par l'employeur.",
      trapTypes: [
        "无中生有",
        "跨公告比对正确项（全程线上+唯一不可用CPF）（正确项）",
        "与Aucun prérequis矛盾",
        "数字错误（290€是全价最低而非最高）",
      ],
      why: "对比四则公告：A、C纯线下，D混合制需周三到场，仅B全程远程且唯一不可使用CPF，选B。",
      pts: 1,
      difficulty: 4,
      skill: "detail",
    },
    {
      doc: 0,
      tefTaskType: 3,
      q: "Quelle affirmation est vraie au vu de l'ensemble du document ?",
      options: [
        "Toutes les formations éligibles au CPF se déroulent exclusivement le soir",
        "Aucune formule ne prévoit de réduction pour les personnes sans emploi",
        "Seules deux annonces permettent de suivre au moins une partie des contenus à distance",
        "Les quatre organismes limitent leurs effectifs à dix inscrits par session",
      ],
      answer: 2,
      evidence: "Formule hybride : un soir par semaine sur place le mercredi (dix-huit heures trente - vingt heures trente) et plateforme en ligne libre.",
      trapTypes: [
        "以偏概全（C支持CPF但在白天授课）",
        "与C提供求职者180€优惠价矛盾",
        "跨文本核对正确（仅B全程远程与D混合线上平台两项含远程内容）（正确项）",
        "张冠李戴（仅A明确限10人）",
      ],
      why: "四则公告中，A和C为纯线下，只有B（全程远程）和D（混合制含线上平台）两项包含远程学习内容，选C。",
      pts: 1,
      difficulty: 4,
      skill: "inference",
    },
  ],
};

const TEF_CE_EX4: TrackCompExercise = {
  form: "long",
  topic: "environnement",
  intro: "TEF Compréhension écrite · Section 4 : Analyse d'un article de presse francophone.",
  title: "Section 4 · Transmission agricole : le pari des fermes collectives",
  docs: [
    {
      text: "D'ici dix ans, près de la moitié des chefs d'exploitation agricole français atteindront l'âge de la retraite. Pourtant, malgré l'intérêt croissant de jeunes diplômés non issus du monde rural — ceux que l'on nomme les « néo-ruraux » —, les cessions d'exploitations patinent. La raison majeure tient au gigantisme accumulé au fil des décennies : racheter seul cent vingt hectares, un parc mécanisé lourd et des bâtiments d'élevage exige aujourd'hui un endettement initial dépassant souvent le demi-million d'euros, que les banques hésitent à accorder à des candidats sans patrimoine familial.\n\nPour contourner cette impasse financière mais aussi sociale, des sociétés coopératives foncières rachètent désormais des domaines entiers grâce à l'épargne citoyenne afin de les louer à long terme à des collectifs de trois ou quatre associés. Sur une même terre en Dordogne, un maraîcher, une boulangère-paysanne et un éleveur ovin partagent ainsi le matériel d'irrigation, la comptabilité et surtout les astreintes du week-end.\n\nCertes, ce modèle ne constitue pas une recette miraculeuse : la gouvernance collégiale réclame un apprentissage rigoureux du compromis, et plusieurs chambres d'agriculture demeurent sceptiques face à la viabilité économique de structures morcelées. Il n'en reste pas moins que ces fermes partagées affichent un taux de pérennité à cinq ans supérieur à celui des installations individuelles isolées.",
      zh: "未来十年内，近半数法国农场主将达到退休年龄。然而，尽管越来越多非农家出身的年轻毕业生（即所谓“新乡民”）对务农兴趣浓厚，农场交接却进展迟缓。主要原因在于数十年来不断累积的规模巨型化：独自买下120公顷土地、重型农机具和养殖厂房，如今往往需要背负超过50万欧元的初始债务，银行对缺乏家族资产担保的申请人慎之又慎。\n\n为绕开这一资金与社会双重死胡同，土地合作社如今借助公民储蓄买下整片农庄，再长期租给三四名合伙人组成的集体。在多尔多涅省同一片土地上，菜农、自种自烤面包师和养羊户得以共享灌溉设备、财务记账，尤其是轮流分担周末值守。\n\n诚然，这一模式并非灵丹妙药：集体共治需要严格磨合妥协能力，多家农业商会也对分散化经营的经济可行性持怀疑态度。但不可否认的是，这类共享农场的五年存活率高于孤军奋战的个人创业农场。",
    },
  ],
  questions: [
    {
      doc: 0,
      tefTaskType: 4,
      q: "Quel obstacle principal freine aujourd'hui la reprise des fermes par de nouveaux candidats ?",
      options: [
        "Le désintérêt généralisé des jeunes générations pour les métiers de la terre",
        "La taille et la valeur capitalistique des domaines devenus trop lourds pour un repreneur isolé",
        "L'interdiction légale faite aux citadins d'exploiter des terres agricoles protégées",
        "Le refus systématique des agriculteurs retraités de céder leurs terres hors de leur famille",
      ],
      answer: 1,
      evidence: "La raison majeure tient au gigantisme accumulé au fil des décennies : racheter seul cent vingt hectares, un parc mécanisé lourd et des bâtiments d'élevage exige aujourd'hui un endettement initial dépassant souvent le demi-million d'euros",
      trapTypes: [
        "反向陷阱（首段指出新乡民兴趣增长）",
        "同义改写（正确项）",
        "无中生有",
        "无中生有",
      ],
      why: "阻碍农场交接的主因是农场规模过大、资产过重，个人独立接盘需负债逾50万欧元，选B。",
      pts: 1,
      difficulty: 4,
      skill: "gist",
    },
    {
      doc: 0,
      tefTaskType: 4,
      q: "Quel rôle jouent les coopératives foncières décrites au deuxième paragraphe ?",
      options: [
        "Elles prêtent directement un demi-million d'euros sans intérêts à chaque jeune agriculteur",
        "Elles acquièrent les terres via l'épargne publique pour les mettre en location auprès de groupes d'associés",
        "Elles revendent les bâtiments agricoles en résidences secondaires pour financer l'irrigation",
        "Elles remplacent les chambres d'agriculture dans la formation technique des éleveurs",
      ],
      answer: 1,
      evidence: "des sociétés coopératives foncières rachètent désormais des domaines entiers grâce à l'épargne citoyenne afin de les louer à long terme à des collectifs de trois ou quatre associés.",
      trapTypes: [
        "偷换机制（是买地出租而非个人免息放贷）",
        "同义改写（正确项）",
        "无中生有",
        "无中生有",
      ],
      why: "土地合作社募集公民储蓄买下整片农庄，再长期租给三四人合伙团队经营，选B。",
      pts: 1,
      difficulty: 5,
      skill: "paraphrase",
    },
    {
      doc: 0,
      tefTaskType: 4,
      q: "Quelle nuance l'auteur apporte-t-il dans le dernier paragraphe ?",
      options: [
        "Bien qu'exigeantes sur le plan humain et discutées, ces fermes collectives tiennent mieux dans la durée",
        "Faute de soutien des chambres d'agriculture, la majorité de ces collectifs disparaît avant cinq ans",
        "Les associés finissent presque toujours par racheter individuellement leur parcelle au bout de trois ans",
        "La rentabilité immédiate de ces fermes a désormais convaincu l'ensemble des syndicats agricoles",
      ],
      answer: 0,
      evidence: "la gouvernance collégiale réclame un apprentissage rigoureux du compromis, et plusieurs chambres d'agriculture demeurent sceptiques face à la viabilité économique de structures morcelées. Il n'en reste pas moins que ces fermes partagées affichent un taux de pérennité à cinq ans supérieur à celui des installations individuelles isolées.",
      trapTypes: [
        "准确概括让步转折立场（正确项）",
        "反向陷阱（五年存活率反而更高）",
        "无中生有",
        "与sceptiques矛盾",
      ],
      why: "末段先承认共治需磨合且农业商会存疑，随即以Il n'en reste pas moins que强调其五年存续率优于单打独斗，选A。",
      pts: 1,
      difficulty: 6,
      skill: "opinion",
    },
  ],
};

const TEF_CE_EX5: TrackCompExercise = {
  form: "short",
  topic: "economie-finances",
  intro: "TEF Compréhension écrite · Section 5 : Équivalence sémantique de phrases (choisissez la reformulation exacte).",
  title: "Section 5 · Reformulations exactes de niveau C1",
  docs: [
    {
      text: "Énoncé 1 : Loin d'avoir tari le recrutement des jeunes comptables, l'automatisation de la saisie a redéployé leurs fonctions vers l'accompagnement fiscal des clients.",
      zh: "原句1：录入自动化非但没有让青年会计的招聘枯竭，反而将他们的职能重新配置到了客户税务咨询辅导上。",
    },
    {
      text: "Énoncé 2 : Ce n'est qu'une fois les recours des riverains purgés que le chantier du tramway pourra véritablement démarrer.",
      zh: "原句2：只有等沿线居民的法律申诉全部审结之后，有轨电车工地才能真正动工。",
    },
    {
      text: "Énoncé 3 : Aussi ambitieux que soit ce plan de rénovation thermique, il restera lettre morte tant que les copropriétés modestes ne disposeront pas d'une avance de trésorerie.",
      zh: "原句3：无论这项节能改造计划多么宏大，只要普通低收入业主委员会拿不到垫资预付款，它就仍将是一纸空文。",
    },
  ],
  questions: [
    {
      doc: 0,
      tefTaskType: 5,
      q: "Quelle phrase exprime exactement la même idée que l'Énoncé 1 ?",
      options: [
        "Les cabinets embauchent moins de débutants depuis que les logiciels traitent la fiscalité",
        "Les outils numériques n'ont pas réduit l'embauche des juniors, mais ont fait évoluer leur métier vers le conseil",
        "Seuls les comptables expérimentés profitent réellement de l'automatisation des tâches de saisie",
        "L'accompagnement fiscal disparaîtra dès que la saisie comptable sera entièrement informatisée",
      ],
      answer: 1,
      evidence: "Loin d'avoir tari le recrutement des jeunes comptables, l'automatisation de la saisie a redéployé leurs fonctions vers l'accompagnement fiscal des clients.",
      trapTypes: [
        "反向陷阱（误将loin de读成肯定）",
        "精准同义改写（正确项）",
        "偷换对象（原句讲jeunes comptables）",
        "未来预测与原意相反",
      ],
      why: "Loin d'avoir tari意为“非但没有削减/枯竭”，redéployé vers意为“转向/重新配置到”，与B项完全等值。",
      pts: 1,
      difficulty: 5,
      skill: "paraphrase",
    },
    {
      doc: 1,
      tefTaskType: 5,
      q: "Quelle phrase exprime exactement la même idée que l'Énoncé 2 ?",
      options: [
        "Les travaux de la ligne débuteront uniquement après le règlement complet des contestations juridiques locales",
        "Le lancement immédiat des travaux a définitivement mis fin aux plaintes des habitants du quartier",
        "Les riverains ont renoncé à leurs poursuites dès l'ouverture officielle du chantier du tramway",
        "Peu importe l'issue des procédures en justice, la construction du tramway commencera à la date prévue",
      ],
      answer: 0,
      evidence: "Ce n'est qu'une fois les recours des riverains purgés que le chantier du tramway pourra véritablement démarrer.",
      trapTypes: [
        "精准同义改写（ce n'est qu'une fois… que = uniquement après）（正确项）",
        "时序与因果倒置",
        "无中生有（并未放弃申诉）",
        "与先决条件句式相反",
      ],
      why: "Ce n'est qu'une fois… purgés que… 强调“只有等申诉全部审结后才……”，即A项。",
      pts: 1,
      difficulty: 5,
      skill: "negation",
    },
    {
      doc: 2,
      tefTaskType: 5,
      q: "Quelle phrase exprime exactement la même idée que l'Énoncé 3 ?",
      options: [
        "L'ampleur exceptionnelle du programme suffira à convaincre les ménages modestes d'avancer les frais",
        "Les copropriétés aisées sont exclues du dispositif public d'avance financière pour l'isolation",
        "Les objectifs du projet ont été revus à la baisse afin de s'adapter au budget des syndics",
        "Sans préfinancement destiné aux immeubles peu fortunés, ce vaste programme demeurera sans effet concret",
      ],
      answer: 3,
      evidence: "Aussi ambitieux que soit ce plan de rénovation thermique, il restera lettre morte tant que les copropriétés modestes ne disposeront pas d'une avance de trésorerie.",
      trapTypes: [
        "忽视让步结构（误以为宏大就足够）",
        "无中生有",
        "曲解原意",
        "精准同义改写（rester lettre morte = demeurer sans effet concret）（正确项）",
      ],
      why: "Aussi ambitieux que soit…（无论多宏大）+ rester lettre morte（沦为一纸空文）+ tant que… ne… pas（只要没有……），完全对应D项。",
      pts: 1,
      difficulty: 6,
      skill: "paraphrase",
    },
  ],
};

export const TEF_CE_PAPER: TrackPaper = {
  id: "tef-preset-ce-1",
  track: "tef",
  section: "ce",
  kind: "read",
  level: "B2",
  created: 1763800300000,
  src: "preset",
  titleZh: "TEF 2023.12 新政阅读套题（五节全题型 · 15 题四选一）",
  badge: "CCI 0–699 · NCLC",
  durationMinutes: 30,
  exs: [TEF_CE_EX1, TEF_CE_EX2, TEF_CE_EX3, TEF_CE_EX4, TEF_CE_EX5],
};

export const TCF_TEF_PRESET_PAPERS: readonly TrackPaper[] = [
  TCF_CO_PAPER,
  TCF_CE_PAPER,
  TEF_CO_PAPER,
  TEF_CE_PAPER,
];

export function presetPapersForTrack(track: "tcf" | "tef", kind: "listen" | "read"): TrackPaper[] {
  return TCF_TEF_PRESET_PAPERS.filter((p) => p.track === track && p.kind === kind);
}
