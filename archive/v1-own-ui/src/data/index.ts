import { WORDS } from "./words";
import { TOPICS, topicOf } from "./topics";
import type { WordEntry, TopicKey } from "./types";

export { WORDS, TOPICS, topicOf };
export type { WordEntry, TopicKey };

/** Learning path order: topics in station order, words as listed inside each topic. */
export const WORD_ORDER: WordEntry[] = TOPICS.flatMap((t) => WORDS.filter((w) => w.topic === t.key));
export const WORD_BY_ID = new Map(WORD_ORDER.map((w) => [w.id, w]));
export const WORD_INDEX = new Map(WORD_ORDER.map((w, i) => [w.id, i]));

/** Chinese label of the first sense, used as the meaning shown in quizzes. */
export const zhOf = (w: WordEntry) => w.senses[0].zh;
