/**
 * The stored shapes of 听力/阅读 mistakes (错因) and 真实材料 sources, with their validators. Kept apart from
 * listening.ts (dictation, voices, players) so the store's sanitizer and the home page stay light.
 */
import { QSKILL_LABEL, type CompKind, type QSkill } from "./exam-schema";

/** Why a question went wrong, as the learner sees it. */
export type MissCause = "paraphrase" | "negation" | "gist" | "inference" | "vocab" | "heard" | "time" | "careless";
export const MISS_CAUSES: MissCause[] = ["paraphrase", "negation", "gist", "inference", "vocab", "heard", "time", "careless"];
export const CAUSE_LABEL: Record<MissCause, string> = {
  paraphrase: "没认出同义改写",
  negation: "否定 / 限定陷阱",
  gist: "细节和主旨混淆",
  inference: "观点、推断判断错",
  vocab: "有生词",
  heard: "没听清 / 没找到出处",
  time: "时间不够",
  careless: "粗心",
};

export interface CompMiss {
  at: number;
  part: CompKind;
  skill?: QSkill;
  cause: MissCause;
  /** Which question of the paper ("exercise-question"). */
  q?: string;
  /** Self-contained snapshot for interactive real-question re-attempt in MistakeReflow. */
  qType?: "qcm" | "vf" | "short";
  stem?: string;
  options?: string[];
  answer?: number;
  quote?: string;
  accepted?: string[];
  why?: string;
  excerpt?: string;
  title?: string;
}

export const MAX_MISSES = 400;

export function sanitizeMisses(v: unknown): CompMiss[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const trimStr = (s: unknown, max: number) => (typeof s === "string" ? s.trim().slice(0, max) : "");
  const out: CompMiss[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const e = x as Record<string, unknown>;
    if ((e.part !== "listen" && e.part !== "read") || typeof e.at !== "number" || !MISS_CAUSES.includes(e.cause as MissCause)) continue;
    const skill = typeof e.skill === "string" && e.skill in QSKILL_LABEL ? (e.skill as QSkill) : undefined;
    const q = typeof e.q === "string" && /^(\d+-\d+|micro:[a-z0-9-]+:[a-z0-9-]+|real:[a-z0-9-]+:\d+)$/i.test(e.q) ? e.q : undefined;
    const qType = e.qType === "qcm" || e.qType === "vf" || e.qType === "short" ? e.qType : undefined;
    const stem = trimStr(e.stem, 240);
    const options = Array.isArray(e.options)
      ? e.options.map((o) => trimStr(o, 220)).filter(Boolean).slice(0, 3)
      : undefined;
    const validOpts = options && options.length >= 2 ? options : undefined;
    const answer = typeof e.answer === "number" && Number.isInteger(e.answer) && e.answer >= 0 && e.answer <= 2 ? e.answer : undefined;
    const quote = trimStr(e.quote, 240);
    const accepted = Array.isArray(e.accepted)
      ? e.accepted.map((a) => trimStr(a, 160)).filter(Boolean).slice(0, 6)
      : undefined;
    const why = trimStr(e.why, 360);
    const excerpt = trimStr(e.excerpt, 520);
    const title = trimStr(e.title, 100);
    out.push({
      at: e.at,
      part: e.part,
      cause: e.cause as MissCause,
      ...(skill ? { skill } : {}),
      ...(q ? { q } : {}),
      ...(qType ? { qType } : {}),
      ...(stem ? { stem } : {}),
      ...(validOpts ? { options: validOpts } : {}),
      ...(answer !== undefined ? { answer } : {}),
      ...(quote ? { quote } : {}),
      ...(accepted?.length ? { accepted } : {}),
      ...(why ? { why } : {}),
      ...(excerpt ? { excerpt } : {}),
      ...(title ? { title } : {}),
    });
  }
  return out.length ? out.slice(0, MAX_MISSES) : undefined;
}

/** How often each cause came up, most frequent first (only causes that came up). */
export function missStats(misses: CompMiss[], part?: CompMiss["part"]): { cause: MissCause; n: number; share: number }[] {
  const list = part ? misses.filter((m) => m.part === part) : misses;
  const count = new Map<MissCause, number>();
  for (const m of list) count.set(m.cause, (count.get(m.cause) ?? 0) + 1);
  return [...count.entries()].map(([cause, n]) => ({ cause, n, share: Math.round((n / list.length) * 100) })).sort((a, b) => b.n - a.n || MISS_CAUSES.indexOf(a.cause) - MISS_CAUSES.indexOf(b.cause));
}

export interface RealSource {
  id: string;
  title: string;
  /** Either an HTTP(S) URL, a bundled `materials/...` path, or an `idb:<key>` stored in IndexedDB. */
  url: string;
  /** Optional companion PDF / official sheet / transcript path (`https://...`, `materials/...`, or `idb:...`). */
  pdfUrl?: string;
  /** Optional preset key linking offline exam questions (`PREBUILT_REAL_QUIZZES`). */
  presetId?: string;
  /** The part to work on, in seconds from the start of the recording. */
  start: number;
  end: number;
  created: number;
  /** The learner's own copy of the transcript (from the site), kept on this device for dictation. */
  transcript?: string;
  /** What the learner understood on the blind listening. */
  notes?: string;
  /** When the four steps were last gone through. */
  done?: number;
}

export const MAX_SOURCES = 40;
export const MAX_TRANSCRIPT = 12000;
export const SOURCE_ID = /^(?:s|rfi)-[a-z0-9-]{4,32}$/;
export const VALID_SOURCE_URL = /^(?:https?:\/\/|materials\/|idb:)/i;

export function sanitizeSources(v: unknown): RealSource[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: RealSource[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    if (typeof r.id !== "string" || !SOURCE_ID.test(r.id) || typeof r.url !== "string" || !VALID_SOURCE_URL.test(r.url) || typeof r.created !== "number") continue;
    const sec = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.round(n) : 0);
    const start = sec(r.start);
    const end = Math.max(start, sec(r.end));
    const text = (k: string, max: number) => (typeof r[k] === "string" && (r[k] as string).trim() ? (r[k] as string).slice(0, max) : undefined);
    const transcript = text("transcript", MAX_TRANSCRIPT);
    const notes = text("notes", 2000);
    const rawPdf = text("pdfUrl", 600);
    const pdfUrl = rawPdf && VALID_SOURCE_URL.test(rawPdf) ? rawPdf : undefined;
    const presetId = text("presetId", 48);
    out.push({
      id: r.id,
      title: (text("title", 120) ?? "").trim() || r.url.slice(0, 120),
      url: r.url.slice(0, 600),
      ...(pdfUrl ? { pdfUrl } : {}),
      ...(presetId ? { presetId } : {}),
      start,
      end,
      created: r.created,
      ...(transcript ? { transcript } : {}),
      ...(notes ? { notes } : {}),
      ...(typeof r.done === "number" ? { done: r.done } : {}),
    });
    if (out.length >= MAX_SOURCES) break;
  }
  return out.length ? out : undefined;
}
