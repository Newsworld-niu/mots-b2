import { ArrowRight, Check, Lightbulb, RotateCcw, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ready, useAiConfig } from "../ai/config";
import { gradeSentence } from "../ai/tasks";
import type { Entry } from "../atlas/types";
import { stopAudio } from "../lib/audio";
import { cue } from "../lib/sound";
import { diffWords, ERROR_LABEL, sameSentence, translatable, VERDICT_LABEL, verdictCue, type Feedback, type Verdict } from "../lib/writing";
import { useStore } from "../store/store";
import { AccentKeys } from "../ui/AccentKeys";
import { Speak } from "../ui/Speak";
import { toast } from "../ui/Toast";

export type WritingMode = "translate" | "compose";

interface Result {
  entry: Entry;
  answer: string;
  fb: Feedback;
  /** Judged by the learner against the reference (no AI), not by the AI. */
  self: boolean;
  /** Chinese of the sentence shown as the answer, when it is a sentence from the card (造句 skipped). */
  zh?: string;
}

type Phase = "write" | "grading" | "self" | "shown";

const VERDICT_ICON: Record<Verdict, typeof Check> = { correct: Check, almost: Sparkles, wrong: X };
const plain = (verdict: Verdict, corrected: string, comment = ""): Feedback => ({ verdict, corrected, errors: [], comment, natural: "" });

/** A sentence with the words that differ from the other one marked. */
function Diffed({ tokens, tone }: { tokens: { t: string; ok: boolean }[]; tone: "cut" | "add" }) {
  return (
    <>
      {tokens.map((x, k) => (
        <span key={k}>
          {k > 0 && " "}
          {x.ok ? x.t : tone === "cut" ? <del>{x.t}</del> : <ins>{x.t}</ins>}
        </span>
      ))}
    </>
  );
}

/**
 * 成句输出: 中译法 (put the Chinese of a book sentence into French) and 造句 (write a sentence with the word).
 * The AI marks the sentence; an answer equal to the book's sentence needs no AI, and without an AI service
 * 中译法 falls back to comparing with the book's sentence yourself. Practice only: memory state is not touched.
 */
export function WritingRound({ mode, entries, onExit, onAgain }: { mode: WritingMode; entries: Entry[]; onExit: () => void; onAgain: () => void }) {
  const settings = useStore((s) => s.settings);
  const ai = useAiConfig();
  const [i, setI] = useState(0);
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<Phase>("write");
  const [hint, setHint] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const input = useRef<HTMLTextAreaElement>(null);
  const ctrl = useRef<AbortController | null>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);

  const done = i >= entries.length;
  const e = entries[Math.min(i, entries.length - 1)];
  const ex = mode === "translate" ? translatable(e.ex) : undefined;
  const reference = ex?.en ?? "";
  const sense = e.senses[0];
  const last = results[results.length - 1];

  useEffect(() => {
    if (!done) input.current?.focus({ preventScroll: true });
  }, [i, done]);
  // Enter goes on to the next sentence; without scrolling, so the verdict stays in view
  useEffect(() => {
    if (phase === "shown") nextBtn.current?.focus({ preventScroll: true });
  }, [phase]);
  useEffect(
    () => () => {
      ctrl.current?.abort();
      stopAudio();
    },
    [],
  );
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const show = (fb: Feedback, self = false, zh?: string) => {
    if (settings.sfx) void cue(verdictCue(fb.verdict));
    setResults((xs) => [...xs, { entry: e, answer: value.trim(), fb, self, ...(zh ? { zh } : {}) }]);
    setPhase("shown");
  };

  const submit = async () => {
    const answer = value.trim();
    if (!answer || phase !== "write") return;
    if (mode === "translate" && sameSentence(answer, reference)) return show(plain("correct", answer, "和参考句子一样。"));
    if (!ready.text(ai)) return setPhase("self");
    const c = new AbortController();
    ctrl.current = c;
    setPhase("grading");
    try {
      const fb = await gradeSentence({ task: mode, word: e.w, pos: sense?.pos ?? "", zh: sense?.zh ?? "", ...(e.cefr ? { cefr: e.cefr } : {}), sourceZh: ex?.zh, reference, answer }, c.signal);
      if (!c.signal.aborted) show(fb);
    } catch (err) {
      if (c.signal.aborted) return;
      toast((err as Error).message || "批改失败", "warn");
      // 中译法 can still be checked against the book's sentence
      setPhase(mode === "translate" ? "self" : "write");
    }
  };

  /** Give up on this one: it counts as not written, with the book's sentence as the answer. */
  const skip = () => {
    ctrl.current?.abort();
    // 造句 shows a sentence from the card as an example, with its Chinese
    const sample = mode === "compose" ? (translatable(e.ex) ?? e.ex[0]) : undefined;
    show(plain("wrong", mode === "translate" ? reference : (sample?.en ?? ""), value.trim() ? "" : "没有作答。"), false, sample?.zh);
  };

  const next = () => {
    stopAudio();
    setValue("");
    setHint(false);
    setPhase("write");
    setI((n) => n + 1);
  };

  const count = (v: Verdict) => results.filter((r) => r.fb.verdict === v).length;

  if (done) {
    const review = results.filter((r) => r.fb.verdict !== "correct");
    return (
      <div className="page practice">
        <section className="panel typing-done writing-done">
          <p className="eyebrow">本轮完成 · {mode === "translate" ? "中译法" : "造句"}</p>
          <h1 className="display">
            {count("correct")}/{results.length} <small>正确</small>
          </h1>
          <p className="lede">
            基本正确 {count("almost")} · 需要改 {count("wrong")}
          </p>
          {review.length > 0 && (
            <ul className="writing-review">
              {review.map((r, k) => (
                <li key={k}>
                  <p className="writing-review-cue">
                    {mode === "translate" ? translatable(r.entry.ex)?.zh : `${r.entry.w} · ${r.entry.senses[0]?.zh ?? ""}`}
                  </p>
                  {r.answer && (
                    <p className="writing-line is-mine" lang="fr">
                      <Diffed tokens={diffWords(r.answer, r.fb.corrected).written} tone="cut" />
                    </p>
                  )}
                  {r.fb.corrected && (
                    <p className="writing-line" lang="fr">
                      <Diffed tokens={r.answer ? diffWords(r.answer, r.fb.corrected).corrected : [{ t: r.fb.corrected, ok: true }]} tone="add" />
                      <Speak url={null} text={r.fb.corrected} size="sm" />
                    </p>
                  )}
                  {r.zh && r.fb.corrected && <p className="writing-line-zh">{r.zh}</p>}
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

  const fb = phase === "shown" ? last?.fb : undefined;
  const diff = fb && last?.answer ? diffWords(last.answer, fb.corrected) : null;
  const changed = !!diff && diff.corrected.some((t) => !t.ok);
  const VerdictIcon = fb ? VERDICT_ICON[fb.verdict] : Check;
  const selfDiff = phase === "self" ? diffWords(value, reference) : null;
  const col = e.col[0]?.split("｜")[0]?.trim();

  return (
    <div className="page practice typing">
      <header className="typing-top">
        <button className="btn btn-ghost" onClick={onExit}>
          结束
        </button>
        <div className="learn-progress">
          <span style={{ width: `${((i + (phase === "shown" ? 1 : 0)) / entries.length) * 100}%` }} />
        </div>
        <span className="typing-meter">
          <b>{count("correct")}</b> / {results.length}
        </span>
      </header>
      <section className="writing-stage">
        {mode === "translate" ? (
          <div className="writing-cue">
            <p className="eyebrow">把这句话写成法语</p>
            <h2 className="writing-zh">{ex?.zh}</h2>
            {hint ? (
              <p className="writing-hint">
                要用到 <b lang="fr">{e.w}</b> <span className="pos">{sense?.pos}</span> {sense?.zh}
              </p>
            ) : (
              phase === "write" && (
                <button className="link writing-hint" onClick={() => setHint(true)}>
                  <Lightbulb size={14} /> 提示：用哪个词
                </button>
              )
            )}
          </div>
        ) : (
          <div className="writing-cue">
            <p className="eyebrow">用这个词写一个句子</p>
            <h2 className="headword" lang="fr">
              {e.w}
            </h2>
            <p className="writing-hint">
              <span className="pos">{sense?.pos}</span> {sense?.zh}
            </p>
            {col && col.toLowerCase() !== e.w.toLowerCase() && (
              <p className="muted small">
                可以用上：<span lang="fr">{col}</span>
              </p>
            )}
          </div>
        )}

        <textarea
          ref={input}
          className="writing-input"
          lang="fr"
          rows={2}
          value={value}
          readOnly={phase !== "write"}
          onChange={(ev) => setValue(ev.target.value.replace(/\n/g, " "))}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" && !ev.nativeEvent.isComposing) {
              ev.preventDefault();
              void submit();
            }
          }}
          placeholder={mode === "translate" ? "写下法语句子，按回车批改" : `用 ${e.w} 写一句完整的话，按回车批改`}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          aria-label="在这里写法语句子"
        />

        {phase === "write" && (
          <>
            <AccentKeys input={input} value={value} onChange={setValue} />
            <div className="writing-actions">
              <button className="btn btn-ghost" onClick={skip}>
                {mode === "translate" ? "不会，看答案" : "跳过"}
              </button>
              <button className="btn btn-primary" onClick={() => void submit()} disabled={!value.trim()}>
                批改 <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}

        {phase === "grading" && (
          <div className="writing-actions">
            <p className="muted">AI 批改中（约 5–15 秒）…</p>
            <button className="btn btn-ghost" onClick={skip}>
              不等了
            </button>
          </div>
        )}

        {phase === "self" && selfDiff && (
          <div className="writing-feedback">
            <p className="eyebrow">参考句子</p>
            <p className="writing-line" lang="fr">
              <Diffed tokens={selfDiff.corrected} tone="add" />
              <Speak url={null} text={reference} size="sm" />
            </p>
            <p className="muted small">
              {ready.text(ai) ? "这次没能连上 AI。" : "没有设置 AI 接口，"}对照参考句子自己判断；写法不同不一定是错。
            </p>
            <div className="writing-actions">
              <button className="btn btn-ghost" onClick={() => show(plain("wrong", reference), true)}>
                没写对
              </button>
              <button className="btn btn-ghost" onClick={() => show(plain("almost", reference), true)}>
                有小错
              </button>
              <button className="btn btn-primary" onClick={() => show(plain("correct", value.trim()), true)}>
                写对了
              </button>
            </div>
          </div>
        )}

        {fb && (
          <div className={`writing-feedback is-${fb.verdict}`}>
            <p className="writing-verdict">
              <VerdictIcon size={18} /> {VERDICT_LABEL[fb.verdict]}
              {last.self && <small>自己判断</small>}
            </p>
            {fb.comment && <p className="writing-comment">{fb.comment}</p>}
            {changed && diff && last.answer && (
              <p className="writing-line is-mine" lang="fr">
                <Diffed tokens={diff.written} tone="cut" />
              </p>
            )}
            {fb.corrected && (changed || !last.answer) && (
              <p className="writing-line" lang="fr">
                {diff ? <Diffed tokens={diff.corrected} tone="add" /> : fb.corrected}
                <Speak url={null} text={fb.corrected} size="sm" />
              </p>
            )}
            {last.zh && fb.corrected && <p className="writing-line-zh">{last.zh}</p>}
            {fb.errors.length > 0 && (
              <ul className="writing-errors">
                {fb.errors.map((x, k) => (
                  <li key={k}>
                    <span className="chip">{ERROR_LABEL[x.type]}</span>
                    <span lang="fr">
                      {x.wrong && <del>{x.wrong}</del>} {x.right && <ins>{x.right}</ins>}
                    </span>
                    {x.why && <small>{x.why}</small>}
                  </li>
                ))}
              </ul>
            )}
            {fb.natural && (
              <p className="writing-extra">
                <small>更地道的说法</small>
                <span lang="fr">{fb.natural}</span>
                <Speak url={null} text={fb.natural} size="sm" />
              </p>
            )}
            {mode === "translate" && reference && !last.self && !sameSentence(reference, fb.corrected) && (
              <p className="writing-extra">
                <small>参考句子</small>
                <span lang="fr">{reference}</span>
                <Speak url={null} text={reference} size="sm" />
              </p>
            )}
            {!last.self && fb.errors.length + (fb.natural ? 1 : 0) > 0 && <p className="muted small">AI 的批改可能有错，拿不准时对照词典。</p>}
            <div className="writing-actions">
              <button ref={nextBtn} className="btn btn-primary btn-xl" onClick={next}>
                {i + 1 >= entries.length ? "看结果" : "下一题"} <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        <p className="muted typing-help">
          第 {i + 1}/{entries.length} 题 · 只是练习，不改动记忆进度
        </p>
      </section>
    </div>
  );
}
