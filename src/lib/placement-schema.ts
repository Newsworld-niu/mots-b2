export type PlacementSection = "vocab" | "grammar" | "read" | "listen";

export interface PlacementProduction {
  words: number;
  band: "A2" | "B1" | "B2";
  score: number;
  connectors: number;
  notes: string[];
}

export interface PlacementResult {
  at: number;
  /** Recommended CEFR index (0 = A1, 1 = A2, 2 = B1, 3 = B2). */
  level: number;
  /** Weighted overall score 0..100. */
  score: number;
  sections: {
    vocab: number;
    grammar: number;
    read: number;
    /** Null when listening was skipped due to device/environment constraints. */
    listen: number | null;
  };
  /** Sections below target readiness, weakest first. */
  weak: PlacementSection[];
  /** Optional 3-minute micro-writing production diagnostic (non-blocking). */
  production?: PlacementProduction;
}

const VALID_SECTIONS = new Set<PlacementSection>(["vocab", "grammar", "read", "listen"]);

function sanitizeProduction(v: unknown): PlacementProduction | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const p = v as Record<string, unknown>;
  const num = (x: unknown, lo: number, hi: number) => typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi;
  if (!num(p.words, 0, 500) || !num(p.score, 0, 100) || !num(p.connectors, 0, 50)) return undefined;
  if (p.band !== "A2" && p.band !== "B1" && p.band !== "B2") return undefined;
  const notes = Array.isArray(p.notes) ? p.notes.filter((n): n is string => typeof n === "string" && n.trim().length > 0).map((n) => n.slice(0, 140)).slice(0, 4) : [];
  return {
    words: Math.round(p.words as number),
    band: p.band,
    score: Math.round(p.score as number),
    connectors: Math.round(p.connectors as number),
    notes,
  };
}

export function sanitizePlacement(v: unknown): PlacementResult | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const r = v as Record<string, unknown>;
  const num = (x: unknown, lo: number, hi: number) => typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi;
  if (!num(r.at, 0, Infinity) || !num(r.level, 0, 3) || !num(r.score, 0, 100)) return undefined;
  const s = r.sections;
  if (!s || typeof s !== "object" || Array.isArray(s)) return undefined;
  const sec = s as Record<string, unknown>;
  if (!num(sec.vocab, 0, 100) || !num(sec.grammar, 0, 100) || !num(sec.read, 0, 100)) return undefined;
  if (sec.listen !== null && !num(sec.listen, 0, 100)) return undefined;
  const weak = Array.isArray(r.weak) ? [...new Set(r.weak.filter((x): x is PlacementSection => typeof x === "string" && VALID_SECTIONS.has(x as PlacementSection)))] : [];
  const production = sanitizeProduction(r.production);
  return {
    at: r.at as number,
    level: Math.round(r.level as number),
    score: Math.round(r.score as number),
    sections: {
      vocab: Math.round(sec.vocab as number),
      grammar: Math.round(sec.grammar as number),
      read: Math.round(sec.read as number),
      listen: sec.listen === null ? null : Math.round(sec.listen as number),
    },
    weak,
    ...(production ? { production } : {}),
  };
}
