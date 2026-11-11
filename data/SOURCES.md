# 词库来源与进度（当前统计）

以下数字由 `data/lexicon.json`、`public/atlas/index.json` 与 `data/gaps/` 当场统计，每次导入后应重新核对。范围与缺口见 `data/SCOPE-AND-GAPS.md`；读取证据见 `data/READ-LOG.md`。

## 来源文件（references/books/，共四本）
| 文件 | 等级（教材定位依据） | 页数 | 读取方式 | 索引覆盖率 |
|---|---|---|---|---|
| Débutant（Miquel，CLE） | A1（封面；前言「faux-débutant」） | 177 | OCR，平均置信度 0.937 | 98.4% |
| A2-B1 intermédiaire（Goliot-Lété & Miquel） | B1（封面「A2 B1」；前言「niveau B1」） | 212（2 页空白） | OCR，0.938 | 98.7% |
| avancé B2/C1.1（Miquel，CLE 2018） | B2/C1（前言「niveau B2/C1」） | 209 | 文字层 | 95.4%（488 条未检查） |
| Vocabulaire DELF B2 3000 mots（Mathieu） | B2（书名与目录） | 141 | OCR，0.894 | 100% |

## 词库统计（2026-11-06 重新统计）
- 可见词条：**7384**（不含别名）；别名（aliasOf，隐藏，保留 id）**1006**；id 总数 **8390**
- 按推定等级：A1 **2279**、A2 **153**、B1 **1650**、B2 **3283**、等级待核实 **19**（均为推定，逐词未核实）。等级先按所在教材定位，再用词频只做“向容易方向”的校正：每百万词 ≥300 次归 A1、≥100 次 A2、≥30 次 B1；多词搭配与无频率词不调整，不向难的方向调。
- 释义：可见词条全部有中文释义。其中约 270 条为 AI 补写（短语与 OCR 改正词），标记 `status: AI补写·待核对`，已自查一遍并修正 44 条；另用 Robert / Larousse 对约 5700 条待核对释义做了字符重合度比对，逐条复核重合度最低的约 630 条，修正 60 处（误译、混入的外文碎片）；约 100 个词头的拼写（缺重音等）按 Lexique 核对后改正，重复词条合并为别名
- 例句：约 1317 条补充译文已全部复核，修正约 100 条（误译、缺上下文、夹带页内编号、混入英文），不再显示“待核对”后缀；教材原例句译文未改动
- 本轮删除词条 56 条（整句说明/段落残片及无法辨认的碎片）；因拼写改正而重复的词条合并为别名
- 词性待核实：**0**（3 条已补）；名词未给阴阳性：**0**（3 条已补）
- 页码：约 260 条无页码（248 条来自 avancé 索引、12 条为作者补充）；教材 PDF 不在当前工作区，未能回填

## 学习路线顺序（词频）
- 学习路线按**语料词频**排序（高频在前），与英文版“常用词优先”一致；学习者选择的起点等级仍会过滤路线。
- 频率来源：**Lexique 3.83**（New, Pallier et al., www.lexique.org），CC BY-SA 4.0。原始文件 `references/lexique/Lexique383.tsv.gz`（取自 pylexique 1.5.1 安装包，内容未改动，仅 gzip 压缩；Latin-1 编码）。
- 计算：`npm run lexicon:freq`（`scripts/build-frequency.py`）→ `data/frequency.json`；指标为词元每百万词频率，取电影字幕（freqlemfilms2）与书面语（freqlemlivres）的平均值。每条记录注明匹配方式（lemma / lemma-accent / lemma-anypos / form / multiword）；固定搭配为估算值（其中最罕见实词 × 0.3）。
- 无频率的条目（缩写、专名、OCR 噪声、新词）排在有频率的条目之后，名单见 `data/gaps/frequency-missing.csv`。
- 仅在忽略重音后才匹配上的词头（疑似 OCR 丢失重音，如 bibliotheque → bibliothèque）列在 `data/gaps/spelling-suggestions.csv`，仅为建议，未改动词库。
- 重新生成：`npm run lexicon:freq && npm run lexicon:build`。

## 名词冠词（un / une）
- 阴阳性取自词库词性（n.m. / n.f. / n.m./f.），用 Lexique 3.83 独立核对：`npm run lexicon:nouns`（`scripts/build-nouns.py`）→ `data/nouns.json`。
- 词条页在名词前显示不定冠词（un / une / un/une / des），因为定冠词在元音前写作 l'，看不出阴阳性。
- un/une 题只出单一阴阳性、单数词头、阴阳性无争议的名词；成对词（ami/amie）、复数词头（vacances）、专名与缩写、已带冠词的词头、Lexique 只当虚词用的词（oui、deux）不出题。
- 与 Lexique 冲突的名词不出题，名单见 `data/gaps/gender-conflicts.csv`（多为词库词性错误，如 éolienne、aérogare、honoraires）。
- Lexique 主要当作其他词性使用的“名词”列在 `data/gaps/noun-pos-suspect.csv`，仅供核对（多数是真同形名词，如 un devoir、un son）。

## 动词变位（变位板块）
- 变位表由本项目自写的规则引擎生成（`scripts/conjugation/engine.ts`）：-er 规则及拼写变化（-cer、-ger、e→è、é→è、-eler/-eter、-yer）、-ir（finir 类），以及按 Bescherelle 思路整理的不规则动词模型；复合过去时由助动词 + 过去分词生成。
- 每个生成的形式都与 Lexique 3.83 的语料形式逐一比对：`npm run lexicon:conj`（`scripts/build-conjugations.ts`）→ `data/conjugations.json`、`public/atlas/conj.json`；不一致的列入 `data/gaps/conjugation-mismatches.csv`，该动词暂不出题。
- 只教 Lexique 中有形式可核对的动词（verified / partial）；Lexique 完全没有记录的词头（多为 OCR 损坏，如 entrarner、eviter）和引擎不支持的词头不出题。
- 已手工确认为 Lexique 标注错误而放行的两处写在脚本 `LEXIQUE_ERRORS` 中（laisser 虚拟式 1p、parier 未完成过去时 1p）。
- 1990 年拼写改革形式（préfèrerai、paye/paie、assois/assieds）作为可接受答案。

## 导入与核查
- 导入：四本索引均 `errors=0`；重复导入同一文件由哈希跳过；`--force` 不新增词条。
- 冲突（保留先写入的值）：主题冲突 Débutant 586、A2-B1 1097、avancé 26、DELF 633。
- 重音：不同重音的词分开存放（如 tâche / tache）；已拆分 19 处，记录见 `data/repairs/accent-splits.json`。
- ID：既有 ID 不变（`npm run lexicon:ids` 校验）。2026-11-06 删除 56 个 id、改名约 90 个 id，快照已重新生成（8390 条）。

## 未完成
约 270 条 AI 补写释义仅经自查、未经词典核对；约 260 条缺页码；19 条等级待核实；avancé 索引 488 条未检查。正文课文未整理为词条。完整清单见 `data/gaps/` 与 `data/SCOPE-AND-GAPS.md`。

## 音标（IPA）
`data/ipa.json` 由 Lexique 3.83 的 phon 列（CC BY-SA 4.0）经固定对照表转换为 IPA，`scripts/build-ipa.py` 生成。词组为逐词拼接，未处理连诵（liaison）；无把握的词不给音标，清单见 `data/gaps/ipa-missing.csv`。

## 例句高亮
`data/highlights.json` 用 Lexique 3.83（CC BY-SA 4.0）的「词形→词元」对照，在每条例句里定位词条或其变位形式（veux → vouloir），`scripts/build-highlights.py` 生成。找不到时页面只做精确拼写匹配，找不到就不高亮。
