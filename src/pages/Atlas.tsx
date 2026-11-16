import { FamilyPicker } from "../ui/FamilyPicker";
import { familyWords, familiesFor } from "../lib/families";
import { ChevronDown, Check, Grid3x3, GraduationCap, Layers, List, Search, Sparkles, X } from "lucide-react";
import { Galaxy } from "../galaxy/Galaxy";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAtlas } from "../atlas/context";
import type { WordRef } from "../atlas/types";
import { morphFrom } from "../lib/motion";
import { go, openWord, type Route } from "../lib/router";
import { isMastered } from "../store/srs";
import { CORE_DECK, store, useStore } from "../store/store";
import { Illustration, plateArticle } from "../ui/Illustration";
import { searchAtlas } from "../lib/search";
import { CORE_NAME, deckWords } from "../store/decks";
import { Speak } from "../ui/Speak";
import { matchesPos, POS_OPTIONS } from "../lib/pos";

type Status = "all" | "new" | "learning" | "mastered" | "saved";
const STATUS: [Status, string][] = [
  ["all", "全部"],
  ["new", "未学"],
  ["learning", "学习中"],
  ["mastered", "已掌握"],
  ["saved", "收藏"],
];

type View = "grid" | "list" | "galaxy";
function readView(): View {
  try {
    const v = localStorage.getItem("word-atlas:view");
    return v === "list" || v === "galaxy" ? v : "grid";
  } catch {
    return "grid";
  }
}

export function AtlasPage({
  route,
}: {
  route: Extract<Route, { page: "atlas" }>;
}) {
  const atlas = useAtlas();
  const progress = useStore((s) => s.progress);
  const { cards, bookmarks } = progress;
  const decks = progress.decks;
  const deckCount = decks?.length ?? 0;
  const deck = decks?.find((d) => d.id === route.d);
  const deckId = route.d === "all" ? "all" : deck?.id ?? (decks?.some(d=>d.id===CORE_DECK) ? CORE_DECK : "all");
  const deckName = deckId === "all" ? "全部单词" : decks?.find(d=>d.id===deckId)?.name ?? CORE_NAME;
  const hidden = progress.hidden;
  const coreMigrated = progress.coreMigrated;
  const words = useMemo(
    () => deckId === "all"
      ? [...atlas.words, ...(atlas.custom ?? [])]
      : deckWords(atlas, { decks, hidden, coreMigrated }, deckId).map((id) => atlas.byId.get(id)!),
    [atlas, decks, hidden, coreMigrated, deckId],
  );
  const [q, setQ] = useState(route.q ?? "");
  const [status, setStatus] = useState<Status>("all");
  const pos = POS_OPTIONS.some(([key]) => key === route.pos) ? route.pos! : "";
  const groups = useMemo(()=>familiesFor(atlas,progress),[atlas,progress]);
  const families = useMemo(() => route.families?.split(",") ?? [], [route.families]);
  const scopedWords = useMemo(() => { const members = familyWords(families,groups); return words.filter((w) => matchesPos(w.pos, pos) && (!members || members.has(w.id))); }, [words, pos, families, groups]);
  useEffect(() => setQ(route.q ?? ""), [route.q]);
  const [view, setViewState] = useState<View>(() =>
    route.view === "galaxy" || route.view === "list" || route.view === "grid"
      ? route.view
      : readView(),
  );
  // Follow the URL when a link switches views while this page is already open.
  useEffect(() => {
    if (route.view === "grid" || route.view === "list" || route.view === "galaxy") setViewState(route.view);
  }, [route.view]);
  const setView = (v: View) => {
    setViewState(v);
    go(
      {
        page: "atlas",
        d: deckId,
        families: route.families,
        pos: pos || undefined,
        q: q || undefined,
        topic: route.topic,
        level: route.level,
        view: v === "grid" ? undefined : v,
      },
      null,
      true,
    );
  };
  const topic = route.topic;
  const level = route.level;

  useEffect(() => {
    try {
      localStorage.setItem("word-atlas:view", view);
    } catch {
      /* optional */
    }
  }, [view]);

  const list = useMemo(() => {
    const saved = new Set(bookmarks);
    const ti = topic ? atlas.topics.findIndex((t) => t[0] === topic) : -1;
    const li = level ? atlas.cefr.indexOf(level) : -1;
    const base = q.trim() ? searchAtlas({ words: scopedWords }, q, scopedWords.length) : scopedWords;
    return base.filter((w) => {
      if (ti >= 0 && w.topic !== ti) return false;
      if (li >= 0 && w.cefr !== li) return false;
      const c = cards[w.id];
      if (status === "new") return !c;
      if (status === "learning") return !!c && !isMastered(c);
      if (status === "mastered") return isMastered(c);
      if (status === "saved") return saved.has(w.id);
      return true;
    });
  }, [atlas, scopedWords, q, topic, level, status, cards, bookmarks]);

  const setFilter = (patch: Partial<Extract<Route, { page: "atlas" }>>) =>
    go({ page: "atlas", d: deckId, families: route.families, pos: pos || undefined, q: q || undefined, topic, level, view: route.view, ...patch }, null, true);

  return (
    <div className={`page atlas ${view === "galaxy" ? "is-galaxy" : ""}`}>
      <header className="atlas-head">
        <div>
          <p className="eyebrow">图鉴 · {deckName} · {words.length.toLocaleString()} 词</p>
          <h1 className="display">
            每个词，
            <br className="br-sm" />
            都有一个来处。
          </h1>
          <p className="lede">
            {atlas.examples.toLocaleString()} 条例句 · 法语朗读 · 按等级和 {atlas.topics.length} 个主题整理
          </p>
          <a className="btn btn-ghost btn-sm decks-link" href="#/decks">
            <Layers size={16} /> 我的卡组{deckCount ? ` · ${deckCount}` : ""}
          </a>
        </div>
        <label className="search">
          <Search size={19} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索单词或中文释义"
            spellCheck={false}
            autoComplete="off"
          />
          {q && (
            <button
              className="icon-btn"
              onClick={() => setQ("")}
              aria-label="清空搜索"
            >
              <X size={16} />
            </button>
          )}
        </label>
      </header>

      <div className="filters">
        <div className="chips chips-scroll atlas-decks" role="group" aria-label="图鉴卡组">
          {[...(decks ?? []), { id: "all", name: "全部单词" }].map((d) => (
            <button
              key={d.id}
              className={`chip-btn ${deckId === d.id ? "is-on" : ""}`}
              aria-pressed={deckId === d.id}
              onClick={() => setFilter({ d: d.id })}
            >
              <Layers size={14} /> {d.name}
            </button>
          ))}
        </div>
        {view !== "galaxy" && (
          <>
            <div className="chips chips-scroll" role="group" aria-label="难度">
              <button
                className={`chip-btn ${!level ? "is-on" : ""}`}
                onClick={() => setFilter({ level: undefined })}
              >
                所有难度
              </button>
              {atlas.cefr.map((l, i) => atlas.words.some((w) => w.cefr === i) && (
                <button
                  key={l}
                  className={`chip-btn lv lv-${l} ${level === l ? "is-on" : ""}`}
                  onClick={() =>
                    setFilter({ level: level === l ? undefined : l })
                  }
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="chips chips-scroll" role="group" aria-label="主题">
              <button
                className={`chip-btn ${!topic ? "is-on" : ""}`}
                onClick={() => setFilter({ topic: undefined })}
              >
                所有主题
              </button>
              {atlas.topics.map(([k, name]) => (
                <button
                  key={k}
                  className={`chip-btn ${topic === k ? "is-on" : ""}`}
                  onClick={() =>
                    setFilter({ topic: topic === k ? undefined : k })
                  }
                >
                  {name}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="filters-row">
          {view !== "galaxy" && (
            <div className="segmented" role="group" aria-label="学习状态">
              {STATUS.map(([k, label]) => (
                <button
                  key={k}
                  className={status === k ? "is-on" : ""}
                  onClick={() => setStatus(k)}
                  aria-pressed={status === k}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {topic && view !== "galaxy" && <FocusTopicButton topic={topic} />}
          <span className="result-count">
            {view === "galaxy"
              ? "搜索一个词，星图会带你飞过去"
              : `${list.length.toLocaleString()} 个结果`}
          </span>
          <FamilyPicker deckId={deckId} value={families} onChange={(ids, scope) => setFilter({ d: scope ?? deckId, families: ids.join(",") || undefined })} />
          <div className="atlas-pos-wrap">
          <select className={`atlas-pos${pos === "determiner" ? " is-wide" : ""}`} aria-label="词性筛选" value={pos} onChange={(e) => setFilter({ pos: e.target.value || undefined })}>
            <option value="">全部词性</option>
            {POS_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <ChevronDown className="atlas-pos-arrow" size={16} aria-hidden="true" />
          </div>
          <div
            className="segmented segmented-icons"
            role="group"
            aria-label="视图"
          >
            <button
              className={view === "grid" ? "is-on" : ""}
              onClick={() => setView("grid")}
              aria-label="图片视图"
              aria-pressed={view === "grid"}
            >
              <Grid3x3 size={17} />
            </button>
            <button
              className={view === "list" ? "is-on" : ""}
              onClick={() => setView("list")}
              aria-label="列表视图"
              aria-pressed={view === "list"}
            >
              <List size={17} />
            </button>
            <button
              className={view === "galaxy" ? "is-on" : ""}
              onClick={() => setView("galaxy")}
              aria-label="星图视图"
              aria-pressed={view === "galaxy"}
            >
              <Sparkles size={17} />
            </button>
          </div>
        </div>
      </div>

      {scopedWords.length === 0 || (view !== "galaxy" && list.length === 0) ? (
        <div className="empty">
          <img src={`${import.meta.env.BASE_URL}brand/empty.webp`} alt="" />
          <p>{words.length === 0 ? "这个卡组还没有词，先去卡组里添加一些吧。" : "没有符合条件的词。换个筛选条件试试。"}</p>
          {words.length === 0 && <button className="btn btn-ghost" onClick={() => go({ page: "decks", d: deckId === "all" ? undefined : deckId })}>管理卡组</button>}
        </div>
      ) : view === "galaxy" ? (
        <Galaxy mode="full" words={scopedWords} focus={q.trim() ? list[0]?.id : null} />
      ) : view === "grid" ? (
        <VirtualGrid items={list} cards={cards} />
      ) : (
        <VirtualList items={list} cards={cards} />
      )}
    </div>
  );
}

function useWindowRange(
  container: React.RefObject<HTMLDivElement | null>,
  rowHeight: number,
  rows: number,
  overscan = 4,
) {
  const [range, setRange] = useState<[number, number]>([0, 12]);
  useLayoutEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = container.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const first = Math.max(0, Math.floor(-top / rowHeight) - overscan);
      const last = Math.min(
        rows,
        Math.ceil((window.innerHeight - top) / rowHeight) + overscan,
      );
      setRange((r) => (r[0] === first && r[1] === last ? r : [first, last]));
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      cancelAnimationFrame(raf);
    };
  }, [container, rowHeight, rows, overscan]);
  return range;
}

function useWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    setW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function VirtualGrid({
  items,
  cards,
}: {
  items: WordRef[];
  cards: Record<string, { s: number; st: number }>;
}) {
  const atlas = useAtlas();
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  const gap = width < 560 ? 10 : 16;
  const cols = Math.max(
    2,
    Math.floor((width + gap) / ((width < 560 ? 150 : 188) + gap)),
  );
  const cell = (width - gap * (cols - 1)) / cols;
  const rowH = cell + (width < 560 ? 62 : 74) + gap;
  const rows = Math.ceil(items.length / cols);
  const [a, b] = useWindowRange(box, rowH, rows);
  const visible: React.ReactNode[] = [];
  if (width > 0)
    for (let r = a; r < b; r++)
      for (let c = 0; c < cols; c++) {
        const w = items[r * cols + c];
        if (!w) break;
        const card = cards[w.id];
        const st = card
          ? card.st === 2 && card.s >= 21
            ? "is-mastered"
            : "is-learning"
          : "";
        visible.push(
          <button
            key={w.id}
            className={`tile ${st}`}
            style={{
              transform: `translate(${c * (cell + gap)}px, ${r * rowH}px)`,
              width: cell,
              height: rowH - gap,
            }}
            onClick={(e) => morphFrom(e.currentTarget.querySelector<HTMLElement>(".illo"), () => openWord(w.id))}
          >
            <Illustration
              src={atlas.img(w, "thumb")}
              word={w.word}
              topic={w.topic}
              art={plateArticle(w)}
            />
            <span className="tile-no">
              {w.custom ? "自建词" : `№ ${String(w.order + 1).padStart(4, "0")}`}
            </span>
            <span className="tile-text">
              <span className="tile-word" lang="fr">
                {w.word}
              </span>
              <span className={`tile-lv lv-${w.custom ? "mine" : atlas.cefr[w.cefr]}`}>
                {w.custom ? "自建" : atlas.cefr[w.cefr]}
              </span>
              <span className="tile-zh">{w.zh}{w.more && <i className="more-tag" title={w.more.join("；")}>+{w.more.length}</i>}</span>
            </span>
          </button>,
        );
      }
  return (
    <div ref={box} className="vgrid" style={{ height: rows * rowH }}>
      {visible}
    </div>
  );
}

function VirtualList({
  items,
  cards,
}: {
  items: WordRef[];
  cards: Record<string, { s: number; st: number }>;
}) {
  const atlas = useAtlas();
  const accent = useStore((s) => s.settings.accent);
  const box = useRef<HTMLDivElement>(null);
  const rowH = 68;
  const [a, b] = useWindowRange(box, rowH, items.length, 8);
  return (
    <div ref={box} className="vlist" style={{ height: items.length * rowH }}>
      {items.slice(a, b).map((w, i) => {
        const card = cards[w.id];
        return (
          <div
            key={w.id}
            className="row"
            style={{ transform: `translateY(${(a + i) * rowH}px)` }}
            onClick={() => openWord(w.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && openWord(w.id)}
          >
            <Illustration
              src={atlas.img(w, "thumb")}
              word={w.word}
              topic={w.topic}
              art={plateArticle(w)}
              className="row-art"
            />
            <span className="row-word" lang="fr">
              {w.word}
            </span>
            <span className="row-ipa ipa">{w.ipa}</span>
            <span className="row-zh">{w.zh}{w.more && <i className="more-tag" title={w.more.join("；")}>+{w.more.length}</i>}</span>
            <span
              className={`row-dot ${card ? (card.st === 2 && card.s >= 21 ? "is-mastered" : "is-learning") : ""}`}
            />
            <Speak
              url={atlas.audio(w, accent)}
              text={w.word}
              accent={accent}
              size="sm"
            />
          </div>
        );
      })}
    </div>
  );
}

/** 按主题学: new words in 今日 come from this topic until it is switched off. */
function FocusTopicButton({ topic }: { topic: string }) {
  const focus = useStore((s) => s.settings.focusTopic);
  const on = focus === topic;
  return (
    <button className={`btn btn-ghost btn-sm focus-topic ${on ? "is-on" : ""}`} onClick={() => store.settings({ focusTopic: on ? null : topic })} aria-pressed={on} title={on ? "今日新词只来自这个主题；再点一次恢复按学习路线" : "今日新词改为只从这个主题里选"}>
      {on ? <Check size={16} /> : <GraduationCap size={16} />}
      {on ? "正在学这个主题" : "按这个主题学"}
    </button>
  );
}
