import { MAX_MOCK_RECORDS, MAX_SPEAKING_SESSIONS, type WeeklyRemediationPlan } from "../lib/exam-schema";
import { MAX_ESSAYS, sanitizeEssays, type SavedEssay } from "../lib/essay-schema";
import type { BookProgressEntry, MediaProgressEntry, SavedLoungeClip } from "../lib/lounge-types";
import { MAX_TEXTS, sanitizeTexts, type SavedText } from "../lib/reader";
import {
  MAX_BOOK_PROGRESS,
  MAX_DICT_FAVS,
  MAX_DICT_HISTORY,
  MAX_DICT_NOTES,
  MAX_DICT_REPORTS,
  MAX_LOUNGE_CLIPS,
  MAX_LOUNGE_DAYS,
  MAX_MEDIA_PROGRESS,
  MAX_SPEAK_CORRECTIONS,
  sanitizeProgress,
  sanitizeTombstones,
  type Deck,
  type Progress,
  type Settings,
} from "../store/store";
import type { CardState } from "../store/srs";
import { MAX_BANK, sanitizeAttempts, sanitizePaper, type Attempt, type BankPaper } from "../store/exam-bank";
import { mergeAiSyncPayloads, parseAiSyncPayload } from "./ai-sync";
import { summarizeBackup } from "./decide";
import type { BackupSummary } from "./state";

const MAX_MISTAKES = 300;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function mergeCardState(a: CardState, b: CardState): CardState {
  const ta = Math.max(a.last ?? 0, a.seen ?? 0);
  const tb = Math.max(b.last ?? 0, b.seen ?? 0);
  if (ta !== tb) return ta > tb ? a : b;
  if (a.reps !== b.reps) return a.reps > b.reps ? a : b;
  if (a.due !== b.due) return a.due > b.due ? a : b;
  return b;
}

function mergeCardMap(
  a?: Record<string, CardState>,
  b?: Record<string, CardState>,
): Record<string, CardState> | undefined {
  if (!a && !b) return undefined;
  const out: Record<string, CardState> = { ...(a ?? {}) };
  for (const [k, card] of Object.entries(b ?? {})) {
    out[k] = out[k] ? mergeCardState(out[k], card) : card;
  }
  return out;
}

function mergeDayStats<T extends { n: number; r: number; c: number; t?: number; verbs?: string[] }>(
  a?: Record<string, T>,
  b?: Record<string, T>,
): Record<string, T> | undefined {
  if (!a && !b) return undefined;
  const out: Record<string, T> = { ...(a ?? {}) };
  for (const [k, s] of Object.entries(b ?? {})) {
    const prev = out[k];
    if (!prev) {
      out[k] = s;
    } else {
      const verbs = prev.verbs || s.verbs ? [...new Set([...(prev.verbs ?? []), ...(s.verbs ?? [])])] : undefined;
      const t = prev.t !== undefined || s.t !== undefined ? Math.max(prev.t ?? 0, s.t ?? 0) : undefined;
      out[k] = {
        ...prev,
        n: Math.max(prev.n, s.n),
        r: Math.max(prev.r, s.r),
        c: Math.max(prev.c, s.c),
        ...(t !== undefined ? { t } : {}),
        ...(verbs ? { verbs } : {}),
      };
    }
  }
  return out;
}

function mergeNumberMap(
  a?: Record<string, number>,
  b?: Record<string, number>,
): Record<string, number> | undefined {
  if (!a && !b) return undefined;
  const out: Record<string, number> = { ...(a ?? {}) };
  for (const [k, v] of Object.entries(b ?? {})) {
    out[k] = Math.max(out[k] ?? 0, v);
  }
  return out;
}

function mergeStringUnion(a?: readonly string[], b?: readonly string[], max?: number): string[] | undefined {
  if (!a && !b) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of [...(a ?? []), ...(b ?? [])]) {
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
    if (max && out.length >= max) break;
  }
  return out;
}

function mergeIdItems<T extends { id: string }>(
  a: readonly T[] | undefined,
  b: readonly T[] | undefined,
  sortScore: (x: T) => number,
  pickCollision?: (x: T, y: T) => T,
  max?: number,
): T[] | undefined {
  if (!a && !b) return undefined;
  const map = new Map<string, T>();
  for (const x of [...(a ?? []), ...(b ?? [])]) {
    const prev = map.get(x.id);
    if (!prev) {
      map.set(x.id, x);
    } else if (pickCollision) {
      map.set(x.id, pickCollision(prev, x));
    } else {
      map.set(x.id, sortScore(x) >= sortScore(prev) ? x : prev);
    }
  }
  const out = [...map.values()].sort((x, y) => sortScore(y) - sortScore(x));
  return max ? out.slice(0, max) : out;
}

function mergeEssayCollision(a: SavedEssay, b: SavedEssay): SavedEssay {
  const ta = Math.max(a.rev?.at ?? 0, a.created);
  const tb = Math.max(b.rev?.at ?? 0, b.created);
  const winner = tb >= ta ? b : a;
  const other = tb >= ta ? a : b;
  return {
    ...winner,
    fb: winner.fb ?? other.fb,
    rev: winner.rev ?? other.rev,
    model: winner.model ?? other.model,
  };
}

function mergeDecks(a?: readonly Deck[], b?: readonly Deck[]): Deck[] | undefined {
  if (!a && !b) return undefined;
  const map = new Map<string, Deck>();
  for (const d of [...(a ?? []), ...(b ?? [])]) {
    const prev = map.get(d.id);
    if (!prev) {
      map.set(d.id, d);
    } else {
      const words = mergeStringUnion(prev.words, d.words) ?? [];
      const sense = prev.sense || d.sense ? { ...(prev.sense ?? {}), ...(d.sense ?? {}) } : undefined;
      const note = prev.note || d.note ? { ...(prev.note ?? {}), ...(d.note ?? {}) } : undefined;
      map.set(d.id, {
        ...prev,
        ...d,
        words,
        ...(sense ? { sense } : {}),
        ...(note ? { note } : {}),
      });
    }
  }
  return [...map.values()];
}

function dedupeByKey<T>(items: readonly T[], keyOf: (x: T) => string, sortBy: (x: T) => number, max?: number): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of [...items].sort((a, b) => sortBy(b) - sortBy(a))) {
    const k = keyOf(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
    if (max && out.length >= max) break;
  }
  return out;
}

function pickNewerTextMap(
  a?: Record<string, string>,
  b?: Record<string, string>,
  aAt?: Record<string, number>,
  bAt?: Record<string, number>,
  tombstones?: Record<string, number>,
  tombPrefix?: string,
): Record<string, string> | undefined {
  const keys = new Set([
    ...Object.keys(a ?? {}),
    ...Object.keys(b ?? {}),
    ...Object.keys(aAt ?? {}),
    ...Object.keys(bAt ?? {}),
  ]);
  if (!keys.size) return undefined;
  const out: Record<string, string> = {};
  for (const k of keys) {
    const va = a?.[k];
    const vb = b?.[k];
    const ta = aAt?.[k] ?? 0;
    const tb = bAt?.[k] ?? 0;
    const td = tombPrefix ? (tombstones?.[`${tombPrefix}${k}`] ?? 0) : 0;
    if (td > 0 && td >= Math.max(ta, tb)) continue;
    if (va !== undefined && vb === undefined) {
      if (tb > ta) continue;
      out[k] = va;
    } else if (vb !== undefined && va === undefined) {
      if (ta > tb) continue;
      out[k] = vb;
    } else if (va !== undefined && vb !== undefined) {
      if (ta !== tb) out[k] = tb > ta ? vb : va;
      else out[k] = vb.trim().length > va.trim().length ? vb : va;
    }
  }
  return out;
}

function mergeTimestampMap(
  a?: Record<string, number>,
  b?: Record<string, number>,
  max?: number,
): Record<string, number> | undefined {
  if (!a && !b) return undefined;
  const out: Record<string, number> = {};
  for (const k of new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])) {
    const va = typeof a?.[k] === "number" && Number.isFinite(a[k]) ? a[k] : 0;
    const vb = typeof b?.[k] === "number" && Number.isFinite(b[k]) ? b[k] : 0;
    const best = Math.max(va, vb);
    if (best > 0) out[k] = best;
  }
  const entries = max
    ? Object.entries(out).sort((x, y) => y[1] - x[1]).slice(0, max)
    : Object.entries(out);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function mergeTombstones(
  a?: Record<string, number>,
  b?: Record<string, number>,
): Record<string, number> | undefined {
  if (!a && !b) return undefined;
  const combined: Record<string, number> = { ...(a ?? {}) };
  for (const [k, v] of Object.entries(b ?? {})) {
    combined[k] = Math.max(combined[k] ?? 0, v);
  }
  return sanitizeTombstones(combined);
}

function keptAfterTombstone(tombstones: Record<string, number> | undefined, key: string, itemAt: number): boolean {
  const td = tombstones?.[key];
  return !(typeof td === "number" && td > itemAt);
}

function mergeWeeklyPlan(a?: WeeklyRemediationPlan, b?: WeeklyRemediationPlan): WeeklyRemediationPlan | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a.id !== b.id) return b.createdAt >= a.createdAt ? b : a;
  const otherById = new Map(a.tasks.map((t) => [t.id, t]));
  const tasks = b.tasks.map((t) => {
    const prev = otherById.get(t.id);
    const doneAt = Math.max(t.doneAt ?? 0, prev?.doneAt ?? 0);
    return doneAt > 0 ? { ...t, doneAt } : t;
  });
  return { ...(b.createdAt >= a.createdAt ? b : a), tasks };
}

function mergeBookProgress(
  a?: Record<string, BookProgressEntry>,
  b?: Record<string, BookProgressEntry>,
): Record<string, BookProgressEntry> | undefined {
  if (!a && !b) return undefined;
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  if (!keys.size) return undefined;
  const entries: [string, BookProgressEntry][] = [];
  for (const k of keys) {
    const ea = a?.[k];
    const eb = b?.[k];
    if (ea && !eb) {
      entries.push([k, ea]);
    } else if (eb && !ea) {
      entries.push([k, eb]);
    } else if (ea && eb) {
      const winner = eb.updatedAt >= ea.updatedAt ? eb : ea;
      const other = eb.updatedAt >= ea.updatedAt ? ea : eb;
      const done = Math.max(ea.done ?? 0, eb.done ?? 0);
      const title = winner.title ?? other.title;
      const merged: BookProgressEntry = {
        ch: winner.ch,
        para: winner.para,
        ratio: winner.ratio,
        updatedAt: winner.updatedAt,
        ...(done > 0 ? { done } : {}),
        ...(title ? { title } : {}),
      };
      entries.push([k, merged]);
    }
  }
  entries.sort((x, y) => y[1].updatedAt - x[1].updatedAt);
  return entries.length ? Object.fromEntries(entries.slice(0, MAX_BOOK_PROGRESS)) : undefined;
}

function mergeMediaProgress(
  a?: Record<string, MediaProgressEntry>,
  b?: Record<string, MediaProgressEntry>,
): Record<string, MediaProgressEntry> | undefined {
  if (!a && !b) return undefined;
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  if (!keys.size) return undefined;
  const entries: [string, MediaProgressEntry][] = [];
  for (const k of keys) {
    const ea = a?.[k];
    const eb = b?.[k];
    if (ea && !eb) {
      entries.push([k, ea]);
    } else if (eb && !ea) {
      entries.push([k, eb]);
    } else if (ea && eb) {
      const winner = eb.updatedAt >= ea.updatedAt ? eb : ea;
      const other = eb.updatedAt >= ea.updatedAt ? ea : eb;
      const done = Math.max(ea.done ?? 0, eb.done ?? 0);
      const dur = winner.dur ?? other.dur;
      const title = winner.title ?? other.title;
      const shelf = winner.shelf ?? other.shelf;
      const merged: MediaProgressEntry = {
        pos: winner.pos,
        updatedAt: winner.updatedAt,
        ...(dur !== undefined ? { dur } : {}),
        ...(done > 0 ? { done } : {}),
        ...(title ? { title } : {}),
        ...(shelf ? { shelf } : {}),
      };
      entries.push([k, merged]);
    }
  }
  entries.sort((x, y) => y[1].updatedAt - x[1].updatedAt);
  return entries.length ? Object.fromEntries(entries.slice(0, MAX_MEDIA_PROGRESS)) : undefined;
}

function isoTime(s: unknown): number {
  if (typeof s !== "string" || !s) return 0;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

/** Merge two validated v2 backups field-by-field so learning records from both devices survive. */
export function mergeBackups(
  localJson: string,
  remoteJson: string,
): { ok: true; json: string; summary: BackupSummary } | { ok: false; error: string } {
  let rawLocal: unknown;
  let rawRemote: unknown;
  try {
    rawLocal = JSON.parse(localJson);
    rawRemote = JSON.parse(remoteJson);
  } catch {
    return { ok: false, error: "备份格式不是有效 JSON" };
  }

  if (
    !isObj(rawLocal) ||
    rawLocal.app !== "word-atlas" ||
    rawLocal.version !== 2 ||
    !isObj(rawLocal.progress) ||
    !isObj(rawRemote) ||
    rawRemote.app !== "word-atlas" ||
    rawRemote.version !== 2 ||
    !isObj(rawRemote.progress)
  ) {
    return { ok: false, error: "备份格式不兼容，无法自动合并" };
  }

  const datasetId = typeof rawLocal.progress.datasetId === "string" ? rawLocal.progress.datasetId : "";
  if (!datasetId || rawRemote.progress.datasetId !== datasetId) {
    return { ok: false, error: "两份备份属于不同词库，无法合并" };
  }

  const lp: Progress = sanitizeProgress({ ...rawLocal.progress, session: null }, datasetId);
  const rp: Progress = sanitizeProgress({ ...rawRemote.progress, session: null }, datasetId);

  const lTexts = sanitizeTexts(rawLocal.progress.texts) ?? lp.texts;
  const rTexts = sanitizeTexts(rawRemote.progress.texts) ?? rp.texts;
  const lEssays = sanitizeEssays(rawLocal.progress.essays) ?? lp.essays;
  const rEssays = sanitizeEssays(rawRemote.progress.essays) ?? rp.essays;

  const gramTags =
    lp.gramTags || rp.gramTags
      ? (() => {
          const out: Record<string, { n: number; w: number }> = { ...(lp.gramTags ?? {}) };
          for (const [k, v] of Object.entries(rp.gramTags ?? {})) {
            const prev = out[k];
            out[k] = prev ? { n: Math.max(prev.n, v.n), w: Math.max(prev.w, v.w) } : v;
          }
          return out;
        })()
      : undefined;

  const tombstones = mergeTombstones(lp.tombstones, rp.tombstones);
  const mergedDictNotesAt = mergeTimestampMap(lp.dictNotesAt, rp.dictNotesAt, MAX_DICT_NOTES);
  const mergedDictNotes = pickNewerTextMap(
    lp.dictNotes,
    rp.dictNotes,
    lp.dictNotesAt,
    rp.dictNotesAt,
    tombstones,
    "dictNote:",
  );
  const mergedBookmarks = (mergeStringUnion(lp.bookmarks, rp.bookmarks) ?? []).filter((id) =>
    keptAfterTombstone(tombstones, `bookmark:${id}`, -1),
  );
  const mergedCustom =
    lp.custom || rp.custom
      ? Object.fromEntries(
          Object.entries({ ...(rp.custom ?? {}), ...(lp.custom ?? {}) }).filter(([id, w]) =>
            keptAfterTombstone(tombstones, `custom:${id}`, w.created),
          ),
        )
      : undefined;
  const mergedDecks = mergeDecks(lp.decks, rp.decks)?.filter((d) =>
    keptAfterTombstone(tombstones, `deck:${d.id}`, d.created),
  );
  const mergedTexts = mergeIdItems<SavedText>(
    lTexts,
    rTexts,
    (t) => Math.max(t.read ?? 0, t.created),
    (a, b) => (Math.max(b.read ?? 0, b.created) >= Math.max(a.read ?? 0, a.created) ? b : a),
    MAX_TEXTS,
  )?.filter((t) => keptAfterTombstone(tombstones, `text:${t.id}`, Math.max(t.read ?? 0, t.created)));
  const mergedEssays = mergeIdItems<SavedEssay>(
    lEssays,
    rEssays,
    (e) => Math.max(e.rev?.at ?? 0, e.created),
    mergeEssayCollision,
    MAX_ESSAYS,
  )?.filter((e) => keptAfterTombstone(tombstones, `essay:${e.id}`, Math.max(e.rev?.at ?? 0, e.created)));
  const mergedEssayTasks = mergeIdItems(lp.essayTasks, rp.essayTasks, () => 0, undefined, 20)?.filter((t) =>
    keptAfterTombstone(tombstones, `task:${t.id}`, -1),
  );
  const mergedEssayNotes = mergeIdItems(lp.essayNotes, rp.essayNotes, (n) => n.at, undefined, 200)?.filter((n) =>
    keptAfterTombstone(tombstones, `note:${n.id}`, n.at),
  );
  const mergedListenSources = mergeIdItems(
    lp.listenSources,
    rp.listenSources,
    (s) => Math.max(s.done ?? 0, s.created),
    undefined,
    40,
  )?.filter((s) => keptAfterTombstone(tombstones, `source:${s.id}`, Math.max(s.done ?? 0, s.created)));
  const mergedDictFavs = mergeStringUnion(lp.dictFavs, rp.dictFavs, MAX_DICT_FAVS)?.filter((id) =>
    keptAfterTombstone(tombstones, `fav:${id}`, -1),
  );

  const mergedProgress: Progress = {
    version: 2,
    datasetId,
    ...(lp.coreMigrated || rp.coreMigrated ? { coreMigrated: true } : {}),
    cards: mergeCardMap(lp.cards, rp.cards) ?? {},
    bookmarks: mergedBookmarks,
    days: mergeDayStats(lp.days, rp.days) ?? {},
    typing: dedupeByKey(
      [...lp.typing, ...rp.typing],
      (x) => `${x.at}|${x.mode}|${x.items}`,
      (x) => x.at,
      500,
    ),
    session: null,
    mistakes: mergeStringUnion(lp.mistakes, rp.mistakes, MAX_MISTAKES) ?? [],
    ...(lp.aliasArchive || rp.aliasArchive ? { aliasArchive: mergeCardMap(lp.aliasArchive, rp.aliasArchive) } : {}),
    ...(lp.aliasMigratedAt || rp.aliasMigratedAt
      ? { aliasMigratedAt: Math.max(lp.aliasMigratedAt ?? 0, rp.aliasMigratedAt ?? 0) }
      : {}),
    ...(lp.conj || rp.conj ? { conj: mergeCardMap(lp.conj, rp.conj) } : {}),
    ...(lp.conjDays || rp.conjDays ? { conjDays: mergeDayStats(lp.conjDays, rp.conjDays) } : {}),
    ...(lp.gram || rp.gram ? { gram: mergeCardMap(lp.gram, rp.gram) } : {}),
    ...(lp.gramDays || rp.gramDays ? { gramDays: mergeDayStats(lp.gramDays, rp.gramDays) } : {}),
    ...(lp.gramSkip || rp.gramSkip ? { gramSkip: mergeStringUnion(lp.gramSkip, rp.gramSkip) } : {}),
    ...(gramTags ? { gramTags } : {}),
    ...(lp.expr || rp.expr ? { expr: mergeCardMap(lp.expr, rp.expr) } : {}),
    ...(mergedDecks?.length ? { decks: mergedDecks } : {}),
    ...(lp.hidden || rp.hidden ? { hidden: mergeStringUnion(lp.hidden, rp.hidden) } : {}),
    ...(mergedCustom && Object.keys(mergedCustom).length ? { custom: mergedCustom } : {}),
    ...(lp.edits || rp.edits ? { edits: { ...(rp.edits ?? {}), ...(lp.edits ?? {}) } } : {}),
    ...(mergedTexts?.length ? { texts: mergedTexts } : {}),
    ...(mergedEssays?.length ? { essays: mergedEssays } : {}),
    ...(mergedEssayTasks?.length ? { essayTasks: mergedEssayTasks } : {}),
    ...(mergedEssayNotes?.length ? { essayNotes: mergedEssayNotes } : {}),
    ...(lp.noteCards || rp.noteCards ? { noteCards: mergeCardMap(lp.noteCards, rp.noteCards) } : {}),
    ...(lp.examLog || rp.examLog
      ? {
          examLog: dedupeByKey(
            [...(lp.examLog ?? []), ...(rp.examLog ?? [])],
            (x) => `${x.at}|${x.part}|${x.score}|${x.total}`,
            (x) => x.at,
            80,
          ),
        }
      : {}),
    ...(lp.compMisses || rp.compMisses
      ? {
          compMisses: dedupeByKey(
            [...(lp.compMisses ?? []), ...(rp.compMisses ?? [])],
            (x) => `${x.part}|${x.at}|${x.cause}|${x.q ?? ""}`,
            (x) => x.at,
            400,
          ),
        }
      : {}),
    ...(mergedListenSources?.length ? { listenSources: mergedListenSources } : {}),
    ...(lp.drillDays || rp.drillDays ? { drillDays: mergeNumberMap(lp.drillDays, rp.drillDays) } : {}),
    ...(lp.placement || rp.placement
      ? {
          placement:
            (lp.placement?.at ?? 0) >= (rp.placement?.at ?? 0) ? (lp.placement ?? rp.placement) : rp.placement,
        }
      : {}),
    ...(lp.speakCorrections || rp.speakCorrections
      ? {
          speakCorrections: mergeIdItems(
            lp.speakCorrections,
            rp.speakCorrections,
            (s) => s.at,
            undefined,
            MAX_SPEAK_CORRECTIONS,
          ),
        }
      : {}),
    ...(lp.dictHistory || rp.dictHistory
      ? { dictHistory: mergeStringUnion(lp.dictHistory, rp.dictHistory, MAX_DICT_HISTORY) }
      : {}),
    ...(mergedDictFavs?.length ? { dictFavs: mergedDictFavs } : {}),
    ...(mergedDictNotes && Object.keys(mergedDictNotes).length ? { dictNotes: mergedDictNotes } : {}),
    ...(mergedDictNotesAt ? { dictNotesAt: mergedDictNotesAt } : {}),
    ...(tombstones ? { tombstones } : {}),
    ...(lp.dictReports || rp.dictReports
      ? { dictReports: mergeIdItems(lp.dictReports, rp.dictReports, (r) => r.at, undefined, MAX_DICT_REPORTS) }
      : {}),
    ...(lp.speakingSessions || rp.speakingSessions
      ? {
          speakingSessions: mergeIdItems(lp.speakingSessions, rp.speakingSessions, (s) => s.at, undefined, MAX_SPEAKING_SESSIONS)?.filter((s) =>
            keptAfterTombstone(tombstones, `speakSess:${s.id}`, s.at),
          ),
        }
      : {}),
    ...(lp.mockRecords || rp.mockRecords
      ? {
          mockRecords: mergeIdItems(lp.mockRecords, rp.mockRecords, (m) => m.at, undefined, MAX_MOCK_RECORDS)?.filter((m) =>
            keptAfterTombstone(tombstones, `mock:${m.id}`, m.at),
          ),
        }
      : {}),
    ...(() => {
      const weeklyPlan = mergeWeeklyPlan(lp.weeklyPlan, rp.weeklyPlan);
      return weeklyPlan ? { weeklyPlan } : {};
    })(),
    ...(() => {
      const suspendedLeeches = mergeStringUnion(lp.suspendedLeeches, rp.suspendedLeeches, 2000);
      return suspendedLeeches?.length ? { suspendedLeeches } : {};
    })(),
    ...(() => {
      const bookProgress = mergeBookProgress(lp.bookProgress, rp.bookProgress);
      return bookProgress ? { bookProgress } : {};
    })(),
    ...(() => {
      const mediaProgress = mergeMediaProgress(lp.mediaProgress, rp.mediaProgress);
      return mediaProgress ? { mediaProgress } : {};
    })(),
    ...(() => {
      const rawLoungeDays = mergeNumberMap(lp.loungeDays, rp.loungeDays);
      if (!rawLoungeDays) return {};
      const entries = Object.entries(rawLoungeDays)
        .sort((x, y) => y[0].localeCompare(x[0]))
        .slice(0, MAX_LOUNGE_DAYS);
      return entries.length ? { loungeDays: Object.fromEntries(entries) } : {};
    })(),
    ...(() => {
      const clips = mergeIdItems<SavedLoungeClip>(lp.loungeClips, rp.loungeClips, (c) => c.created)
        ?.filter((c) => keptAfterTombstone(tombstones, `loungeClip:${c.id}`, c.created))
        .slice(0, MAX_LOUNGE_CLIPS);
      return clips?.length ? { loungeClips: clips } : {};
    })(),
  };

  const lt = isoTime(rawLocal.exported);
  const rt = isoTime(rawRemote.exported);
  const settingsRaw = rt > lt && isObj(rawRemote.settings) ? rawRemote.settings : isObj(rawLocal.settings) ? rawLocal.settings : rawRemote.settings;
  const mergedSettings = isObj(settingsRaw)
    ? ({ ...settingsRaw, onboarded: Boolean(settingsRaw.onboarded || (isObj(rawLocal.settings) && rawLocal.settings.onboarded) || (isObj(rawRemote.settings) && rawRemote.settings.onboarded)) } as Settings)
    : undefined;

  const images =
    isObj(rawLocal.images) || isObj(rawRemote.images)
      ? {
          ...(isObj(rawRemote.images) ? (rawRemote.images as Record<string, string>) : {}),
          ...(isObj(rawLocal.images) ? (rawLocal.images as Record<string, string>) : {}),
        }
      : undefined;

  const localDraftsAt = isObj(rawLocal.essayDraftsAt) ? (rawLocal.essayDraftsAt as Record<string, number>) : undefined;
  const remoteDraftsAt = isObj(rawRemote.essayDraftsAt) ? (rawRemote.essayDraftsAt as Record<string, number>) : undefined;
  const essayDrafts = pickNewerTextMap(
    isObj(rawLocal.essayDrafts) ? (rawLocal.essayDrafts as Record<string, string>) : undefined,
    isObj(rawRemote.essayDrafts) ? (rawRemote.essayDrafts as Record<string, string>) : undefined,
    localDraftsAt,
    remoteDraftsAt,
    tombstones,
    "draft:",
  );
  const essayDraftsAt = mergeTimestampMap(localDraftsAt, remoteDraftsAt);

  let examBank: { papers: BankPaper[]; attempts: Record<string, Attempt[]> } | undefined;
  if (isObj(rawLocal.examBank) || isObj(rawRemote.examBank)) {
    const lb = isObj(rawLocal.examBank) ? rawLocal.examBank : {};
    const rb = isObj(rawRemote.examBank) ? rawRemote.examBank : {};
    const lPapers = Array.isArray(lb.papers) ? lb.papers.map(sanitizePaper).filter((p): p is BankPaper => !!p) : [];
    const rPapers = Array.isArray(rb.papers) ? rb.papers.map(sanitizePaper).filter((p): p is BankPaper => !!p) : [];
    const papers = mergeIdItems(lPapers, rPapers, (p) => p.created, undefined, MAX_BANK) ?? [];
    const attempts: Record<string, Attempt[]> = {};
    const lAtt = isObj(lb.attempts) ? (lb.attempts as Record<string, unknown>) : {};
    const rAtt = isObj(rb.attempts) ? (rb.attempts as Record<string, unknown>) : {};
    for (const k of new Set([...Object.keys(lAtt), ...Object.keys(rAtt)])) {
      const merged = dedupeByKey(
        [...sanitizeAttempts(lAtt[k]), ...sanitizeAttempts(rAtt[k])],
        (a) => `${a.at}|${a.score}|${a.total}`,
        (a) => a.at,
        20,
      );
      if (merged.length) attempts[k] = merged;
    }
    if (papers.length || Object.keys(attempts).length) {
      examBank = { papers, attempts };
    }
  }

  // AI settings: policy by policyRev, config by configRev, keys slot by slot. A side whose aiConfig is missing or not
  // understood contributes nothing (the caller strips aiConfig from untrusted plaintext before merging).
  const aiConfig = mergeAiSyncPayloads(parseAiSyncPayload(rawLocal.aiConfig), parseAiSyncPayload(rawRemote.aiConfig));

  const out = {
    app: "word-atlas",
    version: 2,
    exported: new Date().toISOString(),
    progress: mergedProgress,
    ...(mergedSettings ? { settings: mergedSettings } : {}),
    ...(images && Object.keys(images).length ? { images } : {}),
    ...(essayDrafts && Object.keys(essayDrafts).length ? { essayDrafts } : {}),
    ...(essayDraftsAt && Object.keys(essayDraftsAt).length ? { essayDraftsAt } : {}),
    ...(examBank ? { examBank } : {}),
    ...(aiConfig ? { aiConfig } : {}),
  };

  const json = JSON.stringify(out, null, 1);
  return { ok: true, json, summary: summarizeBackup(json) };
}
