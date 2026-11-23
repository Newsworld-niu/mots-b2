import { ArrowRight, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ready, useAiConfig } from "../ai/config";
import { buildDialogueSsmlBatches } from "../ai/ssml";
import { explainDistractor, makeComprehension, type DistractorExplanation } from "../ai/tasks";
import { generateTrackComprehension } from "../ai/tasks/exam";
import { speakerVoices, ttsOn, ttsSsmlUrl, ttsUrl } from "../ai/tts";
import { isAcousticEnv, startAcousticBed, stopAcousticBed, type AcousticEnv } from "../lib/audio-env";
import { play, stopAudio } from "../lib/audio";
import { countWords } from "../lib/essay";
import { BETWEEN_PLAYS, clock, COMP_LABEL, exercisePoints, FORM_SPEC, gradeCompQuestion, outOf25, PAPER, READ_MINUTES, speakerIndex, speechChunks, speechTurns, TOPICS, topicOf, type CompExercise, type CompKind } from "../lib/exam";
import { scoreTcfReceptive, scoreTefItems699, TRACK_META, type ExamTrack } from "../lib/exam-tracks";
import { buildCompMissSnapshot, pickVoices, resolveMaterialUrl, sentencesOf, type CompMiss, type DocVoices, type MissCause, type VoiceMode } from "../lib/listening";
import { useNavGuard } from "../lib/nav-guard";
import { go } from "../lib/router";
import { startListeningNoise, stopListeningNoise, type ListeningNoiseId } from "../lib/sound";
import { useTimer } from "../lib/timer";
import type { TrackPaper } from "../lib/tcf-tef-presets";
import { logExam } from "../store/essays";
import { addAttempt, savePaper, useBank, wrongKeys, type BankPaper } from "../store/exam-bank";
import { addMisses, setMissCause } from "../store/misses";
import { store, useStore } from "../store/store";
import "../styles/listening.css";
import { toast } from "../ui/Toast";
import { WordPopup } from "../ui/WordPopup";
import { defaultCompFormat, effectiveCompFormat, normalizeCompQuestionForKind, projectQuestionForMissSnapshot, type CompQFormat } from "./comprehension-helpers";
import { CompExerciseBody } from "./comprehension/CompExerciseBody";
import { CompSetupView } from "./comprehension/CompSetupView";
import {
  CONTINUOUS_KEY,
  NOISE_IDS,
  NOISE_KEY,
  num,
  PACE_KEY,
  type Phase,
  rateFor,
  readKey,
  readPace,
  STYLE_KEY,
  VOICE_KEY,
  type What,
  writeKey,
} from "./comprehension/helpers";

/**
 * 听力理解 / 应试阅读, in the form of the exam (new format): a whole paper is three exercises worth 9 + 9 + 7 points,
 * with per-question weights from POINT_SETS (0.5 to 2.5 points). Listening follows the exam's rhythm: time to
 * read the questions, the recording (twice for a long one, once for the short ones), time to answer.
 */
export function ComprehensionStudio({ kind, onExit }: { kind: CompKind; onExit: () => void }) {
  return (
    <WordPopup>
      <ComprehensionStudioBody kind={kind} onExit={onExit} onOpenReal={() => go({ page: "real" })} />
    </WordPopup>
  );
}

const ACOUSTIC_ENV_KEY = "fb2.comp.acousticEnv";
const TRACK_AI_PAPERS_KEY = "fb2.track.aiPapers";

function readStoredTrackAiPapers(): TrackPaper[] {
  try {
    const raw = localStorage.getItem(TRACK_AI_PAPERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as TrackPaper[]).slice(0, 16) : [];
  } catch {
    return [];
  }
}

function saveStoredTrackAiPaper(paper: TrackPaper): TrackPaper[] {
  const next = [paper, ...readStoredTrackAiPapers().filter((p) => p.id !== paper.id)].slice(0, 16);
  try {
    localStorage.setItem(TRACK_AI_PAPERS_KEY, JSON.stringify(next));
  } catch {
    /* ignore storage quota */
  }
  return next;
}

function deleteStoredTrackAiPaper(id: string): TrackPaper[] {
  const next = readStoredTrackAiPapers().filter((p) => p.id !== id);
  try {
    localStorage.setItem(TRACK_AI_PAPERS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

function ComprehensionStudioBody({ kind, onExit, onOpenReal }: { kind: CompKind; onExit: () => void; onOpenReal: () => void }) {
  const ai = useAiConfig();
  const examTrack: ExamTrack = useStore((s) => s.settings.examTrack) ?? "delf";
  const allKindLog = (useStore((s) => s.progress.examLog) ?? []).filter((r) => r.part === kind);
  const log = allKindLog.filter((r) => (examTrack === "delf" ? r.track !== "tcf" && r.track !== "tef" : r.track === examTrack));
  const misses = useStore((s) => s.progress.compMisses) ?? [];
  const bank = useBank();
  const listen = kind === "listen";
  const azure = ready.tts(ai);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(() => readKey(VOICE_KEY, ["mixed", "france", "fixed"], "mixed"));
  const [style, setStyle] = useState<"radio" | "natural">(() => readKey(STYLE_KEY, ["radio", "natural"], "natural"));
  const [noise, setNoise] = useState<ListeningNoiseId>(() => readKey(NOISE_KEY, NOISE_IDS, "off"));
  const [acousticEnv, setAcousticEnvState] = useState<AcousticEnv>(() => {
    try {
      const v = localStorage.getItem(ACOUSTIC_ENV_KEY);
      return isAcousticEnv(v) ? v : "clean";
    } catch {
      return "clean";
    }
  });
  const setAcousticEnv = (next: AcousticEnv) => {
    setAcousticEnvState(next);
    writeKey(ACOUSTIC_ENV_KEY, next);
  };
  const [continuousMock, setContinuousMock] = useState<boolean>(() => readKey(CONTINUOUS_KEY, ["0", "1"], "0") === "1");
  const [trackPresets, setTrackPresets] = useState<TrackPaper[]>([]);
  const [trackAiPapers, setTrackAiPapers] = useState<TrackPaper[]>(() => readStoredTrackAiPapers());
  /** The paper being done: its id in the bank, and the question keys asked when only the missed ones are. */
  const [paper, setPaper] = useState<{ id: string; level: "B1" | "B2"; track: ExamTrack; durationMinutes?: number; asked?: string[] } | null>(null);
  const [voices, setVoices] = useState<DocVoices[][]>([]);
  const [finishedAt, setFinishedAt] = useState(0);
  const [causes, setCauses] = useState<Record<string, MissCause>>({});
  const [panel, setPanel] = useState<string | null>(null);
  const forms: What[] = ["paper", ...new Set(PAPER[kind])];
  const [topic, setTopic] = useState("random");
  const [level, setLevel] = useState<"B1" | "B2">("B2");
  const [what, setWhat] = useState<What>("paper");
  const [qFormat, setQFormat] = useState<CompQFormat>(() => defaultCompFormat(kind));
  const activeFormat = effectiveCompFormat(kind, qFormat);
  const [timed, setTimed] = useState(true);
  const [strictLock, setStrictLock] = useState(true);
  const [slow, setSlow] = useState(false);
  const [wpm, setWpm] = useState(readPace);
  const measured = useRef({ words: 0, sec: 0 });
  const [phase, setPhase] = useState<Phase>("setup");
  const [made, setMade] = useState(0);
  const [exs, setExs] = useState<CompExercise[]>([]);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [struck, setStruck] = useState<Record<string, boolean>>({});
  const [ceHl, setCeHl] = useState<Record<string, boolean>>({});
  const [expls, setExpls] = useState<Record<string, DistractorExplanation>>({});
  const [explBusy, setExplBusy] = useState<string | null>(null);
  const [heard, setHeard] = useState<Record<number, boolean>>({});
  const [pace, setPace] = useState<{ e: number; label: string; left: number | null } | null>(null);
  const [showZh, setShowZh] = useState(false);
  const [activeCeKey, setActiveCeKey] = useState<string | null>(null);
  const ceInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const activeCeRef = useRef<HTMLInputElement | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const run = useRef(0);
  const skip = useRef<(() => void) | null>(null);
  const timer = useTimer();
  const autoLocked = useRef(false);

  useNavGuard(phase === "work", "套卷尚未交卷，离开将中断当前计时与作答，确定离开？");

  const halt = () => {
    run.current++;
    skip.current?.();
    stopAudio();
    stopAcousticBed();
    setPace(null);
  };

  useEffect(
    () => () => {
      ctrl.current?.abort();
      run.current++;
      stopAudio();
      stopAcousticBed();
    },
    [],
  );
  useEffect(() => {
    if (examTrack === "delf") return;
    let alive = true;
    void import("../lib/tcf-tef-presets").then((m) => {
      if (alive) setTrackPresets([...m.TCF_TEF_PRESET_PAPERS]);
    });
    return () => {
      alive = false;
    };
  }, [examTrack]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [phase]);
  useEffect(() => {
    setQFormat(defaultCompFormat(kind));
  }, [kind]);

  const activeTrack: ExamTrack = phase === "setup" || phase === "making" ? examTrack : (paper?.track ?? examTrack);

  /** Start a paper: voices for every document, answers cleared, the reading clock started. */
  const begin = (list: CompExercise[], p: { id: string; level: "B1" | "B2"; track?: ExamTrack; durationMinutes?: number; asked?: string[] }) => {
    const resolvedTrack = p.track ?? examTrack;
    const mode = azure && voiceMode !== "fixed" ? voiceMode : null;
    setVoices(list.map((ex) => ex.docs.map(() => (mode ? pickVoices(mode) : { voices: speakerVoices(), accents: [] }))));
    setExs(list);
    setPaper({ ...p, track: resolvedTrack });
    setPicked({});
    setTyped({});
    setStruck({});
    setCeHl({});
    setExpls({});
    setExplBusy(null);
    setHeard({});
    setCauses({});
    setPanel(null);
    setShowZh(false);
    autoLocked.current = false;
    setPhase("work");
    const defaultMinutes =
      p.durationMinutes ??
      (resolvedTrack === "tcf"
        ? 25
        : resolvedTrack === "tef"
          ? 30
          : list.length > 1
            ? READ_MINUTES.paper
            : list[0].form === "opinions"
              ? READ_MINUTES.opinions
              : READ_MINUTES.long);
    if (!listen && timed) {
      timer.start(Math.round(defaultMinutes * (p.asked ? Math.max(0.25, p.asked.length / list.reduce((n, x) => n + x.questions.length, 0)) : 1) * 60));
    }
  };

  const redo = (p: BankPaper | TrackPaper, wrongOnly: boolean) => {
    const asBank = p as BankPaper;
    const asked = wrongOnly ? wrongKeys(asBank, bank.attempts[p.id]?.[0]) : undefined;
    if (wrongOnly && !asked?.length) return toast("上次这套题没有错题", "info");
    setLevel(p.level);
    const tp = "track" in p ? p : null;
    begin(p.exs, {
      id: p.id,
      level: p.level,
      track: tp ? tp.track : "delf",
      durationMinutes: tp?.durationMinutes,
      asked,
    });
  };

  const make = async () => {
    const pool = [...TOPICS].sort(() => Math.random() - 0.5);
    const c = new AbortController();
    ctrl.current = c;
    setPhase("making");
    setMade(0);
    try {
      if (examTrack === "tcf" || examTrack === "tef") {
        const chosenTopic = topic === "random" ? pool[0] : topicOf(topic) ?? pool[0];
        const ex = await generateTrackComprehension(examTrack, kind, `${chosenTopic.fr} (${chosenTopic.zh})`, c.signal);
        if (c.signal.aborted) return;
        setMade(1);
        const createdPaper: TrackPaper = {
          id: `${examTrack}-ai-${kind}-${Date.now().toString(36)}`,
          track: examTrack,
          section: listen ? "co" : "ce",
          kind,
          level: "B2",
          created: Date.now(),
          src: "ai",
          titleZh: `${TRACK_META[examTrack].shortName} AI 四选一（${chosenTopic.zh}）`,
          badge: TRACK_META[examTrack].badge,
          durationMinutes: examTrack === "tcf" ? 20 : 25,
          exs: [{ ...ex, topic: chosenTopic.id }],
        };
        setTrackAiPapers(saveStoredTrackAiPaper(createdPaper));
        begin(createdPaper.exs, {
          id: createdPaper.id,
          level: "B2",
          track: examTrack,
          durationMinutes: createdPaper.durationMinutes,
        });
        return;
      }
      const list = what === "paper" ? PAPER[kind] : [what];
      const out: CompExercise[] = [];
      for (const [k, form] of list.entries()) {
        const t = topic === "random" || k > 0 ? pool[k % pool.length] : topicOf(topic)!;
        out.push(await makeComprehension({ kind, form, topic: t, level, style, format: activeFormat, exerciseIndex: k }, c.signal));
        if (c.signal.aborted) return;
        setMade(k + 1);
      }
      // kept in the 题库 on this device, to be done again later without asking the AI
      const id = await savePaper({ kind, level, ...(listen ? { style } : {}), exs: out });
      begin(out, { id, level, track: "delf" });
    } catch (err) {
      if (c.signal.aborted) return;
      toast((err as Error).message || "出题失败", "warn");
      setPhase("setup");
    }
  };

  /**
   * Read one document aloud at the pace of the official recordings, distinguishing 3+ speakers.
   * When Azure is enabled, builds whole-passage <prosody>/<break> SSML per turn batch so there are
   * no mid-sentence gaps; otherwise falls back to chunked device speech. Optionally mixes in an
   * ultra-low ambient noise bed from public/sfx/. False when stopped.
   */
  const say = async (text: string, mine: number, dv?: DocVoices, audioUrl?: string) => {
    const voicePool = dv && dv.voices.length >= 3 ? dv.voices : speakerVoices();
    const voiceOf = (who: number) => voicePool[who % voicePool.length];
    const recordPace = (words: number, sec: number) => {
      if (words >= 12 && sec > 2) {
        measured.current.words += words;
        measured.current.sec += sec;
      }
      if (measured.current.sec > 20) {
        const now = Math.round((measured.current.words / measured.current.sec) * 60);
        setWpm(now);
        try {
          localStorage.setItem(PACE_KEY, String(now));
        } catch {
          /* the pace is measured again next time */
        }
      }
    };
    const keepNoise = noise !== "off";
    if (keepNoise) void startListeningNoise(noise);
    const stopBed = acousticEnv !== "clean" ? startAcousticBed(acousticEnv) : null;
    try {
      if (audioUrl) {
        const base = (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");
        const resolved = resolveMaterialUrl(audioUrl.replace(/^\//, ""), base);
        const rate = slow ? 0.85 : 1;
        const r = await play(resolved, "", "uk", rate);
        if (run.current !== mine || r === "stopped") return false;
        if (r === "recorded") return true;
      }
      if (ttsOn()) {
        const turns = speechTurns(text);
        const batches = buildDialogueSsmlBatches(turns, voicePool, { style });
        try {
          const batchUrls = await Promise.all(batches.map((ssml) => ttsSsmlUrl(ssml)));
          if (run.current !== mine) return false;
          const totalWords = countWords(text);
          const t0 = performance.now();
          for (const url of batchUrls) {
            const rate = rateFor(measured.current.sec > 20 ? (measured.current.words / measured.current.sec) * 60 : wpm, slow);
            const r = await play(url, "", "uk", rate);
            if (run.current !== mine || r === "stopped" || r === "unsupported") return false;
          }
          const avgRate = rateFor(measured.current.sec > 20 ? (measured.current.words / measured.current.sec) * 60 : wpm, slow);
          recordPace(totalWords, ((performance.now() - t0) / 1000) * avgRate);
          return true;
        } catch {
          if (run.current !== mine) return false;
          // Fall back to per-chunk synthesis / device speech if a batch SSML call fails
        }
      }
      const chunks = speechChunks(text);
      let urls: string[] = [];
      if (ttsOn()) {
        urls = await Promise.all(chunks.map((c) => ttsUrl(c.t, voiceOf(c.who)).catch(() => "")));
        if (run.current !== mine) return false;
      }
      for (const [k, c] of chunks.entries()) {
        const rate = rateFor(measured.current.sec > 20 ? (measured.current.words / measured.current.sec) * 60 : wpm, slow);
        const t0 = performance.now();
        const r = await play(urls[k] || null, c.t, "uk", rate, c.who);
        if (run.current !== mine || r === "stopped" || r === "unsupported") return false;
        const words = countWords(c.t);
        // what the piece would have taken at normal speed; the device voice is slowed by 5% in `play`
        const sec = ((performance.now() - t0) / 1000) * rate * (r === "device" ? 0.95 : 1);
        recordPace(words, sec);
      }
      return true;
    } finally {
      stopBed?.();
      if (keepNoise) stopListeningNoise();
    }
  };

  /** A pause of the exam (reading the questions, answering): counts down, and can be skipped. */
  const pause = (e: number, label: string, sec: number, mine: number) =>
    new Promise<void>((done) => {
      let left = sec;
      const end = () => {
        window.clearInterval(id);
        skip.current = null;
        done();
      };
      const id = window.setInterval(() => {
        if (run.current !== mine || --left <= 0) return end();
        setPace({ e, label, left });
      }, 1000);
      skip.current = end;
      setPace({ e, label, left });
    });

  /** Run one listening exercise at the exam's rhythm; enforces strict single-play (1 遍播音 + 20s preview) on TCF/TEF. */
  const performExercise = async (e: number, mine: number): Promise<boolean> => {
    const ex = exs[e];
    const spec = FORM_SPEC[ex.form];
    const singlePlayTrack = activeTrack !== "delf";
    const readSec = singlePlayTrack ? 20 : spec.read;
    const playsCount = singlePlayTrack ? 1 : spec.plays;
    const answerSec = singlePlayTrack ? 15 : spec.answer;
    const alive = () => run.current === mine;
    for (const [d, doc] of ex.docs.entries()) {
      const name = ex.docs.length > 1 ? `录音 ${d + 1}：` : "";
      await pause(e, `${name}读题`, readSec, mine);
      if (!alive()) return false;
      for (let n = 1; n <= playsCount && alive(); n++) {
        setPace({ e, label: `${name}${playsCount > 1 ? `第 ${n} 遍` : "1 遍播音（只放一遍）"}`, left: null });
        if (!(await say(doc.text, mine, voices[e]?.[d], doc.audioUrl))) return false;
        if (n < playsCount) {
          await pause(e, `${name}两遍之间`, BETWEEN_PLAYS, mine);
          if (!alive()) return false;
        }
      }
      if (!alive()) return false;
      await pause(e, `${name}作答`, answerSec, mine);
      if (!alive()) return false;
    }
    setHeard((h) => ({ ...h, [e]: true }));
    return true;
  };

  /** Single-exercise trigger. */
  const perform = async (e: number) => {
    const mine = ++run.current;
    await performExercise(e, mine);
    if (run.current === mine) setPace(null);
  };

  /** Continuous uninterruptible full-paper exam loop (EXERCICE 1 → 2 → 3 back-to-back). */
  const performPaper = async () => {
    const mine = ++run.current;
    for (let e = 0; e < exs.length; e++) {
      if (heard[e]) continue;
      if (askedSet && !exs[e].questions.some((_, k) => askedSet.has(`${e}-${k}`))) continue;
      const ok = await performExercise(e, mine);
      if (!ok) return;
    }
    if (run.current === mine) setPace(null);
  };

  const replay = async (e: number, d: number) => {
    const mine = ++run.current;
    setPace({ e, label: "重听", left: null });
    await say(exs[e].docs[d].text, mine, voices[e]?.[d], exs[e].docs[d].audioUrl);
    if (run.current === mine) setPace(null);
  };

  /** One piece of a document for 精听, in the voice its speaker had in the recording. */
  const speakPiece = async (text: string, rate: number, doc: string, dv?: DocVoices, who?: string) => {
    const names: string[] = [];
    for (const u of sentencesOf(doc)) if (u.who) speakerIndex(names, u.who);
    const whoIdx = who ? speakerIndex(names, who) : 0;
    const pool = dv && dv.voices.length >= 3 ? dv.voices : speakerVoices();
    const voice = pool[whoIdx % pool.length];
    const url = ttsOn() ? await ttsUrl(text, voice).catch(() => null) : null;
    await play(url, text, "uk", rate, whoIdx);
  };

  const askedSet = paper?.asked ? new Set(paper.asked) : null;
  const isAsked = (key: string) => !askedSet || askedSet.has(key);
  const all = exs.flatMap((ex, e) => ex.questions.map((q, k) => ({ q, ex, key: `${e}-${k}` }))).filter(({ key }) => isAsked(key));
  const gradedItems = all.map(({ q, ex, key }) => {
    const nq = normalizeCompQuestionForKind(q, kind);
    const correct = gradeCompQuestion(nq, picked[key], typed[key], ex.docs[nq.doc]?.text).correct;
    const difficulty = typeof (q as { difficulty?: number }).difficulty === "number" ? (q as { difficulty?: number }).difficulty! : 3;
    return { q, nq, ex, key, correct, difficulty };
  });
  const total = askedSet ? all.reduce((n, { q }) => n + q.pts, 0) : exs.reduce((n, ex) => n + exercisePoints(ex), 0);
  const score = gradedItems.reduce((n, it) => n + (it.correct ? it.q.pts : 0), 0);
  const answered = all.filter(({ q, key }) => (normalizeCompQuestionForKind(q, kind).qType === "short" ? Boolean(typed[key]?.trim()) : picked[key] !== undefined)).length;
  const trackSection = listen ? "co" : "ce";
  const tcfScale = activeTrack === "tcf" ? scoreTcfReceptive(gradedItems, trackSection) : null;
  const tefScale = activeTrack === "tef" ? scoreTefItems699(gradedItems, trackSection) : null;

  const finish = () => {
    halt();
    timer.stop();
    const at = Date.now();
    // a redo of the missed questions only is not a score of the paper
    if (!askedSet) {
      if (activeTrack === "tcf" && tcfScale) {
        logExam({
          part: kind,
          what: paper?.id ?? `tcf-${trackSection}`,
          score: tcfScale.correctCount,
          total: tcfScale.totalCount,
          level: "B2",
          scope: "full",
          track: "tcf",
          trackSection,
          scaledScore: tcfScale.score699,
          nclc: tcfScale.nclc,
        });
      } else if (activeTrack === "tef" && tefScale) {
        logExam({
          part: kind,
          what: paper?.id ?? `tef-${trackSection}`,
          score: tefScale.correctCount,
          total: tefScale.totalCount,
          level: "B2",
          scope: "full",
          track: "tef",
          trackSection,
          scaledScore: tefScale.score699,
          nclc: tefScale.nclc,
        });
      } else {
        logExam({ part: kind, what: exs.length > 1 ? "paper" : exs[0].topic, score, total, level: paper?.level ?? level, scope: total >= 20 ? "full" : "drill" });
      }
    }
    const missed: CompMiss[] = gradedItems
      .filter((it) => !it.correct)
      .map((it) => buildCompMissSnapshot(projectQuestionForMissSnapshot(it.nq, picked[it.key]), it.ex, kind, it.key, at));
    addMisses(missed);
    setCauses(Object.fromEntries(missed.map((m) => [m.q!, m.cause])));
    if (paper) void addAttempt(paper.id, { at, picked, ...(Object.keys(typed).length ? { typed } : {}), score, total, ...(paper.asked ? { asked: paper.asked } : {}) });
    setFinishedAt(at);
    setPhase("done");
  };

  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => {
    if (phase === "work" && !listen && timed && strictLock && timer.down && !timer.running && timer.sec === 0 && !autoLocked.current) {
      autoLocked.current = true;
      toast("阅读计时到时，已按模考规定自动锁卷交卷！", "warn");
      finishRef.current();
    }
  }, [phase, listen, timed, strictLock, timer.down, timer.running, timer.sec]);

  const blame = (key: string, cause: MissCause) => {
    setCauses((c) => ({ ...c, [key]: cause }));
    setMissCause(finishedAt, key, cause);
  };

  const toggleStrike = (optKey: string) => setStruck((s) => ({ ...s, [optKey]: !s[optKey] }));

  const explainWrong = async (key: string, q: CompExercise["questions"][number], pickedIdx: number, docText: string) => {
    setExplBusy(key);
    try {
      const res = await explainDistractor({
        kind,
        question: q.q,
        options: q.options,
        pickedIdx,
        answerIdx: q.answer,
        docText,
        why: q.why,
      });
      setExpls((prev) => ({ ...prev, [key]: res }));
    } catch (err) {
      toast((err as Error).message || "干扰项解析失败，请稍后重试", "warn");
    } finally {
      setExplBusy((cur) => (cur === key ? null : cur));
    }
  };

  if (phase === "setup" || phase === "making") {
    const activeTrackPapers =
      examTrack === "delf"
        ? []
        : [...trackPresets, ...trackAiPapers].filter((p) => p.track === examTrack && p.kind === kind);
    return (
      <CompSetupView
        kind={kind}
        examTrack={examTrack}
        onSelectTrack={(next) => store.settings({ examTrack: next })}
        listen={listen}
        azure={azure}
        canAiText={ready.text(ai)}
        making={phase === "making"}
        made={made}
        count={examTrack === "delf" ? (what === "paper" ? PAPER[kind].length : 1) : 1}
        forms={forms}
        what={what}
        setWhat={setWhat}
        topic={topic}
        setTopic={setTopic}
        qFormat={qFormat}
        setQFormat={setQFormat}
        level={level}
        setLevel={setLevel}
        style={style}
        setStyle={setStyle}
        voiceMode={voiceMode}
        setVoiceMode={setVoiceMode}
        noise={noise}
        setNoise={setNoise}
        acousticEnv={acousticEnv}
        setAcousticEnv={setAcousticEnv}
        slow={slow}
        setSlow={setSlow}
        wpm={wpm}
        continuousMock={continuousMock}
        setContinuousMock={setContinuousMock}
        timed={timed}
        setTimed={setTimed}
        strictLock={strictLock}
        setStrictLock={setStrictLock}
        bankPapers={bank.papers}
        trackPapers={activeTrackPapers}
        onDeleteTrackPaper={(id) => setTrackAiPapers(deleteStoredTrackAiPaper(id))}
        bankAttempts={bank.attempts}
        misses={misses}
        log={log}
        onExit={onExit}
        onOpenReal={onOpenReal}
        onCancelMake={() => {
          ctrl.current?.abort();
          setPhase("setup");
        }}
        onMake={() => void make()}
        onRedo={redo}
      />
    );
  }

  const done = phase === "done";
  const scaledReport = tcfScale ?? tefScale;

  return (
    <div className="page practice">
      <section className="essay-stage">
        <header className="exam-top">
          <button
            className="btn btn-ghost"
            onClick={() => {
              halt();
              timer.stop();
              setPhase("setup");
            }}
          >
            {done ? "再来一套" : "放弃"}
          </button>
          <span className="eyebrow">
            {TRACK_META[activeTrack].shortName} · {COMP_LABEL[kind]} · {activeTrack === "delf" ? level : "四选一"} · {exs.length > 1 ? "整套" : topicOf(exs[0]?.topic)?.zh}
            {askedSet ? " · 错题重做" : ""}
          </span>
          {!listen && !done && timed && <span className={`exam-clock ${timer.sec === 0 ? "is-over" : ""}`}>{timer.sec === 0 ? "时间到" : clock(timer.sec)}</span>}
        </header>

        {listen && !done && (
          <div className="real-flow">
            <p className="muted small">
              {activeTrack !== "delf"
                ? `考规提醒：${TRACK_META[activeTrack].shortName} 听力实行「严格 1 遍播音（只放一遍）」：先 20 秒读题预览 → 播放 1 遍录音 → 15 秒作答。`
                : "提示：TTS 音频仅用于熟悉题型，考前须搭配真实电台脱敏。"}
            </p>
            {exs.length > 1 && (
              <div className="panel exam-player">
                {continuousMock ? (
                  <>
                    <span className="muted small">整卷「连续不可中断」模式：将依次按官方停顿连续播放 Exercice 1 → {exs.length}，期间不可跳过或暂停。</span>
                    {!pace && exs.some((_, i) => !heard[i]) && (
                      <button className="btn btn-primary" onClick={() => void performPaper()}>
                        <Play size={16} /> 开始整卷连续播放（Exercice 1 → {exs.length}）
                      </button>
                    )}
                    {!pace && (
                      <button
                        className="btn btn-ghost"
                        onClick={() => {
                          setContinuousMock(false);
                          writeKey(CONTINUOUS_KEY, "0");
                        }}
                      >
                        切回逐题手动
                      </button>
                    )}
                  </>
                ) : (
                  !pace && (
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
                        setContinuousMock(true);
                        writeKey(CONTINUOUS_KEY, "1");
                      }}
                    >
                      启用整卷「连续不可中断」模式
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {done && (
          <div className="essay-marks">
            {scaledReport ? (
              <>
                <p className="essay-total">
                  {scaledReport.score699}
                  <small>/699</small>
                </p>
                <div className="exam-dash-badges">
                  <span className={`chip ${scaledReport.score699 >= 400 ? "is-pass" : ""}`}>
                    CEFR {scaledReport.cefr}
                  </span>
                  <span className={`chip ${scaledReport.nclc >= 7 ? "is-pass" : ""}`}>
                    NCLC {scaledReport.nclc}{scaledReport.nclc >= 7 ? "+（加拿大移民达标）" : ""}
                  </span>
                  <span className="chip">
                    答对 {scaledReport.correctCount}/{scaledReport.totalCount} 题
                  </span>
                </div>
                <p className="muted">
                  {activeTrack === "tcf"
                    ? "按 FEI TCF 100–699 阶梯难度赋分（B2 线 400 分；TCF Canada NCLC 7 线：听力 458 / 阅读 453）。"
                    : "按 CCI Paris TEF 新政 0–699 分与 IRCC 等值曲线换算（B2 线 400 分；TEF Canada 听读 NCLC 7 线 434 分）。"}
                </p>
              </>
            ) : (
              <>
                <p className="essay-total">
                  {num(score)}
                  <small>/{num(total)}</small>
                </p>
                <p className="muted">
                  {total === 25 ? "这就是考试的 25 分制。" : `折合考试的 25 分制约 ${num(outOf25({ score, total }))} 分。`}
                  及格线是四个部分合计 50/100，每部分不低于 5 分。
                </p>
              </>
            )}
          </div>
        )}

        {exs.map((ex, e) => {
          if (askedSet && !ex.questions.some((_, k) => askedSet.has(`${e}-${k}`))) return null;
          return (
            <CompExerciseBody
              key={e}
              kind={kind}
              examTrack={activeTrack}
              listen={listen}
              done={done}
              ex={ex}
              exIdx={e}
              exCount={exs.length}
              voicesDoc={voices[e]}
              isAsked={isAsked}
              pace={pace}
              heard={!!heard[e]}
              continuousMock={continuousMock}
              panel={panel}
              setPanel={setPanel}
              showZh={showZh}
              setShowZh={setShowZh}
              ceHl={ceHl}
              setCeHl={setCeHl}
              picked={picked}
              setPicked={setPicked}
              typed={typed}
              setTyped={setTyped}
              struck={struck}
              setStruck={setStruck}
              expls={expls}
              explBusy={explBusy}
              causes={causes}
              canExplainWrong={ready.text(ai)}
              activeCeKey={activeCeKey}
              setActiveCeKey={setActiveCeKey}
              ceInputRefs={ceInputRefs}
              activeCeRef={activeCeRef}
              onPerform={(idx) => void perform(idx)}
              onSkipWait={() => skip.current?.()}
              onHalt={halt}
              onReplay={(exIdx, docIdx) => void replay(exIdx, docIdx)}
              onSpeakPiece={speakPiece}
              onToggleStrike={toggleStrike}
              onExplainWrong={explainWrong}
              onBlame={blame}
            />
          );
        })}

        {!done && (
          <div className="writing-actions">
            <span className="essay-count">
              已答 {answered}/{all.length}
            </span>
            <button className="btn btn-primary btn-xl" onClick={finish} disabled={answered === 0}>
              交卷 <ArrowRight size={18} />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
