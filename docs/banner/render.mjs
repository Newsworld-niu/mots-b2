// Renders docs/banner/banner.html to docs/banner.jpg (run from the project root: node docs/banner/render.mjs).
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const TYPES = { html: "text/html", css: "text/css", svg: "image/svg+xml", png: "image/png", webp: "image/webp", jpg: "image/jpeg", woff2: "font/woff2" };
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 600 }, deviceScaleFactor: 2 });
await ctx.route("**/*", (route) => {
  const url = new URL(route.request().url());
  if (url.host !== "banner.local") return route.abort();
  const file = join(".", decodeURIComponent(url.pathname));
  if (!existsSync(file)) return route.fulfill({ status: 404, body: "" });
  route.fulfill({ status: 200, contentType: TYPES[file.split(".").pop()] ?? "application/octet-stream", body: readFileSync(file) });
});
const page = await ctx.newPage();
await page.goto("http://banner.local/docs/banner/banner.html");
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
await page.screenshot({ path: "docs/banner.jpg", type: "jpeg", quality: 85 });
await browser.close();
console.log("saved docs/banner.jpg");
