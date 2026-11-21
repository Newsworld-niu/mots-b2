/**
 * 口语 12 道内置题的静态预设考官追问与参考提纲（供无 AI Key 时由 TTS 依次播报模拟辩论）。
 * 所有文本均为站点自编参考内容，尚未经认证考官人工终审（待核对）。
 */

export type FollowUpLevel = "clarify" | "challenge" | "widen";

export interface SpeakingFollowUp {
  q: string;
  intentZh: string;
  level: FollowUpLevel;
}

export interface SpeakingPreset {
  id: string;
  problematique: string;
  outline: { zh: string; fr: string }[];
  followUps: SpeakingFollowUp[];
  unverified: true;
}

export const SPEAKING_PRESETS: SpeakingPreset[] = [
  {
    id: "s-teletravail",
    problematique: "Dans quelle mesure le télétravail constitue-t-il un progrès pour le salarié sans nuire à la cohésion de l'entreprise ?",
    outline: [
      { zh: "引入与问题", fr: "Le document soulève une question centrale : comment concilier autonomie à distance et lien collectif ?" },
      { zh: "积极方面", fr: "Tout d'abord, le travail à distance réduit les trajets quotidiens et favorise la concentration." },
      { zh: "风险与让步", fr: "Néanmoins, l'isolement et le débordement sur la vie privée restent des dangers bien réels." },
      { zh: "折中结论", fr: "À mon avis, un modèle hybride, avec deux jours de télétravail par semaine, offre le meilleur équilibre." },
    ],
    followUps: [
      { q: "Vous évoquez les avantages du télétravail, mais pouvez-vous me donner un exemple concret tiré de votre propre expérience ou de votre entourage ?", intentZh: "追问具体例证", level: "clarify" },
      { q: "Certains managers affirment que les jeunes diplômés apprennent beaucoup moins vite à distance. Comment répondez-vous à cette objection ?", intentZh: "反驳：新人传帮带受阻", level: "challenge" },
      { q: "Ne craignez-vous pas que travailler chez soi rende encore plus difficile la coupure entre vie professionnelle et vie familiale ?", intentZh: "质疑工作与生活边界", level: "challenge" },
      { q: "Si une entreprise impose trois jours au bureau, les salariés qui ont déménagé loin risquent-ils de démissionner ?", intentZh: "追问现实矛盾与后果", level: "clarify" },
      { q: "Qui devrait payer l'équipement, l'électricité et le chauffage lorsque l'on travaille depuis son domicile ?", intentZh: "成本与责任归属", level: "challenge" },
      { q: "Pensez-vous que tous les secteurs peuvent adopter ce modèle, ou crée-t-il une nouvelle inégalité entre les travailleurs de bureau et les autres ?", intentZh: "拓展至社会公平与行业差异", level: "widen" },
      { q: "Selon vous, dans dix ans, les grands immeubles de bureaux auront-ils disparu des centres-villes ?", intentZh: "拓展至未来趋势与城市规划", level: "widen" },
    ],
    unverified: true,
  },
  {
    id: "s-quatre-jours",
    problematique: "La semaine de quatre jours sans baisse de salaire est-elle réaliste et souhaitable pour l'ensemble de l'économie ?",
    outline: [
      { zh: "引入与问题", fr: "Peut-on travailler moins longtemps tout en maintenant le même niveau de productivité et de rémunération ?" },
      { zh: "支持论据", fr: "D'une part, des employés plus reposés sont souvent moins absents et plus concentrés." },
      { zh: "局限与阻力", fr: "D'autre part, ce modèle pose problème dans les hôpitaux, les commerces ou les petites entreprises." },
      { zh: "折中结论", fr: "Plutôt qu'une règle rigide, il conviendrait que chaque secteur adapte le rythme de travail selon ses contraintes." },
    ],
    followUps: [
      { q: "Quand vous dites que les salariés sont plus efficaces en quatre jours, cela ne signifie-t-il pas simplement qu'ils doivent travailler plus vite sous pression ?", intentZh: "质疑工作效率与隐性加班", level: "challenge" },
      { q: "Comment organiser concrètement une semaine de quatre jours dans un hôpital, une école ou un restaurant ?", intentZh: "追问服务业/医疗业落地", level: "clarify" },
      { q: "Une petite entreprise de dix personnes peut-elle vraiment absorber le coût d'embauches supplémentaires sans baisser les salaires ?", intentZh: "质疑中小企业财务承受力", level: "challenge" },
      { q: "Préférez-vous travailler quatre journées de neuf heures ou garder cinq journées plus courtes ? Pourquoi ?", intentZh: "比较不同排班方式", level: "clarify" },
      { q: "Certains économistes craignent une perte de compétitivité par rapport aux pays voisins. Cet argument vous convainc-t-il ?", intentZh: "引入国际竞争反论", level: "challenge" },
      { q: "Qu'en est-il dans votre pays : la réduction du temps de travail est-elle un sujet débattu aujourd'hui ?", intentZh: "拓展至跨文化/本国现状", level: "widen" },
      { q: "Pour finir, les gens utilisent-ils vraiment ce cinquième jour libre pour se reposer, ou pour chercher un deuxième emploi ?", intentZh: "拓展至社会深层影响", level: "widen" },
    ],
    unverified: true,
  },
  {
    id: "s-avion",
    problematique: "L'interdiction de certains vols intérieurs est-elle une mesure écologique efficace ou une contrainte symbolique ?",
    outline: [
      { zh: "引入与问题", fr: "Pour réduire les émissions liées aux transports, faut-il interdire les vols courts ou d'abord améliorer le train ?" },
      { zh: "支持限制", fr: "L'avion émet nettement plus de gaz à effet de serre par passager que le train électrique." },
      { zh: "反方阻力", fr: "Cependant, le train reste souvent plus cher et les correspondances internationales peuvent être pénalisées." },
      { zh: "折中结论", fr: "Une telle interdiction n'est pertinente que si le réseau ferroviaire devient fiable, fréquent et abordable." },
    ],
    followUps: [
      { q: "Vous soulignez que le train est souvent plus cher que l'avion : comment expliquez-vous cette situation et qui devrait agir ?", intentZh: "追问高铁票价机制与政策责任", level: "clarify" },
      { q: "Les compagnies aériennes rappellent que les vols courts représentent une faible part des émissions mondiales. Cette mesure est-elle vraiment utile ?", intentZh: "挑战政策减排实际效果", level: "challenge" },
      { q: "Que répondez-vous à un voyageur d'affaires ou à un habitant d'une région isolée qui perd sa seule liaison rapide ?", intentZh: "质疑地区公平性与通行权", level: "challenge" },
      { q: "Ne faudrait-il pas plutôt taxer fortement le kérosène ou limiter les jets privés avant d'interdire les vols commerciaux ?", intentZh: "比较替代方案（燃油税/私人飞机）", level: "clarify" },
      { q: "Si l'on réduit les vols intérieurs, les voyageurs ne risquent-ils pas tout simplement de reprendre leur voiture sur l'autoroute ?", intentZh: "追问反弹/替代效应", level: "challenge" },
      { q: "À titre personnel, seriez-vous prêt(e) à renoncer à l'avion pour vos vacances si le trajet en train dure huit heures ?", intentZh: "测试个人立场一致性", level: "widen" },
      { q: "À plus long terme, croyez-vous davantage aux progrès technologiques, comme l'avion propre, ou à la baisse de nos déplacements ?", intentZh: "拓展至技术乐观派与节制派争论", level: "widen" },
    ],
    unverified: true,
  },
  {
    id: "s-viande",
    problematique: "Une commune est-elle légitime à imposer un repas végétarien hebdomadaire dans les cantines scolaires ?",
    outline: [
      { zh: "引入与问题", fr: "La cantine doit-elle servir d'outil d'éducation écologique et nutritionnelle, au risque de heurter certaines habitudes familiales ?" },
      { zh: "支持论据", fr: "Réduire la viande une fois par semaine limite l'empreinte carbone et fait découvrir de nouvelles protéines." },
      { zh: "担忧与争议", fr: "Toutefois, certains parents craignent des carences nutritionnelles ou rejettent une décision jugée idéologique." },
      { zh: "折中结论", fr: "Cette mesure fonctionne bien à condition que les menus soient savoureux, équilibrés et que la démarche soit expliquée aux familles." },
    ],
    followUps: [
      { q: "Pourquoi cette mesure suscite-t-elle autant de réactions alors qu'il ne s'agit que d'un seul repas sur cinq ?", intentZh: "追问争议背后的象征意义", level: "clarify" },
      { q: "Certains parents affirment que leurs enfants refusent de manger les plats végétariens et que cela augmente le gaspillage alimentaire. Qu'en pensez-vous ?", intentZh: "反驳：孩子挑食导致浪费", level: "challenge" },
      { q: "Est-ce vraiment le rôle de la mairie d'éduquer les goûts alimentaires des enfants, ou cela relève-t-il uniquement de la famille ?", intentZh: "公权力边界与家长自由", level: "challenge" },
      { q: "Proposer simplement un choix végétarien chaque jour ne serait-il pas plus respectueux qu'un menu unique imposé à tous ?", intentZh: "比较「每日可选」与「每周强制一日」", level: "clarify" },
      { q: "Pour les familles modestes, la cantine est parfois le seul repas complet de la journée avec de la viande. Comment les rassurer ?", intentZh: "追问低收入家庭营养顾虑", level: "challenge" },
      { q: "Selon vous, l'école devrait-elle aussi intervenir sur d'autres habitudes, comme le sucre ou les produits ultra-transformés ?", intentZh: "拓展至学校健康政策", level: "widen" },
      { q: "Dans votre pays, les habitudes alimentaires des jeunes évoluent-elles vers moins de viande également ?", intentZh: "拓展至跨文化观察", level: "widen" },
    ],
    unverified: true,
  },
  {
    id: "s-portable",
    problematique: "Interdire totalement le téléphone portable au collège protège-t-il vraiment les élèves, ou retarde-t-il leur apprentissage de l'autonomie ?",
    outline: [
      { zh: "引入与问题", fr: "Faut-il bannir le smartphone de l'enceinte scolaire ou apprendre aux adolescents à l'utiliser de façon responsable ?" },
      { zh: "赞成禁用", fr: "L'interdiction favorise la concentration en classe, limite le cyberharcèlement et encourage les échanges dans la cour." },
      { zh: "质疑与不足", fr: "Pourtant, certains estiment que cette règle est difficile à contrôler et ignore les usages pédagogiques." },
      { zh: "平衡结论", fr: "Une interdiction stricte pendant le temps scolaire devrait être complétée par une véritable éducation au numérique." },
    ],
    followUps: [
      { q: "Vous dites que les élèves parlent davantage entre eux sans téléphone : avez-vous observé cela concrètement dans un établissement ?", intentZh: "追问具体场景观察", level: "clarify" },
      { q: "En interdisant le portable à l'école, ne déplace-t-on pas simplement les problèmes de harcèlement en ligne vers le soir, à la maison ?", intentZh: "质疑校园禁令的局限性", level: "challenge" },
      { q: "Comment réagissez-vous face aux parents qui veulent pouvoir joindre leur enfant immédiatement en cas d'urgence ou de retard de bus ?", intentZh: "反驳：家长紧急联络需求", level: "challenge" },
      { q: "Faut-il confisquer l'appareil le matin dans un casier ou simplement demander aux élèves de l'éteindre dans leur sac ?", intentZh: "追问执行机制", level: "clarify" },
      { q: "Des enseignants utilisent parfois le téléphone comme dictionnaire ou outil de sondage en classe. Est-ce une erreur d'y renoncer ?", intentZh: "质疑数字教学工具损失", level: "challenge" },
      { q: "À quel âge pensez-vous qu'un adolescent est assez mûr pour posséder son premier smartphone ?", intentZh: "拓展至青少年首次配机年龄", level: "widen" },
      { q: "Finalement, les adultes à l'école — professeurs et parents — ne devraient-ils pas eux aussi montrer l'exemple ?", intentZh: "拓展至成年人示范责任", level: "widen" },
    ],
    unverified: true,
  },
  {
    id: "s-notes",
    problematique: "La suppression des notes chiffrées permet-elle de réduire l'anxiété scolaire sans nuire à la lisibilité du niveau des élèves ?",
    outline: [
      { zh: "引入与问题", fr: "Évaluer sans notes améliore-t-il la motivation des élèves, ou les prive-t-il de repères clairs ?" },
      { zh: "支持取消", fr: "Les appréciations valorisent les progrès réels et évitent de décourager les élèves en difficulté." },
      { zh: "反对顾虑", fr: "À l'inverse, sans moyenne chiffrée, les familles ont parfois du mal à situer le niveau exigé par la suite." },
      { zh: "折中结论", fr: "Remplacer les notes par une évaluation des compétences fonctionne mieux en primaire, mais nécessite des repères clairs au lycée." },
    ],
    followUps: [
      { q: "Pourquoi une mauvaise note décourage-t-elle davantage qu'une remarque écrite critique ?", intentZh: "追问分数与评语的心理差异", level: "clarify" },
      { q: "Si l'on supprime les notes jusqu'au lycée, comment préparer les étudiants aux concours et aux examens nationaux qui restent très sélectifs ?", intentZh: "反驳：与升学选拔脱节", level: "challenge" },
      { q: "Pour un professeur qui a cent cinquante élèves, rédiger des appréciations détaillées à la place des notes n'est-il pas une charge de travail impossible ?", intentZh: "质疑教师工作负荷", level: "challenge" },
      { q: "Ne risque-t-on pas de remplacer le 12 sur 20 par des couleurs ou des lettres, ce qui revient exactement au même classement ?", intentZh: "追问变相打分现象", level: "clarify" },
      { q: "Certains élèves brillants disent que la note est un objectif motivant qui récompense leurs efforts. Les oublie-t-on dans ce système ?", intentZh: "反驳：优秀学生的激励感", level: "challenge" },
      { q: "Dans votre système scolaire d'origine, quel rôle jouent les notes et le classement ?", intentZh: "拓展至本国教育文化对比", level: "widen" },
      { q: "À votre avis, peut-on imaginer une évaluation idéale qui mesure à la fois les connaissances et l'esprit d'équipe ?", intentZh: "拓展至未来评价体系", level: "widen" },
    ],
    unverified: true,
  },
  {
    id: "s-reseaux",
    problematique: "Fixer une majorité numérique à quinze ans est-il un moyen réaliste et efficace de protéger la santé mentale des adolescents ?",
    outline: [
      { zh: "引入与问题", fr: "Une loi interdisant les réseaux sociaux avant quinze ans peut-elle réellement protéger les jeunes malgré les difficultés techniques ?" },
      { zh: "支持立法", fr: "L'âge limite envoie un signal clair sur les risques d'addiction, de perte de sommeil et de comparaison sociale." },
      { zh: "可行性挑战", fr: "Néanmoins, il reste très facile de contourner le contrôle d'âge en indiquant une fausse date de naissance." },
      { zh: "综合策略", fr: "La loi doit s'accompagner d'outils de contrôle fiables, de responsabilisation des plateformes et d'éducation familiale." },
    ],
    followUps: [
      { q: "Quels effets précis des réseaux sociaux sur les adolescents vous paraissent les plus préoccupants aujourd'hui ?", intentZh: "追问青少年心理健康具体危害", level: "clarify" },
      { q: "Même si la loi existe, tous les jeunes savent mentir sur leur âge en trois secondes. À quoi sert une interdiction qu'on ne peut pas faire respecter ?", intentZh: "挑战法律可执行性", level: "challenge" },
      { q: "Pour vérifier l'âge réel, il faudrait fournir une pièce d'identité en ligne : n'est-ce pas dangereux pour la protection des données personnelles ?", intentZh: "追问实名制与隐私安全冲突", level: "challenge" },
      { q: "Les réseaux sociaux permettent aussi à certains jeunes isolés de trouver une communauté ou de s'informer. Faut-il vraiment les en priver ?", intentZh: "反方论点：社交归属与信息获取", level: "challenge" },
      { q: "Selon vous, la responsabilité principale revient-elle à l'État, aux géants du numérique ou aux parents ?", intentZh: "责任划分追问", level: "clarify" },
      { q: "Ne devrait-on pas plutôt interdire les algorithmes qui rendent dépendants, quel que soit l'âge de l'utilisateur ?", intentZh: "拓展至算法监管", level: "widen" },
      { q: "Pensez-vous que les générations futures finiront par se lasser des réseaux sociaux et revenir à des échanges plus directs ?", intentZh: "拓展至未来社交趋势", level: "widen" },
    ],
    unverified: true,
  },
  {
    id: "s-ia",
    problematique: "L'usage de l'intelligence artificielle dans les travaux universitaires doit-il être proscrit ou intégré dans les méthodes d'apprentissage ?",
    outline: [
      { zh: "引入与问题", fr: "Face à des outils capables de rédiger en quelques secondes, comment l'université peut-elle préserver la valeur des diplômes ?" },
      { zh: "风险所在", fr: "Le recours passif à l'IA, sans réflexion personnelle, empêche les étudiants d'apprendre à structurer leur pensée et favorise le plagiat." },
      { zh: "融入教改", fr: "Cependant, interdire totalement un outil déjà utilisé en entreprise semble illusoire ; mieux vaut former à son usage critique." },
      { zh: "改进建议", fr: "Il faut combiner l'apprentissage de la vérification des sources avec des évaluations orales et en salle." },
    ],
    followUps: [
      { q: "À partir de quel moment l'utilisation d'une IA pour un devoir devient-elle de la tricherie selon vous ?", intentZh: "界定合理辅助与学术抄袭", level: "clarify" },
      { q: "Si un étudiant demande à une IA de résumer un texte et d'en corriger le plan, développe-t-il encore son esprit critique ?", intentZh: "质疑认知能力退化", level: "challenge" },
      { q: "Les logiciels de détection sont peu fiables et accusent parfois à tort des étudiants étrangers. Comment les universités peuvent-elles vérifier ?", intentZh: "追问学术检测困境", level: "challenge" },
      { q: "Pensez-vous qu'il faille revenir davantage aux examens sur papier et aux épreuves orales ?", intentZh: "追问考核方式改革", level: "clarify" },
      { q: "D'un autre côté, si un étudiant ne sait pas utiliser l'IA en sortant de l'université, ne sera-t-il pas pénalisé sur le marché du travail ?", intentZh: "反驳：就业市场技能需求", level: "challenge" },
      { q: "Comment vous-même utilisez-vous ou évitez-vous ces outils pour apprendre le français ?", intentZh: "联系考生自身语言学习体验", level: "widen" },
      { q: "À long terme, quels métiers intellectuels risquent d'être les plus transformés par cette technologie ?", intentZh: "拓展至职业结构变迁", level: "widen" },
    ],
    unverified: true,
  },
  {
    id: "s-sport",
    problematique: "Le remboursement du sport sur ordonnance par la collectivité représente-t-il une dépense excessive ou un investissement rentable pour la santé publique ?",
    outline: [
      { zh: "引入与问题", fr: "Financer l'activité physique comme un traitement médical permet-il réellement de réduire les dépenses de santé à long terme ?" },
      { zh: "预防价值", fr: "Prévenir le diabète, les maladies cardiovasculaires et la dépression coûte souvent moins cher que soigner des maladies chroniques." },
      { zh: "预算争议", fr: "En revanche, certains redoutent des abus ou des dépenses supplémentaires pour une sécurité sociale déjà endettée." },
      { zh: "条件落实", fr: "Le dispositif doit cibler les personnes souffrant de pathologies chroniques et faire l'objet d'un suivi régulier." },
    ],
    followUps: [
      { q: "Pouvez-vous préciser pour quel type de patients le sport sur ordonnance vous paraît vraiment prioritaire ?", intentZh: "追问政策适用人群边界", level: "clarify" },
      { q: "Les caisses d'assurance maladie manquent déjà d'argent pour financer les hôpitaux. Est-il raisonnable d'ajouter le remboursement de séances de sport ?", intentZh: "反驳：医保资金紧张", level: "challenge" },
      { q: "Ne risque-t-on pas que des personnes déjà sportives demandent une ordonnance juste pour payer leur salle moins cher ?", intentZh: "质疑道德风险与制度滥用", level: "challenge" },
      { q: "Beaucoup d'activités gratuites existent, comme la marche ou la course. Pourquoi payer des cours encadrés ?", intentZh: "追问为何不能免费运动替代", level: "clarify" },
      { q: "Si le médecin prescrit du sport, comment vérifier que le patient suit bien les séances et que cela améliore sa santé ?", intentZh: "追问效果评估与监督", level: "challenge" },
      { q: "La nourriture saine aussi protège la santé : faudrait-il demain rembourser les fruits et légumes sur ordonnance ?", intentZh: "类比拓展至公共健康政策", level: "widen" },
      { q: "Dans votre pays, la médecine met-elle davantage l'accent sur la prévention ou sur le traitement ?", intentZh: "拓展至跨文化医疗观对比", level: "widen" },
    ],
    unverified: true,
  },
  {
    id: "s-occasion",
    problematique: "L'essor de l'achat d'occasion favorise-t-il véritablement une consommation responsable, ou entretient-il le goût d'acheter toujours plus ?",
    outline: [
      { zh: "引入与问题", fr: "Les plateformes de seconde main réduisent-elles notre impact écologique ou créent-elles un effet rebond ?" },
      { zh: "环保与省钱", fr: "Prolonger la durée de vie d'un vêtement limite la production de neuf et soulage le budget des ménages." },
      { zh: "隐性消费主义", fr: "Toutefois, les prix bas et la revente facile incitent parfois à renouveler sa garde-robe sans cesse." },
      { zh: "反思总结", fr: "La seconde main n'est vertueuse que si elle se substitue à l'achat neuf, et non si elle s'y additionne." },
    ],
    followUps: [
      { q: "Comment expliquer que certaines personnes achètent davantage depuis qu'elles utilisent des applications de seconde main ?", intentZh: "追问消费心理机制（反弹效应）", level: "clarify" },
      { q: "N'est-ce pas un peu sévère de critiquer ceux qui achètent d'occasion, alors que cela permet au moins d'éviter que des vêtements finissent à la poubelle ?", intentZh: "反驳：二手总比丢弃好", level: "challenge" },
      { q: "Que pensez-vous de l'impact écologique des millions de colis envoyés chaque semaine entre particuliers ?", intentZh: "追问二手平台物流碳排放", level: "challenge" },
      { q: "Acheter d'occasion aide aussi des étudiants ou des familles modestes à s'habiller correctement : cet aspect social ne compte-t-il pas autant que l'écologie ?", intentZh: "引入社会购买力维度", level: "clarify" },
      { q: "Comment encourager les gens à acheter moins de vêtements neufs tout court, au lieu de simplement changer de circuit d'achat ?", intentZh: "追问治本之策", level: "challenge" },
      { q: "Dans le domaine du mobilier ou de l'électronique, retrouve-t-on selon vous le même succès que pour les vêtements ?", intentZh: "拓展至其他消费品类", level: "widen" },
      { q: "Pensez-vous que les grandes marques de prêt-à-porter qui ouvrent des rayons d'occasion le font par conviction ou par marketing ?", intentZh: "拓展至企业漂绿议题", level: "widen" },
    ],
    unverified: true,
  },
  {
    id: "s-tourisme",
    problematique: "Limiter ou faire payer l'accès aux centres historiques est-il une solution juste pour lutter contre le surtourisme ?",
    outline: [
      { zh: "引入与问题", fr: "Comment préserver la qualité de vie des habitants et le patrimoine sans transformer les villes en musées réservés aux plus riches ?" },
      { zh: "限制理由", fr: "Les quotas protègent les monuments fragiles et réduisent les nuisances, la hausse des loyers et la foule." },
      { zh: "负面争议", fr: "En revanche, un droit d'entrée pénalise les visiteurs modestes et peut nuire aux commerçants locaux." },
      { zh: "替代治理", fr: "Il serait préférable de réguler les locations touristiques et de promouvoir des visites hors saison ou dans d'autres quartiers." },
    ],
    followUps: [
      { q: "Quelles conséquences concrètes du surtourisme vous semblent les plus difficiles à supporter pour les habitants ?", intentZh: "追问居民生活具体受影响点", level: "clarify" },
      { q: "Si l'on fait payer dix ou quinze euros pour entrer dans une ville, la culture et le voyage ne risquent-ils pas de devenir un luxe réservé aux plus riches ?", intentZh: "挑战：门票化造成阶级排斥", level: "challenge" },
      { q: "Beaucoup de villes vivent presque uniquement grâce au tourisme. Limiter les visiteurs ne menace-t-il pas des milliers d'emplois locaux ?", intentZh: "反驳：威胁本地就业与经济", level: "challenge" },
      { q: "Comment décider qui a le droit d'entrer lorsqu'un quota journalier est fixé ? N'est-ce pas une organisation très lourde ?", intentZh: "追问限流配额实际操作", level: "clarify" },
      { q: "Au lieu de bloquer les visiteurs, ne faudrait-il pas d'abord interdire les paquebots géants et limiter les meublés touristiques ?", intentZh: "比较结构性治理手段", level: "challenge" },
      { q: "Vous-même, avez-vous déjà changé votre façon de voyager pour éviter les endroits bondés ?", intentZh: "联系个人旅行习惯", level: "widen" },
      { q: "Comment les réseaux sociaux contribuent-ils aujourd'hui à concentrer des foules au même endroit ?", intentZh: "拓展至社交媒体网红打卡效应", level: "widen" },
    ],
    unverified: true,
  },
  {
    id: "s-benevolat",
    problematique: "Rendre obligatoire un service civique ou bénévole pour les jeunes renforce-t-il la solidarité, ou dénature-t-il le sens même de l'engagement ?",
    outline: [
      { zh: "引入与问题", fr: "L'engagement au service de la société doit-il rester un choix libre ou devenir une étape commune imposée à toute une génération ?" },
      { zh: "支持义务制", fr: "Un service commun permet la mixité sociale, développe le sens citoyen et apporte de l'aide aux associations." },
      { zh: "质疑矛盾", fr: "Cependant, un « bénévolat obligatoire » est une contradiction, retarde l'entrée dans la vie active et représente un coût important en matière d'encadrement." },
      { zh: "折中结论", fr: "Plutôt que d'imposer, l'État devrait valoriser le service civique volontaire par des bourses ou des crédits universitaires." },
    ],
    followUps: [
      { q: "Vous parlez de mixité sociale : en quoi quelques mois dans une association permettent-ils vraiment de rapprocher des jeunes de milieux différents ?", intentZh: "追问社会融合机制", level: "clarify" },
      { q: "N'y a-t-il pas une contradiction dans les termes à parler de « bénévolat obligatoire » ? Un jeune forcé peut-il être utile ?", intentZh: "直击核心矛盾：强制志愿", level: "challenge" },
      { q: "Dans les hôpitaux ou les écoles, ne risque-t-on pas d'utiliser ces jeunes comme une main-d'œuvre bon marché à la place de vrais emplois ?", intentZh: "反驳：替代正式岗位的风险", level: "challenge" },
      { q: "Que répondez-vous à un jeune qui doit travailler tout de suite après ses études pour aider sa famille financièrement ?", intentZh: "追问经济困难青年的时间成本", level: "challenge" },
      { q: "Si l'on choisit de rester sur le volontariat, comment convaincre les jeunes qui ne se sentent pas concernés de s'engager ?", intentZh: "追问非强制前提下的激励方式", level: "clarify" },
      { q: "L'école ne devrait-elle pas déjà intégrer ce type d'action locale dès le lycée, plutôt qu'après les études ?", intentZh: "拓展至学校公民教育设计", level: "widen" },
      { q: "Dans votre pays, les jeunes s'engagent-ils facilement dans la vie associative, et pour quelles causes ?", intentZh: "拓展至跨文化青年参与现状", level: "widen" },
    ],
    unverified: true,
  },
];

export const speakingPresetOf = (id: string): SpeakingPreset | undefined =>
  SPEAKING_PRESETS.find((p) => p.id === id);

export const speakingFollowUpsOf = (id: string): string[] =>
  speakingPresetOf(id)?.followUps.map((f) => f.q) ?? [];
