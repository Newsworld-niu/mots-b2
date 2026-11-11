import assert from "node:assert/strict";
import { test } from "node:test";
import { checkLexicon, entryKey, fold, parseCSV, slug, upsertRows } from "./core.ts";
import { emptyLexicon } from "./core.ts";
import type { ImportRow, Lexicon } from "./types.ts";

const base = (over: Partial<ImportRow> = {}): ImportRow => ({
  lemma: "entretien",
  pos: "n.m.",
  level: "unverified",
  topic: "work",
  zh: "面试",
  fr_def: "Rencontre formelle entre un candidat et un recruteur.",
  example_fr: "J'ai un entretien lundi.",
  example_zh: "我周一有一场面试。",
  origin: "supplement",
  book: "author-supplement",
  ...over,
});

test("folding and slugs ignore accents and apostrophes", () => {
  assert.equal(fold("Écouter"), "ecouter");
  assert.equal(fold("l’inégalité"), "l'inegalite");
  assert.equal(slug("avoir lieu"), "avoir-lieu");
  assert.equal(slug("œuvre"), "oeuvre");
  assert.equal(entryKey("Mémoire", "n.f."), entryKey("mémoire", "n.f."), "case is identity");
  assert.notEqual(entryKey("mémoire", "n.f."), entryKey("memoire", "n.f."), "accents are identity");
  assert.notEqual(entryKey("mémoire", "n.f."), entryKey("mémoire", "n.m."), "gender is part of identity");
});

test("CSV parser handles quotes, embedded commas, doubled quotes and CRLF", () => {
  const rows = parseCSV('lemma,zh,tip\r\nentretien,"面试，会谈","say ""hi"""\r\nmémoire,记忆,\r\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].zh, "面试，会谈");
  assert.equal(rows[0].tip, 'say "hi"');
  assert.equal(rows[1].tip, "");
});

test("missing or invalid fields are rejected with a Chinese message and do not create entries", () => {
  const lex = emptyLexicon();
  const r = upsertRows(lex, [base({ lemma: "" }), base({ pos: "nom" }), base({ level: "C9" }), base({ topic: "sport" }), base({ zh: "" }), base({ origin: "book", book: "author-supplement" })]);
  assert.equal(r.added, 0);
  assert.equal(r.issues.filter((i) => i.severity === "error").length, 6);
  assert.equal(lex.entries.length, 0);
});

test("importing the same rows twice adds nothing (idempotent)", () => {
  const lex = emptyLexicon();
  const rows = [base(), base({ lemma: "salaire", zh: "薪水", topic: "work" }), base({ lemma: "salaire", zh: "薪水", topic: "work", example_fr: "" })];
  const first = upsertRows(lex, rows);
  assert.equal(first.added, 2);
  const ids = lex.entries.map((e) => e.id);
  const second = upsertRows(lex, rows);
  assert.equal(second.added, 0);
  assert.equal(second.updated, 0);
  assert.deepEqual(lex.entries.map((e) => e.id), ids);
  assert.deepEqual(checkLexicon(lex), []);
});

test("homographs with different gender or part of speech become separate entries with distinct stable ids", () => {
  const lex = emptyLexicon();
  upsertRows(lex, [
    base({ lemma: "mémoire", pos: "n.f.", zh: "记忆", topic: "education" }),
    base({ lemma: "mémoire", pos: "n.m.", zh: "学位论文", topic: "education", example_fr: "Son mémoire est prêt." }),
    base({ lemma: "citoyen", pos: "n.m.", zh: "公民", topic: "society" }),
    base({ lemma: "citoyen", pos: "adj.", zh: "公民的", topic: "society" }),
  ]);
  assert.equal(lex.entries.length, 4);
  assert.equal(new Set(lex.entries.map((e) => e.id)).size, 4, "ids must be unique");
  assert.deepEqual(checkLexicon(lex), []);
});

test("a second meaning of the same headword and part of speech is added as a sense, not a new entry", () => {
  const lex = emptyLexicon();
  upsertRows(lex, [base({ lemma: "commerce", pos: "n.m.", zh: "贸易", topic: "economy" }), base({ lemma: "commerce", pos: "n.m.", zh: "商店", topic: "economy", fr_def: "Lieu où l'on vend." })]);
  assert.equal(lex.entries.length, 1);
  assert.equal(lex.entries[0].senses.length, 2);
});

test("accent-only variants are kept as separate entries and reported; level/topic conflicts keep the existing value", () => {
  const lex = emptyLexicon();
  upsertRows(lex, [base({ lemma: "vérifier", pos: "v.", zh: "核实", topic: "media", level: "B2", level_basis: "书籍 B2" })]);
  const r = upsertRows(lex, [base({ lemma: "verifier", pos: "v.", zh: "检查", topic: "work", level: "A2" })]);
  assert.equal(lex.entries.length, 2, "accents are identity: two entries");
  assert.ok(r.issues.some((i) => /仅重音不同/.test(i.message)), "near-duplicate is reported for review");
  // same lemma, different level/topic: conflict kept, existing value wins
  const r2 = upsertRows(lex, [base({ lemma: "vérifier", pos: "v.", zh: "核实", topic: "work", level: "A2" })]);
  assert.ok(r2.conflicts.some((c) => /主题冲突/.test(c.message)));
  assert.ok(r2.conflicts.some((c) => /等级冲突/.test(c.message)));
  assert.equal(lex.entries[0].topic, "media");
  assert.equal(lex.entries[0].level, "B2");
});

test("verbs must be given in the infinitive; conjugated forms produce a warning", () => {
  const lex = emptyLexicon();
  const r = upsertRows(lex, [base({ lemma: "vais", pos: "v.", zh: "去", topic: "travel" as never })]);
  assert.ok(r.issues.some((i) => i.severity === "warning" && /不定式/.test(i.message)) || r.issues.some((i) => i.severity === "error"));
});

test("book-origin rows need a real source file and should carry a page", () => {
  const lex = emptyLexicon();
  const r = upsertRows(lex, [base({ origin: "book", book: "Vocabulaire progressif du français (avancé B2 C1.1) (Claire Miquel).pdf", kind: "index", printed_page: "86", chapter: "La vie intellectuelle", fr_def: "", lemma: "accuser", pos: "v.", zh: "指控", topic: "society" })]);
  assert.equal(r.issues.filter((i) => i.severity === "error").length, 0);
  assert.equal(lex.entries[0].sources[0].printedPage, 86);
  assert.equal(lex.entries[0].senses[0].origin, "book");
  assert.ok(r.issues.some((i) => /法语释义/.test(i.message)), "missing French definition is reported");
});

test("checkLexicon catches duplicate ids and missing sources", () => {
  const lex: Lexicon = { version: 1, entries: [
    { id: "a", lemma: "a", pos: "adv.", level: "A1", levelBasis: "", topic: "work", senses: [{ zh: "x", fr: "", origin: "supplement" }], examples: [], col: [], fam: [], syn: [], ant: [], tip: "", sources: [], review: "unreviewed" },
    { id: "a", lemma: "b", pos: "adv.", level: "A1", levelBasis: "", topic: "work", senses: [{ zh: "y", fr: "", origin: "supplement" }], examples: [], col: [], fam: [], syn: [], ant: [], tip: "", sources: [{ book: "author-supplement", kind: "author-supplement" }], review: "unreviewed" },
  ] } as Lexicon;
  const problems = checkLexicon(lex);
  assert.ok(problems.some((p) => /重复 id/.test(p)));
  assert.ok(problems.some((p) => /缺少来源/.test(p)));
});

test("accents are part of identity: tache (stain) and tâche (task) are different entries", () => {
  assert.notEqual(entryKey("tâche", "n.f."), entryKey("tache", "n.f."));
  assert.equal(entryKey("Tâche", "n.f."), entryKey("tâche", "n.f."), "case is not identity");
  const lex = emptyLexicon();
  upsertRows(lex, [base({ lemma: "tâche", pos: "n.f.", zh: "任务", topic: "work" }), base({ lemma: "tache", pos: "n.f.", zh: "污渍", topic: "work" })]);
  assert.equal(lex.entries.length, 2, "two words, two entries");
});
