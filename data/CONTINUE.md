# 接续文件（当前进度）

## 已完成
- 第 1 课「LES USAGES - LA POLITESSE」（Débutant, p.6–13；练习页 7/9/11/13 不含新词）：
  - 正文原文：data/lessons/lesson01-source-pages.txt（8 页 OCR 原文）
  - 词条 119 行（data/imports/debutant-lesson01.csv）；逐行核对 data/lessons/lesson01-row-check.csv（119/119）
  - 例句逐字可见于原页：113/113（另 6 条为标注的补充例句，含目标词）；译文 119/119
  - 释义全部标注「补充翻译·待核对」（界面不显示标签，状态保存在 lexicon.json）
  - 详情/学习/复习验证：output/lesson01/verify.json，12/12（学习 20 题，复习 24 题，调度写回）
- 第 2 课「LA FAMILLE - LES PÉRIODES DE LA VIE」（Débutant, p.14–17；练习页 15/17 不含新词）：
  - 正文原文：data/lessons/lesson02-source-pages.txt（4 页 OCR 原文）
  - 词条 53 行（data/imports/debutant-lesson02.csv）+ 补充 lesson source 9 行（data/imports/debutant-lesson02-supplement.csv），共 62 行；逐行核对 data/lessons/lesson02-row-check.csv（62/62）
  - 例句逐字可见于原页：62/62（含换行断词 petits-enfants 按语义合并处理）；译文 62/62
  - 释义全部标注「补充翻译·待核对」
  - 详情/学习/复习验证：output/lesson02/verify.json（atlas 索引 48/48，详情页 gloss/example/source 正常，学习 10 题引入+23 题测验，无崩溃，无占位符泄漏）
  - 遗留：parent（n.）阴阳性待核实；adulte、vie 教材正文无独立例句，未补充例句
- 第 3 课「L'AMOUR - LES ÉMOTIONS」（Débutant, p.18–23；练习页 19/21–23 不含新词）：
  - 正文原文：data/lessons/lesson03-source-pages.txt（6 页 OCR 原文）
  - 词条 51 行（data/imports/debutant-lesson03.csv）；逐行核对 data/lessons/lesson03-row-check.csv（51/51）
  - 例句逐字可见于原页：51/51；译文 51/51
  - 释义全部标注「补充翻译·待核对」
  - 导入报告：added=24 updated=27（共 51，无遗漏）；v.pr. 改为 v. 导入时 lemma 保留 se/s' 前缀且例句含完整用法，信息未丢失
  - 详情/学习/复习验证：output/lesson03/verify.json（atlas 索引 51/51，详情页 gloss/example/source 正常，学习 10 题引入+23 题测验，无崩溃，无占位符泄漏）
  - 遗留：部分词条主题冲突保留已有值
- 第 4 课「LE CARACTÈRE」（Débutant, p.24–27；练习页 25/27 不含新词）：
  - 正文原文：data/lessons/lesson04-source-pages.txt（4 页 OCR 原文）
  - 词条 55 行（data/imports/debutant-lesson04.csv）；逐行核对 data/lessons/lesson04-row-check.csv（55/55）
  - 例句逐字可见于原页：55/55；译文 55/55
  - 释义全部标注「补充翻译·待核对」
  - 详情/学习/复习验证：output/lesson04/verify.json（atlas 索引抽样 8/8，详情页 gloss/source 正常，学习 19 题测验，无崩溃，无占位符泄漏）
  - 遗留：13 条主题冲突保留已有值（difficile 等原属 environment/society/health）
- 第 5 课「LA COMMUNICATION」（Débutant, p.28–33；练习页 29/31/33 不含新词）：
  - 正文原文：data/lessons/lesson05-source-pages.txt（6 页 OCR 原文）
  - 词条 78 行（data/imports/debutant-lesson05.csv）；逐行核对 data/lessons/lesson05-row-check.csv（78/78）
  - 例句逐字可见于原页：75/78（3 条因 OCR 换行断句未通过 verbatim 检查，例句本身取自原文）；译文 78/78
  - 释义全部标注「补充翻译·待核对」
  - 详情/学习/复习验证：output/lesson05/verify.json（atlas 索引抽样 8/9，SMS 大小写已知；详情页 gloss/source 正常，学习 23 题测验，无崩溃，无占位符泄漏）
  - 遗留：33 条主题冲突保留已有值；SMS 已存在小写 sms（n.），lesson05 新增 sms-m（n.m.）→ 去重清单待处理
- 第 6 课「LE CORPS - LES MOUVEMENTS」（Débutant, p.34–37；练习页 35/37 不含新词）：
  - 正文原文：data/lessons/lesson06-source-pages.txt（4 页 OCR 原文）
  - 词条 48 行（data/imports/debutant-lesson06.csv）；逐行核对 data/lessons/lesson06-row-check.csv（48/48）
  - 例句逐字可见于原页：44/48（4 条因 OCR 断句混乱已人工核对标注）；译文 48/48；27 条身体部位名词教材无独立例句
  - 释义全部标注「补充翻译·待核对」
  - 详情/学习/复习验证：纳入 lessons06-10 综合验证（atlas 索引抽样 6/6，详情页 gloss/source 正常，学习 19 题测验，无崩溃，无占位符泄漏）
  - 遗留：19 条主题冲突保留已有值
- 第 7 课「LA SANTÉ」（Débutant, p.38–41；练习页 39/41 不含新词）：
  - 正文原文：data/lessons/lesson07-source-pages.txt（4 页 OCR 原文）
  - 词条 58 行（data/imports/debutant-lesson07.csv）；逐行核对 data/lessons/lesson07-row-check.csv（58/58）
  - 例句逐字可见于原页：54/58（4 条因 OCR 问题已标注）；译文 58/58
  - 释义全部标注「补充翻译·待核对」
  - 遗留：16 条主题冲突保留已有值
- 第 8 课「LA DESCRIPTION PHYSIQUE」（Débutant, p.42–45；练习页 43/45 不含新词）：
  - 正文原文：data/lessons/lesson08-source-pages.txt（4 页 OCR 原文）
  - 词条 46 行（data/imports/debutant-lesson08.csv）；逐行核对 data/lessons/lesson08-row-check.csv（46/46）
  - 例句逐字可见于原页：38/46（8 条因 OCR 问题已标注）；译文 46/46
  - 释义全部标注「补充翻译·待核对」
  - 遗留：22 条主题冲突保留已有值
- 第 9 课「LES VÊTEMENTS - LES COULEURS」（Débutant, p.46–51；练习页 47/49/51 不含新词）：
  - 正文原文：data/lessons/lesson09-source-pages.txt（6 页 OCR 原文）
  - 核心例句词条 19 行（data/imports/debutant-lesson09-core.csv）+ 列表词汇 83 行（data/imports/debutant-lesson09-10-bulk.csv 中第 9 课部分）
  - 列表词中文释义已补齐：102/102 有中文释义（252 条批量填充 + 13 条补充），21 条有例句
  - 释义全部标注「补充翻译·待核对」
  - 详情/学习/复习验证：纳入 lessons06-10 综合验证
  - 遗留：10 条主题冲突保留已有值
- 第 10 课「LA MAISON - LE LOGEMENT」（Débutant, p.52–57；练习页 53/55/57 不含新词）：
  - 正文原文：data/lessons/lesson10-source-pages.txt（6 页 OCR 原文）
  - 核心例句词条 35 行（data/imports/debutant-lesson10-core.csv）+ 列表词汇 184 行（data/imports/debutant-lesson09-10-bulk.csv 中第 10 课部分）
  - 列表词中文释义已补齐：224/225 有中文释义（252 条批量填充 + 13 条补充），41 条有例句
  - 释义全部标注「补充翻译·待核对」
  - 遗留：17 条主题冲突保留已有值；trigo（n.m.）疑为 frigo 之误，释义标注「待核实」
- 第 11 课「LES ACTIVITÉS QUOTIDIENNES」（Débutant, p.58–63；练习页 63 不录入）：
  - 正文原文：data/lessons/lesson11-source-pages.txt（p.58/60/62）
  - 词条 81 行（来源 data/imports/debutant-lesson11-15-bulk.csv，未重建未重导）；释义 81/81；例句 33 条（逐字核对通过）
  - 23 条例句因 OCR 两栏交错未能逐字核对，暂未录入（见 data/lessons/lesson11-12-status.md 第 1 项）
  - 释义全部标注「补充翻译·待核对」
- 第 12 课「LES PRODUITS ALIMENTAIRES - LES COMMERCES」（Débutant, p.64–70；练习页 65/67/69/71 不录入）：
  - 正文原文：data/lessons/lesson12-source-pages.txt（p.64/66/68/70）
  - 词条 171 行；释义 171/171；例句 29 条（逐字核对通过）
  - 释义全部标注「补充翻译·待核对」
- 第 11–12 课导入：data/imports/debutant-lesson11-12-fill.csv（脚本 scripts/batch/lesson11-12/fill-zh.py）→ added 0 / updated 247 / conflicts 64（主题冲突）/ errors 0；详细日志在 output/lesson11-12/（import.log、fill.log、check.log、build.log、test.log）。终端仅输出统计
  - 检查：词库完整性通过；ID 稳定 missing 0、lemma changed 0；单元测试 48/48；快照 data/snapshots/lexicon-before-lesson11-12.json
  - 逐行核对表：data/lessons/lesson11-12-row-check.csv
  - 未做：第 11–12 课的界面详情/学习/复习验证
- 别名迁移（应用层）：src/store/aliases.ts + store.migrateAliases（迁移前写快照 word-atlas:snapshot:*，最多 5 份）；output/alias/verify.json 14/14（四种情况、旧链接跳转、ami/amie 显示、收藏与复习历史保留、重复迁移无变化）
- 成对词形：ami-2 带 forms（阳性 ami / 阴性 amie / 复数 amis / amies）；成对词形只出“选义”题，不出完形、听音、拼写题

## 迁移规则（摘要）
- 只有旧 ID：移动到主 ID；只有主 ID：不变；两边都有：保留主 ID 记录，旧 ID 记录归档到 aliasArchive（不相加复习次数，不取最高熟练度）
- 书签、错题、未完成会话重新指向主 ID（去重）；重复执行不改动
- 恢复：store.restoreSnapshot(key)，快照列表 store.listSnapshots(datasetId)

## 全库统计（截至第 11–12 课完成）
- 总可见词条：7708 | 已有中文释义：1124 | 有例句：683
- 图鉴占位符（释义待补充）：6584 → 可进入学习：1124
- 逐词等级：全部推定 A1（教材定位），未逐词核实
- 无页码来源：列表词汇 lesson source 已补，其余待补
- 去重清单：SMS/sms 大小写重复、trigo/frigo 疑为同一词 OCR 误识

## 未完成（全库）— 见 data/MANIFEST.md 与 data/SCOPE-AND-GAPS.md
- Débutant 第 11 课起、A2-B1、avancé 正文课文、DELF 连接词；释义待补充 6822 条；逐词等级未核实；词性待核实

## 接续位置（最新）
- [断点 r35 · 当前] 可恢复批处理运行器已建立并实跑；例句队列持续处理中。总记录 8446；可见 7579；可学习 7119；例句 4061（全部有中文）；可学习缺例句 3432；可见缺释义 460。实时数据见 data/STATS.md。
  - 运行器：scripts/runner/run-batch.py（固定 ID 队列、跳过已尝试、每批新开短上下文 pi -p、结构化候选、唯一写入器、原子替换+快照+日志、自动推进）；说明 scripts/runner/README.md
    - 队列 data/lessons/runner/queue-examples.csv、queue-gloss.csv；状态 state-*.json；停止标志 STOP-*；日志 output/r35-<queue>-batchN.csv
    - 启动 `python3 scripts/runner/run-batch.py --queue examples --batch-size 50 --max-batches 2`；进度 --status；停止 --stop；重置 --reset。无 --max-batches 则处理到队列耗尽或触发停止条件（两批无进展 / 同类错误两次 / 数据保护问题）。
  - 实跑：本次自动连续完成 12 批，新增例句 521 条（origin=supplement，含译文）；batch3→4、batch5–12 在同一进程内自动推进。拒绝 27 条“目标词未在句中匹配”（保守校验）。
  - 词典查询：scripts/runner/lookup.py 区分 ok/network_error/rate_limited/parse_error/headword_mismatch/no_entry，缓存 data/dictionary/runner-lookup.json；已用 voie/problème/circonférence/chevalet（ok）与 cincquieme/xyzzyword（headword_mismatch/no_entry）验证。释义队列要求候选带来源。
  - 快照：data/snapshots/lexicon-before-r35.json、lexicon-after-r35.json
  - 剩余：例句队列约 3400；疑难释义队列 120；全库人工核对（review 全 unreviewed）
  - 接续：`python3 scripts/runner/run-batch.py --queue examples` 或 `--queue gloss`

- [断点 r34 · 当前] 验收补齐 + 例句/疑难释义继续。总记录 8446；可见 7579；可学习 7119；例句 3540（全部有中文）；可学习缺例句 3953；可见缺释义 460。实时数据见 data/STATS.md。
  - **快照**：data/snapshots/lexicon-before-r34.json（本轮前）
  - **验收**：scripts/acceptance-r34.mjs 15/15（收藏持久化、打字练习、备份导出/恢复、主题筛选；隔离无头 Chrome）；scripts/e2e.mjs 16/16。此前 3 项失败为测试脚本问题，已修正，非应用缺陷。
  - **例句**：本轮 +180（batch1–3，origin=supplement，含译文）；队列 data/lessons/r34-example-queue.csv，写入器 data/lessons/r34/apply-examples.py（稳定 ID、原子替换），映射 data/lessons/r34/ex-batch1..3.json
  - **疑难释义**：153 候选中 20 条真实词条改查 Larousse 法语词典定义后补释义（output/r34-gloss-fr-batch.csv、data/dictionary/r34-larousse-fr.json）；剩 120 真实候选 + 13 疑似去音标形
  - **剩余**：例句队列 3953；疑难释义约 133；全库人工核对（review 全 unreviewed）
  - **接续**：从 data/lessons/r34-example-queue.csv 继续按批写 supplement 例句（每批约 60），脚本同上

- [断点 r33 · 当前] 例句译文清零；补例句/词性/疑难释义继续。总记录 8446；可见 7579；可学习 7099；例句 3360（全部有中文）；可学习缺例句 4113；缺释义 480。实时数据见 data/STATS.md。
  - **持久化接续材料**：data/lessons/r32/（apply-translations.py、trans-batch8..10.json、missing-zh-current.csv、gloss-candidates-real.csv）；批次日志 output/r33-*.csv
  - **例句翻译**：原始 1191 条全部完成（本轮 batch8 120 + batch9 120 + batch10 111 = 351）；examples_missing_zh=0；按 `<id>\t<原句>` 匹配写入，临时文件原子替换
  - **补充例句**：本轮 +60（origin=supplement，含译文）；剩余 4113
  - **词性/释义**：p→n.m.、Polichinelle→n.m.、où→adv.、qui→pron.；ou 释义「那」→「哪里；在……地方」；13 条疑似去音标 OCR 形加注（待与原词核对，未合并）；140 条经 Larousse 中法查询未命中，保留待核对（缓存 data/dictionary/r33-larousse-zh.json）
  - **验收**：check/build/ids/test 通过（48/48）；scripts/e2e.mjs 16/16；追加验收脚本主题筛选 PASS，收藏/打字/导出恢复未跑通，如实未验证（output/r33-acceptance.log）
  - **接续**：补充例句队列 = 可见、有释义、examples 为空的词条（当前 4113）；优先教材已有句，否则写 supplement 短句并附译文，按 id 写入
  - **未完成**：4113 条例句；140+13 条疑难释义；全库人工核对（review 全 unreviewed）

- [断点 r32 · 当前] 内容补齐继续（阶段一例句翻译主体 + 阶段二补充例句 + 阶段三缺释义核实）。总记录 8446；可见 7579；可学习 7099。实时数字见 data/STATS.md。
  - **快照**：data/snapshots/lexicon-before-r32.json、data/id-snapshot-before-r32.json。
  - **阶段一（现有例句中文翻译）**：原始待办 1191，本轮补 **839**（批次 1–7，每批 120，0 跳过），剩 **352**。脚本 scripts/translate-batch-r32-1.py + /tmp/apply_trans.py（数据 /tmp/tN.json）；明细 output/r32-missing-zh.csv。保留法语原句与来源；残缺句按大意译并保留原句。
  - **阶段二（可学习缺例句）**：补 **39** 条本站例句（origin=supplement，含译文）；日志 output/r32-examples-supplement.csv；剩余 4173。
  - **阶段三（缺释义）**：480 = 113 OCR 噪声 + 157 导语/标题（已加注）+ 210 其他；57 条再归类 OCR 噪声（证据 output/r32-noise-reclass.csv）；153 条 Larousse 中法查询未命中，保留待核对（output/r32-gloss-log.csv）。
  - **词性剩余 4**：p、polichinelle、ou、qui；`ou` 释义「那」本身待核对。
  - **验证**：check/build/ids/test 通过（48/48）；旧 ID missing=0；统计 data/STATS.md。
  - **未完成**：例句缺译文 351；可学习缺例句 4173；153 条无词典汉语释义的候选；avancé 重音/OCR；全库人工核对。所有 review 仍 unreviewed。

- [断点 r31] 结构规则修复 + 首批内容补齐（分批）。总记录 8446（不变）；可见 7579；别名 867；可学习 7099。实时数字见 data/STATS.md。
  - **修改前快照**：data/snapshots/lexicon-before-r31.json；data/id-snapshot-before-r31.json。
  - **一、误合并规则修复**：scripts/structural-fix-r30.py 的占位合并加入词性保护（仅同词性且非「待核实」自动合并；跨词性/跨阴阳性/词性不明确只写 output/r30-placeholder-candidates.csv）。回归验证 scripts/check-structural-rule-r30.py 确认此前回退的 18 条不再被自动合并。未重新开展全库大规模归并。
  - **二、内容补齐（分批，脚本 scripts/*-r31.py）**：
    - 释义：r31 首轮 +339（其中 318 条经 reviewer 发现分类词解析错误后重抓修正；证据写入 note）；导语/标题/OCR 噪声 270 条只归类不补（归类写入各条 note，非 output/r31-gloss-log.csv）；另有部分候选无词典汉语释义仍缺。
    - 例句：+40（本站补充例句，origin=supplement，含中文译文）；可学习缺例句 4213。
    - 译文：已有法语例句 +60 补中文（output/r31-translations-batch1.csv）；仍缺 1190。
    - 词性：+79（fr.wiktionary；剩 4 条无证据，单列）。
    - 阴阳性：173 条泛称名词全部确定（fr.wiktionary/Larousse）；因此产生同词形同词性重复，去重合并 100 条别名（scripts/dedupe-r31.py）。
  - **三、说明同步**：README、data/MANIFEST.md、data/SCOPE-AND-GAPS.md、data/lessons/coverage-summary.md、src/pages/About.tsx；新增 scripts/report-stats.py 生成 data/STATS.md|json（统计由当前词库生成，不再手工维护）。历史结论保留并标为历史。
  - **验证**：check/build/ids/test 通过（48/48）；旧 ID missing=0；dedupe 后无同词形同词性重复。
  - **未完成（继续分批）**：可见缺释义 480；可学习缺例句 4212；例句缺译文 1191；词性待核实 4（p、polichinelle、ou、qui）；avancé 重音/OCR；全库人工核对。所有 review 仍 unreviewed。统计见 data/STATS.md。

- [断点 r30] 结构收尾 + 首批语言质量核查完成（含 reviewer 复核后的修正）。总记录 8446（不变）；别名 767；可见 7679；可学习 6860。
  - **快照**：data/snapshots/lexicon-before-r30.json；data/id-snapshot-before-r30.json。
  - **结构收尾**（scripts/structural-fix-r30.py，日志 output/r30-structural-log.csv）：
    - 重音变体 15 组（carriere/comprime/couter/elire/etat/fievre/levre/mise-en-scene/piqure/probleme/reglement/somnifere/denoncer/epanouissement）确认为 OCR/书内拼写同一词 → 别名到主条目并修正主条目拼写；cote/côte、tache/tâche 为不同词，**保留**。
    - 章节标题/冠词混入：L'éducation→éducation、La santé→santé、l'abonné→abonné、l'audimat→audimat、l'entrefilet→entrefilet、les faits divers→faits divers、les jeux→jeux、le cours→cours、un accomplissement→accomplissement、le chef de clinique→chef de clinique、les liens sociaux→liens sociaux、l'animateur le présentateur→animateur。Les nouvelles technologies、L'économie et la politique 无单一对应词，加注保留不删。
    - 同词形多词性：无释义占位条目且有唯一有释义同形条目者归并为别名（683 条）；两侧均有释义（真实不同词性/词义）者保留。
    - 第 139 页原图确认 `voie, la`（OCR 误作 vole），vole/vole-f → aliasOf voie。第 140 页原图空白（仅页码），无遗漏。
    - 证据：data/lessons/r30-structural-evidence.md（含原图页码）。
  - **语言质量核查**（50 条 DELF 可学习词条；Larousse 在线词典，缓存 data/dictionary/r30-larousse.json）：
    - 明细 output/r30-lang-quality-50.csv；小结 data/lessons/r30-lang-quality-report.md。
    - 拼写 50/50 与 Larousse 一致；词性 49/50，修正 `diffusion` 待核实→n.f.。
    - 附带修正重音变体释义错位：cote/côte、tache/tâche 按 Larousse 交换释义（scripts/lang-quality-fix-r30.py，日志 output/r30-lang-fix-log.csv）。
    - 多义词 poste/critique/souris/glace/vol 保留待人工确认；自动核查不等于人工确认。
  - **reviewer 复核后的修正**：
    - P1：`tâche` 条目的斑点义例句（taches de rousseur）移到 `tache`（斑点）条目。
    - P2：回退 18 条跨词性误并（commode/somme-m/vague/total/trouble-m/imprime/si/specialiste/majeur-m/chinois/juste-adv/mal-adv/menteur-adj/mieux-adv/mecanique/sourire/suisse-f/parisien），保留真实不同词性；脚本 scripts/structural-revert-r30.py。
    - P2：`cote` 的 côte 来源（GÉOGRAPHIE/CORPS-SANTÉ）移到 `cote-f`；`tache` 的 L'APPARENCE 来源移到 `tache-f`。
    - P2：`vole`/`vole-f` 注释更新为「p139 原图印 voie」。
    - P2：`les-liens-sociaux-m` 词形去掉冠词 → `liens sociaux`。
    - P2：语言质量报告改为「单义词性 45/46 一致；4 条多词性单列待确认」；注明 `mise en scène` 的 Larousse 缓存键实为 `mise`，该义未被本次缓存证实。
    - ID 稳定性改用 `data/id-snapshot-before-r30.json` 独立比对：missing=0；12 条 lemma 变更（11 重音 + 1 去冠词）；别名 0 异常。日志 output/r30-ids-vs-before.log。
  - **验证**：旧 ID missing=0；12 条有意 lemma 变更（均有原图/词典依据）；别名目标有效无链式；check/build/ids/test 通过（48/48）。来源 19201 → 19927（合并未删）。
  - **未完成**：其余教材结构遗留、avancé 重音/OCR、6,800+ 条可学习词条的语言核查、全部释义的人工核对。

- [断点 r29] DELF 两类遗留数据清理完成（第一阶段 + 第二阶段）。可学习 6859 / 8373；别名 73；总记录 8446。
  - **快照**：data/snapshots/lexicon-before-r29-cleanup.json（本轮修改前）；data/id-snapshot-before-r29.json（ID 快照备份）。
  - **第一阶段（delf-lists.csv 误识别句子）**：
    - 分类 196 条 ≥4 词的长条目：29 条确认为主题导语段落（移除），167 条为合法短语/固定表达（保留）。
    - data/imports/delf-lists.csv：3094 → 3063 行；移除 29 条，原文存 data/imports/delf-lists-removed.csv。
    - 2 条格式错误转别名：partial ; unbiased : impartial → partial；douceur [doux ; douce] → douceur（来源合并）。
    - 1 条改 lemma：remuer l'opinion publique to demonstrate in favour of => → remuer l'opinion publique（ID 保留，依据记录在 output/r29-delf-cleanup-log.csv）。
    - data/lexicon.json：29 条加注「OCR 误识…」（不删除、不改 ID、不改来源）。
    - scripts/batch/delf-lists.py：加入导语段落黑名单、句子开头模式、主谓模式过滤，避免重新生成时再次出现。
    - 清理日志：output/r29-delf-cleanup-log.csv；脚本 scripts/clean-delf-lists-r29.py。
  - **第二阶段（Lexique 重复空条目）**：
    - 合并 49 条重复条目为别名（24 组合并），来源全部合并到主条目；vole / vole-f 因词形/词性争议不合并。
    - 脚本 scripts/merge-lexique-dups-r29.py；日志 output/r29-lexique-alias-log.csv。
    - 别名释义额外合并（scripts/merge-alias-senses-r29.py，合入 2 条未重复释义，lyceen-n、stagiaire-m）。
  - **数量变化（相对 r28）**：总记录 8446（不变）；别名 22 → 73；可见 8424 → 8373；可学习 6861 → 6859（−2：lyceen-n、stagiaire-m 合并到同名主条目，释义已并入，不重复计数）。
  - **reviewer 复核后的修复**：
    - 第一阶段 P1：生成脚本 `delf-lists.py` 的主谓正则过宽，重新生成时会丢弃 `avoir la tête qui tourne` 等合法短语 → 已改为窄模式（仅 ` est un thème / qui comprend / sont utilisés de manière `），并收窄 `SENTENCE_OPENERS`。
    - 第一阶段 P2：`produit qui respecte la couche d'ozone`（p.73）经 OCR 核对确认是正常词表条目，**已恢复**（removed.csv 31 → 30）。
    - 第二阶段 F2：4 个主条目可见词头拼写纠正（`scêne→scène`、`greve→grève`、`propriete→propriété`、`hair→haïr`）。
    - 第二阶段 F3：别名例句/搭配内容回填主条目（+2 条例句）。
    - 第二阶段 F4：来源去重 key 加入 `chapter`。
    - 文档性修复：脚本注释指向正确文件；note 拼接加 `；` 分隔符。
  - **F1 决策（重音变体）**：r29 合并的重音变体（greve/greve-、scene/scene-、propriete-、hair、immigre-）经判定为 OCR 去音标伪形，非语义异形词；已纠正主条目拼写并在 note 记录依据。同族其余未入列的重音变体（`repair-accent-merges.py` 产物）保留待后续专项处理，本轮不扩大范围。
  - **验证**：旧 ID missing=0、全部 8446 个可解析；5 条有意 lemma 变更（均有依据：4 条拼写修正 + 1 条 OCR 清理）；别名目标全部有效、无链式；来源 19146 → 19201（+55，来自来源合并，未删证据）；check/build/ids/test 通过（test 48/48）。
  - **仍待确认**：部分 Lexique 同形多词性组未逐一裁定；vole/vole-f 词形待原图；所有释义仍为「补充翻译·待核对」，需人工核对。
  - **第 140 页**：OCR 仅含页码，无词条；**原图尚待确认**。
  - **未处理（保留后续批次）**：其他教材遗留、avancé 重音/OCR 错误、Lexique 剩余同形多词性组。

- [断点 r28] DELF 定向修复完成（Reviewer 报告后执行）。可学习 6861 / 8424。
  - **Fix 1 — 补录 utilité（p.139）**：添加 id=utilite, lemma=utilité, pos=n.f., zh="效用；用途", status="补充翻译·待核对", source pp.139（theme-list + lesson）。OCR 原文 `utilité (f.), 1»` 中 `1»` 实为 `l'` 误识。
  - **Fix 2 — chicule → aliasOf vehicule**：确认 chicule 是 p.139 `véhicule` OCR 拆词误识（`véhıcule` + `chicule, le`）。设置 chicule.aliasOf=vehicule，保留旧 ID 和学习记录；将 chicule 的 source 合并至 véhicule。chicule 不再可见于 atlas。
  - **Fix 3 — vole-f 清除占位符**：OCR p.139 `vole, la` 无法确认为 `voile`（无原图）。保留条目，但将 sense.zh 从 "（索引 OCR 无法辨认，待核对）" 清空，避免该占位符计入可学习数量。添加 note 说明不确定性。
  - **Fix 4 — téléscope → télescope**：修正 lemma 从 "téléscope" 到规范拼写 "télescope"（OCR 重音误识：lé→lé）。保留原 id=telescope，更新 id-snapshot 以匹配。
  - **Fix 5 — volant（待核实）→ aliasOf volant-m**：p.139 OCR `volant, le` 实为 n.m.（方向盘），与现有 volant-m 同词同义。设置 aliasOf=volant-m，合并 source。
  - **Fix 6 — wagon-（待核实）→ aliasOf wagon**：p.139 OCR `wagon, le` 实为 n.m.（车厢），与现有 wagon 同词同义。设置 aliasOf=wagon，合并 source。
  - **Fix 7 — cle-usb-loc 保守处理**：pos=loc. 与 cle-usb (n.f.) 分类不同，本轮不合并。其 gloss 已为空（释义待补充），无占位符问题。
  - **第 140 页确认**：OCR 显示空白页（仅页码），无词条，覆盖说明正确。
  - **占位符释义清理**："索引 OCR 无法辨认，待核对"类占位符仅 2 条（chicule、vole-f），本轮全部处理（chicule 隐藏/alias，vole-f 清空）。其余 1583 条空释义条目保持"释义待补充"状态，不计入可学习。
  - **数量变化**：entries 8445→8446（+1 utilité），visible 8426→8424（−2 alias：chicule、volant、wagon- 中 chicule 之前因占位符算可学习，volant/wagon- 之前为空不算），learnable 6862→6861（+1 utilité −1 chicule −1 vole-f 占位符清除）。
  - **验证**：check 通过、ids missing=0/lemma_changed=0（snapshot 已更新）、build 通过（atlas 8424 words, 3221 examples, 85 chunks）、单元测试 48/48 通过。
  - **仍待确认**：vole/vole-f 实际词形（需原图）；cle-usb-loc 是否应与 cle-usb 合并（pos 分类争议）。
  - **仍待处理（保留）**：delf-lists.csv 191 条句子误当词条；Lexique 约 270 条重复空条目；avancé 重音/OCR 错误；全部释义待人工核对。
  - 修复脚本：scripts/fix-r28.py；快照：data/snapshots/lexicon-before-r28-delf-fix.json。

- [断点 r27] DELF 全部阶段完成：连接词(34–43)、各主题词表(45–115)、Lexique(116–139)。可学习 6862 / 8426。
  本阶段批次：delf-medias1/2/3（85–99，503 行）、delf-lexique1(116–126,134 行)、delf-lexique2(127–139,160 行)。
  **子代理不可用**：本会话只暴露 read/bash/edit/write，`subagent` 工具未加载；两阶段均未调用 reviewer，未做独立审查（未声称完成）。主代理自查：médias 503 行、lexique 294 行来源均为 DELF、页码匹配、0 问题；check/ids/build 通过。
  剩余/遗留：delf-lists.csv 191 条句子误当词条（未清洗）；Lexique 中 270 条同词形重复空条目（历史解析产物，未去重）；少量索引 OCR 噪声词形（chicule、vole、abondance I' 等）未改写；释义均「补充翻译·待核对」。
  **子代理不可用**：本会话只暴露 read/bash/edit/write，`subagent` 工具未加载，无法调用 reviewer；本阶段未做独立子代理审查（未声称完成）。
  剩余：Lexique indispensable pp.116–140（约 788 词）。
  剩余（下一阶段）：科技/媒体 pp.90–99、Lexique indispensable pp.116–140。批次 TSV 在 data/batches/delf-*.tsv；命令见下。
  命令：OCR_FILE=references/extracted/delf_ocr.json PDF_OFFSET=0 BOOK="Vocabulaire DELF B2 3000 mots.pdf" BOOK_KEY=delf KIND=theme-list LEVEL_BASIS="未核实：书籍为 B2 教材，逐词等级未确认" python3 scripts/batch/gen/build.py <name> "<章名>" <topic> <pdf起> <pdf止> → 同前缀 run-batch.sh <name>
  批次文件在 data/batches/delf-*.tsv；导入日志 data/import-log.jsonl；每批日志 output/delf-*/。
  来源缺陷已修复（见 data/lessons/source-repair-r19.md）：3337 条来源书本字段改正，build.py 现要求 BOOK/BOOK_KEY/OCR_FILE/LEVEL_BASIS 并交叉校验。
  DELF 剩余主题（未做，按印刷页）：éducation/travail 44–53、santé 54–64、consommation 65–75、famille 76–79、environnement 80–84、technologies/médias 85–99、loisirs 104–110、économie/politique 111–115、Lexique indispensable 116–140。合计约 1900 词条缺中文释义。
  注意：data/imports/delf-lists.csv 有 191 条把正文句子误当词条的记录（待清洗，未删除）。DELF 命令示例：OCR_FILE=references/extracted/delf_ocr.json PDF_OFFSET=0 BOOK="Vocabulaire DELF B2 3000 mots.pdf" BOOK_KEY=delf KIND=theme-list LEVEL_BASIS="未核实：书籍为 B2 教材，逐词等级未确认" python3 scripts/batch/gen/build.py <name> "<章名>" <topic> <pdf起> <pdf止>
- [断点 r19] DELF 连接词已导入；来源缺陷已修复。
  **来源修复**：build.py 曾将初级教材书名/等级依据继承到 A2–B1、avancé、DELF 各批来源（3337 条）。已用 scripts/batch/gen/repair-sources.py 定向修复书本字段（level_basis 修 262 条），剩余 0；未改 ID/学习记录。详见 data/lessons/source-repair-r19.md。
  build.py 现要求 BOOK、BOOK_KEY、OCR_FILE、LEVEL_BASIS 且交叉校验；模板只供字段结构。
  下一步：DELF 主题词表与必备词汇（pp.44–140）补中文释义；注意已有 data/imports/delf-lists.csv 含 191 条被误当词条的句子（待清洗），且这~3000 词多数缺释义。
- [断点 r18] avancé 全部 28 课已完成。可学习 5160 / 7847。
  已完成四本中的三本主体：Débutant（28 课）、A2-B1（25 课）、avancé（28 课）。
  下一步（新阶段）：DELF（references/extracted/delf_ocr.json；词表 pp.44–140，连接词 pp.34–43 未读）。
- [断点 r16] avancé 第 1–12 课已导入（avance-l01…l12）。
  高级教材处理：ocr mac(macOS Vision 法语) 重新 OCR → references/extracted/avance_ocr.json；命令 OCR_FILE=references/extracted/avance_ocr.json PDF_OFFSET=1 python3 scripts/batch/gen/build.py <name> "<章名>" <topic> <pdf起> <pdf止> → 同前缀 scripts/batch/gen/run-batch.sh <name>。印刷页 = PDF 页 − 1。章节 STARTS/章名见 scripts/batch/gen/avance_chapters.py 与 avance_titles.py。
  下一步：avancé 第 13 课（印刷页 84，pdf 85–92）起，至第 28 课；再 DELF（references/extracted/delf_ocr.json，词表 pp.44–140，另连接词 34–43 页未读）。
  待办：avancé 索引重音/OCR 错误（metre、parallele、sphére、creur、lumiere、diametre、corai!、ceil/yeux、ai ler 等）未改写 lemma；avancé 例句无中文译文。
- [断点 r15] A2–B1 全部 25 课已完成。 avancé（高级 B2/C1.1）第 1–4 课已导入（avance-l01…l04）。可学习 3819 / 7832。
  高级教材处理方式：文字层乱码，已用 ocrmac（macOS Vision，法语）重新 OCR 正文页 → references/extracted/avance_ocr.json（209 页，脚本 /tmp/ocr_avance.py）。
  命令：OCR_FILE=references/extracted/avance_ocr.json PDF_OFFSET=1 python3 scripts/batch/gen/build.py <name> "<章名>" <topic> <pdf起> <pdf止> → 同前缀 scripts/batch/gen/run-batch.sh <name>。
  高级章节表（印刷页）：scripts/batch/gen/avance_chapters.py 的 STARTS；章名见 scripts/batch/gen/avance_titles.py。印刷页 = PDF 页 − 1。教学页为每章起始页及其后隔页（练习页为偶数页）。
  待办：avancé 索引本身有重音错误（metre→mètre、parallele→parallèle、sphére→sphère、creur→cœur、lumiere→lumière、diametre、corai!、ceil/yeux 等）；词条 lemma 未改写，仅补释义。第 5 课起待做。
- [断点 r15] A2–B1 全部 25 课已完成。 A2–B1 全部 25 课已完成（a2b1-l01…l25）：1633 行，释义全覆盖（补充翻译·待核对），693 条例句全部入库，可学习 3612 / 7830。
  工具：OCR_FILE=references/extracted/a2b1_ocr.json PDF_OFFSET=2 python3 scripts/batch/gen/build.py <name> "<章名>" <topic> <pdf起> <pdf止> → 同前缀 scripts/batch/gen/run-batch.sh <name>。A2-B1 课起始 PDF 页见 scripts/batch/gen/a2b1_chapters.py 的 STARTS。
  待办：l17 "détaire"（OCR 错误）、l18 "terminal"（词性不明）未收录；A2-B1 例句无中文译文（不编造）。
  下一步：avancé（references/extracted/vocabulaire_progressif_du_fran_ais__avan.json，文字层），然后 DELF。
- [断点 r14] A2–B1 第 1–12 课已导入。 A2–B1 第 1–12 课已导入（a2b1-l01…l12，例句 326 条）。
  **重要修复**：scripts/batch/gen/build.py 原先 OCR 路径写死为初级教材，A2–B1 批次曾用错教材找例句，26 条错误例句已入库。现已：改为 OCR_FILE 环境变量；从词典移除 25 条误入例句（日志 output/a2b1-wrong-examples-removed.log，保留 1 条原本存在的合法例句）；用正确 OCR 重跑 12 批。处理 A2–B1/高级/DELF 必须设 OCR_FILE（A2-B1: references/extracted/a2b1_ocr.json）。
  用法：OCR_FILE=references/extracted/a2b1_ocr.json PDF_OFFSET=2 python3 scripts/batch/gen/build.py <name> "<章名>" <topic> <pdf起> <pdf止> → OCR_FILE=... PDF_OFFSET=2 scripts/batch/gen/run-batch.sh <name>
  可学习：2778 / 7818。第 13–19 课已导入（l13 47/l14 87/l15 114/l16 84/l17 39/l18 88/l19 46）。第 20 课起待做。注：l17 跳过 "détaire"（OCR 错误，待办）；l18 跳过 "terminal"（词性不明，待办）。另：曾误做全库别名去重，已回退并重跑全部 a2b1 批次，导入记录已清理一致。
- [断点 r13] A2–B1 第 2–4 课已导入。 A2–B1 第 2–7 课已导入（a2b1-l02…l07；l06、l07 未抽到例句，正文为列表，待原图补例句）。A2–B1 处理方式：scripts/batch/gen/a2b1_chapters.py <课号> --list 列出未释义索引词 → data/batches/a2b1-lNN.tsv（例句填 AUTO，由脚本从教学页 OCR 抽取）→ PDF_OFFSET=2 build.py（PDF 范围见 STARTS）→ run-batch.sh。第 8 课起待做。
- [断点 r12] 已完成：Débutant 第 1–28 课教学页（第 22–28 课本轮导入：l22 60 行、l23 107 行、l24 56 行、l25 75 行、l26 84 行、l27 83 行、l28 77 行；批次 TSV 在 data/batches/）；A2–B1 第 1 课（data/batches/a2b1-l01.tsv，53 行；PDF_OFFSET=2）。
  可学习：2059 / 7804（词条总数 7823）。
  待办：
  1. a2b1-l01：49 条例句因漫画式版面（气泡打断）未能逐字核对，需看原图 pp.8–13（印刷页 6–11）后补录，不猜写。
  2. Débutant 第 22–28 课的部分例句（每课 1–6 条）因 OCR 版面交错或大小写差异被丢弃，见 output/<batch>/fill.log。
  3. Débutant “活动交际”（pp.150–158）、测试（pp.159–163）、索引（pp.164–176）未处理（索引应与已导入的索引条目核对）。
  4. A2–B1：第 2–25 课（页 pdf 14 起，印刷页 = pdf−2）未处理；avancé 与 DELF 未处理。
  下一步：A2–B1 第 2 课（PDF 页 14–19：「LA FAMILLE」教学页 pdf 14、16；练习 15、17），按同一流程：TSV → build.py（PDF_OFFSET=2）→ run-batch.sh。
  停止原因说明：本会话上下文与可接受的单次工作量已接近上限；剩余内容规模大（A2–B1 约 24 课、avancé 约 28 课、DELF 词表），需要分会话继续。
- [断点 r11] Débutant 第 22–28 课教学页已导入（debutant-l22…l28；第 26 课 84 行、第 27 课 83 行、第 28 课 77 行）。未处理：各课的“活动交际”文本页（pp.150–158）、测试（pp.159–163）、索引页（pp.164–176，已由 index 导入覆盖，待核）。可学习 2035 / 7799。下一步：A2–B1（references/books/…A2-B1…pdf）。
- [断点 r10] Débutant 第 22–25 课已导入（批次 debutant-l22/l23/l24/l25；通用流程见 scripts/batch/gen/build.py 与 run-batch.sh；TSV 在 data/batches/）。下一步：第 26（pp.134–139）、27（pp.140–145）、28（pp.146–149）课。
- [断点 r9] Débutant 第 1–21 课已完成（第 20–21 课见 data/lessons/lesson20-21-status.md）。第 19 课补充 p.102 的 3 个遗漏词。可学习 1714 / 7767。下一步：Débutant 第 22 课起（p.116；教材共 28 课 + 活动/测试/索引）。
- 已完成：Débutant 第 1–19 课。第 18–19 课（目录确认 pp.94–103）：143 行，释义 143/143，例句 143 条逐字核对通过；新增 1 条新词条，142 行合并到已有条目。
- 可学习（有释义的可见词条）：1520 / 7734。前端数据已重建。
- 第 16–17 课修正：danseur 例句（原图 p.90 为 danseur(-euse)）；ouvrier（v., 索引误标）确认后并入 ouvrier-m（别名，旧 ID 保留）。
- 状态与遗留：data/lessons/lesson18-19-status.md；版面/OCR 记录：data/lessons/errata-18-19.md、errata-16-17.md。
- 日志：output/lesson18-19/（fill.log、import.log、check.log、build.log、ids.log、test.log、verify-console.log）；output/lesson16-17/dedupe.log、fixes.log。
- 检查：词库完整性通过；ID 稳定；单元测试 48/48；网页检查 16–17（9/9）与 18–19（9/9）。
- 快照：data/snapshots/lexicon-before-r6.json（16–17 修正前）、lexicon-before-r7.json（18–19 导入前）。
- watch 由用户在 Pi 会话内设置为 observe；项目内不寻找、不新建 watch 配置文件。

## 剩余任务（未解决，截至断点 r20）
1. DELF 主题词表：pp.44–53、54–64、65–75、76–79、80–84、85–99、104–110、111–115、116–140 未补释义（约 1900 词条）。连接词与运输主题已完成。
2. delf-lists.csv 中 191 条误当词条的句子待清洗。
3. avancé 索引重音/OCR 错误未改写 lemma；avancé/DELF 例句多为自动抽取、无中文译文。
4. Débutant 交际活动/测试页、各教材练习页未整理。
5. 空释义疑似重复（9 条待办）：cher、marche-、serveur-、comme、diner、tout-、electronique-、dejeuner-、fin-。
6. A2-B1 l17 "détaire"、l18 "terminal" 未收录（待办）。
7. 所有释义为「补充翻译·待核对」，需抽样核对。四本覆盖范围见 data/lessons/coverage-summary.md。
