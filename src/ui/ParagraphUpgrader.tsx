import { ArrowRight, BookmarkPlus, Check, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ready, useAiConfig } from "../ai/config";
import { upgradeParagraph, type ParagraphUpgrade } from "../ai/tasks";
import { countWords, type Genre } from "../lib/essay";
import { href } from "../lib/router";
import { SAMPLE_PARAGRAPH_UPGRADE } from "../lib/ai-samples";
import type { ErrorType } from "../lib/writing";
import { saveNote } from "../store/essays";
import { toast } from "./Toast";

/** Map paragraph upgrade technique label to a SavedNote ErrorType for FSRS reflow. */
export function inferUpgradeErrorType(technique: string): ErrorType {
  if (/时态|虚拟|条件/.test(technique)) return "tense";
  if (/搭配|语域|词汇|用词|精准/.test(technique)) return "word-choice";
  if (/介词/.test(technique)) return "preposition";
  if (/配合|性数/.test(technique)) return "agreement";
  if (/结构|从句|名词|衔接|语序/.test(technique)) return "word-order";
  return "word-choice";
}

export function buildUpgradeNote({
  change,
  draft,
  title,
}: {
  change: ParagraphUpgrade["changes"][number];
  draft: string;
  title: string;
}) {
  return {
    wrong: (change.before || draft.slice(0, 140)).trim(),
    right: change.after.trim(),
    type: inferUpgradeErrorType(change.technique),
    why: [change.technique, change.why].filter(Boolean).join(" · "),
    point: "",
    from: `${title} · 段落升格`,
  };
}

/** Interactive AI coach upgrading one B1/draft paragraph into strong B2 with technique breakdowns. */
export function ParagraphUpgrader({ essayText, genre, title, level }: { essayText: string; genre: Genre; title: string; level: "B1" | "B2" }) {
  const ai = useAiConfig();
  const candidates = useMemo(
    () =>
      essayText
        .split(/\n+/)
        .map((p) => p.trim())
        .filter((p) => countWords(p) >= 12),
    [essayText],
  );
  const [idx, setIdx] = useState(0);
  const [draft, setDraft] = useState(() => candidates[0] ?? essayText.trim());
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<ParagraphUpgrade | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<number>>(() => new Set());
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    setIdx(0);
    setDraft(candidates[0] ?? essayText.trim());
    setRes(null);
    setSavedKeys(new Set());
  }, [candidates, essayText]);

  useEffect(() => () => ctrl.current?.abort(), []);

  const pick = (i: number) => {
    setIdx(i);
    setDraft(candidates[i] ?? "");
    setRes(null);
    setSavedKeys(new Set());
  };

  const saveOne = (c: ParagraphUpgrade["changes"][number], k: number) => {
    const added = saveNote(buildUpgradeNote({ change: c, draft, title }));
    setSavedKeys((prev) => new Set(prev).add(k));
    toast(added ? "已存入 FSRS 错句/升格本，可去错题中心间隔复习" : "已在错句/升格本中，无需重复添加", "info");
  };

  const run = async () => {
    if (!draft.trim()) return;
    const c = new AbortController();
    ctrl.current = c;
    setBusy(true);
    try {
      const out = await upgradeParagraph({ paragraph: draft, genre, topic: title, level }, c.signal);
      if (!c.signal.aborted) setRes(out);
    } catch (err) {
      if (!c.signal.aborted) toast((err as Error).message || "段落升格失败，请重试", "warn");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="essay-box essay-upgrader">
      <p className="eyebrow">AI B1→B2 段落升格教练</p>
      <p className="muted small">选一段你想拔高的正文（保留原意，重点示范名词化、从句降噪与地道 B2 搭配替换）。</p>
      {candidates.length > 1 && (
        <div className="exam-chips" role="group" aria-label="选择要升格的段落">
          {candidates.map((p, i) => (
            <button
              key={i}
              type="button"
              className={idx === i && draft.trim() === p ? "is-on" : ""}
              aria-pressed={idx === i && draft.trim() === p}
              onClick={() => pick(i)}
            >
              第 {i + 1} 段（{countWords(p)} 词）
            </button>
          ))}
        </div>
      )}
      <textarea
        className="writing-input essay-notes"
        lang="fr"
        rows={4}
        value={draft}
        readOnly={busy}
        onChange={(e) => setDraft(e.target.value.slice(0, 1500))}
        placeholder="粘贴或修改你想升格的一段法语…"
        spellCheck={false}
        aria-label="待升格的法语段落"
      />
      <div className="writing-actions">
        {ready.text(ai) ? (
          busy ? (
            <>
              <span className="muted small">正在提炼名词化与复杂句型…</span>
              <button type="button" className="btn btn-ghost" onClick={() => ctrl.current?.abort()}>
                取消
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" disabled={countWords(draft) < 6} onClick={() => void run()}>
              <Sparkles size={15} /> 升格为强 B2 段落
            </button>
          )
        ) : (
          <div className="ai-sample-inline">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRes(SAMPLE_PARAGRAPH_UPGRADE)}>
              <Sparkles size={15} /> 查看 B1→B2 升格样张（免 Key）
            </button>
            <span className="muted small">
              开启实时升格需在 <a className="link" href={href({ page: "me" })}>我的 → AI 接口</a> 贴入 1 个 Key。
            </span>
          </div>
        )}
      </div>
      {res && (
        <div className="essay-upgrader-res">
          <p className="eyebrow">升格示范（保留你的原意）</p>
          <p className="essay-text" lang="fr">
            {res.upgraded}
          </p>
          {res.changes.length > 0 && (
            <ul className="writing-errors essay-corrections">
              {res.changes.map((c, k) => (
                <li key={k}>
                  <span className="chip">{c.technique}</span>
                  <span lang="fr">
                    {c.before && (
                      <>
                        <del>{c.before}</del> <ArrowRight size={13} />{" "}
                      </>
                    )}
                    <ins>{c.after}</ins>
                  </span>
                  {c.why && <small>{c.why}</small>}
                  <button
                    type="button"
                    className={`btn btn-ghost btn-xs ${savedKeys.has(k) ? "is-done" : ""}`}
                    onClick={() => saveOne(c, k)}
                  >
                    {savedKeys.has(k) ? <Check size={13} /> : <BookmarkPlus size={13} />}
                    {savedKeys.has(k) ? "已存入 FSRS 升格本" : "存进 FSRS 错句/升格本"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {res.takeaway && <p className="muted small">关键收获：{res.takeaway}</p>}
        </div>
      )}
    </div>
  );
}
