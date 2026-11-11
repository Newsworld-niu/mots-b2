/* End-to-end check against a running preview server (npm run preview -- --port 5191).
 * Uses the locally installed Google Chrome via playwright-core; writes screenshots to output/. */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:5191/";
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
mkdirSync("output", { recursive: true });

const checks = [];
/** Screenshot after entrance animations settle. */
const shot = async (p, path, opts = {}) => {
  await p.waitForTimeout(800);
  await p.screenshot({ path, ...opts });
};
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));

// 1. Today page
await page.goto(BASE);
await page.waitForSelector(".journey");
check("today page renders journey card", await page.locator(".journey").count() === 1);
check("9 topic stations shown", (await page.locator(".route li").count()) === 9);
check("topic tiles show 9 topics", (await page.locator(".topic-tiles li").count()) === 9);
await shot(page, "output/01-today-desktop.png", { fullPage: true });

// 2. Learning session: answer until summary
await page.getByRole("button", { name: /开始今天的旅程|再学 5 个新词/ }).click();
await page.waitForURL(/#\/learn/);
let answered = 0, intros = 0, quizzes = 0, spells = 0;
const kinds = new Set();
for (let i = 0; i < 400; i++) {
  if (await page.getByText("今日这一程，走完了").count()) break;
  const kicker = (await page.locator(".step-kicker").first().textContent({ timeout: 5000 }).catch(() => "")) ?? "";
  if (kicker.startsWith("新词")) {
    intros++;
    await page.getByRole("button", { name: "记住了" }).click();
    continue;
  }
  if (await page.locator(".spell input").count()) {
    spells++;
    kinds.add("spell");
    await page.locator(".spell input").fill("zzz");
    await page.locator(".spell button[type=submit]").click();
  } else if (await page.locator(".option").count()) {
    quizzes++;
    kinds.add(kicker);
    if (quizzes === 2) await shot(page, "output/02a-quiz.png", { fullPage: false });
    await page.locator(".option").first().click();
  }
  if (await page.getByRole("button", { name: /^继续/ }).count()) {
    answered++;
    await page.getByRole("button", { name: /^继续/ }).click();
  }
}
check("learning session reaches summary", await page.getByText("今日这一程，走完了").count() === 1, `intros=${intros} quizzes=${quizzes} spells=${spells} answered=${answered}`);
check("session covers several question types", kinds.size >= 2, [...kinds].join(", "));
await shot(page, "output/02-learn-summary.png", { fullPage: true });

const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("mots-b2:v1") ?? "{}"));
const cardCount = Object.keys(stored.progress?.cards ?? {}).length;
check("progress persisted to localStorage (cards learned)", cardCount > 0, `cards=${cardCount}`);
check("mistakes recorded for wrong answers", (stored.progress?.mistakes ?? []).length > 0, `mistakes=${stored.progress?.mistakes?.length ?? 0}`);

await page.getByRole("button", { name: "回到今日" }).click();
await page.waitForSelector(".journey");

// 2b. Second round: make every learned card due now, so review steps (incl. spelling) appear
await page.evaluate(() => {
  const k = "mots-b2:v1";
  const d = JSON.parse(localStorage.getItem(k));
  for (const c of Object.values(d.progress.cards)) { c.due = Date.now() - 1000; c.s = 5; c.st = 2; }
  localStorage.setItem(k, JSON.stringify(d));
});
await page.reload();
await page.waitForSelector(".journey");
await page.getByRole("button", { name: /开始今天的旅程|继续旅程/ }).click();
await page.waitForURL(/#\/learn/);
let rSpell = 0, rAnswered = 0;
for (let i = 0; i < 300; i++) {
  if (await page.getByText("今日这一程，走完了").count()) break;
  if (await page.getByRole("button", { name: "记住了" }).count()) { await page.getByRole("button", { name: "记住了" }).click(); continue; }
  if (await page.locator(".spell input").count()) {
    rSpell++;
    await page.locator(".spell input").fill("zzz");
    await page.locator(".spell button[type=submit]").click();
  } else if (await page.locator(".option").count()) {
    await page.locator(".option").first().click();
  }
  if (await page.getByRole("button", { name: /^继续/ }).count()) { rAnswered++; await page.getByRole("button", { name: /^继续/ }).click(); }
}
check("review round includes spelling questions", rSpell > 0, `spell=${rSpell} answered=${rAnswered}`);
await shot(page, "output/02b-review-summary.png", { fullPage: true });
await page.getByRole("button", { name: "回到今日" }).click();
await page.waitForSelector(".journey");

// 3. Learning a question-level sample of the first intro card for the word sheet
// 4. Atlas: search and open a word sheet
await page.goto(BASE + "#/atlas");
await page.waitForSelector(".word-card");
check("atlas shows all 79 words", (await page.locator(".word-card").count()) === 79);
await shot(page, "output/03-atlas-desktop.png", { fullPage: false });
await page.getByLabel("搜索词条").fill("pollution");
await page.getByText("1 个词条").waitFor();
check("search 'pollution' narrows to 1 card", (await page.locator(".word-card").count()) === 1);
await page.getByLabel("搜索词条").fill("");
await page.getByRole("button", { name: "社会与公民", exact: true }).click();
await page.getByText("8 个词条").waitFor();
check("topic filter 社会与公民 shows 8 cards", (await page.locator(".word-card").count()) === 8);
await page.locator(".word-card").first().click();
await page.waitForSelector(".sheet .headword");
check("word sheet opens with headword", (await page.locator(".sheet .headword").textContent())?.trim().length > 0);
await shot(page, "output/04-word-sheet.png", { fullPage: false });
await page.keyboard.press("Escape");
await page.waitForTimeout(100);
check("Escape closes word sheet", (await page.locator(".sheet-root").count()) === 0);

// 5. Practice: dictée and traduction
await page.goto(BASE + "#/practice");
await page.waitForSelector("textarea");
await page.locator("textarea").fill("Bonjour tout le monde");
await page.getByRole("button", { name: "提交" }).click();
check("practice shows accuracy result", await page.locator(".result-stats").count() === 1);
const acc = await page.locator(".result-stats b").first().textContent();
check("practice accuracy is a percentage", /^\d+%$/.test(acc?.trim() ?? ""), acc);
await shot(page, "output/05-practice.png", { fullPage: false });

// 6. Me page
await page.goto(BASE + "#/me");
await page.waitForSelector(".me");
check("me page has export and import controls", (await page.getByRole("button", { name: /导出备份/ }).count()) === 1 && (await page.getByRole("button", { name: /导入备份/ }).count()) === 1);
await shot(page, "output/06-me.png", { fullPage: true });

// 7. Mobile viewport
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "zh-CN" });
const mp = await m.newPage();
await mp.goto(BASE);
await mp.waitForSelector(".journey");
check("mobile shows bottom tab bar", await mp.locator(".tabbar").isVisible());
await shot(mp, "output/07-today-mobile.png", { fullPage: false });
await m.close();

check("no uncaught page or console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();

const failed = checks.filter((c) => !c.ok).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
