import { isNative } from "../lib/native";
import { WikiImport } from "./WikiImport";
import { DictionaryLinks } from "./DictionaryLinks";
import { cleanFamily, mergeFamily, familiesFor, familyPair, familyHead, useFamilies } from "../lib/families";
import { BookOpen, ImageOff, ImagePlus, Palette, Plus, RefreshCw, Search, Sparkles, Trash2 } from "lucide-react";
import { ready, useAiConfig } from "../ai/config";
import { anotherExample, fillCard, suggestFamily, pictureFor, suggestExtras, type Extras } from "../ai/tasks";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAtlas } from "../atlas/context";
import { openWord } from "../lib/router";
import { addToDeck, cleanCollocations, createCustomWord, deleteCustomWord, findSame, setWordEdit, updateCustomWord } from "../store/decks";
import { MAX_COLLOCATIONS, MAX_EXAMPLES, MAX_OWN_SENSES, MAX_TIP, useStore, type OwnSense, type UserExample } from "../store/store";
import { joinGlosses, lookupDict, type DictHit } from "../lib/dict";
import type { Seed } from "../lib/lookup";
import { fileToImage, setImage, useImages } from "../store/images";
import { pictureFromUrl, searchPictures, type PictureHit } from "../lib/picture";
import { confirmAction } from "./ConfirmSheet";
import { toast } from "./Toast";

export const POS_CHOICES: [string, string][] = [
  ["n.m.", "阳性名词（un）"],
  ["n.f.", "阴性名词（une）"],
  ["n.", "名词（阴阳同形 / 复数）"],
  ["v.", "动词"],
  ["adj.", "形容词"],
  ["adv.", "副词"],
  ["loc.", "短语 / 表达"],
  ["prép.", "介词"],
  ["conj.", "连词"],
  ["pron.", "代词"],
  ["interj.", "感叹词"],
  ["", "其他"],
];

type Props =
  | { mode: "create"; deckId?: string; initial?: string; /** Content picked from a lookup: the form starts with it (自动填写·待核对). */ seed?: Seed; onDone: (id: string | null) => void }
  | { mode: "custom"; id: string; onDone: (id: string | null) => void }
  | { mode: "atlas"; id: string; original: { zh: string }; onDone: (id: string | null) => void };

/**
 * The card's examples. With the 生成卡片 service set up, each row has an AI button: it writes a sentence into an empty
 * row and replaces the sentence of a filled one with a different one.
 */
function Examples({ list, onChange, word, meaning }: { list: UserExample[]; onChange: (l: UserExample[]) => void; word: string; meaning: string }) {
  const ai = useAiConfig();
  const [busy, setBusy] = useState<number | null>(null);
  const job = useRef<AbortController | null>(null);
  useEffect(() => () => job.current?.abort(), []);
  const set = (i: number, patch: Partial<UserExample>) => onChange(list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const renew = async (i: number) => {
    if (!word.trim()) return toast("先填法语", "warn");
    const c = new AbortController();
    job.current = c;
    setBusy(i);
    try {
      const x = await anotherExample({ word: word.trim(), meaning: meaning.trim(), replaces: list[i].fr.trim(), avoid: list.map((e) => e.fr.trim()) }, c.signal);
      if (c.signal.aborted) return;
      if (!x.fr) return toast("AI 没有写出例句，再试一次", "warn");
      onChange(list.map((e, j) => (j === i ? { fr: x.fr, zh: x.zh } : e)));
    } catch (e) {
      if (!c.signal.aborted) toast((e as Error).message, "warn");
    } finally {
      if (job.current === c) setBusy(null);
    }
  };
  return (
    <div className="wf-examples">
      {list.map((x, i) => (
        <div key={i} className="wf-example">
          <input lang="fr" value={x.fr} onChange={(e) => set(i, { fr: e.target.value, src: undefined, hl: undefined })} placeholder="法语例句，例如 Je mange un avocat." maxLength={400} spellCheck={false} />
          <input value={x.zh} onChange={(e) => set(i, { zh: e.target.value })} placeholder="中文翻译（可不填）" maxLength={400} />
          <div className="wf-example-tools">
            {ready.text(ai) && (
              <button type="button" className="icon-btn" onClick={() => renew(i)} disabled={busy !== null} aria-label={x.fr.trim() ? "让 AI 换一句" : "让 AI 写一句"} title={x.fr.trim() ? "不满意？让 AI 换一句" : "让 AI 写一句"}>
                {busy === i ? <RefreshCw size={16} className="spin" /> : x.fr.trim() ? <RefreshCw size={16} /> : <Sparkles size={16} />}
              </button>
            )}
            {list.length > 1 && (
              <button type="button" className="icon-btn" onClick={() => onChange(list.filter((_, j) => j !== i))} aria-label="删除这条例句" title="删除这条例句">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      ))}
      {list.length < MAX_EXAMPLES && (
        <button type="button" className="link" onClick={() => onChange([...list, { fr: "", zh: "" }])}>
          <Plus size={14} /> 再加一条例句
        </button>
      )}
    </div>
  );
}

/** Further meanings, each on its own line of the card (after the first one above). */
function MoreSenses({ list, onChange, atlasMode }: { list: OwnSense[]; onChange: (l: OwnSense[]) => void; atlasMode: boolean }) {
  const set = (i: number, patch: Partial<OwnSense>) => onChange(list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="wf-field">
      <span>{atlasMode ? "我加的意思（排在词库义项后面）" : "其他意思（不同的意思分开写，卡片上各占一行）"}</span>
      <div className="wf-senses">
        {list.map((x, i) => (
          <div key={i} className="wf-sense wf-extra-sense">
            <select value={POS_CHOICES.some(([k]) => k === x.pos) ? x.pos : ""} onChange={(e) => set(i, { pos: e.target.value })} aria-label="词性">
              {POS_CHOICES.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <input value={x.zh} onChange={(e) => set(i, { zh: e.target.value })} placeholder="例如 牛油果" maxLength={300} aria-label="中文意思" />
            <button type="button" className="icon-btn" onClick={() => onChange(list.filter((_, j) => j !== i))} aria-label="删除这个意思" title="删除这个意思">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {list.length < MAX_OWN_SENSES && (
          <button type="button" className="link" onClick={() => onChange([...list, { pos: "", zh: "" }])}>
            <Plus size={14} /> 再加一个意思
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Add a word the atlas does not have, edit one the learner made, or change an atlas word's gloss and examples.
 * A changed atlas word reads the same in every deck (progress and text belong to the word).
 */
export function WordForm(props: Props) {
  const atlas = useAtlas();
  const custom = useStore((s) => (props.mode === "custom" ? s.progress.custom?.[props.id] : undefined));
  const edit = useStore((s) => (props.mode === "atlas" ? s.progress.edits?.[props.id] : undefined));
  const deckWords = useStore((s) => (props.mode === "create" && props.deckId ? s.progress.decks?.find((d) => d.id === props.deckId)?.words : undefined));
  const seed = props.mode === "create" ? props.seed : undefined;
  const [w, setW] = useState(props.mode === "create" ? props.initial ?? seed?.w ?? "" : custom?.w ?? "");
  const [pos, setPos] = useState(custom?.pos ?? (seed ? (POS_CHOICES.some(([k]) => k === seed.pos) ? seed.pos : "") : "n.m."));
  const [zh, setZh] = useState(props.mode === "atlas" ? edit?.zh ?? "" : custom?.zh ?? seed?.zh ?? "");
  // an atlas word: the atlas's own glosses and examples (kept in `orig` once the word has been changed)
  const shown = props.mode === "atlas" ? atlas.peek(props.id) : undefined;
  const origSenses = shown?.orig?.senses ?? shown?.senses.map((s) => s.zh) ?? [];
  const origEx = shown?.orig?.ex ?? shown?.ex ?? [];
  const [glosses, setGlosses] = useState<string[]>(() => (props.mode === "atlas" ? edit?.zhMore ?? [] : []));
  const [hideEx, setHideEx] = useState<number[]>(() => (props.mode === "atlas" ? edit?.hideEx ?? [] : []));
  const [ipa, setIpa] = useState(custom?.ipa ?? seed?.ipa ?? "");
  // custom words: the note is the card's 注意点; atlas words: an own 注意点 shown before the atlas tip
  const [note, setNote] = useState(props.mode === "atlas" ? shown?.tip ?? "" : custom?.note ?? seed?.note ?? "");
  const [col, setCol] = useState<Pair[]>(() => toPairs(props.mode === "atlas" ? shown?.col : custom?.col ?? seed?.col));
  const [ex, setEx] = useState<UserExample[]>(() => {
    const src = props.mode === "atlas" ? edit?.ex : custom?.ex ?? seed?.ex;
    return src?.length ? src.map((x) => ({ ...x })) : [{ fr: "", zh: "" }];
  });
  // further meanings, each shown on its own line of the card
  const progress = useStore(s=>s.progress);
  const baseFamilies = useFamilies();
  const famTouchedRef = useRef(false);
  const [fam, setFamRaw] = useState<string[]>(() => (props.mode === "atlas" ? edit?.fam ?? familiesFor(atlas,progress,baseFamilies).find(f=>f.id===props.id)?.examples : custom?.fam ?? seed?.fam) ?? []);
  const setFam = (next: string[] | ((prev: string[]) => string[])) => {
    famTouchedRef.current = true;
    setFamRaw(next);
  };
  const atlasId = props.mode === "atlas" ? props.id : "";
  useEffect(() => {
    if (!atlasId || edit?.fam || famTouchedRef.current || !baseFamilies.length) return;
    setFamRaw(familiesFor(atlas, progress, baseFamilies).find((f) => f.id === atlasId)?.examples ?? []);
  }, [atlasId, edit?.fam, baseFamilies, atlas, progress]);
  const familyRows = fam.map((value) => {
    const pair = familyPair(value);
    const match = [...atlas.byId.values()].find((r) => familyHead(r.word) === familyHead(pair.fr));
    return { ...pair, zh: pair.zh || (!value.includes("｜") ? match?.zh : "") || "" };
  });
  const changeFamily = (i: number, patch: Partial<{fr:string;zh:string}>) => setFam(familyRows.map((r,j)=> {
    const next = j===i ? {...r,...patch} : r;
    return `${next.fr}｜${next.zh}`;
  }));
  const savedFamily = cleanFamily(familyRows.map(r=>`${r.fr}｜${r.zh}`));
  const [familyBusy, setFamilyBusy] = useState(false);
  const [wikiSources,setWikiSources] = useState<string[]>((props.mode === "atlas" ? edit?.wikiSources : custom?.wikiSources) ?? []);
  const [more, setMore] = useState<OwnSense[]>(() => (props.mode === "atlas" ? edit?.senses : custom?.senses ?? seed?.senses)?.map((x) => ({ ...x, pos: POS_CHOICES.some(([k]) => k === x.pos) ? x.pos : "" })) ?? []);
  // near and opposite words: kept on the card (picked from a lookup), taken off here
  const [syn, setSyn] = useState<string[]>(() => custom?.syn ?? seed?.syn ?? []);
  const [ant, setAnt] = useState<string[]>(() => custom?.ant ?? seed?.ant ?? []);
  // filled from the offline dictionary in this form: saved as 自动填写·待核对
  const [auto, setAuto] = useState(!!seed);
  const stored = useImages()[props.mode === "create" ? "" : props.id];
  const [image, setImageState] = useState<string | null | undefined>(undefined); // undefined = unchanged
  const picture = image === undefined ? stored ?? null : image;
  const [imgMode, setImgMode] = useState<ImageMode>(() => ((props.mode === "atlas" ? edit?.noImg : custom?.noImg) ? "none" : "upload"));
  const noImg = imgMode === "none";

  const hits = useDictHits(props.mode === "atlas" ? "" : w);
  const fill = (h: DictHit) => {
    setW(h.w);
    setPos(POS_CHOICES.some(([k]) => k === h.p) ? h.p : "");
    if (h.ipa) setIpa(h.ipa);
    if (h.zh?.length) setZh(joinGlosses(h.zh));
    const blank = ex.every((x) => !x.fr.trim());
    if (blank && h.ex?.length) setEx(h.ex.slice(0, 2).map(([fr, z, a, b]) => ({ fr, zh: z, src: "tatoeba", hl: [a, b] })));
    setAuto(true);
  };
  // AI 填写: the word's meanings (listed separately), one example for each, and the pronunciation
  const ai = useAiConfig();
  const [filling, setFilling] = useState(false);
  const [filled, setFilled] = useState(false);
  const fillJob = useRef<AbortController | null>(null);
  // sentences the AI wrote in this form: filling again replaces them, and leaves the learner's own alone
  const aiWrote = useRef(new Set<string>());
  useEffect(() => () => fillJob.current?.abort(), []);
  const aiFill = async (all = false) => {
    const word = (props.mode === "atlas" ? atlas.byId.get(props.id)?.word ?? "" : w).trim();
    if (!word) return toast("先填法语", "warn");
    const job = new AbortController();
    fillJob.current = job;
    setFilling(true);
    try {
      // the meaning typed by the learner is kept as the first one; one the AI wrote before is written anew
      const given = filled || zh.includes("□") ? "" : zh.trim();
      const f = await fillCard({ word, ...(given ? { given } : {}) }, job.signal);
      if (job.signal.aborted) return;
      if (!f.valid) return toast(`AI 没有把「${word}」认作要学的法语词，请自己填写`, "warn");
      const [first, ...rest] = f.senses;
      const blankZh = !zh.trim() || zh.includes("□");
      if (!all || blankZh) setZh(first.zh);
      if (!all || blankZh) setPos(POS_CHOICES.some(([k]) => k === first.pos) ? first.pos : "");
      if (!all || !more.length) setMore(rest.map((s) => ({ pos: POS_CHOICES.some(([k]) => k === s.pos) ? s.pos : "", zh: s.zh })));
      if (f.ipa && (!all || !ipa.trim())) setIpa(f.ipa);
      const kept = ex.filter((x) => x.fr.trim() && (all || !aiWrote.current.has(x.fr.trim())));
      const fresh = f.senses.filter((s) => s.example && !kept.some((x) => x.fr.trim() === s.example)).map((s) => ({ fr: s.example, zh: s.exampleZh }));
      aiWrote.current = new Set(fresh.map((x) => x.fr));
      const next = [...kept, ...fresh].slice(0, MAX_EXAMPLES);
      setEx(next.length ? next : [{ fr: "", zh: "" }]);
      setFam(current => mergeFamily(current, f.fam));
      setAuto(true);
      setFilled(true);
      if (all) {
        const failures: string[] = [];
        try {
          const extras = await suggestExtras({word, pos:first.pos, zh:zh.trim() || first.zh, have:col.map(c=>c.fr)}, job.signal);
          if (job.signal.aborted) return;
          setCol(current => [...current, ...extras.col.filter(x=>!current.some(c=>c.fr===x.fr))].slice(0,MAX_COLLOCATIONS));
          setNote(current => [...new Set([...current.split("\n").filter(Boolean),...extras.tips])].join("\n").slice(0,MAX_TIP));
        } catch(e) { failures.push(`搭配和注意点：${(e as Error).message}`); }
        if (!picture && imgMode === "ai") {
          try {
            if (!ready.image(ai)) throw new Error("请先配置图片接口");
            const blob = await pictureFor(word, zh.trim() || first.zh, job.signal);
            const result = await fileToImage(new File([blob],"ai.png",{type:blob.type}));
            if (!job.signal.aborted) setImageState(result);
          } catch(e) { failures.push(`图片：${(e as Error).message}`); }
        }
        if (!job.signal.aborted) toast(failures.length ? `文字已填写；${failures.join("；")}` : "一键补全完成，请核对后保存", failures.length ? "warn" : "ok");
        return;
      }
      const n = f.senses.length;
      toast(f.fix && f.fix !== word ? `已填写 ${n} 个意思；AI 认为拼写应为「${f.fix}」，请核对` : `已填写 ${n} 个意思，每个意思一条例句；请核对`, "ok");
    } catch (e) {
      if (!job.signal.aborted) toast((e as Error).message, "warn");
    } finally {
      if (fillJob.current === job) setFilling(false);
    }
  };
  const addGloss = (g: string) => setZh((z) => (z.split("；").includes(g) ? z : z.trim() ? `${z}；${g}` : g));
  // 不要图片 also drops a picture the word had, so a later change of mind starts clean
  const savePicture = (id: string) => (noImg ? stored && void setImage(id, null) : image !== undefined && void setImage(id, image));

  // the same word already in the atlas or among the learner's words: link it instead of making a second copy
  const same = useMemo(() => (props.mode === "create" && w.trim() ? findSame(atlas, w) : []), [atlas, w, props.mode]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (filling || familyBusy) return toast("AI 还在生成，请稍候再保存", "warn");
    if (props.mode === "atlas") {
      setWordEdit(props.id, { replaceContent: true, syn: shown?.syn ?? [], ant: shown?.ant ?? [], zh, zhMore: glosses, ex, hideEx, noImg, col: fromPairs(col), tip: note, senses: more, fam: savedFamily, wikiSources });
      savePicture(props.id);
      toast("已保存，所有卡组里都会这样显示", "ok");
      return props.onDone(props.id);
    }
    if (!w.trim() || !zh.trim()) return toast("法语和中文意思都要填", "warn");
    if (props.mode === "custom") {
      updateCustomWord(props.id, { w, pos, zh, ipa, ex, note, auto, noImg, col: fromPairs(col), senses: more, fam: savedFamily, syn, ant, wikiSources });
      savePicture(props.id);
      toast("已保存", "ok");
      return props.onDone(props.id);
    }
    const id = createCustomWord({ w, pos, zh, ipa, ex, note, auto, noImg, col: fromPairs(col), senses: more, fam: savedFamily, syn, ant, wikiSources }, props.deckId);
    savePicture(id);
    toast(props.deckId ? "已加入卡组" : "已添加", "ok");
    props.onDone(id);
  };

  if (props.mode === "custom" && !custom) return <p className="wf-empty">这个词已经删除了。</p>;

  return (
    <form className="word-form" onSubmit={submit}>
      {ready.text(ai) && <div className="wf-all-ai">
        <button type="button" className="btn btn-primary" onClick={() => aiFill(true)} disabled={filling || familyBusy}><Sparkles size={16}/>{filling ? "AI 正在补全…" : "一键 AI 补全"}</button>
        <p className="wf-hint">补全意思、音标、例句、词族、搭配和注意点。保留已有内容；图片选「AI 生成」且没有图片时一并生成。</p>
      </div>}
      {props.mode !== "atlas" ? (
        <>
          <label className="wf-field">
            <span>法语 *</span>
            <input lang="fr" value={w} onChange={(e) => setW(e.target.value)} placeholder="例如 avocat" maxLength={80} spellCheck={false} autoFocus={!w} required />
          </label>
          {same.length > 0 && (
            <div className="wf-same" role="status">
              <p>已经有这个词了，直接加入就能共用学习进度：</p>
              <ul>
                {same.slice(0, 4).map((s) => {
                  const inDeck = deckWords?.includes(s.id);
                  return (
                    <li key={s.id}>
                      <button type="button" className="link" onClick={() => openWord(s.id)} lang="fr">
                        {s.word}
                      </button>
                      <span>{s.zh}</span>
                      {s.custom && <i className="chip chip-mine">自建</i>}
                      {props.mode === "create" && props.deckId && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={inDeck}
                          onClick={() => {
                            addToDeck(props.deckId!, s.id);
                            toast("已加入卡组", "ok");
                            props.onDone(s.id);
                          }}
                        >
                          {inDeck ? "已在卡组里" : "加入这个"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {hits && <DictPanel hits={hits} word={w} onFill={fill} onGloss={addGloss} deckId={props.mode === "create" ? props.deckId : undefined} deckWords={deckWords} onLinked={props.onDone} />}
          <DictionaryLinks word={w} />
          <div className="wf-ai">
            {ready.text(ai) ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => aiFill()} disabled={filling || !w.trim()}>
                <Sparkles size={15} /> {filling ? "AI 填写中…" : filled ? "不满意？让 AI 重新填写" : "AI 填写意思和例句"}
              </button>
            ) : (
              <p className="wf-hint">在「我的 → AI 接口」设置好「生成卡片」的服务后，这里可以让 AI 填写意思和例句。</p>
            )}
          </div>
          <div className="wf-row">
            <label className="wf-field">
              <span>词性</span>
              <select value={pos} onChange={(e) => setPos(e.target.value)}>
                {POS_CHOICES.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="wf-field">
              <span>音标（可不填）</span>
              <input value={ipa} onChange={(e) => setIpa(e.target.value)} placeholder="avɔka" maxLength={80} spellCheck={false} />
            </label>
          </div>
          <label className="wf-field">
            <span>中文意思 *</span>
            <input value={zh} onChange={(e) => setZh(e.target.value)} placeholder="例如 律师；牛油果" maxLength={300} required />
          </label>
        </>
      ) : (
        <div className="wf-field">
          <span>中文意思（改成你认为更准确的；留空用词库原文）</span>
          {(origSenses.length ? origSenses : [props.original.zh]).map((o, i) => (
            <label key={i} className="wf-sense">
              {origSenses.length > 1 && <b>{i + 1}</b>}
              <input
                value={i === 0 ? zh : glosses[i - 1] ?? ""}
                onChange={(e) => (i === 0 ? setZh(e.target.value) : setGlosses((m) => Array.from({ length: Math.max(m.length, i) }, (_, k) => (k === i - 1 ? e.target.value : m[k] ?? ""))))}
                placeholder={o}
                maxLength={300}
                aria-label={`义项 ${i + 1} 的中文`}
              />
              {!(i === 0 ? zh : glosses[i - 1]) && (
                <button type="button" className="link" onClick={() => (i === 0 ? setZh(o) : setGlosses((m) => Array.from({ length: Math.max(m.length, i) }, (_, k) => (k === i - 1 ? o : m[k] ?? ""))))}>
                  从原文改
                </button>
              )}
            </label>
          ))}
        </div>
      )}
      {props.mode === "atlas" && origEx.length > 0 && (
        <div className="wf-field">
          <span>词库例句（不合适的可以去掉，或改写成自己的）</span>
          <ul className="wf-orig-ex">
            {origEx.map((x, i) => {
              const off = hideEx.includes(i);
              return (
                <li key={i} className={off ? "is-off" : ""}>
                  <p lang="fr">{x.en}</p>
                  {x.zh && <small>{x.zh}</small>}
                  <div>
                    <button type="button" className="link" onClick={() => setHideEx((h) => (off ? h.filter((n) => n !== i) : [...h, i]))}>
                      {off ? "恢复这句" : "去掉这句"}
                    </button>
                    {!off && (
                      <button
                        type="button"
                        className="link"
                        onClick={() => {
                          setHideEx((h) => [...h, i]);
                          setEx((l) => [...l.filter((e) => e.fr.trim() || e.zh.trim()), { fr: x.en, zh: x.zh }]);
                        }}
                      >
                        改写
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <WikiImport word={props.mode === "atlas" ? atlas.byId.get(props.id)?.word ?? "" : w} onImport={(items, source) => {
        const senses=items.filter(x=>x.kind==="sense");
        const examples=items.filter(x=>x.kind==="example");
        const related=items.filter(x=>x.kind==="family");
        const nextMore=[...more];
        let main=zh.trim() || (props.mode==="atlas" ? props.original.zh : "");
        let mainPos=pos;
        for(const item of senses) {
          if(!main) {main=item.zh;mainPos=item.pos;}
          else if(main!==item.zh&&!nextMore.some(x=>x.zh===item.zh)) nextMore.push({pos:item.pos,zh:item.zh});
        }
        const nextEx=ex.filter(x=>x.fr.trim());
        for(const item of examples) if(!nextEx.some(x=>x.fr===item.fr)) nextEx.push({fr:item.fr,zh:item.zh});
        const nextFam=mergeFamily(fam,related.map(x=>`${x.fr}｜${x.zh}`));
        if(nextMore.length>MAX_OWN_SENSES || nextEx.length>MAX_EXAMPLES || examples.some(x=>x.fr.length>400||x.zh.length>400) || senses.some(x=>x.zh.length>300)) {
          toast("超过卡片容量（6 个其他意思、5 条例句；释义 300 字、例句 400 字），请缩短内容或减少勾选后重试", "warn");return false;
        }
        if (related.some(x=>x.fr.length>80||x.zh.length>38) || new Set([...fam,...related.map(x=>x.fr)].map(familyHead)).size>12) {
          toast("同族词最多 12 个，法语最多 80 字、中文最多 38 字，请缩短内容或减少勾选后重试", "warn");return false;
        }
        if (!wikiSources.includes(source) && wikiSources.length>=20) {toast("这张卡片的词典来源已达上限", "warn");return false;}
        setZh(main);setPos(mainPos);
        setMore(nextMore);setEx(nextEx.length?nextEx:[{fr:"",zh:""}]);setFam(nextFam);
        setWikiSources(current=>[...new Set([...current,source])]);
        toast("已追加到表单，请核对并保存卡片", "ok");return true;
      }}/>
      {wikiSources.length>0 && <div className="wf-hint">导入来源：{wikiSources.map((url,i)=><a key={url} href={url} target={isNative() ? "_self" : "_blank"} rel="noopener noreferrer">Wiktionnaire 原文 {i+1} · CC BY-SA </a>)}</div>}
      <MoreSenses list={more} onChange={setMore} atlasMode={props.mode === "atlas"} />
      <div className="wf-field">
        <span>{props.mode === "atlas" ? "我的例句（排在词库例句前面，填空题会先用它；点上面的「改写」会把原句放到这里）" : "例句（可不填；没有例句就不出例句填空和听写）"}</span>
        <Examples list={ex} onChange={setEx} word={props.mode === "atlas" ? atlas.byId.get(props.id)?.word ?? "" : w} meaning={[zh || (props.mode === "atlas" ? props.original.zh : ""), ...more.map((x) => x.zh)].filter(Boolean).join("；")} />
      </div>
      <div className="wf-field">
        <span>同族词（法语＋中文释义，可修改或删除）</span>
        <div className="wf-family-list">
          {familyRows.map((row,i)=><div className="wf-family-row" key={i}>
            <input aria-label={`同族词法语 ${i+1}`} lang="fr" value={row.fr} onChange={e=>changeFamily(i,{fr:e.target.value})} placeholder="法语单词" />
            <input aria-label={`同族词中文 ${i+1}`} value={row.zh} onChange={e=>changeFamily(i,{zh:e.target.value})} placeholder="中文释义（可手填或 AI 补充）" />
            <button type="button" className="icon-btn" aria-label={`删除同族词 ${i+1}`} onClick={()=>setFam(fam.filter((_,j)=>j!==i))}><Trash2 size={16}/></button>
          </div>)}
        </div>
        {!familyRows.length && <p className="muted">还没有同族词，可以手动添加或用 AI 补充。</p>}
        {fam.length < 12 && <button type="button" className="link" onClick={()=>setFam([...fam,"｜"])}><Plus size={14}/>添加同族词</button>}
        <small className="muted">旧卡片优先从词库补上中文；词库没有的可点 AI 补充。AI 内容请核对。</small>
        {ready.text(ai) && <button type="button" className="btn btn-ghost btn-sm" disabled={familyBusy || filling} onClick={async()=>{
          const word=props.mode==="atlas" ? atlas.byId.get(props.id)?.word ?? "" : w;
          if(!word.trim()) return toast("先填写法语单词", "warn");
          setFamilyBusy(true);
          try { const added = await suggestFamily(word); setFam(current => mergeFamily(current, added)); } catch(e) { toast((e as Error).message,"warn"); } finally {setFamilyBusy(false);}
        }}>{familyBusy ? "正在整理词族…" : "AI 补充词族"}</button>}
      </div>
      {(syn.length > 0 || ant.length > 0) && (
        <div className="wf-field">
          <span>近义词 / 反义词（点一下取下）</span>
          <div className="wf-chips">
            {syn.map((x) => <button type="button" key={`s${x}`} className="chip-btn is-on" onClick={() => setSyn(syn.filter((y) => y !== x))} title="取下这个近义词"><b lang="fr">{x}</b> <small>近</small></button>)}
            {ant.map((x) => <button type="button" key={`a${x}`} className="chip-btn is-on" onClick={() => setAnt(ant.filter((y) => y !== x))} title="取下这个反义词"><b lang="fr">{x}</b> <small>反</small></button>)}
          </div>
        </div>
      )}
      <PictureField mode={imgMode} onMode={setImgMode} value={picture} onChange={setImageState} word={props.mode === "atlas" ? atlas.byId.get(props.id)?.word ?? "" : w} meaning={zh || (props.mode === "atlas" ? props.original.zh : "")} />
      <ExtrasField
        word={props.mode === "atlas" ? atlas.byId.get(props.id)?.word ?? "" : w}
        pos={props.mode === "atlas" ? atlas.peek(props.id)?.senses[0]?.pos ?? "" : pos}
        meaning={zh || (props.mode === "atlas" ? props.original.zh : "")}
        atlasCol={props.mode === "atlas" ? (atlas.peek(props.id)?.col ?? []).filter((c) => !edit?.col?.includes(c)) : []}
        col={col}
        onCol={setCol}
        tip={note}
        onTip={setNote}
      />
      <footer className="wf-actions">
        {props.mode === "custom" && (
          <button
            type="button"
            className="btn btn-ghost btn-danger"
            onClick={async () => {
              if (
                !(await confirmAction({
                  title: `删除「${custom!.w}」？`,
                  message: "它会从所有卡组里移除，学习记录也一起删除。",
                  confirmLabel: "删除",
                  danger: true,
                }))
              )
                return;
              deleteCustomWord(props.id);
              toast("已删除");
              props.onDone(null);
            }}
          >
            <Trash2 size={16} /> 删除这个词
          </button>
        )}
        <span className="wf-spacer" />
        <button type="button" className="btn btn-ghost" onClick={() => props.onDone(null)}>
          取消
        </button>
        <button type="submit" className="btn btn-primary">
          {props.mode === "create" ? "添加" : "保存"}
        </button>
      </footer>
    </form>
  );
}

/** Dictionary results for the typed word, looked up a moment after typing stops; null while there is nothing to show. */
function useDictHits(word: string) {
  const [hits, setHits] = useState<DictHit[] | null>(null);
  useEffect(() => {
    const q = word.trim();
    if (!q || /[一-鿿]/.test(q)) {
      setHits(null);
      return;
    }
    let live = true;
    const t = window.setTimeout(() => {
      lookupDict(q).then((h) => live && setHits(h));
    }, 350);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [word]);
  return hits;
}

const POS_LABEL = Object.fromEntries(POS_CHOICES);

/** 离线词典: what Lexique, Wiktionary and Tatoeba know about the typed word, with one click to fill the form. */
function DictPanel({
  hits,
  word,
  onFill,
  onGloss,
  deckId,
  deckWords,
  onLinked,
}: {
  hits: DictHit[];
  word: string;
  onFill: (h: DictHit) => void;
  onGloss: (g: string) => void;
  deckId?: string;
  deckWords?: string[];
  onLinked: (id: string | null) => void;
}) {
  const atlas = useAtlas();
  if (!hits.length)
    return (
      <p className="wf-dict wf-dict-none">
        <BookOpen size={15} /> 离线词典里没有「{word.trim()}」，请自己填写或用 AI 填写。
      </p>
    );
  return (
    <div className="wf-dict">
      <p className="wf-dict-head">
        <BookOpen size={15} /> 离线词典 · 自动填写的内容请核对
      </p>
      <ul>
        {hits.slice(0, 4).map((h, i) => {
          // the lemma of an inflected form may already be in the atlas: link it instead
          const inAtlas = h.form ? findSame(atlas, h.w)[0] : undefined;
          return (
            <li key={`${h.w}-${h.p}-${i}`}>
              <div className="wf-dict-row">
                <b lang="fr">{h.w}</b>
                <span className="pos">{POS_LABEL[h.p] ?? h.p}</span>
                {h.ipa && <span className="ipa">/{h.ipa}/</span>}
                {h.form && <small>「{h.form}」是它的变化形式</small>}
                <span className="wf-spacer" />
                {inAtlas && deckId ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={deckWords?.includes(inAtlas.id)}
                    onClick={() => {
                      addToDeck(deckId, inAtlas.id);
                      toast(`已把词库里的 ${inAtlas.word} 加入卡组`, "ok");
                      onLinked(inAtlas.id);
                    }}
                  >
                    {deckWords?.includes(inAtlas.id) ? "原形已在卡组" : "加入词库里的原形"}
                  </button>
                ) : (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onFill(h)}>
                    用这个填写
                  </button>
                )}
              </div>
              {h.zh?.length ? (
                <p className="wf-dict-zh">
                  {h.zh.map(([g, label]) => (
                    <button type="button" key={g} className="chip-btn" onClick={() => onGloss(g)} title={label ? `维基词典义项：${label}` : undefined}>
                      {g}
                    </button>
                  ))}
                </p>
              ) : (
                <p className="wf-dict-note">词典里没有中文翻译，中文意思请自己填。</p>
              )}
              {h.ex?.length ? <p className="wf-dict-note">附 {h.ex.length} 条 Tatoeba 例句</p> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- 常用搭配和注意点 ---------- */

interface Pair {
  fr: string;
  zh: string;
}
const toPairs = (col: string[] | undefined): Pair[] =>
  (col ?? []).map((c) => {
    const [fr = "", zh = ""] = c.split("｜");
    return { fr, zh };
  });
const fromPairs = (list: Pair[]) => cleanCollocations(list.map((p) => (p.zh.trim() ? `${p.fr}｜${p.zh}` : p.fr)));

/**
 * Collocations and 注意点, typed by the learner or picked from the AI's suggestions (AI 推荐): each suggestion is a
 * chip; a click adds it to the card, a second click takes it off again.
 */
function ExtrasField({
  word,
  pos,
  meaning,
  atlasCol,
  col,
  onCol,
  tip,
  onTip,
}: {
  word: string;
  pos: string;
  meaning: string;
  atlasCol: string[];
  col: Pair[];
  onCol: (l: Pair[]) => void;
  tip: string;
  onTip: (t: string) => void;
}) {
  const ai = useAiConfig();
  const [busy, setBusy] = useState(false);
  const [ideas, setIdeas] = useState<Extras | null>(null);
  const set = (i: number, patch: Partial<Pair>) => onCol(col.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const hasCol = (fr: string) => col.some((x) => x.fr.trim().toLowerCase() === fr.trim().toLowerCase());
  const toggleCol = (c: Pair) => (hasCol(c.fr) ? onCol(col.filter((x) => x.fr.trim().toLowerCase() !== c.fr.trim().toLowerCase())) : col.length < MAX_COLLOCATIONS && onCol([...col.filter((x) => x.fr.trim()), c]));
  const tipLines = tip.split("\n").map((t) => t.trim()).filter(Boolean);
  const toggleTip = (t: string) => onTip(tipLines.includes(t) ? tipLines.filter((x) => x !== t).join("\n") : [...tipLines, t].join("\n"));
  const suggest = async () => {
    setBusy(true);
    try {
      setIdeas(await suggestExtras({ word: word.trim(), pos, zh: meaning.trim(), have: [...atlasCol, ...col.map((c) => c.fr).filter(Boolean)] }));
    } catch (e) {
      toast((e as Error).message || "生成失败", "warn");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="wf-field wf-extras">
      <span>常用搭配（可不填）</span>
      <div className="wf-examples">
        {col.map((x, i) => (
          <div key={i} className="wf-example wf-col">
            <input lang="fr" value={x.fr} onChange={(e) => set(i, { fr: e.target.value })} placeholder="法语搭配，例如 prendre rendez-vous" maxLength={100} spellCheck={false} />
            <input value={x.zh} onChange={(e) => set(i, { zh: e.target.value })} placeholder="中文（可不填）" maxLength={50} />
            <button type="button" className="icon-btn" onClick={() => onCol(col.filter((_, j) => j !== i))} aria-label="删除这条搭配">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {col.length < MAX_COLLOCATIONS && (
          <button type="button" className="link" onClick={() => onCol([...col, { fr: "", zh: "" }])}>
            <Plus size={14} /> 加一条搭配
          </button>
        )}
      </div>
      <label className="wf-field">
        <span>注意点 / 备注（可不填）</span>
        <textarea className="wf-note-input" value={tip} onChange={(e) => onTip(e.target.value)} placeholder="容易错的地方：阴阳性、搭配的介词、易混词、在哪儿遇到的……" maxLength={MAX_TIP} rows={6} />
      </label>
      {ready.text(ai) ? (
        <div className="wf-ideas">
          <button type="button" className="btn btn-ghost btn-sm self-start" onClick={suggest} disabled={busy || !word.trim()}>
            <Sparkles size={15} /> {busy ? "生成中…" : ideas ? "换一批" : "AI 推荐搭配和注意点"}
          </button>
          {ideas && (
            <>
              {ideas.col.length > 0 && <p className="wf-hint">点一下加到卡片上，再点一下取消：</p>}
              <div className="wf-chips">
                {ideas.col.map((c) => (
                  <button type="button" key={c.fr} className={`chip-btn ${hasCol(c.fr) ? "is-on" : ""}`} onClick={() => toggleCol(c)} aria-pressed={hasCol(c.fr)}>
                    <b lang="fr">{c.fr}</b> <small>{c.zh}</small>
                  </button>
                ))}
              </div>
              <div className="wf-chips">
                {ideas.tips.map((t) => (
                  <button type="button" key={t} className={`chip-btn wf-tip-chip ${tipLines.includes(t) ? "is-on" : ""}`} onClick={() => toggleTip(t)} aria-pressed={tipLines.includes(t)}>
                    {t}
                  </button>
                ))}
              </div>
              {!ideas.col.length && !ideas.tips.length && <p className="wf-hint">AI 没有想到值得加的搭配或注意点。</p>}
            </>
          )}
        </div>
      ) : (
        <p className="wf-hint">在「我的 → AI 接口」设置 AI 文本服务后，可以让 AI 推荐搭配和注意点。</p>
      )}
    </div>
  );
}

type ImageMode = "upload" | "auto" | "ai" | "none";

const IMAGE_MODES: [ImageMode, string, typeof ImagePlus][] = [
  ["upload", "自己上传", ImagePlus],
  ["auto", "自动配图", Sparkles],
  ["ai", "AI 生成", Palette],
  ["none", "不要图片", ImageOff],
];

/**
 * The word's picture: upload one, pick one found online (自动配图), or none at all (不要图片).
 * A picture replaces the text plate and turns on the picture question; 不要图片 hides the plate too, and the
 * quiz asks the word through its example sentence or its Chinese meaning instead.
 */
function PictureField({
  mode,
  onMode,
  value,
  onChange,
  word,
  meaning,
}: {
  mode: ImageMode;
  onMode: (m: ImageMode) => void;
  value: string | null;
  onChange: (v: string | null) => void;
  word: string;
  meaning: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="wf-field">
      <span>图片</span>
      <div className="wf-imgmode" role="radiogroup" aria-label="图片">
        {IMAGE_MODES.map(([k, label, Icon]) => (
          <button key={k} type="button" role="radio" aria-checked={mode === k} className={`wf-imgmode-opt ${mode === k ? "is-on" : ""}`} onClick={() => onMode(k)}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      {mode === "none" ? (
        <p className="wf-hint">卡片上不放图片，也不出看图题；测验改用例句填空，没有例句时看中文选词、拼写。</p>
      ) : (
        <div className="wf-picture">
          {value ? <img src={value} alt="" /> : <span className="wf-picture-empty">还没有图片（卡片上显示文字卡面，不出看图题）</span>}
          {mode === "upload" && (
            <label className="btn btn-ghost btn-sm">
              <ImagePlus size={16} /> {busy ? "处理中…" : value ? "换一张" : "选择图片"}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setBusy(true);
                  try {
                    onChange(await fileToImage(f));
                  } catch (err) {
                    toast((err as Error).message || "图片读取失败", "warn");
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </label>
          )}
          {value && (
            <button type="button" className="link" onClick={() => onChange(null)}>
              去掉图片
            </button>
          )}
        </div>
      )}
      {mode === "auto" && <AutoPicture word={word} current={value} onPick={onChange} />}
      {mode === "ai" && <AiPicture word={word} meaning={meaning} onPick={onChange} />}
    </div>
  );
}

/** AI 生成: a picture drawn by the image model (OpenAI or OpenRouter) from the word and its meaning. */
function AiPicture({ word, meaning, onPick }: { word: string; meaning: string; onPick: (v: string) => void }) {
  const ai = useAiConfig();
  const [busy, setBusy] = useState(false);
  if (!ready.image(ai)) return <p className="wf-hint">先在「我的 → AI 接口」填 {ai.image.provider === "openrouter" ? "OpenRouter" : "OpenAI"} 的 Key，才能生成图片。</p>;
  const run = async () => {
    setBusy(true);
    try {
      const blob = await pictureFor(word.trim(), meaning.trim());
      onPick(await fileToImage(new File([blob], "ai.png", { type: blob.type })));
    } catch (e) {
      toast((e as Error).message || "生成失败", "warn");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="wf-auto">
      <p className="wf-hint">按「{word.trim() || "这个词"}」{meaning.trim() ? `（${meaning.trim()}）` : ""}画一张没有文字的插图。每次生成会产生 OpenAI 的费用。</p>
      <button type="button" className="btn btn-ghost btn-sm self-start" onClick={run} disabled={busy || !word.trim()}>
        <Palette size={16} /> {busy ? "生成中（约 10–30 秒）…" : "生成一张"}
      </button>
    </div>
  );
}

/** 自动配图: search French Wikipedia for the word and let the learner pick one of the pictures. */
function AutoPicture({ word, current, onPick }: { word: string; current: string | null; onPick: (v: string) => void }) {
  const [query, setQuery] = useState(word);
  const [hits, setHits] = useState<PictureHit[] | null>(null);
  const [state, setState] = useState<"idle" | "searching" | "error">("idle");
  const [error, setError] = useState("");
  const [picking, setPicking] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  // follow the French word until the learner edits the search
  useEffect(() => {
    if (!touched) setQuery(word);
  }, [word, touched]);

  const run = async (q: string) => {
    if (!q.trim()) return;
    setState("searching");
    try {
      setHits(await searchPictures(q));
      setState("idle");
    } catch (err) {
      setError((err as Error).message);
      setState("error");
    }
  };
  // search once when the tab opens with a word already typed
  useEffect(() => {
    if (word.trim()) void run(word);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = async (h: PictureHit) => {
    setPicking(h.src);
    try {
      onPick(await pictureFromUrl(h.src));
      setPicked(h.src);
    } catch (err) {
      toast((err as Error).message, "warn");
    } finally {
      setPicking(null);
    }
  };

  return (
    <div className="wf-auto">
      <div className="wf-auto-search">
        <input
          lang="fr"
          value={query}
          onChange={(e) => {
            setTouched(true);
            setQuery(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void run(query);
            }
          }}
          placeholder="搜索词，例如 avocat fruit"
          maxLength={80}
          spellCheck={false}
          aria-label="配图搜索词"
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => run(query)} disabled={!query.trim() || state === "searching"}>
          <Search size={15} /> {state === "searching" ? "搜索中…" : hits ? "重新搜索" : "找图片"}
        </button>
      </div>
      {!query.trim() && !hits && <p className="wf-hint">先填上法语单词，再找图片。</p>}
      {state === "error" && <p className="wf-hint wf-warn">{error}</p>}
      {hits && state !== "error" && (hits.length ? (
        <>
          <ul className="wf-auto-grid">
            {hits.map((h) => (
              <li key={h.src}>
                <button
                  type="button"
                  className={`wf-auto-hit ${picked === h.src && current ? "is-on" : ""}`}
                  onClick={() => pick(h)}
                  disabled={!!picking}
                  aria-pressed={picked === h.src && !!current}
                  title={h.title}
                >
                  <img src={h.src} alt={h.title} loading="lazy" crossOrigin="anonymous" referrerPolicy="no-referrer" />
                  <span>{picking === h.src ? "下载中…" : h.title}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="wf-hint">点一张就用它。图片来自法语维基百科（自由许可），只存在这台设备上。</p>
        </>
      ) : (
        <p className="wf-hint">没找到合适的图片，换个搜索词（比如加上 fruit、animal），或者改成自己上传。</p>
      ))}
    </div>
  );
}
