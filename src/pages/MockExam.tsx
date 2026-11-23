import { useEffect, useMemo, useRef, useState } from "react";
import { transcribeAudio } from "../ai/clients";
import { ready, useAiConfig } from "../ai/config";
import { assessRecording } from "../ai/pronunciation";
import { debateQuestion, gradeEssay, gradeSpeaking } from "../ai/tasks";
import { speakerVoices } from "../ai/tts";
import { useGrammar } from "../atlas/grammar";
import { stopAudio } from "../lib/audio";
import { countWords, CRITERIA, ESSAY_TASKS, totalScore, type EssayTask } from "../lib/essay";
import { BETWEEN_PLAYS, clock, FORM_SPEC, READ_MINUTES, SPEAK_CRITERIA, SPEAK_TIMES, SPEAKING_SUBJECTS, type DebateTurn, type SpeakingSubject } from "../lib/exam";
import { PRESET_PAPERS } from "../lib/exam-presets";
import { examReadiness, type MockRecord } from "../lib/exam-schema";
import { missStats, pickVoices, type DocVoices } from "../lib/listening";
import { useNavGuard } from "../lib/nav-guard";
import { combineSpeakingProns, phonoLevel, summarizeAcoustics, type PronResult } from "../lib/pronunciation";
import type { Take } from "../lib/recorder";
import { buildWeeklyRemediation, openMockDiagnosticPrint } from "../lib/remediation";
import { speakingPresetOf } from "../lib/speaking-presets";
import { canDictate, dictate } from "../lib/speech";
import { useTimer } from "../lib/timer";
import { logExam, saveEssay, saveMockRecord, saveSpeakingCorrections, saveWeeklyPlan } from "../store/essays";
import { addMisses } from "../store/misses";
import { keepRecording } from "../store/recordings";
import { useStore, useStoreShallow } from "../store/store";
import { useAssess, useRecorder } from "../ui/Recording";
import { toast } from "../ui/Toast";
import { collectCompMisses, getMockPaperPair, isMockPoTyped, mockPaperOptions, resolveMockPoTyped, rubricComplete, rubricSum, scoreComp } from "./mock-exam-helpers";
import { speakExaminer } from "./speaking/helpers";
import { MockSetup } from "./mock/MockSetup";
import { MockSpeaking } from "./mock/MockSpeaking";
import { SummaryView } from "./mock/MockSummary";
import { MockWritten } from "./mock/MockWritten";
import { initialMock, loadJson, loadMock, MOCK_LAST_KEY, type MockState, num, saveLastMock, saveMock, sayMockDoc } from "./mock/state";

/**
 * 四项全真模考流（SYS-3）：
 * CO 30m → CE 60m → PE 60m 连续 2h30 笔试 + PO 口语（含离线免 AI Key 与有 AI Key 双路径），
 * 到时严格锁卷交卷，并实时写入 examLog 汇入 /100 成绩单与 <5/25 淘汰预警。
 */
export function MockExam({ onExit }: { onExit: () => void }) {
  const ai = useAiConfig();
  const hasAi = ready.text(ai);
  const azure = ready.tts(ai);
  const { data: grammar } = useGrammar();
  const settings = useStore((s) => s.settings) as { targetScore?: number };
  const target = typeof settings.targetScore === "number" && settings.targetScore >= 50 ? settings.targetScore : 75;
  const progress = useStoreShallow((s) => ({
    mockRecords: s.progress.mockRecords,
    gramTags: s.progress.gramTags,
    examLog: s.progress.examLog,
    compMisses: s.progress.compMisses,
    essayNotes: s.progress.essayNotes,
    weeklyPlan: s.progress.weeklyPlan,
  }));
  const mockRecords = progress.mockRecords ?? [];

  const [saved, setSaved] = useState<MockState | null>(() => loadMock());
  const [lastSummary, setLastSummary] = useState<MockState | null>(() => loadJson(MOCK_LAST_KEY));
  const [setIdx, setSetIdx] = useState<number>(0);
  const [strict, setStrict] = useState(true);
  const [m, setM] = useState<MockState | null>(null);

  // CO playback & CE tools state
  const [coVoices, setCoVoices] = useState<DocVoices[][]>([]);
  const [coPace, setCoPace] = useState<{ e: number; label: string; left: number | null } | null>(null);
  const [ceHl, setCeHl] = useState<Record<string, boolean>>({});
  const [ceStruck, setCeStruck] = useState<Record<string, boolean>>({});
  const run = useRef(0);
  const skip = useRef<(() => void) | null>(null);
  const freeTimeoutWarned = useRef<string | null>(null);

  // Timers
  const writtenTimer = useTimer();
  const sectionTimer = useTimer();
  const latestMockRef = useRef<{ m: MockState | null; w: number; s: number }>({ m: null, w: 0, s: 0 });
  latestMockRef.current = { m, w: writtenTimer.sec, s: sectionTimer.sec };

  useNavGuard(
    Boolean(m && m.stage !== "setup" && m.stage !== "summary"),
    "全真模考正在进行中，离开后未提交的当前作答与计时将被中断，确定离开？",
  );

  // PO live state
  const recorder = useRecorder();
  const pron = useAssess();
  const [poTalkTake, setPoTalkTake] = useState<Take | null>(null);
  const [poTurnTakes, setPoTurnTakes] = useState<Record<number, Take>>({});
  const poTurnTakesRef = useRef<Record<number, Take>>({});
  const poTurnPronsRef = useRef<Record<number, PronResult>>({});
  const poDebateSpeechFailedRef = useRef(false);
  const [poDebateSpeechFailed, setPoDebateSpeechFailed] = useState(false);
  const [poDictating, setPoDictating] = useState(false);
  const [poInterim, setPoInterim] = useState("");
  const [poAsking, setPoAsking] = useState(false);
  const [poAskError, setPoAskError] = useState<string | null>(null);
  const [poPresetIdx, setPoPresetIdx] = useState(0);
  const [poBusy, setPoBusy] = useState(false);
  const [poTranscribing, setPoTranscribing] = useState(false);
  const stopRec = useRef<(() => void) | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const dictation = canDictate();

  const listenPapers = useMemo(() => PRESET_PAPERS.filter((p) => p.kind === "listen"), []);
  const readPapers = useMemo(() => PRESET_PAPERS.filter((p) => p.kind === "read"), []);
  const paperOptions = useMemo(() => mockPaperOptions(listenPapers, readPapers), [listenPapers, readPapers]);
  const points = useMemo(() => (grammar?.points ?? []).map((p) => ({ id: p.id, title: p.title })), [grammar]);
  const pointTitle = useMemo(() => new Map(points.map((p) => [p.id, p.title])), [points]);
  const coHeard = m?.coHeard ?? {};
  const toggleCeStrike = (optKey: string) => setCeStruck((s) => ({ ...s, [optKey]: !s[optKey] }));

  const withClocks = (cur: MockState): MockState => {
    if (cur.stage === "co" || cur.stage === "ce" || cur.stage === "pe") {
      return {
        ...cur,
        writtenLeftSec: writtenTimer.sec,
        ...(cur.stage === "ce" ? { ceLeftSec: sectionTimer.sec } : {}),
        ...(cur.stage === "pe" ? { peLeftSec: sectionTimer.sec } : {}),
      };
    }
    if (cur.stage === "po_prep") return { ...cur, poPrepLeftSec: sectionTimer.sec };
    if (cur.stage === "po_talk") return { ...cur, poTalkSec: sectionTimer.sec };
    if (cur.stage === "po_debate") return { ...cur, poDebateSec: sectionTimer.sec };
    return cur;
  };

  const update = (patch: Partial<MockState> | ((cur: MockState) => Partial<MockState>)) => {
    setM((cur) => {
      if (!cur) return cur;
      const p = typeof patch === "function" ? patch(cur) : patch;
      const next = { ...cur, ...p };
      if (next.stage === "summary") {
        saveMock(null);
        saveLastMock(next);
        setLastSummary(next);
      } else {
        saveMock(next);
      }
      return next;
    });
  };

  useEffect(
    () => () => {
      run.current++;
      stopRec.current?.();
      ctrl.current?.abort();
      stopAudio();
      const { m: cur, w, s } = latestMockRef.current;
      if (cur && ["co", "ce", "pe", "po_prep", "po_talk", "po_debate"].includes(cur.stage)) {
        saveMock({
          ...cur,
          ...(cur.stage === "co" || cur.stage === "ce" || cur.stage === "pe" ? { writtenLeftSec: w } : {}),
          ...(cur.stage === "ce" ? { ceLeftSec: s } : {}),
          ...(cur.stage === "pe" ? { peLeftSec: s } : {}),
          ...(cur.stage === "po_prep" ? { poPrepLeftSec: s } : {}),
          ...(cur.stage === "po_talk" ? { poTalkSec: s } : {}),
          ...(cur.stage === "po_debate" ? { poDebateSec: s } : {}),
        });
      }
    },
    [],
  );

  // Sync remaining clocks into persisted state every 15s (avoid per-second full-state serialization)
  useEffect(() => {
    if (!m) return;
    if (!["co", "ce", "pe", "po_prep", "po_talk", "po_debate"].includes(m.stage)) return;
    if (writtenTimer.sec % 15 !== 0 && sectionTimer.sec % 15 !== 0) return;
    saveMock(withClocks(m));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m?.stage, writtenTimer.sec, sectionTimer.sec]);

  // Pooled 120m CE+PE clock: emit one-time advisory at 60m remaining during CE; auto-lock CE+PE when pooled 120m hits 0
  useEffect(() => {
    if (!m || !sectionTimer.down) return;
    if (m.stage === "ce" && sectionTimer.sec <= 60 * 60 && sectionTimer.sec > 0 && !m.ceAdvise60Shown) {
      update({ ceAdvise60Shown: true });
      toast("CE+PE 共享笔试已过 60 分钟，建议尽快交阅读进入写作（剩余时间将全部留给写作）", "info");
    }
    if (sectionTimer.sec > 0) return;
    if (!m.strict) {
      if ((m.stage === "ce" || m.stage === "pe") && freeTimeoutWarned.current !== m.stage) {
        freeTimeoutWarned.current = m.stage;
        toast("已超出 120 分钟 CE+PE 建议总用时，自由练习模式不自动锁卷，可继续作答或随时交卷", "info");
      }
      return;
    }
    if (m.stage === "ce") {
      const { readPaper: rp } = getMockPaperPair(listenPapers, readPapers, m.setIdx);
      const sc = scoreComp(rp.exs, m.cePicked, m.ceTyped ?? {});
      logExam({ part: "read", what: `mock-${rp.id}`, score: sc, total: 25, level: "B2", scope: "full" });
      addMisses(collectCompMisses(rp.exs, "read", m.cePicked, m.ceTyped ?? {}, Date.now()));
      writtenTimer.stop();
      sectionTimer.stop();
      toast(`120 分钟阅读+写作共享计时已用尽，阅读已自动交卷（${num(sc)}/25）！`, "info");
      update({ ceScore: sc, ceLeftSec: 0, peLeftSec: 0, stage: "pe_grade" });
    } else if (m.stage === "pe" && !poBusy) {
      toast("120 分钟阅读+写作共享计时已到，已自动锁卷提交！", "info");
      void handleSubmitPe(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionTimer.sec, sectionTimer.down, m?.stage, m?.strict, m?.ceAdvise60Shown]);

  useEffect(() => {
    if (!m || !m.strict || !writtenTimer.down || writtenTimer.sec > 0) return;
    if (m.stage !== "co" && m.stage !== "ce" && m.stage !== "pe") return;
    if (poBusy) return;
    const { listenPaper: lp, readPaper: rp } = getMockPaperPair(listenPapers, readPapers, m.setIdx);
    const now = Date.now();
    if (m.stage === "co") {
      haltAudio();
      const coSc = scoreComp(lp.exs, m.coPicked);
      const ceSc = scoreComp(rp.exs, m.cePicked, m.ceTyped ?? {});
      logExam({ part: "listen", what: `mock-${lp.id}`, score: coSc, total: 25, level: "B2", scope: "full" });
      logExam({ part: "read", what: `mock-${rp.id}`, score: ceSc, total: 25, level: "B2", scope: "full" });
      addMisses(collectCompMisses(lp.exs, "listen", m.coPicked, {}, now));
      addMisses(collectCompMisses(rp.exs, "read", m.cePicked, m.ceTyped ?? {}, now));
      writtenTimer.stop();
      sectionTimer.stop();
      toast("2h30 笔试总时间到，已自动锁卷！", "info");
      update({ coScore: coSc, ceScore: ceSc, writtenLeftSec: 0, stage: "pe_grade" });
    } else if (m.stage === "ce") {
      const ceSc = scoreComp(rp.exs, m.cePicked, m.ceTyped ?? {});
      logExam({ part: "read", what: `mock-${rp.id}`, score: ceSc, total: 25, level: "B2", scope: "full" });
      addMisses(collectCompMisses(rp.exs, "read", m.cePicked, m.ceTyped ?? {}, now));
      writtenTimer.stop();
      sectionTimer.stop();
      toast("2h30 笔试总时间到，已自动锁卷！", "info");
      update({ ceScore: ceSc, writtenLeftSec: 0, ceLeftSec: 0, stage: "pe_grade" });
    } else {
      toast("2h30 笔试总时间到，写作已自动锁卷提交！", "info");
      void handleSubmitPe(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writtenTimer.sec, writtenTimer.down, m?.stage, m?.strict]);

  const resetLiveSessionState = (lp: ReturnType<typeof getMockPaperPair>["listenPaper"]) => {
    setCoVoices(lp.exs.map((ex) => ex.docs.map(() => (azure ? pickVoices("mixed") : { voices: speakerVoices(), accents: [] }))));
    setCoPace(null);
    setCeHl({});
    setCeStruck({});
    freeTimeoutWarned.current = null;
    setPoTalkTake(null);
    poTurnTakesRef.current = {};
    setPoTurnTakes({});
    poTurnPronsRef.current = {};
    poDebateSpeechFailedRef.current = false;
    setPoDebateSpeechFailed(false);
    pron.reset();
    setPoAsking(false);
    setPoAskError(null);
    setPoDictating(false);
    setPoInterim("");
  };

  const startNew = () => {
    const s = initialMock(setIdx, strict);
    const { listenPaper: lp } = getMockPaperPair(listenPapers, readPapers, s.setIdx);
    resetLiveSessionState(lp);
    saveMock(s);
    setSaved(s);
    setM(s);
    writtenTimer.start(s.writtenLeftSec);
    sectionTimer.stop();
  };

  const resumeSaved = () => {
    if (!saved) return;
    const { listenPaper: lp } = getMockPaperPair(listenPapers, readPapers, saved.setIdx);
    resetLiveSessionState(lp);
    setM(saved);
    if (saved.stage === "co" || saved.stage === "ce" || saved.stage === "pe") writtenTimer.start(saved.writtenLeftSec);
    else writtenTimer.stop();
    if (saved.stage === "ce") sectionTimer.start(saved.ceLeftSec);
    else if (saved.stage === "pe") sectionTimer.start(saved.peLeftSec);
    else if (saved.stage === "po_prep") sectionTimer.start(saved.poPrepLeftSec ?? SPEAK_TIMES.prep);
    else if (saved.stage === "po_talk") sectionTimer.start(undefined, saved.poTalkSec ?? 0);
    else if (saved.stage === "po_debate") sectionTimer.start(undefined, saved.poDebateSec ?? 0);
    else sectionTimer.stop();
  };

  const haltAudio = () => {
    run.current++;
    skip.current?.();
    stopAudio();
    setCoPace(null);
  };

  const pauseCo = (e: number, label: string, sec: number, mine: number) =>
    new Promise<void>((done) => {
      let left = sec;
      const end = () => {
        window.clearInterval(id);
        skip.current = null;
        done();
      };
      const id = window.setInterval(() => {
        if (run.current !== mine || --left <= 0) return end();
        setCoPace({ e, label, left });
      }, 1000);
      skip.current = end;
      setCoPace({ e, label, left });
    });

  const playCoPaper = async (startFrom = 0) => {
    if (!m) return;
    const { listenPaper: lp } = getMockPaperPair(listenPapers, readPapers, m.setIdx);
    const mine = ++run.current;
    const alive = () => run.current === mine;
    for (let e = startFrom; e < lp.exs.length && alive(); e++) {
      const ex = lp.exs[e];
      const spec = FORM_SPEC[ex.form];
      for (const [d, doc] of ex.docs.entries()) {
        const prefix = ex.docs.length > 1 ? `练习 ${e + 1} 录音 ${d + 1}：` : `练习 ${e + 1}：`;
        await pauseCo(e, `${prefix}读题`, spec.read, mine);
        for (let n = 1; n <= spec.plays && alive(); n++) {
          setCoPace({ e, label: `${prefix}${spec.plays > 1 ? `第 ${n} 遍` : "放音中"}`, left: null });
          if (!(await sayMockDoc(doc.text, mine, run, coVoices[e]?.[d], lp.style ?? "natural", doc.audioUrl))) break;
          if (n < spec.plays) await pauseCo(e, `${prefix}两遍间隔`, BETWEEN_PLAYS, mine);
        }
        if (!alive()) return;
        await pauseCo(e, `${prefix}作答`, spec.answer, mine);
      }
      if (!alive()) return;
      update((cur) => ({ coHeard: { ...(cur.coHeard ?? {}), [e]: true } }));
    }
    setCoPace(null);
  };

  const finishCo = () => {
    if (!m) return;
    haltAudio();
    const { listenPaper: lp } = getMockPaperPair(listenPapers, readPapers, m.setIdx);
    const sc = scoreComp(lp.exs, m.coPicked);
    logExam({ part: "listen", what: `mock-${lp.id}`, score: sc, total: 25, level: "B2", scope: "full" });
    addMisses(collectCompMisses(lp.exs, "listen", m.coPicked, {}, Date.now()));
    const pooledSec = (READ_MINUTES.paper + 60) * 60;
    sectionTimer.start(pooledSec);
    update({ coScore: sc, stage: "ce", ceLeftSec: pooledSec, peLeftSec: pooledSec, ceAdvise60Shown: false });
  };

  const finishCe = () => {
    if (!m) return;
    const { readPaper: rp } = getMockPaperPair(listenPapers, readPapers, m.setIdx);
    const sc = scoreComp(rp.exs, m.cePicked, m.ceTyped ?? {});
    logExam({ part: "read", what: `mock-${rp.id}`, score: sc, total: 25, level: "B2", scope: "full" });
    addMisses(collectCompMisses(rp.exs, "read", m.cePicked, m.ceTyped ?? {}, Date.now()));
    const carrySec = sectionTimer.sec > 0 ? sectionTimer.sec : 60 * 60;
    sectionTimer.start(carrySec);
    update({ ceScore: sc, stage: "pe", ceLeftSec: carrySec, peLeftSec: carrySec });
  };

  const handleSubmitPe = async (fromTimeout = false) => {
    if (!m) return;
    sectionTimer.stop();
    const task: EssayTask = ESSAY_TASKS.find((t) => t.id === m.peTaskId) ?? ESSAY_TASKS.find((t) => t.level === "B2")!;
    if (!m.peText.trim() && !fromTimeout) return;
    if (hasAi && m.peText.trim()) {
      setPoBusy(true);
      try {
        const fb = await gradeEssay({ task, text: m.peText, points });
        saveEssay({ task: task.id, text: m.peText, fb, level: task.level });
        const sc = totalScore(fb);
        writtenTimer.stop();
        update({ peFb: fb, peScore: sc, stage: "break_po" });
      } catch (err) {
        toast((err as Error).message || "AI 批改失败，改用对照范文自评", "warn");
        saveEssay({ task: task.id, text: m.peText, level: task.level });
        writtenTimer.stop();
        update({ stage: "pe_grade" });
      } finally {
        setPoBusy(false);
      }
      return;
    }
    if (m.peText.trim()) saveEssay({ task: task.id, text: m.peText, level: task.level });
    writtenTimer.stop();
    update({ stage: "pe_grade" });
  };

  const confirmOfflinePe = (zeroBlank = false) => {
    if (!m) return;
    if (!zeroBlank && !rubricComplete(m.peSelf, CRITERIA)) return;
    const sc = zeroBlank ? 0 : rubricSum(m.peSelf, CRITERIA);
    logExam({ part: "essay", what: m.peTaskId, score: sc, total: 25, level: "B2", scope: "full", ...(zeroBlank ? {} : { unverified: true }) });
    update({
      ...(zeroBlank ? { peSelf: Object.fromEntries(CRITERIA.map((k) => [k, 0])) } : {}),
      peScore: sc,
      stage: "break_po",
    });
  };

  // PO helpers
  const hear = (into: (t: string) => void, start = "") => {
    setPoDictating(true);
    stopRec.current = dictate(
      (final, guess) => {
        into(start + final);
        setPoInterim(guess);
      },
      (err) => {
        setPoDictating(false);
        setPoInterim("");
        if (err) toast(err, "warn");
      },
    );
  };

  const chooseSubject = (s: SpeakingSubject) => {
    sectionTimer.start(SPEAK_TIMES.prep);
    setPoPresetIdx(0);
    setPoAskError(null);
    setPoTalkTake(null);
    pron.reset();
    update({
      poSubjectId: s.id,
      poNotes: "",
      poSaid: "",
      poVoiceSaid: "",
      poMonologueSec: 0,
      poRecordedVoice: false,
      poTurns: [],
      poTyped: !dictation,
      stage: "po_prep",
    });
  };

  const startPoTalk = async () => {
    stopRec.current?.();
    stopRec.current = null;
    sectionTimer.stop();
    pron.reset();
    setPoTalkTake(null);
    if (recorder.supported) await recorder.start();
    sectionTimer.start(); // count up for monologue 5-7m
    update({ stage: "po_talk", poSaid: "", poVoiceSaid: "", poMonologueSec: 0, poRecordedVoice: false, poTyped: !dictation });
    if (dictation) hear((txt) => update({ poSaid: txt, poVoiceSaid: txt, poTyped: resolveMockPoTyped({ finalSaid: txt, voiceSaid: txt }) }));
  };

  const redictatePoReview = () => {
    if (!dictation) return;
    if (poDictating) {
      stopRec.current?.();
      stopRec.current = null;
      setPoDictating(false);
      setPoInterim("");
      return;
    }
    update({ poSaid: "", poVoiceSaid: "", poTyped: true });
    hear((txt) => update({ poSaid: txt, poVoiceSaid: txt, poTyped: resolveMockPoTyped({ finalSaid: txt, voiceSaid: txt }) }));
  };

  const endPoTalk = async () => {
    stopRec.current?.();
    stopRec.current = null;
    setPoDictating(false);
    setPoInterim("");
    const monoSec = sectionTimer.sec;
    sectionTimer.stop();
    const take = recorder.supported ? await recorder.stop() : null;
    setPoTalkTake(take);
    if (take && m) {
      const subj = SPEAKING_SUBJECTS.find((s) => s.id === m.poSubjectId);
      void keepRecording({ label: subj?.title ?? m.poSubjectId, seconds: take.seconds, blob: take.blob, bucket: "exam" });
    }
    const goStrictDebate = Boolean(m?.strict);
    const subj = SPEAKING_SUBJECTS.find((s) => s.id === m?.poSubjectId) ?? SPEAKING_SUBJECTS[0];
    if (goStrictDebate) {
      update({ stage: "po_debate", poMonologueSec: monoSec, poTalkSec: monoSec, ...(take ? { poRecordedVoice: true } : {}) });
      sectionTimer.start();
    } else {
      update({ stage: "po_review", poMonologueSec: monoSec, poTalkSec: monoSec, ...(take ? { poRecordedVoice: true } : {}) });
    }
    let gotNeuralTranscript = false;
    if (take && (pron.available || ready.stt())) {
      const res = await pron.run(take.blob);
      if (res) {
        const autoPhono = phonoLevel(res);
        const neuralTxt = (res.lexicalText || res.text || "").trim();
        if (neuralTxt) gotNeuralTranscript = true;
        update((cur) => {
          const nextVoice = neuralTxt || cur.poVoiceSaid || "";
          const nextSaid = neuralTxt || cur.poSaid;
          return {
            ...(nextVoice ? { poVoiceSaid: nextVoice } : {}),
            ...(nextSaid ? { poSaid: nextSaid } : {}),
            ...(nextVoice ? { poTyped: resolveMockPoTyped({ finalSaid: nextSaid, voiceSaid: nextVoice }) } : {}),
            ...(autoPhono !== null ? { poPhono: autoPhono } : {}),
          };
        });
      }
    }
    if (take && !gotNeuralTranscript && ready.stt()) {
      setPoTranscribing(true);
      try {
        const txt = await transcribeAudio(take.blob);
        if (txt.trim()) {
          update(() => {
            const nextVoice = txt.trim();
            const nextSaid = txt.trim();
            return {
              poVoiceSaid: nextVoice,
              poSaid: nextSaid,
              poTyped: resolveMockPoTyped({ finalSaid: nextSaid, voiceSaid: nextVoice }),
            };
          });
        }
      } catch (err) {
        toast((err as Error).message || "Whisper 转写失败，请手动补充文字", "warn");
      } finally {
        setPoTranscribing(false);
      }
    }
    if (goStrictDebate) {
      void askNextExaminer([], subj);
    }
  };

  const beginDebateTurn = async (turnIdx: number) => {
    stopAudio();
    if (recorder.supported && !recorder.on) await recorder.start();
    if (dictation && !poDebateSpeechFailedRef.current) {
      stopRec.current?.();
      setPoDictating(true);
      stopRec.current = dictate(
        (final, guess) => {
          setPoInterim(guess);
          if (final.trim()) {
            update((cur) => ({
              poDebateVoice: true,
              poTurns: cur.poTurns.map((t, idx) => (idx === turnIdx ? { ...t, a: final } : t)),
            }));
          }
        },
        (err) => {
          setPoDictating(false);
          setPoInterim("");
          if (err) {
            poDebateSpeechFailedRef.current = true;
            setPoDebateSpeechFailed(true);
            toast(`${err}${pron.available || ready.stt() ? "（已继续录音，停止后自动转写）" : "（已继续录音）"}`, "warn");
          }
        },
      );
    }
  };

  const stopDebateTurn = async (turnIdx: number): Promise<DebateTurn[]> => {
    stopRec.current?.();
    stopRec.current = null;
    setPoDictating(false);
    setPoInterim("");
    const take = recorder.on ? await recorder.stop() : null;
    if (take) {
      const nextTakes = { ...poTurnTakesRef.current, [turnIdx]: take };
      poTurnTakesRef.current = nextTakes;
      setPoTurnTakes(nextTakes);
    }
    const curTurns = latestMockRef.current.m?.poTurns ?? [];
    const applyTurnStt = (txt: string): DebateTurn[] => {
      const next = (latestMockRef.current.m?.poTurns ?? []).map((t, k) =>
        k === turnIdx ? { ...t, a: txt.trim() } : t,
      );
      update({ poDebateVoice: true, poTurns: next });
      return next;
    };
    if (take && (pron.available || ready.stt())) {
      setPoTranscribing(true);
      try {
        const pr = await assessRecording(take.blob);
        if (pr) {
          poTurnPronsRef.current = { ...poTurnPronsRef.current, [turnIdx]: pr };
          const neuralTxt = (pr.lexicalText || pr.text || "").trim();
          if (neuralTxt) return applyTurnStt(neuralTxt);
        }
      } catch (err) {
        if (!ready.stt()) toast((err as Error).message || "语音转写失败，可回放录音补充文字", "warn");
      } finally {
        setPoTranscribing(false);
      }
    }
    if (take && !(poTurnPronsRef.current[turnIdx]?.text?.trim()) && ready.stt()) {
      setPoTranscribing(true);
      try {
        const txt = await transcribeAudio(take.blob);
        if (txt.trim()) return applyTurnStt(txt);
      } catch (err) {
        toast((err as Error).message || "Whisper 转写失败，可回放录音手动补充文字", "warn");
      } finally {
        setPoTranscribing(false);
      }
    }
    return latestMockRef.current.m?.poTurns ?? curTurns;
  };

  const askNextExaminer = async (so: DebateTurn[], subject: SpeakingSubject) => {
    const live = latestMockRef.current.m;
    if (!live) return;
    let currentTurns = so;
    if (so.length > 0 && (recorder.on || stopRec.current)) {
      currentTurns = await stopDebateTurn(so.length - 1);
    } else {
      stopRec.current?.();
      stopRec.current = null;
      setPoDictating(false);
      setPoInterim("");
    }
    stopAudio();
    setPoAskError(null);
    if (hasAi) {
      setPoAsking(true);
      const c = new AbortController();
      ctrl.current = c;
      try {
        const q = await debateQuestion({ subject, monologue: live.poSaid, turns: currentTurns, minutes: Math.floor(sectionTimer.sec / 60), strict: live.strict }, c.signal);
        if (c.signal.aborted) return;
        const nextTurns = [...currentTurns, { q, a: "" }];
        update({ poTurns: nextTurns });
        setPoAsking(false);
        const r = await speakExaminer(q, currentTurns.length, live.setIdx, ai, c.signal);
        if (r !== "stopped" && !stopRec.current && !c.signal.aborted) {
          void beginDebateTurn(nextTurns.length - 1);
        }
      } catch (err) {
        if (c.signal.aborted) return;
        setPoAsking(false);
        const msg = (err as Error).message || "考官追问失败";
        setPoAskError(msg);
        toast(msg, "warn");
      }
      return;
    }
    const preset = speakingPresetOf(subject.id);
    const followUps = preset?.followUps ?? [];
    const item = followUps[poPresetIdx];
    if (!item) return finishPoDebate(currentTurns, subject);
    setPoPresetIdx((i) => i + 1);
    const nextTurns = [...currentTurns, { q: item.q, a: "" }];
    update({ poTurns: nextTurns });
    const r = await speakExaminer(item.q, currentTurns.length, live.setIdx, ai);
    if (r !== "stopped" && !stopRec.current) {
      void beginDebateTurn(nextTurns.length - 1);
    }
  };

  const startPoDebate = (subject: SpeakingSubject) => {
    stopRec.current?.();
    stopRec.current = null;
    setPoDictating(false);
    setPoInterim("");
    poTurnTakesRef.current = {};
    setPoTurnTakes({});
    poTurnPronsRef.current = {};
    poDebateSpeechFailedRef.current = false;
    setPoDebateSpeechFailed(false);
    sectionTimer.start();
    setPoPresetIdx(0);
    setPoAskError(null);
    update({ stage: "po_debate", poDebateVoice: false, poDebateSec: 0 });
    void askNextExaminer([], subject);
  };

  const finishPoDebate = async (so: DebateTurn[], subject: SpeakingSubject) => {
    if (!latestMockRef.current.m) return;
    let finalTurns = so;
    if (so.length > 0 && (recorder.on || stopRec.current)) {
      finalTurns = await stopDebateTurn(so.length - 1);
    } else {
      stopRec.current?.();
      stopRec.current = null;
    }
    stopAudio();
    const debateSec = sectionTimer.sec;
    sectionTimer.stop();
    setPoAskError(null);
    const cur = latestMockRef.current.m ?? m!;
    const answeredTurns = finalTurns.filter((t) => t.a.trim());
    const voiceSaid = cur.poVoiceSaid ?? (cur.poTyped ? "" : cur.poSaid);
    const debateVoiceUsed = Boolean(cur.poDebateVoice || Object.keys(poTurnPronsRef.current).length > 0);
    const finalTyped = isMockPoTyped({
      hasAiFb: hasAi,
      finalSaid: cur.poSaid,
      voiceSaid,
      recordedVoice: cur.poRecordedVoice,
      answeredTurns: answeredTurns.length,
      debateVoice: debateVoiceUsed,
    });
    const debateProns = Object.values(poTurnPronsRef.current);
    const combinedPron = combineSpeakingProns(pron.state === "done" ? pron.result : null, debateProns);
    const autoPhono = combinedPron ? phonoLevel(combinedPron) : null;
    const acoustics = combinedPron ? summarizeAcoustics(combinedPron, cur.poNotes) : undefined;
    if (hasAi) {
      setPoBusy(true);
      const c = new AbortController();
      ctrl.current = c;
      try {
        const fb = await gradeSpeaking(
          {
            subject,
            transcript: cur.poSaid,
            turns: answeredTurns,
            points,
            monologueWords: countWords(cur.poSaid),
            monologueSec: cur.poMonologueSec ?? Math.max(0, poTalkTake?.seconds ?? 0),
            debateSec,
            typed: finalTyped,
            ...(acoustics ? { acoustics } : {}),
          },
          c.signal,
        );
        if (fb.corrections.length) saveSpeakingCorrections(subject.title, fb.corrections);
        update({ poFb: fb, poTyped: finalTyped, poPhono: autoPhono !== null ? autoPhono : cur.poPhono, poDebateSec: debateSec, stage: "po_grade" });
      } catch (err) {
        if (c.signal.aborted) return;
        toast((err as Error).message || "口语批改失败，改用自评量表", "warn");
        update({ poFb: null, ...(autoPhono !== null ? { poSelf: { ...cur.poSelf, phono: cur.poSelf.phono ?? autoPhono } } : {}), poDebateSec: debateSec, stage: "po_grade" });
      } finally {
        setPoBusy(false);
      }
      return;
    }
    update({ poFb: null, ...(autoPhono !== null ? { poSelf: { ...cur.poSelf, phono: cur.poSelf.phono ?? autoPhono } } : {}), poDebateSec: debateSec, stage: "po_grade" });
  };

  const confirmPoScore = () => {
    if (!m) return;
    const poKeys = [...SPEAK_CRITERIA, "phono"] as const;
    if (!m.poFb && !rubricComplete(m.poSelf, poKeys)) return;
    if (m.poFb && m.poPhono === null) return;
    const voiceSaid = m.poVoiceSaid ?? (m.poTyped ? "" : m.poSaid);
    const answeredTurnsCount = m.poTurns.filter((t) => t.a.trim()).length;
    const debateVoiceUsed = Boolean(m.poDebateVoice || Object.keys(poTurnPronsRef.current).length > 0);
    const finalTyped = isMockPoTyped({
      hasAiFb: !!m.poFb,
      finalSaid: m.poSaid,
      voiceSaid,
      recordedVoice: m.poRecordedVoice,
      answeredTurns: answeredTurnsCount,
      debateVoice: debateVoiceUsed,
    });
    const sc = m.poFb ? totalScore(m.poFb) + (m.poPhono ?? 0) : rubricSum(m.poSelf, poKeys);
    logExam({ part: "speak", what: `mock-${m.poSubjectId}`, score: sc, total: 25, level: "B2", scope: "full", ...(finalTyped ? { typed: true } : {}), ...(!m.poFb ? { unverified: true } : {}) });
    const co = m.coScore;
    const ce = m.ceScore;
    const pe = m.peScore;
    const total100 = co !== null && ce !== null && pe !== null ? Math.round((co + ce + pe + sc) * 10) / 10 : null;
    saveMockRecord({
      at: Date.now(),
      setIdx: m.setIdx,
      label: paperOptions[m.setIdx]?.label ?? `套卷 ${m.setIdx + 1}`,
      strict: m.strict,
      co,
      ce,
      pe,
      po: sc,
      total100,
      peTaskId: m.peTaskId,
      poSubjectId: m.poSubjectId,
      ...(finalTyped ? { typedPo: true } : {}),
    });
    setSaved(null);
    update({ poTyped: finalTyped, poScore: sc, stage: "summary" });
  };

  const weakGramTitles = useMemo(
    () =>
      Object.entries(progress.gramTags ?? {})
        .filter(([, v]) => v.w > 0)
        .sort((a, b) => b[1].w - a[1].w)
        .map(([k]) => pointTitle.get(k.split("|")[0]) ?? k.split("|")[0])
        .filter((v, i, arr) => Boolean(v) && arr.indexOf(v) === i)
        .slice(0, 6),
    [progress.gramTags, pointTitle],
  );

  const exportDiagnostic = (rec: Pick<MockRecord, "at" | "label" | "strict" | "co" | "ce" | "pe" | "po" | "total100" | "typedPo">) => {
    const ok = openMockDiagnosticPrint({
      record: rec,
      target,
      readiness: examReadiness(progress.examLog, target),
      topCauses: missStats(progress.compMisses ?? []),
      weakGrammarTitles: weakGramTitles,
    });
    toast(ok ? "已唤起 A4 模考诊断报告打印 / 存储 PDF" : "当前环境不支持打印窗口", ok ? "ok" : "warn");
  };

  const generateWeeklyPlan = () => {
    const plan = buildWeeklyRemediation({
      log: progress.examLog,
      compMisses: progress.compMisses,
      essayNotes: progress.essayNotes,
      gramTags: progress.gramTags,
      target,
    });
    saveWeeklyPlan(plan);
    toast("已生成本周 7 天专项提分计划，已同步到今日看板", "ok");
  };

  if (!m) {
    return (
      <MockSetup
        paperOptions={paperOptions}
        setIdx={setIdx}
        setSetIdx={setSetIdx}
        strict={strict}
        setStrict={setStrict}
        saved={saved}
        lastSummary={lastSummary}
        mockRecords={mockRecords}
        examLog={progress.examLog}
        weeklyPlan={progress.weeklyPlan}
        onExit={onExit}
        onResumeSaved={resumeSaved}
        onViewLastSummary={(sum) => setM(sum)}
        onStartNew={startNew}
        onGenerateWeeklyPlan={generateWeeklyPlan}
        onExportDiagnostic={exportDiagnostic}
      />
    );
  }

  const { listenPaper: lp, readPaper: rp } = getMockPaperPair(listenPapers, readPapers, m.setIdx);
  const peTask: EssayTask = ESSAY_TASKS.find((t) => t.id === m.peTaskId) ?? ESSAY_TASKS.find((t) => t.level === "B2")!;
  const poSubject = SPEAKING_SUBJECTS.find((s) => s.id === m.poSubjectId) ?? SPEAKING_SUBJECTS[0];
  const poPreset = speakingPresetOf(poSubject.id);
  const writtenPhase = m.stage === "co" || m.stage === "ce" || m.stage === "pe";

  return (
    <div className="page practice">
      <section className="essay-stage">
        <header className="exam-top">
          <button
            className="btn btn-ghost"
            onClick={() => {
              haltAudio();
              stopRec.current?.();
              ctrl.current?.abort();
              if (m.stage !== "summary") saveMock(withClocks(m));
              writtenTimer.stop();
              sectionTimer.stop();
              setPoAsking(false);
              setPoAskError(null);
              setPoDictating(false);
              setPoInterim("");
              setSaved(loadMock());
              setM(null);
            }}
          >
            {m.stage === "summary" ? "返回设置" : "退出模考（进度保留）"}
          </button>
          <span className="eyebrow">
            全真模考 · 套卷 {m.setIdx + 1} · {m.strict ? "严格模式" : "自由模式"}
          </span>
          {writtenPhase && (
            <span className="exam-clock">
              2h30 笔试余 {clock(writtenTimer.sec)}
              {(m.stage === "ce" || m.stage === "pe") && ` · 本科余 ${clock(sectionTimer.sec)}`}
            </span>
          )}
        </header>

        <ol className="mock-steps" aria-label="模考阶段">
          <li className={m.stage === "co" ? "is-now" : m.coScore !== null ? "is-done" : ""}>1. CO 听力 {m.coScore !== null ? `(${num(m.coScore)}/25)` : ""}</li>
          <li className={m.stage === "ce" ? "is-now" : m.ceScore !== null ? "is-done" : ""}>2. CE 阅读 {m.ceScore !== null ? `(${num(m.ceScore)}/25)` : ""}</li>
          <li className={m.stage === "pe" || m.stage === "pe_grade" ? "is-now" : m.peScore !== null ? "is-done" : ""}>3. PE 写作 {m.peScore !== null ? `(${num(m.peScore)}/25)` : ""}</li>
          <li className={m.stage.startsWith("po") || m.stage === "break_po" ? "is-now" : m.poScore !== null ? "is-done" : ""}>4. PO 口语 {m.poScore !== null ? `(${num(m.poScore)}/25)` : ""}</li>
        </ol>

        <MockWritten
          m={m}
          lp={lp}
          rp={rp}
          peTask={peTask}
          coHeard={coHeard}
          coPace={coPace}
          ceHl={ceHl}
          setCeHl={setCeHl}
          ceStruck={ceStruck}
          setCeStruck={setCeStruck}
          toggleCeStrike={toggleCeStrike}
          sectionTimerSec={sectionTimer.sec}
          poBusy={poBusy}
          hasAi={hasAi}
          pointTitle={pointTitle}
          update={update}
          onSkipCoWait={() => skip.current?.()}
          onHaltAudio={haltAudio}
          onPlayCoPaper={(startFrom = 0) => void playCoPaper(startFrom)}
          onFinishCo={finishCo}
          onFinishCe={finishCe}
          onSubmitPe={(fromTimeout = false) => void handleSubmitPe(fromTimeout)}
          onConfirmOfflinePe={confirmOfflinePe}
        />

        <MockSpeaking
          m={m}
          poSubject={poSubject}
          poPreset={poPreset}
          sectionTimerSec={sectionTimer.sec}
          dictation={dictation}
          sttReady={ready.stt(ai)}
          hasAi={hasAi}
          poDictating={poDictating}
          poInterim={poInterim}
          poTranscribing={poTranscribing}
          poAsking={poAsking}
          poAskError={poAskError}
          poBusy={poBusy}
          poDebateSpeechFailed={poDebateSpeechFailed}
          poTalkTake={poTalkTake}
          poTurnTakes={poTurnTakes}
          recorder={recorder}
          pron={pron}
          pointTitle={pointTitle}
          update={update}
          onChooseSubject={chooseSubject}
          onStartPoTalk={() => void startPoTalk()}
          onEndPoTalk={() => void endPoTalk()}
          onRedictatePoReview={redictatePoReview}
          onStartPoDebate={() => startPoDebate(poSubject)}
          onAskNextExaminer={(so) => void askNextExaminer(so, poSubject)}
          onFinishPoDebate={(so) => void finishPoDebate(so, poSubject)}
          onBeginDebateTurn={(turnIdx) => void beginDebateTurn(turnIdx)}
          onStopDebateTurn={(turnIdx) => void stopDebateTurn(turnIdx)}
          onConfirmPoScore={confirmPoScore}
        />

        {m.stage === "summary" && (
          <SummaryView
            mock={m}
            lp={lp}
            rp={rp}
            peTask={peTask}
            poSubject={poSubject}
            pointTitle={pointTitle}
            target={target}
            onExit={onExit}
            onAgain={() => setM(null)}
            onPrint={() =>
              exportDiagnostic({
                at: Date.now(),
                label: paperOptions[m.setIdx]?.label ?? `套卷 ${m.setIdx + 1}`,
                strict: m.strict,
                co: m.coScore,
                ce: m.ceScore,
                pe: m.peScore,
                po: m.poScore,
                total100:
                  m.coScore !== null && m.ceScore !== null && m.peScore !== null && m.poScore !== null
                    ? Math.round((m.coScore + m.ceScore + m.peScore + m.poScore) * 10) / 10
                    : null,
                typedPo: m.poTyped,
              })
            }
            onBuildPlan={generateWeeklyPlan}
          />
        )}
      </section>
    </div>
  );
}
