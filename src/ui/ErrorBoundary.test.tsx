import { resetTestDom } from "../test-dom";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

afterEach(() => {
  cleanup();
  resetTestDom();
});

function Crash({ msg, name }: { msg: string; name?: string }): never {
  const err = new Error(msg);
  if (name) err.name = name;
  throw err;
}

function withMutedError<T>(fn: () => T): T {
  const orig = console.error;
  console.error = () => undefined;
  try {
    return fn();
  } finally {
    console.error = orig;
  }
}

test("ErrorBoundary renders children when no error is thrown", () => {
  render(
    <ErrorBoundary>
      <p>正常内容</p>
    </ErrorBoundary>,
  );
  assert.ok(screen.getByText("正常内容"));
});

test("ErrorBoundary catches runtime error and renders fallback card without inline styles", () => {
  withMutedError(() => {
    render(
      <ErrorBoundary>
        <Crash msg="boom test error" />
      </ErrorBoundary>,
    );
  });
  const alertBox = screen.getByRole("alert");
  assert.ok(alertBox.classList.contains("error-boundary-card"));
  assert.equal(alertBox.getAttribute("style"), null);
  assert.ok(screen.getByText("页面遇到意外错误"));
  assert.ok(screen.getByRole("button", { name: "导出紧急学习备份 (JSON)" }));
  assert.ok(screen.getByText("boom test error"));
});

test("ErrorBoundary detects ChunkLoadError and renders update recovery prompt", () => {
  // Prevent tryControlledReload() from reloading in test DOM
  sessionStorage.setItem("fb2.chunk-reload", String(Date.now()));
  withMutedError(() => {
    render(
      <ErrorBoundary>
        <Crash msg="Failed to fetch dynamically imported module: /assets/MockExam.js" name="ChunkLoadError" />
      </ErrorBoundary>,
    );
  });
  assert.ok(screen.getByText("页面资源需要刷新更新"));
});
