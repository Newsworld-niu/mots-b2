/* Functional check for lesson 1: entry detail, learning session, review session.
 * Needs the dev server (FR_URL, default http://127.0.0.1:5190/) and the local Chrome. Writes output/lesson01/. */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
const LEX = JSON.parse(readFileSync("data/lexicon.json", "utf8")).entries;
const lexStatus = (id) => LEX.some((e) => e.id === id && e.senses.some((x) => x.status === "补充翻译·待核对"));
const BASE = process.env.FR_URL ?? "http://127.0.0.1:5190/";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
mkdirSync("output/lesson01", { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); };
const settle = (p, ms = 700) => p.waitForTimeout(ms);
const SEED = JSON.stringify({ onboarded: true, splash: false, theme: "dark", sfx: false, autoplay: false, dailyNew: 10 });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
await ctx.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("word-atlas:settings", s); sessionStorage.setItem("seeded", "1"); } }, SEED);
const page = await ctx.newPage();
const errors = [];
page.on("crash", () => { errors.push("PAGE CRASHED"); console.log("!! page crashed"); });
page.on("close", () => console.log("!! page closed"));
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

// 0) lesson-1 words are in the generated atlas
await page.goto(BASE + "#/atlas"); await settle(page, 900);
const idx = await page.evaluate(async () => (await fetch("/atlas/index.json")).json());
const lesson = ["bonjour", "bisou", "madame", "présenter", "bise", "bonne", "bisou"].filter((w, i, a) => a.indexOf(w) === i);
const byLemma = Object.fromEntries(idx.words.map((w) => [w[1], w]));
const found = ["bonjour", "bisou", "madame", "présenter", "bise", "joue", "anniversaire", "examen", "voyage"].filter((w) => byLemma[w]);
check("lesson-1 headwords are in the atlas index", found.length === 9, `${found.length}/9`);
const unt = idx.words.filter((w) => w[2] === "释义待补充" && found.includes(w[1])).length;
check("lesson-1 headwords carry a translated gloss (none placeholder)", unt === 0, `placeholders=${unt}`);

// 1) entry detail for bisou and madame
const detail = {};
for (const id of ["bisou", "madame"]) {
  const row = byLemma[id] || idx.words.find((w) => w[1] === id);
  const slug = row ? row[0] : id;
  await page.goto(`${BASE}#/atlas?w=${encodeURIComponent(slug)}`); await page.waitForSelector(".sheet .headword", { timeout: 15000 });
  const text = await page.locator(".sheet").innerText();
  detail[id] = {
    headword: (await page.locator(".sheet .headword").innerText()).trim(),
    gloss: /亲吻|女士/.test(text),
    statusInData: lexStatus(id),
    labelHiddenInUi: !/补充翻译·待核对|补充释义/.test(text),
    example: /Bonjour|bisou|madame/.test(text),
    source: /来源/.test(text) && /Débutant|法语词汇渐进初级/.test(text),
    page: /印刷页 (6|8|10|12)/.test(text),
    placeholder: /释义待补充/.test(text),
  };
  await page.screenshot({ path: `output/lesson01/entry-${id}.png` });
  check(`entry ${id}: gloss, status kept in data, label hidden in UI, example, source page`, detail[id].gloss && detail[id].statusInData && detail[id].labelHiddenInUi && detail[id].example && detail[id].source && detail[id].page && !detail[id].placeholder, JSON.stringify(detail[id]));
}

// 2) learning session: lesson-1 words are taught; no placeholder reaches a question
await page.goto(BASE + "#/"); await settle(page, 900);
await page.getByRole("button", { name: /开始今天的旅程|继续旅程/ }).first().click();
await page.waitForURL(/#\/learn/); await settle(page, 800);
const seen = new Set(); let intros = 0, quizzes = 0, placeholders = 0, optionCount = [], answered = 0;
for (let i = 0; i < 300; i++) {
  if (await page.locator(".summary").count()) break;
  const wordLoc = page.locator(".step-word, .prompt-word, .spell-word");
  const word = (await wordLoc.count()) ? (await wordLoc.first().innerText({ timeout: 1000 }).catch(() => "")).trim() : "";
  if (word) seen.add(word);
  const bodyText = (await page.locator(".learn").count()) ? await page.locator(".learn").first().innerText({ timeout: 1000 }).catch(() => "") : "";
  if (/释义待补充/.test(bodyText)) placeholders++;
  if (await page.getByRole("button", { name: /认识了/ }).count()) { intros++; await page.getByRole("button", { name: /认识了/ }).first().click(); await settle(page, 120); continue; }
  if (await page.locator(".option").count()) {
    quizzes++; optionCount.push(await page.locator(".option").count());
    await page.locator(".option").first().click();
  } else if (await page.locator(".spell-input").count()) {
    await page.locator(".spell-input").first().fill("zzz"); await page.keyboard.press("Enter");
  } else { await settle(page, 150); }
  const cont = page.getByRole("button", { name: /^继续/ }).first();
  if (await cont.count()) { answered++; await cont.click(); await settle(page, 100); }
  if (answered > 150) break;
}
await page.screenshot({ path: "output/lesson01/learn-end.png" });
const lessonWordsSeen = [...seen].filter((w) => ["bonjour", "bisou", "madame", "présenter", "bise", "joue"].includes(w));
check("learning session completes with quiz steps", await page.locator(".summary").count() === 1 && answered > 0, `intros=${intros} quizzes=${quizzes} answered=${answered}`);
check("no 释义待补充 text inside any learning step", placeholders === 0, `placeholders=${placeholders}`);
check("every quiz offers 4 options", optionCount.every((n) => n === 4) && optionCount.length > 0, `options=${[...new Set(optionCount)]}`);
check("lesson-1 words appear in the session", lessonWordsSeen.length > 0, `seen=${[...seen].slice(0, 12).join(",")}`);
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("word-atlas:v2:francais-b2-lexicon") || "null"));
const cardIds = Object.keys(stored?.cards || {});
check("learning progress written to localStorage", cardIds.length > 0, `cards=${cardIds.length}`);
await page.getByRole("button", { name: /回到今日|完成/ }).first().click().catch(() => null);
await settle(page, 600);

// 3) review: make the lesson-1 cards due and run a review session
await page.evaluate(() => {
  const k = "word-atlas:v2:francais-b2-lexicon";
  const d = JSON.parse(localStorage.getItem(k));
  for (const [id, c] of Object.entries(d.cards)) { c.due = Date.now() - 60000; c.st = 2; c.s = Math.max(c.s, 5); }
  localStorage.setItem(k, JSON.stringify(d));
});
await page.reload(); await settle(page, 1000);
await page.getByRole("button", { name: /开始今天的旅程|继续旅程/ }).first().click().catch(() => null);
await page.waitForURL(/#\/learn/, { timeout: 15000 }).catch(() => null); await settle(page, 800);
let reviewQ = 0, reviewAns = 0;
for (let i = 0; i < 200; i++) {
  if (await page.locator(".summary").count()) break;
  if (await page.getByRole("button", { name: /认识了/ }).count()) { await page.getByRole("button", { name: /认识了/ }).first().click(); await settle(page, 100); continue; }
  if (await page.locator(".option").count()) { reviewQ++; await page.locator(".option").first().click(); }
  else if (await page.locator(".spell-input").count()) { reviewQ++; await page.locator(".spell-input").first().fill("zzz"); await page.keyboard.press("Enter"); }
  else { await settle(page, 150); }
  const cont = page.getByRole("button", { name: /^继续/ }).first();
  if (await cont.count()) { reviewAns++; await cont.click(); await settle(page, 100); }
  if (reviewAns > 120) break;
}
check("review session asks questions on due cards and finishes", reviewQ > 0 && await page.locator(".summary").count() === 1, `questions=${reviewQ} answered=${reviewAns}`);
const after = await page.evaluate(() => JSON.parse(localStorage.getItem("word-atlas:v2:francais-b2-lexicon")));
check("review updates the schedule (due moved into the future)", Object.values(after.cards).some((c) => c.due > Date.now()), `future=${Object.values(after.cards).filter((c) => c.due > Date.now()).length}`);
check("no uncaught page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
writeFileSync("output/lesson01/verify.json", JSON.stringify({ at: new Date().toISOString(), detail, results, errors }, null, 1));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} lesson-1 checks passed`);
process.exit(failed ? 1 : 0);
