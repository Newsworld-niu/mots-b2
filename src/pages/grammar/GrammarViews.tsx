import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  Clock,
  Columns3,
  Flame,
  Lightbulb,
  ListOrdered,
  Printer,
  Search,
  Target,
  X,
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { foldAccents } from "../../lib/accent";
import { TRACK_META } from "../../lib/exam-tracks";
import {
  GRAMMAR_CATEGORIES,
  GRAMMAR_CATEGORY_LABEL,
  stripGrammarMarks,
  tagLabel,
  tagsOf,
  type Drill,
  type GrammarCategory,
  type GrammarData,
  type GrammarMatrix,
  type GrammarPoint,
} from "../../lib/grammar";
import { DISCOURSE_EXERCISES, type DiscourseExercise } from "../../lib/grammar-discourse";
import { go } from "../../lib/router";
import {
  countMatchingDrills,
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
  type DrillFilter,
} from "../../store/grammar";
import { store, useStore, useStoreShallow } from "../../store/store";
import { Speak } from "../../ui/Speak";
import { KIND_LABEL, KIND_ORDER, LEVELS, scrollToSection, status, tagNumber, titleOf, type StartRound } from "./helpers";
import { FormulaBlock, GrammarTableView, MarkLegend, PitfallList, pointHasMarks, RichGrammarText } from "./RichGrammar";

type DiscourseFilter = "all" | "b2" | "fix" | "todo";
type CatalogView = "level" | "category" | "todo";

/** Search text: no marks, no accents, one kind of apostrophe, lower case. */
const searchNorm = (s: string) => foldAccents(stripGrammarMarks(s).replace(/[’‘`ʼ]/g, "'"));

function pointHaystack(p: GrammarPoint) {
  return searchNorm(
    [
      p.title,
      p.fr,
      p.motto ?? "",
      p.intro,
      p.category ? GRAMMAR_CATEGORY_LABEL[p.category] : "",
      ...(p.decide ?? []),
      ...p.rules.flatMap((r) => [r.h, ...(r.formula ?? [])]),
      ...p.traps,
      ...(p.exceptions ?? []),
      ...(p.pairs ?? []).flatMap((x) => [x.a, x.b]),
    ].join(" "),
  );
}

/** Error rate of a tag (0..1), or null when not practised. */
const errRate = (s: { n: number; w: number } | undefined) => (s?.n ? s.w / s.n : null);

/* ---------- 语法总览 ---------- */

export function Overview({
  data,
  tabs,
  onStart,
  onDiscourse,
}: {
  data: GrammarData;
  tabs: ReactNode;
  onStart: StartRound;
  onDiscourse: (ex: DiscourseExercise) => void;
}) {
  const progress = useStoreShallow((s) => ({
    gram: s.progress.gram,
    gramTags: s.progress.gramTags,
    essayNotes: s.progress.essayNotes,
    essays: s.progress.essays,
    speakCorrections: s.progress.speakCorrections,
    examLog: s.progress.examLog,
  }));
  const startLevel = useStore((s) => s.settings.startLevel);
  const examTrack = useStore((s) => s.settings.examTrack);
  const [now] = useState(() => Date.now());
  const due = useMemo(() => duePoints(data, progress, now), [data, progress, now]);
  const fresh = useMemo(() => untouchedWithErrors(data, progress), [data, progress]);
  const started = data.points.filter((p) => progress.gram?.[p.id]).length;
  const next = nextPoint(data, progress, startLevel);
  const [discFilter, setDiscFilter] = useState<DiscourseFilter>("all");
  const [expandAllDisc, setExpandAllDisc] = useState(false);
  const doneDiscIds = useMemo(() => readDoneDiscourseIds(), []);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<CatalogView>("level");

  const byId = useMemo(() => new Map(data.points.map((p) => [p.id, p])), [data]);
  const priorityLevel = LEVELS[Math.min(startLevel, LEVELS.length - 1)];
  const orderedLevels = useMemo(() => {
    const startBand = Math.min(startLevel, LEVELS.length - 1);
    return [...LEVELS.slice(startBand), ...LEVELS.slice(0, startBand)];
  }, [startLevel]);

  /** Rules and traps the learner gets wrong most, across points. */
  const weakTags = useMemo(() => {
    const out: { point: GrammarPoint; tag: string; rate: number }[] = [];
    for (const [k, s] of Object.entries(progress.gramTags ?? {})) {
      const cut = k.lastIndexOf("|");
      const point = byId.get(k.slice(0, cut));
      const tag = k.slice(cut + 1);
      const rate = errRate(s);
      if (!point || !/^[rt]\d+$/.test(tag) || rate === null || s.n < 2 || rate < 0.25) continue;
      if (!point.drills.some((d) => d.g === tag)) continue;
      out.push({ point, tag, rate });
    }
    return out.sort((a, b) => b.rate - a.rate).slice(0, 6);
  }, [progress.gramTags, byId]);

  const isPassagePractised = useCallback(
    (ex: DiscourseExercise) =>
      doneDiscIds.has(ex.id) || (doneDiscIds.size === 0 && ex.slots.every((s) => Boolean(progress.gram?.[s.point]))),
    [doneDiscIds, progress.gram],
  );
  const b2Count = useMemo(() => DISCOURSE_EXERCISES.filter((e) => e.level === "B2").length, []);
  const fixCount = useMemo(() => DISCOURSE_EXERCISES.filter((e) => e.kind === "fix").length, []);
  const todoCount = useMemo(() => DISCOURSE_EXERCISES.filter((e) => !isPassagePractised(e)).length, [isPassagePractised]);
  const filteredDiscourse = useMemo(
    () =>
      DISCOURSE_EXERCISES.filter((ex) => {
        if (discFilter === "b2") return ex.level === "B2";
        if (discFilter === "fix") return ex.kind === "fix";
        if (discFilter === "todo") return !isPassagePractised(ex);
        return true;
      }),
    [discFilter, isPassagePractised],
  );
  const visibleDiscourse = expandAllDisc ? filteredDiscourse : filteredDiscourse.slice(0, 6);

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
        pickDrills(byId.get(id)!, full, REVIEW_ROUND, seed, mineDrills(errors.get(id))).map((drill) => ({ point: id, drill })),
      ),
      { mode: "round", label: "到期综合复习" },
    );
  };

  const weakRound = useCallback(() => {
    const seed = Date.now();
    const full = store.get().progress;
    const per = weakTags.length <= 3 ? 4 : 2;
    return weakTags.flatMap(({ point, tag }, i) =>
      pickDrills(point, full, per, seed + i, [], { tag }).map((drill) => ({ point: point.id, drill })),
    );
  }, [weakTags]);
  const startWeak = () => onStart(weakRound(), { mode: "focused", label: "薄弱细分项特训", again: weakRound });

  /* catalog */
  const hay = useMemo(() => new Map(data.points.map((p) => [p.id, pointHaystack(p)])), [data]);
  const q = searchNorm(query.trim());
  const shown = useMemo(() => (q ? data.points.filter((p) => hay.get(p.id)!.includes(q)) : data.points), [q, data, hay]);
  const groups = useMemo((): { key: string; title: string; hint?: string; list: GrammarPoint[] }[] => {
    if (view === "category") {
      const g = GRAMMAR_CATEGORIES.map((c) => ({ key: c, title: GRAMMAR_CATEGORY_LABEL[c], list: shown.filter((p) => p.category === c) }));
      return [...g, { key: "other", title: "其他语法点", list: shown.filter((p) => !p.category) }].filter((x) => x.list.length);
    }
    if (view === "todo") {
      const dueSet = new Set(due);
      const weakPoint = (p: GrammarPoint) =>
        !!progress.gram?.[p.id] &&
        !dueSet.has(p.id) &&
        tagsOf(p).some((t) => {
          const s = progress.gramTags?.[tagKey(p.id, t)];
          const r = errRate(s);
          return r !== null && (s?.n ?? 0) >= 2 && r >= 0.4;
        });
      return [
        { key: "due", title: "该复习了", hint: "到期或作文里又错了", list: shown.filter((p) => dueSet.has(p.id)) },
        { key: "weak", title: "还没掌握", hint: "有细分项错误率 ≥ 40%", list: shown.filter(weakPoint) },
        { key: "new", title: "还没开始", list: shown.filter((p) => !progress.gram?.[p.id]) },
      ].filter((x) => x.list.length);
    }
    return orderedLevels
      .map((lv) => ({
        key: lv,
        title: lv === priorityLevel ? `${lv} · 当前起点` : lv,
        hint: `${data.points.filter((p) => p.level === lv && progress.gram?.[p.id]).length} / ${data.points.filter((p) => p.level === lv).length} 已开始`,
        list: shown.filter((p) => p.level === lv),
      }))
      .filter((x) => x.list.length);
  }, [view, shown, due, progress.gram, progress.gramTags, orderedLevels, priorityLevel, data.points]);

  return (
    <div className="page gram gram-home">
      <header className="page-head">
        {tabs}
        <p className="eyebrow">语法 · Grammaire</p>
        <h1 className="display">规则，要在句子里练。</h1>
        <p className="lede">
          每个语法点都有精讲、判断顺序、规律表和正误对比；练习覆盖它的每条规则和每个易错点。一轮做错得多，就会更早回来；哪一部分常错，那一部分就出得多。
        </p>
      </header>
      <div className="gram-home-grid">
        <section className="gram-actions" aria-label="今天练什么">
          <div className="panel gram-act-main">
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
              <a className="btn btn-primary btn-xl" href={`#/grammar?p=${next.id}`}>
                推荐新学：{next.level} · {next.title} <ArrowRight size={18} />
              </a>
            ) : (
              <p className="muted">所有语法点都在复习计划里了，今天没有到期的。</p>
            )}
            {due.length > 0 && next && (
              <p className="muted small">
                下一个推荐新学（{next.level}）：{" "}
                <a className="link" href={`#/grammar?p=${next.id}`}>
                  {next.title}
                </a>
              </p>
            )}
            {weakTags.length > 0 && (
              <div className="gram-weak-box">
                <p className="gram-box-title">
                  <Flame size={15} /> 薄弱细分项特训
                </p>
                <ul>
                  {weakTags.slice(0, 3).map(({ point, tag, rate }) => (
                    <li key={point.id + tag}>
                      <a className="link" href={`#/grammar?p=${point.id}&section=${tag.startsWith("r") ? tag : "traps"}`}>
                        {tagLabel(point, tag) || tagNumber(tag)}
                      </a>
                      <small>
                        {point.title} · 错 {Math.round(rate * 100)}%
                      </small>
                    </li>
                  ))}
                </ul>
                <button type="button" className="btn btn-ghost btn-sm" onClick={startWeak}>
                  <Target size={15} /> 合成一轮特训（{weakTags.length} 项）
                </button>
              </div>
            )}
            {fresh.length > 0 && (
              <div className="gram-fresh">
                <p className="muted small">批改纠错里出现过、还没开始练的语法点：</p>
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
          </div>

          <a className="gram-hub-link" href="#/grammar?sheet=1">
            <Columns3 size={20} />
            <span>
              <b>语法规律总表 &amp; 易混辨析中心</b>
              <small>
                {data.matrices?.length ? `${data.matrices.length} 张横向对比表 · ` : ""}全部语法点的口诀与判断顺序 · 可打印
              </small>
            </span>
            <ArrowRight size={17} />
          </a>

          <div className="panel gram-discourse-box">
            <div className="gram-discourse-head">
              <h2 className="eyebrow">
                <Clock size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                TCF / TEF 限时语言结构冲刺
              </h2>
              {(examTrack === "tcf" || examTrack === "tef") && (
                <span className="chip chip-status is-done">当前轨道：{TRACK_META[examTrack].shortName}</span>
              )}
            </div>
            <p className="muted small">全真倒计时 + 排除干扰项 + 699 分制与 NCLC 换算；错题自动排入对应语法点复习。</p>
            <div className="chips">
              <button
                type="button"
                className={`btn btn-sm ${examTrack === "tef" ? "btn-ghost" : "btn-primary"}`}
                onClick={() => go({ page: "grammar", sprint: "tcf" })}
              >
                TCF（18 题 · 15:00）
                {latestStructLog.tcf?.scaledScore !== undefined && ` · 最近 ${latestStructLog.tcf.scaledScore}`}
                <ArrowRight size={15} />
              </button>
              <button
                type="button"
                className={`btn btn-sm ${examTrack === "tef" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => go({ page: "grammar", sprint: "tef" })}
              >
                TEF（40 题 · 30:00）
                {latestStructLog.tef?.scaledScore !== undefined && ` · 最近 ${latestStructLog.tef.scaledScore}`}
                <ArrowRight size={15} />
              </button>
            </div>
          </div>

          <div className="panel gram-discourse-box">
            <div className="gram-discourse-head">
              <h2 className="eyebrow">语篇综合训练 · {DISCOURSE_EXERCISES.length} 篇</h2>
              <span className="muted small">跨句时态与改错，提交即同步掌握度</span>
            </div>
            <div className="chips" role="group" aria-label="语篇筛选">
              {(
                [
                  ["all", `全部 ${DISCOURSE_EXERCISES.length}`],
                  ["b2", `B2 核心 ${b2Count}`],
                  ["fix", `改错 ${fixCount}`],
                  ["todo", `未练 ${todoCount}`],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className={`chip-btn ${discFilter === k ? "is-on" : ""}`}
                  aria-pressed={discFilter === k}
                  onClick={() => setDiscFilter(k)}
                >
                  {label}
                </button>
              ))}
            </div>
            {filteredDiscourse.length === 0 ? (
              <p className="muted small">该筛选下暂无篇章。</p>
            ) : (
              <>
                <ul className="gram-discourse-list">
                  {visibleDiscourse.map((ex) => (
                    <li key={ex.id}>
                      <button type="button" className="gram-discourse-item" onClick={() => onDiscourse(ex)}>
                        <span>
                          <span>
                            <span className="chip">{ex.level}</span> {ex.kind === "fix" && <span className="chip">改错</span>}{" "}
                            {isPassagePractised(ex) && <span className="chip chip-status is-done">已练</span>} <b>{ex.title}</b>
                          </span>
                          <small>{ex.subtitle}</small>
                        </span>
                        <ArrowRight size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
                {filteredDiscourse.length > 6 && (
                  <button type="button" className="link small" onClick={() => setExpandAllDisc((v) => !v)}>
                    {expandAllDisc ? "收起" : `展开其余 ${filteredDiscourse.length - 6} 篇`}
                  </button>
                )}
              </>
            )}
          </div>
        </section>

        <section className="gram-catalog" aria-label="语法目录">
          <div className="gram-catalog-tools">
            <label className="gram-search">
              <Search size={16} aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜标题、法语术语、口诀、连词或代词…"
                aria-label="搜索语法点"
              />
              {query && (
                <button type="button" className="gram-search-clear" onClick={() => setQuery("")} aria-label="清空搜索">
                  <X size={14} />
                </button>
              )}
            </label>
            <div className="segmented gram-view-switch" role="group" aria-label="目录视图">
              {(
                [
                  ["level", "按等级"],
                  ["category", "按专题"],
                  ["todo", "待复习"],
                ] as const
              ).map(([k, label]) => (
                <button key={k} type="button" className={view === k ? "is-on" : ""} aria-pressed={view === k} onClick={() => setView(k)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {q && <p className="muted small gram-search-count">找到 {shown.length} 个语法点</p>}
          {groups.length === 0 && (
            <p className="muted gram-empty">
              {q ? "没有匹配的语法点，换个关键词试试（支持不带重音输入）。" : view === "todo" ? "没有待复习或未掌握的语法点。" : "暂无语法点。"}
            </p>
          )}
          {groups.map((g) => (
            <section key={g.key} className="gram-group">
              <header className="gram-group-head">
                <h2 className="eyebrow">{g.title}</h2>
                <small className="muted">{g.hint ?? `${g.list.length} 个`}</small>
              </header>
              <ul className="gram-list">
                {g.list.map((p) => (
                  <li key={p.id}>
                    <PointCard point={p} card={progress.gram?.[p.id]} now={now} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </section>
      </div>
    </div>
  );
}

function PointCard({ point, card, now }: { point: GrammarPoint; card: { due: number } | undefined; now: number }) {
  const st = status(card, now);
  return (
    <a className="gram-card" href={`#/grammar?p=${point.id}`}>
      <span className="gram-card-top">
        <span className="gram-lv">{point.level}</span>
        {point.category && <span className="gram-cat">{GRAMMAR_CATEGORY_LABEL[point.category]}</span>}
        <span className={`gram-status ${st.cls}`}>{st.label}</span>
      </span>
      <span className="gram-card-title">{point.title}</span>
      <small className="gram-card-fr" lang="fr">
        {point.fr}
      </small>
      {point.motto && <span className="gram-card-motto">{stripGrammarMarks(point.motto)}</span>}
      <small className="gram-count">{point.drills.length} 题</small>
    </a>
  );
}

/* ---------- 语法规律总表 & 易混辨析中心 ---------- */

export function CheatSheet({ data, section }: { data: GrammarData; section?: string }) {
  const matrices = useMemo(() => data.matrices ?? [], [data.matrices]);
  const matrixOf = useCallback(
    (sec: string | undefined) => (sec ? matrices.find((m) => m.id === sec || `mat-${m.id}` === sec || m.id === sec.replace(/^mat-/, "")) : undefined),
    [matrices],
  );
  const [tab, setTab] = useState<"matrix" | "points">(() => (matrices.length && (!section || matrixOf(section)) ? "matrix" : "points"));
  const [open, setOpen] = useState<Set<string>>(() => new Set(matrixOf(section) ? [matrixOf(section)!.id] : []));
  const [cat, setCat] = useState<GrammarCategory | "all">("all");
  const [mq, setMq] = useState("");
  const [level, setLevel] = useState<"all" | (typeof LEVELS)[number]>("all");
  const [query, setQuery] = useState("");
  const [showPairs, setShowPairs] = useState(false);

  // a deep link to a matrix opens its tab and the matrix, then scrolls to it
  useEffect(() => {
    const m = matrixOf(section);
    if (m) {
      setTab("matrix");
      setOpen((s) => (s.has(m.id) ? s : new Set([...s, m.id])));
    } else if (section) setTab("points");
    const raf = requestAnimationFrame(() => {
      if (!scrollToSection(section)) window.scrollTo({ top: 0 });
    });
    return () => cancelAnimationFrame(raf);
  }, [section, matrixOf]);

  const cats = useMemo(() => GRAMMAR_CATEGORIES.filter((c) => matrices.some((m) => m.category === c)), [matrices]);
  const mqn = searchNorm(mq.trim());
  const shownMatrices = matrices.filter(
    (m) =>
      (cat === "all" || m.category === cat) &&
      (!mqn ||
        searchNorm(
          [
            m.title,
            m.fr,
            m.summary,
            m.motto ?? "",
            ...(m.tables ?? []).flatMap((t) => [t.title, ...t.headers, ...t.rows.flat()]),
            ...(m.headers ?? []),
            ...(m.rows?.flat() ?? []),
            ...(m.decide ?? []),
            ...m.points.map((id) => titleOf(data, id)),
          ].join(" "),
        ).includes(mqn)),
  );

  const q = searchNorm(query.trim());
  const matches = (p: GrammarPoint) =>
    !q ||
    searchNorm(
      [p.title, p.fr, p.motto ?? "", ...(p.decide ?? []), ...p.rules.map((r) => r.h), ...p.traps, ...(p.pairs ?? []).flatMap((x) => [x.a, x.b, x.d])].join(" "),
    ).includes(q);
  const levels = level === "all" ? LEVELS : ([level] as const);
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="page gram gram-sheet">
      <header className="page-head">
        <button className="link deck-back" onClick={() => go({ page: "grammar" })}>
          <ArrowLeft size={16} /> 全部语法点
        </button>
        <p className="eyebrow">语法 · 总表与辨析</p>
        <h1 className="display">语法规律总表 &amp; 易混辨析中心</h1>
        <p className="lede">易混的语法点放在一张表里横向比；每个语法点一句口诀、几步判断。考前翻一遍，做题时照着问。</p>
        <div className="segmented gram-sheet-tabs" role="tablist" aria-label="总表视图">
          <button role="tab" aria-selected={tab === "matrix"} className={tab === "matrix" ? "is-on" : ""} onClick={() => setTab("matrix")}>
            <Columns3 size={15} /> 核心易混横向对比{matrices.length ? `（${matrices.length}）` : ""}
          </button>
          <button role="tab" aria-selected={tab === "points"} className={tab === "points" ? "is-on" : ""} onClick={() => setTab("points")}>
            <ListOrdered size={15} /> 全部口诀 &amp; 判断顺序
          </button>
        </div>
      </header>

      {tab === "matrix" ? (
        <section className="gram-matrices" aria-label="易混横向对比表">
          {matrices.length === 0 ? (
            <p className="muted gram-empty">横向对比表正在整理中。先用「全部口诀 &amp; 判断顺序」复习吧。</p>
          ) : (
            <>
              <div className="gram-sheet-tools">
                <label className="gram-search">
                  <Search size={16} aria-hidden />
                  <input type="search" value={mq} onChange={(e) => setMq(e.target.value)} placeholder="搜对比表：连词、代词、时态…" aria-label="搜索对比表" />
                </label>
                {cats.length > 1 && (
                  <div className="chips" role="group" aria-label="按专题筛选">
                    <button type="button" className={`chip-btn ${cat === "all" ? "is-on" : ""}`} aria-pressed={cat === "all"} onClick={() => setCat("all")}>
                      全部专题
                    </button>
                    {cats.map((c) => (
                      <button key={c} type="button" className={`chip-btn ${cat === c ? "is-on" : ""}`} aria-pressed={cat === c} onClick={() => setCat(c)}>
                        {GRAMMAR_CATEGORY_LABEL[c]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {shownMatrices.length === 0 && <p className="muted gram-empty">没有匹配的对比表。</p>}
              {shownMatrices.map((m) => (
                <MatrixCard key={m.id} data={data} matrix={m} open={open.has(m.id)} onToggle={() => toggle(m.id)} />
              ))}
            </>
          )}
        </section>
      ) : (
        <section aria-label="口诀与判断顺序">
          <div className="gram-sheet-tools">
            <label className="gram-search">
              <Search size={16} aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜语法点、关键词、连词、代词…"
                aria-label="搜索速查表"
              />
            </label>
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
          {levels.map((lv) => {
            const list = data.points.filter((p) => p.level === lv && (p.motto || p.decide?.length) && matches(p));
            if (!list.length) return null;
            return (
              <section key={lv} className="gram-sheet-level">
                <h2 className="eyebrow">{lv}</h2>
                {list.map((p) => (
                  <article key={p.id} id={`gram-sheet-${p.id}`} className="gram-sheet-item">
                    <h3>
                      <a href={`#/grammar?p=${p.id}`}>{p.title}</a>
                      {p.category && <span className="gram-cat">{GRAMMAR_CATEGORY_LABEL[p.category]}</span>}
                    </h3>
                    {p.motto && (
                      <p className="gram-motto">
                        <RichGrammarText text={p.motto} />
                      </p>
                    )}
                    {p.decide && p.decide.length > 0 && (
                      <ol className="gram-decide">
                        {p.decide.map((d) => (
                          <li key={d}>
                            <RichGrammarText text={d} />
                          </li>
                        ))}
                      </ol>
                    )}
                    {showPairs && p.pairs && p.pairs.length > 0 && (
                      <ul className="gram-sheet-pairs">
                        {p.pairs.map((x) => (
                          <li key={x.a + x.b}>
                            <span lang="fr">
                              <RichGrammarText text={x.a} />
                            </span>{" "}
                            /{" "}
                            <span lang="fr">
                              <RichGrammarText text={x.b} />
                            </span>{" "}
                            — <small>{stripGrammarMarks(x.d)}</small>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </section>
            );
          })}
        </section>
      )}
    </div>
  );
}

function MatrixCard({ data, matrix: m, open, onToggle }: { data: GrammarData; matrix: GrammarMatrix; open: boolean; onToggle: () => void }) {
  const extra = (m.decide?.length ?? 0) + (m.pitfalls?.length ?? 0) > 0;
  const tables =
    m.tables && m.tables.length > 0
      ? m.tables
      : m.headers && m.rows
        ? [{ title: "横向对比", headers: m.headers, rows: m.rows }]
        : [];
  return (
    <article id={`gram-mat-${m.id}`} className="panel gram-matrix">
      <header className="gram-matrix-head">
        <p className="gram-card-top">
          <span className="gram-lv">{m.level}</span>
          <span className="gram-cat">{GRAMMAR_CATEGORY_LABEL[m.category]}</span>
        </p>
        <h2>
          {m.title} <small lang="fr">{m.fr}</small>
        </h2>
        <p className="gram-matrix-summary">
          <RichGrammarText text={m.summary} />
        </p>
        {m.motto && (
          <p className="gram-motto">
            <RichGrammarText text={m.motto} />
          </p>
        )}
      </header>
      {tables.map((tbl, idx) => (
        <GrammarTableView key={`${tbl.title}-${idx}`} table={tbl} />
      ))}
      {extra && (
        <button type="button" className="link gram-matrix-toggle" aria-expanded={open} onClick={onToggle}>
          <ChevronDown size={15} className={open ? "is-flipped" : ""} /> {open ? "收起判断步骤与正误对比" : "展开判断步骤与正误对比"}
        </button>
      )}
      {open && extra && (
        <div className="gram-matrix-more">
          {m.decide && m.decide.length > 0 && <DecideTimeline steps={m.decide} />}
          {m.pitfalls && m.pitfalls.length > 0 && <PitfallList pitfalls={m.pitfalls} />}
        </div>
      )}
      <p className="gram-matrix-links">
        <span className="muted small">关联语法点：</span>
        {m.points.map((id) => (
          <a key={id} className="chip" href={`#/grammar?p=${id}`}>
            {titleOf(data, id)}
          </a>
        ))}
      </p>
    </article>
  );
}

/** Decision steps as a numbered timeline: the question before « → », the conclusion after it. */
function DecideTimeline({ steps }: { steps: readonly string[] }) {
  return (
    <ol className="gram-timeline">
      {steps.map((d, i) => {
        const cut = d.indexOf("→");
        const ask = cut >= 0 ? d.slice(0, cut).trim() : d;
        const then = cut >= 0 ? d.slice(cut + 1).trim() : "";
        return (
          <li key={i}>
            <span className="gram-tl-num" aria-hidden>
              {i + 1}
            </span>
            <div>
              <p className="gram-tl-ask">
                <RichGrammarText text={ask} />
              </p>
              {then && (
                <p className="gram-tl-then">
                  <ArrowRight size={14} aria-hidden /> <RichGrammarText text={then} />
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- one point ---------- */

interface Section {
  id: string;
  label: string;
}

const LazyWordPopup = lazy(() => import("../../ui/WordPopup").then((m) => ({ default: m.WordPopup })));

/**
 * A rule's French examples with tap/select-to-lookup (LexDB). The popup listens on this list only: formulas,
 * tables and the drill buttons keep their own behaviour, and the card is portaled so the layout never changes.
 */
function ExampleList({ examples }: { examples: GrammarPoint["rules"][number]["ex"] }) {
  const ref = useRef<HTMLUListElement>(null);
  return (
    <>
      <ul className="gram-examples" ref={ref}>
        {examples.map((ex, k) => (
          <li key={k}>
            <p className="gram-ex-fr">
              <RichGrammarText text={ex[0]} lang="fr" />
              <Speak url={null} text={stripGrammarMarks(ex[0])} size="sm" />
            </p>
            <small className="gram-ex-zh">{ex[1]}</small>
            {ex[2] && (
              <span className="gram-ex-break">
                <b>结构</b> <RichGrammarText text={ex[2]} />
              </span>
            )}
          </li>
        ))}
      </ul>
      <Suspense fallback={null}>
        <LazyWordPopup containerRef={ref} />
      </Suspense>
    </>
  );
}

export function PointView({ data, point, section, onStart }: { data: GrammarData; point: GrammarPoint; section?: string; onStart: StartRound }) {
  const progress = useStoreShallow((s) => ({
    gram: s.progress.gram,
    gramTags: s.progress.gramTags,
    gramSkip: s.progress.gramSkip,
    essayNotes: s.progress.essayNotes,
    essays: s.progress.essays,
    speakCorrections: s.progress.speakCorrections,
  }));
  const card = progress.gram?.[point.id];
  const st = status(card, Date.now());
  const errors = useMemo(() => essayErrors(progress).get(point.id) ?? [], [progress, point.id]);
  const mine = useMemo(() => mineDrills(errors), [errors]);
  const missing = missingPrereqs(data, point, progress);
  const [jumpOpen, setJumpOpen] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (!scrollToSection(section)) window.scrollTo({ top: 0 });
    });
    return () => cancelAnimationFrame(raf);
  }, [point.id, section]);

  /** Start a round: a whole-point one, or one filtered to a tag / a kind (focused). */
  const startWith = useCallback(
    (filter: DrillFilter | undefined, n = ROUND) => {
      const focused = !!(filter?.tag || filter?.kind);
      const draw = () =>
        pickDrills(point, store.get().progress, n, Date.now(), mine, filter).map((drill) => ({ point: point.id, drill }));
      const label = filter?.tag
        ? `${tagNumber(filter.tag)} · ${tagLabel(point, filter.tag)}`
        : filter?.kind
          ? `${KIND_LABEL[filter.kind]}题专项`
          : undefined;
      onStart(draw(), { mode: focused ? "focused" : "round", label, again: draw });
    },
    [point, mine, onStart],
  );
  const drillTag = useCallback((tag: string) => startWith({ tag }), [startWith]);
  const tagCount = useCallback(
    (tag: string) => countMatchingDrills(point, progress, [], { tag }),
    [point, progress],
  );

  const tablesFor = (i: number) => (point.tables ?? []).filter((t) => t.tag === `r${i}`);
  const looseTables = (point.tables ?? []).filter((t) => !t.tag || !/^r\d+$/.test(t.tag) || Number(t.tag.slice(1)) >= point.rules.length);
  const showLegend = useMemo(() => pointHasMarks(point), [point]);

  const sections: Section[] = [
    ...(point.decide?.length ? [{ id: "decide", label: "判断顺序" }] : []),
    ...point.rules.map((r, i) => ({ id: `r${i}`, label: `${String(i + 1).padStart(2, "0")} ${stripGrammarMarks(r.h)}` })),
    ...(looseTables.length ? [{ id: "tables", label: "规律总表" }] : []),
    ...(point.exceptions?.length ? [{ id: "exceptions", label: "高频例外" }] : []),
    ...(point.pairs?.length ? [{ id: "pairs", label: "最小对比" }] : []),
    ...(point.walk ? [{ id: "walk", label: "逐句拆解" }] : []),
    ...(point.traps.length || point.pitfalls?.length ? [{ id: "traps", label: "易错与正误对比" }] : []),
    ...(errors.length ? [{ id: "mine", label: "我的错句" }] : []),
    { id: "practice", label: "专项练习" },
  ];
  const jump = (id: string) => {
    setJumpOpen(false);
    if (id === section) scrollToSection(id);
    else go({ page: "grammar", p: point.id, section: id }, null, true);
  };
  const quickStart = () => startWith(undefined);
  const canPractise = point.drills.length + mine.length > 0;

  return (
    <div className="page gram gram-point">
      <header className="page-head gram-point-head">
        <button className="link deck-back" onClick={() => go({ page: "grammar" })}>
          <ArrowLeft size={16} /> 全部语法点
        </button>
        <p className="gram-card-top">
          <span className="gram-lv">{point.level}</span>
          {point.category && <span className="gram-cat">{GRAMMAR_CATEGORY_LABEL[point.category]}</span>}
          <span className={`gram-status ${st.cls}`}>{st.label}</span>
        </p>
        <p className="eyebrow" lang="fr">
          {point.fr}
        </p>
        <h1 className="display gram-title">{point.title}</h1>
        <p className="lede gram-intro">
          <RichGrammarText text={point.intro} />
        </p>
        {point.motto && (
          <p className="gram-motto gram-motto-banner">
            <Lightbulb size={17} aria-hidden />
            <span>
              <RichGrammarText text={point.motto} />
            </span>
          </p>
        )}
        {showLegend && <MarkLegend />}
      </header>

      <div className="gram-mobile-bar">
        <button type="button" className="btn btn-primary" onClick={quickStart} disabled={!canPractise}>
          立即练本点 <ArrowRight size={16} />
        </button>
        <button type="button" className="btn btn-ghost" aria-expanded={jumpOpen} onClick={() => setJumpOpen((v) => !v)}>
          <BookOpen size={15} /> 章节跳转 <ChevronDown size={15} className={jumpOpen ? "is-flipped" : ""} />
        </button>
        {jumpOpen && (
          <nav className="gram-jump" aria-label="章节快速跳转">
            {sections.map((s) => (
              <button key={s.id} type="button" className={s.id === section ? "is-on" : ""} onClick={() => jump(s.id)}>
                {s.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      <div className="gram-detail-layout">
        <article className="gram-read">
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
            <section id="gram-sec-decide" className="gram-sec gram-decide-card">
              <h2 className="gram-sec-title">遇到这类句子，按这个顺序判断</h2>
              <DecideTimeline steps={point.decide} />
            </section>
          )}

          {point.rules.map((r, i) => {
            const tag = `r${i}`;
            const n = tagCount(tag);
            return (
              <section key={i} id={`gram-sec-${tag}`} className="gram-sec gram-rule-card">
                <header className="gram-rule-head">
                  <span className="gram-rule-num">规则 {String(i + 1).padStart(2, "0")}</span>
                  <h2>
                    <RichGrammarText text={r.h} />
                  </h2>
                  {n > 0 && (
                    <button type="button" className="btn btn-ghost btn-sm gram-rule-drill" onClick={() => drillTag(tag)} title={`共 ${n} 题`}>
                      <Target size={14} /> 单练此条
                    </button>
                  )}
                </header>
                <p className="gram-rule-text">
                  <RichGrammarText text={r.text} />
                </p>
                {r.formula && r.formula.length > 0 && <FormulaBlock formulas={r.formula} />}
                {tablesFor(i).map((t, k) => (
                  <GrammarTableView key={k} table={t} />
                ))}
                {r.ex.length > 0 && <ExampleList examples={r.ex} />}
              </section>
            );
          })}

          {looseTables.length > 0 && (
            <section id="gram-sec-tables" className="gram-sec gram-tables">
              <h2 className="gram-sec-title">规律总表</h2>
              {looseTables.map((t, k) => (
                <GrammarTableView key={k} table={t} />
              ))}
            </section>
          )}

          {point.exceptions && point.exceptions.length > 0 && (
            <section id="gram-sec-exceptions" className="gram-sec gram-exceptions">
              <h2 className="gram-sec-title">高频例外速记</h2>
              <ul>
                {point.exceptions.map((x, k) => (
                  <li key={k}>
                    <RichGrammarText text={x} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {point.pairs && point.pairs.length > 0 && (
            <section id="gram-sec-pairs" className="gram-sec gram-pairs">
              <h2 className="gram-sec-title">最小对比：只差一处，答案就变</h2>
              <ul>
                {point.pairs.map((p) => (
                  <li key={p.a + p.b}>
                    <p lang="fr">
                      <span className="gram-pair-tag">A</span>
                      <RichGrammarText text={p.a} className="gram-pair-s" />
                      <Speak url={null} text={stripGrammarMarks(p.a)} size="sm" />
                    </p>
                    <p lang="fr">
                      <span className="gram-pair-tag">B</span>
                      <RichGrammarText text={p.b} className="gram-pair-s" />
                      <Speak url={null} text={stripGrammarMarks(p.b)} size="sm" />
                    </p>
                    <small>
                      <RichGrammarText text={p.d} />
                    </small>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {point.walk && (
            <section id="gram-sec-walk" className="gram-sec gram-walk">
              <h2 className="gram-sec-title">一步步拆一句</h2>
              <p className="gram-walk-s">
                <RichGrammarText text={point.walk.s} lang="fr" />
                <Speak url={null} text={stripGrammarMarks(point.walk.s)} size="sm" />
              </p>
              <p className="muted">{point.walk.z}</p>
              <ol className="gram-walk-steps">
                {point.walk.steps.map(([q, a], k) => (
                  <li key={k}>
                    <span className="gram-walk-q">
                      <RichGrammarText text={q} />
                    </span>
                    <span className="gram-walk-a">
                      <RichGrammarText text={a} />
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {(point.traps.length > 0 || (point.pitfalls?.length ?? 0) > 0) && (
            <section id="gram-sec-traps" className="gram-sec gram-traps-sec">
              <h2 className="gram-sec-title">易错陷阱与正误对比</h2>
              {point.traps.length > 0 && (
                <ul className="gram-trap-list">
                  {point.traps.map((t, k) => {
                    const tag = `t${k}`;
                    const n = tagCount(tag);
                    return (
                      <li key={k}>
                        <span className="gram-trap-num">{String(k + 1).padStart(2, "0")}</span>
                        <span>
                          <RichGrammarText text={t} />
                        </span>
                        {n > 0 && (
                          <button type="button" className="link small" onClick={() => drillTag(tag)}>
                            单练
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {point.pitfalls && <PitfallList pitfalls={point.pitfalls} onDrillTag={drillTag} canDrill={(t) => tagCount(t) > 0} />}
            </section>
          )}

          {errors.length > 0 && (
            <section id="gram-sec-mine" className="gram-sec gram-mine">
              <h2 className="gram-sec-title">你在作文或口语里错过</h2>
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
              <p className="muted small">练习时会夹进这些句子，让你自己改。</p>
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

          <div className="gram-read-end">
            <p>读完了？趁热练一轮，错的地方会自动多出题。</p>
            <button type="button" className="btn btn-primary" onClick={quickStart} disabled={!canPractise}>
              练 {Math.min(ROUND, point.drills.length + mine.length)} 题 <ArrowRight size={16} />
            </button>
          </div>
        </article>

        <aside className="gram-side">
          <nav className="gram-toc-card" aria-label="本课目录">
            <p className="gram-box-title">本课目录</p>
            <ol>
              {sections.map((s) => (
                <li key={s.id}>
                  <button type="button" className={s.id === section ? "is-on" : ""} onClick={() => jump(s.id)}>
                    {s.label}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
          <PracticePanel point={point} mine={mine} progress={progress} card={card} statusLabel={st.label} onStart={startWith} />
        </aside>
      </div>
    </div>
  );
}

/** 专项开练台: kind filter, round size, live count, and mastery per rule / trap (each one a focused round). */
function PracticePanel({
  point,
  mine,
  progress,
  card,
  statusLabel,
  onStart,
}: {
  point: GrammarPoint;
  mine: ReturnType<typeof mineDrills>;
  progress: { gramTags?: Record<string, { n: number; w: number }>; gramSkip?: string[] };
  card: { reps: number } | undefined;
  statusLabel: string;
  onStart: (filter: DrillFilter | undefined, n?: number) => void;
}) {
  const [kind, setKind] = useState<Drill["k"] | undefined>(undefined);
  const [size, setSize] = useState(ROUND);
  const kindCounts = useMemo(
    () => KIND_ORDER.map((k) => [k, countMatchingDrills(point, progress, mine, { kind: k })] as const).filter(([, n]) => n > 0),
    [point, progress, mine],
  );
  const available = countMatchingDrills(point, progress, mine, kind ? { kind } : undefined);
  const tags = useMemo(
    () => tagsOf(point).filter((t) => point.drills.some((d) => d.g === t) || Boolean(progress.gramTags?.[tagKey(point.id, t)]?.n)),
    [point, progress.gramTags],
  );
  const practised = tags.filter((t) => progress.gramTags?.[tagKey(point.id, t)]?.n).length;
  const discourse = progress.gramTags?.[tagKey(point.id, "discourse")];
  const discourseRate = discourse?.n ? Math.round((1 - discourse.w / discourse.n) * 100) : null;
  const n = Math.min(size, available);

  return (
    <section id="gram-sec-practice" className="gram-sec gram-practice-panel" aria-label="专项开练台">
      <p className="gram-box-title">专项开练台</p>
      <p className="muted small">
        题库 {point.drills.length} 题 · {statusLabel}
        {card ? ` · 已复习 ${card.reps} 次` : ""}
      </p>
      {kindCounts.length > 1 && (
        <div className="chips gram-kind-filter" role="group" aria-label="题型">
          <button type="button" className={`chip-btn ${!kind ? "is-on" : ""}`} aria-pressed={!kind} onClick={() => setKind(undefined)}>
            全部
          </button>
          {kindCounts.map(([k, c]) => (
            <button key={k} type="button" className={`chip-btn ${kind === k ? "is-on" : ""}`} aria-pressed={kind === k} onClick={() => setKind(k)}>
              {KIND_LABEL[k]} <small>{c}</small>
            </button>
          ))}
        </div>
      )}
      <div className="segmented gram-size" role="group" aria-label="题量">
        {[ROUND, 15].map((s) => (
          <button key={s} type="button" className={size === s ? "is-on" : ""} aria-pressed={size === s} onClick={() => setSize(s)}>
            {s} 题
          </button>
        ))}
      </div>
      {available === 0 ? (
        <div className="gram-empty-filter">
          <p className="muted small">这个题型下暂时没有可练的题。</p>
          <button type="button" className="link small" onClick={() => setKind(undefined)}>
            重置筛选
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-primary gram-practice-go" onClick={() => onStart(kind ? { kind } : undefined, size)}>
          {n < size ? `练这 ${n} 题` : `练 ${n} 题`}
          {kind ? ` · ${KIND_LABEL[kind]}` : ""} <ArrowRight size={16} />
        </button>
      )}

      {tags.length > 0 && (
        <>
          <p className="gram-box-title gram-mastery-title">
            细分掌握度 <small className="muted">已练 {practised} / {tags.length}</small>
          </p>
          <ul className="gram-mastery">
            {tags.map((t) => {
              const s = progress.gramTags?.[tagKey(point.id, t)];
              const rate = s?.n ? Math.round((1 - s.w / s.n) * 100) : null;
              const has = point.drills.some((d) => d.g === t);
              return (
                <li key={t}>
                  <button type="button" onClick={() => onStart({ tag: t })} disabled={!has} title={has ? "专项练这一条" : "暂无题目"}>
                    <span className="gram-mastery-label">
                      <small>{tagNumber(t)}</small>
                      {tagLabel(point, t)}
                    </span>
                    {rate === null ? (
                      <small className="muted">待检验</small>
                    ) : (
                      <span className="gram-mastery-rate">
                        <span className="gram-tag-bar" aria-hidden>
                          <span style={{ width: `${rate}%` }} className={rate < 60 ? "is-weak" : rate < 85 ? "is-mid" : ""} />
                        </span>
                        <small>{rate}%</small>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
            {discourseRate !== null && (
              <li>
                <span className="gram-mastery-static">
                  <span className="gram-mastery-label">
                    <small>语篇</small>跨句综合应用
                  </span>
                  <span className="gram-mastery-rate">
                    <span className="gram-tag-bar" aria-hidden>
                      <span style={{ width: `${discourseRate}%` }} className={discourseRate < 60 ? "is-weak" : discourseRate < 85 ? "is-mid" : ""} />
                    </span>
                    <small>{discourseRate}%</small>
                  </span>
                </span>
              </li>
            )}
          </ul>
        </>
      )}
    </section>
  );
}
