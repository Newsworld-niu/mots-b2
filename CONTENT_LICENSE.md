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
- `data/grammar/` 中的语法讲解与练习题，`data/confusables.json` 中的易混词辨析；
- `src/lib/tcf-tef-presets.ts` 中的原创 TCF / TEF（2023.12 新政题型）四选一听力与阅读进阶套题及中文解析；
- `src/lib/real-presets.ts` 中 `PREBUILT_FAST_CHRONICLES` 收录的 4 篇 ~170 WPM 母语常速广播专题文稿（约 3 分钟考场切片）及配套 7 题理解训练（注：同文件 `PREBUILT_REAL_SOURCES` 中的 6 期 RFI《Journal en français facile》广播及文字稿版权归 France Médias Monde / RFI 所有，仅限个人学习使用，不在 CC BY 4.0 授权范围内）。

**署名 / Attribution:** `Newsworld, based on Word Atlas — CC BY 4.0`，并附授权链接，说明是否做过修改。

The Chinese glosses, the examples and translations marked `origin=supplement`, the grammar notes and drills in `data/grammar/`, `data/confusables.json`, the original TCF and post-Dec-2023 TEF 4-option comprehension suites in `src/lib/tcf-tef-presets.ts`, and the four original ~170 WPM French broadcast chronicles (`PREBUILT_FAST_CHRONICLES`) in `src/lib/real-presets.ts` are offered under CC BY 4.0, to the extent of the rights the maintainer can grant (note: the six RFI *Journal en français facile* episodes in `PREBUILT_REAL_SOURCES` remain copyright France Médias Monde / RFI for personal study only and are not relicensed under CC BY 4.0).

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
- 不是官方 DELF/DALF、TCF 或 TEF 词表与真题，与 France Éducation international 及 CCI Paris Île-de-France 无关。Not an official DELF/DALF, TCF, or TEF word list or exam paper, and not affiliated with France Éducation international or CCI Paris Île-de-France.

### 词族关联
`src/data/families.json` 的新增派生关系来自法语 Wiktionnaire，经本地 Wiktextract JSONL 的 `derived` 字段提取；源词条可在 https://fr.wiktionary.org/wiki/ 后接法语词头查阅。该部分按源内容的 CC BY-SA 条款使用，保留来源标记；数据仅匹配本项目已有单词，未逐项人工核验。生成脚本：`scripts/build-families.py`。

用户主动从 Wiktionnaire 导入的内容会保留固定版本来源链接（`wikiSources`），可从原文查看贡献者历史；例句中的来源署名随原文保留。导入文本及其翻译、编辑遵循源站的 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 条款。卡片上的中文可能由用户或 AI 翻译、编辑，并非维基词典提供的中文原文。

## 漫游 · 书影音馆 / Lounge books, micro-reads, and media (`#/lounge`)

- **双语公版书架（`public/materials/books/`、`src/lib/lounge-books.ts`）**：内置的 5 部法语文学读物（都德、勒纳尔与佩罗、莫里斯·勒布朗、莫泊桑、科莱特）均选自 **1930 年及以前首次出版**、且作者逝世已满法国法定保护期（含战争延长期，例如科莱特作品已于 2025 年 1 月进入法国公有领域）的**法美双重公有领域（Public Domain）**经典篇目。随附的逐段中文译文（`zh`）、导读与注释（`noteZh`）由本项目编写或经 AI 辅助生成并校订，按 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 提供。私人书单推荐卡（`RECOMMENDED_PRIVATE_BOOKS`）仅包含书目元数据与学习导引，不收录任何受版权保护的正文摘录（例如《小王子》因法国「为法兰西捐躯」延长期在法国仍受保护至约 2032/2033 年）。
- **轻松微读（`src/lib/lounge-reads.ts`）**：文化随笔（`culture`）、生活对话（`dialogue`）与迷你悬疑连载（`mystery`）的法汉双语正文、互动投票及 B2 语言提示均为本项目原创编写（含 AI 辅助生成与审校），按 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 授权；诗歌栏目（`poetry`）仅收录 1930 年以前发表的法美双重公版经典诗作（拉封丹、雨果、魏尔伦、阿波利奈尔），其配套中文译文与赏析注释按 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 提供。
- **开放样片与双语字幕（`public/materials/videos/*.vtt`）**：开放视频样片引用自具备开放许可的第三方媒体（如 Wikimedia Commons 等 CC0 / Public Domain / CC BY / CC BY-SA 来源，具体作者与协议见视频卡片署名），遵循各自上游许可使用；仓库内的 `public/materials/videos/*.vtt` 双语字幕文件及重点表达解析由本项目整理编写，除需遵循上游相同方式共享（CC BY-SA）的衍生字幕外，均按 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 提供。
- **YouTube 外部嵌入（YouTube external embeds）**：精选法语频道内容仅通过 YouTube 官方嵌入式播放器与外部链接展示，本仓库不托管、不镜像也不再分发任何受版权保护的第三方音视频流或官方字幕；观看与播放受 [YouTube 服务条款](https://www.youtube.com/t/terms)及各频道创作者权利约束。
- **本地私有导入（User-local IndexedDB imports）**：学习者自行导入的 EPUB、TXT 电子书以及本地视频与字幕文件仅在浏览器本地解析并存储于用户设备的 `IndexedDB` / `localStorage` 中，仅供个人学习，不会上传至任何服务器或随项目分发；请仅导入您本人合法持有的学习资料。

- **Bilingual Public-Domain Books (`public/materials/books/`, `src/lib/lounge-books.ts`)**: All 5 bundled French literary titles (Alphonse Daudet, Jules Renard & Charles Perrault, Maurice Leblanc, Guy de Maupassant, and Colette) consist exclusively of works first published in or before 1930 whose authors' terms have expired in France (including war extensions; Colette entered the French public domain in January 2025), placing the French texts in the **Public Domain in both France and the United States**. Parallel Chinese translations (`zh`) and reading notes (`noteZh`) are authored/AI-assisted for this project and licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Cards in `RECOMMENDED_PRIVATE_BOOKS` contain bibliographic metadata and study commentary only, with zero copyrighted text excerpts (noting, for instance, that *Le Petit Prince* remains protected in France under *Mort pour la France* extensions until ~2032/2033).
- **Relaxed Micro-Reads (`src/lib/lounge-reads.ts`)**: Original French and Chinese micro-essays (`culture`), everyday dialogues (`dialogue`), mini-mystery episodes (`mystery`), interactive polls, and `b2TipZh` notes are project-authored / AI-assisted works released under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Poems in `poetry` are strictly pre-1931 dual France + US **Public Domain** works (La Fontaine, Hugo, Verlaine, Apollinaire), with project-authored Chinese translations and study notes under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Open Sample Videos & Subtitles (`public/materials/videos/*.vtt`)**: Open video samples reference third-party open-licensed media (e.g., Wikimedia Commons under CC0 / Public Domain / CC BY / CC BY-SA, credited per item) under their respective upstream licenses. Bundled bilingual WebVTT tracks in `public/materials/videos/*.vtt` and key-expression notes are provided under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) (or matching CC BY-SA terms where derived from a ShareAlike transcript).
- **YouTube External Embeds**: Curated YouTube videos use official YouTube embeds and outbound links only. No third-party video, audio, or copyrighted subtitle files are hosted or redistributed in this repository; playback is governed by the [YouTube Terms of Service](https://www.youtube.com/t/terms) and each creator's rights.
- **User-Local IndexedDB Imports**: Any EPUB/TXT books or local video/subtitle files imported by the user are parsed and stored solely in the user's local browser (`IndexedDB` / `localStorage`) for private study and are never uploaded or redistributed. Users are responsible for ensuring lawful personal access to imported files.
