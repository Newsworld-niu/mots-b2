import {
  ArrowLeft,
  BookmarkPlus,
  Clock,
  ExternalLink,
  FileUp,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Search,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { play, stopAudio } from "../../lib/audio";
import type { LocalLoungeVideoMeta, SubtitleCue } from "../../lib/lounge-types";
import {
  CURATED_YOUTUBE_VIDEOS,
  loadSampleVideoCues,
  OPEN_SAMPLE_VIDEOS,
} from "../../lib/lounge-videos";
import { go } from "../../lib/router";
import { cue, suspendAmbience } from "../../lib/sound";
import { activeCueIndex } from "../../lib/subtitles";
import {
  listLocalLoungeVideos,
  loadLocalLoungeVideoUrls,
  loadYoutubeCustomSubtitles,
  recordLoungeActivity,
  saveLoungeClip,
  saveYoutubeCustomSubtitles,
  setLoungeMode,
  updateMediaProgress,
} from "../../store/lounge";
import { useStore } from "../../store/store";
import { toast } from "../../ui/Toast";
import { WordPopup } from "../../ui/WordPopup";

const SPEEDS = [0.75, 0.85, 1, 1.15, 1.25] as const;

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = String(s % 60).padStart(2, "0");
  return `${m}:${r}`;
}

export function LoungeTheater({ itemId }: { itemId: string }) {
  const voice = useStore((s) => s.settings.accent);
  const loungeMode = useStore((s) => s.settings.loungeMode) ?? "chill";
  const savedProg = useStore((s) => s.progress.mediaProgress?.[itemId]);

  const sampleVideo = useMemo(
    () => OPEN_SAMPLE_VIDEOS.find((v) => v.id === itemId) ?? null,
    [itemId],
  );
  const ytVideo = useMemo(
    () => CURATED_YOUTUBE_VIDEOS.find((v) => v.id === itemId) ?? null,
    [itemId],
  );

  const [localMeta, setLocalMeta] = useState<LocalLoungeVideoMeta | null>(null);
  const [localObjUrl, setLocalObjUrl] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(!sampleVideo && !ytVideo);

  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [subMode, setSubMode] = useState<"bilingual" | "fr" | "off">("bilingual");
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const [singleCueIdx, setSingleCueIdx] = useState<number | null>(null);
  const [ttsNarrationOn, setTtsNarrationOn] = useState(false);

  // Gentle Break Timer
  const [timerSec, setTimerSec] = useState<number | null>(null);
  const [breakAlert, setBreakAlert] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const cueListRef = useRef<HTMLUListElement>(null);
  const watchedSecRef = useRef(0);
  const activityRecordedRef = useRef(false);
  const lastProgressSaveRef = useRef(0);
  const lastTimeRef = useRef(0);
  const lastNarratedIdxRef = useRef(-1);

  const markWatchedThreshold = () => {
    if (!activityRecordedRef.current) {
      activityRecordedRef.current = true;
      recordLoungeActivity();
      toast("观影满 5 分钟或已看完 · 已计入今日轻度保签 ✨", "ok");
    }
  };

  // Unmount cleanup: always restore ambience & stop TTS
  useEffect(
    () => () => {
      suspendAmbience(false);
      stopAudio();
    },
    [],
  );

  // Load Track A subtitles
  useEffect(() => {
    if (!sampleVideo) return;
    let alive = true;
    void loadSampleVideoCues(sampleVideo.vttPath)
      .then((loaded) => {
        if (alive) setCues(loaded);
      })
      .catch(() => {
        if (alive) setCues([]);
      });
    return () => {
      alive = false;
    };
  }, [sampleVideo]);

  // Load Track B custom subtitles if any
  useEffect(() => {
    if (!ytVideo) return;
    let alive = true;
    void loadYoutubeCustomSubtitles(ytVideo.id)
      .then((loaded) => {
        if (alive) setCues(loaded);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ytVideo]);

  // Load Track C local video Blob + subtitles, cleaning up ObjectURL on unmount
  useEffect(() => {
    if (sampleVideo || ytVideo) {
      setLocalLoading(false);
      return;
    }
    let alive = true;
    let createdUrl: string | null = null;
    setLocalLoading(true);
    void Promise.all([listLocalLoungeVideos(), loadLocalLoungeVideoUrls(itemId)])
      .then(([metas, data]) => {
        if (!alive) return;
        const found = metas.find((m) => m.id === itemId) ?? null;
        setLocalMeta(found);
        setCues(data.cues);
        if (data.videoBlob) {
          createdUrl = URL.createObjectURL(data.videoBlob);
          setLocalObjUrl(createdUrl);
        }
      })
      .finally(() => {
        if (alive) setLocalLoading(false);
      });
    return () => {
      alive = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [itemId, sampleVideo, ytVideo]);

  // Count watched seconds while playing -> recordLoungeActivity at 300s (5m)
  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      watchedSecRef.current += 1;
      if (watchedSecRef.current >= 300) {
        markWatchedThreshold();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [isPlaying]);

  // Gentle Break Timer countdown
  useEffect(() => {
    if (timerSec === null) return;
    if (timerSec <= 0) {
      setTimerSec(null);
      setBreakAlert(true);
      videoRef.current?.pause();
      setIsPlaying(false);
      suspendAmbience(false);
      stopAudio();
      void cue("twinkle");
      toast("小憩时间到 · 暂停视频让眼睛休息一下吧 ✨", "ok");
      return;
    }
    const id = window.setTimeout(() => setTimerSec((s) => (s !== null ? s - 1 : null)), 1000);
    return () => window.clearTimeout(id);
  }, [timerSec]);

  const activeIdx = useMemo(() => activeCueIndex(cues, currentTime), [cues, currentTime]);

  // Scroll active cue into view smoothly inside the cue container
  useEffect(() => {
    if (activeIdx < 0 || !cueListRef.current) return;
    const el = cueListRef.current.querySelector<HTMLElement>(`[data-cue-idx="${activeIdx}"]`);
    el?.scrollIntoView?.({ block: "nearest" });
  }, [activeIdx]);

  // Optional TTS cue narration for silent/open sample videos
  useEffect(() => {
    if (!ttsNarrationOn || !isPlaying || activeIdx < 0) return;
    if (lastNarratedIdxRef.current === activeIdx) return;
    lastNarratedIdxRef.current = activeIdx;
    const text = cues[activeIdx]?.fr;
    if (text) void play(null, text, voice);
  }, [ttsNarrationOn, isPlaying, activeIdx, cues, voice]);

  const titleLabel =
    sampleVideo?.titleZh ||
    sampleVideo?.title ||
    ytVideo?.titleZh ||
    ytVideo?.title ||
    localMeta?.title ||
    "漫游影院";

  const sourceLabel = sampleVideo
    ? `${sampleVideo.title}（${sampleVideo.titleZh}）`
    : ytVideo
      ? `${ytVideo.title} · ${ytVideo.channel}`
      : localMeta?.title || "漫游影院";

  const applySpeed = (nextSpeed: number) => {
    setSpeed(nextSpeed);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextSpeed;
    }
  };

  const seekTo = (sec: number, autoPlay = false) => {
    const v = videoRef.current;
    if (!v) {
      setCurrentTime(Math.max(0, sec));
      return;
    }
    const target = Math.max(0, sec);
    v.currentTime = target;
    lastTimeRef.current = target;
    setCurrentTime(target);
    if (autoPlay && v.paused) {
      void v.play().catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    const t = v.currentTime || 0;
    const dt = t - lastTimeRef.current;
    if (dt > 0 && dt <= 5) {
      watchedSecRef.current += dt;
      if (watchedSecRef.current >= 300) {
        markWatchedThreshold();
      }
    }
    lastTimeRef.current = t;
    setCurrentTime(t);

    // Single-cue loop enforcement
    if (singleCueIdx !== null && cues[singleCueIdx]) {
      const c = cues[singleCueIdx];
      if (t >= c.end - 0.04) {
        v.currentTime = c.start;
        lastTimeRef.current = c.start;
        return;
      }
    }

    // A-B loop enforcement
    if (loopA !== null && loopB !== null && loopB > loopA && t >= loopB) {
      v.currentTime = loopA;
      lastTimeRef.current = loopA;
      return;
    }

    const now = Date.now();
    if (now - lastProgressSaveRef.current > 3000) {
      lastProgressSaveRef.current = now;
      updateMediaProgress(itemId, {
        pos: t,
        dur: Number.isFinite(v.duration) && v.duration > 0 ? v.duration : sampleVideo?.durationSec,
        title: titleLabel,
        shelf: "videos",
      });
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    suspendAmbience(false);
    stopAudio();
    const dur =
      (videoRef.current && Number.isFinite(videoRef.current.duration) && videoRef.current.duration > 0
        ? videoRef.current.duration
        : sampleVideo?.durationSec) ?? Math.max(1, currentTime);
    updateMediaProgress(itemId, {
      pos: dur,
      dur,
      done: Date.now(),
      title: titleLabel,
      shelf: "videos",
    });
    markWatchedThreshold();
  };

  const toggleSingleCueLoop = () => {
    if (singleCueIdx !== null) {
      setSingleCueIdx(null);
      return;
    }
    const idx = activeIdx >= 0 ? activeIdx : 0;
    if (!cues[idx]) return;
    setSingleCueIdx(idx);
    seekTo(cues[idx].start, true);
  };

  const handleAttachYoutubeSub = async (file: File | undefined) => {
    if (!file || !ytVideo) return;
    try {
      const text = await file.text();
      const parsed = await saveYoutubeCustomSubtitles(ytVideo.id, text);
      if (!parsed.length) {
        toast("未在字幕文件中识别到有效时间轴内容", "warn");
        return;
      }
      setCues(parsed);
      toast(`已挂载 ${parsed.length} 句本地字幕，支持点词即查`, "ok");
    } catch (e) {
      toast((e as Error).message || "字幕读取失败", "warn");
    }
  };

  const handleSaveClip = (fr: string, zh?: string) => {
    saveLoungeClip({ fr, zh: zh ?? "", source: sourceLabel });
    toast("已收进文化实例笔记", "ok");
  };

  const videoSrc = sampleVideo ? sampleVideo.videoUrl : localObjUrl;
  const activeCue = activeIdx >= 0 ? cues[activeIdx] : null;
  const cultureNote = sampleVideo?.cultureNoteZh ?? ytVideo?.cultureNoteZh;
  const keyExpressions = sampleVideo?.keyExpressions ?? ytVideo?.keyExpressions ?? [];

  if (!sampleVideo && !ytVideo && !localLoading && !localMeta) {
    return (
      <div className="panel">
        <p>未找到该视频（本地导入文件可能已被清理）。</p>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => go({ page: "lounge", shelf: "videos" })}
        >
          <ArrowLeft size={16} /> 返回视频漫游
        </button>
      </div>
    );
  }

  return (
    <WordPopup className="lounge-block">
      {/* Top Bar */}
      <div className="lounge-topbar" role="toolbar" aria-label="漫游影院控制栏">
        <div className="lounge-topbar-group">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => go({ page: "lounge", shelf: "videos" })}
          >
            <ArrowLeft size={15} /> 视频架
          </button>
          <div className="lounge-seg" role="group" aria-label="观影心境切换">
            <button
              type="button"
              className={loungeMode === "chill" ? "is-on" : ""}
              aria-pressed={loungeMode === "chill"}
              onClick={() => setLoungeMode("chill")}
            >
              ☕ 躺平放松
            </button>
            <button
              type="button"
              className={loungeMode === "study" ? "is-on" : ""}
              aria-pressed={loungeMode === "study"}
              onClick={() => setLoungeMode("study")}
            >
              <Search size={12} /> 顺手精学
            </button>
          </div>
          <strong>{titleLabel}</strong>
        </div>

        <div className="lounge-topbar-group">
          {ytVideo && (
            <button
              type="button"
              className={`lounge-mini-pill ${isPlaying ? "is-on" : ""}`}
              aria-pressed={isPlaying}
              onClick={() => {
                const next = !isPlaying;
                setIsPlaying(next);
                suspendAmbience(next);
              }}
            >
              {isPlaying ? <Pause size={13} /> : <Play size={13} />}{" "}
              {isPlaying ? "观影计时中（已静音白噪音）" : "开始观影计时"}
            </button>
          )}

          {/* Subtitle Display Mode */}
          {cues.length > 0 && (
            <div className="lounge-seg" role="group" aria-label="字幕显示模式">
              <button
                type="button"
                className={subMode === "bilingual" ? "is-on" : ""}
                onClick={() => setSubMode("bilingual")}
              >
                双语
              </button>
              <button
                type="button"
                className={subMode === "fr" ? "is-on" : ""}
                onClick={() => setSubMode("fr")}
              >
                仅法语
              </button>
              <button
                type="button"
                className={subMode === "off" ? "is-on" : ""}
                onClick={() => setSubMode("off")}
              >
                隐藏
              </button>
            </div>
          )}

          {/* Gentle Break Timer */}
          <div className="lounge-seg" role="group" aria-label="温柔小憩计时器">
            {timerSec !== null ? (
              <button type="button" className="is-on" onClick={() => setTimerSec(null)}>
                <Clock size={12} /> 小憩 {formatTime(timerSec)} ×
              </button>
            ) : (
              [10, 15, 20].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setBreakAlert(false);
                    setTimerSec(m * 60);
                    toast(`已开启 ${m} 分钟温柔小憩计时`, "info");
                  }}
                >
                  {m}m
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {breakAlert && (
        <div className="lounge-break-banner" role="status">
          <span>🌙 温柔小憩时间到啦 · 暂停一会儿，望望远处放松眼睛吧。</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBreakAlert(false)}>
            知道了
          </button>
        </div>
      )}

      <div className="lounge-theater-layout">
        {/* Left: Video Stage & Playback Controls */}
        <div className="lounge-block">
          <div className="lounge-stage-card">
            <div className="lounge-stage">
              {ytVideo ? (
                <iframe
                  title={ytVideo.title}
                  src={`https://www.youtube-nocookie.com/embed/${ytVideo.youtubeId}?playsinline=1&cc_load_policy=1&cc_lang_pref=fr&rel=0`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : videoSrc ? (
                <>
                  <video
                    ref={videoRef}
                    src={videoSrc}
                    poster={sampleVideo?.posterUrl}
                    controls
                    playsInline
                    onLoadedMetadata={() => {
                      if (videoRef.current && savedProg?.pos && !savedProg.done && savedProg.pos > 2) {
                        try {
                          videoRef.current.currentTime = savedProg.pos;
                        } catch {
                          /* ignore pre-seek error */
                        }
                      }
                    }}
                    onPlay={() => {
                      setIsPlaying(true);
                      suspendAmbience(true);
                    }}
                    onPause={() => {
                      setIsPlaying(false);
                      suspendAmbience(false);
                      stopAudio();
                    }}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handleEnded}
                  />
                  {subMode !== "off" && activeCue && (
                    <div className="lounge-stage-sub" aria-live="polite">
                      <span lang="fr">{activeCue.fr}</span>
                      {subMode === "bilingual" && activeCue.zh && <small>{activeCue.zh}</small>}
                    </div>
                  )}
                </>
              ) : (
                <p className="muted">正在载入本地视频流…</p>
              )}
            </div>

            {ytVideo ? (
              <div className="lounge-yt-bar">
                <a
                  className="link"
                  href={ytVideo.fallbackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  若受版权或网络限制无法内嵌播放，在 YouTube 原站打开 <ExternalLink size={13} />
                </a>
                {loungeMode === "study" && (
                  <label className="btn btn-ghost btn-sm">
                    <FileUp size={14} /> 挂载本地 .srt/.vtt 字幕
                    <input
                      type="file"
                      accept=".srt,.vtt,text/vtt,application/x-subrip"
                      hidden
                      onChange={(e) => {
                        void handleAttachYoutubeSub(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            ) : loungeMode === "study" ? (
              <div className="lounge-controls" aria-label="精细播放控制">
                <div className="lounge-seg" role="group" aria-label="播放倍速">
                  {SPEEDS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={speed === r ? "is-on" : ""}
                      onClick={() => applySpeed(r)}
                    >
                      {r}×
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="lounge-mini-pill"
                  onClick={() => seekTo(currentTime - 5)}
                >
                  <RotateCcw size={13} /> -5s
                </button>

                <button
                  type="button"
                  className={`lounge-mini-pill ${loopA !== null ? "is-on" : ""}`}
                  onClick={() => setLoopA(currentTime)}
                >
                  {loopA !== null ? `A: ${formatTime(loopA)}` : "设 A 点"}
                </button>

                <button
                  type="button"
                  className={`lounge-mini-pill ${loopB !== null ? "is-on" : ""}`}
                  disabled={loopA === null}
                  onClick={() => {
                    if (loopA !== null && currentTime > loopA + 0.3) {
                      setLoopB(currentTime);
                    } else {
                      toast("请在 A 点之后的位置设置 B 点", "warn");
                    }
                  }}
                >
                  {loopB !== null ? `B: ${formatTime(loopB)}` : "设 B 点"}
                </button>

                {(loopA !== null || loopB !== null) && (
                  <button
                    type="button"
                    className="lounge-mini-pill"
                    onClick={() => {
                      setLoopA(null);
                      setLoopB(null);
                    }}
                  >
                    清除 A-B
                  </button>
                )}

                {cues.length > 0 && (
                  <button
                    type="button"
                    className={`lounge-mini-pill ${singleCueIdx !== null ? "is-on" : ""}`}
                    aria-pressed={singleCueIdx !== null}
                    onClick={toggleSingleCueLoop}
                  >
                    <Repeat size={13} /> 单句循环
                  </button>
                )}

                {sampleVideo?.ttsNarration && (
                  <button
                    type="button"
                    className={`lounge-mini-pill ${ttsNarrationOn ? "is-on" : ""}`}
                    aria-pressed={ttsNarrationOn}
                    onClick={() => {
                      const next = !ttsNarrationOn;
                      setTtsNarrationOn(next);
                      if (!next) stopAudio();
                    }}
                  >
                    <Volume2 size={13} /> 法语旁白跟读
                  </button>
                )}
              </div>
            ) : null}
          </div>

          {/* Culture Note & Key Expressions */}
          {(cultureNote || keyExpressions.length > 0) && (
            <section className="panel lounge-block" aria-label="文化背景与地道表达">
              {cultureNote && (
                <div className="lounge-tip">
                  <span className="eyebrow">文化导览 · Note culturelle</span>
                  <p className="lounge-card-desc">{cultureNote}</p>
                </div>
              )}

              {keyExpressions.length > 0 && (
                <>
                  <p className="eyebrow">片中地道法语表达（点词可查 · 一键摘录）</p>
                  <ul className="lounge-expr-list">
                    {keyExpressions.map((ex, i) => (
                      <li key={i} className="lounge-expr-item">
                        <div className="lounge-expr-main">
                          <span
                            className="lounge-expr-fr"
                            lang="fr"
                            data-lounge-sentence={ex.fr}
                            data-lounge-source={sourceLabel}
                          >
                            {ex.fr}
                          </span>
                          <span className="lounge-card-sub">{ex.zh}</span>
                          {ex.note && <span className="lounge-card-note">{ex.note}</span>}
                        </div>
                        <div className="lounge-card-actions">
                          <button
                            type="button"
                            className="lounge-para-btn"
                            onClick={() => void play(null, ex.fr, voice)}
                          >
                            <Volume2 size={12} /> 朗读
                          </button>
                          <button
                            type="button"
                            className="lounge-para-btn"
                            onClick={() => handleSaveClip(ex.fr, ex.zh)}
                          >
                            <BookmarkPlus size={12} /> 收进文化实例笔记
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
        </div>

        {/* Right: Synchronized Interactive Dual-Subtitle Transcript */}
        <aside className="lounge-cues-panel" aria-label="同步交互字幕">
          <div className="lounge-block-head">
            <div>
              <p className="eyebrow">Sous-titres interactifs · 点词即查</p>
              <h2>同步字幕台本（{cues.length} 句）</h2>
            </div>
          </div>

          {cues.length === 0 ? (
            <p className="muted small">
              {ytVideo
                ? "当前使用 YouTube 原生内嵌字幕。若你有对应的 .srt 或 .vtt 字幕文件，点击左侧「挂载本地 .srt/.vtt 字幕」即可解锁点词即查与一键摘录。"
                : "这支本地视频暂未挂载外挂字幕。"}
            </p>
          ) : (
            <ul ref={cueListRef} className="lounge-cues-list">
              {cues.map((c, idx) => {
                const isActive = idx === activeIdx || idx === singleCueIdx;
                return (
                  <li
                    key={`${c.start}-${idx}`}
                    data-cue-idx={idx}
                    className={`lounge-cue-item ${isActive ? "is-active" : ""}`}
                  >
                    <button
                      type="button"
                      className="lounge-cue-time"
                      onClick={() => {
                        if (singleCueIdx !== null) setSingleCueIdx(idx);
                        seekTo(c.start, !ytVideo);
                      }}
                      title="跳转到这句时间点"
                    >
                      {formatTime(c.start)}
                    </button>
                    <div className="lounge-cue-text">
                      <p
                        className="lounge-cue-fr"
                        lang="fr"
                        data-lounge-sentence={c.fr}
                        data-lounge-source={sourceLabel}
                      >
                        {c.fr}
                      </p>
                      {subMode === "bilingual" && c.zh && (
                        <p className="lounge-cue-zh">{c.zh}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="lounge-para-btn"
                      aria-label={`摘录字幕 ${idx + 1}`}
                      title="收进文化实例笔记"
                      onClick={() => handleSaveClip(c.fr, c.zh)}
                    >
                      <BookmarkPlus size={12} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </WordPopup>
  );
}
