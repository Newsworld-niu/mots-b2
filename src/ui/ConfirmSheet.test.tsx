import { resetTestDom } from "../test-dom";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ConfirmSheetHost, confirmAction } from "./ConfirmSheet";

afterEach(() => {
  cleanup();
  resetTestDom();
});

test("ConfirmSheetHost opens dialog and resolves confirm/cancel/Escape cleanly", async () => {
  render(<ConfirmSheetHost />);

  let pConfirm!: Promise<boolean>;
  act(() => {
    pConfirm = confirmAction({
      title: "删除这套题？",
      message: "此操作不可撤销。",
      confirmLabel: "删除",
      cancelLabel: "保留",
      danger: true,
    });
  });
  assert.ok(screen.getByRole("dialog", { name: "删除这套题？" }));
  assert.ok(screen.getByText("此操作不可撤销。"));
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  assert.equal(await pConfirm, true);
  assert.equal(screen.queryByRole("dialog"), null);

  let pCancel!: Promise<boolean>;
  act(() => {
    pCancel = confirmAction({
      title: "放弃练习？",
      message: "确定放弃？",
      confirmLabel: "确定",
      cancelLabel: "取消",
    });
  });
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  assert.equal(await pCancel, false);

  let pEscape!: Promise<boolean>;
  act(() => {
    pEscape = confirmAction({
      title: "退出测试",
      message: "按 ESC 取消",
    });
  });
  assert.ok(screen.getByRole("dialog", { name: "退出测试" }));
  fireEvent.keyDown(document, { key: "Escape", bubbles: true });
  assert.equal(await pEscape, false);
});
