import { ArrowLeftRight, ArrowRight, Award, BookMarked, BookOpenCheck, BookOpenText, Check, Ear, FileText, Headphones, Keyboard, Languages, MessageSquareQuote, Mic, PenLine, Radio, RotateCcw, Sparkles, Target, Timer, Type, X } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { prefetch, useAtlas } from "../atlas/context";
import { MEDIA, type Accent, type Entry, type WordRef } from "../atlas/types";
import { makeSentences } from "../ai/tasks";
import { deckWords } from "../store/decks";
import { play, stopAudio } from "../lib/audio";
import { cue } from "../lib/sound";
import { hashSeed, shuffle } from "../lib/text";
import { translatable } from "../lib/writing";
import { ready, useAiConfig } from "../ai/config";
import { go, href, type Route } from "../lib/router";
import { clean, correctCharacterCount, same, typingDelta, typingMetrics } from "../lib/typing";
import { ARTICLE, ARTICLE_CHOICES, articleTone, isArticleCorrect, isSpellableHeadword } from "../lib/gender";
import { useKeys } from "../lib/keys";
import { useNavGuard } from "../lib/nav-guard";
import { reflowSummary } from "../store/note-review";
import { isTaughtReady } from "../store/session";
import { store, useStore, useStoreShallow } from "../store/store";
import { AmbiencePicker } from "../ui/Ambience";
import { AccentKeys } from "../ui/AccentKeys";
import { confirmAction } from "../ui/ConfirmSheet";
import { Illustration } from "../ui/Illustration";
import { VoicePick } from "../ui/EntryView";
import { toast } from "../ui/Toast";
import { TRACK_META, type ExamTrack } from "../lib/exam-tracks";
import { EXPRESSIONS } from "../lib/expressions";
import { coreSet, CORE_LABEL, isCore } from "../lib/core-words";
import { DRILL_QUESTIONS } from "../lib/drill";
import { TOPICS } from "../lib/exam";
import { ESSAY_TASKS } from "../lib/essay";
import { PREBUILT_REAL_SOURCES } from "../lib/real-presets";
import { WritingRound, type WritingMode } from "./Writing";
import { PRACTICE_SOURCES as SOURCES, type PracticeSource as Source } from "../lib/practice-source";
import { MICRO_SKILL_SUMMARY } from "../lib/micro-skills";
import { ExamDashboard } from "../ui/ExamDashboard";
import { PracticeSourcePicker } from "../ui/PracticeSource";

const MicroSkillDrill = lazy(() => import("../ui/MicroSkillDrill").then((m) => ({ default: m.MicroSkillDrill })));

type DrillMode = "word" | "sentence" | "dictation" | "gender" | WritingMode;
type TypingMode = Exclude<DrillMode, "gender" | WritingMode>;
const isWriting = (m: DrillMode): m is WritingMode => m === "translate" || m === "compose";

interface StudioCardSpec {
  key: string;
  route: Route;
  title: string;
  desc: string;
  tag: string;
  icon: typeof Type;
  featured?: boolean;
}

function studiosForTrack(track: ExamTrack): StudioCardSpec[] {
  if (track === "tcf") {
    return [
      { key: "mock", route: { page: "mock" }, title: "全真模考", desc: "连贯笔试 + 口语计时实测（附 DELF / TCF 分项对照）", tag: "全科模考", icon: Award, featured: true },
      { key: "listen", route: { page: "listen" }, title: "CO 听力理解", desc: "单遍四选一 · 阶梯难度赋分与 NCLC 换算", tag: "单遍四选一 · 100–699", icon: Ear },
      { key: "struct-tcf", route: { page: "grammar", sprint: "tcf" }, title: "语言结构 Structure", desc: "18 题 / 15 分钟限时四选一 · 语法与词汇结构辨析", tag: "18题/15m · 100–699", icon: Sparkles, featured: true },
      { key: "examread", route: { page: "examread" }, title: "CE 应试阅读", desc: "阶梯四选一 · A2→C1 渐进文本与原文寻证", tag: "阶梯四选一 · 100–699", icon: BookOpenCheck },
      { key: "essay", route: { page: "essay" }, title: "PE 书面表达", desc: "T1 留言 + T2 经验文章 + T3 双文献观点合成 · 0–20 分", tag: "3任务递进 · /20", icon: FileText },
      { key: "speak", route: { page: "speak" }, title: "PO 口语表达", desc: "T1 问答 + T2 信息搜集连问 + T3 零准备观点独白", tag: "T1问答 + T2连问 + T3零准备 · /20", icon: Mic },
      { key: "real", route: { page: "real" }, title: "真实电台与常速广播", desc: `${PREBUILT_REAL_SOURCES.length} 期 RFI + 4 篇 ~170 WPM 母语常速广播切片`, tag: "真题脱敏", icon: Radio, featured: true },
      { key: "read", route: { page: "read" }, title: "报刊精读", desc: "10 篇免 AI B2 精选报刊 · 点词查义与逐句听读", tag: "双模式阅读", icon: BookOpenText },
      { key: "drill", route: { page: "drill" }, title: "一分钟口语", desc: `内置 ${DRILL_QUESTIONS.length} 题 · 想 15s 说 60s · 练 T3 零准备开口`, tag: "每日开口", icon: Timer },
      { key: "expr", route: { page: "expr" }, title: "高频论证表达", desc: `${EXPRESSIONS.length} 张连接词与信函套话 · FSRS 填空`, tag: "输出底座", icon: MessageSquareQuote },
      { key: "reflow", route: { page: "reflow" }, title: "统一错题中心", desc: "错词 · 语法 · 写作口语错句 · 听读四选一干扰陷阱", tag: "查漏补缺", icon: BookMarked },
    ];
  }
  if (track === "tef") {
    return [
      { key: "mock", route: { page: "mock" }, title: "全真模考", desc: "连贯笔试 + 口语计时实测（附 0–699 / NCLC 对照）", tag: "全科模考", icon: Award, featured: true },
      { key: "listen", route: { page: "listen" }, title: "CO 听力理解", desc: "电话留言 · 公共广播 · 街头微访谈 · 深度访谈四选一", tag: "40题单遍 · 0–699", icon: Ear },
      { key: "examread", route: { page: "examread" }, title: "CE 应试阅读", desc: "日常应用文 · 篇章填句 · 快速寻读 · 报刊长文 · 同义句改写", tag: "2023新政五节 · 0–699", icon: BookOpenCheck },
      { key: "struct-tef", route: { page: "grammar", sprint: "tef" }, title: "词汇与结构", desc: "40 题 / 30 分钟限时四选一 · 近义词辨析与句法填空", tag: "40题/30m · 0–699", icon: Sparkles, featured: true },
      { key: "essay", route: { page: "essay" }, title: "PE 书面表达", desc: "Sec A 新闻续写（≥80词）+ Sec B 议论信辩驳（≥200词）", tag: "Sec A 新闻续写 + Sec B 议论信 · NCLC", icon: FileText },
      { key: "speak", route: { page: "speak" }, title: "PO 口语表达", desc: "Sec A 正式 vous 咨询提问（5m）+ Sec B 朋友 tu 劝说反驳（10m）", tag: "Sec A vous 提问 + Sec B tu 劝说 · NCLC", icon: Mic },
      { key: "real", route: { page: "real" }, title: "真实电台与常速广播", desc: `${PREBUILT_REAL_SOURCES.length} 期 RFI + 4 篇 ~170 WPM 母语常速广播切片`, tag: "真题脱敏", icon: Radio, featured: true },
      { key: "read", route: { page: "read" }, title: "报刊精读", desc: "10 篇免 AI B2 精选报刊 · 点词查义与逐句听读", tag: "双模式阅读", icon: BookOpenText },
      { key: "drill", route: { page: "drill" }, title: "一分钟口语", desc: `内置 ${DRILL_QUESTIONS.length} 题 · 想 15s 说 60s · 录音回放`, tag: "每日开口", icon: Timer },
      { key: "expr", route: { page: "expr" }, title: "高频论证表达", desc: `${EXPRESSIONS.length} 张连接词与信函套话 · FSRS 填空`, tag: "输出底座", icon: MessageSquareQuote },
      { key: "reflow", route: { page: "reflow" }, title: "统一错题中心", desc: "错词 · 语法 · 写作口语错句 · 听读四选一干扰陷阱", tag: "查漏补缺", icon: BookMarked },
    ];
  }
  return [
    { key: "mock", route: { page: "mock" }, title: "全真模考", desc: "2h30 笔试连考 + PO 口语（/100 成绩单）", tag: "4 科", icon: Award, featured: true },
    { key: "listen", route: { page: "listen" }, title: "CO 听力理解", desc: `2 长 + 3 短套卷 · ${TOPICS.length} 话题真题节奏`, tag: "25 分", icon: Ear },
    { key: "real", route: { page: "real" }, title: "真实电台 RFI", desc: `${PREBUILT_REAL_SOURCES.length} 期原声新闻 · 倍速 / A-B 复读 / 盲听`, tag: "真题脱敏", icon: Radio, featured: true },
    { key: "examread", route: { page: "examread" }, title: "CE 应试阅读", desc: "2 报刊 + 观点匹配（支持划词高光与排除）", tag: "25 分", icon: BookOpenCheck },
    { key: "read", route: { page: "read" }, title: "报刊精读", desc: "10 篇免 AI B2 精选报刊 · 点词查义与逐句听读", tag: "双模式阅读", icon: BookOpenText },
    { key: "essay", route: { page: "essay" }, title: "PE 篇章写作", desc: `${ESSAY_TASKS.length} 道书信/议论文 · 官方五项量表批改`, tag: "25 分", icon: FileText },
    { key: "speak", route: { page: "speak" }, title: "PO 口语独白与辩论", desc: "30m 准备 + 5–7m 陈述 + 考官追问", tag: "25 分", icon: Mic },
    { key: "drill", route: { page: "drill" }, title: "一分钟口语", desc: `内置 ${DRILL_QUESTIONS.length} 题 · 想 15s 说 60s · 录音回放`, tag: "每日开口", icon: Timer },
    { key: "expr", route: { page: "expr" }, title: "高频论证表达", desc: `${EXPRESSIONS.length} 张连接词与信函套话 · FSRS 填空`, tag: "输出底座", icon: MessageSquareQuote },
    { key: "reflow", route: { page: "reflow" }, title: "统一错题中心", desc: "错词 · 语法 · 写作口语错句 · 听读真题陷阱", tag: "查漏补缺", icon: BookMarked },
  ];
}

const DRILL_MODES: [DrillMode, string, string, typeof Type][] = [
  ["word", "单词拼写", "看图写出单词", Type],
  ["sentence", "例句抄写", "照着抄写，练出手感", Keyboard],
  ["dictation", "句子听写", "只听声音，写下整句", Headphones],
  ["gender", "名词性数", "un 还是 une，快速判断", ArrowLeftRight],
  ["translate", "中译法", "看中文，自己写出法语句子", Languages],
  ["compose", "情境造句", "用这个词写一句话，AI 批改", PenLine],
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
const usesSentences = (m: DrillMode) => m === "dictation" || m === "translate";
/** Modes where the learner produces the word: by default only core words (会用), see lib/core-words. */
const isProductive = (m: DrillMode) => m === "word" || isWriting(m);
const NO_EX_AUDIO = ~(MEDIA.ex | MEDIA.exM | MEDIA.ex2 | MEDIA.ex2M);

export function Practice() {
  const atlas = useAtlas();
  const progress = useStoreShallow((s) => ({
    cards: s.progress.cards,
    decks: s.progress.decks,
    hidden: s.progress.hidden,
    coreMigrated: s.progress.coreMigrated,
    bookmarks: s.progress.bookmarks,
    mistakes: s.progress.mistakes,
    examLog: s.progress.examLog,
    essayNotes: s.progress.essayNotes,
    speakCorrections: s.progress.speakCorrections,
    compMisses: s.progress.compMisses,
    noteCards: s.progress.noteCards,
    gram: s.progress.gram,
    essays: s.progress.essays,
    typing: s.progress.typing,
  }));
  const startLevel = useStore((s) => s.settings.startLevel);
  const examTrack: ExamTrack = useStore((s) => s.settings.examTrack) ?? "delf";
  const trackMeta = TRACK_META[examTrack];
  const examStudios = useMemo(() => studiosForTrack(examTrack), [examTrack]);
  const [mode, setMode] = useState<DrillMode>("word");
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
  const [microTrackId, setMicroTrackId] = useState<{ id: string; key: number } | null>(null);
  const reflow = useMemo(() => reflowSummary(progress), [progress]);
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
    // the article drill only uses nouns with a quizzable gender; word spelling skips long/slashed phrases
    return ids.filter((id) => {
      const w = atlas.byId.get(id);
      return !!w && (mode !== "gender" || !!w.g) && (mode !== "word" || isSpellableHeadword(w.word)) && (!coreFilter || isCore(atlas, id));
    });
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

  if (microTrackId) {
    return (
      <Suspense fallback={<div className="page learn-loading"><span className="spinner" /></div>}>
        <MicroSkillDrill key={microTrackId.key} trackId={microTrackId.id} onExit={() => setMicroTrackId(null)} />
      </Suspense>
    );
  }
  if (drill) return <GenderDrill key={drill.key} refs={drill.refs} onExit={() => setDrill(null)} onAgain={start} />;
  if (writing) return <WritingRound key={writing.key} mode={writing.mode} entries={writing.entries} onExit={() => setWriting(null)} onAgain={start} />;
  if (round && !isWriting(mode) && mode !== "gender") return <TypingRound key={round.key} mode={mode} entries={round.entries} onExit={() => setRound(null)} onAgain={start} />;

  const best = progress.typing.filter((t) => t.mode === mode).reduce((m, t) => Math.max(m, t.wpm), 0);
  return (
    <div className="page practice">
      <header className="page-head">
        <p className="eyebrow">应试 · {trackMeta.name}</p>
        <h1 className="display">听、读、写、说，分科击破。</h1>
        <p className="lede">
          {trackMeta.scaleSummary} <span className="chip">{trackMeta.b2TargetLabel}</span>
        </p>
      </header>

      <ExamDashboard compact onStartMock={() => go({ page: "mock" })} />

      <section className="panel practice-exam-tier" aria-label={`${trackMeta.shortName} 真题考场与模考`}>
        <div className="panel-head">
          <h2 className="eyebrow">{trackMeta.shortName} 分科考场与模考</h2>
          <span className="muted small">支持完整离线预置套卷 · 离开考场前自动防误退保护</span>
        </div>
        <div className="practice-exam-grid">
          {examStudios.map(({ key, route, title, desc, tag, icon: Icon, featured }) => {
            const badge = route.page === "reflow" ? (reflow.due > 0 ? `${reflow.due} 待复习` : tag) : tag;
            return (
              <button key={key} type="button" className={`mode-card practice-exam-card ${featured ? "is-featured" : ""}`} onClick={() => go(route)}>
                <div className="practice-exam-top">
                  <Icon size={20} strokeWidth={1.7} />
                  <span className="chip">{badge}</span>
                </div>
                <b>{title}</b>
                <small>{desc}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel practice-micro-tier" aria-label="5 分钟高频微技能专训">
        <div className="panel-head">
          <h2 className="eyebrow">5 分钟高频微技能专训 · CO / CE 提分靶向</h2>
          <span className="muted small">每组 3 题直击丢分点，做错即同步至错题中心第 4 页签重练</span>
        </div>
        <div className="micro-skill-grid">
          {MICRO_SKILL_SUMMARY.map((t) => (
            <button
              key={t.id}
              type="button"
              className="mode-card micro-skill-card"
              onClick={() => setMicroTrackId({ id: t.id, key: Date.now() })}
            >
              <div className="practice-exam-top">
                <Target size={18} strokeWidth={1.7} />
                <span className="chip">{t.badge} · {t.minutes} 分钟</span>
              </div>
              <b>{t.title}</b>
              <small>{t.desc}</small>
            </button>
          ))}
        </div>
      </section>

      <div className="practice-grid">
        <section className="panel">
          <h2 className="eyebrow">基础词汇与拼写训练</h2>
          <div className="mode-cards">
            {DRILL_MODES.map(([k, name, desc, Icon]) => (
              <button key={k} className={`mode-card ${mode === k ? "is-on" : ""}`} onClick={() => setMode(k)} aria-pressed={mode === k}>
                <Icon size={22} strokeWidth={1.7} />
                <b>{name}</b>
                <small>{desc}</small>
              </button>
            ))}
          </div>
          <PracticeSourcePicker source={source} onSource={setSource} decks={deckList} chosenDecks={chosenDecks} onDeck={toggleDeck} />
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
            {pool.length
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
                  AI 现写新句子需要先到 <a className="link" href={href({ page: "me" })}>我的 → AI 接口</a> 设置AI 文本服务。
                </p>
              )}
              {aiOn && <p className="muted small">每轮开始时 AI 用这些词各写一个新句子（一次请求，约 10–30 秒），句子没有录音，{ready.tts(ai) ? "由朗读服务读出，可以选女声或男声。" : "只能用设备自带的声音读，没有女/男声可选；到「我的 → AI 接口」开启朗读服务后才能选。"}</p>}
            </>
          )}
          <button className="btn btn-primary btn-xl" onClick={start} disabled={busy || !pool.length || needsAi}>
            {busy ? "AI 出题中…" : "开始一轮"}
          </button>
        </section>
        <section className="panel practice-side">
          <img src={`${import.meta.env.BASE_URL}brand/${mode === "dictation" ? "listen" : "typing"}.webp`} alt="" />
          {isWriting(mode) ? (
            <>
              <p className="muted">
                {mode === "translate"
                  ? "看例句的中文，自己写出法语。和书里的句子一样直接算对；写法不同时由 AI 判断对错、指出错在哪。"
                  : "用给出的词写一句完整的话，AI 批改语法和用词，并给出改正后的句子。"}
              </p>
              <p className="muted">
                {ready.text(ai) ? (
                  "批改用「我的 → AI 接口」里的AI 文本服务，每句一次请求。"
                ) : mode === "translate" ? (
                  <>
                    还没有设置 AI 接口：现在只能对照书里的句子自己判断。到 <a className="link" href={href({ page: "me" })}>我的 → AI 接口</a> 设置后由 AI 批改。
                  </>
                ) : (
                  <>
                    造句需要 AI 批改：先到 <a className="link" href={href({ page: "me" })}>我的 → AI 接口</a> 设置AI 文本服务。
                  </>
                )}
              </p>
            </>
          ) : mode === "gender" ? (
            <p className="muted">
              冠词颜色：<span className="art art-m">un</span> 阳性 · <span className="art art-f">une</span> 阴性。用不定冠词判断，因为 l&apos; 会遮住阴阳性。
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
  const roundActive = !done && (i > 0 || value.length > 0 || revealed || totals.typed > 0);
  useNavGuard(roundActive, "本轮拼写/听写练习尚未完成（成绩尚未计入），确定离开？");
  const exitRound = async () => {
    if (
      roundActive &&
      !(await confirmAction({
        title: "结束本轮拼写练习？",
        message: "本轮尚未完成，速度与准确率尚未保存，确定提前退出？",
        confirmLabel: "确定退出",
        danger: true,
      }))
    ) {
      return;
    }
    stopAudio();
    onExit();
  };

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
        <button className="btn btn-ghost" onClick={() => void exitRound()}>
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
  const drillActive = !done && answers.length > 0;
  useNavGuard(drillActive, "本轮阴阳性冠词练习尚未完成，确定离开？");
  const exitDrill = async () => {
    if (
      drillActive &&
      !(await confirmAction({
        title: "结束本轮阴阳性练习？",
        message: "本轮尚未完成，确定提前退出？",
        confirmLabel: "确定退出",
        danger: true,
      }))
    ) {
      return;
    }
    window.clearTimeout(timer.current);
    onExit();
  };

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
        <button className="btn btn-ghost" onClick={() => void exitDrill()}>
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
