import { ArrowLeft, ArrowRight, Clock, FileText, Lightbulb, Printer } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { TRACK_META } from "../../lib/exam-tracks";
import { tagLabel, tagsOf, type GrammarData, type GrammarPoint } from "../../lib/grammar";
import { DISCOURSE_EXERCISES, type DiscourseExercise } from "../../lib/grammar-discourse";
import { go } from "../../lib/router";
import {
  duePoints,
  essayErrors,
  mineDrills,
  missingPrereqs,
  nextPoint,
  pickDrills,
  readDoneDiscourseIds,
  REVIEW_ROUND,
  ROUND,
  tagKey,
  untouchedWithErrors,
} from "../../store/grammar";
import { store, useStore, useStoreShallow } from "../../store/store";
import { Speak } from "../../ui/Speak";
import { LEVELS, status, titleOf, type Step } from "./helpers";

type DiscourseFilter = "all" | "b2" | "fix" | "todo";

export function Overview({
  data,
  tabs,
  onStart,
  onDiscourse,
}: {
  data: GrammarData;
  tabs: ReactNode;
  onStart: (s: Step[]) => void;
  onDiscourse: (ex: DiscourseExercise) => void;
}) {
  const progress = useStoreShallow((s) => ({
    gram: s.progress.gram,
    essayNotes: s.progress.essayNotes,
    essays: s.progress.essays,
    speakCorrections: s.progress.speakCorrections,
    examLog: s.progress.examLog,
  }));
  const startLevel = useStore((s) => s.settings.startLevel);
  const examTrack = useStore((s) => s.settings.examTrack);
  const now = Date.now();
  const due = useMemo(() => duePoints(data, progress, now), [data, progress, now]);
  const fresh = useMemo(() => untouchedWithErrors(data, progress), [data, progress]);
  const started = data.points.filter((p) => progress.gram?.[p.id]).length;
  const next = nextPoint(data, progress, startLevel);
  const [openAllLevels, setOpenAllLevels] = useState(false);
  const [discFilter, setDiscFilter] = useState<DiscourseFilter>("all");
  const [expandAllDisc, setExpandAllDisc] = useState(false);
  const doneDiscIds = useMemo(() => readDoneDiscourseIds(), []);

  const priorityLevel = LEVELS[Math.min(startLevel, LEVELS.length - 1)];
  const orderedLevels = useMemo(() => {
    const startBand = Math.min(startLevel, LEVELS.length - 1);
    return [...LEVELS.slice(startBand), ...LEVELS.slice(0, startBand)];
  }, [startLevel]);

  const isPassagePractised = useCallback(
    (ex: DiscourseExercise) =>
      doneDiscIds.has(ex.id) || (doneDiscIds.size === 0 && ex.slots.every((s) => Boolean(progress.gram?.[s.point]))),
    [doneDiscIds, progress.gram],
  );

  const b2Count = useMemo(() => DISCOURSE_EXERCISES.filter((e) => e.level === "B2").length, []);
  const fixCount = useMemo(() => DISCOURSE_EXERCISES.filter((e) => e.kind === "fix").length, []);
  const todoCount = useMemo(
    () => DISCOURSE_EXERCISES.filter((e) => !isPassagePractised(e)).length,
    [isPassagePractised],
  );

  const filteredDiscourse = useMemo(() => {
    return DISCOURSE_EXERCISES.filter((ex) => {
      if (discFilter === "b2") return ex.level === "B2";
      if (discFilter === "fix") return ex.kind === "fix";
      if (discFilter === "todo") return !isPassagePractised(ex);
      return true;
    });
  }, [discFilter, isPassagePractised]);

  const visibleDiscourse = expandAllDisc ? filteredDiscourse : filteredDiscourse.slice(0, 8);

  const latestStructLog = useMemo(() => {
    const rows = progress.examLog ?? [];
    const tcf = rows.find((r) => r.track === "tcf" && (r.trackSection === "struct" || r.what === "struct-tcf"));
    const tef = rows.find((r) => r.track === "tef" && (r.trackSection === "struct" || r.what === "struct-tef"));
    return { tcf, tef };
  }, [progress.examLog]);

  const review = () => {
    const seed = Date.now();
    const full = store.get().progress;
    const errors = essayErrors(full);
    onStart(
      due.flatMap((id) =>
        pickDrills(data.points.find((p) => p.id === id)!, full, REVIEW_ROUND, seed, mineDrills(errors.get(id))).map(
          (drill) => ({ point: id, drill }),
        ),
      ),
    );
  };

  return (
    <div className="page gram">
      <header className="page-head">
        {tabs}
        <p className="eyebrow">语法 · Grammaire</p>
        <h1 className="display">规则，要在句子里练。</h1>
        <p className="lede">
          每个语法点有讲解、判断顺序和对比句，练习覆盖它的每一条规则和每一个易错点。每个语法点是一张复习卡：一轮做错得多，就会更早回来；哪一部分常错，那一部分就出得多。
        </p>
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

          {/* Timed TCF / TEF Structure Sprint Entry Card */}
          <div className="gram-discourse-box">
            <div className="gram-discourse-head">
              <h2 className="eyebrow">
                <Clock size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                TCF / TEF 限时语言结构冲刺
              </h2>
              {(examTrack === "tcf" || examTrack === "tef") && (
                <span className="chip chip-status is-done">当前轨道：{TRACK_META[examTrack].shortName}</span>
              )}
            </div>
            <p className="muted small">
              全真倒计时 + 排除干扰项 + 699 分制与加拿大 NCLC 即时换算；错题自动排入对应语法点 FSRS 复习。
            </p>
            <div className="chips">
              <button
                type="button"
                className={`btn btn-sm ${examTrack === "tef" ? "btn-ghost" : "btn-primary"}`}
                onClick={() => go({ page: "grammar", sprint: "tcf" })}
              >
                TCF 语言结构（18 题 · 15:00）
                {latestStructLog.tcf?.scaledScore !== undefined && ` · 最近 ${latestStructLog.tcf.scaledScore}/699`}
                <ArrowRight size={15} />
              </button>
              <button
                type="button"
                className={`btn btn-sm ${examTrack === "tef" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => go({ page: "grammar", sprint: "tef" })}
              >
                TEF 词汇与结构（40 题 · 30:00）
                {latestStructLog.tef?.scaledScore !== undefined && ` · 最近 ${latestStructLog.tef.scaledScore}/699`}
                <ArrowRight size={15} />
              </button>
            </div>
          </div>

          {/* 40-Passage Discourse Section with Filter Pills */}
          <div className="gram-discourse-box">
            <div className="gram-discourse-head">
              <h2 className="eyebrow">语篇级综合训练 · 共 {DISCOURSE_EXERCISES.length} 篇跨句时态与改错</h2>
              <span className="muted small">提交即自动同步对应语法点与细分规则掌握度</span>
            </div>
            <div className="chips" role="group" aria-label="语篇筛选">
              <button
                type="button"
                className={`chip-btn ${discFilter === "all" ? "is-on" : ""}`}
                aria-pressed={discFilter === "all"}
                onClick={() => setDiscFilter("all")}
              >
                全部 {DISCOURSE_EXERCISES.length} 篇
              </button>
              <button
                type="button"
                className={`chip-btn ${discFilter === "b2" ? "is-on" : ""}`}
                aria-pressed={discFilter === "b2"}
                onClick={() => setDiscFilter("b2")}
              >
                B2 核心（{b2Count}）
              </button>
              <button
                type="button"
                className={`chip-btn ${discFilter === "fix" ? "is-on" : ""}`}
                aria-pressed={discFilter === "fix"}
                onClick={() => setDiscFilter("fix")}
              >
                语篇改错（{fixCount}）
              </button>
              <button
                type="button"
                className={`chip-btn ${discFilter === "todo" ? "is-on" : ""}`}
                aria-pressed={discFilter === "todo"}
                onClick={() => setDiscFilter("todo")}
              >
                未练过（{todoCount}）
              </button>
            </div>
            {filteredDiscourse.length === 0 ? (
              <p className="muted small">该筛选下暂无篇章，切换「全部 {DISCOURSE_EXERCISES.length} 篇」可重温任意语篇。</p>
            ) : (
              <>
                <ul className="gram-discourse-list">
                  {visibleDiscourse.map((ex) => {
                    const done = isPassagePractised(ex);
                    return (
                      <li key={ex.id}>
                        <button type="button" className="gram-discourse-item" onClick={() => onDiscourse(ex)}>
                          <span>
                            <span>
                              <span className="chip">{ex.level}</span>{" "}
                              {ex.kind === "fix" && <span className="chip">改错</span>}{" "}
                              {done && <span className="chip chip-status is-done">已练</span>} <b>{ex.title}</b>
                            </span>
                            <small>{ex.subtitle}</small>
                          </span>
                          <ArrowRight size={15} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {filteredDiscourse.length > 8 && (
                  <button
                    type="button"
                    className="link small"
                    onClick={() => setExpandAllDisc((v) => !v)}
                  >
                    {expandAllDisc
                      ? "收起语篇列表（只看前 8 篇）"
                      : `展开其余 ${filteredDiscourse.length - 8} 篇（共 ${filteredDiscourse.length} 篇）`}
                  </button>
                )}
              </>
            )}
          </div>
          <a className="btn btn-ghost gram-sheet-link" href="#/grammar?sheet=1">
            <FileText size={16} /> 速查表：所有语法点的口诀和判断顺序
          </a>
        </section>
        <section className="gram-levels">
          <nav className="gram-toc" aria-label="语法级别快捷目录">
            {orderedLevels.map((lv) => {
              const list = data.points.filter((p) => p.level === lv);
              if (!list.length) return null;
              const doneLv = list.filter((p) => progress.gram?.[p.id]).length;
              return (
                <button
                  key={lv}
                  type="button"
                  className={`chip-btn gram-toc-btn ${lv === priorityLevel ? "is-on" : ""}`}
                  onClick={() => {
                    const el = document.getElementById(`gram-lv-${lv}`) as HTMLDetailsElement | null;
                    if (el) {
                      el.open = true;
                      el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }}
                >
                  <b>{lv}</b>
                  <small>{doneLv}/{list.length}</small>
                </button>
              );
            })}
            <button type="button" className="link small" onClick={() => setOpenAllLevels((v) => !v)}>
              {openAllLevels ? "收起其他级" : "展开全部级别"}
            </button>
          </nav>
          {orderedLevels.map((lv) => {
            const list = data.points.filter((p) => p.level === lv);
            if (!list.length) return null;
            const isPriority = lv === priorityLevel;
            return (
              <details key={lv} id={`gram-lv-${lv}`} className="gram-level" open={openAllLevels || isPriority || lv === "B2"}>
                <summary className="gram-level-summary">
                  <h2 className="eyebrow">
                    {lv}
                    {isPriority && " · 当前起点优先"}
                  </h2>
                  <small className="muted">{list.filter((p) => progress.gram?.[p.id]).length} / {list.length} 已开始</small>
                </summary>
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
              </details>
            );
          })}
        </section>
      </div>
    </div>
  );
}

/* ---------- 速查表 ---------- */

export function CheatSheet({ data }: { data: GrammarData }) {
  const [level, setLevel] = useState<"all" | (typeof LEVELS)[number]>("all");
  const [query, setQuery] = useState("");
  const [showPairs, setShowPairs] = useState(false);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);
  const q = query.trim().toLowerCase();
  const matches = (p: GrammarPoint) => {
    if (!q) return true;
    const hay = [
      p.title,
      p.fr,
      p.motto ?? "",
      ...(p.decide ?? []),
      ...p.rules.map((r) => r.h),
      ...p.traps,
      ...(p.pairs ?? []).flatMap((x) => [x.a, x.b, x.d]),
    ]
      .join(" ")
      .toLowerCase();
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
          <input
            className="gram-sheet-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜语法点、关键词、连词、代词…"
            aria-label="搜索速查表"
          />
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

export function PointView({ data, point, onStart }: { data: GrammarData; point: GrammarPoint; onStart: (s: Step[]) => void }) {
  const progress = useStoreShallow((s) => ({
    gram: s.progress.gram,
    gramTags: s.progress.gramTags,
    essayNotes: s.progress.essayNotes,
    essays: s.progress.essays,
    speakCorrections: s.progress.speakCorrections,
  }));
  const card = progress.gram?.[point.id];
  const st = status(card, Date.now());
  const errors = useMemo(() => essayErrors(progress).get(point.id) ?? [], [progress, point.id]);
  const missing = missingPrereqs(data, point, progress);
  const start = () => {
    const full = store.get().progress;
    onStart(pickDrills(point, full, ROUND, Date.now(), mineDrills(errors)).map((drill) => ({ point: point.id, drill })));
  };
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [point.id]);
  const tags = useMemo(
    () =>
      tagsOf(point).filter(
        (t) => point.drills.some((d) => d.g === t) || Boolean(progress.gramTags?.[tagKey(point.id, t)]?.n),
      ),
    [point, progress.gramTags],
  );
  const practisedCount = tags.filter((t) => progress.gramTags?.[tagKey(point.id, t)]?.n).length;
  const discourseStat = progress.gramTags?.[tagKey(point.id, "discourse")];
  const discourseRate = discourseStat?.n ? Math.round((1 - discourseStat.w / discourseStat.n) * 100) : null;

  return (
    <div className="page gram">
      <header className="page-head">
        <button className="link deck-back" onClick={() => go({ page: "grammar" })}>
          <ArrowLeft size={16} /> 全部语法点
        </button>
        <p className="eyebrow">
          {point.level} · <span lang="fr">{point.fr}</span>
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
            <h2>遇到这类句子，按这个顺序判断</h2>
            <ol className="gram-decide">
              {point.decide.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ol>
          </section>
        )}
        {point.rules.map((r) => (
          <section key={r.h} className="panel gram-rule">
            <h2>{r.h}</h2>
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
            <h2>对比：只差一处，答案就变</h2>
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
            <h2>一步步拆一句</h2>
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
            <h2>你在作文或口语里错过</h2>
            <ul>
              {errors.slice(0, 8).map((e) => (
                <li key={e.wrong + e.right}>
                  <span className="chip">{e.source === "speak" ? "口语" : "作文"}</span>
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
          <div className="gram-discourse-head" style={{ width: "100%" }}>
            <h2 className="eyebrow">规则 &amp; 易错点掌握度（已练 {practisedCount} / {tags.length} 项）</h2>
            <small className="muted">
              题库 {point.drills.length} 题 · {st.label}
              {card ? ` · 已复习 ${card.reps} 次` : ""}
            </small>
          </div>
          {tags.length > 0 && (
            <ul className="gram-tags">
              {tags.map((t) => {
                const s = progress.gramTags?.[tagKey(point.id, t)];
                const rate = s?.n ? Math.round((1 - s.w / s.n) * 100) : null;
                const prefix = t.startsWith("t") ? "易错 · " : "规则 · ";
                return (
                  <li key={t}>
                    <span>
                      <small className="muted">{prefix}</small>
                      {tagLabel(point, t)}
                    </span>
                    {rate === null ? (
                      <small className="muted">待检验</small>
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
              {discourseRate !== null && (
                <li>
                  <span>
                    <small className="muted">语篇 · </small>跨句综合应用
                  </span>
                  <span className="gram-tag-bar" aria-hidden>
                    <span
                      style={{ width: `${discourseRate}%` }}
                      className={discourseRate < 60 ? "is-weak" : discourseRate < 85 ? "is-mid" : ""}
                    />
                  </span>
                  <small>{discourseRate}%</small>
                </li>
              )}
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
