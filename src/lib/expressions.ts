/**
 * 表达: connectors by function, argument frames, topic collocations, register (语域) and formal-letter formulas,
 * as reviewable cards. Review is productive: the learner sees the Chinese, the function and a sentence with a
 * gap, and types the French. The content is written for this site (待核对).
 *
 * In an example, `[…]` marks the gap; its text is the expected answer (`alt`: other accepted wordings).
 * Card ids come from the group and the French, so they stay stable while the wording of a card does not change.
 */
import { foldAccents, spellingVerdict } from "./accent";
import { TOPICS } from "./exam";
import { CONNECTORS, FRAMES } from "./expressions-conn";
import { COLLOCATIONS, LETTER, REGISTERS } from "./expressions-more";

export type ExprGroup = "conn" | "arg" | "col" | "reg" | "lettre";

export const EXPR_GROUPS: [ExprGroup, string, string][] = [
  ["conn", "连接词", "按功能：补充、对立、让步、原因、结果、举例、列举、总结"],
  ["arg", "论证句型", "表达观点，确定（直陈式）与怀疑、评价（虚拟式），反驳"],
  ["col", "话题搭配", "考试常见话题的固定搭配"],
  ["reg", "语域", "口语说法换成写作用的说法：familier → courant → soutenu"],
  ["lettre", "正式信函", "称呼、开头、请求、投诉、申请、结尾礼貌语"],
];

/** The same meaning at the three levels of language; a level may be missing. */
export interface Register {
  familier?: string;
  courant?: string;
  soutenu?: string;
}

export interface Expression {
  id: string;
  group: ExprGroup;
  /** What the expression does, shown as the cue: "对立 · 副词", "称呼". */
  fn: string;
  fr: string;
  zh: string;
  /** Example with the gap in brackets. */
  ex: string;
  exZh: string;
  /** Construction or usage note: "+ 虚拟式". */
  note?: string;
  /** Other accepted answers for the gap. */
  alt?: string[];
  reg?: Register;
  /** Exam topic of a collocation (TOPICS id). */
  topic?: string;
}

/** A card as written in the data files: [French, Chinese, example with gap, Chinese of the example, extras]. */
export type RawExpr = [fr: string, zh: string, ex: string, exZh: string, more?: Pick<Expression, "note" | "alt" | "reg">];

export const exprSlug = (s: string) =>
  foldAccents(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

const fromRaw = (group: ExprGroup, fn: string, [fr, zh, ex, exZh, more]: RawExpr): Expression => ({ id: `${group}-${exprSlug(fr)}`, group, fn, fr, zh, ex, exZh, ...more });

const collocations = (): Expression[] =>
  COLLOCATIONS.flatMap(([topicId, list]) => {
    const topic = TOPICS.find((t) => t.id === topicId);
    return list.flatMap(([fr, ex, exZh]) => {
      const zh = topic?.vocab.find(([v]) => v === fr)?.[1];
      return topic && zh ? [{ id: `col-${exprSlug(fr)}`, group: "col" as const, fn: `话题 · ${topic.zh}`, fr, zh, ex, exZh, topic: topicId }] : [];
    });
  });

/** Every card, in teaching order: connectors, frames, collocations, register, letters. */
export const EXPRESSIONS: Expression[] = [
  ...CONNECTORS.flatMap(([fn, list]) => list.map((r) => fromRaw("conn", fn, r))),
  ...FRAMES.flatMap(([fn, list]) => list.map((r) => fromRaw("arg", fn, r))),
  ...collocations(),
  ...REGISTERS.flatMap(([fn, list]) => list.map((r) => fromRaw("reg", fn, r))),
  ...LETTER.flatMap(([fn, list]) => list.map((r) => fromRaw("lettre", fn, r))),
];

export const EXPR_BY_ID = new Map(EXPRESSIONS.map((e) => [e.id, e]));

/** Card ids in the progress: group prefix and slug. */
export const EXPR_ID = /^(conn|arg|col|reg|lettre)-[a-z0-9-]{1,50}$/;

/** The example split at its gap. */
export function gapOf(ex: string) {
  const m = /\[([^\]]+)\]/.exec(ex);
  if (!m) return { before: ex, answer: "", after: "" };
  return { before: ex.slice(0, m.index), answer: m[1], after: ex.slice(m.index + m[0].length) };
}

/** The example with the answer filled in. */
export const filledEx = (ex: string) => ex.replace(/\[([^\]]+)\]/, "$1");

/** Leading / trailing punctuation does not count ("Cependant," = "cependant"). */
const trimPunct = (s: string) => s.replace(/^[\s,;:.!?«»"]+|[\s,;:.!?…«»"]+$/g, "");

/** Accepted answers: the gap, the alternatives, and an elided word written out ("parce qu'" → "parce que"). */
export function answersOf(e: Expression): string[] {
  const base = [gapOf(e.ex).answer, ...(e.alt ?? [])].map(trimPunct).filter(Boolean);
  const out = new Set(base);
  for (const a of base) if (/\p{L}['’]$/u.test(a)) out.add(a.replace(/['’]$/, "e"));
  return [...out];
}

export type ExprVerdict = "exact" | "accent" | "synonym" | "wrong";

/**
 * "exact": an accepted answer. "accent": right letters, wrong accents. "synonym": another connector or frame of
 * the same function (it fits the same slot: pourtant for cependant); `other` is that card. "wrong": anything else.
 */
export function checkExpr(typed: string, e: Expression, all: readonly Expression[] = EXPRESSIONS): { verdict: ExprVerdict; other?: Expression } {
  const t = trimPunct(typed);
  if (!t) return { verdict: "wrong" };
  let best: "exact" | "accent" | "wrong" = "wrong";
  for (const a of answersOf(e)) {
    const v = spellingVerdict(t, a);
    if (v === "exact") return { verdict: "exact" };
    if (v === "accent") best = "accent";
  }
  if (best === "accent") return { verdict: "accent" };
  if (e.group !== "conn" && e.group !== "arg") return { verdict: "wrong" };
  const other = all.find((o) => o.id !== e.id && o.group === e.group && o.fn === e.fn && [o.fr, ...answersOf(o)].some((a) => spellingVerdict(t, trimPunct(a)) !== "wrong"));
  return other ? { verdict: "synonym", other } : { verdict: "wrong" };
}

/** A hint: the first letter of each word, the other letters hidden ("en revanche" → "e_ r_______"). */
export const maskOf = (answer: string) => answer.replace(/\p{L}+/gu, (w) => w[0] + "_".repeat(w.length - 1));
