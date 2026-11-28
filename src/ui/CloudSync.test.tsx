import { resetTestDom, testWindow } from "../test-dom";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

// CloudSync talks to the page's own origin when no VITE_SYNC_URL is set: give the test page one before loading it
(globalThis as Record<string, unknown>).location = testWindow.location;

const { defaultAiConfig, getAiConfig, getUnconfirmedBaseUrls, reloadAiConfig, setAiConfig, setUnconfirmedBaseUrls } = await import("../ai/config");
const { getAiSyncPrefs, reloadAiSyncPrefs, setSyncKeysEnabled } = await import("../sync/ai-sync");
const { reloadSyncState, resetSyncState, setSyncState } = await import("../sync/state");
const { CloudSync } = await import("./CloudSync");
const { AiSettings, resetKnownModelsForTest } = await import("./AiSettings");

const realFetch = globalThis.fetch;
const KEYS = { openai: "sk-ui-openai-1234567890", deepseek: "", anthropic: "", gemini: "AIzaSy-ui-gemini-123456", openrouter: "", azure: "azure-ui-key-1234567890", stt: "" };

beforeEach(() => {
  resetTestDom();
  reloadAiConfig();
  reloadAiSyncPrefs();
  reloadSyncState();
  resetKnownModelsForTest();
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input).endsWith("/ai-proxy/ping")) return new Response("no forwarder", { status: 404 });
    return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
});

afterEach(() => {
  cleanup();
  resetSyncState();
  resetTestDom();
  globalThis.fetch = realFetch;
});

const keySwitches = () => screen.getAllByRole("switch", { name: "将 API Key 一并纳入端到端加密同步" }) as HTMLInputElement[];
const configSwitches = () => screen.getAllByRole("switch", { name: "同步 AI 接口配置" }) as HTMLInputElement[];

test("云同步 shows both AI sync switches with the E2EE and sync-code notices, and no outdated 'AI Key 永不上传'", () => {
  render(<CloudSync />);
  const panel = screen.getByRole("group", { name: "AI 接口跨设备同步" });
  assert.equal((within(panel).getByRole("switch", { name: "同步 AI 接口配置" }) as HTMLInputElement).checked, true, "config sync on by default");
  assert.equal((within(panel).getByRole("switch", { name: "将 API Key 一并纳入端到端加密同步" }) as HTMLInputElement).checked, false, "key sync off by default");
  const text = document.body.textContent ?? "";
  assert.match(text, /HKDF \+ AES-GCM/);
  assert.match(text, /服务器只保存密文，无法解密读取明文/);
  assert.match(text, /请妥善保管个人同步码，切勿泄露给他人/);
  assert.match(text, /关闭 Key 同步后本机 Key 保留，下一次云同步成功后云端最新存档将不再包含 API Key/);
  assert.match(text, /默认仅同步非敏感 AI 配置，可选将 API Key 纳入端到端加密存档/);
  assert.doesNotMatch(text, /AI Key 永不上传/);
});

test("the switches in 云同步 and AI 接口 move together and switching off keeps every local key", async () => {
  setAiConfig((c) => ({ ...c, keys: { ...c.keys, openai: KEYS.openai, gemini: KEYS.gemini, azure: KEYS.azure } }));
  render(
    <>
      <CloudSync />
      <AiSettings />
    </>,
  );
  assert.equal(keySwitches().length, 2);
  assert.match(document.body.textContent ?? "", /当前尚未配对；预设好下方选项后，在上方开通或输入同步码即可生效/);
  assert.match(document.body.textContent ?? "", /当前尚未开启云同步；预设好下方选项后，前往「我的 → 云同步」配对即可生效/);
  assert.match(document.body.textContent ?? "", /手动导出的 JSON 备份永不含 Key/);
  assert.doesNotMatch(document.body.textContent ?? "", /不会写进备份。/);

  fireEvent.click(keySwitches()[0]);
  assert.deepEqual(keySwitches().map((s) => s.checked), [true, true], "turning it on in 云同步 shows in AI 接口");
  assert.equal(getAiSyncPrefs().keyPolicy, "enabled");

  fireEvent.click(keySwitches()[1]);
  assert.deepEqual(keySwitches().map((s) => s.checked), [false, false]);
  assert.equal(getAiSyncPrefs().keyPolicy, "disabled");
  assert.equal(getAiConfig().keys.openai, KEYS.openai, "keys kept after switching key sync off");

  // turning key sync on while config sync is off turns both on; turning config sync off turns both off
  fireEvent.click(configSwitches()[1]);
  assert.deepEqual(configSwitches().map((s) => s.checked), [false, false]);
  fireEvent.click(keySwitches()[0]);
  assert.deepEqual(configSwitches().map((s) => s.checked), [true, true]);
  assert.deepEqual(keySwitches().map((s) => s.checked), [true, true]);
  fireEvent.click(configSwitches()[0]);
  assert.deepEqual(keySwitches().map((s) => s.checked), [false, false]);
  assert.equal(getAiSyncPrefs().configPolicy, "disabled");
  assert.equal(getAiConfig().keys.gemini, KEYS.gemini);
  assert.equal(getAiConfig().keys.azure, KEYS.azure);
});

test("AI 接口 shows the paired sync status and the pending state after switching off", () => {
  setAiConfig((c) => ({ ...c, keys: { ...c.keys, openai: KEYS.openai } }));
  act(() => {
    setSyncState({ code: "mb2_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk1234", authVersion: 2, lastOkAt: Date.now(), lastError: null });
  });
  render(<AiSettings />);
  assert.match(document.body.textContent ?? "", /已加密同步/);
  act(() => setSyncKeysEnabled(true));
  assert.match(document.body.textContent ?? "", /待同步至云端/);
  act(() => setSyncKeysEnabled(false));
  assert.match(document.body.textContent ?? "", /本机已关闭，等待同步更新云端/);
});

test("an address changed by cloud sync is confirmed with 信任并启用", () => {
  setAiConfig({ ...defaultAiConfig(), keys: { ...defaultAiConfig().keys, openai: KEYS.openai }, openaiBaseUrl: "https://relay.example.com/v1" });
  setUnconfirmedBaseUrls({ openai: "https://relay.example.com/v1", gemini: "https://not-current.example.com" });
  render(<AiSettings />);
  const banner = screen.getByRole("alert");
  assert.match(banner.textContent ?? "", /云同步更新了OpenAI 兼容接口的自定义地址（https:\/\/relay\.example\.com\/v1）/);
  assert.match(banner.textContent ?? "", /为保护本机原有 Key，确认无误后请点击启用/);
  assert.equal(screen.getAllByRole("alert").length, 1, "only addresses still in use are shown");
  fireEvent.click(within(banner).getByRole("button", { name: "信任并启用" }));
  assert.equal(screen.queryByRole("alert"), null);
  assert.equal(getUnconfirmedBaseUrls().openai, undefined);
  assert.equal(getAiConfig().keys.openai, KEYS.openai);
});

test("re-enabling config sync shows 待同步至云端, legacy auth disables key switch, and failed wizard probe keeps endpoint guard", async () => {
  const { setSyncConfigEnabled, setAiSyncPrefsForTest } = await import("../sync/ai-sync");
  setAiConfig({
    ...defaultAiConfig(),
    keys: { ...defaultAiConfig().keys, openai: KEYS.openai, deepseek: "sk-ds-working-123456" },
    openaiBaseUrl: "https://untrusted-synced.example.com/v1",
    text: { provider: "deepseek", model: "deepseek-chat" },
  });
  setUnconfirmedBaseUrls({ openai: "https://untrusted-synced.example.com/v1" });

  // 1. Re-enabling config sync after a synced disable shows "待同步至云端" (not "本机已关闭")
  act(() => {
    setSyncState({ code: "mb2_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk1234", authVersion: 2, lastOkAt: Date.now(), lastError: null });
    setAiSyncPrefsForTest({ configPolicy: "disabled", keyPolicy: "disabled", policyRev: 1, syncedPolicyRev: 1, lastSwitchAction: undefined });
  });
  const { rerender } = render(<AiSettings />);
  act(() => setSyncConfigEnabled(true));
  assert.match(document.body.textContent ?? "", /待同步至云端/);
  assert.doesNotMatch(document.body.textContent ?? "", /本机已关闭，等待同步更新云端/);

  // 2. Wizard probing a different candidate URL that fails (403) must NOT clear the saved unconfirmed guard
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/ai-proxy/ping")) return new Response("no forwarder", { status: 404 });
    if (url.includes("candidate-relay.example.com")) {
      return new Response(JSON.stringify({ error: { message: "Forbidden" } }), { status: 403, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  fireEvent.click(screen.getByRole("button", { name: /OpenAI \/ 兼容/ }));
  const wizBaseInput = screen.getByPlaceholderText("https://your-relay.com/v1");
  fireEvent.change(wizBaseInput, { target: { value: "https://candidate-relay.example.com/v1" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /保存并自动配齐/ }));
  });
  assert.equal(getUnconfirmedBaseUrls().openai, "https://untrusted-synced.example.com/v1", "failed wizard probe preserved endpoint guard");
  assert.ok(screen.getByRole("alert"));

  // 3. Legacy v1 account disables the key switch and displays warning
  act(() => {
    setSyncState({ code: "mb2_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk1234", authVersion: 1, lastOkAt: Date.now(), lastError: null });
  });
  rerender(<AiSettings />);
  const keySw = screen.getByRole("switch", { name: "将 API Key 一并纳入端到端加密同步" }) as HTMLInputElement;
  assert.equal(keySw.disabled, true);
  assert.match(document.body.textContent ?? "", /当前同步账号使用旧版认证（服务器知道同步码），为安全起见不会上传 API Key/);
});
