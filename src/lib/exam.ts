/**
 * 应试练习 (听力理解、应试阅读、口语): the exam topics with their vocabulary, the speaking subjects,
 * what a generated comprehension exercise and a marked talk look like, and the log of results.
 * Topics, vocabulary and subjects are written for this site (待核对).
 */
import { countWords, sanitizeEssayFeedback, type EssayFeedback } from "./essay";

export interface Topic {
  id: string;
  zh: string;
  fr: string;
  /** Words and collocations for arguing about the topic, French | Chinese. */
  vocab: [string, string][];
}

export const TOPICS: Topic[] = [
  {
    id: "environnement",
    zh: "环境",
    fr: "l'environnement",
    vocab: [
      ["le réchauffement climatique", "气候变暖"],
      ["réduire les émissions de gaz à effet de serre", "减少温室气体排放"],
      ["les énergies renouvelables", "可再生能源"],
      ["le tri des déchets", "垃圾分类"],
      ["gaspiller / le gaspillage", "浪费"],
      ["la surconsommation", "过度消费"],
      ["préserver la biodiversité", "保护生物多样性"],
      ["un mode de vie durable", "可持续的生活方式"],
      ["prendre conscience de", "意识到"],
      ["les transports en commun", "公共交通"],
    ],
  },
  {
    id: "travail",
    zh: "工作",
    fr: "le travail",
    vocab: [
      ["le télétravail", "远程办公"],
      ["concilier vie professionnelle et vie privée", "兼顾工作和生活"],
      ["un contrat à durée indéterminée (CDI)", "无固定期限合同"],
      ["être au chômage", "失业"],
      ["postuler à un emploi", "应聘"],
      ["les conditions de travail", "工作条件"],
      ["l'épanouissement personnel", "个人的充实和发展"],
      ["le surmenage / l'épuisement professionnel", "过劳／职业倦怠"],
      ["se reconvertir", "转行"],
      ["la semaine de quatre jours", "四天工作周"],
    ],
  },
  {
    id: "education",
    zh: "教育",
    fr: "l'éducation",
    vocab: [
      ["la réussite scolaire", "学业成功"],
      ["l'échec scolaire / décrocher", "学业失败／辍学"],
      ["l'égalité des chances", "机会均等"],
      ["les devoirs à la maison", "家庭作业"],
      ["l'enseignement à distance", "远程教学"],
      ["acquérir des compétences", "获得能力"],
      ["l'esprit critique", "批判性思维"],
      ["une formation professionnelle", "职业培训"],
      ["les frais de scolarité", "学费"],
      ["apprendre tout au long de la vie", "终身学习"],
    ],
  },
  {
    id: "numerique",
    zh: "数字技术和媒体",
    fr: "le numérique et les médias",
    vocab: [
      ["les réseaux sociaux", "社交网络"],
      ["la désinformation / les fausses nouvelles", "虚假信息／假新闻"],
      ["protéger ses données personnelles", "保护个人数据"],
      ["être dépendant(e) des écrans", "依赖屏幕"],
      ["l'intelligence artificielle", "人工智能"],
      ["vérifier ses sources", "核实信息来源"],
      ["la liberté d'expression", "言论自由"],
      ["le harcèlement en ligne", "网络骚扰"],
      ["se déconnecter", "断网、放下手机"],
      ["la fracture numérique", "数字鸿沟"],
    ],
  },
  {
    id: "sante",
    zh: "健康",
    fr: "la santé",
    vocab: [
      ["une alimentation équilibrée", "均衡的饮食"],
      ["la malbouffe", "垃圾食品"],
      ["pratiquer une activité physique", "进行体育活动"],
      ["le bien-être", "身心健康"],
      ["la santé mentale", "心理健康"],
      ["le manque de sommeil", "睡眠不足"],
      ["prévenir plutôt que guérir", "预防胜于治疗"],
      ["l'accès aux soins", "获得医疗服务"],
      ["un mode de vie sédentaire", "久坐的生活方式"],
      ["lutter contre le stress", "对抗压力"],
    ],
  },
  {
    id: "societe",
    zh: "社会和家庭",
    fr: "la société et la famille",
    vocab: [
      ["le vieillissement de la population", "人口老龄化"],
      ["les inégalités sociales", "社会不平等"],
      ["l'égalité entre les femmes et les hommes", "男女平等"],
      ["le bénévolat / s'engager dans une association", "志愿服务／参加社团"],
      ["la solidarité entre les générations", "代际互助"],
      ["le pouvoir d'achat", "购买力"],
      ["le coût de la vie", "生活成本"],
      ["s'intégrer", "融入"],
      ["le vivre-ensemble", "共同生活、社会和谐"],
      ["la colocation", "合租"],
    ],
  },
  {
    id: "consommation",
    zh: "消费",
    fr: "la consommation",
    vocab: [
      ["acheter d'occasion", "买二手货"],
      ["les circuits courts / consommer local", "短链供应／本地消费"],
      ["la publicité ciblée", "精准广告"],
      ["un achat impulsif", "冲动消费"],
      ["le commerce en ligne", "网购"],
      ["l'obsolescence programmée", "计划性报废"],
      ["réparer plutôt que jeter", "修而不扔"],
      ["le rapport qualité-prix", "性价比"],
      ["boycotter une marque", "抵制一个品牌"],
      ["le commerce équitable", "公平贸易"],
    ],
  },
  {
    id: "culture",
    zh: "文化、旅行和城市",
    fr: "la culture, les voyages et la ville",
    vocab: [
      ["le tourisme de masse", "大众旅游"],
      ["le patrimoine", "文化遗产"],
      ["la gratuité des musées", "博物馆免费"],
      ["s'ouvrir à d'autres cultures", "向其他文化开放"],
      ["le choc culturel", "文化冲击"],
      ["les loisirs", "休闲活动"],
      ["la pollution sonore", "噪音污染"],
      ["les espaces verts", "绿地"],
      ["désengorger le centre-ville", "疏解市中心的拥堵"],
      ["la qualité de vie", "生活质量"],
    ],
  },
];

export const topicOf = (id: string | undefined) => TOPICS.find((t) => t.id === id);

/* ---------- 听力理解、应试阅读 ---------- */

export type CompKind = "listen" | "read";
export const COMP_LABEL: Record<CompKind, string> = { listen: "听力理解", read: "应试阅读" };

/**
 * The exercise types of the exam (new format, 2020):
 * long — one radio programme heard twice (listening) or one press article (reading), 7 questions, 9 points;
 * short — three short recordings heard once, 2 questions each, 7 points (listening);
 * opinions — three people's opinions on a forum, "whose point of view is this?", 6 questions, 7 points (reading).
 */
export type CompForm = "long" | "short" | "opinions";
export const FORM_SPEC: Record<CompForm, { zh: string; questions: number; points: number; plays: number; read: number; answer: number }> = {
  long: { zh: "长篇（7 题，9 分）", questions: 7, points: 9, plays: 2, read: 60, answer: 60 },
  short: { zh: "三段短录音（各听一遍，7 分）", questions: 6, points: 7, plays: 1, read: 15, answer: 20 },
  opinions: { zh: "三人观点（这是谁的看法，7 分）", questions: 6, points: 7, plays: 0, read: 0, answer: 0 },
};
/** Pause between the two hearings of a long document, in seconds. */
export const BETWEEN_PLAYS = 30;
/** The exercises of a whole paper, in order: 9 + 9 + 7 = 25 points. */
export const PAPER: Record<CompKind, CompForm[]> = { listen: ["long", "long", "short"], read: ["long", "long", "opinions"] };
export const READ_MINUTES = { paper: 60, long: 20, opinions: 15 } as const;

export interface CompQuestion {
  /** Question and options in French, as in the exam: three options. */
  q: string;
  options: string[];
  answer: number;
  /** Why, in Chinese. */
  why: string;
  /** Points, from 0.5 to 2.5, set by `weigh`. */
  pts: number;
  /** Which document of the exercise the question is about (short recordings). */
  doc: number;
  /** What the question tests, as the AI saw it (older exercises have none). */
  skill?: QSkill;
}

/** What a question tests: the main idea, an explicit detail, a reworded idea, someone's opinion, an inference, a negation or restriction. */
export type QSkill = "gist" | "detail" | "paraphrase" | "opinion" | "inference" | "negation";
export const QSKILLS: QSkill[] = ["gist", "detail", "paraphrase", "opinion", "inference", "negation"];
export const QSKILL_LABEL: Record<QSkill, string> = { gist: "主旨", detail: "细节", paraphrase: "同义改写", opinion: "观点态度", inference: "推断", negation: "否定/限定" };

export interface CompExercise {
  form: CompForm;
  topic: string;
  /** The situation line of the exercise ("Vous écoutez une émission à la radio."). */
  intro: string;
  title: string;
  /** One document, or three for short recordings. */
  docs: { text: string; zh: string }[];
  questions: CompQuestion[];
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * The points of the questions of one exercise, as in the official sample paper: from 0.5 to 2.5, adding up
 * to 9 (seven questions) or 7 (six questions).
 */
const POINT_SETS: Record<number, number[]> = { 9: [0.5, 0.5, 1, 1, 1.5, 2, 2.5], 7: [0.5, 0.5, 1, 1.5, 1.5, 2] };

/**
 * Share the exercise's points among its questions by difficulty (1 easiest … 5 hardest): the hardest question
 * gets the most points; equal difficulties keep the order of the paper.
 */
export function weigh(difficulty: number[], points: number): number[] {
  const n = difficulty.length;
  const set = POINT_SETS[points];
  if (!set || set.length !== n) return new Array<number>(n).fill(1);
  const order = [...difficulty.keys()].sort((a, b) => difficulty[a] - difficulty[b] || a - b);
  const pts = new Array<number>(n).fill(1);
  order.forEach((k, rank) => (pts[k] = set[rank]));
  return pts;
}

/** The measured pace of the official recordings: words per minute over a whole document, pauses included. */
export const REAL_WPM = 177;

export function sanitizeExercise(raw: unknown, form: CompForm, topic: string): CompExercise {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const docs = (Array.isArray(r.docs) ? r.docs : [])
    .filter((d): d is Record<string, unknown> => !!d && typeof d === "object")
    .map((d) => ({ text: str(d.text, 6000), zh: str(d.zh, 6000) }))
    .filter((d) => d.text)
    .slice(0, form === "short" ? 3 : 1);
  const rows = (Array.isArray(r.questions) ? r.questions : [])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => {
      const options = Array.isArray(x.options) ? x.options.map((o) => str(o, 240)).filter(Boolean).slice(0, 3) : [];
      const doc = typeof x.doc === "number" ? Math.round(x.doc) : 0;
      const level = typeof x.difficulty === "number" && Number.isFinite(x.difficulty) ? Math.min(5, Math.max(1, Math.round(x.difficulty))) : 3;
      const skill = QSKILLS.includes(x.skill as QSkill) ? (x.skill as QSkill) : undefined;
      return { q: str(x.q, 400), options, answer: typeof x.answer === "number" ? Math.round(x.answer) : -1, why: str(x.why, 500), level, doc: doc >= 0 && doc < docs.length ? doc : 0, ...(skill ? { skill } : {}) };
    })
    .filter((x) => x.q && x.options.length === 3 && new Set(x.options).size === 3 && x.answer >= 0 && x.answer < 3)
    .slice(0, FORM_SPEC[form].questions);
  // points only add up to the exercise's total when every question came back
  const pts = weigh(rows.map((x) => x.level), rows.length === FORM_SPEC[form].questions ? FORM_SPEC[form].points : rows.length);
  const questions = rows.map(({ level: _l, ...x }, k) => ({ ...x, pts: pts[k] })).sort((a, b) => a.doc - b.doc);
  return { form, topic, intro: str(r.intro, 240), title: str(r.title, 120).replace(/^["«\s]+|["»\s]+$/g, ""), docs, questions };
}

export const exercisePoints = (ex: CompExercise) => ex.questions.reduce((n, q) => n + q.pts, 0);

export interface SpeechChunk {
  t: string;
  /** 0 for the first speaker (or no speaker), 1 for the second, alternating as new names appear. */
  who: number;
}

/**
 * A passage cut into pieces short enough for the speech service, at sentence ends. A speaker label at the
 * start of a line ("Julie :") is not read aloud: it decides which voice reads the line.
 */
export function speechChunks(text: string, max = 360): SpeechChunk[] {
  const out: SpeechChunk[] = [];
  const speakers: string[] = [];
  for (const line of text.split(/\n+/)) {
    const m = line.match(/^\s*([\p{Lu}][\p{L} .'’-]{0,24})\s:\s*/u);
    let who = 0;
    if (m) {
      const name = m[1].trim();
      if (!speakers.includes(name)) speakers.push(name);
      who = speakers.indexOf(name) % 2;
    }
    const said = (m ? line.slice(m[0].length) : line).trim();
    if (!said) continue;
    let cur = "";
    const push = (t: string) => t.trim() && out.push({ t: t.trim(), who });
    for (const s of said.match(/[^.!?…]+[.!?…]+["»”)]*\s*|[^.!?…]+$/g) ?? [said]) {
      if (cur && (cur + s).length > max) {
        push(cur);
        cur = "";
      }
      cur += s;
      // one sentence longer than the limit: cut at commas, then hard
      while (cur.length > max) {
        const cut = cur.lastIndexOf(", ", max);
        const at = cut > max / 2 ? cut + 1 : max;
        push(cur.slice(0, at));
        cur = cur.slice(at);
      }
    }
    push(cur);
  }
  return out;
}

/* ---------- 口语 ---------- */

export interface SpeakingSubject {
  id: string;
  topic: string;
  title: string;
  /** The short document the candidate reacts to. */
  doc: string;
  /** What to do with it, in Chinese. */
  ask: string;
}

export const SPEAKING_SUBJECTS: SpeakingSubject[] = [
  { id: "s-teletravail", topic: "travail", title: "远程办公", doc: "De plus en plus d'entreprises laissent leurs salariés travailler chez eux plusieurs jours par semaine. Certains y gagnent du temps et du calme ; d'autres se sentent isolés et ne parviennent plus à séparer travail et vie privée.", ask: "远程办公应该成为常态吗？说出你的看法并论证。" },
  { id: "s-quatre-jours", topic: "travail", title: "四天工作周", doc: "Plusieurs sociétés testent la semaine de quatre jours sans baisse de salaire. Elles affirment que leurs employés sont plus efficaces et moins fatigués. Des économistes doutent que ce modèle convienne à tous les métiers.", ask: "你赞成四天工作周吗？" },
  { id: "s-avion", topic: "environnement", title: "少坐飞机", doc: "Pour limiter le réchauffement climatique, certains proposent d'interdire les vols intérieurs quand le même trajet peut se faire en train en moins de trois heures. Les compagnies aériennes dénoncent une mesure inefficace.", ask: "为了环保应该限制坐飞机吗？" },
  { id: "s-viande", topic: "environnement", title: "学校食堂每周一天素食", doc: "Une ville a décidé de servir un repas sans viande par semaine dans toutes ses cantines scolaires. Des parents applaudissent, d'autres estiment que ce n'est pas à la mairie de décider de ce que mangent leurs enfants.", ask: "学校应该强制安排素食日吗？" },
  { id: "s-portable", topic: "education", title: "学校里禁用手机", doc: "Dans de nombreux collèges, les téléphones portables sont désormais interdits pendant toute la journée. Les enseignants constatent que les élèves sont plus attentifs ; certains élèves, eux, y voient un manque de confiance.", ask: "学校里应该禁止学生用手机吗？" },
  { id: "s-notes", topic: "education", title: "取消分数", doc: "Des écoles ont remplacé les notes par des appréciations écrites. Selon elles, les élèves ont moins peur de l'échec. Leurs critiques répondent que, sans notes, on ne sait plus où l'on en est.", ask: "学校应该取消打分吗？" },
  { id: "s-reseaux", topic: "numerique", title: "社交网络的年龄限制", doc: "Un projet de loi veut interdire l'inscription sur les réseaux sociaux avant quinze ans. Ses défenseurs parlent de protéger la santé mentale des adolescents ; ses opposants jugent la mesure impossible à faire respecter.", ask: "应该给社交网络设年龄限制吗？" },
  { id: "s-ia", topic: "numerique", title: "用人工智能写作业", doc: "Beaucoup d'étudiants utilisent aujourd'hui une intelligence artificielle pour rédiger leurs devoirs. Certaines universités l'interdisent, d'autres préfèrent apprendre aux étudiants à s'en servir intelligemment.", ask: "学生可以用人工智能完成作业吗？" },
  { id: "s-sport", topic: "sante", title: "医生开运动处方", doc: "Dans certaines villes, les médecins peuvent prescrire du sport comme un médicament, et les séances sont en partie remboursées. L'idée séduit, mais elle coûte cher à la collectivité.", ask: "运动应该像药一样由医保报销吗？" },
  { id: "s-occasion", topic: "consommation", title: "买二手货", doc: "Le marché des vêtements d'occasion explose, surtout chez les jeunes. Acheter d'occasion permet de dépenser moins et de polluer moins, mais certains y voient surtout une nouvelle façon de consommer toujours plus.", ask: "买二手货真的是更负责任的消费吗？" },
  { id: "s-tourisme", topic: "culture", title: "限制游客人数", doc: "Pour protéger leurs habitants et leurs monuments, plusieurs villes très touristiques font payer l'entrée du centre historique ou limitent le nombre de visiteurs par jour.", ask: "热门城市应该限制游客吗？" },
  { id: "s-benevolat", topic: "societe", title: "义务服务", doc: "Faut-il demander à tous les jeunes de consacrer quelques mois à un service utile à la société, dans une association, un hôpital ou une école ? L'idée revient régulièrement dans le débat public.", ask: "应该让所有年轻人参加一段时间的义务服务吗？" },
];

/** How a talk on a subject is built (monologue suivi). */
export const TALK_PLAN: { zh: string; fr: string }[] = [
  { zh: "引入：复述材料的主题，提出问题", fr: "Ce document traite de… On peut se demander si…" },
  { zh: "宣布提纲和立场", fr: "Je vais d'abord…, puis… À mon avis,…" },
  { zh: "论点一 + 例子", fr: "Tout d'abord,… Prenons l'exemple de…" },
  { zh: "论点二 + 例子", fr: "Ensuite,… C'est le cas, par exemple, de…" },
  { zh: "考虑相反的观点", fr: "Certains diront que… Cependant,…" },
  { zh: "结论", fr: "Pour conclure, je dirais que…" },
];

/** The criteria of the official speaking grid; the last one cannot be judged from a transcript. */
export const SPEAK_CRITERIA = ["monologue", "interaction", "lexique", "morpho"] as const;
/** The times of the official test, in seconds: 30 minutes to prepare, a talk of 5 to 7, a debate of 10 to 13. */
export const SPEAK_TIMES = { prep: 30 * 60, monologue: [5 * 60, 7 * 60], debate: [10 * 60, 13 * 60] } as const;

export interface DebateTurn {
  /** The examiner's question. */
  q: string;
  /** What the candidate answered. */
  a: string;
}

export interface DebateEscalation {
  /** 1 = probe & clarify, 2 = counter-argument & press, 3 = high-pressure dilemma / widening. */
  level: 1 | 2 | 3;
  /** Diagnostic triggers detected in the candidate's recent answers. */
  reasons: ("short_answer" | "evasive" | "no_justification" | "repetitive" | "strict_mode")[];
}

const EVASIVE_RE = /\b(je ne sais pas|aucune idée|peut-être|ça dépend|pas vraiment|c'est compliqué|bof)\b/i;
const JUSTIFY_RE = /\b(parce que|car|puisque|en effet|par exemple|cependant|toutefois|néanmoins|certes|malgré|afin de|donc|d'autant plus|en revanche)\b/i;
const tokenSet = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 4),
  );

/**
 * Determine how strongly the AI examiner should press the candidate on the next turn based on elapsed time,
 * turn count, strict exam mode, and superficial/evasive/repetitive replies.
 */
export function assessDebateEscalation(turns: DebateTurn[], minutes = 0, strict = false): DebateEscalation {
  const answered = turns.filter((t) => t.a.trim());
  const last = answered[answered.length - 1];
  const reasons: DebateEscalation["reasons"] = [];
  if (strict) reasons.push("strict_mode");
  if (last) {
    const wc = countWords(last.a);
    if (wc < 18) reasons.push("short_answer");
    if (EVASIVE_RE.test(last.a) && wc < 30) reasons.push("evasive");
    if (wc >= 8 && wc < 30 && !JUSTIFY_RE.test(last.a)) reasons.push("no_justification");
    if (answered.length >= 2 && wc >= 10) {
      const cur = tokenSet(last.a);
      const prev = answered.slice(0, -1).map((t) => tokenSet(t.a));
      const maxOverlap = prev.reduce((best, s) => {
        if (!cur.size || !s.size) return best;
        let hit = 0;
        for (const w of cur) if (s.has(w)) hit++;
        return Math.max(best, hit / Math.min(cur.size, s.size));
      }, 0);
      if (maxOverlap >= 0.6) reasons.push("repetitive");
    }
  }
  const hasWeakness = reasons.some((r) => r !== "strict_mode");
  let level: 1 | 2 | 3 = minutes >= 8 || answered.length >= 6 ? 3 : minutes >= 3 || answered.length >= 2 ? 2 : 1;
  if (hasWeakness) level = Math.min(3, level + 1) as 1 | 2 | 3;
  else if (strict && answered.length >= 1) level = Math.min(3, Math.max(level, 2)) as 1 | 2 | 3;
  return { level, reasons };
}

export type SpeakingFeedback = EssayFeedback;

export function sanitizeSpeakingFeedback(raw: unknown, points: ReadonlySet<string>): SpeakingFeedback {
  return sanitizeEssayFeedback(raw, points, SPEAK_CRITERIA);
}

/** A subject made by the AI: a headline question and a press-style excerpt. */
export function sanitizeSubject(raw: unknown, topic: string): SpeakingSubject | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const title = str(r.title, 140);
  const doc = str(r.doc, 1600);
  if (!title || doc.length < 300) return null;
  return { id: `ai-${topic}`, topic, title, doc, ask: str(r.ask, 200) || "指出材料提出的问题，表明你的看法并论证。" };
}

/* ---------- 成绩记录 ---------- */

export type ExamPart = CompKind | "speak";
export const PART_LABEL: Record<ExamPart, string> = { listen: "听力", read: "阅读", speak: "口语" };

export interface ExamResult {
  part: ExamPart;
  /** Topic id (comprehension) or subject id (speaking). */
  what: string;
  score: number;
  total: number;
  at: number;
}

export const MAX_EXAM_LOG = 60;

export function sanitizeExamLog(v: unknown): ExamResult[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: ExamResult[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const e = x as Record<string, unknown>;
    if ((e.part !== "listen" && e.part !== "read" && e.part !== "speak") || typeof e.what !== "string" || typeof e.at !== "number") continue;
    if (typeof e.score !== "number" || typeof e.total !== "number" || !(e.total > 0) || e.score < 0 || e.score > e.total) continue;
    out.push({ part: e.part, what: e.what.slice(0, 40), score: e.score, total: e.total, at: e.at });
  }
  return out.length ? out.slice(0, MAX_EXAM_LOG) : undefined;
}

/** A result as the exam counts it: out of 25. */
export const outOf25 = (r: { score: number; total: number }) => Math.round((r.score / r.total) * 250) / 10;

/** Minutes and seconds, 4:05. */
export const clock = (sec: number) => `${Math.floor(Math.max(0, sec) / 60)}:${String(Math.max(0, sec) % 60).padStart(2, "0")}`;
