import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Check,
  ExternalLink,
  Flag,
  History,
  Layers,
  NotebookPen,
  Plus,
  Search,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useConfusables } from "../atlas/confusables";
import { useConj } from "../atlas/conj";
import { useAtlas } from "../atlas/context";
import { play } from "../lib/audio";
import { TENSE_FR, TENSE_ZH, TENSES, tableFor, type ConjTense } from "../lib/conjugation";
import { FAMILIES, familyPair } from "../lib/families";
import { frdicUrl } from "../lib/frdic";
import { getEntryById, loadMeta, loadSuggest, setLexdbFixtures } from "../lib/lexdb/load";
import {
  damerauLevenshtein,
  didYouMean,
  entryToSeed,
  isCjkQuery,
  searchDict,
  suggest,
  zhLookup,
  type SearchDictResult,
  type ZhHit,
} from "../lib/lexdb/search";
import {
  addDictReport,
  clearDictHistory,
  recordDictHistory,
  setDictNote,
  toggleDictFav,
  useDictStore,
} from "../lib/lexdb/store";
import { lexdbFold, type Conf, type LexEntry, type LexExample, type LexMeta, type LexSuggestRow, type SourceId } from "../lib/lexdb/types";
import { isNative } from "../lib/native";
import { go, href, openWord } from "../lib/router";
import { wiktionaryLinks } from "../lib/wiktionary";
import { addToDeck, createDeck, findSame } from "../store/decks";
import { store, useStore } from "../store/store";
import { AUX_NOTE, ConjTable } from "../ui/ConjTable";
import { Highlight } from "../ui/EntryView";
import { Sheet } from "../ui/Sheet";
import { toast } from "../ui/Toast";
import { WordForm } from "../ui/WordForm";
import { LEXDB_FIXTURES, lookupLexdbWithFallback } from "../ui/WordPopup";
import "../styles/dict.css";

type DictTab = "zh" | "conj" | "phrases" | "examples" | "relations" | "fr" | "etym" | "notes";

const DICT_DECK = "阅读生词";
const SAMPLE_WORDS = ["prendre", "beau", "accueil", "être", "faire", "temps"];

const POS_ZH: Record<string, string> = {
  "n.m.": "阳性名词",
  "n.f.": "阴性名词",
  "n.": "名词",
  "v.": "动词",
  "adj.": "形容词",
  "adv.": "副词",
  "prép.": "介词",
  "conj.": "连词",
  "pron.": "代词",
  "interj.": "感叹词",
  "loc.": "短语 / 表达",
};

const SOURCE_LABEL: Record<SourceId, string> = {
  atlas: "词图",
  "wikt-fr": "法语维基",
  "wikt-zh": "中文维基",
  cfdict: "CFDICT",
  omw: "OMW",
  tatoeba: "Tatoeba",
  lexique: "Lexique",
  ai: "AI",
  "ai-reviewed": "AI 复核",
  user: "用户",
};

const CONF_META: Record<Conf, { label: string; tone: string; hint: string }> = {
  3: { label: "高可信 · 3", tone: "conf-3", hint: "来自教材词图或 ≥3 个独立开放来源一致确认" },
  2: { label: "较可靠 · 2", tone: "conf-2", hint: "2 个独立开放来源语义一致" },
  1: { label: "参考 · 1", tone: "conf-1", hint: "单一开放来源或第二模型复核通过" },
  0: { label: "待核对 · 0", tone: "conf-0", hint: "尚未复核的 AI 生成译文或存在来源冲突" },
};

const REPORT_KINDS = ["释义有误", "词性 / 阴阳性错误", "例句或高亮错误", "缺少常用义项", "其他问题"];

interface CollectedExample extends LexExample {
  pos: string;
  senseZh: string;
}

function collectExamples(entry: LexEntry): CollectedExample[] {
  const seen = new Set<string>();
  const out: CollectedExample[] = [];
  for (const blk of entry.pos) {
    for (const s of blk.senses) {
      for (const ex of s.ex ?? []) {
        const key = ex.fr.trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push({ ...ex, pos: blk.p, senseZh: s.zh });
      }
    }
  }
  return out;
}

function entryMaxConf(entry: LexEntry): Conf {
  let max: Conf = 0;
  for (const blk of entry.pos) {
    for (const s of blk.senses) {
      if (s.conf > max) max = s.conf;
    }
  }
  if (max === 0 && entry.sources.includes("atlas")) return 3;
  return max;
}

const FIXTURE_SUGGEST_ROWS: LexSuggestRow[] = (() => {
  const rows: LexSuggestRow[] = [];
  for (const e of LEXDB_FIXTURES) {
    const firstZh = e.pos[0]?.senses[0]?.zh ?? "";
    rows.push([e.id, e.w, e.rank ?? 99999, firstZh.slice(0, 24)]);
    for (const p of e.phrases ?? []) {
      rows.push([lexdbFold(p.fr), p.fr, (e.rank ?? 99999) + 10000, p.zh.slice(0, 24)]);
    }
  }
  return rows;
})();

function fixtureSuggest(q: string, limit = 10): LexSuggestRow[] {
  const f = lexdbFold(q);
  if (!f) return [];
  const prefix = FIXTURE_SUGGEST_ROWS.filter((r) => r[0].startsWith(f));
  const sub = FIXTURE_SUGGEST_ROWS.filter((r) => !r[0].startsWith(f) && r[0].includes(f));
  return [...prefix, ...sub].slice(0, limit);
}

function fixtureZhLookup(q: string, limit = 30): ZhHit[] {
  const term = q.trim();
  if (!term) return [];
  const hits: ZhHit[] = [];
  for (const e of LEXDB_FIXTURES) {
    const allZh = [
      ...e.pos.flatMap((p) => p.senses.map((s) => s.zh)),
      ...(e.phrases ?? []).map((p) => p.zh),
    ];
    if (allZh.some((z) => z.includes(term))) {
      hits.push({
        id: e.id,
        w: e.w,
        rank: e.rank ?? 99999,
        term,
        shortZh: e.pos[0]?.senses[0]?.zh,
      });
    }
  }
  return hits.sort((a, b) => a.rank - b.rank).slice(0, limit);
}

function fixtureDidYouMean(q: string, limit = 5): LexSuggestRow[] {
  const f = lexdbFold(q);
  if (f.length < 2) return [];
  return FIXTURE_SUGGEST_ROWS.map((row) => ({ row, dist: damerauLevenshtein(f, row[0], 2) }))
    .filter((x) => x.dist > 0 && x.dist <= 2)
    .sort((a, b) => a.dist - b.dist || a.row[2] - b.row[2])
    .slice(0, limit)
    .map((x) => x.row);
}

export function Dict({ word, query }: { word?: string; query?: string }) {
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
        void loadSuggest().then((rows) => {
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
          setAcItems(list);
          setAcOpen(list.length > 0);
        }
        return;
      }

      if (cjk) {
        const hits = await zhLookup(trimmed, 8);
        if (acReq.current !== id) return;
        const list = hits.map((h) => ({ key: h.id, w: h.w ?? h.id, zh: h.shortZh ?? h.term, isCjk: true }));
        setAcItems(list);
        setAcOpen(list.length > 0);
      } else {
        const rows = await suggest(trimmed, 10);
        if (acReq.current !== id) return;
        const list = rows.map((r) => ({ key: `${r[0]}|${r[1]}`, w: r[1], zh: r[3] }));
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
      <div className="dict-search-wrap" ref={searchWrapRef}>
        <form
          className="dict-search-bar"
          onSubmit={(e) => {
            e.preventDefault();
            if (acOpen && acSel >= 0 && acItems[acSel]) {
              setAcOpen(false);
              go({ page: "dict", w: acItems[acSel].w });
              return;
            }
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
            onFocus={() => acItems.length > 0 && setAcOpen(true)}
            onKeyDown={(e) => {
              if (!acOpen || !acItems.length) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setAcSel((s) => Math.min(acItems.length - 1, s + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setAcSel((s) => Math.max(-1, s - 1));
              } else if (e.key === "Escape") {
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
                  onMouseEnter={() => setAcSel(idx)}
                  onClick={() => {
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

          <HistoryFavShelf suggestMap={suggestMap} />
        </div>
      ) : (
        <div className="dict-layout">
          <div className="dict-main">
            {usingFixtures && (
              <div className="dict-notice" role="status">
                <span>当前处于样例词条回退模式（未检测到 `public/lexdb/meta.json`），支持 `accueil`、`prendre`、`beau` 及其变位与短语。</span>
              </div>
            )}

            {loading ? (
              <div className="dict-empty-card" aria-busy="true">
                <span className="spinner" />
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
                      「<span lang="fr">{word ?? query}</span>」收录于词条 <strong lang="fr">{activeEntry.w}</strong>
                    </span>
                  </div>
                )}

                {result && result.entries.length > 1 && (
                  <div className="dict-notice dict-homographs">
                    <span className="muted small">同形 / 相近词条：</span>
                    {result.entries.map((e, i) => (
                      <button
                        key={e.id}
                        type="button"
                        className={`chip-btn ${i === selectedIdx ? "is-on" : ""}`}
                        onClick={() => setSelectedIdx(i)}
                      >
                        <span lang="fr">{e.w}</span>
                        {e.pos[0]?.p && <small> {e.pos[0].p}</small>}
                      </button>
                    ))}
                  </div>
                )}

                <DictEntryView
                  key={activeEntry.id}
                  entry={activeEntry}
                  highlightPhrase={result?.matchedVia === "phrase" ? (word ?? query) : undefined}
                />
              </>
            ) : (
              <NotFoundCard query={word ?? query ?? ""} didYouMeanRows={result?.didYouMean ?? []} />
            )}
          </div>

          <aside className="dict-aside">
            <HistoryFavShelf suggestMap={suggestMap} compact />
          </aside>
        </div>
      )}
    </div>
  );
}

function ZhResults({ query, hits }: { query: string; hits: ZhHit[] }) {
  return (
    <section className="dict-empty-card">
      <div>
        <p className="eyebrow">中文反查</p>
        <h2>「{query}」的法语匹配（{hits.length} 条）</h2>
      </div>
      {hits.length === 0 ? (
        <p className="muted">没有找到包含「{query}」的法语词条，可以换个近义词或在词图中搜索。</p>
      ) : (
        <ul className="dict-zh-list">
          {hits.map((h) => (
            <li key={h.id}>
              <a className="dict-zh-row" href={href({ page: "dict", w: h.w ?? h.id })}>
                <b className="dict-zh-word" lang="fr">
                  {h.w ?? h.id}
                </b>
                <span className="dict-zh-gloss">{h.shortZh || h.term}</span>
                {h.rank < 99999 && <span className="src-pill">#{h.rank}</span>}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NotFoundCard({ query, didYouMeanRows }: { query: string; didYouMeanRows: LexSuggestRow[] }) {
  const wikt = wiktionaryLinks(query);
  return (
    <section className="dict-empty-card">
      <div>
        <p className="eyebrow">未找到词条</p>
        <h2>
          词典里没有「<span lang="fr">{query}</span>」
        </h2>
      </div>

      {didYouMeanRows.length > 0 && (
        <div>
          <p className="muted small" style={{ marginBottom: 8 }}>
            你是不是要找…
          </p>
          <div className="dict-dym-list">
            {didYouMeanRows.map((row) => (
              <a key={`${row[0]}-${row[1]}`} className="dict-dym-chip" href={href({ page: "dict", w: row[1] })}>
                <b lang="fr">{row[1]}</b>
                {row[3] && <small>{row[3]}</small>}
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="dict-actions-row">
        <a
          className="btn btn-ghost btn-sm"
          href={frdicUrl(query)}
          target={isNative() ? "_self" : "_blank"}
          rel="noopener noreferrer"
        >
          去法语助手原文查看 <ExternalLink size={13} />
        </a>
        {wikt && (
          <a
            className="btn btn-ghost btn-sm"
            href={wikt.search}
            target={isNative() ? "_self" : "_blank"}
            rel="noopener noreferrer"
          >
            Wiktionnaire 搜索 <ExternalLink size={13} />
          </a>
        )}
      </div>
    </section>
  );
}

function HistoryFavShelf({
  suggestMap,
  compact = false,
}: {
  suggestMap: Map<string, LexSuggestRow>;
  compact?: boolean;
}) {
  const { history, favs } = useDictStore();
  const [shelfTab, setShelfTab] = useState<"history" | "favs">("history");
  const ids = shelfTab === "history" ? history : favs;

  const displayRow = (id: string) => {
    const clean = id.replace(/#\d+$/, "");
    const row = suggestMap.get(id) ?? suggestMap.get(clean);
    return { w: row?.[1] ?? clean, zh: row?.[3] ?? "" };
  };

  return (
    <section className="dict-shelf" aria-label="最近查词与收藏夹">
      <div className="dict-shelf-head">
        <div className="segmented" role="tablist" aria-label="查词记录与收藏">
          <button
            type="button"
            role="tab"
            aria-selected={shelfTab === "history"}
            className={shelfTab === "history" ? "is-on" : ""}
            onClick={() => setShelfTab("history")}
          >
            <History size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
            最近查词{history.length ? ` (${history.length})` : ""}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={shelfTab === "favs"}
            className={shelfTab === "favs" ? "is-on" : ""}
            onClick={() => setShelfTab("favs")}
          >
            <Bookmark size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
            收藏夹{favs.length ? ` (${favs.length})` : ""}
          </button>
        </div>

        {shelfTab === "history" && history.length > 0 && (
          <button
            type="button"
            className="link small"
            onClick={() => {
              clearDictHistory();
              toast("已清空最近查词记录");
            }}
          >
            清空
          </button>
        )}
      </div>

      {ids.length === 0 ? (
        <p className="muted small">
          {shelfTab === "history" ? "还没有查词记录，查过的词会自动记在这里。" : "还没有收藏词典词条，点词头的「收藏」即可保存。"}
        </p>
      ) : (
        <ul className="dict-shelf-list">
          {ids.slice(0, compact ? 15 : 40).map((id) => {
            const info = displayRow(id);
            const targetW = id.includes("#") ? id : info.w;
            return (
              <li key={id} className="dict-shelf-row">
                <a className="dict-shelf-link" href={href({ page: "dict", w: targetW })}>
                  <b lang="fr">{info.w}</b>
                  {info.zh && <span>{info.zh}</span>}
                </a>
                {shelfTab === "favs" && (
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ width: 28, height: 28 }}
                    aria-label={`取消收藏 ${info.w}`}
                    onClick={() => toggleDictFav(id)}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function DictEntryView({ entry, highlightPhrase }: { entry: LexEntry; highlightPhrase?: string }) {
  const atlas = useAtlas();
  const { data: conjData } = useConj();
  const { data: confusables } = useConfusables();
  const { favs, notes } = useDictStore();
  const decks = useStore((s) => s.progress.decks) ?? [];
  const readDeck = useStore((s) => s.settings.readDeck);

  const [tab, setTab] = useState<DictTab>("zh");
  const [conjTense, setConjTense] = useState<ConjTense>("pres");
  const [speakingVoice, setSpeakingVoice] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportKind, setReportKind] = useState(REPORT_KINDS[0]);
  const [reportDetail, setReportDetail] = useState("");
  const [noteDraft, setNoteDraft] = useState(notes[entry.id] ?? "");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");

  useEffect(() => {
    setTab("zh");
    setReportOpen(false);
    setReportDetail("");
    setNoteDraft(notes[entry.id] ?? "");
  }, [entry.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isFav = favs.includes(entry.id);
  const savedNote = notes[entry.id] ?? "";
  const atlasRef = entry.atlasId ? atlas.byId.get(entry.atlasId) : findSame(atlas, entry.w)[0];
  const conf = entryMaxConf(entry);
  const confInfo = CONF_META[conf];

  const conjVerb = useMemo(() => {
    if (!conjData) return undefined;
    const baseId = entry.id.replace(/#\d+$/, "");
    return (
      (entry.atlasId ? conjData.verbs[entry.atlasId] : undefined) ??
      conjData.verbs[entry.id] ??
      conjData.verbs[baseId] ??
      conjData.verbs[lexdbFold(entry.w)] ??
      conjData.verbs[entry.w]
    );
  }, [conjData, entry]);

  const hasConjTab = !!conjVerb || (!conjData && !!entry.conj);

  const familyGroup = useMemo(() => {
    if (entry.family) {
      const hit = FAMILIES.find((f) => f.id === entry.family);
      if (hit) return hit;
    }
    const folded = lexdbFold(entry.w);
    return FAMILIES.find(
      (f) => f.words.includes(entry.atlasId ?? "") || f.words.includes(folded) || lexdbFold(f.name) === folded,
    );
  }, [entry]);

  const confusableGroups = useMemo(() => {
    if (!confusables) return [];
    const ids = new Set<string>([
      ...(entry.confusable ?? []),
      ...(confusables.byEntry[entry.atlasId ?? entry.id] ?? []),
      ...(confusables.byEntry[lexdbFold(entry.w)] ?? []),
    ]);
    return confusables.groups.filter((g) => ids.has(g.id));
  }, [confusables, entry]);

  const allExamples = useMemo(() => collectExamples(entry), [entry]);

  const activeDeck = decks.find((d) => d.id === (selectedDeckId || readDeck));
  const ensureTargetDeck = () => {
    if (activeDeck) return activeDeck.id;
    const existing = decks.find((d) => d.name === DICT_DECK)?.id;
    const id = existing ?? createDeck(DICT_DECK);
    store.settings({ readDeck: id });
    return id;
  };
  const deckDisplayName = activeDeck?.name ?? DICT_DECK;
  const inTargetDeck = !!atlasRef && !!activeDeck?.words.includes(atlasRef.id);

  const speakText = async (text: string, voice: "uk" | "us", key: string, recordedUrl?: string | null) => {
    setSpeakingVoice(key);
    try {
      const how = await play(recordedUrl ?? null, text, voice);
      if (how === "unsupported") toast("这台设备没有法语朗读声音", "warn");
    } finally {
      setSpeakingVoice((cur) => (cur === key ? null : cur));
    }
  };

  const tabs: { id: DictTab; label: string; count?: number; dot?: boolean }[] = [
    { id: "zh", label: "法汉释义" },
    ...(hasConjTab ? [{ id: "conj" as const, label: "动词变位" }] : []),
    { id: "phrases", label: "短语搭配", count: entry.phrases?.length ?? 0 },
    { id: "examples", label: "法语例句", count: allExamples.length },
    { id: "relations", label: "近义·反义·派生" },
    { id: "fr", label: "法法释义", count: entry.frDefs?.length ?? 0 },
    { id: "etym", label: "词源与辨析" },
    { id: "notes", label: "笔记", dot: !!savedNote },
  ];

  const hasAnyRel =
    (entry.syn?.length ?? 0) > 0 ||
    (entry.ant?.length ?? 0) > 0 ||
    (entry.derived?.length ?? 0) > 0 ||
    !!familyGroup;

  const formsList: [string, string][] = [];
  if (entry.forms?.f) formsList.push(["f.", entry.forms.f]);
  if (entry.forms?.pl) formsList.push(["pl.", entry.forms.pl]);
  if (entry.forms?.fpl) formsList.push(["f.pl.", entry.forms.fpl]);

  const openReviewForm = () => {
    const did = ensureTargetDeck();
    setSelectedDeckId(did);
    setReviewOpen(true);
  };

  return (
    <article className="dict-entry-card" id="dict-body">
      <header className="dict-head" id="exp-head">
        <div className="dict-head-top">
          <div className="dict-title-group">
            <h1 className="dict-headword" lang="fr">
              {entry.w}
            </h1>
            <div className="dict-badges">
              {entry.level && <span className={`chip chip-level lv-${entry.level}`}>{entry.level}</span>}
              {typeof entry.rank === "number" && entry.rank < 99999 && (
                <span className="chip" title="词频排名">
                  #{entry.rank.toLocaleString()}
                </span>
              )}
              <span className={`conf-pill ${confInfo.tone}`} title={confInfo.hint}>
                {confInfo.label}
              </span>
              {entry.sources.slice(0, 4).map((s) => (
                <span key={s} className="src-pill">
                  {SOURCE_LABEL[s] ?? s}
                </span>
              ))}
            </div>
          </div>

          <div className="dict-head-links">
            <a
              className="link small"
              href={frdicUrl(entry.w)}
              target={isNative() ? "_self" : "_blank"}
              rel="noopener noreferrer"
            >
              法语助手原文 <ExternalLink size={13} />
            </a>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ height: 30, padding: "0 10px", fontSize: 12.5 }}
              onClick={() => setReportOpen((v) => !v)}
              aria-expanded={reportOpen}
            >
              <Flag size={13} /> 报错
            </button>
          </div>
        </div>

        <div className="dict-meta-row explain-word-info">
          {entry.ipa && <span className="dict-ipa ipa">/{entry.ipa}/</span>}

          <div className="dict-voices" role="group" aria-label="法语发音">
            {(["uk", "us"] as const).map((v) => {
              const key = `head-${v}`;
              const recorded = atlasRef ? atlas.audio(atlasRef, v) : null;
              return (
                <button
                  key={v}
                  type="button"
                  className={`dict-voice-btn ${speakingVoice === key ? "is-on" : ""}`}
                  onClick={() => void speakText(entry.w, v, key, recorded)}
                  aria-label={`${v === "uk" ? "女" : "男"}声朗读 ${entry.w}`}
                >
                  <Volume2 size={14} /> {v === "uk" ? "女" : "男"}
                </button>
              );
            })}
          </div>

          <div className="dict-actions-row">
            <button
              type="button"
              className={`btn btn-ghost dict-action-btn ${isFav ? "is-fav" : ""}`}
              aria-pressed={isFav}
              onClick={() => {
                const next = toggleDictFav(entry.id);
                toast(next ? `已收藏「${entry.w}」` : `已取消收藏「${entry.w}」`, "ok");
              }}
            >
              {isFav ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
              {isFav ? "已收藏" : "收藏"}
            </button>

            <button type="button" className="btn btn-primary dict-action-btn" onClick={openReviewForm}>
              <Plus size={15} /> 加入复习
            </button>

            {atlasRef && (
              <button type="button" className="btn btn-ghost dict-action-btn" onClick={() => openWord(atlasRef.id)}>
                <BookOpen size={15} /> 词图卡片
              </button>
            )}

            <button type="button" className="btn btn-ghost dict-action-btn" onClick={() => setTab("notes")}>
              <NotebookPen size={15} /> {savedNote ? "查看笔记" : "记笔记"}
            </button>
          </div>
        </div>

        {reportOpen && (
          <form
            className="dict-report-box"
            onSubmit={(e) => {
              e.preventDefault();
              if (!reportDetail.trim()) {
                toast("请简要描述发现的问题", "warn");
                return;
              }
              addDictReport({
                entryId: entry.id,
                w: entry.w,
                kind: reportKind,
                detail: reportDetail.trim(),
              });
              setReportDetail("");
              setReportOpen(false);
              toast("已记录纠错反馈（可在「我的 → 数据」中导出 JSON）", "ok");
            }}
          >
            <div className="panel-head">
              <strong style={{ fontSize: 13.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={15} /> 词条纠错 · <span lang="fr">{entry.w}</span>
              </strong>
              <button type="button" className="link small" onClick={() => setReportOpen(false)}>
                收起
              </button>
            </div>
            <div className="dict-report-kinds" role="group" aria-label="错误类型">
              {REPORT_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`chip-btn ${reportKind === k ? "is-on" : ""}`}
                  style={{ height: 28, padding: "0 10px", fontSize: 12 }}
                  onClick={() => setReportKind(k)}
                >
                  {k}
                </button>
              ))}
            </div>
            <textarea
              value={reportDetail}
              onChange={(e) => setReportDetail(e.target.value)}
              placeholder="请写明具体问题，例如：第 2 个义项中文应为……"
              maxLength={500}
            />
            <div className="dict-actions-row">
              <button type="submit" className="btn btn-primary btn-sm">
                提交报错记录
              </button>
            </div>
          </form>
        )}
      </header>

      <nav className="dict-tabs" id="tabs" role="tablist" aria-label="词条内容板块">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`dict-tab ${tab === t.id ? "is-on" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span>{t.label}</span>
            {typeof t.count === "number" && t.count > 0 && <small>({t.count})</small>}
            {t.dot && <i className="dict-tab-dot" aria-label="已有笔记" />}
          </button>
        ))}
      </nav>

      {tab === "zh" && (
        <div className="dict-panels">
          {/* 1. 法汉释义 */}
          <details className="dict-panel" open>
            <summary>法汉释义</summary>
            <div className="dict-panel-body">
              {formsList.length > 0 && (
                <div className="dict-forms-bar">
                  <span className="muted small">词形变化</span>
                  {formsList.map(([label, form]) => (
                    <span key={label}>
                      {label} <b lang="fr">{form}</b>
                    </span>
                  ))}
                </div>
              )}

              {hasConjTab && (
                <div className="dict-conj-bar">
                  <span>
                    {conjVerb
                      ? `过去分词 ${conjVerb.pp} · ${conjVerb.p ? AUX_NOTE.e : AUX_NOTE[conjVerb.a]}`
                      : "动词变位已收录"}
                  </span>
                  <button type="button" className="link" onClick={() => setTab("conj")}>
                    查看动词变位 →
                  </button>
                </div>
              )}

              <div className="dict-pos-list">
                {entry.pos.map((blk, bi) => (
                  <section key={`${blk.p}-${bi}`} className="dict-pos-block">
                    <div className="dict-pos-head">
                      <span className="dict-pos-tag">{blk.p}</span>
                      {POS_ZH[blk.p] && <span className="dict-pos-zh">{POS_ZH[blk.p]}</span>}
                      {blk.g && <span className="src-pill">{blk.g === "m" ? "阳性" : blk.g === "f" ? "阴性" : "阴阳同形"}</span>}
                    </div>
                    <ol className="dict-senses">
                      {blk.senses.map((s, si) => (
                        <li key={si} className="dict-sense">
                          <span className="dict-sense-num">{si + 1}</span>
                          <div className="dict-sense-main">
                            <div className="dict-sense-line">
                              <span className="dict-sense-zh">{s.zh || "（暂无中文释义）"}</span>
                              {s.reg && <span className="dict-sense-reg">[{s.reg}]</span>}
                              {s.fr && (
                                <span className="dict-sense-fr" lang="fr">
                                  {s.fr}
                                </span>
                              )}
                              <span className="dict-sense-meta">
                                <span className={`conf-pill ${CONF_META[s.conf].tone}`} title={CONF_META[s.conf].hint}>
                                  conf {s.conf}
                                </span>
                                {s.src.map((src) => (
                                  <span key={src} className="src-pill">
                                    {SOURCE_LABEL[src] ?? src}
                                  </span>
                                ))}
                              </span>
                            </div>

                            {s.ex && s.ex.length > 0 && (
                              <ul className="dict-inline-ex">
                                {s.ex.slice(0, 2).map((ex, ei) => (
                                  <li key={ei}>
                                    <div className="dict-inline-ex-fr" lang="fr">
                                      <Highlight text={ex.fr} word={entry.w} span={ex.hl} />{" "}
                                      <button
                                        type="button"
                                        className="link small"
                                        onClick={() => void speakText(ex.fr, "uk", `inline-${bi}-${si}-${ei}`)}
                                        aria-label={`朗读例句：${ex.fr}`}
                                      >
                                        <Volume2 size={13} />
                                      </button>
                                    </div>
                                    {ex.zh && <div className="dict-inline-ex-zh">{ex.zh}</div>}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            </div>
          </details>

          {/* 2. 近义、反义、派生与词族 */}
          <details className="dict-panel" open>
            <summary>近义、反义、派生与词族</summary>
            <div className="dict-panel-body">
              <RelationsBody entry={entry} familyGroup={familyGroup} hasAnyRel={hasAnyRel} />
            </div>
          </details>

          {/* 3. 法语例句库 */}
          <details className="dict-panel" open>
            <summary>法语例句库（{allExamples.length}）</summary>
            <div className="dict-panel-body">
              {allExamples.length === 0 ? (
                <p className="muted small">暂未收录双语例句。</p>
              ) : (
                <>
                  <ExamplesList
                    examples={allExamples.slice(0, 8)}
                    word={entry.w}
                    speakingVoice={speakingVoice}
                    onSpeak={(fr, key) => void speakText(fr, "uk", key)}
                  />
                  {allExamples.length > 8 && (
                    <button type="button" className="link" onClick={() => setTab("examples")}>
                      查看全部 {allExamples.length} 条例句 →
                    </button>
                  )}
                </>
              )}
            </div>
          </details>
        </div>
      )}

      {tab === "conj" && (
        <section className="dict-panel-body" style={{ padding: 0 }}>
          {conjVerb ? (
            <>
              <div className="dict-conj-bar">
                <span>
                  过去分词 <b lang="fr">{conjVerb.pp}</b> · {conjVerb.p ? AUX_NOTE.e : AUX_NOTE[conjVerb.a]}
                </span>
                <a className="link small" href={href({ page: "conj" })}>
                  去变位专项练习 →
                </a>
              </div>
              <div className="conj-tabs" role="tablist" aria-label="时态切换">
                {TENSES.filter((t) => tableFor(conjVerb, t).length > 0).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={t === conjTense}
                    className={t === conjTense ? "is-on" : ""}
                    onClick={() => setConjTense(t)}
                    title={TENSE_ZH[t]}
                  >
                    <span lang="fr">{TENSE_FR[t]}</span>
                  </button>
                ))}
              </div>
              <ConjTable verb={conjVerb} tense={conjTense} />
            </>
          ) : (
            <p className="muted">正在加载动词变位数据…</p>
          )}
        </section>
      )}

      {tab === "phrases" && (
        <section className="dict-panel-body" style={{ padding: 0 }}>
          {!entry.phrases?.length ? (
            <p className="muted">暂未收录常见短语搭配。</p>
          ) : (
            <ul className="dict-phrase-list">
              {entry.phrases.map((p, i) => {
                const isMatched =
                  highlightPhrase && lexdbFold(p.fr) === lexdbFold(highlightPhrase);
                return (
                  <li
                    key={`${p.fr}-${i}`}
                    className="dict-phrase-item"
                    style={isMatched ? { borderColor: "var(--terra)", background: "var(--terra-soft)" } : undefined}
                  >
                    <a className="dict-phrase-fr link" href={href({ page: "dict", w: p.fr })} lang="fr">
                      {p.fr}
                    </a>
                    <span className="dict-phrase-zh">{p.zh}</span>
                    <span className="dict-sense-meta">
                      <span className={`conf-pill ${CONF_META[p.conf].tone}`}>conf {p.conf}</span>
                      <span className="src-pill">{SOURCE_LABEL[p.src] ?? p.src}</span>
                      <button
                        type="button"
                        className="icon-btn"
                        style={{ width: 28, height: 28 }}
                        aria-label={`朗读短语 ${p.fr}`}
                        onClick={() => void speakText(p.fr, "uk", `phrase-${i}`)}
                      >
                        <Volume2 size={14} />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {tab === "examples" && (
        <section className="dict-panel-body" style={{ padding: 0 }}>
          {allExamples.length === 0 ? (
            <p className="muted">暂未收录双语例句。</p>
          ) : (
            <ExamplesList
              examples={allExamples}
              word={entry.w}
              showSenseContext
              speakingVoice={speakingVoice}
              onSpeak={(fr, key) => void speakText(fr, "uk", key)}
            />
          )}
        </section>
      )}

      {tab === "relations" && (
        <section className="dict-panel-body" style={{ padding: 0 }}>
          <RelationsBody entry={entry} familyGroup={familyGroup} hasAnyRel={hasAnyRel} />
        </section>
      )}

      {tab === "fr" && (
        <section className="dict-panel-body" style={{ padding: 0 }}>
          {!entry.frDefs?.length ? (
            <p className="muted">暂未收录法法释义。</p>
          ) : (
            <ul className="dict-frdef-list">
              {entry.frDefs.map((d, i) => (
                <li key={i} className="dict-frdef-item">
                  <div className="dict-sense-line">
                    <span className="dict-pos-tag" style={{ fontSize: 14 }}>
                      {d.p}
                    </span>
                    <span lang="fr" style={{ fontFamily: "var(--serif)", fontSize: 15.5, fontWeight: 500 }}>
                      {d.gloss}
                    </span>
                    <button
                      type="button"
                      className="link small"
                      aria-label="朗读法法释义"
                      onClick={() => void speakText(d.gloss, "uk", `frdef-${i}`)}
                    >
                      <Volume2 size={13} />
                    </button>
                  </div>
                  {d.ex && (
                    <p className="muted small" lang="fr" style={{ fontFamily: "var(--serif)" }}>
                      Ex. {d.ex}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "etym" && (
        <section className="dict-panel-body" style={{ padding: 0 }}>
          <div>
            <h4 className="eyebrow" style={{ marginBottom: 8 }}>
              词源
            </h4>
            {entry.etym ? (
              <div className="dict-etym-box">
                <p lang="fr">{entry.etym}</p>
                <small className="muted">来源：Wiktionnaire（CC BY-SA 4.0）</small>
              </div>
            ) : (
              <p className="muted small">暂未收录词源说明。</p>
            )}
          </div>

          <div>
            <h4 className="eyebrow" style={{ marginBottom: 8 }}>
              易混词辨析
            </h4>
            {confusableGroups.length === 0 ? (
              <p className="muted small">暂无匹配的易混词辨析组。</p>
            ) : (
              <div className="dict-cf-cards">
                {confusableGroups.map((g) => (
                  <div key={g.id} className="dict-cf-card">
                    <div className="panel-head">
                      <div>
                        <span className="chip">{g.kind === "homophone" ? "同音词" : "词义辨析"}</span>{" "}
                        <b lang="fr" style={{ fontFamily: "var(--serif)", fontSize: 17 }}>
                          {g.title}
                        </b>
                      </div>
                      <a className="link small" href={href({ page: "compare", g: g.id })}>
                        去辨析页测验 →
                      </a>
                    </div>
                    <p className="muted small">{g.zh}</p>
                    <ul className="dict-cf-items">
                      {g.items.map((it) => (
                        <li key={it.w}>
                          <div className="dict-sense-line">
                            <a className="link" href={href({ page: "dict", w: it.lemma ?? it.w })} lang="fr">
                              <b>{it.w}</b>
                            </a>
                            <span>{it.zh}</span>
                          </div>
                          <small className="muted">{it.rule}</small>
                          <div className="dict-inline-ex-fr" lang="fr">
                            {it.ex.fr}{" "}
                            <button
                              type="button"
                              className="link small"
                              onClick={() => void speakText(it.ex.fr, "uk", `cf-${g.id}-${it.w}`)}
                              aria-label={`朗读例句：${it.ex.fr}`}
                            >
                              <Volume2 size={13} />
                            </button>
                          </div>
                          <small className="muted">{it.ex.zh}</small>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "notes" && (
        <section className="dict-panel-body dict-notes-box" style={{ padding: 0 }}>
          <p className="muted small">个人词典笔记仅保存在你的学习档案里，支持随 JSON 备份和云同步一起带走。</p>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="写下你的助记法、常见搭配介词、语境例句或易错点…"
            maxLength={1000}
            aria-label="词条个人笔记"
          />
          <div className="dict-actions-row">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setDictNote(entry.id, noteDraft);
                toast(noteDraft.trim() ? "笔记已保存" : "笔记已清空", "ok");
              }}
            >
              <Check size={14} /> 保存笔记
            </button>
            {savedNote && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setNoteDraft("");
                  setDictNote(entry.id, "");
                  toast("已清除笔记");
                }}
              >
                清除笔记
              </button>
            )}
            <span className="muted small" style={{ marginLeft: "auto" }}>
              {noteDraft.length}/1000
            </span>
          </div>
        </section>
      )}

      <Sheet open={reviewOpen} onClose={() => setReviewOpen(false)} label="加入复习卡片" wide>
        <h2 className="sheet-title">加入复习 · {entry.w}</h2>
        <div className="dict-notice" style={{ marginBottom: 14 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Layers size={15} /> 目标卡组：
            <select
              className="reader-deck"
              value={activeDeck?.id ?? ""}
              onChange={(e) => {
                const next = e.target.value;
                setSelectedDeckId(next);
                store.settings({ readDeck: next || null });
              }}
            >
              {!activeDeck && <option value="">{DICT_DECK}（将自动新建）</option>}
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>

          {atlasRef && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={inTargetDeck}
              onClick={() => {
                const did = ensureTargetDeck();
                addToDeck(did, atlasRef.id);
                const name = store.get().progress.decks?.find((d) => d.id === did)?.name ?? deckDisplayName;
                toast(`已将词库词条「${atlasRef.word}」加入「${name}」`, "ok");
                setReviewOpen(false);
              }}
            >
              {inTargetDeck ? (
                <>
                  <Check size={14} /> 词库原词已在「{deckDisplayName}」
                </>
              ) : (
                <>
                  <Plus size={14} /> 直接加入「{deckDisplayName}」
                </>
              )}
            </button>
          )}
        </div>

        <WordForm
          mode="create"
          deckId={activeDeck?.id ?? ensureTargetDeck()}
          seed={entryToSeed(entry)}
          onDone={(createdId) => {
            setReviewOpen(false);
            if (createdId) {
              toast(`「${entry.w}」已加入复习卡组`, "ok");
            }
          }}
        />
      </Sheet>
    </article>
  );
}

function RelationsBody({
  entry,
  familyGroup,
  hasAnyRel,
}: {
  entry: LexEntry;
  familyGroup: (typeof FAMILIES)[number] | undefined;
  hasAnyRel: boolean;
}) {
  if (!hasAnyRel) {
    return <p className="muted small">暂未收录近义词、反义词、派生词或词族信息。</p>;
  }
  return (
    <div className="dict-rel-groups">
      {entry.syn && entry.syn.length > 0 && (
        <div className="dict-rel-group">
          <h5>近义词</h5>
          <div className="dict-rel-chips">
            {entry.syn.map((w) => (
              <a key={w} className="dict-rel-chip" href={href({ page: "dict", w })} lang="fr">
                {w}
              </a>
            ))}
          </div>
        </div>
      )}

      {entry.ant && entry.ant.length > 0 && (
        <div className="dict-rel-group">
          <h5>反义词</h5>
          <div className="dict-rel-chips">
            {entry.ant.map((w) => (
              <a key={w} className="dict-rel-chip" href={href({ page: "dict", w })} lang="fr">
                {w}
              </a>
            ))}
          </div>
        </div>
      )}

      {entry.derived && entry.derived.length > 0 && (
        <div className="dict-rel-group">
          <h5>派生词</h5>
          <div className="dict-rel-chips">
            {entry.derived.map((w) => (
              <a key={w} className="dict-rel-chip" href={href({ page: "dict", w })} lang="fr">
                {w}
              </a>
            ))}
          </div>
        </div>
      )}

      {familyGroup && (
        <div className="dict-rel-group">
          <h5>词族</h5>
          <div className="dict-family-box">
            <div className="panel-head">
              <span>
                <b lang="fr">{familyGroup.name}</b> · <span className="muted small">{familyGroup.zh}</span>
              </span>
              <a className="link small" href={href({ page: "atlas", families: familyGroup.id })}>
                在图鉴查看词族 →
              </a>
            </div>
            <div className="dict-rel-chips">
              {[familyGroup.name, ...familyGroup.examples].map((raw) => {
                const pair = familyPair(raw);
                if (!pair.fr) return null;
                return (
                  <a key={raw} className="dict-rel-chip" href={href({ page: "dict", w: pair.fr })}>
                    <span lang="fr">{pair.fr}</span>
                    {pair.zh && <small>{pair.zh}</small>}
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExamplesList({
  examples,
  word,
  showSenseContext = false,
  speakingVoice,
  onSpeak,
}: {
  examples: CollectedExample[];
  word: string;
  showSenseContext?: boolean;
  speakingVoice: string | null;
  onSpeak: (fr: string, key: string) => void;
}) {
  return (
    <ol className="dict-ex-list">
      {examples.map((ex, i) => {
        const key = `ex-${i}`;
        return (
          <li key={`${ex.fr}-${i}`} className="dict-ex-card lj_item">
            <span className="dict-sense-num">{i + 1}</span>
            <div className="dict-ex-body">
              <div className="dict-ex-fr-row">
                <p className="dict-ex-fr" lang="fr">
                  <Highlight text={ex.fr} word={word} span={ex.hl} />
                </p>
                <button
                  type="button"
                  className={`dict-voice-btn ${speakingVoice === key ? "is-on" : ""}`}
                  style={{ height: 26, padding: "0 8px", flex: "none" }}
                  onClick={() => onSpeak(ex.fr, key)}
                  aria-label={`朗读第 ${i + 1} 条例句`}
                >
                  <Volume2 size={13} />
                </button>
              </div>
              <div className="dict-ex-zh-row">
                {ex.zh && <span>{ex.zh}</span>}
                <span className="src-pill">{SOURCE_LABEL[ex.src] ?? ex.src}</span>
                {ex.ref && <span className="muted small">{ex.ref}</span>}
                {showSenseContext && ex.senseZh && (
                  <span className="muted small">
                    [{ex.pos} · {ex.senseZh}]
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
