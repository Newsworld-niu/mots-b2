import { ArrowLeftRight, ArrowRight, BookOpenCheck, Check, Ear, FileText, Headphones, Keyboard, Languages, MessageSquareQuote, Mic, PenLine, RotateCcw, Sparkles, Timer, Type, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { prefetch, useAtlas } from "../atlas/context";
import { MEDIA, type Accent, type Entry, type WordRef } from "../atlas/types";
import { makeSentences } from "../ai/tasks";
import { deckWords } from "../store/decks";
import { play, stopAudio } from "../lib/audio";
import { cue } from "../lib/sound";
import { hashSeed, shuffle } from "../lib/text";
import { translatable } from "../lib/writing";
import { ready, useAiConfig } from "../ai/config";
import { href } from "../lib/router";
import { clean, correctCharacterCount, same, typingDelta, typingMetrics } from "../lib/typing";
import { ARTICLE, ARTICLE_CHOICES, articleTone, isArticleCorrect } from "../lib/gender";
import { isTaughtReady } from "../store/session";
import { useKeys } from "./Learn";
import { store, useStore } from "../store/store";
import { AmbiencePicker } from "../ui/Ambience";
import { AccentKeys } from "../ui/AccentKeys";
import { Illustration } from "../ui/Illustration";
import { VoicePick } from "../ui/EntryView";
import { toast } from "../ui/Toast";
import { ComprehensionStudio } from "./Comprehension";
import { EssayStudio } from "./Essay";
import { SpeakingStudio } from "./Speaking";
import { DrillStudio } from "./Drill";
import { ExprStudio } from "./Expressions";
import { EXPRESSIONS } from "../lib/expressions";
import { coreSet, CORE_LABEL, isCore } from "../lib/core-words";
import { DRILL_QUESTIONS } from "../lib/drill";
import { SPEAKING_SUBJECTS, TOPICS } from "../lib/exam";
import { ESSAY_TASKS } from "../lib/essay";
import { WritingRound, type WritingMode } from "./Writing";
import { PRACTICE_SOURCES as SOURCES, type PracticeSource as Source } from "../lib/practice-source";
import { PracticeSourcePicker } from "../ui/PracticeSource";

/** Modes that open a page of their own instead of a round on the learner's words. */
type Studio = "essay" | "listen" | "examread" | "speak" | "drill" | "expr";
type Mode = "word" | "sentence" | "dictation" | "gender" | Studio | WritingMode;
type TypingMode = Exclude<Mode, "gender" | Studio | WritingMode>;
const isStudio = (m: Mode): m is Studio => m === "essay" || m === "listen" || m === "examread" || m === "speak" || m === "drill" || m === "expr";
const isWriting = (m: Mode): m is WritingMode => m === "translate" || m === "compose";

const MODES: [Mode, string, string, typeof Type][] = [
  ["word", "单词", "看图写出单词", Type],
  ["sentence", "例句", "照着抄写，练出手感", Keyboard],
  ["dictation", "听写", "只听声音，写下整句", Headphones],
  ["gender", "冠词", "un 还是 une，快速判断", ArrowLeftRight],
  ["translate", "中译法", "看中文，自己写出法语句子", Languages],
  ["compose", "造句", "用这个词写一句话，AI 批改", PenLine],
  ["expr", "表达", "连接词、论证句型、信函套话，填空复习", MessageSquareQuote],
  ["essay", "篇章", "按题目写一封信或一篇短文", FileText],
  ["listen", "听力理解", "按真题题型：三个练习一套", Ear],
  ["examread", "应试阅读", "按真题题型：三篇一套，限时", BookOpenCheck],
  ["speak", "口语", "抽题、准备、独白、辩论", Mic],
  ["drill", "一分钟口语", "想 15 秒，说 60 秒，录音回放", Timer],
];

/** Choices remembered on this device: the decks to practise from and whether 听写 / 中译法 use AI sentences. */
const PREF = "word-atlas:practice:";
const readPref = (k: string) => {
  try {
    return localStorage.getItem(PREF + k);
  } catch {
    return null;
  }
};
const writePref = (k: string, v: string) => {
  try {
    localStorage.setItem(PREF + k, v);
  } catch {
    /* not remembered */
  }
};
/** Modes that are about a whole sentence: the card's own, or a new one the AI writes. */
const usesSentences = (m: Mode) => m === "dictation" || m === "translate";
/** Modes where the learner produces the word: by default only core words (会用), see lib/core-words. */
const isProductive = (m: Mode) => m === "word" || isWriting(m);
const NO_EX_AUDIO = ~(MEDIA.ex | MEDIA.exM | MEDIA.ex2 | MEDIA.ex2M);

export function Practice() {
  const atlas = useAtlas();
  const progress = useStore((s) => s.progress);
  const startLevel = useStore((s) => s.settings.startLevel);
  const [mode, setMode] = useState<Mode>("word");
  const [source, setSourceState] = useState<Source>(() => {
    const kept = readPref("source") as Source | null;
    if (kept && SOURCES.some(([k]) => k === kept)) return kept;
    return Object.keys(progress.cards).length ? "recent" : "path";
  });
  const setSource = (s: Source) => {
    setSourceState(s);
    writePref("source", s);
  };
  // 选卡组: which decks (the initial deck and the learner's own); nothing chosen = the learner's own decks, or the initial deck
  const [deckSel, setDeckSel] = useState<string[]>(() => (readPref("decks") ?? "").split(",").filter(Boolean));
  const deckList = useMemo(() => (progress.decks ?? []).map((d) => ({ id: d.id, name: d.name })), [progress.decks]);
  const chosenDecks = useMemo(() => {
    const valid = deckSel.filter((id) => deckList.some((d) => d.id === id));
    if (valid.length) return valid;
    return deckList.map((d) => d.id);
  }, [deckSel, deckList]);
  const toggleDeck = (id: string) => {
    const next = chosenDecks.includes(id) ? chosenDecks.filter((x) => x !== id) : [...chosenDecks, id];
    setDeckSel(next);
    writePref("decks", next.join(","));
  };
  // 听写、中译法: the card's own sentences, or new ones written by the AI for this round
  const [aiSentences, setAiSentencesState] = useState(() => readPref("ai-sentences") === "1");
  const setAiSentences = (v: boolean) => {
    setAiSentencesState(v);
    writePref("ai-sentences", v ? "1" : "0");
  };
  // 单词、中译法、造句: only 会用 words, or every word of the source
  const [coreOnly, setCoreOnlyState] = useState(() => readPref("core-only") !== "0");
  const setCoreOnly = (v: boolean) => {
    setCoreOnlyState(v);
    writePref("core-only", v ? "1" : "0");
  };
  const coreFilter = coreOnly && isProductive(mode);
  const [busy, setBusy] = useState(false);
  const aiCtrl = useRef<AbortController | null>(null);
  useEffect(() => () => aiCtrl.current?.abort(), []);
  const [round, setRound] = useState<{ entries: Entry[]; key: number } | null>(null);
  const [drill, setDrill] = useState<{ refs: WordRef[]; key: number } | null>(null);
  const [writing, setWriting] = useState<{ mode: WritingMode; entries: Entry[]; key: number } | null>(null);
  const [studio, setStudio] = useState<Studio | null>(null);
  const ai = useAiConfig();
  // 造句 has no book sentence to compare with: it needs the AI
  const needsAi = mode === "compose" && !ready.text(ai);
  const aiOn = usesSentences(mode) && aiSentences && ready.text(ai);

  const pool = useMemo(() => {
    const learned = Object.entries(progress.cards)
      .sort((a, b) => (b[1].last ?? 0) - (a[1].last ?? 0))
      .map(([id]) => id);
    const ids =
      source === "recent"
        ? learned
        : source === "mistakes"
          ? progress.mistakes
          : source === "saved"
            ? progress.bookmarks
            : source === "decks"
              ? [...new Set(chosenDecks.flatMap((d) => deckWords(atlas, progress, d)))].filter((id) => mode !== "gender" || isTaughtReady(atlas.byId.get(id)!))
              : atlas.words.filter((w) => w.cefr >= startLevel && (mode !== "gender" || (w.g && isTaughtReady(w))) && (!coreFilter || isCore(atlas, w.id))).slice(0, 400).map((w) => w.id);
    // the article drill only uses nouns with a quizzable gender
    return ids.filter((id) => atlas.byId.has(id) && (mode !== "gender" || !!atlas.byId.get(id)!.g) && (!coreFilter || isCore(atlas, id)));
  }, [atlas, progress, source, startLevel, mode, chosenDecks, coreFilter]);

  /** A round's draw: from the whole of the chosen decks, otherwise from the first words of the source. */
  const draw = (n: number, from = 60) => shuffle(source === "decks" ? pool : pool.slice(0, from), hashSeed(String(Date.now()))).slice(0, n);

  /** The words with a new sentence each, written by the AI (no recording: it is read by the speech service or the device). */
  const withAiSentences = async (entries: Entry[]): Promise<Entry[] | null> => {
    aiCtrl.current?.abort();
    const c = new AbortController();
    aiCtrl.current = c;
    setBusy(true);
    try {
      const level = atlas.cefr[startLevel] ?? "B1";
      const got = await makeSentences(
        entries.map((e) => ({ key: e.id, word: e.w, pos: e.senses[0]?.pos ?? "", zh: e.senses[0]?.zh ?? "", avoid: e.ex.map((x) => x.en) })),
        level,
        c.signal,
      );
      const by = new Map(got.map((x) => [x.key, x]));
      return entries
        .filter((e) => by.has(e.id))
        .map((e) => ({ ...e, ex: [{ en: by.get(e.id)!.fr, zh: by.get(e.id)!.zh }], m: e.m & NO_EX_AUDIO, ...(e.media ? { media: { ...e.media, ex: null, ex2: null } } : {}) }));
    } catch (err) {
      if (!c.signal.aborted) toast((err as Error).message || "AI 出题失败", "warn");
      return null;
    } finally {
      if (aiCtrl.current === c) setBusy(false);
    }
  };

  const start = async () => {
    if (mode === "gender") {
      const refs = draw(20, 120).map((id) => atlas.byId.get(id)!);
      if (refs.length) setDrill({ refs, key: Date.now() });
      return;
    }
    if (isWriting(mode)) {
      if (aiOn) {
        const words = (await prefetch(atlas, draw(5))).filter((e): e is Entry => !!e && isTaughtReady({ zh: e.senses[0]?.zh ?? "" }));
        const entries = await withAiSentences(words);
        if (entries?.length) setWriting({ mode, entries, key: Date.now() });
        return;
      }
      // more than a round's worth, since some words have no sentence to translate
      const ids = draw(15);
      const entries = (await prefetch(atlas, ids)).filter((e): e is Entry => !!e && (mode === "compose" || !!translatable(e.ex))).slice(0, 5);
      if (entries.length) setWriting({ mode, entries, key: Date.now() });
      else toast("这些词还没有带中文翻译的例句，换个来源试试", "warn");
      return;
    }
    if (aiOn) {
      const words = (await prefetch(atlas, draw(10))).filter((e): e is Entry => !!e && isTaughtReady({ zh: e.senses[0]?.zh ?? "" }));
      const entries = await withAiSentences(words);
      if (entries?.length) setRound({ entries, key: Date.now() });
      return;
    }
    const ids = draw(10);
    const entries = (await prefetch(atlas, ids)).filter((e): e is Entry => !!e && (mode === "word" || e.ex.length > 0));
    if (entries.length) setRound({ entries, key: Date.now() });
  };

  if (drill) return <GenderDrill key={drill.key} refs={drill.refs} onExit={() => setDrill(null)} onAgain={start} />;
  if (studio === "essay") return <EssayStudio onExit={() => setStudio(null)} />;
  if (studio === "listen") return <ComprehensionStudio key="listen" kind="listen" onExit={() => setStudio(null)} />;
  if (studio === "examread") return <ComprehensionStudio key="read" kind="read" onExit={() => setStudio(null)} />;
  if (studio === "speak") return <SpeakingStudio onExit={() => setStudio(null)} />;
  if (studio === "drill") return <DrillStudio onExit={() => setStudio(null)} />;
  if (studio === "expr") return <ExprStudio onExit={() => setStudio(null)} />;
  if (writing) return <WritingRound key={writing.key} mode={writing.mode} entries={writing.entries} onExit={() => setWriting(null)} onAgain={start} />;
  if (round && !isWriting(mode) && mode !== "gender" && !isStudio(mode)) return <TypingRound key={round.key} mode={mode} entries={round.entries} onExit={() => setRound(null)} onAgain={start} />;

  const best = progress.typing.filter((t) => t.mode === mode).reduce((m, t) => Math.max(m, t.wpm), 0);
  return (
    <div className="page practice">
      <header className="page-head">
        <p className="eyebrow">练习 · Typing Studio</p>
        <h1 className="display">让手，也记住它们。</h1>
        <p className="lede">打字练拼写和手感，成句练把词用出来；都不会改动记忆进度。</p>
        <a className="btn btn-ghost practice-compare" href="#/compare">
          易混词辨析：ou / où、voir / regarder …… <ArrowRight size={16} />
        </a>
      </header>
      <div className="practice-grid">
        <section className="panel">
          <h3 className="eyebrow">模式</h3>
          <div className="mode-cards">
            {MODES.map(([k, name, desc, Icon]) => (
              <button key={k} className={`mode-card ${mode === k ? "is-on" : ""}`} onClick={() => setMode(k)} aria-pressed={mode === k}>
                <Icon size={22} strokeWidth={1.7} />
                <b>{name}</b>
                <small>{desc}</small>
              </button>
            ))}
          </div>
          {!isStudio(mode) && <PracticeSourcePicker source={source} onSource={setSource} decks={deckList} chosenDecks={chosenDecks} onDeck={toggleDeck} />}
          {isProductive(mode) && (
            <>
              <h3 className="eyebrow">练哪些词</h3>
              <div className="segmented segmented-wide" role="group" aria-label="练哪些词">
                <button className={coreOnly ? "is-on" : ""} onClick={() => setCoreOnly(true)} aria-pressed={coreOnly}>
                  只练「{CORE_LABEL}」词
                </button>
                <button className={!coreOnly ? "is-on" : ""} onClick={() => setCoreOnly(false)} aria-pressed={!coreOnly}>
                  全部词
                </button>
              </div>
              {coreOnly && <p className="muted small">「{CORE_LABEL}」是写作、口语要用出来的 {coreSet(atlas).size} 个常用词和考试话题词；其余的词看懂就行，不必默写。</p>}
            </>
          )}
          <p className="muted">
            {mode === "essay"
              ? `${ESSAY_TASKS.length} 个题目：邮件、叙事、论坛发帖、正式信件、求职信、读者来信、议论文，其中 3 个是先读材料再写。`
              : mode === "speak"
                ? `抽两个题选一个（内置 ${SPEAKING_SUBJECTS.length} 个，也可以让 AI 出新题）。`
                : mode === "expr"
                  ? `${EXPRESSIONS.length} 张表达卡：连接词、论证句型、话题搭配、语域、正式信函。看中文，在例句的空里写出法语，按记忆曲线复习。`
                : mode === "drill"
                  ? `抽一个问题（内置 ${DRILL_QUESTIONS.length} 个），说出观点和两个理由；录音可以回放，设置了 Azure 语音还能给发音打分。`
                : mode === "listen" || mode === "examread"
                  ? `${TOPICS.length} 个考试常见话题，每次由 AI 按真题题型新出：可以练单个练习，也可以做整套 25 分。`
                  : pool.length
              ? mode === "gender"
                ? `可练 ${pool.length} 个名词，每轮随机 20 个。只练冠词，不改动记忆进度。`
                : isWriting(mode)
                  ? `可练 ${pool.length} 个词，每轮随机 5 句。`
                : source === "path"
                  ? "从学习路线的前 400 个词里随机抽 10 个。"
                : source === "decks"
                  ? `所选卡组里有 ${pool.length} 个词，每轮随机 10 个。`
                  : `可练 ${pool.length} 个词，每轮随机 10 个。`
              : "这里还没有词，先去学几个，或换个来源。"}
          </p>
          {usesSentences(mode) && (
            <>
              <h3 className="eyebrow">句子来自</h3>
              <div className="segmented segmented-wide">
                <button className={!aiSentences ? "is-on" : ""} onClick={() => setAiSentences(false)} aria-pressed={!aiSentences}>
                  卡片上的例句
                </button>
                <button className={aiSentences ? "is-on" : ""} onClick={() => setAiSentences(true)} aria-pressed={aiSentences} disabled={!ready.text(ai)}>
                  <Sparkles size={14} /> AI 现写新句子
                </button>
              </div>
              {!ready.text(ai) && (
                <p className="muted small">
                  AI 现写新句子需要先到 <a className="link" href={href({ page: "me" })}>我的 → AI 接口</a> 设置生成卡片服务。
                </p>
              )}
              {aiOn && <p className="muted small">每轮开始时 AI 用这些词各写一个新句子（一次请求，约 10–30 秒），句子没有录音，{ready.tts(ai) ? "由朗读服务读出，可以选女声或男声。" : "只能用设备自带的声音读，没有女/男声可选；到「我的 → AI 接口」开启朗读服务后才能选。"}</p>}
            </>
          )}
          <button className="btn btn-primary btn-xl" onClick={isStudio(mode) ? () => setStudio(mode) : start} disabled={busy || (!isStudio(mode) && (!pool.length || needsAi))}>
            {busy ? "AI 出题中…" : mode === "essay" ? "选题目" : isStudio(mode) ? "进入" : "开始一轮"}
          </button>
        </section>
        <section className="panel practice-side">
          <img src={`${import.meta.env.BASE_URL}brand/${mode === "dictation" ? "listen" : "typing"}.webp`} alt="" />
          {mode === "listen" || mode === "examread" || mode === "speak" ? (
            <>
              <p className="muted">
                {mode === "listen"
                  ? "对应考试的听力部分：两段长录音各听两遍、三段短录音各听一遍，按考试的读题和作答时间进行；交卷后看原文和译文。"
                  : mode === "examread"
                    ? "对应考试的阅读部分：两篇报刊文章加一组「这是谁的观点」，整套限时 1 小时。"
                    : "对应考试的口语部分：准备 30 分钟，独白 5–7 分钟，再由 AI 扮考官辩论；按官方评分表批改，发音一项自评。"}
              </p>
              <p className="muted">
                {ready.text(ai) ? (
                  mode === "speak" ? "辩论每个问题一次请求，批改一次请求。" : "每个练习一次请求（整套三次），每次约 20–60 秒。"
                ) : (
                  <>
                    需要 AI：先到 <a className="link" href={href({ page: "me" })}>我的 → AI 接口</a> 设置生成卡片服务。
                  </>
                )}
              </p>
            </>
          ) : mode === "essay" ? (
            <>
              <p className="muted">写的时候旁边有提纲、可以套用的句子和衔接语。批改用官方评分表的五项，每项 0／1／3／5 分，满分 25；逐处指出错误，并链接到对应的语法点。</p>
              <p className="muted">
                {ready.text(ai) ? (
                  "批改用「我的 → AI 接口」里的生成卡片服务，每篇一次请求，比批改单句慢，也更费额度。"
                ) : (
                  <>
                    还没有设置 AI 接口：可以写和保存，对照评分表自己检查。到 <a className="link" href={href({ page: "me" })}>我的 → AI 接口</a> 设置后由 AI 批改。
                  </>
                )}
              </p>
            </>
          ) : isWriting(mode) ? (
            <>
              <p className="muted">
                {mode === "translate"
                  ? "看例句的中文，自己写出法语。和书里的句子一样直接算对；写法不同时由 AI 判断对错、指出错在哪。"
                  : "用给出的词写一句完整的话，AI 批改语法和用词，并给出改正后的句子。"}
              </p>
              <p className="muted">
                {ready.text(ai) ? (
                  "批改用「我的 → AI 接口」里的生成卡片服务，每句一次请求。"
                ) : mode === "translate" ? (
                  <>
                    还没有设置 AI 接口：现在只能对照书里的句子自己判断。到 <a className="link" href={href({ page: "me" })}>我的 → AI 接口</a> 设置后由 AI 批改。
                  </>
                ) : (
                  <>
                    造句需要 AI 批改：先到 <a className="link" href={href({ page: "me" })}>我的 → AI 接口</a> 设置生成卡片服务。
                  </>
                )}
              </p>
            </>
          ) : mode === "drill" ? (
            <p className="muted">每天开口一次：抽题后先想 15 秒，再对着 60 秒倒计时说。说的内容可以让 AI 点评结构和用词；发音、流利度和语调由 Azure 语音评测。</p>
          ) : mode === "gender" ? (
            <p className="muted">
              冠词颜色：<span className="art art-m">un</span> 阳性 · <span className="art art-f">une</span> 阴性。用不定冠词判断，因为 l' 会遮住阴阳性。
            </p>
          ) : (
            <>
          <dl className="mini-stats">
            <div>
              <dt>最佳速度</dt>
              <dd>
                {best}
                <small>WPM</small>
              </dd>
            </div>
            <div>
              <dt>完成轮次</dt>
              <dd>{progress.typing.length}</dd>
            </div>
          </dl>
          <p className="muted">WPM 按标准每 5 个字符计 1 词，只统计正确输入。</p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function TypingRound({ mode, entries, onExit, onAgain }: { mode: TypingMode; entries: Entry[]; onExit: () => void; onAgain: () => void }) {
  const atlas = useAtlas();
  const settings = useStore((s) => s.settings);
  const [i, setI] = useState(0);
  const [value, setValue] = useState("");
  // Running totals live in a ref so every keystroke is counted exactly once.
  const totalsRef = useRef({ typed: 0, correct: 0, accepted: 0, ms: 0 });
  const [totals, setTotals] = useState(totalsRef.current);
  const [done, setDone] = useState(false);
  // 不会: the answer is shown and the learner goes on with 下一个; such items are listed at the end
  const [revealed, setRevealed] = useState(false);
  const [missed, setMissed] = useState<Entry[]>([]);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const started = useRef<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const e = entries[i];
  const target = mode === "word" ? e.w : e.ex[0].en;
  // dictation: the sentence's voice, 女/男 next to 再听一遍, kept for the rest of the round
  const [exVoice, setExVoice] = useState<Accent>(settings.accent);
  const playSentence = (v: Accent = exVoice) => play(atlas.audio(e, "ex", v), e.ex[0].en, v);

  useEffect(() => {
    setValue("");
    setRevealed(false);
    started.current = null;
    // focus without scrolling: on phones the browser would scroll the bar (and 结束) under the sticky header
    input.current?.focus({ preventScroll: true });
    if (mode === "dictation") void playSentence();
    if (mode === "word" && settings.autoplay) void play(atlas.audio(e, settings.accent), e.w, settings.accent);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopAudio(), []);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const onChange = (next: string) => {
    if (done || revealed) return;
    if (started.current === null && next) started.current = performance.now();
    const d = typingDelta(value, next, target);
    if (settings.sfx && d.total > 0) void cue("key");
    const t = totalsRef.current;
    totalsRef.current = { ...t, typed: t.typed + d.total, correct: t.correct + d.correct };
    setTotals(totalsRef.current);
    setValue(next);
    if (clean(next).length >= clean(target).length && same(next.trimEnd(), target)) finishItem(next);
  };

  const finishItem = (final: string) => {
    const ms = started.current ? performance.now() - started.current : 0;
    const accepted = correctCharacterCount(final, target);
    if (settings.sfx) void cue("correct");
    const t = totalsRef.current;
    const nt = { ...t, accepted: t.accepted + accepted, ms: t.ms + ms };
    totalsRef.current = nt;
    setTotals(nt);
    if (i + 1 >= entries.length) endRound();
    else window.setTimeout(() => setI(i + 1), 260);
  };

  const endRound = () => {
    const nt = totalsRef.current;
    setDone(true);
    const m = typingMetrics(nt.correct, nt.typed, nt.accepted, nt.ms);
    store.progress((p) => ({ ...p, typing: [...p.typing, { at: Date.now(), mode, items: entries.length, wpm: m.wpm, accuracy: m.accuracy }].slice(-500) }));
  };

  /** 不会，看答案: show the whole answer; the time spent on it is not counted toward the speed. */
  const reveal = () => {
    if (revealed || done) return;
    if (settings.sfx) void cue("wrong");
    setRevealed(true);
    setMissed((xs) => [...xs, e]);
    if (mode === "dictation") void playSentence();
    window.setTimeout(() => nextBtn.current?.focus({ preventScroll: true }), 0);
  };
  const goOn = () => {
    stopAudio();
    if (i + 1 >= entries.length) endRound();
    else setI(i + 1);
  };

  const m = typingMetrics(totals.correct, totals.typed, totals.accepted, totals.ms);
  const chars = Array.from(target);
  const typed = Array.from(value);

  if (done)
    return (
      <div className="page practice">
        <section className="panel typing-done">
          <p className="eyebrow">本轮完成</p>
          <h1 className="display">
            {m.wpm} <small>WPM</small>
          </h1>
          <p className="lede">
            准确率 {m.accuracy}% · {entries.length} 项{missed.length > 0 && ` · 看了答案 ${missed.length} 项`}
          </p>
          {missed.length > 0 && (
            <ul className="writing-review typing-missed">
              {missed.map((x) => (
                <li key={x.id}>
                  <p className="writing-line" lang="fr">
                    {mode === "word" ? x.w : x.ex[0].en}
                  </p>
                  <p className="writing-line-zh">{mode === "word" ? x.senses[0]?.zh : x.ex[0].zh}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="summary-actions">
            <button className="btn btn-ghost" onClick={onExit}>
              返回
            </button>
            <button className="btn btn-primary btn-xl" onClick={onAgain} autoFocus>
              <RotateCcw size={18} /> 再来一轮
            </button>
          </div>
        </section>
      </div>
    );

  return (
    <div className="page practice typing">
      <header className="typing-top">
        <button className="btn btn-ghost" onClick={onExit}>
          结束
        </button>
        <AmbiencePicker />
        <div className="learn-progress">
          <span style={{ width: `${(i / entries.length) * 100}%` }} />
        </div>
        <span className="typing-meter">
          <b>{m.wpm}</b> WPM · <b>{m.accuracy}%</b>
        </span>
      </header>
      <section className="typing-stage" onClick={() => input.current?.focus()}>
        {mode === "word" && (
          <div className="typing-cue">
            {!e.noImg && <Illustration src={atlas.img(e)} word={e.w} topic={0} eager />}
            <p>
              <span className="pos">{e.senses[0].pos}</span> {e.senses[0].zh}
            </p>
          </div>
        )}
        {mode !== "word" && (
          <p className="typing-zh">
            {mode === "dictation" && (
              <span className="typing-replay">
                <button className="link" onClick={() => playSentence()}>
                  再听一遍
                </button>
                <VoicePick
                  entry={e}
                  value={exVoice}
                  onPick={(v) => {
                    setExVoice(v);
                    void playSentence(v);
                    // the picker keeps its click from the stage, so put the caret back for typing
                    input.current?.focus();
                  }}
                />
              </span>
            )}
            {e.ex[0].zh}
          </p>
        )}
        <p className={`typing-text ${mode === "word" ? "is-word" : ""} ${mode === "dictation" && !revealed ? "is-hidden" : ""} ${revealed ? "is-revealed" : ""}`} lang="fr" aria-hidden={!revealed}>
          {chars.map((ch, k) => {
            const t = typed[k];
            const cls = t === undefined ? (revealed ? "is-answer" : k === typed.length ? "is-caret" : "") : same(t, ch) ? "is-ok" : "is-bad";
            const show = mode === "dictation" && !revealed && t === undefined ? (ch === " " ? " " : /\p{L}/u.test(ch) ? "·" : ch) : ch;
            return (
              <span key={k} className={cls}>
                {show}
              </span>
            );
          })}
        </p>
        <input
          ref={input}
          className="typing-input"
          value={value}
          onChange={(ev) => onChange(ev.target.value)}
          onKeyDown={(ev) => {
            if (revealed && ev.key === "Enter" && !ev.nativeEvent.isComposing) {
              ev.preventDefault();
              goOn();
            }
          }}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          aria-label="在这里输入"
        />
        {revealed ? (
          <div className="writing-actions typing-reveal" onClick={(ev) => ev.stopPropagation()}>
            <button ref={nextBtn} className="btn btn-primary btn-xl" onClick={goOn}>
              {i + 1 >= entries.length ? "看结果" : "下一个"} <ArrowRight size={18} />
            </button>
          </div>
        ) : (
          <>
            <AccentKeys input={input} value={value} onChange={onChange} />
            {mode === "dictation" && (
              <div className="writing-actions typing-reveal" onClick={(ev) => ev.stopPropagation()}>
                <button className="btn btn-ghost" onClick={reveal}>
                  不会，看答案
                </button>
              </div>
            )}
          </>
        )}
        <p className="muted typing-help">
          {revealed ? "记一下正确写法，按回车或点「下一个」继续。" : mode === "dictation" ? "听不清可以点「再听一遍」；实在写不出来就点「不会，看答案」。" : "直接开始输入，全部正确后自动进入下一项。"} 第 {i + 1}/{entries.length} 项
        </p>
      </section>
    </div>
  );
}

/** Fast un / une drill. Never touches memory state: it is practice, like typing. */
function GenderDrill({ refs, onExit, onAgain }: { refs: WordRef[]; onExit: () => void; onAgain: () => void }) {
  const settings = useStore((s) => s.settings);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<{ id: string; ok: boolean }[]>([]);
  const [shown, setShown] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);
  const r = refs[i];
  const done = i >= refs.length;

  const choose = (a: string) => {
    if (shown || done) return;
    const ok = isArticleCorrect(a, r.g);
    if (settings.sfx) void cue(ok ? "correct" : "wrong");
    setShown(a);
    setAnswers((xs) => [...xs, { id: r.id, ok }]);
    timer.current = window.setTimeout(
      () => {
        setShown(null);
        setI((n) => n + 1);
      },
      ok ? 450 : 1300,
    );
  };
  const keys: Record<string, () => void> = {};
  if (!done) ARTICLE_CHOICES.forEach((a, k) => (keys[String(k + 1)] = () => choose(a)));
  useKeys(keys);

  if (done) {
    const right = answers.filter((a) => a.ok).length;
    const wrong = answers.filter((a) => !a.ok).map((a) => refs.find((x) => x.id === a.id)!);
    return (
      <div className="page practice">
        <section className="panel typing-done">
          <p className="eyebrow">本轮完成</p>
          <h1 className="display">
            {right}/{refs.length} <small>正确</small>
          </h1>
          {wrong.length > 0 ? (
            <ul className="gender-wrong">
              {wrong.map((w) => (
                <li key={w.id} lang="fr">
                  <span className={`art ${articleTone(ARTICLE[w.g!])}`}>{ARTICLE[w.g!]}</span>
                  {w.word} <small lang="zh">{w.zh}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="lede">全部答对。</p>
          )}
          <div className="summary-actions">
            <button className="btn btn-ghost" onClick={onExit}>
              返回
            </button>
            <button className="btn btn-primary btn-xl" onClick={onAgain} autoFocus>
              <RotateCcw size={18} /> 再来一轮
            </button>
          </div>
        </section>
      </div>
    );
  }

  const right = shown ? ARTICLE[r.g!] : null;
  return (
    <div className="page practice typing">
      <header className="typing-top">
        <button className="btn btn-ghost" onClick={onExit}>
          结束
        </button>
        <div className="learn-progress">
          <span style={{ width: `${(i / refs.length) * 100}%` }} />
        </div>
        <span className="typing-meter">
          <b>{answers.filter((a) => a.ok).length}</b> / {answers.length}
        </span>
      </header>
      <section className="typing-stage gender-stage">
        <div className="prompt-gender">
          <h2 className="headword" lang="fr">
            <span className={`blank-art ${right ? articleTone(right) : ""}`}>{right ?? "\u00a0"}</span> {r.word}
          </h2>
          <p className="gender-zh">{r.zh}</p>
        </div>
        <ul className="options options-gender">
          {ARTICLE_CHOICES.map((a, k) => {
            const isAnswer = isArticleCorrect(a, r.g);
            const cls = shown ? (isAnswer ? "is-answer" : shown === a ? "is-chosen" : "is-dim") : "";
            return (
              <li key={a}>
                <button className={`option option-art ${articleTone(a)} ${cls}`} data-option={a} onClick={() => choose(a)} disabled={!!shown}>
                  <kbd>{k + 1}</kbd>
                  <span lang="fr">{a}</span>
                  {shown && isAnswer && <Check size={20} className="option-mark" />}
                  {shown === a && !isAnswer && <X size={20} className="option-mark" />}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="muted typing-help">按 1 / 2 选择 · 第 {i + 1}/{refs.length} 个</p>
      </section>
    </div>
  );
}
