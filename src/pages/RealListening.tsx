/**
 * 真实材料精听: bundled RFI "Journal en français facile" episodes, FEI official link + local MP3/PDF importer (IndexedDB),
 * and exam-mode two-play blind listening -> graded questions -> examLog -> sentence dictation -> shadowing.
 */
import { ArrowLeft, ArrowRight, Check, Download, ExternalLink, Radio, Trash2 } from "lucide-react";
import { useState } from "react";
import { clock } from "../lib/exam";
import { REAL_SITES } from "../lib/listening";
import { FEI_OFFICIAL_SAMPLES, PREBUILT_FAST_CHRONICLES, PREBUILT_REAL_SOURCES } from "../lib/real-presets";
import { deleteSource, ensurePresetSource } from "../store/sources";
import { useStore } from "../store/store";
import { confirmAction } from "../ui/ConfirmSheet";
import { WordPopup } from "../ui/WordPopup";
import { Flow } from "./listening/ListeningFlow";
import { AddSource } from "./listening/SourcePlayer";
import { day, useOfflineMedia } from "./listening/useOfflineMedia";
import "../styles/listening.css";

export { OFFLINE_MEDIA_CACHE, resolveOfflineMediaUrl } from "./listening/useOfflineMedia";

export function RealListening({ onExit }: { onExit: () => void }) {
  return (
    <WordPopup>
      <RealListeningBody onExit={onExit} />
    </WordPopup>
  );
}

function RealListeningBody({ onExit }: { onExit: () => void }) {
  const sources = useStore((s) => s.progress.listenSources) ?? [];
  const examLog = useStore((s) => s.progress.examLog) ?? [];
  const [open, setOpen] = useState<string | null>(null);
  const offline = useOfflineMedia();
  const cur = sources.find((s) => s.id === open) ?? PREBUILT_FAST_CHRONICLES.find((s) => s.id === open);
  if (cur) return <Flow key={cur.id} src={cur} offline={offline} onBack={() => setOpen(null)} />;
  return (
    <div className="page practice">
      <header className="page-head">
        <button className="link deck-back" onClick={onExit}>
          <ArrowLeft size={16} /> 返回听力理解
        </button>
        <p className="eyebrow">真实材料精听与考场盲听</p>
        <h1 className="display">听真人说话，按考场两遍盲听脱敏。</h1>
        <p className="lede">
          已内置 4 篇 ~170 WPM 母语常速广播专题（3 分钟考场切片 · CC BY 4.0）与 6 期 RFI《Journal en français facile》真实广播（含音频、完整原文与 7 题 B2 测试）；也可导入下载到本地的 FEI 官方样题 `.mp3` / `.pdf`（保存在本地 IndexedDB，刷新不丢失）。
        </p>
        <p>
          <a className="btn btn-ghost btn-sm" href="#/lounge?shelf=videos">
            想看视频或纯磨耳朵？去漫游影院 →
          </a>
        </p>
      </header>

      <section className="panel" aria-label="母语常速广播专题">
        <div className="panel-head">
          <h3 className="eyebrow">母语常速广播专题 · ~170 WPM（3 分钟考场切片 · CC BY 4.0）</h3>
          <span className="muted small">弥补 RFI 慢速新闻（~125 WPM）与真实 DELF / TCF / TEF 电台语速差距</span>
        </div>
        <ul className="bank-list">
          {PREBUILT_FAST_CHRONICLES.map((p) => {
            const saved = sources.find((s) => s.presetId === p.presetId || s.id === p.id);
            const lastExam = examLog.find((r) => r.what === `real:${p.presetId}`);
            return (
              <li key={p.id}>
                <div>
                  <strong>{p.title}</strong>
                  <div className="muted small">
                    {p.subtitle}
                    {saved?.done ? ` · ${day(saved.done)} 练过` : lastExam ? ` · ${day(lastExam.at)} 实测 ${lastExam.score}/${lastExam.total}` : ""}
                  </div>
                  <div className="real-tags">
                    {p.tags.map((t) => (
                      <span key={t} className="real-tag">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="exam-doc-actions">
                  <span className="chip">
                    <Radio size={13} /> ~170 WPM 多声部合成
                  </span>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      ensurePresetSource(p);
                      setOpen(p.id);
                    }}
                  >
                    进入练习 <ArrowRight size={14} />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel">
        <h3 className="eyebrow">开箱即用 · RFI 真实电台（6 期）</h3>
        <ul className="bank-list">
          {PREBUILT_REAL_SOURCES.map((p) => {
            const saved = sources.find((s) => s.presetId === p.presetId || s.id === p.id);
            const isCached = offline.has(p.url);
            const isBusy = offline.busy === p.url;
            return (
              <li key={p.id}>
                <div>
                  <strong>{p.title}</strong>
                  <div className="muted small">
                    {p.subtitle}
                    {saved?.done ? ` · ${day(saved.done)} 练过` : ""}
                  </div>
                  <div className="real-tags">
                    {p.tags.map((t) => (
                      <span key={t} className="real-tag">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="exam-doc-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={isBusy}
                    aria-pressed={isCached}
                    onClick={() => void (isCached ? offline.remove(p.url) : offline.download(p.url, p.pdfUrl))}
                  >
                    {isBusy ? (
                      "下载中…"
                    ) : isCached ? (
                      <>
                        <Check size={14} /> 已离线缓存
                      </>
                    ) : (
                      <>
                        <Download size={14} /> 下载到离线
                      </>
                    )}
                  </button>
                  <button className="btn btn-primary" onClick={() => setOpen(ensurePresetSource(p))}>
                    进入练习 <ArrowRight size={14} />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel">
        <h3 className="eyebrow">FEI 官方样题与免费真实电台</h3>
        <ul className="essay-box-list">
          {FEI_OFFICIAL_SAMPLES.map((f) => (
            <li key={f.id}>
              <a className="link" href={f.url} target="_blank" rel="noreferrer">
                {f.title} <ExternalLink size={12} />
              </a>{" "}
              <span className="muted small">{f.zh}</span>
            </li>
          ))}
          {REAL_SITES.slice(2).map((s) => (
            <li key={s.url}>
              <a className="link" href={s.url} target="_blank" rel="noreferrer">
                {s.name} <ExternalLink size={12} />
              </a>{" "}
              <span className="muted small">{s.zh}</span>
            </li>
          ))}
        </ul>
      </section>

      <AddSource onAdded={setOpen} />

      {sources.length > 0 && (
        <section className="essay-level">
          <h3 className="eyebrow">我的练习材料与已导入文件</h3>
          <ul className="bank-list">
            {sources.map((s) => (
              <li key={s.id}>
                <span>
                  {s.title}{" "}
                  <span className="muted small">
                    · {s.end > s.start ? `${clock(s.start)}–${clock(s.end)}` : "全段"}
                    {s.url.startsWith("idb:") ? " · 本地音频(IndexedDB)" : ""}
                    {s.pdfUrl ? " · 含文档/PDF" : ""}
                    {s.transcript ? " · 有原文" : ""}
                    {s.done ? ` · ${day(s.done)} 练过` : ""}
                  </span>
                </span>
                <span className="exam-doc-actions">
                  <button className="link" onClick={() => setOpen(s.id)}>
                    开始 <ArrowRight size={14} />
                  </button>
                  <button
                    className="link"
                    onClick={async () => {
                      if (
                        await confirmAction({
                          title: "删除这条真实听力材料？",
                          message: "将一并移除本地缓存的音频、PDF 与笔记，且无法撤销。",
                          confirmLabel: "删除",
                          danger: true,
                        })
                      ) {
                        deleteSource(s.id);
                      }
                    }}
                    title="删除"
                    aria-label={`删除 ${s.title}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
