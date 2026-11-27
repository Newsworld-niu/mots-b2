/**
 * The stored shape of a saved 阅读 text and its validator, kept apart from reader.ts (tokenising, annotation)
 * so the store's sanitizer and the vault do not pull the text pipeline into the entry bundle.
 */
/* ---------- saved texts ---------- */

export interface QuizItem {
  /** Question and 3 B2 options written in French; `why` gives the Chinese explanation. */
  q: string;
  options: string[];
  /** Index of the right option (0–2). */
  answer: number;
  why: string;
}

export interface SavedText {
  id: string;
  title: string;
  text: string;
  created: number;
  /** paste: typed or pasted; file: a file, photo or scan; ai: written by the AI for the learner's words. */
  src: "paste" | "file" | "ai";
  /** AI texts: the level asked for (A1 … B2), the Chinese translation, the questions and the word ids it was written around. */
  level?: string;
  zh?: string;
  quiz?: QuizItem[];
  targets?: string[];
  /** When the learner marked it read. */
  read?: number;
}

export const MAX_TEXTS = 60;
export const MAX_TEXT_LENGTH = 12000;
export const TEXT_ID = /^t-[a-z0-9]{4,24}$/;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function sanitizeQuiz(v: unknown): QuizItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(isObj)
    .map((x) => {
      const rawOpts = Array.isArray(x.options) ? x.options.map((o) => str(o, 200)).filter(Boolean).slice(0, 4) : [];
      let answer = typeof x.answer === "number" ? Math.round(x.answer) : -1;
      let options: string[];
      if (rawOpts.length === 4 && answer >= 0 && answer < 4) {
        // Normalize legacy 4-option items to post-2020 3-option DELF B2 QCM while preserving the right answer.
        const dropIdx = answer === 3 ? 2 : 3;
        options = rawOpts.filter((_, idx) => idx !== dropIdx);
        if (answer > dropIdx) answer -= 1;
      } else {
        options = rawOpts.slice(0, 3);
      }
      return { q: str(x.q, 300), options, answer, why: str(x.why, 400) };
    })
    .filter((x) => x.q && x.options.length >= 2 && new Set(x.options).size === x.options.length && x.answer >= 0 && x.answer < x.options.length)
    .slice(0, 5);
}

/** Saved texts from stored data or a backup (untrusted): newest first, at most MAX_TEXTS. */
export function sanitizeTexts(v: unknown): SavedText[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const seen = new Set<string>();
  const out: SavedText[] = [];
  for (const x of v) {
    if (!isObj(x) || typeof x.id !== "string" || !TEXT_ID.test(x.id) || seen.has(x.id)) continue;
    const text = typeof x.text === "string" ? x.text.replace(/\r/g, "").trim().slice(0, MAX_TEXT_LENGTH) : "";
    if (!text) continue;
    seen.add(x.id);
    const t: SavedText = {
      id: x.id,
      title: str(x.title, 80) || titleOf(text),
      text,
      created: typeof x.created === "number" && Number.isFinite(x.created) && x.created > 0 ? x.created : 0,
      src: x.src === "ai" || x.src === "file" ? x.src : "paste",
    };
    if (/^[ABC][12]$/.test(x.level as string)) t.level = x.level as string;
    const zh = typeof x.zh === "string" ? x.zh.trim().slice(0, MAX_TEXT_LENGTH) : "";
    if (zh) t.zh = zh;
    const quiz = sanitizeQuiz(x.quiz);
    if (quiz.length) t.quiz = quiz;
    if (Array.isArray(x.targets)) {
      const ids = x.targets.filter((i): i is string => typeof i === "string" && i.length <= 80).slice(0, 20);
      if (ids.length) t.targets = ids;
    }
    if (typeof x.read === "number" && Number.isFinite(x.read) && x.read > 0) t.read = x.read;
    out.push(t);
    if (out.length >= MAX_TEXTS) break;
  }
  return out.length ? out : undefined;
}

/** A title for a text that has none: its first line, cut at a word. */
export function titleOf(text: string, max = 40) {
  const line = text.trim().split("\n")[0].trim();
  if (line.length <= max) return line;
  const cut = line.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${(at > max / 2 ? cut.slice(0, at) : cut).replace(/[\s,;:«"(]+$/, "")}…`;
}
