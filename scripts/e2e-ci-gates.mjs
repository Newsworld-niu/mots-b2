import { createRequire } from "node:module";
import { existsSync } from "node:fs";

const require = createRequire(process.cwd() + "/package.json");
const { chromium } = require("playwright");

const BASE = (process.env.FR_URL ?? "http://127.0.0.1:5191/").replace(/\/?$/, "/");
const MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CHROME = process.env.CHROME_PATH || (existsSync(MAC_CHROME) ? MAC_CHROME : undefined);
const DATASET_KEY = "word-atlas:v2:francais-b2-lexicon";

const SETTINGS_DEFAULT = JSON.stringify({
  onboarded: true,
  splash: false,
  theme: "dark",
  sfx: false,
  autoplay: false,
});

const results = [];
function assertCheck(name, ok, detail = "") {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) process.exitCode = 1;
}

const browser = await chromium.launch({ ...(CHROME ? { executablePath: CHROME } : {}), headless: true });

try {
  // Suite A: Offline route navigation & home zero-prefetch gate
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
    await ctx.addInitScript((s) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("word-atlas:settings", s);
        sessionStorage.setItem("seeded", "1");
      }
    }, SETTINGS_DEFAULT);
    const page = await ctx.newPage();
    const reqs = [];
    const resps = [];
    const errors = [];
    page.on("request", (req) => reqs.push(req.url()));
    page.on("response", (res) => resps.push({ url: res.url(), status: res.status() }));
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);

    const grammarHits = reqs.filter((u) => /\/atlas\/grammar\.json(?:\?|$)/.test(u));
    const familiesHits = reqs.filter((u) => /\/atlas\/families\.json(?:\?|$)/.test(u));
    const meta200 = resps.filter((r) => /\/atlas\/grammar-meta\.json(?:\?|$)/.test(r.url) && r.status === 200);

    assertCheck("Suite A: home loads zero requests to atlas/grammar.json", grammarHits.length === 0, `hits=${grammarHits.length}`);
    assertCheck("Suite A: home loads zero requests to atlas/families.json", familiesHits.length === 0, `hits=${familiesHits.length}`);
    assertCheck("Suite A: home loads atlas/grammar-meta.json HTTP 200", meta200.length >= 1, `hits=${meta200.length}`);

    const swStatus = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return { supported: false, active: false, controlled: false };
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, rej) => setTimeout(() => rej(new Error("SW ready timeout")), 15000)),
      ]);
      const keys = await caches.keys();
      return {
        supported: true,
        active: Boolean(reg.active),
        controlled: Boolean(navigator.serviceWorker.controller),
        caches: keys,
      };
    });
    if (!swStatus.controlled) {
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(400);
    }
    const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker?.controller));
    assertCheck("Suite A: service worker active and controlling", swStatus.active && controlled, JSON.stringify({ ...swStatus, controlled }));

    const offlineErrors = [];
    page.removeAllListeners("pageerror");
    page.on("pageerror", (e) => offlineErrors.push(e.message));

    await ctx.setOffline(true);
    const offlineRoutes = [
      { hash: "#/mock", marker: 'button:has-text("开始四项全真模考")' },
      { hash: "#/dict", marker: ".dict-search-bar" },
      { hash: "#/practice", marker: ".practice-list, .page-head" },
      { hash: "#/speak", marker: ".page-head" },
      { hash: "#/reflow", marker: ".reflow-tabs, .page-head" },
    ];
    for (const { hash, marker } of offlineRoutes) {
      await page.goto(BASE + hash, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(marker, { timeout: 10000 });
      await page.waitForFunction(() => (document.body.innerText || "").trim().length > 40, { timeout: 5000 });
      const info = await page.evaluate(() => {
        const txt = (document.body.innerText || "").trim();
        const crashed = txt.includes("页面遇到意外错误") || txt.includes("页面资源需要刷新更新");
        return { len: txt.length, crashed };
      });
      assertCheck(`Suite A: offline ${hash} renders without ErrorBoundary`, info.len > 40 && !info.crashed, JSON.stringify(info));
    }
    assertCheck("Suite A: zero uncaught pageerrors online or offline", errors.length === 0 && offlineErrors.length === 0, JSON.stringify([...errors, ...offlineErrors]));
    await ctx.close();
  }

  // Suite B: End-to-end encrypted cloud sync merge gate (Device A registers & pushes, Device B pairs & merges)
  {
    const users = new Map();
    const wireUploads = [];

    const corsHeaders = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
      "access-control-allow-headers": "authorization,content-type,if-match,if-none-match",
      "access-control-expose-headers": "ETag",
    };

    const installMockSyncApi = async (ctx) => {
      await ctx.route("**/api/**", async (route) => {
        const req = route.request();
        const url = new URL(req.url());
        const method = req.method().toUpperCase();

        if (method === "OPTIONS") {
          await route.fulfill({ status: 204, headers: corsHeaders });
          return;
        }

        if (method === "POST" && url.pathname.endsWith("/api/register")) {
          const body = JSON.parse(req.postData() || "{}");
          if (!body.inviteCode || !body.authToken) {
            await route.fulfill({
              status: 400,
              headers: { ...corsHeaders, "content-type": "application/json" },
              body: JSON.stringify({ error: "bad_request" }),
            });
            return;
          }
          users.set(body.authToken, { etag: null, seq: 0, body: null });
          await route.fulfill({
            status: 200,
            headers: { ...corsHeaders, "content-type": "application/json" },
            body: JSON.stringify({ authVersion: 2 }),
          });
          return;
        }

        const syncMatch = url.pathname.match(/\/api\/sync\/([^/]+)$/);
        if (syncMatch) {
          const auth = req.headers()["authorization"] || "";
          const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
          const record = users.get(bearer);
          if (!record) {
            await route.fulfill({
              status: 401,
              headers: { ...corsHeaders, "content-type": "application/json" },
              body: JSON.stringify({ error: "unauthorized" }),
            });
            return;
          }
          if (method === "GET") {
            const inm = req.headers()["if-none-match"];
            if (record.body === null) {
              await route.fulfill({
                status: 404,
                headers: { ...corsHeaders, "content-type": "application/json" },
                body: JSON.stringify({ error: "not_found" }),
              });
              return;
            }
            if (inm && inm === record.etag) {
              await route.fulfill({ status: 304, headers: { ...corsHeaders, etag: record.etag } });
              return;
            }
            await route.fulfill({
              status: 200,
              headers: { ...corsHeaders, "content-type": "application/json", etag: record.etag },
              body: record.body,
            });
            return;
          }
          if (method === "PUT") {
            const inm = req.headers()["if-none-match"];
            const im = req.headers()["if-match"];
            if (inm === "*" && record.body !== null) {
              await route.fulfill({ status: 412, headers: corsHeaders });
              return;
            }
            if (im && im !== record.etag) {
              await route.fulfill({ status: 412, headers: corsHeaders });
              return;
            }
            const raw = req.postData() || "";
            wireUploads.push(raw);
            record.seq += 1;
            record.etag = `"v${record.seq}"`;
            record.body = raw;
            await route.fulfill({
              status: 200,
              headers: { ...corsHeaders, "content-type": "application/json", etag: record.etag },
              body: JSON.stringify({ etag: record.etag }),
            });
            return;
          }
        }

        if (/\/api\/sync\/[^/]+\/history$/.test(url.pathname) && method === "GET") {
          await route.fulfill({
            status: 200,
            headers: { ...corsHeaders, "content-type": "application/json" },
            body: "[]",
          });
          return;
        }

        await route.fulfill({ status: 404, headers: corsHeaders });
      });
    };

    const makeSeed = (bookmark, fav, mins) =>
      JSON.stringify({
        version: 2,
        datasetId: "francais-b2-lexicon",
        started: 1700000000000,
        target: 10,
        cards: {
          [bookmark]: { due: 100, s: 2, d: 5, el: 0, sd: 1, ls: 0, reps: 1, lapses: 0, st: 2, seen: 1 },
        },
        essays: [],
        essayNotes: [],
        bookmarks: [bookmark],
        hidden: [],
        days: { "2026-11-22": { n: 1, r: 1, c: 1, t: mins } },
        typing: [],
        session: null,
        mistakes: [],
        dictFavs: [fav],
      });

    // Device A registers and uploads E2EE payload
    const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
    await installMockSyncApi(ctxA);
    await ctxA.addInitScript(
      ({ settings, prog, key }) => {
        if (!sessionStorage.getItem("seeded")) {
          localStorage.setItem("word-atlas:settings", settings);
          localStorage.setItem(key, prog);
          sessionStorage.setItem("seeded", "1");
        }
      },
      { settings: SETTINGS_DEFAULT, prog: makeSeed("n-maison", "accueil", 10), key: DATASET_KEY },
    );
    const pageA = await ctxA.newPage();
    const syncErrors = [];
    pageA.on("pageerror", (e) => syncErrors.push(`A:${e.message}`));

    await pageA.goto(BASE + "#/me", { waitUntil: "networkidle" });
    await pageA.getByPlaceholder("输入邀请码（如 inv_...）").fill("inv_ci_e2e");
    await pageA.getByRole("button", { name: "注册并生成同步码" }).click();
    await pageA.waitForSelector(".sync-code-text", { timeout: 10000 });
    const syncCode = (await pageA.locator(".sync-code-text").innerText()).trim();
    await pageA.waitForSelector(".sync-badge.is-ok", { timeout: 10000 });

    const firstWire = wireUploads[0] || "";
    const parsedWire = JSON.parse(firstWire || "{}");
    const encryptedOk =
      syncCode.startsWith("mb2_") &&
      wireUploads.length >= 1 &&
      parsedWire.version === 2 &&
      parsedWire.enc === "aes-gcm-v1" &&
      typeof parsedWire.iv === "string" &&
      typeof parsedWire.ct === "string" &&
      !firstWire.includes("n-maison") &&
      !firstWire.includes("accueil");
    assertCheck("Suite B: Device A registers and uploads AES-GCM ciphertext without plaintext leakage", encryptedOk, `codePrefix=${syncCode.slice(0, 6)} uploads=${wireUploads.length}`);
    await ctxA.close();

    // Device B pairs and smart-merges diverged progress
    const ctxB = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
    await installMockSyncApi(ctxB);
    await ctxB.addInitScript(
      ({ settings, prog, key }) => {
        if (!sessionStorage.getItem("seeded")) {
          localStorage.setItem("word-atlas:settings", settings);
          localStorage.setItem(key, prog);
          sessionStorage.setItem("seeded", "1");
        }
      },
      { settings: SETTINGS_DEFAULT, prog: makeSeed("n-eau", "prendre", 5), key: DATASET_KEY },
    );
    const pageB = await ctxB.newPage();
    pageB.on("pageerror", (e) => syncErrors.push(`B:${e.message}`));

    await pageB.goto(BASE + "#/me", { waitUntil: "networkidle" });
    await pageB.getByRole("tab", { name: "已有同步码" }).click();
    await pageB.getByPlaceholder("输入已有同步码（mb2_...）").fill(syncCode);
    await pageB.getByRole("button", { name: "配对并同步" }).click();
    await pageB.getByRole("button", { name: /智能合并两端/ }).click();
    await pageB.waitForSelector(".sync-badge.is-ok", { timeout: 10000 });
    await pageB.waitForTimeout(450);

    const merged = await pageB.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), DATASET_KEY);
    const secondWire = wireUploads[wireUploads.length - 1] || "";
    const parsedSecond = JSON.parse(secondWire || "{}");
    const mergeOk =
      Array.isArray(merged.bookmarks) &&
      merged.bookmarks.includes("n-maison") &&
      merged.bookmarks.includes("n-eau") &&
      Boolean(merged.cards?.["n-maison"]) &&
      Boolean(merged.cards?.["n-eau"]) &&
      Array.isArray(merged.dictFavs) &&
      merged.dictFavs.includes("accueil") &&
      merged.dictFavs.includes("prendre") &&
      wireUploads.length >= 2 &&
      parsedSecond.version === 2 &&
      parsedSecond.enc === "aes-gcm-v1" &&
      typeof parsedSecond.iv === "string" &&
      typeof parsedSecond.ct === "string" &&
      !secondWire.includes("n-maison") &&
      !secondWire.includes("n-eau") &&
      !secondWire.includes("accueil") &&
      !secondWire.includes("prendre");
    assertCheck("Suite B: Device B pairs and merges both devices cards, bookmarks & dictFavs cleanly", mergeOk, JSON.stringify({ bookmarks: merged.bookmarks, cards: Object.keys(merged.cards || {}), dictFavs: merged.dictFavs, uploads: wireUploads.length }));
    assertCheck("Suite B: zero pageerrors during E2EE register, pair & merge", syncErrors.length === 0, JSON.stringify(syncErrors));
    await ctxB.close();
  }

  // Suite C: 390x844 mobile layout & 5-tab nav gate
  {
    const ctxMob = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "zh-CN" });
    await ctxMob.addInitScript((s) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("word-atlas:settings", s);
        sessionStorage.setItem("seeded", "1");
      }
    }, SETTINGS_DEFAULT);
    const pageMob = await ctxMob.newPage();
    const mobErrors = [];
    pageMob.on("pageerror", (e) => mobErrors.push(e.message));

    await pageMob.goto(BASE, { waitUntil: "networkidle" });
    await pageMob.waitForSelector(".tabbar a");
    const mobNav = (await pageMob.locator(".tabbar a").allInnerTexts()).map((x) => x.trim());
    assertCheck("Suite C: mobile 390px tabbar shows 5 unified tabs", JSON.stringify(mobNav) === JSON.stringify(["今日", "应试", "词库", "语法", "我的"]), JSON.stringify(mobNav));

    const routes = ["#/", "#/practice", "#/dict", "#/grammar", "#/conj", "#/me", "#/mock", "#/reflow", "#/read", "#/learn"];
    const overflows = [];
    for (const r of routes) {
      await pageMob.goto(BASE + r, { waitUntil: "networkidle" });
      await pageMob.waitForTimeout(300);
      const ov = await pageMob.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      if (ov.sw > ov.cw) overflows.push({ route: r, ...ov });
    }
    assertCheck("Suite C: 390x844 zero horizontal overflow across all 10 routes", overflows.length === 0, JSON.stringify(overflows));
    assertCheck("Suite C: zero uncaught pageerrors on 390x844 routes", mobErrors.length === 0, JSON.stringify(mobErrors));
    await ctxMob.close();
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\nCI gates summary: ${results.length - failed}/${results.length} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
