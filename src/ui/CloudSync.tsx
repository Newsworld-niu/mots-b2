import { Check, Cloud, CloudOff, Copy, Download, Eye, EyeOff, History, KeyRound, LogOut, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { downloadRawBackupFile } from "../lib/backup";
import { dayKey } from "../store/store";
import { isSyncConfigured, type SyncHistoryItem } from "../sync/api";
import { summarizeBackup } from "../sync/decide";
import {
  getSyncHistory,
  pairWithCode,
  registerWithInvite,
  restoreHistoryVersion,
  syncNow,
  unpairLocal,
  wipeCloudAccount,
} from "../sync/engine";
import { getLocalSafetyCopy, loadLocalSafetyCopy, useSyncState, type SyncState } from "../sync/state";
import { confirmAction } from "./ConfirmSheet";
import { toast } from "./Toast";

const SYNC_CODE_WARNING = "请保存好同步码，丢失将无法找回云端数据";

function formatSyncStatus(sync: SyncState, now: number): { text: string; tone: "ok" | "busy" | "error" | "idle" } {
  if (sync.busy) return { text: "正在同步…", tone: "busy" };
  if (sync.lastError) return { text: `失败：${sync.lastError}`, tone: "error" };
  if (sync.lastOkAt !== null) {
    const mins = Math.max(0, Math.floor((now - sync.lastOkAt) / 60_000));
    if (mins < 1) return { text: "刚刚", tone: "ok" };
    if (mins < 60) return { text: `${mins} 分钟前`, tone: "ok" };
    const hours = Math.floor(mins / 60);
    if (hours < 24) return { text: `${hours} 小时前`, tone: "ok" };
    return { text: `${Math.floor(hours / 24)} 天前`, tone: "ok" };
  }
  return { text: "已配对，等待首次同步", tone: "idle" };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(at: string | number): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return String(at);
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LocalSafetyCopyButton() {
  const sync = useSyncState();
  const [safetyJson, setSafetyJson] = useState<string | null>(() => getLocalSafetyCopy());
  useEffect(() => {
    let live = true;
    void loadLocalSafetyCopy().then((v) => {
      if (live) setSafetyJson(v);
    });
    return () => {
      live = false;
    };
  }, [sync.lastOkAt, sync.lastError, sync.code, sync.busy]);
  const summary = useMemo(() => (safetyJson ? summarizeBackup(safetyJson) : null), [safetyJson]);
  if (!safetyJson || !summary) return null;
  const labelTime = summary.exported ? formatDateTime(summary.exported) : "";
  return (
    <div className="sync-safety-box">
      <div className="sync-safety-meta">
        <b>本机覆盖前安全副本</b>
        <small>
          {summary.cards} 词 · {summary.essays} 篇作文
          {labelTime ? ` · ${labelTime}` : ""}
        </small>
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => void downloadRawBackupFile(safetyJson, `atlas-du-francais-local-safety-${dayKey()}.json`, "已下载覆盖前的本机备份")}
      >
        <Download size={15} /> 下载副本
      </button>
    </div>
  );
}

export function CloudSync() {
  const sync = useSyncState();
  const configured = isSyncConfigured();

  const [tab, setTab] = useState<"invite" | "pair">("invite");
  const [inviteInput, setInviteInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [justCreated, setJustCreated] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<SyncHistoryItem[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wiping, setWiping] = useState(false);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!sync.code) return;
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, [sync.code]);

  const codeVisible = !!sync.code && (justCreated || showCode);
  useEffect(() => {
    if (!sync.code || !codeVisible) {
      setQrUrl("");
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(sync.code, { width: 180, margin: 2 }).then(
      (url) => {
        if (!cancelled) setQrUrl(url);
      },
      () => {
        if (!cancelled) setQrUrl("");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [sync.code, codeVisible]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const list = await getSyncHistory();
      setHistoryItems(list);
    } catch (err) {
      setHistoryError((err as Error).message || "获取历史版本失败");
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleHistory = () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next) void loadHistory();
  };

  const onRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await registerWithInvite(inviteInput);
      setInviteInput("");
      setJustCreated(true);
      setShowCode(true);
      toast("已创建同步码，请妥善保存", "ok");
    } catch (err) {
      setFormError((err as Error).message || "创建同步码失败");
    } finally {
      setSubmitting(false);
    }
  };

  const onPair = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const decision = await pairWithCode(codeInput);
      setCodeInput("");
      setJustCreated(false);
      setShowCode(false);
      if (decision !== "conflict") toast("云同步配对成功", "ok");
    } catch (err) {
      setFormError((err as Error).message || "配对失败");
    } finally {
      setSubmitting(false);
    }
  };

  const onCopyCode = async () => {
    if (!sync.code) return;
    try {
      await navigator.clipboard.writeText(sync.code);
      setCopied(true);
      toast("已复制同步码", "ok");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("复制失败，请手动选中复制", "warn");
    }
  };

  const onSyncNow = async () => {
    await syncNow();
    if (historyOpen) void loadHistory();
  };

  const onRestoreHistory = async (item: SyncHistoryItem) => {
    if (
      !(await confirmAction({
        title: "恢复云端历史版本？",
        message: `确定将学习数据恢复到 ${formatDateTime(item.at)} 的版本？恢复前会自动在本地保留一份当前数据的安全副本，并把云端同步更新为此版本。`,
        confirmLabel: "确认恢复",
      }))
    ) {
      return;
    }
    setRestoringId(item.id);
    try {
      await restoreHistoryVersion(item.id);
      toast("已恢复到所选历史版本", "ok");
      void loadHistory();
    } catch (err) {
      toast((err as Error).message || "恢复失败", "warn");
    } finally {
      setRestoringId(null);
    }
  };

  const onUnpair = async () => {
    if (
      !(await confirmAction({
        title: "退出本机云同步？",
        message: "本机与云端数据都会保留，之后可随时使用同步码重新配对。",
        confirmLabel: "退出同步",
      }))
    )
      return;
    unpairLocal();
    setJustCreated(false);
    setShowCode(false);
    setHistoryOpen(false);
    setConfirmWipe(false);
    toast("已退出同步（仅本机）");
  };

  const onWipeCloud = async () => {
    if (
      !(await confirmAction({
        title: "永久删除云端数据？",
        message: "最后确认：将永久删除云端全部同步数据与历史版本，同步码将失效且无法恢复！确定继续？",
        confirmLabel: "永久删除",
        danger: true,
      }))
    )
      return;
    setWiping(true);
    try {
      await wipeCloudAccount();
      setJustCreated(false);
      setShowCode(false);
      setHistoryOpen(false);
      setConfirmWipe(false);
      toast("已永久删除云端数据", "ok");
    } catch (err) {
      toast((err as Error).message || "删除云端数据失败", "warn");
    } finally {
      setWiping(false);
    }
  };

  if (!configured) {
    return (
      <section className="panel cloud-sync">
        <div className="panel-head">
          <h3 className="eyebrow">云同步（可选）</h3>
          <span className="sync-badge is-off">
            <CloudOff size={14} /> 未配置
          </span>
        </div>
        <p className="muted">当前部署未配置云同步服务地址（VITE_SYNC_URL），仅使用本机存储与下方的手动 JSON 备份。</p>
        <LocalSafetyCopyButton />
      </section>
    );
  }

  if (!sync.code) {
    return (
      <section className="panel cloud-sync">
        <div className="panel-head">
          <h3 className="eyebrow">云同步（可选）</h3>
          <span className="sync-badge is-off">未开启</span>
        </div>
        <p className="muted">
          使用一次性邀请码创建个人同步码，或输入已有同步码跨设备同步学习进度、卡组、作文、阅读与图片（AI Key 永不上传）。
        </p>

        <div className="segmented sync-tabs" role="tablist" aria-label="云同步配对方式">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "invite"}
            className={tab === "invite" ? "is-on" : ""}
            onClick={() => {
              setTab("invite");
              setFormError(null);
            }}
          >
            邀请码开通
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "pair"}
            className={tab === "pair" ? "is-on" : ""}
            onClick={() => {
              setTab("pair");
              setFormError(null);
            }}
          >
            已有同步码
          </button>
        </div>

        {tab === "invite" ? (
          <form className="sync-form" onSubmit={onRegister}>
            <label className="wf-field">
              <span>邀请码</span>
              <input
                type="text"
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                placeholder="输入邀请码（如 inv_...）"
                autoComplete="off"
                spellCheck={false}
                disabled={submitting}
              />
            </label>
            {formError && <p className="warn-text">{formError}</p>}
            <div className="data-actions">
              <button type="submit" className="btn btn-primary btn-sm" disabled={submitting || !inviteInput.trim()}>
                <KeyRound size={15} /> {submitting ? "正在开通…" : "注册并生成同步码"}
              </button>
            </div>
          </form>
        ) : (
          <form className="sync-form" onSubmit={onPair}>
            <label className="wf-field">
              <span>同步码</span>
              <input
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="输入已有同步码（mb2_...）"
                autoComplete="off"
                spellCheck={false}
                disabled={submitting}
              />
            </label>
            {formError && <p className="warn-text">{formError}</p>}
            <div className="data-actions">
              <button type="submit" className="btn btn-primary btn-sm" disabled={submitting || !codeInput.trim()}>
                <Cloud size={15} /> {submitting ? "正在配对…" : "配对并同步"}
              </button>
            </div>
          </form>
        )}

        <LocalSafetyCopyButton />
      </section>
    );
  }

  const status = formatSyncStatus(sync, now);

  return (
    <section className="panel cloud-sync">
      <div className="panel-head">
        <h3 className="eyebrow">云同步</h3>
        <span className={`sync-badge is-${status.tone}`}>
          <Cloud size={14} /> {status.text}
        </span>
      </div>
      <p className="muted small">已启用端到端加密（E2EE）与字段级智能合并，AI Key 永不上传。</p>

      {sync.conflict && (
        <div className="sync-conflict-banner" role="alert">
          <span>检测到云端与本机存在未解决的同步冲突。</span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => window.dispatchEvent(new CustomEvent("fb2:open-conflict"))}
          >
            处理冲突
          </button>
        </div>
      )}

      <div className="data-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => void onSyncNow()} disabled={sync.busy}>
          <RefreshCw size={15} className={sync.busy ? "spin" : ""} /> {sync.busy ? "同步中…" : "立即同步"}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            if (justCreated) {
              setJustCreated(false);
              setShowCode(false);
            } else {
              setShowCode((v) => !v);
            }
          }}
        >
          {codeVisible ? <EyeOff size={15} /> : <Eye size={15} />} {codeVisible ? "隐藏同步码" : "显示同步码"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={toggleHistory}>
          <History size={15} /> {historyOpen ? "收起历史" : "历史版本"}
        </button>
      </div>

      {codeVisible && (
        <div className="sync-code-card">
          <p className="sync-code-warn">{SYNC_CODE_WARNING}</p>
          <code className="sync-code-text">{sync.code}</code>
          <div className="sync-code-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void onCopyCode()}>
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "已复制" : "复制同步码"}
            </button>
            {justCreated && (
              <button
                type="button"
                className="link small"
                onClick={() => {
                  setJustCreated(false);
                  setShowCode(false);
                }}
              >
                我已保存，收起
              </button>
            )}
          </div>
          {qrUrl && (
            <div className="sync-qr-wrap">
              <img src={qrUrl} alt="同步码二维码" className="sync-qr" />
              <small className="muted">在其他设备扫码或复制同步码配对</small>
            </div>
          )}
        </div>
      )}

      {historyOpen && (
        <div className="sync-history">
          <div className="sync-history-head">
            <b>云端历史版本（最多保留 20 个）</b>
            <button type="button" className="link small" onClick={() => void loadHistory()} disabled={historyLoading}>
              {historyLoading ? "读取中…" : "刷新"}
            </button>
          </div>
          {historyError && <p className="warn-text">{historyError}</p>}
          {!historyLoading && !historyError && historyItems.length === 0 && (
            <p className="muted small">暂无历史版本。每次有新版本覆盖云端数据时会自动留档。</p>
          )}
          {historyItems.length > 0 && (
            <ul className="sync-history-list">
              {historyItems.map((item) => (
                <li key={item.id}>
                  <div>
                    <b>{formatDateTime(item.at)}</b>
                    <small>{formatSize(item.size)}</small>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={sync.busy || restoringId !== null}
                    onClick={() => void onRestoreHistory(item)}
                  >
                    <RotateCcw size={14} /> {restoringId === item.id ? "恢复中…" : "恢复此版本"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <LocalSafetyCopyButton />

      <div className="sync-danger-row">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void onUnpair()} disabled={sync.busy || wiping}>
          <LogOut size={15} /> 退出同步（仅本机）
        </button>
        {!confirmWipe && (
          <button
            type="button"
            className="btn btn-ghost btn-danger btn-sm"
            onClick={() => setConfirmWipe(true)}
            disabled={sync.busy || wiping}
          >
            <Trash2 size={15} /> 删除云端数据
          </button>
        )}
      </div>

      {confirmWipe && (
        <div className="sync-wipe-confirm" role="alert">
          <p className="warn-text">
            删除后云端当前备份与全部历史版本将被永久清除，当前同步码也会失效（本机数据会保留）。
          </p>
          <div className="data-actions">
            <button
              type="button"
              className="btn btn-terra btn-sm"
              disabled={wiping}
              onClick={() => void onWipeCloud()}
            >
              {wiping ? "正在删除…" : "确认删除云端数据"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={wiping} onClick={() => setConfirmWipe(false)}>
              取消
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
