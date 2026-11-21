/**
 * 题库: every paper of 听力理解 / 应试阅读 the AI wrote, kept on this device in IndexedDB (papers are long, and
 * localStorage is small), with each attempt, so a good paper can be done again and its wrong questions redone.
 * The papers that come with the app (预置题) are not stored; only their attempts are.
 */
import { useSyncExternalStore } from "react";
import { sanitizeExercise, type CompExercise, type CompKind } from "../lib/exam";

export interface Attempt {
  at: number;
  /** Chosen option by question key "exercise-question". */
  picked: Record<string, number>;
  score: number;
  total: number;
  /** The question keys asked, when only the ones missed last time were (错题重做). */
  asked?: string[];
}

export interface BankPaper {
  id: string;
  kind: CompKind;
  level: "B1" | "B2";
  created: number;
  /** ai: written by the AI for this learner; preset: comes with the app. */
  src: "ai" | "preset";
  /** Listening: how the people speak. */
  style?: "radio" | "natural";
  exs: CompExercise[];
  starred?: boolean;
}

export const MAX_BANK = 120;

const DB = "fb2-exam-bank";
const PAPERS = "papers";
const ATTEMPTS = "attempts";

let db: Promise<IDBDatabase | null> | null = null;
function open() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  db ??= new Promise((resolve) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(PAPERS, { keyPath: "id" });
      req.result.createObjectStore(ATTEMPTS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  return db;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return open().then(
    (d) =>
      new Promise((resolve) => {
        if (!d) return resolve(null);
        const req = fn(d.transaction(store, mode).objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      }),
  );
}

/** A stored paper, checked again (IndexedDB data is not trusted any more than a backup). */
export function sanitizePaper(v: unknown): BankPaper | null {
  if (!v || typeof v !== "object") return null;
  const p = v as Record<string, unknown>;
  if (typeof p.id !== "string" || (p.kind !== "listen" && p.kind !== "read") || typeof p.created !== "number" || !Array.isArray(p.exs)) return null;
  const exs = p.exs
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object" && (e.form === "long" || e.form === "short" || e.form === "opinions"))
    .map((e) => {
      const ex = sanitizeExercise({ ...e, questions: (Array.isArray(e.questions) ? e.questions : []).map((q: Record<string, unknown>) => ({ ...q, difficulty: 3 })) }, e.form as CompExercise["form"], typeof e.topic === "string" ? e.topic : "");
      // keep the stored points: they were set by difficulty when the exercise was made
      const raw = e.questions as { pts?: unknown; q?: unknown }[];
      ex.questions = ex.questions.map((q) => {
        const pts = raw.find((r) => r.q === q.q)?.pts;
        return typeof pts === "number" && pts > 0 && pts <= 3 ? { ...q, pts } : q;
      });
      return ex;
    })
    .filter((e) => e.docs.length && e.questions.length);
  if (!exs.length) return null;
  return {
    id: p.id.slice(0, 40),
    kind: p.kind,
    level: p.level === "B1" ? "B1" : "B2",
    created: p.created,
    src: p.src === "preset" ? "preset" : "ai",
    ...(p.style === "radio" || p.style === "natural" ? { style: p.style } : {}),
    exs,
    ...(p.starred === true ? { starred: true } : {}),
  };
}

function sanitizeAttempts(v: unknown): Attempt[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((a): a is Record<string, unknown> => !!a && typeof a === "object" && typeof a.at === "number" && typeof a.score === "number" && typeof a.total === "number")
    .map((a) => {
      const picked: Record<string, number> = {};
      if (a.picked && typeof a.picked === "object") for (const [k, n] of Object.entries(a.picked)) if (/^\d+-\d+$/.test(k) && typeof n === "number") picked[k] = n;
      const asked = Array.isArray(a.asked) ? a.asked.filter((k): k is string => typeof k === "string" && /^\d+-\d+$/.test(k)) : null;
      return { at: a.at as number, picked, score: a.score as number, total: a.total as number, ...(asked ? { asked } : {}) };
    })
    .slice(0, 20);
}

/* ---------- a small cache that React can read ---------- */

interface BankState {
  loaded: boolean;
  papers: BankPaper[];
  attempts: Record<string, Attempt[]>;
}
let state: BankState = { loaded: false, papers: [], attempts: {} };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const set = (next: Partial<BankState>) => {
  state = { ...state, ...next };
  emit();
};

let loading: Promise<void> | null = null;
export function loadBank() {
  loading ??= (async () => {
    const papers = ((await tx<unknown[]>(PAPERS, "readonly", (s) => s.getAll())) ?? []).map(sanitizePaper).filter((p): p is BankPaper => !!p);
    const keys = ((await tx<IDBValidKey[]>(ATTEMPTS, "readonly", (s) => s.getAllKeys())) ?? []).filter((k): k is string => typeof k === "string");
    const vals = (await tx<unknown[]>(ATTEMPTS, "readonly", (s) => s.getAll())) ?? [];
    const attempts: Record<string, Attempt[]> = {};
    keys.forEach((k, i) => (attempts[k] = sanitizeAttempts(vals[i])));
    set({ loaded: true, papers: papers.sort((a, b) => b.created - a.created), attempts });
  })();
  return loading;
}

export function reloadBank() {
  loading = null;
  return loadBank();
}

export function useBank() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      void loadBank();
      return () => subs.delete(f);
    },
    () => state,
  );
}

const rid = () => `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Keep a paper the AI wrote; the oldest unstarred ones beyond MAX_BANK are dropped. Returns its id. */
export async function savePaper(p: Omit<BankPaper, "id" | "created" | "src">): Promise<string> {
  await loadBank();
  const paper: BankPaper = { ...p, id: rid(), created: Date.now(), src: "ai" };
  const papers = [paper, ...state.papers];
  const drop = papers.filter((x) => !x.starred).slice(MAX_BANK);
  set({ papers: papers.filter((x) => !drop.includes(x)) });
  await tx(PAPERS, "readwrite", (s) => s.put(paper));
  for (const d of drop) await deletePaper(d.id);
  return paper.id;
}

export async function deletePaper(id: string) {
  const { [id]: _gone, ...attempts } = state.attempts;
  set({ papers: state.papers.filter((p) => p.id !== id), attempts });
  await tx(PAPERS, "readwrite", (s) => s.delete(id));
  await tx(ATTEMPTS, "readwrite", (s) => s.delete(id));
}

export async function starPaper(id: string, starred: boolean) {
  const p = state.papers.find((x) => x.id === id);
  if (!p) return;
  const next = { ...p, starred: starred || undefined };
  set({ papers: state.papers.map((x) => (x.id === id ? next : x)) });
  await tx(PAPERS, "readwrite", (s) => s.put(next));
}

export async function addAttempt(id: string, a: Attempt) {
  await loadBank();
  const list = [a, ...(state.attempts[id] ?? [])].slice(0, 20);
  set({ attempts: { ...state.attempts, [id]: list } });
  await tx(ATTEMPTS, "readwrite", (s) => s.put(list, id));
}

/** The question keys answered wrong (or left blank) in an attempt, among the questions it asked. */
export function wrongKeys(paper: Pick<BankPaper, "exs">, attempt: Attempt | undefined): string[] {
  if (!attempt) return [];
  const asked = attempt.asked ?? null;
  const out: string[] = [];
  paper.exs.forEach((ex, e) =>
    ex.questions.forEach((q, k) => {
      const key = `${e}-${k}`;
      if (asked && !asked.includes(key)) return;
      if (attempt.picked[key] !== q.answer) out.push(key);
    }),
  );
  return out;
}
