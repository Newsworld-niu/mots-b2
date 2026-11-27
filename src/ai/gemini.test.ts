import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { DEFAULT_MODELS, GEMINI_PRESET_MODELS, defaultAiConfig, getAiConfig, sanitizeAiConfig, setAiConfig, type AiConfig } from "./config.ts";
import { aiJson, canTranscribeMultimodalAudio, geminiCanSelfHeal, testTextProvider, transcribeViaMultimodalAudio, type JsonRequest } from "./clients.ts";
import {
  buildGeminiBody,
  clearGeminiCompatCache,
  extractSuggestedGeminiModel,
  geminiTranscribeAudio,
  isGeminiModelUnavailable,
  rankGeminiTextModels,
  geminiGenerateImage,
  geminiJsonWith,
  geminiMaxOutputTokens,
  listGeminiModels,
  normalizeGeminiModel,
  toGeminiOpenApiSchema,
} from "./gemini.ts";
import { AiError, createRequestDeadline, resolveGeminiEndpoint } from "./proxy.ts";
import { estimateUsd } from "./usage.ts";
import { ESSAY_SCHEMA } from "./tasks.ts";

const KEY = "AIzaSyFakeTestSecret999";
const OK_SCHEMA = { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false };
const req = (over: Partial<JsonRequest> = {}): JsonRequest => ({ system: "Mark this.", text: "Bonjour", schema: OK_SCHEMA, schemaName: "sample", ...over });

const enc = new TextEncoder();
/** A streamed Response whose body arrives in exactly these byte pieces. */
function streamOf(pieces: Uint8Array[], type = "text/event-stream") {
  return new Response(
    new ReadableStream({
      start(c) {
        for (const p of pieces) c.enqueue(p);
        c.close();
      },
    }),
    { status: 200, headers: { "Content-Type": type } },
  );
}
const sse = (events: unknown[], eol = "\n") => enc.encode(events.map((e) => `data: ${JSON.stringify(e)}${eol}${eol}`).join(""));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const answer = (text: string, extra: Record<string, unknown> = {}) => ({ candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }], ...extra });

afterEach(() => clearGeminiCompatCache());

test("resolveGeminiEndpoint: forwarder / direct, bare origins get /v1beta, /v1beta or /v1 never doubled, gateways kept, http rejected", () => {
  assert.match(resolveGeminiEndpoint("", "/models?pageSize=100"), /^(?:\/ai-proxy\/gemini|https:\/\/generativelanguage\.googleapis\.com)\/v1beta\/models\?pageSize=100$/);
  assert.equal(
    resolveGeminiEndpoint("  ", "/models/gemini-2.5-flash:generateContent", { forceDirect: true }),
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
  );
  assert.equal(resolveGeminiEndpoint("https://gm.example.com/", "/models"), "https://gm.example.com/v1beta/models");
  assert.equal(resolveGeminiEndpoint("https://gm.example.com/v1beta", "/models"), "https://gm.example.com/v1beta/models");
  assert.equal(resolveGeminiEndpoint("https://gm.example.com/v1", "/models"), "https://gm.example.com/v1/models");
  assert.equal(
    resolveGeminiEndpoint("https://gateway.ai.cloudflare.com/v1/acct/gw/google-ai-studio", "/models/x:generateContent"),
    "https://gateway.ai.cloudflare.com/v1/acct/gw/google-ai-studio/v1beta/models/x:generateContent",
  );
  assert.equal(resolveGeminiEndpoint("http://localhost:8787", "/models"), "http://localhost:8787/v1beta/models");
  assert.throws(() => resolveGeminiEndpoint("http://evil.example.com", "/models"), (e: unknown) => e instanceof AiError && /https:\/\//.test(e.message));
});

test("normalizeGeminiModel strips models/ and google/ prefixes and path characters", () => {
  assert.equal(normalizeGeminiModel(" models/gemini-2.5-pro "), "gemini-2.5-pro");
  assert.equal(normalizeGeminiModel("google/gemini-2.5-flash"), "gemini-2.5-flash");
  assert.equal(normalizeGeminiModel("../../evil/x"), "evilx");
  assert.equal(normalizeGeminiModel("gemini-2.5-flash:streamGenerateContent?key=1"), "gemini-2.5-flashstreamGenerateContentkey1");
  assert.equal(normalizeGeminiModel(""), "gemini-2.5-flash");
  assert.equal(normalizeGeminiModel("models/"), "gemini-2.5-flash");
});

test("buildGeminiBody: systemInstruction kept apart, roles mapped and merged, files before the last user text", () => {
  const body = buildGeminiBody("gemini-2.5-flash", {
    ...req({ text: "Et maintenant ?" }),
    messages: [
      { role: "user", text: "Salut" },
      { role: "assistant", text: "Bonjour !" },
      { role: "model", text: "Ça va ?" },
      { role: "user", text: "Oui" },
    ],
    attachments: [
      { mime: "image/png", data: "iVBOR" },
      { mime: "application/pdf", data: "JVBER" },
    ],
  }) as { systemInstruction: { parts: { text: string }[] }; contents: Array<{ role: string; parts: Array<Record<string, unknown>> }>; generationConfig: Record<string, unknown> };
  assert.deepEqual(body.systemInstruction, { parts: [{ text: "Mark this." }] });
  assert.deepEqual(
    body.contents.map((c) => c.role),
    ["user", "model", "user"],
  );
  assert.ok(!body.contents.some((c) => c.role === "system"));
  assert.deepEqual(body.contents[1].parts, [{ text: "Bonjour !" }, { text: "Ça va ?" }]);
  assert.deepEqual(body.contents[2].parts, [
    { inlineData: { mimeType: "image/png", data: "iVBOR" } },
    { inlineData: { mimeType: "application/pdf", data: "JVBER" } },
    { text: "Oui" },
    { text: "Et maintenant ?" },
  ]);
  assert.equal(body.generationConfig.responseMimeType, "application/json");
  assert.deepEqual(body.generationConfig.responseJsonSchema, OK_SCHEMA);
  assert.equal("responseSchema" in body.generationConfig, false);
  assert.equal(body.generationConfig.temperature, 0);

  const single = buildGeminiBody("gemini-2.5-flash", req({ attachments: [{ mime: "image/jpeg", data: "abc" }] })) as { contents: unknown[] };
  assert.deepEqual(single.contents, [{ role: "user", parts: [{ inlineData: { mimeType: "image/jpeg", data: "abc" } }, { text: "Bonjour" }] }]);

  // Attachment-only final user turn after a model reply creates a trailing user turn rather than mutating history
  const fileOnly = buildGeminiBody("gemini-2.5-flash", {
    ...req({ text: "" }),
    messages: [
      { role: "user", text: "Voici la première page" },
      { role: "model", text: "Envoyez la suivante" },
    ],
    attachments: [{ mime: "image/png", data: "page2" }],
  }) as { contents: Array<{ role: string; parts: unknown[] }> };
  assert.deepEqual(fileOnly.contents, [
    { role: "user", parts: [{ text: "Voici la première page" }] },
    { role: "model", parts: [{ text: "Envoyez la suivante" }] },
    { role: "user", parts: [{ inlineData: { mimeType: "image/png", data: "page2" } }] },
  ]);
});

test("buildGeminiBody modes: openapi_schema excludes responseJsonSchema; json_mime / text inline the schema", () => {
  const o = buildGeminiBody("gemini-2.5-flash", req(), "openapi_schema") as { generationConfig: Record<string, unknown> };
  assert.equal("responseJsonSchema" in o.generationConfig, false);
  assert.deepEqual(o.generationConfig.responseSchema, { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] });
  const m = buildGeminiBody("gemini-2.5-flash", req(), "json_mime") as { systemInstruction: { parts: { text: string }[] }; generationConfig: Record<string, unknown> };
  assert.equal(m.generationConfig.responseMimeType, "application/json");
  assert.ok(!("responseSchema" in m.generationConfig) && !("responseJsonSchema" in m.generationConfig));
  assert.match(m.systemInstruction.parts[0].text, /Mark this\.[\s\S]*"properties"/);
  const t = buildGeminiBody("gemini-2.5-flash", req(), "text") as { systemInstruction: { parts: { text: string }[] }; generationConfig: Record<string, unknown> };
  assert.deepEqual(Object.keys(t.generationConfig).sort(), ["maxOutputTokens", "temperature"]);
  assert.match(t.systemInstruction.parts[0].text, /"properties"/);
  // Gemini 3 keeps its default temperature even when deterministic tasks pass temperature: 0; non-zero creative temperatures still apply
  const g3 = buildGeminiBody("gemini-3.8-flash", req(), "json_schema") as { generationConfig: Record<string, unknown> };
  assert.equal("temperature" in g3.generationConfig, false);
  const g3Zero = buildGeminiBody("gemini-3.5-flash-lite", req({ temperature: 0 }), "json_schema") as { generationConfig: Record<string, unknown> };
  assert.equal("temperature" in g3Zero.generationConfig, false);
  const g3t = buildGeminiBody("gemini-3.8-flash", req({ temperature: 0.6 })) as { generationConfig: Record<string, unknown> };
  assert.equal(g3t.generationConfig.temperature, 0.6);
});

test("toGeminiOpenApiSchema: number enums become descriptions, string enums (with \"\") and nesting kept", () => {
  const essay = toGeminiOpenApiSchema(ESSAY_SCHEMA) as { properties: { scores: { properties: Record<string, Record<string, unknown>> } } };
  const firstScore = Object.values(essay.properties.scores.properties)[0];
  assert.equal(firstScore.type, "number");
  assert.equal("enum" in firstScore, false);
  assert.equal(firstScore.description, "Allowed values: 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5");
  assert.ok(!JSON.stringify(essay).includes("additionalProperties"));
  const recognize = {
    $schema: "x",
    type: "object",
    additionalProperties: false,
    properties: {
      level: { type: "string", enum: ["", "A1", "B2"] },
      items: { type: "array", items: { type: "object", additionalProperties: false, properties: { n: { type: "integer", enum: [1, 2], description: "count" } }, required: ["n"] } },
    },
    required: ["level", "items"],
  };
  assert.deepEqual(toGeminiOpenApiSchema(recognize), {
    type: "object",
    properties: {
      level: { type: "string", enum: ["", "A1", "B2"] },
      items: { type: "array", items: { type: "object", properties: { n: { type: "integer", description: "count (Allowed values: 1, 2)" } }, required: ["n"] } },
    },
    required: ["level", "items"],
  });
});

test("thinking models get output headroom on small budgets; 2.0 / 1.5 stay within 8192", () => {
  assert.equal(geminiMaxOutputTokens("gemini-2.5-flash", 64), 4160);
  assert.equal(geminiMaxOutputTokens("gemini-2.5-pro", 500), 4596);
  assert.equal(geminiMaxOutputTokens("gemini-3.8-flash", undefined), 12288);
  assert.equal(geminiMaxOutputTokens("gemini-2.5-flash", 64000), 32768);
  assert.equal(geminiMaxOutputTokens("gemini-2.0-flash", 64), 1024);
  assert.equal(geminiMaxOutputTokens("gemini-1.5-pro", 20000), 8192);
  const body = buildGeminiBody("gemini-2.5-flash", req({ maxTokens: 64 })) as { generationConfig: { maxOutputTokens: number } };
  assert.equal(body.generationConfig.maxOutputTokens, 4160);
});

test("geminiJsonWith streams SSE: split UTF-8, CRLF, thoughts skipped, onDelta, usage counted once, key in header only", async () => {
  const { getAiUsage, resetAiUsage } = await import("./usage.ts");
  resetAiUsage();
  const bytes = sse(
    [
      { candidates: [{ content: { parts: [{ text: "pensons…", thought: true }] } }], usageMetadata: { promptTokenCount: 10, thoughtsTokenCount: 5 } },
      { candidates: [{ content: { parts: [{ text: '{"ok":true,"note":"élève ' }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4, thoughtsTokenCount: 5 } },
      { candidates: [{ content: { parts: [{ text: '中文"}' }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 9, thoughtsTokenCount: 5 } },
    ],
    "\r\n",
  );
  // cut inside the multi-byte "é" and inside "中"
  const cutA = bytes.indexOf(0xc3) + 1;
  const cutB = bytes.indexOf(0xe4) + 2;
  const deltas: string[] = [];
  let seenUrl = "";
  let seenHeaders: Record<string, string> = {};
  const out = await geminiJsonWith("models/gemini-2.5-flash", req(), {
    apiKey: KEY,
    onDelta: (d) => deltas.push(d),
    fetcher: async (url, init) => {
      seenUrl = String(url);
      seenHeaders = init?.headers as Record<string, string>;
      return streamOf([bytes.slice(0, cutA), bytes.slice(cutA, cutB), bytes.slice(cutB)]);
    },
  });
  assert.deepEqual(out, { ok: true, note: "élève 中文" });
  assert.equal(seenUrl, "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse");
  assert.ok(!seenUrl.includes(KEY) && !seenUrl.includes("key="));
  assert.equal(seenHeaders["x-goog-api-key"], KEY);
  assert.deepEqual(deltas, ['{"ok":true,"note":"élève ', '中文"}']);
  const u = getAiUsage();
  assert.equal(u.calls, 1);
  assert.equal(u.promptTokens, 10);
  assert.equal(u.completionTokens, 14);
});

test("geminiJsonWith: non-stream single object and chunk-array JSON answers", async () => {
  let url = "";
  const one = await geminiJsonWith("gemini-2.5-flash", req(), { apiKey: KEY, stream: false, fetcher: async (u) => ((url = String(u)), json(answer('{"ok":true}'))) });
  assert.deepEqual(one, { ok: true });
  assert.match(url, /:generateContent$/);
  const arr = await geminiJsonWith("gemini-2.5-flash", req(), {
    apiKey: KEY,
    stream: false,
    fetcher: async () => json([{ candidates: [{ content: { parts: [{ text: '{"ok":' }] } }] }, { candidates: [{ content: { parts: [{ text: "true}" }] }, finishReason: "STOP" }] }]),
  });
  assert.deepEqual(arr, { ok: true });
});

test("a custom base that 404s :streamGenerateContent falls back to :generateContent once and remembers it", async () => {
  const urls: string[] = [];
  const fetcher: typeof fetch = async (u) => {
    urls.push(String(u));
    if (String(u).includes(":streamGenerateContent")) return new Response("not found", { status: 404 });
    return json(answer('{"ok":true}'));
  };
  const opts = { apiKey: KEY, geminiBaseUrl: "https://relay.example.com", fetcher };
  assert.deepEqual(await geminiJsonWith("gemini-2.5-flash", req(), opts), { ok: true });
  assert.deepEqual(urls, [
    "https://relay.example.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse",
    "https://relay.example.com/v1beta/models/gemini-2.5-flash:generateContent",
  ]);
  urls.length = 0;
  await geminiJsonWith("gemini-2.5-flash", req(), opts);
  assert.deepEqual(urls, ["https://relay.example.com/v1beta/models/gemini-2.5-flash:generateContent"]);
  // the official address never gets this retry: a 404 there is a wrong model name
  urls.length = 0;
  await assert.rejects(
    () => geminiJsonWith("gemini-nope", req(), { apiKey: KEY, fetcher: async (u) => (urls.push(String(u)), new Response("{}", { status: 404 })) }),
    /404（模型名或接口地址不对：gemini-nope）/,
  );
  assert.equal(urls.length, 1);

  // a typo'd model 404 on a fresh relay fails both endpoints and must NOT disable streaming for valid models on that relay
  clearGeminiCompatCache();
  urls.length = 0;
  await assert.rejects(
    () =>
      geminiJsonWith("gemini-typo", req(), {
        apiKey: KEY,
        geminiBaseUrl: "https://relay2.example.com",
        fetcher: async (u) => (urls.push(String(u)), new Response("{}", { status: 404 })),
      }),
    /404/,
  );
  assert.equal(urls.length, 2);
  urls.length = 0;
  await geminiJsonWith("gemini-2.5-flash", req(), {
    apiKey: KEY,
    geminiBaseUrl: "https://relay2.example.com",
    fetcher: async (u) => (urls.push(String(u)), streamOf([sse([answer('{"ok":true}')])])),
  });
  assert.match(urls[0], /:streamGenerateContent\?alt=sse$/);
});

test("schema compatibility downgrades json_schema → openapi_schema → json_mime → text, cached only after success", async () => {
  const seen: string[] = [];
  const modeOf = (b: { generationConfig: Record<string, unknown> }) =>
    "responseJsonSchema" in b.generationConfig ? "json_schema" : "responseSchema" in b.generationConfig ? "openapi_schema" : "responseMimeType" in b.generationConfig ? "json_mime" : "text";
  const fetcher: typeof fetch = async (_u, init) => {
    const mode = modeOf(JSON.parse(String(init?.body)));
    seen.push(mode);
    if (mode === "json_schema") return json({ error: { code: 400, status: "INVALID_ARGUMENT", message: 'Invalid JSON payload received. Unknown name "responseJsonSchema" at \'generation_config\': Cannot find field.' } }, 400);
    if (mode === "openapi_schema") return json({ error: { code: 400, message: "The specified schema produces a constraint that has too many states for serving." } }, 400);
    if (mode === "json_mime") return json({ error: { code: 400, message: "response_mime_type is not supported by this model" } }, 400);
    return json(answer('```json\n{"ok":true}\n```'));
  };
  const opts = { apiKey: KEY, stream: false, geminiBaseUrl: "https://relay.example.com", fetcher };
  assert.deepEqual(await geminiJsonWith("gemini-2.5-flash", req(), opts), { ok: true });
  assert.deepEqual(seen, ["json_schema", "openapi_schema", "json_mime", "text"]);
  // same schema: straight to text; another schema of the model: starts at openapi_schema (the field is unknown)
  seen.length = 0;
  await geminiJsonWith("gemini-2.5-flash", req(), opts);
  assert.deepEqual(seen, ["text"]);
  seen.length = 0;
  await geminiJsonWith("gemini-2.5-flash", req({ schemaName: "other" }), opts);
  assert.deepEqual(seen, ["openapi_schema", "json_mime", "text"]);

  // a failed chain caches nothing
  clearGeminiCompatCache();
  seen.length = 0;
  const failing: typeof fetch = async (_u, init) => {
    seen.push(modeOf(JSON.parse(String(init?.body))));
    return json({ error: { code: 400, message: "Invalid JSON payload: schema rejected" } }, 400);
  };
  await assert.rejects(() => geminiJsonWith("gemini-2.5-flash", req(), { ...opts, fetcher: failing }), AiError);
  assert.equal(seen.length, 4);
  seen.length = 0;
  await geminiJsonWith("gemini-2.5-flash", req(), opts);
  assert.equal(seen[0], "json_schema");
});

test("key, region, model, quota and attachment errors never trigger downgrade retries and never echo the key", async () => {
  const cases: Array<[number, unknown, RegExp]> = [
    [400, { error: { code: 400, message: `API key not valid. Please pass a valid API key. key=${KEY}`, status: "INVALID_ARGUMENT", details: [{ reason: "API_KEY_INVALID" }] } }, /400（API Key 无效/],
    [403, { error: { code: 403, message: "User location is not supported for the API use. schema" } }, /403（当前网络地区不支持官方直连/],
    [403, { error: { code: 403, message: `Permission denied for ${KEY}` } }, /403（没有权限或 Key 受限）/],
    [404, { error: { code: 404, message: "models/x is not found" } }, /404（模型名或接口地址不对/],
    [429, { error: { code: 429, message: "Resource has been exhausted" } }, /429（请求太频繁或免费\/付费额度用完/],
    [503, { error: { code: 503, message: "overloaded" } }, /服务暂时不可用（HTTP 503）/],
    [400, { error: { code: 400, message: "Request payload size exceeds the limit: inline_data too large (schema)" } }, /Google Gemini 返回 400/],
    [401, { error: { code: 401, message: "unauthenticated" } }, /401（Key 不对或未授权）/],
  ];
  for (const [status, body, re] of cases) {
    let calls = 0;
    await assert.rejects(
      () => geminiJsonWith("gemini-2.5-flash", req(), { apiKey: KEY, fetcher: async () => (calls++, json(body, status)) }),
      (e: unknown) => e instanceof AiError && re.test(e.message) && !e.message.includes(KEY) && !e.message.includes("FakeTestSecret"),
    );
    assert.equal(calls, 1, `status ${status} must not retry`);
  }
});

test("blocked input, safety / recitation stops, MAX_TOKENS and empty answers have clear messages", async () => {
  const run = (body: unknown) => geminiJsonWith("gemini-2.5-flash", req(), { apiKey: KEY, stream: false, fetcher: async () => json(body) });
  await assert.rejects(() => run({ promptFeedback: { blockReason: "SAFETY" } }), /安全策略拦截了输入内容（SAFETY）/);
  await assert.rejects(
    () => run({ candidates: [{ finishReason: "SAFETY", safetyRatings: [{ category: "HARM_CATEGORY_HARASSMENT", probability: "HIGH" }, { category: "HARM_CATEGORY_HATE_SPEECH", probability: "LOW" }] }] }),
    (e: unknown) => e instanceof AiError && /拦截了本次输出（SAFETY：HARM_CATEGORY_HARASSMENT）/.test(e.message) && !e.message.includes("HATE"),
  );
  await assert.rejects(() => run({ candidates: [{ content: { parts: [{ text: "Il était une fois" }] }, finishReason: "RECITATION" }] }), /RECITATION/);
  await assert.rejects(() => run({ candidates: [{ content: { parts: [{ text: '{"ok":' }] }, finishReason: "MAX_TOKENS" }] }), /输出太长被截断/);
  await assert.rejects(() => run({ candidates: [] }), /未返回有效内容/);
  await assert.rejects(() => run({ candidates: [{ content: { parts: [{ text: "secret", thought: true }] }, finishReason: "STOP" }] }), /未返回有效内容/);
});

test("an SSE stream that ends without finishReason is an error, and in-stream errors are mapped", async () => {
  await assert.rejects(
    () => geminiJsonWith("gemini-2.5-flash", req(), { apiKey: KEY, fetcher: async () => streamOf([sse([{ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }])]) }),
    /流式响应中断/,
  );
  await assert.rejects(
    () => geminiJsonWith("gemini-2.5-flash", req(), { apiKey: KEY, fetcher: async () => streamOf([sse([{ error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "quota" } }])]) }),
    /429（请求太频繁/,
  );
  // an SSE body (even preceded by comment keep-alives) without the header is still read as SSE; corrupted events fail loudly
  const ok = await geminiJsonWith("gemini-2.5-flash", req(), {
    apiKey: KEY,
    fetcher: async () => streamOf([enc.encode(": keep-alive\n\n"), sse([answer('{"ok":true}')]), enc.encode("data: [DONE]\n\n")], "text/plain"),
  });
  assert.deepEqual(ok, { ok: true });
  await assert.rejects(
    () => geminiJsonWith("gemini-2.5-flash", req(), { apiKey: KEY, fetcher: async () => streamOf([enc.encode("data: not-json\n\n"), sse([answer('{"ok":true}')])]) }),
    /流式响应数据损坏/,
  );
  // custom relay key of non-AIza format is also redacted literally on HTTP errors
  const relaySecret = "custom-relay-secret-token-888";
  await assert.rejects(
    () =>
      geminiJsonWith("gemini-2.5-flash", req(), {
        apiKey: relaySecret,
        geminiBaseUrl: "https://relay.example.com",
        fetcher: async () => json({ error: { code: 403, message: `Denied x-goog-api-key: ${relaySecret}` } }, 403),
      }),
    (e: unknown) => e instanceof AiError && !e.message.includes(relaySecret) && e.message.includes("***"),
  );
});

test("a stalled stream is stopped by the caller's abort at once and its reader cancelled", async () => {
  let cancelled = false;
  const ctrl = new AbortController();
  const stalled = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(sse([{ candidates: [{ content: { parts: [{ text: '{"ok":' }] } }] }]));
    },
    cancel() {
      cancelled = true;
    },
  });
  const p = geminiJsonWith("gemini-2.5-flash", req({ signal: ctrl.signal }), {
    apiKey: KEY,
    fetcher: async () => new Response(stalled, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
  });
  setTimeout(() => ctrl.abort(), 20);
  await assert.rejects(p, (e: unknown) => (e as Error).name === "AbortError");
  assert.equal(cancelled, true);
});

test("createRequestDeadline times out a pending read with a clear AiError and runs onCancel", async () => {
  const dl = createRequestDeadline(undefined, 25, "Google Gemini");
  let cancelled = false;
  await assert.rejects(
    () => dl.wrapRead(new Promise(() => undefined), () => (cancelled = true)),
    (e: unknown) => e instanceof AiError && /Google Gemini 请求超时/.test(e.message),
  );
  assert.equal(cancelled, true);
  assert.equal(dl.signal.aborted, true);
  dl.cleanup();
  const pre = new AbortController();
  pre.abort();
  const dl2 = createRequestDeadline(pre.signal, 1000);
  await assert.rejects(() => dl2.wrapRead(Promise.resolve(1)), (e: unknown) => (e as Error).name === "AbortError");
  dl2.cleanup();
  const dl3 = createRequestDeadline(undefined, 1000);
  assert.equal(await dl3.wrapRead(Promise.resolve(7)), 7);
  dl3.cleanup();
});

test("listGeminiModels follows nextPageToken, keeps generateContent models, presets first; relays' { data } too", async () => {
  const urls: string[] = [];
  const list = await listGeminiModels({
    apiKey: KEY,
    fetcher: async (u) => {
      urls.push(String(u));
      if (!String(u).includes("pageToken"))
        return json({
          models: [
            { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] },
            { name: "models/gemini-zeta", supportedGenerationMethods: ["generateContent"] },
            { name: "models/gemini-2.5-pro", supportedGenerationMethods: ["generateContent", "countTokens"] },
          ],
          nextPageToken: "p2",
        });
      return json({ models: [{ name: "models/gemini-alpha", supportedGenerationMethods: ["generateContent"] }, { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] }, { name: "models/gemini-2.5-pro", supportedGenerationMethods: ["generateContent"] }] });
    },
  });
  assert.deepEqual(list, ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-alpha", "gemini-zeta"]);
  assert.deepEqual(urls, ["https://generativelanguage.googleapis.com/v1beta/models?pageSize=100", "https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&pageToken=p2"]);
  const relay = await listGeminiModels({ apiKey: KEY, geminiBaseUrl: "https://relay.example.com/v1", fetcher: async () => json({ data: [{ id: "models/gemini-b" }, { id: "gemini-2.5-flash" }, { id: "gemini-a" }] }) });
  assert.deepEqual(relay, ["gemini-2.5-flash", "gemini-a", "gemini-b"]);
});

test("geminiGenerateImage skips thought sketches, picks the final visible picture, and enforces IMAGE_SAFETY before data", async () => {
  let body: { generationConfig?: { responseModalities?: string[] } } = {};
  const draftBytes = Buffer.from([1, 2, 3, 4]).toString("base64");
  const finalBytes = Buffer.from([137, 80, 78, 71]).toString("base64");
  const blob = await geminiGenerateImage("gemini-2.5-flash-image", "un chat", {
    apiKey: KEY,
    fetcher: async (_u, init) => {
      body = JSON.parse(String(init?.body));
      return json([
        { candidates: [{ content: { parts: [{ thought: true, inlineData: { mimeType: "image/png", data: draftBytes } }, { text: "Voici" }] } }] },
        { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: finalBytes } }] }, finishReason: "STOP" }] },
      ]);
    },
  });
  assert.deepEqual(body.generationConfig?.responseModalities, ["TEXT", "IMAGE"]);
  assert.equal(blob.type, "image/png");
  assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())], [137, 80, 78, 71]);
  await assert.rejects(
    () =>
      geminiGenerateImage("gemini-2.5-flash-image", "x", {
        apiKey: KEY,
        fetcher: async () => json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: finalBytes } }] }, finishReason: "IMAGE_SAFETY" }] }),
      }),
    /安全策略拦截了本次配图（IMAGE_SAFETY/,
  );
  await assert.rejects(
    () => geminiGenerateImage("gemini-2.5-flash-image", "x", { apiKey: KEY, fetcher: async () => json(answer("Je ne peux pas dessiner cela.")) }),
    /没有生成图片，只回复了文字：Je ne peux pas/,
  );
  await assert.rejects(() => geminiGenerateImage("gemini-2.5-flash-image", "x", { apiKey: KEY, fetcher: async () => json({ candidates: [{ finishReason: "STOP" }] }) }), /没有返回图片/);
});

/* ---------- testTextProvider, config, routes, pricing ---------- */

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const geminiCfg = (over: Partial<AiConfig> = {}): AiConfig =>
  sanitizeAiConfig({ ...defaultAiConfig(), keys: { ...defaultAiConfig().keys, gemini: KEY }, text: { provider: "gemini", model: "gemini-2.5-flash" }, vision: { provider: "gemini", model: "gemini-2.5-flash" }, ...over });

test("testTextProvider: a readable model list with a failing probe is a failure; a relay without /models passes on the probe; new accounts adapt to available catalog models", async () => {
  // the forwarder's ping fails, so requests go straight to the services
  globalThis.fetch = (async (u: RequestInfo | URL) => {
    const url = String(u);
    if (url.endsWith("/ai-proxy/ping")) return new Response("nope", { status: 404 });
    if (url.includes("/models?pageSize")) return json({ models: [{ name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] }] });
    return json({ error: { code: 403, message: "Generative Language API has not been used in project" } }, 403);
  }) as typeof fetch;
  await assert.rejects(() => testTextProvider("gemini", geminiCfg()), /403（没有权限或 Key 受限）/);

  globalThis.fetch = (async (u: RequestInfo | URL) => {
    const url = String(u);
    if (url.includes("/models?pageSize")) return new Response("not here", { status: 404 });
    return json(answer('{"ok":true}'));
  }) as typeof fetch;
  const relay = await testTextProvider("gemini", geminiCfg({ geminiBaseUrl: "https://relay.example.com" }));
  assert.deepEqual(relay.models, []);
  assert.equal(relay.probeOk, true);

  // New project whose catalog exposes gemini-3.5-flash-lite instead of restricted gemini-2.5-flash
  const probedUrls: string[] = [];
  globalThis.fetch = (async (u: RequestInfo | URL) => {
    const url = String(u);
    probedUrls.push(url);
    if (url.includes("/models?pageSize"))
      return json({ models: [{ name: "models/gemini-3.5-flash-lite", supportedGenerationMethods: ["generateContent"] }] });
    if (url.includes("gemini-3.5-flash-lite")) return json(answer('{"ok":true}'));
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  const adapted = await testTextProvider("gemini", geminiCfg());
  assert.equal(adapted.model, "gemini-3.5-flash-lite");
  assert.ok(probedUrls.some((u) => u.includes("gemini-3.5-flash-lite")));

  globalThis.fetch = (async (u: RequestInfo | URL) => {
    const url = String(u);
    if (url.includes("/models?pageSize")) return json({ models: [] });
    return json(answer('{"ok":false}'));
  }) as typeof fetch;
  await assert.rejects(() => testTextProvider("gemini", geminiCfg()), /没有按要求返回 \{"ok":true\}/);
});

test("old saved settings gain the Gemini fields and keep everything else", () => {
  const legacy = {
    keys: { openai: "sk-old", deepseek: "sk-ds", anthropic: "", openrouter: "sk-or", azure: "az" },
    openaiBaseUrl: "https://relay.example.com/v1",
    stt: { provider: "custom", baseUrl: "https://api.groq.com/openai/v1", apiKey: "gsk", model: "whisper-large-v3" },
    azureRegion: "westeurope",
    tts: true,
    text: { provider: "deepseek", model: "deepseek-chat" },
    vision: { provider: "openai", model: "gpt-4o" },
    image: { provider: "openrouter", model: "openai/gpt-image-1-mini" },
  };
  const c = sanitizeAiConfig(legacy);
  assert.equal(c.keys.gemini, "");
  assert.equal(c.geminiBaseUrl, "");
  assert.equal(c.keys.openai, "sk-old");
  assert.equal(c.keys.openrouter, "sk-or");
  assert.equal(c.openaiBaseUrl, "https://relay.example.com/v1");
  assert.deepEqual(c.stt, legacy.stt);
  assert.equal(c.tts, true);
  assert.deepEqual(c.vision, legacy.vision);
  assert.deepEqual(c.image, legacy.image);
  const g = sanitizeAiConfig({ keys: { gemini: ` ${KEY} ` }, geminiBaseUrl: "http://evil.example.com", text: { provider: "gemini" }, image: { provider: "gemini" } });
  assert.equal(g.keys.gemini, KEY);
  assert.equal(g.geminiBaseUrl, "");
  assert.deepEqual(g.text, { provider: "gemini", model: "gemini-2.5-flash" });
  assert.deepEqual(g.image, { provider: "gemini", model: "gemini-2.5-flash-image" });
});

test("audio transcription follows the chosen service; a spare Gemini key is only the last resort; safety/truncation stops throw", async () => {
  const keys = { ...defaultAiConfig().keys, gemini: KEY, openrouter: "sk-or" };
  const viaOpenRouter = sanitizeAiConfig({ ...defaultAiConfig(), keys, text: { provider: "openrouter", model: "google/gemini-2.5-flash" } });
  const urls: string[] = [];
  const fetcher: typeof fetch = async (u) => {
    urls.push(String(u));
    return String(u).includes("openrouter")
      ? json({ choices: [{ message: { content: '{"text":"bonjour"}' } }] })
      : json({ candidates: [{ content: { parts: [{ text: "hmm", thought: true }, { text: '{"text":"salut"}' }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2, thoughtsTokenCount: 4 } });
  };
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
  assert.equal((await transcribeViaMultimodalAudio(blob, undefined, { cfg: viaOpenRouter, fetcher, durationSec: 1 })).text, "bonjour");
  assert.match(urls[0], /openrouter\.ai/);

  const viaGemini = geminiCfg({ text: { provider: "gemini", model: "models/gemini-2.5-pro" } });
  assert.equal((await transcribeViaMultimodalAudio(blob, undefined, { cfg: viaGemini, fetcher, durationSec: 1 })).text, "salut");
  assert.match(urls[1], /generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.5-pro:generateContent$/);

  const relayGemini = geminiCfg({ geminiBaseUrl: "https://relay.example.com" });
  await transcribeViaMultimodalAudio(blob, undefined, { cfg: relayGemini, fetcher, durationSec: 1 });
  assert.equal(urls[2], "https://relay.example.com/v1beta/models/gemini-2.5-flash:generateContent");

  const deepseekPlusGemini = sanitizeAiConfig({ ...defaultAiConfig(), keys: { ...defaultAiConfig().keys, deepseek: "sk-ds", gemini: KEY } });
  assert.equal(canTranscribeMultimodalAudio(deepseekPlusGemini), true);
  await transcribeViaMultimodalAudio(blob, undefined, { cfg: deepseekPlusGemini, fetcher, durationSec: 1 });
  assert.match(urls[3], /models\/gemini-2\.5-flash:generateContent$/);

  await assert.rejects(
    () => transcribeViaMultimodalAudio(blob, undefined, { cfg: viaGemini, fetcher: async () => json({ error: { code: 400, message: "API key not valid", details: [{ reason: "API_KEY_INVALID" }] } }, 400) }),
    /API Key 无效/,
  );
  await assert.rejects(
    () => transcribeViaMultimodalAudio(blob, undefined, { cfg: viaGemini, fetcher: async () => json({ candidates: [{ finishReason: "SAFETY" }] }) }),
    /安全策略拦截了本次音频转写（SAFETY/,
  );
  await assert.rejects(
    () => transcribeViaMultimodalAudio(blob, undefined, { cfg: viaGemini, fetcher: async () => json({ candidates: [{ content: { parts: [{ text: '{"text":"euh' }] }, finishReason: "MAX_TOKENS" }] }) }),
    /输出太长被截断/,
  );
});

test("Gemini pricing: exact names before the generic rate", () => {
  const rate = (m: string) => Math.round(estimateUsd("gemini", m, 1_000_000, 1_000_000) * 1000) / 1000;
  assert.equal(rate("gemini-2.5-flash-image"), 2.8);
  assert.equal(rate("gemini-3.1-flash-lite-image"), 2.8);
  assert.equal(rate("gemini-2.5-flash-lite"), 0.5);
  assert.equal(rate("gemini-3.5-flash-lite"), 0.5);
  assert.equal(rate("gemini-2.5-pro"), 11.25);
  assert.equal(rate("gemini-3.1-pro"), 11.25);
  assert.equal(rate("gemini-2.0-flash"), 0.75);
  assert.equal(rate("gemini-2.5-flash"), 2.8);
  assert.equal(rate("gemini-3.8-flash"), 2.8);
  assert.equal(rate("google/gemini-2.5-flash"), 2.8);
});

/* ---------- retired-model 404 self-healing (new Google projects) ---------- */

const RETIRED = (m = "gemini-2.5-flash", suggest = "") =>
  json(
    {
      error: {
        code: 404,
        status: "NOT_FOUND",
        message: `models/${m} is no longer available to new users.${suggest ? ` Please update your code to use models/${suggest}.` : ""}`,
      },
    },
    404,
  );
const NOT_FOUND = (m: string) => json({ error: { code: 404, status: "NOT_FOUND", message: `models/${m} is not found for API version v1beta, or is not supported for generateContent.` } }, 404);
const catalogOf = (...ids: string[]) => json({ models: ids.map((id) => ({ name: `models/${id}`, supportedGenerationMethods: ["generateContent"] })) });
const info = (message: string, raw = "") => ({ message, status: "", reasons: [], raw });

test("isGeminiModelUnavailable: retired / not-found model 404s count; relay HTML or bare 404 pages and other statuses do not", () => {
  assert.equal(isGeminiModelUnavailable(404, info("models/gemini-2.5-flash is no longer available to new users.")), true);
  assert.equal(isGeminiModelUnavailable(404, info("models/gemini-2.5-flash is not found for API version v1beta, or is not supported for generateContent.")), true);
  assert.equal(isGeminiModelUnavailable(404, info("Model gemini-1.5-pro has been retired")), true);
  assert.equal(isGeminiModelUnavailable(400, info("models/gemini-2.5-flash is no longer available to new users.")), false);
  assert.equal(isGeminiModelUnavailable(404, info("<!DOCTYPE html><html><body>404 Not Found models</body></html>")), false);
  assert.equal(isGeminiModelUnavailable(404, info("404 page not found")), false);
  assert.equal(isGeminiModelUnavailable(404, info("", "{}")), false);
});

test("extractSuggestedGeminiModel reads Google's replacement hint and never returns the failing model", () => {
  assert.equal(extractSuggestedGeminiModel(info("models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3-flash-preview."), "gemini-2.5-flash"), "gemini-3-flash-preview");
  assert.equal(extractSuggestedGeminiModel(info("Please use gemini-3.1-pro-preview instead"), "gemini-2.5-pro"), "gemini-3.1-pro-preview");
  assert.equal(extractSuggestedGeminiModel(info("models/gemini-2.5-flash is not found for API version v1beta"), "gemini-2.5-flash"), null);
  assert.equal(extractSuggestedGeminiModel(info("no hint here"), "gemini-2.5-flash"), null);
});

test("rankGeminiTextModels: newest generation, Flash > Pro > Flash-Lite, stable before preview; never image / TTS / embedding models", () => {
  const catalog = [
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-2.5-flash-image",
    "gemini-2.5-flash-preview-tts",
    "gemini-2.5-pro",
    "gemini-2.5-flash-lite",
    "gemini-3-flash-preview",
    "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite-preview",
    "gemini-3-pro-image-preview",
    "gemini-embedding-001",
    "gemini-2.5-flash-native-audio-preview-09-2025",
    "gemini-live-2.5-flash-preview",
    "gemini-robotics-er-1.5-preview",
    "gemini-2.5-computer-use-preview-10-2025",
    "imagen-4.0-generate-001",
    "veo-3.0-generate-001",
    "gemma-3-27b-it",
  ];
  assert.deepEqual(rankGeminiTextModels(catalog, new Set(["gemini-2.5-flash"])), [
    "gemini-3-flash-preview",
    "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
  ]);
  // a stable release beats a preview of the same version; a newer Flash beats an older one
  assert.deepEqual(rankGeminiTextModels(["gemini-3-flash-preview", "gemini-3-flash", "gemini-3.5-flash"]), ["gemini-3.5-flash", "gemini-3-flash", "gemini-3-flash-preview"]);
  assert.deepEqual(rankGeminiTextModels(["models/gemini-2.5-flash-image", "imagen-3.0", "gemini-embedding-001", "gemini-2.5-flash-preview-tts"]), []);
});

test("geminiJsonWith heals a retired model through Google's suggestion, records usage for it, and goes straight there next time", async () => {
  const { getAiUsage, resetAiUsage } = await import("./usage.ts");
  resetAiUsage();
  const urls: string[] = [];
  const healed: Array<[string, string]> = [];
  const fetcher: typeof fetch = async (u) => {
    const url = String(u);
    urls.push(url);
    if (url.includes("/models/gemini-2.5-flash:")) return RETIRED("gemini-2.5-flash", "gemini-3-flash-preview");
    if (url.includes("/models/gemini-3-flash-preview:")) return streamOf([sse([answer('{"ok":true}', { usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 2 } })])]);
    return new Response("unexpected", { status: 500 });
  };
  const opts = { apiKey: KEY, fetcher, allowModelFallback: true, onModelHealed: (f: string, t: string) => healed.push([f, t]) };
  assert.deepEqual(await geminiJsonWith("gemini-2.5-flash", req(), opts), { ok: true });
  assert.deepEqual(
    urls.map((u) => u.replace("https://generativelanguage.googleapis.com/v1beta", "")),
    ["/models/gemini-2.5-flash:streamGenerateContent?alt=sse", "/models/gemini-3-flash-preview:streamGenerateContent?alt=sse"],
  );
  assert.deepEqual(healed, [["gemini-2.5-flash", "gemini-3-flash-preview"]]);
  assert.equal(getAiUsage().calls, 1);
  assert.equal(getAiUsage().promptTokens, 4);
  urls.length = 0;
  assert.deepEqual(await geminiJsonWith("gemini-2.5-flash", req(), opts), { ok: true });
  assert.deepEqual(urls.length, 1);
  assert.match(urls[0], /gemini-3-flash-preview:streamGenerateContent/);
});

test("geminiJsonWith heals through the /models catalog when the 404 names no replacement (never an image model)", async () => {
  const urls: string[] = [];
  const fetcher: typeof fetch = async (u) => {
    const url = String(u);
    urls.push(url);
    if (url.includes("/models?pageSize")) return catalogOf("gemini-2.5-flash", "gemini-2.5-flash-image", "gemini-3-flash-preview");
    if (url.includes("/models/gemini-2.5-flash:")) return NOT_FOUND("gemini-2.5-flash");
    if (url.includes("/models/gemini-3-flash-preview:")) return json(answer('{"ok":true}'));
    return new Response("unexpected", { status: 500 });
  };
  let healedTo = "";
  const out = await geminiJsonWith("gemini-2.5-flash", req(), { apiKey: KEY, fetcher, stream: false, allowModelFallback: true, onModelHealed: (_f, t) => (healedTo = t) });
  assert.deepEqual(out, { ok: true });
  assert.equal(healedTo, "gemini-3-flash-preview");
  assert.ok(!urls.some((u) => u.includes("-image:")));
});

test("without allowModelFallback a retired model reports a clear Chinese 404 once; a typo / relay page 404 never loops", async () => {
  let calls = 0;
  await assert.rejects(
    () => geminiJsonWith("gemini-2.5-flash", req(), { apiKey: KEY, fetcher: async () => (calls++, RETIRED()) }),
    /404（模型 gemini-2\.5-flash 对当前项目不可用，新创建的项目请改用 gemini-3-flash-preview 等新一代模型，或在 AI 设置中点「测试连接」自动匹配）/,
  );
  assert.equal(calls, 1);

  // a relay whose own address is wrong: HTML 404 on both endpoints, no model fallback, no /models read
  const urls: string[] = [];
  await assert.rejects(
    () =>
      geminiJsonWith("gemini-2.5-flash", req(), {
        apiKey: KEY,
        geminiBaseUrl: "https://wrong-relay.example.com",
        allowModelFallback: true,
        fetcher: async (u) => (urls.push(String(u)), new Response("<!DOCTYPE html><html><body><h1>404 Not Found</h1>nginx</body></html>", { status: 404, headers: { "Content-Type": "text/html" } })),
      }),
    /404（模型名或接口地址不对：gemini-2\.5-flash）/,
  );
  assert.equal(urls.length, 2);
  assert.ok(urls.every((u) => !u.includes("/models?")));

  // a typo'd model that is not found anywhere: the candidates are tried at most 3 times, then the original error
  urls.length = 0;
  await assert.rejects(
    () =>
      geminiJsonWith("gemini-2.5-flsh", req(), {
        apiKey: KEY,
        stream: false,
        allowModelFallback: true,
        fetcher: async (u) => {
          const url = String(u);
          urls.push(url);
          if (url.includes("/models?pageSize")) return catalogOf("gemini-a-flash", "gemini-b-flash", "gemini-c-flash", "gemini-d-flash");
          return NOT_FOUND(url.split("/models/")[1].split(":")[0]);
        },
      }),
    /404（模型名或接口地址不对：gemini-2\.5-flsh）/,
  );
  assert.equal(urls.filter((u) => u.includes(":generateContent")).length, 1 + 3);
  assert.equal(urls.filter((u) => u.includes("/models?")).length, 1);
});

test("a replacement that fails for another reason (quota) is the error reported", async () => {
  await assert.rejects(
    () =>
      geminiJsonWith("gemini-2.5-flash", req(), {
        apiKey: KEY,
        stream: false,
        allowModelFallback: true,
        fetcher: async (u) => (String(u).includes("gemini-2.5-flash:") ? RETIRED("gemini-2.5-flash", "gemini-3-flash-preview") : json({ error: { code: 429, message: "quota" } }, 429)),
      }),
    /429（请求太频繁或免费\/付费额度用完/,
  );
});

test("geminiTranscribeAudio heals a retired model too", async () => {
  const urls: string[] = [];
  const text = await geminiTranscribeAudio(
    "gemini-2.5-flash",
    { mimeType: "audio/webm", data: "AAA" },
    { system: "s", text: "t" },
    {
      apiKey: KEY,
      allowModelFallback: true,
      fetcher: async (u) => {
        urls.push(String(u));
        if (String(u).includes("gemini-2.5-flash:")) return RETIRED();
        if (String(u).includes("/models?pageSize")) return catalogOf("gemini-2.5-flash", "gemini-3-flash-preview");
        return json(answer('{"text":"bonjour"}'));
      },
    },
  );
  assert.equal(text, '{"text":"bonjour"}');
  assert.match(urls.at(-1) ?? "", /gemini-3-flash-preview:generateContent$/);
});

/** Fake Google services for the high-level calls (global fetch): no forwarder, a catalog, and per-model answers. */
function fakeGoogle(catalog: string[], answerFor: (model: string) => Response) {
  const urls: string[] = [];
  globalThis.fetch = (async (u: RequestInfo | URL) => {
    const url = String(u);
    urls.push(url);
    if (url.endsWith("/ai-proxy/ping")) return new Response("nope", { status: 404 });
    if (url.includes("/models?pageSize")) return catalogOf(...catalog);
    const m = /\/models\/([^:/?]+):/.exec(url)?.[1] ?? "";
    return answerFor(m);
  }) as typeof fetch;
  return urls;
}
const newProject = (m: string) => (m.startsWith("gemini-2.5") ? RETIRED(m) : json(answer('{"ok":true}')));

test("测试连接 on a new Google project: models.list names gemini-2.5-flash but it 404s → adapts to gemini-3-flash-preview (wizard and saved settings)", async () => {
  const urls = fakeGoogle(["gemini-2.5-flash", "gemini-3-flash-preview", "gemini-2.5-flash-image"], newProject);
  // the 1 步 wizard (unsaved settings, default model)
  const wizard = await testTextProvider("gemini", geminiCfg());
  assert.equal(wizard.model, "gemini-3-flash-preview");
  assert.equal(wizard.requestedModel, "gemini-2.5-flash");
  assert.ok(!urls.some((u) => u.includes("-image:")));
  assert.equal(urls.filter((u) => u.includes("/models?")).length, 1, "the probe reuses the catalog it already read");

  // the advanced 测试连接 with the saved default
  clearGeminiCompatCache();
  setAiConfig(geminiCfg());
  const advanced = await testTextProvider("gemini");
  assert.equal(advanced.model, "gemini-3-flash-preview");
  setAiConfig(defaultAiConfig());
});

test("测试连接 on a classic project (e2e Check 12): gemini-2.5-flash answers on the first probe", async () => {
  const urls = fakeGoogle(["gemini-2.5-flash", "gemini-2.5-pro"], () => streamOf([sse([answer('{"ok":true}')])]));
  const res = await testTextProvider("gemini", geminiCfg());
  assert.equal(res.model, "gemini-2.5-flash");
  const probes = urls.filter((u) => u.includes(":streamGenerateContent") || u.includes(":generateContent"));
  assert.deepEqual(probes, ["https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse"]);
});

test("a model typed on purpose keeps its 404 in 测试连接; only defaults, the last good model and older generations self-heal", async () => {
  fakeGoogle(["gemini-3-flash-preview"], (m) => (m === "gemini-3-flash-preview" ? json(answer('{"ok":true}')) : NOT_FOUND(m)));
  await assert.rejects(
    () => testTextProvider("gemini", geminiCfg({ text: { provider: "gemini", model: "gemini-exp-custom-0901" } })),
    /404（模型名或接口地址不对：gemini-exp-custom-0901）/,
  );
  const cfg = geminiCfg({ lastGoodModel: { gemini: "gemini-3-flash-preview" } });
  assert.equal(geminiCanSelfHeal(DEFAULT_MODELS.gemini, cfg), true);
  assert.equal(geminiCanSelfHeal("models/gemini-2.5-pro", cfg), true);
  assert.equal(geminiCanSelfHeal("gemini-2.0-flash", cfg), true);
  assert.equal(geminiCanSelfHeal("gemini-3-flash-preview", cfg), true);
  assert.equal(geminiCanSelfHeal("gemini-exp-custom-0901", cfg), false);
  assert.equal(geminiCanSelfHeal("gemini-3.1-pro-preview", cfg), false);
});

test("runtime requests heal a retired default once and persist the working model into 文本 / 识图 and lastGoodModel", async () => {
  const urls = fakeGoogle(["gemini-2.5-flash", "gemini-3-flash-preview"], newProject);
  setAiConfig(geminiCfg({ vision: { provider: "gemini", model: "gemini-2.5-flash" } }));
  assert.deepEqual(await aiJson("text", req()), { ok: true });
  const c = getAiConfig();
  assert.deepEqual(c.text, { provider: "gemini", model: "gemini-3-flash-preview" });
  assert.deepEqual(c.vision, { provider: "gemini", model: "gemini-3-flash-preview" });
  assert.equal(c.lastGoodModel?.gemini, "gemini-3-flash-preview");
  // the next call goes straight to the healed model
  urls.length = 0;
  assert.deepEqual(await aiJson("vision", req()), { ok: true });
  assert.deepEqual(
    urls.filter((u) => u.includes("/models/")),
    ["https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:streamGenerateContent?alt=sse"],
  );
  setAiConfig(defaultAiConfig());
});

test("spare-key audio transcription heals a retired gemini-2.5-flash on a new project and starts from the last good model afterwards", async () => {
  setAiConfig(defaultAiConfig());
  const cfg = sanitizeAiConfig({ ...defaultAiConfig(), keys: { ...defaultAiConfig().keys, deepseek: "sk-ds", gemini: KEY } });
  const urls: string[] = [];
  const fetcher: typeof fetch = async (u) => {
    const url = String(u);
    urls.push(url);
    if (url.includes("/models?pageSize")) return catalogOf("gemini-2.5-flash", "gemini-2.5-flash-image", "gemini-3-flash-preview");
    if (url.includes("gemini-2.5-flash:")) return RETIRED();
    return json(answer('{"text":"je pense que"}'));
  };
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
  const out = await transcribeViaMultimodalAudio(blob, undefined, { cfg, fetcher, durationSec: 1 });
  assert.equal(out.text, "je pense que");
  assert.match(urls[0], /gemini-2\.5-flash:generateContent$/);
  assert.match(urls.at(-1) ?? "", /gemini-3-flash-preview:generateContent$/);
  assert.equal(getAiConfig().lastGoodModel?.gemini, "gemini-3-flash-preview");

  // a later visit (fresh caches) starts from the saved last good model
  clearGeminiCompatCache();
  urls.length = 0;
  await transcribeViaMultimodalAudio(blob, undefined, { cfg: { ...cfg, lastGoodModel: getAiConfig().lastGoodModel }, fetcher, durationSec: 1 });
  assert.deepEqual(urls, ["https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent"]);
  setAiConfig(defaultAiConfig());
});

test("config: lastGoodModel is sanitized, defaults to {} and the presets are real Gemini ids", () => {
  assert.deepEqual(defaultAiConfig().lastGoodModel, {});
  assert.deepEqual(sanitizeAiConfig({}).lastGoodModel, {});
  const c = sanitizeAiConfig({ lastGoodModel: { gemini: ` gemini-3-flash-preview `, openai: 42, bogus: "x", deepseek: "d".repeat(200) } });
  assert.deepEqual(c.lastGoodModel, { gemini: "gemini-3-flash-preview", deepseek: "d".repeat(80) });
  assert.equal(DEFAULT_MODELS.gemini, "gemini-2.5-flash");
  assert.ok(GEMINI_PRESET_MODELS.includes("gemini-3-flash-preview"));
  assert.ok(!GEMINI_PRESET_MODELS.some((m) => /3\.5-flash-lite|3\.8-flash/.test(m)));
});
