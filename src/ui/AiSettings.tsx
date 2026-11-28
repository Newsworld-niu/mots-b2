import { Check, ChevronDown, Eye, EyeOff, Sparkles, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { azureSpeak, azureVoices, listImageModels, listModels, testTextProvider, type AzureVoice } from "../ai/clients";
import {
  DEFAULT_IMAGE_MODELS,
  DEFAULT_MODELS,
  GEMINI_IMAGE_MODELS,
  GEMINI_PRESET_MODELS,
  GRADING_RECOMMENDED_MODELS,
  IMAGE_PROVIDERS,
  ready,
  sanitizeAiConfig,
  sanitizeBaseUrl,
  STT_PROVIDERS,
  TEXT_PROVIDERS,
  VISION_PROVIDERS,
  confirmSyncedBaseUrl,
  getAiConfig,
  setAiConfig,
  useAiConfig,
  useUnconfirmedBaseUrls,
  type AiConfig,
  type UnconfirmedEndpointKind,
  type SttProvider,
  type TextProvider,
} from "../ai/config";
import { normalizeGeminiModel, proxyAvailable } from "../ai/proxy";
import { clearTtsCache, ttsCacheSize } from "../ai/tts";
import { resetAiUsage, useAiUsage } from "../ai/usage";
import { isSyncConfigured } from "../sync/api";
import { AiSyncControls } from "./AiSyncControls";
import { toast } from "./Toast";

const STT_LABEL: Record<SttProvider, string> = { none: "关闭", openai: "复用 OpenAI", custom: "自定义 Whisper 接口" };

/** Short names for the segmented buttons (they must wrap cleanly at 390 px). */
const LABEL: Record<TextProvider, string> = { openai: "OpenAI", deepseek: "DeepSeek", anthropic: "Anthropic", gemini: "Gemini", openrouter: "OpenRouter" };
/** Full names for titles and messages. */
const TITLE: Record<TextProvider, string> = { ...LABEL, gemini: "Google Gemini" };

const BASE_URL_HINT = "须以 https:// 开头，或本机 http://localhost / 127.0.0.1 地址";

const ENDPOINT_LABEL: Record<UnconfirmedEndpointKind, string> = { openai: "OpenAI 兼容接口", gemini: "Gemini 接口", stt: "Whisper 语音转写接口" };

/**
 * Cloud sync changed a custom base URL while this device keeps its own key for it: nothing is sent there with that
 * key until the learner trusts the address here (or runs 测试连接 / edits the address or key).
 */
function UnconfirmedEndpoints({ c }: { c: AiConfig }) {
  const pending = useUnconfirmedBaseUrls();
  const current: Record<UnconfirmedEndpointKind, string> = { openai: c.openaiBaseUrl, gemini: c.geminiBaseUrl, stt: c.stt.baseUrl };
  const items = (Object.keys(pending) as UnconfirmedEndpointKind[]).filter((k) => pending[k] && pending[k] === current[k]);
  if (!items.length) return null;
  return (
    <div className="ai-endpoint-confirms">
      {items.map((kind) => (
        <div className="ai-endpoint-confirm" role="alert" key={kind}>
          <p>
            云同步更新了{ENDPOINT_LABEL[kind]}的自定义地址（<code>{pending[kind]}</code>），为保护本机原有 Key，确认无误后请点击启用。
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              confirmSyncedBaseUrl(kind);
              toast("已信任并启用该接口地址", "ok");
            }}
          >
            信任并启用
          </button>
        </div>
      ))}
    </div>
  );
}

function KeyField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <label className="wf-field">
      <span>{label}</span>
      <div className="ai-key">
        <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" spellCheck={false} />
        <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? "隐藏 Key" : "显示 Key"}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </label>
  );
}

/** What a service's model list depends on: the service, its key and (OpenAI / Gemini) its custom base URL. */
const listSig = (p: TextProvider, c: AiConfig = getAiConfig()) => `${p}|${c.keys[p]}|${p === "openai" ? c.openaiBaseUrl : p === "gemini" ? c.geminiBaseUrl : ""}`;

/** Lists already read during this visit, per list signature, so that reopening the settings shows them at once. */
const known: { models: Record<string, string[]>; image: Record<string, string[]> } = { models: {}, image: {} };

/** Forget the model lists read so far (UI tests). */
export function resetKnownModelsForTest() {
  known.models = {};
  known.image = {};
}

/** The models each service offers: read quietly for the services in use, and by 测试连接 (which also reports). */
function useModels() {
  // the lists live in `known`; this only re-renders when one arrives
  const [, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const [testing, setTesting] = useState<TextProvider | null>(null);
  const [loading, setLoading] = useState<string[]>([]);
  const pending = useRef(new Set<string>());

  const store = useCallback(
    (p: TextProvider, sig: string, list: string[], cfgForImages?: AiConfig) => {
      known.models = { ...known.models, [sig]: list };
      bump();
      if (p === "openrouter") {
        const refCfg = cfgForImages ?? getAiConfig();
        const imgSig = `openrouter|${refCfg.keys.openrouter}`;
        void listImageModels(refCfg).then(
          (l) => {
            known.image = { ...known.image, [imgSig]: l };
            bump();
          },
          () => undefined,
        );
      }
    },
    [bump],
  );

  /** Read a service's list if it has a key and the list is not here yet; failures stay silent (测试连接 explains them). */
  const ensure = useCallback(
    (p: TextProvider) => {
      const c = getAiConfig();
      const sig = listSig(p, c);
      if (known.models[sig] || pending.current.has(sig) || !c.keys[p]) return;
      pending.current.add(sig);
      setLoading([...pending.current]);
      // a late answer is kept under the signature it was asked for, so it never stands in for newer settings
      void listModels(p, c)
        .then((list) => store(p, sig, list, c))
        .catch(() => undefined)
        .finally(() => {
          pending.current.delete(sig);
          setLoading([...pending.current]);
        });
    },
    [store],
  );

  /** Test a service (with the saved settings, or `cfg` before saving). Never throws; the toast reports. */
  const test = async (
    p: TextProvider,
    cfg?: AiConfig,
    quiet = false,
    opts?: { candidateOnly?: boolean },
  ): Promise<{ ok: true; note: string; model: string; requestedModel: string } | { ok: false; error: string }> => {
    setTesting(p);
    const c = cfg ?? getAiConfig();
    // 测试连接 in 高级配置 confirms the exact saved address being tested; an unsaved wizard candidate only probes itself
    // without unlocking an unrelated saved unconfirmed address if the probe fails.
    if (!opts?.candidateOnly) {
      if (p === "openai") confirmSyncedBaseUrl("openai", c.openaiBaseUrl);
      if (p === "gemini") confirmSyncedBaseUrl("gemini", c.geminiBaseUrl);
    }
    try {
      const res = await testTextProvider(p, cfg, { trustBaseUrl: opts?.candidateOnly });
      if (res.models.length) store(p, listSig(p, c), res.models, c);
      const modeHint = res.compatMode && res.compatMode !== "strict" && res.compatMode !== "json_schema" ? ` · 已自动适配 ${res.compatMode} 兼容协议` : "";
      const adapted = res.model && res.requestedModel && res.model !== res.requestedModel ? ` · 已自动匹配可用模型 ${res.model}` : "";
      const note = `${res.models.length ? `读取 ${res.models.length} 个模型` : "结构化 JSON 探活通过"}${modeHint}${adapted}`;
      if (!quiet) toast(`${TITLE[p]} 连接成功（${note}）`, "ok");
      return { ok: true, note, model: res.model, requestedModel: res.requestedModel };
    } catch (e) {
      const error = (e as Error).message || "连接失败";
      if (!quiet) toast(error, "warn");
      return { ok: false, error };
    } finally {
      setTesting(null);
    }
  };

  const listOf = (p: TextProvider, c: AiConfig) => known.models[listSig(p, c)];
  const imageListOf = (c: AiConfig) => known.image[`openrouter|${c.keys.openrouter}`];
  const isLoading = (p: TextProvider, c: AiConfig) => loading.includes(listSig(p, c));
  return { listOf, imageListOf, isLoading, testing, test, ensure };
}

/** The suggestions of a model field: Gemini excludes incompatible Imagen / TTS models and offers presets when no list has been read. */
function suggestions(provider: TextProvider, models: string[] | undefined, image: boolean | undefined): string[] | undefined {
  if (provider !== "gemini") return models;
  if (image) return [...new Set([...GEMINI_IMAGE_MODELS, ...(models ?? []).filter((m) => /image/i.test(m) && !/^imagen-/i.test(m))])];
  const textModels = (models ?? []).filter((m) => !/-image\b|^imagen-|-tts\b|embedding/i.test(m));
  return textModels.length ? textModels : [...GEMINI_PRESET_MODELS];
}

/** A model name: free text, with the service's own models to pick from (all of them on opening, narrowed while typing). */
function ModelField({
  provider,
  value,
  onChange,
  models,
  image,
  busy,
  hasKey,
}: {
  provider: TextProvider;
  value: string;
  onChange: (v: string) => void;
  models?: string[];
  image?: boolean;
  busy: boolean;
  hasKey: boolean;
}) {
  const id = `ai-models-${provider}${image ? "-image" : ""}`;
  const fallback = image && (provider === "openai" || provider === "gemini" || provider === "openrouter") ? DEFAULT_IMAGE_MODELS[provider] : DEFAULT_MODELS[provider];
  const options = suggestions(provider, models, image);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false);
  const [active, setActive] = useState(-1);
  // What is being typed. The saved setting is never empty (an empty name falls back to the default), so an emptied
  // field is kept here until something is typed, and only becomes the default again on leaving the field.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? value;
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const q = typed ? text.trim().toLowerCase() : "";
  const shown = (options ?? []).filter((m) => !q || m.toLowerCase().includes(q));

  const show = () => {
    setTyped(false);
    setActive(-1);
    setOpen(true);
  };
  const pick = (m: string) => {
    setDraft(null);
    onChange(m);
    setOpen(false);
  };
  // keep the highlighted model (or, on opening, the chosen one) in view
  useEffect(() => {
    if (!open) return;
    const at = active >= 0 ? active : shown.indexOf(value);
    (list.current?.children[at] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active, models]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return show();
      if (shown.length) setActive((a) => (e.key === "ArrowDown" ? Math.min(a + 1, shown.length - 1) : Math.max(a - 1, 0)));
    } else if (e.key === "Enter" && open && shown[active]) {
      e.preventDefault();
      pick(shown[active]);
    } else if (e.key === "Escape" && open) {
      // close the list only, not the whole dialog
      e.stopPropagation();
      setOpen(false);
    }
  };

  const empty = busy
    ? "正在读取模型列表…"
    : !hasKey
      ? `先在上面填 ${TITLE[provider]} 的 Key，这里就会列出可选的模型`
      : !options
        ? "没有读到模型列表，点上面的「测试连接」看原因"
        : "没有匹配的模型，也可以直接填模型名";

  return (
    <div className={`ai-model ${open ? "is-open" : ""}`}>
      <input
        ref={input}
        role="combobox"
        aria-expanded={open}
        aria-controls={id}
        aria-autocomplete="list"
        aria-label="模型"
        value={text}
        placeholder={fallback}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => {
          setDraft(e.target.value);
          if (e.target.value.trim()) onChange(e.target.value);
          setTyped(true);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={show}
        onClick={() => !open && show()}
        onBlur={() => {
          if (draft !== null && !draft.trim()) onChange("");
          setDraft(null);
          setOpen(false);
        }}
        onKeyDown={onKey}
      />
      <button
        type="button"
        className="ai-model-toggle"
        tabIndex={-1}
        aria-label={open ? "收起模型列表" : "展开模型列表"}
        onMouseDown={(e) => {
          // keep the focus in the field
          e.preventDefault();
          if (open) return setOpen(false);
          input.current?.focus();
          show();
        }}
      >
        <ChevronDown size={16} />
      </button>
      {open && (
        <ul ref={list} id={id} role="listbox" className="ai-model-list">
          {shown.length ? (
            shown.map((m, i) => (
              <li key={m} role="option" aria-selected={m === value} className={`${i === active ? "is-active" : ""} ${m === value ? "is-on" : ""}`} onMouseDown={(e) => (e.preventDefault(), pick(m))}>
                <span>{m}</span>
                {m === value && <Check size={14} />}
              </li>
            ))
          ) : (
            <li className="ai-model-empty">{empty}</li>
          )}
        </ul>
      )}
    </div>
  );
}

/** 我的 → AI 接口: keys, which service does which job, the Azure voice. */
export function AiSettings() {
  const c = useAiConfig();
  const usage = useAiUsage();
  const set = (patch: Partial<AiConfig>) => setAiConfig(patch);
  const setKey = (k: keyof AiConfig["keys"], v: string) =>
    setAiConfig((x) => {
      const nextLast = { ...x.lastGoodModel };
      if ((TEXT_PROVIDERS as readonly string[]).includes(k) && (x.keys[k] ?? "").trim() !== v.trim()) {
        delete nextLast[k as TextProvider];
      }
      return { ...x, keys: { ...x.keys, [k]: v }, lastGoodModel: nextLast };
    });
  const { listOf, imageListOf, isLoading, testing, test, ensure } = useModels();
  const [proxy, setProxy] = useState<boolean | null>(null);
  const [voices, setVoices] = useState<AzureVoice[] | null>(null);
  const [azBusy, setAzBusy] = useState(false);
  const [cached, setCached] = useState<number | null>(null);
  const [openAiBaseDraft, setOpenAiBaseDraft] = useState(c.openaiBaseUrl);
  const [geminiBaseDraft, setGeminiBaseDraft] = useState(c.geminiBaseUrl);
  const [sttBaseDraft, setSttBaseDraft] = useState(c.stt.baseUrl);
  useEffect(() => {
    setOpenAiBaseDraft(c.openaiBaseUrl);
  }, [c.openaiBaseUrl]);
  useEffect(() => {
    setGeminiBaseDraft(c.geminiBaseUrl);
  }, [c.geminiBaseUrl]);
  useEffect(() => {
    setSttBaseDraft(c.stt.baseUrl);
  }, [c.stt.baseUrl]);
  useEffect(() => {
    void proxyAvailable().then(setProxy);
    void ttsCacheSize().then(setCached);
  }, []);
  // The services in use get their model lists read on their own; after a key is typed, once the typing has paused.
  const inUse = [...new Set<TextProvider>([c.vision.provider, c.text.provider, c.image.provider])];
  const inUseKeys = inUse.map((p) => listSig(p, c)).join("\n");
  useEffect(() => {
    const t = setTimeout(() => inUse.forEach(ensure), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inUseKeys, ensure]);
  const field = (p: TextProvider) => ({ provider: p, busy: isLoading(p, c), hasKey: !!c.keys[p] });
  const geminiTarget = (() => {
    try {
      return c.geminiBaseUrl ? new URL(c.geminiBaseUrl).host : "";
    } catch {
      return "";
    }
  })();

  const WIZARD_PRESETS: { provider: TextProvider; badge: string; title: string; placeholder: string; hint: string }[] = [
    { provider: "openrouter", badge: "一站全能 · 推荐", title: "OpenRouter", placeholder: "sk-or-…", hint: "1 个 Key 同时配齐 B2 批改、拍照识图与配图" },
    { provider: "gemini", badge: "官方直连 · 多模态", title: "Google Gemini", placeholder: "AIzaSy…", hint: "1 个 Key 配齐文本批改、拍照识图与口语多模态转写" },
    { provider: "deepseek", badge: "极低费率", title: "DeepSeek", placeholder: "sk-…", hint: "直连高性价比文本批改与出题" },
    { provider: "openai", badge: "官方 / 中转", title: "OpenAI / 兼容", placeholder: "sk-…", hint: "全功能支持 + 自定义 Base URL 中转 / Whisper" },
    { provider: "anthropic", badge: "长文精细", title: "Anthropic Claude", placeholder: "sk-ant-…", hint: "深度语法批改 + 拍照识图" },
  ];
  const savedBase = (p: TextProvider, cfg: AiConfig = c) => (p === "openai" ? cfg.openaiBaseUrl : p === "gemini" ? cfg.geminiBaseUrl : "");
  const [wizProvider, setWizProvider] = useState<TextProvider>(() => TEXT_PROVIDERS.find((p) => c.keys[p]) ?? "openrouter");
  const [wizKey, setWizKey] = useState(() => c.keys[TEXT_PROVIDERS.find((p) => c.keys[p]) ?? "openrouter"] ?? "");
  const [wizBase, setWizBase] = useState(() => savedBase(TEXT_PROVIDERS.find((p) => c.keys[p]) ?? "openrouter"));
  const [wizStatus, setWizStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [wizBusy, setWizBusy] = useState(false);
  const wizDirtyRef = useRef(false);
  const wizSeqRef = useRef(0);
  const hasMultipleKeys = Object.values(c.keys).filter(Boolean).length > 1 || Boolean(c.keys.azure);
  const wizHasBase = wizProvider === "openai" || wizProvider === "gemini";
  const wizBaseBad = wizHasBase && !!wizBase.trim() && !sanitizeBaseUrl(wizBase);

  // Keep the wizard fields aligned with changes made under 高级配置 unless the learner is actively editing the wizard draft
  const extWizKey = c.keys[wizProvider] ?? "";
  const extWizBase = savedBase(wizProvider);
  useEffect(() => {
    if (!wizDirtyRef.current) setWizKey(extWizKey);
  }, [extWizKey]);
  useEffect(() => {
    if (!wizDirtyRef.current) setWizBase(extWizBase);
  }, [extWizBase]);

  const pickWizProvider = (p: TextProvider) => {
    wizSeqRef.current++;
    wizDirtyRef.current = false;
    setWizBusy(false);
    setWizProvider(p);
    setWizKey(c.keys[p] ?? "");
    setWizBase(savedBase(p));
    setWizStatus(null);
  };

  /**
   * Try the chosen service with the new key before switching to it: the settings are saved and the jobs moved only
   * when the JSON probe answers. A failure leaves services that already work as they are.
   */
  const applyWizard = async () => {
    const provider = wizProvider;
    const trimmed = wizKey.trim();
    if (!trimmed) {
      toast("请先粘贴 API Key", "warn");
      return;
    }
    const cleanBase = wizHasBase ? sanitizeBaseUrl(wizBase) : "";
    if (wizBaseBad) {
      const text = `${provider === "gemini" ? "Gemini 自定义接口地址" : "兼容接口地址"}${BASE_URL_HINT}`;
      toast(text, "warn");
      setWizStatus({ ok: false, text });
      return;
    }
    const buildPatch = (cur: AiConfig, resolvedModel?: string): AiConfig => {
      const chosenModel = resolvedModel || (provider === "openrouter" ? GRADING_RECOMMENDED_MODELS.openrouter[0] : DEFAULT_MODELS[provider]);
      const next: AiConfig = {
        ...cur,
        keys: { ...cur.keys, [provider]: trimmed },
        ...(resolvedModel ? { lastGoodModel: { ...cur.lastGoodModel, [provider]: resolvedModel } } : {}),
        ...(provider === "openai" ? { openaiBaseUrl: cleanBase } : {}),
        ...(provider === "gemini" ? { geminiBaseUrl: cleanBase } : {}),
        text: { provider, model: chosenModel },
      };
      if (provider === "openrouter") {
        next.vision = { provider: "openrouter", model: DEFAULT_MODELS.openrouter };
        next.image = { provider: "openrouter", model: DEFAULT_IMAGE_MODELS.openrouter };
      } else if (provider === "openai") {
        next.vision = { provider: "openai", model: DEFAULT_MODELS.openai };
        next.image = { provider: "openai", model: DEFAULT_IMAGE_MODELS.openai };
        if (!cleanBase) next.stt = { ...cur.stt, provider: "openai" };
      } else if (provider === "anthropic") {
        next.vision = { provider: "anthropic", model: DEFAULT_MODELS.anthropic };
      } else if (provider === "gemini") {
        // 识图 too; pictures stay with the service already chosen for them
        next.vision = { provider: "gemini", model: chosenModel };
      }
      return sanitizeAiConfig(next);
    };

    const seq = ++wizSeqRef.current;
    const candidateCfg = buildPatch(getAiConfig());
    setWizStatus(null);
    setWizBusy(true);
    try {
      const res = await test(provider, candidateCfg, true, { candidateOnly: true });
      if (wizSeqRef.current !== seq) return;
      if (res.ok) {
        wizDirtyRef.current = false;
        setAiConfig((cur) => buildPatch(cur, res.model));
        if (provider === "openai") confirmSyncedBaseUrl("openai", cleanBase);
        if (provider === "gemini") confirmSyncedBaseUrl("gemini", cleanBase);
        const text = `连接成功 · 已自动配齐 ${TITLE[provider]} 默认模型（${res.note}）`;
        toast(`${TITLE[provider]} ${text}`, "ok");
        setWizStatus({ ok: true, text });
        return;
      }
      const live = getAiConfig();
      const keepWorking = ready.text(live) || ready.vision(live);
      // nothing works yet: keep the key so that it can be corrected below; otherwise leave the working setup alone
      if (!keepWorking) setAiConfig((cur) => buildPatch(cur));
      const text = `连接失败：${res.error}${keepWorking ? "（原有的 AI 服务分工保持不变）" : ""}`;
      toast(text, "warn");
      setWizStatus({ ok: false, text });
    } finally {
      if (wizSeqRef.current === seq) setWizBusy(false);
    }
  };

  const loadVoices = async () => {
    setAzBusy(true);
    try {
      const list = await azureVoices();
      setVoices(list);
      toast(`Azure 连接成功，有 ${list.length} 个能说法语的音色`, "ok");
    } catch (e) {
      toast((e as Error).message, "warn");
    } finally {
      setAzBusy(false);
    }
  };
  const listen = async (voice: string) => {
    setAzBusy(true);
    let url = "";
    try {
      url = URL.createObjectURL(await azureSpeak("Bonjour ! Je m'appelle Claire, et j'habite à Lyon.", voice));
      const a = new Audio(url);
      a.onended = () => URL.revokeObjectURL(url);
      a.onerror = () => URL.revokeObjectURL(url);
      await a.play();
    } catch (e) {
      if (url) URL.revokeObjectURL(url);
      toast((e as Error).message, "warn");
    } finally {
      setAzBusy(false);
    }
  };

  const commitBaseDraft = (field: "openaiBaseUrl" | "geminiBaseUrl", draft: string, setDraft: (v: string) => void): string | null => {
    if (!draft.trim()) {
      set({ [field]: "" });
      setDraft("");
      return "";
    }
    const clean = sanitizeBaseUrl(draft);
    if (!clean) return null;
    set({ [field]: clean });
    setDraft(clean);
    return clean;
  };

  const runAdvancedTest = (p: TextProvider) => {
    if (p === "openai" || p === "gemini") {
      const draft = p === "openai" ? openAiBaseDraft : geminiBaseDraft;
      const setDraft = p === "openai" ? setOpenAiBaseDraft : setGeminiBaseDraft;
      const urlField = p === "openai" ? "openaiBaseUrl" : "geminiBaseUrl";
      const committed = commitBaseDraft(urlField, draft, setDraft);
      if (committed === null) {
        toast(`${p === "gemini" ? "Gemini 自定义接口地址" : "OpenAI 兼容接口地址"}${BASE_URL_HINT}`, "warn");
        return;
      }
      const latest = sanitizeAiConfig({ ...getAiConfig(), [urlField]: committed });
      void test(p, latest).then(keepTestedModel(p, latest));
      return;
    }
    void test(p).then(keepTestedModel(p, getAiConfig()));
  };

  /**
   * After a passing 测试连接, remember the model that really answered, and move the jobs still set to the model that
   * was asked for (when the probe had to adapt, e.g. a retired gemini-2.5-flash on a new Google project) to it, so
   * that real requests do not keep failing where the test passed. Jobs edited while the test ran are left alone.
   */
  const keepTestedModel =
    (p: TextProvider, snapshot: AiConfig) =>
    (res: Awaited<ReturnType<typeof test>>): void => {
      if (!res.ok || !res.model) return;
      const model = res.model;
      const asked = res.requestedModel.trim();
      const sameModel = (a: string, b: string) =>
        p === "gemini" ? normalizeGeminiModel(a) === normalizeGeminiModel(b) : a.trim() === b.trim();
      const follows = (now: { provider: string; model: string }, before: { provider: string; model: string }) =>
        now.provider === p && before.provider === p && sameModel(now.model, before.model) && sameModel(now.model, asked);
      setAiConfig((cur) => {
        if ((cur.keys[p] ?? "").trim() !== (snapshot.keys[p] ?? "").trim() || savedBase(p, cur) !== savedBase(p, snapshot)) {
          return cur;
        }
        return {
          ...cur,
          lastGoodModel: { ...cur.lastGoodModel, [p]: model },
          text: follows(cur.text, snapshot.text) ? { ...cur.text, model } : cur.text,
          vision: p !== "deepseek" && follows(cur.vision, snapshot.vision) ? { ...cur.vision, model } : cur.vision,
        };
      });
    };

  const testBtn = (p: TextProvider) => (
    <button type="button" className="btn btn-ghost btn-sm" onClick={() => runAdvancedTest(p)} disabled={!c.keys[p] || testing !== null} aria-label={`测试 ${TITLE[p]} 连接`}>
      {testing === p ? "测试中…" : "测试连接"}
    </button>
  );

  return (
    <div className="ai-settings">
      <p className="wf-hint">
        手动导出的 JSON 备份永不含 Key；如需跨设备同步，可在下方选择将配置或 API Key 纳入端到端加密云同步。
        {proxy ? "请求经本机的开发服务转发到各家接口。" : "请求由这台设备直接发给各家接口。"}
      </p>

      <UnconfirmedEndpoints c={c} />

      {isSyncConfigured() && <AiSyncControls variant="settings" />}

      <section className="ai-wizard" aria-label="1 步快速开通 AI">
        <div className="ai-wizard-head">
          <h3 className="eyebrow">
            <Sparkles size={14} /> 1 步快速开通（推荐）
          </h3>
          <span className="muted small">选一家服务并贴入 1 个 Key，自动分配文本批改 / 识图 / 默认推荐模型并探活</span>
        </div>
        <div className="ai-wizard-presets" role="group" aria-label="选择 AI 服务商">
          {WIZARD_PRESETS.map((item) => {
            const on = wizProvider === item.provider;
            const configured = Boolean(c.keys[item.provider]);
            return (
              <button
                key={item.provider}
                type="button"
                className={`ai-wizard-card ${on ? "is-on" : ""}`}
                aria-pressed={on}
                onClick={() => pickWizProvider(item.provider)}
              >
                <div className="ai-wizard-card-top">
                  <b>{item.title}</b>
                  <span className="chip">{configured ? "已填 Key" : item.badge}</span>
                </div>
                <small>{item.hint}</small>
              </button>
            );
          })}
        </div>
        <div className="ai-wizard-inputs">
          <KeyField
            label={`${TITLE[wizProvider]} API Key`}
            value={wizKey}
            onChange={(v) => {
              wizDirtyRef.current = true;
              wizSeqRef.current++;
              setWizKey(v);
            }}
            placeholder={WIZARD_PRESETS.find((x) => x.provider === wizProvider)?.placeholder ?? "sk-…"}
          />
          {wizHasBase && (
            <label className="wf-field">
              <span>{wizProvider === "gemini" ? "Gemini 自定义 Base URL（选填，官方直连留空；反代 / Cloudflare AI Gateway 时填）" : "兼容 Base URL（选填，官网直连留空）"}</span>
              <input
                value={wizBase}
                onChange={(e) => {
                  wizDirtyRef.current = true;
                  wizSeqRef.current++;
                  setWizBase(e.target.value);
                }}
                placeholder={wizProvider === "gemini" ? "https://your-gemini-proxy.com" : "https://your-relay.com/v1"}
                spellCheck={false}
              />
              {wizBaseBad && <small className="warn-text">{BASE_URL_HINT}</small>}
            </label>
          )}
        </div>
        <div className="writing-actions">
          <button type="button" className="btn btn-primary" onClick={() => void applyWizard()} disabled={testing !== null || wizBusy}>
            {wizBusy ? "探活测试中…" : "保存并自动配齐 · 测试连接"}
          </button>
          {wizStatus && (
            <span className={`small ${wizStatus.ok ? "is-ok" : "warn-text"}`} role="status">
              {wizStatus.text}
            </span>
          )}
        </div>
      </section>

      <details className="ai-advanced" open={hasMultipleKeys}>
        <summary className="ai-advanced-summary">
          <span>高级配置：多接口 Key 分工、自定义模型、Azure 语音与 Whisper 兜底</span>
          <ChevronDown size={16} />
        </summary>
        <div className="ai-advanced-body">
          <h3 className="eyebrow">接口 Key</h3>
      <div className="ai-row">
        <KeyField label="OpenAI" value={c.keys.openai} onChange={(v) => setKey("openai", v)} placeholder="sk-…" />
        {testBtn("openai")}
      </div>
      <label className="wf-field">
        <span>OpenAI 兼容接口地址 Base URL（选填，直连国内中转 / Groq / 本地 Ollama 时填）</span>
        <input
          value={openAiBaseDraft}
          onChange={(e) => setOpenAiBaseDraft(e.target.value)}
          onBlur={() => void commitBaseDraft("openaiBaseUrl", openAiBaseDraft, setOpenAiBaseDraft)}
          onKeyDown={(e) => e.key === "Enter" && void commitBaseDraft("openaiBaseUrl", openAiBaseDraft, setOpenAiBaseDraft)}
          placeholder="留空走官方 api.openai.com；支持如 https://your-relay.com/v1"
          spellCheck={false}
        />
        {openAiBaseDraft.trim() && !sanitizeBaseUrl(openAiBaseDraft) && (
          <small className="warn-text">仅支持以 https:// 开头的域名或本机 http://localhost / 127.0.0.1 地址</small>
        )}
      </label>
      <div className="ai-row">
        <KeyField label="Google Gemini" value={c.keys.gemini} onChange={(v) => setKey("gemini", v)} placeholder="AIzaSy…" />
        {testBtn("gemini")}
      </div>
      <label className="wf-field">
        <span>Gemini 自定义接口地址 Base URL（选填，中转 / 反代 / Cloudflare AI Gateway 时填）</span>
        <input
          value={geminiBaseDraft}
          onChange={(e) => setGeminiBaseDraft(e.target.value)}
          onBlur={() => void commitBaseDraft("geminiBaseUrl", geminiBaseDraft, setGeminiBaseDraft)}
          onKeyDown={(e) => e.key === "Enter" && void commitBaseDraft("geminiBaseUrl", geminiBaseDraft, setGeminiBaseDraft)}
          placeholder="留空走官方 generativelanguage.googleapis.com；如 https://your-gemini-proxy.com"
          spellCheck={false}
        />
        {geminiBaseDraft.trim() && !sanitizeBaseUrl(geminiBaseDraft) ? (
          <small className="warn-text">仅支持以 https:// 开头的域名或本机 http://localhost / 127.0.0.1 地址</small>
        ) : (
          geminiTarget && <small className="muted">Gemini 请求将发往 {geminiTarget}</small>
        )}
      </label>
      <div className="ai-row">
        <KeyField label="DeepSeek" value={c.keys.deepseek} onChange={(v) => setKey("deepseek", v)} placeholder="sk-…" />
        {testBtn("deepseek")}
      </div>
      <div className="ai-row">
        <KeyField label="Anthropic" value={c.keys.anthropic} onChange={(v) => setKey("anthropic", v)} placeholder="sk-ant-…" />
        {testBtn("anthropic")}
      </div>
      <div className="ai-row">
        <KeyField label="OpenRouter" value={c.keys.openrouter} onChange={(v) => setKey("openrouter", v)} placeholder="sk-or-…" />
        {testBtn("openrouter")}
      </div>

      <h3 className="eyebrow">分工</h3>
      <div className="ai-job">
        <b>拍照识别 · 识图</b>
        <small>读照片、扫描件和 PDF。DeepSeek 不能看图；Gemini 可直接看图和 PDF；用 OpenRouter 时要选一个能看图的模型。</small>
        <div className="segmented">
          {VISION_PROVIDERS.map((p) => (
            <button key={p} className={c.vision.provider === p ? "is-on" : ""} onClick={() => set({ vision: { provider: p, model: (p !== "openrouter" && c.lastGoodModel?.[p]) || DEFAULT_MODELS[p] } })}>
              {LABEL[p]}
            </button>
          ))}
        </div>
        <ModelField {...field(c.vision.provider)} value={c.vision.model} onChange={(m) => set({ vision: { ...c.vision, model: m } })} models={listOf(c.vision.provider, c)} />
      </div>
      <div className="ai-job">
        <b>生成与批改 · 文本</b>
        <small>用于生成词条讲解、写作与口语批改、语法与阅读出题。</small>
        <div className="segmented">
          {TEXT_PROVIDERS.map((p) => (
            <button key={p} className={c.text.provider === p ? "is-on" : ""} onClick={() => set({ text: { provider: p, model: c.lastGoodModel?.[p] || DEFAULT_MODELS[p] } })}>
              {LABEL[p]}
            </button>
          ))}
        </div>
        <ModelField {...field(c.text.provider)} value={c.text.model} onChange={(m) => set({ text: { ...c.text, model: m } })} models={listOf(c.text.provider, c)} />
        <small>
          批改推荐模型：OpenRouter 优先 <code>{GRADING_RECOMMENDED_MODELS.openrouter[0]}</code>（最稳且兼顾识图）或{" "}
          <code>{GRADING_RECOMMENDED_MODELS.openrouter[1]}</code>（纯文本高性价比）；直连推荐 DeepSeek <code>{GRADING_RECOMMENDED_MODELS.deepseek[0]}</code>，或 Google Gemini{" "}
          <code>{GRADING_RECOMMENDED_MODELS.gemini[0]}</code> / <code>{GRADING_RECOMMENDED_MODELS.gemini[1]}</code>（兼顾识图与口语多模态转写）。
        </small>
      </div>
      <div className="ai-job">
        <b>生成图片</b>
        <small>给词条画一张图。用上面对应服务的 Key；Gemini 用它的原生图片模型；OpenRouter 可以选它的任何一个图片模型。</small>
        <div className="segmented">
          {IMAGE_PROVIDERS.map((p) => (
            <button key={p} className={c.image.provider === p ? "is-on" : ""} onClick={() => set({ image: { provider: p, model: DEFAULT_IMAGE_MODELS[p] } })}>
              {LABEL[p]}
            </button>
          ))}
        </div>
        <ModelField
          image
          {...field(c.image.provider)}
          value={c.image.model}
          onChange={(m) => set({ image: { ...c.image, model: m } })}
          models={
            c.image.provider === "openrouter"
              ? imageListOf(c)
              : c.image.provider === "gemini"
                ? listOf("gemini", c)
                : listOf("openai", c)?.filter((m) => /image|dall/.test(m))
          }
        />
      </div>

      <h3 className="eyebrow">语音 · Azure AI Speech</h3>
      <div className="ai-row">
        <KeyField label="语音服务 Key" value={c.keys.azure} onChange={(v) => setKey("azure", v)} placeholder="Azure 门户 → 语音服务 → 密钥和终结点" />
        <label className="wf-field ai-region">
          <span>区域</span>
          <input value={c.azureRegion} onChange={(e) => set({ azureRegion: e.target.value })} placeholder="eastasia" spellCheck={false} />
        </label>
      </div>
      {(
        [
          ["azureVoice", "女声音色", "Female"],
          ["azureVoiceMale", "男声音色", "Male"],
        ] as const
      ).map(([field, label, gender]) => (
        <div className="ai-row" key={field}>
          <label className="wf-field">
            <span>{label}</span>
            {voices?.length ? (
              <select value={c[field]} onChange={(e) => set({ [field]: e.target.value })}>
                {!voices.some((v) => v.ShortName === c[field]) && <option value={c[field]}>{c[field]}</option>}
                {/* the matching gender first; the others stay available */}
                {[...voices.filter((v) => v.Gender === gender), ...voices.filter((v) => v.Gender !== gender)].map((v) => (
                  <option key={v.ShortName} value={v.ShortName}>
                    {v.LocalName} · {v.Gender === "Female" ? "女声" : v.Gender === "Male" ? "男声" : v.Gender} · {v.ShortName}
                  </option>
                ))}
              </select>
            ) : (
              <input value={c[field]} onChange={(e) => set({ [field]: e.target.value })} spellCheck={false} />
            )}
          </label>
          {field === "azureVoice" && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={loadVoices} disabled={!c.keys.azure || !c.azureRegion || azBusy}>
              获取音色
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => listen(c[field])} disabled={!c.keys.azure || !c.azureRegion || azBusy}>
            <Volume2 size={15} /> 试听
          </button>
        </div>
      ))}
      <p className="wf-hint">没有录音的词和例句会有「女」「男」两个朗读按钮，分别用上面两个音色。</p>
      <label className="field toggle">
        <b>没有录音的词和例句用 Azure 朗读</b>
        <input type="checkbox" role="switch" checked={c.tts} onChange={(e) => set({ tts: e.target.checked })} />
        <span className="switch" aria-hidden="true" />
      </label>
      <p className="wf-hint">
        每段文字只合成一次，之后从这台设备的缓存播放{cached !== null ? `（已缓存 ${cached} 段）` : ""}。合成失败时自动改用设备自带的发音。
        {!!cached && (
          <>
            {" "}
            <button
              type="button"
              className="link"
              onClick={async () => {
                await clearTtsCache();
                setCached(0);
                toast("语音缓存已清空");
              }}
            >
              清空缓存
            </button>
          </>
        )}
      </p>
      {c.tts && c.keys.azure && c.azureRegion && (
        <p className="wf-hint">
          <Check size={13} /> 已开启
        </p>
      )}

      <h3 className="eyebrow">口语语音转写 · Whisper 兜底</h3>
      <div className="ai-job">
        <b>浏览器识别失败时自动转写（支持 Whisper / Groq）</b>
        <small>若浏览器自带法语识别不可用且未配 Azure，停止录音后可自动调用兼容 <code>/audio/transcriptions</code> 的接口转写。</small>
        <div className="segmented">
          {STT_PROVIDERS.map((p) => (
            <button key={p} type="button" className={c.stt.provider === p ? "is-on" : ""} onClick={() => set({ stt: { ...c.stt, provider: p } })}>
              {STT_LABEL[p]}
            </button>
          ))}
        </div>
        {c.stt.provider !== "none" && (
          <>
            {c.stt.provider === "custom" && (
              <>
                <label className="wf-field">
                  <span>Whisper 接口地址（如 https://api.groq.com/openai/v1）</span>
                  <input
                    value={sttBaseDraft}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSttBaseDraft(v);
                      if (!v.trim()) set({ stt: { ...c.stt, baseUrl: "" } });
                      else {
                        const clean = sanitizeBaseUrl(v);
                        if (clean && !v.trim().endsWith("/")) set({ stt: { ...c.stt, baseUrl: clean } });
                      }
                    }}
                    onBlur={() => {
                      const clean = sanitizeBaseUrl(sttBaseDraft);
                      set({ stt: { ...c.stt, baseUrl: clean } });
                      setSttBaseDraft(clean);
                    }}
                    placeholder="https://api.groq.com/openai/v1"
                    spellCheck={false}
                  />
                  {sttBaseDraft.trim() && !sanitizeBaseUrl(sttBaseDraft) && (
                    <small className="warn-text">仅支持 https:// 或本机 http://localhost / 127.0.0.1 地址</small>
                  )}
                </label>
                <KeyField label="Whisper 接口 Key" value={c.stt.apiKey} onChange={(v) => set({ stt: { ...c.stt, apiKey: v } })} placeholder="gsk_… 或 sk-…" />
              </>
            )}
            <label className="wf-field">
              <span>转写模型名</span>
              <input value={c.stt.model} onChange={(e) => set({ stt: { ...c.stt, model: e.target.value } })} placeholder="whisper-1 或 whisper-large-v3-turbo" spellCheck={false} />
            </label>
          </>
        )}
      </div>

      <h3 className="eyebrow">本地 AI 用量估算</h3>
      <div className="ai-job">
        <b>本浏览器累计调用：{usage.calls} 次</b>
        <small>
          输入约 {usage.promptTokens.toLocaleString("en-US")} tokens · 输出约 {usage.completionTokens.toLocaleString("en-US")} tokens · 估算费用约 ${usage.estimatedUsd.toFixed(4)}（仅供参考，按官方费率粗算）
        </small>
            {usage.calls > 0 && (
              <div>
                <button type="button" className="link" onClick={resetAiUsage}>
                  清零统计
                </button>
              </div>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}
