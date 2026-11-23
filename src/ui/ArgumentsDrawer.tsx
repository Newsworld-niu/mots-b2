import { argumentsFor } from "../lib/arguments-bank";
import { topicOf } from "../lib/exam";

/** Collapsible Banque d'arguments drawer shared between PE (Essay) and PO (Speaking). */
export function ArgumentsDrawer({ topic }: { topic?: string }) {
  const bank = argumentsFor(topic);
  if (!bank) return null;
  const meta = topicOf(bank.topic);
  return (
    <details className="arguments-drawer">
      <summary>正反论点与法国实例库（Banque d&apos;arguments{meta ? ` · ${meta.zh}` : ""}）</summary>
      <div className="arguments-body">
        <p className="arguments-tension muted small" lang="fr">
          <strong>核心张力：</strong>
          {bank.tensionFr}
        </p>
        <div className="arguments-cols">
          <div className="arguments-col">
            <h4 className="eyebrow">正方思路（Thèse / Pour）</h4>
            <ul>
              {bank.pro.map((a, i) => (
                <li key={i}>
                  <b>{a.point}</b>
                  <span lang="fr">{a.explanation}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="arguments-col">
            <h4 className="eyebrow">反方与让步（Antithèse / Nuance）</h4>
            <ul>
              {bank.con.map((a, i) => (
                <li key={i}>
                  <b>{a.point}</b>
                  <span lang="fr">{a.explanation}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="arguments-examples">
          <h4 className="eyebrow">真实法国社会参考案例（Exemples concrets）</h4>
          <ul>
            {bank.examples.map((ex, i) => (
              <li key={i}>
                <b>{ex.label}</b>
                <span lang="fr">{ex.detailFr}</span>
                <small className="muted">{ex.detailZh}</small>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
