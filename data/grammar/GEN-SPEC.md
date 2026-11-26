# 语法内容编写规范

语法内容分两层：

1. **讲义层**（本规范第一部分）：讲解正文、结构公式、表格、正误对比卡、例外清单、跨章节对比矩阵。
2. **练习层**（本规范第二部分）：每个语法点的判断顺序、口诀、对比组、逐步拆解和手写练习题（`data/grammar/gen/<point>.json`）。

`scripts/build-grammar.ts` 会读取下面这些文件，无损合并后输出到 `public/atlas/`。**不要直接改 `data/grammar/points.json`、`data/grammar/drills.json` 和 `public/atlas/*`。**

| 文件 | 内容 |
|---|---|
| `data/grammar/points.json` | 63 个原始语法点（基线，只读） |
| `data/grammar/new-points.json` | 新增的完整语法点（目前 3 个 B2 点：`causatif`、`hypothese-systeme`、`registre-inversion`） |
| `data/grammar/enrich/a1-a2.json`、`b1.json`、`b2.json` | 对 63 个原始点的结构化增强补丁，按等级分文件 |
| `data/grammar/matrices.json` | 12 张跨章节横向对比总表（`mat-*`） |

---

# 第一部分：讲义层

## 1. 标签稳定性（最重要）

练习题的 `g` 标签（`r0`、`t2`……）按 `rules` / `traps` 的**下标**对应。所以：

- 原始 63 个点：`rules`、`traps` 的**条数和顺序永远不变**。增强只能「原位改写」某一条（`rulesPatch`），不能追加、删除、调换。
- 新点：`rules` / `traps` 的条数和含义一旦发布就固定，题库分支按它出题。`causatif`、`hypothese-systeme`、`registre-inversion` 各为 4 条 rules（`r0..r3`）+ 4 条 traps（`t0..t3`）。

## 2. 内联语法成分标注

用在 `intro`、`rules[].text`、`rules[].formula`、`rules[].ex[i][0]`、`tables` 单元格、`pitfalls.wrong / right`、矩阵的 `intro` / 表格里。前端把它们渲染成彩色高亮；贴在词干后面的标注（`parl{v:ais}`）渲染成不断词的词尾下划线。

| 前缀 | 标什么 | 例 |
|---|---|---|
| `{v:…}` | 动词词尾、变位形式、助动词、整个复合形式 | `parl{v:ais}`、`nous {v:ayons} fini`、`{v:soit}`、`{v:aurait dû}` |
| `{p:…}` | 介词、缩合冠词、部分冠词 | `{p:à}`、`{p:au}`、`{p:du}`、`{p:en cas de}` |
| `{c:…}` | 代词（人称、关系、指示、疑问）、c'est 的 ce | `{c:le lui}`、`{c:dont}`、`{c:auquel}`、`{c:ce que}` |
| `{a:…}` | 性数配合词尾、特殊形式（bel、nouvel）、冠词的阴阳性标志 | `achet{a:ées}`、`{a:bel}`、`{a:une} école` |
| `{k:…}` | 从句引导词、逻辑连词、假设词、否定框架、固定句型 | `{k:bien que}`、`{k:si}`、`{k:ne} … {k:pas}`、`{k:À peine}` |

硬性规则（校验会拦）：

- 只有这 5 个前缀；**不嵌套** `{}`，**不留空**（`{v:}`），**不漏闭合**。正文里不要出现其他花括号。
- `pairs[].a / b`、`walk.s` 是练习层的纯文本，**不加标注**。
- 标注要克制：**每个句子 1–3 处**，只标和本条规律直接相关的成分。讲解正文里一句话列举了一长串形式时，不标，交给 `formula` 和 `tables` 去高亮。
- 改写原始例句时只加标注、不改字：去掉标注后必须和原句完全相同。

法语排版：`?`、`!`、`:`、`;` 前加空格，引号用 « »，小数用逗号（1,5 %）。

## 3. 六大专题分类 `category`

每个点必须有且只有一个：

| 值 | 专题 | 例 |
|---|---|---|
| `tense` | 时态与语式 | present、passe-compose、subjonctif、conditionnel、gerondif、infinitif、modaux |
| `pronoun` | 代词与指代 | pronoms-objet、y-en、double-pronoms、relatifs、poss-dem、indefinis |
| `determiner` | 名词、冠词与配合 | art-gender、partitif、adj-agree、accord-pp、pluriel、proportion |
| `syntax` | 句子结构与语序 | negation、interrogation、cest-ilest、passif、mise-en-relief、causatif、registre-inversion |
| `clause` | 从句与逻辑连接 | discours-indirect、cause-consequence、but、connecteurs、comparatif、hypothese-systeme |
| `preposition` | 介词搭配与词义辨析 | place-prep、temps-expr、lieu、prepositions、verbes-prep、adverbes、mots-confondus |

## 4. 增强补丁 `enrich/*.json`

```json
{
  "points": {
    "accord-pp": {
      "category": "determiner",
      "intro": "（可选）改写后的导语",
      "rulesPatch": [
        {
          "index": 1,
          "text": "改写后的讲解",
          "formula": ["{v:avoir} + 过去分词：直宾在前 → 配合"],
          "ex": [["Les lettres que j'ai écrit{a:es}.", "我写的那些信。", "que = les lettres，前置 → 配合"]]
        }
      ],
      "tables": [ GrammarTable ],
      "pitfalls": [ Pitfall ],
      "exceptions": ["…"]
    }
  }
}
```

- 63 个原始点**全部**要有条目，且 `category` 非空；点放在它等级对应的文件里（A1、A2 → `a1-a2.json`）。
- `rulesPatch[].index` 必须在原点 `rules` 的下标范围内；同一点里同一个 index 只出现一次。补丁里给出的字段**整体替换**原字段，没给的保留原样。
- `rulesPatch[].ex` 是该条规则的完整例句列表：**原有例句必须全部保留**（可以加标注、补第三项拆解），可以追加新例句。
- 不使用 `appendRules` / `appendTraps`：原始点的标签集合必须 100% 稳定。

每个原始点至少要有：1 条带 `formula` 的 `rulesPatch`、1 张 `tables`、2–4 张 `pitfalls`。偏短、偏薄的规则优先改写。

## 5. 富结构字段

### `formula`（结构公式）
1–3 行，每行一个可以直接套用的骨架：`主语 + {k:ne} + 助动词 + {k:pas} + 过去分词`。用中文成分名 + 法语关键词，不写完整句子。

### `ex` 三元组
`[法语（带标注）, 自然的中文翻译, 简短的结构拆解]`。拆解说清「为什么这样写」：`lire 已带直宾 → 施事者用 à 引出`。两项的旧格式仍然合法。

### `tables`（GrammarTable）
```json
{ "title": "表格标题", "caption": "可选副标题", "tag": "r1", "headers": ["列1", "列2"], "rows": [["…", "…"]], "note": "可选表注" }
```
- 每行单元格数必须等于表头数。
- `tag`（可选）把表格挂到某条 rule / trap 上（`r0`、`t2`）。
- 适合做表的：变位词尾表、助动词与配合矩阵、代词顺位表、连词 × 语式对照、介词横向对比、「位置不同意思不同」对照。

### `pitfalls`（正误对比卡）
```json
{ "wrong": "Je lui aide.", "right": "Je {c:l'}aide.", "why": "…", "tag": "t0" }
```
- `wrong` / `right` 是完整的法语句子，**不带 ✓ / ✗ 符号**（前端自己加）；两句只在出错的地方不同，其余保持一致。
- `tag` 绑定到该点的 trap（优先 `t0..tN`），没有对应 trap 时可绑 rule（`rN`）。
- `why` 写法：「想表达什么 → 按什么思路直译出了这个错句 → 法语的规律是什么」。见第 7 节。

### `exceptions`
高频例外和需要整体记忆的词表，每条一句话：Vandertramp 带直宾改用 avoir、-age 阴性例外、嘘音 h 高频词、不规则虚拟式词干、来自名词的颜色词不变、只接不定式的动词清单等。

## 6. 新语法点 `new-points.json`

字段和原始点相同，外加 `category`、`tables`、`pitfalls`、`exceptions`；`rules[].formula` 必填，`rules[].ex` 一律用三元组。`decide`、`motto`（≤ 60 字）、`pairs`、`walk`、`prereq`、`related` 的要求同第二部分。`prereq` / `related` 只能引用已存在的点（原始 63 个 + 新点）。

## 7. 针对母语负迁移的写法

正误对比卡的价值在于说中「为什么会写错」。`why` 要具体到一种思路，例如：

- 「中文『帮他』像『给他帮忙』，就用了间接宾语。法语 aider qqn 直接接人，代词用 le / la。」
- 「按英语 I was told 直译。dire à qqn 里人是间接宾语，不能当被动句的主语，用 on。」
- 「中文『等你做完作业』不标时态。法语里 quand 引出的将来动作要用先将来时。」

要求：

- 只分析**一个具体句子**里的错误思路，不下「中国人都……」「中文没有……」这类笼统结论。
- 错句必须是学习者**真会写出来**的，不是凑出来的。
- 有争议、两种写法都被接受的（1990 年正字法、laissé + 不定式、après que + 虚拟式的口语用法），不拿来当唯一的错句；要么避开，要么在 `why` 里说明两种都可以。
- 练习题的 `y` 字段仍按第二部分的要求，只写判断依据，不写中法对比。

## 8. 横向对比矩阵 `matrices.json`

```json
{
  "matrices": [
    {
      "id": "mat-hypothese",
      "title": "条件与假设全体系",
      "fr": "Le système de l'hypothèse et de la condition",
      "intro": "一两句话说明这张表解决什么问题",
      "points": ["hypothese-systeme", "conditionnel", "cond-passe"],
      "decide": ["判断第一步 → …", "…"],
      "tables": [ GrammarTable ],
      "pitfalls": [ { "wrong": "…", "right": "…", "why": "…" } ]
    }
  ]
}
```

- `id` 以 `mat-` 开头；`points` 列出这张表横跨的语法点（必须存在）。
- `decide` 是跨章节的判断流程，3–5 步。
- 矩阵的 `pitfalls` 不带 `tag`。
- 现有 12 张：`mat-temps-passe`、`mat-subj-ind`、`mat-hypothese`、`mat-pronoms-ordre`、`mat-relatifs`、`mat-accord-pp`、`mat-temps-prep`、`mat-connecteurs`、`mat-discours`、`mat-cest-ilest`、`mat-passif-causatif`、`mat-verbes-confus`。

## 9. 自检清单

提交前用一段 Node 脚本检查（脚本不入库）：

- 5 个 JSON 文件都能解析；63 个原始点都在 `enrich/*.json` 里，`category` 合法。
- `rulesPatch` / `trapsPatch` 的 `index` 在原点下标范围内；补丁例句保留了全部原例句。
- `new-points.json` 恰好包含约定的新点，每点 rules / traps 条数符合约定。
- `prereq`、`related`、`matrices[].points` 引用的 id 都存在。
- 所有文本字段匹配 `/\{([vpcak]):([^{}]+)\}/g` 之后不再残留 `{` 或 `}`；`pairs`、`walk.s` 不含花括号。
- 表格每行单元格数 = 表头数；`pitfalls` 的 `tag` 在范围内，`wrong` ≠ `right`。

---

# 第二部分：练习层（data/grammar/gen/&lt;point&gt;.json）

每个语法点由一个文件补齐：判断顺序、口诀、对比组、逐步拆解、前置/相关语法点，以及**该点全部手写练习题**（原 drills.json 里的题改好后也放进来）。
写完必须通过：

```
npx tsx scripts/grammar/check-gen.ts <point-id>
```

讲解原文（`data/grammar/points.json` 里该点的 `intro / rules / traps`）**不要改动**，也不要改顺序：题目的标签 `g` 按它们的下标对应。讲解的增强一律通过第一部分的 `enrich/*.json` 补丁完成。

## 文件结构

```json
{
  "id": "subj-indicatif",
  "decide": ["第一步问什么 → 怎么办", "…"],
  "motto": "一句话口诀",
  "pairs": [{ "a": "Je pense qu'il a raison.", "b": "Je ne pense pas qu'il ait raison.", "d": "主句一否定，事情不再确定 → 虚拟式" }],
  "walk": { "s": "法语句子", "z": "中文翻译", "steps": [["要问的问题", "这句话里的答案"], ["…", "…"]] },
  "prereq": ["subjonctif"],
  "related": ["subj-passe", "but"],
  "drills": [ … ]
}
```

| 字段 | 要求 |
|---|---|
| `decide` | 2–6 步。遇到这类句子时**按什么顺序判断**，每步「问题 → 结论 / 下一步」。要能直接拿来做题，不是规则的复述 |
| `motto` | 一句口诀，≤ 60 字，可以中法混写 |
| `pairs` | 2–4 组。两句**只差一处**，答案就不同；`d` 用一句话说差在哪、为什么 |
| `walk` | 选一个有代表性、需要多步判断的句子，逐步拆解（2–6 步） |
| `prereq` | 学这个点之前应该会的点（用已有 id，可为空） |
| `related` | 容易混、或常一起用的点（用已有 id，可为空） |

## 题目格式

`g` 是这道题练的是什么：`"r0"` = 该点第 1 条 rule，`"t2"` = 第 3 条 trap（从 0 数）。**每道题都要有 `g`**。

### 选择题（默认）
```json
{ "s": "Bien qu'il [soit] malade, il est venu travailler.", "z": "尽管他病了，他还是来上班了。",
  "x": [["est", "直陈式；bien que 后面要用虚拟式"], ["sera", "将来时；bien que 后面要用虚拟式"], ["était", "未完成过去时；bien que 后面要用虚拟式"]],
  "h": "être", "y": "bien que（尽管）+ 虚拟式", "g": "r1" }
```
- `[ ]` 标出答案（只能一处）。`x` 是 2–3 个干扰项，**每个都写明为什么错**（`[形式, 原因]`）。
- 干扰项**只在要考的那一项上和答案不同**：考语式就保持同一人称、同一动词；考配合就只变词尾；考介词就只换介词。人称不同、一眼能排除的选项不要用（检查脚本会报 person leak）。
- 干扰项要是学习者**真会写出来**的错误（选错语式 / 助动词、漏配合、多配合、按规则类推出的假形、混淆的近义结构），不要凑数。
- 只有一个选项正确。在这个句子里其他选项必须**确实错**，不能只是「不常用」。
- `h` 可省；给动词原形时只给原形，不要给出时态或语式（否则等于给答案）。

### 键入题 `k: "t"`
```json
{ "k": "t", "s": "Il faut que tu [viennes] avec nous.", "a": [], "h": "venir", "z": "…", "y": "il faut que + 虚拟式", "g": "r1" }
```
- `h` 必填，提示要足够让答案唯一（通常是原形，或括号里的中文意思）。
- `a` 列出所有其他也对的写法（没有就 `[]`）。

### 改错题 `k: "f"`
```json
{ "k": "f", "s": "Les lettres que j'ai {écrit} sont sur la table.", "r": ["écrites"], "z": "…", "y": "que = les lettres（阴性复数）是前置直接宾语 → écrites", "g": "r1" }
{ "k": "f", "s": "Elle s'est {lavé} les mains.", "r": [], "z": "…", "y": "直接宾语 les mains 在后面 → 不配合，原句正确", "g": "r2" }
```
- `{ }` 标出划线部分（只能一处）。`r` 是改正后的**划线部分**；划线部分本来就对时 `r: []`。
- 每个点至少 5 道，其中**至少 2 道原句是对的**、至少 2 道有错。
- `y` 要说明为什么错（或为什么其实没错）。

### 句型转换 `k: "x"`
```json
{ "k": "x", "q": "Il m'a dit : « Je viendrai demain. »", "h": "改成间接引语：Il m'a dit que…",
  "a": ["Il m'a dit qu'il viendrait le lendemain."], "z": "他跟我说他第二天会来。", "y": "futur → conditionnel，demain → le lendemain", "g": "r0" }
```
- 适合有转换关系的点（间接引语、被动、名词化、代词替换、强调句、两句合并成关系从句……）。不适合的点可以不出。
- `a` 第一个是参考答案，后面列出**所有**合理的其他写法（语序、可省成分等），否则学生写对了也会被判错。

## 数量与覆盖（检查脚本会核对）

- **面面俱到**：每条 rule、每条 trap 至少 3 道题（`g` 标记）。重点、易错的标签可以多出。
- 总数 ≥ 30，且 ≥ 3 × (rules + traps)。
- 选择 ≥ 10，键入 ≥ 4，改错 ≥ 5。转换题按需要。
- 原 drills.json 里该点的题：**都要保留**（补上 `g` 和干扰项解释、修掉 person leak），只有确实错误或重复的才删。

## 写作要求

- 句子自然、地道，符合该点的等级（A1 简单，B2 可以用报刊、议论的语境）。词汇和场景要多样，不要反复用同一个人名、同一个动词。
- 每句都有自然的中文翻译 `z`。
- `y` 简短、具体，说清这道题的判断依据。
- 练习题的 `y` **不要写中法语言对比**（不要「中文没有……」「中国人容易……」这类说法），只写判断依据。针对母语负迁移的分析放在讲义层的 `pitfalls.why` 里，写法见第一部分第 7 节。
- 有争议、两种写法都被接受的用法（如 1990 年正字法、laissé + 不定式），不要拿来当唯一答案；要么避开，要么在 `a` / `r` 里两种都收、并在 `y` 里说明。
- 法语标点照法语习惯（`?`、`!`、`:`、`;` 前加空格，引号用 « »）。
