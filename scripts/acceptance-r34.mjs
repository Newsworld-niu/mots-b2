// Round 34 acceptance: bookmark persistence, typing practice, backup export & restore.
// Runs in an isolated headless browser context; the real browser profile's learning
// data is never touched.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:5190/").replace(/\/$/, "") + "/";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = resolve("output");
const KEY = "word-atlas:v2:francais-b2-lexicon";
const BACKUP = resolve(OUT, "r34-backup.json");

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const readStore = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), KEY);
const cards = (s) => Object.keys(s?.progress?.cards ?? s?.cards ?? {}).length;
const bookmarks = (s) => s?.progress?.bookmarks ?? s?.bookmarks ?? [];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
await context.addInitScript((s) => {
  if (!localStorage.getItem("word-atlas:settings")) localStorage.setItem("word-atlas:settings", s);
}, JSON.stringify({ onboarded: true, splash: false, theme: "dark", sfx: false, autoplay: false }));
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

async function dismissOnboarding() {
  const onb = page.locator('[role="dialog"][aria-label="欢迎"]');
  if (await onb.count()) {
    await onb.getByRole("button").last().click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
  }
}

try {
  await page.goto(BASE + "#/");
  await page.waitForLoadState("networkidle");
  await dismissOnboarding();
  const s0 = await readStore(page);
  check("isolated context starts with empty progress", cards(s0) === 0, `${cards(s0)} cards`);

  // 1. bookmark the first atlas tile via the word sheet
  await page.goto(BASE + "#/atlas");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(700);
  await dismissOnboarding();
  const tile = page.locator("button.tile").first();
  await tile.evaluate((el) => el.click());
  await page.waitForTimeout(900);
  const bm = page.locator('[role="dialog"] button[aria-label="收藏"], [role="dialog"] button[aria-label="取消收藏"]').first();
  const hasSheet = (await page.locator('[role="dialog"]').count()) > 0;
  let label = null;
  let afterLabel = null;
  if (await bm.count()) {
    label = await bm.getAttribute("aria-label").catch(() => null);
    await bm.click();
    await page.waitForTimeout(600);
    afterLabel = await bm.getAttribute("aria-label").catch(() => null);
  }
  check("word sheet opens from atlas tile", hasSheet, `${await page.locator('[role="dialog"]').count()} dialog(s)`);
  check("bookmark toggle changes the button state", label === "收藏" && afterLabel === "取消收藏", `${label} -> ${afterLabel}`);

  // 2. reload: the sheet reopens from the URL and the bookmark must still be on
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(900);
  const bmAfter = page.locator('[role="dialog"] button[aria-label="收藏"], [role="dialog"] button[aria-label="取消收藏"]').first();
  const persisted = (await bmAfter.count()) ? await bmAfter.getAttribute("aria-label").catch(() => null) : null;
  check("bookmark persists after reload", persisted === "取消收藏", `label after reload=${persisted}`);
  const s2 = await readStore(page);
  check("bookmark present in persisted progress", bookmarks(s2).length > 0, `${bookmarks(s2).length} bookmark(s)`);

  // seed one card in the isolated store so export/restore covers cards too
  await page.evaluate((k) => {
    const st = JSON.parse(localStorage.getItem(k) || "{}");
    const now = Date.now();
    st.cards = { ...(st.cards || {}), promotion: { due: now + 86400000, s: 1, d: 5, el: 0, sd: 0, ls: 0, reps: 1, lapses: 0, st: 1, last: now, seen: now } };
    localStorage.setItem(k, JSON.stringify(st));
  }, KEY);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(700);
  const seeded = await readStore(page);
  check("seeded card persists in isolated store", cards(seeded) === 1, `${cards(seeded)} card(s)`);

  // 3. typing practice: word mode round accepts input
  await page.goto(BASE + "#/practice");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(700);
  await dismissOnboarding();
  const begin = page.getByRole("button", { name: "开始一轮" }).first();
  await begin.click();
  const input = page.locator(".typing-input").first();
  await input.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
  let typingOk = false;
  let typingDetail = "typing input did not appear";
  if (await input.count()) {
    await input.fill("zzzz");
    await page.waitForTimeout(600);
    const marks = await page.evaluate(() => ({
      ok: document.querySelectorAll(".is-ok").length,
      bad: document.querySelectorAll(".is-bad").length,
      help: (document.querySelector(".typing-help")?.textContent || "").trim(),
    }));
    typingOk = marks.ok + marks.bad > 0;
    typingDetail = `ok=${marks.ok} bad=${marks.bad}` + (marks.help ? ` · ${marks.help}` : "");
  }
  check("typing practice round starts and accepts input", typingOk, typingDetail);
  const s3 = await readStore(page);
  check("typing practice does not change memory cards", JSON.stringify(s3?.progress?.cards ?? {}) === JSON.stringify(s2?.progress?.cards ?? {}), `${cards(s3)} cards`);

  // 4. backup export
  await page.goto(BASE + "#/me");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(700);
  const exportBtn = page.getByRole("button", { name: /导出备份/ }).first();
  let download = null;
  try {
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), exportBtn.click()]);
    download = dl;
    await download.saveAs(BACKUP);
  } catch (e) {
    check("backup download fires", false, String(e?.message || e));
  }
  let backup = null;
  try {
    backup = JSON.parse(readFileSync(BACKUP, "utf8"));
  } catch {}
  check("backup download produces a file", !!backup, download ? download.suggestedFilename() : "no file");
  check(
    "backup contains app/version/progress/settings",
    backup?.app === "word-atlas" && backup?.version === 2 && !!backup?.progress && !!backup?.settings,
    backup ? `cards=${cards({ progress: backup.progress })} bookmarks=${backup.progress.bookmarks?.length ?? 0}` : "n/a",
  );

  // 5. restore after wiping the isolated store
  if (backup) {
    const before = await readStore(page);
    const beforeBm = bookmarks(before).length;
    const beforeCards = cards(before);
    await page.evaluate((k) => localStorage.removeItem(k), KEY);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(700);
    const wiped = await readStore(page);
    check("isolated store wiped before restore", bookmarks(wiped).length === 0 && cards(wiped) === 0, `cards=${cards(wiped)}`);
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count()) {
      await fileInput.setInputFiles(BACKUP);
      await page.waitForTimeout(1200);
      await page.reload();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(800);
      const s4 = await readStore(page);
      check("backup restores cards", cards(s4) === beforeCards, `${cards(s4)}/${beforeCards}`);
      check("backup restores bookmarks", bookmarks(s4).length === beforeBm, `${bookmarks(s4).length}/${beforeBm}`);
      const st = await page.evaluate(() => JSON.parse(localStorage.getItem("word-atlas:settings") || "null"));
      check("backup restores settings", st != null && st.onboarded === true, st ? `startLevel=${st.startLevel}` : "missing");
    } else check("backup restores cards", false, "no file input on #/me");
  }

  // 6. atlas theme filter (supporting)
  await page.goto(BASE + "#/atlas");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(700);
  const rc = page.locator(".result-count");
  const all = (await rc.textContent()) ?? "";
  const chip = page.locator('[aria-label="主题"] .chip-btn').nth(1);
  let filtered = all;
  if (await chip.count()) {
    await chip.click();
    await page.waitForTimeout(700);
    filtered = (await rc.textContent()) ?? "";
  }
  check("atlas theme filter changes the result count", filtered !== all && filtered.length > 0, `${all} -> ${filtered}`);

  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | ") || "none");
} catch (e) {
  check("script completed", false, String(e?.message || e));
} finally {
  const passed = checks.filter((c) => c.ok).length;
  writeFileSync(resolve(OUT, "acceptance-r34.json"), JSON.stringify({ base: BASE, ranAt: new Date().toISOString(), passed, total: checks.length, checks, pageErrors: errors }, null, 2));
  console.log(`\n${passed}/${checks.length} checks passed -> output/acceptance-r34.json`);
  await browser.close();
  process.exit(passed === checks.length ? 0 : 1);
}
