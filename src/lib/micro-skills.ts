/**
 * 5 分钟高频提分微技能专训（4 个专题 × 3 道高权重 B2 题目 = 12 题）：
 * - CO 说话人态度与讽刺弦外之音
 * - CO 数字对比与同义替换陷阱
 * - CE 作者立场与隐含推论
 * - CE 同义改写与限定词排雷 (ne…que / sauf / à peine)
 * 错题直接通过 `buildCompMissSnapshot` 写入错题中心（#/reflow Tab 4）以便次日交互重练。
 */
import { gradeCompQuestion, type CompKind, type CompQuestion, type QSkill } from "./exam-schema";
import { buildCompMissSnapshot, type CompMiss } from "./listening";

export interface MicroSkillItem extends CompQuestion {
  id: string;
  /** Audio transcript (CO) or article excerpt (CE). */
  text: string;
  doc: 0;
  qType?: "qcm";
}

export interface MicroSkillTrack {
  id: string;
  part: CompKind;
  title: string;
  badge: string;
  minutes: number;
  desc: string;
  items: readonly MicroSkillItem[];
}

export const MICRO_SKILL_TRACKS: readonly MicroSkillTrack[] = [
  {
    id: "co-attitude",
    part: "listen",
    title: "CO · 说话人态度与讽刺识别",
    badge: "态度推断",
    minutes: 5,
    desc: "听 3 段电台短评，专攻让步转折后的真实态度与反讽语气判断。",
    items: [
      {
        id: "coa-1",
        doc: 0,
        pts: 2,
        skill: "opinion" satisfies QSkill,
        text: "Le maire nous promet une piste cyclable révolutionnaire d'ici dix ans. C'est merveilleux sur le papier, bien sûr… en attendant, les cyclistes continuent de slalomer entre les camionnettes mal garées tous les matins.",
        q: "Quel ton le chroniqueur emploie-t-il au sujet du projet municipal ?",
        options: [
          "Il félicite sincèrement la mairie pour sa rapidité d'action.",
          "Il se montre ironique face à une annonce lointaine et sans effet immédiat.",
          "Il propose de supprimer toutes les pistes cyclables du centre-ville.",
        ],
        answer: 1,
        evidence: "C'est merveilleux sur le papier, bien sûr… en attendant, les cyclistes continuent de slalomer entre les camionnettes mal garées tous les matins.",
        trapTypes: ["字面反话误读", "", "极端无中生有"],
        why: "« C'est merveilleux sur le papier, bien sûr… en attendant… » 通过“纸上听着美妙+然而现实仍险象环生”的反差构成明显反讽与批评。",
      },
      {
        id: "coa-2",
        doc: 0,
        pts: 2,
        skill: "opinion" satisfies QSkill,
        text: "Certes, cette application scolaire facilite l'envoi des devoirs aux parents. Toutefois, réduire le dialogue éducatif à une série de notifications automatiques me laisse franchement perplexe quant à la qualité du lien humain.",
        q: "Quelle est la position réelle de l'intervenante sur cette application ?",
        options: [
          "Elle exprime des réserves sérieuses malgré un avantage pratique reconnu.",
          "Elle estime que l'application remplacera avantageusement les réunions de parents.",
          "Elle refuse catégoriquement tout usage du numérique à l'école.",
        ],
        answer: 0,
        evidence: "Toutefois, réduire le dialogue éducatif à une série de notifications automatiques me laisse franchement perplexe quant à la qualité du lien humain.",
        trapTypes: ["", "混淆让步分句", "范围绝对化"],
        why: "句首 Certes 先礼貌让步肯定便利性，Toutefois 后用 « me laisse franchement perplexe » 表达深层怀疑与保留态度。",
      },
      {
        id: "coa-3",
        doc: 0,
        pts: 2,
        skill: "inference" satisfies QSkill,
        text: "On aurait pu croire que la hausse du prix des billets dissuaderait les touristes. Eh bien pas du tout : les musées n'ont jamais enregistré autant d'entrées qu'au mois d'août !",
        q: "Que traduit l'expression « Eh bien pas du tout » dans cet extrait ?",
        options: [
          "La confirmation attendue d'une baisse de fréquentation.",
          "L'étonnement face à un résultat inverse aux prévisions.",
          "Le regret que les musées ferment pendant l'été.",
        ],
        answer: 1,
        evidence: "On aurait pu croire que la hausse du prix des billets dissuaderait les touristes. Eh bien pas du tout : les musées n'ont jamais enregistré autant d'entrées qu'au mois d'août !",
        trapTypes: ["误把假设当事实", "", "张冠李戴"],
        why: "« On aurait pu croire que… Eh bien pas du tout » 典型表达现实结果与原本预判完全相反的惊讶。",
      },
    ],
  },
  {
    id: "co-numbers",
    part: "listen",
    title: "CO · 数字对比与同义替换陷阱",
    badge: "数字/同义",
    minutes: 5,
    desc: "抓牢分数、倍数、前后增减基准与选项同义改写，拒绝字面诱捕。",
    items: [
      {
        id: "con-1",
        doc: 0,
        pts: 2,
        skill: "detail" satisfies QSkill,
        text: "Alors qu'en 2019 seulement un quart des ménages interrogés achetaient des produits en vrac régulièrement, ils sont aujourd'hui près des deux tiers, même si quatre habitants sur dix jugent l'offre encore insuffisante en banlieue.",
        q: "Quelle évolution l'enquête met-elle en évidence ?",
        options: [
          "La proportion d'acheteurs réguliers en vrac est passée d'environ 25 % à près de 66 %.",
          "Plus des trois quarts des habitants évitent désormais les achats en vrac.",
          "Quatre ménages sur dix achètent en vrac chaque semaine en banlieue.",
        ],
        answer: 0,
        evidence: "Alors qu'en 2019 seulement un quart des ménages interrogés achetaient des produits en vrac régulièrement, ils sont aujourd'hui près des deux tiers",
        trapTypes: ["", "误用旧数据反推", "偷换数字主语"],
        why: "un quart = 25 %，deux tiers ≈ 66 %；选项 C 偷换了“认为供给不足的四成”这一主语。",
      },
      {
        id: "con-2",
        doc: 0,
        pts: 2,
        skill: "paraphrase" satisfies QSkill,
        text: "Contrairement à ce qu'avait annoncé la direction, la suppression de la ligne de bus de nuit n'a pas permis de réaliser les économies espérées : le recours accru aux taxis municipaux coûte désormais moitié plus cher.",
        q: "Qu'apprend-on sur le coût financier de cette décision ?",
        options: [
          "La mairie dépense aujourd'hui moins que prévu grâce aux taxis.",
          "Les dépenses de transport nocturne ont en réalité augmenté de 50 %.",
          "La ligne de bus de nuit a été doublée après les plaintes des usagers.",
        ],
        answer: 1,
        evidence: "le recours accru aux taxis municipaux coûte désormais moitié plus cher.",
        trapTypes: ["反义混淆", "", "无中生有"],
        why: "coûter moitié plus cher 即贵了一半（+50 %），对应选项 B 的同义改写 augmenté de 50 %。",
      },
      {
        id: "con-3",
        doc: 0,
        pts: 2,
        skill: "detail" satisfies QSkill,
        text: "La subvention régionale couvrira soixante pour cent des travaux d'isolation, à condition que le dossier soit déposé avant le trente septembre ; passé ce délai, l'aide retombera à trente pour cent.",
        q: "Que se passe-t-il pour un propriétaire qui soumet son dossier en octobre ?",
        options: [
          "Il perd définitivement tout droit à la subvention.",
          "Son aide reste maintenue au taux maximal de 60 %.",
          "Le montant pris en charge est réduit de moitié par rapport au taux plein.",
        ],
        answer: 2,
        evidence: "passé ce délai, l'aide retombera à trente pour cent.",
        trapTypes: ["程度绝对化", "忽略期限条件", ""],
        why: "十月已过 9 月 30 日截止期，补贴由 60 % 降至 30 %，即减半（réduit de moitié）。",
      },
    ],
  },
  {
    id: "ce-nuance",
    part: "read",
    title: "CE · 作者立场与隐含推论识别",
    badge: "观点推理",
    minutes: 5,
    desc: "剖析 3 段 B2 报刊评论，区分客观转述、让步条件与作者隐晦批判。",
    items: [
      {
        id: "cen-1",
        doc: 0,
        pts: 2,
        skill: "opinion" satisfies QSkill,
        text: "Présenter le tout-numérique administratif comme une libération universelle relève d'un optimisme hâtif. Tant que près d'un citoyen sur six déclare peiner à effectuer seul une démarche fiscale en ligne, fermer les guichets physiques reviendra à créer une citoyenneté à deux vitesses.",
        q: "Selon l'auteur, la dématérialisation totale des services publics :",
        options: [
          "est déjà prête à remplacer définitivement l'accueil en mairie.",
          "risque d'exclure une partie des usagers faute d'accompagnement humain.",
          "concerne uniquement les jeunes générations peu intéressées par la fiscalité.",
        ],
        answer: 1,
        evidence: "Tant que près d'un citoyen sur six déclare peiner à effectuer seul une démarche fiscale en ligne, fermer les guichets physiques reviendra à créer une citoyenneté à deux vitesses.",
        trapTypes: ["原词复现但立场相反", "", "偷换适用人群"],
        why: "关键词 « optimisme hâtif »（草率乐观）和 « citoyenneté à deux vitesses »（双速/分裂公民待遇）明确警告缺少人工窗口会排斥困难人群。",
      },
      {
        id: "cen-2",
        doc: 0,
        pts: 2,
        skill: "inference" satisfies QSkill,
        text: "Plusieurs groupes industriels vantent leurs emballages « cent pour cent recyclables ». Pourtant, selon l'Agence de l'environnement, moins de trente pour cent de ces plastiques sont effectivement triés et transformés faute de filières rentables.",
        q: "Que suggère implicitement cet article à propos du label « 100 % recyclable » ?",
        options: [
          "Une capacité théorique de recyclage ne garantit pas un traitement réel effectif.",
          "Tous les plastiques étiquetés ainsi sont intégralement transformés en usine.",
          "L'Agence de l'environnement interdit désormais toute vente de plastique.",
        ],
        answer: 0,
        evidence: "Pourtant, selon l'Agence de l'environnement, moins de trente pour cent de ces plastiques sont effectivement triés et transformés faute de filières rentables.",
        trapTypes: ["", "照搬宣传口号", "过度推断"],
        why: "« recyclable »（理论上可回收）与 « effectivement triés »（实际只有不到三成被回收）之间的反差揭露了商业宣传误导。",
      },
      {
        id: "cen-3",
        doc: 0,
        pts: 2,
        skill: "opinion" satisfies QSkill,
        text: "Si l'on peut saluer l'essor des formations hybrides pour les salariés en reconversion, il serait imprudent d'y voir une solution miraculeuse aux pénuries de main-d'œuvre sans revaloriser d'abord les salaires des métiers en tension.",
        q: "Quelle condition l'auteur juge-t-il prioritaire face aux difficultés de recrutement ?",
        options: [
          "Supprimer les formations en ligne au profit des cours magistraux.",
          "Améliorer parallèlement la rémunération des secteurs concernés.",
          "Limiter la reconversion professionnelle aux cadres dirigeants.",
        ],
        answer: 1,
        evidence: "il serait imprudent d'y voir une solution miraculeuse aux pénuries de main-d'œuvre sans revaloriser d'abord les salaires des métiers en tension.",
        trapTypes: ["曲解让步分句", "", "无中生有"],
        why: "« sans revaloriser d'abord les salaires » 明确指出提高紧缺岗位薪资待遇才是前置关键，单靠混合培训远远不够。",
      },
    ],
  },
  {
    id: "ce-restrict",
    part: "read",
    title: "CE · 同义改写与限定词排雷 (ne…que / sauf / à peine)",
    badge: "限定排雷",
    minutes: 5,
    desc: "聚焦 2020 新考纲纯三选一高频失分点：精准识别 ne…que、sauf、hormis、à peine 等限定与半否定同义转换。",
    items: [
      {
        id: "cer-1",
        doc: 0,
        pts: 2,
        skill: "negation" satisfies QSkill,
        text: "Depuis janvier, la gratuité des musées municipaux ne s'applique plus le dimanche qu'aux résidents de la métropole et aux étudiants de moins de vingt-six ans, tandis que les visiteurs extérieurs acquittent désormais un billet réduit.",
        q: "D'après cet extrait, qui bénéficie encore de l'entrée gratuite le dimanche ?",
        options: [
          "Aucun habitant de la métropole ne peut plus entrer gratuitement le dimanche.",
          "Seuls les habitants de l'agglomération et les jeunes étudiants sont exemptés de paiement.",
          "Tous les touristes de passage profitent désormais d'un accès libre sans billet.",
        ],
        answer: 1,
        evidence: "la gratuité des musées municipaux ne s'applique plus le dimanche qu'aux résidents de la métropole et aux étudiants de moins de vingt-six ans",
        trapTypes: ["误把 ne…plus…que 当全盘否定", "", "混淆免费与半价人群"],
        why: "« ne s'applique plus … qu'aux » 意为“不再对所有人适用，而仅限于……”，即 Seuls … sont exemptés de paiement；切勿把 ne…plus…que 误读为完全取消免费。",
      },
      {
        id: "cer-2",
        doc: 0,
        pts: 2,
        skill: "negation" satisfies QSkill,
        text: "Le télétravail intégral est désormais écarté dans l'entreprise, sauf pour les salariés dont le poste est rattaché à une antenne régionale dépourvue de locaux ouverts au public.",
        q: "Que précise le règlement interne à propos du travail cent pour cent à distance ?",
        options: [
          "Il demeure autorisé uniquement dans quelques cas géographiques bien précis.",
          "Il est généralisé à l'ensemble des antennes disposant d'un accueil physique.",
          "Il est interdit sans la moindre exception sur tout le territoire national.",
        ],
        answer: 0,
        evidence: "Le télétravail intégral est désormais écarté dans l'entreprise, sauf pour les salariés dont le poste est rattaché à une antenne régionale dépourvue de locaux ouverts au public.",
        trapTypes: ["", "忽略 dépourvue de 否定词", "抹杀 sauf 例外条件"],
        why: "« écarté …, sauf pour … » 表示原则上取消，但特定无实体接待场地的地区分部员工除外，对应选项 A 的同义改写。",
      },
      {
        id: "cer-3",
        doc: 0,
        pts: 2,
        skill: "paraphrase" satisfies QSkill,
        text: "Trois ans après son lancement en grande pompe, le fonds d'aide à la rénovation thermique des copropriétés a à peine engagé un cinquième de son enveloppe budgétaire, tant les dossiers exigent des expertises préalables coûteuses.",
        q: "Quel bilan l'auteur dresse-t-il de ce fonds d'aide ?",
        options: [
          "Son budget initial est déjà presque entièrement épuisé par les copropriétés.",
          "Près de quatre-vingts pour cent des crédits prévus restent encore inutilisés.",
          "Les copropriétés obtiennent les subventions sans aucune démarche technique.",
        ],
        answer: 1,
        evidence: "le fonds d'aide à la rénovation thermique des copropriétés a à peine engagé un cinquième de son enveloppe budgétaire",
        trapTypes: ["反读 à peine 程度词", "", "与 tant…coûteuses 相反"],
        why: "« a à peine engagé un cinquième » 指勉强只动用了五分之一（20 %）预算，等价于近 80 % 的资金尚未用出。",
      },
    ],
  },
];

export const MICRO_SKILL_SUMMARY = MICRO_SKILL_TRACKS.map(({ id, part, title, badge, minutes, desc, items }) => ({
  id,
  part,
  title,
  badge,
  minutes,
  desc,
  count: items.length,
}));

export function gradeMicroItem(item: MicroSkillItem, picked?: number, typed?: string) {
  return gradeCompQuestion(item, picked, typed, item.text);
}

export function microItemToMiss(track: MicroSkillTrack, item: MicroSkillItem, at = Date.now()): CompMiss {
  return buildCompMissSnapshot(
    item,
    { title: track.title, docs: [{ text: item.text }] },
    track.part,
    `micro:${track.id}:${item.id}`,
    at,
  );
}
