/**
 * 应试练习 (听力理解、应试阅读、口语): the exam topics with their vocabulary, the speaking subjects,
 * what a generated comprehension exercise and a marked talk look like, and the log of results.
 * Topics, vocabulary and subjects are written for this site (待核对).
 */
import { countWords, sanitizeEssayFeedback, type EssayFeedback } from "./essay-schema";
export * from "./exam-schema";

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
    zh: "环境与生态",
    fr: "l'environnement et la transition écologique",
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
      ["la transition énergétique", "能源转型"],
      ["l'empreinte carbone", "碳足迹"],
      ["l'épuisement des ressources naturelles", "自然资源枯竭"],
      ["instaurer une taxe carbone", "设立碳税"],
      ["lutter contre la déforestation", "打击森林砍伐"],
      ["revaloriser et recycler", "回收再利用"],
    ],
  },
  {
    id: "travail",
    zh: "职场与劳动",
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
      ["la précarité de l'emploi", "就业不稳定"],
      ["revaloriser les salaires", "提高薪资水平"],
      ["le droit à la déconnexion", "离线权（下班不回复消息）"],
      ["l'automatisation des tâches", "岗位自动化"],
      ["renforcer le dialogue social", "加强劳资社会对话"],
      ["subir une pression hiérarchique", "承受上级压力"],
    ],
  },
  {
    id: "education",
    zh: "教育与校园",
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
      ["lutter contre le décrochage scolaire", "防治辍学"],
      ["adapter les programmes aux réalités", "让课程适应现实需求"],
      ["la mixité sociale à l'école", "校园阶层融合"],
      ["valoriser la filière technique", "重视职业技术教育路径"],
      ["surveiller l'usage du numérique en classe", "规范课堂数字设备使用"],
      ["favoriser l'insertion professionnelle", "促进毕业生就业融入"],
    ],
  },
  {
    id: "numerique",
    zh: "数字生活与社交网络",
    fr: "le numérique",
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
      ["encadrer les algorithmes", "监管算法推荐"],
      ["la souveraineté numérique", "数字主权"],
      ["lutter contre la cybercriminalité", "打击网络犯罪"],
      ["garantir la confidentialité en ligne", "保障线上隐私安全"],
      ["l'illectronisme", "数字技能匮乏／数字文盲"],
      ["sensibiliser aux dérives des écrans", "普及屏幕沉迷风险意识"],
    ],
  },
  {
    id: "sante",
    zh: "健康与医疗制度",
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
      ["les déserts médicaux", "医疗荒漠地区"],
      ["rembourser les frais médicaux", "报销医疗费用"],
      ["désengorger les services d'urgence", "缓解急诊科拥堵"],
      ["mener une campagne de prévention", "开展健康预防宣传"],
      ["le vieillissement du personnel soignant", "医护人员老龄化"],
      ["promouvoir la médecine préventive", "推广预防医学"],
    ],
  },
  {
    id: "societe",
    zh: "社会与代际关系",
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
      ["la cohésion sociale", "社会凝聚力"],
      ["rompre l'isolement des personnes âgées", "打破老年人孤独隔绝状态"],
      ["concilier vie familiale et carrière", "平衡家庭与职业发展"],
      ["lutter contre les discriminations", "反对歧视"],
      ["renforcer le lien social", "增进社会纽带"],
      ["garantir l'inclusion des personnes handicapées", "保障残障人士社会融入"],
    ],
  },
  {
    id: "consommation",
    zh: "消费方式与商业伦理",
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
      ["privilégier la sobriété matérielle", "崇尚适度节俭消费"],
      ["renforcer la traçabilité des produits", "加强产品溯源透明度"],
      ["le droit à la réparation", "维修权"],
      ["l'économie circulaire", "循环经济"],
      ["encadrer les pratiques commerciales trompeuses", "规制误导性商业行为"],
      ["encourager l'achat responsable", "鼓励负责任消费"],
    ],
  },
  {
    id: "culture",
    zh: "文化旅游与生活方式",
    fr: "la culture et les voyages",
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
      ["démocratiser l'accès à la culture", "促进文化普及"],
      ["préserver l'authenticité des sites", "保护景区原真性"],
      ["promouvoir le tourisme durable", "推广可持续旅游"],
      ["éviter la saturation touristique", "避免旅游过度拥挤"],
      ["subventionner la création culturelle", "资助文化创作"],
      ["concilier accueil touristique et vie locale", "平衡游客接待与当地居民生活"],
    ],
  },
  {
    id: "politique-justice",
    zh: "政治制度与法治公民",
    fr: "la politique, la citoyenneté et la justice",
    vocab: [
      ["l'abstention électorale", "选举弃权（不参与投票）"],
      ["l'exercice de la citoyenneté", "公民职责与身份的践行"],
      ["l'État de droit", "法治国家"],
      ["la séparation des pouvoirs", "权力分立"],
      ["l'égalité devant la loi", "法律面前人人平等"],
      ["participer au débat démocratique", "参与民主辩论"],
      ["rétablir la confiance envers les élus", "重建民众对民选官员的信任"],
      ["le vote obligatoire", "强制投票"],
      ["la démocratie participative", "参与式民主"],
      ["garantir l'indépendance de la justice", "保障司法独立"],
      ["lutter contre la corruption", "打击腐败"],
      ["protéger les lanceurs d'alerte", "保护吹哨人"],
      ["engager des poursuites judiciaires", "提起司法诉讼"],
      ["prononcer une peine proportionnée", "判处相称刑罚"],
      ["favoriser la réinsertion des détenus", "促进服刑人员重返社会"],
      ["décentraliser les décisions publiques", "下放公共决策权"],
    ],
  },
  {
    id: "sciences-ethique",
    zh: "科研创新与 AI 伦理",
    fr: "les sciences, la recherche et l'éthique",
    vocab: [
      ["encadrer l'intelligence artificielle", "对人工智能进行伦理与法律规范"],
      ["le principe de précaution", "预防原则"],
      ["les biais algorithmiques", "算法偏见"],
      ["financer la recherche fondamentale", "资助基础科学研究"],
      ["garantir la transparence scientifique", "保证科研透明度"],
      ["la propriété intellectuelle", "知识产权"],
      ["le clonage et les manipulations génétiques", "克隆与基因编辑"],
      ["l'expérimentation animale", "动物实验"],
      ["évaluer les risques technologiques", "评估技术风险"],
      ["sauvegarder la responsabilité humaine", "保留人类最终责任"],
      ["l'automatisation de la décision", "决策自动化"],
      ["la fuite des cerveaux", "人才外流"],
      ["concilier progrès scientifique et valeurs morales", "调和科技进步与道德伦理"],
      ["respecter la vie privée face à la biométrie", "在生物识别技术下保护隐私"],
      ["partager librement les résultats scientifiques", "开放共享科研成果"],
      ["éviter une dérive technocratique", "防止技术官僚失控"],
    ],
  },
  {
    id: "medias-presse",
    zh: "新闻传媒与信息核查",
    fr: "les médias, la presse et l'information",
    vocab: [
      ["la liberté de la presse", "新闻自由"],
      ["le pluralisme des médias", "媒体多元化"],
      ["lutter contre la manipulation de l'information", "打击信息操纵"],
      ["la vérification des faits (fact-checking)", "事实核查"],
      ["l'indépendance éditoriale", "编辑独立性"],
      ["la concentration des médias", "媒体高度集中兼并"],
      ["éduquer aux médias dès l'école", "从校园开展媒介素养教育"],
      ["le journalisme d'investigation", "调查新闻"],
      ["distinguer un fait d'une opinion", "区分客观事实与个人观点"],
      ["la course à l'audimat", "收视率与点击率竞争"],
      ["le sensationnalisme médiatique", "媒体煽情主义"],
      ["protéger le secret des sources", "保护新闻消息源秘密"],
      ["l'infobésité / la surcharge d'informations", "信息过载"],
      ["le financement public de l'audiovisuel", "公共视听媒体的财政支持"],
      ["les bulles de filtres numériques", "网络信息茧房"],
      ["restaurer la crédibilité journalistique", "恢复新闻公信力"],
    ],
  },
  {
    id: "logement-urbanisme",
    zh: "住房政策与城市规划",
    fr: "le logement et l'urbanisme",
    vocab: [
      ["la crise du logement", "住房危机"],
      ["encadrer les loyers", "实施房租管制"],
      ["le logement social", "保障性住房／廉租房"],
      ["la rénovation thermique des bâtiments", "建筑节能保温改造"],
      ["lutter contre les passoires thermiques", "整治高能耗漏热住房"],
      ["la gentrification des quartiers populaires", "平民街区的士绅化（贵族化）"],
      ["l'étalement urbain", "城市无序蔓延"],
      ["végétaliser les centres-villes", "增加市中心绿化"],
      ["les îlots de chaleur urbains", "城市热岛效应"],
      ["favoriser la mixité urbaine", "促进城市居住阶层混居"],
      ["réguler les locations touristiques de courte durée", "监管短期旅游民宿租赁"],
      ["réhabiliter les friches industrielles", "改造复兴工业棕地"],
      ["construire des écoquartiers", "建设生态街区"],
      ["garantir l'accessibilité aux services de proximité", "保障周边生活服务设施可达性"],
      ["la précarité énergétique", "能源贫困（无力负担取暖电费）"],
      ["repenser la densité urbaine durable", "重新规划可持续城市密度"],
    ],
  },
  {
    id: "economie-finances",
    zh: "经济发展与公共财政",
    fr: "l'économie et les finances publiques",
    vocab: [
      ["la croissance économique", "经济增长"],
      ["maîtriser l'inflation", "控制通货膨胀"],
      ["la dette publique", "公共债务"],
      ["l'évasion fiscale", "避税／逃税"],
      ["répartir équitablement les richesses", "公平分配社会财富"],
      ["soutenir les petites et moyennes entreprises (PME)", "扶持中小企业"],
      ["relocaliser la production industrielle", "推动工业产能回流本土"],
      ["préserver l'État-providence", "维护社会福利国家制度"],
      ["financer le système des retraites", "保障养老金体系融资"],
      ["la compétitivité économique", "经济竞争力"],
      ["investir dans les services publics", "投资公共服务"],
      ["réguler les marchés financiers", "监管金融市场"],
      ["encourager l'entrepreneuriat local", "鼓励本土创业"],
      ["réduire le déficit budgétaire", "削减财政赤字"],
      ["le salaire minimum interprofessionnel", "法定最低工资"],
      ["taxer les superprofits", "对超额利润征税"],
    ],
  },
  {
    id: "transports-mobilite",
    zh: "交通运输与可持续出行",
    fr: "les transports et la mobilité",
    vocab: [
      ["les mobilités douces", "慢行交通（步行、骑行等）"],
      ["développer les pistes cyclables", "扩建自行车道"],
      ["la gratuité des transports publics", "公共交通免费政策"],
      ["les zones à faibles émissions (ZFE)", "低排放交通区"],
      ["désenclaver les zones rurales", "打破农村偏远地区交通孤立"],
      ["moderniser le réseau ferroviaire", "现代化改造铁路网"],
      ["privilégier le train plutôt que l'avion", "优先选择火车而非短途飞机"],
      ["le covoiturage quotidien", "日常拼车"],
      ["subventionner l'achat de véhicules électriques", "补贴购买电动汽车"],
      ["limiter la place de la voiture en ville", "限制私家车在市区的空间"],
      ["fluidifier le trafic routier", "疏导道路交通"],
      ["le transport de marchandises par rail", "铁路货运"],
      ["financer les infrastructures de transport", "为交通基础设施筹资"],
      ["l'accessibilité pour les personnes à mobilité réduite", "行动不便者的无障碍通行"],
      ["réduire les nuisances liées au trafic", "减少交通带来的噪音与污染危害"],
      ["le téléphérique ou le tramway urbain", "城市缆车或有轨电车"],
    ],
  },
  {
    id: "arts-francophonie",
    zh: "文学艺术与法语世界",
    fr: "les arts, la langue et la francophonie",
    vocab: [
      ["la diversité culturelle et linguistique", "文化与语言多样性"],
      ["rayonner à l'international", "在国际上展现文化影响力"],
      ["défendre la francophonie", "维护法语语言文化与法语共同体"],
      ["le mécénat culturel", "企业或私人文化赞助"],
      ["l'exception culturelle", "文化例外原则"],
      ["transmettre la mémoire collective", "传承集体记忆"],
      ["sauvegarder le patrimoine immatériel", "保护非物质文化遗产"],
      ["encourager la lecture chez les jeunes", "鼓励青少年阅读"],
      ["la censure artistique", "艺术审查"],
      ["rendre l'art accessible au grand public", "让艺术走近普通大众"],
      ["soutenir le cinéma indépendant", "扶持独立电影创作"],
      ["préserver les langues régionales", "保护地方语言"],
      ["l'éducation artistique et culturelle", "艺术与文化教育"],
      ["revisiter les œuvres classiques", "重新演绎经典作品"],
      ["l'essor du livre numérique et audio", "电子书与有声书的兴起"],
      ["rémunérer justement les créateurs", "给予创作者合理报酬"],
    ],
  },
];

export const topicOf = (id: string | undefined) => TOPICS.find((t) => t.id === id);

/* ---------- 听力理解、应试阅读 ---------- */

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export interface SpeechChunk {
  t: string;
  /** 0 for the first speaker (or no speaker), 1 for the second, 2 for the third, etc. */
  who: number;
}

/**
 * Resolve a speaker label ("Hélène Martin", later "Hélène") to a stable zero-based speaker index,
 * supporting 3+ speakers while keeping full-name and first-name turns on the same voice when unambiguous.
 */
export function speakerIndex(speakers: string[], rawName: string): number {
  const name = rawName.trim();
  const exact = speakers.indexOf(name);
  if (exact >= 0) return exact;
  if (!name.includes(" ")) {
    const pref = `${name} `;
    const hits = speakers.map((s, i) => (s.startsWith(pref) ? i : -1)).filter((i) => i >= 0);
    if (hits.length === 1) return hits[0];
  } else {
    const first = name.split(" ")[0];
    const hits = speakers.map((s, i) => (s === first ? i : -1)).filter((i) => i >= 0);
    if (hits.length === 1) {
      speakers[hits[0]] = name;
      return hits[0];
    }
  }
  speakers.push(name);
  return speakers.length - 1;
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
    const who = m ? speakerIndex(speakers, m[1]) : 0;
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

/** Merge consecutive lines of the same speaker into full turns (for whole-passage Azure SSML). */
export function speechTurns(text: string): SpeechChunk[] {
  const out: SpeechChunk[] = [];
  for (const c of speechChunks(text, 2400)) {
    const prev = out[out.length - 1];
    if (prev && prev.who === c.who) prev.t = `${prev.t} ${c.t}`;
    else out.push({ ...c });
  }
  return out;
}

/* ---------- 口语 ---------- */

export interface SpeakingSubject {
  id: string;
  topic: string;
  title: string;
  /** Simulated press source & date (e.g. "D'après Le Courrier économique, 14 octobre 2024"). */
  source?: string;
  /** The press excerpt the candidate reacts to (120–160 words). */
  doc: string;
  /** Chinese key-point hint (hidden by default so the candidate dégages la problématique). */
  ask: string;
  /** Optional preset examiner follow-up questions (for offline/no-AI practice). */
  followUps?: string[];
}

/** Standard official DELF B2 speaking instruction shown instead of Chinese spoilers. */
export const PO_STANDARD_CONSIGNE =
  "Vous dégagerez le problème soulevé par le document ci-dessous, puis vous présenterez votre opinion sur le sujet de manière structurée et argumentée, avant de la défendre au cours d'un débat avec l'examinateur.";

export const SPEAKING_SUBJECTS: SpeakingSubject[] = [
  {
    id: "s-teletravail",
    topic: "travail",
    title: "Télétravail : les entreprises doivent-elles imposer le retour au bureau ?",
    source: "D'après Le Courrier économique, 14 octobre 2024",
    doc: "Après quatre années d'essor du travail à distance, plusieurs grands groupes français rappellent désormais leurs salariés au bureau au moins trois jours par semaine. Selon une enquête publiée en septembre par l'Observatoire de l'emploi, 42 % des dirigeants estiment que la collaboration spontanée et l'intégration des jeunes diplômés souffrent de l'absence de présence physique. « On ne transmet pas une culture d'entreprise à travers un écran », affirme Claire Deschamps, directrice des ressources humaines d'un groupe industriel lyonnais. Du côté des syndicats, le ton est nettement plus critique. Pour Marc Lefèvre, représentant du personnel dans le secteur bancaire, cette marche arrière risque de briser la confiance acquise : « Les salariés ont prouvé qu'ils restaient productifs chez eux tout en économisant deux heures de transport par jour. » Entre cohésion collective et autonomie individuelle, l'équilibre du travail hybride reste à inventer.",
    ask: "企业强制要求员工回到办公室上班合理吗？如何在团队协作与个人自主、生活平衡之间权衡？",
  },
  {
    id: "s-quatre-jours",
    topic: "travail",
    title: "Semaine de quatre jours : progrès social ou fausse bonne idée ?",
    source: "D'après La Tribune sociale, 3 décembre 2024",
    doc: "Expérimentée par plusieurs centaines de PME européennes, la semaine de quatre jours sans baisse de salaire suscite un débat vif en France. Les entreprises volontaires mettent en avant une baisse de l'absentéisme et un regain d'attractivité lors des recrutements. « Nos équipes sont plus reposées et traitent leurs dossiers avec davantage de concentration », témoigne Nadia Bensaïd, dirigeante d'une agence numérique à Nantes. Pourtant, de nombreux économistes et artisans appellent à la prudence. Ils soulignent que ce modèle convient surtout aux emplois de bureau et reste difficile à appliquer dans les hôpitaux, les commerces ou le bâtiment, sauf à embaucher massivement. D'autres craignent une intensification extrême du rythme sur quatre journées rallongées, source de fatigue accrue. Comment concilier ce nouveau rythme de travail avec les contraintes de tous les secteurs professionnels ?",
    ask: "不降薪的四天工作周值得推广吗？它适用于所有行业吗，会不会加大不同职业群体间的差距或工作强度？",
  },
  {
    id: "s-avion",
    topic: "environnement",
    title: "Vols intérieurs courts : faut-il aller plus loin dans l'interdiction de l'avion ?",
    source: "D'après L'Écho des territoires, 22 novembre 2024",
    doc: "Alors que la loi interdit déjà certaines liaisons aériennes intérieures lorsqu'une alternative en train existe en moins de deux heures trente, des associations écologistes réclament aujourd'hui d'étendre ce seuil à quatre heures. Selon leurs calculs, le transport aérien intérieur reste proportionnellement bien plus émetteur de gaz à effet de serre par passager que le rail électrique. « Continuer à subventionner des vols entre grandes métropoles reliées par le TGV est un non-sens climatique », soutient Thomas Garnier, porte-parole d'un collectif citoyen. Les compagnies régionales et les chambres de commerce dénoncent toutefois une mesure avant tout symbolique qui fragiliserait les régions enclavées et leurs entreprises exportatrices. Elles rappellent que le prix des billets de train reste parfois supérieur à celui de l'avion. Faut-il contraindre davantage les voyageurs ou rendre d'abord le rail plus accessible et fiable ?",
    ask: "为了环保应该进一步限制或禁止国内短途航班吗？环保约束与地区联通、铁路票价及出行公平如何兼顾？",
  },
  {
    id: "s-viande",
    topic: "environnement",
    title: "Cantines scolaires : faut-il généraliser plusieurs repas végétariens par semaine ?",
    source: "D'après Le Journal des communes, 9 janvier 2025",
    doc: "Depuis l'instauration obligatoire d'au moins un menu végétarien hebdomadaire dans les cantines scolaires, plusieurs municipalités envisagent désormais de passer à deux ou trois repas sans viande par semaine. Les élus favorables à cette évolution rappellent l'impact écologique considérable de l'élevage intensif et soulignent que les menus végétariens permettent aussi de maîtriser le budget alimentaire des écoles face à l'inflation. « Il ne s'agit pas d'interdire la viande, mais d'habituer les enfants à une alimentation plus variée et responsable », explique Hélène Moreau, adjointe chargée de l'éducation à Grenoble. En face, des parents d'élèves ainsi que des éleveurs locaux protestent contre une décision jugée idéologique. Ils craignent des carences nutritionnelles pour les enfants issus de familles modestes et dénoncent un gaspillage lorsque les plats sont boudés. La municipalité doit-elle adapter ainsi la restauration scolaire au nom de la transition écologique ?",
    ask: "市政和学校食堂应该推广每周多次纯素食菜单吗？环保、财政与营养自由、家庭选择权之间应如何划界？",
  },
  {
    id: "s-portable",
    topic: "education",
    title: "« Pause numérique » à l'école : la solution contre la distraction des élèves ?",
    source: "D'après L'Observateur éducatif, 17 octobre 2024",
    doc: "Testée depuis la rentrée dans près de deux cents collèges français, l'obligation de déposer son téléphone portable dans un casier dès l'arrivée dans l'établissement relance la discussion sur la place du numérique à l'école. D'après les premiers bilans des chefs d'établissement, le climat scolaire s'est apaisé : les élèves discutent davantage dans la cour et les cas de cyberharcèlement survenus pendant les récréations ont nettement diminué. « Sans écran dans la poche, leur attention en cours s'améliore sensiblement », constate Olivier Martin, principal en Seine-Maritime. Des pédagogues et des représentants d'élèves restent néanmoins sceptiques face à une approche purement restrictive. Selon eux, mettre l'appareil en consigne à l'école ne règle rien le soir à la maison et prive les enseignants d'un outil utile pour vérifier une source ou travailler l'esprit critique. Vaut-il mieux interdire strictement le téléphone ou apprendre aux jeunes à le maîtriser ?",
    ask: "学校应当全面收缴禁用手机，还是教会学生合理使用？校园管控与家庭责任、媒介素养教育哪个更有效？",
  },
  {
    id: "s-notes",
    topic: "education",
    title: "Faut-il supprimer les notes chiffrées jusqu'à la fin du collège ?",
    source: "D'après Cahiers de l'école, 5 novembre 2024",
    doc: "Dans plusieurs établissements pilotes, les bulletins trimestriels ne comportent plus aucune note sur vingt, remplacée par une grille de compétences acquises et des commentaires détaillés. Les partisans de cette réforme estiment que la notation traditionnelle stigmatise les élèves en difficulté dès le plus jeune âge et encourage une compétition stérile. « Un élève qui reçoit un 6 sur 20 se décourage et cesse d'essayer, alors qu'une appréciation précise lui montre comment progresser », défend Camille Laurent, chercheuse en sciences de l'éducation. À l'inverse, de nombreuses familles et certains professeurs regrettent un système devenu flou et difficile à interpréter. Ils soutiennent que les notes donnent des repères clairs sur le niveau réel d'un jeune et le préparent aux exigences du lycée puis des examens nationaux. L'école peut-elle évaluer avec bienveillance sans perdre en exigence ni en lisibilité ?",
    ask: "中学取消传统分数制利大于弊还是弊大于利？如何平衡保护学生自信心与提供清晰客观的学业标准？",
  },
  {
    id: "s-reseaux",
    topic: "numerique",
    title: "Interdire les réseaux sociaux aux moins de quinze ans : mesure protectrice ou vœu pieux ?",
    source: "D'après Le Monde numérique, 28 janvier 2025",
    doc: "Face à la hausse des troubles du sommeil et de l'anxiété chez les préadolescents, plusieurs gouvernements européens veulent instaurer une vérification stricte de l'âge afin de bloquer l'accès aux réseaux sociaux avant quinze ans. Les pédopsychiatres soutiennent largement cette barrière légale : « Les algorithmes captent l'attention de cerveaux encore vulnérables et exposent les plus jeunes à des contenus inadaptés », avertit le docteur Julien Mercier. Mais les associations de défense des libertés numériques et les adolescents eux-mêmes pointent de sérieuses limites pratiques. Pour vérifier l'âge de chaque internaute, il faudrait exiger une pièce d'identité ou une reconnaissance faciale, au risque de menacer la vie privée de tous les utilisateurs. De plus, les jeunes contournent aisément ces blocages en utilisant le compte d'un proche. Peut-on protéger efficacement les mineurs en ligne par la seule interdiction technique ?",
    ask: "禁止 15 岁以下青少年使用社交网络可行且有效吗？保护未成年人心理健康与隐私安全、技术可行性之间的矛盾怎么解决？",
  },
  {
    id: "s-ia",
    topic: "numerique",
    title: "L'intelligence artificielle à l'université : tricherie généralisée ou nouvel outil de travail ?",
    source: "D'après Campus & Savoirs, 11 février 2025",
    doc: "Une enquête menée auprès de trois mille étudiants français révèle que près de sept sur dix utilisent régulièrement des modèles d'intelligence artificielle générative pour préparer leurs exposés ou corriger leurs dissertations. Devant l'impossibilité technique de détecter de manière fiable les textes produits par des machines, les universités hésitent sur la conduite à tenir. Certains enseignants réclament le retour massif aux épreuves écrites à la main sur table afin de préserver la valeur des diplômes : « Si l'étudiant ne rédige plus lui-même, il n'apprend plus à structurer sa pensée », s'inquiète Agnès Delacroix, professeure de droit à Bordeaux. D'autres chercheurs plaident au contraire pour l'intégration encadrée de ces outils dans les cursus, arguant que le monde professionnel les exigera demain. L'université doit-elle sanctuariser l'évaluation traditionnelle ou transformer profondément ses méthodes d'apprentissage ?",
    ask: "高校面对生成式 AI 应当严厉禁止还是纳入教学？这会对学术诚信、独立思考能力以及未来职场能力产生什么影响？",
  },
  {
    id: "s-sport",
    topic: "sante",
    title: "Le « sport sur ordonnance » remboursé par la Sécurité sociale divise le monde médical",
    source: "D'après Santé publique Hebdo, 19 novembre 2024",
    doc: "Pour lutter contre la sédentarité et les maladies chroniques telles que le diabète ou l'hypertension, plusieurs députés proposent que les séances de sport prescrites par un médecin soient désormais remboursées par l'assurance maladie. Les défenseurs du texte rappellent qu'une activité physique régulière réduit nettement les hospitalisations coûteuses et améliore la santé mentale des patients isolés. « Prévenir coûte toujours moins cher à long terme que soigner des pathologies lourdes », souligne le docteur Karim Hadj, médecin généraliste à Lille. Toutefois, les organismes d'assurance maladie et certains économistes s'alarment du coût immédiat d'une telle mesure dans un contexte de déficit budgétaire. Ils craignent également des abus ou un manque d'encadrement qualifié dans certaines zones rurales. Financer la pratique sportive relève-t-il vraiment de la solidarité nationale ou de la responsabilité personnelle de chacun ?",
    ask: "医保是否应该报销「运动处方」？公共卫生预防收益与医保财政赤字、个人责任边界之间应当如何取舍？",
  },
  {
    id: "s-occasion",
    topic: "consommation",
    title: "Mode de seconde main : véritable sobriété écologique ou nouveau prétexte pour acheter plus ?",
    source: "D'après Consommation & Société, 7 décembre 2024",
    doc: "En cinq ans, les plateformes de revente de vêtements entre particuliers ont connu une croissance spectaculaire en France, portées notamment par les moins de trente ans. Pour beaucoup d'acheteurs, la seconde main représente une double victoire : préserver son pouvoir d'achat en période d'inflation tout en évitant la fabrication de textiles neufs, très polluante. « Grâce à la revente, j'ai réduit de moitié mon budget mode sans me priver », confie Léa, étudiante à Lyon. Pourtant, une étude récente de l'Agence de la transition écologique tempère cet enthousiasme. Les chercheurs observent un effet rebond inquiétant : sachant qu'ils pourront revendre facilement à bas prix, certains consommateurs achètent davantage d'articles neufs de mode rapide, tandis que les colis circulent sur de longues distances. La seconde main transforme-t-elle vraiment nos habitudes vers plus de sobriété ou entretient-elle finalement la surconsommation ?",
    ask: "二手消费潮真的带来了环保与理性消费吗？它在省钱与「回购反弹效应、物流碳排」之间存在哪些隐忧？",
  },
  {
    id: "s-tourisme",
    topic: "culture",
    title: "Surtourisme : les quotas de visiteurs et taxes d'entrée sont-ils une bonne réponse ?",
    source: "D'après Perspectives culturelles, 16 janvier 2025",
    doc: "Inspirées par Venise ou le parc national des Calanques, plusieurs villes et sites patrimoniaux européens instaurent des jauges journalières ou un droit d'entrée payant pour les visiteurs d'un jour. Les maires concernés défendent une mesure d'urgence destinée à protéger des monuments fragiles et à rendre aux habitants un cadre de vie supportable, menacé par la hausse des locations saisonnières et la saturation des transports. « Sans régulation, nos centres historiques deviennent des décors vidés de leur population », alerte Pierre-Yves Blanc, édile d'une commune littorale bretonne. Les hôteliers et commerçants redoutent au contraire une chute de fréquentation nuisible à l'emploi local, tandis que certaines associations s'inquiètent de voir la culture et le patrimoine réservés aux touristes les plus aisés. Comment concilier préservation des lieux, accueil du public et vitalité économique ?",
    ask: "热门城市和景区限制游客人数或收取进城费合理吗？如何在保护文化遗产与居民生活、保障旅游经济与文化普及公平之间找到平衡？",
  },
  {
    id: "s-benevolat",
    topic: "societe",
    title: "Un service citoyen obligatoire pour les jeunes : levier de cohésion ou contrainte inutile ?",
    source: "D'après Débat public, 2 février 2025",
    doc: "Régulièrement relancée dans le débat politique, l'idée d'instaurer un engagement civique obligatoire de quelques mois pour tous les jeunes de dix-huit à vingt-cinq ans divise profondément la société. Ses promoteurs y voient un moyen irremplaçable de brasser des jeunes issus de milieux sociaux très différents tout en renforçant les associations, les hôpitaux ou les écoles publiques en manque de bras. « Passer six mois au service de l'intérêt général développe l'empathie et le sens des responsabilités », plaide Sophie Renard, présidente d'une fédération d'entraide. À l'opposé, de nombreux syndicats étudiants dénoncent une perte d'autonomie et un coût financier lourd pour l'État, craignant en outre que des bénévoles contraints ne remplacent de véritables emplois salariés. L'engagement citoyen peut-il encore garder son sens s'il cesse d'être volontaire ?",
    ask: "应该要求所有年轻人参加一段时间的强制社会/公民服务吗？社会凝聚力、公共服务需求与个人自由、替代正式岗位风险如何权衡？",
  },
  {
    id: "s-vote-obligatoire",
    topic: "politique-justice",
    title: "L'abstention augmente : faut-il instaurer le vote obligatoire en France ?",
    source: "D'après La Revue civique, 18 janvier 2025",
    doc: "Face à des taux d'abstention records lors des dernières élections locales et législatives, notamment chez les moins de trente ans, plusieurs élus relancent l'idée d'un vote obligatoire inspiré du modèle belge, assorti d'une faible amende. Selon eux, cet engagement minimal restaurerait la légitimité des assemblées et obligerait les responsables politiques à prendre en compte les quartiers les plus éloignés des urnes. « Lorsqu'un député est élu avec seulement trente pour cent des inscrits, le lien démocratique s'affaiblit durablement », soutient la sénatrice Claire Delacroix, favorable à cette réforme. À l'inverse, de nombreux juristes estiment que la liberté de ne pas voter fait partie du droit démocratique et qu'une contrainte administrative multiplierait simplement les votes blancs ou protestataires, sans résoudre la crise de confiance envers les partis. La loi peut-elle véritablement raviver l'intérêt civique ?",
    ask: "强制投票是挽救选举高弃权率的有效出路，还是掩盖政治信任危机的形式主义？",
  },
  {
    id: "s-biometrie",
    topic: "sciences-ethique",
    title: "Reconnaissance faciale dans l'espace public : sécurité renforcée ou dérive liberticide ?",
    source: "D'après Cahiers Sciences & Société, 11 février 2025",
    doc: "Plusieurs métropoles européennes testent des systèmes d'intelligence artificielle capables d'identifier des comportements suspects ou des personnes recherchées dans les gares et les stades. Les défenseurs de cette technologie soulignent sa rapidité pour retrouver un enfant disparu ou prévenir les attentats dans des lieux très fréquentés. « Nos agents gagnent un temps précieux sur le terrain lorsque chaque seconde compte », assure Marc Vasseur, directeur d'une régie municipale de sécurité. Pourtant, des chercheurs en informatique et la CNIL mettent en garde contre des erreurs d'identification plus fréquentes sur certaines populations, l'effet dissuasif sur les manifestations citoyennes et le risque de voir s'installer une surveillance généralisée irréversible, y compris à des fins commerciales. Comment tracer la frontière éthique entre innovation sécuritaire, efficacité publique et préservation des libertés individuelles ?",
    ask: "车站与大型活动使用 AI 人脸识别能显著提升公共安全，还是会带来算法偏见与常态化监控的伦理滑坡？",
  },
  {
    id: "s-desinformation",
    topic: "medias-presse",
    title: "Fausses nouvelles en ligne : faut-il sanctionner pénalement les internautes qui les relaient ?",
    source: "D'après Chroniques Médias, 29 janvier 2025",
    doc: "Lors de récentes crises sanitaires et climatiques, des vidéos manipulées par l'intelligence artificielle ont cumulé des millions de vues en quelques heures avant tout démenti journalistique. Pour endiguer cette viralité, un projet de loi envisage d'étendre la responsabilité financière non seulement aux grandes plateformes, mais aussi aux comptes influents qui relaient sciemment des rumeurs dangereuses sans vérification. « Partager un faux remède médical devant trois cent mille abonnés ne peut plus rester un geste anodin », plaide Olivier Garnier, juriste spécialisé dans les médias numériques. Si les rédactions saluent une prise de conscience face au discrédit qui frappe la presse, des défenseurs des droits civiques craignent qu'une qualification floue de « fausse information » ne décourage la satire, la critique politique ou l'expression légitime des lanceurs d'alerte.",
    ask: "打击网传假消息该对大V转发追责处罚，还是应该靠推荐算法透明度与媒体教育解决？",
  },
  {
    id: "s-encadrement-loyers",
    topic: "logement-urbanisme",
    title: "L'encadrement strict des loyers protège-t-il vraiment les locataires ?",
    source: "D'après Villes & Territoires, 6 février 2025",
    doc: "Appliqué à Paris, Lyon ou Lille afin d'endiguer la flambée immobilière, le plafonnement des loyers limite légalement le prix au mètre carré selon le quartier et l'ancienneté de l'immeuble. Pour les associations de locataires, cette mesure indispensable évite que les soignants, enseignants ou jeunes actifs ne soient chassés vers la grande banlieue. « Sans ce plafond, les loyers progresseraient trois fois plus vite que les salaires dans les zones tendues », affirme Nadia Benali, porte-parole d'un collectif urbain d'usagers. Les fédérations immobilières dénoncent au contraire un effet pervers : face à une rentabilité jugée insuffisante et à l'obligation de rénover les « passoires thermiques », de nombreux propriétaires retirent leurs biens du marché traditionnel pour les vendre ou les louer à la semaine aux touristes. Comment loger dignement tous les actifs ?",
    ask: "大城市实行严格房租限价究竟保护了工薪租客，还是吓退了房东供给与旧房节能改造？",
  },
  {
    id: "s-fiscalite-ecolo",
    topic: "economie-finances",
    title: "Financer la transition verte par de nouvelles taxes sur la consommation : juste ou inégalitaire ?",
    source: "D'après L'Écho des Finances publiques, 22 janvier 2025",
    doc: "Pour atteindre la neutralité carbone sans creuser davantage la dette publique, un rapport économique suggère de taxer davantage les billets d'avion, les voitures lourdes et les produits importés à forte empreinte carbone, tout en reversant une partie des recettes sous forme de prime aux ménages modestes. Les partisans de cette « écologie incitative » rappellent que le signal-prix reste l'outil le plus efficace pour orienter entreprises et acheteurs vers des choix sobres. « Chaque euro prélevé doit devenir un investissement visible dans les trains du quotidien et l'isolation des logements », défend Laurent Mercier, économiste universitaire. Mais plusieurs syndicats redoutent une baisse mécanique du pouvoir d'achat dans les zones rurales dépourvues de transports collectifs et exigent d'abord des investissements dans les alternatives abordables. Comment rendre la transition budgétairement juste ?",
    ask: "通过碳税和消费税推动绿色转型与减债是否可行？怎样防止农村和中低收入家庭承担过重负担？",
  },
  {
    id: "s-transports-gratuits",
    topic: "transports-mobilite",
    title: "Transports publics gratuits dans les grandes villes : mesure sociale modèle ou fausse bonne idée ?",
    source: "D'après Mobilité & Cité, 14 février 2025",
    doc: "Après Dunkerque, Montpellier est devenue fin 2023 la plus grande métropole française à offrir la gratuité des tramways et bus à tous ses habitants, enregistrant rapidement une hausse de fréquentation de près de 20 %. Les partisans saluent un double coup de pouce pour le pouvoir d'achat et pour le climat, en incitant les automobilistes à laisser leur voiture au garage. « Supprimer le ticket libère les familles de dépenses contraintes tout en apaisant la circulation urbaine », souligne Camille Robert, maire adjointe aux mobilités douces. Toutefois, la Cour des comptes et plusieurs experts en urbanisme objectent que la perte de recettes billetteries se chiffre en dizaines de millions d'euros, réduisant d'autant la capacité des villes à prolonger les lignes vers les banlieues mal desservies ou à augmenter la fréquence des rames.",
    ask: "城市公交全免费是兼顾环保与民生的好办法，还是会掏空用于郊区延伸线路的建设资金？",
  },
  {
    id: "s-francophonie",
    topic: "arts-francophonie",
    title: "À l'ère du streaming mondial, faut-il maintenir des quotas d'œuvres francophones à la radio et sur les écrans ?",
    source: "D'après Regards Culturels, 3 février 2025",
    doc: "Depuis près de trente ans, la France impose aux radios musicales et aux chaînes de télévision de diffuser une part minimale de chansons et de créations d'expression française ou européenne, une règle désormais étendue aux plateformes internationales de streaming vidéo. Pour les artistes et éditeurs indépendants, cette exception culturelle demeure indispensable afin d'éviter qu'un oligopole anglophone et des algorithmes mondiaux n'uniformisent les goûts des jeunes générations. « Sans mécanisme de soutien, le cinéma francophone et les auteurs locaux peineraient à financer des projets originaux », rappelle Agnès Lefebvre, productrice culturelle. À l'inverse, certains auditeurs et producteurs estiment que ces seuils figent la programmation sur les mêmes succès établis, alors que les jeunes artistes émergent aujourd'hui directement sur les réseaux sociaux sans passer par la régulation traditionnelle.",
    ask: "在全球流媒体算法主导下，要求广播与视频平台保留法语/本土作品配额还有必要吗？会保护创作还是显得僵化？",
  },
];

/** How a talk on a subject is built (monologue suivi). */
export const TALK_PLAN: { zh: string; fr: string }[] = [
  { zh: "1. 引入背景：点明主题与来源，不照抄原文", fr: "Ce document, tiré de…, aborde la question de…" },
  { zh: "2. 提炼矛盾，提出中立开放的 problématique", fr: "Il met en lumière une tension entre… Dès lors, dans quelle mesure… ?" },
  { zh: "3. 表明立场并宣布提纲（annonce du plan）", fr: "Pour ma part, j'estime que… Je présenterai d'abord…, puis j'aborderai…" },
  { zh: "4. 论点一 + 事实例证", fr: "Tout d'abord,… Prenons l'exemple concret de…" },
  { zh: "5. 论点二 + 深化分析", fr: "Par ailleurs,… Cela s'explique notamment par le fait que…" },
  { zh: "6. 主动让步并反驳异议（nuance）", fr: "Certes, on pourrait objecter que… Toutefois, il convient de souligner que…" },
  { zh: "7. 总结收束（留出辩论空间）", fr: "En définitive, si…, il me semble essentiel de…" },
];

/** Four-step method to extract a DELF B2 problématique in 1 minute before drafting the outline. */
export const PROBLEMATIQUE_TIPS: string[] = [
  "先圈出材料里的两股对立力量（例如：效率 vs 心理健康、环保约束 vs 地区公平）。",
  "把冲突抽象成一句中立的开放式问题（不要用 oui/non 的站队口吻，也不要复述新闻细节）。",
  "常用句型：Dans quelle mesure peut-on… ? / Comment concilier… et… ? / Jusqu'à quel point… ?",
  "用自己的同义词改写关键词，避免整段照抄材料原句。",
];

/** Quick structural check of a learner's 1-minute problématique draft (pure non-AI check). */
export function checkProblematiqueDraft(draft: string, doc: string): { ok: boolean; notes: string[] } {
  const clean = draft.trim();
  const wc = countWords(clean);
  const notes: string[] = [];
  if (wc < 8) notes.push("句子太短（建议 10–30 词），试着写清「矛盾双方 + 核心疑问」。");
  if (wc > 45) notes.push("偏长，problématique 最好控制在 1–2 句精炼提问内。");
  const isQuestion = clean.includes("?") || /\b(savoir si|dans quelle mesure|comment|jusqu'à quel point|faut-il|peut-on|convient-il)\b/i.test(clean);
  if (!isQuestion) notes.push("缺少提问或间接疑问句式（可用 Dans quelle mesure… / Comment concilier… / … ?）。");
  const docTokens = doc
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  const draftNorm = clean.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).join(" ");
  let copied = false;
  for (let i = 0; i + 6 <= docTokens.length; i++) {
    const span = docTokens.slice(i, i + 6).join(" ");
    if (draftNorm.includes(span)) {
      copied = true;
      break;
    }
  }
  if (copied) notes.push("检测到与材料连续 6 词以上重合，尽量换用同义词改写（reformulation）。");
  return { ok: notes.length === 0, notes };
}

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
  const source = str(r.source, 160);
  if (!title || doc.length < 300) return null;
  return { id: `ai-${topic}`, topic, title, ...(source ? { source } : {}), doc, ask: str(r.ask, 200) || "指出材料提出的问题，表明你的看法并论证。" };
}

/** Determine whether a speaking submission relied on keyboard typing instead of speech recognition / Azure STT. */
export function isSpeakingTyped(opts: {
  monologueVoice: boolean;
  voiceMonologueWords: number;
  totalMonologueWords: number;
  answeredTurns: number;
  debateVoice: boolean;
}): boolean {
  if (!opts.monologueVoice || opts.voiceMonologueWords <= 0) return true;
  if (opts.answeredTurns > 0 && !opts.debateVoice) return true;
  const allowedEdits = Math.min(15, Math.round(opts.voiceMonologueWords * 0.1));
  return Math.abs(opts.totalMonologueWords - opts.voiceMonologueWords) > allowedEdits;
}

const OUTLINE_STOPWORDS = new Set([
  "le", "la", "les", "un", "une", "des", "du", "de", "au", "aux", "et", "ou", "mais", "donc", "or", "ni", "car",
  "a", "à", "en", "dans", "par", "pour", "sur", "sous", "avec", "sans", "chez", "vers", "entre", "selon",
  "ce", "cet", "cette", "ces", "ca", "ça", "il", "elle", "ils", "elles", "on", "nous", "vous", "je", "tu", "se",
  "qui", "que", "quoi", "dont", "où", "ne", "pas", "plus", "très", "bien", "est", "sont", "ont", "être", "avoir",
]);

function stripElision(word: string): string {
  return word.toLowerCase().replace(/^(?:l|d|qu|n|s|c|j|m|t)[’']/i, "");
}

/**
 * Compress full preparation notes into short keyword-outline cues for no-aux speaking delivery.
 * Complete prose sentences are reduced to at most 3 keywords per clause (up to 8 cues).
 */
export function outlineKeywords(notes: string): string[] {
  const segments = notes
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]+|\d+[.)])\s*/, "").trim())
    .flatMap((line) => line.split(/[.!?;。！？；]+/))
    .map((s) => s.trim())
    .filter(Boolean);
  const cues: string[] = [];
  for (const seg of segments) {
    const words = seg.match(/[\p{L}\p{N}'’-]+/gu) ?? [];
    if (!words.length) continue;
    const meaningful = words.filter((w) => {
      const bare = stripElision(w);
      return /\p{Script=Han}/u.test(bare) || (bare.length >= 3 && !OUTLINE_STOPWORDS.has(bare));
    });
    const picked = (meaningful.length >= 2 ? meaningful : words).slice(0, 3);
    const suffix = words.length > 3 ? " …" : "";
    cues.push(`${picked.join(" · ")}${suffix}`);
    if (cues.length >= 8) break;
  }
  return cues;
}

/**
 * Enforce immutable original transcripts in no-aux exam mode so pre-grading edits cannot alter what is assessed.
 */
export function resolveLockedTranscripts(opts: {
  noAuxMode: boolean;
  said: string;
  rawSaid: string;
  turns: DebateTurn[];
  rawTurns: Record<number, string>;
}): { transcript: string; turns: DebateTurn[]; monologueLocked: boolean; lockedTurnIndices: number[] } {
  if (!opts.noAuxMode) {
    return { transcript: opts.said, turns: opts.turns, monologueLocked: false, lockedTurnIndices: [] };
  }
  const monologueLocked = !!opts.rawSaid.trim();
  const transcript = monologueLocked ? opts.rawSaid : opts.said;
  const lockedTurnIndices: number[] = [];
  const turns = opts.turns.map((t, idx) => {
    const raw = opts.rawTurns[idx];
    if (raw && raw.trim()) {
      lockedTurnIndices.push(idx);
      return { ...t, a: raw };
    }
    return t;
  });
  return { transcript, turns, monologueLocked, lockedTurnIndices };
}

/** Minutes and seconds, 4:05. */
export const clock = (sec: number) => `${Math.floor(Math.max(0, sec) / 60)}:${String(Math.max(0, sec) % 60).padStart(2, "0")}`;
