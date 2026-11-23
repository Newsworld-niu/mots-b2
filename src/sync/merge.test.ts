import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeBackups } from "./merge.ts";

const makeBackup = (overrides: Record<string, unknown> = {}, top: Record<string, unknown> = {}) =>
  JSON.stringify({
    app: "word-atlas",
    version: 2,
    exported: "2026-11-22T01:00:00.000Z",
    ...top,
    progress: {
      version: 2,
      datasetId: "francais-b2-lexicon",
      cards: {},
      bookmarks: [],
      days: {},
      typing: [],
      session: null,
      mistakes: [],
      ...overrides,
    },
    settings: { dailyNew: 15, onboarded: true, ...(top.settings as object | undefined) },
  });

test("mergeBackups merges cards by latest timestamp, preserves unions, essays revisions, days max, and examBank", () => {
  const cardAOld = { due: 10, s: 1, d: 5, el: 0, sd: 1, ls: 0, reps: 1, lapses: 0, st: 2, seen: 100, last: 200 };
  const cardANew = { due: 50, s: 5, d: 4, el: 2, sd: 4, ls: 0, reps: 3, lapses: 0, st: 2, seen: 100, last: 900 };
  const cardB = { due: 20, s: 2, d: 5, el: 0, sd: 1, ls: 0, reps: 1, lapses: 0, st: 2, seen: 500 };

  const localJson = makeBackup(
    {
      cards: { bonjour: cardAOld, localOnly: cardB },
      bookmarks: ["bonjour", "localOnly"],
      mistakes: ["m1"],
      days: { "2026-11-22": { n: 5, r: 10, c: 8, t: 120 } },
      essays: [{ id: "e-test1", task: "mail-invitation", text: "V1", created: 100 }],
      essayNotes: [{ id: "n1", task: "mail-invitation", wrong: "a", right: "b", type: "grammar", why: "w", at: 100 }],
      compMisses: [{ at: 100, part: "listen", cause: "vocab", q: "0-0" }],
      decks: [{ id: "d-test1", name: "Deck", words: ["w1", "w2"], created: 10 }],
    },
    {
      exported: "2026-11-22T02:00:00.000Z",
      essayDrafts: { "fb2.essay.draft.mail-invitation": "Brouillon un" },
      examBank: {
        papers: [{ id: "p-test1", kind: "listen", level: "B2", created: 10, src: "ai", exs: [{ form: "long", intro: "i", docs: [{ text: "Document un assez long pour tester la validation.", zh: "译" }], questions: [{ doc: 0, q: "Question 1", options: ["a", "b", "c"], answer: 0, why: "y", pts: 1 }] }] }],
        attempts: { "p-test1": [{ at: 100, picked: { "0-0": 0 }, score: 1, total: 1 }] },
      },
    },
  );

  const remoteJson = makeBackup(
    {
      cards: { bonjour: cardANew, remoteOnly: cardB },
      bookmarks: ["remoteOnly", "bonjour"],
      mistakes: ["m2", "m1"],
      days: { "2026-11-22": { n: 3, r: 14, c: 12, t: 90 }, "2026-11-21": { n: 8, r: 5, c: 5, t: 60 } },
      essays: [{ id: "e-test1", task: "mail-invitation", text: "V1", created: 100, rev: { text: "V2", at: 500 } }],
      essayNotes: [{ id: "n2", task: "mail-invitation", wrong: "x", right: "y", type: "word-choice", why: "w", at: 200 }],
      compMisses: [{ at: 200, part: "read", cause: "paraphrase", q: "0-1" }],
      decks: [{ id: "d-test1", name: "Deck", words: ["w2", "w3"], created: 10 }],
    },
    {
      exported: "2026-11-22T03:00:00.000Z",
      settings: { dailyNew: 25 },
      essayDrafts: { "fb2.essay.draft.t2": "Brouillon deux" },
      examBank: {
        papers: [],
        attempts: { "p-test1": [{ at: 200, picked: { "0-0": 0 }, score: 1, total: 1 }] },
      },
    },
  );

  const res = mergeBackups(localJson, remoteJson);
  assert.equal(res.ok, true);
  if (!res.ok) return;

  const merged = JSON.parse(res.json) as any;
  assert.deepEqual(Object.keys(merged.progress.cards).sort(), ["bonjour", "localOnly", "remoteOnly"]);
  assert.equal(merged.progress.cards.bonjour.reps, 3, "newer card state wins");
  assert.deepEqual(merged.progress.bookmarks, ["bonjour", "localOnly", "remoteOnly"]);
  assert.deepEqual(merged.progress.mistakes, ["m1", "m2"]);
  assert.deepEqual(merged.progress.days["2026-11-22"], { n: 5, r: 14, c: 12, t: 120 });
  assert.deepEqual(merged.progress.days["2026-11-21"], { n: 8, r: 5, c: 5, t: 60 });
  assert.equal(merged.progress.essays[0].rev.text, "V2");
  assert.equal(merged.progress.essayNotes.length, 2);
  assert.equal(merged.progress.compMisses.length, 2);
  assert.deepEqual(merged.progress.decks[0].words, ["w1", "w2", "w3"]);
  assert.equal(merged.settings.dailyNew, 25, "newer settings timestamp wins");
  assert.equal(Object.keys(merged.essayDrafts).length, 2);
  assert.equal(merged.examBank.papers.length, 1);
  assert.equal(merged.examBank.attempts["p-test1"].length, 2);
});

test("mergeBackups rejects mismatched datasets or corrupt JSON", () => {
  const a = makeBackup({}, {});
  const b = makeBackup({ datasetId: "other" }, {});
  assert.equal(mergeBackups(a, b).ok, false);
  assert.equal(mergeBackups(a, "{bad").ok, false);
});

test("mergeBackups respects deletion tombstones, timestamped shortened notes/drafts, and 500 typing cap", () => {
  const now = Date.now();
  const newerTs = now - 10_000;
  const olderTs = now - 60_000;
  const delTs = now - 5_000;

  const localJson = makeBackup(
    {
      essays: [],
      texts: [],
      essayNotes: [],
      dictFavs: [],
      bookmarks: [],
      dictNotes: { prendre: "note courte" },
      dictNotesAt: { prendre: newerTs },
      typing: Array.from({ length: 260 }, (_, i) => ({ at: 1000 + i, mode: "word", items: 10, wpm: 40, accuracy: 90 })),
      tombstones: {
        "essay:e-del1": delTs,
        "text:t-del1": delTs,
        "note:n-del1": delTs,
        "fav:accueil": delTs,
        "bookmark:w-del": delTs,
        "draft:fb2.essay.draft.cleared": delTs,
      },
    },
    {
      essayDrafts: { "fb2.essay.draft.edit1": "court" },
      essayDraftsAt: { "fb2.essay.draft.edit1": newerTs },
    },
  );

  const remoteJson = makeBackup(
    {
      essays: [{ id: "e-del1", task: "mail-invitation", text: "Old deleted", created: olderTs }],
      texts: [{ id: "t-del1", title: "Old text", text: "Bonjour", created: olderTs, src: "paste" }],
      essayNotes: [{ id: "n-del1", task: "mail-invitation", wrong: "a", right: "b", type: "grammar", why: "w", at: olderTs }],
      dictFavs: ["accueil", "beau"],
      bookmarks: ["w-del", "w-keep"],
      dictNotes: { prendre: "une note beaucoup plus longue qui est plus ancienne" },
      dictNotesAt: { prendre: olderTs },
      typing: Array.from({ length: 100 }, (_, i) => ({ at: 5000 + i, mode: "word", items: 10, wpm: 45, accuracy: 95 })),
    },
    {
      essayDrafts: {
        "fb2.essay.draft.edit1": "un brouillon beaucoup plus long et plus ancien",
        "fb2.essay.draft.cleared": "brouillon supprimé localement",
      },
      essayDraftsAt: {
        "fb2.essay.draft.edit1": olderTs,
        "fb2.essay.draft.cleared": olderTs,
      },
    },
  );

  const res = mergeBackups(localJson, remoteJson);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  const merged = JSON.parse(res.json) as any;

  assert.equal(merged.progress.essays ?? undefined, undefined);
  assert.equal(merged.progress.texts ?? undefined, undefined);
  assert.equal(merged.progress.essayNotes ?? undefined, undefined);
  assert.deepEqual(merged.progress.dictFavs, ["beau"]);
  assert.deepEqual(merged.progress.bookmarks, ["w-keep"]);
  assert.equal(merged.progress.dictNotes.prendre, "note courte");
  assert.equal(merged.essayDrafts["fb2.essay.draft.edit1"], "court");
  assert.equal(merged.essayDrafts["fb2.essay.draft.cleared"], undefined);
  assert.equal(merged.progress.typing.length, 360);
});

test("Wave7.2: mergeBackups merges speakingSessions, mockRecords, weeklyPlan task progress, suspendedLeeches, dailyReviewCap, and tombstones", () => {
  const now = Date.now();
  const planA = {
    id: "plan-1",
    createdAt: now - 5000,
    focusPart: "listen",
    target: 75,
    total100: 54,
    tasks: [
      { id: "d1", day: 1, part: "listen", title: "CO 1", route: "#/real", minutes: 35, doneAt: now - 2000 },
      { id: "d2", day: 2, part: "listen", title: "CO 2", route: "#/listen", minutes: 30 },
    ],
  };
  const planB = {
    ...planA,
    tasks: [
      { id: "d1", day: 1, part: "listen", title: "CO 1", route: "#/real", minutes: 35 },
      { id: "d2", day: 2, part: "listen", title: "CO 2", route: "#/listen", minutes: 30, doneAt: now - 1000 },
    ],
  };

  const localJson = makeBackup(
    {
      speakingSessions: [
        { id: "ss-1", at: now - 3000, subjectId: "sub1", title: "S1", topic: "travail", monologueWords: 180, monologueSec: 300, debateTurns: 4, debateSec: 400, total25: 17 },
      ],
      mockRecords: [
        { id: "mk-1", at: now - 4000, setIdx: 0, label: "套卷 1", strict: true, co: 15, ce: 16, pe: 14, po: 15, total100: 60, peTaskId: "courrier-voitures", poSubjectId: "sub1" },
      ],
      weeklyPlan: planA,
      suspendedLeeches: ["abandonner"],
      tombstones: { "mock:mk-del": now - 1000 },
    },
    { exported: new Date(now - 2000).toISOString(), settings: { dailyReviewCap: 60 } },
  );

  const remoteJson = makeBackup(
    {
      speakingSessions: [
        { id: "ss-2", at: now - 1000, subjectId: "sub2", title: "S2", topic: "sante", monologueWords: 200, monologueSec: 320, debateTurns: 5, debateSec: 450, total25: 19 },
      ],
      mockRecords: [
        { id: "mk-del", at: now - 6000, setIdx: 1, label: "套卷 2", strict: false, co: 10, ce: 10, pe: 10, po: 10, total100: 40, peTaskId: "courrier-voitures", poSubjectId: "sub2" },
      ],
      weeklyPlan: planB,
      suspendedLeeches: ["pallier", "abandonner"],
    },
    { exported: new Date(now - 5000).toISOString(), settings: { dailyReviewCap: 80 } },
  );

  const res = mergeBackups(localJson, remoteJson);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  const merged = JSON.parse(res.json) as any;
  assert.equal(merged.progress.speakingSessions.length, 2);
  assert.equal(merged.progress.mockRecords.length, 1);
  assert.equal(merged.progress.mockRecords[0].id, "mk-1");
  assert.ok(merged.progress.weeklyPlan.tasks[0].doneAt);
  assert.ok(merged.progress.weeklyPlan.tasks[1].doneAt);
  assert.deepEqual(merged.progress.suspendedLeeches, ["abandonner", "pallier"]);
  assert.equal(merged.settings.dailyReviewCap, 60);
});

test("Lounge: mergeBackups merges bookProgress & mediaProgress by newest updatedAt preserving done, loungeDays max, and loungeClips with tombstones", () => {
  const now = Date.now();
  const localJson = makeBackup(
    {
      bookProgress: {
        "petit-prince": { ch: 2, para: 4, ratio: 0.5, updatedAt: now - 5000, done: now - 5000, title: "Le Petit Prince" },
        "local-book": { ch: 1, para: 0, ratio: 0.2, updatedAt: now - 1000, title: "Contes" },
      },
      mediaProgress: {
        "vid-1": { pos: 30, dur: 120, updatedAt: now - 4000, done: now - 4000, title: "Arte 1", shelf: "videos" },
      },
      loungeDays: { "2026-11-22": 2, "2026-11-23": 1 },
      loungeClips: [
        { id: "lc-keep-local", fr: "On ne voit bien qu'avec le cœur.", zh: "只有用心才能看清。", source: "小王子", created: now - 2000 },
      ],
      tombstones: { "loungeClip:lc-deleted": now - 1000 },
    },
    { exported: new Date(now - 1000).toISOString(), settings: { loungeMode: "study" } },
  );

  const remoteJson = makeBackup(
    {
      bookProgress: {
        "petit-prince": { ch: 3, para: 8, ratio: 0.85, updatedAt: now - 1000 },
      },
      mediaProgress: {
        "vid-1": { pos: 95, updatedAt: now - 500 },
        "read-1": { pos: 1, dur: 1, updatedAt: now - 800, done: now - 800, title: "Café", shelf: "reads" },
      },
      loungeDays: { "2026-11-22": 1, "2026-11-23": 4 },
      loungeClips: [
        { id: "lc-deleted", fr: "Ancienne phrase", zh: "旧句", source: "旧来源", created: now - 5000 },
        { id: "lc-keep-remote", fr: "L'essentiel est invisible pour les yeux.", zh: "本质用眼睛是看不见的。", source: "小王子", created: now - 500 },
      ],
    },
    { exported: new Date(now - 5000).toISOString(), settings: { loungeMode: "chill" } },
  );

  const res = mergeBackups(localJson, remoteJson);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  const merged = JSON.parse(res.json) as {
    progress: {
      bookProgress: Record<string, { ch: number; ratio: number; done?: number; title?: string }>;
      mediaProgress: Record<string, { pos: number; dur?: number; done?: number; shelf?: string }>;
      loungeDays: Record<string, number>;
      loungeClips: { id: string }[];
    };
    settings: { loungeMode: string };
  };

  assert.equal(merged.progress.bookProgress["petit-prince"].ch, 3);
  assert.equal(merged.progress.bookProgress["petit-prince"].ratio, 0.85);
  assert.equal(merged.progress.bookProgress["petit-prince"].done, now - 5000, "preserves done across devices");
  assert.equal(merged.progress.bookProgress["petit-prince"].title, "Le Petit Prince", "preserves title fallback");
  assert.equal(merged.progress.bookProgress["local-book"].ch, 1);

  assert.equal(merged.progress.mediaProgress["vid-1"].pos, 95);
  assert.equal(merged.progress.mediaProgress["vid-1"].done, now - 4000, "preserves media done");
  assert.equal(merged.progress.mediaProgress["vid-1"].dur, 120);
  assert.equal(merged.progress.mediaProgress["vid-1"].shelf, "videos");
  assert.equal(merged.progress.mediaProgress["read-1"].shelf, "reads");

  assert.deepEqual(merged.progress.loungeDays, { "2026-11-23": 4, "2026-11-22": 2 });
  assert.deepEqual(
    merged.progress.loungeClips.map((c) => c.id),
    ["lc-keep-remote", "lc-keep-local"],
  );
  assert.equal(merged.settings.loungeMode, "study");
});
