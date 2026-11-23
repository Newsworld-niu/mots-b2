import { ArrowLeft, ArrowRight, Check, Mic, RefreshCw, Shuffle, Square, Volume2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { transcribeAudio } from "../../ai/clients";
import { ready, useAiConfig } from "../../ai/config";
import { assessRecording, canAssessOrTranscribe, oralCapabilityTier } from "../../ai/pronunciation";
import {
  gradeTrackSpeaking,
  interlocutorReply,
  type InterlocutorRoleMode,
  type InterlocutorTurn,
  type TrackSpeakingGradeResult,
} from "../../ai/tasks/speaking-tracks";
import { useGrammar } from "../../atlas/grammar";
import { stopAudio } from "../../lib/audio";
import { clock } from "../../lib/exam";
import {
  scoreTcfProductive20,
  scoreTefSection699,
  TRACK_META,
  type ExamTrack,
} from "../../lib/exam-tracks";
import { useNavGuard } from "../../lib/nav-guard";
import {
  combineSpeakingProns,
  phonoLevel,
  summarizeAcoustics,
  type PronResult,
} from "../../lib/pronunciation";
import type { Take } from "../../lib/recorder";
import { href } from "../../lib/router";
import {
  analyzeCandidateQuestions,
  analyzeRegisterConsistency,
  QUESTION_STRUCTURE_LABEL,
  TCF_SPEAKING_SUITES,
  TEF_SPEAKING_SUITES,
  type TcfSpeakingSuite,
  type TefSpeakingSuite,
} from "../../lib/speaking-tracks";
import { canDictate, dictate } from "../../lib/speech";
import { useTimer } from "../../lib/timer";
import { ERROR_LABEL } from "../../lib/writing";
import { logExam, saveNote, saveSpeakingCorrections } from "../../store/essays";
import { useStore } from "../../store/store";
import { AccentKeys } from "../../ui/AccentKeys";
import { confirmAction } from "../../ui/ConfirmSheet";
import {
  AssessedTranscript,
  PronReport,
  TakePlayer,
  useRecorder,
  useSilenceVad,
} from "../../ui/Recording";
import { toast } from "../../ui/Toast";
import { day, speakExaminer, VAD_SILENCE_MS } from "./helpers";

type StudioStage =
  | "pick"
  | "tcf_t1"
  | "tcf_t2_prep"
  | "tcf_t2_run"
  | "tcf_t3"
  | "tef_a_prep"
  | "tef_a_run"
  | "tef_b_prep"
  | "tef_b_run"
  | "grading"
  | "result";

interface RecordedExchange {
  speaker: "interlocutor" | "candidate";
  text: string;
  take?: Take;
  pron?: PronResult;
}

const SELF_LEVELS = [0, 1, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

function ExchangeRow({ item, idx }: { item: RecordedExchange; idx: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  return (
    <li>
      <p className={item.speaker === "interlocutor" ? "exam-q" : "essay-text"} lang="fr">
        <b>{item.speaker === "interlocutor" ? "考官 / 对话方：" : "你："}</b>{" "}
        {item.pron && item.pron.words.length > 0 ? null : item.text}
      </p>
      {item.speaker === "candidate" && item.pron && item.pron.words.length > 0 && (
        <AssessedTranscript result={item.pron} audioRef={item.take ? audioRef : undefined} compact />
      )}
      {item.take && <TakePlayer take={item.take} label={`回放第 ${idx + 1} 段录音`} audioRef={audioRef} />}
    </li>
  );
}

export function TrackSpeakingStudio({
  track,
  onSwitchTrack,
  onExit,
}: {
  track: "tcf" | "tef";
  onSwitchTrack: (next: ExamTrack) => void;
  onExit: () => void;
}) {
  const ai = useAiConfig();
  const { data: grammar } = useGrammar();
  const examLog = useStore((s) => s.progress.examLog);
  const keptNotes = useStore((s) => s.progress.essayNotes);

  const trackLogs = useMemo(
    () => (examLog ?? []).filter((r) => r.part === "speak" && r.track === track),
    [examLog, track],
  );
  const pointTitle = useMemo(
    () => new Map((grammar?.points ?? []).map((p) => [p.id, p.title])),
    [grammar],
  );
  const grammarPoints = useMemo(
    () => (grammar?.points ?? []).map((p) => ({ id: p.id, title: p.title })),
    [grammar],
  );

  const oralTier = oralCapabilityTier(ai);
  const hasAi = ready.text(ai);
  const dictation = canDictate();
  const recorder = useRecorder();
  const timer = useTimer();

  const [stage, setStage] = useState<StudioStage>("pick");
  const [tcfSuite, setTcfSuite] = useState<TcfSpeakingSuite>(TCF_SPEAKING_SUITES[0]);
  const [tefSuite, setTefSuite] = useState<TefSpeakingSuite>(TEF_SPEAKING_SUITES[0]);
  const [vadAutoEnd, setVadAutoEnd] = useState(false);

  const [prepNotes, setPrepNotes] = useState("");
  const [draftInput, setDraftInput] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [busyTurn, setBusyTurn] = useState(false);
  const [voiceUsed, setVoiceUsed] = useState(false);
  const [voiceOffset] = useState(() => Math.floor(Math.random() * 10));

  // Per-section exchanges
  const [tcfT1List, setTcfT1List] = useState<RecordedExchange[]>([]);
  const [tcfT2List, setTcfT2List] = useState<RecordedExchange[]>([]);
  const [tcfT3List, setTcfT3List] = useState<RecordedExchange[]>([]);
  const [tefAList, setTefAList] = useState<RecordedExchange[]>([]);
  const [tefBList, setTefBList] = useState<RecordedExchange[]>([]);

  const [gradeRes, setGradeRes] = useState<TrackSpeakingGradeResult | null>(null);
  const [selfScores, setSelfScores] = useState<Record<string, number>>({});
  const [selfSaved, setSelfSaved] = useState(false);

  const draftRef = useRef("");
  draftRef.current = draftInput;
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const stopDictateRef = useRef<(() => void) | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  const autoPromptedExpiryRef = useRef<string | null>(null);

  const inActiveRun = stage !== "pick" && stage !== "result";
  useNavGuard(inActiveRun, "口语模考正在进行中，离开将丢失当前录音与对话记录，确定离开？");

  const stopAllCapture = () => {
    stopDictateRef.current?.();
    stopDictateRef.current = null;
    setListening(false);
    setInterim("");
    stopAudio();
  };

  useEffect(() => {
    setStage("pick");
    timer.stop();
    stopAllCapture();
    void recorder.stop();
    ctrlRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track]);

  useEffect(
    () => () => {
      stopAllCapture();
      void recorder.stop();
      ctrlRef.current?.abort();
      timer.stop();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (!inActiveRun || timer.running || !timer.down || timer.sec > 0) return;
    if (autoPromptedExpiryRef.current === stage) return;
    autoPromptedExpiryRef.current = stage;
    toast("本阶段官方计时已到，请进入下一阶段或交卷。", "info");
  }, [inActiveRun, stage, timer.down, timer.running, timer.sec]);

  const activeList = useMemo<RecordedExchange[]>(() => {
    if (stage === "tcf_t1") return tcfT1List;
    if (stage === "tcf_t2_run") return tcfT2List;
    if (stage === "tcf_t3") return tcfT3List;
    if (stage === "tef_a_run") return tefAList;
    if (stage === "tef_b_run") return tefBList;
    return [];
  }, [stage, tcfT1List, tcfT2List, tcfT3List, tefAList, tefBList]);

  const setActiveList = (updater: (prev: RecordedExchange[]) => RecordedExchange[]) => {
    if (stage === "tcf_t1") setTcfT1List(updater);
    else if (stage === "tcf_t2_run") setTcfT2List(updater);
    else if (stage === "tcf_t3") setTcfT3List(updater);
    else if (stage === "tef_a_run") setTefAList(updater);
    else if (stage === "tef_b_run") setTefBList(updater);
  };

  // Live deterministic analyzers
  const activeCandidateTexts = useMemo(() => {
    const committed = activeList.filter((x) => x.speaker === "candidate").map((x) => x.text);
    const live = `${draftInput} ${interim}`.trim();
    return live ? [...committed, live] : committed;
  }, [activeList, draftInput, interim]);

  const liveQuestionStats = useMemo(
    () => analyzeCandidateQuestions(activeCandidateTexts),
    [activeCandidateTexts],
  );

  const liveFormalRegister = useMemo(
    () => analyzeRegisterConsistency(activeCandidateTexts.join("\n"), "vous"),
    [activeCandidateTexts],
  );

  const liveInformalRegister = useMemo(
    () => analyzeRegisterConsistency(activeCandidateTexts.join("\n"), "tu"),
    [activeCandidateTexts],
  );

  const allProns = useMemo(() => {
    const all = [...tcfT1List, ...tcfT2List, ...tcfT3List, ...tefAList, ...tefBList]
      .map((x) => x.pron)
      .filter((p): p is PronResult => !!p);
    return combineSpeakingProns(all[0] ?? null, all.slice(1));
  }, [tcfT1List, tcfT2List, tcfT3List, tefAList, tefBList]);

  const resetSessionState = () => {
    stopAllCapture();
    ctrlRef.current?.abort();
    setPrepNotes("");
    setDraftInput("");
    draftRef.current = "";
    setVoiceUsed(false);
    setBusyTurn(false);
    setTcfT1List([]);
    setTcfT2List([]);
    setTcfT3List([]);
    setTefAList([]);
    setTefBList([]);
    setGradeRes(null);
    setSelfScores({});
    setSelfSaved(false);
    autoPromptedExpiryRef.current = null;
  };

  const speakOpeningLine = (lineFr: string, turnIdx = 0) => {
    const c = new AbortController();
    ctrlRef.current = c;
    void speakExaminer(lineFr, turnIdx, voiceOffset, ai, c.signal).catch(() => "stopped");
  };

  const beginTcfSuite = (suite: TcfSpeakingSuite) => {
    resetSessionState();
    setTcfSuite(suite);
    setTcfT1List([{ speaker: "interlocutor", text: suite.tache1.promptFr }]);
    setStage("tcf_t1");
    timer.start(suite.tache1.speakSec);
    speakOpeningLine(suite.tache1.promptFr, 0);
  };

  const enterTcfT2Prep = async () => {
    stopAllCapture();
    if (recorder.on) await recorder.stop();
    setDraftInput("");
    autoPromptedExpiryRef.current = null;
    setStage("tcf_t2_prep");
    timer.start(tcfSuite.tache2.prepSec);
  };

  const enterTcfT2Run = () => {
    stopAllCapture();
    setDraftInput("");
    autoPromptedExpiryRef.current = null;
    const greeting = tcfSuite.tache2.offlineRepliesFr[0] ?? "Bonjour, que puis-je faire pour vous renseigner ?";
    setTcfT2List([{ speaker: "interlocutor", text: greeting }]);
    setStage("tcf_t2_run");
    timer.start(tcfSuite.tache2.speakSec);
    speakOpeningLine(greeting, 1);
  };

  const enterTcfT3 = async () => {
    stopAllCapture();
    if (recorder.on) await recorder.stop();
    setDraftInput("");
    autoPromptedExpiryRef.current = null;
    setTcfT3List([{ speaker: "interlocutor", text: tcfSuite.tache3.questionFr }]);
    setStage("tcf_t3");
    timer.start(tcfSuite.tache3.speakSec);
    speakOpeningLine(tcfSuite.tache3.questionFr, 2);
  };

  const beginTefSuite = (suite: TefSpeakingSuite) => {
    resetSessionState();
    setTefSuite(suite);
    setStage("tef_a_prep");
    timer.start(suite.sectionA.prepSec);
  };

  const enterTefARun = () => {
    stopAllCapture();
    setDraftInput("");
    autoPromptedExpiryRef.current = null;
    const greeting = tefSuite.sectionA.offlineRepliesFr[0] ?? "Allô bonjour, je vous écoute !";
    setTefAList([{ speaker: "interlocutor", text: greeting }]);
    setStage("tef_a_run");
    timer.start(tefSuite.sectionA.speakSec);
    speakOpeningLine(greeting, 0);
  };

  const enterTefBPrep = async () => {
    stopAllCapture();
    if (recorder.on) await recorder.stop();
    setDraftInput("");
    autoPromptedExpiryRef.current = null;
    setStage("tef_b_prep");
    timer.start(tefSuite.sectionB.prepSec);
  };

  const enterTefBRun = () => {
    stopAllCapture();
    setDraftInput("");
    autoPromptedExpiryRef.current = null;
    const friendHello = `Allô ? Oui, salut ! Qu'est-ce que tu deviens, tu voulais me proposer quelque chose ?`;
    setTefBList([{ speaker: "interlocutor", text: friendHello }]);
    setStage("tef_b_run");
    timer.start(tefSuite.sectionB.speakSec);
    speakOpeningLine(friendHello, 1);
  };

  const startVoiceTurn = async () => {
    stopAudio();
    const base = draftRef.current.trim();
    if (recorder.supported && !recorder.on) {
      await recorder.start();
    }
    if (dictation && !listening) {
      setListening(true);
      stopDictateRef.current = dictate(
        (finalText, guess) => {
          if (finalText.trim()) setVoiceUsed(true);
          const merged = (base ? `${base} ` : "") + finalText;
          draftRef.current = merged;
          setDraftInput(merged);
          setInterim(guess);
        },
        () => {
          setListening(false);
          setInterim("");
        },
      );
    }
  };

  const commitTurnAndReply = async () => {
    if (busyTurn) return;
    stopAllCapture();
    setBusyTurn(true);

    try {
      const take = recorder.on ? await recorder.stop() : null;
      let resolvedText = draftRef.current.trim();
      let pronRes: PronResult | undefined;

      if (take) {
        setVoiceUsed(true);
        if (canAssessOrTranscribe(ai)) {
          try {
            const pr = await assessRecording(take.blob);
            if (pr) {
              pronRes = pr;
              const neural = (pr.lexicalText || pr.text || "").trim();
              if (neural) resolvedText = neural;
            }
          } catch (err) {
            if (!resolvedText && ready.stt(ai)) {
              try {
                const fallbackTxt = await transcribeAudio(take.blob);
                if (fallbackTxt.trim()) resolvedText = fallbackTxt.trim();
              } catch {
                /* handled below */
              }
            }
            if (!resolvedText) {
              toast((err as Error).message || "语音转写失败，可在文本框补充刚才所说内容", "warn");
            }
          }
        }
      }

      if (!resolvedText && !take) {
        toast("请先开口录音或输入本轮法语发言", "warn");
        return;
      }
      const finalCandidateText = resolvedText || "（已完成语音回答，未配置语音转写接口）";
      const candidateEntry: RecordedExchange = {
        speaker: "candidate",
        text: finalCandidateText,
        ...(take ? { take } : {}),
        ...(pronRes ? { pron: pronRes } : {}),
      };

      const updatedHistory = [...activeList, candidateEntry];
      setActiveList(() => updatedHistory);
      setDraftInput("");
      draftRef.current = "";

      // Generate interlocutor follow-up / answer / objection
      const candCount = updatedHistory.filter((x) => x.speaker === "candidate").length;
      let nextInterlocutorLine = "";

      if (hasAi) {
        const c = new AbortController();
        ctrlRef.current = c;
        let roleMode: InterlocutorRoleMode = "tcf_t1";
        let roleDesc = "Examinateur TCF";
        let scenario = "";
        let hiddenFacts: readonly string[] | undefined;
        let objections: readonly string[] | undefined;

        if (stage === "tcf_t1") {
          roleMode = "tcf_t1";
          scenario = tcfSuite.tache1.promptFr;
        } else if (stage === "tcf_t2_run") {
          roleMode = "tcf_t2";
          roleDesc = tcfSuite.tache2.examinerRoleFr;
          scenario = tcfSuite.tache2.cardFr;
          hiddenFacts = tcfSuite.tache2.hiddenFactsFr;
        } else if (stage === "tcf_t3") {
          roleMode = "tcf_t3";
          scenario = tcfSuite.tache3.questionFr;
        } else if (stage === "tef_a_run") {
          roleMode = "tef_a";
          roleDesc = tefSuite.sectionA.examinerRoleFr;
          scenario = `${tefSuite.adHeadlineFr}\n${tefSuite.adBodyFr}`;
          hiddenFacts = tefSuite.sectionA.hiddenFactsFr;
        } else if (stage === "tef_b_run") {
          roleMode = "tef_b";
          roleDesc = `${tefSuite.sectionB.friendNameFr} — ${tefSuite.sectionB.friendPersonaFr}`;
          scenario = `${tefSuite.adHeadlineFr}\n${tefSuite.adBodyFr}`;
          objections = tefSuite.sectionB.objectionsFr;
        }

        try {
          const turnsPayload: InterlocutorTurn[] = updatedHistory.map((h) => ({
            speaker: h.speaker,
            text: h.text,
          }));
          const rep = await interlocutorReply(
            {
              mode: roleMode,
              roleDescriptionFr: roleDesc,
              scenarioFr: scenario,
              hiddenFactsFr: hiddenFacts,
              objectionsFr: objections,
              turns: turnsPayload,
            },
            c.signal,
          );
          if (!c.signal.aborted) {
            nextInterlocutorLine = rep.reply;
          }
        } catch (err) {
          toast((err as Error).message || "AI 对话角色暂时未响应，已切换内置应答", "warn");
        }
      }

      if (!nextInterlocutorLine) {
        if (stage === "tcf_t1") {
          nextInterlocutorLine = tcfSuite.tache1.followUpsFr[candCount - 1] ?? "";
        } else if (stage === "tcf_t2_run") {
          nextInterlocutorLine =
            tcfSuite.tache2.offlineRepliesFr[Math.min(candCount, tcfSuite.tache2.offlineRepliesFr.length - 1)] ?? "";
        } else if (stage === "tcf_t3") {
          nextInterlocutorLine = tcfSuite.tache3.followUpsFr[candCount - 1] ?? "";
        } else if (stage === "tef_a_run") {
          nextInterlocutorLine =
            tefSuite.sectionA.offlineRepliesFr[Math.min(candCount, tefSuite.sectionA.offlineRepliesFr.length - 1)] ?? "";
        } else if (stage === "tef_b_run") {
          nextInterlocutorLine =
            tefSuite.sectionB.objectionsFr[candCount - 1] ??
            "Bon, écoute, vu comme tu me présentes ça, je veux bien tenter un essai avec toi la semaine prochaine !";
        }
      }

      if (nextInterlocutorLine) {
        setActiveList((prev) => [...prev, { speaker: "interlocutor", text: nextInterlocutorLine }]);
        speakOpeningLine(nextInterlocutorLine, updatedHistory.length);
      }
    } finally {
      setBusyTurn(false);
    }
  };

  useSilenceVad({
    enabled:
      vadAutoEnd &&
      (stage === "tcf_t1" ||
        stage === "tcf_t2_run" ||
        stage === "tcf_t3" ||
        stage === "tef_a_run" ||
        stage === "tef_b_run"),
    active: !busyTurn && (recorder.on || listening),
    speechText: `${draftInput} ${interim}`.trim(),
    silenceMs: VAD_SILENCE_MS,
    onSilence: () => {
      void commitTurnAndReply();
    },
  });

  const submitExamForGrading = async () => {
    stopAllCapture();
    timer.stop();
    if (recorder.on) {
      await commitTurnAndReply();
    } else if (draftRef.current.trim()) {
      await commitTurnAndReply();
    }

    if (!hasAi) {
      setStage("result");
      return;
    }

    const c = new AbortController();
    ctrlRef.current = c;
    setStage("grading");

    try {
      const acoustics = summarizeAcoustics(allProns) ?? undefined;
      const phonoScore5 = phonoLevel(allProns);
      const isTyped = !voiceUsed;

      let res: TrackSpeakingGradeResult;
      if (track === "tcf") {
        const t1Text = tcfT1List
          .filter((x) => x.speaker === "candidate")
          .map((x) => x.text)
          .join("\n");
        const t2Turns: InterlocutorTurn[] = tcfT2List.map((x) => ({
          speaker: x.speaker,
          text: x.text,
        }));
        const t3Text = tcfT3List
          .filter((x) => x.speaker === "candidate")
          .map((x) => x.text)
          .join("\n");

        res = await gradeTrackSpeaking(
          {
            track: "tcf",
            suite: tcfSuite,
            t1Transcript: t1Text,
            t2Turns,
            t3Transcript: t3Text,
            typed: isTyped,
            points: grammarPoints,
            acoustics,
            phonoScore5,
          },
          c.signal,
        );
        if (c.signal.aborted) return;
        if (res.corrections.length) saveSpeakingCorrections(tcfSuite.title, res.corrections);
        logExam({
          part: "speak",
          what: tcfSuite.id,
          score: res.scaledScore,
          total: 20,
          ...(isTyped ? { typed: true } : {}),
          level: "B2",
          scope: "full",
          track: "tcf",
          trackSection: "eo",
          nclc: res.nclc,
        });
      } else {
        const secATurns: InterlocutorTurn[] = tefAList.map((x) => ({
          speaker: x.speaker,
          text: x.text,
        }));
        const secBTurns: InterlocutorTurn[] = tefBList.map((x) => ({
          speaker: x.speaker,
          text: x.text,
        }));
        res = await gradeTrackSpeaking(
          {
            track: "tef",
            suite: tefSuite,
            secATurns,
            secBTurns,
            typed: isTyped,
            points: grammarPoints,
            acoustics,
            phonoScore5,
          },
          c.signal,
        );
        if (c.signal.aborted) return;
        if (res.corrections.length) saveSpeakingCorrections(tefSuite.title, res.corrections);
        logExam({
          part: "speak",
          what: tefSuite.id,
          score: res.scaledScore,
          total: 699,
          scaledScore: res.scaledScore,
          ...(isTyped ? { typed: true } : {}),
          level: "B2",
          scope: "full",
          track: "tef",
          trackSection: "eo",
          nclc: res.nclc,
        });
      }

      setGradeRes(res);
      setStage("result");
    } catch (err) {
      if (c.signal.aborted) return;
      toast((err as Error).message || "口语批改失败，请重试", "warn");
      setStage(track === "tcf" ? "tcf_t3" : "tef_b_run");
    }
  };

  const confirmLeaveToPicker = async () => {
    if (inActiveRun) {
      const ok = await confirmAction({
        title: "放弃本次口语模考？",
        message: "当前录音与问答记录尚未评分保存，确定返回题库？",
        confirmLabel: "确定放弃",
        danger: true,
      });
      if (!ok) return;
    }
    resetSessionState();
    timer.stop();
    if (recorder.on) await recorder.stop();
    setStage("pick");
  };

  const renderTrackSwitcher = () => (
    <div className="segmented" role="group" aria-label="切换口语考试体系">
      {(["delf", "tcf", "tef"] as const).map((t) => (
        <button
          key={t}
          type="button"
          className={track === t ? "is-on" : ""}
          aria-pressed={track === t}
          disabled={inActiveRun}
          onClick={() => onSwitchTrack(t)}
        >
          {t === "delf" ? "DELF B2" : t === "tcf" ? "TCF EO（12m · /20）" : "TEF EO（15m · /699）"}
        </button>
      ))}
    </div>
  );

  const renderTierBanner = () => (
    <div className={oralTier.tier === 1 ? "essay-box" : "speak-mode-banner"} role="note">
      <p>
        <b>{oralTier.label}：</b>
        {oralTier.detail}
      </p>
      {oralTier.tier !== 1 && (
        <p className="small">
          前往 <a className="link" href={href({ page: "me" })}>我的 → AI 接口</a> 即可配置语音服务（100% 本地直连 BYOK，不经过任何同步中转）。
        </p>
      )}
    </div>
  );

  /* ---------- Stage: Suite Picker ---------- */
  if (stage === "pick") {
    return (
      <div className="page practice">
        <header className="page-head">
          <button className="link deck-back" onClick={onExit}>
            <ArrowLeft size={16} /> 返回练习
          </button>
          <div className="writing-actions">{renderTrackSwitcher()}</div>
          <p className="eyebrow">
            {TRACK_META[track].shortName} · Expression orale · {TRACK_META[track].badge}
          </p>
          <h1 className="display">
            {track === "tcf" ? "三段递进，十二分钟见真章。" : "一敬一亲，十五分钟攻防战。"}
          </h1>
          <p className="lede">
            {track === "tcf"
              ? "严格对齐 FEI TCF 全真节奏：Tâche 1 无准备个人交流（2:00）→ Tâche 2 准备 2:00 + 向考官连环提问获取实用信息（3:30）→ Tâche 3 零准备社会议题即兴辩证陈述（4:30），直出 0–20 分（0.5 分档）、CECR 与加拿大 NCLC 等级。"
              : "严格对齐 CCI Paris TEF / TEF Canada 双任务：Section A 用礼貌敬称 vous 致电分类广告主办方提满约 10 个问题（1:00 读题 + 5:00 通话）→ Section B 立即切换亲密称呼 tu 说服持怀疑态度的好友同行并化解 4–5 个异议（1:00 读题 + 10:00 说服），直出 0–699 分与 NCLC 1–12。"}
          </p>
          {renderTierBanner()}
        </header>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2 className="eyebrow">考场交互选项</h2>
              <span className="muted small">支持麦克风原声录音、实时提问句式统计与 vous / tu 语体偏离预警</span>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (track === "tcf") {
                  const pick = TCF_SPEAKING_SUITES[Math.floor(Math.random() * TCF_SPEAKING_SUITES.length)];
                  beginTcfSuite(pick);
                } else {
                  const pick = TEF_SPEAKING_SUITES[Math.floor(Math.random() * TEF_SPEAKING_SUITES.length)];
                  beginTefSuite(pick);
                }
              }}
            >
              <Shuffle size={16} /> 随机抽一套全真开考
            </button>
          </div>
          <label className="field toggle is-full">
            <div>
              <b>静音 2.2 秒自动结束本轮发言（VAD 免手动点停）</b>
              <small>开启后，每次你开口说完停顿满 2.2 秒将自动提交本轮语音并触发考官/好友下一句回应。</small>
            </div>
            <input
              type="checkbox"
              role="switch"
              checked={vadAutoEnd}
              onChange={(e) => setVadAutoEnd(e.target.checked)}
            />
            <span className="switch" aria-hidden="true" />
          </label>
        </section>

        <section className="essay-level">
          <h2 className="eyebrow">
            {track === "tcf"
              ? `内置全真 TCF 口语套题（${TCF_SPEAKING_SUITES.length} 套 · T1+T2+T3）`
              : `内置全真 TEF 口语套题（${TEF_SPEAKING_SUITES.length} 套 · Sec A vous + Sec B tu）`}
          </h2>
          <div className="essay-tasks">
            {track === "tcf"
              ? TCF_SPEAKING_SUITES.map((s) => (
                  <button key={s.id} type="button" className="essay-task" onClick={() => beginTcfSuite(s)}>
                    <span className="chip">{s.topicZh}</span>
                    <b lang="fr">{s.title}</b>
                    <small>T2 情境：{s.tache2.roleplayTitleFr}</small>
                    <small className="essay-task-meta" lang="fr">
                      T3（0 准备）：{s.tache3.questionFr}
                    </small>
                  </button>
                ))
              : TEF_SPEAKING_SUITES.map((s) => (
                  <button key={s.id} type="button" className="essay-task" onClick={() => beginTefSuite(s)}>
                    <span className="chip">{s.topicZh}</span>
                    <b lang="fr">{s.title}</b>
                    <small lang="fr">{s.adHeadlineFr}</small>
                    <small className="essay-task-meta">
                      Sec A（5m · vous 问满 ~10 题）+ Sec B（10m · tu 说服好友 {s.sectionB.friendNameFr}）
                    </small>
                  </button>
                ))}
          </div>
        </section>

        {trackLogs.length > 0 && (
          <section className="essay-level">
            <h2 className="eyebrow">{TRACK_META[track].shortName} 口语历史成绩</h2>
            <ul className="essay-history">
              {trackLogs.slice(0, 10).map((r, idx) => (
                <li key={idx}>
                  <span>
                    {day(r.at)} ·{" "}
                    {(track === "tcf"
                      ? TCF_SPEAKING_SUITES.find((x) => x.id === r.what)?.title
                      : TEF_SPEAKING_SUITES.find((x) => x.id === r.what)?.title) ?? r.what}
                  </span>
                  <span className="muted">
                    {track === "tcf" ? `${r.score}/20` : `${r.scaledScore ?? r.score}/699`}
                    {r.nclc ? ` · NCLC ${r.nclc}` : ""}
                    {r.typed ? " · 打字练习" : ""}
                    {r.unverified ? " · 离线自评" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  /* ---------- Stage: Grading Spinner ---------- */
  if (stage === "grading") {
    return (
      <div className="page practice">
        <section className="essay-stage">
          <div className="panel">
            <p className="eyebrow">AI 考官取证核分中（Temperature 0）</p>
            <h2 className="essay-title">正在核算提问覆盖度、语体一致性与 NCLC 等级…</h2>
            <p className="muted">约需 15–35 秒，请稍候。</p>
            <div className="writing-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  ctrlRef.current?.abort();
                  setStage(track === "tcf" ? "tcf_t3" : "tef_b_run");
                }}
              >
                取消批改，返回继续作答
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  /* ---------- Stage: Result Scorecard ---------- */
  if (stage === "result") {
    const activeTitle = track === "tcf" ? tcfSuite.title : tefSuite.title;
    const activeId = track === "tcf" ? tcfSuite.id : tefSuite.id;
    const offlineKeys =
      track === "tcf"
        ? ([
            ["c1", "T1–T2 互动与有效提问"],
            ["c2", "T3 零准备观点论证"],
            ["lex", "口语词汇广度"],
            ["mor", "口语句法与流利度"],
          ] as const)
        : ([
            ["c1", "Sec A 敬称提问 (vous)"],
            ["c2", "Sec B 好友说服 (tu)"],
            ["lex", "双语域词汇得体度"],
            ["mor", "口语句法与流利度"],
          ] as const);

    return (
      <div className="page practice">
        <section className="essay-stage">
          <header className="exam-top">
            <button type="button" className="btn btn-ghost" onClick={() => setStage("pick")}>
              <ArrowLeft size={16} /> 返回题库
            </button>
            <span className="eyebrow">{TRACK_META[track].shortName} · 口语成绩单</span>
          </header>

          <h2 className="essay-title" lang="fr">
            {activeTitle}
          </h2>

          {gradeRes ? (
            <>
              <div className="essay-marks">
                <div>
                  <p className="essay-total">
                    {gradeRes.scaledScore}
                    <small>/{gradeRes.scaleMax}</small>
                  </p>
                  <div className="essay-chips">
                    <span className="chip">CECR {gradeRes.cefr}</span>
                    <span className="chip">NCLC {gradeRes.nclc}</span>
                    <span className={`chip ${gradeRes.nclc7Passed ? "" : "warn-text"}`}>
                      {gradeRes.nclc7Passed ? "已达加拿大 NCLC 7+" : "冲刺 NCLC 7"}
                    </span>
                  </div>
                </div>
                <dl className="essay-scores">
                  {gradeRes.subscores.map((sub) => (
                    <div key={sub.key}>
                      <dt>{sub.label}</dt>
                      <dd>
                        <span className="essay-bar">
                          <span style={{ width: `${(sub.score / 5) * 100}%` }} />
                        </span>
                        {sub.score}/5
                        {sub.note && <span className="muted small"> · {sub.note}</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="mini-stats">
                <div>
                  <dt>有效提问数</dt>
                  <dd>
                    {gradeRes.questionStats.totalQuestions}
                    <small>{track === "tef" ? "/10 题" : " 题"}</small>
                  </dd>
                </div>
                <div>
                  <dt>疑问句式多样性</dt>
                  <dd>
                    {gradeRes.questionStats.varietyScore3}
                    <small>/3</small>
                  </dd>
                </div>
                <div>
                  <dt>语体核查</dt>
                  <dd>
                    <small className={gradeRes.registerAudit.penaltyApplied ? "warn-text" : ""}>
                      {gradeRes.registerAudit.penaltyApplied ? "有越界扣分" : "vous/tu 合规"}
                    </small>
                  </dd>
                </div>
              </div>

              <p className="muted small">{gradeRes.registerAudit.summaryZh}</p>
              {gradeRes.comment && <p className="essay-comment">{gradeRes.comment}</p>}

              {gradeRes.todo.length > 0 && (
                <div className="essay-box">
                  <p className="eyebrow">优先提分行动</p>
                  <ol>
                    {gradeRes.todo.map((item, k) => (
                      <li key={k}>{item}</li>
                    ))}
                  </ol>
                </div>
              )}

              {gradeRes.strengths.length > 0 && (
                <details className="essay-fold" open>
                  <summary>亮点总结（{gradeRes.strengths.length}）</summary>
                  <ul>
                    {gradeRes.strengths.map((item, k) => (
                      <li key={k}>{item}</li>
                    ))}
                  </ul>
                </details>
              )}

              {gradeRes.corrections.length > 0 && (
                <details className="essay-fold" open>
                  <summary>真实可听见的口语纠错（{gradeRes.corrections.length}）</summary>
                  <ul className="writing-errors essay-corrections">
                    {gradeRes.corrections.map((c, k) => {
                      const savedAlready = !!keptNotes?.some((n) => n.wrong === c.wrong && n.right === c.right);
                      return (
                        <li key={k}>
                          <span className="chip">{ERROR_LABEL[c.type]}</span>
                          <span lang="fr">
                            {c.wrong && <del>{c.wrong}</del>} {c.right && <ins>{c.right}</ins>}
                          </span>
                          {c.why && <small>{c.why}</small>}
                          {c.point && pointTitle.has(c.point) && (
                            <a className="link essay-point" href={`#/grammar?p=${c.point}`}>
                              练这个语法点：{pointTitle.get(c.point)} <ArrowRight size={13} />
                            </a>
                          )}
                          <button
                            type="button"
                            className="link essay-keep"
                            disabled={savedAlready}
                            onClick={() =>
                              saveNote({
                                wrong: c.wrong,
                                right: c.right,
                                type: c.type,
                                why: c.why,
                                point: c.point,
                                from: `${TRACK_META[track].shortName} EO · ${activeTitle}`,
                              })
                            }
                          >
                            {savedAlready ? (
                              <>
                                <Check size={13} /> 已存错句本
                              </>
                            ) : (
                              "存进错句本"
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              )}

              {gradeRes.modelSamples.length > 0 && (
                <div className="essay-box">
                  <p className="eyebrow">地道高分口语示范（B2+/C1）</p>
                  {gradeRes.modelSamples.map((m, idx) => (
                    <div key={idx}>
                      <b>{m.label}</b>
                      <p className="essay-text" lang="fr">
                        {m.fr}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="essay-box">
              <p className="eyebrow">离线四维自评（配置 AI 接口可解锁自动精批）</p>
              {offlineKeys.map(([key, label]) => (
                <div key={key} className="speak-rubric-row">
                  <b>{label}</b>
                  <div className="speak-score-btns">
                    {SELF_LEVELS.map((lv) => (
                      <button
                        key={lv}
                        type="button"
                        className={`chip-btn ${selfScores[key] === lv ? "is-on" : ""}`}
                        onClick={() => setSelfScores((prev) => ({ ...prev, [key]: lv }))}
                      >
                        {lv}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="writing-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={selfSaved || offlineKeys.some(([k]) => selfScores[k] === undefined)}
                  onClick={() => {
                    const sum20 = offlineKeys.reduce((acc, [k]) => acc + (selfScores[k] ?? 0), 0);
                    if (track === "tcf") {
                      const p = scoreTcfProductive20(sum20, "eo");
                      logExam({
                        part: "speak",
                        what: activeId,
                        score: p.score20,
                        total: 20,
                        unverified: true,
                        level: "B2",
                        scope: "full",
                        track: "tcf",
                        trackSection: "eo",
                        nclc: p.nclc,
                      });
                      toast(`已保存 TCF 口语离线自评：${p.score20}/20（NCLC ${p.nclc}）`, "ok");
                    } else {
                      const p = scoreTefSection699("eo", sum20, 20);
                      logExam({
                        part: "speak",
                        what: activeId,
                        score: p.score699,
                        total: 699,
                        scaledScore: p.score699,
                        unverified: true,
                        level: "B2",
                        scope: "full",
                        track: "tef",
                        trackSection: "eo",
                        nclc: p.nclc,
                      });
                      toast(`已保存 TEF 口语离线自评：${p.score699}/699（NCLC ${p.nclc}）`, "ok");
                    }
                    setSelfSaved(true);
                  }}
                >
                  {selfSaved ? "已记录离线自评" : "保存自评成绩"}
                </button>
              </div>
            </div>
          )}

          {allProns && <PronReport result={allProns} title="全卷语音流利度与音素/时间戳报告" />}

          {(track === "tcf"
            ? [
                ["Tâche 1 · 无准备个人交流", tcfT1List],
                ["Tâche 2 · 信息咨询互动 (vous)", tcfT2List],
                ["Tâche 3 · 零准备观点论证", tcfT3List],
              ]
            : [
                ["Section A · 正式电话提问 (vous)", tefAList],
                ["Section B · 说服好友同行 (tu)", tefBList],
              ]
          ).map(([secTitle, rows]) => {
            const list = rows as RecordedExchange[];
            if (!list.length) return null;
            return (
              <details key={secTitle as string} className="essay-fold" open>
                <summary>{secTitle as string} · 逐轮录音与时间戳回放</summary>
                <ol className="exam-debate">
                  {list.map((item, i) => (
                    <ExchangeRow key={i} item={item} idx={i} />
                  ))}
                </ol>
              </details>
            );
          })}

          <div className="writing-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => (track === "tcf" ? beginTcfSuite(tcfSuite) : beginTefSuite(tefSuite))}
            >
              <RefreshCw size={15} /> 同题重考一遍
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setStage("pick")}>
              返回选择其他套题
            </button>
          </div>
        </section>
      </div>
    );
  }

  /* ---------- Active Prep Stages ---------- */
  if (stage === "tcf_t2_prep" || stage === "tef_a_prep" || stage === "tef_b_prep") {
    const isTcf2 = stage === "tcf_t2_prep";
    const isTefA = stage === "tef_a_prep";
    return (
      <div className="page practice">
        <section className="essay-stage">
          <header className="exam-top">
            <button type="button" className="btn btn-ghost" onClick={() => void confirmLeaveToPicker()}>
              放弃模考
            </button>
            <span className="eyebrow">
              {isTcf2
                ? "TCF EO · Tâche 2 准备期（2:00）"
                : isTefA
                  ? "TEF EO · Section A 读题准备（1:00 · 敬称 vous）"
                  : "TEF EO · Section B 读题准备（1:00 · 亲密 tu）"}
            </span>
            <span className={`exam-clock ${timer.sec === 0 ? "is-over" : timer.sec <= 15 ? "is-amber" : ""}`}>
              {timer.sec === 0 ? "准备时间到" : `准备倒计时 ${clock(timer.sec)}`}
            </span>
          </header>

          {isTcf2 ? (
            <>
              <h2 className="essay-title" lang="fr">
                {tcfSuite.tache2.roleplayTitleFr}
              </h2>
              <p className="essay-consigne" lang="fr">
                {tcfSuite.tache2.cardFr}
              </p>
              <p className="muted small">{tcfSuite.tache2.candidateGoalZh}</p>
            </>
          ) : (
            <>
              <h2 className="essay-title" lang="fr">
                {tefSuite.adHeadlineFr}
              </h2>
              <blockquote className="essay-doc" lang="fr">
                {tefSuite.adBodyFr}
                <br />
                <small>{tefSuite.adContactFr}</small>
              </blockquote>
              <p className="essay-situation">
                {isTefA ? tefSuite.sectionA.goalZh : tefSuite.sectionB.goalZh}
              </p>
              {!isTefA && (
                <p className="muted small">
                  <b>好友画像（{tefSuite.sectionB.friendNameFr}）：</b> {tefSuite.sectionB.friendPersonaFr}
                </p>
              )}
            </>
          )}

          <textarea
            className="writing-input"
            rows={4}
            lang="fr"
            value={prepNotes}
            onChange={(e) => setPrepNotes(e.target.value.slice(0, 600))}
            placeholder={
              isTcf2 || isTefA
                ? "速记提问维度关键词（如：tarifs ? horaires ? débutants ? matériel ? annulation ?）…"
                : "速记说服好友的核心论点（注意一会儿全程用 tu，切勿说 vous！）…"
            }
            aria-label="准备期关键词草稿"
          />

          <div className="writing-actions">
            <button
              type="button"
              className="btn btn-primary btn-xl"
              onClick={isTcf2 ? enterTcfT2Run : isTefA ? enterTefARun : enterTefBRun}
            >
              {isTcf2
                ? "结束准备 · 开始提问（3:30 · vous）"
                : isTefA
                  ? "拨通咨询电话（5:00 · 敬称 vous）"
                  : `拨通好友 ${tefSuite.sectionB.friendNameFr} 电话（10:00 · 亲密 tu）`}{" "}
              <ArrowRight size={18} />
            </button>
          </div>
        </section>
      </div>
    );
  }

  /* ---------- Active Speaking / Interaction Stages ---------- */
  const isQuestioningStage = stage === "tcf_t2_run" || stage === "tef_a_run";
  const isTefPersuasion = stage === "tef_b_run";
  const stageBadge =
    stage === "tcf_t1"
      ? "TCF Tâche 1 · 无准备交流（2:00）"
      : stage === "tcf_t2_run"
        ? "TCF Tâche 2 · 角色扮演提问（3:30 · vous）"
        : stage === "tcf_t3"
          ? "TCF Tâche 3 · 0 准备即兴辩证陈述（4:30）"
          : stage === "tef_a_run"
            ? "TEF Section A · 电话咨询提问（5:00 · vous）"
            : `TEF Section B · 说服好友 ${tefSuite.sectionB.friendNameFr}（10:00 · tu）`;

  const lastInterlocutor = [...activeList].reverse().find((x) => x.speaker === "interlocutor");

  return (
    <div className="page practice">
      <section className="essay-stage">
        <header className="exam-top">
          <button type="button" className="btn btn-ghost" onClick={() => void confirmLeaveToPicker()}>
            放弃模考
          </button>
          <span className="eyebrow">{stageBadge}</span>
          <span className={`exam-clock ${timer.sec === 0 ? "is-over" : timer.sec <= 30 ? "is-amber" : "is-ok"}`}>
            {timer.sec === 0 ? "本段计时到" : clock(timer.sec)}
          </span>
        </header>

        {/* Prompt / Ad Context Card */}
        {track === "tcf" ? (
          <div className="essay-box">
            <p className="eyebrow">
              {stage === "tcf_t1"
                ? "Tâche 1 · 0 准备自我介绍与日常话题"
                : stage === "tcf_t2_run"
                  ? `Tâche 2 · ${tcfSuite.tache2.examinerRoleFr}`
                  : "Tâche 3 · 0 准备社会议题即兴陈述"}
            </p>
            <p className="essay-consigne" lang="fr">
              {stage === "tcf_t1"
                ? tcfSuite.tache1.promptFr
                : stage === "tcf_t2_run"
                  ? tcfSuite.tache2.cardFr
                  : tcfSuite.tache3.questionFr}
            </p>
            {stage === "tcf_t2_run" && prepNotes.trim() && (
              <p className="muted small">
                <b>准备期关键词：</b> {prepNotes}
              </p>
            )}
          </div>
        ) : (
          <div className="essay-box">
            <p className="eyebrow" lang="fr">
              {tefSuite.adHeadlineFr}
            </p>
            <p className="muted small" lang="fr">
              {tefSuite.adBodyFr}
            </p>
            {prepNotes.trim() && (
              <p className="muted small">
                <b>准备笔记：</b> {prepNotes}
              </p>
            )}
          </div>
        )}

        {/* Live Question Variety & Register Consistency HUD */}
        {isQuestioningStage && (
          <div className="panel" role="status" aria-live="polite">
            <div className="panel-head">
              <div>
                <p className="eyebrow">实时提问与敬称监测</p>
                <b>
                  {stage === "tef_a_run"
                    ? `已提出 ${liveQuestionStats.totalQuestions}/${tefSuite.sectionA.targetQuestions} 题 · 句式多样性 ${liveQuestionStats.varietyScore3}/3`
                    : `已提出 ${liveQuestionStats.totalQuestions} 个有效问题 · 句式多样性 ${liveQuestionStats.varietyScore3}/3`}
                </b>
              </div>
              <span className={`chip ${liveFormalRegister.usedTuInFormal ? "warn-text" : ""}`}>
                {liveFormalRegister.usedTuInFormal
                  ? `⚠️ 误用亲密 tu（${liveFormalRegister.tuMatches.slice(0, 2).join(", ")}）！请改用 vous`
                  : liveFormalRegister.hasTargetPronoun
                    ? "✓ 敬称 vous 得体"
                    : "提示：请用 vous 向对方提问"}
              </span>
            </div>
            <div className="essay-chips">
              {(["estCeQue", "inversion", "whWord", "intonation"] as const).map((kind) => (
                <span key={kind} className={`chip ${liveQuestionStats.counts[kind] > 0 ? "chip-mine" : ""}`}>
                  {QUESTION_STRUCTURE_LABEL[kind]} × {liveQuestionStats.counts[kind]}
                </span>
              ))}
            </div>
          </div>
        )}

        {isTefPersuasion && (
          <div className="panel" role="status" aria-live="polite">
            <div className="panel-head">
              <div>
                <p className="eyebrow">TEF Section B · 好友亲密语体监测 (tutoiement)</p>
                <b>
                  已交锋 {activeList.filter((x) => x.speaker === "candidate").length}/
                  {tefSuite.sectionB.objectionsFr.length} 轮异议
                </b>
              </div>
              <span className={`chip ${liveInformalRegister.usedVousInInformal ? "warn-text" : ""}`}>
                {liveInformalRegister.usedVousInInformal
                  ? `⚠️ 误用生硬 vous（${liveInformalRegister.vousMatches.slice(0, 2).join(", ")}）！对好友须全程用 tu`
                  : liveInformalRegister.hasTargetPronoun
                    ? `✓ 亲密 tu 自然稳定（${liveInformalRegister.tuCount} 处）`
                    : "提示：请用 tu / te / toi / ton 说服好友"}
              </span>
            </div>
          </div>
        )}

        {/* Dialogue Stream */}
        {activeList.length > 0 && (
          <ol className="exam-debate">
            {activeList.map((item, idx) => (
              <ExchangeRow key={idx} item={item} idx={idx} />
            ))}
          </ol>
        )}

        {lastInterlocutor && (
          <div className="writing-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => speakOpeningLine(lastInterlocutor.text, activeList.length)}
            >
              <Volume2 size={14} /> 重听上一句语音
            </button>
          </div>
        )}

        {/* Candidate Capture Area */}
        <div className="essay-box">
          <div className="writing-actions">
            {recorder.on || listening ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busyTurn}
                onClick={() => void commitTurnAndReply()}
              >
                <Square size={15} /> 停止录音并发送本轮发言
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busyTurn}
                onClick={() => void startVoiceTurn()}
              >
                <Mic size={16} /> 开口录音发言
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busyTurn || (!draftInput.trim() && !recorder.on)}
              onClick={() => void commitTurnAndReply()}
            >
              {busyTurn ? "转写与考官回应中…" : "发送本轮 → 听对方回应"}
            </button>
          </div>

          {interim && (
            <p className="muted small" lang="fr">
              实时听写预览：{interim}
            </p>
          )}

          <textarea
            ref={inputRef}
            className="writing-input"
            rows={stage === "tcf_t3" ? 6 : 3}
            lang="fr"
            value={draftInput}
            readOnly={busyTurn}
            onChange={(e) => {
              const v = e.target.value.slice(0, 4000);
              draftRef.current = v;
              setDraftInput(v);
            }}
            placeholder={
              isQuestioningStage
                ? "开口提问（录音结束后自动覆盖为高保真转写），或在此输入法语问题…"
                : isTefPersuasion
                  ? "用 tu 回应好友的顾虑并给出有说服力的理由…"
                  : "开口陈述你的观点（支持多轮追问互动）…"
            }
            spellCheck={false}
            aria-label="本轮法语发言"
          />
          {!busyTurn && (
            <AccentKeys
              input={inputRef}
              value={draftInput}
              onChange={(v) => {
                const clipped = v.slice(0, 4000);
                draftRef.current = clipped;
                setDraftInput(clipped);
              }}
            />
          )}
        </div>

        {/* Stage Transition Footer */}
        <div className="writing-actions">
          {stage === "tcf_t1" && (
            <button
              type="button"
              className="btn btn-primary btn-xl"
              disabled={busyTurn}
              onClick={() => void enterTcfT2Prep()}
            >
              下一部分：Tâche 2 角色扮演（2:00 准备） <ArrowRight size={18} />
            </button>
          )}
          {stage === "tcf_t2_run" && (
            <button
              type="button"
              className="btn btn-primary btn-xl"
              disabled={busyTurn}
              onClick={() => void enterTcfT3()}
            >
              下一部分：Tâche 3 零准备观点陈述（4:30） <ArrowRight size={18} />
            </button>
          )}
          {stage === "tcf_t3" && (
            <button
              type="button"
              className="btn btn-primary btn-xl"
              disabled={busyTurn}
              onClick={() => void submitExamForGrading()}
            >
              交卷并核算 TCF 0–20 & NCLC 成绩 <ArrowRight size={18} />
            </button>
          )}
          {stage === "tef_a_run" && (
            <button
              type="button"
              className="btn btn-primary btn-xl"
              disabled={busyTurn}
              onClick={() => void enterTefBPrep()}
            >
              下一部分：Section B 说服好友（1:00 读题 · tu） <ArrowRight size={18} />
            </button>
          )}
          {stage === "tef_b_run" && (
            <button
              type="button"
              className="btn btn-primary btn-xl"
              disabled={busyTurn}
              onClick={() => void submitExamForGrading()}
            >
              交卷并核算 TEF 0–699 & NCLC 成绩 <ArrowRight size={18} />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
