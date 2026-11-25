# 词典主库与前端分片契约（LexDB Contract v1）

本文档为 `data`、`search`、`ui`、`reviewer` 四条并行工作线的唯一共享契约。所有字段名、类型、分片路径、分片键规则与置信度规则必须严格遵守本契约。

## 1. TypeScript 类型定义（与 `src/lib/lexdb/types.ts` 一致）

```ts
export type SourceId =
  | "atlas"
  | "wikt-fr"
  | "wikt-zh"
  | "cfdict"
  | "omw"
  | "tatoeba"
  | "lexique"
  | "morphynet"
  | "cnrtl"
  | "frdic"
  | "ai"
  | "ai-reviewed"
  | "user";

export type Conf = 0 | 1 | 2 | 3; // 0 unreviewed AI, 1 single source / AI reviewed, 2 two sources agree, 3 atlas or ≥3 agree

export interface LexExample {
  fr: string;
  zh: string;
  hl?: [number, number]; // UTF-16 [start, end) of matched headword/form in `fr`
  src: SourceId;
  ref?: string;
}

export interface LexSense {
  zh: string;        // 简短中文义项，多个义项间以 `；` 分隔（法语助手风格）
  fr?: string;       // 法语简短义项标签（来自法语维基词典等）
  reg?: string;      // 语域/学科标签，如 "书" | "俗" | "旧" | "转" | "技"
  ex?: LexExample[];
  src: SourceId[];
  conf: Conf;
}

export interface LexPos {
  p: string;         // 沿用词图词性标记：n.m. n.f. n. v. adj. adv. prép. conj. pron. interj. loc.
  g?: "m" | "f" | "mf";
  senses: LexSense[];
}

export interface LexPhrase {
  fr: string;
  zh: string;
  src: SourceId;
  conf: Conf;
}

export interface LexEntry {
  id: string;        // folded lemma, plus "#2" for homographs when needed
  w: string;         // 规范拼写（保留重音与连字 œ/æ）
  ipa?: string;      // 不带首尾斜杠的国际音标，如 "akœj"
  level?: "A1" | "A2" | "B1" | "B2";
  rank?: number;     // 词频排名（1 = 最高频，越小越常用）
  atlasId?: string;  // 对应词图（data/lexicon.json）的 id
  forms?: { f?: string; pl?: string; fpl?: string };
  pos: LexPos[];
  phrases?: LexPhrase[];
  syn?: string[];     // 近义词：精确 LexDB 词头 / 词图词元，按证据排序，≤ 8（长尾词 ≤ 5），空则省略
  ant?: string[];     // 反义词：同上，≤ 6（长尾词 ≤ 4）；与 syn 互斥
  derived?: string[]; // 同族词（派生词 / 词基 / 兄弟派生），只含单词或已收录的连字符词，≤ 10（长尾词 ≤ 6）
  family?: string;   // 对应 public/atlas/families.json 的 family.id
  frDefs?: { p: string; gloss: string; ex?: string }[];
  etym?: string;
  conj?: boolean;    // 是否在 public/atlas/conj.json 中有完整变位表
  confusable?: string[]; // 对应 data/confusables.json 的 group.id[]
  sources: SourceId[];
}
```

## 2. 折叠规则与分片键规则

- **拼写折叠（`lexdbFold`）**：与 `src/lib/dict.ts` 的 `dictFold` 完全一致：
  1. `trim()`，将弯引号 `[’‘]` 替换为 `'`，连续空白压缩为单个空格；
  2. `NFKC` -> `œ/Œ` 展开为 `oe`、`æ/Æ` 展开为 `ae` -> `NFD` 去除变音符号 `\p{M}` -> 转小写。
- **基础分片键（`baseKey`）**：与 `src/lib/dict.ts` 的 `dictKey` 一致：
  - 提取 `folded` 中的 `[a-z]` 字符；若为空或首字符非字母则用 `"__"`；否则取 `(letters + "_").slice(0, 2)`。
- **超长分片多级前缀切分（`splits`）**：
  - 构建导出时，若某个 2 字母分片 `public/lexdb/e/<k2>.json` 或 `forms/<k2>.json` 的未压缩体积 **> 400 KB**，则将该前缀按前 3 个字母 `[a-z]`（不足补 `_`）切分，如 `co` -> `coa`, `cob`, `col`, `com`, `con`, ...；若某个 3 字母分片仍 **> 400 KB**，则继续将该 3 字母前缀（如 `"con"`）加入 `splits`，进一步按前 4 个字母切分（`con_`、`cona`..`conz`）。所有需细分的 2/3 字母前缀均排序去重写入 `meta.json` 的 `splits` 数组。
  - 查询端（`src/lib/lexdb/load.ts`）先读取 `meta.json` 的 `splits`（首次查词时加载并缓存），从 `baseKey` 起只要当前前缀在 `splits` 中且长度 `< 4` 就继续取下一位字母（不足补 `_`），作为最终 `<key>`。
  - `public/lexdb/forms/<key>.json` 使用**完全相同的** `splits` 与 `<key>` 规则（一个 `forms/<key>.json` 对应它自身字母前缀的变位/变形，不跨前缀）。保证两边一致。

## 3. 导出目录与文件格式（`public/lexdb/`）

所有文件为紧凑 UTF-8 JSON（无多余缩进）。

1. **`public/lexdb/meta.json`**：
   ```json
   {
     "version": 1,
     "generated": "2026-11-22",
     "sources": {
       "atlas": "Mots B2 Atlas (data/lexicon.json)",
       "lexique": "Lexique 3.83 (CC BY-SA 4.0)",
       "wikt-fr": "Wiktionnaire fr via wiktextract (CC BY-SA 4.0)",
       "wikt-zh": "Wiktionary zh / fr-zh (CC BY-SA 4.0)",
       "cfdict": "CFDICT (CC BY-SA 3.0/4.0)",
       "omw": "WOLF (OMW-fr) × Chinese Open Wordnet (OMW-cmn)",
       "tatoeba": "Tatoeba fra-cmn (CC BY 2.0 FR)",
       "ai": "OpenRouter LLM generation",
       "ai-reviewed": "OpenRouter cross-model review"
     },
     "licenses": ["CC BY-SA 4.0", "CC BY 2.0 FR"],
     "splits": ["co", "de", "en", "pa", "pr", "re"],
     "suggestShards": true,
     "suggestSplits": ["a", "c"],
     "hintsShards": true,
     "counts": {
       "lemmas": 38805,
       "withZh": 0,
       "top15kComplete": 0,
       "pilot": 200,
       "phrases": 0,
       "conf": { "0": 0, "1": 0, "2": 0, "3": 0 },
       "withDerived": 0,
       "withSyn": 0,
       "withAnt": 0
     }
   }
   ```
   - `sources` 另含 `"morphynet"`、`"cnrtl"`、`"frdic"` 三个关系来源说明（见第 6 节）。
2. **`public/lexdb/e/<key>.json`**：
   - 类型：`Record<string, LexEntry>`，key 为 `entry.id`（folded lemma，同名异义跨词条时可用 `id#2`）。
   - 单个文件必须 `<= 400 KB`（`409,600` 字节；极个别 3 字母仍超限者需在 `meta.json` 或 check 中报告，但正常法语 3 字母前缀远小于 400 KB）。
3. **`public/lexdb/forms/<key>.json`**：
   - 类型：`Record<string, string[]>`，即 `{ [foldedForm: string]: string[] }`，映射屈折变化词形（动词变位、名词/形容词阴复数）到 `LexEntry.id[]`（按词频/常用度排序）。
4. **`public/lexdb/zh/<n>.json`**（`<n>` 为 `0`..`63`）：
   - 类型：`Record<string, [string, number][]>`，即 `{ [zhTerm: string]: [entryId, rank][] }`。
   - 索引切分函数：`bucket = zhTerm.codePointAt(0)! % 64`（Python: `ord(term[0]) % 64`）。
   - 写入索引的中文词条：先将 `LexSense.zh` 与 `LexPhrase.zh` 按 `；|;|，|,|、|/|（|）|\(|\)` 拆分并去除首尾空白与括号补充，长度 1..20 字的规范词条全部写入对应桶，每个词条下的 `[entryId, rank]` 按 `rank` 升序排列（无 rank 排最后），去重保留前 40 条匹配以控制体积。
5. **`public/lexdb/suggest.json`**：
   - 类型：`LexSuggestRow[]`，紧凑四元数组 `[folded, w, rank, shortZh][]`：
     - `folded`: string（小写去重音拼写，用于前缀匹配与拼写纠错）
     - `w`: string（规范展示拼写，如 `"être"` 或 `"à cause de"`）
     - `rank`: number（词频排名；短语若无 Lexique 词频则继承主词 rank + 10000 或置 `99999`）
     - `shortZh`: string（简短中文预览，通常取第一义项前 24 字）
   - 覆盖全部词元 + 独立短语词条（多词短语同样进入 `suggest.json`，方便即时联想和短语查询）。
   - 当 `meta.suggestShards = true` 时改为 `suggest/<bucket>.json`（按 folded 首字母分桶，超 400 KB 者按 `suggestSplits` 再细分）+ `suggest/top.json`。
6. **`public/lexdb/hints/<bucket>.json`**（`meta.hintsShards = true` 时存在）：
   - 类型：`Record<string, [string, string]>`，即 `{ [word]: [pos, shortZh] }`，为关系列表中的每个目标词提供悬停/列表预览，无需再拉取目标词所在的 `e/<key>.json`。
   - 覆盖：所有 `e/*.json` 中出现在 `syn` / `ant` / `derived` 里的唯一词，以及 `public/atlas/families.json` 的 `name` / `examples` / 成员词元。
   - 键：`word.normalize("NFC").trim().toLowerCase()`（保留重音的小写法语拼写，如 `"bonheur"`、`"heureusement"`）。
   - 值：`pos` 为短词性（`"n.m."`、`"n.f."`、`"adj."`、`"adv."`、`"v."` …，取最常用词条中第一个带中文义项的词性块）；`shortZh` 为简体中文短预览（去括号注释，取前 1–3 个义项，`<= 18` 字；无中文时为 `""`）。
   - 分桶函数（Python `scripts/lexdb/common.py`，前端须逐字节一致）：
     ```python
     def hint_bucket(word: str) -> str:
         folded = lexdb_fold(word)
         letters = re.sub(r"[^a-z]", "", folded)
         if not letters or not folded or not folded[0].isalpha():
             return "_"
         return letters[0]
     ```
     即 `a.json` .. `z.json` 与 `_.json`。紧凑 JSON（`separators=(",", ":")`），每个文件 `<= 409,600` 字节（实际约 15–45 KB）。

## 4. 可信度与来源标记规范

- `conf = 3`：来自 `atlas`（Mots B2 人工/教材核对词图）或 ≥ 3 个独立开放来源一致确认。
- `conf = 2`：2 个独立开放来源（如 `wikt-zh` + `cfdict` 或 `omw`）语义一致。
- `conf = 1`：单一开放来源（`wikt-zh` / `cfdict` / `omw`），或经过第二模型复核通过的 AI 译文（`src` 含 `"ai-reviewed"`）。
- `conf = 0`：尚未复核的 AI 生成译文（`src` 为 `["ai"]`），或存在多源冲突待审。

## 5. 现有兼容边界

- **不得修改或破坏** `public/dict/*` 与 `src/lib/dict.ts`、`src/lib/lookup.ts` 原有接口。
- 词典页的「加入复习」功能复用 `buildSeed`（`src/lib/lookup.ts`）或构造等价 `Seed` 传给 `WordForm` / `addToDeck`，不绕过卡组与 FSRS 校验逻辑。
- `public/lexdb/` 导出结果需控制总大小，供网页按需加载与 APK 打包离线内置：`scripts/lexdb/check.py` 递归统计目录下**所有文件**，总量 `>= 80 MiB` 直接失败；`e/`、`forms/`、`suggest/`、`hints/` 中任一文件 `> 409,600` 字节直接失败。

## 6. 词汇关系（`syn` / `ant` / `derived`）的生成规则

由 `scripts/lexdb/enrich-relations.py` 在已发布分片之上确定性生成（不重建 SQLite、不改动 id / 义项 / 例句 / 短语 / zh 与 suggest 索引），可重复运行（原始关系输入固定读取自增强前的 git 提交）。

- **来源谱系（lineage）**：Wiktionary（en.wiktionary 经 Kaikki 的 `derived` / `related` / 词源词缀模板 / 近反义词，MorphyNet 派生对，以及原 fr.wiktionnaire 列表，三者合计算 **1 个**谱系）、CNRTL（CRISCO DES 排序近义词、反义词与 ATILF 形态族图）、Frdic（近义词 / 反义词 / 派生 / 副词变化）、词图人工数据（`data/lexicon.json` 的 `fam/syn/ant` 与 `public/atlas/families.json`）、OMW（WOLF 同 ILI 同义词集与英文 WordNet 反义链接投射；权重 0.5）。
- **目标校验**：每个目标词都折叠到 LexDB 规范拼写（NFC、直撇号），必须**精确等于** LexDB 某个 `w` 或词图可见卡片的 `lemma`；词性需与源词条兼容；英文噪声（如 `home` 作为 `accueil` 的计算机义近义词、`cute`）与含源词的复合词（`page d'accueil`）不作为近义词。
- **`derived`（同族词）**：直接派生（`w → d`）、直接词基（`b → w`，如 `accueil ← accueillir`）、两跳派生链（`heureux → malheureux → malheureusement`）、共享同一已证实词基的兄弟词（`heur` 连接 `heureux / bonheur / malheur`）。复合/前缀词只经由最后一个成分扩展兄弟词（`bonheur` 归入 `heur` 族，不连到 `bonté / bonjour`）；不经由词缀（`re-`、`-tion` …）或 ≤ 2 字母的词基扩展；同一词元的屈折形式（`heureuse`、`beaux`、`pris`）放 `forms`，不进 `derived`（除非它是另一词性的独立词条，如 `prise` n.f.）；多词习语一律不进 `derived`（它们属于 `phrases`）。
- **排序（截断前）**：①加权谱系数（CRISCO 近义词按其相关度最多再加 0.4）②直接关系优先于兄弟/两跳关系 ③词图（A1–B2 核心词）成员优先 ④Lexique `rank` 升序。
- **上限**：词图 / B2 / `rank <= 15000`：`derived` 10、`syn` 8、`ant` 6；其余：6 / 5 / 4。每个列表内部去重，`syn` 与 `ant` 互斥（`derived` 与 `ant` 可重叠，如 `heureux` 的 `malheureux`）。
- **词图回写**：`data/lexicon.json` 的可见卡片按 `atlasId`（否则按词元 + 兼容词性）匹配，保留全部已有 `fam/syn/ant/col`，仅追加高置信项：`fam` 以 `word｜短中文` 形式至多 8 项，`syn` / `ant` 以 `word (词性)` 形式各至多 6 项。
