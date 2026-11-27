/*
 * 表达 data: connectors by function and argument frames (written for this site). Format: see expressions.ts.
 * `syn` lists only what fits the very gap of the example (construction, elision, punctuation and meaning); cards of
 * the same function that do not fit there are graded wrong, with an explanation.
 */
import type { RawExpr } from "./expressions";

export const CONNECTORS: [fn: string, RawExpr[]][] = [
  ["补充", [
    ["de plus", "此外", "Ce logement est trop cher ; [de plus], il est loin de mon travail.", "这套房子太贵了；此外，它离我上班的地方很远。", { syn: ["en outre", "par ailleurs", "en plus"] }],
    ["en outre", "此外（较正式）", "Le projet coûte cher. [En outre], il prendra des années.", "这个项目花费很大。此外，它还要好几年才能完成。", { syn: ["de plus", "par ailleurs"] }],
    ["par ailleurs", "另外", "Le télétravail réduit les trajets. [Par ailleurs], il permet de mieux s'organiser.", "远程办公减少了通勤。另外，它让人能更好地安排时间。", { syn: ["de plus", "en outre"] }],
    ["d'ailleurs", "况且、再说", "Je n'ai pas envie de sortir ; [d'ailleurs], il pleut.", "我不想出门；况且，外面在下雨。", { syn: ["de plus", "en plus", "de toute façon"] }],
    ["non seulement… mais aussi", "不仅……而且", "Ce métier est [non seulement] fatigant, mais aussi mal payé.", "这个职业不仅累，而且薪水低。", { note: "空里只填前半：non seulement" }],
  ]],
  ["对立 · 副词", [
    ["cependant", "然而", "Les écrans sont utiles ; [cependant], il faut en limiter l'usage.", "屏幕很有用；然而，必须限制使用。", { syn: ["toutefois", "néanmoins", "pourtant"] }],
    ["pourtant", "可是（出乎意料）", "Il a beaucoup travaillé ; [pourtant], il a échoué.", "他很努力；可是他失败了。", { syn: ["cependant", "toutefois", "néanmoins"] }],
    ["toutefois", "不过", "Ce plan est intéressant. [Toutefois], il paraît difficile à financer.", "这个计划很有意思。不过，资金似乎难以解决。", { syn: ["cependant", "néanmoins", "pourtant"] }],
    ["néanmoins", "尽管如此", "La réforme est impopulaire ; [néanmoins], elle semble nécessaire.", "这项改革不受欢迎；尽管如此，它似乎是必要的。", { syn: ["cependant", "toutefois", "pourtant"] }],
    ["en revanche", "相反、另一方面", "La ville est bruyante ; [en revanche], on y trouve tout.", "城市很吵；另一方面，那里什么都有。", { note: "对比同一事物的两个方面（不是让步）；口语也说 par contre", syn: ["par contre"] }],
  ]],
  ["对立 · 接从句（直陈式）", [
    ["alors que", "而、然而", "Les loyers augmentent [alors que] les salaires stagnent.", "房租在涨，而工资停滞不前。", { note: "+ 直陈式", syn: ["tandis que"] }],
    ["tandis que", "而（对比）", "Mon frère adore la ville, [tandis que] je préfère la campagne.", "我哥哥很喜欢城市，而我更喜欢乡村。", { note: "+ 直陈式", syn: ["alors que"] }],
  ]],
  ["对立 · 接名词", [
    ["contrairement à", "与……相反", "[Contrairement à] ce que l'on pense, ce secteur recrute.", "与人们想的相反，这个行业在招人。", { note: "+ 名词 / 代词（不接不定式）" }],
    ["au lieu de", "而不是", "[Au lieu de] jeter ce téléphone, faites-le réparer.", "与其扔掉这部手机，不如拿去修。", { note: "+ 名词 / 不定式", syn: ["plutôt que de"] }],
  ]],
  ["让步 · 接从句（虚拟式）", [
    ["bien que", "尽管", "[Bien que] ce travail soit fatigant, il me plaît.", "尽管这份工作很累，我还是喜欢。", { note: "+ 虚拟式", syn: ["quoique"] }],
    ["quoique", "虽然（较正式）", "[Quoique] la solution soit coûteuse, elle reste la meilleure.", "虽然这个办法代价高，它仍是最好的。", { note: "+ 虚拟式", syn: ["bien que"] }],
  ]],
  ["让步 · 接从句（直陈式）", [
    ["même si", "即使", "[Même si] les transports sont gratuits, beaucoup prennent encore la voiture.", "即使公共交通免费，很多人还是开车。", { note: "+ 直陈式" }],
  ]],
  ["让步 · 接名词", [
    ["malgré", "尽管", "[Malgré] la pluie, le festival a attiré beaucoup de monde.", "尽管下雨，音乐节还是吸引了很多人。", { syn: ["en dépit de"] }],
    ["en dépit de", "尽管（正式）", "[En dépit de] nombreuses critiques, le projet a été adopté.", "尽管批评很多，这个项目还是通过了。", { note: "en dépit de + de nombreuses → de 合并；换成 malgré 须写 malgré de nombreuses critiques" }],
  ]],
  ["让步 · 句首", [
    ["certes… mais", "诚然……但是", "[Certes], le télétravail a des avantages, mais il isole les salariés.", "诚然，远程办公有好处，但它让员工孤立。", { note: "空里只填前半：certes" }],
    ["il n'en reste pas moins que", "尽管如此……仍然", "Des progrès ont été faits. [Il n'en reste pas moins que] la pollution est un vrai problème.", "已经取得了进步。尽管如此，污染仍是个真正的问题。", { note: "+ 直陈式" }],
  ]],
  ["原因 · 接从句", [
    ["puisque", "既然", "[Puisque] tu es là, aide-moi à porter ces cartons.", "既然你在，帮我搬这些箱子吧。", { note: "原因是对方已知的", syn: ["comme"] }],
    ["étant donné que", "鉴于", "[Étant donné que] le budget est limité, il faut faire des choix.", "鉴于预算有限，必须做出取舍。", { syn: ["puisque", "comme", "vu que", "du fait que"] }],
    ["comme", "由于（句首）", "[Comme] il pleuvait, nous sommes restés à la maison.", "由于下雨，我们待在家里。", { note: "放在句首", syn: ["puisqu'", "étant donné qu'"] }],
  ]],
  ["原因 · 接名词", [
    ["grâce à", "多亏（好的原因）", "[Grâce à] internet, on peut suivre des cours à distance.", "多亏了互联网，人们可以远程上课。", { note: "只用于积极的原因" }],
    ["à cause de", "因为（坏的原因）", "Le match a été annulé [à cause de] la neige.", "比赛因为下雪取消了。", { note: "多指消极的原因", syn: ["en raison de"] }],
    ["en raison de", "由于（正式）", "Le vol est retardé [en raison de] la grève.", "由于罢工，航班延误了。", { note: "中性、正式的原因", syn: ["à cause de"] }],
    ["faute de", "由于缺乏", "[Faute de] moyens, l'association a dû fermer.", "由于缺乏资金，协会不得不关闭。", { note: "+ 无冠词名词", syn: ["par manque de"] }],
  ]],
  ["原因 · 解释前句", [
    ["en effet", "确实、因为", "Il faut agir vite. [En effet], la situation s'aggrave.", "必须尽快行动。因为情况在恶化。"],
  ]],
  ["结果", [
    ["par conséquent", "因此", "Le nombre d'élèves a augmenté ; [par conséquent], il faut ouvrir une classe.", "学生人数增加了；因此需要开一个新班。", { syn: ["en conséquence", "ainsi", "de ce fait"] }],
    ["c'est pourquoi", "这就是为什么", "Les loyers sont trop élevés ; [c'est pourquoi] beaucoup de jeunes vivent en colocation.", "房租太高；这就是为什么很多年轻人合租。", { note: "后面不加逗号", syn: ["c'est la raison pour laquelle", "voilà pourquoi"] }],
    ["si bien que", "以至于", "Il a beaucoup neigé, [si bien que] les écoles ont fermé.", "雪下得很大，以至于学校都关了。", { note: "+ 直陈式", syn: ["de sorte que", "à tel point que"] }],
    ["ainsi", "因此、这样", "Les bus sont gratuits ; [ainsi], moins de gens prennent la voiture.", "公交免费；这样，开车的人就少了。", { syn: ["par conséquent", "de ce fait"] }],
    ["donc", "所以", "Le musée est fermé le lundi ; nous irons [donc] mardi.", "博物馆周一闭馆；所以我们周二去。", { note: "可放在动词后面：nous irons donc mardi" }],
  ]],
  ["举例", [
    ["par exemple", "例如", "Certains sports, [par exemple] la natation, sont doux pour le dos.", "有些运动，例如游泳，对背部很温和。", { syn: ["comme", "tels que", "notamment"] }],
    ["notamment", "尤其、特别是", "Les jeunes, [notamment] les étudiants, souffrent de la hausse des loyers.", "年轻人，尤其是大学生，深受房租上涨之苦。", { syn: ["en particulier", "surtout", "particulièrement"] }],
    ["prenons l'exemple de", "以……为例", "[Prenons l'exemple de] la Suède, qui recycle presque tous ses déchets.", "以瑞典为例，它几乎回收所有垃圾。"],
    ["tel que", "诸如、比如", "Les énergies renouvelables, [telles que] le solaire, se développent.", "可再生能源，比如太阳能，正在发展。", { note: "和前面的名词性数配合：tel / telle / tels / telles que", syn: ["comme", "notamment", "par exemple"] }],
  ]],
  ["列举", [
    ["tout d'abord", "首先", "[Tout d'abord], il faut définir le problème.", "首先，要界定问题。", { syn: ["d'abord", "premièrement", "en premier lieu"] }],
    ["ensuite", "其次、然后", "[Ensuite], nous verrons les solutions possibles.", "其次，我们来看可能的解决办法。", { syn: ["puis", "deuxièmement", "en second lieu"] }],
    ["enfin", "最后", "[Enfin], j'aborderai les limites de cette mesure.", "最后，我会谈谈这项措施的局限。", { syn: ["pour finir", "en dernier lieu"] }],
    ["d'une part… d'autre part", "一方面……另一方面", "Cette mesure permet, [d'une part], de réduire les coûts et, d'autre part, de protéger l'environnement.", "这项措施一方面可以降低成本，另一方面可以保护环境。", { note: "空里只填前半：d'une part" }],
  ]],
  ["总结", [
    ["en conclusion", "总之、结论是", "[En conclusion], le télétravail présente plus d'avantages que d'inconvénients.", "总之，远程办公利大于弊。", { syn: ["pour conclure", "en somme", "en définitive"] }],
    ["en somme", "总而言之", "[En somme], chacun peut agir à son niveau.", "总而言之，每个人都可以在自己的层面上行动。", { syn: ["en conclusion", "pour conclure", "en définitive", "en résumé"] }],
    ["pour conclure", "最后总结一下", "[Pour conclure], je dirais que cette réforme est nécessaire.", "最后总结一下，我认为这项改革是必要的。", { syn: ["en conclusion", "en somme", "en définitive"] }],
    ["en définitive", "归根结底", "[En définitive], c'est aux citoyens de choisir.", "归根结底，要由公民来选择。", { syn: ["en somme", "en fin de compte", "en conclusion", "pour conclure"] }],
  ]],
];

export const FRAMES: [fn: string, RawExpr[]][] = [
  ["表达观点", [
    ["à mon avis", "在我看来", "[À mon avis], les musées devraient être gratuits.", "在我看来，博物馆应该免费。", { syn: ["selon moi", "d'après moi", "pour moi"] }],
    ["selon moi", "依我看", "[Selon moi], l'école doit apprendre aux élèves à réfléchir.", "依我看，学校应该教学生思考。", { syn: ["à mon avis", "d'après moi", "pour moi"] }],
    ["j'estime que", "我认为（较正式）", "[J'estime que] cette réforme va dans le bon sens.", "我认为这项改革方向是对的。", { note: "+ 直陈式", syn: ["je pense que", "je considère que", "il me semble que", "je suis convaincu que", "je suis convaincue que"] }],
    ["il me semble que", "我觉得", "[Il me semble que] cette décision est injuste.", "我觉得这个决定不公平。", { note: "+ 直陈式（肯定句）", syn: ["j'estime que", "je pense que", "je trouve que"] }],
    ["je suis convaincu que", "我坚信", "[Je suis convaincu que] le vélo est l'avenir de la ville.", "我坚信自行车是城市的未来。", { note: "+ 直陈式；女性写 convaincue", alt: ["je suis convaincue que"], syn: ["je suis persuadé que", "je suis persuadée que"] }],
  ]],
  ["确定 · + 直陈式", [
    ["il est indéniable que", "不可否认", "[Il est indéniable que] les réseaux sociaux ont changé nos habitudes.", "不可否认，社交网络改变了我们的习惯。", { note: "+ 直陈式", syn: ["il est incontestable que", "il est évident que", "force est de constater que"] }],
    ["il est évident que", "显然", "[Il est évident que] la situation ne peut pas durer.", "显然，这种情况不能持续下去。", { note: "+ 直陈式", syn: ["il est clair que", "il est indéniable que"] }],
    ["force est de constater que", "不得不承认", "[Force est de constater que] les inégalités se creusent.", "不得不承认，不平等在加剧。", { note: "+ 直陈式", syn: ["on ne peut que constater que", "il faut bien constater que", "il est indéniable que"] }],
  ]],
  ["怀疑、评价 · + 虚拟式", [
    ["je ne pense pas que", "我不认为", "[Je ne pense pas que] cette loi soit efficace.", "我不认为这项法律有效。", { note: "否定的看法 + 虚拟式", syn: ["je ne crois pas que", "je doute que"] }],
    ["il est peu probable que", "不太可能", "[Il est peu probable que] les prix baissent cette année.", "今年价格不太可能下降。", { note: "+ 虚拟式", syn: ["il est improbable que", "il y a peu de chances que"] }],
    ["il est essentiel que", "至关重要的是", "[Il est essentiel que] chacun puisse se soigner.", "至关重要的是每个人都能看病。", { note: "+ 虚拟式", syn: ["il est indispensable que", "il est primordial que", "il est nécessaire que", "il faut que"] }],
    ["il est grand temps que", "早就该", "[Il est grand temps que] nous prenions des mesures.", "我们早就该采取措施了。", { note: "+ 虚拟式", syn: ["il est temps que"] }],
    ["il est regrettable que", "遗憾的是", "[Il est regrettable que] les transports soient si chers.", "遗憾的是交通这么贵。", { note: "+ 虚拟式", syn: ["il est dommage que", "il est déplorable que"] }],
  ]],
  ["引出话题", [
    ["en ce qui concerne", "至于、关于", "[En ce qui concerne] les transports, la ville a fait des progrès.", "关于交通，这座城市有了进步。", { syn: ["concernant", "pour ce qui concerne"] }],
    ["quant à", "至于", "Mes parents prennent l'avion ; [quant à] moi, je préfère le train.", "我父母坐飞机；至于我，我更喜欢火车。", { note: "à + le / les 要缩合：quant au, quant aux" }],
    ["il s'agit de", "问题在于、涉及", "Dans ce débat, [il s'agit de] savoir qui doit payer.", "在这场辩论中，问题在于谁该付钱。", { syn: ["il est question de"] }],
    ["il convient de", "应当", "[Il convient de] distinguer deux situations.", "应当区分两种情况。", { note: "+ 不定式", syn: ["il faut", "il importe de"] }],
  ]],
  ["反驳、让步论证", [
    ["on pourrait objecter que", "有人可能会反驳说", "[On pourrait objecter que] cette mesure coûte trop cher.", "有人可能会反驳说这项措施太贵。", { syn: ["on pourrait rétorquer que", "on pourrait répondre que"] }],
    ["loin de moi l'idée de", "我绝不是想", "[Loin de moi l'idée de] critiquer les enseignants, mais leur méthode doit évoluer.", "我绝不是想批评老师，但他们的方法需要改进。", { note: "+ 不定式" }],
    ["ce n'est pas parce que… que", "不能因为……就", "[Ce n'est pas parce qu'] un produit est cher qu'il est meilleur.", "不能因为一个产品贵，就说它更好。", { note: "空里只填前半" }],
  ]],
  ["提炼 problématique（口语引入）", [
    ["ce document met en lumière une tension entre", "这份材料揭示了……之间的矛盾", "[Ce document met en lumière une tension entre] la liberté individuelle et la santé publique.", "这份材料揭示了个人自由与公共卫生之间的矛盾。"],
    ["la question qui se pose est de savoir", "核心问题在于", "[La question qui se pose est de savoir] si cette réforme est applicable partout.", "核心问题在于这项改革是否各地都适用。"],
    ["dans quelle mesure", "在多大程度上", "[Dans quelle mesure] peut-on limiter l'usage des écrans sans nuire à la liberté ?", "我们在多大程度上既能限制屏幕使用又不损害自由？", { syn: ["jusqu'à quel point"] }],
    ["comment concilier", "如何兼顾、调和", "[Comment concilier] la transition écologique et le maintien de l'emploi local ?", "如何兼顾生态转型与保障本地就业？"],
    ["jusqu'à quel point", "在何种限度内、到什么程度", "[Jusqu'à quel point] l'État doit-il intervenir dans nos choix alimentaires ?", "国家应当在何种限度内介入我们的饮食选择？", { syn: ["dans quelle mesure"] }],
  ]],
  ["辩论 · 反驳与质询", [
    ["je comprends votre point de vue, mais", "我理解您的观点，但", "[Je comprends votre point de vue, mais] cette solution risque d'aggraver les inégalités.", "我理解您的观点，但这个办法可能会加剧不平等。"],
    ["ce raisonnement oublie toutefois que", "然而这种推理忽略了", "[Ce raisonnement oublie toutefois que] les petites communes n'ont pas les mêmes moyens.", "然而这种推理忽略了小城镇并没有同样的财力。"],
    ["rien ne prouve que", "没有任何证据表明", "[Rien ne prouve que] l'interdiction suffise à changer les habitudes.", "没有任何证据表明单靠禁止就足以改变习惯。", { note: "+ 虚拟式" }],
    ["à l'inverse, on observe que", "相反，我们观察到", "[À l'inverse, on observe que] l'incitation financière donne de meilleurs résultats.", "相反，我们观察到经济激励的效果更好。"],
    ["c'est précisément ce qu'il faut éviter", "这正是需要避免的", "Une hausse brutale des prix pénaliserait les plus modestes : [c'est précisément ce qu'il faut éviter].", "大幅涨价会打击低收入群体：这正是需要避免的。"],
    ["n'est-ce pas exagéré de penser que", "认为……难道不有些夸张吗", "[N'est-ce pas exagéré de penser que] l'intelligence artificielle remplacera tous les professeurs ?", "认为人工智能将取代所有老师难道不有些夸张吗？"],
    ["je ne partage pas tout à fait cette analyse", "我并不完全认同这一分析", "[Je ne partage pas tout à fait cette analyse], car les chiffres montrent une autre réalité.", "我并不完全认同这一分析，因为数据显示了另一种现实。"],
  ]],
  ["辩论 · 让步与限定", [
    ["vous avez raison sur ce point, néanmoins", "这一点您说得对，不过", "[Vous avez raison sur ce point, néanmoins] le coût à court terme reste trop élevé.", "这一点您说得对，不过短期成本依然过高。"],
    ["il est vrai que… mais il faut nuancer", "诚然……但需要客观区分", "[Il est vrai que] le train pollue moins, mais il faut nuancer selon les régions.", "诚然火车污染更少，但需要根据地区情况具体分析。", { note: "空里只填前半：il est vrai que" }],
    ["à condition que", "只要、前提是", "Cette mesure peut fonctionner, [à condition que] l'État accompagne les familles.", "这项措施可以奏效，前提是国家为家庭提供配套支持。", { note: "+ 虚拟式", syn: ["pourvu que"] }],
    ["tout dépend de la manière dont", "这完全取决于……的方式", "[Tout dépend de la manière dont] cette règle est appliquée sur le terrain.", "这完全取决于这项规定在基层的执行方式。"],
    ["je vous l'accorde, cependant", "这一点我承认，然而", "[Je vous l'accorde, cependant] on ne peut pas attendre dix ans avant d'agir.", "这一点我承认，然而我们不能等十年才行动。"],
    ["encore faut-il que", "前提还必须是", "Le télétravail est utile, [encore faut-il que] les salariés disposent d'un espace calme.", "远程办公很有用，但前提还必须是员工有安静的工作空间。", { note: "+ 虚拟式" }],
  ]],
  ["辩论 · 澄清与重述", [
    ["ce que je voulais dire, c'est que", "我想表达的意思是", "Non, [ce que je voulais dire, c'est que] l'outil doit compléter le cours, pas le remplacer.", "不，我想表达的意思是这个工具应该补充课堂，而不是取代它。"],
    ["permettez-moi de préciser ma pensée", "请允许我把想法说得更清楚些", "[Permettez-moi de préciser ma pensée] : je ne suis pas contre la réforme, mais contre son calendrier.", "请允许我进一步阐明我的想法：我不反对改革，而是反对它的时间表。"],
    ["autrement dit, il ne s'agit pas de", "换句话说，问题不在于", "[Autrement dit, il ne s'agit pas de] tout interdire, mais d'encadrer les usages.", "换句话说，重点不在于一刀切禁止，而在于规范使用。"],
    ["si je vous ai bien compris", "如果我理解得没错的话", "[Si je vous ai bien compris], vous craignez surtout une baisse de la qualité ?", "如果我理解得没错的话，您主要担心质量下降？"],
    ["pour lever toute ambiguïté", "为了消除任何歧义", "[Pour lever toute ambiguïté], je suis favorable à une mise en place progressive.", "为了消除歧义，我支持逐步推进实施。"],
  ]],
  ["口语 · 思考填充语", [
    ["à vrai dire", "老实说、说实话", "[À vrai dire], je n'avais pas envisagé cet aspect économique, mais c'est un point crucial.", "老实说，我刚才没考虑到这个经济层面，但这确实很关键。"],
    ["comment dirais-je", "该怎么说呢（缓冲换词）", "Cette décision crée une situation, [comment dirais-je], paradoxale pour les usagers.", "这个决定对用户而言造成了一种——该怎么说呢——自相矛盾的局面。"],
    ["c'est une excellente question", "这是个很好的问题（争取思考时间）", "[C'est une excellente question], qui nous oblige à distinguer deux situations très différentes.", "这是个很好的问题，它要求我们区分两种截然不同的情况。"],
    ["si je réfléchis bien", "如果我仔细想想的话", "[Si je réfléchis bien], l'exemple de mon propre pays montre que la transition prend du temps.", "仔细想想的话，我本国的例子说明这种转型需要时间。"],
    ["disons que", "这么说吧、姑且认为", "[Disons que] la mesure est louable sur le principe, même si son financement pose question.", "这么说吧，这项措施原则上值得肯定，尽管资金来源还有待商榷。"],
  ]],
];
