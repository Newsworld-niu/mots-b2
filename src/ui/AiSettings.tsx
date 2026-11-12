import { Check, Eye, EyeOff, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { azureSpeak, azureVoices, listImageModels, listModels, type AzureVoice } from "../ai/clients";
import { DEFAULT_IMAGE_MODELS, DEFAULT_MODELS, IMAGE_PROVIDERS, TEXT_PROVIDERS, VISION_PROVIDERS, setAiConfig, useAiConfig, type AiConfig, type TextProvider } from "../ai/config";
import { proxyAvailable } from "../ai/proxy";
import { clearTtsCache, ttsCacheSize } from "../ai/tts";
import { toast } from "./Toast";

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

/** Test a service by listing its models; the list also feeds the model fields. */
function useModels() {
  const [models, setModels] = useState<Partial<Record<TextProvider, string[]>>>({});
  // OpenRouter keeps its image models in a list of their own
  const [imageModels, setImageModels] = useState<string[] | undefined>();
  const [testing, setTesting] = useState<TextProvider | null>(null);
  const test = async (p: TextProvider) => {
    setTesting(p);
    try {
      const list = await listModels(p);
      setModels((m) => ({ ...m, [p]: list }));
      if (p === "openrouter") void listImageModels().then(setImageModels, () => undefined);
      toast(`${LABEL[p]} 连接成功，有 ${list.length} 个模型可选`, "ok");
    } catch (e) {
      toast((e as Error).message, "warn");
    } finally {
      setTesting(null);
    }
  };
  return { models, imageModels, testing, test };
}

function ModelField({ provider, value, onChange, models, image }: { provider: TextProvider; value: string; onChange: (v: string) => void; models?: string[]; image?: boolean }) {
  const id = `ai-models-${provider}${image ? "-image" : ""}`;
  const fallback = image && (provider === "openai" || provider === "openrouter") ? DEFAULT_IMAGE_MODELS[provider] : DEFAULT_MODELS[provider];
  return (
    <>
      <input list={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={fallback} spellCheck={false} />
      <datalist id={id}>{(models ?? []).map((m) => <option key={m} value={m} />)}</datalist>
    </>
  );
}

/** 我的 → AI 接口: keys, which service does which job, the Azure voice. */
export function AiSettings() {
  const c = useAiConfig();
  const set = (patch: Partial<AiConfig>) => setAiConfig(patch);
  const setKey = (k: keyof AiConfig["keys"], v: string) => setAiConfig((x) => ({ ...x, keys: { ...x.keys, [k]: v } }));
  const { models, imageModels, testing, test } = useModels();
  const [proxy, setProxy] = useState<boolean | null>(null);
  const [voices, setVoices] = useState<AzureVoice[] | null>(null);
  const [azBusy, setAzBusy] = useState(false);
  const [cached, setCached] = useState<number | null>(null);
  useEffect(() => {
    void proxyAvailable().then(setProxy);
    void ttsCacheSize().then(setCached);
  }, []);

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
  const listen = async () => {
    setAzBusy(true);
    try {
      const a = new Audio(URL.createObjectURL(await azureSpeak("Bonjour ! Je m'appelle Claire, et j'habite à Lyon.")));
      await a.play();
    } catch (e) {
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

      <h3 className="eyebrow">接口 Key</h3>
      <div className="ai-row">
        <KeyField label="OpenAI" value={c.keys.openai} onChange={(v) => setKey("openai", v)} placeholder="sk-…" />
        {testBtn("openai")}
      </div>
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
        <ModelField provider={c.vision.provider} value={c.vision.model} onChange={(m) => set({ vision: { ...c.vision, model: m } })} models={models[c.vision.provider]} />
      </div>
      <div className="ai-job">
        <b>生成卡片 · 文本</b>
        <small>给新词写中文释义、词性和例句（整套生成、AI 补全）。</small>
        <div className="segmented">
          {TEXT_PROVIDERS.map((p) => (
            <button key={p} className={c.text.provider === p ? "is-on" : ""} onClick={() => set({ text: { provider: p, model: DEFAULT_MODELS[p] } })}>
              {LABEL[p]}
            </button>
          ))}
        </div>
        <ModelField provider={c.text.provider} value={c.text.model} onChange={(m) => set({ text: { ...c.text, model: m } })} models={models[c.text.provider]} />
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
          provider={c.image.provider}
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
      <div className="ai-row">
        <label className="wf-field">
          <span>音色</span>
          {voices?.length ? (
            <select value={c.azureVoice} onChange={(e) => set({ azureVoice: e.target.value })}>
              {!voices.some((v) => v.ShortName === c.azureVoice) && <option value={c.azureVoice}>{c.azureVoice}</option>}
              {voices.map((v) => (
                <option key={v.ShortName} value={v.ShortName}>
                  {v.LocalName} · {v.Gender === "Female" ? "女声" : v.Gender === "Male" ? "男声" : v.Gender} · {v.ShortName}
                </option>
              ))}
            </select>
          ) : (
            <input value={c.azureVoice} onChange={(e) => set({ azureVoice: e.target.value })} spellCheck={false} />
          )}
        </label>
        <button type="button" className="btn btn-ghost btn-sm" onClick={loadVoices} disabled={!c.keys.azure || !c.azureRegion || azBusy}>
          获取音色
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={listen} disabled={!c.keys.azure || !c.azureRegion || azBusy}>
          <Volume2 size={15} /> 试听
        </button>
      </div>
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
    </div>
  );
}
