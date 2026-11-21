import { ArrowLeft, ArrowRight, Check, FileText, Lightbulb, Printer, RotateCcw, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ready, useAiConfig } from "../ai/config";
import { checkRewrite } from "../ai/tasks";
import { useGrammar } from "../atlas/grammar";
import { DISCOURSE_EXERCISES, type DiscourseExercise } from "../lib/grammar-discourse";
import {
  answerOf,
  checkTyped,
  fixedOf,
  fullOf,
  orderRight,
  shuffled,
  tagLabel,
  tagsOf,
  type ChoiceDrill,
  type Drill,
  type FixDrill,
  type GrammarData,
  type GrammarPoint,
  type OrderDrill,
  type TransformDrill,
  type TypeDrill,
} from "../lib/grammar";
import { go } from "../lib/router";
import { cue } from "../lib/sound";
import { hashSeed, shuffle } from "../lib/text";
import { duePoints, ESSAY_TAG, essayErrors, gradePoint, mineDrills, missingPrereqs, nextPoint, pickDrills, REVIEW_ROUND, ROUND, shouldAmendRewrite, skipDrill, tagKey, untouchedWithErrors } from "../store/grammar";
import { Rating } from "../store/srs";
import { store, useStore } from "../store/store";
import { Speak } from "../ui/Speak";
import { useKeys } from "./Learn";

const LEVELS = ["A1", "A2", "B1", "B2"] as const;
const ACCENTS = ["é", "è", "ê", "à", "â", "ç", "î", "ï", "ô", "û", "ù", "ë", "œ", "«", "»"];

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

export function Grammar({ pointId, sheet }: { pointId?: string; sheet?: boolean }) {
  const { data, error } = useGrammar();
  const [run, setRun] = useState<{ steps: Step[]; key: number } | null>(null);
  const [discourse, setDiscourse] = useState<DiscourseExercise | null>(null);
  if (error) return <div className="page"><p className="muted">{error}</p></div>;
  if (!data) return <div className="page learn-loading"><span className="spinner" /></div>;
  if (run) return <Session key={run.key} data={data} initial={run.steps} onExit={() => setRun(null)} />;
  if (discourse) return <DiscourseSession key={discourse.id} exercise={discourse} onExit={() => setDiscourse(null)} onOpenExercise={setDiscourse} />;
  const start = (steps: Step[]) => steps.length && setRun({ steps, key: Date.now() });
  if (sheet) return <CheatSheet data={data} />;
  const point = pointId ? data.points.find((p) => p.id === pointId) : undefined;
  if (point) return <PointView data={data} point={point} onStart={start} />;
  return <Overview data={data} onStart={start} onDiscourse={setDiscourse} />;
}

const titleOf = (data: GrammarData, id: string) => data.points.find((p) => p.id === id)?.title ?? id;

/* ---------- overview ---------- */

function status(card: { due: number } | undefined, now: number) {
  if (!card) return { label: "未开始", cls: "" };
  if (card.due <= now) return { label: "该复习了", cls: "is-due" };
  const days = Math.max(1, Math.round((card.due - now) / 86400000));
  return { label: `${days} 天后复习`, cls: "is-ok" };
}

function Overview({ data, onStart, onDiscourse }: { data: GrammarData; onStart: (s: Step[]) => void; onDiscourse: (ex: DiscourseExercise) => void }) {
  const progress = useStore((s) => s.progress);
  const startLevel = useStore((s) => s.settings.startLevel);
  const now = Date.now();
  const due = useMemo(() => duePoints(data, progress, now), [data, progress, now]);
  const fresh = useMemo(() => untouchedWithErrors(data, progress), [data, progress]);
  const started = data.points.filter((p) => progress.gram?.[p.id]).length;
  const next = nextPoint(data, progress, startLevel);
  const orderedLevels = useMemo(() => {
    const startBand = Math.min(startLevel, LEVELS.length - 1);
    return [...LEVELS.slice(startBand), ...LEVELS.slice(0, startBand)];
  }, [startLevel]);
  const review = () => {
    const seed = Date.now();
    const errors = essayErrors(progress);
    onStart(due.flatMap((id) => pickDrills(data.points.find((p) => p.id === id)!, progress, REVIEW_ROUND, seed, mineDrills(errors.get(id))).map((drill) => ({ point: id, drill }))));
  };
  return (
    <div className="page gram">
      <header className="page-head">
        <GrammarTabs on="grammar" />
        <p className="eyebrow">语法 · Grammaire</p>
        <h1 className="display">规则，要在句子里练。</h1>
        <p className="lede">每个语法点有讲解、判断顺序和对比句，练习覆盖它的每一条规则和每一个易错点。每个语法点是一张复习卡：一轮做错得多，就会更早回来；哪一部分常错，那一部分就出得多。</p>
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
              复习 {due.length} 个语法点（约 {due.length * REVIEW_ROUND} 题） <ArrowRight size={18} />
            </button>
          ) : next ? (
            <p className="muted">
              按当前起点（{LEVELS[Math.min(startLevel, LEVELS.length - 1)]}）推荐优先学：{" "}
              <button className="link" onClick={() => go({ page: "grammar", p: next.id })}>
                {next.level} · {next.title}
              </button>
            </p>
          ) : (
            <p className="muted">所有语法点都在复习计划里了，今天没有到期的。</p>
          )}
          {due.length > 0 && next && (
            <p className="muted small">
              下一个推荐新学（{next.level}）：{" "}
              <button className="link" onClick={() => go({ page: "grammar", p: next.id })}>
                {next.title}
              </button>
            </p>
          )}
          {fresh.length > 0 && (
            <div className="gram-fresh">
              <p className="muted">批改纠错里出现过、还没开始练的语法点：</p>
              <ul>
                {fresh.map(({ point, n }) => (
                  <li key={point.id}>
                    <a className="link" href={`#/grammar?p=${point.id}`}>
                      {point.title}
                    </a>
                    <small>错过 {n} 处</small>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="gram-discourse-box">
            <div className="gram-discourse-head">
              <h3 className="eyebrow">语篇级综合训练 · 跨句时态与改错</h3>
              <span className="muted small">整段上下文里练时态呼应与纠错</span>
            </div>
            <ul className="gram-discourse-list">
              {DISCOURSE_EXERCISES.map((ex) => (
                <li key={ex.id}>
                  <button type="button" className="gram-discourse-item" onClick={() => onDiscourse(ex)}>
                    <span>
                      <span className="chip">{ex.level}</span> <b>{ex.title}</b>
                      <small>{ex.subtitle}</small>
                    </span>
                    <ArrowRight size={15} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <a className="btn btn-ghost gram-sheet-link" href="#/grammar?sheet=1">
            <FileText size={16} /> 速查表：所有语法点的口诀和判断顺序
          </a>
        </section>
        <section className="gram-levels">
          {orderedLevels.map((lv) => {
            const list = data.points.filter((p) => p.level === lv);
            if (!list.length) return null;
            return (
              <div key={lv} className="gram-level">
                <h3 className="eyebrow">
                  {lv}
                  {lv === LEVELS[Math.min(startLevel, LEVELS.length - 1)] && " · 当前起点优先"}
                </h3>
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

/* ---------- 速查表 ---------- */

function CheatSheet({ data }: { data: GrammarData }) {
  const [level, setLevel] = useState<"all" | (typeof LEVELS)[number]>("all");
  const [query, setQuery] = useState("");
  const [showPairs, setShowPairs] = useState(false);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);
  const q = query.trim().toLowerCase();
  const matches = (p: GrammarPoint) => {
    if (!q) return true;
    const hay = [p.title, p.fr, p.motto ?? "", ...(p.decide ?? []), ...p.rules.map((r) => r.h), ...p.traps, ...(p.pairs ?? []).flatMap((x) => [x.a, x.b, x.d])].join(" ").toLowerCase();
    return hay.includes(q);
  };
  const levels = level === "all" ? LEVELS : ([level] as const);
  return (
    <div className="page gram gram-sheet">
      <header className="page-head">
        <button className="link deck-back" onClick={() => go({ page: "grammar" })}>
          <ArrowLeft size={16} /> 全部语法点
        </button>
        <p className="eyebrow">语法 · 速查表</p>
        <h1 className="display">口诀和判断顺序</h1>
        <p className="lede">每个语法点一句口诀、几步判断。考前翻一遍，做题时照着问。</p>
        <div className="gram-sheet-tools">
          <input className="gram-sheet-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜语法点、关键词、连词、代词…" aria-label="搜索速查表" />
          <div className="segmented" role="group" aria-label="按等级筛选">
            <button className={level === "all" ? "is-on" : ""} onClick={() => setLevel("all")}>
              全部
            </button>
            {LEVELS.map((lv) => (
              <button key={lv} className={level === lv ? "is-on" : ""} onClick={() => setLevel(lv)}>
                {lv}
              </button>
            ))}
          </div>
          <label className="gram-sheet-toggle">
            <input type="checkbox" checked={showPairs} onChange={(e) => setShowPairs(e.target.checked)} />
            显示对比句
          </label>
          <button className="btn btn-ghost gram-print" onClick={() => window.print()}>
            <Printer size={16} /> 打印 / 存成 PDF
          </button>
        </div>
      </header>
      {levels.map((lv) => {
        const list = data.points.filter((p) => p.level === lv && (p.motto || p.decide?.length) && matches(p));
        if (!list.length) return null;
        return (
          <section key={lv} className="gram-sheet-level">
            <h2 className="eyebrow">{lv}</h2>
            {list.map((p) => (
              <article key={p.id} className="gram-sheet-item">
                <h3>
                  <a href={`#/grammar?p=${p.id}`}>{p.title}</a>
                </h3>
                {p.motto && <p className="gram-motto">{p.motto}</p>}
                {p.decide && p.decide.length > 0 && (
                  <ol className="gram-decide">
                    {p.decide.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ol>
                )}
                {showPairs && p.pairs && p.pairs.length > 0 && (
                  <ul className="gram-sheet-pairs">
                    {p.pairs.map((x) => (
                      <li key={x.a + x.b}>
                        <span lang="fr">{x.a}</span> / <span lang="fr">{x.b}</span> — <small>{x.d}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}

/* ---------- one point ---------- */

function PointView({ data, point, onStart }: { data: GrammarData; point: GrammarPoint; onStart: (s: Step[]) => void }) {
  const progress = useStore((s) => s.progress);
  const card = progress.gram?.[point.id];
  const st = status(card, Date.now());
  const errors = useMemo(() => essayErrors(progress).get(point.id) ?? [], [progress, point.id]);
  const missing = missingPrereqs(data, point, progress);
  const start = () => onStart(pickDrills(point, progress, ROUND, Date.now(), mineDrills(errors)).map((drill) => ({ point: point.id, drill })));
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [point.id]);
  const tags = tagsOf(point).filter((t) => point.drills.some((d) => d.g === t));
  const practised = tags.filter((t) => progress.gramTags?.[tagKey(point.id, t)]?.n);
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
        {point.motto && <p className="gram-motto">{point.motto}</p>}
      </header>
      <div className="gram-body">
        {missing.length > 0 && (
          <aside className="tip gram-prereq">
            <Lightbulb size={17} strokeWidth={1.8} />
            <div>
              先学会这些会更顺：
              {missing.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && "、"}
                  <a className="link" href={`#/grammar?p=${p.id}`}>
                    {p.title}
                  </a>
                </span>
              ))}
            </div>
          </aside>
        )}
        {point.decide && point.decide.length > 0 && (
          <section className="panel gram-rule gram-decide-panel">
            <h3>遇到这类句子，按这个顺序判断</h3>
            <ol className="gram-decide">
              {point.decide.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ol>
          </section>
        )}
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
        {point.pairs && point.pairs.length > 0 && (
          <section className="panel gram-rule gram-pairs">
            <h3>对比：只差一处，答案就变</h3>
            <ul>
              {point.pairs.map((p) => (
                <li key={p.a + p.b}>
                  <span lang="fr">{p.a}</span>
                  <span lang="fr">{p.b}</span>
                  <small>{p.d}</small>
                </li>
              ))}
            </ul>
          </section>
        )}
        {point.walk && (
          <section className="panel gram-rule gram-walk">
            <h3>一步步拆一句</h3>
            <p className="gram-walk-s">
              <span lang="fr">{point.walk.s}</span>
              <Speak url={null} text={point.walk.s} size="sm" />
            </p>
            <p className="muted">{point.walk.z}</p>
            <ol>
              {point.walk.steps.map(([q, a]) => (
                <li key={q}>
                  <b>{q}</b>
                  <span>{a}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
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
        {errors.length > 0 && (
          <section className="panel gram-rule gram-mine">
            <h3>你在作文里写错过</h3>
            <ul>
              {errors.slice(0, 8).map((e) => (
                <li key={e.wrong + e.right}>
                  <s lang="fr">{e.wrong}</s>
                  <span lang="fr">{e.right}</span>
                  {e.why && <small>{e.why}</small>}
                </li>
              ))}
            </ul>
            <p className="muted">练习时会夹进这些句子，让你自己改。</p>
          </section>
        )}
        {(point.related?.length ?? 0) + (point.prereq?.length ?? 0) > 0 && (
          <section className="gram-links">
            {point.prereq && point.prereq.length > 0 && (
              <p>
                <span className="muted">先学：</span>
                {point.prereq.map((id) => (
                  <a key={id} className="chip" href={`#/grammar?p=${id}`}>
                    {titleOf(data, id)}
                  </a>
                ))}
              </p>
            )}
            {point.related && point.related.length > 0 && (
              <p>
                <span className="muted">相关：</span>
                {point.related.map((id) => (
                  <a key={id} className="chip" href={`#/grammar?p=${id}`}>
                    {titleOf(data, id)}
                  </a>
                ))}
              </p>
            )}
          </section>
        )}
        <section className="panel gram-practice">
          <p className="muted">
            {point.drills.length} 道题 · {st.label}
            {card ? ` · 已复习 ${card.reps} 次` : ""}
          </p>
          {practised.length > 0 && (
            <ul className="gram-tags">
              {tags.map((t) => {
                const s = progress.gramTags?.[tagKey(point.id, t)];
                const rate = s?.n ? Math.round((1 - s.w / s.n) * 100) : null;
                return (
                  <li key={t}>
                    <span>{tagLabel(point, t)}</span>
                    {rate === null ? (
                      <small className="muted">还没练</small>
                    ) : (
                      <>
                        <span className="gram-tag-bar" aria-hidden>
                          <span style={{ width: `${rate}%` }} className={rate < 60 ? "is-weak" : rate < 85 ? "is-mid" : ""} />
                        </span>
                        <small>{rate}%</small>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <button className="btn btn-primary btn-xl" onClick={start} disabled={!point.drills.length}>
            练习 {Math.min(ROUND, point.drills.length + errors.length)} 题 <ArrowRight size={18} />
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
  value: string;
}
type Result = "right" | "accent" | "wrong";
interface Pending {
  result: Result;
  value: string;
}

function Session({ data, initial, onExit }: { data: GrammarData; initial: Step[]; onExit: () => void }) {
  const settings = useStore((s) => s.settings);
  const [i, setI] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const [log, setLog] = useState<Answered[]>([]);
  const [graded, setGraded] = useState<Graded[] | null>(null);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);
  const step = initial[i];

  const answer = useCallback(
    (result: Result, value: string) => {
      if (pending || !step) return;
      const ok = result !== "wrong";
      if (settings.sfx) void cue(ok ? "correct" : "wrong");
      setPending({ result, value });
      setLog((l) => [...l, { step, ok, value }]);
    },
    [pending, step, settings.sfx],
  );
  /** 算我对 / the AI found a rewrite right: the last answer counts as right. */
  const amend = useCallback(() => {
    setPending((p) => (p ? { ...p, result: "right" } : p));
    setLog((l) => l.map((x, k) => (k === l.length - 1 ? { ...x, ok: true } : x)));
  }, []);
  const next = useCallback(() => {
    setPending(null);
    // the round is graded once, when its last answer is left (an event, not a render: React may render twice)
    if (i + 1 >= initial.length && !graded) setGraded(gradeRound(log));
    setI((n) => n + 1);
  }, [i, initial.length, graded, log]);

  if (i >= initial.length) return <Summary data={data} log={log} graded={graded ?? []} onExit={onExit} />;
  const point = data.points.find((p) => p.id === step.point)!;
  const d = step.drill;
  const q = { point, pending, onAnswer: answer, onNext: next, onAmend: amend };
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
          {d.g && (d.g === ESSAY_TAG || !!pending) && <span className="gram-tag-chip">{d.g === ESSAY_TAG ? "作文错句" : tagLabel(point, d.g)}</span>}
        </p>
        {d.k === "c" ? (
          <ChoiceQuestion key={i} drill={d} {...q} />
        ) : d.k === "o" ? (
          <OrderQuestion key={i} drill={d} {...q} />
        ) : d.k === "t" ? (
          <TypeQuestion key={i} drill={d} {...q} />
        ) : d.k === "f" ? (
          <FixQuestion key={i} drill={d} {...q} />
        ) : (
          <TransformQuestion key={i} drill={d} {...q} />
        )}
      </section>
    </div>
  );
}

interface QuestionProps<D extends Drill> {
  point: GrammarPoint;
  drill: D;
  pending: Pending | null;
  onAnswer: (r: Result, v: string) => void;
  onNext: () => void;
  onAmend: () => void;
}

/** The sentence with one part in bold. */
function Marked({ s, b, with: w }: { s: string; b: [number, number]; with?: string }) {
  return (
    <>
      {s.slice(0, b[0])}
      <b>{w ?? s.slice(b[0], b[1])}</b>
      {s.slice(b[1])}
    </>
  );
}

function Feedback({ point, drill, pending, onNext, onAmend }: { point: GrammarPoint; drill: Drill; pending: Pending; onNext: () => void; onAmend: () => void }) {
  const [skipped, setSkipped] = useState(false);
  const ai = useAiConfig();
  const [checking, setChecking] = useState<"idle" | "busy" | { verdict: "correct" | "almost" | "wrong"; why: string; corrected: string } | "error">("idle");
  const [retryValue, setRetryValue] = useState("");
  const [retriedOk, setRetriedOk] = useState(false);
  const ok = pending.result !== "wrong";
  const mine = drill.g === ESSAY_TAG;
  const verdict = pending.result === "right" ? "答对了" : pending.result === "accent" ? "字母对了，注意音符" : "没关系，记住它";
  const chosenWhy = drill.k === "c" && !ok ? drill.e?.[pending.value] : undefined;
  const otherOpts = drill.k === "c" && drill.e ? Object.entries(drill.e).filter(([k]) => ok || k !== pending.value) : [];
  const askAi = async () => {
    if (drill.k !== "x") return;
    setChecking("busy");
    try {
      const req = { given: drill.q, task: drill.h, reference: drill.s, answer: pending.value, pointTitle: point.title };
      const r = await checkRewrite(req);
      setChecking(r);
      if (shouldAmendRewrite(r.verdict)) onAmend();
    } catch {
      setChecking("error");
    }
  };
  const checkRetry = (e: React.FormEvent) => {
    e.preventDefault();
    if (drill.k !== "x" || typeof checking !== "object") return;
    const targets = [checking.corrected, ...drill.a].filter(Boolean);
    if (checkTyped(retryValue, targets) === "right") setRetriedOk(true);
  };
  return (
    <div className={`conj-feedback ${ok ? "is-right" : "is-wrong"}`} role="status">
      <p className="feedback-verdict">{verdict}</p>
      {chosenWhy && (
        <p className="gram-chosen">
          你选的 <b lang="fr">{pending.value}</b>：{chosenWhy}
        </p>
      )}
      {drill.k === "f" && (
        <p className="gram-fix-verdict">{drill.r.length ? <>划线部分应改为 <b lang="fr">{drill.r.join(" / ")}</b></> : "原句没有错。"}</p>
      )}
      <p className="gram-full" lang="fr">
        {drill.k === "c" || drill.k === "t" ? (
          <Marked s={drill.s} b={drill.b} />
        ) : drill.k === "f" ? (
          drill.r.length ? <Marked s={drill.s} b={drill.b} with={drill.r[0]} /> : <Marked s={drill.s} b={drill.b} />
        ) : (
          fullOf(drill)
        )}
        <Speak url={null} text={fullOf(drill)} size="sm" />
      </p>
      {drill.k === "t" && drill.a.length > 1 && <p className="muted gram-also">也对：{drill.a.slice(1).join(" / ")}</p>}
      {drill.k === "x" && drill.a.length > 1 && <p className="muted gram-also">也可以：{drill.a.slice(1).join(" / ")}</p>}
      {drill.z && <p className="gram-zh">{drill.z}</p>}
      <p className="gram-why">{drill.y}</p>
      {otherOpts.length > 0 && (
        <details className="gram-others">
          <summary>为什么其他选项不对</summary>
          <ul>
            {otherOpts.map(([opt, why]) => (
              <li key={opt}>
                <b lang="fr">{opt}</b>：{why}
              </li>
            ))}
          </ul>
        </details>
      )}
      {mine && !ok && (
        <div className="gram-amend">
          <button className="link" onClick={onAmend}>
            我改得也对，算我对
          </button>
        </div>
      )}
      {drill.k === "x" && !ok && (
        <div className="gram-amend">
          {typeof checking === "object" ? (
            <div className="gram-ai-verdict">
              <p>
                AI：{checking.verdict === "correct" ? "你的句子也对。" : checking.verdict === "almost" ? "转换对了，有个小错（保留错误权重，请修正重输）。" : "还不对。"}
                {checking.why}
                {checking.corrected && checking.corrected !== pending.value && (
                  <>
                    {" "}
                    改正：<span lang="fr">{checking.corrected}</span>
                  </>
                )}
              </p>
              {checking.verdict === "almost" && (
                retriedOk ? (
                  <p className="muted small">已重输巩固 ✓（仍计入本次错题权重以便近期巩固）</p>
                ) : (
                  <form className="gram-almost-retry" onSubmit={checkRetry}>
                    <input
                      value={retryValue}
                      onChange={(e) => setRetryValue(e.target.value)}
                      placeholder="按改正后的句子重输一遍"
                      aria-label="重输改正后的句子"
                      lang="fr"
                    />
                    <button type="submit" className="btn btn-ghost btn-sm" disabled={!retryValue.trim()}>
                      检查重输
                    </button>
                  </form>
                )
              )}
            </div>
          ) : (
            <>
              {ready.text(ai) && (
                <button className="btn btn-ghost" onClick={askAi} disabled={checking === "busy"}>
                  <Sparkles size={15} /> {checking === "busy" ? "AI 在看…" : checking === "error" ? "AI 没连上，再试一次" : "我的写法可能也对：让 AI 看看"}
                </button>
              )}
              <button className="link" onClick={onAmend}>
                我确定我的也对，算我对
              </button>
            </>
          )}
        </div>
      )}
      <button className={`btn btn-xl ${ok ? "btn-sage" : "btn-terra"}`} onClick={onNext} autoFocus>
        继续 <ArrowRight size={20} />
      </button>
      {!mine && (
        <button
          className="link gram-skip"
          disabled={skipped}
          onClick={() => {
            skipDrill(point.id, drill);
            setSkipped(true);
          }}
        >
          {skipped ? "以后不会再出这题" : "这题有问题（答案不对、两个都对、句子不通），不再出现"}
        </button>
      )}
    </div>
  );
}

function ChoiceQuestion({ point, drill, pending, onAnswer, onNext, onAmend }: QuestionProps<ChoiceDrill>) {
  const right = answerOf(drill);
  const options = useMemo(() => shuffle([...drill.o], hashSeed(drill.s)), [drill]);
  const keys: Record<string, () => void> = {};
  if (pending) {
    keys.Enter = onNext;
    keys[" "] = onNext;
  } else options.forEach((o, k) => (keys[String(k + 1)] = () => onAnswer(o === right ? "right" : "wrong", o)));
  useKeys(keys);
  return (
    <>
      <p className="gram-sentence" lang="fr">
        {drill.s.slice(0, drill.b[0])}
        <span className={`gram-blank ${pending ? (pending.result !== "wrong" ? "is-right" : "is-wrong") : ""}`}>{pending ? right : " ".repeat(Math.max(6, right.length + 2))}</span>
        {drill.s.slice(drill.b[1])}
      </p>
      {drill.h && <p className="gram-hint">{drill.h}</p>}
      <ul className="options conj-options">
        {options.map((o, k) => {
          const isAnswer = o === right;
          const chosen = pending?.value === o;
          const cls = pending ? (isAnswer ? "is-answer" : chosen ? "is-chosen" : "is-dim") : "";
          return (
            <li key={o}>
              <button className={`option ${cls}`} onClick={() => onAnswer(isAnswer ? "right" : "wrong", o)} disabled={!!pending}>
                <kbd>{k + 1}</kbd>
                <span lang="fr">{o}</span>
                {pending && isAnswer && <Check size={20} className="option-mark" />}
                {pending && chosen && !isAnswer && <X size={20} className="option-mark" />}
              </button>
            </li>
          );
        })}
      </ul>
      {pending && <Feedback point={point} drill={drill} pending={pending} onNext={onNext} onAmend={onAmend} />}
    </>
  );
}

function OrderQuestion({ point, drill, pending, onAnswer, onNext, onAmend }: QuestionProps<OrderDrill>) {
  // words keep their position in the pool so that two equal words stay distinct
  const pool = useMemo(() => shuffled(drill.t, hashSeed(drill.s)).map((w, i) => ({ w, i })), [drill]);
  const [picked, setPicked] = useState<number[]>([]);
  const words = picked.map((k) => pool[k].w);
  const check = () => onAnswer(orderRight(drill, words) ? "right" : "wrong", words.join(" "));
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
      <div className={`gram-answer ${pending ? (pending.result !== "wrong" ? "is-right" : "is-wrong") : ""}`} lang="fr" aria-label="你的句子">
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
      {pending && <Feedback point={point} drill={drill} pending={pending} onNext={onNext} onAmend={onAmend} />}
    </>
  );
}

/** A text box with buttons for French letters; Enter submits. */
function FrenchInput({ value, onChange, onSubmit, disabled, label, wide, autoFocus = true }: { value: string; onChange: (v: string) => void; onSubmit: () => void; disabled: boolean; label: string; wide?: boolean; autoFocus?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);
  const insert = (ch: string) => {
    const el = input.current;
    if (!el) return onChange(value + ch);
    const [a, b] = [el.selectionStart ?? value.length, el.selectionEnd ?? value.length];
    onChange(value.slice(0, a) + ch + value.slice(b));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + ch.length, a + ch.length);
    });
  };
  return (
    <form
      className={`conj-type gram-type ${wide ? "is-wide" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled && value.trim()) onSubmit();
      }}
    >
      <input
        ref={input}
        className="conj-input"
        value={value}
        onChange={(e) => !disabled && onChange(e.target.value)}
        readOnly={disabled}
        lang="fr"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="done"
        aria-label={label}
      />
      {!disabled && (
        <>
          <div className="accent-keys" aria-label="法语字母">
            {ACCENTS.map((ch) => (
              <button key={ch} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(ch)} lang="fr">
                {ch}
              </button>
            ))}
          </div>
          <button type="submit" className="btn btn-primary" disabled={!value.trim()}>
            确认 <kbd>Enter</kbd>
          </button>
        </>
      )}
    </form>
  );
}

/** Enter and space go on once answered (the text box is read-only by then). */
function useNextKeys(pending: Pending | null, onNext: () => void) {
  const keys: Record<string, () => void> = {};
  if (pending) {
    keys.Enter = onNext;
    keys[" "] = onNext;
  }
  useKeys(keys);
}

function TypeQuestion({ point, drill, pending, onAnswer, onNext, onAmend }: QuestionProps<TypeDrill>) {
  const [value, setValue] = useState("");
  useNextKeys(pending, onNext);
  const right = answerOf(drill);
  return (
    <>
      <p className="gram-sentence" lang="fr">
        {drill.s.slice(0, drill.b[0])}
        <span className={`gram-blank ${pending ? (pending.result !== "wrong" ? "is-right" : "is-wrong") : ""}`}>{pending ? right : " ".repeat(Math.max(6, right.length + 2))}</span>
        {drill.s.slice(drill.b[1])}
      </p>
      <p className="gram-hint">{drill.h}</p>
      <FrenchInput value={pending ? pending.value : value} onChange={setValue} onSubmit={() => onAnswer(checkTyped(value, drill.a), value.trim())} disabled={!!pending} label="填空" />
      {pending && <Feedback point={point} drill={drill} pending={pending} onNext={onNext} onAmend={onAmend} />}
    </>
  );
}

function FixQuestion({ point, drill, pending, onAnswer, onNext, onAmend }: QuestionProps<FixDrill>) {
  const segment = drill.s.slice(drill.b[0], drill.b[1]);
  const [editing, setEditing] = useState(drill.g === ESSAY_TAG);
  const [value, setValue] = useState(segment);
  const sayRight = () => onAnswer(drill.r.length ? "wrong" : "right", "（没有错）");
  const submit = () => {
    const v = value.trim();
    // unchanged: the learner says it is right after all
    if (checkTyped(v, [segment]) === "right") return sayRight();
    onAnswer(drill.r.length ? checkTyped(v, drill.r) : "wrong", v);
  };
  const keys: Record<string, () => void> = {};
  if (pending) {
    keys.Enter = onNext;
    keys[" "] = onNext;
  } else if (!editing) {
    keys["1"] = sayRight;
    keys["2"] = () => setEditing(true);
  }
  useKeys(keys);
  return (
    <>
      <p className="gram-sentence gram-fix" lang="fr">
        {drill.s.slice(0, drill.b[0])}
        <u>{segment}</u>
        {drill.s.slice(drill.b[1])}
      </p>
      <p className="gram-hint">{drill.h || "划线部分对吗？有错就改正（也可能没有错）"}</p>
      {!pending && !editing && (
        <ul className="options conj-options gram-fix-options">
          <li>
            <button className="option" onClick={sayRight}>
              <kbd>1</kbd>
              <span>没有错</span>
            </button>
          </li>
          <li>
            <button className="option" onClick={() => setEditing(true)}>
              <kbd>2</kbd>
              <span>有错，我来改</span>
            </button>
          </li>
        </ul>
      )}
      {(editing || (pending && pending.value !== "（没有错）")) && (
        <FrenchInput value={pending ? pending.value : value} onChange={setValue} onSubmit={submit} disabled={!!pending} label="改正划线部分" />
      )}
      {pending && pending.value === "（没有错）" && <p className="gram-hint">你的回答：没有错</p>}
      {pending && <Feedback point={point} drill={drill} pending={pending} onNext={onNext} onAmend={onAmend} />}
    </>
  );
}

function TransformQuestion({ point, drill, pending, onAnswer, onNext, onAmend }: QuestionProps<TransformDrill>) {
  const [value, setValue] = useState("");
  useNextKeys(pending, onNext);
  return (
    <>
      <p className="gram-hint gram-task">{drill.h}</p>
      <p className="gram-sentence gram-given" lang="fr">
        {drill.q}
        <Speak url={null} text={drill.q} size="sm" />
      </p>
      <FrenchInput value={pending ? pending.value : value} onChange={setValue} onSubmit={() => onAnswer(checkTyped(value, drill.a), value.trim())} disabled={!!pending} label="写出改好的句子" wide />
      {pending && <Feedback point={point} drill={drill} pending={pending} onNext={onNext} onAmend={onAmend} />}
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
  const by = new Map<string, { g?: string; ok: boolean }[]>();
  for (const { step, ok } of log) by.set(step.point, [...(by.get(step.point) ?? []), { g: step.drill.g, ok }]);
  return [...by].map(([id, answers]) => ({ id, total: answers.length, wrong: answers.filter((a) => !a.ok).length, grade: gradePoint(id, answers) }));
}

function Summary({ data, log, graded, onExit }: { data: GrammarData; log: Answered[]; graded: Graded[]; onExit: () => void }) {
  useEffect(() => {
    if (store.get().settings.sfx) void cue("complete");
  }, []);
  const right = log.filter((l) => l.ok).length;
  const wrong = log.filter((l) => !l.ok);
  // what the wrong answers were about
  const weak = new Map<string, { point: GrammarPoint; tag: string; n: number }>();
  for (const { step } of wrong) {
    const point = data.points.find((p) => p.id === step.point)!;
    const tag = step.drill.g ?? "";
    const k = `${point.id}|${tag}`;
    weak.set(k, { point, tag, n: (weak.get(k)?.n ?? 0) + 1 });
  }
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
        {weak.size > 0 && (
          <div className="gram-weak">
            <p className="muted">错在这些地方（之后会多出这类题）：</p>
            <ul>
              {[...weak.values()]
                .sort((a, b) => b.n - a.n)
                .map(({ point, tag, n }) => (
                  <li key={point.id + tag}>
                    <span>{tag === ESSAY_TAG ? "你作文里的错句" : tagLabel(point, tag) || point.title}</span>
                    {graded.length > 1 && <small className="muted"> · {point.title}</small>}
                    <b>×{n}</b>
                  </li>
                ))}
            </ul>
          </div>
        )}
        {wrong.length > 0 && (
          <ul className="gram-wrong">
            {wrong.map(({ step }, k) => {
              const d = step.drill;
              return (
                <li key={k} lang="fr">
                  {d.k === "c" || d.k === "t" ? <Marked s={d.s} b={d.b} /> : d.k === "f" ? (d.r.length ? <Marked s={d.s} b={d.b} with={d.r[0]} /> : fixedOf(d)) : d.s}
                </li>
              );
            })}
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

/* ---------- 语篇级综合训练 ---------- */

function DiscourseSession({
  exercise,
  onExit,
  onOpenExercise,
}: {
  exercise: DiscourseExercise;
  onExit: () => void;
  onOpenExercise: (ex: DiscourseExercise) => void;
}) {
  const settings = useStore((s) => s.settings);
  const [mode, setMode] = useState<"choice" | "type">("choice");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const parts = useMemo(() => exercise.text.split(/(\{\{\d+\}\})/g), [exercise.text]);
  const filledCount = exercise.slots.filter((s) => (answers[s.id] ?? "").trim().length > 0).length;

  const evalSlot = (id: string) => {
    const slot = exercise.slots.find((s) => s.id === id)!;
    const val = (answers[id] ?? "").trim();
    return checkTyped(val, [...slot.answer]);
  };

  const correctCount = submitted ? exercise.slots.filter((s) => evalSlot(s.id) === "right").length : 0;
  const fullPassage = useMemo(
    () =>
      parts
        .map((part) => {
          const m = part.match(/^\{\{(\d+)\}\}$/);
          if (!m) return part;
          return exercise.slots[Number(m[1])].answer[0];
        })
        .join(""),
    [parts, exercise.slots],
  );

  const submit = () => {
    setSubmitted(true);
    const allOk = exercise.slots.every((s) => evalSlot(s.id) === "right");
    if (settings.sfx) void cue(allOk ? "correct" : "wrong");
  };

  const reset = () => {
    setAnswers({});
    setSubmitted(false);
  };

  const nextExercise = DISCOURSE_EXERCISES[(DISCOURSE_EXERCISES.findIndex((e) => e.id === exercise.id) + 1) % DISCOURSE_EXERCISES.length];

  return (
    <div className="page practice gram-discourse">
      <header className="page-head">
        <button className="link deck-back" onClick={onExit}>
          <ArrowLeft size={16} /> 返回语法总览
        </button>
        <p className="eyebrow">
          {exercise.level} · {exercise.kind === "fix" ? "语篇跨句改错" : "语篇跨句填空"}
        </p>
        <h1 className="display">{exercise.title}</h1>
        <p className="lede">{exercise.subtitle}</p>
      </header>

      <section className="panel gram-discourse-panel">
        <div className="gram-discourse-toolbar">
          <div className="segmented">
            <button type="button" className={mode === "choice" ? "is-on" : ""} onClick={() => !submitted && setMode("choice")} disabled={submitted}>
              选择模式
            </button>
            <button type="button" className={mode === "type" ? "is-on" : ""} onClick={() => !submitted && setMode("type")} disabled={submitted}>
              自主拼写模式
            </button>
          </div>
          {submitted && (
            <span className="gram-discourse-score">
              正确 <b>{correctCount}</b> / {exercise.slots.length}
              <Speak url={null} text={fullPassage} size="sm" />
            </span>
          )}
        </div>

        <p className="gram-discourse-passage" lang="fr">
          {parts.map((part, idx) => {
            const m = part.match(/^\{\{(\d+)\}\}$/);
            if (!m) return <span key={idx}>{part}</span>;
            const slotIndex = Number(m[1]);
            const slot = exercise.slots[slotIndex];
            const val = answers[slot.id] ?? "";
            const status = submitted ? evalSlot(slot.id) : null;
            return (
              <span key={slot.id} className={`disc-slot ${status ? `is-${status}` : ""}`}>
                <span className="disc-num">[{slotIndex + 1}]</span>
                {exercise.kind === "fix" && slot.shown && (
                  <u className="disc-wrong-shown" title={slot.hint}>
                    {slot.shown}
                  </u>
                )}
                {mode === "type" && !submitted ? (
                  <input
                    className="disc-input"
                    value={val}
                    onChange={(e) => setAnswers((p) => ({ ...p, [slot.id]: e.target.value }))}
                    placeholder={slot.hint}
                    aria-label={`第 ${slotIndex + 1} 处（${slot.hint}）`}
                    lang="fr"
                  />
                ) : (
                  <b className="disc-fill">
                    {submitted ? (
                      status === "right" ? (
                        val || slot.answer[0]
                      ) : (
                        <>
                          {val && <del>{val}</del>} <ins>{slot.answer[0]}</ins>
                        </>
                      )
                    ) : (
                      val || `（${slot.hint}）`
                    )}
                  </b>
                )}
              </span>
            );
          })}
        </p>

        {!submitted && mode === "choice" && (
          <ol className="disc-choices">
            {exercise.slots.map((slot, si) => (
              <li key={slot.id}>
                <span className="disc-choice-label">
                  <b>[{si + 1}]</b> {exercise.kind === "fix" && slot.shown ? <span lang="fr">改写 “{slot.shown}”</span> : <span lang="fr">{slot.hint}</span>}
                </span>
                <div className="disc-choice-opts">
                  {slot.options.map((opt) => {
                    const on = answers[slot.id] === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        lang="fr"
                        className={`chip-btn ${on ? "is-on" : ""}`}
                        aria-pressed={on}
                        onClick={() => setAnswers((p) => ({ ...p, [slot.id]: opt }))}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ol>
        )}

        {!submitted ? (
          <button type="button" className="btn btn-primary btn-xl" disabled={filledCount < exercise.slots.length} onClick={submit}>
            提交整篇检查（{filledCount}/{exercise.slots.length}） <Check size={18} />
          </button>
        ) : (
          <>
            <ol className="disc-explanations">
              {exercise.slots.map((slot, si) => {
                const res = evalSlot(slot.id);
                return (
                  <li key={slot.id} className={res === "right" ? "is-ok" : "is-bad"}>
                    <p>
                      <b>[{si + 1}]</b>{" "}
                      {res === "right" ? "答对了" : res === "accent" ? "注意重音" : "应为"}：
                      <b lang="fr"> {slot.answer[0]}</b>
                      {res !== "right" && answers[slot.id] ? `（你填：${answers[slot.id]}）` : ""}
                    </p>
                    <p className="muted small">{slot.why}</p>
                    <a className="link small" href={`#/grammar?p=${slot.point}`}>
                      去练对应语法点 <ArrowRight size={13} />
                    </a>
                  </li>
                );
              })}
            </ol>
            <div className="summary-actions">
              <button type="button" className="btn btn-ghost" onClick={reset}>
                <RotateCcw size={16} /> 重做本篇
              </button>
              <button type="button" className="btn btn-primary" onClick={() => onOpenExercise(nextExercise)}>
                下一篇：{nextExercise.title} <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
