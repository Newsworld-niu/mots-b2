import { ArrowLeft, ArrowRight, Check, Download, ExternalLink, FileText, Play, Sparkles, Square, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ready, useAiConfig } from "../../ai/config";
import { buildDialogueSsmlBatches } from "../../ai/ssml";
import { explainDistractor, questionsForTranscript, type DistractorExplanation } from "../../ai/tasks";
import { speakerVoices, ttsOn, ttsSsmlUrl, ttsUrl } from "../../ai/tts";
import { foldAccents } from "../../lib/accent";
import { play, playSlice, stopAudio } from "../../lib/audio";
import { estimateEvidenceWindow, probeAudioDuration } from "../../lib/audio-env";
import { clock, QSKILL_LABEL, speakerIndex, speechChunks, speechTurns, type CompExercise } from "../../lib/exam";
import {
  buildCompMissSnapshot,
  CAUSE_LABEL,
  MISS_CAUSES,
  paragraphsFromUnits,
  paragraphsOf,
  playerFor,
  resolveMaterialUrl,
  sentencesOf,
  type CompMiss,
  type MissCause,
  type RealSource,
} from "../../lib/listening";
import { useNavGuard } from "../../lib/nav-guard";
import { realPresetQuiz } from "../../lib/real-presets";
import { loadRfiSegments, type RfiSegmentsFile } from "../../lib/rfi-segments";
import { href } from "../../lib/router";
import { addMisses, setMissCause } from "../../store/misses";
import { getRealMedia } from "../../store/real-media";
import { patchSource, recordRealListenScore } from "../../store/sources";
import { confirmAction } from "../../ui/ConfirmSheet";
import { toast } from "../../ui/Toast";
import { TranscriptWords } from "../../ui/TranscriptWords";
import { IntensiveDoc } from "../Intensive";
import { Player } from "./SourcePlayer";
import { baseUrl, PHASE_LABEL, resolveOfflineMediaUrl, STEPS, type ExamPhase, type OfflineMediaState } from "./useOfflineMedia";

const GUIDE = [
  "Qui parle, et dans quel cadre (émission, reportage, interview) ?",
  "De quoi parle-t-on ? Quel est le problème posé ?",
  "Quels faits, chiffres ou exemples sont donnés ?",
  "Quelle est la position de chaque personne ? Y a-t-il un désaccord ?",
  "Quelle conclusion, ou quelle question reste ouverte ?",
];

const CHRONICLE_RATES: readonly { rate: number; label: string }[] = [
  { rate: 0.95, label: "0.95× 适应" },
  { rate: 1.05, label: "1.05× 标准" },
  { rate: 1.12, label: "1.12× 常速 (~170 WPM)" },
  { rate: 1.24, label: "1.24× 冲刺" },
] as const;

function normMatchTokens(s: string): string[] {
  return foldAccents(s.replace(/[’‘]/g, "'"))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}']+/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4);
}

/** Locate the ~10–12s audio slice matching `q.evidence` or question/right-option keywords across `rfiSegments`. */
function locateSegmentEvidenceWindow(
  q: CompExercise["questions"][number],
  segments: RfiSegmentsFile["segments"] | undefined,
): { startSec: number; endSec: number } | null {
  if (!segments?.length) return null;
  const rawEv = (q.evidence ?? "").trim();
  const foldedEv = rawEv ? foldAccents(rawEv.replace(/[’‘]/g, "'")).toLowerCase() : "";
  const queryTokens = normMatchTokens(rawEv || `${q.q} ${q.options[q.answer] ?? ""}`);
  if (!queryTokens.length && !foldedEv) return null;

  let bestIdx = -1;
  let bestScore = 0;
  for (let i = 0; i < segments.length; i++) {
    const combined = `${segments[i].text} ${segments[i + 1]?.text ?? ""}`;
    const foldedSeg = foldAccents(combined.replace(/[’‘]/g, "'")).toLowerCase();
    let score = 0;
    if (foldedEv && foldedEv.length >= 12 && foldedSeg.includes(foldedEv.slice(0, Math.min(36, foldedEv.length)))) {
      score += 20;
    }
    const segSet = new Set(normMatchTokens(combined));
    for (const tok of queryTokens) {
      if (segSet.has(tok)) score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  if (bestIdx < 0 || bestScore <= 0) return null;
  const seg = segments[bestIdx];
  const rawStart = Math.max(0, seg.start - 1.5);
  const rawEnd = Math.max(rawStart + 10, Math.min(seg.end + 2.5, rawStart + 12.5));
  return {
    startSec: Math.round(rawStart * 10) / 10,
    endSec: Math.round(rawEnd * 10) / 10,
  };
}

export function Flow({ src, offline, onBack }: { src: RealSource; offline: OfflineMediaState; onBack: () => void }) {
  const ai = useAiConfig();
  const presetQuiz = realPresetQuiz(src.presetId);
  const isTtsChronicle = /^tts-chronicle:/i.test(src.url);
  const [step, setStep] = useState(0);
  const [examMode, setExamMode] = useState(
    isTtsChronicle || src.url.startsWith("materials/") || src.url.startsWith("idb:") || /\.(mp3|m4a|wav|ogg)(\?|$)/i.test(src.url),
  );
  const [phase, setPhase] = useState<ExamPhase>("idle");
  const [secLeft, setSecLeft] = useState(0);
  const [notes, setNotes] = useState(src.notes ?? "");
  const [draft, setDraft] = useState(src.transcript ?? "");
  const [quiz, setQuiz] = useState<CompExercise | null>(presetQuiz);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [struck, setStruck] = useState<Record<string, boolean>>({});
  const [causes, setCauses] = useState<Record<string, MissCause>>({});
  const [expls, setExpls] = useState<Record<number, DistractorExplanation>>({});
  const [explBusy, setExplBusy] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState(0);
  const [checked, setChecked] = useState(false);
  const [logged, setLogged] = useState(false);
  const [excerptMode, setExcerptMode] = useState<"excerpt3m" | "full">(() => (src.presetId?.startsWith("rfi-") ? "excerpt3m" : "full"));
  const [manualScore, setManualScore] = useState("");
  const [words, setWords] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [playPos, setPlayPos] = useState(0);
  const [playDur, setPlayDur] = useState(0);
  const [seekRequest, setSeekRequest] = useState<{ sec: number; nonce: number } | null>(null);
  const [rfiSegments, setRfiSegments] = useState<RfiSegmentsFile | null>(null);
  const [idbAudioUrl, setIdbAudioUrl] = useState<string | null>(null);
  const [chroniclePlaying, setChroniclePlaying] = useState(false);
  const [chronicleRate, setChronicleRate] = useState(1.12);
  const [chronicleTurnInfo, setChronicleTurnInfo] = useState<string | null>(null);
  const [playingProofIdx, setPlayingProofIdx] = useState<number | null>(null);
  const chronicleRunRef = useRef(0);
  const ctrl = useRef<AbortController | null>(null);

  const examActive = examMode && (phase === "prep" || phase === "play1" || phase === "gap" || phase === "play2");
  const quizInProgress = Boolean(quiz && Object.keys(picked).length > 0 && !checked);
  useNavGuard(
    examActive || quizInProgress,
    examActive ? "考场两遍限时盲听正在进行中，确定中断播音并离开？" : "真题理解小题已作答但尚未提交，确定离开？",
  );
  const handleBack = async () => {
    if (examActive || quizInProgress) {
      const ok = await confirmAction({
        title: "离开当前精听练习？",
        message: examActive ? "考场两遍限时盲听正在进行中，返回将中断当前播音与作答，确定离开？" : "真题小题已选择答案但尚未提交，确定返回材料列表？",
        confirmLabel: "确定返回",
        danger: true,
      });
      if (!ok) return;
    }
    onBack();
  };

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [src.id]);

  useEffect(
    () => () => {
      ctrl.current?.abort();
      chronicleRunRef.current++;
      stopAudio();
    },
    [],
  );

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

  useEffect(() => {
    let alive = true;
    setRfiSegments(null);
    if (src.presetId) {
      void loadRfiSegments(src.presetId, baseUrl()).then((seg) => {
        if (alive) setRfiSegments(seg);
      });
    }
    return () => {
      alive = false;
    };
  }, [src.presetId]);

  useEffect(() => {
    let alive = true;
    let objUrl: string | null = null;
    if (/^idb:/i.test(src.url)) {
      void getRealMedia(src.url.slice(4)).then((rec) => {
        if (!alive || !rec) return;
        objUrl = URL.createObjectURL(rec.blob);
        setIdbAudioUrl(objUrl);
      });
    } else {
      setIdbAudioUrl(null);
    }
    return () => {
      alive = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [src.url]);

  const text = src.transcript ?? "";
  const resolvedAudioUrl = useMemo(() => {
    if (isTtsChronicle) return null;
    if (/^idb:/i.test(src.url)) return idbAudioUrl;
    const p = playerFor(src.url, src.start, src.end, baseUrl());
    return p.kind === "media" ? p.src.split("#")[0] : null;
  }, [isTtsChronicle, src.url, src.start, src.end, idbAudioUrl]);

  const stopChronicle = useCallback(() => {
    chronicleRunRef.current++;
    stopAudio();
    setChroniclePlaying(false);
    setChronicleTurnInfo(null);
  }, []);

  const speakChroniclePiece = useCallback(
    async (snippet: string, rate = 1.12, who?: string) => {
      const names: string[] = [];
      for (const u of sentencesOf(text)) if (u.who) speakerIndex(names, u.who);
      const whoIdx = who ? speakerIndex(names, who) : 0;
      const voices = speakerVoices();
      const voice = voices[whoIdx % voices.length];
      const url = ttsOn() ? await ttsUrl(snippet, voice).catch(() => null) : null;
      await play(url, snippet, "uk", rate, whoIdx);
    },
    [text],
  );

  const playChronicleFromRatio = useCallback(
    async (startRatio = 0, rate = chronicleRate, onComplete?: () => void) => {
      if (!text.trim()) return;
      const mine = ++chronicleRunRef.current;
      stopAudio();
      setChroniclePlaying(true);
      const estDur = src.end > src.start ? src.end - src.start : 180;
      setPlayDur(estDur);
      try {
        const voices = speakerVoices();
        const allTurns = speechTurns(text);
        const startIdx = startRatio > 0 ? Math.min(allTurns.length - 1, Math.floor(startRatio * allTurns.length)) : 0;
        const turns = allTurns.slice(startIdx);
        if (ttsOn() && turns.length > 0) {
          const batches = buildDialogueSsmlBatches(turns, voices, { style: "natural" });
          try {
            const urls = await Promise.all(batches.map((ssml) => ttsSsmlUrl(ssml)));
            if (chronicleRunRef.current !== mine) return;
            for (let i = 0; i < urls.length; i++) {
              setChronicleTurnInfo(`多声部广播合成播放中（${i + 1}/${urls.length}）`);
              setPlayPos(Math.round(((startIdx + (i / urls.length) * turns.length) / Math.max(1, allTurns.length)) * estDur));
              const r = await play(urls[i], "", "uk", rate);
              if (chronicleRunRef.current !== mine || r === "stopped" || r === "unsupported") return;
            }
            if (chronicleRunRef.current === mine) {
              setPlayPos(estDur);
              onComplete?.();
            }
            return;
          } catch {
            if (chronicleRunRef.current !== mine) return;
          }
        }
        const chunks = speechChunks(text);
        const startChunk = startRatio > 0 ? Math.min(chunks.length - 1, Math.floor(startRatio * chunks.length)) : 0;
        for (let k = startChunk; k < chunks.length; k++) {
          if (chronicleRunRef.current !== mine) return;
          const c = chunks[k];
          setChronicleTurnInfo(`广播语速播放中（${k + 1}/${chunks.length}）`);
          setPlayPos(Math.round((k / Math.max(1, chunks.length)) * estDur));
          const url = ttsOn() ? await ttsUrl(c.t, voices[c.who % voices.length]).catch(() => null) : null;
          if (chronicleRunRef.current !== mine) return;
          const r = await play(url, c.t, "uk", rate, c.who);
          if (chronicleRunRef.current !== mine || r === "stopped" || r === "unsupported") return;
        }
        if (chronicleRunRef.current === mine) {
          setPlayPos(estDur);
          onComplete?.();
        }
      } finally {
        if (chronicleRunRef.current === mine) {
          setChroniclePlaying(false);
          setChronicleTurnInfo(null);
        }
      }
    },
    [text, chronicleRate, src.end, src.start],
  );

  useEffect(() => {
    if (!isTtsChronicle || !(examMode && step === 0)) return;
    if (phase === "play1" || phase === "play2") {
      void playChronicleFromRatio(0, 1.12, onTrackEnded);
      return () => {
        stopChronicle();
      };
    }
    stopChronicle();
    return undefined;
  }, [isTtsChronicle, examMode, step, phase, playChronicleFromRatio, onTrackEnded, stopChronicle]);

  useEffect(() => {
    if (!isTtsChronicle || !seekRequest || examMode) return;
    const estDur = src.end > src.start ? src.end - src.start : 180;
    const ratio = estDur > 0 ? Math.max(0, Math.min(0.95, seekRequest.sec / estDur)) : 0;
    void playChronicleFromRatio(ratio, chronicleRate);
  }, [isTtsChronicle, seekRequest, examMode, src.end, src.start, chronicleRate, playChronicleFromRatio]);

  const handlePlaySlice = useCallback(
    async (startSec: number, endSec: number, rate: number) => {
      if (!resolvedAudioUrl) return;
      document.querySelectorAll<HTMLMediaElement>(".exam-player audio, .exam-player video").forEach((el) => el.pause());
      await playSlice(resolvedAudioUrl, startSec, endSec, rate);
    },
    [resolvedAudioUrl],
  );

  const handlePlayQuestionEvidence = useCallback(
    async (idx: number, q: CompExercise["questions"][number]) => {
      if (playingProofIdx === idx) {
        stopChronicle();
        setPlayingProofIdx(null);
        return;
      }
      setPlayingProofIdx(idx);
      try {
        if (resolvedAudioUrl) {
          const segWin = locateSegmentEvidenceWindow(q, rfiSegments?.segments);
          if (segWin) {
            await handlePlaySlice(segWin.startSec, segWin.endSec, 1);
            return;
          }
          if (q.evidence && text) {
            const dur = (await probeAudioDuration(resolvedAudioUrl)) ?? (playDur > 0 ? playDur : 600);
            const win = estimateEvidenceWindow(text, q.evidence, dur);
            await handlePlaySlice(win.startSec, win.endSec, 1);
            return;
          }
        }
        if (q.evidence) {
          await speakChroniclePiece(q.evidence, isTtsChronicle ? 1.12 : 1);
        }
      } finally {
        setPlayingProofIdx((cur) => (cur === idx ? null : cur));
      }
    },
    [playingProofIdx, resolvedAudioUrl, rfiSegments?.segments, text, playDur, isTtsChronicle, handlePlaySlice, speakChroniclePiece, stopChronicle],
  );

  const transcriptParas = useMemo(() => {
    if (rfiSegments?.segments.length) {
      return paragraphsFromUnits(rfiSegments.segments, 80).map((u, idx) => ({
        idx,
        who: u.who,
        text: u.text,
        startSec: u.start ?? 0,
        endSec: u.end ?? Math.max((u.start ?? 0) + 1, playDur || 600),
      }));
    }
    const units = paragraphsOf(text);
    const totalChars = units.reduce((n, u) => n + u.text.length, 0) || 1;
    const baseStart = src.start || 0;
    const span = (src.end > baseStart ? src.end : playDur > baseStart ? playDur : baseStart + 600) - baseStart;
    let cum = 0;
    return units.map((u, idx) => {
      const startSec = baseStart + (cum / totalChars) * span;
      cum += u.text.length;
      const endSec = baseStart + (cum / totalChars) * span;
      return { idx, who: u.who, text: u.text, startSec, endSec };
    });
  }, [rfiSegments, text, src.start, src.end, playDur]);

  const isLongBroadcast = Boolean(src.presetId?.startsWith("rfi-")) || (src.end === 0 && playDur > 240) || src.end - src.start > 240;

  const excerptWindow = useMemo(() => {
    const start = src.start || 0;
    const targetEnd = start + 180;
    if (rfiSegments?.segments.length) {
      let bestEnd = targetEnd;
      let bestDiff = Infinity;
      for (const seg of rfiSegments.segments) {
        if (seg.end >= start + 145 && seg.end <= start + 215) {
          const d = Math.abs(seg.end - targetEnd);
          if (d < bestDiff) {
            bestDiff = d;
            bestEnd = Math.ceil(seg.end);
          }
        }
      }
      return { start, end: bestEnd };
    }
    return { start, end: targetEnd };
  }, [src.start, rfiSegments]);

  const effectiveSrc = useMemo<RealSource>(() => {
    if (!isLongBroadcast || excerptMode === "full") return src;
    return { ...src, start: excerptWindow.start, end: excerptWindow.end };
  }, [src, isLongBroadcast, excerptMode, excerptWindow]);

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
      setStruck({});
      setCauses({});
      setExpls({});
      setChecked(false);
      setLogged(false);
    } catch (e) {
      if (!c.signal.aborted) toast((e as Error).message || "出题失败", "warn");
    } finally {
      setBusy(false);
    }
  };

  const missKeyFor = (k: number) => `real:${src.presetId ?? src.id}:${k}`;

  const toggleStrike = (optKey: string) => setStruck((s) => ({ ...s, [optKey]: !s[optKey] }));

  const blame = (k: number, cause: MissCause) => {
    const mKey = missKeyFor(k);
    setCauses((c) => ({ ...c, [mKey]: cause }));
    if (finishedAt > 0) setMissCause(finishedAt, mKey, cause);
  };

  const explainWrong = async (k: number, q: CompExercise["questions"][number], pickedIdx: number) => {
    setExplBusy(k);
    try {
      const res = await explainDistractor({
        kind: "listen",
        question: q.q,
        options: q.options,
        pickedIdx,
        answerIdx: q.answer,
        docText: quiz?.docs[q.doc ?? 0]?.text || text,
        why: q.why,
      });
      setExpls((prev) => ({ ...prev, [k]: res }));
    } catch (err) {
      toast((err as Error).message || "干扰项解析失败，请稍后重试", "warn");
    } finally {
      setExplBusy((cur) => (cur === k ? null : cur));
    }
  };

  const submitQuiz = () => {
    if (!quiz) return;
    setChecked(true);
    const totalPts = quiz.questions.reduce((s, q) => s + (q.pts ?? 1), 0);
    const gotPts = quiz.questions.reduce((s, q, k) => s + (picked[k] === q.answer ? (q.pts ?? 1) : 0), 0);
    if (!logged && totalPts > 0) {
      const at = Date.now();
      const exSnap = {
        title: quiz.title || src.title,
        docs: quiz.docs.length ? quiz.docs : [{ text }],
      };
      const missed: CompMiss[] = quiz.questions
        .map((q, k) => ({ q, k }))
        .filter(({ q, k }) => picked[k] !== q.answer)
        .map(({ q, k }) => buildCompMissSnapshot({ ...q, doc: q.doc ?? 0 }, exSnap, "listen", missKeyFor(k), at));
      if (missed.length > 0) {
        addMisses(missed);
        setCauses(Object.fromEntries(missed.map((m) => [m.q!, m.cause])));
      }
      setFinishedAt(at);
      recordRealListenScore(`real:${src.presetId ?? src.id}`, gotPts, totalPts);
      patchSource(src.id, { done: at, notes });
      setLogged(true);
      toast(`已写入模考记录（${gotPts}/${totalPts} 分）${missed.length ? ` · ${missed.length} 道错题已记入错题回流` : ""}`);
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
          <button className="btn btn-ghost" onClick={() => void handleBack()}>
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
          {isLongBroadcast && step <= 1 && (
            <div className="segmented" role="group" aria-label="广播时长范围">
              <button
                className={excerptMode === "excerpt3m" ? "is-on" : ""}
                onClick={() => {
                  setExcerptMode("excerpt3m");
                  setPhase("idle");
                }}
                aria-pressed={excerptMode === "excerpt3m"}
              >
                3 分钟考场节选模式
              </button>
              <button
                className={excerptMode === "full" ? "is-on" : ""}
                onClick={() => {
                  setExcerptMode("full");
                  setPhase("idle");
                }}
                aria-pressed={excerptMode === "full"}
              >
                10 分钟完整广播
              </button>
            </div>
          )}
        </div>

        {isLongBroadcast && step <= 1 && (
          <div className="real-excerpt-banner">
            <span>
              {excerptMode === "excerpt3m"
                ? `3 分钟考场节选模式（${clock(excerptWindow.start)}–${clock(excerptWindow.end)}）：贴合 DELF B2 长听力单篇约 3 分钟考场负荷，避免 10 分钟连听两遍疲劳。`
                : "10 分钟完整广播模式：播放整期 RFI 新闻，适合完整答完下方全部 7 道配套理解题。"}
            </span>
          </div>
        )}

        {isTtsChronicle ? (
          <div className="panel exam-player">
            {examMode && step === 0 ? (
              <span className="muted small">
                {phase === "play1" || phase === "play2"
                  ? `${chronicleTurnInfo ?? "正在按 ~170 WPM 母语电台常速播音…"}（盲听期间隐藏快进条）`
                  : "考场盲听就绪：点击下方「开始两遍限时盲听」，系统将以 ~170 WPM 常速自动播放两遍。"}
              </span>
            ) : (
              <>
                <div className="exam-doc-actions">
                  {chroniclePlaying ? (
                    <button type="button" className="btn btn-ghost" onClick={stopChronicle}>
                      <Square size={15} /> 停止常速广播
                    </button>
                  ) : (
                    <button type="button" className="btn btn-primary" onClick={() => void playChronicleFromRatio(0, chronicleRate)}>
                      <Play size={15} /> 播放 ~170 WPM 常速广播
                    </button>
                  )}
                  {chronicleTurnInfo && <span className="muted small">{chronicleTurnInfo}</span>}
                </div>
                <div className="segmented" role="group" aria-label="常速广播倍速">
                  {CHRONICLE_RATES.map((r) => (
                    <button
                      key={r.rate}
                      type="button"
                      className={chronicleRate === r.rate ? "is-on" : ""}
                      aria-pressed={chronicleRate === r.rate}
                      onClick={() => setChronicleRate(r.rate)}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <Player
            src={effectiveSrc}
            examMode={examMode && step === 0}
            phase={phase}
            seekRequest={seekRequest}
            onTimeReport={(pPos, pDur) => {
              setPlayPos(pPos);
              if (pDur > 0) setPlayDur(pDur);
            }}
            onTrackEnded={onTrackEnded}
          />
        )}

        {!examMode && text && step >= 1 && transcriptParas.length > 0 && (
          <details className="panel real-transcript-jump" open={step === 2}>
            <summary className="eyebrow">
              {rfiSegments ? "同步原文段落（精确句级时间戳，点击跳转）" : "同步原文段落（点击任一段按估测时间跳转定位）"}
            </summary>
            <div className="real-transcript-list">
              {transcriptParas.map((para) => {
                const active = playPos >= para.startSec && playPos < para.endSec;
                return (
                  <button
                    key={para.idx}
                    type="button"
                    className={`real-para-btn ${active ? "is-on" : ""}`}
                    onClick={() => setSeekRequest({ sec: para.startSec, nonce: Date.now() })}
                  >
                    <span className="real-para-time">{clock(Math.floor(para.startSec))}</span>
                    <span lang="fr">{para.text}</span>
                  </button>
                );
              })}
            </div>
          </details>
        )}

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
                {quiz.questions.map((q, k) => {
                  const miss = checked && picked[k] !== q.answer;
                  const mKey = missKeyFor(k);
                  return (
                    <li key={k}>
                      <p className="exam-q" lang="fr">
                        {q.q} {q.pts ? <small className="muted">({q.pts} pt)</small> : null}
                      </p>
                      <div className="exam-options" role="radiogroup" aria-label={`第 ${k + 1} 题`}>
                        {q.options.map((o, j) => {
                          const on = picked[k] === j;
                          const optKey = `${k}-${j}`;
                          const isStruck = !checked && !!struck[optKey];
                          const state = checked ? (j === q.answer ? "is-right" : on ? "is-wrong" : "") : on ? "is-on" : "";
                          return (
                            <div key={j} className="exam-opt-row">
                              <button
                                type="button"
                                role="radio"
                                aria-checked={on}
                                className={`exam-option ${state} ${isStruck ? "is-struck" : ""}`}
                                disabled={checked}
                                lang="fr"
                                onClick={() => {
                                  setPicked((p) => ({ ...p, [k]: j }));
                                  setStruck((s) => {
                                    if (!s[optKey]) return s;
                                    const next = { ...s };
                                    delete next[optKey];
                                    return next;
                                  });
                                }}
                                onContextMenu={
                                  !checked
                                    ? (ev) => {
                                        ev.preventDefault();
                                        toggleStrike(optKey);
                                      }
                                    : undefined
                                }
                              >
                                <span>{"ABCDEF"[j]}</span>
                                {o}
                                {checked && j === q.answer && <Check size={16} />}
                                {checked && on && j !== q.answer && <X size={16} />}
                              </button>
                              {!checked && (
                                <button
                                  type="button"
                                  className={`exam-strike-btn ${isStruck ? "is-on" : ""}`}
                                  aria-pressed={isStruck}
                                  title="右键选项或点此划线排除干扰项"
                                  onClick={() => toggleStrike(optKey)}
                                >
                                  {isStruck ? "已排除" : "排除"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {checked && q.why && <p className="exam-why">{q.why}</p>}
                      {checked && ((resolvedAudioUrl && (Boolean(rfiSegments?.segments.length) || Boolean(q.evidence))) || Boolean(q.evidence)) && (
                        <div className="ce-proof-coach">
                          <div className="exam-doc-actions">
                            <button
                              type="button"
                              className={`btn btn-ghost btn-sm ${playingProofIdx === k ? "is-on" : ""}`}
                              onClick={() => void handlePlayQuestionEvidence(k, q)}
                            >
                              {playingProofIdx === k ? (
                                <>
                                  <Square size={13} /> 停止证据片段
                                </>
                              ) : (
                                <>▶ 听原声证据 (~10s)</>
                              )}
                            </button>
                          </div>
                          {q.evidence && (
                            <p className="ce-proof-quote small">
                              <b>广播原文依据：</b>
                              <span lang="fr">« {q.evidence} »</span>
                            </p>
                          )}
                        </div>
                      )}
                      {miss && picked[k] !== undefined && ready.text(ai) && (
                        <div className="exam-expl-wrap">
                          {!expls[k] ? (
                            <button
                              type="button"
                              className="link"
                              disabled={explBusy === k}
                              onClick={() => void explainWrong(k, q, picked[k])}
                            >
                              <Sparkles size={14} /> {explBusy === k ? "AI 分析干扰陷阱中…" : "问 AI：为什么我选的这项是陷阱？"}
                            </button>
                          ) : (
                            <div className="exam-expl-card">
                              {expls[k].evidence && (
                                <p>
                                  <b>原文依据：</b>
                                  <span lang="fr">{expls[k].evidence}</span>
                                </p>
                              )}
                              <p>
                                <b>陷阱解析：</b>
                                {expls[k].whyTrap}
                              </p>
                              <p>
                                <b>正确同义改写：</b>
                                {expls[k].whyRight}
                              </p>
                              {expls[k].tip && (
                                <p className="muted small">
                                  <b>排雷技巧：</b>
                                  {expls[k].tip}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {miss && (
                        <div className="miss-cause" role="group" aria-label="错因">
                          <span className="muted">错因{q.skill ? `（${QSKILL_LABEL[q.skill]}题）` : ""}：</span>
                          {MISS_CAUSES.map((c) => (
                            <button key={c} className={causes[mKey] === c ? "is-on" : ""} onClick={() => blame(k, c)} aria-pressed={causes[mKey] === c}>
                              {CAUSE_LABEL[c]}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
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
                    <input type="number" min={0} max={25} step={0.5} value={manualScore} onChange={(e) => setManualScore(e.target.value)} placeholder="总分 (0–25)" className="rfi-score-input" />
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
                <input type="number" min={0} max={25} step={0.5} value={manualScore} onChange={(e) => setManualScore(e.target.value)} placeholder="自评 /25" className="rfi-score-input" />
                <button className="btn btn-primary" onClick={submitManualPdfScore} disabled={logged}>
                  {logged ? "已写入记录" : "写入模考记录"}
                </button>
              </div>
              <p className="essay-text" lang="fr">
                {text}
              </p>
            </div>
          ))}

        {(step === 2 || step === 3) &&
          (!text ? (
            needText
          ) : (
            <IntensiveDoc
              key={step}
              text={text}
              initial={step === 2 ? "sentence" : "shadow"}
              segments={rfiSegments?.segments}
              playSlice={resolvedAudioUrl ? handlePlaySlice : undefined}
              speak={isTtsChronicle ? speakChroniclePiece : undefined}
            />
          ))}

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
