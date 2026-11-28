import { ShieldCheck } from "lucide-react";
import { setSyncConfigEnabled, setSyncKeysEnabled, useAiSyncPrefs, type AiSyncPrefs } from "../sync/ai-sync";
import { useSyncState, type SyncState } from "../sync/state";
import { toast } from "./Toast";

/** Where the AI part of cloud sync stands, in a few words. */
export function aiSyncStatusText(
  sync: Pick<SyncState, "code" | "busy" | "lastError" | "lastOkAt">,
  prefs: AiSyncPrefs,
  variant: "cloud" | "settings" = "settings",
): { text: string; tone: "ok" | "busy" | "error" | "idle" } {
  if (!sync.code) {
    return {
      text:
        variant === "cloud"
          ? "当前尚未配对；预设好下方选项后，在上方开通或输入同步码即可生效"
          : "当前尚未开启云同步；预设好下方选项后，前往「我的 → 云同步」配对即可生效",
      tone: "idle",
    };
  }
  if (sync.busy) return { text: "正在同步…", tone: "busy" };
  if (sync.lastError) return { text: `同步失败：${sync.lastError}`, tone: "error" };
  const configOn = prefs.configPolicy !== "disabled";
  const keysOn = configOn && prefs.keyPolicy === "enabled";
  if (prefs.policyRev > prefs.syncedPolicyRev) {
    const switchedOff = prefs.lastSwitchAction ? prefs.lastSwitchAction === "off" : !configOn || !keysOn;
    return { text: switchedOff ? "本机已关闭，等待同步更新云端" : "待同步至云端", tone: "idle" };
  }
  if (sync.lastOkAt !== null) return { text: configOn ? "已加密同步" : "已同步（AI 接口配置不参与同步）", tone: "ok" };
  return { text: "待同步至云端", tone: "idle" };
}

/**
 * The two switches of AI settings sync, shown both in 我的 → 云同步 and in 我的 → AI 接口 (same state, so they move
 * together): the non-sensitive config (on by default) and, optionally, the API keys.
 */
export function AiSyncControls({ variant }: { variant: "cloud" | "settings" }) {
  const prefs = useAiSyncPrefs();
  const sync = useSyncState();
  const configOn = prefs.configPolicy !== "disabled";
  const keysOn = configOn && prefs.keyPolicy === "enabled";
  const legacy = !!sync.code && (!!sync.legacyAuth || sync.authVersion === 1);
  const status = aiSyncStatusText(sync, prefs, variant);
  const shared = prefs.keyPolicy === "unset" && !!prefs.passthroughKeys;
  const cfgDescId = `ai-sync-cfg-desc-${variant}`;
  const keyDescId = `ai-sync-key-desc-${variant}`;

  const onConfig = (on: boolean) => {
    setSyncConfigEnabled(on);
    toast(on ? "已开启 AI 接口配置同步" : "已关闭 AI 接口配置同步，本机的配置与 Key 原样保留", "ok");
  };
  const onKeys = (on: boolean) => {
    setSyncKeysEnabled(on);
    toast(on ? "已开启 API Key 端到端加密同步" : "已关闭 API Key 同步，本机 Key 原样保留；下一次同步后云端将不再含 Key", "ok");
  };

  return (
    <div className={`ai-sync-controls is-${variant}`} role="group" aria-label="AI 接口跨设备同步">
      <div className="ai-sync-head">
        <b>
          <ShieldCheck size={15} aria-hidden="true" /> AI 接口跨设备同步
        </b>
        <span className={`ai-sync-status is-${status.tone}`} aria-live="polite">
          {status.text}
        </span>
      </div>
      <label className="field toggle ai-sync-toggle">
        <div>
          <b>同步 AI 接口配置</b>
          <small id={cfgDescId}>同步服务商分工、自定义 Base URL、模型、Azure 区域与音色、Whisper 模式等非敏感设置</small>
        </div>
        <input
          type="checkbox"
          role="switch"
          aria-label="同步 AI 接口配置"
          aria-describedby={cfgDescId}
          checked={configOn}
          onChange={(e) => onConfig(e.target.checked)}
        />
        <span className="switch" aria-hidden="true" />
      </label>
      <label className="field toggle ai-sync-toggle">
        <div>
          <b>将 API Key 一并纳入端到端加密同步</b>
          <small id={keyDescId}>可选，默认关闭。开启后其他已配对设备可直接使用同一组 Key</small>
        </div>
        <input
          type="checkbox"
          role="switch"
          aria-label="将 API Key 一并纳入端到端加密同步"
          aria-describedby={keyDescId}
          checked={keysOn}
          disabled={legacy && !keysOn}
          onChange={(e) => onKeys(e.target.checked)}
        />
        <span className="switch" aria-hidden="true" />
      </label>
      {legacy && <p className="ai-sync-note is-warn">当前同步账号使用旧版认证（服务器知道同步码），为安全起见不会上传 API Key。</p>}
      {shared && !legacy && (
        <p className="ai-sync-note">云端存档含其他设备加密同步的 API Key，本机只用它补齐空着的槽位，本机已有的 Key 不会上传；开启上方开关即可双向同步本机 Key。</p>
      )}
      <ul className="ai-sync-notes">
        <li>同步数据在本机用同步码派生的密钥端到端加密（HKDF + AES-GCM），服务器只保存密文，无法解密读取明文。</li>
        <li>请妥善保管个人同步码，切勿泄露给他人：持有同步码即可解密存档，丢失将无法找回。</li>
        <li>未开启 Key 同步时只同步非敏感配置，不会清空各设备本地已填的 Key；关闭 Key 同步后本机 Key 保留，下一次云同步成功后云端最新存档将不再包含 API Key。</li>
      </ul>
    </div>
  );
}
