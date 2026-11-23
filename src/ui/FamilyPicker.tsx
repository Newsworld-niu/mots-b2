import { deckWords, deckIndex, inRange, studyRange } from "../store/decks";
import { useStore } from "../store/store";
import { useMemo, useState } from "react";
import { Check, Search, X, GitBranch } from "lucide-react";
import { familiesFor, familyWords, searchFamilies, scopeFamilies, useFamilies } from "../lib/families";
import { useAtlas } from "../atlas/context";
import { Sheet } from "./Sheet";

function readRecent(): string[] {
  try { const v = JSON.parse(localStorage.getItem("word-atlas:recent-families") ?? "[]"); return Array.isArray(v) ? v.filter((id) => typeof id === "string") : []; } catch { return []; }
}
export function FamilyPicker({ value, onChange, study = false, deckId = "all" }: { value?: string[] | null; onChange: (ids: string[], deckId?: string) => void; study?: boolean; deckId?: string }) {
  const atlas = useAtlas();
  const progress = useStore(s=>s.progress);
  const [open, setOpen] = useState(false);
  const baseFamilies = useFamilies(open || Boolean(value?.length));
  const families = useMemo(()=>familiesFor(atlas,progress,baseFamilies),[atlas,progress,baseFamilies]);
  const studyDecks = useStore(s=>s.settings.studyDecks);
  const [scope, setScope] = useState(study ? "study" : deckId);
  const [draft, setDraft] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("recommended");
  const [recent, setRecent] = useState(readRecent);
  const selected = families.filter((f) => value?.includes(f.id));
  const available = useMemo(() => {
    let ids: Set<string>;
    if(scope === "all") ids=new Set(atlas.byId.keys());
    else if(scope === "study") {
      const idx=deckIndex(atlas,progress), range=studyRange(progress,{studyDecks});
      ids=new Set([...atlas.byId.keys()].filter(id=>inRange(idx,range,id)));
    } else ids=new Set(deckWords(atlas,progress,scope));
    return scopeFamilies(families,ids);
  }, [atlas, families, progress, scope, studyDecks]);
  const matches = searchFamilies(q,available);
  const shown = q.trim() ? matches : tab === "recent" ? available.filter((f) => recent.includes(f.id)) : tab === "all" ? [...available].sort((a,b) => a.name.localeCompare(b.name, "fr")) : [...available].sort((a,b) => b.words.length-a.words.length).slice(0,12);
  const count = [...(familyWords(draft,available) ?? [])].filter((id) => atlas.byId.has(id)).length;
  return <div className={`family-picker ${study ? "family-study" : ""}`}>
    <button className="family-trigger" onClick={() => { setDraft(value ?? []); setQ(""); setTab("recommended"); setScope(study ? "study" : deckId); setOpen(true); }}><GitBranch size={16} />{study ? "选择词族" : "词族"} · {selected.length ? `已选 ${selected.length}` : "全部"}</button>
    {selected.slice(0,2).map((f) => <button className="family-tag" key={f.id} onClick={() => onChange((value ?? []).filter((id) => id !== f.id))} aria-label={`移除词族 ${f.name}`}><span lang="fr">{f.name}</span><X size={12}/></button>)}
    {selected.length > 2 && <span>+{selected.length-2}</span>}
    <Sheet open={open} onClose={() => setOpen(false)} label="选择词族" className="family-sheet">
      <p className="eyebrow">MOTS EN FAMILLE</p><h2 className="sheet-title">沿着一个词，认识一整个词族</h2>
      <p className="family-intro">搜索单词或中文含义，可同时选择多个词族。</p>
      <div className="family-decks" role="group" aria-label="词族卡组范围">
        {[...(study ? [{id:"study",name:"当前学习范围"}] : []), {id:"all",name:"全部卡组"}, ...(progress.decks??[])].map(d=><button key={d.id} className={scope===d.id?"is-on":""} aria-pressed={scope===d.id} onClick={()=>setScope(d.id)}>{d.name}</button>)}
      </div>
      <label className="search"><Search size={18}/><input aria-label="搜索词族" placeholder="试试 protection、写作、工作…" value={q} onChange={(e) => setQ(e.target.value)}/>{q && <button className="icon-btn" aria-label="清空词族搜索" onClick={() => setQ("")}><X size={16}/></button>}</label>
      <div className="family-tabs" role="group" aria-label="浏览词族">{[["recommended","词族精选"],["recent","最近使用"],["all",`浏览全部 · ${available.length}`]].map(([id,label]) => <button key={id} aria-pressed={tab===id} className={tab===id?"is-on":""} onClick={() => {setTab(id);setQ("");}}>{label}</button>)}</div>
      <p className="family-source">只显示所选卡组中的词族成员；共同词族会在各相关卡组中出现。应用时同时使用上方的卡组范围。</p>
      <div className="family-results">{shown.map((f) => {
        const on = draft.includes(f.id); const words = f.words.map((id) => atlas.byId.get(id)).filter((w) => !!w);
        return <button key={f.id} className={`family-option ${on?"is-on":""}`} aria-pressed={on} onClick={() => setDraft(on ? draft.filter((id) => id!==f.id) : [...draft,f.id])}>
          <span className="family-check">{on && <Check size={15}/>}</span><span className="family-description"><strong lang="fr">{f.name}</strong><span className="family-gloss">{f.zh}</span><small lang="fr">{words.map((w) => `${w.word} — ${w.zh}`).join("；")}</small></span><span className="family-count">{words.length} 词</span>
        </button>;
      })}{!shown.length && <p className="family-empty">{tab==="recent" && !q ? "还没有最近使用的词族，先从精选里选几个吧。" : "这个卡组范围没有匹配的词族，试试其他卡组或搜索词。"}</p>}</div>
      <footer className="family-footer"><div><b>{draft.length ? `已选 ${draft.length} 个词族` : "不限词族"}</b><small>{draft.length ? `当前卡组范围共 ${count} 个词，已去重` : "查看所有词族之外的单词也不受限制"}</small></div><button className="link" onClick={() => setDraft([])}>清空</button><button className="btn btn-primary" onClick={() => {onChange(draft,scope);const next=[...new Set([...draft,...recent])].slice(0,20);setRecent(next);try {localStorage.setItem("word-atlas:recent-families",JSON.stringify(next));}catch{}setOpen(false);}}>{study ? "应用到学习范围" : "应用筛选"}</button></footer>
    </Sheet>
  </div>;
}
