/** Confusable words: groups of look-alike or sound-alike words, each with a rule and an example. Data: data/confusables.json. */

export interface CfItem {
  /** The word as shown and as offered in the quiz (an infinitive for verbs). */
  w: string;
  zh: string;
  /** How to tell it apart, one line. */
  rule: string;
  ex: { fr: string; zh: string };
  /** The exact text blanked in the example when it differs from `w` (vois for voir). */
  form?: string;
  /** Lemma used to link the item to an entry when `w` is not one (est → être). */
  lemma?: string;
  /** Filled in at build time: the atlas entry of this word. */
  id?: string;
}

export interface CfGroup {
  id: string;
  /** "homophone": same or near sound, different spelling. "meaning": different words a learner mixes up. */
  kind: "homophone" | "meaning";
  title: string;
  /** One sentence: the difference. */
  zh: string;
  items: CfItem[];
}

export interface CfData {
  v: 1;
  groups: CfGroup[];
  /** entry id → ids of the groups it belongs to */
  byEntry: Record<string, string[]>;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Split a sentence around `text` (whole word, any case, curly or straight apostrophe). Null when absent. */
export function blankOut(sentence: string, text: string) {
  const body = esc(text.trim()).replace(/'/g, "['’]").replace(/\s+/g, "\\s+");
  const m = new RegExp(`(?<![\\p{L}])${body}(?![\\p{L}])`, "iu").exec(sentence);
  if (!m) return null;
  return { before: sentence.slice(0, m.index), hidden: m[0], after: sentence.slice(m.index + m[0].length) };
}

export const blankOf = (it: CfItem) => it.form ?? it.w;

/** Problems in the source data (empty list = valid). */
export function checkGroups(groups: CfGroup[]): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  for (const g of groups) {
    if (ids.has(g.id)) out.push(`${g.id}: duplicate group id`);
    ids.add(g.id);
    if (g.kind !== "homophone" && g.kind !== "meaning") out.push(`${g.id}: bad kind ${g.kind}`);
    if (!g.title || !g.zh) out.push(`${g.id}: title and zh are required`);
    if (g.items.length < 2 || g.items.length > 4) out.push(`${g.id}: needs 2–4 items, has ${g.items.length}`);
    const words = new Set<string>();
    for (const it of g.items) {
      if (!it.w || !it.zh || !it.rule || !it.ex?.fr || !it.ex?.zh) out.push(`${g.id}/${it.w}: w, zh, rule and example are required`);
      if (words.has(it.w.toLowerCase())) out.push(`${g.id}/${it.w}: duplicate word`);
      words.add(it.w.toLowerCase());
      if (it.ex?.fr && !blankOut(it.ex.fr, blankOf(it))) out.push(`${g.id}/${it.w}: "${blankOf(it)}" not found in "${it.ex.fr}"`);
    }
  }
  return out;
}

export interface CfQuestion {
  group: CfGroup;
  item: CfItem;
  before: string;
  hidden: string;
  after: string;
}

/** One question per item: its example with the word blanked, answered by picking among the group's words. */
export function questionsOf(groups: CfGroup[]): CfQuestion[] {
  return groups.flatMap((group) =>
    group.items.flatMap((item) => {
      const b = blankOut(item.ex.fr, blankOf(item));
      return b ? [{ group, item, ...b }] : [];
    }),
  );
}

/** Pick `n` questions, at most `perGroup` from one group so a long group does not dominate. */
export function pickQuestions(all: CfQuestion[], n: number, rand: () => number, perGroup = 2): CfQuestion[] {
  const pool = [...all];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const used = new Map<string, number>();
  const out: CfQuestion[] = [];
  for (const q of pool) {
    if (out.length >= n) break;
    const c = used.get(q.group.id) ?? 0;
    if (c >= perGroup) continue;
    used.set(q.group.id, c + 1);
    out.push(q);
  }
  return out;
}
