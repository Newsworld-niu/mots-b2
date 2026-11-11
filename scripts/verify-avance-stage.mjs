/* Representative check after the avancé stage: entry detail + learning + progress save. */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
const BASE = process.env.FR_URL ?? "http://127.0.0.1:5190/";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = "output/avance-stage"; mkdirSync(OUT, { recursive: true });
const results = [];
const check = (n, ok, d = "") => { results.push({ name: n, ok: !!ok, detail: d }); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); };
const settle = (p, ms = 700) => p.waitForTimeout(ms);
const SEED = JSON.stringify({ onboarded: true, splash: false, theme: "dark", sfx: false, autoplay: false, dailyNew: 10 });
const KEY = "word-atlas:v2:francais-b2-lexicon";
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
await ctx.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("word-atlas:settings", s); sessionStorage.setItem("seeded", "1"); } }, SEED);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(BASE + "#/atlas"); await settle(page, 900);
const idx = await page.evaluate(async () => (await fetch("/atlas/index.json")).json());
const byLemma = Object.fromEntries(idx.words.map((w) => [w[1], w]));
for (const w of ["ambassadeur", "scénariste", "polluer", "sceptique"]) {
  const row = byLemma[w];
  if (!row) { check(`entry ${w}`, false, "not in index"); continue; }
  await page.goto(`${BASE}#/atlas?w=${encodeURIComponent(row[0])}`);
  await page.waitForSelector(".sheet .headword", { timeout: 15000 }).catch(() => {});
  const t = await page.locator(".sheet").innerText().catch(() => "");
  check(`entry ${w}: gloss + source`, row[2] !== "释义待补充" && /法语词汇渐进/.test(t), `zh=${row[2].slice(0,10)}`);
}
await page.screenshot({ path: `${OUT}/entry.png` });

const before = await page.evaluate((k) => localStorage.getItem(k), KEY);
const cardsBefore = before ? Object.keys(JSON.parse(before).cards ?? {}).length : 0;
await page.goto(BASE + "#/"); await settle(page, 900);
await page.getByRole("button", { name: /开始今天的旅程|继续旅程/ }).first().click();
await page.waitForURL(/#\/learn/); await settle(page, 800);
let placeholders = 0, quizzes = 0, answered = 0;
for (let i = 0; i < 80; i++) {
  if (await page.locator(".summary").count()) break;
  const body = await page.locator(".learn").count() ? await page.locator(".learn").first().innerText({ timeout: 1000 }).catch(() => "") : "";
  if (/释义待补充/.test(body)) placeholders++;
  if (await page.getByRole("button", { name: /认识了/ }).count()) { await page.getByRole("button", { name: /认识了/ }).first().click(); await settle(page, 120); continue; }
  if (await page.locator(".option").count()) { quizzes++; await page.locator(".option").first().click(); }
  else if (await page.locator(".spell-input").count()) { await page.locator(".spell-input").first().fill("zzz"); await page.keyboard.press("Enter"); }
  else { await settle(page, 150); continue; }
  const cont = page.getByRole("button", { name: /^继续/ }).first();
  if (await cont.count()) { answered++; await cont.click(); await settle(page, 100); }
  if (answered > 50) break;
}
await page.screenshot({ path: `${OUT}/learn-end.png` });
await settle(page, 500);
const after = await page.evaluate((k) => localStorage.getItem(k), KEY);
const cardsAfter = after ? Object.keys(JSON.parse(after).cards ?? {}).length : 0;
check("learning completes without crash", errors.length === 0, errors.join("; ").slice(0, 200));
check("no placeholder in learning", placeholders === 0, `placeholders=${placeholders}`);
check("quizzes answered", quizzes > 0 && answered > 0, `quizzes=${quizzes} answered=${answered}`);
check("progress saved", cardsAfter > 0 && cardsAfter >= cardsBefore, `cards ${cardsBefore}→${cardsAfter}`);
await browser.close();
writeFileSync(`${OUT}/verify.json`, JSON.stringify({ checks: results, errors, timestamp: new Date().toISOString() }, null, 2) + "\n");
const failed = results.filter((r) => !r.ok).length;
console.log(`summary: ${results.length - failed}/${results.length} passed`);
process.exitCode = failed ? 1 : 0;
