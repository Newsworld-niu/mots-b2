import { ArrowUpRight, Github, Heart } from "lucide-react";
import { useAtlas } from "../atlas/context";
import { REPO_URL } from "../config";

const BASE = import.meta.env.BASE_URL;

export function About() {
  const atlas = useAtlas();
  return (
    <div className="page about">
      <header className="about-hero">
        <img src={`${BASE}brand/og.webp`} alt="" />
        <div>
          <p className="eyebrow">关于法语词光</p>
          <h1 className="display">基础到 B2，一词一个来历。</h1>
          <p className="lede">
            这是一份法语词图：界面与交互沿用 word-atlas，词条来自可追溯的教材索引与 DELF 词表。目前收录 {atlas.count.toLocaleString()} 个可见词条，每个词条标注来源文件与页码。没有来源的释义与例句单独标为「补充」，等级未核实的词条显示为「等级待核实」，不套用教材封面的等级。释义与译文多为补充翻译，状态为「待核对」，整库尚未逐条人工核实。
          </p>
          <p className="lede">它免费、开源、无需注册。代码用 MIT，词库用 CC BY 4.0，谁都可以拿去用。</p>
          <div className="about-actions">
            <a className="btn btn-primary" href={REPO_URL} target="_blank" rel="noreferrer">
              <Github size={18} /> 在 GitHub 上查看
            </a>
          </div>
        </div>
      </header>

      <div className="about-grid">
        <section className="panel">
          <h3 className="eyebrow">为什么记得住</h3>
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
              <b>进度只属于你。</b>没有账号，没有服务器，数据存在你的浏览器里，随时能导出。
            </li>
          </ul>
        </section>

        <section className="panel">
          <h3 className="eyebrow">快捷键</h3>
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
          <h3 className="eyebrow">内容从哪里来</h3>
          <p className="muted">
            词源文件：Claire Miquel《Vocabulaire progressif du français · avancé B2/C1.1》及其他三本词汇教材的索引与正文；Jean K. Mathieu《DELF B2 3000 mots pour réussir》（扫描件，经 OCR 识别）。中文释义参照 Larousse 法中词典，词性与阴阳性参照 fr.wiktionary；教材无例句时，部分例句为本站补充并明确标注。单词和例句的朗读由 Azure 神经语音合成（女声 fr-FR-DeniseNeural、男声 fr-FR-HenriNeural），词条卡片上可分别点「女」「男」收听；还没有录音的条目用浏览器的法语语音朗读。逐词插画不适用于法语词，显示为首字母牌。
          </p>
          <p className="muted">
            自己加词时的离线词典：原形、词性、阴阳性与读音来自 Lexique 3.83（lexique.org，CC BY-SA 4.0）；中文翻译来自法语维基词典（Wiktionnaire，经 wiktextract / kaikki.org 提取，CC BY-SA 4.0）；例句来自 Tatoeba（tatoeba.org，CC BY 2.0 FR）。自动填写的内容未经人工核对。
          </p>
          <p className="muted">本站不是官方 DELF/DALF 词表，也不承诺通过考试。基础到 A2 的内容目前只有补充词条，尚未有教材来源，见「我的」页与仓库中的导入报告。</p>
        </section>

        <section className="panel">
          <h3 className="eyebrow">给开发者</h3>
          <p className="muted">
            <code>data/word-atlas.json</code> 和 <code>.csv</code> 是完整词库；<code>public/atlas</code> 里是网页用的分块数据、插画和音频。拿去做 Anki 牌组、背词小程序、浏览器插件，或者 AI 应用的评测集，署名即可。
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
