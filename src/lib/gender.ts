/** Noun gender helpers for the un/une quiz and article display. */

export type Gender = "m" | "f";
export type ArticleChoice = "un" | "une";

export const ARTICLE: Record<Gender, ArticleChoice> = { m: "un", f: "une" };
export const ARTICLE_CHOICES: ArticleChoice[] = ["un", "une"];

export const genderOfArticle = (a: string): Gender | null => (a === "un" ? "m" : a === "une" ? "f" : null);

/** True when the chosen article matches the noun's gender. */
export const isArticleCorrect = (choice: string, g: Gender | undefined) => !!g && genderOfArticle(choice) === g;

/** CSS modifier for an article chip: masculine, feminine, both, or plural. */
export function articleTone(art: string | undefined) {
  if (art === "un") return "art-m";
  if (art === "une") return "art-f";
  if (art === "un/une") return "art-mf";
  if (art === "des") return "art-pl";
  return "";
}

/** What the spelling question asks for: a quizzed noun is typed with its article ("une maison"), anything else alone. */
export const spellTarget = (e: { w: string; art?: string; g?: Gender }) => (e.g && (e.art === "un" || e.art === "une") ? `${e.art} ${e.w}` : e.w);

/** True when a headword is compact and clean enough for typing/spelling/dictation quizzes (<= 4 words, no variant slashes/placeholders). */
export function isSpellableHeadword(word: string): boolean {
  const cleaned = word.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return false;
  if (/[/=€+…«»]/.test(cleaned)) return false;
  return cleaned.split(/\s+/).length <= 4;
}
