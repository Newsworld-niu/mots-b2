import { ArrowLeft, BookOpenText, Check, FileUp, Pause, Play, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ready, useAiConfig } from "../ai/config";
import { recognize, writeText } from "../ai/tasks";
import { useAtlas } from "../atlas/context";
import type { Atlas } from "../atlas/types";
import { play, stopAudio } from "../lib/audio";
import { joinGlosses, lookupDict } from "../lib/dict";
import { foldAccents } from "../lib/accent";
import { FUNCTION_WORDS } from "../lib/extract";
import { ACCEPT, readImport } from "../lib/files";
import { annotate, coverage, MAX_TEXT_LENGTH, pickTargets, readStats, unknownShare, type QuizItem, type ReadSentence, type ReadToken, type SavedText, type WordStatus } from "../lib/reader";
import { go, href, openWord } from "../lib/router";
import { addPicked, createDeck, MAX_SOURCE_SENTENCE } from "../store/decks";
import { isMastered, type CardState } from "../store/srs";
import { store, useStore } from "../store/store";
import { deleteText, markTextRead, saveText } from "../store/texts";
import { toast } from "../ui/Toast";

const READ_DECK = "阅读生词";
const SRC_LABEL: Record<SavedText["src"], string> = { paste: "粘贴", file: "导入", ai: "AI 生成" };
/** The colours and what they mean, shown as the legend. */
const LEGEND: [Exclude<WordStatus, "function" | "name">, string, string][] = [
  ["new", "没学过", "词库或离线词典里有，你还没开始学"],
  ["learning", "在学", "已经有记忆卡片，还没掌握"],
  ["known", "已掌握", "记忆稳定度达到 21 天以上"],
  ["unknown", "查不到", "词库和离线词典都没有这个词"],
];
const LEVELS = ["A1", "A2", "B1", "B2"];
const KINDS: ["récit" | "dialogue" | "article", string][] = [
  ["récit", "短文"],
  ["dialogue", "对话"],
  ["article", "小文章"],
];

const wordCount = (text: string) => (text.match(/[\p{L}]+(?:['’-][\p{L}]+)*/gu) ?? []).length;
const liveStatus = (t: ReadToken, cards: Record<string, CardState>): WordStatus => (t.status !== "new" || !t.id ? t.status : isMastered(cards[t.id]) ? "known" : cards[t.id] ? "learning" : "new");
const withStatus = (paras: ReadSentence[][], cards: Record<string, CardState>) => paras.map((p) => p.map((s) => ({ ...s, tokens: s.tokens.map((t) => ({ ...t, status: liveStatus(t, cards) })) })));
const annotateFor = (atlas: Atlas, text: string) => annotate(text, atlas, () => "new", lookupDict);

export function Read({ textId }: { textId?: string }) {
  const text = useStore((s) => s.progress.texts?.find((t) => t.id === textId));
  return text ? <Reader key={text.id} text={text} /> : <Library />;
}

/* ---------- 文章列表、导入、AI 生成 ---------- */

function Library() {
  const atlas = useAtlas();
  const ai = useAiConfig();
  const texts = useStore((s) => s.progress.texts) ?? [];
  const cards = useStore((s) => s.progress.cards);
  const mistakes = useStore((s) => s.progress.mistakes);
  const startLevel = useStore((s) => s.settings.startLevel);
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState("");
  const [fromFile, setFromFile] = useState(false);
  const [busy, setBusy] = useState<"" | "file" | "ai">("");
  const [kind, setKind] = useState<"récit" | "dialogue" | "article">("récit");
  const [length, setLength] = useState(150);
  const [confirm, setConfirm] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => ctrl.current?.abort(), []);

  // the words an AI text is written around: what is due or was missed, topped up from the learning path
  const targets = useMemo(() => {
    const ids = pickTargets(cards, mistakes, (id) => atlas.byId.has(id), Date.now(), 10);
    // function words (être, et, tu …) end up in any text anyway: they are no use as targets
    if (ids.length < 6) for (const w of atlas.words) if (ids.length < 8 && w.cefr >= startLevel && !cards[w.id] && !ids.includes(w.id) && !FUNCTION_WORDS.has(w.word.toLowerCase()) && !FUNCTION_WORDS.has(foldAccents(w.word.toLowerCase()))) ids.push(w.id);
    return ids.map((id) => atlas.byId.get(id)!);
  }, [atlas, cards, mistakes, startLevel]);
  const level = useMemo(() => {
    const sorted = targets.map((w) => w.cefr).filter((c) => c >= 0).sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    return LEVELS[Math.min(LEVELS.length - 1, Math.max(startLevel, median, 0))];
  }, [targets, startLevel]);

  const save = () => {
    const text = draft.trim();
    if (!text) return;
    const id = saveText({ text, title, src: fromFile ? "file" : "paste" });
    setDraft("");
    setTitle("");
    setFromFile(false);
    go({ page: "read", t: id });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const c = new AbortController();
    ctrl.current = c;
    setBusy("file");
    try {
      const f = await readImport(file);
      let text = f.text ?? "";
      if (f.rows) return toast("这是一张单词表：请到「图鉴 → 卡组 → 导入词」里导入", "warn");
      if (f.attachment) {
        if (!ready.vision(ai)) return toast("图片和 PDF 要先在「我的 → AI 接口」里设置识图服务", "warn");
        text = (await recognize([f.attachment], c.signal)).text;
      }
      if (!text.trim()) return toast("没有在里面找到成段的法语", "warn");
      setDraft(text.trim().slice(0, MAX_TEXT_LENGTH));
      setFromFile(true);
      if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").slice(0, 80));
    } catch (e) {
      if (!c.signal.aborted) toast((e as Error).message || "读取失败", "warn");
    } finally {
      setBusy("");
    }
  };

  const generate = async () => {
    const c = new AbortController();
    ctrl.current = c;
    setBusy("ai");
    try {
      const words = targets.map((w) => ({ word: w.word, zh: w.zh }));
      const ids = targets.map((w) => w.id);
      let missing: string[] = [];
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await writeText({ words, level, kind, length, missing }, c.signal);
        if (c.signal.aborted) return;
        if (wordCount(r.text) < 30) throw new Error("AI 没有写出短文，请再试一次");
        // checked by code, not taken on trust: is it French the dictionaries know, and are the words really in it
        const paras = await annotateFor(atlas, r.text);
        if (unknownShare(paras) > 0.2) throw new Error("生成的短文里查不到的词太多，没有保存，请再试一次");
        const cov = coverage(paras, ids);
        if (cov.used.length >= Math.ceil(ids.length * 0.6) || attempt === 1) {
          if (cov.used.length < Math.ceil(ids.length * 0.4)) throw new Error("生成的短文没有用上要复习的词，没有保存，请再试一次");
          const id = saveText({ text: r.text, title: r.title, src: "ai", level, zh: r.zh || undefined, quiz: r.quiz.length ? r.quiz : undefined, targets: ids });
          go({ page: "read", t: id });
          return;
        }
        missing = cov.missing.map((id) => atlas.byId.get(id)!.word);
      }
    } catch (e) {
      if (!c.signal.aborted) toast((e as Error).message || "生成失败", "warn");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="page read">
      <header className="page-head">
        <p className="eyebrow">阅读 · Lecture</p>
        <h1 className="display">把词，放回文章里。</h1>
        <p className="lede">读成篇的法语：点任何一个词查意思、加进卡组，逐句朗读当听力。阅读不改动记忆进度。</p>
      </header>

      <div className="read-grid">
        <section className="panel">
          <h3 className="eyebrow">导入一篇文章</h3>
          <input className="read-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题（可不填）" maxLength={80} aria-label="标题" />
          <textarea
            className="read-draft"
            lang="fr"
            rows={7}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_TEXT_LENGTH))}
            placeholder="粘贴一段法语：新闻、课文、邮件、歌词……"
            spellCheck={false}
            aria-label="文章内容"
          />
          <div className="read-actions">
            <label className={`btn btn-ghost ${busy ? "is-disabled" : ""}`}>
              <FileUp size={16} /> {busy === "file" ? "读取中…" : "从文件或照片"}
              <input
                type="file"
                accept={ACCEPT}
                hidden
                disabled={!!busy}
                onChange={(e) => {
                  void onFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <button className="btn btn-primary" onClick={save} disabled={!draft.trim()}>
              保存并阅读
            </button>
          </div>
          <p className="muted small">
            文章只存在这台设备上，会进备份。{draft ? `${wordCount(draft)} 词` : `最多 ${MAX_TEXT_LENGTH} 个字符`}；txt、docx 直接读取，图片和 PDF 用识图服务。
          </p>
        </section>

        <section className="panel">
          <h3 className="eyebrow">AI 按你在学的词写一篇</h3>
          {targets.length ? (
            <>
              <p className="muted small">会用上这些词（今天到期的、最近答错的，不够时从学习路线补）：</p>
              <p className="read-targets" lang="fr">
                {targets.map((w) => (
                  <button key={w.id} className="chip" onClick={() => openWord(w.id)} title={w.zh}>
                    {w.word}
                  </button>
                ))}
              </p>
              <div className="read-options">
                <div className="segmented">
                  {KINDS.map(([k, label]) => (
                    <button key={k} className={kind === k ? "is-on" : ""} onClick={() => setKind(k)} aria-pressed={kind === k}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="segmented">
                  {[100, 150, 220].map((n) => (
                    <button key={n} className={length === n ? "is-on" : ""} onClick={() => setLength(n)} aria-pressed={length === n}>
                      约 {n} 词
                    </button>
                  ))}
                </div>
              </div>
              {ready.text(ai) ? (
                <button className="btn btn-primary" onClick={generate} disabled={!!busy}>
                  <Sparkles size={16} /> {busy === "ai" ? "生成中（约 20–40 秒）…" : `生成一篇 ${level} 的${KINDS.find(([k]) => k === kind)![1]}`}
                </button>
              ) : (
                <p className="muted small">
                  先到 <a className="link" href={href({ page: "me" })}>我的 → AI 接口</a> 设置生成卡片服务。
                </p>
              )}
              <p className="muted small">附中文译文和 3 道理解题。AI 写的内容未经人工核对，会标「AI 生成」。</p>
            </>
          ) : (
            <p className="muted">词库还没有加载好。</p>
          )}
        </section>
      </div>

      <section className="panel read-list">
        <h3 className="eyebrow">我的文章 {texts.length > 0 && <small>{texts.length} 篇</small>}</h3>
        {texts.length === 0 ? (
          <p className="muted">还没有文章。粘贴一段法语，或让 AI 写一篇。</p>
        ) : (
          <ul>
            {texts.map((t) => (
              <li key={t.id}>
                <a href={href({ page: "read", t: t.id })}>
                  <b lang="fr">{t.title}</b>
                  <small>
                    <span className={`chip ${t.src === "ai" ? "chip-ai" : ""}`}>{SRC_LABEL[t.src]}</span>
                    {t.level && <span>{t.level}</span>}
                    <span>{wordCount(t.text)} 词</span>
                    <span>{new Date(t.created).toLocaleDateString("zh-CN")}</span>
                    {t.read && (
                      <span className="read-done">
                        <Check size={13} /> 读过
                      </span>
                    )}
                  </small>
                </a>
                {confirm === t.id ? (
                  <span className="read-confirm">
                    <button
                      className="link"
                      onClick={() => {
                        deleteText(t.id);
                        setConfirm(null);
                      }}
                    >
                      确认删除
                    </button>
                    <button className="link" onClick={() => setConfirm(null)}>
                      取消
                    </button>
                  </span>
                ) : (
                  <button className="icon-btn" onClick={() => setConfirm(t.id)} aria-label={`删除 ${t.title}`} title="删除">
                    <Trash2 size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ---------- 阅读一篇 ---------- */

interface Picked {
  tok: ReadToken;
  sentence: string;
  /** Index of the sentence among all the text's sentences (for 朗读这句 / 从这句连播). */
  at: number;
}

function Reader({ text }: { text: SavedText }) {
  const atlas = useAtlas();
  const cards = useStore((s) => s.progress.cards);
  const decks = useStore((s) => s.progress.decks) ?? [];
  const colors = useStore((s) => s.settings.readColors);
  const readDeck = useStore((s) => s.settings.readDeck);
  const voice = useStore((s) => s.settings.accent);
  const [paras, setParas] = useState<ReadSentence[][] | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const [showZh, setShowZh] = useState(false);
  const run = useRef(0);

  useEffect(() => {
    let live = true;
    void annotateFor(atlas, text.text).then((p) => live && setParas(p));
    return () => {
      live = false;
    };
  }, [atlas, text.text]);
  useEffect(
    () => () => {
      run.current++;
      stopAudio();
    },
    [],
  );
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const live = useMemo(() => (paras ? withStatus(paras, cards) : null), [paras, cards]);
  const stats = useMemo(() => (live ? readStats(live) : null), [live]);
  const sentences = useMemo(() => live?.flat() ?? [], [live]);
  const cov = useMemo(() => (live && text.targets ? coverage(live, text.targets.filter((id) => atlas.byId.has(id))) : null), [live, text.targets, atlas]);
  const deck = decks.find((d) => d.id === readDeck);

  const stop = () => {
    run.current++;
    stopAudio();
    setPlaying(null);
  };
  /** Read from sentence `from` on (one sentence only with `single`), marking the one being read. */
  const readFrom = async (from: number, single = false) => {
    const mine = ++run.current;
    for (let k = from; k < sentences.length && mine === run.current; k++) {
      setPlaying(k);
      const how = await play(null, sentences[k].text, voice);
      if (how === "unsupported") toast("这台设备没有法语朗读声音；可以在「我的 → AI 接口」开启 Azure 朗读", "warn");
      if (single || how === "stopped" || how === "unsupported") break;
    }
    if (mine === run.current) setPlaying(null);
  };

  const pick = (tok: ReadToken, sentence: string, at: number) => setPicked(picked?.tok === tok ? null : { tok, sentence, at });

  /** The deck new words go to: the chosen one, else 阅读生词 (made the first time). */
  const targetDeck = () => {
    if (deck) return deck.id;
    const id = decks.find((d) => d.name === READ_DECK)?.id ?? createDeck(READ_DECK);
    store.settings({ readDeck: id });
    return id;
  };
  const add = (p: Picked) => {
    const { tok } = p;
    const ref = tok.id ? atlas.byId.get(tok.id) : undefined;
    if (!ref && !tok.hit) return;
    const id = targetDeck();
    const span: [number, number] | undefined = p.sentence.length <= MAX_SOURCE_SENTENCE ? [tok.s, tok.e] : undefined;
    const { added } = addPicked(
      id,
      [
        ref
          ? { kind: cards[ref.id] ? "learning" : "atlas", id: ref.id, word: ref.word, zh: ref.zh, sentence: p.sentence, span }
          : {
              kind: "dict",
              word: tok.hit!.w,
              pos: tok.hit!.p,
              ipa: tok.hit!.ipa,
              zh: joinGlosses(tok.hit!.zh ?? []),
              sentence: p.sentence,
              span,
              dictEx: (tok.hit!.ex ?? []).slice(0, 1).map(([fr, zh, a, b]) => ({ fr, zh, src: "tatoeba" as const, hl: [a, b] as [number, number] })),
            },
      ],
      true,
    );
    const name = store.get().progress.decks?.find((d) => d.id === id)?.name ?? READ_DECK;
    toast(added ? `已加入「${name}」，这句话存为例句` : "这个词没有中文释义，没有加入", added ? "info" : "warn");
  };

  // the word panel: what the picked word is, and whether it is in the target deck already
  const pickedRef = picked?.tok.id ? atlas.byId.get(picked.tok.id) : undefined;
  const pickedStatus = picked ? liveStatus(picked.tok, cards) : null;
  const inDeck = !!pickedRef && !!deck?.words.includes(pickedRef.id);
  let cursor = 0;

  return (
    <div className="page read reader">
      <header className="reader-head">
        <a className="btn btn-ghost" href={href({ page: "read" })}>
          <ArrowLeft size={16} /> 文章
        </a>
        <div className="reader-tools">
          <button className="btn btn-ghost" onClick={() => (playing === null ? void readFrom(0) : stop())} disabled={!sentences.length}>
            {playing === null ? <Play size={16} /> : <Pause size={16} />} {playing === null ? "连播全文" : "停止"}
          </button>
          <label className="reader-toggle">
            <input type="checkbox" checked={colors} onChange={(e) => store.settings({ readColors: e.target.checked })} /> 按熟悉度给词上色
          </label>
        </div>
      </header>

      <article className="panel reader-body">
        <p className="eyebrow">
          <span className={`chip ${text.src === "ai" ? "chip-ai" : ""}`}>{SRC_LABEL[text.src]}</span>
          {text.level && <span> {text.level}</span>} · {wordCount(text.text)} 词
          {text.src === "ai" && " · 未经人工核对"}
        </p>
        <h1 className="reader-title" lang="fr">
          {text.title}
        </h1>

        {colors && stats && (
          <ul className="reader-legend" aria-label="词的颜色说明">
            {LEGEND.map(([k, label, what]) => (
              <li key={k} title={what}>
                <span className={`rw rw-${k}`}>{label}</span>
                <small>
                  {stats[k]} 个 · {what}
                </small>
              </li>
            ))}
          </ul>
        )}

        {!live ? (
          <p className="muted">正在查词…</p>
        ) : (
          <div className={`reader-text ${colors ? "is-colored" : ""}`} lang="fr">
            {live.map((para, pi) => (
              <p key={pi}>
                {para.map((s, si) => {
                  const at = cursor++;
                  const parts: React.ReactNode[] = [];
                  let pos = 0;
                  s.tokens.forEach((t, ti) => {
                    if (t.s > pos) parts.push(s.text.slice(pos, t.s));
                    parts.push(
                      t.status === "name" ? (
                        <span key={ti}>{t.t}</span>
                      ) : (
                        <button key={ti} className={`rw rw-${t.status} ${picked?.tok === paras![pi][si].tokens[ti] ? "is-picked" : ""}`} onClick={() => pick(paras![pi][si].tokens[ti], s.text, at)}>
                          {t.t}
                        </button>
                      ),
                    );
                    pos = t.e;
                  });
                  if (pos < s.text.length) parts.push(s.text.slice(pos));
                  return (
                    <span key={si} className={`rs ${playing === at ? "is-playing" : ""}`}>
                      {parts}{" "}
                    </span>
                  );
                })}
              </p>
            ))}
          </div>
        )}

        {cov && cov.used.length + cov.missing.length > 0 && (
          <p className="muted small reader-cov">
            这篇用上了 {cov.used.length}/{cov.used.length + cov.missing.length} 个要复习的词
            {cov.missing.length > 0 && (
              <>
                ，没用上：<span lang="fr">{cov.missing.map((id) => atlas.byId.get(id)!.word).join("、")}</span>
              </>
            )}
            。
          </p>
        )}
      </article>

      {text.quiz && <Quiz items={text.quiz} />}

      <section className="panel reader-end">
        {text.zh &&
          (showZh ? (
            <div className="reader-zh">
              <h3 className="eyebrow">中文译文 {text.src === "ai" && <small>AI 翻译</small>}</h3>
              {text.zh.split(/\n+/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          ) : (
            <button className="btn btn-ghost" onClick={() => setShowZh(true)}>
              看中文译文
            </button>
          ))}
        <button className={`btn ${text.read ? "btn-ghost" : "btn-primary"}`} onClick={() => markTextRead(text.id, !text.read)}>
          <Check size={16} /> {text.read ? "已读（点一下取消）" : "读完了"}
        </button>
      </section>

      {/* in the body: the page's entry animation leaves a transform that would trap position: fixed */}
      {picked && createPortal(
        <aside className="reader-word" role="dialog" aria-label="查词">
          <button className="icon-btn reader-word-close" onClick={() => setPicked(null)} aria-label="关闭">
            <X size={18} />
          </button>
          <div className="reader-word-main">
            <p className="reader-word-head">
              <b lang="fr">{pickedRef?.word ?? picked.tok.hit?.w ?? picked.tok.t}</b>
              {picked.tok.hit?.p && <span className="pos">{picked.tok.hit.p}</span>}
              {(pickedRef?.ipa || picked.tok.hit?.ipa) && <span className="ipa">{pickedRef?.ipa || picked.tok.hit?.ipa}</span>}
              {(pickedRef?.word ?? picked.tok.hit?.w ?? picked.tok.t).toLowerCase() !== picked.tok.t.toLowerCase() && (
                <small>
                  文中写作 <span lang="fr">{picked.tok.t}</span>
                </small>
              )}
            </p>
            <p className="reader-word-zh">
              {pickedRef
                ? [pickedRef.zh, ...(pickedRef.more ?? [])].join("；")
                : picked.tok.hit
                  ? joinGlosses(picked.tok.hit.zh ?? [], 4) || "离线词典里有这个词，但没有中文释义。"
                  : "词库和离线词典都没有这个词（可能是专名、缩写或拼写有误）。"}
            </p>
            <p className="muted small">
              {pickedStatus === "function"
                ? "常用功能词，不上色"
                : pickedStatus && pickedStatus !== "name" && LEGEND.find(([k]) => k === pickedStatus)?.[1]}
              {!pickedRef && picked.tok.hit && " · 来自离线词典，加入后是自建词（待核对）"}
            </p>
          </div>
          <div className="reader-word-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => void readFrom(picked.at, true)}>
              <Play size={14} /> 读这句
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => void readFrom(picked.at)}>
              从这句连播
            </button>
            {pickedRef && (
              <button className="btn btn-ghost btn-sm" onClick={() => openWord(pickedRef.id)}>
                <BookOpenText size={14} /> 词条
              </button>
            )}
            {(pickedRef || picked.tok.hit?.zh?.length) &&
              (inDeck ? (
                <span className="reader-in-deck">
                  <Check size={14} /> 已在「{deck!.name}」
                </span>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={() => add(picked)}>
                  <Plus size={14} /> 加入「{deck?.name ?? READ_DECK}」
                </button>
              ))}
            {decks.length > 0 && (
              <select className="reader-deck" value={deck?.id ?? ""} onChange={(e) => store.settings({ readDeck: e.target.value || null })} aria-label="生词加到哪个卡组">
                {!deck && <option value="">加到：{READ_DECK}</option>}
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    加到：{d.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </aside>,
        document.body,
      )}
    </div>
  );
}

/* ---------- 理解题 ---------- */

function Quiz({ items }: { items: QuizItem[] }) {
  const [chosen, setChosen] = useState<Record<number, number>>({});
  const answered = Object.keys(chosen).length;
  const right = items.filter((q, i) => chosen[i] === q.answer).length;
  return (
    <section className="panel reader-quiz">
      <h3 className="eyebrow">
        读懂了吗 {answered === items.length && <small>答对 {right}/{items.length}</small>}
      </h3>
      <ol>
        {items.map((q, i) => {
          const mine = chosen[i];
          const done = mine !== undefined;
          return (
            <li key={i}>
              <p className="reader-q">{q.q}</p>
              <ul className="reader-options">
                {q.options.map((o, k) => (
                  <li key={k}>
                    <button
                      className={`reader-option ${done ? (k === q.answer ? "is-answer" : k === mine ? "is-wrong" : "is-dim") : ""}`}
                      onClick={() => setChosen((c) => ({ ...c, [i]: k }))}
                      disabled={done}
                    >
                      {o}
                      {done && k === q.answer && <Check size={16} />}
                      {done && k === mine && k !== q.answer && <X size={16} />}
                    </button>
                  </li>
                ))}
              </ul>
              {done && q.why && <p className="muted small">{q.why}</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
