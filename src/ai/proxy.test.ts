import assert from "node:assert/strict";
import { test } from "node:test";
import { directUrl, proxyUrl, toResponse } from "./proxy.ts";

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
