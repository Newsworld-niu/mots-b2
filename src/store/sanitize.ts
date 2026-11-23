import { TENSES } from "../lib/conj-schema";
import { EXPR_ID } from "../lib/expr-schema";
import { sanitizeExamLog, sanitizeMockRecords, sanitizeSpeakingSessions, sanitizeWeeklyPlan } from "../lib/exam-schema";
import { sanitizeAiTasks, sanitizeEssays, sanitizeNotes, type EssayCorrection } from "../lib/essay-schema";
import { sanitizeMisses, sanitizeSources } from "../lib/listening";
import { sanitizeDrillDays } from "../lib/drill-schema";
import type { BookProgressEntry, MediaProgressEntry, SavedLoungeClip } from "../lib/lounge-types";
import { sanitizePlacement } from "../lib/placement-schema";
import { POS_OPTIONS } from "../lib/pos";
import { sanitizeTexts } from "../lib/reader";
import { cleanWikiSources } from "../lib/wiktionary";
import { ERROR_TYPES, type ErrorType } from "../lib/writing";
import type { CardState, Grade } from "./srs";
import {
  CORE_DECK,
  CUSTOM_ID,
  DECK_ID,
  MAX_BOOK_PROGRESS,
  MAX_COLLOCATIONS,
  MAX_DAILY_NEW,
  MAX_DICT_FAVS,
  MAX_DICT_HISTORY,
  MAX_DICT_NOTES,
  MAX_DICT_REPORTS,
  MAX_EXAMPLES,
  MAX_LOUNGE_CLIPS,
  MAX_LOUNGE_DAYS,
  MAX_MEDIA_PROGRESS,
  MAX_OWN_SENSES,
  MAX_RELATED,
  MAX_SPEAK_CORRECTIONS,
  MAX_TIP,
  QUIZ_KINDS,
  WORD_ID,
  defaultSettings,
  emptyProgress,
  sanitizeTombstones,
  syncFavorites,
  type ActiveSession,
  type CardExtras,
  type CustomWord,
  type Deck,
  type DictReport,
  type Progress,
  type QuizKind,
  type SavedSpeakingCorrection,
  type Settings,
  type Step,
  type TypingRound,
  type UserExample,
  type WordEdit,
} from "./types";

export const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown, lo = -Infinity, hi = Infinity) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const isValidGrade = (g: unknown): g is Grade => g === 1 || g === 2 || g === 3 || g === 4;

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

/** Strictly validate an ActiveSession loaded from localStorage or a sync/backup payload. */
export function sanitizeSession(v: unknown): ActiveSession | null {
  if (!isObj(v)) return null;
  const id = str(v.id, 80);
  if (!id || !num(v.started, 0) || !Array.isArray(v.steps) || !num(v.index, 0) || !Number.isInteger(v.index) || !isObj(v.graded)) {
    return null;
  }
  const steps: Step[] = [];
  for (const raw of v.steps) {
    if (!isObj(raw) || typeof raw.id !== "string" || !WORD_ID.test(raw.id) || typeof raw.kind !== "string") continue;
    if (raw.kind === "intro") {
      const step: Step = { id: raw.id, kind: "intro" };
      if (num(raw.sense, 0, 30) && Number.isInteger(raw.sense)) step.sense = raw.sense as number;
      steps.push(step);
      continue;
    }
    if (raw.kind === "pairing") {
      if (!Array.isArray(raw.ids)) continue;
      const ids = [...new Set(raw.ids.filter((x): x is string => typeof x === "string" && WORD_ID.test(x)))].slice(0, 10);
      if (ids.length < 2) continue;
      steps.push({ id: raw.id, kind: "pairing", ids });
      continue;
    }
    if ((QUIZ_KINDS as readonly string[]).includes(raw.kind)) {
      const step: Extract<Step, { kind: QuizKind }> = { id: raw.id, kind: raw.kind as QuizKind };
      if (raw.retry === true) step.retry = true;
      if (raw.pair === true) step.pair = true;
      if (num(raw.sense, 0, 30) && Number.isInteger(raw.sense)) step.sense = raw.sense as number;
      if (Array.isArray(raw.options)) {
        const opts = raw.options.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 120).slice(0, 12);
        if (opts.length) step.options = opts;
      }
      steps.push(step);
    }
  }
  if (!steps.length) return null;

  const graded: Record<string, Grade> = {};
  for (const [k, g] of Object.entries(v.graded)) {
    if (WORD_ID.test(k) && isValidGrade(g)) graded[k] = g;
  }

  const wordList = (raw: unknown): string[] =>
    Array.isArray(raw) ? [...new Set(raw.filter((x): x is string => typeof x === "string" && WORD_ID.test(x)))].slice(0, 500) : [];

  const session: ActiveSession = {
    id,
    started: v.started as number,
    steps,
    index: Math.min(v.index as number, steps.length),
    graded,
    newIds: wordList(v.newIds),
    reviewIds: wordList(v.reviewIds),
  };

  if (Array.isArray(v.unknown)) {
    const unknown = wordList(v.unknown);
    if (unknown.length) session.unknown = unknown;
  }

  if (isObj(v.pending) && typeof v.pending.correct === "boolean" && typeof v.pending.value === "string") {
    const pending: NonNullable<ActiveSession["pending"]> = {
      correct: v.pending.correct,
      value: v.pending.value.slice(0, 200),
    };
    if (isValidGrade(v.pending.grade)) pending.grade = v.pending.grade;
    if (v.pending.accentOnly === true) pending.accentOnly = true;
    if (v.pending.articleWrong === true) pending.articleWrong = true;
    session.pending = pending;
  }

  if (num(v.finished, 0)) session.finished = v.finished as number;
  return session;
}

export function sanitizeSpeakingCorrections(v: unknown): SavedSpeakingCorrection[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: SavedSpeakingCorrection[] = [];
  for (const x of v) {
    if (!isObj(x) || typeof x.id !== "string" || !x.id.trim() || typeof x.at !== "number" || !Number.isFinite(x.at)) continue;
    const subject = str(x.subject, 80);
    if (!subject || !Array.isArray(x.corrections)) continue;
    const corrections: EssayCorrection[] = [];
    for (const c of x.corrections) {
      if (!isObj(c)) continue;
      const wrong = str(c.wrong, 200);
      const right = str(c.right, 200);
      if (!(wrong || right) || wrong === right) continue;
      corrections.push({
        wrong,
        right,
        type: (ERROR_TYPES as readonly string[]).includes(c.type as string) ? (c.type as ErrorType) : "other",
        why: str(c.why, 300),
        point: typeof c.point === "string" && /^[a-z0-9-]{2,40}$/.test(c.point) ? c.point : "",
      });
      if (corrections.length >= 25) break;
    }
    if (!corrections.length) continue;
    out.push({ id: x.id.trim().slice(0, 40), subject, at: x.at, corrections });
    if (out.length >= MAX_SPEAK_CORRECTIONS) break;
  }
  return out.length ? out : undefined;
}

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
      const nums = (x: unknown) =>
        Array.isArray(x) ? [...new Set(x.filter((n): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < 40))].sort((a, b) => a - b) : [];
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
    for (const [k, c] of Object.entries(v.conj))
      if (/^[^|]+\|(pres|pc|imp|fut|cond|subj|pqp|fa|condp|subjp|ppres|imper)(\|[0-5])?$/.test(k) && validCard(c)) conj[k] = c;
    if (Object.keys(conj).length) out.conj = conj;
  }
  if (isObj(v.conjDays)) {
    const days: Record<string, { n: number; r: number; c: number; verbs?: string[] }> = {};
    for (const [k, d] of Object.entries(v.conjDays))
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && isObj(d) && num(d.n, 0) && num(d.r, 0) && num(d.c, 0))
        days[k] = {
          n: d.n as number,
          r: d.r as number,
          c: d.c as number,
          ...(Array.isArray(d.verbs) ? { verbs: [...new Set(d.verbs.filter((id): id is string => typeof id === "string" && id.length > 0))] } : {}),
        };
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
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && isObj(d) && num(d.n, 0) && num(d.r, 0) && num(d.c, 0))
        days[k] = {
          n: d.n as number,
          r: d.r as number,
          c: d.c as number,
          ...(Array.isArray(d.verbs) ? { verbs: [...new Set(d.verbs.filter((id): id is string => typeof id === "string" && id.length > 0))] } : {}),
        };
    if (Object.keys(days).length) out.gramDays = days;
  }
  if (Array.isArray(v.gramSkip)) {
    const skip = [...new Set(v.gramSkip.filter((x): x is string => typeof x === "string" && /^[a-z0-9-]{2,40}:[a-z0-9]{1,12}$/.test(x)))].slice(0, 5000);
    if (skip.length) out.gramSkip = skip;
  }
  if (isObj(v.gramTags)) {
    const tags: Record<string, { n: number; w: number }> = {};
    for (const [k, t] of Object.entries(v.gramTags))
      if (/^[a-z0-9-]{2,40}\|[rt]\d{1,2}$/.test(k) && isObj(t) && num(t.n, 0) && num(t.w, 0) && (t.w as number) <= (t.n as number))
        tags[k] = { n: t.n as number, w: t.w as number };
    if (Object.keys(tags).length) out.gramTags = tags;
  }
  if (isObj(v.expr)) {
    const expr: Record<string, CardState> = {};
    for (const [k, c] of Object.entries(v.expr)) if (EXPR_ID.test(k) && validCard(c)) expr[k] = c;
    if (Object.keys(expr).length) out.expr = expr;
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
  if (isObj(v.noteCards)) {
    const noteCards: Record<string, CardState> = {};
    for (const [k, c] of Object.entries(v.noteCards))
      if (/^(note|miss):[a-zA-Z0-9._:-]{1,80}$/.test(k) && validCard(c)) noteCards[k] = c;
    if (Object.keys(noteCards).length) out.noteCards = noteCards;
  }
  const examLog = sanitizeExamLog(v.examLog);
  if (examLog) out.examLog = examLog;
  const compMisses = sanitizeMisses(v.compMisses);
  if (compMisses) out.compMisses = compMisses;
  const listenSources = sanitizeSources(v.listenSources);
  if (listenSources) out.listenSources = listenSources;
  const drillDays = sanitizeDrillDays(v.drillDays);
  if (drillDays) out.drillDays = drillDays;
  const placement = sanitizePlacement(v.placement);
  if (placement) out.placement = placement;
  const speakCorrections = sanitizeSpeakingCorrections(v.speakCorrections);
  if (speakCorrections) out.speakCorrections = speakCorrections;
  const speakingSessions = sanitizeSpeakingSessions(v.speakingSessions);
  if (speakingSessions) out.speakingSessions = speakingSessions;
  const mockRecords = sanitizeMockRecords(v.mockRecords);
  if (mockRecords) out.mockRecords = mockRecords;
  const weeklyPlan = sanitizeWeeklyPlan(v.weeklyPlan);
  if (weeklyPlan) out.weeklyPlan = weeklyPlan;
  if (Array.isArray(v.suspendedLeeches)) {
    const leeches = [...new Set(v.suspendedLeeches.filter((x): x is string => typeof x === "string" && WORD_ID.test(x)))].slice(0, 2000);
    if (leeches.length) out.suspendedLeeches = leeches;
  }
  const validDictId = (x: unknown): string => {
    if (typeof x !== "string") return "";
    const s = x.trim();
    // eslint-disable-next-line no-control-regex
    return !s || s.length > 120 || /[\u0000-\u001f]/.test(s) ? "" : s;
  };
  if (Array.isArray(v.dictHistory)) {
    const dictHistory = [...new Set(v.dictHistory.map(validDictId).filter(Boolean))].slice(0, MAX_DICT_HISTORY);
    if (dictHistory.length) out.dictHistory = dictHistory;
  }
  if (Array.isArray(v.dictFavs)) {
    const dictFavs = [...new Set(v.dictFavs.map(validDictId).filter(Boolean))].slice(0, MAX_DICT_FAVS);
    if (dictFavs.length) out.dictFavs = dictFavs;
  }
  if (isObj(v.dictNotes)) {
    const dictNotes: Record<string, string> = {};
    for (const [k, raw] of Object.entries(v.dictNotes)) {
      const id = validDictId(k);
      const note = str(raw, MAX_TIP);
      if (!id || !note) continue;
      dictNotes[id] = note;
      if (Object.keys(dictNotes).length >= MAX_DICT_NOTES) break;
    }
    if (Object.keys(dictNotes).length) out.dictNotes = dictNotes;
  }
  if (isObj(v.dictNotesAt)) {
    const dictNotesAt: Record<string, number> = {};
    for (const [k, raw] of Object.entries(v.dictNotesAt)) {
      const id = validDictId(k);
      if (!id || !num(raw, 0)) continue;
      dictNotesAt[id] = raw as number;
      if (Object.keys(dictNotesAt).length >= MAX_DICT_NOTES) break;
    }
    if (Object.keys(dictNotesAt).length) out.dictNotesAt = dictNotesAt;
  }
  const tombstones = sanitizeTombstones(v.tombstones);
  if (tombstones) out.tombstones = tombstones;
  if (Array.isArray(v.dictReports)) {
    const seen = new Set<string>();
    const dictReports: DictReport[] = [];
    for (const r of v.dictReports) {
      if (!isObj(r)) continue;
      const id = str(r.id, 60);
      const entryId = validDictId(r.entryId);
      const detail = str(r.detail, 500);
      if (!id || seen.has(id) || !entryId || !detail || !num(r.at, 0)) continue;
      seen.add(id);
      const item: DictReport = { id, entryId, detail, at: r.at as number };
      const w = str(r.w, 120);
      if (w) item.w = w;
      const kind = str(r.kind, 40);
      if (kind) item.kind = kind;
      dictReports.push(item);
      if (dictReports.length >= MAX_DICT_REPORTS) break;
    }
    if (dictReports.length) out.dictReports = dictReports;
  }
  if (isObj(v.bookProgress)) {
    const entries: [string, BookProgressEntry][] = [];
    for (const [k, raw] of Object.entries(v.bookProgress)) {
      const id = validDictId(k);
      if (!id || !isObj(raw) || !num(raw.ch, 0, 10000) || !num(raw.ratio, 0, 1) || !num(raw.updatedAt, 0)) continue;
      const entry: BookProgressEntry = {
        ch: Math.floor(raw.ch as number),
        para: num(raw.para, 0, 100000) ? Math.floor(raw.para as number) : 0,
        ratio: raw.ratio as number,
        updatedAt: raw.updatedAt as number,
      };
      if (num(raw.done, 1)) entry.done = raw.done as number;
      const title = str(raw.title, 200);
      if (title) entry.title = title;
      entries.push([id, entry]);
    }
    entries.sort((a, b) => b[1].updatedAt - a[1].updatedAt);
    if (entries.length) out.bookProgress = Object.fromEntries(entries.slice(0, MAX_BOOK_PROGRESS));
  }
  if (isObj(v.mediaProgress)) {
    const entries: [string, MediaProgressEntry][] = [];
    for (const [k, raw] of Object.entries(v.mediaProgress)) {
      const id = validDictId(k);
      if (!id || !isObj(raw) || !num(raw.pos, 0) || !num(raw.updatedAt, 0)) continue;
      const entry: MediaProgressEntry = {
        pos: raw.pos as number,
        updatedAt: raw.updatedAt as number,
      };
      if (num(raw.dur, 0) && (raw.dur as number) > 0) entry.dur = raw.dur as number;
      if (num(raw.done, 1)) entry.done = raw.done as number;
      const title = str(raw.title, 200);
      if (title) entry.title = title;
      if (raw.shelf === "books" || raw.shelf === "reads" || raw.shelf === "videos") entry.shelf = raw.shelf;
      entries.push([id, entry]);
    }
    entries.sort((a, b) => b[1].updatedAt - a[1].updatedAt);
    if (entries.length) out.mediaProgress = Object.fromEntries(entries.slice(0, MAX_MEDIA_PROGRESS));
  }
  if (isObj(v.loungeDays)) {
    const entries: [string, number][] = [];
    for (const [k, raw] of Object.entries(v.loungeDays)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && num(raw, 1, 1000)) {
        entries.push([k, Math.floor(raw as number)]);
      }
    }
    entries.sort((a, b) => b[0].localeCompare(a[0]));
    if (entries.length) out.loungeDays = Object.fromEntries(entries.slice(0, MAX_LOUNGE_DAYS));
  }
  if (Array.isArray(v.loungeClips)) {
    const seen = new Set<string>();
    const clips: SavedLoungeClip[] = [];
    for (const c of v.loungeClips) {
      if (!isObj(c)) continue;
      const id = validDictId(c.id);
      const fr = str(c.fr, 1000);
      if (!id || seen.has(id) || !fr || !num(c.created, 0)) continue;
      seen.add(id);
      clips.push({
        id,
        fr,
        zh: str(c.zh, 1000),
        source: str(c.source, 200),
        created: c.created as number,
      });
      if (clips.length >= MAX_LOUNGE_CLIPS) break;
    }
    if (clips.length) out.loungeClips = clips;
  }
  out.session = sanitizeSession(v.session);
  return syncFavorites(out);
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
  if (typeof v.examDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.examDate)) {
    const [y, m, d] = v.examDate.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) s.examDate = v.examDate;
  }
  if (num(v.targetScore, 50, 100)) s.targetScore = Math.round(v.targetScore as number);
  if (num(v.dailyMinutes, 20, 180)) s.dailyMinutes = Math.round(v.dailyMinutes as number);
  if (v.dataset === "open" || v.dataset === "private") s.dataset = v.dataset;
  if (["off", "stars", "rain", "sea", "forest", "fire", "voyage", "cafe"].includes(v.ambience as string)) s.ambience = v.ambience as Settings["ambience"];
  if (num(v.ambienceVolume, 0, 1)) s.ambienceVolume = v.ambienceVolume as number;
  if (typeof v.splash === "boolean") s.splash = v.splash;
  if (Array.isArray(v.conjTenses)) {
    const t = v.conjTenses.filter((x): x is string => (TENSES as readonly string[]).includes(x as string));
    s.conjTenses = t.length ? [...new Set(t)] : null;
  }
  if (num(v.conjNew, 0, MAX_DAILY_NEW)) s.conjNew = Math.round(v.conjNew as number);
  if (typeof v.focusTopic === "string" && /^[a-z0-9-]{1,40}$/.test(v.focusTopic)) s.focusTopic = v.focusTopic;
  if (Array.isArray(v.studyFamilies)) {
    const ids = [...new Set(v.studyFamilies.filter((id): id is string => typeof id === "string" && /^[\p{L}\p{N}][\p{L}\p{N}_.-]{0,119}$/u.test(id)))];
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
  if (num(v.dailyReviewCap, 10, 300)) s.dailyReviewCap = Math.round(v.dailyReviewCap as number);
  if (num(v.lastBackupAt, 0)) s.lastBackupAt = v.lastBackupAt as number;
  if (v.loungeMode === "chill" || v.loungeMode === "study") s.loungeMode = v.loungeMode;
  if (v.examTrack === "delf" || v.examTrack === "tcf" || v.examTrack === "tef") s.examTrack = v.examTrack;
  return s;
}
