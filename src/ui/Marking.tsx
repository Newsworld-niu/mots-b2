import { ArrowRight, BookmarkPlus, Check } from "lucide-react";
import { CRITERION_LABEL, levelLabel, maxScore, totalScore, type EssayFeedback } from "../lib/essay";
import { ERROR_LABEL } from "../lib/writing";
import { saveNote } from "../store/essays";
import { useStore } from "../store/store";

/**
 * A marking on an official grid (each criterion 0, 1, 3 or 5): scores, comment, what went well, what to fix
 * first, and each correction. `extra` adds a criterion marked outside the AI (pronunciation, self-assessed).
 * The picture comes first (score, comment, what to fix first); what went well and the line-by-line corrections are
 * folded away until opened. With `from` (the task's title) each correction can be kept in the 错句本.
 */
export function Marking({ fb, pointTitle, extra, from, level = "B2" }: { fb: EssayFeedback; pointTitle: Map<string, string>; extra?: { key: string; score: number | null }; from?: string; level?: "B1" | "B2" }) {
  const kept = useStore((s) => s.progress.essayNotes);
  const rows: [string, number | null][] = [...Object.entries(fb.scores), ...(extra ? [[extra.key, extra.score] as [string, number | null]] : [])];
  const total = totalScore(fb) + (extra?.score ?? 0);
  const max = maxScore(fb) + (extra && extra.score !== null ? 5 : 0);
  return (
    <>
      <div className="essay-marks">
        <p className="essay-total">
          {total}
          <small>/{max}</small>
        </p>
        <dl className="essay-scores">
          {rows.map(([c, v]) => (
            <div key={c}>
              <dt>{CRITERION_LABEL[c] ?? c}</dt>
              <dd>
                <span className="essay-bar">
                  <span style={{ width: `${((v ?? 0) / 5) * 100}%` }} />
                </span>
                {v === null ? "未评" : `${v}/5 · ${levelLabel(v, level)}`}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {fb.flags && (
        <div className="essay-chips">
          {fb.flags.offTopic === "total" && <span className="chip warn-text">严重偏题</span>}
          {fb.flags.offTopic === "partial" && <span className="chip warn-text">部分偏题</span>}
          {fb.flags.wrongGenre && <span className="chip warn-text">文体错位</span>}
          {fb.flags.registerViolation && <span className="chip warn-text">语域/格式不符</span>}
          {fb.flags.pastedFromDoc && <span className="chip warn-text">照抄材料</span>}
          {fb.flags.cursoryDebate && <span className="chip warn-text">辩论敷衍</span>}
        </div>
      )}
      {fb.comment && <p className="essay-comment">{fb.comment}</p>}
      {fb.todo.length > 0 && (
        <div className="essay-box">
          <p className="eyebrow">下一步先改这些</p>
          <ol>
            {fb.todo.map((x, k) => (
              <li key={k}>{x}</li>
            ))}
          </ol>
        </div>
      )}
      {fb.strengths.length > 0 && (
        <details className="essay-fold">
          <summary>做得好的（{fb.strengths.length}）</summary>
          <ul>
            {fb.strengths.map((x, k) => (
              <li key={k}>{x}</li>
            ))}
          </ul>
        </details>
      )}
      {fb.corrections.length > 0 && (
        <details className="essay-fold">
          <summary>逐处修改（{fb.corrections.length}）</summary>
          <ul className="writing-errors essay-corrections">
            {fb.corrections.map((x, k) => {
              const have = !!kept?.some((n) => n.wrong === x.wrong && n.right === x.right);
              return (
                <li key={k}>
                  <span className="chip">{ERROR_LABEL[x.type]}</span>
                  <span lang="fr">
                    {x.wrong && <del>{x.wrong}</del>} {x.right && <ins>{x.right}</ins>}
                  </span>
                  {x.why && <small>{x.why}</small>}
                  {x.point && pointTitle.has(x.point) && (
                    <a className="link essay-point" href={`#/grammar?p=${x.point}`}>
                      练这个语法点：{pointTitle.get(x.point)} <ArrowRight size={13} />
                    </a>
                  )}
                  {from && (
                    <button className="link essay-keep" disabled={have} onClick={() => saveNote({ wrong: x.wrong, right: x.right, type: x.type, why: x.why, point: x.point, from })}>
                      {have ? (
                        <>
                          <Check size={13} /> 已存进错句本
                        </>
                      ) : (
                        <>
                          <BookmarkPlus size={13} /> 存进错句本
                        </>
                      )}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </>
  );
}
