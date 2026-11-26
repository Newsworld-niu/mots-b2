/* Structured grammar typography: marked text ({v:…} {p:…} {c:…} {a:…} {k:…}), formulas, comparison tables,
 * and ✗ / ✓ pitfall cards. Marks are for reading only: speech, copying and search use stripGrammarMarks. */
import { Check, Target, X } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import {
  parseGrammarMarks,
  stripGrammarMarks,
  type GrammarMarkKind,
  type GrammarPitfall,
  type GrammarPoint,
  type GrammarTable,
} from "../../lib/grammar";
import { Speak } from "../../ui/Speak";

export const MARK_LABEL: Record<GrammarMarkKind, string> = {
  v: "动词变化",
  p: "介词",
  c: "代词",
  a: "配合",
  k: "引导词",
};
const MARK_ORDER: GrammarMarkKind[] = ["v", "p", "c", "a", "k"];

const HAS_MARK = /\{[vpcak]:[^{}]+\}/;
export const hasGrammarMarks = (s: string | undefined) => !!s && HAS_MARK.test(s);

/** Does the point's reading text use any structure mark (to show the colour legend)? */
export function pointHasMarks(p: GrammarPoint) {
  const texts = [
    p.intro,
    ...p.rules.flatMap((r) => [r.text, ...(r.formula ?? []), ...r.ex.flat()]),
    ...(p.tables ?? []).flatMap((t) => [...t.headers, ...t.rows.flat()]),
    ...(p.pitfalls ?? []).flatMap((x) => [x.wrong, x.right]),
  ];
  return texts.some(hasGrammarMarks);
}

function markNode(text: string, mark: GrammarMarkKind, affix: boolean | undefined, key: number) {
  return (
    <span key={key} className={`${affix ? "gm-affix" : "gm-pill"} gm-${mark}`} title={MARK_LABEL[mark]}>
      {text}
    </span>
  );
}

/** Marked text; plain parts can be passed through `plain` (to set operators of a formula apart). */
function renderMarked(text: string, plain: (s: string, key: number) => ReactNode = (s) => s) {
  return parseGrammarMarks(text).map((seg, i) =>
    seg.mark ? markNode(seg.text, seg.mark, seg.affix, i) : <Fragment key={i}>{plain(seg.text, i)}</Fragment>,
  );
}

/** Text with structure marks shown in colour (word endings underlined, whole words as soft pills). */
export function RichGrammarText({ text, lang, className }: { text: string; lang?: string; className?: string }) {
  if (!hasGrammarMarks(text)) {
    return lang || className ? (
      <span lang={lang} className={className}>
        {text}
      </span>
    ) : (
      <>{text}</>
    );
  }
  return (
    <span lang={lang} className={className}>
      {renderMarked(text)}
    </span>
  );
}

const OPERATOR = /(\s*(?:→|=>|\+|\/|=)\s*)/;
function withOperators(s: string, key: number) {
  return s.split(OPERATOR).map((part, i) =>
    OPERATOR.test(part) ? (
      <span key={`${key}-${i}`} className="gram-op">
        {part.trim()}
      </span>
    ) : (
      <Fragment key={`${key}-${i}`}>{part}</Fragment>
    ),
  );
}

/** Structure formulas, one per line: « sujet + {v:verbe} → … ». */
export function FormulaBlock({ formulas }: { formulas: readonly string[] }) {
  if (!formulas.length) return null;
  return (
    <div className="gram-formula" role="group" aria-label="结构公式">
      {formulas.map((f, i) => (
        <p key={i} className="gram-formula-line" aria-label={stripGrammarMarks(f)}>
          {renderMarked(f, withOperators)}
        </p>
      ))}
    </div>
  );
}

/** A comparison table that scrolls on its own on a narrow screen (never the page). */
export function GrammarTableView({ table, id }: { table: GrammarTable; id?: string }) {
  return (
    <figure className="gram-table" id={id}>
      <figcaption>
        <b>
          <RichGrammarText text={table.title} />
        </b>
        {table.caption && (
          <small>
            <RichGrammarText text={table.caption} />
          </small>
        )}
      </figcaption>
      <div className="gram-table-scroll" tabIndex={0} role="region" aria-label={stripGrammarMarks(table.title)}>
        <table>
          <thead>
            <tr>
              {table.headers.map((h, i) => (
                <th key={i} scope="col">
                  <RichGrammarText text={h} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) =>
                  c === 0 ? (
                    <th key={c} scope="row">
                      <RichGrammarText text={cell} />
                    </th>
                  ) : (
                    <td key={c}>
                      <RichGrammarText text={cell} />
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.note && (
        <p className="gram-table-note">
          <RichGrammarText text={table.note} />
        </p>
      )}
    </figure>
  );
}

/** ✗ the usual mistake / ✓ the French way, with why; a pitfall with a tag can be drilled on its own. */
export function PitfallList({
  pitfalls,
  onDrillTag,
  canDrill,
}: {
  pitfalls: readonly GrammarPitfall[];
  onDrillTag?: (tag: string) => void;
  /** Whether a tag has drills to practise. */
  canDrill?: (tag: string) => boolean;
}) {
  if (!pitfalls.length) return null;
  return (
    <ul className="gram-pitfalls">
      {pitfalls.map((x, i) => (
        <li key={i} className="gram-pitfall">
          <p className="gram-pf-wrong">
            <span className="gram-pf-mark" aria-label="易错写法">
              <X size={14} strokeWidth={2.4} />
            </span>
            <s lang="fr">
              <RichGrammarText text={x.wrong} />
            </s>
          </p>
          <p className="gram-pf-right">
            <span className="gram-pf-mark" aria-label="地道法语">
              <Check size={14} strokeWidth={2.4} />
            </span>
            <span lang="fr">
              <RichGrammarText text={x.right} />
            </span>
            <Speak url={null} text={stripGrammarMarks(x.right)} size="sm" />
          </p>
          <p className="gram-pf-why">
            <RichGrammarText text={x.why} />
          </p>
          {x.tag && onDrillTag && (!canDrill || canDrill(x.tag)) && (
            <button type="button" className="btn btn-ghost btn-sm gram-pf-drill" onClick={() => onDrillTag(x.tag!)}>
              <Target size={14} /> 单练此易错点
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The five colours of the marks, as a small key. */
export function MarkLegend() {
  return (
    <p className="gram-legend" aria-label="结构高亮图例">
      {MARK_ORDER.map((k) => (
        <span key={k} className={`gm-pill gm-${k}`}>
          {MARK_LABEL[k]}
        </span>
      ))}
    </p>
  );
}
