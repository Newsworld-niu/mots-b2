import type {
  CuratedYoutubeVideo,
  OpenSampleVideo,
  SubtitleCue,
} from "./lounge-types";

export const OPEN_SAMPLE_VIDEOS: readonly OpenSampleVideo[] = [
  {
    id: "caminandes",
    kind: "open",
    title: "Caminandes: Gran Dillama",
    titleZh: "羊驼大冒险：通电围栏",
    creator: "Blender Studio (Pablo Vazquez, Beorn Leonard & Hjalti Hjálmarsson)",
    license: "CC BY 3.0",
    durationSec: 146,
    durationLabel: "2m 26s",
    level: "A2",
    energy: 1,
    videoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/transcoded/8/8b/Caminandes%2C_Gran_Dillama_-_Blender_Foundation.webm/Caminandes%2C_Gran_Dillama_-_Blender_Foundation.webm.480p.vp9.webm",
    posterUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Caminandes%2C_Gran_Dillama_-_Blender_Foundation.webm/960px--Caminandes%2C_Gran_Dillama_-_Blender_Foundation.webm.jpg",
    vttPath: "/materials/videos/caminandes-fr.vtt",
    ttsNarration: true,
    summaryZh:
      "在荒凉干旱的巴塔哥尼亚高原上，贪吃的羊驼科罗（Koro）隔着一道通电铁丝网发现了鲜嫩多汁的绿草地。为了吃到美食，它与一只悠闲的小犰狳展开了一连串令人捧腹的斗智斗勇。本片无原声对白，配有本站原创法汉双语解说字幕，可开启法语语音旁白（TTS）轻松跟听。",
    cultureNoteZh:
      "《Caminandes》是 Blender 基金会最受欢迎的开源动画短片系列之一，片名融合了西班牙语“caminar”（行走）与“Andes”（安第斯山脉）。法语旁白大量采用法语讲故事最地道的“叙事现在时”（présent de narration），非常适合 A2–B1 学习者培养画面感与动作动词直觉。",
    keyExpressions: [
      {
        fr: "tendre le cou de toutes ses forces",
        zh: "拼命伸长脖子",
        note: "de toutes ses forces 表示“使出浑身解数、竭尽全力”，高频口语搭配。",
      },
      {
        fr: "sans effort",
        zh: "毫不费力地、轻而易举地",
        note: "可与 sans peine 互换，常用来修饰动作的轻松自如。",
      },
      {
        fr: "pas question d'abandonner",
        zh: "绝不放弃、门儿都没有",
        note: "pas question de + inf. 是地道口语中表达坚决拒绝或决心的短句式。",
      },
      {
        fr: "atterrir du bon côté",
        zh: "落到对的一边 / 顺利过关",
        note: "du bon côté 字面指“在正确的一侧”，也可引申为事情朝有利方向发展。",
      },
    ],
  },
  {
    id: "melies-lune",
    kind: "open",
    title: "Le Voyage dans la Lune (1902)",
    titleZh: "月球旅行记（1902 默片经典）",
    creator: "Georges Méliès (Star Film, Montreuil)",
    license: "Domaine public",
    durationSec: 766,
    durationLabel: "12m 46s",
    level: "B1",
    energy: 1,
    videoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/transcoded/6/6d/Le_Voyage_dans_la_Lune_%281902%29.webm/Le_Voyage_dans_la_Lune_%281902%29.webm.480p.vp9.webm",
    posterUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Le_Voyage_dans_la_Lune_%281902%29.webm/960px--Le_Voyage_dans_la_Lune_%281902%29.webm.jpg",
    vttPath: "/materials/videos/melies-lune-fr.vtt",
    ttsNarration: true,
    summaryZh:
      "电影魔术师乔治·梅里爱于 1902 年拍摄的世界影史首部科幻杰作：巴本福伊教授率领五位天文学家乘坐巨炮发射的金属太空舱飞抵月球，炮弹正中“月亮之眼”。他们在地下蘑菇洞穴遭遇月球原住民塞勒尼特人，最终拽动绳索坠回地球深海凯旋而归。配有法汉电影史导览双语字幕与可选法语旁白。",
    cultureNoteZh:
      "法国人常把电影称为“第七艺术”（le septième art）。卢米埃尔兄弟记录了真实生活，而魔术师出身的梅里爱则在巴黎近郊蒙特勒伊的玻璃摄影棚里发明了“停机再拍”（arrêt de caméra）、叠印与手绘布景，直接启发了后世奇幻与科幻电影。片中荒诞幽默的学院争吵也暗讽了十九世纪末实证主义科学界的傲慢。",
    keyExpressions: [
      {
        fr: "un chef-d'œuvre du septième art",
        zh: "电影艺术（第七艺术）的杰作",
        note: "法国影评人 Canudo 提出 le septième art 指代电影，复数写作 des chefs-d'œuvre。",
      },
      {
        fr: "tenter l'aventure",
        zh: "踏上冒险、勇敢一试",
        note: "tenter 常搭配 l'aventure / sa chance / l'expérience，语体自然优雅。",
      },
      {
        fr: "se planter droit dans l'œil",
        zh: "不偏不倚正中眼睛",
        note: "se planter 在口语中既有“扎进、插入”之意，也可指“搞砸、出错”。",
      },
      {
        fr: "sain et sauf / saine et sauve",
        zh: "安然无恙、平安归来",
        note: "固定成语，注意阴阳性配合（如 la capsule saine et sauve）。",
      },
    ],
  },
  {
    id: "sintel",
    kind: "open",
    title: "Sintel",
    titleZh: "辛特尔：寻龙之旅",
    creator: "Blender Foundation (Colin Levy & Ton Roosendaal)",
    license: "CC BY 3.0",
    durationSec: 888,
    durationLabel: "14m 48s",
    level: "B2",
    energy: 2,
    videoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/transcoded/f/f1/Sintel_movie_4K.webm/Sintel_movie_4K.webm.480p.vp9.webm",
    posterUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Sintel_movie_4K.webm/960px--Sintel_movie_4K.webm.jpg",
    vttPath: "/materials/videos/sintel-fr.vtt",
    ttsNarration: false,
    summaryZh:
      "孤独的少女战士辛特尔在暴风雪中被山间老萨满救起，回忆起自己曾在古城街头救下一只折翼幼龙“小鳞片”（Scales）。幼龙痊愈起飞之日被成年巨龙掳走，辛特尔由此跨越沙漠与雪峰潜入火山龙穴，却在致命一击后迎来令人心碎的真相。",
    cultureNoteZh:
      "《Sintel》是开源三维动画史上的里程碑作品，叙事结构紧凑且情感张力极强。本片双语字幕融合了人物对白与文学化叙事旁白，涵盖 B2 阶段核心词汇（如 coûte que coûte、semé de périls、au fil des semaines），适合在沉浸观影中体会法语书面叙事与情感表达。",
    keyExpressions: [
      {
        fr: "coûte que coûte",
        zh: "无论如何、不惜一切代价",
        note: "源于虚拟式固定短语，写作与口语论述中表达坚定决心的高分表达。",
      },
      {
        fr: "être semé de périls",
        zh: "危机四伏、充满艰险",
        note: "同义高频表达还有 être semé d'embûches（布满陷阱与阻碍）。",
      },
      {
        fr: "une amitié indéfectible",
        zh: "牢不可破的深厚友谊",
        note: "indéfectible（永不衰减的、忠贞不渝的）常修饰 amitié、soutien、loyauté。",
      },
      {
        fr: "renoncer à sa quête",
        zh: "放弃自己的追寻",
        note: "注意动词搭配 renoncer à qqch / à faire qqch（放弃某事）。",
      },
      {
        fr: "n'être autre que",
        zh: "不是别人，正是……",
        note: "法语叙事揭示悬念的经典句型：le dragon n'était autre que Scales。",
      },
    ],
  },
];

export const CURATED_YOUTUBE_VIDEOS: readonly CuratedYoutubeVideo[] = [
  {
    id: "yt-karambolage-baguette",
    kind: "youtube",
    youtubeId: "XlSEK813yBs",
    fallbackUrl: "https://www.youtube.com/watch?v=XlSEK813yBs",
    channel: "ARTE Karambolage",
    title: "La baguette — Karambolage",
    titleZh: "法棍面包的秘密与礼仪",
    durationLabel: "4m",
    level: "A2",
    energy: 1,
    tags: ["文化符号", "饮食日常", "动画短片"],
    summaryZh:
      "用轻快幽默的拼贴动画揭秘法国餐桌灵魂——法棍面包的历史渊源、重量标准，以及为什么几乎每个法国人在从面包店走回家的路上都会忍不住先掰下热乎乎的面包尖（le quignon）尝一口。",
    cultureNoteZh:
      "《Karambolage》是法德文化频道 ARTE 自 2004 年起播出的王牌微型文化栏目，专门对比法德日常生活中的微妙习俗。2022 年，“法棍面包手工技艺与文化”正式列入联合国教科文组织非物质文化遗产名录。",
    keyExpressions: [
      {
        fr: "le quignon de pain",
        zh: "法棍两头酥脆的面包尖",
        note: "也有地区称之为 le croûton；买完法棍路上先吃掉面包尖是法国人的共同记忆。",
      },
      {
        fr: "croustillant à l'extérieur, moelleux à l'intérieur",
        zh: "外皮酥脆，内芯松软",
        note: "品评烘焙美食最地道的黄金形容词组合。",
      },
      {
        fr: "passer à la boulangerie",
        zh: "顺路去一趟面包店",
        note: "passer chez le boulanger / à la boulangerie 是法国日常高频生活表达。",
      },
    ],
  },
  {
    id: "yt-karambolage-bise",
    kind: "youtube",
    youtubeId: "rxHcrRogbAA",
    fallbackUrl: "https://www.youtube.com/watch?v=rxHcrRogbAA",
    channel: "ARTE Karambolage",
    title: "La bise — Karambolage",
    titleZh: "法国贴面礼地图：到底亲几下？",
    durationLabel: "4m",
    level: "A2",
    energy: 1,
    tags: ["社交礼仪", "地域差异", "幽默科普"],
    summaryZh:
      "在法国见面行贴面礼（faire la bise）究竟应该从左脸还是右脸开始？亲两下、三下还是四下？本期短片以趣味地图拆解法国不同省份令人眼花缭乱的贴面礼潜规则。",
    cultureNoteZh:
      "贴面礼并非真的亲吻皮肤，而是脸颊轻触同时在空气中发出轻柔吻声。巴黎通常亲两下，普罗旺斯常见三下，而卢瓦尔河口或约讷省甚至多达四下——连法国人跨省访友时也常在第三下出现尴尬错位！",
    keyExpressions: [
      {
        fr: "faire la bise à quelqu'un",
        zh: "向某人行贴面礼",
        note: "注意区分 faire la bise（社交贴面礼）与 embrasser（亲吻或深情拥吻）。",
      },
      {
        fr: "tendre la joue gauche",
        zh: "凑过左脸颊",
        note: "tendre la joue / tendre la main（伸出手握手）用于描述见面寒暄动作。",
      },
      {
        fr: "un casse-tête culturel",
        zh: "令人头疼的文化难题",
        note: "un casse-tête 原指益智解谜玩具，引申为“伤脑筋的难题”。",
      },
    ],
  },
  {
    id: "yt-brut-boulangerie",
    kind: "youtube",
    youtubeId: "spIqxcfbdDM",
    fallbackUrl: "https://www.youtube.com/watch?v=spIqxcfbdDM",
    channel: "Brut",
    title: "Vanessa fait du pain à l'ancienne dans sa boulangerie",
    titleZh: "巴黎手工面包师：用天然酵种唤醒古法面包",
    durationLabel: "4m",
    level: "B1",
    energy: 1,
    tags: ["匠人纪实", "内嵌法文字幕", "巴黎生活"],
    hasBurnedInSubs: true,
    summaryZh:
      "跟随 Brut 镜头走进巴黎第十九区的一家街角手工面包坊，看面包师 Vanessa 如何坚持使用古老小麦品种与天然酸面团（levain naturel）慢速发酵，重拾面包的纯粹麦香。",
    cultureNoteZh:
      "Brut 是法国年轻人最喜爱的短视频纪实媒体，所有视频均自带醒目的法语内嵌字幕（sous-titres incrustés），语速真实自然。法国法律严格规定：只有现场揉面、发酵并烘烤的店铺才能挂上“Artisan Boulanger”招牌。",
    keyExpressions: [
      {
        fr: "faire du pain à l'ancienne",
        zh: "用传统古法做面包",
        note: "à l'ancienne（按老派传统方式）常用于美食，如 moutarde à l'ancienne。",
      },
      {
        fr: "le levain naturel",
        zh: "天然酵种 / 酸面团",
        note: "与工业酵母（la levure chimique / boulangère）相对，风味更醇厚。",
      },
      {
        fr: "mettre la main à la pâte",
        zh: "亲自动手参与、挽起袖子干活",
        note: "字面正是“把手伸进面团里”，现已成为法语极高频的比喻习语。",
      },
      {
        fr: "un savoir-faire artisanal",
        zh: "手工技艺与匠心传承",
        note: "DELF B2 讨论传统行业、文化遗产保护时的核心名词词组。",
      },
    ],
  },
  {
    id: "yt-brut-bouquiniste",
    kind: "youtube",
    youtubeId: "XampbIp3aIs",
    fallbackUrl: "https://www.youtube.com/watch?v=XampbIp3aIs",
    channel: "Brut",
    title: "Un jour avec Camille, 32 ans, bouquiniste sur les quais de Seine",
    titleZh: "塞纳河畔旧书摊主的一天",
    durationLabel: "5m",
    level: "B1",
    energy: 1,
    tags: ["文学巴黎", "内嵌法文字幕", "人物特写"],
    hasBurnedInSubs: true,
    summaryZh:
      "32 岁的 Camille 守着塞纳河岸边标志性的墨绿色铁皮书箱，与路过的巴黎读者和世界各地旅人聊书、淘绝版旧书。短片记录了她伴着河风开箱营业的诗意日常。",
    cultureNoteZh:
      "塞纳河畔的旧书摊主（les bouquinistes）已有四百余年历史，绵延三公里多的近千只“帝王绿”（vert wagon）书箱被称为“世界上唯一一座建在河岸上的露天图书馆”，是巴黎最具代表性的文化风景线。",
    keyExpressions: [
      {
        fr: "flâner sur les quais de Seine",
        zh: "在塞纳河岸漫步闲逛",
        note: "flâner 是极具巴黎气质的动词，指不带目的地悠闲漫步。",
      },
      {
        fr: "chiner un livre rare",
        zh: "淘一本珍稀旧书",
        note: "chiner 专指在旧货市场、跳蚤市场或旧书摊里寻宝淘货。",
      },
      {
        fr: "une boîte vert wagon",
        zh: "墨绿色（车厢绿）旧书箱",
        note: "法语颜色形容词由名词构成时不作性数变化（des boîtes vert wagon）。",
      },
    ],
  },
  {
    id: "yt-gobelins-best-friend",
    kind: "youtube",
    youtubeId: "j01Hg4QJ6NE",
    fallbackUrl: "https://www.youtube.com/watch?v=j01Hg4QJ6NE",
    channel: "GOBELINS Paris",
    title: "Best Friend — Court métrage d'animation",
    titleZh: "《挚友》：巴黎戈布兰学院获奖科幻动画",
    durationLabel: "6m",
    level: "B1",
    energy: 1,
    tags: ["法国动画", "科技反思", "安锡获奖"],
    summaryZh:
      "在近未来的孤独都市里，成瘾式虚拟伙伴“Best Friend”让每个人沉浸在量身定制的完美友谊幻觉中，男主角 Arthur 却在生日当天逐渐察觉到虚假陪伴背后的寒意。",
    cultureNoteZh:
      "巴黎戈布兰图像学院（GOBELINS Paris）被誉为全球动画界的殿堂级学府，每年毕业短片都会在法国安锡国际动画电影节（Festival d'Annecy）惊艳亮相。本片也是 DELF B2“数字科技与人际疏离”话题的绝佳思辨素材。",
    keyExpressions: [
      {
        fr: "un court métrage d'animation",
        zh: "动画短片",
        note: "对应长片为 un long métrage；谈论影视作品必备分类词。",
      },
      {
        fr: "combler la solitude",
        zh: "填补孤独感",
        note: "combler un vide / combler la solitude 是讨论社交媒体心理效应的地道搭配。",
      },
      {
        fr: "tomber dans la dépendance",
        zh: "陷入成瘾与依赖",
        note: "可搭配 dépendance numérique（数字成瘾）用于 B2 口语与议论文。",
      },
    ],
  },
  {
    id: "yt-piece-of-french-journee",
    kind: "youtube",
    youtubeId: "Tdk3wldYhhU",
    fallbackUrl: "https://www.youtube.com/watch?v=Tdk3wldYhhU",
    channel: "Piece of French",
    title: "Une journée dans ma vie en français !",
    titleZh: "我的法语日常 Vlog：慢速自然生活口语",
    durationLabel: "11m",
    level: "A2",
    energy: 2,
    tags: ["生活Vlog", "清晰吐字", "日常词汇"],
    summaryZh:
      "法国博主 Elsa 用清晰温和的自然语速记录从晨间咖啡、居家办公、出门采购到傍晚散步的完整一天，把教科书之外鲜活的居家动作与心情表达自然串联起来。",
    cultureNoteZh:
      "Piece of French 以生活化沉浸式 Vlog 深受法语学习者喜爱。不同于生硬朗读的听力材料，Elsa 保留了真实法语口语中的连音、轻微停顿与日常感叹词（du coup, en fait, bref），是 A2 迈向 B1 听力的理想桥梁。",
    keyExpressions: [
      {
        fr: "se préparer un café bien chaud",
        zh: "给自己煮一杯热腾腾的咖啡",
        note: "代词式动词 se préparer qqch 在日常起居叙述中极为自然。",
      },
      {
        fr: "faire quelques courses dans le quartier",
        zh: "在街区附近买点日常用品",
        note: "注意 faire des courses（日常采买）与 faire du shopping（逛街买衣服）的区别。",
      },
      {
        fr: "prendre l'air en fin d'après-midi",
        zh: "傍晚时分出门透透气",
        note: "prendre l'air / se changer les idées 是描述放松休息的高频口语。",
      },
    ],
  },
  {
    id: "yt-easy-french-200",
    kind: "youtube",
    youtubeId: "8RwPXyA1hoE",
    fallbackUrl: "https://www.youtube.com/watch?v=8RwPXyA1hoE",
    channel: "Easy French",
    title: "Comment décrire les choses en français — Super Easy French 200",
    titleZh: "巴黎街头实景：如何用地道法语描述万物",
    durationLabel: "12m",
    level: "A2",
    energy: 2,
    tags: ["巴黎街访", "双语内嵌字幕", "口语表达"],
    hasBurnedInSubs: true,
    summaryZh:
      "Easy French 主持人在巴黎街头边走边展示如何跳出只会说 bon / petit / grand 的局限，用质感、形状、氛围形容词和自然口语句式生动描绘身边的建筑、食物与生活物件。",
    cultureNoteZh:
      "Easy French 是著名街头语言项目 Easy Languages 的法语分频道，坚持在巴黎及法国各地实景拍摄并内嵌完整法英双语字幕，能让学习者直观听到真实街头环境音与地道语音语调。",
    keyExpressions: [
      {
        fr: "ça a l'air hyper sympa",
        zh: "看起来超级棒 / 很有意思",
        note: "avoir l'air + adj.（看起来……）加上口语副词 hyper / super 极富生活气息。",
      },
      {
        fr: "c'est doux au toucher",
        zh: "摸起来很柔软",
        note: "au toucher（触感上）、au goût（口感上）是细致描述感官体验的好用结构。",
      },
      {
        fr: "un endroit plein de charme",
        zh: "充满魅力的地方",
        note: "比单纯说 joli 更丰富，适合口语复述与旅行话题。",
      },
    ],
  },
  {
    id: "yt-francais-authentique-expr",
    kind: "youtube",
    youtubeId: "nbDAWmnwcCk",
    fallbackUrl: "https://www.youtube.com/watch?v=nbDAWmnwcCk",
    channel: "Français Authentique",
    title: "5 expressions pour parler comme un Français",
    titleZh: "像法国母语者一样说话的 5 个高频习语",
    durationLabel: "10m",
    level: "B1",
    energy: 2,
    tags: ["地道习语", "母语思维", "清晰讲解"],
    summaryZh:
      "Johan 用条理分明的纯法语讲解五个法国人挂在嘴边的高频习语：从字面典故、真实生活语境到例句跟读，帮助你听懂法国影视与日常闲聊中的言外之意。",
    cultureNoteZh:
      "Français Authentique 主理人 Johan Tekfak 倡导“无压力自然习得法”（apprentissage naturel），强调通过大量可理解输入掌握词块（blocs de mots）而非死记孤立语法规则，吐字清晰稳健，非常适合不开字幕盲听。",
    keyExpressions: [
      {
        fr: "avoir du pain sur la planche",
        zh: "有一大堆工作要做、任重道远",
        note: "十九世纪本意是“木板上备足了面包未来不愁吃”，现代法语演变为“还有很多活要干”。",
      },
      {
        fr: "poser un lapin à quelqu'un",
        zh: "放某人鸽子、爽约",
        note: "法国日常社交高频习语：Il m'a posé un lapin hier soir !",
      },
      {
        fr: "donner sa langue au chat",
        zh: "猜不出谜底、甘拜下风求答案",
        note: "别人提问你实在猜不到时说：Je donne ma langue au chat !",
      },
      {
        fr: "couper la poire en deux",
        zh: "各退一步、折中妥协",
        note: "字面为“把梨一分为二”，常用于谈判或日常商量解决方案。",
      },
    ],
  },
  {
    id: "yt-innerfrench-provocation",
    kind: "youtube",
    youtubeId: "WaEYFEhj0UA",
    fallbackUrl: "https://www.youtube.com/watch?v=WaEYFEhj0UA",
    channel: "innerFrench",
    title: "Pourquoi les Français adorent la provocation",
    titleZh: "为什么法国人如此热爱“挑衅”与辩论？",
    durationLabel: "15m",
    level: "B1",
    energy: 2,
    tags: ["深度文化", "社会心理", "B1-B2进阶"],
    summaryZh:
      "从启蒙时代的讽刺传统、五月风暴标语到艺术典礼与餐桌争鸣，Hugo Cotton 深入浅出地剖析为什么“敢于冒犯与交锋”（l'esprit de contradiction）在法国社会被视为思想活力的象征。",
    cultureNoteZh:
      "innerFrench 是全球口碑极佳的中高级法语播客与视频频道。在法国餐桌与公共空间里，不同意对方观点并不代表失礼，反而意味着认真对待彼此的思想——理解这种辩论文化对备考 DELF B2 口语答辩（entretien dirigé）大有裨益。",
    keyExpressions: [
      {
        fr: "l'esprit de contradiction",
        zh: "反叛与唱反调的精神、思辨精神",
        note: "解读法国公共讨论与哲学传统的核心概念词。",
      },
      {
        fr: "susciter la polémique",
        zh: "引发争议与公共论战",
        note: "DELF B2 阅读与口语开篇陈述（exposé）引出争议焦点的王牌搭配。",
      },
      {
        fr: "remettre en question l'ordre établi",
        zh: "质疑既定秩序",
        note: "remettre en question / en cause 是中高级论证中不可替代的动词短语。",
      },
      {
        fr: "prendre le contre-pied de",
        zh: "采取与……截然相反的立场",
        note: "用于在讨论中优雅地提出反方视角。",
      },
    ],
  },
  {
    id: "yt-innerfrench-toulouse",
    kind: "youtube",
    youtubeId: "LxPB9lEv3ko",
    fallbackUrl: "https://www.youtube.com/watch?v=LxPB9lEv3ko",
    channel: "innerFrench",
    title: "Pourquoi Toulouse est devenue la ville préférée des Français ?",
    titleZh: "“玫瑰之城”图卢兹为何成为法国人最向往的城市？",
    durationLabel: "16m",
    level: "B2",
    energy: 2,
    tags: ["法国城市", "生活质量", "人口趋势"],
    summaryZh:
      "在逃离巴黎高房价与快节奏的浪潮中，位于法国西南部的图卢兹凭借粉红砖墙建筑、欧洲航空航天产业核心地位、阳光气候与浓厚大学城活力，跃居法国人口增长最快的热门宜居城市。",
    cultureNoteZh:
      "图卢兹因老城建筑大量使用赤陶红砖而得名“La Ville rose”（玫瑰之城），既是空中客车（Airbus）总部与欧洲航天之都，又保留着奥克语区（Occitanie）热情悠闲的南法生活艺术，完美契合 B2“城市化与异地宜居”常考母题。",
    keyExpressions: [
      {
        fr: "la qualité de vie",
        zh: "生活品质",
        note: "讨论远程办公（télétravail）与城乡迁徙话题的核心高频词。",
      },
      {
        fr: "attirer de nouveaux habitants",
        zh: "吸引新居民迁入",
        note: "搭配 l'attractivité d'une métropole（都会吸引力）使表达更地道。",
      },
      {
        fr: "un pôle aéronautique majeur",
        zh: "重要的航空产业中心",
        note: "un pôle économique / universitaire / culturel 指“……中心/重镇”。",
      },
      {
        fr: "le coût du logement",
        zh: "居住与住房成本",
        note: "分析大城市利弊（avantages et inconvénients）时的实用表达。",
      },
    ],
  },
  {
    id: "yt-dessous-des-cartes-ue",
    kind: "youtube",
    youtubeId: "3mPKa71R3zg",
    fallbackUrl: "https://www.youtube.com/watch?v=3mPKa71R3zg",
    channel: "ARTE Le Dessous des Cartes",
    title: "L'UE face aux crises — Le Dessous des cartes",
    titleZh: "《地图背后》：多重危机考验下的欧盟版图",
    durationLabel: "15m",
    level: "B2",
    energy: 3,
    tags: ["地缘政治", "地图解析", "B2严谨论述"],
    summaryZh:
      "主持人 Émilie Aubry 借助精准动态地图，梳理欧盟二十七国在公共卫生、能源转型与安全变局中如何从分歧走向联合机制，清晰呈现欧洲一体化的制度韧性与现实挑战。",
    cultureNoteZh:
      "由地理学家 Jean-Christophe Victor 创办、现由 Émilie Aubry 主持的《Le Dessous des cartes》是法语世界逻辑最严密的知识节目之一。其句子衔接紧凑、逻辑连接词教科书般精准，是锤炼 B2/C1 新闻听力与议论文结构的顶级范本。",
    keyExpressions: [
      {
        fr: "faire face à une crise sans précédent",
        zh: "应对一场前所未有的危机",
        note: "sans précédent（史无前例的）与 faire face à 是新闻评论高频搭配。",
      },
      {
        fr: "à l'échelle européenne",
        zh: "在欧洲层面上 / 全欧范围内",
        note: "可类推 à l'échelle mondiale / nationale / locale，极大提升书面语质感。",
      },
      {
        fr: "mettre en évidence les disparités",
        zh: "凸显出地区或发展差异",
        note: "图表与地图分析中最优雅的动词短语之一。",
      },
      {
        fr: "un tournant historique",
        zh: "历史转折点",
        note: "同义表达 marquer un tournant décisif（标志着决定性转折）。",
      },
    ],
  },
  {
    id: "yt-nota-bene-revolution",
    kind: "youtube",
    youtubeId: "Au7DPVUpc6A",
    fallbackUrl: "https://www.youtube.com/watch?v=Au7DPVUpc6A",
    channel: "Nota Bene",
    title: "La Révolution française de 1789 à 1792",
    titleZh: "法国大革命全景（1789–1792）：从三级会议到共和诞生",
    durationLabel: "22m",
    level: "B2",
    energy: 3,
    tags: ["法国历史", "公民文化", "母语语速"],
    summaryZh:
      "法国知名历史科普博主 Benjamin Brillaud 生动复盘 1789 至 1792 年间风起云涌的历史转折：财政危机、攻占巴士底狱、《人权宣言》颁布，直至君主立宪制瓦解与法兰西第一共和国诞生。",
    cultureNoteZh:
      "法国现代政治词汇（如“左派与右派”gauche / droite 源自制宪议会座位分布）、三色旗与世俗共和理念皆奠基于这一时期。Nota Bene 以讲故事般流畅生动的现代法语拆解复杂史实，能帮助学习者打通法国新闻与社会讨论的历史底层密码。",
    keyExpressions: [
      {
        fr: "l'abolition des privilèges",
        zh: "废除封建特权",
        note: "指 1789 年 8 月 4 日之夜废除贵族与教士特权，法国历史核心术语。",
      },
      {
        fr: "la Déclaration des droits de l'homme et du citoyen",
        zh: "《人权和公民权宣言》",
        note: "法国共和价值基石文献，注意专有名词大小写规范。",
      },
      {
        fr: "un bouleversement politique profond",
        zh: "深刻的政治剧变",
        note: "bouleversement（翻天覆地的变化）可用于社会、科技与历史变革论述。",
      },
      {
        fr: "prendre d'assaut la Bastille",
        zh: "攻占巴士底狱",
        note: "prendre d'assaut（强攻、席卷）亦可比喻新潮流迅速占领市场。",
      },
    ],
  },
  {
    id: "yt-cps-fromage",
    kind: "youtube",
    youtubeId: "RbdxFksSwws",
    fallbackUrl: "https://www.youtube.com/watch?v=RbdxFksSwws",
    channel: "C'est pas sorcier",
    title: "Tout un fromage — C'est pas sorcier",
    titleZh: "《一点也不难》：法国奶酪王国的科学与风土",
    durationLabel: "26m",
    level: "B2",
    energy: 3,
    tags: ["国民科普", "美食科学", "风土文化"],
    summaryZh:
      "开着标志性白色大卡车的 Fred 和模型大师 Jamy 深入牧场、地窖与实验室，用直观有趣的立体模型解释一桶鲜奶如何经过凝乳、沥干、霉菌发酵与窖藏熟化，变成上千种风味各异的法国奶酪。",
    cultureNoteZh:
      "《C'est pas sorcier》（字面意为“这又不是巫术/一点也不难”）陪伴了几代法国人成长，是最具国民度的科学启蒙节目。片名双关习语“en faire tout un fromage”（小题大做），一边学发酵科学，一边领略法国 AOP 原产地保护风土文化。",
    keyExpressions: [
      {
        fr: "en faire tout un fromage",
        zh: "小题大做、大惊小怪",
        note: "源自“明明只是普通牛奶却折腾出一整块复杂奶酪”，日常口语极常用！",
      },
      {
        fr: "c'est pas sorcier",
        zh: "这并不难、没那么玄乎",
        note: "口语中常省略 ne（标准书面为 ce n'est pas sorcier），用来鼓励他人。",
      },
      {
        fr: "l'affinage en cave",
        zh: "地窖熟化与陈酿工艺",
        note: "奶酪制作灵魂工序，专门负责熟化的匠人称为 maître affineur。",
      },
      {
        fr: "un produit du terroir",
        zh: "地方风土特产",
        note: "le terroir 是法国饮食文化核心词，融合土壤、气候与世代传统技艺。",
      },
    ],
  },
  {
    id: "yt-cps-paris",
    kind: "youtube",
    youtubeId: "Y5-hzRXI9TM",
    fallbackUrl: "https://www.youtube.com/watch?v=Y5-hzRXI9TM",
    channel: "C'est pas sorcier",
    title: "Paris s'éveille — C'est pas sorcier",
    titleZh: "《一点也不难》：巴黎苏醒——从高卢卢泰西亚到中世纪之城",
    durationLabel: "26m",
    level: "B2",
    energy: 3,
    tags: ["巴黎城史", "建筑演变", "国民科普"],
    summaryZh:
      "Fred 穿梭于西岱岛、古罗马浴场遗址与巴黎地下墓穴，配合 Jamy 精巧的城市沙盘，重现巴黎如何从塞纳河心的帕里西人渔村卢泰西亚（Lutèce）一步步生长为中世纪欧洲文化重镇。",
    cultureNoteZh:
      "片名致敬了法国音乐人 Jacques Dutronc 家喻户晓的清晨名曲《Il est cinq heures, Paris s'éveille》。通过城市地理与历史建筑双线叙事，你能轻松记住西岱岛（Île de la Cité）、左岸拉丁区等巴黎核心地标的来龙去脉。",
    keyExpressions: [
      {
        fr: "le berceau historique de la capitale",
        zh: "首都的历史摇篮",
        note: "le berceau de...（……的发源地/摇篮）常用于介绍城市与文明起源。",
      },
      {
        fr: "au carrefour des routes commerciales",
        zh: "地处商贸路线交汇处",
        note: "au carrefour de（在……的十字路口/交汇点）在地理与文化写作中极地道。",
      },
      {
        fr: "façonner le paysage urbain",
        zh: "塑造城市风貌与格局",
        note: "façonner（雕琢、塑造）是 B2 谈论城市规划与历史变迁的亮眼动词。",
      },
    ],
  },
];

function resolveBaseUrl(): string {
  const env = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env;
  const raw = env?.BASE_URL || "/";
  return raw.endsWith("/") ? raw : `${raw}/`;
}

function parseTimestampSec(raw: string): number | null {
  const match = raw
    .trim()
    .match(/^(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{3})$/);
  if (!match) return null;
  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const millis = Number(match[4]);
  return hours * 3600 + minutes * 60 + seconds + millis / 1000;
}

function stripCueTags(line: string): string {
  return line.replace(/<[^>]+>/g, "").trim();
}

function parseVttFallback(raw: string): SubtitleCue[] {
  const cleaned = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (!cleaned) return [];
  const blocks = cleaned.split(/\n{2,}/);
  const cues: SubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const firstLine = lines[0];
    if (!firstLine) continue;
    if (
      firstLine.startsWith("WEBVTT") ||
      firstLine.startsWith("NOTE") ||
      firstLine.startsWith("STYLE")
    ) {
      continue;
    }

    const arrowIdx = lines.findIndex((l) => l.includes("-->"));
    if (arrowIdx === -1) continue;
    const arrowLine = lines[arrowIdx];
    if (!arrowLine) continue;

    const [startRaw, endPart] = arrowLine.split("-->");
    const endRaw = (endPart ?? "").trim().split(/\s+/)[0] ?? "";
    const start = parseTimestampSec(startRaw ?? "");
    const end = parseTimestampSec(endRaw);
    if (start === null || end === null || end <= start) continue;

    const textLines = lines
      .slice(arrowIdx + 1)
      .map(stripCueTags)
      .filter(Boolean);
    const fr = textLines[0];
    if (!fr) continue;

    const zh = textLines.length > 1 ? textLines.slice(1).join(" ") : undefined;
    cues.push(zh ? { start, end, fr, zh } : { start, end, fr });
  }

  return cues;
}

export async function loadSampleVideoCues(
  vttPath: string,
): Promise<SubtitleCue[]> {
  const base = resolveBaseUrl();
  const url = `${base}${vttPath.replace(/^\//, "")}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load subtitles (${res.status}): ${url}`);
  }
  const text = await res.text();
  try {
    const mod = await import("./subtitles");
    return mod.parseSubtitles(text);
  } catch {
    return parseVttFallback(text);
  }
}
