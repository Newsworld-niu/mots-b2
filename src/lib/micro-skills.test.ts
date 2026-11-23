import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeMisses } from "./listening.ts";
import { gradeMicroItem, MICRO_SKILL_TRACKS, microItemToMiss } from "./micro-skills.ts";

test("Post-2020 micro-skill tracks cover 4 CO/CE specialties (12 items) with 100% 3-option QCMs, restriction traps, and miss snapshots", () => {
  assert.equal(MICRO_SKILL_TRACKS.length, 4);
  const total = MICRO_SKILL_TRACKS.reduce((s, t) => s + t.items.length, 0);
  assert.equal(total, 12);
  assert.equal(MICRO_SKILL_TRACKS.some((t) => t.id === "ce-quote"), false);

  for (const track of MICRO_SKILL_TRACKS) {
    for (const item of track.items) {
      assert.ok(!item.qType || item.qType === "qcm", `${item.id} must be 3-option QCM`);
      assert.equal(item.options.length, 3, `${item.id} must have 3 options`);
      assert.ok(item.evidence && item.text.includes(item.evidence), `${item.id} evidence must be verbatim in text`);
      assert.equal(item.trapTypes?.length, 3, `${item.id} must define per-option trapTypes`);
    }
  }

  const ceRestrictTrack = MICRO_SKILL_TRACKS.find((t) => t.id === "ce-restrict")!;
  assert.ok(ceRestrictTrack);
  assert.ok(ceRestrictTrack.title.includes("ne…que / sauf / à peine"));
  const q1 = ceRestrictTrack.items[0];

  assert.equal(gradeMicroItem(q1, q1.answer).correct, true);
  assert.equal(gradeMicroItem(q1, (q1.answer + 1) % 3).correct, false);

  // Snapshotted miss survives sanitizeMisses for MistakeReflow Tab 4 interactive retry
  const rawMiss = microItemToMiss(ceRestrictTrack, q1, 1_710_000_000_000);
  const cleaned = sanitizeMisses([rawMiss]);
  assert.ok(cleaned);
  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].q, `micro:ce-restrict:${q1.id}`);
  assert.equal(cleaned[0].qType, "qcm");
  assert.equal(cleaned[0].options?.length, 3);
  assert.ok(cleaned[0].excerpt && cleaned[0].why);
});
