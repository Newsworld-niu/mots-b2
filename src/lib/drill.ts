/**
 * 每日一分钟口语: a short question, 15 seconds to think, one minute to give an opinion and two reasons, recorded.
 * The questions (written for this site, 待核对), how a day's drills are kept in the progress, and the drawing.
 */

export interface DrillQuestion {
  id: string;
  /** A topic id of TOPICS (lib/exam). */
  topic: string;
  fr: string;
  zh: string;
}

export const DRILL_TIMES = { think: 15, speak: 60 } as const;

export const DRILL_QUESTIONS: DrillQuestion[] = [
  { id: "d-velo", topic: "environnement", fr: "Faut-il interdire les voitures dans le centre des villes ?", zh: "应该禁止汽车进入市中心吗？" },
  { id: "d-plastique", topic: "environnement", fr: "Les gestes individuels peuvent-ils vraiment sauver la planète ?", zh: "个人的环保行为真的能拯救地球吗？" },
  { id: "d-local", topic: "environnement", fr: "Vaut-il mieux acheter local, même si c'est plus cher ?", zh: "即使更贵，也应该买本地产品吗？" },
  { id: "d-retraite", topic: "travail", fr: "Faut-il pouvoir choisir l'âge de sa retraite ?", zh: "退休年龄应该由自己选择吗？" },
  { id: "d-passion", topic: "travail", fr: "Vaut-il mieux un travail passionnant ou un travail bien payé ?", zh: "工作有趣更重要，还是收入高更重要？" },
  { id: "d-stage", topic: "travail", fr: "Les stages devraient-ils toujours être payés ?", zh: "实习都应该有报酬吗？" },
  { id: "d-uniforme", topic: "education", fr: "L'uniforme scolaire est-il une bonne idée ?", zh: "学校统一校服是好主意吗？" },
  { id: "d-devoirs", topic: "education", fr: "Faut-il supprimer les devoirs à la maison ?", zh: "应该取消家庭作业吗？" },
  { id: "d-etranger", topic: "education", fr: "Faut-il étudier une année à l'étranger ?", zh: "大学期间应该出国学习一年吗？" },
  { id: "d-ecrans", topic: "numerique", fr: "Faut-il limiter le temps d'écran des enfants ?", zh: "应该限制孩子看屏幕的时间吗？" },
  { id: "d-livres", topic: "numerique", fr: "Le livre papier va-t-il disparaître ?", zh: "纸质书会消失吗？" },
  { id: "d-deconnexion", topic: "numerique", fr: "Faut-il un droit à la déconnexion après le travail ?", zh: "下班后应该有「不回消息」的权利吗？" },
  { id: "d-sucre", topic: "sante", fr: "Faut-il taxer les boissons sucrées ?", zh: "应该对含糖饮料征税吗？" },
  { id: "d-sommeil", topic: "sante", fr: "Dort-on assez aujourd'hui ? Pourquoi ?", zh: "现代人睡得够吗？为什么？" },
  { id: "d-sport-ecole", topic: "sante", fr: "Faut-il plus d'heures de sport à l'école ?", zh: "学校应该增加体育课吗？" },
  { id: "d-ville", topic: "societe", fr: "Vaut-il mieux vivre en ville ou à la campagne ?", zh: "住在城市好还是乡村好？" },
  { id: "d-vote", topic: "societe", fr: "Le vote devrait-il être obligatoire ?", zh: "投票应该是义务吗？" },
  { id: "d-parents", topic: "societe", fr: "Les jeunes adultes doivent-ils quitter tôt le domicile de leurs parents ?", zh: "年轻人应该早点搬出父母家吗？" },
  { id: "d-pub", topic: "consommation", fr: "Faut-il interdire la publicité destinée aux enfants ?", zh: "应该禁止面向儿童的广告吗？" },
  { id: "d-soldes", topic: "consommation", fr: "Les soldes nous poussent-elles à trop consommer ?", zh: "打折季让我们消费过度了吗？" },
  { id: "d-reparer", topic: "consommation", fr: "Faut-il obliger les marques à rendre leurs produits réparables ?", zh: "应该强制品牌让产品可以维修吗？" },
  { id: "d-musee", topic: "culture", fr: "Les musées devraient-ils être gratuits ?", zh: "博物馆应该免费吗？" },
  { id: "d-voyage", topic: "culture", fr: "Voyager, est-ce vraiment découvrir une autre culture ?", zh: "旅行真的能了解另一种文化吗？" },
  { id: "d-langue", topic: "culture", fr: "Apprendre une langue étrangère, est-ce encore utile avec la traduction automatique ?", zh: "有了机器翻译，学外语还有用吗？" },
];

/** The plan of the minute, shown while thinking. */
export const DRILL_PLAN: { zh: string; fr: string }[] = [
  { zh: "表明观点", fr: "À mon avis, … / Je suis plutôt favorable à …" },
  { zh: "理由一（加例子）", fr: "D'abord, … Par exemple, …" },
  { zh: "理由二", fr: "Ensuite, … De plus, …" },
  { zh: "一句收尾", fr: "C'est pourquoi je pense que …" },
];

/** A question not in `avoid` (the recent ones), at random; any question when all have been asked. */
export function drawQuestion(avoid: readonly string[] = [], rand: () => number = Math.random): DrillQuestion {
  const fresh = DRILL_QUESTIONS.filter((q) => !avoid.includes(q.id));
  const from = fresh.length ? fresh : DRILL_QUESTIONS;
  return from[Math.min(from.length - 1, Math.floor(rand() * from.length))];
}

export * from "./drill-schema";
