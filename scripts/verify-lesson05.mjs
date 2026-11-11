/* Quick functional check for lesson 5. */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
const BASE = process.env.FR_URL ?? "http://127.0.0.1:5190/";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
mkdirSync("output/lesson05", { recursive: true });
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
const l5Head = ["conversation", "raconter", "prononciation", "discuter", "invitation", "allô", "joindre", "SMS", "erreur"];
const byLemma = Object.fromEntries(idx.words.map((w) => [w[1], w]));
const found = l5Head.filter((w) => byLemma[w]);
check("lesson-5 sample headwords in atlas index", found.length === l5Head.length, `${found.length}/${l5Head.length} missing=${l5Head.filter(w=>!byLemma[w]).join(",")}`);

// Entry detail
for (const id of ["raconter", "invitation"]) {
  const row = byLemma[id] || idx.words.find((w) => w[1] === id);
  const slug = row ? row[0] : id;
  await page.goto(`${BASE}#/atlas?w=${encodeURIComponent(slug)}`); await page.waitForSelector(".sheet .headword", { timeout: 15000 });
  const text = await page.locator(".sheet").innerText();
  const hasGloss = /讲述|邀请/.test(text);
  const hasSource = /来源/.test(text) && /法语词汇渐进初级/.test(text);
  check(`entry ${id}: gloss and source`, hasGloss && hasSource, `gloss=${hasGloss} src=${hasSource}`);
  await page.screenshot({ path: `output/lesson05/entry-${id}.png` });
}

// Learning session
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
await page.screenshot({ path: "output/lesson05/learn-end.png" });
check("learning session completes without crash", errors.length === 0, errors.join("; "));
check("no placeholder text in learning questions", placeholders === 0, `placeholders=${placeholders}`);
check("at least some quizzes seen", quizzes > 0, `quizzes=${quizzes}`);

await browser.close();
writeFileSync("output/lesson05/verify.json", JSON.stringify({ checks: results, errors, timestamp: new Date().toISOString() }, null, 2) + "\n");
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
