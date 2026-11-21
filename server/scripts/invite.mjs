import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, "..");

function parseEnvFile(filePath) {
  const out = {};
  if (!existsSync(filePath)) return out;
  const content = readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function resolveSyncUrl() {
  if (process.env.SYNC_URL) return process.env.SYNC_URL.trim();
  const deployEnv = parseEnvFile(path.join(serverDir, ".deploy.env"));
  if (deployEnv.SYNC_URL) return deployEnv.SYNC_URL.trim();
  return "http://127.0.0.1:7071";
}

function resolveAdminKey() {
  if (process.env.ADMIN_KEY) return process.env.ADMIN_KEY.trim();
  const adminKeyPath = path.join(serverDir, ".admin-key");
  if (existsSync(adminKeyPath)) {
    const key = readFileSync(adminKeyPath, "utf8").trim();
    if (key) return key;
  }
  const localSettingsPath = path.join(serverDir, "local.settings.json");
  if (existsSync(localSettingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(localSettingsPath, "utf8"));
      const key = settings?.Values?.ADMIN_KEY;
      if (typeof key === "string" && key.trim()) return key.trim();
    } catch {
      // Ignore malformed local.settings.json
    }
  }
  return "";
}

function resolveCount() {
  const arg = process.argv[2];
  if (arg === undefined) return 1;
  const n = Number(arg);
  if (!Number.isInteger(n) || n < 1 || n > 20) {
    console.error("Usage: node scripts/invite.mjs [count (1..20)]");
    process.exit(1);
  }
  return n;
}

const syncUrl = resolveSyncUrl().replace(/\/+$/, "");
const adminKey = resolveAdminKey();
const count = resolveCount();

if (!adminKey) {
  console.error(
    "Missing ADMIN_KEY (set env ADMIN_KEY, server/.admin-key, or server/local.settings.json Values.ADMIN_KEY).",
  );
  process.exit(1);
}

const res = await fetch(`${syncUrl}/api/admin/invites`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-admin-key": adminKey,
  },
  body: JSON.stringify({ count }),
});

if (!res.ok) {
  const text = await res.text();
  console.error(`Request failed (${res.status}): ${text}`);
  process.exit(1);
}

const data = await res.json();
for (const code of data.invites ?? []) {
  console.log(code);
}
