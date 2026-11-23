# 法语词光（Mots B2）产品级演进总蓝图（Phase 5 – Phase 8）

> 本文档在 [Phase 1–4 成熟化改进路线图](file:///Users/news/orca/projects/francais-b2/docs/IMPROVEMENT_ROADMAP.md) 全部验收落地后制定，聚焦将「法语词光」从高完成度极客自用工具升级为**商用级、极高稳定性的 DELF B2 备考产品**（暂不涉及版权与人工逐条核实议题）。

---

## 一、已对齐的产品与架构共识

1. **产品定位与运营形态**：**极致打磨的小圈子 / 个人主力 DELF B2 产品**——保持静态前端 + 轻量 Azure 同步后端 + BYOK（暂不做公网账号注册、订阅支付与托管 AI 计费网关），把全部精力聚焦在零崩坏稳定性、真提分教研闭环、丝滑 BYOK 体验和商用级产品质感。
2. **媒体与资产外迁**：重型静态音频（单词 431 MB + RFI 28 MB + 新增 CO 多角色 MP3）外迁至**现有 Azure Blob Storage**（复用 [server/deploy.sh](file:///Users/news/orca/projects/francais-b2/server/deploy.sh) 同资源组，前端通过 `VITE_MEDIA_BASE_URL` 解耦并保留本地开发回退、增量上传脚本及 PWA 可选「离线学习包下载」），彻底解除 GitHub Pages 1 GB 限额与构建拷贝瓶颈。
3. **信息架构与跨端体验**：桌面端与 **390px 移动端一并打磨至主力可用**，双端统一为 DELF B2 导向的 **5 大板块**（`今日` / `应试`[含精读与 CE 双模式] / `词库`[词典 + 图鉴 + 卡组 + 辨析] / `语法`[语法 + 变位] / `我的`），首页聚焦今日四科任务勾稽（下沉 `HomeDictionary`），将四处分散错题收拢为统一 4-Tab 错题中心。
4. **DELF B2 教研闭环深度**：**Tier A（核心闭环）→ Tier B（进阶提分体系）分阶段全量落地**——覆盖 CO 多角色真人感 MP3、RFI 精确句级时间戳与原声切片跟读、真题快照错题回炉、PO 口语历史档案与二稿复述、MockExam 历次档案与 PDF 诊断单、四科趋势与 15 主题覆盖矩阵、`urgent` 考前冲刺模式、FSRS 防雪崩机制、B2 词汇搭配/语域/同义词深度练习、法国实例与论点库、语境变位及听读微技能专练。
5. **完整产品级工程治理**：云同步实现 **v1→v2 无感向后兼容零知识 E2EE** + 删除 Tombstone + 服务端前置鉴权与抗伪造限流；BYOK 重做为 1 步向导 + 免 Key 交互式样张预览；首屏主 JS 压至 `<350 KB` 且剔除 2.5 MB 首页抢跑 `grammar.json`；模块化拆分 `store.ts`、1,000+ 行超大页面及 9,651 行 `app.css`；清理废弃 Capacitor / `build-dict.py` / `archive` / 386 KB `@anthropic-ai/sdk`（保留活跃 LexDB 适配器 [src/lib/dict.ts](file:///Users/news/orca/projects/francais-b2/src/lib/dict.ts)）；CI 接入 ESLint、React 组件测试与离线/390px 移动端 E2E 门禁。

---

## 二、分阶段实施计划（Phase 5 – Phase 8）

### Phase 5：P0 止血、考场修复、真零知识同步与首屏 `<350 KB`（当前冲刺）
**目标**：彻底消除所有崩溃、死循环、分数失真、同步丢稿与冷启动臃肿，建立生产级安全与离线底盘。

- [x] **PWA 离线拆包崩溃修复与 CSS Token 止血**（[vite.config.ts](file:///Users/news/orca/projects/francais-b2/vite.config.ts)、[public/sw.js](file:///Users/news/orca/projects/francais-b2/public/sw.js)、[src/ui/ErrorBoundary.tsx](file:///Users/news/orca/projects/francais-b2/src/ui/ErrorBoundary.tsx)、[src/styles/listening.css](file:///Users/news/orca/projects/francais-b2/src/styles/listening.css)）：
  - 构建期生成 `precache-manifest.json` 列出全部懒加载 JS/CSS chunk 供 `sw.js`（`atlas-v6`）安装预缓存，断网切入未访问路由不崩溃；
  - `ErrorBoundary` 修复浅色模式 `var(--surface)` 对比度崩坏，并识别 `ChunkLoadError` / CSS preload 失败提供受控刷新恢复；
  - 修复 `listening.css` 8 处未定义 Token（`--bg`/`--muted`/`--rose`）。
- [x] **`#/learn` 排版与 `Dict.tsx` 死循环修复**（[src/styles/app.css](file:///Users/news/orca/projects/francais-b2/src/styles/app.css)、[src/pages/Dict.tsx](file:///Users/news/orca/projects/francais-b2/src/pages/Dict.tsx)）：
  - 修复 `#/learn` 桌面端 `.feedback-regrade` 挤塌词义左栏与移动端 390px 切卡动画 4–18px 横向溢出；
  - 修复 `Dict.tsx` `HistoryFavShelf` 内联 `onLoadedRows` 触发的无限重渲染死循环，以及全量遍历收藏导致最多 124 分片并发请求风暴。
- [x] **`MockExam` 考场/语音修复、`Drill` Whisper 兜底与 AI/语音稳定性**（[src/pages/MockExam.tsx](file:///Users/news/orca/projects/francais-b2/src/pages/MockExam.tsx)、[src/pages/Drill.tsx](file:///Users/news/orca/projects/francais-b2/src/pages/Drill.tsx)、[src/ai/clients.ts](file:///Users/news/orca/projects/francais-b2/src/ai/clients.ts)、[src/ai/pronunciation.ts](file:///Users/news/orca/projects/francais-b2/src/ai/pronunciation.ts)、[src/lib/speech.ts](file:///Users/news/orca/projects/francais-b2/src/lib/speech.ts)）：
  - `MockExam` 补齐 PO 辩论录音与 Whisper/Azure 转写、消除独白重复调 Whisper 并丢弃结果、修复自由节奏强行锁卷与断点续考（恢复 PO 计时与 `coHeard`）、对齐 CE 高亮/排除/解析与 `typed` 诚实展示、标注套卷 4 听力复用提示；
  - `Drill.tsx` 补齐 Whisper STT 兜底；
  - 自定义 `openaiBaseUrl` 遇 400 自动降级兼容（`json_schema → json_object → 文本 JSON`、`max_completion_tokens → max_tokens`）+ 结构化探活；用原生 `fetch` 替换 386 KB `@anthropic-ai/sdk`；
  - 修复 `pronunciation.ts` 无超时挂起、`speech.ts` Safari 同步重启与 Android 重复片段、及 `AiSettings` Blob URL 泄漏。
- [x] **全科综合打卡/热力图、口径去污染、离线写作闭环与防误操**（[src/lib/activity.ts](file:///Users/news/orca/projects/francais-b2/src/lib/activity.ts)、[src/lib/exam.ts](file:///Users/news/orca/projects/francais-b2/src/lib/exam.ts)、[src/lib/study-plan.ts](file:///Users/news/orca/projects/francais-b2/src/lib/study-plan.ts)、[src/pages/Today.tsx](file:///Users/news/orca/projects/francais-b2/src/pages/Today.tsx)、[src/pages/Essay.tsx](file:///Users/news/orca/projects/francais-b2/src/pages/Essay.tsx)、[src/ui/Marking.tsx](file:///Users/news/orca/projects/francais-b2/src/ui/Marking.tsx)、[src/lib/router.ts](file:///Users/news/orca/projects/francais-b2/src/lib/router.ts)）：
  - 统一全站活动聚合器驱动连签/本周柱图/热力图；修复 `Today.tsx` 今日目标随作答缩水；
  - 取消单科 `×4` 虚假 `/100` 外推；为 `ExamResult` 增加 `level`/`scope` 隔离 B1 作文、7 分小题与 RFI 小测污染；统一 `ExamDashboard` 与 `study-plan.ts` 口径；
  - 清理 `0／1／3／5` 残留文案，补齐离线写作 0–5 自评与二稿对比，`Marking` 明确展示跨维度封顶明细；
  - 修复 `router.ts` 历史栈覆写，补齐页内返回确认、全站高价值练习 `useNavGuard`、写作删稿确认及 `#/me` 清空记录同步清理模考草稿 + 重开引导入口。
- [x] **v1→v2 无感真零知识云同步、Tombstone、服务端加固与 CI 变量修复**（[src/sync/](file:///Users/news/orca/projects/francais-b2/src/sync/)、[server/](file:///Users/news/orca/projects/francais-b2/server/)、[src/store/store.ts](file:///Users/news/orca/projects/francais-b2/src/store/store.ts)、[.github/workflows/pages.yml](file:///Users/news/orca/projects/francais-b2/.github/workflows/pages.yml)）：
  - `HKDF` 密钥分离 `authToken` 与永不出端 `encKey`，客户端与服务端实现 `alias.json` v1→v2 无感双轨升级；
  - 服务端将限流/鉴权前置到 `readBody` 之前，加固 IP 识别与有界限流；
  - 引入删除 Tombstone 消除多端删除复活，`pickNewerTextMap` 改按时间戳合并，对齐 `typing` 上限（500）；修正 `VITE_SYNC_URL` CI 变量。
- [x] **首屏主包压至 `<350 KB` & 剔除 2.5 MB 首页抢跑 `grammar.json`**（[scripts/build-grammar.ts](file:///Users/news/orca/projects/francais-b2/scripts/build-grammar.ts)、[src/atlas/grammar.ts](file:///Users/news/orca/projects/francais-b2/src/atlas/grammar.ts)、[src/pages/Today.tsx](file:///Users/news/orca/projects/francais-b2/src/pages/Today.tsx)、[src/App.tsx](file:///Users/news/orca/projects/francais-b2/src/App.tsx)）：
  - 产出 `public/atlas/grammar-meta.json`（~4 KB）供首页使用；
  - 迁出 `families.json` 按需加载，懒加载 `WordSheet`/`EntryView`、`HomeDictionary`、`PlacementTest`、`FamilyPicker` 并剥离 `store.ts` / `Today.tsx` 对大题库的静态引用。

---

### Phase 6：双端统一 5 板块 IA 重构、BYOK 体验重做与移动端/无障碍精修
**目标**：从“功能堆砌的极客界面”蜕变为桌面 & 390px 手机双端一致、层级清晰、零配置门槛的产品界面。

- [x] **双端统一 5 大板块导航与信息架构去重**：
  - 统一桌面顶栏与手机底栏为 `今日` / `应试`（含 CO/CE+精读双模式/PE/PO/模考/真实听力/微练） / `词库`（词典+图鉴+卡组+辨析） / `语法`（语法+变位） / `我的`，消除 6 路由底栏失焦；
  - 重做 `Today` 为 DELF B2 今日备考台（去重 3 处 `ExamDashboard`、下沉 `HomeDictionary`、新用户 3 分钟破冰引导、刷新品牌文案与 `manifest.webmanifest` 启动屏 + SEO/robots 可控配置）；
  - 升级 `#/reflow` 为统一 4-Tab 错题中心（错词 / 语法 / 写作口语错句 / 听读真题陷阱）。
- [x] **BYOK 1 步向导与免 Key 交互式样张预览**：
  - 重做 `AiSettings` 为「1 步选方案 + 贴 1 个 Key 自动配齐并探活」（高级分工折叠）；无 Key 时在 PE/PO/段落升格提供可交互高分批改样张；把 `Read` 10 篇免费精选读物提到首屏，统一全站 6 处旧术语“生成卡片服务”。
- [x] **390px 移动端主力级体验 & WCAG 无障碍精修**：
  - 收紧 `#/dict` 390px 首屏元数据折叠；`#/conj` 默认收敛为高频 B2 时态（~40 题，CTA 首屏可见）；优化 `#/read` 熟悉度上色为柔和下划线；修复 `Me.tsx` 重复时长按钮；为 `#/compare` 与 `#/grammar` 增加分类折叠与快捷目录；
  - 修复 `Palette` 切页关闭/全局 `Esc`/可点关闭按钮/`scrollIntoView`/ARIA `listbox` 规范；消除 `Learn.tsx` 嵌套 `<main>`；修复 Lighthouse 对比度、标题跳级、`label-content-name-mismatch`、`EssayTrend` `tablist` 语义、全站 ≥44px 触控热区与轻量骨架屏。

---

### Phase 7：DELF B2 教研闭环跃迁（Tier A + Tier B）与 Azure Blob 媒体外迁
**目标**：解除 494 MB 仓库体积与构建耗时瓶颈，落地全量商用级 DELF B2 提分闭环。

- [x] **Azure Blob Storage 媒体外迁与 PWA 离线包管理**：
  - 扩展 `server/deploy.sh` + 增量同步脚本将重型音频迁至 Azure Blob 静态容器（`Cache-Control: immutable` + CORS），前端接入 `VITE_MEDIA_BASE_URL` 并保留本地开发回退；清理 12 个孤儿 MP3 与 `.DS_Store`；在 `Me` 提供「离线学习包下载与存储配额管理」。
- [x] **Tier A 核心教研闭环**：
  - 合成并挂载 ≥5 套 CO 多角色/多口音 MP3；为 6 期 RFI 生成句级时间戳 JSON 并打通 `<IntensiveDoc>` 原声切片听写与跟读；
  - 升级 `CompMiss` 快照，`MistakeReflow` 实现真题重做 + 写作/口语非语法错自动收割与新句迁移；
  - 建设 PO 口语历史档案（复用 `recordings` IDB、音素曲线、二稿复述对比）与 MockExam 历次档案（多场云同步 + 可打印 PDF 诊断单 + 一键生成下周补强任务）；
  - 激活 `urgent`（≤30 天）冲刺模式与 `Today` 当日任务完成态勾稽；升级驾驶舱为四科趋势图 + 15 主题覆盖矩阵 + `retrievability()` 遗忘高危预警 + 周报；词汇 FSRS 增加 Daily Review Cap 与 Leech 管理。
- [x] **Tier B 进阶提分体系**：
  - 跑通 `enrich-b2-core` 补齐 3,279 个 B2 词搭配/语域/辨析/同义与 245 缺失 IPA，在 `Learn` 解锁搭配完形与语域升格题型；
  - 补齐 15 大 DELF B2 主题全覆盖 PE/PO 题库 + 法国实例论点库（Banque d'arguments）+ 写前审题核对单 + 段落升格一键入 FSRS；扩充语篇语法 6→20 篇并接入 `gramTags`/FSRS；`Conj` 增加句境时态判断+变位模式；上线听读高权重微技能 5 分钟专练；`PlacementTest` 增加可选 3 分钟微产出诊断。

---

### Phase 8：完整代码模块化重构、废弃清理与产品级 CI 门禁
**目标**：重构 6 万行代码库架构，建立长期可维护性与自动化零回归防线。

- [x] **状态层、超大组件与全局 CSS 解耦**：
  - 按业务域拆分 `store.ts`（1,206 行）并替换 14 处整树订阅 + 避免 250ms 主线程全量序列化；为 `lexdb`/`atlas`/`images` 增加 LRU 淘汰；虚拟化 `Decks` 长列表与防抖 `Atlas` 搜索；
  - 拆分 `Dict.tsx`/`MockExam.tsx`/`Speaking.tsx`/`Grammar.tsx`/`Comprehension.tsx`/`RealListening.tsx` 及 `src/ai/tasks.ts`；收敛 `app.css`（9,651 行、15+ 断点）为统一 Token + 4 档标准断点 + 模块化 CSS，清理 68 处内联样式。
- [x] **仓库瘦身、运行时校验与 CI 质量门禁**：
  - 移除废弃 7 个 `@capacitor/*` 依赖、`scripts/build-dict.py`、`lexicon:dict` 与 `archive/v1-own-ui/`（保留活跃 `src/lib/dict.ts`）；补齐 `ActiveSession` 与 `lexdb` 严格运行时校验；清理 `deploy.sh` 硬编码 Subscription ID；
  - CI（`pages.yml`）接入 ESLint、CSS 未定义 Token 静态检查、首屏 JS 体积预算门禁、React 组件测试，以及 Playwright 断网离线切页 / 云同步合并 / 390px 移动端 E2E 回归。
