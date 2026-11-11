/**
 * Word lists (a photographed vocabulary list, a CSV, the rows of a table) and the one candidate list every
 * import goes through. Duplicates are decided here, by rules, never by the AI:
 *  - inside one import: the same headword (accents and case ignored) is one candidate; two spellings that differ
 *    only by accents stay apart (marche / marché), and so do the two genders of a noun (le livre / la livre);
 *  - against the atlas and the learner's words: a word spelled exactly the same (accents included) with a
 *    compatible gender is linked, not copied; one that differs only by accents or by gender is offered as
 *    "maybe the same word" (near) and the learner decides;
 *  - against the deck: words already in it cannot be added again (the UI shows 已在卡组).
 */
import type { Atlas, WordRef } from "../atlas/types";
import { senseGlosses } from "../store/decks";
import type { UserExample } from "../store/store";
import { foldAccents } from "./accent";
import type { DictHit } from "./dict";
import { headwordIndex, type Candidate } from "./extract";
import { nearWords } from "./near";

export interface ListInput {
  word: string;
  article?: string;
  gender?: string;
  pos?: string;
  translation?: string;
  /** zh, en, other or "". */
  translationLang?: string;
  note?: string;
  example?: string;
  exampleTranslation?: string;
  /** The recognition could not read this row clearly. */
  unsure?: boolean;
}

type G = "m" | "f" | "";

const ARTICLES: [RegExp, G][] = [
  [/^(le|un)\s+/i, "m"],
  [/^(la|une)\s+/i, "f"],
  [/^(l['’]|les\s+|des\s+|du\s+|de\s+la\s+|de\s+l['’])/i, ""],
];

export function articleGender(article: string): G {
  const a = article.trim().toLowerCase().replace("’", "'");
  if (a === "le" || a === "un") return "m";
  if (a === "la" || a === "une") return "f";
  return "";
}

export function genderOfPos(pos: string | undefined): G {
  const p = (pos ?? "").trim().toLowerCase();
  if (/^(n\.?\s*m\.?|m\.?)$/.test(p)) return "m";
  if (/^(n\.?\s*f\.?|f\.?)$/.test(p)) return "f";
  return "";
}

/** "la maison" → maison (f); "arbre (m.)" → arbre (m); "chat, n.m." → chat (m). */
export function cleanHeadword(raw: string): { word: string; article: string; gender: G } {
  let w = raw.normalize("NFC").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
  let article = "";
  let gender: G = "";
  for (const [re, g] of ARTICLES) {
    const m = w.match(re);
    // an article followed by a word ("l'homme"), not a word that is itself an article
    if (m && w.length > m[0].length) {
      article = m[0].trim();
      gender = g;
      w = w.slice(m[0].length).trim();
      break;
    }
  }
  const marker = w.match(/[\s,]*(?:\(|,\s*)?\b(n\.?\s*[mf]\.?|[mf]\.)\)?\s*$/i);
  if (marker && marker.index! > 0) {
    gender = gender || genderOfPos(marker[1]);
    w = w.slice(0, marker.index).trim();
  }
  return { word: w.replace(/[.;:,]+$/, "").trim(), article, gender };
}

const fold = (s: string) => foldAccents(s.replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim());
const bare = (w: WordRef) => w.word.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
const compatible = (a: G | undefined, b: G | undefined) => !a || !b || a === b;
const isChinese = (s: string) => /\p{Script=Han}/u.test(s);

/** Index of the sense whose gloss shares most with a translation (Chinese characters), or -1 when none does. */
export function bestSense(given: string, glosses: string[]): number {
  const chars = new Set([...given].filter((c) => /\p{Script=Han}/u.test(c)));
  if (!chars.size) return -1;
  let best = -1;
  let score = 0;
  glosses.forEach((g, i) => {
    const s = [...new Set(g)].filter((c) => chars.has(c)).length / Math.max(1, Math.min(chars.size, new Set(g).size));
    if (s > score) {
      score = s;
      best = i;
    }
  });
  return score >= 0.5 ? best : -1;
}

/** Key a candidate is merged under: the word's id, or its folded spelling and gender. */
export const mergeKey = (c: Pick<Candidate, "id" | "word" | "gender">) => (c.id ? `id:${c.id}` : `w:${fold(c.word)}${c.gender ? `|${c.gender}` : ""}`);

/** Turn word-list rows into candidates, matched against the atlas and the learner's words. */
export async function listCandidates(
  rows: ListInput[],
  atlas: Pick<Atlas, "words" | "custom">,
  cards: Record<string, unknown>,
  lookup: (word: string) => Promise<DictHit[]>,
): Promise<Candidate[]> {
  const index = headwordIndex(atlas);
  const out: Candidate[] = [];
  for (const row of rows) {
    const clean = cleanHeadword(row.word);
    if (!clean.word || clean.word.length > 80) continue;
    const word = clean.word;
    const gender: G = (row.gender === "m" || row.gender === "f" ? row.gender : "") || articleGender(row.article ?? "") || clean.gender || genderOfPos(row.pos);
    const translation = (row.translation ?? "").trim().slice(0, 300);
    const zhGiven = translation && (row.translationLang === "zh" || (!row.translationLang && isChinese(translation))) ? translation : "";
    const ex: UserExample[] = row.example?.trim() ? [{ fr: row.example.trim().slice(0, 400), zh: (row.exampleTranslation ?? "").trim().slice(0, 400) }] : [];
    const base = { count: 1, forms: [word], sentence: "", src: "list" as const, given: translation || undefined, note: row.note?.trim() || undefined, ex: ex.length ? ex : undefined, ...(row.unsure ? { unsure: true } : {}) };

    const refs = index.get(fold(word)) ?? [];
    const exact = refs.filter((r) => bare(r).toLowerCase() === word.toLowerCase());
    const linked = exact.find((r) => compatible(r.g, gender));
    if (linked) {
      const glosses = senseGlosses(linked);
      const sense = zhGiven ? bestSense(zhGiven, glosses) : -1;
      // the list's meaning fits a word spelled with other accents better (marche = 市场 → marché): a lost accent
      const alt = zhGiven && sense < 0 ? refs.find((r) => r !== linked && bestSense(zhGiven, senseGlosses(r)) >= 0) : undefined;
      out.push({
        ...base,
        key: "",
        kind: cards[linked.id] ? "learning" : "atlas",
        id: linked.id,
        word: linked.word,
        zh: linked.zh,
        gender: linked.g ?? gender,
        ...(sense > 0 ? { sense } : {}),
        ...(zhGiven && sense < 0 ? { deckNote: zhGiven } : {}),
        ...(alt ? { near: { id: alt.id, word: alt.word, zh: alt.zh, why: "词表上的释义更像这个词（可能漏了重音）" } } : {}),
      });
      continue;
    }
    const other = exact[0] ?? refs[0];
    const near = other ? { id: other.id, word: other.word, zh: other.zh, why: exact.length ? "阴阳性不同" : "拼写或重音不同" } : undefined;

    // the offline dictionary, for the spelling as written only: a list gives dictionary forms
    const hits = await lookup(word).catch(() => [] as DictHit[]);
    const hit = hits.find((h) => !h.form && h.w.toLowerCase() === word.toLowerCase() && compatible(genderOfPos(h.p), gender));
    const dictZh = hit?.zh?.length ? [...new Set(hit.zh.map((g) => g[0]))].slice(0, 3).join("；") : "";
    const dictEx: UserExample[] = (hit?.ex ?? []).slice(0, 1).map(([fr, z, a, b]) => ({ fr, zh: z, src: "tatoeba", hl: [a, b] }));
    out.push({
      ...base,
      key: "",
      kind: zhGiven ? "new" : dictZh ? "dict" : "unknown",
      word,
      zh: zhGiven || dictZh,
      pos: row.pos || hit?.p || (gender ? `n.${gender}.` : ""),
      ipa: hit?.ipa,
      gender: gender || genderOfPos(hit?.p),
      ex: [...ex, ...dictEx].slice(0, 3),
      hit,
      near,
    });
  }
  return mergeCandidates([out]);
}

/**
 * Merge candidate lists (the text of a page and its vocabulary box, several photos, a file and a paste) into
 * one: the same word is one row with the counts added up; the first source sentence, a list's printed meaning
 * and examples are kept. A word without a gender joins the row of the same spelling that has one.
 */
export function mergeCandidates(lists: Candidate[][]): Candidate[] {
  const rows: Candidate[] = [];
  const byKey = new Map<string, Candidate>();
  const byFold = new Map<string, Candidate[]>();
  for (const list of lists)
    for (const c0 of list) {
      const c: Candidate = { ...c0, gender: c0.gender ?? genderOfPos(c0.pos ?? c0.hit?.p) };
      const k = mergeKey(c);
      let into = byKey.get(k);
      if (!into && !c.id) into = (byFold.get(fold(c.word)) ?? []).find((x) => !x.id && compatible(x.gender, c.gender));
      if (!into) {
        const row = { ...c, key: k, forms: [...c.forms], ex: c.ex ? [...c.ex] : undefined };
        rows.push(row);
        byKey.set(k, row);
        if (!c.id) byFold.set(fold(c.word), [...(byFold.get(fold(c.word)) ?? []), row]);
        continue;
      }
      into.count += c.count;
      for (const f of c.forms) if (!into.forms.includes(f)) into.forms.push(f);
      if (!into.sentence && c.sentence) {
        into.sentence = c.sentence;
        into.span = c.span;
      }
      // a printed meaning beats a dictionary guess
      if (c.src === "list" && c.zh && (into.kind === "dict" || into.kind === "unknown")) {
        into.zh = c.zh;
        into.kind = "new";
      } else if (!into.zh && c.zh) into.zh = c.zh;
      into.gender ||= c.gender;
      into.pos ||= c.pos;
      into.ipa ||= c.ipa;
      into.given ||= c.given;
      into.note ||= c.note;
      into.near ||= c.near;
      into.hit ||= c.hit;
      if (into.sense === undefined && c.sense !== undefined) into.sense = c.sense;
      into.deckNote ||= c.deckNote;
      into.unsure ||= c.unsure;
      if (c.ex?.length) {
        const have = new Set((into.ex ?? []).map((x) => x.fr));
        into.ex = [...(into.ex ?? []), ...c.ex.filter((x) => !have.has(x.fr))].slice(0, 3);
      }
    }
  return rows;
}

/**
 * A CSV / TSV / two-column text that is a word list: most lines have a short first cell (the French word)
 * and a second cell (its meaning). Returns null for running text.
 */
export function parseListText(text: string): ListInput[] | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const sep = [/\t/, /;/, /,/, /\s+[-–—=:]\s+/].find((re) => lines.filter((l) => re.test(l)).length >= lines.length * 0.7);
  if (!sep) return null;
  const cells = lines.map((l) => splitCells(l, sep));
  const words = (x: string) => x.split(/\s+/).filter(Boolean).length;
  // a comma also separates clauses of prose: there a row needs a Chinese meaning, or two short cells and no full stop
  const loose = sep.source === ",";
  const listy = cells.filter(
    (c) =>
      c.length >= 2 &&
      c[0].length > 0 &&
      c[0].length <= 50 &&
      words(c[0]) <= 6 &&
      (!loose || isChinese(c[1]) || (words(c[0]) <= 3 && words(c[1]) <= 6 && !/[.!?…]$/.test(c[c.length - 1]))),
  );
  if (listy.length < lines.length * 0.7) return null;
  // a header row (mot, français, word …) is skipped
  const head = /^(mot|mots|français|francais|word|法语|单词|词)$/i;
  return listy
    .filter((c, i) => !(i === 0 && head.test(c[0])))
    .map(([word, translation, example = "", exampleTranslation = ""]) => ({ word, translation, example, exampleTranslation }));
}

function splitCells(line: string, sep: RegExp): string[] {
  if (sep.source !== "," && sep.source !== ";") return line.split(sep).map((c) => c.trim());
  // quoted CSV cells
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (!q && ch === sep.source) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/**
 * Spelling check of the words nothing confirms (not in the atlas, the learner's words or the dictionary):
 * they are marked unverified and get the real words spelled closest to them, those whose meaning fits the
 * list's translation first. `words` are the atlas and own words to search.
 */
export async function checkSpellings(list: Candidate[], words: WordRef[]): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (const c of list) {
    if (c.id || c.hit || c.kind === "dict" || c.kind === "learning" || c.kind === "atlas") {
      out.push(c);
      continue;
    }
    const meaning = c.given && isChinese(c.given) ? c.given : isChinese(c.zh) ? c.zh : "";
    // the accent-only match (near) already names the likely word
    const found = c.near ? [] : await nearWords(c.word, words, 5);
    const fit = (zh: string) => (meaning && bestSense(meaning, zh.split("；")) >= 0 ? 0 : 1);
    const suggest = found.sort((a, b) => fit(a.zh) - fit(b.zh) || a.dist - b.dist).slice(0, 3);
    out.push({ ...c, unverified: true, ...(suggest.length ? { suggest } : {}) });
  }
  return out;
}
