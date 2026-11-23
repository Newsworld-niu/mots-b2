/* Generate public/atlas/ (index.json + entries/N.json) from data/lexicon.json, in the format the app reads.
 * Words are ordered as a learning path by corpus frequency (data/frequency.json, most frequent first);
 * entries without a frequency follow, by level (A1→C2), then topic, then lexicon order.
 * The learner's start level still filters this path (src/store/session.ts nextNew). */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { LEVELS, type LexEntry, type Lexicon } from "./lexicon/types.ts";
import { TOPICS, checkLexicon } from "./lexicon/core.ts";
import { checkGroups, type CfData, type CfGroup } from "../src/lib/confusables.ts";
import { estimateFromSources, estimateLevel, type Band, type LevelResult, type Span } from "./lexicon/levels.ts";

const ROOT = resolve(import.meta.dirname, "..");

// Recordings made by scripts/build-audio.py: an entry's media bits say which files exist (see MEDIA in src/atlas/types.ts).
const AUDIO_BITS: [dir: string, bit: number][] = [["f", 2], ["m", 4], ["ex-f", 8], ["ex2-f", 16], ["ex-m", 32], ["ex2-m", 64]];
const recorded = AUDIO_BITS.map(([dir, bit]) => {
  const d = resolve(ROOT, "public/atlas/audio", dir);
  return [bit, new Set(existsSync(d) ? readdirSync(d).filter((f) => f.endsWith(".mp3")).map((f) => f.slice(0, -4)) : [])] as const;
});
const mediaOf = (id: string) => recorded.reduce((m, [bit, ids]) => (ids.has(id) ? m | bit : m), 0);
const lex: Lexicon = JSON.parse(readFileSync(resolve(ROOT, "data/lexicon.json"), "utf8"));
const problems = checkLexicon(lex);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}

// index used by the app: 0..5 = A1..C2. "unverified" is a lexicon state only: every word is shown under a band.
const LEVEL_NAMES = LEVELS.filter((l) => l !== "unverified");

// Book-level evidence (data/book-levels.json). A word gets a 推定 band from its source books and its corpus frequency
// (scripts/lexicon/levels.ts: book span, split by frequency, capped by frequency); it is never an official level.
type BookLevel = { stated: string; basis: string; span?: [Band, Band] };
const bookLevels: Record<string, BookLevel> = JSON.parse(readFileSync(resolve(ROOT, "data/book-levels.json"), "utf8"));
const spanOfBook = (book: string): Span | undefined => {
  const b = bookLevels[book];
  if (!b) return undefined;
  if (b.span) return b.span;
  const only = estimateFromSources([b.stated]);
  return only ? [only, only] : undefined;
};
// Frequency counts only for single words matched in Lexique; expressions and unmatched entries have no usable measure.
const measuredFreq = (id: string): number | null => {
  const q = freq[id];
  return !q || q.m === "multiword" || q.m === "none" ? null : q.f;
};
const levelCache = new Map<string, LevelResult | null>();
const levelOf = (e: LexEntry): LevelResult | null => {
  if (!levelCache.has(e.id)) {
    levelCache.set(e.id, e.level !== "unverified" ? { band: e.level, how: "book", span: [e.level, e.level] } : estimateLevel(e.sources.map((s) => spanOfBook(s.book)), measuredFreq(e.id)));
  }
  return levelCache.get(e.id)!;
};
// a word with no book evidence at all (an author supplement without a level) is filed under B2, the level the atlas aims at
const estimateOf = (e: LexEntry): Band => levelOf(e)?.band ?? "B2";
const HOW: Record<string, (r: LevelResult, f: number | null) => string> = {
  book: (r) => `教材定位 ${r.span[0]}${r.span[0] === r.span[1] ? "" : "–" + r.span[1]}`,
  "split-common": (r, f) => `教材覆盖 ${r.span[0]}–${r.span[1]}，词频每百万词 ${Math.round(f!)} 次（常用），归 ${r.band}`,
  "split-rare": (r, f) => `教材覆盖 ${r.span[0]}–${r.span[1]}，词频每百万词 ${Math.round(f!)} 次（较少见），归 ${r.band}`,
  "split-unknown": (r) => `教材覆盖 ${r.span[0]}–${r.span[1]}，词组或无词频，按所在教材归 ${r.band}`,
  "freq-cap": (r, f) => `教材定位 ${r.from}，语料中每百万词 ${Math.round(f!)} 次，调整为 ${r.band}`,
};
const levelBasisOf = (e: LexEntry) => {
  // a level set by hand in the lexicon carries its own reason
  if (e.level !== "unverified" && e.levelBasis) return e.levelBasis;
  const r = levelOf(e);
  return r ? `推定 ${r.band}（逐词未核实）。依据：${HOW[r.how](r, measuredFreq(e.id))}；${basisOf(e)}` : `没有教材依据，归入 B2。${e.levelBasis}`;
};
const basisOf = (e: LexEntry) => [...new Set(e.sources.map((s) => bookLevels[s.book]).filter(Boolean).map((b) => `${b!.stated}：${b!.basis}`))].join("；");
const CHUNK = 100;

// Corpus frequency per entry (data/frequency.json, from Lexique 3.83 via scripts/build-frequency.py).
// The learning path follows it: the words met most often in French come first, as in the English atlas.
const FREQ_FILE = resolve(ROOT, "data/frequency.json");
const freq: Record<string, { f: number; m: string }> = existsSync(FREQ_FILE) ? JSON.parse(readFileSync(FREQ_FILE, "utf8")).entries : {};
if (!existsSync(FREQ_FILE)) console.warn("data/frequency.json not found: run `npm run lexicon:freq`; falling back to level/topic order");

// IPA per entry (data/ipa.json, scripts/build-ipa.py, from Lexique 3.83). French has no UK/US split: both fields carry the same text.
const IPA_FILE = resolve(ROOT, "data/ipa.json");
const ipaMap: Record<string, { p: string; m: string }> = existsSync(IPA_FILE) ? JSON.parse(readFileSync(IPA_FILE, "utf8")).entries : {};
if (!existsSync(IPA_FILE)) console.warn("data/ipa.json not found: run `npm run lexicon:ipa`; no transcriptions");
const ipaOf = (id: string) => (ipaMap[id] ? `/${ipaMap[id].p}/` : "");

// Highlight span of the headword in each example (data/highlights.json, scripts/build-highlights.py, from Lexique 3.83).
const HL_FILE = resolve(ROOT, "data/highlights.json");
const hlMap: Record<string, ([number, number] | null)[]> = existsSync(HL_FILE) ? JSON.parse(readFileSync(HL_FILE, "utf8")).entries : {};
if (!existsSync(HL_FILE)) console.warn("data/highlights.json not found: run `npm run lexicon:hl`; examples are highlighted by exact spelling only");

// Sources are shown to learners as book title + page. The lexicon keeps the original file names for traceability;
// the published JSON carries only these titles (no file names, no scan-site tags, no PDF page numbers).
const BOOK_TITLES: [RegExp, string][] = [
  [/DELF/i, "Vocabulaire DELF B2 · 3000 mots"],
  [/avanc[ée]/i, "Vocabulaire progressif du français · Avancé (B2/C1.1)"],
  [/d[ée]butant/i, "Vocabulaire progressif du français · Débutant (A1)"],
  [/A2-B1/i, "Vocabulaire progressif du français · Intermédiaire (A2-B1)"],
];
const shortBook = (book: string) => BOOK_TITLES.find(([re]) => re.test(book))?.[1] ?? book.replace(/\s*\([^)]*\.(?:sk|com|org|net)[^)]*\)/gi, "").replace(/\.pdf$/i, "").trim();
const shortSources = (e: LexEntry) => {
  const seen = new Set<string>();
  return e.sources.flatMap(({ book, kind, chapter, printedPage }) => {
    const s = { book: shortBook(book), kind, ...(chapter ? { chapter } : {}), ...(printedPage ? { printedPage } : {}) };
    const key = JSON.stringify(s);
    return seen.has(key) ? [] : (seen.add(key), [s]);
  });
};

// Noun gender and indefinite article (data/nouns.json, scripts/build-nouns.py). Display + the un/une quiz.
type NounInfo = { g: "m" | "f" | "mf"; art: string; check: "lexique" | "unknown" | "conflict" | "proper" | "has-article" };
const NOUN_FILE = resolve(ROOT, "data/nouns.json");
const nouns: Record<string, NounInfo> = existsSync(NOUN_FILE) ? JSON.parse(readFileSync(NOUN_FILE, "utf8")).entries : {};
if (!existsSync(NOUN_FILE)) console.warn("data/nouns.json not found: run `npm run lexicon:nouns`; no articles or gender quiz");
/** Gender asked by the un/une quiz: single-gender nouns with a singular headword whose gender is not in dispute. */
/** Senses shown on the card: book rows without a Chinese gloss are left out (ton: the n.m. 音调 row has none, 你的 is shown). */
const shownSenses = (e: LexEntry) => (e.senses.some((s) => s.zh) ? e.senses.filter((s) => s.zh) : e.senses.slice(0, 1));
/** The card reads as a noun: its first shown meaning is one (ton 你的 is a determiner, so no article and no un/une quiz). */
const readsAsNoun = (e: LexEntry) => /^n\./.test(shownSenses(e)[0]?.pos ?? e.pos ?? "");
const quizGender = (e: LexEntry): "m" | "f" | "" => {
  const n = nouns[e.id];
  if (!n || e.forms || (n.g !== "m" && n.g !== "f") || !readsAsNoun(e)) return "";
  if (n.art !== "un" && n.art !== "une") return "";
  return n.check === "lexique" || n.check === "unknown" ? n.g : "";
};

// Irregular plurals, adjective feminine / plural and place (data/forms.json, scripts/build-forms.py, from Lexique 3.83).
type FormInfo = { pl?: string; fem?: string; mpl?: string; place?: string };
const FORMS_FILE = resolve(ROOT, "data/forms.json");
const formInfo: Record<string, FormInfo> = existsSync(FORMS_FILE) ? JSON.parse(readFileSync(FORMS_FILE, "utf8")).entries : {};
if (!existsSync(FORMS_FILE)) console.warn("data/forms.json not found: run `npm run lexicon:forms`; no irregular plurals or feminine forms");

const aliases = Object.fromEntries(lex.entries.filter((e) => e.aliasOf).map((e) => [e.id, e.aliasOf!]));
const visible = lex.entries.filter((e) => !e.aliasOf);
const position = new Map(visible.map((e, i) => [e.id, i] as const));
const ordered = [...visible].sort((a, b) => {
  // 1. Frequency, most frequent first. Entries without a frequency (acronyms, OCR noise, rare compounds) come after.
  const fa = freq[a.id]?.f;
  const fb = freq[b.id]?.f;
  if (fa !== undefined || fb !== undefined) {
    if (fa === undefined) return 1;
    if (fb === undefined) return -1;
    if (fa !== fb) return fb - fa;
  }
  // 2. Ties and entries without frequency keep the previous order: level, topic, lexicon position.
  const la = LEVEL_NAMES.indexOf(estimateOf(a));
  const lb = LEVEL_NAMES.indexOf(estimateOf(b));
  if (la !== lb) return la - lb;
  const ta = TOPICS.findIndex((t) => t.key === a.topic);
  const tb = TOPICS.findIndex((t) => t.key === b.topic);
  if (ta !== tb) return ta - tb;
  return (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0);
});

/** Glosses of the senses after the first, for quiz answer checking: [] when the word has one sense. Index row 9th element (8th is the gender, "" when none). */
const moreGlosses = (e: LexEntry): [string[]] | [] => {
  const g = e.senses.filter((s) => s.zh).slice(1).map((s) => s.zh);
  return g.length ? [g] : [];
};

/** Entry shape expected by src/atlas/types.ts. French text is carried in the `en` / `en` fields of the UI model. */
const toEntry = (e: LexEntry) => ({
  id: e.id,
  w: e.lemma,
  uk: ipaOf(e.id),
  us: ipaOf(e.id),
  // Empty-gloss senses (book rows without a Chinese gloss) are not shown as extra meanings.
  senses: shownSenses(e).map((s) => ({ pos: s.pos ?? e.pos, zh: s.zh || "释义待补充", en: s.fr, origin: s.origin, ...(s.status ? { status: s.status } : {}) })),
  ex: e.examples.map((x, i) => ({ en: x.fr, zh: x.zh, origin: x.origin, ...(hlMap[e.id]?.[i] ? { hl: hlMap[e.id][i]! } : {}) })),
  col: e.col,
  fam: e.fam,
  syn: e.syn,
  ant: e.ant,
  tip: e.tip,
  ...(e.register ? { register: e.register } : {}),
  cefr: estimateOf(e),
  levelStatus: "estimated",
  forms: e.forms,
  topic: e.topic,
  note: e.note,
  m: mediaOf(e.id),
  ...(nouns[e.id]?.art && readsAsNoun(e) ? { art: nouns[e.id].art } : {}),
  ...(quizGender(e) ? { g: quizGender(e) } : {}),
  ...(formInfo[e.id] ? { infl: formInfo[e.id] } : {}),
  review: e.review,
  sources: shortSources(e),
  levelBasis: levelBasisOf(e),
  origin: e.senses.every((s) => s.origin === "book") ? "book" : e.senses.some((s) => s.origin === "book") ? "mixed" : "supplement",
});

const out = resolve(ROOT, "public/atlas");
// only the files written here: public/atlas/conj.json comes from scripts/build-conjugations.ts
rmSync(resolve(out, "entries"), { recursive: true, force: true });
rmSync(resolve(out, "index.json"), { force: true });
mkdirSync(resolve(out, "entries"), { recursive: true });

const index = {
  id: "francais-b2-lexicon",
  name: "法语词图",
  count: ordered.length,
  aliases,
  pairs: visible.filter((e) => e.forms).map((e) => e.id),
  examples: ordered.reduce((n, e) => n + e.examples.length, 0),
  illustrated: 0,
  chunk: CHUNK,
  topics: TOPICS.map((t) => [t.key, t.zh]),
  cefr: LEVEL_NAMES,
  words: ordered.map((e) => [e.id, e.lemma, e.senses.find((s) => s.zh)?.zh || "释义待补充", ipaOf(e.id), LEVEL_NAMES.indexOf(estimateOf(e)), TOPICS.findIndex((t) => t.key === e.topic), mediaOf(e.id), quizGender(e), moreGlosses(e)[0] ?? [], [...new Set(e.senses.map((s) => s.pos ?? e.pos))]]),
};
writeFileSync(resolve(out, "index.json"), JSON.stringify(index));
for (let n = 0; n * CHUNK < ordered.length; n++) {
  writeFileSync(resolve(out, "entries", `${n}.json`), JSON.stringify(ordered.slice(n * CHUNK, (n + 1) * CHUNK).map(toEntry)));
}
const byLevel: Record<string, number> = {};
for (const e of ordered) { const k = `推定 ${estimateOf(e)}`; byLevel[k] = (byLevel[k] ?? 0) + 1; }
console.log(`atlas: ${ordered.length} words, ${index.examples} examples, chunks=${Math.ceil(ordered.length / CHUNK)}`, byLevel);
console.log("recordings:", Object.fromEntries(AUDIO_BITS.map(([dir], i) => [dir, recorded[i][1].size])));

// Confusable words (data/confusables.json): validated, each word linked to its atlas entry, emitted as public/atlas/confusables.json.
const CF_FILE = resolve(ROOT, "data/confusables.json");
if (existsSync(CF_FILE)) {
  const groups: CfGroup[] = JSON.parse(readFileSync(CF_FILE, "utf8")).groups;
  const cfProblems = checkGroups(groups);
  if (cfProblems.length) {
    console.error(cfProblems.join("\n"));
    process.exit(1);
  }
  const byLemma = new Map<string, string>();
  for (const e of ordered) if (!byLemma.has(e.lemma.toLowerCase())) byLemma.set(e.lemma.toLowerCase(), e.id);
  const byEntry: Record<string, string[]> = {};
  for (const g of groups)
    for (const it of g.items) {
      const id = byLemma.get((it.lemma ?? it.w).toLowerCase());
      if (!id) continue;
      it.id = id;
      (byEntry[id] ??= []).includes(g.id) || byEntry[id].push(g.id);
    }
  const data: CfData = { v: 1, groups, byEntry };
  writeFileSync(resolve(out, "confusables.json"), JSON.stringify(data));
  console.log(`confusables: ${groups.length} groups, ${groups.reduce((n, g) => n + g.items.length, 0)} words, ${Object.keys(byEntry).length} linked to entries`);
} else console.warn("data/confusables.json not found: run `python3 scripts/seed-confusables-r40.py`; no confusables page data");
