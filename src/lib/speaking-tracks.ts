/**
 * TCF Expression Orale (12 min: T1–T3, 0–20 + CEFR/NCLC) &
 * TEF Expression Orale (15 min: Sec A formal `vous` + Sec B informal `tu`, 0–699 + NCLC):
 * deterministic French question & register analyzers and built-in authentic scenario suites.
 */

export type QuestionStructureKind = "estCeQue" | "inversion" | "whWord" | "intonation";

export const QUESTION_STRUCTURE_LABEL: Record<QuestionStructureKind, string> = {
  estCeQue: "est-ce que",
  inversion: "主谓倒装",
  whWord: "特殊疑问词",
  intonation: "语调疑问",
};

export interface AnalyzedQuestion {
  text: string;
  structures: QuestionStructureKind[];
}

export interface CandidateQuestionAnalysis {
  totalQuestions: number;
  questions: AnalyzedQuestion[];
  counts: Record<QuestionStructureKind, number>;
  distinctStructures: QuestionStructureKind[];
  /** Variety score capped at 3 (`0..3`) for the live `句式多样性 Y/3` HUD. */
  varietyScore3: number;
}

export interface RegisterConsistencyAnalysis {
  expected: "vous" | "tu";
  tuCount: number;
  vousCount: number;
  tuMatches: string[];
  vousMatches: string[];
  /** Formal scenario (TCF T2 / TEF Sec A) where candidate slipped into `tu`. */
  usedTuInFormal: boolean;
  /** Informal friend scenario (TEF Sec B) where candidate stiffly used `vous`. */
  usedVousInInformal: boolean;
  /** True when zero opposite-register violations occurred. */
  consistent: boolean;
  /** True when at least one pronoun/determiner of the expected register was used. */
  hasTargetPronoun: boolean;
}

const PURE_FILLERS = new Set([
  "euh",
  "heu",
  "hum",
  "ben",
  "bah",
  "oui",
  "non",
  "ok",
  "d'accord",
  "voilà",
  "merci",
  "bonjour",
  "bonsoir",
  "salut",
  "allô",
  "pardon",
]);

const EST_CE_QUE_RE = /(?<![\p{L}])(?:qu['’]\s*)?est[-\s]ce\s+qu(?:e(?![\p{L}])|i(?![\p{L}])|['’])/iu;

const HYPHEN_INVERSION_RE =
  /(?<![\p{L}-])(?!rendez-vous(?![\p{L}]))([\p{L}]{2,})-(?:t-)?(je|tu|il|elle|on|nous|vous|ils|elles)(?![\p{L}-])/giu;

const ASR_UNHYPHENATED_INVERSION_RE =
  /(?<![\p{L}])(?:(?:pouvez|pourriez|savez|auriez|avez|êtes|faites|proposez|acceptez|prenez|offrez|devez|voulez|ouvrez|fermez|organisez|prévoyez|permettez)\s+vous|(?:peux|pourrais|sais|as|es|fais|veux|dois|viens|penses)\s+tu|y\s+a[-\s]t[-\s]il|(?:faut|est|existe|reste|convient|suffit)[-\s](?:t[-\s])?il|puis[-\s]je)(?![\p{L}])/iu;

const WH_PHRASE_ANYWHERE_RE =
  /(?<![\p{L}])(?:à\s+quelle\s+heure|combien(?:\s+de|\s+coûte|\s+coûtent|\s+ça|\s+cela|\s+faut|\s+y\s+a)?|pourquoi|lequel|laquelle|lesquels|lesquelles|auquel|auxquels|auxquelles|duquel|desquels|desquelles|quel|quelle|quels|quelles|comment|quand|où)(?![\p{L}])/iu;

const CLAUSE_INITIAL_WH_RE =
  /^(?:(?:bonjour|bonsoir|excusez-moi|pardon|madame|monsieur|s['’]il\s+vous\s+plaît|dis(?:-moi)?|écoute|alors|et|mais|du\s+coup|sinon|au\s+fait|euh|ben)\s*[,!:]?\s*)*(?:(?:à|de|dans|pour|avec|par|chez|depuis|jusqu['’]à|vers)\s+)?(?:quelle\s+heure|quel|quelle|quels|quelles|lequel|laquelle|lesquels|lesquelles|auquel|auxquels|auxquelles|duquel|desquels|desquelles|combien|comment|pourquoi|quand|où|qui\s+est|que\s+faut)(?![\p{L}])/iu;

const INDIRECT_POLITE_QUESTION_RE =
  /(?<![\p{L}])(?:j['’]aimerais\s+savoir|je\s+voudrais\s+savoir|je\s+souhaiterais\s+savoir|pourriez-vous\s+me\s+dire|pouvez-vous\s+m['’]indiquer)\s+(?:si|quel|quelle|quels|quelles|combien|comment|quand|où|pourquoi)(?![\p{L}])/iu;

function splitUtterances(turnsOrText: readonly string[]): string[] {
  const segments: string[] = [];
  for (const raw of turnsOrText) {
    if (!raw || !raw.trim()) continue;
    const normalized = raw.replace(/\r\n/g, "\n").trim();
    const parts = normalized.match(/[^?!.;\n]+[?!.;]?/g) ?? [normalized];
    for (const p of parts) {
      const s = p.trim();
      if (s) segments.push(s);
    }
  }
  return segments;
}

function meaningfulWordCount(utterance: string): number {
  const tokens = utterance.toLowerCase().match(/[\p{L}][\p{L}'’-]*/gu) ?? [];
  return tokens.filter((t) => !PURE_FILLERS.has(t)).length;
}

function hasValidInversion(utterance: string): boolean {
  HYPHEN_INVERSION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HYPHEN_INVERSION_RE.exec(utterance)) !== null) {
    const full = m[0].toLowerCase();
    const verb = m[1].toLowerCase();
    // Exclude nouns/imperatives that are not interrogative subject-clitic inversions
    if (full === "rendez-vous" || full === "garde-vous" || verb === "excusez" || verb === "dites" || verb === "rappelez") {
      continue;
    }
    return true;
  }
  return ASR_UNHYPHENATED_INVERSION_RE.test(utterance);
}

/**
 * Deterministically count valid French candidate questions and classify interrogative syntax diversity
 * (`estCeQue`, `inversion`, `whWord`, `intonation`) across spoken ASR or typed turns.
 */
export function analyzeCandidateQuestions(turnsOrText: readonly string[]): CandidateQuestionAnalysis {
  const counts: Record<QuestionStructureKind, number> = {
    estCeQue: 0,
    inversion: 0,
    whWord: 0,
    intonation: 0,
  };
  const questions: AnalyzedQuestion[] = [];
  const utterances = splitUtterances(turnsOrText);

  for (const seg of utterances) {
    if (meaningfulWordCount(seg) < 2) continue;
    const hasQMark = seg.trimEnd().endsWith("?");
    const hasEstCeQue = EST_CE_QUE_RE.test(seg);
    const hasInv = hasValidInversion(seg);
    const hasWh = hasQMark || hasEstCeQue || hasInv ? WH_PHRASE_ANYWHERE_RE.test(seg) : CLAUSE_INITIAL_WH_RE.test(seg);
    const hasPoliteIndirect = INDIRECT_POLITE_QUESTION_RE.test(seg);

    if (!hasQMark && !hasEstCeQue && !hasInv && !hasWh && !hasPoliteIndirect) continue;

    const structures: QuestionStructureKind[] = [];
    if (hasEstCeQue) structures.push("estCeQue");
    if (hasInv) structures.push("inversion");
    if (hasWh) structures.push("whWord");
    if (structures.length === 0 && (hasQMark || hasPoliteIndirect)) {
      structures.push("intonation");
    }

    for (const st of structures) counts[st]++;
    questions.push({ text: seg, structures });
  }

  const distinctStructures = (["estCeQue", "inversion", "whWord", "intonation"] as const).filter(
    (k) => counts[k] > 0,
  );

  return {
    totalQuestions: questions.length,
    questions,
    counts,
    distinctStructures,
    varietyScore3: Math.min(3, distinctStructures.length),
  };
}

function stripQuotedSpeech(text: string): string {
  return text
    .replace(/«[^»]*»/g, " ")
    .replace(/“[^”]*”/g, " ")
    .replace(/"[^"]*"/g, " ");
}

const TU_WORD_RE = /(?<![\p{L}])(?<!\bs['’]est\s+)(?<!\bme\s+suis\s+)(tu|te|toi|ton|ta|tes)(?![\p{L}])/giu;
const TU_ELIDED_RE = /(?<![\p{L}])(t['’])(?=[\p{L}])/giu;
const VOUS_WORD_RE = /(?<![\p{L}])(vous|votre|vos)(?![\p{L}])/giu;

/**
 * Deterministically inspect `tu/te/t'/toi/ton/ta/tes` vs `vous/votre/vos` (ignoring quoted speech and `rendez-vous`)
 * to catch formal/informal register violations in TCF T2, TEF Sec A (`vous`), and TEF Sec B (`tu`).
 */
export function analyzeRegisterConsistency(
  text: string,
  expected: "vous" | "tu",
): RegisterConsistencyAnalysis {
  const unquoted = stripQuotedSpeech(text).replace(/(?<![\p{L}])rendez-vous(?![\p{L}])/giu, " ");
  const tuMatches: string[] = [];
  const vousMatches: string[] = [];

  for (const m of unquoted.matchAll(TU_WORD_RE)) {
    tuMatches.push(m[1].toLowerCase());
  }
  for (const m of unquoted.matchAll(TU_ELIDED_RE)) {
    tuMatches.push(m[1].toLowerCase().replace("’", "'"));
  }
  for (const m of unquoted.matchAll(VOUS_WORD_RE)) {
    vousMatches.push(m[1].toLowerCase());
  }

  const tuCount = tuMatches.length;
  const vousCount = vousMatches.length;
  const usedTuInFormal = expected === "vous" && tuCount > 0;
  const usedVousInInformal = expected === "tu" && vousCount > 0;
  const hasTargetPronoun = expected === "vous" ? vousCount > 0 : tuCount > 0;

  return {
    expected,
    tuCount,
    vousCount,
    tuMatches,
    vousMatches,
    usedTuInFormal,
    usedVousInInformal,
    consistent: !usedTuInFormal && !usedVousInInformal,
    hasTargetPronoun,
  };
}

/* ---------- Built-in Authentic TCF EO (12 min, T1–T3) Suites ---------- */

export interface TcfSpeakingSuite {
  id: string;
  title: string;
  topicZh: string;
  tache1: {
    prepSec: 0;
    speakSec: 120;
    promptFr: string;
    promptZh: string;
    followUpsFr: string[];
  };
  tache2: {
    prepSec: 120;
    speakSec: 210;
    targetQuestions: number;
    roleplayTitleFr: string;
    cardFr: string;
    examinerRoleFr: string;
    candidateGoalZh: string;
    hiddenFactsFr: string[];
    offlineRepliesFr: string[];
  };
  tache3: {
    prepSec: 0;
    speakSec: 270;
    questionFr: string;
    questionZh: string;
    followUpsFr: string[];
  };
}

export const TCF_SPEAKING_SUITES: readonly TcfSpeakingSuite[] = [
  {
    id: "tcf-eo-mediatheque",
    title: "Médiathèque municipale & vols intérieurs",
    topicZh: "公共文化服务与低碳出行",
    tache1: {
      prepSec: 0,
      speakSec: 120,
      promptFr:
        "Bonjour. Pour commencer cette première tâche sans préparation, pouvez-vous vous présenter brièvement et me parler d'un lieu de votre ville où vous aimez passer du temps libre ?",
      promptZh: "无准备热身（2 分钟）：简短自我介绍，并谈谈你所在城市里你最喜欢消磨空闲时间的一个场所。",
      followUpsFr: [
        "Qu'est-ce qui rend cet endroit particulièrement agréable selon vous ?",
        "Avez-vous changé vos habitudes de loisirs au cours des deux dernières années ?",
      ],
    },
    tache2: {
      prepSec: 120,
      speakSec: 210,
      targetQuestions: 8,
      roleplayTitleFr: "Inscription à la médiathèque municipale",
      cardFr:
        "Vous venez d'emménager dans une ville française. Vous souhaitez vous inscrire à la médiathèque municipale (livres, presse numérique, ateliers de conversation, prêts de jeux). Je suis l'agent d'accueil : posez-moi des questions pour obtenir tous les renseignements pratiques (tarifs, pièces justificatives, durée et nombre d'emprunts, horaires, services en ligne).",
      examinerRoleFr: "Agent d'accueil de la médiathèque municipale Jean-Moulin",
      candidateGoalZh: "刚搬到法国城市，向市立多媒体图书馆前台（vous）咨询办卡费用、所需证件、借阅册数与期限、开放时间及数字资源/法语角活动。",
      hiddenFactsFr: [
        "Tarif annuel : 15 € pour les résidents de la commune, gratuit pour les étudiants et demandeurs d'emploi.",
        "Pièces à fournir : pièce d'identité et justificatif de domicile de moins de trois mois.",
        "Quotas de prêt : jusqu'à 10 livres, 4 revues et 2 jeux de société pour 3 semaines, renouvelables une fois.",
        "Horaires : du mardi au samedi de 10 h à 19 h, et le dimanche matin de 10 h à 13 h ; fermée le lundi.",
        "Services numériques : accès illimité à la presse francophone et plateforme VOD depuis chez soi.",
        "Atelier de conversation en français : chaque jeudi à 18 h, gratuit sur inscription préalable.",
      ],
      offlineRepliesFr: [
        "Bonjour ! Je vous écoute, quels renseignements souhaitez-vous sur l'inscription ?",
        "L'abonnement annuel coûte quinze euros pour les habitants de la commune, et il est gratuit pour les étudiants sur présentation d'un justificatif.",
        "Pour créer votre carte, il suffit d'apporter une pièce d'identité et un justificatif de domicile de moins de trois mois.",
        "Vous pouvez emprunter jusqu'à dix livres et deux jeux de société pendant trois semaines, avec une prolongation possible en ligne.",
        "Nous sommes ouverts du mardi au samedi de dix heures à dix-neuf heures, ainsi que le dimanche matin jusqu'à treize heures.",
        "Oui, votre carte donne accès à la presse en ligne et à un atelier de conversation chaque jeudi soir à dix-huit heures.",
      ],
    },
    tache3: {
      prepSec: 0,
      speakSec: 270,
      questionFr:
        "Faut-il limiter, voire interdire, les vols intérieurs courts lorsqu'une liaison directe en train existe en moins de trois heures ? Donnez votre opinion de manière structurée et nuancée.",
      questionZh: "零准备观点陈述（4 分 30 秒）：当存在 3 小时以内的直达火车时，是否应当限制乃至禁止短途国内航班？",
      followUpsFr: [
        "Que répondez-vous aux voyageurs qui estiment que le train coûte souvent plus cher que l'avion à la dernière minute ?",
        "Comment accompagner les régions enclavées qui craignent de perdre leur attractivité économique ?",
      ],
    },
  },
  {
    id: "tcf-eo-velo-cargo",
    title: "Location de vélo cargo & télétravail",
    topicZh: "市政绿色交通与远程办公",
    tache1: {
      prepSec: 0,
      speakSec: 120,
      promptFr:
        "Bonjour. Pouvez-vous me décrire votre journée type en semaine et m'expliquer comment vous vous déplacez habituellement au quotidien ?",
      promptZh: "无准备热身（2 分钟）：描述你工作日的一天作息，以及日常主要的出行方式与原因。",
      followUpsFr: [
        "Quels sont les avantages et les inconvénients de ce mode de transport ?",
        "Si vous pouviez modifier un aspect de votre rythme quotidien, lequel choisiriez-vous ?",
      ],
    },
    tache2: {
      prepSec: 120,
      speakSec: 210,
      targetQuestions: 8,
      roleplayTitleFr: "Location longue durée d'un vélo cargo électrique municipal",
      cardFr:
        "La mairie de votre ville propose un service de location longue durée de vélos cargos électriques pour les particuliers. Je travaille au guichet Mobilités douces : interrogez-moi sur la durée du contrat, le coût mensuel, la caution, l'assurance contre le vol, l'entretien et le stationnement sécurisé.",
      examinerRoleFr: "Conseiller au guichet Mobilités douces de la métropole",
      candidateGoalZh: "向市政绿色出行窗口工作人员（vous）详细询问电动货运自行车长租的租期、月租费、押金、防盗保险、免费维修及安全车棚。",
      hiddenFactsFr: [
        "Durée de location : 3 mois, 6 mois ou 12 mois non renouvelables afin de faire tourner la flotte.",
        "Tarif : 42 € par mois au tarif plein, réduit à 20 € avec l'abonnement de transports urbains.",
        "Caution : empreinte bancaire de 400 €, non débitée sauf dégradation majeure.",
        "Assurance casse et vol : incluse avec une franchise de 120 €, à condition d'utiliser les deux antivols fournis.",
        "Entretien : révision trimestrielle gratuite dans trois ateliers partenaires de la ville.",
        "Stationnement : accès en option à une consigne collective sécurisée de quartier pour 5 € par mois.",
      ],
      offlineRepliesFr: [
        "Bonjour ! Bienvenue au service Mobilités douces. Que souhaitez-vous savoir sur nos vélos cargos ?",
        "Vous pouvez louer un vélo cargo pour trois, six ou douze mois maximum, pour quarante-deux euros par mois au tarif normal.",
        "Nous demandons une caution de quatre cents euros par empreinte bancaire, ainsi qu'un justificatif de résidence dans la métropole.",
        "L'assurance vol et casse est comprise avec les deux antivols homologués fournis, et la révision trimestrielle est gratuite.",
        "Si vous n'avez pas de garage privé, nous proposons des consignes sécurisées de quartier pour cinq euros supplémentaires par mois.",
        "Le délai d'attente actuel est d'environ deux semaines après validation du dossier en ligne.",
      ],
    },
    tache3: {
      prepSec: 0,
      speakSec: 270,
      questionFr:
        "La généralisation du télétravail améliore-t-elle réellement la qualité de vie des salariés, ou risque-t-elle d'isoler les travailleurs et de brouiller la frontière avec la vie privée ?",
      questionZh: "零准备观点陈述（4 分 30 秒）：远程办公普及究竟真正改善了生活质量，还是孤立员工并模糊了工作与私生活的边界？",
      followUpsFr: [
        "Les jeunes diplômés nouvellement recrutés ne sont-ils pas les premiers pénalisés par le travail à distance ?",
        "Faut-il inscrire un nombre minimal de jours de présence obligatoire au bureau dans la loi ou laisser chaque équipe décider ?",
      ],
    },
  },
  {
    id: "tcf-eo-reconversion",
    title: "Stage de reconversion & IA au travail",
    topicZh: "职业转型实训与人工智能",
    tache1: {
      prepSec: 0,
      speakSec: 120,
      promptFr:
        "Bonjour. Parlez-moi de votre parcours d'études ou professionnel, et dites-moi quelles compétences vous aimeriez développer dans les prochaines années.",
      promptZh: "无准备热身（2 分钟）：介绍你的学习或职业经历，并谈谈未来几年你最希望提升的一项技能。",
      followUpsFr: [
        "Pour quelle raison le français occupe-t-il une place importante dans vos projets ?",
        "Préférez-vous apprendre seul à votre rythme ou dans le cadre d'un groupe ?",
      ],
    },
    tache2: {
      prepSec: 120,
      speakSec: 210,
      targetQuestions: 8,
      roleplayTitleFr: "Stage d'immersion artisanale pour adultes en reconversion",
      cardFr:
        "Vous envisagez une reconversion professionnelle et avez repéré un centre qui organise des stages d'immersion d'une à quatre semaines dans des ateliers d'artisanat (boulangerie, menuiserie, céramique). Je suis responsable des admissions : posez-moi des questions sur les prérequis, le calendrier, le financement, les horaires et l'accompagnement.",
      examinerRoleFr: "Responsable pédagogique du centre d'immersion Les Ateliers du Gestes",
      candidateGoalZh: "向成人职业转型实训中心负责人（vous）咨询工坊浸入式实习的零基础要求、排期、资助/费用、作息安排及结业证书。",
      hiddenFactsFr: [
        "Prérequis : aucun diplôme technique exigé ; un entretien téléphonique de motivation de 20 minutes suffit.",
        "Formules : immersion découverte de 5 jours (390 €) ou parcours intensif de 4 semaines (1 450 €), éligible au CPF.",
        "Groupe limité à 6 stagiaires maximum par maître artisan, équipement de sécurité intégralement fourni.",
        "Horaires : du lundi au vendredi, de 8 h 30 à 16 h 30 avec une heure de pause déjeuner.",
        "Bilan final : remise d'une attestation de compétences et mise en relation avec un réseau d'artisans recruteurs.",
      ],
      offlineRepliesFr: [
        "Bonjour ! Je suis ravi de vous renseigner sur nos stages d'immersion artisanale. Quelles sont vos questions ?",
        "Aucune expérience préalable n'est demandée : nos ateliers accueillent les grands débutants après un court entretien de motivation.",
        "Nous proposons un format découverte d'une semaine à trois cent quatre-vingt-dix euros ou quatre semaines éligibles aux financements formation.",
        "Chaque groupe compte six stagiaires au maximum, du lundi au vendredi de huit heures trente à seize heures trente.",
        "Tout le matériel et les chaussures de sécurité sont prêtés sur place dès le premier matin.",
        "En fin de parcours, vous recevez un bilan personnalisé et l'accès à notre réseau d'entreprises partenaires.",
      ],
    },
    tache3: {
      prepSec: 0,
      speakSec: 270,
      questionFr:
        "Les outils d'intelligence artificielle vont-ils libérer les travailleurs des tâches répétitives ou appauvrir le sens et l'autonomie de nombreux métiers ?",
      questionZh: "零准备观点陈述（4 分 30 秒）：人工智能工具究竟会把劳动者从重复劳动中解放出来，还是削弱众多职业的意义感与自主权？",
      followUpsFr: [
        "Quels secteurs devraient selon vous imposer une validation humaine systématique ?",
        "Comment l'école et l'université doivent-elles transformer leurs méthodes d'évaluation face à ces outils ?",
      ],
    },
  },
  {
    id: "tcf-eo-colocation-intergen",
    title: "Colocation intergénérationnelle & tourisme urbain",
    topicZh: "代际互助合租与城市旅游管控",
    tache1: {
      prepSec: 0,
      speakSec: 120,
      promptFr:
        "Bonjour. Pouvez-vous me décrire le quartier où vous habitez actuellement et me dire ce qui compte le plus pour vous dans le choix d'un logement ?",
      promptZh: "无准备热身（2 分钟）：描述你目前居住的街区，并说说你挑选住所时最看重的因素。",
      followUpsFr: [
        "Préférez-vous vivre au cœur d'une grande ville animée ou dans un quartier résidentiel calme ?",
        "Quelles relations entretenez-vous généralement avec vos voisins ?",
      ],
    },
    tache2: {
      prepSec: 120,
      speakSec: 210,
      targetQuestions: 8,
      roleplayTitleFr: "Programme associatif de cohabitation intergénérationnelle",
      cardFr:
        "Nouvellement arrivé(e) pour un master ou un emploi en France, vous cherchez une chambre abordable et découvrez une association de cohabitation intergénérationnelle chez des seniors. Je suis coordinateur de l'association : interrogez-moi sur le loyer, les engagements de présence, le choix du binôme, le préavis et les règles de vie commune.",
      examinerRoleFr: "Coordinateur de l'association Générations Sous un Même Toit",
      candidateGoalZh: "向代际互助合租协会协调员（vous）询问入住老人家独立房间的月租分摊、陪伴时长义务、配对流程、访客规定及退租通知期。",
      hiddenFactsFr: [
        "Deux formules : formule Solidaire (80 €/mois de charges en échange d'une présence rassurante 4 soirs par semaine) ou Conviviale (260 €/mois, liberté d'horaires).",
        "Aucun soin médical ni ménage lourd n'est jamais demandé au jeune cohabitant.",
        "Sélection du binôme : entretien individuel puis rencontre à domicile avant une période d'essai d'un mois.",
        "Chambre privée d'au moins 12 m² avec clé, wifi inclus, accès libre à la cuisine et à la salle de bain.",
        "Préavis de départ d'un mois ; visites d'amis autorisées en journée avec accord préalable de l'hôte.",
      ],
      offlineRepliesFr: [
        "Bonjour ! Notre association met en relation jeunes actifs ou étudiants et seniors disposant d'une chambre libre. Que voulez-vous savoir ?",
        "Nous avons une formule solidaire à quatre-vingts euros de charges contre quatre soirées de présence par semaine, ou une formule plus souple à deux cent soixante euros.",
        "Rassurez-vous, il ne s'agit jamais d'aide médicale ni de ménage : seulement de partage de repas occasionnels et d'une présence bienveillante.",
        "Chaque logement garantit une chambre privée d'au moins douze mètres carrés avec connexion internet incluse.",
        "Nous organisons une rencontre préalable chez le senior et prévoyons un mois d'essai avec un préavis d'un mois.",
        "Les visites d'amis restent possibles en journée à condition de prévenir votre hôte à l'avance.",
      ],
    },
    tache3: {
      prepSec: 0,
      speakSec: 270,
      questionFr:
        "Les grandes villes doivent-elles restreindre sévèrement les locations touristiques de courte durée afin de protéger l'accès au logement des habitants permanents ?",
      questionZh: "零准备观点陈述（4 分 30 秒）：大城市是否应当严格限制短租民宿，以保障常住居民的住房权利？",
      followUpsFr: [
        "Une telle restriction ne pénalise-t-elle pas les petits propriétaires qui complètent leur retraite en louant ponctuellement ?",
        "Au-delà de l'encadrement touristique, quels autres leviers permettraient de faire baisser durablement les loyers ?",
      ],
    },
  },
  {
    id: "tcf-eo-jardin-partage",
    title: "Jardin partagé de quartier & gaspillage",
    topicZh: "社区共享菜园与可持续消费",
    tache1: {
      prepSec: 0,
      speakSec: 120,
      promptFr:
        "Bonjour. Quelle place accordez-vous à la cuisine et à l'alimentation dans votre vie quotidienne ? Aimez-vous préparer vos repas vous-même ?",
      promptZh: "无准备热身（2 分钟）：饮食和下厨在你的日常生活里占怎样的位置？你平时喜欢自己做饭吗？",
      followUpsFr: [
        "Quel plat aimez-vous particulièrement préparer lorsque vous recevez des proches ?",
        "Faites-vous davantage attention à la provenance des produits aujourd'hui qu'autrefois ?",
      ],
    },
    tache2: {
      prepSec: 120,
      speakSec: 210,
      targetQuestions: 8,
      roleplayTitleFr: "Adhésion à un jardin partagé associatif",
      cardFr:
        "Un jardin partagé vient d'ouvrir au pied de votre immeuble. Vous aimeriez cultiver quelques légumes et participer à la vie du quartier. Je suis membre du bureau de l'association : posez-moi des questions sur les parcelles individuelles ou collectives, la cotisation, les outils, l'arrosage en été et les permanences.",
      examinerRoleFr: "Responsable bénévole du jardin partagé Les Pousses du Parc",
      candidateGoalZh: "向社区共享菜园协会负责人（vous）咨询个人与公共菜畦分配、年费、农具与种子提供、暑期轮流浇水制度及新手指导。",
      hiddenFactsFr: [
        "Cotisation annuelle : 25 € par foyer, incluant les semences biologiques de base et le compost collectif.",
        "Organisation : la première année commence sur les bacs collectifs avant d'accéder à un carré individuel de 4 m².",
        "Outils et arrosoirs stockés dans un cabanon fermé par code ; aucun achat personnel nécessaire.",
        "Engagement : participer à un chantier collectif d'entretien un samedi matin par mois et à un tour d'arrosage l'été.",
        "Ateliers d'initiation au jardinage urbain animés gratuitement deux dimanches par trimestre.",
      ],
      offlineRepliesFr: [
        "Bonjour voisin ! Vous souhaitez rejoindre notre jardin partagé ? Posez-moi toutes vos questions.",
        "L'adhésion annuelle est fixée à vingt-cinq euros par foyer, ce qui couvre l'eau, le compost et les premières graines biologiques.",
        "Les nouveaux adhérents débutent sur les parcelles collectives la première saison, puis peuvent demander un carré individuel de quatre mètres carrés.",
        "Tous les outils sont disponibles dans notre cabanon sécurisé par digicode, ouvert tous les jours de huit heures à vingt et une heures.",
        "Nous demandons simplement deux heures d'entretien collectif par mois et une inscription au planning d'arrosage estival.",
        "Même sans aucune expérience, nos bénévoles animent des ateliers d'initiation chaque trimestre.",
      ],
    },
    tache3: {
      prepSec: 0,
      speakSec: 270,
      questionFr:
        "Pour réduire notre empreinte écologique, la responsabilité repose-t-elle avant tout sur les gestes quotidiens des consommateurs ou sur des contraintes imposées aux industriels ?",
      questionZh: "零准备观点陈述（4 分 30 秒）：减少生态足迹的首要责任究竟在于消费者日常习惯，还是对工业企业施加强制性规范？",
      followUpsFr: [
        "Les produits écologiques ne restent-ils pas trop coûteux pour une grande partie des ménages ?",
        "Que pensez-vous de l'affichage obligatoire d'un score environnemental sur tous les produits vendus ?",
      ],
    },
  },
  {
    id: "tcf-eo-club-randonnee",
    title: "Séjour de randonnée alpine & gratuité des musées",
    topicZh: "户外徒步俱乐部与公共文化普及",
    tache1: {
      prepSec: 0,
      speakSec: 120,
      promptFr:
        "Bonjour. Comment aimez-vous organiser vos vacances ou vos week-ends prolongés ? Préférez-vous la nature, le patrimoine culturel ou le repos complet ?",
      promptZh: "无准备热身（2 分钟）：你通常如何安排假期或长周末？更偏爱自然户外、人文古迹还是彻底放松？",
      followUpsFr: [
        "Quel est le dernier voyage ou l'excursion qui vous a laissé un souvenir marquant ?",
        "Aimez-vous tout planifier longtemps à l'avance ou garder une part d'improvisation ?",
      ],
    },
    tache2: {
      prepSec: 120,
      speakSec: 210,
      targetQuestions: 8,
      roleplayTitleFr: "Inscription à un séjour d'été d'un club de randonnée",
      cardFr:
        "Vous souhaitez participer en juillet à un séjour de quatre jours en montagne organisé par un club associatif de randonnée. Je suis l'accompagnateur responsable du séjour : renseignez-vous sur le niveau physique requis, le dénivelé, l'hébergement en refuge, le transport depuis la gare, le tarif et les conditions d'annulation.",
      examinerRoleFr: "Accompagnateur en montagne du club Sentiers d'Altitude",
      candidateGoalZh: "向山地徒步俱乐部领队（vous）询问夏季四日徒步营的体能与爬升难度、高山木屋住宿餐饮、火车站拼车接驳、团费明细及退改政策。",
      hiddenFactsFr: [
        "Niveau : intermédiaire, environ 5 heures de marche effective et 650 mètres de dénivelé positif par jour.",
        "Hébergement : trois nuits en refuge gardé (dortoirs de 8 places), demi-pension et pique-nique du midi compris.",
        "Transport : navette collective incluse au départ de la gare TGV de Chambéry le jeudi à 9 h.",
        "Tarif tout compris : 310 € pour les adhérents (adhésion annuelle au club : 28 € incluant l'assurance fédérale).",
        "Équipement personnel indispensable : chaussures montantes déjà rodées, veste imperméable et sac à viande.",
        "Annulation : remboursement intégral jusqu'à 15 jours avant le départ, retenue de 30 % ensuite.",
      ],
      offlineRepliesFr: [
        "Bonjour ! Vous vous intéressez à notre randonnée de quatre jours en Vanoise ? Je réponds volontiers à vos questions.",
        "C'est un niveau intermédiaire : comptez environ cinq heures de marche et six cent cinquante mètres de dénivelé par jour.",
        "Le tarif est de trois cent dix euros en pension complète en refuge gardé, plus vingt-huit euros d'adhésion-assurance si vous n'êtes pas encore membre.",
        "Une navette part directement de la gare TGV de Chambéry le jeudi matin à neuf heures.",
        "Prévoyez surtout de bonnes chaussures montantes imperméables et un drap de sac pour les dortoirs.",
        "En cas d'imprévu, l'annulation est sans frais jusqu'à quinze jours avant le départ.",
      ],
    },
    tache3: {
      prepSec: 0,
      speakSec: 270,
      questionFr:
        "Faut-il rendre l'accès permanent aux musées et aux monuments nationaux entièrement gratuit pour tous les publics, ou maintenir une tarification pour financer l'entretien du patrimoine ?",
      questionZh: "零准备观点陈述（4 分 30 秒）：国立博物馆与历史古迹常设展是否应当对所有公众完全免费开放，还是维持门票以补贴文物维护？",
      followUpsFr: [
        "La gratuité suffit-elle vraiment à attirer les publics éloignés de la culture, ou faut-il d'autres actions de médiation ?",
        "Que pensez-vous d'une tarification différenciée entre résidents locaux et touristes internationaux ?",
      ],
    },
  },
];

/* ---------- Built-in Authentic TEF EO (15 min: Sec A `vous` + Sec B `tu`) Suites ---------- */

export interface TefSpeakingSuite {
  id: string;
  title: string;
  topicZh: string;
  adHeadlineFr: string;
  adBodyFr: string;
  adContactFr: string;
  sectionA: {
    prepSec: 60;
    speakSec: 300;
    expectedRegister: "vous";
    targetQuestions: 10;
    examinerRoleFr: string;
    goalZh: string;
    hiddenFactsFr: string[];
    offlineRepliesFr: string[];
  };
  sectionB: {
    prepSec: 60;
    speakSec: 600;
    expectedRegister: "tu";
    friendNameFr: string;
    friendPersonaFr: string;
    goalZh: string;
    objectionsFr: string[];
  };
}

export const TEF_SPEAKING_SUITES: readonly TefSpeakingSuite[] = [
  {
    id: "tef-eo-aviron",
    title: "Club d'aviron loisirs sur la Saône",
    topicZh: "水上赛艇俱乐部（vous 咨询 + tu 劝友报名）",
    adHeadlineFr: "ENVIE DE GLISSER SUR L'EAU ? REJOIGNEZ L'AVIRON CLUB CONFLUENCE !",
    adBodyFr:
      "Tout au long de l'année, notre club associatif accueille les adultes souhaitant découvrir l'aviron de loisir en équipage ou en individuel. Séances encadrées par des moniteurs diplômés, ambiance conviviale au bord de l'eau, sorties matinales et créneaux en semaine. Portes ouvertes ce mois-ci !",
    adContactFr: "Renseignements par téléphone auprès du secrétariat : 04 78 00 42 19.",
    sectionA: {
      prepSec: 60,
      speakSec: 300,
      expectedRegister: "vous",
      targetQuestions: 10,
      examinerRoleFr: "Secrétaire de l'Aviron Club Confluence",
      goalZh: "阅读赛艇俱乐部小广告，用礼貌敬称 vous 致电俱乐部秘书处，围绕未写明的细节提出约 10 个不同问题（零基础要求、游泳证明、排课时间、年费/次卡、试划体验、器材服装、更衣淋浴、交通停车等）。",
      hiddenFactsFr: [
        "Séance d'essai : 2 séances découvertes à 15 € au total, déduits si inscription annuelle ensuite.",
        "Condition obligatoire : savoir nager 50 mètres (attestation sur l'honneur + certificat médical simple).",
        "Créneaux débutants : mercredi 18 h 30–20 h, samedi 9 h–11 h ou dimanche 10 h–12 h.",
        "Cotisation annuelle : 290 € tout compris (licence fédérale, prêt des bateaux, rames et gilet thermique).",
        "Équipement à prévoir : tenue près du corps de type course à pied et chaussures d'eau souples ; vestiaires chauffés et douches sur place.",
        "Accès : arrêt de tramway Musée-des-Confluences à 6 minutes à pied, local à vélos fermé.",
        "Météo : en cas de crue ou vent fort, séance maintenue en salle sur rameurs connectés (ergomètres).",
      ],
      offlineRepliesFr: [
        "Aviron Club Confluence, bonjour ! Que puis-je faire pour vous renseigner ?",
        "Oui, les grands débutants sont tout à fait les bienvenus : il faut simplement attester que vous savez nager cinquante mètres.",
        "Nous proposons un forfait découverte de deux séances pour quinze euros, déductibles de l'adhésion annuelle.",
        "La cotisation annuelle s'élève à deux cent quatre-vingt-dix euros, licence et prêt complet des bateaux inclus.",
        "Pour les adultes débutants, vous avez le choix entre le mercredi soir à dix-huit heures trente, le samedi à neuf heures ou le dimanche à dix heures.",
        "Prévoyez seulement des vêtements près du corps ; nous avons des vestiaires chauffés avec douches chaudes et casiers.",
        "Quand la rivière est trop agitée l'hiver, l'entraînement se poursuit à l'abri sur nos rameurs en salle.",
      ],
    },
    sectionB: {
      prepSec: 60,
      speakSec: 600,
      expectedRegister: "tu",
      friendNameFr: "Camille",
      friendPersonaFr:
        "Ami(e) proche un peu casanier(ère), qui se plaint d'avoir mal au dos devant son ordinateur mais redoute l'eau froide, les réveils matinaux du week-end et les abonnements coûteux.",
      goalZh: "用亲密称呼 tu 打电话给好友 Camille，结合你在 Section A 问到的优势说服他/她一起去体验赛艇俱乐部，逐一化解对方的顾虑（怕冷落水、周末起不来、担心太贵半途而废、上肢没力气等）。",
      objectionsFr: [
        "Tu rigoles ? De l'aviron ? Mais je n'ai aucune force dans les bras et j'ai une peur bleue de chavirer dans l'eau glacée !",
        "En plus, se lever à l'aube le samedi matin alors que je suis épuisé(e) toute la semaine, franchement, très peu pour moi…",
        "Et côté budget, les sports nautiques coûtent toujours une fortune, non ? J'ai déjà payé une salle de sport pour rien l'an dernier.",
        "Et s'il pleut des cordes ou qu'il fait zéro degré en novembre, on se retrouve trempés dehors ?",
        "Bon, tu marques un point avec l'essai… mais comment on y va sans voiture, c'est super loin des transports ?",
      ],
    },
  },
  {
    id: "tef-eo-reparation",
    title: "Atelier de réparation solidaire (Repair Café)",
    topicZh: "公益自助维修工坊（vous 咨询 + tu 劝友修家电）",
    adHeadlineFr: "NE JETEZ PLUS, RÉPAREZ ENSEMBLE ! ATELIER LA CLÉ À MOLETTE",
    adBodyFr:
      "Petit électroménager en panne, vélo déréglé, lampe ou vêtement abîmé ? Nos bénévoles passionnés vous accompagnent pas à pas pour diagnostiquer et remettre en état vos objets du quotidien dans la bonne humeur. Outillage professionnel sur place.",
    adContactFr: "Contactez l'équipe d'accueil au 01 43 00 87 65 avant votre venue.",
    sectionA: {
      prepSec: 60,
      speakSec: 300,
      expectedRegister: "vous",
      targetQuestions: 10,
      examinerRoleFr: "Coordinateur de l'atelier associatif La Clé à Molette",
      goalZh: "阅读公益维修工坊广告，用敬称 vous 致电协调员提出约 10 个具体问题（开放时段、是否需预约、收费或会费、每次限带几件物品、备件怎么买、电脑手机修不修、不会动手能否参加等）。",
      hiddenFactsFr: [
        "Horaires : chaque mercredi de 17 h à 20 h 30 et chaque samedi de 14 h à 18 h.",
        "Réservation : conseillée en ligne pour l'électroménager, accès libre sans rendez-vous pour les vélos.",
        "Tarif : adhésion annuelle à prix libre à partir de 10 € (aucun frais de main-d'œuvre).",
        "Objets acceptés : un seul appareil électrique par séance ; pas de gros électroménager (lave-linge, réfrigérateur) ni de micro-ondes haute tension.",
        "Pièces détachées : diagnostic d'abord sur place, puis commande de la pièce par l'usager et montage à la séance suivante.",
        "Principe : co-réparation pédagogique — le bénévole explique et fait avec vous, ce n'est pas un dépôt-SAV.",
      ],
      offlineRepliesFr: [
        "Atelier La Clé à Molette, bonjour ! Comment puis-je vous aider ?",
        "Nous vous accueillons le mercredi de dix-sept heures à vingt heures trente et le samedi après-midi de quatorze à dix-huit heures.",
        "L'adhésion annuelle est à prix libre à partir de dix euros, et l'accompagnement par nos bénévoles est entièrement gratuit.",
        "Vous pouvez apporter un appareil de petit électroménager par visite sur réservation, à l'exception des fours à micro-ondes pour raisons de sécurité.",
        "S'il manque une pièce détachée, nous vous aidons à trouver la référence exacte et nous la montons ensemble la fois suivante.",
        "Aucune compétence en bricolage n'est requise : nos réparateurs vous montrent chaque geste pas à pas autour d'un café.",
      ],
    },
    sectionB: {
      prepSec: 60,
      speakSec: 600,
      expectedRegister: "tu",
      friendNameFr: "Lucas",
      friendPersonaFr:
        "Ami pressé dont la machine à expresso vient de tomber en panne et qui s'apprête à en racheter une neuve en promotion sur Internet parce qu'il se dit nul en bricolage.",
      goalZh: "用 tu 劝说正打算网购新咖啡机的好友 Lucas 别急着扔旧机器，周末陪他一起去这家公益维修工坊自己修好，逐一反驳他的借口。",
      objectionsFr: [
        "Franchement, ma machine à café a quatre ans, j'ai vu une promo en ligne livrée demain : pourquoi tu veux que je m'embête ?",
        "Mais tu me connais, je ne sais même pas tenir un tournevis ! Je vais tout casser ou prendre un coup de jus.",
        "Les réparateurs professionnels demandent déjà soixante euros rien que pour ouvrir l'appareil, alors ton atelier…",
        "Et s'il faut commander une pièce introuvable, je vais rester trois semaines sans café le matin ?",
        "Samedi après-midi j'avais prévu de me reposer, ça ne va pas nous prendre quatre heures d'attente là-bas ?",
      ],
    },
  },
  {
    id: "tef-eo-tandem-lyon",
    title: "Soirées d'échange linguistique à Lyon",
    topicZh: "里昂语言文化交换之夜（vous 咨询 + tu 劝害羞好友同行）",
    adHeadlineFr: "CAFÉ POLYGLOTTE DES PENTES — PRATIQUEZ LES LANGUES AUTREMENT !",
    adBodyFr:
      "Envie de progresser à l'oral sans stress scolaire ? Chaque semaine, notre association réunit francophones et internationaux autour de tables thématiques et de jeux brise-glace. Toutes langues et tous niveaux confondus !",
    adContactFr: "Informations auprès de l'équipe organisatrice : 06 52 11 94 30.",
    sectionA: {
      prepSec: 60,
      speakSec: 300,
      expectedRegister: "vous",
      targetQuestions: 10,
      examinerRoleFr: "Organisatrice du Café Polyglotte des Pentes",
      goalZh: "阅读语言交换活动广告，用敬称 vous 致电主办人提出约 10 个问题（具体星期几与时间、详细地址、入场费/低消、分组轮换方式、法语母语者比例、怯场新手怎么融入、是否需提前报名等）。",
      hiddenFactsFr: [
        "Jour et horaires : tous les jeudis de 19 h à 22 h (arrivée libre jusqu'à 20 h 15).",
        "Lieu : salon du premier étage du café culturel Le Perchoir, métro Croix-Paquet (Lyon 1er).",
        "Tarif : participation associative de 3 € + une consommation au choix au comptoir (boissons sans alcool dès 3,50 €).",
        "Fonctionnement : badges de langues remis à l'entrée ; tables de 5 personnes avec rotation toutes les 30 minutes (15 min français / 15 min autre langue).",
        "Public : environ la moitié de francophones natifs ; animateurs présents à chaque table avec des cartes de sujets pour relancer les timides.",
        "Inscription : simple formulaire en ligne avant jeudi midi car la salle est limitée à 45 places.",
      ],
      offlineRepliesFr: [
        "Bonjour ! Ici l'association du Café Polyglotte, je vous écoute.",
        "Nos rencontres ont lieu tous les jeudis soir de dix-neuf heures à vingt-deux heures au café Le Perchoir, près du métro Croix-Paquet.",
        "Nous demandons trois euros de participation associative, plus une consommation au bar à partir de trois euros cinquante.",
        "Chaque participant reçoit un badge indiquant sa langue maternelle et la langue pratiquée, par petites tables de cinq personnes.",
        "La moitié des inscrits sont des francophones natifs, et un animateur propose des cartes brise-glace pour éviter tout blanc gênant.",
        "Il suffit de réserver votre place gratuitement sur notre page avant le jeudi midi.",
      ],
    },
    sectionB: {
      prepSec: 60,
      speakSec: 600,
      expectedRegister: "tu",
      friendNameFr: "Inès",
      friendPersonaFr:
        "Amie réservée qui veut améliorer son oral mais redoute les soirées bruyantes dans les bars où personne ne s'écoute et où elle a peur qu'on juge son accent.",
      goalZh: "用 tu 说服性格内向、担心口音被笑话的好友 Inès 本周四晚和你结伴参加这场语言交换活动，针对她的社交焦虑给出具体定心丸。",
      objectionsFr: [
        "Oh là là, parler avec de parfaits inconnus dans un bar le jeudi soir ? Tu sais très bien que je bloque dès qu'il y a du monde !",
        "Dans ce genre de soirée, tout le monde finit par parler anglais et personne n'a la patience d'écouter quelqu'un qui cherche ses mots.",
        "Et puis je ne bois pas d'alcool et je déteste la musique à fond où il faut hurler pour s'entendre.",
        "Trois heures d'affilée après le boulot, je vais rentrer complètement vidée à minuit…",
        "Tu promets qu'on pourra rester à la même table au début si je ne me sens pas à l'aise ?",
      ],
    },
  },
  {
    id: "tef-eo-panier-bio",
    title: "Abonnement hebdomadaire de paniers bio locaux",
    topicZh: "本地有机蔬果篮合订（vous 咨询 + tu 劝友拼单）",
    adHeadlineFr: "DU CHAMP À VOTRE QUARTIER : LES PANIERS DU VAL VERT",
    adBodyFr:
      "Soutenez quatre maraîchers biologiques situés à moins de 30 km ! Chaque semaine, récupérez un panier de légumes et fruits frais de saison près de chez vous. Plusieurs formats disponibles, recettes anti-gaspi incluses.",
    adContactFr: "Renseignements auprès de la coopérative : 02 40 88 15 03.",
    sectionA: {
      prepSec: 60,
      speakSec: 300,
      expectedRegister: "vous",
      targetQuestions: 10,
      examinerRoleFr: "Responsable des adhérents de la coopérative Les Paniers du Val Vert",
      goalZh: "阅读本地有机蔬果篮广告，用敬称 vous 致电合作社提出约 10 个问题（大中小规格与价格、自提点及取菜时间、出差暂停规定、能否换掉不吃的菜、绑定周期、试订体验等）。",
      hiddenFactsFr: [
        "Formats : Petit panier (3 à 3,5 kg, 14 €/semaine) ou Grand panier duo/famille (6 à 7 kg, 24 €/semaine, très avantageux à partager à deux).",
        "Essai : un panier découverte sans engagement disponible la première semaine.",
        "Distribution : tous les mardis de 17 h 30 à 20 h à l'épicerie citoyenne de la place Zola.",
        "Cagette d'échange : sur place, un bac de troc permet d'échanger jusqu'à deux légumes qu'on n'aime pas.",
        "Vacances / absences : possibilité de reporter jusqu'à 4 paniers par semestre en prévenant le dimanche soir.",
        "Engagement : contrat trimestriel payable par prélèvement mensuel, sacs en toile consignés fournis.",
      ],
      offlineRepliesFr: [
        "Coopérative Les Paniers du Val Vert, bonjour ! Je réponds volontiers à vos questions.",
        "Nous proposons un petit panier de trois kilos à quatorze euros, ou un grand panier de six à sept kilos à vingt-quatre euros, idéal à partager.",
        "Vous pouvez tout à fait commander un panier d'essai unique avant de signer un contrat trimestriel.",
        "Le retrait a lieu chaque mardi entre dix-sept heures trente et vingt heures, juste à côté du métro place Zola.",
        "Si un légume ne vous plaît pas, une cagette de troc sur place permet d'échanger jusqu'à deux produits.",
        "En cas de déplacement ou de vacances, vous pouvez suspendre votre livraison quatre fois par semestre en prévenant quarante-huit heures avant.",
      ],
    },
    sectionB: {
      prepSec: 60,
      speakSec: 600,
      expectedRegister: "tu",
      friendNameFr: "Mehdi",
      friendPersonaFr:
        "Voisin et ami proche qui achète souvent des plats préparés au supermarché, craint de se retrouver avec 3 kilos de navets inconnus qui pourrissent au frigo et voyage parfois pour son travail.",
      goalZh: "用 tu 提议和邻居好友 Mehdi 两人拼单合订每周 24 欧元的大号有机蔬果篮（每人仅 12 欧），逐一打消他对菜品不可选、浪费和出差的顾虑。",
      objectionsFr: [
        "Partager un panier bio ? Mais quand je rentre tard le soir, je n'ai aucune idée de comment cuisiner des légumes bizarres pleins de terre !",
        "En plus, si on ne choisit pas le contenu, on va tomber sur des betteraves ou des choux toutes les semaines et la moitié finira à la poubelle.",
        "Et le mardi soir, parfois je suis en déplacement professionnel : qui va récupérer ma part ?",
        "Le bio en circuit court, c'est sûrement beaucoup plus cher que les légumes du supermarché en bas de l'immeuble, non ?",
        "Trois mois d'engagement d'un coup, tu ne trouves pas ça risqué si ça ne nous convient pas ?",
      ],
    },
  },
  {
    id: "tef-eo-benevolat-festival",
    title: "Appel à bénévoles — Festival Cinéma sous les Étoiles",
    topicZh: "露天电影节志愿者招募（vous 咨询 + tu 劝友结伴报名）",
    adHeadlineFr: "DEVENEZ BÉNÉVOLE DU FESTIVAL « CINÉMA SOUS LES ÉTOILES » !",
    adBodyFr:
      "Du 4 au 7 juillet, notre festival de plein air transforme le parc de la Citadelle en salle obscure géante. Accueil du public, billetterie, buvette locale ou accompagnement des réalisateurs invités : vivez les coulisses d'un événement culturel unique !",
    adContactFr: "Coordination des bénévoles : 03 88 21 60 44.",
    sectionA: {
      prepSec: 60,
      speakSec: 300,
      expectedRegister: "vous",
      targetQuestions: 10,
      examinerRoleFr: "Responsable des bénévoles du festival Cinéma sous les Étoiles",
      goalZh: "阅读露天电影节志愿者招募启事，用敬称 vous 致电志愿者协调人提出约 10 个问题（最少排班时长、具体岗位选择、餐饮与观影福利、夜间散场交通、岗前培训、双人同班安排等）。",
      hiddenFactsFr: [
        "Engagement minimal : deux créneaux de 4 heures sur l'ensemble des quatre jours (au choix après-midi ou soirée).",
        "Binômes : possibilité garantie d'être affecté(e) sur le même stand qu'un(e) ami(e) si mentionné à l'inscription.",
        "Avantages : repas chaud offert à chaque créneau, t-shirt officiel et pass illimité gratuit pour toutes les projections et avant-premières.",
        "Retour tardif : navettes gratuites affrétées par le festival à minuit trente vers le centre-ville et le campus.",
        "Formation : réunion conviviale d'accueil d'une heure le mercredi 3 juillet à 18 h 30 avec buffet.",
        "Missions sans port de charges : accueil-orientation, contrôle des billets ou stand librairie-affiches.",
      ],
      offlineRepliesFr: [
        "Festival Cinéma sous les Étoiles, bonjour ! Merci de votre intérêt pour l'équipe bénévole.",
        "L'engagement minimal est très souple : seulement deux créneaux de quatre heures répartis sur les quatre jours du festival.",
        "Oui, si vous vous inscrivez avec un proche, nous pouvons vous placer ensemble sur la même mission d'accueil ou de billetterie.",
        "Chaque bénévole bénéficie des repas chauds sur place et d'un pass gratuit donnant accès à toutes les séances hors créneau.",
        "Pour les séances qui finissent vers minuit, des navettes gratuites ramènent l'équipe jusqu'au centre-ville.",
        "Une courte réunion de présentation avec buffet est prévue la veille de l'ouverture à dix-huit heures trente.",
      ],
    },
    sectionB: {
      prepSec: 60,
      speakSec: 600,
      expectedRegister: "tu",
      friendNameFr: "Chloé",
      friendPersonaFr:
        "Amie cinéphile qui adore les films d'auteur mais craint d'être exploitée à porter des barrières métalliques toute la journée sans voir un seul film ni pouvoir rentrer chez elle à minuit.",
      goalZh: "用 tu 说服热爱电影却担心当免费苦力的好友 Chloé 和你一起报名当两天露天电影节志愿者，用具体福利与排班灵活性打动她。",
      objectionsFr: [
        "Bénévole dans un festival ? J'ai déjà donné une fois : tu passes dix heures debout à porter des caisses et tu ne vois pas une seule minute de film !",
        "En plus les projections en plein air commencent à la tombée de la nuit : à minuit passé il n'y a plus aucun bus pour rentrer chez moi.",
        "Travailler gratuitement pendant mon week-end d'été et devoir payer mon sandwich sur place, franchement ce n'est pas un cadeau…",
        "Et si l'organisation nous sépare à deux bouts opposés du parc avec des gens qu'on ne connaît pas ?",
        "Il faut sûrement bloquer les quatre jours entiers du jeudi au dimanche, non ? J'ai un déjeuner de famille le dimanche midi.",
      ],
    },
  },
  {
    id: "tef-eo-theatre-soir",
    title: "Cours du soir d'improvisation théâtrale",
    topicZh: "成人晚间即兴戏剧课（vous 咨询 + tu 劝友解压尝试）",
    adHeadlineFr: "OSEZ LACHER PRISE ! ATELIERS D'IMPROVISATION THÉÂTRALE ADULTES",
    adBodyFr:
      "Développez votre spontanéité, votre écoute et votre aisance à l'oral par le jeu ! Cours hebdomadaires en petit groupe animés par des comédiens professionnels. Aucun texte à apprendre par cœur.",
    adContactFr: "Renseignements auprès du Théâtre de l'Élan : 05 56 44 18 90.",
    sectionA: {
      prepSec: 60,
      speakSec: 300,
      expectedRegister: "vous",
      targetQuestions: 10,
      examinerRoleFr: "Directeur pédagogique du Théâtre de l'Élan",
      goalZh: "阅读成人即兴戏剧晚间班广告，用敬称 vous 致电教务主任询问约 10 个细节（分组人数、零基础班时间、试听课费用、季度/全年价格、是否强制登台演出、地点及请假补课机制等）。",
      hiddenFactsFr: [
        "Taille des groupes : 10 à 12 participants maximum, groupe spécifique « Grands débutants » chaque mardi de 19 h 30 à 21 h 30.",
        "Cours d'essai : première séance découverte gratuite sur simple inscription téléphonique.",
        "Tarifs : abonnement au trimestre à 135 € (soit 12 séances de 2 heures), payable en trois fois.",
        "Spectacle de fin de trimestre : 100 % facultatif devant les proches uniquement, aucune obligation de monter sur scène.",
        "Rattrapage : en cas d'absence, possibilité de récupérer la séance le jeudi soir dans l'autre groupe débutant.",
        "Lieu : salle parquetée au 14 rue des Faures, à 3 minutes de l'arrêt de tram Porte-de-Bourgogne.",
      ],
      offlineRepliesFr: [
        "Théâtre de l'Élan, bonjour ! Vous appelez au sujet des ateliers d'improvisation ?",
        "Notre cours réservé aux grands débutants a lieu chaque mardi de dix-neuf heures trente à vingt et une heures trente, en petit groupe de douze maximum.",
        "La toute première séance d'essai est entièrement gratuite et sans engagement.",
        "Ensuite, l'inscription fonctionne au trimestre pour cent trente-cinq euros les douze séances de deux heures.",
        "Rassurez-vous, le petit spectacle de fin de trimestre est totalement facultatif : personne n'est forcé de jouer devant un public.",
        "Si vous manquez un mardi, vous pouvez rattraper votre cours le jeudi soir de la même semaine.",
      ],
    },
    sectionB: {
      prepSec: 60,
      speakSec: 600,
      expectedRegister: "tu",
      friendNameFr: "Thomas",
      friendPersonaFr:
        "Ami stressé par ses réunions professionnelles, qui aimerait être plus à l'aise à l'oral mais a une mémoire catastrophique pour apprendre des textes et redoute le ridicule sur scène.",
      goalZh: "用 tu 劝说工作压力大、想练口才却怕背台词出丑的好友 Thomas 下周二晚先和你一起去上免费试听课，逐条化解他的心理障碍。",
      objectionsFr: [
        "Du théâtre ? Mais j'ai une mémoire de poisson rouge, je suis totalement incapable d'apprendre des tirades par cœur après le boulot !",
        "Improviser devant des comédiens confirmés qui vont me regarder bégayer sur scène, c'est mon pire cauchemar…",
        "Et à la fin de l'année ils obligent toujours tout le monde à jouer un spectacle devant cent personnes, non ?",
        "S'engager pour dix mois à cinq cents euros alors que j'ai parfois des réunions tardives le mardi, c'est trop risqué.",
        "Franchement à dix-neuf heures trente je suis crevé, tu crois vraiment que ça détend au lieu de rajouter de la fatigue ?",
      ],
    },
  },
];
