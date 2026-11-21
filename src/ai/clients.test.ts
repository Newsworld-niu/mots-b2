import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_MODELS, GRADING_RECOMMENDED_MODELS } from "./config.ts";
import { buildAnthropicBody, buildOpenAiChatBody, supportsTemperature, type JsonRequest } from "./clients.ts";
import { buildRewritePayload, ESSAY_SCHEMA, ESSAY_SYSTEM, MODEL_SYSTEM, REWRITE_SYSTEM, SPEAK_SCHEMA, SPEAK_SYSTEM, TEXT_SYSTEM } from "./tasks.ts";

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

test("ESSAY_SCHEMA and SPEAK_SCHEMA restrict scores to integer enum [0, 1, 3, 5] and ESSAY_SYSTEM has independent anchors", () => {
  for (const prop of Object.values(ESSAY_SCHEMA.properties.scores.properties)) {
    assert.deepEqual(prop, { type: "integer", enum: [0, 1, 3, 5] });
  }
  for (const prop of Object.values(SPEAK_SCHEMA.properties.scores.properties)) {
    assert.deepEqual(prop, { type: "integer", enum: [0, 1, 3, 5] });
  }
  assert.ok(ESSAY_SYSTEM.includes("Calibration anchors"));
  assert.ok(!ESSAY_SYSTEM.includes("voitures") && !ESSAY_SYSTEM.includes("télétravail"));
  assert.ok(SPEAK_SYSTEM.includes("Calibration anchors"));
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
  assert.ok(TEXT_SYSTEM.includes("4 options written in French"));
  assert.ok(TEXT_SYSTEM.includes("one sentence in Chinese"));
});
