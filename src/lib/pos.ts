export const POS_OPTIONS = [
  ["noun", "名词"], ["verb", "动词"], ["adjective", "形容词"],
  ["adverb", "副词"], ["preposition", "介词"], ["pronoun", "代词"],
  ["conjunction", "连词"], ["interjection", "感叹词"],
  ["determiner", "限定词 / 冠词"], ["phrase", "短语"],
] as const;

const patterns: Record<string, RegExp> = {
  noun: /(?:^|[\s/;,])n\./,
  verb: /(?:^|[\s/;,])v\./,
  adjective: /\badj\./,
  adverb: /\badv\./,
  preposition: /pr[ée]p\./,
  pronoun: /\bpron\./,
  conjunction: /\bconj\./,
  interjection: /\binterj\./,
  determiner: /(?:d[ée]t|art)\./,
  phrase: /\bloc\./,
};

/** Match every applicable category, including labels such as loc. adv. */
export function matchesPos(labels: string[] | undefined, category: string): boolean {
  if (!category) return true;
  return labels?.some((s) => patterns[category]?.test(s.toLowerCase())) ?? false;
}

/** Multiple selections form a union; no selection means every part of speech. */
export function matchesStudyPos(labels: string[] | undefined, categories?: string[] | null): boolean {
  return !categories?.length || categories.some((category) => matchesPos(labels, category));
}
