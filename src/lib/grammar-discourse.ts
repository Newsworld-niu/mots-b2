/**
 * Discourse-level multi-clause grammar exercises (语篇级/跨句时态与改错综合练习).
 * Trains concordance des temps, subjonctif/indicatif, hypothèse, relatifs composés,
 * nominalisation, participe présent vs adjectif verbal, accord du participe passé,
 * discours indirect, mise en relief, négation nuancée and error correction inside continuous paragraphs.
 */

export interface DiscourseSlot {
  id: string;
  /** Hint shown in parentheses after the blank or underlined text. */
  hint: string;
  /** Target text in the passage (for "fix" mode, the erroneous substring shown underlined). */
  shown?: string;
  /** Accepted correct answers (the canonical one first). */
  answer: readonly string[];
  /** Options for guided choice mode. */
  options: readonly string[];
  /** Corresponding grammar point id for review jump (`#/grammar?p=...`). */
  point: string;
  /** Optional sub-rule / trap tag (`"r0"`, `"t0"`, ...) within `point` for granular mastery tracking. */
  tag?: string;
  /** Concise Chinese explanation shown after grading. */
  why: string;
}

export interface DiscourseExercise {
  id: string;
  kind: "cloze" | "fix";
  level: "B1" | "B2";
  title: string;
  subtitle: string;
  /** Paragraph segments interleaved with slots: `{{0}}`, `{{1}}`, ... */
  text: string;
  slots: readonly DiscourseSlot[];
}

export const DISCOURSE_EXERCISES: readonly DiscourseExercise[] = [
  {
    id: "disc-recit",
    kind: "cloze",
    level: "B1",
    title: "新闻叙事与跨句时态呼应",
    subtitle: "Récit au passé · 未完成 / 愈过去 / 过去将来 / 虚拟式",
    text:
      "Hier matin, les habitants du quartier ont découvert une affiche devant la mairie. " +
      "Pendant des mois, ils {{0}} des informations précises sur le projet de parc urbain. " +
      "En réalité, la commission municipale {{1}} les plans la semaine précédente. " +
      "Lors de la réunion d'hier, le maire a précisé que les travaux {{2}} dès le mois prochain " +
      "et a demandé aux riverains qu'ils {{3}} leur avis avant vendredi.",
    slots: [
      {
        id: "r1",
        hint: "attendre",
        answer: ["attendaient"],
        options: ["attendaient", "ont attendu", "attendront", "avaient attendu"],
        point: "pc-imparfait",
        tag: "r1",
        why: "“Pendant des mois”描述发现告示之前的持续背景状态，用未完成过去时 attendaient。",
      },
      {
        id: "r2",
        hint: "déjà valider",
        answer: ["avait déjà validé"],
        options: ["avait déjà validé", "a déjà validé", "validait déjà", "aura déjà validé"],
        point: "plus-que-parfait",
        tag: "r1",
        why: "“la semaine précédente”发生在“昨天发现”（ont découvert）之前，属于过去的过去，用愈过去时 avait déjà validé。",
      },
      {
        id: "r3",
        hint: "commencer",
        answer: ["commenceraient"],
        options: ["commenceraient", "commenceront", "commençaient", "ont commencé"],
        point: "discours-indirect",
        tag: "r0",
        why: "主句转述动词 a précisé 为过去时，从句表示相对于昨天的将来动作，间接引语中须用过去将来时（条件式形态）commenceraient。",
      },
      {
        id: "r4",
        hint: "donner",
        answer: ["donnent"],
        options: ["donnent", "donneront", "donnaient", "ont donné"],
        point: "subjonctif",
        tag: "r2",
        why: "demander à qqn que + 从句表达要求或意愿，从句须用虚拟式 donnent。",
      },
    ],
  },
  {
    id: "disc-concession",
    kind: "cloze",
    level: "B2",
    title: "议论文让步与虚拟式运用",
    subtitle: "Concession & Subjonctif · 虚拟式现在时与过去时",
    text:
      "Bien que la ville {{0}} plusieurs mesures l'an dernier pour limiter le trafic, les embouteillages persistent. " +
      "Quoique les nouveaux bus électriques {{1}} plus confortables, beaucoup d'usagers préfèrent encore leur voiture. " +
      "Il est pourtant évident que cette habitude {{2}} évoluer avant que la qualité de l'air ne {{3}} davantage.",
    slots: [
      {
        id: "c1",
        hint: "prendre",
        answer: ["ait pris"],
        options: ["ait pris", "a pris", "prenait", "prenne"],
        point: "subj-passe",
        tag: "r1",
        why: "Bien que 要求虚拟式，且 l'an dernier 表示动作已在主句之前完成，须用虚拟式过去时 ait pris。",
      },
      {
        id: "c2",
        hint: "être",
        answer: ["soient"],
        options: ["soient", "sont", "seront", "étaient"],
        point: "opposition-concession",
        tag: "r1",
        why: "Quoique（尽管）引导让步状语从句，后接虚拟式现在时 soient。",
      },
      {
        id: "c3",
        hint: "devoir",
        answer: ["doit"],
        options: ["doit", "doive", "devrait", "ait dû"],
        point: "subj-indicatif",
        tag: "r0",
        why: "Il est évident que 表示确定事实（非怀疑/愿望），用直陈式 doit。",
      },
      {
        id: "c4",
        hint: "se dégrader",
        answer: ["se dégrade"],
        options: ["se dégrade", "se dégradera", "s'est dégradée", "se dégradait"],
        point: "anteriorite",
        tag: "r0",
        why: "avant que (+ ne explétif) 引导时间先时从句，固定要求虚拟式 se dégrade。",
      },
    ],
  },
  {
    id: "disc-hypothese",
    kind: "cloze",
    level: "B2",
    title: "过去遗憾与现实假设",
    subtitle: "Hypothèse · Si + PQP / Imparfait → Conditionnel",
    text:
      "Si la région {{0}} dans le réseau ferroviaire il y a dix ans, les petites lignes rurales {{1}} en 2020. " +
      "Désormais, même si les élus {{2}} rouvrir ces gares rapidement, les coûts {{3}} très élevés pendant plusieurs années.",
    slots: [
      {
        id: "h1",
        hint: "investir",
        answer: ["avait investi"],
        options: ["avait investi", "a investi", "investissait", "investirait"],
        point: "cond-passe",
        tag: "r1",
        why: "il y a dix ans 表示与过去事实相反的假设，si 从句用愈过去时 avait investi。",
      },
      {
        id: "h2",
        hint: "ne pas fermer",
        answer: ["n'auraient pas fermé"],
        options: ["n'auraient pas fermé", "ne fermeraient pas", "n'ont pas fermé", "ne fermaient pas"],
        point: "cond-passe",
        tag: "r1",
        why: "en 2020 指向过去已发生的结果，主句用条件式过去时 n'auraient pas fermé。",
      },
      {
        id: "h3",
        hint: "vouloir",
        answer: ["voulaient"],
        options: ["voulaient", "veulent", "voudraient", "ont voulu"],
        point: "conditionnel",
        tag: "t0",
        why: "même si 表示非真实假设时从句用未完成过去时 voulaient（不可用 conditionnel）。",
      },
      {
        id: "h4",
        hint: "rester",
        answer: ["resteraient"],
        options: ["resteraient", "restent", "resteront", "sont restés"],
        point: "conditionnel",
        tag: "r1",
        why: "对应 si + imparfait 的主句推断，用条件式现在时 resteraient。",
      },
    ],
  },
  {
    id: "disc-discours",
    kind: "cloze",
    level: "B2",
    title: "间接引语与先将来时",
    subtitle: "Discours rapporté & Futur antérieur",
    text:
      "La directrice a annoncé que l'entreprise {{0}} un nouveau programme dès l'automne. " +
      "Elle a rappelé le projet {{1}} tout le service dépendait. " +
      "Selon le calendrier officiel, dès que le conseil {{2}} le budget en juin, les équipes {{3}} s'inscrire immédiatement.",
    slots: [
      {
        id: "d1",
        hint: "lancer",
        answer: ["lancerait"],
        options: ["lancerait", "lancera", "lance", "a lancé"],
        point: "discours-indirect",
        tag: "r0",
        why: "主句为过去时 a annoncé que，从句将来的计划转为过去将来时 lancerait。",
      },
      {
        id: "d2",
        hint: "关系代词",
        answer: ["dont"],
        options: ["dont", "que", "lequel", "où"],
        point: "relatifs",
        tag: "r2",
        why: "dépendre de qqch 带介词 de，先行词 le projet 由关系代词 dont 替代。",
      },
      {
        id: "d3",
        hint: "adopter",
        answer: ["aura adopté"],
        options: ["aura adopté", "adoptera", "ait adopté", "avait adopté"],
        point: "futur-anterieur",
        tag: "r1",
        why: "dès que 表示“一旦完成……就……”，先于将来主句完成的动作要用先将来时 aura adopté。",
      },
      {
        id: "d4",
        hint: "pouvoir",
        answer: ["pourront"],
        options: ["pourront", "pourraient", "peuvent", "ont pu"],
        point: "futur",
        tag: "r1",
        why: "此处回归客观官方日程的将来结果，主句用简单将来时 pourront。",
      },
    ],
  },
  {
    id: "disc-cohesion",
    kind: "cloze",
    level: "B2",
    title: "分词结构、副动词与复合关系代词",
    subtitle: "Cohésion B2 · Participe présent, Gérondif & Relatifs",
    text:
      "{{0}} donné l'augmentation du coût de l'énergie, de nombreux ménages cherchent à mieux isoler leur logement. " +
      "{{1}} les fenêtres anciennes, on réduit immédiatement les pertes de chaleur. " +
      "Ce dispositif permet de faire des économies durables, {{2}} l'investissement initial reste lourd pour les foyers modestes. " +
      "C'est pourquoi l'État propose une aide financière {{3}} chacun peut prétendre sous conditions de ressources.",
    slots: [
      {
        id: "k1",
        hint: "être",
        answer: ["Étant", "étant"],
        options: ["Étant", "Ayant", "Été", "Soit"],
        point: "participe-present",
        tag: "r3",
        why: "Étant donné（鉴于、考虑到）是高频 B2 因果分词固定短语。",
      },
      {
        id: "k2",
        hint: "gérondif · rénover",
        answer: ["En rénovant", "en rénovant"],
        options: ["En rénovant", "Rénovant", "En rénové", "Pour rénové"],
        point: "gerondif",
        tag: "r1",
        why: "en + 现在分词构成副动词（gérondif），表示“通过翻新……”的方式手段。",
      },
      {
        id: "k3",
        hint: "转折连接词",
        answer: ["néanmoins", "toutefois", "cependant", "pourtant"],
        options: ["néanmoins", "donc", "puisque", "afin que"],
        point: "connecteurs",
        tag: "r2",
        why: "前后语义构成对比转折（长期省钱 vs 初始投入大），用 néanmoins（然而、尽管如此）。",
      },
      {
        id: "k4",
        hint: "à + 关系代词",
        answer: ["à laquelle"],
        options: ["à laquelle", "laquelle", "dont", "où"],
        point: "relatifs-composes",
        tag: "r1",
        why: "动词搭配为 prétendre à qqch（申请/享有某待遇），先行词 une aide financière 为阴性单数，故用 à laquelle。",
      },
    ],
  },
  {
    id: "disc-erreur",
    kind: "fix",
    level: "B2",
    title: "综合语篇改错：考场高频跨句失误",
    subtitle: "Correction en contexte · 找出并改写 4 处典型 B1→B2 错误",
    text:
      "Bien que le télétravail {{0}} devenu courant depuis la crise sanitaire, son encadrement juridique soulève encore des questions. " +
      "Si les entreprises {{1}} des règles claires plus tôt, de nombreux litiges sur le droit à la déconnexion ne se seraient pas produits. " +
      "Par ailleurs, c'est un équilibre {{2}} les salariés ont absolument besoin pour préserver leur vie personnelle. " +
      "Il faut donc agir vite avant que ce déséquilibre ne {{3}} la norme dans le secteur tertiaire.",
    slots: [
      {
        id: "e1",
        shown: "est",
        hint: "改写此处语式",
        answer: ["soit"],
        options: ["soit", "est", "sera", "était"],
        point: "subjonctif",
        tag: "r2",
        why: "Bien que 后不能用直陈式 est，须改为虚拟式 soit。",
      },
      {
        id: "e2",
        shown: "auraient préparé",
        hint: "改写 si 从句时态",
        answer: ["avaient préparé"],
        options: ["avaient préparé", "auraient préparé", "ont préparé", "préparaient"],
        point: "cond-passe",
        tag: "t0",
        why: "法语铁律：si 条件从句中绝不直接使用 conditionnel，过去非真实假设须改为愈过去时 avaient préparé。",
      },
      {
        id: "e3",
        shown: "que",
        hint: "改写关系代词",
        answer: ["dont"],
        options: ["dont", "que", "où", "lequel"],
        point: "relatifs",
        tag: "r2",
        why: "avoir besoin de qqch 带介词 de，修饰先行词 un équilibre 须用 dont 而非 que。",
      },
      {
        id: "e4",
        shown: "devient",
        hint: "改写此处语式",
        answer: ["devienne"],
        options: ["devienne", "devient", "deviendra", "devenait"],
        point: "anteriorite",
        tag: "t3",
        why: "avant que ... ne 后必须使用虚拟式，应将 devient 改为 devienne。",
      },
    ],
  },
  {
    id: "disc-subj-indic",
    kind: "cloze",
    level: "B2",
    title: "观点动词肯定与否定的语式分水岭",
    subtitle: "Subjonctif vs Indicatif · 确信与怀疑之间的句法选择",
    text:
      "Je pense sincèrement que cette réforme {{0}} nécessaire pour moderniser le réseau ferroviaire. " +
      "En revanche, je ne suis pas certain que les usagers ruraux {{1}} en profiter dès la première année. " +
      "Il est probable que le chantier {{2}} plusieurs mois de retard, bien que le ministre {{3}} rassurer les élus locaux hier.",
    slots: [
      {
        id: "si1",
        hint: "être",
        answer: ["est"],
        options: ["est", "soit", "était", "sera"],
        point: "subj-indicatif",
        tag: "r0",
        why: "肯定句 Je pense que 表达确信判断，从句须用直陈式 est。",
      },
      {
        id: "si2",
        hint: "pouvoir",
        answer: ["puissent"],
        options: ["puissent", "peuvent", "pourront", "pouvaient"],
        point: "subj-indicatif",
        tag: "r2",
        why: "否定句 je ne suis pas certain que 表示怀疑或不确定，从句用虚拟式 puissent。",
      },
      {
        id: "si3",
        hint: "prendre",
        answer: ["prendra", "prenne"],
        options: ["prendra", "prenne", "ait pris", "prenait"],
        point: "impersonnel",
        tag: "t3",
        why: "Il est probable que（很可能）肯定表达较高可能性，从句标准用法为直陈式将来时 prendra。",
      },
      {
        id: "si4",
        hint: "vouloir（过去完成）",
        answer: ["ait voulu"],
        options: ["ait voulu", "a voulu", "veuille", "voulait"],
        point: "subj-passe",
        tag: "r1",
        why: "bien que 要求虚拟式，且 hier 表明发生在过去，须用虚拟式过去时 ait voulu。",
      },
    ],
  },
  {
    id: "disc-relations",
    kind: "cloze",
    level: "B2",
    title: "议论文复杂关系从句与强调句衔接",
    subtitle: "Relatifs composés & Mise en relief · 让观点指代精准无歧义",
    text:
      "La question {{0}} nous avons débattu hier touche directement les jeunes actifs. " +
      "L'indépendance financière, {{1}} aspirent tant de diplômés, dépend aussi du coût du logement. " +
      "Ce sont précisément ces loyers élevés {{2}} freinent leur installation, et voici les critères {{3}} le jury s'est appuyé pour attribuer les aides.",
    slots: [
      {
        id: "rl1",
        hint: "débattre de qqch",
        answer: ["dont"],
        options: ["dont", "que", "laquelle", "où"],
        point: "relatifs",
        tag: "r2",
        why: "débattre d'une question 带介词 de，修饰先行词 la question 用关系代词 dont。",
      },
      {
        id: "rl2",
        hint: "aspirer à qqch",
        answer: ["à laquelle"],
        options: ["à laquelle", "laquelle", "dont", "où"],
        point: "relatifs-composes",
        tag: "r1",
        why: "aspirer à qqch 带介词 à，先行词 l'indépendance 为阴性单数，须用复合关系代词 à laquelle。",
      },
      {
        id: "rl3",
        hint: "强调句主语",
        answer: ["qui"],
        options: ["qui", "que", "dont", "ce qui"],
        point: "mise-en-relief",
        tag: "r0",
        why: "强调句 Ce sont ... qui 突出被强调的主语 ces loyers élevés，从句缺主语须用 qui。",
      },
      {
        id: "rl4",
        hint: "s'appuyer sur qqch",
        answer: ["sur lesquels"],
        options: ["sur lesquels", "desquels", "auxquels", "sur quoi"],
        point: "relatifs-composes",
        tag: "r0",
        why: "s'appuyer sur qqch 带介词 sur，先行词 les critères 为阳性复数，故用 sur lesquels。",
      },
    ],
  },
  {
    id: "disc-accord",
    kind: "fix",
    level: "B2",
    title: "过去分词性数配合与特殊陷阱纠错",
    subtitle: "Accord du participe passé · 直接宾语前置与代动词",
    text:
      "Les études sociologiques que les chercheurs ont {{0}} récemment montrent une évolution nette. " +
      "Face à cette réalité, la réforme qu'il a {{1}} adopter semblait inévitable. " +
      "La mairie s'est rapidement {{2}} sur ce dossier, malgré les objectifs ambitieux qu'elle s'était {{3}}.",
    slots: [
      {
        id: "ac1",
        shown: "publié",
        hint: "与前置宾语配合",
        answer: ["publiées"],
        options: ["publiées", "publié", "publiés", "publiée"],
        point: "accord-pp",
        tag: "r1",
        why: "助动词 avoir 下，直接宾语 que 指代阴性复数 Les études sociologiques 且位于动词前，须配合为 publiées。",
      },
      {
        id: "ac2",
        shown: "fallue",
        hint: "无人称过去分词",
        answer: ["fallu"],
        options: ["fallu", "fallue", "fallus", "fallut"],
        point: "accord-pp",
        tag: "r1",
        why: "无人称动词 il a fallu 永远保持阳性单数不变形（qu' 并非直接宾语），须改为 fallu。",
      },
      {
        id: "ac3",
        shown: "imposé",
        hint: "代动词直接宾语配合",
        answer: ["imposée"],
        options: ["imposée", "imposé", "imposés", "imposées"],
        point: "accord-pp",
        tag: "r2",
        why: "代动词 s'imposer 表示“确立地位 / 站稳立场”，此处 se 作直接宾语且无额外宾语在后，须与主语 la mairie 配合为阴性单数 imposée。",
      },
      {
        id: "ac4",
        shown: "fixé",
        hint: "s'était fixé qqch",
        answer: ["fixés"],
        options: ["fixés", "fixé", "fixée", "fixées"],
        point: "accord-pp",
        tag: "r2",
        why: "代动词 se fixer des objectifs 中 se 为间宾，但直宾 les objectifs（que）前置，故配合阳性复数 fixés。",
      },
    ],
  },
  {
    id: "disc-passif",
    kind: "cloze",
    level: "B2",
    title: "被动表达与高级替代句式",
    subtitle: "Voix passive & Tournures impersonnelles · 书面报道地道表达",
    text:
      "Chaque année, de nombreux immeubles anciens {{0}} rénovés grâce aux aides publiques. " +
      "Plusieurs architectes {{1}} confier la transformation d'anciennes usines en logements étudiants. " +
      "Cependant, ces chantiers prennent du retard {{2}} la hausse du prix des matériaux, " +
      "si bien que les loyers {{3}} risquent d'augmenter.",
    slots: [
      {
        id: "pv1",
        hint: "être 被动现在时",
        answer: ["sont"],
        options: ["sont", "ont", "soient", "étaient"],
        point: "passif",
        tag: "r0",
        why: "Chaque année 表示惯常被动事实，直接用 être 现在时 + 过去分词 sont rénovés。",
      },
      {
        id: "pv2",
        hint: "se voir + inf 被动替代",
        answer: ["se voient"],
        options: ["se voient", "se font", "sont", "se laissent"],
        point: "passif-autres",
        tag: "r2",
        why: "se voir confier qqch（被委托某任务）是法语 B2 书面语避免生硬被动句的经典高级替代。",
      },
      {
        id: "pv3",
        hint: "负面原因介词短语",
        answer: ["en raison de", "du fait de", "à cause de"],
        options: ["en raison de", "grâce à", "faute", "malgré"],
        point: "cause-consequence",
        tag: "r1",
        why: "因成本上涨导致工程延误，书面中性/客观原因短语首选 en raison de（grâce à 只用于积极原因）。",
      },
      {
        id: "pv4",
        hint: "修饰复数 les loyers",
        answer: ["finaux"],
        options: ["finaux", "final", "finals", "finale"],
        point: "adj-agree",
        tag: "r1",
        why: "修饰阳性复数 les loyers，-al 结尾形容词复数变 -aux（finaux）。",
      },
    ],
  },
  {
    id: "disc-infinitif",
    kind: "cloze",
    level: "B2",
    title: "动词介词搭配与先后次序不定式",
    subtitle: "Verbes + préposition & Antériorité · 精准驾驭不定式结构",
    text:
      "La mairie encourage les commerçants {{0}} installer des bornes de tri devant leurs boutiques. " +
      "Cette mesure vise à éviter {{1}} gaspiller des tonnes de carton recyclable. " +
      "Toutefois, {{2}} consulté les artisans du centre-ville, le conseil a choisi de reporter l'amende, " +
      "afin d'inciter chacun {{3}} s'adapter volontairement.",
    slots: [
      {
        id: "in1",
        hint: "encourager qqn ... inf",
        answer: ["à"],
        options: ["à", "de", "pour", "en"],
        point: "verbes-prep",
        tag: "r0",
        why: "encourager quelqu'un à faire quelque chose 固定搭配介词 à。",
      },
      {
        id: "in2",
        hint: "éviter ... inf",
        answer: ["de"],
        options: ["de", "à", "par", "sans"],
        point: "verbes-prep",
        tag: "r1",
        why: "éviter de faire quelque chose 固定搭配介词 de。",
      },
      {
        id: "in3",
        hint: "先发生动作（完成不定式）",
        answer: ["après avoir"],
        options: ["après avoir", "avant d'avoir", "pour avoir", "sans"],
        point: "anteriorite",
        tag: "r1",
        why: "après + 完成不定式 (après avoir consulté) 表示“在……之后”，且须用完成式不定式。",
      },
      {
        id: "in4",
        hint: "inciter qqn ... inf",
        answer: ["à"],
        options: ["à", "de", "dans", "par"],
        point: "verbes-prep",
        tag: "r0",
        why: "inciter quelqu'un à faire quelque chose 与 encourager 同理，接介词 à。",
      },
    ],
  },
  {
    id: "disc-participe",
    kind: "cloze",
    level: "B2",
    title: "现在分词、副动词与书面凝练句式",
    subtitle: "Participe présent & Gérondif · 省去冗余关系从句",
    text:
      "{{0}} pleinement des effets du changement climatique, plusieurs maires côtiers révisent leurs plans d'urbanisme. " +
      "{{1}} régulièrement avec les pêcheurs locaux, ils parviennent à anticiper l'érosion des plages. " +
      "Une étude {{2}} récemment confirme l'urgence d'agir ; {{3}}, les crédits nationaux restent limités.",
    slots: [
      {
        id: "pt1",
        hint: "prendre conscience（分词作原因）",
        answer: ["Prenant conscience", "prenant conscience"],
        options: ["Prenant conscience", "En prenant conscience", "Pris conscience", "Qui prenant conscience"],
        point: "participe-present",
        tag: "r0",
        why: "现在分词短语置于句首直接说明主语这样做的原因/背景，相当于 Comme ils prennent conscience。",
      },
      {
        id: "pt2",
        hint: "dialoguer（方式手段）",
        answer: ["En dialoguant", "en dialoguant"],
        options: ["En dialoguant", "Dialoguant", "Ayant dialogué", "Pour dialoguer"],
        point: "gerondif",
        tag: "r1",
        why: "en + 现在分词（副动词 gérondif）表示“通过定期沟通……”的方式方法。",
      },
      {
        id: "pt3",
        hint: "paraître（带过去发生意味）",
        answer: ["parue"],
        options: ["parue", "paraissant", "paru", "étant paru"],
        point: "accord-pp",
        tag: "r0",
        why: "无助动词作定语修饰阴性单数 Une étude，过去分词单独配合为 parue（最近发表的）。",
      },
      {
        id: "pt4",
        hint: "让步转折副词",
        answer: ["toutefois", "cependant", "néanmoins", "pourtant"],
        options: ["toutefois", "d'ailleurs", "puisque", "donc"],
        point: "connecteurs",
        tag: "r2",
        why: "前后语义构成紧迫性与资金不足的反差转折，用 toutefois（然而）。",
      },
    ],
  },
  {
    id: "disc-futur",
    kind: "cloze",
    level: "B2",
    title: "先将来时、目的连词与得体委婉建议",
    subtitle: "Futur antérieur & But · 书信诉求与行政程序推进",
    text:
      "Dès que votre dossier {{0}} validé par l'université, vous recevrez votre attestation par courriel. " +
      "Une fois que vous {{1}} ce document, vous {{2}} prendre rendez-vous à la préfecture, " +
      "{{3}} votre titre de séjour soit renouvelé avant la rentrée.",
    slots: [
      {
        id: "ft1",
        hint: "être 被动先将来时",
        answer: ["aura été"],
        options: ["aura été", "sera", "a été", "est"],
        point: "futur-anterieur",
        tag: "r1",
        why: "Dès que 后动作先于主句将来时 recevrez 完成，被动语态先将来时为 aura été validé。",
      },
      {
        id: "ft2",
        hint: "télécharger（先将来时）",
        answer: ["aurez téléchargé"],
        options: ["aurez téléchargé", "téléchargerez", "téléchargez", "avez téléchargé"],
        point: "futur-anterieur",
        tag: "r1",
        why: "Une fois que 引导从句表示先于主句动作完成的将来行为，用先将来时 aurez téléchargé。",
      },
      {
        id: "ft3",
        hint: "devoir（委婉建议条件式）",
        answer: ["devriez"],
        options: ["devriez", "devez", "deviez", "devrez"],
        point: "modaux",
        tag: "r0",
        why: "书面礼貌提出合理建议常用条件式 devriez（您应当/最好）。",
      },
      {
        id: "ft4",
        hint: "表目的（+ 虚拟式）",
        answer: ["afin que", "pour que"],
        options: ["afin que", "afin de", "parce que", "donc"],
        point: "but",
        tag: "r1",
        why: "主从句主语不同（vous vs votre titre），表达目的须用 afin que + 虚拟式 soit。",
      },
    ],
  },
  {
    id: "disc-negation",
    kind: "fix",
    level: "B2",
    title: "高级否定 nuance 与限定结构纠错",
    subtitle: "Négation & Restriction · 摆脱口语化 pas 的 B2 否定升级",
    text:
      "Selon le rapport, les ventes de presse écrite {{0}} progressé cette année. " +
      "Les lecteurs ne consultent {{1}} les brèves gratuites sur leur téléphone. " +
      "Il est d'ailleurs accepté {{2}} que cette mutation numérique continue, car {{3}} média papier n'échappe à la baisse.",
    slots: [
      {
        id: "ng1",
        shown: "n'ont pas beaucoup",
        hint: "书面否定修饰",
        answer: ["n'ont guère"],
        options: ["n'ont guère", "n'ont pas beaucoup", "n'ont rien", "ont pas"],
        point: "negation-nuances",
        tag: "r0",
        why: "书面语中用 ne ... guère（几乎不/没怎么）优雅替代口语颜色过重的 ne ... pas beaucoup。",
      },
      {
        id: "ng2",
        shown: "seulement",
        hint: "精确限定“仅仅”",
        answer: ["plus que", "que"],
        options: ["plus que", "seulement", "guère", "point"],
        point: "restriction",
        tag: "r1",
        why: "句首已有 ne，表达“不再……而仅仅……”应接 ne ... plus que，不可在 ne 后再用 seulement。",
      },
      {
        id: "ng3",
        shown: "sans quelques hésitations",
        hint: "否定复数后零冠词",
        answer: ["sans aucune hésitation", "sans hésitation"],
        options: ["sans aucune hésitation", "sans quelques hésitations", "sans des hésitations", "pas aucune hésitation"],
        point: "negation-nuances",
        tag: "r2",
        why: "sans 引导绝对否定意涵搭配单数 sans aucune hésitation（毫不犹豫），不接复数 des/quelques。",
      },
      {
        id: "ng4",
        shown: "pas un",
        hint: "作主语的否定泛指",
        answer: ["aucun"],
        options: ["aucun", "pas un", "aucuns", "personne"],
        point: "indefinis",
        tag: "r3",
        why: "修饰可数名词作主语用 aucun média n'échappe（没有任何媒体能幸免），比 pas un 更地道正式。",
      },
    ],
  },
  {
    id: "disc-comparaison",
    kind: "cloze",
    level: "B2",
    title: "成比例递进与冠词在复数形容词前的省略",
    subtitle: "Proportion & Articles · 精细把控比例递进与冠词细节",
    text:
      "{{0}} les loyers augmentent dans le centre, plus les jeunes actifs s'installent en banlieue. " +
      "Ce phénomène est {{1}} préoccupant que les trains matinaux sont déjà saturés. " +
      "Pourtant, certaines communes ont obtenu {{2}} résultats en créant des lignes de bus rapides, " +
      "offrant ainsi {{3}} fiabilité que le métro.",
    slots: [
      {
        id: "cm1",
        hint: "越……越……",
        answer: ["Plus", "plus"],
        options: ["Plus", "Autant", "Mieux", "Tant"],
        point: "proportion",
        tag: "r0",
        why: "成比例句式“越……越……”使用 Plus ..., plus ...（注意不可加 le 或 de）。",
      },
      {
        id: "cm2",
        hint: "正因为……而越发……",
        answer: ["d'autant plus"],
        options: ["d'autant plus", "d'autant que", "si plus", "tellement plus"],
        point: "comparaison-nuances",
        tag: "r2",
        why: "d'autant plus + adj + que 表示“由于……（原因），而显得越发……”。",
      },
      {
        id: "cm3",
        hint: "形容词在复数名词前",
        answer: ["de bons"],
        options: ["de bons", "des bons", "les bons", "du bon"],
        point: "articles-nuances",
        tag: "t2",
        why: "当形容词 bons 置于复数名词 résultats 之前时，不定冠词 des 在书面标准法语中须缩减为 de。",
      },
      {
        id: "cm4",
        hint: "对等比较（名词前）",
        answer: ["autant de"],
        options: ["autant de", "aussi", "si de", "même"],
        point: "comparaison-nuances",
        tag: "r3",
        why: "比较抽象名词 fiabilité 的同等程度，使用 autant de + 名词 + que。",
      },
    ],
  },
  {
    id: "disc-pronoms-b1",
    kind: "cloze",
    level: "B1",
    title: "双宾语代词、y / en 与重读人称代词",
    subtitle: "Double pronoms & Toniques · B1 核心代词衔接",
    text:
      "Votre proposition sur le compost collectif est excellente : mon voisin {{0}} déjà parlé hier, " +
      "et je compte bien {{1}} participer dès le mois prochain. " +
      "Notre syndic a pris ce dossier au sérieux : il {{2}} a consacré un budget important, " +
      "et plusieurs habitants, {{3}}, préparent l'affichage.",
    slots: [
      {
        id: "pr1",
        hint: "parler de qqch à moi",
        answer: ["m'en a"],
        options: ["m'en a", "me l'a", "m'y a", "en m'a"],
        point: "double-pronoms",
        tag: "r2",
        why: "parler de cette proposition à moi -> 双宾语代词顺序 me + en（缩合为 m'en），助动词在后 -> m'en a。",
      },
      {
        id: "pr2",
        hint: "participer à qqch",
        answer: ["y"],
        options: ["y", "en", "lui", "le"],
        point: "y-en",
        tag: "r0",
        why: "participer à ce projet 替代 à 引导的物用代词 y，放在不定式 participer 前。",
      },
      {
        id: "pr3",
        hint: "consacrer qqch à ce dossier",
        answer: ["y"],
        options: ["y", "en", "lui", "le"],
        point: "y-en",
        tag: "r0",
        why: "consacrer un budget à ce dossier 带介词 à 接事物名词，用代词 y 替代并置于助动词 a 之前。",
      },
      {
        id: "pr4",
        hint: "至于他们（重读强调）",
        answer: ["quant à eux"],
        options: ["quant à eux", "quant à ils", "quant à leur", "pour ils"],
        point: "toniques",
        tag: "r0",
        why: "quant à 后必须接重读人称代词（阳性复数 eux），表示“至于他们”。",
      },
    ],
  },
  {
    id: "disc-citoyennete-fix",
    kind: "fix",
    level: "B2",
    title: "高频中式法语病句清零（写作交卷前自检模拟）",
    subtitle: "Correction C'est/Il est, Prépositions & Articles · 扫除隐形 B1 错误",
    text:
      "{{0}} indispensable de rénover les écoles rurales pour maintenir l'égalité territoriale. " +
      "Ces travaux permettraient {{1}} élèves d'étudier dans de meilleures conditions. " +
      "Or, l'entretien des bâtiments est exactement {{2}} s'intéressent rarement les débats nationaux, " +
      "même si {{3}} projets locaux manquent de financements stables.",
    slots: [
      {
        id: "ct1",
        shown: "C'est",
        hint: "形容词 + de + inf 结构",
        answer: ["Il est"],
        options: ["Il est", "C'est", "Il a", "Ça est"],
        point: "cest-ilest",
        tag: "r1",
        why: "在「形容词 + de + 不定式」作形式主语开头时，书面标准必须用 Il est indispensable de，不可用 C'est。",
      },
      {
        id: "ct2",
        shown: "les",
        hint: "permettre + 间接宾语",
        answer: ["aux"],
        options: ["aux", "les", "des", "à les"],
        point: "verbes-prep",
        tag: "r3",
        why: "permettre à quelqu'un de faire qqch 为间接宾语结构，à + les 缩合为 aux élèves。",
      },
      {
        id: "ct3",
        shown: "ce que",
        hint: "s'intéresser à + 复合关系代词",
        answer: ["ce à quoi"],
        options: ["ce à quoi", "ce que", "ce dont", "ce qui"],
        point: "relatifs-composes",
        tag: "r2",
        why: "动词搭配是 s'intéresser à qqch（对……感兴趣），先行词泛指事物且含 à，须用 ce à quoi。",
      },
      {
        id: "ct4",
        shown: "beaucoup des",
        hint: "数量副词后的介词缩略",
        answer: ["beaucoup de"],
        options: ["beaucoup de", "beaucoup des", "beaucoup du", "plus des"],
        point: "articles-nuances",
        tag: "r0",
        why: "数量副词 beaucoup / énormément / peu 后无论名词是否复数，通常只接介词 de（无冠词 des），即 beaucoup de projets。",
      },
    ],
  },
  {
    id: "disc-b1-quotidien",
    kind: "cloze",
    level: "B1",
    title: "日常生活时间标志与未完成/复合过去配合",
    subtitle: "Passé composé, Imparfait & Durée · B1 叙事基本功巩固",
    text:
      "L'été dernier, quand je {{0}} à Nantes chez ma tante, il {{1}} presque tous les matins. " +
      "Un jour, nous {{2}} de visiter le musée d'Arts, où nous sommes restés {{3}} trois heures.",
    slots: [
      {
        id: "bq1",
        hint: "habiter（背景状态）",
        answer: ["habitais"],
        options: ["habitais", "ai habité", "habite", "avais habité"],
        point: "pc-imparfait",
        tag: "r1",
        why: "描述去年夏天住在一起的背景持续状态，用未完成过去时 habitais。",
      },
      {
        id: "bq2",
        hint: "pleuvoir（习惯天气）",
        answer: ["pleuvait"],
        options: ["pleuvait", "a plu", "pleut", "pleuvra"],
        point: "imparfait",
        tag: "r1",
        why: "tous les matins 表示过去重复发生的习惯性天气，用未完成过去时 pleuvait。",
      },
      {
        id: "bq3",
        hint: "décider（突然单一事件）",
        answer: ["avons décidé"],
        options: ["avons décidé", "décidions", "avions décidé", "déciderons"],
        point: "passe-compose",
        tag: "r0",
        why: "Un jour 引出具体的某一天做出的单一决定，用复合过去时 avons décidé。",
      },
      {
        id: "bq4",
        hint: "持续时间段",
        answer: ["pendant", "durant"],
        options: ["pendant", "depuis", "dans", "pour"],
        point: "temps-expr",
        tag: "r2",
        why: "表示过去已结束的一段持续时间（待了三个小时），用介词 pendant。",
      },
    ],
  },
  {
    id: "disc-b1-condition-simple",
    kind: "cloze",
    level: "B1",
    title: "第一/第二类条件句与命令式代词位置",
    subtitle: "Hypothèse réaliste/irréelle & Impératif · B1 实用交流高频结构",
    text:
      "Si tu {{0}} un stage à l'étranger l'an prochain, tu progresseras vite en français. " +
      "À ta place, si j'{{1}} plus de temps libre, je {{2}} dès maintenant un club de débat. " +
      "Ne t'inquiète pas pour l'entretien : prépare ton CV et {{3}} deux jours avant !",
    slots: [
      {
        id: "bc1",
        hint: "trouver（现实假设）",
        answer: ["trouves"],
        options: ["trouves", "trouveras", "trouverais", "trouvais"],
        point: "conditionnel",
        tag: "t0",
        why: "Si + 直陈式现在时，主句用简单将来时 progresseras 表示将来可实现的现实条件。",
      },
      {
        id: "bc2",
        hint: "avoir（与现在事实相反）",
        answer: ["avais"],
        options: ["avais", "aurais", "ai", "aie"],
        point: "conditionnel",
        tag: "r1",
        why: "与现在事实相反的假设（假如我现在有空），si 从句须用未完成过去时 avais。",
      },
      {
        id: "bc3",
        hint: "rejoindre（与现在相反主句）",
        answer: ["rejoindrais"],
        options: ["rejoindrais", "rejoindrai", "rejoins", "rejoignais"],
        point: "conditionnel",
        tag: "r1",
        why: "第二类非真实条件句的主句用条件式现在时 rejoindrais。",
      },
      {
        id: "bc4",
        hint: "envoyer le CV（肯定命令式）",
        answer: ["envoie-le"],
        options: ["envoie-le", "le envoie", "envoies-le", "envoie-lui"],
        point: "imperatif",
        tag: "r2",
        why: "第一组动词单数肯定命令式省去词尾 -s（envoie），直接宾语代词用连字符接在动词后 envoie-le。",
      },
    ],
  },
  {
    id: "disc-lexical-nominalisation",
    kind: "cloze",
    level: "B2",
    title: "名词化压缩、让步对立与因果句式转换",
    subtitle: "Nominalisation & Cause · B2 报刊摘要与议论文高分表达",
    text:
      "En raison de {{0}} soudaine des tarifs ferroviaires, plusieurs associations demandent un gel des prix. " +
      "Bien que la compagnie évoque l'inflation, les usagers jugent cette mesure injuste {{1}} les retards répétés. " +
      "Les tarifs ont augmenté, {{2}} l'offre régionale stagne, " +
      "et {{3}} cet écart, la voiture individuelle reste privilégiée en périphérie.",
    slots: [
      {
        id: "nm1",
        hint: "augmenter 名词化",
        answer: ["l'augmentation", "la hausse"],
        options: ["l'augmentation", "augmenter", "qui augmente", "l'augmenté"],
        point: "nominalisation",
        tag: "r0",
        why: "介词短语 En raison de 后接名词化短语 l'augmentation soudaine des tarifs，替代冗余从句。",
      },
      {
        id: "nm2",
        hint: "考虑到，鉴于（+ 名词）",
        answer: ["étant donné", "vu", "compte tenu de"],
        options: ["étant donné", "grâce à", "parce que", "donc"],
        point: "cause-consequence",
        tag: "r4",
        why: "étant donné + 名词短语（鉴于、考虑到接连发生的延误），语气客观严谨。",
      },
      {
        id: "nm3",
        hint: "而，与此同时（强对比）",
        answer: ["tandis que", "alors que"],
        options: ["tandis que", "donc", "puisque", "si bien que"],
        point: "opposition-concession",
        tag: "r0",
        why: "前后形成“票价上涨 vs 运力停滞”的鲜明同时对比，用 tandis que / alors que。",
      },
      {
        id: "nm4",
        hint: "由于……（引出事实原因）",
        answer: ["du fait de", "en raison de", "à cause de"],
        options: ["du fait de", "faute de", "en vue de", "à condition de"],
        point: "cause-consequence",
        tag: "r4",
        why: "du fait de cet écart 表示“由于这一落差”（faute de 意为“缺少”不合逻辑）。",
      },
    ],
  },
  // ---------- Passages 21–40: Expanded B2 Core Discourse & Error Correction ----------
  {
    id: "disc-lettre-admin",
    kind: "cloze",
    level: "B2",
    title: "正式行政陈情信：名词化与无人称诉求",
    subtitle: "Lettre formelle · Nominalisation, Impersonnel & Verbes à préposition",
    text:
      "Monsieur le Maire, nous tenons à vous alerter sur {{0}} annoncée de la médiathèque annexe de notre quartier. " +
      "{{1}} préserver un accès équitable à la culture pour les lycéens et les personnes âgées. " +
      "C'est pourquoi notre collectif vous prie {{2}} bien vouloir réexaminer ce projet avant le vote budgétaire, " +
      "dans l'attente {{3}} d'une concertation publique avec les habitants.",
    slots: [
      {
        id: "la1",
        hint: "fermer 名词化",
        answer: ["la fermeture"],
        options: ["la fermeture", "le fermement", "la fermeté", "fermer"],
        point: "nominalisation",
        tag: "r0",
        why: "动词 fermer 的名词形式为 la fermeture（关闭）；la fermeté 是形容词 ferme（坚定）的名词化，切勿混淆。",
      },
      {
        id: "la2",
        hint: "无人称结构：关键在于……",
        answer: ["Il s'agit de", "Il importe de", "Il convient de"],
        options: ["Il s'agit de", "C'est agi de", "Il s'agit que", "Elle s'agit de"],
        point: "impersonnel",
        tag: "r2",
        why: "无人称结构 Il s'agit de + 不定式 表示“问题在于 / 核心是……”，主语固定为形式主语 il。",
      },
      {
        id: "la3",
        hint: "prier qqn ... inf",
        answer: ["de"],
        options: ["de", "à", "pour", "en"],
        point: "verbes-prep",
        tag: "r1",
        why: "正式书信套语 prier quelqu'un de (bien vouloir) faire qqch 固定接介词 de。",
      },
      {
        id: "la4",
        hint: "ouvrir 名词化（搭配 de）",
        answer: ["de l'ouverture"],
        options: ["de l'ouverture", "du ouvert", "de l'ouvertement", "à l'ouverture"],
        point: "nominalisation",
        tag: "r1",
        why: "dans l'attente de + 名词化：ouvrir 的名词为 l'ouverture（开启），故为 de l'ouverture d'une concertation。",
      },
    ],
  },
  {
    id: "disc-petition-urbanisme",
    kind: "fix",
    level: "B2",
    title: "市民联署请愿书改错：名词化后缀与介词陷阱",
    subtitle: "Pétition citoyenne · 修正书信中 4 处高频构词与句法失误",
    text:
      "Suite à {{0}} de la ligne de bus n° 14, des centaines de salariés peinent à rejoindre la gare. " +
      "Il {{1}} encore trois semaines aux élus pour amender le plan de circulation. " +
      "Les signataires s'opposent fermement {{2}} cette réduction d'offre et demandent {{3}} rétablissement des horaires du matin.",
    slots: [
      {
        id: "pu1",
        shown: "le supprimage",
        hint: "supprimer 正确名词化",
        answer: ["la suppression"],
        options: ["la suppression", "le supprimage", "la supprimée", "le supprime"],
        point: "nominalisation",
        tag: "t2",
        why: "supprimer 的规范阴性名词化是 la suppression（取消），不能生造 -age 后缀。",
      },
      {
        id: "pu2",
        shown: "restent",
        hint: "无人称动词单复数",
        answer: ["reste"],
        options: ["reste", "restent", "restait", "soit resté"],
        point: "impersonnel",
        tag: "t2",
        why: "无人称句 Il reste encore trois semaines 中形式主语 il 决定动词永远用第三人称单数 reste。",
      },
      {
        id: "pu3",
        shown: "contre",
        hint: "s'opposer 固定介词",
        answer: ["à"],
        options: ["à", "contre", "de", "sur"],
        point: "verbes-prep",
        tag: "r3",
        why: "法语 s'opposer à qqch 固定接介词 à，受英语/中文影响误写 contre 是典型 B2 扣分点。",
      },
      {
        id: "pu4",
        shown: "rétablir le",
        hint: "demander + 定冠词",
        answer: ["le"],
        options: ["le", "rétablir le", "du", "un"],
        point: "nominalisation",
        tag: "r3",
        why: "后文已有 rétablissement des horaires，动词 demander 直接接定冠词 le rétablissement 即可。",
      },
    ],
  },
  {
    id: "disc-participe-verbal-1",
    kind: "cloze",
    level: "B2",
    title: "现在分词 vs 形容词性分词拼写精辨（一）",
    subtitle: "Participe présent & Adjectif verbal · convaincant / fatigant / provocant",
    text:
      "{{0}} le jury par la rigueur de ses chiffres, la chercheuse a défendu un rapport très {{1}}. " +
      "Certes, ces réunions nocturnes sont {{2}} pour les délégués, mais {{3}} un consensus inédit, elles ont permis d'éviter la grève.",
    slots: [
      {
        id: "pvx1",
        hint: "convaincre（带宾语 le jury）",
        answer: ["Convainquant", "convainquant"],
        options: ["Convainquant", "Convaincant", "Convaincues", "Convaincu"],
        point: "participe-present",
        tag: "t1",
        why: "后接直接宾语 le jury 具有动词支配力，须用现在分词拼写 Convainquant（保留 qu，不变形）。",
      },
      {
        id: "pvx2",
        hint: "令人信服的（形容词）",
        answer: ["convaincant"],
        options: ["convaincant", "convainquant", "convaincante", "convaincu"],
        point: "participe-present",
        tag: "r1",
        why: "受程度副词 très 修饰作表语/定语，是形容词性分词 un rapport très convaincant（qu 变为 c）。",
      },
      {
        id: "pvx3",
        hint: "累人的（配合阴性复数）",
        answer: ["fatigantes"],
        options: ["fatigantes", "fatiguantes", "fatiguant", "fatigant"],
        point: "participe-present",
        tag: "r1",
        why: "作 être 表语说明性质，用形容词性分词 fatigant（去掉 u），并配合阴性复数 ces réunions 为 fatigantes。",
      },
      {
        id: "pvx4",
        hint: "provoquer / obtenir（复合分词表先时原因）",
        answer: ["ayant obtenu", "ayant provoqué"],
        options: ["ayant obtenu", "obtenues", "avoir obtenu", "étant obtenu"],
        point: "participe-present",
        tag: "r2",
        why: "复合分词 ayant obtenu un consensus 表示先于主句 ont permis 完成的原因（“由于已达成共识”）。",
      },
    ],
  },
  {
    id: "disc-participe-verbal-2",
    kind: "fix",
    level: "B2",
    title: "现在分词与形容词性分词纠错（二）",
    subtitle: "Différant / Négligeant / Précédant · 彻底攻克 B2 拼写高危对子",
    text:
      "Des collectivités {{0}} leurs réseaux d'eau potable s'exposent à des fuites massives. " +
      "Pourtant, les communes {{1}} d'un budget dédié ont réduit le gaspillage dès l'année {{2}} la sécheresse, " +
      "adoptant ainsi des stratégies {{3}} selon la géographie locale.",
    slots: [
      {
        id: "pvy1",
        shown: "négligentes",
        hint: "带直接宾语 leurs réseaux",
        answer: ["négligeant"],
        options: ["négligeant", "négligentes", "négligent", "négligeantes"],
        point: "participe-present",
        tag: "t1",
        why: "后面直接支配宾语 leurs réseaux，必须是动词性的现在分词 négligeant（保留 ge，且不随名词变形）。",
      },
      {
        id: "pvy2",
        shown: "disposantes",
        hint: "现在分词不变形",
        answer: ["disposant"],
        options: ["disposant", "disposantes", "disposés", "en disposant"],
        point: "participe-present",
        tag: "t0",
        why: "disposer d'un budget 带间接宾语补语，属于现在分词，法语现在分词绝无性数变化，须改为 disposant。",
      },
      {
        id: "pvy3",
        shown: "précédente",
        hint: "后接直接宾语 la sécheresse",
        answer: ["précédant"],
        options: ["précédant", "précédente", "précédent", "précédée"],
        point: "participe-present",
        tag: "r1",
        why: "后接直接宾语 la sécheresse（“旱灾之前的那一年”），须用现在分词 précédant 而非形容词 précédente。",
      },
      {
        id: "pvy4",
        shown: "différant",
        hint: "作纯粹定语修饰阴性复数 stratégies",
        answer: ["différentes"],
        options: ["différentes", "différant", "différents", "différente"],
        point: "participe-present",
        tag: "r1",
        why: "表示“不同的策略”作性质定语（若用现在分词应为 différant de qqch），此处须用形容词性分词并配合阴性复数 différentes。",
      },
    ],
  },
  {
    id: "disc-concession-refutation",
    kind: "cloze",
    level: "B2",
    title: "议论文让步—反驳论证链（一）",
    subtitle: "Argumentation B2 · encore que, avoir beau, en dépit de & en revanche",
    text:
      "Les trottinettes en libre-service facilitent les trajets courts, {{0}} leur stationnement anarchique puisse gêner les piétons. " +
      "Les opérateurs {{1}} multiplier les rappels sur leur application, les infractions restent fréquentes. " +
      "{{2}} ces abus, une interdiction totale pénaliserait les travailleurs de nuit ; " +
      "{{3}}, la création de zones de stationnement obligatoires offre un compromis équilibré.",
    slots: [
      {
        id: "cr1",
        hint: "书面补充让步（+ 虚拟式 puisse）",
        answer: ["encore que", "bien que", "quoique"],
        options: ["encore que", "même si", "alors que", "puisque"],
        point: "opposition-concession",
        tag: "r1",
        why: "从句动词为虚拟式 puisse gêner，表示补充性修正让步（“尽管其无序停放可能会妨碍行人”），encore que（或 bien que / quoique）后接虚拟式，其余三项均接直陈式。",
      },
      {
        id: "cr2",
        hint: "avoir beau + 不定式（无论怎么……也徒劳）",
        answer: ["ont beau"],
        options: ["ont beau", "sont beaux", "aient beau", "font beau"],
        point: "opposition-concession",
        tag: "r3",
        why: "avoir beau + 不定式 意为“尽管百般努力……却依然……”，主语 Les opérateurs 对应现在时 ont beau。",
      },
      {
        id: "cr3",
        hint: "尽管（+ 名词短语）",
        answer: ["En dépit de", "Malgré", "en dépit de", "malgré"],
        options: ["En dépit de", "Bien que", "Quoique", "Sans que"],
        point: "opposition-concession",
        tag: "r2",
        why: "后接名词短语 ces abus（而非句子），须用介词短语 En dépit de（或 Malgré），不能用连词 Bien que / Quoique。",
      },
      {
        id: "cr4",
        hint: "相反，反之（引出替代正面方案）",
        answer: ["en revanche", "par contre", "au contraire"],
        options: ["en revanche", "en effet", "par conséquent", "d'ailleurs"],
        point: "connecteurs",
        tag: "r2",
        why: "否定一刀切禁令后引出建设性的反面替代方案，正式议论文首选 en revanche（相反、另一方面）。",
      },
    ],
  },
  {
    id: "disc-concession-tout-quelque",
    kind: "fix",
    level: "B2",
    title: "高阶让步结构改错：quel que soit、tout … que 与 avoir beau",
    subtitle: "Concession avancée · 攻克 B2+/C1 让步句四大经典失分点",
    text:
      "{{0}} les arguments avancés par les promoteurs, l'artificialisation des terres agricoles inquiète les écologistes. " +
      "Tout innovant que {{1}} ce complexe commercial, il détournera la clientèle des commerces de centre-ville. " +
      "D'ailleurs, la municipalité a beau promettre des navettes gratuites, {{2}} le parking géant encouragera l'usage de la voiture, " +
      "{{3}} la proximité immédiate de la gare régionale.",
    slots: [
      {
        id: "tq1",
        shown: "Quelque soit",
        hint: "配合阳性复数主语 les arguments",
        answer: ["Quels que soient"],
        options: ["Quels que soient", "Quelque soit", "Quel que soit", "Quelles que soient"],
        point: "opposition-concession",
        tag: "t3",
        why: "quel que soit 必须分写为两词，且 quel 随主语 les arguments（阳性复数）配合，être 变位为 soient → Quels que soient。",
      },
      {
        id: "tq2",
        shown: "sera",
        hint: "Tout + adj + que + 虚拟式",
        answer: ["soit"],
        options: ["soit", "sera", "serait", "été"],
        point: "opposition-concession",
        tag: "r4",
        why: "Tout / Quelque + 形容词 + que 引导让步从句（“无论多么创新”），现代标准书面语用虚拟式 soit。",
      },
      {
        id: "tq3",
        shown: "mais",
        hint: "avoir beau 后禁止冗余连词",
        answer: ["pourtant", "néanmoins", "toutefois"],
        options: ["pourtant", "mais", "bien que", "car"],
        point: "opposition-concession",
        tag: "t2",
        why: "法语习惯：avoir beau 分句本身已包含转折关系，第二分句开头严禁再用并列连词 mais（可用逗号直接相连或加副词 pourtant/néanmoins）。",
      },
      {
        id: "tq4",
        shown: "malgré que",
        hint: "后接名词短语 la proximité",
        answer: ["malgré", "en dépit de"],
        options: ["malgré", "malgré que", "bien que", "quoique"],
        point: "connecteurs",
        tag: "t0",
        why: "后接名词短语 la proximité，直接用介词 malgré（或 en dépit de），绝不可写 malgré que + 名词。",
      },
    ],
  },
  {
    id: "disc-subj-semble-superlatif",
    kind: "cloze",
    level: "B2",
    title: "语式精微辨析：il semble que、最高级与疑问思维动词",
    subtitle: "Subjonctif présent / passé vs Indicatif · B2 考官最爱的四大分界点",
    text:
      "Je doute fort que la direction {{0}} toute l'ampleur du malaise social avant la grève du mois dernier. " +
      "Aujourd'hui, il semble que le dialogue {{1}} enfin reprendre, alors qu'il me semble que le calendrier proposé {{2}} encore trop flou. " +
      "Pensez-vous vraiment que cet accord soit le seul compromis qui {{3}} satisfaire les deux parties ?",
    slots: [
      {
        id: "ss1",
        hint: "mesurer（先于上月罢工完成）",
        answer: ["ait mesuré"],
        options: ["ait mesuré", "a mesuré", "mesure", "avait mesuré"],
        point: "subj-passe",
        tag: "r1",
        why: "douter que 要求虚拟式，且“衡量事态严重性”发生在过去时间点 avant la grève du mois dernier，须用虚拟式过去时 ait mesuré。",
      },
      {
        id: "ss2",
        hint: "pouvoir（il semble que 后）",
        answer: ["puisse"],
        options: ["puisse", "peut", "pourra", "pouvait"],
        point: "subj-indicatif",
        tag: "r1",
        why: "不带间接宾语的 il semble que 表示主观推测/不确定印象，规范书面语常接虚拟式 puisse。",
      },
      {
        id: "ss3",
        hint: "être / rester（il me semble que 后）",
        answer: ["est", "reste", "demeure"],
        options: ["est", "soit", "fût", "ait été"],
        point: "subj-indicatif",
        tag: "r0",
        why: "带间接宾语代词的 il me semble que 相当于 je pense que（个人肯定判断），后接直陈式 est。",
      },
      {
        id: "ss4",
        hint: "pouvoir（le seul ... qui 后）",
        answer: ["puisse"],
        options: ["puisse", "peut", "pourrait", "pourra"],
        point: "subj-indicatif",
        tag: "r1",
        why: "先行词受唯一定语 le seul（或最高级 le premier / le meilleur）修饰且表达主观判断时，关系从句用虚拟式 puisse。",
      },
    ],
  },
  {
    id: "disc-subj-passe-contraste",
    kind: "fix",
    level: "B2",
    title: "虚拟式过去时与直陈式陷阱改错",
    subtitle: "espérer que, après que, négation de penser & subjonctif passé",
    text:
      "Les associations espèrent vivement que le ministère {{0}} les crédits promis dès janvier prochain. " +
      "Toutefois, personne ne pense que les travaux {{1}} s'achever avant l'hiver. " +
      "Nous regrettons que l'entreprise {{2}} ses sous-traitants à temps l'an passé, " +
      "surtout après que la mairie {{3}} une avance exceptionnelle.",
    slots: [
      {
        id: "sp1",
        shown: "débloque",
        hint: "espérer que + 将来动作",
        answer: ["débloquera"],
        options: ["débloquera", "débloque", "ait débloqué", "débloquerait"],
        point: "subj-indicatif",
        tag: "t0",
        why: "espérer que 虽然语义含“希望”，但在法语肯定句中固定接直陈式（dès janvier prochain 用简单将来时 débloquera）。",
      },
      {
        id: "sp2",
        shown: "peuvent",
        hint: "否定思维动词 personne ne pense que",
        answer: ["puissent"],
        options: ["puissent", "peuvent", "pourront", "pouvaient"],
        point: "subj-indicatif",
        tag: "r2",
        why: "personne ne pense que 为否定观点句，确信度消失，从句必须改为虚拟式 puissent。",
      },
      {
        id: "sp3",
        shown: "n'a pas payé",
        hint: "regretter que + 去年已发生动作",
        answer: ["n'ait pas payé"],
        options: ["n'ait pas payé", "n'a pas payé", "ne paie pas", "n'avait pas payé"],
        point: "subj-passe",
        tag: "r1",
        why: "regretter que 表达遗憾情感触发虚拟式，且 l'an passé 指向过去完成事件，须用虚拟式过去时 n'ait pas payé。",
      },
      {
        id: "sp4",
        shown: "ait versé",
        hint: "après que 规范语式",
        answer: ["a versé", "avait versé"],
        options: ["a versé", "ait versé", "verse", "verserait"],
        point: "subj-indicatif",
        tag: "t1",
        why: "考试语法规范中，après que 表示既成事实，必须用直陈式（复合过去时 a versé），不能类推 avant que 而误用虚拟式。",
      },
    ],
  },
  {
    id: "disc-cond-mixte",
    kind: "cloze",
    level: "B2",
    title: "混合时间假设句与条件式过去时",
    subtitle: "Hypothèses mixtes · 过去原因对今日后果的跨时态推演",
    text:
      "Si la municipalité {{0}} des pistes cyclables sécurisées dès 2015, le centre-ville ne {{1}} pas aussi embouteillé aujourd'hui. " +
      "De même, les commerçants {{2}} moins de chiffre d'affaires l'hiver dernier. " +
      "{{3}} la pluie persisterait demain lors de l'inauguration, la conférence se tiendrait sous le chapiteau.",
    slots: [
      {
        id: "cmix1",
        hint: "aménager（2015 年未发生的假设）",
        answer: ["avait aménagé"],
        options: ["avait aménagé", "aménageait", "aurait aménagé", "a aménagé"],
        point: "cond-passe",
        tag: "r4",
        why: "dès 2015 标明与过去事实相反的条件，si 从句用愈过去时 avait aménagé。",
      },
      {
        id: "cmix2",
        hint: "être（指向 aujourd'hui 的当前结果）",
        answer: ["serait"],
        options: ["serait", "aurait été", "sera", "était"],
        point: "cond-passe",
        tag: "r4",
        why: "混合假设句精髓：条件在过去（2015），但结果落在现在（aujourd'hui），主句须用条件式现在时 serait 而非条件式过去时！",
      },
      {
        id: "cmix3",
        hint: "perdre（指向 l'hiver dernier 的过去结果）",
        answer: ["auraient perdu"],
        options: ["auraient perdu", "perdraient", "avaient perdu", "ont perdu"],
        point: "cond-passe",
        tag: "r1",
        why: "l'hiver dernier 属于过去时间段内的非真实结果，用条件式过去时 auraient perdu。",
      },
      {
        id: "cmix4",
        hint: "万一（后接条件式 persisterait）",
        answer: ["Au cas où", "Dans le cas où", "au cas où"],
        options: ["Au cas où", "Si", "Bien que", "À condition que"],
        point: "cond-passe",
        tag: "t3",
        why: "从句动词已是条件式 persisterait，引导“万一……”且后接条件式的固定连词短语是 Au cas où（Si 后绝不接条件式）。",
      },
    ],
  },
  {
    id: "disc-cond-journalistique",
    kind: "cloze",
    level: "B2",
    title: "报刊新闻条件式：未经证实的指控与传闻",
    subtitle: "Conditionnel de l'information incertaine · 媒体客观免责笔法",
    text:
      "Selon nos sources judiciaires, un ancien dirigeant {{0}} plusieurs millions d'euros de subventions entre 2020 et 2022. " +
      "Deux filiales étrangères {{1}} également été utilisées pour dissimuler ces transferts. " +
      "À l'heure actuelle, des négociations confidentielles {{2}} en cours avec le parquet financier, " +
      "tandis qu'il paraît que le conseil d'administration {{3}} déjà nommé un auditeur externe.",
    slots: [
      {
        id: "cj1",
        hint: "détourner（过往未经证实行为）",
        answer: ["aurait détourné"],
        options: ["aurait détourné", "détournerait", "avait détourné", "a détourné"],
        point: "cond-incertain",
        tag: "r1",
        why: "Selon nos sources 提示消息尚未经法院终审确认，且发生在 2020–2022 过去时段，用新闻条件式过去时 aurait détourné。",
      },
      {
        id: "cj2",
        hint: "avoir（被动条件式过去时助动词）",
        answer: ["auraient"],
        options: ["auraient", "seraient", "avaient", "ont"],
        point: "cond-incertain",
        tag: "r1",
        why: "被动语态条件式过去时构成是 auraient été utilisées（助动词 avoir 的条件式 + été + 配合的过去分词）。",
      },
      {
        id: "cj3",
        hint: "être（当前未经官方证实的动态）",
        answer: ["seraient"],
        options: ["seraient", "auraient été", "soient", "sont"],
        point: "cond-incertain",
        tag: "r0",
        why: "À l'heure actuelle 指向当前传闻中的状态，用条件式现在时 seraient en cours。",
      },
      {
        id: "cj4",
        hint: "avoir（il paraît que 后语式）",
        answer: ["a"],
        options: ["a", "aurait", "ait", "eût"],
        point: "cond-incertain",
        tag: "t0",
        why: "易错陷阱：il paraît que 本身已表达“据传闻”，后面正常接直陈式（a déjà nommé），一般不再叠加条件式或虚拟式。",
      },
    ],
  },
  {
    id: "disc-futur-anterieur-admin",
    kind: "cloze",
    level: "B2",
    title: "先将来时在市政通告与时间从句中的运用",
    subtitle: "Futur antérieur & Antériorité · dès que / une fois que / tant que",
    text:
      "La circulation piétonne sera rétablie dès que la mairie {{0}} l'arrêté de sécurité. " +
      "Une fois que les travaux de voirie {{1}} fin, les commerçants pourront réinstaller leurs terrasses. " +
      "En revanche, tant que la commission technique {{2}} ses conclusions, l'accès au pont restera fermé ; " +
      "d'ici vendredi soir, les ingénieurs {{3}} l'ensemble des piliers.",
    slots: [
      {
        id: "fa1",
        hint: "publier（先于将来主句完成）",
        answer: ["aura publié"],
        options: ["aura publié", "publiera", "a publié", "ait publié"],
        point: "futur-anterieur",
        tag: "r1",
        why: "dès que 引导将来时间从句，发布法令先于恢复通行发生，须用先将来时 aura publié。",
      },
      {
        id: "fa2",
        hint: "prendre（prendre fin 先将来时）",
        answer: ["auront pris"],
        options: ["auront pris", "prendront", "seront pris", "aient pris"],
        point: "futur-anterieur",
        tag: "r1",
        why: "une fois que les travaux auront pris fin（一旦道路工程结束），先完成动作使用先将来时 auront pris。",
      },
      {
        id: "fa3",
        hint: "ne pas rendre（否定先将来时）",
        answer: ["n'aura pas rendu"],
        options: ["n'aura pas rendu", "ne rend pas", "n'ait pas rendu", "ne rendrait pas"],
        point: "anteriorite",
        tag: "r4",
        why: "tant que（只要尚未……）搭配主句简单将来时 restera，从句强调“在提交结论之前”，用先将来时否定式 n'aura pas rendu。",
      },
      {
        id: "fa4",
        hint: "vérifier（到周五晚为止将已核查完毕）",
        answer: ["auront vérifié"],
        options: ["auront vérifié", "vérifient", "avaient vérifié", "vérifieraient"],
        point: "futur-anterieur",
        tag: "r2",
        why: "d'ici vendredi soir（到周五晚之前）标明将来某一截止时刻前已完成的动作，独立主句用先将来时 auront vérifié。",
      },
    ],
  },
  {
    id: "disc-relatifs-composes-debat",
    kind: "cloze",
    level: "B2",
    title: "复合关系代词深度运用：auquel / duquel / sans lesquels / ce dont",
    subtitle: "Pronoms relatifs composés · B2 书面长难句精准粘合剂",
    text:
      "Le programme européen {{0}} notre université participe finance la mobilité verte. " +
      "C'est une transition ambitieuse {{1}} de nombreux laboratoires se sont engagés, " +
      "mais qui exige des financements stables {{2}} les chercheurs ne sauraient mener leurs expériences à terme. " +
      "Or, la lourdeur administrative reste précisément {{3}} les équipes se plaignent le plus.",
    slots: [
      {
        id: "rc1",
        hint: "participer à ce programme",
        answer: ["auquel"],
        options: ["auquel", "duquel", "lequel", "dont"],
        point: "relatifs-composes",
        tag: "r1",
        why: "participer à qqch 带介词 à，先行词 Le programme européen 为阳性单数，à + lequel 缩合为 auquel。",
      },
      {
        id: "rc2",
        hint: "s'engager pour / dans cette transition",
        answer: ["pour laquelle", "dans laquelle"],
        options: ["pour laquelle", "laquelle", "dont", "à qui"],
        point: "relatifs-composes",
        tag: "r0",
        why: "介词 pour / dans 后接指物先行词 une transition（阴性单数），须用复合关系代词 pour laquelle。",
      },
      {
        id: "rc3",
        hint: "sans ces financements（阳性复数）",
        answer: ["sans lesquels"],
        options: ["sans lesquels", "sans qui", "desquels", "sans quoi"],
        point: "relatifs-composes",
        tag: "r0",
        why: "介词 sans 修饰阳性复数先行词 des financements stables，用 sans lesquels（“没有这些经费”）。",
      },
      {
        id: "rc4",
        hint: "se plaindre de qqch（无具体名词先行词）",
        answer: ["ce dont"],
        options: ["ce dont", "ce que", "ce à quoi", "dont"],
        point: "relatifs-composes",
        tag: "r2",
        why: "se plaindre de qqch 带介词 de，前面作表语补足语无先行名词，须加中性指示代词 ce → ce dont。",
      },
    ],
  },
  {
    id: "disc-relatifs-composes-fix",
    kind: "fix",
    level: "B2",
    title: "复合关系代词与介词缩合病句精改",
    subtitle: "Correction des relatifs · 扫除 à lequel、près dont 与 parmi qui 等失误",
    text:
      "Le parc naturel {{0}} la commune a tracé cette piste cyclable abrite des espèces protégées. " +
      "Les associations ont réuni vingt experts, {{1}} figurent trois hydrologues réputés. " +
      "Voici le règlement {{2}} chaque visiteur doit se conformer dès l'entrée, " +
      "ainsi que les sanctions {{3}} s'exposent les contrevenants.",
    slots: [
      {
        id: "rcf1",
        shown: "près dont",
        hint: "près de + 复合关系代词",
        answer: ["près duquel", "autour duquel"],
        options: ["près duquel", "près dont", "près de qui", "dont près"],
        point: "relatifs-composes",
        tag: "t0",
        why: "复合介词短语 près de / à côté de / au sujet de 后绝不能用 dont，须将 de + lequel 缩合为 près duquel。",
      },
      {
        id: "rcf2",
        shown: "parmi qui",
        hint: "parmi + 复数关系代词",
        answer: ["parmi lesquels"],
        options: ["parmi lesquels", "parmi qui", "entre dont", "dans lesquels"],
        point: "relatifs-composes",
        tag: "t4",
        why: "介词 parmi 表达“在……之中”时，即使先行词指人（vingt experts），现代规范书面语也一律优先用 parmi lesquels。",
      },
      {
        id: "rcf3",
        shown: "à lequel",
        hint: "à + lequel 强制缩合",
        answer: ["auquel"],
        options: ["auquel", "à lequel", "duquel", "où"],
        point: "relatifs-composes",
        tag: "t1",
        why: "se conformer à qqch 中 à 遇到阳性单数 lequel 必须强制缩合为 auquel，写成 à lequel 属于严重语法错误。",
      },
      {
        id: "rcf4",
        shown: "auxquels",
        hint: "配合阴性复数 les sanctions",
        answer: ["auxquelles"],
        options: ["auxquelles", "auxquels", "desquelles", "à lesquelles"],
        point: "relatifs-composes",
        tag: "r1",
        why: "s'exposer à des sanctions 中先行词 sanctions 为阴性复数，à + lesquelles 须缩合为阴性复数 auxquelles。",
      },
    ],
  },
  {
    id: "disc-accord-pp-pieges",
    kind: "cloze",
    level: "B2",
    title: "过去分词配合四大考场陷阱：前置 COD、en 与 faire + inf",
    subtitle: "Accord du participe passé · 精准区分何时必须配合、何时严禁配合",
    text:
      "Les mesures d'urgence que la préfète a {{0}} hier soir sont entrées en vigueur à l'aube. " +
      "Quant aux erreurs de prévision, les services météorologiques en ont {{1}} plusieurs lors du dernier épisode orageux. " +
      "Les ingénieurs que le ministère a {{2}} venir sur place ont inspecté les digues " +
      "et évalué les trois semaines qu'il a {{3}} pour consolider les berges.",
    slots: [
      {
        id: "ap1",
        hint: "prendre（que 指代 Les mesures）",
        answer: ["prises"],
        options: ["prises", "pris", "prise", "prit"],
        point: "accord-pp",
        tag: "r1",
        why: "助动词 avoir 下，直接宾语 que 指代阴性复数 Les mesures d'urgence 且置于动词前，过去分词须配合为 prises。",
      },
      {
        id: "ap2",
        hint: "commettre（代词 en 作宾语）",
        answer: ["commis"],
        options: ["commis", "commises", "commise", "commet"],
        point: "accord-pp",
        tag: "t0",
        why: "黄金铁律：代词 en 作宾语前置时，过去分词一律保持阳性单数不变形（en ont commis），绝不随 erreurs 配合！",
      },
      {
        id: "ap3",
        hint: "faire（faire + 不定式 venir）",
        answer: ["fait"],
        options: ["fait", "faits", "faites", "faite"],
        point: "accord-pp",
        tag: "t1",
        why: "faire + 不定式结构（a fait venir）中过去分词 fait 永远不变形，因为前置 que 是整组使役结构的受事而非单独 fait 的宾语。",
      },
      {
        id: "ap4",
        hint: "falloir（无人称动词）",
        answer: ["fallu"],
        options: ["fallu", "fallues", "fallus", "fallue"],
        point: "accord-pp",
        tag: "r1",
        why: "无人称结构 qu'il a fallu 中 il 为形式主语，过去分词 fallu 永远不变形。",
      },
    ],
  },
  {
    id: "disc-pronominaux-accord",
    kind: "fix",
    level: "B2",
    title: "代动词过去分词配合精析：se succédé / parlé vs se réunies",
    subtitle: "Verbes pronominaux au passé · 直宾与间宾决定配合生死",
    text:
      "Plusieurs générations de chercheurs se sont {{0}} dans ce laboratoire marin depuis sa fondation. " +
      "Mardi dernier, les directrices régionales se sont {{1}} à Brest, " +
      "où elles se sont longuement {{2}} avant la conférence. " +
      "Elles ont ensuite publié les recommandations qu'elles s'étaient {{3}} de rédiger.",
    slots: [
      {
        id: "pa1",
        shown: "succédées",
        hint: "succéder à qqn（间宾不配合）",
        answer: ["succédé"],
        options: ["succédé", "succédées", "succédés", "succédée"],
        point: "accord-pp",
        tag: "t2",
        why: "succéder à qqn 接间接宾语（à），因此 se sont succédé 中 se 是间宾 COI，过去分词绝不配合，须改为 succédé！",
      },
      {
        id: "pa2",
        shown: "réuni",
        hint: "réunir qqn（直宾配合主语）",
        answer: ["réunies"],
        options: ["réunies", "réuni", "réunis", "réunie"],
        point: "pronominaux",
        tag: "t1",
        why: "réunir quelqu'un 为直接及物，se 作直接宾语指代阴性复数主语 les directrices，须配合为 se sont réunies。",
      },
      {
        id: "pa3",
        shown: "parlées",
        hint: "parler à qqn（间宾不配合）",
        answer: ["parlé"],
        options: ["parlé", "parlées", "parlés", "parlée"],
        point: "pronominaux",
        tag: "t1",
        why: "parler à quelqu'un 带介词 à，se 为间接宾语（彼此交谈），过去分词保持阳性单数不变形 parlé。",
      },
      {
        id: "pa4",
        shown: "promis",
        hint: "前置直接宾语 que 指代 les recommandations",
        answer: ["promises"],
        options: ["promises", "promis", "promise", "promirent"],
        point: "accord-pp",
        tag: "r2",
        why: "se promettre qqch 中 se 是间宾（向自己承诺），但直接宾语 que（指代阴性复数 les recommandations）位于动词之前，故与前置 COD 配合为 promises！",
      },
    ],
  },
  {
    id: "disc-indirect-deixis",
    kind: "cloze",
    level: "B2",
    title: "过去间接引语与时间坐标移位",
    subtitle: "Discours indirect au passé · la veille / le lendemain / concordance",
    text:
      "Lors du point presse de jeudi, le porte-parole a rappelé que le ministre {{0}} les syndicats {{1}} " +
      "et leur avait promis qu'il {{2}} devant le Parlement {{3}} matin.",
    slots: [
      {
        id: "di1",
        hint: "rencontrer（周四回顾周三动作）",
        answer: ["avait rencontré"],
        options: ["avait rencontré", "a rencontré", "rencontrait", "rencontrerait"],
        point: "discours-indirect",
        tag: "r0",
        why: "主句转述动词 a rappelé 为过去时，原话中的复合过去时（已会见）在过去转述中退后一格变为愈过去时 avait rencontré。",
      },
      {
        id: "di2",
        hint: "直接引语 hier 在过去转述中的对应词",
        answer: ["la veille"],
        options: ["la veille", "hier", "avant-hier", "ce jour-là"],
        point: "discours-indirect",
        tag: "r2",
        why: "过去视角下的间接引语中，时间词 hier（昨天）必须转换为参照点前一天 la veille。",
      },
      {
        id: "di3",
        hint: "intervenir（相对于过去的将来承诺）",
        answer: ["interviendrait"],
        options: ["interviendrait", "interviendra", "est intervenu", "intervienne"],
        point: "discours-indirect",
        tag: "r0",
        why: "avait promis que 引出过去作出的将来承诺，简单将来时须转为条件式现在时（过去将来时）interviendrait。",
      },
      {
        id: "di4",
        hint: "直接引语 demain 在过去转述中的对应词",
        answer: ["le lendemain", "dès le lendemain"],
        options: ["le lendemain", "demain", "après-demain", "aujourd'hui"],
        point: "discours-indirect",
        tag: "r2",
        why: "过去视角下的间接引语中，demain matin 须转换为 le lendemain matin（次日早晨）。",
      },
    ],
  },
  {
    id: "disc-indirect-fix",
    kind: "fix",
    level: "B2",
    title: "间接问句与命令转述高频病句改错",
    subtitle: "Interrogation indirecte · 彻底戒除 est-ce que、倒装与时态脱节",
    text:
      "La journaliste a demandé au recteur {{0}} justifiait la fermeture de ces deux classes. " +
      "Elle voulait aussi savoir {{1}} de nouveaux enseignants seraient recrutés à la rentrée suivante. " +
      "Le recteur a répondu qu'une enquête {{2}} rendre ses conclusions sous peu " +
      "et a conseillé aux parents {{3}} s'inquiéter prématurément.",
    slots: [
      {
        id: "dif1",
        shown: "qu'est-ce qui",
        hint: "物作主语的间接问句",
        answer: ["ce qui"],
        options: ["ce qui", "qu'est-ce qui", "ce que", "quoi"],
        point: "discours-indirect",
        tag: "t1",
        why: "直接问句 Qu'est-ce qui justifie... 变为间接问句时，严禁保留 est-ce qui，必须改为 ce qui（作主语）。",
      },
      {
        id: "dif2",
        shown: "est-ce que",
        hint: "一般疑问句转间接引语",
        answer: ["si"],
        options: ["si", "est-ce que", "que", "quand est-ce que"],
        point: "discours-indirect",
        tag: "r1",
        why: "是否型一般疑问句转为间接问句时用连词 si（“是否”），绝不可用 est-ce que。",
      },
      {
        id: "dif3",
        shown: "va",
        hint: "近将来时在过去转述中的变化",
        answer: ["allait"],
        options: ["allait", "va", "irait", "aille"],
        point: "discours-indirect",
        tag: "t4",
        why: "主句动词为过去时 a répondu，直接引语中的近将来时 va rendre 须退为未完成过去时 allait rendre。",
      },
      {
        id: "dif4",
        shown: "qu'ils ne pas",
        hint: "否定命令式转间接引语（de + 否定不定式）",
        answer: ["de ne pas"],
        options: ["de ne pas", "qu'ils ne pas", "à ne pas", "ne pas de"],
        point: "discours-indirect",
        tag: "r1",
        why: "conseiller / demander à qqn + 否定命令转述用 de ne pas + 不定式（de ne pas s'inquiéter），ne pas 连在一起置于不定式前。",
      },
    ],
  },
  {
    id: "disc-mise-en-relief-passif",
    kind: "cloze",
    level: "B2",
    title: "强调句型与代动被动在社论中的组合运用",
    subtitle: "Mise en relief & Passif pronominal · 增强议论文句式张力",
    text:
      "{{0}} préoccupe le plus les médecins ruraux, c'est le manque de remplaçants durant l'été. " +
      "C'est précisément {{1}} cette pénurie que plusieurs maisons de santé pluridisciplinaires ont vu le jour. " +
      "Dans ces structures, les tâches administratives {{2}} désormais entre coordinateurs, " +
      "permettant aux praticiens de mieux {{3}} entendre auprès des agences régionales.",
    slots: [
      {
        id: "mr1",
        hint: "强调主语（……的事情，是……）",
        answer: ["Ce qui", "ce qui"],
        options: ["Ce qui", "Ce que", "Ce dont", "C'est qui"],
        point: "mise-en-relief",
        tag: "r2",
        why: "句首从句缺主语（préoccupe le plus...），用 Ce qui ..., c'est ... 结构聚焦核心痛点。",
      },
      {
        id: "mr2",
        hint: "为应对……（搭配后面 que 强调状语）",
        answer: ["face à", "pour pallier", "contre"],
        options: ["face à", "à cause que", "malgré que", "dont"],
        point: "mise-en-relief",
        tag: "r1",
        why: "C'est + 介词短语（face à cette pénurie）+ que 构成介词成分强调句（注意后面只能接 que，不接 où 或 dont）。",
      },
      {
        id: "mr3",
        hint: "partager（代动式表被动）",
        answer: ["se partagent", "se répartissent"],
        options: ["se partagent", "partagent", "ont partagé", "se partager"],
        point: "passif-autres",
        tag: "r1",
        why: "无生命主语 les tâches administratives 搭配代动词 se partagent（被分担/共享），是地道法语代动式被动。",
      },
      {
        id: "mr4",
        hint: "se faire + inf（使自己的声音被听到）",
        answer: ["se faire"],
        options: ["se faire", "se rendre", "être fait", "faire"],
        point: "passif-autres",
        tag: "r2",
        why: "se faire entendre（让别人听到自己的诉求/发声）是 B2 议论文高频 se faire + 不定式固定表达。",
      },
    ],
  },
  {
    id: "disc-expletif-negation",
    kind: "cloze",
    level: "B2",
    title: "赘词 ne（ne explétif）与无 pas 高阶书面否定",
    subtitle: "Négation soutenue & Restriction · 读懂并写出地道C1级衔接",
    text:
      "Les économistes craignent que la flambée des loyers {{0}} freine durablement la mobilité étudiante. " +
      "En effet, l'écart entre les bourses et le coût de la vie {{1}} cesse de se creuser depuis trois ans. " +
      "À moins qu'un plan de construction {{2}} voté d'urgence, {{3}} les universités ni les collectivités ne pourront loger tous les boursiers.",
    slots: [
      {
        id: "ex1",
        hint: "craindre que 后的虚词（肯定含义“担心会阻碍”）",
        answer: ["ne"],
        options: ["ne", "ne pas", "n'en", "pas"],
        point: "negation-nuances",
        tag: "r3",
        why: "craindre que + 虚拟式后常加无实际否定意义的赘词 ne（ne explétif），意为“担心租金暴涨会阻碍……”，若加 pas 则意思全反！",
      },
      {
        id: "ex2",
        hint: "cesser 单用 ne 否定（不断扩大）",
        answer: ["ne"],
        options: ["ne", "ne pas", "rien", "aucun"],
        point: "negation-nuances",
        tag: "r4",
        why: "cesser、oser、pouvoir、savoir 四个动词在正式书面语中可单用 ne（不加 pas）接不定式表示否定：ne cesse de se creuser（不断拉大）。",
      },
      {
        id: "ex3",
        hint: "à moins que + 赘词 ne + 被动虚拟式",
        answer: ["ne soit", "soit"],
        options: ["ne soit", "sera", "n'est pas", "serait"],
        point: "negation-nuances",
        tag: "r3",
        why: "à moins que（除非）固定要求虚拟式且常带赘词 ne → ne soit voté。",
      },
      {
        id: "ex4",
        hint: "既不……也不……（并列主语）",
        answer: ["ni"],
        options: ["ni", "pas", "sans", "aucun"],
        point: "restriction",
        tag: "r2",
        why: "ni A ni B + ne + 动词（不再加 pas）构成双主语并列否定：“无论是大学还是地方政府都无法……”。",
      },
    ],
  },
  {
    id: "disc-double-pronoms-proportion",
    kind: "fix",
    level: "B2",
    title: "双宾语代词顺序与比例主谓配合改错",
    subtitle: "Double pronoms, Proportion & Comparaison · 精准扫除高阶语法盲区",
    text:
      "Dès réception du rapport financier, le trésorier {{0}} transmis aux membres du bureau. " +
      "En assemblée générale, la plupart des adhérents {{1}} approuvé les orientations budgétaires, " +
      "tandis qu'un tiers des votants {{2}} opposé à la hausse de la cotisation. " +
      "Ce refus paraît {{3}} compréhensible que l'inflation pèse déjà sur les ménages.",
    slots: [
      {
        id: "dp1",
        shown: "leur l'a",
        hint: "双第三人称代词顺序（le + leur）",
        answer: ["le leur a"],
        options: ["le leur a", "leur l'a", "les leur a", "lui l'a"],
        point: "double-pronoms",
        tag: "t0",
        why: "两个第三人称宾语代词连用时，直接宾语 le / la / les 永远排在间接宾语 lui / leur 之前 → le leur a transmis。",
      },
      {
        id: "dp2",
        shown: "a",
        hint: "la plupart de + 复数名词后的动词配合",
        answer: ["ont"],
        options: ["ont", "a", "ait", "avaient"],
        point: "proportion",
        tag: "t0",
        why: "法语铁律：la plupart（或 la plupart des + 复数名词）作主语时，动词一律按复数配合 → ont approuvé！",
      },
      {
        id: "dp3",
        shown: "s'en est",
        hint: "s'opposer à qqch 代词替换",
        answer: ["s'y est"],
        options: ["s'y est", "s'en est", "se l'est", "s'est y"],
        point: "double-pronoms",
        tag: "r2",
        why: "s'opposer à la hausse 带介词 à 接事物，应用代词 y 而非 en，置于自反代词后、助动词前 → s'y est opposé。",
      },
      {
        id: "dp4",
        shown: "autant plus",
        hint: "越发……因为……（缺介词 d'）",
        answer: ["d'autant plus"],
        options: ["d'autant plus", "autant plus", "plus autant", "d'aussi plus"],
        point: "comparaison-nuances",
        tag: "r2",
        why: "表达“正因为……而越发……”固定结构为 d'autant plus + 形容词 + que，不能漏写开头的 d'。",
      },
    ],
  },
];
