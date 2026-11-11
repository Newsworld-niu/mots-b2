import { ArrowRight, Check, RotateCcw, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAtlas } from "../atlas/context";
import { useConfusables } from "../atlas/confusables";
import { pickQuestions, questionsOf, type CfGroup, type CfQuestion } from "../lib/confusables";
import { foldAccents } from "../lib/accent";
import { cue } from "../lib/sound";
import { href, openWord } from "../lib/router";
import { hashSeed } from "../lib/text";
import { recordMistake } from "../store/session";
import { useStore } from "../store/store";
import { Speak } from "../ui/Speak";

type Kind = "all" | CfGroup["kind"];
const KINDS: [Kind, string][] = [
  ["all", "全部"],
  ["homophone", "同音词"],
  ["meaning", "词义辨析"],
];

export function Compare({ focusId }: { focusId?: string }) {
  const { data, error } = useConfusables();
  const [kind, setKind] = useState<Kind>("all");
  const [q, setQ] = useState("");
  const [quiz, setQuiz] = useState<CfQuestion[] | null>(null);

  const groups = useMemo(() => {
    if (!data) return [];
    const needle = foldAccents(q.trim());
    return data.groups.filter((g) => (kind === "all" || g.kind === kind) && (!needle || foldAccents([g.title, g.zh, ...g.items.flatMap((i) => [i.w, i.zh])].join(" ")).includes(needle)));
  }, [data, kind, q]);

  const start = (from: CfGroup[], n: number) => {
    const picked = pickQuestions(questionsOf(from), n, mulberry(hashSeed(String(Date.now()))), from.length === 1 ? 6 : 2);
    if (picked.length) setQuiz(picked);
  };

  if (quiz && data) return <CompareQuiz questions={quiz} onExit={() => setQuiz(null)} onAgain={() => start(quiz.every((x) => x.group.id === quiz[0].group.id) ? [quiz[0].group] : data.groups, quiz.length)} />;

  return (
    <div className="page compare">
      <header className="page-head">
        <p className="eyebrow">辨析 · Mots qu'on confond</p>
        <h1 className="display">它们长得像，意思不一样。</h1>
        <p className="lede">{data ? `${data.groups.length} 组容易混的词：读音相同的，和意思容易搞混的。先看区别，再用例句填空检验自己。` : "正在加载……"}</p>
      </header>
      {error && <p className="muted">{error}</p>}
      {data && (
        <>
          <div className="compare-bar">
            <div className="segmented" role="group" aria-label="类型">
              {KINDS.map(([k, label]) => (
                <button key={k} className={kind === k ? "is-on" : ""} onClick={() => setKind(k)} aria-pressed={kind === k}>
                  {label}
                </button>
              ))}
            </div>
            <label className="compare-search">
              <Search size={17} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜词，如 où、借、带" aria-label="搜索易混词" />
            </label>
            <button className="btn btn-primary" onClick={() => start(data.groups, 10)}>
              随机测验 10 题
            </button>
          </div>
          {groups.length === 0 && <p className="muted compare-empty">没有找到匹配的词组。</p>}
          <div className="compare-grid">
            {groups.map((g) => (
              <GroupCard key={g.id} group={g} focus={g.id === focusId} onQuiz={() => start([g], Math.min(6, g.items.length * 2))} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function GroupCard({ group, focus, onQuiz }: { group: CfGroup; focus: boolean; onQuiz: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focus) ref.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [focus]);
  return (
    <article ref={ref} id={`cf-${group.id}`} className={`cf-card ${focus ? "is-focus" : ""}`}>
      <header>
        <span className={`chip cf-kind cf-${group.kind}`}>{group.kind === "homophone" ? "同音词" : "词义辨析"}</span>
        <h2 lang="fr">{group.title}</h2>
        <p className="cf-zh">{group.zh}</p>
      </header>
      <ul className="cf-items">
        {group.items.map((it) => (
          <li key={it.w}>
            <div className="cf-word">
              {it.id ? (
                <button className="cf-link" onClick={() => openWord(it.id!)} lang="fr" title="查看词条">
                  {it.w}
                </button>
              ) : (
                <b lang="fr">{it.w}</b>
              )}
              <span className="cf-gloss">{it.zh}</span>
            </div>
            <p className="cf-rule">{it.rule}</p>
            <p className="cf-ex" lang="fr">
              {it.ex.fr}
              <Speak url={null} text={it.ex.fr} size="sm" className="ex-speak" />
            </p>
            <p className="cf-ex-zh">{it.ex.zh}</p>
          </li>
        ))}
      </ul>
      <footer>
        <button className="btn btn-ghost" onClick={onQuiz}>
          测这一组
        </button>
      </footer>
    </article>
  );
}

function CompareQuiz({ questions, onExit, onAgain }: { questions: CfQuestion[]; onExit: () => void; onAgain: () => void }) {
  const atlas = useAtlas();
  const sfx = useStore((s) => s.settings.sfx);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [results, setResults] = useState<{ q: CfQuestion; ok: boolean }[]>([]);
  const q = questions[i];
  const done = i >= questions.length;

  const choose = (w: string) => {
    if (picked) return;
    const ok = w === q.item.w;
    setPicked(w);
    setResults((r) => [...r, { q, ok }]);
    // a word you mixed up goes to the mistakes book (Practice → 错词本); memory schedules are not touched
    if (!ok && q.item.id && atlas.byId.has(q.item.id)) recordMistake(q.item.id);
    if (sfx) void cue(ok ? "correct" : "wrong");
  };
  const next = () => {
    setPicked(null);
    setI((n) => n + 1);
  };
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  keys.current = (e) => {
    if (done) return;
    if (picked && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      next();
    } else if (!picked && /^[1-4]$/.test(e.key)) {
      const it = q.group.items[Number(e.key) - 1];
      if (it) choose(it.w);
    }
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  if (done) {
    const right = results.filter((r) => r.ok).length;
    const missed = [...new Map(results.filter((r) => !r.ok).map((r) => [r.q.group.id, r.q.group])).values()];
    return (
      <div className="page compare">
        <section className="panel typing-done">
          <p className="eyebrow">本轮完成</p>
          <h1 className="display">
            {right} <small>/ {results.length}</small>
          </h1>
          <p className="lede">{missed.length ? "下面这几组还容易混，回去再看一眼区别。答错的词已加入错词本，可以在练习里再练。" : "全部答对，这几组你已经分清了。"}</p>
          {missed.length > 0 && (
            <ul className="cf-missed">
              {missed.map((g) => (
                <li key={g.id}>
                  <a href={href({ page: "compare", g: g.id })} onClick={onExit} lang="fr">
                    {g.title}
                  </a>
                  <small>{g.zh}</small>
                </li>
              ))}
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

  return (
    <div className="page compare quiz-page">
      <header className="typing-top">
        <button className="btn btn-ghost" onClick={onExit}>
          结束
        </button>
        <div className="learn-progress">
          <span style={{ width: `${(i / questions.length) * 100}%` }} />
        </div>
        <span className="typing-meter">
          <b>{i + 1}</b> / {questions.length}
        </span>
      </header>
      <div className={`quiz ${picked ? (picked === q.item.w ? "is-right" : "is-wrong") : ""}`}>
        <p className="stage-label">选出填进空格的词</p>
        <section className="prompt">
          <p className="cloze cf-cloze" lang="fr">
            {q.before}
            <span className="blank">{picked ? q.hidden : "　　　"}</span>
            {q.after}
          </p>
          <p className="cloze-zh">{q.item.ex.zh}</p>
        </section>
        <ul className="options options-en">
          {q.group.items.map((it, k) => {
            const isAnswer = it.w === q.item.w;
            const chosen = picked === it.w;
            const cls = picked ? (isAnswer ? "is-answer" : chosen ? "is-chosen" : "is-dim") : "";
            return (
              <li key={it.w}>
                <button className={`option ${cls}`} onClick={() => choose(it.w)} disabled={!!picked}>
                  <kbd>{k + 1}</kbd>
                  <span lang="fr">{it.w}</span>
                  {picked && isAnswer && <Check size={20} className="option-mark" />}
                  {picked && chosen && !isAnswer && <X size={20} className="option-mark" />}
                </button>
              </li>
            );
          })}
        </ul>
        {picked && (
          <div className={`feedback ${picked === q.item.w ? "is-right" : "is-wrong"}`} role="status">
            <div className="feedback-inner cf-feedback">
              <div className="feedback-text">
                <p className="feedback-verdict">{picked === q.item.w ? "答对了" : `应该是 ${q.item.w}`}</p>
                <p className="feedback-zh">
                  <b lang="fr">{q.item.w}</b> {q.item.zh} · {q.item.rule}
                </p>
                {picked !== q.item.w && (
                  <p className="feedback-zh cf-wrong">
                    <b lang="fr">{picked}</b> {q.group.items.find((x) => x.w === picked)?.zh} · {q.group.items.find((x) => x.w === picked)?.rule}
                  </p>
                )}
                <p className="feedback-ex" lang="fr">
                  {q.before}
                  <mark>{q.hidden}</mark>
                  {q.after}
                </p>
              </div>
              <button className={`btn btn-xl ${picked === q.item.w ? "btn-sage" : "btn-terra"}`} onClick={next} autoFocus>
                继续 <ArrowRight size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Small seeded PRNG so a round is random but reproducible within one start. */
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

