import { ArrowLeft, ArrowRight, Check, Clock, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { scoreTcfReceptive, scoreTefItems699, TRACK_META } from "../../lib/exam-tracks";
import type { GrammarData } from "../../lib/grammar";
import {
  CATEGORY_LABEL,
  DIFFICULTY_CEFR,
  drawGrammarSprint,
  SPRINT_SPEC,
  type SprintCategory,
  type SprintMode,
} from "../../lib/grammar-sprint";
import { useKeys } from "../../lib/keys";
import { useNavGuard } from "../../lib/nav-guard";
import { go } from "../../lib/router";
import { cue } from "../../lib/sound";
import { useTimer } from "../../lib/timer";
import { logExam } from "../../store/essays";
import { recordSprintResult } from "../../store/grammar";
import { useStore } from "../../store/store";
import { confirmAction } from "../../ui/ConfirmSheet";
import { titleOf } from "./helpers";

const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function StructureSprint({
  initialMode,
  data,
  onExit,
}: {
  initialMode: SprintMode;
  data: GrammarData;
  onExit: () => void;
}) {
  const sfx = useStore((s) => s.settings.sfx);
  const [mode, setMode] = useState<SprintMode>(initialMode);
  const [seed, setSeed] = useState<number>(() => Date.now());
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [struck, setStruck] = useState<Record<string, number[]>>({});
  const [submitted, setSubmitted] = useState(false);
  const [autoTimedOut, setAutoTimedOut] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<"missed" | "all">("missed");
  const submittedRef = useRef(false);
  const { sec: timerSec, running: timerRunning, down: timerDown, start: startTimer, stop: stopTimer } = useTimer();

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const spec = SPRINT_SPEC[mode];
  const items = useMemo(() => drawGrammarSprint(mode, seed), [mode, seed]);

  useEffect(() => {
    submittedRef.current = false;
    setIdx(0);
    setAnswers({});
    setStruck({});
    setSubmitted(false);
    setAutoTimedOut(false);
    setReviewFilter("missed");
    startTimer(SPRINT_SPEC[mode].durationSeconds);
    window.scrollTo({ top: 0 });
    return () => stopTimer();
  }, [mode, seed, startTimer, stopTimer]);

  const answeredCount = useMemo(
    () => items.filter((it) => answers[it.id] !== undefined).length,
    [items, answers],
  );
  const inProgress = !submitted && answeredCount > 0;
  useNavGuard(inProgress, "限时语法冲刺正在进行中，离开将丢失当前作答进度，确定离开？");

  const finalizeSubmit = useCallback(
    (timedOut = false) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      stopTimer();
      setAutoTimedOut(timedOut);
      setSubmitted(true);

      const evalRows = items.map((it) => ({
        item: it,
        correct: answers[it.id] === it.answer,
        difficulty: it.difficulty,
      }));
      const scaled =
        mode === "tcf"
          ? scoreTcfReceptive(evalRows, "struct")
          : scoreTefItems699(evalRows, "struct");

      logExam({
        part: "read",
        what: `struct-${mode}`,
        score: scaled.correctCount,
        total: items.length,
        level: "B2",
        scope: "full",
        track: mode,
        trackSection: "struct",
        scaledScore: scaled.score699,
        nclc: scaled.nclc,
      });

      recordSprintResult(
        evalRows.map((r) => ({
          point: r.item.point,
          tag: r.item.tag,
          ok: r.correct,
        })),
      );

      if (evalRows.every((r) => r.correct)) setReviewFilter("all");
      if (sfx) void cue(scaled.score699 >= 400 ? "complete" : "wrong");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [answers, items, mode, sfx, stopTimer],
  );

  // Auto-submit when countdown hits 0:00
  useEffect(() => {
    if (!submitted && timerDown && !timerRunning && timerSec === 0 && !submittedRef.current) {
      finalizeSubmit(true);
    }
  }, [submitted, timerDown, timerRunning, timerSec, finalizeSubmit]);

  const switchMode = async (nextMode: SprintMode) => {
    if (nextMode === mode) return;
    if (
      inProgress &&
      !(await confirmAction({
        title: `切换到 ${SPRINT_SPEC[nextMode].shortTitle}？`,
        message: "当前套题已有作答但尚未交卷，切换考种将重新抽题计时。",
        confirmLabel: "确认切换",
        danger: true,
      }))
    ) {
      return;
    }
    setMode(nextMode);
    setSeed(Date.now());
    go({ page: "grammar", sprint: nextMode }, null, true);
  };

  const handleExit = async () => {
    if (
      inProgress &&
      !(await confirmAction({
        title: "退出限时冲刺？",
        message: "当前套题尚未交卷，退出后不会计入成绩与复习计划，确定退出？",
        confirmLabel: "确定退出",
        danger: true,
      }))
    ) {
      return;
    }
    stopTimer();
    onExit();
  };

  const handleManualSubmit = async () => {
    if (submitted) return;
    const unanswered = items.length - answeredCount;
    if (
      unanswered > 0 &&
      !(await confirmAction({
        title: `还有 ${unanswered} 题未作答，确定现在交卷？`,
        message: "未作答题目将按答错计分，并自动把对应语法点加入近期 FSRS 复习队列。",
        confirmLabel: "立即交卷",
      }))
    ) {
      return;
    }
    finalizeSubmit(false);
  };

  const currentItem = items[idx] ?? items[0];
  const pickOption = useCallback(
    (optIndex: number) => {
      if (submitted || !currentItem) return;
      setAnswers((prev) => ({ ...prev, [currentItem.id]: optIndex }));
      // Clear strike-out if picking a struck option
      setStruck((prev) => {
        const cur = prev[currentItem.id];
        if (!cur?.includes(optIndex)) return prev;
        return { ...prev, [currentItem.id]: cur.filter((k) => k !== optIndex) };
      });
    },
    [submitted, currentItem],
  );

  const toggleStrike = (itemId: string, optIndex: number) => {
    if (submitted) return;
    setStruck((prev) => {
      const cur = prev[itemId] ?? [];
      const next = cur.includes(optIndex) ? cur.filter((k) => k !== optIndex) : [...cur, optIndex];
      return { ...prev, [itemId]: next };
    });
  };

  const keyBindings: Record<string, () => void> = {};
  if (!submitted && currentItem) {
    OPTION_LETTERS.forEach((_, k) => {
      keyBindings[String(k + 1)] = () => pickOption(k);
    });
    if (idx > 0) keyBindings.ArrowLeft = () => setIdx((n) => Math.max(0, n - 1));
    if (idx + 1 < items.length) keyBindings.ArrowRight = () => setIdx((n) => Math.min(items.length - 1, n + 1));
  }
  useKeys(keyBindings);

  const report = useMemo(() => {
    if (!submitted) return null;
    const rows = items.map((it, i) => ({
      index: i,
      item: it,
      chosen: answers[it.id] ?? null,
      correct: answers[it.id] === it.answer,
      difficulty: it.difficulty,
    }));
    const scaled =
      mode === "tcf"
        ? scoreTcfReceptive(rows, "struct")
        : scoreTefItems699(rows, "struct");
    const b2Passed = scaled.score699 >= 400;
    const nclc7Passed = scaled.nclc >= 7;
    const byCat = (["structure", "lexique", "error"] as SprintCategory[])
      .map((cat) => {
        const sub = rows.filter((r) => r.item.category === cat);
        return { cat, right: sub.filter((r) => r.correct).length, total: sub.length };
      })
      .filter((x) => x.total > 0);
    const missedRows = rows.filter((r) => !r.correct);
    return { rows, scaled, b2Passed, nclc7Passed, byCat, missedRows };
  }, [submitted, items, answers, mode]);

  return (
    <div className="page practice gram gram-discourse">
      <header className="page-head">
        <button type="button" className="link deck-back" onClick={() => void handleExit()}>
          <ArrowLeft size={16} /> 返回语法总览
        </button>
        <p className="eyebrow">限时语言结构冲刺 · {TRACK_META[mode].badge}</p>
        <h1 className="display">{spec.shortTitle}</h1>
        <p className="lede">{spec.description}</p>
      </header>

      <section className="panel gram-discourse-panel">
        <div className="gram-discourse-toolbar">
          <div className="segmented" role="tablist" aria-label="切换 TCF 或 TEF 语言结构冲刺">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "tcf"}
              className={mode === "tcf" ? "is-on" : ""}
              onClick={() => void switchMode("tcf")}
            >
              TCF Structure de la langue（18 题 · 15:00）
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "tef"}
              className={mode === "tef" ? "is-on" : ""}
              onClick={() => void switchMode("tef")}
            >
              TEF Lexique et structure（40 题 · 30:00）
            </button>
          </div>

          <span
            className={`exam-clock ${!submitted && timerSec <= 60 ? "is-over" : submitted ? "is-ok" : ""}`}
            aria-live="polite"
          >
            <Clock size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
            {submitted
              ? autoTimedOut
                ? "时间到 · 已自动交卷"
                : `已交卷 · 剩余 ${formatClock(timerSec)}`
              : formatClock(timerSec)}
          </span>
        </div>

        {/* Question navigator pills */}
        <nav className="chips" aria-label="题号导航">
          {items.map((it, i) => {
            const isCurrent = !submitted && i === idx;
            const hasAns = answers[it.id] !== undefined;
            const postOk = submitted && answers[it.id] === it.answer;
            const cls = isCurrent
              ? "is-on"
              : submitted
                ? postOk
                  ? "lv lv-A1 is-on"
                  : "lv lv-C1 is-on"
                : hasAns
                  ? "lv lv-B2 is-on"
                  : "";
            return (
              <button
                key={it.id}
                type="button"
                className={`chip-btn ${cls}`}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`第 ${i + 1} 题${hasAns ? "（已答）" : "（未答）"}`}
                onClick={() => {
                  setIdx(i);
                  if (submitted) {
                    const el = document.getElementById(`sprint-rev-${it.id}`);
                    el?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }
                }}
              >
                {i + 1}
              </button>
            );
          })}
        </nav>

        {!submitted && currentItem && (
          <>
            <div className="gram-discourse-head">
              <span>
                <span className="chip chip-level lv-B2">
                  难度 {currentItem.difficulty}/6 · {DIFFICULTY_CEFR[currentItem.difficulty]}
                </span>{" "}
                <span className="chip">{CATEGORY_LABEL[currentItem.category]}</span>{" "}
                <span className="muted small">
                  第 <b>{idx + 1}</b> / {items.length} 题 · 已答 {answeredCount}/{items.length}
                </span>
              </span>
              <span className="muted small">快捷键：数字 1–4 选答案，← / → 切题</span>
            </div>

            <p className="gram-sentence" lang="fr">
              {currentItem.prompt}
            </p>

            <div className="exam-options" role="radiogroup" aria-label={`第 ${idx + 1} 题选项`}>
              {currentItem.options.map((opt, k) => {
                const chosen = answers[currentItem.id] === k;
                const isStruck = (struck[currentItem.id] ?? []).includes(k);
                return (
                  <div key={opt} className="exam-opt-row">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={chosen}
                      className={`exam-option ${chosen ? "is-on" : ""} ${isStruck && !chosen ? "is-struck" : ""}`}
                      onClick={() => pickOption(k)}
                      lang="fr"
                    >
                      <span>{OPTION_LETTERS[k]}.</span>
                      {opt}
                      {chosen && <Check size={18} />}
                    </button>
                    <button
                      type="button"
                      className={`exam-strike-btn ${isStruck ? "is-on" : ""}`}
                      aria-pressed={isStruck}
                      title={isStruck ? "恢复该干扰项" : "排除该干扰项"}
                      onClick={() => toggleStrike(currentItem.id, k)}
                    >
                      {isStruck ? "恢复" : "排除"}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="gram-discourse-toolbar">
              <div className="chips">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={idx === 0}
                  onClick={() => setIdx((n) => Math.max(0, n - 1))}
                >
                  <ArrowLeft size={15} /> 上一题
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={idx + 1 >= items.length}
                  onClick={() => setIdx((n) => Math.min(items.length - 1, n + 1))}
                >
                  下一题 <ArrowRight size={15} />
                </button>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleManualSubmit()}
              >
                交卷并查看等级换算（{answeredCount}/{items.length}） <Check size={17} />
              </button>
            </div>
          </>
        )}

        {submitted && report && (
          <>
            <dl className="mini-stats conj-stats">
              <div>
                <dt>标准换算分</dt>
                <dd>{report.scaled.score699} / 699</dd>
              </div>
              <div>
                <dt>CEFR 等级</dt>
                <dd>{report.scaled.cefr}</dd>
              </div>
              <div>
                <dt>加拿大 NCLC</dt>
                <dd>NCLC {report.scaled.nclc}</dd>
              </div>
              <div>
                <dt>原始正确率</dt>
                <dd>
                  {report.scaled.correctCount} / {report.scaled.totalCount}
                </dd>
              </div>
            </dl>

            <div className="chips">
              <span className={`chip chip-status ${report.b2Passed ? "is-done" : ""}`}>
                {report.b2Passed ? "已达 B2 线（≥ 400）" : "距离 B2 线（400 分）还需巩固"}
              </span>
              <span className={`chip chip-status ${report.nclc7Passed ? "is-done" : ""}`}>
                {report.nclc7Passed
                  ? `已达 NCLC 7 线（≥ ${mode === "tcf" ? 453 : 434}）`
                  : `目标 NCLC 7 需 ≥ ${mode === "tcf" ? 453 : 434} 分`}
              </span>
              {report.byCat.map((c) => (
                <span key={c.cat} className="chip">
                  {CATEGORY_LABEL[c.cat]} {c.right}/{c.total}
                </span>
              ))}
            </div>

            <p className="muted small">
              成绩已记入备考总分板（{TRACK_META[mode].shortName} · 语言结构），且本套{" "}
              <b>{report.missedRows.length}</b> 道错题对应的语法点已按 <b>重来（Again）</b> 自动排入今日 FSRS 复习队列。
            </p>

            <div className="gram-discourse-toolbar">
              <div className="segmented" role="group" aria-label="解析筛选">
                <button
                  type="button"
                  className={reviewFilter === "missed" ? "is-on" : ""}
                  onClick={() => setReviewFilter("missed")}
                >
                  只看错题（{report.missedRows.length}）
                </button>
                <button
                  type="button"
                  className={reviewFilter === "all" ? "is-on" : ""}
                  onClick={() => setReviewFilter("all")}
                >
                  全部解析（{report.rows.length}）
                </button>
              </div>
              <div className="chips">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSeed(Date.now())}
                >
                  <RotateCcw size={15} /> 再抽一套新题
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={onExit}>
                  返回语法总览
                </button>
              </div>
            </div>

            {reviewFilter === "missed" && report.missedRows.length === 0 ? (
              <p className="muted">满分通关！本套全部题目均答对，可切换「全部解析」复盘细节。</p>
            ) : (
              <ol className="disc-explanations">
                {(reviewFilter === "missed" ? report.missedRows : report.rows).map((r) => {
                  const chosenLabel =
                    r.chosen !== null
                      ? `${OPTION_LETTERS[r.chosen]}. ${r.item.options[r.chosen]}`
                      : "未作答";
                  const rightLabel = `${OPTION_LETTERS[r.item.answer]}. ${r.item.options[r.item.answer]}`;
                  return (
                    <li
                      key={r.item.id}
                      id={`sprint-rev-${r.item.id}`}
                      className={r.correct ? "is-ok" : "is-bad"}
                    >
                      <p>
                        <b>#{r.index + 1}</b>{" "}
                        <span className="chip">
                          {DIFFICULTY_CEFR[r.item.difficulty]} · {CATEGORY_LABEL[r.item.category]}
                        </span>{" "}
                        <span lang="fr">{r.item.prompt}</span>
                      </p>
                      <p>
                        {r.correct ? (
                          <>
                            <Check size={14} style={{ verticalAlign: "-2px" }} /> 答对：
                            <b lang="fr"> {rightLabel}</b>
                          </>
                        ) : (
                          <>
                            <X size={14} style={{ verticalAlign: "-2px" }} /> 你的选择：
                            <span lang="fr"> {chosenLabel}</span> · 正确答案：
                            <b lang="fr"> {rightLabel}</b>
                          </>
                        )}
                      </p>
                      <p className="muted small">{r.item.why}</p>
                      <a className="link small" href={`#/grammar?p=${r.item.point}`}>
                        去练语法点：{titleOf(data, r.item.point)} <ArrowRight size={13} />
                      </a>
                    </li>
                  );
                })}
              </ol>
            )}
          </>
        )}
      </section>
    </div>
  );
}
