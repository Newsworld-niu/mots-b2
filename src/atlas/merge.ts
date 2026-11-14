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

/** The index row of an atlas word as changed by the learner: its first meaning and the other ones, as on the card. */
export function editedRef(w: WordRef, edit: WordEdit): WordRef {
  if (!edit.zh && !edit.hide?.length && !edit.senses?.length) return w;
  const hidden = new Set(edit.hide ?? []);
  const shown = [
    ...[w.zh, ...(w.more ?? [])].map((zh, n) => ({ zh: n === 0 && edit.zh ? edit.zh : zh, n })).filter((x) => !hidden.has(x.n)).map((x) => x.zh),
    ...(edit.senses ?? []).map((s) => s.zh),
  ];
  if (!shown.length) return w;
  const { more: _, ...rest } = w;
  void _;
  return { ...rest, zh: shown[0], ...(shown.length > 1 ? { more: shown.slice(1) } : {}) };
}

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

/**
 * An atlas entry with the learner's changes: any sense's gloss, own examples (first), atlas examples taken out,
 * own collocations and note. The atlas's own text stays in `orig`, to edit from or restore.
 */
export function editedEntry(e: Entry, edit: WordEdit): Entry {
  const hidden = new Set(edit.hide ?? []);
  const kept = e.senses
    .map((s, n) => {
      const zh = n === 0 ? edit.zh : edit.zhMore?.[n - 1];
      return zh ? { ...s, zh, status: "自己改过", n } : { ...s, n };
    })
    .filter((s) => !hidden.has(s.n));
  const shown = [...kept, ...ownSenses(edit)];
  // a card always has a meaning: with every sense taken off, the atlas's own stay
  const senses = shown.length ? shown : e.senses;
  // own examples go first: cloze and dictation use the first example
  const keptEx = edit.hideEx?.length ? e.ex.filter((_, i) => !edit.hideEx!.includes(i)) : e.ex;
  const ex = edit.ex ? [...mineExamples(edit.ex, e.w), ...keptEx] : keptEx;
  // the recordings belong to the atlas's first and second example: no recording for a sentence that took their place
  let m = e.m;
  if (ex[0] !== e.ex[0]) m &= ~(MEDIA.ex | MEDIA.exM);
  if (ex[1] !== e.ex[1]) m &= ~(MEDIA.ex2 | MEDIA.ex2M);
  const col = edit.col ? [...edit.col, ...e.col.filter((c) => !edit.col!.includes(c))] : e.col;
  const tip = edit.tip ? (e.tip ? `${edit.tip}\n\n${e.tip}` : edit.tip) : e.tip;
  return {
    ...e,
    m,
    senses,
    ex,
    col,
    tip,
    syn: withOwn(e.syn, edit.syn),
    ant: withOwn(e.ant, edit.ant),
    fam: withOwn(e.fam, edit.fam),
    orig: { senses: e.senses.map((s) => s.zh), ex: e.ex },
    ...(edit.noImg ? { noImg: true } : {}),
  };
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
      const edit = edits?.[w.id];
      return pic(edit ? editedRef(w, edit) : w);
    });
    for (const w of words) byId.set(w.id, w);
  }
  for (const r of customRefs) byId.set(r.id, r);
  const cache = new Map<string, { src: Entry; out: Entry }>();
  const withPic = (e: Entry): Entry =>
    noImg.has(e.id) ? { ...e, m: e.m & ~MEDIA.img, noImg: true } : images[e.id] && !(e.m & MEDIA.img) ? { ...e, m: e.m | MEDIA.img } : e;
  const view = (e0: Entry) => {
    const e = withPic(e0);
    const edit = edits?.[e.id];
    if (!edit) return e;
    let hit = cache.get(e.id);
    if (!hit || hit.src.w !== e.w || hit.src.m !== e.m) {
      hit = { src: e, out: editedEntry(e, edit) };
      cache.set(e.id, hit);
    }
    return hit.out;
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
