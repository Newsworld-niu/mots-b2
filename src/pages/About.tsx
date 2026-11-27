import { ArrowUpRight, Github, Heart } from "lucide-react";
import { useAtlas } from "../atlas/context";
import { REPO_URL, UPSTREAM_REPO_URL } from "../config";

const BASE = import.meta.env.BASE_URL;

export function About() {
  const atlas = useAtlas();
  return (
    <div className="page about">
      <header className="about-hero">
        <img src={`${BASE}brand/og.webp`} alt="" />
        <div>
          <p className="eyebrow">关于法语词光</p>
          <h1 className="display">DELF B2 全科备考，一词一个来历。</h1>
          <p className="lede">
            这是一份法语词图：界面与交互沿用 word-atlas，主词库来自四本法语词汇教材（A1 到 B2/C1.1）的索引与 DELF B2 词表，目前收录 {atlas.count.toLocaleString()} 个可见词条，每个词条标注来源文件与页码。没有教材来源的释义与例句单独标为「补充」；词条等级按所在教材和词频推定（显示为「推定」），没有逐词核实。补充释义与译文由 AI 辅助生成并经自动校验，尚未逐条人工审校。
          </p>
          <p className="lede">它免费、开源，无需注册账号。各部分授权不同，复用前请看下方「授权」一节。</p>
          <div className="about-actions">
            <a className="btn btn-primary" href={REPO_URL} target="_blank" rel="noreferrer">
              <Github size={18} /> 在 GitHub 上查看
            </a>
          </div>
        </div>
      </header>

      <div className="about-grid">
        <section className="panel">
          <h2 className="eyebrow">为什么记得住</h2>
          <ul className="feature-list">
            <li>
              <b>先看见。</b>每个词条都标明来源文件与页码，释义和例句分别注明是否来自原书。
            </li>
            <li>
              <b>再想起。</b>选义、看图补句、听音辨词、拼写，从认得走到会写。
            </li>
            <li>
              <b>刚好在快忘时重逢。</b>FSRS 是新版 Anki 用的开源记忆算法，只在你快要遗忘时安排复习。
            </li>
            <li>
              <b>分数诚实。</b>只算第一次作答。答错的词会换个题型再见一面，但不会抬高正确率。
            </li>
            <li>
              <b>进度只属于你。</b>无需注册账号，学习记录默认保存在本地浏览器，随时可以导出 JSON 备份。可选开启端到端加密（E2EE）云同步：数据在浏览器里加密后才上传，云端只存储加密密文；AI 与语音 Key 永远不会上传。
            </li>
          </ul>
        </section>

        <section className="panel">
          <h2 className="eyebrow">快捷键</h2>
          <dl className="keys">
            <div>
              <dt>
                <kbd>⌘</kbd>
                <kbd>K</kbd> 或 <kbd>/</kbd>
              </dt>
              <dd>搜索任何词</dd>
            </div>
            <div>
              <dt>
                <kbd>1</kbd>–<kbd>4</kbd>
              </dt>
              <dd>选择答案</dd>
            </div>
            <div>
              <dt>
                <kbd>Enter</kbd>
              </dt>
              <dd>确认 / 继续</dd>
            </div>
            <div>
              <dt>
                <kbd>←</kbd> <kbd>→</kbd>
              </dt>
              <dd>词卡里切换上一个、下一个</dd>
            </div>
            <div>
              <dt>
                <kbd>Esc</kbd>
              </dt>
              <dd>关闭弹窗</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <h2 className="eyebrow">内容从哪里来</h2>
          <p className="muted">
            词源文件：Claire Miquel《Vocabulaire progressif du français · avancé B2/C1.1》及其他三本词汇教材的索引与正文；Jean K. Mathieu《DELF B2 3000 mots pour réussir》（扫描件，经 OCR 识别）。中文释义参照 Larousse 法中词典，词性与阴阳性参照 fr.wiktionary；教材无例句时，部分例句为本站补充并明确标注。单词和例句的朗读由 Azure 神经语音合成（女声 fr-FR-DeniseNeural、男声 fr-FR-HenriNeural），词条卡片上可分别点「女」「男」收听；还没有录音的条目用浏览器的法语语音朗读。逐词插画不适用于法语词，显示为首字母牌。
          </p>
          <p className="muted">
            自己加词时的离线词典：原形、词性、阴阳性与读音来自 Lexique 3.83（lexique.org，CC BY-SA 4.0）；中文翻译来自法语维基词典（Wiktionnaire，经 wiktextract / kaikki.org 提取，CC BY-SA 4.0）；例句来自 Tatoeba（tatoeba.org，CC BY 2.0 FR）。自动填写的内容未经人工核对。
          </p>
          <p className="muted">
            几部分怎样配合：主词库的 {atlas.count.toLocaleString()} 个词条覆盖 A1 到 B2（来自 A1、A2–B1、B2/C1.1 三本 Vocabulaire progressif 与 DELF B2 3000 mots），是背词与复习的主体；查词时，主词库之外的词由 41,000+ 词的扩展法汉词典（LexDB）兜底；66 个语法点从 A1 讲到 B2，每点配有练习；「漫游」里的书影音馆收录法美双重公有领域的法语经典与本站原创的双语微读。
          </p>
          <p className="muted">本站不是官方 DELF/DALF、TCF 或 TEF 词表与真题，与 France Éducation international 及 CCI Paris Île-de-France 无关，也不承诺通过考试。</p>
        </section>

        <section className="panel">
          <h2 className="eyebrow">授权</h2>
          <ul className="feature-list">
            <li>
              <b>源代码与界面：</b>MIT 许可。
            </li>
            <li>
              <b>教材内容：</b>词头的选取与顺序、页码及教材原句，版权归原作者与出版方所有，仅供个人学习，不在开源再授权范围内。
            </li>
            <li>
              <b>本站原创补充：</b>补充释义、例句与译文，66 个语法精讲与练习题，采用 CC BY 4.0。
            </li>
            <li>
              <b>扩展法汉词典（LexDB，41,000+ 词）：</b>整合 Lexique 3.83、Wiktionnaire、Tatoeba、CFDICT、WOLF 等开放来源，开源部分遵循 CC BY-SA 4.0 及各上游的署名协议。
            </li>
          </ul>
          <p className="muted">
            界面原型基于{" "}
            <a className="link" href={UPSTREAM_REPO_URL} target="_blank" rel="noreferrer">
              word-atlas
            </a>
            ；逐项来源、署名格式与例外（如 RFI 广播文稿、未开放授权的词关系列表）见本项目仓库中的{" "}
            <a className="link" href={`${REPO_URL}/blob/main/CONTENT_LICENSE.md`} target="_blank" rel="noreferrer">
              <code>CONTENT_LICENSE.md</code>
            </a>
            。
          </p>
        </section>

        <section className="panel">
          <h2 className="eyebrow">给开发者</h2>
          <p className="muted">
            <code>data/lexicon.json</code> 是主词库的源文件，<code>data/grammar/</code> 是语法讲解与练习；<code>public/atlas</code> 里是网页用的分块数据。复用时请按各部分的授权：原创补充内容按 CC BY 4.0 署名，LexDB 按 CC BY-SA 4.0 署名并相同方式共享；取自教材的部分不能再发布。
          </p>
          <a className="link" href={`${REPO_URL}#readme`} target="_blank" rel="noreferrer">
            阅读文档 <ArrowUpRight size={14} />
          </a>
        </section>
      </div>
      <p className="colophon">
        <Heart size={14} /> 做给每一个在背单词的人。
      </p>
    </div>
  );
}
