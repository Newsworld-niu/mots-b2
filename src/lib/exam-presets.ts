/**
 * 预置题: full 25-point papers that come with the app, so that 听力理解 and 应试阅读 can be practised
 * completely offline without an AI key (2 full listening papers + 2 full reading papers, 25 points each).
 * Written in the form of the official DELF B2 papers (new format); every person, figure and text is invented.
 * Cross-reviewed for French quality, yet still marked as unverified by an official examiner (待核对).
 */
import { sanitizeExercise, type CompForm } from "./exam";
import type { BankPaper } from "../store/exam-bank";

type RawQ = { q: string; qType?: "qcm" | "vf" | "short"; options: string[]; answer: number; quote?: string; accepted?: string[]; why: string; difficulty: number; skill: string; doc?: number };
type RawDoc = { text: string; zh: string };
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
    },
    {
      text: `Thomas Leroy : Je suis arboriculteur près de Valence, dans la vallée du Rhône, où je cultive surtout des pêchers et des abricotiers sur une vingtaine d'hectares. Depuis trois ans, j'ai abandonné l'arrosage classique par aspersion, qui perdait beaucoup d'eau par évaporation sous le vent, pour passer au goutte-à-goutte enterré, piloté par de petits capteurs qui mesurent chaque heure l'humidité exacte du sol et la température au niveau des racines. Bien sûr, l'installation complète m'a coûté très cher au départ, près de quarante mille euros, et sans une subvention importante de l'agence de l'eau ainsi qu'un soutien de la région, je n'aurais jamais eu les moyens de la payer seul. Mais aujourd'hui, le bilan est clair : j'utilise à peu près un tiers d'eau en moins tout en gardant des fruits de même qualité et de même calibre. Le vrai souci, c'est que mes voisins, qui dirigent de plus petites exploitations familiales, hésitent encore à investir malgré une aide publique. Selon moi, il faudrait que les coopératives agricoles achètent et entretiennent ce matériel ensemble pour partager les frais et le savoir-faire technique.`,
      zh: `Thomas Leroy：我在罗讷河谷的瓦朗斯附近种果树，大约二十公顷地里主要种桃树和杏树。三年前，我放弃了在风吹日晒下水分蒸发极多的传统喷灌，改用地下滴灌系统，由小型传感器每小时精确监测土壤湿度以及根系层的温度。当然，整套设备起初花了我将近四万欧元，要是没有流域水务局的大额补贴和大区的支持，我一个人根本负担不起。但如今账目非常清楚：我节省了大约三分之一的用水，同时保持了同等的果实品质和果径。真正的难题在于，我那些经营较小家庭农场的邻居即使有公共补助也仍不敢投资。在我看来，农业合作社应该联合购买并维护这些设备，共同分摊费用和技术经验。`,
    },
    {
      text: `Présentateur : Faut-il augmenter fortement le prix du mètre cube d'eau pour obliger les citoyens à moins gaspiller pendant l'été ? L'économiste de l'environnement Claire Duval nous livre son analyse.
Claire Duval : À mon sens, une hausse générale et uniforme du tarif serait profondément injuste sur le plan social, parce que les familles aux revenus modestes paieraient exactement autant que les ménages les plus aisés pour un besoin vital auquel personne ne peut renoncer. En revanche, une tarification progressive me paraît beaucoup plus pertinente et efficace : les premiers mètres cubes, ceux qui servent tout simplement à boire, à cuisiner, à faire la lessive et à se laver au quotidien, resteraient à un prix très bas, voire symbolique, comme c'est déjà le cas dans certaines communes solidaires. Pour freiner les abus, on ferait payer beaucoup plus cher les tranches suivantes, par exemple pour laver plusieurs voitures, arroser une grande pelouse verte en plein mois d'août ou remplir une piscine privée. Plusieurs métropoles françaises l'ont déjà expérimentée sur plusieurs années, avec des résultats vraiment encourageants sur les pics de consommation estivaux sans pénaliser les foyers vulnérables.`,
      zh: `主持人：是否应该大幅提高每立方米水价，迫使居民在夏季减少浪费？环境经济学家 Claire Duval 为我们作出分析。
Claire Duval：在我看来，全面统一的涨价在社会层面极其不公平，因为对于饮用和基本生活这种谁都无法放弃的刚需，低收入家庭要和最富裕的家庭付完全一样的钱。相反，阶梯水价显得合理且有效得多：最初几立方米——仅仅用于日常饮水、做饭、洗衣和洗漱的部分——应维持极低甚至象征性的价格，正如部分互助型市镇已经实行的那样；为了遏制滥用，超出的用量就收高得多的费用，比如用来洗好几辆车、在八月盛夏浇灌大片草坪或给私人泳池注水。已有多个法国大都市连续试行了几年，在不惩罚脆弱家庭的前提下，在抑制夏季用水高峰方面取得了十分鼓舞人心的成果。`,
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
    },
    {
      text: `Claire Lefort : En tant que juriste spécialisée dans le droit de la consommation, je suis de très près le déploiement du « bonus réparation », une aide financière directe déduite aussitôt de la facture lorsque l'on fait réparer un appareil hors garantie chez un artisan ou un atelier labellisé. Sur le papier, l'intention est excellente, puisque la somme accordée peut atteindre cinquante euros pour un lave-linge, un téléviseur ou un ordinateur portable, sans paperasse compliquée pour l'acheteur. Toutefois, le dispositif reste encore freiné par deux obstacles majeurs sur le terrain. D'abord, la majorité des consommateurs ignorent encore son existence ou ne savent pas trouver rapidement un réparateur agréé près de chez eux, surtout dans les zones rurales ou les petites villes isolées. Ensuite, certaines pièces détachées essentielles restent vendues si cher par les fabricants que même avec le bonus déduit, l'achat d'un modèle neuf bas de gamme paraît plus avantageux aux yeux des ménages pressés. Tant que la durée de disponibilité et le prix des pièces ne seront pas mieux encadrés par la loi européenne et française, le réflexe du tout-jetable restera tenace.`,
      zh: `Claire Lefort：作为消费法专业律师，我密切关注“维修补贴”的落实——这是指消费者在经认证的维修店或工坊修理过保电器时，直接从账单中扣除的资金补助。纸面上这项举措初衷极好，修理洗衣机、电视或笔记本电脑最高可减免五十欧元，而且买家无需办理繁琐手续。然而该机制在实践中仍受两大主要障碍掣肘。首先，大多数消费者至今仍不知道有这项补贴，或者尤其在农村和小城镇不知道去哪里快速找到获认证的维修点。其次，部分核心零配件被厂家定得极其昂贵，以至于即使扣除补贴，在忙碌的家庭眼里买一台新的低端机反而更划算。只要欧洲和法国法律不进一步规范零配件的供应年限和价格，用完即扔的习惯就仍会顽固存在。`,
    },
    {
      text: `Julien Garnier : Je dirige un magasin d'électroménager indépendant de taille moyenne dans la banlieue de Toulouse depuis douze ans. Pendant longtemps, nous vendions presque exclusivement du matériel neuf garanti deux ans, et les appareils repris chez les clients partaient aussitôt à la déchetterie pour recyclage. Il y a deux ans, face aux attentes d'une clientèle plus jeune, mieux informée et très attentive à son budget mensuel, nous avons ouvert au fond du magasin un atelier de reconditionnement visible du public et un rayon dédié aux pièces de seconde main vérifiées en atelier. Au début, plusieurs collègues du secteur craignaient que ces ventes n'absorbent une partie importante de nos bénéfices sur le neuf. En réalité, c'est tout le contraire qui s'est produit : l'atelier attire de nouveaux clients du quartier qui viennent d'abord pour sauver un aspirateur ou un micro-ondes, puis choisissent notre enseigne en toute confiance lorsqu'ils doivent finalement renouveler un réfrigérateur ou un four encastrable. Le seul point délicat reste le recrutement de techniciens polyvalents et qualifiés, car ces métiers manuels ont été longtemps dévalorisés et les jeunes diplômés manquent à l'appel.`,
      zh: `Julien Garnier：我在图卢兹郊区经营一家中型独立家电商店已经十二年了。很长一段时间里我们几乎只卖带两年保修的新机，从顾客家里收来的旧电器直接送去回收站拆解。两年前，面对更年轻、更懂行且注重每月预算的客群需求，我们在店面深处开设了面向公众开放的翻新工坊，并设立了经工坊检测的二手配件专区。起初不少业内同行担心这会抢走新机的大部分利润。实际上结果恰恰相反：工坊吸引了周边新顾客，他们最初是来修吸尘器或微波炉，等以后真需要换新冰箱或烤箱时也会放心地选择我们店。唯一棘手的难题依然是招聘合格的多面手技师，因为这类手工技术岗位长期遭到轻视，年轻毕业生严重短缺。`,
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
    { q: "L'article présente avant tout…", options: ["une réforme nationale supprimant les manuels scolaires.", "le premier bilan d'une expérimentation numérique locale.", "une application créée par des collégiens de l'Est."], answer: 1, why: "全文报道大东部大区四十所初中引入英语学习应用的实验及其初步中期评估。", difficulty: 2, skill: "gist" },
    { q: "Quel est le but poursuivi par le rectorat avec cet outil ?", options: ["Allonger les séances d'anglais en fin d'après-midi.", "Multiplier les occasions de pratiquer au quotidien.", "Réduire le nombre d'enseignants dans les classes."], answer: 1, why: "目标是在不加重课表的前提下增加每天接触语言的时间。", difficulty: 3, skill: "paraphrase" },
    { q: "D'après l'évaluation menée sur deux mille élèves, les progrès les plus nets portent sur…", options: ["la rédaction de longs récits.", "l'écoute et le lexique de base.", "la prononciation des mots complexes."], answer: 1, why: "第二段指出经常使用的学生在听力理解和常用词汇记忆上进步最显著。", difficulty: 1, skill: "detail" },
    { q: "Selon Sophie Bernard, le fait qu'un tiers des élèves n'utilise pas l'application chez eux…", options: ["prouve que l'interface est trop complexe.", "confirme les écarts initiaux de motivation.", "va disparaître grâce aux tablettes gratuites."], answer: 1, why: "她认为毫不意外，自律的人才会主动用，工具只是放大既有习惯。", difficulty: 3, skill: "opinion" },
    { q: "Que reproche Sophie Bernard au format des exercices ?", options: ["Ils favorisent les réflexes rapides plutôt que la réflexion.", "Ils demandent un niveau trop avancé pour des cinquièmes.", "Ils négligent l'entraînement à la compréhension écrite."], answer: 0, why: "她说练习只训练学生快速抢积分，不能学会细腻组织连贯思想。", difficulty: 4, skill: "paraphrase" },
    { q: "Comment certains professeurs se servent-ils du tableau de bord ?", options: ["Pour noter automatiquement les devoirs maison.", "Pour adapter l'aide selon les difficultés observées.", "Pour envoyer des messages d'alerte aux parents."], answer: 1, why: "教师通过仪表盘识别全班高频错误，并据此进行分组分层辅导。", difficulty: 3, skill: "detail" },
    { q: "On peut conclure de la fin de l'article que…", options: ["l'extension durable du projet demeure incertaine.", "le conseil régional a déjà renouvelé la licence pour dix ans.", "les élèves parlent déjà mieux qu'avant à l'oral."], answer: 0, why: "两年试点后谁出钱未定，且书面和连贯口语尚未测评，项目前景仍未明朗。", difficulty: 5, skill: "inference" },
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
    { q: "La cohabitation intergénérationnelle cherche d'abord à répondre…", options: ["à deux difficultés distinctes concernant les jeunes et les aînés.", "au manque d'infirmières dans les hôpitaux universitaires.", "à la hausse des impôts sur les grands appartements."], answer: 0, why: "同时应对大学生租房贵和独居老人孤独这两个问题。", difficulty: 1, skill: "gist" },
    { q: "Pourquoi la demande a-t-elle fortement augmenté à Bordeaux selon Nadia Lemaire ?", options: ["Les universités ont fermé leurs propres résidences.", "Les prix des logements privés ont beaucoup monté.", "Les étudiants refusent désormais la colocation classique."], answer: 1, why: "她指出需求翻倍主要是受私人市场房租飙升（flambée des loyers）推动。", difficulty: 2, skill: "detail" },
    { q: "Quelle limite légale protège l'étudiant accueilli ?", options: ["Il doit signer un contrat de bail commercial classique.", "Il ne doit pas assurer de tâches liées aux soins médicaux.", "Il peut quitter le logement sans préavis chaque mois."], answer: 1, why: "法律规定学生绝不能做医疗或洗漱护理工作。", difficulty: 3, skill: "paraphrase" },
    { q: "Dans la majorité des cas, les ruptures avant juin s'expliquent par…", options: ["des désaccords sur le partage des dépenses.", "des habitudes de vie difficiles à concilier.", "l'absence d'encadrement juridique des contrats."], answer: 1, why: "主要是作息不同、音量、厨房卫生、访客等日常习惯摩擦。", difficulty: 3, skill: "paraphrase" },
    { q: "Pour éviter les échecs, les associations ont décidé de…", options: ["mieux évaluer la compatibilité des candidats avant l'accord.", "interdire aux étudiants de recevoir leurs amis.", "réserver ce logement aux étudiants en médecine."], answer: 0, why: "调解员会在签约前分别多次面谈，核实双方期望是否吻合。", difficulty: 3, skill: "detail" },
    { q: "Quelle critique Henri Vignon adresse-t-il si l'on compte trop sur ce modèle ?", options: ["Il coûte plus cher que la construction de logements neufs.", "Il ne peut pas remplacer la politique publique de logement.", "Il aggrave l'isolement des personnes âgées à la campagne."], answer: 1, why: "他强调不能免除政府建宿舍和资助专业养老照护的公共责任。", difficulty: 4, skill: "opinion" },
    { q: "Quelle idée résume le mieux la conclusion de l'article ?", options: ["La cohabitation est utile mais reste d'ampleur limitée.", "Les binômes devraient recevoir une prime mensuelle de l'État.", "Seules les grandes villes permettent ce type de projet."], answer: 0, why: "结尾说明它创造了代际纽带，但单靠私人善意无法独立解决住房与老龄化结构危机。", difficulty: 5, skill: "inference" },
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
    { q: "Cette personne estime qu'une interdiction trop stricte risque d'augmenter l'envie d'utiliser les écrans.", options: ["Camille", "Rachid", "Élodie"], answer: 0, why: "Camille：过于严格的禁令会让屏幕变得更有吸引力。", difficulty: 3, skill: "paraphrase" },
    { q: "Pour cette personne, ce que l'on fait devant un écran compte davantage que la durée totale.", options: ["Camille", "Rachid", "Élodie"], answer: 1, why: "Rachid：刷三小时视频和剪辑短片不能一概而论。", difficulty: 3, skill: "paraphrase" },
    { q: "Cette personne considère que les adultes doivent d'abord changer leur propre comportement.", options: ["Camille", "Rachid", "Élodie"], answer: 2, why: "Élodie：家长应先审视自己，不能要求孩子做大人自己做不到的事。", difficulty: 2, skill: "opinion" },
    { q: "Cette personne interdit les appareils à certains moments et dans certaines pièces.", options: ["Camille", "Rachid", "Élodie"], answer: 1, why: "Rachid：吃饭时和晚上九点后卧室内禁止使用手机或平板。", difficulty: 2, skill: "detail" },
    { q: "Selon cette personne, des loisirs attractifs suffisent souvent à éloigner spontanément les jeunes du téléphone.", options: ["Camille", "Rachid", "Élodie"], answer: 0, why: "Camille：徒步或去湖边玩，孩子无需家长没收自己就会把手机忘在包里。", difficulty: 4, skill: "inference" },
    { q: "Cette personne a adopté avec ses proches une journée régulière de déconnexion complète.", options: ["Camille", "Rachid", "Élodie"], answer: 2, why: "Élodie：全家每周一天把手机关机留在家里。", difficulty: 3, skill: "paraphrase" },
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
    { q: "L'exemple de l'entreprise Aurore Mécanique montre que la semaine de quatre jours réussit surtout quand…", options: ["les salariés acceptent une baisse de salaire.", "l'organisation des tâches est profondément allégée.", "le chiffre d'affaires baisse la première année."], answer: 1, why: "该企业成功不仅因减少工时，更因砍掉一半无用会议并减少消息打扰。", difficulty: 2, skill: "paraphrase" },
    { q: "Quel effet concret Claire Martin observe-t-elle depuis le changement ?", options: ["Une diminution importante des absences pour maladie.", "Une hausse des embauches dans le service commercial.", "Une prolongation des réunions du lundi matin."], answer: 0, why: "原文明确提到病假（arrêts maladie）一年内下降了 25%。", difficulty: 1, skill: "detail" },
    { q: "Quel danger Marc Delacroix souligne-t-il lorsque les horaires journaliers sont allongés ?", options: ["Les salariés perdent leur droit aux congés payés.", "Le rythme devient épuisant faute de baisse de charge.", "Les entreprises doivent fermer le week-end."], answer: 1, why: "只压缩天数不减任务量，会导致高强度劳累和下午频出错。", difficulty: 3, skill: "paraphrase" },
    { q: "Pourquoi certaines mairies ont-elles rencontré des difficultés lors du test ?", options: ["Tous les services n'ont pas pu obtenir les mêmes horaires.", "Les habitants se sont plaints de la fermeture des écoles.", "La loi interdit ce rythme dans le secteur public."], answer: 0, why: "行政岗享受到四天制，但技术或食堂人员无法同样排班，引发内部摩擦。", difficulty: 3, skill: "detail" },
    { q: "Dans les secteurs comme la santé ou l'enseignement, l'obstacle principal est…", options: ["le refus des syndicats de travailler le vendredi.", "la nécessité et le coût de recruter davantage.", "le manque de bureaux pour accueillir le public."], answer: 1, why: "必须增聘合格人手，但小机构财力难及且面临招工难。", difficulty: 3, skill: "paraphrase" },
    { q: "Quelle est la position des économistes cités en fin d'article ?", options: ["Il faut voter une réforme obligatoire pour tout le pays.", "Le modèle ne convient pas sous une forme unique à tous.", "Le télétravail doit être supprimé au profit de quatre jours."], answer: 1, why: "他们认为不能靠统一法律硬性推行，其他行业用弹性工时等可能更合适。", difficulty: 4, skill: "opinion" },
    { q: "On comprend de cet article que le succès de la réforme dépend moins du nombre de jours que…", options: ["de l'accord entre la charge réelle et le métier.", "de l'âge moyen des dirigeants de PME.", "de la taille des locaux de l'entreprise."], answer: 0, why: "综合全文，关键在于负荷是否真正适配、流程是否重构以及行业属性是否允许。", difficulty: 5, skill: "inference" },
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
    { q: "L'article examine principalement si la gratuité des transports…", options: ["améliore réellement l'écologie urbaine sans affaiblir le réseau.", "permet aux conducteurs de travailler moins d'heures.", "remplace l'achat de vélos électriques par les mairies."], answer: 0, why: "导语点明争论核心：是否真能减少汽车并同时维持公交网升级所需财力。", difficulty: 2, skill: "gist" },
    { q: "Outre le gain financier pour les ménages, quel avantage pratique est observé dans les bus ?", options: ["Les bus roulent à plus grande vitesse sur les boulevards.", "La montée des passagers est plus fluide et apaisée.", "Le nombre de lignes de nuit double immédiatement."], answer: 1, why: "不检票售票加快了站点登车速度，也减少了司乘摩擦。", difficulty: 2, skill: "detail" },
    { q: "Que révèlent les enquêtes menées à Dunkerque et à Tallinn ?", options: ["Les automobilistes ont massivement abandonné leur voiture.", "La hausse de fréquentation vient surtout d'anciens marcheurs ou cyclistes.", "Les recettes touristiques ont compensé le coût du réseau."], answer: 1, why: "多数新乘客原本走路或骑车，并不是弃用私家车的车主。", difficulty: 3, skill: "detail" },
    { q: "Selon Claire Rochefort, pourquoi beaucoup d'automobilistes gardent-ils leur voiture ?", options: ["Ils trouvent le prix du ticket mensuel trop élevé.", "L'offre de transport ne correspond pas encore à leurs trajets.", "Ils craignent les retards liés à la vente des billets."], answer: 1, why: "阻碍在于晚间班次少、换乘慢或没有直达线路，而非票价。", difficulty: 3, skill: "paraphrase" },
    { q: "Quel risque financier les opposants redoutent-ils si l'on supprime les billets ?", options: ["Une baisse des salaires des conducteurs de tramway.", "Moins de moyens pour moderniser et étendre les lignes.", "La fermeture des parkings situés en centre-ville."], answer: 1, why: "失去 20%–35% 预算收入可能无力购置更快车辆、电动化或向远郊延线。", difficulty: 3, skill: "paraphrase" },
    { q: "Que recommandent les spécialistes en fin d'article ?", options: ["Rendre le stationnement gratuit à la place des bus.", "Réserver la gratuité aux publics fragiles et investir dans le service.", "Supprimer les bus dans les quartiers où les gens marchent."], answer: 1, why: "主张对弱势群体定向免费，同时把资金重点投入提高班次和准点率。", difficulty: 4, skill: "opinion" },
    { q: "On peut déduire du texte que le prix du billet n'est pas…", options: ["un facteur suffisant à lui seul pour changer les habitudes des conducteurs.", "une ressource utile pour les budgets municipaux.", "un obstacle pour les déplacements des personnes âgées."], answer: 0, why: "全篇论证说明单靠免费票价本身不足以让车主弃车改乘，服务质量和覆盖更关键。", difficulty: 5, skill: "inference" },
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
    { q: "Cette personne reconnaît que la facilité d'achat l'a poussée à commander plus qu'avant.", options: ["Lucie", "Antoine", "Nadia"], answer: 0, why: "Lucie：价格便宜且易转卖使她每月买三四个包裹，比以前更多。", difficulty: 2, skill: "detail" },
    { q: "Pour cette personne, l'occasion aide surtout les foyers à faire face au coût de la vie.", options: ["Lucie", "Antoine", "Nadia"], answer: 1, why: "Antoine：在通胀下帮助有两个青少年的家庭体面穿衣而不挤占食物预算。", difficulty: 2, skill: "paraphrase" },
    { q: "Cette personne critique les grandes marques qui utilisent l'occasion comme vitrine publicitaire.", options: ["Lucie", "Antoine", "Nadia"], answer: 2, why: "Nadia：批评快时尚连锁拿二手专区当广告噱头、并用代金券诱导继续买新衣。", difficulty: 3, skill: "opinion" },
    { q: "Cette personne pense que la véritable écologie passe d'abord par le fait de garder ses habits plus longtemps.", options: ["Lucie", "Antoine", "Nadia"], answer: 0, why: "Lucie：只有先长久穿着手里的衣服，二手才算环保。", difficulty: 3, skill: "paraphrase" },
    { q: "Malgré certains excès, cette personne juge que le réemploi vaut mieux que le neuf bon marché.", options: ["Lucie", "Antoine", "Nadia"], answer: 1, why: "Antoine：即使有人在平台买得多，延长已制衣物的寿命仍明显好过买廉价新衣。", difficulty: 3, skill: "opinion" },
    { q: "Cette personne déplore que les reprises en boutique servent surtout à relancer la vente de neuf.", options: ["Lucie", "Antoine", "Nadia"], answer: 2, why: "Nadia：交旧衣换代金券会让人马上又买一件新衣。", difficulty: 4, skill: "inference" },
  ],
};


/* ==================== 阅读整套 3（25 分 · 官方并行格式：含 Vrai/Faux 原文引证 + 简答） ==================== */

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
      "q": "Quel est le principal domaine médical où l’IA est déjà largement utilisée selon l’article ?",
      "qType": "qcm",
      "options": [
        "La chirurgie cardiaque",
        "La détection par imagerie médicale",
        "La psychiatrie"
      ],
      "answer": 1,
      "why": "文章第一段提到“notamment dans le domaine de l’imagerie médicale”，说明主要应用在医学影像领域。",
      "difficulty": 2,
      "skill": "detail"
    },
    {
      "q": "Selon le professeur Dubois, l’IA permet de détecter plus tôt certains cancers.",
      "qType": "vf",
      "options": [
        "Vrai",
        "Faux"
      ],
      "answer": 0,
      "quote": "Grâce à l’IA, nous détectons plus précocement certains cancers, ce qui améliore considérablement les chances de guérison.",
      "why": "文章第二段直接引用了杜布瓦教授的话，说明AI能更早发现癌症。",
      "difficulty": 2,
      "skill": "detail"
    },
    {
      "q": "Quelle est la principale inquiétude de la docteure Martin concernant l’IA ?",
      "qType": "qcm",
      "options": [
        "Le coût élevé des logiciels d’IA",
        "Le manque de formation des médecins",
        "Une confiance aveugle dans la machine, source potentielle d'erreurs"
      ],
      "answer": 2,
      "why": "第三段马丁医生强调“Il existe toujours un risque d’erreur, surtout si l’on s’appuie uniquement sur la machine”。",
      "difficulty": 3,
      "skill": "gist"
    },
    {
      "q": "Quel pourcentage des diagnostics assistés par IA se sont révélés incorrects selon une enquête de 2022 ?",
      "qType": "short",
      "options": [],
      "answer": 0,
      "accepted": [
        "12%",
        "douze pour cent",
        "12 %"
      ],
      "why": "第三段提到“12% des diagnostics assistés par IA se sont révélés incorrects”。",
      "difficulty": 3,
      "skill": "detail"
    },
    {
      "q": "La CNIL n’a signalé aucune faille de sécurité concernant les données médicales en 2021.",
      "qType": "vf",
      "options": [
        "Vrai",
        "Faux"
      ],
      "answer": 1,
      "quote": "la Commission nationale de l’informatique et des libertés (CNIL) a déjà signalé plusieurs failles de sécurité en 2021",
      "why": "第四段明确说CNIL报告了多起安全漏洞，因此说“aucune faille”是错误的。",
      "difficulty": 3,
      "skill": "negation"
    },
    {
      "q": "Quel montant le ministère de la Santé a-t-il investi en 2023 pour l’IA médicale ?",
      "qType": "qcm",
      "options": [
        "15 millions d’euros",
        "45 millions d’euros",
        "75 millions d’euros"
      ],
      "answer": 1,
      "why": "第五段提到“Il a investi 45 millions d’euros en 2023”。",
      "difficulty": 2,
      "skill": "detail"
    },
    {
      "q": "Selon l’article, quelle est la position du ministère de la Santé sur l’IA ?",
      "qType": "qcm",
      "options": [
        "Il encourage son développement tout en promettant plus de sécurité",
        "Il interdit l’utilisation de l’IA dans les hôpitaux",
        "Il reste neutre sur le sujet"
      ],
      "answer": 0,
      "why": "第五段说卫生部鼓励AI发展，同时承诺加强数据安全。",
      "difficulty": 3,
      "skill": "gist"
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
      "q": "Quel est le plafond moyen du loyer au mètre carré à Paris en 2022 ?",
      "qType": "qcm",
      "options": [
        "28 euros",
        "38 euros",
        "48 euros"
      ],
      "answer": 1,
      "why": "第一段明确说巴黎2022年租金上限为38欧元/平方米。",
      "difficulty": 2,
      "skill": "detail"
    },
    {
      "q": "En 2023, 27% des baux signés dépassaient le plafond légal.",
      "qType": "vf",
      "options": [
        "Vrai",
        "Faux"
      ],
      "answer": 0,
      "quote": "27% des baux signés en 2023 dépassaient le plafond légal",
      "why": "第二段直接引用了这一数据，说明是真的。",
      "difficulty": 2,
      "skill": "detail"
    },
    {
      "q": "Quel est l’impact principal des locations touristiques selon Pierre Martin ?",
      "qType": "qcm",
      "options": [
        "Elles améliorent la qualité des logements",
        "Elles augmentent la sécurité dans les quartiers",
        "Les résidents peinent davantage à se loger à un prix raisonnable"
      ],
      "answer": 2,
      "why": "第三段皮埃尔·马丁说短租让居民失去负担得起的住房。",
      "difficulty": 3,
      "skill": "gist"
    },
    {
      "q": "Le nombre d’annonces touristiques à Bordeaux a diminué en 2023.",
      "qType": "vf",
      "options": [
        "Vrai",
        "Faux"
      ],
      "answer": 1,
      "quote": "le nombre d’annonces touristiques a augmenté de 12% en 2023",
      "why": "第四段明确说短租广告数量增长了12%，不是减少。",
      "difficulty": 3,
      "skill": "negation"
    },
    {
      "q": "De combien le revenu médian des ménages locataires à Paris a-t-il baissé en deux ans selon l’INSEE ?",
      "qType": "short",
      "options": [],
      "answer": 0,
      "accepted": [
        "2%",
        "de 2%",
        "de 2 %",
        "deux pour cent"
      ],
      "why": "第五段提到“le revenu médian des ménages locataires à Paris a baissé de 2% en deux ans”。",
      "difficulty": 3,
      "skill": "detail"
    },
    {
      "q": "Quelle solution est évoquée pour résoudre la crise du logement selon l’article ?",
      "qType": "qcm",
      "options": [
        "Associer une régulation rigoureuse à un effort de construction neuve",
        "Supprimer toutes les locations touristiques",
        "Augmenter les taxes sur les propriétaires"
      ],
      "answer": 0,
      "why": "最后一段说要结合严格管控和新建住房。",
      "difficulty": 3,
      "skill": "gist"
    },
    {
      "q": "Quelle ville a instauré une amende de 5 000 euros pour non-respect de la réglementation ?",
      "qType": "qcm",
      "options": [
        "Lyon",
        "Bordeaux",
        "Paris"
      ],
      "answer": 1,
      "why": "第四段说波尔多市政府设立了5000欧元罚款。",
      "difficulty": 2,
      "skill": "detail"
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
      "options": [
        "Claire",
        "Mehdi",
        "Sophie"
      ],
      "answer": 0,
      "why": "克莱尔明确表示强制投票能增强当选者的合法性。",
      "difficulty": 2,
      "skill": "opinion"
    },
    {
      "q": "Qui pense que le droit de vote inclut aussi le droit de s’abstenir ?",
      "qType": "qcm",
      "options": [
        "Claire",
        "Mehdi",
        "Sophie"
      ],
      "answer": 1,
      "why": "梅迪认为投票权也包括弃权权。",
      "difficulty": 2,
      "skill": "opinion"
    },
    {
      "q": "Qui cite la Belgique comme exemple de pays où le vote obligatoire existe ?",
      "qType": "qcm",
      "options": [
        "Claire",
        "Mehdi",
        "Sophie"
      ],
      "answer": 0,
      "why": "克莱尔提到比利时有强制投票制度。",
      "difficulty": 2,
      "skill": "detail"
    },
    {
      "q": "Qui souhaite développer l’éducation civique dès le plus jeune âge pour donner du sens au vote ?",
      "qType": "qcm",
      "options": [
        "Claire",
        "Mehdi",
        "Sophie"
      ],
      "answer": 2,
      "why": "索菲提出应从小加强公民教育，让参与选举更有意义。",
      "difficulty": 3,
      "skill": "paraphrase"
    },
    {
      "q": "Qui propose de développer le vote en ligne ou par correspondance ?",
      "qType": "qcm",
      "options": [
        "Claire",
        "Mehdi",
        "Sophie"
      ],
      "answer": 2,
      "why": "索菲建议发展网络投票或邮寄投票。",
      "difficulty": 2,
      "skill": "detail"
    },
    {
      "q": "Qui pense qu’il faut s’attaquer aux causes de la démobilisation plutôt que de sanctionner les abstentionnistes ?",
      "qType": "qcm",
      "options": [
        "Claire",
        "Mehdi",
        "Sophie"
      ],
      "answer": 1,
      "why": "梅迪主张解决不参与投票的根本原因，而不是惩罚弃权者。",
      "difficulty": 3,
      "skill": "paraphrase"
    }
  ]
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
];
