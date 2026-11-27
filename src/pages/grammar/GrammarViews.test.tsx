import { resetTestDom } from "../../test-dom";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, test } from "node:test";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { GrammarData } from "../../lib/grammar";
import type { CardState } from "../../store/srs";
import { flush, resetProgress, store } from "../../store/store";
import { GRAMMAR_GROUPS_KEY } from "./catalog-groups";
import { Overview } from "./GrammarViews";

const data: GrammarData = JSON.parse(readFileSync(new URL("../../../public/atlas/grammar.json", import.meta.url), "utf8"));
const DAY = 86400000;

const card = (due: number): CardState => ({ due, s: 3, d: 5, el: 1, sd: 1, ls: 1, reps: 1, lapses: 0, st: 2, seen: Date.now() - 5 * DAY, last: Date.now() - 2 * DAY });

function setGram(gram: Record<string, CardState>) {
  act(() => store.progress((p) => ({ ...p, gram })));
}

function renderOverview() {
  return render(<Overview data={data} tabs={<div />} onStart={() => {}} onDiscourse={() => {}} />);
}

const toggle = (key: string, view = "level") => {
  const el = document.getElementById(`gram-toggle-${view}-${key}`);
  assert.ok(el, `toggle ${view}/${key} missing`);
  return el as HTMLButtonElement;
};
const panel = (key: string, view = "level") => {
  const el = document.getElementById(`gram-panel-${view}-${key}`);
  assert.ok(el, `panel ${view}/${key} missing`);
  return el as HTMLElement;
};
const expanded = (key: string, view = "level") => toggle(key, view).getAttribute("aria-expanded");
const savedGroups = () => JSON.parse(localStorage.getItem(GRAMMAR_GROUPS_KEY) ?? "{}");

beforeEach(() => {
  store.useDataset("francais-b2-lexicon");
  resetProgress();
  store.settings({ startLevel: 2 });
  localStorage.removeItem(GRAMMAR_GROUPS_KEY);
});

afterEach(() => {
  cleanup();
  resetProgress();
  store.settings({ startLevel: 0 });
  flush();
  resetTestDom();
});

test("level groups render collapsed in start-level order with valid disclosure wiring", () => {
  const { container } = renderOverview();
  const toggles = [...container.querySelectorAll<HTMLButtonElement>(".gram-group-toggle")];
  assert.deepEqual(
    toggles.map((t) => t.querySelector(".gram-group-title")?.textContent),
    ["B1 · 当前起点", "B2", "A1", "A2"],
  );
  for (const t of toggles) {
    assert.equal(t.getAttribute("aria-expanded"), "false");
    const ul = document.getElementById(t.getAttribute("aria-controls")!);
    assert.ok(ul, "aria-controls must reference an element");
    assert.equal(ul.tagName, "UL");
    assert.ok(ul.hasAttribute("hidden"));
  }
  // collapsed groups show a preview and the started count
  assert.match(toggle("A2").querySelector(".gram-group-meta")!.textContent!, /^0 \/ 10 已开始$/);
  assert.ok(toggle("A2").querySelector(".gram-group-preview")?.textContent);
  assert.ok(screen.getByText("共 4 组 · 已展开 0 组"));
});

test("toggling a group opens it and persists the choice", () => {
  renderOverview();
  fireEvent.click(toggle("A2"));
  assert.equal(expanded("A2"), "true");
  assert.equal(panel("A2").hasAttribute("hidden"), false);
  assert.equal(panel("A2").querySelectorAll(".gram-card").length, 10);
  assert.equal(toggle("A2").querySelector(".gram-group-preview"), null);
  assert.deepEqual(savedGroups(), { level: { A2: true } });

  fireEvent.click(toggle("A2"));
  assert.equal(expanded("A2"), "false");
  assert.deepEqual(savedGroups(), { level: { A2: false } });
});

test("level quick-jump from another view switches back, opens the level and focuses its toggle", async () => {
  renderOverview();
  fireEvent.click(screen.getByRole("button", { name: "按专题" }));
  assert.equal(document.getElementById("gram-toggle-level-A2"), null);
  assert.ok(document.querySelector("[id^='gram-toggle-category-']"));

  const nav = screen.getByRole("navigation", { name: "按等级直达" });
  const jumpLabels = within(nav)
    .getAllByRole("button")
    .map((b) => b.getAttribute("aria-label"));
  assert.deepEqual(jumpLabels, ["直达 A1，共 11 项", "直达 A2，共 10 项", "直达 B1（当前起点），共 22 项", "直达 B2，共 23 项"]);

  fireEvent.click(within(nav).getByRole("button", { name: /^直达 A2/ }));
  assert.equal(screen.getByRole("button", { name: "按等级" }).getAttribute("aria-pressed"), "true");
  assert.equal(expanded("A2"), "true");
  assert.equal(panel("A2").hasAttribute("hidden"), false);
  await waitFor(() => assert.equal(document.activeElement?.id, "gram-toggle-level-A2"));
  assert.deepEqual(savedGroups(), { level: { A2: true } });
});

test("expand all / collapse all toggle every group and disable themselves", () => {
  renderOverview();
  const expandBtn = screen.getByRole("button", { name: "全部展开" }) as HTMLButtonElement;
  const collapseBtn = screen.getByRole("button", { name: "全部收起" }) as HTMLButtonElement;
  assert.equal(collapseBtn.disabled, true);

  fireEvent.click(expandBtn);
  for (const lv of ["A1", "A2", "B1", "B2"]) assert.equal(expanded(lv), "true");
  assert.equal(expandBtn.disabled, true);
  assert.equal(collapseBtn.disabled, false);
  assert.equal(document.querySelectorAll(".gram-list:not([hidden]) .gram-card").length, data.points.length);

  fireEvent.click(collapseBtn);
  for (const lv of ["A1", "A2", "B1", "B2"]) assert.equal(expanded(lv), "false");
  assert.equal(collapseBtn.disabled, true);
  assert.equal(expandBtn.disabled, false);
});

test("search auto-expands matching groups and clearing restores the saved state", () => {
  renderOverview();
  fireEvent.click(toggle("A2"));
  assert.deepEqual(savedGroups(), { level: { A2: true } });

  const input = screen.getByRole("searchbox", { name: "搜索语法点" });
  fireEvent.change(input, { target: { value: "subjonctif" } });
  assert.equal(expanded("B1"), "true");
  assert.match(toggle("B1").querySelector(".gram-group-meta")!.textContent!, /^匹配 \d+ 个$/);
  const count = Number(/找到 (\d+) 个语法点/.exec(document.querySelector(".gram-search-count")!.textContent!)![1]);
  assert.equal(count, document.querySelectorAll(".gram-list .gram-card").length);

  // closing a group during search only affects this search
  fireEvent.click(toggle("B1"));
  assert.equal(expanded("B1"), "false");
  assert.deepEqual(savedGroups(), { level: { A2: true } });

  fireEvent.click(screen.getByRole("button", { name: "清空搜索" }));
  assert.equal(expanded("A2"), "true");
  for (const lv of ["A1", "B1", "B2"]) assert.equal(expanded(lv), "false");
  assert.deepEqual(savedGroups(), { level: { A2: true } });

  // the same query again starts fresh: every match open; backspacing to empty also restores saved state
  fireEvent.change(input, { target: { value: "subjonctif" } });
  assert.equal(expanded("B1"), "true");
  fireEvent.change(input, { target: { value: "" } });
  assert.equal(expanded("A2"), "true");
  assert.equal(expanded("B1"), "false");
});

test("level quick-jump during search preserves matching search or clears non-matching search cleanly", async () => {
  renderOverview();
  fireEvent.click(toggle("B1"));
  assert.deepEqual(savedGroups(), { level: { B1: true } });

  const input = screen.getByRole("searchbox", { name: "搜索语法点" }) as HTMLInputElement;
  const nav = screen.getByRole("navigation", { name: "按等级直达" });
  fireEvent.click(screen.getByRole("button", { name: "按专题" }));
  fireEvent.change(input, { target: { value: "subjonctif" } });

  // Jump to B2 (has matches for "subjonctif"): switches to level view, keeps query, does not overwrite saved overrides
  fireEvent.click(within(nav).getByRole("button", { name: /^直达 B2/ }));
  assert.equal(input.value, "subjonctif");
  assert.equal(expanded("B2"), "true");
  assert.deepEqual(savedGroups(), { level: { B1: true } });

  // Jump to A1 (0 matches for "subjonctif"): clears query, opens A1, focuses toggle, and keeps prior B1 choice
  fireEvent.click(within(nav).getByRole("button", { name: /^直达 A1/ }));
  assert.equal(input.value, "");
  assert.equal(expanded("A1"), "true");
  assert.equal(expanded("B1"), "true");
  await waitFor(() => assert.equal(document.activeElement?.id, "gram-toggle-level-A1"));
  assert.deepEqual(savedGroups(), { level: { B1: true, A1: true } });
});

test("todo view opens 该复习了 by default, exposes due badge to assistive tech, and opens 还没掌握 when it leads", () => {
  const dueId = data.points.find((p) => p.level === "A1")!.id;
  setGram({ [dueId]: card(Date.now() - DAY) });
  const { unmount } = renderOverview();
  fireEvent.click(screen.getByRole("button", { name: "待复习" }));
  assert.equal(expanded("due", "todo"), "true");
  assert.equal(expanded("new", "todo"), "false");
  assert.match(toggle("due", "todo").querySelector(".gram-group-meta")!.textContent!, /^到期或作文里又错了 · 1 个$/);
  // no due badge inside the todo view, but the level view exposes it in the accessible button name
  assert.equal(document.querySelector(".gram-group-due"), null);
  fireEvent.click(screen.getByRole("button", { name: "按等级" }));
  const dueBadge = toggle("A1").querySelector(".gram-group-due");
  assert.equal(dueBadge?.textContent, "1 待复习");
  assert.equal(dueBadge?.hasAttribute("aria-hidden"), false);
  assert.ok(screen.getByRole("button", { name: /A1.*1 待复习/ }));
  unmount();

  // When no point is due, a weak point leads todo view and opens by default while new stays collapsed
  const weakPoint = data.points.find((p) => p.level === "B1" && p.rules.length > 0)!;
  act(() =>
    store.progress((p) => ({
      ...p,
      gram: { [weakPoint.id]: card(Date.now() + 5 * DAY) },
      gramTags: { [`${weakPoint.id}|r0`]: { n: 4, w: 3 } },
    })),
  );
  renderOverview();
  fireEvent.click(screen.getByRole("button", { name: "待复习" }));
  assert.equal(document.getElementById("gram-toggle-todo-due"), null);
  assert.equal(expanded("weak", "todo"), "true");
  assert.equal(expanded("new", "todo"), "false");
});

test("todo search counts only points in the todo groups", () => {
  const [dueP, ...rest] = data.points;
  setGram({ [dueP.id]: card(Date.now() - DAY), ...Object.fromEntries(rest.map((p) => [p.id, card(Date.now() + 10 * DAY)])) });
  renderOverview();
  fireEvent.click(screen.getByRole("button", { name: "待复习" }));
  fireEvent.change(screen.getByRole("searchbox", { name: "搜索语法点" }), { target: { value: "subjonctif" } });
  assert.ok(screen.getByText("找到 0 个语法点"));
  assert.ok(screen.getByText("待复习中没有匹配的语法点，可切到「按等级」或「按专题」查看。"));
  assert.equal(screen.queryByRole("group", { name: "分组展开控制" }), null);
});
