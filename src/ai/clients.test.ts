import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAnthropicBody, buildOpenAiChatBody, supportsTemperature, type JsonRequest } from "./clients.ts";
import { ESSAY_SCHEMA, ESSAY_SYSTEM, SPEAK_SCHEMA } from "./tasks.ts";

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
});
