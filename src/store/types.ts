import type { Accent } from "../atlas/types";
import type { CardState, Grade } from "./srs";
import type { SavedText } from "../lib/reader";
import type { EssayCorrection, EssayTask, SavedEssay, SavedNote } from "../lib/essay-schema";
import type { ExamResult, MockRecord, SpeakingSession, WeeklyRemediationPlan } from "../lib/exam-schema";
import type { CompMiss, RealSource } from "../lib/listening";
import type { BookProgressEntry, LoungeMode, MediaProgressEntry, SavedLoungeClip } from "../lib/lounge-types";
import type { PlacementResult } from "../lib/placement-schema";

/**
 * "gender": choose un / une for a noun (no options list; the two articles are fixed).
 * "cloze": an example sentence with the word blanked (and its Chinese), choose the French word.
 * "dictation": hear the example sentence, type the blanked word.
 * "collocation": complete a high-frequency French collocation with the target word (B2+ depth).
 * "register": identify whether a B2+ word belongs to soutenu, courant, or familier register.
 */
export const QUIZ_KINDS = [
  "meaning",
  "picture",
  "listen",
  "spell",
  "gender",
  "cloze",
  "dictation",
  "collocation",
  "register",
] as const;

export type QuizKind = (typeof QUIZ_KINDS)[number];

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
/** Collocations: "French｜中文" strings, at most MAX_COLLOCATIONS. */
export const MAX_COLLOCATIONS = 8;

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

export const WORD_ID = /^[\p{L}\p{N}_.'’-]{1,80}$/u;
export const CUSTOM_ID = /^u-[a-z0-9]{4,24}$/;
export const DECK_ID = /^d-[a-z0-9]{4,24}$/;

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
  pending?: {
    correct: boolean;
    value: string;
    grade?: Grade;
    /** right letters, wrong accent: counted correct but graded Hard */
    accentOnly?: boolean;
    /** noun spelled right, article wrong or missing: counted wrong */
    articleWrong?: boolean;
  };
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
  /** How the learner does on each part of a grammar point ("point|r2", "point|t0"): answered n, wrong w (rolling). */
  gramTags?: Record<string, { n: number; w: number }>;
  /** Expression cards (表达: connectors, argument frames, collocations, register, letter formulas), one per expression id. */
  expr?: Record<string, CardState>;
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
  /** FSRS review cards for non-grammar essay notes ("note:<id>") and comprehension misses ("miss:<key>"). */
  noteCards?: Record<string, CardState>;
  /** Results of 听力理解、应试阅读、口语, newest first. */
  examLog?: ExamResult[];
  /** Questions missed in 听力理解 / 应试阅读, with why (错因), newest first. */
  compMisses?: CompMiss[];
  /** 真实材料精听: recordings on other sites, by link and timestamps. */
  listenSources?: RealSource[];
  /** 每日一分钟口语 done per day (dayKey → count). */
  drillDays?: Record<string, number>;
  /** Optional DELF diagnostic placement result (摸底定级小测). */
  placement?: PlacementResult;
  /** Mistakes recorded from speaking markings (口语纠错), newest first. */
  speakCorrections?: SavedSpeakingCorrection[];
  /** Dictionary lookup history (entry ids), newest first, capped at MAX_DICT_HISTORY. */
  dictHistory?: string[];
  /** Dictionary favorited entry ids, newest first. */
  dictFavs?: string[];
  /** Learner notes per dictionary entry id. */
  dictNotes?: Record<string, string>;
  /** Epoch ms timestamps for dictionary note edits and clears. */
  dictNotesAt?: Record<string, number>;
  /** Deletion tombstones (`<kind>:<id>` -> deletedAt ms) to prevent multi-device resurrection on sync merge. */
  tombstones?: Record<string, number>;
  /** Learner-submitted dictionary error reports, newest first. */
  dictReports?: DictReport[];
  /** Archived PO speaking runs (scores, phoneme summary, transcripts, IDB takeId), newest first. */
  speakingSessions?: SpeakingSession[];
  /** Archived 4-section DELF B2 mock exam scorecards, newest first. */
  mockRecords?: MockRecord[];
  /** Active 7-day prioritized remediation plan generated from exam readiness/misses. */
  weeklyPlan?: WeeklyRemediationPlan;
  /** FSRS card word IDs suspended by the learner due to repeated lapses (leeches). */
  suspendedLeeches?: string[];
  /** Lounge book reading progress keyed by bookId, capped at MAX_BOOK_PROGRESS. */
  bookProgress?: Record<string, BookProgressEntry>;
  /** Lounge video / micro-read progress keyed by itemId, capped at MAX_MEDIA_PROGRESS. */
  mediaProgress?: Record<string, MediaProgressEntry>;
  /** Lounge light completions per day (dayKey -> count), capped at MAX_LOUNGE_DAYS. */
  loungeDays?: Record<string, number>;
  /** Favorite bilingual sentences/quotes clipped in Lounge, newest first, capped at MAX_LOUNGE_CLIPS. */
  loungeClips?: SavedLoungeClip[];
}

export interface DictReport {
  id: string;
  entryId: string;
  w?: string;
  kind?: string;
  detail: string;
  at: number;
}

export const MAX_DICT_HISTORY = 200;
export const MAX_DICT_FAVS = 5000;
export const MAX_DICT_NOTES = 5000;
export const MAX_DICT_REPORTS = 200;
export const MAX_BOOK_PROGRESS = 200;
export const MAX_MEDIA_PROGRESS = 300;
export const MAX_LOUNGE_DAYS = 800;
export const MAX_LOUNGE_CLIPS = 60;
export const MAX_TOMBSTONES = 2000;
export const TOMBSTONE_TTL_MS = 90 * 86400 * 1000;

export interface SavedSpeakingCorrection {
  id: string;
  subject: string;
  at: number;
  corrections: EssayCorrection[];
}

export const MAX_SPEAK_CORRECTIONS = 40;
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
  /** Target DELF B2 exam date ("YYYY-MM-DD"), or null if unset. */
  examDate: string | null;
  /** Target total score out of 100 (default 75). */
  targetScore: number;
  /** Optional custom daily prep budget in minutes (20..180); null = auto (60 under 6 months, else 45). */
  dailyMinutes: number | null;
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
  /** Daily SRS review card cap in todayPlan (10–300); null = no cap (default FSRS behavior). */
  dailyReviewCap: number | null;
  /** Epoch ms when the learner last exported a JSON backup; null if never exported. */
  lastBackupAt: number | null;
  /** Lounge immersion mode: "chill" (pure reading/watching) or "study" (one-tap clip & vocab aids). */
  loungeMode: LoungeMode;
  /** Active exam track ("delf" = DELF B2, "tcf" = TCF TP/Canada, "tef" = TEF post-Dec 2023). */
  examTrack: "delf" | "tcf" | "tef";
}

export interface State {
  progress: Progress;
  settings: Settings;
  saveError: boolean;
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
  examDate: null,
  targetScore: 75,
  dailyMinutes: null,
  dataset: "open",
  ambience: "stars",
  ambienceVolume: 0.45,
  splash: true,
  conjTenses: null,
  conjNew: 1,
  focusTopic: null,
  studyDecks: null,
  studyPos: null,
  studyFamilies: null,
  readColors: true,
  readDeck: null,
  dailyReviewCap: null,
  lastBackupAt: null,
  loungeMode: "chill",
  examTrack: "delf",
};

export const SETTINGS_KEY = "word-atlas:settings";
export const progressKey = (id: string) => `word-atlas:v2:${id}`;

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

/** Bookmarks are the source of truth for the automatic collection. */
export function syncFavorites(p: Progress): Progress {
  if (!p.coreMigrated) return p;
  const old = p.decks?.find((d) => d.id === FAVORITES_DECK);
  const words = [...new Set(p.bookmarks)];
  const members = new Set(words);
  const keep = <T,>(v?: Record<string, T>) =>
    v ? Object.fromEntries(Object.entries(v).filter(([id]) => members.has(id))) : undefined;
  const deck: Deck = {
    ...old,
    id: FAVORITES_DECK,
    name: "收藏",
    created: old?.created ?? 0,
    words,
    sense: keep(old?.sense),
    note: keep(old?.note),
  };
  return { ...p, decks: [...(p.decks ?? []).filter((d) => d.id !== FAVORITES_DECK), deck] };
}

/** Strip heavy essays/texts from the localStorage mirror once IndexedDB vault holds them. */
export function compactProgressForLocalStorage(p: Progress): Progress {
  if (!p.texts?.length && !p.essays?.length) return p;
  const { texts: _t, essays: _e, ...rest } = p;
  void _t;
  void _e;
  return rest;
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

export const TOMBSTONE_KEY_RE =
  // eslint-disable-next-line no-control-regex
  /^(?:essay|task|note|text|source|deck|custom|fav|dictNote|bookmark|draft|speakSess|mock|loungeClip):[^\u0000-\u001f]{1,120}$/;

/** Remove stale or invalid tombstones past TOMBSTONE_TTL_MS. */
export function sanitizeTombstones(v: unknown, now = Date.now()): Record<string, number> | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const minAt = now - TOMBSTONE_TTL_MS;
  const entries = Object.entries(v)
    .filter(([k, ts]) => TOMBSTONE_KEY_RE.test(k) && typeof ts === "number" && Number.isFinite(ts) && ts >= 1 && ts >= minAt)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, MAX_TOMBSTONES);
  if (!entries.length) return undefined;
  return Object.fromEntries(entries) as Record<string, number>;
}

/** Record a deletion tombstone for multi-device sync merge (dropping entries older than TOMBSTONE_TTL_MS). */
export function markTombstone(p: Progress, key: string, at = Date.now()): Progress {
  if (!TOMBSTONE_KEY_RE.test(key)) return p;
  const next = sanitizeTombstones({ ...(p.tombstones ?? {}), [key]: Math.max(p.tombstones?.[key] ?? 0, at) }, at);
  return next ? { ...p, tombstones: next } : p;
}

/** Remove a deletion tombstone when the same item/id is explicitly recreated. */
export function clearTombstone(p: Progress, key: string): Progress {
  if (!p.tombstones || !(key in p.tombstones)) return p;
  const { [key]: _drop, ...rest } = p.tombstones;
  void _drop;
  if (Object.keys(rest).length) return { ...p, tombstones: rest };
  const { tombstones: _t, ...pRest } = p;
  void _t;
  return pRest;
}

export function hasAnyProgress(
  p: Pick<
    Progress,
    | "cards"
    | "essays"
    | "examLog"
    | "texts"
    | "gram"
    | "conj"
    | "expr"
    | "custom"
    | "bookmarks"
    | "dictFavs"
    | "dictNotes"
    | "placement"
    | "bookProgress"
    | "mediaProgress"
    | "loungeDays"
    | "loungeClips"
  >,
): boolean {
  if (!p || typeof p !== "object") return false;
  return (
    Object.keys(p.cards ?? {}).length > 0 ||
    (p.essays?.length ?? 0) > 0 ||
    (p.examLog?.length ?? 0) > 0 ||
    (p.texts?.length ?? 0) > 0 ||
    Object.keys(p.gram ?? {}).length > 0 ||
    Object.keys(p.conj ?? {}).length > 0 ||
    Object.keys(p.expr ?? {}).length > 0 ||
    Object.keys(p.custom ?? {}).length > 0 ||
    (p.bookmarks?.length ?? 0) > 0 ||
    (p.dictFavs?.length ?? 0) > 0 ||
    Object.keys(p.dictNotes ?? {}).length > 0 ||
    Object.keys(p.bookProgress ?? {}).length > 0 ||
    Object.keys(p.mediaProgress ?? {}).length > 0 ||
    Object.keys(p.loungeDays ?? {}).length > 0 ||
    (p.loungeClips?.length ?? 0) > 0 ||
    !!p.placement
  );
}

export function needsBackupReminder(
  p: Pick<
    Progress,
    | "cards"
    | "days"
    | "essays"
    | "examLog"
    | "texts"
    | "gram"
    | "conj"
    | "expr"
    | "custom"
    | "bookmarks"
    | "dictFavs"
    | "dictNotes"
    | "placement"
    | "bookProgress"
    | "mediaProgress"
    | "loungeDays"
    | "loungeClips"
  >,
  lastBackupAt: number | null,
  now = Date.now(),
): { remind: boolean; daysSince: number } {
  if (!hasAnyProgress(p)) return { remind: false, daysSince: 0 };
  if (lastBackupAt !== null) {
    const daysSince = Math.max(0, Math.floor((now - lastBackupAt) / 86400000));
    return { remind: daysSince >= 7, daysSince };
  }
  const stamps: number[] = [];
  for (const k of Object.keys(p.days)) {
    const [y, m, d] = k.split("-").map(Number);
    if (y && m && d) stamps.push(new Date(y, m - 1, d).getTime());
  }
  for (const c of Object.values(p.cards)) if (c.seen > 0) stamps.push(c.seen);
  for (const e of p.essays ?? []) stamps.push(e.created);
  for (const r of p.examLog ?? []) stamps.push(r.at);
  for (const t of p.texts ?? []) stamps.push(t.created);
  if (p.placement?.at) stamps.push(p.placement.at);
  if (!stamps.length) return { remind: false, daysSince: 0 };
  const earliest = Math.min(...stamps);
  const daysSince = Math.max(0, Math.floor((now - earliest) / 86400000));
  return { remind: daysSince >= 7, daysSince };
}
