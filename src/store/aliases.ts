/**
 * Alias migration: a duplicate word id (alias) is pointed at its primary entry.
 * Rules (chosen so that no learning history is added up or silently discarded):
 *  - only alias record        → moved to the primary id
 *  - only primary record      → unchanged
 *  - both records             → the primary record is kept as it is; the alias record is archived
 *                               in progress.aliasArchive (recoverable), NOT merged: reps are not added,
 *                               stability is not raised to the higher of the two
 *  - bookmarks, mistakes, unfinished session steps are re-pointed to the primary id (de-duplicated)
 *  - running it again changes nothing (idempotent): no alias ids are left to move
 */
import type { CardState } from "./srs";
import type { ActiveSession, Progress } from "./store";

export type AliasMap = Record<string, string>;
export interface AliasReport {
  moved: string[];
  conflicts: { alias: string; primary: string }[];
  bookmarksRepointed: number;
  mistakesRepointed: number;
  changed: boolean;
}

/** Follow alias → primary links (a few hops at most; a cycle stops at the current id). */
export function resolveAlias(id: string, aliases: AliasMap): string {
  let cur = id;
  for (let i = 0; i < 5 && aliases[cur]; i++) cur = aliases[cur];
  return cur;
}

const uniq = <T,>(xs: T[]) => [...new Set(xs)];

export function migrateAliases(p: Progress, aliases: AliasMap): { progress: Progress; report: AliasReport } {
  const report: AliasReport = { moved: [], conflicts: [], bookmarksRepointed: 0, mistakesRepointed: 0, changed: false };
  const map = (id: string) => resolveAlias(id, aliases);
  const cards: Record<string, CardState> = { ...p.cards };
  const archive: Record<string, CardState> = { ...(p.aliasArchive ?? {}) };
  for (const alias of Object.keys(aliases)) {
    const primary = map(alias);
    if (primary === alias) continue;
    const card = cards[alias];
    if (card) {
      if (!cards[primary]) {
        cards[primary] = card;
        report.moved.push(`${alias}→${primary}`);
      } else {
        archive[alias] = card; // both sides have a record: keep the primary, archive the alias untouched
        report.conflicts.push({ alias, primary });
      }
      delete cards[alias];
      report.changed = true;
    }
  }
  const bookmarks = uniq(p.bookmarks.map(map));
  report.bookmarksRepointed = p.bookmarks.filter((x) => map(x) !== x).length;
  const mistakes = uniq(p.mistakes.map(map));
  report.mistakesRepointed = p.mistakes.filter((x) => map(x) !== x).length;
  let session: ActiveSession | null = p.session;
  if (session) {
    const graded: Record<string, ActiveSession["graded"][string]> = { ...session.graded };
    for (const k of Object.keys(session.graded)) {
      const n = map(k);
      if (n !== k) {
        if (!(n in graded)) graded[n] = graded[k];
        delete graded[k];
      }
    }
    session = {
      ...session,
      steps: session.steps.map((st) => (map(st.id) === st.id ? st : { ...st, id: map(st.id) })),
      graded,
      newIds: uniq(session.newIds.map(map)),
      reviewIds: uniq(session.reviewIds.map(map)),
    };
  }
  // decks and the initial deck's hidden list follow their words to the primary id, like the cards
  const remapKeys = <T,>(rec: Record<string, T> | undefined) => {
    if (!rec) return rec;
    const outRec: Record<string, T> = {};
    for (const [k, v] of Object.entries(rec)) if (!(map(k) in outRec) || map(k) === k) outRec[map(k)] = v;
    return outRec;
  };
  const decks = p.decks?.map((d) => ({
    ...d,
    words: uniq(d.words.map(map)),
    ...(d.sense ? { sense: remapKeys(d.sense) } : {}),
    ...(d.note ? { note: remapKeys(d.note) } : {}),
  }));
  const hidden = p.hidden ? uniq(p.hidden.map(map)) : undefined;
  const edits = remapKeys(p.edits);
  const changedLists =
    bookmarks.join() !== p.bookmarks.join() ||
    mistakes.join() !== p.mistakes.join() ||
    (session !== p.session && JSON.stringify(session) !== JSON.stringify(p.session)) ||
    JSON.stringify(decks) !== JSON.stringify(p.decks) ||
    (hidden ?? []).join() !== (p.hidden ?? []).join() ||
    JSON.stringify(edits) !== JSON.stringify(p.edits);
  report.changed = report.changed || changedLists;
  if (!report.changed) return { progress: p, report };
  const next: Progress = {
    ...p,
    cards,
    bookmarks,
    mistakes,
    session,
    ...(decks ? { decks } : {}),
    ...(hidden ? { hidden } : {}),
    ...(edits ? { edits } : {}),
    aliasArchive: Object.keys(archive).length ? archive : p.aliasArchive,
    aliasMigratedAt: Date.now(),
  };
  return { progress: next, report };
}
