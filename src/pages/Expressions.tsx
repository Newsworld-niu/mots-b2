import { ArrowRight, BookText, Check, Lightbulb, RotateCcw, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { stopAudio } from "../lib/audio";
import { checkExpr, EXPR_BY_ID, EXPR_GROUPS, EXPRESSIONS, filledEx, gapOf, maskOf, type ExprGroup, type ExprVerdict, type Expression } from "../lib/expressions";
import { readPureFr, writePureFr } from "../lib/pure-fr";
import { cue } from "../lib/sound";
import { answerExpr, dueExpr, exprCounts, exprGrade, exprRound, freshExpr, EXPR_NEW } from "../store/expr";
import { Rating, type Grade } from "../store/srs";
import { store, useStore } from "../store/store";
import { useNavGuard } from "../lib/nav-guard";
import { AccentKeys } from "../ui/AccentKeys";
import { confirmAction } from "../ui/ConfirmSheet";
import { Speak } from "../ui/Speak";
import "../styles/expressions.css";

/** The group chosen last time on this device ("" = all groups). */
const GROUP_PREF = "word-atlas:expr:group";
const readGroup = (): ExprGroup | null => {
  try {
    const v = localStorage.getItem(GROUP_PREF);
    return EXPR_GROUPS.some(([k]) => k === v) ? (v as ExprGroup) : null;
  } catch {
    return null;
  }
};
const writeGroup = (g: ExprGroup | null) => {
  try {
    localStorage.setItem(GROUP_PREF, g ?? "");
  } catch {
    /* not remembered */
  }
};

const groupName = (g: ExprGroup) => EXPR_GROUPS.find(([k]) => k === g)?.[1] ?? g;

/** 表达: review of connectors, argument frames, collocations, register and letter formulas, and the reference sheet. */
export function ExprStudio({ onExit, exitLabel = "返回练习" }: { onExit: () => void; exitLabel?: string }) {
  const expr = useStore((s) => s.progress.expr);
  const [group, setGroupState] = useState<ExprGroup | null>(readGroup);
  const setGroup = (g: ExprGroup | null) => {
    setGroupState(g);
    writeGroup(g);
  };
  const [round, setRound] = useState<{ ids: string[]; key: number } | null>(null);
  const [sheet, setSheet] = useState(false);
  const [pureFr, setPureFr] = useState(readPureFr);
  const togglePureFr = () => {
    const nextVal = !pureFr;
    setPureFr(nextVal);
    writePureFr(nextVal);
  };

  const due = dueExpr({ expr }, Date.now(), group).length;
  const fresh = freshExpr({ expr }, EXPR_NEW, group).length;
  const counts = exprCounts({ expr }, group);
  const start = () => {
    const ids = exprRound({ expr: store.get().progress.expr }, group);
    if (ids.length) setRound({ ids, key: Date.now() });
  };

  if (round) return <ExprRound key={round.key} ids={round.ids} onExit={() => setRound(null)} onAgain={start} />;
  if (sheet) return <ExprSheet group={group} onExit={() => setSheet(false)} />;

  return (
    <div className="page practice expr">
      <header className="page-head">
        <button className="btn btn-ghost" onClick={onExit}>
          {exitLabel}
        </button>
        <p className="eyebrow">表达 · 会用</p>
        <h1 className="display">把句子连起来，把观点说出来。</h1>
        <p className="lede">看中文和功能，在句子的空里写出法语表达。答对答错都会按记忆曲线安排复习。</p>
      </header>
      <section className="panel expr-home">
        <h3 className="eyebrow">练哪一类</h3>
        <div className="segmented segmented-wide expr-groups" role="group" aria-label="表达类别">
          <button className={!group ? "is-on" : ""} aria-pressed={!group} onClick={() => setGroup(null)}>
            全部
          </button>
          {EXPR_GROUPS.map(([k, name]) => (
            <button key={k} className={group === k ? "is-on" : ""} aria-pressed={group === k} onClick={() => setGroup(k)}>
              {name}
            </button>
          ))}
        </div>
        <p className="muted">{group ? EXPR_GROUPS.find(([k]) => k === group)?.[2] : "连接词、论证句型、话题搭配、语域、正式信函，按这个顺序引入新卡。"}</p>
        <dl className="mini-stats">
          <div>
            <dt>到期复习</dt>
            <dd>{due}</dd>
          </div>
          <div>
            <dt>本轮新卡</dt>
            <dd>{fresh}</dd>
          </div>
          <div>
            <dt>已学 / 全部</dt>
            <dd>
              {counts.started}
              <small>/{counts.total}</small>
            </dd>
          </div>
        </dl>
        <div className="writing-actions">
          <button className={`btn ${pureFr ? "is-on" : "btn-ghost"}`} onClick={togglePureFr} aria-pressed={pureFr}>
            {pureFr ? "纯法语线索（先隐中文）：开" : "纯法语线索：关（显中文）"}
          </button>
          <button className="btn btn-ghost" onClick={() => setSheet(true)}>
            <BookText size={16} /> 速查表
          </button>
          <button className="btn btn-primary btn-xl" onClick={start} disabled={!due && !fresh}>
            {due ? "开始复习" : fresh ? "学新表达" : "这一类都学完了"} <ArrowRight size={18} />
          </button>
        </div>
        <p className="muted small">内容为本站编写，待核对。</p>
      </section>
    </div>
  );
}

interface Answer {
  id: string;
  typed: string;
  verdict: ExprVerdict;
  ok: boolean;
}

function ExprRound({ ids, onExit, onAgain }: { ids: string[]; onExit: () => void; onAgain: () => void }) {
  const sfx = useStore((s) => s.settings.sfx);
  // read once at the start of the round, so a card stays "new" after its first answer
  const isNew = useMemo(() => new Set(ids.filter((id) => !store.get().progress.expr?.[id])), [ids]);
  // a card answered wrong comes back later in the round, as practice only (graded once)
  const [steps, setSteps] = useState(() => ids.map((id) => ({ id, retry: false })));
  const [i, setI] = useState(0);
  const [value, setValue] = useState("");
  const [hinted, setHinted] = useState(false);
  const [pureFr, setPureFr] = useState(readPureFr);
  const [peekZh, setPeekZh] = useState(false);
  const togglePureFr = () => {
    const nextVal = !pureFr;
    setPureFr(nextVal);
    writePureFr(nextVal);
  };
  const [shown, setShown] = useState<{ verdict: ExprVerdict; other?: Expression; grade: Grade } | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const started = useRef(Date.now());
  const input = useRef<HTMLInputElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);

  const step = steps[i];
  const e = step ? EXPR_BY_ID.get(step.id) : undefined;
  const roundActive = Boolean(step && e && (answers.length > 0 || !!shown || value.trim().length > 0));
  useNavGuard(roundActive, "本轮表达练习尚未完成，确定提前离开？");
  const exitRound = async () => {
    if (
      roundActive &&
      !(await confirmAction({
        title: "结束本轮表达练习？",
        message: "当前一轮表达练习尚未完成，确定提前退出？",
        confirmLabel: "确定退出",
        danger: true,
      }))
    ) {
      return;
    }
    stopAudio();
    onExit();
  };
  if (!step || !e) {
    const right = answers.filter((a) => a.ok).length;
    const missed = answers.filter((a) => !a.ok);
    return (
      <div className="page practice">
        <section className="panel typing-done writing-done">
          <p className="eyebrow">本轮完成 · 表达</p>
          <h1 className="display">
            {right}/{answers.length} <small>答对</small>
          </h1>
          {missed.length > 0 && (
            <ul className="writing-review">
              {missed.map((a) => {
                const x = EXPR_BY_ID.get(a.id)!;
                return (
                  <li key={a.id}>
                    <p className="writing-review-cue">
                      {x.zh} · {x.fn}
                    </p>
                    {a.typed && (
                      <p className="writing-line is-mine" lang="fr">
                        <del>{a.typed}</del>
                      </p>
                    )}
                    <p className="writing-line" lang="fr">
                      <ins>{x.fr}</ins>
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="summary-actions">
            <button className="btn btn-ghost" onClick={onExit}>
              返回
            </button>
            <button className="btn btn-primary btn-xl" onClick={onAgain} autoFocus>
              <RotateCcw size={18} /> 再来一轮
            </button>
          </div>
        </section>
      </div>
    );
  }

  const gap = gapOf(e.ex);
  const submit = (giveUp = false) => {
    if (shown) return;
    const res = giveUp ? { verdict: "wrong" as const } : checkExpr(value, e);
    if (!giveUp && !value.trim()) return;
    setShown({ ...res, grade: exprGrade(res.verdict, hinted, Date.now() - started.current) });
    if (sfx) void cue(res.verdict === "wrong" ? "wrong" : "correct");
    requestAnimationFrame(() => nextBtn.current?.focus());
  };
  const next = () => {
    if (!shown) return;
    const ok = shown.grade !== Rating.Again;
    if (!step.retry) {
      answerExpr(step.id, shown.grade);
      setAnswers((a) => [...a, { id: step.id, typed: value.trim(), verdict: shown.verdict, ok }]);
    }
    if (!ok) setSteps((s) => [...s.slice(0, i + 4), { id: step.id, retry: true }, ...s.slice(i + 4)]);
    stopAudio();
    setValue("");
    setHinted(false);
    setPeekZh(false);
    setShown(null);
    started.current = Date.now();
    setI((n) => n + 1);
    requestAnimationFrame(() => input.current?.focus());
  };
  const override = (ok: boolean) => shown && setShown({ ...shown, grade: ok ? (shown.grade === Rating.Again ? Rating.Good : shown.grade) : Rating.Again });

  const ok = shown && shown.grade !== Rating.Again;
  const tone = !shown ? "" : !ok ? "is-wrong" : shown.verdict === "exact" && shown.grade !== Rating.Hard ? "is-correct" : "is-almost";
  const label = !shown
    ? ""
    : shown.verdict === "exact"
      ? "写对了"
      : shown.verdict === "accent"
        ? "字母对了，注意重音"
        : shown.verdict === "synonym"
          ? `「${shown.other?.fr}」也表达${e.fn.split(" · ")[0]}，这里要的是另一个`
          : "没写对";

  return (
    <div className="page practice typing">
      <header className="typing-top">
        <button className="btn btn-ghost" onClick={() => void exitRound()}>
          结束
        </button>
        <div className="learn-progress">
          <span style={{ width: `${((i + (shown ? 1 : 0)) / steps.length) * 100}%` }} />
        </div>
        <button type="button" className="link" onClick={togglePureFr} aria-pressed={pureFr}>
          {pureFr ? "纯法语线索" : "显示中文"}
        </button>
        <span className="typing-meter">
          <b>{answers.filter((a) => a.ok).length}</b> / {answers.length}
        </span>
      </header>
      <section className="writing-stage">
        <div className="writing-cue">
          <p className="eyebrow">
            {groupName(e.group)} · {e.fn}
            {isNew.has(e.id) && !step.retry && " · 新"}
            {step.retry && " · 再练一次"}
          </p>
          {(!pureFr || !!shown || peekZh) ? (
            <h2 className="writing-zh">{e.zh}</h2>
          ) : (
            <div className="writing-pure-fr">
              {e.reformFrom && (
                <p className="writing-hint" lang="fr">
                  Reformulez : <span className="muted">{e.reformFrom}</span>
                </p>
              )}
              {e.frDef && (
                <p className="writing-zh expr-prompt-fr" lang="fr">
                  {e.frDef}
                </p>
              )}
              {!e.reformFrom && !e.frDef && e.group !== "reg" && (
                <p className="muted small" lang="fr">
                  Complétez la phrase selon la fonction ({e.fn}).
                </p>
              )}
              <button type="button" className="link small" onClick={() => setPeekZh(true)}>
                偷看中文
              </button>
            </div>
          )}
          {e.reg?.familier && e.group === "reg" && (
            <p className="writing-hint">
              口语里说 <span lang="fr">{e.reg.familier}</span>，写作时换成？
            </p>
          )}
          {e.note && !shown && (!pureFr || peekZh) && <p className="muted small">{e.note}</p>}
        </div>

        <p className="expr-sentence" lang="fr">
          {gap.before}
          <span className={`expr-gap ${shown ? (ok ? "is-ok" : "is-bad") : ""}`}>{shown ? gap.answer : hinted ? maskOf(gap.answer) : "＿＿＿"}</span>
          {gap.after}
        </p>
        {(!pureFr || !!shown || peekZh) && <p className="writing-line-zh expr-sentence-zh">{e.exZh}</p>}

        <input
          ref={input}
          className="writing-input"
          lang="fr"
          value={value}
          readOnly={!!shown}
          autoFocus
          onChange={(ev) => setValue(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" && !ev.nativeEvent.isComposing) {
              ev.preventDefault();
              if (shown) next();
              else submit();
            }
          }}
          placeholder="写出空里的法语，按回车"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          aria-label="空里的法语表达"
        />

        {!shown ? (
          <>
            <AccentKeys input={input} value={value} onChange={setValue} />
            <div className="writing-actions">
              {!hinted && (
                <button className="btn btn-ghost" onClick={() => setHinted(true)}>
                  <Lightbulb size={14} /> 首字母提示
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => submit(true)}>
                不会，看答案
              </button>
              <button className="btn btn-primary" onClick={() => submit()} disabled={!value.trim()}>
                检查 <ArrowRight size={16} />
              </button>
            </div>
          </>
        ) : (
          <div className={`writing-feedback ${tone}`}>
            <p className="writing-verdict">
              {ok ? <Check size={18} /> : <X size={18} />} {label}
            </p>
            <p className="writing-line" lang="fr">
              {filledEx(e.ex)}
              <Speak url={null} text={filledEx(e.ex)} size="sm" />
            </p>
            <p className="expr-answer">
              <b lang="fr">{e.fr}</b> {e.zh}
              {e.note && <small> · {e.note}</small>}
            </p>
            {e.reg && <RegisterLine reg={e.reg} />}
            <div className="writing-actions">
              {ok ? (
                <button className="btn btn-ghost" onClick={() => override(false)}>
                  其实不会，算错
                </button>
              ) : (
                value.trim() && (
                  <button className="btn btn-ghost" onClick={() => override(true)}>
                    我写的也对，算对
                  </button>
                )
              )}
              <button ref={nextBtn} className="btn btn-primary btn-xl" onClick={next}>
                {i + 1 >= steps.length ? "看结果" : "下一题"} <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
        <p className="muted typing-help">
          第 {i + 1}/{steps.length} 题 · 重音错、借助提示、或写成同功能的另一个表达，都按「有点难」安排复习
        </p>
      </section>
    </div>
  );
}

function RegisterLine({ reg }: { reg: NonNullable<Expression["reg"]> }) {
  return (
    <p className="expr-register">
      {reg.familier && (
        <span>
          <small>familier</small> <span lang="fr">{reg.familier}</span>
        </span>
      )}
      {reg.courant && (
        <span>
          <small>courant</small> <span lang="fr">{reg.courant}</span>
        </span>
      )}
      {reg.soutenu && (
        <span>
          <small>soutenu</small> <span lang="fr">{reg.soutenu}</span>
        </span>
      )}
    </p>
  );
}

/** 速查表: every card of a group (or all), by function; register as a three-column table. */
function ExprSheet({ group, onExit }: { group: ExprGroup | null; onExit: () => void }) {
  const groups = EXPR_GROUPS.filter(([k]) => !group || k === group);
  return (
    <div className="page practice expr">
      <header className="page-head">
        <button className="btn btn-ghost" onClick={onExit}>
          返回
        </button>
        <p className="eyebrow">表达 · 速查表</p>
        <h1 className="display">{group ? groupName(group) : "全部表达"}</h1>
        <p className="lede">写作和口语时对照着用。内容为本站编写，待核对。</p>
      </header>
      {groups.map(([g, name, desc]) => {
        const cards = EXPRESSIONS.filter((e) => e.group === g);
        const fns = [...new Set(cards.map((e) => e.fn))];
        return (
          <section key={g} className="panel expr-sheet">
            <h2>{name}</h2>
            <p className="muted small">{desc}</p>
            {g === "reg" ? (
              <table className="expr-reg-table">
                <thead>
                  <tr>
                    <th>中文</th>
                    <th>familier 口语</th>
                    <th>courant 日常</th>
                    <th>soutenu 正式</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map((e) => (
                    <tr key={e.id}>
                      <td>{e.zh}</td>
                      <td lang="fr">{e.reg?.familier ?? "—"}</td>
                      <td lang="fr">{e.reg?.courant ?? "—"}</td>
                      <td lang="fr">{e.reg?.soutenu ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              fns.map((fn) => (
                <div key={fn} className="expr-sheet-fn">
                  <h3 className="eyebrow">{fn}</h3>
                  <ul>
                    {cards
                      .filter((e) => e.fn === fn)
                      .map((e) => (
                        <li key={e.id}>
                          <b lang="fr">{e.fr}</b> <span>{e.zh}</span>
                          {e.note && <small> · {e.note}</small>}
                          <p lang="fr" className="muted small">
                            {filledEx(e.ex)}
                          </p>
                        </li>
                      ))}
                  </ul>
                </div>
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Today's card: due expression reviews, or an invitation to start. */
export function ExprTeaser({ onOpen }: { onOpen: () => void }) {
  const expr = useStore((s) => s.progress.expr);
  const due = dueExpr({ expr }).length;
  const started = exprCounts({ expr }).started;
  return (
    <section className={`panel expr-teaser ${started && !due ? "is-done" : ""}`} onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen()} aria-label="表达复习">
      <p className="eyebrow">表达 · 会用</p>
      <h3>{due ? `${due} 个表达到期复习` : started ? "今天的表达都复习完了" : "连接词、论证句型、信函套话"}</h3>
      <p>看中文，在句子的空里写出法语：cependant、bien que + 虚拟式、Je vous prie d'agréer……</p>
      <span className="expr-teaser-go">
        {due ? (
          <>
            开始复习 <ArrowRight size={16} />
          </>
        ) : started ? (
          <>
            <Check size={16} /> 再学几个新的
          </>
        ) : (
          <>
            开始 <ArrowRight size={16} />
          </>
        )}
      </span>
    </section>
  );
}
