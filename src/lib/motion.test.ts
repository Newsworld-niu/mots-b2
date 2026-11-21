import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { morphFrom, transition } from "./motion";

const origDocument = (globalThis as Record<string, unknown>).document;
const origMatchMedia = (globalThis as Record<string, unknown>).matchMedia;

afterEach(() => {
  (globalThis as Record<string, unknown>).document = origDocument;
  (globalThis as Record<string, unknown>).matchMedia = origMatchMedia;
});

function abortError(name: "InvalidStateError" | "AbortError") {
  const err = new Error(`Transition aborted (${name})`);
  err.name = name;
  return err;
}

test("transition swallows InvalidStateError and AbortError on ready and finished", async () => {
  (globalThis as Record<string, unknown>).matchMedia = () => ({ matches: false });
  const unhandled: unknown[] = [];
  const onUnhandled = (e: unknown) => unhandled.push(e);
  process.on("unhandledRejection", onUnhandled);

  try {
    (globalThis as Record<string, unknown>).document = {
      startViewTransition(cb: () => void) {
        cb();
        return {
          ready: Promise.reject(abortError("InvalidStateError")),
          finished: Promise.reject(abortError("AbortError")),
          updateCallbackDone: Promise.resolve(),
        };
      },
    };

    let updated = false;
    transition(() => {
      updated = true;
    });
    assert.equal(updated, true);

    await new Promise((r) => setTimeout(r, 20));
    assert.equal(unhandled.length, 0);
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
});

test("transition falls back to update when startViewTransition throws InvalidStateError synchronously", () => {
  (globalThis as Record<string, unknown>).matchMedia = () => ({ matches: false });
  (globalThis as Record<string, unknown>).document = {
    startViewTransition() {
      throw abortError("InvalidStateError");
    },
  };

  let updated = false;
  transition(() => {
    updated = true;
  });
  assert.equal(updated, true);
});

test("morphFrom resets viewTransitionName and swallows transition abort rejections", async () => {
  (globalThis as Record<string, unknown>).matchMedia = () => ({ matches: false });
  const unhandled: unknown[] = [];
  const onUnhandled = (e: unknown) => unhandled.push(e);
  process.on("unhandledRejection", onUnhandled);

  try {
    (globalThis as Record<string, unknown>).document = {
      startViewTransition() {
        return {
          ready: Promise.reject(abortError("InvalidStateError")),
          finished: Promise.reject(abortError("InvalidStateError")),
          updateCallbackDone: Promise.reject(abortError("AbortError")),
        };
      },
    };

    const el = { style: { viewTransitionName: "" } } as unknown as HTMLElement;
    morphFrom(el, () => {});
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(el.style.viewTransitionName, "");
    assert.equal(unhandled.length, 0);
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
});
