import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { webcrypto } from "node:crypto";

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

/** Decrypt an uploaded E2EE envelope the way the app does (HKDF-SHA256 → AES-GCM-256), to inspect what the cloud holds. */
async function decryptWire(raw, syncCode, datasetId = "francais-b2-lexicon") {
  const env = JSON.parse(raw);
  const enc = new TextEncoder();
  const subtle = webcrypto.subtle;
  const ikm = await subtle.importKey("raw", enc.encode(syncCode), "HKDF", false, ["deriveKey"]);
  const key = await subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode("mots-b2-sync-e2ee-salt-v1"), info: enc.encode(`mots-b2-aes-gcm-256-v1:${datasetId}`) },
    ikm,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const plain = await subtle.decrypt(
    { name: "AES-GCM", iv: Buffer.from(env.iv, "base64"), additionalData: enc.encode(`word-atlas:v2:${datasetId}`) },
    key,
    Buffer.from(env.ct, "base64"),
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

const ENVELOPE_KEYS = JSON.stringify(["app", "ct", "datasetId", "enc", "iv", "version"]);
const isStrictEnvelope = (raw) => {
  try {
    const p = JSON.parse(raw);
    return JSON.stringify(Object.keys(p).sort()) === ENVELOPE_KEYS && p.enc === "aes-gcm-v1";
  } catch {
    return false;
  }
};

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

    // Suite B (AI): AI settings + API keys travel only inside the E2EE payload; switching key sync off removes them from the cloud
    {
      const SECRETS = {
        openai: "sk-e2e-openai-SECRET-0123456789",
        gemini: "AIzaSyE2E-gemini-SECRET-0123456",
        azure: "e2eazureSECRETkey0123456789abcd",
      };
      const RELAY = "https://relay-e2e.example.com/v1";
      const aiSeed = JSON.stringify({
        keys: { openai: SECRETS.openai, gemini: SECRETS.gemini, azure: SECRETS.azure },
        openaiBaseUrl: RELAY,
        azureRegion: "westeurope",
        azureVoice: "fr-FR-VivienneMultilingualNeural",
        text: { provider: "openai", model: "gpt-5-mini" },
      });
      const aiErrors = [];
      const leaks = (raw) => Object.values(SECRETS).some((k) => raw.includes(k)) || raw.includes(RELAY);
      const keySwitchLabel = (page) => page.locator(".cloud-sync .ai-sync-toggle", { hasText: "将 API Key" });
      const uploadsBefore = wireUploads.length;

      const ctxA3 = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
      await installMockSyncApi(ctxA3);
      await ctxA3.addInitScript(
        ({ settings, prog, key, ai }) => {
          if (!sessionStorage.getItem("seeded")) {
            localStorage.setItem("word-atlas:settings", settings);
            localStorage.setItem(key, prog);
            localStorage.setItem("word-atlas:ai:v1", ai);
            sessionStorage.setItem("seeded", "1");
          }
        },
        { settings: SETTINGS_DEFAULT, prog: makeSeed("n-ami", "chat", 3), key: DATASET_KEY, ai: aiSeed },
      );
      const pageA3 = await ctxA3.newPage();
      pageA3.on("pageerror", (e) => aiErrors.push(`A:${e.message}`));
      await pageA3.goto(BASE + "#/me", { waitUntil: "networkidle" });
      // preset before pairing: include the API keys in the encrypted sync
      await keySwitchLabel(pageA3).click();
      const presetOn = await pageA3.locator(".cloud-sync").getByRole("switch", { name: "将 API Key 一并纳入端到端加密同步" }).isChecked();
      await pageA3.getByPlaceholder("输入邀请码（如 inv_...）").fill("inv_ci_ai");
      await pageA3.getByRole("button", { name: "注册并生成同步码" }).click();
      await pageA3.waitForSelector(".sync-code-text", { timeout: 10000 });
      const aiCode = (await pageA3.locator(".sync-code-text").innerText()).trim();
      await pageA3.waitForSelector(".sync-badge.is-ok", { timeout: 10000 });
      const aUploads = wireUploads.slice(uploadsBefore);
      const aPlain = aUploads.length ? await decryptWire(aUploads[aUploads.length - 1], aiCode) : {};
      assertCheck(
        "Suite B (AI): Device A uploads AI config + API keys only as AES-GCM ciphertext (no key / base URL / code on the wire)",
        presetOn &&
          aUploads.length >= 1 &&
          aUploads.every((raw) => isStrictEnvelope(raw) && !leaks(raw) && !raw.includes(aiCode)) &&
          aPlain.aiConfig?.includeKeys === true &&
          aPlain.aiConfig?.keys?.openai === SECRETS.openai &&
          aPlain.aiConfig?.config?.openaiBaseUrl === RELAY,
        JSON.stringify({ presetOn, uploads: aUploads.length, includeKeys: aPlain.aiConfig?.includeKeys }),
      );
      await ctxA3.close();

      const ctxB3 = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
      await installMockSyncApi(ctxB3);
      await ctxB3.addInitScript((settings) => {
        if (!sessionStorage.getItem("seeded")) {
          localStorage.setItem("word-atlas:settings", settings);
          sessionStorage.setItem("seeded", "1");
        }
      }, SETTINGS_DEFAULT);
      const pageB3 = await ctxB3.newPage();
      pageB3.on("pageerror", (e) => aiErrors.push(`B:${e.message}`));
      await pageB3.goto(BASE + "#/me", { waitUntil: "networkidle" });
      await pageB3.getByRole("tab", { name: "已有同步码" }).click();
      await pageB3.getByPlaceholder("输入已有同步码（mb2_...）").fill(aiCode);
      await pageB3.getByRole("button", { name: "配对并同步" }).click();
      await pageB3.waitForSelector(".sync-badge.is-ok", { timeout: 10000 });
      await pageB3.waitForTimeout(300);
      const readAi = () => pageB3.evaluate(() => JSON.parse(localStorage.getItem("word-atlas:ai:v1") || "{}"));
      const restored = await readAi();
      await pageB3.getByRole("button", { name: "设置 AI 接口" }).click();
      const dialog = pageB3.getByRole("dialog", { name: "AI 接口" });
      await dialog.waitFor();
      const dialogKeySwitchOn = await dialog.getByRole("switch", { name: "将 API Key 一并纳入端到端加密同步" }).isChecked();
      const dialogStatus = await dialog.locator(".ai-sync-status").innerText();
      await pageB3.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      assertCheck(
        "Suite B (AI): Device B pairs, decrypts and restores AI config + keys, and both panels show key sync on",
        restored.keys?.openai === SECRETS.openai &&
          restored.keys?.gemini === SECRETS.gemini &&
          restored.keys?.azure === SECRETS.azure &&
          restored.openaiBaseUrl === RELAY &&
          restored.azureVoice === "fr-FR-VivienneMultilingualNeural" &&
          dialogKeySwitchOn,
        JSON.stringify({ baseUrl: restored.openaiBaseUrl, dialogKeySwitchOn, dialogStatus }),
      );

      const beforeOff = wireUploads.length;
      await keySwitchLabel(pageB3).click();
      const deadline = Date.now() + 10000;
      while (wireUploads.length === beforeOff && Date.now() < deadline) await pageB3.waitForTimeout(100);
      const offRaw = wireUploads[wireUploads.length - 1] || "";
      const offPlain = wireUploads.length > beforeOff ? await decryptWire(offRaw, aiCode) : {};
      const keptLocal = await readAi();
      assertCheck(
        "Suite B (AI): switching 同步 API Key off uploads at once; the latest ciphertext holds no key while B keeps its keys",
        wireUploads.length > beforeOff &&
          isStrictEnvelope(offRaw) &&
          !leaks(offRaw) &&
          offPlain.aiConfig?.includeKeys === false &&
          !("keys" in (offPlain.aiConfig ?? {})) &&
          !JSON.stringify(offPlain).includes(SECRETS.openai) &&
          keptLocal.keys?.openai === SECRETS.openai &&
          keptLocal.keys?.azure === SECRETS.azure,
        JSON.stringify({
          uploads: wireUploads.length - beforeOff,
          includeKeys: offPlain.aiConfig?.includeKeys,
          lastError: await pageB3.evaluate(() => JSON.parse(localStorage.getItem("fb2.sync") || "{}").lastError ?? null),
          keyPolicy: await pageB3.evaluate(() => JSON.parse(localStorage.getItem("word-atlas:ai-sync:v1") || "{}").keyPolicy ?? null),
        }),
      );
      assertCheck("Suite B (AI): zero pageerrors during AI config E2EE sync", aiErrors.length === 0, JSON.stringify(aiErrors));
      await ctxB3.close();

      // Reverse path: default non-key sync preserves Device D's local private key & requires endpoint confirmation
      const PRIVATE_KEY_D = "sk-e2e-private-local-D-999999";
      const ctxD = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
      await installMockSyncApi(ctxD);
      await ctxD.addInitScript(
        ({ settings, ai }) => {
          if (!sessionStorage.getItem("seeded")) {
            localStorage.setItem("word-atlas:settings", settings);
            localStorage.setItem("word-atlas:ai:v1", ai);
            sessionStorage.setItem("seeded", "1");
          }
        },
        { settings: SETTINGS_DEFAULT, ai: JSON.stringify({ keys: { openai: PRIVATE_KEY_D } }) },
      );
      const pageD = await ctxD.newPage();
      pageD.on("pageerror", (e) => aiErrors.push(`D:${e.message}`));
      await pageD.goto(BASE + "#/me", { waitUntil: "networkidle" });
      await pageD.getByRole("tab", { name: "已有同步码" }).click();
      await pageD.getByPlaceholder("输入已有同步码（mb2_...）").fill(aiCode);
      await pageD.getByRole("button", { name: "配对并同步" }).click();
      await pageD.waitForSelector(".sync-badge.is-ok", { timeout: 10000 });
      await pageD.waitForTimeout(250);

      const dAfterPair = await pageD.evaluate(() => JSON.parse(localStorage.getItem("word-atlas:ai:v1") || "{}"));
      await pageD.getByRole("button", { name: "设置 AI 接口" }).click();
      const dialogD = pageD.getByRole("dialog", { name: "AI 接口" });
      await dialogD.waitFor();
      const confirmBannerVisible = (await dialogD.locator(".ai-endpoint-confirm").count()) === 1;
      if (confirmBannerVisible) {
        await dialogD.getByRole("button", { name: "信任并启用" }).click();
      }
      const confirmCleared = (await dialogD.locator(".ai-endpoint-confirm").count()) === 0;
      const dGuardAfter = await pageD.evaluate(() => localStorage.getItem("word-atlas:ai-endpoint-guard:v1"));
      assertCheck(
        "Suite B (AI): non-key sync updates Base URL & voice while keeping Device D's local key and guarding unconfirmed endpoint",
        dAfterPair.keys?.openai === PRIVATE_KEY_D &&
          dAfterPair.openaiBaseUrl === RELAY &&
          dAfterPair.azureVoice === "fr-FR-VivienneMultilingualNeural" &&
          confirmBannerVisible &&
          confirmCleared &&
          dGuardAfter === null &&
          !wireUploads.some((raw) => raw.includes(PRIVATE_KEY_D)),
        JSON.stringify({ keyKept: dAfterPair.keys?.openai === PRIVATE_KEY_D, baseUrl: dAfterPair.openaiBaseUrl, confirmBannerVisible, confirmCleared }),
      );
      await ctxD.close();
    }
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

    // 我的 → 云同步 and 我的 → AI 接口 (both carry the AI sync switches) stay within 390 px
    await pageMob.goto(BASE + "#/me", { waitUntil: "networkidle" });
    await pageMob.locator(".cloud-sync .ai-sync-controls").scrollIntoViewIfNeeded();
    const cloudPanel = await pageMob.evaluate(() => {
      const el = document.querySelector(".cloud-sync .ai-sync-controls");
      const r = el?.getBoundingClientRect();
      return {
        found: Boolean(el),
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
        inner: el ? el.scrollWidth <= el.clientWidth : false,
        right: r ? Math.round(r.right) : 0,
      };
    });
    await pageMob.getByRole("button", { name: "设置 AI 接口" }).click();
    const mobDialog = pageMob.getByRole("dialog", { name: "AI 接口" });
    await mobDialog.waitFor();
    await mobDialog.locator(".ai-sync-controls").waitFor();
    const sheetPanel = await pageMob.evaluate(() => {
      const sheet = document.querySelector(".sheet[aria-label='AI 接口']");
      const ctl = sheet?.querySelector(".ai-sync-controls");
      const switches = [...(sheet?.querySelectorAll(".ai-sync-toggle .switch") ?? [])].map((s) => Math.round(s.getBoundingClientRect().width));
      return {
        found: Boolean(ctl),
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
        sheet: sheet ? sheet.scrollWidth <= sheet.clientWidth : false,
        inner: ctl ? ctl.scrollWidth <= ctl.clientWidth : false,
        switches,
      };
    });
    await pageMob.keyboard.press("Escape");
    assertCheck(
      "Suite C: 390x844 云同步 panel and AI 接口 sheet show the AI sync switches without overflow or squeezed switches",
      cloudPanel.found &&
        cloudPanel.inner &&
        cloudPanel.sw <= cloudPanel.cw &&
        cloudPanel.right <= cloudPanel.cw &&
        sheetPanel.found &&
        sheetPanel.sheet &&
        sheetPanel.inner &&
        sheetPanel.sw <= sheetPanel.cw &&
        sheetPanel.switches.length === 2 &&
        sheetPanel.switches.every((w) => w === 48),
      JSON.stringify({ cloudPanel, sheetPanel }),
    );
    assertCheck("Suite C: zero uncaught pageerrors on 390x844 routes", mobErrors.length === 0, JSON.stringify(mobErrors));
    await ctxMob.close();
  }

  // Suite D: Grammar 4-dimension upgrade E2E gate (matrices, rich point layout, 390px wide tables, focused+retry loop & offline deep link)
  {
    const ctxGram = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
    await ctxGram.addInitScript((s) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("word-atlas:settings", s);
        sessionStorage.setItem("seeded", "1");
      }
    }, SETTINGS_DEFAULT);
    const pageG = await ctxGram.newPage();
    const gramErrors = [];
    pageG.on("pageerror", (e) => gramErrors.push(e.message));

    await pageG.goto(BASE + "#/grammar", { waitUntil: "networkidle" });
    await pageG.waitForSelector(".gram-card");
    const totalCards = await pageG.locator(".gram-card").count();
    assertCheck("Suite D: grammar overview renders all 66 points", totalCards === 66, `visibleCards=${totalCards}`);

    // Open comparison matrices hub (#/grammar?sheet=1)
    await pageG.goto(BASE + "#/grammar?sheet=1", { waitUntil: "networkidle" });
    await pageG.waitForSelector(".gram-matrix");
    const matrixCount = await pageG.locator(".gram-matrix").count();
    const rawMarkLeakSheet = await pageG.evaluate(() => /\{[vpcak]:/.test(document.body.innerText || ""));
    assertCheck("Suite D: comparison hub renders 12 cross-chapter matrices with zero raw mark leaks", matrixCount === 12 && !rawMarkLeakSheet, `matrices=${matrixCount} leak=${rawMarkLeakSheet}`);

    // Open new B2 point causatif with deep-link section=r3
    await pageG.goto(BASE + "#/grammar?p=causatif&section=r3", { waitUntil: "networkidle" });
    await pageG.waitForSelector("#gram-sec-r3");
    const hasRich = await pageG.evaluate(() => ({
      formulas: document.querySelectorAll(".gram-formula").length,
      tables: document.querySelectorAll(".gram-table").length,
      pitfalls: document.querySelectorAll(".gram-pitfall").length,
      marks: document.querySelectorAll(".gm-affix, .gm-pill").length,
      leak: /\{[vpcak]:/.test(document.body.innerText || ""),
    }));
    assertCheck(
      "Suite D: PointView renders formulas, tables, ✓/✗ pitfalls & semantic highlights without raw mark leaks",
      hasRich.formulas >= 1 && hasRich.tables >= 1 && hasRich.pitfalls >= 1 && hasRich.marks >= 3 && !hasRich.leak,
      JSON.stringify(hasRich),
    );

    // Deterministically answer 1st ChoiceDrill wrong & rest right -> verify inline .gram-glance auto-opens -> Summary -> Retry Missed -> 再来一轮 restores focused mode
    const causatifChoices = await pageG.evaluate(async (u) => {
      const g = await (await fetch(u)).json();
      return g.points.find((p) => p.id === "causatif").drills.filter((d) => d.k === "c");
    }, BASE + "atlas/grammar.json");
    await pageG.locator(".gram-kind-filter button", { hasText: "选择" }).click();
    await pageG.locator(".gram-practice-go").click();
    await pageG.waitForSelector(".gram-run");
    let sawAutoOpenGlance = false;
    for (let step = 0; step < 12; step++) {
      if (!(await pageG.locator(".gram-run").count())) break;
      const opts = pageG.locator(".gram-run .option:not([disabled])");
      const optCount = await opts.count();
      if (optCount > 0) {
        const texts = await pageG.locator(".gram-run .option span[lang='fr']").allInnerTexts();
        const key = [...texts].sort().join("\0");
        const matched = causatifChoices.find((d) => [...d.o].sort().join("\0") === key);
        const rightAns = matched ? matched.s.slice(matched.b[0], matched.b[1]) : null;
        const targetIdx = rightAns
          ? texts.findIndex((t) => (step === 0 ? t !== rightAns : t === rightAns))
          : 0;
        await opts.nth(targetIdx >= 0 ? targetIdx : 0).click();
        await pageG.waitForTimeout(100);
        if (step === 0) {
          const openCount = await pageG.locator(".conj-feedback.is-wrong .gram-glance.is-open button[aria-expanded='true']").count();
          if (openCount === 1) sawAutoOpenGlance = true;
        }
      }
      const nextBtn = pageG.getByRole("button", { name: /^继续/ });
      if (await nextBtn.count()) {
        await nextBtn.click();
        await pageG.waitForTimeout(100);
      }
    }
    await pageG.waitForSelector(".typing-done");
    await pageG.waitForTimeout(350); // store persists to localStorage after a 250ms debounce
    const repsAfterRound = await pageG.evaluate((k) => {
      const p = JSON.parse(localStorage.getItem(k) || "{}");
      return p.gram?.causatif?.reps ?? 0;
    }, DATASET_KEY);
    assertCheck("Suite D: focused round auto-opens .gram-glance on wrong answer and records initial FSRS state", sawAutoOpenGlance && repsAfterRound === 1, `sawAutoOpenGlance=${sawAutoOpenGlance} reps=${repsAfterRound}`);

    const retryBtn = pageG.getByRole("button", { name: /重练本轮错题/ });
    const hasRetryBtn = (await retryBtn.count()) === 1;
    let repsAfterRetry = -1;
    let restoredModeBanner = "";
    if (hasRetryBtn) {
      await retryBtn.click();
      await pageG.waitForSelector(".gram-run-mode.is-retry");
      for (let step = 0; step < 4; step++) {
        if (!(await pageG.locator(".gram-run").count())) break;
        const opts = pageG.locator(".gram-run .option:not([disabled])");
        if (await opts.count()) {
          await opts.first().click();
          await pageG.waitForTimeout(100);
        }
        const nextBtn = pageG.getByRole("button", { name: /^继续/ });
        if (await nextBtn.count()) {
          await nextBtn.click();
          await pageG.waitForTimeout(100);
        }
      }
      await pageG.waitForSelector(".typing-done");
      await pageG.waitForTimeout(350);
      repsAfterRetry = await pageG.evaluate((k) => {
        const p = JSON.parse(localStorage.getItem(k) || "{}");
        return p.gram?.causatif?.reps ?? 0;
      }, DATASET_KEY);
      const againBtn = pageG.getByRole("button", { name: /再来一轮/ });
      await againBtn.click();
      await pageG.waitForSelector(".gram-run-mode.is-focused");
      restoredModeBanner = await pageG.locator(".gram-run-mode").innerText();
    }
    assertCheck(
      "Suite D: retry round preserves FSRS reps and 再来一轮 restores original focused mode & label",
      hasRetryBtn && repsAfterRetry === repsAfterRound && restoredModeBanner.includes("专项 · 选择题") && !restoredModeBanner.includes("错题重练"),
      `hasRetry=${hasRetryBtn} before=${repsAfterRound} after=${repsAfterRetry} banner=${restoredModeBanner}`,
    );

    // Offline reload of grammar deep link + mobile 390px overflow gate across matrices & ALL 66 grammar points
    await pageG.goto(BASE + "#/grammar?p=double-pronoms&section=r1", { waitUntil: "networkidle" });
    await pageG.evaluate(() => navigator.serviceWorker?.ready);
    await ctxGram.setOffline(true);
    await pageG.reload({ waitUntil: "domcontentloaded" });
    await pageG.waitForSelector("#gram-sec-r1", { timeout: 10000 });
    const offlineTitle = await pageG.locator("h1.gram-title").innerText();
    assertCheck("Suite D: offline full reload of #/grammar?p=double-pronoms&section=r1 succeeds from SW cache", offlineTitle.includes("两个宾语代词"), offlineTitle);
    await ctxGram.setOffline(false);

    await pageG.setViewportSize({ width: 390, height: 844 });
    const metaPts = await pageG.evaluate(async (u) => (await fetch(u)).json(), BASE + "atlas/grammar-meta.json");
    const gramMobRoutes = ["#/grammar?sheet=1", ...metaPts.points.map((pt) => `#/grammar?p=${pt.id}`)];
    const gramOverflows = [];
    for (const r of gramMobRoutes) {
      await pageG.goto(BASE + r, { waitUntil: "networkidle" });
      const ov = await pageG.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      if (ov.sw > ov.cw) gramOverflows.push({ route: r, ...ov });
    }
    assertCheck(`Suite D: 390x844 zero horizontal overflow across matrices & all ${metaPts.points.length} grammar point pages`, gramOverflows.length === 0, JSON.stringify(gramOverflows));
    assertCheck("Suite D: zero uncaught pageerrors across grammar E2E flows", gramErrors.length === 0, JSON.stringify(gramErrors));
    await ctxGram.close();
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\nCI gates summary: ${results.length - failed}/${results.length} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
