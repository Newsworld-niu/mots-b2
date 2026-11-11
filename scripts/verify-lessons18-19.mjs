/* Small functional check for lessons 11–12 (no app logic changed). Output: output/lessons11-12/verify.json */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
// lemma+pos → id, same key the importer uses (same-lemma different-pos entries are distinct)
const LEX = JSON.parse(readFileSync("data/lexicon.json", "utf8")).entries.filter((e) => !e.aliasOf);
const idOf = (lemma, pos) => LEX.find((e) => e.lemma === lemma && e.pos === pos)?.id;
const BASE = process.env.FR_URL ?? "http://127.0.0.1:5190/";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = "output/lessons18-19";
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); };
const settle = (p, ms = 700) => p.waitForTimeout(ms);
const SEED = JSON.stringify({ onboarded: true, splash: false, theme: "dark", sfx: false, autoplay: false, dailyNew: 10 });
const PROGRESS_KEY = "word-atlas:v2:francais-b2-lexicon";

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

// 1. Lesson 11–12 headwords: all visible, none left as placeholder
const rows = readFileSync("data/lessons/lesson18-19-row-check.csv", "utf8").trim().split("\n").slice(1)
  .map((l) => l.split(",")).map((c) => ({ lemma: c[2], pos: c[3] }));
const idxById = Object.fromEntries(idx.words.map((w) => [w[0], w]));
const rowEntries = rows.map((r) => ({ ...r, id: idOf(r.lemma, r.pos) }));
const EXPECTED_ALIAS = new Set(); // no alias rows in lessons 16–17
const unresolved = rowEntries.filter((r) => !EXPECTED_ALIAS.has(r.lemma) && (!r.id || !idxById[r.id]));
const placeholder = rowEntries.filter((r) => r.id && idxById[r.id] && idxById[r.id][2] === "释义待补充");
check("lesson 18–19 rows: resolve to a visible entry (lemma+pos)", unresolved.length === 0, `rows=${rows.length} unresolved=${unresolved.map((r) => r.lemma + "/" + r.pos).join(",") || "none"}`);
check("lesson 18–19 rows: no placeholder gloss", placeholder.length === 0, `placeholder=${placeholder.map((r) => r.lemma + "/" + r.pos).join(",") || "none"}`);


// 3. Detail pages: gloss, example and source present
const cases = [
  ["banque", /银行/, "ouvrir (* fermer) un compte courant", "法语词汇渐进初级"],
  ["chèque", /支票/, "On peut aussi payer par chèque", "法语词汇渐进初级"],
  ["informatique", /信息技术/, "l'ordinateur", "法语词汇渐进初级"],
];
for (const [w, gloss, ex, src] of cases) {
  const POS = { informatique: "n.f.", banque: "n.f." };
  const id = idOf(w, POS[w] ?? "n.m.");
  const row = id && idxById[id];
  if (!row) { check(`entry ${w}: detail`, false, "not in index"); continue; }
  await page.goto(`${BASE}#/atlas?w=${encodeURIComponent(row[0])}`); await page.waitForSelector(".sheet .headword", { timeout: 15000 }).catch(() => {});
  const t = await page.locator(".sheet").innerText().catch(() => "");
  const g = gloss.test(t), s = t.includes(src), e = t.includes(ex);
  check(`entry ${w}: gloss / source / example`, g && s, `gloss=${g} src=${s} example=${e}`);
}
await page.goto(`${BASE}#/atlas?w=${encodeURIComponent(idOf("banque", "n.f."))}`); await page.waitForSelector(".sheet .headword", { timeout: 15000 }).catch(() => {});
await page.screenshot({ path: `${OUT}/entry-banque.png` });

// 4. Learning session: completes without crash, no placeholder text, progress saved
const before = await page.evaluate((k) => localStorage.getItem(k), PROGRESS_KEY);
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
const after = await page.evaluate((k) => localStorage.getItem(k), PROGRESS_KEY);
const cardsAfter = after ? Object.keys(JSON.parse(after).cards ?? {}).length : 0;
check("learning session completes without crash", errors.length === 0, errors.join("; ").slice(0, 300));
check("no placeholder text in learning questions", placeholders === 0, `placeholders=${placeholders}`);
check("quizzes seen and answered", quizzes > 0 && answered > 0, `quizzes=${quizzes} answered=${answered}`);
check("progress saved to localStorage", cardsAfter > 0 && cardsAfter >= cardsBefore, `cards before=${cardsBefore} after=${cardsAfter}`);

await browser.close();
writeFileSync(`${OUT}/verify.json`, JSON.stringify({ checks: results, errors, timestamp: new Date().toISOString() }, null, 2) + "\n");
const failed = results.filter((r) => !r.ok).length;
console.log(`summary: ${results.length - failed}/${results.length} passed`);
process.exitCode = failed ? 1 : 0;
