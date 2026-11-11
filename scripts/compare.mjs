/* Side-by-side capture: original word-atlas (ORIG_URL) and the French edition (FR_URL) with identical
 * viewport, theme and state. Writes output/compare/<page>-<side>.png. Usage: node scripts/compare.mjs [--mobile] */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const ORIG = process.env.ORIG_URL ?? "http://127.0.0.1:5188/";
const FR = process.env.FR_URL ?? "http://127.0.0.1:5190/";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const mobile = process.argv.includes("--mobile");
const tag = mobile ? "m" : "d";
const viewport = mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 };
mkdirSync("output/compare", { recursive: true });

// Same starting state for both: onboarding and splash done, dark theme, no progress.
const seed = () => {
  localStorage.setItem("word-atlas:settings", JSON.stringify({ onboarded: true, splash: false, theme: "dark", sfx: false, autoplay: false }));
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const pages = [
  ["01-today", "#/"],
  ["02-atlas", "#/atlas"],
  ["03-entry", null],
  ["05-practice", "#/practice"],
  ["06-me", "#/me"],
];
const results = [];
// Learning flow: open the first intro card and answer the first question, on both sides.
async function learnFlow(page, name, side) {
  await page.goto((side === "orig" ? ORIG : FR) + "#/", { waitUntil: "load" });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /开始今天的旅程/ }).first().click();
  await page.waitForURL(/#\/learn/);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `output/compare/${name}-intro-${tag}-${side}.png` });
  // the first five words are introductions; advance until the first question appears
  for (let i = 0; i < 8 && !(await page.locator(".option").count()); i++) {
    await page.getByRole("button", { name: /认识了/ }).first().click();
    await page.waitForTimeout(700);
  }
  if (await page.locator(".option").count()) {
    await page.locator(".option").first().click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `output/compare/${name}-answer-${tag}-${side}.png` });
  }
}
for (const side of ["orig", "fr"]) {
  const base = side === "orig" ? ORIG : FR;
  const ctx = await browser.newContext({ viewport, locale: "zh-CN", colorScheme: "dark", isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript(seed);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const [name, hash] of pages) {
    // the same entry on each side: the original atlas has "library", the French atlas has "entretien"
    const target = hash ?? (side === "orig" ? "#/atlas?w=library" : "#/atlas?w=entretien");
    await page.goto(base + target, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    const file = `output/compare/${name}-${tag}-${side}.png`;
    await page.screenshot({ path: file, fullPage: false });
    results.push({ name, side, file, errors: errors.length });
  }
  await learnFlow(page, "04-learn", side);
  await ctx.close();
}
await browser.close();
for (const r of results) console.log(`${r.side.padEnd(5)} ${r.name}  ${r.file}`);
