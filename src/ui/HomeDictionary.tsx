import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, ExternalLink, Plus, Search, Sparkles, X } from "lucide-react";
import { ready, useAiConfig } from "../ai/config";
import { completeGaps } from "../ai/tasks";
import { useAtlas } from "../atlas/context";
import { lookupDict, type DictHit } from "../lib/dict";
import { frdicUrl, GAP, loadFrdic, type DictionaryNode, type FrdicResult } from "../lib/frdic";
import { buildSeed, CAPACITY, dictPicks, frdicPicks, hasGap, KIND_LABEL, KINDS, tooLong, withZh, type Pick, type Seed } from "../lib/lookup";
import { isNative } from "../lib/native";
import { openWord } from "../lib/router";
import { addToDeck, createDeck, findSame } from "../store/decks";
import { store, useStore } from "../store/store";
import { Sheet } from "./Sheet";
import { toast } from "./Toast";
import { WordForm } from "./WordForm";

const TARGET_DECK = "阅读生词";

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

function PickRow({ p, on, blocked, onToggle }: { p: Pick; on: boolean; blocked: string; onToggle: () => void }) {
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
  const decks = useStore((s) => s.progress.decks) ?? [];
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

  const picks = useMemo(() => [...dictPicks(hits ?? []), ...frdicPicks(result?.items ?? [])], [hits, result]);
  const mine = useMemo(() => {
    const seen = new Set<string>();
    return [term, ...(hits ?? []).map((h) => h.w)].flatMap((n) => (n ? findSame(atlas, n) : [])).filter((w) => !seen.has(w.id) && !!seen.add(w.id));
  }, [atlas, term, hits]);

  const close = () => { job.current?.abort(); setBusy(false); setError(""); setResult(null); setHits(null); setTerm(""); setChosen([]); };
  const search = async () => {
    const word = query.trim();
    if (!word) return;
    job.current?.abort();
    const c = new AbortController(); job.current = c;
    setTerm(word); setBusy(true); setError(""); setResult(null); setHits(null); setChosen([]);
    // the offline dictionary and 法语助手 are asked separately: one failing leaves the other's answer on the screen
    void lookupDict(word).then((h) => { if (!c.signal.aborted) setHits(h); }, () => { if (!c.signal.aborted) setHits([]); });
    try { const data = await loadFrdic(word, c.signal); if (!c.signal.aborted) setResult(data); }
    catch (e) { if (!c.signal.aborted) setError((e as Error).message); }
    finally { if (!c.signal.aborted) setBusy(false); }
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
  const frdicOnly = picks.filter((p) => p.origin === "frdic");

  return <section className="home-dictionary" aria-label="查词">
    <form className="home-dictionary-search" onSubmit={e => { e.preventDefault(); void search(); }}>
      <Search size={21} aria-hidden="true" />
      <input ref={input} aria-label="搜索法语或中文" placeholder="查词：输入法语单词或短语，选好内容直接做成卡片…" value={query} onChange={e => setQuery(e.target.value)} maxLength={80} autoComplete="off" spellCheck={false} />
      <button type="submit" className="btn btn-primary btn-sm" disabled={!query.trim()}>查词</button>
    </form>
    <p className="home-dictionary-caption"><BookOpen size={14} /> 我的词库 · 离线词典 · 法语助手</p>
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

      <details className="lookup-section" open={dictOnly.length > 0}>
        <summary>离线词典 <small>{dictBusy ? "查询中…" : `${dictOnly.length} 项`}</small></summary>
        {dictOnly.length === 0 ? <p className="lookup-empty">{dictBusy ? "正在查询…" : "离线词典里没有这个词。"}</p> : <>
          {(hits ?? [])[0]?.form && <p className="muted small">「{term}」是 <span lang="fr">{hits![0].w}</span> 的变化形式。</p>}
          <Picks picks={dictOnly} chosen={list} toggle={toggle} />
        </>}
      </details>

      <details className="lookup-section" open={frdicOnly.length > 0 || !!error || busy}>
        <summary>法语助手 <small>{busy ? "查询中…" : error ? "查询失败" : `${frdicOnly.length} 项`}</small></summary>
        {busy && <p role="status" className="lookup-empty">正在查询法语助手…</p>}
        {error && <div role="alert" className="lookup-error"><p>{error}</p><button className="btn btn-ghost btn-sm" onClick={() => void search()}>重新查询</button></div>}
        {!busy && !error && frdicOnly.length === 0 && <p className="lookup-empty">法语助手里没有可以选的内容。</p>}
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

    <Sheet open={form !== null} onClose={() => setForm(null)} label="新建卡片">
      <h2 className="sheet-title">新建卡片 · 加入「{decks.find((d) => d.id === form?.deckId)?.name ?? deckName}」</h2>
      {form && <WordForm mode="create" deckId={form.deckId} seed={form.seed} onDone={(id) => { setForm(null); if (id) { close(); setQuery(""); input.current?.focus(); } }} />}
    </Sheet>
  </section>;
}
