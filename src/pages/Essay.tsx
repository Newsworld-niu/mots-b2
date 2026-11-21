import { ArrowLeft, ArrowRight, BookMarked, PenLine, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ready, useAiConfig } from "../ai/config";
import { gradeEssay, makeEssayTask, makeModelEssay } from "../ai/tasks";
import { useGrammar } from "../atlas/grammar";
import {
  CONNECTORS,
  countWords,
  CRITERIA,
  CRITERION_CHECK,
  CRITERION_LABEL,
  ESSAY_TASKS,
  FORMAL_GENRES,
  GENRE_LABEL,
  GENRES,
  isAiTask,
  LETTER_FORMULAS,
  MAX_ESSAY_LENGTH,
  maxScore,
  totalScore,
  type EssayFeedback,
  type EssayTask,
  type Genre,
  type SavedEssay,
} from "../lib/essay";
import { clock, topicOf } from "../lib/exam";
import { ERROR_LABEL } from "../lib/writing";
import { href } from "../lib/router";
import { useTimer } from "../lib/timer";
import { deleteAiTask, deleteEssay, deleteNote, patchEssay, saveAiTask, saveEssay } from "../store/essays";
import { shuffle } from "../lib/text";
import { useStore } from "../store/store";
import { AccentKeys } from "../ui/AccentKeys";
import { Marking } from "../ui/Marking";
import { toast } from "../ui/Toast";

const DRAFT = (task: string) => `fb2.essay.draft.${task}`;
const readDraft = (task: string) => {
  try {
    return localStorage.getItem(DRAFT(task)) ?? "";
  } catch {
    return "";
  }
};
const writeDraft = (task: string, text: string) => {
  try {
    if (text.trim()) localStorage.setItem(DRAFT(task), text);
    else localStorage.removeItem(DRAFT(task));
  } catch {
    /* a draft that cannot be kept is not worth an error */
  }
};

const day = (ms: number) => new Date(ms).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });

type View = { at: "list" } | { at: "write"; task: EssayTask } | { at: "result"; task: EssayTask; id: string } | { at: "revise"; task: EssayTask; id: string };

/** Below this the next try is worth it (out of 25). */
const LOW = 15;

interface TaskStat {
  done: number;
  best: number;
  last: number;
  draft: boolean;
}

/** What the learner has done with a task: times written, best score (-1 if never marked), last time, a draft waiting. */
function statOf(essays: SavedEssay[], task: EssayTask): TaskStat {
  const mine = essays.filter((e) => e.task === task.id);
  return {
    done: mine.length,
    best: mine.reduce((m, e) => (e.fb ? Math.max(m, totalScore(e.fb)) : m), -1),
    last: mine.reduce((m, e) => Math.max(m, e.created), 0),
    draft: !!readDraft(task.id),
  };
}

/** Order for the list and for the recommendation: a draft first, then never written, then the lowest best score, then the longest ago. */
const rankOf = (s: TaskStat) => (s.draft ? 0 : s.done === 0 ? 1 : s.best < 0 ? 2 : 3);
function byNeed(a: [EssayTask, TaskStat], b: [EssayTask, TaskStat]) {
  const [ta, sa] = a;
  const [tb, sb] = b;
  if (rankOf(sa) !== rankOf(sb)) return rankOf(sa) - rankOf(sb);
  if (rankOf(sa) === 3 && sa.best !== sb.best) return sa.best - sb.best;
  if (sa.last !== sb.last) return sa.last - sb.last;
  return ta.level === tb.level ? 0 : ta.level === "B1" ? -1 : 1;
}

const reasonOf = (s: TaskStat) =>
  s.draft ? "有一份没写完的草稿，接着写" : s.done === 0 ? "还没写过" : s.best < 0 ? "写过但还没批改过" : s.best < LOW ? `上次最高只有 ${s.best}/25，再写一次` : `最高 ${s.best}/25，隔了一阵，再练一次`;

const countClass = (n: number, min: number) => (n < Math.round(min * 0.9) ? "is-short warn-text" : n < min ? "is-short" : "is-ok");
const countLabel = (n: number, min: number, max: number) => `${n} 词 · 至少 ${min} 词（推荐 ${min}–${max}，${Math.round(min * 0.9)} 警戒 / ${Math.floor(min / 2)} 零分）`;

/**
 * 篇章写作: pick a task, write the whole text with a plan and linking words at hand, and have it marked on a fixed
 * four-part grid. Without an AI service the text is saved and checked against the grid by the learner.
 * Practice only: memory state is not touched.
 */
export function EssayStudio({ onExit }: { onExit: () => void }) {
  const essaysRaw = useStore((s) => s.progress.essays);
  const essays = useMemo(() => essaysRaw ?? [], [essaysRaw]);
  const aiRaw = useStore((s) => s.progress.essayTasks);
  const notes = useStore((s) => s.progress.essayNotes) ?? [];
  const tasks = useMemo(() => [...ESSAY_TASKS, ...(aiRaw ?? [])], [aiRaw]);
  const taskOf = (id: string) => tasks.find((t) => t.id === id);
  const ai = useAiConfig();
  const { data: grammar } = useGrammar();
  const [view, setView] = useState<View>({ at: "list" });
  const [text, setText] = useState("");
  const [grading, setGrading] = useState(false);
  // 让 AI 出新题
  const [aiGenre, setAiGenre] = useState<Genre | "random">("random");
  const [aiLevel, setAiLevel] = useState<"B1" | "B2">("B2");
  const [aiDoc, setAiDoc] = useState(false);
  const [making, setMaking] = useState(false);
  // 选题页的筛选
  const [need, setNeed] = useState<"all" | "new" | "low" | "draft">("all");
  const [genreFilter, setGenreFilter] = useState<Genre | "all">("all");
  // 范文
  const [modeling, setModeling] = useState(false);
  // 模考模式（开启后自动 60 分钟倒计时，到时自动锁卷）
  const [examMode, setExamMode] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const ctrl = useRef<AbortController | null>(null);
  const timer = useTimer();

  useEffect(() => () => ctrl.current?.abort(), []);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view.at]);

  const pointTitle = useMemo(() => new Map((grammar?.points ?? []).map((p) => [p.id, p.title])), [grammar]);

  const open = (task: EssayTask, initial = readDraft(task.id)) => {
    setText(initial);
    if (examMode) timer.start(60 * 60);
    else timer.stop();
    setView({ at: "write", task });
  };

  const change = (task: EssayTask, v: string) => {
    const next = v.slice(0, MAX_ESSAY_LENGTH);
    setText(next);
    writeDraft(task.id, next);
  };

  const finish = (task: EssayTask, fb?: EssayFeedback) => {
    timer.stop();
    const id = saveEssay({ task: task.id, text, fb });
    writeDraft(task.id, "");
    setView({ at: "result", task, id });
  };

  const submit = async (task: EssayTask) => {
    if (!text.trim() || grading) return;
    if (!ready.text(ai)) return finish(task);
    const c = new AbortController();
    ctrl.current = c;
    setGrading(true);
    try {
      const fb = await gradeEssay({ task, text, points: (grammar?.points ?? []).map((p) => ({ id: p.id, title: p.title })) }, c.signal);
      if (!c.signal.aborted) finish(task, fb);
    } catch (err) {
      if (!c.signal.aborted) toast((err as Error).message || "批改失败", "warn");
    } finally {
      setGrading(false);
    }
  };

  const makeTask = async () => {
    if (making || !ready.text(ai)) return;
    const genre = aiGenre === "random" ? shuffle([...GENRES], Date.now())[0] : aiGenre;
    const c = new AbortController();
    ctrl.current = c;
    setMaking(true);
    try {
      const task = await makeEssayTask({ genre, level: aiLevel, withDocument: aiDoc, avoid: tasks.filter((t) => t.genre === genre).map((t) => t.title) }, c.signal);
      if (c.signal.aborted) return;
      saveAiTask(task);
      open(task, "");
    } catch (err) {
      if (!c.signal.aborted) toast((err as Error).message || "出题失败", "warn");
    } finally {
      setMaking(false);
    }
  };

  /** 第二稿: marked like the first, so the two can be compared. */
  const submitRevision = async (task: EssayTask, essay: SavedEssay) => {
    const revised = text.trim();
    if (!revised || grading) return;
    if (!ready.text(ai)) {
      patchEssay(essay.id, { rev: { text: revised, at: Date.now() } });
      writeDraft(`rev-${essay.id}`, "");
      return setView({ at: "result", task, id: essay.id });
    }
    const c = new AbortController();
    ctrl.current = c;
    setGrading(true);
    try {
      const fb = await gradeEssay({ task, text: revised, points: (grammar?.points ?? []).map((p) => ({ id: p.id, title: p.title })) }, c.signal);
      if (c.signal.aborted) return;
      patchEssay(essay.id, { rev: { text: revised, at: Date.now(), fb } });
      writeDraft(`rev-${essay.id}`, "");
      setView({ at: "result", task, id: essay.id });
    } catch (err) {
      if (!c.signal.aborted) toast((err as Error).message || "批改失败", "warn");
    } finally {
      setGrading(false);
    }
  };

  const showModel = async (task: EssayTask, essay: SavedEssay) => {
    if (modeling || !ready.text(ai)) return;
    const c = new AbortController();
    ctrl.current = c;
    setModeling(true);
    try {
      const model = await makeModelEssay({ task, learnerText: essay.rev?.text ?? essay.text }, c.signal);
      if (!c.signal.aborted) patchEssay(essay.id, { model });
    } catch (err) {
      if (!c.signal.aborted) toast((err as Error).message || "写范文失败", "warn");
    } finally {
      setModeling(false);
    }
  };

  if (view.at === "list") {
    const stats = new Map(tasks.map((t) => [t.id, statOf(essays, t)] as const));
    const all = tasks.map((t) => [t, stats.get(t.id)!] as [EssayTask, TaskStat]);
    const shown = all
      .filter(([t, st]) => (genreFilter === "all" || t.genre === genreFilter) && (need === "all" || (need === "new" && st.done === 0) || (need === "low" && st.best >= 0 && st.best < LOW) || (need === "draft" && st.draft)))
      .sort(byNeed);
    // the recommendation: the task most in need, preferring B2 once three B1 tasks have been written
    const b1done = all.filter(([t, st]) => t.level === "B1" && st.done > 0).length;
    const rec = [...all].sort((x, y) => (rankOf(x[1]) === rankOf(y[1]) && b1done >= 3 && x[0].level !== y[0].level ? (x[0].level === "B2" ? -1 : 1) : byNeed(x, y)))[0];
    const card = ([t, st]: [EssayTask, TaskStat], extra?: string) => (
      <div key={t.id} className="essay-cell">
        <button className={`essay-task ${extra ? "is-rec" : ""}`} onClick={() => open(t)}>
          <span className="essay-chips">
            <span className="chip">{GENRE_LABEL[t.genre]}</span>
            {isAiTask(t.id) && <span className="chip chip-mine">AI 新题</span>}
            {t.doc && <span className="chip">材料题</span>}
          </span>
          <b>{t.title}</b>
          <small>{t.situation}</small>
          <small className="essay-task-meta">
            {t.level} · {t.level === "B2" ? `至少 ${t.words[0]} 词（推荐 ${t.words[0]}–${t.words[1]}）` : `${t.words[0]}–${t.words[1]} 词`}
            {st.draft ? " · 有草稿" : ""}
            {st.done > 0 ? ` · 写过 ${st.done} 次${st.best >= 0 ? `，最高 ${st.best}/25` : ""}，上次 ${day(st.last)}` : ""}
          </small>
          {extra && <small className="essay-rec-why">{extra}</small>}
        </button>
        {isAiTask(t.id) && (
          <button className="own-rm essay-cell-rm" aria-label="删除这道题" title="删除这道 AI 出的题（写过的文章会保留）" onClick={() => deleteAiTask(t.id)}>
            <X size={13} />
          </button>
        )}
      </div>
    );
    return (
      <div className="page practice">
        <header className="page-head">
          <button className="link deck-back" onClick={onExit}>
            <ArrowLeft size={16} /> 返回练习
          </button>
          <p className="eyebrow">篇章写作 · Production écrite</p>
          <h1 className="display">把句子，连成一篇。</h1>
          <p className="lede">选一个题目，照着提纲写完整的一封信或一篇短文。批改用官方评分表的五项（完成任务、连贯和衔接、语体得体、词汇、语法），每项 0／1／3／5 分，满分 25，并指出每处错误对应的语法点。</p>
          {!ready.text(ai) && (
            <p className="muted">
              还没有设置 AI 接口：可以写、可以保存，对照评分表自己检查。到 <a className="link" href={href({ page: "me" })}>我的 → AI 接口</a> 设置后由 AI 批改，也可以让 AI 出新题。
            </p>
          )}
        </header>

        {rec && (
          <section className="essay-level">
            <h3 className="eyebrow">推荐下一题</h3>
            <div className="essay-tasks essay-tasks-one">{card(rec, reasonOf(rec[1]))}</div>
          </section>
        )}

        <section className="panel essay-ai">
          <h3 className="eyebrow">让 AI 出一道新题</h3>
          <ul className="chips" role="group" aria-label="体裁">
            {(["random", ...GENRES] as const).map((g) => (
              <li key={g}>
                <button className={`chip-btn ${aiGenre === g ? "is-on" : ""}`} aria-pressed={aiGenre === g} onClick={() => setAiGenre(g)}>
                  {g === "random" ? "随机体裁" : GENRE_LABEL[g]}
                </button>
              </li>
            ))}
          </ul>
          <div className="essay-ai-row">
            <div className="segmented">
              {(["B1", "B2"] as const).map((lv) => (
                <button key={lv} className={aiLevel === lv ? "is-on" : ""} aria-pressed={aiLevel === lv} onClick={() => setAiLevel(lv)}>
                  {lv}
                </button>
              ))}
            </div>
            <label className="essay-check-doc">
              <input type="checkbox" checked={aiDoc} onChange={(ev) => setAiDoc(ev.target.checked)} /> 带一段要回应的材料
            </label>
            <button className="btn btn-primary" onClick={() => void makeTask()} disabled={making || !ready.text(ai)}>
              <Sparkles size={16} /> {making ? "AI 出题中（约 10–30 秒）…" : "出题并开始写"}
            </button>
            {making && (
              <button className="btn btn-ghost" onClick={() => ctrl.current?.abort()}>
                取消
              </button>
            )}
          </div>
          <p className="muted small">每次一道新题，含提纲和可用句子，保存在这台设备上（最多 24 道）。不会和已有的题重复。</p>
        </section>

        <div className="essay-filters">
          <ul className="chips" role="group" aria-label="筛选">
            {(
              [
                ["all", "全部"],
                ["new", "没写过"],
                ["low", `分数低（<${LOW}）`],
                ["draft", "有草稿"],
              ] as const
            ).map(([k, label]) => (
              <li key={k}>
                <button className={`chip-btn ${need === k ? "is-on" : ""}`} aria-pressed={need === k} onClick={() => setNeed(k)}>
                  {label}
                </button>
              </li>
            ))}
          </ul>
          <ul className="chips" role="group" aria-label="体裁筛选">
            {(["all", ...GENRES] as const).map((g) => (
              <li key={g}>
                <button className={`chip-btn ${genreFilter === g ? "is-on" : ""}`} aria-pressed={genreFilter === g} onClick={() => setGenreFilter(g)}>
                  {g === "all" ? "所有体裁" : GENRE_LABEL[g]}
                </button>
              </li>
            ))}
          </ul>
          <label className="essay-check-doc">
            <input type="checkbox" checked={examMode} onChange={(ev) => setExamMode(ev.target.checked)} /> 模考模式（进入写作自动 60 分钟倒计时，到时锁卷）
          </label>
        </div>
        {(["B1", "B2"] as const).map((lv) => {
          const list = shown.filter(([t]) => t.level === lv);
          if (!list.length) return null;
          return (
            <section key={lv} className="essay-level">
              <h3 className="eyebrow">{lv}</h3>
              <div className="essay-tasks">{list.map((x) => card(x))}</div>
            </section>
          );
        })}
        {shown.length === 0 && <p className="muted">没有符合筛选的题目。</p>}

        {notes.length > 0 && (
          <section className="essay-level">
            <details className="essay-fold">
              <summary>
                <BookMarked size={15} /> 错句本（{notes.length}）
              </summary>
              <ul className="writing-errors essay-corrections essay-notes">
                {notes.map((n) => (
                  <li key={n.id}>
                    <span className="chip">{ERROR_LABEL[n.type]}</span>
                    <span lang="fr">
                      {n.wrong && <del>{n.wrong}</del>} {n.right && <ins>{n.right}</ins>}
                    </span>
                    {n.why && <small>{n.why}</small>}
                    <small className="muted">
                      {day(n.at)} · {n.from}
                    </small>
                    {n.point && pointTitle.has(n.point) && (
                      <a className="link essay-point" href={`#/grammar?p=${n.point}`}>
                        练这个语法点：{pointTitle.get(n.point)} <ArrowRight size={13} />
                      </a>
                    )}
                    <button className="own-rm essay-note-rm" aria-label="从错句本删除" onClick={() => deleteNote(n.id)}>
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          </section>
        )}

        {essays.length > 0 && (
          <section className="essay-level">
            <h3 className="eyebrow">写过的</h3>
            <ul className="essay-history">
              {essays.map((e) => {
                const t = taskOf(e.task);
                if (!t) return null;
                return (
                  <li key={e.id}>
                    <button className="link" onClick={() => setView({ at: "result", task: t, id: e.id })}>
                      {day(e.created)} · {t.title}
                    </button>
                    <span className="muted">
                      {countWords(e.text)} 词 · {e.fb ? `${totalScore(e.fb)}/25` : "未批改"}
                      {e.rev?.fb ? ` → 二稿 ${totalScore(e.rev.fb)}/25` : e.rev ? " · 有二稿" : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    );
  }

  const task = view.task;

  if (view.at === "result" || view.at === "revise") {
    const essay = essays.find((e) => e.id === view.id);
    if (!essay) {
      return (
        <div className="page practice">
          <p className="muted">这篇已经删除。</p>
          <button className="btn btn-ghost" onClick={() => setView({ at: "list" })}>
            返回题目
          </button>
        </div>
      );
    }
    const fb = essay.fb;

    if (view.at === "revise") {
      const rw = countWords(text);
      const [rmin, rmax] = task.words;
      return (
        <div className="page practice">
          <section className="essay-stage">
            <button className="link deck-back" onClick={() => setView({ at: "result", task, id: essay.id })} disabled={grading}>
              <ArrowLeft size={16} /> 返回批改（第二稿会保留）
            </button>
            <p className="eyebrow">
              改一稿 · {GENRE_LABEL[task.genre]} · {task.level}
            </p>
            <h2 className="essay-title">{task.title}</h2>
            <p className="muted">对照下面的批改，自己改一遍再交。改的过程比看答案记得牢；交上去后 AI 会重新打分，并告诉你哪些错改掉了。</p>
            {fb && fb.todo.length > 0 && (
              <div className="essay-box">
                <p className="eyebrow">先改这些</p>
                <ol>
                  {fb.todo.map((x, k) => (
                    <li key={k}>{x}</li>
                  ))}
                </ol>
              </div>
            )}
            {fb && fb.corrections.length > 0 && (
              <div className="essay-box">
                <p className="eyebrow">第一稿的错误（{fb.corrections.length}）</p>
                <ul className="writing-errors essay-corrections">
                  {fb.corrections.map((x, k) => (
                    <li key={k}>
                      <span className="chip">{ERROR_LABEL[x.type]}</span>
                      <span lang="fr">
                        {x.wrong && <del>{x.wrong}</del>} {x.right && <ins>{x.right}</ins>}
                      </span>
                      {x.why && <small>{x.why}</small>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <textarea
              ref={input}
              className="writing-input essay-input"
              lang="fr"
              rows={14}
              value={text}
              readOnly={grading}
              onChange={(ev) => {
                const v = ev.target.value.slice(0, MAX_ESSAY_LENGTH);
                setText(v);
                writeDraft(`rev-${essay.id}`, v);
              }}
              autoCapitalize="sentences"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              aria-label="第二稿"
            />
            {!grading && (
              <AccentKeys
                input={input}
                value={text}
                onChange={(v) => {
                  setText(v.slice(0, MAX_ESSAY_LENGTH));
                  writeDraft(`rev-${essay.id}`, v.slice(0, MAX_ESSAY_LENGTH));
                }}
              />
            )}
            <div className="writing-actions">
              <span className={`essay-count ${countClass(rw, rmin)}`}>{countLabel(rw, rmin, rmax)}</span>
              {grading ? (
                <>
                  <p className="muted">AI 批改中（整篇约 20–60 秒）…</p>
                  <button className="btn btn-ghost" onClick={() => ctrl.current?.abort()}>
                    取消
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-ghost" onClick={() => setText(essay.text)}>
                    <RefreshCw size={15} /> 恢复第一稿
                  </button>
                  <button className="btn btn-primary btn-xl" onClick={() => void submitRevision(task, essay)} disabled={!text.trim() || text.trim() === essay.text.trim()}>
                    {ready.text(ai) ? "交第二稿" : "保存第二稿"} <ArrowRight size={18} />
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      );
    }

    // how the first draft's corrections fared in the second draft: a wrong wording that is gone counts as fixed
    const rev = essay.rev;
    const gone = (w: string) => !!w && !rev!.text.toLowerCase().includes(w.toLowerCase());
    const fixed = rev && fb ? fb.corrections.filter((c) => c.wrong && gone(c.wrong)) : [];
    const still = rev && fb ? fb.corrections.filter((c) => c.wrong && !gone(c.wrong)) : [];
    const gain = rev?.fb && fb ? totalScore(rev.fb) - totalScore(fb) : null;
    return (
      <div className="page practice">
        <section className="essay-stage">
          <button className="link deck-back" onClick={() => setView({ at: "list" })}>
            <ArrowLeft size={16} /> 返回题目
          </button>
          <p className="eyebrow">
            {GENRE_LABEL[task.genre]} · {task.level} · {day(essay.created)}
          </p>
          <h2 className="essay-title">{task.title}</h2>

          {fb ? (
            <Marking fb={fb} pointTitle={pointTitle} from={task.title} />
          ) : (
            <div className="essay-box">
              <p className="eyebrow">对照官方评分表的五项自己检查</p>
              <ul className="essay-check">
                {CRITERIA.map((c) => (
                  <li key={c}>
                    <b>{CRITERION_LABEL[c]}</b> {CRITERION_CHECK[c]}
                  </li>
                ))}
              </ul>
              <p className="muted small">这篇没有经过 AI 批改。设置 AI 接口后，点「用这个题目重写」可以重新提交。</p>
            </div>
          )}

          <div className="essay-cols">
            <div className="essay-box">
              <p className="eyebrow">你写的（{countWords(essay.text)} 词）</p>
              <p className="essay-text" lang="fr">
                {essay.text}
              </p>
            </div>
            {fb?.rewrite && (
              <div className="essay-box">
                <p className="eyebrow">改好的版本</p>
                <p className="essay-text" lang="fr">
                  {fb.rewrite}
                </p>
              </div>
            )}
          </div>

          {rev && (
            <div className="essay-box essay-rev">
              <p className="eyebrow">第二稿 · {day(rev.at)}</p>
              {gain !== null && rev.fb && fb && (
                <p className="essay-gain">
                  {totalScore(fb)} <ArrowRight size={16} /> {totalScore(rev.fb)}
                  <small>/{maxScore(fb)}</small> <span className={gain > 0 ? "is-up" : gain < 0 ? "is-down" : ""}>{gain > 0 ? `+${gain}` : gain === 0 ? "持平" : gain}</span>
                </p>
              )}
              {fb && fb.corrections.length > 0 && (
                <p className="muted">
                  第一稿指出的 {fb.corrections.length} 处错误：改掉了 <b>{fixed.length}</b> 处{still.length > 0 ? `，还在 ${still.length} 处` : ""}。
                </p>
              )}
              {still.length > 0 && (
                <ul className="writing-errors essay-corrections">
                  {still.map((x, k) => (
                    <li key={k}>
                      <span className="chip">{ERROR_LABEL[x.type]}</span>
                      <span lang="fr">
                        <del>{x.wrong}</del> <ins>{x.right}</ins>
                      </span>
                      {x.why && <small>{x.why}</small>}
                    </li>
                  ))}
                </ul>
              )}
              <p className="essay-text" lang="fr">
                {rev.text}
              </p>
              {rev.fb && (
                <details className="essay-fold">
                  <summary>第二稿的批改</summary>
                  <Marking fb={rev.fb} pointTitle={pointTitle} from={task.title} />
                </details>
              )}
            </div>
          )}

          {essay.model && (
            <div className="essay-box essay-model">
              <p className="eyebrow">范文（AI 写的，只作参考）</p>
              <p className="essay-text" lang="fr">
                {essay.model.text}
              </p>
              {essay.model.patterns.length > 0 && (
                <>
                  <p className="eyebrow">值得借用的句型</p>
                  <ul className="essay-phrases">
                    {essay.model.patterns.map((p, k) => (
                      <li key={k}>
                        <span lang="fr">{p.fr}</span>
                        <small>{p.zh}</small>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {fb && <p className="muted small">AI 的批改和分数可能有偏差，拿不准的地方对照语法点和词典。</p>}
          <div className="writing-actions">
            <button
              className="btn btn-ghost"
              onClick={() => {
                deleteEssay(essay.id);
                setView({ at: "list" });
              }}
            >
              <Trash2 size={16} /> 删除
            </button>
            <button className="btn btn-ghost" onClick={() => open(task, essay.text)}>
              <PenLine size={16} /> 用这个题目重写
            </button>
            {fb && !essay.model && (
              <button className="btn btn-ghost" onClick={() => void showModel(task, essay)} disabled={modeling || !ready.text(ai)} title={rev ? "" : "先改一稿再看范文，效果更好"}>
                <Sparkles size={16} /> {modeling ? "写范文中…" : "看范文"}
              </button>
            )}
            {fb && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setText(readDraft(`rev-${essay.id}`) || rev?.text || essay.text);
                  timer.stop();
                  setView({ at: "revise", task, id: essay.id });
                }}
              >
                <PenLine size={16} /> {rev ? "再改一稿" : "照批改改一稿"}
              </button>
            )}
          </div>
          {fb && !rev && !essay.model && <p className="muted small">建议先改一稿再看范文：自己改过，再对照范文，才看得出差在哪里。</p>}
        </section>
      </div>
    );
  }

  const words = countWords(text);
  const [min, max] = task.words;
  const locked = examMode && timer.down && timer.sec === 0;
  const toggleExamMode = (on: boolean) => {
    setExamMode(on);
    if (on) {
      if (!timer.running) timer.start(60 * 60);
    } else {
      timer.stop();
    }
  };
  return (
    <div className="page practice">
      <section className="essay-stage">
        <button className="link deck-back" onClick={() => setView({ at: "list" })} disabled={grading}>
          <ArrowLeft size={16} /> 返回题目（草稿会保留）
        </button>
        <p className="eyebrow">
          {GENRE_LABEL[task.genre]} · {task.level} · 至少 {min} 词（推荐 {min}–{max}）
        </p>
        <h2 className="essay-title">{task.title}</h2>
        <p className="essay-situation">{task.situation}</p>
        {task.doc && (
          <blockquote className="essay-doc" lang="fr">
            {task.doc}
          </blockquote>
        )}
        <p className="essay-consigne" lang="fr">
          {task.consigne}
        </p>
        <ul className="essay-points">
          {task.points.map((p, k) => (
            <li key={k}>{p}</li>
          ))}
        </ul>

        <div className="essay-help">
          <details open>
            <summary>提纲</summary>
            <ol className="essay-plan">
              {task.plan.map((p, k) => (
                <li key={k}>
                  <b>{p.zh}</b>
                  <span lang="fr">{p.fr}</span>
                </li>
              ))}
            </ol>
          </details>
          <details>
            <summary>这个题目用得上的句子</summary>
            <ul className="essay-phrases">
              {task.phrases.map(([fr, zh], k) => (
                <li key={k}>
                  <span lang="fr">{fr}</span>
                  <small>{zh}</small>
                </li>
              ))}
            </ul>
          </details>
          {topicOf(task.topic) && (
            <details>
              <summary>话题词汇：{topicOf(task.topic)!.zh}</summary>
              <ul className="essay-phrases">
                {topicOf(task.topic)!.vocab.map(([fr, zh], k) => (
                  <li key={k}>
                    <span lang="fr">{fr}</span>
                    <small>{zh}</small>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <details>
            <summary>衔接语</summary>
            <dl className="essay-links">
              {CONNECTORS.map((g) => (
                <div key={g.zh}>
                  <dt>{g.zh}</dt>
                  <dd lang="fr">{g.fr.join(" · ")}</dd>
                </div>
              ))}
            </dl>
          </details>
          {FORMAL_GENRES.includes(task.genre) && (
            <details>
              <summary>正式信件的套语</summary>
              <dl className="essay-links">
                {LETTER_FORMULAS.map((g) => (
                  <div key={g.zh}>
                    <dt>{g.zh}</dt>
                    <dd lang="fr">{g.fr.join(" / ")}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
        </div>

        <div className="writing-actions">
          <label className="essay-check-doc">
            <input type="checkbox" checked={examMode} disabled={grading || locked} onChange={(ev) => toggleExamMode(ev.target.checked)} /> 模考模式（60 分钟自动锁卷）
          </label>
        </div>
        <textarea
          ref={input}
          className="writing-input essay-input"
          lang="fr"
          rows={14}
          value={text}
          readOnly={grading || locked}
          onChange={(ev) => change(task, ev.target.value)}
          placeholder="在这里写。分段写，每段一个意思。"
          autoCapitalize="sentences"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          aria-label="在这里写法语作文"
        />
        {!grading && !locked && <AccentKeys input={input} value={text} onChange={(v) => change(task, v)} />}
        {locked && <p className="warn-text">模考 60 分钟时间到，已自动锁卷（不可继续修改），请直接提交。</p>}
        <div className="writing-actions">
          <span className={`essay-count ${countClass(words, min)}`}>{countLabel(words, min, max)}</span>
          {!grading &&
            (examMode ? (
              <span className={`exam-clock ${timer.sec === 0 ? "is-over" : ""}`} title="模考自动倒计时，时间到自动锁卷">
                {timer.sec === 0 ? "时间到 · 已锁卷" : `模考 ${clock(timer.sec)}`}
              </span>
            ) : timer.running || (timer.down && timer.sec === 0) ? (
              <button className={`exam-clock ${timer.sec === 0 ? "is-over" : ""}`} onClick={timer.stop} title="点一下停止计时">
                {timer.sec === 0 ? "时间到" : clock(timer.sec)}
              </button>
            ) : (
              <button className="btn btn-ghost" onClick={() => timer.start(60 * 60)}>
                限时 60 分钟
              </button>
            ))}
          {grading ? (
            <>
              <p className="muted">AI 批改中（整篇约 20–60 秒）…</p>
              <button className="btn btn-ghost" onClick={() => ctrl.current?.abort()}>
                取消
              </button>
            </>
          ) : (
            <button className="btn btn-primary btn-xl" onClick={() => void submit(task)} disabled={!text.trim()}>
              {ready.text(ai) ? "交给 AI 批改" : "保存并自己检查"} <ArrowRight size={18} />
            </button>
          )}
        </div>
        <p className="muted typing-help">草稿自动保存在这台设备上 · 只是练习，不改动记忆进度</p>
      </section>
    </div>
  );
}
