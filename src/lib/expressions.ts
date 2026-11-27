/**
 * 表达: connectors by function, argument frames, topic collocations, register (语域) and formal-letter formulas,
 * as reviewable cards. Review is productive: the learner sees the Chinese, the function and a sentence with a
 * gap, and types the French. The content is written for this site.
 *
 * In an example, `[…]` marks the gap; its text is the expected answer (`alt`: other wordings of the same answer,
 * accepted as correct; `syn`: other expressions that make an equally grammatical and natural sentence in that exact
 * gap, accepted as a near miss). Another card of the same function that is not in `syn` does NOT fit the gap
 * (grâce à in "retardé [en raison de] la grève", si bien que in "nous irons [donc] mardi") and is graded wrong.
 * Card ids come from the group and the French, so they stay stable while the wording of a card does not change.
 */
import { foldAccents, spellingVerdict } from "./accent";
import { TOPICS } from "./exam";
import { CONNECTORS, FRAMES } from "./expressions-conn";
import { COLLOCATIONS, LETTER, REFORMULATIONS, REGISTERS } from "./expressions-more";

export type ExprGroup = "conn" | "arg" | "col" | "reg" | "lettre" | "reform";

export const EXPR_GROUPS: [ExprGroup, string, string][] = [
  ["conn", "连接词", "按功能：补充、对立、让步、原因、结果、举例、列举、总结"],
  ["arg", "论证句型", "表达观点，确定（直陈式）与怀疑、评价（虚拟式），反驳"],
  ["col", "话题搭配", "考试常见话题的固定搭配"],
  ["reg", "语域", "口语说法换成写作用的说法：familier → courant → soutenu"],
  ["lettre", "正式信函", "称呼、开头、请求、投诉、申请、结尾礼貌语"],
  ["reform", "同义改写", "把基础句子改写成 B2 论证与同义替换表达（reformulation）"],
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
  /** Other accepted answers for the gap (same expression: gender, spelling, contraction). */
  alt?: string[];
  /**
   * Slot-compatible synonyms: other expressions that make a grammatical, natural sentence with the same meaning in
   * this exact gap (toutefois for "[Cependant], …"). Accepted as a near miss ("synonym").
   */
  syn?: string[];
  reg?: Register;
  /** Pure-French clue / explanation (used when Chinese translation is hidden before answering). */
  frDef?: string;
  /** Source A2/B1 French wording to reformulate into B2 French (reformulation group). */
  reformFrom?: string;
  /** Exam topic of a collocation (TOPICS id). */
  topic?: string;
}

/** A card as written in the data files: [French, Chinese, example with gap, Chinese of the example, extras]. */
export type RawExpr = [fr: string, zh: string, ex: string, exZh: string, more?: Pick<Expression, "note" | "alt" | "syn" | "reg" | "frDef" | "reformFrom">];

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

/** Every card, in teaching order: connectors, frames, collocations, register, letters, reformulation. */
export const EXPRESSIONS: Expression[] = [
  ...CONNECTORS.flatMap(([fn, list]) => list.map((r) => fromRaw("conn", fn, r))),
  ...FRAMES.flatMap(([fn, list]) => list.map((r) => fromRaw("arg", fn, r))),
  ...collocations(),
  ...REGISTERS.flatMap(([fn, list]) => list.map((r) => fromRaw("reg", fn, r))),
  ...LETTER.flatMap(([fn, list]) => list.map((r) => fromRaw("lettre", fn, r))),
  ...REFORMULATIONS.flatMap(([fn, list]) => list.map((r) => fromRaw("reform", fn, r))),
];

export const EXPR_BY_ID = new Map(EXPRESSIONS.map((e) => [e.id, e]));

/** Oral debate & problématique extraction categories shown in the speaking studio cheat sheet. */
export const DEBATE_PHRASE_FNS = [
  "反驳、让步论证",
  "辩论 · 反驳与质询",
  "辩论 · 让步与限定",
  "辩论 · 澄清与重述",
  "口语 · 思考填充语",
] as const;

/** Oral debate cards grouped by function, drawn from EXPRESSIONS. */
export const debatePhrases = (): [fn: string, Expression[]][] =>
  DEBATE_PHRASE_FNS.map((fn) => [fn, EXPRESSIONS.filter((e) => e.group === "arg" && e.fn === fn)] as [string, Expression[]]).filter(([, xs]) => xs.length > 0);

export * from "./expr-schema";

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

/** An elided word written out too ("parce qu'" → "parce que", "en raison d'" → "en raison de"). */
const withFullForms = (list: string[]) => {
  const out = new Set(list);
  for (const a of list) if (/\p{L}['’]$/u.test(a)) out.add(a.replace(/['’]$/, "e"));
  return [...out];
};

/** Accepted answers: the gap, the alternatives, and an elided word written out ("parce qu'" → "parce que"). */
export function answersOf(e: Expression): string[] {
  return withFullForms([gapOf(e.ex).answer, ...(e.alt ?? [])].map(trimPunct).filter(Boolean));
}

/** The slot-compatible synonyms of a card (see `syn`), elided words written out too. */
export function synonymsOf(e: Expression): string[] {
  return withFullForms((e.syn ?? []).map(trimPunct).filter(Boolean));
}

export type ExprVerdict = "exact" | "accent" | "synonym" | "wrong";

const matches = (typed: string, list: readonly string[]) => list.some((a) => spellingVerdict(typed, trimPunct(a)) !== "wrong");

/**
 * "exact": an accepted answer. "accent": right letters, wrong accents. "synonym": an expression listed in the
 * card's `syn`, which fits this very gap (toutefois for "[Cependant], …"); `other` is its card when it has one.
 * "wrong": anything else; when what was typed is another card of the same function, `other` is that card, so the
 * learner can be told why it does not fit here (wrong construction, elision or contraction, or a different nuance:
 * grâce à is for a good cause, faute de for a lack).
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
  const cardOf = (sameFn: boolean) =>
    all.find((o) => o.id !== e.id && (!sameFn || (o.group === e.group && o.fn === e.fn)) && matches(t, [o.fr, ...answersOf(o)]));
  if (matches(t, synonymsOf(e))) return { verdict: "synonym", other: cardOf(true) ?? cardOf(false) };
  const other = cardOf(true);
  return other ? { verdict: "wrong", other } : { verdict: "wrong" };
}

/** A hint: the first letter of each word, the other letters hidden ("en revanche" → "e_ r_______"). */
export const maskOf = (answer: string) => answer.replace(/\p{L}+/gu, (w) => w[0] + "_".repeat(w.length - 1));
