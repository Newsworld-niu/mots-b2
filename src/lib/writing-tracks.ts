/**
 * TCF Expression Écrite (3 tasks, 60 min, 0–20 + CEFR/NCLC) &
 * TEF Expression Écrite post-Dec-2023 (Sec A fait divers ≥80w + Sec B lettre argumentative ≥200w, 60 min, 0–699 + NCLC):
 * built-in authentic exam suites and deterministic per-task word-count meters.
 */
import { countWords } from "./essay-schema";

export type WordMeterStatus = "under" | "ok" | "over";

export interface TrackWordMeter {
  words: number;
  minWords: number;
  maxWords?: number;
  recommendedMaxWords?: number;
  status: WordMeterStatus;
  label: string;
}

/**
 * Evaluate per-task word count against official TCF (`[minWords, maxWords]` strict window)
 * or TEF (`minWords` mandatory floor + `recommendedMaxWords` pacing guide).
 */
export function evaluateTrackWordMeter(
  text: string,
  bounds: { minWords: number; maxWords?: number; recommendedMaxWords?: number },
): TrackWordMeter {
  const words = countWords(text);
  const { minWords, maxWords, recommendedMaxWords } = bounds;

  if (words < minWords) {
    const diff = minWords - words;
    const rangeDesc = maxWords
      ? `官方字数区间 ${minWords}–${maxWords} 词`
      : `官方下限 ≥${minWords} 词${recommendedMaxWords ? `（推荐 ${minWords}–${recommendedMaxWords} 词）` : ""}`;
    return {
      words,
      minWords,
      ...(maxWords !== undefined ? { maxWords } : {}),
      ...(recommendedMaxWords !== undefined ? { recommendedMaxWords } : {}),
      status: "under",
      label: `${words} 词 · 还差 ${diff} 词（${rangeDesc}）`,
    };
  }

  if (maxWords !== undefined && words > maxWords) {
    const over = words - maxWords;
    return {
      words,
      minWords,
      maxWords,
      status: "over",
      label: `${words} 词 · 超出上限 ${over} 词（TCF 官方限 ${minWords}–${maxWords} 词，超字数会扣分）`,
    };
  }

  const okDesc = maxWords
    ? `符合 TCF 官方 ${minWords}–${maxWords} 词区间`
    : `已达 TEF 官方 ≥${minWords} 词下限${recommendedMaxWords ? `（推荐 ${minWords}–${recommendedMaxWords} 词）` : ""}`;

  return {
    words,
    minWords,
    ...(maxWords !== undefined ? { maxWords } : {}),
    ...(recommendedMaxWords !== undefined ? { recommendedMaxWords } : {}),
    status: "ok",
    label: `${words} 词 · ${okDesc}`,
  };
}

/* ---------- TCF Expression Écrite (3 Tasks, 60 min, /20) ---------- */

export interface TcfWritingTaskSpec {
  taskNo: 1 | 2 | 3;
  titleZh: string;
  minWords: number;
  maxWords: number;
  consigneFr: string;
  hintZh: string;
  docAFr?: string;
  docBFr?: string;
}

export interface TcfWritingSuite {
  id: string;
  title: string;
  topicZh: string;
  durationMinutes: 60;
  tasks: [TcfWritingTaskSpec, TcfWritingTaskSpec, TcfWritingTaskSpec];
}

export const TCF_WRITING_SUITES: readonly TcfWritingSuite[] = [
  {
    id: "tcf-ee-mobilite-douce",
    title: "Mobilités douces & gratuité des transports",
    topicZh: "绿色骑行与公共交通免费争议",
    durationMinutes: 60,
    tasks: [
      {
        taskNo: 1,
        titleZh: "Tâche 1 · 邻里骑行邀请短讯（60–120 词）",
        minWords: 60,
        maxWords: 120,
        consigneFr:
          "Vous organisez dimanche prochain une sortie à vélo au bord d'un canal avec quelques voisins de votre immeuble. Écrivez un message dans le groupe des résidents pour préciser l'itinéraire, l'heure et le lieu de départ, ce qu'il faut apporter et ce qui est prévu à midi.",
        hintZh: "实用信息完备（时间、集合点、路线长度、自带水壶/头盔、野餐安排），语气自然友好。",
      },
      {
        taskNo: 2,
        titleZh: "Tâche 2 · 放弃私家车通勤经验帖（120–150 词）",
        minWords: 120,
        maxWords: 150,
        consigneFr:
          "Un blog francophone consacré à la vie quotidienne publie des témoignages sur le thème « Changer ses trajets domicile-travail ». Rédigez un article racontant comment vous avez adopté le train et le vélo pendant un mois : décrivez les difficultés du début, les bénéfices constatés et donnez deux conseils pratiques aux lecteurs.",
        hintZh: "结合过去时叙述亲身经历 + 困难与收获对比 + 给读者的两条具体建议，严控 120–150 词。",
      },
      {
        taskNo: 3,
        titleZh: "Tâche 3 · 双材料综述与评论：公交全面免费（120–180 词）",
        minWords: 120,
        maxWords: 180,
        docAFr:
          "Document 1 — Association Citoyens en Mouvement : « Rendre les bus et tramways gratuits pour tous redonne immédiatement du pouvoir d'achat aux ménages modestes et désengorge les centres-villes. Dans plusieurs agglomérations moyennes, la fréquentation a bondi de 35 % dès la première année, réduisant le bruit et la pollution. »",
        docBFr:
          "Document 2 — Fédération des Réseaux Urbains : « La gratuité totale prive les collectivités de recettes indispensables pour prolonger les lignes vers les banlieues mal desservies. Or un automobiliste n'abandonne sa voiture que si les rames sont fréquentes, ponctuelles et étendues, pas simplement parce que le ticket coûte zéro euro. »",
        consigneFr:
          "À partir des deux documents ci-dessus, rédigez un texte structuré en deux paragraphes : dans une première partie (40 à 60 mots), reformulez avec vos propres mots les deux points de vue opposés sans recopier les textes ; dans une seconde partie (80 à 120 mots), exprimez et justifiez votre opinion personnelle.",
        hintZh: "第 1 段客观同义综述两篇材料的对立论点（严禁原句照抄，40–60 词）；第 2 段提出个人辩证立场并论证（80–120 词），总字数严控 120–180 词。",
      },
    ],
  },
  {
    id: "tcf-ee-numerique-detox",
    title: "Déconnexion numérique & semaine de quatre jours",
    topicZh: "数字断联生活与四天工作制",
    durationMinutes: 60,
    tasks: [
      {
        taskNo: 1,
        titleZh: "Tâche 1 · 无手机桌游夜邀请邮件（60–120 词）",
        minWords: 60,
        maxWords: 120,
        consigneFr:
          "Vous souhaitez organiser samedi soir une soirée « zéro écran » autour de jeux de société chez vous. Écrivez un courriel à vos amis pour leur expliquer le principe de la soirée, l'heure d'arrivée, le repas partagé et leur demander de confirmer leur présence.",
        hintZh: "交代活动规则（进门收起手机）、周六时间、每人带一道菜、请回复确认。",
      },
      {
        taskNo: 2,
        titleZh: "Tâche 2 · 一周断网度假体验文章（120–150 词）",
        minWords: 120,
        maxWords: 150,
        consigneFr:
          "Le magazine en ligne Vivre Mieux invite ses lecteurs à raconter une semaine de vacances passée sans connexion Internet ni réseaux sociaux. Décrivez le lieu choisi, vos réactions les premiers jours, ce que cette pause vous a apporté et dites si vous recommanderiez cette expérience.",
        hintZh: "写出前两天的不适应到后来的专注放松，结尾明确给出推荐理由，严控 120–150 词。",
      },
      {
        taskNo: 3,
        titleZh: "Tâche 3 · 双材料综述与评论：四天工作制（120–180 词）",
        minWords: 120,
        maxWords: 180,
        docAFr:
          "Document 1 — Tribune RH : « Concentrer la semaine en quatre jours sans baisse de salaire diminue l'épuisement professionnel et attire les talents. Les entreprises pionnières observent moins d'arrêts maladie et des réunions beaucoup plus efficaces, car chacun élimine les temps morts. »",
        docBFr:
          "Document 2 — Syndicat des PME de services : « Dans les hôpitaux, les commerces ou l'artisanat, comprimer trente-cinq heures sur quatre journées rallonge excessivement l'amplitude quotidienne, complique la garde des enfants le soir et oblige les petites structures à embaucher à perte. »",
        consigneFr:
          "En vous appuyant sur les deux documents proposés, présentez d'abord en un court paragraphe (40 à 60 mots) la nature du débat avec vos propres mots, puis développez dans un second paragraphe (80 à 120 mots) votre point de vue argumenté sur la semaine de quatre jours.",
        hintZh: "第 1 段用自己语言概括支持方（效率与健康）与反对方（行业限制与单日过劳）；第 2 段分情况展开个人主张，总词数 120–180 词。",
      },
    ],
  },
  {
    id: "tcf-ee-alimentation-locale",
    title: "Cuisine de quartier & publicité alimentaire",
    topicZh: "社区美食工坊与垃圾食品广告禁令",
    durationMinutes: 60,
    tasks: [
      {
        taskNo: 1,
        titleZh: "Tâche 1 · 社区烹饪课变更通知（60–120 词）",
        minWords: 60,
        maxWords: 120,
        consigneFr:
          "Vous êtes bénévole dans un club de cuisine de quartier. La séance de jeudi prochain change exceptionnellement de salle et de thème. Écrivez un message aux inscrits pour annoncer le nouveau lieu, la recette prévue, les ustensiles à apporter et vous excuser de ce contretemps.",
        hintZh: "说明更换场地原因与新地址、本周菜谱、需自备围裙/餐盒，并礼貌致歉。",
      },
      {
        taskNo: 2,
        titleZh: "Tâche 2 · 农场直购体验分享帖（120–150 词）",
        minWords: 120,
        maxWords: 150,
        consigneFr:
          "Sur un forum de consommateurs responsables, vous publiez un témoignage intitulé « Six mois d'achats directs chez les producteurs locaux ». Racontez pourquoi vous avez tenté cette démarche, comment vos habitudes culinaires ont évolué et mentionnez une contrainte réelle dont il faut tenir compte.",
        hintZh: "兼顾初衷、饮食变化与客观不便（如取货时间固定或冬季品种较少），严控 120–150 词。",
      },
      {
        taskNo: 3,
        titleZh: "Tâche 3 · 双材料综述与评论：禁播高糖食品广告（120–180 词）",
        minWords: 120,
        maxWords: 180,
        docAFr:
          "Document 1 — Collectif Pédiatres Santé : « Les enfants sont exposés chaque jour à des dizaines de publicités vantant des boissons sucrées et des snacks ultra-transformés sur les écrans. Interdire ce marketing aux heures familiales est une mesure urgente de santé publique contre l'obésité infantile. »",
        docBFr:
          "Document 2 — Union des Médias et Annonceurs : « Une interdiction publicitaire priverait les chaînes et créateurs de contenus d'un financement majeur sans modifier le contenu des assiettes. C'est par l'éducation nutritionnelle à l'école et le sport quotidien qu'on forme durablement le goût des jeunes. »",
        consigneFr:
          "Rédigez une synthèse comparative des deux documents (40 à 60 mots, sans citation copiée), suivie d'un paragraphe argumentatif (80 à 120 mots) présentant votre position personnelle sur l'encadrement de la publicité alimentaire.",
        hintZh: "先用同义改写对比儿科医生团体与广告媒体联盟的论据，再论证监管与校园教育如何配合，总词数 120–180 词。",
      },
    ],
  },
  {
    id: "tcf-ee-habitat-partage",
    title: "Vie d'immeuble & encadrement des meublés touristiques",
    topicZh: "公寓共享空间改造与旅游短租监管",
    durationMinutes: 60,
    tasks: [
      {
        taskNo: 1,
        titleZh: "Tâche 1 · 公寓庭院改造意见征集信（60–120 词）",
        minWords: 60,
        maxWords: 120,
        consigneFr:
          "La cour intérieure de votre immeuble est actuellement inutilisée. Écrivez un message courtois à vos voisins pour proposer d'y installer un abri à vélos et quelques bacs à fleurs, et invitez-les à en discuter lors d'une courte réunion cette semaine.",
        hintZh: "礼貌提出两项具体改造设想（自行车棚与花箱），给出商议时间地点并欢迎补充建议。",
      },
      {
        taskNo: 2,
        titleZh: "Tâche 2 · 跨代合租一年回顾文章（120–150 词）",
        minWords: 120,
        maxWords: 150,
        consigneFr:
          "Le journal étudiant de votre université prépare un dossier sur les logements alternatifs. Rédigez un article relatant votre année de cohabitation chez une personne âgée : évoquez vos appréhensions initiales, les moments de partage marquants et les règles essentielles pour que l'entente réussisse.",
        hintZh: "包含起初顾虑、真实温馨互动细节与相互尊重边界的经验总结，严控 120–150 词。",
      },
      {
        taskNo: 3,
        titleZh: "Tâche 3 · 双材料综述与评论：限制旅游短租（120–180 词）",
        minWords: 120,
        maxWords: 180,
        docAFr:
          "Document 1 — Association Droit au Toit : « Dans les quartiers historiques, des milliers d'appartements autrefois loués à l'année aux étudiants et aux salariés sont transformés en meublés touristiques très rentables. Plafonner strictement le nombre de nuitées annuelles est vital pour stopper la hausse des loyers. »",
        docBFr:
          "Document 2 — Cercle des Hôtes Indépendants : « Louer son logement quelques semaines par an permet à de nombreux ménages de financer leurs charges ou des travaux d'isolation. De plus, ces visiteurs font vivre directement les boulangeries, musées et restaurants de quartier hors des zones hôtelières. »",
        consigneFr:
          "Présentez dans un premier paragraphe (40 à 60 mots) les thèses opposées des deux documents avec vos propres mots, puis exposez dans un second paragraphe (80 à 120 mots) votre avis nuancé sur la régulation des locations touristiques.",
        hintZh: "先客观综述居住权协会与房东团体的分歧（勿抄原词），再区分自住房偶尔短租与商业囤房给出辩证方案，总词数 120–180 词。",
      },
    ],
  },
];

/* ---------- TEF Expression Écrite post-Dec-2023 (Sec A + Sec B, 60 min, /699 + NCLC) ---------- */

export interface TefWritingSuite {
  id: string;
  title: string;
  topicZh: string;
  durationMinutes: 60;
  sectionA: {
    minWords: 80;
    recommendedMaxWords: 140;
    headlineFr: string;
    leadFr: string;
    consigneFr: string;
    hintZh: string;
  };
  sectionB: {
    minWords: 200;
    recommendedMaxWords: 280;
    claimFr: string;
    consigneFr: string;
    hintZh: string;
  };
}

export const TEF_WRITING_SUITES: readonly TefWritingSuite[] = [
  {
    id: "tef-ee-colis-mystere",
    title: "Colis égaré depuis trente ans & commerce en ligne",
    topicZh: "迟到三十年的神秘包裹 + 网购与街区实体店",
    durationMinutes: 60,
    sectionA: {
      minWords: 80,
      recommendedMaxWords: 140,
      headlineFr: "Nantes : un colis posté en 1996 arrive enfin chez sa destinataire",
      leadFr:
        "Jeudi matin, en ouvrant sa boîte aux lettres, Hélène Moreau, une retraitée nantaise de soixante-huit ans, a découvert un paquet jauni couvert de timbres en francs. Posté trente ans plus tôt depuis Montréal, l'envoi avait mystérieusement disparu des radars postaux.",
      consigneFr:
        "Rédigez la suite de ce fait divers (au moins 80 mots, sans compter le début fourni) pour le journal local : racontez ce que contenait le colis, l'explication de ce retard inhabituel et la réaction des protagonistes.",
      hintZh: "新闻特写续写（新增正文 ≥80 词）：灵活交替使用复合过去时（事件推进）、未完成过去时（背景细节）、愈过去时与被动语态，交代包裹内容、滞留原因与当事人反应。",
    },
    sectionB: {
      minWords: 200,
      recommendedMaxWords: 280,
      claimFr: "« Le commerce en ligne fera disparaître toute vie de quartier d'ici dix ans. »",
      consigneFr:
        "Vous avez lu cette affirmation dans un quotidien régional. Écrivez une lettre argumentée au courrier des lecteurs (au moins 200 mots) pour exprimer votre point de vue nuancé en développant au moins trois arguments illustrés d'exemples précis.",
      hintZh: "读者来信正式书信体（≥200 词）：须含正式称呼（Monsieur le Rédacteur en chef, / Madame, Monsieur,）与致敬落款，至少展开 3 个带实例的论点并体现让步思辨。",
    },
  },
  {
    id: "tef-ee-chevre-tramway",
    title: "Deux chèvres dans le tramway & voitures en centre-ville",
    topicZh: "有轨电车奇遇两只山羊 + 市中心禁行私家车",
    durationMinutes: 60,
    sectionA: {
      minWords: 80,
      recommendedMaxWords: 140,
      headlineFr: "Bordeaux : deux voyageuses à cornes prennent le tramway à l'heure de pointe",
      leadFr:
        "Mardi vers huit heures quinze, les passagers endormis de la ligne B du tramway bordelais n'en ont pas cru leurs yeux : à l'arrêt Peixotto, deux chèvres naines ont tranquillement franchi les portes automatiques sans le moindre titre de transport.",
      consigneFr:
        "Poursuivez ce fait divers (au moins 80 mots rédigés par vous) en précisant d'où venaient ces animaux, comment les passagers et le conducteur ont réagi et comment l'incident s'est terminé.",
      hintZh: "新闻奇闻续写（新增正文 ≥80 词）：运用报刊叙事笔法（passé composé / imparfait / voix passive / 引语），交代山羊从何处溜出、车厢反应与最终平安归还。",
    },
    sectionB: {
      minWords: 200,
      recommendedMaxWords: 280,
      claimFr: "« Il faut interdire totalement les voitures individuelles dans tous les centres-villes. »",
      consigneFr:
        "À la suite d'un débat publié dans la presse, vous adressez une lettre ouverte à la rédaction (au moins 200 mots) afin de défendre votre position à l'aide d'au moins trois arguments structurés et d'exemples concrets.",
      hintZh: "正式读者来信（≥200 词）：兼顾生态宜居与行动不便者/郊区通勤者/商户卸货等现实限制，严守正式信函首尾套语。",
    },
  },
  {
    id: "tef-ee-violon-gare",
    title: "Violon centenaire retrouvé & réseaux sociaux",
    topicZh: "火车遗落百年小提琴失而复得 + 社交网络疏离争议",
    durationMinutes: 60,
    sectionA: {
      minWords: 80,
      recommendedMaxWords: 140,
      headlineFr: "Strasbourg : un violon centenaire oublié dans un TER retrouvé en quelques heures",
      leadFr:
        "Dimanche soir, en descendant précipitamment sur le quai de la gare de Strasbourg, Julien Mercier a réalisé avec effroi que l'étui contenant le violon familial de 1920 était resté dans le porte-bagages du train qui repartait déjà vers Bâle.",
      consigneFr:
        "Écrivez la suite de cet article de fait divers (au moins 80 mots nouveaux) en racontant la mobilisation inattendue qui a permis de localiser l'instrument et les retrouvailles émouvantes.",
      hintZh: "社会新闻续写（新增正文 ≥80 词）：用准确过去时态与被动句叙述列车员/乘客接力寻找及归还致谢细节。",
    },
    sectionB: {
      minWords: 200,
      recommendedMaxWords: 280,
      claimFr: "« Les réseaux sociaux isolent les individus beaucoup plus qu'ils ne les rapprochent. »",
      consigneFr:
        "Réagissez à cette déclaration lue dans un magazine culturel en écrivant une lettre argumentée au courrier des lecteurs (au moins 200 mots), structurée autour d'au moins trois arguments appuyés par des exemples.",
      hintZh: "正式读者来信（≥200 词）：遵循正式书信格式，避免机械罗列连接词，深入剖析线上社群互助与浅层社交焦虑的双重性。",
    },
  },
  {
    id: "tef-ee-potager-toit",
    title: "Récolte record sur un toit lyonnais & temps de travail",
    topicZh: "公寓楼顶意外丰收 + 缩短工时与生活质量",
    durationMinutes: 60,
    sectionA: {
      minWords: 80,
      recommendedMaxWords: 140,
      headlineFr: "Lyon : le potager improvisé sur le toit d'un immeuble attire tout le quartier",
      leadFr:
        "Au printemps dernier, lorsque trois locataires d'une résidence du septième arrondissement ont obtenu l'autorisation d'installer quelques bacs en bois sur leur toit-terrasse bétonné, personne n'imaginait que l'initiative prendrait une telle ampleur.",
      consigneFr:
        "Continuez ce fait divers (au moins 80 mots rédigés par vous) en décrivant la récolte surprenante de l'été, l'événement organisé par les habitants et les conséquences inattendues pour la copropriété.",
      hintZh: "报刊特写续写（新增正文 ≥80 词）：围绕夏季丰收数字、邻里分享晚宴及周边楼宇效仿展开生动叙述。",
    },
    sectionB: {
      minWords: 200,
      recommendedMaxWords: 280,
      claimFr: "« Travailler moins d'heures par semaine est le seul moyen d'améliorer réellement la qualité de vie. »",
      consigneFr:
        "Vous écrivez au courrier des lecteurs d'un hebdomadaire économique (au moins 200 mots) pour discuter cette affirmation en présentant une argumentation nuancée d'au moins trois arguments et exemples précis.",
      hintZh: "正式读者来信（≥200 词）：严格书信格式，在肯定闲暇价值的同时探讨工作意义、薪酬购买力与弹性自主权等其他关键维度。",
    },
  },
];
