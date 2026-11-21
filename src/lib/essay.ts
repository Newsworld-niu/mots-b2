/**
 * 篇章写作: the writing tasks (by genre), the scaffolding shown while writing (plan, connectors, letter formulas),
 * the fixed marking grid, and what a marked text looks like. The tasks and phrases are written for this site (待核对).
 */
import { ERROR_TYPES, type ErrorType } from "./writing";

export type Genre = "mail" | "recit" | "lettre" | "motivation" | "courrier" | "essai" | "forum";

export const GENRE_LABEL: Record<Genre, string> = {
  mail: "给朋友的邮件",
  recit: "叙事",
  lettre: "正式信件",
  motivation: "求职信",
  courrier: "读者来信",
  essai: "议论文",
  forum: "论坛发帖",
};

export interface EssayTask {
  id: string;
  level: "B1" | "B2";
  genre: Genre;
  title: string;
  /** The situation, in Chinese. */
  situation: string;
  /** The instruction as an exam would put it, in French. */
  consigne: string;
  words: [number, number];
  /** A short French document the text reacts to, when the task has one. */
  doc?: string;
  /** Exam topic whose vocabulary helps here. */
  topic?: string;
  /** What the text must contain, in Chinese. */
  points: string[];
  /** A plan to follow: what each part does, with a French opening to borrow. */
  plan: { zh: string; fr: string }[];
  /** Phrases that fit this task, French | Chinese. */
  phrases: [string, string][];
}

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
    topic: "culture",
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
    genre: "essai",
    title: "材料题：学校晚一点上课",
    situation: "学生报的编辑部请你就下面这项研究写一篇评论文章。",
    doc: "D'après une étude récente, les lycéens dorment en moyenne moins de sept heures par nuit en semaine. Des chercheurs proposent de faire commencer les cours à 9 heures au lieu de 8 heures : selon eux, les élèves seraient plus attentifs et moins souvent absents.",
    consigne: "Vous rédigez un article pour le journal du lycée : vous présentez brièvement cette proposition et vous donnez votre avis de façon argumentée.",
    words: [250, 350],
    points: ["用自己的话概括研究和建议", "分析好处", "指出实行起来的困难", "明确的结论"],
    plan: [
      { zh: "概括材料", fr: "Selon une étude récente,… Des chercheurs suggèrent donc de…" },
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

/** Formulas of a formal letter. */
export const LETTER_FORMULAS: { zh: string; fr: string[] }[] = [
  { zh: "称呼", fr: ["Madame, Monsieur,", "Madame la Directrice,", "Monsieur le Maire,"] },
  { zh: "开头", fr: ["Je me permets de vous écrire afin de…", "Suite à votre annonce du…,", "Je vous écris au sujet de…"] },
  { zh: "请求", fr: ["Je vous serais reconnaissant(e) de bien vouloir…", "Pourriez-vous m'indiquer… ?", "Je vous prie de…"] },
  { zh: "结尾", fr: ["Dans l'attente de votre réponse,", "Je vous remercie par avance de…", "Je reste à votre disposition pour…"] },
  { zh: "落款套语", fr: ["Je vous prie d'agréer, Madame, Monsieur, mes salutations distinguées.", "Veuillez agréer, Madame, l'expression de mes sentiments respectueux.", "Cordialement,（较随意）"] },
];

export const FORMAL_GENRES: Genre[] = ["lettre", "motivation", "courrier"];

/* ---------- marking: the official DELF B2 grids ---------- */

/** The five criteria of the official writing grid (grille d'évaluation de la production écrite). */
export const CRITERIA = ["task", "coherence", "socio", "lexique", "morpho"] as const;
export type Criterion = (typeof CRITERIA)[number];

/** Every criterion of the writing and speaking grids, by key. */
export const CRITERION_LABEL: Record<string, string> = {
  task: "完成任务",
  coherence: "连贯和衔接",
  socio: "语体得体",
  lexique: "词汇",
  morpho: "语法",
  monologue: "独白：论证观点",
  interaction: "互动：辩论",
  phono: "发音和语调",
};

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

/** The four levels of the official grids and their points. */
export const LEVELS = [0, 1, 3, 5] as const;
export const LEVEL_LABEL: Record<number, string> = { 0: "未作答或不足", 1: "低于 B2", 3: "B2", 5: "B2+" };
/** The nearest level of the grid: 2 counts as 1 (below the level), 4 as 3. */
export const toLevel = (n: number) => (n >= 5 ? 5 : n >= 3 ? 3 : n >= 1 ? 1 : 0);

export interface EssayCorrection {
  wrong: string;
  right: string;
  type: ErrorType;
  why: string;
  /** Id of the grammar point to practise, or "". */
  point: string;
}

export interface EssayFlags {
  offTopic?: "none" | "partial" | "total";
  wrongGenre?: boolean;
  registerViolation?: boolean;
  pastedFromDoc?: boolean;
  cursoryDebate?: boolean;
}

export interface EssayFeedback {
  /** 0, 1, 3 or 5 per criterion of the grid used. */
  scores: Record<string, number>;
  comment: string;
  strengths: string[];
  todo: string[];
  corrections: EssayCorrection[];
  /** The learner's text with its errors fixed, keeping their ideas and wording where acceptable. */
  rewrite: string;
  /** Structured compliance flags from the grid check, when any anomaly is present. */
  flags?: EssayFlags;
}

/** The learner's second draft after reading the marking, and how it was marked. */
export interface Revision {
  text: string;
  at: number;
  fb?: EssayFeedback;
}

/** A model text for the task, written after the marking, with the patterns worth borrowing from it. */
export interface ModelEssay {
  text: string;
  /** Phrases or constructions of the model text, with what they do (Chinese). */
  patterns: { fr: string; zh: string }[];
}

export interface SavedEssay {
  id: string;
  task: string;
  text: string;
  created: number;
  fb?: EssayFeedback;
  rev?: Revision;
  model?: ModelEssay;
}

/** A mistake the learner kept from a marking, to look at again. */
export interface SavedNote {
  id: string;
  wrong: string;
  right: string;
  type: ErrorType;
  why: string;
  /** Id of the grammar point to practise, or "". */
  point: string;
  at: number;
  /** Title of the task it came from. */
  from: string;
}

export const MAX_ESSAY_LENGTH = 4000;
export const MAX_ESSAYS = 40;
export const MAX_NOTES = 150;
export const MAX_AI_TASKS = 24;

/** A task the AI wrote has an id starting with this. */
export const isAiTask = (id: string) => id.startsWith("ai-");

/** How many words a task of this kind asks for, as on the exam. B2 has no upper penalty (250–350 recommended). */
export const wordsFor = (level: "B1" | "B2", genre: Genre): [number, number] => (level === "B2" ? [250, 350] : genre === "mail" ? [120, 160] : [160, 200]);

/** Genres the AI can write a task for. */
export const GENRES = Object.keys(GENRE_LABEL) as Genre[];

export const totalScore = (fb: EssayFeedback) => Object.values(fb.scores).reduce((n, v) => n + v, 0);
export const maxScore = (fb: EssayFeedback) => Object.keys(fb.scores).length * 5;

/** Words as an examiner counts them: runs of letters; l'ami and c'est-à-dire count once. */
export function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}

const str = (v: unknown, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown, max: number) =>
  (Array.isArray(v) ? v : [])
    .map((x) => str(x, 300))
    .filter(Boolean)
    .slice(0, max);

/** Scores stored before the official grid was used (four criteria out of 5 each). */
const OLD_KEYS: Record<string, string> = { structure: "coherence", grammar: "morpho", vocabulary: "lexique" };

function parseFlags(r: Record<string, unknown>): EssayFlags | undefined {
  const f = (r.flags && typeof r.flags === "object" ? r.flags : r) as Record<string, unknown>;
  const offTopic = f.offTopic === "partial" || f.offTopic === "total" ? f.offTopic : "none";
  const wrongGenre = f.wrongGenre === true;
  const registerViolation = f.registerViolation === true;
  const pastedFromDoc = f.pastedFromDoc === true;
  const cursoryDebate = f.cursoryDebate === true;
  if (offTopic === "none" && !wrongGenre && !registerViolation && !pastedFromDoc && !cursoryDebate) return undefined;
  return {
    ...(offTopic !== "none" ? { offTopic } : {}),
    ...(wrongGenre ? { wrongGenre } : {}),
    ...(registerViolation ? { registerViolation } : {}),
    ...(pastedFromDoc ? { pastedFromDoc } : {}),
    ...(cursoryDebate ? { cursoryDebate } : {}),
  };
}

function capScoresByFlags(scores: Record<string, number>, flags?: EssayFlags): Record<string, number> {
  if (!flags) return scores;
  const s = { ...scores };
  if (flags.offTopic === "partial") {
    if ("task" in s) s.task = Math.min(s.task, 3);
    if ("monologue" in s) s.monologue = Math.min(s.monologue, 3);
    if ("lexique" in s) s.lexique = Math.min(s.lexique, 3);
  } else if (flags.offTopic === "total") {
    if ("task" in s) s.task = 0;
    if ("coherence" in s) s.coherence = 0;
    if ("socio" in s) s.socio = 0;
    if ("monologue" in s) s.monologue = 0;
    if ("interaction" in s) s.interaction = 0;
    if ("lexique" in s) s.lexique = Math.min(s.lexique, 3);
  }
  if (flags.wrongGenre) {
    if ("task" in s) s.task = Math.min(s.task, 1);
    if ("coherence" in s) s.coherence = Math.min(s.coherence, 1);
  }
  if (flags.registerViolation && "socio" in s) {
    s.socio = Math.min(s.socio, 1);
  }
  if (flags.pastedFromDoc) {
    if ("monologue" in s) s.monologue = Math.min(s.monologue, 1);
    if ("lexique" in s) s.lexique = Math.min(s.lexique, 1);
  }
  if (flags.cursoryDebate && "interaction" in s) {
    s.interaction = Math.min(s.interaction, 1);
  }
  return s;
}

/** Make an AI marking safe to show. `points` are the grammar point ids that may be linked. */
export function sanitizeEssayFeedback(raw: unknown, points: ReadonlySet<string>, criteria: readonly string[] = CRITERIA): EssayFeedback {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const given = (r.scores && typeof r.scores === "object" ? r.scores : {}) as Record<string, unknown>;
  const s: Record<string, unknown> = { ...given };
  for (const [old, now] of Object.entries(OLD_KEYS)) if (s[now] === undefined && given[old] !== undefined) s[now] = given[old];
  const rawScores: Record<string, number> = {};
  for (const c of criteria) rawScores[c] = toLevel(typeof s[c] === "number" && Number.isFinite(s[c]) ? (s[c] as number) : 0);
  const flags = parseFlags(r);
  const scores = capScoresByFlags(rawScores, flags);
  const corrections: EssayCorrection[] = (Array.isArray(r.corrections) ? r.corrections : [])
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => ({
      wrong: str(e.wrong, 200),
      right: str(e.right, 200),
      type: (ERROR_TYPES as readonly string[]).includes(e.type as string) ? (e.type as ErrorType) : ("other" as ErrorType),
      why: str(e.why, 300),
      point: typeof e.point === "string" && points.has(e.point) ? e.point : "",
    }))
    .filter((e) => (e.wrong || e.right) && e.wrong !== e.right)
    .slice(0, 25);
  return {
    scores,
    comment: str(r.comment, 800),
    strengths: list(r.strengths, 4),
    todo: list(r.todo, 4),
    corrections,
    rewrite: str(r.rewrite, MAX_ESSAY_LENGTH + 1000),
    ...(flags ? { flags } : {}),
  };
}

/**
 * The grid's rule for a text with too little to assess: under half the expected words, every criterion is 0.
 */
export function tooShort(text: string, minWords: number) {
  return countWords(text) < minWords / 2;
}

/**
 * Deterministic length caps matching DELF tolerance (-10% floor, i.e. 225 for B2 250w,
 * severe under-length <70% i.e. <175w, and half-length <50% i.e. <125w -> 0).
 */
export function applyEssayLengthCaps(fb: EssayFeedback, text: string, minWords: number): EssayFeedback {
  const wc = countWords(text);
  const scores = { ...fb.scores };
  let note = "";
  if (wc < minWords / 2) {
    for (const c of CRITERIA) scores[c] = 0;
    note = `不到要求字数的一半（实测 ${wc} 词，要求至少 ${minWords} 词），按官方评分表各项记 0 分。`;
  } else if (wc < Math.round(minWords * 0.7)) {
    scores.task = Math.min(scores.task ?? 0, 1);
    scores.coherence = Math.min(scores.coherence ?? 0, 1);
    // Severely under-length text cannot demonstrate B2+ breadth across language or register either.
    scores.socio = Math.min(scores.socio ?? 0, 3);
    scores.lexique = Math.min(scores.lexique ?? 0, 3);
    scores.morpho = Math.min(scores.morpho ?? 0, 3);
    note = `字数严重不足（实测 ${wc} 词，要求至少 ${minWords} 词，低于 ${Math.round(minWords * 0.7)} 词），完成任务与连贯衔接封顶 1 分，其余项最高 3 分。`;
  } else if (wc < Math.round(minWords * 0.9)) {
    scores.task = Math.min(scores.task ?? 0, 1);
    note = `字数低于容忍下限（实测 ${wc} 词，低于 ${Math.round(minWords * 0.9)} 词），完成任务封顶 1 分。`;
  }
  return note ? { ...fb, scores, comment: `${note}${fb.comment}` } : fb;
}

/**
 * Deterministic formal-register check for FORMAL_GENRES (lettre, motivation, courrier):
 * flags informal `tu`/`toi` outside quotes, casual openings (`Bonjour`/`Salut`), or missing formal salutation/closing.
 */
export function hasFormalRegisterViolation(text: string): boolean {
  const unquoted = text.replace(/«[^»]*»|"[^"]*"|“[^”]*”/g, " ");
  if (/(?:^|[.!?;:\n]\s*|\b(?:si|quand|lorsque|que|où|comme|mais|et|donc|car|or|puisque|parce\s+que)\s+)tu\b|\btoi\b/i.test(unquoted)) {
    return true;
  }
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return true;
  const head = lines.slice(0, 2).join(" ").slice(0, 220);
  const tail = lines.slice(-2).join(" ").slice(-280);
  if (/^(?:bonjour|salut|coucou|hello)\b/i.test(head)) return true;
  const hasSalutation = /\b(?:madame|monsieur|mesdames|messieurs|mme|rédact(?:eur|rice)|direct(?:eur|rice)|maire|rédaction|service)\b/i.test(head);
  const hasClosing = /\b(?:agréer|salutations|sentiments|considération|respectueu\w*|distingué\w*|dévoué\w*|hommages)\b/i.test(tail);
  return !hasSalutation || !hasClosing;
}

/** Apply FEI 2022 essay grid caps (off-topic, wrong genre, register/format, and word count). */
export function applyEssayGridCaps(fb: EssayFeedback, opts: { genre: Genre; text: string; minWords: number }): EssayFeedback {
  let flags = fb.flags ? { ...fb.flags } : undefined;
  if (FORMAL_GENRES.includes(opts.genre) && hasFormalRegisterViolation(opts.text)) {
    flags = { ...flags, registerViolation: true };
  }
  const cappedScores = capScoresByFlags(fb.scores, flags);
  const notes: string[] = [];
  if (flags?.offTopic === "total") notes.push("【严重偏题：完成任务、连贯衔接与语体得体记 0 分】");
  else if (flags?.offTopic === "partial") notes.push("【部分偏题：完成任务与词汇封顶 3 分】");
  if (flags?.wrongGenre) notes.push("【文体错位：完成任务与连贯衔接封顶 1 分】");
  if (flags?.registerViolation) notes.push("【语域/格式不符：语体得体封顶 1 分】");
  const withGridCaps: EssayFeedback = {
    ...fb,
    scores: cappedScores,
    ...(flags ? { flags } : {}),
    comment: notes.length ? `${notes.join("")}${fb.comment}` : fb.comment,
  };
  return applyEssayLengthCaps(withGridCaps, opts.text, opts.minWords);
}

/** Saved essays read back from storage or a backup. */
const anyPoint = { has: (id: string) => /^[a-z0-9-]{2,40}$/.test(id) } as ReadonlySet<string>;

export function sanitizeEssays(v: unknown): SavedEssay[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const known = new Set(ESSAY_TASKS.map((t) => t.id));
  const out: SavedEssay[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const e = x as Record<string, unknown>;
    if (typeof e.id !== "string" || typeof e.task !== "string" || !(known.has(e.task) || (isAiTask(e.task) && e.task.length <= 40)) || typeof e.text !== "string" || !e.text.trim() || typeof e.created !== "number") continue;
    const essay: SavedEssay = { id: e.id.slice(0, 40), task: e.task, text: e.text.slice(0, MAX_ESSAY_LENGTH), created: e.created };
    // any grammar id is kept here: the page only links the ones that exist
    if (e.fb && typeof e.fb === "object") essay.fb = sanitizeEssayFeedback(e.fb, anyPoint);
    const r = e.rev as Record<string, unknown> | undefined;
    if (r && typeof r === "object" && typeof r.text === "string" && r.text.trim() && typeof r.at === "number") {
      essay.rev = { text: r.text.slice(0, MAX_ESSAY_LENGTH), at: r.at, ...(r.fb && typeof r.fb === "object" ? { fb: sanitizeEssayFeedback(r.fb, anyPoint) } : {}) };
    }
    const m = e.model as Record<string, unknown> | undefined;
    if (m && typeof m === "object" && typeof m.text === "string" && m.text.trim()) essay.model = sanitizeModel(m);
    out.push(essay);
  }
  return out.length ? out.slice(0, MAX_ESSAYS) : undefined;
}

export function sanitizeModel(m: Record<string, unknown>): ModelEssay {
  const patterns = (Array.isArray(m.patterns) ? m.patterns : [])
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map((p) => ({ fr: str(p.fr, 200), zh: str(p.zh, 200) }))
    .filter((p) => p.fr)
    .slice(0, 10);
  return { text: str(m.text, MAX_ESSAY_LENGTH + 1000), patterns };
}

/** Kept mistakes read back from storage or a backup. */
export function sanitizeNotes(v: unknown): SavedNote[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: SavedNote[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const n = x as Record<string, unknown>;
    if (typeof n.id !== "string" || typeof n.at !== "number") continue;
    const wrong = str(n.wrong, 200);
    const right = str(n.right, 200);
    if (!(wrong || right) || wrong === right) continue;
    out.push({
      id: n.id.slice(0, 40),
      wrong,
      right,
      type: (ERROR_TYPES as readonly string[]).includes(n.type as string) ? (n.type as ErrorType) : "other",
      why: str(n.why, 300),
      point: typeof n.point === "string" && /^[a-z0-9-]{2,40}$/.test(n.point) ? n.point : "",
      at: n.at,
      from: str(n.from, 80),
    });
  }
  return out.length ? out.slice(0, MAX_NOTES) : undefined;
}

/** Tasks the AI wrote, read back from storage or a backup. */
export function sanitizeAiTasks(v: unknown): EssayTask[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: EssayTask[] = [];
  for (const x of v) {
    const t = buildTask(x, typeof (x as Record<string, unknown>)?.id === "string" ? ((x as Record<string, unknown>).id as string) : "");
    if (t && isAiTask(t.id)) out.push(t);
  }
  return out.length ? out.slice(0, MAX_AI_TASKS) : undefined;
}

/**
 * A task from what the AI wrote (or from storage): the text fields are trimmed and bounded; `level` and `genre`
 * must be ones we know. Null when the task is unusable (no instruction, no points or no plan).
 */
export function buildTask(raw: unknown, id: string): EssayTask | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const level = r.level === "B1" || r.level === "B2" ? r.level : null;
  const genre = (GENRES as readonly string[]).includes(r.genre as string) ? (r.genre as Genre) : null;
  if (!level || !genre || !id) return null;
  const pairs = (v: unknown, a: string, b: string, n: number) =>
    (Array.isArray(v) ? v : [])
      .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
      .map((p) => [str(p[a], 300), str(p[b], 300)] as [string, string])
      .filter(([x, y]) => x && y)
      .slice(0, n);
  const plan = pairs(r.plan, "zh", "fr", 6).map(([zh, fr]) => ({ zh, fr }));
  // phrases arrive from the AI as {fr, zh} and from storage as [fr, zh]
  const phrases = pairs((Array.isArray(r.phrases) ? r.phrases : []).map((p) => (Array.isArray(p) ? { fr: p[0], zh: p[1] } : p)), "fr", "zh", 10);
  const points = list(r.points, 6);
  const title = str(r.title, 60);
  const situation = str(r.situation, 300);
  const consigne = str(r.consigne, 500);
  if (!title || !situation || !consigne || points.length < 2 || plan.length < 3) return null;
  const doc = str(r.doc, 1200);
  const topic = typeof r.topic === "string" && r.topic ? r.topic.slice(0, 30) : undefined;
  return { id: id.slice(0, 40), level, genre, title, situation, consigne, words: wordsFor(level, genre), points, plan, phrases, ...(doc ? { doc } : {}), ...(topic ? { topic } : {}) };
}
