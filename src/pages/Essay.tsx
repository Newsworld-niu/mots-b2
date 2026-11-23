import { ArrowLeft, ArrowRight, BookmarkPlus, BookMarked, Check, PenLine, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ready, useAiConfig } from "../ai/config";
import { gradeEssay, makeEssayTask, makeModelEssay } from "../ai/tasks";
import type { TrackWritingGradeResult } from "../ai/tasks/writing-tracks";
import { useGrammar } from "../atlas/grammar";
import {
  B2_GENRES,
  CONNECTORS,
  countWords,
  CRITERIA,
  CRITERION_CHECK,
  CRITERION_LABEL,
  diffSecondDraftCorrections,
  ESSAY_PLANS,
  ESSAY_TASKS,
  FORMAL_GENRES,
  GENRE_LABEL,
  GENRES,
  genresFor,
  isAiTask,
  LETTER_FORMULAS,
  LETTER_TEMPLATE,
  LEVELS,
  MAX_ESSAY_LENGTH,
  maxScore,
  pickAiTaskOptions,
  totalScore,
  type DocMode,
  type EssayFeedback,
  type EssayTask,
  type Genre,
  type PlanKind,
  type SavedEssay,
} from "../lib/essay";
import { clock, topicOf } from "../lib/exam";
import { scoreTcfProductive20, scoreTefSection699, TRACK_META, type ExamTrack } from "../lib/exam-tracks";
import { ERROR_LABEL } from "../lib/writing";
import type { TcfWritingSuite, TefWritingSuite } from "../lib/writing-tracks";
import { useNavGuard } from "../lib/nav-guard";
import { go, href } from "../lib/router";
import { useTimer } from "../lib/timer";
import { deleteAiTask, deleteEssay, deleteNote, harvestNonGrammarNotes, logExam, patchEssay, saveAiTask, saveEssay, saveNote } from "../store/essays";
import { clearTombstone, markTombstone, store, useStore } from "../store/store";
import { AccentKeys } from "../ui/AccentKeys";
import { confirmAction } from "../ui/ConfirmSheet";
import { Marking } from "../ui/Marking";
import { ParagraphUpgrader } from "../ui/ParagraphUpgrader";
import { ArgumentsDrawer } from "../ui/ArgumentsDrawer";
import { StaticEssayModel } from "../ui/StaticEssayModel";
import { SAMPLE_ESSAY_PREVIEW } from "../lib/ai-samples";
import { toast } from "../ui/Toast";
import { WordPopup } from "../ui/WordPopup";

const DRAFT = (task: string) => `fb2.essay.draft.${task}`;
const DRAFT_AT = (task: string) => `fb2.essay.draftAt.${task}`;
const readDraft = (task: string) => {
  try {
    return localStorage.getItem(DRAFT(task)) ?? "";
  } catch {
    return "";
  }
};
const writeDraft = (task: string, text: string) => {
  try {
    const key = DRAFT(task);
    const now = Date.now();
    if (text.trim()) {
      localStorage.setItem(key, text);
      localStorage.setItem(DRAFT_AT(task), String(now));
      if (store.get().progress.tombstones?.[`draft:${key}`]) {
        store.progress((p) => clearTombstone(p, `draft:${key}`));
      }
    } else if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key);
      localStorage.setItem(DRAFT_AT(task), String(now));
      store.progress((p) => markTombstone(p, `draft:${key}`, now));
    }
    if (typeof window !== "undefined") window.dispatchEvent(new Event("fb2:draft-changed"));
  } catch {
    /* a draft that cannot be kept is not worth an error */
  }
};

const day = (ms: number) => new Date(ms).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });

type View = { at: "list" } | { at: "write"; task: EssayTask } | { at: "result"; task: EssayTask; id: string } | { at: "revise"; task: EssayTask; id: string };

/** Below this the next try is worth it (out of 25). */
const LOW = 15;

interface TaskStat {
  done: number;
  best: number;
  last: number;
  draft: boolean;
}

/** What the learner has done with a task: times written, best score (-1 if never marked), last time, a draft waiting. */
function statOf(essays: SavedEssay[], task: EssayTask): TaskStat {
  const mine = essays.filter((e) => e.task === task.id);
  return {
    done: mine.length,
    best: mine.reduce((m, e) => (e.fb ? Math.max(m, totalScore(e.fb)) : m), -1),
    last: mine.reduce((m, e) => Math.max(m, e.created), 0),
    draft: !!readDraft(task.id),
  };
}

/** Order for the list and for the recommendation: a draft first, then never written, then the lowest best score, then the longest ago. */
const rankOf = (s: TaskStat) => (s.draft ? 0 : s.done === 0 ? 1 : s.best < 0 ? 2 : 3);
function byNeed(a: [EssayTask, TaskStat], b: [EssayTask, TaskStat]) {
  const [ta, sa] = a;
  const [tb, sb] = b;
  if (rankOf(sa) !== rankOf(sb)) return rankOf(sa) - rankOf(sb);
  if (rankOf(sa) === 3 && sa.best !== sb.best) return sa.best - sb.best;
  if (sa.last !== sb.last) return sa.last - sb.last;
  return ta.level === tb.level ? 0 : ta.level === "B1" ? -1 : 1;
}

const reasonOf = (s: TaskStat) =>
  s.draft ? "有一份没写完的草稿，接着写" : s.done === 0 ? "还没写过" : s.best < 0 ? "写过但还没批改过" : s.best < LOW ? `上次最高只有 ${s.best}/25，再写一次` : `最高 ${s.best}/25，隔了一阵，再练一次`;

const countClass = (n: number, min: number) => (n < Math.round(min * 0.9) ? "is-short warn-text" : n < min ? "is-short" : "is-ok");
const countLabel = (n: number, min: number, max: number) => `${n} 词 · 至少 ${min} 词（推荐 ${min}–${max}，${Math.round(min * 0.9)} 警戒 / ${Math.floor(min / 2)} 零分）`;

const TRACK_DRAFT_KEY = (suiteId: string) => `fb2.trackEssay.draft.${suiteId}`;

function readTrackDraft(suiteId: string, partsCount: number): string[] {
  try {
    const raw = localStorage.getItem(TRACK_DRAFT_KEY(suiteId));
    if (!raw) return new Array<string>(partsCount).fill("");
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return Array.from({ length: partsCount }, (_, idx) => (typeof parsed[idx] === "string" ? parsed[idx] : ""));
    }
  } catch {
    /* ignore malformed local draft */
  }
  return new Array<string>(partsCount).fill("");
}

function writeTrackDraft(suiteId: string, parts: readonly string[]) {
  try {
    if (parts.some((p) => p.trim().length > 0)) {
      localStorage.setItem(TRACK_DRAFT_KEY(suiteId), JSON.stringify(parts));
    } else {
      localStorage.removeItem(TRACK_DRAFT_KEY(suiteId));
    }
  } catch {
    /* ignore quota errors */
  }
}

type TrackWritingModule = typeof import("../lib/writing-tracks");

function TrackEssayStudioBody({
  track,
  onSwitchTrack,
  onExit,
}: {
  track: "tcf" | "tef";
  onSwitchTrack: (t: ExamTrack) => void;
  onExit: () => void;
}) {
  const ai = useAiConfig();
  const { data: grammar } = useGrammar();
  const examLog = useStore((s) => s.progress.examLog);
  const notes = useStore((s) => s.progress.essayNotes) ?? [];
  const hasAi = ready.text(ai);
  const timer = useTimer();

  const [wtMod, setWtMod] = useState<TrackWritingModule | null>(null);
  const [stage, setStage] = useState<"list" | "write" | "result">("list");
  const [tcfSuite, setTcfSuite] = useState<TcfWritingSuite | null>(null);
  const [tefSuite, setTefSuite] = useState<TefWritingSuite | null>(null);
  const [parts, setParts] = useState<string[]>(["", "", ""]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [examMode, setExamMode] = useState(false);
  const [grading, setGrading] = useState(false);
  const [gradeRes, setGradeRes] = useState<TrackWritingGradeResult | null>(null);
  const [selfScores, setSelfScores] = useState<Record<string, number>>({});
  const [selfSaved, setSelfSaved] = useState(false);

  const boxRef0 = useRef<HTMLTextAreaElement | null>(null);
  const boxRef1 = useRef<HTMLTextAreaElement | null>(null);
  const boxRef2 = useRef<HTMLTextAreaElement | null>(null);
  const activeBoxRef = activeIdx === 0 ? boxRef0 : activeIdx === 1 ? boxRef1 : boxRef2;
  const ctrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;
    void import("../lib/writing-tracks").then((m) => {
      if (mounted) setWtMod(m);
    });
    return () => {
      mounted = false;
      ctrlRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    setStage("list");
    timer.stop();
    ctrlRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track]);

  const hasContent = parts.some((p) => p.trim().length > 0);
  useNavGuard(
    stage === "write" && (hasContent || (examMode && timer.sec > 0)),
    "多任务限时写作正在进行中（草稿已自动保存在本地），确定离开？",
  );

  const pointTitle = useMemo(() => new Map((grammar?.points ?? []).map((p) => [p.id, p.title])), [grammar]);
  const trackLogs = useMemo(
    () => (examLog ?? []).filter((r) => r.part === "essay" && r.track === track),
    [examLog, track],
  );

  const renderTrackSwitcher = (disabled = false) => (
    <div className="segmented" role="group" aria-label="切换写作考试体系">
      {(["delf", "tcf", "tef"] as const).map((t) => (
        <button
          key={t}
          type="button"
          className={track === t ? "is-on" : ""}
          aria-pressed={track === t}
          disabled={disabled}
          onClick={() => onSwitchTrack(t)}
        >
          {t === "delf" ? "DELF B2" : t === "tcf" ? "TCF EE（3篇 · /20）" : "TEF EE（A+B双篇 · /699）"}
        </button>
      ))}
    </div>
  );

  if (!wtMod) {
    return (
      <div className="page practice">
        <p className="muted">加载写作题库模块中…</p>
      </div>
    );
  }

  const openTcfSuite = (suite: TcfWritingSuite) => {
    setTcfSuite(suite);
    setTefSuite(null);
    setParts(readTrackDraft(suite.id, 3));
    setActiveIdx(0);
    setGradeRes(null);
    setSelfScores({});
    setSelfSaved(false);
    if (examMode) timer.start(suite.durationMinutes * 60);
    else timer.stop();
    setStage("write");
  };

  const openTefSuite = (suite: TefWritingSuite) => {
    setTefSuite(suite);
    setTcfSuite(null);
    setParts(readTrackDraft(suite.id, 2));
    setActiveIdx(0);
    setGradeRes(null);
    setSelfScores({});
    setSelfSaved(false);
    if (examMode) timer.start(suite.durationMinutes * 60);
    else timer.stop();
    setStage("write");
  };

  const activeSuiteId = track === "tcf" ? tcfSuite?.id ?? "" : tefSuite?.id ?? "";
  const activeSuiteTitle = track === "tcf" ? tcfSuite?.title ?? "" : tefSuite?.title ?? "";

  const updatePart = (idx: number, val: string) => {
    const clipped = val.slice(0, MAX_ESSAY_LENGTH);
    setParts((prev) => {
      const next = [...prev];
      next[idx] = clipped;
      if (activeSuiteId) writeTrackDraft(activeSuiteId, next);
      return next;
    });
  };

  const submitMultiPart = async () => {
    if (grading || !parts.some((p) => p.trim())) return;
    timer.stop();
    if (!hasAi) {
      setStage("result");
      return;
    }
    const c = new AbortController();
    ctrlRef.current = c;
    setGrading(true);
    try {
      const { gradeTrackWriting } = await import("../ai/tasks/writing-tracks");
      const pts = (grammar?.points ?? []).map((p) => ({ id: p.id, title: p.title }));
      let res: TrackWritingGradeResult;
      if (track === "tcf" && tcfSuite) {
        res = await gradeTrackWriting(
          {
            track: "tcf",
            suite: tcfSuite,
            texts: [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""],
            points: pts,
          },
          c.signal,
        );
        if (c.signal.aborted) return;
        store.progress((p) => harvestNonGrammarNotes(p, `TCF EE · ${tcfSuite.title}`, res.corrections));
        logExam({
          part: "essay",
          what: tcfSuite.id,
          score: res.scaledScore,
          total: 20,
          level: "B2",
          scope: "full",
          track: "tcf",
          trackSection: "ee",
          nclc: res.nclc,
        });
        writeTrackDraft(tcfSuite.id, ["", "", ""]);
      } else if (track === "tef" && tefSuite) {
        res = await gradeTrackWriting(
          {
            track: "tef",
            suite: tefSuite,
            secAText: parts[0] ?? "",
            secBText: parts[1] ?? "",
            points: pts,
          },
          c.signal,
        );
        if (c.signal.aborted) return;
        store.progress((p) => harvestNonGrammarNotes(p, `TEF EE · ${tefSuite.title}`, res.corrections));
        logExam({
          part: "essay",
          what: tefSuite.id,
          score: res.scaledScore,
          total: 699,
          scaledScore: res.scaledScore,
          level: "B2",
          scope: "full",
          track: "tef",
          trackSection: "ee",
          nclc: res.nclc,
        });
        writeTrackDraft(tefSuite.id, ["", ""]);
      } else {
        return;
      }
      setGradeRes(res);
      setStage("result");
    } catch (err) {
      if (!c.signal.aborted) toast((err as Error).message || "多任务作文批改失败", "warn");
    } finally {
      setGrading(false);
    }
  };

  if (stage === "list") {
    return (
      <div className="page practice">
        <header className="page-head">
          <button className="link deck-back" onClick={onExit}>
            <ArrowLeft size={16} /> 返回练习
          </button>
          <div className="writing-actions">{renderTrackSwitcher()}</div>
          <p className="eyebrow">
            {TRACK_META[track].shortName} · Expression écrite · {TRACK_META[track].badge}
          </p>
          <h1 className="display">
            {track === "tcf" ? "六十分钟三篇，字字卡准区间。" : "奇闻续写加读者来信，双文体同卷。"}
          </h1>
          <p className="lede">
            {track === "tcf"
              ? "严格对齐 TCF 全真三任务连考（共 60 分钟）：Tâche 1 实用短讯（60–120 词）+ Tâche 2 亲身经历博客文章（120–150 词）+ Tâche 3 双材料客观综述与个人观点（120–180 词），按 0–20 分（0.5 分档）及加拿大 NCLC 等级评分。"
              : "严格对齐 2023.12 新政后 TEF / TEF Canada 双任务（共 60 分钟）：Section A 报刊奇闻续写 fait divers（新增 ≥80 词，考查过去时态群与被动语态）+ Section B 读者来信正式驳论（≥200 词，至少 3 个带例论点），直出 0–699 分与 NCLC 1–12。"}
          </p>
          <label className="essay-check-doc">
            <input type="checkbox" checked={examMode} onChange={(e) => setExamMode(e.target.checked)} /> 模考模式（进入套卷自动开启 60 分钟共享倒计时，到时锁卷）
          </label>
        </header>

        <section className="essay-level">
          <h2 className="eyebrow">
            {track === "tcf"
              ? `内置全真 TCF 写作套卷（${wtMod.TCF_WRITING_SUITES.length} 套 · T1+T2+T3）`
              : `内置全真 TEF 写作套卷（${wtMod.TEF_WRITING_SUITES.length} 套 · Sec A+B）`}
          </h2>
          <div className="essay-tasks">
            {track === "tcf"
              ? wtMod.TCF_WRITING_SUITES.map((s) => {
                  const hasDraft = readTrackDraft(s.id, 3).some((x) => x.trim().length > 0);
                  return (
                    <button key={s.id} type="button" className="essay-task" onClick={() => openTcfSuite(s)}>
                      <span className="essay-chips">
                        <span className="chip">{s.topicZh}</span>
                        {hasDraft && <span className="chip chip-mine">有未交草稿</span>}
                      </span>
                      <b lang="fr">{s.title}</b>
                      <small>T1 (60–120w) · T2 (120–150w) · T3 双材料综述 (120–180w)</small>
                      <small className="essay-task-meta">限时 60 分钟 · 0–20 分 & NCLC</small>
                    </button>
                  );
                })
              : wtMod.TEF_WRITING_SUITES.map((s) => {
                  const hasDraft = readTrackDraft(s.id, 2).some((x) => x.trim().length > 0);
                  return (
                    <button key={s.id} type="button" className="essay-task" onClick={() => openTefSuite(s)}>
                      <span className="essay-chips">
                        <span className="chip">{s.topicZh}</span>
                        {hasDraft && <span className="chip chip-mine">有未交草稿</span>}
                      </span>
                      <b lang="fr">{s.title}</b>
                      <small lang="fr">Sec A: {s.sectionA.headlineFr}</small>
                      <small className="essay-task-meta" lang="fr">
                        Sec B (≥200w): {s.sectionB.claimFr}
                      </small>
                    </button>
                  );
                })}
          </div>
        </section>

        {notes.length > 0 && (
          <section className="essay-level">
            <details className="essay-fold">
              <summary>
                <BookMarked size={15} /> 错句本（{notes.length}）
              </summary>
              <ul className="writing-errors essay-corrections essay-notes">
                {notes.slice(0, 15).map((n) => (
                  <li key={n.id}>
                    <span className="chip">{ERROR_LABEL[n.type]}</span>
                    <span lang="fr">
                      {n.wrong && <del>{n.wrong}</del>} {n.right && <ins>{n.right}</ins>}
                    </span>
                    {n.why && <small>{n.why}</small>}
                    <button className="own-rm essay-note-rm" aria-label="从错句本删除" onClick={() => deleteNote(n.id)}>
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          </section>
        )}

        {trackLogs.length > 0 && (
          <section className="essay-level">
            <h2 className="eyebrow">{TRACK_META[track].shortName} 写作历史记录</h2>
            <ul className="essay-history">
              {trackLogs.slice(0, 10).map((r, idx) => (
                <li key={idx}>
                  <span>
                    {day(r.at)} ·{" "}
                    {(track === "tcf"
                      ? wtMod.TCF_WRITING_SUITES.find((x) => x.id === r.what)?.title
                      : wtMod.TEF_WRITING_SUITES.find((x) => x.id === r.what)?.title) ?? r.what}
                  </span>
                  <span className="muted">
                    {track === "tcf" ? `${r.score}/20` : `${r.scaledScore ?? r.score}/699`}
                    {r.nclc ? ` · NCLC ${r.nclc}` : ""}
                    {r.unverified ? " · 离线自评" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  if (stage === "result") {
    const offlineKeys =
      track === "tcf"
        ? ([
            ["p1", "T1–T2 实用信息与经验叙述"],
            ["p2", "T3 双材料综述与辩证观点"],
            ["lex", "多语体词汇与衔接"],
            ["mor", "句法复杂度与拼写语法"],
          ] as const)
        : ([
            ["p1", "Sec A 奇闻续写 (≥80词)"],
            ["p2", "Sec B 读者来信驳论 (≥200词)"],
            ["lex", "新闻与政论词汇搭配"],
            ["mor", "过去时态/被动句与句法"],
          ] as const);

    return (
      <div className="page practice">
        <section className="essay-stage">
          <button className="link deck-back" onClick={() => setStage("list")}>
            <ArrowLeft size={16} /> 返回套卷列表
          </button>
          <p className="eyebrow">{TRACK_META[track].shortName} · 写作成绩单</p>
          <h2 className="essay-title" lang="fr">
            {activeSuiteTitle}
          </h2>

          {gradeRes ? (
            <>
              <div className="essay-marks">
                <div>
                  <p className="essay-total">
                    {gradeRes.scaledScore}
                    <small>/{gradeRes.scaleMax}</small>
                  </p>
                  <div className="essay-chips">
                    <span className="chip">CECR {gradeRes.cefr}</span>
                    <span className="chip">NCLC {gradeRes.nclc}</span>
                    <span className={`chip ${gradeRes.nclc7Passed ? "" : "warn-text"}`}>
                      {gradeRes.nclc7Passed ? "已达加拿大 NCLC 7+" : "冲刺 NCLC 7"}
                    </span>
                  </div>
                </div>
                <dl className="essay-scores">
                  {gradeRes.subscores.map((sub) => (
                    <div key={sub.key}>
                      <dt>{sub.label}</dt>
                      <dd>
                        <span className="essay-bar">
                          <span style={{ width: `${(sub.score / 5) * 100}%` }} />
                        </span>
                        {sub.score}/5
                        {sub.note && <span className="muted small"> · {sub.note}</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="essay-chips">
                {gradeRes.wordMeters.map((m, i) => (
                  <span key={i} className={`chip ${m.status === "ok" ? "" : "warn-text"}`}>
                    第 {i + 1} 篇：{m.label}
                  </span>
                ))}
              </div>

              {gradeRes.comment && <p className="essay-comment">{gradeRes.comment}</p>}

              {gradeRes.todo.length > 0 && (
                <div className="essay-box">
                  <p className="eyebrow">优先改进项</p>
                  <ol>
                    {gradeRes.todo.map((t, k) => (
                      <li key={k}>{t}</li>
                    ))}
                  </ol>
                </div>
              )}

              {gradeRes.taskNotes.length > 0 && (
                <div className="essay-cols">
                  {gradeRes.taskNotes.map((tn, k) => (
                    <div key={k} className="essay-box">
                      <p className="eyebrow">{tn.label}</p>
                      <p className="small">{tn.feedbackZh}</p>
                      {tn.modelUpgradeFr && (
                        <p className="essay-text small" lang="fr">
                          {tn.modelUpgradeFr}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {gradeRes.corrections.length > 0 && (
                <details className="essay-fold" open>
                  <summary>逐句语法与搭配批改（{gradeRes.corrections.length}）</summary>
                  <ul className="writing-errors essay-corrections">
                    {gradeRes.corrections.map((x, k) => {
                      const have = notes.some((n) => n.wrong === x.wrong && n.right === x.right);
                      return (
                        <li key={k}>
                          <span className="chip">{ERROR_LABEL[x.type]}</span>
                          <span lang="fr">
                            {x.wrong && <del>{x.wrong}</del>} {x.right && <ins>{x.right}</ins>}
                          </span>
                          {x.why && <small>{x.why}</small>}
                          {x.point && pointTitle.has(x.point) && (
                            <a className="link essay-point" href={`#/grammar?p=${x.point}`}>
                              练这个语法点：{pointTitle.get(x.point)} <ArrowRight size={13} />
                            </a>
                          )}
                          <button
                            type="button"
                            className="link essay-keep"
                            disabled={have}
                            onClick={() =>
                              saveNote({
                                wrong: x.wrong,
                                right: x.right,
                                type: x.type,
                                why: x.why,
                                point: x.point,
                                from: `${TRACK_META[track].shortName} EE · ${activeSuiteTitle}`,
                              })
                            }
                          >
                            {have ? (
                              <>
                                <Check size={13} /> 已存进错句本
                              </>
                            ) : (
                              <>
                                <BookmarkPlus size={13} /> 存进错句本
                              </>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              )}
            </>
          ) : (
            <div className="essay-box">
              <p className="eyebrow">离线四维自评（配置 AI 接口可解锁逐句改错与高分改写）</p>
              {offlineKeys.map(([key, label]) => (
                <div key={key} className="speak-rubric-row">
                  <b>{label}</b>
                  <div className="speak-score-btns">
                    {LEVELS.map((lv) => (
                      <button
                        key={lv}
                        type="button"
                        className={`chip-btn ${selfScores[key] === lv ? "is-on" : ""}`}
                        onClick={() => setSelfScores((prev) => ({ ...prev, [key]: lv }))}
                      >
                        {lv}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="writing-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={selfSaved || offlineKeys.some(([k]) => selfScores[k] === undefined)}
                  onClick={() => {
                    const sum20 = offlineKeys.reduce((acc, [k]) => acc + (selfScores[k] ?? 0), 0);
                    if (track === "tcf") {
                      const p = scoreTcfProductive20(sum20, "ee");
                      logExam({
                        part: "essay",
                        what: activeSuiteId,
                        score: p.score20,
                        total: 20,
                        unverified: true,
                        level: "B2",
                        scope: "full",
                        track: "tcf",
                        trackSection: "ee",
                        nclc: p.nclc,
                      });
                      toast(`已保存 TCF 写作离线自评：${p.score20}/20（NCLC ${p.nclc}）`, "ok");
                    } else {
                      const p = scoreTefSection699("ee", sum20, 20);
                      logExam({
                        part: "essay",
                        what: activeSuiteId,
                        score: p.score699,
                        total: 699,
                        scaledScore: p.score699,
                        unverified: true,
                        level: "B2",
                        scope: "full",
                        track: "tef",
                        trackSection: "ee",
                        nclc: p.nclc,
                      });
                      toast(`已保存 TEF 写作离线自评：${p.score699}/699（NCLC ${p.nclc}）`, "ok");
                    }
                    setSelfSaved(true);
                  }}
                >
                  {selfSaved ? "已保存自评成绩" : "保存自评成绩"}
                </button>
              </div>
            </div>
          )}

          <div className="writing-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                if (track === "tcf" && tcfSuite) openTcfSuite(tcfSuite);
                else if (track === "tef" && tefSuite) openTefSuite(tefSuite);
              }}
            >
              <RefreshCw size={15} /> 重新作答本套题
            </button>
          </div>
        </section>
      </div>
    );
  }

  /* ---------- Stage: Multi-Part Timed Writing Workspace ---------- */
  const locked = examMode && timer.down && timer.sec === 0;
  const partSpecs =
    track === "tcf" && tcfSuite
      ? tcfSuite.tasks.map((t, idx) => ({
          idx,
          title: t.titleZh,
          consigneFr: t.consigneFr,
          hintZh: t.hintZh,
          docBlocks: [t.docAFr, t.docBFr].filter((d): d is string => !!d),
          meter: wtMod.evaluateTrackWordMeter(parts[idx] ?? "", { minWords: t.minWords, maxWords: t.maxWords }),
          rows: idx === 0 ? 6 : 8,
        }))
      : tefSuite
        ? [
            {
              idx: 0,
              title: "Section A · 报刊奇闻续写 Fait divers（新增 ≥80 词）",
              consigneFr: tefSuite.sectionA.consigneFr,
              hintZh: tefSuite.sectionA.hintZh,
              docBlocks: [`${tefSuite.sectionA.headlineFr}\n\n${tefSuite.sectionA.leadFr}`],
              meter: wtMod.evaluateTrackWordMeter(parts[0] ?? "", {
                minWords: tefSuite.sectionA.minWords,
                recommendedMaxWords: tefSuite.sectionA.recommendedMaxWords,
              }),
              rows: 8,
            },
            {
              idx: 1,
              title: "Section B · 读者来信正式驳论 Courrier des lecteurs（≥200 词）",
              consigneFr: tefSuite.sectionB.consigneFr,
              hintZh: tefSuite.sectionB.hintZh,
              docBlocks: [tefSuite.sectionB.claimFr],
              meter: wtMod.evaluateTrackWordMeter(parts[1] ?? "", {
                minWords: tefSuite.sectionB.minWords,
                recommendedMaxWords: tefSuite.sectionB.recommendedMaxWords,
              }),
              rows: 12,
            },
          ]
        : [];

  return (
    <div className="page practice">
      <section className="essay-stage">
        <header className="exam-top">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={grading}
            onClick={async () => {
              if (examMode && timer.running) {
                const ok = await confirmAction({
                  title: "返回套题列表？",
                  message: "60 分钟倒计时正在进行中（各题草稿已自动保存），确定退出本次计时？",
                  confirmLabel: "返回列表",
                  danger: true,
                });
                if (!ok) return;
                timer.stop();
              }
              setStage("list");
            }}
          >
            <ArrowLeft size={16} /> 返回套题（草稿自动保留）
          </button>
          <span className="eyebrow">{TRACK_META[track].shortName} · 60 分钟共享限时</span>
          {examMode || timer.running || (timer.down && timer.sec === 0) ? (
            <span className={`exam-clock ${timer.sec === 0 ? "is-over" : ""}`}>
              {timer.sec === 0 ? "60:00 时间到" : `剩余 ${clock(timer.sec)}`}
            </span>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => timer.start(60 * 60)}>
              启动 60 分钟计时
            </button>
          )}
        </header>

        <h2 className="essay-title" lang="fr">
          {activeSuiteTitle}
        </h2>

        <label className="essay-check-doc">
          <input
            type="checkbox"
            checked={examMode}
            disabled={grading || locked}
            onChange={(e) => {
              const on = e.target.checked;
              setExamMode(on);
              if (on && !timer.running) timer.start(60 * 60);
              if (!on) timer.stop();
            }}
          />{" "}
          全真模考锁卷模式（60 分钟共享倒计时归零自动锁卷）
        </label>

        {partSpecs.map((sp) => {
          const refForBox = sp.idx === 0 ? boxRef0 : sp.idx === 1 ? boxRef1 : boxRef2;
          return (
            <div key={sp.idx} className="essay-box">
              <div className="panel-head">
                <p className="eyebrow">{sp.title}</p>
                <span className={`essay-count ${sp.meter.status === "ok" ? "is-ok" : "is-short warn-text"}`}>
                  {sp.meter.label}
                </span>
              </div>
              {sp.docBlocks.map((doc, di) => (
                <blockquote key={di} className="essay-doc" lang="fr">
                  {doc}
                </blockquote>
              ))}
              <p className="essay-consigne" lang="fr">
                {sp.consigneFr}
              </p>
              <p className="muted small">{sp.hintZh}</p>
              <textarea
                ref={refForBox}
                className="writing-input essay-input"
                lang="fr"
                rows={sp.rows}
                value={parts[sp.idx] ?? ""}
                readOnly={grading || locked}
                onFocus={() => setActiveIdx(sp.idx)}
                onChange={(e) => updatePart(sp.idx, e.target.value)}
                placeholder="在此输入本题法语正文…"
                autoCapitalize="sentences"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                aria-label={sp.title}
              />
            </div>
          );
        })}

        {!grading && !locked && (
          <AccentKeys
            input={activeBoxRef}
            value={parts[activeIdx] ?? ""}
            onChange={(v) => updatePart(activeIdx, v)}
          />
        )}

        {locked && <p className="warn-text">60 分钟共享倒计时已归零锁卷，请直接提交批改。</p>}

        <div className="writing-actions">
          <span className="muted small">当前法语重音键作用输入框：第 {activeIdx + 1} 题</span>
          {grading ? (
            <>
              <p className="muted">AI 考官逐篇核分与提取错句中（约 25–50 秒）…</p>
              <button type="button" className="btn btn-ghost" onClick={() => ctrlRef.current?.abort()}>
                取消
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-xl"
              disabled={!hasContent}
              onClick={() => void submitMultiPart()}
            >
              {hasAi
                ? track === "tcf"
                  ? "提交三篇 · 核算 0–20 & NCLC"
                  : "提交双篇 · 核算 0–699 & NCLC"
                : "保存并进入离线自评"}{" "}
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * 篇章写作: supports DELF B2 (/25), TCF EE (3 tasks, 60m, /20 + NCLC), and TEF EE (Sec A+B, 60m, /699 + NCLC).
 */
export function EssayStudio({ onExit }: { onExit: () => void }) {
  const examTrack = useStore((s) => s.settings.examTrack);
  const switchTrack = (next: ExamTrack) => store.settings({ examTrack: next });
  return (
    <WordPopup>
      {examTrack === "tcf" || examTrack === "tef" ? (
        <TrackEssayStudioBody track={examTrack} onSwitchTrack={switchTrack} onExit={onExit} />
      ) : (
        <EssayStudioBody examTrack={examTrack} onSwitchTrack={switchTrack} onExit={onExit} />
      )}
    </WordPopup>
  );
}

function EssayStudioBody({
  examTrack,
  onSwitchTrack,
  onExit,
}: {
  examTrack: ExamTrack;
  onSwitchTrack: (t: ExamTrack) => void;
  onExit: () => void;
}) {
  const essaysRaw = useStore((s) => s.progress.essays);
  const essays = useMemo(() => essaysRaw ?? [], [essaysRaw]);
  const aiRaw = useStore((s) => s.progress.essayTasks);
  const notes = useStore((s) => s.progress.essayNotes) ?? [];
  const tasks = useMemo(() => [...ESSAY_TASKS, ...(aiRaw ?? [])], [aiRaw]);
  const taskOf = (id: string) => tasks.find((t) => t.id === id);
  const ai = useAiConfig();
  const { data: grammar } = useGrammar();
  const [view, setView] = useState<View>({ at: "list" });
  const [selfScores, setSelfScores] = useState<Record<string, number>>({});
  const resultEssayId = view.at === "result" ? view.id : "";
  useEffect(() => setSelfScores({}), [resultEssayId]);
  const [text, setText] = useState("");
  const [grading, setGrading] = useState(false);
  const [sampleOpen, setSampleOpen] = useState(false);
  // 让 AI 出新题（默认随机混入材料题；B2 默认排除 mail/recit）
  const [aiGenre, setAiGenre] = useState<Genre | "random">("random");
  const [aiLevel, setAiLevel] = useState<"B1" | "B2">("B2");
  const [aiDoc, setAiDoc] = useState<DocMode>("random");
  const [making, setMaking] = useState(false);
  // 选题页的筛选
  const [need, setNeed] = useState<"all" | "new" | "low" | "draft">("all");
  const [genreFilter, setGenreFilter] = useState<Genre | "all">("all");
  // 范文
  const [modeling, setModeling] = useState(false);
  // 提纲结构切换（本题提纲 / 辩证 / 分析）
  const [planKind, setPlanKind] = useState<PlanKind>("task");
  // 模考模式（开启后自动 60 分钟倒计时，到时自动锁卷）与考场无辅助模式（隐藏中文解析、提纲、句型和衔接语）
  const [examMode, setExamMode] = useState(false);
  const [noAid, setNoAid] = useState(false);
  const [preChecks, setPreChecks] = useState<[boolean, boolean, boolean, boolean]>([false, false, false, false]);
  const input = useRef<HTMLTextAreaElement>(null);
  const ctrl = useRef<AbortController | null>(null);
  const timer = useTimer();

  useEffect(() => () => ctrl.current?.abort(), []);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view.at]);

  useNavGuard(
    (view.at === "write" || view.at === "revise") && (text.trim().length > 0 || (examMode && timer.sec > 0)),
    examMode && timer.sec > 0
      ? "限时模考写作倒计时正在运行，离开将停止计时（草稿会自动保存在本地），确定离开？"
      : "当前有正在编辑的作文（草稿已保存在本地），确定离开？",
  );

  const pointTitle = useMemo(() => new Map((grammar?.points ?? []).map((p) => [p.id, p.title])), [grammar]);

  const open = (task: EssayTask, initial = readDraft(task.id)) => {
    setText(initial);
    setPlanKind("task");
    setPreChecks([false, false, false, false]);
    if (examMode) timer.start(60 * 60);
    else timer.stop();
    setView({ at: "write", task });
  };

  const change = (task: EssayTask, v: string) => {
    const next = v.slice(0, MAX_ESSAY_LENGTH);
    setText(next);
    writeDraft(task.id, next);
  };

  const finish = (task: EssayTask, fb?: EssayFeedback) => {
    timer.stop();
    const id = saveEssay({ task: task.id, text, fb, level: task.level });
    writeDraft(task.id, "");
    setView({ at: "result", task, id });
  };

  const submit = async (task: EssayTask) => {
    if (!text.trim() || grading) return;
    if (!ready.text(ai)) return finish(task);
    const c = new AbortController();
    ctrl.current = c;
    setGrading(true);
    try {
      const fb = await gradeEssay({ task, text, points: (grammar?.points ?? []).map((p) => ({ id: p.id, title: p.title })) }, c.signal);
      if (!c.signal.aborted) finish(task, fb);
    } catch (err) {
      if (!c.signal.aborted) toast((err as Error).message || "批改失败", "warn");
    } finally {
      setGrading(false);
    }
  };

  const makeTask = async () => {
    if (making || !ready.text(ai)) return;
    const { genre, withDocument } = pickAiTaskOptions(aiLevel, aiGenre, aiDoc);
    const c = new AbortController();
    ctrl.current = c;
    setMaking(true);
    try {
      const task = await makeEssayTask({ genre, level: aiLevel, withDocument, avoid: tasks.filter((t) => t.genre === genre).map((t) => t.title) }, c.signal);
      if (c.signal.aborted) return;
      saveAiTask(task);
      open(task, "");
    } catch (err) {
      if (!c.signal.aborted) toast((err as Error).message || "出题失败", "warn");
    } finally {
      setMaking(false);
    }
  };

  /** 第二稿: marked like the first, so the two can be compared. */
  const submitRevision = async (task: EssayTask, essay: SavedEssay) => {
    const revised = text.trim();
    if (!revised || grading) return;
    if (!ready.text(ai)) {
      patchEssay(essay.id, { rev: { text: revised, at: Date.now() } });
      writeDraft(`rev-${essay.id}`, "");
      return setView({ at: "result", task, id: essay.id });
    }
    const c = new AbortController();
    ctrl.current = c;
    setGrading(true);
    try {
      const fb = await gradeEssay({ task, text: revised, points: (grammar?.points ?? []).map((p) => ({ id: p.id, title: p.title })) }, c.signal);
      if (c.signal.aborted) return;
      patchEssay(essay.id, { rev: { text: revised, at: Date.now(), fb } });
      writeDraft(`rev-${essay.id}`, "");
      setView({ at: "result", task, id: essay.id });
    } catch (err) {
      if (!c.signal.aborted) toast((err as Error).message || "批改失败", "warn");
    } finally {
      setGrading(false);
    }
  };

  const showModel = async (task: EssayTask, essay: SavedEssay) => {
    if (modeling || !ready.text(ai)) return;
    const c = new AbortController();
    ctrl.current = c;
    setModeling(true);
    try {
      const model = await makeModelEssay({ task, learnerText: essay.rev?.text ?? essay.text }, c.signal);
      if (!c.signal.aborted) patchEssay(essay.id, { model });
    } catch (err) {
      if (!c.signal.aborted) toast((err as Error).message || "写范文失败", "warn");
    } finally {
      setModeling(false);
    }
  };

  if (view.at === "list") {
    const stats = new Map(tasks.map((t) => [t.id, statOf(essays, t)] as const));
    const all = tasks
      .filter((t) => t.level !== "B2" || B2_GENRES.includes(t.genre))
      .map((t) => [t, stats.get(t.id)!] as [EssayTask, TaskStat]);
    const shown = all
      .filter(([t, st]) => (genreFilter === "all" || t.genre === genreFilter) && (need === "all" || (need === "new" && st.done === 0) || (need === "low" && st.best >= 0 && st.best < LOW) || (need === "draft" && st.draft)))
      .sort(byNeed);
    // the recommendation: the task most in need, preferring B2 once three B1 tasks have been written
    const b1done = all.filter(([t, st]) => t.level === "B1" && st.done > 0).length;
    const rec = [...all].sort((x, y) => (rankOf(x[1]) === rankOf(y[1]) && b1done >= 3 && x[0].level !== y[0].level ? (x[0].level === "B2" ? -1 : 1) : byNeed(x, y)))[0];
    const card = ([t, st]: [EssayTask, TaskStat], extra?: string) => (
      <div key={t.id} className="essay-cell">
        <button className={`essay-task ${extra ? "is-rec" : ""}`} onClick={() => open(t)}>
          <span className="essay-chips">
            <span className="chip">{GENRE_LABEL[t.genre]}</span>
            {isAiTask(t.id) && <span className="chip chip-mine">AI 新题</span>}
            {t.doc && <span className="chip">材料题</span>}
          </span>
          <b>{t.title}</b>
          <small>{t.situation}</small>
          <small className="essay-task-meta">
            {t.level} · {t.level === "B2" ? `至少 ${t.words[0]} 词（推荐 ${t.words[0]}–${t.words[1]}）` : `${t.words[0]}–${t.words[1]} 词`}
            {st.draft ? " · 有草稿" : ""}
            {st.done > 0 ? ` · 写过 ${st.done} 次${st.best >= 0 ? `，最高 ${st.best}/25` : ""}，上次 ${day(st.last)}` : ""}
          </small>
          {extra && <small className="essay-rec-why">{extra}</small>}
        </button>
        {isAiTask(t.id) && (
          <button
            className="own-rm essay-cell-rm"
            aria-label="删除这道题"
            title="删除这道 AI 出的题（写过的文章会保留）"
            onClick={async () => {
              if (
                await confirmAction({
                  title: "删除这道 AI 题目？",
                  message: `确定删除「${t.title}」？用这道题写过的文章仍会保留。`,
                  confirmLabel: "删除",
                  danger: true,
                })
              ) {
                deleteAiTask(t.id);
              }
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>
    );
    return (
      <div className="page practice">
        <header className="page-head">
          <button className="link deck-back" onClick={onExit}>
            <ArrowLeft size={16} /> 返回练习
          </button>
          <div className="writing-actions">
            <div className="segmented" role="group" aria-label="切换写作考试体系">
              {(["delf", "tcf", "tef"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={examTrack === t ? "is-on" : ""}
                  aria-pressed={examTrack === t}
                  onClick={() => onSwitchTrack(t)}
                >
                  {t === "delf" ? "DELF B2" : t === "tcf" ? "TCF EE（3篇 · /20）" : "TEF EE（A+B双篇 · /699）"}
                </button>
              ))}
            </div>
          </div>
          <p className="eyebrow">篇章写作 · Production écrite</p>
          <h1 className="display">把句子，连成一篇。</h1>
          <p className="lede">选一个题目，照着提纲写完整的一封信或一篇短文。批改用官方评分表的五项（完成任务、连贯和衔接、语体得体、词汇、语法），每项 0–5 分，满分 25，并指出每处错误对应的语法点。</p>
          {!ready.text(ai) && (
            <div className="ai-sample-banner">
              <p className="muted">
                还没有设置 AI 接口：可以写、可以保存并按 0–5 量表自评。到 <a className="link" href={href({ page: "me" })}>我的 → AI 接口</a> 贴入 1 个 Key 即可开通 AI 批改与出题。
              </p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSampleOpen((v) => !v)} aria-expanded={sampleOpen}>
                <Sparkles size={15} /> {sampleOpen ? "收起高分批改样张" : "预览 B2 高分批改样张（免 Key）"}
              </button>
            </div>
          )}
        </header>

        {!ready.text(ai) && sampleOpen && (
          <section className="panel ai-sample-box" aria-label="DELF B2 作文批改样张">
            <div className="panel-head">
              <div>
                <p className="eyebrow">免 Key 交互样张 · {SAMPLE_ESSAY_PREVIEW.title}</p>
                <span className="muted small">正文字数 {SAMPLE_ESSAY_PREVIEW.wordCount} 词 · 展示官方五项评分表 + 逐句改错 + B1→B2 段落升格</span>
              </div>
              <button type="button" className="link small" onClick={() => setSampleOpen(false)}>
                收起样张
              </button>
            </div>
            <details className="essay-fold">
              <summary>查看考生原稿（{SAMPLE_ESSAY_PREVIEW.wordCount} 词）</summary>
              <p className="essay-text" lang="fr">
                {SAMPLE_ESSAY_PREVIEW.text}
              </p>
            </details>
            <Marking fb={SAMPLE_ESSAY_PREVIEW.fb} level="B2" pointTitle={pointTitle} from={SAMPLE_ESSAY_PREVIEW.title} />
            <ParagraphUpgrader
              essayText={SAMPLE_ESSAY_PREVIEW.text}
              genre="courrier"
              title={SAMPLE_ESSAY_PREVIEW.title}
              level="B2"
            />
          </section>
        )}

        {rec && (
          <section className="essay-level">
            <h2 className="eyebrow">推荐下一题</h2>
            <div className="essay-tasks essay-tasks-one">{card(rec, reasonOf(rec[1]))}</div>
          </section>
        )}

        <section className="panel essay-ai">
          <h2 className="eyebrow">让 AI 出一道新题</h2>
          <ul className="chips" role="group" aria-label="体裁">
            {(["random", ...genresFor(aiLevel)] as const).map((g) => (
              <li key={g}>
                <button className={`chip-btn ${aiGenre === g ? "is-on" : ""}`} aria-pressed={aiGenre === g} onClick={() => setAiGenre(g)}>
                  {g === "random" ? "随机体裁" : GENRE_LABEL[g]}
                </button>
              </li>
            ))}
          </ul>
          <div className="essay-ai-row">
            <div className="segmented">
              {(["B1", "B2"] as const).map((lv) => (
                <button
                  key={lv}
                  className={aiLevel === lv ? "is-on" : ""}
                  aria-pressed={aiLevel === lv}
                  onClick={() => {
                    setAiLevel(lv);
                    if (lv === "B2" && aiGenre !== "random" && !B2_GENRES.includes(aiGenre)) setAiGenre("random");
                  }}
                >
                  {lv}
                </button>
              ))}
            </div>
            <div className="segmented" role="group" aria-label="是否带材料">
              {(
                [
                  ["random", "随机含材料"],
                  ["doc", "必带材料"],
                  ["none", "无材料"],
                ] as const
              ).map(([m, label]) => (
                <button key={m} className={aiDoc === m ? "is-on" : ""} aria-pressed={aiDoc === m} onClick={() => setAiDoc(m)}>
                  {label}
                </button>
              ))}
            </div>
            <button className="btn btn-primary" onClick={() => void makeTask()} disabled={making || !ready.text(ai)}>
              <Sparkles size={16} /> {making ? "AI 出题中（约 10–30 秒）…" : "出题并开始写"}
            </button>
            {making && (
              <button className="btn btn-ghost" onClick={() => ctrl.current?.abort()}>
                取消
              </button>
            )}
          </div>
          <p className="muted small">每次一道新题，含提纲和可用句子，保存在这台设备上（最多 24 道）。不会和已有的题重复。</p>
        </section>

        <div className="essay-filters">
          <ul className="chips" role="group" aria-label="筛选">
            {(
              [
                ["all", "全部"],
                ["new", "没写过"],
                ["low", `分数低（<${LOW}）`],
                ["draft", "有草稿"],
              ] as const
            ).map(([k, label]) => (
              <li key={k}>
                <button className={`chip-btn ${need === k ? "is-on" : ""}`} aria-pressed={need === k} onClick={() => setNeed(k)}>
                  {label}
                </button>
              </li>
            ))}
          </ul>
          <ul className="chips" role="group" aria-label="体裁筛选">
            {(["all", ...GENRES] as const).map((g) => (
              <li key={g}>
                <button className={`chip-btn ${genreFilter === g ? "is-on" : ""}`} aria-pressed={genreFilter === g} onClick={() => setGenreFilter(g)}>
                  {g === "all" ? "所有体裁" : GENRE_LABEL[g]}
                </button>
              </li>
            ))}
          </ul>
          <label className="essay-check-doc">
            <input type="checkbox" checked={examMode} onChange={(ev) => setExamMode(ev.target.checked)} /> 模考模式（进入写作自动 60 分钟倒计时，到时锁卷）
          </label>
        </div>
        {(["B1", "B2"] as const).map((lv) => {
          const list = shown.filter(([t]) => t.level === lv);
          if (!list.length) return null;
          return (
            <section key={lv} className="essay-level">
              <h2 className="eyebrow">{lv}</h2>
              <div className="essay-tasks">{list.map((x) => card(x))}</div>
            </section>
          );
        })}
        {shown.length === 0 && <p className="muted">没有符合筛选的题目。</p>}

        {notes.length > 0 && (
          <section className="essay-level">
            <details className="essay-fold">
              <summary>
                <BookMarked size={15} /> 错句本（{notes.length}）
              </summary>
              {notes.some((n) => !n.point) && (
                <div className="writing-actions mb-sm">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => go({ page: "reflow" })}>
                    进入非语法错句 FSRS 回炉（{notes.filter((n) => !n.point).length}） <ArrowRight size={14} />
                  </button>
                </div>
              )}
              <ul className="writing-errors essay-corrections essay-notes">
                {notes.map((n) => (
                  <li key={n.id}>
                    <span className="chip">{ERROR_LABEL[n.type]}</span>
                    <span lang="fr">
                      {n.wrong && <del>{n.wrong}</del>} {n.right && <ins>{n.right}</ins>}
                    </span>
                    {n.why && <small>{n.why}</small>}
                    <small className="muted">
                      {day(n.at)} · {n.from}
                    </small>
                    {n.point && pointTitle.has(n.point) && (
                      <a className="link essay-point" href={`#/grammar?p=${n.point}`}>
                        练这个语法点：{pointTitle.get(n.point)} <ArrowRight size={13} />
                      </a>
                    )}
                    <button className="own-rm essay-note-rm" aria-label="从错句本删除" onClick={() => deleteNote(n.id)}>
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          </section>
        )}

        {essays.length > 0 && (
          <section className="essay-level">
            <h2 className="eyebrow">写过的</h2>
            <ul className="essay-history">
              {essays.map((e) => {
                const t = taskOf(e.task);
                if (!t) return null;
                return (
                  <li key={e.id}>
                    <button className="link" onClick={() => setView({ at: "result", task: t, id: e.id })}>
                      {day(e.created)} · {t.level} · {t.title}
                    </button>
                    <span className="muted">
                      {countWords(e.text)} 词 · {e.fb ? `${totalScore(e.fb)}/25` : "未批改"}
                      {e.rev?.fb ? ` → 二稿 ${totalScore(e.rev.fb)}/25` : e.rev ? " · 有二稿" : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    );
  }

  const task = view.task;

  if (view.at === "result" || view.at === "revise") {
    const essay = essays.find((e) => e.id === view.id);
    if (!essay) {
      return (
        <div className="page practice">
          <p className="muted">这篇已经删除。</p>
          <button className="btn btn-ghost" onClick={() => setView({ at: "list" })}>
            返回题目
          </button>
        </div>
      );
    }
    const fb = essay.fb;

    if (view.at === "revise") {
      const rw = countWords(text);
      const [rmin, rmax] = task.words;
      return (
        <div className="page practice">
          <section className="essay-stage">
            <button className="link deck-back" onClick={() => setView({ at: "result", task, id: essay.id })} disabled={grading}>
              <ArrowLeft size={16} /> 返回批改（第二稿会保留）
            </button>
            <p className="eyebrow">
              改一稿 · {GENRE_LABEL[task.genre]} · {task.level}
            </p>
            <h2 className="essay-title">{task.title}</h2>
            <p className="muted">对照下面的批改，自己改一遍再交。改的过程比看答案记得牢；交上去后 AI 会重新打分，并告诉你哪些错改掉了。</p>
            {fb && fb.todo.length > 0 && (
              <div className="essay-box">
                <p className="eyebrow">先改这些</p>
                <ol>
                  {fb.todo.map((x, k) => (
                    <li key={k}>{x}</li>
                  ))}
                </ol>
              </div>
            )}
            {fb && fb.corrections.length > 0 && (
              <div className="essay-box">
                <p className="eyebrow">第一稿的错误（{fb.corrections.length}）</p>
                <ul className="writing-errors essay-corrections">
                  {fb.corrections.map((x, k) => (
                    <li key={k}>
                      <span className="chip">{ERROR_LABEL[x.type]}</span>
                      <span lang="fr">
                        {x.wrong && <del>{x.wrong}</del>} {x.right && <ins>{x.right}</ins>}
                      </span>
                      {x.why && <small>{x.why}</small>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <textarea
              ref={input}
              className="writing-input essay-input"
              lang="fr"
              rows={14}
              value={text}
              readOnly={grading}
              onChange={(ev) => {
                const v = ev.target.value.slice(0, MAX_ESSAY_LENGTH);
                setText(v);
                writeDraft(`rev-${essay.id}`, v);
              }}
              autoCapitalize="sentences"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              aria-label="第二稿"
            />
            {!grading && (
              <AccentKeys
                input={input}
                value={text}
                onChange={(v) => {
                  setText(v.slice(0, MAX_ESSAY_LENGTH));
                  writeDraft(`rev-${essay.id}`, v.slice(0, MAX_ESSAY_LENGTH));
                }}
              />
            )}
            <div className="writing-actions">
              <span className={`essay-count ${countClass(rw, rmin)}`}>{countLabel(rw, rmin, rmax)}</span>
              {grading ? (
                <>
                  <p className="muted">AI 批改中（整篇约 20–60 秒）…</p>
                  <button className="btn btn-ghost" onClick={() => ctrl.current?.abort()}>
                    取消
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-ghost" onClick={() => setText(essay.text)}>
                    <RefreshCw size={15} /> 恢复第一稿
                  </button>
                  <button className="btn btn-primary btn-xl" onClick={() => void submitRevision(task, essay)} disabled={!text.trim() || text.trim() === essay.text.trim()}>
                    {ready.text(ai) ? "交第二稿" : "保存第二稿"} <ArrowRight size={18} />
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      );
    }

    // how the first draft's corrections fared in the second draft (clause-level diff)
    const rev = essay.rev;
    const { fixed, still } = rev && fb ? diffSecondDraftCorrections(essay.text, rev.text, fb.corrections) : { fixed: [], still: [] };
    const gain = rev?.fb && fb ? Math.round((totalScore(rev.fb) - totalScore(fb)) * 10) / 10 : null;
    return (
      <div className="page practice">
        <section className="essay-stage">
          <button className="link deck-back" onClick={() => setView({ at: "list" })}>
            <ArrowLeft size={16} /> 返回题目
          </button>
          <p className="eyebrow">
            {GENRE_LABEL[task.genre]} · {task.level} · {day(essay.created)}
          </p>
          <h2 className="essay-title">{task.title}</h2>

          {fb ? (
            <Marking fb={fb} level={task.level} pointTitle={pointTitle} from={task.title} />
          ) : (
            <div className="essay-box">
              <p className="eyebrow">离线对照官方评分表自评（0–5 分）</p>
              <div className="speak-rubric">
                {CRITERIA.map((c) => (
                  <div key={c} className="speak-rubric-row">
                    <div>
                      <b>{CRITERION_LABEL[c]}</b>
                      <small>{CRITERION_CHECK[c]}</small>
                    </div>
                    <div className="speak-score-btns">
                      {LEVELS.map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`chip-btn ${selfScores[c] === n ? "is-on" : ""}`}
                          aria-pressed={selfScores[c] === n}
                          onClick={() => setSelfScores((prev) => ({ ...prev, [c]: n }))}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="writing-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={CRITERIA.some((c) => selfScores[c] === undefined)}
                  onClick={() => {
                    const selfFb: EssayFeedback = {
                      scores: { ...selfScores },
                      comment: "离线按官方 0–5 分量表自评",
                      strengths: [],
                      todo: [],
                      corrections: [],
                      rewrite: "",
                    };
                    patchEssay(essay.id, { fb: selfFb, level: task.level });
                    store.progress((p) => ({
                      ...p,
                      examLog: (p.examLog ?? []).map((item, idx) =>
                        idx === 0 && item.part === "essay" && item.what === essay.task
                          ? ({ ...item, unverified: true } as typeof item)
                          : item,
                      ),
                    }));
                    toast(`已保存作文离线自评（${totalScore(selfFb)}/25 · 未经 AI 核验）`, "ok");
                  }}
                >
                  保存自评成绩（{CRITERIA.every((c) => selfScores[c] !== undefined) ? `${CRITERIA.reduce((n, c) => n + selfScores[c], 0)}/25` : "待选全"}）
                </button>
              </div>
              <p className="muted small">无 AI 接口时也可先自评计入进步曲线，或直接修改第二稿；配置 AI 接口后可点「用这个题目重写」重新提交批改。</p>
            </div>
          )}

          <div className="essay-cols">
            <div className="essay-box">
              <p className="eyebrow">你写的（{countWords(essay.text)} 词）</p>
              <p className="essay-text" lang="fr">
                {essay.text}
              </p>
            </div>
            {fb?.rewrite && (
              <div className="essay-box">
                <p className="eyebrow">改好的版本</p>
                <p className="essay-text" lang="fr">
                  {fb.rewrite}
                </p>
              </div>
            )}
          </div>

          <ParagraphUpgrader essayText={rev?.text || essay.text} genre={task.genre} title={task.title} level={task.level} />

          {rev && (
            <div className="essay-box essay-rev">
              <p className="eyebrow">第二稿 · {day(rev.at)}</p>
              {gain !== null && rev.fb && fb && (
                <p className="essay-gain">
                  {totalScore(fb)} <ArrowRight size={16} /> {totalScore(rev.fb)}
                  <small>/{maxScore(fb)}</small> <span className={gain > 0 ? "is-up" : gain < 0 ? "is-down" : ""}>{gain > 0 ? `+${gain}` : gain === 0 ? "持平" : gain}</span>
                </p>
              )}
              {fb && fb.corrections.length > 0 && (
                <p className="muted">
                  第一稿指出的 {fb.corrections.length} 处错误：改掉了 <b>{fixed.length}</b> 处{still.length > 0 ? `，还在 ${still.length} 处` : ""}。
                </p>
              )}
              {still.length > 0 && (
                <ul className="writing-errors essay-corrections">
                  {still.map((x, k) => (
                    <li key={k}>
                      <span className="chip">{ERROR_LABEL[x.type]}</span>
                      <span lang="fr">
                        <del>{x.wrong}</del> <ins>{x.right}</ins>
                      </span>
                      {x.why && <small>{x.why}</small>}
                    </li>
                  ))}
                </ul>
              )}
              <p className="essay-text" lang="fr">
                {rev.text}
              </p>
              {rev.fb && (
                <details className="essay-fold">
                  <summary>第二稿的批改</summary>
                  <Marking fb={rev.fb} level={task.level} pointTitle={pointTitle} from={task.title} />
                </details>
              )}
            </div>
          )}

          {essay.model && (
            <div className="essay-box essay-model">
              <p className="eyebrow">范文（AI 写的，只作参考）</p>
              <p className="essay-text" lang="fr">
                {essay.model.text}
              </p>
              {essay.model.patterns.length > 0 && (
                <>
                  <p className="eyebrow">值得借用的句型</p>
                  <ul className="essay-phrases">
                    {essay.model.patterns.map((p, k) => (
                      <li key={k}>
                        <span lang="fr">{p.fr}</span>
                        <small>{p.zh}</small>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
          <StaticEssayModel taskId={task.id} />

          {fb && <p className="muted small">AI 的批改和分数可能有偏差，拿不准的地方对照语法点和词典。</p>}
          <div className="writing-actions">
            <button
              className="btn btn-ghost"
              onClick={async () => {
                if (
                  await confirmAction({
                    title: "删除这篇作文？",
                    message: `确定删除「${task.title}」的这篇作文与批改记录？删除后无法恢复。`,
                    confirmLabel: "删除",
                    danger: true,
                  })
                ) {
                  deleteEssay(essay.id);
                  setView({ at: "list" });
                }
              }}
            >
              <Trash2 size={16} /> 删除
            </button>
            <button className="btn btn-ghost" onClick={() => open(task, essay.text)}>
              <PenLine size={16} /> 用这个题目重写
            </button>
            {fb && !essay.model && (
              <button className="btn btn-ghost" onClick={() => void showModel(task, essay)} disabled={modeling || !ready.text(ai)} title={rev ? "" : "先改一稿再看范文，效果更好"}>
                <Sparkles size={16} /> {modeling ? "写范文中…" : "看范文"}
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={() => {
                setText(readDraft(`rev-${essay.id}`) || rev?.text || essay.text);
                timer.stop();
                setView({ at: "revise", task, id: essay.id });
              }}
            >
              <PenLine size={16} /> {rev ? "再改一稿" : fb ? "照批改改一稿" : "修改第二稿"}
            </button>
          </div>
          {fb && !rev && !essay.model && <p className="muted small">建议先改一稿再看范文：自己改过，再对照范文，才看得出差在哪里。</p>}
        </section>
      </div>
    );
  }

  const words = countWords(text);
  const [min, max] = task.words;
  const locked = examMode && timer.down && timer.sec === 0;
  const toggleExamMode = (on: boolean) => {
    setExamMode(on);
    if (on) {
      if (!timer.running) timer.start(60 * 60);
    } else {
      timer.stop();
    }
  };
  return (
    <div className="page practice">
      <section className="essay-stage">
        <button
          className="link deck-back"
          onClick={async () => {
            if (examMode && timer.running) {
              const ok = await confirmAction({
                title: "返回题目列表？",
                message: "模考倒计时正在进行中（正文草稿已自动保留），返回将重置本次计时，确定离开？",
                confirmLabel: "返回题目",
                danger: true,
              });
              if (!ok) return;
              timer.stop();
            }
            setView({ at: "list" });
          }}
          disabled={grading}
        >
          <ArrowLeft size={16} /> 返回题目（草稿会保留）
        </button>
        <p className="eyebrow">
          {GENRE_LABEL[task.genre]} · {task.level} · 至少 {min} 词（推荐 {min}–{max}）
        </p>
        <h2 className="essay-title">{task.title}</h2>
        {!noAid && <p className="essay-situation">{task.situation}</p>}
        {task.doc && (
          <blockquote className="essay-doc" lang="fr">
            {task.doc}
          </blockquote>
        )}
        <p className="essay-consigne" lang="fr">
          {task.consigne}
        </p>
        <div className="writing-actions">
          <label className="essay-check-doc">
            <input type="checkbox" checked={examMode} disabled={grading || locked} onChange={(ev) => toggleExamMode(ev.target.checked)} /> 模考模式（60 分钟自动锁卷）
          </label>
          <label className="essay-check-doc">
            <input type="checkbox" checked={noAid} disabled={grading} onChange={(ev) => setNoAid(ev.target.checked)} /> 考场无辅助模式（仅看原题，隐藏中文与写作支架）
          </label>
        </div>
        {noAid ? (
          <p className="muted small">已开启考场无辅助模式：已隐藏中文情景说明、要点提示、提纲、句型与信函套语，模拟真实考场环境。</p>
        ) : (
          <>
            <ul className="essay-points">
              {task.points.map((p, k) => (
                <li key={k}>{p}</li>
              ))}
            </ul>

            <div className="essay-help">
              <details open>
                <summary>提纲</summary>
                <div className="segmented" role="group" aria-label="提纲模式">
                  {(
                    [
                      ["task", "本题提纲"],
                      ["dialectique", ESSAY_PLANS.dialectique.label],
                      ["analytique", ESSAY_PLANS.analytique.label],
                    ] as const
                  ).map(([k, label]) => (
                    <button key={k} type="button" className={planKind === k ? "is-on" : ""} aria-pressed={planKind === k} onClick={() => setPlanKind(k)}>
                      {label}
                    </button>
                  ))}
                </div>
                {planKind !== "task" && <p className="muted small">{ESSAY_PLANS[planKind].desc}</p>}
                <ol className="essay-plan">
                  {(planKind === "task" ? task.plan : ESSAY_PLANS[planKind].steps).map((p, k) => (
                    <li key={k}>
                      <b>{p.zh}</b>
                      <span lang="fr">{p.fr}</span>
                    </li>
                  ))}
                </ol>
              </details>
              <details>
                <summary>这个题目用得上的句子</summary>
                <ul className="essay-phrases">
                  {task.phrases.map(([fr, zh], k) => (
                    <li key={k}>
                      <span lang="fr">{fr}</span>
                      <small>{zh}</small>
                    </li>
                  ))}
                </ul>
              </details>
              {topicOf(task.topic) && (
                <details>
                  <summary>话题词汇：{topicOf(task.topic)!.zh}</summary>
                  <ul className="essay-phrases">
                    {topicOf(task.topic)!.vocab.map(([fr, zh], k) => (
                      <li key={k}>
                        <span lang="fr">{fr}</span>
                        <small>{zh}</small>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {!examMode && <ArgumentsDrawer topic={task.topic} />}
              <details>
                <summary>衔接语</summary>
                <dl className="essay-links">
                  {CONNECTORS.map((g) => (
                    <div key={g.zh}>
                      <dt>{g.zh}</dt>
                      <dd lang="fr">{g.fr.join(" · ")}</dd>
                    </div>
                  ))}
                </dl>
              </details>
              {FORMAL_GENRES.includes(task.genre) && (
                <>
                  <details>
                    <summary>正式信函信头与格式模板</summary>
                    <dl className="essay-links">
                      {LETTER_TEMPLATE.map((row) => (
                        <div key={row.part}>
                          <dt>{row.part}</dt>
                          <dd lang="fr">
                            {row.fr}
                            {row.tip && <small className="muted">（{row.tip}）</small>}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                  <details>
                    <summary>正式信件的套语</summary>
                    <dl className="essay-links">
                      {LETTER_FORMULAS.map((g) => (
                        <div key={g.zh}>
                          <dt>{g.zh}</dt>
                          <dd lang="fr">{g.fr.join(" / ")}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                </>
              )}
            </div>
          </>
        )}
        <textarea
          ref={input}
          className="writing-input essay-input"
          lang="fr"
          rows={14}
          value={text}
          readOnly={grading || locked}
          onChange={(ev) => change(task, ev.target.value)}
          placeholder="在这里写。分段写，每段一个意思。"
          autoCapitalize="sentences"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          aria-label="在这里写法语作文"
        />
        {!grading && !locked && <AccentKeys input={input} value={text} onChange={(v) => change(task, v)} />}
        {!noAid && (
          <details open={!examMode} className="essay-box essay-precheck">
            <summary>交卷前 4 项自检清单（已勾选 {preChecks.filter(Boolean).length}/4）</summary>
            <ul className="essay-precheck-list">
              {[
                "立场明确：首段清楚表态并回应题干设定的全部要素",
                "论据与实例：至少 2 组核心论点，并带具体事实或法国案例",
                "让步与转折：至少包含 1 处让步反驳（如 Certes… mais… / Bien que + subj.）",
                FORMAL_GENRES.includes(task.genre)
                  ? "正式信函格式：事由 Objet、尊称 Madame/Monsieur 及致敬落款完整"
                  : "结构与表达：段落过渡清晰，避免基础词重复与中式直译",
              ].map((label, idx) => (
                <li key={idx}>
                  <label className="essay-check-doc">
                    <input
                      type="checkbox"
                      checked={preChecks[idx]}
                      onChange={(ev) =>
                        setPreChecks((prev) => {
                          const next: [boolean, boolean, boolean, boolean] = [...prev];
                          next[idx] = ev.target.checked;
                          return next;
                        })
                      }
                    />
                    <span>{label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </details>
        )}
        {locked && <p className="warn-text">模考 60 分钟时间到，已自动锁卷（不可继续修改），请直接提交。</p>}
        <div className="writing-actions">
          <span className={`essay-count ${countClass(words, min)}`}>{countLabel(words, min, max)}</span>
          {!grading &&
            (examMode ? (
              <span className={`exam-clock ${timer.sec === 0 ? "is-over" : ""}`} title="模考自动倒计时，时间到自动锁卷">
                {timer.sec === 0 ? "时间到 · 已锁卷" : `模考 ${clock(timer.sec)}`}
              </span>
            ) : timer.running || (timer.down && timer.sec === 0) ? (
              <button className={`exam-clock ${timer.sec === 0 ? "is-over" : ""}`} onClick={timer.stop} title="点一下停止计时">
                {timer.sec === 0 ? "时间到" : clock(timer.sec)}
              </button>
            ) : (
              <button className="btn btn-ghost" onClick={() => timer.start(60 * 60)}>
                限时 60 分钟
              </button>
            ))}
          {grading ? (
            <>
              <p className="muted">AI 批改中（整篇约 20–60 秒）…</p>
              <button className="btn btn-ghost" onClick={() => ctrl.current?.abort()}>
                取消
              </button>
            </>
          ) : (
            <button className="btn btn-primary btn-xl" onClick={() => void submit(task)} disabled={!text.trim()}>
              {ready.text(ai) ? "交给 AI 批改" : "保存并自己检查"} <ArrowRight size={18} />
            </button>
          )}
        </div>
        <p className="muted typing-help">草稿自动保存在这台设备上 · 只是练习，不改动记忆进度</p>
      </section>
    </div>
  );
}
