import { ArrowLeft, ArrowRight, Check, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ready, useAiConfig } from "../../ai/config";
import { checkGrammarEquivalence } from "../../ai/tasks/writing";
import { checkTyped, explainOrthographyError, grammarTokenOverlap, type GrammarData } from "../../lib/grammar";
import { DISCOURSE_EXERCISES, type DiscourseExercise, type DiscourseSlot } from "../../lib/grammar-discourse";
import { useNavGuard } from "../../lib/nav-guard";
import { cue } from "../../lib/sound";
import { recordDiscourseResult } from "../../store/grammar";
import { useStore } from "../../store/store";
import { AccentKeys } from "../../ui/AccentKeys";
import { confirmAction } from "../../ui/ConfirmSheet";
import { Speak } from "../../ui/Speak";
import { titleOf } from "./helpers";

interface SlotAiVerdict {
  status: "right" | "accent" | "wrong";
  why: string;
  corrected: string;
}

/** Cross-sentence B1/B2 discourse grammar drill synchronized with grammar FSRS points & sub-rules. */
export function DiscourseSession({
  data,
  exercise,
  onExit,
  onOpenExercise,
}: {
  data?: GrammarData;
  exercise: DiscourseExercise;
  onExit: () => void;
  onOpenExercise: (ex: DiscourseExercise) => void;
}) {
  const settings = useStore((s) => s.settings);
  const ai = useAiConfig();
  const [mode, setMode] = useState<"choice" | "type">("choice");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [accentSlotIds, setAccentSlotIds] = useState<string[]>([]);
  const [hadAccentIds, setHadAccentIds] = useState<Record<string, boolean>>({});
  const [aiVerdicts, setAiVerdicts] = useState<Record<string, SlotAiVerdict>>({});
  const [busySlotId, setBusySlotId] = useState<string | null>(null);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const slotRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const activeSlotRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setAnswers({});
    setSubmitted(false);
    setVerifying(false);
    setAccentSlotIds([]);
    setHadAccentIds({});
    setAiVerdicts({});
    setBusySlotId(null);
    setActiveSlotId(null);
  }, [exercise.id]);

  const parts = useMemo(() => exercise.text.split(/(\{\{\d+\}\})/g), [exercise.text]);
  const slotContexts = useMemo(() => {
    const resolvePart = (part: string | undefined) => {
      if (!part) return "";
      const m = part.match(/^\{\{(\d+)\}\}$/);
      if (!m) return part;
      const sl = exercise.slots[Number(m[1])];
      return (answers[sl.id] ?? "").trim() || sl.answer[0] || "";
    };
    const out: Record<string, { before: string; after: string }> = {};
    parts.forEach((part, idx) => {
      const m = part.match(/^\{\{(\d+)\}\}$/);
      if (!m) return;
      const slot = exercise.slots[Number(m[1])];
      out[slot.id] = {
        before: resolvePart(parts[idx - 1]),
        after: resolvePart(parts[idx + 1]),
      };
    });
    return out;
  }, [parts, exercise.slots, answers]);

  const filledCount = exercise.slots.filter((s) => (answers[s.id] ?? "").trim().length > 0).length;
  const discourseActive = !submitted && filledCount > 0;
  useNavGuard(discourseActive, "语篇填空已有作答但尚未提交，离开将丢失所填内容，确定离开？");
  const exitDiscourse = async () => {
    if (
      discourseActive &&
      !(await confirmAction({
        title: "返回语法总览？",
        message: "当前语篇综合练习已有作答但尚未提交，确定放弃并返回？",
        confirmLabel: "确定返回",
        danger: true,
      }))
    ) {
      return;
    }
    onExit();
  };

  const evalLocalSlot = (slot: DiscourseSlot, overrides = aiVerdicts) => {
    const val = (answers[slot.id] ?? "").trim();
    const aiOv = overrides[slot.id];
    const targets = aiOv?.corrected ? [...slot.answer, aiOv.corrected] : [...slot.answer];
    const local = checkTyped(val, targets, slotContexts[slot.id]);
    if (local === "right") return "right" as const;
    if (aiOv?.status === "right") return "right" as const;
    if (local === "accent" || aiOv?.status === "accent") return "accent" as const;
    return "wrong" as const;
  };

  const evalSlot = (id: string, overrides = aiVerdicts) => {
    const slot = exercise.slots.find((s) => s.id === id)!;
    return evalLocalSlot(slot, overrides);
  };

  const updateAnswer = (slotId: string, nextVal: string) => {
    setAnswers((p) => ({ ...p, [slotId]: nextVal }));
    if (accentSlotIds.includes(slotId)) {
      const slot = exercise.slots.find((s) => s.id === slotId);
      const aiTarget = aiVerdicts[slotId]?.corrected;
      const targets = slot ? (aiTarget ? [...slot.answer, aiTarget] : [...slot.answer]) : [];
      if (slot && checkTyped(nextVal.trim(), targets, slotContexts[slotId]) === "right") {
        setAccentSlotIds((ids) => ids.filter((x) => x !== slotId));
      }
    }
  };

  const correctCount = submitted ? exercise.slots.filter((s) => evalSlot(s.id) === "right").length : 0;
  const fullPassage = useMemo(
    () =>
      parts
        .map((part) => {
          const m = part.match(/^\{\{(\d+)\}\}$/);
          if (!m) return part;
          return exercise.slots[Number(m[1])].answer[0];
        })
        .join(""),
    [parts, exercise.slots],
  );

  const querySlotEquivalence = async (slot: DiscourseSlot, val: string): Promise<SlotAiVerdict | null> => {
    try {
      const pointTitle = data ? titleOf(data, slot.point) : slot.point;
      const ctx = slotContexts[slot.id];
      const eq = await checkGrammarEquivalence({
        kind: exercise.kind === "fix" ? "fix" : "type",
        pointTitle,
        prompt: exercise.kind === "fix" && slot.shown ? `改写 “${slot.shown}”（${slot.hint}）` : slot.hint,
        sentenceContext: `${ctx?.before ?? ""}___${ctx?.after ?? ""}`,
        expected: slot.answer,
        answer: val,
      });
      return {
        status: eq.equivalent ? "right" : eq.accentOnly ? "accent" : "wrong",
        why: eq.why,
        corrected: eq.corrected,
      };
    } catch {
      return null;
    }
  };

  const finalizeSubmission = (nextAiVerdicts: Record<string, SlotAiVerdict>, nextHadAccents: Record<string, boolean>) => {
    setAccentSlotIds([]);
    setSubmitted(true);
    const outcomes = exercise.slots.map((s) => ({
      point: s.point,
      tag: s.tag,
      ok: evalLocalSlot(s, nextAiVerdicts) === "right",
      accent: !!nextHadAccents[s.id],
    }));
    recordDiscourseResult(outcomes, exercise.id);
    const allOk = outcomes.every((o) => o.ok);
    if (settings.sfx) void cue(allOk ? "correct" : "wrong");
  };

  const submit = async () => {
    if (submitted || verifying) return;
    let nextHadAccents = { ...hadAccentIds };

    if (mode === "type") {
      // 1. Snappy synchronous local check for accent-only slips
      const currentAccents = exercise.slots.filter((s) => evalSlot(s.id) === "accent").map((s) => s.id);
      if (currentAccents.length > 0) {
        nextHadAccents = {
          ...nextHadAccents,
          ...Object.fromEntries(currentAccents.map((id) => [id, true])),
        };
        setHadAccentIds(nextHadAccents);
        setAccentSlotIds(currentAccents);
        slotRefs.current[currentAccents[0]]?.focus();
        return;
      }

      // 2. Pre-verdict AI equivalence check when ready.text(ai) & grammarTokenOverlap >= 0.45
      if (ready.text(ai)) {
        const candidates = exercise.slots.filter((s) => {
          if (evalSlot(s.id) !== "wrong" || aiVerdicts[s.id]) return false;
          const val = (answers[s.id] ?? "").trim();
          if (!val || explainOrthographyError(val, [...s.answer])) return false;
          return grammarTokenOverlap(val, s.answer) >= 0.45;
        });

        if (candidates.length > 0) {
          setVerifying(true);
          const mergedAi = { ...aiVerdicts };
          try {
            const results = await Promise.all(
              candidates.map(async (slot) => ({
                id: slot.id,
                res: await querySlotEquivalence(slot, (answers[slot.id] ?? "").trim()),
              })),
            );
            for (const { id, res } of results) {
              if (res) mergedAi[id] = res;
            }
            setAiVerdicts(mergedAi);
          } finally {
            setVerifying(false);
          }

          const aiAccents = exercise.slots
            .filter((s) => mergedAi[s.id]?.status === "accent" && evalLocalSlot(s, mergedAi) === "accent")
            .map((s) => s.id);
          if (aiAccents.length > 0) {
            nextHadAccents = {
              ...nextHadAccents,
              ...Object.fromEntries(aiAccents.map((id) => [id, true])),
            };
            setHadAccentIds(nextHadAccents);
            setAccentSlotIds(aiAccents);
            slotRefs.current[aiAccents[0]]?.focus();
            return;
          }
          finalizeSubmission(mergedAi, nextHadAccents);
          return;
        }
      }
    }

    finalizeSubmission(aiVerdicts, nextHadAccents);
  };

  const askSlotAi = async (slot: DiscourseSlot) => {
    const val = (answers[slot.id] ?? "").trim();
    if (!val || busySlotId) return;
    setBusySlotId(slot.id);
    try {
      const res = await querySlotEquivalence(slot, val);
      if (!res) return;
      const next = { ...aiVerdicts, [slot.id]: res };
      setAiVerdicts(next);
      if (res.status === "right") {
        recordDiscourseResult([{ point: slot.point, tag: slot.tag, ok: true }], exercise.id);
      }
    } finally {
      setBusySlotId(null);
    }
  };

  const reset = () => {
    setAnswers({});
    setSubmitted(false);
    setVerifying(false);
    setAccentSlotIds([]);
    setHadAccentIds({});
    setAiVerdicts({});
    setBusySlotId(null);
  };

  const nextExercise =
    DISCOURSE_EXERCISES[(DISCOURSE_EXERCISES.findIndex((e) => e.id === exercise.id) + 1) % DISCOURSE_EXERCISES.length];

  return (
    <div className="page practice gram-discourse">
      <header className="page-head">
        <button className="link deck-back" onClick={() => void exitDiscourse()}>
          <ArrowLeft size={16} /> 返回语法总览
        </button>
        <p className="eyebrow">
          {exercise.level} · {exercise.kind === "fix" ? "语篇跨句改错" : "语篇跨句填空"}
        </p>
        <h1 className="display">{exercise.title}</h1>
        <p className="lede">{exercise.subtitle}</p>
      </header>

      <section className="panel gram-discourse-panel">
        <div className="gram-discourse-toolbar">
          <div className="segmented">
            <button
              type="button"
              className={mode === "choice" ? "is-on" : ""}
              onClick={() => {
                if (!submitted && !verifying) {
                  setAccentSlotIds([]);
                  setMode("choice");
                }
              }}
              disabled={submitted || verifying}
            >
              选择模式
            </button>
            <button
              type="button"
              className={mode === "type" ? "is-on" : ""}
              onClick={() => !submitted && !verifying && setMode("type")}
              disabled={submitted || verifying}
            >
              自主拼写模式
            </button>
          </div>
          {submitted && (
            <span className="gram-discourse-score">
              正确 <b>{correctCount}</b> / {exercise.slots.length} · <small className="muted">已同步至语法点掌握度</small>
              <Speak url={null} text={fullPassage} size="sm" />
            </span>
          )}
        </div>

        <p className="gram-discourse-passage" lang="fr">
          {parts.map((part, idx) => {
            const m = part.match(/^\{\{(\d+)\}\}$/);
            if (!m) return <span key={idx}>{part}</span>;
            const slotIndex = Number(m[1]);
            const slot = exercise.slots[slotIndex];
            const val = answers[slot.id] ?? "";
            const st = submitted ? evalSlot(slot.id) : accentSlotIds.includes(slot.id) ? "accent" : null;
            return (
              <span key={slot.id} className={`disc-slot ${st ? `is-${st}` : ""}`}>
                <span className="disc-num">[{slotIndex + 1}]</span>
                {exercise.kind === "fix" && slot.shown && (
                  <u className="disc-wrong-shown" title={slot.hint}>
                    {slot.shown}
                  </u>
                )}
                {mode === "type" && !submitted ? (
                  <input
                    ref={(el) => {
                      slotRefs.current[slot.id] = el;
                    }}
                    onFocus={() => {
                      activeSlotRef.current = slotRefs.current[slot.id];
                      setActiveSlotId(slot.id);
                    }}
                    className="disc-input"
                    value={val}
                    readOnly={verifying}
                    onChange={(e) => updateAnswer(slot.id, e.target.value)}
                    placeholder={slot.hint}
                    aria-label={`第 ${slotIndex + 1} 处（${slot.hint}）`}
                    lang="fr"
                  />
                ) : (
                  <b className="disc-fill">
                    {submitted ? (
                      st === "right" ? (
                        val || slot.answer[0]
                      ) : (
                        <>
                          {val && <del>{val}</del>} <ins>{slot.answer[0]}</ins>
                        </>
                      )
                    ) : (
                      val || `（${slot.hint}）`
                    )}
                  </b>
                )}
              </span>
            );
          })}
        </p>

        {!submitted && mode === "type" && activeSlotId && (
          <AccentKeys
            input={activeSlotRef}
            value={answers[activeSlotId] ?? ""}
            onChange={(v) => updateAnswer(activeSlotId, v)}
          />
        )}

        {!submitted && mode === "type" && accentSlotIds.length > 0 && (
          <div className="gram-accent-banner" role="status">
            <p>
              重音微瑕，请按正确重音重敲一遍：
              {accentSlotIds.map((id) => {
                const si = exercise.slots.findIndex((x) => x.id === id);
                const sl = exercise.slots[si];
                const target = aiVerdicts[id]?.corrected || sl.answer[0];
                return (
                  <span key={id} lang="fr">
                    {" "}
                    [{si + 1}] <b>{target}</b>
                  </span>
                );
              })}
            </p>
          </div>
        )}

        {!submitted && mode === "choice" && (
          <ol className="disc-choices">
            {exercise.slots.map((slot, si) => (
              <li key={slot.id}>
                <span className="disc-choice-label">
                  <b>[{si + 1}]</b>{" "}
                  {exercise.kind === "fix" && slot.shown ? (
                    <span lang="fr">改写 “{slot.shown}”</span>
                  ) : (
                    <span lang="fr">{slot.hint}</span>
                  )}
                </span>
                <div className="disc-choice-opts">
                  {slot.options.map((opt) => {
                    const on = answers[slot.id] === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        lang="fr"
                        className={`chip-btn ${on ? "is-on" : ""}`}
                        aria-pressed={on}
                        onClick={() => setAnswers((p) => ({ ...p, [slot.id]: opt }))}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ol>
        )}

        {!submitted ? (
          <>
            <button
              type="button"
              className="btn btn-primary btn-xl"
              disabled={filledCount < exercise.slots.length || verifying}
              onClick={() => void submit()}
            >
              {verifying
                ? "AI 正在静默核验等价表达…"
                : accentSlotIds.length > 0
                  ? "已修正重音，再次提交检查"
                  : `提交整篇检查（${filledCount}/${exercise.slots.length}）`}{" "}
              <Check size={18} />
            </button>
          </>
        ) : (
          <>
            <ol className="disc-explanations">
              {exercise.slots.map((slot, si) => {
                const res = evalSlot(slot.id);
                const aiInfo = aiVerdicts[slot.id];
                const ortho =
                  res === "wrong" && answers[slot.id]
                    ? explainOrthographyError(answers[slot.id], [...slot.answer])
                    : null;
                const canAskAi =
                  mode === "type" &&
                  res === "wrong" &&
                  !ortho &&
                  !aiInfo &&
                  ready.text(ai) &&
                  Boolean((answers[slot.id] ?? "").trim());
                return (
                  <li key={slot.id} className={res === "right" ? "is-ok" : "is-bad"}>
                    <p>
                      <b>[{si + 1}]</b>{" "}
                      {res === "right"
                        ? aiInfo?.status === "right"
                          ? "AI 认可等价写法"
                          : hadAccentIds[slot.id]
                            ? "已修正重音（困难巩固）"
                            : "答对了"
                        : res === "accent"
                          ? "注意重音"
                          : "应为"}
                      ：<b lang="fr"> {slot.answer[0]}</b>
                      {res !== "right" && answers[slot.id] ? `（你填：${answers[slot.id]}）` : ""}
                    </p>
                    {ortho && <p className="gram-ortho-hint">{ortho}</p>}
                    {aiInfo?.why && <p className="muted small">AI 等价核验：{aiInfo.why}</p>}
                    <p className="muted small">{slot.why}</p>
                    <div className="chips">
                      <a className="link small" href={`#/grammar?p=${slot.point}`}>
                        去练对应语法点{data ? `：${titleOf(data, slot.point)}` : ""} <ArrowRight size={13} />
                      </a>
                      {canAskAi && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busySlotId === slot.id}
                          onClick={() => void askSlotAi(slot)}
                        >
                          <Sparkles size={13} />{" "}
                          {busySlotId === slot.id ? "AI 核验中…" : "我的同义写法可能也对：让 AI 核验"}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="summary-actions">
              <button type="button" className="btn btn-ghost" onClick={reset}>
                <RotateCcw size={16} /> 重做本篇
              </button>
              <button type="button" className="btn btn-primary" onClick={() => onOpenExercise(nextExercise)}>
                下一篇：{nextExercise.title} <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
