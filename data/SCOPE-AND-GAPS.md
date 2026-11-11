# 范围、结论与明确缺口

实时数字见 [`data/STATS.md`](STATS.md)（由 `scripts/report-stats.py` 从 `data/lexicon.json` 生成）。

## 1. 交付范围（已确认）
参照 `references/books/` 下的**四本**教材：
1. Débutant（Claire Miquel，A1）— OCR
2. A2-B1 intermédiaire（Goliot-Lété & Miquel，B1）— OCR
3. avancé B2/C1.1（Miquel）— 文字层
4. Vocabulaire DELF B2 3000 mots（Mathieu）— OCR，连接词 + 主题词表 + Lexique

## 2. 已完成（有证据）
| 项 | 证据 |
|---|---|
| 四本书全部页面读取 | `references/extracted/*`、`data/READ-LOG.md` |
| DELF 连接词 34–43、主题词表 45–115、Lexique 116–139 导入 | 批次 TSV `data/batches/delf-*.tsv`、`data/import-log.jsonl` |
| 来源修复：build.py 显式 BOOK/OCR_FILE/LEVEL_BASIS 交叉校验 | `scripts/batch/gen/repair-sources.py`、`data/lessons/source-repair-r19.md` |
| 结构收尾（标题/冠词/重音变体/占位重复） | `scripts/structural-fix-r30.py`、`structural-revert-r30.py`、`output/r30-*.csv` |
| 误合并规则加词性保护 + 回归验证 | `scripts/check-structural-rule-r30.py` |
| r31 内容补齐（释义/例句/译文/词性/阴阳性） | `scripts/fill-gloss-r31.py`、`fill-pos-r31.py`、`fill-gender-r31.py`、`translate-batch1-r31.py`、`examples-supplement-batch1-r31.py`，日志 `output/r31-*.csv` |
| 不合并重音不同的词（tâche/tache 等） | `data/repairs/accent-splits.json`、测试 |
| 学习进度保留、ID 稳定 | `data/id-snapshot*.json`、`npm run lexicon:ids` |

## 3. 明确缺口（未完成）
| 缺口 | 说明 |
|---|---|
| 正文课文未整理为词条 | 四本书正文；入库以索引与词表为主 |
| 可学习词条缺例句 / 缺译文 | 数量见 STATS.md；补充例句标注 origin=supplement |
| 可见词条缺释义 | 真实词条按词典补；导语/标题/OCR 噪声只归类不补 |
| 逐词等级核实 | 仅教材级推定 |
| 练习/活动/测试页 | 未系统整理 |
| 人工核对 | 全部 `review=unreviewed`；自动化结果不标为人工确认 |

## 4. 冲突与警告
- 主题冲突：同一词形在不同教材章节主题不同，导入保留先写入的主题（DELF/Débutant/A2-B1 各若干）。
- 仅重音不同的词：作为独立词条保留（部分经原图确认同一词后合并）。
- 机器翻译/补充例句：均标注来源与「待核对」，未经专业译者或母语者确认。

## 5. 说明
- 本文件不宣称任何内容已全部核实。
- 旧版本的统计与结论保留在 git 历史和 `data/CONTINUE.md`，标为历史。
