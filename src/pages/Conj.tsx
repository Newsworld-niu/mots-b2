import { ArrowRight, Check, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtlas } from "../atlas/context";
import { useConj, type ConjData } from "../atlas/conj";
import { B2_HIGH_FREQ_TENSES, checkAnswer, distractorsFor, isCompoundTense, promptFor, PRONOUNS, TENSE_FR, TENSE_ZH, TENSES, tensesForLevel, type ConjTense, type ConjVerb } from "../lib/conjugation";
import { checkContextConjugation, CONTEXT_CONJ_ITEMS, type ContextConjItem } from "../lib/conj-context";
import { cue } from "../lib/sound";
import { hashSeed, shuffle } from "../lib/text";
import { answerConj, B2_CORE_IRREGULAR_VERBS, buildConjSession, conjGrade, conjPlan, recordContextConjAttempt, repeatConj, startedConjVerbs, splitKey, type ConjStep } from "../store/conj";
import { Rating } from "../store/srs";
import { MAX_DAILY_NEW, store, useStore, useStoreShallow } from "../store/store";
import { useKeys } from "../lib/keys";
import { useNavGuard } from "../lib/nav-guard";
import { AccentKeys } from "../ui/AccentKeys";
import { confirmAction } from "../ui/ConfirmSheet";
import { ConjTable } from "../ui/ConjTable";
import { GrammarTabs } from "./Grammar";
import { PRACTICE_SOURCES, sourceWordIds, type PracticeSource } from "../lib/practice-source";
import { PracticeSourcePicker } from "../ui/PracticeSource";

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
  const [ctxRun, setCtxRun] = useState<{ items: ContextConjItem[]; key: number } | null>(null);
  if (error) return <div className="page"><p className="muted">{error}</p></div>;
  if (!data) return <div className="page learn-loading"><span className="spinner" /></div>;
  if (ctxRun) return <ContextConjSession key={ctxRun.key} data={data} initial={ctxRun.items} onExit={() => setCtxRun(null)} />;
  if (run) return <ConjSession key={run.key} data={data} initial={run.steps} onExit={() => setRun(null)} />;
  return <Overview data={data} onStart={(steps) => setRun({ steps, key: Date.now() })} onStartContext={(items) => setCtxRun({ items, key: Date.now() })} />;
}

function Overview({
  data,
  onStart,
  onStartContext,
}: {
  data: ConjData;
  onStart: (s: ConjStep[]) => void;
  onStartContext: (items: ContextConjItem[]) => void;
}) {
  const atlas = useAtlas();
  const progress = useStoreShallow((s) => ({
    cards: s.progress.cards,
    decks: s.progress.decks,
    hidden: s.progress.hidden,
    coreMigrated: s.progress.coreMigrated,
    mistakes: s.progress.mistakes,
    bookmarks: s.progress.bookmarks,
    conj: s.progress.conj,
    conjDays: s.progress.conjDays,
  }));
  const settings = useStore((s) => s.settings);
  const [mode, setMode] = useState<"drill" | "context">("drill");
  const [ctxScope, setCtxScope] = useState<"all" | "b2">("all");
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
  const b2CoreIds = useMemo(
    () =>
      settings.startLevel >= 3
        ? atlas.words
            .filter((w) => {
              const v = data.verbs[w.id];
              return Boolean(v && B2_CORE_IRREGULAR_VERBS.has(v.i));
            })
            .map((w) => w.id)
        : [],
    [atlas, data, settings.startLevel],
  );
  const verbs = useMemo(() => {
    const base = sourceWordIds(atlas, progress, source, settings.startLevel, chosenDecks).filter((id) => data.verbs[id]);
    if (settings.startLevel >= 3 && (source === "recent" || source === "path")) {
      return [...new Set([...base, ...b2CoreIds])];
    }
    return base;
  }, [atlas, progress, source, settings.startLevel, chosenDecks, data, b2CoreIds]);
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
          <div className="segmented conj-mode-switch" role="tablist" aria-label="变位训练模式">
            <button type="button" role="tab" aria-selected={mode === "drill"} className={mode === "drill" ? "is-on" : ""} onClick={() => setMode("drill")}>
              单词变位刷题
            </button>
            <button type="button" role="tab" aria-selected={mode === "context"} className={mode === "context" ? "is-on" : ""} onClick={() => setMode("context")}>
              语境判时态+变位（{CONTEXT_CONJ_ITEMS.length} 题）
            </button>
          </div>
          {mode === "context" ? (
            <div className="conj-ctx-launch">
              <p className="muted">
                不提前告诉你用什么时态：先根据句子时间标志、si 条件或虚拟式触发词选出正确时态，再手写出准确变位（完整覆盖 12 种时态）。
              </p>
              <div className="segmented segmented-wide" role="group" aria-label="语境题目范围">
                <button type="button" className={ctxScope === "all" ? "is-on" : ""} onClick={() => setCtxScope("all")}>
                  全部 {CONTEXT_CONJ_ITEMS.length} 题（覆盖全部 12 时态与配合）
                </button>
                <button type="button" className={ctxScope === "b2" ? "is-on" : ""} onClick={() => setCtxScope("b2")}>
                  仅 B2 核心难点（{CONTEXT_CONJ_ITEMS.filter((x) => x.level === "B2").length} 题）
                </button>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-xl"
                onClick={() =>
                  onStartContext(
                    ctxScope === "b2"
                      ? CONTEXT_CONJ_ITEMS.filter((x) => x.level === "B2")
                      : [...CONTEXT_CONJ_ITEMS],
                  )
                }
              >
                开始语境判时态 + 变位（{ctxScope === "b2" ? CONTEXT_CONJ_ITEMS.filter((x) => x.level === "B2").length : CONTEXT_CONJ_ITEMS.length} 题） <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            <>
          <PracticeSourcePicker source={source} onSource={setSource} decks={deckList} chosenDecks={chosenDecks} onDeck={toggleDeck} />
          <p className="muted">{source === "decks" ? "所选卡组" : source === "path" ? "起点等级起的前 400 个词" : "当前来源"}里有 {plan.verbs} 个带已核对变位表的动词。</p>
          {settings.startLevel >= 3 && b2CoreIds.length > 0 && (source === "recent" || source === "path") && (
            <p className="muted small">B2 起点已自动预解锁 {b2CoreIds.length} 个核心不规则动词（含命令式），可直接开练。</p>
          )}
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
          <button className="btn btn-primary btn-xl" disabled={!total} onClick={() => onStart(buildConjSession(atlas, progress, settings, data, verbs))}>
            {total ? `开始 · ${plan.sessionVerbs} 张动词卡 / ${total} 题` : plan.verbs ? "今天的变位练完了" : "还没有可练的动词"}
          </button>
          {!plan.verbs && <p className="muted">{source === "decks" && !chosenDecks.length ? "请先选择至少一个卡组。" : "这个来源还没有带已核对变位表的动词，换个来源或卡组试试。"}</p>}
          {!!plan.verbs && !total && <p className="muted">当前来源暂无待复习卡；每日新动词卡上限在所有来源间共用，可以调整右侧上限或稍后再练。</p>}

          <div className="panel-head conj-tense-head">
            <h2 className="eyebrow">练哪些时态</h2>
            <div className="data-actions">
              <button type="button" className="link small" onClick={() => store.settings({ conjTenses: null })}>
                高频 B2（{levelTenses.length} 个）
              </button>
              <button type="button" className="link small" onClick={() => store.settings({ conjTenses: [...TENSES] })}>
                全选 12 时态
              </button>
            </div>
          </div>
          <div className="tense-chips">
            {B2_HIGH_FREQ_TENSES.map((t) => (
              <button key={t} className={`chip-btn ${plan.tenses.includes(t) ? "is-on" : ""}`} onClick={() => toggle(t)} aria-pressed={plan.tenses.includes(t)}>
                <b lang="fr">{TENSE_FR[t]}</b>
                <small>{TENSE_ZH[t]}</small>
              </button>
            ))}
          </div>
          <details
            className="conj-more-tenses"
            open={TENSES.some((t) => !B2_HIGH_FREQ_TENSES.includes(t) && plan.tenses.includes(t))}
          >
            <summary className="conj-more-summary">
              <span>展开进阶 / 复合时态与命令式（{TENSES.length - B2_HIGH_FREQ_TENSES.length} 个）</span>
            </summary>
            <div className="tense-chips">
              {TENSES.filter((t) => !B2_HIGH_FREQ_TENSES.includes(t)).map((t) => (
                <button key={t} className={`chip-btn ${plan.tenses.includes(t) ? "is-on" : ""}`} onClick={() => toggle(t)} aria-pressed={plan.tenses.includes(t)}>
                  <b lang="fr">{TENSE_FR[t]}</b>
                  <small>{TENSE_ZH[t]}</small>
                </button>
              ))}
            </div>
          </details>
          <p className="muted">
            {settings.conjTenses ? (
              <>
                已手动选择 {plan.tenses.length} 个时态。{" "}
                <button className="link" onClick={() => store.settings({ conjTenses: null })}>
                  恢复默认（{levelTenses.map((t) => TENSE_ZH[t]).join("、")}）
                </button>
              </>
            ) : (
              "默认聚焦当前等级高频核心时态，题量约 40 题，上方按钮可直接开练。"
            )}
          </p>
            </>
          )}
        </section>
        <section className="panel practice-side">
          <h2 className="eyebrow">怎么练</h2>
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
  const active = !done && (i > 0 || log.length > 0 || !!pending);
  useNavGuard(active, "本轮动词变位练习尚未结束，确定提前离开？");

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

  const exitSession = async () => {
    if (
      active &&
      !(await confirmAction({
        title: "结束本轮变位练习？",
        message: "当前一轮还有未完成的题（已答人称已保存），确定提前退出？",
        confirmLabel: "确定退出",
        danger: true,
      }))
    ) {
      return;
    }
    onExit();
  };

  if (done) return <ConjSummary log={log} data={data} onExit={onExit} />;
  const v = data.verbs[step.verbId];
  const ref = atlas.byId.get(step.verbId);
  return (
    <div className="page practice typing conj-run">
      <header className="typing-top">
        <button className="btn btn-ghost" onClick={() => void exitSession()}>
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
              <AccentKeys input={input} value={value} onChange={setValue} />
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

function ContextConjSession({ data, initial, onExit }: { data: ConjData; initial: ContextConjItem[]; onExit: () => void }) {
  const atlas = useAtlas();
  const sfx = useStore((s) => s.settings.sfx);
  const [items, setItems] = useState(initial);
  const [idx, setIdx] = useState(0);
  const [pickedTense, setPickedTense] = useState<ConjTense | null>(null);
  const [typedForm, setTypedForm] = useState("");
  const [verdict, setVerdict] = useState<ReturnType<typeof checkContextConjugation> | null>(null);
  const [accentRetry, setAccentRetry] = useState("");
  const [accentRetriedOk, setAccentRetriedOk] = useState(false);
  const [missed, setMissed] = useState<ContextConjItem[]>([]);
  const [score, setScore] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const retryRef = useRef<HTMLInputElement>(null);

  const item = items[idx];
  const finished = idx >= items.length;
  useNavGuard(!finished && (idx > 0 || pickedTense !== null || typedForm.trim().length > 0), "语境时态判断练习尚未结束，确定离开？");

  useEffect(() => {
    setPickedTense(null);
    setTypedForm("");
    setVerdict(null);
    setAccentRetry("");
    setAccentRetriedOk(false);
    inputRef.current?.focus({ preventScroll: true });
  }, [idx, items]);

  const needsAccentRetype = Boolean(verdict && verdict.tenseOk && verdict.accentOnly && !accentRetriedOk);
  const advanceNext = useCallback(() => {
    if (verdict && !needsAccentRetype) setIdx((n) => n + 1);
  }, [verdict, needsAccentRetype]);
  useKeys(verdict && !needsAccentRetype ? { Enter: advanceNext } : {});

  if (finished) {
    return (
      <div className="page practice">
        <section className="panel typing-done">
          <p className="eyebrow">语境判时态 + 变位完成</p>
          <h1 className="display">
            {score}/{items.length} <small>时态与变位双对</small>
          </h1>
          <p className="muted small">匹配的动词变位已同步更新至 FSRS 动词复习计划与今日变位统计。</p>
          {missed.length > 0 && (
            <ul className="gender-wrong">
              {missed.map((m) => (
                <li key={m.id}>
                  <span lang="fr">
                    {m.verb} → <b>{m.answers[0]}</b>
                  </span>{" "}
                  <small>
                    （{TENSE_FR[m.tense]} · {TENSE_ZH[m.tense]}）
                  </small>
                </li>
              ))}
            </ul>
          )}
          <div className="summary-actions">
            {missed.length > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setItems(missed);
                  setMissed([]);
                  setScore(0);
                  setIdx(0);
                }}
              >
                <RotateCcw size={16} /> 重练错题（{missed.length}）
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={onExit}>
              返回变位总览
            </button>
          </div>
        </section>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verdict || !pickedTense || !typedForm.trim()) return;
    const res = checkContextConjugation(item, pickedTense, typedForm);
    setVerdict(res);
    const fullOk = res.tenseOk && res.formOk;
    const isAccentHard = res.tenseOk && res.accentOnly;
    recordContextConjAttempt(
      data,
      {
        verb: item.verb,
        tense: item.tense,
        person: item.person,
        tenseOk: res.tenseOk,
        formOk: res.formOk,
        accentOnly: res.accentOnly,
      },
      atlas,
    );
    if (fullOk) setScore((n) => n + 1);
    else if (!isAccentHard) setMissed((prev) => (prev.some((x) => x.id === item.id) ? prev : [...prev, item]));
    if (sfx) void cue(fullOk || isAccentHard ? "correct" : "wrong");
  };

  const blankTone = verdict
    ? verdict.tenseOk && verdict.formOk
      ? "is-right"
      : verdict.tenseOk && verdict.accentOnly
        ? "is-accent"
        : "is-wrong"
    : "";

  return (
    <div className="page practice typing conj-run">
      <header className="typing-top">
        <button className="btn btn-ghost" type="button" onClick={onExit}>
          结束
        </button>
        <div className="learn-progress">
          <span style={{ width: `${(idx / items.length) * 100}%` }} />
        </div>
        <span className="typing-meter">
          <b>{idx + 1}</b> / {items.length}
        </span>
      </header>

      <section className="typing-stage conj-stage conj-ctx-card">
        <p className="stage-label">
          <span className="chip">{item.level}</span> 第 {idx + 1} 题 · 先选时态再填动词形式
        </p>
        <div className="conj-prompt">
          <p className="conj-inf" lang="fr">
            {item.verb} <small className="muted" lang="zh">({item.hintZh})</small>
          </p>
          <p className="conj-line" lang="fr">
            {item.before}
            <span className={`conj-blank ${blankTone}`}>
              {verdict ? (needsAccentRetype ? typedForm : verdict.canonical) : typedForm || "\u00a0"}
            </span>
            {item.after}
          </p>
        </div>

        <form className="conj-ctx-form" onSubmit={submit}>
          <div>
            <p className="eyebrow">第一步：根据语境选择时态 / 语式</p>
            <div className="tense-chips">
              {item.tenseChoices.map((t) => {
                const chosen = pickedTense === t;
                const cls = verdict
                  ? t === item.tense
                    ? "is-answer"
                    : chosen
                      ? "is-chosen"
                      : ""
                  : chosen
                    ? "is-on"
                    : "";
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={!!verdict}
                    className={`chip-btn ${cls}`}
                    aria-pressed={chosen}
                    onClick={() => setPickedTense(t)}
                  >
                    <b lang="fr">{TENSE_FR[t]}</b>
                    <small>{TENSE_ZH[t]}</small>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="conj-type">
            <p className="eyebrow">第二步：写出动词准确变位（含助动词/配合，如 sont nées）</p>
            <input
              ref={inputRef}
              className="conj-input"
              value={verdict ? typedForm : typedForm}
              onChange={(e) => !verdict && setTypedForm(e.target.value)}
              readOnly={!!verdict}
              lang="fr"
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              placeholder={item.pronoun ? `匹配 ${item.pronoun}` : "写出变位形式"}
              aria-label={`写出 ${item.verb} 的变位`}
            />
            {!verdict && (
              <>
                <AccentKeys input={inputRef} value={typedForm} onChange={setTypedForm} />
                <button type="submit" className="btn btn-primary" disabled={!pickedTense || !typedForm.trim()}>
                  确认提交 <ArrowRight size={16} />
                </button>
              </>
            )}
          </div>
        </form>

        {verdict && (() => {
          const needsAccentRetype = verdict.tenseOk && verdict.accentOnly && !accentRetriedOk;
          return (
            <div className={`conj-feedback is-${verdict.tenseOk && verdict.formOk ? "right" : verdict.tenseOk && verdict.accentOnly ? "accent" : "wrong"}`} role="status">
              <p className="feedback-verdict">
                {verdict.tenseOk && verdict.formOk
                  ? "时态判断与变位完全正确！"
                  : verdict.tenseOk && verdict.accentOnly
                    ? `重音微瑕，请按正确重音「${verdict.canonical}」重敲一遍再继续！`
                    : `时态${verdict.tenseOk ? "选对了" : `应为 ${TENSE_FR[item.tense]}（${TENSE_ZH[item.tense]}）`} · 变位应为 ${verdict.canonical}`}
              </p>
              {verdict.orthographyHint && <p className="warn small">{verdict.orthographyHint}</p>}
              <p className="muted small">{item.why}</p>
              {verdict.tenseOk && verdict.accentOnly && (
                accentRetriedOk ? (
                  <p className="muted small">已按正确重音重输巩固 ✓（按困难档记入 FSRS）</p>
                ) : (
                  <form
                    className="gram-almost-retry"
                    onSubmit={(ev) => {
                      ev.preventDefault();
                      if (checkAnswer(accentRetry, [...item.answers]) === "right") {
                        setAccentRetriedOk(true);
                        setScore((n) => n + 1);
                      }
                    }}
                  >
                    <input
                      ref={retryRef}
                      className="conj-input"
                      value={accentRetry}
                      onChange={(ev) => setAccentRetry(ev.target.value)}
                      placeholder={`重敲一遍：${verdict.canonical}`}
                      aria-label="按正确重音重输变位"
                      lang="fr"
                      autoFocus
                    />
                    <AccentKeys input={retryRef} value={accentRetry} onChange={setAccentRetry} />
                    <button type="submit" className="btn btn-ghost btn-sm" disabled={!accentRetry.trim()}>
                      核对重输
                    </button>
                  </form>
                )
              )}
              <button
                type="button"
                className="btn btn-primary btn-xl"
                disabled={needsAccentRetype}
                onClick={() => setIdx((n) => n + 1)}
                autoFocus={!needsAccentRetype}
              >
                {idx + 1 >= items.length ? "查看本轮结果" : "下一题"} <ArrowRight size={18} />
              </button>
            </div>
          );
        })()}
      </section>
    </div>
  );
}
