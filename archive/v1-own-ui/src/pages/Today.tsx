import { ArrowRight, Flame, Keyboard, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { TOPICS, WORD_BY_ID, WORD_ORDER, topicOf, type TopicKey } from "../data";
import { go, openWord } from "../lib/router";
import { clozeOf, hashSeed } from "../lib/fr";
import { buildSession, masteredCount, todayPlan } from "../store/session";
import { isMastered } from "../store/srs";
import { dayKey, store, useStore } from "../store/store";
import { Art } from "../ui/Art";
import { Highlight } from "../ui/EntryView";
import { Ring } from "../ui/Ring";
import { Speak } from "../ui/Speak";

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
  const progress = useStore((s) => s.progress);
  const settings = useStore((s) => s.settings);
  const plan = useMemo(() => todayPlan(progress, settings), [progress, settings]);
  const now = new Date();
  const today = progress.days[dayKey()];
  const streak = streakOf(progress.days);
  const active = progress.session && !progress.session.finished ? progress.session : null;
  const total = plan.due.length + plan.fresh.length;
  const goal = settings.dailyNew + Math.min(plan.due.length, 60);
  const doneToday = today?.r ?? 0;

  const start = (opts?: { reviewOnly?: boolean; extra?: number }) => {
    if (!active) {
      const s = buildSession(progress, opts?.extra ? { ...settings, dailyNew: (today?.n ?? 0) + opts.extra } : settings, { reviewOnly: opts?.reviewOnly });
      if (!s.steps.length) return;
      store.progress((p) => ({ ...p, session: s }));
    }
    go("learn");
  };

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const k = dayKey(d);
    return { k, label: "日一二三四五六"[d.getDay()], v: progress.days[k]?.r ?? 0, today: i === 6 };
  });

  const learned = Object.keys(progress.cards).length;
  const mastered = masteredCount(progress);
  const teaser = (active ? active.newIds : plan.fresh).slice(0, 5).map((id) => WORD_BY_ID.get(id)!).filter(Boolean);

  return (
    <div className="page today">
      <header className="greet">
        <p className="eyebrow">
          {now.getMonth() + 1}月{now.getDate()}日 · 星期{"日一二三四五六"[now.getDay()]}
        </p>
        <h1 className="display">{greeting(now.getHours())}，explorateur。</h1>
      </header>

      <section className={`journey ${total === 0 && !active ? "is-clear" : ""}`}>
        <div className="journey-art" aria-hidden="true">
          <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice">
            <circle cx="300" cy="70" r="46" fill="var(--ochre)" opacity="0.85" />
            <path d="M0 200 Q100 120 200 180 T400 150 L400 240 L0 240 Z" fill="var(--terra)" opacity="0.55" />
            <path d="M0 225 Q120 160 240 215 T400 205 L400 240 L0 240 Z" fill="var(--sage)" opacity="0.5" />
            {Array.from({ length: 18 }, (_, i) => (
              <circle key={i} cx={20 + ((i * 97) % 360)} cy={20 + ((i * 53) % 120)} r={i % 3 === 0 ? 2 : 1.2} fill="var(--ink)" opacity="0.55" />
            ))}
          </svg>
        </div>
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
            </>
          ) : (
            <>
              <p className="eyebrow eyebrow-light">今日已完成</p>
              <h2>今天的星，都亮了。</h2>
              <p className="journey-lede">记忆需要一点留白。想多学一段，也可以。</p>
            </>
          )}
          {teaser.length > 0 && (
            <div className="teaser" aria-label="今天将遇见的新词">
              {teaser.map((w, i) => (
                <span key={w.id} className={`teaser-chip teaser-${i}`}>
                  {w.w}
                </span>
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
                再学 5 个新词 <Sparkles size={18} />
              </button>
            )}
            {!active && plan.due.length > 0 && plan.fresh.length > 0 && (
              <button className="btn btn-glass" onClick={() => start({ reviewOnly: true })}>
                只复习
              </button>
            )}
            {!active && total === 0 && (
              <button className="btn btn-glass" onClick={() => go("practice")}>
                <Keyboard size={18} /> 听写练习
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
              <small>今日作答</small>
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
              <dt>已学</dt>
              <dd>{learned}</dd>
            </div>
            <div>
              <dt>已掌握</dt>
              <dd>{mastered}</dd>
            </div>
            <div>
              <dt>全部词</dt>
              <dd>{WORD_ORDER.length}</dd>
            </div>
          </dl>
        </section>

        <LevelPath />
        <StarMap learned={learned} />
        <Topics />
      </div>
    </div>
  );
}

function StarMap({ learned }: { learned: number }) {
  const cards = useStore((s) => s.progress.cards);
  const total = WORD_ORDER.length;
  return (
    <section className="galaxy-panel" onClick={() => go("atlas")} role="link" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && go("atlas")}>
      <div className="starmap" aria-hidden="true">
        {WORD_ORDER.map((w) => (
          <i key={w.id} className={cards[w.id] ? (isMastered(cards[w.id]) ? "is-done" : "is-on") : ""} />
        ))}
      </div>
      <div className="galaxy-panel-copy">
        <p className="eyebrow eyebrow-light">你的词汇星图</p>
        <h3>
          已点亮 <b>{learned}</b> 颗星
        </h3>
        <p>{learned ? `还有 ${total - learned} 颗在等你。` : `${total} 个词就是 ${total} 颗星。学会一个，就点亮一颗。`}</p>
        <span className="btn btn-glass">
          进入词图 <ArrowRight size={18} />
        </span>
      </div>
    </section>
  );
}

function WordOfDay() {
  const pick = useMemo(() => WORD_ORDER[hashSeed(dayKey()) % WORD_ORDER.length], []);
  const c = clozeOf(pick.ex[0].fr, pick.w);
  return (
    <section className="panel wotd" onClick={() => openWord(pick.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && openWord(pick.id)} aria-label={`今日一词：${pick.w}`}>
      <Art topic={pick.topic as TopicKey} tone={topicOf(pick.topic as TopicKey).tone} word={pick.w} className="wotd-art" />
      <div className="wotd-body">
        <h3 className="eyebrow">今日一词</h3>
        <p className="wotd-word" lang="fr">
          {pick.w}
        </p>
        <div onClick={(e) => e.stopPropagation()}>
          <Speak text={pick.w} label="écouter" />
        </div>
        <p className="wotd-zh">{pick.senses[0].zh}</p>
        <p className="wotd-ex" lang="fr">
          {c ? <Highlight text={pick.ex[0].fr} word={pick.w} /> : pick.ex[0].fr}
        </p>
        <p className="ex-zh">{pick.ex[0].zh}</p>
      </div>
    </section>
  );
}

function LevelPath() {
  const cards = useStore((s) => s.progress.cards);
  const levels = useMemo(
    () =>
      TOPICS.map((t) => {
        const words = WORD_ORDER.filter((w) => w.topic === t.key);
        const seen = words.filter((w) => cards[w.id]).length;
        const done = words.filter((w) => isMastered(cards[w.id])).length;
        return { ...t, total: words.length, seen, done };
      }),
    [cards],
  );
  const firstOpen = levels.findIndex((l) => l.seen < l.total);
  return (
    <section className="panel path-panel">
      <div className="panel-head">
        <h3 className="eyebrow">主题路线 · 9 个站点</h3>
        <span className="legend">
          <i className="lg-seen" /> 已学 <i className="lg-done" /> 已掌握
        </span>
      </div>
      <ol className="route">
        {levels.map((l, i) => {
          const seen = l.seen / Math.max(1, l.total);
          const done = l.done / Math.max(1, l.total);
          return (
            <li key={l.key} className={`${i === firstOpen ? "is-start" : ""} ${l.seen ? "is-on" : ""}`}>
              <button onClick={() => go("atlas", { topic: l.key })} aria-label={`${l.zh}，已学 ${l.seen} / ${l.total}`}>
                <span className="station" style={{ "--seen": seen, "--done": done } as React.CSSProperties}>
                  <b>{i + 1}</b>
                </span>
                <span className="station-name">{l.zh}</span>
                <span className="station-count">
                  {l.seen}
                  <small>/{l.total}</small>
                </span>
                {i === firstOpen && <span className="station-flag">下一站</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Topics() {
  const counts = useMemo(() => TOPICS.map((t) => WORD_ORDER.filter((w) => w.topic === t.key).length), []);
  return (
    <section className="topics-panel">
      <div className="panel-head">
        <h3 className="eyebrow">按 B2 主题探索</h3>
        <button className="link" onClick={() => go("atlas")}>
          打开词图
        </button>
      </div>
      <ul className="topic-tiles">
        {TOPICS.map((t, i) => (
          <li key={t.key}>
            <button onClick={() => go("atlas", { topic: t.key })}>
              <Art topic={t.key} tone={t.tone} word={t.name} className="tile-art" />
              <span>
                <b>{t.zh}</b>
                <small>
                  {t.name} · {counts[i]} 词
                </small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
