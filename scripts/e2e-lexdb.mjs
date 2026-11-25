/* Browser checks for LexDB (#/dict), WordPopup, Read token tap, and Decks 自己添加 against a running server (FR_URL, default http://127.0.0.1:5190/).
 * Uses CHROME_PATH if set, macOS Chrome if present, or Playwright's bundled Chromium. Writes screenshot and JSON results to output/e2e/. */
import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const BASE = (process.env.FR_URL ?? "http://127.0.0.1:5190/").replace(/\/?$/, "/");
const MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CHROME = process.env.CHROME_PATH || (existsSync(MAC_CHROME) ? MAC_CHROME : undefined);
mkdirSync("output/e2e", { recursive: true });

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const SETTINGS = JSON.stringify({ onboarded: true, splash: false, theme: "dark", sfx: false, autoplay: false });
const settle = (p, ms = 400) => p.waitForTimeout(ms);
const progressOf = (p) =>
  p.evaluate(() => JSON.parse(localStorage.getItem("word-atlas:v2:francais-b2-lexicon") || "null"));

const browser = await chromium.launch({ ...(CHROME ? { executablePath: CHROME } : {}), headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
await ctx.addInitScript((s) => {
  if (!sessionStorage.getItem("seeded")) {
    localStorage.setItem("word-atlas:settings", s);
    sessionStorage.setItem("seeded", "1");
  }
}, SETTINGS);

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));

// 1) Accent-free search (ecole -> école) + live autocomplete
await page.goto(BASE + "#/dict");
await page.waitForSelector(".dict-search-bar input");
const dictInput = page.locator(".dict-search-bar input");
await dictInput.fill("ecole");
await page.waitForSelector("#dict-autocomplete li button", { timeout: 10000 }).catch(() => {});
const acText = await page.locator("#dict-autocomplete").innerText().catch(() => "");
check("dict autocomplete shows accent-folded match for ecole", /école/.test(acText));
await dictInput.press("Enter");
await page.waitForSelector(".dict-headword");
await settle(page);
check(
  "dict accent-free search resolves ecole -> école",
  (await page.locator(".dict-headword").innerText()).trim() === "école" &&
    /学校/.test(await page.locator(".dict-panels").innerText()),
);

// 2) Inflected form lookup (voulons -> vouloir) + 动词变位 tab
await dictInput.fill("voulons");
await dictInput.press("Enter");
await page.waitForSelector(".dict-headword");
await settle(page);
const wantMain = await page.locator(".dict-main").innerText();
check(
  "dict inflected form lookup resolves voulons -> vouloir",
  /词形还原/.test(wantMain) && (await page.locator(".dict-headword").innerText()).trim() === "vouloir",
);
await page.getByRole("tab", { name: /动词变位/ }).click();
await page.waitForSelector(".conj-table");
check("dict 动词变位 tab renders conjugation table", /je\s+veux/.test(await page.locator(".conj-table").innerText()));

// 3) Chinese reverse lookup (接待) + regression: hovering autocomplete must NOT hijack 查词 submit
await dictInput.fill("接待");
await page.waitForFunction(() => document.querySelector(".dict-mode-pill")?.textContent?.includes("中文反查"));
await page.waitForSelector("#dict-autocomplete li button", { timeout: 10000 }).catch(() => {});
const acHoverTarget = page.locator("#dict-autocomplete li button").nth(2);
if (await acHoverTarget.count()) await acHoverTarget.hover();
await page.locator(".dict-search-submit").click();
await page.waitForSelector(".dict-zh-list .dict-zh-row", { timeout: 8000 }).catch(() => {});
const urlAfterZh = page.url();
const zhHitsText = await page.locator(".dict-zh-list").innerText().catch(() => "");
check(
  "dict Chinese reverse lookup lands on #/dict?q=接待 even with pointer over autocomplete",
  /#\/dict\?q=%E6%8E%A5%E5%BE%85/.test(urlAfterZh) && /accueil|accueillir|recevoir/.test(zhHitsText),
  urlAfterZh,
);
if (await page.locator(".dict-zh-row", { hasText: /^accueil\b/ }).count()) {
  await page.locator(".dict-zh-row", { hasText: /^accueil\b/ }).first().click();
  await page.waitForSelector(".dict-headword");
  await settle(page, 300);
}
check("dict clicking Chinese reverse hit opens entry", (await page.locator(".dict-headword").innerText().catch(() => "")).trim() === "accueil");

// 4) Typo did-you-mean (acceuil -> accueil)
await dictInput.fill("acceuil");
await dictInput.press("Enter");
await page.waitForSelector(".dict-dym-chip");
check(
  "dict typo did-you-mean suggests accueil for acceuil",
  /你是不是要找/.test(await page.locator(".dict-main").innerText()) &&
    /accueil/.test(await page.locator(".dict-dym-list").innerText()),
);
await page.locator(".dict-dym-chip", { hasText: /accueil/ }).first().click();
await page.waitForSelector(".dict-headword");
await settle(page, 300);
check("dict clicking did-you-mean chip opens accueil", (await page.locator(".dict-headword").innerText()).trim() === "accueil");

// 5) Add-to-review (加入复习) from LexDB entry into deck via prefilled WordForm
await page.goto(BASE + "#/dict?w=actuel");
await page.waitForSelector(".dict-headword");
await settle(page, 300);
await page.getByRole("button", { name: /加入复习/ }).click();
await page.waitForSelector(".sheet .word-form");
const prefilledW = await page.locator(".sheet .word-form input").first().inputValue();
await page.locator('.sheet .word-form button[type="submit"]').click();
await page.waitForSelector(".sheet", { state: "detached", timeout: 5000 }).catch(() => {});
await settle(page);
const progDictAdd = await progressOf(page);
check(
  "dict 加入复习 prefills WordForm and saves custom word into 阅读生词 deck",
  prefilledW === "actuel" &&
    Object.values(progDictAdd?.custom ?? {}).some((c) => c.w === "actuel") &&
    (progDictAdd?.decks ?? []).some((d) => d.name === "阅读生词" && d.words.length > 0),
);
await page.screenshot({ path: "output/e2e/dict.png" });

// 5b) Relations (派生 · 近义 · 反义) render as clickable chips that open the target entry
const hintRequests = [];
page.on("request", (r) => {
  if (/\/lexdb\/hints\//.test(r.url())) hintRequests.push(r.url());
});
await page.goto(BASE + "#/dict?w=heureux");
await page.waitForSelector(".dict-headword");
await settle(page, 500);
const relPanel = page.locator(".dict-panel-rel");
const relChips = relPanel.locator("a.dict-rel-chip");
const relCount = await relChips.count();
const relHrefsOk = relCount > 0 && (await relChips.evaluateAll((els) => els.every((a) => /^#\/dict\?w=/.test(a.getAttribute("href") || ""))));
check("dict relation panel renders 派生/近义/反义 chips linking to #/dict?w=…", relCount > 0 && relHrefsOk, `${relCount} chips`);
const relTab = await page.locator(".dict-tabs [role=tab]", { hasText: "派生·近反义" }).count();
check("dict 派生·近反义 tab is offered when the entry has relations", relTab === 1);
const synChip = (await relPanel.locator(".dict-rel-syn a.dict-rel-chip", { hasText: /^content/ }).count())
  ? relPanel.locator(".dict-rel-syn a.dict-rel-chip", { hasText: /^content/ }).first()
  : relPanel.locator(".dict-rel-syn a.dict-rel-chip, .dict-rel-ant a.dict-rel-chip").first();
if (await synChip.count()) {
  const target = ((await synChip.locator('span[lang="fr"]').innerText()) || "").trim();
  await synChip.click();
  await page.waitForFunction((w) => decodeURIComponent(location.hash.replace(/\+/g, " ")).includes(`w=${w}`), target, { timeout: 5000 }).catch(() => {});
  await page.waitForSelector(".dict-headword, .dict-empty-card", { timeout: 8000 }).catch(() => {});
  await settle(page, 300);
  const landed = decodeURIComponent(page.url().replace(/\+/g, " "));
  const head = (await page.locator(".dict-headword").innerText().catch(() => "")).trim();
  check("clicking a synonym/antonym chip navigates to its dictionary entry", landed.includes(`w=${target}`) && head.length > 0, `${target} → ${head}`);
} else {
  check("clicking a synonym/antonym chip navigates to its dictionary entry", false, "no syn/ant chip on heureux");
}

// 5c) The overview never shows empty "暂未收录" placeholders
let emptyHits = [];
for (const w of ["heureux", "actuel", "accueil"]) {
  await page.goto(BASE + `#/dict?w=${encodeURIComponent(w)}`);
  await page.waitForSelector(".dict-headword");
  await settle(page, 300);
  const panels = await page.locator(".dict-panels").innerText().catch(() => "");
  if (/暂未收录/.test(panels)) emptyHits.push(w);
}
check("dict overview hides empty sections (no 暂未收录 placeholders)", emptyHits.length === 0, emptyHits.join(", "));

// 5d) Conjugation deep link #/dict?w=prendre&tab=conj
await page.goto(BASE + "#/dict?w=prendre&tab=conj");
await page.waitForSelector(".conj-table", { timeout: 10000 }).catch(() => {});
check(
  "dict ?tab=conj deep link opens the conjugation table",
  /je\s+prends/.test(await page.locator(".conj-table").innerText().catch(() => "")) &&
    (await page.locator('.dict-tabs [role=tab][aria-selected="true"]').innerText().catch(() => "")).includes("动词变位"),
);

// 5e) Phone width: no horizontal overflow on a rich entry
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(BASE + "#/dict?w=heureux");
await page.waitForSelector(".dict-headword");
await settle(page, 500);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check("dict entry has no horizontal overflow at 390x844", overflow <= 1, `overflow ${overflow}px`);
await page.screenshot({ path: "output/e2e/dict-mobile.png", fullPage: false });
await page.setViewportSize({ width: 1280, height: 900 });

// 5f) Home never fetches related-word hint shards
hintRequests.length = 0;
await page.goto(BASE + "#/");
await settle(page, 800);
check("home loads zero lexdb/hints requests", hintRequests.length === 0, hintRequests.slice(0, 2).join(" "));

// 6) Read: existing token tap works and exposes 词典详情 →
await page.goto(BASE + "#/read");
await page.waitForSelector(".read-draft");
await page.locator(".read-draft").fill("Bonjour, je voudrais prendre un accueil chaleureux aujourd'hui.");
await page.getByRole("button", { name: "保存并阅读" }).click();
await page.waitForSelector(".reader-text .rw");
await settle(page);
await page.locator(".reader-text .rw", { hasText: /^accueil$/i }).first().click();
await page.waitForSelector(".reader-word");
const readerWordText = await page.locator(".reader-word").innerText();
check("Read token tap opens reader-word panel with 词典详情 link", /accueil/.test(readerWordText) && /词典详情/.test(readerWordText));

// 7) WordPopup selection on an Essay French paragraph
await page.goto(BASE + "#/practice");
await page.waitForSelector(".practice-exam-grid .mode-card");
await page.locator(".practice-exam-grid .mode-card", { hasText: /篇章写作/ }).click();
await page.waitForSelector(".essay-task.is-rec");
await page.locator(".essay-task.is-rec").click();
await page.waitForSelector(".essay-consigne");
await page.locator(".essay-consigne").scrollIntoViewIfNeeded();
const wordRect = await page.locator(".essay-consigne").evaluate((el) => {
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walk.nextNode())) {
    const txt = node.textContent || "";
    const m = txt.match(/répondez/i) || txt.match(/[A-Za-zÀ-ÿ]{4,}/);
    if (!m || m.index === undefined) continue;
    const r = document.createRange();
    r.setStart(node, m.index);
    r.setEnd(node, m.index + m[0].length);
    const rc = r.getBoundingClientRect();
    if (rc.width > 4 && rc.height > 4) {
      return { left: rc.left, right: rc.right, top: rc.top, height: rc.height, word: m[0] };
    }
  }
  return null;
});
if (wordRect) {
  const midY = wordRect.top + wordRect.height / 2;
  await page.mouse.move(wordRect.left + 1, midY);
  await page.mouse.down();
  await page.mouse.move(wordRect.right - 1, midY, { steps: 8 });
  await page.mouse.up();
}
await page.waitForSelector(".word-popup .word-popup-actions", { timeout: 6000 }).catch(() => {});
const popupText = await page.locator(".word-popup").innerText().catch(() => "");
const popupSenses = await page.locator(".word-popup .word-popup-senses").innerText().catch(() => "");
check(
  "WordPopup opens on Essay French paragraph selection with gloss and 词典详情 link",
  /加入生词本/.test(popupText) && /词典详情/.test(popupText) && popupSenses.trim().length > 0,
  popupText.replace(/\s+/g, " ").slice(0, 90),
);

// 8) Decks 自己添加 sanity check
await page.goto(BASE + "#/decks");
await page.waitForSelector(".deck-grid");
await page.locator(".deck-card", { hasText: "阅读生词" }).first().click();
await page.waitForSelector(".deck-add input");
await page.locator(".deck-add input").fill("testmotrare");
await page.waitForSelector(".deck-results-new");
await page.getByRole("button", { name: /自己添加「testmotrare」/ }).click();
await page.waitForSelector(".sheet .word-form");
await page.locator(".sheet .word-form label", { hasText: "中文意思" }).locator("input").fill("稀有测试词");
await page.locator('.sheet .word-form button[type="submit"]').click();
await page.waitForSelector(".sheet", { state: "detached", timeout: 5000 }).catch(() => {});
await settle(page);
const deckWordsText = await page.locator(".deck-words").innerText().catch(() => "");
check("Decks 自己添加 creates custom word in deck", /testmotrare/.test(deckWordsText) && /稀有测试词/.test(deckWordsText));

check("no uncaught page or console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
writeFileSync("output/e2e/lexdb-results.json", JSON.stringify(checks, null, 2));
await browser.close();
const failed = checks.filter((c) => !c.ok).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
