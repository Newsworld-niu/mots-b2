import type { ParagraphUpgrade } from "../ai/tasks";
import type { EssayFeedback } from "./essay-schema";

export interface EssaySamplePreview {
  title: string;
  level: "B2";
  wordCount: number;
  text: string;
  fb: EssayFeedback;
}

export interface SpeakingSamplePreview {
  title: string;
  problematic: string;
  monologueExcerpt: string;
  debateExcerpt: { q: string; a: string }[];
  fb: EssayFeedback;
  phonoScore: number;
}

export const SAMPLE_ESSAY_PREVIEW: EssaySamplePreview = {
  title: "市中心限行倡议 · 致市长的读者来信（21/25 高分样张）",
  level: "B2",
  wordCount: 268,
  text: [
    "Monsieur le Maire,",
    "À la suite de votre récente déclaration sur le réaménagement du centre-ville, je me permets de vous faire part de mon point de vue en tant qu'habitant et usager quotidien des transports.",
    "Certes, la réduction de la circulation automobile permettrait de diminuer les émissions polluantes et d'améliorer la qualité de vie des riverains. Force est de constater que la place occupée par les voitures nuit aujourd'hui à la sécurité des piétons.",
    "Toutefois, une interdiction totale dès cet automne risquerait de pénaliser les commerçants de proximité ainsi que les habitants des zones périphériques, faute d'alternatives de transport fiables le soir.",
    "C'est pourquoi je vous propose une mise en place progressive : élargir d'abord les horaires des tramways et créer des parkings relais gratuits en périphérie avant d'étendre la zone piétonne.",
    "En espérant que ces propositions retiendront votre attention, je vous prie d'agréer, Monsieur le Maire, l'expression de ma considération distinguée.",
  ].join("\n\n"),
  fb: {
    scores: { task: 5, coherence: 4, socio: 5, lexique: 4, morpho: 3 },
    comment:
      "总体达到强 B2 水平：书信格式与敬辞无懈可击，让步—转折—建设性方案三段式推进清晰；如能在第 3 段补充一处虚拟式从句并丰富动词搭配，词法与语法分可冲刺满分。",
    strengths: [
      "正式语体贯穿全文（À la suite de / je me permets de / l'expression de ma considération distinguée）。",
      "精准运用 Certes… Toutefois… C'est pourquoi 推进辩证立场，并给出可落地替代方案。",
    ],
    todo: [
      "尝试在条件或让步句中嵌入高级虚拟式或条件式（如 pourvu que les transports soient renforcés）。",
      "避免高频复现运输泛称，可换用 dessertes locales / mobilité douce。",
    ],
    corrections: [
      {
        wrong: "faute d'alternatives de transport fiables le soir",
        right: "faute d'une desserte nocturne suffisamment dense",
        type: "word-choice",
        why: "在讨论城市公共交通的 B2 正式来信中，desserte nocturne 比 alternatives de transport 更地道精准。",
        point: "",
      },
      {
        wrong: "la place occupée par les voitures nuit aujourd'hui à la sécurité",
        right: "l'emprise croissante de l'automobile compromet désormais la sécurité",
        type: "word-choice",
        why: "使用名词化短语 l'emprise croissante 与 compromettre，可显著拉开与 B1 句式的档次。",
        point: "",
      },
      {
        wrong: "avant d'étendre la zone piétonne",
        right: "avant que la zone piétonne ne soit définitivement élargie",
        type: "conjugation",
        why: "使用 avant que ... ne + 虚拟式被动结构展示复杂句法控制力。",
        point: "subjonctif",
      },
    ],
    rewrite:
      "Monsieur le Maire,\n\nÀ la suite de votre récente prise de position sur le réaménagement du centre-ville, je tiens à vous faire part de mes observations.\n\nCertes, la diminution du trafic automobile contribuerait à réduire les pics de pollution. Néanmoins, une interdiction immédiate fragiliserait les commerces de proximité faute d'une desserte nocturne suffisamment dense.\n\nC'est pourquoi il me semblerait pertinent d'aménager d'abord des parcs relais gratuits avant que la zone piétonne ne soit élargie.",
  },
};

export const SAMPLE_SPEAKING_PREVIEW: SpeakingSamplePreview = {
  title: "远程办公是否正在瓦解团队凝聚力？（20/25 高分样张）",
  problematic: "Comment concilier la flexibilité offerte par le travail à distance avec le maintien d'une véritable cohésion d'équipe en entreprise ?",
  monologueExcerpt:
    "À mon sens, le télétravail ne constitue pas une menace en soi, à condition qu'il soit encadré par un modèle hybride clair : deux jours en présentiel consacrés aux projets collectifs et à l'intégration des nouveaux recrutés.",
  debateExcerpt: [
    {
      q: "Mais si chacun choisit ses jours à la maison, ne risque-t-on pas de perdre les échanges spontanés devant la machine à café ?",
      a: "C'est précisément pour cela qu'il convient de fixer deux journées communes obligatoires, plutôt que de laisser chacun venir de façon dispersée.",
    },
    {
      q: "Certains managers craignent pourtant une baisse de productivité sans contrôle visuel direct. Qu'en pensez-vous ?",
      a: "Au contraire, les études montrent que l'évaluation par objectifs responsabilise davantage les salariés qu'une simple présence physique au bureau.",
    },
  ],
  phonoScore: 4,
  fb: {
    scores: { monologue: 4, interaction: 4, lexique: 4, morpho: 4 },
    comment:
      "独白精准提炼出双核矛盾（灵活度 vs 团队凝聚力），并能在考官追问下不回避反方观点、迅速提出「共同返岗日」方案，互动反应流畅自然。",
    strengths: [
      "开篇即明确界定 problématique，论证结构呈「定调→利弊权衡→条件建议」。",
      "辩论环节能正面接住反驳（C'est précisément pour cela que… / Au contraire…）。",
    ],
    todo: [
      "适当加入 1–2 个法国本地现实案例（如 accords d'entreprise sur le télétravail 或 tiers-lieux ruraux）增强说服力。",
    ],
    corrections: [
      {
        wrong: "les nouveaux recrutés",
        right: "les nouvelles recrues",
        type: "word-choice",
        why: "在人力资源与职场讨论语境下，les nouvelles recrues（阳性或女性均用 recrue 阴性名词）比 recrutés 更符合法语习惯。",
        point: "",
      },
      {
        wrong: "il faut fixer deux journées communes",
        right: "il conviendrait d'instaurer deux journées d'équipe fixes",
        type: "tense",
        why: "口语提出政策/企业管理建议时，条件式 il conviendrait de 比直陈式 il faut 更具协商感与 B2 语域分寸。",
        point: "conditionnel",
      },
    ],
    rewrite: "",
  },
};

export const SAMPLE_PARAGRAPH_UPGRADE: ParagraphUpgrade = {
  upgraded:
    "Bien que le déploiement du travail à distance favorise un meilleur équilibre entre vie professionnelle et vie privée, son absence d'encadrement risque d'accentuer l'isolement des jeunes actifs. Il conviendrait dès lors d'instaurer des temps de présence communs afin de préserver la transmission des savoir-faire.",
  changes: [
    {
      before: "Beaucoup de gens aiment le télétravail parce que c'est plus facile pour la vie.",
      after: "le déploiement du travail à distance favorise un meilleur équilibre entre vie professionnelle et vie privée",
      technique: "名词化降噪",
      why: "用抽象名词 le déploiement 替代口语化的 beaucoup de gens + c'est plus facile。",
    },
    {
      before: "Mais les jeunes travailleurs peuvent se sentir seuls.",
      after: "Bien que..., son absence d'encadrement risque d'accentuer l'isolement des jeunes actifs",
      technique: "让步从句 + 动词升级",
      why: "用 Bien que + 虚拟式串联前后因果与风险，并用 accentuer l'isolement 提升书面语域。",
    },
    {
      before: "Donc il faut aller au bureau ensemble parfois.",
      after: "Il conviendrait dès lors d'instaurer des temps de présence communs",
      technique: "B2 委婉建议句式",
      why: "用条件式 Il conviendrait dès lors de 替代机械的 Donc il faut。",
    },
  ],
  takeaway: "B1→B2 最关键的两步：把笼统主语换成「名词化概念」，并用 Bien que / 条件式建议句把碎片短句合成为有让步与措施的复句。",
};
