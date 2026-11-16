import assert from "node:assert/strict";
import { test } from "node:test";
import { filterImport } from "./filter-import";
import type { aiJson } from "./clients";
import type { Candidate } from "../lib/extract";

const candidates: Candidate[] = [
  { key: "chat", word: "chat", kind: "atlas", id: "chat", zh: "猫", count: 1, forms: ["chats"], sentence: "Les chats dorment." },
  { key: "dormir", word: "dormir", kind: "dict", zh: "睡觉", count: 1, forms: ["dorment"], sentence: "Les chats dorment." },
];

test("empty requirements skip AI; filtering preserves existing metadata and order", async () => {
  const request = (async (service, req) => {
    assert.equal(service, "text");
    const input = JSON.parse(req.text);
    assert.equal(input.requirements, "只要动词");
    assert.equal(input.source, "Les chats dorment.");
    assert.deepEqual(input.candidates[1].forms, ["dorment"]);
    return { keys: ["dormir", "dormir"] };
  }) as typeof aiJson;
  assert.equal(await filterImport(candidates, " ", "", [], undefined, request), candidates);
  const out = await filterImport(candidates, "只要动词", "Les chats dorment.", [], undefined, request);
  assert.deepEqual(out, [candidates[1]]);
  assert.equal(out[0], candidates[1]);
});

test("photo filtering passes original images and cancellation to vision", async () => {
  const attachments = [{ mime: "image/png", data: "test" }];
  const signal = new AbortController().signal;
  const request = (async (service, req) => {
    assert.equal(service, "vision");
    assert.equal(req.attachments, attachments);
    assert.equal(req.signal, signal);
    return { keys: [] };
  }) as typeof aiJson;
  assert.deepEqual(await filterImport(candidates, "只要右侧词表", "", attachments, signal, request), []);
});

test("malformed or invented selections fail instead of silently importing everything", async () => {
  for (const result of [{}, { keys: "chat" }, { keys: [12] }, { keys: ["invented"] }]) {
    const request = (async () => result) as typeof aiJson;
    await assert.rejects(filterImport(candidates, "只要名词", "", [], undefined, request), /AI 筛选/);
  }
});
