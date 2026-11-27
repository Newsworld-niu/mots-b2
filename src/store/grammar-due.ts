/**
 * Light grammar counters for the home page and the shell (sidebar badges): how many grammar points are due and
 * how many have essay/speaking mistakes but were never started. Same rules as `duePoints` / `untouchedWithErrors`
 * in store/grammar.ts, computed from grammar-meta.json alone so the entry bundle does not pull the drill engine
 * (lib/grammar.ts) and the conjugation tables (lib/conjugation.ts).
 */
import { useEffect, useState } from "react";
import type { Progress } from "./types";

type ErrorSource = Pick<Progress, "essayNotes" | "essays" | "speakCorrections">;
type GrammarSource = Pick<Progress, "gram"> & ErrorSource;

/** Times of the distinct marked mistakes per grammar point (same dedup as `essayErrors`). */
export function grammarErrorTimes(p: ErrorSource): Map<string, number[]> {
  const out = new Map<string, number[]>();
  const seen = new Set<string>();
  const put = (point: string | undefined, wrongRaw: string | undefined, rightRaw: string | undefined, at: number) => {
    const wrong = (wrongRaw ?? "").trim();
    const right = (rightRaw ?? "").trim();
    if (!point || !wrong || !right || wrong === right) return;
    const key = `${point}|${wrong}|${right}`;
    if (seen.has(key)) return;
    seen.add(key);
    const list = out.get(point);
    if (list) list.push(at);
    else out.set(point, [at]);
  };
  for (const n of p.essayNotes ?? []) put(n.point, n.wrong, n.right, n.at);
  for (const essay of p.essays ?? [])
    for (const [fb, at] of [
      [essay.fb, essay.created],
      [essay.rev?.fb, essay.rev?.at ?? essay.created],
    ] as const)
      for (const c of fb?.corrections ?? []) put(c.point, c.wrong, c.right, at);
  for (const sp of p.speakCorrections ?? []) for (const c of sp.corrections) put(c.point, c.wrong, c.right, sp.at);
  return out;
}

/** Grammar points due now: the card is due, or a new mistake on the point came after its last review. */
export function dueGrammarCountFromMeta(meta: readonly { id: string }[] | null | undefined, p: GrammarSource, now = Date.now()): number {
  if (!meta?.length || !p.gram) return 0;
  const errors = grammarErrorTimes(p);
  let n = 0;
  for (const { id } of meta) {
    const c = p.gram[id];
    if (!c) continue;
    if (c.due <= now || (errors.get(id) ?? []).some((at) => at > (c.last ?? c.seen))) n++;
  }
  return n;
}

/** Grammar points with marked mistakes that the learner has not started yet. */
export function untouchedGrammarErrorCount(meta: readonly { id: string }[] | null | undefined, p: GrammarSource): number {
  if (!meta?.length) return 0;
  const errors = grammarErrorTimes(p);
  if (!errors.size) return 0;
  let n = 0;
  for (const { id } of meta) if (!p.gram?.[id] && errors.has(id)) n++;
  return n;
}

/* ---------- 错题回流 count, loaded off the critical path ---------- */

type ReflowSource = Pick<Progress, "noteCards" | "essayNotes" | "compMisses" | "mistakes">;
let reflowModule: Promise<typeof import("./note-review")> | null = null;

/** note-review pulls the grammar engine; the shell only needs a number, so it is fetched once the page is idle. */
export function loadReflowModule() {
  if (!reflowModule)
    reflowModule = import("./note-review").catch((e) => {
      reflowModule = null;
      throw e;
    });
  return reflowModule;
}

const whenIdle = (fn: () => void): (() => void) => {
  if (typeof window === "undefined") return () => {};
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: 2500 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(fn, 600);
  return () => window.clearTimeout(id);
};

/**
 * Word mistakes plus due 错句 / 听读错因 reflow cards (the 错题中心 badge). `words` is exact at once; `reflow` is
 * null until note-review.ts has loaded in the background.
 */
export function useMistakeDue(p: ReflowSource): { words: number; reflow: number | null; total: number } {
  const hasReflowItems = (p.essayNotes?.length ?? 0) > 0 || (p.compMisses?.length ?? 0) > 0;
  const [reflow, setReflow] = useState<number | null>(hasReflowItems ? null : 0);
  const { noteCards, essayNotes, compMisses } = p;
  useEffect(() => {
    if (!hasReflowItems) {
      setReflow(0);
      return;
    }
    let live = true;
    const cancel = whenIdle(() => {
      loadReflowModule().then(
        (m) => live && setReflow(m.reflowSummary({ noteCards, essayNotes, compMisses }).due),
        () => {},
      );
    });
    return () => {
      live = false;
      cancel();
    };
  }, [hasReflowItems, noteCards, essayNotes, compMisses]);
  const words = p.mistakes.length;
  return { words, reflow, total: words + (reflow ?? 0) };
}
