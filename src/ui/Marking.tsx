import { ArrowRight } from "lucide-react";
import { CRITERION_LABEL, LEVEL_LABEL, maxScore, totalScore, type EssayFeedback } from "../lib/essay";
import { ERROR_LABEL } from "../lib/writing";

/**
 * A marking on an official grid (each criterion 0, 1, 3 or 5): scores, comment, what went well, what to fix
 * first, and each correction. `extra` adds a criterion marked outside the AI (pronunciation, self-assessed).
 */
export function Marking({ fb, pointTitle, extra }: { fb: EssayFeedback; pointTitle: Map<string, string>; extra?: { key: string; score: number | null } }) {
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
                {v === null ? "未评" : `${v}/5 · ${LEVEL_LABEL[v] ?? ""}`}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {fb.comment && <p className="essay-comment">{fb.comment}</p>}
      {fb.strengths.length + fb.todo.length > 0 && (
        <div className="essay-cols">
          {fb.strengths.length > 0 && (
            <div className="essay-box">
              <p className="eyebrow">做得好的</p>
              <ul>
                {fb.strengths.map((x, k) => (
                  <li key={k}>{x}</li>
                ))}
              </ul>
            </div>
          )}
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
        </div>
      )}
      {fb.corrections.length > 0 && (
        <div className="essay-box">
          <p className="eyebrow">逐处修改（{fb.corrections.length}）</p>
          <ul className="writing-errors essay-corrections">
            {fb.corrections.map((x, k) => (
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
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
