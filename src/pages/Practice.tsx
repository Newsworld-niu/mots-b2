import { ArrowLeftRight, ArrowRight, Check, Headphones, Keyboard, Languages, PenLine, RotateCcw, Type, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { prefetch, useAtlas } from "../atlas/context";
import type { Accent, Entry, WordRef } from "../atlas/types";
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
import { WritingRound, type WritingMode } from "./Writing";

type Mode = "word" | "sentence" | "dictation" | "gender" | WritingMode;
type TypingMode = Exclude<Mode, "gender" | WritingMode>;
const isWriting = (m: Mode): m is WritingMode => m === "translate" || m === "compose";
type Source = "recent" | "mistakes" | "saved" | "path";

const MODES: [Mode, string, string, typeof Type][] = [
  ["word", "单词", "看图写出单词", Type],
  ["sentence", "例句", "照着抄写，练出手感", Keyboard],
  ["dictation", "听写", "只听声音，写下整句", Headphones],
  ["gender", "冠词", "un 还是 une，快速判断", ArrowLeftRight],
  ["translate", "中译法", "看中文，自己写出法语句子", Languages],
  ["compose", "造句", "用这个词写一句话，AI 批改", PenLine],
];
const SOURCES: [Source, string][] = [
  ["recent", "最近学过"],
  ["mistakes", "错词本"],
  ["saved", "收藏"],
  ["path", "学习路线"],
];

export function Practice() {
  const atlas = useAtlas();
  const progress = useStore((s) => s.progress);
  const startLevel = useStore((s) => s.settings.startLevel);
  const [mode, setMode] = useState<Mode>("word");
  const [source, setSource] = useState<Source>(() => (Object.keys(progress.cards).length ? "recent" : "path"));
  const [round, setRound] = useState<{ entries: Entry[]; key: number } | null>(null);
  const [drill, setDrill] = useState<{ refs: WordRef[]; key: number } | null>(null);
  const [writing, setWriting] = useState<{ mode: WritingMode; entries: Entry[]; key: number } | null>(null);
  const ai = useAiConfig();
  // 造句 has no book sentence to compare with: it needs the AI
  const needsAi = mode === "compose" && !ready.text(ai);

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
            : atlas.words.filter((w) => w.cefr >= startLevel && (mode !== "gender" || (w.g && isTaughtReady(w)))).slice(0, 400).map((w) => w.id);
    // the article drill only uses nouns with a quizzable gender
    return ids.filter((id) => atlas.byId.has(id) && (mode !== "gender" || !!atlas.byId.get(id)!.g));
  }, [atlas, progress.cards, progress.mistakes, progress.bookmarks, source, startLevel, mode]);

  const start = async () => {
    if (mode === "gender") {
      const refs = shuffle(pool.slice(0, 120), hashSeed(String(Date.now()))).slice(0, 20).map((id) => atlas.byId.get(id)!);
      if (refs.length) setDrill({ refs, key: Date.now() });
      return;
    }
    if (isWriting(mode)) {
      // more than a round's worth, since some words have no sentence to translate
      const ids = shuffle(pool.slice(0, 60), hashSeed(String(Date.now()))).slice(0, 15);
      const entries = (await prefetch(atlas, ids)).filter((e): e is Entry => !!e && (mode === "compose" || !!translatable(e.ex))).slice(0, 5);
      if (entries.length) setWriting({ mode, entries, key: Date.now() });
      else toast("这些词还没有带中文翻译的例句，换个来源试试", "warn");
      return;
    }
    const ids = shuffle(pool.slice(0, 60), hashSeed(String(Date.now()))).slice(0, 10);
    const entries = (await prefetch(atlas, ids)).filter((e): e is Entry => !!e && (mode === "word" || e.ex.length > 0));
    if (entries.length) setRound({ entries, key: Date.now() });
  };

  if (drill) return <GenderDrill key={drill.key} refs={drill.refs} onExit={() => setDrill(null)} onAgain={start} />;
  if (writing) return <WritingRound key={writing.key} mode={writing.mode} entries={writing.entries} onExit={() => setWriting(null)} onAgain={start} />;
  if (round && !isWriting(mode) && mode !== "gender") return <TypingRound key={round.key} mode={mode} entries={round.entries} onExit={() => setRound(null)} onAgain={start} />;

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
          <h3 className="eyebrow">词来自</h3>
          <div className="segmented segmented-wide">
            {SOURCES.map(([k, label]) => (
              <button key={k} className={source === k ? "is-on" : ""} onClick={() => setSource(k)} aria-pressed={source === k}>
                {label}
              </button>
            ))}
          </div>
          <p className="muted">
            {pool.length
              ? mode === "gender"
                ? `可练 ${pool.length} 个名词，每轮随机 20 个。只练冠词，不改动记忆进度。`
                : isWriting(mode)
                  ? `可练 ${pool.length} 个词，每轮随机 5 句。`
                : source === "path"
                  ? "从学习路线的前 400 个词里随机抽 10 个。"
                  : `可练 ${pool.length} 个词，每轮随机 10 个。`
              : "这里还没有词，先去学几个，或换个来源。"}
          </p>
          <button className="btn btn-primary btn-xl" onClick={start} disabled={!pool.length || needsAi}>
            开始一轮
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
  const started = useRef<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const e = entries[i];
  const target = mode === "word" ? e.w : e.ex[0].en;
  // dictation: the sentence's voice, 女/男 next to 再听一遍, kept for the rest of the round
  const [exVoice, setExVoice] = useState<Accent>(settings.accent);
  const playSentence = (v: Accent = exVoice) => play(atlas.audio(e, "ex", v), e.ex[0].en, v);

  useEffect(() => {
    setValue("");
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
    if (done) return;
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
    if (i + 1 >= entries.length) {
      setDone(true);
      const m = typingMetrics(nt.correct, nt.typed, nt.accepted, nt.ms);
      store.progress((p) => ({ ...p, typing: [...p.typing, { at: Date.now(), mode, items: entries.length, wpm: m.wpm, accuracy: m.accuracy }].slice(-500) }));
    } else window.setTimeout(() => setI(i + 1), 260);
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
          <p className="lede">准确率 {m.accuracy}% · {entries.length} 项</p>
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
                  }}
                />
              </span>
            )}
            {e.ex[0].zh}
          </p>
        )}
        <p className={`typing-text ${mode === "word" ? "is-word" : ""} ${mode === "dictation" ? "is-hidden" : ""}`} lang="fr" aria-hidden="true">
          {chars.map((ch, k) => {
            const t = typed[k];
            const cls = t === undefined ? (k === typed.length ? "is-caret" : "") : same(t, ch) ? "is-ok" : "is-bad";
            const show = mode === "dictation" && t === undefined ? (ch === " " ? " " : /\p{L}/u.test(ch) ? "·" : ch) : ch;
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
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          aria-label="在这里输入"
        />
        <AccentKeys input={input} value={value} onChange={onChange} />
        <p className="muted typing-help">
          {mode === "dictation" ? "听不清可以点「再听一遍」。" : "直接开始输入，全部正确后自动进入下一项。"} 第 {i + 1}/{entries.length} 项
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
