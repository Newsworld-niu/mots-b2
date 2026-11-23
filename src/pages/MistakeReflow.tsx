import { ArrowLeft, ArrowRight, BookMarked, Check, Headphones, Layers, MessageSquareQuote, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { ready } from "../ai/config";
import { checkGrammarEquivalence } from "../ai/tasks/writing";
import { useAtlas } from "../atlas/context";
import { useGrammarMeta } from "../atlas/grammar";
import { COMP_LABEL, gradeCompQuestion, QSKILL_LABEL } from "../lib/exam-schema";
import { CAUSE_LABEL, CAUSE_TIP, MISS_CAUSES, type MissCause } from "../lib/listening";
import { go, href, openWord } from "../lib/router";
import { normalize } from "../lib/text";
import { checkTransferSentence, ERROR_LABEL, type TransferCheck } from "../lib/writing";
import { deleteNote } from "../store/essays";
import { duePoints, untouchedWithErrors } from "../store/grammar";
import { setMissCause } from "../store/misses";
import {
  deleteSpeakingCorrection,
  gradeReflow,
  reflowSummary,
  removeWordMistake,
  unifiedMistakeCounts,
  type ReflowItem,
} from "../store/note-review";
import {
  LEECH_DEFAULT_THRESHOLD,
  leechIds,
  suspendLeech,
  unsuspendLeech,
} from "../store/session";
import { formatInterval, preview, Rating, type Grade } from "../store/srs";
import { useStore, useStoreShallow } from "../store/store";
import { AccentKeys } from "../ui/AccentKeys";
import { confirmAction } from "../ui/ConfirmSheet";
import { toast } from "../ui/Toast";

type Tab = "words" | "grammar" | "sentences" | "comp";

const RATINGS: { grade: Grade; label: string; tone: string }[] = [
  { grade: Rating.Again, label: "重来", tone: "btn-terra" },
  { grade: Rating.Hard, label: "困难", tone: "btn-ghost" },
  { grade: Rating.Good, label: "良好", tone: "btn-primary" },
  { grade: Rating.Easy, label: "简单", tone: "btn-sage" },
];

/**
 * Unified 4-Tab Mistake Center:
 * 1) Vocabulary mistakes (`words`)
 * 2) Grammar due + untouched error-linked points (`grammar`)
 * 3) Writing non-grammar notes & Speaking corrections (`sentences`)
 * 4) Listening/Reading comprehension trap reflow (`comp`)
 */
export function MistakeReflow({ onExit }: { onExit: () => void }) {
  const atlas = useAtlas();
  const progress = useStoreShallow((s) => ({
    cards: s.progress.cards,
    mistakes: s.progress.mistakes,
    gram: s.progress.gram,
    gramTags: s.progress.gramTags,
    essays: s.progress.essays,
    essayNotes: s.progress.essayNotes,
    speakCorrections: s.progress.speakCorrections,
    compMisses: s.progress.compMisses,
    noteCards: s.progress.noteCards,
    suspendedLeeches: s.progress.suspendedLeeches,
  }));
  const settings = useStore((s) => s.settings);
  const { data: grammarMeta } = useGrammarMeta();

  const summary = useMemo(() => reflowSummary(progress), [progress]);
  const counts = useMemo(() => unifiedMistakeCounts(progress, grammarMeta), [progress, grammarMeta]);
  const [tab, setTab] = useState<Tab>(() => {
    const c = unifiedMistakeCounts(progress, null);
    if (c.sentencesTotal > 0) return "sentences";
    if (c.compDue > 0) return "comp";
    if (c.words > 0) return "words";
    return "grammar";
  });

  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState("");
  const [transferText, setTransferText] = useState("");
  const [transferResult, setTransferResult] = useState<TransferCheck | null>(null);
  const [transferChecking, setTransferChecking] = useState(false);
  const [rePicked, setRePicked] = useState<number | undefined>(undefined);
  const [reTyped, setReTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const transferRef = useRef<HTMLInputElement>(null);
  const compRef = useRef<HTMLInputElement>(null);

  const resetCardInputs = () => {
    setRevealed(false);
    setTyped("");
    setTransferText("");
    setTransferResult(null);
    setRePicked(undefined);
    setReTyped("");
  };

  const switchTab = (next: Tab) => {
    setTab(next);
    resetCardInputs();
  };

  const queueKind = tab === "sentences" ? "essay" : tab === "comp" ? "comp" : null;
  const pool = useMemo(
    () => (queueKind ? summary.items.filter((x) => x.kind === queueKind) : []),
    [summary.items, queueKind],
  );
  const current: ReflowItem | undefined = pool[0];
  const intervals = useMemo(
    () => (current ? preview(current.card, Date.now(), settings.retention) : null),
    [current, settings.retention],
  );

  const dueGrammar = useMemo(() => {
    if (!grammarMeta) return [];
    const byId = new Map(grammarMeta.points.map((p) => [p.id, p]));
    return duePoints(grammarMeta, progress)
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
  }, [grammarMeta, progress]);
  const untouchedGrammar = useMemo(
    () => (grammarMeta ? untouchedWithErrors(grammarMeta, progress) : []),
    [grammarMeta, progress],
  );
  const speakEntries = progress.speakCorrections ?? [];
  const leeches = useMemo(() => leechIds(progress), [progress]);
  const suspendedLeeches = useMemo(() => new Set(progress.suspendedLeeches ?? []), [progress.suspendedLeeches]);
  const harvestedNoteKeys = useMemo(
    () => new Set((progress.essayNotes ?? []).map((n) => `${n.wrong.trim().toLowerCase()}=>${n.right.trim().toLowerCase()}`)),
    [progress.essayNotes],
  );

  const rate = (grade: Grade) => {
    if (!current) return;
    gradeReflow(current.key, grade);
    resetCardInputs();
  };

  const removeCurrentNote = async () => {
    if (!current || current.kind !== "essay") return;
    const ok = await confirmAction({
      title: "从错句本移除这条笔记？",
      message: `将移除「${current.note.wrong || current.note.right}」。`,
      confirmLabel: "移除",
      danger: true,
    });
    if (!ok) return;
    deleteNote(current.note.id);
    resetCardInputs();
    toast("已移出错句本");
  };

  const practiceWrongWords = () => {
    try {
      localStorage.setItem("word-atlas:practice:source", "mistakes");
    } catch {
      /* optional preference */
    }
    go({ page: "practice" });
  };

  return (
    <div className="page practice reflow-page">
      <header className="page-head">
        <button className="link deck-back" onClick={onExit}>
          <ArrowLeft size={16} /> 返回应试
        </button>
        <p className="eyebrow">统一错题中心 · Centre d&apos;erreurs</p>
        <h1 className="display">把丢过的分，拿回来。</h1>
        <p className="lede">集中管理错词、到期语法、写作与口语错句以及听读真题陷阱，按 FSRS 遗忘曲线与专项练习逐项清零。</p>
      </header>

      <div className="segmented segmented-wide reflow-tabs" role="tablist" aria-label="错题分类切换">
        <button role="tab" aria-selected={tab === "words"} className={tab === "words" ? "is-on" : ""} onClick={() => switchTab("words")}>
          错词 ({counts.words})
        </button>
        <button role="tab" aria-selected={tab === "grammar"} className={tab === "grammar" ? "is-on" : ""} onClick={() => switchTab("grammar")}>
          语法 ({counts.grammarTotal})
        </button>
        <button role="tab" aria-selected={tab === "sentences"} className={tab === "sentences" ? "is-on" : ""} onClick={() => switchTab("sentences")}>
          写作口语错句 ({counts.sentencesTotal})
        </button>
        <button role="tab" aria-selected={tab === "comp"} className={tab === "comp" ? "is-on" : ""} onClick={() => switchTab("comp")}>
          听读真题陷阱 ({counts.compDue})
        </button>
      </div>

      {tab === "words" && (
        <section className="panel reflow-panel">
          {progress.mistakes.length === 0 ? (
            <div className="reflow-empty">
              <Check size={28} />
              <h2>暂无待巩固的错词</h2>
              <p className="muted">背词、配对或拼写练习中答错的词会自动收录在这里。</p>
            </div>
          ) : (
            <>
              <div className="panel-head">
                <h2 className="eyebrow">近期答错词汇 · {progress.mistakes.length} 词</h2>
                <button type="button" className="btn btn-primary btn-sm" onClick={practiceWrongWords}>
                  去练错词拼写 / 听写 <ArrowRight size={14} />
                </button>
              </div>
              <ul className="reflow-word-list">
                {progress.mistakes.map((id) => {
                  const w = atlas.byId.get(id);
                  return (
                    <li key={id} className="reflow-word-row">
                      <button type="button" className="reflow-word-open" onClick={() => openWord(id)}>
                        <b lang="fr">{w?.word ?? id}</b>
                        <span className="muted">{w?.zh ?? "（点击查看词条）"}</span>
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`移出错词 ${w?.word ?? id}`}
                        onClick={() => removeWordMistake(id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {leeches.length > 0 && (
            <div className="reflow-leech-block">
              <div className="panel-head">
                <div>
                  <h2 className="eyebrow">顽固易忘词（Leech · 失误 ≥{LEECH_DEFAULT_THRESHOLD} 次，共 {leeches.length} 词）</h2>
                  <p className="muted small">可先暂停极难词避免阻塞复习队列，或点词查看例句/词根重构记忆。</p>
                </div>
              </div>
              <ul className="reflow-word-list">
                {leeches.map((id) => {
                  const w = atlas.byId.get(id);
                  const isSuspended = suspendedLeeches.has(id);
                  const lapses = progress.cards[id]?.lapses ?? 0;
                  return (
                    <li key={id} className={`reflow-word-row ${isSuspended ? "is-suspended" : ""}`}>
                      <button type="button" className="reflow-word-open" onClick={() => openWord(id)}>
                        <b lang="fr">{w?.word ?? id}</b>
                        <span className="chip">失误 {lapses} 次</span>
                        <span className="muted">{w?.zh ?? "（点击查看词条）"}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          if (isSuspended) {
                            unsuspendLeech(id);
                            toast(`已恢复「${w?.word ?? id}」的 FSRS 复习`, "ok");
                          } else {
                            suspendLeech(id);
                            toast(`已暂停「${w?.word ?? id}」，不再挤占每日复习队列`, "ok");
                          }
                        }}
                      >
                        {isSuspended ? "恢复复习" : "暂停该词"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      )}

      {tab === "grammar" && (
        <section className="panel reflow-panel">
          {!grammarMeta ? (
            <p className="muted">正在读取语法进度索引…</p>
          ) : dueGrammar.length === 0 && untouchedGrammar.length === 0 ? (
            <div className="reflow-empty">
              <Layers size={28} />
              <h2>今天没有到期或待补的语法点</h2>
              <p className="muted">写作或口语批改中标记出的薄弱语法，会自动出现在这里。</p>
              <a className="btn btn-primary" href={href({ page: "grammar" })}>
                前往语法模块 <ArrowRight size={16} />
              </a>
            </div>
          ) : (
            <div className="reflow-grammar-wrap">
              <div className="panel-head">
                <h2 className="eyebrow">语法复习与批改关联错误</h2>
                <a className="btn btn-primary btn-sm" href={href({ page: "grammar" })}>
                  打开语法复习 <ArrowRight size={14} />
                </a>
              </div>
              {dueGrammar.length > 0 && (
                <div className="reflow-gram-group">
                  <h3>到期语法点（{dueGrammar.length}）</h3>
                  <ul className="reflow-gram-list">
                    {dueGrammar.map((p) => (
                      <li key={p.id}>
                        <a className="gram-card" href={`#/grammar?p=${p.id}`}>
                          <span className="gram-card-title">{p.title}</span>
                          <small lang="fr">{p.fr}</small>
                          <span className="gram-status is-due">该复习了</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {untouchedGrammar.length > 0 && (
                <div className="reflow-gram-group">
                  <h3>写作/口语曾出错 · 尚未开始练（{untouchedGrammar.length}）</h3>
                  <ul className="reflow-gram-list">
                    {untouchedGrammar.map(({ point, n }) => (
                      <li key={point.id}>
                        <a className="gram-card" href={`#/grammar?p=${point.id}`}>
                          <span className="gram-card-title">{point.title}</span>
                          <small lang="fr">{point.fr}</small>
                          <span className="gram-status is-due">曾错 {n} 处</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {(tab === "sentences" || tab === "comp") && (
        <>
          {!current ? (
            <section className="panel reflow-empty">
              {tab === "sentences" ? <MessageSquareQuote size={28} /> : <BookMarked size={28} />}
              <h2>{tab === "sentences" ? "今日写作 FSRS 错句已巩固完" : "暂无待复盘的听读真题陷阱"}</h2>
              <p className="muted">
                {tab === "sentences" ? (
                  <>
                    在 <a className="link" href={href({ page: "essay" })}>篇章写作</a> 批改页点击「收进错句本」（非语法错误），就会进入这里按 FSRS 复习。
                  </>
                ) : (
                  <>
                    在 <a className="link" href={href({ page: "listen" })}>CO 听力</a> 或 <a className="link" href={href({ page: "examread" })}>CE 阅读</a> 交卷后，错题陷阱会自动进入这里。
                  </>
                )}
              </p>
              <div className="writing-actions">
                <button className="btn btn-primary" onClick={onExit}>
                  <RotateCcw size={16} /> 返回应试
                </button>
              </div>
            </section>
          ) : (
            <section className="panel reflow-card">
              <div className="panel-head">
                <span className="eyebrow">
                  {current.kind === "essay"
                    ? `写作错句 · ${ERROR_LABEL[current.note.type]} · 来自「${current.note.from}」`
                    : `${COMP_LABEL[current.miss.part]}${current.miss.skill ? ` · ${QSKILL_LABEL[current.miss.skill]}` : ""} · 错因归类：${CAUSE_LABEL[current.miss.cause]}`}
                </span>
                <span className="muted small">剩余 {pool.length} 题</span>
              </div>

              {current.kind === "essay" ? (
                <>
                  <div className="reflow-prompt">
                    <p className="muted small">原错句 / 不地道表达：</p>
                    <p className="reflow-wrong" lang="fr">
                      {current.note.wrong || "（缺漏表达）"}
                    </p>
                    {current.note.why && <p className="muted small">提示：{current.note.why}</p>}
                  </div>
                  {!revealed ? (
                    <div className="reflow-recall">
                      <label className="muted small" htmlFor="reflow-essay-input">
                        试着写出更准确 / 地道的法语改写（可直接看答案）：
                      </label>
                      <input
                        id="reflow-essay-input"
                        ref={inputRef}
                        className="conj-input"
                        lang="fr"
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        placeholder="输入修改后的表达…"
                        spellCheck={false}
                        autoCapitalize="off"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            setRevealed(true);
                          }
                        }}
                      />
                      <AccentKeys input={inputRef} value={typed} onChange={setTyped} />
                      <div className="writing-actions">
                        <button type="button" className="btn btn-primary" onClick={() => setRevealed(true)}>
                          核对改写答案
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="reflow-answer">
                      {typed.trim() && (
                        <p className="small">
                          你的尝试：<b lang="fr">{typed}</b>{" "}
                          {normalize(typed) === normalize(current.note.right) ? <span className="is-ok">✓ 完全一致</span> : null}
                        </p>
                      )}
                      <p>
                        推荐表达：<b className="reflow-right" lang="fr">{current.note.right}</b>
                      </p>
                      {current.note.why && <p className="muted">{current.note.why}</p>}
                      <div className="reflow-transfer">
                        <label className="muted small" htmlFor="reflow-transfer-input">
                          新语境造句迁移（≥5 词，用推荐表达换个主题造句）：
                        </label>
                        <div className="reflow-transfer-row">
                          <input
                            id="reflow-transfer-input"
                            ref={transferRef}
                            className="conj-input"
                            lang="fr"
                            value={transferText}
                            onChange={(e) => {
                              setTransferText(e.target.value);
                              setTransferResult(null);
                            }}
                            placeholder="例：换一个场景写出完整法语句子…"
                            spellCheck={false}
                            autoCapitalize="off"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void (async () => {
                                  const base = checkTransferSentence(transferText, current.note.right, current.note.wrong);
                                  if (!base.ok || !ready.text()) return setTransferResult(base);
                                  setTransferChecking(true);
                                  try {
                                    const eq = await checkGrammarEquivalence({
                                      kind: "sentence",
                                      pointTitle: current.note.point || undefined,
                                      prompt: `运用目标表达「${current.note.right}」造一个语法与搭配完全正确的法语新句`,
                                      expected: [current.note.right],
                                      answer: transferText,
                                    });
                                    setTransferResult(
                                      eq.equivalent
                                        ? { ...base, ok: true, tip: `✓ 迁移通过（AI 核验：${eq.why || "语法与搭配自然"}）` }
                                        : { ...base, ok: false, tip: `语法/搭配尚需微调：${eq.why}${eq.corrected ? `（建议：${eq.corrected}）` : ""}` },
                                    );
                                  } catch {
                                    setTransferResult(base);
                                  } finally {
                                    setTransferChecking(false);
                                  }
                                })();
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={transferChecking}
                            onClick={() =>
                              void (async () => {
                                const base = checkTransferSentence(transferText, current.note.right, current.note.wrong);
                                if (!base.ok || !ready.text()) return setTransferResult(base);
                                setTransferChecking(true);
                                try {
                                  const eq = await checkGrammarEquivalence({
                                    kind: "sentence",
                                    pointTitle: current.note.point || undefined,
                                    prompt: `运用目标表达「${current.note.right}」造一个语法与搭配完全正确的法语新句`,
                                    expected: [current.note.right],
                                    answer: transferText,
                                  });
                                  setTransferResult(
                                    eq.equivalent
                                      ? { ...base, ok: true, tip: `✓ 迁移通过（AI 核验：${eq.why || "语法与搭配自然"}）` }
                                      : { ...base, ok: false, tip: `语法/搭配尚需微调：${eq.why}${eq.corrected ? `（建议：${eq.corrected}）` : ""}` },
                                  );
                                } catch {
                                  setTransferResult(base);
                                } finally {
                                  setTransferChecking(false);
                                }
                              })()
                            }
                          >
                            {transferChecking ? "核验中…" : "检查新句"}
                          </button>
                        </div>
                        <AccentKeys
                          input={transferRef}
                          value={transferText}
                          onChange={(v) => {
                            setTransferText(v);
                            setTransferResult(null);
                          }}
                        />
                        {transferResult && (
                          <p className={`small ${transferResult.ok ? "is-ok" : "warn"}`} role="status">
                            {transferResult.tip}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="reflow-prompt">
                    <p className="reflow-miss-title">
                      <Headphones size={16} /> 曾在「{COMP_LABEL[current.miss.part]}
                      {current.miss.title ? ` · ${current.miss.title}` : ""}」中触发：<b>{CAUSE_LABEL[current.miss.cause]}</b>
                    </p>
                    {current.miss.stem ? (
                      <p className="reflow-q-stem" lang="fr">
                        {current.miss.stem}
                      </p>
                    ) : (
                      <p className="muted small">先在心里复述一遍这类 B2 陷阱的特点，以及下次做题时的排雷动作，再展开核对对策。</p>
                    )}
                    {current.miss.excerpt && (
                      <details className="essay-help" open={revealed}>
                        <summary>{revealed ? "原文依据片段" : "需要提示？展开原文依据片段"}</summary>
                        <p className="essay-text small" lang="fr">
                          {current.miss.excerpt}
                        </p>
                      </details>
                    )}
                    {current.miss.q && (
                      <label className="reflow-cause-edit">
                        <span className="muted small">调整错因分类：</span>
                        <select
                          value={current.miss.cause}
                          onChange={(e) => setMissCause(current.miss.at, current.miss.q!, e.target.value as MissCause)}
                          aria-label="调整错因分类"
                        >
                          {MISS_CAUSES.map((c) => (
                            <option key={c} value={c}>
                              {CAUSE_LABEL[c]}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                  {!revealed ? (
                    current.miss.stem ? (
                      <div className="reflow-reattempt">
                        {current.miss.qType !== "short" && current.miss.options && current.miss.options.length >= 2 && (
                          <div className="exam-options" role="radiogroup" aria-label="原题重做选项">
                            {current.miss.options.map((opt, idx) => (
                              <button
                                key={idx}
                                type="button"
                                role="radio"
                                aria-checked={rePicked === idx}
                                className={`exam-option ${rePicked === idx ? "is-on" : ""}`}
                                lang="fr"
                                onClick={() => setRePicked(idx)}
                              >
                                <span>{current.miss.qType === "vf" ? "VF"[idx] : "ABC"[idx]}</span>
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}
                        {(current.miss.qType === "short" || current.miss.qType === "vf") && (
                          <div className="reflow-recall">
                            <label className="muted small" htmlFor="reflow-comp-input">
                              {current.miss.qType === "vf" ? "请摘录原文依据（justifier par une citation）：" : "请输入法语简答："}
                            </label>
                            <input
                              id="reflow-comp-input"
                              ref={compRef}
                              className="conj-input"
                              lang="fr"
                              value={reTyped}
                              onChange={(e) => setReTyped(e.target.value)}
                              placeholder={current.miss.qType === "vf" ? "复制/默写原文关键句…" : "输入简答法语关键词或短句…"}
                              spellCheck={false}
                              autoCapitalize="off"
                            />
                            <AccentKeys input={compRef} value={reTyped} onChange={setReTyped} />
                          </div>
                        )}
                        <div className="writing-actions">
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={
                              current.miss.qType === "short"
                                ? !reTyped.trim()
                                : rePicked === undefined
                            }
                            onClick={() => setRevealed(true)}
                          >
                            提交原题重做
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={() => setRevealed(true)}>
                            直接查看解析与对策
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="writing-actions">
                        <button type="button" className="btn btn-primary" onClick={() => setRevealed(true)}>
                          显示审题排雷对策
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="reflow-answer">
                      {current.miss.stem && (() => {
                        const qt = current.miss.qType ?? "qcm";
                        const hasAttempt = qt === "short" ? !!reTyped.trim() : rePicked !== undefined;
                        const verdict = hasAttempt
                          ? gradeCompQuestion(
                              {
                                q: current.miss.stem,
                                qType: qt,
                                options: current.miss.options ?? [],
                                answer: current.miss.answer ?? 0,
                                quote: current.miss.quote,
                                accepted: current.miss.accepted,
                                why: current.miss.why ?? "",
                                pts: 1,
                                doc: 0,
                              },
                              rePicked,
                              reTyped,
                              current.miss.excerpt,
                            )
                          : null;
                        const ansIdx = current.miss.answer ?? 0;
                        const ansText =
                          qt === "short"
                            ? (current.miss.accepted ?? []).join(" / ")
                            : `${qt === "vf" ? "VF"[ansIdx] : "ABC"[ansIdx]}. ${current.miss.options?.[ansIdx] ?? ""}${current.miss.quote ? `（引证：${current.miss.quote}）` : ""}`;
                        return (
                          <>
                            {verdict && (
                              <p className={verdict.correct ? "is-ok" : "warn"}>
                                <b>{verdict.correct ? "✓ 原题重做答对 · 建议选「良好 / 简单」拉长间隔" : "✗ 仍踩中干扰陷阱 · 建议选「重来 / 困难」高频回炉"}</b>
                              </p>
                            )}
                            {ansText && (
                              <p>
                                参考答案：<b lang="fr">{ansText}</b>
                              </p>
                            )}
                            {current.miss.why && <p className="small muted">{current.miss.why}</p>}
                          </>
                        );
                      })()}
                      <p>
                        <b>对策（{CAUSE_LABEL[current.miss.cause]}）：</b>
                        {CAUSE_TIP[current.miss.cause]}
                      </p>
                    </div>
                  )}
                </>
              )}

              {revealed && intervals && (
                <div className="reflow-rate" role="group" aria-label="自我评级并安排 FSRS 复习">
                  {RATINGS.map((r) => (
                    <button key={r.grade} type="button" className={`btn ${r.tone}`} onClick={() => rate(r.grade)}>
                      <span>{r.label}</span>
                      <small>{formatInterval(intervals[r.grade])}</small>
                    </button>
                  ))}
                  {current.kind === "essay" && (
                    <button type="button" className="btn btn-ghost" onClick={() => void removeCurrentNote()} title="从错句本删除">
                      <Trash2 size={15} /> 移除
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          {tab === "sentences" && speakEntries.some((e) => e.corrections.some((c) => !harvestedNoteKeys.has(`${c.wrong.trim().toLowerCase()}=>${c.right.trim().toLowerCase()}`))) && (
            <section className="panel reflow-speak-list">
              <h2 className="eyebrow">PO 口语语法待练错句（已并入非语法 FSRS 复习队列的表达不重复显示）</h2>
              <ul className="writing-errors">
                {speakEntries.flatMap((entry) =>
                  entry.corrections.map((c, idx) => {
                    if (harvestedNoteKeys.has(`${c.wrong.trim().toLowerCase()}=>${c.right.trim().toLowerCase()}`)) return null;
                    return (
                      <li key={`${entry.id}-${idx}`}>
                      <span className="chip">{ERROR_LABEL[c.type]}</span>
                      <span lang="fr">
                        <del>{c.wrong}</del> → <ins>{c.right}</ins>
                      </span>
                      <small className="muted">
                        来自口语「{entry.subject}」{c.why ? ` · ${c.why}` : ""}
                      </small>
                      <div className="reflow-speak-actions">
                        {c.point && (
                          <a className="link small" href={`#/grammar?p=${c.point}`}>
                            去练关联语法 →
                          </a>
                        )}
                        <button
                          type="button"
                          className="link small"
                          onClick={() => deleteSpeakingCorrection(entry.id, idx)}
                        >
                          已掌握移除
                        </button>
                      </div>
                    </li>
                    );
                  }),
                )}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
