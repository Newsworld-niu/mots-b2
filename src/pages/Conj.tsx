import { ArrowRight, Check, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtlas } from "../atlas/context";
import { useConj, type ConjData } from "../atlas/conj";
import { checkAnswer, distractorsFor, promptFor, TENSE_FR, TENSE_ZH, TENSES, tensesForLevel, type ConjTense, type ConjVerb } from "../lib/conjugation";
import { cue } from "../lib/sound";
import { hashSeed, shuffle } from "../lib/text";
import { answerConj, buildConjSession, conjGrade, conjPlan, type ConjStep } from "../store/conj";
import { Rating } from "../store/srs";
import { store, useStore } from "../store/store";
import { useKeys } from "./Learn";
import { ConjTable } from "../ui/ConjTable";
import { GrammarTabs } from "./Grammar";

const ACCENTS = ["é", "è", "ê", "à", "â", "ç", "î", "ï", "ô", "û", "ù", "ë", "œ"];

export function Conj() {
  const { data, error } = useConj();
  const [run, setRun] = useState<{ steps: ConjStep[]; key: number } | null>(null);
  if (error) return <div className="page"><p className="muted">{error}</p></div>;
  if (!data) return <div className="page learn-loading"><span className="spinner" /></div>;
  if (run) return <ConjSession key={run.key} data={data} initial={run.steps} onExit={() => setRun(null)} />;
  return <Overview data={data} onStart={(steps) => setRun({ steps, key: Date.now() })} />;
}

function Overview({ data, onStart }: { data: ConjData; onStart: (s: ConjStep[]) => void }) {
  const atlas = useAtlas();
  const progress = useStore((s) => s.progress);
  const settings = useStore((s) => s.settings);
  const plan = useMemo(() => conjPlan(atlas, progress, settings, data), [atlas, progress, settings, data]);
  const levelTenses = tensesForLevel(settings.startLevel);
  const toggle = (t: ConjTense) => {
    const cur = plan.tenses;
    const next = cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t];
    if (next.length) store.settings({ conjTenses: next });
  };
  const total = plan.due.length + plan.fresh.length;
  const started = Object.keys(progress.conj ?? {}).length;
  return (
    <div className="page conj">
      <header className="page-head">
        <GrammarTabs on="conj" />
        <p className="eyebrow">变位 · Conjugaison</p>
        <h1 className="display">动词，要变着用。</h1>
        <p className="lede">每个“动词 × 时态”是一张单独的复习卡。只有在每日学习里学过的动词才会出现在这里，不占用背单词的时间。</p>
      </header>
      <div className="practice-grid">
        <section className="panel">
          <dl className="mini-stats conj-stats">
            <div>
              <dt>可练动词</dt>
              <dd>{plan.verbs}</dd>
            </div>
            <div>
              <dt>待复习</dt>
              <dd>{plan.due.length}</dd>
            </div>
            <div>
              <dt>今日新卡</dt>
              <dd>{plan.fresh.length}</dd>
            </div>
          </dl>
          <h3 className="eyebrow">练哪些时态</h3>
          <div className="tense-chips">
            {TENSES.map((t) => (
              <button key={t} className={`chip-btn ${plan.tenses.includes(t) ? "is-on" : ""}`} onClick={() => toggle(t)} aria-pressed={plan.tenses.includes(t)}>
                <b lang="fr">{TENSE_FR[t]}</b>
                <small>{TENSE_ZH[t]}</small>
              </button>
            ))}
          </div>
          <p className="muted">
            {settings.conjTenses ? (
              <>
                已手动选择。{" "}
                <button className="link" onClick={() => store.settings({ conjTenses: null })}>
                  恢复按等级（{levelTenses.map((t) => TENSE_ZH[t]).join("、")}）
                </button>
              </>
            ) : (
              "按你的起点等级自动选择；点上面的时态可以自己调整。"
            )}
          </p>
          <button className="btn btn-primary btn-xl" disabled={!total} onClick={() => onStart(buildConjSession(atlas, progress, settings, data))}>
            {total ? `开始 · ${total} 张` : plan.verbs ? "今天的变位练完了" : "还没有可练的动词"}
          </button>
          {!plan.verbs && <p className="muted">先在「今日」学几个动词（être、avoir、faire 都在路线最前面），学过的动词会自动出现在这里。</p>}
        </section>
        <section className="panel practice-side">
          <h3 className="eyebrow">怎么练</h3>
          <ul className="conj-how">
            <li>新卡先四选一，熟了以后改成自己写。</li>
            <li>只写错重音（如 leve / lève）算“困难”，不算答错，并会提示。</li>
            <li>复合过去时要写助动词：用 être 的动词可以写阴性或复数形式。</li>
          </ul>
          <p className="muted">
            已开始 {started} 张卡 · 每天新卡上限{" "}
            <select value={settings.conjNew} onChange={(e) => store.settings({ conjNew: Number(e.target.value) })} aria-label="每天新卡上限">
              {[3, 6, 10, 15, 20].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </p>
          <p className="muted small">
            变位表由规则生成，并逐形对照 Lexique 3.83 的语料形式核对；有出入的动词暂不出题。
          </p>
        </section>
      </div>
    </div>
  );
}

type Result = { result: "right" | "accent" | "wrong"; value: string };

function ConjSession({ data, initial, onExit }: { data: ConjData; initial: ConjStep[]; onExit: () => void }) {
  const atlas = useAtlas();
  const settings = useStore((s) => s.settings);
  const [steps, setSteps] = useState(initial);
  const [i, setI] = useState(0);
  const [pending, setPending] = useState<Result | null>(null);
  const [log, setLog] = useState<{ step: ConjStep; ok: boolean }[]>([]);
  const started = useRef(performance.now());
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const step = steps[i];
  const done = i >= steps.length;

  const submit = useCallback(
    (value: string, accepted: string[]) => {
      if (pending || !step) return;
      const result = checkAnswer(value, accepted);
      const ms = performance.now() - started.current;
      if (settings.sfx) void cue(result === "wrong" ? "wrong" : "correct");
      setPending({ result, value });
      if (!step.retry) {
        const grade = conjGrade(result, ms, step.kind);
        answerConj(step, grade);
        setLog((l) => [...l, { step, ok: grade !== Rating.Again }]);
      }
      if (result === "wrong" && !step.retry) {
        // see it again a few cards later, as a choice, without grading
        setSteps((s) => {
          const n = [...s];
          n.splice(Math.min(n.length, i + 4), 0, { ...step, kind: "choice", retry: true });
          return n;
        });
      }
    },
    [pending, step, settings.sfx, i],
  );
  const next = useCallback(() => {
    setPending(null);
    started.current = performance.now();
    setI((n) => n + 1);
  }, []);

  if (done) return <ConjSummary log={log} data={data} onExit={onExit} />;
  const v = data.verbs[step.verbId];
  const ref = atlas.byId.get(step.verbId);
  return (
    <div className="page practice typing conj-run">
      <header className="typing-top">
        <button className="btn btn-ghost" onClick={onExit}>
          结束
        </button>
        <div className="learn-progress">
          <span style={{ width: `${(i / steps.length) * 100}%` }} />
        </div>
        <span className="typing-meter">
          <b>{i + 1}</b> / {steps.length}
        </span>
      </header>
      <ConjQuestion key={`${i}-${step.key}`} step={step} verb={v} zh={ref?.zh ?? ""} pending={pending} onSubmit={submit} onNext={next} />
    </div>
  );
}

function ConjQuestion({ step, verb, zh, pending, onSubmit, onNext }: { step: ConjStep; verb: ConjVerb; zh: string; pending: Result | null; onSubmit: (v: string, accepted: string[]) => void; onNext: () => void }) {
  const prompt = useMemo(() => promptFor(verb, step.tense, step.person), [verb, step]);
  const options = useMemo(() => {
    if (step.kind !== "choice") return [];
    const seed = hashSeed(step.key + step.person);
    return shuffle([prompt.shown, ...distractorsFor(verb, step.tense, step.person, seed)], seed);
  }, [step, verb, prompt]);
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, []);

  const keys: Record<string, () => void> = {};
  if (pending) {
    keys.Enter = onNext;
    keys[" "] = onNext;
  } else if (step.kind === "choice") options.forEach((o, k) => (keys[String(k + 1)] = () => onSubmit(o, prompt.accepted)));
  useKeys(keys);

  const insert = (ch: string) => {
    const el = input.current;
    if (!el) return setValue((x) => x + ch);
    const [a, b] = [el.selectionStart ?? value.length, el.selectionEnd ?? value.length];
    const next = value.slice(0, a) + ch + value.slice(b);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus({ preventScroll: true });
      el.setSelectionRange(a + ch.length, a + ch.length);
    });
  };
  const joiner = prompt.before.endsWith("'") ? "" : " ";
  const inf = verb.p ? (/^[aeiouyhéèêâîôû]/.test(verb.i) ? `s'${verb.i}` : `se ${verb.i}`) : verb.i;

  return (
    <section className="typing-stage conj-stage">
      <p className="stage-label">
        <span className={`dot ${step.retry ? "dot-retry" : step.isNew ? "dot-new" : "dot-review"}`} />
        {step.retry ? "再练一次 · " : step.isNew ? "新卡 · " : ""}
        <span lang="fr">{TENSE_FR[step.tense]}</span> · {TENSE_ZH[step.tense]}
      </p>
      <div className="conj-prompt">
        <p className="conj-inf" lang="fr">
          {inf}
        </p>
        <p className="conj-zh">{zh}</p>
        <p className="conj-line" lang="fr">
          <span className="conj-subject">{prompt.before}</span>
          {joiner}
          <span className={`conj-blank ${pending ? `is-${pending.result}` : ""}`}>{pending ? prompt.shown : " "}</span>
        </p>
      </div>

      {step.kind === "choice" ? (
        <ul className="options conj-options">
          {options.map((o, k) => {
            const isAnswer = prompt.accepted.includes(o.toLowerCase()) || o === prompt.shown;
            const chosen = pending?.value === o;
            const cls = pending ? (isAnswer ? "is-answer" : chosen ? "is-chosen" : "is-dim") : "";
            return (
              <li key={o}>
                <button className={`option ${cls}`} onClick={() => onSubmit(o, prompt.accepted)} disabled={!!pending}>
                  <kbd>{k + 1}</kbd>
                  <span lang="fr">{o}</span>
                  {pending && isAnswer && <Check size={20} className="option-mark" />}
                  {pending && chosen && !isAnswer && <X size={20} className="option-mark" />}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <form
          className="conj-type"
          onSubmit={(e) => {
            e.preventDefault();
            if (!pending && value.trim()) onSubmit(value, prompt.accepted);
          }}
        >
          <input
            ref={input}
            className="conj-input"
            value={pending ? pending.value : value}
            onChange={(e) => !pending && setValue(e.target.value)}
            readOnly={!!pending}
            lang="fr"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="done"
            aria-label={`写出 ${prompt.before} 的形式`}
          />
          {!pending && (
            <>
              <div className="accent-keys" aria-label="法语字母">
                {ACCENTS.map((ch) => (
                  <button key={ch} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(ch)} lang="fr">
                    {ch}
                  </button>
                ))}
              </div>
              <button type="submit" className="btn btn-primary" disabled={!value.trim()}>
                确认 <kbd>Enter</kbd>
              </button>
            </>
          )}
        </form>
      )}

      {pending && (
        <div className={`conj-feedback is-${pending.result}`} role="status">
          <p className="feedback-verdict">{pending.result === "right" ? "答对了" : pending.result === "accent" ? "字母对了，注意重音" : "没关系，记住它"}</p>
          <p className="conj-answer" lang="fr">
            {prompt.before}
            {joiner}
            <b>{prompt.shown}</b>
            {step.tense === "pc" && (verb.a === "ae" && !verb.p ? <small>（不及物用 être；带宾语时用 avoir）</small> : null)}
          </p>
          <ConjTable verb={verb} tense={step.tense} highlight={step.person} />
          <button className={`btn btn-xl ${pending.result === "wrong" ? "btn-terra" : "btn-sage"}`} onClick={onNext} autoFocus>
            继续 <ArrowRight size={20} />
          </button>
        </div>
      )}
    </section>
  );
}

function ConjSummary({ log, data, onExit }: { log: { step: ConjStep; ok: boolean }[]; data: ConjData; onExit: () => void }) {
  const right = log.filter((l) => l.ok).length;
  const wrong = log.filter((l) => !l.ok);
  useEffect(() => {
    if (store.get().settings.sfx) void cue("complete");
  }, []);
  return (
    <div className="page practice">
      <section className="panel typing-done">
        <p className="eyebrow">这一轮结束了</p>
        <h1 className="display">
          {right}/{log.length} <small>首次正确</small>
        </h1>
        {wrong.length > 0 && (
          <ul className="gender-wrong">
            {wrong.map(({ step }) => (
              <li key={step.key} lang="fr">
                {data.verbs[step.verbId].i} <small lang="zh">{TENSE_ZH[step.tense]}</small>
              </li>
            ))}
          </ul>
        )}
        <p className="muted">每张卡的下次复习时间已经排好。答错的会更早回来。</p>
        <div className="summary-actions">
          <button className="btn btn-primary btn-xl" onClick={onExit} autoFocus>
            <RotateCcw size={18} /> 返回变位
          </button>
        </div>
      </section>
    </div>
  );
}
