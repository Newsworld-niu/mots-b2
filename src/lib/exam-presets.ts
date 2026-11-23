/**
 * 预置题: full 25-point papers that come with the app, so that 听力理解 and 应试阅读 can be practised
 * completely offline without an AI key (5 full listening papers + 5 full reading papers, 25 points each).
 * Written in the post-2020 official DELF B2 100% 3-option QCM format; every person, figure and text is invented.
 * Cross-reviewed for French quality, yet still marked as unverified by an official examiner (待核对).
 */
import { sanitizeExercise, type CompForm } from "./exam";
import type { BankPaper } from "../store/exam-bank";

type RawQ = {
  q: string;
  qType?: "qcm" | "vf" | "short";
  options: string[];
  answer: number;
  quote?: string;
  accepted?: string[];
  evidence?: string;
  trapTypes?: string[];
  why: string;
  difficulty: number;
  skill: string;
  doc?: number;
};
type RawDoc = { text: string; zh: string; audioUrl?: string };
type Raw = { form: CompForm; topic: string; intro: string; title: string; docs: RawDoc[]; questions: RawQ[] };

/* ==================== 听力整套 1（25 分 · 口语化自然语流） ==================== */

const L1_LONG_1: Raw = {
  form: "long",
  topic: "travail",
  intro: "Vous écoutez une émission à la radio.",
  title: "Les tiers-lieux à la campagne",
  docs: [
    {
      text: `Hélène Martin : Bonjour à tous et bienvenue dans « Vivre autrement ». Aujourd'hui, on s'intéresse aux tiers-lieux, ces espaces de travail partagés qui s'installent dans les petites villes et les villages. Mon invité est Julien Ferrand, sociologue à l'université de Poitiers, qui vient de publier une grande enquête sur le sujet. Julien Ferrand, bonjour. D'abord, c'est quoi exactement, un tiers-lieu ?
Julien Ferrand : Bonjour. Alors, euh, un tiers-lieu, c'est… c'est un endroit qui n'est ni la maison ni le bureau classique de l'entreprise. Concrètement, vous louez un poste de travail à la journée ou au mois, vous disposez d'une connexion fibre fiable, d'une salle de réunion équipée et surtout, ben, vous avez des gens autour de vous. Dans notre enquête menée sur trois ans, on en a recensé environ trois cents dans des communes de moins de dix mille habitants. Y a cinq ans, il y en avait même pas cinquante sur tout le territoire.
Hélène Martin : Ça a explosé avec le développement du télétravail, j'imagine ?
Julien Ferrand : Oui, en grande partie, c'est indéniable. Mais en fait, ce n'est pas seulement pour les salariés à distance. On trouve aussi des artisans, des responsables d'associations, des jeunes qui lancent leur petite entreprise ou des étudiants qui révisent. Ce qui m'a le plus frappé dans nos entretiens, c'est que les usagers ne viennent pas d'abord pour l'imprimante ou le café gratuit. Ils viennent avant tout pour rompre l'isolement. Beaucoup nous ont confié : « Chez moi, j'avançais vite sur mes dossiers, mais au bout de trois mois je ne parlais plus à personne de toute la semaine. »
Hélène Martin : Pardon, mais est-ce que ces structures sont vraiment rentables ?
Julien Ferrand : Ben justement, c'est là que le bât blesse. La grande majorité vivent grâce aux subventions des mairies ou de la région. Quand l'aide s'arrête, enfin, quand elle diminue après le lancement, certains ferment au bout de deux ou trois ans faute de recettes. Ceux qui tiennent bon sont ceux qui proposent autre chose que des bureaux : un café associatif, des ateliers de réparation, des permanences administratives ou des cours d'informatique pour les personnes âgées. Du coup, ils deviennent un peu la nouvelle place du village, quoi.
Hélène Martin : Et les habitants qui ne télétravaillent pas, ils s'y sentent les bienvenus ?
Julien Ferrand : Pas toujours, et il faut le dire. Dans certaines communes rurales, on a recueilli des critiques assez vives : ce serait un lieu réservé aux « gens des grandes villes » arrivés après la crise sanitaire, avec parfois des tarifs trop élevés. Le risque, c'est de créer deux populations qui se croisent sans jamais se parler. Les responsables qui réussissent sont ceux qui ont associé les habitants et les commerçants locaux dès le départ, euh, en leur demandant ce dont ils avaient besoin.
Hélène Martin : Pour finir, vous êtes plutôt optimiste ?
Julien Ferrand : Prudemment optimiste. Ces lieux peuvent redonner du souffle à des centres-bourgs qui se vidaient peu à peu. Mais ils ne remplaceront jamais les services publics qui ont fermé, la poste, l'école ou le médecin… Ça, c'est un autre débat.`,
      zh: `Hélène Martin：大家好，欢迎收听《换种方式生活》。今天我们关注第三空间，也就是出现在小城镇和乡村里的共享办公场所。做客节目的是普瓦捷大学社会学家 Julien Ferrand，他刚发表了一项关于这个主题的大型调查。Julien Ferrand 您好。首先，究竟什么是第三空间？
Julien Ferrand：您好。呃，第三空间就是……一个既不是家里也不是传统公司办公室的地方。具体来说，你可以按天或按月租一个工位，有稳定的光纤网络、配备齐全的会议室，最重要的是，嗯，你身边有其他人。在我们历时三年的调查中，我们在不足一万居民的市镇统计到了大约三百个这样的场所。五年前全国还不到五十个。
Hélène Martin：我猜这随着远程办公的普及一下子爆发了吧？
Julien Ferrand：是的，很大程度上是这样，这毫无疑问。但其实不只是远程上班族。里面还有手工业者、社团负责人、创业的年轻人或复习功课的大学生。在访谈中最让我惊讶的是，使用者最初并不是为了打印机或免费咖啡而来的。他们主要是为了打破孤立感。很多人向我们坦言：“在家我处理文件很快，但三个月后我整整一周都不跟任何人说话。”
Hélène Martin：打断一下，这些机构在财务上真的能盈利吗？
Julien Ferrand：嗯，问题恰恰就出在这里。绝大多数这类空间依靠市政府、省或大区的补贴维持运营。一旦公共资助停止——准确地说是在启动期之后减少——有些空间由于收入不足，两三年后就关门了。能够长期坚持下来的，是那些不仅提供单纯办公桌的地方：比如社区咖啡馆、自行车维修工坊、行政代办服务或面向老年人的电脑课。这样一来，它们就有点像村里的新广场了。
Hélène Martin：那那些并不远程办公的本地居民，会觉得自己在那里受欢迎吗？
Julien Ferrand：并不总是如此，这点必须诚实地说出来。在一些乡村市镇，我们听到了相当尖锐的批评：有人认为这是疫情后“从大城市搬来的人”专属的地方，带着他们的习惯，有时收费也太高。真正的风险在于形成两类比邻而居却互不交谈的人群。真正成功融入当地的负责人，都是从项目设计之初就把居民和本地商户拉进来，呃，实实在在地询问他们真正需要什么。
Hélène Martin：最后，在这项研究结束时，您整体偏乐观还是偏担忧？
Julien Ferrand：谨慎乐观。这些场所能为逐渐空心化的小镇中心重新注入活力。但它们永远无法替代已经关闭的基层公共服务，比如邮局、学校或诊所……这完全是另一个层面的问题了。`,
      audioUrl: "materials/co/preset-listen-1-e1-d1.mp3",
    },
  ],
  questions: [
    { q: "Julien Ferrand intervient dans l'émission parce qu'il…", options: ["dirige un espace partagé à Poitiers.", "vient de mener une étude sur ces lieux.", "conseille les élus locaux sur le budget."], answer: 1, why: "主持人介绍他是社会学家，刚发表了关于第三空间的大型调查。", difficulty: 1, skill: "gist" },
    { q: "Selon l'enquête, le nombre de tiers-lieux dans les petites communes…", options: ["a été multiplié par six environ en cinq ans.", "est resté stable malgré le télétravail.", "a doublé grâce aux artisans locaux."], answer: 0, why: "五年前不到五十个，如今约三百个，增长约六倍。", difficulty: 3, skill: "detail" },
    { q: "D'après le sociologue, les usagers choisissent d'abord ces espaces pour…", options: ["bénéficier d'un équipement moderne.", "retrouver une présence humaine au travail.", "faire des économies sur leur loyer."], answer: 1, why: "他说人们主要不是为了设备而来，而是为了打破孤立（rompre l'isolement），身边有其他人。", difficulty: 3, skill: "paraphrase" },
    { q: "Quelle est la principale fragilité des tiers-lieux ?", options: ["Ils dépendent fortement des aides publiques.", "Ils manquent de connexions internet fiables.", "Ils sont trop éloignés des centres-bourgs."], answer: 0, why: "他说绝大多数依靠市政、省或大区的补贴生存，补贴减少后不少会关闭。", difficulty: 2, skill: "paraphrase" },
    { q: "Les espaces qui parviennent à durer sont ceux qui…", options: ["limitent l'accès aux seuls télétravailleurs.", "ouvrent des activités utiles à toute la vie locale.", "réduisent leurs horaires pendant l'hiver."], answer: 1, why: "持久的是提供咖啡馆、修车工坊、老年人电脑课等多元社区服务的场所。", difficulty: 3, skill: "paraphrase" },
    { q: "Face aux critiques de certains habitants, Julien Ferrand…", options: ["estime qu'elles sont exagérées.", "reconnaît un véritable risque de coupure sociale.", "refuse de prendre position."], answer: 1, why: "他坦言确实存在两类居民互不交流的风险，呼吁项目一开始就让当地人参与。", difficulty: 4, skill: "opinion" },
    { q: "On comprend en fin d'émission que, pour Julien Ferrand, ces lieux…", options: ["ne sauraient compenser la perte des services essentiels.", "vont bientôt remplacer la poste et les écoles.", "ne survivent que dans les grandes agglomérations."], answer: 0, why: "结尾明确指出它们永远替代不了关闭的邮局、学校和诊所等公共服务。", difficulty: 5, skill: "inference" },
  ],
};

const L1_LONG_2: Raw = {
  form: "long",
  topic: "numerique",
  intro: "Vous écoutez un débat à la radio sur l'école et le numérique.",
  title: "L'intelligence artificielle en classe : aide ou piège ?",
  docs: [
    {
      text: `Marc Lefèvre : Bonsoir à toutes et à tous. Ce soir dans « École en question », nous parlons d'un sujet qui agite les salles des professeurs depuis deux ans : l'usage de l'intelligence artificielle par les lycéens et les étudiants. Pour en débattre, je reçois Claire Bonnet, professeure de lettres à Nantes, et Driss Benali, chercheur en sciences de l'éducation. Claire Bonnet, vous avez récemment interdit ces outils pour les devoirs à la maison. Pourquoi une décision aussi ferme ?
Claire Bonnet : Bonsoir. Ben, en fait, j'ai pris cette décision après avoir reçu dix dissertations presque identiques sur un roman de Balzac. Quand un élève fait rédiger son devoir par un logiciel en trente secondes, il ne cherche plus ses idées, il n'apprend plus à construire un paragraphe ni à douter devant une phrase difficile. En gros, il contourne l'effort qui fait justement progresser. Du coup, j'ai préféré supprimer les rédactions notées à la maison et tout faire écrire en classe, sur papier.
Driss Benali : Pardon, mais je trouve cette interdiction un peu illusoire, Claire. Même si vous notez uniquement sur table, vos élèves rentrent chez eux le soir avec leur téléphone dans la poche. À mon avis, fermer la porte ne leur apprend pas à garder une distance critique. Dans nos observations au laboratoire, les lycéens qui comprennent comment fonctionne l'outil savent repérer ses erreurs factuelles et ses formules creuses. Ceux à qui personne n'en parle l'utilisent en cachette et copient les fautes les yeux fermés.
Claire Bonnet : Attendez, Driss, je dis pas qu'il faut ignorer l'existence de ces programmes ! En cours, j'ai déjà montré à ma classe un texte généré automatiquement pour qu'on analyse ensemble ses limites et ses répétitions. Mais entre analyser une machine pendant vingt minutes et confier son propre travail d'écriture à un algorithme, y a un monde. On ne devient pas musicien en écoutant un disque à sa place.
Marc Lefèvre : Driss Benali, comment répondre à cette comparaison ? L'IA ne risque-t-elle pas d'affaiblir le niveau d'écriture des jeunes ?
Driss Benali : C'est un vrai danger, euh, je le nie pas du tout. Si l'on demande à l'élève de produire un texte final parfait, la tentation de tricher est énorme. En revanche, on peut complètement changer la consigne : demander aux jeunes de comparer deux brouillons, de vérifier trois sources historiques, ou d'expliquer à l'oral pourquoi ils ont corrigé telle phrase proposée par la machine. Là, on ne juge plus seulement le produit fini, on évalue le raisonnement.
Claire Bonnet : Sur le papier, ça paraît séduisant, mais dans les faits, avec trente-cinq élèves par classe et quatre heures de français par semaine, qui a le temps de mener des entretiens oraux individuels pour chaque devoir ? Sans moyens supplémentaires ni formation sérieuse des enseignants, on nous demande encore de régler seuls un bouleversement technique.
Marc Lefèvre : Justement, l'accompagnement des équipes reste le grand oublié de cette transition. Merci à tous les deux pour cet échange très éclairant.`,
      zh: `Marc Lefèvre：大家晚上好。今晚在《学校大讨论》中，我们谈论一个两年来让教师办公室议论纷纷的话题：高中生和大学生使用人工智能做作业。为此，我请到了南特的文学教师 Claire Bonnet，以及教育科学研究员 Driss Benali。Claire Bonnet，您最近禁止学生在家庭作业中使用这类工具。为什么做出如此坚决的决定？
Claire Bonnet：晚上好。嗯，其实我做出这个决定，是因为我收到过十篇关于巴尔扎克小说的几乎一模一样的作文。当学生三十秒就让软件写出作业时，他不再去思考观点，也不再学习组织段落或推敲难句。说白了，他绕过了恰恰能让人进步的那份努力。于是，我宁愿取消带回家的评分作文，全部改在课堂上用纸笔写。
Driss Benali：抱歉，但我觉得这种禁令有点不切实际，Claire。哪怕您只在课堂上打分，您的学生晚上还是揣着手机回家的。在我看来，关上门并不能教会他们保持批判性距离。在我们实验室的观察中，了解工具原理的高中生反而能看出它的事实错误和空洞套话；而没人指导的学生会偷偷使用，并闭着眼睛照抄其中的错误。
Claire Bonnet：等等，Driss，我并不是说要无视这些程序的存在！在课堂上，我早就给全班展示过自动生成的文章，让大家一起分析它的局限和重复。但用二十分钟分析机器，和把自己的写作任务交给算法，完全是两码事。光靠听别人替你放唱片是成不了音乐家的。
Marc Lefèvre：Driss Benali，您怎么回应这个比喻？人工智能难道不会削弱年轻人的写作水平吗？
Driss Benali：这确实是个真实的风险，呃，我完全不否认。如果只要求学生交出一篇完美的终稿，作弊的诱惑就太大了。不过我们可以彻底改变作业要求：让学生比较两份草稿、核实三个历史信源，或者口头解释为什么要修改机器给出的某句话。这样一来，考查的就不只是成品，而是推理过程。
Claire Bonnet：听上去很美，但现实中一个班三十五名学生、每周四节法语课，谁有时间给每份作业做一对一口试？既不增加资源也不认真培训教师，又要让我们独自应对一场技术剧变。
Marc Lefèvre：说得对，对教师团队的支持始终是这场转型中被遗忘的一环。感谢两位带来非常具有启发性的交流。`,
      audioUrl: "materials/co/preset-listen-1-e2-d1.mp3",
    },
  ],
  questions: [
    { q: "Claire Bonnet a décidé d'interdire les devoirs rédigés à la maison parce qu'elle…", options: ["manquait de temps pour corriger ses copies.", "a découvert des textes presque semblables entre élèves.", "voulait réduire l'usage des cahiers numériques."], answer: 1, why: "她收到十篇几乎完全一样的巴尔扎克小说论文后做出了该决定。", difficulty: 1, skill: "detail" },
    { q: "Selon Claire Bonnet, recourir à l'IA pour écrire empêche l'élève de…", options: ["lire les œuvres complètes au programme.", "fournir l'effort intellectuel qui fait progresser.", "terminer son travail dans les délais prévus."], answer: 1, why: "她说绕过了努力（contourne l'effort），无法学会思考与组织段落。", difficulty: 2, skill: "paraphrase" },
    { q: "Que reproche Driss Benali à une interdiction stricte ?", options: ["Elle pénalise les élèves qui n'ont pas d'ordinateur.", "Elle ne prépare pas les jeunes à analyser l'outil.", "Elle viole les règlements du ministère."], answer: 1, why: "他认为关上门教不会学生保持批判性距离，反而会让他们盲目照抄。", difficulty: 3, skill: "opinion" },
    { q: "En classe, Claire Bonnet accepte malgré tout de…", options: ["laisser les élèves corriger leurs fautes avec un logiciel.", "examiner les défauts d'un texte produit par une machine.", "noter uniquement les exercices faits en groupe."], answer: 1, why: "她提到在课堂上曾展示机器生成的文章，和学生一起分析其中的局限和重复。", difficulty: 3, skill: "detail" },
    { q: "D'après Driss Benali, comment l'enseignant devrait-il évaluer les élèves ?", options: ["En s'intéressant davantage à leur démarche qu'au texte final.", "En interdisant les téléphones dans tout le lycée.", "En donnant la même note à l'oral et à l'écrit."], answer: 0, why: "他主张考查比较草稿、核查资料或口头解释理由的推理过程（raisonnement），而非只看成品。", difficulty: 3, skill: "paraphrase" },
    { q: "À la fin du débat, Claire Bonnet exprime surtout…", options: ["son enthousiasme pour les entretiens individuels.", "son scepticisme face au manque de moyens sur le terrain.", "son refus de participer aux prochaines formations."], answer: 1, why: "她指出35人的大班、没有额外资源和培训，让理想方案在现实中难以落地。", difficulty: 4, skill: "opinion" },
    { q: "Que laisse entendre le présentateur en guise de conclusion ?", options: ["Les enseignants ne sont pas assez soutenus dans ce changement.", "L'intelligence artificielle va remplacer les professeurs de lettres.", "Le ministère prépare l'interdiction totale des téléphones."], answer: 0, why: "主持人总结道对教师团队的配套支持（accompagnement）一直是被遗忘的一环。", difficulty: 5, skill: "inference" },
  ],
};

const L1_SHORT: Raw = {
  form: "short",
  topic: "environnement",
  intro: "Vous allez écouter trois documents sonores. Vous n'entendrez chaque document qu'une seule fois.",
  title: "Consommer moins d'eau",
  docs: [
    {
      text: `Présentatrice : Dans le sud de la France, les restrictions d'eau deviennent de plus en plus fréquentes dès le printemps. Nadia Roussel est maire d'un village de l'Hérault qui a réussi à réduire fortement sa consommation sans créer de conflit durable.
Nadia Roussel : Cette année, face à la sécheresse précoce et au niveau déjà bas des cours d'eau, on a dû interdire l'arrosage des jardins et le remplissage des piscines de huit heures à vingt heures dès le mois de juin. Au début, beaucoup d'habitants étaient vraiment mécontents, je les comprends tout à fait : certains venaient juste de planter des légumes ou d'accueillir leurs petits-enfants. Du coup, au lieu d'envoyer seulement la police municipale distribuer des contraventions, on a organisé trois réunions publiques avec des hydrologues du département pour expliquer la situation réelle des nappes souterraines et partager des gestes simples. Finalement, en deux mois, la consommation du village a baissé de près de vingt pour cent. Ce qui a le plus convaincu les gens, ce n'est pas la peur de l'amende, c'est de voir chaque semaine les chiffres précis de la rivière affichés dans le bulletin municipal et devant la mairie.`,
      zh: `主持人：在法国南部，从春季开始限水变得越来越常见。Nadia Roussel 是埃罗省一座村庄的镇长，该村成功大幅降低了用水量而未引发长期对立。
Nadia Roussel：今年面对提前到来的干旱以及本就偏低的河流水位，我们不得不从六月起禁止在早八点到晚八点期间浇灌花园和给泳池注水。起初很多居民确实非常不满，我完全理解他们：有些人刚种下蔬菜，或者正迎接孙辈来住。因此，我们没有只派市政警察开罚单，而是联合省水文专家组织了三次公开会议，说明地下含水层的真实状况并分享省水小窍门。最终两个月内，全村用水量下降了近百分之二十。最能说服大家的不是对罚款的恐惧，而是每周在市政公报和镇政府门口看到精确的河流水位数据。`,
      audioUrl: "materials/co/preset-listen-1-e3-d1.mp3",
    },
    {
      text: `Thomas Leroy : Je suis arboriculteur près de Valence, dans la vallée du Rhône, où je cultive surtout des pêchers et des abricotiers sur une vingtaine d'hectares. Depuis trois ans, j'ai abandonné l'arrosage classique par aspersion, qui perdait beaucoup d'eau par évaporation sous le vent, pour passer au goutte-à-goutte enterré, piloté par de petits capteurs qui mesurent chaque heure l'humidité exacte du sol et la température au niveau des racines. Bien sûr, l'installation complète m'a coûté très cher au départ, près de quarante mille euros, et sans une subvention importante de l'agence de l'eau ainsi qu'un soutien de la région, je n'aurais jamais eu les moyens de la payer seul. Mais aujourd'hui, le bilan est clair : j'utilise à peu près un tiers d'eau en moins tout en gardant des fruits de même qualité et de même calibre. Le vrai souci, c'est que mes voisins, qui dirigent de plus petites exploitations familiales, hésitent encore à investir malgré une aide publique. Selon moi, il faudrait que les coopératives agricoles achètent et entretiennent ce matériel ensemble pour partager les frais et le savoir-faire technique.`,
      zh: `Thomas Leroy：我在罗讷河谷的瓦朗斯附近种果树，大约二十公顷地里主要种桃树和杏树。三年前，我放弃了在风吹日晒下水分蒸发极多的传统喷灌，改用地下滴灌系统，由小型传感器每小时精确监测土壤湿度以及根系层的温度。当然，整套设备起初花了我将近四万欧元，要是没有流域水务局的大额补贴和大区的支持，我一个人根本负担不起。但如今账目非常清楚：我节省了大约三分之一的用水，同时保持了同等的果实品质和果径。真正的难题在于，我那些经营较小家庭农场的邻居即使有公共补助也仍不敢投资。在我看来，农业合作社应该联合购买并维护这些设备，共同分摊费用和技术经验。`,
      audioUrl: "materials/co/preset-listen-1-e3-d2.mp3",
    },
    {
      text: `Présentateur : Faut-il augmenter fortement le prix du mètre cube d'eau pour obliger les citoyens à moins gaspiller pendant l'été ? L'économiste de l'environnement Claire Duval nous livre son analyse.
Claire Duval : À mon sens, une hausse générale et uniforme du tarif serait profondément injuste sur le plan social, parce que les familles aux revenus modestes paieraient exactement autant que les ménages les plus aisés pour un besoin vital auquel personne ne peut renoncer. En revanche, une tarification progressive me paraît beaucoup plus pertinente et efficace : les premiers mètres cubes, ceux qui servent tout simplement à boire, à cuisiner, à faire la lessive et à se laver au quotidien, resteraient à un prix très bas, voire symbolique, comme c'est déjà le cas dans certaines communes solidaires. Pour freiner les abus, on ferait payer beaucoup plus cher les tranches suivantes, par exemple pour laver plusieurs voitures, arroser une grande pelouse verte en plein mois d'août ou remplir une piscine privée. Plusieurs métropoles françaises l'ont déjà expérimentée sur plusieurs années, avec des résultats vraiment encourageants sur les pics de consommation estivaux sans pénaliser les foyers vulnérables.`,
      zh: `主持人：是否应该大幅提高每立方米水价，迫使居民在夏季减少浪费？环境经济学家 Claire Duval 为我们作出分析。
Claire Duval：在我看来，全面统一的涨价在社会层面极其不公平，因为对于饮用和基本生活这种谁都无法放弃的刚需，低收入家庭要和最富裕的家庭付完全一样的钱。相反，阶梯水价显得合理且有效得多：最初几立方米——仅仅用于日常饮水、做饭、洗衣和洗漱的部分——应维持极低甚至象征性的价格，正如部分互助型市镇已经实行的那样；为了遏制滥用，超出的用量就收高得多的费用，比如用来洗好几辆车、在八月盛夏浇灌大片草坪或给私人泳池注水。已有多个法国大都市连续试行了几年，在不惩罚脆弱家庭的前提下，在抑制夏季用水高峰方面取得了十分鼓舞人心的成果。`,
      audioUrl: "materials/co/preset-listen-1-e3-d3.mp3",
    },
  ],
  questions: [
    { doc: 0, q: "Selon Nadia Roussel, qu'est-ce qui a poussé les habitants à économiser l'eau ?", options: ["La crainte de recevoir une lourde amende.", "La publication régulière de données sur la rivière.", "L'intervention quotidienne de la police municipale."], answer: 1, why: "她说最能说服居民的不是罚款，而是每周公布精确的河流水位数字。", difficulty: 3, skill: "paraphrase" },
    { doc: 0, q: "Quelle a été la première réaction des habitants face à la restriction ?", options: ["Ils ont manifesté leur mécontentement.", "Ils ont demandé plus de contrôles.", "Ils sont restés indifférents."], answer: 0, why: "原文明确提到 « beaucoup d'habitants étaient vraiment mécontents »。", difficulty: 1, skill: "detail" },
    { doc: 1, q: "Grâce au nouveau système d'irrigation, Thomas Leroy…", options: ["réduit sa consommation d'eau d'environ un tiers.", "double sa récolte de fruits chaque été.", "n'a plus besoin d'aide publique pour son matériel."], answer: 0, why: "他说 « j'utilise à peu près un tiers d'eau en moins »。", difficulty: 2, skill: "detail" },
    { doc: 1, q: "Que suggère l'agriculteur pour aider ses voisins ?", options: ["Réduire la surface de leurs vergers.", "Acquérir l'équipement de manière collective.", "Demander un prêt bancaire individuel."], answer: 1, why: "他建议由农业合作社共同购买和管理设备来分摊费用。", difficulty: 3, skill: "paraphrase" },
    { doc: 2, q: "Claire Duval critique une hausse générale du prix de l'eau parce qu'elle…", options: ["découragerait les communes d'investir.", "pèserait lourdement sur les foyers les moins riches.", "ferait baisser la qualité de l'eau potable."], answer: 1, why: "她说全面涨价对低收入家庭不公，他们也不得不为基本生存需求买单。", difficulty: 3, skill: "paraphrase" },
    { doc: 2, q: "Avec la tarification progressive, on paie plus cher uniquement lorsque…", options: ["on habite dans une grande métropole.", "on dépasse les usages essentiels du quotidien.", "on consomme de l'eau pendant l'hiver."], answer: 1, why: "前几方满足基本饮水洗漱的保持低价，超出用于草坪和泳池的非必需用量才高价收费。", difficulty: 4, skill: "inference" },
  ],
};

/* ==================== 听力整套 2（25 分 · 播音电台风） ==================== */

const L2_LONG_1: Raw = {
  form: "long",
  topic: "sante",
  intro: "Vous écoutez une chronique consacrée à la santé sur une radio nationale.",
  title: "Les déserts médicaux : la télémédecine suffit-elle ?",
  docs: [
    {
      text: `Sophie Garnier : Bonjour à tous. Dans notre dossier consacré à l'accès aux soins, nous abordons aujourd'hui une réalité qui touche près de huit millions de Français : les déserts médicaux. Pour analyser l'essor des cabines de téléconsultation installées dans les mairies et les pharmacies rurales, nous recevons le docteur Antoine Moreau, médecin généraliste en Bourgogne, ainsi que Camille Deschamps, représentante d'une association de patients. Docteur Moreau, ces bornes connectées répondent-elles vraiment au manque de médecins ?
Antoine Moreau : Bonjour. Ces dispositifs rendent indéniablement service dans certaines situations simples, comme le renouvellement d'une ordonnance ou le suivi d'une affection déjà connue. Grâce à des appareils intégrés — tensiomètre, stéthoscope ou caméra pour examiner la gorge —, un praticien situé à trois cents kilomètres peut poser un premier diagnostic en moins de quinze minutes. Toutefois, il ne faut pas se bercer d'illusions : la télémédecine ne remplacera jamais une consultation en personne. Ausculter un abdomen, observer la démarche d'un patient âgé ou détecter une détresse psychologique demande une présence physique que l'écran ne transmet pas.
Sophie Garnier : Camille Deschamps, comment les habitants de vos communes rurales accueillent-ils ces cabines installées parfois dans la salle des fêtes ou à la pharmacie ?
Camille Deschamps : L'accueil est très contrasté. Les personnes jeunes ou actives apprécient de ne plus avoir à poser une demi-journée de congé et à parcourir quarante kilomètres pour un simple certificat médical. En revanche, nos aînés restent souvent déroutés par l'outil numérique. Lorsque personne n'est présent à côté d'eux pour manipuler les instruments ou expliquer la procédure à l'écran, beaucoup renoncent tout simplement à prendre rendez-vous. De plus, sans dossier médical suivi par le même médecin traitant, on perd la connaissance globale de l'histoire du patient.
Antoine Moreau : Camille a tout à fait raison sur ce point. Le risque majeur, c'est une médecine fragmentée, presque « à la chaîne », où l'on consulte un visage différent à chaque épisode. C'est pourquoi, dans notre maison de santé pluridisciplinaire, nous avons choisi une autre voie : des infirmières formées se déplacent au domicile des patients fragiles et assistent en direct à la téléconsultation avec le médecin du secteur. Là, le numérique devient un véritable allié, car il s'appuie sur un lien humain local.
Sophie Garnier : Faut-il alors imposer aux jeunes médecins de s'installer pendant quelques années dans les zones sous-dotées, comme le proposent certains élus ?
Antoine Moreau : Personnellement, je reste réservé sur la contrainte, qui risque surtout de décourager des étudiants déjà épuisés par dix ans d'études. Ce qui attire durablement les jeunes confrères à la campagne, ce sont des structures collectives où ils ne travaillent pas isolés, un bon équilibre de vie et des stages rémunérés dans nos territoires dès l'université.
Camille Deschamps : En attendant que ces mesures portent leurs fruits, l'urgence pour les habitants reste d'avoir un interlocuteur de confiance à moins de vingt minutes de chez eux.
Sophie Garnier : Merci à tous les deux pour ces pistes concrètes et nuancées.`,
      zh: `Sophie Garnier：大家好。在今天的医疗可及性专题中，我们探讨一个影响近八百万法国人的现实问题：医疗荒漠。针对越来越多乡村市政厅和药店引入的远程诊疗亭，我们请到了勃艮第的全科医生 Antoine Moreau，以及患者协会代表 Camille Deschamps。Moreau 医生，这些联网诊疗设备真的能解决医生短缺吗？
Antoine Moreau：您好。在某些简单情况下，比如续开处方或随访已知病情，这些设备确实能帮上忙。借助内置仪器——血压计、听诊器或检查咽喉的摄像头——三百公里外的医生可以在十五分钟内作出初步诊断。不过我们不能自欺欺人：远程医疗永远替代不了面对面问诊。触诊腹部、观察老年患者的步态，或者察觉心理困扰，都需要屏幕无法传递的实体在场感。
Sophie Garnier：Camille Deschamps，乡村居民对这些有时设在村活动室或药店里的诊疗亭反应如何？
Camille Deschamps：评价非常分化。年轻人和在职人员很欣赏不用再请半天假、开车四十公里只为开一张简单的医疗证明。相反，老年人经常被数字工具弄得不知所措。如果旁边没有工作人员帮忙操作仪器或解释屏幕步骤，很多人干脆放弃预约。此外，没有固定的家庭医生持续跟进病历，就会丧失对患者整体病史的掌握。
Antoine Moreau：Camille 在这一点上说得完全正确。最大的风险在于医疗变得碎片化、几乎像“流水线”，每次看病面对的都是不同的陌生医生。正因如此，在我们多学科联合诊所，我们选择了另一条路：由经过培训的护士上门探望体弱患者，并在现场协助本地医生进行远程连线问诊。这样数字技术因为依托了本地人际联系，才真正成为有力助手。
Sophie Garnier：那是否应该像部分议员提议的那样，强制要求年轻医生在医疗匮乏地区执业几年呢？
Antoine Moreau：我个人对强制手段持保留态度，这只会让经历了十年学医已经筋疲力尽的年轻人更加望而却步。真正能长久留住年轻同行的，是不必单打独斗的联合诊所、良好的生活平衡，以及大学阶段就在基层进行的带薪实习。
Camille Deschamps：在这些措施见效之前，居民眼下最迫切的仍是能在离家二十分钟以内找到一位值得信赖的医疗联络人。
Sophie Garnier：感谢两位带来如此务实而均衡的探讨。`,
      audioUrl: "materials/co/preset-listen-2-e1-d1.mp3",
    },
  ],
  questions: [
    { q: "Selon le docteur Moreau, les cabines de téléconsultation sont surtout adaptées pour…", options: ["poser un diagnostic lors d'une urgence grave.", "gérer des demandes courantes sans déplacement lourd.", "remplacer entièrement les visites à domicile."], answer: 1, why: "他指出远程亭适用于续开处方或复诊已知病症等简单情况，但不能替代面诊。", difficulty: 2, skill: "paraphrase" },
    { q: "Pourquoi certains patients âgés renoncent-ils à utiliser ces bornes ?", options: ["Le prix de la consultation est trop élevé.", "Ils manquent d'aide pour se servir du matériel.", "Les pharmacies refusent de les accueillir."], answer: 1, why: "Camille 说如果没人帮忙操作仪器和解释屏幕流程，很多老人干脆放弃预约。", difficulty: 2, skill: "detail" },
    { q: "Quelle est la principale crainte exprimée par les deux invités au sujet de ces cabines ?", options: ["Une rupture dans la continuité du suivi médical.", "Une panne fréquente du réseau internet rural.", "Un désintérêt total des jeunes actifs."], answer: 0, why: "两人都担心缺乏固定主治医生的全局病历跟进，使看病变成“流水线”。", difficulty: 3, skill: "paraphrase" },
    { q: "Comment la maison de santé d'Antoine Moreau utilise-t-elle le numérique ?", options: ["En formant les pharmaciens à prescrire seuls.", "En associant visite d'une infirmière et appel vidéo.", "En réservant la vidéo aux jeunes patients."], answer: 1, why: "受训护士上门并现场连线本地区医生，将数字技术与本地人力结合。", difficulty: 3, skill: "detail" },
    { q: "Quelle est la position d'Antoine Moreau sur l'installation obligatoire des jeunes médecins ?", options: ["Il y est favorable pour cinq ans minimum.", "Il doute de son efficacité et préfère d'autres mesures.", "Il pense que les élus doivent décider seuls."], answer: 1, why: "他对强制分配持保留态度，更看好联合诊所和大学期基层带薪实习。", difficulty: 4, skill: "opinion" },
    { q: "D'après Camille Deschamps, quelle est la priorité immédiate des habitants ?", options: ["Obtenir des stages rémunérés à l'université.", "Pouvoir compter sur un soignant proche et régulier.", "Installer des bornes dans chaque mairie."], answer: 1, why: "她强调居民当前最需要的是离家不到二十分钟就能找到值得信赖的接诊者。", difficulty: 3, skill: "paraphrase" },
    { q: "Que peut-on déduire de l'ensemble de l'émission sur la télémédecine ?", options: ["Elle complète l'offre locale mais ne suffit pas isolément.", "Elle a déjà supprimé les déserts médicaux en Bourgogne.", "Elle coûte trop cher pour être maintenue en pharmacie."], answer: 0, why: "综合全篇，远程诊疗只是辅助工具，必须配合本地人力与联合医疗结构。", difficulty: 5, skill: "inference" },
  ],
};

const L2_LONG_2: Raw = {
  form: "long",
  topic: "culture",
  intro: "Vous écoutez un reportage suivi d'un entretien dans une émission culturelle.",
  title: "Surtourisme : comment préserver les sites fragiles ?",
  docs: [
    {
      text: `Laurent Delmas : Bienvenue dans « Territoires en mouvement ». Chaque été, certains villages côtiers et parcs naturels français accueillent jusqu'à dix fois leur population habituelle en quelques semaines. Comment protéger les paysages et la vie quotidienne des riverains sans fermer les portes aux visiteurs ? Nous recevons aujourd'hui Claire Vasseur, maire d'une commune littorale bretonne, et Karim Haddad, économiste spécialiste du tourisme. Claire Vasseur, votre commune a mis en place cet été un système de réservation gratuite pour accéder à une célèbre presqu'île. Quel premier bilan en tirez-vous ?
Claire Vasseur : Bonjour Laurent. Le bilan est très encourageant, même si la décision a suscité de vives discussions au printemps. Auparavant, jusqu'à quatre mille personnes marchaient chaque jour sur les mêmes sentiers fragiles, provoquant une érosion rapide des dunes et des embouteillages monstres dès dix heures du matin. En plafonnant l'accès à mille huit cents visiteurs quotidiens grâce à un billet gratuit réservé en ligne, nous avons réduit la pression sur la nature tout en rendant la promenade bien plus agréable. Les commerçants du bourg ont d'abord craint une baisse de leur chiffre d'affaires, mais les visiteurs restent plus longtemps et consomment davantage dans les restaurants locaux.
Laurent Delmas : Karim Haddad, la régulation par quotas gratuits est-elle une solution reproductible partout en France ?
Karim Haddad : Elle fonctionne très bien pour un site naturel délimité avec un seul point d'entrée, comme une île ou une calanque. En revanche, dans un quartier historique urbain ouvert à tous les vents, contrôler des milliers de passants devient vite impossible et crée un sentiment d'exclusion. De plus, les réservations en ligne favorisent souvent les touristes très organisés qui planifient leur séjour six mois à l'avance, au détriment des habitants de la région qui décident d'une sortie le dimanche matin. Il faut donc toujours garder un quota de places pour le public de proximité.
Claire Vasseur : Nous y avons pensé justement : trente pour cent des billets restent disponibles le matin même au guichet de l'office de tourisme, et les résidents de la communauté de communes entrent librement. Par ailleurs, nous avons travaillé avec les créateurs de contenus et les offices voisins pour mettre en valeur d'autres sentiers moins connus à dix kilomètres de là.
Karim Haddad : C'est sans doute la clé la plus durable : étaler la fréquentation dans l'espace et dans le temps. Tant que l'on concentrera quatre-vingts pour cent des séjours sur juillet et août autour de cinq sites devenus célèbres sur les réseaux sociaux, les mesures d'urgence ne feront que déplacer le problème vers le village voisin. Encourager le tourisme de printemps et d'automne, notamment grâce à des tarifs de train attractifs et à un calendrier scolaire mieux réparti, permettrait d'alléger durablement la pression.
Laurent Delmas : Merci à tous les deux pour cet éclairage précis sur un défi qui concerne désormais de nombreuses régions.`,
      zh: `Laurent Delmas：欢迎收听《行进中的地区》。每年夏天，法国部分沿海村庄和自然公园在几周内接待的游客量会达到常住人口的十倍。如何在不对游客关门的前提下保护风景和本地居民的日常生活？今天我们请到了布列塔尼一座沿海市镇的镇长 Claire Vasseur，以及旅游经济学家 Karim Haddad。Claire Vasseur，您的市镇今夏实行了免费预约进入著名半岛的制度，目前初步成效如何？
Claire Vasseur：Laurent 您好。虽然这项决定在春天引发过激烈争论，但目前成效非常鼓舞人心。此前，每天多达四千人踩在同一批脆弱的步道上，导致沙丘加速侵蚀，早上十点起就严重堵车。通过线上免费预约将每日接待上限设为一千八百人，我们既减轻了自然环境压力，又让游览体验更加惬意。镇上的商户最初担心营业额下降，但实际上游客停留时间更长，在本地餐馆消费反而更多了。
Laurent Delmas：Karim Haddad，免费配额调控这套办法能在全法国各地复制吗？
Karim Haddad：对于入口单一、边界清晰的自然景区，比如海岛或峡湾，它非常有效。相反，在四通八达的城市历史街区，管控成千上万行人很快就会变得不现实，还会制造排斥感。此外，线上预约往往对提前半年做攻略的外地游客更有利，却让周末早上临时起意出游的本省居民吃亏。因此必须为本地近郊公众保留一部分名额。
Claire Vasseur：我们恰恰考虑到了这一点：百分之三十的门票保留到当天早晨在旅游局窗口领取，而且所属市镇共同体的居民可以自由进出。此外，我们还与内容创作者及周边旅游局合作，推介十公里外其他知名度较低的徒步路线。
Karim Haddad：这或许才是最持久的关键：在空间和时间上分散客流。只要百分之八十的出游仍然集中在七八月份、挤在社交媒体带火的那五个景点周围，应急措施就只是把压力转嫁给邻近村庄。通过有吸引力的火车票价和更均衡的校历来鼓励春秋两季出游，才能长久缓解压力。
Laurent Delmas：感谢两位对这一如今波及众多地区的挑战作出的清晰剖析。`,
      audioUrl: "materials/co/preset-listen-2-e2-d1.mp3",
    },
  ],
  questions: [
    { q: "Avant l'été, le principal problème de la presqu'île évoqué par Claire Vasseur était…", options: ["la fermeture des restaurants du centre-bourg.", "la dégradation des sols et la saturation des routes.", "le manque de places de parking payantes."], answer: 1, why: "此前每天四千人踩踏导致沙丘侵蚀（érosion des dunes）及十点起严重堵车。", difficulty: 2, skill: "paraphrase" },
    { q: "Quel effet inattendu le plafonnement a-t-il eu sur les commerces locaux ?", options: ["Les visiteurs dépensent davantage sur place.", "Plusieurs boutiques ont dû fermer en juillet.", "Les prix des hôtels ont fortement baissé."], answer: 0, why: "游客虽然变少但停留更久，在本地餐馆的消费反而增加了。", difficulty: 2, skill: "detail" },
    { q: "Selon Karim Haddad, quel type de lieu se prête le mieux à un système de quotas ?", options: ["Les grands quartiers commerçants des métropoles.", "Les espaces naturels dotés d'un accès bien délimité.", "Les musées nationaux gratuits toute l'année."], answer: 1, why: "他指出边界清晰、入口单一的自然区域（如海岛、峡湾）最适合配额制。", difficulty: 3, skill: "detail" },
    { q: "Quel défaut Karim Haddad reproche-t-il aux réservations uniquement en ligne ?", options: ["Elles défavorisent les habitants qui décident au dernier moment.", "Elles coûtent trop cher aux petites mairies rurales.", "Elles ralentissent l'entrée aux guichets."], answer: 0, why: "线上预约偏向提前半年计划的游客，对周末临时起意的近郊居民不利。", difficulty: 3, skill: "paraphrase" },
    { q: "Comment la commune de Claire Vasseur évite-t-elle d'exclure les habitants voisins ?", options: ["Elle supprime le quota pendant les week-ends.", "Elle garde des billets au guichet et exempte les résidents.", "Elle rend l'entrée payante uniquement pour les groupes."], answer: 1, why: "当天窗口保留 30% 门票，且市镇共同体居民自由进入。", difficulty: 3, skill: "detail" },
    { q: "Pour Karim Haddad, sans action sur les saisons, les quotas risquent surtout de…", options: ["décourager définitivement les touristes étrangers.", "reporter la foule vers d'autres communes proches.", "faire augmenter le prix des billets de train."], answer: 1, why: "如果客流继续挤在七八月少数景点，限流只会把问题转移到邻近村庄。", difficulty: 4, skill: "negation" },
    { q: "Quelle mesure de fond Karim Haddad privilégie-t-il à long terme ?", options: ["Interdire la promotion des sites sur les réseaux sociaux.", "Mieux répartir les séjours entre plusieurs périodes et lieux.", "Multiplier les hôtels le long des plages."], answer: 1, why: "他强调在空间和时间上分散客流，通过票价和校历鼓励春秋旅游。", difficulty: 5, skill: "inference" },
  ],
};

const L2_SHORT: Raw = {
  form: "short",
  topic: "consommation",
  intro: "Vous allez écouter trois documents sonores. Vous n'entendrez chaque document qu'une seule fois.",
  title: "Réparer plutôt que jeter",
  docs: [
    {
      text: `Présentatrice : Chaque premier samedi du mois, la salle municipale de Saint-Nazaire accueille un atelier de réparation gratuit ouvert à tous les habitants du quartier. Paul Mercier coordonne l'équipe de vingt-cinq bénévoles depuis maintenant cinq ans.
Paul Mercier : Au départ, nous réparions surtout de vieux grille-pains, des fers à repasser ou des lampes de chevet. Aujourd'hui, plus de la moitié des objets apportés dès l'ouverture sont des ordinateurs portables, des machines à café automatiques ou des robots de cuisine assez récents qui tombent en panne juste après la fin de la garantie légale. Dans sept cas sur dix, le problème vient pourtant d'un composant minuscule qui coûte moins de cinq euros : un condensateur usé, un câble dessoudé, un fusible thermique ou simplement un filtre encrassé. Ce qui frappe le plus les visiteurs, ce n'est pas seulement l'économie réalisée sur leur budget. Nous ne prenons jamais l'appareil pour le réparer dans leur dos : la personne s'assoit à côté du bénévole, tient le tournevis, teste le courant et comprend comment fonctionne son objet. Beaucoup repartent fiers d'avoir vaincu leur peur de démonter un appareil, et certains reviennent le mois suivant pour aider à leur tour.`,
      zh: `主持人：每个月的第一个周六，圣纳泽尔市政大厅都会向街区全体居民举办一场免费维修工坊。Paul Mercier 五年来一直负责协调这支由二十五名志愿者组成的团队。
Paul Mercier：起初我们主要修旧烤面包机、电熨斗或床头灯。如今一开门送来的物品里，一半以上是刚过法定保修期不久就出故障的较新笔记本电脑、全自动咖啡机或厨师机。十次里有七次，问题仅仅出自一个不到五欧元的小零件：老化的电容、脱焊的线头、热熔断器，或者只是堵塞的滤网。最让来访者触动的不仅是家庭预算上省下的钱。我们从不背着他们拿走电器自己修：来访者就坐在志愿者旁边，亲自拿着螺丝刀、检测电路，弄懂设备是怎么工作的。很多人离开时为自己克服了拆开电器的恐惧而自豪，有些人下个月还会回来当志愿者帮忙。`,
      audioUrl: "materials/co/preset-listen-2-e3-d1.mp3",
    },
    {
      text: `Claire Lefort : En tant que juriste spécialisée dans le droit de la consommation, je suis de très près le déploiement du « bonus réparation », une aide financière directe déduite aussitôt de la facture lorsque l'on fait réparer un appareil hors garantie chez un artisan ou un atelier labellisé. Sur le papier, l'intention est excellente, puisque la somme accordée peut atteindre cinquante euros pour un lave-linge, un téléviseur ou un ordinateur portable, sans paperasse compliquée pour l'acheteur. Toutefois, le dispositif reste encore freiné par deux obstacles majeurs sur le terrain. D'abord, la majorité des consommateurs ignorent encore son existence ou ne savent pas trouver rapidement un réparateur agréé près de chez eux, surtout dans les zones rurales ou les petites villes isolées. Ensuite, certaines pièces détachées essentielles restent vendues si cher par les fabricants que même avec le bonus déduit, l'achat d'un modèle neuf bas de gamme paraît plus avantageux aux yeux des ménages pressés. Tant que la durée de disponibilité et le prix des pièces ne seront pas mieux encadrés par la loi européenne et française, le réflexe du tout-jetable restera tenace.`,
      zh: `Claire Lefort：作为消费法专业律师，我密切关注“维修补贴”的落实——这是指消费者在经认证的维修店或工坊修理过保电器时，直接从账单中扣除的资金补助。纸面上这项举措初衷极好，修理洗衣机、电视或笔记本电脑最高可减免五十欧元，而且买家无需办理繁琐手续。然而该机制在实践中仍受两大主要障碍掣肘。首先，大多数消费者至今仍不知道有这项补贴，或者尤其在农村和小城镇不知道去哪里快速找到获认证的维修点。其次，部分核心零配件被厂家定得极其昂贵，以至于即使扣除补贴，在忙碌的家庭眼里买一台新的低端机反而更划算。只要欧洲和法国法律不进一步规范零配件的供应年限和价格，用完即扔的习惯就仍会顽固存在。`,
      audioUrl: "materials/co/preset-listen-2-e3-d2.mp3",
    },
    {
      text: `Julien Garnier : Je dirige un magasin d'électroménager indépendant de taille moyenne dans la banlieue de Toulouse depuis douze ans. Pendant longtemps, nous vendions presque exclusivement du matériel neuf garanti deux ans, et les appareils repris chez les clients partaient aussitôt à la déchetterie pour recyclage. Il y a deux ans, face aux attentes d'une clientèle plus jeune, mieux informée et très attentive à son budget mensuel, nous avons ouvert au fond du magasin un atelier de reconditionnement visible du public et un rayon dédié aux pièces de seconde main vérifiées en atelier. Au début, plusieurs collègues du secteur craignaient que ces ventes n'absorbent une partie importante de nos bénéfices sur le neuf. En réalité, c'est tout le contraire qui s'est produit : l'atelier attire de nouveaux clients du quartier qui viennent d'abord pour sauver un aspirateur ou un micro-ondes, puis choisissent notre enseigne en toute confiance lorsqu'ils doivent finalement renouveler un réfrigérateur ou un four encastrable. Le seul point délicat reste le recrutement de techniciens polyvalents et qualifiés, car ces métiers manuels ont été longtemps dévalorisés et les jeunes diplômés manquent à l'appel.`,
      zh: `Julien Garnier：我在图卢兹郊区经营一家中型独立家电商店已经十二年了。很长一段时间里我们几乎只卖带两年保修的新机，从顾客家里收来的旧电器直接送去回收站拆解。两年前，面对更年轻、更懂行且注重每月预算的客群需求，我们在店面深处开设了面向公众开放的翻新工坊，并设立了经工坊检测的二手配件专区。起初不少业内同行担心这会抢走新机的大部分利润。实际上结果恰恰相反：工坊吸引了周边新顾客，他们最初是来修吸尘器或微波炉，等以后真需要换新冰箱或烤箱时也会放心地选择我们店。唯一棘手的难题依然是招聘合格的多面手技师，因为这类手工技术岗位长期遭到轻视，年轻毕业生严重短缺。`,
      audioUrl: "materials/co/preset-listen-2-e3-d3.mp3",
    },
  ],
  questions: [
    { doc: 0, q: "Dans l'atelier de Saint-Nazaire, la majorité des pannes viennent…", options: ["d'un défaut grave du moteur central.", "d'un problème mineur et peu coûteux.", "d'une mauvaise utilisation par les enfants."], answer: 1, why: "他说十次里有七次只是不到五欧的小零件问题（电容、线头或滤网）。", difficulty: 2, skill: "paraphrase" },
    { doc: 0, q: "Quelle est la règle de fonctionnement de cet atelier bénévole ?", options: ["Le visiteur participe lui-même à la réparation.", "Chaque personne paie uniquement le prix des outils.", "Les appareils sont réparés puis donnés à la mairie."], answer: 0, why: "来访者坐在志愿者身旁拿着螺丝刀一起修，而不是交给对方背着修。", difficulty: 2, skill: "detail" },
    { doc: 1, q: "Selon Claire Lefort, pourquoi le bonus réparation ne suffit-il pas toujours ?", options: ["La démarche administrative prend plusieurs mois.", "Le coût élevé des pièces rend parfois le neuf plus attractif.", "Les artisans refusent d'accepter cette aide publique."], answer: 1, why: "配件价格太高，以至于即便有补贴，买低端新机看起来仍更划算。", difficulty: 3, skill: "paraphrase" },
    { doc: 1, q: "Que souhaite la juriste pour changer durablement les habitudes ?", options: ["Interdire la vente d'appareils garantis moins de cinq ans.", "Réglementer davantage le marché des pièces détachées.", "Supprimer les réparateurs situés en centre-ville."], answer: 1, why: "她指出法律必须更好地规范配件的供应期限与价格。", difficulty: 4, skill: "inference" },
    { doc: 2, q: "Contrairement aux craintes de départ, l'atelier de réparation du magasin…", options: ["a fait baisser les ventes d'aspirateurs neufs.", "a permis de fidéliser une nouvelle clientèle.", "coûte plus cher que le service de recyclage."], answer: 1, why: "工坊反而带来新客流，他们修完小电器后，换大件新家电时也选择这家店。", difficulty: 3, skill: "opinion" },
    { doc: 2, q: "Quelle difficulté Julien Garnier rencontre-t-il aujourd'hui ?", options: ["Le manque de place au fond de son magasin.", "La pénurie de main-d'œuvre qualifiée pour réparer.", "Le refus des clients d'acheter des pièces vérifiées."], answer: 1, why: "他提到唯一棘手的是招不到合格维修技师，年轻人缺乏。", difficulty: 2, skill: "detail" },
  ],
};

/* ==================== 阅读整套 1（25 分） ==================== */

const R1_LONG_1: Raw = {
  form: "long",
  topic: "education",
  intro: "Dans un magazine francophone, vous lisez un article sur l'apprentissage des langues à l'école.",
  title: "Apprendre une langue avec une application : le pari de certains collèges",
  docs: [
    {
      text: `Depuis la rentrée de septembre, une quarantaine de collèges de la région Grand Est participent à une expérimentation suivie de près : l'intégration d'une application d'apprentissage de l'anglais dans le parcours des élèves de cinquième. Pendant vingt minutes par jour, en classe ou depuis leur domicile, les collégiens réalisent de courtes séries d'exercices vocaux et lexicaux sur tablette, en complément des trois heures de cours hebdomadaires habituelles. L'objectif affiché par le rectorat est clair : accroître le temps d'exposition quotidienne à la langue vivante sans alourdir les emplois du temps ni exiger de séances supplémentaires.

Les premiers résultats, rendus publics en mars dans un rapport intermédiaire, semblent globalement encourageants. Selon l'évaluation menée par l'académie auprès de deux mille élèves, ceux qui ont utilisé l'application au moins quatre fois par semaine ont progressé de manière plus nette en compréhension orale et en mémorisation du vocabulaire courant que ceux des collèges témoins. « Ils entendent et répètent de l'anglais presque tous les jours, avec des accents variés, et pas seulement lors des séances scolaires », résume Marc Olivier, inspecteur pédagogique chargé du suivi.

Toutefois, derrière cette moyenne flatteuse, les écarts de pratique restent importants. Près d'un élève sur trois n'a presque jamais ouvert l'application en dehors des murs du collège, soit par manque de connexion fiable à la maison, soit par lassitude face aux rappels automatiques. Pour Sophie Bernard, professeure d'anglais à Metz, ce constat n'a rien de surprenant : « Les élèves qui travaillent seuls le soir sont presque toujours ceux qui étaient déjà curieux et organisés. L'outil numérique ne crée pas la motivation par magie ; il amplifie surtout les habitudes de travail existantes. »

D'autres enseignants s'inquiètent également de la nature même des tâches proposées. Les exercices de l'application, très ludiques mais fragmentés, reposent principalement sur l'association rapide d'images, la traduction mot à mot et la répétition de phrases toutes faites. « On entraîne nos élèves à réagir vite pour gagner des points virtuels, pas à nuancer une idée ni à construire une pensée suivie en anglais », regrette Sophie Bernard. Elle redoute que l'expression orale spontanée, déjà difficile à développer dans des classes de trente élèves, ne passe encore au second plan face à des écrans silencieux.

Sollicité par notre rédaction, le rectorat ne nie pas ces limites pédagogiques. Il insiste sur le fait que l'application ne doit en aucun cas remplacer le professeur, mais lui fournir des indicateurs précis : chaque enseignant dispose d'un tableau de bord montrant les structures grammaticales ou les sons qui posent le plus de problèmes à sa classe. À Nancy comme à Reims, plusieurs professeurs s'appuient déjà sur ces données pour constituer des groupes de besoin ciblés en début d'heure, pendant qu'une partie du groupe travaille en autonomie.

Reste enfin la question décisive du financement et de l'évaluation globale. Pour l'heure, la licence logicielle est entièrement prise en charge par le conseil régional, mais pour une durée expérimentale de deux ans seulement. Si le dispositif devait être prolongé et étendu à l'ensemble de l'académie, il faudrait déterminer qui assumera le coût des abonnements et de renouvellement des tablettes, tout en vérifiant si l'outil améliore réellement l'expression écrite et la prise de parole en continu — deux compétences qui n'ont, jusqu'ici, fait l'objet d'aucune mesure.`,
      zh: `自九月新学年开学以来，法国大东部大区的约四十所初中参与了一项备受关注的试点项目：在初二年级（cinquième）的英语课程中引入一款语言学习应用。学生每天在课堂上或家里用平板电脑完成二十分钟短时语音和词汇练习，作为每周三节常规英语课的补充。学区教育局明确提出的目标是：在不增加课表负担、不增设额外课时的前提下，增加学生每天接触外语的时间。

今年三月在一份中期报告中公布的初步结果总体令人鼓舞。根据学区对两千名学生的评估，每周至少使用四次应用的学生，在听力理解和常用词汇记忆方面的进步比对照学校学生更加明显。“他们几乎每天都在听和跟读不同口音的英语，而不只是在学校上课时才接触。”负责跟进的教学督学 Marc Olivier 总结道。

然而，在亮眼的平均数据背后，实际使用差距依然很大。近三分之一的学生在学校之外几乎从未打开过该应用，要么因为家里缺乏稳定网络，要么因为对自动推送提醒感到厌倦。梅斯的英语教师 Sophie Bernard 认为这一现象毫不意外：“晚上能自觉独立练习的，几乎本来就是那些好奇又自律的学生。数字工具不会凭空制造学习动力，它只是放大了原有的学习习惯。”

另一些教师则对练习本身的形态表示担忧。这款应用设计得十分游戏化却高度碎片化，主要依赖快速配图、逐词翻译以及重复现成套话。“我们只是在训练学生为了赚虚拟积分而快速反应，而不是训练他们用英语细腻表达或构建连贯的思想，”Sophie Bernard 遗憾地说。她担心在三十人的大班里本就难以培养的即兴口头表达，面对安静的屏幕后会进一步被边缘化。

学区教育局在接受本刊采访时并未否认这些教学局限。局方强调应用绝不能取代教师，而应为教师提供精准数据：每位教师都能看到显示全班最易出错语法结构或发音的仪表盘。在南锡和兰斯，已有多位教师利用这些数据在课前分组，针对薄弱环节辅导一部分学生，同时让另一部分学生自主练习。

最后仍悬而未决的是经费与全面评估问题。目前，软件授权费全由大区议会承担，但仅限两年试点期。如果项目延长并推广至整个学区，就必须明确由谁来承担订阅费与平板更新成本，同时还需检验该工具是否真正提升了书面表达和连贯口语——这两项能力迄今尚未被纳入任何测评。`,
    },
  ],
  questions: [
    {
      q: "L'article présente avant tout…",
      options: ["une réforme nationale supprimant les manuels scolaires.", "le premier bilan d'une expérimentation numérique locale.", "une application créée par des collégiens de l'Est."],
      answer: 1,
      evidence: "une quarantaine de collèges de la région Grand Est participent à une expérimentation suivie de près",
      trapTypes: ["夸大范围（非全国取消教材）", "✓ 主旨同义概括", "张冠李戴（非初中生开发）"],
      why: "全文报道大东部大区四十所初中引入英语学习应用的实验及其初步中期评估。",
      difficulty: 2,
      skill: "gist",
    },
    {
      q: "Quel est le but poursuivi par le rectorat avec cet outil ?",
      options: ["Allonger les séances d'anglais en fin d'après-midi.", "Multiplier les occasions de pratiquer au quotidien.", "Réduire le nombre d'enseignants dans les classes."],
      answer: 1,
      evidence: "accroître le temps d'exposition quotidienne à la langue vivante sans alourdir les emplois du temps",
      trapTypes: ["正反颠倒（明确不加课时）", "✓ 同义改写（accroître l'exposition quotidienne）", "无中生有（明确不替代教师）"],
      why: "目标是在不加重课表的前提下增加每天接触语言的时间。",
      difficulty: 3,
      skill: "paraphrase",
    },
    {
      q: "D'après l'évaluation menée sur deux mille élèves, les progrès les plus nets portent sur…",
      options: ["la rédaction de longs récits.", "l'écoute et le lexique de base.", "la prononciation des mots complexes."],
      answer: 1,
      evidence: "ont progressé de manière plus nette en compréhension orale et en mémorisation du vocabulaire courant",
      trapTypes: ["张冠李戴（写作尚未测评）", "✓ 同义改写（écoute + lexique de base）", "局部曲解"],
      why: "第二段指出经常使用的学生在听力理解和常用词汇记忆上进步最显著。",
      difficulty: 1,
      skill: "detail",
    },
    {
      q: "Selon Sophie Bernard, le fait qu'un tiers des élèves n'utilise pas l'application chez eux…",
      options: ["prouve que l'interface est trop complexe.", "confirme les écarts initiaux de motivation.", "va disparaître grâce aux tablettes gratuites."],
      answer: 1,
      evidence: "L'outil numérique ne crée pas la motivation par magie ; il amplifie surtout les habitudes de travail existantes.",
      trapTypes: ["偷换原因", "✓ 观点同义提炼", "无根据乐观"],
      why: "她认为毫不意外，自律的人才会主动用，工具只是放大既有习惯。",
      difficulty: 3,
      skill: "opinion",
    },
    {
      q: "Que reproche Sophie Bernard au format des exercices ?",
      options: ["Ils favorisent les réflexes rapides plutôt que la réflexion.", "Ils demandent un niveau trop avancé pour des cinquièmes.", "Ils négligent l'entraînement à la compréhension écrite."],
      answer: 0,
      evidence: "On entraîne nos élèves à réagir vite pour gagner des points virtuels, pas à nuancer une idée ni à construire une pensée suivie",
      trapTypes: ["✓ 同义改写（réagir vite vs nuancer une idée）", "过度推断", "偷换对象（她担忧的是口语表达）"],
      why: "她说练习只训练学生快速抢积分，不能学会细腻组织连贯思想。",
      difficulty: 4,
      skill: "paraphrase",
    },
    {
      q: "Comment certains professeurs se servent-ils du tableau de bord ?",
      options: ["Pour noter automatiquement les devoirs maison.", "Pour adapter l'aide selon les difficultés observées.", "Pour envoyer des messages d'alerte aux parents."],
      answer: 1,
      evidence: "plusieurs professeurs s'appuient déjà sur ces données pour constituer des groupes de besoin ciblés en début d'heure",
      trapTypes: ["无中生有", "✓ 同义改写（groupes de besoin ciblés）", "无中生有"],
      why: "教师通过仪表盘识别全班高频错误，并据此进行分组分层辅导。",
      difficulty: 3,
      skill: "detail",
    },
    {
      q: "On peut conclure de la fin de l'article que…",
      options: ["l'extension durable du projet demeure incertaine.", "le conseil régional a déjà renouvelé la licence pour dix ans.", "les élèves parlent déjà mieux qu'avant à l'oral."],
      answer: 0,
      evidence: "il faudrait déterminer qui assumera le coût des abonnements et de renouvellement des tablettes, tout en vérifiant si l'outil améliore réellement l'expression écrite et la prise de parole en continu",
      trapTypes: ["✓ 严谨推断（经费与关键能力测评均悬而未决）", "捏造年限（仅资助两年试点）", "违背原文（口语尚未测评）"],
      why: "两年试点后谁出钱未定，且书面和连贯口语尚未测评，项目前景仍未明朗。",
      difficulty: 5,
      skill: "inference",
    },
  ],
};

const R1_LONG_2: Raw = {
  form: "long",
  topic: "societe",
  intro: "Vous lisez dans la presse un dossier consacré à l'habitat intergénérationnel.",
  title: "Vivre sous le même toit à vingt et à quatre-vingts ans : promesses et limites",
  docs: [
    {
      text: `Dans plusieurs grandes villes universitaires françaises, trouver une chambre abordable relève chaque automne du parcours du combattant pour les étudiants et les jeunes apprentis. Au même moment, des milliers de retraités vivent seuls dans des appartements spacieux devenus trop grands pour eux, où la solitude pèse lourd sur le moral comme sur la santé. Pour répondre simultanément à ces deux réalités, des associations locales développent depuis une quinzaine d'années des formules de cohabitation intergénérationnelle : une personne âgée accueille un jeune chez elle en échange d'un loyer très modéré, voire d'une simple participation aux charges courantes, et d'une présence régulière en soirée.

À Bordeaux, l'association « Deux Âges, Un Toit » accompagne actuellement près de cent quatre-vingts binômes répartis dans toute l'agglomération. Selon sa directrice, Nadia Lemaire, la demande a doublé en quatre ans, portée par la flambée des loyers dans le secteur privé et la hausse du coût de la vie. « Pour un étudiant boursier, payer deux cents euros par mois dans le centre-ville au lieu de sept cents euros change complètement les conditions d'études et évite d'enchaîner deux petits boulots le soir, explique-t-elle. Du côté des personnes âgées, la présence discrète de quelqu'un dans la pièce voisine rassure énormément les familles, surtout lorsque l'hébergeant sort d'une hospitalisation ou craint les chutes nocturnes. »

Mais cette entraide séduisante sur le papier suppose des règles extrêmement précises dès le premier jour afin d'éviter toute ambiguïté. « Le pire malentendu consiste à croire que le jeune devient un aide-soignant disponible vingt-quatre heures sur vingt-quatre », prévient Nadia Lemaire. La loi française encadre d'ailleurs strictement ces contrats spécifiques : l'étudiant n'a jamais le droit d'accomplir des gestes médicaux, d'administrer des médicaments ou d'assurer la toilette, et sa présence se limite à des moments conviviaux convenus à l'avance, comme partager deux dîners par semaine, échanger quelques nouvelles ou rentrer à une heure raisonnable.

Malgré l'accompagnement attentif des associations, toutes les expériences ne vont pas jusqu'à la fin de l'année universitaire. Environ quinze pour cent des binômes se séparent avant le mois de juin, le plus souvent pour des désaccords du quotidien en apparence anodins mais usants à la longue : rythme de sommeil différent, musique jugée trop forte, cuisine laissée en désordre ou difficulté de l'hôte à accepter les visites d'amis le week-end. Pour limiter ces tensions prévisibles, les médiateurs organisent désormais plusieurs entretiens séparés avant la signature, afin de vérifier que les attentes et les habitudes de chacun coïncident réellement.

Pour le sociologue Henri Vignon, qui suit ces initiatives depuis leur création à Lyon et à Toulouse, l'habitat intergénérationnel constitue un outil précieux mais qui ne peut rester qu'une solution complémentaire. « C'est une réponse humaine remarquable pour lutter contre l'isolement et tisser de la solidarité entre générations, observe-t-il, mais elle repose sur la bonne volonté de particuliers qui disposent d'une chambre libre. Elle ne saurait en aucun cas dispenser les pouvoirs publics de construire suffisamment de résidences universitaires abordables et de financer l'aide à domicile professionnelle pour les personnes âgées dépendantes. » En d'autres termes, le partage d'un toit crée de précieux liens humains, sans résoudre à lui seul la crise structurelle du logement ni celle du vieillissement.`,
      zh: `在法国多个大学城，每年秋天对大学生而言找一间价格合理的房间都是一场艰苦的考验。与此同时，成千上万名独居老人住在宽敞的公寓里，孤独感沉重地压在心头。为了同时回应这两种现实，多家协会近十五年来推出了代际合住方案：老人收留一名年轻人同住，只收取极低房租甚至仅分摊水电杂费，并换取对方晚间的定期陪伴。

在波尔多，“两代一屋檐”协会目前跟踪支持着近一百八十对合住组合。协会负责人 Nadia Lemaire 表示，受私人租赁市场房租飙升的推动，需求在四年内翻了一番。“对于拿助学金的大学生来说，在市中心每月付两百欧元而不是七百欧元，彻底改变了求学条件，”她解释说，“而在老人一方，隔壁房间有人低调地住着，能让子女安心很多，尤其是当房东刚出院或担心夜间跌倒时。”

但这种纸面上十分美好的互助，从第一天起就需要极为明确的规则。“最糟糕的误解就是以为年轻人成了全天候随叫随到的护工，”Nadia Lemaire 提醒道。法国法律其实严格规范这类合同：学生绝不能承担医疗护理或擦洗照料，其陪伴义务仅限于事先约定的友好互动，比如每周共享两次晚餐或合理时间回家。

尽管有协会介入协调，并非所有合住都能顺利走到学年结束。约百分之十五的组合在六月前解体，原因大多是生活细节分歧：作息时间不同、音乐声太大、厨房未及时收拾，或者老人难以接受朋友来访。为了减少摩擦，调解员如今在签约前会分别进行多次面谈，核实双方的期望是否真正一致。

自代际合住诞生以来一直跟踪研究的社会学家 Henri Vignon 认为，这虽是一个宝贵工具，却只能作为补充方案。“这是对抗孤独感非常动人的人文回应，”他指出，“但它依赖拥有空余房间的私人房东的善意。无论如何，这都不能免除公共部门建设足够大学生宿舍、为失能老人提供专业居家照护经费的责任。”换句话说，共享屋檐能在代际间建立宝贵纽带，但单靠它无法解决结构性的住房危机和老龄化难题。`,
    },
  ],
  questions: [
    {
      q: "La cohabitation intergénérationnelle cherche d'abord à répondre…",
      options: ["à deux difficultés distinctes concernant les jeunes et les aînés.", "au manque d'infirmières dans les hôpitaux universitaires.", "à la hausse des impôts sur les grands appartements."],
      answer: 0,
      evidence: "Pour répondre simultanément à ces deux réalités, des associations locales développent depuis une quinzaine d'années des formules de cohabitation intergénérationnelle",
      trapTypes: ["✓ 主旨概括", "偷换医疗概念", "无中生有"],
      why: "同时应对大学生租房贵和独居老人孤独这两个问题。",
      difficulty: 1,
      skill: "gist",
    },
    {
      q: "Pourquoi la demande a-t-elle fortement augmenté à Bordeaux selon Nadia Lemaire ?",
      options: ["Les universités ont fermé leurs propres résidences.", "Les prix des logements privés ont beaucoup monté.", "Les étudiants refusent désormais la colocation classique."],
      answer: 1,
      evidence: "la demande a doublé en quatre ans, portée par la flambée des loyers dans le secteur privé et la hausse du coût de la vie.",
      trapTypes: ["捏造事实", "✓ 同义改写（flambée des loyers）", "无中生有"],
      why: "她指出需求翻倍主要是受私人市场房租飙升（flambée des loyers）推动。",
      difficulty: 2,
      skill: "detail",
    },
    {
      q: "Quelle limite légale protège l'étudiant accueilli ?",
      options: ["Il doit signer un contrat de bail commercial classique.", "Il ne doit pas assurer de tâches liées aux soins médicaux.", "Il peut quitter le logement sans préavis chaque mois."],
      answer: 1,
      evidence: "l'étudiant n'a jamais le droit d'accomplir des gestes médicaux, d'administrer des médicaments ou d'assurer la toilette",
      trapTypes: ["偷换合同类型", "✓ 限定同义改写（aucun geste médical）", "无中生有"],
      why: "法律规定学生绝不能做医疗或洗漱护理工作。",
      difficulty: 3,
      skill: "paraphrase",
    },
    {
      q: "Dans la majorité des cas, les ruptures avant juin s'expliquent par…",
      options: ["des désaccords sur le partage des dépenses.", "des habitudes de vie difficiles à concilier.", "l'absence d'encadrement juridique des contrats."],
      answer: 1,
      evidence: "rythme de sommeil différent, musique jugée trop forte, cuisine laissée en désordre ou difficulté de l'hôte à accepter les visites d'amis le week-end.",
      trapTypes: ["偷换矛盾原因", "✓ 归纳改写（日常作息习惯摩擦）", "违背原文（法律已有严格规范）"],
      why: "主要是作息不同、音量、厨房卫生、访客等日常习惯摩擦。",
      difficulty: 3,
      skill: "paraphrase",
    },
    {
      q: "Pour éviter les échecs, les associations ont décidé de…",
      options: ["mieux évaluer la compatibilité des candidats avant l'accord.", "interdire aux étudiants de recevoir leurs amis.", "réserver ce logement aux étudiants en médecine."],
      answer: 0,
      evidence: "les médiateurs organisent désormais plusieurs entretiens séparés avant la signature, afin de vérifier que les attentes et les habitudes de chacun coïncident réellement.",
      trapTypes: ["✓ 同义改写（vérifier que les attentes coïncident）", "过度推断", "正反颠倒（绝非招护工）"],
      why: "调解员会在签约前分别多次面谈，核实双方期望是否吻合。",
      difficulty: 3,
      skill: "detail",
    },
    {
      q: "Quelle critique Henri Vignon adresse-t-il si l'on compte trop sur ce modèle ?",
      options: ["Il coûte plus cher que la construction de logements neufs.", "Il ne peut pas remplacer la politique publique de logement.", "Il aggrave l'isolement des personnes âgées à la campagne."],
      answer: 1,
      evidence: "Elle ne saurait en aucun cas dispenser les pouvoirs publics de construire suffisamment de résidences universitaires abordables",
      trapTypes: ["无中生有", "✓ 作者/专家立场改写", "正反颠倒"],
      why: "他强调不能免除政府建宿舍和资助专业养老照护的公共责任。",
      difficulty: 4,
      skill: "opinion",
    },
    {
      q: "Quelle idée résume le mieux la conclusion de l'article ?",
      options: ["La cohabitation est utile mais reste d'ampleur limitée.", "Les binômes devraient recevoir une prime mensuelle de l'État.", "Seules les grandes villes permettent ce type de projet."],
      answer: 0,
      evidence: "le partage d'un toit crée de précieux liens humains, sans résoudre à lui seul la crise structurelle du logement ni celle du vieillissement.",
      trapTypes: ["✓ 结尾综合推断", "无中生有", "绝对化限定"],
      why: "结尾说明它创造了代际纽带，但单靠私人善意无法独立解决住房与老龄化结构危机。",
      difficulty: 5,
      skill: "inference",
    },
  ],
};

const R1_OPINIONS: Raw = {
  form: "opinions",
  topic: "numerique",
  intro: "Vous lisez l'opinion de ces trois personnes sur un forum consacré à la vie numérique.",
  title: "Faut-il limiter le temps passé sur les écrans pendant les vacances ?",
  docs: [
    {
      text: `Camille
Pendant l'année scolaire, je surveille de très près le temps d'écran de mes enfants pour protéger leur sommeil et leurs devoirs, mais dès les vacances d'été je préfère relâcher un peu la pression. Je suis convaincue que des interdictions trop rigides ou des minuteurs imposés à tout bout de champ rendent les écrans encore plus désirables aux yeux des adolescents, qui finissent par tricher pour contourner la règle. À mon sens, l'essentiel est qu'ils aient d'autres occupations concrètes et stimulantes qui leur plaisent vraiment : lorsque nous partons randonner en montagne ou qu'ils passent la journée au lac avec des amis, ils oublient spontanément leur téléphone au fond du sac sans qu'on ait besoin de le leur confisquer. Interdire est une solution de facilité qui crée des tensions permanentes à la maison ; proposer des alternatives demande plus d'imagination et de disponibilité, certes, mais cela fonctionne bien mieux sur la durée.

Rachid
Je ne suis pas du tout favorable à un plafond calculé uniquement en nombre d'heures par jour, car toutes les activités sur écran sont loin de se valoir sur le plan intellectuel ou social. Passer trois heures d'affilée à faire défiler des vidéos courtes sans réfléchir n'a rien à voir avec le fait de monter un court film de famille avec ses cousins, de lire un roman numérique ou de préparer ensemble un itinéraire de voyage. En revanche, j'applique chez moi une règle simple, claire et non négociable : aucun téléphone ni aucune tablette pendant les repas ni dans les chambres le soir après vingt et une heures, y compris pour recharger l'appareil. Les vacances représentent enfin l'occasion précieuse de réunir toute la famille autour d'une table et de prendre le temps de discuter ; je refuse que chacun reste enfermé dans sa bulle numérique sous le même toit.

Élodie
Honnêtement, avant de fixer des règles strictes aux plus jeunes, je pense que les parents devraient commencer par examiner leurs propres réflexes numériques avec lucidité. Mes enfants me reprochent assez souvent de jeter un œil à mes courriels professionnels sur la plage ou de répondre mécaniquement à des messages pendant les visites culturelles alors que je leur demande de décrocher. Depuis l'été dernier, j'ai donc pris l'engagement de laisser mon téléphone éteint à la maison une journée complète chaque semaine, et toute la famille joue le jeu avec moi, sans exception. Au tout début, ce silence numérique nous semblait presque angoissant, tant nous avions pris l'habitude de tout photographier ou vérifier ; aujourd'hui, c'est devenu notre journée préférée de la semaine. On ne peut tout simplement pas exiger des enfants une discipline dont les adultes eux-mêmes se montrent incapables.`,
      zh: `Camille：上学期间我会严密监督孩子看屏幕的时间，以保护他们的睡眠和学业，但一到暑假我更愿意稍微放松一些。我深信过于死板的禁令或倒计时器反而会让屏幕在青少年眼里更有吸引力。在我看来，关键在于他们有其他真正喜欢的具体活动：当我们去徒步或他们和朋友在湖边待一整天时，不需要我们没收，他们自己就会把手机忘在包里。一味禁止虽省事，却制造持续冲突；提供替代活动确实需要更多创意，但长期效果好得多。

Rachid：我完全不赞成只按小时数设定上限，因为屏幕上的活动远不是一回事。连续三小时无脑刷短视频，和跟表兄弟一起剪辑家庭短片或规划旅行路线完全不同。不过，我在家里实行一条简单且不容商量的规则：吃饭时和晚上九点后在卧室里一律不准使用手机或平板。假期好不容易让全家人聚在一张桌旁，我拒绝大家住在同一屋檐下却各自缩在数字气泡里。

Élodie：老实说，在给孩子定严厉规矩之前，我觉得家长应该先审视自己的习惯。我的孩子就经常埋怨我在海滩上还偷看工作邮件，或在参观景点时回复消息。所以从去年夏天起，我承诺每周留一天把手机关机放在家里，全家人都陪我一起这么做。最开始这种数字静默甚至让人有点焦虑；如今它成了我们一周里最期待的一天。大人自己都做不到的自律，怎么能要求孩子做到。`,
    },
  ],
  questions: [
    { q: "Cette personne estime qu'une interdiction trop stricte risque d'augmenter l'envie d'utiliser les écrans.", options: ["Camille", "Rachid", "Élodie"], answer: 0, evidence: "des interdictions trop rigides ou des minuteurs imposés à tout bout de champ rendent les écrans encore plus désirables aux yeux des adolescents", trapTypes: ["✓ 对应 Camille", "张冠李戴", "张冠李戴"], why: "Camille：过于严格的禁令会让屏幕变得更有吸引力。", difficulty: 3, skill: "paraphrase" },
    { q: "Pour cette personne, ce que l'on fait devant un écran compte davantage que la durée totale.", options: ["Camille", "Rachid", "Élodie"], answer: 1, evidence: "Je ne suis pas du tout favorable à un plafond calculé uniquement en nombre d'heures par jour, car toutes les activités sur écran sont loin de se valoir", trapTypes: ["张冠李戴", "✓ 对应 Rachid", "张冠李戴"], why: "Rachid：刷三小时视频和剪辑短片不能一概而论。", difficulty: 3, skill: "paraphrase" },
    { q: "Cette personne considère que les adultes doivent d'abord changer leur propre comportement.", options: ["Camille", "Rachid", "Élodie"], answer: 2, evidence: "avant de fixer des règles strictes aux plus jeunes, je pense que les parents devraient commencer par examiner leurs propres réflexes numériques avec lucidité.", trapTypes: ["张冠李戴", "张冠李戴", "✓ 对应 Élodie"], why: "Élodie：家长应先审视自己，不能要求孩子做大人自己做不到的事。", difficulty: 2, skill: "opinion" },
    { q: "Cette personne interdit les appareils à certains moments et dans certaines pièces.", options: ["Camille", "Rachid", "Élodie"], answer: 1, evidence: "aucun téléphone ni aucune tablette pendant les repas ni dans les chambres le soir après vingt et une heures", trapTypes: ["张冠李戴", "✓ 对应 Rachid", "张冠李戴"], why: "Rachid：吃饭时和晚上九点后卧室内禁止使用手机或平板。", difficulty: 2, skill: "detail" },
    { q: "Selon cette personne, des loisirs attractifs suffisent souvent à éloigner spontanément les jeunes du téléphone.", options: ["Camille", "Rachid", "Élodie"], answer: 0, evidence: "lorsque nous partons randonner en montagne ou qu'ils passent la journée au lac avec des amis, ils oublient spontanément leur téléphone au fond du sac", trapTypes: ["✓ 对应 Camille", "张冠李戴", "张冠李戴"], why: "Camille：徒步或去湖边玩，孩子无需家长没收自己就会把手机忘在包里。", difficulty: 4, skill: "inference" },
    { q: "Cette personne a adopté avec ses proches une journée régulière de déconnexion complète.", options: ["Camille", "Rachid", "Élodie"], answer: 2, evidence: "j'ai donc pris l'engagement de laisser mon téléphone éteint à la maison une journée complète chaque semaine, et toute la famille joue le jeu avec moi", trapTypes: ["张冠李戴", "张冠李戴", "✓ 对应 Élodie"], why: "Élodie：全家每周一天把手机关机留在家里。", difficulty: 3, skill: "paraphrase" },
  ],
};

/* ==================== 阅读整套 2（25 分） ==================== */

const R2_LONG_1: Raw = {
  form: "long",
  topic: "travail",
  intro: "Vous lisez dans un quotidien économique une enquête sur l'organisation du temps de travail.",
  title: "La semaine de quatre jours à l'épreuve du terrain",
  docs: [
    {
      text: `Longtemps considérée comme une utopie sociale réservée à quelques start-up nordiques du secteur technologique, la semaine de quatre jours suscite aujourd'hui un intérêt grandissant en France comme dans le reste de l'Europe. Qu'il s'agisse de maintenir trente-cinq heures réparties sur quatre journées plus longues ou de réduire réellement la durée hebdomadaire sans baisse de salaire, plusieurs centaines d'entreprises privées et quelques collectivités locales ont lancé des expérimentations pilotes depuis deux ans. Les premiers bilans publiés par les chercheurs montrent toutefois une réalité bien plus nuancée que les slogans enthousiastes.

Dans le secteur du conseil, du numérique ou de l'industrie légère, les résultats sont souvent positifs lorsque la durée du travail est légèrement réduite et que l'organisation interne est sérieusement repensée. Chez Aurore Mécanique, une PME de cent vingt salariés près d'Angers passée à trente-deux heures en quatre jours sans diminution de rémunération, les arrêts maladie ont chuté de vingt-cinq pour cent en un an et le taux de démission est tombé au plus bas. « Les salariés arrivent beaucoup plus reposés le lundi matin et gèrent leurs rendez-vous médicaux ou administratifs le vendredi, indique la directrice, Claire Martin. En contrepartie, nous avons supprimé la moitié des réunions jugées inutiles, limité les interruptions par messagerie interne et instauré des plages de travail calme. » La productivité horaire a augmenté au point de maintenir le chiffre d'affaires annuel sans embauche supplémentaire.

En revanche, lorsque l'entreprise choisit de concentrer trente-cinq ou trente-neuf heures sur quatre jours seulement sans revoir la charge, la fatigue devient vite un problème sérieux. Dans plusieurs centres d'appels ou entrepôts logistiques étudiés récemment, travailler neuf heures et demie par jour dans un bruit constant ou face à un écran provoque une hausse des erreurs en fin d'après-midi, accroît les douleurs musculaires et complique l'organisation des parents qui doivent récupérer leurs jeunes enfants à la sortie de l'école. Selon l'ergonome Marc Delacroix, « compresser le temps sans réduire les objectifs quotidiens aboutit parfois à une intensification pénible plutôt qu'à un véritable progrès social ».

La question de l'équité entre métiers et entre territoires se pose également avec acuité. Dans un hôpital, un commissariat, un commerce de proximité ou une école primaire, il est impossible de fermer un jour supplémentaire par semaine sans recruter du personnel qualifié — un recrutement souvent hors de portée financière des petites structures ou difficile faute de candidats disponibles sur le marché. Certaines mairies ayant testé la formule pour leurs agents administratifs ont ainsi vu naître des tensions vives avec les équipes techniques ou de restauration scolaire, qui ne pouvaient pas bénéficier du même calendrier.

Pour les économistes du travail interrogés dans notre enquête, la semaine de quatre jours ne peut donc pas être imposée par une loi uniforme à l'ensemble des branches. Elle fonctionne efficacement là où les équipes acceptent de réorganiser en profondeur leurs méthodes et où la continuité du service le permet. Ailleurs, d'autres leviers comme des horaires plus souples, davantage de télétravail choisi ou des congés supplémentaires répondent parfois mieux aux attentes réelles des salariés sans fragiliser les petites entreprises.`,
      zh: `长期以来被视作少数北欧初创企业才有的社会乌托邦，四天工作周如今在法国引发了越来越浓厚的兴趣。无论是把三十五小时压缩到更长的四个工作日里，还是在不降薪的情况下真正减少每周工时，近两年来已有数百家私企和部分地方政府开展了试点。然而，研究人员公布的初步总结显示，现实图景远比乐观口号复杂得多。

在咨询、数字技术或轻工业领域，当工时略有缩减且工作流程经过重新梳理时，结果往往比较积极。在昂热附近一家拥有一百二十名员工的中小企业 Aurore Mécanique，公司改为四天三十二小时工作制且薪水不变，一年内员工病假减少了百分之二十五。“员工周一早上来上班时休息得更充分，周五可以处理个人事务，”经理 Claire Martin 表示，“作为配合，我们砍掉了一半被认为没必要的会议，并限制内部即时通讯的打扰。”每小时生产率随之提高，甚至维持了全年营业额。

相反，当企业选择仅仅把三十五或三十九小时硬塞进四天里时，疲劳很快成为严重问题。在一些呼叫中心或物流仓库，每天在持续噪音中或屏幕前工作九个半小时，导致下午临近下班时错误增多，也让需要按时接孩子放学的父母倍感困难。人类工效学专家 Marc Delacroix 指出：“只压缩天数却不减少工作负荷，有时换来的不是社会进步，而是痛苦的劳动高强度化。”

不同职业之间的公平性问题同样十分尖锐。在医院、警察局、街区小店或学校里，不招聘额外合格人员就无法每周多关门一天——而这笔招聘费用对小机构而言往往难以负担，或根本招不到人。一些曾对行政人员试行四天制的市政府，就曾因此引发行政岗与无法享受同样排班的技术维修或学校食堂团队之间的矛盾。

因此，劳动经济学家认为四天工作周不能靠一部“一刀切”的法律强制推行。只有当团队愿意深度重组工作方法且服务性质允许时，它才运转良好。在其他行业，更灵活的弹性上下班、更多自主选择的远程办公或额外假期，有时反而能更好地满足员工真实期待，同时不削弱中小企业的稳定性。`,
    },
  ],
  questions: [
    { q: "L'exemple de l'entreprise Aurore Mécanique montre que la semaine de quatre jours réussit surtout quand…", options: ["les salariés acceptent une baisse de salaire.", "l'organisation des tâches est profondément allégée.", "le chiffre d'affaires baisse la première année."], answer: 1, evidence: "nous avons supprimé la moitié des réunions jugées inutiles, limité les interruptions par messagerie interne et instauré des plages de travail calme.", trapTypes: ["正反颠倒（薪资未降）", "✓ 同义改写", "违背原文（营业额保持不变）"], why: "该企业成功不仅因减少工时，更因砍掉一半无用会议并减少消息打扰。", difficulty: 2, skill: "paraphrase" },
    { q: "Quel effet concret Claire Martin observe-t-elle depuis le changement ?", options: ["Une diminution importante des absences pour maladie.", "Une hausse des embauches dans le service commercial.", "Une prolongation des réunions du lundi matin."], answer: 0, evidence: "les arrêts maladie ont chuté de vingt-cinq pour cent en un an et le taux de démission est tombé au plus bas.", trapTypes: ["✓ 同义改写（arrêts maladie ont chuté）", "违背原文（未额外扩招）", "正反颠倒"], why: "原文明确提到病假（arrêts maladie）一年内下降了 25%。", difficulty: 1, skill: "detail" },
    { q: "Quel danger Marc Delacroix souligne-t-il lorsque les horaires journaliers sont allongés ?", options: ["Les salariés perdent leur droit aux congés payés.", "Le rythme devient épuisant faute de baisse de charge.", "Les entreprises doivent fermer le week-end."], answer: 1, evidence: "compresser le temps sans réduire les objectifs quotidiens aboutit parfois à une intensification pénible plutôt qu'à un véritable progrès social", trapTypes: ["无中生有", "✓ 同义改写（intensification pénible）", "无中生有"], why: "只压缩天数不减任务量，会导致高强度劳累和下午频出错。", difficulty: 3, skill: "paraphrase" },
    { q: "Pourquoi certaines mairies ont-elles rencontré des difficultés lors du test ?", options: ["Tous les services n'ont pas pu obtenir les mêmes horaires.", "Les habitants se sont plaints de la fermeture des écoles.", "La loi interdit ce rythme dans le secteur public."], answer: 0, evidence: "ont ainsi vu naître des tensions vives avec les équipes techniques ou de restauration scolaire, qui ne pouvaient pas bénéficier du même calendrier.", trapTypes: ["✓ 同义改写", "偷换矛盾主体", "违背原文"], why: "行政岗享受到四天制，但技术或食堂人员无法同样排班，引发内部摩擦。", difficulty: 3, skill: "detail" },
    { q: "Dans les secteurs comme la santé ou l'enseignement, l'obstacle principal est…", options: ["le refus des syndicats de travailler le vendredi.", "la nécessité et le coût de recruter davantage.", "le manque de bureaux pour accueillir le public."], answer: 1, evidence: "il est impossible de fermer un jour supplémentaire par semaine sans recruter du personnel qualifié — un recrutement souvent hors de portée financière", trapTypes: ["无中生有", "✓ 同义改写", "无中生有"], why: "必须增聘合格人手，但小机构财力难及且面临招工难。", difficulty: 3, skill: "paraphrase" },
    { q: "Quelle est la position des économistes cités en fin d'article ?", options: ["Il faut voter une réforme obligatoire pour tout le pays.", "Le modèle ne convient pas sous une forme unique à tous.", "Le télétravail doit être supprimé au profit de quatre jours."], answer: 1, evidence: "la semaine de quatre jours ne peut donc pas être imposée par une loi uniforme à l'ensemble des branches.", trapTypes: ["正反颠倒", "✓ 专家立场改写", "正反颠倒（弹性远程反而是替代手段）"], why: "他们认为不能靠统一法律硬性推行，其他行业用弹性工时等可能更合适。", difficulty: 4, skill: "opinion" },
    { q: "On comprend de cet article que le succès de la réforme dépend moins du nombre de jours que…", options: ["de l'accord entre la charge réelle et le métier.", "de l'âge moyen des dirigeants de PME.", "de la taille des locaux de l'entreprise."], answer: 0, evidence: "Elle fonctionne efficacement là où les équipes acceptent de réorganiser en profondeur leurs méthodes et où la continuité du service le permet.", trapTypes: ["✓ 全篇推断", "无中生有", "无中生有"], why: "综合全文，关键在于负荷是否真正适配、流程是否重构以及行业属性是否允许。", difficulty: 5, skill: "inference" },
  ],
};

const R2_LONG_2: Raw = {
  form: "long",
  topic: "environnement",
  intro: "Vous lisez dans un journal une analyse sur la gratuité des transports urbains.",
  title: "Transports publics gratuits : progrès écologique ou fausse bonne idée ?",
  docs: [
    {
      text: `Face à la hausse durable du prix des carburants et à l'urgence climatique, de plus en plus de maires envisagent de rendre les bus et les tramways gratuits pour tous les usagers. Après Dunkerque dès 2018 et quelques agglomérations de taille moyenne, Montpellier a franchi le pas fin 2023 pour l'ensemble des habitants de sa métropole. Partout en Europe, la mesure fait l'objet de vifs débats entre élus, usagers et chercheurs : permet-elle réellement de réduire la place de la voiture individuelle en ville, ou prive-t-elle au contraire les réseaux de ressources indispensables pour se moderniser ?

Les défenseurs de la gratuité mettent d'abord en avant l'argument social et pratique au quotidien. Dans les villes qui ont supprimé les billets pour les résidents, la fréquentation des transports en commun a rapidement augmenté de vingt à quarante pour cent dès la première année. Pour les ménages modestes, les étudiants ou les personnes âgées aux petites retraites, économiser cinquante à quatre-vingts euros d'abonnement par mois représente un gain immédiat de pouvoir d'achat. De plus, l'absence de contrôle et de vente de tickets à bord accélère l'embarquement aux arrêts, améliore la ponctualité aux heures de pointe et réduit sensiblement les conflits entre conducteurs et voyageurs.

Pourtant, les études indépendantes menées après la mise en place de ces projets tempèrent l'optimisme écologique affiché par certains élus. À Dunkerque comme à Tallinn, en Estonie, la majorité des nouveaux passagers sont en réalité d'anciens piétons ou cyclistes qui choisissent le bus dès qu'il pleut ou pour deux arrêts, plutôt que des automobilistes convaincus de laisser leur voiture au garage. Selon l'urbaniste Claire Rochefort, « ce qui dissuade un conducteur habituel de prendre le métro ou le tramway, ce n'est presque jamais le prix du ticket, qui reste très inférieur au coût de l'essence, de l'assurance et du stationnement ; c'est le manque de fréquence le soir, les correspondances trop longues ou l'absence de ligne directe vers les zones d'activité en périphérie ».

L'autre critique majeure porte sur le financement des réseaux à long terme. Dans une grande métropole, les recettes des billets et des abonnements représentent souvent entre vingt et trente-cinq pour cent du budget de fonctionnement annuel. Y renoncer oblige les collectivités à compenser par une hausse de la taxe versée par les entreprises locales ou par d'autres impôts locaux déjà élevés. Les opposants redoutent qu'un réseau privé de ces revenus directs n'ait plus les moyens d'acheter des rames plus rapides, d'électrifier sa flotte de bus ou de prolonger les lignes vers les quartiers périphériques mal desservis.

Plutôt que d'opposer gratuité totale et tarif plein uniforme, plusieurs spécialistes de la mobilité plaident donc pour une tarification solidaire ciblée. Maintenir la gratuité pour les jeunes, les chômeurs et les foyers aux revenus faibles, tout en investissant massivement dans la ponctualité, l'amplitude horaire et la fréquence des bus pour les autres usagers, apparaît souvent comme un compromis plus efficace pour encourager un véritable report modal durable.`,
      zh: `面对燃油价格上涨和气候紧迫挑战，越来越多的市长考虑对所有乘客免费开放公交和有轨电车。继敦刻尔克于 2018 年率先实施之后，蒙彼利埃也在 2023 年底为都会区全体居民推出了免费政策。在整个欧洲，这项措施引发广泛争论：它真的能减少城市中的私家车数量，还是会夺走公交网络升级改进所急需的资金来源？

支持免费的一方首先强调社会效益与便利性。在取消车票的城市里，公共交通客流量很快增长了百分之二十到四十。对于低收入家庭、学生或老年人而言，每月省下五十至八十欧元的月票费用意味着购买力的直接提升。此外，无需检票和售票还能加快站点上下客速度，减少司机与乘客之间的纠纷。

然而，在这些项目实施后开展的调研却给市长的环保乐观情绪浇了冷水。无论在敦刻尔克还是塔林，新增乘客中的大多数其实原本是步行者或骑行者，只是在下雨或坐两站路时改乘公交，而不是把车留在车库里的私家车主。城市规划师 Claire Rochefort 表示：“阻碍车主改乘地铁或电车的，几乎从来不是远低于油费和停车费的票价，而是晚间班次太少、换乘耗时太长或缺乏直达工作地点的线路。”

另一大主要批评集中在长期财政可持续性上。在大型都会区，售票收入通常占公交系统运营预算的百分之二十到三十五。放弃这笔收入会迫使地方政府通过提高本地企业税或其他税种来填补缺口。反对者担心，失去票款收入的系统将无力购置更快的新车厢、推进车队电动化，或将线路延伸至交通不便的远郊街区。

因此，不少专家并不把“全面免费”和“全额收费”简单对立，而是主张精准的帮扶票价。对青年、失业者和低收入家庭实行免费，同时把资金重点投入到提高准点率与发车频次上，往往被视为更有效促使车主真正长期改乘公共交通的折中方案。`,
    },
  ],
  questions: [
    { q: "L'article examine principalement si la gratuité des transports…", options: ["améliore réellement l'écologie urbaine sans affaiblir le réseau.", "permet aux conducteurs de travailler moins d'heures.", "remplace l'achat de vélos électriques par les mairies."], answer: 0, evidence: "permet-elle réellement de réduire la place de la voiture individuelle en ville, ou prive-t-elle au contraire les réseaux de ressources indispensables pour se moderniser ?", trapTypes: ["✓ 主旨概括", "无中生有", "偷换话题"], why: "导语点明争论核心：是否真能减少汽车并同时维持公交网升级所需财力。", difficulty: 2, skill: "gist" },
    { q: "Outre le gain financier pour les ménages, quel avantage pratique est observé dans les bus ?", options: ["Les bus roulent à plus grande vitesse sur les boulevards.", "La montée des passagers est plus fluide et apaisée.", "Le nombre de lignes de nuit double immédiatement."], answer: 1, evidence: "l'absence de contrôle et de vente de tickets à bord accélère l'embarquement aux arrêts, améliore la ponctualité aux heures de pointe et réduit sensiblement les conflits", trapTypes: ["曲解细节", "✓ 同义改写（embarquement + moins de conflits）", "捏造事实"], why: "不检票售票加快了站点登车速度，也减少了司乘摩擦。", difficulty: 2, skill: "detail" },
    { q: "Que révèlent les enquêtes menées à Dunkerque et à Tallinn ?", options: ["Les automobilistes ont massivement abandonné leur voiture.", "La hausse de fréquentation vient surtout d'anciens marcheurs ou cyclistes.", "Les recettes touristiques ont compensé le coût du réseau."], answer: 1, evidence: "la majorité des nouveaux passagers sont en réalité d'anciens piétons ou cyclistes qui choisissent le bus dès qu'il pleut ou pour deux arrêts", trapTypes: ["正反颠倒", "✓ 同义改写（piétons -> marcheurs）", "无中生有"], why: "多数新乘客原本走路或骑车，并不是弃用私家车的车主。", difficulty: 3, skill: "detail" },
    { q: "Selon Claire Rochefort, pourquoi beaucoup d'automobilistes gardent-ils leur voiture ?", options: ["Ils trouvent le prix du ticket mensuel trop élevé.", "L'offre de transport ne correspond pas encore à leurs trajets.", "Ils craignent les retards liés à la vente des billets."], answer: 1, evidence: "c'est le manque de fréquence le soir, les correspondances trop longues ou l'absence de ligne directe vers les zones d'activité en périphérie", trapTypes: ["正反颠倒（票价几乎从不是阻碍）", "✓ 同义归纳", "张冠李戴"], why: "阻碍在于晚间班次少、换乘慢或没有直达线路，而非票价。", difficulty: 3, skill: "paraphrase" },
    { q: "Quel risque financier les opposants redoutent-ils si l'on supprime les billets ?", options: ["Une baisse des salaires des conducteurs de tramway.", "Moins de moyens pour moderniser et étendre les lignes.", "La fermeture des parkings situés en centre-ville."], answer: 1, evidence: "Les opposants redoutent qu'un réseau privé de ces revenus directs n'ait plus les moyens d'acheter des rames plus rapides, d'électrifier sa flotte de bus ou de prolonger les lignes", trapTypes: ["无中生有", "✓ 同义改写", "无中生有"], why: "失去 20%–35% 预算收入可能无力购置更快车辆、电动化或向远郊延线。", difficulty: 3, skill: "paraphrase" },
    { q: "Que recommandent les spécialistes en fin d'article ?", options: ["Rendre le stationnement gratuit à la place des bus.", "Réserver la gratuité aux publics fragiles et investir dans le service.", "Supprimer les bus dans les quartiers où les gens marchent."], answer: 1, evidence: "Maintenir la gratuité pour les jeunes, les chômeurs et les foyers aux revenus faibles, tout en investissant massivement dans la ponctualité, l'amplitude horaire et la fréquence", trapTypes: ["荒谬干扰", "✓ 同义改写", "无中生有"], why: "主张对弱势群体定向免费，同时把资金重点投入提高班次和准点率。", difficulty: 4, skill: "opinion" },
    { q: "On peut déduire du texte que le prix du billet n'est pas…", options: ["un facteur suffisant à lui seul pour changer les habitudes des conducteurs.", "une ressource utile pour les budgets municipaux.", "un obstacle pour les déplacements des personnes âgées."], answer: 0, evidence: "ce qui dissuade un conducteur habituel de prendre le métro ou le tramway, ce n'est presque jamais le prix du ticket", trapTypes: ["✓ 严谨推断", "违背原文（占预算20%-35%）", "违背原文"], why: "全篇论证说明单靠免费票价本身不足以让车主弃车改乘，服务质量和覆盖更关键。", difficulty: 5, skill: "inference" },
  ],
};

const R2_OPINIONS: Raw = {
  form: "opinions",
  topic: "consommation",
  intro: "Vous lisez l'opinion de ces trois personnes sur un forum consacré à la mode de seconde main.",
  title: "Acheter des vêtements d'occasion : vrai geste écologique ou nouvelle façon de surconsommer ?",
  docs: [
    {
      text: `Lucie
Quand j'ai commencé à acheter mes manteaux, mes chaussures et mes pulls sur des applications de seconde main entre particuliers, je pensais faire un grand geste concret pour la planète. Mais au bout d'un an, j'ai dû me rendre à l'évidence : comme les prix affichés sont très bas et qu'on peut revendre facilement ce qui ne nous plaît plus au bout de deux semaines, je me suis mise à commander trois ou quatre colis par mois, bien plus qu'avant dans les magasins traditionnels. Au lieu de réfléchir vraiment à mes besoins, je passe désormais mes soirées à guetter les bonnes affaires en ligne et à recevoir des cartons envoyés d'un bout à l'autre du pays. Pour moi, la seconde main ne devient véritablement écologique que si l'on garde d'abord ses vêtements longtemps au lieu d'alimenter ce renouvellement permanent.

Antoine
Il ne faut quand même pas jeter la pierre à tous ceux qui achètent d'occasion aujourd'hui ! Avec l'inflation actuelle sur l'énergie et les courses, tout le monde n'a pas les moyens financiers d'acheter des marques durables à cent cinquante euros le pantalon ou deux cents euros la paire de bottes. Dans ma famille avec deux adolescents qui grandissent à vue d'œil, les vide-greniers associatifs et les friperies de quartier nous permettent de nous habiller correctement et chaudement en hiver sans sacrifier notre budget alimentaire, tout en évitant que des pièces encore impeccables ne partent directement à la décharge. Certes, quelques personnes abusent des plateformes en ligne par jeu ou par ennui, mais dans l'ensemble, prolonger la vie d'un vêtement déjà fabriqué reste nettement préférable à l'achat de textile neuf bas de gamme.

Nadia
Ce qui me gêne le plus aujourd'hui, ce n'est pas du tout l'occasion entre particuliers ou le don dans une boutique solidaire locale, c'est le virage opportuniste pris par les grandes enseignes industrielles du textile. Plusieurs chaînes de mode rapide installent désormais des rayons « seconde main » très visibles à l'entrée de leurs magasins tout en continuant à produire des millions de vêtements neufs chaque saison à l'autre bout du monde. Le plus souvent, le client qui dépose ses vieux habits reçoit en échange un bon d'achat limité dans le temps, qui l'encourage aussitôt à repartir du magasin avec un article neuf de la dernière collection. J'ai bien peur que ce discours vert soigneusement mis en scène ne serve surtout d'argument publicitaire pour nous donner bonne conscience, sans rien changer au modèle de surproduction.`,
      zh: `Lucie：当我刚开始在二手软件上买大衣和毛衣时，我以为自己是在为地球做一件大好事。但一年之后我不得不面对现实：由于价格便宜而且不喜欢的还能轻松转卖，我变得每个月都要下三四个订单，比以前买得多得多。我非但没有真正思考自己的需求，反而每晚都在网上蹲守捡漏。对我来说，只有先做到长久穿着一件衣服，而不是助长这种不断换新的循环，二手才称得上环保。

Antoine：无论如何也不能一味责怪买二手的人！面对当下的通胀，并不是人人都有财力去买一百五十欧元一条的耐穿品牌裤子。在我家有两个长得很快的青少年，社区旧货集市和街区二手店让我们不用挤占买菜预算也能穿得体面，同时避免了还崭新的衣物被送进垃圾场。诚然少数人在网购平台上过度下单，但总体来看，延长一件已制成衣服的寿命依然明显好过买廉价新快消品。

Nadia：今天最让我反感的并不是本地小店里普通人之间的二手交易，而是大型工业服装品牌做出的转向。多家快时尚连锁如今在店里设立“二手专区”，同时每季继续生产数百万件新衣。大多数情况下，顾客交回旧衣服拿到的是代金券，立刻又被诱导着拎走一件新衣服。我实在担心这种环保说辞主要沦为广告噱头，让人心安理得地继续消费，却丝毫没有改变生产模式。`,
    },
  ],
  questions: [
    { q: "Cette personne reconnaît que la facilité d'achat l'a poussée à commander plus qu'avant.", options: ["Lucie", "Antoine", "Nadia"], answer: 0, evidence: "je me suis mise à commander trois ou quatre colis par mois, bien plus qu'avant dans les magasins traditionnels.", trapTypes: ["✓ 对应 Lucie", "张冠李戴", "张冠李戴"], why: "Lucie：价格便宜且易转卖使她每月买三四个包裹，比以前更多。", difficulty: 2, skill: "detail" },
    { q: "Pour cette personne, l'occasion aide surtout les foyers à faire face au coût de la vie.", options: ["Lucie", "Antoine", "Nadia"], answer: 1, evidence: "les vide-greniers associatifs et les friperies de quartier nous permettent de nous habiller correctement et chaudement en hiver sans sacrifier notre budget alimentaire", trapTypes: ["张冠李戴", "✓ 对应 Antoine", "张冠李戴"], why: "Antoine：在通胀下帮助有两个青少年的家庭体面穿衣而不挤占食物预算。", difficulty: 2, skill: "paraphrase" },
    { q: "Cette personne critique les grandes marques qui utilisent l'occasion comme vitrine publicitaire.", options: ["Lucie", "Antoine", "Nadia"], answer: 2, evidence: "J'ai bien peur que ce discours vert soigneusement mis en scène ne serve surtout d'argument publicitaire pour nous donner bonne conscience", trapTypes: ["张冠李戴", "张冠李戴", "✓ 对应 Nadia"], why: "Nadia：批评快时尚连锁拿二手专区当广告噱头、并用代金券诱导继续买新衣。", difficulty: 3, skill: "opinion" },
    { q: "Cette personne pense que la véritable écologie passe d'abord par le fait de garder ses habits plus longtemps.", options: ["Lucie", "Antoine", "Nadia"], answer: 0, evidence: "la seconde main ne devient véritablement écologique que si l'on garde d'abord ses vêtements longtemps au lieu d'alimenter ce renouvellement permanent.", trapTypes: ["✓ 对应 Lucie", "张冠李戴", "张冠李戴"], why: "Lucie：只有先长久穿着手里的衣服，二手才算环保。", difficulty: 3, skill: "paraphrase" },
    { q: "Malgré certains excès, cette personne juge que le réemploi vaut mieux que le neuf bon marché.", options: ["Lucie", "Antoine", "Nadia"], answer: 1, evidence: "prolonger la vie d'un vêtement déjà fabriqué reste nettement préférable à l'achat de textile neuf bas de gamme.", trapTypes: ["张冠李戴", "✓ 对应 Antoine", "张冠李戴"], why: "Antoine：即使有人在平台买得多，延长已制衣物的寿命仍明显好过买廉价新衣。", difficulty: 3, skill: "opinion" },
    { q: "Cette personne déplore que les reprises en boutique servent surtout à relancer la vente de neuf.", options: ["Lucie", "Antoine", "Nadia"], answer: 2, evidence: "reçoit en échange un bon d'achat limité dans le temps, qui l'encourage aussitôt à repartir du magasin avec un article neuf de la dernière collection.", trapTypes: ["张冠李戴", "张冠李戴", "✓ 对应 Nadia"], why: "Nadia：交旧衣换代金券会让人马上又买一件新衣。", difficulty: 4, skill: "inference" },
  ],
};


/* ==================== 阅读整套 3（25 分 · 2020 新版考纲纯三选一 QCM） ==================== */

const R3_LONG_1: Raw = {
  "form": "long",
  "topic": "sciences-ethique",
  "intro": "Dans un magazine scientifique francophone, vous lisez cet article sur l'usage de l'intelligence artificielle dans les diagnostics médicaux.",
  "title": "L’intelligence artificielle au service du diagnostic médical : progrès ou danger ?",
  "docs": [
    {
      "text": "Depuis quelques années, l’intelligence artificielle (IA) s’invite dans les hôpitaux et les cabinets médicaux. Selon une étude publiée en 2023, 38% des établissements de santé français utilisent déjà des outils d’IA pour aider à poser des diagnostics, notamment dans le domaine de l’imagerie médicale. Cette technologie s’appuie sur l’analyse de grandes quantités de données médicales, telles que des radiographies, des scanners ou des dossiers patients, pour détecter des anomalies parfois imperceptibles à l’œil humain. Par exemple, dans plusieurs hôpitaux parisiens, des logiciels d’IA sont utilisés pour trier automatiquement les images de mammographie et signaler les cas suspects aux radiologues, ce qui permet de réduire les délais de prise en charge.\nPour le professeur Alain Dubois, chef du service de radiologie à Lyon, ces technologies représentent « une avancée majeure ». Il affirme : « Grâce à l’IA, nous détectons plus précocement certains cancers, ce qui améliore considérablement les chances de guérison. » En effet, une récente expérimentation menée sur 1 200 patients a montré que l’IA permettait d’identifier des anomalies invisibles à l’œil humain dans 17% des cas. Un exemple concret est celui d’un patient de 54 ans chez qui une tumeur pulmonaire a été repérée par un algorithme, alors que les médecins n’avaient rien détecté lors de la première lecture.\nCependant, tout le monde ne partage pas cet enthousiasme. La docteure Sophie Martin, généraliste à Paris, met en garde contre une confiance excessive dans ces systèmes. « L’IA ne remplace pas le jugement clinique du médecin. Il existe toujours un risque d’erreur, surtout si l’on s’appuie uniquement sur la machine », souligne-t-elle. Elle rappelle que, selon une enquête menée en 2022, 12% des diagnostics assistés par IA se sont révélés incorrects. Elle cite le cas d’un patient dont l’IA avait écarté une infection grave, alors que le médecin, grâce à son expérience, a su insister pour réaliser des examens complémentaires. Pour la docteure Martin, l’IA doit rester un outil d’aide à la décision, mais ne doit jamais remplacer l’expertise humaine, notamment dans les situations complexes ou atypiques.\nUn autre enjeu concerne la protection des données médicales. Les logiciels d’IA nécessitent l’accès à d’importantes quantités d’informations personnelles pour fonctionner efficacement. Or, la Commission nationale de l’informatique et des libertés (CNIL) a déjà signalé plusieurs failles de sécurité en 2021, dont une ayant exposé les dossiers de 5 000 patients. Cette fuite a suscité l’inquiétude de nombreux professionnels de santé, qui craignent que des données sensibles puissent être utilisées à des fins commerciales ou tomber entre de mauvaises mains. Certains experts estiment que le développement de l’IA doit impérativement s’accompagner de garanties strictes en matière de confidentialité et de transparence sur l’utilisation des données.\nMalgré ces réserves, le ministère de la Santé encourage le développement de l’IA dans le secteur médical. Il a investi 45 millions d’euros en 2023 pour financer des projets innovants, tout en promettant de renforcer la réglementation sur la sécurité des données. Des appels à projets ont permis de soutenir des start-ups françaises spécialisées dans la détection précoce des maladies chroniques ou dans l’analyse automatisée des dossiers médicaux. Le gouvernement insiste sur la nécessité de trouver un équilibre entre innovation et sécurité, en veillant à ce que l’IA bénéficie à tous les patients, y compris dans les zones rurales où l’accès aux spécialistes est parfois limité.",
      "zh": "近年来，人工智能（AI）逐渐进入医院和诊所。根据2023年发布的一项研究，法国已有38%的医疗机构在诊断中使用AI工具，尤其是在医学影像领域。这项技术依赖于对大量医学数据的分析，如X光片、CT扫描或病历，用于发现肉眼难以察觉的异常。例如，在巴黎的多家医院，AI软件被用于自动筛查乳腺X光片，将可疑病例标记给放射科医生，从而缩短了诊疗时间。\n里昂放射科主任阿兰·杜布瓦教授认为，这些技术是“重大进步”。他表示：“借助AI，我们能更早发现某些癌症，这大大提高了治愈的机会。”事实上，一项针对1200名患者的最新实验显示，AI在17%的病例中能识别出肉眼无法察觉的异常。具体来说，有一位54岁的患者，其肺部肿瘤是通过AI算法发现的，而医生初次检查时并未察觉。\n然而，并非所有人都持乐观态度。巴黎全科医生索菲·马丁提醒人们不要对这些系统过度信任。“AI不能取代医生的临床判断。如果只依赖机器，总会有出错的风险。”她指出。她还提到，根据2022年的一项调查，12%的AI辅助诊断结果是错误的。她举例说，有一位患者被AI排除了严重感染，但凭借经验，医生坚持做了进一步检查，最终发现了问题。马丁医生认为，AI应作为辅助决策的工具，而不能取代人类的专业判断，尤其是在复杂或特殊病例中。\n另一个问题是医疗数据的保护。AI软件需要大量个人信息才能高效运行。而国家信息与自由委员会（CNIL）在2021年已报告多起安全漏洞，其中一起导致5000名患者的档案被泄露。这一事件引发了许多医务人员的担忧，他们担心敏感数据被用于商业目的或落入不法分子手中。有专家认为，AI的发展必须严格保障数据的机密性和透明度。\n尽管存在这些担忧，卫生部仍鼓励在医疗领域发展AI。2023年，政府为创新项目投入了4500万欧元，并承诺加强数据安全监管。通过项目招标，支持了多家专注于慢性病早期检测或自动化病历分析的法国初创企业。政府强调要在创新与安全之间取得平衡，确保AI惠及所有患者，包括那些在农村地区难以获得专家服务的人群。"
    }
  ],
  "questions": [
    {
      "q": "Quel rôle concret jouent déjà les logiciels d’intelligence artificielle dans certains hôpitaux parisiens ?",
      "options": [
        "Ils réalisent seuls les interventions chirurgicales urgentes.",
        "Ils repèrent à l’avance les clichés radiologiques méritant un examen attentif.",
        "Ils rédigent directement les ordonnances sans validation médicale."
      ],
      "answer": 1,
      "evidence": "des logiciels d’IA sont utilisés pour trier automatiquement les images de mammographie et signaler les cas suspects aux radiologues",
      "trapTypes": ["夸大功能（非独立手术）", "✓ 同义改写（trier les images + signaler les cas suspects）", "绝对化捏造"],
      "why": "第一段说明巴黎多家医院用 AI 软件自动筛查乳腺影像并向放射科医生提示可疑病例，缩短接诊等待。",
      "difficulty": 2,
      "skill": "paraphrase"
    },
    {
      "q": "Pourquoi le professeur Alain Dubois juge-t-il l’apport de ces algorithmes décisif ?",
      "options": [
        "Ils permettent de repérer certaines lésions avant même qu’un médecin ne les distingue.",
        "Ils suppriment le besoin de mener des essais cliniques sur les patients.",
        "Ils divisent par deux le coût des appareils de radiologie."
      ],
      "answer": 0,
      "evidence": "l’IA permettait d’identifier des anomalies invisibles à l’œil humain dans 17% des cas.",
      "trapTypes": ["✓ 同义改写（anomalies invisibles à l’œil humain）", "无中生有", "偷换概念"],
      "why": "第二段指出在1200名患者实验中，AI 在17%的病例中识别出了肉眼尚难察觉的早期异常，从而提高治愈希望。",
      "difficulty": 2,
      "skill": "paraphrase"
    },
    {
      "q": "Quelle mise en garde formule la docteure Sophie Martin face à ces outils ?",
      "options": [
        "Le coût excessif des logiciels pénalise les cabinets de quartier.",
        "Le manque d’entraînement informatique décourage les jeunes médecins.",
        "Se fier aveuglément au verdict algorithmique expose à de graves erreurs."
      ],
      "answer": 2,
      "evidence": "Il existe toujours un risque d’erreur, surtout si l’on s’appuie uniquement sur la machine",
      "trapTypes": ["无中生有", "张冠李戴", "✓ 立场同义改写（s’appuyer uniquement sur la machine）"],
      "why": "第三段马丁医生强调若单纯依赖机器而不结合临床经验判断，始终存在漏诊或误判风险。",
      "difficulty": 3,
      "skill": "opinion"
    },
    {
      "q": "Que démontre l’exemple du patient souffrant d’une infection grave cité au troisième paragraphe ?",
      "options": [
        "L’intuition et le recul du praticien restent indispensables lorsque l’algorithme se trompe.",
        "Les examens complémentaires deviennent inutiles dès que le logiciel valide un dossier.",
        "Les erreurs de diagnostic proviennent uniquement d’une mauvaise saisie informatique."
      ],
      "answer": 0,
      "evidence": "l’IA avait écarté une infection grave, alors que le médecin, grâce à son expérience, a su insister pour réaliser des examens complémentaires.",
      "trapTypes": ["✓ 论据功能推断", "正反颠倒", "绝对化归因"],
      "why": "AI 排除了严重感染，幸亏医生凭临床经验坚持追加检查才查明病情，印证人类专业判断不可替代。",
      "difficulty": 4,
      "skill": "inference"
    },
    {
      "q": "Quel enseignement faut-il tirer des signalements effectués par la CNIL en 2021 ?",
      "options": [
        "Aucune fuite de dossiers médicaux n’a encore touché les hôpitaux français.",
        "La centralisation massive de dossiers sensibles comporte des vulnérabilités bien réelles.",
        "Les entreprises privées ont désormais interdiction de concevoir des outils médicaux."
      ],
      "answer": 1,
      "evidence": "la Commission nationale de l’informatique et des libertés (CNIL) a déjà signalé plusieurs failles de sécurité en 2021, dont une ayant exposé les dossiers de 5 000 patients.",
      "trapTypes": ["否定陷阱（正反颠倒）", "✓ 同义改写（plusieurs failles + 5 000 dossiers exposés）", "违背第五段（政府正资助初创企业）"],
      "why": "第四段指出 CNIL 已通报多起安全漏洞（其中一起暴露五千份病历），说明海量敏感医疗数据确实面临泄密风险。",
      "difficulty": 3,
      "skill": "negation"
    },
    {
      "q": "Quelle ligne d’action le ministère de la Santé privilégie-t-il face à l’essor de l’IA ?",
      "options": [
        "Soutenir financièrement l’innovation tout en encadrant plus strictement la confidentialité.",
        "Suspendre les aides publiques tant que le risque zéro n’est pas garanti.",
        "Réserver ces technologies aux seuls centres hospitaliers parisiens."
      ],
      "answer": 0,
      "evidence": "Il a investi 45 millions d’euros en 2023 pour financer des projets innovants, tout en promettant de renforcer la réglementation sur la sécurité des données.",
      "trapTypes": ["✓ 同义改写（资助创新 + 强化数据监管）", "正反颠倒", "违背末句（明确提及惠及农村地区）"],
      "why": "第五段表明卫生部一边投入4500万欧元扶持创新项目，一边承诺收紧数据安全法规，兼顾创新与安全。",
      "difficulty": 3,
      "skill": "gist"
    },
    {
      "q": "Que suggère la fin de l’article quant à l’intérêt potentiel de l’IA pour les territoires ruraux ?",
      "options": [
        "Elle pourrait atténuer en partie les difficultés d’accès aux médecins spécialistes.",
        "Elle conduira rapidement à fermer les derniers cabinets de médecine générale.",
        "Elle ne pourra pas y fonctionner faute d’archives papier suffisantes."
      ],
      "answer": 0,
      "evidence": "en veillant à ce que l’IA bénéficie à tous les patients, y compris dans les zones rurales où l’accès aux spécialistes est parfois limité.",
      "trapTypes": ["✓ 结尾隐含推断", "过度外推", "无中生有"],
      "why": "末句点明要让包括专家资源匮乏的农村地区在内的全体患者受益，可推知其有望缓解偏远地区看专科难的问题。",
      "difficulty": 5,
      "skill": "inference"
    }
  ]
};

const R3_LONG_2: Raw = {
  "form": "long",
  "topic": "logement-urbanisme",
  "intro": "Vous lisez cette enquête dans un quotidien national sur l'encadrement des loyers et les locations touristiques dans les grandes villes.",
  "title": "Loyers sous contrôle : un défi pour les métropoles françaises",
  "docs": [
    {
      "text": "Face à la flambée des prix de l’immobilier, plusieurs grandes villes françaises ont mis en place des mesures pour encadrer les loyers. À Paris, le plafond fixé en 2022 limite le loyer moyen à 38 euros le mètre carré, soit une hausse de 3% par rapport à l’année précédente. Cette mesure vise à freiner la hausse continue des loyers, qui pèse lourdement sur les budgets des ménages, en particulier chez les jeunes actifs et les familles modestes. À Marseille et Lille, des dispositifs similaires ont été adoptés, mais avec des plafonds adaptés au marché local.\nPourtant, de nombreux locataires dénoncent des abus. Selon une enquête menée par l’association Droit au Logement, 27% des baux signés en 2023 dépassaient le plafond légal. « Certains propriétaires profitent du manque de contrôles pour augmenter les loyers », explique Julie Laurent, porte-parole de l’association. Camille, locataire à Paris depuis 5 ans, témoigne : « Mon propriétaire a augmenté mon loyer de 80 euros sans justification, alors que je savais que le plafond n’était pas respecté. J’ai hésité à porter plainte, mais la procédure est longue et compliquée. » Un autre locataire, Rachid, habitant à Lyon, ajoute : « Même avec l’encadrement, il est difficile de trouver un logement abordable. Beaucoup de propriétaires demandent des compléments de loyer injustifiés. » Ces situations créent un sentiment d’injustice et de frustration chez de nombreux habitants.\nEn parallèle, la multiplication des locations touristiques via des plateformes comme Airbnb aggrave la pénurie de logements disponibles à long terme. À Lyon, on estime que 6 000 appartements sont loués en courte durée, soit 4% du parc locatif privé. Pour Pierre Martin, agent immobilier, « la location touristique prive les habitants de logements abordables ». Il précise que dans certains quartiers du centre-ville, près d’un logement sur cinq est proposé à la location saisonnière, ce qui fait grimper les prix et pousse les familles à s’éloigner. Julie Laurent ajoute : « On voit des immeubles entiers transformés en locations de vacances, au détriment des résidents permanents. »\nLes municipalités tentent de réagir. À Bordeaux, la mairie a instauré une amende de 5 000 euros pour les propriétaires qui ne respectent pas la réglementation. Malgré cela, le nombre d’annonces touristiques a augmenté de 12% en 2023. À Nice, la mairie a mis en place un service de contrôle dédié, mais les moyens restent limités face à la multiplication des plateformes. Un économiste du logement, Thomas Girard, analyse : « L’encadrement des loyers est utile mais insuffisant s’il n’est pas accompagné de contrôles efficaces et de mesures contre la spéculation. Dans certaines villes comme Berlin ou Barcelone, des politiques plus strictes ont permis de stabiliser les loyers, mais au prix d’un marché locatif parfois plus rigide. »\nCertains experts estiment que l’encadrement des loyers n’est pas suffisant. Selon une étude de l’INSEE, le revenu médian des ménages locataires à Paris a baissé de 2% en deux ans, tandis que le coût du logement continue de grimper. À Lyon, la part du budget consacrée au logement atteint désormais 38% pour les locataires, contre 32% il y a cinq ans. Pour résoudre la crise, beaucoup plaident pour une politique nationale plus ambitieuse, combinant encadrement strict et construction de nouveaux logements. Thomas Girard conclut : « Il faut agir sur tous les leviers : réguler les loyers, lutter contre les abus, mais aussi accélérer la construction de logements sociaux et intermédiaires. »",
      "zh": "面对房价飙升，法国多座大城市出台了租金管控措施。2022年，巴黎设定的上限将平均租金限制在每平方米38欧元，比前一年上涨了3%。这一措施旨在遏制租金的持续上涨，减轻家庭，尤其是年轻人和低收入家庭的经济压力。马赛和里尔等地也采取了类似的政策，但根据当地市场设定了不同的上限。\n然而，许多租户仍然抱怨违规行为。根据住房权利协会进行的一项调查，2023年签署的租约中有27%超过了法定上限。“一些房东利用监管不足提高租金。”该协会发言人朱莉·洛朗解释道。巴黎租户卡米耶表示：“我的房东无故把房租涨了80欧元，我明知道超过了上限，但投诉程序又长又复杂。”里昂的租户拉希德补充说：“即使有管控，找到负担得起的住房还是很难。很多房东还会额外收取不合理的费用。”这些情况让许多居民感到不公和无奈。\n与此同时，通过Airbnb等平台的短租增加，加剧了长期住房的短缺。在里昂，估计有6000套公寓用于短租，占私人出租房源的4%。房地产经纪人皮埃尔·马丁表示：“短租让居民失去了负担得起的住房。”他补充说，在市中心某些街区，五分之一的住房都被用作季节性出租，推高了房价，迫使家庭搬离。朱莉·洛朗还说：“我们看到整栋楼都变成了度假公寓，常住居民被挤出去了。”\n市政府正在努力应对。在波尔多，市政府对不遵守规定的房东处以5000欧元罚款。尽管如此，2023年短租广告数量仍增长了12%。尼斯市政府设立了专门的监管部门，但面对平台数量的增加，力量仍然有限。住房经济学家托马斯·吉拉尔分析道：“租金管控有用，但如果没有有效监管和反投机措施，作用有限。在柏林和巴塞罗那等城市，更严格的政策确实稳定了租金，但也让租赁市场变得僵化。”\n一些专家认为，租金管控措施还不够。根据INSEE的一项研究，巴黎租户家庭的中位收入两年内下降了2%，而住房成本持续上涨。在里昂，租户用于住房的预算比例已达38%，而五年前为32%。为解决危机，许多人呼吁出台更有力的全国性政策，既要严格管控，也要新建住房。吉拉尔总结道：“要多管齐下：规范租金、打击违规，还要加快建设社会和中等价位住房。”"
    }
  ],
  "questions": [
    {
      "q": "Dans quel but plusieurs métropoles françaises ont-elles instauré des plafonds de loyers ?",
      "options": [
        "Pour uniformiser les tarifs immobiliers entre Paris, Lille et Marseille.",
        "Pour contenir l’envolée des dépenses de logement qui fragilise les ménages.",
        "Pour obliger les propriétaires anciens à vendre leurs appartements à la mairie."
      ],
      "answer": 1,
      "evidence": "Cette mesure vise à freiner la hausse continue des loyers, qui pèse lourdement sur les budgets des ménages, en particulier chez les jeunes actifs et les familles modestes.",
      "trapTypes": ["违背原文（各地按本地市场设定不同上限）", "✓ 同义改写（freiner la hausse -> contenir l’envolée）", "无中生有"],
      "why": "第一段说明限租旨在遏制房租持续上涨、减轻年轻上班族和低收入家庭的预算重担，且马赛和里尔采用适配本地市场的不同上限。",
      "difficulty": 2,
      "skill": "paraphrase"
    },
    {
      "q": "Pourquoi les dépassements illégaux de loyers restent-ils fréquents selon le deuxième paragraphe ?",
      "options": [
        "Les sanctions ont été supprimées par les tribunaux en 2023.",
        "La faiblesse des vérifications et la lourdeur des recours découragent les locataires.",
        "Les contrats signés par les jeunes actifs échappent légalement au dispositif."
      ],
      "answer": 1,
      "evidence": "Certains propriétaires profitent du manque de contrôles pour augmenter les loyers",
      "trapTypes": ["捏造事实", "✓ 因果整合改写（manque de contrôles + procédure longue et compliquée）", "偷换概念"],
      "why": "第二段指出27%新签租约超标，源于监管不足加上租客维权申诉流程冗长繁琐，令不少人望而却步。",
      "difficulty": 3,
      "skill": "paraphrase"
    },
    {
      "q": "Quel reproche Pierre Martin et Julie Laurent adressent-ils aux locations saisonnières en centre-ville ?",
      "options": [
        "Elles dégradent rapidement les façades des immeubles anciens.",
        "Elles réduisent l’offre pérenne et chassent peu à peu les habitants à l’année.",
        "Elles font chuter les recettes fiscales des commerces de quartier."
      ],
      "answer": 1,
      "evidence": "près d’un logement sur cinq est proposé à la location saisonnière, ce qui fait grimper les prix et pousse les familles à s’éloigner.",
      "trapTypes": ["无中生有", "✓ 同义改写（prive de logements + pousse les familles à s’éloigner）", "无中生有"],
      "why": "第三段指出部分市中心近五分之一房源转为旅游短租，甚至整栋楼改成度假公寓，抬高价格并挤走常住居民。",
      "difficulty": 3,
      "skill": "opinion"
    },
    {
      "q": "Que révèle l’exemple de Bordeaux mentionné au quatrième paragraphe ?",
      "options": [
        "Une lourde amende municipale n’a pas suffi à enrayer la progression des meublés touristiques.",
        "Le nombre d’annonces de courte durée a reculé dès l’instauration des sanctions.",
        "La municipalité a renoncé à toute réglementation face aux plateformes numériques."
      ],
      "answer": 0,
      "evidence": "À Bordeaux, la mairie a instauré une amende de 5 000 euros pour les propriétaires qui ne respectent pas la réglementation. Malgré cela, le nombre d’annonces touristiques a augmenté de 12% en 2023.",
      "trapTypes": ["✓ 让步转折改写（Malgré cela… a augmenté de 12%）", "正反颠倒（不是下降而是上升12%）", "违背原文"],
      "why": "第四段指出尽管波尔多设立了5000欧元罚款，2023年旅游短租广告依然增长了12%，单靠罚款未能刹住涨势。",
      "difficulty": 3,
      "skill": "negation"
    },
    {
      "q": "Quel constat nuancé l’économiste Thomas Girard dresse-t-il à propos de Berlin et de Barcelone ?",
      "options": [
        "Leurs règles plus fermes ont calmé les prix tout en réduisant la souplesse du marché.",
        "Leurs politiques d’encadrement ont totalement échoué à ralentir la hausse des loyers.",
        "Elles ont résolu la crise uniquement grâce à la baisse des impôts fonciers."
      ],
      "answer": 0,
      "evidence": "Dans certaines villes comme Berlin ou Barcelone, des politiques plus strictes ont permis de stabiliser les loyers, mais au prix d’un marché locatif parfois plus rigide.",
      "trapTypes": ["✓ 辩证观点改写（stabiliser les loyers + marché plus rigide）", "正反颠倒", "无中生有"],
      "why": "吉拉尔指出柏林和巴塞罗那更严厉的管控虽稳住了房租，但也付出了租赁市场趋于僵化的代价。",
      "difficulty": 4,
      "skill": "opinion"
    },
    {
      "q": "Que mettent en lumière les données de l’INSEE citées en fin d’article ?",
      "options": [
        "L’écart se creuse entre les ressources des locataires et le poids financier de leur toit.",
        "Les ménages lyonnais consacrent désormais moins d’un tiers de leur budget au loyer.",
        "Les revenus des locataires parisiens progressent plus vite que l’inflation immobilière."
      ],
      "answer": 0,
      "evidence": "le revenu médian des ménages locataires à Paris a baissé de 2% en deux ans, tandis que le coût du logement continue de grimper.",
      "trapTypes": ["✓ 数据综合推断", "数值陷阱（里昂已升至38%，五年前才是32%）", "正反颠倒（收入下降2%）"],
      "why": "第五段对比巴黎租户收入微降而房租续涨、里昂租房支出占比从32%升至38%，说明收入与居住成本剪刀差不断拉大。",
      "difficulty": 4,
      "skill": "inference"
    },
    {
      "q": "Quelle orientation globale se dégage de la conclusion de l’enquête ?",
      "options": [
        "Combiner un encadrement réellement contrôlé avec une relance de l’offre de logements accessibles.",
        "Abandonner les plafonds municipaux pour laisser le marché fixer librement les tarifs.",
        "Interdire définitivement toute location saisonnière sur l’ensemble du territoire français."
      ],
      "answer": 0,
      "evidence": "Il faut agir sur tous les leviers : réguler les loyers, lutter contre les abus, mais aussi accélérer la construction de logements sociaux et intermédiaires.",
      "trapTypes": ["✓ 全文总结同义改写", "正反颠倒", "极端绝对化"],
      "why": "末段总结单靠限价不够，必须多管齐下：规范租金、严查违规，同时加快建设保障房与中等价位住房。",
      "difficulty": 5,
      "skill": "gist"
    }
  ]
};

const R3_OPINIONS: Raw = {
  "form": "opinions",
  "topic": "politique-justice",
  "intro": "Vous lisez les témoignages de trois citoyens sur un forum municipal consacré au vote obligatoire.",
  "title": "Faut-il instaurer le vote obligatoire aux élections locales ?",
  "docs": [
    {
      "text": "Claire\nJe pense que rendre le vote obligatoire serait une bonne chose. Beaucoup de gens ne se déplacent pas par manque de motivation ou parce qu’ils pensent que leur voix ne compte pas. Si tout le monde devait voter, cela renforcerait la légitimité des élus et obligerait les candidats à s’adresser à tous les citoyens, pas seulement à ceux qui votent déjà. Dans d’autres pays européens, comme la Belgique, ce système existe et le taux de participation est bien plus élevé qu’en France. Bien sûr, il faudrait accompagner cette mesure d’une meilleure information sur les enjeux des élections, pour que chacun puisse voter en connaissance de cause. À mon avis, le vote obligatoire permettrait aussi de lutter contre l’abstention massive qui affaiblit notre démocratie. Il est important que chaque citoyen prenne conscience de sa responsabilité et de l’impact de son choix, même s’il n’est pas passionné par la politique. Enfin, pour éviter que le vote ne devienne une simple formalité, il faudrait faciliter l’accès aux bureaux de vote et proposer des bulletins blancs pour ceux qui ne soutiennent aucun candidat.\nMehdi\nJe suis contre le vote obligatoire. Pour moi, le droit de vote inclut aussi le droit de s’abstenir. On ne devrait pas forcer les gens à participer s’ils ne le souhaitent pas. Il y a des raisons légitimes de ne pas voter : manque de confiance dans les politiques, absence d’offre convaincante ou contraintes personnelles. Plutôt que de sanctionner les abstentionnistes, il vaudrait mieux s’attaquer aux causes de la démobilisation et améliorer le fonctionnement de la démocratie locale. Par exemple, il faudrait rendre les élus plus accessibles, encourager la transparence et favoriser le dialogue avec les citoyens. Si on impose le vote, on risque d’obtenir des bulletins sans conviction, ce qui ne reflète pas la véritable opinion de la population. À mon sens, la liberté de choix est essentielle dans une démocratie, et chacun doit pouvoir décider de s’exprimer ou non, sans pression ni sanction.\nSophie\nJe comprends les arguments des deux côtés, mais je pense qu’imposer le vote ne résoudra pas le problème de fond. Beaucoup de citoyens voteraient sans conviction, juste pour éviter une amende, ce qui risquerait de fausser les résultats. À mon avis, il faudrait surtout rendre le vote plus accessible, par exemple en développant le vote en ligne ou par correspondance. Cela permettrait à plus de gens de participer sans contrainte, tout en respectant la liberté de chacun. De plus, il serait utile de renforcer l’éducation civique dès le plus jeune âge afin de donner du sens à la participation électorale. Le vote doit rester un acte volontaire et réfléchi, pas une obligation administrative. Si l’on veut vraiment augmenter la participation, il faut s’attaquer aux causes du désintérêt, comme le manque d’information ou la défiance envers les institutions, plutôt que de rendre le vote obligatoire.",
      "zh": "克莱尔\n我认为强制投票是件好事。许多人因为缺乏动力或认为自己的声音无关紧要而不去投票。如果每个人都必须投票，这将增强当选者的合法性，并迫使候选人面向所有公民，而不仅仅是那些已经投票的人。在比利时等其他欧洲国家，这一制度已经存在，投票率比法国高得多。当然，这项措施还需要更好的选举信息宣传，让每个人都能明智地投票。在我看来，强制投票还能遏制大规模弃权现象，避免削弱我们的民主。每个公民都应意识到自己的责任和选择的影响，即使对政治不感兴趣。最后，为了避免投票流于形式，还应简化投票流程，并为不支持任何候选人的人提供空白选票。\n梅迪\n我反对强制投票。在我看来，投票权也包括弃权的权利。如果人们不愿意，就不应该强迫他们参与。不投票有正当理由：对政治缺乏信任、没有有说服力的候选人或个人原因。与其惩罚弃权者，不如解决人们不参与的根本原因，改善地方民主的运作。例如，应让民选官员更容易接触，鼓励透明度，加强与市民的对话。如果强制投票，可能会出现没有真实意愿的选票，这无法反映民众的真实想法。在我看来，选择的自由是民主的核心，每个人都应有权决定是否表达自己的意见，而不应受到压力或惩罚。\n索菲\n我理解双方的观点，但我认为强制投票并不能解决根本问题。许多公民只是为了避免罚款而无心投票，这可能会扭曲选举结果。在我看来，应该让投票更方便，比如发展网络投票或邮寄投票。这样可以让更多人自由参与，同时尊重每个人的选择。此外，还应从小加强公民教育，让选举参与更有意义。投票应当是自愿和深思熟虑的行为，而不是行政上的义务。如果真的想提高参与率，应解决人们冷漠的根本原因，如信息不足或对体制的不信任，而不是强制投票。"
    }
  ],
  "questions": [
    {
      "q": "Qui estime que le vote obligatoire renforcerait la légitimité des élus ?",
      "qType": "qcm",
      "options": ["Claire", "Mehdi", "Sophie"],
      "answer": 0,
      "evidence": "Si tout le monde devait voter, cela renforcerait la légitimité des élus et obligerait les candidats à s’adresser à tous les citoyens",
      "trapTypes": ["✓ 对应 Claire", "张冠李戴", "张冠李戴"],
      "why": "克莱尔明确表示强制投票能增强当选者的合法性。",
      "difficulty": 2,
      "skill": "opinion"
    },
    {
      "q": "Qui pense que le droit de vote inclut aussi le droit de s’abstenir ?",
      "qType": "qcm",
      "options": ["Claire", "Mehdi", "Sophie"],
      "answer": 1,
      "evidence": "Pour moi, le droit de vote inclut aussi le droit de s’abstenir.",
      "trapTypes": ["张冠李戴", "✓ 对应 Mehdi", "张冠李戴"],
      "why": "梅迪认为投票权也包括弃权权。",
      "difficulty": 2,
      "skill": "opinion"
    },
    {
      "q": "Qui cite la Belgique comme exemple de pays où le vote obligatoire existe ?",
      "qType": "qcm",
      "options": ["Claire", "Mehdi", "Sophie"],
      "answer": 0,
      "evidence": "Dans d’autres pays européens, comme la Belgique, ce système existe et le taux de participation est bien plus élevé qu’en France.",
      "trapTypes": ["✓ 对应 Claire", "张冠李戴", "张冠李戴"],
      "why": "克莱尔提到比利时有强制投票制度。",
      "difficulty": 2,
      "skill": "detail"
    },
    {
      "q": "Qui souhaite développer l’éducation civique dès le plus jeune âge pour donner du sens au vote ?",
      "qType": "qcm",
      "options": ["Claire", "Mehdi", "Sophie"],
      "answer": 2,
      "evidence": "il serait utile de renforcer l’éducation civique dès le plus jeune âge afin de donner du sens à la participation électorale.",
      "trapTypes": ["张冠李戴", "张冠李戴", "✓ 对应 Sophie"],
      "why": "索菲提出应从小加强公民教育，让参与选举更有意义。",
      "difficulty": 3,
      "skill": "paraphrase"
    },
    {
      "q": "Qui propose de développer le vote en ligne ou par correspondance ?",
      "qType": "qcm",
      "options": ["Claire", "Mehdi", "Sophie"],
      "answer": 2,
      "evidence": "il faudrait surtout rendre le vote plus accessible, par exemple en développant le vote en ligne ou par correspondance.",
      "trapTypes": ["张冠李戴", "张冠李戴", "✓ 对应 Sophie"],
      "why": "索菲建议发展网络投票或邮寄投票。",
      "difficulty": 2,
      "skill": "detail"
    },
    {
      "q": "Qui pense qu’il faut s’attaquer aux causes de la démobilisation plutôt que de sanctionner les abstentionnistes ?",
      "qType": "qcm",
      "options": ["Claire", "Mehdi", "Sophie"],
      "answer": 1,
      "evidence": "Plutôt que de sanctionner les abstentionnistes, il vaudrait mieux s’attaquer aux causes de la démobilisation et améliorer le fonctionnement de la démocratie locale.",
      "trapTypes": ["张冠李戴", "✓ 对应 Mehdi", "张冠李戴"],
      "why": "梅迪主张解决不参与投票的根本原因，而不是惩罚弃权者。",
      "difficulty": 3,
      "skill": "paraphrase"
    }
  ]
};

/* ==================== 听力整套 3（25 分 · 口语化自然语流） ==================== */

const L3_LONG_1: Raw = {
  form: "long",
  topic: "transports-mobilite",
  intro: "Vous écoutez une émission consacrée aux mobilités sur une radio publique.",
  title: "Les trains de nuit : un retour durable ou un pari fragile ?",
  docs: [
    {
      text: `Claire Martin : Bonjour à tous et bienvenue dans « En route ». Ces dernières années, plusieurs liaisons ferroviaires nocturnes ont rouvert entre Paris, le sud de la France et même certaines capitales voisines. Pour savoir si ce renouveau peut durer, j'accueille Lucas Girard, spécialiste de l'économie des transports à Lyon. Lucas Girard, bonjour. Ce retour du train de nuit répond-il à une vraie demande du public ?
Lucas Girard : Bonjour. Alors, euh, oui et non, disons que l'envie est bien réelle, surtout chez les jeunes voyageurs et les familles qui cherchent une alternative à l'avion sur les distances moyennes. L'an dernier, les lignes existantes affichaient des taux de remplissage proches de quatre-vingt pour cent pendant les vacances scolaires. Maintenant, il faut rester lucide : en volume total, cela représente encore moins de deux pour cent des déplacements longue distance. C'est pas demain matin qu'on remplacera tous les vols intérieurs.
Claire Martin : Pardon, mais pourquoi les billets restent-ils souvent plus chers qu'un vol sur une compagnie à bas prix ?
Lucas Girard : Ben justement, c'est tout le paradoxe économique du rail nocturne. Un train de nuit transporte beaucoup moins de passagers qu'un TGV classique, parce qu'il faut installer des couchettes ou des lits, et puis on le fait circuler une seule fois par vingt-quatre heures au lieu de quatre ou cinq allers-retours dans la journée. En plus, les rames françaises sont vieilles de quarante ans et tombent régulièrement en panne, ce qui coûte très cher en maintenance. Du coup, les compagnies peinent à proposer des tarifs doux sans subvention publique.
Claire Martin : Et côté voyageurs, est-ce qu'il y a aussi des freins pratiques au-delà du prix ?
Lucas Girard : Bien sûr. Beaucoup de gens apprécient le charme de s'endormir à Paris et de se réveiller au pied des Pyrénées ou à Vienne, mais euh… la réalité à bord refroidit parfois les enthousiastes. Quand vous partagez un compartiment de six personnes avec des inconnus qui ronflent, sans vraie douche ni wifi fiable, et qu'un train arrive avec quarante-cinq minutes de retard un lundi matin, ben vous réfléchissez à deux fois avant de recommencer avant une réunion importante. Pour fidéliser une clientèle active, il faudrait investir massivement dans des voitures modernes offrant plus d'intimité et de confort.
Claire Martin : Plusieurs pays européens s'y sont mis sérieusement, notamment l'Autriche. Son modèle est-il reproductible chez nous ?
Lucas Girard : En partie seulement. L'opérateur autrichien a commandé de nouvelles rames dès deux mille dix-huit avec un soutien financier constant de l'État, mais même là-bas, l'équilibre financier reste fragile dès qu'on s'éloigne des grands axes touristiques. En fait, la clé, c'est la stabilité politique sur dix ou quinze ans et la coopération entre réseaux nationaux. Tant que les travaux de nuit sur les voies obligeaient certains trains à s'arrêter en pleine campagne ou à faire d'énormes détours, la ponctualité restait médiocre. Mais si on rénove le matériel et qu'on coordonne les horaires européens, alors oui, le train de nuit deviendra une option crédible et pas seulement un souvenir nostalgique.`,
      zh: `Claire Martin：大家好，欢迎收听《在路上》。近年来，巴黎通往法国南部甚至邻国首都的多条夜间铁路陆续重启。为探讨这波复苏能否持久，我请到了里昂交通经济专家 Lucas Girard。Lucas Girard 您好。夜行火车回归真的有稳定需求吗？
Lucas Girard：您好。嗯，可以说是既有需求又有局限。尤其受寻求中程航空替代方案的年轻旅客和家庭欢迎。去年现有夜车线路在假期上座率接近百分之八十。不过要清醒看待总量：它目前仍只占长途客运的不到百分之二，不可能一夜间替代国内航班。
Claire Martin：抱歉打断，那为什么夜车车票往往比廉航机票还贵呢？
Lucas Girard：嗯，这恰恰是夜行铁路的经济悖论。夜车必须设置卧铺或躺椅，载客量远低于普通高铁，而且一昼夜只能跑一趟，不能像白天列车那样每天往返四五趟。再加上法国车厢大多已有四十年车龄、维修故障频繁、养护成本高，若没有政府补贴很难给出低价票。
Claire Martin：对旅客而言，除了价格之外还有实际顾虑吗？
Lucas Girard：当然有。很多人向往在巴黎入睡、醒来已在比利牛斯山脚或维也纳的浪漫，但车上现实体验有时让人冷静下来。当你和打鼾的陌生人挤在六人间里、没有淋浴也没稳定 Wi-Fi，周一清晨又晚点四十五分钟，上班前再选夜车就得三思了。想留住上班族，必须大规模投资兼顾隐私与舒适的新车厢。
Claire Martin：奥地利等欧洲国家投入很大，这种模式能复制到法国吗？
Lucas Girard：只能部分借鉴。奥地利国有铁路早在2018年就订购了新列车并获稳定财政支持，但即使在那里，一旦脱离热门旅游干线也很难盈亏平衡。关键在于持续十到十五年的政策稳定和跨国铁路网协同——比如减少夜间轨道施工迫使列车绕路或停车。如果更新设备并协调欧洲时刻表，夜车才会真正可靠而不只是怀旧符号。`,
      audioUrl: "materials/co/preset-listen-3-e1-d1.mp3",
    },
  ],
  questions: [
    { q: "Que constate Lucas Girard au sujet du succès actuel des trains de nuit ?", options: ["Les lignes sont très fréquentées en vacances mais restent marginales sur l'ensemble du trafic.", "Ils transportent déjà plus de voyageurs que les lignes à grande vitesse.", "Ils attirent principalement des hommes d'affaires pressés en semaine."], answer: 0, why: "他指出假期上座率虽近80%，但在全部长途出行中占比还不到2%。", difficulty: 2, skill: "paraphrase" },
    { q: "Pourquoi l'exploitation d'un train de nuit coûte-t-elle plus cher par passager ?", options: ["Les gares appliquent des taxes doubles pendant la nuit.", "Il roule moins souvent dans la journée et accueille moins de voyageurs à bord.", "La consommation d'électricité augmente fortement après minuit."], answer: 1, why: "他解释因为设卧铺载客少，且24小时只能跑一趟（而非白天4到5趟），加上老车厢维护贵。", difficulty: 3, skill: "paraphrase" },
    { q: "Selon l'invité, quel défaut du matériel actuel freine le public actif ?", options: ["L'impossibilité d'acheter les billets sur internet.", "Un confort et une fiabilité jugés insuffisants pour arriver reposé au travail.", "La suppression des arrêts dans les grandes villes intermédiaires."], answer: 1, why: "他举了六人间陌生人打鼾、没淋浴和晚点45分钟的例子，说明影响次日开会与休息。", difficulty: 3, skill: "paraphrase" },
    { q: "À propos du modèle autrichien, Lucas Girard souligne que…", options: ["il assure des bénéfices élevés sur toutes les petites lignes régionales.", "il repose sur une volonté publique durable sans pour autant garantir la rentabilité partout.", "il fonctionne sans aucune subvention ni commande de nouveaux trains."], answer: 1, why: "他说明奥铁依靠政府持续支持买新车，但即便如此脱离核心旅游线路仍收支脆弱。", difficulty: 4, skill: "opinion" },
    { q: "Quel obstacle technique perturbe encore la ponctualité des trajets nocturnes ?", options: ["Le manque de conducteurs qualifiés en Europe centrale.", "La météo hivernale sur les lignes côtières.", "Les chantiers de maintenance effectués la nuit sur les voies."], answer: 2, why: "最后提到夜间铁轨施工（travaux de nuit sur les voies）迫使列车停靠或大绕道影响准点。", difficulty: 2, skill: "detail" },
    { q: "Quelle est la conclusion globale du spécialiste à la fin de l'interview ?", options: ["Le train de nuit restera uniquement une attraction nostalgique sans avenir.", "Il peut s'imposer durablement si l'on renouvelle les trains et coordonne les réseaux.", "Les gouvernements devraient interdire tous les TGV de soirée."], answer: 1, why: "结尾表示只要翻新车辆并协调欧洲各国时刻表，夜车就能成为可靠的长期选择。", difficulty: 5, skill: "inference" },
    { q: "Dans cet extrait, l'attitude de Lucas Girard est surtout…", options: ["catégoriquement hostile au ferroviaire.", "pragmatique et lucide sur les conditions de réussite.", "enthousiaste sans voir aucune limite économique."], answer: 1, why: "他既看到真实需求也坦率剖析财务与设备短板，整体立场务实清醒。", difficulty: 4, skill: "opinion" },
  ],
};

const L3_LONG_2: Raw = {
  form: "long",
  topic: "consommation",
  intro: "Vous écoutez un débat sur les ondes autour de l'indice de réparabilité et de la durée de vie des appareils.",
  title: "Appareils durables : l'indice de réparabilité change-t-il vraiment nos achats ?",
  docs: [
    {
      text: `Sophie Blanc : Bonsoir et bienvenue dans « Côté conso ». Depuis l'instauration de l'indice de réparabilité affiché sur les téléphones, les ordinateurs ou les machines à laver, ces petites notes sur dix guident-elles vraiment nos choix ? Pour en débattre, je reçois Nadia Benali, ingénieure dans une association de défense des consommateurs, et Henri Moreau, représentant d'une fédération de fabricants d'électroménager. Nadia Benali, quel bilan tirez-vous après quelques années ?
Nadia Benali : Bonsoir. En fait, y a deux côtés très différents. Côté positif, l'indice a obligé certaines marques à arrêter de coller les batteries à l'intérieur des téléphones ou à rendre les vis accessibles sans outil spécial. Du coup, les notes moyennes affichées en magasin ont progressé. Maintenant, soyons honnêtes : une note de huit sur dix ne garantit pas que le client va vraiment réparer son appareil en cas de panne, parce que si une carte électronique coûte cent quatre-vingts euros sur un appareil neuf acheté deux cent cinquante, ben les gens rachètent du neuf quand même.
Henri Moreau : Attendez, Nadia, faut quand même rappeler que les industriels ont fait des efforts considérables ! Beaucoup de nos adhérents stockent désormais des pièces détachées pendant sept à dix ans dans des entrepôts en Europe, ce qui mobilise beaucoup de place et d'argent. Et sur le terrain, on voit bien que certains consommateurs ne regardent pas l'étiquette au moment de payer : entre un modèle noté neuf sur dix mais trente euros plus cher et un modèle d'entrée de gamme en promotion, la contrainte budgétaire gagne souvent.
Sophie Blanc : Justement, pourquoi ne pas passer directement à un indice de durabilité qui mesure aussi la fiabilité réelle et pas seulement la facilité de démontage ?
Nadia Benali : Ben voilà exactement ce qu'il faut renforcer ! Aujourd'hui, un appareil facile à ouvrir mais conçu avec des plastiques fragiles qui cassent au bout de trente mois peut quand même décrocher une bonne note. L'indice de durabilité, qui intègre enfin la robustesse des composants et les mises à jour logicielles sur la durée, permettrait de sanctionner cette incohérence. Et puis il faudrait aussi généraliser un vrai bonus réparation déduit directement à la caisse, sans formulaire compliqué à remplir sur internet.
Henri Moreau : Sur la simplification du bonus, on est tout à fait d'accord avec vous, Nadia. Les démarches actuelles découragent parfois les petits réparateurs indépendants de quartier. En revanche, pour mesurer la durabilité exacte d'un nouveau lave-linge avant sa sortie en magasin, euh… c'est techniquement complexe, car on ne peut pas simuler dix ans d'usage en quelques semaines de test sans augmenter fortement le prix de vente final.
Sophie Blanc : En somme, l'étiquette informe mieux le citoyen, mais le prix des pièces et le réseau de réparation restent décisifs. Merci à tous les deux pour cet échange éclairant qui nous aide à mieux comprendre ce qui freine encore les réparations au quotidien.`,
      zh: `Sophie Blanc：大家晚上好，欢迎来到《消费观察》。自手机、电脑和洗衣机引入“可维修指数”以来，贴在产品上的十分制评分真的改变了我们的购物选择吗？为此，我邀请了消费者协会工程师 Nadia Benali，以及家电制造商联合会代表 Henri Moreau。Nadia Benali，几年过去您怎么看成效？
Nadia Benali：晚上好。其实有截然不同的两面。积极的一面是，这项指数倒逼部分品牌不再把手机电池死死粘在机身里，或者改用普通工具就能拧开的螺丝，因此卖场的平均得分提高了。但说实话，8/10的高分并不意味着坏了就会真去修——如果主板维修就要花180欧元，而机器原价才250欧元，大家还是会买新的。
Henri Moreau：等等，Nadia，也得客观看到制造商付出了巨大努力！我们很多成员企业如今要在欧洲仓库备齐七到十年的零配件库存，占用大量空间与资金。而在消费现场我们也常看见，结账时不少顾客并不看标签：在一个9/10分但贵30欧的机型和一台打折入门机之间，预算压力往往占上风。
Sophie Blanc：说到这，为什么不直接过渡到连同“实际耐用性”一起衡量的“耐用指数”，而不止评估是否好拆解呢？
Nadia Benali：嗯，这正是需要加强的方向！目前一台虽然容易拆开、但用廉价脆塑料制造、三十个月就坏的设备照样能拿到高分。耐用指数能把元件稳固度和长期软件更新纳入考核，从而戳破这种矛盾。另外，应该把“维修补贴”推广成结账时直接立减，别再让用户上网填复杂申请表。
Henri Moreau：在简化维修补贴流程这点上，我们完全同意您的看法，Nadia。现行繁琐手续有时也让街头小型独立维修店望而却步。但要在新款洗衣机上市前就精确测出它的绝对寿命，呃……技术上相当棘手，因为很难在几周测试里模拟十年使用而不显著推高最终售价。
Sophie Blanc：归根结底，标签让消费者更知情，但配件价格与维修网点依然决定成败。感谢两位嘉宾带来如此清晰的交流，让我们看清日常维修中仍存在哪些阻碍。`,
      audioUrl: "materials/co/preset-listen-3-e2-d1.mp3",
    },
  ],
  questions: [
    { q: "Selon Nadia Benali, quel effet positif l'indice de réparabilité a-t-il déjà produit ?", options: ["Il a divisé par deux le prix des pièces électroniques.", "Il a poussé des fabricants à concevoir des appareils plus faciles à ouvrir.", "Il a interdit la vente de smartphones d'entrée de gamme."], answer: 1, why: "她说倒逼部分厂商停止粘死电池或使用普通工具可拆螺丝。", difficulty: 2, skill: "paraphrase" },
    { q: "D'après la représentante des consommateurs, pourquoi beaucoup renoncent-ils quand même à faire réparer ?", options: ["Les délais d'attente en magasin dépassent deux mois.", "Le coût d'une pièce reste trop proche de celui d'un produit neuf.", "Les assurances refusent de couvrir les pannes mécaniques."], answer: 1, why: "她举了250欧机器主板需180欧的例子，配件与整机价格相差无几。", difficulty: 2, skill: "detail" },
    { q: "Que souligne Henri Moreau pour défendre les fabricants ?", options: ["Stocker des pièces sur sept à dix ans représente une charge financière lourde.", "La plupart des clients choisissent toujours le modèle le mieux noté.", "Les gouvernements remboursent intégralement la logistique des entrepôts."], answer: 0, why: "他强调在欧洲备存7到10年零配件需要巨大仓储空间和资金压力。", difficulty: 3, skill: "paraphrase" },
    { q: "Quel défaut précis Nadia Benali reproche-t-elle à l'indice actuel ?", options: ["Il favorise uniquement les marques étrangères.", "Il peut bien noter un objet qui tombe pourtant en panne rapidement.", "Il n'est affiché que sur le site internet du ministère."], answer: 1, why: "她指出使用易脆塑料、30个月就坏但易拆开的机器仍可获得高分。", difficulty: 3, skill: "paraphrase" },
    { q: "Sur quel point les deux invités se montrent-ils clairement d'accord ?", options: ["Supprimer toutes les promotions en magasin.", "Rendre le bonus réparation plus simple à obtenir pour les citoyens et artisans.", "Obliger chaque foyer à conserver ses appareils dix ans."], answer: 1, why: "Henri Moreau 对 Nadia 提出简化补贴、取消繁琐网上表单表示完全赞同。", difficulty: 4, skill: "opinion" },
    { q: "Pourquoi Henri Moreau reste-t-il prudent sur la mesure préalable de la durabilité ?", options: ["Les tests de longévité complets sont complexes à mener sans alourdir les coûts.", "Les associations de consommateurs refusent de collaborer avec les laboratoires.", "Aucun appareil moderne ne supporte les mises à jour logicielles."], answer: 0, why: "他表示上市前几周模拟十年寿命技术复杂且会抬高售价。", difficulty: 4, skill: "opinion" },
    { q: "Que conclut l'animatrice à la fin de l'émission ?", options: ["Les consommateurs ignorent désormais toutes les étiquettes environnementales.", "L'information est utile mais ne règle pas seule les freins économiques et pratiques.", "La loi va bientôt fermer les petits ateliers indépendants."], answer: 1, why: "主持人总结标签增加了透明度，但配件价格与维修网络依然至关重要。", difficulty: 5, skill: "inference" },
  ],
};

const L3_SHORT: Raw = {
  form: "short",
  topic: "environnement",
  intro: "Vous allez écouter trois documents sonores consacrés à des initiatives écologiques urbaines. Vous n'entendrez chaque document qu'une seule fois.",
  title: "Adapter la ville au climat",
  docs: [
    {
      text: `Présentatrice : Face aux canicules de plus en plus longues en centre-ville, certaines municipalités misent sur la végétalisation des toitures publiques. Mireille Laurent dirige le service urbanisme de Grenoble.
Mireille Laurent : Bonjour. Depuis quatre ans, on a équipé neuf écoles primaires et deux gymnases de toits recouverts de plantes grasses et de terre légère, au lieu du goudron noir habituel. Alors, euh, l'été dernier pendant le pic à trente-huit degrés, nos capteurs ont montré que les salles situées juste sous ces toits gagnaient jusqu'à quatre degrés de fraîcheur par rapport aux bâtiments voisins, tout en retenant plus de la moitié des pluies d'orage qui saturaient nos égouts. Bien sûr, ça coûte plus cher à l'installation et il faut vérifier la solidité de la charpente avant, donc c'est pas possible sur tous les immeubles anciens sans travaux lourds de renforcement. En plus, il faut arroser les jeunes pousses durant la première année pour qu'elles s'enracinent bien. Mais à l'usage, on dépense beaucoup moins en climatisation, les membranes d'étanchéité résistent deux fois plus longtemps au soleil et les enfants travaillent dans de bien meilleures conditions tout l'après-midi.`,
      zh: `主持人：面对市中心日益漫长的热浪，一些市政当局开始依托公共建筑屋顶绿化降温。Mireille Laurent 是格勒诺布尔城市规划部门负责人。
Mireille Laurent：您好。四年来，我们为九所小学和两座体育馆铺设了种植耐旱植物和轻质土壤的绿屋顶，替代了传统的黑色沥青。去年夏天38度高温期间，传感器显示这些屋顶正下方的教室比邻近建筑凉爽高达4度，同时还蓄住了原本会淹没排水管的过半暴雨径流。当然，前期施工更贵，且动工前必须检验屋架承重，部分老建筑如果不进行大型加固就无法改造；第一年还要适度浇水帮助幼苗扎根。但长期来看，空调支出大幅减少，防水层耐晒寿命翻倍，孩子们整个下午的学习环境也舒爽得多。`,
      audioUrl: "materials/co/preset-listen-3-e3-d1.mp3",
    },
    {
      text: `Marc Petit : Je coordonne une ferme pédagogique installée depuis trois ans sur un ancien terrain industriel en lisière de Nantes. Notre idée au départ était toute simple : reconnecter les habitants du quartier avec les rythmes réels des saisons, parce que beaucoup de gamins que l'on accueillait en classe verte ne savaient même pas si les carottes poussaient sous terre ou dans les arbres ! Aujourd'hui, sur moins d'un hectare, on produit des légumes bio variés vendus chaque vendredi directement sur place à prix solidaires pour les familles du secteur. On organise aussi des ateliers de cuisine de saison avec des bénévoles retraités pour montrer comment préparer des légumes parfois oubliés sans dépenser beaucoup d'argent. Bon, on va pas se mentir : une ferme urbaine comme la nôtre ne nourrira jamais une grande agglomération à elle seule, les loyers fonciers et les analyses de sol coûtent bien trop cher pour ça. En revanche, comme lieu de rencontre entre générations, d'ateliers scolaires et de formation au jardinage sans pesticides, notre utilité sociale dépasse largement tout ce qu'on imaginait au lancement.`,
      zh: `Marc Petit：我负责协调南特市郊一处废弃工业地上的教育农场，至今已有三年。起初的想法很朴素：让社区居民重新感受真实的四季节律，因为之前来参加生态课的很多孩子甚至不知道胡萝卜是长在土里还是树上！如今在不到一公顷土地上，我们每周五直接向本地家庭以惠民价出售多种有机蔬菜，还邀请退休志愿者一起开展应季烹饪课，教大家不用花大钱就能做出可口的家常素菜。不过坦白说，像我们这样的都市农场绝不可能单靠自己养活整座大都市，地租和土壤安全检测实在太贵了。但作为连接不同年龄层的社区客厅、中小学课堂和无农药园艺培训基地，它带来的社会价值远远超出了启动之初的一切设想。`,
      audioUrl: "materials/co/preset-listen-3-e3-d2.mp3",
    },
    {
      text: `Céline Garnier : En France, le secteur du bâtiment produit à lui seul près de soixante-dix pour cent des déchets nationaux, alors que la moitié des matériaux démontés — portes en chêne, radiateurs en fonte, poutres ou carreaux de ciment — sont encore parfaitement utilisables pendant des décennies. Dans notre ressourcerie spécialisée à Bordeaux, on récupère ces éléments directement sur les chantiers de rénovation publique ou privée avant qu'ils ne finissent broyés en décharge. Ensuite, nos menuisiers et métalliers les nettoient, contrôlent minutieusement leur état technique et les revendent à moitié prix aux artisans comme aux particuliers qui bricolent chez eux le week-end. Le frein principal qu'on rencontre encore aujourd'hui, c'est le rythme très serré des travaux : les entreprises ont souvent peur de perdre deux ou trois jours à déposer proprement une fenêtre ou une cloison vitrée au lieu de tout casser rapidement à la pelleteuse. Mais depuis que les devis doivent chiffrer précisément le coût d'évacuation des gravats, les mentalités commencent enfin à bouger dans le bon sens et de jeunes architectes nous appellent dès la conception.`,
      zh: `Céline Garnier：在法国，建筑业本身就产生了全国近百分之七十的垃圾，而拆下来的材料——比如橡木门、铸铁暖气片、木梁或水泥砖——有一半其实完全可以继续使用。在波尔多我们这家专门建材再生站，团队会在翻新工地拆除前直接回收这些构件，免得它们被碾碎丢进填埋场。之后我们的木工会对构件清洗检视，再以半价转售给手艺人及自己动手装修的居民。眼下最大的阻力依然是紧凑的工期：施工队常担心小心拆装浪费两天时间而直接用挖掘机砸省事。不过随着现在报价单必须列明建筑废料清运费用，大家观念终于开始往积极方向转变。`,
      audioUrl: "materials/co/preset-listen-3-e3-d3.mp3",
    },
  ],
  questions: [
    { doc: 0, q: "Outre la baisse de température, quel avantage des toits végétalisés Mireille Laurent cite-t-elle ?", options: ["Ils absorbent une grande partie des fortes pluies.", "Ils augmentent l'espace de récréation pour les élèves.", "Ils suppriment le besoin d'entretenir les murs anciens."], answer: 0, why: "她说这些屋顶蓄住了超过一半原本会令下水道超负荷的暴雨。", difficulty: 2, skill: "paraphrase" },
    { doc: 0, q: "Pourquoi cette solution ne peut-elle pas être généralisée à tous les bâtiments ?", options: ["Les plantes ne résistent pas au gel hivernal.", "Certains édifices anciens ont une structure trop fragile pour supporter le poids.", "La réglementation interdit d'installer des plantes sur les gymnases."], answer: 1, why: "她说施工前必须验算屋架承重，部分老建筑并不具备条件。", difficulty: 3, skill: "paraphrase" },
    { doc: 1, q: "D'après Marc Petit, quelle est la limite principale des fermes urbaines ?", options: ["Les habitants achètent très peu de légumes locaux.", "Leur production reste insuffisante pour alimenter toute une grande ville.", "Les écoles manquent d'enseignants disponibles le vendredi."], answer: 1, why: "他坦言受限于土地租金与检测成本，都市农场绝不可能独自喂饱整座大都市。", difficulty: 3, skill: "paraphrase" },
    { doc: 1, q: "Qu'est-ce qui rend finalement le projet de Marc Petit précieux selon lui ?", options: ["Les subventions européennes qu'il attire.", "Son rôle éducatif et de lien social dans le quartier.", "Les bénéfices financiers reversés à la mairie."], answer: 1, why: "他指出作为代际交流、学校教学和园艺培训场所的社会价值远超预期。", difficulty: 3, skill: "opinion" },
    { doc: 2, q: "Pourquoi les chantiers détruisent-ils encore souvent des matériaux réutilisables ?", options: ["Les artisans ne savent pas poser d'anciens matériaux.", "Démolir rapidement coûte moins de temps que démonter avec soin.", "Les décharges refusent désormais les fenêtres intactes."], answer: 1, why: "她说明施工队常因为工期紧，担心小心拆装浪费两天时间而直接拆除。", difficulty: 2, skill: "paraphrase" },
    { doc: 2, q: "Qu'est-ce qui incite progressivement les entreprises à changer de pratique ?", options: ["L'obligation d'indiquer le prix d'élimination des déchets dans les devis.", "L'interdiction totale d'utiliser des pelleteuses en centre-ville.", "La gratuité complète du stockage en entrepôt municipal."], answer: 0, why: "末句提到因为现在工程报价必须标明渣土清运成本，大家心态才开始转向正面。", difficulty: 4, skill: "detail" },
  ],
};

/* ==================== 听力整套 4（25 分 · 播音电台风 · 法国/魁北克/比利时多口音） ==================== */

const L4_LONG_1: Raw = {
  form: "long",
  topic: "sante",
  intro: "Vous écoutez un entretien sur une radio francophone consacré à la prévention de l'épuisement professionnel.",
  title: "Droit à la déconnexion et fatigue mentale : comment protéger les salariés ?",
  docs: [
    {
      text: `Claire Beaumont : Bonsoir et bienvenue dans notre magazine hebdomadaire consacré au monde du travail et à la santé mentale. Depuis plusieurs années, la législation reconnaît le droit à la déconnexion, mais dans la réalité des entreprises, la frontière entre bureau et domicile reste souvent floue. Pour examiner des solutions concrètes, j'accueille ce soir Marc-Antoine Gagnon, ergonome du travail à Montréal, et Nadia Bouzid, responsable des ressources humaines dans une entreprise industrielle lyonnaise. Marc-Antoine Gagnon, le téléphone professionnel est-il le principal responsable de cette fatigue ?
Marc-Antoine Gagnon : Bonsoir Claire. Accuser uniquement l'appareil serait beaucoup trop simple. Dans nos enquêtes menées auprès de cadres et de techniciens québécois comme européens, ce qui épuise vraiment les équipes, c'est d'abord l'incertitude permanente sur ce qui est urgent. Lorsque personne n'ose fermer sa boîte mail après dix-neuf heures par peur de rater une consigne importante pour le lendemain matin, le cerveau reste en état d'alerte continu. Même si vous ne répondez pas au message envoyé à vingt-deux heures, votre sommeil devient moins réparateur parce que vous anticipez déjà la journée suivante.
Nadia Bouzid : Je partage entièrement ce constat. Dans notre groupe, il y a trois ans, une simple charte affichée sur l'intranet n'avait rien changé du tout. Ce qui a transformé les habitudes, c'est une règle opérationnelle décidée avec les délégués du personnel : désormais, entre vingt heures et sept heures trente, les serveurs mettent automatiquement en attente les courriels internes non urgents, et les responsables reçoivent une alerte mensuelle s'ils dépassent ce cadre. Résultat : le taux de réponse nocturne a chuté de quatre-vingts pour cent en six mois sans baisse de productivité.
Claire Beaumont : Pardonnez-moi, mais que faire pour les salariés qui travaillent avec des collègues situés sur d'autres fuseaux horaires, en Amérique ou en Asie ?
Nadia Bouzid : Justement, l'organisation doit s'adapter sans punir l'individu. Pour nos équipes internationales, nous avons créé des plages communes de deux heures en début d'après-midi, et instauré un système de relais clair lors des congés. Le collaborateur qui rentre de vacances ne trouve plus six cents messages accumulés : un binôme désigné suit ses dossiers prioritaires pendant son absence.
Marc-Antoine Gagnon : Ce point est fondamental, mais j'ajouterai une dimension souvent oubliée : la charge globale de travail et la culture managériale de l'immédiateté. Bloquer les serveurs à dix-neuf heures ne sert absolument à rien si l'on exige le matin même des objectifs impossibles à tenir en huit heures de bureau. Sans réévaluation réaliste des délais, sans embauches dans les services déjà tendus et sans formation des dirigeants à l'écoute des signaux faibles d'épuisement, le salarié finira simplement par travailler hors ligne le dimanche soir sur son ordinateur personnel.
Claire Beaumont : En somme, la technique protège seulement si l'organisation suit derrière. Merci beaucoup à tous les deux pour cet éclairage très concret et précieux pour nos auditeurs.`,
      zh: `Claire Beaumont：大家晚上好，欢迎收听关注职场与心理健康的每周专栏节目。多年来法律已承认“离线权”，但在企业现实中办公与居家的界线依然模糊。为此我请到了蒙特利尔的职场工效学家 Marc-Antoine Gagnon，以及里昂一家工业企业的人力资源负责人 Nadia Bouzid。Marc-Antoine Gagnon，工作手机是导致精神疲惫的罪魁祸首吗？
Marc-Antoine Gagnon：Claire 您好。把责任全推给硬件未免太简单了。在我们对魁北克及欧洲高管与技术人员的调研中，真正耗竭团队的是对“何事紧急”的持续不确定感。当大家因为害怕漏掉次日早上的重要指令而在晚上七点后不敢关闭邮箱，大脑就会处于持续警戒状态；即便不回复十点发来的消息，睡眠质量也会下降。
Nadia Bouzid：我完全认同这一点。三年前我们集团仅在内网贴了一份倡议章程，结果毫无改变。真正重塑习惯的是与员工代表共同制定的操作细则：晚八点至早七点半之间服务器自动暂存非紧急内部邮件，若管理者频繁超时还会收到月度提醒。半年后夜间回复率下降八成而效率未减。
Claire Beaumont：抱歉插话，那与美洲或亚洲不同时区同事协作的员工该怎么办？
Nadia Bouzid：制度必须适配而非惩罚个人。我们为跨国团队划定了下午两小时的共同对接窗口，并建立清晰的休假交接机制，由指定搭档跟进重点事务，员工休完假回来不必面对六百封积压邮件。
Marc-Antoine Gagnon：这非常关键，但我还要补充常被忽视的一点：总体工作负荷与追求即时回复的管理文化。如果白天布置的任务根本无法在八小时内完成，晚上七点断网毫无意义，若不重新评估工期、补充紧张岗位人手并培训管理者察觉过劳早期信号，员工只会在周日晚上用私人电脑离线加班。
Claire Beaumont：归根结底，技术规则只有配合管理组织转型才能真正护航。感谢两位的务实剖析。`,
      audioUrl: "materials/co/preset-listen-4-e1-d1.mp3",
    },
  ],
  questions: [
    { q: "Selon Marc-Antoine Gagnon, quelle est la cause principale de la fatigue liée aux courriels tardifs ?", options: ["Le coût élevé des forfaits de téléphonie mobile.", "L'inquiétude constante de manquer une information prioritaire.", "La lenteur des logiciels utilisés dans les bureaux."], answer: 1, why: "他指出问题在于对哪些事紧急的持续不确定感，让人晚上不敢彻底关闭邮箱。", difficulty: 2, skill: "paraphrase" },
    { q: "D'après Nadia Bouzid, pourquoi la première charte interne de son entreprise a-t-elle échoué ?", options: ["Les syndicats ont refusé de signer le texte.", "Elle se limitait à une simple déclaration sans mécanisme concret.", "Les serveurs informatiques étaient incompatibles avec le réseau."], answer: 1, why: "三年前贴在内网的倡议章程毫无变化，直到引入自动暂存邮件的操作机制才见效。", difficulty: 3, skill: "paraphrase" },
    { q: "Quel bilan tire Nadia Bouzid de la retenue automatique des messages la nuit ?", options: ["Les échanges nocturnes ont nettement diminué sans nuire au rendement.", "Les clients étrangers ont déposé plusieurs réclamations.", "Les responsables ont exigé davantage de réunions le matin."], answer: 0, why: "她说半年内夜间回复率下降80%，同时没有降低生产力。", difficulty: 2, skill: "detail" },
    { q: "Comment l'entreprise gère-t-elle le retour de congés de ses employés ?", options: ["Elle supprime automatiquement tous les anciens messages.", "Un collègue assure le suivi des affaires importantes pendant l'absence.", "Elle prolonge de deux jours la durée officielle des vacances."], answer: 1, why: "由指定搭档（binôme）在休假期间跟进重点项目，避免回来面对几百封邮件。", difficulty: 2, skill: "detail" },
    { q: "Sur quel risque Marc-Antoine Gagnon attire-t-il l'attention en fin d'entretien ?", options: ["Le départ massif des jeunes diplômés vers l'Amérique du Nord.", "Le contournement des règles lorsque les objectifs restent irréalistes.", "La disparition totale des échanges directs entre collègues."], answer: 1, why: "他指出若工作负荷过高、期限不切实际，员工会用私人电脑离线在周日加班。", difficulty: 4, skill: "opinion" },
    { q: "Selon l'ergonome, quelle condition accompagne nécessairement les outils techniques ?", options: ["Une augmentation immédiate des salaires des cadres.", "Une discussion honnête sur les délais et les moyens réels des équipes.", "L'interdiction absolue de travailler avec d'autres fuseaux horaires."], answer: 1, why: "末句强调真正预防需要技术工具与对团队资源和工期的坦诚对话相结合。", difficulty: 3, skill: "paraphrase" },
    { q: "Que retient-on de l'ensemble du débat concernant le droit à la déconnexion ?", options: ["Il dépend autant de l'organisation du travail que de la technologie.", "Il ne peut s'appliquer qu'aux petites entreprises familiales.", "Il devient inutile dès que les salariés utilisent un ordinateur personnel."], answer: 0, why: "全篇论证仅靠口号或硬件限制不够，需要工作量管理、交接制度与技术规则配合。", difficulty: 5, skill: "inference" },
  ],
};

const L4_LONG_2: Raw = {
  form: "long",
  topic: "logement-urbanisme",
  intro: "Vous écoutez un débat radiophonique sur les politiques publiques face à la hausse des loyers et aux logements vacants.",
  title: "Encadrement des loyers : frein au marché ou bouclier nécessaire ?",
  docs: [
    {
      text: `Thomas Vasseur : Bonjour à tous et bienvenue dans « Débat public ». Dans de nombreuses grandes agglomérations francophones, trouver un appartement devient un véritable parcours du combattant pour les jeunes actifs et les familles modestes. Faut-il généraliser l'encadrement strict des loyers ou plutôt inciter à rénover les centaines de milliers de logements laissés vides ? Pour en débattre, nous recevons Benoît Delacroix, élu municipal à Bruxelles chargé du logement, et Émilie Laurent, conseillère économique auprès d'une fédération immobilière. Benoît Delacroix, votre commune applique un barème de référence depuis deux ans. Cela fonctionne-t-il ?
Benoît Delacroix : Bonjour Thomas. Soyons précis : à Bruxelles comme à Paris ou à Lyon, le plafonnement n'a jamais prétendu construire à lui seul de nouveaux immeubles, mais il joue un rôle d'amortisseur indispensable. Sans garde-fou juridique, certains propriétaires augmentent le loyer de vingt-cinq pour cent entre deux locataires pour un même deux-pièces mal isolé. Grâce aux contrôles renforcés et au guichet de médiation mis en place par la ville, plusieurs centaines de ménages ont obtenu une baisse ou un remboursement l'an dernier. Ce n'est pas la panacée, mais c'est un bouclier immédiat contre la spéculation.
Émilie Laurent : Justement, Benoît, ce bouclier produit aussi des effets secondaires bien réels que les chiffres commencent à montrer. Quand les loyers sont bloqués alors que le coût des matériaux et des travaux d'isolation thermique flambe, plusieurs petits bailleurs renoncent à rénover et préfèrent soit vendre leur bien, soit le retirer de la location de longue durée. Dans deux quartiers tendus, l'offre d'appartements disponibles à la location classique a reculé de douze pour cent en un an. Qui en souffre en premier ? Les étudiants et les salariés aux revenus moyens qui cherchent justement un toit.
Benoît Delacroix : Attendez, Émilie ! Ce recul de l'offre s'explique surtout par la multiplication des locations touristiques meublées à la nuitée et par les résidences secondaires qui restent fermées dix mois par an. Voilà pourquoi nous avons doublé la taxe sur les logements durablement vacants et limité à quatre-vingt-dix nuitées par an la location de courte durée. Quand un immeuble de centre-ville est remis en location habituelle grâce à un accompagnement technique de la mairie, tout le quartier retrouve des commerces ouverts à l'année et des écoles vivantes.
Émilie Laurent : Sur la lutte contre la vacance prolongée et les meublés touristiques illégaux, nous sommes tout à fait prêts à coopérer. En revanche, plutôt que de multiplier les amendes contre les propriétaires occupants ou les petits épargnants, l'État devrait accélérer l'octroi des permis de construire pour le logement social et garantir une aide financière stable aux propriétaires modestes qui engagent une rénovation énergétique.
Thomas Vasseur : Réguler les abus à court terme tout en soutenant l'offre et la rénovation durable : le compromis semble étroit, mais les pistes sont désormais posées. Merci à tous les deux.`,
      zh: `Thomas Vasseur：大家好，欢迎来到《公共辩论》。在众多法语区大都市，年轻上班族和普通家庭租房正变成一场艰难考验。究竟应该全面推行严格房租管制，还是重在激励翻新数十万套空置住房？今天我们请到负责住房事务的布鲁塞尔市政官员 Benoît Delacroix，以及房地产联合会经济顾问 Émilie Laurent。Benoît Delacroix，您所在的市镇已实施参考租金标准两年，见效了吗？
Benoît Delacroix：Thomas 您好。客观而言，无论在布鲁塞尔、巴黎还是里昂，限价本身从未宣称能直接建起新楼，但它起到了不可或缺的缓冲作用。没有法律护栏，部分房东会在换租客时把同一套保温极差的两居室涨租百分之二十五。借助市政府加强的稽查与调解窗口，去年已有数百户家庭获得降租或退款，这是抵御投机的立竿见影的盾牌。
Émilie Laurent：恰恰相反，Benoît，数字已开始显现这种“盾牌”的真实副作用。当建筑材料和节能改造费用飙升而租金被锁死时，许多小房东选择放弃翻新，干脆卖房或退出长租市场。在两个紧俏街区，常规长租房源一年减少百分之十二，最先受害的正是学生与中等收入租客。
Benoît Delacroix：等等，Émilie！房源萎缩主要源于按夜计价的旅游短租激增，以及全年空置十个月的第二居所。因此我们对长期空置房加倍征税，并将短租上限定为每年九十夜。当市中心房屋通过市政技术帮扶重回长租市场，整个街区的常年商铺与学校都会重焕生机。
Émilie Laurent：在打击长期空置与违法旅游短租上我们完全愿意合作。但相比一味对小业主罚款，政府更应加快保障性住房的建设审批，并为启动节能改造的普通房东提供稳定补助。
Thomas Vasseur：短期遏制滥涨、长期扩大供给与可持续翻新，两者之间平衡虽不易拿捏，但路径已经明晰，感谢两位嘉宾。`,
      audioUrl: "materials/co/preset-listen-4-e2-d1.mp3",
    },
  ],
  questions: [
    { q: "Comment Benoît Delacroix justifie-t-il l'encadrement des loyers dans sa ville ?", options: ["Il remplace totalement la construction de logements sociaux.", "Il évite des hausses brutales entre deux locataires successifs.", "Il finance directement l'achat de matériaux écologiques."], answer: 1, why: "他解释限价是缓冲护栏，防止房东在前后两任租客之间猛涨25%的房租。", difficulty: 2, skill: "paraphrase" },
    { q: "Selon Émilie Laurent, quelle conséquence négative entraîne le blocage des loyers ?", options: ["Une baisse du nombre de biens proposés à la location classique.", "Une hausse immédiate des impôts locaux dans les banlieues.", "La fermeture des agences immobilières publiques."], answer: 0, why: "她说材料翻新贵而房租受限时，小房东退出长租导致可用普通房源一年降12%。", difficulty: 2, skill: "detail" },
    { q: "À quoi Benoît Delacroix attribue-t-il d'abord la baisse de l'offre locative ?", options: ["Au vieillissement démographique des grands centres urbains.", "À l'essor des hébergements touristiques et des logements inoccupés.", "Au refus des banques d'accorder des prêts aux étudiants."], answer: 1, why: "他认为主要原因是按夜出租的旅游短租房和常年空置十个月的第二居所增多。", difficulty: 3, skill: "opinion" },
    { q: "Quelle initiative municipale Benoît Delacroix associe-t-il au retour des logements en centre-ville ?", options: ["Le doublement des places de stationnement souterrain.", "Le maintien d'une vie de quartier active tout au long de l'année.", "La suppression des commerces dans les rues piétonnes."], answer: 1, why: "当房产重回长租后，整个街区的日常商铺和学校全年保持活力。", difficulty: 3, skill: "paraphrase" },
    { q: "Sur quel point précis Émilie Laurent rejoint-elle son interlocuteur ?", options: ["Sur la nécessité de limiter les locations touristiques abusives et la vacance.", "Sur l'augmentation des amendes infligées aux petits épargnants.", "Sur le blocage définitif des prix de l'immobilier ancien."], answer: 0, why: "她明确表示在打击长期空置和违法旅游短租方面，业界完全愿意配合。", difficulty: 3, skill: "opinion" },
    { q: "Que demande Émilie Laurent aux pouvoirs publics pour soutenir le parc immobilier ?", options: ["Interdire la vente d'appartements de moins de trente mètres carrés.", "Faciliter les permis de construire et aider financièrement à isoler les biens.", "Confier tous les logements privés aux mairies."], answer: 1, why: "她呼吁加快保障房建造许可审批，并为普通业主的节能翻新提供稳定财政补助。", difficulty: 4, skill: "paraphrase" },
    { q: "Quelle idée générale ressort à l'issue de l'échange ?", options: ["Réguler les abus ne suffit pas sans mesures favorables à la création de logements.", "Les élus locaux souhaitent supprimer toutes les aides à la rénovation.", "Les locataires préfèrent désormais les résidences touristiques aux baux classiques."], answer: 0, why: "主持人与双方均表明仅靠价格管制或罚款无法彻底解困，还需扩大供给与资助改造。", difficulty: 5, skill: "inference" },
  ],
};

const L4_SHORT: Raw = {
  form: "short",
  topic: "societe",
  intro: "Vous allez écouter trois courts documents sonores consacrés à la vie quotidienne et aux décisions publiques. Vous n'entendrez chaque document qu'une seule fois.",
  title: "Vivre ensemble en ville et au quotidien",
  docs: [
    {
      text: `Présentatrice : Depuis cet hiver, plusieurs universités et bibliothèques municipales baissent le chauffage à dix-neuf degrés tout en réorganisant leurs horaires. Camille Roux gère le campus central de Liège.
Camille Roux : Quand nous avons annoncé en octobre que la température maximale des amphithéâtres resterait à dix-neuf degrés, beaucoup d'étudiants craignaient d'avoir froid pendant les cours magistraux du matin. En pratique, nous avons d'abord réparé les joints des vieilles fenêtres, installé des thermostats programmables pièce par pièce et regroupé les travaux dirigés du vendredi soir dans deux bâtiments mieux isolés au lieu de chauffer cinq pavillons à moitié vides. Pour la bibliothèque universitaire, plutôt que de réduire la durée d'ouverture avant les examens de janvier, nous avons maintenu une grande salle chauffée et lumineuse jusqu'à vingt-deux heures tout en fermant deux étages peu fréquentés après dix-huit heures. La facture de gaz et d'électricité a ainsi reculé de vingt-deux pour cent sur le semestre sans sacrifier le confort réel ni la réussite des étudiants en période de révision. Dès le mois de janvier, plusieurs professeurs ont également salué la sérénité des salles de lecture chauffées tard le soir, preuve qu'une organisation réfléchie protège mieux les usages quotidiens qu'une fermeture brutale.`,
      zh: `主持人：自今冬起，多所大学和市政图书馆把供暖温度控在十九度并调整了开放时段。Camille Roux 负责管理列日中心校区。
Camille Roux：十月我们宣布阶梯教室最高供暖维持十九度时，很多学生担心早课受冻。实际上我们先修好了旧窗密封条、逐间加装可编程温控器，并把周五晚上的小班研讨课集中到保温更好的两栋楼，避免为半空的五栋楼供暖。大学图书馆没有缩短一月考前开放时长，而是保留一间温暖明亮的大厅开放至晚十点，六点后关闭人流很少的两层。一学期下来燃气与电费账单降了百分之二十二，而复习期间的舒适度与学习成效并未打折。从一月起，多位教授也赞赏夜间供暖阅览室井然有序，证明周密排班比粗暴关门更能保障师生日常学习。`,
      audioUrl: "materials/co/preset-listen-4-e3-d1.mp3",
    },
    {
      text: `Luc Moreau : Je travaille depuis huit ans comme médiateur culturel au musée des Beaux-Arts de Rennes. Jusqu'à récemment, nos salles fermaient à dix-huit heures précises, ce qui empêchait de nombreux salariés, apprentis, soignants ou étudiants en stage de pousser la porte en semaine. L'an dernier, nous avons lancé des nocturnes gratuites chaque jeudi jusqu'à vingt et une heures trente, accompagnées de courtes présentations vivantes de dix minutes autour d'une seule œuvre par soir et d'un petit coin lecture dans le hall central. Certains collègues redoutaient au départ un coût de gardiennage excessif pour une fréquentation modeste. Pourtant, le public a triplé sur ces créneaux du soir, avec une nette majorité de jeunes adultes de moins de trente ans qui n'étaient jamais venus auparavant. L'ambiance est bien plus détendue que le dimanche après-midi : les visiteurs osent poser des questions au médiateur et reviennent ensuite volontiers avec leurs proches durant le week-end. Devant ce succès populaire, la mairie vient même de prolonger l'expérience sur toute la saison culturelle prochaine, avec deux nouveaux parcours thématiques accessibles gratuitement aux étudiants et aux apprentis.`,
      zh: `Luc Moreau：我在雷恩美术馆担任文化讲解员已有八年。直到不久前，展馆平日下午六点准时闭馆，让许多上班族、学徒、医护人员或实习生无缘在工作日入馆参观。去年起，我们推出每周四晚免费夜场开放至九点半，搭配每次仅围绕一件作品的十分钟生动微讲解并在大厅设阅读角。起初有同事担心安保成本太高而访客寥寥。然而夜间时段观众数翻了三倍，其中绝大多数是此前从未踏足过美术馆的三十岁以下年轻人。夜场氛围比周日下午轻松得多，观众敢于向讲解员提问，不少人周末还会带亲友再来。鉴于这项亲民举措反响热烈，市政府刚刚决定将夜场延续至整个下个文化季，并为学生与学徒免费增设两条全新主题参观路线。`,
      audioUrl: "materials/co/preset-listen-4-e3-d2.mp3",
    },
    {
      text: `Présentatrice : Le bruit routier nocturne pèse lourdement sur la santé des riverains des grands boulevards. La chercheuse Amélie Bernard présente les résultats d'une expérimentation acoustique menée à Genève et à Lyon.
Amélie Bernard : On associe souvent la pollution urbaine aux seuls gaz d'échappement, mais l'exposition prolongée au vacarme répété de la circulation augmente aussi nettement les troubles chroniques du sommeil, la fatigue nerveuse et les risques cardiovasculaires. Pendant dix-huit mois, deux agglomérations ont testé des radars sonores capables de repérer automatiquement les deux-roues ou voitures dont le pot d'échappement a été modifié illégalement pour faire davantage de bruit. Les relevés techniques montrent que la simple installation de panneaux pédagogiques lumineux accompagnée de contrôles ciblés la nuit a réduit de moitié les pics sonores les plus aigus au bout de six mois seulement. Fait marquant de notre étude : la quasi-totalité de ces nuisances extrêmes venait d'une minuscule minorité de conducteurs imprudents, non de la circulation ordinaire des habitants rentrant tard du travail. Plusieurs conseils de quartier réclament désormais d'étendre ces capteurs préventifs devant les hôpitaux et les écoles maternelles.`,
      zh: `主持人：夜间道路交通噪音严重威胁城市主干道沿线居民的健康。研究员 Amélie Bernard 介绍了在日内瓦和里昂开展的一项声学试点结果。
Amélie Bernard：人们常只把城市污染等同于汽车尾气，但长期暴露在反复交通轰鸣中同样显著增加慢性失眠、神经疲劳和心血管疾病风险。两座城市历时十八个月测试了声学雷达，可自动识别非法改装排气管以刻意放大声响的摩托车或汽车。监测显示，仅仅竖立电子提示牌并配合夜间定向抽查，短短半年就使最高分贝噪音峰值减少了一半。研究中值得注意的是，几乎所有极端刺耳声响都来自极少数鲁莽驾驶者，而非晚归市民的日常车流。多个社区委员会如今已呼吁将这些预防性监测设备扩大部署至医院和幼儿园门口。`,
      audioUrl: "materials/co/preset-listen-4-e3-d3.mp3",
    },
  ],
  questions: [
    { doc: 0, q: "Comment le campus de Liège a-t-il économisé du chauffage sans fermer la bibliothèque ?", options: ["En concentrant les activités du soir dans des locaux mieux adaptés.", "En supprimant tous les cours programmés le vendredi matin.", "En demandant aux étudiants d'apporter leurs propres radiateurs."], answer: 0, why: "校区修缮窗户并将晚间课程与阅览集中在保温更佳且开放的局部空间，节省了燃气。", difficulty: 2, skill: "paraphrase" },
    { doc: 0, q: "Quelle a été l'évolution de la dépense énergétique sur le semestre ?", options: ["Elle est restée identique malgré la baisse du thermostat.", "Elle a baissé de plus d'un cinquième sans gêner les usagers.", "Elle a légèrement augmenté en raison de la fermeture tardive."], answer: 1, why: "原文指出能源账单在半学年下降了22%（超过五分之一），且不牺牲实际舒适感。", difficulty: 2, skill: "detail" },
    { doc: 1, q: "Pourquoi le musée des Beaux-Arts de Rennes a-t-il ouvert le jeudi soir ?", options: ["Pour compenser une fermeture totale décidée le dimanche après-midi.", "Pour tester de nouvelles œuvres réalisées par des étudiants.", "Pour accueillir des personnes indisponibles pendant les heures de bureau."], answer: 2, why: "此前六点闭馆使上班族、学徒、医护人员和实习生工作日没法来参观。", difficulty: 3, skill: "paraphrase" },
    { doc: 1, q: "Quel résultat surprenant ces nocturnes ont-elles produit ?", options: ["Elles ont attiré surtout un public jeune qui ne fréquentait pas le musée.", "Elles ont dû être annulées faute d'agents de surveillance.", "Elles ont fait baisser la fréquentation des visites guidées."], answer: 0, why: "客流量翻三倍，且多数是从未走进过美术馆的三十岁以下年轻人。", difficulty: 2, skill: "detail" },
    { doc: 2, q: "D'après Amélie Bernard, qu'a montré l'expérimentation sur le bruit nocturne ?", options: ["Les voitures électriques sont aussi bruyantes que les moteurs anciens.", "L'essentiel des nuisances sonores extrêmes provient d'un très petit nombre de véhicules.", "Les riverains préfèrent les amendes automatiques à toute prévention."], answer: 1, why: "研究发现几乎全部刺耳峰值都源于极少数私改排气管的鲁莽司机，而非普通车流。", difficulty: 3, skill: "paraphrase" },
    { doc: 2, q: "Quel effet les panneaux et contrôles nocturnes ont-ils eu au bout de six mois ?", options: ["Une augmentation du trafic sur les boulevards voisins.", "L'interdiction définitive de circuler après vingt-deux heures.", "Une réduction de moitié des bruits les plus intenses."], answer: 2, why: "半年内高分贝噪音峰值减少了一半。", difficulty: 2, skill: "detail" },
  ],
};

/* ==================== 听力整套 5（25 分 · 口语化自然语流 · 多国法语口音） ==================== */

const L5_LONG_1: Raw = {
  form: "long",
  topic: "arts-francophonie",
  intro: "Vous écoutez une table ronde sur l'évolution du français contemporain dans les pays francophones.",
  title: "Anglicismes, accents et mots neufs : une langue vivante à plusieurs voix",
  docs: [
    {
      text: `Stéphanie Roy : Bonjour à tous et bienvenue dans cette émission spéciale consacrée à la vitalité de la langue française entre Montréal, Genève et Paris. Beaucoup d'observateurs s'alarment du recul supposé du français face aux termes venus de l'anglais numérique. Est-ce une menace réelle ou le signe normal d'une langue qui respire ? Pour en discuter, j'ai autour de la table Jean-Luc Tremblay, linguiste à Québec, et Nadia Rochat, rédactrice dans une maison d'édition à Lausanne. Jean-Luc Tremblay, le français est-il vraiment en danger ?
Jean-Luc Tremblay : Bonjour Stéphanie. Alors, euh… entendre dire que la langue meurt parce qu'on emploie trois mots anglais dans une réunion, ben ça me fait toujours sourire. Toutes les grandes langues vivantes empruntent des termes quand une innovation apparaît ailleurs, puis elles les digèrent à leur façon. Ici au Québec, par exemple, on dit couramment « courriel » ou « balado » sans même y penser, simplement parce que nos médias et l'administration ont proposé des équivalents courts et agréables à prononcer bien avant que l'habitude anglaise ne s'installe. Ce qui menace une langue, ce n'est pas l'emprunt ponctuel : c'est quand elle cesse de produire des œuvres, de la science et des chansons populaires.
Nadia Rochat : Tout à fait ! Et moi, en Suisse romande, je remarque combien cette richesse vient précisément de nos différences régionales. Pendant longtemps, à la radio comme à l'école, on faisait croire aux élèves qu'un seul accent parisien constituait le « bon français », comme si dire « septante » ou « souper » relevait d'une faute de grammaire. Aujourd'hui heureusement, euh, le regard change vite : les écrivains belges, suisses, africains ou québécois montrent qu'on partage une grammaire commune tout en gardant chacun sa musique et ses expressions savoureuses.
Stéphanie Roy : Mais dans les entreprises technologiques ou à l'université, ne risque-t-on pas une sorte de sabir incompréhensible pour le grand public ?
Nadia Rochat : Ah là-dessus, je vous rejoins complètement. Quand une entreprise installée en zone francophone affiche ses offres d'emploi uniquement en anglais ou remplace des termes administratifs précis par du jargon marketing flou, ce n'est plus de la créativité, c'est de l'exclusion sociale : beaucoup de citoyens ordinaires ne comprennent plus ce qui se décide autour d'eux ni les droits inscrits dans leur contrat. C'est là que le traducteur, le journaliste, le rédacteur technique et le professeur jouent un rôle civique précieux en nommant clairement les réalités numériques nouvelles dans un français vivant et rigoureux.
Stéphanie Roy : Les créateurs de contenus vidéo et les plateformes culturelles francophones ont-ils aussi une responsabilité dans ce renouvellement ?
Jean-Luc Tremblay : Mais bien sûr, Stéphanie ! Quand de jeunes humoristes, vulgarisateurs scientifiques ou musiciens écrivent directement en français de Lyon, de Dakar ou de Montréal sans complexe ni imitation artificielle, des millions d'adolescents s'approprient spontanément ces tournures. Ne tombons donc ni dans la police linguistique crispée qui méprise l'accent du voisin, ni dans la paresse qui consiste à tout laisser passer en anglais sans chercher de mot juste. Une langue reste jeune et rayonnante tant que ses locuteurs de Dakar à Bruxelles ont plaisir à l'inventer ensemble chaque jour.`,
      zh: `Stéphanie Roy：大家好，欢迎收听这期连线蒙特利尔、日内瓦和巴黎、探讨当代法语活力的特别圆桌节目。常有人担忧法语正被数字领域的英语词汇侵蚀，这究竟是实质威胁还是活语言的正常新陈代谢？今天我们邀请到了魁北克的语言学家 Jean-Luc Tremblay，以及洛桑出版社编辑 Nadia Rochat。Jean-Luc，法语真的处境危险吗？
Jean-Luc Tremblay：Stéphanie 您好。一听到“开会用了三个英语词法语就要消亡”这类说法，我总忍不住发笑。所有活跃的大语种在新事物出现时都会吸收外来词，再按自身规律消化。比如在魁北克，大家脱口而出说 courriel（电子邮件）或 balado（播客），并非因为死板禁令，而是我们的媒体与机构在英语习惯固化前就给出了简短顺口的词。真正威胁语言的不是偶尔借词，而是不再产出科学、文艺与流行歌曲。
Nadia Rochat：太对了！我在瑞士法语区也深切感受到这份丰富正源于地区差异。过去很长一段时间，校园和广播让人误以为只有巴黎腔才叫“标准法语”，仿佛说 septante 或 souper 就是语法错误。好在如今观念迅速转变，比利时、瑞士、非洲和魁北克的作家证明，大家共享同一套语法骨架，同时各留各的韵律与地道表达。
Stéphanie Roy：不过在科技企业或高校中，难道不会演变成普通大众听不懂的混合行话吗？
Nadia Rochat：在这点上我完全赞同您的担忧。当一家设在法语区的公司只用英文发招聘广告，或用模糊的营销黑话取代精准行政用语时，这不再是语言创造力，而是社会排斥——普通市民看不懂身边决策甚至合同条款。此时翻译、记者、技术写作者与教师用清晰严密的活法语命名当代新事物的公民作用就尤为珍贵。
Stéphanie Roy：法语区的视频创作者和文化平台在这场更新中也承担责任吗？
Jean-Luc Tremblay：当然了！当里昂、达喀尔或蒙特利尔的年轻喜剧人、科普作者和音乐人毫无自卑、毫不刻意模仿地直接用活法语创作时，数百万青少年就会自发采用这些表达。所以我们既不能搞僵化的“语言警察”去歧视邻居的口音，也不能懒惰地对英文术语照单全收。只要从达喀尔到布鲁塞尔的使用者每天都乐于共同创造，法语就会永远充满活力。`,
      audioUrl: "materials/co/preset-listen-5-e1-d1.mp3",
    },
  ],
  questions: [
    { q: "Pourquoi certains termes français comme « courriel » se sont-ils imposés naturellement au Québec ?", options: ["Les téléphones étrangers y interdisent les mots anglais.", "Des équivalents simples ont été diffusés très tôt dans l'usage.", "Une amende automatique sanctionne chaque emprunt à l'oral."], answer: 1, why: "他说因为媒体与机构在英语词扎根前就提出了简短顺口的法语替代词。", difficulty: 2, skill: "paraphrase" },
    { q: "Selon Jean-Luc Tremblay, qu'est-ce qui affaiblirait réellement une langue ?", options: ["L'absence de création intellectuelle et culturelle dans cette langue.", "L'utilisation de deux mots étrangers dans une discussion professionnelle.", "La diversité des accents parlés dans les différentes régions."], answer: 0, why: "他指出真正威胁语言的是停止产出作品、科学与歌曲，而非零星借词。", difficulty: 3, skill: "paraphrase" },
    { q: "Quel préjugé passé Nadia Rochat critique-t-elle à propos de la Suisse romande ?", options: ["L'idée qu'une seule prononciation régionale ferait autorité.", "Le refus des maisons d'édition de publier des livres en français.", "L'abandon de la grammaire commune dans les écoles suisses."], answer: 0, why: "她批评过去让人觉得只有某一种巴黎口音才是正统法语的偏见。", difficulty: 3, skill: "opinion" },
    { q: "Quand le recours excessif au jargon anglais pose-t-il un vrai problème selon Nadia Rochat ?", options: ["Lorsqu'il empêche les citoyens de comprendre la vie professionnelle et publique.", "Uniquement lorsqu'il apparaît dans les chansons destinées aux jeunes.", "Quand les écrivains belges l'utilisent dans leurs romans historiques."], answer: 0, why: "她指出当公司全英文招工或堆砌黑话让普通民众看不懂身边决策时，就构成了社会排斥。", difficulty: 4, skill: "paraphrase" },
    { q: "Quel rôle Nadia Rochat attribue-t-elle aux journalistes et enseignants ?", options: ["Corriger l'accent régional des candidats à la radio.", "Rendre accessibles en français les notions contemporaines.", "Interdire toute traduction d'articles scientifiques."], answer: 1, why: "她说记者、译者和教师通过用清晰法语命名当代新事物来发挥公民作用。", difficulty: 3, skill: "detail" },
    { q: "Quelle attitude Jean-Luc Tremblay rejette-t-il à la fin du débat ?", options: ["Les deux excès opposés : l'intolérance puriste et la facilité du tout-anglais.", "L'enseignement des expressions québécoises dans les lycées africains.", "La coopération éditoriale entre Genève, Bruxelles et Montréal."], answer: 0, why: "他反对两极：既不要僵化歧视地方口音，也不要懒得找准确法语而全用英语。", difficulty: 4, skill: "negation" },
    { q: "Quelle image de la francophonie se dégage de cette table ronde ?", options: ["Une langue en déclin rapide hors d'Europe.", "Un patrimoine partagé qui vit grâce à l'inventivité de tous ses territoires.", "Un système figé qui refuse toute évolution liée au numérique."], answer: 1, why: "核心主旨是法语并非僵化衰退，而是跨越各大洲共同创造的鲜活语言。", difficulty: 5, skill: "inference" },
  ],
};

const L5_LONG_2: Raw = {
  form: "long",
  topic: "consommation",
  intro: "Vous écoutez un reportage et un entretien consacrés à la restauration scolaire durable et à la lutte contre le gaspillage.",
  title: "Cantines scolaires bio et locales : comment financer la qualité sans gaspiller ?",
  docs: [
    {
      text: `Lucie Ferrier : Bonsoir et bienvenue dans « Table commune ». La loi demande aux cantines scolaires de servir au moins cinquante pour cent de produits durables ou sous label de qualité, dont vingt pour cent issus de l'agriculture biologique. Sur le terrain, alors que le prix des denrées augmente, comment y arriver sans alourdir la facture des familles ? J'ai avec moi Paul Delcourt, chef cuisinier d'un collège public dans le Rhône, et Hélène Maillard, présidente d'une fédération de parents d'élèves. Paul Delcourt, peut-on vraiment acheter plus bio sans exploser le budget ?
Paul Delcourt : Bonsoir Lucie. Ben oui, à condition de changer complètement sa façon de cuisiner, quoi ! Avant, on jetait presque cent trente grammes de nourriture par plateau et par jour, surtout des frites industrielles refroidies ou des entrées sous plastique que les élèves ne touchaient même pas. En installant un vrai système de pesée dans le self avec les collégiens éco-délégués, puis en servant deux portions adaptées — petite faim ou grande faim — selon ce que chacun pense manger, on a divisé les restes par deux en huit mois. L'argent économisé sur la poubelle finance directement des légumes bio de saison livrés par trois maraîchers à moins de trente kilomètres.
Hélène Maillard : Comme parent d'élève, je vois aussi un autre changement positif : quand les plats sont préparés sur place avec des produits frais, les enfants mangent beaucoup mieux et demandent même les recettes à la maison ! Toutefois, faut pas se cacher la vérité : dans plusieurs petites communes rurales où la cuisine centrale n'a ni chambre froide assez grande ni personnel formé à éplucher des légumes bruts, l'équation financière reste très serrée. Les mairies doivent alors parfois augmenter le ticket de cantine de vingt centimes, ce qui pèse déjà sur certaines familles nombreuses.
Paul Delcourt : C'est vrai qu'on manque parfois de bras et d'équipement. Mais autre astuce très efficace : introduire deux repas végétariens complets et savoureux par semaine à base de lentilles, de pois chiches et de céréales locales coûte nettement moins cher qu'un steak haché de qualité moyenne, tout en réduisant notre empreinte carbone. Au début, certains élèves râlaient un peu le mardi, mais depuis qu'on travaille avec eux sur les épices et la présentation, les plats reviennent vides.
Hélène Maillard : L'important est là : associer véritablement les jeunes, les enseignants et les agents de cuisine à l'équilibre du menu au lieu de tout décider froidement dans un bureau municipal. Côté financement, plusieurs départements choisissent aussi de grouper leurs commandes publiques entre plusieurs établissements voisins et de moduler le tarif selon le revenu du foyer pour que la transition alimentaire reste accessible à chaque enfant, quel que soit le budget familial.
Lucie Ferrier : Réduire les pertes, cuisiner des produits bruts et impliquer tous les acteurs : la cantine devient ainsi un véritable laboratoire de citoyenneté, de santé publique et de justice sociale. Merci beaucoup à tous les deux d'avoir partagé votre expérience concrète.`,
      zh: `Lucie Ferrier：大家晚上好，欢迎收听《公共餐桌》。法律要求学校食堂至少使用百分之五十的可持续或优质认证食材，其中百分之二十需来自有机农业。现实中面对食品涨价，如何在不加重家庭负担的情况下做到这一点？今天我邀请了罗讷省一所公立初中的主厨 Paul Delcourt，以及家长联合会主席 Hélène Maillard。Paul Delcourt，真能多买有机食材而不超预算吗？
Paul Delcourt：Lucie 晚上好。可以的，前提是彻底改变烹饪管理方式！以前每天每份餐盘平均倒掉近一百三十克食物，大多是凉掉的工业薯条或学生根本不碰的塑料盒装前菜。我们在自助餐台和初中生环保代表一起推行剩菜称重，并按食量提供大小份自主选择后，八个月就把厨余减半。从垃圾桶省下来的钱直接用来向三十公里内三位菜农采购应季有机蔬菜。
Hélène Maillard：作为家长我也看到了另一项可喜变化：当饭菜用新鲜食材现场烹制时，孩子们吃得好多了，回家甚至会讨要食谱！但必须坦诚：在不少小型乡村市镇，中央厨房既缺少足够大的冷库，也缺少熟悉处理生鲜蔬菜的人员，资金依然捉襟见肘。市政厅有时不得不将每餐涨价两角，这对多子女家庭仍是不小压力。
Paul Delcourt：人手与设备不足确实常见。但还有一招极其奏效：每周提供两餐营养均衡又可口的素食正餐，用扁豆、鹰嘴豆和本地谷物，成本比普通牛肉饼低得多且更低碳。起初有些学生周二还有怨言，可自从让孩子们一起调试香料和摆盘后，餐盘都光盘返还。
Hélène Maillard：关键在于真正让青少年、教师和厨务团队共同参与菜单平衡，而非关在市政办公室里冷冰冰拍板。筹资上不少省也通过多校联合集中采购并按家庭收入阶梯定价，让绿色餐饮对每个家庭都可负担。
Lucie Ferrier：减少损耗、现烹生鲜、凝聚各方参与，食堂由此成为公民教育、公共健康与社会公平的真实课堂，非常感谢两位的分享。`,
      audioUrl: "materials/co/preset-listen-5-e2-d1.mp3",
    },
  ],
  questions: [
    { q: "Grâce à quoi Paul Delcourt a-t-il pu acheter davantage de légumes biologiques ?", options: ["En réduisant nettement la quantité d'aliments jetés chaque jour.", "En supprimant toutes les entrées froides des menus.", "En augmentant de moitié le prix demandé aux familles."], answer: 0, why: "他称重监督剩菜并提供大小份选项，厨余减半省下的钱正好用于采购本地有机蔬菜。", difficulty: 2, skill: "paraphrase" },
    { q: "Quel rôle jouent les élèves dans l'établissement de Paul Delcourt ?", options: ["Ils livrent les paniers de légumes depuis les fermes voisines.", "Ils participent à la mesure du gaspillage et aux choix culinaires.", "Ils décident seuls du tarif payé par chaque classe."], answer: 1, why: "环保学生代表参与剩菜称重，并与厨师一起改进素食菜单香料与摆盘。", difficulty: 2, skill: "detail" },
    { q: "Quelle difficulté matérielle Hélène Maillard relève-t-elle dans certaines petites communes ?", options: ["Le manque d'équipements adaptés et de cuisiniers pour travailler des produits frais.", "L'interdiction légale de servir des plats végétariens aux collégiens.", "Le refus des parents d'accepter les recettes proposées."], answer: 0, why: "她提到乡村小市镇往往缺少大冷库和擅长清洗切配生鲜原料的人手。", difficulty: 3, skill: "detail" },
    { q: "Quel avantage financier Paul Delcourt associe-t-il aux repas végétariens bien préparés ?", options: ["Ils coûtent moins cher à produire que certains plats de viande tout en étant appréciés.", "Ils suppriment le besoin d'avoir une cuisine sur place.", "Ils bénéficient d'une gratuité complète de la part des maraîchers."], answer: 0, why: "扁豆鹰嘴豆等素食正餐成本比普通肉饼更低，调好味后学生全吃光。", difficulty: 3, skill: "paraphrase" },
    { q: "Au début, certains collégiens ont accueilli le menu végétarien…", options: ["avec une certaine réticence avant d'être impliqués dans l'élaboration.", "avec un enthousiasme unanime dès la première semaine.", "en refusant d'entrer dans la salle de restauration le mardi."], answer: 0, why: "原文说起初部分学生周二发牢骚，后来参与调试后才光盘。", difficulty: 2, skill: "opinion" },
    { q: "Comment certains départements évitent-ils de pénaliser les ménages modestes ?", options: ["En adaptant le prix du repas aux revenus de chaque famille.", "En réservant les produits locaux aux classes d'examen.", "En remplaçant le déjeuner par une collation gratuite."], answer: 0, why: "多个省根据家庭收入实行阶梯定价，确保所有孩子都吃得起。", difficulty: 3, skill: "paraphrase" },
    { q: "Quelle idée résume le mieux la conclusion de l'émission ?", options: ["La transition écologique à la cantine réussit quand qualité, budget et pédagogie avancent ensemble.", "Il est impossible de proposer des produits locaux sans supprimer les cantines rurales.", "Les économies réalisées sur les déchets servent uniquement à agrandir les bâtiments."], answer: 0, why: "主持人总结控损耗、新鲜现做与让学生参与，使质量、预算与公民教育共同成功。", difficulty: 5, skill: "inference" },
  ],
};

const L5_SHORT: Raw = {
  form: "short",
  topic: "environnement",
  intro: "Vous allez écouter trois courts documents consacrés à l'écologie, aux études et à la santé des jeunes. Vous n'entendrez chaque document qu'une seule fois.",
  title: "Nature en ville, orientation et rythme de vie des jeunes",
  docs: [
    {
      text: `Présentatrice : Pour rafraîchir rapidement des quartiers très minéraux, plusieurs mairies plantent des « micro-forêts » sur d'anciens parkings. Antoine Mercier suit ces projets pour une association botanique à Lyon.
Antoine Mercier : L'idée consiste à planter sur une parcelle pas plus grande qu'un terrain de tennis entre trois cents et cinq cents jeunes arbres d'une trentaine d'espèces locales mélangées, comme le chêne, le charme ou le noisetier. Comme ils poussent très serrés sur un sol enrichi de compost, une saine concurrence s'installe pour capter la lumière et l'ensemble atteint deux mètres en trois ans seulement, créant un véritable îlot de fraîcheur urbain et un refuge précieux pour les oiseaux et les insectes pollinisateurs. Au départ, plusieurs habitants d'un immeuble voisin regrettaient la suppression de douze places de stationnement en surface. Mais après un été caniculaire où l'ombre épaisse des feuillages a nettement rafraîchi la cour d'école voisine et retenu l'eau des orages d'août, plusieurs riverains se sont même portés volontaires pour arroser et pailler les jeunes plants durant les mois secs. La municipalité prévoit déjà d'aménager cinq autres parcelles semblables dès l'automne prochain dans des quartiers populaires dépourvus de parcs.`,
      zh: `主持人：为了给满是水泥沥青的街区快速降温，多座市政厅在旧停车场上种植“微型森林”。Antoine Mercier 在里昂一家植物协会跟踪此类项目。
Antoine Mercier：具体做法是在不过网球场大小的地面上，在堆肥改良土壤里混栽三百到五百棵来自三十余种本土树种（如栎树、鹅耳枥或榛树）的幼苗。由于种得很密，树木间形成健康的向光竞争，仅三年就能长到两米高，形成清凉的城市绿岛，也为鸟类和传粉昆虫提供珍贵庇护。起初邻近大楼几户居民抱怨少了十二个地面车位，但经历了一个酷夏——浓密树荫让隔壁小学操场显著降温且蓄住八月暴雨后，好几位居民甚至主动报名在旱季帮忙浇水盖草保湿。市政厅已计划今秋在缺少公园的平民街区再打造五块同类小森林。`,
      audioUrl: "materials/co/preset-listen-5-e3-d1.mp3",
    },
    {
      text: `Claire Delmas : Je suis conseillère d'orientation dans un lycée polyvalent de Strasbourg, et chaque mois de janvier je vois monter la même angoisse chez nos élèves de terminale au moment de formuler leurs vœux d'études supérieures sur les plateformes publiques. Le problème vient rarement d'un manque de notes ou de sérieux, mais plutôt d'une pression sociale écrasante qui laisse croire qu'il faut décider de toute sa carrière professionnelle à dix-sept ans sans aucun droit à l'erreur ni temps de réflexion. Or la réalité universitaire est tout autre : aujourd'hui, près d'un étudiant sur quatre change d'orientation en fin de première année, souvent après avoir découvert des filières technologiques courtes ou des formations en alternance dont il ignorait totalement l'existence au lycée. Au lieu de demander aux jeunes ce qu'ils veulent « devenir » pour les trente prochaines années, nous préférons désormais organiser chaque trimestre des rencontres informelles avec d'anciens élèves qui racontent franchement leurs détours, leurs stages imprévus et leurs passerelles réussies. Ces témoignages concrets rassurent autant les familles que les lycéens en quête de repères réalistes, car chacun comprend enfin qu'une réorientation choisie au bon moment représente une étape normale d'apprentissage.`,
      zh: `Claire Delmas：我在斯特拉斯堡一所综合高中担任升学指导顾问，每年一月在公共平台填报志愿时我都能看到高三学生同样高涨的焦虑。问题很少出自成绩或态度，而是源于沉重社会压力——仿佛十七岁就必须定终身且没有容错或思考余地。现实却截然不同：近四分之一大学生在大一结束时转方向，往往是发现了高中时毫无概念的短期技术路径或学徒制。如今我们每季度邀请校友举行轻松分享会，坦诚讲述他们的弯路、意外实习与成功转轨。这些真实经历既宽慰了家长，也让寻找务实方向的高中生吃下定心丸，让大家明白适时调整方向本来就是学习成长中的正常一环。`,
      audioUrl: "materials/co/preset-listen-5-e3-d2.mp3",
    },
    {
      text: `Présentateur : Plusieurs lycées européens envisagent de repousser d'une demi-heure l'entrée en classe le matin. Le chronobiologiste Julien Favre explique l'enjeu concret pour la santé et la réussite des adolescents.
Julien Favre : On accuse souvent les jeunes de simplement se coucher trop tard par paresse, alors que l'horloge biologique subit à la puberté un décalage naturel d'environ deux heures : leur cerveau ne sécrète l'hormone du sommeil que plus tard dans la soirée, ce qui rend un réveil à six heures trente particulièrement brutal pour l'organisme. Bien sûr, l'usage prolongé des écrans dans l'obscurité avant de dormir aggrave encore nettement cette dette de sommeil accumulée. Mais dans les deux lycées suisses qui ont décalé le premier cours de sept heures quarante-cinq à huit heures trente sans rien changer au programme annuel, les élèves ont gagné en moyenne quarante minutes de repos nocturne par semaine de classe, se montrent plus attentifs dès le début de la matinée et arrivent beaucoup plus rarement en retard sans avoir rien mangé au lever. Les équipes éducatives y notent aussi une baisse sensible de l'irritabilité durant les heures d'évaluation matinales.`,
      zh: `主持人：多所欧洲高中正考虑将早晨第一节课推迟半小时。时间生物学专家 Julien Favre 阐述了这对青少年健康与学业的实际影响。
Julien Favre：人们常批评青少年纯属偷懒才睡太晚，其实青春期生理时钟会自然推后约两小时：大脑直到深夜才充分分泌睡眠激素，六点半起床对身体格外残酷。当然睡前在暗处长时间看屏幕会进一步加重睡眠债。而在两所将早课从七点四十五推迟至八点半、全年大纲不变的瑞士高中里，学生平均每周上学日多获四十分钟休息，一早注意力更集中，也极少出现饿着肚子踩点迟到的情况。两校教师团队还观察到早间随堂测验时学生的烦躁情绪显著减少。`,
      audioUrl: "materials/co/preset-listen-5-e3-d3.mp3",
    },
  ],
  questions: [
    { doc: 0, q: "Pourquoi plante-t-on ces jeunes arbres très proches les uns des autres ?", options: ["Pour accélérer leur croissance en les poussant vers la lumière.", "Pour bloquer définitivement le passage des piétons dans le quartier.", "Pour économiser le prix du paillage autour des racines."], answer: 0, why: "密植制造健康的向光竞争，促使树苗仅三年就能长到两米形成林荫。", difficulty: 2, skill: "paraphrase" },
    { doc: 0, q: "Comment a évolué l'attitude de certains habitants du voisinage ?", options: ["Ils ont exigé le rétablissement rapide des places de parking.", "Ils ont d'abord protesté avant de s'investir eux-mêmes dans l'entretien.", "Ils ont refusé l'ouverture du parc aux élèves de l'école."], answer: 1, why: "起初居民心疼失去12个车位，但在见识夏天的降温与蓄水效果后主动报名帮忙浇水盖草。", difficulty: 3, skill: "opinion" },
    { doc: 1, q: "Selon Claire Delmas, d'où provient principalement le stress des élèves en terminale ?", options: ["De l'augmentation brutale du coût des manuels universitaires.", "Du manque d'intérêt des familles pour les filières générales.", "De l'impression qu'un premier choix d'études engage toute la vie sans retour."], answer: 2, why: "她指出压力源自误以为十七岁必须定终身且不允许任何试错空间。", difficulty: 3, skill: "paraphrase" },
    { doc: 1, q: "Que souhaite montrer l'atelier animé par d'anciens élèves du lycée ?", options: ["Qu'un parcours d'études évolue souvent et offre plusieurs voies de réussite.", "Qu'il vaut mieux travailler dès seize ans plutôt que d'entrer à l'université.", "Que les filières courtes ferment leurs portes aux candidats réorientés."], answer: 0, why: "校友交流意在呈现成长途中的弯路与不同路径衔接，消解一次性定终身的焦虑。", difficulty: 3, skill: "inference" },
    { doc: 2, q: "Que souligne Julien Favre à propos du sommeil des adolescents ?", options: ["La lumière des écrans n'a aucun effet sur la sécrétion hormonale.", "Leur rythme biologique naturel est naturellement décalé vers le soir.", "Ils dorment mieux lorsqu'ils sautent le petit-déjeuner avant sept heures."], answer: 1, why: "青春期昼夜节律自然延后约两小时，睡眠激素较晚分泌。", difficulty: 2, skill: "paraphrase" },
    { doc: 2, q: "Qu'a permis le décalage horaire testé dans deux lycées suisses ?", options: ["Un allongement de deux heures de la pause du déjeuner.", "La suppression des devoirs sur table durant l'hiver.", "Une meilleure attention dès le matin et moins de retards."], answer: 2, why: "推迟到八点半上课后学生首节课更专注，饿肚子迟到也明显减少。", difficulty: 2, skill: "detail" },
  ],
};

/* ==================== 阅读整套 4（25 分 · 2020 新版考纲纯三选一 QCM） ==================== */

const R4_LONG_1: Raw = {
  form: "long",
  topic: "travail",
  intro: "Vous lisez dans un hebdomadaire économique une enquête sur les expérimentations de la semaine de quatre jours.",
  title: "La semaine de quatre jours à l'épreuve des métiers de terrain",
  docs: [
    {
      text: `Depuis deux ans, l'idée de travailler quatre jours par semaine sans diminution de salaire suscite un engouement grandissant en Europe. Présentée comme un remède efficace contre la fatigue chronique et les difficultés de recrutement, cette formule vient de faire l'objet d'une vaste évaluation publiée en février par l'Institut du travail de Bordeaux auprès de quatre-vingts entreprises pilotes françaises.

Les résultats montrent d'abord que deux modèles très différents se cachent derrière le même intitulé. Dans la majorité des sociétés de conseil ou de services informatiques, les salariés travaillent réellement moins d'heures : trente-deux heures hebdomadaires contre trente-cinq auparavant, sans baisse de rémunération. À l'inverse, plusieurs entreprises industrielles ou organismes publics ont maintenu les trente-cinq heures légales, mais concentrées sur quatre journées de près de neuf heures. Dans ce second cas, certains opérateurs ont signalé une fatigue accrue en fin de journée, notamment sur les postes demandant des gestes répétitifs.

Pour les dirigeants qui ont adopté la réduction réelle du temps de travail, le bilan reste toutefois nettement favorable. À Angers, l'atelier de mécanique de précision dirigé par Karim Haddad a vu son taux d'absentéisme reculer de trente pour cent en dix-huit mois, tandis que les candidatures spontanées ont doublé. « Nous avons supprimé les réunions superflues du matin et réorganisé la maintenance des machines pour gagner en efficacité », explique le chef d'entreprise. Les employés utilisent cette cinquième journée libérée pour leurs rendez-vous médicaux, leurs démarches administratives ou la garde des enfants, réduisant d'autant les retards imprévus du lundi au jeudi.

Cependant, les experts mettent en garde contre toute généralisation uniforme. Dans les hôpitaux, les commerces de proximité ou le secteur de la restauration, les horaires d'ouverture ne peuvent pas être réduits sans recruter du personnel supplémentaire pour couvrir l'ensemble de la semaine. Or, selon l'économiste Claire Delmas, « de nombreux petits commerces n'ont ni les marges financières pour financer ces embauches, ni les candidats disponibles sur le marché ». Dans ces métiers, compresser les journées risque même d'intensifier la cadence de travail au détriment de la qualité du service et de creuser l'écart entre cadres de bureau protégés et travailleurs en contact continu avec le public.

Cette fracture sociale inquiète également les syndicats, qui rappellent l'importance de la prévisibilité des plannings. Lorsque les roulements changent chaque mois pour garantir l'ouverture six jours sur sept dans un hôpital ou une grande surface, les salariés perdent le bénéfice d'un jour fixe prévisible pour organiser leur vie familiale ou suivre une formation continue. Plusieurs négociations collectives récentes insistent donc pour que la réduction horaire s'accompagne d'une prime de compensation ou d'un calendrier établi au moins un trimestre à l'avance.

L'enquête conclut que la semaine de quatre jours ne constitue ni une utopie irréaliste ni une recette miracle universelle. Elle porte ses fruits lorsque la baisse du temps de présence s'accompagne d'une refonte concertée des méthodes de travail, adaptée aux contraintes concrètes de chaque profession. À défaut d'un tel dialogue social interne, changer simplement le calendrier hebdomadaire déplace souvent la pression au lieu de la réduire.`,
      zh: `两年来，不降薪的四天工作制构想在欧洲引发了越来越高的热潮。作为应对长期倦怠和招工难的良方，波尔多劳动研究所今年二月刚公布了一项涵盖八十家法国试点企业的大型评估报告。

结果首先表明，同一个名称背后其实隐藏着截然不同的两种模式。多数咨询公司和软件服务企业让员工真正缩减了总工时——从每周三十五小时降至三十二小时且薪资不变。相反，多家制造企业或公共机构只是将法定的三十五小时压缩进每天近九小时的四个工作日。在后一种模式下，部分操作工反馈日末疲劳感明显上升，尤其是需要重复体力的岗位。

不过对于真正缩短工时的管理者来说，评估成效仍明显积极。在昂热，由 Karim Haddad 掌舵的精密机械车间在十八个月内将缺勤率降低了百分之三十，同时主动投递的求职简历翻了一倍。“我们砍掉了早晨冗余的例会，并重组了设备检修流程来提效。”这位企业主解释道。员工利用多出的第五天看病、办行政手续或照顾孩子，相应减少了周一到周四的临时请假和迟到。

但专家同时警告不要“一刀切”强制普及。在医院、社区小店或餐饮行业，营业和服务时段无法缩水，必须新招人手覆盖全周排班。而在经济学家 Claire Delmas 看来，“许多小微商户既拿不出额外利润负担扩招开支，市场上又缺少候补人手。”在这些行当里强行压缩工作日，反而可能让工作节奏更紧张并损害服务质量，还会拉大受保护的办公室白领与一线面对公众服务人员之间的落差。

这种社会落差也让工会组织颇感忧虑，他们特别强调排班可预期性的重要。一旦医院或大型超市为保每周六天营业而每月轮换班次，员工就无法拥有固定的第五天来安排家庭生活或参加在职培训。因此近期多项劳资集体谈判都坚持，缩短工时必须配套合理补偿或至少提前一个季度敲定排班日历。

研究报告最终指出，四天工作制既非遥不可及的乌托邦，也不是放之四海而皆准的灵丹妙药。只有当减少在岗时间配合协商一致的工作流程重构、贴合不同工种的实际限制时，它才会结出硕果。若缺乏这种企业内部的坦诚沟通，仅仅调整周历往往只是转移压力而非减轻压力。`,
    },
  ],
  questions: [
    {
      q: "Que révèle d'abord l'enquête de Bordeaux sur l'application de la semaine de quatre jours ?",
      options: ["Toutes les entreprises appliquent la même baisse d'heures.", "L'expression recouvre deux organisations horaires bien distinctes.", "Seules les grandes banques acceptent de conserver les salaires."],
      answer: 1,
      evidence: "deux modèles très différents se cachent derrière le même intitulé.",
      trapTypes: ["绝对化陷阱", "✓ 同义改写（deux modèles très différents）", "无中生有"],
      why: "第二段点出同样叫四天工作制，实际分成真减工时（32小时）与压缩工时（35小时挤进4天）两种截然不同模式。",
      difficulty: 2,
      skill: "paraphrase",
    },
    {
      q: "Quelle différence sépare les sociétés de conseil des entreprises industrielles étudiées ?",
      options: [
        "Les premières abaissent réellement le volume horaire tandis que plusieurs usines rallongent les journées.",
        "Seules les usines accordent un maintien intégral de la rémunération mensuelle.",
        "Les cabinets informatiques imposent désormais neuf heures de présence quotidienne."
      ],
      answer: 0,
      evidence: "Dans la majorité des sociétés de conseil ou de services informatiques, les salariés travaillent réellement moins d'heures : trente-deux heures hebdomadaires contre trente-cinq auparavant",
      trapTypes: ["✓ 对比关系改写", "张冠李戴", "主体颠倒（近九小时的是工业与公共机构）"],
      why: "第二段对比多数咨询和IT公司真正降至32小时，而多家工业企业或公共机构维持35小时但压缩为每天近9小时。",
      difficulty: 3,
      skill: "detail",
    },
    {
      q: "Quels effets positifs Karim Haddad a-t-il observés dans son atelier à Angers ?",
      options: ["Une baisse des absences et un attrait accru lors des recrutements.", "Une hausse immédiate des tarifs facturés aux clients.", "L'arrêt total de la maintenance sur les machines récentes."],
      answer: 0,
      evidence: "a vu son taux d'absentéisme reculer de trente pour cent en dix-huit mois, tandis que les candidatures spontanées ont doublé.",
      trapTypes: ["✓ 同义改写（absentéisme reculer + candidatures doublées）", "无中生有", "曲解原文（是重组检修流程而非停止维护）"],
      why: "第三段提到缺勤率下降30%且主动应聘简历翻倍。",
      difficulty: 2,
      skill: "paraphrase",
    },
    {
      q: "Pourquoi les commerces de proximité peinent-ils à adopter ce rythme selon Claire Delmas ?",
      options: [
        "Leurs clients refusent de faire leurs achats en fin de semaine.",
        "Ils manquent à la fois de marge budgétaire et de postulants pour embaucher en relais.",
        "La législation commerciale leur interdit de modifier les contrats existants."
      ],
      answer: 1,
      evidence: "de nombreux petits commerces n'ont ni les marges financières pour financer ces embauches, ni les candidats disponibles sur le marché",
      trapTypes: ["无中生有", "✓ 双重否定 ni… ni… 同义改写", "捏造法律禁令"],
      why: "第四段指出医院与社区小店无法缩短营业时长，但小商户既没有扩招利润空间，也招不到足够人手。",
      difficulty: 3,
      skill: "negation",
    },
    {
      q: "Selon Claire Delmas, que risque-t-il de se passer si l'on compresse les horaires sans embaucher ?",
      options: ["Les salariés risquent de subir un rythme encore plus lourd.", "Les clients accepteront volontiers des fermetures plus longues.", "Les hôpitaux fermeront leurs services d'urgence le vendredi."],
      answer: 0,
      evidence: "compresser les journées risque même d'intensifier la cadence de travail au détriment de la qualité du service",
      trapTypes: ["✓ 因果推断（intensifier la cadence）", "违背原文", "违背原文"],
      why: "第四段结尾说这样只会拉高工作强度（intensifier la cadence），还损害服务品质并拉大行业鸿沟。",
      difficulty: 4,
      skill: "inference",
    },
    {
      q: "Quelle inquiétude particulière les syndicats soulèvent-ils au cinquième paragraphe ?",
      options: [
        "Des horaires changeant sans cesse privent les salariés d'un jour libre stable pour s'organiser.",
        "Les formations professionnelles deviennent obligatoires tous les dimanches.",
        "Les primes d'ancienneté disparaissent dans les grandes surfaces."
      ],
      answer: 0,
      evidence: "Lorsque les roulements changent chaque mois pour garantir l'ouverture six jours sur sept dans un hôpital ou une grande surface, les salariés perdent le bénéfice d'un jour fixe prévisible",
      trapTypes: ["✓ 同义改写（perdent un jour fixe prévisible）", "曲解细节", "无中生有"],
      why: "第五段指出若每月频繁轮班，员工就失去了可预期的固定休息日来安排家庭或进修。",
      difficulty: 3,
      skill: "opinion",
    },
    {
      q: "À quelle condition la semaine de quatre jours réussit-elle selon la conclusion ?",
      options: ["En imposant le même emploi du temps à toutes les branches.", "En repensant concrètement les méthodes avec les équipes.", "En supprimant entièrement les congés payés d'été."],
      answer: 1,
      evidence: "Elle porte ses fruits lorsque la baisse du temps de présence s'accompagne d'une refonte concertée des méthodes de travail",
      trapTypes: ["正反颠倒", "✓ 同义改写（refonte concertée des méthodes）", "荒谬干扰"],
      why: "末段总结必须配合经过共同协商的工作方式重构（refonte concertée des méthodes de travail）。",
      difficulty: 5,
      skill: "paraphrase",
    },
  ],
};

const R4_LONG_2: Raw = {
  form: "long",
  topic: "culture",
  intro: "Vous lisez dans un magazine culturel un reportage sur les mesures prises contre le surtourisme dans les villes historiques européennes.",
  title: "Patrimoine sous pression : comment réguler l'afflux des visiteurs ?",
  docs: [
    {
      text: `Chaque été, les ruelles médiévales d'Annecy, du Mont-Saint-Michel ou de Colmar voient défiler plusieurs dizaines de milliers de visiteurs par jour, parfois dix fois plus que le nombre d'habitants permanents. Longtemps perçue uniquement comme une manne économique bienvenue, cette fréquentation record suscite aujourd'hui un malaise croissant dans les centres historiques, menacés par la saturation des transports, la dégradation des sites fragiles et l'envolée des prix immobiliers.

Pour desserrer cet étau sans fermer leurs portes, plusieurs collectivités expérimentent désormais des quotas journaliers et la réservation obligatoire à l'avance. Inspirées par l'exemple de Venise qui teste depuis deux ans un billet d'entrée pour les touristes ne séjournant pas à l'hôtel, certaines communes françaises limitent l'accès à leurs sentiers littoraux ou réservent des créneaux horaires aux monuments les plus convoités. Au Mont-Saint-Michel, une étude menée en juillet indique que l'étalement des arrivées par navette permet de fluidifier la montée vers l'abbaye et de réduire les files d'attente de près de quarante minutes aux heures de pointe.

Toutefois, cette gestion par quotas ne fait pas l'unanimité auprès des acteurs locaux. Pour Marc Renaud, restaurateur dans une petite cité bretonne, filtrer les entrées risque d'envoyer un message d'exclusion contraire à l'esprit même du patrimoine public. « Beaucoup de visiteurs spontanés renoncent quand ils doivent réserver un créneau trois semaines à l'avance sur un site internet, ce qui réduit directement notre chiffre d'affaires les jours de beau temps », déplore-t-il. Plusieurs associations défendent plutôt l'idée d'encourager le tourisme hors saison grâce à des tarifs réduits en automne et en hiver, période durant laquelle de nombreux musées et commerces peinent à couvrir leurs charges fixes.

D'autres urbanistes soulignent que la question dépasse la simple gestion des flux devant les monuments. En réalité, l'arrivée massive de visiteurs transforme peu à peu la fonction même des quartiers anciens : les boulangeries, cordonniers et librairies cèdent la place aux boutiques de souvenirs standardisés, poussant les jeunes ménages à quitter le centre. « Préserver un joyau architectural ne sert à rien si plus personne n'y vit à l'année », avertit Hélène Garnier, géographe spécialiste du tourisme. Selon elle, limiter les meublés touristiques de courte durée et orienter une partie de la taxe de séjour vers le logement des habitants restent indispensables.

Certaines villes vont encore plus loin en cherchant à déconcentrer la demande vers des lieux moins célèbres mais tout aussi riches sur le plan historique. Des offices de tourisme départementaux ont lancé des campagnes d'information qui découragent volontairement la promotion des plages et belvédères déjà saturés en juillet et août, préférant valoriser des musées ruraux ou des itinéraires cyclables méconnus à moins de trente kilomètres. Cette stratégie demande toutefois une évolution profonde des habitudes des voyageurs, encore largement influencées par quelques photographies spectaculaires relayées sur les réseaux sociaux.

En définitive, réguler le surtourisme exige d'articuler plusieurs leviers complémentaires : protéger la fragilité matérielle des lieux, répartir les séjours sur l'année et garantir que les villes historiques demeurent avant tout des espaces habitables pour ceux qui les font vivre au quotidien.`,
      zh: `每年夏天，阿讷西、圣米歇尔山或科尔马的中世纪小巷每天都要涌入数以万计的游客，有时甚至达到当地常住人口的十倍。曾经被单纯视为可观经济财源的客流高峰，如今却在众多历史老城引发越来越多的不安：交通不堪重负、脆弱古迹受损，房价与房租节节攀升。

为在不封闭城市的前提下缓解重压，多个地方政府开始试行每日限流和提前预约制。受威尼斯两年前试行对不过夜游客征收进城门票的启发，部分法国市镇对脆弱海岸步道实行预约分流，或对热门古迹设定入场时段。圣米歇尔山七月发布的一项评估显示，通过接驳车分时段疏导客流，使攀登修道院的通道更为顺畅，高峰时段排队等候时间缩短了近四十分钟。

不过，这套配额管制并非在当地各界毫无争议。布列塔尼一座古城里的餐馆老板 Marc Renaud 认为，对入城设卡可能传达出与公共文化遗产分享精神背道而驰的排他信号。“不少随兴而来的游客一看要提前三周在网上抢预约时段就干脆放弃了，晴朗周末时我们的营业额因此直接受影响。”他抱怨道。多个行业协会则更主张通过淡季票价优惠把客流引导至秋冬，因为在那些月份，当地许多博物馆和商铺本就难以维持日常固定开销。

还有一些城市规划师强调，问题绝不只是景点门口的排队管理。事实上，游客过度集中正在悄然改变老街区自身的功能：面包房、修鞋铺和书店接连退出，取而代之的是千篇一律的纪念品店，迫使年轻家庭搬离中心区。“如果一年到头都没人常住，留下一座建筑空壳又有什么意义呢？”旅游地理学家 Hélène Garnier 警示道。在她看来，限制短期旅游民宿数量、将部分旅游税收入定向投入居民住房保障同样缺一不可。

部分城市更进一步，尝试把客源分流到名气稍逊却同样富有历史底蕴的周边地段。一些省级旅游局发起了反季节与反扎堆宣传，主动在七八月淡化对早已饱和海滩和观景台的推广，转而推荐不到三十公里外鲜为人知的乡村博物馆或骑行路线。然而，要让旅客彻底改变习惯并不容易，毕竟大众出行依然高度受到社交平台上少数网红风景照的牵引。

归根结底，治理过度旅游需要多管齐下：保护古迹脆弱的实体承载力、将旅居人群分散到全年四季，并确保历史名城首先依然是适合当地居民日常安居的生活空间。`,
    },
  ],
  questions: [
    {
      q: "Pourquoi la fréquentation record inquiète-t-elle désormais de nombreuses communes historiques ?",
      options: ["Elle nuit à l'équilibre local, aux monuments et au coût du logement.", "Elle oblige les musées nationaux à fermer pendant la période estivale.", "Elle supprime entièrement les recettes fiscales liées au commerce."],
      answer: 0,
      evidence: "menacés par la saturation des transports, la dégradation des sites fragiles et l'envolée des prix immobiliers.",
      trapTypes: ["✓ 同义改写", "正反颠倒", "绝对化捏造"],
      why: "第一段提到交通饱和、脆弱古迹受损与房价飙升带来了忧虑。",
      difficulty: 2,
      skill: "paraphrase",
    },
    {
      q: "Quelle mesure Venise expérimente-t-elle pour limiter la congestion touristique ?",
      options: [
        "Elle impose une contribution aux visiteurs d'un jour qui ne dorment pas sur place.",
        "Elle réserve l'accès des canaux aux seuls clients des grands hôtels.",
        "Elle interdit toute visite guidée durant les mois de juillet et d'août."
      ],
      answer: 0,
      evidence: "Venise qui teste depuis deux ans un billet d'entrée pour les touristes ne séjournant pas à l'hôtel",
      trapTypes: ["✓ 限定否定同义改写（ne séjournant pas à l'hôtel）", "正反颠倒（反而是不过夜游客买门票）", "无中生有"],
      why: "第二段指出威尼斯试行向不在当地酒店过夜的一日游旅客收取进城门票。",
      difficulty: 3,
      skill: "negation",
    },
    {
      q: "Quel résultat concret l'organisation des navettes au Mont-Saint-Michel a-t-elle permis d'obtenir ?",
      options: [
        "Le temps d'attente aux moments les plus chargés a nettement reculé.",
        "Le prix d'entrée de l'abbaye a diminué de moitié en plein été.",
        "Les voitures particulières peuvent désormais stationner au pied des remparts."
      ],
      answer: 0,
      evidence: "l'étalement des arrivées par navette permet de fluidifier la montée vers l'abbaye et de réduire les files d'attente de près de quarante minutes aux heures de pointe.",
      trapTypes: ["✓ 同义改写（réduire les files d'attente de près de 40 minutes）", "偷换概念", "违背常识与原文"],
      why: "第二段末尾说明接驳车错峰疏导让修道院上山人流更顺畅，高峰期排队缩短近四十分钟。",
      difficulty: 2,
      skill: "detail",
    },
    {
      q: "Que craint le restaurateur Marc Renaud face à la réservation obligatoire ?",
      options: ["Une surcharge de travail administratif pour son personnel en cuisine.", "Une baisse d'activité due aux visiteurs de dernière minute découragés.", "L'augmentation du tarif des transports maritimes en hiver."],
      answer: 1,
      evidence: "Beaucoup de visiteurs spontanés renoncent quand ils doivent réserver un créneau trois semaines à l'avance sur un site internet, ce qui réduit directement notre chiffre d'affaires",
      trapTypes: ["无中生有", "✓ 同义改写（visiteurs spontanés -> de dernière minute）", "无中生有"],
      why: "第三段指出随兴游客若需提前三周网上预约往往放弃行程，导致其营业额下滑。",
      difficulty: 3,
      skill: "paraphrase",
    },
    {
      q: "Quelle transformation profonde des centres anciens les urbanistes déplorent-ils au quatrième paragraphe ?",
      options: [
        "L'abandon complet de l'entretien des façades médiévales par les mairies.",
        "Le remplacement progressif des commerces du quotidien par des enseignes dédiées aux touristes.",
        "La transformation des musées municipaux en immeubles de bureaux."
      ],
      answer: 1,
      evidence: "les boulangeries, cordonniers et librairies cèdent la place aux boutiques de souvenirs standardisés, poussant les jeunes ménages à quitter le centre.",
      trapTypes: ["正反颠倒（恰恰在谈只保古建筑外壳不够）", "✓ 同义改写（cèdent la place aux boutiques de souvenirs）", "无中生有"],
      why: "第四段描写面包房、修鞋铺和书店接连让位于千篇一律的纪念品店，改变了老城日常生活功能。",
      difficulty: 3,
      skill: "paraphrase",
    },
    {
      q: "Quel aspect de la question Hélène Garnier juge-t-elle prioritaire ?",
      options: ["Construire de grands parcs de stationnement gratuits devant les remparts.", "Maintenir des habitants permanents et soutenir le logement local.", "Fermer les quartiers médiévaux tous les week-ends d'automne."],
      answer: 1,
      evidence: "Préserver un joyau architectural ne sert à rien si plus personne n'y vit à l'année",
      trapTypes: ["无中生有", "✓ 警句语气与立场推断", "违背第三段（秋冬反而要吸引客流）"],
      why: "她以反讽式警示指出若无人常住只剩建筑空壳毫无意义，必须限制短租并用旅游税保障常住人口住房。",
      difficulty: 4,
      skill: "opinion",
    },
    {
      q: "Que retient-on de la conclusion du reportage ?",
      options: ["Il faut choisir une solution unique et l'imposer partout en Europe.", "La régulation combine protection physique des sites, calendrier annuel et qualité de vie des résidents.", "Seule la suppression totale des taxes de séjour peut sauver le commerce."],
      answer: 1,
      evidence: "protéger la fragilité matérielle des lieux, répartir les séjours sur l'année et garantir que les villes historiques demeurent avant tout des espaces habitables",
      trapTypes: ["绝对化陷阱", "✓ 全篇主旨同义收束", "正反颠倒"],
      why: "末段强调必须多手段协同：保护实体、拉平季节分布并守住居民日常宜居空间。",
      difficulty: 5,
      skill: "gist",
    },
  ],
};

const R4_OPINIONS: Raw = {
  form: "opinions",
  topic: "medias-presse",
  intro: "Vous lisez les messages de trois lecteurs dans un forum consacré aux adolescents et aux réseaux sociaux.",
  title: "Faut-il bloquer l'accès aux réseaux sociaux avant quinze ans ?",
  docs: [
    {
      text: `Élodie
Je comprends tout à fait l'inquiétude des médecins qui dénoncent le manque de sommeil et les comparaisons permanentes subies par les plus jeunes sur les plateformes vidéo. Pour autant, une interdiction légale pure et simple avant quinze ans me paraît surtout symbolique et facile à contourner : il suffit à un élève de sixième d'emprunter le téléphone d'un grand frère ou de mentir sur son année de naissance. Pire encore, si l'on exige une carte d'identité ou une vérification du visage pour chaque internaute, cela menace la vie privée de tous les citoyens, adultes compris. À mon avis, l'État ferait mieux d'obliger les grandes plateformes à désactiver dès maintenant le défilement infini et les algorithmes de recommandation pour les comptes mineurs, tout en finançant de vraies heures d'éducation aux médias et à l'esprit critique dès l'entrée au collège.

Karim
En tant que père de deux collégiens, je vois bien à quel point il devient épuisant de négocier seul chaque soir face à des applications conçues par des armées d'ingénieurs pour capter l'attention heure après heure. Lorsque tous les camarades de classe discutent sur le même réseau le soir, l'adolescent qui n'y a pas droit se sent vite mis à l'écart, ce qui place les familles devant un dilemme impossible. Même si la barrière technique n'est pas infaillible à cent pour cent, inscrire une limite claire d'âge à quinze ans dans la loi enverrait un repère collectif utile, un peu comme la limite pour conduire un scooter ou acheter de l'alcool. Cela aiderait enfin les parents à poser un cadre commun solide sans passer systématiquement pour des tyrans isolés à la maison.

Sandrine
Dans ce débat, on oublie souvent que les réseaux sociaux ne représentent pas le même usage pour tous les jeunes : dans un village isolé, ils permettent aussi à un adolescent passionné de musique ou de dessin de trouver des pairs qui partagent ses centres d'intérêt et d'élargir son horizon culturel. De plus, interdire jusqu'à quinze ans risque de repousser la découverte brutale d'internet au lycée sans aucun accompagnement progressif. Ce qu'il faut d'abord, c'est une règle claire à la maison — pas d'écran dans la chambre après vingt et une heures — accompagnée d'un vrai dialogue familial sur ce qu'on regarde. En classe comme en famille, apprendre peu à peu à trier l'information vaut mieux qu'un blocage tardif, même si la loi doit punir très sévèrement les plateformes qui laissent circuler du harcèlement ou des contenus toxiques.`,
      zh: `Élodie
我完全理解医生们对青少年睡眠不足以及在视频平台上承受持续攀比压力的担忧。即便如此，对十五岁以下人群实行一刀切的法律禁令，在我看来更多停留在象征层面且极易被绕过：初一学生只要借用哥哥姐姐的手机，或随便改个出生年份就能绕开。更糟的是，如果要求每个网民上传身份证或人脸识别，这会直接威胁包括成年人在内的所有人的隐私。我认为国家更应该趁早强制大平台对未成年人账号关闭无限下拉刷新和推荐算法，同时从初一开始真正投入资金开设媒介素养与批判性思维课程。

Karim
作为两名初中生的父亲，我深切体会到每天晚上单凭家长去对抗由大群工程师专门设计、只为持续抓人眼球的应用有多令人筋疲力尽。当全班同学晚上都在同一个社交平台聊天时，唯一不让用的孩子很快会觉得被排挤，这把家长逼入两难境地。哪怕技术拦截做不到百分之百无懈可击，将十五岁的明确门槛写进法律仍能树立清晰的社会共识，就像禁止未成年人买酒或限制驾车年龄一样。这终于能帮父母建立坚实共同底线，而不必在家中独自扮演“坏人”。

Sandrine
这场讨论往往忽略了一个事实：社交网络对所有年轻人的意义并不相同。在偏僻乡村，热爱音乐或绘画的青少年还能借此找到志同道合的伙伴并拓展文化视野。况且一味禁止到十五岁，只会把缺乏引导的“互联网撞击”推迟到高中突然发生。最紧要的是家里立下清楚规矩——晚上九点后屏幕不得进卧室——并辅以亲子间对浏览内容的真正沟通。在学校与家庭里循序渐进学会甄别信息，胜过突然断网后再彻底放手，当然法律也必须严惩放任网络霸凌或有害内容传播的平台。`,
    },
  ],
  questions: [
    { q: "Qui estime qu'une interdiction légale aiderait surtout les parents à fixer une règle commune ?", options: ["Élodie", "Karim", "Sandrine"], answer: 1, evidence: "inscrire une limite claire d'âge à quinze ans dans la loi enverrait un repère collectif utile", trapTypes: ["张冠李戴", "✓ 对应 Karim", "张冠李戴"], why: "Karim 说把15岁写进法律能提供共同社会参照线，让父母不再在家里孤军奋战。", difficulty: 2, skill: "paraphrase" },
    { q: "Qui craint que la vérification d'âge en ligne ne porte atteinte à la protection des données de tous ?", options: ["Élodie", "Karim", "Sandrine"], answer: 0, evidence: "si l'on exige une carte d'identité ou une vérification du visage pour chaque internaute, cela menace la vie privée de tous les citoyens, adultes compris.", trapTypes: ["✓ 对应 Élodie", "张冠李戴", "张冠李戴"], why: "Élodie 认为要求身份证或人脸验证将威胁全体网民包括成年人的隐私。", difficulty: 2, skill: "detail" },
    { q: "Qui rappelle l'utilité sociale de ces plateformes pour les jeunes vivant loin des grandes villes ?", options: ["Élodie", "Karim", "Sandrine"], answer: 2, evidence: "dans un village isolé, ils permettent aussi à un adolescent passionné de musique ou de dessin de trouver des pairs qui partagent ses centres d'intérêt", trapTypes: ["张冠李戴", "张冠李戴", "✓ 对应 Sandrine"], why: "Sandrine 举了偏远乡村青少年通过网络寻找共同兴趣伙伴的例子。", difficulty: 3, skill: "detail" },
    { q: "Qui suggère d'interdire certaines fonctions techniques comme le défilement infini pour les mineurs ?", options: ["Élodie", "Karim", "Sandrine"], answer: 0, evidence: "l'État ferait mieux d'obliger les grandes plateformes à désactiver dès maintenant le défilement infini et les algorithmes de recommandation pour les comptes mineurs", trapTypes: ["✓ 对应 Élodie", "张冠李戴", "张冠李戴"], why: "Élodie 呼吁强制平台为未成年账号关闭无限滚动（défilement infini）和算法推荐。", difficulty: 3, skill: "paraphrase" },
    { q: "Qui compare le seuil des quinze ans à d'autres règles déjà acceptées dans la société ?", options: ["Élodie", "Karim", "Sandrine"], answer: 1, evidence: "un peu comme la limite pour conduire un scooter ou acheter de l'alcool.", trapTypes: ["张冠李戴", "✓ 对应 Karim", "张冠李戴"], why: "Karim 将其类比为骑轻便摩托或购酒年龄限制等社会共识。", difficulty: 3, skill: "paraphrase" },
    { q: "Qui plaide pour une initiation encadrée plutôt qu'une coupure totale suivie d'une liberté soudaine au lycée ?", options: ["Élodie", "Karim", "Sandrine"], answer: 2, evidence: "interdire jusqu'à quinze ans risque de repousser la découverte brutale d'internet au lycée sans aucun accompagnement progressif.", trapTypes: ["张冠李戴", "张冠李戴", "✓ 对应 Sandrine"], why: "Sandrine 认为禁到15岁只是把毫无引导的上网推迟到高中，更主张家庭设限+渐进学会甄别信息。", difficulty: 4, skill: "inference" },
  ],
};

/* ==================== 阅读整套 5（25 分 · 2020 新版考纲：调查综述 + 署名评论 tribune + 三人观点） ==================== */

const R5_LONG_1: Raw = {
  form: "long",
  topic: "arts-francophonie",
  intro: "Vous lisez dans un quotidien culturel une enquête consacrée à l'économie des librairies indépendantes en France.",
  title: "Librairies de quartier face aux géants en ligne : les ressorts d'une résistance",
  docs: [
    {
      text: `Alors que la vente à distance domine désormais l'habillement ou l'électronique grand public, le commerce du livre offre en France un paysage singulier : plus de trois mille cinq cents librairies indépendantes maillent encore les centres-bourgs et les quartiers urbains. Selon le dernier bilan annuel du Syndicat de la librairie française, ces commerces de proximité réalisent toujours près de quarante-deux pour cent des ventes de livres neufs au détail, loin devant la plupart de leurs voisins européens où les chaînes financiarisées et les plateformes logistiques ont balayé les boutiques indépendantes en moins de vingt ans.

Ce maintien tient d'abord à un socle législatif adopté en mille neuf cent quatre-vingt-un : le prix unique du livre, imprimé au dos de chaque ouvrage par l'éditeur, interdit à tout détaillant d'accorder une remise supérieure à cinq pour cent. En deux mille vingt-trois, le législateur a complété cet édifice en instaurant un tarif minimal de trois euros pour toute expédition d'une commande inférieure à trente-cinq euros, afin d'empêcher les géants du commerce électronique de subventionner la livraison quasi gratuite à perte. « Sans cette digue tarifaire, un petit libraire de Valence ou d'Aurillac n'aurait aucune chance de survivre face à des entrepôts robotisés », souligne Claire Montel, économiste de la culture à Rennes.

Pourtant, la protection de la loi ne suffit nullement à garantir l'équilibre financier au quotidien. La marge nette d'une librairie indépendante dépasse rarement deux pour cent du chiffre d'affaires, soit l'une des plus faibles de tout le commerce de détail. La flambée récente des loyers commerciaux en centre-ville, conjuguée au coût du chauffage et du transport des cartons d'invendus retournés aux distributeurs, étrangle les trésoreries les plus jeunes. Près d'un établissement créé depuis cinq ans peine encore à verser un salaire complet à ses fondateurs durant les deux premiers exercices.

Pour fidéliser leurs lecteurs sans se battre sur les prix, de nombreuses équipes réinventent leur métier autour du conseil personnalisé et de la vie culturelle locale. À Poitiers comme à Chambéry, des libraires animent chaque semaine des rencontres d'auteurs, des clubs de lecture pour adolescents ou des coins café, tout en mutualisant un portail numérique collectif qui permet à l'acheteur de réserver un titre en ligne le matin et de le retirer l'après-midi même à deux pas de chez lui. Cette alliance entre présence humaine et outil numérique séduit notamment des lecteurs lassés par la froideur des recommandations algorithmiques.

Les collectivités territoriales disposent elles aussi d'un levier décisif mais encore inégalement mobilisé : leurs achats publics pour les bibliothèques municipales et les établissements scolaires. Lorsque les mairies découpent leurs appels d'offres en lots accessibles aux acteurs locaux plutôt que de tout confier à un grossiste national unique, elles consolident durablement toute la chaîne culturelle d'un territoire. Reste à transmettre ces commerces exigeants au moment où une génération entière de libraires approche de la retraite, un défi qui dépendra autant de l'accès au crédit que du maintien d'un foncier abordable en cœur de ville.`,
      zh: `尽管远程网购如今在服装或大众电子产品领域占据主导地位，法国的图书零售却呈现出独特的图景：超过三千五百家独立书店依然星罗棋布于小镇中心与城市街区。根据法国书店工会的最新年度报告，这类社区书店仍占新书零售总额近百分之四十二，远高于大多数欧洲邻国——在那些国家，资本化连锁店和物流巨头不到二十年便席卷了独立书店。

这一韧性首先源于一九八一年确立的法律基石：由出版商印在每本书封底的“图书统一定价制”，禁止任何零售商提供超过百分之五的折扣。二〇二三年，立法机构进一步完善了这道屏障，规定凡低于三十五欧元的网购图书订单必须收取至少三欧元运费，以阻止电商巨头贴钱提供近乎免费的包邮服务。“要是没有这道价格堤坝，瓦朗斯或欧里亚克的小书店面对全自动仓储根本毫无生机，”雷恩文化经济学家 Claire Montel 指出。

然而，法律保护绝不足以确保日常财务高枕无忧。独立书店的净利润率极少超过营业额的百分之二，几乎是所有零售行业中最低的。近年来市中心商铺租金飙升，加上取暖开支以及将滞销退书寄回发行商的物流费用，令起步不久的书店现金流捉襟见肘。近五年新开的书店中，不少在头两个财年仍难以向创办人发出全额薪水。

为了在不打价格战的前提下留住读者，许多团队围绕个性化荐书和本地文化生活重塑职业形态。在普瓦捷和尚贝里，书店每周举办作家见面会、青少年读书会或附设咖啡角，同时共建联合数字门户——读者早上在线预订书目，当天下午就能在家门口取书。这种人文温度与数字工具的结合，格外吸引厌倦了冰冷算法推荐的读者。

地方政府手中同样握有一项关键却尚未充分运用的杠杆：市政图书馆和学校的公共图书采购。当市政府将招标拆分为本地书商能够承接的小标段，而非全部打包交给单一全国批发商时，便能长久稳固一方文化生态。眼下整整一代书店经营者即将步入退休，如何完成这些高门槛小店的代际接班，既取决于信贷支持，也取决于能否守住市中心可负担的商铺空间。`,
    },
  ],
  questions: [
    {
      q: "En quoi la situation des librairies indépendantes françaises se distingue-t-elle en Europe ?",
      options: [
        "Elles conservent une part majeure des ventes malgré l'essor du commerce numérique.",
        "Elles réalisent désormais la majorité de leur chiffre d'affaires à l'étranger.",
        "Elles ont remplacé toutes les grandes surfaces culturelles depuis vingt ans."
      ],
      answer: 0,
      evidence: "ces commerces de proximité réalisent toujours près de quarante-deux pour cent des ventes de livres neufs au détail, loin devant la plupart de leurs voisins européens",
      trapTypes: ["✓ 同义改写（près de 42 % + loin devant leurs voisins）", "无中生有", "过度夸大"],
      why: "第一段指出法国独立书店仍占新书零售近42%，远胜许多独立书店已被连锁和网购平台挤垮的欧洲邻国。",
      difficulty: 2,
      skill: "gist",
    },
    {
      q: "Quel objectif visait la mesure adoptée en 2023 sur les frais d'envoi ?",
      options: [
        "Financer directement la rénovation thermique des boutiques anciennes.",
        "Limiter l'avantage concurrentiel des plateformes qui livraient presque gratuitement.",
        "Interdire l'expédition postale des commandes supérieures à trente-cinq euros."
      ],
      answer: 1,
      evidence: "afin d'empêcher les géants du commerce électronique de subventionner la livraison quasi gratuite à perte.",
      trapTypes: ["张冠李戴", "✓ 目的同义改写", "数值条件颠倒（针对低于35欧的订单收费）"],
      why: "第二段说明2023年规定不满35欧订单至少收3欧运费，旨在遏制大型电商赔本包邮的不对称竞争。",
      difficulty: 2,
      skill: "paraphrase",
    },
    {
      q: "Malgré le cadre légal protecteur, quelle fragilité pèse lourdement sur ces commerces ?",
      options: [
        "La rentabilité demeure infime face à la hausse des charges fixes et logistiques.",
        "La loi oblige les libraires à détruire eux-mêmes tous les ouvrages invendus.",
        "Les éditeurs refusent désormais d'imprimer le tarif au dos des romans."
      ],
      answer: 0,
      evidence: "La marge nette d'une librairie indépendante dépasse rarement deux pour cent du chiffre d'affaires, soit l'une des plus faibles de tout le commerce de détail.",
      trapTypes: ["✓ 让步段核心同义改写（marge dépasse rarement 2 % + loyers/transport）", "曲解退书机制（是退回发行商而非销毁）", "违背第二段"],
      why: "第三段指出法律保护并不等于盈利宽裕：净利率极少超过2%，叠加房租、取暖和退书运费令现金流紧绷。",
      difficulty: 3,
      skill: "negation",
    },
    {
      q: "Comment certains libraires utilisent-ils le numérique selon le quatrième paragraphe ?",
      options: [
        "Ils remplacent leurs vendeurs par des bornes de recommandation automatique.",
        "Ils associent réservation sur un site partagé et retrait rapide en magasin.",
        "Ils vendent exclusivement des livres audio téléchargeables à prix réduit."
      ],
      answer: 1,
      evidence: "tout en mutualisant un portail numérique collectif qui permet à l'acheteur de réserver un titre en ligne le matin et de le retirer l'après-midi même",
      trapTypes: ["正反颠倒（恰恰吸引厌倦算法推荐的读者）", "✓ 同义改写", "违背统一定价且无中生有"],
      why: "第四段介绍多家书店共享联合线上门户，方便读者早晨网订、下午到街区店取书，兼顾便捷与人情味。",
      difficulty: 2,
      skill: "detail",
    },
    {
      q: "D'après l'article, qu'est-ce qui attire particulièrement certains lecteurs vers ces lieux ?",
      options: [
        "Les rabais importants accordés chaque semaine sur les nouveautés.",
        "Une orientation humaine et des échanges qui tranchent avec les choix automatisés.",
        "L'ouverture continue des boutiques jusqu'à minuit dans toutes les préfectures."
      ],
      answer: 1,
      evidence: "Cette alliance entre présence humaine et outil numérique séduit notamment des lecteurs lassés par la froideur des recommandations algorithmiques.",
      trapTypes: ["违背法律上限（最多5%折扣）", "✓ 同义改写（présence humaine vs recommandations algorithmiques）", "无中生有"],
      why: "第四段末尾说明人文交流结合线上预订尤其打动厌倦了冰冷算法推荐的读者。",
      difficulty: 3,
      skill: "paraphrase",
    },
    {
      q: "Comment les municipalités peuvent-elles concrètement soutenir les librairies locales ?",
      options: [
        "En adaptant leurs marchés publics pour qu'elles puissent fournir écoles et bibliothèques.",
        "En taxant les lecteurs qui empruntent plus de trois ouvrages par mois.",
        "En imposant un grossiste national unique à tous les collèges du département."
      ],
      answer: 0,
      evidence: "Lorsque les mairies découpent leurs appels d'offres en lots accessibles aux acteurs locaux plutôt que de tout confier à un grossiste national unique",
      trapTypes: ["✓ 同义改写（découpent leurs appels d'offres en lots accessibles）", "无中生有", "正反颠倒"],
      why: "第五段指出市政采购若把标段拆小而非全包给单一全国批发商，本地书店就能参与图书馆和学校供书。",
      difficulty: 3,
      skill: "detail",
    },
    {
      q: "Quel enjeu futur la conclusion met-elle en avant pour la pérennité du secteur ?",
      options: [
        "La reprise des boutiques lors des départs à la retraite dépendra des loyers et du financement.",
        "La disparition prochaine du livre imprimé rend toute transmission inutile.",
        "Le Syndicat de la librairie demande l'abrogation de la loi de 1981."
      ],
      answer: 0,
      evidence: "Reste à transmettre ces commerces exigeants au moment où une génération entière de libraires approche de la retraite, un défi qui dépendra autant de l'accès au crédit que du maintien d'un foncier abordable",
      trapTypes: ["✓ 结尾前瞻推断", "无中生有", "正反颠倒"],
      why: "末句点明随着大批店主临近退休，书店接班成败取决于信贷支持与市中心商铺租金能否保持可负担。",
      difficulty: 5,
      skill: "inference",
    },
  ],
};

const R5_LONG_2: Raw = {
  form: "long",
  topic: "economie",
  intro: "Vous lisez cette tribune publiée dans la rubrique « Idées » d'un quotidien francophone.",
  title: "La tyrannie des étoiles et des tableaux de bord : quand tout mesurer abîme le métier",
  docs: [
    {
      text: `Impossible désormais de quitter une consultation médicale, de récupérer un colis ou de suivre un cours universitaire sans recevoir dans la minute un courriel souriant : « Sur une échelle de un à cinq, recommanderiez-vous votre expérience ? » Née dans le commerce en ligne pour rassurer des acheteurs éloignés, cette fièvre de la notation permanente a colonisé en silence les services publics, les hôpitaux, les rédactions et les ateliers. Sous couvert d'écoute bienveillante de l'usager et de transparence moderne, nous avons érigé le chiffre instantané en juge suprême de toute activité humaine.

Certes, nul ne regrettera l'époque où certaines administrations ignoraient superbement les réclamations légitimes des citoyens ou laissaient traîner un dossier six mois sans explication. Disposer de repères objectifs pour repérer un dysfonctionnement logistique grave demeure parfaitement sain. Mais la dérive commence dès que l'indicateur cesse d'être une boussole parmi d'autres pour devenir la cible unique : comme l'avaient pressenti plusieurs économistes, une mesure transformée en objectif perd aussitôt sa valeur d'information, car chacun adapte son comportement pour flatter le compteur plutôt que pour accomplir consciencieusement sa mission.

On le constate tous les jours sur le terrain avec une ironie parfois cruelle. L'enseignant soucieux d'obtenir d'excellentes évaluations en fin de semestre hésite à formuler une critique exigeante qui froisserait son auditoire ; le conseiller pour l'emploi oriente en priorité les dossiers faciles à clore afin de soigner sa statistique mensuelle, délaissant les parcours cabossés qui réclameraient trois heures d'écoute patiente ; le soignant passe vingt minutes à cocher des cases sur un logiciel de traçabilité au lieu de tenir la main d'un malade anxieux. Quelle belle victoire du progrès managérial : jamais l'écran de contrôle n'a affiché autant de voyants verts pendant que les professionnels s'épuisent à prouver qu'ils travaillent !

Plus grave encore, cette obsession comptable ne saisit du travail que sa surface immédiatement visible. Or ce qui fait la noblesse et la solidité d'un métier — la confiance tissée sur dix ans entre un artisan et son quartier, la prévention discrète d'un conflit social, la curiosité éveillée chez un élève qui ne portera ses fruits que cinq ans plus tard — échappe par nature aux questionnaires envoyés trente secondes après la prestation. En ne valorisant que ce qui se mesure vite, les organisations atrophient le sens des responsabilités et transforment des praticiens qualifiés en exécutants dociles obsédés par leur note moyenne.

Il est grand temps de desserrer cet étau chiffré avant qu'il ne décourage définitivement les vocations. Redonner de l'air aux métiers ne signifie pas refuser de rendre des comptes au public, mais réhabiliter la délibération collective entre pairs, le temps long et le jugement professionnel. Car la qualité véritable d'un soin, d'un cours ou d'un ouvrage artisanal ne se décrète pas à coups de pouces levés sur un téléphone : elle s'éprouve dans la durée.`,
      zh: `如今，无论是刚走出诊室、取走一件快递，还是听完一堂大学课程，几乎一分钟内都会收到一封笑脸盈盈的邮件：“在一到五分的量表上，您有多愿意推荐本次体验？”这股源于电商平台、原本用于安抚异地买家的实时打分狂热，已悄然蔓延至公共服务、医院、编辑部与工坊。打着倾听用户心声与现代透明管理的旗号，我们把即时数字奉为了裁决一切人类劳动的最高法官。

诚然，没人会怀念过去某些衙门傲慢无视民众合理投诉、把一份材料拖上半年不给解释的年代。借助客观指标及时发现严重的流程故障完全合情合理。然而，一旦指标不再只是参考罗盘之一，而异化为唯一追求的目标，滑坡便开始了：正如多位经济学家早先预见的那样，当一项测量沦为考核靶心，它便立刻丧失了真实的信息价值，因为人人都会调整行为去讨好计数器，而不是踏踏实实履行职责。

在日常一线，人们每天都能目睹这种近乎残酷的讽刺。希望期末拿到高分评价的教师，不敢提出可能拂逆学生心意的严格批评；就业顾问优先处理容易结案的申请以美化月度报表，却冷落了需要耐心倾听三小时的坎坷求职者；医护人员花二十分钟在留痕软件上勾选方框，却腾不出手握一握焦虑病人的手。多么辉煌的管理进步啊：监控屏幕上的绿灯从未如此亮眼，而专业人员却在自证“我有在干活”的内耗中精疲力竭！

更严重的是，这种数字执念只能捕捉工作中最表层、最立竿见影的皮毛。然而真正构成一门职业尊严与根基的东西——手艺人与街坊十年间建立的信任、悄然化解于萌芽状态的社会摩擦、在学生心中播下却要五年后才开花结果的求知欲——天生就无法被服务结束三十秒后弹出的问卷所丈量。如果只嘉奖能被迅速量化的东西，机构就会萎缩从业者的责任感，把有资质的行家变成只盯着平均分的顺从执行工。

在这把数字枷锁彻底浇灭职业热忱之前，早该松绑了。为行业松绑绝不意味着拒绝向公众负责，而是要重拾同行间的集体专业评议、长期主义与职业判断力。毕竟，一次诊疗、一堂好课或一件手工作品的真正品质，从来不是靠手机屏幕上随手点下的大拇指决定的——它只能在时间沉淀中经受检验。`,
    },
  ],
  questions: [
    {
      q: "Quelle thèse principale l'auteur défend-il tout au long de cette tribune ?",
      options: [
        "La généralisation de l'évaluation chiffrée instantanée dénature le sens et la qualité du travail.",
        "Les questionnaires de satisfaction en ligne améliorent efficacement l'hôpital et l'université.",
        "Il faudrait réserver la notation sur cinq étoiles aux seuls fonctionnaires de l'État."
      ],
      answer: 0,
      evidence: "Sous couvert d'écoute bienveillante de l'usager et de transparence moderne, nous avons érigé le chiffre instantané en juge suprême de toute activité humaine.",
      trapTypes: ["✓ 全篇核心论点提炼", "正反颠倒（作者正是批判这一蔓延）", "违背作者立场"],
      why: "作者开篇至结尾一贯批判将电商式即时打分与量化报表奉为圭臬，指出其扭曲职业初衷并侵蚀工作品质。",
      difficulty: 2,
      skill: "gist",
    },
    {
      q: "Que concède l'auteur au début du deuxième paragraphe avant de formuler sa critique ?",
      options: [
        "Les usagers mentent systématiquement lorsqu'ils répondent aux enquêtes par courriel.",
        "Suivre certains repères concrets reste légitime pour corriger de vrais blocages et éviter l'indifférence passée.",
        "Les administrations d'autrefois traitaient les dossiers beaucoup plus rapidement qu'aujourd'hui."
      ],
      answer: 1,
      evidence: "Certes, nul ne regrettera l'époque où certaines administrations ignoraient superbement les réclamations légitimes des citoyens",
      trapTypes: ["无中生有", "✓ 让步结构 Certes… Mais… 精准识别", "正反颠倒（过去曾拖半年不解释）"],
      why: "第二段以 « Certes… » 先承认没人怀念过去无视投诉的官僚作风，保留客观指标排查故障本身合理，随后以 « Mais » 转入核心批判。",
      difficulty: 3,
      skill: "opinion",
    },
    {
      q: "Selon le deuxième paragraphe, que se produit-il dès qu'un chiffre devient l'unique objectif ?",
      options: [
        "Les professionnels orientent leurs gestes pour obtenir un bon score au détriment du travail réel.",
        "Les logiciels informatiques tombent plus souvent en panne dans les services publics.",
        "Les clients refusent de payer les prestations tant qu'ils n'ont pas reçu le questionnaire."
      ],
      answer: 0,
      evidence: "chacun adapte son comportement pour flatter le compteur plutôt que pour accomplir consciencieusement sa mission.",
      trapTypes: ["✓ 同义改写（flatter le compteur plutôt que…）", "无中生有", "无中生有"],
      why: "一旦指标异化为唯一靶心，从业者就会为了迎合数字而改变动作，背离真正的职业使命。",
      difficulty: 3,
      skill: "paraphrase",
    },
    {
      q: "Dans la phrase « Quelle belle victoire du progrès managérial… » (paragraphe 3), quel est le ton de l'auteur ?",
      options: [
        "Franchement admiratif devant la fiabilité des nouveaux logiciels hospitaliers.",
        "Amèrement ironique face au contraste entre des bilans flatteurs et l'épuisement réel des équipes.",
        "Hésitant et neutre faute de témoignages précis dans les métiers cités."
      ],
      answer: 1,
      evidence: "Quelle belle victoire du progrès managérial : jamais l'écran de contrôle n'a affiché autant de voyants verts pendant que les professionnels s'épuisent à prouver qu'ils travaillent !",
      trapTypes: ["字面反语误读（把反讽当赞美）", "✓ 识别反讽语气（ironie）", "违背鲜明论战文体"],
      why: "作者用感叹句反讽“多么辉煌的管理进步”：屏幕绿灯一片大好，一线人员却在填表自证中耗竭，语气尖锐反讽。",
      difficulty: 4,
      skill: "opinion",
    },
    {
      q: "Pourquoi les questionnaires envoyés juste après un service ratent-ils l'essentiel selon le quatrième paragraphe ?",
      options: [
        "Ils ne captent que l'immédiat alors que les effets les plus précieux d'un métier se révèlent à long terme.",
        "Ils contiennent trop de termes juridiques incompréhensibles pour les citoyens ordinaires.",
        "Ils ne sont jamais lus par les directions des ressources humaines."
      ],
      answer: 0,
      evidence: "cette obsession comptable ne saisit du travail que sa surface immédiatement visible.",
      trapTypes: ["✓ 限定结构 ne… que + 长周期对比改写", "无中生有", "正反颠倒（管理层正过度依赖评分）"],
      why: "第四段用 « ne saisit… que sa surface immédiatement visible » 指出即时问卷只能测皮毛，测不出十年信任或五年后才显现的教育启发。",
      difficulty: 4,
      skill: "negation",
    },
    {
      q: "Quel risque cette culture de la note fait-elle courir aux travailleurs qualifiés ?",
      options: [
        "Elle affaiblit leur autonomie morale en les réduisant à de simples suiveurs de consignes chiffrées.",
        "Elle les oblige à changer d'entreprise tous les six mois.",
        "Elle supprime toute possibilité de télétravail dans le secteur tertiaire."
      ],
      answer: 0,
      evidence: "En ne valorisant que ce qui se mesure vite, les organisations atrophient le sens des responsabilités et transforment des praticiens qualifiés en exécutants dociles obsédés par leur note moyenne.",
      trapTypes: ["✓ 同义改写（atrophient le sens des responsabilités -> exécutants dociles）", "无中生有", "无中生有"],
      why: "第四段末尾指出唯快唯量化的考核会消磨责任感，把专业人士变成只顾平均分的顺从执行者。",
      difficulty: 3,
      skill: "paraphrase",
    },
    {
      q: "Que préconise l'auteur en conclusion ?",
      options: [
        "Supprimer toute forme de responsabilité professionnelle envers les usagers.",
        "Redonner toute sa place au jugement des pairs et à l'évaluation inscrite dans le temps long.",
        "Remplacer les étoiles par un vote annuel organisé sur les réseaux sociaux."
      ],
      answer: 1,
      evidence: "Redonner de l'air aux métiers ne signifie pas refuser de rendre des comptes au public, mais réhabiliter la délibération collective entre pairs, le temps long et le jugement professionnel.",
      trapTypes: ["否定陷阱（作者明确说 ne signifie pas refuser de rendre des comptes）", "✓ 结尾主张同义改写", "违背末句批判"],
      why: "末段明确指出松绑并非拒绝向公众负责，而是恢复同行集体评议、长期视角与专业判断力。",
      difficulty: 5,
      skill: "inference",
    },
  ],
};

const R5_OPINIONS: Raw = {
  form: "opinions",
  topic: "transports-mobilite",
  intro: "Vous lisez les contributions de trois lecteurs sur un forum consacré aux transports et au climat.",
  title: "Faut-il interdire les vols intérieurs lorsqu'un trajet en train de moins de quatre heures existe ?",
  docs: [
    {
      text: `Mathilde
Franchement, tant que l'avion émet dix à trente fois plus de gaz à effet de serre par passager que le train électrique sur une liaison intérieure, se contenter d'une limite timide à deux heures trente ne suffit plus face à l'urgence climatique. Étendre la règle à quatre heures permettrait enfin d'inclure des axes très fréquentés comme Paris-Marseille ou Paris-Toulouse améliorés, et d'envoyer un signal limpide aux compagnies aériennes comme aux entreprises qui paient les déplacements de leurs cadres. Bien entendu, cette interdiction doit s'accompagner d'un plafonnement des tarifs ferroviaires réservés à la dernière minute : on ne peut pas demander aux familles de renoncer à un billet aérien bon marché si le train affiche complet ou coûte le triple la veille du départ ! Mais à condition d'ajouter des rames aux heures de pointe, cette transition reste tout à fait réaliste dès les prochaines années.

Sébastien
Habitant dans le massif Central loin des grandes lignes à grande vitesse, je me méfie toujours des grandes annonces décidées depuis la capitale sans regarder une carte ferroviaire complète. Sur le papier, relier deux métropoles en trois heures cinquante paraît simple ; dans la vraie vie, beaucoup de voyageurs prennent un vol intérieur uniquement pour attraper une correspondance internationale tôt le matin, ou parce que la liaison transversale entre Bordeaux et Lyon reste interminable en train. Tant que les rames régionales souffriront de pannes à répétition, de grèves imprévisibles et d'un manque criant de trains directs entre villes de province, interdire l'avion reviendra surtout à enclaver un peu plus les territoires périphériques sans réduire massivement les émissions mondiales. Avant de légiférer par des interdictions uniformes, l'État devrait d'abord réparer patiemment les petites lignes du quotidien que les habitants attendent depuis vingt ans.

Nour
Plutôt que d'opposer frontalement l'interdiction légale et le statu quo, pourquoi ne pas agir d'abord sur la fiscalité équitable des carburants ? Ce qui fausse complètement le choix du voyageur aujourd'hui, c'est que le kérosène des avions demeure exonéré de taxes énergétiques alors que le rail paie des péages d'infrastructure de plus en plus lourds ! Si chaque mode de transport payait son coût écologique réel et que les recettes servaient à moderniser les voies secondaires comme les trains de nuit, le public basculerait de lui-même vers le rail sur les moyennes distances sans se sentir infantilisé par une loi punitive. Rééquilibrer les règles économiques me semble bien plus durable qu'une liste d'interdictions pleine de dérogations. Une écologie incitative, transparente sur l'usage des recettes publiques, susciterait d'ailleurs beaucoup moins de crispations sociales dans tout le pays.`,
      zh: `Mathilde
坦白说，在国内航线上，既然每名乘客乘飞机的温室气体排放量是电力火车的十到三十倍，面对气候紧迫局势，仅仅停留在两小时半的温和门槛已远远不够。将禁飞线扩大到四小时，终于能把巴黎至马赛等繁忙干线纳入其中，向航空公司以及为高管报销差旅的企业释放明确信号。当然，这项禁令必须配套临近出发时的火车票限价：如果出发前一天火车满员或者票价贵出三倍，我们总不能苛求普通家庭放弃便宜机票！不过只要在高峰时段加开列车编组，这一转型在未来几年完全切实可行。

Sébastien
我住在远离高铁干线的中央高原，一贯对首都拍板却不看完整全国铁路网的宏大政令保持警惕。纸面上看，三小时五十分钟连通两座大城市似乎很轻松；可在现实中，许多旅客搭国内航班只是为了赶清晨的国际中转联程，又或者像波尔多到里昂这样的横向跨区铁路至今耗时漫长。只要区域列车仍频繁故障、罢工难测且省际直达车次严重匮乏，一刀切禁飞只会进一步困住外围地区，却对全球减排杯水车薪。在靠一刀切禁令立法之前，国家更应先耐心修好居民期盼了二十年的日常支线铁路。

Nour
与其把“立法禁飞”和“维持现状”生硬对立，何不先从公平的燃料税制入手？如今真正扭曲旅客选择的，是航空煤油至今免征能源税，而铁路却要背负越来越沉重的轨道通行费！如果每种交通方式都为其真实生态成本买单，并把这笔税收投入改造支线铁路与夜行火车，中程旅客自然会主动转向铁路，而不必觉得被惩罚性法律当小孩管教。理顺经济规则在我看来远比列出一张充满豁免漏洞的禁令清单更持久。况且，公开税收去向的激励型生态政策在全社会引发的对立情绪也会少得多。`,
    },
  ],
  questions: [
    { q: "Cette personne juge indispensable d'encadrer le prix des billets de train si l'on supprime davantage de lignes aériennes.", options: ["Mathilde", "Sébastien", "Nour"], answer: 0, evidence: "cette interdiction doit s'accompagner d'un plafonnement des tarifs ferroviaires réservés à la dernière minute", trapTypes: ["✓ 对应 Mathilde", "张冠李戴", "张冠李戴"], why: "Mathilde 强调禁飞必须配套临行前火车票限价，否则不能苛求家庭放弃低价机票。", difficulty: 2, skill: "detail" },
    { q: "Cette personne craint que la mesure ne pénalise surtout les régions mal reliées aux grands axes rapides.", options: ["Mathilde", "Sébastien", "Nour"], answer: 1, evidence: "interdire l'avion reviendra surtout à enclaver un peu plus les territoires périphériques", trapTypes: ["张冠李戴", "✓ 对应 Sébastien", "张冠李戴"], why: "Sébastien 身处远离高铁干线的地区，担心在省际直达车不足时禁飞会进一步孤立外围地区。", difficulty: 2, skill: "opinion" },
    { q: "Cette personne dénonce un avantage fiscal injustifié dont bénéficie actuellement le secteur aérien.", options: ["Mathilde", "Sébastien", "Nour"], answer: 2, evidence: "le kérosène des avions demeure exonéré de taxes énergétiques alors que le rail paie des péages d'infrastructure de plus en plus lourds", trapTypes: ["张冠李戴", "张冠李戴", "✓ 对应 Nour"], why: "Nour 指出航空煤油免征能源税而铁路却承受高昂路网通行费，扭曲了价格竞争。", difficulty: 3, skill: "paraphrase" },
    { q: "Selon cette personne, le seuil actuel de deux heures trente est devenu trop modeste face au défi écologique.", options: ["Mathilde", "Sébastien", "Nour"], answer: 0, evidence: "se contenter d'une limite timide à deux heures trente ne suffit plus face à l'urgence climatique.", trapTypes: ["✓ 对应 Mathilde", "张冠李戴", "张冠李戴"], why: "Mathilde 认为2小时30分的门槛面对气候紧迫挑战已过于保守，主张扩至4小时。", difficulty: 2, skill: "paraphrase" },
    { q: "Cette personne rappelle les contraintes des correspondances internationales et des trajets entre villes de province.", options: ["Mathilde", "Sébastien", "Nour"], answer: 1, evidence: "beaucoup de voyageurs prennent un vol intérieur uniquement pour attraper une correspondance internationale tôt le matin, ou parce que la liaison transversale entre Bordeaux et Lyon reste interminable", trapTypes: ["张冠李戴", "✓ 对应 Sébastien", "张冠李戴"], why: "Sébastien 指出不少旅客是为了赶清晨国际联程，或因波尔多—里昂等横向铁路过于漫长。", difficulty: 3, skill: "detail" },
    { q: "Cette personne préfère orienter les comportements par le prix réel plutôt que par des interdictions administratives.", options: ["Mathilde", "Sébastien", "Nour"], answer: 2, evidence: "Si chaque mode de transport payait son coût écologique réel et que les recettes servaient à moderniser les voies secondaires comme les trains de nuit, le public basculerait de lui-même vers le rail", trapTypes: ["张冠李戴", "张冠李戴", "✓ 对应 Nour"], why: "Nour 主张让各交通方式承担真实生态成本反哺铁路升级，促使公众自发改乘火车而非靠惩罚禁令。", difficulty: 4, skill: "inference" },
  ],
};

const toEx = (raw: Raw) => sanitizeExercise(raw, raw.form, raw.topic);

export const PRESET_PAPERS: BankPaper[] = [
  {
    id: "preset-listen-1",
    kind: "listen",
    level: "B2",
    created: 0,
    src: "preset",
    style: "natural",
    exs: [toEx(L1_LONG_1), toEx(L1_LONG_2), toEx(L1_SHORT)],
  },
  {
    id: "preset-listen-2",
    kind: "listen",
    level: "B2",
    created: 0,
    src: "preset",
    style: "radio",
    exs: [toEx(L2_LONG_1), toEx(L2_LONG_2), toEx(L2_SHORT)],
  },
  {
    id: "preset-listen-3",
    kind: "listen",
    level: "B2",
    created: 0,
    src: "preset",
    style: "natural",
    exs: [toEx(L3_LONG_1), toEx(L3_LONG_2), toEx(L3_SHORT)],
  },
  {
    id: "preset-listen-4",
    kind: "listen",
    level: "B2",
    created: 0,
    src: "preset",
    style: "radio",
    exs: [toEx(L4_LONG_1), toEx(L4_LONG_2), toEx(L4_SHORT)],
  },
  {
    id: "preset-listen-5",
    kind: "listen",
    level: "B2",
    created: 0,
    src: "preset",
    style: "natural",
    exs: [toEx(L5_LONG_1), toEx(L5_LONG_2), toEx(L5_SHORT)],
  },
  {
    id: "preset-read-1",
    kind: "read",
    level: "B2",
    created: 0,
    src: "preset",
    exs: [toEx(R1_LONG_1), toEx(R1_LONG_2), toEx(R1_OPINIONS)],
  },
  {
    id: "preset-read-2",
    kind: "read",
    level: "B2",
    created: 0,
    src: "preset",
    exs: [toEx(R2_LONG_1), toEx(R2_LONG_2), toEx(R2_OPINIONS)],
  },
  {
    id: "preset-read-3",
    kind: "read",
    level: "B2",
    created: 0,
    src: "preset",
    exs: [toEx(R3_LONG_1), toEx(R3_LONG_2), toEx(R3_OPINIONS)],
  },
  {
    id: "preset-read-4",
    kind: "read",
    level: "B2",
    created: 0,
    src: "preset",
    exs: [toEx(R4_LONG_1), toEx(R4_LONG_2), toEx(R4_OPINIONS)],
  },
  {
    id: "preset-read-5",
    kind: "read",
    level: "B2",
    created: 0,
    src: "preset",
    exs: [toEx(R5_LONG_1), toEx(R5_LONG_2), toEx(R5_OPINIONS)],
  },
];
