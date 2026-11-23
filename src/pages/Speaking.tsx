import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { transcribeAudio } from "../ai/clients";
import { ready, useAiConfig } from "../ai/config";
import { assessRecording, canAssess, canAssessOrTranscribe, oralCapabilityTier } from "../ai/pronunciation";
import { debateQuestion, gradeSpeaking, makeSubject } from "../ai/tasks";
import { useGrammar } from "../atlas/grammar";
import { stopAudio } from "../lib/audio";
import { countWords, MAX_SPEAKING_MONOLOGUE_LENGTH, totalScore } from "../lib/essay";
import { clock, isSpeakingTyped, MAX_EXAM_LOG, PO_STANDARD_CONSIGNE, resolveLockedTranscripts, SPEAK_TIMES, SPEAKING_SUBJECTS, TOPICS, topicOf, type DebateTurn, type SpeakingFeedback, type SpeakingSubject } from "../lib/exam";
import type { SpeakingSession } from "../lib/exam-schema";
import type { ExamTrack } from "../lib/exam-tracks";
import { useNavGuard } from "../lib/nav-guard";
import { combineSpeakingProns, pendingDebateSamples, phonoLevel, summarizeAcoustics, type PronResult } from "../lib/pronunciation";
import type { Take } from "../lib/recorder";
import { speakingPresetOf } from "../lib/speaking-presets";
import { canDictate, dictate, shouldFallbackToStt } from "../lib/speech";
import { useTimer } from "../lib/timer";
import { logExam, patchSpeakingSessionScore, saveSpeakingCorrections, saveSpeakingSession } from "../store/essays";
import { keepRecording } from "../store/recordings";
import { store, useStore } from "../store/store";
import { confirmAction } from "../ui/ConfirmSheet";
import { useAssess, useRecorder, useSilenceVad } from "../ui/Recording";
import { toast } from "../ui/Toast";
import {
  emptyOfflineSelf,
  MONOLOGUE_CUTOFF_FR,
  MONOLOGUE_CUTOFF_SEC,
  MONOLOGUE_WARN_SEC,
  type Phase,
  speakExaminer,
  two,
  VAD_SILENCE_MS,
} from "./speaking/helpers";
import { SpeakingResult } from "./speaking/SpeakingResult";
import { SpeakingSetup } from "./speaking/SpeakingSetup";
import { SpeakingWork } from "./speaking/SpeakingWork";

const TrackSpeakingStudio = lazy(() =>
  import("./speaking/TrackSpeakingStudio").then((m) => ({ default: m.TrackSpeakingStudio })),
);

/**
 * 口语, supporting DELF B2 (30m prep + 5–7m monologue + debate), TCF EO (12m T1–T3), and TEF EO (15m Sec A `vous` + Sec B `tu`).
 */
export function SpeakingStudio({ onExit }: { onExit: () => void }) {
  const examTrack = useStore((s) => s.settings.examTrack);
  const switchTrack = (next: ExamTrack) => store.settings({ examTrack: next });
  if (examTrack === "tcf" || examTrack === "tef") {
    return (
      <Suspense
        fallback={
          <div className="page practice">
            <p className="muted">加载口语考场模块中…</p>
          </div>
        }
      >
        <TrackSpeakingStudio track={examTrack} onSwitchTrack={switchTrack} onExit={onExit} />
      </Suspense>
    );
  }
  return <DelfSpeakingStudio examTrack={examTrack} onSwitchTrack={switchTrack} onExit={onExit} />;
}

function DelfSpeakingStudio({
  examTrack,
  onSwitchTrack,
  onExit,
}: {
  examTrack: ExamTrack;
  onSwitchTrack: (t: ExamTrack) => void;
  onExit: () => void;
}) {
  const ai = useAiConfig();
  const { data: grammar } = useGrammar();
  const log = (useStore((s) => s.progress.examLog) ?? []).filter((r) => r.part === "speak");
  const sessions = useStore((s) => s.progress.speakingSessions) ?? [];
  const [phase, setPhase] = useState<Phase>("pick");
  const [drawn, setDrawn] = useState<SpeakingSubject[]>([]);
  const [subject, setSubject] = useState<SpeakingSubject | null>(null);
  const [notes, setNotes] = useState("");
  const [said, setSaid] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [spoke, setSpoke] = useState(0);
  const [turns, setTurns] = useState<DebateTurn[]>([]);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [fb, setFb] = useState<SpeakingFeedback | null>(null);
  const [phono, setPhono] = useState<number | null>(null);
  const [offlineSelf, setOfflineSelf] = useState<Record<string, number | null>>(emptyOfflineSelf);
  const [offlineLogged, setOfflineLogged] = useState(false);
  const [talkTake, setTalkTake] = useState<Take | null>(null);
  const [strictMode, setStrictMode] = useState(false);
  const [noAuxMode, setNoAuxMode] = useState(false);
  const [vadAutoEnd, setVadAutoEnd] = useState(false);
  const [cutoffNotice, setCutoffNotice] = useState<string | null>(null);
  const [voiceOffset, setVoiceOffset] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [prepExpired, setPrepExpired] = useState(false);
  const [monologueVoice, setMonologueVoice] = useState(false);
  const [debateVoice, setDebateVoice] = useState(false);
  const [loggedAt, setLoggedAt] = useState<number | null>(null);
  const [gradedTyped, setGradedTyped] = useState(false);
  const [probDraft, setProbDraft] = useState("");
  const [probChecked, setProbChecked] = useState<{ ok: boolean; notes: string[] } | null>(null);
  const [turnTakes, setTurnTakes] = useState<Record<number, Take>>({});
  const [turnProns, setTurnProns] = useState<Record<number, PronResult>>({});
  const [speechFailed, setSpeechFailed] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [rawMonologue, setRawMonologue] = useState("");
  const [rawTurns, setRawTurns] = useState<Record<number, string>>({});
  const [gradedLock, setGradedLock] = useState(false);

  const saidValRef = useRef("");
  saidValRef.current = said;
  const voiceWordsRef = useRef(0);
  const turnBaseRef = useRef("");
  const speechFailedRef = useRef(false);
  const rawMonologueRef = useRef("");
  const rawTurnsRef = useRef<Record<number, string>>({});
  const gradedLockRef = useRef(false);
  const warned630Ref = useRef(false);
  const cutoffTriggeredRef = useRef(false);
  const monologueSttPromiseRef = useRef<Promise<PronResult | null> | null>(null);
  const talkPronRef = useRef<PronResult | null>(null);
  const inFlightTurnJobsRef = useRef<Record<number, Promise<void>>>({});
  const turnsRef = useRef<DebateTurn[]>(turns);
  turnsRef.current = turns;
  const turnTakesRef = useRef<Record<number, Take>>(turnTakes);
  turnTakesRef.current = turnTakes;
  const turnPronsRef = useRef<Record<number, PronResult>>(turnProns);
  turnPronsRef.current = turnProns;

  const recorder = useRecorder();
  const pron = useAssess();
  const stopRec = useRef<(() => void) | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const prep = useTimer();
  const micro = useTimer();
  const talk = useTimer();
  const debate = useTimer();
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const saidRef = useRef<HTMLTextAreaElement>(null);
  const debateInputRef = useRef<HTMLTextAreaElement>(null);

  useNavGuard(
    phase === "prep" || phase === "talk" || phase === "review" || phase === "debate",
    "口语考练正在进行中，离开将丢失当前录音与辩论进度，确定离开？",
  );
  const MAX_TURNS = 20;
  const dictation = canDictate();
  const hasAi = ready.text(ai);
  const azureReady = canAssess(ai);
  const whisperReady = ready.stt(ai);
  const neuralSttReady = canAssessOrTranscribe(ai);
  const oralTier = oralCapabilityTier(ai);
  const lockTranscripts = strictMode || noAuxMode;

  const [lastSessionId, setLastSessionId] = useState<string | null>(null);
  const [retellBase, setRetellBase] = useState<SpeakingSession | null>(null);
  const pointTitle = useMemo(() => new Map((grammar?.points ?? []).map((p) => [p.id, p.title])), [grammar]);
  const points = () => (grammar?.points ?? []).map((p) => ({ id: p.id, title: p.title }));

  const quiet = () => {
    stopRec.current?.();
    stopRec.current = null;
    stopAudio();
  };
  useEffect(
    () => () => {
      stopRec.current?.();
      ctrl.current?.abort();
      stopAudio();
    },
    [],
  );
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [phase]);
  useEffect(() => {
    if (phase === "prep" && prep.sec === 0 && !prep.running) setPrepExpired(true);
  }, [phase, prep.sec, prep.running]);

  const talkPronResult = pron.state === "done" ? pron.result : talkPronRef.current;
  const combinedPron = useMemo(
    () => combineSpeakingProns(talkPronResult, Object.values(turnProns)),
    [talkPronResult, turnProns],
  );
  const azurePhonoNow = phonoLevel(combinedPron);
  useEffect(() => {
    if (phase !== "result" || !fb || !loggedAt || azurePhonoNow === null) return;
    const nextScore = totalScore(fb) + azurePhonoNow;
    const cur = store.get().progress.examLog?.find((item) => item.part === "speak" && item.at === loggedAt);
    if (!cur || (cur.total === 25 && cur.score === nextScore)) return;
    store.progress((p) => ({
      ...p,
      examLog: (p.examLog ?? []).map((item) => (item.part === "speak" && item.at === loggedAt ? { ...item, score: nextScore, total: 25 } : item)),
    }));
    if (lastSessionId) patchSpeakingSessionScore(lastSessionId, nextScore);
  }, [phase, fb, loggedAt, azurePhonoNow, lastSessionId]);

  /** Live browser speech captions ONLY; overwritten by neural Azure/Whisper STT once each take stops. */
  const hear = (into: (text: string) => void, start = "", onVoice?: (final: string) => void, onError?: (err: string) => void) => {
    setListening(true);
    stopRec.current = dictate(
      (final, guess) => {
        if (final.trim()) onVoice?.(final);
        into(start + final);
        setInterim(guess);
      },
      (error) => {
        setListening(false);
        setInterim("");
        if (error) {
          if (onError) onError(error);
          else toast(error, "warn");
        }
      },
    );
  };

  const draw = async (fromAi: boolean) => {
    setRetellBase(null);
    setLastSessionId(null);
    if (!fromAi) {
      setDrawn(two(SPEAKING_SUBJECTS));
      return setPhase("choose");
    }
    const c = new AbortController();
    ctrl.current = c;
    setPhase("drawing");
    try {
      const made = await Promise.all(two(TOPICS).map((t) => makeSubject(t, c.signal)));
      if (c.signal.aborted) return;
      setDrawn(made);
      setPhase("choose");
    } catch (err) {
      if (c.signal.aborted) return;
      toast((err as Error).message || "出题失败", "warn");
      setPhase("pick");
    }
  };

  const choose = (s: SpeakingSubject) => {
    setSubject(s);
    setNotes("");
    setSaid("");
    saidValRef.current = "";
    setInterim("");
    setTurns([]);
    setAskError(null);
    setFb(null);
    setPhono(null);
    setOfflineSelf(emptyOfflineSelf());
    setOfflineLogged(false);
    setTalkTake(null);
    setCutoffNotice(null);
    setVoiceOffset(Math.floor(Math.random() * 12));
    setShowHint(false);
    setPrepExpired(false);
    setMonologueVoice(false);
    setDebateVoice(false);
    setLoggedAt(null);
    setLastSessionId(null);
    setGradedTyped(false);
    setProbDraft("");
    setProbChecked(null);
    setTurnTakes({});
    setTurnProns({});
    setSpeechFailed(false);
    setTranscribing(false);
    setRawMonologue("");
    setRawTurns({});
    setGradedLock(false);
    speechFailedRef.current = false;
    turnBaseRef.current = "";
    rawMonologueRef.current = "";
    rawTurnsRef.current = {};
    gradedLockRef.current = false;
    warned630Ref.current = false;
    cutoffTriggeredRef.current = false;
    monologueSttPromiseRef.current = null;
    talkPronRef.current = null;
    inFlightTurnJobsRef.current = {};
    turnTakesRef.current = {};
    turnPronsRef.current = {};
    micro.stop();
    voiceWordsRef.current = 0;
    pron.reset();
    setSpoke(0);
    setPhase("prep");
    prep.start(SPEAK_TIMES.prep);
  };

  const startTalk = async () => {
    prep.stop();
    micro.stop();
    warned630Ref.current = false;
    cutoffTriggeredRef.current = false;
    setCutoffNotice(null);
    setPhase("talk");
    if (recorder.supported) await recorder.start();
    talk.start();
    if (!dictation) return;
    hear(
      (text) => {
        const clipped = text.slice(0, MAX_SPEAKING_MONOLOGUE_LENGTH);
        saidValRef.current = clipped;
        setSaid(clipped);
      },
      "",
      (final) => {
        const clipped = final.slice(0, MAX_SPEAKING_MONOLOGUE_LENGTH);
        setMonologueVoice(true);
        voiceWordsRef.current = countWords(clipped);
        rawMonologueRef.current = clipped;
        setRawMonologue(clipped);
      },
    );
  };

  /** Overwrite lossy Web Speech draft with verbatim neural Azure/Whisper monologue transcript. */
  const applyNeuralMonologue = (neuralRaw: string) => {
    const clipped = neuralRaw.trim().slice(0, MAX_SPEAKING_MONOLOGUE_LENGTH);
    if (!clipped) return "";
    setMonologueVoice(true);
    voiceWordsRef.current = Math.max(voiceWordsRef.current, countWords(clipped));
    rawMonologueRef.current = clipped;
    setRawMonologue(clipped);
    saidValRef.current = clipped;
    setSaid(clipped);
    return clipped;
  };

  const runMonologueAssessment = async (blob: Blob): Promise<PronResult | null> => {
    let pronRes: PronResult | null = null;
    let neuralText = "";
    if (canAssessOrTranscribe()) {
      pronRes = await pron.run(blob);
      talkPronRef.current = pronRes;
      const candidate = (pronRes?.lexicalText || pronRes?.text || "").trim();
      if (candidate) {
        neuralText = applyNeuralMonologue(candidate);
      }
    }
    if (!neuralText && shouldFallbackToStt({ dictationSupported: false, speechFailed: true, transcript: "", sttAvailable: ready.stt() })) {
      setTranscribing(true);
      try {
        const txt = await transcribeAudio(blob);
        if (txt.trim()) {
          neuralText = applyNeuralMonologue(txt);
        }
      } catch (err) {
        if (!strictMode) toast((err as Error).message || "Whisper 语音转写失败，可对照录音手动补充", "warn");
      } finally {
        setTranscribing(false);
      }
    }
    return pronRes;
  };

  const endTalk = async (opts?: { fromCutoff?: boolean }) => {
    quiet();
    talk.stop();
    setSpoke(talk.sec);

    if (strictMode) {
      setAskError(null);
      setPhase("debate");
      debate.stop();
      const t = await recorder.stop();
      setTalkTake(t);
      const sttJob = t ? runMonologueAssessment(t.blob) : Promise.resolve(null);
      monologueSttPromiseRef.current = sttJob;

      if (opts?.fromCutoff) {
        await speakExaminer(MONOLOGUE_CUTOFF_FR, 0, voiceOffset, ai).catch(() => "stopped");
      }
      if (hasAi && !saidValRef.current.trim() && t && canAssessOrTranscribe()) {
        setAsking(true);
        await sttJob.catch(() => null);
      }
      void ask([]);
      return;
    }

    setPhase("review");
    const t = await recorder.stop();
    setTalkTake(t);
    if (!t) return;
    const sttJob = runMonologueAssessment(t.blob);
    monologueSttPromiseRef.current = sttJob;
    await sttJob;
  };

  // 6:30 amber warning + 7:15 polite examiner cutoff in strictMode
  useEffect(() => {
    if (phase !== "talk") return;
    if (talk.sec >= MONOLOGUE_WARN_SEC && !warned630Ref.current) {
      warned630Ref.current = true;
      toast(
        strictMode
          ? "独白已达 6:30（黄灯提醒），请尽快收束结论；7:15 考官将礼貌打断进入辩论。"
          : "独白已达 6:30，建议在 7:00 前收束结论进入辩论。",
        "warn",
      );
    }
    if (strictMode && talk.sec >= MONOLOGUE_CUTOFF_SEC && !cutoffTriggeredRef.current) {
      cutoffTriggeredRef.current = true;
      setCutoffNotice(MONOLOGUE_CUTOFF_FR);
      void endTalk({ fromCutoff: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, talk.sec, strictMode]);

  /** Start recording (and browser live captions when available) for debate turn `turnIdx`. */
  const beginDebateAnswer = async (turnIdx: number, existingText: string) => {
    stopAudio();
    const baseText = (lockTranscripts && rawTurnsRef.current[turnIdx]?.trim() ? rawTurnsRef.current[turnIdx] : existingText).trim();
    turnBaseRef.current = baseText;
    if (recorder.supported && !recorder.on) await recorder.start();
    if (dictation && !speechFailedRef.current) {
      hear(
        (text) => setTurns((ts) => ts.map((t, k) => (k === turnIdx ? { ...t, a: text } : t))),
        baseText ? `${baseText} ` : "",
        (final) => {
          setDebateVoice(true);
          const combined = (baseText ? `${baseText} ` : "") + final.trim();
          const nextRaw = { ...rawTurnsRef.current, [turnIdx]: combined };
          rawTurnsRef.current = nextRaw;
          setRawTurns(nextRaw);
        },
        (err) => {
          speechFailedRef.current = true;
          setSpeechFailed(true);
          toast(`${err}${canAssessOrTranscribe() ? "（已继续录音，停止后将自动覆盖为高保真语音转写）" : "（已继续录音，停止后可回放补全文字）"}`, "warn");
        },
      );
    }
  };

  /**
   * Stop debate recording/captions for `turnIdx` and assess the turn asynchronously via Azure Tier-1 or Whisper Tier-2,
   * overwriting the lossy Web Speech draft in `rawTurns[turnIdx]` and `turns[turnIdx].a`.
   */
  const stopDebateAnswer = async (turnIdx: number): Promise<DebateTurn[]> => {
    stopRec.current?.();
    stopRec.current = null;
    setListening(false);
    setInterim("");
    const base = turnBaseRef.current;
    const take = recorder.on ? await recorder.stop() : null;
    if (take) {
      const nextTakes = { ...turnTakesRef.current, [turnIdx]: take };
      turnTakesRef.current = nextTakes;
      setTurnTakes(nextTakes);
    }
    const curText = turnsRef.current[turnIdx]?.a ?? "";

    const applyTurnNeural = (neuralRaw: string) => {
      const trimmed = neuralRaw.trim();
      if (!trimmed) return;
      setDebateVoice(true);
      const merged = base ? `${base} ${trimmed}` : trimmed;
      const nextRaw = { ...rawTurnsRef.current, [turnIdx]: merged };
      rawTurnsRef.current = nextRaw;
      setRawTurns(nextRaw);
      setTurns((prev) => {
        const next = prev.map((t, k) => (k === turnIdx ? { ...t, a: merged } : t));
        turnsRef.current = next;
        return next;
      });
    };

    if (take && canAssessOrTranscribe()) {
      const needBlockingText = !curText.trim();
      if (needBlockingText) setTranscribing(true);
      const job = (async () => {
        try {
          const pr = await assessRecording(take.blob);
          if (pr) {
            const nextProns = { ...turnPronsRef.current, [turnIdx]: pr };
            turnPronsRef.current = nextProns;
            setTurnProns(nextProns);
            const neural = (pr.lexicalText || pr.text || "").trim();
            if (neural) {
              applyTurnNeural(neural);
              return;
            }
          }
        } catch (err) {
          if (!ready.stt() && needBlockingText) {
            toast((err as Error).message || "语音转写失败，可回放下方录音补充文字", "warn");
          }
        }
        if (ready.stt() && canAssess()) {
          try {
            const txt = await transcribeAudio(take.blob);
            if (txt.trim()) applyTurnNeural(txt);
          } catch (err) {
            if (needBlockingText) toast((err as Error).message || "Whisper 转写失败，可回放下方录音补充文字", "warn");
          }
        }
      })().finally(() => {
        delete inFlightTurnJobsRef.current[turnIdx];
        if (needBlockingText) setTranscribing(false);
      });

      inFlightTurnJobsRef.current[turnIdx] = job;
      if (needBlockingText) {
        await job;
      }
    }
    return turnsRef.current;
  };

  /** Ask the examiner's next question and read it aloud (AI or built-in offline preset). */
  const ask = async (so: DebateTurn[]) => {
    if (!subject) return;
    stopRec.current?.();
    stopRec.current = null;
    setListening(false);
    setInterim("");
    const c = new AbortController();
    ctrl.current = c;
    setAskError(null);
    if (!hasAi) {
      const followUps = speakingPresetOf(subject.id)?.followUps ?? [];
      const item = followUps[so.length];
      if (!item) {
        debate.stop();
        setPhase("result");
        return;
      }
      if (so.length === 0 && !debate.running) debate.start();
      const next = [...so, { q: item.q, a: "" }];
      turnsRef.current = next;
      setTurns(next);
      const r = await speakExaminer(item.q, so.length, voiceOffset, ai, c.signal);
      if (r !== "stopped" && !stopRec.current && !c.signal.aborted) void beginDebateAnswer(so.length, "");
      return;
    }
    setAsking(true);
    try {
      const resolvedForAsk = resolveLockedTranscripts({
        noAuxMode: lockTranscripts,
        said: saidValRef.current,
        rawSaid: rawMonologueRef.current,
        turns: so,
        rawTurns: rawTurnsRef.current,
      });
      const monologueForPrompt =
        resolvedForAsk.transcript.trim() ||
        "（考生已完成口头陈述，当前未配置实时语音转写接口，请围绕题目材料核心争议发起追问。）";
      const q = await debateQuestion(
        { subject, monologue: monologueForPrompt, turns: resolvedForAsk.turns, minutes: Math.floor(debate.sec / 60), strict: strictMode },
        c.signal,
      );
      if (c.signal.aborted) return;
      if (so.length === 0 && !debate.running) debate.start();
      const next = [...so, { q, a: "" }];
      turnsRef.current = next;
      setTurns(next);
      setAsking(false);
      const r = await speakExaminer(q, so.length, voiceOffset, ai, c.signal);
      if (r !== "stopped" && !stopRec.current && !c.signal.aborted) void beginDebateAnswer(so.length, "");
    } catch (err) {
      if (c.signal.aborted) return;
      setAsking(false);
      const msg = (err as Error).message || "考官没有接上话";
      setAskError(msg);
      toast(msg, "warn");
    }
  };

  const endDebate = (so: DebateTurn[]) => {
    if (hasAi) {
      void assess(so);
      return;
    }
    quiet();
    debate.stop();
    if (azurePhonoNow !== null && offlineSelf.phono === null) {
      setOfflineSelf((cur) => ({ ...cur, phono: azurePhonoNow }));
    }
    setPhase("result");
  };

  const startDebate = () => {
    if (lockTranscripts && !rawMonologueRef.current.trim() && saidValRef.current.trim()) {
      rawMonologueRef.current = saidValRef.current;
      setRawMonologue(saidValRef.current);
    }
    setAskError(null);
    setPhase("debate");
    debate.stop();
    void ask([]);
  };

  const setAnswer = (a: string) =>
    setTurns((ts) =>
      ts.map((t, k) => {
        if (k !== ts.length - 1) return t;
        if (strictMode) return t;
        if (noAuxMode && (gradedLockRef.current || !!rawTurnsRef.current[k]?.trim())) return t;
        return { ...t, a };
      }),
    );

  const startRetell = (sess: SpeakingSession) => {
    const matched = SPEAKING_SUBJECTS.find((s) => s.id === sess.subjectId) ?? {
      id: sess.subjectId,
      topic: sess.topic || "travail",
      title: sess.title,
      doc: sess.transcript ? sess.transcript.slice(0, 260) : sess.title,
      ask: "请重新组织论证结构并优化语调节奏后二稿陈述。",
    };
    choose(matched);
    setRetellBase(sess);
  };

  const selectPhono = (v: number) => {
    setPhono(v);
    if (!fb || !loggedAt) return;
    const nextScore = totalScore(fb) + v;
    store.progress((p) => ({
      ...p,
      examLog: (p.examLog ?? []).map((item) => (item.part === "speak" && item.at === loggedAt ? { ...item, score: nextScore, total: 25 } : item)),
    }));
    if (lastSessionId) patchSpeakingSessionScore(lastSessionId, nextScore);
  };

  const advanceDebateTurn = async (turnIdx: number) => {
    const latest = await stopDebateAnswer(turnIdx);
    quiet();
    const ans = latest[turnIdx]?.a;
    if (lockTranscripts && ans?.trim() && !rawTurnsRef.current[turnIdx]?.trim()) {
      const nextRaw = { ...rawTurnsRef.current, [turnIdx]: ans };
      rawTurnsRef.current = nextRaw;
      setRawTurns(nextRaw);
    }
    if (!hasAi || ans?.trim() || !!turnTakesRef.current[turnIdx]) void ask(latest);
  };

  const finishDebate = async (turnIdx: number) => {
    const latest = await stopDebateAnswer(turnIdx);
    endDebate(latest);
  };

  const preset = subject ? speakingPresetOf(subject.id) : undefined;
  const allPresetAsked = !hasAi && !!preset && turns.length >= preset.followUps.length;
  const currentTurnIdx = turns.length - 1;
  const currentTurnSpeechText = currentTurnIdx >= 0 ? `${turns[currentTurnIdx]?.a ?? ""} ${interim}`.trim() : "";

  useSilenceVad({
    enabled: vadAutoEnd && phase === "debate",
    active: phase === "debate" && !asking && !transcribing && currentTurnIdx >= 0 && (recorder.on || listening),
    speechText: currentTurnSpeechText,
    silenceMs: VAD_SILENCE_MS,
    onSilence: () => {
      if (currentTurnIdx < 0) return;
      if (debate.sec < SPEAK_TIMES.debate[1] && turnsRef.current.length < MAX_TURNS && !allPresetAsked) {
        void advanceDebateTurn(currentTurnIdx);
      } else {
        void finishDebate(currentTurnIdx);
      }
    },
  });

  const assess = async (so: DebateTurn[]) => {
    if (!subject) return;
    if (lockTranscripts && gradedLockRef.current) return;
    quiet();
    debate.stop();

    const c = new AbortController();
    ctrl.current = c;
    setPhase("grading");

    try {
      // Wait for any in-flight neural monologue or per-turn debate assessments before resolving transcripts & acoustics
      await Promise.allSettled([
        ...(monologueSttPromiseRef.current ? [monologueSttPromiseRef.current] : []),
        ...Object.values(inFlightTurnJobsRef.current),
      ]);
      if (c.signal.aborted) return;

      const latestTurns = so.length > 0 ? turnsRef.current : so;
      const resolved = resolveLockedTranscripts({
        noAuxMode: lockTranscripts,
        said: saidValRef.current,
        rawSaid: rawMonologueRef.current,
        turns: latestTurns,
        rawTurns: rawTurnsRef.current,
      });

      if (!resolved.transcript.trim()) {
        toast("未能获取独白文字，请先配置 Azure/Whisper 语音接口或在陪练模式补充独白内容", "warn");
        setPhase(latestTurns.length ? "debate" : "review");
        return;
      }

      if (lockTranscripts) {
        if (!rawMonologueRef.current.trim() && resolved.transcript.trim()) {
          rawMonologueRef.current = resolved.transcript;
          setRawMonologue(resolved.transcript);
        }
        saidValRef.current = resolved.transcript;
        setSaid(resolved.transcript);
        turnsRef.current = resolved.turns;
        setTurns(resolved.turns);
      }

      const assessDebateSamples = async (): Promise<Record<number, PronResult>> => {
        const latestProns = turnPronsRef.current;
        if (!canAssessOrTranscribe()) return latestProns;
        const missing = pendingDebateSamples(resolved.turns, turnTakesRef.current, latestProns, 4);
        if (!missing.length) return latestProns;
        const nextMap: Record<number, PronResult> = { ...latestProns };
        for (const [k, take] of missing) {
          if (c.signal.aborted) break;
          try {
            const pr = await assessRecording(take.blob, undefined, c.signal);
            if (pr) nextMap[k] = pr;
          } catch {
            /* skip silent or failed debate sample without blocking grading */
          }
        }
        return nextMap;
      };

      const updatedTurnProns = await assessDebateSamples();
      if (c.signal.aborted) return;
      turnPronsRef.current = updatedTurnProns;
      setTurnProns(updatedTurnProns);

      const talkPron = talkPronRef.current ?? (pron.state === "done" ? pron.result : null);
      const freshCombined = combineSpeakingProns(talkPron, Object.values(updatedTurnProns));
      const monoAcoustics = summarizeAcoustics(talkPron, notes);
      const mergedAcoustics = summarizeAcoustics(freshCombined, notes);
      const acoustics = mergedAcoustics
        ? {
            ...mergedAcoustics,
            ...(monoAcoustics?.likelyReadAloud ? { likelyReadAloud: true } : {}),
          }
        : monoAcoustics ?? undefined;

      const answered = resolved.turns.filter((t) => t.a.trim());
      const spokenWords = countWords(resolved.transcript);
      const monoSec = Math.max(spoke, talkTake?.seconds ?? 0);
      const isTyped = isSpeakingTyped({
        monologueVoice,
        voiceMonologueWords: voiceWordsRef.current,
        totalMonologueWords: spokenWords,
        answeredTurns: answered.length,
        debateVoice,
      });
      const payload = {
        subject,
        transcript: resolved.transcript,
        turns: answered,
        points: points(),
        monologueWords: spokenWords,
        monologueSec: monoSec,
        debateSec: debate.sec,
        typed: isTyped,
        ...(acoustics ? { acoustics } : {}),
      };

      const r = await gradeSpeaking(payload as Parameters<typeof gradeSpeaking>[0], c.signal);
      if (c.signal.aborted) return;
      setFb(r);
      if (r.corrections.length) saveSpeakingCorrections(subject.title, r.corrections);
      setGradedTyped(isTyped);
      const currentAzure = phonoLevel(freshCombined);
      const effectivePhono = currentAzure ?? phono;
      const hasProno = effectivePhono !== null;
      const score = totalScore(r) + (effectivePhono ?? 0);
      const total = hasProno ? 25 : 20;
      const what = subject.id.startsWith("ai-") ? subject.topic : subject.id;
      const at = Date.now();
      setLoggedAt(at);
      store.progress((p) => ({
        ...p,
        examLog: [{ part: "speak" as const, what, score, total, level: "B2" as const, scope: "full" as const, ...(isTyped ? { typed: true } : {}), at }, ...(p.examLog ?? [])].slice(0, MAX_EXAM_LOG),
      }));
      const savedTakeId = talkTake
        ? await keepRecording({ label: subject.title, blob: talkTake.blob, seconds: talkTake.seconds, bucket: "exam" }).catch(() => null)
        : null;
      const draftNo = sessions.filter((s) => s.subjectId === subject.id).length + 1;
      const sid = saveSpeakingSession({
        at,
        subjectId: subject.id,
        title: subject.title,
        topic: subject.topic,
        monologueWords: spokenWords,
        monologueSec: monoSec,
        debateTurns: answered.length,
        debateSec: debate.sec,
        total25: hasProno ? score : null,
        ...(isTyped ? { typed: true } : {}),
        draft: draftNo,
        ...(freshCombined
          ? {
              pron: {
                pron: freshCombined.pron,
                accuracy: freshCombined.accuracy,
                fluency: freshCombined.fluency,
                prosody: freshCombined.prosody,
                completeness: freshCombined.completeness,
              },
            }
          : {}),
        transcript: resolved.transcript,
        turns: answered.map((t) => ({ q: t.q, a: t.a })),
        ...(savedTakeId ? { takeId: savedTakeId } : {}),
      });
      setLastSessionId(sid);
      gradedLockRef.current = true;
      setGradedLock(true);
      setPhase("result");
    } catch (err) {
      if (c.signal.aborted) return;
      toast((err as Error).message || "批改失败", "warn");
      setPhase(so.length || strictMode ? "debate" : "review");
    }
  };

  const leave = async () => {
    if (phase === "prep" || phase === "talk" || phase === "review" || phase === "debate") {
      const ok = await confirmAction({
        title: "放弃本次口语练习？",
        message: "口语考练正在进行中，离开将丢失当前录音、转写和辩论进度，确定放弃？",
        confirmLabel: "确定放弃",
        danger: true,
      });
      if (!ok) return;
    }
    quiet();
    void recorder.stop();
    pron.reset();
    ctrl.current?.abort();
    prep.stop();
    micro.stop();
    talk.stop();
    debate.stop();
    setAsking(false);
    setAskError(null);
    setPhase("pick");
  };

  if (phase === "pick" || phase === "drawing" || phase === "choose" || !subject) {
    return (
      <SpeakingSetup
        phase={phase}
        examTrack={examTrack}
        onSwitchTrack={onSwitchTrack}
        oralTier={oralTier}
        hasAi={hasAi}
        neuralSttReady={neuralSttReady}
        azureReady={azureReady}
        whisperReady={whisperReady}
        dictation={dictation}
        recorderSupported={recorder.supported}
        drawn={drawn}
        strictMode={strictMode}
        setStrictMode={setStrictMode}
        noAuxMode={noAuxMode}
        setNoAuxMode={setNoAuxMode}
        pointTitle={pointTitle}
        sessions={sessions}
        log={log}
        onExit={onExit}
        onLeave={() => void leave()}
        onDraw={(fromAi) => void draw(fromAi)}
        onChoose={choose}
        onResetPhasePick={() => setPhase("pick")}
        onStartRetell={startRetell}
      />
    );
  }

  const topic = topicOf(subject.topic);
  const words = countWords(said);
  const answeredTurns = turns.filter((t, idx) => t.a.trim() || !!turnTakes[idx]).length;
  const canEndDebate = !strictMode || debate.sec >= SPEAK_TIMES.debate[0] || answeredTurns >= 6 || allPresetAsked;
  const [min, max] = SPEAK_TIMES.monologue;
  /** The fifth criterion from Azure's combined monologue+debate assessment (0.5-point steps), when available; else self-assessed. */
  const azurePhono = phonoLevel(combinedPron);
  const talkClockClass =
    talk.sec > max
      ? "is-over"
      : talk.sec >= MONOLOGUE_WARN_SEC
        ? "is-amber"
        : talk.sec >= min
          ? "is-ok"
          : "";

  return (
    <div className="page practice">
      <section className="essay-stage">
        <header className="exam-top">
          <button className="btn btn-ghost" onClick={() => void leave()}>
            {phase === "result" ? "再抽一次" : "放弃这题"}
          </button>
          <span className="eyebrow">
            口语 · {topic?.zh}
            {strictMode ? " · 全真考场" : " · 教练陪练"}
            {noAuxMode ? " · 脱稿无辅助" : ""}
          </span>
          {phase === "prep" && <span className={`exam-clock ${prep.sec === 0 ? "is-over" : ""}`}>{prep.sec === 0 ? "准备时间到" : `准备 ${clock(prep.sec)}`}</span>}
          {phase === "talk" && <span className={`exam-clock ${talkClockClass}`}>{clock(talk.sec)} · 目标 5–7 分钟</span>}
          {phase === "debate" && <span className={`exam-clock ${debate.sec > SPEAK_TIMES.debate[1] ? "is-over" : debate.sec >= SPEAK_TIMES.debate[0] ? "is-ok" : ""}`}>辩论 {clock(debate.sec)} · 考试是 10–13 分钟</span>}
        </header>
        <h2 className="essay-title" lang="fr">
          {subject.title}
        </h2>
        <p className="essay-consigne" lang="fr">
          {subject.doc}
        </p>
        {subject.source && (
          <p className="muted small" lang="fr">
            {subject.source}
          </p>
        )}
        <p className="essay-situation" lang="fr">
          {PO_STANDARD_CONSIGNE}
        </p>
        {showHint || (prepExpired && !noAuxMode && !strictMode) ? (
          <p className="muted small">
            <strong>思路提示：</strong>
            {subject.ask}
          </p>
        ) : (
          ((phase === "prep" && !strictMode && !noAuxMode) || phase === "result") && (
            <div className="writing-actions">
              <button className="link" type="button" onClick={() => setShowHint(true)}>
                思路提示（查看中文要点）
              </button>
            </div>
          )
        )}

        {phase !== "result" ? (
          <SpeakingWork
            phase={phase}
            subject={subject}
            topic={topic}
            preset={preset}
            strictMode={strictMode}
            noAuxMode={noAuxMode}
            hasAi={hasAi}
            sttReady={whisperReady}
            dictation={dictation}
            listening={listening}
            interim={interim}
            speechFailed={speechFailed}
            transcribing={transcribing}
            talkSec={talk.sec}
            cutoffNotice={cutoffNotice}
            vadAutoEnd={vadAutoEnd}
            setVadAutoEnd={setVadAutoEnd}
            notes={notes}
            setNotes={setNotes}
            notesRef={notesRef}
            retellBase={retellBase}
            probDraft={probDraft}
            setProbDraft={setProbDraft}
            probChecked={probChecked}
            setProbChecked={setProbChecked}
            micro={micro}
            debate={debate}
            recorder={recorder}
            pron={pron}
            said={said}
            setSaid={(v) => {
              saidValRef.current = v;
              setSaid(v);
            }}
            saidRef={saidRef}
            words={words}
            spoke={spoke}
            talkTake={talkTake}
            rawMonologue={rawMonologue}
            gradedLock={gradedLock}
            turns={turns}
            turnTakes={turnTakes}
            turnProns={turnProns}
            rawTurns={rawTurns}
            asking={asking}
            askError={askError}
            voiceOffset={voiceOffset}
            debateInputRef={debateInputRef}
            canEndDebate={canEndDebate}
            answeredTurns={answeredTurns}
            allPresetAsked={allPresetAsked}
            maxTurns={MAX_TURNS}
            onStartTalk={() => void startTalk()}
            onEndTalk={() => void endTalk()}
            onStartDebate={startDebate}
            onEnterOfflineResult={() => setPhase("result")}
            onAssess={(so) => void assess(so)}
            onAsk={(so) => void ask(so)}
            onSetAnswer={setAnswer}
            onReplayQuestion={(q, idx) => void speakExaminer(q, idx, voiceOffset, ai)}
            onBeginDebateAnswer={(idx, txt) => void beginDebateAnswer(idx, txt)}
            onStopDebateAnswer={stopDebateAnswer}
            onAdvanceDebateTurn={(turnIdx) => void advanceDebateTurn(turnIdx)}
            onFinishDebate={(turnIdx) => void finishDebate(turnIdx)}
            onCancelGrading={() => {
              ctrl.current?.abort();
              setPhase(turns.length || strictMode ? "debate" : "review");
            }}
          />
        ) : (
          <SpeakingResult
            subject={subject}
            preset={preset}
            fb={fb}
            pointTitle={pointTitle}
            retellBase={retellBase}
            words={words}
            spoke={spoke}
            talkTake={talkTake}
            talkPron={talkPronResult}
            turns={turns}
            turnTakes={turnTakes}
            turnProns={turnProns}
            said={said}
            combinedPron={combinedPron}
            azurePhono={azurePhono}
            phono={phono}
            gradedTyped={gradedTyped}
            onSelectPhono={selectPhono}
            offlineSelf={offlineSelf}
            setOfflineSelf={setOfflineSelf}
            offlineLogged={offlineLogged}
            onSaveOffline={async (sum25) => {
              logExam({ part: "speak", what: subject.id, score: sum25, total: 25, level: "B2", scope: "full" });
              const savedTakeId = talkTake
                ? await keepRecording({ label: subject.title, blob: talkTake.blob, seconds: talkTake.seconds, bucket: "exam" }).catch(() => null)
                : null;
              const sid = saveSpeakingSession({
                at: Date.now(),
                subjectId: subject.id,
                title: subject.title,
                topic: subject.topic,
                monologueWords: words,
                monologueSec: Math.max(spoke, talkTake?.seconds ?? 0),
                debateTurns: answeredTurns,
                debateSec: debate.sec,
                total25: sum25,
                draft: sessions.filter((s) => s.subjectId === subject.id).length + 1,
                ...(combinedPron
                  ? {
                      pron: {
                        pron: combinedPron.pron,
                        accuracy: combinedPron.accuracy,
                        fluency: combinedPron.fluency,
                        prosody: combinedPron.prosody,
                        completeness: combinedPron.completeness,
                      },
                    }
                  : {}),
                transcript: said,
                turns: turns.filter((t) => t.a.trim()).map((t) => ({ q: t.q, a: t.a })),
                ...(savedTakeId ? { takeId: savedTakeId } : {}),
              });
              setLastSessionId(sid);
              setOfflineLogged(true);
              toast(`已记入 DELF B2 口语成绩（${sum25}/25）`, "ok");
            }}
            onRetrySubject={() => choose(subject)}
          />
        )}
      </section>
    </div>
  );
}
