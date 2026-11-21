import { HomeDictionary } from "../ui/HomeDictionary";
import { FamilyPicker } from "../ui/FamilyPicker";
import { POS_OPTIONS } from "../lib/pos";
import { ArrowRight, Calendar, Compass, Flame, Keyboard, Sparkles, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { prefetch, useAtlas, useEntry } from "../atlas/context";
import { useGrammar } from "../atlas/grammar";
import { go, openWord } from "../lib/router";
import { cue } from "../lib/sound";
import { buildPrepSchedule, type PrepKind } from "../lib/study-plan";
import { hashSeed } from "../lib/text";
import { duePoints, untouchedWithErrors } from "../store/grammar";
import { buildSession, isTaughtReady, masteredCount, todayPlan } from "../store/session";
import { isMastered } from "../store/srs";
import { CORE_NAME, studyRange } from "../store/decks";
import { dayKey, MAX_DAILY_NEW, store, useStore } from "../store/store";
import { Galaxy } from "../galaxy/Galaxy";
import { Highlight, Pronounce } from "../ui/EntryView";
import { Illustration, plateArticle } from "../ui/Illustration";
import { PlacementTest } from "../ui/PlacementTest";
import { Ring } from "../ui/Ring";
import { Sheet } from "../ui/Sheet";
import { toast } from "../ui/Toast";
import { ComprehensionStudio } from "./Comprehension";
import { DrillStudio, DrillTeaser } from "./Drill";
import { EssayStudio } from "./Essay";
import { ExprStudio, ExprTeaser } from "./Expressions";
import { SpeakingStudio } from "./Speaking";

const BRAND = `${import.meta.env.BASE_URL}brand`;
/** Topics without their own tile art borrow a related one. */
const TOPIC_ART: Record<string, string> = { people: "society" };

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
  const progress = useStore((s) => s.progress);
  const settings = useStore((s) => s.settings);
  const plan = useMemo(() => todayPlan(atlas, progress, settings), [atlas, progress, settings]);
  // Warm the first cards of today's journey so the session opens instantly.
  const firstIds = [...plan.due.slice(0, 4), ...plan.fresh.slice(0, 6)].join(",");
  useEffect(() => {
    const ids = firstIds.split(",").filter(Boolean);
    const t = window.setTimeout(() => void prefetch(atlas, ids), 800);
    return () => window.clearTimeout(t);
  }, [atlas, firstIds]);
  const now = new Date();
  const today = progress.days[dayKey()];
  const streak = streakOf(progress.days);
  const active = progress.session && !progress.session.finished ? progress.session : null;
  const total = plan.due.length + plan.fresh.length;
  const goal = settings.dailyNew + Math.min(plan.due.length, 60);
  const doneToday = today?.r ?? 0;

  const [more, setMore] = useState("");
  const [drill, setDrill] = useState(false);
  const [expr, setExpr] = useState(false);
  const [studio, setStudio] = useState<"listen" | "read" | "essay" | "speak" | null>(null);
  const [placeOpen, setPlaceOpen] = useState(false);
  const moreN = Math.min(MAX_DAILY_NEW, Math.max(0, Math.round(Number(more) || 0)));
  const start = (opts?: { reviewOnly?: boolean; extra?: number }) => {
    if (!active) {
      const s = buildSession(atlas, progress, opts?.extra ? { ...settings, dailyNew: (today?.n ?? 0) + opts.extra } : settings, { reviewOnly: opts?.reviewOnly });
      if (!s.steps.length) return;
      store.progress((p) => ({ ...p, session: s }));
    }
    if (settings.sfx) void cue("start");
    go({ page: "learn" });
  };

  const { data: grammar } = useGrammar();
  const grammarDueCount = useMemo(() => (grammar ? duePoints(grammar, progress).length : 0), [grammar, progress]);
  const grammarUntouchedErrors = useMemo(() => (grammar ? untouchedWithErrors(grammar, progress).length : 0), [grammar, progress]);
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
    if (kind === "listen" || kind === "read" || kind === "essay" || kind === "speak") {
      setStudio(kind);
      return;
    }
    if (kind === "grammar") {
      go({ page: "grammar" });
      return;
    }
    if (active || total > 0) start();
    else go({ page: "practice" });
  };

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const k = dayKey(d);
    return { k, label: "日一二三四五六"[d.getDay()], v: progress.days[k]?.r ?? 0, today: i === 6 };
  });

  const learned = Object.keys(progress.cards).length;
  const mastered = masteredCount(progress);
  const teaser = (active ? active.newIds : plan.fresh).slice(0, 5).map((id) => atlas.byId.get(id)!).filter(Boolean);

  if (drill) return <DrillStudio onExit={() => setDrill(false)} exitLabel="返回今日" />;
  if (expr) return <ExprStudio onExit={() => setExpr(false)} exitLabel="返回今日" />;
  if (studio === "listen") return <ComprehensionStudio key="listen" kind="listen" onExit={() => setStudio(null)} />;
  if (studio === "read") return <ComprehensionStudio key="read" kind="read" onExit={() => setStudio(null)} />;
  if (studio === "essay") return <EssayStudio onExit={() => setStudio(null)} />;
  if (studio === "speak") return <SpeakingStudio onExit={() => setStudio(null)} />;

  return (
    <div className="page today">
      <header className="greet">
        <p className="eyebrow">
          {greeting(now.getHours())} · {now.getMonth() + 1}月{now.getDate()}日 · 星期{"日一二三四五六"[now.getDay()]}
        </p>
        <h1 className="display">
          <span lang="fr">{greetingFr(now.getHours())}</span>，探索者。
        </h1>
      </header>

      <HomeDictionary />

      <section className="panel prep-card" aria-label="今日备考调度">
        <div className="prep-head">
          <div className="prep-meta">
            <p className="eyebrow">今日备考调度 · DELF B2</p>
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
                <Target size={14} /> 目标 {prep.targetScore}/100（均 {prep.targetPerPart}/25）
              </span>
            </div>
          </div>
          <div className="prep-head-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPlaceOpen(true)}>
              <Compass size={15} /> {progress.placement ? `重测定级（${atlas.cefr[progress.placement.level] ?? "B1"}）` : "摸底定级"}
            </button>
          </div>
        </div>

        <ul className="prep-skills" aria-label="四科当前表现">
          {(["listen", "read", "essay", "speak"] as const).map((k) => {
            const st = prep.skills[k];
            const isWeak = prep.weakest === k;
            return (
              <li key={k} className={`prep-skill ${isWeak ? "is-weak" : ""}`}>
                <span>
                  {st.label} <b>{st.code}</b>
                </span>
                <strong>
                  {st.score25 !== null ? (
                    <>
                      {st.score25}
                      <small>/25{st.source === "placement" ? " 定级" : ""}</small>
                    </>
                  ) : (
                    <small>待测</small>
                  )}
                </strong>
              </li>
            );
          })}
        </ul>

        {/* slot: ExamDashboard (SYS-3) — reserved slot for exam 4-skill /100 & 5/25 floor dashboard */}

        {prep.vocabOverCap && (
          <div className="prep-warn" role="status">
            <span>
              距考不足 6 个月：当前背词预计 {prep.vocabRawMinutes} 分钟（占今日 {prep.vocabSharePct}%），建议控制在 ≤{prep.vocabCapPct}%（≤{prep.vocabCapMinutes} 分钟）。
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                store.settings({ dailyNew: prep.suggestedDailyNew });
                toast(`已将每日新词调为 ${prep.suggestedDailyNew} 个（背词控制在 25% 以内）`, "ok");
              }}
            >
              调为每日 {prep.suggestedDailyNew} 新词
            </button>
          </div>
        )}

        <ol className="prep-tasks">
          {prep.tasks.map((t) => (
            <li key={t.kind} className={`prep-task is-${t.kind}`}>
              <div className="prep-task-body">
                <div className="prep-task-top">
                  <b>{t.title}</b>
                  <span className="prep-task-time">
                    {t.minutes} 分钟 · {t.sharePct}%
                  </span>
                </div>
                <small className="muted">{t.reason}</small>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => launchPrepTask(t.kind)}>
                {t.cta} <ArrowRight size={14} />
              </button>
            </li>
          ))}
        </ol>
      </section>

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
            </>
          ) : (
            <>
              <p className="eyebrow eyebrow-light">今日已完成</p>
              <h2>今天的星，都亮了。</h2>
              <p className="journey-lede">记忆需要一点留白。想多走一段，也可以。</p>
              <RangeNote otherDue={plan.otherDue} />
            </>
          )}
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
          <div className="study-family-row"><span>按词族学习：</span><FamilyPicker study value={settings.studyFamilies} onChange={(ids, scope) => store.settings({ studyFamilies: ids.length ? ids : null, ...(scope && scope !== "study" ? { studyDecks: scope === "all" ? null : [scope] } : {}) })} /></div>
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

      <div className="today-grid">
        <WordOfDay />

        <section className="panel streak-panel">
          <div className="panel-head">
            <h3 className="eyebrow">这一周</h3>
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

        <DrillTeaser onOpen={() => setDrill(true)} />
        <ExprTeaser onOpen={() => setExpr(true)} />
        <LevelPath />
        <CompareTeaser />
        <GalaxyPanel learned={learned} total={atlas.count} />
        <Topics />
      </div>
      <Sheet open={placeOpen} onClose={() => setPlaceOpen(false)} label="摸底定级小测" wide>
        <h2 className="sheet-title">摸底定级小测</h2>
        {placeOpen && (
          <PlacementTest
            initial={progress.placement}
            onCancel={() => setPlaceOpen(false)}
            onApply={(res) => {
              store.progress((p) => ({ ...p, placement: res }));
              store.settings({ startLevel: res.level });
              setPlaceOpen(false);
              toast(`已定级为 ${atlas.cefr[res.level] ?? "B1"}，备考任务已更新`, "ok");
            }}
          />
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
      <Galaxy mode="mini" highlight={todayIds} />
      <div className="galaxy-panel-copy">
        <p className="eyebrow eyebrow-light">你的词汇星图</p>
        <h3>
          已点亮 <b>{learned.toLocaleString()}</b> 颗星
        </h3>
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
    <section className="panel wotd" onClick={() => openWord(pick.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && openWord(pick.id)} aria-label={`今日一词：${pick.word}`}>
      <Illustration src={atlas.img(pick)} word={pick.word} topic={pick.topic} className="wotd-art" art={entry?.art ?? plateArticle(pick)} />
      <div className="wotd-body">
        <h3 className="eyebrow">今日一词</h3>
        <p className="wotd-word" lang="fr">
          {pick.word}
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
        <h3 className="eyebrow">学习路线 · {bands.length ? `${bands[0].name} 到 ${bands[bands.length - 1].name}` : "全部等级"}</h3>
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
        <h3 className="eyebrow">按主题探索</h3>
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
  const progress = useStore((s) => s.progress);
  const studyDecks = useStore((s) => s.settings.studyDecks);
  const range = studyRange(progress, { studyDecks });
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
    <section className="panel compare-teaser" onClick={() => go({ page: "compare" })} role="link" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && go({ page: "compare" })} aria-label="易混词辨析">
      <p className="eyebrow">易混词辨析</p>
      <h3 lang="fr">
        ou / où <i>·</i> voir / regarder <i>·</i> emprunter / prêter
      </h3>
      <p>读音一样、意思相近、中文都翻成一个词的法语词，放在一起比一比，再用例句填空检验。</p>
      <span className="compare-teaser-go">
        去辨析 <ArrowRight size={16} />
      </span>
    </section>
  );
}
