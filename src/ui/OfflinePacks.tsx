import { Check, Download, HardDrive, ShieldCheck, Square, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAtlas } from "../atlas/context";
import {
  clearAllOfflineMedia,
  downloadOfflinePack,
  formatBytes,
  getOfflinePacks,
  inspectOfflinePacks,
  readStorageEstimate,
  removeOfflinePack,
  requestPersistentStorage,
  type OfflinePack,
  type OfflinePackId,
  type OfflinePackStatus,
  type StorageStats,
} from "../lib/offline-packs";
import { clearAllLoungeIdb, estimateLoungeIdbBytes } from "../store/lounge";
import { confirmAction } from "./ConfirmSheet";
import { toast } from "./Toast";

export function OfflinePacks() {
  const atlas = useAtlas();
  const [packs, setPacks] = useState<OfflinePack[]>([]);
  const [statuses, setStatuses] = useState<Record<string, OfflinePackStatus>>({});
  const [storage, setStorage] = useState<StorageStats>({ supported: false, usage: 0, quota: 0, persisted: null });
  const [loungeStats, setLoungeStats] = useState({ booksBytes: 0, videosBytes: 0, bookCount: 0, videoCount: 0 });
  const [activeId, setActiveId] = useState<OfflinePackId | null>(null);
  const [prog, setProg] = useState<{ done: number; total: number } | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    const list = await getOfflinePacks(atlas);
    setPacks(list);
    const [st, est, lb] = await Promise.all([
      inspectOfflinePacks(list),
      readStorageEstimate(),
      estimateLoungeIdbBytes().catch(() => ({ booksBytes: 0, videosBytes: 0, bookCount: 0, videoCount: 0 })),
    ]);
    setStatuses(Object.fromEntries(st.map((s) => [s.id, s])));
    setStorage(est);
    setLoungeStats(lb);
  }, [atlas]);

  useEffect(() => {
    void refresh();
    return () => {
      ctrlRef.current?.abort();
    };
  }, [refresh]);

  const startDownload = async (pack: OfflinePack) => {
    if (activeId) return;
    const ac = new AbortController();
    ctrlRef.current = ac;
    setActiveId(pack.id);
    setProg({ done: statuses[pack.id]?.cached ?? 0, total: pack.urls.length });
    try {
      const res = await downloadOfflinePack(pack, {
        signal: ac.signal,
        onProgress: (p) => setProg({ done: p.done, total: p.total }),
      });
      await refresh();
      toast(`「${pack.title}」已离线就绪（${res.cached}/${res.total}）`, "ok");
    } catch (err) {
      await refresh();
      if ((err as Error)?.name === "AbortError") toast("已取消下载，已完成部分会保留以便断点续传");
      else toast((err as Error)?.message || "离线包下载失败，请检查网络连接", "warn");
    } finally {
      if (ctrlRef.current === ac) ctrlRef.current = null;
      setActiveId(null);
      setProg(null);
    }
  };

  const removePack = async (pack: OfflinePack) => {
    if (activeId) return;
    await removeOfflinePack(pack);
    await refresh();
    toast(`已清理「${pack.title}」缓存`);
  };

  const clearAll = async () => {
    if (activeId) return;
    const ok = await confirmAction({
      title: "清空全部离线媒体缓存？",
      message: "仅清理已下载的离线音频包，不会删除任何学习进度、FSRS 记忆或作文记录。",
      confirmLabel: "清空离线缓存",
      danger: true,
    });
    if (!ok) return;
    await clearAllOfflineMedia();
    await refresh();
    toast("离线媒体缓存已清空");
  };

  const clearLounge = async () => {
    if (activeId) return;
    const ok = await confirmAction({
      title: "清空漫游馆本地导入电子书与视频？",
      message: "将移除本地导入到 IndexedDB 的电子书（.epub/.txt）、本地视频与挂载字幕，不会删除阅读进度或收藏实例。",
      confirmLabel: "清空漫游馆本地导入",
      danger: true,
    });
    if (!ok) return;
    await clearAllLoungeIdb();
    await refresh();
    toast("漫游馆本地导入电子书与视频已清空");
  };

  const requestPersist = async () => {
    const granted = await requestPersistentStorage();
    const est = await readStorageEstimate();
    setStorage(est);
    toast(granted ? "已获浏览器的持久存储保护" : "浏览器未授予持久存储权限，请定期导出备份", granted ? "ok" : "warn");
  };

  const pct = storage.quota > 0 ? Math.min(100, Math.max(0, Math.round((storage.usage / storage.quota) * 100))) : 0;

  return (
    <section className="panel" aria-labelledby="offline-packs-heading">
      <div className="offline-head">
        <div>
          <h2 id="offline-packs-heading" className="eyebrow">
            离线学习包与存储配额
          </h2>
          <p className="muted">
            提前缓存音频包后，无网络环境（考场或飞行模式）也可稳定播放 CO 真题与 RFI 广播。
          </p>
        </div>
        {storage.supported && (
          <div className="offline-quota-box">
            <div className="offline-quota-row">
              <span className="offline-quota-label">
                <HardDrive size={15} /> 已用 {formatBytes(storage.usage)} / {storage.quota > 0 ? formatBytes(storage.quota) : "未知上限"}
              </span>
              {storage.persisted === true ? (
                <span className="chip is-pass">
                  <ShieldCheck size={13} /> 已持久保护
                </span>
              ) : (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void requestPersist()}>
                  <ShieldCheck size={14} /> 申请持久存储
                </button>
              )}
            </div>
            <div className="offline-meter" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="存储占用比例">
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      <ul className="offline-pack-list">
        {packs.map((pack) => {
          const st = statuses[pack.id];
          const busy = activeId === pack.id;
          const ready = Boolean(st?.ready);
          const partial = Boolean(st && st.cached > 0 && !st.ready);
          const curDone = busy && prog ? prog.done : st?.cached ?? 0;
          const curTotal = busy && prog ? prog.total : st?.total ?? pack.urls.length;
          const itemPct = curTotal > 0 ? Math.round((curDone / curTotal) * 100) : 0;
          const sizeLabel = st && st.bytes > 0 ? `已占用 ${formatBytes(st.bytes)}` : `预计约 ${formatBytes(pack.estimatedBytes)}`;

          return (
            <li key={pack.id} className={`offline-pack-card ${ready ? "is-ready" : ""}`}>
              <div className="offline-pack-info">
                <div className="offline-pack-title-row">
                  <strong>{pack.title}</strong>
                  <span className={`chip ${ready ? "is-pass" : ""}`}>
                    {busy ? `下载中 ${curDone}/${curTotal}` : ready ? `已就绪 (${curTotal}/${curTotal})` : partial ? `已缓存 ${curDone}/${curTotal}` : "未下载"}
                  </span>
                </div>
                <p className="muted small">
                  {pack.desc} · {sizeLabel}
                </p>
                {(busy || partial) && (
                  <div className="offline-meter is-pack" aria-hidden="true">
                    <span style={{ width: `${itemPct}%` }} />
                  </div>
                )}
              </div>
              <div className="offline-pack-actions">
                {busy ? (
                  <button type="button" className="btn btn-ghost" onClick={() => ctrlRef.current?.abort()}>
                    <Square size={15} /> 停止下载
                  </button>
                ) : ready ? (
                  <button type="button" className="btn btn-ghost" disabled={activeId !== null} onClick={() => void removePack(pack)}>
                    <Check size={15} /> 删除缓存包
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={activeId !== null || pack.urls.length === 0}
                      onClick={() => void startDownload(pack)}
                    >
                      <Download size={15} /> {partial ? "断点续传" : "下载离线包"}
                    </button>
                    {partial && (
                      <button type="button" className="btn btn-ghost" disabled={activeId !== null} onClick={() => void removePack(pack)}>
                        <Trash2 size={15} /> 清理已下部分
                      </button>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="muted small">
        漫游馆本地导入（电子书 {loungeStats.bookCount} 本 / 视频 {loungeStats.videoCount} 部）：已占用{" "}
        {formatBytes(loungeStats.booksBytes + loungeStats.videosBytes)}
      </p>

      <div className="data-actions">
        <button type="button" className="btn btn-ghost" disabled={activeId !== null} onClick={() => void clearAll()}>
          <Trash2 size={16} /> 清空离线媒体缓存
        </button>
        <button type="button" className="btn btn-ghost" disabled={activeId !== null} onClick={() => void clearLounge()}>
          <Trash2 size={16} /> 清空漫游馆本地导入电子书与视频
        </button>
      </div>
    </section>
  );
}
