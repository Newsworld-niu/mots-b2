import { Compass, Download, RotateCcw, Sparkles, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { ready, useAiConfig } from "../ai/config";
import { AiSettings } from "../ui/AiSettings";
import { Sheet } from "../ui/Sheet";
import { useAtlas } from "../atlas/context";
import { downloadBackupFile, downloadRawBackupFile, isBackupSnoozedToday, snoozeBackupToday, cloudSyncHealthy } from "../lib/backup";
import { exportDictReportsJson, useDictStore } from "../lib/lexdb/store";
import { PLACEMENT_ESTIMATE, SECTION_META } from "../lib/placement";
import { addMonthsDate, daysUntilExam } from "../lib/study-plan";
import { isMastered } from "../store/srs";
import { dayKey, importBackupAsync, MAX_DAILY_NEW, needsBackupReminder, resetProgress, store, useStore, type Settings } from "../store/store";
import { useSyncState } from "../sync/state";
import { CloudSync } from "../ui/CloudSync";
import { CountPicker } from "../ui/CountPicker";
import { EssayTrend } from "../ui/EssayTrend";
import { ExamDashboard } from "../ui/ExamDashboard";
import { PlacementTest } from "../ui/PlacementTest";
import { toast } from "../ui/Toast";
import { MockExam } from "./MockExam";
import { streakOf } from "./Today";

export function Me() {
  const atlas = useAtlas();
  const progress = useStore((s) => s.progress);
  const settings = useStore((s) => s.settings);
  const saveError = useStore((s) => s.saveError);
  const file = useRef<HTMLInputElement>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [mock, setMock] = useState(false);
  const ai = useAiConfig();
  const { reports: dictReports } = useDictStore();
  const daysLeft = daysUntilExam(settings.examDate);

  const stats = useMemo(() => {
    const cards = Object.values(progress.cards);
    const days = Object.values(progress.days);
    const r = days.reduce((n, d) => n + d.r, 0);
    const c = days.reduce((n, d) => n + d.c, 0);
    const t = days.reduce((n, d) => n + d.t, 0);
    const now = Date.now();
    const forecast = Array.from({ length: 7 }, (_, i) => {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      end.setDate(end.getDate() + i);
      const start = new Date(end);
      start.setHours(0, 0, 0, 0);
      return cards.filter((x) => (i === 0 ? x.due <= end.getTime() : x.due >= start.getTime() && x.due <= end.getTime())).length;
    });
    void now;
    return { learned: cards.length, mastered: cards.filter(isMastered).length, reviews: r, accuracy: r ? Math.round((c / r) * 100) : 0, minutes: Math.round(t / 60), forecast };
  }, [progress]);

  const set = (patch: Partial<Settings>) => store.settings(patch);
  const sync = useSyncState();
  const [backupDismissed, setBackupDismissed] = useState(isBackupSnoozedToday);
  const backupDue = useMemo(() => needsBackupReminder(progress, settings.lastBackupAt), [progress, settings.lastBackupAt]);
  const download = () => void downloadBackupFile();
  const restore = async (f: File) => {
    if (f.size > 30 * 1024 * 1024) return toast("文件太大，不像是学习备份。", "warn");
    const r = await importBackupAsync(await f.text());
    toast(r.ok ? `已恢复 ${r.cards} 个词的记忆` : r.error, r.ok ? "ok" : "warn");
  };
  const maxF = Math.max(1, ...stats.forecast);

  if (mock) return <MockExam onExit={() => setMock(false)} />;

  return (
    <div className="page me">
      <header className="page-head">
        <p className="eyebrow">我的</p>
        <h1 className="display">你的星空</h1>
      </header>

      <section className="stat-strip">
        <div>
          <dt>连续学习</dt>
          <dd>
            {streakOf(progress.days)}
            <small>天</small>
          </dd>
        </div>
        <div>
          <dt>已点亮</dt>
          <dd>{stats.learned.toLocaleString()}</dd>
        </div>
        <div>
          <dt>长期记住</dt>
          <dd>{stats.mastered.toLocaleString()}</dd>
        </div>
        <div>
          <dt>首次正确率</dt>
          <dd>
            {stats.accuracy}
            <small>%</small>
          </dd>
        </div>
        <div>
          <dt>学习时长</dt>
          <dd>
            {stats.minutes}
            <small>分钟</small>
          </dd>
        </div>
      </section>

      <div className="me-grid">
        <section className="panel">
          <h3 className="eyebrow">过去 20 周</h3>
          <Heatmap days={progress.days} />
          <p className="muted">一格是一天，颜色越深，那天答得越多。「长期记住」指记忆稳定度超过 21 天。</p>
        </section>

        <section className="panel">
          <h3 className="eyebrow">未来 7 天的复习量</h3>
          <ol className="forecast">
            {stats.forecast.map((n, i) => (
              <li key={i}>
                <span style={{ height: `${(n / maxF) * 100}%` }} />
                <b>{n}</b>
                <small>{i === 0 ? "今天" : i === 1 ? "明天" : `+${i}`}</small>
              </li>
            ))}
          </ol>
        </section>

        <div className="me-wide">
          <ExamDashboard onStartMock={() => setMock(true)} />
        </div>
        <section className="panel me-wide prep-me-panel">
          <div className="panel-head">
            <h3 className="eyebrow">DELF B2 备考档案</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setPlaceOpen(true)}>
              <Compass size={16} /> {progress.placement ? "重新摸底定级" : `摸底定级小测（${PLACEMENT_ESTIMATE}）`}
            </button>
          </div>
          <div className="prep-me-summary">
            <span>
              考期倒计时：
              <b>
                {daysLeft === null
                  ? "未设定"
                  : daysLeft > 0
                    ? `还有 ${daysLeft} 天（${settings.examDate}）`
                    : daysLeft === 0
                      ? "就是今天"
                      : `已过设定日期（${settings.examDate}）`}
              </b>
            </span>
            <span>
              目标总分：<b>{settings.targetScore} / 100</b>（每项均需约 {Math.round((settings.targetScore / 4) * 10) / 10}/25）
            </span>
            <span>
              摸底定级：
              {progress.placement ? (
                <b>
                  {atlas.cefr[progress.placement.level] ?? "B1"}（{progress.placement.score}%）
                  {progress.placement.weak.length ? ` · 薄弱：${progress.placement.weak.map((k) => SECTION_META[k].label).join("、")}` : ""}
                </b>
              ) : (
                <span className="muted">尚未测评，可选做约 10–15 分钟定级</span>
              )}
            </span>
          </div>
        </section>

        <section className="panel me-wide">
          <h3 className="eyebrow">写作进步</h3>
          <EssayTrend essays={progress.essays ?? []} />
        </section>

        <section className="panel settings">
          <h3 className="eyebrow">学习设置</h3>
          <Field
            label="考试日期"
            hint={
              daysLeft === null
                ? "设置目标考期后，首页会自动显示倒计时与四科备考配比；距考不足 6 个月时建议背词时间 ≤25%。"
                : daysLeft < 183
                  ? `距考试还有 ${Math.max(0, daysLeft)} 天（不足 6 个月，首页已开启 ≤25% 背词上限提醒）。`
                  : `距考试还有 ${daysLeft} 天。`
            }
          >
            <div className="exam-date-field">
              <input
                type="date"
                value={settings.examDate ?? ""}
                onChange={(e) => set({ examDate: e.target.value || null })}
                aria-label="考试日期"
              />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ examDate: addMonthsDate(3) })}>
                3 个月后
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ examDate: addMonthsDate(6) })}>
                6 个月后
              </button>
              {settings.examDate && (
                <button type="button" className="link small" onClick={() => set({ examDate: null })}>
                  清除
                </button>
              )}
            </div>
          </Field>
          <Field label="目标总分（/100）" hint="DELF B2 及格线为 50/100（且四项均须 ≥5/25）；默认冲刺目标 75 分。">
            <CountPicker label="目标总分" value={settings.targetScore} onChange={(n) => set({ targetScore: Math.max(50, Math.min(100, n)) })} presets={[60, 75, 85, 90]} max={100} unit=" 分" />
          </Field>
          <Field label="每日新词" hint={`想学多少自己定，1–${MAX_DAILY_NEW} 都可以。复习不设上限，算法只安排快要遗忘的词；一天新学的越多，之后几天要复习的也越多（大约是新词数的 3–5 倍）。`}>
            <CountPicker label="每日新词" value={settings.dailyNew} onChange={(n) => set({ dailyNew: n })} presets={[5, 10, 20, 30, 50, 100]} max={MAX_DAILY_NEW} />
          </Field>
          <Field label="从哪个难度开始" hint="跳过已经熟悉的低级别词。">
            <div className="segmented">
              {atlas.cefr.map((l, i) =>
                // levels with no words (C1, C2) are not offered; the index stays the same so saved settings still match
                atlas.words.some((w) => w.cefr === i) ? (
                  <button key={l} className={settings.startLevel === i ? "is-on" : ""} onClick={() => set({ startLevel: i })}>
                    {l}
                  </button>
                ) : null,
              )}
            </div>
          </Field>
          <Field label="目标记忆率" hint="越高复习越频繁。90% 是大多数人的甜点。">
            <div className="segmented">
              {[0.85, 0.9, 0.95].map((n) => (
                <button key={n} className={settings.retention === n ? "is-on" : ""} onClick={() => set({ retention: n })}>
                  {Math.round(n * 100)}%
                </button>
              ))}
            </div>
          </Field>
          <Field label="外观">
            <div className="segmented">
              {(
                [
                  ["system", "跟随系统"],
                  ["light", "浅色"],
                  ["dark", "深色"],
                ] as const
              ).map(([k, l]) => (
                <button key={k} className={settings.theme === k ? "is-on" : ""} onClick={() => set({ theme: k })}>
                  {l}
                </button>
              ))}
            </div>
          </Field>
          <Toggle label="自动播放发音" on={settings.autoplay} set={(v) => set({ autoplay: v })} />
          <Toggle label="界面音效" on={settings.sfx} set={(v) => set({ sfx: v })} />
          <Toggle label="开屏动画（每天一次）" on={settings.splash} set={(v) => set({ splash: v })} />
          <Toggle label="复习时加入拼写题" on={settings.spell} set={(v) => set({ spell: v })} />
        </section>

        <section className="panel">
          <h3 className="eyebrow">AI 接口</h3>
          <p className="muted">
            拍照识别：{ready.vision(ai) ? "已设置" : "未设置"} · 生成卡片：{ready.text(ai) ? "已设置" : "未设置"} · 生成图片：{ready.image(ai) ? "已设置" : "未设置"} · Azure 朗读：{ready.tts(ai) ? "已开启" : "未开启"}
          </p>
          <div className="data-actions">
            <button className="btn btn-ghost" onClick={() => setAiOpen(true)}>
              <Sparkles size={18} /> 设置 AI 接口
            </button>
          </div>
        </section>

        <CloudSync />

        <section className="panel">
          <h3 className="eyebrow">数据</h3>
          <p className="muted">进度默认只保存在这台设备的浏览器里；如需多设备同步，可在上方开启可选的「云同步」，或手动导出 / 导入 JSON 备份（含作文、阅读、模考题库与草稿）。</p>
          <p className="muted small">
            上次备份：{settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleDateString("zh-CN") : "尚未导出过备份"}
          </p>
          {backupDue.remind && !cloudSyncHealthy(sync) && !backupDismissed && (
            <div className="backup-remind" role="status">
              <span>已超过 {backupDue.daysSince} 天未导出备份，建议立即备份以免浏览器清理缓存丢失进度。</span>
              <button
                type="button"
                className="link small"
                onClick={() => {
                  snoozeBackupToday();
                  setBackupDismissed(true);
                }}
              >
                今天先不提醒
              </button>
            </div>
          )}
          {saveError && <p className="warn-text">浏览器拒绝保存（可能是隐私模式或空间已满）。请尽快导出备份。</p>}
          <div className="data-actions">
            <button className="btn btn-ghost" onClick={download}>
              <Download size={18} /> 导出备份
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                void downloadRawBackupFile(
                  exportDictReportsJson(),
                  `lexdb-reports-${dayKey()}.json`,
                  dictReports.length ? `已导出 ${dictReports.length} 条词典报错记录` : "已导出词典报错记录（当前为空）",
                );
              }}
            >
              <Download size={18} /> 导出词典报错记录 (JSON){dictReports.length ? ` (${dictReports.length})` : ""}
            </button>
            <button className="btn btn-ghost" onClick={() => file.current?.click()}>
              <Upload size={18} /> 导入备份
            </button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && restore(e.target.files[0]).finally(() => (e.target.value = ""))} />
            <button
              className="btn btn-ghost btn-danger"
              onClick={() => {
                if (confirm("确定清空这个词库的全部学习记录？此操作无法撤销，建议先导出备份。")) {
                  resetProgress();
                  toast("学习记录已清空");
                }
              }}
            >
              <RotateCcw size={18} /> 清空记录
            </button>
          </div>
        </section>
      </div>
      <Sheet open={aiOpen} onClose={() => setAiOpen(false)} label="AI 接口">
        <h2 className="sheet-title">AI 接口</h2>
        {aiOpen && <AiSettings />}
      </Sheet>
      <Sheet open={placeOpen} onClose={() => setPlaceOpen(false)} label="摸底定级小测" wide>
        <h2 className="sheet-title">摸底定级小测</h2>
        {placeOpen && (
          <PlacementTest
            initial={progress.placement}
            onCancel={() => setPlaceOpen(false)}
            onApply={(res) => {
              store.progress((p) => ({ ...p, placement: res }));
              set({ startLevel: res.level });
              setPlaceOpen(false);
              toast(`已定级为 ${atlas.cefr[res.level] ?? "B1"}，并更新学习起点`, "ok");
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <div>
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="field toggle">
      <b>{label}</b>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => set(e.target.checked)} />
      <span className="switch" aria-hidden="true" />
    </label>
  );
}

function Heatmap({ days }: { days: Record<string, { r: number }> }) {
  const weeks = 20;
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (weeks * 7 - 1) - end.getDay());
  const cells: { k: string; v: number; future: boolean }[] = [];
  const d = new Date(start);
  for (let i = 0; i < (weeks + 1) * 7; i++) {
    const k = dayKey(d);
    cells.push({ k, v: days[k]?.r ?? 0, future: d > end });
    d.setDate(d.getDate() + 1);
  }
  const lvl = (v: number) => (v === 0 ? 0 : v < 10 ? 1 : v < 25 ? 2 : v < 50 ? 3 : 4);
  return (
    <div className="heatmap" role="img" aria-label="学习热力图">
      {cells.map((c) => (
        <span key={c.k} className={`h${c.future ? "x" : lvl(c.v)}`} title={`${c.k} · ${c.v} 题`} />
      ))}
    </div>
  );
}
