import { BookA, BookOpen, Compass, CornerDownLeft, Layers, Search, X } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { loadGrammar } from "../atlas/grammar";
import type { WordRef } from "../atlas/types";
import { useAtlas } from "../atlas/context";
import { foldAccents } from "../lib/accent";
import type { GrammarData, GrammarPoint } from "../lib/grammar";
import { isCjkQuery, suggest, zhLookup } from "../lib/lexdb/search";
import type { CuratedYoutubeVideo, LoungeBookMeta, LoungeMicroRead, OpenSampleVideo } from "../lib/lounge-types";
import { go, openWord, useLocation } from "../lib/router";
import { searchAtlas } from "../lib/search";
import { Illustration } from "./Illustration";

type PaletteHit =
  | { group: "atlas"; key: string; w: WordRef }
  | { group: "grammar"; key: string; p: GrammarPoint }
  | { group: "lounge"; key: string; shelf: "books" | "reads" | "videos"; itemId: string; title: string; sub: string }
  | { group: "lexdb"; key: string; id: string; word: string; zh: string };

const GROUP_LABEL: Record<PaletteHit["group"], string> = {
  atlas: "备考核心词库",
  grammar: "B1 / B2 语法点",
  lounge: "漫游 · 书影音馆",
  lexdb: "法汉大词典 (LexDB)",
};

export function Palette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const atlas = useAtlas();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [grammarData, setGrammarData] = useState<GrammarData | null>(null);
  const [loungeCatalog, setLoungeCatalog] = useState<{
    books: readonly LoungeBookMeta[];
    reads: readonly LoungeMicroRead[];
    videos: readonly (OpenSampleVideo | CuratedYoutubeVideo)[];
  } | null>(null);
  const [lexHits, setLexHits] = useState<{ id: string; word: string; zh: string }[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);
  const { route, word } = useLocation();
  const routeKey = `${route.page}:${word ?? ""}`;
  const prevRouteKey = useRef(routeKey);

  useEffect(() => {
    if (prevRouteKey.current !== routeKey) {
      prevRouteKey.current = routeKey;
      if (open) onClose();
    }
  }, [routeKey, open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prevFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prevFocused?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  const atlasResults = useMemo(() => searchAtlas(atlas, q, 12), [atlas, q]);

  const grammarResults = useMemo(() => {
    const needle = foldAccents(q.trim());
    if (!needle || !grammarData) return [];
    return grammarData.points
      .filter((p) => foldAccents([p.title, p.fr, p.intro, p.motto ?? "", p.level].join(" ")).includes(needle))
      .slice(0, 6);
  }, [grammarData, q]);

  const loungeResults = useMemo(() => {
    const needle = foldAccents(q.trim());
    if (!needle || !loungeCatalog) return [];
    const out: Extract<PaletteHit, { group: "lounge" }>[] = [];
    for (const b of loungeCatalog.books) {
      if (foldAccents([b.title, b.titleZh, b.author, b.summaryZh, ...b.moodTags, b.level].join(" ")).includes(needle)) {
        out.push({
          group: "lounge",
          key: `lb:${b.id}`,
          shelf: "books",
          itemId: b.id,
          title: b.title,
          sub: `📖 ${b.titleZh} · ${b.author}`,
        });
      }
    }
    for (const m of loungeCatalog.reads) {
      if (foldAccents([m.title, m.titleZh, m.category, m.authorNote, m.level].join(" ")).includes(needle)) {
        out.push({
          group: "lounge",
          key: `lr:${m.id}`,
          shelf: "reads",
          itemId: m.id,
          title: m.title,
          sub: `☕ ${m.titleZh} · ${m.minutes} 分钟`,
        });
      }
    }
    for (const v of loungeCatalog.videos) {
      const creator = v.kind === "open" ? v.creator : v.channel;
      if (foldAccents([v.title, v.titleZh, creator, v.summaryZh, v.level].join(" ")).includes(needle)) {
        out.push({
          group: "lounge",
          key: `lv:${v.id}`,
          shelf: "videos",
          itemId: v.id,
          title: v.title,
          sub: `🎬 ${v.titleZh} · ${v.durationLabel}`,
        });
      }
    }
    return out.slice(0, 6);
  }, [loungeCatalog, q]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setSel(0);
    setLexHits([]);
    void loadGrammar().then(setGrammarData).catch(() => {});
    void Promise.all([
      import("../lib/lounge-books"),
      import("../lib/lounge-reads"),
      import("../lib/lounge-videos"),
    ])
      .then(([b, r, v]) => {
        setLoungeCatalog({
          books: b.LOUNGE_BOOKS,
          reads: r.LOUNGE_MICRO_READS,
          videos: [...v.OPEN_SAMPLE_VIDEOS, ...v.CURATED_YOUTUBE_VIDEOS],
        });
      })
      .catch(() => {});
    requestAnimationFrame(() => input.current?.focus());
  }, [open]);

  useEffect(() => {
    setSel(0);
    const trimmed = q.trim();
    if (!open || trimmed.length < 2) {
      setLexHits([]);
      return;
    }
    const id = ++reqId.current;
    const t = window.setTimeout(() => {
      if (isCjkQuery(trimmed)) {
        void zhLookup(trimmed, 8)
          .then((rows) => {
            if (reqId.current !== id) return;
            setLexHits(
              rows.map((r) => ({
                id: r.id,
                word: r.w ?? r.id.replace(/#\d+$/, ""),
                zh: r.shortZh || r.term,
              })),
            );
          })
          .catch(() => {
            if (reqId.current === id) setLexHits([]);
          });
      } else {
        void suggest(trimmed, 8)
          .then((rows) => {
            if (reqId.current !== id) return;
            setLexHits(rows.map((r) => ({ id: r[0], word: r[1], zh: r[3] })));
          })
          .catch(() => {
            if (reqId.current === id) setLexHits([]);
          });
      }
    }, 120);
    return () => window.clearTimeout(t);
  }, [q, open]);

  const items: PaletteHit[] = useMemo(
    () => [
      ...atlasResults.map((w) => ({ group: "atlas" as const, key: `a:${w.id}`, w })),
      ...grammarResults.map((p) => ({ group: "grammar" as const, key: `g:${p.id}`, p })),
      ...loungeResults,
      ...lexHits.map((l) => ({ group: "lexdb" as const, key: `l:${l.id}`, ...l })),
    ],
    [atlasResults, grammarResults, loungeResults, lexHits],
  );

  useEffect(() => {
    if (!open || !items[sel]) return;
    document.getElementById(`pal-${items[sel].key}`)?.scrollIntoView({ block: "nearest" });
  }, [open, sel, items]);

  if (!open) return null;

  const pick = (item: PaletteHit) => {
    onClose();
    if (item.group === "atlas") openWord(item.w.id);
    else if (item.group === "grammar") go({ page: "grammar", p: item.p.id });
    else if (item.group === "lounge") go({ page: "lounge", shelf: item.shelf, item: item.itemId });
    else go({ page: "dict", w: item.id });
  };

  return (
    <div className="palette-root" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="全站搜索：单词、语法与词典">
        <label className="palette-input">
          <Search size={20} />
          <input
            ref={input}
            role="combobox"
            aria-expanded={true}
            aria-autocomplete="list"
            value={q}
            placeholder="搜单词、语法点或大词典（法语 / 中文，如 subjonctif / 环境）"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => (items.length ? Math.min(items.length - 1, s + 1) : 0));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              }
              if (e.key === "Enter" && items[sel]) pick(items[sel]);
            }}
            aria-controls="palette-list"
            aria-activedescendant={items[sel] ? `pal-${items[sel].key}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="icon-btn palette-close" onClick={onClose} aria-label="关闭搜索">
            <X size={18} />
          </button>
        </label>
        <ul id="palette-list" className="palette-list" role="listbox" aria-label="搜索结果">
          {items.map((item, i) => {
            const showHeader = i === 0 || items[i - 1].group !== item.group;
            return (
              <Fragment key={item.key}>
                {showHeader && (
                  <li className="palette-group" role="presentation">
                    {GROUP_LABEL[item.group]}
                  </li>
                )}
                <li
                  id={`pal-${item.key}`}
                  role="option"
                  aria-selected={i === sel}
                  className={i === sel ? "is-sel" : ""}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => pick(item)}
                >
                  {item.group === "atlas" ? (
                    <>
                      <Illustration src={atlas.img(item.w, "thumb")} word={item.w.word} topic={item.w.topic} className="palette-thumb" />
                      <span className="palette-word" lang="fr">
                        {item.w.word}
                      </span>
                      <span className="palette-zh">{item.w.zh}</span>
                    </>
                  ) : item.group === "grammar" ? (
                    <>
                      <span className="palette-icon">
                        <Layers size={16} />
                      </span>
                      <span className="palette-word">{item.p.title}</span>
                      <span className="palette-zh">
                        {item.p.level} · <span lang="fr">{item.p.fr}</span>
                      </span>
                    </>
                  ) : item.group === "lounge" ? (
                    <>
                      <span className="palette-icon">
                        <Compass size={16} />
                      </span>
                      <span className="palette-word" lang="fr">
                        {item.title}
                      </span>
                      <span className="palette-zh">{item.sub}</span>
                    </>
                  ) : (
                    <>
                      <span className="palette-icon">
                        <BookA size={16} />
                      </span>
                      <span className="palette-word" lang="fr">
                        {item.word}
                      </span>
                      <span className="palette-zh">{item.zh}</span>
                    </>
                  )}
                  {i === sel && <CornerDownLeft size={15} className="palette-enter" />}
                </li>
              </Fragment>
            );
          })}
          {q && !items.length && (
            <li className="palette-empty" role="presentation">
              没有找到「{q}」
            </li>
          )}
          {!q && (
            <li className="palette-hint" role="presentation">
              <BookOpen size={14} /> {atlas.count.toLocaleString()} 个词库词条 + B2 语法点 + LexDB 法汉大词典 · 支持忽略重音与中文反查 · <kbd>↑</kbd>
              <kbd>↓</kbd> 选择 <kbd>↵</kbd> 打开
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
