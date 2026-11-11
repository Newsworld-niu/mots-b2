import { useSyncExternalStore } from "react";
import type { CardState, Grade } from "./srs";

export type QuizKind = "meaning" | "cloze" | "listen" | "spell";
export type Step = { id: string; kind: "intro" } | { id: string; kind: QuizKind; retry?: boolean; options?: string[] };

export interface ActiveSession {
  id: string;
  started: number;
  steps: Step[];
  index: number;
  /** First-attempt grade per word; retries never change it. */
  graded: Record<string, Grade>;
  newIds: string[];
  reviewIds: string[];
  /** Answer shown but not yet continued; survives reload without double counting. */
  pending?: { correct: boolean; value: string };
  finished?: number;
}

export interface DayStat {
  n: number; // new words met
  r: number; // graded first attempts
  c: number; // correct first attempts
  t: number; // active seconds
}

export interface TypingRound {
  at: number;
  mode: "dictee" | "traduction";
  items: number;
  wpm: number;
  accuracy: number;
}

export interface Progress {
  version: 1;
  cards: Record<string, CardState>;
  bookmarks: string[];
  days: Record<string, DayStat>;
  typing: TypingRound[];
  session: ActiveSession | null;
  /** Recent mistakes, newest first. */
  mistakes: string[];
}

export interface Settings {
  dailyNew: number;
  retention: number;
  /** Speech rate for the French voice, 0.6–1.2. */
  rate: number;
  autoplay: boolean;
  spell: boolean;
  theme: "system" | "light" | "dark";
}

export const defaultSettings: Settings = {
  dailyNew: 8,
  retention: 0.9,
  rate: 0.9,
  autoplay: true,
  spell: true,
  theme: "dark",
};

export const emptyProgress = (): Progress => ({
  version: 1,
  cards: {},
  bookmarks: [],
  days: {},
  typing: [],
  session: null,
  mistakes: [],
});

interface State {
  progress: Progress;
  settings: Settings;
}

const KEY = "mots-b2:v1";

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>;
      if (parsed.progress?.version === 1) {
        return { progress: { ...emptyProgress(), ...parsed.progress }, settings: { ...defaultSettings, ...parsed.settings } };
      }
    }
  } catch {
    /* corrupt storage: start fresh rather than crash */
  }
  return { progress: emptyProgress(), settings: defaultSettings };
}

let state: State = load();
const listeners = new Set<() => void>();

function commit(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota or private mode: keep the in-memory state */
  }
  listeners.forEach((l) => l());
}

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Add to today's counters; `n`, `r`, `c` count, `t` adds seconds. */
export function bumpDay(p: Progress, d: Partial<DayStat>, now = new Date()): Progress {
  const k = dayKey(now);
  const cur = p.days[k] ?? { n: 0, r: 0, c: 0, t: 0 };
  return {
    ...p,
    days: {
      ...p.days,
      [k]: { n: cur.n + (d.n ?? 0), r: cur.r + (d.r ?? 0), c: cur.c + (d.c ?? 0), t: cur.t + (d.t ?? 0) },
    },
  };
}

export const store = {
  get: () => state,
  progress(fn: (p: Progress) => Progress) {
    commit({ ...state, progress: fn(state.progress) });
  },
  settings(patch: Partial<Settings>) {
    commit({ ...state, settings: { ...state.settings, ...patch } });
  },
  /** Replace all data after validating the shape; used by "import backup". */
  replace(raw: unknown): boolean {
    const r = raw as Partial<State> | null;
    if (!r || typeof r !== "object" || !r.progress || r.progress.version !== 1 || typeof r.progress.cards !== "object") return false;
    commit({ progress: { ...emptyProgress(), ...r.progress }, settings: { ...defaultSettings, ...r.settings } });
    return true;
  },
  reset() {
    commit({ progress: emptyProgress(), settings: state.settings });
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => select(state),
    () => select(state),
  );
}

export function toggleBookmark(id: string) {
  store.progress((p) => ({
    ...p,
    bookmarks: p.bookmarks.includes(id) ? p.bookmarks.filter((x) => x !== id) : [id, ...p.bookmarks],
  }));
}
