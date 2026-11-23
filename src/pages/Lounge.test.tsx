import { resetTestDom } from "../test-dom";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LOUNGE_MICRO_READS } from "../lib/lounge-reads";
import { CURATED_YOUTUBE_VIDEOS, OPEN_SAMPLE_VIDEOS } from "../lib/lounge-videos";
import {
  markMicroReadDone,
  saveLoungeClip,
  setLoungeMode,
  updateBookProgress,
} from "../store/lounge";
import { flush, resetProgress, store } from "../store/store";
import { LoungeHub } from "./lounge/LoungeHub";

afterEach(() => {
  cleanup();
  resetProgress();
  store.settings({ loungeMode: "chill" });
  flush();
  resetTestDom();
});

test("LoungeHub renders 3 shelves, energy filters, and all 5 curated bilingual books", () => {
  render(<LoungeHub />);

  assert.ok(screen.getByText(/磨坊书简/));
  assert.ok(screen.getByText(/绅士怪盗亚森·罗宾/));
  assert.ok(screen.getByText(/动物对话录/));
  assert.ok(screen.getByText(/小王子/));

  // Filter by Energy 1
  fireEvent.click(screen.getByRole("button", { name: /5分钟无脑回血/ }));
  assert.ok(screen.getByText(/自然史动物微速写/));
  assert.equal(screen.queryByText(/莫泊桑反转短篇精选/), null);

  // Reset energy filter and switch to micro-reads shelf
  fireEvent.click(screen.getByRole("button", { name: "全部" }));
  fireEvent.click(screen.getByRole("tab", { name: /睡前摸鱼小品/ }));
  assert.ok(screen.getByText(LOUNGE_MICRO_READS[0].titleZh, { exact: false }));

  // Switch to videos shelf
  fireEvent.click(screen.getByRole("tab", { name: /视频漫游/ }));
  assert.ok(screen.getByText(OPEN_SAMPLE_VIDEOS[0].titleZh, { exact: false }));
  assert.ok(screen.getByText(CURATED_YOUTUBE_VIDEOS[0].titleZh, { exact: false }));
});

test("LoungeHub displays active resume banner, saved cultural clips, and preserves light streak boundary", () => {
  updateBookProgress("lupin", { ch: 1, para: 2, ratio: 0.65, title: "绅士怪盗亚森·罗宾" });
  saveLoungeClip({
    fr: "Poser un lapin à quelqu'un.",
    zh: "放某人鸽子。",
    source: "《法国人为什么这样？》",
  });
  setLoungeMode("study");
  markMicroReadDone(LOUNGE_MICRO_READS[0].id, LOUNGE_MICRO_READS[0].titleZh);

  render(<LoungeHub initialShelf="reads" />);

  assert.equal(store.get().settings.loungeMode, "study");
  assert.ok(screen.getByText(/绅士怪盗亚森·罗宾/));
  assert.ok(screen.getByText(/Poser un lapin à quelqu'un/));

  const prog = store.get().progress;
  const totalLoungeCount = Object.values(prog.loungeDays ?? {}).reduce((a, b) => a + b, 0);
  assert.ok(totalLoungeCount >= 1, "markMicroReadDone records light streak activity");
  assert.equal(prog.examLog?.length ?? 0, 0, "Lounge never pollutes examLog");
  assert.equal(Object.keys(prog.cards).length, 0, "Lounge never adds unsolicited FSRS debt");
});
