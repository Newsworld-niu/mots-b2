/**
 * 预置题: papers that come with the app, so that 听力理解 and 应试阅读 can be practised without an AI key.
 * Written in the form of the official DELF B2 papers (new format); every person, figure and text is invented.
 * Not yet reviewed by a teacher (待核对), like the other written content of the app.
 */
import { sanitizeExercise, type CompForm } from "./exam";
import type { BankPaper } from "../store/exam-bank";

type RawQ = { q: string; options: [string, string, string]; answer: number; why: string; difficulty: number; skill: string; doc?: number };
type Raw = { form: CompForm; topic: string; intro: string; title: string; docs: string[]; questions: RawQ[] };

const LISTEN_LONG: Raw = {
  form: "long",
  topic: "travail",
  intro: "Vous écoutez une émission à la radio.",
  title: "Les tiers-lieux à la campagne",
  docs: [
    `Hélène Martin : Bonjour à tous et bienvenue dans « Vivre autrement ». Aujourd'hui, on parle des tiers-lieux, ces espaces de travail partagés qui s'installent dans les petites villes. Mon invité est Julien Ferrand, sociologue à l'université de Poitiers, qui vient de publier une enquête sur le sujet. Julien Ferrand, bonjour. D'abord, c'est quoi exactement, un tiers-lieu ?
Julien Ferrand : Bonjour. Alors, euh, un tiers-lieu, c'est… c'est un endroit qui n'est ni la maison ni le bureau de l'entreprise. Concrètement, vous louez un bureau à la journée, vous avez une bonne connexion, une salle de réunion, et surtout, ben, vous avez des gens autour de vous. Dans notre enquête, on en a compté à peu près trois cents dans des communes de moins de dix mille habitants. Y a cinq ans, il y en avait même pas cinquante.
Hélène : Ça a explosé avec le télétravail, j'imagine ?
Julien : Oui, en grande partie. Mais en fait, c'est pas seulement les télétravailleurs. On trouve des artisans, des associations, des jeunes qui créent leur entreprise… Ce qui m'a frappé, c'est que les gens viennent pas d'abord pour l'équipement. Ils viennent pour rompre l'isolement. Beaucoup nous ont dit : « Chez moi, je travaillais bien, mais je parlais plus à personne. »
Hélène : Pardon, mais est-ce que ces lieux sont vraiment rentables ?
Julien : Ben justement, c'est le point faible. La plupart vivent grâce aux subventions des mairies ou de la région. Quand l'aide s'arrête, enfin, quand elle diminue, certains ferment au bout de deux ou trois ans. Ceux qui tiennent, ce sont ceux qui proposent autre chose que des bureaux : un café, des ateliers de réparation, des cours d'informatique pour les personnes âgées… Du coup, ils deviennent un peu la place du village, quoi.
Hélène : Et les habitants qui ne télétravaillent pas, ils s'y sentent les bienvenus ?
Julien : Pas toujours, et il faut le dire. Dans certaines communes, on a entendu des critiques : ce serait un lieu pour les « gens de la ville » arrivés après la crise sanitaire. Le risque, c'est de créer deux populations qui se croisent sans se parler. Les responsables qui réussissent, ce sont ceux qui ont associé les habitants dès le départ, euh, en leur demandant ce dont ils avaient besoin.
Hélène : Pour finir, vous êtes plutôt optimiste ?
Julien : Prudemment optimiste. Ces lieux peuvent redonner vie à des centres-bourgs qui se vidaient. Mais ils ne remplaceront jamais les services publics qui ont disparu, la poste, le médecin… Ça, c'est un autre débat.`,
  ],
  questions: [
    { q: "Julien Ferrand intervient dans l'émission parce qu'il…", options: ["dirige un tiers-lieu à Poitiers.", "a étudié ces espaces dans une enquête.", "conseille les mairies rurales."], answer: 1, why: "主持人介绍他是社会学家，刚发表了关于这个主题的调查。", difficulty: 1, skill: "gist" },
    { q: "Selon l'enquête, le nombre de tiers-lieux dans les petites communes…", options: ["a été multiplié par six environ en cinq ans.", "est resté stable depuis la crise sanitaire.", "a doublé grâce aux artisans."], answer: 0, why: "五年前不到五十个，现在约三百个，约为六倍。", difficulty: 3, skill: "detail" },
    { q: "D'après Julien Ferrand, la principale motivation des usagers est de…", options: ["disposer d'une connexion rapide.", "retrouver une vie sociale au travail.", "réduire leurs frais de bureau."], answer: 1, why: "他说人们首先不是为设备而来，而是为了打破孤独（rompre l'isolement）。", difficulty: 3, skill: "paraphrase" },
    { q: "Quelle est la faiblesse des tiers-lieux, selon le sociologue ?", options: ["Ils dépendent largement de l'argent public.", "Ils attirent trop peu de jeunes.", "Ils sont mal situés dans les villages."], answer: 0, why: "他说大部分靠市政府或大区的补贴生存，补贴减少就会关门。", difficulty: 2, skill: "paraphrase" },
    { q: "Les tiers-lieux qui durent sont ceux qui…", options: ["louent leurs bureaux moins cher.", "diversifient leurs activités.", "accueillent seulement des entreprises."], answer: 1, why: "坚持下来的是提供咖啡馆、维修工坊、电脑课等其他服务的地方。", difficulty: 3, skill: "paraphrase" },
    { q: "Quand il parle des critiques de certains habitants, Julien Ferrand…", options: ["les juge sans fondement.", "reconnaît qu'elles posent un vrai problème.", "refuse de les commenter."], answer: 1, why: "他说「Pas toujours, et il faut le dire」，承认存在形成两类居民的风险。", difficulty: 4, skill: "opinion" },
    { q: "On peut comprendre que, pour Julien Ferrand, les tiers-lieux…", options: ["ne compensent pas la fermeture des services publics.", "vont remplacer la poste dans les villages.", "doivent être réservés aux télétravailleurs."], answer: 0, why: "结尾说它们永远替代不了消失的公共服务（邮局、医生）。", difficulty: 5, skill: "inference" },
  ],
};

const LISTEN_SHORT: Raw = {
  form: "short",
  topic: "environnement",
  intro: "Vous allez écouter trois documents sonores. Vous n'entendrez chaque document qu'une seule fois.",
  title: "Consommer moins d'eau",
  docs: [
    `Présentatrice : Dans le sud de la France, les restrictions d'eau deviennent fréquentes l'été. Nadia Roussel est maire d'un village de l'Hérault.
Nadia Roussel : Cette année, on a interdit l'arrosage des jardins de 8 heures à 20 heures dès le mois de juin. Au début, les habitants étaient mécontents, je les comprends. Mais on a organisé des réunions pour expliquer la situation des nappes, et finalement la consommation a baissé de près de vingt pour cent. Ce qui a le plus convaincu les gens, ce n'est pas l'amende, c'est de voir les chiffres de la rivière chaque semaine dans le bulletin municipal.`,
    `Thomas Leroy : Je suis agriculteur près de Valence. Depuis trois ans, j'arrose mes vergers au goutte-à-goutte, avec des capteurs qui mesurent l'humidité du sol. L'installation m'a coûté cher, et sans l'aide de l'agence de l'eau, je n'aurais pas pu la payer. Mais aujourd'hui j'utilise à peu près un tiers d'eau en moins. Le problème, c'est que mes voisins, qui ont de plus petites exploitations, n'ont pas les moyens d'investir, même avec une aide. Il faudrait que les coopératives achètent ce matériel ensemble.`,
    `Présentateur : Faut-il augmenter le prix de l'eau pour qu'on en consomme moins ? L'économiste Claire Duval répond.
Claire Duval : Une hausse générale serait injuste, parce que les familles modestes paieraient autant que les autres pour un besoin vital. En revanche, une tarification progressive me paraît intéressante : les premiers mètres cubes, ceux qui servent à boire et à se laver, resteraient bon marché, et on paierait plus cher au-delà, pour remplir une piscine par exemple. Quelques villes l'ont déjà adoptée, avec des résultats encourageants.`,
  ],
  questions: [
    { doc: 0, q: "Selon la maire, la baisse de consommation s'explique surtout par…", options: ["la crainte des sanctions.", "l'information régulière des habitants.", "la fermeture des jardins publics."], answer: 1, why: "她说最能说服居民的不是罚款，而是每周在市政公报上看到河流的数据。", difficulty: 3, skill: "paraphrase" },
    { doc: 0, q: "Au départ, les habitants ont accueilli la mesure…", options: ["avec indifférence.", "avec enthousiasme.", "avec mécontentement."], answer: 2, why: "« Au début, les habitants étaient mécontents »。", difficulty: 1, skill: "detail" },
    { doc: 1, q: "Grâce à son nouveau système, Thomas Leroy…", options: ["consomme environ 30 % d'eau en moins.", "a doublé sa production de fruits.", "n'arrose plus que la nuit."], answer: 0, why: "« à peu près un tiers d'eau en moins »，约三成。", difficulty: 2, skill: "detail" },
    { doc: 1, q: "Que propose l'agriculteur pour ses voisins ?", options: ["Une aide plus importante de l'État.", "Un achat collectif du matériel.", "Un partage de leurs terres."], answer: 1, why: "他说合作社应该一起购买这些设备。", difficulty: 3, skill: "paraphrase" },
    { doc: 2, q: "Claire Duval s'oppose à une hausse générale du prix de l'eau parce qu'elle…", options: ["ne réduirait pas la consommation.", "pénaliserait les ménages aux revenus faibles.", "coûterait trop cher aux communes."], answer: 1, why: "她说普遍涨价不公平，收入低的家庭为基本需求付同样的钱。", difficulty: 3, skill: "paraphrase" },
    { doc: 2, q: "Avec la tarification progressive, l'eau…", options: ["coûte plus cher pour les usages non essentiels.", "est gratuite pour les familles nombreuses.", "a le même prix pour tout le monde."], answer: 0, why: "最初的用量便宜，超出部分（如游泳池）更贵。", difficulty: 4, skill: "inference" },
  ],
};

const READ_LONG: Raw = {
  form: "long",
  topic: "education",
  intro: "Dans un magazine francophone, vous lisez un article sur l'apprentissage des langues à l'école.",
  title: "Apprendre une langue avec une application : le pari de certains collèges",
  docs: [
    `Depuis la rentrée, une quarantaine de collèges de la région Grand Est testent une application d'apprentissage de l'anglais. Les élèves de cinquième l'utilisent vingt minutes par jour, en classe ou chez eux, en plus des cours habituels. L'objectif affiché du rectorat est clair : augmenter le temps d'exposition à la langue sans alourdir les emplois du temps.
Les premiers résultats, publiés en mars, semblent encourageants. Selon l'évaluation menée par l'académie, les élèves qui ont utilisé l'application régulièrement ont progressé de manière plus nette en compréhension orale que ceux des collèges témoins. « Ils entendent de l'anglais tous les jours, et pas seulement pendant les trois heures de cours », résume Marc Olivier, inspecteur pédagogique.
Mais les écarts restent importants. Près d'un élève sur trois n'a presque jamais ouvert l'application en dehors de la classe. Pour Sophie Bernard, professeure d'anglais à Metz, ce chiffre n'a rien de surprenant : « Les élèves qui travaillent seuls chez eux sont ceux qui étaient déjà motivés. L'outil ne crée pas la motivation, il la récompense. »
D'autres enseignants s'inquiètent de la place prise par les écrans. Les exercices de l'application, très courts, reposent surtout sur la reconnaissance de mots et de phrases toutes faites. « On apprend à répondre vite, pas à construire une pensée en anglais », regrette Sophie Bernard, qui craint que l'expression orale, déjà peu pratiquée, recule encore.
Le rectorat ne nie pas ces limites. Il insiste sur le fait que l'application ne doit pas remplacer le professeur, mais lui fournir des données : chaque enseignant peut voir les erreurs les plus fréquentes de sa classe et adapter ses séances. Certains l'utilisent déjà pour former des groupes de niveau.
Reste la question du coût. La licence est payée par la région pour deux ans seulement. Si l'expérience est prolongée, il faudra décider qui finance, et sur quels critères on jugera qu'elle a réussi. Pour l'instant, aucune évaluation n'a porté sur l'expression écrite ou orale.`,
  ],
  questions: [
    { q: "L'article présente surtout…", options: ["une expérience pédagogique et ses premiers bilans.", "une réforme nationale des programmes d'anglais.", "la création d'une application par des enseignants."], answer: 0, why: "全文介绍大东部地区约四十所初中试用应用的实验及初步结果。", difficulty: 2, skill: "gist" },
    { q: "Le rectorat veut, avec cette application,…", options: ["réduire le nombre d'heures d'anglais.", "faire entendre davantage la langue aux élèves.", "remplacer les devoirs écrits."], answer: 1, why: "目标是增加接触语言的时间（temps d'exposition）而不加重课表。", difficulty: 3, skill: "paraphrase" },
    { q: "D'après l'évaluation de l'académie, les élèves ont surtout progressé en…", options: ["expression écrite.", "grammaire.", "compréhension de l'oral."], answer: 2, why: "第二段：compréhension orale 进步更明显。", difficulty: 1, skill: "detail" },
    { q: "Pour Sophie Bernard, le fait qu'un tiers des élèves n'utilise pas l'application chez soi…", options: ["était prévisible.", "s'explique par un manque d'équipement.", "va diminuer avec le temps."], answer: 0, why: "她说这个数字「n'a rien de surprenant」，因为自学的本来就是有动力的学生。", difficulty: 3, skill: "opinion" },
    { q: "Ce que Sophie Bernard reproche aux exercices, c'est qu'ils…", options: ["sont trop difficiles pour des élèves de cinquième.", "ne développent pas la capacité à s'exprimer.", "prennent trop de temps en classe."], answer: 1, why: "她说学生学会快速回答，而不是用英语组织思想，担心口语表达更加退步。", difficulty: 4, skill: "paraphrase" },
    { q: "Selon le rectorat, l'application sert aussi aux professeurs à…", options: ["noter automatiquement les élèves.", "préparer leurs cours à la maison.", "repérer les difficultés de leurs élèves."], answer: 2, why: "老师可以看到全班最常见的错误并调整课程。", difficulty: 3, skill: "detail" },
    { q: "On peut déduire de la fin de l'article que…", options: ["l'avenir de l'expérience est encore incertain.", "la région a décidé de généraliser l'outil.", "les familles devront payer la licence."], answer: 0, why: "许可只付两年，延续的话谁出钱、按什么标准判断成功都未定。", difficulty: 5, skill: "inference" },
  ],
};

const READ_OPINIONS: Raw = {
  form: "opinions",
  topic: "numerique",
  intro: "Vous lisez l'opinion de ces trois personnes sur un forum consacré à la vie numérique.",
  title: "Faut-il limiter le temps passé sur les écrans pendant les vacances ?",
  docs: [
    `Camille
Pendant l'année, je surveille beaucoup le temps d'écran de mes enfants, mais en vacances je relâche un peu. Je crois que des règles trop strictes rendent les écrans encore plus désirables. Ce qui compte pour moi, c'est qu'ils aient d'autres activités qui leur plaisent vraiment : quand ils passent la journée au lac, ils oublient leur téléphone tout seuls. Interdire, c'est facile ; proposer autre chose demande plus d'efforts, mais ça marche mieux.
Rachid
Je ne suis pas pour une limite en heures, parce que tout ne se vaut pas : regarder des vidéos pendant trois heures, ce n'est pas la même chose que monter un petit film avec ses cousins. En revanche, j'ai une règle simple : pas d'écran pendant les repas ni dans les chambres le soir. Les vacances sont le moment où la famille est enfin réunie, et je ne veux pas que chacun reste dans son coin.
Élodie
Honnêtement, je pense que les parents devraient d'abord se regarder eux-mêmes. Mes enfants me reprochent souvent de lire mes courriels professionnels à la plage. Depuis l'été dernier, je laisse mon téléphone à la maison une journée par semaine, et toute la famille le fait avec moi. Au début, c'était difficile ; maintenant, c'est devenu notre journée préférée. On ne peut pas demander aux enfants ce qu'on n'est pas capable de faire.`,
  ],
  questions: [
    { q: "Cette personne pense que des interdictions trop sévères peuvent avoir l'effet inverse.", options: ["Camille", "Rachid", "Élodie"], answer: 0, why: "Camille：规则太严反而让屏幕更有吸引力。", difficulty: 3, skill: "paraphrase" },
    { q: "Pour cette personne, la qualité de l'activité sur écran importe plus que sa durée.", options: ["Camille", "Rachid", "Élodie"], answer: 1, why: "Rachid：看三小时视频和和表兄弟一起剪片子不一样。", difficulty: 3, skill: "paraphrase" },
    { q: "Cette personne estime que l'exemple des adultes est essentiel.", options: ["Camille", "Rachid", "Élodie"], answer: 2, why: "Élodie：父母应该先看看自己，不能要求孩子做自己做不到的事。", difficulty: 2, skill: "opinion" },
    { q: "Cette personne fixe des moments et des lieux sans écran.", options: ["Camille", "Rachid", "Élodie"], answer: 1, why: "Rachid：吃饭时、晚上卧室里不许用屏幕。", difficulty: 2, skill: "detail" },
    { q: "Selon cette personne, offrir des occupations attrayantes suffit souvent à éloigner les enfants des écrans.", options: ["Camille", "Rachid", "Élodie"], answer: 0, why: "Camille：孩子在湖边玩一天就自己忘了手机。", difficulty: 4, skill: "inference" },
    { q: "Cette personne a changé ses propres habitudes avec toute sa famille.", options: ["Camille", "Rachid", "Élodie"], answer: 2, why: "Élodie：每周一天把手机留在家里，全家都这样做。", difficulty: 3, skill: "paraphrase" },
  ],
};

const paper = (id: string, kind: BankPaper["kind"], raw: Raw, style?: "radio" | "natural"): BankPaper => ({
  id,
  kind,
  level: "B2",
  created: 0,
  src: "preset",
  ...(style ? { style } : {}),
  exs: [sanitizeExercise({ ...raw, docs: raw.docs.map((text) => ({ text, zh: "" })) }, raw.form, raw.topic)],
});

export const PRESET_PAPERS: BankPaper[] = [
  paper("preset-listen-1", "listen", LISTEN_LONG, "natural"),
  paper("preset-listen-2", "listen", LISTEN_SHORT, "radio"),
  paper("preset-read-1", "read", READ_LONG),
  paper("preset-read-2", "read", READ_OPINIONS),
];
