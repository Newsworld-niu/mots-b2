import { ArrowRight, Check, RotateCcw, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ready, useAiConfig } from "../../ai/config";
import { checkRewrite } from "../../ai/tasks";
import { checkGrammarEquivalence } from "../../ai/tasks/writing";
import {
  answerOf,
  checkTyped,
  explainOrthographyError,
  fixedOf,
  fullOf,
  grammarTokenOverlap,
  orderRight,
  shuffled,
  tagLabel,
  type ChoiceDrill,
  type Drill,
  type FixDrill,
  type GrammarData,
  type GrammarPoint,
  type OrderDrill,
  type TransformDrill,
  type TypeDrill,
} from "../../lib/grammar";
import { useKeys } from "../../lib/keys";
import { useNavGuard } from "../../lib/nav-guard";
import { cue } from "../../lib/sound";
import { hashSeed, shuffle } from "../../lib/text";
import { ESSAY_TAG, shouldAmendRewrite, skipDrill } from "../../store/grammar";
import { Rating } from "../../store/srs";
import { store, useStore } from "../../store/store";
import { AccentKeys } from "../../ui/AccentKeys";
import { confirmAction } from "../../ui/ConfirmSheet";
import { Speak } from "../../ui/Speak";
import { gradeRound, useNextKeys, type Answered, type Graded, type Pending, type Result, type Step } from "./helpers";

export function Session({ data, initial, onExit }: { data: GrammarData; initial: Step[]; onExit: () => void }) {
  const settings = useStore((s) => s.settings);
  const [i, setI] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const [log, setLog] = useState<Answered[]>([]);
  const [graded, setGraded] = useState<Graded[] | null>(null);
  const active = i < initial.length && log.length > 0;
  useNavGuard(active, "本轮语法练习尚未完成，离开不会记录本轮复习进度，确定离开？");
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);
  const step = initial[i];

  const answer = useCallback(
    (result: Result, value: string, extra?: { aiNote?: string; orthographyHint?: string | null }) => {
      if (pending || !step) return;
      const ok = result === "right";
      if (settings.sfx) void cue(result !== "wrong" ? "correct" : "wrong");
      setPending({ result, value, ...extra });
      setLog((l) => [...l, { step, ok, value }]);
    },
    [pending, step, settings.sfx],
  );
  /** 算我对 / the AI found a rewrite right: the last answer counts as right. */
  const amend = useCallback(() => {
    setPending((p) => (p ? { ...p, result: "right" } : p));
    setLog((l) => l.map((x, k) => (k === l.length - 1 ? { ...x, ok: true } : x)));
  }, []);
  const next = useCallback(() => {
    setPending(null);
    if (i + 1 >= initial.length && !graded) setGraded(gradeRound(log));
    setI((n) => n + 1);
  }, [i, initial.length, graded, log]);

  const exitSession = async () => {
    if (
      active &&
      !(await confirmAction({
        title: "结束本轮语法练习？",
        message: "本轮尚未完成，提前退出不会记入复习调度，确定离开？",
        confirmLabel: "确定退出",
        danger: true,
      }))
    ) {
      return;
    }
    onExit();
  };

  if (i >= initial.length) return <Summary data={data} log={log} graded={graded ?? []} onExit={onExit} />;
  const point = data.points.find((p) => p.id === step.point)!;
  const d = step.drill;
  const q = { point, pending, onAnswer: answer, onNext: next, onAmend: amend };
  return (
    <div className="page practice typing gram-run">
      <header className="typing-top">
        <button className="btn btn-ghost" onClick={() => void exitSession()}>
          结束
        </button>
        <div className="learn-progress">
          <span style={{ width: `${(i / initial.length) * 100}%` }} />
        </div>
        <span className="typing-meter">
          <b>{i + 1}</b> / {initial.length}
        </span>
      </header>
      <section className="typing-stage gram-stage">
        <p className="stage-label">
          <span className="dot dot-review" />
          {point.title}
          {d.g && (d.g === ESSAY_TAG || !!pending) && <span className="gram-tag-chip">{d.g === ESSAY_TAG ? "作文错句" : tagLabel(point, d.g)}</span>}
        </p>
        {d.k === "c" ? (
          <ChoiceQuestion key={i} drill={d} {...q} />
        ) : d.k === "o" ? (
          <OrderQuestion key={i} drill={d} {...q} />
        ) : d.k === "t" ? (
          <TypeQuestion key={i} drill={d} {...q} />
        ) : d.k === "f" ? (
          <FixQuestion key={i} drill={d} {...q} />
        ) : (
          <TransformQuestion key={i} drill={d} {...q} />
        )}
      </section>
    </div>
  );
}

interface QuestionProps<D extends Drill> {
  point: GrammarPoint;
  drill: D;
  pending: Pending | null;
  onAnswer: (r: Result, v: string, extra?: { aiNote?: string; orthographyHint?: string | null }) => void;
  onNext: () => void;
  onAmend: () => void;
}

/** The sentence with one part in bold. */
function Marked({ s, b, with: w }: { s: string; b: [number, number]; with?: string }) {
  return (
    <>
      {s.slice(0, b[0])}
      <b>{w ?? s.slice(b[0], b[1])}</b>
      {s.slice(b[1])}
    </>
  );
}

function Feedback({ point, drill, pending, onNext, onAmend }: { point: GrammarPoint; drill: Drill; pending: Pending; onNext: () => void; onAmend: () => void }) {
  const [skipped, setSkipped] = useState(false);
  const ai = useAiConfig();
  const [checking, setChecking] = useState<"idle" | "busy" | { verdict: "correct" | "almost" | "wrong"; why: string; corrected: string } | "error">("idle");
  const [retryValue, setRetryValue] = useState("");
  const [retriedOk, setRetriedOk] = useState(false);
  const [accentRetry, setAccentRetry] = useState("");
  const [accentRetriedOk, setAccentRetriedOk] = useState(false);
  const retryInput = useRef<HTMLInputElement>(null);
  const accentInput = useRef<HTMLInputElement>(null);
  const isAccent = pending.result === "accent";
  const needsAccentRetype = isAccent && !accentRetriedOk;
  const ok = pending.result === "right" || accentRetriedOk;
  const mine = drill.g === ESSAY_TAG;
  const expectedTargets = drill.k === "t" || drill.k === "x" ? drill.a : drill.k === "f" ? drill.r : drill.k === "o" ? [drill.s] : [answerOf(drill)];
  const clozeCtx = drill.k === "t" || drill.k === "f" ? { before: drill.s.slice(0, drill.b[0]), after: drill.s.slice(drill.b[1]) } : undefined;
  const verdict =
    pending.result === "right"
      ? "答对了"
      : isAccent
        ? accentRetriedOk
          ? "已重敲巩固 ✓"
          : "重音微瑕，请按正确重音重敲一遍"
        : "没关系，记住它";
  const chosenWhy = drill.k === "c" && !ok ? drill.e?.[pending.value] : undefined;
  const otherOpts = drill.k === "c" && drill.e ? Object.entries(drill.e).filter(([k]) => ok || k !== pending.value) : [];
  const askAi = async () => {
    if (drill.k !== "x") return;
    setChecking("busy");
    try {
      const req = { given: drill.q, task: drill.h, reference: drill.s, answer: pending.value, pointTitle: point.title };
      const r = await checkRewrite(req);
      setChecking(r);
      if (shouldAmendRewrite(r.verdict)) onAmend();
    } catch {
      setChecking("error");
    }
  };
  const checkRetry = (e: React.FormEvent) => {
    e.preventDefault();
    if (drill.k !== "x" || typeof checking !== "object") return;
    const targets = [checking.corrected, ...drill.a].filter(Boolean);
    if (checkTyped(retryValue, targets) === "right") setRetriedOk(true);
  };
  const checkAccentRetype = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkTyped(accentRetry, expectedTargets, clozeCtx) === "right") {
      setAccentRetriedOk(true);
    }
  };
  return (
    <div className={`conj-feedback ${pending.result === "right" ? "is-right" : isAccent ? "is-accent" : "is-wrong"}`} role="status">
      <p className="feedback-verdict">{verdict}</p>
      {pending.orthographyHint && <p className="warn small">{pending.orthographyHint}</p>}
      {pending.aiNote && <p className="muted small">AI 等价核验：{pending.aiNote}</p>}
      {isAccent && !accentRetriedOk && (
        <form className="gram-almost-retry" onSubmit={checkAccentRetype}>
          <input
            ref={accentInput}
            className="conj-input"
            value={accentRetry}
            onChange={(e) => setAccentRetry(e.target.value)}
            placeholder={`按正确重音重敲：${expectedTargets[0] ?? ""}`}
            aria-label="按正确重音重输"
            lang="fr"
            autoFocus
          />
          <button type="submit" className="btn btn-ghost btn-sm" disabled={!accentRetry.trim()}>
            确认重输
          </button>
          <AccentKeys input={accentInput} value={accentRetry} onChange={setAccentRetry} />
        </form>
      )}
      {chosenWhy && (
        <p className="gram-chosen">
          你选的 <b lang="fr">{pending.value}</b>：{chosenWhy}
        </p>
      )}
      {drill.k === "f" && (
        <p className="gram-fix-verdict">{drill.r.length ? <>划线部分应改为 <b lang="fr">{drill.r.join(" / ")}</b></> : "原句没有错。"}</p>
      )}
      <p className="gram-full" lang="fr">
        {drill.k === "c" || drill.k === "t" ? (
          <Marked s={drill.s} b={drill.b} />
        ) : drill.k === "f" ? (
          drill.r.length ? <Marked s={drill.s} b={drill.b} with={drill.r[0]} /> : <Marked s={drill.s} b={drill.b} />
        ) : (
          fullOf(drill)
        )}
        <Speak url={null} text={fullOf(drill)} size="sm" />
      </p>
      {drill.k === "t" && drill.a.length > 1 && <p className="muted gram-also">也对：{drill.a.slice(1).join(" / ")}</p>}
      {drill.k === "x" && drill.a.length > 1 && <p className="muted gram-also">也可以：{drill.a.slice(1).join(" / ")}</p>}
      {drill.z && <p className="gram-zh">{drill.z}</p>}
      <p className="gram-why">{drill.y}</p>
      {otherOpts.length > 0 && (
        <details className="gram-others">
          <summary>为什么其他选项不对</summary>
          <ul>
            {otherOpts.map(([opt, why]) => (
              <li key={opt}>
                <b lang="fr">{opt}</b>：{why}
              </li>
            ))}
          </ul>
        </details>
      )}
      {mine && !ok && (
        <div className="gram-amend">
          <button className="link" onClick={onAmend}>
            我改得也对，算我对
          </button>
        </div>
      )}
      {drill.k === "x" && !ok && (
        <div className="gram-amend">
          {typeof checking === "object" ? (
            <div className="gram-ai-verdict">
              <p>
                AI：{checking.verdict === "correct" ? "你的句子也对。" : checking.verdict === "almost" ? "转换对了，有个小错（保留错误权重，请修正重输）。" : "还不对。"}
                {checking.why}
                {checking.corrected && checking.corrected !== pending.value && (
                  <>
                    {" "}
                    改正：<span lang="fr">{checking.corrected}</span>
                  </>
                )}
              </p>
              {checking.verdict === "almost" && (
                retriedOk ? (
                  <p className="muted small">已重输巩固 ✓（仍计入本次错题权重以便近期巩固）</p>
                ) : (
                  <form className="gram-almost-retry" onSubmit={checkRetry}>
                    <input
                      ref={retryInput}
                      value={retryValue}
                      onChange={(e) => setRetryValue(e.target.value)}
                      placeholder="按改正后的句子重输一遍"
                      aria-label="重输改正后的句子"
                      lang="fr"
                    />
                    <button type="submit" className="btn btn-ghost btn-sm" disabled={!retryValue.trim()}>
                      检查重输
                    </button>
                    <AccentKeys input={retryInput} value={retryValue} onChange={setRetryValue} />
                  </form>
                )
              )}
            </div>
          ) : (
            <>
              {ready.text(ai) && (
                <button className="btn btn-ghost" onClick={askAi} disabled={checking === "busy"}>
                  <Sparkles size={15} /> {checking === "busy" ? "AI 在看…" : checking === "error" ? "AI 没连上，再试一次" : "我的写法可能也对：让 AI 看看"}
                </button>
              )}
              <button className="link" onClick={onAmend}>
                我确定我的也对，算我对
              </button>
            </>
          )}
        </div>
      )}
      <button className={`btn btn-xl ${ok ? "btn-sage" : "btn-terra"}`} disabled={needsAccentRetype} onClick={onNext} autoFocus={!needsAccentRetype}>
        继续 <ArrowRight size={20} />
      </button>
      {!mine && (
        <button
          className="link gram-skip"
          disabled={skipped}
          onClick={() => {
            skipDrill(point.id, drill);
            setSkipped(true);
          }}
        >
          {skipped ? "以后不会再出这题" : "这题有问题（答案不对、两个都对、句子不通），不再出现"}
        </button>
      )}
    </div>
  );
}

function ChoiceQuestion({ point, drill, pending, onAnswer, onNext, onAmend }: QuestionProps<ChoiceDrill>) {
  const right = answerOf(drill);
  const options = useMemo(() => shuffle([...drill.o], hashSeed(drill.s)), [drill]);
  const keys: Record<string, () => void> = {};
  if (pending) {
    keys.Enter = onNext;
    keys[" "] = onNext;
  } else options.forEach((o, k) => (keys[String(k + 1)] = () => onAnswer(o === right ? "right" : "wrong", o)));
  useKeys(keys);
  return (
    <>
      <p className="gram-sentence" lang="fr">
        {drill.s.slice(0, drill.b[0])}
        <span className={`gram-blank ${pending ? (pending.result !== "wrong" ? "is-right" : "is-wrong") : ""}`}>{pending ? right : " ".repeat(Math.max(6, right.length + 2))}</span>
        {drill.s.slice(drill.b[1])}
      </p>
      {drill.h && <p className="gram-hint">{drill.h}</p>}
      <ul className="options conj-options">
        {options.map((o, k) => {
          const isAnswer = o === right;
          const chosen = pending?.value === o;
          const cls = pending ? (isAnswer ? "is-answer" : chosen ? "is-chosen" : "is-dim") : "";
          return (
            <li key={o}>
              <button className={`option ${cls}`} onClick={() => onAnswer(isAnswer ? "right" : "wrong", o)} disabled={!!pending}>
                <kbd>{k + 1}</kbd>
                <span lang="fr">{o}</span>
                {pending && isAnswer && <Check size={20} className="option-mark" />}
                {pending && chosen && !isAnswer && <X size={20} className="option-mark" />}
              </button>
            </li>
          );
        })}
      </ul>
      {pending && <Feedback point={point} drill={drill} pending={pending} onNext={onNext} onAmend={onAmend} />}
    </>
  );
}

function OrderQuestion({ point, drill, pending, onAnswer, onNext, onAmend }: QuestionProps<OrderDrill>) {
  const pool = useMemo(() => shuffled(drill.t, hashSeed(drill.s)).map((w, i) => ({ w, i })), [drill]);
  const [picked, setPicked] = useState<number[]>([]);
  const words = picked.map((k) => pool[k].w);
  const check = () => onAnswer(orderRight(drill, words) ? "right" : "wrong", words.join(" "));
  const keys: Record<string, () => void> = {};
  if (pending) {
    keys.Enter = onNext;
    keys[" "] = onNext;
  } else {
    if (picked.length === pool.length) keys.Enter = check;
    keys.Backspace = () => setPicked((p) => p.slice(0, -1));
  }
  useKeys(keys);
  return (
    <>
      <p className="gram-zh gram-order-zh">{drill.z}</p>
      <p className="gram-hint">{drill.h}</p>
      <div className={`gram-answer ${pending ? (pending.result !== "wrong" ? "is-right" : "is-wrong") : ""}`} lang="fr" aria-label="你的句子">
        {picked.length === 0 && <span className="gram-placeholder">按顺序点下面的词</span>}
        {picked.map((k, n) => (
          <button key={k} className="gram-chip is-picked" disabled={!!pending} onClick={() => setPicked((p) => p.filter((_, j) => j !== n))}>
            {pool[k].w}
          </button>
        ))}
        {drill.p && picked.length === pool.length && <span>{drill.p}</span>}
      </div>
      <div className="gram-pool" lang="fr">
        {pool.map((x, k) => (
          <button key={k} className="gram-chip" disabled={!!pending || picked.includes(k)} onClick={() => setPicked((p) => [...p, k])}>
            {x.w}
          </button>
        ))}
      </div>
      {!pending && (
        <div className="summary-actions">
          <button className="btn btn-ghost" onClick={() => setPicked([])} disabled={!picked.length}>
            重来
          </button>
          <button className="btn btn-primary" onClick={check} disabled={picked.length !== pool.length}>
            检查 <kbd>Enter</kbd>
          </button>
        </div>
      )}
      {pending && <Feedback point={point} drill={drill} pending={pending} onNext={onNext} onAmend={onAmend} />}
    </>
  );
}

/** A text box with buttons for French letters; Enter submits. */
function FrenchInput({ value, onChange, onSubmit, disabled, label, wide, autoFocus = true }: { value: string; onChange: (v: string) => void; onSubmit: () => void; disabled: boolean; label: string; wide?: boolean; autoFocus?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);
  return (
    <form
      className={`conj-type gram-type ${wide ? "is-wide" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled && value.trim()) onSubmit();
      }}
    >
      <input
        ref={input}
        className="conj-input"
        value={value}
        onChange={(e) => !disabled && onChange(e.target.value)}
        readOnly={disabled}
        lang="fr"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="done"
        aria-label={label}
      />
      {!disabled && (
        <>
          <AccentKeys input={input} value={value} onChange={onChange} />
          <button type="submit" className="btn btn-primary" disabled={!value.trim()}>
            确认 <kbd>Enter</kbd>
          </button>
        </>
      )}
    </form>
  );
}

function TypeQuestion({ point, drill, pending, onAnswer, onNext, onAmend }: QuestionProps<TypeDrill>) {
  const ai = useAiConfig();
  const [value, setValue] = useState("");
  const [verifying, setVerifying] = useState(false);
  useNextKeys(pending && pending.result !== "accent" ? pending : null, onNext);
  const right = answerOf(drill);
  const before = drill.s.slice(0, drill.b[0]);
  const after = drill.s.slice(drill.b[1]);
  const submit = async () => {
    const v = value.trim();
    if (!v || verifying) return;
    const det = checkTyped(v, drill.a, { before, after });
    if (det !== "wrong") return onAnswer(det, v);
    const orthoHint = explainOrthographyError(v, drill.a);
    if (!orthoHint && ready.text(ai) && grammarTokenOverlap(v, drill.a) >= 0.45) {
      setVerifying(true);
      try {
        const eq = await checkGrammarEquivalence({
          kind: "type",
          pointTitle: point.title,
          prompt: drill.h,
          sentenceContext: `${before}___${after}`,
          expected: drill.a,
          answer: v,
        });
        if (eq.equivalent) return onAnswer("right", v, { aiNote: eq.why });
        if (eq.accentOnly) return onAnswer("accent", v, { aiNote: eq.why });
        return onAnswer("wrong", v, { aiNote: eq.why });
      } catch {
        /* fallback to deterministic verdict */
      } finally {
        setVerifying(false);
      }
    }
    onAnswer("wrong", v, { orthographyHint: orthoHint });
  };
  return (
    <>
      <p className="gram-sentence" lang="fr">
        {before}
        <span className={`gram-blank ${pending ? (pending.result !== "wrong" ? "is-right" : "is-wrong") : ""}`}>{pending ? right : " ".repeat(Math.max(6, right.length + 2))}</span>
        {after}
      </p>
      <p className="gram-hint">{drill.h}</p>
      <FrenchInput value={pending ? pending.value : value} onChange={setValue} onSubmit={() => void submit()} disabled={!!pending || verifying} label="填空" />
      {verifying && <p className="muted small">AI 正在静默核验等价表达…</p>}
      {pending && <Feedback point={point} drill={drill} pending={pending} onNext={onNext} onAmend={onAmend} />}
    </>
  );
}

function FixQuestion({ point, drill, pending, onAnswer, onNext, onAmend }: QuestionProps<FixDrill>) {
  const ai = useAiConfig();
  const segment = drill.s.slice(drill.b[0], drill.b[1]);
  const before = drill.s.slice(0, drill.b[0]);
  const after = drill.s.slice(drill.b[1]);
  const [editing, setEditing] = useState(drill.g === ESSAY_TAG);
  const [value, setValue] = useState(segment);
  const [verifying, setVerifying] = useState(false);
  const sayRight = () => onAnswer(drill.r.length ? "wrong" : "right", "（没有错）");
  const submit = async () => {
    const v = value.trim();
    if (!v || verifying) return;
    if (checkTyped(v, [segment], { before, after }) === "right") return sayRight();
    if (!drill.r.length) return onAnswer("wrong", v);
    const det = checkTyped(v, drill.r, { before, after });
    if (det !== "wrong") return onAnswer(det, v);
    const orthoHint = explainOrthographyError(v, drill.r);
    if (!orthoHint && ready.text(ai) && grammarTokenOverlap(v, drill.r) >= 0.45) {
      setVerifying(true);
      try {
        const eq = await checkGrammarEquivalence({
          kind: "fix",
          pointTitle: point.title,
          prompt: drill.h || "改正划线部分语法错误",
          sentenceContext: drill.s,
          expected: drill.r,
          answer: v,
        });
        if (eq.equivalent) return onAnswer("right", v, { aiNote: eq.why });
        if (eq.accentOnly) return onAnswer("accent", v, { aiNote: eq.why });
        return onAnswer("wrong", v, { aiNote: eq.why });
      } catch {
        /* fallback to deterministic verdict */
      } finally {
        setVerifying(false);
      }
    }
    onAnswer("wrong", v, { orthographyHint: orthoHint });
  };
  const keys: Record<string, () => void> = {};
  if (pending && pending.result !== "accent") {
    keys.Enter = onNext;
    keys[" "] = onNext;
  } else if (!pending && !editing) {
    keys["1"] = sayRight;
    keys["2"] = () => setEditing(true);
  }
  useKeys(keys);
  return (
    <>
      <p className="gram-sentence gram-fix" lang="fr">
        {before}
        <u>{segment}</u>
        {after}
      </p>
      <p className="gram-hint">{drill.h || "划线部分对吗？有错就改正（也可能没有错）"}</p>
      {!pending && !editing && (
        <ul className="options conj-options gram-fix-options">
          <li>
            <button className="option" onClick={sayRight}>
              <kbd>1</kbd>
              <span>没有错</span>
            </button>
          </li>
          <li>
            <button className="option" onClick={() => setEditing(true)}>
              <kbd>2</kbd>
              <span>有错，我来改</span>
            </button>
          </li>
        </ul>
      )}
      {(editing || (pending && pending.value !== "（没有错）")) && (
        <FrenchInput value={pending ? pending.value : value} onChange={setValue} onSubmit={() => void submit()} disabled={!!pending || verifying} label="改正划线部分" />
      )}
      {verifying && <p className="muted small">AI 正在静默核验等价改写…</p>}
      {pending && pending.value === "（没有错）" && <p className="gram-hint">你的回答：没有错</p>}
      {pending && <Feedback point={point} drill={drill} pending={pending} onNext={onNext} onAmend={onAmend} />}
    </>
  );
}

function TransformQuestion({ point, drill, pending, onAnswer, onNext, onAmend }: QuestionProps<TransformDrill>) {
  const ai = useAiConfig();
  const [value, setValue] = useState("");
  const [verifying, setVerifying] = useState(false);
  useNextKeys(pending && pending.result !== "accent" ? pending : null, onNext);
  const submit = async () => {
    const v = value.trim();
    if (!v || verifying) return;
    const det = checkTyped(v, drill.a);
    if (det !== "wrong") return onAnswer(det, v);
    const orthoHint = explainOrthographyError(v, drill.a);
    if (!orthoHint && ready.text(ai) && grammarTokenOverlap(v, drill.a) >= 0.45) {
      setVerifying(true);
      try {
        const eq = await checkGrammarEquivalence({
          kind: "transform",
          pointTitle: point.title,
          prompt: drill.h,
          sentenceContext: drill.q,
          expected: drill.a,
          answer: v,
        });
        if (eq.equivalent) return onAnswer("right", v, { aiNote: eq.why });
        if (eq.accentOnly) return onAnswer("accent", v, { aiNote: eq.why });
        return onAnswer("wrong", v, { aiNote: eq.why });
      } catch {
        /* fallback to deterministic verdict */
      } finally {
        setVerifying(false);
      }
    }
    onAnswer("wrong", v, { orthographyHint: orthoHint });
  };
  return (
    <>
      <p className="gram-hint gram-task">{drill.h}</p>
      <p className="gram-sentence gram-given" lang="fr">
        {drill.q}
        <Speak url={null} text={drill.q} size="sm" />
      </p>
      <FrenchInput value={pending ? pending.value : value} onChange={setValue} onSubmit={() => void submit()} disabled={!!pending || verifying} label="写出改好的句子" wide />
      {verifying && <p className="muted small">AI 正在静默核验等价句型转换…</p>}
      {pending && <Feedback point={point} drill={drill} pending={pending} onNext={onNext} onAmend={onAmend} />}
    </>
  );
}

function Summary({ data, log, graded, onExit }: { data: GrammarData; log: Answered[]; graded: Graded[]; onExit: () => void }) {
  useEffect(() => {
    if (store.get().settings.sfx) void cue("complete");
  }, []);
  const right = log.filter((l) => l.ok).length;
  const wrong = log.filter((l) => !l.ok);
  const weak = new Map<string, { point: GrammarPoint; tag: string; n: number }>();
  for (const { step } of wrong) {
    const point = data.points.find((p) => p.id === step.point)!;
    const tag = step.drill.g ?? "";
    const k = `${point.id}|${tag}`;
    weak.set(k, { point, tag, n: (weak.get(k)?.n ?? 0) + 1 });
  }
  return (
    <div className="page practice">
      <section className="panel typing-done">
        <p className="eyebrow">这一轮结束了</p>
        <h1 className="display">
          {right}/{log.length} <small>答对</small>
        </h1>
        <ul className="gram-result">
          {graded.map((g) => {
            const p = data.points.find((x) => x.id === g.id)!;
            return (
              <li key={g.id}>
                <a href={`#/grammar?p=${g.id}`}>{p.title}</a>
                <span>
                  {g.total - g.wrong}/{g.total}
                </span>
                <small>{g.grade === Rating.Good ? "掌握得不错" : g.grade === Rating.Hard ? "有一点小错" : "需要再练，很快会回来"}</small>
              </li>
            );
          })}
        </ul>
        {weak.size > 0 && (
          <div className="gram-weak">
            <p className="muted">错在这些地方（之后会多出这类题）：</p>
            <ul>
              {[...weak.values()]
                .sort((a, b) => b.n - a.n)
                .map(({ point, tag, n }) => (
                  <li key={point.id + tag}>
                    <span>{tag === ESSAY_TAG ? "你作文里的错句" : tagLabel(point, tag) || point.title}</span>
                    {graded.length > 1 && <small className="muted"> · {point.title}</small>}
                    <b>×{n}</b>
                  </li>
                ))}
            </ul>
          </div>
        )}
        {wrong.length > 0 && (
          <ul className="gram-wrong">
            {wrong.map(({ step }, k) => {
              const d = step.drill;
              return (
                <li key={k} lang="fr">
                  {d.k === "c" || d.k === "t" ? <Marked s={d.s} b={d.b} /> : d.k === "f" ? (d.r.length ? <Marked s={d.s} b={d.b} with={d.r[0]} /> : fixedOf(d)) : d.s}
                </li>
              );
            })}
          </ul>
        )}
        <p className="muted">每个语法点的下次复习时间已经排好。</p>
        <div className="summary-actions">
          <button className="btn btn-primary btn-xl" onClick={onExit} autoFocus>
            <RotateCcw size={18} /> 返回
          </button>
        </div>
      </section>
    </div>
  );
}
