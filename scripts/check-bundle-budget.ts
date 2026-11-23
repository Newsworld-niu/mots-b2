import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const DIST_DIR = path.resolve("dist");
const ASSETS_DIR = path.join(DIST_DIR, "assets");
const MAIN_JS_BUDGET_BYTES = 350 * 1024;
const GRAMMAR_META_PATH = path.resolve("public/atlas/grammar-meta.json");
const GRAMMAR_META_BUDGET_BYTES = 20 * 1024;
const FORBIDDEN_PATTERNS = ["@anthropic-ai", "@capacitor"];

function walkFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

if (!fs.existsSync(ASSETS_DIR)) {
  console.error("FAIL: dist/assets not found. Run `npm run build` first.");
  process.exit(1);
}

const mainEntries = fs.readdirSync(ASSETS_DIR).filter((f) => /^index-.*\.js$/.test(f));
if (mainEntries.length !== 1) {
  console.error(`FAIL: expected exactly 1 dist/assets/index-*.js entry bundle, found ${mainEntries.length}: ${mainEntries.join(", ")}`);
  process.exit(1);
}

const mainPath = path.join(ASSETS_DIR, mainEntries[0]);
const rawBuf = fs.readFileSync(mainPath);
const gzipBuf = zlib.gzipSync(rawBuf);
const rawKb = (rawBuf.length / 1024).toFixed(2);
const gzipKb = (gzipBuf.length / 1024).toFixed(2);

if (rawBuf.length >= MAIN_JS_BUDGET_BYTES) {
  console.error(`FAIL: ${mainEntries[0]} size ${rawKb} KB >= budget 350 KB`);
  process.exit(1);
}

const distFiles = walkFiles(DIST_DIR).filter((f) => /\.(?:js|html)$/i.test(f));
for (const file of distFiles) {
  const txt = fs.readFileSync(file, "utf8");
  for (const pat of FORBIDDEN_PATTERNS) {
    if (txt.includes(pat)) {
      console.error(`FAIL: forbidden reference "${pat}" found in ${path.relative(process.cwd(), file)}`);
      process.exit(1);
    }
  }
}

const manifestPath = path.join(DIST_DIR, "precache-manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error("FAIL: dist/precache-manifest.json missing");
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { assets?: unknown };
if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) {
  console.error("FAIL: dist/precache-manifest.json has empty or invalid assets list");
  process.exit(1);
}

if (!fs.existsSync(GRAMMAR_META_PATH)) {
  console.error("FAIL: public/atlas/grammar-meta.json missing");
  process.exit(1);
}
const grammarMetaBytes = fs.statSync(GRAMMAR_META_PATH).size;
if (grammarMetaBytes >= GRAMMAR_META_BUDGET_BYTES) {
  console.error(`FAIL: public/atlas/grammar-meta.json size ${grammarMetaBytes} >= budget ${GRAMMAR_META_BUDGET_BYTES}`);
  process.exit(1);
}

console.log(
  `OK: ${mainEntries[0]} = ${rawKb} KB raw (${gzipKb} KB gzip) < 350 KB; ${manifest.assets.length} precache assets; grammar-meta.json = ${(grammarMetaBytes / 1024).toFixed(2)} KB; 0 forbidden refs.`,
);
