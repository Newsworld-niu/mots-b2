/**
 * The atlas as the learner sees it: the built atlas plus the words they created (卡组里的自建词)
 * and their changes to atlas words (own gloss, own examples), applied everywhere the word appears.
 * Custom words are reachable by id and by search, but are not part of the learning path (atlas.words).
 */
import { locateWord } from "../lib/text";
import type { CardExtras, CustomWord, UserExample, WordEdit } from "../store/store";
import type { Atlas, Entry, Example, WordRef } from "./types";
import { MEDIA } from "./types";

const genderOf = (pos: string): "m" | "f" | undefined => (pos === "n.m." ? "m" : pos === "n.f." ? "f" : undefined);
const slashIpa = (ipa?: string) => (ipa ? `/${ipa.replace(/^[/[]|[/\]]$/g, "")}/` : "");

const mineExamples = (ex: UserExample[] | undefined, w: string): Example[] =>
  (ex ?? []).map((x) => {
    const hl = x.hl ?? locateWord(x.fr, w);
    return { en: x.fr, zh: x.zh, origin: x.src === "tatoeba" ? "tatoeba" : "mine", ...(hl ? { hl } : {}) };
  });

/** The learner's further meanings and related words, after the card's own. */
const ownSenses = (x: CardExtras) => (x.senses ?? []).map((s) => ({ pos: s.pos, zh: s.zh, en: "", status: "自己添加" }));
const withOwn = (have: string[], own: string[] | undefined) => (own?.length ? [...have, ...own.filter((x) => !have.includes(x))] : have);

export function customRef(id: string, c: CustomWord): WordRef {
  const g = genderOf(c.pos);
  return { id, word: c.w, zh: c.zh, ipa: slashIpa(c.ipa), cefr: -1, topic: -1, media: 0, order: -1, custom: true, ...(g ? { g } : {}) };
}

export function customEntry(id: string, c: CustomWord): Entry {
  const g = genderOf(c.pos);
  const ipa = slashIpa(c.ipa);
  return {
    id,
    w: c.w,
    uk: ipa,
    us: ipa,
    senses: [{ pos: c.pos, zh: c.zh, en: "", status: c.auto ? "词典自动填写·待核对" : "自己添加" }, ...ownSenses(c)],
    ex: mineExamples(c.ex, c.w),
    col: c.col ?? [],
    fam: c.fam ?? [],
    syn: c.syn ?? [],
    ant: c.ant ?? [],
    tip: c.note ?? "",
    cefr: "",
    topic: "",
    m: 0,
    ...(g ? { g, art: g === "m" ? "un" : "une" } : {}),
    ...(c.noImg ? { noImg: true } : {}),
  };
}

export function editedEntry(e: Entry, edit: WordEdit): Entry {
  const first = edit.zh && e.senses.length ? [{ ...e.senses[0], zh: edit.zh, status: "自己改过" }, ...e.senses.slice(1)] : e.senses;
  const senses = edit.senses?.length ? [...first, ...ownSenses(edit)] : first;
  // own examples go first: cloze and dictation use the first example
  const ex = edit.ex ? [...mineExamples(edit.ex, e.w), ...e.ex] : e.ex;
  const col = edit.col ? [...edit.col, ...e.col.filter((c) => !edit.col!.includes(c))] : e.col;
  const tip = edit.tip ? (e.tip ? `${edit.tip}\n\n${e.tip}` : edit.tip) : e.tip;
  return { ...e, senses, ex, col, tip, syn: withOwn(e.syn, edit.syn), ant: withOwn(e.ant, edit.ant), fam: withOwn(e.fam, edit.fam), ...(edit.noImg ? { noImg: true } : {}) };
}

/**
 * `images`: pictures the learner added, by word id (data URLs); they replace the text plate and enable picture questions.
 * A word marked 不要图片 (noImg) has no picture at all, even one the atlas or the learner had given it.
 */
export function withUserData(base: Atlas, custom: Record<string, CustomWord> | undefined, edits: Record<string, WordEdit> | undefined, images: Record<string, string> = {}): Atlas {
  const hasCustom = custom && Object.keys(custom).length > 0;
  const hasEdits = edits && Object.keys(edits).length > 0;
  const hasImages = Object.keys(images).length > 0;
  if (!hasCustom && !hasEdits && !hasImages) return base;
  const noImg = new Set([...Object.entries(custom ?? {}), ...Object.entries(edits ?? {})].filter(([, x]) => x.noImg).map(([id]) => id));
  const pic = <T extends { id: string; media: number }>(r: T): T =>
    noImg.has(r.id) ? (r.media & MEDIA.img ? { ...r, media: r.media & ~MEDIA.img } : r) : images[r.id] ? { ...r, media: r.media | MEDIA.img } : r;
  const customRefs = Object.entries(custom ?? {}).map(([id, c]) => pic(customRef(id, c)));
  const byId = new Map(base.byId);
  let words = base.words;
  if (hasEdits || hasImages) {
    words = base.words.map((w) => {
      const z = edits?.[w.id]?.zh;
      return pic(z ? { ...w, zh: z } : w);
    });
    for (const w of words) byId.set(w.id, w);
  }
  for (const r of customRefs) byId.set(r.id, r);
  const cache = new Map<string, Entry>();
  const withPic = (e: Entry): Entry =>
    noImg.has(e.id) ? { ...e, m: e.m & ~MEDIA.img, noImg: true } : images[e.id] && !(e.m & MEDIA.img) ? { ...e, m: e.m | MEDIA.img } : e;
  const view = (e0: Entry) => {
    const e = withPic(e0);
    const edit = edits?.[e.id];
    if (!edit) return e;
    let hit = cache.get(e.id);
    if (!hit || hit.w !== e.w || hit.m !== e.m) {
      hit = editedEntry(e, edit);
      cache.set(e.id, hit);
    }
    return hit;
  };
  const customEntries = new Map(Object.entries(custom ?? {}).map(([id, c]) => [id, withPic(customEntry(id, c))]));
  return {
    ...base,
    words,
    custom: customRefs,
    byId,
    img: (ref, size) => (noImg.has(ref.id) ? null : images[ref.id] ?? base.img(ref, size)),
    peek: (id) => customEntries.get(id) ?? (base.peek(id) ? view(base.peek(id)!) : undefined),
    entry: async (id) => customEntries.get(id) ?? view(await base.entry(id)),
  };
}

/** The entry with sense `n` moved first: a deck that studies avocat as 牛油果 shows and asks that sense. */
export function focusSense(e: Entry, n: number | undefined): Entry {
  if (!n || n <= 0 || n >= e.senses.length) return e;
  return { ...e, senses: [e.senses[n], ...e.senses.slice(0, n), ...e.senses.slice(n + 1)] };
}

/** The word's index row with the studied sense as its gloss (the answer option of a meaning question). */
export function focusRef(w: WordRef, n: number | undefined): WordRef {
  const g = n && n > 0 ? w.more?.[n - 1] : undefined;
  return g ? { ...w, zh: g } : w;
}
