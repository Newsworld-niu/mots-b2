import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Check,
  ExternalLink,
  Flag,
  Layers,
  NotebookPen,
  Plus,
  Volume2,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useConfusables } from "../../atlas/confusables";
import { useConj } from "../../atlas/conj";
import { useAtlas } from "../../atlas/context";
import type { Atlas } from "../../atlas/types";
import { play } from "../../lib/audio";
import { TENSE_FR, TENSE_ZH, TENSES, tableFor, type ConjTense } from "../../lib/conjugation";
import { familyPair, useFamilies, type Family } from "../../lib/families";
import { frdicUrl } from "../../lib/frdic";
import { localHints, resolveHints } from "../../lib/lexdb/hints";
import { entryToSeed } from "../../lib/lexdb/search";
import { addDictReport, setDictNote, toggleDictFav, useDictStore } from "../../lib/lexdb/store";
import { lexdbFold, type LexEntry, type LexHintTuple, type LexMeta, type LexPhrase } from "../../lib/lexdb/types";
import { isNative } from "../../lib/native";
import { href, openWord } from "../../lib/router";
import { addToDeck, createDeck, exactHeadwordKey, findExact } from "../../store/decks";
import { store, useStore } from "../../store/store";
import { AUX_NOTE, ConjTable } from "../../ui/ConjTable";
import { cardFor, inReview, quickAddToReview, userDeckFor } from "../../ui/HomeDictionary";
import { Highlight } from "../../ui/EntryView";
import { Sheet } from "../../ui/Sheet";
import { toast } from "../../ui/Toast";
import { WordForm } from "../../ui/WordForm";
import {
  collectExamples,
  CONF_META,
  DICT_DECK,
  entryMaxConf,
  memoryHint,
  POS_ZH,
  relationWords,
  REPORT_KINDS,
  SOURCE_LABEL,
  type CollectedExample,
  type DictTab,
} from "./helpers";

const OVERVIEW_PHRASES = 6;
const OVERVIEW_EXAMPLES = 8;

/**
 * [pos, shortZh] hints for related-word chips: memory (atlas, fixtures) right away, then the 1-letter
 * hints/<bucket>.json shards for whatever is still missing (lazily, only when meta.hintsShards is true).
 */
function useRelationHints(words: string[], atlas: Atlas, meta: LexMeta | null | undefined) {
  const key = words.join("\u0000");
  const [hints, setHints] = useState<Map<string, LexHintTuple>>(() => localHints(words, (w) => memoryHint(atlas, w)));
  useEffect(() => {
    const list = key ? key.split("\u0000") : [];
    const local = (w: string) => memoryHint(atlas, w);
    const initial = localHints(list, local);
    setHints(initial);
    if (!list.length || list.every((w) => initial.has(w)) || meta === null) return;
    let live = true;
    void resolveHints(list, { local, meta }).then(
      (all) => {
        if (live && all.size > initial.size) setHints(all);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [key, atlas, meta]);
  return hints;
}

export function DictEntryView({
  entry,
  highlightPhrase,
  initialTab,
  meta,
}: {
  entry: LexEntry;
  highlightPhrase?: string;
  /** Tab to open first (#/dict?w=…&tab=conj); falls back to 法汉释义 when the entry has no such section. */
  initialTab?: DictTab;
  /** LexDB meta already loaded by the page (undefined: loaded on demand when hints are needed). */
  meta?: LexMeta | null;
}) {
  const atlas = useAtlas();
  const { data: conjData } = useConj();
  const { data: confusables } = useConfusables();
  const { favs, notes } = useDictStore();
  const storedDecks = useStore((s) => s.progress.decks);
  const decks = useMemo(() => storedDecks ?? [], [storedDecks]);
  const cards = useStore((s) => s.progress.cards);
  const readDeck = useStore((s) => s.settings.readDeck);

  const [tab, setTabState] = useState<DictTab>(initialTab ?? "zh");
  /** A requested tab (URL ?tab=) that is not available yet (e.g. 动词变位 while conj.json loads). */
  const pendingTab = useRef<DictTab | undefined>(initialTab);
  const setTab = (t: DictTab) => {
    pendingTab.current = undefined;
    setTabState(t);
  };
  const [conjTense, setConjTense] = useState<ConjTense>("pres");
  const [speakingVoice, setSpeakingVoice] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportKind, setReportKind] = useState(REPORT_KINDS[0]);
  const [reportDetail, setReportDetail] = useState("");
  const [noteDraft, setNoteDraft] = useState(notes[entry.id] ?? "");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");

  useEffect(() => {
    setReportOpen(false);
    setReportDetail("");
    setNoteDraft(notes[entry.id] ?? "");
  }, [entry.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isFav = favs.includes(entry.id);
  const savedNote = notes[entry.id] ?? "";
  const atlasRef = entry.atlasId ? atlas.byId.get(entry.atlasId) : findExact(atlas, entry.w)[0];
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

  const families = useFamilies();
  const familyGroup = useMemo(() => {
    if (entry.family) {
      const hit = families.find((f) => f.id === entry.family);
      if (hit) return hit;
    }
    const exactW = exactHeadwordKey(entry.w);
    const linkedId = entry.atlasId ?? atlasRef?.id;
    return families.find(
      (f) => (linkedId ? f.words.includes(linkedId) : false) || exactHeadwordKey(f.name) === exactW,
    );
  }, [entry, families, atlasRef]);

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

  const activeDeck =
    decks.find((d) => d.id === (selectedDeckId || readDeck)) ??
    (!selectedDeckId && !readDeck ? decks.find((d) => d.name === DICT_DECK) : undefined);
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

  const hasPhrases = (entry.phrases?.length ?? 0) > 0;
  const hasExamples = allExamples.length > 0;
  const hasAnyRel =
    (entry.derived?.length ?? 0) > 0 ||
    (entry.syn?.length ?? 0) > 0 ||
    (entry.ant?.length ?? 0) > 0 ||
    !!familyGroup;
  const hasFrDefs = (entry.frDefs?.length ?? 0) > 0;
  const hasEtymOrCf = !!entry.etym?.trim() || confusableGroups.length > 0;

  const extraFamilyPairs = useMemo(() => {
    if (!familyGroup) return [];
    const selfKey = exactHeadwordKey(entry.w);
    const covered = new Set<string>([selfKey, ...(entry.derived ?? []).map(exactHeadwordKey)]);
    const out: { fr: string; zh: string }[] = [];
    for (const raw of [familyGroup.name, ...familyGroup.examples]) {
      const pair = familyPair(raw);
      if (!pair.fr) continue;
      const k = exactHeadwordKey(pair.fr);
      if (!k || covered.has(k)) continue;
      covered.add(k);
      out.push(pair);
    }
    return out;
  }, [entry.w, entry.derived, familyGroup]);

  const relWords = useMemo(() => {
    const base = relationWords(entry);
    const extraNeedHints = extraFamilyPairs.filter((p) => !p.zh).map((p) => p.fr);
    return extraNeedHints.length ? [...new Set([...base, ...extraNeedHints])] : base;
  }, [entry, extraFamilyPairs]);

  const relCount = useMemo(() => {
    const selfKey = exactHeadwordKey(entry.w);
    const all = new Set<string>();
    for (const w of relationWords(entry)) {
      const k = exactHeadwordKey(w);
      if (k && k !== selfKey) all.add(k);
    }
    for (const pair of extraFamilyPairs) {
      all.add(exactHeadwordKey(pair.fr));
    }
    return all.size;
  }, [entry, extraFamilyPairs]);
  const hints = useRelationHints(relWords, atlas, meta);

  const tabs: { id: DictTab; label: string; count?: number; dot?: boolean }[] = [
    { id: "zh", label: "法汉释义" },
    ...(hasConjTab ? [{ id: "conj" as const, label: "动词变位" }] : []),
    ...(hasAnyRel ? [{ id: "relations" as const, label: "派生·近反义", ...(relCount > 0 ? { count: relCount } : {}) }] : []),
    ...(hasPhrases ? [{ id: "phrases" as const, label: "短语搭配", count: entry.phrases?.length ?? 0 }] : []),
    ...(hasExamples ? [{ id: "examples" as const, label: "法语例句", count: allExamples.length }] : []),
    ...(hasFrDefs ? [{ id: "fr" as const, label: "法法释义", count: entry.frDefs?.length ?? 0 }] : []),
    ...(hasEtymOrCf ? [{ id: "etym" as const, label: "词源与辨析" }] : []),
    { id: "notes", label: "笔记", dot: !!savedNote },
  ];
  const tabKey = tabs.map((t) => t.id).join(",");

  // Land on the requested tab when the entry (or ?tab=) changes; never stay on a tab that is not shown.
  useEffect(() => {
    pendingTab.current = initialTab;
    const ids = tabKey.split(",");
    setTabState(initialTab && ids.includes(initialTab) ? initialTab : "zh");
  }, [entry.id, initialTab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const ids = tabKey.split(",");
    const want = pendingTab.current;
    if (want && ids.includes(want)) {
      pendingTab.current = undefined;
      if (tab !== want) setTabState(want);
      return;
    }
    // 动词变位 requested but conj.json loaded without this verb: stop waiting for it
    if (want === "conj" && conjData) pendingTab.current = undefined;
    if (!ids.includes(tab)) setTabState("zh");
  }, [tabKey, tab, conjData]);

  const formsList: [string, string][] = [];
  if (entry.forms?.f) formsList.push(["f.", entry.forms.f]);
  if (entry.forms?.pl) formsList.push(["pl.", entry.forms.pl]);
  if (entry.forms?.fpl) formsList.push(["f.pl.", entry.forms.fpl]);

  const hidden = useStore((s) => s.progress.hidden);
  const coreMigrated = useStore((s) => s.progress.coreMigrated);
  // 闪电入卡组: one click, no form; dedupes against the atlas word or a word the learner already made.
  const quickCard = cardFor(atlas, entry.w, entry.atlasId);
  const quickReviewing = !!quickCard && inReview({ cards, decks, hidden, coreMigrated }, quickCard.id);
  const quickDeck = quickCard ? userDeckFor(decks, quickCard.id) : undefined;
  const quickAdd = () => {
    const res = quickAddToReview(atlas, entry.w, () => entryToSeed(entry), entry.atlasId);
    toast(res.status === "added" ? `已加入「${res.deckName}」卡组` : `「${entry.w}」已在词卡里`, res.status === "added" ? "ok" : "info");
  };

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
              <details className="dict-meta-fold">
                <summary className="dict-meta-toggle">
                  <span>{confInfo.label}</span>
                  {typeof entry.rank === "number" && entry.rank < 99999 && <span>· #{entry.rank.toLocaleString()}</span>}
                </summary>
                <div className="dict-meta-fold-body">
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
              </details>
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

            {quickReviewing ? (
              <span className="dict-quick-state" role="status">
                <Check size={14} /> 已在词卡
                {quickDeck && (
                  <a className="link small" href={href({ page: "decks", d: quickDeck.id })}>
                    去卡组查看
                  </a>
                )}
              </span>
            ) : (
              <button type="button" className="btn btn-ghost dict-action-btn" onClick={quickAdd} title="不填表，直接加入「阅读生词」卡组">
                <Zap size={15} /> 闪电入卡组
              </button>
            )}

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
              <strong className="dict-report-title">
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
                  className={`chip-btn is-compact ${reportKind === k ? "is-on" : ""}`}
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

          {/* 2. 派生词 · 同义词 · 反义词 (only when there is something to show) */}
          {hasAnyRel && (
            <details className="dict-panel dict-panel-rel" open>
              <summary>派生词 · 同义词 · 反义词</summary>
              <div className="dict-panel-body">
                <RelationsBody entry={entry} familyGroup={familyGroup} extraFamilyPairs={extraFamilyPairs} hints={hints} />
              </div>
            </details>
          )}

          {/* 3. 常用搭配与固定表达 */}
          {hasPhrases && (
            <details className="dict-panel dict-panel-phrases" open>
              <summary>常用搭配与固定表达（{entry.phrases!.length}）</summary>
              <div className="dict-panel-body">
                <PhraseList
                  phrases={entry.phrases!.slice(0, OVERVIEW_PHRASES)}
                  highlightPhrase={highlightPhrase}
                  onSpeak={(fr, key) => void speakText(fr, "uk", key)}
                />
                {entry.phrases!.length > OVERVIEW_PHRASES && (
                  <button type="button" className="link" onClick={() => setTab("phrases")}>
                    查看全部 {entry.phrases!.length} 条搭配 →
                  </button>
                )}
              </div>
            </details>
          )}

          {/* 4. 法语例句库 */}
          {hasExamples && (
            <details className="dict-panel dict-panel-examples" open>
              <summary>法语例句库（{allExamples.length}）</summary>
              <div className="dict-panel-body">
                <ExamplesList
                  examples={allExamples.slice(0, OVERVIEW_EXAMPLES)}
                  word={entry.w}
                  speakingVoice={speakingVoice}
                  onSpeak={(fr, key) => void speakText(fr, "uk", key)}
                />
                {allExamples.length > OVERVIEW_EXAMPLES && (
                  <button type="button" className="link" onClick={() => setTab("examples")}>
                    查看全部 {allExamples.length} 条例句 →
                  </button>
                )}
              </div>
            </details>
          )}
        </div>
      )}

      {tab === "conj" && (
        <section className="dict-panel-body is-flush">
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
        <section className="dict-panel-body is-flush">
          {!entry.phrases?.length ? (
            <p className="muted">暂未收录常见短语搭配。</p>
          ) : (
            <PhraseList
              phrases={entry.phrases}
              highlightPhrase={highlightPhrase}
              onSpeak={(fr, key) => void speakText(fr, "uk", key)}
            />
          )}
        </section>
      )}

      {tab === "examples" && (
        <section className="dict-panel-body is-flush">
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
        <section className="dict-panel-body is-flush">
          <RelationsBody entry={entry} familyGroup={familyGroup} extraFamilyPairs={extraFamilyPairs} hints={hints} />
        </section>
      )}

      {tab === "fr" && (
        <section className="dict-panel-body is-flush">
          {!entry.frDefs?.length ? (
            <p className="muted">暂未收录法法释义。</p>
          ) : (
            <ul className="dict-frdef-list">
              {entry.frDefs.map((d, i) => (
                <li key={i} className="dict-frdef-item">
                  <div className="dict-sense-line">
                    <span className="dict-pos-tag is-sm">
                      {d.p}
                    </span>
                    <span lang="fr" className="dict-frdef-gloss">
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
                    <p className="muted small dict-frdef-ex" lang="fr">
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
        <section className="dict-panel-body is-flush">
          {entry.etym?.trim() && (
            <div>
              <h2 className="eyebrow dict-subhead">词源</h2>
              <div className="dict-etym-box">
                <p lang="fr">{entry.etym}</p>
                <small className="muted">来源：Wiktionnaire（CC BY-SA 4.0）</small>
              </div>
            </div>
          )}

          {confusableGroups.length > 0 && (
            <div>
              <h2 className="eyebrow dict-subhead">易混词辨析</h2>
              <div className="dict-cf-cards">
                {confusableGroups.map((g) => (
                  <div key={g.id} className="dict-cf-card">
                    <div className="panel-head">
                      <div>
                        <span className="chip">{g.kind === "homophone" ? "同音词" : "词义辨析"}</span>{" "}
                        <b lang="fr" className="dict-cf-title">
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
            </div>
          )}
        </section>
      )}

      {tab === "notes" && (
        <section className="dict-panel-body dict-notes-box is-flush">
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
            <span className="muted small dict-note-count">
              {noteDraft.length}/1000
            </span>
          </div>
        </section>
      )}

      <Sheet open={reviewOpen} onClose={() => setReviewOpen(false)} label="加入复习卡片" wide>
        {reviewOpen && (
          <>
            <h2 className="sheet-title">加入复习 · {entry.w}</h2>
            <div className="dict-notice dict-review-notice">
              <label className="dict-deck-label">
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
              deckId={activeDeck?.id || selectedDeckId}
              seed={entryToSeed(entry)}
              onDone={(createdId) => {
                setReviewOpen(false);
                if (createdId) {
                  toast(`「${entry.w}」已加入复习卡组`, "ok");
                }
              }}
            />
          </>
        )}
      </Sheet>
    </article>
  );
}

/** A related word as a chip linking to its own entry, with a compact [pos] shortZh hint when one is known. */
function RelChip({ w, hint, withPos }: { w: string; hint?: LexHintTuple; withPos: boolean }) {
  const pos = withPos ? hint?.[0] ?? "" : "";
  const zh = hint?.[1] ?? "";
  return (
    <a className="dict-rel-chip" href={href({ page: "dict", w })} title={`查看「${w}」词条`}>
      <span lang="fr">{w}</span>
      {(pos || zh) && (
        <small>
          {pos ? `${pos}${zh ? " " : ""}` : ""}
          {zh}
        </small>
      )}
    </a>
  );
}

const REL_GROUPS = [
  { key: "derived", title: "派生 / 同族词", withPos: true },
  { key: "syn", title: "同义词 / 近义词", withPos: false },
  { key: "ant", title: "反义词", withPos: false },
] as const;

function RelationsBody({
  entry,
  familyGroup,
  extraFamilyPairs,
  hints,
}: {
  entry: LexEntry;
  familyGroup: Family | undefined;
  extraFamilyPairs: { fr: string; zh: string }[];
  hints: Map<string, LexHintTuple>;
}) {
  return (
    <div className="dict-rel-groups">
      {REL_GROUPS.map(({ key, title, withPos }) => {
        const list = entry[key];
        if (!list?.length) return null;
        return (
          <div key={key} className={`dict-rel-group dict-rel-${key}`}>
            <h3>{title}</h3>
            <div className="dict-rel-chips">
              {list.map((w) => (
                <RelChip key={w} w={w} hint={hints.get(w)} withPos={withPos} />
              ))}
            </div>
          </div>
        );
      })}

      {familyGroup && (
        <div className="dict-rel-group dict-rel-family">
          <h3>词图词族</h3>
          <div className="dict-family-box">
            <div className="panel-head">
              <span>
                <b lang="fr">{familyGroup.name}</b>
                {familyGroup.zh && (
                  <>
                    {" "}· <span className="muted small">{familyGroup.zh}</span>
                  </>
                )}
              </span>
              <a className="link small" href={href({ page: "atlas", families: familyGroup.id })}>
                在图鉴查看词族 →
              </a>
            </div>
            {extraFamilyPairs.length > 0 && (
              <div className="dict-rel-chips">
                {extraFamilyPairs.map((pair) => (
                  <RelChip
                    key={pair.fr}
                    w={pair.fr}
                    hint={pair.zh ? ["", pair.zh] : hints.get(pair.fr)}
                    withPos={!pair.zh}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PhraseList({
  phrases,
  highlightPhrase,
  onSpeak,
}: {
  phrases: LexPhrase[];
  highlightPhrase?: string;
  onSpeak: (fr: string, key: string) => void;
}) {
  return (
    <ul className="dict-phrase-list">
      {phrases.map((p, i) => {
        const isMatched = !!highlightPhrase && lexdbFold(p.fr) === lexdbFold(highlightPhrase);
        const conf = CONF_META[p.conf] ?? CONF_META[0];
        return (
          <li key={`${p.fr}-${i}`} className={`dict-phrase-item ${isMatched ? "is-matched" : ""}`}>
            <a className="dict-phrase-fr link" href={href({ page: "dict", w: p.fr })} lang="fr">
              {p.fr}
            </a>
            <span className="dict-phrase-zh">{p.zh}</span>
            <span className="dict-sense-meta">
              <span className={`conf-pill ${conf.tone}`}>conf {p.conf}</span>
              <span className="src-pill">{SOURCE_LABEL[p.src] ?? p.src}</span>
              <button
                type="button"
                className="icon-btn is-xs"
                aria-label={`朗读短语 ${p.fr}`}
                onClick={() => onSpeak(p.fr, `phrase-${i}`)}
              >
                <Volume2 size={14} />
              </button>
            </span>
          </li>
        );
      })}
    </ul>
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
                  <Highlight text={ex.fr} word={word} span={ex.hl} />{" "}
                </p>
                <button
                  type="button"
                  className={`dict-voice-btn is-compact ${speakingVoice === key ? "is-on" : ""}`}
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
