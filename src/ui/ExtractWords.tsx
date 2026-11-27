import { ArrowLeft, Camera, Check, FileUp, ImagePlus, Pencil, ScanText, Sparkles, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { Attachment } from "../ai/clients";
import { ready, useAiConfig } from "../ai/config";
import { fillWords, recognize, type Filled } from "../ai/tasks";
import { filterImport } from "../ai/filter-import";
import { useAtlas } from "../atlas/context";
import { foldAccents } from "../lib/accent";
import { lookupDict } from "../lib/dict";
import { extractWords, type Candidate, type CandidateKind } from "../lib/extract";
import { ACCEPT, photoAttachment, readImport, type ReadFile } from "../lib/files";
import { openWord } from "../lib/router";
import { bestSense, checkSpellings, listCandidates, mergeCandidates, type ListInput } from "../lib/wordlist";
import { addPicked, MAX_SOURCE_SENTENCE, senseGlosses, type PickedWord } from "../store/decks";
import { useStore } from "../store/store";
import { toast } from "./Toast";
import { POS_CHOICES } from "./WordForm";

const MAX_TEXT = 20000;
/** A file or a recognised page may be longer than a paste: words are found locally. */
const MAX_IMPORT_TEXT = 120000;
const MAX_PHOTOS = 8;

const GROUPS: { kind: CandidateKind; title: string; note: string; open: boolean }[] = [
  { kind: "atlas", title: "词库里有、还没学", note: "加入后和词库里的词共用释义和学习进度", open: true },
  { kind: "new", title: "词库里没有的新词", note: "用词表上印的释义或 AI 写的释义，作为自建词加入", open: true },
  { kind: "dict", title: "词库里没有，离线词典查到了", note: "会作为自建词加入，可以编辑释义和例句", open: true },
  { kind: "unknown", title: "哪里都没查到", note: "填了中文才会加入；可以用「AI 补全」", open: false },
  { kind: "learning", title: "已经在学的词", note: "默认不勾；勾上只是把它放进这个卡组", open: false },
];

type Tab = "text" | "photo" | "file";

/** The sentence with the word marked. */
function Context({ c }: { c: Candidate }) {
  const s = c.sentence.length > 160 && c.span ? clip(c.sentence, c.span) : { text: c.sentence, span: c.span };
  if (!s.span) return <span lang="fr">{s.text}</span>;
  return (
    <span lang="fr">
      {s.text.slice(0, s.span[0])}
      <mark>{s.text.slice(s.span[0], s.span[1])}</mark>
      {s.text.slice(s.span[1])}
    </span>
  );
}

function clip(text: string, span: [number, number]) {
  const a = Math.max(0, span[0] - 60);
  const b = Math.min(text.length, span[1] + 60);
  const pre = a > 0 ? "…" : "";
  return { text: pre + text.slice(a, b) + (b < text.length ? "…" : ""), span: [span[0] - a + pre.length, span[1] - a + pre.length] as [number, number] };
}

/** Words the AI should fill: not in the atlas, and missing a Chinese meaning or anything else a card uses. */
const needsFill = (c: Candidate, extras = false) => !c.id && (!c.zh || !c.pos || !(c.ex?.length || c.sentence) || !!c.unverified || (extras && !c.col && !c.tip));

/** Apply the AI's fields to the list. Words it marks invalid or misspelled get a flag and are not ticked. */
function applyFill(list: Candidate[], filled: Filled[]): { list: Candidate[]; drop: Set<string> } {
  const by = new Map(filled.map((f) => [f.key, f]));
  const drop = new Set<string>();
  const next = list.map((c) => {
    const f = by.get(c.key);
    if (!f) return c;
    if (!f.valid) {
      drop.add(c.key);
      return { ...c, flag: "AI：可能不是要学的词（人名、地名或拼写错误）" };
    }
    const n: Candidate = { ...c, unverified: c.unverified && !(f.fix.trim() || f.lemma.trim().toLowerCase() !== c.word.toLowerCase()) ? false : c.unverified };
    n.fam = f.fam;
    if (f.col?.length) n.col = f.col.filter((x) => x.fr?.trim()).map((x) => (x.zh?.trim() ? `${x.fr.trim()}｜${x.zh.trim()}` : x.fr.trim()));
    if (f.tip?.trim()) n.tip = f.tip.trim();
    const givenZh = c.given && /\p{Script=Han}/u.test(c.given);
    if (!n.zh || (c.given && !givenZh && n.kind !== "dict")) n.zh = f.zh.trim();
    if (!n.pos && POS_CHOICES.some(([k]) => k === f.pos)) n.pos = f.pos;
    if (!n.ipa && f.ipa) n.ipa = f.ipa.replace(/^\/|\/$/g, "");
    if (f.example && !(n.ex ?? []).some((x) => x.fr === f.example)) n.ex = [...(n.ex ?? []), { fr: f.example.slice(0, 400), zh: f.exampleZh.slice(0, 400) }].slice(0, 3);
    if (n.kind === "unknown" && n.zh) n.kind = "new";
    const better = f.fix.trim() || (f.lemma.trim().toLowerCase() !== c.word.toLowerCase() ? f.lemma.trim() : "");
    if (better && better.toLowerCase() !== c.word.toLowerCase()) n.flag = `AI：${f.fix.trim() ? "可能应拼作" : "原形是"} ${better}`;
    return n;
  });
  return { list: next, drop };
}

const fixOf = (flag?: string) => flag?.match(/(?:可能应拼作|原形是) (.+)$/)?.[1];

/**
 * 导入词: paste a French text, photograph a page or a word list, or import a file; pick its new words (or let
 * 整套生成 fill and tick them all) and add them to a deck. Every source goes into one list with the same rules
 * for duplicates (lib/wordlist.ts).
 */
export function ExtractWords({ deckId, deckName, onDone }: { deckId: string; deckName: string; onDone: () => void }) {
  const atlas = useAtlas();
  const ai = useAiConfig();
  const cards = useStore((s) => s.progress.cards);
  const hidden = useStore((s) => s.progress.hidden);
  const deckWords = useStore((s) => s.progress.decks?.find((d) => d.id === deckId)?.words);
  const [tab, setTab] = useState<Tab>("text");
  const [text, setText] = useState("");
  const [requirements, setRequirements] = useState("");
  const [photos, setPhotos] = useState<{ name: string; url: string; att: Attachment }[]>([]);
  const [files, setFiles] = useState<ReadFile[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const [list, setList] = useState<Candidate[] | null>(null);
  const [found, setFound] = useState<string[]>([]);
  const [recognized, setRecognized] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [zh, setZh] = useState<Record<string, string>>({});
  const [withSentence, setWithSentence] = useState(true);
  const [skipFunction, setSkipFunction] = useState(true);
  const [extras, setExtras] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const inDeck = useMemo(() => new Set(deckWords ?? []), [deckWords]);
  const hiddenSet = useMemo(() => new Set(hidden ?? []), [hidden]);

  const needVision = (tab === "photo" && photos.length > 0) || (tab === "file" && files.some((f) => f.attachment));
  const hasInput = (tab === "text" && !!text.trim()) || (tab === "photo" && photos.length > 0) || (tab === "file" && files.length > 0);
  const visionReady = ready.vision(ai);
  const textReady = ready.text(ai);
  const activeRequirements = tab === "file" ? "" : requirements.trim();
  const filterUnavailable = !!activeRequirements && !(tab === "photo" ? visionReady : textReady);

  const addPhotos = async (fs: FileList | null) => {
    if (!fs?.length) return;
    setBusy("读取图片…");
    try {
      const next = [...photos];
      for (const f of [...fs]) {
        if (next.length >= MAX_PHOTOS) {
          toast(`一次最多 ${MAX_PHOTOS} 张`, "warn");
          break;
        }
        if (!f.type.startsWith("image/")) continue;
        const att = await photoAttachment(f);
        next.push({ name: f.name, url: `data:${att.mime};base64,${att.data}`, att });
      }
      setPhotos(next);
    } catch (e) {
      toast((e as Error).message || "图片读取失败", "warn");
    } finally {
      setBusy(null);
    }
  };

  const addFiles = async (fs: FileList | null) => {
    if (!fs?.length) return;
    setBusy("读取文件…");
    try {
      const next = [...files];
      for (const f of [...fs]) next.push(await readImport(f));
      setFiles(next);
    } catch (e) {
      toast((e as Error).message || "文件读取失败", "warn");
    } finally {
      setBusy(null);
    }
  };

  /** Fill words with the AI; returns the list with the fields applied and the keys to untick. */
  const runFill = async (base: Candidate[], signal: AbortSignal, typed: Record<string, string>) => {
    const todo = base.filter((c) => needsFill(c, extras));
    if (!todo.length) return { list: base, drop: new Set<string>() };
    setBusy(`AI 补全释义 0 / ${todo.length}`);
    const filled = await fillWords(
      todo.map((c) => ({ key: c.key, word: c.word, sentence: c.sentence || undefined, given: typed[c.key]?.trim() || c.given || c.zh || undefined, ...(c.unverified ? { maybeMisread: true } : {}) })),
      (n) => setBusy(`AI 补全释义 ${n} / ${todo.length}`),
      signal,
      extras,
    );
    return applyFill(base, filled);
  };

  const defaultPicks = (out: Candidate[], all: boolean) =>
    new Set(
      out
        .filter((c) => !(c.id && inDeck.has(c.id)) && c.kind !== "learning" && !c.flag && !c.unverified && (all ? !!c.zh || !!c.id : c.kind === "atlas" || ((c.kind === "dict" || c.kind === "new") && !!c.zh)))
        .map((c) => c.key),
    );

  const analyse = async (full: boolean) => {
    if (filterUnavailable) return;
    const c = new AbortController();
    ctrl.current = c;
    try {
      const texts: string[] = [];
      const rows: ListInput[] = [];
      const atts: Attachment[] = [];
      const notes: string[] = [];
      const unsureWords: string[] = [];
      if (tab === "text") texts.push(text.slice(0, MAX_TEXT));
      if (tab === "photo") atts.push(...photos.map((p) => p.att));
      if (tab === "file")
        for (const f of files) {
          if (f.text) texts.push(f.text);
          if (f.rows) {
            rows.push(...f.rows);
            notes.push(`「${f.name}」是词表，${f.rows.length} 行`);
          }
          if (f.attachment) atts.push(f.attachment);
        }
      let read = "";
      if (atts.length) {
        // photos go in one request (pages of one lesson), each PDF on its own
        const groups = [atts.filter((a) => a.mime !== "application/pdf"), ...atts.filter((a) => a.mime === "application/pdf").map((a) => [a])].filter((g) => g.length);
        for (let i = 0; i < groups.length; i++) {
          setBusy(groups.length > 1 ? `识别中（${i + 1} / ${groups.length}）…` : "识别中…");
          const r = await recognize(groups[i], c.signal);
          if (r.text.trim()) {
            texts.push(r.text);
            read += (read ? "\n\n" : "") + r.text.trim();
          }
          rows.push(...r.rows);
          unsureWords.push(...r.unsureWords);
          const what = groups[i][0].mime === "application/pdf" ? `「${groups[i][0].name ?? "PDF"}」` : `${groups[i].length} 张图片`;
          notes.push(
            r.kind === "none"
              ? `${what}里没有找到法语`
              : `${what}：${[r.text.trim() && `文章 ${r.text.trim().length.toLocaleString()} 字符`, r.rows.length && `词表 ${r.rows.length} 行`].filter(Boolean).join("，")}`,
          );
        }
      }
      setBusy("查词、去重…");
      const joined = texts.join("\n\n").slice(0, MAX_IMPORT_TEXT);
      const fromText = joined.trim() ? await extractWords(joined, atlas, cards, lookupDict, { skipFunctionWords: skipFunction }) : [];
      const fromList = rows.length ? await listCandidates(rows, atlas, cards, lookupDict) : [];
      const unsure = new Set(unsureWords.map((w) => foldAccents(w)));
      let out = mergeCandidates([fromList, fromText.map((x) => ({ ...x, src: "text" as const, ...(x.forms.some((f) => unsure.has(foldAccents(f))) ? { unsure: true } : {}) }))]);
      if (activeRequirements) {
        setBusy("按提取要求筛选…");
        const before = out.length;
        out = await filterImport(out, activeRequirements, joined, atts, c.signal);
        notes.push(`已按要求筛选：保留 ${out.length} 个词，排除 ${before - out.length} 个`);
      }
      if (c.signal.aborted) return;
      out = await checkSpellings(out, [...atlas.words, ...(atlas.custom ?? [])]);
      let drop = new Set<string>();
      if (full && textReady) ({ list: out, drop } = await runFill(out, c.signal, {}));
      if (c.signal.aborted) return;
      const picks = defaultPicks(out, full);
      drop.forEach((k) => picks.delete(k));
      setList(out);
      setFound(notes);
      setRecognized(read);
      setPicked(picks);
      setZh(Object.fromEntries(out.filter((x) => !x.id).map((x) => [x.key, x.zh])));
    } catch (e) {
      if (!c.signal.aborted) toast((e as Error).message || "出错了", "warn");
    } finally {
      setBusy(null);
      ctrl.current = null;
    }
  };

  const fillNow = async () => {
    if (!list) return;
    const c = new AbortController();
    ctrl.current = c;
    try {
      // what the learner typed counts as the given meaning
      const base = list.map((x) => (!x.id && zh[x.key] !== undefined ? { ...x, zh: zh[x.key].trim() } : x));
      const { list: out, drop } = await runFill(base, c.signal, zh);
      setList(out);
      setZh(Object.fromEntries(out.filter((x) => !x.id).map((x) => [x.key, x.zh])));
      setPicked((p) => {
        const n = new Set(p);
        for (const x of out) if (!x.id && x.zh && !drop.has(x.key) && !x.flag && !x.unverified) n.add(x.key);
        for (const x of out) if (x.flag || drop.has(x.key)) n.delete(x.key);
        return n;
      });
      toast(drop.size ? `已补全；${drop.size} 个可能不是要学的词，没有勾选` : "已补全", "ok");
    } catch (e) {
      if (!c.signal.aborted) toast((e as Error).message || "出错了", "warn");
    } finally {
      setBusy(null);
      ctrl.current = null;
    }
  };

  /** Use another spelling (the AI's fix or lemma): matched again against the atlas, the dictionary and the list. */
  const respell = async (c: Candidate, word: string) => {
    const meaning = (c.id ? c.deckNote ?? c.given ?? "" : zh[c.key] ?? c.zh).trim() || c.given || "";
    const [m] = await checkSpellings(await listCandidates([{ word, pos: c.id ? "" : c.pos, translation: meaning, translationLang: /\p{Script=Han}/u.test(meaning) ? "zh" : "" }], atlas, cards, lookupDict), [...atlas.words, ...(atlas.custom ?? [])]);
    if (!m || !list) return;
    const repl: Candidate = { ...m, count: c.count, forms: [...new Set([...c.forms, word])], sentence: c.sentence, span: undefined, ex: m.ex?.length ? m.ex : c.ex, pos: m.pos || c.pos };
    const others = list.filter((x) => x.key !== c.key);
    const merged = mergeCandidates([others, [repl]]);
    setList(merged);
    const target = merged.find((x) => (m.id ? x.id === m.id : x.word === m.word));
    setPicked((p) => {
      const n = new Set(p);
      n.delete(c.key);
      if (target && !(target.id && inDeck.has(target.id)) && !target.unverified && (target.id || target.zh)) n.add(target.key);
      return n;
    });
    if (target && !target.id) setZh((z) => ({ ...z, [target.key]: target.zh || z[c.key] || "" }));
    setEditing(null);
  };

  /** 就是这个: the near word is the same word; link it. */
  const takeNear = (c: Candidate) => {
    if (!c.near || !list) return;
    const id = c.near.id;
    // the meaning the list or the learner gave (not the gloss of the word it was linked to)
    const meaning = (c.id ? c.deckNote ?? c.given ?? "" : zh[c.key] ?? c.zh).trim();
    const ref = atlas.byId.get(id);
    const sense = meaning && ref ? bestSense(meaning, senseGlosses(ref)) : -1;
    const linked: Candidate = {
      ...c,
      id,
      word: c.near.word,
      zh: c.near.zh,
      kind: cards[id] ? "learning" : "atlas",
      near: undefined,
      sense: sense > 0 ? sense : undefined,
      deckNote: meaning && sense < 0 && /\p{Script=Han}/u.test(meaning) ? meaning : undefined,
    };
    const merged = mergeCandidates([list.filter((x) => x.key !== c.key), [linked]]);
    setList(merged);
    const k = merged.find((x) => x.id === id)?.key;
    setPicked((p) => {
      const n = new Set(p);
      n.delete(c.key);
      if (k && !inDeck.has(id)) n.add(k);
      return n;
    });
  };

  const toggle = (key: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const add = () => {
    if (!list) return;
    const items: PickedWord[] = list
      .filter((c) => picked.has(c.key))
      .map((c) => ({
        kind: c.kind,
        id: c.id,
        word: c.word,
        zh: c.id ? c.zh : (zh[c.key] ?? c.zh).trim(),
        sentence: c.sentence,
        span: c.span,
        sense: c.sense,
        deckNote: c.deckNote,
        col: c.col,
        fam: c.fam,
        tip: c.tip,
        note: c.note,
        pos: c.pos ?? (c.hit && POS_CHOICES.some(([k]) => k === c.hit!.p) ? c.hit.p : ""),
        ipa: c.ipa ?? c.hit?.ipa,
        dictEx: c.ex ?? (c.hit?.ex ?? []).slice(0, 1).map(([fr, z, a, b]) => ({ fr, zh: z, src: "tatoeba" as const, hl: [a, b] as [number, number] })),
      }));
    const r = addPicked(deckId, items, withSentence);
    toast(r.skipped ? `已加入 ${r.added} 个；${r.skipped} 个没有中文意思，没有加入` : `已加入 ${r.added} 个词到「${deckName}」`, r.added ? "ok" : "warn");
    if (r.added) onDone();
  };

  if (busy)
    return (
      <div className="extract extract-busy">
        <p className="extract-note">{busy}</p>
        {ctrl.current && (
          <button className="btn btn-ghost" onClick={() => ctrl.current?.abort()}>
            取消
          </button>
        )}
      </div>
    );

  if (!list) {
    const noAi = !visionReady && needVision;
    return (
      <div className="extract">
        <div className="segmented extract-tabs" role="tablist">
          {(
            [
              ["text", "粘贴文字", ScanText],
              ["photo", "拍照识别", Camera],
              ["file", "导入文件", FileUp],
            ] as const
          ).map(([k, label, Icon]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "is-on" : ""} onClick={() => setTab(k)}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {tab === "text" && (
          <>
            <p className="extract-note">粘贴一段法语（新闻、课文、邮件……），找出里面的生词。变位和复数会还原成原形，原文句子可以直接存为例句。</p>
            <textarea lang="fr" value={text} onChange={(e) => setText(e.target.value)} placeholder="Collez ici un texte en français…" maxLength={MAX_TEXT} rows={10} spellCheck={false} autoFocus />
          </>
        )}

        {tab === "photo" && (
          <>
            <p className="extract-note">拍课文、单词表或生词框（法语和翻译并排的也可以）。同一课的几页可以一起选，最多 {MAX_PHOTOS} 张。</p>
            <div className="extract-photos">
              {photos.map((p, i) => (
                <figure key={i}>
                  <img src={p.url} alt={p.name} />
                  <button className="icon-btn" onClick={() => setPhotos((l) => l.filter((_, j) => j !== i))} aria-label="去掉这张">
                    <X size={14} />
                  </button>
                </figure>
              ))}
              <label className="extract-photo-add">
                <Camera size={20} /> 拍照
                <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => (void addPhotos(e.target.files), (e.target.value = ""))} />
              </label>
              <label className="extract-photo-add">
                <ImagePlus size={20} /> 选图片
                <input type="file" accept="image/*" multiple hidden onChange={(e) => (void addPhotos(e.target.files), (e.target.value = ""))} />
              </label>
            </div>
          </>
        )}

        {tab === "file" && (
          <>
            <p className="extract-note">txt、md、docx 当作文章取词；两列的 csv / tsv / Word 表格当作词表（法语 + 释义）；PDF 和图片交给识图服务读。</p>
            <ul className="extract-files">
              {files.map((f, i) => (
                <li key={i}>
                  <span>{f.name}</span>
                  <small>{f.rows ? `词表 · ${f.rows.length} 行` : f.text ? `文章 · ${f.text.length.toLocaleString()} 字符` : "交给识图服务读"}</small>
                  <button className="icon-btn" onClick={() => setFiles((l) => l.filter((_, j) => j !== i))} aria-label={`去掉 ${f.name}`}>
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <label className="btn btn-ghost btn-sm extract-file-btn">
              <FileUp size={16} /> 选择文件
              <input type="file" accept={ACCEPT} multiple hidden onChange={(e) => (void addFiles(e.target.files), (e.target.value = ""))} />
            </label>
          </>
        )}

        {tab !== "file" && (
          <div className="extract-requirements">
            <label htmlFor="extract-requirements">提取要求 <span className="wf-hint">（可选）</span></label>
            <textarea id="extract-requirements" value={requirements} onChange={(e) => setRequirements(e.target.value)} rows={3} maxLength={2000}
              placeholder={tab === "photo" ? "例如：只提取右侧生词框；只要划线的词；忽略例句和练习题里的词。" : "例如：只要动词和固定搭配；忽略人名、地名；只提取第二段的词。"}
              aria-describedby="extract-requirements-hint" />
            <p id="extract-requirements-hint" className="wf-hint">填写后，AI 会先按要求筛选，再列出生词或整套生成。留空则按默认规则提取。{skipFunction && "“跳过常见虚词”仍会生效。"}</p>
            {filterUnavailable && <p className="wf-hint wf-warn">按要求筛选需要先在「我的 → AI 接口」设置{tab === "photo" ? "识图" : "生成卡片"}服务，或清空提取要求。</p>}
          </div>
        )}
        <label className="extract-opt">
          <input type="checkbox" checked={skipFunction} onChange={(e) => setSkipFunction(e.target.checked)} /> 跳过常见虚词（le、de、être、avoir…）
        </label>
        <label className="extract-opt">
          <input type="checkbox" checked={extras} onChange={(e) => setExtras(e.target.checked)} disabled={!textReady} /> AI 补全时顺便生成常用搭配和注意点（新词）
        </label>
        {noAi && <p className="wf-hint wf-warn">读照片和 PDF 需要先在「我的 → AI 接口」设置识图服务（OpenAI、Gemini、Anthropic 或 OpenRouter）。</p>}
        <footer className="wf-actions">
          {tab === "text" && (
            <span className="extract-count">
              {text.length.toLocaleString()} / {MAX_TEXT.toLocaleString()} 字符
            </span>
          )}
          <span className="wf-spacer" />
          <button className="btn btn-ghost" onClick={() => analyse(false)} disabled={!hasInput || noAi || filterUnavailable} title="列出生词，自己挑">
            <ScanText size={17} /> 找出生词
          </button>
          <button className="btn btn-primary" onClick={() => analyse(true)} disabled={!hasInput || noAi || !textReady || filterUnavailable} title={textReady ? "AI 补全所有新词的释义、词性和例句，并全部勾选" : "先在「我的 → AI 接口」设置AI 文本服务"}>
            <Sparkles size={17} /> 整套生成
          </button>
        </footer>
        {!textReady && <p className="wf-hint">「整套生成」需要先在「我的 → AI 接口」设置AI 文本服务。</p>}
      </div>
    );
  }

  const count = list.filter((c) => picked.has(c.key)).length;
  const fillable = list.filter((c) => !c.id && (needsFill(c, extras) || !(zh[c.key] ?? c.zh).trim())).length;
  const unverified = list.filter((c) => c.unverified || c.unsure).length;
  const pickable = list.filter((c) => !(c.id && inDeck.has(c.id)));
  return (
    <div className="extract">
      <button className="link deck-back" onClick={() => setList(null)}>
        <ArrowLeft size={16} /> 返回修改
      </button>
      {found.length > 0 && <p className="extract-note">{found.join("；")}</p>}
      {unverified > 0 && <p className="extract-warn">有 {unverified} 个词的拼写没法确认（可能是识别出错），默认没有勾选。点词头可以改拼写，或选下面推荐的相近词。</p>}
      {tab === "photo" && photos.length > 0 && (
        <details className="extract-read">
          <summary>原图（对照核对）</summary>
          <div className="extract-originals">
            {photos.map((p, i) => (
              <a key={i} href={p.url} target="_blank" rel="noreferrer">
                <img src={p.url} alt={p.name} />
              </a>
            ))}
          </div>
        </details>
      )}
      {recognized && (
        <details className="extract-read">
          <summary>识别出的文字</summary>
          <p lang="fr">{recognized}</p>
        </details>
      )}
      {list.length === 0 && <p className="deck-empty">没有找到可以加的词。</p>}
      {list.length > 0 && (
        <div className="extract-tools">
          <button className="link" onClick={() => setPicked(new Set(pickable.filter((c) => c.id || (zh[c.key] ?? c.zh).trim()).map((c) => c.key)))}>
            全选
          </button>
          <button className="link" onClick={() => setPicked(new Set())}>
            全不选
          </button>
          <span className="wf-spacer" />
          {textReady && (
            <label className="extract-opt">
              <input type="checkbox" checked={extras} onChange={(e) => setExtras(e.target.checked)} /> 含搭配和注意点
            </label>
          )}
          {fillable > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={fillNow} disabled={!textReady} title={textReady ? "" : "先在「我的 → AI 接口」设置AI 文本服务"}>
              <Sparkles size={15} /> AI 补全（{fillable}）
            </button>
          )}
        </div>
      )}
      {GROUPS.map((g) => {
        const items = list.filter((c) => c.kind === g.kind);
        if (!items.length) return null;
        return (
          <details key={g.kind} className="extract-group" open={g.open}>
            <summary>
              <b>{g.title}</b> <span>{items.length}</span>
              <small>{g.note}</small>
            </summary>
            <ul>
              {items.map((c) => {
                const on = picked.has(c.key);
                const already = !!c.id && inDeck.has(c.id);
                const needZh = !c.id;
                const fix = fixOf(c.flag);
                return (
                  <li key={c.key} className={`extract-item ${on ? "is-on" : ""}`}>
                    <button className={`extract-check ${on ? "is-on" : ""}`} onClick={() => toggle(c.key)} aria-pressed={on} aria-label={`${on ? "不加" : "加入"} ${c.word}`} disabled={already}>
                      {on || already ? <Check size={15} /> : null}
                    </button>
                    <div className="extract-body">
                      <p className="extract-head">
                        {editing === c.key ? (
                          <form
                            className="extract-respell"
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (draft.trim() && draft.trim() !== c.word) void respell(c, draft.trim());
                              else setEditing(null);
                            }}
                          >
                            <input lang="fr" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus spellCheck={false} maxLength={80} onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), setEditing(null))} />
                            <button className="btn btn-ghost btn-sm">确定</button>
                          </form>
                        ) : c.id ? (
                          <button className="link" onClick={() => openWord(c.id!)} lang="fr">
                            {c.word}
                          </button>
                        ) : (
                          <b lang="fr">{c.word}</b>
                        )}
                        {editing !== c.key && (
                          <button
                            className="icon-btn extract-edit"
                            onClick={() => {
                              setEditing(c.key);
                              setDraft(c.word);
                            }}
                            aria-label={`改拼写 ${c.word}`}
                            title="改拼写"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                        {c.unsure && <i className="chip chip-warn">照片上看不清</i>}
                        {c.unverified && !c.unsure && <i className="chip chip-warn">拼写未经核实</i>}
                        {c.pos && !c.id && <small>{c.pos}</small>}
                        {c.forms.some((f) => f.toLowerCase() !== c.word.toLowerCase()) && <small lang="fr">原文：{c.forms.slice(0, 3).join("、")}</small>}
                        {c.count > 1 && <small>×{c.count}</small>}
                        {already && <i className="chip chip-mine">已在卡组</i>}
                        {c.id && hiddenSet.has(c.id) && <i className="chip">曾从初始词本删掉</i>}
                        {!needZh && <span className="extract-zh">{c.zh}</span>}
                      </p>
                      {c.id && c.sense !== undefined && <p className="extract-meta">按词表学「{[c.zh, ...(atlas.byId.get(c.id)?.more ?? [])][c.sense]}」这个义项</p>}
                      {c.deckNote && <p className="extract-meta">词表上的释义「{c.deckNote}」和词库不同，会存为这个卡组的备注</p>}
                      {needZh && (
                        <input
                          className="extract-zh-input"
                          value={zh[c.key] ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setZh((z) => ({ ...z, [c.key]: v }));
                            if (v.trim() && !on) toggle(c.key);
                          }}
                          placeholder={c.given && !/\p{Script=Han}/u.test(c.given) ? `词表释义：${c.given}（可用 AI 补全翻成中文）` : "中文意思（必填才能加入）"}
                          maxLength={300}
                        />
                      )}
                      {c.near && (
                        <p className="extract-warn">
                          词库里有 <b lang="fr">{c.near.word}</b>（{c.near.zh}），{c.near.why}。
                          <button className="link" onClick={() => takeNear(c)}>
                            就是这个词
                          </button>
                        </p>
                      )}
                      {c.suggest && c.suggest.length > 0 && (
                        <p className="extract-warn">
                          可能是：
                          {c.suggest.map((x) => (
                            <button key={x.word} className="link extract-sugg" onClick={() => void respell(c, x.word)}>
                              <span lang="fr">{x.word}</span>（{x.zh}）
                            </button>
                          ))}
                        </p>
                      )}
                      {c.unverified && !c.suggest?.length && !c.flag && <p className="extract-meta">词库和离线词典里都没有相近的词；可以用「AI 补全」让 AI 判断，或点铅笔自己改。</p>}
                      {(c.col?.length || c.tip) && (
                        <p className="extract-meta">
                          {c.col?.length ? `搭配：${c.col.map((x) => x.replace("｜", " ")).join("；")}` : ""}
                          {c.col?.length && c.tip ? " · " : ""}
                          {c.tip ? `注意：${c.tip}` : ""}
                        </p>
                      )}
                      {c.flag && (
                        <p className="extract-warn">
                          {c.flag}
                          {fix && (
                            <>
                              {" "}
                              <button className="link" onClick={() => void respell(c, fix)}>
                                改成 {fix}
                              </button>
                            </>
                          )}
                        </p>
                      )}
                      {c.note && <p className="extract-meta">{c.note}</p>}
                      {c.sentence ? (
                        <p className="extract-ctx">
                          <Context c={c} />
                        </p>
                      ) : c.ex?.[0] ? (
                        <p className="extract-ctx">
                          <span lang="fr">{c.ex[0].fr}</span> {c.ex[0].zh && <small>{c.ex[0].zh}</small>}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
      <footer className="wf-actions extract-foot">
        <label className="extract-opt">
          <input type="checkbox" checked={withSentence} onChange={(e) => setWithSentence(e.target.checked)} /> 原文句子存为例句（{MAX_SOURCE_SENTENCE} 字符以内的句子）
        </label>
        <span className="wf-spacer" />
        <button className="btn btn-primary" onClick={add} disabled={!count}>
          加入「{deckName}」（{count}）
        </button>
      </footer>
    </div>
  );
}
