import { damerauLevenshtein, type ZhHit } from "../../lib/lexdb/search";
import { lexdbFold, type Conf, type LexEntry, type LexExample, type LexSuggestRow, type SourceId } from "../../lib/lexdb/types";
import { LEXDB_FIXTURES } from "../../ui/WordPopup";

export type DictTab = "zh" | "conj" | "phrases" | "examples" | "relations" | "fr" | "etym" | "notes";

export const DICT_DECK = "阅读生词";
export const SAMPLE_WORDS = ["prendre", "beau", "accueil", "être", "faire", "temps"];

export const POS_ZH: Record<string, string> = {
  "n.m.": "阳性名词",
  "n.f.": "阴性名词",
  "n.": "名词",
  "v.": "动词",
  "adj.": "形容词",
  "adv.": "副词",
  "prép.": "介词",
  "conj.": "连词",
  "pron.": "代词",
  "interj.": "感叹词",
  "loc.": "短语 / 表达",
};

export const SOURCE_LABEL: Record<SourceId, string> = {
  atlas: "词图",
  "wikt-fr": "法语维基",
  "wikt-zh": "中文维基",
  cfdict: "CFDICT",
  omw: "OMW",
  tatoeba: "Tatoeba",
  lexique: "Lexique",
  ai: "AI",
  "ai-reviewed": "AI 复核",
  user: "用户",
};

export const CONF_META: Record<Conf, { label: string; tone: string; hint: string }> = {
  3: { label: "高可信 · 3", tone: "conf-3", hint: "来自教材词图或 ≥3 个独立开放来源一致确认" },
  2: { label: "较可靠 · 2", tone: "conf-2", hint: "2 个独立开放来源语义一致" },
  1: { label: "参考 · 1", tone: "conf-1", hint: "单一开放来源或第二模型复核通过" },
  0: { label: "待核对 · 0", tone: "conf-0", hint: "尚未复核的 AI 生成译文或存在来源冲突" },
};

export const REPORT_KINDS = ["释义有误", "词性 / 阴阳性错误", "例句或高亮错误", "缺少常用义项", "其他问题"];

export interface CollectedExample extends LexExample {
  pos: string;
  senseZh: string;
}

export function collectExamples(entry: LexEntry): CollectedExample[] {
  const seen = new Set<string>();
  const out: CollectedExample[] = [];
  for (const blk of entry.pos) {
    for (const s of blk.senses) {
      for (const ex of s.ex ?? []) {
        const key = ex.fr.trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push({ ...ex, pos: blk.p, senseZh: s.zh });
      }
    }
  }
  return out;
}

export function entryMaxConf(entry: LexEntry): Conf {
  let max: Conf = 0;
  for (const blk of entry.pos) {
    for (const s of blk.senses) {
      if (s.conf > max) max = s.conf;
    }
  }
  if (max === 0 && entry.sources.includes("atlas")) return 3;
  return max;
}

export const FIXTURE_SUGGEST_ROWS: LexSuggestRow[] = (() => {
  const rows: LexSuggestRow[] = [];
  for (const e of LEXDB_FIXTURES) {
    const firstZh = e.pos[0]?.senses[0]?.zh ?? "";
    rows.push([e.id, e.w, e.rank ?? 99999, firstZh.slice(0, 24)]);
    for (const p of e.phrases ?? []) {
      rows.push([lexdbFold(p.fr), p.fr, (e.rank ?? 99999) + 10000, p.zh.slice(0, 24)]);
    }
  }
  return rows;
})();

export function fixtureSuggest(q: string, limit = 10): LexSuggestRow[] {
  const f = lexdbFold(q);
  if (!f) return [];
  const prefix = FIXTURE_SUGGEST_ROWS.filter((r) => r[0].startsWith(f));
  const sub = FIXTURE_SUGGEST_ROWS.filter((r) => !r[0].startsWith(f) && r[0].includes(f));
  return [...prefix, ...sub].slice(0, limit);
}

export function fixtureZhLookup(q: string, limit = 30): ZhHit[] {
  const term = q.trim();
  if (!term) return [];
  const hits: ZhHit[] = [];
  for (const e of LEXDB_FIXTURES) {
    const allZh = [
      ...e.pos.flatMap((p) => p.senses.map((s) => s.zh)),
      ...(e.phrases ?? []).map((p) => p.zh),
    ];
    if (allZh.some((z) => z.includes(term))) {
      hits.push({
        id: e.id,
        w: e.w,
        rank: e.rank ?? 99999,
        term,
        shortZh: e.pos[0]?.senses[0]?.zh,
      });
    }
  }
  return hits.sort((a, b) => a.rank - b.rank).slice(0, limit);
}

export function fixtureDidYouMean(q: string, limit = 5): LexSuggestRow[] {
  const f = lexdbFold(q);
  if (f.length < 2) return [];
  return FIXTURE_SUGGEST_ROWS.map((row) => ({ row, dist: damerauLevenshtein(f, row[0], 2) }))
    .filter((x) => x.dist > 0 && x.dist <= 2)
    .sort((a, b) => a.dist - b.dist || a.row[2] - b.row[2])
    .slice(0, limit)
    .map((x) => x.row);
}
