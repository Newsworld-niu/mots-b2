import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, Check, ExternalLink, Layers, Plus, Search, Sparkles, X, Zap } from "lucide-react";
import { ready, useAiConfig } from "../ai/config";
import { useAtlas } from "../atlas/context";
import type { Atlas, WordRef } from "../atlas/types";
import type { DictHit } from "../lib/dict";
import { canAutoFetchFrdic, frdicUrl, GAP, loadFrdic, type DictionaryNode, type FrdicResult } from "../lib/frdic";
import type { LexEntry } from "../lib/lexdb/types";
import { buildSeed, CAPACITY, dictPicks, frdicPicks, hasGap, KIND_LABEL, KINDS, tooLong, withZh, type Pick, type Seed } from "../lib/lookup";
import { isNative } from "../lib/native";
import { href, openWord } from "../lib/router";
import { addToDeck, createCustomWord, createDeck, findExact, findSame } from "../store/decks";
import { store, useStore, type Progress } from "../store/store";
import { Sheet } from "./Sheet";
import { Speak } from "./Speak";
import { toast } from "./Toast";
import { WordForm } from "./WordForm";

const TARGET_DECK = "阅读生词";

/* ---------- 1-click 加入复习, shared with the dictionary page and 卡组 ---------- */

/** The deck quick-added words go to. */
export const REVIEW_DECK = TARGET_DECK;

/** The id of the 阅读生词 deck, made the first time. */
export function reviewDeckId(): string {
  const decks = store.get().progress.decks ?? [];
  return decks.find((d) => d.name === REVIEW_DECK)?.id ?? createDeck(REVIEW_DECK);
}

/** The card a headword already has: its atlas word (by LexDB link or exact spelling) or a word the learner made. */
export function cardFor(atlas: Atlas, w: string, atlasId?: string): WordRef | undefined {
  return (atlasId ? atlas.byId.get(atlasId) : undefined) ?? findExact(atlas, w)[0] ?? findSame(atlas, w)[0];
}

/** Whether a word is already being reviewed: it has an FSRS card or sits in one of the learner's decks. */
export function inReview(p: { cards: Progress["cards"]; decks?: Progress["decks"] }, id: string): boolean {
  return !!p.cards[id] || (p.decks ?? []).some((d) => d.words.includes(id));
}

export interface QuickAddResult {
  status: "added" | "exists";
  wordId: string;
  deckId: string;
  deckName: string;
}

/**
 * Add a dictionary word to 阅读生词 without a form: the atlas word when there is one, else a new word of the
 * learner's own filled from the dictionary (自动填写·待核对). Never adds the same word twice.
 */
export function quickAddToReview(atlas: Atlas, w: string, seed: () => Seed, atlasId?: string): QuickAddResult {
  const p = store.get().progress;
  const ref = cardFor(atlas, w, atlasId);
  if (ref && inReview(p, ref.id)) {
    const deck = (p.decks ?? []).find((d) => d.words.includes(ref.id));
    return { status: "exists", wordId: ref.id, deckId: deck?.id ?? "", deckName: deck?.name ?? "复习" };
  }
  const deckId = reviewDeckId();
  let wordId: string;
  if (ref) {
    addToDeck(deckId, ref.id);
    wordId = ref.id;
  } else {
    const sd = seed();
    wordId = createCustomWord(
      { w: sd.w || w, pos: sd.pos, zh: sd.zh, ipa: sd.ipa, ex: sd.ex, note: sd.note, col: sd.col, senses: sd.senses, fam: sd.fam, syn: sd.syn, ant: sd.ant, auto: true },
      deckId,
    );
  }
  const deckName = store.get().progress.decks?.find((d) => d.id === deckId)?.name ?? REVIEW_DECK;
  return { status: "added", wordId, deckId, deckName };
}

/* ---------- instant LexDB lookup, loaded on the first focus or keystroke ---------- */

type LexSearch = typeof import("../lib/lexdb/search");
let lexSearch: Promise<LexSearch> | null = null;
/** The dictionary engine is fetched only once the learner reaches for the search box (never on mount). */
function loadLexSearch(): Promise<LexSearch> {
  if (!lexSearch)
    lexSearch = import("../lib/lexdb/search").catch((e) => {
      lexSearch = null;
      throw e;
    });
  return lexSearch;
}

interface Suggestion {
  key: string;
  w: string;
  zh: string;
  /** A LexDB entry id (Chinese reverse lookup), or an atlas word id (offline fallback). */
  id?: string;
  from: "lexdb" | "atlas";
}

const foldPlain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .trim();
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;

/** Atlas words starting with the query (accent-folded) or whose gloss has the Chinese query: works offline. */
function atlasSuggestions(atlas: Atlas, q: string, limit: number): Suggestion[] {
  const out: Suggestion[] = [];
  const cjk = CJK.test(q);
  const f = foldPlain(q);
  if (!f) return out;
  for (const w of [...atlas.words, ...(atlas.custom ?? [])]) {
    if (cjk ? w.zh.includes(q) : foldPlain(w.word).startsWith(f)) out.push({ key: `a:${w.id}`, w: w.word, zh: w.zh, id: w.id, from: "atlas" });
    if (out.length >= limit) break;
  }
  return out;
}

const posLabel = (e: LexEntry) =>
  [...new Set(e.pos.map((b) => (b.g === "m" ? `${b.p} 阳性` : b.g === "f" ? `${b.p} 阴性` : b.g === "mf" ? `${b.p} 阴阳同形` : b.p)).filter(Boolean))].slice(0, 3);
const topGlosses = (e: LexEntry, n = 3) =>
  e.pos
    .flatMap((b) => b.senses.map((s) => s.zh.trim()))
    .filter(Boolean)
    .slice(0, n);

type Preview =
  | { kind: "lexdb"; entry: LexEntry; via: string; query: string }
  | { kind: "atlas"; ref: WordRef; query: string }
  | { kind: "none"; query: string };


function Content({ nodes }: { nodes: DictionaryNode[] }) {
  return <>{nodes.map((node, i) => {
    if (typeof node === "string") return node;
    if (node.tag === "img") return <img key={i} className="frdic-character" src={node.src} alt="[图片字]" referrerPolicy="no-referrer" onError={e => { e.currentTarget.alt = "[字未加载]"; e.currentTarget.title = "图片字加载失败，可打开法语助手原文查看"; }} />;
    return createElement(node.tag, { key: i, className: node.className }, node.tag === "br" ? undefined : <Content nodes={node.children} />);
  })}</>;
}

/** Chinese text where each missing picture character shows as a marked gap. */
function Zh({ text }: { text: string }) {
  const parts = text.split(GAP);
  return <>{parts.map((t, i) => <span key={i}>{t}{i < parts.length - 1 && <i className="pick-gap" title="词典里这个字是图片，没法复制">{GAP}</i>}</span>)}</>;
}

/** Kinds whose French text is itself a dictionary word or phrase worth opening (查词 ↗). */
const JUMP_KINDS = new Set<Pick["kind"]>(["family", "syn", "ant", "phrase"]);

function PickRow({ p, on, blocked, onToggle }: { p: Pick; on: boolean; blocked: string; onToggle: () => void }) {
  const jump = JUMP_KINDS.has(p.kind) && p.fr.trim() && !p.fr.includes(GAP);
  return (
    <li className={`pick-row pick-${p.kind} ${on ? "is-on" : ""} ${blocked && !on ? "is-blocked" : ""}`}>
      <label title={blocked && !on ? blocked : undefined}>
        <input type="checkbox" checked={on} disabled={!!blocked && !on} onChange={onToggle} />
        <span className="pick-text">
          {p.pos && p.kind === "sense" && <small className="pos">{p.pos}</small>}
          {p.fr && <b lang="fr">{p.fr}</b>}
          {p.zh && <span className="pick-zh"><Zh text={p.zh} /></span>}
          {hasGap(p) && <em className="pick-note">含缺字</em>}
          {blocked && !on && <em className="pick-note">{blocked}</em>}
        </span>
      </label>
      {jump && (
        <a className="pick-jump link small" href={href({ page: "dict", w: p.fr.trim() })} title={`查看「${p.fr.trim()}」词条`}>
          查词 ↗
        </a>
      )}
    </li>
  );
}

function Picks({ picks, chosen, toggle }: { picks: Pick[]; chosen: Pick[]; toggle: (p: Pick) => void }) {
  return (
    <>
      {KINDS.filter((k) => picks.some((p) => p.kind === k)).map((k) => {
        const total = chosen.filter((c) => c.kind === k).length;
        return (
          <details className="pick-group" key={k} open>
            <summary>{KIND_LABEL[k]} <small>{picks.filter((p) => p.kind === k).length} 项 · 已选 {total}/{CAPACITY[k]}</small></summary>
            <ul>
              {picks.filter((p) => p.kind === k).map((p) => (
                <PickRow key={p.key} p={p} on={chosen.some((c) => c.key === p.key)} blocked={tooLong(p) || (total >= CAPACITY[k] ? `${KIND_LABEL[k]}已选满` : "")} onToggle={() => toggle(p)} />
              ))}
            </ul>
          </details>
        );
      })}
    </>
  );
}

export function HomeDictionary() {
  const atlas = useAtlas();
  const ai = useAiConfig();
  const storedDecks = useStore((s) => s.progress.decks);
  const decks = useMemo(() => storedDecks ?? [], [storedDecks]);
  const cards = useStore((s) => s.progress.cards);
  const readDeck = useStore((s) => s.settings.readDeck);
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<DictHit[] | null>(null);
  const [result, setResult] = useState<FrdicResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [making, setMaking] = useState(false);
  const [form, setForm] = useState<{ seed: Seed; deckId: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const job = useRef<AbortController | null>(null);
  useEffect(() => () => job.current?.abort(), []);

  /* instant lookup state */
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [lexDown, setLexDown] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const acReq = useRef(0);
  const lookReq = useRef(0);
  const acTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(acTimer.current), []);

  const warm = () => {
    void loadLexSearch().catch(() => setLexDown(true));
  };

  const runSuggest = (raw: string) => {
    const q = raw.trim();
    const req = ++acReq.current;
    window.clearTimeout(acTimer.current);
    if (!q) {
      setSuggestions([]);
      setActive(-1);
      return;
    }
    acTimer.current = window.setTimeout(async () => {
      const local = atlasSuggestions(atlas, q, 8);
      let rows: Suggestion[] = [];
      try {
        const lex = await loadLexSearch();
        if (CJK.test(q)) {
          const hits = await lex.zhLookup(q, 8);
          rows = hits.map((h) => ({ key: `z:${h.id}`, w: h.w ?? h.id.replace(/#\d+$/, ""), zh: h.shortZh || h.term, id: h.id, from: "lexdb" as const }));
        } else {
          const hits = await lex.suggest(q, 8);
          rows = hits.map((r) => ({ key: `s:${r[1]}`, w: r[1], zh: r[3], from: "lexdb" as const }));
        }
      } catch {
        if (req === acReq.current) setLexDown(true);
      }
      if (req !== acReq.current) return;
      const seen = new Set(rows.map((r) => foldPlain(r.w)));
      const merged = [...rows, ...local.filter((l) => !seen.has(foldPlain(l.w)))].slice(0, 8);
      setSuggestions(merged);
      setActive(-1);
      setListOpen(true);
    }, 110);
  };

  /** Show the compact entry for a word: LexDB first, the atlas when the dictionary is out of reach. */
  const lookUp = async (raw: string, pick?: Suggestion) => {
    const q = (pick?.w ?? raw).trim();
    if (!q) return;
    const req = ++lookReq.current;
    ++acReq.current;
    window.clearTimeout(acTimer.current);
    setListOpen(false);
    setPreviewBusy(true);
    const atlasHit = () => {
      if (pick?.from === "atlas" && pick.id) return atlas.byId.get(pick.id);
      return findExact(atlas, q)[0] ?? findSame(atlas, q)[0];
    };
    try {
      const lex = await loadLexSearch();
      const res = await lex.resolve(q);
      if (req !== lookReq.current) return;
      const entry = (pick?.id && res.entries.find((e) => e.id === pick.id)) || res.entries[0];
      if (entry) {
        setPreview({ kind: "lexdb", entry, via: res.matchedVia === "form" ? "变化形式" : res.matchedVia === "phrase" ? "短语" : "", query: q });
        return;
      }
      const ref = atlasHit();
      setPreview(ref ? { kind: "atlas", ref, query: q } : { kind: "none", query: q });
    } catch {
      if (req !== lookReq.current) return;
      setLexDown(true);
      const ref = atlasHit();
      setPreview(ref ? { kind: "atlas", ref, query: q } : { kind: "none", query: q });
    } finally {
      if (req === lookReq.current) setPreviewBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && suggestions.length) {
      e.preventDefault();
      setListOpen(true);
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && suggestions.length) {
      e.preventDefault();
      setListOpen(true);
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Escape") {
      if (listOpen) {
        e.preventDefault();
        setListOpen(false);
      } else if (preview) {
        e.preventDefault();
        setPreview(null);
      }
    }
  };

  const quickAdd = async (entry: LexEntry) => {
    try {
      const lex = await loadLexSearch();
      const res = quickAddToReview(atlas, entry.w, () => lex.entryToSeed(entry), entry.atlasId);
      toast(res.status === "added" ? `已加入「${res.deckName}」卡组` : `「${entry.w}」已在词卡里`, res.status === "added" ? "ok" : "info");
    } catch {
      toast("离线大词典暂不可用，可展开「手动/补充制卡」自己做卡", "warn");
    }
  };

  // 派生词 picks get a short Chinese hint from the atlas already in memory (exact accent match; no families.json request on the home page)
  const picks = useMemo(() => {
    const fromDict = dictPicks(hits ?? []).map((p) => {
      if (p.kind !== "family" || p.zh) return p;
      const zh = findExact(atlas, p.fr)[0]?.zh?.split(/[；;]/)[0]?.trim().slice(0, 38) ?? "";
      return zh ? { ...p, zh } : p;
    });
    return [...fromDict, ...frdicPicks(result?.items ?? [])];
  }, [atlas, hits, result]);
  const mine = useMemo(() => {
    const seen = new Set<string>();
    return [term, ...(hits ?? []).map((h) => h.w)].flatMap((n) => (n ? findSame(atlas, n) : [])).filter((w) => !seen.has(w.id) && !!seen.add(w.id));
  }, [atlas, term, hits]);

  const close = () => { job.current?.abort(); setBusy(false); setError(""); setResult(null); setHits(null); setTerm(""); setChosen([]); };
  const fetchFrdic = async (word: string, c: AbortController) => {
    setBusy(true); setError(""); setResult(null);
    try { const data = await loadFrdic(word, c.signal); if (!c.signal.aborted) setResult(data); }
    catch (e) { if (!c.signal.aborted) setError((e as Error).message); }
    finally { if (!c.signal.aborted) setBusy(false); }
  };
  const search = async () => {
    const word = query.trim();
    if (!word) return;
    job.current?.abort();
    const c = new AbortController(); job.current = c;
    setTerm(word); setError(""); setResult(null); setHits(null); setChosen([]);
    // the offline dictionary (LexDB) always runs locally; 法语助手 auto-fetches only when native or local proxy is available
    void import("../lib/dict")
      .then((m) => m.lookupDict(word))
      .then((h) => { if (!c.signal.aborted) setHits(h); }, () => { if (!c.signal.aborted) setHits([]); });
    if (canAutoFetchFrdic()) {
      await fetchFrdic(word, c);
    } else {
      setBusy(false);
    }
  };

  /** The deck words go to: the one chosen, else 阅读生词 (made the first time). */
  const deck = decks.find((d) => d.id === readDeck);
  const targetDeck = () => {
    if (deck) return deck.id;
    const id = decks.find((d) => d.name === TARGET_DECK)?.id ?? createDeck(TARGET_DECK);
    store.settings({ readDeck: id });
    return id;
  };
  const deckName = deck?.name ?? TARGET_DECK;

  const toggle = (p: Pick) => setChosen((c) => (c.includes(p.key) ? c.filter((k) => k !== p.key) : [...c, p.key]));
  const list = chosen.map((k) => picks.find((p) => p.key === k)).filter((p): p is Pick => !!p);

  const fillForm = async () => {
    let use = list;
    const gaps = use.filter(hasGap);
    if (gaps.length && ready.text(ai)) {
      setMaking(true);
      try {
        const first = use.find((p) => p.kind === "sense");
        const { completeGaps } = await import("../ai/tasks");
        const fixed = await completeGaps({ word: term, pos: first?.pos ?? "", items: gaps.map((p, id) => ({ id, kind: p.kind, fr: p.fr, zh: p.zh })) });
        use = use.map((p) => { const i = gaps.indexOf(p); return i >= 0 && fixed.has(i) ? withZh(p, fixed.get(i)!) : p; });
        const left = use.filter(hasGap).length;
        if (left) toast(`${left} 项的缺字 AI 没有补上，表单里仍显示 □，请手动改`, "warn");
      } catch (e) {
        toast(`AI 补缺字失败（${(e as Error).message}），缺的字仍显示为 □`, "warn");
      } finally { setMaking(false); }
    } else if (gaps.length) toast(`有 ${gaps.length} 项含缺字（□）。设置 AI 后会自动补全，也可以在表单里手动改`, "warn");
    const refused = use.filter((p) => tooLong(p));
    if (refused.length) { toast(`${refused.length} 项补全后超过卡片字数，没有放进去`, "warn"); use = use.filter((p) => !tooLong(p)); }
    const firstDict = use.find((p) => p.origin === "dict");
    const hit = hits?.[firstDict ? Number(firstDict.key.split("|")[1]) : 0];
    setForm({ seed: buildSeed(term, use, hit), deckId: targetDeck() });
  };

  const addMine = (id: string) => { addToDeck(targetDeck(), id); toast(`已加入「${store.get().progress.decks?.find((d) => d.id === targetDeck())?.name ?? TARGET_DECK}」`, "ok"); };
  const dictBusy = term !== "" && hits === null;
  const dictOnly = picks.filter((p) => p.origin === "dict");
  const dictHits = hits ?? [];
  const head = dictHits[0];
  const headHits = dictHits.filter((h) => h.w === head?.w);
  const headPos = [...new Set(headHits.map((h) => (h.g === "mf" ? `${h.p}（阴阳同形）` : h.p)).filter(Boolean))];
  const headForms = headHits.find((h) => h.forms)?.forms;
  const formsText = headForms
    ? [headForms.f && `f. ${headForms.f}`, headForms.pl && `pl. ${headForms.pl}`, headForms.fpl && `f.pl. ${headForms.fpl}`].filter(Boolean)
        .join(" · ")
    : "";
  const hasConj = headHits.some((h) => h.conj);
  const frdicOnly = picks.filter((p) => p.origin === "frdic");

  return <section className="home-dictionary" aria-label="查词">
    <div className="home-dict-combo">
      <form className="home-dictionary-search" role="search" onSubmit={e => {
        e.preventDefault();
        const pick = active >= 0 ? suggestions[active] : undefined;
        if (pick) setQuery(pick.w);
        void lookUp(query, pick);
      }}>
        <Search size={21} aria-hidden="true" />
        <input
          ref={input}
          role="combobox"
          aria-label="搜索法语或中文"
          aria-autocomplete="list"
          aria-expanded={listOpen && suggestions.length > 0}
          aria-controls="home-dict-ac"
          aria-activedescendant={listOpen && active >= 0 ? `home-dict-ac-${active}` : undefined}
          placeholder="查词：法语（可不打重音）或中文，回车看释义…"
          value={query}
          onFocus={() => {
            warm();
            if (suggestions.length) setListOpen(true);
          }}
          onChange={e => {
            warm();
            setQuery(e.target.value);
            runSuggest(e.target.value);
          }}
          onKeyDown={onKey}
          onBlur={() => window.setTimeout(() => setListOpen(false), 120)}
          maxLength={80}
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button type="button" className="icon-btn home-dict-clear" aria-label="清空" onClick={() => {
            ++acReq.current;
            ++lookReq.current;
            setQuery("");
            setSuggestions([]);
            setPreview(null);
            setPreviewBusy(false);
            input.current?.focus();
          }}>
            <X size={16} />
          </button>
        )}
        <button type="submit" className="btn btn-primary btn-sm" disabled={!query.trim()}>查词</button>
      </form>
      {listOpen && suggestions.length > 0 && (
        <ul className="home-dict-ac" id="home-dict-ac" role="listbox" aria-label="查词建议">
          {suggestions.map((sg, i) => (
            <li
              key={sg.key}
              id={`home-dict-ac-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? "is-active" : ""}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery(sg.w);
                void lookUp(sg.w, sg);
              }}
            >
              <b lang="fr">{sg.w}</b>
              <span>{sg.zh}</span>
              {sg.from === "atlas" && <small className="chip">词库</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
    <p className="home-dictionary-caption"><BookOpen size={14} /> 41k 离线法汉词典 · 我的词库{lexDown ? " · 离线词典暂不可用，已改用词库" : ""}</p>

    {(preview || previewBusy) && (
      <div className="home-dict-preview" aria-live="polite" aria-busy={previewBusy}>
        {previewBusy && !preview && <p className="lookup-empty">正在查询…</p>}
        {preview?.kind === "lexdb" && (() => {
          const e = preview.entry;
          const ref = cardFor(atlas, e.w, e.atlasId);
          const reviewing = !!ref && inReview({ cards, decks }, ref.id);
          const reviewDeck = ref ? decks.find((d) => d.words.includes(ref.id)) : undefined;
          const glosses = topGlosses(e);
          return (
            <>
              <header className="home-dict-preview-head">
                <div>
                  <h2 lang="fr">{e.w}</h2>
                  <p className="home-dict-preview-meta">
                    {e.ipa && <span className="ipa">/{e.ipa}/</span>}
                    {posLabel(e).map((p) => <span key={p} className="pos">{p}</span>)}
                    {e.level && <span className={`chip chip-level lv-${e.level}`}>{e.level}</span>}
                    {preview.via && <span className="muted small">「{preview.query}」的{preview.via}</span>}
                  </p>
                </div>
                <Speak url={ref ? atlas.audio(ref, "uk") : null} text={e.w} size="sm" ariaLabel={`朗读 ${e.w}`} />
              </header>
              {glosses.length > 0 && (
                <ol className="home-dict-glosses">
                  {glosses.map((g, i) => <li key={i}>{g}</li>)}
                </ol>
              )}
              <div className="home-dict-preview-actions">
                {reviewing ? (
                  <>
                    <span className="reader-in-deck"><Check size={14} /> 已在词卡</span>
                    {reviewDeck ? (
                      <a className="btn btn-ghost btn-sm" href={href({ page: "decks", d: reviewDeck.id })}><Layers size={14} /> 去卡组查看</a>
                    ) : (
                      ref && <button type="button" className="btn btn-ghost btn-sm" onClick={() => openWord(ref.id)}><Layers size={14} /> 打开词卡</button>
                    )}
                  </>
                ) : (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => void quickAdd(e)}>
                    <Zap size={14} /> 加入复习
                  </button>
                )}
                <a className="btn btn-ghost btn-sm" href={href({ page: "dict", w: e.w })}>完整词典详情 <ArrowRight size={14} /></a>
              </div>
            </>
          );
        })()}
        {preview?.kind === "atlas" && (
          <>
            <header className="home-dict-preview-head">
              <div>
                <h2 lang="fr">{preview.ref.word}</h2>
                <p className="home-dict-preview-meta"><span className="muted small">来自我的词库{lexDown ? "（离线大词典暂不可用）" : ""}</span></p>
              </div>
              <Speak url={atlas.audio(preview.ref, "uk")} text={preview.ref.word} size="sm" ariaLabel={`朗读 ${preview.ref.word}`} />
            </header>
            <p className="home-dict-glosses-plain">{[preview.ref.zh, ...(preview.ref.more ?? [])].slice(0, 3).join("；")}</p>
            <div className="home-dict-preview-actions">
              {inReview({ cards, decks }, preview.ref.id) ? (
                <span className="reader-in-deck"><Check size={14} /> 已在词卡</span>
              ) : (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => {
                  const res = quickAddToReview(atlas, preview.ref.word, () => buildSeed(preview.ref.word, []), preview.ref.id);
                  toast(res.status === "added" ? `已加入「${res.deckName}」卡组` : `「${preview.ref.word}」已在词卡里`, res.status === "added" ? "ok" : "info");
                }}>
                  <Zap size={14} /> 加入复习
                </button>
              )}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => openWord(preview.ref.id)}>打开词卡</button>
              <a className="btn btn-ghost btn-sm" href={href({ page: "dict", w: preview.ref.word })}>完整词典详情 <ArrowRight size={14} /></a>
            </div>
          </>
        )}
        {preview?.kind === "none" && (
          <p className="lookup-empty">
            没有找到「<span lang="fr">{preview.query}</span>」。可以试试 <a className="link" href={href({ page: "dict", q: preview.query })}>完整词典搜索</a>，或在下方「手动/补充制卡」里自己做一张卡。
          </p>
        )}
      </div>
    )}

    <details className="home-dict-manual" open={manualOpen || !!term} onToggle={(e) => setManualOpen(e.currentTarget.open)}>
      <summary>手动/补充制卡 <small>法语助手 · 勾选释义与例句做成自己的卡片</small></summary>
      {!term && (
        <div className="home-dict-manual-body">
          <p className="muted small">把输入框里的词送去离线词典与法语助手，挑选内容后新建卡片；也可以不选，直接新建。</p>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!query.trim()} onClick={() => void search()}>
            <Plus size={14} /> {query.trim() ? `用「${query.trim()}」做卡片` : "先在上方输入一个词"}
          </button>
        </div>
      )}
    {term && <div className="home-dictionary-result" aria-busy={busy || dictBusy}>
      <header><div><h2 lang="fr">{term}</h2><a className="link" href={result?.source ?? frdicUrl(term)} target={isNative() ? "_self" : "_blank"} rel="noopener noreferrer">法语助手原文 <ExternalLink size={13} /></a></div><button className="icon-btn" aria-label="收起查词结果" onClick={close}><X size={20} /></button></header>

      <details className="lookup-section" open={mine.length > 0}>
        <summary>我的词库 <small>{mine.length} 个</small></summary>
        {mine.length === 0 ? <p className="lookup-empty">词库里没有这个词。</p> : <ul className="lookup-mine">{mine.map((w) => {
          const inDeck = !!deck?.words.includes(w.id);
          return <li key={w.id}>
            <button className="link" onClick={() => openWord(w.id)} lang="fr">{w.word}</button>
            <span>{[w.zh, ...(w.more ?? [])].join("；")}</span>
            {w.custom && <i className="chip chip-mine">自建</i>}
            {inDeck ? <span className="reader-in-deck"><Check size={14} /> 已在「{deckName}」</span> : <button className="btn btn-ghost btn-sm" onClick={() => addMine(w.id)}><Plus size={14} /> 加入「{deckName}」</button>}
          </li>;
        })}</ul>}
      </details>

      <details className="lookup-section" open={dictHits.length > 0}>
        <summary>离线大词典 (LexDB) <small>{dictBusy ? "查询中…" : `${dictOnly.length} 项`}</small></summary>
        {dictHits.length === 0 || !head ? <p className="lookup-empty">{dictBusy ? "正在查询…" : "词典里没有这个词。"}</p> : <>
          {head.form && <p className="muted small">「{term}」是 <span lang="fr">{head.w}</span> 的变化形式。</p>}
          <div className="home-dict-meta">
            <b lang="fr">{head.w}</b>
            {headPos.map((p) => <span key={p} className="pos">{p}</span>)}
            {formsText && <span className="home-dict-forms" lang="fr">{formsText}</span>}
            <span className="home-dict-links">
              <a className="link small" href={href({ page: "dict", w: head.w })}>完整词条 →</a>
              {hasConj && <a className="link small" href={href({ page: "dict", w: head.w, tab: "conj" })}>动词变位 →</a>}
            </span>
          </div>
          {dictOnly.length > 0 && <Picks picks={dictOnly} chosen={list} toggle={toggle} />}
        </>}
      </details>

      <details className="lookup-section" open={frdicOnly.length > 0 || !!error || busy}>
        <summary>法语助手 <small>{busy ? "查询中…" : error ? "查询失败" : result ? `${frdicOnly.length} 项` : canAutoFetchFrdic() ? "0 项" : "静态托管不自动请求"}</small></summary>
        {busy && <p role="status" className="lookup-empty">正在查询法语助手…</p>}
        {error && <div role="alert" className="lookup-error"><p>{error}</p><button className="btn btn-ghost btn-sm" onClick={() => void search()}>重新查询</button></div>}
        {!busy && !error && !result && !canAutoFetchFrdic() && (
          <div className="lookup-empty">
            <p>静态托管环境不自动抓取法语助手，避免额外 404 请求；可前往 <a className="link" href={href({ page: "dict", w: term })}>LexDB 完整词典</a> 或打开法语助手原文查看。</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => {
              job.current?.abort();
              const c = new AbortController();
              job.current = c;
              void fetchFrdic(term, c);
            }}>尝试联网查询法语助手</button>
          </div>
        )}
        {!busy && !error && (!!result || canAutoFetchFrdic()) && frdicOnly.length === 0 && <p className="lookup-empty">法语助手里没有可以选的内容。</p>}
        {frdicOnly.length > 0 && <>
          <p className="muted small">词典把不少汉字画成图片，复制不出来，这些字在这里显示为 <i className="pick-gap">□</i>；选中后可以让 AI 补全。</p>
          <Picks picks={frdicOnly} chosen={list} toggle={toggle} />
        </>}
        {result && <details className="lookup-original"><summary>看词典原文版面（图片字完整，不能勾选）</summary>
          <div className="frdic-sections">{result.sections.map((section, i) => <details key={section.title} open={i === 0}><summary>{section.title}</summary><div className="frdic-content"><Content nodes={section.nodes} /></div></details>)}</div>
        </details>}
      </details>

      <footer className="lookup-tray">
        <p>{list.length ? <>已选 {list.length} 项：{KINDS.filter((k) => list.some((p) => p.kind === k)).map((k) => `${KIND_LABEL[k]} ${list.filter((p) => p.kind === k).length}/${CAPACITY[k]}`).join(" · ")}</> : "勾选要放进卡片的内容，也可以什么都不选，直接新建。"}{list.some((p) => p.kind === "sense") && "（先勾的释义是卡片的主要意思）"}</p>
        <div className="lookup-tray-actions">
          {decks.length > 0 && <select className="reader-deck" value={deck?.id ?? ""} onChange={(e) => store.settings({ readDeck: e.target.value || null })} aria-label="加入哪个卡组">
            {!deck && <option value="">加到：{TARGET_DECK}</option>}
            {decks.map((d) => <option key={d.id} value={d.id}>加到：{d.name}</option>)}
          </select>}
          {list.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setChosen([])}>清空</button>}
          <button className="btn btn-primary" disabled={making} onClick={() => void fillForm()}>
            {making ? <><Sparkles size={16} /> AI 正在补缺字…</> : <><Plus size={16} /> {list.length ? `放进卡片（${list.length} 项）` : "新建卡片"}</>}
          </button>
        </div>
      </footer>
    </div>}
    </details>

    <Sheet open={form !== null} onClose={() => setForm(null)} label="新建卡片">
      <h2 className="sheet-title">新建卡片 · 加入「{decks.find((d) => d.id === form?.deckId)?.name ?? deckName}」</h2>
      {form && <WordForm mode="create" deckId={form.deckId} seed={form.seed} onDone={(id) => { setForm(null); if (id) { close(); setQuery(""); input.current?.focus(); } }} />}
    </Sheet>
  </section>;
}
