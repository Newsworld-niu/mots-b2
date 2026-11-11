import { ArrowLeft, Check, GraduationCap, Pencil, Plus, ScanText, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useAtlas } from "../atlas/context";
import type { Atlas, WordRef } from "../atlas/types";
import { go, openWord } from "../lib/router";
import { searchAtlas } from "../lib/search";
import {
  addToDeck,
  CORE_NAME,
  createDeck,
  deckWords,
  deleteDeck,
  orphanCustomWords,
  pausedIds,
  removeFromDeck,
  renameDeck,
  senseGlosses,
  setDeckNote,
  setDeckSense,
  setHidden,
  studyRange,
} from "../store/decks";
import { isMastered } from "../store/srs";
import { CORE_DECK, store, useStore, type Progress } from "../store/store";
import { Sheet } from "../ui/Sheet";
import { toast } from "../ui/Toast";
import { WordForm } from "../ui/WordForm";
import { ExtractWords } from "../ui/ExtractWords";

const PAUSED = "paused";

function counts(p: Progress, ids: string[]) {
  let learning = 0;
  let mastered = 0;
  for (const id of ids) {
    const c = p.cards[id];
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

export function Decks({ deckId }: { deckId?: string }) {
  const atlas = useAtlas();
  const progress = useStore((s) => s.progress);
  if (deckId === PAUSED) return <PausedWords />;
  if (deckId === CORE_DECK) return <CoreDeck />;
  const deck = deckId ? progress.decks?.find((d) => d.id === deckId) : undefined;
  if (deckId && deck) return <DeckDetail id={deck.id} />;
  return <DeckList atlas={atlas} progress={progress} />;
}

function DeckList({ atlas, progress }: { atlas: Atlas; progress: Progress }) {
  const studyDecks = useStore((s) => s.settings.studyDecks);
  const [name, setName] = useState("");
  const decks = progress.decks ?? [];
  const allIds = [CORE_DECK, ...decks.map((d) => d.id)];
  const range = studyRange(progress, { studyDecks });
  const paused = useMemo(() => pausedIds(atlas, progress), [atlas, progress]);
  const rows = useMemo(
    () => [
      { id: CORE_DECK, name: CORE_NAME, stats: counts(progress, deckWords(atlas, progress, CORE_DECK)), note: `${(progress.hidden?.length ?? 0).toLocaleString()} 个已隐藏` },
      ...decks.map((d) => ({ id: d.id, name: d.name, stats: counts(progress, deckWords(atlas, progress, d.id)), note: "" })),
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
  const inRangeDeck = (id: string) => range.all || (id === CORE_DECK ? range.core : range.decks.some((d) => d.id === id));

  return (
    <div className="page decks">
      <header className="decks-head">
        <p className="eyebrow">图鉴 · 卡组</p>
        <h1 className="display">我的卡组</h1>
        <p className="lede">同一个词可以放进几个卡组，学习进度只有一份：在一个卡组里学会了，到别的卡组里也算学过。</p>
      </header>

      <section className="panel study-range">
        <div className="panel-head">
          <h3 className="eyebrow">今日学习范围</h3>
          {!range.all && (
            <button className="link" onClick={() => store.settings({ studyDecks: null })}>
              全部卡组
            </button>
          )}
        </div>
        <p className="study-range-note">新词和复习只从勾选的卡组里出。{range.all ? "现在是全部卡组；自建卡组里的新词排在初始词本前面。" : ""}</p>
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
            <button className={`deck-card ${r.id === CORE_DECK ? "is-core" : ""}`} onClick={() => go({ page: "decks", d: r.id })}>
              <span className="deck-name">{r.name}</span>
              <span className="deck-count">
                <b>{r.stats.total.toLocaleString()}</b> 个词{r.id === CORE_DECK && r.note ? ` · ${r.note}` : ""}
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

      {paused.length > 0 && (
        <button className="paused-note" onClick={() => go({ page: "decks", d: PAUSED })}>
          有 {paused.length} 个学过的词不在任何卡组里，已暂停复习。<span className="link">查看</span>
        </button>
      )}
    </div>
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

function DeckDetail({ id }: { id: string }) {
  const atlas = useAtlas();
  const progress = useStore((s) => s.progress);
  const deck = progress.decks!.find((d) => d.id === id)!;
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(deck.name);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState<string | null>(null);
  const [limit, setLimit] = useState(300);
  const [extracting, setExtracting] = useState(false);
  const words = deck.words.map((w) => atlas.byId.get(w)).filter((w): w is WordRef => !!w);
  const stats = counts(progress, words.map((w) => w.id));
  const results = useMemo(() => (q.trim() ? searchAtlas(atlas, q, 8) : []), [atlas, q]);
  const inDeck = new Set(deck.words);

  const remove = () => {
    const orphans = orphanCustomWords(progress, id);
    let drop = false;
    if (orphans.length) {
      if (!confirm(`删除卡组「${deck.name}」？\n其中 ${orphans.length} 个自建词只在这个卡组里。\n确定后会再问一次是否一起删除它们。`)) return;
      drop = confirm(`一起删除这 ${orphans.length} 个自建词和它们的学习记录吗？\n选「取消」则保留它们（暂停复习，以后可以加回卡组）。`);
    } else if (!confirm(`删除卡组「${deck.name}」？卡组里的词和学习记录会保留。`)) return;
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
            <button className="icon-btn" onClick={() => { setName(deck.name); setRenaming(true); }} aria-label="重命名卡组" title="重命名">
              <Pencil size={18} />
            </button>
          </h1>
        )}
        <p className="lede">
          {stats.total} 个词 · 已掌握 {stats.mastered} · 学习中 {stats.learning} · 未学 {stats.fresh}
        </p>
        <div className="deck-actions">
          <button className="btn btn-primary" onClick={() => studyOnly(id)} disabled={!words.length}>
            <GraduationCap size={17} /> 只学这个卡组
          </button>
          <button className="btn btn-ghost btn-danger" onClick={remove}>
            <Trash2 size={16} /> 删除卡组
          </button>
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

      {words.length === 0 ? (
        <p className="deck-empty">卡组还是空的。在上面搜索一个词加进来，或者在任何词条页面点「卡组」把它加进来。</p>
      ) : (
        <ul className="deck-words">
          {words.slice(0, limit).map((w) => (
            <DeckWordRow key={w.id} deckId={id} w={w} sense={deck.sense?.[w.id] ?? 0} note={deck.note?.[w.id] ?? ""} progress={progress} />
          ))}
          {words.length > limit && (
            <li className="deck-more">
              <button className="btn btn-ghost" onClick={() => setLimit((l) => l + 300)}>
                再显示 300 个（共 {words.length}）
              </button>
            </li>
          )}
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

function stateOf(p: Progress, id: string) {
  const c = p.cards[id];
  return c ? (isMastered(c) ? "is-mastered" : "is-learning") : "";
}

function DeckWordRow({ deckId, w, sense, note, progress }: { deckId: string; w: WordRef; sense: number; note: string; progress: Progress }) {
  const glosses = senseGlosses(w);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note);
  return (
    <li className="deck-word">
      <span className={`row-dot ${stateOf(progress, w.id)}`} />
      <button className="deck-word-main" onClick={() => openWord(w.id)}>
        <b lang="fr">{w.word}</b>
        {w.custom && <i className="chip chip-mine">自建</i>}
        <span className="deck-word-zh">{glosses[sense] ?? w.zh}</span>
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
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="这个卡组里的备注" maxLength={200} autoFocus />
          <button className="btn btn-ghost btn-sm">好</button>
        </form>
      ) : (
        <button className={`deck-note ${note ? "" : "is-empty"}`} onClick={() => setEditing(true)} title="备注只在这个卡组里显示">
          {note || "备注"}
        </button>
      )}
      <button className="icon-btn" onClick={() => removeFromDeck(deckId, w.id)} aria-label={`从卡组移除 ${w.word}`} title="移出卡组（学习记录保留）">
        <X size={16} />
      </button>
    </li>
  );
}

function CoreDeck() {
  const atlas = useAtlas();
  const progress = useStore((s) => s.progress);
  const hidden = (progress.hidden ?? []).map((id) => atlas.byId.get(id)).filter((w): w is WordRef => !!w);
  const total = atlas.words.length - hidden.length;
  return (
    <div className="page decks deck-detail">
      <Back />
      <header className="decks-head">
        <h1 className="display">{CORE_NAME}</h1>
        <p className="lede">
          词库自带的 {total.toLocaleString()} 个词，按学习路线排序。在词条页面的「卡组」里取消勾选「{CORE_NAME}」就能把一个词隐藏起来；隐藏的词如果还在别的卡组里，照样会学。
        </p>
        <div className="deck-actions">
          <button className="btn btn-primary" onClick={() => studyOnly(CORE_DECK)}>
            <GraduationCap size={17} /> 只学初始词本
          </button>
          <button className="btn btn-ghost" onClick={() => go({ page: "atlas" })}>
            在图鉴里浏览
          </button>
        </div>
      </header>
      <h3 className="eyebrow">已隐藏 · {hidden.length}</h3>
      {hidden.length === 0 ? (
        <p className="deck-empty">还没有隐藏任何词。</p>
      ) : (
        <ul className="deck-words">
          {hidden.map((w) => (
            <li key={w.id} className="deck-word">
              <span className={`row-dot ${stateOf(progress, w.id)}`} />
              <button className="deck-word-main" onClick={() => openWord(w.id)}>
                <b lang="fr">{w.word}</b>
                <span className="deck-word-zh">{w.zh}</span>
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setHidden(w.id, false)}>
                恢复
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Words learned before but now in no deck: their records are kept, and they come back when added to a deck. */
function PausedWords() {
  const atlas = useAtlas();
  const progress = useStore((s) => s.progress);
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
                <span className={`row-dot ${stateOf(progress, id)}`} />
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
                  {!w.custom && <option value={CORE_DECK}>{CORE_NAME}</option>}
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
