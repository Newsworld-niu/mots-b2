import { ExternalLink, Lock, Play, Plus, Rewind, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { clock } from "../../lib/exam";
import { parseClock, playerFor, type RealSource } from "../../lib/listening";
import { audioMediaKey, getRealMedia, pdfMediaKey, saveRealMedia } from "../../store/real-media";
import { addSource, newSourceId } from "../../store/sources";
import { toast } from "../../ui/Toast";
import { baseUrl, type ExamPhase } from "./useOfflineMedia";

const SPEED_OPTIONS = [0.75, 0.85, 1, 1.15, 1.25] as const;

export function AddSource({ onAdded }: { onAdded: (id: string) => void }) {
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

/** Play HTTP(s), bundled `materials/...`, IndexedDB blob (`idb:...`), YouTube, or page fallback, with exam-mode playback lock, speed & A-B loop. */
export function Player({
  src,
  examMode,
  phase,
  seekRequest,
  onTimeReport,
  onTrackEnded,
}: {
  src: RealSource;
  examMode: boolean;
  phase: ExamPhase;
  seekRequest?: { sec: number; nonce: number } | null;
  onTimeReport?: (pos: number, dur: number) => void;
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
  const [rate, setRate] = useState<number>(1);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);

  useEffect(() => {
    setMediaError(false);
    setLoopA(null);
    setLoopB(null);
  }, [src.url, localFallback]);

  useEffect(() => {
    if (examMode) {
      setLoopA(null);
      setLoopB(null);
    }
    if (media.current) media.current.playbackRate = examMode ? 1 : rate;
  }, [examMode, rate]);

  useEffect(() => {
    if (!seekRequest || examMode) return;
    const m = media.current;
    if (!m) return;
    const maxEnd = src.end > src.start ? src.end : Number.isFinite(m.duration) ? m.duration : seekRequest.sec;
    const target = Math.max(src.start, Math.min(maxEnd, seekRequest.sec));
    m.currentTime = target;
    setPos(target);
    void m.play().catch(() => {});
  }, [seekRequest, examMode, src.start, src.end]);

  // a recording kept in this browser (IndexedDB) is loaded by its key; any other source needs no object URL
  const idbKey = p.kind === "idb" ? p.key : null;
  useEffect(() => {
    let alive = true;
    let objUrl: string | null = null;
    setIdbMissing(false);
    if (idbKey !== null) {
      void getRealMedia(idbKey).then((rec) => {
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
  }, [idbKey]);

  useEffect(() => () => void (localFallback && URL.revokeObjectURL(localFallback)), [localFallback]);

  const mediaSrc =
    localFallback ??
    (p.kind === "idb" ? (idbUrl ? `${idbUrl}${src.start || src.end ? `#t=${src.start}${src.end > src.start ? `,${src.end}` : ""}` : ""}` : null) : p.kind === "media" ? p.src : null);

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
    const d = Number.isFinite(m.duration) ? m.duration : dur;
    setPos(m.currentTime);
    if (Number.isFinite(m.duration)) setDur(m.duration);
    onTimeReport?.(m.currentTime, d);
    if (!examMode && loopA !== null && loopB !== null && loopB > loopA && m.currentTime >= loopB) {
      m.currentTime = loopA;
      return;
    }
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
            onLoadedMetadata={() => {
              setMediaError(false);
              if (media.current) media.current.playbackRate = examMode ? 1 : rate;
            }}
            onError={() => setMediaError(true)}
            className="is-full"
          />
        ) : (
          <audio
            ref={(el) => void (media.current = el)}
            src={mediaSrc}
            controls={!examMode}
            preload="metadata"
            onTimeUpdate={onTime}
            onEnded={onEnded}
            onLoadedMetadata={() => {
              setMediaError(false);
              if (media.current) media.current.playbackRate = examMode ? 1 : rate;
            }}
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
        <div className="real-player-tools">
          <div className="exam-doc-actions">
            <button className="btn btn-ghost" onClick={fromStart}>
              从 {clock(src.start)} 播放
            </button>
            <button className="btn btn-ghost" onClick={() => back(5)}>
              <Rewind size={16} /> 退 5 秒
            </button>
          </div>
          <div className="segmented" role="group" aria-label="播放倍速">
            {SPEED_OPTIONS.map((r) => (
              <button key={r} type="button" className={rate === r ? "is-on" : ""} aria-pressed={rate === r} onClick={() => setRate(r)}>
                {r}×
              </button>
            ))}
          </div>
          <div className="exam-doc-actions" role="group" aria-label="A-B 复读控制">
            <button type="button" className={`chip-btn ${loopA !== null ? "is-on" : ""}`} onClick={() => { setLoopA(Math.floor(pos * 10) / 10); if (loopB !== null && pos >= loopB) setLoopB(null); }}>
              {loopA !== null ? `A: ${clock(Math.floor(loopA))}` : "设 A 点"}
            </button>
            <button type="button" className={`chip-btn ${loopB !== null ? "is-on" : ""}`} disabled={loopA === null || pos <= loopA + 0.5} onClick={() => setLoopB(Math.floor(pos * 10) / 10)}>
              {loopB !== null ? `B: ${clock(Math.floor(loopB))}` : "设 B 点"}
            </button>
            {(loopA !== null || loopB !== null) && (
              <button type="button" className="link small" onClick={() => { setLoopA(null); setLoopB(null); }}>
                清除循环
              </button>
            )}
          </div>
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
