import type { Topic, TopicKey } from "./types";

/** Nine B2 thematic stations, in the order of the learning path. */
export const TOPICS: Topic[] = [
  { key: "travail", name: "Travail", zh: "工作与职场", tagline: "Entretiens, contrats, carrière", tone: "terra" },
  { key: "environnement", name: "Environnement", zh: "环境与气候", tagline: "Climat, déchets, ressources", tone: "sage" },
  { key: "societe", name: "Société", zh: "社会与公民", tagline: "Inégalités, citoyenneté, débats", tone: "sky" },
  { key: "sante", name: "Santé", zh: "健康与医疗", tagline: "Symptômes, prévention, sommeil", tone: "plum" },
  { key: "education", name: "Éducation", zh: "教育与学习", tagline: "Diplômes, formation, savoir", tone: "ochre" },
  { key: "economie", name: "Économie", zh: "经济与消费", tagline: "Croissance, budget, marché", tone: "sage" },
  { key: "medias", name: "Médias", zh: "媒体与信息", tagline: "Actualité, rumeurs, influence", tone: "sky" },
  { key: "voyage", name: "Voyage", zh: "旅行与出行", tagline: "Séjours, itinéraires, patrimoine", tone: "ochre" },
  { key: "emotions", name: "Émotions", zh: "情绪与心理", tagline: "Joie, colère, nostalgie", tone: "terra" },
];

export const topicOf = (key: TopicKey) => TOPICS.find((t) => t.key === key)!;
export const TOPIC_KEYS = TOPICS.map((t) => t.key) as TopicKey[];
