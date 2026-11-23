import type {
  BookChapterData,
  LoungeBookMeta,
  RecommendedPrivateBook,
} from "./lounge-types";

export const LOUNGE_BOOKS: readonly LoungeBookMeta[] = [
  {
    id: "daudet-moulin",
    title: "Lettres de mon moulin & Contes",
    titleZh: "磨坊书简与都德短篇精选",
    author: "Alphonse Daudet (1840–1897)",
    year: 1869,
    level: "B1",
    energy: 2,
    moodTags: ["南法阳光", "治愈散文", "经典必读"],
    summaryZh:
      "在普罗旺斯松林与旧风车的微风里，读倔强向往高山自由的小白羊、星空下牧羊人的静谧守夜，以及阿尔萨斯小镇动人心魄的最后一堂法语课。",
    licenseNote: "Domaine public (FR & US, ≤1873) · 中文译注 CC BY 4.0",
    librivoxUrl:
      "https://librivox.org/lettres-de-mon-moulin-by-alphonse-daudet/",
    chapters: [
      {
        id: "ch-01",
        title: "La Chèvre de M. Seguin",
        titleZh: "瑟甘先生的小山羊",
        words: 999,
        path: "materials/books/daudet-moulin/ch-01.json",
      },
      {
        id: "ch-02",
        title: "Les Étoiles",
        titleZh: "繁星",
        words: 925,
        path: "materials/books/daudet-moulin/ch-02.json",
      },
      {
        id: "ch-03",
        title: "La Dernière Classe",
        titleZh: "最后一课",
        words: 1072,
        path: "materials/books/daudet-moulin/ch-03.json",
      },
    ],
  },
  {
    id: "renard-perrault",
    title: "Histoires naturelles & Contes de Perrault",
    titleZh: "自然史动物微速写 & 鹅妈妈童话",
    author: "Jules Renard (1896) · Charles Perrault (1697)",
    year: 1896,
    level: "A2",
    energy: 1,
    moodTags: ["睡前零负担", "法式冷幽默", "经典童话"],
    summaryZh:
      "用最轻盈的篇幅给大脑做一场法式按摩：既有儒勒·勒纳尔寥寥数笔勾勒猫狗天鹅的诗意冷幽默，也有佩罗原汁原味的《小红帽》与《穿靴子的猫》。",
    licenseNote: "Domaine public (FR & US, 1697 / 1896) · 中文译注 CC BY 4.0",
    librivoxUrl: "https://librivox.org/histoires-naturelles-by-jules-renard/",
    chapters: [
      {
        id: "ch-01",
        title: "Histoires naturelles — Portraits de bêtes",
        titleZh: "自然史：动物速写集（猫、狗、天鹅、蝴蝶、松鼠与家鼠）",
        words: 626,
        path: "materials/books/renard-perrault/ch-01.json",
      },
      {
        id: "ch-02",
        title: "Le Petit Chaperon rouge",
        titleZh: "小红帽（佩罗原版）",
        words: 644,
        path: "materials/books/renard-perrault/ch-02.json",
      },
      {
        id: "ch-03",
        title: "Le Maître Chat ou le Chat botté",
        titleZh: "穿靴子的猫",
        words: 785,
        path: "materials/books/renard-perrault/ch-03.json",
      },
    ],
  },
  {
    id: "lupin",
    title: "Arsène Lupin, gentleman-cambrioleur",
    titleZh: "绅士怪盗亚森·罗宾",
    author: "Maurice Leblanc (1864–1941)",
    year: 1907,
    level: "B1",
    energy: 2,
    moodTags: ["悬疑爽文", "机智反转", "Netflix原著"],
    summaryZh:
      "跨大西洋邮轮上传来一封神秘无线电报：「亚森·罗宾就在您的头等舱里！」猜忌、易容与越狱诡计环环相扣，最适合学累时一口气追完的法语侦探名作。",
    licenseNote: "Domaine public (FR & US, 1907) · 中文译注 CC BY 4.0",
    librivoxUrl:
      "https://librivox.org/arsene-lupin-gentleman-cambrioleur-by-maurice-leblanc/",
    chapters: [
      {
        id: "ch-01",
        title: "L'Arrestation d'Arsène Lupin — La traversée",
        titleZh: "亚森·罗宾被捕记（上）：大洋疑云",
        words: 829,
        path: "materials/books/lupin/ch-01.json",
      },
      {
        id: "ch-02",
        title: "L'Arrestation d'Arsène Lupin — Le dénouement",
        titleZh: "亚森·罗宾被捕记（下）：舷梯真相",
        words: 690,
        path: "materials/books/lupin/ch-02.json",
      },
      {
        id: "ch-03",
        title: "Arsène Lupin en prison",
        titleZh: "狱中亚森·罗宾",
        words: 729,
        path: "materials/books/lupin/ch-03.json",
      },
    ],
  },
  {
    id: "maupassant",
    title: "Contes choisis — La Parure & Deux Amis",
    titleZh: "莫泊桑反转短篇精选",
    author: "Guy de Maupassant (1850–1893)",
    year: 1884,
    level: "B2",
    energy: 3,
    moodTags: ["文学微雕", "神级反转", "B2精读典范"],
    summaryZh:
      "一串借来的钻石项链如何改写十年的青春，塞纳河畔垂钓的两位巴黎市民又如何在炮火前守住尊严——精准冷峻的十九世纪法语叙事巅峰。",
    licenseNote: "Domaine public (FR & US, 1883–1884) · 中文译注 CC BY 4.0",
    librivoxUrl: "https://librivox.org/contes-choisis-by-guy-de-maupassant/",
    chapters: [
      {
        id: "ch-01",
        title: "La Parure (I — L'invitation et le bal)",
        titleZh: "项链（上）：请柬与舞会",
        words: 796,
        path: "materials/books/maupassant/ch-01.json",
      },
      {
        id: "ch-02",
        title: "La Parure (II — Dix ans de labeur)",
        titleZh: "项链（下）：十年辛劳",
        words: 712,
        path: "materials/books/maupassant/ch-02.json",
      },
      {
        id: "ch-03",
        title: "Deux Amis",
        titleZh: "两个朋友",
        words: 758,
        path: "materials/books/maupassant/ch-03.json",
      },
    ],
  },
  {
    id: "colette-betes",
    title: "Dialogues de bêtes",
    titleZh: "动物对话录：猫狗拌嘴日常",
    author: "Colette (1873–1954)",
    year: 1904,
    level: "B2",
    energy: 2,
    moodTags: ["2025新晋公版", "猫狗日常", "鲜活口语"],
    summaryZh:
      "憨厚忠诚的法国斗牛犬 Toby-Chien 与高傲机敏的安哥拉猫 Kiki-la-Doucette 围坐在壁炉边、火车车厢与餐桌旁互怼哲学与人类——对白灵动俏皮，感官词汇极美。",
    licenseNote:
      "Domaine public (1904 · 2025新入法国公版 & 美国公版) · 中文译注 CC BY 4.0",
    chapters: [
      {
        id: "ch-01",
        title: "Sentimentalités",
        titleZh: "多愁善感",
        words: 733,
        path: "materials/books/colette-betes/ch-01.json",
      },
      {
        id: "ch-02",
        title: "Le Voyage",
        titleZh: "旅途",
        words: 749,
        path: "materials/books/colette-betes/ch-02.json",
      },
      {
        id: "ch-03",
        title: "Le Dîner est en retard",
        titleZh: "晚饭迟到了",
        words: 801,
        path: "materials/books/colette-betes/ch-03.json",
      },
    ],
  },
];

export const RECOMMENDED_PRIVATE_BOOKS: readonly RecommendedPrivateBook[] = [
  {
    id: "rec-petit-prince",
    title: "Le Petit Prince",
    titleZh: "小王子",
    author: "Antoine de Saint-Exupéry",
    level: "A2",
    energy: 1,
    atlasOverlapPct: 93,
    tags: ["哲理童话", "温柔治愈", "入门首本"],
    whyZh:
      "句式澄澈简练，全书核心词与本站 A1–B1 词库高度重合，适合在一个安静的夜晚配合雨声读完。",
    copyrightNoteZh:
      "作者获授「Mort pour la France（为法兰西捐躯）」延长期，法国本土版权保护至约 2032/2033 年，请导入个人合法 EPUB/TXT 阅读。",
  },
  {
    id: "rec-petit-nicolas",
    title: "Le Petit Nicolas",
    titleZh: "小淘气尼古拉",
    author: "René Goscinny & Jean-Jacques Sempé",
    level: "A2",
    energy: 1,
    atlasOverlapPct: 91,
    tags: ["童年爆笑", "高频口语", "独立短章"],
    whyZh:
      "以小学生第一人称口吻讲述校园闹剧，满是法国人从小用到大的地道生活动词与口头禅，每篇独立无负担。",
    copyrightNoteZh:
      "受现代版权保护，仓库不内置正文；可点击上方导入个人正版 EPUB 分章伴读。",
  },
  {
    id: "rec-ibrahim",
    title: "Monsieur Ibrahim et les fleurs du Coran",
    titleZh: "伊布拉希莫先生和古兰经的花朵",
    author: "Éric-Emmanuel Schmitt",
    level: "B1",
    energy: 1,
    atlasOverlapPct: 89,
    tags: ["巴黎街区", "温情成长", "短薄好读"],
    whyZh:
      "全书仅万余词、对话占比极高，讲述巴黎蓝街少年与杂货铺老人的忘年交，几乎可以一下午一口气读通。",
    copyrightNoteZh:
      "在世作家受版权保护，支持通过本地 EPUB/TXT 导入器私享阅读并点词入卡组。",
  },
  {
    id: "rec-etranger",
    title: "L'Étranger",
    titleZh: "局外人",
    author: "Albert Camus",
    level: "B1",
    energy: 2,
    atlasOverlapPct: 88,
    tags: ["诺奖经典", "复合过去时", "短句美学"],
    whyZh:
      "第一部几乎全用复合过去时（passé composé）短句写成，彻底绕开古典小说的简单过去时门槛，是 B1 迈向文学原著的里程碑。",
    copyrightNoteZh:
      "加缪 1960 年逝世，法国版权保护至 2031 年 1 月，请导入个人自备 EPUB 电子书阅读。",
  },
  {
    id: "rec-bonjour-tristesse",
    title: "Bonjour tristesse",
    titleZh: "你好，忧愁",
    author: "Françoise Sagan",
    level: "B2",
    energy: 2,
    atlasOverlapPct: 86,
    tags: ["蔚蓝海岸", "心理细腻", "夏日慵懒"],
    whyZh:
      "十八岁少女笔下的南法海滨长夏，情绪与心理描写克制而优雅，能自然积累大量 B2 情感与人际态度词汇。",
    copyrightNoteZh:
      "受现代著作权保护，建议导入个人正版 EPUB，开启双模式边读边收好句。",
  },
  {
    id: "rec-stupeur",
    title: "Stupeur et tremblements",
    titleZh: "畏惧与战栗",
    author: "Amélie Nothomb",
    level: "B2",
    energy: 2,
    atlasOverlapPct: 84,
    tags: ["职场自嘲", "跨文化冲突", "停不下来"],
    whyZh:
      "作者亲历跨国大企业的荒诞职场生存记，冷面幽默让人捧腹，且大量企业层级与劳动议题词汇可直接反哺 DELF B2 职场写作！",
    copyrightNoteZh:
      "当代作品受版权保护，请通过本地 EPUB 导入器在浏览器本机离线阅读。",
  },
  {
    id: "rec-petit-pays",
    title: "Petit Pays",
    titleZh: "小小国度",
    author: "Gaël Faye",
    level: "B2",
    energy: 2,
    atlasOverlapPct: 85,
    tags: ["法语世界", "高中生龚古尔奖", "音乐感"],
    whyZh:
      "法语饶舌歌手笔下的布隆迪童年与时代巨变，文字自带散文诗律动，是理解当代法语国家（Francophonie）视野的佳作。",
    copyrightNoteZh:
      "当代受保护作品，仅提供书单导引，支持本地导入个人正版电子书。",
  },
  {
    id: "rec-esther",
    title: "Les Cahiers d'Esther",
    titleZh: "艾丝苔尔的日记",
    author: "Riad Sattouf",
    level: "B1",
    energy: 1,
    atlasOverlapPct: 87,
    tags: ["真实日记", "当代巴黎口语", "轻松解压"],
    whyZh:
      "改编自法国小女孩十岁到十八岁的真实生活周记，鲜活记录当代法国家庭、学校与流行文化，读起来毫无压力。",
    copyrightNoteZh:
      "现代漫画/文本受版权保护，支持将个人整理的文本或无 DRM 电子书导入本机学习。",
  },
  {
    id: "rec-chanson-douce",
    title: "Chanson douce",
    titleZh: "温柔之歌",
    author: "Leïla Slimani",
    level: "B2",
    energy: 3,
    atlasOverlapPct: 86,
    tags: ["龚古尔奖", "现代家庭悬疑", "精准现代法语"],
    whyZh:
      "开篇第一句便抓住呼吸的巴黎中产家庭悬疑小说，全书使用干净利落的现代新闻式现在时，极具画面感与社会洞察。",
    copyrightNoteZh:
      "龚古尔奖当代小说，受版权保护；导入个人正版 EPUB 后可按章追踪阅读进度。",
  },
  {
    id: "rec-anomalie",
    title: "L'Anomalie",
    titleZh: "反常",
    author: "Hervé Le Tellier",
    level: "B2",
    energy: 3,
    atlasOverlapPct: 82,
    tags: ["软科幻悬疑", "多线群像", "脑洞大开"],
    whyZh:
      "同一架巴黎飞纽约的航班在三个月后竟再次降落——融合悬疑、哲学与黑色幽默的百万册畅销龚古尔奖神作。",
    copyrightNoteZh:
      "当代受版权保护作品，可通过上方零上传本地 EPUB 导入器畅读。",
  },
];

export async function loadBookChapter(
  bookId: string,
  chapterId: string,
): Promise<BookChapterData> {
  const base =
    typeof import.meta !== "undefined" && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL
      : "/";
  const cleanBase = base.endsWith("/") ? base : `${base}/`;
  const url = `${cleanBase}materials/books/${encodeURIComponent(bookId)}/${encodeURIComponent(chapterId)}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`无法加载章节内容（HTTP ${res.status}）`);
  }
  return (await res.json()) as BookChapterData;
}
