/**
 * Calls to the AI services: through the local forwarder (ai-proxy.ts) under npm run dev / preview, directly on a
 * static deployment and in the Android app (see proxy.ts):
 *  - OpenAI, DeepSeek and OpenRouter: chat completions (OpenAI-format JSON); OpenAI and OpenRouter also images
 *  - Anthropic: the official SDK, structured JSON output
 *  - Azure AI Speech: text to speech (SSML) and the voice list
 */
import type Anthropic from "@anthropic-ai/sdk";
import { getAiConfig, type TextProvider } from "./config";
import { AiError, aiFetch, errorFrom, proxyAvailable, proxyUrl } from "./proxy";
import { buildVoiceSsml, type SsmlOptions } from "./ssml";

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
}

const NAMES: Record<string, string> = { openai: "OpenAI", deepseek: "DeepSeek", anthropic: "Anthropic", openrouter: "OpenRouter", azure: "Azure 语音" };

type ChatProvider = "openai" | "deepseek" | "openrouter";
/** Where each OpenAI-format service keeps its endpoints. */
const CHAT_BASE: Record<ChatProvider, string> = { openai: "/v1", deepseek: "", openrouter: "/api/v1" };

/** Settles where requests go (forwarder or direct) before the first one is built. */
async function needProxy() {
  await proxyAvailable();
}

function key(service: keyof ReturnType<typeof getAiConfig>["keys"]) {
  const k = getAiConfig().keys[service];
  if (!k) throw new AiError(`还没有填 ${NAMES[service]} 的 Key（在「我的 → AI 接口」里填）`);
  return k;
}

function parseJson(text: string, service: string) {
  const t = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf("{");
    const b = t.lastIndexOf("}");
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(t.slice(a, b + 1));
      } catch {
        /* fall through */
      }
    }
    throw new AiError(`${service} 返回的不是有效的 JSON（可能输出太长被截断，试试少放一些内容）`);
  }
}

/* ---------- OpenAI / DeepSeek / OpenRouter ---------- */

/** Reasoning models (OpenAI o-series / gpt-5*, DeepSeek reasoner/R1, thinking variants) reject temperature != 1. */
export function supportsTemperature(model: string): boolean {
  const m = model.trim().toLowerCase();
  if (/(?:^|\/)(?:o\d|gpt-5(?!-chat))/i.test(m)) return false;
  if (/reasoner|deepseek-r1|qwq|[-/:]thinking\b/i.test(m)) return false;
  return true;
}

export function buildOpenAiChatBody(provider: ChatProvider, model: string, req: JsonRequest): Record<string, unknown> {
  const parts: unknown[] = [{ type: "text", text: req.text }];
  for (const a of req.attachments ?? []) {
    if (provider === "deepseek") throw new AiError("DeepSeek 不能看图片或 PDF，请在设置里把「识图」换成 OpenAI 或 Anthropic");
    if (a.mime === "application/pdf") parts.push({ type: "file", file: { filename: a.name || "document.pdf", file_data: `data:application/pdf;base64,${a.data}` } });
    else parts.push({ type: "image_url", image_url: { url: `data:${a.mime};base64,${a.data}`, detail: "high" } });
  }
  const temp = supportsTemperature(model) ? (req.temperature ?? 0) : undefined;
  return provider === "openai"
    ? {
        model,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: parts },
        ],
        response_format: { type: "json_schema", json_schema: { name: req.schemaName, strict: true, schema: req.schema } },
        max_completion_tokens: req.maxTokens ?? 16000,
        ...(temp !== undefined ? { temperature: temp } : {}),
      }
    : {
        model,
        // DeepSeek takes json_object only, and OpenRouter's models differ in what they accept: the schema goes
        // into the instructions (OpenRouter drops response_format for a model that has no JSON mode)
        messages: [
          { role: "system", content: `${req.system}\n\nAnswer with one JSON object only, following this JSON schema exactly:\n${JSON.stringify(req.schema)}` },
          { role: "user", content: provider === "openrouter" && parts.length > 1 ? parts : req.text },
        ],
        response_format: { type: "json_object" },
        max_tokens: provider === "deepseek" ? Math.min(req.maxTokens ?? 8000, 8000) : (req.maxTokens ?? 16000),
        ...(temp !== undefined ? { temperature: temp } : {}),
      };
}

async function openaiJson(provider: ChatProvider, model: string, req: JsonRequest) {
  const k = key(provider);
  const body = buildOpenAiChatBody(provider, model, req);
  const r = await aiFetch(proxyUrl(provider, `${CHAT_BASE[provider]}/chat/completions`), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${k}` },
    body: JSON.stringify(body),
    signal: req.signal,
  });
  if (!r.ok) throw await errorFrom(r, NAMES[provider]);
  const j = await r.json();
  // OpenRouter can answer 200 with the upstream model's error inside
  const failed = j.error ?? j.choices?.[0]?.error;
  if (failed) throw new AiError(`${NAMES[provider]} 返回错误：${String(failed.message ?? failed.code ?? "未知错误").slice(0, 300)}`);
  const choice = j.choices?.[0];
  if (choice?.message?.refusal) throw new AiError(`${NAMES[provider]} 拒绝了这个请求：${choice.message.refusal}`);
  if (choice?.finish_reason === "length") throw new AiError(`${NAMES[provider]} 的输出太长被截断了，试试少放一些内容`);
  return parseJson(choice?.message?.content ?? "", NAMES[provider]);
}

/* ---------- Anthropic ---------- */

/** The SDK is loaded on first use (it is large and only needed when Anthropic is chosen). */
const sdk = () => import("@anthropic-ai/sdk").then((m) => m.default);
const anthropic = async () => {
  const k = key("anthropic");
  const Sdk = await sdk();
  return new Sdk({ apiKey: k, baseURL: proxyUrl("anthropic"), fetch: aiFetch, dangerouslyAllowBrowser: true, maxRetries: 1 });
};

/** Server-side fallback on a refusal: offered for the Opus 5 / 5.5, Fable 5.1 and Sonnet 5.5 models. */
const hasFallback = (model: string) => /^claude-(opus-5|fable-5-1|sonnet-5-5)/.test(model);

/** The SDK's typed errors as readable messages. */
function anthropicError(e: unknown, Sdk: typeof Anthropic, model?: string) {
  if (e instanceof Sdk.AuthenticationError) return new AiError("Anthropic 返回 401（Key 不对）");
  if (e instanceof Sdk.PermissionDeniedError) return new AiError("Anthropic 返回 403（没有权限）");
  if (e instanceof Sdk.NotFoundError) return new AiError(`Anthropic 返回 404（模型名不对？${model ?? ""}）`);
  if (e instanceof Sdk.RateLimitError) return new AiError("Anthropic 返回 429（请求太频繁或额度用完）");
  if (e instanceof Sdk.APIError) return new AiError(`Anthropic 返回 ${e.status ?? "错误"}：${e.message.slice(0, 300)}`);
  return e;
}

export function buildAnthropicBody(model: string, req: JsonRequest) {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const a of req.attachments ?? []) {
    if (a.mime === "application/pdf") content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: a.data } });
    else content.push({ type: "image", source: { type: "base64", media_type: a.mime as "image/jpeg" | "image/png" | "image/webp", data: a.data } });
  }
  content.push({ type: "text", text: req.text });
  const temp = supportsTemperature(model) ? (req.temperature ?? 0) : undefined;
  return {
    model,
    max_tokens: req.maxTokens ?? 16000,
    system: req.system,
    messages: [{ role: "user" as const, content }],
    output_config: { format: { type: "json_schema" as const, schema: req.schema } },
    ...(temp !== undefined ? { temperature: temp } : {}),
    ...(hasFallback(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  };
}

async function anthropicJson(model: string, req: JsonRequest) {
  const Sdk = await sdk();
  const stream = (await anthropic()).beta.messages.stream(buildAnthropicBody(model, req), { signal: req.signal });
  let msg: Anthropic.Beta.BetaMessage;
  try {
    msg = await stream.finalMessage();
  } catch (e) {
    throw anthropicError(e, Sdk, model);
  }
  if (msg.stop_reason === "refusal") throw new AiError("Anthropic 拒绝了这个请求");
  if (msg.stop_reason === "max_tokens") throw new AiError("Anthropic 的输出太长被截断了，试试少放一些内容");
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return parseJson(text, "Anthropic");
}

/* ---------- jobs ---------- */

/** Ask the service set for a job (识图 or 文本) for a JSON answer. */
export async function aiJson<T>(job: "vision" | "text", req: JsonRequest): Promise<T> {
  await needProxy();
  const c = getAiConfig();
  const { provider, model } = c[job];
  return (provider === "anthropic" ? anthropicJson(model, req) : openaiJson(provider, model, req)) as Promise<T>;
}

/** Model ids a service offers (for the model field's suggestions). */
export async function listModels(provider: TextProvider): Promise<string[]> {
  await needProxy();
  if (provider === "anthropic") {
    const Sdk = await sdk();
    const out: string[] = [];
    try {
      for await (const m of (await anthropic()).models.list({ limit: 100 })) out.push(m.id);
    } catch (e) {
      throw anthropicError(e, Sdk);
    }
    return out;
  }
  const r = await aiFetch(proxyUrl(provider, `${CHAT_BASE[provider]}/models`), { headers: { Authorization: `Bearer ${key(provider)}` } });
  if (!r.ok) throw await errorFrom(r, NAMES[provider]);
  const j = await r.json();
  return ((j.data ?? []) as { id: string }[]).map((m) => m.id).sort();
}

const bytesOf = (b64: string) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

/** One square picture from OpenRouter's image API (any of its image models); the answer names its own format. */
async function openrouterImage(model: string, prompt: string, signal?: AbortSignal): Promise<Blob> {
  const r = await aiFetch(proxyUrl("openrouter", "/api/v1/images"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key("openrouter")}` },
    // quality is ignored by the models that have no such setting
    body: JSON.stringify({ model, prompt, n: 1, aspect_ratio: "1:1", quality: "low" }),
    signal,
  });
  if (!r.ok) throw await errorFrom(r, "OpenRouter 图片");
  const j = await r.json();
  if (j.error) throw new AiError(`OpenRouter 图片返回错误：${String(j.error.message ?? j.error.code ?? "未知错误").slice(0, 300)}`);
  const img = j.data?.[0];
  if (!img?.b64_json) throw new AiError("OpenRouter 没有返回图片");
  return new Blob([bytesOf(img.b64_json)], { type: img.media_type || "image/png" });
}

/** Image model ids OpenRouter offers (its own list: the chat model list does not have them all). */
export async function listImageModels(): Promise<string[]> {
  await needProxy();
  const r = await aiFetch(proxyUrl("openrouter", "/api/v1/images/models"), { headers: { Authorization: `Bearer ${key("openrouter")}` } });
  if (!r.ok) throw await errorFrom(r, "OpenRouter");
  const j = await r.json();
  return ((j.data ?? []) as { id: string }[]).map((m) => m.id).sort();
}

/** One picture from the service set for pictures (OpenAI images or OpenRouter); returns the image bytes as a Blob. */
export async function generateImage(prompt: string, signal?: AbortSignal): Promise<Blob> {
  await needProxy();
  const { provider, model } = getAiConfig().image;
  if (provider === "openrouter") return openrouterImage(model, prompt, signal);
  const body: Record<string, unknown> = { model, prompt, n: 1, size: "1024x1024" };
  if (/^gpt-image/.test(model)) body.quality = "low";
  else body.response_format = "b64_json";
  const r = await aiFetch(proxyUrl("openai", "/v1/images/generations"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key("openai")}` },
    body: JSON.stringify(body),
    signal,
  });
  if (!r.ok) throw await errorFrom(r, "OpenAI 图片");
  const j = await r.json();
  const b64 = j.data?.[0]?.b64_json;
  if (!b64) throw new AiError("OpenAI 没有返回图片");
  return new Blob([bytesOf(b64)], { type: "image/png" });
}

/* ---------- Azure AI Speech ---------- */

/** Send a complete SSML <speak> document to Azure AI Speech and return MP3 audio. */
export async function azureSpeakSsml(ssml: string, signal?: AbortSignal): Promise<Blob> {
  await needProxy();
  const c = getAiConfig();
  if (!c.azureRegion) throw new AiError("还没有填 Azure 语音服务的区域");
  const r = await aiFetch(proxyUrl("azure", `/${c.azureRegion}/cognitiveservices/v1`), {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key("azure"),
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
    },
    body: ssml,
    signal,
  });
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
  const r = await aiFetch(proxyUrl("azure", `/${c.azureRegion}/cognitiveservices/voices/list`), { headers: { "Ocp-Apim-Subscription-Key": key("azure") } });
  if (!r.ok) throw await errorFrom(r, "Azure 语音");
  const all = (await r.json()) as (AzureVoice & { SecondaryLocaleList?: string[] })[];
  return all.filter((v) => v.Locale.startsWith("fr-") || (v.SecondaryLocaleList ?? []).some((l) => l.startsWith("fr-")));
}
