# 法语词图（Mots B2 / 基础到 B2）

以 word-atlas 的界面与交互为基准的法语词汇学习站点。数据来自四本教材的索引，每个词条标注来源页码。

## 来源与授权
本项目由 [designfuchen/word-atlas](https://github.com/designfuchen/word-atlas)（英语词汇学习站点）修改而来：界面、交互、记忆算法的接法和构建脚本的框架出自原项目，法语词库、语法、阅读、成句练习、离线词典和 AI 接口是在它之上改写和新增的。

- 代码：MIT，见 [`LICENSE`](LICENSE)，保留原项目的版权声明。
- 内容：各部分的授权不同，见 [`CONTENT_LICENSE.md`](CONTENT_LICENSE.md)。**取自教材的词条顺序、页码和例句版权属于原出版方，不在本项目的授权范围内。**
- 仓库里不含教材本身（`references/books/`）、从教材转录的工作文件（`data/imports/`、`data/lessons/`、`data/batches/`）、录音（`public/atlas/audio/`）和词库的历史快照（`data/snapshots/`）。录音用 `npm run lexicon:audio` 重新生成；`data/imports/` 里只留了两个导入模板；各 `verify-lessons*` 等一次性核对脚本要读转录文件，克隆下来的仓库里不能运行，其余命令不受影响。

## 当前状态（诚实版）
实时统计见 **[`data/STATS.md`](data/STATS.md)**（由 `python3 scripts/report-stats.py` 从 `data/lexicon.json` 生成，避免手工数字过时）。要点：

- 可学习（有中文释义）与可见词条数见 STATS.md；缺释义的可见词条仍只显示「释义待补充」，**不进入学习与测验**。
- 例句：一部分来自教材，一部分为本站补充（条目 note 注明 origin=supplement）。补充的中文翻译加在教材例句上时，句子的 origin 仍为教材；当前界面显示“书中例句”，翻译是否来自原书需看条目 note。后续可增加翻译来源字段。
- 等级为**推定**，不是逐词核实的官方等级：先按词条所在教材覆盖的等级范围（初级教材 A1–A2，A2-B1 教材 A2–B1，进阶与 DELF 教材 B2），跨两档的教材再按 Lexique 词频拆分（初级教材每百万词 ≥20 次归 A1，A2-B1 教材 ≥30 次归 A2），极常用词再按词频下调（≥300 → A1，≥100 → A2，≥30 → B1）。词组没有词频，按所在教材归类。规则与阈值见 `scripts/lexicon/levels.ts`。目前没有 C1/C2 词条。
- 正文课文尚未逐课整理；DELF 词表（连接词、主题词表、Lexique）已补释义，来源可追溯到具体页码。
- **没有任何内容被声明为已人工核实**：`review` 仍为 `unreviewed`，释义/译文状态为「补充翻译·待核对」。
- 完整缺口见 `data/SCOPE-AND-GAPS.md`。

## 运行
```bash
npm install
npm run dev            # http://127.0.0.1:5190
npm test               # 单元测试（当前 106 项；以实际输出为准）
npm run build          # 类型检查 + 构建
npm run lexicon:check  # 词库完整性
npm run lexicon:freq   # 由 Lexique 3.83 计算词频 → data/frequency.json（需 python3）
npm run lexicon:nouns  # 名词阴阳性与不定冠词（对照 Lexique 核对）→ data/nouns.json
npm run lexicon:conj   # 动词变位表：规则生成 + 逐形对照 Lexique 核对 → public/atlas/conj.json
npm run lexicon:ipa    # 由 Lexique 3.83 的 phon 列生成 IPA → data/ipa.json
npm run lexicon:forms  # 由 Lexique 3.83 取不规则复数、形容词阴性/复数，加形容词位置说明 → data/forms.json
npm run lexicon:audio  # 单词与例句的女声/男声录音（Azure 语音，密钥放 .env.local）→ public/atlas/audio/，之后再运行 lexicon:build；免费额度用完会自动停下，下月再运行接着做
npm run lexicon:dict   # 自己加词用的离线词典（Lexique + 法语维基词典 + Tatoeba）→ public/dict/（先按下文下载原始数据）
python3 scripts/seed-confusables-r40.py  # 生成 data/confusables.json（易混词辨析页的数据，lexicon:build 时校验并输出到 public/atlas/）
python3 scripts/split-society-topic.py  # 把「社会与公民」按教材章节拆成家庭与人际、居住与城市、地理与历史、政治与法律、观点与表达、艺术与休闲（改写 data/lexicon.json，日志在 output/）
npm run lexicon:hl     # 在例句里定位词条（含变位形式）→ data/highlights.json，用于高亮与挖空
npm run lexicon:build  # 由 data/lexicon.json + data/frequency.json + data/nouns.json + data/ipa.json + data/highlights.json + data/forms.json 生成 public/atlas/（学习路线按词频）
npm run lexicon:ids    # 检查既有 ID 是否被改动
npm run e2e            # 浏览器端到端（需 dev 服务与本机 Chrome）
```

## 语法
导航里的「语法」分「语法点」和「动词变位」。语法点（A1–B2，共 26 个）的讲解在 `data/grammar/points.json`，本站自写、标「待核对」；练习题由 `npm run lexicon:grammar`（`scripts/build-grammar.ts`）按规则从词库例句里挑出来，只在答案能从句子确定时出题（动词按主语和唯一的时态、名词按已核对的阴阳性、缩合按原文），干扰项是同一个词的其他真实形式；城市和国家前的介词、部分虚拟式和条件式是模板题。规则挑不准的句法类语法点（宾语代词、y / en、关系代词、愈过去时、副动词、被动语态、间接引语、条件式过去时、先将来时、虚拟式还是直陈式、虚拟式过去时、复合关系代词、过去分词配合、逻辑连接词等 15 个）用 `data/grammar/drills.json` 里的手写题（每点 12–15 题，本站自写、待核对；句子里用 `[ ]` 标答案，`x` 是干扰项），构建时校验答案和选项。每个语法点是一张 FSRS 复习卡，一轮按错题数评分；答题后可以把有问题的题标为「不再出现」。

## 成句输出（中译法、造句）
「练习」里的两个模式，每轮 5 句，只是练习，不改动记忆进度。

- **中译法**：给出词库例句的中文，自己写出法语。和书里的句子一样（不计大小写和句末标点）直接算对，不请求 AI；写法不同时由 AI 判断，书里的句子只作为一种参考答案。没有设置 AI 接口或请求失败时，显示书里的句子并标出不同的词，自己判断。
- **造句**：用给出的词写一句话，必须有 AI 接口。

批改用「生成卡片」服务（`gradeSentence`，`src/ai/tasks.ts`），每句一次请求，不缓存。返回结论（正确 / 基本正确 / 需要改）、只改错处的句子、逐条错误（类型和原因）、更地道的说法。结论由代码复核：AI 说「正确」但又改了句子，按「基本正确」算（`src/lib/writing.ts`）。AI 的批改可能有错。

## 阅读
导航里的「阅读」：读成篇的法语，不改动记忆进度。文章存在学习进度里（`progress.texts`，最多 60 篇、每篇 12000 字符），随备份导出。

- **文章来源**：粘贴；txt / docx 直接读取；图片和 PDF 用识图服务；或让 AI 按你在学的词写一篇。项目不自带语料（教材课文有版权）。
- **点词即查**：变位形式还原到原形（veulent → vouloir），倒装的代词不算进词里（dit-il → dit），专名不可点。词库有的词可以打开词条；词库没有、离线词典有的词加入后是自建词。「加入卡组」会把所在的句子存为例句；默认加到「阅读生词」（第一次加词时新建），可以在查词面板里换卡组。新词不会自动进当天的学习队列，要学就在学习界面切到这个卡组。
- **按熟悉度上色**：没学过 / 在学 / 已掌握 / 查不到，文章上方有图例和各自的词数；右上角的开关可以关掉，选择会记住。功能词（le、et、être…）不上色。
- **朗读**：「连播全文」逐句朗读并标出当前句；查词面板里可以只读这一句，或从这一句连播。没有录音，用 Azure 朗读（开启时）或设备自带的法语声音。
- **AI 短文**（`writeText`，`src/ai/tasks.ts`）：取最近答错的、今天到期的词（不够时从学习路线补，功能词除外），按起始等级和这些词的等级定难度，附中文译文和 3 道中文理解题。生成后由代码核对（`src/lib/reader.ts`）：查不到的词超过 20% 不保存；用上的目标词不到六成会重试一次，仍不到四成不保存。AI 写的内容未经人工核对，界面标「AI 生成」。

## AI 接口（拍照识别、生成卡片、图片、语音）
在「我的 → AI 接口」填自己的 Key，只存在本机浏览器里，不进备份。需要用 `npm run dev` 或 `npm run preview` 打开（本地服务里的 `ai-proxy.ts` 负责把请求转发到各家接口；静态部署没有这个转发）。

| 功能 | 可选服务 | 入口 |
|---|---|---|
| 拍照识别（课文、单词表、PDF） | OpenAI、Anthropic | 卡组 → 导入词 → 拍照识别 / 导入文件 |
| 生成卡片（释义、词性、例句） | DeepSeek、OpenAI、Anthropic | 导入词 → 整套生成 / AI 补全 |
| 生成图片 | OpenAI | 编辑词 → 图片 → AI 生成 |
| 朗读 | Azure AI Speech | 开启后，没有录音的词和例句用 Azure 朗读，按文字缓存在本机 |

扫描出错的词：词库、自建词和离线词典都确认不了拼写的词标「拼写未经核实」，默认不勾选，并给出相近的真实单词（会考虑 rn/m、cl/d、li/h 这类常见识别混淆，词表释义对得上的排在前面）；识图模型看不清的行标「照片上看不清」；点词头旁的铅笔可以直接改拼写，改完重新查词库和查重。

词条卡片（查词或学新词时）有「AI 讲解」：基本意思和用法、近义词及区别、反义词、常用搭配、注意点、词族；讲解存在本机，再打开不重复收费，搭配和注意点可以一键「加到卡片」。

加词或编辑词时可以填「常用搭配」和「注意点」，也可以点「AI 推荐搭配和注意点」从推荐里点选；导入时勾选「含搭配和注意点」，AI 补全会一起生成。

查重由代码按规则做（`src/lib/wordlist.ts`），不交给 AI：拼写完全相同且阴阳性不冲突的词直接关联已有词条；只差重音或阴阳性的词会提示“可能是同一个词”，由你决定；已在卡组的词不能重复加入。

## 导入新资料
见 `data/IMPORT.md`。模板：`data/imports/TEMPLATE.csv` 与 `TEMPLATE.json`。

## 数据目录
- `data/lexicon.json`：唯一真源
- `data/book-levels.json`：教材级等级依据（含原文页码）
- `data/gaps/`：缺口清单（完整词条名单）
- `data/READ-LOG.md`、`data/SOURCES.md`、`data/SCOPE-AND-GAPS.md`：读取、来源与缺口记录
- `output/`：端到端结果与浏览器对照截图；例句与词头修订日志（`fix-broken-examples.csv`、`fix-headwords-and-examples-r2.csv`）也在这里，不进 git
- 离线词典的原始数据不进 git，重建前先下载：
  - 维基词典：`curl -sSL https://kaikki.org/frwiktionary/raw-wiktextract-data.jsonl.gz | gunzip | python3 -I scripts/filter-wiktionary.py`（约 700 MB 流式读取，只留下有中文翻译的法语词 → `references/wiktionary/`）
  - Tatoeba：`https://downloads.tatoeba.org/exports/per_language/` 下的 `fra/fra_sentences.tsv.bz2`、`cmn/cmn_sentences.tsv.bz2`、`fra/fra-cmn_links.tsv.bz2` → `references/tatoeba/`
- `references/`：只有 `lexique/`（Lexique 3.83，CC BY-SA）进 git；教材 PDF（`books/`）和从中抽出的文本（`extracted/`）有版权，已忽略，需要本地自备
