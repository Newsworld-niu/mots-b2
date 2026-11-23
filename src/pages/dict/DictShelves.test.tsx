import { resetTestDom } from "../../test-dom";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { getDictStore, recordDictHistory, toggleDictFav } from "../../lib/lexdb/store";
import type { LexSuggestRow } from "../../lib/lexdb/types";
import { resetProgress, store } from "../../store/store";
import { HistoryFavShelf, NotFoundCard, ZhResults } from "./DictShelves";

beforeEach(() => {
  store.useDataset("francais-b2-lexicon");
  resetProgress();
});

afterEach(() => {
  cleanup();
  resetTestDom();
});

test("ZhResults renders hits and empty state cleanly", () => {
  const { rerender } = render(<ZhResults query="接待" hits={[]} />);
  assert.ok(screen.getByText(/没有找到包含「接待」的法语词条/));

  rerender(
    <ZhResults
      query="接待"
      hits={[{ id: "accueil", w: "accueil", rank: 120, term: "接待", shortZh: "接待；欢迎" }]}
    />,
  );
  const link = screen.getByRole("link", { name: /accueil/ });
  assert.equal(link.getAttribute("href"), "#/dict?w=accueil");
  assert.ok(screen.getByText("#120"));
});

test("NotFoundCard renders did-you-mean suggestions and external reference links", () => {
  const rows: LexSuggestRow[] = [["accueil", "accueil", 100, "接待；欢迎"]];
  render(<NotFoundCard query="acceuil" didYouMeanRows={rows} />);
  assert.ok(screen.getByText("你是不是要找…"));
  const chip = screen.getByRole("link", { name: /accueil/ });
  assert.equal(chip.getAttribute("href"), "#/dict?w=accueil");
  assert.ok(screen.getByRole("link", { name: /去法语助手原文查看/ }));
});

test("HistoryFavShelf switches tabs, removes favorite, and clears history", () => {
  recordDictHistory("accueil");
  toggleDictFav("prendre");
  const suggestMap = new Map<string, LexSuggestRow>([
    ["accueil", ["accueil", "accueil", 50, "接待"]],
    ["prendre", ["prendre", "prendre", 12, "拿，取"]],
  ]);

  render(
    <HistoryFavShelf suggestMap={suggestMap} meta={null} onLoadedRows={() => undefined} />,
  );

  // History tab active initially
  assert.ok(screen.getByRole("link", { name: /accueil/ }));
  fireEvent.click(screen.getByRole("tab", { name: /收藏夹 \(1\)/ }));
  assert.ok(screen.getByRole("link", { name: /prendre/ }));

  // Remove favorite item
  fireEvent.click(screen.getByRole("button", { name: "取消收藏 prendre" }));
  assert.deepEqual(getDictStore().favs, []);
  assert.ok(screen.getByText(/还没有收藏词典词条/));

  // Switch back to history and clear
  fireEvent.click(screen.getByRole("tab", { name: /最近查词 \(1\)/ }));
  fireEvent.click(screen.getByRole("button", { name: "清空" }));
  assert.deepEqual(getDictStore().history, []);
  assert.ok(screen.getByText(/还没有查词记录/));
});
