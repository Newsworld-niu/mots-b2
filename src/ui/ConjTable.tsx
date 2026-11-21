import { useState } from "react";
import { useConj } from "../atlas/conj";
import { tableFor, TENSE_FR, TENSE_ZH, TENSES, type ConjTense, type ConjVerb } from "../lib/conjugation";

export function ConjTable({ verb, tense, highlight }: { verb: ConjVerb; tense: ConjTense; highlight?: number }) {
  return (
    <table className="conj-table" lang="fr">
      <tbody>
        {tableFor(verb, tense).map((r) => {
          // an elided word belongs with the verb: "j'étais", "que j'aime", "je m'appelle"
          const cut = r.before.endsWith("'") ? r.before.lastIndexOf(" ") + 1 : r.before.length;
          return (
            <tr key={r.person} className={r.person === highlight ? "is-on" : ""}>
              <td className="conj-td-subject">{r.before.slice(0, cut).trim()}</td>
              <td>
                {r.before.slice(cut)}
                {r.form}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}


export const AUX_NOTE = { a: "复合时态用 avoir", e: "复合时态用 être（过去分词与主语配合）", ae: "不及物用 être，带直接宾语时用 avoir" };

/** Collapsible conjugation tables on a verb's entry sheet. */
export function VerbConjugation({ id }: { id: string }) {
  const { data } = useConj();
  const [tense, setTense] = useState<ConjTense>("pres");
  const v = data?.verbs[id];
  if (!v) return null;
  return (
    <details className="block conj-entry">
      <summary className="eyebrow">变位</summary>
      <div className="conj-tabs" role="tablist">
        {TENSES.filter((t) => tableFor(v, t).length > 0).map((t) => (
          <button key={t} role="tab" aria-selected={t === tense} className={t === tense ? "is-on" : ""} onClick={() => setTense(t)} title={TENSE_ZH[t]}>
            <span lang="fr">{TENSE_FR[t]}</span>
          </button>
        ))}
      </div>
      <ConjTable verb={v} tense={tense} />
      <p className="memory-note">
        过去分词 <b lang="fr">{v.pp}</b> · {v.p ? AUX_NOTE.e : AUX_NOTE[v.a]}
      </p>
    </details>
  );
}
