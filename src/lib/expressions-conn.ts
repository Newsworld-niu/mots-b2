/* 表达 data: connectors by function and argument frames (written for this site, 待核对). Format: see expressions.ts. */
import type { RawExpr } from "./expressions";

export const CONNECTORS: [fn: string, RawExpr[]][] = [
  ["补充", [
    ["de plus", "此外", "Ce logement est trop cher ; [de plus], il est loin de mon travail.", "这套房子太贵了；此外，它离我上班的地方很远。"],
    ["en outre", "此外（较正式）", "Le projet coûte cher. [En outre], il prendra des années.", "这个项目花费很大。此外，它还要好几年。"],
    ["par ailleurs", "另外", "Le télétravail réduit les trajets. [Par ailleurs], il permet de mieux s'organiser.", "远程办公减少了通勤。另外，它让人能更好地安排时间。"],
    ["d'ailleurs", "况且、再说", "Je n'ai pas envie de sortir ; [d'ailleurs], il pleut.", "我不想出门；况且，外面在下雨。"],
    ["non seulement… mais aussi", "不仅……而且", "Ce métier est [non seulement] fatigant, mais aussi mal payé.", "这个职业不仅累，而且薪水低。", { note: "空里只填前半：non seulement" }],
  ]],
  ["对立 · 副词", [
    ["cependant", "然而", "Les écrans sont utiles ; [cependant], il faut en limiter l'usage.", "屏幕很有用；然而，必须限制使用。"],
    ["pourtant", "可是（出乎意料）", "Il a beaucoup travaillé ; [pourtant], il a échoué.", "他很努力；可是他失败了。"],
    ["toutefois", "不过", "Ce plan est intéressant. [Toutefois], il paraît difficile à financer.", "这个计划很有意思。不过，资金似乎难以解决。"],
    ["néanmoins", "尽管如此", "La réforme est impopulaire ; [néanmoins], elle semble nécessaire.", "这项改革不受欢迎；尽管如此，它似乎是必要的。"],
    ["en revanche", "相反、另一方面", "La ville est bruyante ; [en revanche], on y trouve tout.", "城市很吵；另一方面，那里什么都有。"],
  ]],
  ["对立 · 接从句（直陈式）", [
    ["alors que", "而、然而", "Les loyers augmentent [alors que] les salaires stagnent.", "房租在涨，而工资停滞不前。"],
    ["tandis que", "而（对比）", "Mon frère adore la ville, [tandis que] je préfère la campagne.", "我哥哥很喜欢城市，而我更喜欢乡村。"],
  ]],
  ["对立 · 接名词", [
    ["contrairement à", "与……相反", "[Contrairement à] ce que l'on pense, ce secteur recrute.", "与人们想的相反，这个行业在招人。"],
    ["au lieu de", "而不是", "[Au lieu de] jeter ce téléphone, faites-le réparer.", "别扔掉这部手机，拿去修吧。", { note: "+ 名词 / 不定式" }],
  ]],
  ["让步 · 接从句（虚拟式）", [
    ["bien que", "尽管", "[Bien que] ce travail soit fatigant, il me plaît.", "尽管这份工作很累，我还是喜欢。", { note: "+ 虚拟式" }],
    ["quoique", "虽然（较正式）", "[Quoique] la solution soit coûteuse, elle reste la meilleure.", "虽然这个办法代价高，它仍是最好的。", { note: "+ 虚拟式" }],
  ]],
  ["让步 · 接从句（直陈式）", [
    ["même si", "即使", "[Même si] les transports sont gratuits, beaucoup prennent encore la voiture.", "即使公共交通免费，很多人还是开车。", { note: "+ 直陈式" }],
  ]],
  ["让步 · 接名词", [
    ["malgré", "尽管", "[Malgré] la pluie, le festival a attiré beaucoup de monde.", "尽管下雨，音乐节还是吸引了很多人。"],
    ["en dépit de", "尽管（正式）", "[En dépit de] nombreuses critiques, le projet a été adopté.", "尽管批评很多，这个项目还是通过了。"],
  ]],
  ["让步 · 句首", [
    ["certes… mais", "诚然……但是", "[Certes], le télétravail a des avantages, mais il isole les salariés.", "诚然，远程办公有好处，但它让员工孤立。", { note: "空里只填前半：certes" }],
    ["il n'en reste pas moins que", "尽管如此……仍然", "Des progrès ont été faits. [Il n'en reste pas moins que] la pollution est un vrai problème.", "已经取得了进步。尽管如此，污染仍是个真正的问题。", { note: "+ 直陈式" }],
  ]],
  ["原因 · 接从句", [
    ["puisque", "既然", "[Puisque] tu es là, aide-moi à porter ces cartons.", "既然你在，帮我搬这些箱子吧。", { note: "原因是对方已知的" }],
    ["étant donné que", "鉴于", "[Étant donné que] le budget est limité, il faut faire des choix.", "鉴于预算有限，必须做出取舍。"],
    ["comme", "由于（句首）", "[Comme] il pleuvait, nous sommes restés à la maison.", "由于下雨，我们待在家里。", { note: "放在句首" }],
  ]],
  ["原因 · 接名词", [
    ["grâce à", "多亏（好的原因）", "[Grâce à] internet, on peut suivre des cours à distance.", "多亏了互联网，人们可以远程上课。"],
    ["à cause de", "因为（坏的原因）", "Le match a été annulé [à cause de] la neige.", "比赛因为下雪取消了。"],
    ["en raison de", "由于（正式）", "Le vol est retardé [en raison de] la grève.", "由于罢工，航班延误。"],
    ["faute de", "由于缺乏", "[Faute de] moyens, l'association a dû fermer.", "由于缺乏资金，协会不得不关闭。", { note: "+ 无冠词名词" }],
  ]],
  ["原因 · 解释前句", [
    ["en effet", "确实、因为", "Il faut agir vite. [En effet], la situation s'aggrave.", "必须尽快行动。因为情况在恶化。"],
  ]],
  ["结果", [
    ["par conséquent", "因此", "Le nombre d'élèves a augmenté ; [par conséquent], il faut ouvrir une classe.", "学生人数增加了；因此需要开一个新班。"],
    ["c'est pourquoi", "这就是为什么", "Les loyers sont trop élevés ; [c'est pourquoi] beaucoup de jeunes vivent en colocation.", "房租太高；这就是为什么很多年轻人合租。"],
    ["si bien que", "以至于", "Il a beaucoup neigé, [si bien que] les écoles ont fermé.", "雪下得很大，以至于学校都关了。", { note: "+ 直陈式" }],
    ["ainsi", "因此、这样", "Les bus sont gratuits ; [ainsi], moins de gens prennent la voiture.", "公交免费；这样，开车的人就少了。"],
    ["donc", "所以", "Le musée est fermé le lundi ; nous irons [donc] mardi.", "博物馆周一闭馆；所以我们周二去。"],
  ]],
  ["举例", [
    ["par exemple", "例如", "Certains sports, [par exemple] la natation, sont doux pour le dos.", "有些运动，例如游泳，对背部很温和。"],
    ["notamment", "尤其、特别是", "Les jeunes, [notamment] les étudiants, souffrent de la hausse des loyers.", "年轻人，尤其是大学生，受到房租上涨之苦。"],
    ["prenons l'exemple de", "以……为例", "[Prenons l'exemple de] la Suède, qui recycle presque tous ses déchets.", "以瑞典为例，它几乎回收所有垃圾。"],
    ["tel que", "诸如、比如", "Les énergies renouvelables, [telles que] le solaire, se développent.", "可再生能源，比如太阳能，正在发展。", { note: "和前面的名词性数配合：tel / telle / tels / telles que" }],
  ]],
  ["列举", [
    ["tout d'abord", "首先", "[Tout d'abord], il faut définir le problème.", "首先，要界定问题。"],
    ["ensuite", "其次、然后", "[Ensuite], nous verrons les solutions possibles.", "其次，我们来看可能的解决办法。"],
    ["enfin", "最后", "[Enfin], j'aborderai les limites de cette mesure.", "最后，我会谈谈这项措施的局限。"],
    ["d'une part… d'autre part", "一方面……另一方面", "Cette mesure permet, [d'une part], de réduire les coûts et, d'autre part, de protéger l'environnement.", "这项措施一方面可以降低成本，另一方面可以保护环境。", { note: "空里只填前半：d'une part" }],
  ]],
  ["总结", [
    ["en conclusion", "总之、结论是", "[En conclusion], le télétravail présente plus d'avantages que d'inconvénients.", "总之，远程办公利大于弊。"],
    ["en somme", "总而言之", "[En somme], chacun peut agir à son niveau.", "总而言之，每个人都可以在自己的层面上行动。"],
    ["pour conclure", "最后总结一下", "[Pour conclure], je dirais que cette réforme est nécessaire.", "最后总结一下，我认为这项改革是必要的。"],
    ["en définitive", "归根结底", "[En définitive], c'est aux citoyens de choisir.", "归根结底，要由公民来选择。"],
  ]],
];

export const FRAMES: [fn: string, RawExpr[]][] = [
  ["表达观点", [
    ["à mon avis", "在我看来", "[À mon avis], les musées devraient être gratuits.", "在我看来，博物馆应该免费。"],
    ["selon moi", "依我看", "[Selon moi], l'école doit apprendre aux élèves à réfléchir.", "依我看，学校应该教学生思考。"],
    ["j'estime que", "我认为（较正式）", "[J'estime que] cette réforme va dans le bon sens.", "我认为这项改革方向是对的。", { note: "+ 直陈式" }],
    ["il me semble que", "我觉得", "[Il me semble que] cette décision est injuste.", "我觉得这个决定不公平。", { note: "+ 直陈式" }],
    ["je suis convaincu que", "我坚信", "[Je suis convaincu que] le vélo est l'avenir de la ville.", "我坚信自行车是城市的未来。", { note: "+ 直陈式；女性写 convaincue", alt: ["je suis convaincue que"] }],
  ]],
  ["确定 · + 直陈式", [
    ["il est indéniable que", "不可否认", "[Il est indéniable que] les réseaux sociaux ont changé nos habitudes.", "不可否认，社交网络改变了我们的习惯。", { note: "+ 直陈式" }],
    ["il est évident que", "显然", "[Il est évident que] la situation ne peut pas durer.", "显然，这种情况不能持续下去。", { note: "+ 直陈式" }],
    ["force est de constater que", "不得不承认", "[Force est de constater que] les inégalités se creusent.", "不得不承认，不平等在加剧。", { note: "+ 直陈式" }],
  ]],
  ["怀疑、评价 · + 虚拟式", [
    ["je ne pense pas que", "我不认为", "[Je ne pense pas que] cette loi soit efficace.", "我不认为这项法律有效。", { note: "否定的看法 + 虚拟式" }],
    ["il est peu probable que", "不太可能", "[Il est peu probable que] les prix baissent cette année.", "今年价格不太可能下降。", { note: "+ 虚拟式" }],
    ["il est essentiel que", "至关重要的是", "[Il est essentiel que] chacun puisse se soigner.", "至关重要的是每个人都能看病。", { note: "+ 虚拟式" }],
    ["il est grand temps que", "早就该", "[Il est grand temps que] nous prenions des mesures.", "我们早就该采取措施了。", { note: "+ 虚拟式" }],
    ["il est regrettable que", "遗憾的是", "[Il est regrettable que] les transports soient si chers.", "遗憾的是交通这么贵。", { note: "+ 虚拟式" }],
  ]],
  ["引出话题", [
    ["en ce qui concerne", "至于、关于", "[En ce qui concerne] les transports, la ville a fait des progrès.", "关于交通，这座城市有了进步。"],
    ["quant à", "至于", "Mes parents prennent l'avion ; [quant à] moi, je préfère le train.", "我父母坐飞机；至于我，我更喜欢火车。"],
    ["il s'agit de", "问题在于、涉及", "Dans ce débat, [il s'agit de] savoir qui doit payer.", "在这场辩论中，问题在于谁该付钱。"],
    ["il convient de", "应当", "[Il convient de] distinguer deux situations.", "应当区分两种情况。", { note: "+ 不定式" }],
  ]],
  ["反驳、让步论证", [
    ["on pourrait objecter que", "有人可能会反驳说", "[On pourrait objecter que] cette mesure coûte trop cher.", "有人可能会反驳说这项措施太贵。"],
    ["loin de moi l'idée de", "我绝不是想", "[Loin de moi l'idée de] critiquer les enseignants, mais leur méthode doit évoluer.", "我绝不是想批评老师，但他们的方法需要改进。", { note: "+ 不定式" }],
    ["ce n'est pas parce que… que", "不能因为……就", "[Ce n'est pas parce qu'] un produit est cher qu'il est meilleur.", "不能因为一个产品贵，就说它更好。", { note: "空里只填前半" }],
  ]],
];
