import {
  MAX_DICT_FAVS,
  MAX_DICT_HISTORY,
  MAX_DICT_NOTES,
  MAX_DICT_REPORTS,
  MAX_TIP,
  store,
  useStore,
  type DictReport,
  type Progress,
} from "../../store/store";

export type { DictReport };

export interface DictStoreState {
  history: readonly string[];
  favs: readonly string[];
  notes: Readonly<Record<string, string>>;
  reports: readonly DictReport[];
}

export interface AddDictReportInput {
  entryId: string;
  w?: string;
  kind?: string;
  detail: string;
}

const EMPTY_LIST: readonly string[] = [];
const EMPTY_NOTES: Readonly<Record<string, string>> = {};
const EMPTY_REPORTS: readonly DictReport[] = [];

const cleanId = (id: string): string => {
  const s = id.trim();
  return !s || s.length > 120 || /[\u0000-\u001f]/.test(s) ? "" : s;
};

let cachedProg: Progress | null = null;
let cachedSlice: DictStoreState = {
  history: EMPTY_LIST,
  favs: EMPTY_LIST,
  notes: EMPTY_NOTES,
  reports: EMPTY_REPORTS,
};

function selectDictSlice(p: Progress): DictStoreState {
  const history = p.dictHistory ?? EMPTY_LIST;
  const favs = p.dictFavs ?? EMPTY_LIST;
  const notes = p.dictNotes ?? EMPTY_NOTES;
  const reports = p.dictReports ?? EMPTY_REPORTS;
  if (
    cachedProg === p ||
    (cachedSlice.history === history &&
      cachedSlice.favs === favs &&
      cachedSlice.notes === notes &&
      cachedSlice.reports === reports)
  ) {
    cachedProg = p;
    return cachedSlice;
  }
  cachedProg = p;
  cachedSlice = { history, favs, notes, reports };
  return cachedSlice;
}

/** Snapshot of dictionary history, favorites, notes, and error reports. */
export function getDictStore(): DictStoreState {
  return selectDictSlice(store.get().progress);
}

/** React hook subscribing to dictionary history, favorites, notes, and reports. */
export function useDictStore(): DictStoreState;
export function useDictStore<T>(select: (s: DictStoreState) => T): T;
export function useDictStore<T>(select?: (s: DictStoreState) => T): DictStoreState | T {
  return useStore((s) => {
    const slice = selectDictSlice(s.progress);
    return select ? select(slice) : slice;
  });
}

/** Record an entry id in dictionary lookup history (newest first, deduplicated, capped at 200). */
export function recordDictHistory(id: string): void {
  const clean = cleanId(id);
  if (!clean) return;
  store.progress((p) => {
    const prev = p.dictHistory ?? [];
    if (prev[0] === clean) return p;
    const dictHistory = [clean, ...prev.filter((x) => x !== clean)].slice(0, MAX_DICT_HISTORY);
    return { ...p, dictHistory };
  });
}

/** Clear all dictionary lookup history. */
export function clearDictHistory(): void {
  store.progress((p) => {
    if (!p.dictHistory?.length) return p;
    const { dictHistory: _h, ...rest } = p;
    void _h;
    return rest;
  });
}

/** Toggle a dictionary entry in favorites; returns the new favorited state. */
export function toggleDictFav(id: string): boolean {
  const clean = cleanId(id);
  if (!clean) return false;
  let nowFav = false;
  store.progress((p) => {
    const prev = p.dictFavs ?? [];
    if (prev.includes(clean)) {
      nowFav = false;
      const next = prev.filter((x) => x !== clean);
      if (!next.length) {
        const { dictFavs: _f, ...rest } = p;
        void _f;
        return rest;
      }
      return { ...p, dictFavs: next };
    }
    nowFav = true;
    return { ...p, dictFavs: [clean, ...prev].slice(0, MAX_DICT_FAVS) };
  });
  return nowFav;
}

/** Check whether an entry id is currently favorited. */
export function isDictFav(id: string): boolean {
  const clean = cleanId(id);
  if (!clean) return false;
  return (store.get().progress.dictFavs ?? []).includes(clean);
}

/** Set or clear (when blank) the learner's note on a dictionary entry. */
export function setDictNote(id: string, note: string): void {
  const clean = cleanId(id);
  if (!clean) return;
  const text = note.trim().slice(0, MAX_TIP);
  store.progress((p) => {
    const prev = p.dictNotes ?? {};
    if (!text) {
      if (!(clean in prev)) return p;
      const { [clean]: _drop, ...next } = prev;
      void _drop;
      if (!Object.keys(next).length) {
        const { dictNotes: _n, ...rest } = p;
        void _n;
        return rest;
      }
      return { ...p, dictNotes: next };
    }
    if (prev[clean] === text) return p;
    if (!(clean in prev) && Object.keys(prev).length >= MAX_DICT_NOTES) return p;
    return { ...p, dictNotes: { ...prev, [clean]: text } };
  });
}

/** Record an error report for a dictionary entry; returns null if entryId or detail is blank. */
export function addDictReport(input: AddDictReportInput): DictReport | null {
  const entryId = cleanId(input.entryId);
  const detail = input.detail.trim().slice(0, 500);
  if (!entryId || !detail) return null;
  const at = Date.now();
  const id = `dr-${at.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const report: DictReport = { id, entryId, detail, at };
  const w = input.w?.trim().slice(0, 120);
  if (w) report.w = w;
  const kind = input.kind?.trim().slice(0, 40);
  if (kind) report.kind = kind;
  store.progress((p) => {
    const prev = p.dictReports ?? [];
    return { ...p, dictReports: [report, ...prev].slice(0, MAX_DICT_REPORTS) };
  });
  return report;
}

/** Export stored dictionary error reports as a formatted JSON string. */
export function exportDictReportsJson(): string {
  const reports = store.get().progress.dictReports ?? [];
  return JSON.stringify(
    {
      app: "word-atlas",
      kind: "lexdb-reports",
      exported: new Date().toISOString(),
      count: reports.length,
      reports,
    },
    null,
    2,
  );
}
