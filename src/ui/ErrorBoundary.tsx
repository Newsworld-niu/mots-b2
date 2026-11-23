import { Component, type ErrorInfo, type ReactNode } from "react";
import { downloadRawBackupFile } from "../lib/backup";
import { dayKey, exportBackup, exportBackupAsync } from "../store/store";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  exporting: boolean;
}

const CHUNK_RELOAD_KEY = "fb2.chunk-reload";

export function isChunkLoadError(err: Error | null | undefined): boolean {
  if (!err) return false;
  const msg = `${err.name || ""} ${err.message || ""}`;
  return /Failed to fetch dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError/i.test(
    msg,
  );
}

function tryControlledReload(): boolean {
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
    const prev = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || "0");
    if (Number.isFinite(prev) && Date.now() - prev < 15_000) return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, exporting: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unhandled UI error:", error, info.componentStack);
    if (isChunkLoadError(error)) {
      tryControlledReload();
    }
  }

  private async exportEmergencyBackup() {
    this.setState({ exporting: true });
    try {
      const json = await exportBackupAsync().catch(() => exportBackup());
      await downloadRawBackupFile(json, `mots-b2-emergency-backup-${dayKey()}.json`, "已导出紧急学习备份");
    } finally {
      this.setState({ exporting: false });
    }
  }

  private goHome = () => {
    window.location.hash = "#/";
    this.setState({ error: null });
  };

  render() {
    const { error, exporting } = this.state;
    if (!error) return this.props.children;
    const chunkErr = isChunkLoadError(error);

    return (
      <main role="alert" className="error-boundary-card">
        <p className="eyebrow">系统保护</p>
        <h1 className="display error-boundary-title">
          {chunkErr ? "页面资源需要刷新更新" : "页面遇到意外错误"}
        </h1>
        <p className="muted">
          {chunkErr
            ? "应用已发布新版本，或当前处于离线状态且该页面尚未缓存。点击「重新加载」即可获取最新资源；你的学习记录均安全保存在本机。"
            : "你的学习记录、生词与作文均安全保存在本机。可以先导出一份 JSON 备份，再返回首页继续学习。"}
        </p>

        <details className="error-boundary-details">
          <summary className="error-boundary-summary">查看错误详情</summary>
          <pre className="error-boundary-pre">
            {error.message || String(error)}
          </pre>
        </details>

        <div className="data-actions error-boundary-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={exporting}
            onClick={() => void this.exportEmergencyBackup()}
          >
            {exporting ? "正在打包备份…" : "导出紧急学习备份 (JSON)"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={this.goHome}>
            回到首页
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => window.location.reload()}>
            重新加载
          </button>
        </div>
      </main>
    );
  }
}
