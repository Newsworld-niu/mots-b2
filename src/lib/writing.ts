/**
 * 成句输出练习（中译法、造句）: what a marked sentence looks like, the free checks done before asking the AI,
 * and the word diff between what the learner wrote and the corrected sentence.
 */
import { clean } from "./typing";

export type Verdict = "correct" | "almost" | "wrong";

export const ERROR_TYPES = ["spelling", "accent", "gender", "agreement", "conjugation", "tense", "article", "preposition", "word-choice", "word-order", "meaning", "other"] as const;
export type ErrorType = (typeof ERROR_TYPES)[number];

export const ERROR_LABEL: Record<ErrorType, string> = {
  spelling: "拼写",
  accent: "重音符号",
  gender: "阴阳性",
  agreement: "性数配合",
  conjugation: "变位",
  tense: "时态语式",
  article: "冠词",
  preposition: "介词",
  "word-choice": "用词",
  "word-order": "语序",
  meaning: "意思",
  other: "其他",
};

export const VERDICT_LABEL: Record<Verdict, string> = { correct: "正确", almost: "基本正确", wrong: "需要改" };

export interface WritingError {
  /** The words of the learner's sentence that are wrong, as written. */
  wrong: string;
  right: string;
  type: ErrorType;
  /** Why, in Chinese. */
  why: string;
}

export interface Feedback {
  verdict: Verdict;
  /** The learner's sentence with only the errors fixed (the sentence itself when it was right). */
  corrected: string;
  errors: WritingError[];
  /** One sentence of comment, in Chinese. */
  comment: string;
  /** A more natural way to say it, or "". */
  natural: string;
}

/** Compared without case, the spaces French puts before ? ! : ; and closing punctuation. Accents count. */
const loose = (s: string) =>
  clean(s)
    .toLowerCase()
    .replace(/\s+([?!:;»])/g, "$1")
    .replace(/«\s+/g, "«")
    .replace(/[.!?…\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim();

/** The same sentence, give or take capitals and the full stop: no need to ask the AI. */
export const sameSentence = (a: string, b: string) => !!loose(a) && loose(a) === loose(b);

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Make an AI answer safe to show, and keep its verdict consistent with what it corrected. */
export function sanitizeFeedback(raw: unknown, answer: string): Feedback {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: WritingError[] = (Array.isArray(r.errors) ? r.errors : [])
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => ({ wrong: text(e.wrong), right: text(e.right), type: (ERROR_TYPES as readonly string[]).includes(e.type as string) ? (e.type as ErrorType) : "other", why: text(e.why) }))
    .filter((e) => (e.wrong || e.right) && e.wrong !== e.right)
    .slice(0, 8);
  const corrected = text(r.corrected) || answer.trim();
  let verdict: Verdict = r.verdict === "correct" || r.verdict === "almost" || r.verdict === "wrong" ? r.verdict : "wrong";
  // "correct" with corrections is not correct; too many slips cannot stay "almost"; zero diffs shouldn't stay "almost"
  if (verdict === "correct" && (errors.length > 0 || !sameSentence(corrected, answer))) verdict = "almost";
  if (verdict === "almost" && errors.length >= 3) verdict = "wrong";
  else if (verdict === "almost" && errors.length === 0 && sameSentence(corrected, answer)) verdict = "correct";
  const natural = text(r.natural);
  return { verdict, corrected, errors, comment: text(r.comment), natural: natural && !sameSentence(natural, corrected) ? natural : "" };
}

/** Sound cue for sentence grading verdicts (keeps "almost" distinct from full "correct"). */
export function verdictCue(verdict: Verdict): "correct" | "tap" | "wrong" {
  return verdict === "wrong" ? "wrong" : verdict === "almost" ? "tap" : "correct";
}

export interface DiffToken {
  t: string;
  /** false: this word is not in the other sentence (removed from the answer, or new in the correction). */
  ok: boolean;
}

/** Word diff (longest common subsequence) between what was written and the corrected sentence. */
export function diffWords(written: string, corrected: string): { written: DiffToken[]; corrected: DiffToken[] } {
  const a = clean(written).trim().split(/\s+/).filter(Boolean);
  const b = clean(corrected).trim().split(/\s+/).filter(Boolean);
  // capitals and punctuation are not marked: "merci" and "Merci !" are the same words
  const key = (t: string) => t.toLowerCase().replace(/^[.,;:!?…«»"()]+|[.,;:!?…«»"()]+$/g, "");
  const ka = a.map(key);
  const kb = b.map(key);
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) lcs[i][j] = ka[i] === kb[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out = { written: [] as DiffToken[], corrected: [] as DiffToken[] };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (ka[i] === kb[j]) {
      out.written.push({ t: a[i++], ok: true });
      out.corrected.push({ t: b[j++], ok: true });
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) out.written.push({ t: a[i], ok: !ka[i++] });
    else out.corrected.push({ t: b[j], ok: !kb[j++] });
  }
  while (i < a.length) out.written.push({ t: a[i], ok: !ka[i++] });
  while (j < b.length) out.corrected.push({ t: b[j], ok: !kb[j++] });
  return out;
}

/** The sentence a 中译法 item asks for: the first example with a Chinese translation, not too long to type. */
export function translatable<T extends { en: string; zh: string }>(examples: T[], max = 110): T | undefined {
  return examples.find((x) => x.zh.trim() && x.en.trim() && x.en.length <= max);
}
