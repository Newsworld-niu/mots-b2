import { createElement, useEffect, useRef, useState } from "react";
import { BookOpen, ExternalLink, Search, X } from "lucide-react";
import { frdicUrl, loadFrdic, type DictionaryNode, type FrdicResult } from "../lib/frdic";
import { isNative } from "../lib/native";

function Content({ nodes }: { nodes: DictionaryNode[] }) {
  return <>{nodes.map((node, i) => {
    if (typeof node === "string") return node;
    if (node.tag === "img") return <img key={i} className="frdic-character" src={node.src} alt="[图片字]" referrerPolicy="no-referrer" onError={e => { e.currentTarget.alt = "[字未加载]"; e.currentTarget.title = "图片字加载失败，可打开法语助手原文查看"; }} />;
    return createElement(node.tag, { key: i, className: node.className }, node.tag === "br" ? undefined : <Content nodes={node.children} />);
  })}</>;
}
export function HomeDictionary() {
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [result, setResult] = useState<FrdicResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const job = useRef<AbortController | null>(null);
  useEffect(() => () => job.current?.abort(), []);
  const close = () => { job.current?.abort(); setBusy(false); setError(""); setResult(null); setTerm(""); };
  const search = async () => {
    const word = query.trim();
    if (!word) return;
    job.current?.abort();
    const c = new AbortController(); job.current = c;
    setTerm(word); setBusy(true); setError(""); setResult(null);
    try { const data = await loadFrdic(word, c.signal); if (!c.signal.aborted) setResult(data); }
    catch (e) { if (!c.signal.aborted) setError((e as Error).message); }
    finally { if (!c.signal.aborted) setBusy(false); }
  };
  return <section className="home-dictionary" aria-label="在线法语词典">
    <form className="home-dictionary-search" onSubmit={e => { e.preventDefault(); void search(); }}>
      <Search size={21} aria-hidden="true" />
      <input aria-label="搜索法语或中文" placeholder="查词典：输入法语、中文或短语…" value={query} onChange={e => setQuery(e.target.value)} maxLength={80} autoComplete="off" spellCheck={false} />
      <button type="submit" className="btn btn-primary btn-sm" disabled={!query.trim()}>查词</button>
    </form>
    <p className="home-dictionary-caption"><BookOpen size={14} /> 法语助手 · 在线查询</p>
    {term && <div className="home-dictionary-result" aria-busy={busy}>
      <header><div><h2 lang="fr">{term}</h2><a className="link" href={result?.source ?? frdicUrl(term)} target={isNative() ? "_self" : "_blank"} rel="noopener noreferrer">来源：法语助手 <ExternalLink size={13} /></a></div><button className="icon-btn" aria-label="收起词典结果" onClick={close}><X size={20} /></button></header>
      {busy && <p role="status">正在查询法语助手…</p>}
      {error && <div role="alert"><p>{error}</p><button className="btn btn-ghost btn-sm" onClick={() => void search()}>重新查询</button></div>}
      {result && <div className="frdic-sections">{result.sections.map((section, i) => <details key={section.title} open={i === 0}><summary>{section.title}</summary><div className="frdic-content"><Content nodes={section.nodes} /></div></details>)}</div>}
    </div>}
  </section>;
}
