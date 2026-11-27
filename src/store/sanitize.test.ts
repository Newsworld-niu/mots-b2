import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeMisses, sanitizeSources } from "../lib/listening-schema";
import { sanitizeMisses as missesViaListening, sanitizeSources as sourcesViaListening } from "../lib/listening";
import { sanitizeTexts } from "../lib/reader-schema";
import { sanitizeTexts as textsViaReader } from "../lib/reader";
import { TOPICS, topicOf } from "../lib/topics";
import { TOPICS as topicsViaExam, topicOf as topicOfViaExam } from "../lib/exam";
import { dueGrammarCountFromMeta, untouchedGrammarErrorCount } from "./grammar-due";
import { duePoints, untouchedWithErrors } from "./grammar";
import { sanitizeSettings } from "./sanitize";
import { defaultSettings, type Progress } from "./types";

test("settings.goal defaults to everyday and keeps a valid stored value", () => {
  assert.equal(defaultSettings.goal, "everyday");
  assert.equal(sanitizeSettings({}).goal, "everyday");
  assert.equal(sanitizeSettings(null).goal, "everyday");
  assert.equal(sanitizeSettings({ goal: "exam" }).goal, "exam");
  assert.equal(sanitizeSettings({ goal: "everyday", examDate: "2027-03-14" }).goal, "everyday");
});

test("settings.goal is inferred for learners from before the mode switch", () => {
  assert.equal(sanitizeSettings({ examDate: "2027-03-14" }).goal, "exam");
  assert.equal(sanitizeSettings({ examDate: "" }).goal, "everyday");
  assert.equal(sanitizeSettings({ examDate: "2027-02-30" }).goal, "everyday", "an invalid date is dropped, so nothing to infer");
  assert.equal(sanitizeSettings({ examTrack: "tcf" }).goal, "exam");
  assert.equal(sanitizeSettings({ goal: "sprint", examDate: "2027-03-14" }).goal, "exam", "an unknown value falls back to inference");
  assert.equal(sanitizeSettings({ goal: 1 }).goal, "everyday");
});

test("schema modules are the same functions their old homes re-export", () => {
  assert.equal(missesViaListening, sanitizeMisses);
  assert.equal(sourcesViaListening, sanitizeSources);
  assert.equal(textsViaReader, sanitizeTexts);
  assert.equal(topicsViaExam, TOPICS);
  assert.equal(topicOfViaExam, topicOf);
  assert.equal(topicOf(TOPICS[0].id), TOPICS[0]);
});

test("sanitizeMisses and sanitizeTexts still validate untrusted data", () => {
  assert.equal(sanitizeMisses("x"), undefined);
  const misses = sanitizeMisses([{ at: 1, part: "listen", cause: "vocab", q: "1-2" }, { at: 2, part: "x", cause: "vocab" }]);
  assert.deepEqual(misses, [{ at: 1, part: "listen", cause: "vocab", q: "1-2" }]);
  const texts = sanitizeTexts([{ id: "t-abcd", text: "Bonjour tout le monde\nSuite", created: 5 }, { id: "bad", text: "x" }]);
  assert.equal(texts?.length, 1);
  assert.equal(texts?.[0].title, "Bonjour tout le monde");
  assert.equal(sanitizeSources([{ id: "s-abcd", url: "https://example.org/a", created: 1, start: 5, end: 2 }])?.[0].end, 5);
});

test("light grammar counters agree with store/grammar on due and untouched points", () => {
  const now = 1_800_000_000_000;
  const card = (due: number, last?: number) => ({ due, s: 1, d: 5, el: 0, sd: 1, ls: 0, reps: 1, lapses: 0, st: 2, seen: 1000, ...(last ? { last } : {}) });
  const meta = [{ id: "subjonctif" }, { id: "passif" }, { id: "gerondif" }, { id: "but" }];
  const p = {
    gram: {
      subjonctif: card(now - 1),
      passif: card(now + 86_400_000, 2000),
      gerondif: card(now + 86_400_000, 2000),
    },
    essayNotes: [
      { id: "n1", wrong: "il faut que tu viens", right: "il faut que tu viennes", why: "", point: "passif", at: 5000, from: "篇章" },
      { id: "n2", wrong: "pour que il", right: "pour qu'il", why: "", point: "but", at: 6000, from: "口语纠错" },
      { id: "n3", wrong: "same", right: "same", why: "", point: "gerondif", at: 9000, from: "篇章" },
    ],
    essays: [],
    speakCorrections: [],
  } as unknown as Pick<Progress, "gram" | "essayNotes" | "essays" | "speakCorrections">;
  const data = { points: meta };
  assert.equal(dueGrammarCountFromMeta(meta, p, now), duePoints(data, p, now).length);
  assert.equal(dueGrammarCountFromMeta(meta, p, now), 2, "the due card and the point with a newer mistake");
  assert.equal(untouchedGrammarErrorCount(meta, p), untouchedWithErrors(data, p).length);
  assert.equal(untouchedGrammarErrorCount(meta, p), 1);
  assert.equal(dueGrammarCountFromMeta(null, p, now), 0);
  assert.equal(dueGrammarCountFromMeta(meta, { ...p, gram: undefined }, now), 0);
});
