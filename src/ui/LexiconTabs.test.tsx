import { resetTestDom } from "../test-dom";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render, screen } from "@testing-library/react";
import { LexiconTabs } from "./LexiconTabs";

afterEach(() => {
  cleanup();
  resetTestDom();
});

test("LexiconTabs renders 4 tabs with accessible aria-current and active class", () => {
  render(<LexiconTabs on="dict" />);
  const nav = screen.getByRole("navigation", { name: "词库模块切换" });
  const links = nav.querySelectorAll("a");
  assert.equal(links.length, 4);

  const dictTab = screen.getByRole("link", { name: "词典" });
  assert.equal(dictTab.getAttribute("aria-current"), "page");
  assert.ok(dictTab.classList.contains("is-on"));

  const atlasTab = screen.getByRole("link", { name: "图鉴" });
  assert.equal(atlasTab.getAttribute("aria-current"), null);
  assert.equal(atlasTab.getAttribute("href"), "#/atlas");
});
