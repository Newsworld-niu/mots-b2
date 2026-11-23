import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { downloadRawBackupFile } from "../lib/backup";
import { dayKey } from "../store/store";
import { resolveConflict } from "../sync/engine";
import { useSyncState, type BackupSummary } from "../sync/state";
import { Sheet } from "./Sheet";

function formatExported(exported: string | null): string {
  if (!exported) return "未知";
  const d = new Date(exported);
  if (Number.isNaN(d.getTime())) return exported;
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SummaryColumn({ title, badge, summary }: { title: string; badge: string; summary: BackupSummary }) {
  return (
    <div className="sync-compare-col">
      <div className="sync-compare-head">
        <b>{title}</b>
        <span>{badge}</span>
      </div>
      <dl className="sync-compare-dl">
        <div>
          <dt>导出时间</dt>
          <dd>{formatExported(summary.exported)}</dd>
        </div>
        <div>
          <dt>词数</dt>
          <dd>{summary.cards.toLocaleString()} 词</dd>
        </div>
        <div>
          <dt>作文数</dt>
          <dd>{summary.essays.toLocaleString()} 篇</dd>
        </div>
        <div>
          <dt>最后学习日</dt>
          <dd>{summary.lastDay ?? "无"}</dd>
        </div>
      </dl>
    </div>
  );
}

export function SyncConflictDialog() {
  const { conflict, busy } = useSyncState();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(false);
  }, [conflict]);

  useEffect(() => {
    const onReopen = () => setHidden(false);
    window.addEventListener("fb2:open-conflict", onReopen);
    return () => window.removeEventListener("fb2:open-conflict", onReopen);
  }, []);

  return (
    <Sheet open={!!conflict && !hidden} onClose={() => setHidden(true)} label="云端同步冲突">
      {conflict && (
        <div className="sync-conflict-dialog">
          <h2 className="sheet-title">云端与本机数据存在差异</h2>
          <p className="muted">
            两台设备各自保留了独立进度。推荐使用智能合并，保留两端的背词记录、作文与错题：
          </p>

          <div className="sync-compare">
            <SummaryColumn title="云端版本" badge="服务器最新" summary={conflict.remoteSummary} />
            <SummaryColumn title="本机版本" badge="当前设备" summary={conflict.localSummary} />
          </div>

          <p className="sync-conflict-note">
            提示：合并或覆盖前，系统会自动把当前本机数据存为安全副本（可在「我的 → 云同步」下载）；覆盖云端时，旧云端版本仍会留在「历史版本」中。
          </p>

          <div className="sync-conflict-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void resolveConflict("merge")}
            >
              {busy ? "处理中…" : "智能合并两端（推荐）"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => void resolveConflict("remote")}
            >
              {busy ? "处理中…" : "仅用云端"}
            </button>
            <button
              type="button"
              className="btn btn-terra"
              disabled={busy}
              onClick={() => void resolveConflict("local")}
            >
              {busy ? "处理中…" : "仅用本机"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() =>
                void downloadRawBackupFile(
                  conflict.localJson,
                  `atlas-du-francais-conflict-local-${dayKey()}.json`,
                  "已下载当前本机备份",
                )
              }
            >
              <Download size={16} /> 下载本机备份
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
