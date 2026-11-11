/* Browser checks for the French edition against a running server (FR_URL, default http://127.0.0.1:5190/).
 * Uses the installed Google Chrome. Writes screenshots and a JSON log to output/. */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.FR_URL ?? "http://127.0.0.1:5190/";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
mkdirSync("output/e2e", { recursive: true });
const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const SETTINGS = JSON.stringify({ onboarded: true, splash: false, theme: "dark", sfx: false, autoplay: false });
const settle = (p, ms = 900) => p.waitForTimeout(ms);

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
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

// 1) Atlas data loads from the generated lexicon
await page.goto(BASE + "#/atlas");
await page.waitForSelector(".tile");
const expectCount = JSON.parse(await (await fetch(BASE + "atlas/index.json")).text()).count;
await settle(page, 400);
check("atlas lists every lexicon entry", (await page.getByText(`${expectCount.toLocaleString("en-US")} 个结果`).count()) === 1, `expected ${expectCount}`);
const idx = await page.evaluate(async () => (await fetch("/atlas/index.json")).json());
check("index.json carries the French dataset id", idx.id === "francais-b2-lexicon", idx.id);

// 2) Level filter exposes 等级待核实
await page.getByRole("button", { name: "A1", exact: true }).first().click();
await settle(page, 300);
const a1 = idx.words.filter((w) => w[4] === 0).length;
check("level filter A1 shows the estimated A1 words from index.json", (await page.getByText(`${a1.toLocaleString("en-US")} 个结果`).count()) === 1, `A1 words=${a1}`);
await page.getByRole("button", { name: "等级待核实", exact: true }).first().click();
await settle(page, 300);
const unv = idx.words.filter((w) => w[4] === 6).length;
check("level filter 等级待核实 shows the words with no estimate", (await page.getByText(`${unv.toLocaleString("en-US")} 个结果`).count()) === 1, `unverified=${unv}`);

// 3) Entry sheet shows sources, and the supplement / unreviewed markers
await page.goto(BASE + "#/atlas?w=entretien");
await page.waitForSelector(".sheet .headword");
const sheetText = await page.locator(".sheet").innerText();
check("entry sheet shows 来源 with 补充内容", /来源/.test(sheetText) && /补充内容/.test(sheetText));
check("entry sheet shows 推定 level (lowest source band) with its basis", /推定 (A1|A2|B1|B2)/.test(sheetText) && /等级依据/.test(sheetText));
check("entry sheet marks unreviewed content", /尚未逐条对照原书核实/.test(sheetText));
await page.screenshot({ path: "output/e2e/entry-sheet.png" });
await page.keyboard.press("Escape");

// 4) Learning session: intro cards, quiz kinds, summary, progress persisted
await page.goto(BASE + "#/");
await page.getByRole("button", { name: /开始今天的旅程/ }).click();
await page.waitForURL(/#\/learn/);
await settle(page, 600);
await page.screenshot({ path: "output/e2e/learn-first-step.png" });
let answered = 0, intros = 0;
const kinds = new Set();
for (let i = 0; i < 300; i++) {
  if (await page.locator(".summary").count()) break;
  const introBtn = page.getByRole("button", { name: /认识了/ }).first();
  if (await introBtn.count()) {
    intros++;
    await introBtn.click();
    await settle(page, 150);
    continue;
  }
  if (await page.locator(".option").count()) {
    kinds.add("option");
    await page.locator(".option").first().click();
  } else if (await page.locator(".spell-input").count()) {
    kinds.add("spell");
    await page.locator(".spell-input").first().fill("zzz");
    await page.keyboard.press("Enter");
  } else { await settle(page, 200); }
  const cont = page.getByRole("button", { name: /^继续/ }).first();
  if (await cont.count()) {
    answered++;
    await cont.click();
    await settle(page, 120);
  }
  if (answered > 200) break;
}
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("word-atlas:v2:francais-b2-lexicon") || "null"));
check("learning session runs and saves progress", answered > 0 && stored && Object.keys(stored.cards || {}).length > 0, `answered=${answered} intros=${intros} cards=${Object.keys(stored?.cards || {}).length}`);
check("progress stored under word-atlas:v2:francais-b2-lexicon", stored?.datasetId === "francais-b2-lexicon");

// 5) Practice: typing a French sentence is scored with accents respected
await page.goto(BASE + "#/practice");
await settle(page, 700);
check("practice page renders its own heading", (await page.getByText("让手，也记住它们").count()) === 1);
await page.screenshot({ path: "output/e2e/practice.png" });

// 6) Migration: a prototype payload (mots-b2:v1) is carried over on first load
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
const legacy = {
  progress: {
    version: 1,
    cards: {
      entretien: { due: Date.now() + 86400000 * 3, s: 9, d: 4, el: 2, sd: 6, ls: 0, reps: 4, lapses: 0, st: 2, seen: Date.now() - 86400000 * 30, last: Date.now() - 86400000 },
      pollution: { due: Date.now() - 1000, s: 0.5, d: 6, el: 0, sd: 0, ls: 2, reps: 1, lapses: 1, st: 1, seen: Date.now() - 86400000 * 2 },
    },
    bookmarks: ["entretien"],
    days: {},
    typing: [],
    session: null,
    mistakes: ["pollution"],
  },
  settings: { dailyNew: 12, retention: 0.9, autoplay: true, spell: true, theme: "dark" },
};
await ctx2.addInitScript((payload) => {
  if (!sessionStorage.getItem("legacy-seeded")) {
    localStorage.setItem("mots-b2:v1", payload);
    localStorage.setItem("word-atlas:settings", JSON.stringify({ onboarded: true, splash: false, theme: "dark", sfx: false }));
    sessionStorage.setItem("legacy-seeded", "1");
  }
}, JSON.stringify(legacy));
const p2 = await ctx2.newPage();
await p2.goto(BASE + "#/me");
await settle(p2, 1200);
const migrated = await p2.evaluate(() => JSON.parse(localStorage.getItem("word-atlas:v2:francais-b2-lexicon") || "null"));
check("legacy prototype cards are migrated to v2 storage", Object.keys(migrated?.cards || {}).length === 2, `cards=${Object.keys(migrated?.cards || {}).length}`);
check("migrated bookmark and mistake are kept", migrated?.bookmarks?.[0] === "entretien" && migrated?.mistakes?.[0] === "pollution");
check("migrated reps survive the v2 validator", migrated?.cards?.entretien?.reps === 4 && migrated?.cards?.entretien?.s === 9);
check("migrated card ids still exist in the atlas with the same lemma", idx.words.some((w) => w[0] === "entretien" && w[1] === "entretien") && idx.words.some((w) => w[0] === "pollution" && w[1] === "pollution"));
await p2.goto(BASE + "#/");
await settle(p2, 1000);
const learnedText = await p2.locator(".mini-stats").first().innerText().catch(() => "");
check("Today shows the migrated words as learned", /2/.test(learnedText), learnedText.replace(/\s+/g, " ").slice(0, 80));
await p2.screenshot({ path: "output/e2e/today-migrated.png" });
await ctx2.close();

// 7) Noun articles, the un/une drill and the 变位 section
await page.goto(BASE + "#/atlas?w=maison");
await page.waitForSelector(".sheet .headword");
check("noun sheet shows its indefinite article (une maison)", (await page.locator(".sheet .headword .art").first().textContent()) === "une");
await page.keyboard.press("Escape");
await page.goto(BASE + "#/practice");
await settle(page, 500);
await page.getByRole("button", { name: /冠词/ }).click();
await page.getByRole("button", { name: "学习路线" }).click();
await page.getByRole("button", { name: "开始一轮" }).click();
await settle(page, 400);
check("un/une drill starts with two article buttons", (await page.locator(".options-gender .option").count()) === 2);
await page.goto(BASE + "#/conj");
await page.waitForSelector(".conj-stats");
check("变位 section lists the verbs learned in the session above", !/可练动词\s*0/.test(await page.locator(".conj-stats").innerText()));
await page.goto(BASE + "#/atlas?w=etre");
await page.waitForSelector(".sheet .headword");
await page.locator(".conj-entry summary").click();
await page.getByRole("tab", { name: "imparfait" }).click();
check("verb sheet shows conjugation tables (j'étais)", (await page.locator(".conj-entry .conj-table").innerText()).replace(/\s+/g, " ").trim().startsWith("j'étais"));
await page.keyboard.press("Escape");

check("no uncaught page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
writeFileSync("output/e2e/results.json", JSON.stringify(checks, null, 2));
await browser.close();
const failed = checks.filter((c) => !c.ok).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
