import { LEVELS, POS, type Example, type Level, type LexEntry, type Lexicon, type Origin, type Pos, type Source, type ImportRow } from "./types.ts";

/** Topic keys match the brand artwork in public/brand/topic-<key>.webp, so the original art is reused. */
export const TOPICS: { key: string; zh: string; fr: string }[] = [
  { key: "work", zh: "工作与职场", fr: "Travail et carrière" },
  { key: "economy", zh: "经济与消费", fr: "Économie et consommation" },
  { key: "education", zh: "教育与学习", fr: "Éducation et savoir" },
  { key: "health", zh: "健康与医疗", fr: "Santé et corps" },
  { key: "environment", zh: "环境与气候", fr: "Environnement" },
  { key: "society", zh: "社会与公民", fr: "Société et vie civique" },
  { key: "media", zh: "媒体与信息", fr: "Médias et information" },
  { key: "travel", zh: "旅行与出行", fr: "Voyage et tourisme" },
  { key: "emotion", zh: "情绪与心理", fr: "Émotions et caractère" },
  { key: "daily", zh: "日常基础", fr: "Vie quotidienne" },
  // split out of "society" by source chapter (scripts/split-society-topic.py); appended so earlier indices stay put
  { key: "people", zh: "家庭与人际", fr: "Famille et relations" },
  { key: "city", zh: "居住与城市", fr: "Logement et ville" },
  { key: "history", zh: "地理与历史", fr: "Géographie et histoire" },
  { key: "government", zh: "政治与法律", fr: "Politique et justice" },
  { key: "thinking", zh: "观点与表达", fr: "Opinions et argumentation" },
  { key: "arts", zh: "艺术与休闲", fr: "Arts et loisirs" },
];

const TOPIC_KEYS = new Set(TOPICS.map((t) => t.key));
const POS_SET = new Set<string>(POS);
const LEVEL_SET = new Set<string>(LEVELS);

/** Lowercase, strip accents, unify apostrophes: the identity used for matching, never for display. */
export function fold(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[’`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** URL-safe id from a headword: "écouter" → "ecouter", "avoir lieu" → "avoir-lieu". */
export function slug(s: string) {
  return fold(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Identity of a lexicon entry: same lemma with its accents, same part of speech (gender included).
 * Accents are NOT folded here: tâche (task) and tache (stain) are different words; colère and colere
 * must be reviewed by a person, not merged automatically. Case and apostrophe variants are the same word.
 */
export const entryKey = (lemma: string, pos: string) =>
  `${lemma.normalize("NFC").replace(/[’`´]/g, "'").replace(/\s+/g, " ").trim().toLowerCase()}|${pos}`;

/** Parse RFC 4180 CSV (quoted fields, doubled quotes, CRLF). Returns rows as objects keyed by header. */
export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  while (i < src.length) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i += 2;
        continue;
      }
      if (c === '"') quoted = false;
      else field += c;
      i++;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
    i++;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((x) => x.trim() !== ""));
  if (!header) return [];
  const cols = header.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(cols.map((c, j) => [c, (r[j] ?? "").trim()])));
}

const list = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string") return v.split("|").map((x) => x.trim()).filter(Boolean);
  return [];
};

export interface RowIssue {
  line: number;
  lemma: string;
  severity: "error" | "warning";
  message: string;
}

/** Validate and normalise one import row. Returns null (and an error) when required fields are missing or invalid. */
export function normaliseRow(raw: ImportRow, line: number, issues: RowIssue[]): { lemma: string; pos: Pos; level: Level; topic: string; zh: string; zhOrigin: Origin; zhStatus: string; fr: string; ex: Example | null; col: string[]; fam: string[]; syn: string[]; ant: string[]; tip: string; note: string; origin: Origin; source: Source; levelBasis: string; review: "unreviewed" | "checked"; id?: string } | null {
  const err = (message: string) => {
    issues.push({ line, lemma: String(raw.lemma ?? ""), severity: "error", message });
    return null;
  };
  const lemma = String(raw.lemma ?? "").trim();
  if (!lemma) return err("缺少 lemma（词形）");
  if (!/[\p{L}]/u.test(lemma)) return err(`词形不合法：${lemma}`);
  const pos = String(raw.pos ?? "").trim() as Pos;
  if (!POS_SET.has(pos)) return err(`词性 "${raw.pos}" 不在允许列表内（${[...POS_SET].join(" ")}）`);
  const level = (String(raw.level ?? "").trim() || "unverified") as Level;
  if (!LEVEL_SET.has(level)) return err(`等级 "${raw.level}" 不合法（A1–C2 或 unverified）`);
  const topic = String(raw.topic ?? "").trim();
  if (!TOPIC_KEYS.has(topic)) return err(`主题 "${topic}" 不在主题表中`);
  let zh = String(raw.zh ?? "").trim();
  const origin = String(raw.origin ?? "").trim() as Origin;
  if (origin !== "book" && origin !== "supplement") return err(`origin 只能是 book 或 supplement，实际为 "${raw.origin}"`);
  // Book text carries no Chinese gloss for many headwords: the entry is kept with an empty gloss,
  // shown as "释义待补充". Supplements must always carry their own gloss.
  if (!zh && origin === "supplement") return err("补充内容必须填写 zh（中文释义）");
  if (!zh) issues.push({ line, lemma, severity: "warning", message: "书中无中文释义，释义待补充" });
  const book = String(raw.book ?? "").trim();
  if (!book) return err("缺少 book（来源文件，补充内容填 author-supplement）");
  if (origin === "book" && book === "author-supplement") return err("origin=book 时必须填写真实来源文件");
  if (origin === "supplement" && book !== "author-supplement") return err("origin=supplement 时 book 必须为 author-supplement");
  const kindRaw = String(raw.kind ?? (origin === "book" ? "index" : "author-supplement")).trim() as Source["kind"];
  const printedPage = raw.printed_page === undefined || raw.printed_page === "" ? undefined : Number(raw.printed_page);
  const pdfPage = raw.pdf_page === undefined || raw.pdf_page === "" ? undefined : Number(raw.pdf_page);
  if (origin === "book" && printedPage === undefined && pdfPage === undefined) issues.push({ line, lemma, severity: "warning", message: "来自书籍但没有页码，建议补充 printed_page 或 pdf_page" });
  const source: Source = { book, kind: kindRaw, chapter: raw.chapter || undefined, printedPage, pdfPage };
  const fr = String(raw.fr_def ?? "").trim();
  if (!fr && origin === "book") issues.push({ line, lemma, severity: "warning", message: "书中未提供法语释义，fr_def 为空" });
  const exFr = String(raw.example_fr ?? "").trim();
  const exZh = String(raw.example_zh ?? "").trim();
  const ex: Example | null = exFr ? { fr: exFr, zh: exZh, origin: exZh && origin === "supplement" ? "supplement" : origin } : null;
  if (ex && !exZh) issues.push({ line, lemma, severity: "warning", message: "例句缺少中文译文" });
  if (pos.startsWith("v.") && /\s/.test(lemma) === false && !/(er|ir|re|oir)$/i.test(lemma)) {
    issues.push({ line, lemma, severity: "warning", message: "动词 lemma 应为不定式（如 -er/-ir/-re/-oir）" });
  }
  const note = String(raw.note ?? "").trim();
  const levelBasis = String(raw.level_basis ?? "").trim() || (level === "unverified" ? "未核实：逐词等级未确认" : "");
  return {
    lemma,
    pos,
    level,
    topic,
    zh,
    zhOrigin: (String(raw.zh_origin ?? "").trim() as Origin) || origin,
    zhStatus: String(raw.zh_status ?? "").trim(),
    fr,
    ex,
    col: list(raw.col),
    fam: list(raw.fam),
    syn: list(raw.syn),
    ant: list(raw.ant),
    tip: String(raw.tip ?? "").trim(),
    note,
    origin,
    source,
    levelBasis,
    review: raw.review === "checked" ? "checked" : "unreviewed",
    id: raw.id ? String(raw.id).trim() : undefined,
  };
}

export interface UpsertReport {
  added: number;
  updated: number;
  duplicatesSkipped: number;
  conflicts: { line: number; lemma: string; message: string }[];
  issues: RowIssue[];
  newIds: string[];
}

/** Stable, unique id for a new entry. Existing ids are never changed. */
function allocId(lex: Lexicon, base: string, pos: Pos) {
  const taken = new Set(lex.entries.map((e) => e.id));
  let id = base;
  if (taken.has(id)) id = `${base}-${pos.startsWith("n.f") ? "f" : pos.startsWith("n.m") ? "m" : slug(pos)}`;
  let n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  return id;
}

/**
 * Merge rows into the lexicon. Idempotent: re-importing the same rows adds nothing.
 * - same folded lemma + pos → same entry; a new gloss adds a sense, an identical one is skipped
 * - same lemma, different level or topic → conflict, the existing value is kept and reported
 * - examples and sources are de-duplicated by text / (book, page)
 */
export function upsertRows(lex: Lexicon, rawRows: ImportRow[], options: { startLine?: number } = {}): UpsertReport {
  const report: UpsertReport = { added: 0, updated: 0, duplicatesSkipped: 0, conflicts: [], issues: [], newIds: [] };
  const byKey = new Map(lex.entries.filter((e) => !e.aliasOf).map((e) => [entryKey(e.lemma, e.pos), e] as const));
  // Same folded form and part of speech but different accents: kept separate, reported for review.
  const byFold = new Map<string, LexEntry[]>();
  for (const e of lex.entries) byFold.set(`${fold(e.lemma)}|${e.pos}`, [...(byFold.get(`${fold(e.lemma)}|${e.pos}`) ?? []), e]);
  const startLine = options.startLine ?? 2;
  rawRows.forEach((raw, i) => {
    const line = startLine + i;
    const r = normaliseRow(raw, line, report.issues);
    if (!r) return;
    const key = entryKey(r.lemma, r.pos);
    const existing = byKey.get(key);
    const src: Source = r.source;
    if (!existing) {
      const near = (byFold.get(`${fold(r.lemma)}|${r.pos}`) ?? []).filter((e) => e.lemma !== r.lemma);
      if (near.length) report.issues.push({ line, lemma: r.lemma, severity: "warning", message: `与已有词 ${near.map((e) => e.lemma).join("、")} 仅重音不同：已作为新词条保留，待核实是否为同一词或 OCR 错误` });
      const base = r.id ?? slug(r.lemma);
      const id = r.id && lex.entries.some((e) => e.id === r.id) ? null : allocId(lex, base, r.pos);
      if (id === null) {
        report.issues.push({ line, lemma: r.lemma, severity: "error", message: `id "${r.id}" 已被占用` });
        return;
      }
      const entry: LexEntry = {
        id,
        lemma: r.lemma,
        pos: r.pos,
        level: r.level,
        levelBasis: r.levelBasis,
        topic: r.topic,
        senses: [{ zh: r.zh, fr: r.fr, origin: r.zhOrigin, ...(r.zhStatus ? { status: r.zhStatus } : {}) }],
        examples: r.ex ? [r.ex] : [],
        col: r.col,
        fam: r.fam,
        syn: r.syn,
        ant: r.ant,
        tip: r.tip,
        note: r.note || undefined,
        sources: [src],
        review: r.review,
      };
      lex.entries.push(entry);
      byKey.set(key, entry);
      report.added++;
      report.newIds.push(id);
      return;
    }
    // existing entry: check conflicts on scalar fields
    let changed = false;
    if (existing.level !== r.level) {
      report.conflicts.push({ line, lemma: r.lemma, message: `等级冲突：已有 ${existing.level}，新数据 ${r.level}（保留已有值）` });
    }
    if (existing.topic !== r.topic) {
      report.conflicts.push({ line, lemma: r.lemma, message: `主题冲突：已有 ${existing.topic}，新数据 ${r.topic}（保留已有值）` });
    }
    if (r.lemma !== existing.lemma) {
      report.conflicts.push({ line, lemma: r.lemma, message: `拼写/重音不一致：已有 "${existing.lemma}"，新数据 "${r.lemma}"（保留已有写法）` });
    }
    const senseIdx = existing.senses.findIndex((s) => fold(s.zh) === fold(r.zh));
    if (senseIdx === -1) {
      existing.senses.push({ zh: r.zh, fr: r.fr, origin: r.zhOrigin, ...(r.zhStatus ? { status: r.zhStatus } : {}) });
      changed = true;
    } else if (r.zhStatus && !existing.senses[senseIdx].status) {
      // same gloss already present (e.g. from an earlier supplement): record the verification state of this row
      existing.senses[senseIdx].status = r.zhStatus;
      changed = true;
    } else if (r.fr && !existing.senses[senseIdx].fr) {
      existing.senses[senseIdx].fr = r.fr;
      changed = true;
    }
    if (r.ex && !existing.examples.some((e) => fold(e.fr) === fold(r.ex!.fr))) {
      existing.examples.push(r.ex);
      changed = true;
    }
    for (const field of ["col", "fam", "syn", "ant"] as const) {
      for (const v of r[field]) {
        if (!existing[field].includes(v)) {
          existing[field].push(v);
          changed = true;
        }
      }
    }
    if (!existing.tip && r.tip) {
      existing.tip = r.tip;
      changed = true;
    }
    if (!existing.sources.some((s) => s.book === src.book && s.printedPage === src.printedPage && s.pdfPage === src.pdfPage && s.kind === src.kind)) {
      existing.sources.push(src);
      changed = true;
    }
    if (changed) report.updated++;
    else report.duplicatesSkipped++;
  });
  return report;
}

/** Lexicon integrity checks, used by tests and by the check script. */
export function checkLexicon(lex: Lexicon): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const keys = new Set<string>();
  const idSet = new Set(lex.entries.map((x) => x.id));
  for (const e of lex.entries) {
    if (ids.has(e.id)) problems.push(`重复 id：${e.id}`);
    ids.add(e.id);
    if (e.aliasOf) {
      if (!idSet.has(e.aliasOf) || lex.entries.find((x) => x.id === e.aliasOf)?.aliasOf) problems.push(`别名 ${e.id} 必须指向一个非别名的存在条目（当前 ${e.aliasOf}）`);
      continue;
    }
    const k = entryKey(e.lemma, e.pos);
    if (keys.has(k)) problems.push(`重复词条（同词形同词性）：${e.lemma} ${e.pos}`);
    keys.add(k);
    if (!/^[a-z0-9-]+$/.test(e.id)) problems.push(`id 非 ASCII slug：${e.id}`);
    if (!LEVEL_SET.has(e.level)) problems.push(`${e.id} 等级非法：${e.level}`);
    if (!TOPIC_KEYS.has(e.topic)) problems.push(`${e.id} 主题非法：${e.topic}`);
    if (!e.senses.length) problems.push(`${e.id} 没有释义`);
    if (!e.sources.length) problems.push(`${e.id} 缺少来源`);
    for (const s of e.senses) if (!s.zh && s.origin === "supplement") problems.push(`${e.id} 补充释义为空`);
  }
  return problems;
}

export const emptyLexicon = (): Lexicon => ({ version: 1, entries: [] });
