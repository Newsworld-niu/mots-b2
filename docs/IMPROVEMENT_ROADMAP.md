# DELF B2 备考应用成熟化改进路线图（Phase 1–4）

> 本文档基于对 `Mots B2 / 法语词光` 代码库、DELF B2 考纲教学体系、离线/网络实测与桌面/移动端体验的多维复审，结合产品决策树共识整理而成。

---

## 一、已对齐的产品定位与技术边界

1. **产品定位**：小圈子深度自用的 DELF B2 极致可靠备考工具，保留静态部署（GitHub Pages）与 BYOK（自备大模型与 Azure Speech Key），暂不扩展 TCF / TEF 考纲。
2. **使用终端与分发**：以**桌面浏览器为主力备考端**，手机仅作轻量查词与复习；不投入 Android 原生 / Capacitor / APK 瘦身改造；仓库内约 375 MB 本地单词 MP3 保留在库内以确保零配置离线可用。
3. **评分体系**：PE/PO 放开 `[0, 1, 2, 3, 4, 5]` 完整档位（`2 = B1+`，`3 = 稳健 B2`，`4 = 强 B2`，`5 = B2+/C1`），按错误密度重构防虚高阈值，并在批改卡片中透明显示所有触发的封顶原因。
4. **AI 与离线双线并进**：既补齐自定义 OpenAI 兼容 `baseURL`、Whisper STT、生成 `temperature` 与深度写作/理解教练；又补齐无 AI Key 时的预设辩论、预渲染听力音频与 B2 精选阅读库。
5. **词库与工程基线**：统一全站查词至 `LexDB`（退役旧 `public/dict/`），完成确定性 OMW 清洗与批量 AI 词条精修；将云同步升级为字段级智能合并 + 客户端 E2EE，并补齐准生产级容错与 CI 门禁。

---

## 二、分阶段改进计划

### Phase 1：P0 致命缺陷止血修复（当前冲刺）
**目标**：消除直接破坏定级信度、模考有效性、离线口语闭环、词典首条释义、缓存更新与高频交互的硬伤。

- [x] **文档沉淀**：建立本文档（[docs/IMPROVEMENT_ROADMAP.md](file:///Users/news/orca/projects/francais-b2/docs/IMPROVEMENT_ROADMAP.md)）。
- [x] **摸底定级小测修复**（[src/lib/placement.ts](file:///Users/news/orca/projects/francais-b2/src/lib/placement.ts)、[src/ui/PlacementTest.tsx](file:///Users/news/orca/projects/francais-b2/src/ui/PlacementTest.tsx)）：
  - 打破前 12 题全选 A（`answer: 0`）的规律，均衡分布 18 题选项位置并新增单测校验分布；补齐 `role="tab"` 与 `aria-selected`。
- [x] **全真模考 `MockExam` 五大考场漏洞修复**（[src/pages/MockExam.tsx](file:///Users/news/orca/projects/francais-b2/src/pages/MockExam.tsx)、[src/pages/mock-exam-helpers.ts](file:///Users/news/orca/projects/francais-b2/src/pages/mock-exam-helpers.ts)）：
  - 交卷后在成绩单提供 CO / CE 逐题错题复盘、原文对照与 `q.why` 中文解析，并回流 `compMisses`；
  - 修复 `askNextExaminer` 第 2 轮起未停止上一轮 `stopRec` 导致听写失效与回录考官声音的 Bug；
  - 接入 `useRecorder` + `usePronunciation`、补传 `monologueSec`/`debateSec`/`monologueWords`/`typed`、调用 `saveSpeakingCorrections`、理顺离线口语计入 `/100` 口径；
  - 空白自评由默认 `3`（15/25）改为未选 `null`（全部选完方可提交，支持 0 词交白卷一键记 0 分）；
  - 节流 `localStorage` 计时写盘（每 15 秒 / 阶段切换）并联动 2h30 总计时归零锁卷。
- [x] **独立口语工坊 `SpeakingStudio` 离线预设打通**（[src/pages/Speaking.tsx](file:///Users/news/orca/projects/francais-b2/src/pages/Speaking.tsx)）：
  - 接入 [src/lib/speaking-presets.ts](file:///Users/news/orca/projects/francais-b2/src/lib/speaking-presets.ts) 的 12 套预设考官追问与参考核心问题/纲要，实现无 AI Key 完整抽题→准备→独白→预设辩论→五项自评并计入成绩。
- [x] **音频中断状态修复**（[src/lib/audio.ts](file:///Users/news/orca/projects/francais-b2/src/lib/audio.ts)）：
  - 播放被 `stopAudio()` 打断后 `onpause` 结算时检查 `mine !== token`，返回 `"stopped"` 而非误判 `"recorded"`/`"device"` 触发意外录音。
- [x] **`LexDB` 确定性 OMW 清洗与主词性重排**（[scripts/lexdb/export.py](file:///Users/news/orca/projects/francais-b2/scripts/lexdb/export.py)）：
  - 存在非 `"omw"` 释义时导出阶段过滤纯 `["omw"]` 释义（消除 `aller → 摇头丸` 等错义）；
  - 参照 `data/lexicon.json` 权威主词性与动词属性重排词性块（修复 `aller`/`être`/`avoir`/`dire`/`mais`/`sur`/`son`）；剥离 `à` 等字符元说明前缀；刷新 `public/lexdb/` 与 `suggest.json`。
- [x] **Service Worker 缓存策略与代理路径修复**（[public/sw.js](file:///Users/news/orca/projects/francais-b2/public/sw.js)、[src/lib/frdic.ts](file:///Users/news/orca/projects/francais-b2/src/lib/frdic.ts)）：
  - `VERSION` 升至 `atlas-v4`；`/atlas/grammar.json` 纳入 network-first；`/lexdb/` 走 network-first + 离线缓存 `atlas-v4-lexdb`（400 条上限）；旁路 `/dictionary-proxy` 与 `/ai-proxy`；`frdic.ts` 代理拼接 `BASE_URL` 并设 `cache: "no-store"`。
- [x] **前端路由、交互、对比度与首页去重**（[src/lib/router.ts](file:///Users/news/orca/projects/francais-b2/src/lib/router.ts)、[src/App.tsx](file:///Users/news/orca/projects/francais-b2/src/App.tsx)、[src/pages/Today.tsx](file:///Users/news/orca/projects/francais-b2/src/pages/Today.tsx)、[src/ui/ExamDashboard.tsx](file:///Users/news/orca/projects/francais-b2/src/ui/ExamDashboard.tsx)、[src/styles/app.css](file:///Users/news/orca/projects/francais-b2/src/styles/app.css)、[src/styles/dict.css](file:///Users/news/orca/projects/francais-b2/src/styles/dict.css)）：
  - 修复 `#/dict` 上 `词图卡片` 与 `⌘K` 打开 `WordSheet`（改用 `?card=`）；
  - `WordSheet` 左右键忽略 `TEXTAREA`/`SELECT`/`isContentEditable`；
  - 将 `--tab` 悬停变量移至 `:root`，提高 `.reader-word` `z-index` 至 `42`，解决移动端阅读查词抽屉被底栏遮挡；
  - 修复浅色 `--ink-3` 与深色 `.btn-terra`/`.btn-sage` WCAG AA 对比度；改善 `/#/learn` 底部操作栏与例句重叠；修复 `/#/atlas` 词性下拉换行与双箭头；
  - 合并 `Today.tsx` 上下两排矛盾的四科卡片至统一 `ExamDashboard`，并统一小数点格式为 `18.8/25`。

---

### Phase 2：评分校准、AI 深度教练与离线内容补厚
**目标**：让写作/口语评分真正符合 FEI 2022 梯度且可解释，让大陆网络与无 AI 用户都能获得高质量的听/读/写/说训练素材。

- [x] **PE / PO `[0, 1, 2, 3, 4, 5]` 连续档位与防虚高透明化**（[src/ai/tasks.ts](file:///Users/news/orca/projects/francais-b2/src/ai/tasks.ts)、[src/lib/essay.ts](file:///Users/news/orca/projects/francais-b2/src/lib/essay.ts)、[src/lib/pronunciation.ts](file:///Users/news/orca/projects/francais-b2/src/lib/pronunciation.ts)、[src/ui/Marking.tsx](file:///Users/news/orca/projects/francais-b2/src/ui/Marking.tsx)）：
   - 开放 `SCORE_LEVEL_SCHEMA`、`LEVELS`、`phonoGateInfo` 为 `[0, 1, 2, 3, 4, 5]`，定义 `2 = B1+ / 3 = 稳健 B2 / 4 = 强 B2 / 5 = B2+/C1`；
   - 将 `essay.ts` 确定性 `basicGrammarCount >= 5` 固定计数改按词数错误密度（`Math.max(6, Math.ceil(wc / 45))`）判定，解除对基础词汇的连坐降档，并在 `Marking` 卡片中明确显示所有被规则封顶的维度与原因。
- [x] **AI 兼容性、稳定性与深度辅导升级**（[src/ai/config.ts](file:///Users/news/orca/projects/francais-b2/src/ai/config.ts)、[src/ai/clients.ts](file:///Users/news/orca/projects/francais-b2/src/ai/clients.ts)、[src/ai/proxy.ts](file:///Users/news/orca/projects/francais-b2/src/ai/proxy.ts)、[src/ai/usage.ts](file:///Users/news/orca/projects/francais-b2/src/ai/usage.ts)、[src/ai/tasks.ts](file:///Users/news/orca/projects/francais-b2/src/ai/tasks.ts)、[src/ui/AiSettings.tsx](file:///Users/news/orca/projects/francais-b2/src/ui/AiSettings.tsx)、[src/ui/ParagraphUpgrader.tsx](file:///Users/news/orca/projects/francais-b2/src/ui/ParagraphUpgrader.tsx)）：
   - 支持**自定义 OpenAI 兼容 `baseURL`** 与 **`audio/transcriptions`（Whisper / Groq）STT 兜底**（已接入 `Speaking` 与 `MockExam`）；
   - 为生成类任务（CO/CE 出题、口语出题、辩论追问、范文、短文）设置 `temperature`（0.4–0.8，重试递增），判分任务保持 `temperature: 0`；
   - 增加全站 AI 请求超时控制（30s/45s/60s/90s/120s）、本地 Token / 费用估算与清零面板；
   - 新增 **AI「B1→B2 段落升格教练」**（聚焦名词化、复杂从句、搭配替换）与 **CO/CE 干扰项交互解析**（错题按钮按需生成）。
- [x] **离线考题、预制阅读与交互体验补厚**（[src/lib/read-presets.ts](file:///Users/news/orca/projects/francais-b2/src/lib/read-presets.ts)、[src/pages/Read.tsx](file:///Users/news/orca/projects/francais-b2/src/pages/Read.tsx)、[src/lib/exam-presets.ts](file:///Users/news/orca/projects/francais-b2/src/lib/exam-presets.ts)、[src/pages/Comprehension.tsx](file:///Users/news/orca/projects/francais-b2/src/pages/Comprehension.tsx)、[scripts/build-co-audio.ts](file:///Users/news/orca/projects/francais-b2/scripts/build-co-audio.ts)）：
   - 在 `/#/read` 预置 10 篇 DELF B2 分级议论/报刊精选文章（免 AI 即开即读即点词 + 译文与 3 题理解），并将 AI 生成阅读扩至 `[150, 250, 450, 600]` 词；
   - 新增 `preset-listen-3`（25 分）与 `preset-read-4`（25 分，含 `vf` 引证与 `short` 简答）；接入 `doc.audioUrl` 静态 CO 音频优先播放管线并配手动生成脚本 `npm run co:audio`（待按需提供 Azure 凭据合成多角色 MP3 文件）；
   - 应试阅读（CE）新增点击句子高亮证据与选项右键/按钮排除划线功能；对齐 [src/lib/essay-models.ts](file:///Users/news/orca/projects/francais-b2/src/lib/essay-models.ts) 中全部 `patterns` 与范文正文并新增单测门禁。

---

### Phase 3：信息架构中度升级、教学闭环与性能拆包
**目标**：梳理清楚每日学习路径与主副入口，补齐 B2 学习闭环，消除首屏冗余与大包加载延迟。

1. - [x] **中度信息架构与导航升级**（[src/App.tsx](file:///Users/news/orca/projects/francais-b2/src/App.tsx)、[src/pages/Today.tsx](file:///Users/news/orca/projects/francais-b2/src/pages/Today.tsx)、[src/pages/Practice.tsx](file:///Users/news/orca/projects/francais-b2/src/pages/Practice.tsx)）：
   - 保留清晰桌面导航，移动端底栏收束为 **5 Tab**，补齐顶部 `env(safe-area-inset-top)` 安全区；
   - 精简首页首屏堆栈，把发现型模块下沉到对应二级页；`Splash` 改为仅首次进入展示，并衔接首日级别/考期引导；
   - `Practice` 明确分层为 **DELF B2 四科真题与模考**（把 `RealListening` RFI 电台提升为一级入口，新增倍速、A-B 复读与原文点击跳转）与 **基础词汇拼写训练**。
2. - [x] **Studio 路由化与防丢保护**（[src/lib/router.ts](file:///Users/news/orca/projects/francais-b2/src/lib/router.ts)）：
   - 将 `MockExam`、`Speaking`、`Comprehension`、`Essay`、`RealListening`、`Drill`、`Expressions` 升格为正式 Hash 路由；
   - 在进行中的考练加离开确认守卫与 `beforeunload` 提示，彻底杜绝返回键静默丢进度；将 `window.confirm()` 统一替换为站内 `Sheet` 确认窗。
3. - [x] **教学闭环补全**（[src/store/conj.ts](file:///Users/news/orca/projects/francais-b2/src/store/conj.ts)、[src/lib/conjugation.ts](file:///Users/news/orca/projects/francais-b2/src/lib/conjugation.ts)、[src/lib/study-plan.ts](file:///Users/news/orca/projects/francais-b2/src/lib/study-plan.ts)、[src/pages/Learn.tsx](file:///Users/news/orca/projects/francais-b2/src/pages/Learn.tsx)）：
   - 对 `startLevel >= B2` 自动预解锁约 60 个核心高频不规则动词并补充 `impératif`；
   - `study-plan.ts` 真正消费 `compMisses` 与 `gramTags` 弱项，并开放用户自定义每日学习预算分钟数；
   - 为非语法类 `essayNotes`（用词/搭配/语域）与 `compMisses` 错题建立 FSRS 错题回炉微练；
   - 统一在 CE/PO/模考/听写/语法/变位输入区接入完整 `<AccentKeys />`；FSRS 复习页补齐答后手动微调评级与撤销，并修好听写音色跨步保持。
4. - [x] **首屏拆包与交互细节打磨**（[src/App.tsx](file:///Users/news/orca/projects/francais-b2/src/App.tsx)、[src/pages/Atlas.tsx](file:///Users/news/orca/projects/francais-b2/src/pages/Atlas.tsx)、[src/galaxy/Galaxy.tsx](file:///Users/news/orca/projects/francais-b2/src/galaxy/Galaxy.tsx)）：
   - 对大页面及大静态题库实施 `React.lazy` 路由/按需拆包；`⌘K` 扩展联合搜索 `LexDB` 与语法点；星图定位高亮目标星并弹出词条预览；图鉴消除同形词歧义与无障碍缺陷（`#/me` 无标签按钮、`#/compare` 热区）。

---

### Phase 4：全量词库精修、准生产级云同步与 CI 门禁
**目标**：彻底完成新旧词典统一与 B2 词汇内容精修，保障多端安全合并、离线鲁棒性与自动化发布门禁。

1. - [x] **全站词典统一与退役 `public/dict/`**：
   - 将 [src/ui/HomeDictionary.tsx](file:///Users/news/orca/projects/francais-b2/src/ui/HomeDictionary.tsx)、[src/pages/Read.tsx](file:///Users/news/orca/projects/francais-b2/src/pages/Read.tsx)、[src/ui/ExtractWords.tsx](file:///Users/news/orca/projects/francais-b2/src/ui/ExtractWords.tsx)、[src/ui/TranscriptWords.tsx](file:///Users/news/orca/projects/francais-b2/src/ui/TranscriptWords.tsx)、[src/ui/WordForm.tsx](file:///Users/news/orca/projects/francais-b2/src/ui/WordForm.tsx) 全部迁至 `LexDB`，下线 `public/dict/`（省 5.18 MB 并消除静态站 `frdic` 多余 404）；分片或按需加载 2.04 MiB 的 `suggest.json`。
2. - [x] **DELF B2 核心词库与 LexDB AI 批量精修**：
   - 清理 6 个 OCR 错拼词条与 319 个缺失 IPA 词条，把 4 词以上长短语迁出拼写头词表；
   - 提供可断点续跑的离线批量脚本（[scripts/enrich-b2-core.ts](file:///Users/news/orca/projects/francais-b2/scripts/enrich-b2-core.ts)）用于 DELF B2 核心词补齐搭配（`col`）、语域（`register`）与用法辨析（`tip`）（默认 `--dry-run`，需显式 `--apply` + API Key 执行）。
3. - [x] **字段级云同步合并 + 客户端 E2EE + 容错加固**（[src/sync/](file:///Users/news/orca/projects/francais-b2/src/sync/)、[src/store/](file:///Users/news/orca/projects/francais-b2/src/store/)、[server/](file:///Users/news/orca/projects/francais-b2/server/)）：
   - 云同步从整包二选一升级为按卡片学习时间 / 作文修改时间 / 错题 / 书签 ID 并集的字段级智能合并，并采用 `syncCode` 经 HKDF 派生密钥做客户端 AES-GCM E2EE；
   - 本地安全副本从 `localStorage` 迁入 `fb2-vault` IndexedDB，补齐 `window` `online` 重连刷新及 `exam-bank`/`essay.draft` 同步监听；
   - 全站加 React `ErrorBoundary`（带备份导出恢复入口），统一所有 IDB 封装复用连接与 `onclose`/`onversionchange` 重置；
   - 服务端补齐速率限制、前置流式体积校验与 `5191`/`localhost:5188` 来源白名单。
4. - [x] **完整 CI 质量门禁**（[.github/workflows/pages.yml](file:///Users/news/orca/projects/francais-b2/.github/workflows/pages.yml)）：
   - 纳入 root 与 server 测试、`tsc --noEmit`、`lexicon:check`、`lexicon:ids`、`lexdb:check` 以及跨平台 Linux Chromium E2E。
