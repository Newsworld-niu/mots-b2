import { ArrowLeft, ArrowRight, Check, Lightbulb, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useGrammar } from "../atlas/grammar";
import { answerOf, orderRight, shuffled, type ChoiceDrill, type Drill, type GrammarData, type GrammarPoint, type OrderDrill } from "../lib/grammar";
import { go } from "../lib/router";
import { cue } from "../lib/sound";
import { hashSeed, shuffle } from "../lib/text";
import { duePoints, gradePoint, pickDrills, REVIEW_ROUND, ROUND, skipDrill } from "../store/grammar";
import { Rating } from "../store/srs";
import { store, useStore } from "../store/store";
import { Speak } from "../ui/Speak";
import { useKeys } from "./Learn";

const LEVELS = ["A1", "A2", "B1", "B2"] as const;

/** 语法点 / 动词变位: the two halves of the 语法 tab. */
export function GrammarTabs({ on }: { on: "grammar" | "conj" }) {
  return (
    <div className="segmented gram-tabs" role="tablist">
      <a role="tab" aria-selected={on === "grammar"} className={on === "grammar" ? "is-on" : ""} href="#/grammar">
        语法点
      </a>
      <a role="tab" aria-selected={on === "conj"} className={on === "conj" ? "is-on" : ""} href="#/conj">
        动词变位
      </a>
    </div>
  );
}

interface Step {
  point: string;
  drill: Drill;
}

export function Grammar({ pointId }: { pointId?: string }) {
  const { data, error } = useGrammar();
  const [run, setRun] = useState<{ steps: Step[]; key: number } | null>(null);
  if (error) return <div className="page"><p className="muted">{error}</p></div>;
  if (!data) return <div className="page learn-loading"><span className="spinner" /></div>;
  if (run) return <Session key={run.key} data={data} initial={run.steps} onExit={() => setRun(null)} />;
  const start = (steps: Step[]) => steps.length && setRun({ steps, key: Date.now() });
  const point = pointId ? data.points.find((p) => p.id === pointId) : undefined;
  if (point) return <PointView point={point} onStart={start} />;
  return <Overview data={data} onStart={start} />;
}

/* ---------- overview ---------- */

function status(card: { due: number } | undefined, now: number) {
  if (!card) return { label: "未开始", cls: "" };
  if (card.due <= now) return { label: "该复习了", cls: "is-due" };
  const days = Math.max(1, Math.round((card.due - now) / 86400000));
  return { label: `${days} 天后复习`, cls: "is-ok" };
}

function Overview({ data, onStart }: { data: GrammarData; onStart: (s: Step[]) => void }) {
  const progress = useStore((s) => s.progress);
  const now = Date.now();
  const due = useMemo(() => duePoints(data, progress, now), [data, progress, now]);
  const started = data.points.filter((p) => progress.gram?.[p.id]).length;
  const next = data.points.find((p) => !progress.gram?.[p.id]);
  const review = () => {
    const seed = Date.now();
    onStart(due.flatMap((id) => pickDrills(data.points.find((p) => p.id === id)!, progress, REVIEW_ROUND, seed).map((drill) => ({ point: id, drill }))));
  };
  return (
    <div className="page gram">
      <header className="page-head">
        <GrammarTabs on="grammar" />
        <p className="eyebrow">语法 · Grammaire</p>
        <h1 className="display">规则，要在句子里练。</h1>
        <p className="lede">每个语法点有一段简短的讲解，练习题从词库的例句里自动挑出来。每个语法点是一张复习卡：一轮做错得多，就会更早回来。</p>
      </header>
      <div className="practice-grid">
        <section className="panel">
          <dl className="mini-stats conj-stats">
            <div>
              <dt>已开始</dt>
              <dd>
                {started} / {data.points.length}
              </dd>
            </div>
            <div>
              <dt>该复习</dt>
              <dd>{due.length}</dd>
            </div>
          </dl>
          {due.length > 0 ? (
            <button className="btn btn-primary btn-xl" onClick={review}>
              复习 {due.length} 个语法点（{due.length * REVIEW_ROUND} 题） <ArrowRight size={18} />
            </button>
          ) : next ? (
            <p className="muted">
              没有要复习的语法点。下一个可以学：{" "}
              <button className="link" onClick={() => go({ page: "grammar", p: next.id })}>
                {next.title}
              </button>
            </p>
          ) : (
            <p className="muted">所有语法点都在复习计划里了，今天没有到期的。</p>
          )}
        </section>
        <section className="gram-levels">
          {LEVELS.map((lv) => {
            const list = data.points.filter((p) => p.level === lv);
            if (!list.length) return null;
            return (
              <div key={lv} className="gram-level">
                <h3 className="eyebrow">{lv}</h3>
                <ul className="gram-list">
                  {list.map((p) => {
                    const st = status(progress.gram?.[p.id], now);
                    return (
                      <li key={p.id}>
                        <a className="gram-card" href={`#/grammar?p=${p.id}`}>
                          <span className="gram-card-title">{p.title}</span>
                          <small lang="fr">{p.fr}</small>
                          <span className={`gram-status ${st.cls}`}>{st.label}</span>
                          <small className="gram-count">{p.drills.length} 题</small>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}

/* ---------- one point ---------- */

function PointView({ point, onStart }: { point: GrammarPoint; onStart: (s: Step[]) => void }) {
  const progress = useStore((s) => s.progress);
  const card = progress.gram?.[point.id];
  const st = status(card, Date.now());
  const start = () => onStart(pickDrills(point, progress, ROUND).map((drill) => ({ point: point.id, drill })));
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [point.id]);
  return (
    <div className="page gram">
      <header className="page-head">
        <button className="link deck-back" onClick={() => go({ page: "grammar" })}>
          <ArrowLeft size={16} /> 全部语法点
        </button>
        <p className="eyebrow">
          {point.level} · <span lang="fr">{point.fr}</span> · 待核对
        </p>
        <h1 className="display gram-title">{point.title}</h1>
        <p className="lede">{point.intro}</p>
      </header>
      <div className="gram-body">
        {point.rules.map((r) => (
          <section key={r.h} className="panel gram-rule">
            <h3>{r.h}</h3>
            <p>{r.text}</p>
            <ul className="gram-examples">
              {r.ex.map(([fr, zh]) => (
                <li key={fr}>
                  <span lang="fr">{fr}</span>
                  <Speak url={null} text={fr} size="sm" />
                  <small>{zh}</small>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {point.traps.length > 0 && (
          <aside className="tip gram-traps">
            <Lightbulb size={17} strokeWidth={1.8} />
            <div>
              <b>容易错的地方</b>
              <ul>
                {point.traps.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </aside>
        )}
        <section className="panel gram-practice">
          <p className="muted">
            {point.drills.length} 道题 · {st.label}
            {card ? ` · 已复习 ${card.reps} 次` : ""}
          </p>
          <button className="btn btn-primary btn-xl" onClick={start} disabled={!point.drills.length}>
            练习 {Math.min(ROUND, point.drills.length)} 题 <ArrowRight size={18} />
          </button>
        </section>
      </div>
    </div>
  );
}

/* ---------- a round ---------- */

interface Answered {
  step: Step;
  ok: boolean;
}

function Session({ data, initial, onExit }: { data: GrammarData; initial: Step[]; onExit: () => void }) {
  const settings = useStore((s) => s.settings);
  const [i, setI] = useState(0);
  const [pending, setPending] = useState<{ ok: boolean; value: string } | null>(null);
  const [log, setLog] = useState<Answered[]>([]);
  const [graded, setGraded] = useState<Graded[] | null>(null);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);
  const step = initial[i];

  const answer = useCallback(
    (ok: boolean, value: string) => {
      if (pending || !step) return;
      if (settings.sfx) void cue(ok ? "correct" : "wrong");
      setPending({ ok, value });
      setLog((l) => [...l, { step, ok }]);
    },
    [pending, step, settings.sfx],
  );
  const next = useCallback(() => {
    setPending(null);
    // the round is graded once, when its last answer is left (an event, not a render: React may render twice)
    if (i + 1 >= initial.length && !graded) setGraded(gradeRound(log));
    setI((n) => n + 1);
  }, [i, initial.length, graded, log]);

  if (i >= initial.length) return <Summary data={data} log={log} graded={graded ?? []} onExit={onExit} />;
  const point = data.points.find((p) => p.id === step.point)!;
  return (
    <div className="page practice typing gram-run">
      <header className="typing-top">
        <button className="btn btn-ghost" onClick={onExit}>
          结束
        </button>
        <div className="learn-progress">
          <span style={{ width: `${(i / initial.length) * 100}%` }} />
        </div>
        <span className="typing-meter">
          <b>{i + 1}</b> / {initial.length}
        </span>
      </header>
      <section className="typing-stage gram-stage">
        <p className="stage-label">
          <span className="dot dot-review" />
          {point.title}
        </p>
        {step.drill.k === "c" ? (
          <ChoiceQuestion key={i} point={step.point} drill={step.drill} pending={pending} onAnswer={answer} onNext={next} />
        ) : (
          <OrderQuestion key={i} point={step.point} drill={step.drill} pending={pending} onAnswer={answer} onNext={next} />
        )}
      </section>
    </div>
  );
}

function Feedback({ point, drill, ok, onNext }: { point: string; drill: Drill; ok: boolean; onNext: () => void }) {
  const [skipped, setSkipped] = useState(false);
  return (
    <div className={`conj-feedback ${ok ? "is-right" : "is-wrong"}`} role="status">
      <p className="feedback-verdict">{ok ? "答对了" : "没关系，记住它"}</p>
      <p className="gram-full" lang="fr">
        {drill.k === "c" ? (
          <>
            {drill.s.slice(0, drill.b[0])}
            <b>{answerOf(drill)}</b>
            {drill.s.slice(drill.b[1])}
          </>
        ) : (
          drill.s
        )}
        <Speak url={null} text={drill.s} size="sm" />
      </p>
      <p className="gram-zh">{drill.z}</p>
      <p className="gram-why">{drill.y}</p>
      <button className={`btn btn-xl ${ok ? "btn-sage" : "btn-terra"}`} onClick={onNext} autoFocus>
        继续 <ArrowRight size={20} />
      </button>
      <button
        className="link gram-skip"
        disabled={skipped}
        onClick={() => {
          skipDrill(point, drill);
          setSkipped(true);
        }}
      >
        {skipped ? "以后不会再出这题" : "这题有问题（两个都对、句子不通），不再出现"}
      </button>
    </div>
  );
}

function ChoiceQuestion({ point, drill, pending, onAnswer, onNext }: { point: string; drill: ChoiceDrill; pending: { ok: boolean; value: string } | null; onAnswer: (ok: boolean, v: string) => void; onNext: () => void }) {
  const right = answerOf(drill);
  const options = useMemo(() => shuffle([...drill.o], hashSeed(drill.s)), [drill]);
  const keys: Record<string, () => void> = {};
  if (pending) {
    keys.Enter = onNext;
    keys[" "] = onNext;
  } else options.forEach((o, k) => (keys[String(k + 1)] = () => onAnswer(o === right, o)));
  useKeys(keys);
  const before = drill.s.slice(0, drill.b[0]);
  const after = drill.s.slice(drill.b[1]);
  return (
    <>
      <p className="gram-sentence" lang="fr">
        {before}
        <span className={`gram-blank ${pending ? (pending.ok ? "is-right" : "is-wrong") : ""}`}>{pending ? right : " ".repeat(Math.max(6, right.length + 2))}</span>
        {after}
      </p>
      <p className="gram-hint">{drill.h}</p>
      <ul className="options conj-options">
        {options.map((o, k) => {
          const isAnswer = o === right;
          const chosen = pending?.value === o;
          const cls = pending ? (isAnswer ? "is-answer" : chosen ? "is-chosen" : "is-dim") : "";
          return (
            <li key={o}>
              <button className={`option ${cls}`} onClick={() => onAnswer(isAnswer, o)} disabled={!!pending}>
                <kbd>{k + 1}</kbd>
                <span lang="fr">{o}</span>
                {pending && isAnswer && <Check size={20} className="option-mark" />}
                {pending && chosen && !isAnswer && <X size={20} className="option-mark" />}
              </button>
            </li>
          );
        })}
      </ul>
      {pending && <Feedback point={point} drill={drill} ok={pending.ok} onNext={onNext} />}
    </>
  );
}

function OrderQuestion({ point, drill, pending, onAnswer, onNext }: { point: string; drill: OrderDrill; pending: { ok: boolean; value: string } | null; onAnswer: (ok: boolean, v: string) => void; onNext: () => void }) {
  // words keep their position in the pool so that two equal words stay distinct
  const pool = useMemo(() => shuffled(drill.t, hashSeed(drill.s)).map((w, i) => ({ w, i })), [drill]);
  const [picked, setPicked] = useState<number[]>([]);
  const words = picked.map((k) => pool[k].w);
  const check = () => onAnswer(orderRight(drill, words), words.join(" "));
  const keys: Record<string, () => void> = {};
  if (pending) {
    keys.Enter = onNext;
    keys[" "] = onNext;
  } else {
    if (picked.length === pool.length) keys.Enter = check;
    keys.Backspace = () => setPicked((p) => p.slice(0, -1));
  }
  useKeys(keys);
  return (
    <>
      <p className="gram-zh gram-order-zh">{drill.z}</p>
      <p className="gram-hint">{drill.h}</p>
      <div className={`gram-answer ${pending ? (pending.ok ? "is-right" : "is-wrong") : ""}`} lang="fr" aria-label="你的句子">
        {picked.length === 0 && <span className="gram-placeholder">按顺序点下面的词</span>}
        {picked.map((k, n) => (
          <button key={k} className="gram-chip is-picked" disabled={!!pending} onClick={() => setPicked((p) => p.filter((_, j) => j !== n))}>
            {pool[k].w}
          </button>
        ))}
        {drill.p && picked.length === pool.length && <span>{drill.p}</span>}
      </div>
      <div className="gram-pool" lang="fr">
        {pool.map((x, k) => (
          <button key={k} className="gram-chip" disabled={!!pending || picked.includes(k)} onClick={() => setPicked((p) => [...p, k])}>
            {x.w}
          </button>
        ))}
      </div>
      {!pending && (
        <div className="summary-actions">
          <button className="btn btn-ghost" onClick={() => setPicked([])} disabled={!picked.length}>
            重来
          </button>
          <button className="btn btn-primary" onClick={check} disabled={picked.length !== pool.length}>
            检查 <kbd>Enter</kbd>
          </button>
        </div>
      )}
      {pending && <Feedback point={point} drill={drill} ok={pending.ok} onNext={onNext} />}
    </>
  );
}

/* ---------- end of a round ---------- */

interface Graded {
  id: string;
  total: number;
  wrong: number;
  grade: number;
}

/** Grade every point of a round from its answers. */
function gradeRound(log: Answered[]): Graded[] {
  const by = new Map<string, { total: number; wrong: number }>();
  for (const { step, ok } of log) {
    const x = by.get(step.point) ?? { total: 0, wrong: 0 };
    x.total++;
    if (!ok) x.wrong++;
    by.set(step.point, x);
  }
  return [...by].map(([id, x]) => ({ id, ...x, grade: gradePoint(id, x.wrong, x.total) }));
}

function Summary({ data, log, graded, onExit }: { data: GrammarData; log: Answered[]; graded: Graded[]; onExit: () => void }) {
  useEffect(() => {
    if (store.get().settings.sfx) void cue("complete");
  }, []);
  const right = log.filter((l) => l.ok).length;
  const wrong = log.filter((l) => !l.ok);
  return (
    <div className="page practice">
      <section className="panel typing-done">
        <p className="eyebrow">这一轮结束了</p>
        <h1 className="display">
          {right}/{log.length} <small>答对</small>
        </h1>
        <ul className="gram-result">
          {graded.map((g) => {
            const p = data.points.find((x) => x.id === g.id)!;
            return (
              <li key={g.id}>
                <a href={`#/grammar?p=${g.id}`}>{p.title}</a>
                <span>
                  {g.total - g.wrong}/{g.total}
                </span>
                <small>{g.grade === Rating.Good ? "掌握得不错" : g.grade === Rating.Hard ? "有一点小错" : "需要再练，很快会回来"}</small>
              </li>
            );
          })}
        </ul>
        {wrong.length > 0 && (
          <ul className="gram-wrong">
            {wrong.map(({ step }, k) => (
              <li key={k} lang="fr">
                {step.drill.k === "c" ? (
                  <>
                    {step.drill.s.slice(0, step.drill.b[0])}
                    <b>{answerOf(step.drill)}</b>
                    {step.drill.s.slice(step.drill.b[1])}
                  </>
                ) : (
                  step.drill.s
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="muted">每个语法点的下次复习时间已经排好。</p>
        <div className="summary-actions">
          <button className="btn btn-primary btn-xl" onClick={onExit} autoFocus>
            <RotateCcw size={18} /> 返回
          </button>
        </div>
      </section>
    </div>
  );
}
