import { resetTestDom } from "../test-dom";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { defaultAiConfig, getAiConfig, setAiConfig, type AiConfig } from "../ai/config";
import { clearGeminiCompatCache } from "../ai/gemini";
import { AiSettings, resetKnownModelsForTest } from "./AiSettings";

const GEMINI_KEY = "AIzaSy-ui-test-key";
const realFetch = globalThis.fetch;
const calls: Array<{ url: string; headers: Record<string, string> }> = [];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const sseOk = () =>
  new Response(`data: ${JSON.stringify({ candidates: [{ content: { role: "model", parts: [{ text: '{"ok":true}' }] }, finishReason: "STOP" }] })}\r\n\r\n`, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });

/** Fake services: no local forwarder, a Gemini model list, and `generate` for the JSON probe. */
function mockServices(generate: () => Response) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    if (url.endsWith("/ai-proxy/ping")) return new Response("no forwarder", { status: 404 });
    if (url.includes("/models?pageSize")) return json({ models: [{ name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] }, { name: "models/gemini-2.5-pro", supportedGenerationMethods: ["generateContent"] }] });
    if (url.includes(":streamGenerateContent") || url.includes(":generateContent")) return generate();
    return json({ data: [] });
  }) as typeof fetch;
}

const working = (): AiConfig => ({
  ...defaultAiConfig(),
  keys: { ...defaultAiConfig().keys, deepseek: "sk-ds-working", openai: "sk-oa-working" },
  text: { provider: "deepseek", model: "deepseek-chat" },
  vision: { provider: "openai", model: "gpt-5-mini" },
  image: { provider: "openai", model: "gpt-image-1" },
});

beforeEach(() => {
  calls.length = 0;
  resetKnownModelsForTest();
  clearGeminiCompatCache();
});

afterEach(() => {
  cleanup();
  resetTestDom();
  globalThis.fetch = realFetch;
});

const wizardKeyInput = () => screen.getByText("Google Gemini API Key", { selector: "span" }).closest("label")!.querySelector("input")!;

test("1 步向导 · Gemini: a failed probe reports the reason and leaves the working DeepSeek / OpenAI setup alone", async () => {
  setAiConfig(working());
  const before = localStorage.getItem("word-atlas:ai:v1");
  mockServices(() => json({ error: { code: 403, message: "Permission denied: API not enabled" } }, 403));
  render(<AiSettings />);

  fireEvent.click(screen.getByRole("button", { name: /Google Gemini.*官方直连/ }));
  fireEvent.change(wizardKeyInput(), { target: { value: GEMINI_KEY } });
  const base = screen.getByPlaceholderText("https://your-gemini-proxy.com");
  fireEvent.change(base, { target: { value: "http://evil.example.com" } });
  assert.ok(screen.getAllByText(/须以 https:\/\/ 开头/).length > 0);
  fireEvent.click(screen.getByRole("button", { name: /保存并自动配齐/ }));
  await waitFor(() => assert.match(screen.getByRole("status").textContent ?? "", /须以 https/));
  assert.equal(calls.filter((c) => c.url.includes("googleapis") || c.url.includes("evil")).length, 0);

  fireEvent.change(base, { target: { value: "https://gm.example.com" } });
  fireEvent.click(screen.getByRole("button", { name: /保存并自动配齐/ }));
  await waitFor(() => assert.match(screen.getByRole("status").textContent ?? "", /连接失败：Google Gemini 返回 403/));
  assert.match(screen.getByRole("status").textContent ?? "", /原有的 AI 服务分工保持不变/);
  assert.doesNotMatch(screen.getByRole("status").textContent ?? "", /连接成功/);

  const c = getAiConfig();
  assert.deepEqual(c.text, { provider: "deepseek", model: "deepseek-chat" });
  assert.deepEqual(c.vision, { provider: "openai", model: "gpt-5-mini" });
  assert.equal(c.keys.gemini, "");
  assert.equal(c.keys.deepseek, "sk-ds-working");
  assert.equal(localStorage.getItem("word-atlas:ai:v1"), before);
  // the probe went to the custom base with the key in its header only
  const probe = calls.find((x) => x.url.includes(":streamGenerateContent"));
  assert.equal(probe?.url, "https://gm.example.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse");
  assert.equal(probe?.headers["x-goog-api-key"], GEMINI_KEY);
  // the wizard keeps what was typed for a correction
  assert.equal(wizardKeyInput().value, GEMINI_KEY);
});

test("1 步向导 · Gemini: a passing probe switches 文本 and 识图 to Gemini, keeps 图片, and saves to this browser", async () => {
  setAiConfig(working());
  mockServices(sseOk);
  render(<AiSettings />);

  fireEvent.click(screen.getByRole("button", { name: /Google Gemini.*官方直连/ }));
  fireEvent.change(wizardKeyInput(), { target: { value: GEMINI_KEY } });
  fireEvent.change(screen.getByPlaceholderText("https://your-gemini-proxy.com"), { target: { value: "https://gm.example.com/" } });
  fireEvent.click(screen.getByRole("button", { name: /保存并自动配齐/ }));
  await waitFor(() => assert.match(screen.getByRole("status").textContent ?? "", /连接成功 · 已自动配齐 Google Gemini 默认模型/));

  const c = getAiConfig();
  assert.deepEqual(c.text, { provider: "gemini", model: "gemini-2.5-flash" });
  assert.deepEqual(c.vision, { provider: "gemini", model: "gemini-2.5-flash" });
  assert.deepEqual(c.image, { provider: "openai", model: "gpt-image-1" });
  assert.equal(c.geminiBaseUrl, "https://gm.example.com");
  const saved = JSON.parse(localStorage.getItem("word-atlas:ai:v1") ?? "{}");
  assert.equal(saved.keys.gemini, GEMINI_KEY);
  assert.equal(saved.keys.deepseek, "sk-ds-working");
  assert.equal(saved.text.provider, "gemini");
  assert.equal(saved.geminiBaseUrl, "https://gm.example.com");
  assert.ok(calls.every((x) => !x.url.includes(GEMINI_KEY)));
});

test("高级配置: Gemini key, base URL check, preset models without a key and a typed custom model", async () => {
  setAiConfig({ ...working(), text: { provider: "deepseek", model: "deepseek-chat" } });
  mockServices(sseOk);
  render(<AiSettings />);

  const baseInput = screen.getByPlaceholderText(/留空走官方 generativelanguage\.googleapis\.com/);
  // Valid intermediate URL stays in draft until blur (never leaks early model-list requests while typing)
  fireEvent.change(baseInput, { target: { value: "https://half-typed.example.com" } });
  assert.equal(getAiConfig().geminiBaseUrl, "");
  fireEvent.blur(baseInput);
  assert.equal(getAiConfig().geminiBaseUrl, "https://half-typed.example.com");
  // Wizard input stays synced with committed Advanced Base URL
  fireEvent.click(screen.getByRole("button", { name: /Google Gemini.*官方直连/ }));
  assert.equal((screen.getByPlaceholderText("https://your-gemini-proxy.com") as HTMLInputElement).value, "https://half-typed.example.com");

  // Invalid edit in Advanced warns, does NOT clobber the saved Base URL on blur, and blocks 测试连接
  fireEvent.change(baseInput, { target: { value: "http://evil.example.com/v1beta" } });
  assert.ok(screen.getByText(/仅支持以 https:\/\/ 开头的域名/));
  fireEvent.blur(baseInput);
  assert.equal(getAiConfig().geminiBaseUrl, "https://half-typed.example.com");

  const keyInput = screen.getByText("Google Gemini", { selector: "span" }).closest("label")!.querySelector("input")!;
  fireEvent.change(keyInput, { target: { value: GEMINI_KEY } });
  assert.equal(getAiConfig().keys.gemini, GEMINI_KEY);
  const beforeBlocked = calls.length;
  fireEvent.click(screen.getByRole("button", { name: "测试 Google Gemini 连接" }));
  assert.equal(calls.length, beforeBlocked);

  fireEvent.change(baseInput, { target: { value: "https://gm.example.com/v1beta" } });
  fireEvent.blur(baseInput);
  assert.equal(getAiConfig().geminiBaseUrl, "https://gm.example.com/v1beta");
  assert.ok(screen.getByText("Gemini 请求将发往 gm.example.com"));

  // 文本 → Gemini: before remote list loads, model combobox offers presets
  const textJob = screen.getByText("生成与批改 · 文本").closest(".ai-job") as HTMLElement;
  fireEvent.click(Array.from(textJob.querySelectorAll(".segmented button")).find((b) => b.textContent === "Gemini")!);
  assert.equal(getAiConfig().text.provider, "gemini");
  const model = textJob.querySelector('input[role="combobox"]') as HTMLInputElement;
  fireEvent.focus(model);
  const options = Array.from(textJob.querySelectorAll('[role="option"]')).map((o) => o.textContent);
  assert.deepEqual(options, [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.5-flash-lite",
    "gemini-3-flash-preview",
    "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite-preview",
    "gemini-2.0-flash",
  ]);
  fireEvent.mouseDown(Array.from(textJob.querySelectorAll('[role="option"]')).find((o) => o.textContent === "gemini-2.5-pro")!);
  assert.equal(getAiConfig().text.model, "gemini-2.5-pro");
  fireEvent.change(model, { target: { value: "gemini-exp-custom-0901" } });
  assert.equal(getAiConfig().text.model, "gemini-exp-custom-0901");
  fireEvent.blur(model);

  // pictures: Gemini offers its image models (and excludes Imagen :predict models)
  const imageJob = screen.getByText("生成图片").closest(".ai-job") as HTMLElement;
  fireEvent.click(Array.from(imageJob.querySelectorAll(".segmented button")).find((b) => b.textContent === "Gemini")!);
  assert.deepEqual(getAiConfig().image, { provider: "gemini", model: "gemini-2.5-flash-image" });
  fireEvent.focus(imageJob.querySelector('input[role="combobox"]') as HTMLInputElement);
  assert.deepEqual(
    Array.from(imageJob.querySelectorAll('[role="option"]')).map((o) => o.textContent),
    ["gemini-2.5-flash-image", "gemini-3.1-flash-lite-image"],
  );

  // 测试连接 against the custom base
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "测试 Google Gemini 连接" }));
  });
  await waitFor(() => assert.ok(calls.some((x) => x.url === "https://gm.example.com/v1beta/models/gemini-exp-custom-0901:streamGenerateContent?alt=sse")));
  await waitFor(() => assert.equal((screen.getByRole("button", { name: "测试 Google Gemini 连接" }) as HTMLButtonElement).disabled, false));
});

/* ---------- new Google projects: gemini-2.5-* listed by models.list but answering 404 ---------- */

/** A new project: the catalog names gemini-2.5-flash (and an image model), but only gemini-3-flash-preview answers. */
function mockNewGoogleProject() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    if (url.endsWith("/ai-proxy/ping")) return new Response("no forwarder", { status: 404 });
    if (url.includes("/models?pageSize"))
      return json({
        models: ["gemini-2.5-flash", "gemini-3-flash-preview", "gemini-2.5-flash-image"].map((m) => ({ name: `models/${m}`, supportedGenerationMethods: ["generateContent"] })),
      });
    if (url.includes("/models/gemini-3-flash-preview:")) return sseOk();
    if (url.includes(":streamGenerateContent") || url.includes(":generateContent"))
      return json({ error: { code: 404, status: "NOT_FOUND", message: "models/gemini-2.5-flash is no longer available to new users." } }, 404);
    return json({ data: [] });
  }) as typeof fetch;
}

test("1 步向导 · Gemini on a new Google project: adapts to gemini-3-flash-preview (never the image model) and saves it", async () => {
  setAiConfig(working());
  mockNewGoogleProject();
  render(<AiSettings />);

  fireEvent.click(screen.getByRole("button", { name: /Google Gemini.*官方直连/ }));
  fireEvent.change(wizardKeyInput(), { target: { value: GEMINI_KEY } });
  fireEvent.click(screen.getByRole("button", { name: /保存并自动配齐/ }));
  await waitFor(() => assert.match(screen.getByRole("status").textContent ?? "", /连接成功 · 已自动配齐 Google Gemini 默认模型/));
  assert.match(screen.getByRole("status").textContent ?? "", /已自动匹配可用模型 gemini-3-flash-preview/);

  const c = getAiConfig();
  assert.deepEqual(c.text, { provider: "gemini", model: "gemini-3-flash-preview" });
  assert.deepEqual(c.vision, { provider: "gemini", model: "gemini-3-flash-preview" });
  assert.equal(c.lastGoodModel?.gemini, "gemini-3-flash-preview");
  assert.ok(!calls.some((x) => x.url.includes("gemini-2.5-flash-image:")));
  const saved = JSON.parse(localStorage.getItem("word-atlas:ai:v1") ?? "{}");
  assert.equal(saved.text.model, "gemini-3-flash-preview");
});

test("高级配置 · 测试连接 on a new Google project moves 文本 / 识图 off the retired default and remembers it for the service buttons", async () => {
  setAiConfig({
    ...working(),
    keys: { ...working().keys, gemini: GEMINI_KEY },
    text: { provider: "gemini", model: "gemini-2.5-flash" },
    vision: { provider: "gemini", model: "gemini-2.5-flash" },
  });
  mockNewGoogleProject();
  render(<AiSettings />);

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "测试 Google Gemini 连接" }));
  });
  await waitFor(() => assert.equal(getAiConfig().text.model, "gemini-3-flash-preview"));
  const c = getAiConfig();
  assert.deepEqual(c.vision, { provider: "gemini", model: "gemini-3-flash-preview" });
  assert.equal(c.lastGoodModel?.gemini, "gemini-3-flash-preview");
  assert.ok(!calls.some((x) => x.url.includes("gemini-2.5-flash-image:")));
  await waitFor(() => assert.equal((screen.getByRole("button", { name: "测试 Google Gemini 连接" }) as HTMLButtonElement).disabled, false));

  // switching 文本 away and back starts from the verified model, not the retired built-in default
  const textJob = screen.getByText("生成与批改 · 文本").closest(".ai-job") as HTMLElement;
  const btn = (label: string) => Array.from(textJob.querySelectorAll(".segmented button")).find((b) => b.textContent === label)!;
  fireEvent.click(btn("DeepSeek"));
  assert.deepEqual(getAiConfig().text, { provider: "deepseek", model: "deepseek-chat" });
  fireEvent.click(btn("Gemini"));
  assert.deepEqual(getAiConfig().text, { provider: "gemini", model: "gemini-3-flash-preview" });
});

test("高级配置 · 测试连接 keeps a model typed on purpose when it fails, and does not touch it", async () => {
  setAiConfig({
    ...working(),
    keys: { ...working().keys, gemini: GEMINI_KEY },
    text: { provider: "gemini", model: "gemini-exp-typo" },
  });
  mockNewGoogleProject();
  render(<AiSettings />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "测试 Google Gemini 连接" }));
  });
  await waitFor(() => assert.equal((screen.getByRole("button", { name: "测试 Google Gemini 连接" }) as HTMLButtonElement).disabled, false));
  assert.equal(getAiConfig().text.model, "gemini-exp-typo");
  assert.equal(getAiConfig().lastGoodModel?.gemini, undefined);
});
