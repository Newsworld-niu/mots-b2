import { ArrowRight, BookOpen, Check, Lightbulb, RotateCcw, Share2, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { prefetch, useAtlas, useEntry } from "../atlas/context";
import { focusRef, focusSense } from "../atlas/merge";
import type { Accent, Entry, WordRef } from "../atlas/types";
import { play, stopAudio } from "../lib/audio";
import { burst } from "../lib/burst";
import { cue } from "../lib/sound";
import { currentLocation, go, openWord, useLocation } from "../lib/router";
import { gap, hashSeed, normalize, shuffle } from "../lib/text";
import { articleVerdict } from "../lib/accent";
import { AccentKeys } from "../ui/AccentKeys";
import { ARTICLE_CHOICES, articleTone, isArticleCorrect, spellTarget } from "../lib/gender";
import { answer, advance, buildSession, gradeFor, introduce, isTyped, recordMistake, sessionStats, type IntroVerdict } from "../store/session";
import { formatInterval, preview, Rating } from "../store/srs";
import { store, useStore, type ActiveSession, type QuizKind, type Step } from "../store/store";
import { EntryView, Highlight, VoicePick } from "../ui/EntryView";
import { Illustration, plateArticle } from "../ui/Illustration";
import { Galaxy } from "../galaxy/Galaxy";
import { AmbiencePicker } from "../ui/Ambience";
import { Ring } from "../ui/Ring";
import { Speak } from "../ui/Speak";
import { shareSession } from "../ui/shareSession";

export function Learn() {
  const atlas = useAtlas();
  const session = useStore((s) => s.progress.session);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { progress, settings } = store.get();
    if (!progress.session) {
      const s = buildSession(atlas, progress, settings);
      if (!s.steps.length) {
        go({ page: "today" }, null, true);
        return;
      }
      store.progress((p) => ({ ...p, session: s }));
    }
  }, [atlas]);

  const ids = useMemo(() => [...new Set(session?.steps.map((s) => s.id) ?? [])], [session?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ids.length) return;
    let live = true;
    // Load the first chunk before rendering, the rest in the background.
    prefetch(atlas, ids.slice(0, 6)).then(() => live && setReady(true));
    void prefetch(atlas, ids);
    return () => {
      live = false;
    };
  }, [atlas, ids]);

  useEffect(() => () => stopAudio(), []);

  if (!session || !ready) return <div className="learn learn-loading"><span className="spinner" /></div>;
  if (session.finished || session.index >= session.steps.length) return <Summary session={session} />;
  return <Runner session={session} />;
}

function Runner({ session }: { session: ActiveSession }) {
  const step = session.steps[session.index];
  const total = session.steps.length;
  const exit = () => {
    stopAudio();
    go({ page: "today" });
  };
  return (
    <div className="learn">
      <header className="learn-top">
        <button className="icon-btn" onClick={exit} aria-label="暂停并返回">
          <X size={22} />
        </button>
        <div className="learn-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={session.index}>
          <span style={{ width: `${(session.index / total) * 100}%` }} />
        </div>
        <span className="learn-count">
          {session.index + 1}
          <small>/{total}</small>
        </span>
        <AmbiencePicker />
      </header>
      <main className="learn-stage" key={`${session.id}-${session.index}`}>
        {step.kind === "intro" ? <Intro step={step} /> : step.kind === "pairing" ? <Pairing step={step} /> : <Quiz step={step} session={session} />}
      </main>
    </div>
  );
}

function useStepTimer() {
  const t = useRef(performance.now());
  return () => (performance.now() - t.current) / 1000;
}

function Intro({ step }: { step: Extract<Step, { kind: "intro" }> }) {
  const atlas = useAtlas();
  const { entry: raw } = useEntry(step.id);
  // the sense the deck studies comes first
  const entry = useMemo(() => raw && focusSense(raw, step.sense), [raw, step.sense]);
  const settings = useStore((s) => s.settings);
  const elapsed = useStepTimer();
  useEffect(() => {
    if (entry && settings.autoplay) void play(atlas.audio(entry, settings.accent), entry.w, settings.accent);
  }, [entry, atlas, settings.autoplay, settings.accent]);
  const next = useCallback(
    (verdict: IntroVerdict) => {
      stopAudio();
      if (store.get().settings.sfx) void cue("flip");
      introduce(step.id, verdict, elapsed());
    },
    [elapsed, step.id],
  );
  // how far away 完全认识 puts the word
  const easy = useMemo(() => formatInterval(preview(undefined, Date.now(), settings.retention)[Rating.Easy]), [settings.retention, step.id]);
  useKeys({ Enter: () => next("known"), " ": () => next("known"), "1": () => next("unknown"), "2": () => next("known"), "3": () => next("mastered") });
  if (!entry) return <span className="spinner" />;
  return (
    <div className="intro">
      <p className="stage-label">
        <span className="dot dot-new" /> 初次见面
      </p>
      <EntryView entry={entry} mode="intro" />
      <footer className="learn-actions intro-verdicts">
        <div className="intro-verdict-row" role="group" aria-label="你认识这个词吗">
          <button className="btn btn-ghost btn-xl" onClick={() => next("unknown")}>
            <span>不认识</span>
            <small>熟悉度不增加，很快再见</small>
          </button>
          <button className="btn btn-primary btn-xl" onClick={() => next("known")} autoFocus>
            <span>
              认识 <ArrowRight size={18} />
            </span>
            <small>接着做题，按答题情况安排</small>
          </button>
          <button className="btn btn-ghost btn-xl" onClick={() => next("mastered")}>
            <span>完全认识</span>
            <small>不再出题，约 {easy}后复习</small>
          </button>
        </div>
        <span className="hint-keys">
          <kbd>1</kbd> 不认识 · <kbd>2</kbd> / <kbd>Enter</kbd> 认识 · <kbd>3</kbd> 完全认识
        </span>
      </footer>
    </div>
  );
}

type PairingStep = Extract<Step, { kind: "pairing" }>;
const RIGHT_KEYS = ["a", "b", "c", "d", "e"];
/** The first one or two glosses, short enough for a pairing tile. */
const shortGloss = (zh: string) => zh.replace(/^[a-z.]+\s*/, "").split(/[；;]/).slice(0, 2).join("；");

/**
 * Pairing round (DuoCards-style): match five French words with their meanings.
 * Extra practice only: it never grades a card; a wrong match only goes on the mistakes list.
 */
function Pairing({ step }: { step: PairingStep }) {
  const atlas = useAtlas();
  const settings = useStore((s) => s.settings);
  const elapsed = useStepTimer();
  const words = useMemo(() => step.ids.map((id) => atlas.byId.get(id)).filter((w): w is WordRef => !!w), [atlas, step.ids]);
  const left = useMemo(() => shuffle(words, hashSeed(step.id + "l")), [words, step.id]);
  const right = useMemo(() => shuffle(words, hashSeed(step.id + "r")), [words, step.id]);
  const [selL, setSelL] = useState<string | null>(null);
  const [selR, setSelR] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [bad, setBad] = useState<[string, string] | null>(null);
  const [misses, setMisses] = useState(0);
  const finished = words.length > 0 && done.length === words.length;

  const check = (l: string, r: string) => {
    setSelL(null);
    setSelR(null);
    if (l === r) {
      setDone((d) => [...d, l]);
      if (settings.sfx) void cue("correct");
    } else {
      setBad([l, r]);
      setMisses((m) => m + 1);
      recordMistake(l);
      if (settings.sfx) void cue("wrong");
      window.setTimeout(() => setBad(null), 450);
    }
  };
  const pickL = (id: string) => {
    if (done.includes(id)) return;
    const w = atlas.byId.get(id);
    if (w) void play(atlas.audio(w, settings.accent), w.word, settings.accent);
    if (selR) check(id, selR);
    else setSelL(id);
  };
  const pickR = (id: string) => {
    if (done.includes(id)) return;
    if (selL) check(selL, id);
    else setSelR(id);
  };
  const next = useCallback(() => {
    stopAudio();
    advance(elapsed());
  }, [elapsed]);

  const keys: Record<string, () => void> = {};
  if (finished) {
    keys.Enter = next;
    keys[" "] = next;
  } else {
    left.forEach((w, i) => (keys[String(i + 1)] = () => pickL(w.id)));
    right.forEach((w, i) => (keys[RIGHT_KEYS[i]] = () => pickR(w.id)));
  }
  useKeys(keys);

  // nothing to pair (words missing from the index): skip quietly
  useEffect(() => {
    if (words.length < 2) advance(0);
  }, [words.length]);

  const tile = (w: WordRef, side: "l" | "r", i: number) => {
    const isDone = done.includes(w.id);
    const isSel = side === "l" ? selL === w.id : selR === w.id;
    const isBad = bad && (side === "l" ? bad[0] === w.id : bad[1] === w.id);
    return (
      <li key={w.id}>
        <button
          className={`pair-tile ${isDone ? "is-done" : ""} ${isSel ? "is-sel" : ""} ${isBad ? "is-bad" : ""}`}
          onClick={() => (side === "l" ? pickL(w.id) : pickR(w.id))}
          disabled={isDone}
          aria-pressed={isSel}
        >
          <kbd>{side === "l" ? i + 1 : RIGHT_KEYS[i].toUpperCase()}</kbd>
          <span lang={side === "l" ? "fr" : "zh"}>{side === "l" ? w.word : shortGloss(w.zh)}</span>
          {isDone && <Check size={18} className="pair-check" aria-label="已配对" />}
        </button>
      </li>
    );
  };

  return (
    <div className="pairing">
      <p className="stage-label">
        <span className="dot dot-review" /> 配对练习 · 不计入复习安排
      </p>
      <h2 className="pairing-title">把法语词和意思连起来</h2>
      <div className="pairing-cols">
        <ul aria-label="法语">{left.map((w, i) => tile(w, "l", i))}</ul>
        <ul aria-label="中文">{right.map((w, i) => tile(w, "r", i))}</ul>
      </div>
      {finished && (
        <footer className="learn-actions">
          <p className="pairing-result">{misses === 0 ? "全部配对正确！" : `完成，配错 ${misses} 次（已记入错词本）`}</p>
          <button className="btn btn-primary btn-xl" onClick={next} ref={(b) => b?.focus({ preventScroll: true })}>
            继续 <ArrowRight size={20} />
          </button>
        </footer>
      )}
    </div>
  );
}

const KIND_LABEL: Record<QuizKind, string> = {
  meaning: "它是什么意思？",
  picture: "看图，补全这句话",
  listen: "听，是哪个词？",
  spell: "拼出这个词",
  gender: "un 还是 une？",
  cloze: "空格里是哪个词？（选原形）",
  dictation: "听句子，写出空格里的词",
};

function Quiz({ step, session }: { step: Extract<Step, { kind: QuizKind }>; session: ActiveSession }) {
  const atlas = useAtlas();
  const ref = focusRef(atlas.byId.get(step.id)!, step.sense);
  const { entry: raw } = useEntry(step.id);
  // a deck that studies another sense of this word asks that sense (avocat: 牛油果, not 律师)
  const entry = useMemo(() => raw && focusSense(raw, step.sense), [raw, step.sense]);
  const settings = useStore((s) => s.settings);
  const pending = session.pending;
  const elapsed = useStepTimer();
  const [hints, setHints] = useState(0);
  const options = useMemo(
    () => (step.options ?? []).map((id) => atlas.byId.get(id)).filter((w): w is WordRef => !!w).map((w) => (w.id === step.id ? focusRef(w, step.sense) : w)),
    [atlas, step.options, step.id, step.sense],
  );

  const submit = useCallback(
    (value: string, correct: boolean, accentOnly = false, articleWrong = false) => {
      if (pending) return;
      const ms = elapsed() * 1000;
      if (correct) {
        const el = document.querySelector<HTMLElement>(isTyped(step.kind) ? ".slots" : `[data-option="${value}"]`);
        const r = el?.getBoundingClientRect();
        if (r) burst(r.left + r.width / 2, r.top + r.height / 2);
      }
      if (settings.sfx) void cue(correct ? "correct" : "wrong");
      answer(atlas, step, correct, gradeFor(step.kind, correct, ms, hints > 0 || accentOnly), value, accentOnly, articleWrong);
      if (entry) void play(atlas.audio(entry, settings.accent), entry.w, settings.accent);
    },
    [pending, elapsed, settings, atlas, step, hints, entry],
  );

  const next = useCallback(() => {
    stopAudio();
    advance(elapsed());
  }, [elapsed]);

  /** 不会: counted as a miss, the answer is shown and the whole card opens to study it; 继续 goes on once it is closed. */
  const giveUp = useCallback(() => {
    if (pending || !entry) return;
    submit("", false);
    openWord(entry.id);
  }, [pending, entry, submit]);

  const sentence = entry?.ex[0] ? gap(entry.ex[0].en, entry.w, entry.ex[0].hl) : null;
  // Without an example sentence, dictation becomes spelling; cloze shows the Chinese gloss instead of the sentence.
  // A picture question for a word that has no picture (removed, or 不要图片 chosen after the session was built)
  // becomes a cloze: a text plate would print the answer.
  const noPicture = step.kind === "picture" && !!entry && !atlas.img(entry);
  const kind: QuizKind = step.kind === "dictation" && !sentence ? "spell" : noPicture ? "cloze" : step.kind;
  // the dictation sentence's voice: 女/男 under the sentence, kept for the rest of the session
  const [exVoice, setExVoice] = useState<Accent>(settings.accent);
  const exVoiceRef = useRef(exVoice);
  exVoiceRef.current = exVoice;
  const playSentence = useCallback(
    (rate = 1, v: Accent = exVoiceRef.current) => entry?.ex[0] && play(atlas.audio(entry, "ex", v), entry.ex[0].en, v, rate),
    [atlas, entry],
  );

  useEffect(() => {
    if (pending || !entry) return;
    if (kind === "listen") void play(atlas.audio(entry, settings.accent), entry.w, settings.accent);
    if (kind === "dictation") void playSentence();
  }, [kind, entry, atlas, settings.accent, pending, playSentence]);

  const keys: Record<string, () => void> = {};
  if (pending) {
    keys.Enter = next;
    keys[" "] = next;
  } else if (kind === "gender") {
    ARTICLE_CHOICES.forEach((a, i) => (keys[String(i + 1)] = () => submit(a, isArticleCorrect(a, ref.g))));
  } else if (!isTyped(kind)) {
    options.forEach((o, i) => (keys[String(i + 1)] = () => submit(o.id, o.id === ref.id)));
  }
  if (!pending && !isTyped(kind)) keys["0"] = giveUp;
  useKeys(keys);

  if (!entry) return <span className="spinner" />;
  const target = kind === "dictation" && sentence ? sentence.hidden : spellTarget(entry);

  return (
    <div className={`quiz quiz-${kind} ${pending ? (pending.correct ? "is-right" : "is-wrong") : ""}`}>
      <p className="stage-label">
        <span className={`dot ${step.retry ? "dot-retry" : "dot-review"}`} />
        {step.retry ? "再见一面 · " : ""}
        {kind === "spell" && target !== entry.w ? "拼出这个词（连冠词 un / une）" : KIND_LABEL[kind]}
      </p>

      <section className="prompt">
        {kind === "meaning" && (
          <div className="prompt-word">
            <h2 className="headword" lang="fr">
              {entry.w}
            </h2>
            <Speak url={atlas.audio(entry, settings.accent)} text={entry.w} accent={settings.accent} label={<span className="ipa">{settings.accent === "us" ? entry.us || entry.uk : entry.uk || entry.us}</span>} />
          </div>
        )}
        {(kind === "cloze" || kind === "dictation") && (
          <div className="prompt-cloze">
            {sentence ? (
              <>
                {/* dictation: the sentence is shown below, with the blank itself as the place to type */}
                {kind === "cloze" && (
                  <p className="cloze" lang="fr">
                    {sentence.before}
                    <span className="blank">{pending ? sentence.hidden : "\u3000\u3000\u3000"}</span>
                    {sentence.after}
                  </p>
                )}
                {(kind === "cloze" || pending) && <p className="cloze-zh">{entry.ex[0].zh}</p>}
              </>
            ) : (
              <p className="cloze-gloss">
                <span className="pos">{entry.senses[0].pos}</span> {entry.senses[0].zh}
              </p>
            )}
            {kind === "dictation" && (
              <div className="cloze-listen">
                <button className="btn btn-ghost" onClick={() => playSentence()}>
                  <Volume2 size={17} /> 再听一遍
                </button>
                <button className="link" onClick={() => playSentence(0.7)}>
                  慢速
                </button>
                <VoicePick
                  entry={entry}
                  value={exVoice}
                  onPick={(v) => {
                    setExVoice(v);
                    void playSentence(1, v);
                  }}
                />
              </div>
            )}
          </div>
        )}
        {kind === "picture" && (
          <div className="prompt-picture">
            <Illustration src={atlas.img(entry)} word={entry.w} topic={ref.topic} eager />
            <p className="cloze" lang="fr">
              {sentence ? (
                <>
                  {sentence.before}
                  <span className="blank">{pending ? sentence.hidden : "　　　"}</span>
                  {sentence.after}
                </>
              ) : (
                entry.senses[0].zh
              )}
            </p>
            {sentence && pending && <p className="cloze-zh">{entry.ex[0].zh}</p>}
          </div>
        )}
        {kind === "listen" && (
          <div className="prompt-listen">
            <button className="listen-orb" onClick={() => play(atlas.audio(entry, settings.accent), entry.w, settings.accent)} aria-label="再听一遍">
              <Volume2 size={40} strokeWidth={1.6} />
              <span />
            </button>
            <button className="link" onClick={() => play(atlas.audio(entry, settings.accent), entry.w, settings.accent, 0.7)}>
              慢速再听
            </button>
          </div>
        )}
        {kind === "spell" && <SpellPrompt entry={entry} refw={ref} hints={hints} />}
        {kind === "gender" && (
          <div className="prompt-word prompt-gender">
            <h2 className="headword" lang="fr">
              <span className={`blank-art ${pending ? articleTone(entry.art) : ""}`}>{pending ? entry.art : "\u00a0"}</span> {entry.w}
            </h2>
            <p className="gender-zh">{entry.senses[0].zh}</p>
            <Speak url={atlas.audio(entry, settings.accent)} text={entry.w} accent={settings.accent} size="sm" label="听发音" />
          </div>
        )}
      </section>

      {kind === "gender" ? (
        <ul className="options options-gender">
          {ARTICLE_CHOICES.map((a, i) => {
            const isAnswer = isArticleCorrect(a, ref.g);
            const chosen = pending?.value === a;
            const cls = pending ? (isAnswer ? "is-answer" : chosen ? "is-chosen" : "is-dim") : "";
            return (
              <li key={a}>
                <button className={`option option-art ${articleTone(a)} ${cls}`} data-option={a} onClick={() => submit(a, isAnswer)} disabled={!!pending}>
                  <kbd>{i + 1}</kbd>
                  <span lang="fr">{a}</span>
                  {pending && isAnswer && <Check size={20} className="option-mark" />}
                  {pending && chosen && !isAnswer && <X size={20} className="option-mark" />}
                </button>
              </li>
            );
          })}
        </ul>
      ) : isTyped(kind) ? (
        <SpellInput target={target} sentence={kind === "dictation" && sentence ? sentence : undefined} pending={pending} hints={hints} onHint={() => setHints((h) => Math.min(target.length - 1, h + 1))} onSubmit={(v) => {
          const verdict = articleVerdict(v, target);
          submit(v, verdict === "exact" || verdict === "accent", verdict === "accent", verdict === "article");
        }} onGiveUp={giveUp} />
      ) : (
        <ul className={`options ${kind === "meaning" ? "options-zh" : "options-en"}`}>
          {options.map((o, i) => {
            const isAnswer = o.id === ref.id;
            const chosen = pending?.value === o.id;
            const cls = pending ? (isAnswer ? "is-answer" : chosen ? "is-chosen" : "is-dim") : "";
            return (
              <li key={o.id}>
                <button className={`option ${cls}`} data-option={o.id} onClick={() => submit(o.id, isAnswer)} disabled={!!pending}>
                  <kbd>{i + 1}</kbd>
                  <span lang={kind === "meaning" ? "zh" : "fr"}>{kind === "meaning" ? o.zh : o.word}</span>
                  {pending && isAnswer && <Check size={20} className="option-mark" />}
                  {pending && chosen && !isAnswer && <X size={20} className="option-mark" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!pending && !isTyped(kind) && (
        <button type="button" className="btn btn-ghost quiz-giveup" onClick={giveUp}>
          不会，看卡片 <kbd>0</kbd>
        </button>
      )}
      {pending && <Feedback entry={entry} refw={ref} correct={pending.correct} accentOnly={pending.accentOnly} articleWrong={pending.articleWrong} onNext={next} />}
    </div>
  );
}

function SpellPrompt({ entry, refw, hints }: { entry: Entry; refw: WordRef; hints: number }) {
  const atlas = useAtlas();
  const accent = useStore((s) => s.settings.accent);
  const sentence = entry.ex[0] ? gap(entry.ex[0].en, entry.w, entry.ex[0].hl) : null;
  void hints;
  return (
    <div className={`prompt-spell ${atlas.img(entry) ? "" : "is-text"}`}>
      {/* a text plate would print the answer: only a real picture is shown here */}
      {atlas.img(entry) ? <Illustration src={atlas.img(entry)} word={entry.w} topic={refw.topic} eager className="spell-art" /> : null}
      <div>
        <p className="spell-zh">
          <span className="pos">{entry.senses[0].pos}</span> {entry.senses[0].zh}
        </p>
        {sentence && (
          <p className="cloze cloze-sm" lang="fr">
            {sentence.before}
            <span className="blank">　　　</span>
            {sentence.after}
          </p>
        )}
        <Speak url={atlas.audio(entry, accent)} text={entry.w} accent={accent} size="sm" label="听发音" />
      </div>
    </div>
  );
}

/**
 * The answer is typed in one visible field, and nothing else changes with the mouse or the focus. In a dictation
 * the field sits in the sentence, in place of the missing word; for a spelling it stands alone.
 */
function SpellInput({ target, sentence, pending, hints, onHint, onSubmit, onGiveUp }: { target: string; sentence?: { before: string; after: string }; pending?: { correct: boolean; value: string }; hints: number; onHint: () => void; onSubmit: (v: string) => void; onGiveUp: () => void }) {
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const prefix = target.slice(0, hints);
  useEffect(() => {
    if (hints && !normalize(value).startsWith(normalize(prefix))) setValue(prefix);
    input.current?.focus();
  }, [hints]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = pending ? pending.value : value;
  const field = (
    <>
      <input
        ref={input}
        className={`spell-field ${pending ? (pending.correct ? "is-ok" : "is-bad") : ""}`}
        style={{ width: `${Math.max(5, Math.max(target.length, shown.length) + 2)}ch` }}
        lang="fr"
        value={shown}
        onChange={(e) => !pending && setValue(e.target.value.slice(0, target.length + 6))}
        autoFocus
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="done"
        aria-label={sentence ? `填上听到的词，${target.length} 个字符` : `拼写，${target.length} 个字符`}
        readOnly={!!pending}
      />
      {pending && !pending.correct && <ins className="spell-right">{target}</ins>}
    </>
  );
  return (
    <form
      className="spell"
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending && value.trim()) onSubmit(value);
      }}
    >
      {sentence ? (
        <p className="cloze spell-sentence" lang="fr">
          {sentence.before}
          {field}
          {sentence.after}
        </p>
      ) : (
        <p className="spell-alone">{field}</p>
      )}
      {!pending && <AccentKeys input={input} value={value} onChange={(v) => setValue(v.slice(0, target.length + 6))} />}
      {!pending && (
        <div className="spell-actions">
          <button type="button" className="btn btn-ghost" onClick={onHint} disabled={hints >= target.length - 1}>
            <Lightbulb size={17} /> 提示字母
          </button>
          <button type="button" className="btn btn-ghost" onClick={onGiveUp}>
            不会，看卡片
          </button>
          <button type="submit" className="btn btn-primary" disabled={!value.trim()}>
            确认 <kbd>Enter</kbd>
          </button>
        </div>
      )}
    </form>
  );
}

function Feedback({ entry, refw, correct, accentOnly, articleWrong, onNext }: { entry: Entry; refw: WordRef; correct: boolean; accentOnly?: boolean; articleWrong?: boolean; onNext: () => void }) {
  const atlas = useAtlas();
  const btn = useRef<HTMLButtonElement>(null);
  const sheetOpen = useLocation().word !== null;
  // focus "continue" on arrival and again once the word sheet closes, so Enter keeps going
  useEffect(() => {
    if (sheetOpen) return;
    const t = setTimeout(() => btn.current?.focus({ preventScroll: true }));
    return () => clearTimeout(t);
  }, [sheetOpen]);
  return (
    <div className={`feedback ${correct ? "is-right" : "is-wrong"}`} role="status">
      <div className={`feedback-inner ${entry.noImg ? "no-art" : ""}`}>
        {!entry.noImg && <Illustration src={atlas.img(entry, "thumb")} word={entry.w} topic={refw.topic} className="feedback-art" art={entry.art} />}
        <div className="feedback-text">
          <p className="feedback-verdict">{accentOnly ? "差一点：只是重音不对" : articleWrong ? `词拼对了，冠词要用 ${entry.art}` : correct ? "答对了" : "没关系，记住它"}</p>
          <p className="feedback-word">
            <b lang="fr">
              {entry.art && <span className={`art ${articleTone(entry.art)}`}>{entry.art}</span>}
              {entry.w}
            </b>
            <span className="ipa">{entry.uk || entry.us}</span>
          </p>
          <p className="feedback-zh">
            {entry.senses.length > 1
              ? entry.senses.slice(0, 4).map((s, i) => (
                  <span key={i} className="feedback-sense">
                    <b>{i + 1}</b>
                    {s.zh}
                  </span>
                ))
              : `${entry.senses[0].pos} ${entry.senses[0].zh}`}
          </p>
          {entry.ex[0] && (
            <p className="feedback-ex" lang="fr">
              <Highlight text={entry.ex[0].en} word={entry.w} span={entry.ex[0].hl} />
            </p>
          )}
        </div>
        <div className="feedback-actions">
          <button type="button" className="btn btn-ghost feedback-more" onClick={() => openWord(entry.id)}>
            <BookOpen size={18} /> 详情
          </button>
          <button ref={btn} className={`btn btn-xl ${correct ? "btn-sage" : "btn-terra"}`} onClick={onNext}>
            继续 <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Summary({ session }: { session: ActiveSession }) {
  const atlas = useAtlas();
  useEffect(() => {
    if (store.get().settings.sfx) void cue("complete");
  }, []);
  const stats = sessionStats(session);
  const words = [...new Set(session.steps.map((s) => s.id))].map((id) => atlas.byId.get(id)!).filter(Boolean);
  const wrong = words.filter((w) => session.graded[w.id] === Rating.Again);
  const minutes = Math.max(1, Math.round(((session.finished ?? Date.now()) - session.started) / 60000));
  const done = () => {
    store.progress((p) => ({ ...p, session: null }));
    go({ page: "today" });
  };
  const again = () => {
    const { progress, settings } = store.get();
    store.progress((p) => ({ ...p, session: buildSession(atlas, progress, settings, { ids: wrong.map((w) => w.id) }) }));
  };
  return (
    <div className="learn summary">
      <div className="summary-card">
        <div className="summary-sky">
          <Galaxy mode="mini" highlight={words.map((w) => w.id)} ignite />
          <p>今天点亮了 {words.length} 颗星</p>
        </div>
        <p className="eyebrow">这一程结束了</p>
        <h1 className="display">{stats.accuracy >= 90 ? "漂亮的一程。" : stats.accuracy >= 60 ? "稳稳向前。" : "错过的，会再相遇。"}</h1>
        <div className="summary-stats">
          <Ring value={stats.accuracy / 100} size={128} tone={stats.accuracy >= 60 ? "sage" : "terra"}>
            <b>{stats.accuracy}%</b>
            <small>首次正确</small>
          </Ring>
          <dl>
            <div>
              <dt>新词</dt>
              <dd>{session.newIds.length}</dd>
            </div>
            <div>
              <dt>复习</dt>
              <dd>{session.reviewIds.length}</dd>
            </div>
            <div>
              <dt>用时</dt>
              <dd>
                {minutes}
                <small>分钟</small>
              </dd>
            </div>
          </dl>
        </div>
        <ul className="summary-words">
          {words.map((w) => (
            <li key={w.id} className={session.graded[w.id] === Rating.Again ? "is-wrong" : ""}>
              <Illustration src={atlas.img(w, "thumb")} word={w.word} topic={w.topic} art={plateArticle(w)} />
              <span lang="fr">{w.word}</span>
              <small>{w.zh}</small>
            </li>
          ))}
        </ul>
        <p className="summary-note">FSRS 已为每个词排好下次相遇的时间。答错的词，会更早回来。</p>
        <div className="summary-actions">
          {wrong.length > 0 && (
            <button className="btn btn-ghost" onClick={again}>
              <RotateCcw size={18} /> 再练 {wrong.length} 个错词
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => shareSession(atlas, session)}>
            <Share2 size={18} /> 分享成绩卡
          </button>
          <button className="btn btn-primary btn-xl" onClick={done} ref={(b) => b?.focus({ preventScroll: true })}>
            完成 <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Page-level shortcuts that ignore typing in inputs (except Enter, which forms handle). */
export function useKeys(map: Record<string, () => void>) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      // a word sheet is open on top of the session: leave its keys alone
      if (currentLocation().word) return;
      const t = e.target as HTMLElement;
      const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA";
      if (typing && !(e.key === "Enter" && (t as HTMLInputElement).readOnly)) return;
      if (t.tagName === "BUTTON" && (e.key === "Enter" || e.key === " ")) return;
      const fn = ref.current[e.key];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
}
