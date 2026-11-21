/**
 * Optional 10–15 minute DELF B1/B2 diagnostic placement test (摸底定级小测).
 * Runs fully offline without an AI key, recommends `startLevel`, and assesses initial
 * strengths and weaknesses across vocabulary, grammar, reading, and listening.
 */

export type PlacementSection = "vocab" | "grammar" | "read" | "listen";

export interface PlacementQuestion {
  id: string;
  section: PlacementSection;
  level: "A1" | "A2" | "B1" | "B2";
  weight: number;
  prompt: string;
  options: readonly string[];
  answer: number;
  why: string;
}

export interface PlacementResult {
  at: number;
  /** Recommended CEFR index (0 = A1, 1 = A2, 2 = B1, 3 = B2). */
  level: number;
  /** Weighted overall score 0..100. */
  score: number;
  sections: {
    vocab: number;
    grammar: number;
    read: number;
    /** Null when listening was skipped due to device/environment constraints. */
    listen: number | null;
  };
  /** Sections below target readiness, weakest first. */
  weak: PlacementSection[];
}

export const PLACEMENT_ESTIMATE = "约 10–15 分钟";

export const SECTION_META: Record<PlacementSection, { label: string; fr: string; minutes: string }> = {
  vocab: { label: "词汇辨析", fr: "Vocabulaire", minutes: "3 分钟" },
  grammar: { label: "语法与时态", fr: "Grammaire", minutes: "3 分钟" },
  read: { label: "阅读理解", fr: "Compréhension écrite", minutes: "4 分钟" },
  listen: { label: "听力理解", fr: "Compréhension orale", minutes: "3 分钟" },
};

export const PLACEMENT_PASSAGE = {
  title: "Vers des villes plus respirables ?",
  source: "D'après une chronique urbaine",
  text:
    "Depuis quelques années, de nombreuses métropoles européennes réorganisent leurs centres-villes pour limiter la place de la voiture individuelle. À Lyon comme à Nantes, plusieurs rues situées près des écoles ont été fermées à la circulation aux heures de pointe, tandis que les pistes cyclables ont doublé en cinq ans.\n\n" +
    "Selon une enquête publiée en mars, 62 % des habitants interrogés saluent une baisse sensible du bruit et de la pollution atmosphérique. Toutefois, certains commerçants de quartier expriment leur inquiétude : ils estiment que la réduction des places de stationnement décourage les clients venus des communes voisines.\n\n" +
    "Pour concilier ces attentes opposées, les urbanistes recommandent de ne pas interdire brutalement l'automobile, mais d'améliorer d'abord la fréquence des transports en commun et d'aménager des parkings relais en périphérie. Sans cette alternative concrète, la transition écologique risque d'être perçue comme une contrainte sociale plutôt que comme un progrès partagé.",
};

export const PLACEMENT_AUDIO = {
  title: "Les tablettes à l'école primaire",
  script:
    "Bonjour à tous. Dans notre chronique numérique aujourd'hui, parlons de l'utilisation des tablettes à l'école primaire. " +
    "Une étude menée auprès de quatre cents enseignants montre que l'outil numérique motive les élèves pour les exercices de lecture rapide. " +
    "Cependant, deux tiers des professeurs soulignent un paradoxe : les enfants retiennent moins bien les notions complexes lorsqu'ils lisent sur écran plutôt que sur papier. " +
    "Le ministère de l'Éducation recommande donc un usage encadré, limité à trente minutes par jour en classe, afin de préserver la concentration et l'écriture manuscrite.",
};

export const PLACEMENT_QUESTIONS: readonly PlacementQuestion[] = [
  // Section 1: Vocabulaire (6)
  {
    id: "v1",
    section: "vocab",
    level: "A1",
    weight: 1,
    prompt: "Avant de partir en voyage, n'oubliez pas de ______ votre valise.",
    options: ["faire", "dire", "savoir", "pouvoir"],
    answer: 0,
    why: "faire sa valise 是固定搭配（收拾行李）。",
  },
  {
    id: "v2",
    section: "vocab",
    level: "A2",
    weight: 1,
    prompt: "Ce documentaire m'a vraiment ______, je n'ai pas vu le temps passer.",
    options: ["passionné", "ennuyé", "empêché", "regretté"],
    answer: 0,
    why: "passionner 表示“使着迷”；后句“没觉察时间流逝”印证正向吸引。",
  },
  {
    id: "v3",
    section: "vocab",
    level: "B1",
    weight: 1.5,
    prompt: "La municipalité souhaite ______ les émissions de gaz à effet de serre d'ici 2030.",
    options: ["réduire", "produire", "subir", "hausser"],
    answer: 0,
    why: "réduire les émissions de gaz à effet de serre（减少温室气体排放）是 B1/B2 环保高频搭配。",
  },
  {
    id: "v4",
    section: "vocab",
    level: "B1",
    weight: 1.5,
    prompt: "Il faut ______ les avantages du télétravail, car il entraîne aussi un isolement professionnel.",
    options: ["nuancer", "ignorer", "exiger", "déduire"],
    answer: 0,
    why: "nuancer（辩证地看待/保留分寸地说）是 B2 议论文与口语独白的核心动词。",
  },
  {
    id: "v5",
    section: "vocab",
    level: "B2",
    weight: 2,
    prompt: "Malgré les critiques initiales, cette réforme s'est ______ efficace à long terme.",
    options: ["avérée", "avouée", "accordée", "adressée"],
    answer: 0,
    why: "s'avérer + 形容词表示“结果证明是……”，典型 B2 书面语表达。",
  },
  {
    id: "v6",
    section: "vocab",
    level: "B2",
    weight: 2,
    prompt: "______ de sensibiliser le public, l'association organise des ateliers gratuits.",
    options: ["Afin", "Grâce", "Malgré", "Quant"],
    answer: 0,
    why: "afin de + 不定式表示目的（“为了……”）；grâce à / malgré / quant à 后接名词。",
  },

  // Section 2: Grammaire & Conjugaison (6)
  {
    id: "g1",
    section: "grammar",
    level: "A2",
    weight: 1,
    prompt: "Hier soir, je ______ tranquillement quand le téléphone a sonné.",
    options: ["lisais", "ai lu", "lirai", "lise"],
    answer: 0,
    why: "背景持续动作（当时正在读）用未完成过去时 lisais，打断事件用复合过去时 a sonné。",
  },
  {
    id: "g2",
    section: "grammar",
    level: "B1",
    weight: 1.5,
    prompt: "C'est un roman ______ tout le monde parle en ce moment.",
    options: ["dont", "que", "où", "lequel"],
    answer: 0,
    why: "parler de qqch 搭配介词 de，关系代词必须用 dont。",
  },
  {
    id: "g3",
    section: "grammar",
    level: "B1",
    weight: 1.5,
    prompt: "Bien qu'il ______ très tard, elle continue de relire son rapport.",
    options: ["soit", "est", "sera", "était"],
    answer: 0,
    why: "bien que 引导让步状语从句，后接虚拟式 subjonctif（soit）。",
  },
  {
    id: "g4",
    section: "grammar",
    level: "B1",
    weight: 1.5,
    prompt: "Si les transports gratuits existaient partout, davantage de citoyens ______ leur voiture au garage.",
    options: ["laisseraient", "laissent", "laisseront", "ont laissé"],
    answer: 0,
    why: "si + imparfait（非真实假设），主句必须用条件式现在时 conditionnel présent（laisseraient）。",
  },
  {
    id: "g5",
    section: "grammar",
    level: "B2",
    weight: 2,
    prompt: "Lorsqu'elle est arrivée à la gare, le train ______ déjà ______.",
    options: ["était ... parti", "est ... parti", "sera ... parti", "avait ... parti"],
    answer: 0,
    why: "过去的过去（先时性）用愈过去时 plus-que-parfait，且 partir 以 être 作助动词：était parti。",
  },
  {
    id: "g6",
    section: "grammar",
    level: "B2",
    weight: 2,
    prompt: "Nous avons beau ______ des solutions concrètes, le budget reste insuffisant.",
    options: ["proposer", "proposons", "proposé", "proposions"],
    answer: 0,
    why: "avoir beau + 不定式（proposer）表示“尽管做了……仍徒劳”，B2 高频让步句型。",
  },

  // Section 3: Compréhension écrite (3)
  {
    id: "r1",
    section: "read",
    level: "B1",
    weight: 1.5,
    prompt: "Quel changement concret a déjà été observé dans certaines villes françaises ?",
    options: [
      "L'interdiction totale des voitures dans toute la ville.",
      "La fermeture de rues devant les écoles aux heures d'affluence.",
      "La suppression des transports en commun en périphérie.",
    ],
    answer: 1,
    why: "原文第一段明确提到学校周边道路在高峰时段禁止通行（aux heures de pointe = aux heures d'affluence）。",
  },
  {
    id: "r2",
    section: "read",
    level: "B2",
    weight: 2,
    prompt: "Pourquoi certains commerçants sont-ils réservés face à cette politique ?",
    options: [
      "Ils craignent de perdre la clientèle habitant en dehors du centre.",
      "Ils trouvent que les pistes cyclables coûtent trop cher à entretenir.",
      "Ils estiment que le bruit a augmenté dans les rues piétonnes.",
    ],
    answer: 0,
    why: "原文第二段指出：减少停车位会劝退来自邻近市镇的顾客（venus des communes voisines）。",
  },
  {
    id: "r3",
    section: "read",
    level: "B2",
    weight: 2,
    prompt: "D'après les urbanistes, quelle condition est indispensable pour réussir cette réforme ?",
    options: [
      "Augmenter le prix du stationnement dès le mois prochain.",
      "Offrir d'abord des transports publics fréquents et des parkings en banlieue.",
      "Convaincre les commerçants de déménager vers la périphérie.",
    ],
    answer: 1,
    why: "原文第三段：先提高公共交通频次并在郊区建换乘停车场（parkings relais en périphérie）。",
  },

  // Section 4: Compréhension orale (3)
  {
    id: "l1",
    section: "listen",
    level: "B1",
    weight: 1.5,
    prompt: "Selon l'étude citée, quel est l'effet positif des tablettes en classe ?",
    options: [
      "Elles remplacent complètement les manuels scolaires.",
      "Elles stimulent l'envie de faire des exercices de lecture rapide.",
      "Elles améliorent automatiquement l'écriture manuscrite.",
    ],
    answer: 1,
    why: "听力文本提到：l'outil numérique motive les élèves pour les exercices de lecture rapide（motive = stimule l'envie）。",
  },
  {
    id: "l2",
    section: "listen",
    level: "B2",
    weight: 2,
    prompt: "Quelle limite les deux tiers des enseignants constatent-ils ?",
    options: [
      "Les élèves mémorisent moins bien les idées difficiles sur écran.",
      "Les tablettes tombent souvent en panne pendant les cours.",
      "Les parents refusent que leurs enfants utilisent des livres papier.",
    ],
    answer: 0,
    why: "听力文本转折：retiennent moins bien les notions complexes lorsqu'ils lisent sur écran。",
  },
  {
    id: "l3",
    section: "listen",
    level: "B2",
    weight: 2,
    prompt: "Que conseille finalement le ministère de l'Éducation ?",
    options: [
      "D'interdire tout écran avant le lycée.",
      "De limiter l'usage des tablettes à une demi-heure quotidienne en classe.",
      "De consacrer toute la journée scolaire à la lecture numérique.",
    ],
    answer: 1,
    why: "听力结尾：limité à trente minutes par jour en classe（trente minutes = une demi-heure）。",
  },
];

const pct = (earned: number, total: number) => (total > 0 ? Math.round((earned / total) * 100) : 0);

/** Compute level recommendation (0=A1 .. 3=B2) and section breakdown from quiz answers. */
export function scorePlacement(answers: Record<string, number>, skipListen = false, now = Date.now()): PlacementResult {
  const secScore = (sec: PlacementSection) => {
    const qs = PLACEMENT_QUESTIONS.filter((q) => q.section === sec);
    let earned = 0;
    let max = 0;
    for (const q of qs) {
      max += q.weight;
      if (answers[q.id] === q.answer) earned += q.weight;
    }
    return { earned, max, pct: pct(earned, max) };
  };

  const vocab = secScore("vocab");
  const grammar = secScore("grammar");
  const read = secScore("read");
  const listen = skipListen ? null : secScore("listen");

  const active = [vocab, grammar, read, ...(listen ? [listen] : [])];
  const totalEarned = active.reduce((s, x) => s + x.earned, 0);
  const totalMax = active.reduce((s, x) => s + x.max, 0);
  const score = pct(totalEarned, totalMax);

  const level = score >= 80 ? 3 : score >= 55 ? 2 : score >= 35 ? 1 : 0;

  const entries: [PlacementSection, number][] = [
    ["vocab", vocab.pct],
    ["grammar", grammar.pct],
    ["read", read.pct],
    ...(listen ? ([["listen", listen.pct]] as [PlacementSection, number][]) : []),
  ];
  entries.sort((a, b) => a[1] - b[1]);
  const below = entries.filter(([, p]) => p < 70).map(([s]) => s);
  const weak = below.length ? below : entries[0][1] < 95 ? [entries[0][0]] : [];

  return {
    at: now,
    level,
    score,
    sections: {
      vocab: vocab.pct,
      grammar: grammar.pct,
      read: read.pct,
      listen: listen ? listen.pct : null,
    },
    weak,
  };
}

const VALID_SECTIONS = new Set<PlacementSection>(["vocab", "grammar", "read", "listen"]);

export function sanitizePlacement(v: unknown): PlacementResult | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const r = v as Record<string, unknown>;
  const num = (x: unknown, lo: number, hi: number) => typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi;
  if (!num(r.at, 0, Infinity) || !num(r.level, 0, 3) || !num(r.score, 0, 100)) return undefined;
  const s = r.sections;
  if (!s || typeof s !== "object" || Array.isArray(s)) return undefined;
  const sec = s as Record<string, unknown>;
  if (!num(sec.vocab, 0, 100) || !num(sec.grammar, 0, 100) || !num(sec.read, 0, 100)) return undefined;
  if (sec.listen !== null && !num(sec.listen, 0, 100)) return undefined;
  const weak = Array.isArray(r.weak) ? [...new Set(r.weak.filter((x): x is PlacementSection => typeof x === "string" && VALID_SECTIONS.has(x as PlacementSection)))] : [];
  return {
    at: r.at as number,
    level: Math.round(r.level as number),
    score: Math.round(r.score as number),
    sections: {
      vocab: Math.round(sec.vocab as number),
      grammar: Math.round(sec.grammar as number),
      read: Math.round(sec.read as number),
      listen: sec.listen === null ? null : Math.round(sec.listen as number),
    },
    weak,
  };
}
