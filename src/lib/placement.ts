/**
 * Optional 10–15 minute DELF B1/B2 diagnostic placement test (摸底定级小测).
 * Runs fully offline without an AI key, recommends `startLevel`, and assesses initial
 * strengths and weaknesses across vocabulary, grammar, reading, and listening.
 */

import { countWords } from "./essay-schema";
import type { ExamResult } from "./exam-schema";
import type { PlacementProduction, PlacementResult, PlacementSection } from "./placement-schema";
export * from "./placement-schema";

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
    options: ["dire", "savoir", "faire", "pouvoir"],
    answer: 2,
    why: "faire sa valise 是固定搭配（收拾行李）。",
  },
  {
    id: "v2",
    section: "vocab",
    level: "A2",
    weight: 1,
    prompt: "Ce documentaire m'a vraiment ______, je n'ai pas vu le temps passer.",
    options: ["ennuyé", "passionné", "empêché", "regretté"],
    answer: 1,
    why: "passionner 表示“使着迷”；后句“没觉察时间流逝”印证正向吸引。",
  },
  {
    id: "v3",
    section: "vocab",
    level: "B1",
    weight: 1.5,
    prompt: "La municipalité souhaite ______ les émissions de gaz à effet de serre d'ici 2030.",
    options: ["produire", "subir", "hausser", "réduire"],
    answer: 3,
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
    options: ["avouée", "accordée", "avérée", "adressée"],
    answer: 2,
    why: "s'avérer + 形容词表示“结果证明是……”，典型 B2 书面语表达。",
  },
  {
    id: "v6",
    section: "vocab",
    level: "B2",
    weight: 2,
    prompt: "______ de sensibiliser le public, l'association organise des ateliers gratuits.",
    options: ["Grâce", "Afin", "Malgré", "Quant"],
    answer: 1,
    why: "afin de + 不定式表示目的（“为了……”）；grâce à / malgré / quant à 后接名词。",
  },

  // Section 2: Grammaire & Conjugaison (6)
  {
    id: "g1",
    section: "grammar",
    level: "A2",
    weight: 1,
    prompt: "Hier soir, je ______ tranquillement quand le téléphone a sonné.",
    options: ["ai lu", "lirai", "lise", "lisais"],
    answer: 3,
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
    options: ["est", "soit", "sera", "était"],
    answer: 1,
    why: "bien que 引导让步状语从句，后接虚拟式 subjonctif（soit）。",
  },
  {
    id: "g4",
    section: "grammar",
    level: "B1",
    weight: 1.5,
    prompt: "Si les transports gratuits existaient partout, davantage de citoyens ______ leur voiture au garage.",
    options: ["laissent", "laisseront", "laisseraient", "ont laissé"],
    answer: 2,
    why: "si + imparfait（非真实假设），主句必须用条件式现在时 conditionnel présent（laisseraient）。",
  },
  {
    id: "g5",
    section: "grammar",
    level: "B2",
    weight: 2,
    prompt: "Lorsqu'elle est arrivée à la gare, le train ______ déjà ______.",
    options: ["est ... parti", "sera ... parti", "avait ... parti", "était ... parti"],
    answer: 3,
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
      "La suppression des transports en commun en périphérie.",
      "La fermeture de rues devant les écoles aux heures d'affluence.",
    ],
    answer: 2,
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
      "Elles stimulent l'envie de faire des exercices de lecture rapide.",
      "Elles remplacent complètement les manuels scolaires.",
      "Elles améliorent automatiquement l'écriture manuscrite.",
    ],
    answer: 0,
    why: "听力文本提到：l'outil numérique motive les élèves pour les exercices de lecture rapide（motive = stimule l'envie）。",
  },
  {
    id: "l2",
    section: "listen",
    level: "B2",
    weight: 2,
    prompt: "Quelle limite les deux tiers des enseignants constatent-ils ?",
    options: [
      "Les tablettes tombent souvent en panne pendant les cours.",
      "Les parents refusent que leurs enfants utilisent des livres papier.",
      "Les élèves mémorisent moins bien les idées difficiles sur écran.",
    ],
    answer: 2,
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

export const PLACEMENT_PRODUCTION_PROMPT = {
  title: "3 分钟微写作诊断（选做）",
  questionFr: "Dans votre ville, faudrait-il rendre les transports en commun gratuits ou investir plutôt dans de nouvelles lignes ? Donnez votre avis en quelques phrases structurées (60–90 mots).",
  tipZh: "建议写清立场 + 1 个让步转折（如 certes / mais / toutefois / bien que）+ 1 个因果或建议句；可跳过，不影响客观题定级分。",
};

const PROD_CONNECTOR_RE = /\b(cependant|toutefois|néanmoins|en revanche|certes|malgré|bien que|quoique|car|en effet|puisque|donc|c'est pourquoi|par conséquent|d'une part|d'autre part|par ailleurs|selon moi|en somme|tandis que|alors que|afin de)\b/gi;
const PROD_CLAUSE_RE = /\b(qui|que|dont|où|pour que|bien que|parce que|si|lorsque|afin que|soit|ait|fasse|puisse|convienne)\b/gi;

/** Offline heuristic evaluation of the optional 3-minute placement micro-writing response. */
export function evaluateMicroProduction(text: string): PlacementProduction {
  const clean = text.trim();
  const words = countWords(clean);
  const connectorHits = new Set((clean.match(PROD_CONNECTOR_RE) ?? []).map((x) => x.toLowerCase())).size;
  const clauseHits = (clean.match(PROD_CLAUSE_RE) ?? []).length;
  const longWords = (clean.toLowerCase().match(/\p{L}{7,}/gu) ?? []).length;

  const wordPts = words >= 55 ? 40 : words >= 35 ? 28 : words >= 20 ? 16 : 6;
  const structPts = Math.min(40, connectorHits * 11 + Math.min(2, clauseHits) * 7);
  const lexPts = Math.min(20, longWords * 3);
  const score = Math.min(100, wordPts + structPts + lexPts);

  const band: PlacementProduction["band"] =
    score >= 70 && words >= 55 && connectorHits >= 2 ? "B2" : score >= 40 && words >= 28 ? "B1" : "A2";

  const notes: string[] = [];
  if (words < 45) notes.push(`篇幅较短（${words} 词），B2 书面立论建议至少展开至 60–90 词。`);
  if (connectorHits < 2) notes.push("逻辑连接偏单一，可加入 certes… mais、toutefois 或 par conséquent 串联让步与因果。");
  if (clauseHits === 0 && words >= 20) notes.push("缺少复合从句（qui/que/dont 或虚拟式），目前偏简单单句表达。");
  if (notes.length === 0) notes.push("微写作衔接清晰、篇幅适中，具备 B2 书面立论展开能力。");

  return { words, band, score, connectors: connectorHits, notes };
}

/** Compute level recommendation (0=A1 .. 3=B2) and section breakdown from quiz answers. */
export function scorePlacement(answers: Record<string, number>, skipListen = false, now = Date.now(), productionText?: string): PlacementResult {
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
  const production = productionText?.trim() ? evaluateMicroProduction(productionText) : undefined;

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
    ...(production ? { production } : {}),
  };
}

/**
 * Convert a completed placement diagnostic into explicitly `unverified: true` exam log entries
 * so `ExamDashboard` can display placement estimates separately without polluting verified B2 `/100` readiness.
 */
export function placementToExamResults(res: PlacementResult): Omit<ExamResult, "at">[] {
  const out: Omit<ExamResult, "at">[] = [];
  const to25 = (pctVal: number) => Math.round((pctVal / 100) * 250) / 10;
  out.push({
    part: "read",
    what: "placement-ce",
    score: to25(res.sections.read),
    total: 25,
    level: "B2",
    scope: "full",
    unverified: true,
  });
  if (res.sections.listen !== null) {
    out.push({
      part: "listen",
      what: "placement-co",
      score: to25(res.sections.listen),
      total: 25,
      level: "B2",
      scope: "full",
      unverified: true,
    });
  }
  if (res.production) {
    out.push({
      part: "essay",
      what: "placement-pe",
      score: to25(res.production.score),
      total: 25,
      level: "B2",
      scope: "full",
      unverified: true,
    });
  }
  return out;
}
