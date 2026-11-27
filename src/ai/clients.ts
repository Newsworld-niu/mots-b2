/**
 * Calls to the AI services: through the local forwarder (ai-proxy.ts) under npm run dev / preview, directly on a
 * static deployment and in the Android app (see proxy.ts):
 *  - OpenAI, DeepSeek and OpenRouter: chat completions (OpenAI-format JSON); OpenAI and OpenRouter also images
 *  - Anthropic: the official SDK, structured JSON output
 *  - Google Gemini: its native REST protocol (gemini.ts, loaded on demand)
 *  - Azure AI Speech: text to speech (SSML) and the voice list
 */
import { DEFAULT_MODELS, getAiConfig, type AiConfig, type TextProvider } from "./config";
import { AiError, aiFetch, errorFrom, fetchWithTimeout, normalizeGeminiModel, parseJsonAnswer, proxyAvailable, proxyUrl, resolveOpenAiEndpoint } from "./proxy";
import { buildVoiceSsml, type SsmlOptions } from "./ssml";
import { recordAiUsage } from "./usage";

export interface Attachment {
  /** image/jpeg, image/png, image/webp or application/pdf */
  mime: string;
  /** Base64, no data: prefix. */
  data: string;
  name?: string;
}

export interface JsonRequest {
  system: string;
  text: string;
  attachments?: Attachment[];
  /** JSON schema of the answer (an object; every property required, no extra properties). */
  schema: Record<string, unknown>;
  schemaName: string;
  signal?: AbortSignal;
  maxTokens?: number;
  /** Sampling temperature; defaults to 0 on non-reasoning models and is omitted on reasoning models. */
  temperature?: number;
  /** Earlier turns of a conversation (Gemini): `text` follows them as the last user turn. */
  messages?: Array<{ role: "user" | "assistant" | "model"; text: string }>;
  /** Visible answer text as it streams in (Gemini). */
  onDelta?: (chunk: string) => void;
}

const NAMES: Record<string, string> = {
  openai: "OpenAI",
  deepseek: "DeepSeek",
  anthropic: "Anthropic",
  openrouter: "OpenRouter",
  gemini: "Google Gemini",
  azure: "Azure 语音",
};

type ChatProvider = "openai" | "deepseek" | "openrouter";
export type OpenAiCompatMode = "strict" | "json_object" | "text";
/** Where each OpenAI-format service keeps its endpoints. */
const CHAT_BASE: Record<ChatProvider, string> = { openai: "/v1", deepseek: "", openrouter: "/api/v1" };
const compatModeCache = new Map<string, OpenAiCompatMode>();

/** Clear in-memory OpenAI compatibility downgrade cache (used in tests). */
export function clearOpenAiCompatCache(): void {
  compatModeCache.clear();
}

/** Settles where requests go (forwarder or direct) before the first one is built. */
async function needProxy() {
  await proxyAvailable();
}

function key(service: keyof AiConfig["keys"], cfg: AiConfig = getAiConfig()) {
  const k = cfg.keys[service].trim();
  if (!k) throw new AiError(`还没有填 ${NAMES[service]} 的 Key（在「我的 → AI 接口」里填）`);
  return k;
}

const parseJson = parseJsonAnswer;

/* ---------- OpenAI / DeepSeek / OpenRouter ---------- */

/** OpenAI o-series and gpt-5* reasoning models support `reasoning_effort`. */
export function isOpenAiReasoningModel(model: string): boolean {
  return /(?:^|\/)(?:o\d|gpt-5(?!-chat))/i.test(model.trim().toLowerCase());
}

/** Reasoning models (OpenAI o-series / gpt-5*, DeepSeek reasoner/R1, thinking variants) reject temperature != 1. */
export function supportsTemperature(model: string): boolean {
  const m = model.trim().toLowerCase();
  if (isOpenAiReasoningModel(m)) return false;
  if (/reasoner|deepseek-r1|qwq|[-/:]thinking\b/i.test(m)) return false;
  return true;
}

export function buildOpenAiChatBody(
  provider: ChatProvider,
  model: string,
  req: JsonRequest,
  opts?: { customBase?: boolean; mode?: OpenAiCompatMode },
): Record<string, unknown> {
  const parts: unknown[] = [{ type: "text", text: req.text }];
  for (const a of req.attachments ?? []) {
    if (provider === "deepseek") throw new AiError("DeepSeek 不能看图片或 PDF，请在设置里把「识图」换成 OpenAI、Gemini 或 Anthropic");
    if (a.mime === "application/pdf") parts.push({ type: "file", file: { filename: a.name || "document.pdf", file_data: `data:application/pdf;base64,${a.data}` } });
    else parts.push({ type: "image_url", image_url: { url: `data:${a.mime};base64,${a.data}`, detail: "high" } });
  }
  const wantedTemp = req.temperature ?? 0;
  const temp = supportsTemperature(model) ? wantedTemp : undefined;
  const reasoningEffort = wantedTemp === 0 && isOpenAiReasoningModel(model) ? "low" : undefined;
  const mode: OpenAiCompatMode = opts?.mode ?? "strict";
  const schemaInstruction = `${req.system}\n\nAnswer with one JSON object only, following this JSON schema exactly:\n${JSON.stringify(req.schema)}`;

  if (provider === "openai") {
    if (!opts?.customBase && mode === "strict") {
      return {
        model,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: parts },
        ],
        response_format: { type: "json_schema", json_schema: { name: req.schemaName, strict: true, schema: req.schema } },
        max_completion_tokens: req.maxTokens ?? 16000,
        ...(temp !== undefined ? { temperature: temp } : {}),
        ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
      };
    }
    const compatTokens = Math.min(req.maxTokens ?? 8192, 8192);
    if (mode === "strict") {
      return {
        model,
        messages: [
          { role: "system", content: schemaInstruction },
          { role: "user", content: parts },
        ],
        response_format: { type: "json_schema", json_schema: { name: req.schemaName, strict: true, schema: req.schema } },
        max_completion_tokens: req.maxTokens ?? 16000,
        ...(temp !== undefined ? { temperature: temp } : {}),
        ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
      };
    }
    if (mode === "json_object") {
      return {
        model,
        messages: [
          { role: "system", content: schemaInstruction },
          { role: "user", content: parts.length > 1 ? parts : req.text },
        ],
        response_format: { type: "json_object" },
        max_tokens: compatTokens,
        ...(temp !== undefined ? { temperature: temp } : {}),
      };
    }
    return {
      model,
      messages: [
        { role: "system", content: schemaInstruction },
        { role: "user", content: parts.length > 1 ? parts : req.text },
      ],
      max_tokens: compatTokens,
      ...(temp !== undefined ? { temperature: temp } : {}),
    };
  }

  if (provider === "openrouter") {
    const responseFormat =
      mode === "strict"
        ? { type: "json_schema", json_schema: { name: req.schemaName, strict: true, schema: req.schema } }
        : mode === "json_object"
          ? { type: "json_object" }
          : undefined;
    return {
      model,
      messages: [
        { role: "system", content: schemaInstruction },
        { role: "user", content: parts.length > 1 ? parts : req.text },
      ],
      ...(responseFormat ? { response_format: responseFormat } : {}),
      max_tokens: req.maxTokens ?? 16000,
      ...(temp !== undefined ? { temperature: temp } : {}),
      ...(mode === "strict" && reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
    };
  }

  return {
    model,
    // DeepSeek takes json_object only: the schema goes into the instructions
    messages: [
      { role: "system", content: schemaInstruction },
      { role: "user", content: req.text },
    ],
    ...(mode === "text" ? {} : { response_format: { type: "json_object" } }),
    max_tokens: Math.min(req.maxTokens ?? 8000, 8000),
    ...(temp !== undefined ? { temperature: temp } : {}),
  };
}

export async function openaiJsonWith(
  provider: ChatProvider,
  model: string,
  req: JsonRequest,
  opts: {
    apiKey: string;
    openaiBaseUrl?: string;
    fetcher?: typeof fetch;
  },
) {
  const customBase = provider === "openai" && !!opts.openaiBaseUrl?.trim();
  const url = provider === "openai" ? resolveOpenAiEndpoint(opts.openaiBaseUrl ?? "", "/chat/completions") : proxyUrl(provider, `${CHAT_BASE[provider]}/chat/completions`);
  const cacheKey = `${provider}|${opts.openaiBaseUrl ?? ""}|${model}`;
  const startMode = compatModeCache.get(cacheKey) ?? "strict";
  const chain: OpenAiCompatMode[] =
    customBase || provider === "openrouter"
      ? startMode === "text"
        ? ["text"]
        : startMode === "json_object"
          ? ["json_object", "text"]
          : ["strict", "json_object", "text"]
      : ["strict"];

  interface OpenAiChatWireResponse {
    error?: { code?: string | number; message?: string };
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    choices?: Array<{
      error?: { code?: string | number; message?: string };
      finish_reason?: string;
      message?: { content?: string; refusal?: string };
    }>;
  }

  const fetcher = opts.fetcher ?? aiFetch;
  let j: OpenAiChatWireResponse = {};
  for (let i = 0; i < chain.length; i++) {
    const mode = chain[i];
    const body = buildOpenAiChatBody(provider, model, req, { customBase, mode });
    const r = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
        body: JSON.stringify(body),
        signal: req.signal,
      },
      120_000,
      NAMES[provider],
      fetcher,
    );
    if (!r.ok) {
      if ((r.status === 400 || r.status === 422) && i < chain.length - 1) continue;
      throw await errorFrom(r, NAMES[provider]);
    }
    j = await r.json();
    // OpenRouter can answer 200 with an upstream 400/422 error when a model rejects json_schema
    const failed = j.error ?? j.choices?.[0]?.error;
    if (failed) {
      const code = Number(failed.code ?? 0);
      if ((code === 400 || code === 422 || /json_schema|response_format|structured/i.test(String(failed.message ?? ""))) && i < chain.length - 1) {
        continue;
      }
      throw new AiError(`${NAMES[provider]} 返回错误：${String(failed.message ?? failed.code ?? "未知错误").slice(0, 300)}`);
    }
    if (chain.length > 1) compatModeCache.set(cacheKey, mode);
    break;
  }
  recordAiUsage({
    provider,
    model,
    promptTokens: j.usage?.prompt_tokens,
    completionTokens: j.usage?.completion_tokens,
  });
  const choice = j.choices?.[0];
  if (choice?.message?.refusal) throw new AiError(`${NAMES[provider]} 拒绝了这个请求：${choice.message.refusal}`);
  if (choice?.finish_reason === "length") throw new AiError(`${NAMES[provider]} 的输出太长被截断了，试试少放一些内容`);
  return parseJson(choice?.message?.content ?? "", NAMES[provider]);
}

async function openaiJson(provider: ChatProvider, model: string, req: JsonRequest, c: AiConfig = getAiConfig()) {
  return openaiJsonWith(provider, model, req, { apiKey: key(provider, c), openaiBaseUrl: c.openaiBaseUrl });
}

/* ---------- Anthropic (direct fetch + SSE, zero SDK bundle overhead) ---------- */

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp"; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

/** Server-side fallback on a refusal: offered for the Opus 5 / 5.5, Fable 5.1 and Sonnet 5.5 models. */
const hasFallback = (model: string) => /^claude-(opus-5|fable-5-1|sonnet-5-5)/.test(model);

function anthropicHeaders(apiKey: string, betas?: string[]): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  };
  if (betas?.length) h["anthropic-beta"] = betas.join(",");
  return h;
}

async function mapAnthropicHttpError(r: Response, model?: string): Promise<AiError> {
  if (r.status === 401) return new AiError("Anthropic 返回 401（Key 不对）");
  if (r.status === 403) return new AiError("Anthropic 返回 403（没有权限）");
  if (r.status === 404) return new AiError(`Anthropic 返回 404（模型名不对？${model ?? ""}）`);
  if (r.status === 429) return new AiError("Anthropic 返回 429（请求太频繁或额度用完）");
  return errorFrom(r, "Anthropic");
}

export function buildAnthropicBody(model: string, req: JsonRequest, opts?: { omitOutputConfig?: boolean }) {
  const content: AnthropicContentBlock[] = [];
  for (const a of req.attachments ?? []) {
    if (a.mime === "application/pdf") content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: a.data } });
    else content.push({ type: "image", source: { type: "base64", media_type: a.mime as "image/jpeg" | "image/png" | "image/webp", data: a.data } });
  }
  content.push({ type: "text", text: req.text });
  const temp = supportsTemperature(model) ? (req.temperature ?? 0) : undefined;
  const system = opts?.omitOutputConfig
    ? `${req.system}\n\nAnswer with one JSON object only, following this JSON schema exactly:\n${JSON.stringify(req.schema)}`
    : req.system;
  return {
    model,
    max_tokens: req.maxTokens ?? 16000,
    system,
    messages: [{ role: "user" as const, content }],
    ...(opts?.omitOutputConfig ? {} : { output_config: { format: { type: "json_schema" as const, schema: req.schema } } }),
    ...(temp !== undefined ? { temperature: temp } : {}),
    ...(hasFallback(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  };
}

async function consumeAnthropicStream(res: Response): Promise<{
  text: string;
  stopReason: string | null;
  inputTokens?: number;
  outputTokens?: number;
}> {
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("text/event-stream") || !res.body) {
    const msg = (await res.json()) as {
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (msg.content ?? []).map((b) => (b.type === "text" ? b.text ?? "" : "")).join("");
    return { text, stopReason: msg.stop_reason ?? null, inputTokens: msg.usage?.input_tokens, outputTokens: msg.usage?.output_tokens };
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  let stopReason: string | null = null;
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let currentEvent = "";
  interface AnthropicStreamEvent {
    type?: string;
    message?: string | { usage?: { input_tokens?: number } };
    error?: { message?: string };
    delta?: { type?: string; text?: string; stop_reason?: string };
    usage?: { output_tokens?: number };
  }
  const handleData = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "[DONE]") return;
    let ev: AnthropicStreamEvent;
    try {
      ev = JSON.parse(trimmed) as AnthropicStreamEvent;
    } catch {
      return;
    }
    const kind = ev.type || currentEvent;
    if (kind === "error" || ev.error) {
      const m = ev.error?.message || (typeof ev.message === "string" ? ev.message : "") || "流式响应错误";
      throw new AiError(`Anthropic 返回错误：${String(m).slice(0, 300)}`);
    }
    if (kind === "message_start" && typeof ev.message === "object" && ev.message?.usage) {
      inputTokens = ev.message.usage.input_tokens;
    } else if (kind === "content_block_delta" && ev.delta?.type === "text_delta" && typeof ev.delta.text === "string") {
      text += ev.delta.text;
    } else if (kind === "message_delta") {
      if (typeof ev.delta?.stop_reason === "string") stopReason = ev.delta.stop_reason;
      if (typeof ev.usage?.output_tokens === "number") outputTokens = ev.usage.output_tokens;
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).replace(/\r$/, "");
      buf = buf.slice(nl + 1);
      if (line.startsWith("event:")) currentEvent = line.slice(6).trim();
      else if (line.startsWith("data:")) handleData(line.slice(5));
      else if (line === "") currentEvent = "";
    }
  }
  if (buf.startsWith("data:")) handleData(buf.slice(5));
  return { text, stopReason, inputTokens, outputTokens };
}

export async function anthropicJsonWith(
  model: string,
  req: JsonRequest,
  opts: { apiKey: string; fetcher?: typeof fetch; url?: string },
) {
  const url = opts.url ?? proxyUrl("anthropic", "/v1/messages");
  const fetcher = opts.fetcher ?? aiFetch;
  const attempts = [buildAnthropicBody(model, req), buildAnthropicBody(model, req, { omitOutputConfig: true })];
  let r!: Response;
  for (let i = 0; i < attempts.length; i++) {
    const { betas, ...wireBody } = attempts[i];
    r = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: anthropicHeaders(opts.apiKey, betas),
        body: JSON.stringify({ ...wireBody, stream: true }),
        signal: req.signal,
      },
      120_000,
      "Anthropic",
      fetcher,
    );
    if (r.ok) break;
    if ((r.status === 400 || r.status === 422) && i === 0) continue;
    throw await mapAnthropicHttpError(r, model);
  }
  const parsed = await consumeAnthropicStream(r);
  recordAiUsage({ provider: "anthropic", model, promptTokens: parsed.inputTokens, completionTokens: parsed.outputTokens });
  if (parsed.stopReason === "refusal") throw new AiError("Anthropic 拒绝了这个请求");
  if (parsed.stopReason === "max_tokens") throw new AiError("Anthropic 的输出太长被截断了，试试少放一些内容");
  return parseJson(parsed.text, "Anthropic");
}

async function anthropicJson(model: string, req: JsonRequest, c: AiConfig = getAiConfig()) {
  return anthropicJsonWith(model, req, { apiKey: key("anthropic", c) });
}

async function geminiJson(model: string, req: JsonRequest, c: AiConfig = getAiConfig()) {
  const { geminiJsonWith } = await import("./gemini");
  return geminiJsonWith(model, req, { apiKey: key("gemini", c), geminiBaseUrl: c.geminiBaseUrl });
}

/** A JSON answer from one text service with the given settings. */
function providerJson(provider: TextProvider, model: string, req: JsonRequest, c: AiConfig = getAiConfig()) {
  if (provider === "anthropic") return anthropicJson(model, req, c);
  if (provider === "gemini") return geminiJson(model, req, c);
  return openaiJson(provider, model, req, c);
}

/* ---------- jobs ---------- */

/** Ask the service set for a job (识图 or 文本) for a JSON answer. */
export async function aiJson<T>(job: "vision" | "text", req: JsonRequest): Promise<T> {
  await needProxy();
  const c = getAiConfig();
  const { provider, model } = c[job];
  return providerJson(provider, model, req, c) as Promise<T>;
}

/** Model ids a service offers (for the model field's suggestions). */
export async function listModels(provider: TextProvider, cfg?: AiConfig): Promise<string[]> {
  await needProxy();
  const c = cfg ?? getAiConfig();
  if (provider === "anthropic") {
    const r = await fetchWithTimeout(
      proxyUrl("anthropic", "/v1/models?limit=100"),
      { headers: anthropicHeaders(key("anthropic", c)) },
      30_000,
      "Anthropic",
    );
    if (!r.ok) throw await mapAnthropicHttpError(r);
    const j = (await r.json()) as { data?: Array<{ id: string }> };
    return (j.data ?? []).map((m) => m.id).sort();
  }
  if (provider === "gemini") {
    const { listGeminiModels } = await import("./gemini");
    return listGeminiModels({ apiKey: key("gemini", c), geminiBaseUrl: c.geminiBaseUrl });
  }
  const url = provider === "openai" ? resolveOpenAiEndpoint(c.openaiBaseUrl, "/models") : proxyUrl(provider, `${CHAT_BASE[provider]}/models`);
  const r = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${key(provider, c)}` } }, 30_000, NAMES[provider]);
  if (!r.ok) throw await errorFrom(r, NAMES[provider]);
  const j = await r.json();
  return ((j.data ?? []) as { id: string }[]).map((m) => m.id).sort();
}

/**
 * Verify a text service for real: read its model list, then always ask the model in use (or the service's default)
 * for `{"ok":true}` as structured JSON. Anything else is a failure and throws; a model list alone never counts.
 * With a custom OpenAI / Gemini base URL the list may be missing (relays often do not expose `/models`): the JSON
 * probe then decides. `cfgOverride` tests settings that are not saved yet (the 1 步 wizard).
 */
export async function testTextProvider(
  provider: TextProvider,
  cfgOverride?: AiConfig,
): Promise<{ models: string[]; probeOk: boolean; compatMode?: string; model: string }> {
  await needProxy();
  const c = cfgOverride ?? getAiConfig();
  const customBase = (provider === "openai" && !!c.openaiBaseUrl) || (provider === "gemini" && !!c.geminiBaseUrl);
  let models: string[] = [];
  let listErr: unknown = null;
  try {
    models = await listModels(provider, c);
  } catch (e) {
    if (!customBase) throw e;
    listErr = e;
  }
  const activeModel = c.text.provider === provider ? c.text.model : c.vision.provider === provider ? c.vision.model : "";
  const pickCatalogModel = (list: string[], preferred: string) => {
    if (!list.length || list.includes(preferred)) return preferred;
    if (provider === "gemini") {
      const preset = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-3.5-flash-lite", "gemini-3.8-flash"].find((m) => list.includes(m));
      if (preset) return preset;
    }
    return list.find((m) => !/-image\b|^imagen-|tts|whisper|embed/i.test(m)) ?? list[0];
  };
  const rawTarget = activeModel.trim() || DEFAULT_MODELS[provider];
  // When probing an inactive service or a fresh 1-step wizard default, prefer a model actually present in its catalog
  const canAdaptModel = !activeModel.trim() || (Boolean(cfgOverride) && rawTarget === DEFAULT_MODELS[provider]);
  const targetModel = canAdaptModel ? pickCatalogModel(models, rawTarget) : rawTarget;
  const probeReq: JsonRequest = {
    system: "Return JSON only.",
    text: 'Reply with {"ok":true}',
    schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false },
    schemaName: "ping",
    // reasoning models (OpenAI gpt-5 / o-series, OpenRouter's thinking models) spend part of the budget thinking
    maxTokens: provider === "openai" || provider === "openrouter" ? 1024 : 64,
  };
  const res = await providerJson(provider, targetModel, probeReq, c);
  if ((res as { ok?: unknown } | null)?.ok !== true) {
    throw new AiError(`${NAMES[provider]} 能连上，但模型 ${targetModel} 没有按要求返回 {"ok":true}，请换一个支持结构化 JSON 输出的模型`);
  }
  let compatMode: string | undefined;
  if (provider === "gemini") compatMode = (await import("./gemini")).geminiCompatModeFor(c.geminiBaseUrl, targetModel, probeReq.schemaName);
  else if (provider !== "anthropic") compatMode = compatModeCache.get(`${provider}|${c.openaiBaseUrl ?? ""}|${targetModel}`);
  return { models: listErr ? [] : models, probeOk: true, compatMode, model: targetModel };
}

const bytesOf = (b64: string) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

/** One square picture from OpenRouter's image API (any of its image models); the answer names its own format. */
async function openrouterImage(model: string, prompt: string, signal?: AbortSignal): Promise<Blob> {
  const r = await fetchWithTimeout(
    proxyUrl("openrouter", "/api/v1/images"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key("openrouter")}` },
      // quality is ignored by the models that have no such setting
      body: JSON.stringify({ model, prompt, n: 1, aspect_ratio: "1:1", quality: "low" }),
      signal,
    },
    90_000,
    "OpenRouter 图片",
  );
  if (!r.ok) throw await errorFrom(r, "OpenRouter 图片");
  const j = await r.json();
  if (j.error) throw new AiError(`OpenRouter 图片返回错误：${String(j.error.message ?? j.error.code ?? "未知错误").slice(0, 300)}`);
  const img = j.data?.[0];
  if (!img?.b64_json) throw new AiError("OpenRouter 没有返回图片");
  return new Blob([bytesOf(img.b64_json)], { type: img.media_type || "image/png" });
}

/** Image model ids OpenRouter offers (its own list: the chat model list does not have them all). */
export async function listImageModels(cfg?: AiConfig): Promise<string[]> {
  await needProxy();
  const c = cfg ?? getAiConfig();
  const r = await fetchWithTimeout(proxyUrl("openrouter", "/api/v1/images/models"), { headers: { Authorization: `Bearer ${key("openrouter", c)}` } }, 30_000, "OpenRouter");
  if (!r.ok) throw await errorFrom(r, "OpenRouter");
  const j = await r.json();
  return ((j.data ?? []) as { id: string }[]).map((m) => m.id).sort();
}

/** One picture from the service set for pictures (OpenAI images, Gemini or OpenRouter); returns the image bytes as a Blob. */
export async function generateImage(prompt: string, signal?: AbortSignal): Promise<Blob> {
  await needProxy();
  const c = getAiConfig();
  const { provider, model } = c.image;
  if (provider === "openrouter") return openrouterImage(model, prompt, signal);
  if (provider === "gemini") {
    const { geminiGenerateImage } = await import("./gemini");
    return geminiGenerateImage(model, prompt, { apiKey: key("gemini", c), geminiBaseUrl: c.geminiBaseUrl, signal });
  }
  const body: Record<string, unknown> = { model, prompt, n: 1, size: "1024x1024" };
  if (/^gpt-image/.test(model)) body.quality = "low";
  else body.response_format = "b64_json";
  const r = await fetchWithTimeout(
    resolveOpenAiEndpoint(c.openaiBaseUrl, "/images/generations"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key("openai")}` },
      body: JSON.stringify(body),
      signal,
    },
    90_000,
    "OpenAI 图片",
  );
  if (!r.ok) throw await errorFrom(r, "OpenAI 图片");
  const j = await r.json();
  const b64 = j.data?.[0]?.b64_json;
  if (!b64) throw new AiError("OpenAI 没有返回图片");
  return new Blob([bytesOf(b64)], { type: "image/png" });
}

/* ---------- Whisper-compatible Speech to Text ---------- */

function extFromMime(mime: string): string {
  const t = mime.toLowerCase();
  if (t.includes("mp4") || t.includes("m4a")) return "mp4";
  if (t.includes("ogg")) return "ogg";
  if (t.includes("wav")) return "wav";
  if (t.includes("mpeg") || t.includes("mp3")) return "mp3";
  return "webm";
}

/** Verbatim French learner speech prompt so Whisper keeps hesitations, repetitions, and grammar errors unedited. */
export const LEARNER_FRENCH_STT_PROMPT =
  "Transcription fidèle mot à mot d'un candidat francophone non natif (DELF B2), en conservant les hésitations, faux départs, répétitions et erreurs grammaticales éventuelles sans les corriger : euh, donc, à mon avis, d'une part, en fait...";

/** Transcribe recorded French speech using OpenAI / Whisper-compatible `/audio/transcriptions`. */
export async function transcribeAudio(blob: Blob, signal?: AbortSignal): Promise<string> {
  await needProxy();
  const c = getAiConfig();
  let url: string;
  let apiKey: string;
  const model = c.stt.model || "whisper-1";
  if (c.stt.provider === "openai") {
    apiKey = key("openai");
    url = resolveOpenAiEndpoint(c.openaiBaseUrl, "/audio/transcriptions");
  } else if (c.stt.provider === "custom") {
    if (!c.stt.baseUrl) throw new AiError("还没有填 Whisper 接口地址");
    if (!c.stt.apiKey) throw new AiError("还没有填 Whisper 接口 Key");
    apiKey = c.stt.apiKey;
    url = resolveOpenAiEndpoint(c.stt.baseUrl, "/audio/transcriptions");
  } else {
    throw new AiError("还没有开启 Whisper 语音转写服务（在「我的 → AI 接口」里设置）");
  }
  const fd = new FormData();
  fd.append("file", blob, `recording.${extFromMime(blob.type)}`);
  fd.append("model", model);
  fd.append("language", "fr");
  fd.append("prompt", LEARNER_FRENCH_STT_PROMPT);
  fd.append("response_format", "json");
  const r = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fd,
      signal,
    },
    60_000,
    "Whisper 语音转写",
  );
  if (!r.ok) throw await errorFrom(r, "Whisper 语音转写");
  const j = (await r.json()) as { text?: unknown };
  recordAiUsage({ provider: "whisper", model });
  return typeof j?.text === "string" ? j.text.trim() : "";
}

/* ---------- Tier-2 Multimodal Audio Oral Transcription (Gemini / OpenRouter) ---------- */

export const MULTIMODAL_AUDIO_STT_SYSTEM =
  "Tu es un moteur de transcription acoustique français strict (DELF / TCF / TEF). Transcris MOT À MOT exactement ce que dit le candidat en français, en conservant toutes les hésitations (euh, ben, bah), répétitions, faux départs et fautes grammaticales ou lexicales SANS JAMAIS les corriger ni reformuler. Si l'audio est silencieux ou vide, renvoie une chaîne vide. Réponds uniquement en JSON valide : {\"text\": \"...\"}.";

/** True when `model` accepts native audio input (`google/gemini-*`, `gemini-*`, `gpt-4o-audio*`, `gpt-audio*`, `voxtral*`). */
export function isMultimodalAudioModel(model: string): boolean {
  const m = model.trim().toLowerCase();
  if (!m) return false;
  if (/(?:^|\/)gemini-(?:1\.5|2|2\.5|3|flash|pro)/i.test(m)) return true;
  if (/(?:^|\/)gpt-4o(?:-[a-z0-9-]+)?-audio/i.test(m) || /(?:^|\/)gpt-audio/i.test(m)) return true;
  if (/(?:^|\/)(?:voxtral|qwen2?-audio|phi-4-multimodal)/i.test(m)) return true;
  return false;
}

type MultimodalAudioRoute =
  | { kind: "gemini"; apiKey: string; model: string }
  | { kind: "openrouter"; apiKey: string; model: string }
  | { kind: "openai"; apiKey: string; model: string; baseUrl: string };

/** The audio route of one job's service, if it can listen. */
function jobAudioRoute(cfg: AiConfig, job: { provider: string; model: string }): MultimodalAudioRoute | null {
  const k = (p: keyof AiConfig["keys"]) => (cfg.keys[p] ?? "").trim();
  if (job.provider === "gemini" && k("gemini")) return { kind: "gemini", apiKey: k("gemini"), model: normalizeGeminiModel(job.model) };
  if (job.provider === "openrouter" && k("openrouter") && isMultimodalAudioModel(job.model)) return { kind: "openrouter", apiKey: k("openrouter"), model: job.model.trim() };
  if (job.provider === "openai" && k("openai") && isMultimodalAudioModel(job.model)) return { kind: "openai", apiKey: k("openai"), model: job.model.trim(), baseUrl: cfg.openaiBaseUrl };
  return null;
}

/**
 * Where recorded speech goes for native audio transcription: the service chosen for 文本, then for 识图 (when it can
 * listen), and only then a Gemini key that is filled in but not chosen for either job (its default model).
 */
function resolveMultimodalAudioRoute(cfg: AiConfig): MultimodalAudioRoute | null {
  const route = jobAudioRoute(cfg, cfg.text) ?? jobAudioRoute(cfg, cfg.vision);
  if (route) return route;
  const geminiKey = (cfg.keys.gemini ?? "").trim();
  return geminiKey ? { kind: "gemini", apiKey: geminiKey, model: DEFAULT_MODELS.gemini } : null;
}

/** True when Gemini (`keys.gemini`) or an audio-capable OpenRouter/OpenAI model is configured for native audio STT. */
export function canTranscribeMultimodalAudio(cfg: AiConfig = getAiConfig()): boolean {
  return resolveMultimodalAudioRoute(cfg) !== null;
}

function normalizeAudioMime(mime: string): { mimeType: string; format: string } {
  const t = mime.toLowerCase().split(";")[0].trim();
  if (t.includes("wav")) return { mimeType: "audio/wav", format: "wav" };
  if (t.includes("mpeg") || t.includes("mp3")) return { mimeType: "audio/mpeg", format: "mp3" };
  if (t.includes("ogg")) return { mimeType: "audio/ogg", format: "ogg" };
  if (t.includes("mp4") || t.includes("m4a") || t.includes("aac")) return { mimeType: "audio/mp4", format: "m4a" };
  if (t.includes("flac")) return { mimeType: "audio/flac", format: "flac" };
  return { mimeType: "audio/webm", format: "webm" };
}

function estimateWavDurationSec(bytes: Uint8Array, mime: string): number {
  if (!mime.toLowerCase().includes("wav") || bytes.byteLength <= 44) return 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riff = view.getUint32(0, false);
  if (riff !== 0x52494646) return 0;
  const byteRate = view.getUint32(28, true);
  return byteRate > 0 ? (bytes.byteLength - 44) / byteRate : 0;
}

function encodeBytesBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** Synthesize monotonic proportional word timestamps across `durationSec` when an audio LLM returns plain text only. */
export function synthesizeProportionalWords(
  text: string,
  durationSec: number,
): { word: string; startSec: number; endSec: number }[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const totalSec = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : Math.max(0.8, tokens.length * 0.42);
  const weights = tokens.map((tok) => Math.max(1.5, tok.replace(/[^\p{L}\p{N}]/gu, "").length));
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
  const gapTotal = tokens.length > 1 ? totalSec * 0.12 : 0;
  const gapEach = tokens.length > 1 ? gapTotal / (tokens.length - 1) : 0;
  const phonationTotal = Math.max(0.2, totalSec - gapTotal);

  let cursor = 0;
  return tokens.map((word, idx) => {
    const dur = phonationTotal * (weights[idx] / weightSum);
    const startSec = Math.round(cursor * 1000) / 1000;
    const endSec = Math.round((cursor + dur) * 1000) / 1000;
    cursor += dur + gapEach;
    return { word: word.slice(0, 60), startSec, endSec: Math.max(startSec, endSec) };
  });
}

function extractMultimodalTranscriptPayload(rawText: string): {
  text: string;
  words?: { word: string; startSec: number; endSec: number }[];
} {
  const cleaned = rawText.trim().replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  if (!cleaned) return { text: "" };
  const tryParse = (candidate: string): Record<string, unknown> | null => {
    try {
      const parsed: unknown = JSON.parse(candidate);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  let obj = tryParse(cleaned);
  if (!obj) {
    const a = cleaned.indexOf("{");
    const b = cleaned.lastIndexOf("}");
    if (a >= 0 && b > a) obj = tryParse(cleaned.slice(a, b + 1));
  }
  if (!obj) return { text: cleaned };

  const text = typeof obj.text === "string" ? obj.text.trim() : typeof obj.transcript === "string" ? obj.transcript.trim() : "";
  if (Array.isArray(obj.words)) {
    const parsedWords: { word: string; startSec: number; endSec: number }[] = [];
    for (const item of obj.words) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      const w = typeof rec.word === "string" ? rec.word.trim().slice(0, 60) : "";
      const s = typeof rec.startSec === "number" ? rec.startSec : typeof rec.start === "number" ? rec.start : NaN;
      const e = typeof rec.endSec === "number" ? rec.endSec : typeof rec.end === "number" ? rec.end : NaN;
      if (w && Number.isFinite(s) && Number.isFinite(e) && s >= 0 && e >= s) {
        parsedWords.push({ word: w, startSec: s, endSec: e });
      }
    }
    if (parsedWords.length > 0) return { text: text || parsedWords.map((x) => x.word).join(" "), words: parsedWords };
  }
  return { text };
}

/**
 * Tier-2 native multimodal audio verbatim French transcription (`temperature: 0`),
 * preserving hesitations (`euh`) and learner grammar errors without auto-correction.
 */
export async function transcribeViaMultimodalAudio(
  blob: Blob,
  signal?: AbortSignal,
  opts?: { durationSec?: number; cfg?: AiConfig; fetcher?: typeof fetch },
): Promise<{ text: string; words: { word: string; startSec: number; endSec: number }[] }> {
  const cfg = opts?.cfg ?? getAiConfig();
  const route = resolveMultimodalAudioRoute(cfg);
  if (!route) {
    throw new AiError("尚未配置支持原生音频转写的 Gemini 或 OpenRouter 多模态模型（在「我的 → AI 接口」里设置）");
  }
  if (!opts?.fetcher && (route.kind !== "gemini" || !cfg.geminiBaseUrl)) await needProxy();

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const b64 = encodeBytesBase64(bytes);
  const { mimeType, format } = normalizeAudioMime(blob.type);
  const effectiveDuration =
    opts?.durationSec && opts.durationSec > 0 ? opts.durationSec : estimateWavDurationSec(bytes, blob.type);
  const fetcher = opts?.fetcher ?? aiFetch;
  const userInstruction =
    "Transcris cet enregistrement oral français mot à mot, en gardant les hésitations (euh, ben) et sans corriger aucune erreur grammaticale. Réponds uniquement avec {\"text\": \"...\"}.";

  if (route.kind === "gemini") {
    const { geminiTranscribeAudio } = await import("./gemini");
    const rawOut = await geminiTranscribeAudio(
      route.model,
      { mimeType, data: b64 },
      { system: MULTIMODAL_AUDIO_STT_SYSTEM, text: userInstruction },
      { apiKey: route.apiKey, geminiBaseUrl: cfg.geminiBaseUrl, fetcher: opts?.fetcher, signal },
    );
    const extracted = extractMultimodalTranscriptPayload(rawOut);
    return {
      text: extracted.text,
      words: extracted.words ?? synthesizeProportionalWords(extracted.text, effectiveDuration),
    };
  }

  const endpointUrl =
    route.kind === "openai"
      ? resolveOpenAiEndpoint(route.baseUrl, "/chat/completions")
      : proxyUrl("openrouter", `${CHAT_BASE.openrouter}/chat/completions`);
  const serviceLabel = NAMES[route.kind];
  const r = await fetchWithTimeout(
    endpointUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${route.apiKey}`,
      },
      body: JSON.stringify({
        model: route.model,
        temperature: 0,
        messages: [
          { role: "system", content: MULTIMODAL_AUDIO_STT_SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: userInstruction },
              { type: "input_audio", input_audio: { data: b64, format } },
            ],
          },
        ],
      }),
      signal,
    },
    90_000,
    serviceLabel,
    fetcher,
  );
  if (!r.ok) throw await errorFrom(r, serviceLabel);
  const j = (await r.json()) as {
    error?: { message?: string; code?: string | number };
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (j.error) {
    throw new AiError(`${serviceLabel} 音频转写返回错误：${String(j.error.message ?? j.error.code ?? "未知错误").slice(0, 300)}`);
  }
  recordAiUsage({
    provider: route.kind,
    model: route.model,
    promptTokens: j.usage?.prompt_tokens,
    completionTokens: j.usage?.completion_tokens,
  });
  const extracted = extractMultimodalTranscriptPayload(j.choices?.[0]?.message?.content ?? "");
  return {
    text: extracted.text,
    words: extracted.words ?? synthesizeProportionalWords(extracted.text, effectiveDuration),
  };
}

/* ---------- Azure AI Speech ---------- */

/** Send a complete SSML <speak> document to Azure AI Speech and return MP3 audio. */
export async function azureSpeakSsml(ssml: string, signal?: AbortSignal): Promise<Blob> {
  await needProxy();
  const c = getAiConfig();
  if (!c.azureRegion) throw new AiError("还没有填 Azure 语音服务的区域");
  const r = await fetchWithTimeout(
    proxyUrl("azure", `/${c.azureRegion}/cognitiveservices/v1`),
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key("azure"),
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      },
      body: ssml,
      signal,
    },
    45_000,
    "Azure 语音",
  );
  if (!r.ok) throw await errorFrom(r, "Azure 语音");
  return new Blob([await r.arrayBuffer()], { type: "audio/mpeg" });
}

/** French speech for a text (MP3), wrapped in <prosody> and natural <break> SSML. */
export async function azureSpeak(text: string, voice = getAiConfig().azureVoice, signal?: AbortSignal, opts?: SsmlOptions): Promise<Blob> {
  return azureSpeakSsml(buildVoiceSsml(text, voice, opts), signal);
}

export interface AzureVoice {
  ShortName: string;
  LocalName: string;
  Gender: string;
  Locale: string;
}

/** French voices of the region (and multilingual voices that speak French). */
export async function azureVoices(): Promise<AzureVoice[]> {
  await needProxy();
  const c = getAiConfig();
  if (!c.azureRegion) throw new AiError("还没有填 Azure 语音服务的区域");
  const r = await fetchWithTimeout(proxyUrl("azure", `/${c.azureRegion}/cognitiveservices/voices/list`), { headers: { "Ocp-Apim-Subscription-Key": key("azure") } }, 30_000, "Azure 语音");
  if (!r.ok) throw await errorFrom(r, "Azure 语音");
  const all = (await r.json()) as (AzureVoice & { SecondaryLocaleList?: string[] })[];
  return all.filter((v) => v.Locale.startsWith("fr-") || (v.SecondaryLocaleList ?? []).some((l) => l.startsWith("fr-")));
}
