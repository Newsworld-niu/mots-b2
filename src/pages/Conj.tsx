import { ArrowRight, Check, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtlas } from "../atlas/context";
import { useConj, type ConjData } from "../atlas/conj";
import { checkAnswer, distractorsFor, isCompoundTense, promptFor, PRONOUNS, TENSE_FR, TENSE_ZH, TENSES, tensesForLevel, type ConjTense, type ConjVerb } from "../lib/conjugation";
import { cue } from "../lib/sound";
import { hashSeed, shuffle } from "../lib/text";
import { answerConj, buildConjSession, conjGrade, conjPlan, repeatConj, startedConjVerbs, splitKey, type ConjStep } from "../store/conj";
import { Rating } from "../store/srs";
import { MAX_DAILY_NEW, store, useStore } from "../store/store";
import { useKeys } from "./Learn";
import { ConjTable } from "../ui/ConjTable";
import { GrammarTabs } from "./Grammar";
import { PRACTICE_SOURCES, sourceWordIds, type PracticeSource } from "../lib/practice-source";
import { PracticeSourcePicker } from "../ui/PracticeSource";

const ACCENTS = ["é", "è", "ê", "à", "â", "ç", "î", "ï", "ô", "û", "ù", "ë", "œ"];
const PREF = "word-atlas:conj:";
function readPref(key: string): string | null {
  try { return localStorage.getItem(PREF + key); } catch { return null; }
}
function writePref(key: string, value: string) {
  try { localStorage.setItem(PREF + key, value); } catch { /* optional device preference */ }
}

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
  const [newLimit, setNewLimit] = useState(String(settings.conjNew));
  useEffect(() => setNewLimit(String(settings.conjNew)), [settings.conjNew]);
  const saveNewLimit = () => {
    const n = newLimit.trim() ? Number(newLimit) : NaN;
    const value = Number.isFinite(n) ? Math.min(MAX_DAILY_NEW, Math.max(0, Math.round(n))) : settings.conjNew;
    setNewLimit(String(value));
    if (value !== settings.conjNew) store.settings({ conjNew: value });
  };
  const [source, setSourceState] = useState<PracticeSource>(() => {
    const kept = readPref("source");
    return PRACTICE_SOURCES.find(([key]) => key === kept)?.[0] ?? (Object.keys(progress.cards).length ? "recent" : "path");
  });
  const setSource = (next: PracticeSource) => { setSourceState(next); writePref("source", next); };
  // null means all decks by default; an explicit empty selection means no decks.
  const [deckSel, setDeckSel] = useState<string[] | null>(() => {
    try {
      const kept: unknown = JSON.parse(readPref("decks") ?? "null");
      return Array.isArray(kept) && kept.every(id => typeof id === "string") ? kept : null;
    } catch { return null; }
  });
  const deckList = useMemo(() => (progress.decks ?? []).map(d => ({ id: d.id, name: d.name })), [progress.decks]);
  const chosenDecks = useMemo(() => deckSel === null ? deckList.map(d => d.id) : deckSel.filter(id => deckList.some(d => d.id === id)), [deckSel, deckList]);
  const toggleDeck = (id: string) => {
    const next = chosenDecks.includes(id) ? chosenDecks.filter(x => x !== id) : [...chosenDecks, id];
    setDeckSel(next); writePref("decks", JSON.stringify(next));
  };
  const verbs = useMemo(() => sourceWordIds(atlas, progress, source, settings.startLevel, chosenDecks).filter(id => data.verbs[id]), [atlas, progress, source, settings.startLevel, chosenDecks, data]);
  const plan = useMemo(() => conjPlan(atlas, progress, settings, data, verbs), [atlas, progress, settings, data, verbs]);
  const levelTenses = tensesForLevel(settings.startLevel);
  const toggle = (t: ConjTense) => {
    const cur = plan.tenses;
    const next = cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t];
    if (next.length) store.settings({ conjTenses: next });
  };
  const total = plan.due.length + plan.fresh.length;
  const started = startedConjVerbs(progress).size;
  return (
    <div className="page conj">
      <header className="page-head">
        <GrammarTabs on="conj" />
        <p className="eyebrow">变位 · Conjugaison</p>
        <h1 className="display">动词，要变着用。</h1>
        <p className="lede">选择想练的词源和时态，每张卡对应一个动词，按所选时态展开各人称的填空题，各形式独立记录进度。可以直接练收藏或卡组里的动词，不占用背单词的时间。</p>
      </header>
      <div className="practice-grid">
        <section className="panel">
          <PracticeSourcePicker source={source} onSource={setSource} decks={deckList} chosenDecks={chosenDecks} onDeck={toggleDeck} />
          <p className="muted">{source === "decks" ? "所选卡组" : source === "path" ? "起点等级起的前 400 个词" : "当前来源"}里有 {plan.verbs} 个带已核对变位表的动词。</p>
          <dl className="mini-stats conj-stats">
            <div>
              <dt>可练动词</dt>
              <dd>{plan.verbs}</dd>
            </div>
            <div>
              <dt>待复习动词</dt>
              <dd>{plan.dueVerbs}</dd>
            </div>
            <div>
              <dt>今日新动词卡</dt>
              <dd>{plan.newVerbs}</dd>
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
          <button className="btn btn-primary btn-xl" disabled={!total} onClick={() => onStart(buildConjSession(atlas, progress, settings, data, verbs))}>
            {total ? `开始 · ${plan.sessionVerbs} 张动词卡 / ${total} 题` : plan.verbs ? "今天的变位练完了" : "还没有可练的动词"}
          </button>
          {!plan.verbs && <p className="muted">{source === "decks" && !chosenDecks.length ? "请先选择至少一个卡组。" : "这个来源还没有带已核对变位表的动词，换个来源或卡组试试。"}</p>}
          {!!plan.verbs && !total && <p className="muted">当前来源暂无待复习卡；每日新动词卡上限在所有来源间共用，可以调整右侧上限或稍后再练。</p>}
        </section>
        <section className="panel practice-side">
          <h3 className="eyebrow">怎么练</h3>
          <ul className="conj-how">
            <li>按动词卡数量选词，每个新动词覆盖勾选的所有时态和人称；各形式独立记录进度。</li>
            <li>可以先看表或用选择题辅助；之后仍需填空验证。错题隔几题再次填空，直到答对。</li>
            <li>只写错重音（如 leve / lève）算“困难”，不算答错，并会提示。</li>
            <li>复合过去时要写助动词：用 être 的动词可以写阴性或复数形式。</li>
          </ul>
          <p className="muted">
            已开始 {started} 张动词卡 · 每日新动词卡上限{" "}
            <input className="conj-new-limit" type="number" inputMode="numeric" min={0} max={MAX_DAILY_NEW} step={1} value={newLimit} onChange={e => setNewLimit(e.target.value)} onBlur={saveNewLimit} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} aria-label="每日新动词卡上限" />
            {" "}张
          </p>
          {!!Object.keys(progress.conj ?? {}).some(k => splitKey(k).person === undefined) && <p className="muted small">旧版按时态保存的记录已保留。由于未记录具体人称，各人称将从首次填空开始独立安排复习。</p>}
          <p className="muted small">例如 1 张动词卡 × 2 个时态 × 6 个人称 = 12 道题。未完成的人称和新勾选的时态可继续练，不重复占用新动词额度。</p>
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
      if (!step.retry && step.kind === "type") {
        const grade = conjGrade(result, ms, step.kind);
        answerConj(step, grade);
        setLog((l) => [...l, { step, ok: grade !== Rating.Again }]);
      }
      if (step.kind === "choice") {
        // Assistance never advances memory; a typed answer is still required.
        setSteps(s => repeatConj(s, i, step, !!step.retry));
      } else if (result !== "right") {
        setSteps(s => repeatConj(s, i, step));
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
      <ConjQuestion key={`${i}-${step.key}`} step={step} verb={v} zh={ref?.zh ?? ""} pending={pending} onAssist={() => setSteps(s => s.map((q, n) => n === i ? { ...q, kind: "choice" } : q))} onSubmit={submit} onNext={next} />
    </div>
  );
}

function ConjQuestion({ step, verb, zh, pending, onAssist, onSubmit, onNext }: { step: ConjStep; verb: ConjVerb; zh: string; pending: Result | null; onAssist: () => void; onSubmit: (v: string, accepted: string[]) => void; onNext: () => void }) {
  const prompt = useMemo(() => promptFor(verb, step.tense, step.person), [verb, step]);
  const options = useMemo(() => {
    if (step.kind !== "choice") return [];
    const seed = hashSeed(step.key + step.person);
    return shuffle([prompt.shown, ...distractorsFor(verb, step.tense, step.person, seed)], seed);
  }, [step, verb, prompt]);
  const [value, setValue] = useState("");
  const [preview, setPreview] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, []);

  const keys: Record<string, () => void> = {};
  if (pending) {
    keys.Enter = onNext;
    keys[" "] = onNext;
  } else if (step.kind === "choice") options.forEach((o, k) => (keys[String(k + 1)] = () => onSubmit(o === prompt.shown ? prompt.accepted[0] : o, prompt.accepted)));
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
  const joiner = !prompt.before || prompt.before.endsWith("'") ? "" : " ";
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

      {!pending && step.kind === "type" && !step.retry && (
        <div className="conj-help">
          {step.isNew && <button className="btn btn-ghost" onClick={() => setPreview(!preview)}>{preview ? "收起变位表，开始填空" : "先看变位表"}</button>}
          <button className="btn btn-ghost" onClick={() => { setPreview(false); onAssist(); }}>选择题辅助（之后仍需填空）</button>
          {preview && <ConjTable verb={verb} tense={step.tense} highlight={step.person} />}
        </div>
      )}
      {step.kind === "choice" ? (
        <ul className="options conj-options">
          {options.map((o, k) => {
            const isAnswer = prompt.accepted.includes(o.toLowerCase()) || o === prompt.shown;
            const chosen = pending?.value === o;
            const cls = pending ? (isAnswer ? "is-answer" : chosen ? "is-chosen" : "is-dim") : "";
            return (
              <li key={o}>
                <button className={`option ${cls}`} onClick={() => onSubmit(o === prompt.shown ? prompt.accepted[0] : o, prompt.accepted)} disabled={!!pending}>
                  <kbd>{k + 1}</kbd>
                  <span lang="fr">{o}</span>
                  {pending && isAnswer && <Check size={20} className="option-mark" />}
                  {pending && chosen && !isAnswer && <X size={20} className="option-mark" />}
                </button>
              </li>
            );
          })}
        </ul>
      ) : !preview ? (
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
      ) : null}

      {pending && (
        <div className={`conj-feedback is-${pending.result}`} role="status">
          <p className="feedback-verdict">{pending.result === "right" ? "答对了" : pending.result === "accent" ? "字母对了，注意重音" : "没关系，记住它"}</p>
          <p className="conj-answer" lang="fr">
            {prompt.before}
            {joiner}
            <b>{prompt.shown}</b>
            {isCompoundTense(step.tense) && (verb.a === "ae" && !verb.p ? <small>（不及物用 être；带宾语时用 avoir）</small> : null)}
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
                {data.verbs[step.verbId].i} <small lang="zh">{TENSE_ZH[step.tense]}{step.tense === "ppres" ? "" : ` · ${PRONOUNS[step.person]}`}</small>
              </li>
            ))}
          </ul>
        )}
        <p className="muted">每个变位形式的下次复习时间已经独立排好。答错的会更早回来。</p>
        <div className="summary-actions">
          <button className="btn btn-primary btn-xl" onClick={onExit} autoFocus>
            <RotateCcw size={18} /> 返回变位
          </button>
        </div>
      </section>
    </div>
  );
}
