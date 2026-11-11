/* Browser check of the alias migration (four cases), the old-link redirect, the ami/amie display,
 * and a practical collect → review round for the migrated word. Writes output/alias/verify.json. */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
const BASE = process.env.FR_URL ?? "http://127.0.0.1:5190/";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const KEY = "word-atlas:v2:francais-b2-lexicon";
mkdirSync("output/alias", { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); };
const card = (reps, due = Date.now() + 9 * 86400000) => ({ due, s: 9, d: 5, el: 2, sd: 7, ls: 0, reps, lapses: 0, st: 2, seen: Date.now() - 86400000 * 30 });
const progress = (over) => ({ version: 2, datasetId: "francais-b2-lexicon", cards: {}, bookmarks: [], days: {}, typing: [], session: null, mistakes: [], ...over });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });

async function open(seed) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
  await ctx.addInitScript((payload) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("word-atlas:settings", JSON.stringify({ onboarded: true, splash: false, theme: "dark", sfx: false, autoplay: false, dailyNew: 10 }));
      if (payload) localStorage.setItem("word-atlas:v2:francais-b2-lexicon", payload);
      sessionStorage.setItem("seeded", "1");
    }
  }, seed ? JSON.stringify(seed) : null);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, errors };
}
const stored = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), KEY);
const snapshots = (page) => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("word-atlas:snapshot:francais-b2-lexicon:")).length);

// A — only the alias has a record (with a bookmark and a mistake)
{
  const { ctx, page, errors } = await open(progress({ cards: { "ami-m": card(4) }, bookmarks: ["ami-m"], mistakes: ["ami-m"] }));
  await page.goto(BASE + "#/"); await page.waitForTimeout(1200);
  const p = await stored(page);
  check("A only-alias: record moved to ami-2", p.cards["ami-2"]?.reps === 4 && !p.cards["ami-m"], `cards=${Object.keys(p.cards)}`);
  check("A only-alias: bookmark and mistake re-pointed", p.bookmarks.join() === "ami-2" && p.mistakes.join() === "ami-2", `bm=${p.bookmarks} mi=${p.mistakes}`);
  check("A only-alias: snapshot of the pre-migration state kept", (await snapshots(page)) === 1);
  // old link opens the primary entry
  await page.goto(BASE + "#/atlas?w=ami-m"); await page.waitForSelector(".sheet .headword", { timeout: 15000 }); await page.waitForTimeout(500);
  const url = page.url(); const sheet = await page.locator(".sheet").innerText();
  check("A old link #/atlas?w=ami-m redirects to ami-2", /w=ami-2/.test(url), url.split("#")[1]);
  check("A detail shows the masculine / feminine pair (ami / amie)", /阳性\s*ami/.test(sheet) && /阴性\s*amie/.test(sheet) && /复数\s*amis/.test(sheet));
  check("A detail shows no article-based form (no 'une ami')", !/une ami\b/i.test(sheet));
  check("A bookmark state carried over (saved)", (await page.locator(".sheet .icon-btn[aria-pressed='true']").count()) >= 1);
  // practical round: make the migrated card due, review it, check the history is kept
  await page.evaluate((k) => { const d = JSON.parse(localStorage.getItem(k)); d.cards["ami-2"].due = Date.now() - 60000; localStorage.setItem(k, JSON.stringify(d)); }, KEY);
  await page.keyboard.press("Escape"); await page.goto(BASE + "#/"); await page.waitForTimeout(900);
  await page.getByRole("button", { name: /开始今天的旅程|继续旅程|只复习/ }).first().click().catch(() => null);
  await page.waitForURL(/#\/learn/, { timeout: 15000 }).catch(() => null); await page.waitForTimeout(800);
  let answered = 0;
  for (let i = 0; i < 80 && !(await page.locator(".summary").count()); i++) {
    if (await page.getByRole("button", { name: /认识了/ }).count()) { await page.getByRole("button", { name: /认识了/ }).first().click(); await page.waitForTimeout(150); continue; }
    if (await page.locator(".option").count()) await page.locator(".option").first().click();
    else if (await page.locator(".spell-input").count()) { await page.locator(".spell-input").first().fill("zzz"); await page.keyboard.press("Enter"); }
    else { await page.waitForTimeout(150); }
    const c = page.getByRole("button", { name: /^继续/ }).first();
    if (await c.count()) { answered++; await c.click(); await page.waitForTimeout(120); }
  }
  const after = await stored(page);
  check("A review round completed and history kept (reps not lost)", (after.cards["ami-2"]?.reps ?? 0) >= 4 && answered > 0, `reps=${after.cards["ami-2"]?.reps} answered=${answered}`);
  check("A no uncaught page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
  // D — run again on the same storage: nothing changes, no second snapshot
  const snapBefore = JSON.stringify(after.cards);
  const { ctx: c2, page: p2 } = await open(after);
  await p2.goto(BASE + "#/"); await p2.waitForTimeout(1000);
  const again = await stored(p2);
  check("D repeated migration changes nothing", JSON.stringify(again.cards) === snapBefore);
  await c2.close();
}
// B — only the primary has a record
{
  const { ctx, page } = await open(progress({ cards: { "ami-2": card(2) } }));
  await page.goto(BASE + "#/"); await page.waitForTimeout(1200);
  const p = await stored(page);
  check("B only-primary: unchanged, no snapshot", p.cards["ami-2"]?.reps === 2 && (await snapshots(page)) === 0);
  await ctx.close();
}
// C — both have a record: primary kept, alias archived, nothing added up
{
  const { ctx, page } = await open(progress({ cards: { "ami-2": card(3, Date.now() + 2 * 86400000), "ami-m": card(9, Date.now() + 40 * 86400000) } }));
  await page.goto(BASE + "#/"); await page.waitForTimeout(1200);
  const p = await stored(page);
  check("C both: primary kept as-is (reps 3, not 12)", p.cards["ami-2"]?.reps === 3);
  check("C both: alias record archived, not merged", p.aliasArchive?.["ami-m"]?.reps === 9 && !p.cards["ami-m"]);
  check("C both: conflict snapshot kept", (await snapshots(page)) === 1);
  await ctx.close();
}
await browser.close();
writeFileSync("output/alias/verify.json", JSON.stringify({ at: new Date().toISOString(), results }, null, 1));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} alias checks passed`);
process.exit(failed ? 1 : 0);
