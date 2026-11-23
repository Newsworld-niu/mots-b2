import { Check, ChevronDown, Eye, EyeOff, Sparkles, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { azureSpeak, azureVoices, listImageModels, listModels, testTextProvider, type AzureVoice } from "../ai/clients";
import { DEFAULT_IMAGE_MODELS, DEFAULT_MODELS, GRADING_RECOMMENDED_MODELS, IMAGE_PROVIDERS, sanitizeBaseUrl, STT_PROVIDERS, TEXT_PROVIDERS, VISION_PROVIDERS, getAiConfig, setAiConfig, useAiConfig, type AiConfig, type SttProvider, type TextProvider } from "../ai/config";
import { proxyAvailable } from "../ai/proxy";
import { clearTtsCache, ttsCacheSize } from "../ai/tts";
import { resetAiUsage, useAiUsage } from "../ai/usage";
import { toast } from "./Toast";

const STT_LABEL: Record<SttProvider, string> = { none: "关闭", openai: "复用 OpenAI", custom: "自定义 Whisper 接口" };

const LABEL: Record<TextProvider, string> = { openai: "OpenAI", deepseek: "DeepSeek", anthropic: "Anthropic", openrouter: "OpenRouter" };

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

type Lists = Partial<Record<TextProvider, string[]>>;
/** Lists already read during this visit, so that reopening the settings shows them at once. */
const known: { models: Lists; image?: string[] } = { models: {} };

/** The models each service offers: read quietly for the services in use, and by 测试连接 (which also reports). */
function useModels() {
  const [models, setModels] = useState<Lists>(known.models);
  // OpenRouter keeps its image models in a list of their own
  const [imageModels, setImageModels] = useState<string[] | undefined>(known.image);
  const [testing, setTesting] = useState<TextProvider | null>(null);
  const [loading, setLoading] = useState<TextProvider[]>([]);
  const pending = useRef(new Set<TextProvider>());

  const load = useCallback(async (p: TextProvider) => {
    const list = await listModels(p);
    known.models = { ...known.models, [p]: list };
    setModels(known.models);
    if (p === "openrouter")
      void listImageModels().then(
        (l) => {
          known.image = l;
          setImageModels(l);
        },
        () => undefined,
      );
    return list;
  }, []);

  /** Read a service's list if it has a key and the list is not here yet; failures stay silent (测试连接 explains them). */
  const ensure = useCallback(
    (p: TextProvider) => {
      if (known.models[p] || pending.current.has(p) || !getAiConfig().keys[p]) return;
      pending.current.add(p);
      setLoading([...pending.current]);
      void load(p)
        .catch(() => undefined)
        .finally(() => {
          pending.current.delete(p);
          setLoading([...pending.current]);
        });
    },
    [load],
  );

  const test = async (p: TextProvider): Promise<boolean> => {
    setTesting(p);
    try {
      const res = await testTextProvider(p);
      if (res.models.length) {
        known.models = { ...known.models, [p]: res.models };
        setModels(known.models);
      }
      const modeHint = res.compatMode && res.compatMode !== "strict" ? ` · 已自动适配 ${res.compatMode} 兼容协议` : "";
      const listNote = res.models.length ? `读取 ${res.models.length} 个模型` : "结构化 JSON 探活通过";
      toast(`${LABEL[p]} 连接成功（${listNote}${modeHint}）`, "ok");
      return true;
    } catch (e) {
      toast((e as Error).message, "warn");
      return false;
    } finally {
      setTesting(null);
    }
  };
  return { models, imageModels, testing, loading, test, ensure };
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
  const fallback = image && (provider === "openai" || provider === "openrouter") ? DEFAULT_IMAGE_MODELS[provider] : DEFAULT_MODELS[provider];
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
  const shown = (models ?? []).filter((m) => !q || m.toLowerCase().includes(q));

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
      ? `先在上面填 ${LABEL[provider]} 的 Key，这里就会列出可选的模型`
      : !models
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
  const setKey = (k: keyof AiConfig["keys"], v: string) => setAiConfig((x) => ({ ...x, keys: { ...x.keys, [k]: v } }));
  const { models, imageModels, testing, loading, test, ensure } = useModels();
  const [proxy, setProxy] = useState<boolean | null>(null);
  const [voices, setVoices] = useState<AzureVoice[] | null>(null);
  const [azBusy, setAzBusy] = useState(false);
  const [cached, setCached] = useState<number | null>(null);
  const [openAiBaseDraft, setOpenAiBaseDraft] = useState(c.openaiBaseUrl);
  const [sttBaseDraft, setSttBaseDraft] = useState(c.stt.baseUrl);
  useEffect(() => {
    setOpenAiBaseDraft(c.openaiBaseUrl);
  }, [c.openaiBaseUrl]);
  useEffect(() => {
    setSttBaseDraft(c.stt.baseUrl);
  }, [c.stt.baseUrl]);
  useEffect(() => {
    void proxyAvailable().then(setProxy);
    void ttsCacheSize().then(setCached);
  }, []);
  // The services in use get their model lists read on their own; after a key is typed, once the typing has paused.
  const inUse = [...new Set<TextProvider>([c.vision.provider, c.text.provider, c.image.provider])];
  const inUseKeys = inUse.map((p) => `${p}:${c.keys[p]}`).join("|") + `|${c.openaiBaseUrl}`;
  useEffect(() => {
    const t = setTimeout(() => inUse.forEach(ensure), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inUseKeys, ensure]);
  const field = (p: TextProvider) => ({ provider: p, busy: loading.includes(p), hasKey: !!c.keys[p] });

  const WIZARD_PRESETS: { provider: TextProvider; badge: string; title: string; placeholder: string; hint: string }[] = [
    { provider: "openrouter", badge: "一站全能 · 推荐", title: "OpenRouter", placeholder: "sk-or-…", hint: "1 个 Key 同时配齐 B2 批改、拍照识图与配图" },
    { provider: "deepseek", badge: "极低费率", title: "DeepSeek", placeholder: "sk-…", hint: "直连高性价比文本批改与出题" },
    { provider: "openai", badge: "官方 / 中转", title: "OpenAI / 兼容", placeholder: "sk-…", hint: "全功能支持 + 自定义 Base URL 中转 / Whisper" },
    { provider: "anthropic", badge: "长文精细", title: "Anthropic Claude", placeholder: "sk-ant-…", hint: "深度语法批改 + 拍照识图" },
  ];
  const [wizProvider, setWizProvider] = useState<TextProvider>(() => TEXT_PROVIDERS.find((p) => c.keys[p]) ?? "openrouter");
  const [wizKey, setWizKey] = useState(() => c.keys[TEXT_PROVIDERS.find((p) => c.keys[p]) ?? "openrouter"] ?? "");
  const [wizBase, setWizBase] = useState(() => c.openaiBaseUrl);
  const [wizStatus, setWizStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const hasMultipleKeys = Object.values(c.keys).filter(Boolean).length > 1 || Boolean(c.keys.azure);

  const pickWizProvider = (p: TextProvider) => {
    setWizProvider(p);
    setWizKey(c.keys[p] ?? "");
    setWizStatus(null);
  };

  const applyWizard = async () => {
    const trimmed = wizKey.trim();
    if (!trimmed) {
      toast("请先粘贴 API Key", "warn");
      return;
    }
    const cleanBase = wizProvider === "openai" ? sanitizeBaseUrl(wizBase) : c.openaiBaseUrl;
    if (wizProvider === "openai" && wizBase.trim() && !cleanBase) {
      toast("兼容接口地址须以 https:// 或本机 http://localhost 开头", "warn");
      return;
    }
    const patch: Partial<AiConfig> = {
      keys: { ...c.keys, [wizProvider]: trimmed },
      ...(wizProvider === "openai" ? { openaiBaseUrl: cleanBase } : {}),
      text: {
        provider: wizProvider,
        model: wizProvider === "openrouter" ? GRADING_RECOMMENDED_MODELS.openrouter[0] : DEFAULT_MODELS[wizProvider],
      },
    };
    if (wizProvider === "openrouter") {
      patch.vision = { provider: "openrouter", model: DEFAULT_MODELS.openrouter };
      patch.image = { provider: "openrouter", model: DEFAULT_IMAGE_MODELS.openrouter };
    } else if (wizProvider === "openai") {
      patch.vision = { provider: "openai", model: DEFAULT_MODELS.openai };
      patch.image = { provider: "openai", model: DEFAULT_IMAGE_MODELS.openai };
      if (!cleanBase) patch.stt = { ...c.stt, provider: "openai" };
    } else if (wizProvider === "anthropic") {
      patch.vision = { provider: "anthropic", model: DEFAULT_MODELS.anthropic };
    }
    set(patch);
    setWizStatus(null);
    const ok = await test(wizProvider);
    setWizStatus({ ok, text: ok ? `连接成功 · 已自动配齐 ${LABEL[wizProvider]} 默认模型` : "连接失败，请检查 Key 或网络地址" });
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

  const testBtn = (p: TextProvider) => (
    <button type="button" className="btn btn-ghost btn-sm" onClick={() => test(p)} disabled={!c.keys[p] || testing !== null}>
      {testing === p ? "测试中…" : "测试连接"}
    </button>
  );

  return (
    <div className="ai-settings">
      <p className="wf-hint">Key 只保存在这台设备上，不会写进备份。{proxy ? "请求经本机的开发服务转发到各家接口。" : "请求由这台设备直接发给各家接口。"}</p>

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
            label={`${LABEL[wizProvider]} API Key`}
            value={wizKey}
            onChange={setWizKey}
            placeholder={WIZARD_PRESETS.find((x) => x.provider === wizProvider)?.placeholder ?? "sk-…"}
          />
          {wizProvider === "openai" && (
            <label className="wf-field">
              <span>兼容 Base URL（选填，官网直连留空）</span>
              <input
                value={wizBase}
                onChange={(e) => setWizBase(e.target.value)}
                placeholder="https://your-relay.com/v1"
                spellCheck={false}
              />
            </label>
          )}
        </div>
        <div className="writing-actions">
          <button type="button" className="btn btn-primary" onClick={() => void applyWizard()} disabled={testing !== null}>
            {testing === wizProvider ? "探活测试中…" : "保存并自动配齐 · 测试连接"}
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
          onChange={(e) => {
            const v = e.target.value;
            setOpenAiBaseDraft(v);
            if (!v.trim()) set({ openaiBaseUrl: "" });
            else {
              const clean = sanitizeBaseUrl(v);
              if (clean && !v.trim().endsWith("/")) set({ openaiBaseUrl: clean });
            }
          }}
          onBlur={() => {
            const clean = sanitizeBaseUrl(openAiBaseDraft);
            set({ openaiBaseUrl: clean });
            setOpenAiBaseDraft(clean);
          }}
          placeholder="留空走官方 api.openai.com；支持如 https://your-relay.com/v1"
          spellCheck={false}
        />
        {openAiBaseDraft.trim() && !sanitizeBaseUrl(openAiBaseDraft) && (
          <small className="warn-text">仅支持以 https:// 开头的域名或本机 http://localhost / 127.0.0.1 地址</small>
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
        <small>读照片、扫描件和 PDF。DeepSeek 不能看图；用 OpenRouter 时要选一个能看图的模型。</small>
        <div className="segmented">
          {VISION_PROVIDERS.map((p) => (
            <button key={p} className={c.vision.provider === p ? "is-on" : ""} onClick={() => set({ vision: { provider: p, model: DEFAULT_MODELS[p] } })}>
              {LABEL[p]}
            </button>
          ))}
        </div>
        <ModelField {...field(c.vision.provider)} value={c.vision.model} onChange={(m) => set({ vision: { ...c.vision, model: m } })} models={models[c.vision.provider]} />
      </div>
      <div className="ai-job">
        <b>生成与批改 · 文本</b>
        <small>用于生成词条讲解、写作与口语批改、语法与阅读出题。</small>
        <div className="segmented">
          {TEXT_PROVIDERS.map((p) => (
            <button key={p} className={c.text.provider === p ? "is-on" : ""} onClick={() => set({ text: { provider: p, model: DEFAULT_MODELS[p] } })}>
              {LABEL[p]}
            </button>
          ))}
        </div>
        <ModelField {...field(c.text.provider)} value={c.text.model} onChange={(m) => set({ text: { ...c.text, model: m } })} models={models[c.text.provider]} />
        <small>
          批改推荐模型：OpenRouter 优先 <code>{GRADING_RECOMMENDED_MODELS.openrouter[0]}</code>（最稳且兼顾识图）或{" "}
          <code>{GRADING_RECOMMENDED_MODELS.openrouter[1]}</code>（纯文本高性价比）；直连推荐 DeepSeek <code>{GRADING_RECOMMENDED_MODELS.deepseek[0]}</code>。
        </small>
      </div>
      <div className="ai-job">
        <b>生成图片</b>
        <small>给词条画一张图。用上面对应服务的 Key；OpenRouter 可以选它的任何一个图片模型。</small>
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
          models={c.image.provider === "openrouter" ? imageModels : models.openai?.filter((m) => /image|dall/.test(m))}
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
