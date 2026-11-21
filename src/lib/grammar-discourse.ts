/**
 * Discourse-level multi-clause grammar exercises (语篇级/跨句时态与改错综合练习).
 * Trains concordance des temps, subjonctif/indicatif, hypothèse, relatifs composés,
 * gérondif/participe présent and error correction inside continuous paragraphs.
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
        why: "“Pendant des mois”描述发现告示之前的持续背景状态，用未完成过去时 attendaient。",
      },
      {
        id: "r2",
        hint: "déjà valider",
        answer: ["avait déjà validé"],
        options: ["avait déjà validé", "a déjà validé", "validait déjà", "aura déjà validé"],
        point: "plus-que-parfait",
        why: "“la semaine précédente”发生在“昨天发现”（ont découvert）之前，属于过去的过去，用愈过去时 avait déjà validé。",
      },
      {
        id: "r3",
        hint: "commencer",
        answer: ["commenceraient"],
        options: ["commenceraient", "commenceront", "commençaient", "ont commencé"],
        point: "discours-indirect",
        why: "主句转述动词 a précisé 为过去时，从句表示相对于昨天的将来动作，间接引语中须用过去将来时（条件式形态）commenceraient。",
      },
      {
        id: "r4",
        hint: "donner",
        answer: ["donnent"],
        options: ["donnent", "donneront", "donnaient", "ont donné"],
        point: "subjonctif",
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
        why: "Bien que 要求虚拟式，且 l'an dernier 表示动作已在主句之前完成，须用虚拟式过去时 ait pris。",
      },
      {
        id: "c2",
        hint: "être",
        answer: ["soient"],
        options: ["soient", "sont", "seront", "étaient"],
        point: "opposition-concession",
        why: "Quoique（尽管）引导让步状语从句，后接虚拟式现在时 soient。",
      },
      {
        id: "c3",
        hint: "devoir",
        answer: ["doit"],
        options: ["doit", "doive", "devrait", "ait dû"],
        point: "subj-indicatif",
        why: "Il est évident que 表示确定事实（非怀疑/愿望），用直陈式 doit。",
      },
      {
        id: "c4",
        hint: "se dégrader",
        answer: ["se dégrade"],
        options: ["se dégrade", "se dégradera", "s'est dégradée", "se dégradait"],
        point: "anteriorite",
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
        why: "il y a dix ans 表示与过去事实相反的假设，si 从句用愈过去时 avait investi。",
      },
      {
        id: "h2",
        hint: "ne pas fermer",
        answer: ["n'auraient pas fermé"],
        options: ["n'auraient pas fermé", "ne fermeraient pas", "n'ont pas fermé", "ne fermaient pas"],
        point: "cond-passe",
        why: "en 2020 指向过去已发生的结果，主句用条件式过去时 n'auraient pas fermé。",
      },
      {
        id: "h3",
        hint: "vouloir",
        answer: ["voulaient"],
        options: ["voulaient", "veulent", "voudraient", "ont voulu"],
        point: "conditionnel",
        why: "même si 表示非真实假设时从句用未完成过去时 voulaient（不可用 conditionnel）。",
      },
      {
        id: "h4",
        hint: "rester",
        answer: ["resteraient"],
        options: ["resteraient", "restent", "resteront", "sont restés"],
        point: "conditionnel",
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
        why: "主句为过去时 a annoncé que，从句将来的计划转为过去将来时 lancerait。",
      },
      {
        id: "d2",
        hint: "关系代词",
        answer: ["dont"],
        options: ["dont", "que", "lequel", "où"],
        point: "relatifs",
        why: "dépendre de qqch 带介词 de，先行词 le projet 由关系代词 dont 替代。",
      },
      {
        id: "d3",
        hint: "adopter",
        answer: ["aura adopté"],
        options: ["aura adopté", "adoptera", "ait adopté", "avait adopté"],
        point: "futur-anterieur",
        why: "dès que 表示“一旦完成……就……”，先于将来主句完成的动作要用先将来时 aura adopté。",
      },
      {
        id: "d4",
        hint: "pouvoir",
        answer: ["pourront"],
        options: ["pourront", "pourraient", "peuvent", "ont pu"],
        point: "futur",
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
        why: "Étant donné（鉴于、考虑到）是高频 B2 因果分词固定短语。",
      },
      {
        id: "k2",
        hint: "gérondif · rénover",
        answer: ["En rénovant", "en rénovant"],
        options: ["En rénovant", "Rénovant", "En rénové", "Pour rénové"],
        point: "gerondif",
        why: "en + 现在分词构成副动词（gérondif），表示“通过翻新……”的方式手段。",
      },
      {
        id: "k3",
        hint: "转折连接词",
        answer: ["néanmoins"],
        options: ["néanmoins", "donc", "puisque", "afin que"],
        point: "connecteurs",
        why: "前后语义构成对比转折（长期省钱 vs 初始投入大），用 néanmoins（然而、尽管如此）。",
      },
      {
        id: "k4",
        hint: "à + 关系代词",
        answer: ["à laquelle"],
        options: ["à laquelle", "laquelle", "dont", "où"],
        point: "relatifs-composes",
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
        why: "Bien que 后不能用直陈式 est，须改为虚拟式 soit。",
      },
      {
        id: "e2",
        shown: "auraient préparé",
        hint: "改写 si 从句时态",
        answer: ["avaient préparé"],
        options: ["avaient préparé", "auraient préparé", "ont préparé", "préparaient"],
        point: "cond-passe",
        why: "法语铁律：si 条件从句中绝不直接使用 conditionnel，过去非真实假设须改为愈过去时 avaient préparé。",
      },
      {
        id: "e3",
        shown: "que",
        hint: "改写关系代词",
        answer: ["dont"],
        options: ["dont", "que", "où", "lequel"],
        point: "relatifs",
        why: "avoir besoin de qqch 带介词 de，修饰先行词 un équilibre 须用 dont 而非 que。",
      },
      {
        id: "e4",
        shown: "devient",
        hint: "改写此处语式",
        answer: ["devienne"],
        options: ["devienne", "devient", "deviendra", "devenait"],
        point: "anteriorite",
        why: "avant que ... ne 后必须使用虚拟式，应将 devient 改为 devienne。",
      },
    ],
  },
];
