import { resetTestDom } from "../test-dom";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { openSheetCount, Sheet } from "./Sheet";

afterEach(() => {
  cleanup();
  resetTestDom();
  document.documentElement.classList.remove("is-locked");
});

function Stacked({ onClosed }: { onClosed: (which: string) => void }) {
  const [outer, setOuter] = useState(true);
  const [inner, setInner] = useState(true);
  return (
    <>
      <Sheet
        open={outer}
        onClose={() => {
          onClosed("outer");
          setOuter(false);
        }}
        label="外层"
      >
        <button type="button">外层按钮</button>
      </Sheet>
      <Sheet
        open={inner}
        onClose={() => {
          onClosed("inner");
          setInner(false);
        }}
        label="内层"
      >
        <button type="button">内层按钮</button>
      </Sheet>
    </>
  );
}

const lockedNow = () => document.documentElement.classList.contains("is-locked");

test("stacked sheets close one by one on Escape and keep the page locked until the last closes", () => {
  const closed: string[] = [];
  render(<Stacked onClosed={(w) => closed.push(w)} />);
  assert.equal(screen.getAllByRole("dialog").length, 2);
  assert.equal(openSheetCount(), 2);
  assert.ok(lockedNow());

  act(() => {
    fireEvent.keyDown(document, { key: "Escape" });
  });
  assert.deepEqual(closed, ["inner"], "only the topmost sheet answers Escape");
  assert.ok(screen.getByRole("dialog", { name: "外层" }));
  assert.equal(screen.queryByRole("dialog", { name: "内层" }), null);
  assert.equal(openSheetCount(), 1);
  assert.ok(lockedNow(), "the page stays locked while a sheet is still open");

  act(() => {
    fireEvent.keyDown(document, { key: "Escape" });
  });
  assert.deepEqual(closed, ["inner", "outer"]);
  assert.equal(screen.queryByRole("dialog"), null);
  assert.equal(openSheetCount(), 0);
  assert.equal(lockedNow(), false, "the lock is released with the last sheet");
});

test("Escape on a sheet does not reach window listeners underneath", () => {
  let windowEscapes = 0;
  const onWin = (e: KeyboardEvent) => {
    if (e.key === "Escape") windowEscapes++;
  };
  window.addEventListener("keydown", onWin);
  try {
    let closes = 0;
    render(
      <Sheet open onClose={() => closes++} label="单层">
        <button type="button">按钮</button>
      </Sheet>,
    );
    act(() => {
      fireEvent.keyDown(document, { key: "Escape", bubbles: true });
    });
    assert.equal(closes, 1);
    assert.equal(windowEscapes, 0);
  } finally {
    window.removeEventListener("keydown", onWin);
  }
});

test("Tab is trapped in the topmost sheet only", () => {
  render(<Stacked onClosed={() => {}} />);
  const innerBtn = screen.getByRole("button", { name: "内层按钮" });
  innerBtn.focus();
  act(() => {
    fireEvent.keyDown(document, { key: "Tab" });
  });
  const inner = screen.getByRole("dialog", { name: "内层" });
  assert.ok(inner.contains(document.activeElement), "focus wraps inside the top sheet");
});
