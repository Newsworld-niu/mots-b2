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
  syn?: string[];
  ant?: string[];
  derived?: string[];
  family?: string;   // 对应 src/data/families.json 的 family.id
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
- **超长分片 3 字母切分（`splits`）**：
  - 构建导出时，若某个 2 字母分片 `public/lexdb/e/<k2>.json` 的未压缩体积 **> 400 KB**，则将该前缀按前 3 个字母 `[a-z]`（不足补 `_`）切分，如 `co` -> `coa`, `cob`, `col`, `com`, `con`, ...，并将 `"co"` 加入 `meta.json` 的 `splits` 数组（排序去重）。
  - 查询端（`src/lib/lexdb/load.ts`）先读取 `meta.json` 的 `splits`（首次查词时加载并缓存），计算 `baseKey = dictKey(folded)`：
    - 若 `splits.includes(baseKey)`，则取 `(letters + "__").slice(0, 3)` 作为最终 `<key>`；
    - 否则直接用 `baseKey`。
  - `public/lexdb/forms/<key>.json` 使用**完全相同的** `splits` 与 `<key>` 规则（一个 `forms/<key>.json` 对应它自身字母前缀的变位/变形，不跨前缀）。注：若 `forms/<k2>.json` 自身或对应 `e/<k2>.json` 在 `splits` 中，则按同样 3 字母键切分，保证两边一致。

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
     "counts": {
       "lemmas": 38805,
       "withZh": 0,
       "top15kComplete": 0,
       "pilot": 200,
       "phrases": 0,
       "conf": { "0": 0, "1": 0, "2": 0, "3": 0 }
     }
   }
   ```
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

## 4. 可信度与来源标记规范

- `conf = 3`：来自 `atlas`（Mots B2 人工/教材核对词图）或 ≥ 3 个独立开放来源一致确认。
- `conf = 2`：2 个独立开放来源（如 `wikt-zh` + `cfdict` 或 `omw`）语义一致。
- `conf = 1`：单一开放来源（`wikt-zh` / `cfdict` / `omw`），或经过第二模型复核通过的 AI 译文（`src` 含 `"ai-reviewed"`）。
- `conf = 0`：尚未复核的 AI 生成译文（`src` 为 `["ai"]`），或存在多源冲突待审。

## 5. 现有兼容边界

- **不得修改或破坏** `public/dict/*` 与 `src/lib/dict.ts`、`src/lib/lookup.ts` 原有接口。
- 词典页的「加入复习」功能复用 `buildSeed`（`src/lib/lookup.ts`）或构造等价 `Seed` 传给 `WordForm` / `addToDeck`，不绕过卡组与 FSRS 校验逻辑。
- `public/lexdb/` 导出结果需控制总大小，供网页按需加载与 APK 打包离线内置（目标 30–60 MB，超出 80 MB 需告警）。
