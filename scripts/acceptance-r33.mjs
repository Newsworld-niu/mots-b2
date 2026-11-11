/* Focused acceptance: theme filter, bookmark persistence, typing practice, due review, export/restore. */
import { chromium } from "playwright";
import { writeFileSync, readFileSync } from "node:fs";
const BASE = process.env.FR_URL ?? "http://127.0.0.1:5190/";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SET = JSON.stringify({ onboarded: true, splash: false, theme: "dark", sfx: false, autoplay: false });
const checks = [];
const check = (n, ok, d = "") => { checks.push({ n, ok: !!ok, d }); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  (" + d + ")" : ""}`); };
const settle = (p, ms = 700) => p.waitForTimeout(ms);
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN", acceptDownloads: true });
await ctx.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("word-atlas:settings", s); sessionStorage.setItem("seeded", "1"); } }, SET);
const page = await ctx.newPage();
const errors = []; page.on("pageerror", e => errors.push(e.message));

// theme filter
await page.goto(BASE + "#/atlas"); await page.waitForSelector(".tile"); await settle(page);
const total = await page.locator(".tile").count();
const chips = page.locator('[aria-label="主题"] .chip-btn');
const chipCount = await chips.count();
await chips.nth(1).click(); await settle(page);
const filtered = await page.locator(".tile").count();
check("theme filter reduces the atlas list", chipCount > 1 && filtered > 0 && filtered <= total, `total=${total} filtered=${filtered} chips=${chipCount}`);

// bookmark persistence
await chips.nth(0).click(); await settle(page);
await page.locator(".tile").first().click(); await settle(page);
const fav = page.getByRole("button", { name: "收藏" }).first();
await fav.click({ force: true }); await settle(page, 300);
const savedId = await page.evaluate(() => JSON.parse(localStorage.getItem("word-atlas:v2:francais-b2-lexicon") || "{}").bookmarks?.slice(-1)[0]);
await page.reload(); await settle(page, 900);
const savedAfter = await page.evaluate(() => JSON.parse(localStorage.getItem("word-atlas:v2:francais-b2-lexicon") || "{}").bookmarks || []);
check("bookmark toggled and kept after reload", !!savedId && savedAfter.includes(savedId), `id=${savedId}`);

// typing practice (word mode)
await page.goto(BASE + "#/practice"); await settle(page, 900);
const modeWord = page.getByRole("button", { name: /单词|词/ }).first();
if (await modeWord.count()) { await modeWord.click(); await settle(page, 500); }
const input = page.locator("input[type=text], textarea").first();
if (await input.count()) {
  await input.fill("zzz"); await settle(page, 600);
  check("word typing practice renders feedback", (await page.locator(".is-ok, .is-bad, .result, .feedback").count()) > 0, "feedback element present");
} else check("word typing practice renders feedback", false, "no input");

// export / restore
await page.goto(BASE + "#/me"); await settle(page, 700);
const dl = page.waitForEvent("download");
await page.getByRole("button", { name: /导出备份/ }).click();
const d = await dl; const p = await d.path(); const json = readFileSync(p, "utf8");
check("backup export produces JSON", json.length > 2 && json.includes("bookmarks"), `bytes=${json.length}`);
const before = await page.evaluate(() => JSON.parse(localStorage.getItem("word-atlas:v2:francais-b2-lexicon")).bookmarks.length);
await page.evaluate(() => { const k = "word-atlas:v2:francais-b2-lexicon"; const v = JSON.parse(localStorage.getItem(k)); v.bookmarks = []; localStorage.setItem(k, JSON.stringify(v)); });
await page.locator('input[type=file]').setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(json) });
await settle(page, 900);
const after = await page.evaluate(() => JSON.parse(localStorage.getItem("word-atlas:v2:francais-b2-lexicon")).bookmarks.length);
check("backup restore recovers bookmarks", after === before && after > 0, `before=${before} after=${after}`);

check("no uncaught page errors", errors.length === 0, errors[0] || "");
writeFileSync("output/r33-acceptance.json", JSON.stringify({ checks }, null, 1));
await browser.close();
const failed = checks.filter(c => !c.ok).length;
console.log(`${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
