import fs from "node:fs";
import path from "node:path";

const STYLES_DIR = path.resolve("src/styles");
const SRC_DIR = path.resolve("src");

const RUNTIME_VAR_WHITELIST = new Set([
  "--hue",
  "--len",
  "--h",
  "--done",
  "--seen",
  "--i",
  "--c",
]);

const CANONICAL_BREAKPOINTS = new Set([559, 560, 759, 760, 959, 960, 1199, 1200]);

function walkFiles(dir: string, pred: (name: string) => boolean): string[] {
  const out: string[] = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkFiles(full, pred));
    else if (pred(ent.name)) out.push(full);
  }
  return out.sort();
}

const cssFiles = walkFiles(STYLES_DIR, (n) => n.endsWith(".css"));
const definedTokens = new Set<string>();

for (const file of cssFiles) {
  const content = fs.readFileSync(file, "utf8");
  for (const m of content.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) {
    definedTokens.add(m[1]);
  }
}

const errors: string[] = [];

for (const file of cssFiles) {
  const rel = path.relative(process.cwd(), file);
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, idx) => {
    for (const m of line.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g)) {
      const token = m[1];
      if (!definedTokens.has(token) && !RUNTIME_VAR_WHITELIST.has(token)) {
        errors.push(`${rel}:${idx + 1} undefined CSS token "${token}"`);
      }
    }
    if (line.includes("@media")) {
      for (const wm of line.matchAll(/\b(?:min|max)-width\s*:\s*(\d+)px/g)) {
        const px = Number(wm[1]);
        if (!CANONICAL_BREAKPOINTS.has(px)) {
          errors.push(`${rel}:${idx + 1} non-canonical @media breakpoint "${wm[0]}" (allowed: ${[...CANONICAL_BREAKPOINTS].join(", ")}px)`);
        }
      }
    }
  });
}

const tsFiles = walkFiles(SRC_DIR, (n) => /\.(?:ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) && n !== "test-dom.ts");
for (const file of tsFiles) {
  const rel = path.relative(process.cwd(), file);
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, idx) => {
    for (const m of line.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g)) {
      const token = m[1];
      if (!definedTokens.has(token) && !RUNTIME_VAR_WHITELIST.has(token)) {
        errors.push(`${rel}:${idx + 1} undefined CSS token "${token}"`);
      }
    }
  });
}

if (errors.length > 0) {
  console.error(`FAIL: ${errors.length} CSS token / breakpoint violation(s):`);
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log(`OK: ${cssFiles.length} CSS modules checked; ${definedTokens.size} tokens defined; 0 undefined vars; 0 non-canonical breakpoints.`);
