/**
 * Decks (卡组). The initial deck (初始词本) is every atlas word the learner has not hidden; the learner's own
 * decks are lists of word ids (atlas words and words they created). Progress belongs to the word, so:
 *  - a word in several decks has one memory record and is learned once;
 *  - a word in no deck at all is paused: its record is kept but it is not scheduled until it is added again;
 *  - studying some decks only draws new words and reviews from those decks.
 */
import type { Atlas, WordRef } from "../atlas/types";
import { foldAccents } from "../lib/accent";
import { setImage } from "./images";
import { CORE_DECK, MAX_COLLOCATIONS, store, type CustomWord, type Deck, type Progress, type Settings, type Step, type UserExample, type WordEdit } from "./store";

export const CORE_NAME = "初始词本";

const rid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const newDeckId = () => `d-${rid()}`;
export const newCustomId = () => `u-${rid()}`;

export const isCustomId = (id: string) => id.startsWith("u-");

/** Membership lookups for one progress snapshot. */
export interface DeckIndex {
  hidden: Set<string>;
  /** word id → the learner's decks containing it, in deck order. */
  byWord: Map<string, Deck[]>;
  /** In the initial deck: an atlas word (not created by the learner) that is not hidden. */
  inCore: (id: string) => boolean;
  /** In at least one deck; otherwise the word is paused. */
  isActive: (id: string) => boolean;
}

export function deckIndex(atlas: Pick<Atlas, "byId">, p: Pick<Progress, "decks" | "hidden">): DeckIndex {
  const hidden = new Set(p.hidden ?? []);
  const byWord = new Map<string, Deck[]>();
  for (const d of p.decks ?? []) for (const id of d.words) byWord.set(id, [...(byWord.get(id) ?? []), d]);
  const inCore = (id: string) => !isCustomId(id) && atlas.byId.has(id) && !hidden.has(id);
  return { hidden, byWord, inCore, isActive: (id) => inCore(id) || (byWord.has(id) && atlas.byId.has(id)) };
}

/** The decks 今日 studies: the initial deck or not, and which of the learner's decks. */
export interface StudyRange {
  core: boolean;
  decks: Deck[];
  /** Every deck is in range (nothing chosen). */
  all: boolean;
}

export function studyRange(p: Pick<Progress, "decks">, s: Pick<Settings, "studyDecks">): StudyRange {
  const decks = p.decks ?? [];
  const chosen = s.studyDecks?.filter((id) => id === CORE_DECK || decks.some((d) => d.id === id));
  if (!chosen?.length) return { core: true, decks, all: true };
  return { core: chosen.includes(CORE_DECK), decks: decks.filter((d) => chosen.includes(d.id)), all: false };
}

export function inRange(idx: DeckIndex, range: StudyRange, id: string) {
  if (!idx.isActive(id)) return false;
  if (range.all) return true;
  if (range.core && idx.inCore(id)) return true;
  const mine = idx.byWord.get(id);
  return !!mine && mine.some((d) => range.decks.includes(d));
}

/** The sense a word is studied in: the first deck in range that chose one. */
export function senseFor(range: StudyRange, id: string): number | undefined {
  for (const d of range.decks) {
    const n = d.sense?.[id];
    if (n !== undefined && d.words.includes(id)) return n;
  }
  return undefined;
}

/** Word ids of a deck; the initial deck is the atlas word list minus hidden words. */
export function deckWords(atlas: Atlas, p: Progress, deckId: string): string[] {
  if (deckId === CORE_DECK) {
    const hidden = new Set(p.hidden ?? []);
    return atlas.words.filter((w) => !hidden.has(w.id)).map((w) => w.id);
  }
  return (p.decks ?? []).find((d) => d.id === deckId)?.words.filter((id) => atlas.byId.has(id)) ?? [];
}

/** Records kept for words that are in no deck (paused). */
export function pausedIds(atlas: Atlas, p: Progress) {
  const idx = deckIndex(atlas, p);
  return Object.keys(p.cards).filter((id) => atlas.byId.has(id) && !idx.isActive(id));
}

/* ---------- glosses of a word, per sense (index rows keep the first gloss in zh, the rest in more) ---------- */

export const senseGlosses = (w: WordRef) => [w.zh, ...(w.more ?? [])];

/* ---------- finding a word the learner types ---------- */

/** Same headword: case and accents ignored, apostrophes and spaces normalised. */
export const sameHeadword = (a: string, b: string) => {
  const k = (s: string) => foldAccents(s.trim().replace(/[’‘]/g, "'").replace(/\s+/g, " "));
  return k(a) === k(b);
};

/** Existing words (atlas or custom) spelled like `w`: adding the same word twice links to the one already there. */
export function findSame(atlas: Atlas, w: string): WordRef[] {
  return [...atlas.words, ...(atlas.custom ?? [])].filter((x) => sameHeadword(x.word, w));
}

/* ---------- mutations ---------- */

const decksOf = (p: Progress) => p.decks ?? [];
const withDecks = (p: Progress, decks: Deck[]): Progress => ({ ...p, decks });
const mapDeck = (p: Progress, id: string, fn: (d: Deck) => Deck) => withDecks(p, decksOf(p).map((d) => (d.id === id ? fn(d) : d)));

export function createDeck(name: string): string {
  const id = newDeckId();
  const clean = name.trim().slice(0, 40) || "新卡组";
  store.progress((p) => withDecks(p, [...decksOf(p), { id, name: clean, created: Date.now(), words: [] }]));
  return id;
}

export function renameDeck(id: string, name: string) {
  const clean = name.trim().slice(0, 40);
  if (clean) store.progress((p) => mapDeck(p, id, (d) => ({ ...d, name: clean })));
}

/**
 * Delete a deck. Its words stay in the other decks they are in; words left in no deck are paused (records kept).
 * With `dropOrphans`, words the learner created that were only in this deck are deleted too.
 */
export function deleteDeck(id: string, dropOrphans = false) {
  const p0 = store.get().progress;
  const deck = decksOf(p0).find((d) => d.id === id);
  if (!deck) return;
  const others = new Set(decksOf(p0).filter((d) => d.id !== id).flatMap((d) => d.words));
  const orphans = dropOrphans ? deck.words.filter((w) => isCustomId(w) && !others.has(w)) : [];
  store.progress((p) => withDecks(p, decksOf(p).filter((d) => d.id !== id)));
  store.settings({ studyDecks: dropStudyDeck(store.get().settings.studyDecks, id) });
  orphans.forEach((w) => deleteCustomWord(w));
}

const dropStudyDeck = (list: string[] | null, id: string) => {
  const next = list?.filter((x) => x !== id) ?? null;
  return next?.length ? next : null;
};

/** Custom words that are only in this deck (asked about before the deck is deleted). */
export function orphanCustomWords(p: Progress, deckId: string) {
  const deck = decksOf(p).find((d) => d.id === deckId);
  if (!deck) return [];
  const others = new Set(decksOf(p).filter((d) => d.id !== deckId).flatMap((d) => d.words));
  return deck.words.filter((w) => isCustomId(w) && !others.has(w));
}

export function addToDeck(deckId: string, wordId: string, sense?: number) {
  if (deckId === CORE_DECK) return setHidden(wordId, false);
  store.progress((p) =>
    mapDeck(p, deckId, (d) => ({
      ...d,
      words: d.words.includes(wordId) ? d.words : [...d.words, wordId],
      ...(sense !== undefined ? { sense: { ...d.sense, [wordId]: sense } } : {}),
    })),
  );
}

const without = <T,>(rec: Record<string, T> | undefined, key: string) => {
  if (!rec || !(key in rec)) return rec;
  const { [key]: _, ...rest } = rec;
  void _;
  return Object.keys(rest).length ? rest : undefined;
};

/** Take a word out of a deck. Its record is kept; if it is in no deck now, it is paused. */
export function removeFromDeck(deckId: string, wordId: string) {
  if (deckId === CORE_DECK) return setHidden(wordId, true);
  store.progress((p) =>
    mapDeck(p, deckId, (d) => {
      const next: Deck = { ...d, words: d.words.filter((x) => x !== wordId), sense: without(d.sense, wordId), note: without(d.note, wordId) };
      if (!next.sense) delete next.sense;
      if (!next.note) delete next.note;
      return next;
    }),
  );
}

/** Hide an atlas word from the initial deck (删词 in 初始词本), or bring it back. */
export function setHidden(wordId: string, hide: boolean) {
  store.progress((p) => {
    const list = p.hidden ?? [];
    const has = list.includes(wordId);
    if (hide === has) return p;
    return { ...p, hidden: hide ? [...list, wordId] : list.filter((x) => x !== wordId) };
  });
}

export function setDeckSense(deckId: string, wordId: string, sense: number | null) {
  store.progress((p) =>
    mapDeck(p, deckId, (d) => {
      const next: Deck = { ...d, sense: sense === null || sense === 0 ? without(d.sense, wordId) : { ...d.sense, [wordId]: sense } };
      if (!next.sense) delete next.sense;
      return next;
    }),
  );
}

export function setDeckNote(deckId: string, wordId: string, note: string) {
  const clean = note.trim().slice(0, 200);
  store.progress((p) =>
    mapDeck(p, deckId, (d) => {
      const next: Deck = { ...d, note: clean ? { ...d.note, [wordId]: clean } : without(d.note, wordId) };
      if (!next.note) delete next.note;
      return next;
    }),
  );
}

const cleanExamples = (ex: UserExample[] | undefined) => {
  const out = (ex ?? [])
    .map((x) => {
      const fr = x.fr.trim().slice(0, 400);
      const clean: UserExample = { fr, zh: x.zh.trim().slice(0, 400) };
      // a dictionary sentence keeps its source and span while the learner leaves the French unchanged
      if (x.src && fr === x.fr) clean.src = x.src;
      if (x.hl && fr === x.fr && x.hl[1] <= fr.length) clean.hl = x.hl;
      return clean;
    })
    .filter((x) => x.fr);
  return out.length ? out.slice(0, 5) : undefined;
};

/** Collocations as stored: "French｜中文", blanks and repeats dropped. */
export function cleanCollocations(col: string[] | undefined) {
  const out = [
    ...new Set(
      (col ?? [])
        .map((c) => {
          const [fr = "", zh = ""] = c.split("｜");
          const f = fr.trim().slice(0, 100);
          const z = zh.trim().slice(0, 50);
          return f ? (z ? `${f}｜${z}` : f) : "";
        })
        .filter(Boolean),
    ),
  ].slice(0, MAX_COLLOCATIONS);
  return out.length ? out : undefined;
}

/** Create a word that is not in the atlas; returns its id. */
export function createCustomWord(input: Omit<CustomWord, "created">, deckId?: string): string {
  const id = newCustomId();
  const word: CustomWord = { w: input.w.trim().slice(0, 80), pos: input.pos.trim().slice(0, 16), zh: input.zh.trim().slice(0, 300), created: Date.now() };
  if (input.ipa?.trim()) word.ipa = input.ipa.trim().slice(0, 80);
  const ex = cleanExamples(input.ex);
  if (ex) word.ex = ex;
  if (input.note?.trim()) word.note = input.note.trim().slice(0, 300);
  if (input.auto) word.auto = true;
  if (input.noImg) word.noImg = true;
  const col = cleanCollocations(input.col);
  if (col) word.col = col;
  store.progress((p) => ({ ...p, custom: { ...p.custom, [id]: word } }));
  if (deckId) addToDeck(deckId, id);
  return id;
}

export function updateCustomWord(id: string, input: Omit<CustomWord, "created">) {
  store.progress((p) => {
    const old = p.custom?.[id];
    if (!old) return p;
    const word: CustomWord = { w: input.w.trim().slice(0, 80) || old.w, pos: input.pos.trim().slice(0, 16), zh: input.zh.trim().slice(0, 300) || old.zh, created: old.created };
    if (input.ipa?.trim()) word.ipa = input.ipa.trim().slice(0, 80);
    const ex = cleanExamples(input.ex);
    if (ex) word.ex = ex;
    if (input.note?.trim()) word.note = input.note.trim().slice(0, 300);
    if (input.auto) word.auto = true;
    if (input.noImg) word.noImg = true;
    const col = cleanCollocations(input.col);
    if (col) word.col = col;
    return { ...p, custom: { ...p.custom, [id]: word } };
  });
}

/** Delete a word the learner created, with its record, everywhere (decks, mistakes, bookmarks, the open session). */
export function deleteCustomWord(id: string) {
  void setImage(id, null);
  store.progress((p) => {
    const { [id]: _, ...cards } = p.cards;
    void _;
    let session = p.session;
    if (session && session.steps.some((s) => s.id === id || (s.kind === "pairing" && s.ids.includes(id)))) {
      const keep = (s: Step) => s.id !== id && !(s.kind === "pairing" && s.ids.includes(id));
      const before = session.steps.slice(0, session.index).filter((s) => !keep(s)).length;
      const steps = session.steps.filter(keep);
      session = { ...session, steps, index: Math.max(0, session.index - before), newIds: session.newIds.filter((x) => x !== id), reviewIds: session.reviewIds.filter((x) => x !== id) };
      if (session.pending && p.session!.steps[p.session!.index]?.id === id) session = { ...session, pending: undefined };
    }
    return {
      ...p,
      cards,
      custom: without(p.custom, id),
      decks: p.decks?.map((d) => (d.words.includes(id) ? { ...d, words: d.words.filter((x) => x !== id), sense: without(d.sense, id), note: without(d.note, id) } : d)),
      bookmarks: p.bookmarks.filter((x) => x !== id),
      mistakes: p.mistakes.filter((x) => x !== id),
      session,
    };
  });
}

/** Change an atlas word for every deck: own gloss for the first sense, own examples, collocations and 注意点. Empty fields restore the atlas text. */
export function setWordEdit(id: string, edit: WordEdit) {
  const zh = edit.zh?.trim().slice(0, 300);
  const ex = cleanExamples(edit.ex);
  store.progress((p) => {
    const next: WordEdit = {};
    if (zh) next.zh = zh;
    if (ex) next.ex = ex;
    if (edit.noImg) next.noImg = true;
    const col = cleanCollocations(edit.col);
    if (col) next.col = col;
    const tip = edit.tip?.trim().slice(0, 300);
    if (tip) next.tip = tip;
    const edits = next.zh || next.ex || next.noImg || next.col || next.tip ? { ...p.edits, [id]: next } : without(p.edits, id);
    return { ...p, edits };
  });
}

/**
 * Add collocations ("French｜中文") and 注意点 to a word's card: an atlas word gets them in its edit (shown in every
 * deck), an own word in its collocations and note. Ones already there are not added twice.
 */
export function addToCard(id: string, add: { col?: string[]; tip?: string }) {
  const p = store.get().progress;
  const merge = (have: string[] | undefined) => cleanCollocations([...(have ?? []), ...(add.col ?? []).filter((c) => !(have ?? []).some((h) => h.split("｜")[0].toLowerCase() === c.split("｜")[0].toLowerCase()))]);
  const tipOf = (have: string | undefined) => (add.tip && !(have ?? "").includes(add.tip) ? [have, add.tip].filter(Boolean).join("\n") : have);
  if (isCustomId(id)) {
    const c = p.custom?.[id];
    if (c) updateCustomWord(id, { ...c, col: merge(c.col), note: tipOf(c.note) });
    return;
  }
  const e = p.edits?.[id];
  setWordEdit(id, { ...e, col: merge(e?.col), tip: tipOf(e?.tip) });
}

/** Take one collocation or 注意点 off a card again (only what the learner added). */
export function removeFromCard(id: string, rm: { col?: string; tip?: string }) {
  const p = store.get().progress;
  const keepCol = (have: string[] | undefined) => cleanCollocations((have ?? []).filter((c) => c !== rm.col));
  const keepTip = (have: string | undefined) => (rm.tip ? (have ?? "").split("\n").filter((t) => t.trim() !== rm.tip).join("\n") : have);
  if (isCustomId(id)) {
    const c = p.custom?.[id];
    if (c) updateCustomWord(id, { ...c, col: keepCol(c.col), note: keepTip(c.note) });
    return;
  }
  const e = p.edits?.[id];
  setWordEdit(id, { ...e, col: keepCol(e?.col), tip: keepTip(e?.tip) });
}

/* ---------- 从文章取词 ---------- */

/** Longest source sentence stored as an example; a longer one would crowd the card. */
export const MAX_SOURCE_SENTENCE = 200;

export interface PickedWord {
  kind: "learning" | "atlas" | "dict" | "new" | "unknown";
  id?: string;
  word: string;
  /** Part of speech, IPA and examples (dictionary, word list or AI) for a word not in the atlas. */
  pos?: string;
  ipa?: string;
  dictEx?: UserExample[];
  note?: string;
  zh: string;
  sentence: string;
  span?: [number, number];
  /** Atlas word: the sense this deck studies, and a note for this deck (a list's own translation). */
  sense?: number;
  deckNote?: string;
  /** Collocations ("French｜中文") and 注意点 for a new word (from the AI). */
  col?: string[];
  tip?: string;
}

const posGender = (pos: string) => (/^n\.m\./.test(pos) ? "m" : /^n\.f\./.test(pos) ? "f" : "");

/**
 * Add words picked from a text, a photo or a file to a deck. Atlas words and existing own words are linked;
 * the rest become the learner's words (dictionary ones marked 自动填写·待核对). With `withSentence`, the sentence
 * the word was found in becomes its first example (for an atlas word, one of the learner's own examples, shown
 * in every deck). A word created earlier in the same batch, or an own word spelled exactly the same with a
 * compatible gender, is linked instead of being created twice.
 * Returns how many were added and how many were left out for lack of a Chinese meaning.
 */
export function addPicked(deckId: string, picked: PickedWord[], withSentence: boolean) {
  let added = 0;
  let skipped = 0;
  const sourceEx = (p: PickedWord): UserExample[] =>
    withSentence && p.sentence && p.sentence.length <= MAX_SOURCE_SENTENCE ? [{ fr: p.sentence, zh: "", ...(p.span ? { hl: p.span } : {}) }] : [];
  const link = (id: string, p: PickedWord) => {
    addToDeck(deckId, id, p.sense);
    if (p.deckNote) setDeckNote(deckId, id, p.deckNote);
    const ex = sourceEx(p);
    if (ex.length && !isCustomId(id)) {
      const old = store.get().progress.edits?.[id];
      if (!old?.ex?.some((x) => x.fr === ex[0].fr)) setWordEdit(id, { ...old, ex: [...ex, ...(old?.ex ?? [])] });
    } else if (ex.length) {
      const c = store.get().progress.custom?.[id];
      if (c && !c.ex?.some((x) => x.fr === ex[0].fr)) updateCustomWord(id, { ...c, ex: [...ex, ...(c.ex ?? [])] });
    }
  };
  const sameOwn = (p: PickedWord) => {
    const w = p.word.trim().toLowerCase();
    const g = posGender(p.pos ?? "");
    const own = store.get().progress.custom ?? {};
    return Object.keys(own).find((id) => {
      const c = own[id];
      const cg = posGender(c.pos);
      return c.w.trim().toLowerCase() === w && (!g || !cg || g === cg);
    });
  };
  for (const p of picked) {
    const existing = p.id ?? sameOwn(p);
    if (existing) {
      link(existing, p);
      added++;
      continue;
    }
    if (!p.zh.trim()) {
      skipped++;
      continue;
    }
    createCustomWord(
      {
        w: p.word,
        pos: p.pos ?? "",
        zh: p.zh,
        ipa: p.ipa,
        note: [p.tip, p.note].filter(Boolean).join("；") || undefined,
        col: p.col,
        ex: [...sourceEx(p), ...(p.dictEx ?? [])].slice(0, 3),
        auto: p.kind === "dict" ? true : undefined,
      },
      deckId,
    );
    added++;
  }
  return { added, skipped };
}
