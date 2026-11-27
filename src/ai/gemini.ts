/**
 * Google Gemini, native REST protocol (generativelanguage.googleapis.com `v1beta`, or a custom relay / reverse
 * proxy / Cloudflare AI Gateway base URL). Loaded on demand by clients.ts, so none of it is in the first-screen bundle.
 *  - structured JSON: `responseJsonSchema`, falling back step by step to `responseSchema` (OpenAPI subset), a JSON
 *    MIME type with the schema in the instructions, and plain text, only when the service says the schema fields
 *    are not understood
 *  - `streamGenerateContent?alt=sse` (default) or `generateContent`; single object or chunk-array JSON answers too
 *  - thinking parts are never shown; usage is counted once from the last chunk that carries it
 *  - model list and native image generation
 *  - retired-model self-healing: newly created Google projects get HTTP 404 ("no longer available to new users") on
 *    `gemini-2.5-*` even while `models.list` still names them; with `allowModelFallback` the request moves to the
 *    model the error suggests, or the best text model of the key's catalog, and reports it through `onModelHealed`
 * The key travels in the `x-goog-api-key` header only, never in the URL.
 */
import type { Attachment, JsonRequest } from "./clients";
import { GEMINI_PRESET_MODELS, sanitizeBaseUrl } from "./config";
import { AiError, aiFetch, createRequestDeadline, normalizeGeminiModel, parseJsonAnswer, redactSecrets, resolveGeminiEndpoint } from "./proxy";
import { recordAiUsage } from "./usage";

export { normalizeGeminiModel };

const NAME = "Google Gemini";
const JSON_TIMEOUT_MS = 120_000;
const IMAGE_TIMEOUT_MS = 90_000;
const LIST_TIMEOUT_MS = 30_000;

export type GeminiCompatMode = "json_schema" | "openapi_schema" | "json_mime" | "text";
const CHAIN: GeminiCompatMode[] = ["json_schema", "openapi_schema", "json_mime", "text"];

/** Downgraded modes that worked: per base|model (the field itself is unknown) or per base|model|schema (one schema too complex). */
const compatCache = new Map<string, GeminiCompatMode>();
/** Custom bases whose `:streamGenerateContent` is not forwarded (404 / 405 / 501): they get `:generateContent`. */
const noStreamBases = new Set<string>();

/** Retired models already healed in this visit: `base|model` → the model that answered instead. */
const healedModels = new Map<string, string>();

/** Clear the in-memory compatibility, streaming and model-healing caches (used in tests). */
export function clearGeminiCompatCache(): void {
  compatCache.clear();
  noStreamBases.clear();
  healedModels.clear();
}

/** The mode a request would start with (what 测试连接 reports). */
export function geminiCompatModeFor(baseUrl: string | undefined, model: string, schemaName?: string): GeminiCompatMode {
  const k = `${baseKey(baseUrl)}|${normalizeGeminiModel(model)}`;
  return (schemaName ? compatCache.get(`${k}|${schemaName}`) : undefined) ?? compatCache.get(k) ?? "json_schema";
}

const baseKey = (baseUrl?: string) => sanitizeBaseUrl(baseUrl ?? "") || "official";

export function geminiHeaders(apiKey: string): Record<string, string> {
  return { "Content-Type": "application/json", "x-goog-api-key": apiKey };
}

/**
 * Output budget. Gemini 2.5 / 3.x think by default and `maxOutputTokens` covers the thoughts as well as the answer,
 * so a small request (a 64-token connection probe, a 500-token check) gets room on top for thinking.
 */
export function geminiMaxOutputTokens(model: string, maxTokens?: number): number {
  const n = maxTokens ?? 8192;
  if (/^gemini-(?:2\.0|1\.5)/i.test(normalizeGeminiModel(model))) return Math.min(Math.max(n, 1024), 8192);
  return Math.min(Math.max(n + 4096, 4096), 32768);
}

/**
 * The OpenAPI-subset schema of `responseSchema`: no `additionalProperties` / `$schema`, and number enums (which it
 * does not accept: its enums are strings) turned into a description of the allowed values. String enums, including
 * an empty-string value, nested properties, required and items are kept.
 */
export function toGeminiOpenApiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiOpenApiSchema);
  if (!schema || typeof schema !== "object") return schema;
  const o = schema as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (k === "additionalProperties" || k === "$schema") continue;
    if (k === "properties" && v && typeof v === "object" && !Array.isArray(v)) {
      out.properties = Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [pk, toGeminiOpenApiSchema(pv)]));
    } else if (k === "enum") {
      out.enum = Array.isArray(v) ? [...v] : v;
    } else out[k] = v && typeof v === "object" ? toGeminiOpenApiSchema(v) : v;
  }
  if ((o.type === "number" || o.type === "integer") && Array.isArray(o.enum)) {
    delete out.enum;
    const note = `Allowed values: ${o.enum.join(", ")}`;
    out.description = typeof o.description === "string" && o.description.trim() ? `${o.description} (${note})` : note;
  }
  return out;
}

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

const inlinePart = (a: Attachment): GeminiPart => ({ inlineData: { mimeType: a.mime, data: a.data } });

/** The conversation: `messages` (history) then `text` + `attachments` as the last user turn; same-role neighbours merged; files at the head of that final user turn. */
function buildContents(req: JsonRequest): GeminiContent[] {
  const turns: GeminiContent[] = [];
  const pushText = (role: "user" | "model", text: string) => {
    if (!text) return;
    const last = turns[turns.length - 1];
    if (last?.role === role) last.parts.push({ text });
    else turns.push({ role, parts: [{ text }] });
  };
  for (const m of req.messages ?? []) pushText(m.role === "user" ? "user" : "model", m.text);
  pushText("user", req.text);
  const files = (req.attachments ?? []).map(inlinePart);
  if (files.length) {
    if (turns[turns.length - 1]?.role === "user") turns[turns.length - 1].parts.unshift(...files);
    else turns.push({ role: "user", parts: files });
  } else if (!turns.length) {
    turns.push({ role: "user", parts: [{ text: "" }] });
  }
  return turns;
}

/**
 * Gemini 3 is tuned for its default temperature (1.0), and thinking variants omit sampling overrides:
 * an explicit `temperature: 0` from deterministic grading/STT tasks is omitted on `gemini-3*` and `*-thinking` models.
 */
function geminiTemperature(cleanModel: string, requested?: number): number | undefined {
  if (/[-/:]thinking\b/i.test(cleanModel)) return undefined;
  if (/^gemini-3/i.test(cleanModel)) return requested !== undefined && requested > 0 ? requested : undefined;
  return requested ?? 0;
}

/**
 * The request body for one compatibility mode. The system prompt goes into `systemInstruction` (never a "system"
 * turn); in `json_mime` / `text` modes it also carries the schema. `responseJsonSchema` and `responseSchema` are
 * never sent together.
 */
export function buildGeminiBody(model: string, req: JsonRequest, mode: GeminiCompatMode = "json_schema"): Record<string, unknown> {
  const clean = normalizeGeminiModel(model);
  const inline = mode === "json_mime" || mode === "text";
  const systemText = inline ? [req.system, `Answer with one JSON object only, following this JSON schema exactly:\n${JSON.stringify(req.schema)}`].filter((x) => x?.trim()).join("\n\n") : req.system;
  const temp = geminiTemperature(clean, req.temperature);
  const generationConfig: Record<string, unknown> = {
    ...(mode === "text" ? {} : { responseMimeType: "application/json" }),
    ...(mode === "json_schema" ? { responseJsonSchema: req.schema } : mode === "openapi_schema" ? { responseSchema: toGeminiOpenApiSchema(req.schema) } : {}),
    maxOutputTokens: geminiMaxOutputTokens(clean, req.maxTokens),
    ...(temp !== undefined ? { temperature: temp } : {}),
  };
  return {
    ...(systemText?.trim() ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
    contents: buildContents(req),
    generationConfig,
  };
}

/* ---------- errors ---------- */

export interface GeminiErrorInfo {
  message: string;
  status: string;
  reasons: string[];
  raw: string;
}

function errorInfo(err: unknown, raw = ""): GeminiErrorInfo {
  const e = (Array.isArray(err) ? err[0] : err) as { error?: unknown } | undefined;
  const inner = (e && typeof e === "object" && "error" in e ? e.error : e) as { message?: unknown; status?: unknown; details?: unknown } | string | undefined;
  if (typeof inner === "string") return { message: inner, status: "", reasons: [], raw };
  const details = Array.isArray(inner?.details) ? (inner.details as Array<{ reason?: unknown }>) : [];
  return {
    message: typeof inner?.message === "string" ? inner.message : raw,
    status: typeof inner?.status === "string" ? inner.status : "",
    reasons: details.map((d) => (typeof d?.reason === "string" ? d.reason : "")).filter(Boolean),
    raw,
  };
}

async function readErrorInfo(r: Response, read: <T>(p: Promise<T>) => Promise<T> = (p) => p): Promise<GeminiErrorInfo> {
  let raw = "";
  try {
    raw = await read(r.text());
  } catch (e) {
    if (e instanceof AiError || (e as Error)?.name === "AbortError") throw e;
  }
  try {
    return errorInfo(JSON.parse(raw), raw);
  } catch {
    return { message: raw, status: "", reasons: [], raw };
  }
}

const isKeyInvalid = (i: GeminiErrorInfo) => i.reasons.includes("API_KEY_INVALID") || /api[_\s-]?key\s+not\s+valid|invalid\s+api[_\s-]?key/i.test(`${i.message} ${i.raw}`);
const isRegion = (i: GeminiErrorInfo) =>
  /location is not supported|not available in your (?:country|region)|country, region, or territory is not supported/i.test(`${i.message} ${i.raw}`);
const isAttachmentIssue = (i: GeminiErrorInfo) => {
  // Strip responseMimeType / response_mime_type schema fields first (no regex lookbehind needed for older Safari)
  const stripped = `${i.message} ${i.raw}`.replace(/response_?mime_?type/gi, "");
  return /inline_data|inlineData|mime[\s_-]?type|file size|payload size|too large/i.test(stripped);
};
const isSchemaIssue = (i: GeminiErrorInfo) =>
  /responseJsonSchema|response_json_schema|responseSchema|response_schema|generation_config|generationConfig|Unknown name|Invalid JSON payload|schema|response_mime_type|responseMimeType/i.test(`${i.message} ${i.raw}`);
const detailOf = (i: GeminiErrorInfo, secret?: string) => redactSecrets(String(i.message || i.raw || "").replace(/\s+/g, " ").trim(), secret).slice(0, 200);

const MODEL_GONE = /no longer available|not found|is not supported for generateContent|retired|deprecated|shut ?down|discontinued/i;

/**
 * True when a 404 says the model itself is unavailable to this key / project (retired for new users, not found for
 * this API version, not usable with generateContent). A relay whose own address is wrong answers an HTML page or a
 * bare "404 page not found" that never names a model: that is an address problem, not a model problem.
 */
export function isGeminiModelUnavailable(status: number, info: GeminiErrorInfo): boolean {
  if (status !== 404) return false;
  const text = `${info.message} ${info.raw}`;
  if (/<!doctype|<html|<body|<head/i.test(text)) return false;
  if (!/\bmodels?\b|gemini-/i.test(text)) return false;
  return MODEL_GONE.test(text);
}

/** The model a Google error message tells the caller to use instead ("…please use models/gemini-…"), if any. */
export function extractSuggestedGeminiModel(info: GeminiErrorInfo, failing?: string): string | null {
  const text = `${info.message} ${info.raw}`;
  const failed = failing ? normalizeGeminiModel(failing) : "";
  const found: string[] = [];
  const use = /\b(?:use|try|switch to|migrate to|upgrade to)\s+(?:the\s+)?(?:model\s+)?[`'"]?(?:models\/)?(gemini-[\w.-]+)/gi;
  for (const m of text.matchAll(use)) found.push(m[1]);
  for (const m of text.matchAll(/models\/(gemini-[\w.-]+)/gi)) found.push(m[1]);
  for (const raw of found) {
    const id = normalizeGeminiModel(raw.replace(/[.-]+$/, ""));
    if (id && id !== failed && /^gemini-/i.test(id)) return id;
  }
  return null;
}

/** Models that cannot answer a JSON text request: pictures, speech, embeddings, video, music, live audio, agents. */
const NOT_TEXT = /image|imagen|tts|embed|aqa|veo|lyria|live|native-audio|robotics|learnlm|computer-use/i;

/**
 * The text models of a catalog, best first: newest generation first (3 / 3.1 together, then 2.5, then 2.0); inside
 * one generation general Flash, then Pro,
 * then Flash-Lite; then the newer version; a stable release before a `-preview` / `-exp` of the same version; the
 * shorter (undated) name first. Image / speech / embedding models are never offered, even when nothing else is left.
 */
export function rankGeminiTextModels(models: readonly string[], exclude?: ReadonlySet<string>): string[] {
  const skip = new Set([...(exclude ?? [])].map((m) => normalizeGeminiModel(m)));
  const ids = [...new Set(models.map((m) => (m ? normalizeGeminiModel(m) : "")))].filter((m) => /^gemini-/i.test(m) && !NOT_TEXT.test(m) && !skip.has(m));
  const score = (m: string) => {
    const v = /^gemini-(\d+)(?:\.(\d+))?/i.exec(m);
    const version = v ? Number(v[1]) + Number(`0.${v[2] ?? 0}`) : 0;
    // one generation per half version: 3 and 3.1 together, 2.5 apart from 2.0
    const major = Math.floor(version * 2) / 2;
    const lite = /flash-lite|-lite\b/i.test(m);
    const tier = /flash/i.test(m) && !lite ? 3 : /pro/i.test(m) ? 2 : lite ? 1 : 0;
    const stable = /preview|exp|experimental/i.test(m) ? 0 : 1;
    return [major, tier, version, stable];
  };
  return ids.sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sb[i] - sa[i];
    return a.length - b.length || a.localeCompare(b);
  });
}

/** HTTP status and error body of a thrown Gemini AiError (for the retired-model fallback). */
const httpFailure = new WeakMap<object, { status: number; info: GeminiErrorInfo }>();

function geminiError(status: number, info: GeminiErrorInfo, model: string, secret?: string): AiError {
  const err = geminiErrorOf(status, info, model, secret);
  httpFailure.set(err, { status, info });
  return err;
}

function geminiErrorOf(status: number, info: GeminiErrorInfo, model: string, secret?: string): AiError {
  if (isKeyInvalid(info)) return new AiError(`Google Gemini 返回 ${status || 400}（API Key 无效，请检查 Key 是否正确）`);
  const detail = detailOf(info, secret);
  if ((status === 403 || status === 400) && isRegion(info))
    return new AiError(`Google Gemini 返回 ${status}（当前网络地区不支持官方直连，请配置自定义反代 Base URL 或切换网络）`);
  if (status === 401) return new AiError("Google Gemini 返回 401（Key 不对或未授权）");
  if (status === 403) {
    return new AiError(`Google Gemini 返回 403（没有权限或 Key 受限）${detail ? `：${detail}` : ""}`);
  }
  if (status === 404 && isGeminiModelUnavailable(404, info) && /no longer available to new users|not available to new (?:users|projects)/i.test(`${info.message} ${info.raw}`))
    return new AiError(
      `Google Gemini 返回 404（模型 ${normalizeGeminiModel(model)} 对当前项目不可用，新创建的项目请改用 gemini-3-flash-preview 等新一代模型，或在 AI 设置中点「测试连接」自动匹配）`,
    );
  if (status === 404) return new AiError(`Google Gemini 返回 404（模型名或接口地址不对：${normalizeGeminiModel(model)}）`);
  if (status === 429) return new AiError("Google Gemini 返回 429（请求太频繁或免费/付费额度用完，请稍后再试）");
  if ([500, 502, 503, 504].includes(status)) return new AiError(`Google Gemini 服务暂时不可用（HTTP ${status}），请稍后重试`);
  return new AiError(`Google Gemini 返回 ${status || "错误"}${detail ? `：${detail}` : ""}`);
}

/** A readable, key-free AiError for a failed Gemini HTTP response. */
export async function mapGeminiHttpError(r: Response, model: string, secret?: string): Promise<AiError> {
  return geminiError(r.status, await readErrorInfo(r), model, secret);
}

/* ---------- answers ---------- */

interface WireChunk {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean; inlineData?: { mimeType?: string; data?: string } }> };
    finishReason?: string;
    safetyRatings?: Array<{ category?: string; probability?: string; blocked?: boolean }>;
  }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  error?: unknown;
}

export interface GeminiAnswer {
  text: string;
  finishReason?: string;
  blockReason?: string;
  /** Blocked or HIGH-probability safety categories. */
  flagged: string[];
  promptTokens?: number;
  completionTokens?: number;
}

const SAFETY_STOPS = ["SAFETY", "RECITATION", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "IMAGE_SAFETY"];

function collector(model: string, onDelta?: (chunk: string) => void, secret?: string) {
  const out: GeminiAnswer = { text: "", flagged: [] };
  const add = (c: WireChunk) => {
    if (!c || typeof c !== "object") return;
    if (c.error) {
      const info = errorInfo(c, JSON.stringify(c.error));
      const code = Number((c.error as { code?: unknown })?.code ?? 0);
      throw code ? geminiError(code, info, model, secret) : new AiError(`Google Gemini 返回错误：${detailOf(info, secret) || "未知错误"}`);
    }
    if (c.promptFeedback?.blockReason) out.blockReason = c.promptFeedback.blockReason;
    const cand = c.candidates?.[0];
    for (const p of cand?.content?.parts ?? []) {
      if (p.thought === true || typeof p.text !== "string" || !p.text) continue;
      out.text += p.text;
      onDelta?.(p.text);
    }
    if (cand?.finishReason && cand.finishReason !== "FINISH_REASON_UNSPECIFIED") out.finishReason = cand.finishReason;
    for (const s of cand?.safetyRatings ?? [])
      if (s.category && (s.blocked || s.probability === "HIGH") && !out.flagged.includes(s.category)) out.flagged.push(s.category);
    const u = c.usageMetadata;
    if (u && [u.promptTokenCount, u.candidatesTokenCount, u.thoughtsTokenCount].some((n) => typeof n === "number")) {
      // streamed usage is cumulative: the last chunk that carries it is the whole call
      out.promptTokens = u.promptTokenCount;
      out.completionTokens = (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
    }
  };
  return { out, add };
}

/** Server-sent events: `data:` lines (CRLF or LF), an event per blank line, `[DONE]` ignored. */
function sseParser(onEvent: (data: string) => void) {
  let buf = "";
  let data: string[] = [];
  const flush = () => {
    if (!data.length) return;
    const joined = data.join("\n").trim();
    data = [];
    if (joined && joined !== "[DONE]") onEvent(joined);
  };
  const line = (l: string) => {
    if (l === "") return flush();
    if (l.startsWith(":")) return;
    if (l.startsWith("data:")) {
      data.push(l.slice(5).replace(/^ /, ""));
      // some relays never send the blank line between events: dispatch as soon as the data is a whole JSON value
      const joined = data.join("\n").trim();
      if (joined === "[DONE]") data = [];
      else if (/^[[{]/.test(joined)) {
        let whole = true;
        try {
          JSON.parse(joined);
        } catch {
          whole = false; // more lines to come
        }
        if (whole) flush();
      }
    }
  };
  return {
    feed(text: string) {
      buf += text;
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        line(buf.slice(0, nl).replace(/\r$/, ""));
        buf = buf.slice(nl + 1);
      }
    },
    end() {
      if (buf) line(buf.replace(/\r$/, ""));
      buf = "";
      flush();
    },
  };
}

const parseEvent = (data: string): WireChunk | WireChunk[] | null => {
  try {
    return JSON.parse(data) as WireChunk | WireChunk[];
  } catch {
    return null;
  }
};

/**
 * Read a Gemini answer: `text/event-stream` (checked to have really finished), one `GenerateContentResponse`, or an
 * array of them. Every read goes through `read`, so a deadline or abort stops it at once.
 */
export async function consumeGeminiResponse(
  res: Response,
  opts: { model: string; onDelta?: (chunk: string) => void; read?: <T>(p: Promise<T>, onCancel?: () => void) => Promise<T>; secret?: string },
): Promise<GeminiAnswer> {
  const read = opts.read ?? (<T,>(p: Promise<T>) => p);
  const { out, add } = collector(opts.model, opts.onDelta, opts.secret);
  const addAny = (v: WireChunk | WireChunk[] | null) => (Array.isArray(v) ? v.forEach(add) : v && add(v));
  const addSseEvent = (d: string) => {
    const parsed = parseEvent(d);
    if (!parsed) throw new AiError("Google Gemini 流式响应数据损坏，请重试");
    addAny(parsed);
  };
  const ct = res.headers.get("content-type") ?? "";
  let sse = ct.includes("text/event-stream");
  if (sse && res.body) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    const parser = sseParser(addSseEvent);
    let finished = false;
    try {
      for (;;) {
        const { done, value } = await read(reader.read(), () => void reader.cancel().catch(() => undefined));
        if (done) break;
        parser.feed(dec.decode(value, { stream: true }));
      }
      finished = true;
      parser.feed(dec.decode());
      parser.end();
    } finally {
      if (!finished) void reader.cancel().catch(() => undefined);
    }
  } else {
    const raw = await read(res.text());
    const t = raw.trim();
    if (/^(?::[^\r\n]*\r?\n|\s)*data:/.test(t)) {
      sse = true;
      const parser = sseParser(addSseEvent);
      parser.feed(raw);
      parser.end();
    } else {
      const v = parseEvent(t);
      if (!v) throw new AiError("Google Gemini 返回的不是有效的 JSON 响应，请检查接口地址");
      addAny(v);
    }
  }
  if (sse && !out.finishReason && !out.blockReason) throw new AiError("Google Gemini 流式响应中断，请检查网络后重试");
  return out;
}

/** The learner-facing error for a blocked, cut-off or empty answer, if any. */
function answerProblem(a: GeminiAnswer, what = "输出"): AiError | null {
  if (a.blockReason) return new AiError(`Google Gemini 安全策略拦截了输入内容（${a.blockReason}），请调整文本后重试`);
  if (a.finishReason && SAFETY_STOPS.includes(a.finishReason)) {
    const cats = a.flagged.length ? `：${a.flagged.join(", ")}` : "";
    return new AiError(`Google Gemini 安全策略拦截了本次${what}（${a.finishReason}${cats}），请调整内容或更换模型重试`);
  }
  if (a.finishReason === "MAX_TOKENS") return new AiError("Google Gemini 的输出太长被截断了，试试少放一些内容");
  return null;
}

/* ---------- requests ---------- */

export interface GeminiOptions {
  apiKey: string;
  geminiBaseUrl?: string;
  fetcher?: typeof fetch;
  /** `streamGenerateContent?alt=sse` (default) or `generateContent`. */
  stream?: boolean;
  onDelta?: (chunk: string) => void;
  /**
   * When the model answers 404 because it is retired / unavailable for this project, retry once on the model the
   * error suggests or the best text models of the key's catalog (at most 3, never recursively). Off by default: a
   * model the learner typed on purpose reports its 404 as it is.
   */
  allowModelFallback?: boolean;
  /** The catalog already read (testTextProvider), so a fallback need not read `/models` again. */
  knownModels?: readonly string[];
  /** Called once a fallback model answered in place of `fromModel` (persist it so later calls go there directly). */
  onModelHealed?: (fromModel: string, toModel: string) => void;
}

/** At most this many replacement models are tried after a retired-model 404. */
const MAX_HEAL_CANDIDATES = 3;

const isAbort = (e: unknown) => (e as Error)?.name === "AbortError";

/** The status and error body of a Gemini HTTP failure that says the model itself is unavailable. */
function unavailableInfo(e: unknown): GeminiErrorInfo | null {
  const f = e && typeof e === "object" ? httpFailure.get(e) : undefined;
  return f && isGeminiModelUnavailable(f.status, f.info) ? f.info : null;
}

/**
 * Run `once` on `model`; if it is retired for this project (and `allowModelFallback`), on the replacement models in
 * turn: first the one already healed in this visit, then the error's suggestion, then the ranked catalog. The first
 * that answers is remembered for the visit and reported through `onModelHealed`. When none answers, the original
 * error is thrown, unless a replacement failed for another reason than a 404 (quota, permission), which is more useful.
 */
async function withModelHealing<T>(model: string, opts: GeminiOptions, signal: AbortSignal | undefined, once: (m: string) => Promise<T>): Promise<T> {
  const clean = normalizeGeminiModel(model);
  const healKey = `${baseKey(opts.geminiBaseUrl)}|${clean}`;
  const healed = opts.allowModelFallback ? healedModels.get(healKey) : undefined;
  const tried = new Set<string>([clean]);
  if (healed) {
    try {
      const out = await once(healed);
      opts.onModelHealed?.(clean, healed);
      return out;
    } catch (e) {
      if (!unavailableInfo(e)) throw e;
      healedModels.delete(healKey);
      tried.add(healed);
    }
  }
  let original: unknown;
  let info: GeminiErrorInfo | null;
  try {
    return await once(clean);
  } catch (e) {
    info = opts.allowModelFallback ? unavailableInfo(e) : null;
    if (!info) throw e;
    original = e;
  }

  const queue: string[] = [];
  const suggested = extractSuggestedGeminiModel(info, clean);
  if (suggested) queue.push(...rankGeminiTextModels([suggested], tried));
  let catalogRead = false;
  const readCatalog = async () => {
    catalogRead = true;
    let catalog: readonly string[] = opts.knownModels ?? [];
    if (!catalog.length) {
      try {
        catalog = await listGeminiModels({ ...opts, signal });
      } catch (e) {
        if (isAbort(e)) throw e;
        catalog = [];
      }
    }
    // a relay without /models: the current generation is still worth a try
    if (!catalog.length) catalog = GEMINI_PRESET_MODELS;
    for (const m of rankGeminiTextModels(catalog, tried)) if (!queue.includes(m)) queue.push(m);
  };
  if (!queue.length) await readCatalog();

  let other: unknown = null;
  for (let attempts = 0; attempts < MAX_HEAL_CANDIDATES; attempts++) {
    if (!queue.length && !catalogRead) await readCatalog();
    const next = queue.shift();
    if (!next) break;
    tried.add(next);
    try {
      const out = await once(next);
      healedModels.set(healKey, next);
      opts.onModelHealed?.(clean, next);
      return out;
    } catch (e) {
      if (isAbort(e) || signal?.aborted) throw e;
      const f = e && typeof e === "object" ? httpFailure.get(e) : undefined;
      if (!f || f.status !== 404) other ??= e;
    }
  }
  throw other ?? original;
}

const endpoint = (opts: GeminiOptions, path: string) => resolveGeminiEndpoint(opts.geminiBaseUrl ?? "", path, { forceDirect: Boolean(opts.fetcher) });

/**
 * A JSON answer from a Gemini model, with the schema-compatibility fallback described above and, with
 * `allowModelFallback`, the retired-model self-healing.
 */
export async function geminiJsonWith(model: string, req: JsonRequest, opts: GeminiOptions): Promise<unknown> {
  return withModelHealing(model, opts, req.signal, (m) => geminiJsonOnce(m, req, opts));
}

async function geminiJsonOnce(model: string, req: JsonRequest, opts: GeminiOptions): Promise<unknown> {
  const clean = normalizeGeminiModel(model);
  const base = baseKey(opts.geminiBaseUrl);
  const custom = base !== "official";
  const fetcher = opts.fetcher ?? aiFetch;
  const onDelta = opts.onDelta ?? req.onDelta;
  const modelKey = `${base}|${clean}`;
  const schemaKey = `${modelKey}|${req.schemaName}`;
  const startMode = compatCache.get(schemaKey) ?? compatCache.get(modelKey) ?? "json_schema";
  let stream = (opts.stream ?? true) && !(custom && noStreamBases.has(base));
  let streamRetried = false;
  let fellBackFromStream = false;
  let modelFloor: GeminiCompatMode | undefined;

  for (let i = CHAIN.indexOf(startMode); i < CHAIN.length; ) {
    const mode = CHAIN[i];
    const url = endpoint(opts, `/models/${encodeURIComponent(clean)}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}`);
    const dl = createRequestDeadline(req.signal, JSON_TIMEOUT_MS, NAME);
    let answer: GeminiAnswer;
    try {
      const r = await dl.wrapRead(
        fetcher(url, { method: "POST", headers: geminiHeaders(opts.apiKey), body: JSON.stringify(buildGeminiBody(clean, req, mode)), signal: dl.signal }),
      );
      if (!r.ok) {
        if (stream && custom && !streamRetried && [404, 405, 501].includes(r.status)) {
          // this relay may forward :generateContent only; cache only after :generateContent succeeds
          void r.body?.cancel().catch(() => undefined);
          stream = false;
          streamRetried = true;
          fellBackFromStream = true;
          continue;
        }
        const info = await readErrorInfo(r, dl.wrapRead);
        const downgrade = (r.status === 400 || r.status === 422) && !isKeyInvalid(info) && !isAttachmentIssue(info) && isSchemaIssue(info) && i < CHAIN.length - 1;
        if (!downgrade) throw geminiError(r.status, info, clean, opts.apiKey);
        // the field itself is unknown here: every schema of this model needs the next mode
        if (/Unknown name/i.test(`${info.message} ${info.raw}`)) modelFloor = CHAIN[i + 1];
        i++;
        continue;
      }
      answer = await consumeGeminiResponse(r, { model: clean, onDelta, read: dl.wrapRead, secret: opts.apiKey });
    } finally {
      dl.cleanup();
    }
    if (fellBackFromStream) noStreamBases.add(base);
    if (modelFloor) compatCache.set(modelKey, modelFloor);
    if (mode !== startMode && mode !== modelFloor) compatCache.set(schemaKey, mode);
    recordAiUsage({ provider: "gemini", model: clean, promptTokens: answer.promptTokens, completionTokens: answer.completionTokens });
    const problem = answerProblem(answer);
    if (problem) throw problem;
    if (!answer.text.trim()) throw new AiError("Google Gemini 未返回有效内容，请稍后重试");
    return parseJsonAnswer(answer.text, NAME);
  }
  throw new AiError("Google Gemini 未返回有效内容，请稍后重试");
}

/** Model ids the key can use for generateContent; the recommended text presets first, then the rest alphabetically. */
export async function listGeminiModels(opts: GeminiOptions & { signal?: AbortSignal }): Promise<string[]> {
  const fetcher = opts.fetcher ?? aiFetch;
  const found: string[] = [];
  let token = "";
  for (let page = 0; page < 4; page++) {
    const url = endpoint(opts, `/models?pageSize=100${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`);
    const dl = createRequestDeadline(opts.signal, LIST_TIMEOUT_MS, NAME);
    let j: {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
      data?: Array<{ id?: string }>;
      nextPageToken?: string;
    };
    try {
      const r = await dl.wrapRead(fetcher(url, { headers: geminiHeaders(opts.apiKey), signal: dl.signal }));
      if (!r.ok) throw geminiError(r.status, await readErrorInfo(r, dl.wrapRead), "models", opts.apiKey);
      j = JSON.parse(await dl.wrapRead(r.text()));
    } catch (e) {
      if (e instanceof SyntaxError) throw new AiError("Google Gemini 模型列表不是有效的 JSON，请检查接口地址");
      throw e;
    } finally {
      dl.cleanup();
    }
    for (const m of j?.models ?? []) {
      if (typeof m?.name !== "string") continue;
      if (Array.isArray(m.supportedGenerationMethods) && !m.supportedGenerationMethods.includes("generateContent")) continue;
      found.push(m.name.replace(/^models\//i, ""));
    }
    for (const m of j?.data ?? []) if (typeof m?.id === "string") found.push(m.id.replace(/^(?:models|google)\//i, ""));
    token = typeof j?.nextPageToken === "string" ? j.nextPageToken : "";
    if (!token) break;
  }
  const all = new Set(found.filter(Boolean));
  const preset: string[] = [...GEMINI_PRESET_MODELS].filter((m) => all.has(m));
  return [...preset, ...[...all].filter((m) => !preset.includes(m)).sort()];
}

const bytesOf = (b64: string) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

/** One picture from a Gemini image model (`responseModalities: TEXT + IMAGE`), skipping intermediate thought drafts. */
export async function geminiGenerateImage(model: string, prompt: string, opts: GeminiOptions & { signal?: AbortSignal }): Promise<Blob> {
  const clean = normalizeGeminiModel(model);
  const fetcher = opts.fetcher ?? aiFetch;
  const dl = createRequestDeadline(opts.signal, IMAGE_TIMEOUT_MS, `${NAME} 图片`);
  let raw: WireChunk | WireChunk[];
  try {
    const r = await dl.wrapRead(
      fetcher(endpoint(opts, `/models/${encodeURIComponent(clean)}:generateContent`), {
        method: "POST",
        headers: geminiHeaders(opts.apiKey),
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }),
        signal: dl.signal,
      }),
    );
    if (!r.ok) throw geminiError(r.status, await readErrorInfo(r, dl.wrapRead), clean, opts.apiKey);
    try {
      raw = JSON.parse(await dl.wrapRead(r.text())) as WireChunk | WireChunk[];
    } catch (e) {
      if (e instanceof SyntaxError) throw new AiError("Google Gemini 返回的不是有效的 JSON 响应，请检查接口地址");
      throw e;
    }
  } finally {
    dl.cleanup();
  }
  const chunks = Array.isArray(raw) ? raw : [raw];
  const { out, add } = collector(clean, undefined, opts.apiKey);
  const visibleImages: Array<{ mimeType: string; data: string }> = [];
  for (const c of chunks) {
    add(c);
    for (const p of c?.candidates?.[0]?.content?.parts ?? []) {
      if (p.thought === true) continue;
      if (p.inlineData?.mimeType?.startsWith("image/") && p.inlineData.data) {
        visibleImages.push({ mimeType: p.inlineData.mimeType, data: p.inlineData.data });
      }
    }
  }
  recordAiUsage({ provider: "gemini", model: clean, promptTokens: out.promptTokens, completionTokens: out.completionTokens });
  const problem = answerProblem(out, "配图");
  if (problem) throw problem;
  const finalImg = visibleImages[visibleImages.length - 1];
  if (finalImg) return new Blob([bytesOf(finalImg.data)], { type: finalImg.mimeType });
  if (out.text.trim()) throw new AiError(`Google Gemini 没有生成图片，只回复了文字：${redactSecrets(out.text.trim(), opts.apiKey).slice(0, 120)}`);
  throw new AiError("Google Gemini 没有返回图片，请稍后重试或换一个图片模型");
}

/**
 * Verbatim French audio transcription via Gemini `:generateContent`, with full read-deadline and safety/truncation
 * checks, and (with `allowModelFallback`) the retired-model self-healing.
 */
export async function geminiTranscribeAudio(
  model: string,
  audio: { mimeType: string; data: string },
  prompts: { system: string; text: string },
  opts: GeminiOptions & { signal?: AbortSignal },
): Promise<string> {
  return withModelHealing(model, opts, opts.signal, (m) => geminiTranscribeOnce(m, audio, prompts, opts));
}

async function geminiTranscribeOnce(
  model: string,
  audio: { mimeType: string; data: string },
  prompts: { system: string; text: string },
  opts: GeminiOptions & { signal?: AbortSignal },
): Promise<string> {
  const clean = normalizeGeminiModel(model);
  const fetcher = opts.fetcher ?? aiFetch;
  const temp = geminiTemperature(clean, 0);
  const dl = createRequestDeadline(opts.signal, IMAGE_TIMEOUT_MS, NAME);
  let answer: GeminiAnswer;
  try {
    const r = await dl.wrapRead(
      fetcher(endpoint(opts, `/models/${encodeURIComponent(clean)}:generateContent`), {
        method: "POST",
        headers: geminiHeaders(opts.apiKey),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: prompts.system }] },
          contents: [{ role: "user", parts: [{ inlineData: { mimeType: audio.mimeType, data: audio.data } }, { text: prompts.text }] }],
          generationConfig: {
            ...(temp !== undefined ? { temperature: temp } : {}),
            responseMimeType: "application/json",
            maxOutputTokens: geminiMaxOutputTokens(clean, 4096),
          },
        }),
        signal: dl.signal,
      }),
    );
    if (!r.ok) throw geminiError(r.status, await readErrorInfo(r, dl.wrapRead), clean, opts.apiKey);
    answer = await consumeGeminiResponse(r, { model: clean, read: dl.wrapRead, secret: opts.apiKey });
  } finally {
    dl.cleanup();
  }
  recordAiUsage({ provider: "gemini", model: clean, promptTokens: answer.promptTokens, completionTokens: answer.completionTokens });
  if (answer.blockReason) throw new AiError(`Google Gemini 安全策略拦截了这段录音（${answer.blockReason}），请重新录一段再试`);
  const problem = answerProblem(answer, "音频转写");
  if (problem) throw problem;
  return answer.text;
}
