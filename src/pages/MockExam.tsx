import { AlertTriangle, ArrowLeft, ArrowRight, FastForward, Mic, Play, PlayCircle, RotateCcw, Square, Volume2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ready, useAiConfig } from "../ai/config";
import { buildDialogueSsmlBatches } from "../ai/ssml";
import { debateQuestion, gradeEssay, gradeSpeaking } from "../ai/tasks";
import { speakerVoices, ttsOn, ttsSsmlUrl, ttsUrl } from "../ai/tts";
import { useGrammar } from "../atlas/grammar";
import { play, stopAudio } from "../lib/audio";
import { countWords, CRITERIA, CRITERION_CHECK, CRITERION_LABEL, ESSAY_TASKS, GENRE_LABEL, LEVELS, totalScore, type EssayFeedback, type EssayTask } from "../lib/essay";
import { BETWEEN_PLAYS, clock, examReadiness, FORM_SPEC, PART_LABEL, READ_MINUTES, REAL_WPM, speechChunks, speechTurns, SPEAK_CRITERIA, SPEAK_TIMES, SPEAKING_SUBJECTS, topicOf, type CompExercise, type DebateTurn, type SpeakingFeedback, type SpeakingSubject } from "../lib/exam";
import { PRESET_PAPERS } from "../lib/exam-presets";
import { pickVoices, type DocVoices } from "../lib/listening";
import { canDictate, dictate } from "../lib/speech";
import { speakingPresetOf } from "../lib/speaking-presets";
import { useTimer } from "../lib/timer";
import { logExam, saveEssay } from "../store/essays";
import { useStore } from "../store/store";
import { AccentKeys } from "../ui/AccentKeys";
import { Marking } from "../ui/Marking";
import { StaticEssayModel } from "../ui/StaticEssayModel";
import { toast } from "../ui/Toast";

type MockStage = "setup" | "co" | "ce" | "pe" | "pe_grade" | "break_po" | "po_choose" | "po_prep" | "po_talk" | "po_review" | "po_debate" | "po_grade" | "summary";

interface MockState {
  setIdx: 0 | 1;
  strict: boolean;
  stage: MockStage;
  coPicked: Record<string, number>;
  coScore: number | null;
  cePicked: Record<string, number>;
  ceScore: number | null;
  peTaskId: string;
  peText: string;
  peFb: EssayFeedback | null;
  peSelf: Record<string, number>;
  peScore: number | null;
  poDrawnIds: string[];
  poSubjectId: string;
  poNotes: string;
  poSaid: string;
  poTurns: DebateTurn[];
  poSelf: Record<string, number>;
  poFb: SpeakingFeedback | null;
  poPhono: number | null;
  poTyped: boolean;
  poScore: number | null;
  writtenLeftSec: number;
  ceLeftSec: number;
  peLeftSec: number;
}

const MOCK_KEY = "fb2.mock.v1";
const num = (n: number) => String(n).replace(".", ",");
const emptyRubric = (keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, 3]));
const rubricSum = (m: Record<string, number>, keys: readonly string[]) => keys.reduce((n, k) => n + (m[k] ?? 0), 0);

function initialMock(setIdx: 0 | 1, strict: boolean): MockState {
  const b2Essays = ESSAY_TASKS.filter((t) => t.level === "B2");
  const peTask = b2Essays[(setIdx * 3 + Math.floor(Math.random() * b2Essays.length)) % b2Essays.length];
  const drawn = [...SPEAKING_SUBJECTS].sort(() => Math.random() - 0.5).slice(0, 2);
  return {
    setIdx,
    strict,
    stage: "co",
    coPicked: {},
    coScore: null,
    cePicked: {},
    ceScore: null,
    peTaskId: peTask.id,
    peText: "",
    peFb: null,
    peSelf: emptyRubric(CRITERIA),
    peScore: null,
    poDrawnIds: drawn.map((d) => d.id),
    poSubjectId: drawn[0].id,
    poNotes: "",
    poSaid: "",
    poTurns: [],
    poSelf: emptyRubric([...SPEAK_CRITERIA, "phono"]),
    poFb: null,
    poPhono: null,
    poTyped: !canDictate(),
    poScore: null,
    writtenLeftSec: 150 * 60,
    ceLeftSec: READ_MINUTES.paper * 60,
    peLeftSec: 60 * 60,
  };
}

function loadMock(): MockState | null {
  try {
    const raw = localStorage.getItem(MOCK_KEY);
    return raw ? (JSON.parse(raw) as MockState) : null;
  } catch {
    return null;
  }
}

function saveMock(s: MockState | null) {
  try {
    if (s) localStorage.setItem(MOCK_KEY, JSON.stringify(s));
    else localStorage.removeItem(MOCK_KEY);
  } catch {
    /* ignore storage quota failure */
  }
}

const scoreComp = (exs: CompExercise[], picked: Record<string, number>) => {
  let s = 0;
  exs.forEach((ex, e) =>
    ex.questions.forEach((q, k) => {
      if (picked[`${e}-${k}`] === q.answer) s += q.pts;
    }),
  );
  return Math.round(s * 10) / 10;
};

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

  const [saved, setSaved] = useState<MockState | null>(() => loadMock());
  const [setIdx, setSetIdx] = useState<0 | 1>(0);
  const [strict, setStrict] = useState(true);
  const [m, setM] = useState<MockState | null>(null);

  // CO playback state
  const [coVoices, setCoVoices] = useState<DocVoices[][]>([]);
  const [coPace, setCoPace] = useState<{ e: number; label: string; left: number | null } | null>(null);
  const [coHeard, setCoHeard] = useState<Record<number, boolean>>({});
  const run = useRef(0);
  const skip = useRef<(() => void) | null>(null);

  // Timers
  const writtenTimer = useTimer();
  const sectionTimer = useTimer();
  const peInput = useRef<HTMLTextAreaElement>(null);

  // PO live state
  const [poDictating, setPoDictating] = useState(false);
  const [poInterim, setPoInterim] = useState("");
  const [poAsking, setPoAsking] = useState(false);
  const [poPresetIdx, setPoPresetIdx] = useState(0);
  const [poBusy, setPoBusy] = useState(false);
  const stopRec = useRef<(() => void) | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const dictation = canDictate();

  const listenPapers = useMemo(() => PRESET_PAPERS.filter((p) => p.kind === "listen"), []);
  const readPapers = useMemo(() => PRESET_PAPERS.filter((p) => p.kind === "read"), []);
  const points = useMemo(() => (grammar?.points ?? []).map((p) => ({ id: p.id, title: p.title })), [grammar]);
  const pointTitle = useMemo(() => new Map(points.map((p) => [p.id, p.title])), [points]);

  const update = (patch: Partial<MockState>) => {
    setM((cur) => {
      if (!cur) return cur;
      const next = { ...cur, ...patch };
      saveMock(next.stage === "summary" ? null : next);
      return next;
    });
  };

  useEffect(
    () => () => {
      run.current++;
      stopRec.current?.();
      ctrl.current?.abort();
      stopAudio();
    },
    [],
  );

  // Sync remaining clocks into persisted state periodically
  useEffect(() => {
    if (!m) return;
    if (m.stage === "co" || m.stage === "ce" || m.stage === "pe") {
      const next: Partial<MockState> = { writtenLeftSec: writtenTimer.sec };
      if (m.stage === "ce") next.ceLeftSec = sectionTimer.sec;
      if (m.stage === "pe") next.peLeftSec = sectionTimer.sec;
      saveMock({ ...m, ...next });
    }
  }, [m, writtenTimer.sec, sectionTimer.sec]);

  // Auto-lock & submit on timeout for CE / PE
  useEffect(() => {
    if (!m || !sectionTimer.down || sectionTimer.sec > 0) return;
    if (m.stage === "ce") {
      const rp = readPapers[m.setIdx] ?? readPapers[0];
      const sc = scoreComp(rp.exs, m.cePicked);
      logExam({ part: "read", what: `mock-${rp.id}`, score: sc, total: 25 });
      toast(`阅读 60 分钟时间到，已自动锁卷交卷（${num(sc)}/25），进入写作！`, "info");
      sectionTimer.start(m.peLeftSec);
      update({ ceScore: sc, stage: "pe", ceLeftSec: 0 });
    } else if (m.stage === "pe" && !poBusy) {
      toast("写作 60 分钟时间到，已自动锁卷提交！", "info");
      void handleSubmitPe(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionTimer.sec, sectionTimer.down, m?.stage]);

  const startNew = () => {
    const s = initialMock(setIdx, strict);
    const lp = listenPapers[s.setIdx] ?? listenPapers[0];
    setCoVoices(lp.exs.map((ex) => ex.docs.map(() => (azure ? pickVoices("mixed") : { voices: speakerVoices(), accents: [] }))));
    setCoHeard({});
    setCoPace(null);
    saveMock(s);
    setSaved(s);
    setM(s);
    writtenTimer.start(s.writtenLeftSec);
    sectionTimer.stop();
  };

  const resumeSaved = () => {
    if (!saved) return;
    const lp = listenPapers[saved.setIdx] ?? listenPapers[0];
    setCoVoices(lp.exs.map((ex) => ex.docs.map(() => (azure ? pickVoices("mixed") : { voices: speakerVoices(), accents: [] }))));
    setM(saved);
    if (saved.stage === "co" || saved.stage === "ce" || saved.stage === "pe") writtenTimer.start(saved.writtenLeftSec);
    if (saved.stage === "ce") sectionTimer.start(saved.ceLeftSec);
    if (saved.stage === "pe") sectionTimer.start(saved.peLeftSec);
  };

  const haltAudio = () => {
    run.current++;
    skip.current?.();
    stopAudio();
    setCoPace(null);
  };

  const sayDoc = async (text: string, mine: number, dv?: DocVoices, style: "radio" | "natural" = "natural") => {
    const pool = dv && dv.voices.length >= 3 ? dv.voices : speakerVoices();
    if (ttsOn()) {
      try {
        const batches = buildDialogueSsmlBatches(speechTurns(text), pool, { style });
        const urls = await Promise.all(batches.map((ssml) => ttsSsmlUrl(ssml)));
        if (run.current !== mine) return false;
        for (const u of urls) {
          const r = await play(u, "", "uk", 1);
          if (run.current !== mine || r === "stopped" || r === "unsupported") return false;
        }
        return true;
      } catch {
        if (run.current !== mine) return false;
      }
    }
    const chunks = speechChunks(text);
    const urls = ttsOn() ? await Promise.all(chunks.map((c) => ttsUrl(c.t, pool[c.who % pool.length]).catch(() => ""))) : [];
    if (run.current !== mine) return false;
    for (const [k, c] of chunks.entries()) {
      const r = await play(urls[k] || null, c.t, "uk", REAL_WPM / 177, c.who);
      if (run.current !== mine || r === "stopped" || r === "unsupported") return false;
    }
    return true;
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
    const lp = listenPapers[m.setIdx] ?? listenPapers[0];
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
          if (!(await sayDoc(doc.text, mine, coVoices[e]?.[d], lp.style ?? "natural"))) break;
          if (n < spec.plays) await pauseCo(e, `${prefix}两遍间隔`, BETWEEN_PLAYS, mine);
        }
        if (!alive()) return;
        await pauseCo(e, `${prefix}作答`, spec.answer, mine);
      }
      if (!alive()) return;
      setCoHeard((h) => ({ ...h, [e]: true }));
    }
    setCoPace(null);
  };

  const finishCo = () => {
    if (!m) return;
    haltAudio();
    const lp = listenPapers[m.setIdx] ?? listenPapers[0];
    const sc = scoreComp(lp.exs, m.coPicked);
    logExam({ part: "listen", what: `mock-${lp.id}`, score: sc, total: 25 });
    const ceSec = READ_MINUTES.paper * 60;
    sectionTimer.start(ceSec);
    update({ coScore: sc, stage: "ce", ceLeftSec: ceSec });
  };

  const finishCe = () => {
    if (!m) return;
    const rp = readPapers[m.setIdx] ?? readPapers[0];
    const sc = scoreComp(rp.exs, m.cePicked);
    logExam({ part: "read", what: `mock-${rp.id}`, score: sc, total: 25 });
    const peSec = 60 * 60;
    sectionTimer.start(peSec);
    update({ ceScore: sc, stage: "pe", peLeftSec: peSec });
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
        saveEssay({ task: task.id, text: m.peText, fb });
        const sc = totalScore(fb);
        writtenTimer.stop();
        update({ peFb: fb, peScore: sc, stage: "break_po" });
      } catch (err) {
        toast((err as Error).message || "AI 批改失败，改用对照范文自评", "warn");
        saveEssay({ task: task.id, text: m.peText });
        writtenTimer.stop();
        update({ stage: "pe_grade" });
      } finally {
        setPoBusy(false);
      }
      return;
    }
    if (m.peText.trim()) saveEssay({ task: task.id, text: m.peText });
    writtenTimer.stop();
    update({ stage: "pe_grade" });
  };

  const confirmOfflinePe = () => {
    if (!m) return;
    const sc = rubricSum(m.peSelf, CRITERIA);
    logExam({ part: "essay", what: m.peTaskId, score: sc, total: 25 });
    update({ peScore: sc, stage: "break_po" });
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
    update({ poSubjectId: s.id, poNotes: "", poSaid: "", poTurns: [], stage: "po_prep" });
  };

  const startPoTalk = () => {
    sectionTimer.stop();
    sectionTimer.start(); // count up for monologue 5-7m
    update({ stage: "po_talk", poTyped: !dictation });
    if (dictation) hear((txt) => update({ poSaid: txt, poTyped: false }));
  };

  const endPoTalk = () => {
    stopRec.current?.();
    stopRec.current = null;
    setPoDictating(false);
    setPoInterim("");
    sectionTimer.stop();
    update({ stage: "po_review" });
  };

  const askNextExaminer = async (so: DebateTurn[], subject: SpeakingSubject) => {
    if (!m) return;
    if (hasAi) {
      setPoAsking(true);
      const c = new AbortController();
      ctrl.current = c;
      try {
        const q = await debateQuestion({ subject, monologue: m.poSaid, turns: so, minutes: Math.floor(sectionTimer.sec / 60) }, c.signal);
        if (c.signal.aborted) return;
        const nextTurns = [...so, { q, a: "" }];
        update({ poTurns: nextTurns });
        setPoAsking(false);
        const r = await play(null, q);
        if (r !== "stopped" && dictation && !stopRec.current) {
          hear((a) => update({ poTurns: nextTurns.map((t, idx) => (idx === nextTurns.length - 1 ? { ...t, a } : t)) }));
        }
      } catch (err) {
        setPoAsking(false);
        toast((err as Error).message || "考官追问失败", "warn");
      }
      return;
    }
    const preset = speakingPresetOf(subject.id);
    const followUps = preset?.followUps ?? [];
    const item = followUps[poPresetIdx];
    if (!item) return finishPoDebate(so, subject);
    setPoPresetIdx((i) => i + 1);
    const nextTurns = [...so, { q: item.q, a: "" }];
    update({ poTurns: nextTurns });
    const r = await play(null, item.q);
    if (r !== "stopped" && dictation && !stopRec.current) {
      hear((a) => update({ poTurns: nextTurns.map((t, idx) => (idx === nextTurns.length - 1 ? { ...t, a } : t)) }));
    }
  };

  const startPoDebate = (subject: SpeakingSubject) => {
    sectionTimer.start();
    setPoPresetIdx(0);
    update({ stage: "po_debate" });
    void askNextExaminer([], subject);
  };

  const finishPoDebate = async (so: DebateTurn[], subject: SpeakingSubject) => {
    if (!m) return;
    stopRec.current?.();
    stopRec.current = null;
    stopAudio();
    sectionTimer.stop();
    if (hasAi) {
      setPoBusy(true);
      try {
        const fb = await gradeSpeaking({ subject, transcript: m.poSaid, turns: so.filter((t) => t.a.trim()), points }, ctrl.current?.signal);
        update({ poFb: fb, poPhono: null, stage: "po_grade" });
      } catch (err) {
        toast((err as Error).message || "口语批改失败，改用自评量表", "warn");
        update({ poFb: null, stage: "po_grade" });
      } finally {
        setPoBusy(false);
      }
      return;
    }
    update({ poFb: null, stage: "po_grade" });
  };

  const confirmPoScore = () => {
    if (!m) return;
    const sc = m.poFb ? totalScore(m.poFb) + (m.poPhono ?? 0) : rubricSum(m.poSelf, [...SPEAK_CRITERIA, "phono"]);
    logExam({ part: "speak", what: `mock-${m.poSubjectId}`, score: sc, total: 25, ...(m.poTyped ? { typed: true } : {}) });
    setSaved(null);
    update({ poScore: sc, stage: "summary" });
  };

  /* ---------- Setup view ---------- */
  if (!m) {
    return (
      <div className="page practice">
        <header className="page-head">
          <button className="link deck-back" onClick={onExit}>
            <ArrowLeft size={16} /> 返回练习
          </button>
          <p className="eyebrow">四项全真模考 · DELF B2 Examen blanc</p>
          <h1 className="display">2 小时 30 分笔试连考 + 口语。</h1>
          <p className="lede">完整还原考场节奏：CO 听力（~30 分钟）→ CE 阅读（60 分钟）→ PE 写作（60 分钟）不间断连续笔试，随后进入 PO 口语（30 分钟准备 + 20 分钟陈述辩论）。有或无 AI Key 均可全程完成并计入 /100 总分仪表盘。</p>
        </header>

        <section className="panel exam-setup">
          <h3 className="eyebrow">选择套卷（各 25 分标准结构）</h3>
          <div className="segmented segmented-wide">
            {[0, 1].map((idx) => (
              <button key={idx} className={setIdx === idx ? "is-on" : ""} onClick={() => setSetIdx(idx as 0 | 1)} aria-pressed={setIdx === idx}>
                全真套卷 {idx + 1}（{listenPapers[idx]?.style === "natural" ? "口语化自然语流" : "电台播音语流"}）
              </button>
            ))}
          </div>

          <h3 className="eyebrow">考场模式</h3>
          <div className="segmented segmented-wide">
            <button className={strict ? "is-on" : ""} onClick={() => setStrict(true)} aria-pressed={strict}>
              严格考场模式（建议）
            </button>
            <button className={!strict ? "is-on" : ""} onClick={() => setStrict(false)} aria-pressed={!strict}>
              自由练习节奏
            </button>
          </div>
          <p className="muted small">
            {strict
              ? "严格考场模式：CE 60 分钟与 PE 60 分钟倒计时归零自动锁卷交卷；听力不提供跳过等待按钮；写作隐藏提纲套话。"
              : "自由练习节奏：保留完整四项流程与 2h30 总计时，但允许跳过听力读题等待并查看写作参考提纲。"}
          </p>

          <div className="exam-notice" role="note">
            <p>
              <b>TTS 音频仅用于熟悉题型，考前须搭配真实电台脱敏。</b>
              <span className="muted small">口语与写作在无 AI Key 时提供静态 B2+ 范文对照与预设追问 TTS 播报，按官方五项量表计入 /100 成绩。</span>
            </p>
          </div>

          <div className="writing-actions">
            {saved && saved.stage !== "summary" && (
              <button className="btn btn-ghost" onClick={resumeSaved}>
                继续上次未完成模考（当前：{PART_LABEL[saved.stage.startsWith("po") ? "speak" : saved.stage === "pe_grade" ? "essay" : saved.stage === "break_po" ? "speak" : (saved.stage as "listen" | "read" | "essay")] ?? saved.stage}）
              </button>
            )}
            <button className="btn btn-primary btn-xl" onClick={startNew}>
              <PlayCircle size={18} /> 开始四项全真模考 <ArrowRight size={18} />
            </button>
          </div>
        </section>
      </div>
    );
  }

  const lp = listenPapers[m.setIdx] ?? listenPapers[0];
  const rp = readPapers[m.setIdx] ?? readPapers[0];
  const peTask = ESSAY_TASKS.find((t) => t.id === m.peTaskId) ?? ESSAY_TASKS.find((t) => t.level === "B2")!;
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
              writtenTimer.stop();
              sectionTimer.stop();
              setM(null);
            }}
          >
            退出模考（进度保留）
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

        {/* ---------- 1. CO 听力 ---------- */}
        {m.stage === "co" && (
          <>
            <p className="muted small">提示：TTS 音频仅用于熟悉题型，考前须搭配真实电台脱敏。套卷共三部分 25 分：两篇长录音各听两遍，三段短录音各听一遍。</p>
            <div className="exam-player">
              {coPace ? (
                <>
                  <span className="exam-clock">
                    {coPace.label}
                    {coPace.left !== null ? ` ${clock(coPace.left)}` : "…"}
                  </span>
                  {!m.strict && coPace.left !== null && (
                    <button className="btn btn-ghost" onClick={() => skip.current?.()}>
                      <FastForward size={16} /> 跳过等待
                    </button>
                  )}
                  <button className="btn btn-ghost" onClick={haltAudio}>
                    <Square size={16} /> 停止播放
                  </button>
                </>
              ) : (
                <button className="btn btn-primary" onClick={() => void playCoPaper(0)}>
                  <Play size={16} /> 连续播放整套听力（练习 1 → 2 → 3）
                </button>
              )}
            </div>
            {lp.exs.map((ex, e) => (
              <section key={e} className="exam-exercise">
                <header className="exam-ex-head">
                  <h3>
                    EXERCICE {e + 1} <small>{FORM_SPEC[ex.form].points} points</small>
                  </h3>
                  <p className="muted" lang="fr">
                    {ex.intro}
                  </p>
                  {!coHeard[e] && !coPace && (
                    <button className="link" onClick={() => void playCoPaper(e)}>
                      <Volume2 size={14} /> 从练习 {e + 1} 开始连续放音
                    </button>
                  )}
                </header>
                <ol className="exam-questions">
                  {ex.questions.map((q, k) => {
                    const key = `${e}-${k}`;
                    return (
                      <li key={k}>
                        <p className="exam-q" lang="fr">
                          {q.q} <small>{num(q.pts)} pt</small>
                        </p>
                        <div className="exam-options" role="radiogroup">
                          {q.options.map((o, j) => (
                            <button key={j} role="radio" aria-checked={m.coPicked[key] === j} className={`exam-option ${m.coPicked[key] === j ? "is-on" : ""}`} lang="fr" onClick={() => update({ coPicked: { ...m.coPicked, [key]: j } })}>
                              <span>{"ABC"[j]}</span>
                              {o}
                            </button>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
            <div className="writing-actions">
              <button className="btn btn-primary btn-xl" onClick={finishCo}>
                交卷 CO 并立即进入 CE 阅读（60 分钟） <ArrowRight size={18} />
              </button>
            </div>
          </>
        )}

        {/* ---------- 2. CE 阅读 ---------- */}
        {m.stage === "ce" && (
          <>
            <p className="muted small">上一科 CO 听力已记录（{num(m.coScore ?? 0)}/25）。阅读限时 60 分钟，到时自动锁卷交卷。</p>
            {rp.exs.map((ex, e) => (
              <section key={e} className="exam-exercise">
                <header className="exam-ex-head">
                  <h3>
                    EXERCICE {e + 1} <small>{FORM_SPEC[ex.form].points} points</small>
                  </h3>
                  <p className="muted" lang="fr">
                    {ex.intro}
                  </p>
                </header>
                {ex.docs.map((d, k) => (
                  <article key={k} className="exam-doc">
                    <h4 className="exam-doc-title" lang="fr">
                      {ex.title}
                    </h4>
                    <p className="essay-text" lang="fr">
                      {d.text}
                    </p>
                  </article>
                ))}
                <ol className="exam-questions">
                  {ex.questions.map((q, k) => {
                    const key = `${e}-${k}`;
                    return (
                      <li key={k}>
                        <p className="exam-q" lang="fr">
                          {q.q} <small>{num(q.pts)} pt</small>
                        </p>
                        <div className="exam-options" role="radiogroup">
                          {q.options.map((o, j) => (
                            <button key={j} role="radio" aria-checked={m.cePicked[key] === j} className={`exam-option ${m.cePicked[key] === j ? "is-on" : ""}`} lang="fr" onClick={() => update({ cePicked: { ...m.cePicked, [key]: j } })}>
                              <span>{"ABC"[j]}</span>
                              {o}
                            </button>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
            <div className="writing-actions">
              <button className="btn btn-primary btn-xl" onClick={finishCe}>
                交卷 CE 并立即进入 PE 写作（60 分钟） <ArrowRight size={18} />
              </button>
            </div>
          </>
        )}

        {/* ---------- 3. PE 写作 ---------- */}
        {m.stage === "pe" && (
          <>
            <p className="muted small">上一科 CE 阅读已记录（{num(m.ceScore ?? 0)}/25）。写作限时 60 分钟，至少 250 词（推荐 250–350 词，到时自动锁卷）。</p>
            <p className="eyebrow">
              {GENRE_LABEL[peTask.genre]} · {peTask.level} · 至少 250 词
            </p>
            <h2 className="essay-title">{peTask.title}</h2>
            {!m.strict && <p className="essay-situation">{peTask.situation}</p>}
            {peTask.doc && (
              <blockquote className="essay-doc" lang="fr">
                {peTask.doc}
              </blockquote>
            )}
            <p className="essay-consigne" lang="fr">
              {peTask.consigne}
            </p>
            {!m.strict && (
              <details className="essay-help">
                <summary>查看写作提纲提示（非严格模式）</summary>
                <ol className="essay-plan">
                  {peTask.plan.map((p, k) => (
                    <li key={k}>
                      <b>{p.zh}</b>
                      <span lang="fr">{p.fr}</span>
                    </li>
                  ))}
                </ol>
              </details>
            )}
            <textarea
              ref={peInput}
              className="writing-input essay-input"
              lang="fr"
              rows={14}
              value={m.peText}
              readOnly={poBusy || (m.strict && sectionTimer.sec === 0)}
              onChange={(ev) => update({ peText: ev.target.value })}
              placeholder="Rédigez votre texte en français (au moins 250 mots)…"
              spellCheck={false}
            />
            <AccentKeys input={peInput} value={m.peText} onChange={(v) => update({ peText: v })} />
            <div className="writing-actions">
              <span className={`essay-count ${countWords(m.peText) < 250 ? "is-short" : "is-ok"}`}>
                {countWords(m.peText)} 词 · 至少 250 词（推荐 250–350）
              </span>
              <button className="btn btn-primary btn-xl" disabled={poBusy || !m.peText.trim()} onClick={() => void handleSubmitPe(false)}>
                {poBusy ? "AI 批改中…" : hasAi ? "提交并由 AI 批改" : "提交并对照静态 B2+ 范文自评"} <ArrowRight size={18} />
              </button>
            </div>
          </>
        )}

        {m.stage === "pe_grade" && (
          <>
            <h2 className="essay-title">PE 写作对照自评（无 AI Key 离线评分）</h2>
            <div className="essay-box">
              <p className="eyebrow">你的作文（{countWords(m.peText)} 词）</p>
              <p className="essay-text" lang="fr">
                {m.peText || "（未写内容）"}
              </p>
            </div>
            <StaticEssayModel taskId={peTask.id} defaultOpen />
            <div className="essay-box">
              <p className="eyebrow">按 DELF B2 官方五项量表自评（当前合计：{rubricSum(m.peSelf, CRITERIA)}/25）</p>
              {CRITERIA.map((c) => (
                <div key={c} className="mock-rubric-row">
                  <div>
                    <b>{CRITERION_LABEL[c]}</b>
                    <p className="muted small">{CRITERION_CHECK[c]}</p>
                  </div>
                  <div className="segmented">
                    {LEVELS.map((v) => (
                      <button key={v} className={m.peSelf[c] === v ? "is-on" : ""} onClick={() => update({ peSelf: { ...m.peSelf, [c]: v } })}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="writing-actions">
              <button className="btn btn-primary btn-xl" onClick={confirmOfflinePe}>
                确认写作得分（{rubricSum(m.peSelf, CRITERIA)}/25）并结束笔试 <ArrowRight size={18} />
              </button>
            </div>
          </>
        )}

        {/* ---------- 笔试结束 → PO 过渡 ---------- */}
        {m.stage === "break_po" && (
          <div className="panel real-flow">
            <h2 className="essay-title">2h30 笔试部分已完成！</h2>
            <p className="lede">
              笔试三科小计：<b>{num((m.coScore ?? 0) + (m.ceScore ?? 0) + (m.peScore ?? 0))} / 75 分</b>（CO {num(m.coScore ?? 0)} · CE {num(m.ceScore ?? 0)} · PE {num(m.peScore ?? 0)}）。
            </p>
            {m.peFb && <Marking fb={m.peFb} pointTitle={pointTitle} from={peTask.title} />}
            <p className="muted">真实 DELF B2 中，口语（PO）通常在笔试后同一天下午或另行安排。准备好后进入第 4 科口语抽题。</p>
            <div className="writing-actions">
              <button className="btn btn-primary btn-xl" onClick={() => update({ stage: "po_choose" })}>
                进入第四项：PO 口语抽题 <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ---------- 4. PO 口语 ---------- */}
        {m.stage === "po_choose" && (
          <>
            <h2 className="essay-title">PO 口语：二选一</h2>
            <div className="essay-tasks exam-draw">
              {m.poDrawnIds.map((id) => {
                const s = SPEAKING_SUBJECTS.find((x) => x.id === id);
                if (!s) return null;
                return (
                  <button key={s.id} className="essay-task" onClick={() => chooseSubject(s)}>
                    <span className="chip">{topicOf(s.topic)?.zh}</span>
                    <b lang="fr">{s.title}</b>
                    <small lang="fr">{s.doc}</small>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {m.stage === "po_prep" && (
          <>
            <div className="panel-head">
              <h2 className="essay-title" lang="fr">
                {poSubject.title}
              </h2>
              <span className={`exam-clock ${sectionTimer.sec === 0 ? "is-over" : ""}`}>准备 {clock(sectionTimer.sec)}</span>
            </div>
            <p className="essay-consigne" lang="fr">
              {poSubject.doc}
            </p>
            <p className="muted small" lang="fr">
              Vous devez dégager la problématique de ce document et présenter votre point de vue de façon structurée et argumentée pendant 5 à 7 minutes.
            </p>
            {!m.strict && poPreset && (
              <details className="essay-help">
                <summary>查看参考提纲（非严格模式）</summary>
                <p className="muted small" lang="fr">
                  Problématique possible : {poPreset.problematique}
                </p>
                <ol className="essay-plan">
                  {poPreset.outline.map((o, i) => (
                    <li key={i}>
                      <b>{o.zh}</b>
                      <span lang="fr">{o.fr}</span>
                    </li>
                  ))}
                </ol>
              </details>
            )}
            <textarea className="writing-input essay-notes" rows={6} lang="fr" value={m.poNotes} onChange={(e) => update({ poNotes: e.target.value })} placeholder="准备提纲关键词（避免写成逐字稿）…" />
            <div className="writing-actions">
              <button className="btn btn-primary btn-xl" onClick={startPoTalk}>
                <Mic size={18} /> 开始独白陈述（5–7 分钟） <ArrowRight size={18} />
              </button>
            </div>
          </>
        )}

        {m.stage === "po_talk" && (
          <>
            <div className="panel-head">
              <h2 className="essay-title">第 1 部分：独白陈述（目标 5–7 分钟）</h2>
              <span className="exam-clock">{clock(sectionTimer.sec)}</span>
            </div>
            {m.poNotes.trim() && (
              <div className="essay-box">
                <p className="eyebrow">准备笔记</p>
                <p className="essay-text">{m.poNotes}</p>
              </div>
            )}
            {dictation ? (
              <div className={`exam-live ${poDictating ? "is-on" : ""}`}>
                <p className="eyebrow">{poDictating ? "语音识别记录中…" : "语音识别已停"}</p>
                <p className="essay-text" lang="fr">
                  {m.poSaid}
                  <i>{poInterim}</i>
                </p>
              </div>
            ) : (
              <p className="muted">当前浏览器不支持语音识别：请对着计时说 5–7 分钟，说完后在下一步补充转写或自评。</p>
            )}
            <div className="writing-actions">
              <button className="btn btn-primary btn-xl" onClick={endPoTalk}>
                <Square size={16} /> 独白结束，进入辩论 <ArrowRight size={18} />
              </button>
            </div>
          </>
        )}

        {m.stage === "po_review" && (
          <>
            <h2 className="essay-title">检查独白记录并进入辩论</h2>
            <textarea className="writing-input essay-input" rows={8} lang="fr" value={m.poSaid} onChange={(e) => update({ poSaid: e.target.value, poTyped: true })} placeholder="如有遗漏可补充你刚说过的法语要点…" />
            <div className="writing-actions">
              <button className="btn btn-primary btn-xl" disabled={!m.poSaid.trim() && hasAi} onClick={() => startPoDebate(poSubject)}>
                进入考官辩论（10–13 分钟） <ArrowRight size={18} />
              </button>
            </div>
          </>
        )}

        {m.stage === "po_debate" && (
          <>
            <div className="panel-head">
              <h2 className="essay-title">第 2 部分：考官追问辩论（{hasAi ? "AI 考官" : "离线预设考官 TTS"}）</h2>
              <span className="exam-clock">{clock(sectionTimer.sec)}</span>
            </div>
            <ol className="exam-debate">
              {m.poTurns.slice(0, -1).map((t, idx) => (
                <li key={idx}>
                  <p className="exam-q" lang="fr">
                    {t.q}
                  </p>
                  <p className="essay-text" lang="fr">
                    {t.a || "（已口头回答）"}
                  </p>
                </li>
              ))}
            </ol>
            {poAsking && <p className="muted">考官正在提问…</p>}
            {m.poTurns.length > 0 && !poAsking && (
              <div className="exam-live">
                <p className="eyebrow">考官问题 {m.poTurns.length}</p>
                <p className="exam-q" lang="fr">
                  {m.poTurns[m.poTurns.length - 1].q}
                </p>
                <textarea
                  className="writing-input essay-notes"
                  rows={3}
                  lang="fr"
                  value={m.poTurns[m.poTurns.length - 1].a}
                  onChange={(e) => update({ poTurns: m.poTurns.map((t, k) => (k === m.poTurns.length - 1 ? { ...t, a: e.target.value } : t)), poTyped: true })}
                  placeholder={dictation ? "开口回答或补充要点…" : "对着提问口头回答，可在此简记要点…"}
                />
                <div className="writing-actions">
                  <button className="link" onClick={() => void play(null, m.poTurns[m.poTurns.length - 1].q)}>
                    再听一遍问题
                  </button>
                  <button className="btn btn-primary" onClick={() => void askNextExaminer(m.poTurns, poSubject)}>
                    下一个考官追问 <ArrowRight size={16} />
                  </button>
                  <button className="btn btn-ghost" onClick={() => void finishPoDebate(m.poTurns, poSubject)}>
                    结束辩论并进入评分
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {m.stage === "po_grade" && (
          <>
            <h2 className="essay-title">PO 口语评分（满分 25）</h2>
            {m.poFb ? (
              <>
                <Marking fb={m.poFb} pointTitle={pointTitle} extra={{ key: "phono", score: m.poPhono }} />
                <div className="essay-box">
                  <p className="eyebrow">第五项：发音和语调（必填后计入 /25 总分）</p>
                  <div className="segmented">
                    {LEVELS.map((v) => (
                      <button key={v} className={m.poPhono === v ? "is-on" : ""} onClick={() => update({ poPhono: v })}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                {poPreset && (
                  <div className="essay-box">
                    <p className="eyebrow">参考核心问题与纲要（待核对）</p>
                    <p lang="fr">
                      <b>Problématique :</b> {poPreset.problematique}
                    </p>
                    <ol className="essay-plan">
                      {poPreset.outline.map((o, i) => (
                        <li key={i}>
                          <b>{o.zh}</b>
                          <span lang="fr">{o.fr}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                <div className="essay-box">
                  <p className="eyebrow">官方五项口语自评（当前合计：{rubricSum(m.poSelf, [...SPEAK_CRITERIA, "phono"])}/25）</p>
                  {[...SPEAK_CRITERIA, "phono"].map((c) => (
                    <div key={c} className="mock-rubric-row">
                      <div>
                        <b>{CRITERION_LABEL[c]}</b>
                        <p className="muted small">{CRITERION_CHECK[c]}</p>
                      </div>
                      <div className="segmented">
                        {LEVELS.map((v) => (
                          <button key={v} className={m.poSelf[c] === v ? "is-on" : ""} onClick={() => update({ poSelf: { ...m.poSelf, [c]: v } })}>
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="writing-actions">
              <button className="btn btn-primary btn-xl" disabled={!!m.poFb && m.poPhono === null} onClick={confirmPoScore}>
                完成口语并查看四项 /100 总成绩单 <ArrowRight size={18} />
              </button>
            </div>
          </>
        )}

        {/* ---------- 5. 四项总成绩单 ---------- */}
        {m.stage === "summary" && (
          <SummaryView
            co={m.coScore ?? 0}
            ce={m.ceScore ?? 0}
            pe={m.peScore ?? 0}
            po={m.poScore ?? 0}
            target={target}
            onExit={onExit}
            onAgain={() => setM(null)}
          />
        )}
      </section>
    </div>
  );
}

function SummaryView({ co, ce, pe, po, target, onExit, onAgain }: { co: number; ce: number; pe: number; po: number; target: number; onExit: () => void; onAgain: () => void }) {
  const total = Math.round((co + ce + pe + po) * 10) / 10;
  const rows = [
    { part: "listen", label: "CO 听力", score: co },
    { part: "read", label: "CE 阅读", score: ce },
    { part: "essay", label: "PE 写作", score: pe },
    { part: "speak", label: "PO 口语", score: po },
  ] as const;
  const eliminated = rows.filter((r) => r.score < 5);
  const passed = total >= 50 && eliminated.length === 0;
  const gap = Math.round(Math.max(0, target - total) * 10) / 10;
  void examReadiness;

  return (
    <div className="panel real-flow">
      <p className="eyebrow">四项全真模考成绩单</p>
      <p className="essay-total">
        {num(total)}
        <small>/100</small>
      </p>
      <p className="lede">
        {passed ? `达到及格线（≥50 且无 <5 单项）` : eliminated.length ? "未通过：触发单项 <5/25 淘汰线" : "未通过：总分低于 50/100"}
        {" · "}
        {gap === 0 ? `已达到 ${target}+ 目标！` : `距离 ${target}+ 目标还差 ${num(gap)} 分`}
      </p>
      {eliminated.length > 0 && (
        <div className="exam-alert" role="alert">
          <AlertTriangle size={16} />
          <span>
            淘汰红线提醒：{eliminated.map((e) => `${e.label} ${num(e.score)}/25`).join("、")} 低于 5 分底线，哪怕总分过 50 也会判不及格！
          </span>
        </div>
      )}
      <div className="exam-four-grid">
        {rows.map((r) => (
          <div key={r.part} className={`exam-four-cell ${r.score < 5 ? "is-danger" : r.score >= 18.75 ? "is-strong" : ""}`}>
            <span className="eyebrow">{r.label}</span>
            <strong className="exam-four-score">
              {num(r.score)}
              <small>/25</small>
            </strong>
            <span className="muted small">{r.score < 5 ? "低于 5 分淘汰线" : r.score >= 18.75 ? "达 75+ 均值" : "及格"}</span>
          </div>
        ))}
      </div>
      <div className="writing-actions">
        <button className="btn btn-ghost" onClick={onExit}>
          返回练习主页
        </button>
        <button className="btn btn-primary" onClick={onAgain}>
          <RotateCcw size={16} /> 再模考一套
        </button>
      </div>
    </div>
  );
}
