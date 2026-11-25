import { Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getEntryById, loadMeta, loadSuggest, loadSuggestShard, setLexdbFixtures } from "../lib/lexdb/load";
import { isCjkQuery, searchDict, suggest, zhLookup, type SearchDictResult } from "../lib/lexdb/search";
import { recordDictHistory } from "../lib/lexdb/store";
import { lexdbFold, type LexMeta, type LexSuggestRow } from "../lib/lexdb/types";
import { go, href, type DictTab } from "../lib/router";
import { LexiconTabs } from "../ui/LexiconTabs";
import { LEXDB_FIXTURES, lookupLexdbWithFallback } from "../ui/WordPopup";
import "../styles/dict.css";
import { DictEntryView } from "./dict/DictEntryView";
import { HistoryFavShelf, NotFoundCard, ZhResults } from "./dict/DictShelves";
import {
  FIXTURE_SUGGEST_ROWS,
  fixtureDidYouMean,
  fixtureSuggest,
  fixtureZhLookup,
  SAMPLE_WORDS,
} from "./dict/helpers";

export function Dict({ word, query, tab }: { word?: string; query?: string; tab?: DictTab }) {
  const [input, setInput] = useState(word ?? query ?? "");
  const [meta, setMeta] = useState<LexMeta | null | undefined>(undefined);
  const [suggestMap, setSuggestMap] = useState<Map<string, LexSuggestRow>>(new Map());
  const [acItems, setAcItems] = useState<{ key: string; w: string; zh: string; isCjk?: boolean }[]>([]);
  const [acOpen, setAcOpen] = useState(false);
  const [acSel, setAcSel] = useState(-1);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchDictResult | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [usingFixtures, setUsingFixtures] = useState(false);

  const searchReq = useRef(0);
  const acReq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInput(word ?? query ?? "");
    setAcOpen(false);
  }, [word, query]);

  useEffect(() => {
    let live = true;
    void loadMeta().then((m) => {
      if (!live) return;
      setMeta(m);
      if (!m) {
        setUsingFixtures(true);
        setLexdbFixtures(LEXDB_FIXTURES);
        const map = new Map<string, LexSuggestRow>();
        for (const r of FIXTURE_SUGGEST_ROWS) if (!map.has(r[0])) map.set(r[0], r);
        setSuggestMap(map);
      } else {
        setUsingFixtures(false);
        const loader = m.suggestShards ? loadSuggestShard("top") : loadSuggest();
        void loader.then((rows) => {
          if (!live || !rows) return;
          const map = new Map<string, LexSuggestRow>();
          for (const r of rows) {
            const prev = map.get(r[0]);
            if (!prev || r[2] < prev[2]) map.set(r[0], r);
          }
          setSuggestMap(map);
        });
      }
    });
    return () => {
      live = false;
    };
  }, []);

  const handleLoadedRows = useCallback((rows: LexSuggestRow[]) => {
    if (!rows.length) return;
    setSuggestMap((prev) => {
      let next: Map<string, LexSuggestRow> | null = null;
      for (const r of rows) {
        const ex = (next ?? prev).get(r[0]);
        if (!ex || r[2] < ex[2]) {
          if (!next) next = new Map(prev);
          next.set(r[0], r);
        }
      }
      return next ?? prev;
    });
  }, []);

  // Run lookup whenever URL word/query changes
  useEffect(() => {
    const targetWord = word?.trim();
    const targetQuery = query?.trim();
    if (!targetWord && !targetQuery) {
      setResult(null);
      setLoading(false);
      return;
    }

    window.scrollTo({ top: 0 });
    const req = ++searchReq.current;
    setLoading(true);
    setSelectedIdx(0);

    const run = async () => {
      const m = await loadMeta();
      if (searchReq.current !== req) return;
      const hasDb = m !== null;
      setMeta(m);
      setUsingFixtures(!hasDb);

      if (targetWord) {
        if (!hasDb) {
          const resolved = await lookupLexdbWithFallback(targetWord);
          if (searchReq.current !== req) return;
          if (resolved.entries.length > 0) {
            setResult({
              query: targetWord,
              isCjk: false,
              matchedVia: resolved.matchedVia,
              formTarget: resolved.formTarget,
              entries: resolved.entries,
              suggestions: [],
              didYouMean: [],
              zhHits: [],
            });
          } else if (isCjkQuery(targetWord)) {
            setResult({
              query: targetWord,
              isCjk: true,
              matchedVia: "none",
              entries: [],
              suggestions: [],
              didYouMean: [],
              zhHits: fixtureZhLookup(targetWord),
            });
          } else {
            setResult({
              query: targetWord,
              isCjk: false,
              matchedVia: "none",
              entries: [],
              suggestions: fixtureSuggest(targetWord),
              didYouMean: fixtureDidYouMean(targetWord),
              zhHits: [],
            });
          }
          setLoading(false);
          return;
        }

        if (/^[^#]+#\d+$/.test(targetWord)) {
          const exactId = await getEntryById(targetWord);
          if (searchReq.current !== req) return;
          if (exactId) {
            setResult({
              query: targetWord,
              isCjk: false,
              matchedVia: "exact",
              entries: [exactId],
              suggestions: [],
              didYouMean: [],
              zhHits: [],
            });
            setLoading(false);
            return;
          }
        }

        const res = await searchDict(targetWord);
        if (searchReq.current !== req) return;
        setResult(res);
        setLoading(false);
        return;
      }

      // Query-only route (#/dict?q=...)
      const qVal = targetQuery!;
      if (!hasDb) {
        if (isCjkQuery(qVal)) {
          setResult({
            query: qVal,
            isCjk: true,
            matchedVia: "none",
            entries: [],
            suggestions: [],
            didYouMean: [],
            zhHits: fixtureZhLookup(qVal),
          });
        } else {
          const resolved = await lookupLexdbWithFallback(qVal);
          setResult({
            query: qVal,
            isCjk: false,
            matchedVia: resolved.matchedVia,
            formTarget: resolved.formTarget,
            entries: resolved.entries,
            suggestions: fixtureSuggest(qVal),
            didYouMean: resolved.entries.length ? [] : fixtureDidYouMean(qVal),
            zhHits: [],
          });
        }
        setLoading(false);
        return;
      }

      const res = await searchDict(qVal);
      if (searchReq.current !== req) return;
      setResult(res);
      setLoading(false);
    };

    void run();
  }, [word, query]);

  const activeEntry = result?.entries[selectedIdx] ?? result?.entries[0] ?? null;

  useEffect(() => {
    if (activeEntry) {
      recordDictHistory(activeEntry.id);
    }
  }, [activeEntry?.id]);

  // Live autocomplete
  const handleInputChange = (val: string) => {
    setInput(val);
    setAcSel(-1);
    const trimmed = val.trim();
    if (!trimmed) {
      setAcItems([]);
      setAcOpen(false);
      return;
    }
    const id = ++acReq.current;
    const cjk = isCjkQuery(trimmed);

    const runAc = async () => {
      if (meta === null) {
        const list = cjk
          ? fixtureZhLookup(trimmed, 8).map((h) => ({ key: h.id, w: h.w ?? h.id, zh: h.shortZh ?? h.term, isCjk: true }))
          : fixtureSuggest(trimmed, 10).map((r) => ({ key: r[0], w: r[1], zh: r[3] }));
        if (acReq.current === id) {
          setAcSel(-1);
          setAcItems(list);
          setAcOpen(list.length > 0);
        }
        return;
      }

      if (cjk) {
        const hits = await zhLookup(trimmed, 8);
        if (acReq.current !== id) return;
        const list = hits.map((h) => ({ key: h.id, w: h.w ?? h.id, zh: h.shortZh ?? h.term, isCjk: true }));
        setAcSel(-1);
        setAcItems(list);
        setAcOpen(list.length > 0);
      } else {
        const rows = await suggest(trimmed, 10);
        if (acReq.current !== id) return;
        const list = rows.map((r) => ({ key: `${r[0]}|${r[1]}`, w: r[1], zh: r[3] }));
        setAcSel(-1);
        setAcItems(list);
        setAcOpen(list.length > 0);
      }
    };

    void runAc();
  };

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setAcOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const submitQuery = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setAcOpen(false);
    if (isCjkQuery(trimmed)) {
      go({ page: "dict", q: trimmed });
    } else {
      go({ page: "dict", w: trimmed });
    }
  };

  const cjkMode = isCjkQuery(input);
  const hasSearchTarget = !!(word?.trim() || query?.trim());

  return (
    <div className="page dict-page">
      <LexiconTabs on="dict" />
      <div className="dict-search-wrap" ref={searchWrapRef}>
        <form
          className="dict-search-bar"
          onSubmit={(e) => {
            e.preventDefault();
            submitQuery(input);
          }}
        >
          <span className={`dict-mode-pill ${cjkMode ? "is-cjk" : ""}`} title="自动识别法语查词或中文反查">
            {cjkMode ? "中文反查" : "法汉"}
          </span>
          <Search size={18} className="muted" aria-hidden="true" />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              if (acItems.length > 0) {
                setAcSel(-1);
                setAcOpen(true);
              }
            }}
            onKeyDown={(e) => {
              if (!acOpen || !acItems.length) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setAcSel((s) => Math.min(acItems.length - 1, s + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setAcSel((s) => Math.max(-1, s - 1));
              } else if (e.key === "Enter" && acSel >= 0 && acItems[acSel]) {
                e.preventDefault();
                const picked = acItems[acSel];
                setAcSel(-1);
                setAcOpen(false);
                go({ page: "dict", w: picked.w });
              } else if (e.key === "Escape") {
                setAcSel(-1);
                setAcOpen(false);
              }
            }}
            placeholder="查法语单词、变位、短语或中文（支持去重音，如 etre）"
            aria-label="词典搜索"
            aria-expanded={acOpen && acItems.length > 0}
            aria-controls="dict-autocomplete"
            maxLength={80}
            autoComplete="off"
            spellCheck={false}
          />
          {input && (
            <button
              type="button"
              className="icon-btn dict-search-clear"
              aria-label="清空输入"
              onClick={() => {
                setInput("");
                setAcItems([]);
                setAcOpen(false);
                inputRef.current?.focus();
              }}
            >
              <X size={16} />
            </button>
          )}
          <button type="submit" className="btn btn-primary dict-search-submit" disabled={!input.trim()}>
            查词
          </button>
        </form>

        {acOpen && acItems.length > 0 && (
          <ul id="dict-autocomplete" className="dict-suggest" role="listbox" aria-label="联想候选">
            {acItems.map((item, idx) => (
              <li key={item.key} role="option" aria-selected={idx === acSel}>
                <button
                  type="button"
                  className={idx === acSel ? "is-sel" : ""}
                  onClick={() => {
                    setAcSel(-1);
                    setAcOpen(false);
                    go({ page: "dict", w: item.w });
                  }}
                >
                  <span className="dict-suggest-w" lang="fr">
                    {item.w}
                  </span>
                  <span className="dict-suggest-zh">{item.zh}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!hasSearchTarget ? (
        <div className="dict-home">
          <section className="dict-home-hero">
            <p className="eyebrow">法汉词典 · LexDB</p>
            <h1>全量法汉开放词典</h1>
            <p className="muted">
              {meta
                ? `已索引 ${meta.counts.lemmas.toLocaleString()} 个词元（含 ${meta.counts.withZh.toLocaleString()} 个中文释义词条）· 支持去重音输入、屈折变位还原、短语搭配与中文反查。`
                : "离线词典分片尚未生成时，已自动启用内置样例词条（accueil / prendre / beau）供预览与查词。"}
            </p>
            <div className="dict-samples">
              <span className="muted small">试一试：</span>
              {SAMPLE_WORDS.map((w) => (
                <a key={w} className="chip-btn" href={href({ page: "dict", w })} lang="fr">
                  {w}
                </a>
              ))}
              <a className="chip-btn" href={href({ page: "dict", w: "voulons" })} title="变位反查">
                voulons（变位）
              </a>
              <a className="chip-btn" href={href({ page: "dict", q: "接待" })} title="中文反查">
                接待（中文）
              </a>
            </div>
          </section>

          <HistoryFavShelf suggestMap={suggestMap} meta={meta} onLoadedRows={handleLoadedRows} />
        </div>
      ) : (
        <div className="dict-layout">
          <div className="dict-main">
            {usingFixtures && (
              <div className="dict-notice" role="status">
                <span>当前处于样例词条回退模式（未检测到离线分片），支持 accueil、prendre、beau 及其变位与短语。</span>
              </div>
            )}

            {loading ? (
              <div className="dict-empty-card skeleton-page" aria-busy="true">
                <span className="skeleton-line is-sm" />
                <span className="skeleton-line is-lg" />
                <p className="muted">正在检索「{word ?? query}」…</p>
              </div>
            ) : result?.isCjk ? (
              <ZhResults query={result.query} hits={result.zhHits} />
            ) : activeEntry ? (
              <>
                {result?.matchedVia === "form" && (
                  <div className="dict-notice" role="status">
                    <span className="chip">词形还原</span>
                    <span>
                      <strong lang="fr">{word ?? query}</strong> 是 <strong lang="fr">{activeEntry.w}</strong> 的屈折变化形式（{word ?? query} → {activeEntry.w}）
                    </span>
                  </div>
                )}

                {result?.matchedVia === "phrase" && (
                  <div className="dict-notice" role="status">
                    <span className="chip">短语搭配</span>
                    <span>
                      「<span lang="fr">{word ?? query}</span>」
                      {(() => {
                        const hit = (activeEntry.phrases ?? []).find(
                          (p) => lexdbFold(p.fr) === lexdbFold(word ?? query ?? ""),
                        );
                        return hit ? `：${hit.zh} · ` : " · ";
                      })()}
                      收录于词条 <strong lang="fr">{activeEntry.w}</strong>
                    </span>
                  </div>
                )}

                {result && result.entries.length > 1 && (
                  <div className="dict-notice dict-homographs">
                    <span className="muted small">同形 / 相近词条：</span>
                    {result.entries.map((e, i) => {
                      const isFormOrigin = lexdbFold(e.w) !== lexdbFold(word ?? query ?? "");
                      return (
                        <button
                          key={e.id}
                          type="button"
                          className={`chip-btn ${i === selectedIdx ? "is-on" : ""}`}
                          onClick={() => setSelectedIdx(i)}
                        >
                          <span lang="fr">{e.w}</span>
                          {e.pos[0]?.p && <small> {e.pos[0].p}</small>}
                          {isFormOrigin && <small> · 变位原形</small>}
                        </button>
                      );
                    })}
                  </div>
                )}

                <DictEntryView
                  key={activeEntry.id}
                  entry={activeEntry}
                  initialTab={tab}
                  meta={meta}
                  highlightPhrase={result?.matchedVia === "phrase" ? (word ?? query) : undefined}
                />
              </>
            ) : (
              <NotFoundCard query={word ?? query ?? ""} didYouMeanRows={result?.didYouMean ?? []} />
            )}
          </div>

          <aside className="dict-aside">
            <HistoryFavShelf suggestMap={suggestMap} meta={meta} onLoadedRows={handleLoadedRows} compact />
          </aside>
        </div>
      )}
    </div>
  );
}
