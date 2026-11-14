import { ArrowLeft, ArrowRight, PenLine, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ready, useAiConfig } from "../ai/config";
import { gradeEssay } from "../ai/tasks";
import { useGrammar } from "../atlas/grammar";
import {
  CONNECTORS,
  countWords,
  CRITERIA,
  CRITERION_CHECK,
  CRITERION_LABEL,
  ESSAY_TASKS,
  FORMAL_GENRES,
  GENRE_LABEL,
  LETTER_FORMULAS,
  MAX_ESSAY_LENGTH,
  totalScore,
  type EssayFeedback,
  type EssayTask,
} from "../lib/essay";
import { clock, topicOf } from "../lib/exam";
import { href } from "../lib/router";
import { useTimer } from "../lib/timer";
import { deleteEssay, saveEssay } from "../store/essays";
import { useStore } from "../store/store";
import { AccentKeys } from "../ui/AccentKeys";
import { Marking } from "../ui/Marking";
import { toast } from "../ui/Toast";

const DRAFT = (task: string) => `fb2.essay.draft.${task}`;
const readDraft = (task: string) => {
  try {
    return localStorage.getItem(DRAFT(task)) ?? "";
  } catch {
    return "";
  }
};
const writeDraft = (task: string, text: string) => {
  try {
    if (text.trim()) localStorage.setItem(DRAFT(task), text);
    else localStorage.removeItem(DRAFT(task));
  } catch {
    /* a draft that cannot be kept is not worth an error */
  }
};

const taskOf = (id: string) => ESSAY_TASKS.find((t) => t.id === id);
const day = (ms: number) => new Date(ms).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });

type View = { at: "list" } | { at: "write"; task: EssayTask } | { at: "result"; task: EssayTask; id: string };

/**
 * 篇章写作: pick a task, write the whole text with a plan and linking words at hand, and have it marked on a fixed
 * four-part grid. Without an AI service the text is saved and checked against the grid by the learner.
 * Practice only: memory state is not touched.
 */
export function EssayStudio({ onExit }: { onExit: () => void }) {
  const essays = useStore((s) => s.progress.essays) ?? [];
  const ai = useAiConfig();
  const { data: grammar } = useGrammar();
  const [view, setView] = useState<View>({ at: "list" });
  const [text, setText] = useState("");
  const [grading, setGrading] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const ctrl = useRef<AbortController | null>(null);
  const timer = useTimer();

  useEffect(() => () => ctrl.current?.abort(), []);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view.at]);

  const pointTitle = useMemo(() => new Map((grammar?.points ?? []).map((p) => [p.id, p.title])), [grammar]);

  const open = (task: EssayTask, initial = readDraft(task.id)) => {
    setText(initial);
    timer.stop();
    setView({ at: "write", task });
  };

  const change = (task: EssayTask, v: string) => {
    const next = v.slice(0, MAX_ESSAY_LENGTH);
    setText(next);
    writeDraft(task.id, next);
  };

  const finish = (task: EssayTask, fb?: EssayFeedback) => {
    timer.stop();
    const id = saveEssay({ task: task.id, text, fb });
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

  if (view.at === "list") {
    return (
      <div className="page practice">
        <header className="page-head">
          <button className="link deck-back" onClick={onExit}>
            <ArrowLeft size={16} /> 返回练习
          </button>
          <p className="eyebrow">篇章写作 · Production écrite</p>
          <h1 className="display">把句子，连成一篇。</h1>
          <p className="lede">选一个题目，照着提纲写完整的一封信或一篇短文。批改用官方评分表的五项（完成任务、连贯和衔接、语体得体、词汇、语法），每项 0／1／3／5 分，满分 25，并指出每处错误对应的语法点。</p>
          {!ready.text(ai) && (
            <p className="muted">
              还没有设置 AI 接口：可以写、可以保存，对照评分表自己检查。到 <a className="link" href={href({ page: "me" })}>我的 → AI 接口</a> 设置后由 AI 批改。
            </p>
          )}
        </header>
        {(["B1", "B2"] as const).map((lv) => (
          <section key={lv} className="essay-level">
            <h3 className="eyebrow">{lv}</h3>
            <div className="essay-tasks">
              {ESSAY_TASKS.filter((t) => t.level === lv).map((t) => {
                const done = essays.filter((e) => e.task === t.id);
                const best = done.reduce((m, e) => (e.fb ? Math.max(m, totalScore(e.fb)) : m), -1);
                return (
                  <button key={t.id} className="essay-task" onClick={() => open(t)}>
                    <span className="chip">{GENRE_LABEL[t.genre]}</span>
                    <b>{t.title}</b>
                    <small>{t.situation}</small>
                    <small className="essay-task-meta">
                      {t.words[0]}–{t.words[1]} 词{readDraft(t.id) ? " · 有草稿" : ""}
                      {done.length > 0 ? ` · 写过 ${done.length} 次${best >= 0 ? `，最高 ${best}/25` : ""}` : ""}
                    </small>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        {essays.length > 0 && (
          <section className="essay-level">
            <h3 className="eyebrow">写过的</h3>
            <ul className="essay-history">
              {essays.map((e) => {
                const t = taskOf(e.task);
                if (!t) return null;
                return (
                  <li key={e.id}>
                    <button className="link" onClick={() => setView({ at: "result", task: t, id: e.id })}>
                      {day(e.created)} · {t.title}
                    </button>
                    <span className="muted">
                      {countWords(e.text)} 词 · {e.fb ? `${totalScore(e.fb)}/25` : "未批改"}
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

  if (view.at === "result") {
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
            <Marking fb={fb} pointTitle={pointTitle} />
          ) : (
            <div className="essay-box">
              <p className="eyebrow">对照官方评分表的五项自己检查</p>
              <ul className="essay-check">
                {CRITERIA.map((c) => (
                  <li key={c}>
                    <b>{CRITERION_LABEL[c]}</b> {CRITERION_CHECK[c]}
                  </li>
                ))}
              </ul>
              <p className="muted small">这篇没有经过 AI 批改。设置 AI 接口后，点「再改一稿」可以重新提交。</p>
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

          {fb && <p className="muted small">AI 的批改和分数可能有偏差，拿不准的地方对照语法点和词典。</p>}
          <div className="writing-actions">
            <button
              className="btn btn-ghost"
              onClick={() => {
                deleteEssay(essay.id);
                setView({ at: "list" });
              }}
            >
              <Trash2 size={16} /> 删除
            </button>
            <button className="btn btn-primary" onClick={() => open(task, essay.text)}>
              <PenLine size={16} /> 再改一稿
            </button>
          </div>
        </section>
      </div>
    );
  }

  const words = countWords(text);
  const [min, max] = task.words;
  return (
    <div className="page practice">
      <section className="essay-stage">
        <button className="link deck-back" onClick={() => setView({ at: "list" })} disabled={grading}>
          <ArrowLeft size={16} /> 返回题目（草稿会保留）
        </button>
        <p className="eyebrow">
          {GENRE_LABEL[task.genre]} · {task.level} · {min}–{max} 词
        </p>
        <h2 className="essay-title">{task.title}</h2>
        <p className="essay-situation">{task.situation}</p>
        {task.doc && (
          <blockquote className="essay-doc" lang="fr">
            {task.doc}
          </blockquote>
        )}
        <p className="essay-consigne" lang="fr">
          {task.consigne}
        </p>
        <ul className="essay-points">
          {task.points.map((p, k) => (
            <li key={k}>{p}</li>
          ))}
        </ul>

        <div className="essay-help">
          <details open>
            <summary>提纲</summary>
            <ol className="essay-plan">
              {task.plan.map((p, k) => (
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
          )}
        </div>

        <textarea
          ref={input}
          className="writing-input essay-input"
          lang="fr"
          rows={14}
          value={text}
          readOnly={grading}
          onChange={(ev) => change(task, ev.target.value)}
          placeholder="在这里写。分段写，每段一个意思。"
          autoCapitalize="sentences"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          aria-label="在这里写法语作文"
        />
        {!grading && <AccentKeys input={input} value={text} onChange={(v) => change(task, v)} />}
        <div className="writing-actions">
          <span className={`essay-count ${words < min ? "is-short" : words > max ? "is-long" : "is-ok"}`}>
            {words} 词 · 要求 {min}–{max}
          </span>
          {!grading &&
            (timer.running || (timer.down && timer.sec === 0) ? (
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
