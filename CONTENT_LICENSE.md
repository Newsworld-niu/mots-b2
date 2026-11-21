# 内容授权 / Content license

本项目由 [designfuchen/word-atlas](https://github.com/designfuchen/word-atlas) 修改而来。各部分的授权不同，使用前请按下表区分。

This project is a modified version of [designfuchen/word-atlas](https://github.com/designfuchen/word-atlas). Different parts carry different licenses.

## 代码 / Code

源代码与界面设计采用 [MIT License](LICENSE)，保留原项目的版权声明。依赖包保留各自授权；Fraunces 字体为 SIL Open Font License 1.1。

Source code and UI design are under the [MIT License](LICENSE), with the original copyright notice kept. Dependencies keep their own licenses; the Fraunces typeface is under the SIL Open Font License 1.1.

## 沿用自 word-atlas 的素材 / Material carried over from word-atlas

`public/brand/` 中的插画与 `public/sfx/` 中的音效来自原项目，按原项目的授权 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 使用。

**署名 / Attribution:** `Word Atlas contributors — CC BY 4.0`。

The illustrations in `public/brand/` and the sounds in `public/sfx/` come from the original project and are used under its CC BY 4.0 license.

## 取自教材的内容：不在授权范围内 / Textbook material: not licensed

教材本身和从教材转录的工作文件不在仓库里。词库（`data/lexicon.json`，以及由它生成的 `public/atlas/index.json`、`public/atlas/entries/`）里，词条的选取与顺序、页码，以及标为教材来源的例句，取自四本法语教材。**这些内容的版权属于各教材的作者与出版方，本项目不对它们授予任何许可。** 它们只供个人学习使用；转载、再发布或商用前请自行取得权利人的许可。

The selection and order of headwords, the page references, and the example sentences marked as coming from a textbook are taken from four French textbooks. **They remain the property of their authors and publishers, and this project grants no license over them.** They are here for personal study only.

## 本项目补充的内容 / Material added by this project

以下内容由本项目编写或由 AI 模型生成，在维护者能够授予的权利范围内以 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 提供：

- 中文释义，以及标为补充（`origin=supplement`）的例句和译文；
- `data/grammar/` 中的语法讲解与练习题，`data/confusables.json` 中的易混词辨析。

**署名 / Attribution:** `Newsworld, based on Word Atlas — CC BY 4.0`，并附授权链接，说明是否做过修改。

The Chinese glosses, the examples and translations marked `origin=supplement`, the grammar notes and drills in `data/grammar/`, and `data/confusables.json` are offered under CC BY 4.0, to the extent of the rights the maintainer can grant.

## 第三方数据 / Third-party data

- **Lexique 3.83**（New, Pallier et al., www.lexique.org），[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)：`references/lexique/Lexique383.tsv.gz`，以及由它派生的 `data/frequency.json`、`data/nouns.json`、`data/ipa.json`、`data/forms.json` 和 `public/atlas/conj.json` 中用它核对的部分。相同方式共享条款适用于这些文件。
- **离线词典** `public/dict/` 由三个来源生成：Lexique 3.83（CC BY-SA 4.0）、法语维基词典（Wiktionnaire，经 kaikki.org 提取，[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)）、Tatoeba 例句（[CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/)）。整个目录按 CC BY-SA 4.0 使用，并保留对三个来源的署名。
- **扩展法汉词典库** `public/lexdb/` 在上述来源与项目自有词表（`atlas`）基础上，新增并署名以下开放来源（详见 `data/lexdb/SOURCES.md`）：
  - **中文维基词典（zh.wiktionary.org）** 经 kaikki.org 提取的法语词条：[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) / GFDL；
  - **CFDICT**（汉法自由词典，https://chine.in/mandarin/dictionnaire/CFDICT/ ）：[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)；
  - **WOLF (`omw-fr` 1.4)**（Wordnet Libre du Français，Benoit Sagot & Darla Fišer）：[CeCILL-C V1](http://www.cecill.info/licenses/Licence_CeCILL-C_V1-en.html)；
  - **Chinese Open Wordnet (`omw-cmn` 1.4)**（Shan Wang & Francis Bond，https://bond-lab.github.io/cow/ ）：WordNet License；
  - 由 AI 模型生成或跨模型复核的释义、例句译文与短语标记为 `src: "ai"` / `"ai-reviewed"`，按 CC BY 4.0 随 `public/lexdb/` 提供；由于包含 CC BY-SA 来源，整个 `public/lexdb/` 分片目录遵循 **CC BY-SA 4.0** 协议发布，并保留全部上游署名。

The offline dictionary in `public/dict/` is built from Lexique 3.83, the French Wiktionary (via kaikki.org) and Tatoeba sentences; use the directory under CC BY-SA 4.0 and credit all three sources. The extended `public/lexdb/` shards additionally incorporate zh.wiktionary (CC BY-SA 4.0 / GFDL), CFDICT (CC BY-SA 3.0), WOLF / omw-fr (CeCILL-C V1), Chinese Open Wordnet / omw-cmn (WordNet License), and AI-assisted translations (CC BY 4.0); redistribute `public/lexdb/` under CC BY-SA 4.0 with attribution to all upstream sources.

## 说明 / Notes

- 单个法语单词与通用词表本身不主张专有权。No exclusive rights are claimed over French words or a bare headword list.
- 补充内容由 AI 模型生成并经自动校验，未逐条人工审校，按现状提供，不作准确性担保。The added content was generated with AI models, checked automatically, not proofread entry by entry, and is provided as-is without warranty.
- 录音不在仓库里。自行生成的录音使用 Azure 语音（fr-FR-DeniseNeural、fr-FR-HenriNeural），其使用受微软的服务条款约束。Recordings are not in the repository; those you generate use Azure neural voices and are subject to Microsoft's terms.
- 不是官方 DELF/DALF 词表，与 France Éducation international 无关。Not an official DELF/DALF list and not affiliated with France Éducation international.

### 词族关联
`src/data/families.json` 的新增派生关系来自法语 Wiktionnaire，经本地 Wiktextract JSONL 的 `derived` 字段提取；源词条可在 https://fr.wiktionary.org/wiki/ 后接法语词头查阅。该部分按源内容的 CC BY-SA 条款使用，保留来源标记；数据仅匹配本项目已有单词，未逐项人工核验。生成脚本：`scripts/build-families.py`。

用户主动从 Wiktionnaire 导入的内容会保留固定版本来源链接（`wikiSources`），可从原文查看贡献者历史；例句中的来源署名随原文保留。导入文本及其翻译、编辑遵循源站的 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 条款。卡片上的中文可能由用户或 AI 翻译、编辑，并非维基词典提供的中文原文。
