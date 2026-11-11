import { ArrowRight, Check, Lightbulb, Volume2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { WORD_BY_ID, zhOf, topicOf, type WordEntry, type TopicKey } from "../data";
import { clozeOf, diagnose, splitPair } from "../lib/fr";
import { go } from "../lib/router";
import { speakFr, stopSpeech } from "../lib/speech";
import { advance, answer, buildSession, gradeFor, sessionStats, clozeable } from "../store/session";
import { Rating } from "../store/srs";
import { store, useStore, type ActiveSession, type QuizKind, type Step } from "../store/store";
import { Art } from "../ui/Art";
import { EntryView } from "../ui/EntryView";
import { Ring } from "../ui/Ring";
import { Speak } from "../ui/Speak";

export function Learn() {
  const session = useStore((s) => s.progress.session);

  useEffect(() => {
    const { progress, settings } = store.get();
    if (!progress.session) {
      const s = buildSession(progress, settings);
      if (!s.steps.length) {
        go("today");
        return;
      }
      store.progress((p) => ({ ...p, session: s }));
    }
  }, []);

  useEffect(() => () => stopSpeech(), []);

  if (!session) return <div className="learn learn-loading"><span className="spinner" /></div>;
  if (session.finished || session.index >= session.steps.length) return <Summary session={session} />;
  return <Runner session={session} />;
}

function Runner({ session }: { session: ActiveSession }) {
  const step = session.steps[session.index];
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [session.index]);
  const total = session.steps.length;
  const exit = () => {
    stopSpeech();
    go("today");
  };
  return (
    <div className="learn">
      <header className="learn-top">
        <button className="icon-btn" onClick={exit} aria-label="暂停并返回今日（进度已保存）">
          <X size={20} />
        </button>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={session.index}>
          <span style={{ width: `${(session.index / total) * 100}%` }} />
        </div>
        <span className="learn-count">
          {session.index + 1} / {total}
        </span>
      </header>
      <StepView key={`${session.id}-${session.index}`} session={session} step={step} />
    </div>
  );
}

function StepView({ session, step }: { session: ActiveSession; step: Step }) {
  const word = WORD_BY_ID.get(step.id)!;
  const settings = useStore((s) => s.settings);
  const startedAt = useRef(Date.now());
  const next = () => {
    const secs = (Date.now() - startedAt.current) / 1000;
    stopSpeech();
    advance(secs);
  };

  if (step.kind === "intro") {
    return (
      <section className="step step-intro">
        <p className="step-kicker">新词 · 先认识它</p>
        <Art topic={word.topic as TopicKey} tone={topicOf(word.topic as TopicKey).tone} word={word.w} className="step-art" />
        <h2 className="step-word" lang="fr">
          {word.w}
        </h2>
        <Speak text={word.w} label="écouter" />
        <p className="step-zh">{word.senses[0].zh}</p>
        <blockquote className="step-ex" lang="fr">
          {word.ex[0].fr}
        </blockquote>
        <p className="ex-zh">{word.ex[0].zh}</p>
        <button className="btn btn-primary btn-xl" onClick={next}>
          记住了 <ArrowRight size={19} />
        </button>
      </section>
    );
  }
  return <Quiz session={session} step={step} word={word} autoplay={settings.autoplay} onNext={next} startedAt={startedAt.current} />;
}

function Quiz({ session, step, word, autoplay, onNext, startedAt }: { session: ActiveSession; step: Step & { kind: QuizKind }; word: WordEntry; autoplay: boolean; onNext: () => void; startedAt: number }) {
  const pending = session.pending;
  const [hinted, setHinted] = useState(false);
  const [typed, setTyped] = useState("");
  const kind = step.kind as QuizKind;
  const options = step.options ?? [];
  const exIdx = clozeable(word)[0] ?? 0;
  const cloze = kind === "cloze" ? clozeOf(word.ex[exIdx].fr, word.w) : null;

  useEffect(() => {
    if (kind === "listen" && autoplay) speakFr(word.w, store.get().settings.rate);
  }, [kind, autoplay, word.w]);

  const choose = (id: string) => {
    if (pending) return;
    const correct = id === word.id;
    const ms = Date.now() - startedAt;
    answer(step, correct, gradeFor(kind, correct, ms, hinted), id);
  };

  const submitSpell = () => {
    if (pending || !typed.trim()) return;
    const d = diagnose(typed, word.w);
    const ms = Date.now() - startedAt;
    answer(step, d === "exact", gradeFor(kind, d === "exact", ms, hinted), typed);
  };

  return (
    <section className="step step-quiz">
      <p className="step-kicker">{KIND_LABEL[kind]}</p>

      {kind === "meaning" && (
        <>
          <h2 className="step-word" lang="fr">
            {word.w}
          </h2>
          <p className="step-sub">{word.senses[0].pos} · 选出正确的中文释义</p>
          <Options>
            {options.map((id) => {
              const o = WORD_BY_ID.get(id)!;
              return <OptionBtn key={id} id={id} correctId={word.id} pending={pending} onPick={choose} label={zhOf(o)} />;
            })}
          </Options>
        </>
      )}

      {kind === "cloze" && cloze && (
        <>
          <p className="step-sub">根据语境，选出空缺处的词</p>
          <blockquote className="step-ex step-cloze" lang="fr">
            {cloze.before}
            <span className="blank">{pending ? cloze.answer : "_____"}</span>
            {cloze.after}
          </blockquote>
          <p className="ex-zh">{pending ? word.ex[exIdx].zh : "（作答后显示译文）"}</p>
          <Options>
            {options.map((id) => {
              const o = WORD_BY_ID.get(id)!;
              return <OptionBtn key={id} id={id} correctId={word.id} pending={pending} onPick={choose} label={o.w} lang="fr" />;
            })}
          </Options>
        </>
      )}

      {kind === "listen" && (
        <>
          <button className="listen-btn" onClick={() => speakFr(word.w, store.get().settings.rate)} aria-label="再听一次">
            <Volume2 size={34} />
          </button>
          <p className="step-sub">听发音，选出你听到的词</p>
          <Options>
            {options.map((id) => {
              const o = WORD_BY_ID.get(id)!;
              return <OptionBtn key={id} id={id} correctId={word.id} pending={pending} onPick={choose} label={o.w} lang="fr" />;
            })}
          </Options>
        </>
      )}

      {kind === "spell" && (
        <>
          <p className="step-zh big">{word.senses[0].zh}</p>
          <p className="step-sub">{word.senses[0].pos} · 拼写对应的法语词（注意重音符号）</p>
          <form
            className="spell"
            onSubmit={(e) => {
              e.preventDefault();
              submitSpell();
            }}
          >
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={!!pending}
              autoFocus
              lang="fr"
              autoCapitalize="off"
              autoComplete="off"
              spellCheck={false}
              aria-label="输入法语单词"
              placeholder={hinted ? `${word.w[0]}…` : "在这里输入"}
            />
            {!pending && (
              <div className="spell-actions">
                <button type="button" className="btn btn-glass" onClick={() => setHinted(true)} disabled={hinted}>
                  <Lightbulb size={16} /> 提示首字母
                </button>
                <button className="btn btn-primary" type="submit" disabled={!typed.trim()}>
                  提交
                </button>
              </div>
            )}
          </form>
        </>
      )}

      {pending && (
        <Feedback correct={pending.correct} word={word} kind={kind} typed={pending.value} />
      )}

      {pending && (
        <button className="btn btn-primary btn-xl next-btn" onClick={onNext}>
          继续 <ArrowRight size={19} />
        </button>
      )}
    </section>
  );
}

const KIND_LABEL: Record<QuizKind, string> = {
  meaning: "选义",
  cloze: "语境填空",
  listen: "听音辨词",
  spell: "拼写",
};

function Options({ children }: { children: React.ReactNode }) {
  return <div className="options">{children}</div>;
}

function OptionBtn({ id, correctId, pending, onPick, label, lang }: { id: string; correctId: string; pending?: { correct: boolean; value: string }; onPick: (id: string) => void; label: string; lang?: string }) {
  const isAnswer = id === correctId;
  const isChosen = pending?.value === id;
  const cls = pending ? (isAnswer ? "is-right" : isChosen ? "is-wrong" : "is-dim") : "";
  return (
    <button className={`option ${cls}`} onClick={() => onPick(id)} disabled={!!pending} lang={lang}>
      {label}
      {pending && isAnswer && <Check size={16} />}
      {pending && isChosen && !isAnswer && <X size={16} />}
    </button>
  );
}

function Feedback({ correct, word, kind, typed }: { correct: boolean; word: WordEntry; kind: QuizKind; typed: string }) {
  const d = kind === "spell" ? diagnose(typed, word.w) : null;
  return (
    <div className={`feedback ${correct ? "is-right" : "is-wrong"}`} role="status">
      <p className="feedback-title">
        {correct ? "答对了" : kind === "spell" && d === "accent" ? "差在重音符号" : "再练一次"}
      </p>
      <p className="feedback-word" lang="fr">
        {word.w}
        <span className="pos-line"> {word.senses[0].pos}</span>
      </p>
      <p className="feedback-zh">{word.senses[0].zh}</p>
      <p className="feedback-ex" lang="fr">
        {word.ex[0].fr}
      </p>
      <p className="ex-zh">{word.ex[0].zh}</p>
      {!correct && <p className="feedback-tip"><Lightbulb size={15} /> {word.tip}</p>}
    </div>
  );
}

function Summary({ session }: { session: ActiveSession }) {
  const stats = sessionStats(session);
  const newCount = session.newIds.length;
  const reviewCount = session.reviewIds.length;
  const mistakes = Object.entries(session.graded).filter(([, g]) => g === Rating.Again).map(([id]) => id);
  const [showWord, setShowWord] = useState<string | null>(null);
  const done = () => {
    store.progress((p) => ({ ...p, session: null }));
    go("today");
  };
  return (
    <div className="learn summary">
      <div className="summary-card">
        <Ring value={stats.accuracy / 100} size={148} stroke={10} tone="ochre">
          <b>{stats.accuracy}%</b>
          <small>首次正确率</small>
        </Ring>
        <h2 className="display">今日这一程，走完了。</h2>
        <dl className="summary-stats">
          <div>
            <dt>作答</dt>
            <dd>{stats.total}</dd>
          </div>
          <div>
            <dt>新词</dt>
            <dd>{newCount}</dd>
          </div>
          <div>
            <dt>复习</dt>
            <dd>{reviewCount}</dd>
          </div>
        </dl>
        {mistakes.length > 0 && (
          <div className="summary-mistakes">
            <h3 className="eyebrow">需要再看的词</h3>
            <ul>
              {mistakes.map((id) => (
                <li key={id}>
                  <button className="link" onClick={() => setShowWord(id)} lang="fr">
                    {WORD_BY_ID.get(id)?.w}
                  </button>
                  <small>{splitPair(WORD_BY_ID.get(id)?.col[0] ?? "").zh}</small>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="summary-actions">
          <button className="btn btn-primary btn-xl" onClick={done}>
            回到今日 <ArrowRight size={19} />
          </button>
          <button className="btn btn-glass" onClick={() => go("atlas")}>
            浏览词图
          </button>
        </div>
      </div>
      {showWord && WORD_BY_ID.get(showWord) && (
        <div className="summary-peek">
          <EntryView entry={WORD_BY_ID.get(showWord)!} mode="intro" />
          <button className="btn btn-glass" onClick={() => setShowWord(null)}>
            关闭
          </button>
        </div>
      )}
    </div>
  );
}
