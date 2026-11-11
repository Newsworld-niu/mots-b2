/* Functional check for lessons 6–10. */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
const BASE = process.env.FR_URL ?? "http://127.0.0.1:5190/";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
mkdirSync("output/lessons06-10", { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); };
const settle = (p, ms = 700) => p.waitForTimeout(ms);
const SEED = JSON.stringify({ onboarded: true, splash: false, theme: "dark", sfx: false, autoplay: false, dailyNew: 10 });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
await ctx.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("word-atlas:settings", s); sessionStorage.setItem("seeded", "1"); } }, SEED);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

// Atlas index
await page.goto(BASE + "#/atlas"); await settle(page, 900);
const idx = await page.evaluate(async () => (await fetch("/atlas/index.json")).json());
const byLemma = Object.fromEntries(idx.words.map((w) => [w[1], w]));

// Spot-check sample headwords from lessons 6-10
const samples = [
  ["tête", "头"], ["s'asseoir", "坐"], ["malade", "病"], ["beau", "帅"],
  ["s'habiller", "穿衣"], ["habiter", "住"]
];
let found = 0, missing = [];
for (const [w, hint] of samples) {
  const row = byLemma[w];
  if (row) found++;
  else missing.push(w);
}
check("lessons 6-10 sample headwords in atlas index", found === samples.length, `${found}/${samples.length} missing=${missing.join(",")}`);

// Entry detail for a lesson-10 word
const row = byLemma["habiter"] || idx.words.find((w) => w[1] === "habiter");
const slug = row ? row[0] : "habiter";
await page.goto(`${BASE}#/atlas?w=${encodeURIComponent(slug)}`); await page.waitForSelector(".sheet .headword", { timeout: 15000 });
const text = await page.locator(".sheet").innerText();
const hasGloss = /居住/.test(text);
const hasSource = /来源/.test(text) && /法语词汇渐进初级/.test(text);
check("entry habiter: gloss and source", hasGloss && hasSource, `gloss=${hasGloss} src=${hasSource}`);
await page.screenshot({ path: "output/lessons06-10/entry-habiter.png" });

// Learning session: completes without crash, no placeholder text in questions
await page.goto(BASE + "#/"); await settle(page, 900);
await page.getByRole("button", { name: /开始今天的旅程|继续旅程/ }).first().click();
await page.waitForURL(/#\/learn/); await settle(page, 800);
let placeholders = 0, quizzes = 0, answered = 0;
for (let i = 0; i < 60; i++) {
  if (await page.locator(".summary").count()) break;
  const body = await page.locator(".learn").count() ? await page.locator(".learn").first().innerText({ timeout: 1000 }).catch(() => "") : "";
  if (/释义待补充/.test(body)) placeholders++;
  if (await page.getByRole("button", { name: /认识了/ }).count()) { await page.getByRole("button", { name: /认识了/ }).first().click(); await settle(page, 120); continue; }
  if (await page.locator(".option").count()) { quizzes++; await page.locator(".option").first().click(); }
  else if (await page.locator(".spell-input").count()) { await page.locator(".spell-input").first().fill("zzz"); await page.keyboard.press("Enter"); }
  else { await settle(page, 150); continue; }
  const cont = page.getByRole("button", { name: /^继续/ }).first();
  if (await cont.count()) { answered++; await cont.click(); await settle(page, 100); }
  if (answered > 40) break;
}
await page.screenshot({ path: "output/lessons06-10/learn-end.png" });
check("learning session completes without crash", errors.length === 0, errors.join("; "));
check("no placeholder text in learning questions", placeholders === 0, `placeholders=${placeholders}`);
check("at least some quizzes seen", quizzes > 0, `quizzes=${quizzes}`);

await browser.close();
writeFileSync("output/lessons06-10/verify.json", JSON.stringify({ checks: results, errors, timestamp: new Date().toISOString() }, null, 2) + "\n");
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
