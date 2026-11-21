/**
 * 真实材料精听: bundled RFI "Journal en français facile" episodes, FEI official link + local MP3/PDF importer (IndexedDB),
 * and exam-mode two-play blind listening -> graded questions -> examLog -> sentence dictation -> shadowing.
 */
import { ArrowLeft, ArrowRight, Check, Download, ExternalLink, FileText, Lock, Play, Plus, Rewind, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ready, useAiConfig } from "../ai/config";
import { questionsForTranscript } from "../ai/tasks";
import { clock, type CompExercise } from "../lib/exam";
import { parseClock, playerFor, REAL_SITES, resolveMaterialUrl, type RealSource } from "../lib/listening";
import { FEI_OFFICIAL_SAMPLES, PREBUILT_REAL_SOURCES, realPresetQuiz } from "../lib/real-presets";
import { href } from "../lib/router";
import { audioMediaKey, getRealMedia, pdfMediaKey, saveRealMedia } from "../store/real-media";
import { addSource, deleteSource, ensurePresetSource, newSourceId, patchSource, recordRealListenScore } from "../store/sources";
import { useStore } from "../store/store";
import { toast } from "../ui/Toast";
import { TranscriptWords } from "../ui/TranscriptWords";
import { WordPopup } from "../ui/WordPopup";
import { IntensiveDoc } from "./Intensive";
import "../styles/listening.css";

const STEPS = ["盲听", "答题", "逐句听写", "跟读"] as const;
type ExamPhase = "idle" | "prep" | "play1" | "gap" | "play2" | "review";
const PHASE_LABEL: Record<ExamPhase, string> = {
  idle: "准备开始考场两遍限时盲听",
  prep: "读题准备（30 秒）",
  play1: "第一遍播音中（不可回放）",
  gap: "整理笔记间隔（30 秒）",
  play2: "第二遍播音中（不可回放）",
  review: "两遍播音结束，请进入「答题」核对得分",
};
const day = (ms: number) => new Date(ms).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
const baseUrl = () => import.meta.env.BASE_URL || "/";
export const OFFLINE_MEDIA_CACHE = "atlas-offline-media";

export function resolveOfflineMediaUrl(rawUrl: string): string | null {
  if (!rawUrl || /^idb:/i.test(rawUrl) || typeof window === "undefined") return null;
  if (!/^materials\//i.test(rawUrl) && !/\.(mp3|m4a|aac|ogg|oga|wav|mp4|webm|m4v)(\?|$)/i.test(rawUrl)) return null;
  try {
    const resolved = new URL(resolveMaterialUrl(rawUrl, baseUrl()), window.location.href);
    if (resolved.origin !== window.location.origin) return null;
    resolved.hash = "";
    return resolved.href;
  } catch {
    return null;
  }
}

interface OfflineMediaState {
  has: (rawUrl: string) => boolean;
  busy: string | null;
  download: (rawUrl: string, extraUrl?: string) => Promise<void>;
  remove: (rawUrl: string) => Promise<void>;
}

function useOfflineMedia(): OfflineMediaState {
  const [cached, setCached] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const sync = useCallback(async () => {
    if (typeof caches === "undefined") return;
    try {
      const cache = await caches.open(OFFLINE_MEDIA_CACHE);
      const keys = await cache.keys();
      setCached(new Set(keys.map((req) => req.url.split("#")[0])));
    } catch {
      /* CacheStorage unavailable */
    }
  }, []);

  useEffect(() => {
    void sync();
  }, [sync]);

  const has = useCallback(
    (rawUrl: string) => {
      const abs = resolveOfflineMediaUrl(rawUrl);
      return abs ? cached.has(abs) : false;
    },
    [cached],
  );

  const download = useCallback(
    async (rawUrl: string, extraUrl?: string) => {
      const abs = resolveOfflineMediaUrl(rawUrl);
      if (!abs) return toast("当前音频来源不支持离线缓存", "warn");
      if (typeof caches === "undefined") return toast("当前浏览器环境不支持离线 CacheStorage", "warn");
      setBusy(rawUrl);
      try {
        const res = await fetch(abs, { cache: "no-store" });
        const ct = res.headers.get("content-type") || "";
        if (!res.ok || ct.includes("text/html")) throw new Error("音频下载失败");
        const cache = await caches.open(OFFLINE_MEDIA_CACHE);
        await cache.put(abs, res);
        if (extraUrl && /^materials\//i.test(extraUrl) && typeof window !== "undefined") {
          const extraAbs = new URL(resolveMaterialUrl(extraUrl, baseUrl()), window.location.href).href.split("#")[0];
          const extraRes = await fetch(extraAbs, { cache: "no-store" }).catch(() => null);
          if (extraRes?.ok) await cache.put(extraAbs, extraRes);
        }
        await sync();
        toast("已下载到离线缓存，断网也可播放");
      } catch (e) {
        toast((e as Error).message || "下载到离线失败，请检查网络连接", "warn");
      } finally {
        setBusy((cur) => (cur === rawUrl ? null : cur));
      }
    },
    [sync],
  );

  const remove = useCallback(
    async (rawUrl: string) => {
      const abs = resolveOfflineMediaUrl(rawUrl);
      if (!abs || typeof caches === "undefined") return;
      setBusy(rawUrl);
      try {
        const cache = await caches.open(OFFLINE_MEDIA_CACHE);
        await cache.delete(abs);
        await sync();
        toast("已从离线缓存移除");
      } catch {
        toast("移除离线缓存失败", "warn");
      } finally {
        setBusy((cur) => (cur === rawUrl ? null : cur));
      }
    },
    [sync],
  );

  return { has, busy, download, remove };
}

export function RealListening({ onExit }: { onExit: () => void }) {
  return (
    <WordPopup>
      <RealListeningBody onExit={onExit} />
    </WordPopup>
  );
}

function RealListeningBody({ onExit }: { onExit: () => void }) {
  const sources = useStore((s) => s.progress.listenSources) ?? [];
  const [open, setOpen] = useState<string | null>(null);
  const offline = useOfflineMedia();
  const cur = sources.find((s) => s.id === open);
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
          已内置 6 期 RFI《Journal en français facile》真实广播（含音频、完整原文与 7 题 B2 测试，点击「下载到离线」即可断网播放）；也可导入下载到本地的 FEI 官方样题 `.mp3` / `.pdf`（保存在本地 IndexedDB，刷新不丢失）。
        </p>
      </header>

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
                  <button className="link" onClick={() => confirm("删除这条材料及其本地音频/PDF？") && deleteSource(s.id)} title="删除">
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

function AddSource({ onAdded }: { onAdded: (id: string) => void }) {
  const [mode, setMode] = useState<"local" | "link">("local");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("0:00");
  const [end, setEnd] = useState("0:00");
  const [transcript, setTranscript] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const add = async () => {
    const a = parseClock(start);
    const b = parseClock(end);
    if (Number.isNaN(a) || Number.isNaN(b) || (b > 0 && b <= a)) return toast("起止时间写成 分:秒（结束填 0:00 表示听到结尾）", "warn");
    if (mode === "link" && !/^https?:\/\//i.test(url.trim())) return toast("请填 http(s) 开头的链接", "warn");
    if (mode === "local" && !audioFile) return toast("请选择一个本地音频文件（.mp3 / .m4a / .wav）", "warn");

    setSaving(true);
    try {
      const id = newSourceId();
      let finalUrl = url.trim();
      let finalPdf: string | undefined;
      if (audioFile) {
        const key = audioMediaKey(id);
        const ok = await saveRealMedia(key, audioFile, audioFile.name, audioFile.type || "audio/mpeg");
        if (!ok) return toast("浏览器禁止写入 IndexedDB，无法持久化本地文件", "warn");
        finalUrl = `idb:${key}`;
      }
      if (pdfFile) {
        const pKey = pdfMediaKey(id);
        const ok = await saveRealMedia(pKey, pdfFile, pdfFile.name, pdfFile.type || "application/pdf");
        if (ok) finalPdf = `idb:${pKey}`;
      }
      const autoTitle = title.trim() || audioFile?.name.replace(/\.[^.]+$/, "") || url.trim();
      const addedId = addSource({ id, url: finalUrl, pdfUrl: finalPdf, title: autoTitle, start: a, end: b, transcript });
      setAudioFile(null);
      setPdfFile(null);
      toast("已存入本地 IndexedDB");
      onAdded(addedId);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel real-flow">
      <h3 className="eyebrow">导入本地真题文件 / 添加外部链接</h3>
      <div className="segmented" role="group" aria-label="导入方式">
        <button className={mode === "local" ? "is-on" : ""} onClick={() => setMode("local")} aria-pressed={mode === "local"}>
          <Upload size={14} /> 导入本地 .mp3 / .pdf
        </button>
        <button className={mode === "link" ? "is-on" : ""} onClick={() => setMode("link")} aria-pressed={mode === "link"}>
          <ExternalLink size={14} /> 外部链接
        </button>
      </div>

      {mode === "local" ? (
        <div className="real-upload-grid">
          <label className="real-file-box">
            <span>1. 音频文件（.mp3 / .m4a / .wav，持久存 IndexedDB）</span>
            <input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg" onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)} />
            {audioFile && <small className="muted">已选：{audioFile.name}（{(audioFile.size / 1024 / 1024).toFixed(2)} MB）</small>}
          </label>
          <label className="real-file-box">
            <span>2. 配套试卷或答案 PDF（可选）</span>
            <input type="file" accept="application/pdf,.pdf" onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)} />
            {pdfFile && <small className="muted">已选：{pdfFile.name}</small>}
          </label>
        </div>
      ) : (
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="节目页面或 .mp3 链接 https://…" aria-label="链接" />
      )}

      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题（如：FEI DELF B2 Exemple 1 Ex.1）" aria-label="标题" />
      <div className="exam-doc-actions">
        <label>
          从 <input type="text" inputMode="numeric" size={6} value={start} onChange={(e) => setStart(e.target.value)} aria-label="开始时间" />
        </label>
        <label>
          到 <input type="text" inputMode="numeric" size={6} value={end} onChange={(e) => setEnd(e.target.value)} aria-label="结束时间" />
        </label>
        <span className="muted small">（结束填 0:00 则播至结尾）</span>
      </div>
      <textarea className="essay-notes" rows={3} lang="fr" value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="原文（可选，可从参考答案 PDF 粘贴，用于第 2–4 步出题与听写）" />
      <button className="btn btn-primary" onClick={() => void add()} disabled={saving || (mode === "local" ? !audioFile : !url.trim())}>
        <Plus size={16} /> {saving ? "保存中…" : "存下并开始"}
      </button>
    </section>
  );
}

/** Play HTTP(s), bundled `materials/...`, IndexedDB blob (`idb:...`), YouTube, or page fallback, with exam-mode playback lock. */
function Player({
  src,
  examMode,
  phase,
  onTrackEnded,
}: {
  src: RealSource;
  examMode: boolean;
  phase: ExamPhase;
  onTrackEnded: () => void;
}) {
  const p = playerFor(src.url, src.start, src.end, baseUrl());
  const media = useRef<HTMLMediaElement | null>(null);
  const [idbUrl, setIdbUrl] = useState<string | null>(null);
  const [idbMissing, setIdbMissing] = useState(false);
  const [localFallback, setLocalFallback] = useState<string | null>(null);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [mediaError, setMediaError] = useState(false);

  useEffect(() => {
    setMediaError(false);
  }, [src.url, localFallback]);

  useEffect(() => {
    let alive = true;
    let objUrl: string | null = null;
    setIdbMissing(false);
    if (p.kind === "idb") {
      void getRealMedia(p.key).then((rec) => {
        if (!alive) return;
        if (!rec) {
          setIdbMissing(true);
          return;
        }
        objUrl = URL.createObjectURL(rec.blob);
        setIdbUrl(objUrl);
      });
    } else {
      setIdbUrl(null);
    }
    return () => {
      alive = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [p.kind === "idb" ? p.key : src.url]);

  useEffect(() => () => void (localFallback && URL.revokeObjectURL(localFallback)), [localFallback]);

  const mediaSrc =
    localFallback ??
    (p.kind === "idb" ? (idbUrl ? `${idbUrl}${src.start || src.end ? `#t=${src.start}${src.end > src.start ? `,${src.end}` : ""}` : ""}` : null) : p.kind === "media" ? p.src : null);

  // Sync play/pause transitions driven by exam phases
  useEffect(() => {
    const m = media.current;
    if (!examMode || !m) return;
    if (phase === "play1" || phase === "play2") {
      m.currentTime = src.start;
      void m.play().catch(() => toast("请点击下方播音按钮启动音频（浏览器策略限制自动播放）", "warn"));
    } else {
      m.pause();
    }
  }, [examMode, phase, src.start]);

  const endedLock = useRef(false);
  useEffect(() => {
    endedLock.current = false;
  }, [phase]);

  const onTime = () => {
    const m = media.current;
    if (!m) return;
    setPos(m.currentTime);
    if (Number.isFinite(m.duration)) setDur(m.duration);
    if (src.end > src.start && m.currentTime >= src.end && !endedLock.current) {
      endedLock.current = true;
      m.pause();
      if (examMode && (phase === "play1" || phase === "play2")) onTrackEnded();
    }
  };
  const onEnded = () => {
    if (!endedLock.current) {
      endedLock.current = true;
      if (examMode && (phase === "play1" || phase === "play2")) onTrackEnded();
    }
  };
  const back = (sec: number) => {
    const m = media.current;
    if (m) m.currentTime = Math.max(src.start, m.currentTime - sec);
  };
  const fromStart = () => {
    const m = media.current;
    if (!m) return;
    m.currentTime = src.start;
    void m.play();
  };

  return (
    <div className="exam-player real-flow">
      {p.kind === "youtube" && <iframe className="real-embed" src={p.src} title={src.title} allow="encrypted-media; picture-in-picture" allowFullScreen />}
      {p.kind === "idb" && idbMissing && <p className="muted small">未在本地 IndexedDB 找到该音频文件，请重新上传或检查浏览器存储。</p>}
      {mediaSrc &&
        (p.kind === "media" && p.video && !localFallback ? (
          <video
            ref={(el) => void (media.current = el)}
            src={mediaSrc}
            controls={!examMode}
            preload="metadata"
            onTimeUpdate={onTime}
            onEnded={onEnded}
            onLoadedMetadata={() => setMediaError(false)}
            onError={() => setMediaError(true)}
            style={{ width: "100%" }}
          />
        ) : (
          <audio
            ref={(el) => void (media.current = el)}
            src={mediaSrc}
            controls={!examMode}
            preload="metadata"
            onTimeUpdate={onTime}
            onEnded={onEnded}
            onLoadedMetadata={() => setMediaError(false)}
            onError={() => setMediaError(true)}
            className="intensive-audio"
          />
        ))}
      {mediaError && (
        <p className="warn-text small" role="alert">
          音频加载失败：若当前处于离线状态，请先在联网时点击「下载到离线」保存本期音频。
        </p>
      )}
      {mediaSrc && examMode && (
        <div className="real-exam-bar">
          <Lock size={14} />
          <span>考场播音锁定：</span>
          <div className="learn-progress">
            <span style={{ width: `${dur > 0 ? Math.min(100, Math.round((pos / dur) * 100)) : 0}%` }} />
          </div>
          <span>
            {clock(Math.floor(pos))} / {dur > 0 ? clock(Math.floor(dur)) : "—"}
          </span>
          {(phase === "play1" || phase === "play2") && (
            <button className="btn btn-ghost" onClick={() => void media.current?.play()}>
              <Play size={14} /> 若未自动播放点此
            </button>
          )}
        </div>
      )}
      {mediaSrc && !examMode && (
        <div className="exam-doc-actions">
          <button className="btn btn-ghost" onClick={fromStart}>
            从 {clock(src.start)} 播放
          </button>
          <button className="btn btn-ghost" onClick={() => back(5)}>
            <Rewind size={16} /> 退 5 秒
          </button>
        </div>
      )}
      {p.kind === "page" && !localFallback && (
        <p>
          <a className="btn btn-ghost" href={src.url} target="_blank" rel="noreferrer">
            <ExternalLink size={16} /> 打开原网页
          </a>{" "}
          <span className="muted small">可下载音频到本地后选择：</span>
          <input type="file" accept="audio/*,video/*" onChange={(e) => e.target.files?.[0] && setLocalFallback(URL.createObjectURL(e.target.files[0]))} aria-label="本地音频文件" />
        </p>
      )}
    </div>
  );
}

const GUIDE = [
  "Qui parle, et dans quel cadre (émission, reportage, interview) ?",
  "De quoi parle-t-on ? Quel est le problème posé ?",
  "Quels faits, chiffres ou exemples sont donnés ?",
  "Quelle est la position de chaque personne ? Y a-t-il un désaccord ?",
  "Quelle conclusion, ou quelle question reste ouverte ?",
];

function Flow({ src, offline, onBack }: { src: RealSource; offline: OfflineMediaState; onBack: () => void }) {
  const ai = useAiConfig();
  const presetQuiz = realPresetQuiz(src.presetId);
  const [step, setStep] = useState(0);
  const [examMode, setExamMode] = useState(src.url.startsWith("materials/") || src.url.startsWith("idb:") || /\.(mp3|m4a|wav|ogg)(\?|$)/i.test(src.url));
  const [phase, setPhase] = useState<ExamPhase>("idle");
  const [secLeft, setSecLeft] = useState(0);
  const [notes, setNotes] = useState(src.notes ?? "");
  const [draft, setDraft] = useState(src.transcript ?? "");
  const [quiz, setQuiz] = useState<CompExercise | null>(presetQuiz);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState(false);
  const [logged, setLogged] = useState(false);
  const [manualScore, setManualScore] = useState("");
  const [words, setWords] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [src.id]);

  useEffect(() => () => ctrl.current?.abort(), []);

  useEffect(() => {
    let alive = true;
    let objUrl: string | null = null;
    if (src.pdfUrl && /^idb:/i.test(src.pdfUrl)) {
      void getRealMedia(src.pdfUrl.slice(4)).then((rec) => {
        if (!alive || !rec) return;
        objUrl = URL.createObjectURL(rec.blob);
        setPdfBlobUrl(objUrl);
      });
    } else {
      setPdfBlobUrl(src.pdfUrl ? resolveMaterialUrl(src.pdfUrl, baseUrl()) : null);
    }
    return () => {
      alive = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [src.pdfUrl]);

  // Countdown tick for prep (30s) and gap (30s) in exam blind-listen mode
  useEffect(() => {
    if (!examMode || (phase !== "prep" && phase !== "gap")) return;
    const t = window.setInterval(() => {
      setSecLeft((n) => {
        if (n <= 1) {
          setPhase((prev) => (prev === "prep" ? "play1" : "play2"));
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [examMode, phase]);

  const onTrackEnded = useCallback(() => {
    setPhase((prev) => {
      if (prev === "play1") {
        setSecLeft(30);
        return "gap";
      }
      if (prev === "play2") return "review";
      return prev;
    });
  }, []);

  const startExamListen = () => {
    setPhase("prep");
    setSecLeft(30);
  };

  const text = src.transcript ?? "";

  const saveText = () => {
    patchSource(src.id, { transcript: draft });
    toast("原文已保存在这台设备上");
  };
  const makeQuiz = async () => {
    const c = new AbortController();
    ctrl.current = c;
    setBusy(true);
    try {
      setQuiz(await questionsForTranscript(text, c.signal));
      setPicked({});
      setChecked(false);
      setLogged(false);
    } catch (e) {
      if (!c.signal.aborted) toast((e as Error).message || "出题失败", "warn");
    } finally {
      setBusy(false);
    }
  };

  const submitQuiz = () => {
    if (!quiz) return;
    setChecked(true);
    const totalPts = quiz.questions.reduce((s, q) => s + (q.pts ?? 1), 0);
    const gotPts = quiz.questions.reduce((s, q, k) => s + (picked[k] === q.answer ? (q.pts ?? 1) : 0), 0);
    if (!logged && totalPts > 0) {
      recordRealListenScore(`real:${src.presetId ?? src.id}`, gotPts, totalPts);
      patchSource(src.id, { done: Date.now(), notes });
      setLogged(true);
      toast(`已写入模考记录（${gotPts}/${totalPts} 分）`);
    }
  };

  const submitManualPdfScore = () => {
    const v = Number(manualScore);
    if (!Number.isFinite(v) || v < 0 || v > 25) return toast("请输入 0–25 之间的分数", "warn");
    recordRealListenScore(`real-pdf:${src.id}`, Math.round(v * 10) / 10, 25);
    patchSource(src.id, { done: Date.now(), notes });
    setLogged(true);
    toast(`已把本次真题自评分 ${v}/25 写入模考记录`);
  };

  const needText = (
    <div className="real-flow">
      <p className="muted">这一步需要原文：粘贴自网站或官方答案 PDF 的文字稿。</p>
      <textarea className="essay-notes" rows={6} lang="fr" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="粘贴原文" />
      <button className="btn btn-ghost" onClick={saveText} disabled={!draft.trim()}>
        保存原文
      </button>
    </div>
  );

  const isPdfDoc = Boolean(src.pdfUrl && (/\.pdf(\?|$)/i.test(src.pdfUrl) || src.pdfUrl.startsWith("idb:pdf:")));
  const hideTxtInBlind = step === 0 && !isPdfDoc;
  const canCacheOffline = Boolean(resolveOfflineMediaUrl(src.url));
  const isCached = canCacheOffline && offline.has(src.url);
  const isCacheBusy = offline.busy === src.url;

  return (
    <div className="page practice">
      <section className="essay-stage">
        <header className="exam-top">
          <button className="btn btn-ghost" onClick={onBack}>
            <ArrowLeft size={16} /> 材料列表
          </button>
          <span className="eyebrow">{src.title}</span>
          {canCacheOffline && (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={isCacheBusy}
              aria-pressed={isCached}
              onClick={() => void (isCached ? offline.remove(src.url) : offline.download(src.url, src.pdfUrl))}
            >
              {isCacheBusy ? (
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
          )}
        </header>

        <div className="exam-doc-actions">
          <div className="segmented segmented-wide">
            {STEPS.map((s, k) => (
              <button key={s} className={step === k ? "is-on" : ""} onClick={() => setStep(k)} aria-pressed={step === k}>
                {k + 1}. {s}
              </button>
            ))}
          </div>
          {step <= 1 && (
            <div className="segmented" role="group" aria-label="播放模式">
              <button className={examMode ? "is-on" : ""} onClick={() => setExamMode(true)} aria-pressed={examMode}>
                考场两遍限时盲听
              </button>
              <button className={!examMode ? "is-on" : ""} onClick={() => { setExamMode(false); setPhase("idle"); }} aria-pressed={!examMode}>
                自由精听
              </button>
            </div>
          )}
        </div>

        <Player src={src} examMode={examMode && step === 0} phase={phase} onTrackEnded={onTrackEnded} />

        {pdfBlobUrl && !hideTxtInBlind && (
          <div className="real-flow">
            <div className="exam-doc-actions">
              <button className="btn btn-ghost" onClick={() => setShowPdf((v) => !v)}>
                <FileText size={15} /> {showPdf ? "收起配套文档" : isPdfDoc ? "打开随附试题 PDF" : "查看原文稿文件"}
              </button>
              <a className="link" href={pdfBlobUrl} target="_blank" rel="noreferrer">
                新窗口打开 <ExternalLink size={12} />
              </a>
            </div>
            {showPdf && <iframe className="real-pdf-frame" src={pdfBlobUrl} title="配套材料文档" />}
          </div>
        )}

        {step === 0 && (
          <div className="real-flow">
            {examMode ? (
              <div className="panel real-exam-box">
                <div className="exam-doc-actions">
                  <strong>{PHASE_LABEL[phase]}</strong>
                  {(phase === "prep" || phase === "gap") && <span className="exam-timer">剩余 {secLeft} 秒</span>}
                </div>
                <div className="exam-doc-actions">
                  {phase === "idle" && (
                    <button className="btn btn-primary" onClick={startExamListen}>
                      开始两遍限时盲听
                    </button>
                  )}
                  {phase === "prep" && (
                    <button className="btn btn-ghost" onClick={() => { setSecLeft(0); setPhase("play1"); }}>
                      跳过准备，直接第一遍
                    </button>
                  )}
                  {phase === "gap" && (
                    <button className="btn btn-ghost" onClick={() => { setSecLeft(0); setPhase("play2"); }}>
                      跳过间隔，开始第二遍
                    </button>
                  )}
                  {phase === "review" && (
                    <button className="btn btn-primary" onClick={() => setStep(1)}>
                      进入第 2 步：答题 <ArrowRight size={15} />
                    </button>
                  )}
                </div>
                <p className="muted small">考场流程：30 秒读题 → 第一遍播音 → 30 秒整理笔记 → 第二遍播音 → 核对答题。</p>
                {quiz && (phase === "prep" || phase === "gap" || phase === "play1" || phase === "play2") && (
                  <details>
                    <summary className="link">预览题目（不含答案，用于读题准备）</summary>
                    <ol className="essay-box-list" lang="fr">
                      {quiz.questions.map((q, idx) => (
                        <li key={idx}>
                          {q.q}
                          {q.options?.length ? ` (${q.options.join(" / ")})` : ""}
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </div>
            ) : (
              <p className="muted">不看原文，反复精听。像考试一样，用法语或中文记下听懂的要点，可以参考这几个问题：</p>
            )}
            <ol className="essay-box-list" lang="fr">
              {GUIDE.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ol>
            <textarea className="essay-notes" rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => patchSource(src.id, { notes })} placeholder="我听懂的要点笔记…" />
          </div>
        )}

        {step === 1 &&
          (quiz ? (
            <div className="real-flow">
              <ol className="exam-questions">
                {quiz.questions.map((q, k) => (
                  <li key={k}>
                    <p className="exam-q" lang="fr">
                      {q.q} {q.pts ? <small className="muted">({q.pts} pt)</small> : null}
                    </p>
                    <div className="exam-options" role="radiogroup">
                      {q.options.map((o, j) => {
                        const on = picked[k] === j;
                        const state = checked ? (j === q.answer ? "is-right" : on ? "is-wrong" : "") : on ? "is-on" : "";
                        return (
                          <button key={j} role="radio" aria-checked={on} className={`exam-option ${state}`} disabled={checked} lang="fr" onClick={() => setPicked((p) => ({ ...p, [k]: j }))}>
                            <span>{"ABC"[j]}</span>
                            {o}
                            {checked && j === q.answer && <Check size={16} />}
                            {checked && on && j !== q.answer && <X size={16} />}
                          </button>
                        );
                      })}
                    </div>
                    {checked && q.why && <p className="exam-why">{q.why}</p>}
                  </li>
                ))}
              </ol>
              {!checked ? (
                <button className="btn btn-primary" onClick={submitQuiz}>
                  提交并计入模考记录
                </button>
              ) : (
                <div className="real-flow">
                  <p>
                    答对 {quiz.questions.filter((q, k) => picked[k] === q.answer).length}/{quiz.questions.length} 题（
                    {quiz.questions.reduce((s, q, k) => s + (picked[k] === q.answer ? (q.pts ?? 1) : 0), 0)}/
                    {quiz.questions.reduce((s, q) => s + (q.pts ?? 1), 0)} 分）。
                    <span className="muted small"> {src.presetId ? "RFI 真实广播配套题（待核对），已写入模考总分板。" : "已写入模考记录。"}</span>
                  </p>
                </div>
              )}
            </div>
          ) : !text ? (
            <div className="real-flow">
              {pdfBlobUrl && isPdfDoc && (
                <div className="panel real-flow">
                  <p className="muted">如果你已导入 FEI 官方试卷与答案 PDF，完成自批后可直接录入总分写入模考成绩单：</p>
                  <div className="exam-doc-actions">
                    <input type="number" min={0} max={25} step={0.5} value={manualScore} onChange={(e) => setManualScore(e.target.value)} placeholder="总分 (0–25)" style={{ width: 140 }} />
                    <button className="btn btn-primary" onClick={submitManualPdfScore} disabled={logged}>
                      {logged ? "已写入记录" : "写入模考记录"}
                    </button>
                  </div>
                </div>
              )}
              {needText}
            </div>
          ) : ready.text(ai) ? (
            <div className="real-flow">
              <p className="muted">AI 根据原文按考试题型出 7 道选择题（只看题，不看原文，可以再听一遍再答）。</p>
              <button className="btn btn-primary" onClick={() => void makeQuiz()} disabled={busy}>
                {busy ? "出题中…" : "出题"}
              </button>
            </div>
          ) : (
            <div className="real-flow">
              <p className="muted">
                没有设置 AI（<a className="link" href={href({ page: "me" })}>我的 → AI 接口</a>），可对照第 1 步问题和原文自查，或手动录入自评分数写回模考面板：
              </p>
              <div className="exam-doc-actions">
                <input type="number" min={0} max={25} step={0.5} value={manualScore} onChange={(e) => setManualScore(e.target.value)} placeholder="自评 /25" style={{ width: 130 }} />
                <button className="btn btn-primary" onClick={submitManualPdfScore} disabled={logged}>
                  {logged ? "已写入记录" : "写入模考记录"}
                </button>
              </div>
              <p className="essay-text" lang="fr">
                {text}
              </p>
            </div>
          ))}

        {(step === 2 || step === 3) && (!text ? needText : <IntensiveDoc key={step} text={text} initial={step === 2 ? "sentence" : "shadow"} />)}

        {text && step >= 1 && (
          <div className="exam-doc-actions">
            <button className="link" onClick={() => setWords((v) => !v)}>
              原文生词入库
            </button>
          </div>
        )}
        {words && text && step >= 1 && <TranscriptWords text={text} onClose={() => setWords(false)} />}

        <div className="writing-actions">
          {step < 3 ? (
            <button className="btn btn-primary" onClick={() => setStep(step + 1)}>
              下一步：{STEPS[step + 1]} <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => {
                patchSource(src.id, { done: Date.now(), notes });
                toast("这段材料练完了");
                onBack();
              }}
            >
              <Check size={16} /> 练完了
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
