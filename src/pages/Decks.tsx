import { Bookmark, BookmarkCheck, ArrowLeft, Check, ChevronDown, GraduationCap, Pencil, Plus, ScanText, Search, Star, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAtlas } from "../atlas/context";
import type { Atlas, WordRef } from "../atlas/types";
import type { LexEntry } from "../lib/lexdb/types";
import { go, href, openWord } from "../lib/router";
import { searchAtlas } from "../lib/search";
import {
  addToDeck,
  createDeck,
  deckWords,
  deleteDeck,
  findExact,
  orphanCustomWords,
  pausedIds,
  removeFromDeck,
  renameDeck,
  senseGlosses,
  setDeckNote,
  setDeckSense,
  studyRange,
  transferDeckWords,
} from "../store/decks";
import { buildSession, isTaughtReady } from "../store/session";
import { isMastered, type CardState } from "../store/srs";
import { FAVORITES_DECK, toggleBookmark, store, useStore, useStoreShallow, type Progress } from "../store/store";
import { confirmAction } from "../ui/ConfirmSheet";
import { Sheet } from "../ui/Sheet";
import { toast } from "../ui/Toast";
import { WordForm } from "../ui/WordForm";
import { ExtractWords } from "../ui/ExtractWords";
import { cardFor, inReview, quickAddToReview, REVIEW_DECK } from "../ui/HomeDictionary";
import { LexiconTabs } from "../ui/LexiconTabs";
import { useWindowRange } from "../ui/useWindowRange";

const PAUSED = "paused";
const DECK_ROW_H = 60;
const DECK_VIRTUAL_THRESHOLD = 80;

function counts(cards: Record<string, CardState>, ids: string[]) {
  let learning = 0;
  let mastered = 0;
  for (const id of ids) {
    const c = cards[id];
    if (!c) continue;
    if (isMastered(c)) mastered++;
    else learning++;
  }
  return { total: ids.length, learning, mastered, fresh: ids.length - learning - mastered };
}

/** Turn one deck on or off in 今日's study range; null (every deck) when all are on. At least one stays on. */
function toggleStudy(all: string[], current: string[] | null, id: string) {
  const on = new Set(current ?? all);
  if (on.has(id)) on.delete(id);
  else on.add(id);
  const next = all.filter((x) => on.has(x));
  if (!next.length) {
    toast("至少要留一个卡组在学习范围里", "warn");
    return;
  }
  store.settings({ studyDecks: next.length === all.length ? null : next });
}

type DeckProgressSlice = Pick<Progress, "cards" | "decks" | "hidden" | "coreMigrated">;

export function Decks({ deckId }: { deckId?: string }) {
  const atlas = useAtlas();
  const progress = useStoreShallow((s) => ({
    cards: s.progress.cards,
    decks: s.progress.decks,
    hidden: s.progress.hidden,
    coreMigrated: s.progress.coreMigrated,
  }));
  if (deckId === PAUSED) return <PausedWords />;
  const deck = deckId ? progress.decks?.find((d) => d.id === deckId) : undefined;
  if (deckId && deck) return <DeckDetail key={deck.id} id={deck.id} />;
  return <DeckList atlas={atlas} progress={progress} />;
}

function DeckList({ atlas, progress }: { atlas: Atlas; progress: DeckProgressSlice }) {
  const studyDecks = useStore((s) => s.settings.studyDecks);
  const [name, setName] = useState("");
  const decks = useMemo(() => progress.decks ?? [], [progress.decks]);
  const allIds = decks.map((d) => d.id);
  const range = studyRange(progress, { studyDecks });
  const paused = useMemo(() => pausedIds(atlas, progress), [atlas, progress]);
  const rows = useMemo(
    () => [
      ...decks.map((d) => ({ id: d.id, name: d.name, stats: counts(progress.cards, deckWords(atlas, progress, d.id)), note: "" })),
    ],
    [atlas, progress, decks],
  );
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const id = createDeck(name);
    setName("");
    go({ page: "decks", d: id });
  };
  const inRangeDeck = (id: string) => range.all || range.decks.some((d) => d.id === id);

  return (
    <div className="page decks">
      <header className="decks-head">
        <LexiconTabs on="decks" />
        <p className="eyebrow">图鉴 · 卡组</p>
        <h1 className="display">我的卡组</h1>
        <p className="lede">同一个词可以放进几个卡组，学习进度只有一份：在一个卡组里学会了，到别的卡组里也算学过。</p>
      </header>

      <section className="panel study-range">
        <div className="panel-head">
          <h2 className="eyebrow">今日学习范围</h2>
          {!range.all && (
            <button className="link" onClick={() => store.settings({ studyDecks: null })}>
              全部卡组
            </button>
          )}
        </div>
        <p className="study-range-note">新词和复习只从勾选的卡组里出。{range.all ? "现在是全部卡组。" : ""}</p>
        <ul className="chips" role="group" aria-label="学习范围">
          {rows.map((r) => {
            const on = inRangeDeck(r.id);
            return (
              <li key={r.id}>
                <button className={`chip-btn ${on ? "is-on" : ""}`} aria-pressed={on} onClick={() => toggleStudy(allIds, studyDecks, r.id)}>
                  {on && <Check size={14} />} {r.name}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <ul className="deck-grid">
        {rows.map((r) => (
          <li key={r.id}>
            <button className="deck-card" onClick={() => go({ page: "decks", d: r.id })}>
              <span className="deck-name">{r.name}</span>
              <span className="deck-count">
                <b>{r.stats.total.toLocaleString()}</b> 个词
              </span>
              <DeckBar stats={r.stats} />
              <span className="deck-legend">
                已掌握 {r.stats.mastered} · 学习中 {r.stats.learning} · 未学 {r.stats.fresh}
              </span>
              {inRangeDeck(r.id) && <span className="deck-flag">在学习范围</span>}
            </button>
          </li>
        ))}
        <li>
          <form className="deck-card deck-new" onSubmit={add}>
            <span className="deck-name">新建卡组</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如 旅行、《小王子》" maxLength={40} aria-label="新卡组名称" />
            <button className="btn btn-primary btn-sm" disabled={!name.trim()}>
              <Plus size={16} /> 新建
            </button>
          </form>
        </li>
      </ul>

      <DictFavs atlas={atlas} />

      {paused.length > 0 && (
        <button className="paused-note" onClick={() => go({ page: "decks", d: PAUSED })}>
          有 {paused.length} 个学过的词不在任何卡组里，已暂停复习。<span className="link">查看</span>
        </button>
      )}
    </div>
  );
}

/* ---------- 词典收藏: the dictionary's favourites, one step from review ---------- */

const FAVS_SHOWN = 24;
/** A LexDB id is the folded lemma, plus "#2" for homographs. */
const lemmaOf = (id: string) => id.replace(/#\d+$/, "");

/**
 * The words starred in the dictionary (progress.dictFavs, stored as LexDB ids) shown next to the decks, with a
 * link back to each entry and a one-click move into 阅读生词. Read-only over dictFavs: favourites stay favourites.
 */
function DictFavs({ atlas }: { atlas: Atlas }) {
  const stored = useStore((s) => s.progress.dictFavs);
  const favs = useMemo(() => stored ?? [], [stored]);
  const cards = useStore((s) => s.progress.cards);
  const decks = useStore((s) => s.progress.decks);
  const hidden = useStore((s) => s.progress.hidden);
  const coreMigrated = useStore((s) => s.progress.coreMigrated);
  const [entries, setEntries] = useState<Record<string, LexEntry | null>>({});
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const shown = all ? favs : favs.slice(0, FAVS_SHOWN);
  const atlasFor = (id: string) => {
    const e = entries[id];
    if (e) return cardFor(atlas, e.w, e.atlasId);
    // Never match homographs ("cote#2" = côte) or accent-minimal pairs by folded slug: only exact unaccented ids match offline.
    return id.includes("#") ? undefined : findExact(atlas, id)[0];
  };

  // Always load real LexDB entries for displayed favourites so accented lemmas & #N homographs resolve accurately.
  const missing = shown.filter((id) => !(id in entries)).join("\n");
  useEffect(() => {
    if (!missing) return;
    let live = true;
    void import("../lib/lexdb/load")
      .then(async ({ getEntryById }) => {
        const ids = missing.split("\n");
        const got = await Promise.all(ids.map((id) => getEntryById(id).catch(() => null)));
        if (live) setEntries((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id, i) => [id, got[i]])) }));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [missing]);

  if (!favs.length) return null;

  const addOne = async (id: string): Promise<"added" | "exists" | "skipped"> => {
    let entry = entries[id] ?? null;
    if (!(id in entries) || entry === null) {
      const { getEntryById } = await import("../lib/lexdb/load");
      entry = await getEntryById(id).catch(() => null);
      if (entry) setEntries((prev) => ({ ...prev, [id]: entry }));
    }
    const ref = entry ? cardFor(atlas, entry.w, entry.atlasId) : id.includes("#") ? undefined : findExact(atlas, id)[0];
    const w = entry?.w ?? ref?.word;
    if (!w) return "skipped";
    const lex = entry ? await import("../lib/lexdb/search") : null;
    const res = quickAddToReview(atlas, w, () => (entry && lex ? lex.entryToSeed(entry) : { w, pos: "", zh: ref?.zh ?? "", ipa: "", senses: [], ex: [], col: [], fam: [], syn: [], ant: [], note: "" }), entry?.atlasId ?? ref?.id);
    return res.status;
  };
  const moveOne = async (id: string) => {
    if (busy || pendingIds.has(id)) return;
    setPendingIds((prev) => new Set(prev).add(id));
    try {
      const st = await addOne(id);
      toast(st === "added" ? `已加入「${REVIEW_DECK}」卡组` : st === "exists" ? "这个词已在复习里" : "离线词典暂时打不开这个词，请联网后再试", st === "skipped" ? "warn" : "ok");
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };
  const moveAll = async () => {
    setBusy(true);
    let added = 0;
    let skipped = 0;
    try {
      for (const id of favs) {
        const st = await addOne(id);
        if (st === "added") added++;
        else if (st === "skipped") skipped++;
      }
    } finally {
      setBusy(false);
    }
    if (added > 0) {
      toast(`已把 ${added} 个收藏词加入「${REVIEW_DECK}」${skipped ? `，${skipped} 个离线暂未读取` : ""}`, skipped ? "warn" : "ok");
    } else if (skipped > 0) {
      toast(`离线词典暂不可用，${skipped} 个收藏词未能读取，请联网后重试`, "warn");
    } else {
      toast("收藏的词都已在复习里", "info");
    }
  };
  const pending = favs.filter((id) => {
    const ref = atlasFor(id);
    return !ref || !inReview({ cards, decks, hidden, coreMigrated }, ref.id);
  }).length;

  return (
    <section className="panel dict-favs" aria-label="词典收藏">
      <div className="panel-head">
        <div>
          <h2 className="eyebrow">
            <Star size={13} /> 词典收藏 · {favs.length} 词
          </h2>
          <p className="muted small">在词典里点过「收藏」的词。收藏只是书签，转入卡组后才会按记忆曲线复习。</p>
        </div>
        {pending > 0 && (
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void moveAll()}>
            <Plus size={14} /> {busy ? "正在加入…" : `全部加入复习卡组（${pending}）`}
          </button>
        )}
      </div>
      <ul className="dict-favs-list">
        {shown.map((id) => {
          const entry = entries[id];
          const ref = atlasFor(id);
          const word = entry?.w ?? ref?.word ?? lemmaOf(id);
          const zh = entry?.pos[0]?.senses[0]?.zh ?? ref?.zh ?? "";
          const reviewing = !!ref && inReview({ cards, decks, hidden, coreMigrated }, ref.id);
          return (
            <li key={id}>
              <a className="dict-favs-word" href={href({ page: "dict", w: entry ? entry.id : ref ? ref.word : id })} lang="fr">
                {word}
              </a>
              {zh && <span className="dict-favs-zh">{zh}</span>}
              {reviewing ? (
                <span className="dict-favs-state">
                  <Check size={13} /> 已在复习
                </span>
              ) : (
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy || pendingIds.has(id)} onClick={() => void moveOne(id)}>
                  转入复习卡组
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {favs.length > FAVS_SHOWN && (
        <button type="button" className="link small" onClick={() => setAll((v) => !v)}>
          {all ? "收起" : `显示全部 ${favs.length} 个`}
        </button>
      )}
    </section>
  );
}

function DeckBar({ stats }: { stats: { total: number; learning: number; mastered: number } }) {
  const t = Math.max(1, stats.total);
  return (
    <span className="deck-bar" aria-hidden="true">
      <i className="is-done" style={{ width: `${(stats.mastered / t) * 100}%` }} />
      <i className="is-seen" style={{ width: `${(stats.learning / t) * 100}%` }} />
    </span>
  );
}

const Back = () => (
  <button className="link deck-back" onClick={() => go({ page: "decks" })}>
    <ArrowLeft size={16} /> 全部卡组
  </button>
);

function studyOnly(id: string) {
  store.settings({ studyDecks: [id] });
  toast("今日学习范围已改为这个卡组", "ok");
  go({ page: "today" });
}

/**
 * One session with every word of the deck that has not been learned yet (and the deck's words due today),
 * whatever the daily number of new words. It replaces a journey in progress only after asking.
 */
async function studyAll(atlas: Atlas, name: string, words: WordRef[]) {
  const { progress, settings } = store.get();
  const now = Date.now();
  const fresh = words.filter((w) => !progress.cards[w.id] && isTaughtReady(w)).map((w) => w.id);
  const due = words.filter((w) => progress.cards[w.id] && progress.cards[w.id].due <= now).map((w) => w.id);
  if (!fresh.length) return toast("这个卡组里没有还没学的词了", "ok");
  const active = progress.session && !progress.session.finished;
  if (
    active &&
    !(await confirmAction({
      title: "开始卡组整组学习？",
      message: "有一段旅程还没走完。开始学这个卡组会放弃它（已经答过的题不受影响）。继续吗？",
      confirmLabel: "继续",
    }))
  )
    return;
  if (
    fresh.length >= 60 &&
    !(await confirmAction({
      title: `开始学习「${name}」？`,
      message: `「${name}」里还有 ${fresh.length} 个没学的词，一次学完大约要 ${Math.round(fresh.length * 0.9)} 分钟，接下来几天的复习也会多很多。\n可以中途停下，进度会保存。现在开始吗？`,
      confirmLabel: "开始",
    }))
  )
    return;
  const session = buildSession(atlas, progress, settings, { ids: [...due, ...fresh] });
  if (!session.steps.length) return;
  store.progress((p) => ({ ...p, session }));
  go({ page: "learn" });
}

function DeckDetail({ id }: { id: string }) {
  const atlas = useAtlas();
  const progress = useStoreShallow((s) => ({
    decks: s.progress.decks,
    cards: s.progress.cards,
    bookmarks: s.progress.bookmarks,
  }));
  const deck = progress.decks!.find((d) => d.id === id)!;
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(deck.name);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState("");
  const listRef = useRef<HTMLUListElement>(null);
  const words = useMemo(
    () => deck.words.map((w) => atlas.byId.get(w)).filter((w): w is WordRef => !!w),
    [atlas, deck.words],
  );
  const [startIdx, endIdx] = useWindowRange(listRef, DECK_ROW_H, words.length, 16);
  const visibleWords = words.length > DECK_VIRTUAL_THRESHOLD ? words.slice(startIdx, endIdx) : words;
  const stats = useMemo(() => counts(progress.cards, words.map((w) => w.id)), [progress.cards, words]);
  const bookmarkSet = useMemo(() => new Set(progress.bookmarks), [progress.bookmarks]);
  const results = useMemo(() => (q.trim() ? searchAtlas(atlas, q, 8) : []), [atlas, q]);
  const inDeck = new Set(deck.words);
  const chosen = words.filter(w => selected.has(w.id)).map(w => w.id);
  const destinations = (progress.decks ?? []).filter(d => d.id !== id);
  const validTarget = destinations.some(d => d.id === target);
  const transfer = (move: boolean) => {
    if (!chosen.length || !validTarget) return;
    store.progress(p => transferDeckWords(p, id, target, chosen, move));
    setSelected(new Set());
    toast(`已${move ? "移动" : "复制"} ${chosen.length} 个词到「${destinations.find(d => d.id === target)!.name}」`, "ok");
  };

  const remove = async () => {
    const orphans = orphanCustomWords(progress, id);
    let drop = false;
    if (orphans.length) {
      if (
        !(await confirmAction({
          title: `删除卡组「${deck.name}」？`,
          message: `其中 ${orphans.length} 个自建词只在这个卡组里。\n确定后会再问一次是否一起删除它们。`,
          confirmLabel: "继续",
          danger: true,
        }))
      )
        return;
      drop = await confirmAction({
        title: `一起删除这 ${orphans.length} 个自建词？`,
        message: "删除自建词会同时清除它们的学习记录。\n选「仅保留自建词」则会暂停复习，之后可随时加回其他卡组。",
        confirmLabel: "一起删除",
        cancelLabel: "仅保留自建词",
        danger: true,
      });
    } else if (
      !(await confirmAction({
        title: `删除卡组「${deck.name}」？`,
        message: "卡组里的词和学习记录会保留。",
        confirmLabel: "删除卡组",
        danger: true,
      }))
    )
      return;
    deleteDeck(id, drop);
    toast("卡组已删除");
    go({ page: "decks" }, null, true);
  };

  return (
    <div className="page decks deck-detail">
      <Back />
      <header className="decks-head">
        {renaming ? (
          <form
            className="deck-rename"
            onSubmit={(e) => {
              e.preventDefault();
              renameDeck(id, name);
              setRenaming(false);
            }}
          >
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus aria-label="卡组名称" />
            <button className="btn btn-primary btn-sm">保存</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenaming(false)}>
              取消
            </button>
          </form>
        ) : (
          <h1 className="display">
            {deck.name}
            {id !== FAVORITES_DECK && <button className="icon-btn" onClick={() => { setName(deck.name); setRenaming(true); }} aria-label="重命名卡组" title="重命名">
              <Pencil size={18} />
            </button>}
          </h1>
        )}
        <p className="lede">
          {stats.total} 个词 · 已掌握 {stats.mastered} · 学习中 {stats.learning} · 未学 {stats.fresh}
        </p>
        <div className="deck-actions">
          <button className="btn btn-primary" onClick={() => void studyAll(atlas, deck.name, words)} disabled={!stats.fresh}>
            <GraduationCap size={17} /> {stats.fresh ? `现在学完未学的 ${stats.fresh} 个词` : "全部学过了"}
          </button>
          <button className="btn btn-ghost" onClick={() => studyOnly(id)} disabled={!words.length}>
            只学这个卡组（每天按新词数）
          </button>
          <button className="btn btn-ghost" onClick={() => go({ page: "atlas", d: id })}>
            在图鉴里浏览
          </button>
          {id !== FAVORITES_DECK && <button className="btn btn-ghost btn-danger" onClick={() => void remove()}>
            <Trash2 size={16} /> 删除卡组
          </button>}
        </div>
      </header>

      <section className="panel deck-add">
        <label className="search">
          <Search size={19} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="加词：输入法语或中文，在词库里找" spellCheck={false} autoComplete="off" />
          {q && (
            <button className="icon-btn" onClick={() => setQ("")} aria-label="清空">
              <X size={16} />
            </button>
          )}
        </label>
        {q.trim() && (
          <ul className="deck-results">
            {results.map((w) => (
              <li key={w.id}>
                <button className="link" onClick={() => openWord(w.id)} lang="fr">
                  {w.word}
                </button>
                <span className="deck-results-zh">{w.zh}</span>
                {w.custom && <i className="chip chip-mine">自建</i>}
                <button className="btn btn-ghost btn-sm" disabled={inDeck.has(w.id)} onClick={() => addToDeck(id, w.id)}>
                  {inDeck.has(w.id) ? "已在卡组里" : <><Plus size={14} /> 加入</>}
                </button>
              </li>
            ))}
            {!/[一-鿿]/.test(q) && (
              <li className="deck-results-new">
                <span>{results.length ? "都不是？" : "词库里没有这个词。"}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setCreating(q.trim())}>
                  <Plus size={14} /> 自己添加「{q.trim()}」
                </button>
              </li>
            )}
          </ul>
        )}
        {!q.trim() && (
          <div className="deck-add-links">
            <button className="link" onClick={() => setCreating("")}>
              <Plus size={14} /> 添加词库里没有的词
            </button>
            <button className="link" onClick={() => setExtracting(true)}>
              <ScanText size={14} /> 导入词（文字 · 拍照 · 文件）
            </button>
          </div>
        )}
      </section>

      {!!words.length && <div className="deck-bulk" role="group" aria-label="批量管理单词">
        <label><input type="checkbox" checked={chosen.length === words.length} ref={el => { if (el) el.indeterminate = chosen.length > 0 && chosen.length < words.length; }} onChange={e => setSelected(e.target.checked ? new Set(words.map(w => w.id)) : new Set())} /> 全选（{words.length}）</label>
        <span className="muted">已选 {chosen.length} 个</span>
        <div className="deck-target-select">
        <select aria-label="目标卡组" value={validTarget ? target : ""} onChange={e => setTarget(e.target.value)}>
          <option value="">选择目标卡组</option>
          {destinations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
        </div>
        <button className="btn btn-ghost btn-sm" disabled={!chosen.length || !validTarget} onClick={() => transfer(false)}>复制到卡组</button>
        <button className="btn btn-primary btn-sm" disabled={!chosen.length || !validTarget} onClick={() => transfer(true)}>移动到卡组</button>
        {!!chosen.length && <button className="link" onClick={() => setSelected(new Set())}>取消选择</button>}
      </div>}
      {words.length === 0 ? (
        <p className="deck-empty">卡组还是空的。在上面搜索一个词加进来，或者在任何词条页面点「卡组」把它加进来。</p>
      ) : (
        <ul
          ref={listRef}
          className="deck-words"
          style={
            words.length > DECK_VIRTUAL_THRESHOLD
              ? {
                  paddingTop: startIdx * DECK_ROW_H,
                  paddingBottom: Math.max(0, words.length - endIdx) * DECK_ROW_H,
                }
              : undefined
          }
        >
          {visibleWords.map((w) => (
            <DeckWordRow
              key={w.id}
              deckId={id}
              w={w}
              sense={deck.sense?.[w.id] ?? 0}
              note={deck.note?.[w.id] ?? ""}
              card={progress.cards[w.id]}
              bookmarked={bookmarkSet.has(w.id)}
              selected={selected.has(w.id)}
              onSelect={() =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(w.id)) next.delete(w.id);
                  else next.add(w.id);
                  return next;
                })
              }
            />
          ))}
        </ul>
      )}

      <Sheet open={extracting} onClose={() => setExtracting(false)} label="导入词" wide>
        <h2 className="sheet-title">导入词 · 加入「{deck.name}」</h2>
        {extracting && <ExtractWords deckId={id} deckName={deck.name} onDone={() => setExtracting(false)} />}
      </Sheet>

      <Sheet open={creating !== null} onClose={() => setCreating(null)} label="添加新词">
        <h2 className="sheet-title">添加新词到「{deck.name}」</h2>
        {creating !== null && (
          <WordForm
            mode="create"
            deckId={id}
            initial={creating}
            onDone={(wid) => {
              setCreating(null);
              if (wid) setQ("");
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function stateOf(cards: Record<string, CardState>, id: string) {
  const c = cards[id];
  return c ? (isMastered(c) ? "is-mastered" : "is-learning") : "";
}

function DeckWordRow({
  deckId,
  w,
  sense,
  note,
  card,
  bookmarked,
  selected,
  onSelect,
}: {
  deckId: string;
  w: WordRef;
  sense: number;
  note: string;
  card?: CardState;
  bookmarked: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const glosses = senseGlosses(w);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note);
  const stClass = card ? (isMastered(card) ? "is-mastered" : "is-learning") : "";
  return (
    <li className="deck-word">
      <input className="deck-word-select" type="checkbox" checked={selected} onChange={onSelect} aria-label={`选择 ${w.word}`} />
      <span className={`row-dot ${stClass}`} />
      <button className="deck-word-main" onClick={() => openWord(w.id)}>
        <b lang="fr">{w.word}</b>
        {w.custom && <i className="chip chip-mine">自建</i>}
        <span className="deck-word-zh">{glosses[sense] ?? w.zh}</span>
      </button>
      <button className={`icon-btn ${bookmarked ? "is-on" : ""}`} onClick={() => toggleBookmark(w.id)} aria-pressed={bookmarked} aria-label={`${bookmarked ? "取消收藏" : "收藏"} ${w.word}`} title={bookmarked ? "取消收藏" : "收藏"}>
        {bookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
      </button>
      {glosses.length > 1 && (
        <select className="deck-sense" value={sense} onChange={(e) => setDeckSense(deckId, w.id, Number(e.target.value))} aria-label={`${w.word} 在这个卡组里学哪个意思`} title="这个卡组学哪个意思">
          {glosses.map((g, i) => (
            <option key={i} value={i}>
              义项 {i + 1}：{g.length > 14 ? `${g.slice(0, 14)}…` : g}
            </option>
          ))}
        </select>
      )}
      {editing ? (
        <form
          className="deck-note-form"
          onSubmit={(e) => {
            e.preventDefault();
            setDeckNote(deckId, w.id, text);
            setEditing(false);
          }}
        >
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="这个卡组里的备注" aria-label="这个卡组里的备注" maxLength={200} rows={4} autoFocus />
          <button className="btn btn-ghost btn-sm">好</button>
        </form>
      ) : (
        <button className={`deck-note ${note ? "" : "is-empty"}`} onClick={() => setEditing(true)} title="备注只在这个卡组里显示">
          {note || "备注"}
        </button>
      )}
      <button className="icon-btn" onClick={() => removeFromDeck(deckId, w.id)} aria-label={`${deckId === FAVORITES_DECK ? "取消收藏" : "从卡组移除"} ${w.word}`} title={deckId === FAVORITES_DECK ? "取消收藏（学习记录保留）" : "移出卡组（学习记录保留）"}>
        <X size={16} />
      </button>
    </li>
  );
}

/** Words learned before but now in no deck: their records are kept, and they come back when added to a deck. */
function PausedWords() {
  const atlas = useAtlas();
  const progress = useStoreShallow((s) => ({
    cards: s.progress.cards,
    decks: s.progress.decks,
    hidden: s.progress.hidden,
    coreMigrated: s.progress.coreMigrated,
  }));
  const ids = useMemo(() => pausedIds(atlas, progress), [atlas, progress]);
  const decks = progress.decks ?? [];
  return (
    <div className="page decks deck-detail">
      <Back />
      <header className="decks-head">
        <h1 className="display">暂停复习的词</h1>
        <p className="lede">这些词学过，但现在不在任何卡组里，所以不再安排复习。学习记录都还在，加回任何一个卡组就会接着原来的进度复习。</p>
      </header>
      {ids.length === 0 ? (
        <p className="deck-empty">没有暂停的词。</p>
      ) : (
        <ul className="deck-words">
          {ids.map((id) => {
            const w = atlas.byId.get(id)!;
            return (
              <li key={id} className="deck-word">
                <span className={`row-dot ${stateOf(progress.cards, id)}`} />
                <button className="deck-word-main" onClick={() => openWord(id)}>
                  <b lang="fr">{w.word}</b>
                  {w.custom && <i className="chip chip-mine">自建</i>}
                  <span className="deck-word-zh">{w.zh}</span>
                </button>
                <select
                  className="deck-sense"
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    addToDeck(e.target.value, id);
                    toast("已加回卡组", "ok");
                  }}
                  aria-label={`把 ${w.word} 加入卡组`}
                >
                  <option value="">加入卡组…</option>
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
