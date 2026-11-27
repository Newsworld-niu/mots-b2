import assert from "node:assert/strict";
import { test } from "node:test";

/** In-memory localStorage installed before the settings module loads (it reads the saved settings on import). */
const map = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  get length() {
    return map.size;
  },
  key: (i: number) => [...map.keys()][i] ?? null,
  getItem: (k: string) => map.get(k) ?? null,
  setItem: (k: string, v: string) => void map.set(k, String(v)),
  removeItem: (k: string) => void map.delete(k),
  clear: () => map.clear(),
};

const SECRET = "AIzaSyFakeTestSecret999";

test("a v1 settings payload without Gemini loads with empty Gemini fields and keeps its keys, STT and voices", async () => {
  map.set(
    "word-atlas:ai:v1",
    JSON.stringify({
      keys: { openai: "sk-old", deepseek: "sk-ds" },
      openaiBaseUrl: "https://relay.example.com/v1",
      stt: { provider: "openai", baseUrl: "", apiKey: "", model: "whisper-1" },
      azureVoice: "fr-FR-VivienneMultilingualNeural",
      text: { provider: "deepseek", model: "deepseek-chat" },
    }),
  );
  const { getAiConfig, setAiConfig } = await import("./config.ts");
  const c = getAiConfig();
  assert.equal(c.keys.gemini, "");
  assert.equal(c.geminiBaseUrl, "");
  assert.equal(c.keys.openai, "sk-old");
  assert.equal(c.keys.deepseek, "sk-ds");
  assert.equal(c.openaiBaseUrl, "https://relay.example.com/v1");
  assert.equal(c.stt.provider, "openai");
  assert.equal(c.azureVoice, "fr-FR-VivienneMultilingualNeural");

  setAiConfig((x) => ({ ...x, keys: { ...x.keys, gemini: SECRET }, geminiBaseUrl: "https://gm.example.com/" }));
  const saved = JSON.parse(map.get("word-atlas:ai:v1") ?? "{}");
  assert.equal(saved.keys.gemini, SECRET);
  assert.equal(saved.geminiBaseUrl, "https://gm.example.com");
  assert.equal(saved.keys.openai, "sk-old");
});

test("backups never carry the Gemini key (or any AI settings)", async () => {
  const { getAiConfig } = await import("./config.ts");
  assert.equal(getAiConfig().keys.gemini, SECRET);
  const { exportBackup, exportBackupAsync } = await import("../store/store.ts");
  const sync = exportBackup();
  const full = await exportBackupAsync();
  for (const text of [sync, full]) {
    assert.ok(text.includes('"app": "word-atlas"'));
    assert.ok(!text.includes(SECRET), "backup must not contain the Gemini key");
    assert.ok(!text.includes("FakeTestSecret"));
    assert.ok(!text.includes("word-atlas:ai:v1"));
    assert.ok(!text.includes("geminiBaseUrl"));
  }
});
