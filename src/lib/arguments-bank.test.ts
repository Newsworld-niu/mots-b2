import assert from "node:assert/strict";
import { test } from "node:test";
import { ARGUMENTS_BANK, argumentsFor } from "./arguments-bank.ts";
import { ESSAY_TASKS, ESSAY_TASK_IDS } from "./essay.ts";
import { B2_TOPICS_META, SPEAKING_SUBJECTS } from "./exam.ts";
import { speakingPresetOf } from "./speaking-presets.ts";
import { buildUpgradeNote, inferUpgradeErrorType } from "../ui/ParagraphUpgrader.tsx";

test("Wave7.3: all 15 DELF B2 official themes are covered in PE, PO, SpeakingPresets, and ArgumentsBank", () => {
  const b2EssayTopics = new Set(ESSAY_TASKS.filter((t) => t.level === "B2" && t.topic).map((t) => t.topic));
  const poTopics = new Set(SPEAKING_SUBJECTS.map((s) => s.topic));

  for (const meta of B2_TOPICS_META) {
    assert.ok(b2EssayTopics.has(meta.id), `Missing B2 essay task for theme: ${meta.id}`);
    assert.ok(poTopics.has(meta.id), `Missing speaking subject for theme: ${meta.id}`);

    const args = argumentsFor(meta.id);
    assert.ok(args, `Missing arguments bank for theme: ${meta.id}`);
    assert.equal(args.pro.length >= 2, true, `${meta.id} needs >= 2 pro arguments`);
    assert.equal(args.con.length >= 2, true, `${meta.id} needs >= 2 con arguments`);
    assert.equal(args.examples.length >= 2, true, `${meta.id} needs >= 2 French examples`);
  }

  for (const t of ESSAY_TASKS) {
    assert.ok(ESSAY_TASK_IDS.has(t.id), `ESSAY_TASK_IDS missing built-in task ${t.id}`);
  }
  for (const s of SPEAKING_SUBJECTS) {
    const preset = speakingPresetOf(s.id);
    assert.ok(preset, `Speaking subject ${s.id} missing offline preset`);
    assert.ok(preset.followUps.length >= 6, `Speaking preset ${s.id} needs >= 6 progressive follow-ups`);
  }
  assert.equal(Object.keys(ARGUMENTS_BANK).length, B2_TOPICS_META.length);
});

test("Wave7.3: ParagraphUpgrader note helper converts upgrades cleanly into FSRS SavedNote payloads", () => {
  assert.equal(inferUpgradeErrorType("动词名词化 + 高阶衔接"), "word-order");
  assert.equal(inferUpgradeErrorType("语域替换 B2 搭配"), "word-choice");
  assert.equal(inferUpgradeErrorType("虚拟式时态"), "tense");

  const note = buildUpgradeNote({
    change: {
      technique: "动词名词化",
      before: "Si on ferme les rues aux voitures, les gens seront plus calmes.",
      after: "La piétonnisation du centre-ville favoriserait la sérénité des habitants.",
      why: "名词化避免假设句口语化，句式更凝练",
    },
    draft: "Si on ferme les rues...",
    title: "市中心禁止汽车通行",
  });
  assert.equal(note.point, "");
  assert.equal(note.type, "word-order");
  assert.ok(note.right.includes("La piétonnisation"));
  assert.ok(note.from.includes("段落升格"));
});
