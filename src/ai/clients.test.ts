import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_MODELS, GRADING_RECOMMENDED_MODELS } from "./config.ts";
import { anthropicJsonWith, buildAnthropicBody, buildOpenAiChatBody, clearOpenAiCompatCache, openaiJsonWith, supportsTemperature, type JsonRequest } from "./clients.ts";
import { checkRewrite, explainDistractor, upgradeParagraph, UPGRADE_SYSTEM, DISTRACTOR_SYSTEM, buildRewritePayload, ESSAY_SCHEMA, ESSAY_SYSTEM, GRADE_SYSTEM, MODEL_SYSTEM, REWRITE_SYSTEM, SPEAK_SCHEMA, SPEAK_SYSTEM, TEXT_SYSTEM } from "./tasks.ts";

const sampleReq: JsonRequest = {
  system: "Mark this.",
  text: "Bonjour",
  schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false },
  schemaName: "sample",
};

test("supportsTemperature enables temperature on standard models and omits it on reasoning models", () => {
  assert.equal(supportsTemperature("deepseek-chat"), true);
  assert.equal(supportsTemperature("deepseek/deepseek-chat"), true);
  assert.equal(supportsTemperature("gpt-4o-mini"), true);
  assert.equal(supportsTemperature("anthropic/claude-sonnet-4"), true);
  assert.equal(supportsTemperature("google/gemini-2.5-flash"), true);

  assert.equal(supportsTemperature("gpt-5-mini"), false);
  assert.equal(supportsTemperature("openai/gpt-5-mini"), false);
  assert.equal(supportsTemperature("o3-mini"), false);
  assert.equal(supportsTemperature("deepseek-reasoner"), false);
  assert.equal(supportsTemperature("deepseek/deepseek-r1"), false);
  assert.equal(supportsTemperature("claude-sonnet-4:thinking"), false);
});

test("buildOpenAiChatBody and buildAnthropicBody default temperature to 0 on non-reasoning models", () => {
  const ds = buildOpenAiChatBody("deepseek", "deepseek-chat", sampleReq);
  assert.equal(ds.temperature, 0);

  const or = buildOpenAiChatBody("openrouter", "deepseek/deepseek-chat", { ...sampleReq, temperature: 0.4 });
  assert.equal(or.temperature, 0.4);

  const oaStd = buildOpenAiChatBody("openai", "gpt-4o-mini", sampleReq);
  assert.equal(oaStd.temperature, 0);

  const oaReason = buildOpenAiChatBody("openai", "gpt-5-mini", sampleReq);
  assert.equal("temperature" in oaReason, false);

  const orReason = buildOpenAiChatBody("openrouter", "openai/gpt-5-mini", sampleReq);
  assert.equal("temperature" in orReason, false);

  const claude = buildAnthropicBody("claude-sonnet-4", sampleReq);
  assert.equal(claude.temperature, 0);

  const claudeThink = buildAnthropicBody("claude-sonnet-4-thinking", sampleReq);
  assert.equal("temperature" in claudeThink, false);
});

test("ESSAY_SCHEMA and SPEAK_SCHEMA support FEI 0.5-point enum [0..5] and prompts have jagged anchors", () => {
  const expectedHalfStep = { type: "number", enum: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] };
  for (const prop of Object.values(ESSAY_SCHEMA.properties.scores.properties)) {
    assert.deepEqual(prop, expectedHalfStep);
  }
  for (const prop of Object.values(SPEAK_SCHEMA.properties.scores.properties)) {
    assert.deepEqual(prop, expectedHalfStep);
  }
  assert.match(ESSAY_SYSTEM, /calibration anchors/i);
  assert.ok(!ESSAY_SYSTEM.includes("voitures") && !ESSAY_SYSTEM.includes("télétravail"));
  assert.match(SPEAK_SYSTEM, /calibration anchors/i);
  assert.ok(!SPEAK_SYSTEM.includes("voitures") && !SPEAK_SYSTEM.includes("télétravail"));
});

test("DEFAULT_MODELS.openrouter uses google/gemini-2.5-flash and GRADING_RECOMMENDED_MODELS includes calibrated choices", () => {
  assert.equal(DEFAULT_MODELS.openrouter, "google/gemini-2.5-flash");
  assert.equal(supportsTemperature(DEFAULT_MODELS.openrouter), true);
  assert.ok(GRADING_RECOMMENDED_MODELS.openrouter.includes("google/gemini-2.5-flash"));
  assert.ok(GRADING_RECOMMENDED_MODELS.openrouter.includes("deepseek/deepseek-chat"));
});

test("PE-8 checkRewrite payload forwards optional pointTitle as grammarPoint and prompt enforces it", () => {
  assert.ok(REWRITE_SYSTEM.includes("grammarPoint"));
  assert.deepEqual(
    buildRewritePayload({ given: "Il pleut.", task: "用 bien que 改写", reference: "Bien qu'il pleuve, je sors.", answer: "Bien qu'il pleuve, je pars.", pointTitle: "让步状语从句（bien que + 虚拟式）" }),
    { grammarPoint: "让步状语从句（bien que + 虚拟式）", given: "Il pleut.", task: "用 bien que 改写", reference: "Bien qu'il pleuve, je sors.", learner: "Bien qu'il pleuve, je pars." },
  );
  assert.equal("grammarPoint" in buildRewritePayload({ given: "A", task: "B", reference: "C", answer: "D", pointTitle: "  " }), false);
});

test("PE-10 MODEL_SYSTEM enforces B2 20+/25 standard and CE-3 TEXT_SYSTEM requires French quiz questions/options", () => {
  assert.ok(MODEL_SYSTEM.includes("20+/25"));
  assert.ok(MODEL_SYSTEM.includes("wordRange"));
  assert.ok(TEXT_SYSTEM.includes("written in French"));
  assert.ok(TEXT_SYSTEM.includes("3 options written in French"));
  assert.ok(TEXT_SYSTEM.includes("one sentence in Chinese"));
});

test("G2: all grading prompts isolate learner input as untrusted data and forbid executing embedded directives", () => {
  assert.match(ESSAY_SYSTEM, /untrusted/i);
  assert.ok(ESSAY_SYSTEM.includes("learnerText"));
  assert.match(SPEAK_SYSTEM, /untrusted/i);
  assert.ok(SPEAK_SYSTEM.includes("talk") && SPEAK_SYSTEM.includes("debate"));
  assert.match(GRADE_SYSTEM, /untrusted/i);
  assert.ok(GRADE_SYSTEM.includes("learnerSentence"));
  assert.match(REWRITE_SYSTEM, /untrusted/i);
  assert.ok(REWRITE_SYSTEM.includes("learner"));
  assert.match(SPEAK_SYSTEM, /When "typed" is true.*monologueWords/i);
  assert.match(UPGRADE_SYSTEM, /untrusted/i);
  assert.ok(UPGRADE_SYSTEM.includes("learnerParagraph"));
  assert.match(DISTRACTOR_SYSTEM, /untrusted/i);
  assert.equal(typeof explainDistractor, "function");
  assert.equal(typeof upgradeParagraph, "function");
  assert.equal(typeof checkRewrite, "function");

  // Non-zero temperature passes through for creative generation on standard models and drops on reasoning models
  const genBody = buildOpenAiChatBody("deepseek", "deepseek-chat", { ...sampleReq, temperature: 0.6 });
  assert.equal(genBody.temperature, 0.6);
  const reasonGenBody = buildOpenAiChatBody("openai", "gpt-5-mini", { ...sampleReq, temperature: 0.6 });
  assert.equal("temperature" in reasonGenBody, false);
});

test("custom openaiBaseUrl includes schema instructions and auto-downgrades on 400 from json_schema to json_object / text", async () => {
  clearOpenAiCompatCache();
  const seenModes: string[] = [];
  const fetcher: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      response_format?: { type?: string };
      max_tokens?: number;
      max_completion_tokens?: number;
      messages?: Array<{ role: string; content: unknown }>;
    };
    seenModes.push(body.response_format?.type ?? "none");
    assert.ok(String(body.messages?.[0]?.content).includes('"properties"'));
    if (body.response_format?.type === "json_schema" || body.response_format?.type === "json_object") {
      return new Response(JSON.stringify({ error: { message: "unsupported response_format" } }), { status: 400 });
    }
    assert.equal(body.max_completion_tokens, undefined);
    assert.ok(typeof body.max_tokens === "number");
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const r = await openaiJsonWith("openai", "qwen-max", sampleReq, {
    apiKey: "sk-test",
    openaiBaseUrl: "https://relay.example.com/v1",
    fetcher,
  });
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(seenModes, ["json_schema", "json_object", "none"]);

  // Cached downgrade skips redundant 400s on subsequent calls for same base+model
  seenModes.length = 0;
  const r2 = await openaiJsonWith("openai", "qwen-max", sampleReq, {
    apiKey: "sk-test",
    openaiBaseUrl: "https://relay.example.com/v1",
    fetcher,
  });
  assert.deepEqual(r2, { ok: true });
  assert.deepEqual(seenModes, ["none"]);
  clearOpenAiCompatCache();
});

test("anthropicJsonWith parses streamed SSE responses natively without SDK", async () => {
  const sse = [
    'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":12}}}\n\n',
    'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"{\\"ok\\":"}}\n\n',
    'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"true}"}}\n\n',
    'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":5}}\n\n',
  ].join("");
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(ctrl) {
      ctrl.enqueue(encoder.encode(sse));
      ctrl.close();
    },
  });
  const res = await anthropicJsonWith("claude-opus-5-5", sampleReq, {
    apiKey: "sk-ant-test",
    url: "https://mock.test/v1/messages",
    fetcher: async (_input, init) => {
      const hdrs = (init?.headers ?? {}) as Record<string, string>;
      assert.equal(hdrs["x-api-key"], "sk-ant-test");
      assert.equal(hdrs["anthropic-version"], "2023-06-01");
      assert.ok(hdrs["anthropic-beta"]?.includes("server-side-fallback"));
      return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
    },
  });
  assert.deepEqual(res, { ok: true });
});
