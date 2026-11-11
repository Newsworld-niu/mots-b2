# 词库导入说明

词库的唯一真源是 `data/lexicon.json`。前端数据 `public/atlas/` 由 `npm run lexicon:build` 从它生成，不要手工编辑。

## 1. 文件格式

模板：`data/imports/TEMPLATE.csv`（CSV，UTF-8）与 `data/imports/TEMPLATE.json`（数组，或 `{ "rows": [...] }`）。

| 字段 | 必填 | 说明 |
|---|---|---|
| `lemma` | 是 | 词典形式，保留重音。动词用不定式（-er/-ir/-re/-oir），否则给出警告 |
| `pos` | 是 | `n.m.` `n.f.` `n.m./f.` `n.`（阴阳性未给出）`v.` `adj.` `adv.` `loc.`（短语）`loc. adv.` `prép.` `conj.` `pron.` `interj.` `待核实` |
| `level` | 否 | `A1` `A2` `B1` `B2` `C1` `C2` 或 `unverified`（默认）。**不要把教材封面等级填到每个词上** |
| `level_basis` | 否 | 等级依据，如「书内标注 A2，已对照原页」 |
| `topic` | 是 | `work` `economy` `education` `health` `environment` `society` `media` `travel` `emotion` |
| `zh` | 补充内容必填 | 中文释义。书籍来源可留空（显示「释义待补充」） |
| `fr_def` | 否 | 简短法语释义 |
| `example_fr` / `example_zh` | 否 | 一条例句及译文 |
| `col` `fam` `syn` `ant` | 否 | 列表，CSV 中用 `｜` 或 `|` 分隔 |
| `tip` `note` | 否 | 用法提示；`note` 记录形式（如 `(e)`）、代词式、俗语标记、索引页码 |
| `origin` | 是 | `book`（来自书）或 `supplement`（补充） |
| `book` | 是 | 来源文件名；补充内容固定填 `author-supplement` |
| `kind` | 否 | `index` `theme-list` `lesson` `author-supplement` |
| `chapter` | 否 | 章节名 |
| `printed_page` / `pdf_page` | 书籍必填其一 | 印刷页码与 PDF 页序要分开记录 |
| `review` | 否 | `unreviewed`（默认）或 `checked` |

## 2. 命令

```bash
npm run lexicon:import -- data/imports/<file>.csv --dry-run   # 只检查，不写入
npm run lexicon:import -- data/imports/<file>.csv             # 写入 data/lexicon.json
npm run lexicon:check                                          # 完整性报告
npm run lexicon:build                                          # 生成 public/atlas/
```

## 3. 导入时的检查规则

- **错误（整批拒绝，词库不写入任何一行）**：缺少词形、词性/等级/主题不在允许列表、`origin` 与 `book` 不匹配、补充内容缺释义、生成后的完整性检查失败。
- **警告（允许写入）**：动词不是不定式、书籍来源缺页码、书中无法语释义、书中无中文释义。
- **冲突（保留已有值，并在报告中列出）**：同一词形的等级、主题、拼写（重音）与已有条目不同。

## 4. 去重与稳定 ID

- 同一**规范化词形**（去重音、去撇号差异、小写）+ **词性**（含阴阳性）= 同一个词条。
- 同形异义（阴阳性或词性不同，如 `mémoire` 阴性/阳性）= 两个词条，第二个获得新 ID（如 `memoire-m`）。
- 同一词条的新释义（中文不同）作为新义项追加，不新建词条。
- 已有词条的 ID 永不改变；新词条 ID 由词形 slug 生成，冲突时加后缀。
- **幂等**：同一文件的内容哈希写入 `data/import-log.jsonl`，再次导入直接跳过；`--force` 强制重跑时，已有内容不会重复建条（已验证：强制重跑新增 0 条）。

## 5. 修改已有数据

请直接在导入文件里修正并重新导入，或在 `lexicon.json` 中手工修改后运行 `lexicon:check`。不要删除行来"撤销"导入：导入日志只记录哈希，不能回滚。

## 6. 模板示例

`TEMPLATE.csv` / `TEMPLATE.json` 中的示例词（épargne、ralentissement）在词库中可能已经存在，导入时会被合并（显示 updated）。请复制模板后改成自己的词再导入。
