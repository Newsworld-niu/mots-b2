import { Download, Upload, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
import { WORD_BY_ID } from "../data";
import { go } from "../lib/router";
import { masteredCount } from "../store/session";
import { isMastered } from "../store/srs";
import { store, useStore } from "../store/store";

export function Me() {
  const progress = useStore((s) => s.progress);
  const settings = useStore((s) => s.settings);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const learned = Object.keys(progress.cards).length;
  const mastered = masteredCount(progress);
  const days = Object.values(progress.days);
  const reviews = days.reduce((a, d) => a + d.r, 0);
  const correct = days.reduce((a, d) => a + d.c, 0);
  const minutes = Math.round(days.reduce((a, d) => a + d.t, 0) / 60);
  const accuracy = reviews ? Math.round((correct / reviews) * 100) : null;

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ progress, settings }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mots-b2-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg("已导出备份。换设备前，请把这个文件导入新设备。");
  };

  const importData = async (file: File) => {
    try {
      const ok = store.replace(JSON.parse(await file.text()));
      setMsg(ok ? "导入成功，学习进度已恢复。" : "导入失败：文件不是有效的 Mots B2 备份。");
    } catch {
      setMsg("导入失败：无法解析该文件。");
    }
  };

  const mistakes = progress.mistakes.slice(0, 20).map((id) => WORD_BY_ID.get(id)).filter(Boolean);

  return (
    <div className="page me">
      <header className="page-head">
        <p className="eyebrow">我的</p>
        <h1 className="display">学习记录与设置</h1>
        <p className="lede">没有账号。进度只保存在这台设备的浏览器里，换设备前请先导出备份。</p>
      </header>

      <div className="me-grid">
        <section className="panel">
          <h3 className="eyebrow">学习概况</h3>
          <dl className="mini-stats big">
            <div>
              <dt>已学</dt>
              <dd>{learned}</dd>
            </div>
            <div>
              <dt>已掌握</dt>
              <dd>{mastered}</dd>
            </div>
            <div>
              <dt>首次正确率</dt>
              <dd>{accuracy === null ? "—" : `${accuracy}%`}</dd>
            </div>
            <div>
              <dt>学习时长</dt>
              <dd>{minutes} 分</dd>
            </div>
          </dl>
          <p className="memory-note">
            已掌握的定义：FSRS 稳定度 ≥ 21 天，且处于复习状态。当前 {Object.values(progress.cards).filter(isMastered).length} 个词符合条件。
          </p>
        </section>

        <section className="panel">
          <h3 className="eyebrow">学习设置</h3>
          <label className="field">
            <span>每日新词</span>
            <select value={settings.dailyNew} onChange={(e) => store.settings({ dailyNew: Number(e.target.value) })}>
              {[4, 8, 12, 16].map((n) => (
                <option key={n} value={n}>
                  {n} 个 / 天
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>目标记忆率</span>
            <select value={settings.retention} onChange={(e) => store.settings({ retention: Number(e.target.value) })}>
              <option value={0.85}>85%（复习更少）</option>
              <option value={0.9}>90%（推荐）</option>
              <option value={0.93}>93%（复习更多）</option>
            </select>
          </label>
          <label className="field">
            <span>朗读语速 {settings.rate.toFixed(1)}</span>
            <input type="range" min={0.6} max={1.2} step={0.1} value={settings.rate} onChange={(e) => store.settings({ rate: Number(e.target.value) })} />
          </label>
          <label className="toggle">
            <input type="checkbox" checked={settings.autoplay} onChange={(e) => store.settings({ autoplay: e.target.checked })} />
            <span>听音辨词时自动朗读</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={settings.spell} onChange={(e) => store.settings({ spell: e.target.checked })} />
            <span>熟练词加入拼写题</span>
          </label>
          <label className="field">
            <span>外观</span>
            <select value={settings.theme} onChange={(e) => store.settings({ theme: e.target.value as "system" | "light" | "dark" })}>
              <option value="dark">深色</option>
              <option value="light">浅色</option>
              <option value="system">跟随系统</option>
            </select>
          </label>
        </section>

        <section className="panel">
          <h3 className="eyebrow">需要再看的词</h3>
          {mistakes.length ? (
            <ul className="mistakes">
              {mistakes.map((w) => (
                <li key={w!.id}>
                  <button className="link" onClick={() => go("atlas", { word: w!.id })} lang="fr">
                    {w!.w}
                  </button>
                  <small>{w!.senses[0].zh}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">暂无错题。答错的词会出现在这里。</p>
          )}
        </section>

        <section className="panel">
          <h3 className="eyebrow">备份与重置</h3>
          <div className="data-actions">
            <button className="btn btn-glass" onClick={exportData}>
              <Download size={16} /> 导出备份
            </button>
            <button className="btn btn-glass" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> 导入备份
            </button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
            <button
              className="btn btn-glass danger"
              onClick={() => {
                if (confirm("确定清空所有学习进度吗？此操作无法撤销（建议先导出备份）。")) {
                  store.reset();
                  setMsg("学习进度已清空。");
                }
              }}
            >
              <RotateCcw size={16} /> 清空进度
            </button>
          </div>
          {msg && <p className="memory-note" role="status">{msg}</p>}
        </section>
      </div>
    </div>
  );
}
