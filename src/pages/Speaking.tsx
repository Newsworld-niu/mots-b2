import { ArrowLeft, ArrowRight, Mic, Shuffle, Sparkles, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ready, useAiConfig, type AiConfig } from "../ai/config";
import { debateQuestion, gradeSpeaking, makeSubject } from "../ai/tasks";
import { assessRecording, canAssess } from "../ai/pronunciation";
import { ttsOn, ttsUrl } from "../ai/tts";
import { useGrammar } from "../atlas/grammar";
import { TARGET_LANG } from "../config";
import { play, stopAudio } from "../lib/audio";
import { CONNECTORS, countWords, CRITERION_CHECK, CRITERION_LABEL, LEVEL_LABEL, LEVELS, MAX_SPEAKING_MONOLOGUE_LENGTH, totalScore } from "../lib/essay";
import { assessDebateEscalation, checkProblematiqueDraft, clock, isSpeakingTyped, MAX_EXAM_LOG, outlineKeywords, PO_STANDARD_CONSIGNE, PROBLEMATIQUE_TIPS, realScore25, resolveLockedTranscripts, SPEAK_TIMES, SPEAKING_SUBJECTS, TALK_PLAN, TOPICS, topicOf, type DebateTurn, type SpeakingFeedback, type SpeakingSubject } from "../lib/exam";
import { debatePhrases } from "../lib/expressions";
import { isNative } from "../lib/native";
import { href } from "../lib/router";
import { duck } from "../lib/sound";
import { canDictate, dictate, pickBrowserFrenchVoice, pickExaminerVoice, shouldFallbackToAzureStt } from "../lib/speech";
import { useTimer } from "../lib/timer";
import { saveSpeakingCorrections } from "../store/essays";
import { store, useStore } from "../store/store";
import { Marking } from "../ui/Marking";
import { combineSpeakingProns, pendingDebateSamples, phonoLevel, type PronResult } from "../lib/pronunciation";
import type { Take } from "../lib/recorder";
import { AssessHint, AssessStatus, PronReport, TakePlayer, useAssess, useRecorder } from "../ui/Recording";
import { toast } from "../ui/Toast";

const day = (ms: number) => new Date(ms).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
const two = <T,>(xs: T[]) => [...xs].sort(() => Math.random() - 0.5).slice(0, 2);

/** Read an examiner turn aloud, rotating among multiple French voices (Azure fr-FR or browser French voices). */
async function speakExaminer(text: string, turnIndex: number, offset: number, aiConfig: AiConfig, signal?: AbortSignal): Promise<"recorded" | "device" | "stopped" | "unsupported"> {
  if (signal?.aborted) return "stopped";
  const second = turnIndex % 2 === 1;
  if (ttsOn()) {
    const voice = pickExaminerVoice(turnIndex, offset, { female: aiConfig.azureVoice, male: aiConfig.azureVoiceMale });
    const src = await ttsUrl(text, voice).catch(() => null);
    if (signal?.aborted) return "stopped";
    return play(src, text, second ? "us" : "uk", 1, second);
  }
  if (!isNative() && typeof window !== "undefined" && "speechSynthesis" in window) {
    stopAudio();
    duck(true);
    try {
      const u = new SpeechSynthesisUtterance(text);
      const { voice, pitch } = pickBrowserFrenchVoice(window.speechSynthesis.getVoices(), turnIndex, offset);
      u.lang = TARGET_LANG;
      u.rate = 0.95;
      u.pitch = pitch;
      if (voice) u.voice = voice;
      return await new Promise<"device" | "stopped">((resolve) => {
        let settled = false;
        const finish = (res: "device" | "stopped") => {
          if (settled) return;
          settled = true;
          signal?.removeEventListener("abort", onAbort);
          resolve(res);
        };
        const onAbort = () => {
          stopAudio();
          finish("stopped");
        };
        signal?.addEventListener("abort", onAbort, { once: true });
        u.onend = () => finish(signal?.aborted ? "stopped" : "device");
        u.onerror = (e) => {
          const err = (e as SpeechSynthesisErrorEvent).error;
          finish(signal?.aborted || err === "interrupted" || err === "canceled" ? "stopped" : "device");
        };
        window.speechSynthesis.speak(u);
      });
    } finally {
      duck(false);
    }
  }
  return play(null, text, second ? "us" : "uk", 1, second);
}

type Phase = "pick" | "drawing" | "choose" | "prep" | "talk" | "review" | "debate" | "grading" | "result";

/**
 * 口语, in the form of the exam: draw two subjects and keep one, 30 minutes to prepare, a talk of 5 to 7 minutes
 * defending a point of view, then a debate in which the AI plays the examiner. The browser turns speech into
 * text and the talk is recorded (kept in memory for playback); the AI marks the transcripts on four criteria of
 * the official grid. The fifth, pronunciation, comes from Azure's pronunciation assessment of the recording when
 * it is set up; otherwise the learner rates it against the grid's descriptors.
 */
export function SpeakingStudio({ onExit }: { onExit: () => void }) {
  const ai = useAiConfig();
  const { data: grammar } = useGrammar();
  const log = (useStore((s) => s.progress.examLog) ?? []).filter((r) => r.part === "speak");
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
  const [talkTake, setTalkTake] = useState<Take | null>(null);
  const [strictMode, setStrictMode] = useState(false);
  const [noAuxMode, setNoAuxMode] = useState(false);
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
  const voiceWordsRef = useRef(0);
  const turnBaseRef = useRef("");
  const speechFailedRef = useRef(false);
  const rawMonologueRef = useRef("");
  const rawTurnsRef = useRef<Record<number, string>>({});
  const gradedLockRef = useRef(false);
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
  const debatePhraseGroups = useMemo(() => debatePhrases(), []);
  const noteCues = useMemo(() => outlineKeywords(notes), [notes]);
  const MAX_TURNS = 20;
  const dictation = canDictate();
  const hasAi = ready.text(ai);
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
  const talkPronResult = pron.state === "done" ? pron.result : null;
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
  }, [phase, fb, loggedAt, azurePhonoNow]);

  /** Turn speech into text, appended to what `into` already holds. */
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
    setInterim("");
    setTurns([]);
    setAskError(null);
    setFb(null);
    setPhono(null);
    setTalkTake(null);
    setVoiceOffset(Math.floor(Math.random() * 12));
    setShowHint(false);
    setPrepExpired(false);
    setMonologueVoice(false);
    setDebateVoice(false);
    setLoggedAt(null);
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
    setPhase("talk");
    // the recording first (it asks for the microphone), then start the stopwatch unconditionally and the recogniser alongside it
    if (recorder.supported) await recorder.start();
    talk.start();
    if (!dictation) return;
    hear(
      (text) => setSaid(text.slice(0, MAX_SPEAKING_MONOLOGUE_LENGTH)),
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

  const endTalk = async () => {
    quiet();
    talk.stop();
    setSpoke(talk.sec);
    setPhase("review");
    const t = await recorder.stop();
    setTalkTake(t);
    if (!t || !pron.available) return;
    const r = await pron.run(t.blob);
    // no recogniser in this browser (Safari on iOS, the app): Azure's transcript stands in for the AI marking
    if (r?.text?.trim()) {
      const clipped = r.text.slice(0, MAX_SPEAKING_MONOLOGUE_LENGTH);
      setMonologueVoice(true);
      voiceWordsRef.current = Math.max(voiceWordsRef.current, countWords(clipped));
      if (!rawMonologueRef.current.trim()) {
        rawMonologueRef.current = clipped;
        setRawMonologue(clipped);
      }
      setSaid((s) => (s.trim() ? s.slice(0, MAX_SPEAKING_MONOLOGUE_LENGTH) : clipped));
    }
  };

  /** Start recording (and browser dictation when available) for debate turn `turnIdx`. */
  const beginDebateAnswer = async (turnIdx: number, existingText: string) => {
    stopAudio();
    const baseText = (noAuxMode && rawTurnsRef.current[turnIdx]?.trim() ? rawTurnsRef.current[turnIdx] : existingText).trim();
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
          toast(`${err}${canAssess() ? "（已继续录音，停止后将自动用 Azure 转写）" : "（已继续录音，停止后可回放补全文字）"}`, "warn");
        },
      );
    }
  };

  /** Stop debate recording/dictation for `turnIdx` and fall back to Azure STT when speech recognition failed/missing. */
  const stopDebateAnswer = async (turnIdx: number): Promise<DebateTurn[]> => {
    stopRec.current?.();
    stopRec.current = null;
    setListening(false);
    setInterim("");
    const take = recorder.on ? await recorder.stop() : null;
    if (take) {
      const nextTakes = { ...turnTakesRef.current, [turnIdx]: take };
      turnTakesRef.current = nextTakes;
      setTurnTakes(nextTakes);
    }
    const curTurn = turnsRef.current[turnIdx];
    const curText = curTurn?.a ?? "";
    if (take && shouldFallbackToAzureStt({ dictationSupported: dictation, speechFailed: speechFailedRef.current, transcript: curText, azureAvailable: canAssess() })) {
      setTranscribing(true);
      try {
        const pr = await assessRecording(take.blob);
        if (pr) {
          const nextProns = { ...turnPronsRef.current, [turnIdx]: pr };
          turnPronsRef.current = nextProns;
          setTurnProns(nextProns);
          if (pr.text.trim()) {
            setDebateVoice(true);
            const base = turnBaseRef.current;
            const merged = curText.trim() && !speechFailedRef.current ? curText : base ? `${base} ${pr.text.trim()}` : pr.text.trim();
            const nextRaw = { ...rawTurnsRef.current, [turnIdx]: merged };
            rawTurnsRef.current = nextRaw;
            setRawTurns(nextRaw);
            const next = turnsRef.current.map((t, k) => (k === turnIdx ? { ...t, a: merged } : t));
            turnsRef.current = next;
            setTurns(next);
            return next;
          }
        }
      } catch (err) {
        toast((err as Error).message || "Azure 转写失败，可回放下方录音手动补充文字", "warn");
      } finally {
        setTranscribing(false);
      }
    }
    return turnsRef.current;
  };

  /** Ask the examiner's next question and read it aloud. */
  const ask = async (so: DebateTurn[]) => {
    if (!subject) return;
    const c = new AbortController();
    ctrl.current = c;
    setAsking(true);
    setAskError(null);
    try {
      const resolvedForAsk = resolveLockedTranscripts({
        noAuxMode,
        said,
        rawSaid: rawMonologueRef.current,
        turns: so,
        rawTurns: rawTurnsRef.current,
      });
      const q = await debateQuestion(
        { subject, monologue: resolvedForAsk.transcript, turns: resolvedForAsk.turns, minutes: Math.floor(debate.sec / 60), strict: strictMode },
        c.signal,
      );
      if (c.signal.aborted) return;
      if (so.length === 0 && !debate.running) debate.start();
      const next = [...so, { q, a: "" }];
      turnsRef.current = next;
      setTurns(next);
      setAsking(false);
      const r = await speakExaminer(q, so.length, voiceOffset, ai, c.signal);
      // as in the room: the examiner stops, the candidate answers (recording + dictation/Azure fallback)
      if (r !== "stopped" && !stopRec.current && !c.signal.aborted) void beginDebateAnswer(so.length, "");
    } catch (err) {
      if (c.signal.aborted) return;
      setAsking(false);
      const msg = (err as Error).message || "考官没有接上话";
      setAskError(msg);
      toast(msg, "warn");
    }
  };

  const startDebate = () => {
    if (noAuxMode && !rawMonologueRef.current.trim() && said.trim()) {
      rawMonologueRef.current = said;
      setRawMonologue(said);
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
        if (noAuxMode && (gradedLockRef.current || !!rawTurnsRef.current[k]?.trim())) return t;
        return { ...t, a };
      }),
    );

  const selectPhono = (v: number) => {
    setPhono(v);
    if (!fb || !loggedAt) return;
    const nextScore = totalScore(fb) + v;
    store.progress((p) => ({
      ...p,
      examLog: (p.examLog ?? []).map((item) => (item.part === "speak" && item.at === loggedAt ? { ...item, score: nextScore, total: 25 } : item)),
    }));
  };

  const assess = async (so: DebateTurn[]) => {
    if (!subject || !said.trim()) return;
    if (noAuxMode && gradedLockRef.current) return;
    quiet();
    debate.stop();
    const resolved = resolveLockedTranscripts({
      noAuxMode,
      said,
      rawSaid: rawMonologueRef.current,
      turns: so,
      rawTurns: rawTurnsRef.current,
    });
    if (noAuxMode) {
      if (!rawMonologueRef.current.trim() && resolved.transcript.trim()) {
        rawMonologueRef.current = resolved.transcript;
        setRawMonologue(resolved.transcript);
      }
      setSaid(resolved.transcript);
      turnsRef.current = resolved.turns;
      setTurns(resolved.turns);
    }
    const c = new AbortController();
    ctrl.current = c;
    setPhase("grading");
    try {
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
      };
      const assessDebateSamples = async (): Promise<Record<number, PronResult>> => {
        const latestProns = turnPronsRef.current;
        if (!canAssess()) return latestProns;
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
      const [r, updatedTurnProns] = await Promise.all([gradeSpeaking(payload, c.signal), assessDebateSamples()]);
      if (c.signal.aborted) return;
      turnPronsRef.current = updatedTurnProns;
      setTurnProns(updatedTurnProns);
      setFb(r);
      if (r.corrections.length) saveSpeakingCorrections(subject.title, r.corrections);
      setGradedTyped(isTyped);
      const talkPron = pron.state === "done" ? pron.result : null;
      const freshCombined = combineSpeakingProns(talkPron, Object.values(updatedTurnProns));
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
        examLog: [{ part: "speak" as const, what, score, total, ...(isTyped ? { typed: true } : {}), at }, ...(p.examLog ?? [])].slice(0, MAX_EXAM_LOG),
      }));
      gradedLockRef.current = true;
      setGradedLock(true);
      setPhase("result");
    } catch (err) {
      if (c.signal.aborted) return;
      toast((err as Error).message || "批改失败", "warn");
      setPhase(so.length ? "debate" : "review");
    }
  };

  const leave = () => {
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
      <div className="page practice">
        <header className="page-head">
          <button className="link deck-back" onClick={onExit}>
            <ArrowLeft size={16} /> 返回练习
          </button>
          <p className="eyebrow">口语 · Production orale</p>
          <h1 className="display">想清楚，再开口。</h1>
          <p className="lede">和考试一样：抽两个题选一个，准备 30 分钟，先连续说 5–7 分钟（指出材料提出的问题，表明并论证自己的看法），再和考官辩论 10–13 分钟。这里由 AI 扮考官：它把问题说出来，你开口回答，它接着你的话追问，直到你结束。</p>
          <p className="muted">
            批改用官方评分表：独白、互动、词汇、语法由 AI 根据文字打分（每项 0／1／3／5，共 20 分）；第五项发音由 Azure 语音评测或你对照标准自评（5 分）。未评第五项时仅显示「不含发音 20 分制」，不会按比例折算 25 分；纯键盘输入不计入 25 分口语曲线。
            {dictation ? "语音识别在浏览器里完成，需要联网和麦克风权限。" : "这个浏览器不支持语音识别：可以对着计时说，然后把说的内容打出来（设置了 Azure 语音会用它听出的文字）；用 Chrome、Edge 或 Safari 可以自动转文字。"}
            {recorder.supported ? "独白会录音，只留在这次练习里，可以回放；设置了 Azure 语音还能给发音、流利度和语调打分，代替自评。" : ""}
          </p>
          {!hasAi && (
            <p className="muted">
              还没有设置 AI 接口：可以照常抽题、准备和开口，但没有辩论和批改。到 <a className="link" href={href({ page: "me" })}>我的 → AI 接口</a> 设置。
            </p>
          )}
        </header>
        {phase === "choose" ? (
          <>
            <h3 className="eyebrow">抽到这两个题，选一个</h3>
            <div className="essay-tasks exam-draw">
              {drawn.map((s) => (
                <button key={s.id} className="essay-task" onClick={() => choose(s)}>
                  <span className="chip">{topicOf(s.topic)?.zh}</span>
                  <b lang="fr">{s.title}</b>
                  <small lang="fr">{s.doc}</small>
                  {s.source && (
                    <small className="muted" lang="fr">
                      {s.source}
                    </small>
                  )}
                </button>
              ))}
            </div>
            <div className="writing-actions">
              <button className="btn btn-ghost" onClick={() => setPhase("pick")}>
                重新抽
              </button>
            </div>
          </>
        ) : (
          <div className="writing-actions exam-draw-actions">
            {phase === "drawing" ? (
              <>
                <p className="muted">AI 出题中（约 20–40 秒）…</p>
                <button className="btn btn-ghost" onClick={leave}>
                  取消
                </button>
              </>
            ) : (
              <>
                <label className="field toggle" style={{ width: "100%" }}>
                  <div>
                    <b>严格模考模式</b>
                    <small>禁止跳过辩论；辩论须满 10 分钟或完成 ≥6 轮有效回答，考官会连续追问施压。</small>
                  </div>
                  <input type="checkbox" role="switch" checked={strictMode} onChange={(e) => setStrictMode(e.target.checked)} />
                  <span className="switch" aria-hidden="true" />
                </label>
                <label className="field toggle" style={{ width: "100%" }}>
                  <div>
                    <b>考场脱稿无辅助模式</b>
                    <small>隐藏准备期模板/词汇与思路提示，发言期隐藏完整笔记仅留关键词提纲，且锁定原始转写禁止考前篡改后重评。</small>
                  </div>
                  <input type="checkbox" role="switch" checked={noAuxMode} onChange={(e) => setNoAuxMode(e.target.checked)} />
                  <span className="switch" aria-hidden="true" />
                </label>
                {hasAi ? (
                  <>
                    <button className="btn btn-primary btn-xl" onClick={() => void draw(true)}>
                      <Sparkles size={18} /> 抽两个新题（AI 按真题长度出题）
                    </button>
                    <button className="btn btn-ghost" onClick={() => void draw(false)}>
                      <Shuffle size={16} /> 抽内置题库（{SPEAKING_SUBJECTS.length} 题，真题长度）
                    </button>
                  </>
                ) : (
                  <button className="btn btn-primary btn-xl" onClick={() => void draw(false)}>
                    <Shuffle size={18} /> 抽两个题（内置 {SPEAKING_SUBJECTS.length} 题）
                  </button>
                )}
              </>
            )}
          </div>
        )}
        {log.length > 0 && phase === "pick" && (() => {
          const realScores = log.map(realScore25).filter((x): x is number => x !== null);
          const avg25 = realScores.length ? (realScores.reduce((a, b) => a + b, 0) / realScores.length).toFixed(1) : null;
          return (
            <section className="essay-level">
              <h3 className="eyebrow">
                最近的成绩{avg25 !== null ? `（真实 25 分制均分 ${avg25}/25）` : "（不含发音的 20 分制与打字记录不计入 25 分制）"}
              </h3>
              <ul className="essay-history">
                {log.slice(0, 8).map((r, k) => {
                  const s25 = realScore25(r);
                  return (
                    <li key={k}>
                      <span>
                        {day(r.at)} · {SPEAKING_SUBJECTS.find((s) => s.id === r.what)?.title ?? topicOf(r.what)?.zh ?? r.what}
                      </span>
                      <span className="muted">
                        {s25 !== null ? `${s25}/25` : r.typed ? `${r.score}/${r.total} · 打字（不计入 25 分制）` : `${r.score}/20 · 不含发音 20 分制`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })()}
      </div>
    );
  }

  const topic = topicOf(subject.topic);
  const words = countWords(said);
  const turn = turns[turns.length - 1];
  const answeredTurns = turns.filter((t) => t.a.trim()).length;
  const canEndDebate = !strictMode || debate.sec >= SPEAK_TIMES.debate[0] || answeredTurns >= 6;
  const escalation = assessDebateEscalation(turns, Math.floor(debate.sec / 60), strictMode);
  const [min, max] = SPEAK_TIMES.monologue;
  /** The fifth criterion from Azure's combined monologue+debate assessment, when available; else self-assessed. */
  const azurePhono = phonoLevel(combinedPron);

  return (
    <div className="page practice">
      <section className="essay-stage">
        <header className="exam-top">
          <button className="btn btn-ghost" onClick={leave}>
            {phase === "result" ? "再抽一次" : "放弃这题"}
          </button>
          <span className="eyebrow">
            口语 · {topic?.zh}
            {strictMode ? " · 严格模考" : ""}
            {noAuxMode ? " · 脱稿无辅助" : ""}
          </span>
          {phase === "prep" && <span className={`exam-clock ${prep.sec === 0 ? "is-over" : ""}`}>{prep.sec === 0 ? "准备时间到" : `准备 ${clock(prep.sec)}`}</span>}
          {phase === "talk" && <span className={`exam-clock ${talk.sec > max ? "is-over" : talk.sec >= min ? "is-ok" : ""}`}>{clock(talk.sec)} · 目标 5–7 分钟</span>}
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
        {showHint || (prepExpired && !noAuxMode) ? (
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

        {phase === "prep" && (
          <>
            {!strictMode && !noAuxMode && (
              <div className="essay-box">
                <p className="eyebrow">1 分钟审题微训 · 提炼 problématique（核心矛盾）</p>
                <ol className="essay-check">
                  {PROBLEMATIQUE_TIPS.map((tip, k) => (
                    <li key={k}>{tip}</li>
                  ))}
                </ol>
                <div className="writing-actions">
                  <button className="btn btn-ghost" type="button" onClick={() => micro.start(60)}>
                    {micro.running ? `微训倒计时 ${clock(micro.sec)}` : micro.sec === 0 && probDraft ? "重新计时 1:00" : "开始 1 分钟提炼计时"}
                  </button>
                  {micro.running && <span className={`exam-clock ${micro.sec <= 10 ? "is-over" : ""}`}>{clock(micro.sec)}</span>}
                </div>
                <input
                  className="writing-input"
                  lang="fr"
                  value={probDraft}
                  onChange={(e) => {
                    setProbDraft(e.target.value);
                    setProbChecked(null);
                  }}
                  placeholder="试着不用原句，写出一句法语 problématique（例如：Comment concilier… ?）"
                  spellCheck={false}
                  aria-label="problématique 提炼"
                />
                <div className="writing-actions">
                  <button className="btn btn-ghost" type="button" disabled={!probDraft.trim()} onClick={() => setProbChecked(checkProblematiqueDraft(probDraft, subject.doc))}>
                    检查提炼是否合格
                  </button>
                  <button
                    className="link"
                    type="button"
                    disabled={!probDraft.trim()}
                    onClick={() => setNotes((n) => (n.trim() ? `${probDraft.trim()}\n\n${n}` : probDraft.trim()))}
                  >
                    填入准备笔记
                  </button>
                </div>
                {probChecked && (
                  <p className="muted small">
                    {probChecked.ok ? "提炼清晰：包含了开放性问题且避免直接照抄原文。" : probChecked.notes.join(" ")}
                  </p>
                )}
              </div>
            )}
            {!noAuxMode ? (
              <div className="essay-help">
                <details open>
                  <summary>怎么组织这段话</summary>
                  <ol className="essay-plan">
                    {TALK_PLAN.map((p, k) => (
                      <li key={k}>
                        <b>{p.zh}</b>
                        <span lang="fr">{p.fr}</span>
                      </li>
                    ))}
                  </ol>
                </details>
                <details>
                  <summary>评分表看什么</summary>
                  <ul className="essay-check essay-box-list">
                    {["monologue", "interaction", "lexique", "morpho", "phono"].map((c) => (
                      <li key={c}>
                        <b>{CRITERION_LABEL[c]}</b> {CRITERION_CHECK[c]}
                      </li>
                    ))}
                  </ul>
                </details>
                {topic && (
                  <details>
                    <summary>话题词汇：{topic.zh}</summary>
                    <ul className="essay-phrases">
                      {topic.vocab.map(([fr, zh], k) => (
                        <li key={k}>
                          <span lang="fr">{fr}</span>
                          <small>{zh}</small>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <details>
                  <summary>衔接语</summary>
                  <dl className="essay-links">
                    {CONNECTORS.map((g) => (
                      <div key={g.zh}>
                        <dt>{g.zh}</dt>
                        <dd lang="fr">{g.fr.join(" · ")}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              </div>
            ) : (
              <p className="muted small">脱稿无辅助模式已开启：准备期已隐藏模板、评分提示、话题词汇与衔接语，发言期仅保留关键词提纲。</p>
            )}
            <textarea className="writing-input essay-notes" lang="fr" rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="准备时记关键词和提纲（考试时可以看笔记，但不能念稿）" spellCheck={false} aria-label="准备笔记" />
            <div className="writing-actions">
              <button className="btn btn-primary btn-xl" onClick={() => void startTalk()}>
                <Mic size={18} /> 准备好了，开始说
              </button>
            </div>
          </>
        )}

        {phase === "talk" && (
          <>
            {notes.trim() && (
              noAuxMode ? (
                <div className="essay-box">
                  <p className="eyebrow">关键词提纲（脱稿模式，已隐藏完整笔记）</p>
                  <ul className="essay-check">
                    {noteCues.map((cue, k) => (
                      <li key={k} lang="fr">
                        {cue}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="essay-box">
                  <p className="eyebrow">你的笔记</p>
                  <p className="essay-text">{notes}</p>
                </div>
              )
            )}
            {dictation ? (
              <div className={`exam-live ${listening ? "is-on" : ""}`} aria-live="polite">
                <p className="eyebrow">{listening ? "正在听……" : "识别已停止"}</p>
                <p className="essay-text" lang="fr">
                  {said}
                  <i>{interim}</i>
                  {!said && !interim && <span className="muted">开口说法语，这里会出现文字。</span>}
                </p>
              </div>
            ) : (
              <p className="muted">对着计时说 5–7 分钟，说完点下面的按钮，再把说的内容打出来。</p>
            )}
            <div className="writing-actions">
              <span className="essay-count">{words} 词</span>
              {recorder.on && (
                <span className="muted small">
                  <i className="rec-dot" aria-hidden="true" />
                  录音中
                </span>
              )}
              <button className="btn btn-primary btn-xl" onClick={() => void endTalk()}>
                <Square size={16} /> 说完了
              </button>
            </div>
          </>
        )}

        {phase === "review" && (() => {
          const monoLocked = noAuxMode && (gradedLock || !!rawMonologue.trim());
          return (
            <>
              <p className="muted">
                {spoke > 0 ? `说了 ${clock(spoke)}。` : ""}
                {monoLocked
                  ? "脱稿无辅助模式已锁定原始语音转写：禁止在评审前修改独白原文后重评。"
                  : dictation
                    ? "识别难免有错：把听错的词改回你实际说的话，但不要趁机改语法，否则批改就不准了。"
                    : "请把刚才说的独白内容完整打出来，供 AI 批改与辩论追问。"}
              </p>
              <TakePlayer take={talkTake} label="听自己的独白" />
              {talkTake && (pron.available ? <AssessStatus a={pron} /> : <AssessHint />)}
              {pron.state === "done" && pron.result && <PronReport result={pron.result} />}
              <textarea
                className="writing-input essay-input"
                lang="fr"
                rows={10}
                maxLength={MAX_SPEAKING_MONOLOGUE_LENGTH}
                value={said}
                readOnly={monoLocked}
                onChange={(e) => {
                  if (!monoLocked) setSaid(e.target.value.slice(0, MAX_SPEAKING_MONOLOGUE_LENGTH));
                }}
                placeholder="你说的内容"
                spellCheck={false}
                aria-label="你说的内容"
              />
              <div className="writing-actions">
                <span className={`essay-count ${words >= 450 ? "is-ok" : ""}`}>
                  {words} 词 · 5 分钟大约 450 词以上
                  {said.length >= MAX_SPEAKING_MONOLOGUE_LENGTH ? ` · 已达 ${MAX_SPEAKING_MONOLOGUE_LENGTH} 字符上限` : ""}
                </span>
                {hasAi ? (
                  <>
                    {!strictMode && !noAuxMode ? (
                      <button className="btn btn-ghost" onClick={() => void assess([])} disabled={!said.trim() || gradedLock}>
                        跳过辩论，直接批改
                      </button>
                    ) : (
                      <span className="muted small">{strictMode ? "严格模考中不可跳过辩论" : "脱稿无辅助模式中请完整完成辩论"}</span>
                    )}
                    <button className="btn btn-primary btn-xl" onClick={startDebate} disabled={!said.trim()}>
                      进入辩论 <ArrowRight size={18} />
                    </button>
                  </>
                ) : (
                  <span className="muted">没有设置 AI 接口，没有辩论和批改。对照准备时的评分要点自己检查。</span>
                )}
              </div>
            </>
          );
        })()}

        {phase === "debate" && (
          <>
            <ol className="exam-debate">
              {turns.slice(0, -1).map((t, k) => (
                <li key={k}>
                  <p className="exam-q" lang="fr">
                    {t.q}
                  </p>
                  <p className="essay-text" lang="fr">
                    {t.a || "（没有回答）"}
                  </p>
                  <TakePlayer take={turnTakes[k]} label={`听第 ${k + 1} 轮回答`} />
                </li>
              ))}
            </ol>
            {asking && <p className="muted">考官在想下一个问题…</p>}
            {!asking && turns.length === 0 && (
              <div className="essay-box">
                <p className="eyebrow">考官提问暂未成功</p>
                <p className="muted small">{askError || "考官第 1 问请求失败，你可以重试提问或跳过辩论直接批改独白。"}</p>
                <div className="writing-actions">
                  <button className="btn btn-primary" onClick={() => void ask([])}>
                    重试提问
                  </button>
                  <button className="btn btn-ghost" disabled={!said.trim() || gradedLock} onClick={() => void assess([])}>
                    跳过辩论，直接批改独白
                  </button>
                </div>
              </div>
            )}
            {turn && !asking && (() => {
              const turnIdx = turns.length - 1;
              const curTake = turnTakes[turnIdx];
              const azureOn = canAssess();
              const turnLocked = noAuxMode && (gradedLock || !!rawTurns[turnIdx]?.trim());
              return (
                <div className={`exam-live ${listening || recorder.on ? "is-on" : ""}`} aria-live="polite">
                  <p className="eyebrow">
                    考官 {((Math.max(0, turnIdx) + voiceOffset) % 2) + 1} 问
                    {escalation.level >= 2 ? ` · 追问升级 L${escalation.level}` : ""}
                  </p>
                  <p className="exam-q" lang="fr">
                    {turn.q}
                  </p>
                  {(!dictation || speechFailed) && (
                    <p className="muted small">
                      {azureOn
                        ? "当前使用麦克风录音 + Azure 语音自动转写；停止录音后将自动填入文字。"
                        : "当前浏览器离线或不支持语音识别：已启用本地录音兜底，停止后可回放录音并对照补全文字。"}
                    </p>
                  )}
                  <textarea className="writing-input essay-notes" lang="fr" rows={4} value={turn.a + (listening ? interim : "")} readOnly={listening || transcribing || turnLocked} onChange={(e) => setAnswer(e.target.value)} placeholder={dictation && !speechFailed ? "点「开口回答」，或直接打字" : recorder.supported ? "用麦克风录音回答，或直接打字" : "把你的回答打出来"} spellCheck={false} aria-label="你的回答" />
                  {turnLocked && <p className="muted small">脱稿无辅助模式已锁定本轮原始语音转写。</p>}
                  {transcribing && <p className="muted small">Azure 语音转写中…</p>}
                  {turnProns[turnIdx] && <p className="muted small">已通过 Azure 转写本轮回答（可用于发音综合评测）。</p>}
                  <TakePlayer take={curTake} label="听这一轮录音" />
                  {askError && <p className="warn-text">{askError}</p>}
                  <div className="writing-actions">
                    <button
                      className="link"
                      onClick={() => {
                        void stopDebateAnswer(turnIdx);
                        quiet();
                        void speakExaminer(turn.q, Math.max(0, turnIdx), voiceOffset, ai);
                      }}
                    >
                      再听一遍问题
                    </button>
                    {(listening || recorder.on) ? (
                      <>
                        <span className="muted small">
                          <i className="rec-dot" aria-hidden="true" />
                          {listening ? "正在听写并录音" : "录音中"}
                        </span>
                        <button className="btn btn-ghost" onClick={() => void stopDebateAnswer(turnIdx)} disabled={transcribing}>
                          <Square size={15} /> {azureOn && (!dictation || speechFailed) ? "停止并转写" : "停止录音"}
                        </button>
                      </>
                    ) : (
                      (dictation || recorder.supported) && (
                        <button
                          className="btn btn-ghost"
                          disabled={transcribing}
                          onClick={() => void beginDebateAnswer(turnIdx, turn.a)}
                        >
                          <Mic size={16} /> {turn.a ? "接着说" : !dictation || speechFailed ? "录音回答" : "开口回答"}
                        </button>
                      )
                    )}
                    {debate.sec < SPEAK_TIMES.debate[1] && turns.length < MAX_TURNS ? (
                      <button
                        className="btn btn-primary"
                        disabled={transcribing || (!turn.a.trim() && !interim && !recorder.on)}
                        onClick={async () => {
                          const latest = await stopDebateAnswer(turnIdx);
                          quiet();
                          const ans = latest[turnIdx]?.a;
                          if (noAuxMode && ans?.trim() && !rawTurnsRef.current[turnIdx]?.trim()) {
                            const nextRaw = { ...rawTurnsRef.current, [turnIdx]: ans };
                            rawTurnsRef.current = nextRaw;
                            setRawTurns(nextRaw);
                          }
                          if (ans?.trim()) void ask(latest);
                        }}
                      >
                        答完了，下一个问题 <ArrowRight size={16} />
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary"
                        disabled={transcribing || gradedLock}
                        onClick={async () => {
                          const latest = await stopDebateAnswer(turnIdx);
                          void assess(latest);
                        }}
                      >
                        时间到，结束辩论并批改 <ArrowRight size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
            {!asking && turns.length > 0 && debate.sec < SPEAK_TIMES.debate[1] && (
              <div className="writing-actions">
                <span className="muted small">
                  {!canEndDebate
                    ? `严格模考：需满 10:00 或完成至少 6 轮有效回答才可交卷（已答 ${answeredTurns}/6 轮）`
                    : debate.sec < SPEAK_TIMES.debate[0]
                      ? "考官会一直追问到你结束为止；考试里这一段有 10–13 分钟，尽量撑到 10 分钟。"
                      : "已经到 10 分钟，可以结束了。"}
                </span>
                <button
                  className="link"
                  disabled={!canEndDebate || transcribing || gradedLock}
                  onClick={async () => {
                    const latest = await stopDebateAnswer(turns.length - 1);
                    void assess(latest);
                  }}
                >
                  结束辩论，批改
                </button>
              </div>
            )}
            {!strictMode && !noAuxMode ? (
              <details className="essay-fold">
                <summary>辩论话术速查（反驳 / 让步 / 澄清 / 填充语，{debatePhraseGroups.reduce((n, [, xs]) => n + xs.length, 0)} 句）</summary>
                {debatePhraseGroups.map(([fn, xs]) => (
                  <div key={fn} className="essay-box">
                    <p className="eyebrow">{fn}</p>
                    <ul className="essay-phrases">
                      {xs.map((e) => (
                        <li key={e.id}>
                          <span lang="fr">{e.fr}</span>
                          <small>{e.zh}</small>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </details>
            ) : (
              <p className="muted small">{strictMode ? "严格模考中已隐藏辩论话术速查。" : "脱稿无辅助模式中已隐藏辩论话术速查。"}</p>
            )}
          </>
        )}

        {phase === "grading" && (
          <div className="writing-actions">
            <p className="muted">AI 批改中（约 20–60 秒）…</p>
            <button
              className="btn btn-ghost"
              onClick={() => {
                ctrl.current?.abort();
                setPhase(turns.length ? "debate" : "review");
              }}
            >
              取消
            </button>
          </div>
        )}

        {phase === "result" && fb && (
          <>
            <Marking fb={fb} pointTitle={pointTitle} from={`口语 · ${subject.title}`} extra={{ key: "phono", score: azurePhono ?? phono }} />
            {(azurePhono ?? phono) === null && (
              <p className="muted small">
                当前为「不含发音 20 分制」（未按比例折算 25 分，也不会混入 25 分制曲线）；完成下方第 5 项发音自评后计入 25 分总分。
              </p>
            )}
            {gradedTyped && <p className="muted small">本次练习含纯键盘输入，已标记为「打字」，不计入 25 分口语成绩曲线。</p>}
            {combinedPron && (
              <PronReport
                result={combinedPron}
                title={
                  Object.keys(turnProns).length
                    ? `发音和语调（第五项，独白 + 辩论 ${Object.keys(turnProns).length} 轮抽样加权）`
                    : "发音和语调（第五项，Azure 评测）"
                }
              />
            )}
            {azurePhono === null && (
              <div className="essay-box">
                <p className="eyebrow">发音和语调：自己评（第五项，AI 听不到）</p>
                <p className="muted small">{CRITERION_CHECK.phono} 官方标准：低于 B2 是「大体听得懂，语调和重音还有不自然」；B2 是「语调、重音、发音清楚，偶尔的问题不影响交流」；B2+ 是「能变化语调来表达意思，能自己纠正」。</p>
                <div className="segmented">
                  {LEVELS.map((v) => (
                    <button key={v} className={phono === v ? "is-on" : ""} onClick={() => selectPhono(v)} aria-pressed={phono === v}>
                      {v} · {LEVEL_LABEL[v]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <TakePlayer take={talkTake} label="听自己的独白" />
            {turns.some((t) => t.a.trim()) && (
              <div className="essay-box">
                <p className="eyebrow">辩论</p>
                <ol className="exam-debate">
                  {turns.map((t, k) => (
                    <li key={k}>
                      <p className="exam-q" lang="fr">
                        {t.q}
                      </p>
                      <p className="essay-text" lang="fr">
                        {t.a || "（没有回答）"}
                      </p>
                      <TakePlayer take={turnTakes[k]} label={`听第 ${k + 1} 轮回答`} />
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <div className="essay-cols">
              <div className="essay-box">
                <p className="eyebrow">你的独白（{words} 词）</p>
                <p className="essay-text" lang="fr">
                  {said}
                </p>
              </div>
              {fb.rewrite && (
                <div className="essay-box">
                  <p className="eyebrow">可以这样说</p>
                  <p className="essay-text" lang="fr">
                    {fb.rewrite}
                  </p>
                </div>
              )}
            </div>
            <p className="muted small">AI 只看文字，它的分数可能有偏差；真正的考试由两位考官现场评分。</p>
            <div className="writing-actions">
              <button className="btn btn-primary" onClick={() => choose(subject)}>
                同一题再说一遍
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
