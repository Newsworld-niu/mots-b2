import { cleanWikiSources } from "../lib/wiktionary";
import { familyIds } from "../lib/families";
import { POS_OPTIONS } from "../lib/pos";
import { useSyncExternalStore } from "react";
import { migrateAliases as migrateAliasesPure, type AliasMap } from "./aliases";
import type { Accent } from "../atlas/types";
import type { CardState, Grade } from "./srs";
import { getImages, isImageDataUrl, replaceImages } from "./images";
import { sanitizeTexts, type SavedText } from "../lib/reader";
import { sanitizeAiTasks, sanitizeEssays, sanitizeNotes, type EssayTask, type SavedEssay, type SavedNote } from "../lib/essay";
import { sanitizeExamLog, type ExamResult } from "../lib/exam";

/**
 * "gender": choose un / une for a noun (no options list; the two articles are fixed).
 * "cloze": an example sentence with the word blanked (and its Chinese), choose the French word.
 * "dictation": hear the example sentence, type the blanked word.
 */
export type QuizKind = "meaning" | "picture" | "listen" | "spell" | "gender" | "cloze" | "dictation";
/** "pairing": match five French words with their meanings; extra practice, never graded (`ids`: the five words). */
/** `sense`: the sense a deck asks for (index into the entry's senses), shown first and used as the answer's gloss. */
export type Step =
  | { id: string; kind: "intro"; sense?: number }
  | { id: string; kind: "pairing"; ids: string[] }
  | { id: string; kind: QuizKind; retry?: boolean; options?: string[]; pair?: boolean; sense?: number };

/**
 * A deck (卡组) the learner made: a list of word ids. Progress belongs to the word, not the deck,
 * so a word in several decks is learned once. `sense` and `note` are per deck.
 */
export interface Deck {
  id: string;
  name: string;
  created: number;
  words: string[];
  /** word id → sense index this deck cares about (avocat: 律师 in one deck, 牛油果 in another). */
  sense?: Record<string, number>;
  /** word id → the learner's note for this deck ("《小王子》第 3 章"). */
  note?: Record<string, string>;
}

export interface UserExample {
  fr: string;
  zh: string;
  /** "tatoeba": taken from the offline dictionary (Tatoeba, CC BY 2.0 FR), not written by the learner. */
  src?: "tatoeba";
  /** Where the headword sits in fr (UTF-16), when the dictionary knows it (vont for aller). */
  hl?: [number, number];
}

/** A further meaning the learner put on a card (from AI 讲解), shown after the card's own senses. */
export interface OwnSense {
  pos: string;
  zh: string;
}

/** What the learner can put on any card besides collocations and a 注意点: further meanings and related words. */
export interface CardExtras {
  wikiSources?: string[];
  senses?: OwnSense[];
  /** Related words, each "mot (中文)". */
  syn?: string[];
  ant?: string[];
  fam?: string[];
}
export const MAX_OWN_SENSES = 6;
export const MAX_RELATED = 12;
export const MAX_EXAMPLES = 5;
/** Longest 注意点 (several lines, one point each). */
export const MAX_TIP = 1000;

/** A word the learner added that is not in the atlas. Stored under an id "u-…". */
export interface CustomWord extends CardExtras {
  w: string;
  /** Part of speech as the atlas writes it: "n.m.", "n.f.", "v.", "adj." … ; n.m. / n.f. give the un / une quiz. */
  pos: string;
  zh: string;
  ipa?: string;
  ex?: UserExample[];
  note?: string;
  created: number;
  /** Filled from the offline dictionary and not yet checked by the learner (自动填写·待核对). */
  auto?: boolean;
  /** The learner chose 不要图片: no picture and no text plate on the card, and no picture question. */
  noImg?: boolean;
  /** Collocations, each "French｜中文" (the atlas notation). The note above is shown as the card's 注意点. */
  col?: string[];
}

/** The learner's changes to an atlas word, shown in every deck: a gloss for the first sense, own examples (first). */
export interface WordEdit extends CardExtras {
  /** Saved content replaces the bundled suggestions, including empty lists. */
  replaceContent?: boolean;
  zh?: string;
  /** Glosses for the second sense onward ("" keeps the atlas's). */
  zhMore?: string[];
  ex?: UserExample[];
  /** Atlas examples the learner does not want, by their place in the atlas's list. */
  hideEx?: number[];
  /** 不要图片 for an atlas word (see CustomWord.noImg). */
  noImg?: boolean;
  /** Own collocations ("French｜中文"), shown before the atlas ones. */
  col?: string[];
  /** Own 注意点, shown before the atlas tip. */
  tip?: string;
  /** The atlas's own senses the learner took off the card, by position (0 = the first). Never all of the card's senses. */
  hide?: number[];
}

/** Stable id of the initial deck; managed like other decks after migration. */
export const CORE_DECK = "core";
export const FAVORITES_DECK = "d-favorites";

/** Bookmarks are the source of truth for the automatic collection. */
export function syncFavorites(p: Progress): Progress {
  if (!p.coreMigrated) return p;
  const old = p.decks?.find(d => d.id === FAVORITES_DECK);
  const words = [...new Set(p.bookmarks)];
  const members = new Set(words);
  const keep = <T,>(v?: Record<string, T>) => v ? Object.fromEntries(Object.entries(v).filter(([id]) => members.has(id))) : undefined;
  const deck: Deck = { ...old, id: FAVORITES_DECK, name: "收藏", created: old?.created ?? 0, words, sense: keep(old?.sense), note: keep(old?.note) };
  return { ...p, decks: [...(p.decks ?? []).filter(d => d.id !== FAVORITES_DECK), deck] };
}

export interface ActiveSession {
  id: string;
  started: number;
  steps: Step[];
  index: number;
  /** First-attempt grade per word; retries never change it. */
  graded: Record<string, Grade>;
  newIds: string[];
  reviewIds: string[];
  /** New words the learner said they do not know on first meeting: their first answer in this session cannot raise familiarity. */
  unknown?: string[];
  /** Answer shown but not yet continued; survives reload without double counting. */
  pending?: { correct: boolean; value: string; /** right letters, wrong accent: counted correct but graded Hard */ accentOnly?: boolean; /** noun spelled right, article wrong or missing: counted wrong */ articleWrong?: boolean };
  finished?: number;
}

export interface DayStat {
  n: number; // new words met
  r: number; // graded reviews (first attempts)
  c: number; // correct first attempts
  t: number; // active seconds
}

export interface TypingRound {
  at: number;
  mode: "word" | "sentence" | "dictation";
  items: number;
  wpm: number;
  accuracy: number;
}

export interface Progress {
  coreMigrated?: boolean;
  version: 2;
  datasetId: string;
  cards: Record<string, CardState>;
  bookmarks: string[];
  days: Record<string, DayStat>;
  typing: TypingRound[];
  session: ActiveSession | null;
  /** Rolling list of recent mistakes, newest first. */
  mistakes: string[];
  /** Records moved aside by the alias migration when both ids had a record (recoverable, never merged). */
  aliasArchive?: Record<string, CardState>;
  /** When the alias migration last changed this progress (epoch ms). */
  aliasMigratedAt?: number;
  /** Conjugation cards (变位), one per verb × tense × person, keyed "verbId|tense|person"; legacy two-part keys retained. Separate from word cards. */
  conj?: Record<string, CardState>;
  /** Conjugation stats per day: n = new cards started, r = graded answers, c = correct. */
  conjDays?: Record<string, { n: number; r: number; c: number; verbs?: string[] }>;
  /** Grammar point cards (语法), one per point id; graded once per practice round of the point. */
  gram?: Record<string, CardState>;
  /** Grammar drills per day: n = points started, r = drills answered, c = right. */
  gramDays?: Record<string, { n: number; r: number; c: number; verbs?: string[] }>;
  /** Grammar drills the learner reported as wrong or ambiguous (drillId), never asked again. */
  gramSkip?: string[];
  /** The learner's own decks, in the order made. */
  decks?: Deck[];
  /** Atlas words taken out of the initial deck (初始词本); still learned when in another deck. */
  hidden?: string[];
  /** Words the learner created, by id ("u-…"). */
  custom?: Record<string, CustomWord>;
  /** The learner's changes to atlas words, by id. */
  edits?: Record<string, WordEdit>;
  /** Saved texts of 阅读 (pasted, imported or written by the AI), newest first. */
  texts?: SavedText[];
  /** Texts written in 篇章写作, with their marking, newest first. */
  essays?: SavedEssay[];
  /** Essay tasks the AI wrote for 篇章写作, newest first. */
  essayTasks?: EssayTask[];
  /** Mistakes kept from markings (错句本), newest first. */
  essayNotes?: SavedNote[];
  /** Results of 听力理解、应试阅读、口语, newest first. */
  examLog?: ExamResult[];
}

/** The most new words a day can be set to: the learner decides, the app only keeps the number sane. */
export const MAX_DAILY_NEW = 2000;

export interface Settings {
  accent: Accent;
  autoplay: boolean;
  dailyNew: number;
  retention: number;
  theme: "system" | "light" | "dark";
  sfx: boolean;
  spell: boolean;
  startLevel: number;
  onboarded: boolean;
  dataset: "open" | "private";
  ambience: "off" | "stars" | "rain" | "sea" | "forest" | "fire" | "voyage" | "cafe";
  ambienceVolume: number;
  splash: boolean;
  /** Tenses practised in 变位; null = follow the start level (A1: présent + passé composé …). */
  conjTenses: string[] | null;
  /** New conjugation cards per day. */
  conjNew: number;
  /** Topic key new words are drawn from (按主题学); null = the whole learning path. */
  focusTopic: string | null;
  /** Decks studied in 今日 (new words and reviews); null = every deck. CORE_DECK is the initial deck. */
  studyDecks: string[] | null;
  /** Part of speech for new words and reviews; null means all. */
  studyPos?: string[] | null;
  studyFamilies?: string[] | null;
  /** 阅读: colour the words by how well they are known (没学过 / 在学 / 已掌握). */
  readColors: boolean;
  /** 阅读: the deck new words go to; null = none chosen yet. */
  readDeck: string | null;
}

export const defaultSettings: Settings = {
  accent: "uk",
  autoplay: true,
  dailyNew: 10,
  retention: 0.9,
  theme: "dark",
  sfx: true,
  spell: true,
  startLevel: 0,
  onboarded: false,
  dataset: "open",
  ambience: "stars",
  ambienceVolume: 0.45,
  splash: true,
  conjTenses: null,
  conjNew: 10,
  focusTopic: null,
  studyDecks: null,
  studyPos: null,
  studyFamilies: null,
  readColors: true,
  readDeck: null,
};

export const emptyProgress = (datasetId: string): Progress => ({
  version: 2,
  datasetId,
  cards: {},
  bookmarks: [],
  days: {},
  typing: [],
  session: null,
  mistakes: [],
});

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const SETTINGS_KEY = "word-atlas:settings";
const progressKey = (id: string) => `word-atlas:v2:${id}`;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/* ---------- validation (backups and stored data are untrusted) ---------- */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown, lo = -Infinity, hi = Infinity) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;

function validCard(v: unknown): v is CardState {
  return (
    isObj(v) &&
    num(v.due, 0) &&
    num(v.s, 0) &&
    num(v.d, 0, 11) &&
    num(v.el, 0) &&
    num(v.sd, 0) &&
    num(v.ls, 0) &&
    num(v.reps, 0) &&
    num(v.lapses, 0) &&
    [0, 1, 2, 3].includes(v.st as number) &&
    (v.last === undefined || num(v.last, 0)) &&
    num(v.seen, 0)
  );
}

export function sanitizeProgress(v: unknown, datasetId: string): Progress {
  const out = emptyProgress(datasetId);
  if (!isObj(v) || v.version !== 2) return syncFavorites(out);
  if (isObj(v.cards)) for (const [k, c] of Object.entries(v.cards)) if (validCard(c)) out.cards[k] = c;
  if (Array.isArray(v.bookmarks)) out.bookmarks = v.bookmarks.filter((x): x is string => typeof x === "string").slice(0, 20000);
  if (Array.isArray(v.mistakes)) out.mistakes = v.mistakes.filter((x): x is string => typeof x === "string").slice(0, 300);
  if (isObj(v.aliasArchive)) {
    const arc: Record<string, CardState> = {};
    for (const [k, c] of Object.entries(v.aliasArchive)) if (validCard(c)) arc[k] = c;
    if (Object.keys(arc).length) out.aliasArchive = arc;
  }
  if (typeof v.aliasMigratedAt === "number") out.aliasMigratedAt = v.aliasMigratedAt;
  if (isObj(v.days))
    for (const [k, d] of Object.entries(v.days))
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && isObj(d) && num(d.n, 0) && num(d.r, 0) && num(d.c, 0) && num(d.t, 0))
        out.days[k] = { n: d.n as number, r: d.r as number, c: d.c as number, t: d.t as number };
  if (Array.isArray(v.typing))
    out.typing = v.typing
      .filter(
        (t): t is TypingRound =>
          isObj(t) && num(t.at, 0) && ["word", "sentence", "dictation"].includes(t.mode as string) && num(t.items, 0) && num(t.wpm, 0, 400) && num(t.accuracy, 0, 100),
      )
      .slice(-500);
  if (isObj(v.conj)) {
    const conj: Record<string, CardState> = {};
    for (const [k, c] of Object.entries(v.conj)) if (/^[^|]+\|(pres|pc|imp|fut|cond|subj)(\|[0-5])?$/.test(k) && validCard(c)) conj[k] = c;
    if (Object.keys(conj).length) out.conj = conj;
  }
  if (isObj(v.conjDays)) {
    const days: Record<string, { n: number; r: number; c: number; verbs?: string[] }> = {};
    for (const [k, d] of Object.entries(v.conjDays))
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && isObj(d) && num(d.n, 0) && num(d.r, 0) && num(d.c, 0)) days[k] = { n: d.n as number, r: d.r as number, c: d.c as number, ...(Array.isArray(d.verbs) ? { verbs: [...new Set(d.verbs.filter((id): id is string => typeof id === "string" && id.length > 0))] } : {}) };
    if (Object.keys(days).length) out.conjDays = days;
  }
  if (isObj(v.gram)) {
    const gram: Record<string, CardState> = {};
    for (const [k, c] of Object.entries(v.gram)) if (/^[a-z0-9-]{2,40}$/.test(k) && validCard(c)) gram[k] = c;
    if (Object.keys(gram).length) out.gram = gram;
  }
  if (isObj(v.gramDays)) {
    const days: Record<string, { n: number; r: number; c: number; verbs?: string[] }> = {};
    for (const [k, d] of Object.entries(v.gramDays))
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && isObj(d) && num(d.n, 0) && num(d.r, 0) && num(d.c, 0)) days[k] = { n: d.n as number, r: d.r as number, c: d.c as number, ...(Array.isArray(d.verbs) ? { verbs: [...new Set(d.verbs.filter((id): id is string => typeof id === "string" && id.length > 0))] } : {}) };
    if (Object.keys(days).length) out.gramDays = days;
  }
  if (Array.isArray(v.gramSkip)) {
    const skip = [...new Set(v.gramSkip.filter((x): x is string => typeof x === "string" && /^[a-z0-9-]{2,40}:[a-z0-9]{1,12}$/.test(x)))].slice(0, 5000);
    if (skip.length) out.gramSkip = skip;
  }
  Object.assign(out, sanitizeUserData(v));
  const texts = sanitizeTexts(v.texts);
  if (texts) out.texts = texts;
  const essays = sanitizeEssays(v.essays);
  if (essays) out.essays = essays;
  const essayTasks = sanitizeAiTasks(v.essayTasks);
  if (essayTasks) out.essayTasks = essayTasks;
  const essayNotes = sanitizeNotes(v.essayNotes);
  if (essayNotes) out.essayNotes = essayNotes;
  const examLog = sanitizeExamLog(v.examLog);
  if (examLog) out.examLog = examLog;
  const s = v.session;
  if (isObj(s) && typeof s.id === "string" && Array.isArray(s.steps) && num(s.index, 0) && isObj(s.graded))
    out.session = s as unknown as ActiveSession;
  return syncFavorites(out);
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const WORD_ID = /^[\p{L}\p{N}_.'’-]{1,80}$/u;
export const CUSTOM_ID = /^u-[a-z0-9]{4,24}$/;
const DECK_ID = /^d-[a-z0-9]{4,24}$/;

function sanitizeExamples(v: unknown): UserExample[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter(isObj)
    .map((x) => {
      const ex: UserExample = { fr: str(x.fr, 400), zh: str(x.zh, 400) };
      if (x.src === "tatoeba") ex.src = "tatoeba";
      const hl = x.hl;
      if (Array.isArray(hl) && hl.length === 2 && num(hl[0], 0) && num(hl[1], 0) && (hl[0] as number) < (hl[1] as number) && (hl[1] as number) <= ex.fr.length)
        ex.hl = [hl[0] as number, hl[1] as number];
      return ex;
    })
    .filter((x) => x.fr)
    .slice(0, MAX_EXAMPLES);
  return out.length ? out : undefined;
}

/** Collocations: "French｜中文" strings, at most MAX_COLLOCATIONS. */
export const MAX_COLLOCATIONS = 8;
function sanitizeCollocations(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = [...new Set(v.map((x) => str(x, 160)).filter((x) => x && !x.startsWith("｜")))].slice(0, MAX_COLLOCATIONS);
  return out.length ? out : undefined;
}

function sanitizeRelated(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = [...new Set(v.map((x) => str(x, 120)).filter(Boolean))].slice(0, MAX_RELATED);
  return out.length ? out : undefined;
}
/** Further meanings and related words on a card, from stored data (untrusted). */
function sanitizeExtras(v: Record<string, unknown>): CardExtras {
  const out: CardExtras = {};
  const sources = cleanWikiSources(v.wikiSources);
  if (sources.length) out.wikiSources = sources;
  if (Array.isArray(v.senses)) {
    const senses = v.senses
      .filter(isObj)
      .map((x) => ({ pos: str(x.pos, 16), zh: str(x.zh, 300) }))
      .filter((x) => x.zh)
      .slice(0, MAX_OWN_SENSES);
    if (senses.length) out.senses = senses;
  }
  for (const k of ["syn", "ant", "fam"] as const) {
    const list = sanitizeRelated(v[k]);
    if (list) out[k] = list;
    else if (k === "fam" && Array.isArray(v.fam)) out.fam = [];
  }
  return out;
}

/** Decks, hidden words, custom words and edits from stored data or a backup (untrusted). */
export function sanitizeUserData(v: Record<string, unknown>): Pick<Progress, "decks" | "hidden" | "custom" | "edits" | "coreMigrated"> {
  const out: Pick<Progress, "decks" | "hidden" | "custom" | "edits" | "coreMigrated"> = {};
  const isWord = (x: unknown): x is string => typeof x === "string" && WORD_ID.test(x);
  if (v.coreMigrated === true) out.coreMigrated = true;
  if (Array.isArray(v.decks)) {
    const seen = new Set<string>();
    const decks: Deck[] = [];
    for (const d of v.decks) {
      if (!isObj(d) || typeof d.id !== "string" || !(d.id === CORE_DECK || DECK_ID.test(d.id)) || seen.has(d.id)) continue;
      const name = str(d.name, 40);
      if (!name) continue;
      seen.add(d.id);
      const words = Array.isArray(d.words) ? [...new Set(d.words.filter(isWord))].slice(0, 20000) : [];
      const deck: Deck = { id: d.id, name, created: num(d.created, 0) ? (d.created as number) : 0, words };
      const inDeck = new Set(words);
      if (isObj(d.sense)) {
        const sense: Record<string, number> = {};
        for (const [k, n] of Object.entries(d.sense)) if (inDeck.has(k) && num(n, 0, 30) && Number.isInteger(n)) sense[k] = n as number;
        if (Object.keys(sense).length) deck.sense = sense;
      }
      if (isObj(d.note)) {
        const note: Record<string, string> = {};
        for (const [k, n] of Object.entries(d.note)) if (inDeck.has(k) && str(n, 200)) note[k] = str(n, 200);
        if (Object.keys(note).length) deck.note = note;
      }
      decks.push(deck);
      if (decks.length >= 300) break;
    }
    if (decks.length) out.decks = decks;
  }
  if (Array.isArray(v.hidden)) {
    const hidden = [...new Set(v.hidden.filter(isWord))].slice(0, 20000);
    if (hidden.length) out.hidden = hidden;
  }
  if (isObj(v.custom)) {
    const custom: Record<string, CustomWord> = {};
    for (const [id, c] of Object.entries(v.custom)) {
      if (!CUSTOM_ID.test(id) || !isObj(c)) continue;
      const w = str(c.w, 80);
      const zh = str(c.zh, 300);
      if (!w || !zh) continue;
      const word: CustomWord = { w, zh, pos: str(c.pos, 16), created: num(c.created, 0) ? (c.created as number) : 0 };
      const ipa = str(c.ipa, 80);
      if (ipa) word.ipa = ipa;
      const ex = sanitizeExamples(c.ex);
      if (ex) word.ex = ex;
      const note = str(c.note, MAX_TIP);
      if (note) word.note = note;
      if (c.auto === true) word.auto = true;
      if (c.noImg === true) word.noImg = true;
      const col = sanitizeCollocations(c.col);
      if (col) word.col = col;
      Object.assign(word, sanitizeExtras(c));
      custom[id] = word;
      if (Object.keys(custom).length >= 20000) break;
    }
    if (Object.keys(custom).length) out.custom = custom;
  }
  if (isObj(v.edits)) {
    const edits: Record<string, WordEdit> = {};
    for (const [id, e] of Object.entries(v.edits)) {
      if (!isWord(id) || !isObj(e)) continue;
      const edit: WordEdit = {};
      if (e.replaceContent === true) edit.replaceContent = true;
      const zh = str(e.zh, 300);
      if (zh) edit.zh = zh;
      const ex = sanitizeExamples(e.ex);
      if (ex) edit.ex = ex;
      if (Array.isArray(e.zhMore)) {
        const more = e.zhMore.slice(0, 12).map((x) => str(x, 300) ?? "");
        while (more.length && !more[more.length - 1]) more.pop();
        if (more.length) edit.zhMore = more;
      }
      const nums = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((n): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < 40))].sort((a, b) => a - b) : []);
      const hideEx = nums(e.hideEx);
      if (hideEx.length) edit.hideEx = hideEx;
      const hide = nums(e.hide);
      if (hide.length) edit.hide = hide;
      if (e.noImg === true) edit.noImg = true;
      const col = sanitizeCollocations(e.col);
      if (col) edit.col = col;
      const tip = str(e.tip, MAX_TIP);
      if (tip) edit.tip = tip;
      Object.assign(edit, sanitizeExtras(e));
      if (Object.keys(edit).length) edits[id] = edit;
    }
    if (Object.keys(edits).length) out.edits = edits;
  }
  return out;
}

export function sanitizeSettings(v: unknown): Settings {
  const s = { ...defaultSettings };
  if (!isObj(v)) return s;
  if (v.accent === "uk" || v.accent === "us") s.accent = v.accent;
  if (typeof v.autoplay === "boolean") s.autoplay = v.autoplay;
  if (num(v.dailyNew, 0, MAX_DAILY_NEW)) s.dailyNew = Math.round(v.dailyNew as number);
  if (num(v.retention, 0.7, 0.97)) s.retention = v.retention as number;
  if (v.theme === "system" || v.theme === "light" || v.theme === "dark") s.theme = v.theme;
  if (typeof v.sfx === "boolean") s.sfx = v.sfx;
  if (typeof v.spell === "boolean") s.spell = v.spell;
  if (num(v.startLevel, 0, 5)) s.startLevel = Math.round(v.startLevel as number);
  if (typeof v.onboarded === "boolean") s.onboarded = v.onboarded;
  if (v.dataset === "open" || v.dataset === "private") s.dataset = v.dataset;
  if (["off", "stars", "rain", "sea", "forest", "fire", "voyage", "cafe"].includes(v.ambience as string)) s.ambience = v.ambience as Settings["ambience"];
  if (num(v.ambienceVolume, 0, 1)) s.ambienceVolume = v.ambienceVolume as number;
  if (typeof v.splash === "boolean") s.splash = v.splash;
  if (Array.isArray(v.conjTenses)) {
    const t = v.conjTenses.filter((x): x is string => ["pres", "pc", "imp", "fut", "cond", "subj"].includes(x as string));
    s.conjTenses = t.length ? [...new Set(t)] : null;
  }
  if (num(v.conjNew, 0, MAX_DAILY_NEW)) s.conjNew = Math.round(v.conjNew as number);
  if (typeof v.focusTopic === "string" && /^[a-z0-9-]{1,40}$/.test(v.focusTopic)) s.focusTopic = v.focusTopic;
  if (Array.isArray(v.studyFamilies)) {
    const ids = [...new Set(v.studyFamilies.filter((id): id is string => typeof id === "string" && (familyIds.has(id) || /^[a-z0-9][a-z0-9_-]{0,119}$/.test(id))))];
    s.studyFamilies = ids.length ? ids : null;
  }
  const chosenPos = Array.isArray(v.studyPos) ? v.studyPos : [v.studyPos];
  const validPos = POS_OPTIONS.filter(([key]) => chosenPos.includes(key)).map(([key]) => key);
  s.studyPos = validPos.length && validPos.length < POS_OPTIONS.length ? validPos : null;
  if (Array.isArray(v.studyDecks)) {
    const d = v.studyDecks.filter((x): x is string => typeof x === "string" && (x === CORE_DECK || DECK_ID.test(x)));
    s.studyDecks = d.length ? [...new Set(d)].slice(0, 300) : null;
  }
  if (typeof v.readColors === "boolean") s.readColors = v.readColors;
  if (typeof v.readDeck === "string" && (v.readDeck === CORE_DECK || DECK_ID.test(v.readDeck))) s.readDeck = v.readDeck;
  return s;
}

/* ---------- store ---------- */

interface State {
  progress: Progress;
  settings: Settings;
  saveError: boolean;
}

let state: State = {
  progress: emptyProgress("word-atlas-open"),
  settings: sanitizeSettings(read(SETTINGS_KEY)),
  saveError: false,
};
const listeners = new Set<() => void>();
let saveTimer: number | undefined;
/** Only write when this tab changed something, so idle tabs never clobber newer data. */
let dirty = false;
/** Progress is written only after it has been read from storage for this dataset. */
let loadedId: string | null = null;

function emit() {
  listeners.forEach((l) => l());
}

function scheduleSave() {
  dirty = true;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flush, 250);
}

export function flush() {
  window.clearTimeout(saveTimer);
  if (!dirty) return;
  dirty = false;
  const progressOk = loadedId !== state.progress.datasetId || write(progressKey(state.progress.datasetId), state.progress);
  const ok = progressOk && write(SETTINGS_KEY, state.settings);
  if (ok === state.saveError) {
    state = { ...state, saveError: !ok };
    emit();
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
  // Another tab saved: adopt its data instead of keeping a stale copy.
  window.addEventListener("storage", (e) => {
    if (!e.newValue) return;
    try {
      if (e.key === SETTINGS_KEY) state = { ...state, settings: sanitizeSettings(JSON.parse(e.newValue)) };
      else if (e.key === progressKey(state.progress.datasetId))
        state = { ...state, progress: sanitizeProgress(JSON.parse(e.newValue), state.progress.datasetId) };
      else return;
      emit();
    } catch {
      /* ignore malformed writes */
    }
  });
}

/* ---------- alias migration with snapshots ---------- */

export const listSnapshots = (datasetId: string) =>
  Object.keys(localStorage)
    .filter((k) => k.startsWith(`word-atlas:snapshot:${datasetId}:`))
    .sort();

/** Keep the five newest snapshots; older ones are removed. */
function writeSnapshot(p: Progress): string {
  const key = `word-atlas:snapshot:${p.datasetId}:${Date.now()}`;
  write(key, p);
  const keys = listSnapshots(p.datasetId);
  for (const k of keys.slice(0, Math.max(0, keys.length - 5))) localStorage.removeItem(k);
  return key;
}

export const store = {
  get: () => state,
  /** Move alias records onto their primary ids. Saves a snapshot first; changes nothing when already migrated. */
  migrateAliases(aliases: AliasMap) {
    const { progress, report } = migrateAliasesPure(state.progress, aliases);
    if (!report.changed) return { ...report, snapshot: null as string | null };
    const snapshot = writeSnapshot(state.progress);
    state = { ...state, progress: syncFavorites(progress) };
    emit();
    scheduleSave();
    flush();
    return { ...report, snapshot };
  },
  /** Replace the current progress with a snapshot taken earlier (keeps everything else). */
  restoreSnapshot(key: string): boolean {
    const raw = read<Progress>(key);
    if (!raw) return false;
    const restored = sanitizeProgress(raw, state.progress.datasetId);
    state = { ...state, progress: restored };
    emit();
    scheduleSave();
    flush();
    return true;
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  useDataset(datasetId: string) {
    flush();
    state = { ...state, progress: sanitizeProgress(read(progressKey(datasetId)), datasetId) };
    loadedId = datasetId;
    emit();
  },
  progress(fn: (p: Progress) => Progress) {
    state = { ...state, progress: syncFavorites(fn(state.progress)) };
    emit();
    scheduleSave();
  },
  settings(patch: Partial<Settings>) {
    state = { ...state, settings: { ...state.settings, ...patch } };
    emit();
    scheduleSave();
  },
};

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(state), () => select(state));
}

export function bumpDay(p: Progress, patch: Partial<DayStat>): Progress {
  const k = dayKey();
  const d = p.days[k] ?? { n: 0, r: 0, c: 0, t: 0 };
  return {
    ...p,
    days: {
      ...p.days,
      [k]: { n: d.n + (patch.n ?? 0), r: d.r + (patch.r ?? 0), c: d.c + (patch.c ?? 0), t: d.t + (patch.t ?? 0) },
    },
  };
}

export function toggleBookmark(id: string) {
  store.progress((p) => ({
    ...p,
    bookmarks: p.bookmarks.includes(id) ? p.bookmarks.filter((x) => x !== id) : [id, ...p.bookmarks],
  }));
}

/* ---------- backup ---------- */

export function exportBackup() {
  flush();
  const { progress, settings } = state;
  const images = getImages();
  return JSON.stringify({ app: "word-atlas", version: 2, exported: new Date().toISOString(), progress: { ...progress, session: null }, settings, ...(Object.keys(images).length ? { images } : {}) }, null, 1);
}

function markDirty() {
  dirty = true;
}

export function importBackup(text: string): { ok: true; cards: number } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "文件不是有效的 JSON。" };
  }
  if (!isObj(data) || data.app !== "word-atlas" || data.version !== 2 || !isObj(data.progress))
    return { ok: false, error: "这不是法语词光的学习备份。" };
  const id = state.progress.datasetId;
  if (data.progress.datasetId !== id) return { ok: false, error: "备份来自另一个词库，请先切换到对应词库。" };
  const progress = sanitizeProgress({ ...data.progress, session: null }, id);
  state = { ...state, progress, settings: { ...sanitizeSettings(data.settings), onboarded: true } };
  // pictures the learner added (卡组 / 自建词), when the backup has them
  if (isObj(data.images)) {
    const imgs: Record<string, string> = {};
    for (const [k, v] of Object.entries(data.images)) if (WORD_ID.test(k) && isImageDataUrl(v)) imgs[k] = v;
    void replaceImages(imgs);
  }
  emit();
  markDirty();
  flush();
  return { ok: true, cards: Object.keys(progress.cards).length };
}

export function resetProgress() {
  state = { ...state, progress: emptyProgress(state.progress.datasetId) };
  emit();
  markDirty();
  flush();
}
