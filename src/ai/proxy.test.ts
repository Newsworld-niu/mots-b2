import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeBaseUrl } from "./config.ts";
import { AiError, directUrl, fetchWithTimeout, proxyUrl, resolveOpenAiEndpoint, toResponse } from "./proxy.ts";

test("in the app each service is called at its own address; Azure by region", () => {
  assert.equal(directUrl("openai", "/v1/chat/completions"), "https://api.openai.com/v1/chat/completions");
  assert.equal(directUrl("deepseek", "/chat/completions"), "https://api.deepseek.com/chat/completions");
  assert.equal(directUrl("openrouter", "/api/v1/chat/completions"), "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(directUrl("anthropic"), "https://api.anthropic.com");
  assert.equal(directUrl("azure", "/westeurope/cognitiveservices/v1"), "https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1");
  assert.throws(() => directUrl("azure", "/evil.example.com/x"));
  assert.equal(directUrl("azurestt", "/westeurope/speech/recognition/conversation/cognitiveservices/v1?language=fr-FR"), "https://westeurope.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=fr-FR");
  assert.throws(() => directUrl("azurestt", "/evil.example.com/x"));
  assert.throws(() => directUrl("elsewhere", "/x"));
});

test("outside the app requests go to the local forwarder", () => {
  assert.equal(proxyUrl("openai", "/v1/models"), "/ai-proxy/openai/v1/models");
});

test("a native answer becomes a fetch Response: parsed JSON, base64 bytes, error text", async () => {
  const json = toResponse({ status: 200, headers: { "Content-Type": "application/json", "Content-Encoding": "gzip", null: "HTTP/1.1 200 OK" }, data: { choices: [{ message: { content: "é" } }] } });
  assert.equal(json.headers.get("content-encoding"), null);
  assert.deepEqual(await json.json(), { choices: [{ message: { content: "é" } }] });

  const audio = toResponse({ status: 200, headers: { "Content-Type": "audio/mpeg" }, data: Buffer.from([0xff, 0xf3, 0, 1]).toString("base64") });
  assert.deepEqual([...new Uint8Array(await audio.arrayBuffer())], [0xff, 0xf3, 0, 1]);

  const sse = toResponse({ status: 200, headers: { "content-type": "text/event-stream" }, data: Buffer.from("event: ping\ndata: {}\n\n", "utf8").toString("base64") });
  assert.equal(await sse.text(), "event: ping\ndata: {}\n\n");

  const denied = toResponse({ status: 401, headers: { "Content-Type": "text/plain" }, data: "Access denied" });
  assert.equal(denied.ok, false);
  assert.equal(await denied.text(), "Access denied");

  const failed = toResponse({ status: 429, headers: { "Content-Type": "application/json" }, data: { error: { message: "quota" } } });
  assert.equal((await failed.json()).error.message, "quota");
});

test("sanitizeBaseUrl validates HTTPS / localhost origins and resolveOpenAiEndpoint avoids double /v1", () => {
  assert.equal(sanitizeBaseUrl("https://relay.example.com/"), "https://relay.example.com");
  assert.equal(sanitizeBaseUrl("https://api.groq.com/openai/v1/"), "https://api.groq.com/openai/v1");
  assert.equal(sanitizeBaseUrl("http://localhost:11434/v1/"), "http://localhost:11434/v1");
  assert.equal(sanitizeBaseUrl("http://evil.example.com/v1"), "");
  assert.equal(sanitizeBaseUrl("javascript:alert(1)"), "");

  assert.equal(resolveOpenAiEndpoint("", "/chat/completions"), "/ai-proxy/openai/v1/chat/completions");
  assert.equal(resolveOpenAiEndpoint("https://relay.example.com", "/chat/completions"), "https://relay.example.com/v1/chat/completions");
  assert.equal(resolveOpenAiEndpoint("https://relay.example.com/v1", "/models"), "https://relay.example.com/v1/models");
  assert.equal(resolveOpenAiEndpoint("https://api.groq.com/openai/v1", "/audio/transcriptions"), "https://api.groq.com/openai/v1/audio/transcriptions");
  assert.equal(resolveOpenAiEndpoint("https://dashscope.aliyuncs.com/compatible-mode/v1", "/chat/completions"), "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions");
});

test("fetchWithTimeout rejects with clear AiError timeout message", async () => {
  const hanging: typeof fetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    });
  await assert.rejects(
    () => fetchWithTimeout("https://example.com", undefined, 25, "OpenAI", hanging),
    (err: unknown) => err instanceof AiError && err.message.includes("OpenAI 请求超时"),
  );
});
