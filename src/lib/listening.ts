/**
 * 听力理解 closer to the exam: voices with other French accents, the 精听 steps after a paper (dictation
 * sentence by sentence or paragraph by paragraph, then shadowing), and why the learner got a question wrong
 * (错因), counted so the weakest kind of question shows.
 */
import { foldAccents } from "./accent";
import { clean } from "./typing";
import { QSKILL_LABEL, type CompExercise, type ExamPart, type QSkill } from "./exam";

/* ---------- accents ---------- */

export type AccentId = "fr-FR" | "fr-CA" | "fr-BE" | "fr-CH";
export interface AccentVoices {
  id: AccentId;
  zh: string;
  /** Azure neural voices: female, male. */
  f: string[];
  m: string[];
}

/** Azure neural voices by accent (adults only). */
export const ACCENTS: AccentVoices[] = [
  { id: "fr-FR", zh: "法国", f: ["fr-FR-DeniseNeural", "fr-FR-BrigitteNeural", "fr-FR-CelesteNeural", "fr-FR-CoralieNeural", "fr-FR-JosephineNeural", "fr-FR-YvetteNeural"], m: ["fr-FR-HenriNeural", "fr-FR-AlainNeural", "fr-FR-ClaudeNeural", "fr-FR-JeromeNeural", "fr-FR-MauriceNeural", "fr-FR-YvesNeural"] },
  { id: "fr-CA", zh: "加拿大（魁北克）", f: ["fr-CA-SylvieNeural"], m: ["fr-CA-JeanNeural", "fr-CA-AntoineNeural", "fr-CA-ThierryNeural"] },
  { id: "fr-BE", zh: "比利时", f: ["fr-BE-CharlineNeural"], m: ["fr-BE-GerardNeural"] },
  { id: "fr-CH", zh: "瑞士", f: ["fr-CH-ArianeNeural"], m: ["fr-CH-FabriceNeural"] },
];

export const accentOf = (voice: string) => ACCENTS.find((a) => voice.startsWith(a.id));

/** "fixed": the voices set in 我的 → AI 接口; "france": varied voices of France; "mixed": any accent. */
export type VoiceMode = "fixed" | "france" | "mixed";

/** The two voices of one document: [first speaker, second speaker], of different sexes. */
export interface DocVoices {
  voices: [string, string];
  accents: AccentId[];
}

/**
 * Voices for one document. In "mixed" mode about half the documents are read in another accent than
 * France's, and the two speakers of an interview may come from different countries, as on the radio.
 */
export function pickVoices(mode: Exclude<VoiceMode, "fixed">, rnd: () => number = Math.random): DocVoices {
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length) % a.length];
  const france = ACCENTS[0];
  const other = () => (mode === "mixed" && rnd() < 0.5 ? pick(ACCENTS.slice(1)) : france);
  const female = rnd() < 0.5;
  const a1 = other();
  const a2 = mode === "mixed" && rnd() < 0.4 ? pick(ACCENTS) : a1;
  const v1 = pick(female ? a1.f : a1.m);
  const v2 = pick(female ? a2.m : a2.f);
  return { voices: [v1, v2], accents: [...new Set([a1.id, a2.id])] };
}

export const accentNames = (ids: AccentId[]) => ids.map((id) => ACCENTS.find((a) => a.id === id)?.zh ?? id).join("、");

/* ---------- 精听: dictation and shadowing ---------- */

export interface DictUnit {
  /** What the learner writes: the words spoken, without the speaker's name. */
  text: string;
  /** Who says it, when the document is an interview. */
  who?: string;
}

const SPEAKER = /^\s*([\p{Lu}][\p{L} .'’-]{0,24})\s:\s*/u;

/** Sentences of a document, without speaker labels; very short ones are joined to the next. */
export function sentencesOf(text: string): DictUnit[] {
  const out: DictUnit[] = [];
  for (const line of text.split(/\n+/)) {
    const m = line.match(SPEAKER);
    const said = (m ? line.slice(m[0].length) : line).trim();
    if (!said) continue;
    const who = m?.[1].trim();
    let carry = "";
    const parts = said.match(/[^.!?…]+[.!?…]+["»”)]*\s*|[^.!?…]+$/g) ?? [said];
    parts.forEach((p, k) => {
      const s = (carry + p).trim();
      // "Bon." "Oui." alone are too short to be worth a dictation item
      if (s.split(/\s+/).length < 4 && k < parts.length - 1) {
        carry = `${s} `;
        return;
      }
      carry = "";
      if (s) out.push(who ? { text: s, who } : { text: s });
    });
    if (carry.trim()) out.push(who ? { text: carry.trim(), who } : { text: carry.trim() });
  }
  return out;
}

/** Groups of sentences for paragraph dictation: one speaker's turn, cut into pieces of about `max` words. */
export function paragraphsOf(text: string, max = 45): DictUnit[] {
  const out: DictUnit[] = [];
  let cur: DictUnit | null = null;
  for (const s of sentencesOf(text)) {
    const words = (t: string) => t.split(/\s+/).length;
    if (cur && cur.who === s.who && words(cur.text) + words(s.text) <= max) cur.text += ` ${s.text}`;
    else {
      if (cur) out.push(cur);
      cur = { ...s };
    }
  }
  if (cur) out.push(cur);
  return out;
}

const wordsOf = (s: string) =>
  clean(s)
    .toLowerCase()
    .replace(/[«»"“”()[\]]/g, " ")
    .replace(/'/g, "' ")
    .replace(/[.,;:!?…]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

export type DictMark = "ok" | "accent" | "wrong" | "missing";
export interface DictResult {
  /** The words of the reference, each marked. */
  words: { w: string; mark: DictMark }[];
  /** Words the learner wrote that are not in the reference. */
  extra: string[];
  /** Share of reference words written right (accents aside count half), 0–100. */
  score: number;
}

/**
 * Compare a dictation with the reference word by word (alignment by longest common subsequence, accents
 * folded), so one missed word does not make everything after it wrong. Punctuation and case are ignored.
 */
export function checkDictation(typed: string, reference: string): DictResult {
  const ref = wordsOf(reference);
  const got = wordsOf(typed);
  const a = ref.map(foldAccents);
  const b = got.map(foldAccents);
  const n = a.length;
  const m = b.length;
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const words: DictResult["words"] = [];
  const extra: string[] = [];
  let i = 0;
  let j = 0;
  // unmatched typed words between two matches stand for the reference words there (a misspelling)
  let pendingTyped: string[] = [];
  let pendingRef: number[] = [];
  const flush = () => {
    pendingRef.forEach((k, x) => words.push({ w: ref[k], mark: x < pendingTyped.length ? "wrong" : "missing" }));
    extra.push(...pendingTyped.slice(pendingRef.length));
    pendingTyped = [];
    pendingRef = [];
  };
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      flush();
      words.push({ w: ref[i], mark: ref[i] === got[j] ? "ok" : "accent" });
      i++;
      j++;
    } else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) pendingTyped.push(got[j++]);
    else pendingRef.push(i++);
  }
  flush();
  const ok = words.reduce((s, w) => s + (w.mark === "ok" ? 1 : w.mark === "accent" ? 0.5 : 0), 0);
  return { words, extra, score: n ? Math.round((ok / n) * 100) : 100 };
}

/* ---------- 错因 ---------- */

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
export const CAUSE_TIP: Record<MissCause, string> = {
  paraphrase: "正确选项几乎从不照抄原文。做完题回到原文，把每个正确选项和原文那句话并排写下来，记住「换了什么说法」。",
  negation: "圈出 ne…que、ne…plus、sauf、seulement、à peine、pas encore 这类词；选项里的 toujours / jamais / tous 往往是陷阱。",
  gist: "先问自己：这句话回答的是「整体在讲什么」还是「某个具体信息」？主旨题别被原文里出现过的细节词带偏。",
  inference: "态度题看评价词和语气（regretter、se réjouir、certes… mais）；推断题的答案原文没写，但必须能从原文推出来。",
  vocab: "把原文里的生词加进卡组复习；B2 话题词（环境、工作、教育……）要能听懂。",
  heard: "做「精听」：逐句听写，把没听出的地方标出来，再跟读几遍。",
  time: "读题时间里先划关键词，预测答案方向；阅读先看题再读文章。",
  careless: "交卷前用 1 分钟核对每题是否答了、选项字母是否点对。",
};

/** The cause a wrong answer is put down to before the learner says otherwise: from what the question tests. */
export function causeFromSkill(skill: QSkill | undefined): MissCause | undefined {
  if (!skill) return undefined;
  return skill === "paraphrase" ? "paraphrase" : skill === "negation" ? "negation" : skill === "opinion" || skill === "inference" ? "inference" : "gist";
}

export interface CompMiss {
  at: number;
  part: Exclude<ExamPart, "speak">;
  skill?: QSkill;
  cause: MissCause;
  /** Which question of the paper ("exercise-question"). */
  q?: string;
}

export const MAX_MISSES = 400;

export function sanitizeMisses(v: unknown): CompMiss[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: CompMiss[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const e = x as Record<string, unknown>;
    if ((e.part !== "listen" && e.part !== "read") || typeof e.at !== "number" || !MISS_CAUSES.includes(e.cause as MissCause)) continue;
    const skill = typeof e.skill === "string" && e.skill in QSKILL_LABEL ? (e.skill as QSkill) : undefined;
    const q = typeof e.q === "string" && /^\d+-\d+$/.test(e.q) ? e.q : undefined;
    out.push({ at: e.at, part: e.part, cause: e.cause as MissCause, ...(skill ? { skill } : {}), ...(q ? { q } : {}) });
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

/** Right / asked by kind of question, over the given answered questions. */
export function skillStats(rows: { skill?: QSkill; right: boolean }[]) {
  const out = new Map<QSkill, { n: number; right: number }>();
  for (const r of rows) {
    if (!r.skill) continue;
    const s = out.get(r.skill) ?? { n: 0, right: 0 };
    s.n++;
    if (r.right) s.right++;
    out.set(r.skill, s);
  }
  return out;
}

/* ---------- quality of a generated exercise ---------- */

/**
 * Things in a generated exercise that the exam never does, so it can be made again: right answers that copy
 * a run of 5+ words of the document, or every right answer at the same position.
 */
export function qualityIssues(ex: CompExercise): string[] {
  const issues: string[] = [];
  const norm = (t: string) => foldAccents(t.replace(/’/g, "'")).replace(/[^\p{L}\p{N}']+/gu, " ").trim();
  const doc = ` ${ex.docs.map((d) => norm(d.text)).join(" ")} `;
  const echoes = ex.form === "opinions" ? 0 : ex.questions.filter((q) => {
    const w = norm(q.options[q.answer] ?? "").split(" ").filter(Boolean);
    for (let k = 0; k + 5 <= w.length; k++) if (doc.includes(` ${w.slice(k, k + 5).join(" ")} `)) return true;
    return false;
  }).length;
  if (echoes >= 2) issues.push(`${echoes} 个正确选项照抄原文`);
  if (ex.form !== "opinions" && ex.questions.length >= 4 && new Set(ex.questions.map((q) => q.answer)).size === 1) issues.push("正确答案都在同一个位置");
  return issues;
}

/* ---------- 真实材料: links and timestamps ---------- */

export interface RealSource {
  id: string;
  title: string;
  url: string;
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
export const MAX_TRANSCRIPT = 8000;
export const SOURCE_ID = /^s-[a-z0-9]{4,24}$/;

/** Sites with French radio and video for learners (and natives), with transcripts for some. Only their home pages. */
export const REAL_SITES: { name: string; url: string; zh: string }[] = [
  { name: "RFI 法语学习（原 RFI Savoirs）", url: "https://francaisfacile.rfi.fr/fr/", zh: "新闻慢速版和按级别的听力练习，多数有原文。" },
  { name: "TV5Monde Apprendre", url: "https://apprendre.tv5monde.com/fr", zh: "按 A1–C1 分级的短视频，带练习和原文；选 B2。" },
  { name: "France Culture", url: "https://www.radiofrance.fr/franceculture", zh: "真实的访谈和辩论节目，选 3–5 分钟的一段，难度高于考试。" },
];

/** "1:05" → 65, "65" → 65; NaN when it is not a time. */
export function parseClock(s: string): number {
  const t = s.trim();
  const m = t.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/) ?? t.match(/^()(\d+):(\d{2})$/);
  if (m) return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return /^\d+$/.test(t) ? Number(t) : NaN;
}

export function sanitizeSources(v: unknown): RealSource[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: RealSource[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    if (typeof r.id !== "string" || !SOURCE_ID.test(r.id) || typeof r.url !== "string" || !/^https?:\/\//i.test(r.url) || typeof r.created !== "number") continue;
    const sec = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.round(n) : 0);
    const start = sec(r.start);
    const end = Math.max(start, sec(r.end));
    const text = (k: string, max: number) => (typeof r[k] === "string" && (r[k] as string).trim() ? (r[k] as string).slice(0, max) : undefined);
    const transcript = text("transcript", MAX_TRANSCRIPT);
    const notes = text("notes", 2000);
    out.push({
      id: r.id,
      title: (text("title", 120) ?? "").trim() || r.url.slice(0, 120),
      url: r.url.slice(0, 600),
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

/** How to play a source in the app: a YouTube embed, an audio/video file, or only a link to the page. */
export function playerFor(url: string, start: number, end: number): { kind: "youtube"; src: string } | { kind: "media"; src: string; video: boolean } | { kind: "page" } {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { kind: "page" };
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  const yt = host === "youtu.be" ? u.pathname.slice(1) : host === "youtube.com" ? (u.searchParams.get("v") ?? u.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)/)?.[1] ?? "") : "";
  if (yt && /^[\w-]{6,20}$/.test(yt)) return { kind: "youtube", src: `https://www.youtube-nocookie.com/embed/${yt}?start=${start}${end > start ? `&end=${end}` : ""}&rel=0` };
  const ext = u.pathname.toLowerCase().match(/\.(mp3|m4a|aac|ogg|oga|wav|mp4|webm|m4v)$/)?.[1];
  if (ext) return { kind: "media", src: `${url.split("#")[0]}#t=${start}${end > start ? `,${end}` : ""}`, video: ["mp4", "webm", "m4v"].includes(ext) };
  return { kind: "page" };
}
