# LexDB 开放数据源与授权记录 / LexDB Open Sources

> 采集脚本：`scripts/lexdb/fetch-sources.py`
> 元数据快照：`references/lexdb/fetch-meta.json`（本地 gitignored）

所有数据源均为可验证的开放授权语料/词典，**严禁抓取任何商业词典（法语助手 frdic / 沪江等）**。

## 1. 本轮新抓取的开放数据源（`references/lexdb/`）

| 来源 | 下载 / 项目 URL | 本地文件 | 规模 | 授权协议（已核实） | 说明 |
|---|---|---|---|---|---|
| **zh.wiktionary**（中文维基词典法语词条） | `https://kaikki.org/zhwiktionary/raw-wiktextract-data.jsonl.gz`（[说明页](https://kaikki.org/zhwiktionary/rawdata.html)） | `references/lexdb/zhwikt-fr.jsonl.gz` | 扫描 2,981,622 条，过滤 `lang_code == "fr"` 保留 **160,165** 条（5.5 MB） | **CC BY-SA 4.0 / GFDL**（与 Wiktionary 同款授权，kaikki.org 页面已核对） | 含法语词条的中文释义、词性与标签；构建时去除 `:Template:` 前缀并用 `trad-simp.json` 统一转简体 |
| **CFDICT**（汉法自由词典） | `https://chine.in/assets/cfdict/cfdict.u8`（[官网](https://chine.in/mandarin/dictionnaire/CFDICT/)） | `references/lexdb/cfdict.u8` | **56,303** 条（3.4 MB，版本 `14/12/2024 02:30`） | **Creative Commons BY-SA 3.0**（文件头已核实 `https://creativecommons.org/licenses/by-sa/3.0/`） | 汉法词条，反向索引为法语词元提供中文义项；构建时过滤词缀/部首/偏旁说明，优先匹配现代双字及以上简体词 |
| **OMW `omw-fr` (WOLF)** | `https://github.com/omwn/omw-data/releases/download/v1.4/omw-fr-1.4.tar.xz`（项目主页 `http://pauillac.inria.fr/~sagot/index.html#wolf`，经 Python `wn` 包获取） | `references/lexdb/wn_data/wn.db` → `references/lexdb/omw-fr-cmn.jsonl` | 1.4 版（与 `omw-cmn` 共用 **23,302** 个 ILI 同义词集） | **CeCILL-C V1**（已核实 `wn.db` 元数据：`http://www.cecill.info/licenses/Licence_CeCILL-C_V1-en.html`） | 法语 Wordnet Libre du Français（Benoit Sagot & Darla Fišer, 2008） |
| **OMW `omw-cmn` (Chinese Open Wordnet)** | `https://github.com/omwn/omw-data/releases/download/v1.4/omw-cmn-1.4.tar.xz`（项目主页 `https://bond-lab.github.io/cow/`，经 Python `wn` 包获取） | `references/lexdb/wn_data/wn.db` → `references/lexdb/omw-fr-cmn.jsonl` | 1.4 版，跨语言 ILI 对齐共 **23,302** 组法汉同义词集（2.2 MB） | **WordNet License**（已核实 `wn.db` 元数据：`wordnet`，Shan Wang & Francis Bond, 2013） | 构建时清理 `+的` 标记为 `的` |

> 注：尝试下载 `omw-fr:2.0` / `omw-cmn:2.0` 时因当时主分区临时空间不足中断，`omw-fr:1.4` + `omw-cmn:1.4` 已完整下载并校验；两者均使用 WordNet 3.0 ILI 对齐。

## 2. 仓库已有参考数据源

| 来源 | 路径 | 授权协议 | 用途 |
|---|---|---|---|
| **Lexique 3.83** | `references/lexique/Lexique383.tsv.gz` | **CC BY-SA 4.0**（www.lexique.org） | 38,805 基础词元集、词频排名（`freqlemfilms2 + freqlemlivres`）、音标（`phon` → IPA）、屈折词形与阴阳性 |
| **fr.wiktionary（wiktextract 原始流）** | `references/wiktionary-raw/raw.jsonl.gz` | **CC BY-SA 4.0**（kaikki.org/frwiktionary） | 单遍流式提取法语释义（`frDefs`）、词源（`etym`）、词形变化（`forms`）、近反义/派生（`syn`/`ant`/`derived`）及法语例句 |
| **fr.wiktionary 法汉译文提取** | `references/wiktionary/fr-zh.jsonl` & `trad-simp.json` | **CC BY-SA 4.0** | 法语词条在 fr.wiktionary 的中文翻译及繁简字符映射表 |
| **Tatoeba (fra / cmn)** | `references/tatoeba/{fra_sentences,cmn_sentences,fra-cmn_links}.tsv.bz2` | **CC BY 2.0 FR**（tatoeba.org） | 法汉双语例句与 UTF-16 `hl` 高亮偏移 |
| **Mots B2 Atlas 自有词库** | `data/lexicon.json`、`public/atlas/index.json`、`public/atlas/conj.json`、`src/data/families.json`、`data/confusables.json`、`data/frequency.json` | 见 `CONTENT_LICENSE.md` | `atlasId`、`level`（A1–B2）、高可信度中文释义（`conf=3`）、动词变位标记（`conj`）、词族与易混词组 |
