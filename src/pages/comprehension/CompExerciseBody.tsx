import { Check, Crosshair, FastForward, Headphones, ListPlus, MapPin, Play, Sparkles, Square, X } from "lucide-react";
import { useEffect, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { type DistractorExplanation } from "../../ai/tasks";
import { foldAccents } from "../../lib/accent";
import { playSlice, stopAudio } from "../../lib/audio";
import { estimateEvidenceWindow, probeAudioDuration } from "../../lib/audio-env";
import { BETWEEN_PLAYS, clock, exercisePoints, FORM_SPEC, gradeCompQuestion, QSKILL_LABEL, type CompExercise, type CompKind } from "../../lib/exam";
import type { ExamTrack } from "../../lib/exam-tracks";
import { splitSentences } from "../../lib/extract";
import { accentNames, CAUSE_LABEL, MISS_CAUSES, resolveMaterialUrl, type DocVoices, type MissCause } from "../../lib/listening";
import { AccentKeys } from "../../ui/AccentKeys";
import { TranscriptWords } from "../../ui/TranscriptWords";
import { IntensiveDoc } from "../Intensive";
import { normalizeCompQuestionForKind, shouldShowCitationInput } from "../comprehension-helpers";
import { num } from "./helpers";

const normProof = (s: string) =>
  foldAccents(s.replace(/[’‘]/g, "'"))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}']+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

function sentenceMatchesEvidence(sent: string, evidence: string): boolean {
  const ns = normProof(sent);
  const ne = normProof(evidence);
  if (!ns || !ne) return false;
  if (ns.includes(ne) || (ns.length >= 18 && ne.includes(ns))) return true;
  const eWords = ne.split(" ").filter((w) => w.length >= 4);
  if (!eWords.length) return false;
  const sSet = new Set(ns.split(" "));
  const hits = eWords.filter((w) => sSet.has(w)).length;
  return hits >= Math.min(4, eWords.length) && hits / eWords.length >= 0.65;
}

function findEvidenceSentenceKeys(ex: CompExercise, exIdx: number, docIdx: number, evidence: string): string[] {
  const doc = ex.docs[docIdx];
  if (!doc || !evidence.trim()) return [];
  const matches: string[] = [];
  doc.text
    .split(/\n+/)
    .filter(Boolean)
    .forEach((para, pi) => {
      splitSentences(para).forEach((sent, si) => {
        if (sentenceMatchesEvidence(sent, evidence)) matches.push(`${exIdx}-${docIdx}-${pi}-${si}`);
      });
    });
  return matches;
}

export interface CompExerciseBodyProps {
  kind: CompKind;
  examTrack?: ExamTrack;
  listen: boolean;
  done: boolean;
  ex: CompExercise;
  exIdx: number;
  exCount: number;
  voicesDoc: DocVoices[] | undefined;
  isAsked: (key: string) => boolean;
  pace: { e: number; label: string; left: number | null } | null;
  heard: boolean;
  continuousMock: boolean;
  panel: string | null;
  setPanel: (next: string | null) => void;
  showZh: boolean;
  setShowZh: Dispatch<SetStateAction<boolean>>;
  ceHl: Record<string, boolean>;
  setCeHl: Dispatch<SetStateAction<Record<string, boolean>>>;
  picked: Record<string, number>;
  setPicked: Dispatch<SetStateAction<Record<string, number>>>;
  typed: Record<string, string>;
  setTyped: Dispatch<SetStateAction<Record<string, string>>>;
  struck: Record<string, boolean>;
  setStruck: Dispatch<SetStateAction<Record<string, boolean>>>;
  expls: Record<string, DistractorExplanation>;
  explBusy: string | null;
  causes: Record<string, MissCause>;
  canExplainWrong: boolean;
  activeCeKey: string | null;
  setActiveCeKey: (key: string | null) => void;
  ceInputRefs: MutableRefObject<Record<string, HTMLInputElement | null>>;
  activeCeRef: MutableRefObject<HTMLInputElement | null>;
  onPerform: (e: number) => void;
  onSkipWait: () => void;
  onHalt: () => void;
  onReplay: (e: number, d: number) => void;
  onSpeakPiece: (text: string, rate: number, doc: string, dv?: DocVoices, who?: string) => Promise<void>;
  onToggleStrike: (optKey: string) => void;
  onExplainWrong: (key: string, q: CompExercise["questions"][number], pickedIdx: number, docText: string) => Promise<void>;
  onBlame: (key: string, cause: MissCause) => void;
}

export function CompExerciseBody({
  kind,
  examTrack = "delf",
  listen,
  done,
  ex,
  exIdx: e,
  exCount,
  voicesDoc,
  isAsked,
  pace,
  heard,
  continuousMock,
  panel,
  setPanel,
  showZh,
  setShowZh,
  ceHl,
  setCeHl,
  picked,
  setPicked,
  typed,
  setTyped,
  struck,
  setStruck,
  expls,
  explBusy,
  causes,
  canExplainWrong,
  activeCeKey,
  setActiveCeKey,
  ceInputRefs,
  activeCeRef,
  onPerform,
  onSkipWait,
  onHalt,
  onReplay,
  onSpeakPiece,
  onToggleStrike,
  onExplainWrong,
  onBlame,
}: CompExerciseBodyProps) {
  const spec = FORM_SPEC[ex.form];
  const busy = pace?.e === e;
  const showText = !listen || done;
  const [huntKey, setHuntKey] = useState<string | null>(null);
  const [huntFeedback, setHuntFeedback] = useState<Record<string, { ok: boolean; sk: string }>>({});
  const [locatedSents, setLocatedSents] = useState<Record<string, boolean>>({});
  const [openProof, setOpenProof] = useState<Record<string, boolean>>({});
  const [playingProofKey, setPlayingProofKey] = useState<string | null>(null);

  useEffect(() => {
    setHuntKey(null);
    setHuntFeedback({});
    setLocatedSents({});
    setOpenProof({});
    setPlayingProofKey(null);
  }, [done, ex]);

  const handlePlayAudioEvidence = async (key: string, docIdx: number, evidence: string) => {
    if (playingProofKey === key) {
      stopAudio();
      setPlayingProofKey(null);
      return;
    }
    const doc = ex.docs[docIdx] ?? ex.docs[0];
    if (!doc) return;
    setPlayingProofKey(key);
    try {
      if (doc.audioUrl) {
        const base = (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");
        const resolvedUrl = resolveMaterialUrl(doc.audioUrl.replace(/^\//, ""), base);
        const dur = await probeAudioDuration(resolvedUrl);
        if (dur && dur > 0) {
          const { startSec, endSec } = estimateEvidenceWindow(doc.text, evidence, dur);
          const res = await playSlice(resolvedUrl, startSec, endSec, 1);
          if (res === "recorded" || res === "stopped") return;
        }
      }
      await onSpeakPiece(evidence, 1, doc.text, voicesDoc?.[docIdx]);
    } finally {
      setPlayingProofKey((cur) => (cur === key ? null : cur));
    }
  };

  const handleSentencePick = (sk: string, sent: string) => {
    if (!listen && done && huntKey) {
      const qIdx = Number(huntKey.split("-")[1]);
      const qObj = Number.isInteger(qIdx) ? ex.questions[qIdx] : undefined;
      const proof = qObj?.evidence || qObj?.quote || "";
      const expectedKeys = qObj ? findEvidenceSentenceKeys(ex, e, qObj.doc ?? 0, proof) : [];
      const ok = expectedKeys.includes(sk) || (proof ? sentenceMatchesEvidence(sent, proof) : false);
      setHuntFeedback((cur) => ({ ...cur, [huntKey]: { ok, sk } }));
      if (ok) {
        setLocatedSents((cur) => ({ ...cur, [sk]: true }));
        setOpenProof((cur) => ({ ...cur, [huntKey]: true }));
        setHuntKey(null);
      }
      return;
    }
    setCeHl((cur) => ({ ...cur, [sk]: !cur[sk] }));
  };

  const handleLocateEvidence = (key: string, docIdx: number, proof: string) => {
    const keys = findEvidenceSentenceKeys(ex, e, docIdx, proof);
    setOpenProof((cur) => ({ ...cur, [key]: true }));
    setHuntKey((cur) => (cur === key ? null : cur));
    if (keys.length > 0) {
      setLocatedSents((cur) => {
        const next = { ...cur };
        for (const k of keys) next[k] = true;
        return next;
      });
      if (typeof document !== "undefined") {
        document.getElementById(`ce-sent-${keys[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  return (
    <section className="exam-exercise">
      <header className="exam-ex-head">
        <h3>
          {exCount > 1 ? `EXERCICE ${e + 1}` : "EXERCICE"}{" "}
          <small>{examTrack === "delf" ? `${num(exercisePoints(ex))} points` : `${ex.questions.length} QCM (A–D)`}</small>
        </h3>
        {ex.intro && (
          <p className="muted" lang="fr">
            {ex.intro}
          </p>
        )}
      </header>

      {listen && !done && (
        <div className="exam-player">
          {busy ? (
            <>
              <span className="exam-clock">
                {pace.label}
                {pace.left !== null ? ` ${clock(pace.left)}` : "…"}
              </span>
              {!continuousMock && pace.left !== null && (
                <button className="btn btn-ghost" onClick={onSkipWait}>
                  <FastForward size={16} /> 跳过等待
                </button>
              )}
              {!continuousMock && (
                <button className="btn btn-ghost" onClick={onHalt}>
                  <Square size={16} /> 停止
                </button>
              )}
            </>
          ) : heard ? (
            <span className="muted">这个练习的录音已经放完，凭记忆作答。</span>
          ) : continuousMock && exCount > 1 ? (
            <span className="muted small">
              {pace ? "等待整卷连续播音轮到本练习…" : "请在上方点击「开始整卷连续播放」，将按考场节奏连续播放全卷。"}
            </span>
          ) : (
            <>
              <button className="btn btn-primary" onClick={() => onPerform(e)} disabled={!!pace}>
                <Play size={16} /> 开始这个练习
              </button>
              <span className="muted">
                {examTrack !== "delf"
                  ? `${ex.docs.length > 1 ? `${ex.docs.length} 段录音` : "单段录音"}：先读题 20 秒，严格「1 遍播音」（只放一遍），再给 15 秒作答。`
                  : ex.form === "short"
                    ? `三段录音，各读题 ${spec.read} 秒、听一遍、作答 ${spec.answer} 秒。`
                    : `读题 ${spec.read} 秒，听两遍（中间停 ${BETWEEN_PLAYS} 秒），再给 ${spec.answer} 秒作答。`}
              </span>
            </>
          )}
        </div>
      )}

      {showText &&
        ex.docs.map((d, k) => {
          const docPrefix = `${e}-${k}-`;
          const docHlCount = !listen ? Object.entries(ceHl).filter(([sk, on]) => on && sk.startsWith(docPrefix)).length : 0;
          return (
            <article key={k} className="exam-doc">
              <div className="exam-doc-head">
                <h4 className="exam-doc-title" lang="fr">
                  {ex.docs.length > 1 ? `Document ${k + 1}` : ex.title}
                </h4>
                {!listen && (
                  <span className="exam-hl-tools">
                    <small className="muted">
                      {huntKey
                        ? `寻证模式：请直接点击支撑第 ${Number(huntKey.split("-")[1]) + 1} 题答案的原文句子`
                        : `点击句子可高亮证据${docHlCount > 0 ? `（已标 ${docHlCount}）` : ""}`}
                    </small>
                    {huntKey && (
                      <button type="button" className="link" onClick={() => setHuntKey(null)}>
                        退出寻证
                      </button>
                    )}
                    {docHlCount > 0 && (
                      <button
                        type="button"
                        className="link"
                        onClick={() =>
                          setCeHl((cur) => Object.fromEntries(Object.entries(cur).filter(([sk]) => !sk.startsWith(docPrefix))))
                        }
                      >
                        清除高亮
                      </button>
                    )}
                  </span>
                )}
              </div>
              {listen ? (
                <p className="essay-text" lang="fr">
                  {d.text}
                </p>
              ) : (
                <div className={`essay-text ce-doc-body ${huntKey ? "is-hunting" : ""}`} lang="fr">
                  {d.text.split(/\n+/).filter(Boolean).map((para, pi) => (
                    <p key={pi}>
                      {splitSentences(para).map((sent, si, arr) => {
                        const sk = `${e}-${k}-${pi}-${si}`;
                        const on = !!ceHl[sk];
                        const isProof = !!locatedSents[sk];
                        return (
                          <span
                            id={`ce-sent-${sk}`}
                            key={sk}
                            role="button"
                            tabIndex={0}
                            aria-pressed={on || isProof}
                            className={`ce-sent ${on ? "is-hl" : ""} ${isProof ? "is-proof" : ""}`}
                            onClick={() => handleSentencePick(sk, sent)}
                            onKeyDown={(ev) => {
                              if (ev.key === "Enter" || ev.key === " ") {
                                ev.preventDefault();
                                handleSentencePick(sk, sent);
                              }
                            }}
                          >
                            {sent}
                            {si < arr.length - 1 ? " " : ""}
                          </span>
                        );
                      })}
                    </p>
                  ))}
                </div>
              )}
              {done && listen && voicesDoc?.[k]?.accents.length ? <p className="muted small">口音：{accentNames(voicesDoc[k].accents)}</p> : null}
              {done && (
                <div className="exam-doc-actions">
                  {listen && (
                    <button className="link" onClick={() => setPanel(panel === `i${e}-${k}` ? null : `i${e}-${k}`)}>
                      <Headphones size={14} /> 精听：听写 / 跟读
                    </button>
                  )}
                  <button className="link" onClick={() => setPanel(panel === `w${e}-${k}` ? null : `w${e}-${k}`)}>
                    <ListPlus size={14} /> 原文生词入库
                  </button>
                  {listen &&
                    (busy ? (
                      <button className="link" onClick={onHalt}>
                        停止
                      </button>
                    ) : (
                      <button className="link" onClick={() => onReplay(e, k)}>
                        重听
                      </button>
                    ))}
                  {d.zh && (
                    <button className="link" onClick={() => setShowZh((v) => !v)}>
                      {showZh ? "收起译文" : "看中文译文"}
                    </button>
                  )}
                </div>
              )}
              {done && showZh && d.zh && <p className="essay-text exam-zh">{d.zh}</p>}
              {done && panel === `w${e}-${k}` && <TranscriptWords text={d.text} deckName={listen ? "听力生词" : "阅读生词"} onClose={() => setPanel(null)} />}
              {done && panel === `i${e}-${k}` && <IntensiveDoc text={d.text} speak={(t, rate, who) => onSpeakPiece(t, rate, d.text, voicesDoc?.[k], who)} />}
            </article>
          );
        })}

      {ex.form === "opinions" && (
        <p className="exam-q" lang="fr">
          À quelle personne associez-vous chaque point de vue ?
        </p>
      )}
      <ol className="exam-questions">
        {ex.questions.map((q, k) => {
          const key = `${e}-${k}`;
          if (!isAsked(key)) return null;
          const nq = normalizeCompQuestionForKind(q, kind);
          const docText = ex.docs[nq.doc]?.text;
          const verdict = done ? gradeCompQuestion(nq, picked[key], typed[key], docText) : null;
          const miss = done && !verdict?.correct;
          const qt = nq.qType ?? "qcm";
          const showCite = shouldShowCitationInput(nq, kind);
          const optionLetters = qt === "vf" || (nq.options.length === 2 && nq.options[0] === "Vrai") ? "VF" : "ABCDEF";
          const first = ex.docs.length > 1 && (k === 0 || ex.questions[k - 1].doc !== nq.doc);
          return (
            <li key={k}>
              {first && <p className="eyebrow">Document {nq.doc + 1}</p>}
              <p className="exam-q" lang="fr">
                {showCite && <span className="exam-q-badge">Vrai / Faux · 须原文引证</span>}
                {qt === "short" && <span className="exam-q-badge">简答题 · 写核心要点</span>}
                {nq.q} <small>{num(nq.pts)} pt</small>
              </p>
              {qt !== "short" && (
                <div className="exam-options" role="radiogroup" aria-label={`第 ${k + 1} 题`}>
                  {nq.options.map((o, j) => {
                    const on = picked[key] === j;
                    const optKey = `${key}-${j}`;
                    const isStruck = !done && !!struck[optKey];
                    const state = done ? (j === nq.answer ? "is-right" : on ? "is-wrong" : "") : on ? "is-on" : "";
                    return (
                      <div key={j} className="exam-opt-row">
                        <button
                          type="button"
                          role="radio"
                          aria-checked={on}
                          className={`exam-option ${state} ${isStruck ? "is-struck" : ""}`}
                          disabled={done}
                          lang="fr"
                          onClick={() => {
                            setPicked((p) => ({ ...p, [key]: j }));
                            setStruck((s) => {
                              if (!s[optKey]) return s;
                              const next = { ...s };
                              delete next[optKey];
                              return next;
                            });
                          }}
                          onContextMenu={
                            !done
                              ? (ev) => {
                                  ev.preventDefault();
                                  onToggleStrike(optKey);
                                }
                              : undefined
                          }
                        >
                          <span>{optionLetters[j]}</span>
                          <span className="exam-opt-body">
                            {o}
                            {done && nq.trapTypes?.[j] && (
                              <small className="exam-trap-tag" lang="zh-CN">
                                {nq.trapTypes[j]}
                              </small>
                            )}
                          </span>
                          {done && j === nq.answer && <Check size={16} />}
                          {done && on && j !== nq.answer && <X size={16} />}
                        </button>
                        {!done && (
                          <button
                            type="button"
                            className={`exam-strike-btn ${isStruck ? "is-on" : ""}`}
                            aria-pressed={isStruck}
                            title="右键选项或点此划线排除干扰项"
                            onClick={() => onToggleStrike(optKey)}
                          >
                            {isStruck ? "已排除" : "排除"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {showCite && (
                <div className="exam-cite-box">
                  <input
                    ref={(el) => {
                      ceInputRefs.current[key] = el;
                    }}
                    onFocus={() => {
                      activeCeRef.current = ceInputRefs.current[key];
                      setActiveCeKey(key);
                    }}
                    type="text"
                    className="exam-cite-input"
                    lang="fr"
                    disabled={done}
                    value={typed[key] ?? ""}
                    onChange={(ev) => setTyped((t) => ({ ...t, [key]: ev.target.value }))}
                    placeholder="Justifiez votre réponse en recopiant une phrase ou un extrait exact du document…"
                    aria-label={`第 ${k + 1} 题原文引证`}
                  />
                  {!done && activeCeKey === key && (
                    <AccentKeys input={activeCeRef} value={typed[key] ?? ""} onChange={(v) => setTyped((t) => ({ ...t, [key]: v }))} />
                  )}
                  {done && (
                    <p className={`exam-cite-status ${verdict?.quoteMatched ? "is-ok" : "is-miss"}`}>
                      {verdict?.quoteMatched ? "✓ 原文引证核对通过。" : `✗ 未匹配原文引证（官方规则：判断对但无正确引证不得分）。参考引证：「${nq.quote}」`}
                    </p>
                  )}
                </div>
              )}
              {qt === "short" && (
                <div className="exam-cite-box">
                  <input
                    ref={(el) => {
                      ceInputRefs.current[key] = el;
                    }}
                    onFocus={() => {
                      activeCeRef.current = ceInputRefs.current[key];
                      setActiveCeKey(key);
                    }}
                    type="text"
                    className="exam-cite-input"
                    lang="fr"
                    disabled={done}
                    value={typed[key] ?? ""}
                    onChange={(ev) => setTyped((t) => ({ ...t, [key]: ev.target.value }))}
                    placeholder="Réponse courte en français (mots-clés ou expression du texte)…"
                    aria-label={`第 ${k + 1} 题简答`}
                  />
                  {!done && activeCeKey === key && (
                    <AccentKeys input={activeCeRef} value={typed[key] ?? ""} onChange={(v) => setTyped((t) => ({ ...t, [key]: v }))} />
                  )}
                  {done && (
                    <p className={`exam-cite-status ${verdict?.correct ? "is-ok" : "is-miss"}`}>
                      {verdict?.correct ? "✓ 简答核心要点命中。" : "✗ 未命中核心采分点。"} 参考答案：<span lang="fr">{q.accepted?.join(" / ")}</span>
                    </p>
                  )}
                </div>
              )}
              {done && q.why && <p className="exam-why">{q.why}</p>}
              {done && !listen && (nq.evidence || nq.quote) && (
                <div className="ce-proof-coach">
                  <div className="exam-doc-actions">
                    <button
                      type="button"
                      className={`link ${huntKey === key ? "is-on" : ""}`}
                      aria-pressed={huntKey === key}
                      onClick={() => setHuntKey((cur) => (cur === key ? null : key))}
                    >
                      <Crosshair size={14} /> {huntKey === key ? "正在寻证：请点击上方原文依据句" : "点选原文寻证（点击文中依据句验证）"}
                    </button>
                    <button
                      type="button"
                      className="link"
                      onClick={() => handleLocateEvidence(key, nq.doc ?? 0, nq.evidence ?? nq.quote ?? "")}
                    >
                      <MapPin size={14} /> 定位原文依据
                    </button>
                  </div>
                  {huntKey === key && (
                    <p className="ce-proof-hint muted small">
                      回到上方原文，直接点击能支撑本题正确选项的那句话进行验证。
                    </p>
                  )}
                  {huntFeedback[key] && (
                    <p className={`exam-cite-status ${huntFeedback[key].ok ? "is-ok" : "is-miss"}`}>
                      {huntFeedback[key].ok
                        ? "✓ 命中核心依据句！原文证据已在文中高亮标出。"
                        : "✗ 这句不是本题的核心依据，请再回原文找找，或点击「定位原文依据」直接查看。"}
                    </p>
                  )}
                  {openProof[key] && (
                    <p className="ce-proof-quote small">
                      <b>原文依据句：</b>
                      <span lang="fr">« {nq.evidence ?? nq.quote} »</span>
                    </p>
                  )}
                </div>
              )}
              {done && listen && nq.evidence && (
                <div className="ce-proof-coach">
                  <div className="exam-doc-actions">
                    <button
                      type="button"
                      className={`btn btn-ghost btn-sm ${playingProofKey === key ? "is-on" : ""}`}
                      onClick={() => void handlePlayAudioEvidence(key, nq.doc ?? 0, nq.evidence!)}
                    >
                      {playingProofKey === key ? (
                        <>
                          <Square size={13} /> 停止证据片段
                        </>
                      ) : (
                        <>▶ 听 10s 原声证据</>
                      )}
                    </button>
                  </div>
                  <p className="ce-proof-quote small">
                    <b>录音原文依据：</b>
                    <span lang="fr">« {nq.evidence} »</span>
                  </p>
                </div>
              )}
              {miss && qt !== "short" && picked[key] !== undefined && canExplainWrong && (
                <div className="exam-expl-wrap">
                  {!expls[key] ? (
                    <button
                      type="button"
                      className="link"
                      disabled={explBusy === key}
                      onClick={() => void onExplainWrong(key, nq, picked[key], docText ?? "")}
                    >
                      <Sparkles size={14} /> {explBusy === key ? "AI 分析干扰陷阱中…" : "问 AI：为什么我选的这项是陷阱？"}
                    </button>
                  ) : (
                    <div className="exam-expl-card">
                      {expls[key].evidence && (
                        <p>
                          <b>原文依据：</b>
                          <span lang="fr">{expls[key].evidence}</span>
                        </p>
                      )}
                      <p>
                        <b>陷阱解析：</b>
                        {expls[key].whyTrap}
                      </p>
                      <p>
                        <b>正确同义改写：</b>
                        {expls[key].whyRight}
                      </p>
                      {expls[key].tip && (
                        <p className="muted small">
                          <b>排雷技巧：</b>
                          {expls[key].tip}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {miss && (
                <div className="miss-cause" role="group" aria-label="错因">
                  <span className="muted">错因{q.skill ? `（${QSKILL_LABEL[q.skill]}题）` : ""}：</span>
                  {MISS_CAUSES.map((c) => (
                    <button key={c} className={causes[key] === c ? "is-on" : ""} onClick={() => onBlame(key, c)} aria-pressed={causes[key] === c}>
                      {CAUSE_LABEL[c]}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
