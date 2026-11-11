/* Functional check for lesson 3. */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

const LEX = JSON.parse(readFileSync("data/lexicon.json", "utf8")).entries;
const lexStatus = (id) => LEX.some((e) => e.id === id && e.senses.some((x) => x.status === "补充翻译·待核对"));
const BASE = process.env.FR_URL ?? "http://127.0.0.1:5190/";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
mkdirSync("output/lesson03", { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); };
const settle = (p, ms = 700) => p.waitForTimeout(ms);
const SEED = JSON.stringify({ onboarded: true, splash: false, theme: "dark", sfx: false, autoplay: false, dailyNew: 10 });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
await ctx.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("word-atlas:settings", s); sessionStorage.setItem("seeded", "1"); } }, SEED);
const page = await ctx.newPage();
const errors = [];
page.on("crash", () => { errors.push("PAGE CRASHED"); });
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

// 0) Atlas index contains lesson-3 words
await page.goto(BASE + "#/atlas"); await settle(page, 900);
const idx = await page.evaluate(async () => (await fetch("/atlas/index.json")).json());
const l3Head = ["rencontrer", "tomber amoureux de", "seul", "inviter", "embrasser", "s'embrasser", "passer la nuit", "faire l'amour", "relation", "célibataire", "vivre seul", "vivre avec", "appartement", "sortir avec", "passion", "se marier", "mariage civil", "mariage religieux", "mairie", "église", "fête", "robe de mariée", "homosexuel", "couple", "liaison", "pacs", "copain", "copine", "petit ami", "petite amie", "avoir un enfant", "vie de famille", "divorcer", "demander le divorce", "quitter", "séparation", "libre", "se disputer", "jaloux", "détester", "jolie", "dispute", "divorcé", "se remarier", "aimer bien", "affection", "grande amie", "relation amoureuse", "femme de sa vie", "aimer beaucoup", "adorer"];
const byLemma = Object.fromEntries(idx.words.map((w) => [w[1], w]));
const found = l3Head.filter((w) => byLemma[w]);
check("lesson-3 headwords in atlas index", found.length === l3Head.length, `${found.length}/${l3Head.length} missing=${l3Head.filter(w=>!byLemma[w]).join(",")}`);
const unt = idx.words.filter((w) => w[2] === "释义待补充" && l3Head.includes(w[1])).length;
check("lesson-3 headwords have gloss (no placeholder)", unt === 0, `placeholders=${unt}`);

// 1) Entry detail for two lesson-3 words
for (const id of ["rencontrer", "divorcer"]) {
  const row = byLemma[id] || idx.words.find((w) => w[1] === id);
  const slug = row ? row[0] : id;
  await page.goto(`${BASE}#/atlas?w=${encodeURIComponent(slug)}`); await page.waitForSelector(".sheet .headword", { timeout: 15000 });
  const text = await page.locator(".sheet").innerText();
  const head = (await page.locator(".sheet .headword").innerText()).trim();
  const hasGloss = /遇见|离婚/.test(text);
  const hasExample = /Gabriel|Mathilde/.test(text);
  const hasSource = /来源/.test(text) && /法语词汇渐进初级/.test(text);
  const hasPage = /印刷页 (18|20)/.test(text);
  const hasPlaceholder = /释义待补充/.test(text);
  check(`entry ${id}: gloss, example, source page`, hasGloss && hasExample && hasSource && hasPage && !hasPlaceholder, `head=${head} gloss=${hasGloss} ex=${hasExample} src=${hasSource} page=${hasPage} placeholder=${hasPlaceholder}`);
  await page.screenshot({ path: `output/lesson03/entry-${id}.png` });
}

// 2) Learning session: starts without crash, no placeholder text in questions
await page.goto(BASE + "#/"); await settle(page, 900);
await page.getByRole("button", { name: /开始今天的旅程|继续旅程/ }).first().click();
await page.waitForURL(/#\/learn/); await settle(page, 800);
const seen = new Set(); let intros = 0, quizzes = 0, placeholders = 0, answered = 0;
for (let i = 0; i < 120; i++) {
  if (await page.locator(".summary").count()) break;
  const body = await page.locator(".learn").count() ? await page.locator(".learn").first().innerText({ timeout: 1000 }).catch(() => "") : "";
  if (/释义待补充/.test(body)) placeholders++;
  if (await page.getByRole("button", { name: /认识了/ }).count()) { intros++; await page.getByRole("button", { name: /认识了/ }).first().click(); await settle(page, 120); continue; }
  if (await page.locator(".option").count()) { quizzes++; await page.locator(".option").first().click(); }
  else if (await page.locator(".spell-input").count()) { await page.locator(".spell-input").first().fill("zzz"); await page.keyboard.press("Enter"); }
  else { await settle(page, 150); continue; }
  const cont = page.getByRole("button", { name: /^继续/ }).first();
  if (await cont.count()) { answered++; await cont.click(); await settle(page, 100); }
  if (answered > 80) break;
}
await page.screenshot({ path: "output/lesson03/learn-end.png" });
check("learning session completes without crash", errors.length === 0, errors.join("; "));
check("no placeholder text in learning questions", placeholders === 0, `placeholders=${placeholders}`);
check("at least some quizzes seen", quizzes > 0, `intros=${intros} quizzes=${quizzes}`);

await browser.close();
writeFileSync("output/lesson03/verify.json", JSON.stringify({ checks: results, errors, timestamp: new Date().toISOString() }, null, 2) + "\n");
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
