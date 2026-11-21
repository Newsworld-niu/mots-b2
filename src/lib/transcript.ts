/** 原文生词: the words of a listening transcript or exam text the learner has not learned yet, to add to a deck in one go. */
import type { ReadSentence, ReadToken } from "./reader";
import { foldAccents } from "./accent";

export interface TranscriptWord {
  /** The token as first met, and the sentence it was met in. */
  tok: ReadToken;
  sentence: string;
  /** How many times the word comes up in the text. */
  n: number;
  /** In the atlas (or an own word) rather than only in the offline dictionary. */
  atlas: boolean;
}

/**
 * The words not learned yet (no card), each once, in the order of the text: atlas words (by id) and words
 * only the offline dictionary knows (by lemma). Function words, names and unknown strings are left out;
 * `hasCard` says whether an atlas word is being learned already.
 */
export function newWordsOf(paras: ReadSentence[][], hasCard: (id: string) => boolean): TranscriptWord[] {
  const seen = new Map<string, TranscriptWord>();
  for (const p of paras)
    for (const s of p)
      for (const tok of s.tokens) {
        if (tok.status !== "new") continue;
        if (tok.id && hasCard(tok.id)) continue;
        const key = tok.id ?? (tok.hit ? `d:${foldAccents(tok.hit.w)}` : "");
        if (!key) continue;
        const had = seen.get(key);
        if (had) had.n++;
        else seen.set(key, { tok, sentence: s.text, n: 1, atlas: !!tok.id });
      }
  return [...seen.values()];
}
