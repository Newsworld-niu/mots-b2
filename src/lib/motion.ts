import { flushSync } from "react-dom";

export interface ViewTransitionLike {
  finished?: Promise<unknown>;
  ready?: Promise<unknown>;
  updateCallbackDone?: Promise<unknown>;
}

type VTDocument = Document & { startViewTransition?: (cb: () => void) => ViewTransitionLike };

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function isTransitionAbort(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: unknown }).name;
  return name === "InvalidStateError" || name === "AbortError";
}

function attachAbortGuards(t: ViewTransitionLike | null | undefined, onSettled?: () => void) {
  const ignoreAbort = (err: unknown) => {
    if (!isTransitionAbort(err)) throw err;
  };
  t?.ready?.catch(ignoreAbort);
  t?.updateCallbackDone?.catch(ignoreAbort);
  if (t?.finished) {
    t.finished.then(
      () => onSettled?.(),
      (err) => {
        onSettled?.();
        ignoreAbort(err);
      },
    );
  } else {
    onSettled?.();
  }
}

/** Run a DOM-changing update inside a View Transition when the browser supports it. */
export function transition(update: () => void) {
  const d = document as VTDocument;
  if (!d.startViewTransition || reduced()) {
    update();
    return;
  }
  let ran = false;
  const run = () => {
    ran = true;
    flushSync(update);
  };
  try {
    const t = d.startViewTransition(run);
    attachAbortGuards(t);
  } catch (err) {
    if (!isTransitionAbort(err)) throw err;
    if (!ran) update();
  }
}

/** Morph an element (e.g. a gallery tile's illustration) into the word card. */
export function morphFrom(el: HTMLElement | null | undefined, update: () => void) {
  const d = document as VTDocument;
  if (!el || !d.startViewTransition || reduced()) {
    update();
    return;
  }
  el.style.viewTransitionName = "word-art";
  let ran = false;
  const run = () => {
    ran = true;
    el.style.viewTransitionName = "";
    flushSync(update);
  };
  try {
    const t = d.startViewTransition(run);
    attachAbortGuards(t, () => {
      el.style.viewTransitionName = "";
    });
  } catch (err) {
    el.style.viewTransitionName = "";
    if (!isTransitionAbort(err)) throw err;
    if (!ran) update();
  }
}
