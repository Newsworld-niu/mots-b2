# 法语词光 · Mots B2

> 从零基础到 DELF B2 的法语背词与备考工具：7376 词的词库、离线词典、男女声朗读、FSRS 间隔复习，再加上 AI 出题和批改的 B2 四项专项练习。

以 [Word Atlas](https://github.com/designfuchen/word-atlas) 为原型改造的法语版本，打开网页就能用，也可以安装成 PWA。

**在线使用 →** [mots-b2.motb2.workers.dev](https://mots-b2.motb2.workers.dev)

![法语词光 · 从零开始，直抵 B2](docs/banner.jpg)

---

## ✨ 特点

### 📚 词库：来源可查，按词频排序

- **7376 个可学词条**，整理自 4 本法语词汇教材（A1 → B2/C1），每条都有中文释义和带中文翻译的例句（共 8207 句）。
- 等级分 **A1 / A2 / B1 / B2**，学习路线按 [Lexique 3.83](http://www.lexique.org/) 语料词频排列，**常用词先学**；开始时可以跳过已经会的低级别词。
- 名词标注阴阳性（un / une），并用 Lexique 逐条核对；有冲突的词不出题。
- 按 **16 个主题**（工作、经济、教育、健康、环境、媒体……）、词性、词族浏览，另有 **92 组易混词辨析**。

### 🔍 查词：在线 + 离线

- 首页查词接入 **法语助手**，同时内置 **离线词典**（Lexique + 法语维基词典 + Tatoeba 例句），没网也能查。
- 查到的词可以一键加入卡组；也可以从 **维基词典导入**释义和例句，保留来源链接。

### 🔊 发音：男女两种声音

- 单词和例句都有预先录好的 **女声 / 男声** 朗读（Azure 神经语音）。
- 没有录音的内容（自建词、AI 例句）可以接 Azure 实时朗读，或者用设备自带的法语语音。

### 🗂 卡片与卡组：随你组织

- 卡片上可以自己加 **例句、搭配、词族、注意点**，也可以让 **AI 一键补齐**。
- 自由 **新建卡组**，单词可以在卡组之间 **移动或复制**；也可以批量导入单词表。
- 粘贴一段法语（新闻、课文、歌词），或上传 **文件 / 照片**，自动抽出生词加入卡组。

### 🧠 学习与复习

- 用 **FSRS** 算法安排复习，目标记忆率可调（默认 90%）。
- 按 **卡组、词性、词族** 挑选学习范围。
- 多种题型：认词、听音选词、听写、拼写（连冠词）、un/une 快速判断、看图填词、中译法、用词造句（AI 批改）……
- **阅读模式**：AI 用你正在复习的词写短文；任意法语文本按「没学过 / 在学 / 已掌握」给词上色。
- 学习热力图、连续天数，还有可以分享的 **个人星图**。

### 📝 DELF B2 专项练习（AI 出题）

| 板块 | 内容 |
|---|---|
| **听力理解** | 按真题题型：两段长录音各听两遍、三段短录音各听一遍，一套 25 分，按考试的停顿时间作答 |
| **阅读理解** | 两篇报刊文章 + 一组「这是谁的观点」，整套限时 1 小时 |
| **书面表达** | 按题目写信或短文，AI 批改，可以交 **第二稿**、看 **范文**；写错的句子收进 **错句本**，还能看分数走势 |
| **口语表达** | 抽题 → 准备 30 分钟 → 独白 5–7 分钟 → **AI 扮考官辩论**，按官方评分表批改 |

### ✍️ 语法与变位

- **63 个语法点**（A1–B2）：每个点都有讲解、判断顺序、口诀、对比句、逐步拆解与速查表，配 **4674 道练习题**（选择、键入、改错、句型转换、语序），按规则和易错点统计掌握度，并把作文错句回流到对应语法点里练习。
- **1079 个动词** 的完整变位表：自写的规则引擎生成，每个形式都和 Lexique 语料比对过，对不上的动词不出题；选择题优先用按规则类推的常见假形作干扰项。专门的变位复习。

### 🎨 体验

- 浅色 / 深色 / 跟随系统；界面音效和 **环境声**（雨、海、森林、咖啡馆、壁炉……）。
- 学习数据存在本机浏览器，可以 **导出 / 导入备份**。
- 支持 PWA 安装，像本地应用一样使用。

---

## 🤖 AI 接口（可选）

不配置 AI 也能正常背词、查词、复习；AI 只用来出题、批改和补全卡片。在「**我的 → AI 接口**」里填写自己的 Key：

| 用途 | 可选服务 |
|---|---|
| 文本（出题、批改、补卡片） | DeepSeek（默认）· OpenAI · Anthropic · OpenRouter |
| 识图（从照片 / PDF 抽词） | OpenAI · Anthropic · OpenRouter |
| 生图（单词配图） | OpenAI · OpenRouter |
| 朗读 | Azure 语音 |

> [!NOTE]
> Key 只保存在你自己的浏览器里（localStorage），不会写进备份或云同步，也不会上传到任何服务器。本地运行时由开发服务器转发请求以解决跨域问题，转发时不记录内容。

---

## ☁️ 云同步（可选）

默认所有数据仅保存在本机。线上版本的云同步服务与网页同域（`/api/*`，由 Cloudflare Workers 提供），可以在「**我的 → 云同步**」按需开启多设备同步：

- **邀请码开通与配对**：通过一次性**邀请码**创建个人**同步码**（`mb2_...`），在其他设备输入或扫码即可配对。请妥善保存同步码，**丢失后无法找回云端数据**。
- **同步范围**：单词记忆、卡组与自建词、自定义配图、作文与草稿、阅读文本、语法与变位记录、模考题库及学习设置（云端自动保留最近 20 个历史版本，可按版本恢复，也可随时一键删除云端数据）。
- **隐私与加密说明**：**AI 接口 Key 与 Azure 语音 Key 永远不会写进备份或上传到云端**；其余学习数据在浏览器里用由同步码派生的密钥做**端到端加密**（HKDF-SHA256 + AES-GCM-256）后才上传，经 **Cloudflare Workers** 存入作者账号下的 **Cloudflare R2** 存储（亚太区域）。服务端只保存密文和同步码的 SHA-256 摘要，看不到学习内容，也无法替你找回同步码。
- **从旧域名迁移学习记录**：浏览器本地数据按域名隔离；若此前在旧版 GitHub Pages 页面存有进度，可在旧页面「**我的 → 导出备份**」下载 JSON 文件，再在新地址「**我的 → 导入备份**」恢复。

---

## 🖼 产品预览

| 图鉴 | 单词卡 |
|---|---|
| ![图鉴](docs/screenshots/atlas.jpg) | ![单词卡](docs/screenshots/word.jpg) |
| **练习** | **阅读** |
| ![练习](docs/screenshots/practice.jpg) | ![阅读](docs/screenshots/read.jpg) |
| **动词变位** | **深色模式** |
| ![动词变位](docs/screenshots/conj.jpg) | ![深色模式](docs/screenshots/dark-today.jpg) |

---

## 🚀 使用

### 网页

直接打开 [mots-b2.motb2.workers.dev](https://mots-b2.motb2.workers.dev)。

### 本地运行

需要 Node.js 22+。

```bash
git clone https://github.com/Newsworld-niu/mots-b2.git
cd mots-b2
npm install
npm run dev        # http://127.0.0.1:5190
```

> [!TIP]
> 本地运行时法语助手查词和所有 AI 服务都通过开发服务器转发，比纯静态网页更稳定。
> 本地开发服务器没有 `/api`，要在本地试云同步，请用 `VITE_SYNC_URL=https://mots-b2.motb2.workers.dev npm run dev` 指向线上服务（或下面的 `npm run cf:dev`）。

### 部署到 Cloudflare Workers（维护者）

网站、云同步 API 和音视频都跑在一个 Cloudflare Worker 上（配置见 [`wrangler.jsonc`](wrangler.jsonc)，入口 [`worker/index.ts`](worker/index.ts)）：

- **静态资源**：`dist/` 通过 Workers Static Assets 发布；`/grammar/causatif`、`/dict/prendre` 这类路径会回到应用并自动转成对应的 `#/` 页面。
- **云同步**：`/api/*` 由 Worker 处理，数据存在 R2 存储桶 `mots-b2-sync`。
- **音视频与离线词典分片**：`public/atlas/audio/`、`public/materials/` 音视频及 `public/lexdb/` 词典分片不打入 `dist/`，存放在 R2 存储桶 `mots-b2-media`，由 Worker 以 `/media/*` 和 `/lexdb/*`（支持 Range、ETag 和边缘缓存）分发。
- **查词**：`/dictionary-proxy` 在线上同样可用（仅限同源调用，按 IP 限速）；线上不提供 AI 转发，浏览器会直接调用各 AI 服务。

```bash
# 凭据只从环境变量读取，不要写进任何文件
export CLOUDFLARE_ACCOUNT_ID=...   CLOUDFLARE_API_TOKEN=...

npm run media:sync:r2 -- --setup --dry-run   # 查看本地音视频清单和计划（不改动任何东西）
npm run media:sync:r2 -- --setup             # 建好两个 R2 存储桶（亚太）并上传新增或变化的音视频
npx wrangler secret put ADMIN_KEY            # 设置签发邀请码用的管理密钥（只需一次）
npm run cf:deploy                            # 构建（VITE_MEDIA_BASE_URL=/media）并部署
npm run cf:dev                               # 先 npm run cf:build，再在本地用 wrangler 跑完整 Worker

# 签发邀请码
SYNC_URL=https://mots-b2.motb2.workers.dev ADMIN_KEY=... npm --prefix server run invite
```

推送到 `main` 后，GitHub Actions（[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)）会跑完全部检查和 E2E，再自动 `wrangler deploy`。需要在仓库的 **Settings → Secrets and variables → Actions** 里添加两个 Secret：`CLOUDFLARE_API_TOKEN`（含 Workers Scripts 和 R2 编辑权限）和 `CLOUDFLARE_ACCOUNT_ID`。`ADMIN_KEY` 是 Worker 自己的 Secret，用上面的 `wrangler secret put` 设置，不放在 GitHub 里。

## 💬 发现 bug？

欢迎发起 issue 或者发邮件 **newsw0914@gmail.com**

## 🗺️ 待办清单

- [ ] 做一个法语单词数据库, 方便查询和添加单词
- [x] 支持云端备份, 避免设备切换时需要导出导入文件
- [ ] 增加更多模型支持: 可以添加自定义模型

---

## 📄 许可

- **代码**：[MIT](LICENSE)
- **内容**：教材来源的词头、页码与原例句版权归原作者和出版方，仅供个人学习；本项目补充的释义、例句、语法内容采用 CC BY 4.0；离线词典与词频数据来自 Lexique 3.83、Wiktionnaire、Tatoeba，按 CC BY-SA 4.0 使用。详见 [CONTENT_LICENSE.md](CONTENT_LICENSE.md)。

## 🙏 致谢

[Word Atlas](https://github.com/designfuchen/word-atlas) · [Lexique 3.83](http://www.lexique.org/) · [Wiktionnaire](https://fr.wiktionary.org/) / [kaikki.org](https://kaikki.org/) · [Tatoeba](https://tatoeba.org/) · [法语助手](https://www.frdic.com/) · [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)
