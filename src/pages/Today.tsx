import { POS_OPTIONS } from "../lib/pos";
import { ArrowRight, BookMarked, BookOpen, Calendar, Check, Compass, Download, Flame, GraduationCap, Headphones, Keyboard, Layers, MessageSquareQuote, Mic, SlidersHorizontal, Sparkles, Sprout, Target } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { prefetch, useAtlas, useEntry } from "../atlas/context";
import { useGrammarMeta } from "../atlas/grammar";
import { cloudSyncHealthy, downloadBackupFile, isBackupSnoozedToday, snoozeBackupToday } from "../lib/backup";
import { DRILL_QUESTIONS_COUNT } from "../lib/drill-schema";
import { EXPRESSIONS_COUNT } from "../lib/expr-schema";
import { useFamilies } from "../lib/families";
import { go, href, openWord } from "../lib/router";
import { cue } from "../lib/sound";
import { buildPrepSchedule, reconcileDailyTasks, type PrepKind } from "../lib/study-plan";
import { hashSeed } from "../lib/text";
import { dueGrammarCountFromMeta, untouchedGrammarErrorCount, useMistakeDue } from "../store/grammar-due";
import { buildSession, isTaughtReady, masteredCount, todayPlan } from "../store/session";
import { isMastered } from "../store/srs";
import { CORE_NAME, studyRange } from "../store/decks";
import { latestLoungeResume } from "../lib/lounge-resume";
import { dayKey, MAX_DAILY_NEW, needsBackupReminder, store, useStore, useStoreShallow } from "../store/store";
import { unifiedStreakOf, unifiedWeek } from "../lib/activity";
import { useSyncState } from "../sync/state";
import { Highlight, Pronounce } from "../ui/WordText";
import { Illustration, plateArticle } from "../ui/Illustration";
import { Ring } from "../ui/Ring";
import { Sheet } from "../ui/Sheet";
import { toast } from "../ui/Toast";

const LazyGalaxy = lazy(() => import("../galaxy/Galaxy").then((m) => ({ default: m.Galaxy })));
const LazyHomeDictionary = lazy(() => import("../ui/HomeDictionary").then((m) => ({ default: m.HomeDictionary })));
const LazyFamilyPicker = lazy(() => import("../ui/FamilyPicker").then((m) => ({ default: m.FamilyPicker })));
const LazyPlacementTest = lazy(() => import("../ui/PlacementTest").then((m) => ({ default: m.PlacementTest })));
const LazyCockpitInsights = lazy(() => import("../ui/CockpitInsights").then((m) => ({ default: m.CockpitInsights })));

const BRAND = `${import.meta.env.BASE_URL}brand`;
/** Topics without their own tile art borrow a related one. */
const TOPIC_ART: Record<string, string> = { people: "society" };

/** Enter or Space activates a card-like control (role="button"). */
const activateOn = (fn: () => void) => (e: ReactKeyboardEvent) => {
  if (e.target !== e.currentTarget) return;
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
};

type Goal = "everyday" | "exam";

/** 日常进阶 / 备考冲刺: one click switches what the home page puts first. */
function ModeSwitch({ goal }: { goal: Goal }) {
  const set = (next: Goal) => {
    if (next === goal) return;
    store.settings({ goal: next });
    toast(next === "exam" ? "已切换到「备考冲刺」：首页按考期安排听说读写" : "已切换到「日常进阶」：首页只保留今日学习清单", "ok");
  };
  return (
    <div className="segmented today-mode" role="group" aria-label="学习模式">
      <button type="button" aria-pressed={goal === "everyday"} className={goal === "everyday" ? "is-on" : ""} onClick={() => set("everyday")}>
        <Sprout size={14} /> 日常进阶
      </button>
      <button type="button" aria-pressed={goal === "exam"} className={goal === "exam" ? "is-on" : ""} onClick={() => set("exam")}>
        <GraduationCap size={14} /> 备考冲刺
      </button>
    </div>
  );
}

/** French greeting: "bonjour" until evening, then "bonsoir". */
const greetingFr = (h: number) => (h < 5 || h >= 18 ? "Bonsoir" : "Bonjour");

function greeting(h: number) {
  if (h < 5) return "夜深了";
  if (h < 11) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

export function streakOf(days: Record<string, { r: number }>) {
  let n = 0;
  const d = new Date();
  if (!(days[dayKey(d)]?.r > 0)) d.setDate(d.getDate() - 1);
  while (days[dayKey(d)]?.r > 0) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function Today() {
  const atlas = useAtlas();
  const progress = useStoreShallow((s) => ({
    cards: s.progress.cards,
    days: s.progress.days,
    session: s.progress.session,
    decks: s.progress.decks,
    hidden: s.progress.hidden,
    coreMigrated: s.progress.coreMigrated,
    custom: s.progress.custom,
    edits: s.progress.edits,
    suspendedLeeches: s.progress.suspendedLeeches,
    gram: s.progress.gram,
    gramDays: s.progress.gramDays,
    gramTags: s.progress.gramTags,
    conjDays: s.progress.conjDays,
    expr: s.progress.expr,
    essays: s.progress.essays,
    essayTasks: s.progress.essayTasks,
    essayNotes: s.progress.essayNotes,
    speakCorrections: s.progress.speakCorrections,
    compMisses: s.progress.compMisses,
    noteCards: s.progress.noteCards,
    examLog: s.progress.examLog,
    drillDays: s.progress.drillDays,
    placement: s.progress.placement,
    speakingSessions: s.progress.speakingSessions,
    listenSources: s.progress.listenSources,
    texts: s.progress.texts,
    bookProgress: s.progress.bookProgress,
    mediaProgress: s.progress.mediaProgress,
    loungeDays: s.progress.loungeDays,
    mistakes: s.progress.mistakes,
  }));
  const settings = useStore((s) => s.settings);
  const baseFamilies = useFamilies(Boolean(settings.studyFamilies?.length));
  // todayPlan reads the word families from their module cache; baseFamilies changes once they have loaded.
  const plan = useMemo(() => {
    void baseFamilies;
    return todayPlan(atlas, progress, settings);
  }, [atlas, progress, settings, baseFamilies]);
  // Warm the first cards of today's journey so the session opens instantly.
  const firstIds = [...plan.due.slice(0, 4), ...plan.fresh.slice(0, 6)].join(",");
  useEffect(() => {
    const ids = firstIds.split(",").filter(Boolean);
    const t = window.setTimeout(() => void prefetch(atlas, ids), 800);
    return () => window.clearTimeout(t);
  }, [atlas, firstIds]);
  const now = new Date();
  const today = progress.days[dayKey()];
  const streak = unifiedStreakOf(progress, now);
  const active = progress.session && !progress.session.finished ? progress.session : null;
  const total = plan.due.length + plan.fresh.length;
  const doneToday = today?.r ?? 0;
  const remaining = plan.fresh.length + Math.min(plan.due.length, 60);
  const goal = doneToday + remaining;

  const goalMode: Goal = settings.goal === "exam" ? "exam" : "everyday";
  const examMode = goalMode === "exam";
  const [more, setMore] = useState("");
  const [emptyRange, setEmptyRange] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(() => !Object.keys(progress.cards).length && !settings.examDate);
  const [icebreakerDismissed, setIcebreakerDismissed] = useState(() => {
    try {
      return localStorage.getItem("fb2.icebreaker.dismissed") === "1";
    } catch {
      return false;
    }
  });
  const sync = useSyncState();
  const [backupDismissed, setBackupDismissed] = useState(isBackupSnoozedToday);
  const backupDue = useStoreShallow((s) => needsBackupReminder(s.progress, s.settings.lastBackupAt));
  const moreN = Math.min(MAX_DAILY_NEW, Math.max(0, Math.round(Number(more) || 0)));
  const start = (opts?: { reviewOnly?: boolean; extra?: number }) => {
    if (!active) {
      const full = store.get().progress;
      const s = buildSession(atlas, full, opts?.extra ? { ...settings, dailyNew: (today?.n ?? 0) + opts.extra } : settings, { reviewOnly: opts?.reviewOnly });
      if (!s.steps.length) {
        // Nothing to learn or review in the current range: say so instead of doing nothing.
        setEmptyRange(true);
        toast("当前筛选范围内暂无待学/待复习词卡，可放宽范围或浏览词库", "warn");
        return;
      }
      setEmptyRange(false);
      store.progress((p) => ({ ...p, session: s }));
    }
    if (settings.sfx) void cue("start");
    go({ page: "learn" });
  };

  const { data: grammar } = useGrammarMeta();
  const grammarDueCount = useMemo(() => dueGrammarCountFromMeta(grammar?.points, progress), [grammar, progress]);
  const grammarUntouchedErrors = useMemo(() => untouchedGrammarErrorCount(grammar?.points, progress), [grammar, progress]);
  const prep = useMemo(
    () =>
      buildPrepSchedule({
        progress,
        settings,
        vocabMinutes: plan.minutes,
        dueCount: plan.due.length,
        freshCount: plan.fresh.length,
        grammarDueCount,
        grammarUntouchedErrors,
      }),
    [progress, settings, plan.minutes, plan.due.length, plan.fresh.length, grammarDueCount, grammarUntouchedErrors],
  );

  const launchPrepTask = (kind: PrepKind) => {
    if (kind === "listen") return go({ page: "listen" });
    if (kind === "read") return go({ page: "examread" });
    if (kind === "essay") return go({ page: "essay" });
    if (kind === "speak") return go({ page: "speak" });
    if (kind === "grammar") return go({ page: "grammar" });
    if (active || total > 0) start();
    else go({ page: "practice" });
  };

  const week = unifiedWeek(progress, now);

  const dailyStatus = useMemo(() => reconcileDailyTasks(prep.tasks, progress, new Date()), [prep.tasks, progress]);
  const narrowed = Boolean(settings.studyPos?.length || settings.studyFamilies?.length || settings.focusTopic || settings.studyDecks);
  const resetRange = () => {
    store.settings({ studyPos: null, studyFamilies: null, focusTopic: null, studyDecks: null });
    setEmptyRange(false);
    toast("已恢复为全部卡组、全部词性与学习路线", "ok");
  };
  const dk = dayKey(now);
  const microDone = dailyStatus.listen.done || dailyStatus.read.done || dailyStatus.speak.done || (progress.loungeDays?.[dk] ?? 0) > 0;

  const learned = Object.keys(progress.cards).length;
  const beginnerIce = !examMode || settings.startLevel < 2;
  const mastered = masteredCount(progress);
  const mistakeDue = useMistakeDue(progress);
  const loungeResume = useMemo(() => latestLoungeResume(progress), [progress]);
  const teaser = (active ? active.newIds : plan.fresh).slice(0, 5).map((id) => atlas.byId.get(id)!).filter(Boolean);

  return (
    <div className="page today">
      <header className="greet">
        <div>
          <p className="eyebrow">
            {greeting(now.getHours())} · {now.getMonth() + 1}月{now.getDate()}日 · 星期{"日一二三四五六"[now.getDay()]}
          </p>
          <h1 className="display">
            <span lang="fr">{greetingFr(now.getHours())}</span>，探索者。
          </h1>
          <ModeSwitch goal={goalMode} />
        </div>
        <dl className="greet-stats">
          <div className={streak ? "is-hot" : ""}>
            <dt><Flame size={14} /> 连续</dt>
            <dd>{streak}<small>天</small></dd>
          </div>
          <div>
            <dt>今日答题</dt>
            <dd>{doneToday}</dd>
          </div>
          <div>
            <dt>已点亮</dt>
            <dd>{learned.toLocaleString()}</dd>
          </div>
        </dl>
      </header>
      <section className="today-dict-section" aria-label="快速查词">
        <Suspense fallback={null}>
          <LazyHomeDictionary />
        </Suspense>
      </section>

      {backupDue.remind && !cloudSyncHealthy(sync) && !backupDismissed && (
        <aside className="backup-remind" role="status">
          <span>
            已超过 {backupDue.daysSince} 天未导出备份（Safari 等浏览器可能清理本地数据），建议保存一份 JSON 备份。
          </span>
          <div className="backup-remind-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void downloadBackupFile()}>
              <Download size={14} /> 立即导出
            </button>
            <button
              type="button"
              className="link small"
              onClick={() => {
                snoozeBackupToday();
                setBackupDismissed(true);
              }}
            >
              今天先不提醒
            </button>
          </div>
        </aside>
      )}

      <section className={`journey ${total === 0 && !active ? "is-clear" : ""}`}>
        <img className="journey-art" src={`${BRAND}/hero.webp`} alt="" fetchPriority="high" />
        <div className="journey-body">
          {active ? (
            <>
              <p className="eyebrow eyebrow-light">旅程进行中</p>
              <h2>
                还剩 <b>{active.steps.length - active.index}</b> 步
              </h2>
              <p className="journey-lede">进度已保存，随时接着走。</p>
            </>
          ) : total > 0 ? (
            <>
              <p className="eyebrow eyebrow-light">今日旅程</p>
              <h2>
                {plan.due.length > 0 && (
                  <>
                    复习 <b>{plan.due.length}</b>
                  </>
                )}
                {plan.due.length > 0 && plan.fresh.length > 0 && <i> · </i>}
                {plan.fresh.length > 0 && (
                  <>
                    新词 <b>{plan.fresh.length}</b>
                  </>
                )}
              </h2>
              <p className="journey-lede">约 {plan.minutes} 分钟。先温故，再知新。</p>
              <FocusNote />
              <RangeNote otherDue={plan.otherDue} />
              {plan.overflowDue > 0 && (
                <p className="muted small">已按每日复习上限展示，另有 {plan.overflowDue} 个到期词自动延至明日</p>
              )}
            </>
          ) : (
            <>
              <p className="eyebrow eyebrow-light">今日已完成</p>
              <h2>今天的星，都亮了。</h2>
              <p className="journey-lede">记忆需要一点留白。想多走一段，也可以。</p>
              <RangeNote otherDue={plan.otherDue} />
            </>
          )}
          {emptyRange && !active && total === 0 && (
            <div className="journey-empty" role="status">
              <span>当前筛选范围内暂无待学/待复习词卡。</span>
              <div className="journey-empty-actions">
                {narrowed && (
                  <button type="button" className="btn btn-glass btn-sm" onClick={resetRange}>
                    放宽到全部范围
                  </button>
                )}
                <button type="button" className="btn btn-glass btn-sm" onClick={() => go({ page: "atlas" })}>
                  浏览词库 <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
          <details className="journey-filters">
            <summary>
              <SlidersHorizontal size={15} /> 学习范围设置
              <small>{settings.studyPos?.length ? `词性 ${settings.studyPos.length} 项` : "全部词性"} · {settings.studyFamilies?.length ? `词族 ${settings.studyFamilies.length} 个` : "全部词族"}</small>
            </summary>
            <div className="study-pos-row">
              <span id="study-pos-label">按词性学习：</span>
              <div className="study-pos-options" role="group" aria-labelledby="study-pos-label">
                <button className={!settings.studyPos?.length ? "is-on" : ""} aria-pressed={!settings.studyPos?.length} onClick={() => store.settings({ studyPos: null })}>全部</button>
                {POS_OPTIONS.map(([key, label]) => {
                  const selected = settings.studyPos?.includes(key) ?? false;
                  return <button key={key} className={selected ? "is-on" : ""} aria-pressed={selected} onClick={() => {
                    const next = selected ? settings.studyPos!.filter((p) => p !== key) : [...(settings.studyPos ?? []), key];
                    store.settings({ studyPos: next.length && next.length < POS_OPTIONS.length ? next : null });
                  }}>{label}</button>;
                })}
              </div>
              <small>{active ? "下次旅程生效，当前旅程继续原来的词" : "可多选 · 新词和复习包含任一所选词性"}</small>
            </div>
            <div className="study-family-row"><span>按词族学习：</span><Suspense fallback={null}><LazyFamilyPicker study value={settings.studyFamilies} onChange={(ids, scope) => store.settings({ studyFamilies: ids.length ? ids : null, ...(scope && scope !== "study" ? { studyDecks: scope === "all" ? null : [scope] } : {}) })} /></Suspense></div>
          </details>
          {teaser.length > 0 && (
            <div className="teaser" aria-label="今天将遇见的新词">
              {teaser.map((w, i) => (
                <Illustration key={w.id} src={atlas.img(w, "thumb")} word={w.word} topic={w.topic} className={`teaser-${i}`} art={plateArticle(w)} />
              ))}
              <span>今天会遇见它们</span>
            </div>
          )}
          <div className="journey-actions">
            {active || total > 0 ? (
              <button className="btn btn-primary btn-xl" onClick={() => start()}>
                {active ? "继续旅程" : "开始今天的旅程"} <ArrowRight size={20} />
              </button>
            ) : (
              <button className="btn btn-primary btn-xl" onClick={() => start({ extra: 5 })}>
                再认识 5 个新词 <Sparkles size={18} />
              </button>
            )}
            {!active && plan.due.length > 0 && plan.fresh.length > 0 && (
              <button className="btn btn-glass" onClick={() => start({ reviewOnly: true })}>
                只复习
              </button>
            )}
            {!active && (
              <form
                className="journey-more"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (moreN > 0) start({ extra: moreN });
                }}
              >
                <label>
                  今天{(today?.n ?? 0) > 0 ? "再" : ""}学
                  <input type="text" inputMode="numeric" pattern="[0-9]*" value={more} placeholder={String(settings.dailyNew)} onChange={(e) => setMore(e.target.value.replace(/\D/g, "").slice(0, 4))} aria-label="今天要学的新词数" />
                  个新词
                </label>
                <button className="btn btn-glass" disabled={moreN === 0}>
                  就学这么多
                </button>
                {moreN >= 50 && <small>约 {Math.round(moreN * 0.9)} 分钟；可以中途停下，进度会保存。</small>}
              </form>
            )}
            {!active && total === 0 && (
              <button className="btn btn-glass" onClick={() => go({ page: "practice" })}>
                <Keyboard size={18} /> 打字练习
              </button>
            )}
          </div>
        </div>
      </section>

      {!icebreakerDismissed && learned < 5 && !(progress.examLog?.length) && (
        <section className="panel today-icebreaker" aria-label={beginnerIce ? "3 分钟快速上手" : "3 分钟快速体验 DELF B2"}>
          <div className="panel-head">
            <div>
              <p className="eyebrow">{beginnerIce ? "新手 3 分钟上手 · 从零开始" : "新手 3 分钟破冰 · DELF B2"}</p>
              <h2>无需配置 Key，先完成这 3 步体验闭环</h2>
            </div>
            <button
              type="button"
              className="link small"
              onClick={() => {
                setIcebreakerDismissed(true);
                try {
                  localStorage.setItem("fb2.icebreaker.dismissed", "1");
                } catch {
                  /* optional */
                }
              }}
            >
              收起引导
            </button>
          </div>
          <div className="today-icebreaker-steps">
            {beginnerIce ? (
              <>
                <button type="button" className="icebreaker-step" onClick={() => start({ extra: 5 })}>
                  <span className="chip">第 1 步 · 1 分钟</span>
                  <b>完成第一组核心词卡</b>
                  <small>看图、听音、认义，点亮最常用的 5 个词</small>
                </button>
                <button type="button" className="icebreaker-step" onClick={() => go({ page: "conj" })}>
                  <span className="chip">第 2 步 · 1 分钟</span>
                  <b>查一个常见动词变位</b>
                  <small>être、avoir、aller……现在时一张表看清</small>
                </button>
                <button type="button" className="icebreaker-step" onClick={() => go({ page: "lounge" })}>
                  <span className="chip">第 3 步 · 1 分钟</span>
                  <b>逛逛双语漫游馆微读</b>
                  <small>短故事与短片，不计分，点词即查</small>
                </button>
              </>
            ) : (
              <>
                <button type="button" className="icebreaker-step" onClick={() => start({ extra: 5 })}>
                  <span className="chip">第 1 步 · 1 分钟</span>
                  <b>5 词快速热身</b>
                  <small>按 FSRS 记忆卡点亮前 5 颗核心词汇</small>
                </button>
                <button type="button" className="icebreaker-step" onClick={() => go({ page: "read" })}>
                  <span className="chip">第 2 步 · 1 分钟</span>
                  <b>精读一篇免 AI B2 报刊</b>
                  <small>即点即查词典与句级跟读，直接对接真题题材</small>
                </button>
                <button type="button" className="icebreaker-step" onClick={() => go({ page: "essay" })}>
                  <span className="chip">第 3 步 · 1 分钟</span>
                  <b>看一遍高分作文批改样张</b>
                  <small>免 Key 预览官方五项评分表与润色对照</small>
                </button>
              </>
            )}
          </div>
        </section>
      )}

      <div className="today-primary-grid">
        {!examMode ? (
          <section className="panel prep-card today-checklist" aria-label="今日学习清单">
            <div className="prep-head">
              <div className="prep-meta">
                <p className="eyebrow">今日学习清单 · 词汇记忆 · 语法精讲 · 听说微读</p>
                <h2 className="today-checklist-title">每天三小步，稳稳往前走</h2>
              </div>
              <div className="prep-head-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPlaceOpen(true)}>
                  <Compass size={15} /> {progress.placement ? `重测定级（${atlas.cefr[progress.placement.level] ?? "B1"}）` : "测测我的水平"}
                </button>
              </div>
            </div>
            <ol className="prep-tasks">
              <li className={`prep-task is-vocab${dailyStatus.vocab.done ? " is-done" : ""}`}>
                <span className="today-checklist-icon" aria-hidden="true">{dailyStatus.vocab.done ? <Check size={16} /> : <Sparkles size={16} />}</span>
                <div className="prep-task-body">
                  <div className="prep-task-top">
                    <b>词汇记忆</b>
                    <span className="prep-task-time">约 {plan.minutes} 分钟</span>
                  </div>
                  <small className="muted">
                    {dailyStatus.vocab.done
                      ? dailyStatus.vocab.detail
                      : total > 0
                        ? `复习 ${plan.due.length} · 新词 ${plan.fresh.length}，先温故再知新`
                        : "今天的词卡都完成了，可以再认识几个新词"}
                  </small>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => (active || total > 0 ? start() : start({ extra: 5 }))}>
                  {active ? "继续" : total > 0 ? "去背词" : "再学 5 个"} <ArrowRight size={14} />
                </button>
              </li>
              <li className={`prep-task is-grammar${dailyStatus.grammar.done ? " is-done" : ""}`}>
                <span className="today-checklist-icon" aria-hidden="true">{dailyStatus.grammar.done ? <Check size={16} /> : <Layers size={16} />}</span>
                <div className="prep-task-body">
                  <div className="prep-task-top">
                    <b>语法精讲</b>
                    <span className="prep-task-time">约 8 分钟</span>
                  </div>
                  <small className="muted">
                    {dailyStatus.grammar.done
                      ? dailyStatus.grammar.detail
                      : grammarDueCount > 0
                        ? `${grammarDueCount} 个语法点到期，练一轮巩固`
                        : "读一个语法点的讲解，再做 8 道小练习"}
                  </small>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => go({ page: "grammar" })}>
                  {grammarDueCount > 0 ? "去复习" : "去学语法"} <ArrowRight size={14} />
                </button>
              </li>
              <li className={`prep-task is-listen${microDone ? " is-done" : ""}`}>
                <span className="today-checklist-icon" aria-hidden="true">{microDone ? <Check size={16} /> : <BookOpen size={16} />}</span>
                <div className="prep-task-body">
                  <div className="prep-task-top">
                    <b>听说微读</b>
                    <span className="prep-task-time">约 5 分钟</span>
                  </div>
                  <small className="muted">{microDone ? "今天已经听过、读过或开过口了" : "漫游馆读一小段双语故事，或说一分钟口语"}</small>
                </div>
                <div className="today-checklist-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => go({ page: "lounge" })}>
                    去微读 <ArrowRight size={14} />
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => go({ page: "drill" })}>
                    <Mic size={14} /> 说一分钟
                  </button>
                </div>
              </li>
            </ol>
          </section>
        ) : (
          <section className="panel prep-card" aria-label="今日备考调度">
            <div className="prep-head">
              <div className="prep-meta">
                <p className="eyebrow">
                  今日备考调度 · {settings.examTrack === "tcf" ? "TCF 全科" : settings.examTrack === "tef" ? "TEF 新政" : "DELF B2"}
                </p>
                <div className="prep-pills">
                  <button type="button" className="prep-pill" onClick={() => go({ page: "me" })}>
                    <Calendar size={14} />
                    {prep.daysLeft === null
                      ? "未设考期 · 点此设定"
                      : prep.daysLeft > 0
                        ? `距考还有 ${prep.daysLeft} 天`
                        : prep.daysLeft === 0
                          ? "考试就在今天"
                          : "已过设定考期"}
                  </button>
                  <span className="prep-pill">
                    <Target size={14} />{" "}
                    {settings.examTrack === "tcf"
                      ? "CEFR B2：听读 400+ · 写说 10+"
                      : settings.examTrack === "tef"
                        ? "CEFR B2：各科 400+"
                        : `目标 ${prep.targetScore}/100（均 ${prep.targetPerPart}/25）`}
                  </span>
                  {settings.examTrack === "tcf" && (
                    <span className="prep-pill" title="加拿大移民 NCLC 7 与 CEFR B2 是两套标准，分数线不同">
                      移民 NCLC 7：听 458+ · 读 453+ · 写说 10+
                    </span>
                  )}
                  {settings.examTrack === "tef" && (
                    <span className="prep-pill" title="加拿大移民 NCLC 7 与 CEFR B2 是两套标准，分数线不同">
                      移民 NCLC 7：听读 434+ · 写说 456+
                    </span>
                  )}
                  <button type="button" className="prep-pill" onClick={() => go({ page: "me" })}>
                    每日预算 {prep.totalMinutes} 分钟
                  </button>
                  {prep.phase === "urgent" && (
                    <span className="prep-pill is-urgent">考前 30 天内 · 冲刺模式</span>
                  )}
                </div>
              </div>
              <div className="prep-head-actions">
                <a className="btn btn-ghost btn-sm" href="#/practice">
                  <Target size={15} /> 四科实测总览
                </a>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPlaceOpen(true)}>
                  <Compass size={15} /> {progress.placement ? `重测定级（${atlas.cefr[progress.placement.level] ?? "B1"}）` : "摸底定级"}
                </button>
              </div>
            </div>

            {prep.vocabOverCap && (
              <div className="prep-warn" role="status">
                <span>
                  {prep.phase === "urgent" ? `考前 ${prep.daysLeft} 天冲刺` : "距考不足 6 个月"}：当前背词预计 {prep.vocabRawMinutes} 分钟（占今日 {prep.vocabSharePct}%），建议控制在 ≤{prep.vocabCapPct}%（≤{prep.vocabCapMinutes} 分钟）。
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    store.settings({ dailyNew: prep.suggestedDailyNew });
                    toast(`已将每日新词调为 ${prep.suggestedDailyNew} 个（背词控制在 ${prep.vocabCapPct}% 以内）`, "ok");
                  }}
                >
                  调为每日 {prep.suggestedDailyNew} 新词
                </button>
              </div>
            )}

            <ol className="prep-tasks">
              {prep.tasks.map((t) => {
                const st = dailyStatus[t.kind];
                return (
                  <li key={t.kind} className={`prep-task is-${t.kind}${st?.done ? " is-done" : ""}`}>
                    <div className="prep-task-body">
                      <div className="prep-task-top">
                        <b>
                          {st?.done ? "✓ " : ""}
                          {t.title}
                        </b>
                        <span className="prep-task-time">
                          {t.minutes} 分钟 · {t.sharePct}%
                        </span>
                      </div>
                      <small className="muted">
                        {st?.done ? `${st.detail} · ` : ""}
                        {t.reason}
                      </small>
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => launchPrepTask(t.kind)}>
                      {st?.done ? "再练一次" : t.cta} <ArrowRight size={14} />
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
        <div className="today-side">
          <section className="panel streak-panel">
            <div className="panel-head">
              <h2 className="eyebrow">这一周</h2>
              <span className={`streak ${streak ? "is-on" : ""}`}>
                <Flame size={16} /> 连续 {streak} 天
              </span>
            </div>
            <div className="streak-body">
              <Ring value={goal ? doneToday / goal : 0} size={112} stroke={8} tone="terra">
                <b>{doneToday}</b>
                <small>今日答题</small>
              </Ring>
              <ol className="week">
                {week.map((d) => (
                  <li key={d.k} className={`${d.v ? "is-on" : ""} ${d.today ? "is-today" : ""}`} title={`${d.k}：${d.v} 题`}>
                    <span style={{ "--h": Math.min(1, d.v / 40) } as React.CSSProperties} />
                    <small>{d.label}</small>
                  </li>
                ))}
              </ol>
            </div>
            <dl className="mini-stats">
              <div>
                <dt>已点亮</dt>
                <dd>{learned.toLocaleString()}</dd>
              </div>
              <div>
                <dt>已掌握</dt>
                <dd>{mastered.toLocaleString()}</dd>
              </div>
              <div>
                <dt>全部词汇</dt>
                <dd>{atlas.count.toLocaleString()}</dd>
              </div>
            </dl>
          </section>

          <section className="panel today-quick-links" aria-label="B2 专项直达">
            <h2 className="eyebrow">专项训练直达</h2>
            <div className="today-quick-grid">
              <button type="button" className="btn btn-ghost" onClick={() => go({ page: "real" })}>
                <Headphones size={16} /> 真实电台 RFI
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => go({ page: "reflow" })}>
                <BookMarked size={16} /> 统一错题中心{mistakeDue.total > 0 ? ` (${mistakeDue.total})` : ""}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => go({ page: "expr" })}>
                高频论证表达
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => go({ page: "mock" })}>
                全真模考
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => go({ page: "conj" })}>
                动词变位
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => go({ page: "compare" })}>
                易混词辨析
              </button>
            </div>
          </section>
        </div>
      </div>
      <Suspense fallback={null}>
        <LazyCockpitInsights />
      </Suspense>

      <section className="panel today-lounge-card" aria-label="漫游 · 书影音馆">
        <div className="panel-head">
          <div>
            <p className="eyebrow">漫游 · 书影音馆 · Flânerie</p>
            <p>
              {total > 0 || active
                ? "脑子转不动了？去翻两页法语故事或看支短片，不计分、不催复习 →"
                : `${examMode ? "今日备考收工" : "今日学习收工"} · 去漫游馆听场雨声读篇睡前法语 →`}
            </p>
          </div>
          <div className="backup-remind-actions">
            {loungeResume && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() =>
                  go({
                    page: "lounge",
                    shelf: loungeResume.shelf,
                    item: loungeResume.item,
                    ...(loungeResume.ch !== undefined ? { ch: String(loungeResume.ch) } : {}),
                  })
                }
              >
                继续《{loungeResume.title}》({loungeResume.label})
              </button>
            )}
            <a className="btn btn-ghost btn-sm" href="#/lounge">
              进入漫游馆 →
            </a>
          </div>
        </div>
      </section>

      <details className="today-discover" open={discoverOpen} onToggle={(e) => setDiscoverOpen(e.currentTarget.open)}>
        <summary className="today-discover-summary">
          <span>词汇星图 · 每日一词 · 一分钟口语 · 话题与易混词探索</span>
          <small className="muted">{discoverOpen ? "收起探索区" : "展开更多探索"}</small>
        </summary>
        <div className="today-grid">
          <WordOfDay />
          <section className="panel compare-teaser" onClick={() => go({ page: "drill" })} role="link" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && go({ page: "drill" })} aria-labelledby="today-drill-title">
            <p className="eyebrow">每日一分钟口语</p>
            <h2 id="today-drill-title">想 15 秒 · 说 60 秒</h2>
            <p>内置 {DRILL_QUESTIONS_COUNT} 个 DELF B2 高频辩题，录音回放并支持 Azure 发音评测。</p>
            <span className="compare-teaser-go">
              <Mic size={15} /> 去开口说 <ArrowRight size={16} />
            </span>
          </section>
          <section className="panel compare-teaser" onClick={() => go({ page: "expr" })} role="link" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && go({ page: "expr" })} aria-labelledby="today-expr-title">
            <p className="eyebrow">B2 论证表达库</p>
            <h2 id="today-expr-title">{EXPRESSIONS_COUNT} 张连接词与书信套话卡</h2>
            <p>按 FSRS 记忆曲线主动填空掌握让步、因果、立场转折与正式信函表达。</p>
            <span className="compare-teaser-go">
              <MessageSquareQuote size={15} /> 去练表达 <ArrowRight size={16} />
            </span>
          </section>
          <LevelPath />
          <CompareTeaser />
          <GalaxyPanel learned={learned} total={atlas.count} />
          <Topics />
        </div>
      </details>
      <Sheet open={placeOpen} onClose={() => setPlaceOpen(false)} label="摸底定级小测" wide>
        <h2 className="sheet-title">摸底定级小测</h2>
        {placeOpen && (
          <Suspense fallback={<span className="spinner" />}>
            <LazyPlacementTest
              initial={progress.placement}
              onCancel={() => setPlaceOpen(false)}
              onApply={(res) => {
                store.progress((p) => ({ ...p, placement: res }));
                store.settings({ startLevel: res.level });
                setPlaceOpen(false);
                toast(`已定级为 ${atlas.cefr[res.level] ?? "B1"}，备考任务已更新`, "ok");
              }}
            />
          </Suspense>
        )}
      </Sheet>
    </div>
  );
}

function GalaxyPanel({ learned, total }: { learned: number; total: number }) {
  const today = useStore((s) => s.progress.days[dayKey()]);
  const ids = useStore((s) => s.progress.cards);
  const todayIds = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Object.entries(ids)
      .filter(([, c]) => c.seen >= start.getTime())
      .map(([id]) => id);
  }, [ids]);
  void today;
  return (
    <section className="galaxy-panel" onClick={() => go({ page: "atlas", view: "galaxy" })} role="link" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && go({ page: "atlas", view: "galaxy" })}>
      <Suspense fallback={<div className="galaxy galaxy-mini" />}>
        <LazyGalaxy mode="mini" highlight={todayIds} />
      </Suspense>
      <div className="galaxy-panel-copy">
        <p className="eyebrow eyebrow-light">你的词汇星图</p>
        <h2>
          已点亮 <b>{learned.toLocaleString()}</b> 颗星
        </h2>
        <p>{learned ? `还有 ${(total - learned).toLocaleString()} 颗在等你。金色是今天新点亮的。` : `${total.toLocaleString()} 个词是 ${total.toLocaleString()} 颗星。学会一个，就点亮一颗。`}</p>
        <span className="btn btn-glass">
          进入星图 <ArrowRight size={18} />
        </span>
      </div>
    </section>
  );
}

function WordOfDay() {
  const atlas = useAtlas();
  const pick = useMemo(() => {
    // a taught-ready word from the first 3,000 on the learning path, not a rare or untranslated one
    const pool = atlas.words.filter((w) => w.order < 3000 && w.cefr <= 3 && isTaughtReady(w));
    const list = pool.length ? pool : atlas.words;
    return list[hashSeed(dayKey()) % list.length];
  }, [atlas]);
  const { entry } = useEntry(pick?.id);
  if (!pick) return null;
  return (
    <section className="panel wotd" onClick={() => openWord(pick.id)} aria-labelledby="today-wotd-title">
      <Illustration src={atlas.img(pick)} word={pick.word} topic={pick.topic} className="wotd-art" art={entry?.art ?? plateArticle(pick)} />
      <div className="wotd-body">
        <h2 className="eyebrow" id="today-wotd-title">今日一词</h2>
        {/* The word itself is the control; 发音 is a sibling button, never nested inside another button. */}
        <p className="wotd-word" lang="fr">
          <a
            href={href({ page: "today" }, pick.id)}
            className="wotd-open"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openWord(pick.id);
            }}
            onKeyDown={activateOn(() => openWord(pick.id))}
            aria-label={`打开今日一词 ${pick.word} 的词条`}
          >
            {pick.word}
          </a>
        </p>
        {entry && (
          <div onClick={(e) => e.stopPropagation()}>
            <Pronounce entry={entry} refw={pick} />
          </div>
        )}
        <p className="wotd-zh">{pick.zh}</p>
        {entry?.ex[0] && (
          <p className="wotd-ex" lang="fr">
            <Highlight text={entry.ex[0].en} word={entry.w} span={entry.ex[0].hl} />
          </p>
        )}
      </div>
    </section>
  );
}

function LevelPath() {
  const atlas = useAtlas();
  const cards = useStore((s) => s.progress.cards);
  const start = useStore((s) => s.settings.startLevel);
  const levels = useMemo(() => {
    const out = atlas.cefr.map((name) => ({ name, total: 0, seen: 0, mastered: 0 }));
    for (const w of atlas.words) {
      const l = out[w.cefr];
      l.total++;
      const c = cards[w.id];
      if (c) {
        l.seen++;
        if (isMastered(c)) l.mastered++;
      }
    }
    return out;
  }, [atlas, cards]);
  const NAMES = ["入门", "基础", "进阶", "中高", "高级", "精通"];
  // levels with no words (C1, C2: nothing is rated that high) are left out
  const bands = levels.filter((l) => l.total > 0);
  return (
    <section className="panel path-panel">
      <div className="panel-head">
        <h2 className="eyebrow">学习路线 · {bands.length ? `${bands[0].name} 到 ${bands[bands.length - 1].name}` : "全部等级"}</h2>
        <span className="legend">
          <i className="lg-seen" /> 已学 <i className="lg-done" /> 已掌握
        </span>
      </div>
      <ol className="route">
        {levels.map((l, i) => {
          if (l.total === 0) return null;
          const seen = l.seen / Math.max(1, l.total);
          const done = l.mastered / Math.max(1, l.total);
          return (
            <li key={l.name} className={`${i === start ? "is-start" : ""} ${l.seen ? "is-on" : ""}`}>
              <button onClick={() => go({ page: "atlas", level: l.name })} aria-label={`${l.name} ${NAMES[i]}，已学 ${l.seen} / ${l.total}`}>
                <span className="station" style={{ "--seen": seen, "--done": done } as React.CSSProperties}>
                  <b>{l.name}</b>
                </span>
                <span className="station-name">{NAMES[i]}</span>
                <span className="station-count">
                  {l.seen}
                  <small>/{l.total}</small>
                </span>
                {i === start && <span className="station-flag">起点</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Topics() {
  const atlas = useAtlas();
  const focus = useStore((s) => s.settings.focusTopic);
  const counts = useMemo(() => {
    const c = new Array(atlas.topics.length).fill(0);
    atlas.words.forEach((w) => c[w.topic]++);
    return c;
  }, [atlas]);
  return (
    <section className="topics-panel">
      <div className="panel-head">
        <h2 className="eyebrow">按主题探索</h2>
        <button className="link" onClick={() => go({ page: "atlas" })}>
          打开图鉴
        </button>
      </div>
      <ul className="topic-tiles">
        {atlas.topics.map(([key, name], i) => (
          <li key={key} className={focus === key ? "is-focus" : ""}>
            <button onClick={() => go({ page: "atlas", topic: key })}>
              <img src={`${BRAND}/topic-${TOPIC_ART[key] ?? key}.webp`} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
              <span>
                <b>{name}</b>
                <small>{focus === key ? "正在学 · " : ""}{counts[i]} 个词</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Shows the chosen topic (按主题学) with a way back to the whole learning path. */
function FocusNote() {
  const atlas = useAtlas();
  const focus = useStore((s) => s.settings.focusTopic);
  const name = focus ? atlas.topics.find((t) => t[0] === focus)?.[1] : null;
  if (!name) return null;
  return (
    <p className="focus-note">
      新词主题：<b>{name}</b>
      <button className="link" onClick={() => store.settings({ focusTopic: null })}>
        改回按学习路线
      </button>
    </p>
  );
}

/** 学习范围: which decks today's words come from, and due words waiting in the other decks. */
function RangeNote({ otherDue }: { otherDue: number }) {
  const rangeSlice = useStoreShallow((s) => ({
    decks: s.progress.decks,
    coreMigrated: s.progress.coreMigrated,
  }));
  const studyDecks = useStore((s) => s.settings.studyDecks);
  const range = studyRange(rangeSlice, { studyDecks });
  const names = [...(range.core ? [CORE_NAME] : []), ...range.decks.map((d) => d.name)];

  return (
    <p className="focus-note range-note">
      学习范围：<b>{range.all ? "全部卡组" : names.slice(0, 3).join("、") + (names.length > 3 ? ` 等 ${names.length} 个` : "")}</b>
      {otherDue > 0 && <span className="range-other">当前范围外还有 {otherDue} 个到期</span>}
      <button className="link" onClick={() => go({ page: "decks" })}>
        {range.all ? "管理卡组" : "修改"}
      </button>
      {!range.all && (
        <button className="link" onClick={() => store.settings({ studyDecks: null })}>
          全部
        </button>
      )}
    </p>
  );
}

/** Entry to the 易混词辨析 page: the page is not in the tab bar, so the home page points to it. */
function CompareTeaser() {
  return (
    <section className="panel compare-teaser" onClick={() => go({ page: "compare" })} role="link" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && go({ page: "compare" })} aria-labelledby="today-compare-title">
      <p className="eyebrow">易混词辨析</p>
      <h2 id="today-compare-title" lang="fr">
        ou / où <i>·</i> voir / regarder <i>·</i> emprunter / prêter
      </h2>
      <p>读音一样、意思相近、中文都翻成一个词的法语词，放在一起比一比，再用例句填空检验。</p>
      <span className="compare-teaser-go">
        去辨析 <ArrowRight size={16} />
      </span>
    </section>
  );
}
